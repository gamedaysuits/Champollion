/**
 * corpusFloors.js
 *
 * Corpus-size significance floors shared by every surface that renders
 * evaluation scores (leaderboard table, row detail, legends).
 *
 * Single source of truth for the 50/100 thresholds — never inline these
 * numbers in components. Values mirror the corpus design specification §6.3
 * (champollion.dev/docs/network/specifications/corpus-design) and the arena report
 * linter (arena/scripts/lint_run_reports.py: SIGNIFICANCE_FLOOR /
 * DEV_SET_FLOOR); keep the three in sync.
 *
 * Small corpora are NEVER excluded or demoted from rankings. These floors
 * drive caveat badges and "help build this corpus" contribution CTAs only.
 *
 * This is a pure utility — no React, no side-effects.
 */

/**
 * Below this many evaluated entries, paired bootstrap tests cannot reliably
 * detect differences smaller than ~5 chrF++ points: confidence intervals are
 * mandatory and no statistical-significance ("X beats Y") claims are allowed.
 */
export const SIGNIFICANCE_FLOOR = 100;

/**
 * The development-set floor. Below this many evaluated entries, score
 * orderings are indicative only.
 */
export const DEV_SET_FLOOR = 50;

/**
 * Classify an evaluated-entry count (n) against the floors.
 *
 * @param {number|null|undefined} n - evaluated entries behind a run's scores
 * @returns {"ok"|"belowSignificance"|"belowDevFloor"|null} null when n is unknown
 */
export function corpusSizeLevel(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < DEV_SET_FLOOR) return "belowDevFloor";
  if (n < SIGNIFICANCE_FLOOR) return "belowSignificance";
  return "ok";
}
