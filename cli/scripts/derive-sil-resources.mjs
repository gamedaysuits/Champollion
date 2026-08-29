#!/usr/bin/env node

/**
 * derive-sil-resources.mjs
 * ────────────────────────────────────────────────────────────────
 * Merges the curated SIL / OLAC / eBible resource register
 * (shared/curated-sil-resources.json — Sambalic cluster, Aeta pilot)
 * into the schematized `resources` buckets of the named language
 * cards: corpora / dictionaries / grammars / tools / lexical.
 *
 * This is resource EXISTENCE only (language-card boundary invariant
 * kind 2): names, URLs, types, documented flags. No content is
 * copied (scripture stays pointer-only — © Wycliffe Inc.; SIL PDFs
 * stay on sil.org), and no measured scores may appear (lint R3/R4).
 * Every register entry cites the SIL REAP archive item / OLAC index /
 * eBible page it was verified from — index, not arbiter.
 *
 * SHAPE HANDLING (same rule as derive-dictionaries.mjs):
 *   resources object  → merge the register buckets
 *   resources null    → create `resources = { ...buckets }`
 *   resources array   → SKIPPED loudly (legacy flat-array shape;
 *     the object migration belongs to derive-resources-from-coverage
 *     .mjs — this script never invents bucket semantics).
 *
 * IDEMPOTENCY / OWNERSHIP:
 *   Register entries are keyed by (bucket, url || name/title).
 *   On every run the register's own entries are regenerated wholesale
 *   from the register (fix-at-the-generator doctrine); entries NOT
 *   produced by this run — ABVD, Glottolog grammars, future curation,
 *   derive-dictionaries.mjs promotions — are preserved untouched.
 *
 * PROVENANCE:
 *   _fieldSources['resources.<bucket>'] names this register for each
 *   bucket the register touches on that card, and the register id
 *   'curated-sil-resources' is appended to the card's dataSources[].
 *   Per-entry provenance lives in each entry's source/notes string.
 *
 * Usage:
 *   node scripts/derive-sil-resources.mjs              # all register langs
 *   node scripts/derive-sil-resources.mjs --dry-run    # preview
 *   node scripts/derive-sil-resources.mjs --lang abc   # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const REGISTER_PATH = path.join(CLI_ROOT, 'shared', 'curated-sil-resources.json');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const DATA_SOURCE_ID = 'curated-sil-resources';
const FIELD_SOURCE_STAMP =
  'curated-sil-resources.json (SIL REAP / OLAC / eBible.org — resource existence only, per-entry citations inline)';

/** Buckets the register may carry, in card order. */
const BUCKETS = ['corpora', 'dictionaries', 'grammars', 'tools', 'lexical'];

/** Identity key for an entry within a bucket: url wins, else name/title. */
function entryKey(e) {
  if (!e || typeof e !== 'object') return null;
  if (typeof e.url === 'string' && e.url.trim()) return `url:${e.url.trim().toLowerCase()}`;
  const n = e.name ?? e.title;
  return typeof n === 'string' && n.trim() ? `name:${n.trim().toLowerCase()}` : null;
}

function loadRegister() {
  if (!fs.existsSync(REGISTER_PATH)) {
    console.error(`  ❌ Missing ${path.relative(CLI_ROOT, REGISTER_PATH)} — curated register not found`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf-8'));
  return data.resources || {};
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SIL/OLAC/eBible register → resources.{' + BUCKETS.join(',') + '}');
  console.log('  Register: shared/curated-sil-resources.json');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const register = loadRegister();
  let langs = Object.keys(register).sort();
  if (SINGLE_LANG) {
    if (!langs.includes(SINGLE_LANG)) {
      console.error(`\nERROR: --lang ${SINGLE_LANG} is not in the register (${langs.join(', ')})`);
      process.exit(1);
    }
    langs = [SINGLE_LANG];
  }

  let modified = 0;
  let skippedLegacyArray = 0;
  let missingCards = 0;
  let mergedEntries = 0;
  let preservedForeign = 0;

  for (const code of langs) {
    const filePath = path.join(CARDS_DIR, `${code}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`  ❌ ${code}: card not found — register names a card that does not exist`);
      missingCards++;
      continue;
    }
    const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (Array.isArray(card.resources)) {
      console.log(`  ⤺ ${code}: SKIPPED — legacy flat-array resources shape (object migration pending)`);
      skippedLegacyArray++;
      continue;
    }

    const before = JSON.stringify(card);
    if (!card.resources || typeof card.resources !== 'object') card.resources = {};

    const perLang = register[code];
    const touched = [];
    for (const bucket of BUCKETS) {
      const seeds = Array.isArray(perLang[bucket]) ? perLang[bucket] : null;
      if (!seeds || seeds.length === 0) continue;

      const seedKeys = new Set(seeds.map(entryKey).filter(Boolean));
      const existing = Array.isArray(card.resources[bucket]) ? card.resources[bucket] : [];
      const foreign = existing.filter(e => !seedKeys.has(entryKey(e)));
      preservedForeign += foreign.length;

      card.resources[bucket] = [...foreign, ...seeds];
      mergedEntries += seeds.length;
      touched.push(bucket);
    }

    if (touched.length > 0) {
      if (!card._fieldSources) card._fieldSources = {};
      for (const bucket of touched) {
        card._fieldSources[`resources.${bucket}`] = FIELD_SOURCE_STAMP;
      }
      if (!Array.isArray(card.dataSources)) card.dataSources = [];
      if (!card.dataSources.includes(DATA_SOURCE_ID)) card.dataSources.push(DATA_SOURCE_ID);
    }

    if (JSON.stringify(card) !== before) {
      modified++;
      console.log(`  ✓ ${code}: merged [${touched.join(', ')}]`);
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    } else {
      console.log(`  = ${code}: already current`);
    }
  }

  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Register languages:          ${langs.length}`);
  console.log(`  Cards modified this run:     ${modified}`);
  console.log(`  Register entries merged:     ${mergedEntries}`);
  console.log(`  Foreign entries preserved:   ${preservedForeign}`);
  console.log(`  SKIPPED (legacy array):      ${skippedLegacyArray}`);
  console.log(`  Missing cards:               ${missingCards}`);
  if (DRY_RUN) console.log('\n  ℹ  DRY RUN — no files were modified');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (missingCards > 0) process.exit(1);
}

main();
