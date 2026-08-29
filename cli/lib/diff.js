/**
 * Key diff engine — compares source locale against target locales.
 *
 * Detects seven categories of keys:
 *   1. Missing:       exist in source but not in target
 *   2. Stale:         exist in target but removed from source
 *   3. Fallback:      exist in target but prefixed with [EN] (need real translation)
 *   4. Untranslated:  target value is identical to source value (likely pre-populated
 *                     by tools like `docusaurus write-translations` with English defaults)
 *   5. Changed:       source content hash differs from last sync (auto-detected)
 *   6. Forced:        explicitly requested for re-translation via --force-keys
 *   7. No-translate:  declared exempt (config `noTranslate` / auto-detected URL) and
 *                     currently NOT byte-identical to the source — needs a verbatim copy
 *
 * WHY: The diff is the decision layer that determines what work needs
 * to be done. By separating it from the translation and write layers,
 * we can dry-run, audit, or sync with identical detection logic.
 *
 * WHY "untranslated": Docusaurus's `write-translations` pre-populates
 * ALL locale directories with English defaults. Without this check,
 * the diff sees "key exists, value present, no [EN] prefix" and skips
 * it — leaving entire locales (e.g. Thai, Filipino) completely untranslated.
 */

import { flattenKeys } from './flatten.js';

/**
 * Diff a target locale against the source.
 *
 * @param {object} sourceFlat - Flattened source locale
 * @param {object} targetFlat - Flattened target locale
 * @param {string} fallbackPrefix - The prefix marking untranslated values (default: "[EN] ")
 * @param {string[]} forceKeys - Dot-notation keys to force re-translate (default: [])
 * @param {string[]} changedKeys - Keys detected as changed via content hashing (default: [])
 * @param {((key: string, sourceValue: string) => boolean)|null} isConfirmedEcho -
 *   Optional callback consulted ONLY for keys that would be queued for the
 *   equals-source ("untranslated") reason. Return true when the echo is
 *   CONFIRMED — i.e. the pipeline itself previously produced this exact
 *   source-equal value (gate-approved, TM-recorded) — and the key is NOT
 *   requeued for that reason. Missing/changed/forced reasons still queue.
 *   Invoked lazily so callers pay a TM lookup only for actual echo candidates.
 * @param {((key: string, sourceValue: string) => boolean)|null} isNoTranslate -
 *   Optional predicate identifying keys whose correct value in EVERY locale is
 *   the source value, verbatim (config `noTranslate` patterns, auto-detected
 *   URLs — see lib/no-translate.js). Matching string keys are removed from every
 *   translate reason and routed to the `noTranslate` bucket instead, so they are
 *   never sent to a backend, never quality-gated, and never billed.
 * @returns {import('./types.js').DiffResult} Diff result with missing, needsTranslation, untranslated, changed, forced, noTranslate, extra, toProcess
 */
function diffLocale(sourceFlat, targetFlat, fallbackPrefix = '[EN] ', forceKeys = [], changedKeys = [], isConfirmedEcho = null, isNoTranslate = null) {
  const sourceKeys = new Set(Object.keys(sourceFlat));
  const targetKeys = new Set(Object.keys(targetFlat));

  // Keys declared exempt from translation. Restricted to string-valued source
  // keys: non-strings (numbers, booleans, arrays) already pass through verbatim
  // on every path, so marking them would be a no-op that only muddies counts.
  const exempt = isNoTranslate
    ? new Set([...sourceKeys].filter(k =>
      typeof sourceFlat[k] === 'string' && isNoTranslate(k, sourceFlat[k])))
    : new Set();

  // Keys in source but not in target
  const missing = [...sourceKeys].filter(k => !targetKeys.has(k) && !exempt.has(k));

  // Keys in target that are still [EN]-prefixed fallbacks
  const needsTranslation = [...targetKeys].filter(k =>
    !exempt.has(k) && typeof targetFlat[k] === 'string' && targetFlat[k].startsWith(fallbackPrefix)
  );

  // Keys where target value is identical to source value.
  // This catches locales pre-populated with English defaults by tools
  // like `docusaurus write-translations`. Without this, Thai/Filipino/etc.
  // would appear "fully synced" with all-English content.
  //
  // Only flag string values that aren't already caught by needsTranslation,
  // and skip very short values (1-2 chars) that are likely intentionally
  // identical across locales (e.g. punctuation, symbols, numbers).
  const needsTranslationSet = new Set(needsTranslation);
  const untranslated = [...targetKeys].filter(k => {
    if (needsTranslationSet.has(k)) return false; // already flagged
    if (exempt.has(k)) return false; // source-equal IS the correct state here
    if (!sourceKeys.has(k)) return false; // extra key, not our concern
    const sv = sourceFlat[k];
    const tv = targetFlat[k];
    // Only compare string values
    if (typeof sv !== 'string' || typeof tv !== 'string') return false;
    // Skip very short values — punctuation, numbers, symbols are
    // often intentionally identical across locales.
    if (sv.length <= 2) return false;
    if (sv !== tv) return false;
    // Confirmed echo: the pipeline previously produced this exact
    // source-equal value (it passed the gate and sits in the TM), so
    // requeuing it every sync would just re-serve the same TM hit and
    // rewrite the same file forever. Brand-new echoes (unconfirmed)
    // still queue once — after the API returns the same text and the TM
    // stores it, subsequent syncs skip.
    if (isConfirmedEcho && isConfirmedEcho(k, sv)) return false;
    return true;
  });

  // Keys whose English source content changed since last sync (auto-detected).
  // Only include keys that exist in the source (defensive filter).
  const changed = changedKeys.filter(k => sourceKeys.has(k) && !exempt.has(k));

  // Keys explicitly forced for re-translation (only if they exist in source).
  // Silently ignore any forced keys that don't exist in the source.
  //
  // --force-keys does NOT override no-translate: forcing re-translation of a
  // key whose only correct output is the source value would just re-run the
  // failure this bucket exists to prevent. The key still gets re-copied below
  // if the target has drifted.
  const forced = forceKeys.filter(k => sourceKeys.has(k) && !exempt.has(k));

  // Keys in target but not in source (stale/orphaned)
  const extra = [...targetKeys].filter(k => !sourceKeys.has(k));

  // Exempt keys whose target is not byte-identical to the source. That covers
  // three states with one rule: never written, [EN]-prefixed from an older
  // run, or CORRUPTED — the gate-dodging edits ("…/view/1954#fr", a prepended
  // U+200E) that shipped to production. All three are repaired by the same
  // verbatim copy, so the drift heals itself on the next sync and the result
  // is idempotent: once equal, the key stops appearing here.
  const noTranslate = [...exempt].filter(k => targetFlat[k] !== sourceFlat[k]);

  // Combined set of keys that need work (deduplicated). Exempt keys are
  // deliberately absent: nothing here is sent to a backend or billed.
  const toProcess = [...new Set([...missing, ...needsTranslation, ...untranslated, ...changed, ...forced])];

  return { missing, needsTranslation, untranslated, changed, forced, noTranslate, extra, toProcess };
}

/**
 * Generate a human-readable label for the diff result.
 *
 * @param {import('./types.js').DiffResult} diff - Diff result from diffLocale
 * @returns {string} Human-readable summary (e.g., '3 missing + 1 [EN] fallback(s)')
 */
function diffLabel(diff) {
  const { missing, needsTranslation, untranslated, changed, forced, noTranslate } = diff;
  const parts = [];
  if (missing.length > 0) parts.push(`${missing.length} missing`);
  if (needsTranslation.length > 0) parts.push(`${needsTranslation.length} [EN] fallback(s)`);
  if (untranslated && untranslated.length > 0) parts.push(`${untranslated.length} untranslated`);
  if (changed && changed.length > 0) parts.push(`${changed.length} changed`);
  // Forced keys were invisible here, so a `--force-keys a,b` run over a
  // locale with requeued echoes printed a total ("Translating 77 key(s)")
  // that nothing itemized — a user could not tell their 2 forced keys from
  // the 75 unstamped echoes riding along.
  if (forced && forced.length > 0) parts.push(`${forced.length} forced`);
  if (noTranslate && noTranslate.length > 0) parts.push(`${noTranslate.length} to copy verbatim`);
  if (parts.length > 0) return parts.join(' + ');
  return 'fully synced';
}

export { diffLocale, diffLabel };
