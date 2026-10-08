/**
 * scoringStandard.mjs — how the website shows and ranks scores
 * ("scoring standard/1", founder 2026-10-04: "we want scoring to be industry
 * standard").
 *
 * What WMT, FLORES-200 and AmericasNLP do, and what every score surface on
 * this site now does:
 *
 *   - ONE headline and ranking metric: chrF++, with its 95% bootstrap CI —
 *     "chrF++ 47.5 [45.9, 49.0]". Default sort: chrF++ descending, nulls last.
 *   - The other standard metrics (BLEU, spBLEU, TER, COMET) shown BESIDE it,
 *     never blended into it.
 *   - Diagnostics (exact match, FST acceptance, equivalent match, semantic
 *     similarity) shown apart, under a "diagnostics" label — never a headline,
 *     never a default sort.
 *   - No quality labels read off automatic scores. The old tier words are
 *     retired from every score surface.
 *
 * The weighted composite this replaces blended chrF++ with the diagnostics and
 * labelled a tier off it; an untrained model repeating one valid Northern Sami
 * sentence scored composite 0.62, "functional", at chrF++ 5.5. Cards scored
 * before standard/1 keep their stored composite; it is shown only as
 * "legacy composite (retired)".
 */

/** The standard a run card declares in `scores.scoring_standard`. */
export const SCORING_STANDARD = 'standard/1';

/** The headline / ranking metric's run_cards column. */
export const PRIMARY_METRIC = 'chrf_plus_plus';

/** Display name of the headline metric. */
export const PRIMARY_LABEL = 'chrF++';

/** The only wording under which a stored composite may appear. */
export const LEGACY_COMPOSITE_LABEL = 'legacy composite (retired)';

/** Heading for the diagnostics group. */
export const DIAGNOSTICS_LABEL = 'diagnostics';

/**
 * Quality-tier words that may never be printed as a label on a score surface.
 * Exported for the source-level guard in the tests, not for display.
 */
export const RETIRED_TIER_WORDS = Object.freeze(['baseline', 'emerging', 'functional', 'deployable', 'fluent']);

/** A finite number, or null. Numeric strings (JSON-extracted text) parse. */
export function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The chrF++ headline: "chrF++ 47.5 [45.9, 49.0]". The interval appears only
 * when both bounds are numbers; a missing score reads "chrF++ —".
 *
 * @param {number|null} score
 * @param {number|null} [lo]
 * @param {number|null} [hi]
 * @param {{label?: boolean, digits?: number}} [opts]
 * @returns {string}
 */
export function formatChrf(score, lo, hi, {label = true, digits = 1} = {}) {
  const s = num(score);
  const head = label ? `${PRIMARY_LABEL} ` : '';
  if (s == null) return `${head}—`;
  const l = num(lo);
  const h = num(hi);
  const ci = l != null && h != null ? ` [${l.toFixed(digits)}, ${h.toFixed(digits)}]` : '';
  return `${head}${s.toFixed(digits)}${ci}`;
}

/**
 * True when a run card predates standard/1 (no `scores.scoring_standard`).
 * Accepts the full run_card JSON, or a listing row whose
 * `scoring_standard` was JSON-extracted (run_card->scores->>scoring_standard).
 */
export function isLegacyCard(cardOrRow) {
  if (!cardOrRow || typeof cardOrRow !== 'object') return true;
  const declared =
    cardOrRow.scoring_standard ?? cardOrRow.scores?.scoring_standard ?? null;
  return !declared;
}

/**
 * The stored composite of a LEGACY card, for display under
 * LEGACY_COMPOSITE_LABEL; null for a standard/1 card or a card with none.
 */
export function legacyComposite(composite, cardOrRow) {
  const c = num(composite);
  if (c == null) return null;
  return isLegacyCard(cardOrRow) ? c : null;
}
