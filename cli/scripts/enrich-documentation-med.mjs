#!/usr/bin/env node

/**
 * enrich-documentation-med.mjs
 * ────────────────────────────────────────────────────────────────
 * Enriches the hollow `documentationDepth` field on language cards
 * with actual AES (Agglomerated Endangerment Status), MED (Most
 * Extensive Description), and documentation year ranges from
 * Glottolog CLDF.
 *
 * PROBLEM:
 *   The earlier enrich-documentation-depth.mjs script set
 *   documentationDepth to just `{ source: 'glottolog-5.3' }`
 *   because languoid.csv lacks bibliography/AES/MED details.
 *   This script fills in the actual depth data from three sources.
 *
 * DATA SOURCES:
 *   1. AES values — data/glottolog/aes-values.csv
 *      Columns: ID, Language_ID, Parameter_ID, Value, Code_ID, ...
 *      - Language_ID = glottocode
 *      - Value = AES level (1-6 scale)
 *      - Code_ID = e.g. "aes-not_endangered", "aes-shifting"
 *      AES scale:
 *        1 = not endangered
 *        2 = threatened
 *        3 = shifting
 *        4 = moribund
 *        5 = nearly extinct
 *        6 = extinct
 *
 *   2. CLDF languages — data/glottolog/cldf-languages.csv
 *      Columns include: Glottocode, First_Year_Of_Documentation,
 *                        Last_Year_Of_Documentation
 *
 *   3. CLDF values — data/glottolog/cldf-values.csv
 *      Columns: ID, Language_ID, Parameter_ID, Value, Code_ID, ...
 *      Filtered to Parameter_ID === 'med'
 *      - Language_ID = glottocode
 *      - Value = MED level (0-4 scale, 0 = most extensive)
 *      - Code_ID = e.g. "med-grammar", "med-long_grammar"
 *      MED scale:
 *        0 = long_grammar   (most extensive)
 *        1 = grammar
 *        2 = grammar_sketch
 *        3 = phonology_or_text
 *        4 = wordlist_or_less (least extensive)
 *
 * WHAT THIS SCRIPT POPULATES:
 *   Updates cards where documentationDepth is hollow (only has
 *   { source }) or is missing MED data, by merging in:
 *     {
 *       aesStatus: "shifting",        // from aes-values Code_ID
 *       aesLevel: 3,                  // numeric AES Value (1-6)
 *       med: "grammar",              // from cldf-values Code_ID
 *       medLevel: 1,                  // numeric MED Value (0-4)
 *       firstDocumented: 1850,        // from cldf-languages.csv
 *       lastDocumented: 2020,         // from cldf-languages.csv
 *       source: "glottolog-5.3"       // retained
 *     }
 *
 * MATCHING STRATEGY:
 *   AES data:   card.glottocode → aes-values Language_ID
 *   MED data:   card.glottocode → cldf-values Language_ID (med rows)
 *   CLDF years: card.glottocode → cldf-languages Glottocode
 *   Falls back to card.iso639_3/code → cldf-languages ISO639P3code
 *
 * IDEMPOTENCY:
 *   Merge-only — preserves existing fields, only adds missing ones.
 *   Cards already fully populated are skipped.
 *   Safe to re-run.
 *
 * SCOPING:
 *   --only-glottocodes <file> restricts enrichment to cards whose
 *   glottocode appears in the file (one per line). Used for the
 *   2026-07-19 AES corruption repair: aes-values.csv historically
 *   carried an accidental 2,584-glottocode subset of Glottolog 5.3's
 *   8,672 AES records, and a parser defect additionally dropped
 *   ~1,300 of those from cards. The repair backfilled within the
 *   historical coverage; the same-day founder decision then expanded
 *   card coverage to the full AES table via an unscoped run. The flag
 *   remains for targeted re-runs.
 *
 * Usage:
 *   node scripts/enrich-documentation-med.mjs              # all cards
 *   node scripts/enrich-documentation-med.mjs --dry-run    # preview
 *   node scripts/enrich-documentation-med.mjs --lang crk   # single card
 *   node scripts/enrich-documentation-med.mjs --only-glottocodes list.txt
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

const DRY_RUN = process.argv.includes('--dry-run');
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


// ═══════════════════════════════════════════════════════════════
//  AES Data Loader
//  Builds a map: glottocode → { aesStatus, aesLevel }
//  from the aes-values.csv file. Parsed with the shared RFC-4180
//  reader — AES comments contain multi-line quoted text, which
//  line-based parsing silently corrupts.
// ═══════════════════════════════════════════════════════════════

function loadAESData() {
  const csvPath = path.join(DATA_DIR, 'glottolog', 'aes-values.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('  ❌ AES values file not found at data/glottolog/aes-values.csv');
    console.error('     Run: node scripts/download-glottolog-med.mjs, then scripts/derive-aes-values.mjs');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const { header, rows } = parseCSVObjects(content, { file: 'aes-values.csv' });

  // Validate expected columns
  const requiredCols = ['Language_ID', 'Value', 'Code_ID'];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      console.error(`  ❌ Missing expected column '${col}' in aes-values.csv`);
      process.exit(1);
    }
  }

  // Map: glottocode → { aesStatus, aesLevel }
  const aesMap = new Map();

  for (const row of rows) {
    const glottocode = (row.Language_ID || '').trim();
    const rawValue = (row.Value || '').trim();
    const codeId = (row.Code_ID || '').trim();

    if (!glottocode || !rawValue) continue;

    const aesLevel = parseInt(rawValue, 10);
    if (isNaN(aesLevel)) continue;

    // Strip 'aes-' prefix from Code_ID to get the status label
    // e.g. "aes-not_endangered" → "not_endangered"
    const aesStatus = codeId ? codeId.replace(/^aes-/, '') : null;

    aesMap.set(glottocode, { aesStatus, aesLevel });
  }

  console.log(`  AES entries loaded:        ${aesMap.size.toLocaleString()}`);
  return aesMap;
}


// ═══════════════════════════════════════════════════════════════
//  CLDF Languages Loader
//  Builds a map: glottocode → { firstDocumented, lastDocumented }
//  Also builds an ISO fallback: iso639P3code → same object
//  from the cldf-languages.csv file.
// ═══════════════════════════════════════════════════════════════

function loadCLDFLanguages() {
  const csvPath = path.join(DATA_DIR, 'glottolog', 'cldf-languages.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('  ❌ CLDF languages file not found at data/glottolog/cldf-languages.csv');
    console.error('     Run: node scripts/download-glottolog-med.mjs first');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const { header, rows } = parseCSVObjects(content, { file: 'cldf-languages.csv' });

  if (!header.includes('Glottocode')) {
    console.error('  ❌ Missing Glottocode column in cldf-languages.csv');
    process.exit(1);
  }
  const hasFirstYear = header.includes('First_Year_Of_Documentation');
  const hasLastYear = header.includes('Last_Year_Of_Documentation');
  if (!hasFirstYear && !hasLastYear) {
    console.warn('  ⚠ No First/Last_Year_Of_Documentation columns found');
    console.warn('     Documentation years will not be populated');
    return { glottoMap: new Map(), isoMap: new Map() };
  }

  // Map: glottocode → { firstDocumented, lastDocumented }
  const glottoMap = new Map();
  // Fallback: iso639P3code → same object
  const isoMap = new Map();

  let entriesWithYears = 0;

  for (const row of rows) {
    const glottocode = (row.Glottocode || '').trim();
    if (!glottocode) continue;

    const firstYearRaw = hasFirstYear ? (row.First_Year_Of_Documentation || '').trim() : '';
    const lastYearRaw = hasLastYear ? (row.Last_Year_Of_Documentation || '').trim() : '';

    // Parse years — they can be negative (e.g. -3100 for Sumerian)
    const firstDocumented = firstYearRaw ? parseInt(firstYearRaw, 10) : null;
    const lastDocumented = lastYearRaw ? parseInt(lastYearRaw, 10) : null;

    // Only store if at least one year is present
    if (firstDocumented !== null || lastDocumented !== null) {
      const entry = {};
      if (firstDocumented !== null && !isNaN(firstDocumented)) {
        entry.firstDocumented = firstDocumented;
      }
      if (lastDocumented !== null && !isNaN(lastDocumented)) {
        entry.lastDocumented = lastDocumented;
      }

      glottoMap.set(glottocode, entry);
      entriesWithYears++;

      // Also index by ISO code for fallback matching
      const iso = (row.ISO639P3code || '').trim();
      if (iso) {
        isoMap.set(iso, entry);
      }
    }
  }

  console.log(`  CLDF language rows:        ${rows.length.toLocaleString()}`);
  console.log(`  Entries with year data:    ${entriesWithYears.toLocaleString()}`);
  return { glottoMap, isoMap };
}


// ═══════════════════════════════════════════════════════════════
//  MED Data Loader
//  Builds a map: glottocode → { med, medLevel }
//  from the cldf-values.csv file, filtered to Parameter_ID=med.
//  MED = Most Extensive Description — what kind of documentation
//  exists for a language (grammar, sketch, wordlist, etc.).
// ═══════════════════════════════════════════════════════════════

function loadMEDData() {
  const csvPath = path.join(DATA_DIR, 'glottolog', 'cldf-values.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('  ⚠ CLDF values file not found at data/glottolog/cldf-values.csv');
    console.warn('     MED data will not be populated.');
    console.warn('     Run: node scripts/download-glottolog-med.mjs to download it.');
    return new Map();
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  // cldf-values.csv is large (~20MB); the shared RFC-4180 reader handles
  // it in a single pass. Records must be parsed whole — several AES
  // comments span multiple physical lines, which breaks any line-based
  // shortcut (including "fast" prefilters).
  const { header, rows } = parseCSVObjects(content, { file: 'cldf-values.csv' });

  // Validate expected columns
  const requiredCols = ['Language_ID', 'Parameter_ID', 'Value', 'Code_ID'];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      console.error(`  ❌ Missing expected column '${col}' in cldf-values.csv`);
      process.exit(1);
    }
  }

  // Map: glottocode → { med, medLevel }
  const medMap = new Map();

  for (const row of rows) {
    // Only process MED parameter rows
    if (row.Parameter_ID !== 'med') continue;

    const glottocode = (row.Language_ID || '').trim();
    const rawValue = (row.Value || '').trim();
    const codeId = (row.Code_ID || '').trim();

    if (!glottocode) continue;

    const medLevel = rawValue !== '' ? parseInt(rawValue, 10) : null;

    // Strip 'med-' prefix from Code_ID to get the description type
    // e.g. "med-grammar" → "grammar", "med-long_grammar" → "long_grammar"
    const med = codeId ? codeId.replace(/^med-/, '') : null;

    medMap.set(glottocode, {
      med,
      medLevel: (medLevel !== null && !isNaN(medLevel)) ? medLevel : null,
    });
  }

  console.log(`  MED entries loaded:        ${medMap.size.toLocaleString()}`);
  return medMap;
}


// ═══════════════════════════════════════════════════════════════
//  Needs-Enrichment Check
//  Determines if a card's documentationDepth needs updating.
//  A card needs enrichment if:
//    1. It's "hollow" — only has { source: 'glottolog-5.3' }
//    2. It has partial data (e.g. AES but no MED) and MED data
//       is available
// ═══════════════════════════════════════════════════════════════

function isHollowDocDepth(docDepth) {
  if (!docDepth || typeof docDepth !== 'object') return false;

  const keys = Object.keys(docDepth);
  // Hollow = has exactly one key "source" with value "glottolog-5.3"
  return keys.length === 1 && keys[0] === 'source' && docDepth.source === 'glottolog-5.3';
}

/**
 * Check if a card is missing MED data but could receive it.
 * This catches cards from the previous run that got AES/years but not MED.
 */
function isMissingMED(docDepth) {
  if (!docDepth || typeof docDepth !== 'object') return false;
  if (docDepth.source !== 'glottolog-5.3') return false;

  // Has some data (not hollow) but no MED field yet
  return Object.keys(docDepth).length > 1 && !('med' in docDepth);
}

/**
 * Check if a card is missing AES data but could receive it.
 * Catches cards from runs against the corrupt pre-2026-07-19
 * aes-values.csv, whose parser collapse silently dropped the AES
 * entries of ~1,300 glottocodes (cards got MED/years but no aesStatus).
 */
function isMissingAES(docDepth) {
  if (!docDepth || typeof docDepth !== 'object') return false;
  if (docDepth.source !== 'glottolog-5.3') return false;

  return Object.keys(docDepth).length > 1 && !('aesStatus' in docDepth);
}


// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Documentation Depth MED Enrichment');
  console.log('  Sources: Glottolog 5.3 aes-values + cldf-languages + cldf-values');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  if (ONLY_GLOTTOCODES) {
    console.log(`  Scope: --only-glottocodes (${ONLY_GLOTTOCODES.size.toLocaleString()} glottocodes)`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Loading data sources...');
  const aesMap = loadAESData();
  const { glottoMap: yearGlottoMap, isoMap: yearIsoMap } = loadCLDFLanguages();
  const medMap = loadMEDData();

  // ── Gather card files ──
  let cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  if (SINGLE_LANG) {
    const target = `${SINGLE_LANG}.json`;
    if (!cardFiles.includes(target)) {
      console.error(`\nERROR: Card not found: ${target}`);
      process.exit(1);
    }
    cardFiles = [target];
  }

  // ── Counters ──
  let cardsProcessed = 0;
  let cardsModified = 0;
  let cardsSkippedNull = 0;     // documentationDepth is null (no Glottolog match)
  let cardsSkippedComplete = 0; // already has all available data
  let cardsScopedOut = 0;       // excluded by --only-glottocodes
  let cardsHollow = 0;          // hollow placeholder found
  let cardsMedBackfill = 0;     // had data but missing MED (backfill)
  let cardsAesBackfill = 0;     // had data but missing AES (backfill)
  let aesMatched = 0;
  let medMatched = 0;
  let yearsMatched = 0;
  let yearsMatchedByIso = 0;    // matched via ISO fallback
  let noDataAvailable = 0;      // needs data but no AES, MED, or year data found

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue; // skip malformed JSON
    }

    cardsProcessed++;

    const docDepth = card.documentationDepth;

    // Skip cards with null documentationDepth (not in Glottolog)
    if (docDepth === null || docDepth === undefined) {
      cardsSkippedNull++;
      continue;
    }

    const hollow = isHollowDocDepth(docDepth);
    const missingMed = isMissingMED(docDepth);
    const missingAes = isMissingAES(docDepth);

    // Skip cards that already have complete data
    if (!hollow && !missingMed && !missingAes) {
      cardsSkippedComplete++;
      continue;
    }

    const glottocode = card.glottocode;
    const iso = card.iso639_3 || card.code;

    // ── Scope guard (--only-glottocodes) ──
    if (ONLY_GLOTTOCODES && (!glottocode || !ONLY_GLOTTOCODES.has(glottocode))) {
      cardsScopedOut++;
      continue;
    }

    if (hollow) cardsHollow++;
    if (missingMed && !hollow) cardsMedBackfill++;
    if (missingAes && !hollow) cardsAesBackfill++;

    // ── Look up AES data by glottocode ──
    const aesEntry = glottocode ? aesMap.get(glottocode) : null;

    // ── Look up MED data by glottocode ──
    const medEntry = glottocode ? medMap.get(glottocode) : null;

    // ── Look up documentation years ──
    // Primary: by glottocode from CLDF languages
    // Fallback: by ISO 639-3 code
    let yearEntry = null;
    let yearMatchMethod = null;

    if (glottocode && yearGlottoMap.has(glottocode)) {
      yearEntry = yearGlottoMap.get(glottocode);
      yearMatchMethod = 'glottocode';
    } else if (iso && yearIsoMap.has(iso)) {
      yearEntry = yearIsoMap.get(iso);
      yearMatchMethod = 'iso';
    }

    // What could this card actually receive? (merge-only: never overwrite)
    const wouldAddAes = !!aesEntry && !docDepth.aesStatus;
    const wouldAddMed = !!medEntry && !('med' in docDepth);
    const wouldAddYears = !!yearEntry &&
      docDepth.firstDocumented === undefined && docDepth.lastDocumented === undefined;

    if (!wouldAddAes && !wouldAddMed && !wouldAddYears) {
      noDataAvailable++;
      continue;
    }

    // ── Build enriched documentationDepth ──
    // Start from existing data for backfill cases, or fresh for hollow
    const enriched = hollow ? {} : { ...docDepth };

    if (wouldAddAes) {
      if (aesEntry.aesStatus) enriched.aesStatus = aesEntry.aesStatus;
      if (aesEntry.aesLevel) enriched.aesLevel = aesEntry.aesLevel;
      aesMatched++;
    }

    if (wouldAddMed) {
      if (medEntry.med) enriched.med = medEntry.med;
      if (medEntry.medLevel !== null) enriched.medLevel = medEntry.medLevel;
      medMatched++;
    }

    if (wouldAddYears) {
      if (yearEntry.firstDocumented !== undefined) {
        enriched.firstDocumented = yearEntry.firstDocumented;
      }
      if (yearEntry.lastDocumented !== undefined) {
        enriched.lastDocumented = yearEntry.lastDocumented;
      }
      yearsMatched++;
      if (yearMatchMethod === 'iso') yearsMatchedByIso++;
    }

    // Retain the source attribution
    enriched.source = 'glottolog-5.3';

    // ── Merge into card ──
    card.documentationDepth = enriched;

    // Track provenance
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.documentationDepth = 'glottolog-5.3';

    // Update dataSources if needed
    const sources = Array.isArray(card.dataSources) ? card.dataSources : [];
    if (!sources.includes('glottolog-5.3')) {
      sources.push('glottolog-5.3');
    }
    card.dataSources = sources;

    cardsModified++;
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  // ── Report ──
  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards processed:             ${cardsProcessed.toLocaleString()}`);
  console.log(`  Cards modified:              ${cardsModified.toLocaleString()}`);
  console.log(`  ─── Skipped ───`);
  console.log(`  documentationDepth null:     ${cardsSkippedNull.toLocaleString()}`);
  console.log(`  Already complete:            ${cardsSkippedComplete.toLocaleString()}`);
  if (ONLY_GLOTTOCODES) {
    console.log(`  Outside --only-glottocodes:  ${cardsScopedOut.toLocaleString()}`);
  }
  console.log(`  No data available:           ${noDataAvailable.toLocaleString()}`);
  console.log(`  ─── Matched ───`);
  console.log(`  Hollow placeholders found:   ${cardsHollow.toLocaleString()}`);
  console.log(`  MED backfill candidates:     ${cardsMedBackfill.toLocaleString()}`);
  console.log(`  AES backfill candidates:     ${cardsAesBackfill.toLocaleString()}`);
  console.log(`  AES status merged:           ${aesMatched.toLocaleString()}`);
  console.log(`  MED type merged:             ${medMatched.toLocaleString()}`);
  console.log(`  Documentation years merged:  ${yearsMatched.toLocaleString()}`);
  console.log(`    ↳ via ISO fallback:        ${yearsMatchedByIso.toLocaleString()}`);
  if (DRY_RUN) {
    console.log('\n  ℹ  DRY RUN — no files were modified');
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
