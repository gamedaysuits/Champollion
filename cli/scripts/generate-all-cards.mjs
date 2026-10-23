#!/usr/bin/env node

// ─── RETIRED (2026-08-18, champollion.db retirement B7) ─────────────────────
// This script belongs to the LEGACY champollion.db lane, which no card is
// built from. Running it would write to (or derive from) a store nothing
// reads. Refuse loudly instead of running against a retired store.
// Ledger: shared/cldf/deprecations.json.
console.error(
  'generate-all-cards.mjs is RETIRED — the legacy champollion.db lane is retired.\n'
  + 'Replacement: node cli/scripts/cldf/build-atlas.mjs then node cli/scripts/cutover-cards.mjs --apply\n'
  + 'See shared/cldf/deprecations.json.'
);
process.exit(2);
// ────────────────────────────────────────────────────────────────────────────

/**
 * generate-all-cards.mjs
 * ────────────────────────────────────────────────────────────────
 * Mass Language Card Generator
 *
 * Generates language cards for ALL ~7,900 ISO 639-3 languages by
 * merging data from multiple authoritative sources:
 *
 *   1. ISO 639-3 code tables (SIL) — canonical IDs, names, scope, type
 *   2. Glottolog 5.3 (MPI) — classification, coordinates, countries
 *   3. CLDR (Unicode) — plural rules, script metadata, typography
 *   4. Method support tables — Google, DeepL, Microsoft, LibreTranslate
 *   5. NLLB-200 actual code set — replaces broken heuristic
 *   6. FLORES+ actual code set — replaces Google Translate proxy
 *
 * KEY DESIGN PRINCIPLE: MERGE, don't overwrite.
 *   If a human has curated contactInfluences for pam.json, this script
 *   preserves that and only fills in empty/TODO fields.
 *
 * SPEAKER ESTIMATES: Multi-source, no false flattening.
 *   Each authority's estimate is recorded separately. Users navigate
 *   disagreement themselves — we don't pretend there's one clear answer.
 *
 * Usage:
 *   node scripts/generate-all-cards.mjs [--dry-run] [--stats-only] [--migrate]
 *
 * Flags:
 *   --dry-run     Show what would be written without writing files
 *   --stats-only  Print statistics and exit
 *   --migrate     Also rename existing cards from ISO 639-1 to ISO 639-3
 *   --lang CODE   Generate/update only a single language (ISO 639-3 code)
 *
 * Prerequisites:
 *   - cli/data/iso639-3/iso-639-3.tab (download from iso639-3.sil.org)
 *   - cli/data/glottolog/languoid.csv (download from glottolog.org)
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(CLI_ROOT, 'data');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');

// ─── Data file paths ───────────────────────────────────────────
const ISO_639_3_TAB = path.join(DATA_DIR, 'iso639-3', 'iso-639-3.tab');
const ISO_639_3_MACRO = path.join(DATA_DIR, 'iso639-3', 'iso-639-3-macrolanguages.tab');
const GLOTTOLOG_CSV = path.join(DATA_DIR, 'glottolog', 'languoid.csv');
const GLOTTOLOG_CLDF_CSV = path.join(DATA_DIR, 'glottolog', 'cldf-languages.csv');
const GLOTTOLOG_AES_CSV = path.join(DATA_DIR, 'glottolog', 'aes-values.csv');
const NLLB_CODES_JSON = path.join(DATA_DIR, 'nllb', 'nllb-200-codes.json');
const FLORES_CODES_JSON = path.join(DATA_DIR, 'flores', 'flores-plus-codes.json');

// ─── CLI flags ─────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const STATS_ONLY = process.argv.includes('--stats-only');
const MIGRATE = process.argv.includes('--migrate');
// Opt-in: also mint stubs for Glottolog level=language nodes that never
// received an ISO 639-3 code (keyed on glottocode, iso639_3:null). Off by
// default so a normal run stays ISO-bounded (founder scope decision 2026-07-20).
const INCLUDE_GLOTTOLOG_ONLY = process.argv.includes('--include-glottolog-only');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Constants ─────────────────────────────────────────────────
const GENERATED_AT = new Date().toISOString();

// Glottolog files some entries under housekeeping pseudo-families that are
// NOT genealogical language families. Per the Language-Card Boundary
// Invariant, cards for these languoids assert NO family: family stays null,
// the bucket glottocode is carried machine-readably, and a cited note says
// what Glottolog does say. Keep in sync with build-language-tree.mjs
// (the authoritative classification enricher).
//
// pidg1258 'Pidgin' and mixe1287 'Mixed Language' are included per founder
// direction (2026-07-07): meaningful contact-language TYPES, but still not
// genealogical families — the type information lives in the cited note.
const HOUSEKEEPING_BUCKETS = {
  book1242: {
    name: 'Bookkeeping',
    gloss: 'the housekeeping category for spurious, unattested, or retired entries',
  },
  uncl1493: {
    name: 'Unclassifiable',
    gloss: 'the holding category for languages whose documentation is too limited to establish any genealogical affiliation',
  },
  unat1236: {
    name: 'Unattested',
    gloss: 'the holding category for languages reported to exist but with no attested linguistic data',
  },
  arti1236: {
    name: 'Artificial Language',
    gloss: 'the category for constructed languages, which stand outside genealogical classification',
  },
  spee1234: {
    name: 'Speech Register',
    gloss: 'the category for special-purpose speech registers rather than independently transmitted languages',
  },
  pidg1258: {
    name: 'Pidgin',
    gloss: 'the category for pidgins, contact languages that stand outside tree-model genealogical descent',
  },
  mixe1287: {
    name: 'Mixed Language',
    gloss: 'the category for mixed languages, whose descent from multiple source languages stands outside single-parent genealogical classification',
  },
};

const HOUSEKEEPING_BUCKET_NAMES = new Set(
  Object.values(HOUSEKEEPING_BUCKETS).map(b => b.name));

function bucketClassification(bucketGlottocode) {
  const { name, gloss } = HOUSEKEEPING_BUCKETS[bucketGlottocode];
  return {
    family: null,
    glottologBucket: bucketGlottocode,
    note: `Glottolog 5.3 files this entry under its '${name}' bucket ` +
      `(${bucketGlottocode}) — ${gloss}, not a genealogical language ` +
      `family. No family classification is asserted.`,
    ancestry: [],
  };
}

// Languages that are NOT individual spoken languages — exclude from card generation.
// ISO 639-3 includes special codes, ancient languages we might want, etc.
const EXCLUDED_LANGUAGE_TYPES = new Set([
  // 'A' = Ancient — actually keep these, some have MT interest (Latin, Sanskrit)
  // 'H' = Historical — keep, some have cultural significance
  // 'E' = Extinct — keep, these are important for documentation
  // 'C' = Constructed — keep selectively (Esperanto, Klingon)
  // We only exclude if the Scope is 'S' (Special) which are things like
  // "Undetermined" (und), "Multiple languages" (mul), etc.
]);
const EXCLUDED_SCOPE = new Set(['S']); // Special codes only

// Macrolanguage codes purged in the v1 purge (2026-06-10): these were removed
// from both champollion.db (languages table) and the card corpus because their
// content lives on the individual-language cards (arb/cmn/swh/pes/zsm/nob+nno/als).
// Without this skip list, a regeneration resurrects stale duplicate cards.
const PURGED_MACROLANGUAGES = new Set(['ara', 'fas', 'msa', 'nor', 'sqi', 'swa', 'zho']);


// ─── Method support lookup tables ──────────────────────────────
// Source: Manual verification against each service's language list.
// Last updated: 2026-06-07
//
// WHY HARDCODED: These services don't offer stable APIs for their
// language lists. We verify periodically and update the tables.
// The linter (lint-language-cards.mjs) checks for drift.

// Google Translate — ISO 639-1 codes (mapped to ISO 639-3 in the generator)
// Source: https://cloud.google.com/translate/docs/languages
const GOOGLE_TRANSLATE_CODES = new Set([
  'af', 'sq', 'am', 'ar', 'hy', 'as', 'ay', 'az', 'bm', 'eu', 'be', 'bn',
  'bho', 'bs', 'bg', 'ca', 'ceb', 'zh', 'co', 'hr', 'cs', 'da', 'dv', 'doi',
  'nl', 'en', 'eo', 'et', 'ee', 'fil', 'fi', 'fr', 'fy', 'gl', 'ka', 'de',
  'el', 'gn', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig',
  'ilo', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'gom', 'ko',
  'kri', 'ku', 'ckb', 'ky', 'lo', 'la', 'lv', 'ln', 'lt', 'lg', 'lb', 'mk',
  'mai', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mni', 'lus', 'mn', 'my', 'ne',
  'no', 'ny', 'or', 'om', 'ps', 'fa', 'pl', 'pt', 'pa', 'qu', 'ro', 'ru',
  'sm', 'sa', 'gd', 'nso', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so',
  'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'ti', 'ts',
  'tr', 'tk', 'ak', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo',
  'zu',
  // Philippine languages added July 2024
  'bcl', 'hil', 'pag', 'pam', 'war',
]);

// DeepL — ISO 639-1 codes
// Source: https://developers.deepl.com/docs/resources/supported-languages
const DEEPL_CODES = new Set([
  'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'hu',
  'id', 'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru',
  'sk', 'sl', 'sv', 'tr', 'uk', 'zh',
]);

// Microsoft Translator — ISO 639-1 codes (subset, not exhaustive)
// Source: https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support
const MICROSOFT_CODES = new Set([
  'af', 'sq', 'am', 'ar', 'hy', 'as', 'az', 'bn', 'ba', 'bs', 'bg', 'ca',
  'zh', 'hr', 'cs', 'da', 'dv', 'nl', 'en', 'et', 'fo', 'fj', 'fil', 'fi',
  'fr', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'he', 'hi', 'hmn', 'hu', 'is',
  'id', 'ikt', 'iu', 'ga', 'it', 'ja', 'kn', 'kk', 'km', 'ko', 'ku', 'ky',
  'lo', 'lv', 'lt', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my',
  'ne', 'nb', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'sr',
  'sk', 'sl', 'so', 'es', 'sw', 'sv', 'ta', 'te', 'th', 'ti', 'to', 'tr',
  'tk', 'uk', 'ur', 'uz', 'vi', 'cy', 'xh', 'yo', 'zu',
]);


// ─── TSV/CSV Parsers ───────────────────────────────────────────

/**
 * Parse a TSV file line-by-line, returning an array of objects keyed by header.
 */
async function loadTSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`  ERROR: File not found: ${filePath}`);
    return [];
  }
  const rl = createInterface({
    input: createReadStream(filePath, 'utf-8'),
    crlfDelay: Infinity,
  });
  let headers = null;
  const rows = [];
  for await (const line of rl) {
    const fields = line.split('\t');
    if (!headers) { headers = fields; continue; }
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = fields[i] || '';
    rows.push(row);
  }
  return rows;
}

/**
 * Parse Glottolog's CSV (comma-separated, with quoted fields).
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

async function loadGlottologCSV() {
  if (!fs.existsSync(GLOTTOLOG_CSV)) {
    console.error(`  ERROR: Glottolog CSV not found at ${GLOTTOLOG_CSV}`);
    console.error('  Download from: https://glottolog.org/meta/downloads');
    return new Map();
  }
  const rl = createInterface({
    input: createReadStream(GLOTTOLOG_CSV, 'utf-8'),
    crlfDelay: Infinity,
  });
  let headers = null;
  // Index by ISO 639-3 code for fast lookup
  const byIso = new Map();
  // Also keep full index by glottocode for ancestry lookups
  const byGlottocode = new Map();

  for await (const line of rl) {
    if (!headers) { headers = parseCSVLine(line); continue; }
    const fields = parseCSVLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = fields[i] || '';

    byGlottocode.set(row.id, row);

    if (row.iso639P3code && (row.level === 'language' || row.level === 'dialect')) {
      // Prefer language-level entries over dialect-level
      if (!byIso.has(row.iso639P3code) || row.level === 'language') {
        byIso.set(row.iso639P3code, row);
      }
    }
  }
  return { byIso, byGlottocode };
}

/**
 * Build the ancestry chain for a glottocode → array of family nodes.
 */
function getAncestryChain(glottocode, byGlottocode) {
  const chain = [];
  let cur = glottocode;
  const visited = new Set(); // guard against circular refs
  while (cur && byGlottocode.has(cur) && !visited.has(cur)) {
    visited.add(cur);
    const row = byGlottocode.get(cur);
    chain.unshift({ glottocode: row.id, name: row.name, level: row.level });
    cur = row.parent_id || null;
  }
  return chain;
}


// ─── ISO 639-1 → ISO 639-3 mapping ────────────────────────────

function buildIso1ToIso3Map(isoRows) {
  const map = new Map();
  for (const row of isoRows) {
    if (row.Part1) {
      map.set(row.Part1, row.Id);
    }
  }
  // Special cases for codes used in our card filenames
  // that don't directly map via Part1
  map.set('nb', 'nob'); // Norwegian Bokmål
  map.set('tl', 'tgl'); // Tagalog (fil is Filipino, tl/tgl is Tagalog)
  return map;
}


// ─── NLLB and FLORES+ code sets ────────────────────────────────

function loadCodeSet(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️  Code set not found: ${filePath} — will be empty`);
    return new Map();
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  // Expected format: { "crk": "crk_Cans", "pam": "pam_Latn", ... }
  // or array format: [{"iso639_3": "crk", "nllb_code": "crk_Cans"}, ...]
  if (Array.isArray(data)) {
    const map = new Map();
    for (const entry of data) {
      map.set(entry.iso639_3, entry.code || entry.nllb_code || entry.flores_code);
    }
    return map;
  }
  return new Map(Object.entries(data));
}


// ─── Method support resolution ─────────────────────────────────

/**
 * Check if a language (by ISO 639-3 code) is supported by a service.
 * The service lookup tables use ISO 639-1 codes, so we need the Part1 mapping.
 */
function resolveMethodSupport(iso3Code, part1Code, nllbCodes, floresCodes) {
  const methods = {};

  // Google Translate
  const googleSupported = GOOGLE_TRANSLATE_CODES.has(part1Code) ||
                          GOOGLE_TRANSLATE_CODES.has(iso3Code);
  methods.googleTranslate = {
    supported: googleSupported,
    ...(googleSupported && { verifiedDate: '2026-06-07' }),
  };

  // DeepL
  const deeplSupported = DEEPL_CODES.has(part1Code);
  methods.deepl = {
    supported: deeplSupported,
    ...(deeplSupported && { verifiedDate: '2026-06-07' }),
  };

  // Microsoft Translator
  const msSupported = MICROSOFT_CODES.has(part1Code) ||
                      MICROSOFT_CODES.has(iso3Code);
  methods.microsoft = {
    supported: msSupported,
    ...(msSupported && { verifiedDate: '2026-06-07' }),
  };

  // NLLB-200
  const nllbCode = nllbCodes.get(iso3Code);
  methods.nllb = {
    supported: !!nllbCode,
    ...(nllbCode && { code: nllbCode, verifiedDate: '2026-06-07' }),
  };

  return methods;
}


// ─── Card generation ───────────────────────────────────────────

/**
 * Generate a language card for a single ISO 639-3 entry.
 *
 * Parameters:
 *   isoEntry — row from iso-639-3.tab
 *   glottologEntry — row from Glottolog CSV (may be null)
 *   classification — ancestry chain from Glottolog (may be null)
 *   existingCard — existing card JSON to merge with (may be null)
 *   nllbCodes, floresCodes — code set maps
 */
function generateCard(isoEntry, glottologEntry, classification, existingCard, nllbCodes, floresCodes) {
  const iso3 = isoEntry.Id;
  const part1 = isoEntry.Part1 || null;

  // Start with existing card if we have one, otherwise build from scratch
  const card = existingCard ? { ...existingCard } : {};

  // ── Immutable identity fields (always set from authoritative sources) ──
  card.code = iso3;
  card.iso639_3 = iso3;
  if (part1) card.iso639_1 = part1;

  // Name: prefer existing curated name, fall back to ISO reference name
  if (!card.name) {
    card.name = isoEntry.Ref_Name;
  }

  // ISO language type metadata
  card.isoScope = isoEntry.Scope; // I=Individual, M=Macrolanguage, S=Special
  card.isoType = isoEntry.Language_Type; // L=Living, E=Extinct, A=Ancient, H=Historical, C=Constructed

  // ── Glottolog enrichment ──
  if (glottologEntry) {
    // Glottocode
    if (!card.glottocode) {
      card.glottocode = glottologEntry.id;
    }

    // Classification from ancestry chain
    if (classification && classification.length > 0) {
      const familyNodes = classification.filter(n => n.level === 'family');
      const topFamily = familyNodes[0] || null;
      const genus = familyNodes.length > 1 ? familyNodes[familyNodes.length - 1] : null;

      if (!card.classification) {
        card.classification = {};
      }
      // Repair pre-fix cards that carry a housekeeping bucket as a family
      // so the honest block below can take its place.
      if (HOUSEKEEPING_BUCKET_NAMES.has(card.classification.family) ||
          HOUSEKEEPING_BUCKETS[card.classification.familyGlottocode]) {
        card.classification = {};
      }
      if (topFamily && HOUSEKEEPING_BUCKETS[topFamily.glottocode]) {
        // Housekeeping bucket → honest no-family block (see the map's doc
        // comment above). Only when nothing curated is present: a
        // human-curated family or an already-honest block is preserved,
        // matching the merge-don't-overwrite principle.
        if (!card.classification.family && !card.classification.glottologBucket) {
          card.classification = bucketClassification(topFamily.glottocode);
        }
      } else {
        if (topFamily && !card.classification.family) {
          card.classification.family = topFamily.name;
          card.classification.familyGlottocode = topFamily.glottocode;
        }
        if (genus && genus.glottocode !== topFamily?.glottocode && !card.classification.genus) {
          card.classification.genus = genus.name;
          card.classification.genusGlottocode = genus.glottocode;
        }
        if (!card.classification.ancestry) {
          card.classification.ancestry = familyNodes.map(n => n.name);
        }
      }
    }

    // Coordinates
    if (!card.coordinates && glottologEntry.latitude && glottologEntry.longitude) {
      card.coordinates = {
        lat: parseFloat(glottologEntry.latitude),
        lng: parseFloat(glottologEntry.longitude),
        source: 'glottolog-5.3',
      };
    }

    // Countries
    if (!card.countries && glottologEntry.country_ids) {
      card.countries = glottologEntry.country_ids.split(/\s+/).filter(Boolean);
    }
  }

  // ── Method support (always refresh from lookup tables) ──
  const methods = resolveMethodSupport(iso3, part1 || '', nllbCodes, floresCodes);

  // Merge with existing method support — preserve any human-added entries
  // (e.g., community-specific engines) but refresh automated lookups
  if (!card.methodSupport) {
    card.methodSupport = methods;
  } else {
    // Update automated method entries, preserve custom ones.
    // Per-method shallow merge: refresh the automated keys (supported,
    // verifiedDate, …) but keep enrichment-added keys on the same method
    // entry (e.g. deepl.formality / formalitySource) — wholesale replacement
    // silently destroyed them.
    for (const [key, value] of Object.entries(methods)) {
      const prev = card.methodSupport[key];
      card.methodSupport[key] = (prev && typeof prev === 'object')
        ? { ...prev, ...value }
        : value;
    }
  }

  // ── Eval datasets (based on actual FLORES+ code set) ──
  // evalDatasets entries are corpora-card registry ids (SSOT:
  // cli/shared/corpora-cards/). The FLORES+ devtest registry id is
  // 'eval-flores-devtest-v1'; the bare 'flores-plus-devtest' /
  // 'flores-devtest' strings were pre-registry ad-hoc ids and are
  // scrubbed here (sync-eval-datasets.mjs re-derives the full list).
  const FLORES_REGISTRY_ID = 'eval-flores-devtest-v1';
  const floresCode = floresCodes.get(iso3);
  if (!card.evalDatasets) {
    card.evalDatasets = [];
  }
  // Remove incorrectly assigned / legacy-id FLORES+ entries, add correct ones
  card.evalDatasets = card.evalDatasets.filter(d =>
    d !== 'flores-plus-devtest' && d !== 'flores-devtest'
  );
  if (floresCode) {
    card.evalDatasets.push(FLORES_REGISTRY_ID);
  }
  // Deduplicate
  card.evalDatasets = [...new Set(card.evalDatasets)];

  // ── Support tier ──
  // Determined by what evaluation infrastructure exists
  if (!card.supportTier) {
    if (card.evalDatasets.length > 0 ||
        Object.values(card.methodSupport).some(m => m.supported)) {
      card.supportTier = 'development';
    } else {
      card.supportTier = 'cataloged';
    }
  }

  // ── Speaker estimates (multi-source, no false flattening) ──
  // Only initialize if not already present — human curation takes priority
  if (!card.speakerEstimates) {
    card.speakerEstimates = [];
    // We'll add Wikidata/Glottolog data when those sources are integrated
    // For now, mark as needing data
  }

  // ── Data sources tracking ──
  if (!card.dataSources) {
    card.dataSources = [];
  }
  const newSources = ['iso639-3-2024', 'glottolog-5.3'];
  for (const src of newSources) {
    if (!card.dataSources.includes(src)) {
      card.dataSources.push(src);
    }
  }

  // ── Generation metadata ──
  card._generated = {
    by: 'generate-all-cards.mjs',
    at: GENERATED_AT,
    sources: ['iso639-3', 'glottolog-5.3'],
    completeness: computeCompleteness(card),
  };

  return card;
}


/**
 * Compute card completeness tier based on how many fields are populated.
 */
function computeCompleteness(card) {
  let score = 0;
  let max = 0;

  const check = (field, weight = 1) => {
    max += weight;
    if (field !== undefined && field !== null && field !== '' &&
        field !== 'TODO' && !(typeof field === 'string' && field.startsWith('TODO'))) {
      if (Array.isArray(field) && field.length === 0) return;
      if (typeof field === 'object' && !Array.isArray(field) && Object.keys(field).length === 0) return;
      score += weight;
    }
  };

  check(card.name);
  check(card.classification, 2);
  check(card.glottocode);
  check(card.coordinates);
  check(card.countries);
  check(card.methodSupport, 2);
  check(card.speakerEstimates?.length > 0 ? card.speakerEstimates : null, 2);
  check(card.scripts);
  check(card.linguisticChallenges, 3);
  check(card.encyclopedic, 3);
  check(card.resources, 2);
  check(card.contactInfluences, 2);

  const ratio = score / max;
  if (ratio >= 0.7) return 'complete';
  if (ratio >= 0.35) return 'partial';
  return 'minimal';
}


// ─── Card migration (ISO 639-1 → ISO 639-3 filenames) ─────────

function migrateCardFilenames(iso1ToIso3, cardsDir) {
  const renames = [];
  const files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  for (const filename of files) {
    const code = filename.replace('.json', '');

    // Skip if already ISO 639-3 (3-letter code or known special codes)
    if (code.length === 3 && !code.includes('-')) continue;

    // Handle regional variants like es-MX, fr-CA, zh-TW, pt-PT
    if (code.includes('-')) {
      const [langPart, regionPart] = code.split('-');
      const iso3 = iso1ToIso3.get(langPart);
      if (iso3 && iso3 !== langPart) {
        renames.push({
          from: filename,
          to: `${iso3}-${regionPart}.json`,
          reason: `${langPart} → ${iso3} (ISO 639-1 → ISO 639-3)`,
        });
      }
      continue;
    }

    // Skip constructed/special language codes (x-prefix)
    if (code.startsWith('x-')) continue;

    // 2-letter code → look up ISO 639-3
    if (code.length === 2) {
      const iso3 = iso1ToIso3.get(code);
      if (iso3) {
        renames.push({
          from: filename,
          to: `${iso3}.json`,
          reason: `${code} → ${iso3} (ISO 639-1 → ISO 639-3)`,
        });
      } else {
        console.warn(`  ⚠️  No ISO 639-3 mapping for ${code}`);
      }
    }
  }

  return renames;
}


// ─── Glottolog-only stubs (opt-in: --include-glottolog-only) ───
//
// Glottolog recognises ~8,618 languages; ~759 level=language nodes never
// received an ISO 639-3 code, so the ISO-bounded enumeration above skips them.
// Founder scope decision (2026-07-20): mint honest, cited stubs for these,
// keyed on GLOTTOCODE (code = glottocode, iso639_3 = null) — the same
// code-is-a-general-key pattern the regional-variant and conlang cards already
// use. Only genuine gaps (no ISO code) are minted; ISO-retired codes are NOT
// (a deliberate ISO decision), and merge-redirects already keep their names
// findable (see enrich-alternate-names.mjs).

// AES endangerment code → vitality fields (SSOT mirror of enrich-cards-bulk.mjs).
const AES_TO_VITALITY = {
  'aes-not_endangered': { aesStatus: 'not endangered', egidsEstimate: '6a', aesLabel: 'Not endangered' },
  'aes-threatened':     { aesStatus: 'threatened',     egidsEstimate: '6b', aesLabel: 'Threatened' },
  'aes-shifting':       { aesStatus: 'shifting',       egidsEstimate: '7',  aesLabel: 'Shifting' },
  'aes-moribund':       { aesStatus: 'moribund',       egidsEstimate: '8a', aesLabel: 'Moribund' },
  'aes-nearly_extinct': { aesStatus: 'nearly extinct', egidsEstimate: '8b', aesLabel: 'Nearly extinct' },
  'aes-extinct':        { aesStatus: 'extinct',        egidsEstimate: '10', aesLabel: 'Extinct' },
};

/** Read a CSV file fully, returning an array of header-keyed row objects. */
async function loadCSVRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const rl = createInterface({ input: createReadStream(filePath, 'utf-8'), crlfDelay: Infinity });
  let headers = null;
  const rows = [];
  for await (const line of rl) {
    if (!headers) { headers = parseCSVLine(line); continue; }
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = fields[i] || '';
    rows.push(row);
  }
  return rows;
}

/**
 * Build a stub language card for a Glottolog level=language node with no ISO
 * code. Keyed on glottocode. Carries only what Glottolog cites (name,
 * classification, coordinates, countries, macroarea, AES vitality) — every
 * translation/eval capability field is empty, so the client-side thin-card
 * fallback (DetailPanel buildFallbackSummary) renders a dignified, cited
 * summary and no capability is falsely claimed.
 */
function generateGlottologOnlyStub(glottoRow, byGlottocode, cldfByGc, aesByGc) {
  const gc = glottoRow.id;
  const cldf = cldfByGc.get(gc) || {};
  const isIsolate = cldf.Is_Isolate === 'True' || cldf.Is_Isolate === 'true';
  const card = {
    code: gc,
    iso639_3: null,          // no ISO 639-3 code — this is the whole point
    glottocode: gc,
    name: glottoRow.name,
    isoScope: 'I',           // Glottolog level=language ≈ individual language
  };

  // Classification — Glottolog ancestry, honest no-family for housekeeping
  // buckets, the 'Language isolate' convention (matching Basque etc.) for
  // parentless isolates.
  const classification = getAncestryChain(gc, byGlottocode);
  const familyNodes = (classification || []).filter(n => n.level === 'family');
  const topFamily = familyNodes[0] || null;
  if (topFamily && HOUSEKEEPING_BUCKETS[topFamily.glottocode]) {
    card.classification = bucketClassification(topFamily.glottocode);
  } else if (topFamily) {
    const genus = familyNodes.length > 1 ? familyNodes[familyNodes.length - 1] : null;
    card.classification = {
      family: topFamily.name,
      familyGlottocode: topFamily.glottocode,
      ancestry: familyNodes.map(n => n.name),
    };
    if (genus && genus.glottocode !== topFamily.glottocode) {
      card.classification.genus = genus.name;
      card.classification.genusGlottocode = genus.glottocode;
    }
  } else if (isIsolate) {
    card.classification = {
      family: 'Language isolate',
      familyGlottocode: gc,
      genus: glottoRow.name,
      genusGlottocode: gc,
      ancestry: [`${glottoRow.name} (isolate)`],
    };
  } else {
    card.classification = { family: null, ancestry: [] };
  }

  // Modality — signed languages must be badged 'signed'; spoken stays null.
  card.modality = card.classification.family === 'Sign Language' ? 'signed' : null;

  // Coordinates.
  if (glottoRow.latitude && glottoRow.longitude) {
    card.coordinates = {
      lat: parseFloat(glottoRow.latitude),
      lng: parseFloat(glottoRow.longitude),
      source: 'glottolog-5.3',
    };
  }

  // Countries (prefer languoid country_ids; fall back to CLDF).
  const countries = (glottoRow.country_ids || cldf.Countries || '')
    .split(/\s+/).map(c => c.trim()).filter(Boolean);
  card.countries = countries;
  card.regions = countries.map(c => ({ country: c }));

  // Macroarea + isolate (CLDF carries these; languoid.csv does not).
  if (cldf.Macroarea) card.macroarea = cldf.Macroarea;
  card.isIsolate = isIsolate;

  // AES vitality (cited). Present for a subset; drives the endangerment badge
  // and the fallback summary's vitality sentence.
  const aes = aesByGc.get(gc);
  if (aes && AES_TO_VITALITY[aes.Code_ID]) {
    const v = AES_TO_VITALITY[aes.Code_ID];
    card.vitality = {
      aesStatus: v.aesStatus,
      aesLabel: v.aesLabel,
      aesLevel: parseInt(aes.Value, 10) || null,
      egidsEstimate: v.egidsEstimate,
      source: 'glottolog-cldf-5.3',
      notes: aes.Comment || null,
    };
    if (v.aesStatus === 'extinct') card.isoType = 'E';
  }

  // Empty capability scaffold — nothing is claimed until attested upstream.
  // Mirrors the ays.json emerging-stub convention (null, not {}, for the
  // absent-data fields, so the curated-schema tests skip them).
  card.script = null;
  card.nativeName = null;
  card.speakerEstimates = [];
  card.methodSupport = {};
  card.resources = null;
  card.evalDatasets = [];
  card.pipelineReadiness = {};
  card.digitalPresence = null;
  card.corpusAvailability = null;
  card.databaseCoverage = {};
  card.linguisticChallenges = null;
  card.contactInfluences = [];
  card.formality = null;
  card.registers = null;
  card.gender = null;
  card.rules = null;
  card.culturalAphorism = null;
  card.dialectCount = null;
  card.keyboardSupport = null;
  card.omt1600 = null;
  card.notes = null;

  // Emerging = has demographic/vitality signal but no attested linguistic data;
  // cataloged = catalogued identity only. Mirrors derive-card-fields tiers.
  card.supportTier = card.vitality ? 'emerging' : 'cataloged';
  card.dataSources = ['glottolog-5.3'];
  card._generated = {
    by: 'generate-all-cards.mjs',
    at: GENERATED_AT,
    sources: ['glottolog-5.3'],
    completeness: computeCompleteness(card),
  };
  return card;
}


// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Champollion Mass Language Card Generator');
  console.log('  Sources: ISO 639-3 + Glottolog 5.3 + CLDR + method tables');
  console.log('  Principle: MERGE, don\'t overwrite. Multi-source estimates.');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Load data sources ──
  console.log('Loading data sources...');

  const isoRows = await loadTSV(ISO_639_3_TAB);
  console.log(`  ISO 639-3: ${isoRows.length} entries`);

  const macroRows = await loadTSV(ISO_639_3_MACRO);
  console.log(`  Macrolanguage mappings: ${macroRows.length} entries`);

  const { byIso: glottologByIso, byGlottocode } = await loadGlottologCSV();
  console.log(`  Glottolog: ${glottologByIso.size} languages by ISO, ${byGlottocode.size} total entries`);

  const nllbCodes = loadCodeSet(NLLB_CODES_JSON);
  console.log(`  NLLB-200: ${nllbCodes.size} language codes`);

  const floresCodes = loadCodeSet(FLORES_CODES_JSON);
  console.log(`  FLORES+: ${floresCodes.size} language codes`);

  // Build ISO 639-1 → ISO 639-3 map
  const iso1ToIso3 = buildIso1ToIso3Map(isoRows);
  console.log(`  ISO 639-1 → ISO 639-3 map: ${iso1ToIso3.size} entries`);

  // Build reverse map for existing card lookup
  const iso3ToIso1 = new Map();
  for (const [k, v] of iso1ToIso3) iso3ToIso1.set(v, k);

  // ── Load existing cards ──
  console.log('\nLoading existing cards...');
  const existingCards = new Map();
  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  for (const filename of cardFiles) {
    const code = filename.replace('.json', '');
    try {
      const card = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, filename), 'utf-8'));
      existingCards.set(code, card);
    } catch (e) {
      console.warn(`  ⚠️  Failed to parse ${filename}: ${e.message}`);
    }
  }
  console.log(`  Loaded ${existingCards.size} existing cards`);

  // Also index existing cards by ISO 639-3 code (some use ISO 639-1 filenames)
  const existingByIso3 = new Map();
  for (const [code, card] of existingCards) {
    const iso3 = card.iso639_3 || iso1ToIso3.get(code) || code;
    existingByIso3.set(iso3, { code, card });
  }

  // ── Handle migration ──
  if (MIGRATE) {
    console.log('\nPlanning filename migration (ISO 639-1 → ISO 639-3)...');
    const renames = migrateCardFilenames(iso1ToIso3, CARDS_DIR);
    console.log(`  Found ${renames.length} cards to rename:`);
    for (const r of renames) {
      console.log(`    ${r.from} → ${r.to}  (${r.reason})`);
    }
    if (!DRY_RUN && renames.length > 0) {
      console.log('\n  Executing renames...');
      for (const r of renames) {
        const fromPath = path.join(CARDS_DIR, r.from);
        const toPath = path.join(CARDS_DIR, r.to);
        // Read, update code field, write to new name, delete old
        const card = JSON.parse(fs.readFileSync(fromPath, 'utf-8'));
        const oldCode = card.code;
        const newCode = r.to.replace('.json', '');
        card.code = newCode;

        // Add backward-compatible alias so getLanguageCard('fr') still works
        // after the file is renamed to fra.json. The registers.js alias system
        // resolves these automatically.
        if (!card.aliases) card.aliases = [];
        if (!card.aliases.includes(oldCode)) {
          card.aliases.push(oldCode);
        }

        if (!card._migration) card._migration = {};
        card._migration.previousCode = oldCode;
        card._migration.migratedAt = GENERATED_AT;
        fs.writeFileSync(toPath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
        fs.unlinkSync(fromPath);
        console.log(`    ✅ ${r.from} → ${r.to} (alias: ${oldCode})`);

        // Update our in-memory maps
        existingCards.delete(oldCode);
        existingCards.set(newCode, card);
        existingByIso3.set(card.iso639_3 || newCode, { code: newCode, card });
      }
    }
  }

  // ── Filter languages for card generation ──
  const targetLanguages = isoRows.filter(row => {
    // Exclude special scope codes (und, mul, mis, etc.)
    if (EXCLUDED_SCOPE.has(row.Scope)) return false;
    // Exclude macrolanguages removed in the v1 purge (see PURGED_MACROLANGUAGES)
    if (PURGED_MACROLANGUAGES.has(row.Id)) return false;
    // If single-language mode, only process that one
    if (SINGLE_LANG && row.Id !== SINGLE_LANG) return false;
    return true;
  });

  console.log(`\nTarget languages: ${targetLanguages.length}`);

  // ── Print stats ──
  const stats = {
    total: targetLanguages.length,
    living: targetLanguages.filter(r => r.Language_Type === 'L').length,
    extinct: targetLanguages.filter(r => r.Language_Type === 'E').length,
    ancient: targetLanguages.filter(r => r.Language_Type === 'A').length,
    historical: targetLanguages.filter(r => r.Language_Type === 'H').length,
    constructed: targetLanguages.filter(r => r.Language_Type === 'C').length,
    individual: targetLanguages.filter(r => r.Scope === 'I').length,
    macrolanguage: targetLanguages.filter(r => r.Scope === 'M').length,
    withGlottolog: targetLanguages.filter(r => glottologByIso.has(r.Id)).length,
    withPart1: targetLanguages.filter(r => r.Part1).length,
    existing: 0,
    new: 0,
    complete: 0,
    partial: 0,
    minimal: 0,
  };

  console.log('\n  STATISTICS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Total target languages:  ${stats.total.toLocaleString()}`);
  console.log(`  Living:                  ${stats.living.toLocaleString()}`);
  console.log(`  Extinct:                 ${stats.extinct.toLocaleString()}`);
  console.log(`  Ancient:                 ${stats.ancient.toLocaleString()}`);
  console.log(`  Historical:              ${stats.historical.toLocaleString()}`);
  console.log(`  Constructed:             ${stats.constructed.toLocaleString()}`);
  console.log(`  Individual:              ${stats.individual.toLocaleString()}`);
  console.log(`  Macrolanguage:           ${stats.macrolanguage.toLocaleString()}`);
  console.log(`  With Glottolog data:     ${stats.withGlottolog.toLocaleString()}`);
  console.log(`  With ISO 639-1 code:     ${stats.withPart1.toLocaleString()}`);

  if (STATS_ONLY) {
    console.log('\n  (--stats-only mode, stopping here)');
    return;
  }

  // ── Generate cards ──
  console.log('\nGenerating cards...');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // In --include-glottolog-only mode we ONLY mint the glottocode-keyed stubs
  // (below) and leave every existing ISO card untouched — a surgical addition,
  // not the broad automated-field refresh a full run performs. Run plain
  // `generate-all-cards` (no flag) for the coordinated ISO regen.
  for (const isoEntry of (INCLUDE_GLOTTOLOG_ONLY ? [] : targetLanguages)) {
    const iso3 = isoEntry.Id;

    // Look up Glottolog data
    const glottoEntry = glottologByIso.get(iso3) || null;
    const classification = glottoEntry
      ? getAncestryChain(glottoEntry.id, byGlottocode)
      : null;

    // Look up existing card (by ISO 639-3 or old ISO 639-1 code)
    const existingEntry = existingByIso3.get(iso3);
    const existingCard = existingEntry?.card || null;
    const isUpdate = !!existingCard;

    // Generate/merge card
    const card = generateCard(
      isoEntry, glottoEntry, classification,
      existingCard, nllbCodes, floresCodes
    );

    // Track stats
    if (isUpdate) {
      updated++;
      stats.existing++;
    } else {
      created++;
      stats.new++;
    }

    const completeness = card._generated.completeness;
    stats[completeness]++;

    // Write card
    const outputPath = path.join(CARDS_DIR, `${iso3}.json`);
    if (!DRY_RUN) {
      fs.writeFileSync(outputPath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }

    // Progress logging (every 500 cards)
    const total = created + updated + skipped;
    if (total % 500 === 0) {
      console.log(`  ... processed ${total.toLocaleString()} / ${targetLanguages.length.toLocaleString()}`);
    }
  }

  // ── Glottolog-only stubs (opt-in) ──
  let glottologOnlyCreated = 0;
  if (INCLUDE_GLOTTOLOG_ONLY && !SINGLE_LANG) {
    console.log('\nMinting Glottolog-only stubs (--include-glottolog-only)...');
    const cldfRows = await loadCSVRows(GLOTTOLOG_CLDF_CSV);
    const cldfByGc = new Map(cldfRows.map(r => [r.Glottocode || r.ID, r]));
    const aesRows = await loadCSVRows(GLOTTOLOG_AES_CSV);
    const aesByGc = new Map();
    for (const r of aesRows) {
      if (r.Language_ID && !aesByGc.has(r.Language_ID)) aesByGc.set(r.Language_ID, r);
    }
    // Glottocodes already represented by a card (as filename OR as an ISO card's
    // glottocode) — never mint a duplicate.
    const coveredGc = new Set();
    // Language NAMES already in use. The register/name-resolution layer requires
    // unique names (a name must resolve to ONE language), so a Glottolog node
    // whose name collides with an existing card — or an already-minted stub —
    // is skipped rather than creating an unresolvable duplicate. This also
    // catches the same-language-different-catalog case where the ISO card does
    // not carry the matching glottocode (e.g. ile / inte1262 'Interlingue').
    const usedNames = new Set();
    for (const [code, card] of existingCards) {
      coveredGc.add(code);
      if (card.glottocode) coveredGc.add(card.glottocode);
      if (card.name) usedNames.add(card.name.toLowerCase());
    }
    let nameCollisions = 0;
    for (const row of byGlottocode.values()) {
      if (row.level !== 'language') continue;
      if (row.iso639P3code && row.iso639P3code.trim()) continue; // has an ISO code → not our gap
      if (coveredGc.has(row.id)) continue;                        // already carded
      if (!row.name) continue;
      if (usedNames.has(row.name.toLowerCase())) { nameCollisions++; continue; } // unresolvable duplicate name
      usedNames.add(row.name.toLowerCase());
      const stub = generateGlottologOnlyStub(row, byGlottocode, cldfByGc, aesByGc);
      const completeness = stub._generated.completeness;
      stats[completeness] = (stats[completeness] || 0) + 1;
      if (!DRY_RUN) {
        fs.writeFileSync(path.join(CARDS_DIR, `${row.id}.json`), JSON.stringify(stub, null, 2) + '\n', 'utf-8');
      }
      glottologOnlyCreated++;
      created++;
    }
    console.log(`  Minted ${glottologOnlyCreated.toLocaleString()} Glottolog-only stubs` +
      (nameCollisions ? ` (skipped ${nameCollisions} with a name already in use)` : ''));
  }

  // ── Summary ──
  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Created (new):           ${created.toLocaleString()}`);
  console.log(`  Updated (merged):        ${updated.toLocaleString()}`);
  console.log(`  Skipped:                 ${skipped.toLocaleString()}`);
  console.log(`  Complete cards:          ${stats.complete.toLocaleString()}`);
  console.log(`  Partial cards:           ${stats.partial.toLocaleString()}`);
  console.log(`  Minimal cards:           ${stats.minimal.toLocaleString()}`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DONE');
  if (DRY_RUN) console.log('  (Dry run — no files were written)');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
