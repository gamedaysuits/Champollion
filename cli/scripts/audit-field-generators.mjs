#!/usr/bin/env node

/**
 * audit-field-generators.mjs — can every card field actually be REBUILT?
 *
 * WHY THIS EXISTS
 *   The truth pass regenerates 8,685 cards (as of the 2026.8.0 atlas release) from their generators. That is only
 *   safe if every populated field HAS a generator. It does not.
 *
 *   `archivePresence.olacResourceCount` sits on 7,438 cards and
 *   `digitalPresence.incubatorWikiPages` on 673, and NOTHING in the tree writes
 *   either one. The scripts that produced them are gone; only their output
 *   survives. Their source files — cli/data/olac-aggregator-harvest.json,
 *   cli/data/incubator-wikis.json — sit on disk with no consumer, which is why
 *   they looked like "untapped data" when they are really orphaned OUTPUT
 *   whose producer was deleted.
 *
 *   Regenerating without knowing this would silently delete real, sourced data
 *   from thousands of cards and call it a clean rebuild.
 *
 * WHAT IT REPORTS
 *   ORPHANED   — field is populated on cards, no generator writes it.
 *                Regeneration LOSES it. Either restore a generator or accept
 *                the loss deliberately; never discover it afterwards.
 *   COVERED    — field is populated and some generator writes it.
 *   DEAD       — a generator writes a field that appears on no card.
 *
 * HOW IT DETECTS
 *   Generators assign through a small number of idioms (`card.x =`,
 *   `card.x.y =`, `card._fieldSources.x =`). This scans for those. It is a
 *   heuristic over source text, so it can only ever UNDER-report orphans — a
 *   field it thinks is covered might be written by something exotic. It is a
 *   floor on the problem, not a ceiling, and the output says so.
 *
 * Usage:
 *   node cli/scripts/audit-field-generators.mjs
 *   node cli/scripts/audit-field-generators.mjs --json
 *
 * Exit: 0 = every populated field has a generator · 1 = orphaned field(s) · 2 = could not run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const SCRIPTS_DIR = __dirname;
const JSON_OUT = process.argv.includes('--json');

// Bookkeeping written by every generator, or by the card builder itself.
const NOT_A_DATA_FIELD = new Set([
  '_generated', '_fieldSources', '_migration', '_decontaminated',
  '_dataQualityFixes', '_proseDecontaminated', '_toneGapReworded',
  'code', 'name', 'dataSources',
]);

if (!fs.existsSync(CARDS_DIR)) {
  console.error(`ERROR: ${CARDS_DIR} not found`);
  process.exit(2);
}

// ── 1. Which top-level fields are actually populated, and on how many cards ──
const populated = new Map();
let scanned = 0;
for (const file of fs.readdirSync(CARDS_DIR)) {
  if (!file.endsWith('.json') || file === 'language-tree.json') continue;
  let card;
  try { card = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, file), 'utf-8')); } catch { continue; }
  scanned++;
  for (const [k, v] of Object.entries(card)) {
    if (NOT_A_DATA_FIELD.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    populated.set(k, (populated.get(k) ?? 0) + 1);

    // One level of sub-field, which is where the orphans actually live
    // (olacResourceCount hides inside a covered `archivePresence`).
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk === 'source' || sv === null || sv === undefined) continue;
        const key = `${k}.${sk}`;
        populated.set(key, (populated.get(key) ?? 0) + 1);
      }
    }
  }
}

// ── 2. Which fields does each generator write? ──────────────────────────────
const writers = new Map();   // field -> Set(script)
const scripts = fs.readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.mjs'));
for (const file of scripts) {
  // Only scripts that plausibly WRITE cards; the audit/lint family reads them.
  if (/^(audit|check|lint|verify|validate)-/.test(file)) continue;
  let src;
  try { src = fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf-8'); } catch { continue; }
  if (!/writeFileSync/.test(src)) continue;   // does not persist cards

  const add = (field) => {
    if (!field || NOT_A_DATA_FIELD.has(field)) return;
    if (!writers.has(field)) writers.set(field, new Set());
    writers.get(field).add(file);
  };

  // card.x = …  /  card.x.y = …  /  card.x ??= …  /  delete card.x
  for (const m of src.matchAll(/\bcard\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\s*(?:=[^=]|\?\?=|\|\|=)/g)) {
    add(m[1]);
    if (m[2]) add(`${m[1]}.${m[2]}`);
  }
  // card['x'] = …
  for (const m of src.matchAll(/\bcard\[['"]([^'"]+)['"]\]\s*=[^=]/g)) add(m[1]);
  // _fieldSources.x = …  — a generator stamping provenance is writing that field
  for (const m of src.matchAll(/_fieldSources\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) add(m[1]);
  for (const m of src.matchAll(/_fieldSources\[['"]([^'"]+)['"]\]\s*=/g)) add(m[1]);
}

// ── 3. Compare ──────────────────────────────────────────────────────────────
const orphaned = [];
const covered = [];
for (const [field, cards] of populated) {
  const parent = field.includes('.') ? field.split('.')[0] : null;
  // A sub-field counts as covered if its parent object is written wholesale —
  // that is how most generators build these.
  const w = writers.get(field) ?? (parent ? writers.get(parent) : null);
  if (w && w.size) covered.push({ field, cards, scripts: [...w] });
  else orphaned.push({ field, cards });
}
orphaned.sort((a, b) => b.cards - a.cards);

const dead = [...writers.keys()]
  .filter((f) => !populated.has(f) && !f.includes('.'))
  .sort();

const result = {
  scannedCards: scanned,
  populatedFields: populated.size,
  covered: covered.length,
  orphaned,
  dead,
  note: 'Detection is a text heuristic over generator source, so it can only '
    + 'UNDER-report orphans. Treat this as a floor on the problem.',
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n  FIELD-GENERATOR COVERAGE — ${scanned.toLocaleString()} cards, `
    + `${populated.size} populated field paths\n`);
  console.log(`    covered by a generator : ${covered.length}`);
  console.log(`    ORPHANED (no writer)   : ${orphaned.length}`);
  if (orphaned.length) {
    console.log('\n  ✗ These are populated on cards but NOTHING regenerates them.');
    console.log('    A rebuild DELETES them and reports success:\n');
    for (const o of orphaned.slice(0, 30)) {
      console.log(`      ${o.field.padEnd(44)} ${o.cards.toLocaleString().padStart(7)} cards`);
    }
    if (orphaned.length > 30) console.log(`      … and ${orphaned.length - 30} more`);
  }
  if (dead.length) {
    console.log(`\n  ⚠ ${dead.length} field(s) a generator writes but no card carries:`);
    console.log(`      ${dead.slice(0, 20).join(', ')}`);
  }
  console.log(`\n  ${result.note}\n`);
}

process.exitCode = orphaned.length ? 1 : 0;
