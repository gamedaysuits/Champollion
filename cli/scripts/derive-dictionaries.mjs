#!/usr/bin/env node

/**
 * derive-dictionaries.mjs
 * ────────────────────────────────────────────────────────────────
 * Populates the schematized `resources.dictionaries[]` field
 * (forge/DESIGN.md §7 card-schema addition #1) by PROMOTING
 * dictionary pointers that already live on the card in free-form
 * shapes:
 *
 *   1. `encyclopedic.resources.dictionaries[]` — hand-curated
 *      {name, url} pointers on ~40 launch cards.
 *   2. `resources.lexical[]` — machine-readable lexical databases
 *      (ABVD / NorthEuraLex, from the Lexibank enrichment) with
 *      on-card {name, description, url, source}.
 *
 * Flags (license / machineReadable / redistributable) come ONLY from
 * shared/curated-dictionary-flags.json (data-over-code, every entry
 * cites its basis) or from the entry's own nature (a Lexibank
 * `lexical-database` entry is by definition machine-readable CLDF).
 * Anything unknown is OMITTED, never guessed — index, not arbiter.
 *
 * This is resource EXISTENCE only (boundary invariant kind 2): names,
 * URLs, and redistribution flags. No dictionary content is copied
 * (CLAUDE.md Wolvengrey boundary), and no measured scores may appear
 * here (lint R3/R4).
 *
 * SHAPE HANDLING:
 *   resources object  → merge the `dictionaries` key
 *   resources null    → create `resources = { dictionaries: [...] }`
 *   resources array   → SKIPPED (legacy flat-array shape, ~3,100
 *     cards; migrating it belongs to derive-resources-from-coverage
 *     .mjs per the schema TODO — this script never invents bucket
 *     semantics). Skips are counted and reported, never silent.
 *
 * IDEMPOTENCY / OWNERSHIP:
 *   The field is regenerated wholesale from its seeds on every run
 *   (fix-at-the-generator doctrine). Entries whose name is not
 *   produced by this run are preserved (future curation survives);
 *   same-name entries are overwritten from seeds.
 *
 * PROVENANCE:
 *   _fieldSources['resources.dictionaries'] =
 *     'derived-from-card-fields (encyclopedic.resources.dictionaries,
 *      resources.lexical; flags: curated-dictionary-flags.json)'
 *   Per-entry `source` names the card field or source id the entry
 *   was promoted from. No new external source enters the card, so
 *   dataSources is left untouched.
 *
 * Usage:
 *   node scripts/derive-dictionaries.mjs              # all cards
 *   node scripts/derive-dictionaries.mjs --dry-run    # preview
 *   node scripts/derive-dictionaries.mjs --lang crk   # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const FLAGS_PATH = path.join(CLI_ROOT, 'shared', 'curated-dictionary-flags.json');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const FIELD_SOURCE_STAMP =
  'derived-from-card-fields (encyclopedic.resources.dictionaries, resources.lexical; flags: curated-dictionary-flags.json)';

/** Lexical-database entry names promotable as dictionary-shaped resources. */
const LEXICAL_DATABASE_NAMES = new Set(['ABVD', 'NorthEuraLex']);

function loadCuratedFlags() {
  if (!fs.existsSync(FLAGS_PATH)) {
    console.error(`  ❌ Missing ${path.relative(CLI_ROOT, FLAGS_PATH)} — curated flags register not found`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(FLAGS_PATH, 'utf-8'));
  return data.flags || {};
}

/** Case-insensitive substring lookup of curated flags for a dictionary name. */
function curatedFlagsFor(flagsByLang, code, name) {
  const perLang = flagsByLang[code];
  if (!perLang) return null;
  const lower = String(name).toLowerCase();
  for (const [substr, flags] of Object.entries(perLang)) {
    if (lower.includes(substr.toLowerCase())) return flags;
  }
  return null;
}

/** Build the seed entries for one card. Returns [] when it has none. */
function buildSeedEntries(card, flagsByLang) {
  const out = [];

  // ── Seed 1: encyclopedic.resources.dictionaries[] ──
  const enc = card.encyclopedic;
  const encRes = enc && typeof enc === 'object' && !Array.isArray(enc) ? enc.resources : null;
  const encDicts = encRes && typeof encRes === 'object' && !Array.isArray(encRes)
    ? encRes.dictionaries : null;
  if (Array.isArray(encDicts)) {
    for (const d of encDicts) {
      if (!d || typeof d !== 'object' || typeof d.name !== 'string' || !d.name.trim()) continue;
      const entry = { name: d.name };
      if (typeof d.url === 'string' && d.url.trim()) entry.url = d.url;
      if (typeof d.license === 'string' && d.license.trim()) entry.license = d.license;
      entry.source = 'encyclopedic.resources.dictionaries';
      out.push(entry);
    }
  }

  // ── Seed 2: dictionary-shaped resources.lexical[] entries ──
  const res = card.resources;
  const lexical = res && typeof res === 'object' && !Array.isArray(res) ? res.lexical : null;
  if (Array.isArray(lexical)) {
    for (const l of lexical) {
      if (!l || typeof l !== 'object' || typeof l.name !== 'string') continue;
      if (l.type !== 'lexical-database' || !LEXICAL_DATABASE_NAMES.has(l.name)) continue;
      const entry = { name: l.name };
      if (typeof l.url === 'string' && l.url.trim()) entry.url = l.url;
      // A Lexibank lexical-database entry is, by its published form, a
      // structured (CLDF) machine-readable database — that is the fact the
      // on-card entry asserts via type='lexical-database'.
      entry.machineReadable = true;
      entry.source = typeof l.source === 'string' && l.source ? l.source : 'resources.lexical';
      out.push(entry);
    }
  }

  // ── Curated flags (cited; see shared/curated-dictionary-flags.json) ──
  for (const entry of out) {
    const flags = curatedFlagsFor(flagsByLang, card.code, entry.name);
    if (!flags) continue;
    if (typeof flags.machineReadable === 'boolean') entry.machineReadable = flags.machineReadable;
    if (typeof flags.redistributable === 'boolean') entry.redistributable = flags.redistributable;
    if (typeof flags.license === 'string' && flags.license.trim()) entry.license = flags.license;
    if (typeof flags.source === 'string' && flags.source.trim()) {
      entry.source = flags.source;
    }
  }

  return out;
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Dictionaries Promotion → resources.dictionaries[]');
  console.log('  Seeds: encyclopedic.resources.dictionaries + resources.lexical');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const flagsByLang = loadCuratedFlags();

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

  let processed = 0;
  let modified = 0;
  let withField = 0;
  let skippedLegacyArray = 0;   // seeds exist but resources is the legacy flat array
  let preservedForeign = 0;     // pre-existing entries not produced by this run, kept
  let flaggedEntries = 0;

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }
    processed++;

    const seeds = buildSeedEntries(card, flagsByLang);
    if (seeds.length === 0) continue;

    if (Array.isArray(card.resources)) {
      // Legacy flat-array shape — do not invent bucket semantics here
      // (schema TODO owns the migration). Loudly counted below.
      skippedLegacyArray++;
      continue;
    }

    const before = JSON.stringify(card);

    if (!card.resources || typeof card.resources !== 'object') {
      card.resources = {};
    }

    // Wholesale regeneration keyed by name; foreign entries preserved.
    const seedNames = new Set(seeds.map(e => e.name.toLowerCase()));
    const existing = Array.isArray(card.resources.dictionaries) ? card.resources.dictionaries : [];
    const foreign = existing.filter(
      e => e && typeof e === 'object' && typeof e.name === 'string' && !seedNames.has(e.name.toLowerCase())
    );
    preservedForeign += foreign.length;
    card.resources.dictionaries = [...seeds, ...foreign];

    flaggedEntries += seeds.filter(e => 'redistributable' in e).length;

    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources['resources.dictionaries'] = FIELD_SOURCE_STAMP;

    withField++;
    if (JSON.stringify(card) !== before) {
      modified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards processed:                 ${processed.toLocaleString()}`);
  console.log(`  Cards with resources.dictionaries: ${withField.toLocaleString()}`);
  console.log(`  Cards modified this run:         ${modified.toLocaleString()}`);
  console.log(`  Redistribution-flagged entries:  ${flaggedEntries.toLocaleString()}`);
  console.log(`  Foreign entries preserved:       ${preservedForeign.toLocaleString()}`);
  console.log(`  SKIPPED (legacy array resources): ${skippedLegacyArray.toLocaleString()} — pending the derive-resources-from-coverage.mjs object migration (schema TODO)`);
  if (DRY_RUN) console.log('\n  ℹ  DRY RUN — no files were modified');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
