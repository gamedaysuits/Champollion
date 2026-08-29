/**
 * mergeGlossaryLocale — pure helpers for the localized-glossary pipeline.
 *
 * The glossary SSOT (cli/shared/explainers/glossary.json) is English.
 * The pipeline threads its display strings through the same champollion
 * sync path as every other Phase-1 UI file:
 *
 *   1. scripts/generate-glossary-i18n.mjs flattens the SSOT's display
 *      strings into i18n/en/glossary.json (Docusaurus {message,
 *      description} format). `champollion sync` discovers it like any
 *      Phase-1 JSON file and writes i18n/<locale>/glossary.json (TM'd,
 *      drift-enforced by scripts/champollion_sync_gate.sh).
 *   2. At build time generateExplainersJson.js merges each translated
 *      file back over the SSOT into data/explainers/glossary.<locale>.json
 *      for the runtime loader (explainerLoader.loadGlossary(locale)).
 *
 * TRANSLATED (display-only): term → termDisplay, plain, mt_relevance,
 * example. NEVER translated: term (canonical identity — /glossary anchors
 * and glossify keys stay English), also[] (detection vocabulary over
 * English card prose, shared with the card linter), citations[], related[]
 * (canonical term references).
 */

'use strict';

const GLOSSARY_KEY_PREFIX = 'glossary.';
const TRANSLATED_FIELDS = ['term', 'plain', 'mt_relevance', 'example'];

// Translator context, injected as the Docusaurus `description` so the LLM
// sees what each string is (threaded through extractDocusaurusDescriptions).
const FIELD_DESCRIPTIONS = {
  term: (term) =>
    `Glossary heading: the linguistic term "${term}". Use the standard equivalent a linguist ` +
    'would write in the target language; keep it short. Keep the English term when it IS the ' +
    'established usage in the target language.',
  plain: (term) =>
    `Plain-language definition of the linguistic term "${term}" (shown in glossary tooltips ` +
    'and on the /glossary page).',
  mt_relevance: (term) =>
    `One-sentence note on why "${term}" matters for machine-translation quality.`,
  example: (term) =>
    `Concrete example illustrating "${term}". Keep the linguistic material under discussion ` +
    '(quoted words, morphemes, endings — in English, Cree, or any other language) exactly ' +
    'as-is; translate only the surrounding prose.',
};

/**
 * Deterministic key slug for a term — internal to this pipeline (used only
 * to key the i18n/<locale>/glossary.json entries; NOT the public /glossary
 * anchor slug, which lives in src/utils/explainerLoader.js `termSlug`).
 */
function pipelineSlug(term) {
  return String(term)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '') // strip combining diacritics (post-NFKD)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Flat Docusaurus key for one field of one term. */
function glossaryEntryKey(slug, field) {
  return `${GLOSSARY_KEY_PREFIX}${slug}.${field}`;
}

/**
 * SSOT glossary → flat Docusaurus-format source object for i18n/en/glossary.json.
 * Throws on slug collisions (two terms may never share a pipeline key).
 *
 * @param {{terms: Array}} ssot — parsed cli/shared/explainers/glossary.json
 * @returns {object} { "glossary.<slug>.<field>": {message, description}, ... }
 */
function buildGlossarySource(ssot) {
  const out = {};
  const slugOwner = new Map();
  for (const entry of ssot?.terms || []) {
    const slug = pipelineSlug(entry.term);
    if (!slug) throw new Error(`glossary term "${entry.term}" produces an empty pipeline slug`);
    if (slugOwner.has(slug) && slugOwner.get(slug) !== entry.term) {
      throw new Error(
        `glossary pipeline slug collision: "${entry.term}" and "${slugOwner.get(slug)}" both slug to "${slug}"`
      );
    }
    slugOwner.set(slug, entry.term);
    for (const field of TRANSLATED_FIELDS) {
      const value = entry[field];
      if (typeof value !== 'string' || value.length === 0) continue;
      out[glossaryEntryKey(slug, field)] = {
        message: value,
        description: FIELD_DESCRIPTIONS[field](entry.term),
      };
    }
  }
  return out;
}

/**
 * Merge one locale's translated glossary strings back over the English SSOT.
 *
 * Per-field English fallback: a field keeps its SSOT value unless the
 * translated file has a non-empty string for it, so a partial translation
 * never blanks a definition. `term` stays canonical (anchors/matcher);
 * a differing translation lands in `termDisplay`.
 *
 * @param {{_meta?: object, terms: Array}} ssot — parsed English SSOT
 * @param {object|null} translatedRaw — parsed i18n/<locale>/glossary.json
 *        (Docusaurus {message} format; bare-string values tolerated)
 * @param {string} locale — the target locale code (stamped into _meta)
 * @returns {{_meta: object, terms: Array}} merged locale dataset
 */
function mergeGlossaryLocale(ssot, translatedRaw, locale) {
  const flat = {};
  for (const [key, value] of Object.entries(translatedRaw || {})) {
    if (value && typeof value === 'object' && 'message' in value) flat[key] = value.message;
    else if (typeof value === 'string') flat[key] = value;
  }

  const terms = (ssot?.terms || []).map((entry) => {
    const slug = pipelineSlug(entry.term);
    const translated = (field) => {
      const v = flat[glossaryEntryKey(slug, field)];
      return typeof v === 'string' && v.trim().length > 0 ? v : null;
    };

    const merged = { ...entry };
    const termT = translated('term');
    if (termT && termT !== entry.term) merged.termDisplay = termT;
    for (const field of ['plain', 'mt_relevance', 'example']) {
      const v = translated(field);
      if (v && typeof entry[field] === 'string') merged[field] = v;
    }
    return merged;
  });

  return {
    _meta: {
      ...(ssot?._meta || {}),
      locale,
      generated:
        `merged i18n/${locale}/glossary.json over the English SSOT by plugins/shared-data ` +
        '(mergeGlossaryLocale.js) — build artifact, do not edit',
    },
    terms,
  };
}

module.exports = {
  GLOSSARY_KEY_PREFIX,
  TRANSLATED_FIELDS,
  pipelineSlug,
  glossaryEntryKey,
  buildGlossarySource,
  mergeGlossaryLocale,
};
