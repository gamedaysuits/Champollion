#!/usr/bin/env node

/**
 * download-nrc-g2p.mjs
 * ────────────────────────────────────────────────────────────────
 * Caches the language list of NRC Canada's g2p library (grapheme-to-
 * phoneme mappings built for Indigenous-language tooling; MIT).
 * A per-language mapping directory is the concrete evidence that
 * NRC's toolchain (g2p, and ReadAlong Studio which builds on it)
 * supports that language.
 *
 * DATA SOURCE:
 *   GitHub contents API — roedoejet/g2p `g2p/mappings/langs/`
 *   (one API call; directory names are language codes)
 *
 * OUTPUT: cli/data/nrc-g2p-langs.json
 *   { retrievedAt, source, dirs: [raw dir names],
 *     iso639_3: [dir names that are codes of cards we index] }
 *
 * Usage: node scripts/download-nrc-g2p.mjs
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const OUT = path.join(CLI_ROOT, 'data', 'nrc-g2p-langs.json');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');

const LIST_URL = 'https://api.github.com/repos/roedoejet/g2p/contents/g2p/mappings/langs?per_page=100';

const res = await fetch(LIST_URL, {
  headers: { 'User-Agent': 'Champollion/1.0 (language-cards enrichment)', Accept: 'application/vnd.github+json' },
});
if (!res.ok) {
  console.error(`✗ ${res.status} fetching ${LIST_URL}`);
  process.exit(1);
}
const listing = await res.json();
const dirs = listing.filter((e) => e.type === 'dir').map((e) => e.name).sort();

const cardCodes = new Set(
  fs.readdirSync(CARDS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
);
const iso = dirs.filter((d) => cardCodes.has(d.toLowerCase()));

fs.writeFileSync(OUT, JSON.stringify({
  retrievedAt: new Date().toISOString(),
  source: 'https://github.com/roedoejet/g2p (g2p/mappings/langs) — NRC Canada Indigenous Languages Technology; MIT',
  dirs,
  iso639_3: iso,
}, null, 2) + '\n');
console.log(`wrote ${OUT}: ${dirs.length} mapping dirs, ${iso.length} matching card codes: ${iso.join(' ')}`);
