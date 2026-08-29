/**
 * Translation Quality Gate — deterministic output validation.
 *
 * WHY: LLMs producing conlang/fictional translations often generate:
 *   - Repetitive nonsense ("Qo' Qo' Qo' Qo'") — hallucination loop
 *   - Drastically inflated output (300+ chars for a 5-char source) — padding
 *   - ASCII text for non-Latin scripts — wrong script entirely
 *   - Source text echoed back verbatim — lazy passthrough
 *   - Source text with the untranslatable letters DELETED, punctuation and
 *     spacing left standing ("low-resource nmt · tokenizers · nêhiyawêwin"
 *     → "   ·   · êhiêi") — hollowing
 *
 * This module provides fast, deterministic checks that catch these failure
 * modes BEFORE translations are written to locale files. Failed keys are
 * logged loudly and excluded from the result.
 *
 * HOW IT WORKS:
 *   The sync loop calls `validateTranslations()` on the merged output of
 *   each language pair. Each key-value pair is checked against:
 *     1. Repetition detector (trigram + long-8-gram frequency analysis,
 *        source-relative caps)
 *     2. Length ratio check (source vs translated length)
 *     3. Script compliance (non-Latin locales must produce non-ASCII)
 *     4. Source echo check (translated value ≠ source value)
 *     5. Content preservation (the output is not the source, hollowed out)
 *
 *   Keys that fail any check are removed and logged as [GATE] failures.
 *   The caller receives only validated translations.
 *
 * CONFIGURATION:
 *   Per-language overrides can be set via the pair config:
 *     "languages": { "tlh": { "maxLengthRatio": 5, "requireNonLatin": true } }
 */

import { getAllLanguageCodes, getLanguageCard } from './registers.js';

/**
 * Locales whose scripts are predominantly non-Latin.
 *
 * DERIVED FROM LANGUAGE CARDS — not hardcoded. At module load, we scan
 * every registered language card and collect those with a non-Latin script.
 * Adding a new card with script: "Geor" (Georgian) or "Cans" (Cree Syllabics)
 * automatically includes it here — no manual set maintenance needed.
 *
 * WHY DYNAMIC: The old hardcoded set drifted from reality whenever a new
 * language card was added. Georgian was added in the v5 refactor but the
 * set already had 'ka' — what about Quechua ('qu', Latn)? Yoruba ('yo', Latn)?
 * By reading the card data, we always match the source of truth.
 */
function _buildNonLatinSet() {
  const set = new Set();
  for (const code of getAllLanguageCodes()) {
    const card = getLanguageCard(code);
    if (!card) continue;

    // Cards with non-Latin script are flagged — UNLESS they have a
    // scriptConverter, meaning the LLM produces Latin output (e.g., SRO
    // for Plains Cree) and script conversion is a post-processing step.
    // The quality gate runs before conversion, so Latin output is correct.
    if (card.script && card.script !== 'Latn' && !card.scriptConverter) {
      set.add(code);

      // Also add aliases so lookups like 'zh-CN' hit without base-locale fallback
      if (Array.isArray(card.aliases)) {
        for (const alias of card.aliases) {
          set.add(alias);
        }
      }
    }
  }
  return set;
}

const NON_LATIN_LOCALES = _buildNonLatinSet();

/**
 * Default validation thresholds.
 * These are intentionally generous — the goal is to catch gross failures,
 * not nitpick edge cases. Tighter thresholds can be set per-language.
 */
const DEFAULT_THRESHOLDS = {
  // Max ratio of translated length to source length before flagging.
  // e.g., 4.0 means translated text can be up to 4x longer than source.
  // Some languages (German, Finnish) legitimately produce longer text.
  maxLengthRatio: 4.0,

  // Min ratio of translated length to source length before flagging.
  // Catches truncation/empty output masquerading as translation.
  minLengthRatio: 0.1,

  // Max percentage of repeated trigrams before flagging as hallucination.
  // A hallucinated output like "Qo' Qo' Qo'" has ~100% repetition.
  // Particle-heavy languages legitimately run high here (formal Tagalog
  // measures 60-70% from kung/ng/mga/paano alone), which is why exceeding
  // this cap is necessary but NOT sufficient to flag — see
  // maxLongRepetitionRate below.
  maxRepetitionRate: 0.60,

  // Max percentage of repeated LONG (8-char) n-grams before flagging.
  // Degeneration loops repeat long substrings, so they score ~100% at this
  // window too; particle-heavy text repeats only short function words and
  // stays low (correct Tagalog ~24%, deliberate phrase repetition ~45%).
  // A repetition flag requires BOTH this and maxRepetitionRate to be
  // exceeded.
  maxLongRepetitionRate: 0.50,

  // Whether to require non-ASCII characters for non-Latin locales.
  // When true, a translation containing only ASCII for a CJK/Cyrillic/etc
  // locale is flagged as wrong-script.
  requireNonLatin: true,

  // Min fraction of the source's CONTENT characters (letters + digits) the
  // translation must retain before the hollowing check looks harder. This is
  // deliberately NOT a standalone rule — see checkContentPreservation for why
  // a bare density ratio cannot work.
  minContentRetention: 0.35,
};

// Window size for the long-n-gram repetition confirmation signal.
const REPETITION_LONG_N = 8;

// A source with fewer content characters than this is too short to measure a
// meaningful retention ratio ("OK", "Blog", "npm"), and the empty/echo/script
// checks already cover that range.
const MIN_MEASURABLE_CONTENT = 6;

/** Letters and digits — the characters that actually carry meaning. */
const CONTENT_CHAR = /[\p{L}\p{N}]/u;

/**
 * Characters that are invisible AND survive String.prototype.trim().
 *
 * trim() strips White_Space only. The Cf (format) category — U+200B ZERO
 * WIDTH SPACE, U+200E LEFT-TO-RIGHT MARK, U+2060 WORD JOINER, U+180E — is
 * not White_Space, so a value built entirely from those has trim().length > 0
 * and used to pass the empty check while rendering as a blank string on the
 * page. That is the same corruption family as the URL incident.
 */
const INVISIBLE_NON_WHITESPACE = /\p{Cf}/gu;

/**
 * Extract the content characters (letters + digits) of a string.
 *
 * NFC-normalized first so a decomposed "ê" (e + U+0302) counts as one
 * character on both sides of a comparison rather than one letter plus a
 * combining mark.
 *
 * @param {string} text
 * @returns {string[]} Content characters, in order
 */
function contentCharacters(text) {
  return [...String(text).normalize('NFC')].filter(ch => CONTENT_CHAR.test(ch));
}

/**
 * Is `needle` a subsequence of `haystack` — i.e. can it be produced by
 * DELETING characters from it, without reordering?
 *
 * Case-insensitive: the observed corruption preserves case, but a model that
 * also lowercased while deleting is the same defect.
 *
 * @param {string[]} needle
 * @param {string[]} haystack
 * @returns {boolean}
 */
function isSubsequence(needle, haystack) {
  let i = 0;
  for (const ch of haystack) {
    if (i < needle.length && needle[i].toLowerCase() === ch.toLowerCase()) i++;
  }
  return i === needle.length;
}

/**
 * Detect a HOLLOWED translation: the source with its letters deleted.
 *
 * THE BUG THIS CATCHES, observed in production:
 *   "low-resource nmt · tokenizers · nêhiyawêwin" → "   ·   · êhiêi"
 *   "the simple-builder approach"                 → "  "
 * Every letter the model had no vocabulary for was deleted and the source's
 * punctuation and spacing skeleton was left standing. The result passed every
 * existing check: not empty (after trim), not an echo, not repetitive, and at
 * 33% of the source LENGTH it cleared minLengthRatio (0.1) comfortably.
 *
 * WHY DENSITY ALONE CANNOT WORK — the obvious rule ("reject below X% of the
 * source's alphanumeric density") is unshippable, because legitimate dense
 * scripts sit in exactly the same place:
 *
 *     "low-resource nmt · …"  → "   ·   · êhiêi"   0.14 retained   ← BUG
 *     "Getting started"       → "入门"              0.14 retained   ← CORRECT
 *     "Frequently asked …"    → "常见问题"           0.17 retained   ← CORRECT
 *
 * Any threshold that catches the first rejects Chinese, Japanese and Korean
 * outright. What actually separates them is not how MUCH survived but WHERE
 * it came from: the hollowed output is a subsequence of its own source, while
 * a real translation shares essentially nothing with it.
 *
 *     isSubsequence("êhiêi", "lowresourcenmttokenizersnêhiyawêwin")  → true
 *     isSubsequence("入门",   "gettingstarted")                       → false
 *
 * So a flag requires BOTH signals — the same necessary-but-not-sufficient
 * design the repetition detector uses. Verified against real Klingon output
 * from the same run ("Doing things with logic" → "meqmo' vay' vita'", 0.60
 * retained, not a subsequence): correct conlang translation is unaffected.
 *
 * @param {string} source - Source value
 * @param {string} translated - Candidate translation
 * @param {number} minRetention - Retention floor below which the subsequence
 *   signal is consulted (DEFAULT_THRESHOLDS.minContentRetention)
 * @returns {{ reason: string, retention: number }|null} Failure, or null if OK
 */
function checkContentPreservation(source, translated, minRetention = DEFAULT_THRESHOLDS.minContentRetention) {
  const sourceContent = contentCharacters(source);
  if (sourceContent.length < MIN_MEASURABLE_CONTENT) return null;

  const targetContent = contentCharacters(translated);

  // Total hollowing: the source carries real words and the output has no
  // letter or digit at all. No language translates six letters into none, so
  // this needs no second signal — and it is what catches a value built from
  // punctuation, spaces, or invisible U+200B/U+200E characters.
  if (targetContent.length === 0) {
    return {
      reason: 'no translatable content (every letter and digit removed from the source)',
      retention: 0,
    };
  }

  const retention = targetContent.length / sourceContent.length;
  if (retention >= minRetention) return null;

  // Below the floor — necessary, not sufficient. Confirm the output is the
  // source with characters deleted rather than a legitimately terse
  // translation in a denser script.
  if (!isSubsequence(targetContent, sourceContent)) return null;

  return {
    reason:
      `content deleted (only ${(retention * 100).toFixed(0)}% of the source's letters/digits remain, `
      + 'and the result is the source with characters removed — the model had no vocabulary for this string)',
    retention,
  };
}

// A deliberately repetitive source ("Every language, into every language.")
// licenses an equally repetitive translation: the effective caps are raised
// to the source's own measured repetition plus this margin.
const REPETITION_SOURCE_MARGIN = 0.10;

/**
 * Validate a batch of translations and return only passing keys.
 *
 * @param {object} translations - Key → translated value map
 * @param {object} sourceFlat - Key → source value map (for comparison)
 * @param {object} pairConfig - Pair config (target locale, thresholds)
 * @param {object} [options] - Override thresholds for testing
 * @returns {{ validated: object, failures: Array<{ key: string, reason: string, value: string }> }}
 */
function validateTranslations(translations, sourceFlat, pairConfig, options = {}) {
  const targetLocale = pairConfig.target || pairConfig.locale || '';
  const isNonLatin = NON_LATIN_LOCALES.has(targetLocale) || NON_LATIN_LOCALES.has(targetLocale.split('-')[0]);

  // Merge thresholds: options > pairConfig > defaults
  const thresholds = {
    maxLengthRatio: options.maxLengthRatio ?? pairConfig.maxLengthRatio ?? DEFAULT_THRESHOLDS.maxLengthRatio,
    minLengthRatio: options.minLengthRatio ?? pairConfig.minLengthRatio ?? DEFAULT_THRESHOLDS.minLengthRatio,
    maxRepetitionRate: options.maxRepetitionRate ?? pairConfig.maxRepetitionRate ?? DEFAULT_THRESHOLDS.maxRepetitionRate,
    maxLongRepetitionRate: options.maxLongRepetitionRate ?? pairConfig.maxLongRepetitionRate ?? DEFAULT_THRESHOLDS.maxLongRepetitionRate,
    requireNonLatin: options.requireNonLatin ?? pairConfig.requireNonLatin ?? DEFAULT_THRESHOLDS.requireNonLatin,
    minContentRetention: options.minContentRetention ?? pairConfig.minContentRetention ?? DEFAULT_THRESHOLDS.minContentRetention,
  };

  const validated = {};
  const failures = [];

  for (const [key, translated] of Object.entries(translations)) {
    const source = sourceFlat[key] || '';

    // Skip non-string values (shouldn't happen, but defense-in-depth)
    if (typeof translated !== 'string') {
      failures.push({ key, reason: 'non-string value', value: String(translated) });
      continue;
    }

    // Check 1: Empty translation.
    // Format characters are stripped BEFORE the emptiness test: trim() only
    // removes White_Space, so a value made of U+200B / U+200E / U+2060 has
    // trim().length > 0 and used to pass here while rendering as blank. That
    // is how a hollowed value reached disk looking like " ".
    if (translated.replace(INVISIBLE_NON_WHITESPACE, '').trim().length === 0) {
      failures.push({
        key,
        reason: translated.trim().length === 0
          ? 'empty translation'
          : 'empty translation (only invisible formatting characters)',
        value: translated,
      });
      continue;
    }

    // Check 2: Source echo — translated value is identical to source.
    // EXEMPTION: Short strings (≤30 chars) that are mostly ASCII are likely
    // proper nouns, brand names, or technical terms (e.g. "Blog", "GitHub",
    // "npm", "CLI Reference") that legitimately stay in English across all
    // languages. Rejecting these creates an infinite retry loop where the
    // correct translation is rejected every time, burning API calls forever.
    if (translated === source) {
      const asciiRatio = source.replace(/[^\x20-\x7E]/g, '').length / Math.max(source.length, 1);
      const isShortAscii = source.length <= 30 && asciiRatio > 0.8;
      if (!isShortAscii) {
        failures.push({ key, reason: 'source echo (identical to English)', value: translated });
        continue;
      }
      // Short ASCII string echoed back — accept it as a valid translation
    }

    // Check 3: Repetition detection — catches hallucination loops.
    // For pipe-delimited plural strings (e.g. "one doc|{count} docs"),
    // measure each variant independently — plural forms legitimately
    // share most of their text, which inflates the trigram count.
    //
    // Two-signal design: a flag requires a segment to exceed BOTH the
    // trigram cap AND the long-8-gram cap. Trigram repetition alone
    // false-positives on particle-heavy languages (correct formal Tagalog
    // measures 60-70% from kung/ng/mga alone), but only degeneration loops
    // repeat 8-char substrings at high rates. Both caps are also raised to
    // the source's own repetition + margin, so deliberately repetitive copy
    // licenses a matching translation.
    const sourceSegments = splitPluralSegments(source);
    const trigramCap = Math.max(
      thresholds.maxRepetitionRate,
      Math.max(...sourceSegments.map(seg => measureRepetition(seg))) + REPETITION_SOURCE_MARGIN
    );
    const longGramCap = Math.max(
      thresholds.maxLongRepetitionRate,
      Math.max(...sourceSegments.map(seg => measureRepetition(seg, REPETITION_LONG_N))) + REPETITION_SOURCE_MARGIN
    );
    const degenerateSegment = splitPluralSegments(translated)
      .map(seg => ({
        trigramRate: measureRepetition(seg),
        longGramRate: measureRepetition(seg, REPETITION_LONG_N),
      }))
      .find(m => m.trigramRate > trigramCap && m.longGramRate > longGramCap);
    if (degenerateSegment) {
      failures.push({
        key,
        reason: `repetition hallucination (${(degenerateSegment.trigramRate * 100).toFixed(0)}% repeated trigrams, ${(degenerateSegment.longGramRate * 100).toFixed(0)}% repeated ${REPETITION_LONG_N}-grams)`,
        value: translated.slice(0, 80) + (translated.length > 80 ? '...' : ''),
      });
      continue;
    }

    // Check 4: Length ratio — catches padding and truncation
    if (source.length > 0) {
      const ratio = translated.length / source.length;
      if (ratio > thresholds.maxLengthRatio) {
        failures.push({
          key,
          reason: `length inflation (${ratio.toFixed(1)}x source, max ${thresholds.maxLengthRatio}x)`,
          value: translated.slice(0, 80) + (translated.length > 80 ? '...' : ''),
        });
        continue;
      }
      if (ratio < thresholds.minLengthRatio) {
        failures.push({
          key,
          reason: `suspiciously short (${(ratio * 100).toFixed(0)}% of source length)`,
          value: translated,
        });
        continue;
      }
    }

    // Check 5: Content preservation — catches a source hollowed of its
    // letters. Runs AFTER the length ratio because a merely truncated output
    // should report as truncation; what reaches here cleared that bar.
    const hollowed = checkContentPreservation(source, translated, thresholds.minContentRetention);
    if (hollowed) {
      failures.push({ key, reason: hollowed.reason, value: translated });
      continue;
    }

    // Check 6: Script compliance — non-Latin locales must have non-ASCII chars.
    // EXEMPTIONS:
    //   - Strings with no translatable text after stripping ICU placeholders
    //     ({...}), digits, punctuation, and whitespace. e.g. "{authorName} - {nPosts}"
    //     or version strings like "3.2.0" have nothing to write in another script.
    //   - Short ASCII strings (≤30 chars, >80% ASCII) are likely proper nouns
    //     or brand names (e.g. "GitHub", "npm") that stay in English everywhere.
    if (isNonLatin && thresholds.requireNonLatin) {
      // Strip ICU placeholders, digits, punctuation, whitespace → what's left?
      const translatableText = translated
        .replace(/\{[^}]*\}/g, '')   // ICU placeholders
        .replace(/[\d\s\p{P}\p{S}]/gu, '')  // digits, whitespace, punctuation, symbols
        .trim();
      const asciiRatio = source.replace(/[^\x20-\x7E]/g, '').length / Math.max(source.length, 1);
      const isShortAsciiPropNoun = source.length <= 30 && asciiRatio > 0.8;
      if (translatableText.length > 0 && isAsciiOnly(translated) && !isShortAsciiPropNoun) {
        failures.push({
          key,
          reason: `wrong script (ASCII-only for ${targetLocale}, expected non-Latin characters)`,
          value: translated.slice(0, 80),
        });
        continue;
      }
    }

    // All checks passed
    validated[key] = translated;
  }

  return { validated, failures };
}

/**
 * Split a value into independently-measurable segments: pipe-delimited
 * plural variants ("one doc|{count} docs") legitimately share most of
 * their text, which would inflate a whole-string repetition measure.
 *
 * @param {string} text
 * @returns {string[]} Trimmed segments (always at least one)
 */
function splitPluralSegments(text) {
  return (text.includes('|') ? text.split('|') : [text]).map(seg => seg.trim());
}

/**
 * Measure repetition rate using character n-gram frequency analysis.
 *
 * Splits the text into overlapping n-character grams and counts how
 * many are repeated. A hallucinated output like "Qo' Qo' Qo'" produces
 * a very high rate because the same grams appear over and over.
 *
 * The window size matters: at n=3 particle-heavy languages (Tagalog
 * kung/ng/mga) score high on normal text, while at n=8 only genuinely
 * looping output repeats — callers combine both signals.
 *
 * @param {string} text - Text to analyze
 * @param {number} [n=3] - Gram window size in characters
 * @returns {number} Repetition rate (0.0 = no repetition, 1.0 = all repeated)
 */
function measureRepetition(text, n = 3) {
  // Short texts can't meaningfully repeat — skip
  if (text.length < 12) return 0;

  const grams = {};
  let totalGrams = 0;

  for (let i = 0; i <= text.length - n; i++) {
    const gram = text.slice(i, i + n);
    grams[gram] = (grams[gram] || 0) + 1;
    totalGrams++;
  }

  if (totalGrams === 0) return 0;

  // Count how many grams appear more than once
  let repeatedCount = 0;
  for (const count of Object.values(grams)) {
    if (count > 1) {
      repeatedCount += count;
    }
  }

  return repeatedCount / totalGrams;
}

/**
 * Check if a string contains only ASCII characters (codes 0-127).
 * Used to detect wrong-script output for non-Latin locales.
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if text is ASCII-only
 */
function isAsciiOnly(text) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(text);
}

/**
 * Log quality gate failures in a structured, actionable format.
 *
 * @param {Array<{ key: string, reason: string, value: string }>} failures
 * @param {string} pairKey - e.g., "en:tlh"
 */
function logGateFailures(failures, pairKey) {
  if (failures.length === 0) return;

  console.error(`\n     [GATE] ${pairKey}: ${failures.length} key(s) failed quality validation:`);
  for (const { key, reason, value } of failures) {
    console.error(`            ✗ "${key}": ${reason}`);
    if (value) {
      console.error(`              → "${value}"`);
    }
  }
  console.error('');
}

export {
  validateTranslations,
  measureRepetition,
  isAsciiOnly,
  logGateFailures,
  checkContentPreservation,
  contentCharacters,
  isSubsequence,
  NON_LATIN_LOCALES,
  DEFAULT_THRESHOLDS,
  MIN_MEASURABLE_CONTENT,
};
