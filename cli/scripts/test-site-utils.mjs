#!/usr/bin/env node
/**
 * test-site-utils.mjs — run the website's own unit tests
 * (website/src/utils/*.test.mjs) as part of `npm test`. Until 2026-10-10 no
 * gate ran them: 190 tests that guarded the site's data helpers were run by
 * hand or not at all.
 *
 * Tests that load data the SITE BUILD generates (src/data/graph-poster.json,
 * gitignored — the build fetches it) can only run where a build has run. They
 * are named here as skipped, with the reason and the command that makes them
 * runnable — never silently left out, never failed for a missing build.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'website');
const UTILS = path.join(SITE, 'src', 'utils');
/** generated data a test needs, by the test file (relative to src/utils) */
const NEEDS_BUILD = {
  'seamFacts.test.mjs': 'src/data/graph-poster.json',
  'seamRoute.test.mjs': 'src/data/graph-poster.json',
  'seamStory.test.mjs': 'src/data/graph-poster.json',
};

const all = fs.readdirSync(UTILS).filter((f) => f.endsWith('.test.mjs')).sort();
const run = [];
const skipped = [];
for (const f of all) {
  const need = NEEDS_BUILD[f];
  if (need && !fs.existsSync(path.join(SITE, need))) skipped.push(`${f} (needs ${need})`);
  else run.push(path.join(UTILS, f));
}
if (skipped.length) {
  console.log(`[site-utils] skipped — they read data the site build generates: ${skipped.join(', ')}.`
    + ' Run `npm --prefix website run ensure-data` (or a site build) first to include them.');
}
const r = spawnSync(process.execPath, ['--test', ...run], { stdio: 'inherit' });
process.exit(r.status ?? 1);
