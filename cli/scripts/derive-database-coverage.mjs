#!/usr/bin/env node

/**
 * derive-database-coverage.mjs
 * ────────────────────────────────────────────────────────────────
 * Computes the `databaseCoverage` field for each language card by
 * cross-referencing the card's code/glottocode against all local
 * databases (Grambank, WALS, PHOIBLE, CLDR, OPUS, LinguaMeta,
 * Glottolog, ElCat, etc.).
 *
 * MAXIMIN RATIONALE:
 *   Knowing WHICH databases cover a language is critical for
 *   researchers working with low-resource languages. A card with
 *   databaseCoverage: {grambank: true, wals: true, phoible: false}
 *   immediately tells a researcher where to look for more data.
 *
 * WHAT THIS COMPUTES:
 *   databaseCoverage: {
 *     grambank: true/false,
 *     wals: true/false,
 *     phoible: true/false,
 *     cldr: true/false,
 *     opus: true/false,
 *     linguameta: true/false,
 *     glottolog: true/false,
 *     universalDependencies: true/false,
 *     commonVoice: true/false,
 *     totalDatabases: <number>
 *   }
 *
 * SEMANTICS — RECOMPUTE, with per-database preservation:
 *   The whole databaseCoverage object is owned by this script and is
 *   recomputed on every run (the former skip-if-present behavior
 *   could never heal flags computed against a corrupt or truncated
 *   snapshot — see the 2026-07-19 cldf-languages.csv truncation).
 *   Per database key:
 *     - snapshot PRESENT → the flag is recomputed from it;
 *     - snapshot ABSENT  → the card's existing flag is PRESERVED and
 *       the absence is reported loudly (a missing gitignored dump is
 *       not evidence the upstream dropped the language — never
 *       silently flip true→false on missing inputs);
 *     - a present file MISSING an expected column is a hard error.
 *   opus / universalDependencies / commonVoice always recompute from
 *   the card's own corpusAvailability / digitalPresence fields.
 *
 * CSV parsing goes through lib/csv.mjs (RFC-4180, fail-loud on
 * ragged or truncated input) — never line-based.
 *
 * Usage:
 *   node scripts/derive-database-coverage.mjs
 *   node scripts/derive-database-coverage.mjs --dry-run
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSVObjects } from './lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const DATA_DIR = path.join(CLI_ROOT, 'data');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Read a CSV via lib/csv.mjs and extract the set of non-empty values
 * of one or more columns. Returns { present, sets } where sets is a
 * Map columnName → Set. Missing FILE → present:false (caller decides
 * how to report). Missing COLUMN in a present file → hard error.
 */
function loadCsvColumns(filePath, columnNames) {
  if (!fs.existsSync(filePath)) return { present: false, sets: new Map() };

  const content = fs.readFileSync(filePath, 'utf-8');
  const { header, rows } = parseCSVObjects(content, { file: path.relative(CLI_ROOT, filePath) });
  const sets = new Map();
  for (const col of columnNames) {
    if (!header.includes(col)) {
      throw new Error(`${path.relative(CLI_ROOT, filePath)}: missing expected column '${col}'`);
    }
    sets.set(col, new Set());
  }
  for (const row of rows) {
    for (const col of columnNames) {
      const val = (row[col] || '').trim();
      if (val && val !== 'NA') sets.get(col).add(val);
    }
  }
  return { present: true, sets };
}

/**
 * Load TSV (tab-separated, no quoting convention — NOT RFC-4180 CSV,
 * so lib/csv.mjs does not apply) and extract a set of values from a
 * given column. Missing column in a present file → hard error.
 */
function loadTsvColumn(filePath, columnName) {
  if (!fs.existsSync(filePath)) return { present: false, codes: new Set() };

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const headers = lines[0].split('\t');
  const idx = headers.indexOf(columnName);
  if (idx === -1) {
    throw new Error(`${path.relative(CLI_ROOT, filePath)}: missing expected column '${columnName}'`);
  }

  const codes = new Set();
  for (let i = 1; i < lines.length; i++) {
    const val = lines[i].split('\t')[idx]?.trim();
    if (val) codes.add(val);
  }
  return { present: true, codes };
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Database Coverage Derivation');
  console.log('  Source: Cross-referenced from local database snapshots');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load database indices
  // Each database is indexed by the code type it uses
  console.log('  Loading database indices...');

  const preservedDatabases = [];

  // Grambank: indexed by Glottocode and ISO code
  const grambank = loadCsvColumns(
    path.join(DATA_DIR, 'grambank', 'languages.csv'), ['Glottocode', 'ISO639P3code']
  );
  const grambankGlotto = grambank.sets.get('Glottocode') || new Set();
  const grambankIso = grambank.sets.get('ISO639P3code') || new Set();
  if (!grambank.present) preservedDatabases.push('grambank');
  console.log(`    Grambank: ${grambank.present ? `${grambankGlotto.size} glottocodes, ${grambankIso.size} ISO codes` : 'SNAPSHOT ABSENT'}`);

  // WALS: indexed by Glottocode and ISO code
  const wals = loadCsvColumns(
    path.join(DATA_DIR, 'wals', 'languages.csv'), ['Glottocode', 'ISO639P3code']
  );
  const walsGlotto = wals.sets.get('Glottocode') || new Set();
  const walsIso = wals.sets.get('ISO639P3code') || new Set();
  if (!wals.present) preservedDatabases.push('wals');
  console.log(`    WALS: ${wals.present ? `${walsGlotto.size} glottocodes, ${walsIso.size} ISO codes` : 'SNAPSHOT ABSENT'}`);

  // PHOIBLE: raw data file, indexed by Glottocode and ISO6393
  // ('NA' cells are PHOIBLE's explicit not-available marker, filtered
  // by loadCsvColumns; values.csv is a 404 — phoible-raw.csv is the
  // real data)
  const phoible = loadCsvColumns(
    path.join(DATA_DIR, 'phoible', 'phoible-raw.csv'), ['Glottocode', 'ISO6393']
  );
  const phoibleGlotto = phoible.sets.get('Glottocode') || new Set();
  const phoibleIso = phoible.sets.get('ISO6393') || new Set();
  if (!phoible.present) preservedDatabases.push('phoible');
  console.log(`    PHOIBLE: ${phoible.present ? `${phoibleGlotto.size} glottocodes, ${phoibleIso.size} ISO codes` : 'SNAPSHOT ABSENT'}`);

  // LinguaMeta: indexed by ISO 639-3
  const linguameta = loadTsvColumn(
    path.join(DATA_DIR, 'linguameta', 'linguameta.tsv'), 'iso_639_3_code'
  );
  if (!linguameta.present) preservedDatabases.push('linguameta');
  console.log(`    LinguaMeta: ${linguameta.present ? `${linguameta.codes.size} ISO codes` : 'SNAPSHOT ABSENT'}`);

  // CLDR: locale JSON directory
  const cldrDir = path.join(DATA_DIR, 'cldr');
  const cldrPresent = fs.existsSync(cldrDir);
  const cldrCodes = new Set();
  if (cldrPresent) {
    for (const f of fs.readdirSync(cldrDir).filter(f => f.endsWith('.json'))) {
      // Extract language code from filename (e.g., 'fr.json' → 'fr')
      cldrCodes.add(f.replace('.json', ''));
    }
  } else {
    preservedDatabases.push('cldr');
  }
  console.log(`    CLDR: ${cldrPresent ? `${cldrCodes.size} locale codes` : 'SNAPSHOT ABSENT'}`);

  // Glottolog: indexed by Glottocode and ISO (from cldf-languages.csv)
  const glottolog = loadCsvColumns(
    path.join(DATA_DIR, 'glottolog', 'cldf-languages.csv'), ['Glottocode', 'ISO639P3code']
  );
  const glottologGlotto = glottolog.sets.get('Glottocode') || new Set();
  const glottologIso = glottolog.sets.get('ISO639P3code') || new Set();
  if (!glottolog.present) preservedDatabases.push('glottolog');
  console.log(`    Glottolog: ${glottolog.present ? `${glottologGlotto.size} glottocodes, ${glottologIso.size} ISO codes` : 'SNAPSHOT ABSENT'}`);

  if (preservedDatabases.length > 0) {
    console.log(`\n  ⚠️  ABSENT SNAPSHOTS — existing card flags PRESERVED, not recomputed: ${preservedDatabases.join(', ')}`);
    console.log('     (a missing local dump is not evidence of upstream non-coverage)');
  }

  console.log();

  // Process cards
  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let processed = 0;
  let modified = 0;
  const flips = {}; // key → { gained: n, lost: n }
  const dbCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 };

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { continue; }
    processed++;

    const iso = card.code;
    const glotto = card.glottocode;
    const prior = (card.databaseCoverage && typeof card.databaseCoverage === 'object')
      ? card.databaseCoverage : {};

    const coverage = {};

    coverage.grambank = grambank.present
      ? !!(grambankIso.has(iso) || (glotto && grambankGlotto.has(glotto)))
      : prior.grambank === true;
    coverage.wals = wals.present
      ? !!(walsIso.has(iso) || (glotto && walsGlotto.has(glotto)))
      : prior.wals === true;
    coverage.phoible = phoible.present
      ? !!(phoibleIso.has(iso) || (glotto && phoibleGlotto.has(glotto)))
      : prior.phoible === true;
    coverage.cldr = cldrPresent
      ? !!(cldrCodes.has(iso) || cldrCodes.has(card.iso639_1))
      : prior.cldr === true;
    coverage.linguameta = linguameta.present
      ? !!linguameta.codes.has(iso)
      : prior.linguameta === true;
    coverage.glottolog = glottolog.present
      ? !!(glottologIso.has(iso) || (glotto && glottologGlotto.has(glotto)))
      : prior.glottolog === true;

    // OPUS and UD from card data (already populated by other scripts)
    coverage.opus = !!(card.corpusAvailability?.opus);
    coverage.universalDependencies = !!(card.corpusAvailability?.ud);
    coverage.commonVoice = !!(card.digitalPresence?.commonVoice);

    // Total count
    coverage.totalDatabases = Object.values(coverage)
      .filter(v => v === true).length;

    // Track flips per key against the prior object
    for (const key of Object.keys(coverage)) {
      if (key === 'totalDatabases') continue;
      const before = prior[key] === true;
      const after = coverage[key] === true;
      if (before !== after) {
        if (!flips[key]) flips[key] = { gained: 0, lost: 0 };
        if (after) flips[key].gained++;
        else flips[key].lost++;
      }
    }

    const beforeJson = JSON.stringify(card);
    card.databaseCoverage = coverage;

    // Source attribution
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.databaseCoverage = 'derived-from-local-database-snapshots';

    // Track distribution
    const total = coverage.totalDatabases;
    if (total >= 6) dbCounts['6+']++;
    else dbCounts[total]++;

    if (JSON.stringify(card) !== beforeJson) {
      modified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  console.log(`  RESULTS:`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Cards processed:              ${processed.toLocaleString()}`);
  console.log(`  Cards modified:               ${modified.toLocaleString()}`);
  if (preservedDatabases.length > 0) {
    console.log(`  Preserved (absent snapshots): ${preservedDatabases.join(', ')}`);
  }
  console.log();
  console.log('  Flag flips vs prior values:');
  const flipKeys = Object.keys(flips).sort();
  if (flipKeys.length === 0) {
    console.log('    (none)');
  }
  for (const key of flipKeys) {
    console.log(`    ${key.padEnd(22)} +${flips[key].gained.toLocaleString()} gained, -${flips[key].lost.toLocaleString()} lost`);
  }
  console.log();
  console.log('  Database coverage distribution:');
  for (const [count, cards] of Object.entries(dbCounts)) {
    const bar = '█'.repeat(Math.ceil(cards / 100));
    console.log(`    ${count} databases: ${cards.toString().padStart(5)} ${bar}`);
  }
  if (DRY_RUN) console.log('\n  ℹ  DRY RUN — no files were modified');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
