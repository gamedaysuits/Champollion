/**
 * contaminationBadge — pure, browser-safe contamination-lane helpers for the
 * leaderboard / mesh / card UIs.
 *
 * This is the front-end mirror of the lane policy in
 * arena/mt_eval_harness/contamination.py. It is intentionally dependency-free
 * (no `fs`) so it can be bundled into the Docusaurus client. Its one job is
 * BADGING + lane classification — not gating.
 *
 * Policy (SSOT): every dataset carries a `contamination` grade (LOW / MEDIUM /
 * HIGH). A HIGH-contamination corpus (e.g. FLORES+, in essentially every
 * frontier model's training data) is RELATIVE-COMPARISON-ONLY: its scores rank
 * methods against each other on THAT corpus, never as absolute quality. LOW /
 * MEDIUM corpora are rankable on absolute quality. The grade is data-driven —
 * it rides on `datasets.metadata.contamination`, with the run card's stamped
 * `contamination` (publish.py) as the fallback source — never a hardcoded
 * per-dataset list.
 *
 * Two consumers, two null policies — keep them straight:
 *   - BADGING is descriptive. An unknown/unset grade yields no badge
 *     (`isRelativeOnly(null) === false`); we don't assert contamination we
 *     can't see.
 *   - The LANE GATE is a safety boundary and FAILS SAFE. `isRelativeOnlyLane`
 *     treats an UNKNOWN grade as relative-only, so an ungraded corpus — or one
 *     present in the registry but MISSING from the prod datasets table — can
 *     never slip into the absolute-quality ranking. Defaulting unknown to the
 *     absolute lane was the "fails open" bug this guards against.
 */

export const LANE_ABSOLUTE = "absolute-quality";
export const LANE_RELATIVE_ONLY = "relative-comparison-only";

/** Grades that force a corpus into the relative-only lane. Mirrors
 *  contamination.RELATIVE_ONLY_GRADES on the Python side. */
const RELATIVE_ONLY_GRADES = new Set(["HIGH"]);

/** Upper-case a contamination grade; map empty / "NONE" to null. */
export function normalizeContamination(grade) {
  if (grade == null) return null;
  const g = String(grade).trim().toUpperCase();
  if (!g || g === "NONE") return null;
  return g;
}

/** True when a grade forces a corpus into the relative-only lane (HIGH). */
export function isRelativeOnly(grade) {
  return RELATIVE_ONLY_GRADES.has(normalizeContamination(grade));
}

/** Canonical lane label for a contamination grade. */
export function laneForContamination(grade) {
  return isRelativeOnly(grade) ? LANE_RELATIVE_ONLY : LANE_ABSOLUTE;
}

/**
 * Resolve an entry's effective contamination grade from its candidate sources,
 * in priority order:
 *   1. the live datasets-table grade (registry SSOT, synced to prod)
 *   2. the grade publish.py stamps onto the run card itself
 *      (`run_card.contamination`)
 * Returns the normalized grade, or null when NEITHER source carries one.
 *
 * The run-card fallback is what closes the "fails open" hole: a HIGH corpus
 * present in the registry but MISSING from the prod datasets table still
 * resolves to its real grade instead of collapsing to null.
 */
export function resolveContaminationGrade(datasetGrade, runCardGrade) {
  return (
    normalizeContamination(datasetGrade) ??
    normalizeContamination(runCardGrade)
  );
}

/**
 * Lane gate — FAIL SAFE. Returns true when an entry is relative-comparison-only
 * and MUST be excluded from the absolute-quality ranking.
 *
 *   known HIGH                → true  (relative-only)
 *   known LOW / MEDIUM        → false (rankable on absolute quality)
 *   UNKNOWN (no grade at all) → true  (fail safe)
 *
 * Defaulting unknown contamination to the absolute lane is the "fails open"
 * bug: a prod-missing HIGH corpus resolved to null and ranked as trustworthy
 * absolute quality. Unknown contamination must NEVER be ranked as absolute.
 */
export function isRelativeOnlyLane(datasetGrade, runCardGrade) {
  const grade = resolveContaminationGrade(datasetGrade, runCardGrade);
  if (grade == null) return true; // fail safe: unknown → relative-only lane
  return isRelativeOnly(grade);
}

/**
 * Badges to render for a contamination grade.
 * Returns an array of { code, label, title } — empty for an unset/LOW grade.
 * `code` drives styling ("high" is the prominent relative-only badge).
 */
export function contaminationBadges(grade) {
  const g = normalizeContamination(grade);
  if (!g) return [];
  if (g === "HIGH") {
    return [{
      code: "high",
      label: "Relative comparison only",
      title:
        "HIGH contamination — this corpus is likely in models' training " +
        "data, so scores are valid for comparing methods on THIS corpus, " +
        "not as an absolute measure of quality. Kept out of absolute-quality " +
        "rankings.",
    }];
  }
  if (g === "MEDIUM") {
    return [{
      code: "medium",
      label: "Possible contamination",
      title:
        "MEDIUM contamination — interpret absolute scores with caution; some " +
        "of this corpus may appear in models' training data.",
    }];
  }
  return [];
}
