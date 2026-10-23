/**
 * Contamination-lane policy — CLI-side mirror of the SSOT in
 * arena/mt_eval_harness/contamination.py (keep the two in sync; the website
 * util cli/website/src/utils/contaminationBadge.js mirrors the same policy).
 *
 * Every evaluation dataset carries a contamination grade (LOW / MEDIUM /
 * HIGH; NONE is treated as absent). The grade answers one question: can a
 * score on this corpus be read as an ABSOLUTE measure of translation
 * quality, or only as a RELATIVE comparison between methods run on the same
 * corpus?
 *
 * The gate FAILS SAFE: only a positively-LOW grade earns the absolute lane.
 * HIGH, MEDIUM, an absent/NONE grade, or an unknown/misspelled grade are all
 * relative-comparison-only — a missing grade can never let a benchmark score
 * masquerade as real translation quality.
 */

// Grades that force a corpus into the relative-comparison-only lane. Listed
// explicitly so the policy is auditable at a glance.
const RELATIVE_ONLY_GRADES = new Set(['HIGH', 'MEDIUM']);

// The ONLY grade that earns the absolute-quality lane — the inverse SSOT that
// makes the gate fail safe (an unrecognized grade is not in this set, so it
// defaults to relative-only instead of slipping through to absolute).
const ABSOLUTE_RANKABLE_GRADES = new Set(['LOW']);

// Canonical lane labels (stable machine values for --json consumers).
const LANE_ABSOLUTE = 'absolute-quality';
const LANE_RELATIVE_ONLY = 'relative-comparison-only';

/**
 * Upper-case a contamination grade; map empty / "NONE" to null (unknown).
 *
 * @param {*} grade - Raw value as it appears on a card/registry entry
 * @returns {string|null}
 */
function normalizeGrade(grade) {
  if (grade == null) return null;
  const g = String(grade).trim().toUpperCase();
  if (!g || g === 'NONE') return null;
  return g;
}

/**
 * True when a grade keeps a corpus OUT of the absolute-quality lane.
 * FAIL SAFE: absolute-rankable only when positively LOW; HIGH/MEDIUM,
 * absent, and unrecognized grades all return true.
 *
 * @param {*} grade
 * @returns {boolean}
 */
function isRelativeOnly(grade) {
  const g = normalizeGrade(grade);
  return g === null || !ABSOLUTE_RANKABLE_GRADES.has(g);
}

/**
 * The canonical lane label for a contamination grade (fail-safe by
 * construction — delegates to isRelativeOnly).
 *
 * @param {*} grade
 * @returns {string}
 */
function laneForGrade(grade) {
  return isRelativeOnly(grade) ? LANE_RELATIVE_ONLY : LANE_ABSOLUTE;
}

export {
  RELATIVE_ONLY_GRADES,
  ABSOLUTE_RANKABLE_GRADES,
  LANE_ABSOLUTE,
  LANE_RELATIVE_ONLY,
  normalizeGrade,
  isRelativeOnly,
  laneForGrade,
};
