/**
 * resolve.js — the ONE way anything in this repo turns a code into a language.
 *
 * THE PROBLEM IT EXISTS FOR
 *   Every MT service publishes coverage in BCP 47 and every language card is
 *   keyed by ISO 639-3, and the two do not agree about what a language is.
 *   Google lists `zho`; nobody lists `cmn`. CLDR's rule is that Unicode
 *   identifiers always use the macrolanguage for the predominant form, so the
 *   services are conformant and we were the ones off-standard — bridging the
 *   gap with eight hand-written routings that cited nothing.
 *
 *   The bridge is now data: three pinned registries, projected into a tag
 *   index at build time. This module reads it and answers two questions.
 *
 * QUESTION ONE — WHAT LANGUAGE IS THIS CODE?
 *   `resolveTag()`. It never guesses. Where a tag denotes a macrolanguage it
 *   says so and reports what the registries say about a predominant member,
 *   attributed; where they do not agree, or where several members fold in, it
 *   reports that instead of picking. Norwegian has no cited predominant member
 *   and `no` → `nob` is therefore visibly an editorial decision rather than a
 *   fact hiding in a config file.
 *
 * QUESTION TWO — DOES THIS METHOD COVER THIS LANGUAGE?
 *   `resolveCoverage()`. Coverage is stored at the granularity the METHOD
 *   published and is never propagated down a macrolanguage. Instead the
 *   relationship is named:
 *
 *     exact              the method lists this language
 *     via-predominant    the method lists the macrolanguage, and both
 *                        registries name this language as the member it denotes
 *     via-macrolanguage  the method lists the macrolanguage, and this language
 *                        is merely one of its members
 *     none               nothing
 *
 *   The distinction is the whole point. OPUS-MT publishes coverage for `cre`,
 *   and both CLDR and SIL name Woods Cree as the member `cre` denotes — so
 *   Plains Cree gets `via-macrolanguage`, never `via-predominant`. That is a
 *   weaker answer than a boolean and it is the true one, and it is what a Cree
 *   speaker deciding whether to trust a translation actually needs to know.
 *
 * NOTHING HERE DECIDES WHAT TO DO ABOUT IT
 *   A verdict is evidence, not a policy. Whether `via-macrolanguage` is good
 *   enough to translate with is the caller's call, made under the caller's
 *   flags, and recorded on the run — so a leaderboard row reads "crk via cre"
 *   and can never silently become a `crk` score.
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseTag } from './bcp47.js';

/**
 * The index is BUILD OUTPUT of `champollion atlas build`. Overridable so tests
 * and the cutover can point at a freshly built one.
 */
export const TAG_INDEX_FILE =
  process.env.CHAMPOLLION_TAG_INDEX
  || path.join(import.meta.dirname, '..', '..', 'shared', 'tag-index.json');

/** Verdicts, exported so callers branch on constants rather than strings. */
export const ROUTE = Object.freeze({
  EXACT: 'exact',
  MACROLANGUAGE: 'macrolanguage',
  AMBIGUOUS: 'ambiguous',
  PRIVATE_USE: 'private-use',
  UNKNOWN: 'unknown',
  MALFORMED: 'malformed',
});

export const COVERAGE = Object.freeze({
  EXACT: 'exact',
  VIA_PREDOMINANT: 'via-predominant',
  VIA_MACROLANGUAGE: 'via-macrolanguage',
  NONE: 'none',
});

let cached = null;

/**
 * Load the tag index.
 *
 * Fails loudly and specifically when it is missing. A resolver that quietly
 * degraded to "code in, code out" would look like it worked for the 90% of
 * lookups where a code IS its own language, and be wrong on exactly the
 * macrolanguages this module exists for.
 *
 * @param {string} [file]
 */
export function loadTagIndex(file = TAG_INDEX_FILE) {
  if (cached && cached.file === file) return cached.index;
  if (!fs.existsSync(file)) {
    throw new Error(
      `no tag index at ${file}. It is build output — run:\n`
      + '    node cli/scripts/cldf/build-atlas.mjs\n'
      + 'Resolving codes without it would silently succeed for individual languages '
      + 'and silently mislead for every macrolanguage.',
    );
  }
  const index = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!index.byTag || !index.languages) {
    throw new Error(`${file} is not a tag index (no byTag/languages)`);
  }
  cached = { file, index };
  return index;
}

/** Drop the memoised index. For tests that rebuild it between cases. */
export function clearTagIndexCache() {
  cached = null;
}

/**
 * @typedef {object} Resolution
 * @property {string} input
 * @property {import('./bcp47.js').ParsedTag} tag
 * @property {string|null} language      the atlas language ID, if one was found
 * @property {string} route              one of ROUTE
 * @property {string|null} scope         'individual' | 'macrolanguage'
 * @property {object|null} predominant   {language, authorities[], agreement}
 * @property {string|null} note          why there is no clean answer, in words
 * @property {string[]} candidates       for an ambiguous tag, every reading
 */

/**
 * Resolve one code or language tag.
 *
 * @param {string} input
 * @param {object} [opts]
 * @param {object} [opts.index]
 * @returns {Resolution}
 */
export function resolveTag(input, { index = loadTagIndex() } = {}) {
  // FLORES, NLLB and Meta's Omnilingual MT all identify a language as
  // `lang_Script` — `arb_Arab`, `zho_Hans`, `crk_Cans`. That underscore is not
  // BCP 47, which uses a hyphen, and `parseTag` is right to reject it: the
  // parser answers "is this a well-formed language tag", and this is not one.
  //
  // But it is the dominant convention in machine translation, and rejecting it
  // outright made the resolver useless for exactly the datasets this project
  // reads. So the separator is normalised HERE, explicitly and reported, rather
  // than by loosening the grammar — a caller gets the answer and is told the
  // input was not a BCP 47 tag.
  const flores = typeof input === 'string' && !input.includes('-') && input.includes('_')
    ? input.replace(/_/g, '-')
    : null;
  const tag = parseTag(flores ?? input);
  const base = {
    input,
    tag,
    language: null,
    route: ROUTE.UNKNOWN,
    scope: null,
    predominant: null,
    note: flores
      ? `read as "${flores}" — the input uses the FLORES/NLLB lang_Script `
        + 'convention, which is not BCP 47'
      : null,
    candidates: [],
  };

  if (!tag.wellFormed) {
    return { ...base, route: ROUTE.MALFORMED, note: tag.problem };
  }
  // A private-use tag denotes no registered language, which is exactly what a
  // conlang code should say. Reporting it as unknown would invite a caller to
  // treat it as a lookup failure and retry.
  if (!tag.language && tag.privateUse.length) {
    return {
      ...base,
      route: ROUTE.PRIVATE_USE,
      note: `"${input}" is a private-use tag; it names no registered language`,
    };
  }
  if (!tag.language) {
    return {
      ...base,
      route: ROUTE.UNKNOWN,
      note: tag.grandfathered
        ? `"${input}" is a grandfathered tag with no primary language subtag`
        : 'no primary language subtag',
    };
  }

  const subtag = tag.language;
  const ambiguous = index.ambiguousTags?.[subtag];
  if (ambiguous && !ambiguous.resolvesTo) {
    return {
      ...base,
      route: ROUTE.AMBIGUOUS,
      note: ambiguous.reason,
      candidates: ambiguous.alsoClaimedBy.map((c) => ({
        language: c.language, sources: c.sources,
      })),
    };
  }

  const languageId = index.byTag[subtag] ?? null;
  if (!languageId) {
    return {
      ...base,
      route: ROUTE.UNKNOWN,
      note: `"${subtag}" is well-formed but is not a code the atlas resolves`,
    };
  }

  const entry = index.languages[languageId] ?? {};
  if (entry.scope !== 'macrolanguage') {
    return { ...base, language: languageId, route: ROUTE.EXACT, scope: 'individual' };
  }

  return {
    ...base,
    language: languageId,
    route: ROUTE.MACROLANGUAGE,
    scope: 'macrolanguage',
    predominant: entry.predominant ?? null,
    // Both facts can be true at once — `zho_Hans` is a FLORES-style tag AND a
    // macrolanguage. Overwriting the first with the second lost the reading
    // note on exactly the inputs that needed it most.
    note: [
      base.note,
      entry.predominant
        ? null
        : entry.noPredominant
          ?? `"${subtag}" is a macrolanguage and no registry names a member it denotes`,
    ].filter(Boolean).join('; ') || null,
  };
}

/**
 * How does a method's published coverage relate to this language?
 *
 * @param {object} args
 * @param {string} args.language        atlas language ID being asked about
 * @param {Iterable<string>} args.covered  the codes the METHOD published, verbatim
 * @param {object} [args.index]
 * @returns {{verdict: string, via: string|null, authorities: string[], because: string}}
 */
export function resolveCoverage({ language, covered, index = loadTagIndex() }) {
  const set = covered instanceof Set ? covered : new Set(covered);

  if (set.has(language)) {
    return {
      verdict: COVERAGE.EXACT,
      via: null,
      authorities: [],
      because: `the method lists "${language}" itself`,
    };
  }

  const entry = index.languages[language];
  const macro = entry?.macrolanguage ?? null;
  if (!macro || !set.has(macro)) {
    return {
      verdict: COVERAGE.NONE, via: null, authorities: [],
      because: macro
        ? `the method lists neither "${language}" nor its macrolanguage "${macro}"`
        : `the method does not list "${language}", which belongs to no macrolanguage`,
    };
  }

  const macroEntry = index.languages[macro] ?? {};
  const predominant = macroEntry.predominant ?? null;
  if (predominant && predominant.language === language) {
    return {
      verdict: COVERAGE.VIA_PREDOMINANT,
      via: macro,
      authorities: predominant.authorities ?? [],
      because: `the method lists the macrolanguage "${macro}", and `
        + `${(predominant.authorities ?? []).join(' and ')} name "${language}" as the `
        + 'member that tag denotes. The method still never said so itself.',
    };
  }

  return {
    verdict: COVERAGE.VIA_MACROLANGUAGE,
    via: macro,
    authorities: predominant ? predominant.authorities ?? [] : [],
    because: predominant
      ? `the method lists the macrolanguage "${macro}", but the registries name `
        + `"${predominant.language}" as the member that tag denotes, not "${language}"`
      : `the method lists the macrolanguage "${macro}", and no registry names which `
        + 'of its members that tag denotes',
  };
}

/**
 * A one-line, human-readable account of a resolution — for CLI output, prompts
 * and run records, so the same words appear everywhere a route is reported.
 *
 * @param {Resolution} r
 */
export function explainResolution(r) {
  switch (r.route) {
    case ROUTE.EXACT:
      return `${r.input} → ${r.language}`;
    case ROUTE.MACROLANGUAGE:
      return r.predominant
        ? `${r.input} → ${r.language} (a macrolanguage; ${r.predominant.authorities.join(' and ')} `
          + `name ${r.predominant.language} as the language it denotes)`
        : `${r.input} → ${r.language} (a macrolanguage; ${r.note})`;
    case ROUTE.AMBIGUOUS:
      return `${r.input} is ambiguous: ${r.candidates.map(
        (c) => `${c.language} per ${c.sources.join(', ')}`,
      ).join('; ')}`;
    case ROUTE.PRIVATE_USE:
      return `${r.input} is a private-use tag and names no registered language`;
    case ROUTE.MALFORMED:
      return `${r.input} is not a well-formed language tag: ${r.note}`;
    default:
      return `${r.input} does not resolve to a language the atlas knows`;
  }
}
