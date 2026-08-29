#!/usr/bin/env node

/**
 * fetch-source.mjs — run the fetchers. The entry point for "from source".
 *
 * A fetcher's whole job is to make one source REGENERABLE: it names the
 * upstream, pins one immutable release, checksums what it took, and writes that
 * down in SNAPSHOT.json. This driver runs them and reports what is pinned, what
 * drifted, and what has no fetcher at all.
 *
 * The last of those is the point. `--list` is not a convenience — it is the
 * standing answer to "which of our sources can we actually rebuild from?", and
 * today the answer is: a small minority. Naming the rest is how they either get
 * a fetcher or get retired, rather than lingering as 7.3 GB of unexplained
 * bytes that no one dares delete.
 *
 * Usage:
 *   node cli/scripts/fetch-source.mjs --list          # what has a fetcher
 *   node cli/scripts/fetch-source.mjs --verify        # disk vs every SNAPSHOT
 *   node cli/scripts/fetch-source.mjs glottolog       # one source
 *   node cli/scripts/fetch-source.mjs --all           # every fetcher
 *
 * Exit: 0 ok · 1 a fetch or verification failed · 2 could not run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verify } from './fetchers/lib/fetch-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FETCHERS_DIR = path.join(__dirname, 'fetchers');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const names = args.filter((a) => !a.startsWith('-'));

async function loadFetchers() {
  const out = [];
  for (const file of fs.readdirSync(FETCHERS_DIR).sort()) {
    if (!file.endsWith('.mjs')) continue;
    const mod = await import(pathToFileURL(path.join(FETCHERS_DIR, file)).href);
    if (typeof mod.fetchSource !== 'function' || !mod.source) continue;
    out.push({ file, ...mod });
  }
  return out;
}

function reportSnapshot(f) {
  // A multi-dataset fetcher (cldf-zenodo) pins many directories, so there is no
  // single snapshot to report on.
  if (!f.dir) return '  (multi-dataset — run with --source <name> or --list)';
  const snapPath = path.join(__dirname, '..', 'data', f.dir, 'SNAPSHOT.json');
  if (!fs.existsSync(snapPath)) return '  (no SNAPSHOT yet — never fetched)';
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
  const pin = snap.pin?.doi ?? snap.pin?.value ?? null;
  return `  pinned: ${pin ?? 'NONE'}   verified: ${snap.verified ? 'yes' : 'NO'}   `
    + `files: ${snap.files.length}   fetched: ${String(snap.fetchedAt).slice(0, 10)}`;
}

const fetchers = await loadFetchers();

if (has('--list') || args.length === 0) {
  console.log(`\n  FETCHERS — ${fetchers.length} source(s) can be regenerated from upstream\n`);
  for (const f of fetchers) {
    console.log(`    ${f.source.padEnd(20)} ${f.file}`);
    console.log(`    ${' '.repeat(20)}${reportSnapshot(f).trim()}`);
  }
  console.log('\n  Every OTHER source in cli/data has no fetcher, and so cannot be');
  console.log('  rebuilt from source. Run audit-source-fetchers.mjs for that list —');
  console.log('  it is the work queue, and each entry ends in a fetcher or a deletion.\n');
  process.exit(0);
}

if (has('--verify')) {
  let bad = 0;
  console.log('\n  VERIFY — recomputing sha256 from disk for every pinned file\n');
  for (const f of fetchers) {
    // A multi-dataset fetcher (cldf-zenodo) pins many directories and declares
    // no single `dir`. It used to reach verify() as null and crash the whole
    // sweep on a TypeError, so ONE unverifiable fetcher took down the report
    // for all the others. Named and skipped, because "cannot be checked here"
    // is a finding and a stack trace is not.
    if (!f.dir) {
      console.log(`    · ${f.source.padEnd(20)} multi-dataset — verified per dataset, not here`);
      continue;
    }
    const r = verify(f.dir);
    if (r.ok) {
      console.log(`    ✓ ${f.source.padEnd(20)} ${r.checked} file(s) match`);
    } else {
      bad++;
      console.log(`    ✗ ${f.source.padEnd(20)}`);
      for (const p of r.problems) console.log(`        ${p.path}: ${p.why}`);
    }
  }
  console.log('');
  process.exit(bad ? 1 : 0);
}

const selected = has('--all') ? fetchers : fetchers.filter((f) => names.includes(f.source)
  || names.includes(f.file.replace(/\.mjs$/, '')));

if (!selected.length) {
  console.error(`No fetcher matches: ${names.join(', ')}`);
  console.error(`Known: ${fetchers.map((f) => f.source).join(', ')}`);
  process.exit(2);
}

let failed = 0;
for (const f of selected) {
  console.log(`\n▸ ${f.source}`);
  try {
    const r = await f.fetchSource({ refetch: has('--refetch') });
    if (r && r.verified === false) {
      failed++;
      console.log('  ✗ UNVERIFIED — no pin written.');
      for (const u of r.unmatched ?? []) console.log(`      ${u.path}: ${u.why}`);
    } else {
      console.log(`  ✓ ${reportSnapshot(f).trim()}`);
      if (r?.changed?.length) {
        console.log(`  ⚠ ${r.changed.length} file(s) CHANGED from what was on disk:`);
        for (const c of r.changed) {
          console.log(`      ${c.name}${c.wasPresent ? '' : '  (new)'}`);
        }
        console.log('    The spine was built from the older bytes. Re-run ingest-base.mjs.');
      }
    }
  } catch (err) {
    failed++;
    console.log(`  ✗ ${err.message}`);
  }
}
console.log('');
process.exitCode = failed ? 1 : 0;
