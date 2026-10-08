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
 *     4. Source echo check (translated value ≠ source value — and, for a
 *        source of 3+ words, not the source with only case, diacritics,
 *        spacing or invisible characters changed: see isDisguisedEcho)
 *     5. Content preservation (the output is not the source, hollowed out)
 *     6. ICU / placeholder structure (lib/icu-structure.js): argument names,
 *        plural/select keywords, selectors, # and printf conversions are
 *        code — only the text inside the branches may change; markup tags
 *        are code too (checkMarkup: same tags opened, closed, nested); and
 *        i18next {{…}} / single-brace / tag tokens by the rule verify reports
 *        them by (lib/placeholders.js placeholderChanges); and a sentence
 *        break the translation inserts right beside a placeholder where the
 *        source has none (placeholderSentenceBreaks)
 *
 *     7. Plural forms (lib/icu-structure.js pluralGaps): a plural message
 *        that passed everything else but has no branch for a category the
 *        target language uses for ordinary counts (Russian few/many) is a
 *        SOFT failure (`pluralGap`): the caller asks once more, naming the
 *        missing forms; a second answer without them is accepted
 *        (acceptPluralGaps) and reported — never a retry loop, and never a
 *        form made up by the tool.
 *
 *   Keys that fail any check are removed and logged as [GATE] failures.
 *   The caller receives only validated translations.
 *
 * CONFIGURATION:
 *   Per-language overrides can be set via the pair config:
 *     "languages": { "tlh": { "maxLengthRatio": 5, "requireNonLatin": true } }
 */

import { getAllLanguageCodes, getLanguageCard } from './registers.js';
import { output } from './output.js';
import { checkICUStructure, checkMarkup, pluralGaps, describeCategories, pluralBranchPairs, pluralBranchTexts } from './icu-structure.js';
import { placeholderChanges, placeholderSentenceBreaks, PLACEHOLDER_SYNTAX_NAMES } from './placeholders.js';

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

// ---------------------------------------------------------------------------
// Disguised echoes — the source handed back with accents sprinkled on
// ---------------------------------------------------------------------------

/**
 * Fewest words (whitespace-delimited, each carrying a letter) a source needs
 * before a FOLDED match counts as an echo. Below it, only exact equality does.
 *
 * WHY A FLOOR: in a Latin-script target a short legitimate translation can
 * differ from English only by accents — 'cafe' → 'café', 'Resume' → 'Résumé',
 * 'Cafe Menu' → 'Café Menu' — and refusing those would cost users a retry and
 * then the key. Three independent words that all survive translation
 * unchanged apart from accents and case is what a copy looks like.
 */
const MIN_FOLDED_ECHO_WORDS = 3;

/** Combining marks (Mn) and invisible format characters (Cf). */
const FOLD_STRIP = /[\p{Mn}\p{Cf}]/gu;

/**
 * The form two strings are compared in to decide "is this output the source?".
 *
 * Twin of the fold in arena/mt_eval_harness/text_compare.py (its steps 1–4,
 * `_fold` / token_compare_key, plus its whitespace collapse), so the CLI gate
 * sees through the same disguises the harness does:
 *   1. NFKD — precomposed letters split into base + combining mark, and
 *      compatibility forms (fullwidth letters, ligatures) fold to plain ones;
 *   2. case folding (JavaScript has no casefold(); upper-then-lower makes the
 *      same equality decisions for this purpose: 'ß' and 'ss' meet, and the
 *      Greek sigma forms meet — JS lands on the contextual 'ς' where Python
 *      lands on 'σ', but both sides of a comparison land together), then
 *      NFKD again because a case mapping can produce a decomposable
 *      character;
 *   3. drop combining marks (Mn: 'á' → 'a'; 'ŋ' is a letter and stays) and
 *      format characters (Cf: zero-width space/joiners, bidi marks, soft
 *      hyphen) — they change the bytes, not the text a reader sees;
 *   4. collapse whitespace runs and trim.
 * Punctuation is compared AS WRITTEN (the harness's per-token rule). Its
 * whole-string form also turns punctuation into spaces; this gate does not —
 * a gate that REFUSES output (and spends a retry) keeps the narrower fold, so
 * a copy that also edits its punctuation is not caught here, as before.
 *
 * @param {string} text
 * @returns {string}
 */
function foldForEchoCompare(text) {
  return String(text)
    .normalize('NFKD')
    .toUpperCase()
    .toLowerCase()
    .normalize('NFKD')
    .replace(FOLD_STRIP, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * How many words carrying a letter `text` has — after setting aside what is
 * code rather than words: ICU/brace placeholders ("{count}"), printf
 * conversions ("%s", "%1$d") and markup tags ("<b>", "</a>").
 *
 * @param {string} text
 * @returns {number}
 */
function letterWordCount(text) {
  return String(text)
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/%(\d+\$)?[-+ 0#]*\d*(\.\d+)?[a-zA-Z@]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .split(/\s+/u)
    .filter((w) => /\p{L}/u.test(w))
    .length;
}

/**
 * Is `translated` the source in disguise — identical once case, diacritics,
 * spacing and invisible format characters are folded away, without being
 * byte-identical? ('Thank you very much!' → 'Thánk yóú véry múch!')
 *
 * Only for a source of MIN_FOLDED_ECHO_WORDS+ words with letters; a shorter
 * source keeps exact equality as its only echo test, exactly as before.
 * An exact copy is NOT a disguised echo — it keeps its own rule (and the
 * short-name lane), so this predicate changes nothing for it.
 *
 * Why the short-name lane does not apply here: that lane exists because a
 * short value is often a NAME correctly kept as written ("GitHub", "Curtis
 * Forbes"). A disguised copy is by construction not kept as written — it was
 * altered without being translated — so it is refused like any long echo.
 *
 * Exported so an on-disk auditor that adopts it applies the same floor.
 *
 * @param {string} source
 * @param {string} translated
 * @returns {boolean}
 */
function isDisguisedEcho(source, translated) {
  if (typeof source !== 'string' || typeof translated !== 'string') return false;
  if (translated === source) return false;
  if (letterWordCount(source) < MIN_FOLDED_ECHO_WORDS) return false;
  return foldForEchoCompare(translated) === foldForEchoCompare(source);
}

/**
 * The first echo among a plural message's branches (validateTranslations
 * check 2c), as a failure record's fields, or null.
 *
 * @returns {{ reason: string, disguisedEcho?: true, nameOrLabel?: true }|null}
 */
function pluralBranchEcho(source, translated, { isNonLatin = false, requireNonLatin = true, acceptLatinNames = false, protectedTerms = [] } = {}) {
  const pairs = pluralBranchPairs(source, translated);
  if (pairs.length === 0) return null;
  const exact = [];
  const disguised = [];
  const nameLike = [];
  for (const p of pairs) {
    const src = p.source.trim();
    const tgt = p.translated.trim();
    if (!/\p{L}/u.test(src) || isProtectedTermValue(tgt, protectedTerms)) continue;
    if (tgt === src) {
      const asciiRatio = src.replace(/[^\x20-\x7E]/g, '').length / Math.max(src.length, 1);
      const isShortAscii = src.length <= 30 && asciiRatio > 0.8;
      if (!isShortAscii) exact.push(p.selector);
      else if (isNonLatin && requireNonLatin && !acceptLatinNames) nameLike.push(p.selector);
    } else if (isDisguisedEcho(src, tgt)) {
      disguised.push(p.selector);
    }
  }
  const forms = (sels) => [...new Set(sels)].map(x => `"${x}"`).join(', ');
  if (disguised.length > 0) {
    return { reason: `${DISGUISED_ECHO} — in the plural form(s) ${forms(disguised)}`, disguisedEcho: true };
  }
  if (exact.length > 0) {
    return { reason: `source echo (identical to English) in the plural form(s) ${forms(exact)}` };
  }
  if (nameLike.length > 0) {
    return { reason: `${LATIN_NAME_OR_LABEL} (plural form(s) ${forms(nameLike)})`, nameOrLabel: true };
  }
  return null;
}

/** Gate reason for a disguised echo. */
const DISGUISED_ECHO =
  'source echo (the source handed back with only case, accents, spacing or invisible characters changed — not a translation)';

// A deliberately repetitive source ("Every language, into every language.")
// licenses an equally repetitive translation: the effective caps are raised
// to the source's own measured repetition plus this margin.
const REPETITION_SOURCE_MARGIN = 0.10;

/** Gate reason for a short Latin-script value in a non-Latin target. */
const LATIN_NAME_OR_LABEL = 'kept in Latin script — a name, or a label left untranslated?';

/**
 * Is this value made ONLY of names the project declared (config.protectedTerms)?
 *
 * Strips every declared term, then ICU placeholders, digits, punctuation,
 * symbols and whitespace; nothing left means the value is a name (or names)
 * kept as written — correct in every script, never an "untranslated" error.
 * "Curtis Forbes", "Game Day Suits", "Curtis Forbes · Game Day Suits" all
 * qualify; "Curtis Forbes's portfolio" does not (the rest needs translating).
 *
 * @param {string} value
 * @param {string[]} [protectedTerms]
 * @returns {boolean}
 */
function isProtectedTermValue(value, protectedTerms = []) {
  if (typeof value !== 'string' || !protectedTerms || protectedTerms.length === 0) return false;
  let rest = value;
  let matched = false;
  // Longest first, so "Game Day Suits Ltd" is removed before "Game Day Suits".
  for (const term of [...protectedTerms].sort((a, b) => b.length - a.length)) {
    if (typeof term === 'string' && term && rest.includes(term)) {
      rest = rest.split(term).join(' ');
      matched = true;
    }
  }
  if (!matched) return false;
  return rest.replace(/\{[^}]*\}/g, '').replace(/[\d\s\p{P}\p{S}]/gu, '').length === 0;
}

/**
 * The gate's version. A refusal is remembered with the version that made it
 * (lib/content-refusals.js, lib/locale-state.js), and a hold made by an
 * earlier gate lifts by itself: what an over-strict gate refused is asked
 * again once the gate is fixed, instead of staying in the source language
 * until someone names it for a redo. Bump it whenever a check is loosened.
 *   2 — 2026-10-05: names with citations/anchors, reference entries, tables,
 *       short titles and source-shown fullwidth letters stopped being refused.
 *   3 — 2026-10-06: inline code is not prose (an ICU sample in backticks no
 *       longer makes a translated paragraph "ASCII-only"); a phrase said
 *       twice is not a loop; "keep it" twice is accepted give or take a stop.
 */
const GATE_VERSION = 3;

/**
 * Refusals that may be the model keeping text that is correct as written —
 * a name, title, citation, identifier or code: the source handed back, or
 * Latin script kept in a non-Latin target. Told why and asked again, a model
 * that gives the same answer twice is taken at its word (lib/fallback.js
 * retryRefusedBlocks), as the key-value lane takes a name it is asked about
 * twice (LATIN_NAME_OR_LABEL). Every other refusal (repetition, length,
 * hollowing, damaged markup, fullwidth disguise) is never accepted this way.
 *
 * @param {string|null} reason
 * @returns {boolean}
 */
function isKeepAsWrittenFault(reason) {
  if (typeof reason !== 'string') return false;
  return reason.startsWith('source echo')
    || reason === LATIN_NAME_OR_LABEL
    || reason.startsWith('wrong script (ASCII-only');
}

/**
 * How much longer than its source a value may be before the length ratio
 * counts. The ratio is meaningless on a tiny source: "FAQ" → "Preguntas
 * frecuentes" is 6.7x and correct (dogfood 2026-10-05, a docs page title),
 * while "Feast" → a whole sentence still grows by far more than this.
 */
const SHORT_SOURCE_LENGTH_SLACK = 20;

/**
 * The part of a string that would need translating, for the "short name kept
 * as written" rule: inline code, quoted strings, parentheticals and Markdown
 * block markers removed. "### METEOR (Banerjee & Lavie, 2005)" is the name
 * METEOR, and "## Hugo (TOML / YAML / Markdown)" the name Hugo — both were
 * refused as source echo on the whole string's length (dogfood 2026-10-05).
 *
 * @param {string} text
 * @returns {string}
 */
function nameCore(text) {
  return String(text)
    .replace(/^[ \t]*(?:#{1,6}[ \t]+|[-*+][ \t]+|\d{1,9}[.)][ \t]+)/, '')
    .replace(/\{#[^}\s]+\}\s*$/, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/"[^"]*"|“[^”]*”|「[^」]*」/g, ' ')
    .replace(/\([^()]*\)|（[^（）]*）/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A reference-list entry — numbered, with a year or a link, and a quoted or
 * italic title: "4. Snover, M., … (2006). \"A Study of …\" *Proceedings …*".
 * Cited works are kept as published, so the same text back is correct, not
 * an echo (dogfood 2026-10-05: twelve references of the scoring spec were
 * refused and published with the fallback prefix).
 *
 * @param {string} text
 * @returns {boolean}
 */
function isBibliographicEntry(text) {
  const t = String(text).trim();
  // A reference list in one block: every entry must be one.
  if (t.includes('\n')) {
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.length > 1 && lines.every(l => !l.includes('\n') && isBibliographicEntry(l));
  }
  return /^(?:\[?[A-Z]?\d{1,3}[a-z]?\]?[.)]?|[-*+])\s+\S/.test(t)
    && (/\(\d{4}[a-z]?\)/.test(t) || /\]\(https?:\/\//.test(t))
    && (/"[^"]{8,}"|“[^”]{8,}”/.test(t) || /\*[^*]{8,}\*/.test(t));
}

/**
 * A Markdown table measured as its cells' text: delimiter rows dropped and
 * pipes turned to spaces. The delimiter row ("|---|---|") is repetition by
 * construction, so a table whose model output padded it differently was
 * refused as a repetition hallucination (dogfood 2026-10-05, four tables).
 * Anything that is not a table comes back unchanged.
 *
 * @param {string} text
 * @returns {string}
 */
function tableProse(text) {
  const lines = String(text).split('\n');
  if (!lines.some((l) => /^\s*\|/.test(l))) return text;
  return lines
    .filter((l) => !/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{0,}:?\s*$/.test(l))
    .map((l) => (/^\s*\|/.test(l) ? l.replace(/\|/g, ' ').replace(/[ \t]+/g, ' ').trim() : l))
    .join('\n');
}

/**
 * Why the quality gate refuses one Markdown block or front-matter field, or
 * null when it passes — the key-value gate's own checks (empty, source echo,
 * disguised echo, repetition, length inflation and truncation, hollowing,
 * script), so a short heading turned into a sentence is refused in a
 * newsletter exactly as it is for an app key (Round 7, school persona: "##
 * Feast" became a full sentence and was accepted, while the same output for
 * the key Nav.home was refused at 9.5x). Structure (code, links, markup) is
 * checked by the lanes through their protected placeholders; a short
 * Latin-script value kept as written is a name, as on the key-value lane's
 * second ask (there is no per-block retry to ask once first).
 *
 * @param {string} source - The block or field's source text (placeholders restored)
 * @param {string} value - The translation
 * @param {object} [pairConfig] - The pair (target locale, thresholds, protectedTerms)
 * @returns {string|null}
 */
function contentGateFault(source, value, pairConfig = {}) {
  if (typeof source !== 'string' || typeof value !== 'string') return null;
  if (value === source && isBibliographicEntry(source)) return null;
  source = tableProse(source);
  value = tableProse(value);
  const { failures } = validateTranslations({ block: value }, { block: source }, pairConfig || {},
    { prose: true, acceptLatinNames: true, acceptPluralGaps: true });
  return failures.length > 0 ? failures[0].reason : null;
}

/**
 * Does `translated` show the shape of a degeneration loop, beyond a high
 * repeated-n-gram rate? A phrase a language says twice where English
 * elides it is not a loop: "From most to least trustworthy:" is correctly
 * "Từ đáng tin cậy nhất đến ít đáng tin cậy nhất:" in Vietnamese, and was
 * refused as a repetition hallucination (dogfood 2026-10-06). A loop does
 * one of three things: repeats some span three times or more, repeats a whole
 * line, or hands the source back verbatim beside a translation of it (the
 * doubled Arabic headings, "### METEOR (…)\n### METEOR (…)").
 *
 * @param {string} translated
 * @param {string} source
 * @returns {boolean}
 */
function hasLoopEvidence(translated, source) {
  const t = String(translated);
  const grams = new Map();
  for (let i = 0; i + REPETITION_LONG_N <= t.length; i++) {
    const g = t.slice(i, i + REPETITION_LONG_N);
    const n = (grams.get(g) || 0) + 1;
    if (n >= 3 && g.trim().length >= 4) return true;
    grams.set(g, n);
  }
  // A word said three times or more ("Qo' Qo' Qo' Qo'" — too short for an
  // 8-character span to recur three times).
  const words = new Map();
  for (const w of t.toLowerCase().split(/\s+/u).filter(x => /\p{L}/u.test(x))) {
    const n = (words.get(w) || 0) + 1;
    if (n >= 3) return true;
    words.set(w, n);
  }
  const lines = t.split('\n').map(l => l.trim()).filter(l => l.length >= 8);
  if (new Set(lines).size < lines.length) return true;
  const src = String(source).trim();
  return src.length >= 8 && t.trim() !== src && t.includes(src);
}

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
  // config.protectedTerms rides the pair config (lib/pairs.js).
  const protectedTerms = options.protectedTerms ?? pairConfig.protectedTerms ?? [];
  // Second pass of the name-or-label retry: a short Latin-script value the
  // model returned twice is accepted as a name.
  const acceptLatinNames = options.acceptLatinNames === true;
  // Second pass of the plural-forms retry: accepted, and reported by the caller.
  const acceptPluralGaps = options.acceptPluralGaps === true;
  // A Markdown block or front-matter field (contentGateFault): its structure
  // (code, links, markup) rides protected placeholders, checked by the lane;
  // the ICU/markup/plural checks are for key-value messages.
  const prose = options.prose === true;

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

    // Names the project declared (config.protectedTerms) are correct as
    // written in every language — no echo or script check applies.
    if (isProtectedTermValue(translated, protectedTerms)) {
      validated[key] = translated;
      continue;
    }

    // Check 2: Source echo — translated value is identical to source.
    // Short mostly-ASCII strings (≤30 chars) are often names ("GitHub",
    // "Curtis Forbes") that legitimately stay as written — but just as often
    // descriptive labels the model failed to translate ("Translation CLI").
    //   - Latin-script targets: accepted (an English label in French reads
    //     as a missed translation, not a broken page; verify warns).
    //   - Non-Latin targets: rejected ONCE with a name-or-label hint (the
    //     caller's feedback retry). If the model returns the same text again
    //     it is taken at its word as a name (acceptLatinNames) and cached, so
    //     it is never re-billed. One bounded retry — never a retry loop.
    if (translated === source) {
      const core = nameCore(source);
      const asciiRatio = core.replace(/[^\x20-\x7E]/g, '').length / Math.max(core.length, 1);
      // Nothing left once code, quotes and parentheticals go: nothing to translate.
      const isShortAscii = core.length === 0 || (core.length <= 30 && asciiRatio > 0.8);
      if (!isShortAscii) {
        failures.push({ key, reason: 'source echo (identical to English)', value: translated });
        continue;
      }
      if (isNonLatin && thresholds.requireNonLatin && !acceptLatinNames) {
        failures.push({ key, reason: LATIN_NAME_OR_LABEL, value: translated, nameOrLabel: true });
        continue;
      }
    } else if (isDisguisedEcho(source, translated)) {
      // Check 2a: the same echo, disguised — 'Thank you very much!' →
      // 'Thánk yóú véry múch!'. Byte comparison calls it different, and the
      // script check cannot fire (Latin in, Latin out; and in a non-Latin
      // target the accents make it not-ASCII). Same suppressions as the
      // exact check: declared names were accepted above, no-translate keys
      // never reach the gate, letter-free and short (< 3-word) sources keep
      // exact equality. Refused like a long echo — the caller's feedback
      // retry, then the fallback method — never accepted as a name, because
      // a name kept as written is byte-identical (isDisguisedEcho).
      failures.push({ key, reason: DISGUISED_ECHO, value: translated, disguisedEcho: true });
      continue;
    }

    // Check 2b: ICU MessageFormat / placeholder structure. Argument names,
    // plural/select keywords, selectors, # and printf conversions are code:
    // "{cóúnt, plúrál, óné {…} óthér {…}}" breaks the app (next-intl throws,
    // Flutter gen-l10n refuses to build) while reading as a fine French
    // string. Only the text inside the branches may change; a plural may
    // ADD the CLDR categories the target language uses. Runs before the
    // statistical checks so the retry hears the precise reason.
    if (translated !== source && !prose) {
      const icu = checkICUStructure(source, translated, targetLocale);
      if (icu) {
        failures.push({ key, reason: icu.reason, value: translated, icu: true });
        continue;
      }
      // Markup is code as well: every tag opened, closed and nested as in the
      // source ("<strong>Book</strong>" → "<strong>Réserver" breaks the page).
      const markup = checkMarkup(source, translated);
      if (markup) {
        failures.push({ key, reason: markup.reason, value: translated, markup: true });
        continue;
      }
      // The other placeholders verify reports — i18next {{…}} (renamed, lost,
      // or written as a single-brace {name}, which i18next prints as is), a
      // single-brace {name} outside an ICU message, a tag token — by the one
      // rule verify reports them by (lib/placeholders.js). The gate let
      // {{name}} → {{nom}} through, verify flagged it after the sync, and the
      // run exited 2; refused here, the pair's fallback gets the text instead
      // (Round 12, i18next persona).
      const tokens = placeholderChanges(source, translated);
      if (tokens.length > 0) {
        failures.push({
          key,
          reason: `placeholder structure damaged: ${tokens.map(t => `${PLACEHOLDER_SYNTAX_NAMES[t.syntax]} ${t.issue}`).join('; ')}`,
          value: translated,
          placeholder: true,
        });
        continue;
      }
      // A sentence break the translation put right beside a placeholder
      // where the source has none: "Take this medicine at {time}." →
      // "… sina. {time}." passed every check (Round 14, hospital persona).
      // The same rule verify flags by (lib/placeholders.js); refused here,
      // the retry hears why and the pair's fallback runs.
      const breaks = placeholderSentenceBreaks(source, translated);
      if (breaks.length > 0) {
        failures.push({
          key,
          reason: `sentence break beside a placeholder: ${breaks.map(b => b.issue).join('; ')}`,
          value: translated,
          placeholder: true,
        });
        continue;
      }
    }

    // Check 2c: the echo checks, per plural/select branch. A plural message
    // differs from its source as a WHOLE as soon as the target adds a form
    // (or one branch is translated), so the two checks above never saw a
    // branch handed back as the English — accented, or as it was (Round 4,
    // Django persona: the plural entry passed while the identical singular
    // change was refused). Each branch is held to the singular rules: an
    // exact copy of a short Latin-script branch is accepted in a Latin-script
    // target (a name, "emails") and asked about once in a non-Latin one; any
    // longer copy is refused; a disguised copy (3+ words) is refused. A
    // branch made only of declared names (protectedTerms) is never an echo.
    if (translated !== source && !prose) {
      const branchEcho = pluralBranchEcho(source, translated, { isNonLatin, requireNonLatin: thresholds.requireNonLatin, acceptLatinNames, protectedTerms });
      if (branchEcho) {
        failures.push({ key, value: translated, ...branchEcho });
        continue;
      }
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
    if (degenerateSegment && hasLoopEvidence(translated, source)) {
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
      if (ratio > thresholds.maxLengthRatio && translated.length - source.length > SHORT_SOURCE_LENGTH_SLACK) {
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
    // Fullwidth Latin letters ("Ｂｏｏｋ ａｎ ａｐｐｏｉｎｔｍｅｎｔ") outside CJK typography:
    // English in disguise, whatever the target's script. Never a name — a
    // name kept as written is in plain letters.
    if (hasForeignFullwidthLatin(translated, targetLocale) && !hasForeignFullwidthLatin(source, targetLocale)) {
      failures.push({
        key,
        reason: `wrong script (fullwidth Latin letters in a ${targetLocale} value — English in disguise, not a translation)`,
        value: translated.slice(0, 80),
      });
      continue;
    }
    if (isNonLatin && thresholds.requireNonLatin) {
      // Strip ICU placeholders, digits, punctuation, whitespace → what's left?
      const translatableText = translated
        .replace(/\{[^}]*\}/g, '')   // ICU placeholders
        .replace(/[\d\s\p{P}\p{S}]/gu, '')  // digits, whitespace, punctuation, symbols
        .trim();
      const core = nameCore(source);
      const asciiRatio = core.replace(/[^\x20-\x7E]/g, '').length / Math.max(core.length, 1);
      const isShortAscii = core.length === 0 || (core.length <= 30 && asciiRatio > 0.8);
      // Letters classified by Unicode script: accented Latin is Latin too
      // (an ASCII test passed "Thánk yóú" in a Russian catalog).
      if (translatableText.length > 0 && isLatinOnly(translated, targetLocale)) {
        if (isShortAscii && acceptLatinNames) {
          // Second answer still Latin-script: the model says it is a name.
        } else if (isShortAscii) {
          failures.push({ key, reason: LATIN_NAME_OR_LABEL, value: translated.slice(0, 80), nameOrLabel: true });
          continue;
        } else {
          failures.push({
            key,
            reason: `wrong script (ASCII-only for ${targetLocale}, expected non-Latin characters)`,
            value: translated.slice(0, 80),
          });
          continue;
        }
      }
    }

    // Check 7 (last, so a soft failure means everything else passed): a
    // plural message without a form the target language uses for ordinary
    // counts. Soft — the caller asks once more; see the module header.
    if (!acceptPluralGaps && !prose && translated !== source) {
      // A gettext catalog's slots (pairConfig.pluralSlots, set by sync for a
      // .po file): a form it has no msgstr[] for is never asked again for.
      const gaps = pluralGaps(source, translated, targetLocale, options.pluralSlots ?? pairConfig.pluralSlots ?? null)
        .filter(g => g.everyday.length > 0);
      if (gaps.length > 0) {
        const missing = [...new Set(gaps.flatMap(g => g.everyday))];
        const type = gaps[0].type;
        failures.push({
          key,
          reason: `plural form(s) ${missing.map(c => `"${c}"`).join(', ')} missing — ${targetLocale} uses `
            + `${describeCategories(targetLocale, missing, type)}`,
          value: translated,
          pluralGap: { missing, type },
        });
        continue;
      }
    }

    // All checks passed
    validated[key] = translated;
  }

  return { validated, failures };
}

// ---------------------------------------------------------------------------
// Different inputs, same output
// ---------------------------------------------------------------------------

/** Distinct source strings one output may answer before it is suspect. */
const SHARED_OUTPUT_MIN_SOURCES = 3;
/** Words (with letters) the shared output needs, on its own, to be suspect. */
const SHARED_OUTPUT_MIN_WORDS = 4;

/**
 * Simple placeholders and markup tags in an output — not words of the
 * translation (SharedOutputIndex.outputForm): {name} {0} {{count}} %(name)s
 * %s %1$d <b> </a>. A plural/select argument ({n, plural, …}) has a comma and
 * is not matched.
 */
const PLACEHOLDER_IN_OUTPUT = /\{\{\s*[\w.$-]+\s*\}\}|\{\s*[\w.$-]+\s*\}|%\([\w.]+\)[sdifr]|%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[sdifuxXeEgGcp@]|<\/?[A-Za-z][^<>]*>/gu;
/** The same without single-brace arguments: for a whole plural/select message. */
const PLACEHOLDER_NOT_BRACED = /\{\{\s*[\w.$-]+\s*\}\}|%\([\w.]+\)[sdifr]|%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[sdifuxXeEgGcp@]|<\/?[A-Za-z][^<>]*>/gu;
/** A plural/select/selectordinal argument ("{n, plural, …"). */
const ICU_COMPLEX_ARGUMENT = /\{\s*[\w.$-]+\s*,\s*(?:plural|select|selectordinal)\s*,/u;

/**
 * The sentences of a text, for the repeat check: split after . ! ? (and the
 * CJK 。！？) followed by space, each kept only when it has a letter once
 * its placeholders are gone ("S. {name}!" is one sentence).
 *
 * @param {string} text
 * @returns {string[]}
 */
function sentencesOf(text) {
  return String(text)
    .split(/(?<=[.!?\u3002\uFF01\uFF1F])\s+/u)
    .map(t => t.trim())
    .filter(t => /\p{L}/u.test(t.replace(PLACEHOLDER_IN_OUTPUT, ' ')));
}

/** A source in the form two sources are compared in ("Save", "save!" meet). */
function sourceIdentity(text) {
  return foldForEchoCompare(String(text).replace(/[\p{P}\p{S}]+/gu, ' '));
}

/** The words of a folded string, as a set. */
function wordSet(text) {
  return new Set(sourceIdentity(text).split(' ').filter(w => /\p{L}/u.test(w)));
}

/** True when every pair of sources shares under half its words (Jaccard). */
function clearlyDifferent(sources) {
  const sets = sources.map(wordSet);
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i];
      const b = sets[j];
      const inter = [...a].filter(w => b.has(w)).length;
      const union = new Set([...a, ...b]).size;
      if (union === 0 || inter / union >= 0.5) return false;
    }
  }
  return true;
}

/**
 * Different inputs, same output: ONE translation text returned for several
 * DIFFERENT source strings is what a model that memorized a training sentence
 * does (Round 4 school persona: a trained eng→crk model answered the app
 * title, "Contact the school", the newsletter title and its heading with the
 * same sentence — and every per-key check passed it).
 *
 * Suspect when one output answers SHARED_OUTPUT_MIN_SOURCES+ distinct sources
 * (compared folded, punctuation aside — "Save" and "Save!" are one source)
 * AND either the output has SHARED_OUTPUT_MIN_WORDS+ words, or every source
 * has two or more words and no two of them share half their words. So
 * synonyms collapsing to one short translation pass ('OK'/'Okay'/'Sure' →
 * "D'accord"; 'Close'/'Dismiss'/'Cancel' → "Fermer"), and so does the same
 * source text under several keys.
 *
 * TWO sources are already enough when the evidence is strong (Round 6,
 * school persona: 'Thank you, {name}!' and 'Please bring the forms.' got one
 * memorized sentence and passed, because only a third source counted): the
 * output has SHARED_OUTPUT_MIN_WORDS+ words, both sources have two or more
 * words, and they share under half their words (clearly different). Short
 * outputs and synonym-like sources (sharing half their words or more) still
 * need a third source. The cost of a false alarm is one more ask (an LLM is
 * told to translate this string on its own; a method that takes no
 * instructions is asked once more), then the pair's fallback.
 *
 * MEMORIZED outputs (markMemorized): an output an earlier sync found
 * answering different source strings is suspect from its first source on —
 * a repair that asks again and gets the same sentence back must not write it
 * (Round 6, school persona: `--force-content` re-served it in silence).
 *
 * Same suppressions as the echo checks: a value made only of declared names
 * (protectedTerms) is never suspect, nor a value equal to its own source
 * (an echo — its own rule), nor one without letters. No-translate keys never
 * reach a gate.
 *
 * The index spans a run's locale: the caller adds what it accepted, so a
 * later batch (or a content file's block) that repeats an earlier answer is
 * caught; only the NEW items are returned as suspect — what was written
 * earlier is reported by `verify`. An output found suspect earlier in the
 * run is suspect from its first new source on, like a MEMORIZED one: its
 * refused members were never added, and the run remembers it only when it
 * ends.
 */
class SharedOutputIndex {
  constructor({ protectedTerms = [] } = {}) {
    this.protectedTerms = protectedTerms;
    // output form → Map(source identity → { key, source })
    this.byOutput = new Map();
    // output form → the first text seen in that form (what reports show)
    this.display = new Map();
    // output text → { value, sources, keys } — every group found suspect,
    // with ALL its members (earlier, accepted ones too), for the run report.
    this.flagged = new Map();
    // output form → the text as first seen: outputs an earlier sync found
    // answering different source strings (markMemorized).
    this.memorized = new Map();
  }

  /**
   * Outputs an earlier run found answering several different source strings:
   * suspect from their first source on (see the class comment).
   *
   * @param {Iterable<string>} values
   */
  markMemorized(values) {
    for (const value of values || []) {
      if (typeof value !== 'string') continue;
      const form = SharedOutputIndex.outputForm(value);
      if (form && /\p{L}/u.test(form)) this.memorized.set(form, String(value).replace(/\s+/gu, ' ').trim());
    }
  }

  /**
   * The form outputs are grouped by: case, punctuation and symbols aside, and
   * without a Markdown block marker — so "S?", "S." and a heading "# S" are
   * one output (Round 5: an NMT model copies the source's end punctuation,
   * and a newsletter H1 kept its "# "). Letters and their accents are kept:
   * two words that differ by a diacritic are two words.
   *
   * Placeholders and markup tags are not words of the output: "S. {name}!"
   * and "S." are one output (Round 9, school persona: the memorized sentence
   * came back as "S. {name}!" for 'Thank you, {name}!' and as "S." inside a
   * newsletter paragraph, and the "name" left over from "{name}" kept the two
   * apart). Simple arguments only ({name}, {0}, {{count}}, %(name)s, %s,
   * %1$d, <b>…</b>); an unsplit plural/select message keeps its branches.
   */
  static outputForm(value) {
    const text = String(value);
    // Inside a whole plural/select message, `{un}` is a branch, not an argument.
    const placeholders = ICU_COMPLEX_ARGUMENT.test(text) ? PLACEHOLDER_NOT_BRACED : PLACEHOLDER_IN_OUTPUT;
    return text
      .normalize('NFC')
      .replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/u, '')
      .replace(placeholders, ' ')
      .toLowerCase()
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  /**
   * The items, plus — for a value of several sentences whose source has as
   * many — each sentence on its own, paired with its source sentence (the
   * parent kept in `whole`). One memorized sentence inside a paragraph is
   * then the same output as that sentence answering a UI string (Round 9,
   * school persona: 'Please bring the forms.' in the newsletter and 'Thank
   * you, {name}!' got one sentence, and the whole-paragraph comparison never
   * met it). Pairing by position keeps a sentence two paragraphs genuinely
   * share ("Please bring the forms." in both) as ONE source — not suspect;
   * a value whose sentence count differs from its source's is compared whole
   * only.
   *
   * @param {Array<{ key: string, source: string, value: string }>} items
   * @returns {Array<{ key: string, source: string, value: string, whole?: { source: string, value: string } }>}
   */
  static withSentences(items) {
    const out = [];
    for (const it of items) {
      out.push(it);
      if (typeof it.source !== 'string' || typeof it.value !== 'string' || it.whole) continue;
      const vs = sentencesOf(it.value);
      if (vs.length < 2) continue;
      const ss = sentencesOf(it.source);
      if (ss.length !== vs.length) continue;
      vs.forEach((v, i) => out.push({ key: it.key, source: ss[i], value: v, whole: { source: it.source, value: it.value } }));
    }
    return out;
  }

  eligible(source, value) {
    if (typeof source !== 'string' || typeof value !== 'string') return false;
    if (value === source || !/\p{L}/u.test(value) || !SharedOutputIndex.outputForm(value)) return false;
    if (isProtectedTermValue(value, this.protectedTerms)) return false;
    return true;
  }

  /**
   * Items that would make (or join) a suspect group.
   *
   * @param {Array<{ key: string, source: string, value: string }>} items
   * @returns {Map<string, { value: string, sources: string[] }>} key → its group
   */
  suspects(items) {
    const groups = new Map();
    for (const it of SharedOutputIndex.withSentences(items)) {
      if (!this.eligible(it.source, it.value)) continue;
      const form = SharedOutputIndex.outputForm(it.value);
      if (!this.display.has(form)) this.display.set(form, String(it.value).replace(/\s+/gu, ' ').trim());
      if (!groups.has(form)) {
        groups.set(form, { sources: new Map(this.byOutput.get(form) || []), fresh: [] });
      }
      const g = groups.get(form);
      const id = sourceIdentity(it.source);
      if (!g.sources.has(id)) g.sources.set(id, { key: it.key, source: it.source });
      g.fresh.push(it);
    }
    const out = new Map();
    for (const [form, g] of groups) {
      let sources = [...g.sources.values()].map(s => s.source);
      const byRule = SharedOutputIndex.suspectGroup(form, sources);
      // `memorized` marks a group suspect ONLY because an earlier sync
      // remembered its output (reports word it that way); a group the rule
      // catches on its own is reported as before.
      const memorized = !byRule && this.memorized.has(form);
      // An output this index already found answering different source
      // strings EARLIER IN THIS RUN is suspect from its first new source on,
      // as a remembered one is from an earlier sync. The members refused
      // then were never added (only accepted items are), so without this the
      // same sentence came back for the newsletter's title after the app's
      // three keys were refused for it, and was written — the run remembers
      // it only when it ends, and `verify` flagged it (Round 10, school
      // persona). A gate retry that returns the refused sentence for one key
      // is refused the same way.
      const earlier = !byRule && !memorized ? this.flagged.get(form) : null;
      if (earlier) sources = [...new Set([...earlier.sources, ...sources])];
      if (!byRule && !memorized && !earlier) continue;
      const shown = this.memorized.get(form) || this.display.get(form) || form;
      for (const it of g.fresh) out.set(it.key, { value: shown, sources, ...(memorized && { memorized: true }) });
      const prior = this.flagged.get(form) || { value: shown, sources: [], keys: [] };
      this.flagged.set(form, {
        value: shown,
        sources: [...new Set([...prior.sources, ...sources])],
        keys: [...new Set([...prior.keys, ...[...g.sources.values()].map(v => v.key), ...g.fresh.map(it => it.key)])],
        ...(memorized && { memorized: true }),
      });
    }
    return out;
  }

  /**
   * Is one output form answering these distinct sources the pattern? Three or
   * more: a long output, or clearly different multi-word sources. Two: only
   * the strong case (see the class comment).
   *
   * @param {string} form - outputForm() of the shared output
   * @param {string[]} sources - Distinct sources it answers
   * @returns {boolean}
   */
  static suspectGroup(form, sources) {
    const outWords = letterWordCount(form);
    if (sources.length >= SHARED_OUTPUT_MIN_SOURCES) {
      return outWords >= SHARED_OUTPUT_MIN_WORDS
        || (sources.every(src => letterWordCount(src) >= 2) && clearlyDifferent(sources));
    }
    if (sources.length !== 2) return false;
    return outWords >= SHARED_OUTPUT_MIN_WORDS
      && sources.every(src => letterWordCount(src) >= 2)
      && clearlyDifferent(sources);
  }

  /**
   * Record accepted items (what was written) for later batches. A sentence
   * of a longer value is recorded with its parent (`whole`): what was written,
   * and cached, is the whole value.
   */
  add(items) {
    for (const it of SharedOutputIndex.withSentences(items)) {
      if (!this.eligible(it.source, it.value)) continue;
      const form = SharedOutputIndex.outputForm(it.value);
      if (!this.display.has(form)) this.display.set(form, String(it.value).replace(/\s+/gu, ' ').trim());
      if (!this.byOutput.has(form)) this.byOutput.set(form, new Map());
      const id = sourceIdentity(it.source);
      if (!this.byOutput.get(form).has(id)) {
        this.byOutput.get(form).set(id, { key: it.key, source: it.source, value: it.value, ...(it.whole && { whole: it.whole }) });
      }
    }
  }
}

/**
 * What one translated value puts in the shared-output index: the value
 * itself, or — for an ICU plural/select message — each leaf branch on its
 * own (Round 5, school persona: one memorized sentence filled BOTH branches
 * of a plural message and two other keys, and nothing counted the branches).
 *
 * Every branch of one `plural`/`selectordinal` argument counts as ONE source
 * (the message's): a language without number inflection writes the same
 * text in every branch by design, so repeating it across branches is never
 * evidence on its own. `select` branches count as their own source branches —
 * different only when those differ.
 *
 * @param {string} key
 * @param {string} source
 * @param {string} value
 * @returns {Array<{ key: string, source: string, value: string }>}
 */
function sharedOutputItems(key, source, value) {
  if (typeof source !== 'string' || typeof value !== 'string') return [];
  const pairs = value.includes('{') && source.includes('{') ? pluralBranchPairs(source, value) : [];
  if (pairs.length === 0) return [{ key, source, value }];
  return pairs.map(p => ({
    key,
    source: p.keyword === 'select' ? p.source : source,
    value: p.translated,
  }));
}

/** Gate reason for an output shared by several different sources. */
function sharedOutputReason(group) {
  if (group.memorized) {
    const text = group.value.length > 60 ? `${group.value.slice(0, 57)}...` : group.value;
    return `the sentence the model gave for other, different source strings on an earlier sync (${JSON.stringify(text)}) `
      + '— a memorized sentence, not a translation of this string; asking the same model again returns it again';
  }
  const shown = group.sources.slice(0, 4).map(s => JSON.stringify(s.length > 40 ? `${s.slice(0, 37)}...` : s)).join(', ');
  return `same output for ${group.sources.length} different source strings (${shown}${group.sources.length > 4 ? ', …' : ''}) `
    + '— a model repeating one memorized sentence, not a translation of this string';
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
  // ICU plural/select branches too: a Russian plural repeats one sentence in
  // four forms by design, and measured as one string it read as a loop.
  const branches = text.includes('{') ? pluralBranchTexts(text) : null;
  if (branches) return branches.map(seg => seg.trim());
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

/** Scripts whose text legitimately uses fullwidth Latin letters (CJK typography). */
const FULLWIDTH_SCRIPTS = new Set(['Hani', 'Hans', 'Hant', 'Jpan', 'Kore', 'Hira', 'Kana', 'Hang', 'Bopo']);

/** Fullwidth Latin letters: Ａ–Ｚ, ａ–ｚ. */
const FULLWIDTH_LATIN = /[Ａ-Ｚａ-ｚ]/u;

/**
 * The text of a value with its code set aside: ICU/brace placeholders,
 * printf conversions, markup tags. (A URL stays: in a non-Latin locale a
 * URL value is a wrong-script answer unless the key is declared
 * no-translate — which never reaches this check.)
 */
/** `text` with every balanced {…} group removed (nested groups included). */
function withoutBraceGroups(text) {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') { depth++; continue; }
    if (ch === '}' && depth > 0) { depth--; continue; }
    if (depth === 0) out += ch;
  }
  return out;
}

function proseOf(text) {
  // Inline code is never prose: a Markdown paragraph quoting an ICU message
  // in backticks (`{n, plural, one {One file} other {…}}`) was read as that
  // message, its English branches were taken for the whole value, and 470
  // characters of correct Japanese were refused as "ASCII-only" — twice, in
  // five languages (dogfood 2026-10-06, docs/getting-started/configuration.md).
  const str = String(text).replace(/(`+)[^`]*?\1/g, ' ');
  // A plural/select message: its prose is the text of its branches (the
  // keywords and selectors — "plural", "one", "other" — are code) PLUS the
  // text around it ("You have {count, plural, …}" — "You have" is prose).
  const branches = str.includes('{') ? pluralBranchTexts(str) : null;
  return (branches ? `${branches.join(' ')} ${withoutBraceGroups(str)}` : str)
    // Simple placeholders only: {name}, {count, number}. Branch text such as
    // "{Один файл}" is prose, never stripped.
    .replace(/\{\s*[\w.$-]+\s*(?:,[^{}]*)?\}/g, ' ')
    .replace(/\{\{\s*[\w.$-]+\s*\}\}/g, ' ')
    .replace(/%(\([^)]*\))?[-#0 +]*\d*(\.\d+)?[a-zA-Z@]/g, ' ')
    .replace(/<\/?[A-Za-z0-9][^<>]*>/g, ' ');
}

/**
 * Are ALL the letters of a value's prose Latin script — by Unicode script,
 * not by byte? Fullwidth Latin ("Ｈｅｌｌｏ") and accented Latin ("Thánk")
 * are Latin: an ASCII test let both through as "not English" in a Russian
 * catalog (Round 4, Django persona). False when the prose has no letters.
 *
 * @param {string} text
 * @returns {boolean}
 */
function isLatinOnly(text, locale = null) {
  const prose = proseOf(text);
  const letters = prose.match(/\p{L}/gu);
  if (!letters) return false;
  // CJK typography sets Latin in fullwidth forms ("ＯＫ" in Japanese): there,
  // fullwidth letters are the target's own usage, as they always were here.
  if (locale && FULLWIDTH_LATIN.test(prose) && usesFullwidthLatin(locale)) return false;
  return letters.every(ch => /\p{Script=Latin}/u.test(ch));
}

/** Does this locale's script set Latin in fullwidth forms (CJK)? */
function usesFullwidthLatin(locale) {
  const card = getLanguageCard(String(locale)) || getLanguageCard(String(locale).split(/[-_]/)[0]);
  return FULLWIDTH_SCRIPTS.has(card?.script);
}

/**
 * Fullwidth Latin letters in a value whose language does not set Latin in
 * fullwidth forms (anything but CJK typography): a disguised copy of English,
 * never a translation.
 *
 * @param {string} text
 * @param {string} locale - Target locale
 * @returns {boolean}
 */
function hasForeignFullwidthLatin(text, locale) {
  if (!FULLWIDTH_LATIN.test(proseOf(text))) return false;
  return !usesFullwidthLatin(locale);
}

// ---------------------------------------------------------------------------
// A question or exclamation that lost its mark
// ---------------------------------------------------------------------------

// Marks that end a question / an exclamation in some writing system: Latin
// and most scripts (?), CJK fullwidth (？), Arabic script (؟), Greek (U+037E
// and the ASCII semicolon Greek text is typed with), Armenian (՞), Ethiopic
// (፧), and the interrobang family. Spanish closes with "?" / "!" as well.
const QUESTION_ENDS = new Set(['?', '？', '؟', '\u037e', ';', '՞', '፧', '⸮', '⁇', '⁈', '‽', '⁉']);
const EXCLAMATION_ENDS = new Set(['!', '！', '‼', '⁉', '⁈', '‽', '՜', '¡']);
// Closing quotes, brackets, ICU braces and direction marks after the mark.
const TRAILING_CLOSERS = /[\s"'»”’)\]}›〉》」』】〕\u200e\u200f]+$/u;

/** The last visible character of a text, closers aside. */
function terminalChar(text) {
  const chars = Array.from(String(text).replace(TRAILING_CLOSERS, ''));
  return chars.length > 0 ? chars[chars.length - 1] : '';
}

/**
 * A source that ends with "?" or "!" whose translation ends with neither it
 * nor an equivalent the target's script uses (Round 6, hospital persona:
 * "Where does it hurt?" passed as a statement). A WARNING, never a refusal:
 * some languages mark a question with a word or particle instead of a mark,
 * and a translation that does so is right.
 *
 * @param {string} source
 * @param {string} translated
 * @returns {{ mark: '?'|'!' } | null}
 */
function droppedTerminalMark(source, translated) {
  if (typeof source !== 'string' || typeof translated !== 'string' || translated === source) return null;
  if (!/\p{L}/u.test(translated)) return null;
  const end = terminalChar(source);
  if (end !== '?' && end !== '!') return null;
  const got = terminalChar(translated);
  if (end === '?' ? QUESTION_ENDS.has(got) : EXCLAMATION_ENDS.has(got)) return null;
  return { mark: end };
}

/**
 * Keys whose translation dropped the source's closing "?" / "!" — one
 * finding for sync and verify alike. Declared names and no-translate keys
 * are skipped by the callers' own rules.
 *
 * @param {Array<[string, string, string]>} entries - [key, source, translated]
 * @returns {Array<{ key: string, mark: string, value: string }>}
 */
function droppedTerminalMarks(entries) {
  const out = [];
  for (const [key, source, value] of entries) {
    const d = droppedTerminalMark(source, value);
    if (d) out.push({ key, mark: d.mark, value });
  }
  return out;
}

/** The warning text for droppedTerminalMarks findings (sync and verify say the same). */
function describeDroppedMarks(found, fix) {
  const marks = [...new Set(found.map(f => `"${f.mark}"`))].join(' or ');
  const shown = found.slice(0, 3).map(f => `${f.key} (${JSON.stringify(f.value.length > 40 ? `${f.value.slice(0, 37)}...` : f.value)})`).join(', ');
  return `${found.length} translation(s) dropped the source's closing ${marks}: ${shown}${found.length > 3 ? ', …' : ''} — `
    + 'a question or exclamation may now read as a statement. Some languages mark a question with a word or '
    + 'particle instead of a mark, so this is a warning, not a refusal: check them'
    + (fix ? `, or ask again (--fresh: the cache holds this answer): \`${fix}\`` : '') + '.';
}

/**
 * Log quality gate failures in a structured, actionable format.
 *
 * @param {Array<{ key: string, reason: string, value: string }>} failures
 * @param {string} pairKey - e.g., "en:tlh"
 */
function logGateFailures(failures, pairKey) {
  if (failures.length === 0) return;
  if (output.getMode() === 'json') {
    // One structured record instead of indented prose on stderr.
    output.warn(`${pairKey}: ${failures.length} key(s) failed quality validation`, {
      pairKey, gateFailures: failures.map(({ key, reason, value }) => ({ key, reason, value })),
    });
    return;
  }

  const lines = ['', `     [GATE] ${pairKey}: ${failures.length} key(s) failed quality validation:`];
  for (const { key, reason, value } of failures) {
    lines.push(`            ✗ "${key}": ${reason}`);
    if (value) lines.push(`              → "${value}"`);
  }
  lines.push('');
  output.block(lines);
}

export {
  checkICUStructure,
  validateTranslations,
  contentGateFault,
  measureRepetition,
  isAsciiOnly,
  isLatinOnly,
  hasForeignFullwidthLatin,
  logGateFailures,
  checkContentPreservation,
  contentCharacters,
  isSubsequence,
  NON_LATIN_LOCALES,
  DEFAULT_THRESHOLDS,
  MIN_MEASURABLE_CONTENT,
  isProtectedTermValue,
  LATIN_NAME_OR_LABEL,
  foldForEchoCompare,
  letterWordCount,
  nameCore,
  GATE_VERSION,
  isKeepAsWrittenFault,
  hasLoopEvidence,
  isBibliographicEntry,
  tableProse,
  SHORT_SOURCE_LENGTH_SLACK,
  isDisguisedEcho,
  pluralBranchEcho,
  MIN_FOLDED_ECHO_WORDS,
  DISGUISED_ECHO,
  SharedOutputIndex,
  sharedOutputItems,
  sharedOutputReason,
  SHARED_OUTPUT_MIN_SOURCES,
  droppedTerminalMark,
  droppedTerminalMarks,
  describeDroppedMarks,
  SHARED_OUTPUT_MIN_WORDS,
};
