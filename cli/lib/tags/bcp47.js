/**
 * bcp47.js — parse a language tag into its parts.
 *
 * WHY WE PARSE RATHER THAN SPLIT ON HYPHENS
 *   Because the parts are not positional. `zh-Hans-CN`, `zh-CN`, `zh-Hans` and
 *   `zh-x-pirate` all have a different second element, and the only way to know
 *   which is which is by SHAPE: four letters is a script, two letters or three
 *   digits is a region, `x-` opens private use. Code that assumes position gets
 *   `sr-Latn` right and `sr-RS` wrong, which is the kind of bug that surfaces
 *   as one language quietly rendering in the wrong script.
 *
 * WELL-FORMEDNESS, NOT VALIDITY
 *   RFC 5646 draws the distinction and so does this file. Well-formed means the
 *   tag has legal shape. Valid means every subtag is registered with IANA. This
 *   parser answers the first question only; the resolver answers the second by
 *   looking the subtags up in the atlas, which is where the registry lives.
 *
 *   Keeping them apart matters: a well-formed tag we cannot resolve is a
 *   language we may simply not index yet, and reporting it as malformed would
 *   blame the caller for our own coverage gap.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc5646#section-2.1
 */

/** RFC 5646 2.2.9 — the irregular grandfathered tags, which match no grammar. */
const IRREGULAR = new Set([
  'en-gb-oed', 'i-ami', 'i-bnn', 'i-default', 'i-enochian', 'i-hak',
  'i-klingon', 'i-lux', 'i-mingo', 'i-navajo', 'i-pwn', 'i-tao', 'i-tay',
  'i-tsu', 'sgn-be-fr', 'sgn-be-nl', 'sgn-ch-de',
]);

const ALPHA = /^[a-z]+$/;
const ALPHANUM = /^[a-z0-9]+$/;
const DIGIT = /^[0-9]+$/;

/**
 * @typedef {object} ParsedTag
 * @property {string} input        the tag as given
 * @property {boolean} wellFormed
 * @property {string|null} language   primary language subtag, lower-cased
 * @property {string[]} extlangs
 * @property {string|null} script     title-cased, as BCP 47 recommends
 * @property {string|null} region     upper-cased
 * @property {string[]} variants
 * @property {Record<string,string[]>} extensions  keyed by singleton
 * @property {string[]} privateUse    subtags after `x-`
 * @property {boolean} grandfathered
 * @property {string|null} problem    why it is not well-formed, in words
 */

/**
 * Parse a BCP 47 language tag.
 *
 * Never throws: a malformed tag is a fact about the input, and callers need to
 * report it rather than catch it.
 *
 * @param {string} input
 * @returns {ParsedTag}
 */
export function parseTag(input) {
  const base = {
    input,
    wellFormed: false,
    language: null,
    extlangs: [],
    script: null,
    region: null,
    variants: [],
    extensions: {},
    privateUse: [],
    grandfathered: false,
    problem: null,
  };

  if (typeof input !== 'string' || input === '') {
    return { ...base, problem: 'empty tag' };
  }
  // BCP 47 tags are case-insensitive; casing is presentational only.
  const lower = input.toLowerCase();
  if (lower.length > 255) {
    return { ...base, problem: 'tag longer than 255 characters' };
  }
  if (/[^a-z0-9-]/.test(lower)) {
    return { ...base, problem: 'contains characters other than letters, digits and hyphen' };
  }
  if (lower.startsWith('-') || lower.endsWith('-') || lower.includes('--')) {
    return { ...base, problem: 'empty subtag (leading, trailing or doubled hyphen)' };
  }

  if (IRREGULAR.has(lower)) {
    return { ...base, wellFormed: true, grandfathered: true, language: null };
  }

  const parts = lower.split('-');
  let i = 0;

  // ── Whole-tag private use: `x-pirate`. Legal, and denotes no registered
  //    language at all — which is exactly what a conlang code should say.
  if (parts[0] === 'x') {
    const sub = parts.slice(1);
    if (!sub.length || sub.some((p) => !ALPHANUM.test(p) || p.length > 8)) {
      return { ...base, problem: 'private-use tag needs 1-8 alphanumeric subtags after "x"' };
    }
    return { ...base, wellFormed: true, privateUse: sub };
  }

  // ── Primary language subtag ─────────────────────────────────────────────
  const lang = parts[i];
  if (!ALPHA.test(lang) || lang.length < 2 || lang.length > 8) {
    return { ...base, problem: `"${lang}" is not a language subtag (2-8 letters)` };
  }
  const out = { ...base, language: lang };
  i++;

  // ── Extended language subtags: up to three, three letters each ──────────
  // Only follow a 2-3 letter primary subtag, per the grammar.
  while (
    lang.length <= 3 && out.extlangs.length < 3
    && parts[i] && parts[i].length === 3 && ALPHA.test(parts[i])
  ) {
    out.extlangs.push(parts[i]);
    i++;
  }

  // ── Script: exactly four letters ────────────────────────────────────────
  if (parts[i] && parts[i].length === 4 && ALPHA.test(parts[i])) {
    out.script = parts[i][0].toUpperCase() + parts[i].slice(1);
    i++;
  }

  // ── Region: two letters or three digits ─────────────────────────────────
  if (parts[i]
    && ((parts[i].length === 2 && ALPHA.test(parts[i]))
      || (parts[i].length === 3 && DIGIT.test(parts[i])))) {
    out.region = parts[i].toUpperCase();
    i++;
  }

  // ── Variants: 5-8 alphanumerics, or a digit then three alphanumerics ────
  while (parts[i]
    && ((parts[i].length >= 5 && parts[i].length <= 8 && ALPHANUM.test(parts[i]))
      || (parts[i].length === 4 && DIGIT.test(parts[i][0]) && ALPHANUM.test(parts[i])))) {
    if (out.variants.includes(parts[i])) {
      return { ...out, problem: `variant "${parts[i]}" repeated` };
    }
    out.variants.push(parts[i]);
    i++;
  }

  // ── Extensions: a singleton (not x) then one or more 2-8 alphanumerics ──
  while (parts[i] && parts[i].length === 1 && parts[i] !== 'x' && ALPHANUM.test(parts[i])) {
    const singleton = parts[i];
    if (out.extensions[singleton]) {
      return { ...out, problem: `extension singleton "${singleton}" repeated` };
    }
    i++;
    const sub = [];
    while (parts[i] && parts[i].length >= 2 && parts[i].length <= 8 && ALPHANUM.test(parts[i])) {
      sub.push(parts[i]);
      i++;
    }
    if (!sub.length) {
      return { ...out, problem: `extension "${singleton}" has no subtags` };
    }
    out.extensions[singleton] = sub;
  }

  // ── Private use, as a suffix ────────────────────────────────────────────
  if (parts[i] === 'x') {
    i++;
    const sub = [];
    while (parts[i] && parts[i].length >= 1 && parts[i].length <= 8 && ALPHANUM.test(parts[i])) {
      sub.push(parts[i]);
      i++;
    }
    if (!sub.length) return { ...out, problem: 'private-use "x" has no subtags' };
    out.privateUse = sub;
  }

  if (i < parts.length) {
    return { ...out, problem: `"${parts[i]}" is not a valid subtag in this position` };
  }
  return { ...out, wellFormed: true };
}

/**
 * Re-assemble a parsed tag in BCP 47's recommended casing.
 *
 * @param {ParsedTag} t
 * @returns {string}
 */
export function formatTag(t) {
  if (t.grandfathered) return t.input.toLowerCase();
  if (!t.language && t.privateUse.length) return `x-${t.privateUse.join('-')}`;
  const parts = [t.language, ...t.extlangs];
  if (t.script) parts.push(t.script);
  if (t.region) parts.push(t.region);
  parts.push(...t.variants);
  for (const [singleton, sub] of Object.entries(t.extensions)) parts.push(singleton, ...sub);
  if (t.privateUse.length) parts.push('x', ...t.privateUse);
  return parts.join('-');
}
