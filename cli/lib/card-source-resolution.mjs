/**
 * card-source-resolution.mjs — the ONE definition of how a card's
 * `_fieldSources` / `dataSources[]` stamp resolves to a license-register key.
 *
 * WHY THIS IS A SHARED MODULE
 *   This logic used to live only inside cli/scripts/lint-language-cards.mjs,
 *   unexported. So the license audit (cli/scripts/audit-license-gate.mjs) could
 *   not use it, and swept only `facts.source` in the (since-retired) legacy
 *   champollion.db facts table — 268 sources.
 *   Cards cite 801 distinct stamps, and PHOIBLE has NO facts row at all (it
 *   flows straight from phoible-raw.csv into cards), so the sole tone authority
 *   on 5,219 card stamps was outside the license sweep entirely.
 *
 *   Any second copy of this vocabulary would drift — the alias map alone
 *   encodes 30 hand-justified renames. One definition, several consumers.
 *
 * Consumers: lint-language-cards.mjs (license-source-resolves rule),
 *            audit-license-gate.mjs --cards.
 *
 * @see docs/LICENSING.md
 * @see shared/licenses.json
 */

import fs from 'node:fs';

/**
 * Build the resolution index from a license register file.
 * Returns null if absent, or { sourceKeys, baseIndex, spdxSet }.
 */
export function buildRegisterIndex(filePath) {
  if (!fs.existsSync(filePath)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
  const sources = data.sources || {};
  const sourceKeys = new Set(Object.keys(sources));

  // Base-name index: register keys with version tokens stripped, so
  // "glottolog-5.3" (card) matches "glottolog-5.0" (register) via "glottolog".
  const baseIndex = new Map();
  for (const key of sourceKeys) {
    const base = stripVersionTokens(key);
    if (!baseIndex.has(base)) baseIndex.set(base, key);
  }

  const spdxSet = new Set();
  for (const v of Object.values(sources)) {
    if (v && typeof v.license_spdx === 'string' && v.license_spdx.trim()) {
      spdxSet.add(v.license_spdx.trim());
    }
  }
  return { sourceKeys, baseIndex, spdxSet, sources };
}

/**
 * Every distinct source stamp a card asserts, from BOTH conventions:
 *   - `_fieldSources` (rich cards), whose values may be a string, an array,
 *     or an object of per-subfield stamps; and
 *   - `dataSources[]` plus inline `<field>.source` keys, which is how the 751
 *     Glottolog-only stubs stamp — they carry no `_fieldSources` map at all.
 *
 * A sweep reading only `_fieldSources` silently skips those 751 cards.
 */
export function cardSourceStamps(card) {
  const out = new Set();
  const add = (v) => {
    if (typeof v === 'string' && v.trim()) out.add(v.trim());
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === 'object') Object.values(v).forEach(add);
  };

  add(card._fieldSources);
  add(card.dataSources);

  // Inline `<field>.source`, ONLY on top-level object-valued fields.
  //
  // Deliberately not arrays. `evalDatasets[].source`, `resources.fsts[].source`
  // and `orthographies[].source` all carry a `source` key meaning something
  // else entirely — a publisher name, an FST repo URL, a script name like
  // "Latin". Harvesting those produced 620+ phantom "unlicensed sources" that
  // were never license claims at all. The stub convention this exists for is
  // `coordinates.source` / `vitality.source` on the 751 Glottolog-only cards,
  // which are plain objects.
  for (const [key, value] of Object.entries(card)) {
    if (key.startsWith('_') || !value || typeof value !== 'object') continue;
    if (Array.isArray(value)) continue;
    if (PROSE_SOURCE_FIELDS.has(key)) continue;
    if (typeof value.source === 'string') add(value.source);
  }
  return out;
}

/**
 * Top-level fields whose `.source` is a BIBLIOGRAPHIC CITATION, not a dataset
 * id — so it can never resolve against the license register and must not be
 * reported as an unlicensed source.
 *
 * `culturalAphorism.source` (77 cards) reads e.g. "Traditional Turkish proverb
 * (atasözü). Documented in Aksoy, Ö.A. (1988)…" — an attribution to oral
 * literature with scholarly documentation. That is the card citing its work
 * properly, which is the house rule, not a licensing gap.
 *
 * Kept as a named list rather than a prose-detecting heuristic: a heuristic
 * would eventually swallow a REAL stamp and silently shrink the sweep, which is
 * the failure this audit exists to prevent.
 */
export const PROSE_SOURCE_FIELDS = new Set(['culturalAphorism']);

/**
 * Strip version/date tokens from a source id.
 * Handles every versioning style observed in card data:
 *   glottolog-5.3, wals-2024, asjp-v20, grambank-1.0.3, common-voice-20.0,
 *   glottolog-5.x-cldf (mid-string), wikidata-P282 (property suffix),
 *   unimorph-4.0, northeuralex-0.9, cldr-48
 */
export function stripVersionTokens(id) {
  return id
    // version token anywhere: -5.3, -2024, -v20, -1.0.3, -5.x, -P282
    .replace(/-(?:v?\d+(?:[._]\d+)*[a-z]?|\d+\.x|P\d+)(?=-|$)/g, '')
    // trailing parenthetical citation: "cldr-endonym (matched via fa)"
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

/**
 * Source ids that denote INTERNAL derivation/curation steps rather than
 * external datasets. These resolve to the register's
 * 'champollion-derived' entry (LicenseRef-Champollion-Derived).
 */
export const INTERNAL_SOURCE_PATTERNS = [
  /^derived([:\-]|$)/,        // derived, derived:script, derived-from-…
  /^champollion-derived([\s:(\[-]|$)/, // champollion-derived [family-level prior; …]
  /^corpora-cards(\s*\(|$)/,  // corpora-cards (sync-eval-datasets.mjs) — the
                              // repo's own eval registry; per-corpus licenses
                              // live on the corpora cards themselves
  /^template-generated([:\-]|$)/, // template-generated:grambank-GB415 (…)
  /^manual-curation(-|$)/,    // manual-curation, manual-curation-verified
  /^manual-curation\+\S+$/,   // manual-curation+<citation-url> — curated
                              // endonym seed stamps (apply-curated-endonyms.mjs);
                              // the suffix is a citation, not a source id
  /^cleanup(-resources)?-phase\d+$/,
  /^api-verification(-\d+)?$/,
  /^not-populated$/,
];

/**
 * Alias map: card-source vocabulary → register vocabulary.
 * Applied AFTER version stripping (keys are base forms). Every entry is
 * justified by an observed mismatch between the enrichment pipeline's
 * source ids and the tc-licenses register keys — do not add speculative
 * aliases.
 */
export const SOURCE_ALIASES = new Map(Object.entries({
  'iso639-3': 'sil-iso639-3',
  'iso639': 'sil-iso639-3',                  // 'iso639-3-2024' version-strips to 'iso639'
  'olac-aggregator': 'olac',
  'huggingface-datasets': 'huggingface',
  'keyman-api': 'keyman',
  'kaikki-wiktionary': 'wiktionary',
  'kaikki-wiktextract': 'wiktionary',
  'opus-nlpl': 'opus',
  'opus-nlpl-api': 'opus-api',
  'ucla-phonetics': 'uclaphoneticslabarchive',
  'huntergatherer-db': 'huntergatherer',
  'huntergatherer-lexibank': 'huntergatherer',
  'nllb': 'meta-nllb',                       // nllb-200 → meta-nllb-200 (base forms)
  'cldr': 'unicode-cldr',
  'wikimedia-sitematrix': 'wikipedia-sitematrix',
  'siteinfo': 'wikipedia-sitematrix',        // "wikimedia-sitematrix+siteinfo" components
  'numeralbank-channumerals': 'numeralbank',
  'datsemshift-zalizniak': 'datsemshift',
  'acd-blust': 'acd',
  'valpal-hartmann': 'valpal',
  'bowern-pny': 'bowernpny',
  'vanuatu-voices': 'vanuatuvoices',
  'glottolog-aes': 'glottolog',
  'glottolog-languoid': 'glottolog',         // glottolog-5.x-languoid
  'sagart-sino-tibetan': 'sagartst',         // same Sagart et al. Sino-Tibetan dataset
  'ids-cldf': 'ids',                         // CLDF edition of IDS (same dataset/license)
  'paradisec-olac': 'paradisec',             // PARADISEC catalog metadata harvested via OLAC
  'rosetta-project-ia': 'rosetta-project',   // same collection, Internet Archive hosting
  'language-atlas-pacific': 'wurm-hattori-pacific-atlas', // same atlas, two card vocabularies
  'lexibank-batch': 'lexibank',              // batch enrichment over the lexibank umbrella
  'cldr-endonym': 'unicode-cldr',            // CLDR endonym data ("cldr-endonym (matched via fa)")
  'wikidata-rdfs-label-own': 'wikidata',     // own-language rdfs:label tier of
                                             // harvest-wikidata-endonyms.mjs (same CC0 dataset)
}));

/**
 * Resolve ONE source id component (no '+') against the register.
 * Returns the register key it resolves to, or null.
 */
export function resolveSourceComponent(id, register) {
  const { sourceKeys, baseIndex } = register;

  // 1. Exact match
  if (sourceKeys.has(id)) return id;

  // 2. Internal derivation pseudo-sources → champollion-derived
  for (const pattern of INTERNAL_SOURCE_PATTERNS) {
    if (pattern.test(id)) return 'champollion-derived';
  }

  // 3. Version-stripped base match (both sides base-normalized)
  let base = stripVersionTokens(id);
  if (sourceKeys.has(base)) return base;
  if (baseIndex.has(base)) return baseIndex.get(base);

  // 4. Alias rename
  if (SOURCE_ALIASES.has(base)) {
    const target = SOURCE_ALIASES.get(base);
    if (sourceKeys.has(target)) return target;
    if (baseIndex.has(target)) return baseIndex.get(target);
  }

  // 5. lexibank-<dataset> prefix / <dataset>-lexibank suffix: register
  //    keys are bare dataset names (e.g. 'dyenindoeuropean', 'abvd',
  //    'uralex', 'crossandean'); cards tag them with the lexibank family.
  if (base.startsWith('lexibank-')) {
    const bare = base.slice('lexibank-'.length);
    if (sourceKeys.has(bare)) return bare;
    if (baseIndex.has(bare)) return baseIndex.get(bare);
  }
  if (base.endsWith('-lexibank')) {
    const bare = base.slice(0, -'-lexibank'.length);
    if (sourceKeys.has(bare)) return bare;
    if (baseIndex.has(bare)) return baseIndex.get(bare);
  }

  // 6. FEATURE-ID citation: "<dataset>-<featureId>", e.g. grambank-GB415,
  //    wals-44A, wals-13A. The card is citing a specific typological feature,
  //    and the LICENSED thing is the dataset — Grambank's license governs
  //    GB415 exactly as it governs every other feature. Without this, 2,006
  //    card-citations of Grambank and WALS features read as unlicensed
  //    sources, which would have buried the real findings under noise.
  //    Deliberately narrow: the suffix must be a feature-code shape (letters
  //    then digits, or digits then a letter), never an arbitrary word.
  const featureM = /^(.+)-(?:[A-Z]{2}\d+|\d+[A-Z])$/.exec(base);
  if (featureM) {
    const dataset = featureM[1];
    if (sourceKeys.has(dataset)) return dataset;
    if (baseIndex.has(dataset)) return baseIndex.get(dataset);
  }

  return null;
}

/**
 * Resolve a full source value, which may be a compound "a+b+c" string.
 * Returns { ok: boolean, unresolved: string[], malformed: boolean }.
 */
export function resolveSourceValue(value, register) {
  // Stringified-array data bug: "['a', 'b']+c" — produced by an upstream
  // enrichment step that joined a Python list repr instead of its items.
  // Unparseable as source ids; flag the whole value as malformed. A bare
  // '[' is NOT malformed by itself — internal stamps legitimately carry
  // bracketed citations ("champollion-derived [family-level prior; …]"),
  // so only the quote-bearing list-repr shape is flagged (2026-07-07).
  if (value.includes("['") || value.includes("'")) {
    return { ok: false, unresolved: [value], malformed: true };
  }

  // Whole-value internal derivations like "derived:cldr+script+keyboard"
  // describe a derivation recipe, not a '+'-joined source list — the
  // components after the first are recipe inputs ("script", "keyboard"),
  // not source ids. Match internal patterns against the full value first.
  for (const pattern of INTERNAL_SOURCE_PATTERNS) {
    if (pattern.test(value)) return { ok: true, unresolved: [], malformed: false };
  }

  // Parenthetical citations may legitimately contain spaces; only split
  // on '+' that separates components.
  const components = value.split('+').map(c => c.trim()).filter(Boolean);
  const unresolved = [];
  for (const component of components) {
    if (!resolveSourceComponent(component, register)) {
      unresolved.push(component);
    }
  }
  return { ok: unresolved.length === 0, unresolved, malformed: false };
}
