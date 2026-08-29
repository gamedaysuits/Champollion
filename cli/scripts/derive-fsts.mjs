#!/usr/bin/env node

/**
 * derive-fsts.mjs
 * ────────────────────────────────────────────────────────────────
 * Merges curated FST registrations (shared/curated-fsts.json) into
 * `resources.fsts[]`. Companion to derive-tools.mjs — same shape
 * handling, same ownership rules. Exists because the live-check FST
 * lane (generate-language-card.mjs checkGiellaLTRepo) only ran for
 * the ~20 launch languages, leaving e.g. GiellaLT's own PRODUCTION-
 * maturity languages (fao, fkv, kal, nno) with empty fsts[].
 *
 * Boundary invariant kind 2: resource EXISTENCE only. Entries carry
 * NO install pins (GiellaLT releases are vestigial — nightly is the
 * channel; see fst_installer.py doctrine) and no measured scores.
 *
 * SHAPE HANDLING: resources object → merge `fsts`; null → create;
 * legacy array → skipped + counted (derive-resources-from-coverage
 * owns that migration).
 * IDEMPOTENCY: same-name entries overwritten from seeds; foreign
 * entries (e.g. the live-checked GiellaLT entries) preserved.
 *
 * Usage:
 *   node scripts/derive-fsts.mjs            # apply
 *   node scripts/derive-fsts.mjs --dry-run  # preview
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const CURATED = path.join(CLI_ROOT, 'shared', 'curated-fsts.json');
const DRY_RUN = process.argv.includes('--dry-run');

const curated = JSON.parse(fs.readFileSync(CURATED, 'utf-8'));

let stamped = 0;
let unchanged = 0;
let skippedLegacy = 0;
for (const [code, entries] of Object.entries(curated.perLanguage || {})) {
  const p = path.join(CARDS_DIR, `${code}.json`);
  if (!fs.existsSync(p)) {
    console.warn(`  ⚠ no card for curated code ${code}`);
    continue;
  }
  const card = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (Array.isArray(card.resources)) {
    skippedLegacy++;
    continue;
  }
  if (card.resources == null) card.resources = {};
  const existing = Array.isArray(card.resources.fsts) ? card.resources.fsts : [];
  const ours = new Set(entries.map((e) => e.name));
  const foreign = existing.filter((e) => !ours.has(e.name));
  const next = [...entries, ...foreign];
  if (JSON.stringify(existing) === JSON.stringify(next)) {
    unchanged++;
    continue;
  }
  card.resources.fsts = next;
  if (!card._fieldSources) card._fieldSources = {};
  card._fieldSources['resources.fsts'] = existing.length
    ? `${card._fieldSources['resources.fsts'] || 'live-check'}+curated-fsts.json`
    : 'derived-from-curated-fsts (shared/curated-fsts.json)';
  stamped++;
  if (!DRY_RUN) {
    fs.writeFileSync(p, JSON.stringify(card, null, 2) + '\n');
  }
}
console.log(`${DRY_RUN ? '[dry-run] ' : ''}fsts: ${stamped} cards stamped, ${unchanged} unchanged, ${skippedLegacy} skipped (legacy array resources)`);
