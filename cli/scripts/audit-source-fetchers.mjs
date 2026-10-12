#!/usr/bin/env node

/**
 * audit-source-fetchers.mjs — which of our sources can we actually rebuild?
 *
 * WHY THIS EXISTS
 *   "The cards are regenerated from source" is the claim the whole atlas rests
 *   on. Until now nothing could evaluate it. `cli/data/` is 7.3 GB, gitignored,
 *   with zero files tracked; 3,972,064 facts cite 268 source names; and the
 *   overlap between "a source we cite" and "a source we could fetch again" was
 *   nobody's job to know.
 *
 *   This report is that overlap. Each source lands in exactly one state:
 *
 *     PINNED       a fetcher ran, wrote SNAPSHOT.json, and the bytes on disk
 *                  still match it. Regenerable. This is the only good state.
 *     DRIFTED      a SNAPSHOT exists but the files no longer match it. Someone
 *                  or something changed the data underneath the record.
 *     UNPINNED     a fetcher exists but has never successfully pinned — usually
 *                  the upstream publishes no immutable release to pin to.
 *     NO FETCHER   data on disk and/or facts in the store, and no way to get
 *                  either again. NOT rebuildable.
 *     NO DATA      facts cite it, but nothing on disk corresponds. The source
 *                  is a name in a column and nothing else.
 *     DERIVED      not an upstream at all (champollion-derived, curated:*).
 *                  Regenerable through fact_lineage rather than a fetcher, so
 *                  demanding one would be a category error.
 *
 *   NO FETCHER and NO DATA are the work queue, and the plan's rule decides
 *   them: a source gets a fetcher or it retires. Neither outcome is "leave it
 *   and hope".
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   It does not guess. A directory whose name resembles a source name is not
 *   evidence that the directory is that source, so matching is exact, and
 *   anything it cannot match is reported as unmatched rather than quietly
 *   paired up.
 *
 * Usage:
 *   node cli/scripts/audit-source-fetchers.mjs
 *   node cli/scripts/audit-source-fetchers.mjs --json
 *   node cli/scripts/audit-source-fetchers.mjs --queue     # just the work list
 *
 * Exit: 0 = every source cited by facts is pinned · 1 = gaps remain · 2 = could not run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DATA_ROOT, readSnapshot, verify } from './fetchers/lib/fetch-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FETCHERS_DIR = path.join(__dirname, 'fetchers');
const JSON_OUT = process.argv.includes('--json');
const QUEUE_ONLY = process.argv.includes('--queue');

// ── 1. Fetchers ─────────────────────────────────────────────────────────────
const fetchers = new Map();   // source -> { file, dir }
for (const file of fs.readdirSync(FETCHERS_DIR).sort()) {
  if (!file.endsWith('.mjs')) continue;
  const mod = await import(pathToFileURL(path.join(FETCHERS_DIR, file)).href);
  if (typeof mod.fetchSource === 'function' && mod.source) {
    fetchers.set(mod.source, { file: `fetchers/${file}`, dir: mod.dir });
  }
}

// ── 2. Sources the fact store actually cites, weighted by reach ──────────────
let cited = [];
try {
  const { openDatabase } = await import('./db.mjs');
  const db = openDatabase();
  cited = db._db.prepare(`
    SELECT source, COUNT(*) AS facts, COUNT(DISTINCT language_code) AS languages
    FROM facts GROUP BY source ORDER BY languages DESC, facts DESC
  `).all();
  db.close();
} catch (err) {
  console.error(`ERROR: cannot read the fact store — ${err.message}`);
  process.exit(2);
}

// ── 3. What is on disk ──────────────────────────────────────────────────────
const dirsOnDisk = new Set();
const looseFiles = [];
for (const entry of fs.readdirSync(DATA_ROOT, { withFileTypes: true })) {
  if (entry.isDirectory()) dirsOnDisk.add(entry.name);
  else if (/\.(json|csv|tsv|tab|txt|xml|bib)$/i.test(entry.name)) looseFiles.push(entry.name);
}

// ── 4. Classify ─────────────────────────────────────────────────────────────
/**
 * Exact matching only. A directory called `clics3` may well be the `clics3`
 * source, but "may well be" is how a 3.6%-verified licence register happened.
 */
function dataFor(source) {
  const f = fetchers.get(source);
  if (f?.dir && dirsOnDisk.has(f.dir)) return f.dir;
  if (dirsOnDisk.has(source)) return source;
  return null;
}

/** Sources that are not upstreams at all. See the DERIVED branch below. */
const INTERNAL = /^(champollion-derived|curated:)/;

const rows = [];
for (const c of cited) {
  const fetcher = fetchers.get(c.source) ?? null;
  const dir = dataFor(c.source);
  let state;
  let detail = '';

  if (INTERNAL.test(c.source)) {
    // Not an upstream, so demanding a fetcher would be a category error — and
    // over-reporting is as misleading as under-reporting. What makes a derived
    // fact regenerable is `fact_lineage` back to the inputs it was computed
    // from, which is B4's job, not B1's.
    state = 'DERIVED';
    detail = 'internal derivation — regenerable via fact_lineage, not a fetcher';
  } else if (dir && readSnapshot(dir)) {
    // Snapshot-first, deliberately. What makes a source regenerable is a
    // verified pin on disk, not whether some module happens to export its name:
    // `cldf-zenodo.mjs` pins 198 datasets and exports none of them. Asking
    // "is there a fetcher called wals?" would report WALS unpinned while its
    // SNAPSHOT sat right there.
    const snap = readSnapshot(dir);
    if (!snap.pin?.value && !snap.pin?.doi) {
      state = 'UNPINNED';
      detail = snap.notes ?? 'snapshot carries no pin';
    } else {
      const v = verify(dir);
      state = v.ok ? 'PINNED' : 'DRIFTED';
      detail = v.ok
        ? `${snap.pin.doi ?? snap.pin.value} (${v.checked} file(s), via ${snap.fetchedBy?.split('/').pop() ?? '?'})`
        : v.problems.slice(0, 3).map((p) => `${p.path}: ${p.why}`).join('; ');
    }
  } else if (fetcher) {
    state = 'UNPINNED';
    detail = 'fetcher exists but has never written a SNAPSHOT';
  } else if (dir) {
    state = 'NO FETCHER';
    detail = `data at cli/data/${dir}/, no way to re-obtain it`;
  } else {
    state = 'NO DATA';
    detail = 'cited by facts; nothing on disk under this name';
  }
  rows.push({ source: c.source, facts: c.facts, languages: c.languages, state, detail,
    fetcher: fetcher?.file ?? null });
}

// Fetchers for sources the store does not (yet) cite are not a problem — an
// extractor simply has not been written. Say so rather than omit them.
const unusedFetchers = [...fetchers.keys()].filter((s) => !cited.some((c) => c.source === s));

// Directories nothing cites. These are the plan's "~165 cli/data entries no
// script references" — each one is a fetcher or a deletion, not a maybe.
const citedDirs = new Set(rows.map((r) => dataFor(r.source)).filter(Boolean));
const orphanDirs = [...dirsOnDisk].filter((d) => !citedDirs.has(d)).sort();

const byState = (s) => rows.filter((r) => r.state === s);
const result = {
  sourcesCited: rows.length,
  fetchers: fetchers.size,
  states: Object.fromEntries(
    ['PINNED', 'DERIVED', 'DRIFTED', 'UNPINNED', 'NO FETCHER', 'NO DATA']
      .map((s) => [s, byState(s).length]),
  ),
  languagesCovered: {
    pinned: byState('PINNED').reduce((n, r) => Math.max(n, r.languages), 0),
    unpinnedTotalFacts: rows.filter((r) => r.state !== 'PINNED')
      .reduce((n, r) => n + r.facts, 0),
  },
  rows,
  unusedFetchers,
  orphanDirectories: orphanDirs,
  looseFileCount: looseFiles.length,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else if (QUEUE_ONLY) {
  const queue = [...byState('NO FETCHER'), ...byState('NO DATA')]
    .sort((a, b) => b.languages - a.languages);
  console.log(`\n  WORK QUEUE — ${queue.length} source(s) cannot be rebuilt from source\n`);
  for (const r of queue) {
    console.log(`    ${String(r.languages).padStart(6)} langs  ${r.source.padEnd(34)} ${r.state}`);
  }
  console.log('');
} else {
  console.log(`\n  SOURCE FETCHER COVERAGE — ${rows.length} source(s) cited by `
    + `${result.languagesCovered.unpinnedTotalFacts.toLocaleString()}+ facts\n`);
  for (const [state, n] of Object.entries(result.states)) {
    console.log(`    ${state.padEnd(12)} ${String(n).padStart(4)}`);
  }

  const pinned = byState('PINNED');
  if (pinned.length) {
    console.log('\n  ✓ PINNED — regenerable from an immutable upstream release:');
    for (const r of pinned) {
      console.log(`      ${r.source.padEnd(24)} ${String(r.languages).padStart(6)} langs   ${r.detail}`);
    }
  }
  for (const state of ['DRIFTED', 'UNPINNED']) {
    const set = byState(state);
    if (!set.length) continue;
    console.log(`\n  ⚠ ${state}:`);
    for (const r of set) console.log(`      ${r.source.padEnd(24)} ${r.detail}`);
  }

  const queue = [...byState('NO FETCHER'), ...byState('NO DATA')]
    .sort((a, b) => b.languages - a.languages);
  if (queue.length) {
    console.log(`\n  ✗ ${queue.length} source(s) CANNOT be rebuilt. Highest reach first —`);
    console.log('    each one ends in a fetcher or a retirement:\n');
    for (const r of queue.slice(0, 25)) {
      console.log(`      ${String(r.languages).padStart(6)} langs  ${r.source.padEnd(32)} ${r.state}`);
    }
    if (queue.length > 25) console.log(`      … and ${queue.length - 25} more (--json for all)`);
  }
  if (unusedFetchers.length) {
    console.log(`\n  ℹ ${unusedFetchers.length} fetcher(s) whose source the store does not cite yet `
      + `(extractor pending): ${unusedFetchers.join(', ')}`);
  }
  console.log(`\n  ℹ ${orphanDirs.length} directory/ies in cli/data that NO cited source maps to, `
    + `plus ${looseFiles.length} loose file(s).`);
  console.log('    Unaccounted-for bytes are not evidence of anything. Same rule: a');
  console.log('    fetcher, or deletion with a note.\n');
}

// DERIVED counts as accounted-for: it is regenerable by a different mechanism,
// not unaccounted-for.
process.exitCode =
  (result.states.PINNED + result.states.DERIVED === rows.length) ? 0 : 1;
