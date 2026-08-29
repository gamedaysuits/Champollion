/**
 * sourceLinkBuilder.js
 *
 * Builds deep-link URLs to external linguistic databases from
 * ISO 639-3 codes and (optionally) Glottolog codes.
 *
 * This is a pure utility — no React, no side-effects.
 */

// ---------------------------------------------------------------------------
// URL Builders
// ---------------------------------------------------------------------------

/** Tatoeba's sentence search — also the entry point for contributing. */
const TATOEBA_SEARCH_BASE = 'https://tatoeba.org/en/sentences/search';

/**
 * URL templates for external linguistic databases.
 *
 * Each function receives `(isoCode, glottocode)` and returns a URL string,
 * or `null` when insufficient data exists to construct a meaningful link.
 *
 * @type {Record<string, (code: string, glottocode?: string) => string|null>}
 */
const SOURCE_URL_BUILDERS = {
  // ── Classification & Reference ──────────────────────────────────────────
  'grambank': (code, glottocode) =>
    glottocode ? `https://grambank.clld.org/languages/${glottocode}` : null,

  'grambank-1.0.3': (code, glottocode) =>
    glottocode ? `https://grambank.clld.org/languages/${glottocode}` : null,

  'wals': (code) =>
    `https://wals.info/languoid/lect/wals_code_${code}`,

  'glottolog': (code, glottocode) =>
    glottocode ? `https://glottolog.org/resource/languoid/id/${glottocode}` : null,

  'ethnologue': (code) =>
    `https://www.ethnologue.com/language/${code}`,

  // ── Corpora & Data ─────────────────────────────────────────────────────
  'common-voice': (code) =>
    `https://commonvoice.mozilla.org/en/datasets`,

  'opus': (code) =>
    `https://opus.nlpl.eu/results/en&${code}/corpus-result-table`,

  'tatoeba': (code) =>
    `${TATOEBA_SEARCH_BASE}?from=${code}`,

  'lexibank': (code, glottocode) =>
    glottocode ? `https://lexibank.clld.org/languages/${glottocode}` : null,

  'asjp': (code, glottocode) =>
    glottocode ? `https://asjp.clld.org/languages/${glottocode}` : null,

  'phoible': (code, glottocode) =>
    glottocode ? `https://phoible.org/languages/${glottocode}` : null,

  // ── Tools & Resources ──────────────────────────────────────────────────
  'olac': (code) =>
    `http://www.language-archives.org/language/${code}`,

  'ud-treebank': (code) =>
    `https://universaldependencies.org/treebanks/`,

  // We store the actual URL in data, so no template is needed
  'wikipedia': (code) => null,

  // No standard URL pattern exists for reference grammars
  'reference-grammar': () => null,

  // ── Additional Data Sources ─────────────────────────────────────────
  'numeralbank': () =>
    'https://github.com/numeralbank/channumerals',

  'autotyp': () =>
    'https://www.autotyp.uzh.ch/',

  'lapsyd': () =>
    'https://lapsyd.huma-num.fr/',

  'segbo': () =>
    'https://github.com/segbo-db/segbo',

  'nicholsdiversity': () => null,  // No public web interface

  'dplace-cldf': () =>
    'https://d-place.org/',

  'dplace-ea': () =>
    'https://d-place.org/',

  'glottolog-cldf': (code, glottocode) =>
    glottocode ? `https://glottolog.org/resource/languoid/id/${glottocode}` : null,

  // ── MT APIs ────────────────────────────────────────────────────────────
  'googleTranslate': () =>
    'https://cloud.google.com/translate/docs/languages',

  'deepl': () =>
    'https://developers.deepl.com/docs/resources/supported-languages',

  'microsoftTranslator': () =>
    'https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support',

  'libreTranslate': () =>
    'https://libretranslate.com/',

  'nllb': () =>
    'https://github.com/facebookresearch/fairseq/tree/nllb',

  // No single reference page for generic LLM translation
  'llm': () => null,

  // ── Language Archives ──────────────────────────────────────────────────
  'elar': (code) =>
    `https://www.elararchive.org/?s=${code}`,
};

// ---------------------------------------------------------------------------
// Source Normalization
// ---------------------------------------------------------------------------

/**
 * Maps raw source strings found in our data files to their canonical source
 * IDs used as keys in `SOURCE_URL_BUILDERS`.
 *
 * Why this exists: upstream data uses inconsistent identifiers —
 * versioned slugs ('grambank-1.0.3'), project-internal dataset names
 * ('Huntergatherer'), or stylised labels ('DatosetR').  This map provides
 * a single normalisation step so the rest of the codebase can work with
 * clean, stable IDs.
 *
 * @type {Record<string, string|null>}
 */
const RAW_SOURCE_ALIASES = {
  // Versioned Grambank releases all collapse to the same source
  'grambank-1.0.3': 'grambank',

  // ASJP wordlists are published under individual collection names
  'Huntergatherer': 'asjp',
  'Wheelehousecon': 'asjp',

  // Lexibank datasets likewise use project-specific labels
  'DatosetR': 'lexibank',

  // Kept as-is (explicit identity mapping for clarity)
  'reference-grammar': 'reference-grammar',

  // Internal-only identifiers that have no public-facing source page
  'UnicodePredicts': null,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the URL for a source's language-specific page.
 *
 * @param {string} sourceId   - The source identifier (e.g. 'grambank', 'opus').
 *                               This should already be normalised; if not,
 *                               call {@link normalizeSourceId} first.
 * @param {string} isoCode    - ISO 639-3 language code (e.g. 'crk').
 * @param {string} [glottocode] - Glottolog language code (e.g. 'plai1258').
 * @returns {string|null} A fully-qualified URL, or `null` when the source
 *                         has no URL template or the required parameters are
 *                         missing.
 */
export function getSourceUrl(sourceId, isoCode, glottocode) {
  const builder = SOURCE_URL_BUILDERS[sourceId];
  if (!builder) {
    return null;
  }
  return builder(isoCode, glottocode);
}

/**
 * Human-readable display names for each canonical source ID.
 *
 * Kept as a plain object rather than derived programmatically so we have
 * full control over capitalisation, acronyms, and branding.
 *
 * @type {Record<string, string>}
 */
const SOURCE_DISPLAY_NAMES = {
  'grambank':             'Grambank',
  'grambank-1.0.3':       'Grambank',
  'wals':                 'WALS',
  'glottolog':            'Glottolog',
  'ethnologue':           'Ethnologue',
  'common-voice':         'Common Voice',
  'opus':                 'OPUS',
  'tatoeba':              'Tatoeba',
  'lexibank':             'Lexibank',
  'asjp':                 'ASJP',
  'phoible':              'PHOIBLE',
  'olac':                 'OLAC',
  'ud-treebank':          'UD Treebank',
  'wikipedia':            'Wikipedia',
  'reference-grammar':    'Reference Grammar',
  'googleTranslate':      'Google Translate',
  'deepl':                'DeepL',
  'microsoftTranslator':  'Microsoft Translator',
  'libreTranslate':       'LibreTranslate',
  'nllb':                 'NLLB',
  'llm':                  'LLM',
  'numeralbank':          'Numeralbank',
  'autotyp':              'AUTOTYP',
  'lapsyd':               'LAPSyD (Sound Patterns)',
  'segbo':                'SegBo (Borrowed Segments)',
  'nicholsdiversity':     'Nichols Diversity',
  'dplace-cldf':          'D-PLACE (Cultural)',
  'dplace-ea':            'D-PLACE (Ethnographic Atlas)',
  'glottolog-cldf':       'Glottolog',
  'elar':                 'ELAR',
  'elcat':                'ELCat (Endangered Languages)',
  'phoible-2.0':          'PHOIBLE 2.0',
  'clics3':               'CLICS³ (Colexification)',
  'panlex':               'PanLex',
  'ids':                  'IDS (Intercont. Dictionary Series)',
  'iecor':                'IE-CoR (IE Cognate Relations)',
  'ielexfinal':           'IELex',
  'unimorph':             'UniMorph',
  'lsi':                  'LSI (Ling. Survey of India)',
  'mamtasouthasia':       'MAMTA (South Asia)',
  'moli-mandala':         'MOLI-Mandala',
  'tjukabodyobject':      'Tjuka Body-Object',
  'datsemshift':          'DatSemShift',
  'diacl':                'DIACL',
  'audersetinterrog':     'Auderset Interrogatives',
  'andersonannotatedphoible': 'Anderson PHOIBLE',
  'wacl':                 'WACL',
  'channumerals':         'Channumerals',
  // Additional real datasets that were leaking as raw slugs (audit 2026-07-20).
  'linguameta':           'LinguaMeta',
  'wikidata':             'Wikidata',
  'abvd':                 'ABVD (Austronesian Basic Vocab.)',
  'abvdoceanic':          'ABVD (Oceanic)',
  'abvdphilippines':      'ABVD (Philippines)',
  'acd':                  'ACD (Austronesian Comparative Dict.)',
  'kaikki-wiktextract':   'Wiktionary (Kaikki)',
  'universal-dependencies': 'Universal Dependencies',
  'northeuralex':         'NorthEuraLex',
  'ids-cldf':             'IDS (Intercont. Dictionary Series)',
  'sails':                'SAILS (South American)',
  'uratyp':               'UraTyp (Uralic)',
  'valpal':               'ValPaL (Valency Patterns)',
  'huggingface-datasets': 'Hugging Face Datasets',
  'opus-nlpl':            'OPUS',
  'opus-nlpl-api':        'OPUS',
  'grollemundbantu':      'Grollemund Bantu',
  'transnewguineaorg':    'TransNewGuinea.org',
  'polyglottaafricana':   'Polyglotta Africana',
  'huntergatherer':       'ASJP (Hunter-Gatherer)',
  'barlowhandandfive':    'Barlow Hand-and-Five',
  'nashcolorterms':       'Nash Colour Terms',
  'hayniecolorterms':     'Haynie Colour Terms',
  'johanssonsoundsymbolic': 'Johansson Sound-Symbolic',
  'bowernpny':            'Bowern Pama-Nyungan',
  'williamsonbenuecongo': 'Williamson Benue-Congo',
  'zgraggenmadang':       'Z’graggen Madang',
  'peirosst':             'Peiros',
  'diacl':                'DIACL',
  'magram':               'MaGram',
  'tls':                  'TLS (Tibeto-Burman)',
  'cldf':                 'CLDF',
  'firstvoices':          'FirstVoices',
  'champollion':          'Champollion',
  'glottolog-aes':        'Glottolog (AES)',
  'valpal':               'ValPaL (Valency Patterns)',
  'valpal-hartmann':      'ValPaL (Valency Patterns)',
  'omw':                  'Open Multilingual Wordnet',
  'datsemshift':          'DatSemShift',
  'datsemshift-zalizniak':'DatSemShift',
  'abvd-lexibank':        'ABVD (Austronesian Basic Vocab.)',
  'huntergatherer-lexibank': 'ASJP (Hunter-Gatherer)',
};

// Known multi-word acronyms/brands preserved when we have to title-case an
// otherwise-unmapped id (never a raw slug on screen).
const SOURCE_ACRONYMS = /^(wals|asjp|olac|nllb|llm|ids|lsi|ud|ie|cor|clics|api|mt|ai|abvd|acd|sails|tls|cldf|iso|url)$/i;

// Internal/Champollion-derived provenance tokens that must never read as an
// external source — they are Champollion's own work and collapse to one label.
const DERIVED_SOURCE_RE = /^(champollion|manual-curation|manual|cleanup|tc-features|derived|derived[:-]|derived-from)/i;

// Strip a trailing version/property suffix so 'linguameta-2024', 'wikidata-P282',
// 'northeuralex-0.9', 'grambank-1.0.3' resolve to their base id.
function stripSourceVersion(id) {
  return String(id).replace(/-(?:v?\d+(?:\.\d+)*|20\d\d|P\d+|batch-20\d\d|phase\d+)$/i, '').trim();
}

function titleCaseSource(id) {
  const parts = String(id).split(/[-_:.+ ]/).filter(Boolean);
  if (!parts.length) return String(id);
  return parts
    .map((w) => (SOURCE_ACRONYMS.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Get a human-readable display name for a source. NEVER leaks a raw slug or an
 * empty string: unmapped ids are stripped of version suffixes, collapsed if
 * they are internal/derived provenance, then title-cased as a last resort.
 * Returns null only for null/empty input (callers filter those out).
 *
 * @param {string} sourceId - A source identifier (canonical or raw).
 * @returns {string|null} Display-friendly name, or null for empty input.
 */
export function getSourceDisplayName(sourceId) {
  if (!sourceId || typeof sourceId !== 'string') return null;
  const id = sourceId.trim();
  if (!id) return null;
  if (SOURCE_DISPLAY_NAMES[id]) return SOURCE_DISPLAY_NAMES[id];
  if (DERIVED_SOURCE_RE.test(id)) return 'Champollion';
  const aliased = RAW_SOURCE_ALIASES[id];
  if (aliased && SOURCE_DISPLAY_NAMES[aliased]) return SOURCE_DISPLAY_NAMES[aliased];
  const base = stripSourceVersion(id);
  if (base !== id) {
    if (SOURCE_DISPLAY_NAMES[base]) return SOURCE_DISPLAY_NAMES[base];
    const baseAlias = RAW_SOURCE_ALIASES[base];
    if (baseAlias && SOURCE_DISPLAY_NAMES[baseAlias]) return SOURCE_DISPLAY_NAMES[baseAlias];
    if (DERIVED_SOURCE_RE.test(base)) return 'Champollion';
  }
  return titleCaseSource(base);
}

/**
 * Normalise a raw source string from our data into a canonical source ID.
 *
 * Our upstream data uses a variety of labels — versioned slugs, dataset
 * project names, internal tool identifiers — that need to be collapsed
 * into the stable keys used by {@link SOURCE_URL_BUILDERS}.
 *
 * Resolution order:
 *   1. Check `RAW_SOURCE_ALIASES` for an explicit mapping.
 *   2. Check if the raw string is already a valid key in `SOURCE_URL_BUILDERS`.
 *   3. Return `null` (unknown / unmappable source).
 *
 * @param {string} rawSource - The raw source string as it appears in data
 *                              (e.g. 'grambank-1.0.3', 'Huntergatherer').
 * @returns {string|null} The canonical source ID, or `null` if the source
 *                         is internal-only or unrecognised.
 */
export function normalizeSourceId(rawSource) {
  // Step 1: explicit alias (may intentionally resolve to null)
  if (rawSource in RAW_SOURCE_ALIASES) {
    return RAW_SOURCE_ALIASES[rawSource];
  }

  // Step 2: already a canonical key
  if (rawSource in SOURCE_URL_BUILDERS) {
    return rawSource;
  }

  // Step 3: unknown source
  return null;
}

// ---------------------------------------------------------------------------
// Tatoeba Contribution Links
// ---------------------------------------------------------------------------

/** Tatoeba's from/to search params take ISO 639-3 codes. */
const ISO_639_3 = /^[a-z]{3}$/;

/**
 * Build a Tatoeba sentence-search deep link for a language pair — the
 * "help build this corpus" contribution entry point (sentences added or
 * translated upstream flow into the next corpus build), e.g.
 * `https://tatoeba.org/en/sentences/search?from=eng&to=tuk`.
 *
 * Either side may be missing or a legacy non-ISO-639-3 value ("en",
 * "english"); invalid sides are omitted so the link degrades to a
 * one-sided or generic search instead of a broken one.
 *
 * @param {string} [sourceIso] - ISO 639-3 source language code (e.g. 'eng')
 * @param {string} [targetIso] - ISO 639-3 target language code (e.g. 'tuk')
 * @returns {string} A Tatoeba search URL (never null).
 */
export function getTatoebaPairUrl(sourceIso, targetIso) {
  const params = new URLSearchParams();
  const src = (sourceIso || '').trim().toLowerCase();
  const tgt = (targetIso || '').trim().toLowerCase();
  if (ISO_639_3.test(src)) params.set('from', src);
  if (ISO_639_3.test(tgt)) params.set('to', tgt);
  const query = params.toString();
  return query ? `${TATOEBA_SEARCH_BASE}?${query}` : TATOEBA_SEARCH_BASE;
}
