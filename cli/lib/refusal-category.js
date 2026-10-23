/**
 * refusal-category.js — why the pair's own method's answer was not used, in
 * a few words that can be counted. Shared by the key-value pipeline
 * (lib/translate-pair.js) and the content lanes (lib/fallback.js); no
 * imports, so neither gets an import cycle.
 */

/**
 * A quality-gate refusal (or a missing answer) in a few words, so refusals
 * can be counted: "length inflation (3.2x source, max 2.5x)" → "length
 * inflation". The gate's own wording, without the figures that make each
 * one unique.
 *
 * @param {string|null} reason - The gate's reason (null: no answer for it)
 * @param {{ sharedOutput?: boolean, memorized?: boolean, heldBefore?: boolean, noAnswer?: boolean }} [flags]
 * @returns {string}
 */
export function refusalCategory(reason, flags = {}) {
  if (flags.heldBefore) return 'refused on an earlier sync, so not asked again';
  if (flags.sharedOutput || flags.memorized || /memorized sentence/.test(String(reason || ''))) {
    return 'a memorized sentence repeated for different source strings';
  }
  if (flags.noAnswer || !reason) return 'no answer';
  const text = String(reason);
  if (/^source echo|disguised|English in disguise/i.test(text)) return 'a copy of the source text';
  if (/protected element/i.test(text)) return 'code, links or markup damaged or missing';
  if (/content was lost|content preservation|orphaned placeholder/i.test(text)) return 'content lost or changed';
  // The gate's words up to its figures or explanation: "length inflation",
  // "repetition hallucination", "wrong script", "empty translation", …
  return text.split(/ \(| — |: |; /)[0].trim() || 'refused by the quality gate';
}

/**
 * Count one unit the fallback was asked for, under why the primary's answer
 * was not used (mutates `report.primaryReasons`).
 *
 * @param {object} report - A fallback report (lib/fallback.js newFallbackReport)
 * @param {string} category - refusalCategory()
 */
export function notePrimaryReason(report, category) {
  if (!report) return;
  report.primaryReasons = report.primaryReasons || {};
  report.primaryReasons[category] = (report.primaryReasons[category] || 0) + 1;
}
