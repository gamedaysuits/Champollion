#!/usr/bin/env node

/**
 * derive-tools.mjs
 * ────────────────────────────────────────────────────────────────
 * Populates the schematized `resources.tools[]` field (the schema
 * bucket existed with NO writer until 2026-07-19) from the curated
 * data source shared/curated-tools.json:
 *
 *   perLanguage — explicit, individually-cited tool entries.
 *   fromCaches  — per-language entries derived from a downloaded
 *                 upstream cache in cli/data/ (e.g. NRC g2p's
 *                 mappings/langs listing); the cache is rebuilt by
 *                 its named download script and is the citable
 *                 evidence for the tool's language support.
 *
 * Boundary invariant kind 2: resource EXISTENCE/CAPABILITY only —
 * names, URLs, types, cited sources. No measured scores (lint R3).
 *
 * SHAPE HANDLING (same doctrine as derive-dictionaries.mjs):
 *   resources object  → merge the `tools` key
 *   resources null    → create `resources = { tools: [...] }`
 *   resources array   → SKIPPED (legacy flat-array shape; migrating
 *     it belongs to derive-resources-from-coverage.mjs). Counted,
 *     never silent.
 *
 * IDEMPOTENCY / OWNERSHIP: regenerated from the seeds on every run;
 * same-name entries are overwritten, foreign entries preserved.
 * A missing cache file is a HARD ERROR (never silently produce a
 * thinner index — always build for prod).
 *
 * Usage:
 *   node scripts/derive-tools.mjs            # apply
 *   node scripts/derive-tools.mjs --dry-run  # preview
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const CURATED = path.join(CLI_ROOT, 'shared', 'curated-tools.json');
const DRY_RUN = process.argv.includes('--dry-run');

const curated = JSON.parse(fs.readFileSync(CURATED, 'utf-8'));

// code → [tool entries]
const toolsByCode = new Map();
const addTool = (code, entry) => {
  if (!toolsByCode.has(code)) toolsByCode.set(code, []);
  toolsByCode.get(code).push(entry);
};

for (const [code, entries] of Object.entries(curated.perLanguage || {})) {
  for (const e of entries) addTool(code, { ...e });
}

for (const spec of curated.fromCaches || []) {
  const cachePath = path.join(CLI_ROOT, spec.cache);
  if (!fs.existsSync(cachePath)) {
    console.error(`✗ cache missing: ${spec.cache} — run node ${spec.downloadScript} first`);
    process.exit(1);
  }
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  const codes = cache[spec.codesField] || [];
  for (const code of codes) {
    addTool(code, {
      name: spec.entry.name,
      url: spec.entry.urlTemplate.replace('{code}', code),
      type: spec.entry.type,
      source: spec.entry.source,
    });
  }
}

let stamped = 0;
let unchanged = 0;
let skippedLegacy = 0;
for (const [code, tools] of toolsByCode.entries()) {
  const p = path.join(CARDS_DIR, `${code}.json`);
  if (!fs.existsSync(p)) continue;
  const card = JSON.parse(fs.readFileSync(p, 'utf-8'));

  if (Array.isArray(card.resources)) {
    skippedLegacy++;
    continue;
  }
  if (card.resources == null) card.resources = {};
  const existing = Array.isArray(card.resources.tools) ? card.resources.tools : [];
  const ours = new Set(tools.map((t) => t.name));
  const foreign = existing.filter((t) => !ours.has(t.name));
  const next = [...tools, ...foreign];

  const before = JSON.stringify(existing);
  if (before === JSON.stringify(next)) {
    unchanged++;
    continue;
  }
  card.resources.tools = next;
  if (!card._fieldSources) card._fieldSources = {};
  card._fieldSources['resources.tools'] =
    'derived-from-curated-tools (shared/curated-tools.json; caches under data/ cited per entry)';
  stamped++;
  if (!DRY_RUN) {
    fs.writeFileSync(p, JSON.stringify(card, null, 2) + '\n');
  }
}

console.log(`${DRY_RUN ? '[dry-run] ' : ''}tools: ${stamped} cards stamped, ${unchanged} unchanged, ` +
            `${skippedLegacy} skipped (legacy array resources), ${toolsByCode.size} codes in seeds`);
