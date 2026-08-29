#!/usr/bin/env node

/**
 * prune-unpinned.mjs — remove files a fetcher left behind that no snapshot vouches for.
 *
 * WHY THIS EXISTS
 *   The first run of `cldf-zenodo.mjs` flattened each deposit's ENTIRE tree into
 *   its data directory, so 197 sources picked up repo scaffolding — `.zenodo.json`,
 *   `metadata.json`, `requirements.txt` — alongside the CLDF payload. The fetcher
 *   now takes only `cldf/`, so those files are no longer extracted and no longer
 *   listed in any SNAPSHOT. They are unaccounted bytes: exactly the condition
 *   this whole phase exists to eliminate, sitting in directories we just declared
 *   pinned.
 *
 * WHY IT IS NARROW BY CONSTRUCTION
 *   Deleting from the data tree on a guess is worse than leaving clutter — much
 *   of `cli/data/` predates any of this and cannot be re-obtained. So a file is
 *   only ever a candidate when ALL of the following hold:
 *
 *     1. its directory has a SNAPSHOT.json that verifies (an unpinned directory
 *        is not this script's business),
 *     2. the file is not listed in that snapshot,
 *     3. the file is not a directory — nested layouts are original data,
 *     4. it is NOT git-tracked (see trackedPaths()),
 *     5. its mtime is at or after --since, i.e. a fetcher run wrote it.
 *
 *   Condition 5 is what separates "a fetcher put this here and then stopped
 *   claiming it" from "this has been here since June and something reads it".
 *   There is no default for --since; requiring it makes the operator name the
 *   window rather than inherit one.
 *
 * Usage:
 *   node cli/scripts/prune-unpinned.mjs --since 2026-08-02T12:00:00Z          # dry run
 *   node cli/scripts/prune-unpinned.mjs --since 2026-08-02T12:00:00Z --apply
 *
 * Exit: 0 ok · 2 could not run
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT, readSnapshot, verify } from './fetchers/lib/fetch-lib.mjs';

/**
 * Every git-tracked path under cli/data.
 *
 * These are NEVER candidates, regardless of mtime. Most of cli/data is
 * gitignored, so anything deliberately tracked inside it was tracked ON PURPOSE
 * — the Phase A licence-evidence LICENSE files, the pinned registry tables, the
 * source READMEs. The mtime window cannot tell "a fetcher dropped this here" from
 * "someone edited this today", and it got that wrong on the first run: it deleted
 * cli/data/iso639-3/README.md, written an hour earlier and committed, because the
 * SNAPSHOT does not list prose. Recoverable from git, which is exactly the point —
 * so ask git first.
 */
function trackedPaths() {
  try {
    const out = execFileSync('git', ['ls-files', '-z', 'cli/data'], {
      cwd: path.join(DATA_ROOT, '..', '..'), encoding: 'utf-8', maxBuffer: 1 << 26,
    });
    return new Set(out.split('\0').filter(Boolean)
      .map((p) => p.replace(/^cli\/data\//, '')));
  } catch (err) {
    console.error(`ERROR: could not ask git what is tracked — ${err.message}`);
    console.error('Refusing to delete without that list; it is the only thing standing');
    console.error('between this script and a file someone meant to keep.');
    process.exit(2);
  }
}

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const sinceArg = argv[argv.indexOf('--since') + 1];

if (!argv.includes('--since') || !sinceArg || sinceArg.startsWith('--')) {
  console.error('ERROR: --since <ISO timestamp> is required.');
  console.error('Deleting from cli/data without naming a window is not a thing this');
  console.error('script will do — most of that tree cannot be re-obtained.');
  process.exit(2);
}
const since = new Date(sinceArg);
if (Number.isNaN(since.getTime())) {
  console.error(`ERROR: --since "${sinceArg}" is not a date.`);
  process.exit(2);
}

const TRACKED = trackedPaths();

let dirsChecked = 0;
let protectedByGit = 0;
let candidates = 0;
let bytes = 0;
const report = [];

for (const entry of fs.readdirSync(DATA_ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const snap = readSnapshot(entry.name);
  if (!snap) continue;
  if (!verify(entry.name).ok) continue;      // drifted: fix the pin first, prune later
  dirsChecked++;

  const listed = new Set(snap.files.map((f) => f.path));
  const hits = [];
  for (const f of fs.readdirSync(path.join(DATA_ROOT, entry.name), { withFileTypes: true })) {
    if (f.isDirectory()) continue;
    if (f.name === 'SNAPSHOT.json' || listed.has(f.name)) continue;
    if (TRACKED.has(`${entry.name}/${f.name}`)) { protectedByGit++; continue; }
    const abs = path.join(DATA_ROOT, entry.name, f.name);
    const st = fs.statSync(abs);
    if (st.mtime < since) continue;          // predates the window — not ours to remove
    hits.push({ name: f.name, bytes: st.size, mtime: st.mtime.toISOString() });
    candidates++;
    bytes += st.size;
  }
  if (hits.length) report.push({ dir: entry.name, hits });
}

console.log(`\n  PRUNE UNPINNED — ${dirsChecked} pinned director(ies) checked`);
console.log(`  window: files written at or after ${since.toISOString()}`);
console.log(`  ${TRACKED.size} git-tracked path(s) under cli/data are exempt outright\n`);

if (!candidates) {
  console.log('  Nothing unaccounted for in that window.');
  console.log(`  (${protectedByGit} git-tracked file(s) were never candidates.)\n`);
  process.exit(0);
}

const byName = {};
for (const r of report) for (const h of r.hits) byName[h.name] = (byName[h.name] ?? 0) + 1;
console.log(`  ${candidates} file(s), ${(bytes / 1e6).toFixed(1)} MB, across ${report.length} director(ies):`);
for (const [name, n] of Object.entries(byName).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)}×  ${name}`);
}

if (!APPLY) {
  console.log('\n  DRY RUN — nothing deleted. Re-run with --apply.\n');
  process.exit(0);
}

let removed = 0;
for (const r of report) {
  for (const h of r.hits) {
    fs.rmSync(path.join(DATA_ROOT, r.dir, h.name));
    removed++;
  }
}
console.log(`\n  ✓ removed ${removed} file(s).`);
console.log('    Every pinned directory now contains only what its SNAPSHOT vouches for.\n');
