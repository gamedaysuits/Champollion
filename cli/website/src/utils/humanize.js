/**
 * humanize.js — shared human-readability primitives for the Atlas.
 *
 * Two consumers:
 *   1. Search (languages.js) — `fold()` normalizes a query/name for
 *      tolerant substring matching.
 *   2. The detail panel (DetailPanel.js) — the normalization layer that
 *      sits IN FRONT of the existing decoders (walsValueDecoder,
 *      elcatDecoder, explainerLoader …) so a raw enum like "FALSE" or a
 *      blank "N/A" never leaks to the screen verbatim.
 *
 * This module owns ONLY normalization + a few small label maps. The real
 * code→label decoding stays in the components that already import the
 * decoder utilities, so there is no circular dependency and no duplicated
 * feature knowledge here.
 */

/** The single empty-value glyph used everywhere a value is absent. */
export const EMPTY = '—';

/**
 * fold(s) — normalize a name or query for tolerant substring search.
 *
 * Diacritics stripped, lowercased, apostrophes/glottal marks removed, all
 * other punctuation collapsed to a single space, whitespace trimmed. This is
 * strictly EQUALITY-PRESERVING: it unifies spelling noise ("Ye'kwana" ≈
 * "yekwana", "Iñupiaq" ≈ "inupiaq", "Mag-antsi" ≈ "mag antsi") without any
 * lossy vowel folding. Deliberately NO e↔y fold — that would conflate
 * unrelated names (Ede/Edo/Ewe) across ~7,900 rows. "Aeta finds Ambala Ayta"
 * is solved by alias DATA, not by mangling the index.
 */
export function fold(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics
    .toLowerCase()
    .replace(/['’ʼ`]/g, '') // apostrophes / glottal marks → nothing
    .replace(/[^a-z0-9]+/g, ' ') // any other punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

// Tokens that mean "no value" — rendered as EMPTY, never shown raw.
const EMPTY_TOKENS = /^(n\/?a|n\.a\.|na|none|null|nil|undefined|unknown|-|—)$/i;
// Unambiguous WORD booleans only. Bare "1"/"0"/"y"/"n" are intentionally
// EXCLUDED — they collide with WALS/Grambank category codes and must reach
// the decoder chain instead of being coerced to a checkmark.
const TRUE_WORDS = /^(true|yes)$/i;
const FALSE_WORDS = /^(false|no)$/i;

const YES = '✓ yes';
const NO = '✗ no';

/** Is this value absent/empty (null, blank, or an "N/A"-class token)? */
export function isEmptyValue(raw) {
  if (raw == null) return true;
  const s = String(raw).trim();
  return s === '' || EMPTY_TOKENS.test(s);
}

/**
 * boolLabel(raw, valueType) — "✓ yes" / "✗ no" for genuinely boolean values,
 * else null (so the caller falls through to its decoder chain).
 *
 * Fires for: real booleans; a feature explicitly typed `boolean` carrying
 * true/false/yes/no/1/0; and the case-insensitive words true/false/yes/no
 * (which fixes the old bug where uppercase "FALSE" rendered verbatim).
 */
export function boolLabel(raw, valueType) {
  if (raw === true) return YES;
  if (raw === false) return NO;
  const s = String(raw).trim();
  if (valueType === 'boolean') {
    if (/^(1|true|yes)$/i.test(s)) return YES;
    if (/^(0|false|no)$/i.test(s)) return NO;
  }
  if (TRUE_WORDS.test(s)) return YES;
  if (FALSE_WORDS.test(s)) return NO;
  return null;
}

/** Capitalize the first letter of a short enum token ("decimal" → "Decimal"). */
export function titleCase(s) {
  const str = String(s ?? '').trim();
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

/**
 * formatCoord(lat, lng) — "14.82°N, 120.28°E" with hemisphere letters.
 * Returns null when either coordinate is missing/non-numeric.
 */
export function formatCoord(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (lat == null || lng == null || Number.isNaN(la) || Number.isNaN(lo)) return null;
  return `${Math.abs(la).toFixed(2)}°${la >= 0 ? 'N' : 'S'}, ${Math.abs(lo).toFixed(2)}°${lo >= 0 ? 'E' : 'W'}`;
}

// Data-confidence tags → prose (detail-panel inventory #15).
const CONFIDENCE_LABELS = {
  verified: 'Verified',
  'cross-validated': 'Cross-validated',
  'api-derived': 'API-derived',
  unverified: 'Unverified',
};
export function getConfidenceLabel(c) {
  if (!c) return null;
  const key = String(c).toLowerCase();
  return CONFIDENCE_LABELS[key] || titleCase(String(c).replace(/[-_]/g, ' '));
}

/**
 * countingLabel(numeralSystem) — collapse the 5-field numeralSystem object
 * into one human fact: "Decimal (base 10)". `base` is null for the
 * `restricted` type, so we omit the parenthetical there. Returns null when
 * the card has no documented numeral system (~48% of cards) so the caller
 * simply omits the fact.
 */
export function countingLabel(numeralSystem) {
  const ns = numeralSystem;
  if (!ns || !ns.baseType) return null;
  const type = titleCase(ns.baseType);
  return ns.base != null ? `${type} (base ${ns.base})` : type;
}

/**
 * Format an integer with thousands separators (12345 → "12,345"). Non-finite
 * or non-numeric input passes through unchanged so callers can use it blindly.
 */
export function fmtInt(n) {
  const num = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(num) ? num.toLocaleString('en-US') : (n ?? '');
}

/**
 * Family name for display, or null when the value is an "unknown"-class
 * placeholder that should be suppressed rather than shown. The SSOT so the
 * grid tile, detail panel, and hero map all agree (they had drifted, one
 * leaking "Unknown" where the others suppressed it).
 */
export function humanizeFamily(family) {
  if (!family || typeof family !== 'string') return null;
  const f = family.trim();
  if (!f || /^(unknown|unclassified|unattested|n\/?a|none|null|undefined)$/i.test(f)) return null;
  return f;
}
