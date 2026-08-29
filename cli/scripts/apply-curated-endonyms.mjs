#!/usr/bin/env node

/**
 * apply-curated-endonyms.mjs
 * ────────────────────────────────────────────────────────────────
 * Applies the hand-curated endonym seed (cli/shared/curated-endonyms.json)
 * to language cards. See docs/CARD_DATA_QUALITY_AUDIT.md § 3b ("Curated
 * seed for high-visibility families").
 *
 * Rules:
 *   - merge-only: never overwrites an existing nativeName
 *     (pass --force to overwrite — only for community-correction cycles)
 *   - every seed entry must carry source_url + retrieved; entries
 *     without them are refused (no uncited endonyms, ever)
 *   - provenance stamp: _fieldSources.nativeName =
 *         'manual-curation+<source_url>'
 *     and 'manual-curation' is appended to dataSources
 *   - the URL/genid guard applies here too (defense in depth)
 *
 * Usage:
 *   node scripts/apply-curated-endonyms.mjs --dry-run
 *   node scripts/apply-curated-endonyms.mjs
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const SEED_PATH = path.join(CLI_ROOT, 'shared', 'curated-endonyms.json');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const RE_URL = /^(https?|ftp):\/\/\S+/i;
const RE_GENID = /\.well-known\/genid\//i;

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Curated endonym seed → cards');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE') + (FORCE ? ' (FORCE overwrite)' : ''));
  console.log('═══════════════════════════════════════════════════════════\n');

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  let applied = 0, skippedHasValue = 0, refused = 0;

  for (const [code, entry] of Object.entries(seed)) {
    if (code.startsWith('_')) continue; // _meta

    // No uncited endonyms, ever.
    if (!entry.nativeName || !entry.source_url || !entry.retrieved) {
      console.log(`  ✗ ${code}: REFUSED — seed entry missing nativeName/source_url/retrieved`);
      refused++;
      continue;
    }
    if (RE_URL.test(entry.nativeName) || RE_GENID.test(entry.nativeName)) {
      console.log(`  ✗ ${code}: REFUSED — nativeName is URL-shaped`);
      refused++;
      continue;
    }

    const filePath = path.join(CARDS_DIR, `${code}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`  ✗ ${code}: no card file, skipping`);
      continue;
    }
    const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (card.nativeName && !FORCE) {
      console.log(`  – ${code}: already has nativeName (${card.nativeName}), merge-only — skipped`);
      skippedHasValue++;
      continue;
    }

    card.nativeName = entry.nativeName;
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.nativeName = `manual-curation+${entry.source_url}`;
    const sources = Array.isArray(card.dataSources) ? card.dataSources : [];
    if (!sources.includes('manual-curation')) sources.push('manual-curation');
    card.dataSources = sources;

    console.log(`  ✓ ${code}: nativeName ← ${entry.nativeName}`);
    console.log(`        source: ${entry.source_url} (retrieved ${entry.retrieved})`);
    applied++;

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  console.log(`\n  Applied: ${applied}   skipped(existing): ${skippedHasValue}   refused(uncited/malformed): ${refused}`);
}

main();
