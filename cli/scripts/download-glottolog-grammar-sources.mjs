#!/usr/bin/env node

/**
 * download-glottolog-grammar-sources.mjs
 * ────────────────────────────────────────────────────────────────
 * Downloads the two Glottolog CLDF files enrich-grammars-from-
 * glottolog.mjs consumes:
 *
 *   cldf/values.csv      (~21 MB) — med + medovertime rows carry the
 *                        MED (Most Extensive Description) reference
 *                        ids per glottocode
 *   cldf/sources.bib.zip (~40 MB, ~176 MB unzipped) — the BibTeX
 *                        records resolving those reference ids to
 *                        author/year/title/hhtype
 *
 * PINNED to the glottolog-cldf v5.3 tag — the same Glottolog 5.3
 * release the cards already cite (data/glottolog/README.txt; card
 * stamps 'glottolog-5.3'). Never download from master: unpinned
 * transports are non-deterministic (repo doctrine).
 *
 * License: Glottolog 5.3 is CC-BY-4.0 (Hammarström, Harald & Forkel,
 * Robert & Haspelmath, Martin & Bank, Sebastian. 2026. Glottolog 5.3.
 * Leipzig: MPI-EVA. https://doi.org/10.5281/zenodo.15525265). Only
 * bibliographic METADATA is consumed downstream — never content.
 *
 * OUTPUT (cli/data/ is gitignored — these are transient fetch-from-
 * source inputs, exactly like cldf-values.csv for the MED enricher):
 *   cli/data/glottolog/cldf-values.csv
 *   cli/data/glottolog/sources.bib.zip → unzipped to sources.bib
 *
 * IDEMPOTENCY: overwrites previous downloads with a fresh copy.
 *
 * Usage:
 *   node scripts/download-glottolog-grammar-sources.mjs
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(CLI_ROOT, 'data', 'glottolog');

const GLOTTOLOG_CLDF_TAG = 'v5.3';
const BASE = `https://raw.githubusercontent.com/glottolog/glottolog-cldf/${GLOTTOLOG_CLDF_TAG}/cldf`;

const FILES = [
  { url: `${BASE}/values.csv`, out: 'cldf-values.csv' },
  { url: `${BASE}/sources.bib.zip`, out: 'sources.bib.zip' },
];

async function download(url, outPath) {
  console.log(`  ⏳ ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Champollion-Enrichment-Pipeline/1.0' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  console.log(`  ✅ ${path.relative(CLI_ROOT, outPath)} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  📥 Glottolog CLDF grammar sources (pinned ${GLOTTOLOG_CLDF_TAG})`);
  console.log('═══════════════════════════════════════════════════════════\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const f of FILES) {
    await download(f.url, path.join(OUT_DIR, f.out));
  }

  console.log('  ⏳ unzipping sources.bib.zip …');
  execFileSync('unzip', ['-o', 'sources.bib.zip'], { cwd: OUT_DIR, stdio: 'pipe' });
  const bibPath = path.join(OUT_DIR, 'sources.bib');
  if (!fs.existsSync(bibPath)) {
    throw new Error('sources.bib missing after unzip');
  }
  console.log(`  ✅ sources.bib (${(fs.statSync(bibPath).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log('\n  Next: node scripts/enrich-grammars-from-glottolog.mjs');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error(`  ❌ ${err.message}`);
  process.exit(1);
});
