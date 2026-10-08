#!/usr/bin/env node

/**
 * derive-aes-values.mjs
 * ────────────────────────────────────────────────────────────────
 * THE generator for data/glottolog/aes-values.csv — the AES
 * (Agglomerated Endangerment Status) subset of the Glottolog CLDF
 * values table, consumed by enrich-documentation-med.mjs and
 * enrich-cards-bulk.mjs.
 *
 * WHY THIS SCRIPT EXISTS (2026-07-19):
 *   aes-values.csv was originally produced by an ad-hoc line-based
 *   extraction (grep-style) over cldf/values.csv. Two defects
 *   resulted, both invisible to line-based consumers:
 *     1. TRUNCATION — 30 records whose quoted Comment spans multiple
 *        lines upstream were cut at their first physical line,
 *        leaving unterminated quoted fields (and dropping the
 *        Source/codeReference columns of those records).
 *     2. INCOMPLETENESS — the file carried only 2,584 of the 8,672
 *        AES records in glottolog-cldf v5.3 (an accidental subset
 *        with no principled definition).
 *   This script derives the file with a real CSV parser so multi-line
 *   comments survive, and fails loudly on ragged input.
 *
 * SOURCE:
 *   data/glottolog/cldf-values.csv — the glottolog-cldf v5.3 values
 *   table (download: node scripts/download-glottolog-med.mjs, which
 *   pins the v5.3 tag). Override with --from <path>.
 *
 * OUTPUT:
 *   data/glottolog/aes-values.csv — all Parameter_ID='aes' records,
 *   all 8 columns verbatim, RFC-4180 (multi-line quoted comments
 *   preserved). Same column order as upstream:
 *   ID,Language_ID,Parameter_ID,Value,Code_ID,Comment,Source,codeReference
 *
 * Usage:
 *   node scripts/derive-aes-values.mjs                # from data/glottolog/cldf-values.csv
 *   node scripts/derive-aes-values.mjs --from <path>  # from an explicit values.csv
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, serializeCSV } from './lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(CLI_ROOT, 'data');
const DEFAULT_SOURCE = path.join(DATA_DIR, 'glottolog', 'cldf-values.csv');
const OUTPUT_PATH = path.join(DATA_DIR, 'glottolog', 'aes-values.csv');

const SOURCE_PATH = (() => {
  const idx = process.argv.indexOf('--from');
  return idx !== -1 ? process.argv[idx + 1] : DEFAULT_SOURCE;
})();

const EXPECTED_COLUMNS = [
  'ID', 'Language_ID', 'Parameter_ID', 'Value', 'Code_ID', 'Comment', 'Source', 'codeReference',
];
// glottolog-cldf v5.3 carries 8,672 AES records; anything far below that
// means a truncated/partial source download.
const MIN_EXPECTED_RECORDS = 8000;

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Derive aes-values.csv from Glottolog CLDF values');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`  ❌ Source not found: ${SOURCE_PATH}`);
    console.error('     Run: node scripts/download-glottolog-med.mjs first');
    console.error('     (or pass --from <path-to-values.csv>)');
    process.exit(1);
  }

  console.log(`  Source: ${SOURCE_PATH}`);
  const content = fs.readFileSync(SOURCE_PATH, 'utf-8');
  const records = parseCSV(content, {
    file: path.basename(SOURCE_PATH),
    expectColumns: EXPECTED_COLUMNS.length,
  });

  const header = records[0];
  for (let i = 0; i < EXPECTED_COLUMNS.length; i++) {
    if (header[i] !== EXPECTED_COLUMNS[i]) {
      console.error(`  ❌ Unexpected header column ${i}: got ${JSON.stringify(header[i])}, expected ${JSON.stringify(EXPECTED_COLUMNS[i])}`);
      process.exit(1);
    }
  }

  const PARAM = 2, LANG = 1, VALUE = 3, CODE = 4, COMMENT = 5;
  const aesRecords = records.filter((r, i) => i > 0 && r[PARAM] === 'aes');

  // ── Sanity checks: fail loud rather than write a bad derivation ──
  if (aesRecords.length < MIN_EXPECTED_RECORDS) {
    console.error(`  ❌ Only ${aesRecords.length} AES records found (expected ≥ ${MIN_EXPECTED_RECORDS}).`);
    console.error('     The source values.csv looks partial/truncated — re-download it.');
    process.exit(1);
  }
  const seen = new Set();
  for (const r of aesRecords) {
    const gc = r[LANG];
    const value = parseInt(r[VALUE], 10);
    if (!gc) {
      console.error(`  ❌ AES record with empty Language_ID: ${JSON.stringify(r[0])}`);
      process.exit(1);
    }
    if (seen.has(gc)) {
      console.error(`  ❌ Duplicate AES record for glottocode ${gc}`);
      process.exit(1);
    }
    seen.add(gc);
    if (!(value >= 1 && value <= 6)) {
      console.error(`  ❌ AES record ${gc} has out-of-range Value ${JSON.stringify(r[VALUE])} (expected 1-6)`);
      process.exit(1);
    }
    if (!String(r[CODE]).startsWith('aes-')) {
      console.error(`  ❌ AES record ${gc} has unexpected Code_ID ${JSON.stringify(r[CODE])}`);
      process.exit(1);
    }
  }

  // ── Write + verify round-trip ──
  const out = serializeCSV([header, ...aesRecords]);
  fs.writeFileSync(OUTPUT_PATH, out, 'utf-8');

  const reparsed = parseCSV(fs.readFileSync(OUTPUT_PATH, 'utf-8'), {
    file: 'aes-values.csv (verify)',
    expectColumns: EXPECTED_COLUMNS.length,
  });
  if (reparsed.length !== aesRecords.length + 1) {
    console.error(`  ❌ Round-trip mismatch: wrote ${aesRecords.length} records, re-read ${reparsed.length - 1}`);
    process.exit(1);
  }

  // ── Summary ──
  const byCode = {};
  let multiline = 0;
  for (const r of aesRecords) {
    byCode[r[CODE]] = (byCode[r[CODE]] || 0) + 1;
    if (r[COMMENT].includes('\n')) multiline++;
  }
  console.log(`  Output: ${path.relative(CLI_ROOT, OUTPUT_PATH)}`);
  console.log(`  AES records:               ${aesRecords.length.toLocaleString()}`);
  console.log(`  Multi-line comments:       ${multiline.toLocaleString()}`);
  console.log('  By status:');
  for (const [code, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${code.padEnd(22)} ${n.toLocaleString()}`);
  }
  console.log('\n  ✅ Derivation verified (rectangular, unique glottocodes, round-trips)');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
