#!/usr/bin/env node
/**
 * build-cchrf-floors.mjs — derive the per-language chance-floor table the
 * homepage strength layer (measured-pair arcs) corrects against.
 *
 * Source: the champollion-cchrf floor atlas (results/atlas.json in the
 * research repo) — Monte-Carlo chance floors for chrF2++ estimated from
 * FLORES-200 dev MONOLINGUAL text only (no parallel content; the corpus
 * itself is fetch-from-source and never tracked). Floors are metric ×
 * orthography properties: they answer "what does a random same-orthography
 * baseline score against real references?".
 *
 * Output: src/data/cchrf-floors.json —
 *   { _meta, floors: { <iso3>: <floor 0-100> }, scripts: { <iso3>: [..] } }
 *
 * Collapsing rule (documented, conservative): a language written in more
 * than one script keeps the HIGHEST floor across its scripts, so the
 * correction never inflates a strength value. Provenance is
 * champollion-derived per the fact-provenance doctrine — these are values
 * Champollion computes, not assertions by FLORES or any upstream.
 *
 * Usage:
 *   node scripts/build-cchrf-floors.mjs [--atlas /path/to/atlas.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'src', 'data', 'cchrf-floors.json');
// The floor atlas now lives INSIDE the monorepo (research/cchrf, folded
// 2026-08-09 — it previously sat in a sibling checkout with no remote, which
// made the homepage colour scale unregenerable if that folder was lost).
const DEFAULT_ATLAS = path.join(
  HERE, '..', '..', '..', 'research', 'cchrf', 'results', 'atlas.json',
);

const atlasArg = process.argv.indexOf('--atlas');
const atlasPath = atlasArg > -1 ? process.argv[atlasArg + 1] : DEFAULT_ATLAS;

if (!fs.existsSync(atlasPath)) {
  console.error(
    `[build-cchrf-floors] atlas not found: ${atlasPath}\n` +
      'Pass --atlas /path/to/champollion-cchrf/results/atlas.json. The committed\n' +
      'src/data/cchrf-floors.json remains the shipping copy until regenerated.',
  );
  process.exit(1);
}

const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
const floors = {};
const scripts = {};

for (const [key, entry] of Object.entries(atlas.languages)) {
  const iso3 = key.split('_')[0];
  const mean = entry?.floors?.N1_unigram?.mean;
  if (typeof mean !== 'number') continue;
  if (!(iso3 in floors) || mean > floors[iso3]) floors[iso3] = mean;
  (scripts[iso3] ||= []).push(entry.script);
}

const out = {
  _meta: {
    source: 'champollion-derived',
    derivedFrom:
      'champollion-cchrf floor atlas (Monte-Carlo N1-unigram chance floors ' +
      'for chrF2++, estimated from FLORES-200 dev monolingual text only)',
    chrfSignature: atlas._meta?.chrf_signature || null,
    estimator: 'floors.N1_unigram.mean',
    multiScriptRule:
      'max floor across scripts (conservative — correction never inflates strength)',
    languages: Object.keys(floors).length,
    generatedBy: 'cli/website/scripts/build-cchrf-floors.mjs',
  },
  floors,
  scripts,
};

fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(
  `[build-cchrf-floors] wrote ${Object.keys(floors).length} language floors → ${path.relative(process.cwd(), OUT)}`,
);
