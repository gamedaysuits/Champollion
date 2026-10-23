#!/usr/bin/env node

/**
 * enrich-cards-bulk.mjs
 * ────────────────────────────────────────────────────────────────
 * Bulk enrichment pipeline for language cards.
 *
 * Pulls data from multiple authoritative sources and merges into
 * existing cards WITHOUT overwriting human-curated fields.
 *
 * DATA SOURCES:
 *   1. Glottolog CLDF AES (Agglomerated Endangerment Status)
 *      - data/glottolog/aes-values.csv (derive-aes-values.mjs);
 *        8,672 records in glottolog-cldf v5.3
 *      - AES comments contain quoted multi-line text — the file MUST
 *        be parsed with the shared RFC-4180 reader (lib/csv.mjs); the
 *        pre-2026-07-19 per-line regex here truncated comments and
 *        corrupted vitality.notes on cards
 *
 *   2. Glottolog CLDF languages.csv
 *      - Macroarea (Africa, Eurasia, Papunesia, etc.)
 *      - Isolate status
 *      - First/last year of documentation
 *
 *   3. Wikidata SPARQL
 *      - Speaker counts (P1098) — multiple estimates kept separate
 *      - Native names (P1705) — endonym in the language itself
 *      - Writing systems/scripts (P282)
 *      - Writing direction (P1406)
 *      - Ethnologue language status (P3823) — EGIDS level
 *      - Wikipedia article (sitelinks)
 *
 * DESIGN PRINCIPLES:
 *   - MERGE only: never overwrite existing non-empty fields. The one
 *     exception is REPAIR of blocks this script itself owns: a
 *     vitality block whose source is 'glottolog-cldf-5.3' is
 *     recomputed field-by-field (aesStatus/aesLevel/aesLabel/
 *     egidsEstimate/notes) so corruption from earlier parser defects
 *     heals on re-run; fields owned by other generators (e.g.
 *     speakerCount) are preserved untouched. CREATE follows the same
 *     ownership rule: a new AES status merges INTO any status-less
 *     vitality block, never replaces it (pre-2026-07-19 it assigned a
 *     fresh object, destroying speakerCount/elcat* fields owned by
 *     other generators).
 *   - Multi-source estimates: speaker counts from different authorities
 *     are stored separately, NOT averaged or "resolved"
 *   - Source attribution: every added field records its source
 *   - Idempotent: safe to run multiple times
 *   - Rate-limited: respects Wikidata query limits
 *
 * SCOPING:
 *   --only-glottocodes <file> (one glottocode per line) restricts
 *   CREATION of new vitality blocks to the listed languages. Repair of
 *   existing glottolog-cldf-5.3 blocks is inherently scoped (only
 *   blocks previously written can be repaired). Used for the
 *   2026-07-19 corruption repair while card AES coverage was held at
 *   the historical 2,584-glottocode subset; the same-day founder
 *   decision then expanded coverage to the full v5.3 AES table via an
 *   unscoped run. The flag remains for targeted re-runs.
 *
 * Usage:
 *   node scripts/enrich-cards-bulk.mjs [--dry-run] [--source aes|wikidata|cldf|all]
 *   node scripts/enrich-cards-bulk.mjs --lang pam    # single language
 *   node scripts/enrich-cards-bulk.mjs --stats-only  # show what would change
 *   node scripts/enrich-cards-bulk.mjs --source aes --only-glottocodes list.txt
 *
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSVObjects } from './lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(CLI_ROOT, 'data');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');

// ─── Data file paths ───────────────────────────────────────────
const AES_CSV = path.join(DATA_DIR, 'glottolog', 'aes-values.csv');
const CLDF_LANGUAGES_CSV = path.join(DATA_DIR, 'glottolog', 'cldf-languages.csv');
const GLOTTOLOG_CSV = path.join(DATA_DIR, 'glottolog', 'languoid.csv');

// ─── CLI flags ─────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const STATS_ONLY = process.argv.includes('--stats-only');
const SOURCE = (() => {
  const idx = process.argv.indexOf('--source');
  return idx !== -1 ? process.argv[idx + 1] : 'all';
})();
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();
const ONLY_GLOTTOCODES = (() => {
  const idx = process.argv.indexOf('--only-glottocodes');
  if (idx === -1) return null;
  const listPath = process.argv[idx + 1];
  if (!listPath || !fs.existsSync(listPath)) {
    console.error(`  ❌ --only-glottocodes file not found: ${listPath}`);
    process.exit(1);
  }
  const set = new Set(
    fs.readFileSync(listPath, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean)
  );
  if (set.size === 0) {
    console.error(`  ❌ --only-glottocodes file is empty: ${listPath}`);
    process.exit(1);
  }
  return set;
})();

const ENRICHMENT_DATE = new Date().toISOString().split('T')[0];

// ─── AES Code Mapping ─────────────────────────────────────────
// Glottolog's OWN AES labels. We no longer CONVERT AES onto the UNESCO
// scale (the old unescoStatus mapping was a champollion derivation
// wearing an upstream's name — index-not-arbiter violation, fixed
// 2026-07-14). AES-filled cards get aesStatus; egidsEstimate stays
// (self-describing estimate). Per-source spread: vitalityStatuses[]
// (scripts/derive-vitality-statuses.mjs).
const AES_TO_VITALITY = {
  'aes-not_endangered': { aesStatus: 'not endangered', egidsLevel: '6a', label: 'Not endangered' },
  'aes-threatened':     { aesStatus: 'threatened', egidsLevel: '6b', label: 'Threatened' },
  'aes-shifting':       { aesStatus: 'shifting', egidsLevel: '7', label: 'Shifting' },
  'aes-moribund':       { aesStatus: 'moribund', egidsLevel: '8a', label: 'Moribund' },
  'aes-nearly_extinct': { aesStatus: 'nearly extinct', egidsLevel: '8b', label: 'Nearly extinct' },
  'aes-extinct':        { aesStatus: 'extinct', egidsLevel: '10', label: 'Extinct' },
};


// ═══════════════════════════════════════════════════════════════
// Phase 1: Glottolog AES Endangerment
// ═══════════════════════════════════════════════════════════════

/**
 * Load and parse the AES values CSV with the shared RFC-4180 reader.
 * AES comments contain quoted commas, escaped quotes, and multi-line
 * text — any per-line shortcut corrupts them (that defect shipped
 * truncated vitality.notes onto cards until 2026-07-19).
 * Returns a Map of glottocode → { aesCode, aesValue, comment }
 */
async function loadAESData() {
  if (!fs.existsSync(AES_CSV)) {
    console.warn('  ⚠️  AES CSV not found:', AES_CSV);
    return new Map();
  }
  const { rows } = parseCSVObjects(fs.readFileSync(AES_CSV, 'utf-8'), { file: 'aes-values.csv' });

  const data = new Map();
  for (const row of rows) {
    const glottocode = (row.Language_ID || '').trim();
    const aesValue = parseInt((row.Value || '').trim(), 10);
    const aesCode = (row.Code_ID || '').trim();
    if (!glottocode || !aesCode || isNaN(aesValue)) continue;
    data.set(glottocode, { aesCode, aesValue, comment: (row.Comment || '').trim() });
  }
  return data;
}

/**
 * Build glottocode → ISO 639-3 mapping from our existing languoid.csv.
 * Parsed with the shared reader: ~37 languoid names contain quoted
 * commas ("Achi', Cubulco", the Kaqchikel varieties, …), which a naive
 * split(',') shifts — those rows previously lost their ISO mapping.
 */
async function buildGlottocodeToIsoMap() {
  const map = new Map();
  if (!fs.existsSync(GLOTTOLOG_CSV)) return map;

  const { rows } = parseCSVObjects(fs.readFileSync(GLOTTOLOG_CSV, 'utf-8'), { file: 'languoid.csv' });
  for (const row of rows) {
    const glottocode = (row.id || '').trim();
    const iso = (row.iso639P3code || '').trim();
    if (glottocode && iso) {
      map.set(glottocode, iso);
    }
  }
  return map;
}


// ═══════════════════════════════════════════════════════════════
// Phase 2: Glottolog CLDF Languages (macroarea, isolate, documentation)
// ═══════════════════════════════════════════════════════════════

/**
 * Load CLDF languages.csv for macroarea and other metadata.
 * Parsed with the shared reader — 36 language names contain quoted
 * commas, which a naive split(',') used to shift out of their columns
 * (those rows were silently dropped by the level filter).
 * Returns Map of glottocode → { macroarea, isIsolate, firstDoc, lastDoc }
 */
async function loadCLDFLanguages() {
  if (!fs.existsSync(CLDF_LANGUAGES_CSV)) {
    console.warn('  ⚠️  CLDF languages CSV not found:', CLDF_LANGUAGES_CSV);
    return new Map();
  }
  const { rows } = parseCSVObjects(fs.readFileSync(CLDF_LANGUAGES_CSV, 'utf-8'), { file: 'cldf-languages.csv' });

  const data = new Map();
  for (const row of rows) {
    const glottocode = (row.Glottocode || row.ID || '').trim();
    const level = (row.Level || '').trim();
    if (!glottocode || level !== 'language') continue;

    const firstDoc = (row.First_Year_Of_Documentation || '').trim();
    const lastDoc = (row.Last_Year_Of_Documentation || '').trim();
    data.set(glottocode, {
      isoCode: (row.ISO639P3code || '').trim(),
      macroarea: (row.Macroarea || '').trim(),
      isIsolate: (row.Is_Isolate || '').trim() === 'true',
      firstDoc: firstDoc || null,
      lastDoc: lastDoc || null,
    });
  }
  return data;
}


// ═══════════════════════════════════════════════════════════════
// Phase 3: Wikidata SPARQL
// ═══════════════════════════════════════════════════════════════

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIDATA_BATCH_SIZE = 80; // Wikidata can handle ~100 VALUES, be conservative
const WIKIDATA_DELAY_MS = 2000; // Be respectful — 2s between requests

/**
 * Query Wikidata for a batch of ISO 639-3 codes.
 * Returns Map of iso639_3 → { nativeNames, speakerCounts, scripts, writingDir }
 */
async function queryWikidataBatch(isoCodes) {
  const valuesClause = isoCodes.map(c => `"${c}"`).join(' ');

  // This SPARQL query gets:
  // - P1098: number of speakers (may have multiple values with qualifiers)
  // - P1705: native label (endonym)
  // - P282: writing system
  // - P1406: writing direction
  // - P3823: Ethnologue language status (EGIDS)
  const query = `
SELECT ?iso639_3 ?nativeName ?numSpeakers ?scriptLabel ?writingDirLabel ?egidsLabel WHERE {
  ?lang wdt:P220 ?iso639_3 .
  OPTIONAL { ?lang wdt:P1705 ?nativeName . }
  OPTIONAL { ?lang wdt:P1098 ?numSpeakers . }
  OPTIONAL { ?lang wdt:P282 ?script .
    ?script rdfs:label ?scriptLabel .
    FILTER(LANG(?scriptLabel) = "en")
  }
  OPTIONAL { ?lang wdt:P1406 ?writingDir .
    ?writingDir rdfs:label ?writingDirLabel .
    FILTER(LANG(?writingDirLabel) = "en")
  }
  OPTIONAL { ?lang wdt:P3823 ?egids .
    ?egids rdfs:label ?egidsLabel .
    FILTER(LANG(?egidsLabel) = "en")
  }
  VALUES ?iso639_3 { ${valuesClause} }
}`;

  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Champollion/1.0 (https://github.com/gamedaysuits/Champollion; language-cards@champollion.org)',
      },
    });

    if (!response.ok) {
      console.error(`  ⚠️  Wikidata query failed: ${response.status} ${response.statusText}`);
      return new Map();
    }

    const json = await response.json();
    const results = new Map();

    for (const binding of json.results.bindings) {
      const iso = binding.iso639_3?.value;
      if (!iso) continue;

      if (!results.has(iso)) {
        results.set(iso, {
          nativeNames: new Set(),
          speakerCounts: new Set(),
          scripts: new Set(),
          writingDir: null,
          egids: null,
        });
      }

      const entry = results.get(iso);

      if (binding.nativeName?.value) {
        entry.nativeNames.add(binding.nativeName.value);
      }
      if (binding.numSpeakers?.value) {
        // A speaker count is a whole-number census/estimate. A few Wikidata
        // P1098 values are fractional (e.g. Yaygir/xya = 5.5) — round to the
        // nearest integer so a card never claims "half a speaker".
        const count = Math.round(parseFloat(binding.numSpeakers.value));
        if (Number.isFinite(count) && count > 0) {
          entry.speakerCounts.add(count);
        }
      }
      if (binding.scriptLabel?.value) {
        entry.scripts.add(binding.scriptLabel.value);
      }
      if (binding.writingDirLabel?.value) {
        entry.writingDir = binding.writingDirLabel.value;
      }
      if (binding.egidsLabel?.value) {
        entry.egids = binding.egidsLabel.value;
      }
    }

    return results;
  } catch (err) {
    console.error(`  ⚠️  Wikidata query error: ${err.message}`);
    return new Map();
  }
}

/**
 * Sleep utility for rate limiting.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Query Wikidata for ALL ISO 639-3 codes in batches.
 * Returns merged Map of iso639_3 → enrichment data.
 */
async function queryWikidataAll(isoCodes) {
  const allResults = new Map();
  const batches = [];

  // Split into batches
  for (let i = 0; i < isoCodes.length; i += WIKIDATA_BATCH_SIZE) {
    batches.push(isoCodes.slice(i, i + WIKIDATA_BATCH_SIZE));
  }

  console.log(`  Querying Wikidata: ${isoCodes.length} codes in ${batches.length} batches...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    if (i > 0) await sleep(WIKIDATA_DELAY_MS);

    const results = await queryWikidataBatch(batch);
    for (const [iso, data] of results) {
      allResults.set(iso, data);
    }

    // Progress every 10 batches
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      console.log(`    ... batch ${i + 1}/${batches.length} (${allResults.size} languages with data)`);
    }
  }

  return allResults;
}


// ═══════════════════════════════════════════════════════════════
// Merging Logic
// ═══════════════════════════════════════════════════════════════

/**
 * Merge enrichment data into a card.
 * Returns { card, changes } where changes lists what was modified.
 */
export function mergeEnrichment(card, aesData, cldfData, wikidataData) {
  const changes = [];
  const modified = { ...card };

  // ── AES Endangerment ──
  if (aesData) {
    const vitality = AES_TO_VITALITY[aesData.aesCode];
    if (vitality) {
      const existing = modified.vitality;
      if (existing && existing.source === 'glottolog-cldf-5.3') {
        // REPAIR: this block was written by this script — recompute the
        // fields it owns and correct any drift. (The pre-2026-07-19
        // per-line AES parser truncated multi-line quoted comments,
        // leaving mangled `notes` on ~66 cards.) Fields owned by other
        // generators — speakerCount, speakerCountSource, … — are
        // preserved untouched.
        const repaired = { ...existing };
        const expected = {
          aesStatus: vitality.aesStatus,
          aesLevel: aesData.aesValue,
          aesLabel: vitality.label,
          egidsEstimate: vitality.egidsLevel,
        };
        const fixes = [];
        for (const [key, value] of Object.entries(expected)) {
          if (repaired[key] !== value) {
            repaired[key] = value;
            fixes.push(key);
          }
        }
        if (aesData.comment) {
          if (repaired.notes !== aesData.comment) {
            repaired.notes = aesData.comment;
            fixes.push('notes');
          }
        } else if ('notes' in repaired) {
          delete repaired.notes;
          fixes.push('notes-removed');
        }
        if (fixes.length > 0) {
          modified.vitality = repaired;
          changes.push(`vitality repaired: ${fixes.join('+')}`);
        }
      } else if (!existing || !(existing.unescoStatus || existing.aesStatus)) {
        // CREATE: no vitality (or no curated status) on the card yet.
        // Gated by --only-glottocodes so a fuller aes-values.csv does
        // not silently expand card AES coverage beyond the sanctioned
        // scope.
        if (!ONLY_GLOTTOCODES || (modified.glottocode && ONLY_GLOTTOCODES.has(modified.glottocode))) {
          // Merge INTO any existing status-less block — same ownership
          // rule as REPAIR: this script writes only the fields it owns.
          // Assigning a fresh object here silently destroyed sibling
          // fields from other generators (speakerCount/
          // speakerCountSource, elcat*, endangerment) — 136 cards in
          // the 2026-07-19 expansion dry run. Block `source` names the
          // status owner; preserved fields keep their own attribution
          // (elcat* prefix, speakerCountSource).
          modified.vitality = {
            ...existing,
            aesStatus: vitality.aesStatus,
            aesLevel: aesData.aesValue,
            aesLabel: vitality.label,
            egidsEstimate: vitality.egidsLevel,
            source: 'glottolog-cldf-5.3',
            ...(aesData.comment && { notes: aesData.comment }),
          };
          changes.push(`vitality: ${vitality.label} (AES ${aesData.aesValue})`);
        }
      }
    }
  }

  // ── CLDF Languages metadata ──
  if (cldfData) {
    if (!modified.macroarea && cldfData.macroarea) {
      modified.macroarea = cldfData.macroarea;
      changes.push(`macroarea: ${cldfData.macroarea}`);
    }
    if (cldfData.isIsolate && !modified.isIsolate) {
      modified.isIsolate = true;
      changes.push('isIsolate: true');
    }
    if (cldfData.firstDoc && !modified.firstDocumented) {
      modified.firstDocumented = parseInt(cldfData.firstDoc, 10) || cldfData.firstDoc;
      changes.push(`firstDocumented: ${cldfData.firstDoc}`);
    }
    if (cldfData.lastDoc && !modified.lastDocumented) {
      modified.lastDocumented = parseInt(cldfData.lastDoc, 10) || cldfData.lastDoc;
      changes.push(`lastDocumented: ${cldfData.lastDoc}`);
    }
  }

  // ── Wikidata ──
  if (wikidataData) {
    // Native name — only set if not already present
    if (!modified.nativeName && wikidataData.nativeNames.size > 0) {
      // Pick the first native name (they're usually all valid endonyms)
      const names = [...wikidataData.nativeNames];
      modified.nativeName = names[0];
      if (names.length > 1) {
        modified.alternateNames = names.slice(1);
      }
      changes.push(`nativeName: ${names[0]}`);
    }

    // Speaker estimates — add Wikidata as a source, don't overwrite existing
    if (wikidataData.speakerCounts.size > 0) {
      if (!modified.speakerEstimates) modified.speakerEstimates = [];

      // Check if we already have a Wikidata estimate
      const hasWikidata = modified.speakerEstimates.some(e => e.source === 'wikidata');
      if (!hasWikidata) {
        // Wikidata may have multiple values (L1, L2, total)
        // Take the maximum and minimum to show the range
        const counts = [...wikidataData.speakerCounts].sort((a, b) => a - b);
        const estimate = {
          source: 'wikidata',
          count: counts[counts.length - 1], // largest estimate
          date: ENRICHMENT_DATE,
        };
        if (counts.length > 1 && counts[0] !== counts[counts.length - 1]) {
          estimate.countRange = { min: counts[0], max: counts[counts.length - 1] };
          estimate.note = `Wikidata has ${counts.length} estimates: ${counts.map(c => c.toLocaleString()).join(', ')}`;
        }
        modified.speakerEstimates.push(estimate);
        changes.push(`speakers (wikidata): ${estimate.count.toLocaleString()}`);
      }
    }

    // Script — only set if not already present
    if (!modified.script && wikidataData.scripts.size > 0) {
      const scripts = [...wikidataData.scripts];
      // Map common Wikidata script names to ISO 15924 codes
      const scriptMapping = {
        'Latin script': 'Latn',
        'Arabic script': 'Arab',
        'Cyrillic script': 'Cyrl',
        'Devanagari': 'Deva',
        'Han characters': 'Hani',
        'Hangul': 'Hang',
        'Hiragana': 'Hira',
        'Katakana': 'Kana',
        'Thai script': 'Thai',
        'Georgian script': 'Geor',
        'Armenian script': 'Armn',
        'Hebrew script': 'Hebr',
        'Greek script': 'Grek',
        'Ethiopic script': 'Ethi',
        'Tibetan script': 'Tibt',
        'Canadian syllabics': 'Cans',
        'Bengali-Assamese script': 'Beng',
        'Tamil script': 'Taml',
        'Telugu script': 'Telu',
        'Kannada script': 'Knda',
        'Malayalam script': 'Mlym',
        'Gujarati script': 'Gujr',
        'Gurmukhi script': 'Guru',
        'Oriya script': 'Orya',
        'Sinhala script': 'Sinh',
        'Khmer script': 'Khmr',
        'Lao script': 'Laoo',
        'Myanmar script': 'Mymr',
        'Javanese script': 'Java',
        'Balinese script': 'Bali',
        'N\'Ko script': 'Nkoo',
        'Tifinagh': 'Tfng',
        'Cherokee syllabary': 'Cher',
        'Mongolian script': 'Mong',
      };

      // Find the first mappable script
      let mapped = null;
      for (const s of scripts) {
        for (const [wdName, isoCode] of Object.entries(scriptMapping)) {
          if (s.includes(wdName) || s === wdName) {
            mapped = isoCode;
            break;
          }
        }
        if (mapped) break;
      }

      if (mapped) {
        modified.script = mapped;
        changes.push(`script: ${mapped}`);
      }
    }

    // Writing direction
    if (!modified.dir && wikidataData.writingDir) {
      const dirMap = {
        'right-to-left': 'rtl',
        'left-to-right': 'ltr',
      };
      const dir = dirMap[wikidataData.writingDir.toLowerCase()];
      if (dir) {
        modified.dir = dir;
        changes.push(`dir: ${dir}`);
      }
    }
  }

  // ── Update data sources ──
  if (changes.length > 0) {
    if (!modified.dataSources) modified.dataSources = [];
    const newSources = [];
    if (aesData) newSources.push('glottolog-aes-5.3');
    if (cldfData) newSources.push('glottolog-cldf-5.3');
    if (wikidataData) newSources.push('wikidata');
    for (const src of newSources) {
      if (!modified.dataSources.includes(src)) {
        modified.dataSources.push(src);
      }
    }

    // Update _generated metadata
    if (modified._generated) {
      modified._generated.lastEnriched = ENRICHMENT_DATE;
      if (!modified._generated.sources) modified._generated.sources = [];
      for (const src of newSources) {
        if (!modified._generated.sources.includes(src)) {
          modified._generated.sources.push(src);
        }
      }
    }
  }

  return { card: modified, changes };
}


// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Champollion Card Enrichment Pipeline');
  console.log('  Sources: Glottolog AES + CLDF + Wikidata SPARQL');
  console.log('  Principle: MERGE only. Never overwrite curated data.');
  if (ONLY_GLOTTOCODES) {
    console.log(`  Scope: --only-glottocodes (${ONLY_GLOTTOCODES.size.toLocaleString()} glottocodes; gates new vitality blocks)`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Load all card files ──
  console.log('Loading existing cards...');
  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  const cards = new Map();
  for (const filename of cardFiles) {
    const fp = path.join(CARDS_DIR, filename);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) continue;
    try {
      const card = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      if (card.code) {
        cards.set(card.code, { card, filename });
      }
    } catch (e) {
      // Skip invalid files
    }
  }
  console.log(`  Loaded ${cards.size} cards`);

  // Filter to single language if specified
  const targetCodes = SINGLE_LANG
    ? [SINGLE_LANG]
    : [...cards.keys()];

  // ── Phase 1: Load AES data ──
  let aesLookup = new Map(); // iso639_3 → aesData
  if (SOURCE === 'all' || SOURCE === 'aes') {
    console.log('\n── Phase 1: Glottolog AES Endangerment ──');
    const aesData = await loadAESData();
    console.log(`  Loaded ${aesData.size} AES entries`);

    const glottocodeToIso = await buildGlottocodeToIsoMap();
    console.log(`  Glottocode→ISO map: ${glottocodeToIso.size} entries`);

    // Build iso639_3 → aesData lookup
    for (const [glottocode, aes] of aesData) {
      const iso = glottocodeToIso.get(glottocode);
      if (iso) {
        aesLookup.set(iso, aes);
      }
    }
    console.log(`  AES data mapped to ${aesLookup.size} ISO 639-3 codes`);

    // Stats
    const statusCounts = {};
    for (const aes of aesLookup.values()) {
      const label = AES_TO_VITALITY[aes.aesCode]?.label || aes.aesCode;
      statusCounts[label] = (statusCounts[label] || 0) + 1;
    }
    console.log('  Distribution:');
    for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${status}: ${count.toLocaleString()}`);
    }
  }

  // ── Phase 2: Load CLDF languages ──
  let cldfLookup = new Map(); // iso639_3 → cldfData
  if (SOURCE === 'all' || SOURCE === 'cldf') {
    console.log('\n── Phase 2: Glottolog CLDF Languages ──');
    const cldfData = await loadCLDFLanguages();
    console.log(`  Loaded ${cldfData.size} CLDF language entries`);

    // Build iso639_3 → cldfData lookup using the ISO code from CLDF
    for (const [glottocode, data] of cldfData) {
      if (data.isoCode) {
        cldfLookup.set(data.isoCode, data);
      }
    }
    console.log(`  CLDF data mapped to ${cldfLookup.size} ISO 639-3 codes`);
  }

  // ── Phase 3: Wikidata SPARQL ──
  let wikidataLookup = new Map(); // iso639_3 → wikidataData
  if (SOURCE === 'all' || SOURCE === 'wikidata') {
    console.log('\n── Phase 3: Wikidata SPARQL ──');

    // Only query codes that could benefit from enrichment
    // (skip codes that already have nativeName + speakerEstimates + script)
    const codesNeedingEnrichment = targetCodes.filter(code => {
      const entry = cards.get(code);
      if (!entry) return false;
      const c = entry.card;
      const hasNativeName = !!c.nativeName;
      const hasSpeakers = c.speakerEstimates?.length > 0;
      const hasScript = !!c.script;
      // Query if missing ANY of these fields
      return !hasNativeName || !hasSpeakers || !hasScript;
    });
    console.log(`  ${codesNeedingEnrichment.length} codes need Wikidata enrichment`);

    if (!STATS_ONLY && codesNeedingEnrichment.length > 0) {
      wikidataLookup = await queryWikidataAll(codesNeedingEnrichment);
      console.log(`  Wikidata returned data for ${wikidataLookup.size} languages`);
    }
  }

  if (STATS_ONLY) {
    console.log('\n  (--stats-only mode, stopping before merge)');
    return;
  }

  // ── Merge enrichment into cards ──
  console.log('\n── Merging enrichment data ──');
  let enrichedCount = 0;
  let unchangedCount = 0;
  let totalChanges = 0;

  const changeSummary = {
    vitality: 0,
    vitalityRepaired: 0,
    macroarea: 0,
    isIsolate: 0,
    nativeName: 0,
    speakers: 0,
    script: 0,
    dir: 0,
    firstDocumented: 0,
    lastDocumented: 0,
  };

  for (const code of targetCodes) {
    const entry = cards.get(code);
    if (!entry) continue;

    const aes = aesLookup.get(code) || null;
    const cldf = cldfLookup.get(code) || null;
    const wd = wikidataLookup.get(code) || null;

    // Skip if no enrichment data available for this code
    if (!aes && !cldf && !wd) {
      unchangedCount++;
      continue;
    }

    const { card: enriched, changes } = mergeEnrichment(entry.card, aes, cldf, wd);

    if (changes.length === 0) {
      unchangedCount++;
      continue;
    }

    enrichedCount++;
    totalChanges += changes.length;

    // Count change types for summary
    for (const change of changes) {
      if (change.startsWith('vitality repaired')) changeSummary.vitalityRepaired++;
      else if (change.startsWith('vitality:')) changeSummary.vitality++;
      else if (change.startsWith('macroarea:')) changeSummary.macroarea++;
      else if (change.startsWith('isIsolate:')) changeSummary.isIsolate++;
      else if (change.startsWith('nativeName:')) changeSummary.nativeName++;
      else if (change.startsWith('speakers')) changeSummary.speakers++;
      else if (change.startsWith('script:')) changeSummary.script++;
      else if (change.startsWith('dir:')) changeSummary.dir++;
      else if (change.startsWith('firstDocumented:')) changeSummary.firstDocumented++;
      else if (change.startsWith('lastDocumented:')) changeSummary.lastDocumented++;
    }

    // Write enriched card
    if (!DRY_RUN) {
      const outputPath = path.join(CARDS_DIR, entry.filename);
      fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2) + '\n', 'utf-8');
    }

    // Verbose logging for single-language mode
    if (SINGLE_LANG) {
      console.log(`  ${code}: ${changes.join(', ')}`);
    }

    // Progress every 500 cards
    if (enrichedCount % 500 === 0) {
      console.log(`  ... enriched ${enrichedCount.toLocaleString()} cards so far`);
    }
  }

  // ── Summary ──
  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards enriched:        ${enrichedCount.toLocaleString()}`);
  console.log(`  Cards unchanged:       ${unchangedCount.toLocaleString()}`);
  console.log(`  Total fields added:    ${totalChanges.toLocaleString()}`);
  console.log('');
  console.log('  Fields added by type:');
  console.log(`    Vitality/AES:        ${changeSummary.vitality.toLocaleString()}`);
  console.log(`    Vitality repaired:   ${changeSummary.vitalityRepaired.toLocaleString()}`);
  console.log(`    Macroarea:           ${changeSummary.macroarea.toLocaleString()}`);
  console.log(`    Isolate flag:        ${changeSummary.isIsolate.toLocaleString()}`);
  console.log(`    Native name:         ${changeSummary.nativeName.toLocaleString()}`);
  console.log(`    Speaker estimates:   ${changeSummary.speakers.toLocaleString()}`);
  console.log(`    Script:              ${changeSummary.script.toLocaleString()}`);
  console.log(`    Writing direction:   ${changeSummary.dir.toLocaleString()}`);
  console.log(`    First documented:    ${changeSummary.firstDocumented.toLocaleString()}`);
  console.log(`    Last documented:     ${changeSummary.lastDocumented.toLocaleString()}`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DONE');
  if (DRY_RUN) console.log('  (Dry run — no files were written)');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Only run when executed directly (mergeEnrichment is importable for tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
