#!/usr/bin/env node

/**
 * audit-sources.mjs — is every source actually wired, end to end?
 *
 * A source has to survive four separate steps to reach a card, and each step
 * fails SILENTLY when it is skipped:
 *
 *   1. a fetcher exists and exports the standard interface   → `fetch --all` reaches it
 *   2. a pin exists on disk and is tracked in git            → anyone can reproduce it
 *   3. the manifest declares it with a handler               → the build dispatches it
 *   4. the build actually asserted something from it         → it reaches a card
 *
 * Nothing throws when a step is missed. A fetcher that does not export
 * `fetchSource` is skipped by the one command that regenerates everything, and
 * the sweep still prints success for every other source. A dataset that is
 * downloaded and pinned but never declared in the manifest sits on disk looking
 * exactly like one that is in use.
 *
 * That second one is not hypothetical: this script was written because 29
 * datasets — over 200 MB, including doreco, apics, ewave and uratyp — were
 * fetched, pinned, and never declared, so the build had never read one byte of
 * them. Two of them are the upstream for card fields the cutover diff was
 * reporting as "the spec does not define this yet". Nothing was broken. The
 * data was simply not there, and no check looked.
 *
 * REPORTS, DOES NOT DECIDE. A pinned dataset with no manifest entry might be a
 * gap or might be a dataset we deliberately do not use. This says which state
 * each source is in and leaves the verdict to a person, because a script that
 * "helpfully" declared them would be inventing decisions about what the atlas
 * claims.
 *
 * Usage:
 *   node cli/scripts/audit-sources.mjs            # report
 *   node cli/scripts/audit-sources.mjs --strict   # exit 1 on any gap (CI)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const DATA = path.join(REPO, 'cli', 'data');
const FETCHERS = path.join(__dirname, 'fetchers');

const STRICT = process.argv.includes('--strict');

/**
 * Sources that are pinned but deliberately not declared. Each needs a REASON,
 * not just an entry — an allowlist without reasons becomes the place gaps go to
 * be forgotten, which is the failure this whole script exists to catch.
 */
const DELIBERATELY_UNUSED = {
  'dplace-cldf':
    'D-PLACE. NOT a values judgement, and an earlier version of this entry wrongly made it '
    + 'one: v3.3.0 is DOI-pinned and was released 2026-01-13, and societies.csv carries '
    + 'main_focal_year, so the source documents its own vintage. The reason it is out is a '
    + 'SUBJECT MISMATCH: its unit of observation is a SOCIETY (societies.csv keys on a '
    + 'society id and LINKS to a glottocode; several societies can share one), so its '
    + 'values cannot sit on a language card without asserting something about a people '
    + 'that the card is not about. It re-enters when the atlas has a `society` subject, or '
    + 'not at all if the founder decides otherwise. Licence is a separate real constraint: '
    + 'CC-BY-NC-4.0 carves it out of commercial lanes.',
};

async function loadFetchers() {
  const rows = [];
  for (const file of fs.readdirSync(FETCHERS).sort()) {
    if (!file.endsWith('.mjs')) continue;
    const full = path.join(FETCHERS, file);
    let mod = {};
    try {
      mod = await import(pathToFileURL(full).href);
    } catch {
      // A fetcher that will not even import cannot be reached by the sweep;
      // that is exactly the state this reports, so it is not fatal here.
    }
    rows.push({
      file,
      source: mod.source ?? null,
      // `dir` DECLARED as null is a real answer, not an omission: cldf-zenodo
      // pins per dataset and has no single directory of its own. Only an
      // undeclared `dir` means nobody thought about it.
      dir: 'dir' in mod ? mod.dir : undefined,
      dirDeclared: 'dir' in mod,
      callable: typeof mod.fetchSource === 'function',
    });
  }
  return rows;
}

function pinnedDirs() {
  if (!fs.existsSync(DATA)) return [];
  return fs.readdirSync(DATA, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(DATA, d.name, 'SNAPSHOT.json')))
    .map((d) => d.name);
}

function trackedPins() {
  try {
    return new Set(
      execFileSync('git', ['ls-files', 'cli/data'], { cwd: REPO, encoding: 'utf-8' })
        .split('\n').filter((l) => l.endsWith('/SNAPSHOT.json'))
        .map((l) => l.split('/')[2]),
    );
  } catch {
    return null;
  }
}

function dirSizeMb(name) {
  try {
    const out = execFileSync('du', ['-sk', path.join(DATA, name)], { encoding: 'utf-8' });
    return Math.round(Number(out.split('\t')[0]) / 1024);
  } catch {
    return null;
  }
}

const fetchers = await loadFetchers();
const manifest = JSON.parse(
  fs.readFileSync(path.join(REPO, 'shared/cldf/source-manifest.json'), 'utf-8'),
).sources;
const pins = pinnedDirs();
const tracked = trackedPins();
const declared = new Set(Object.keys(manifest));
const pinSet = new Set(pins);

const problems = [];
const note = (severity, kind, detail) => problems.push({ severity, kind, detail });

console.log('\n  SOURCE AUDIT — four steps, each of which fails silently\n');

// ── 1. fetchers reachable by `fetch --all` ────────────────────────────────
const unreachable = fetchers.filter((f) => !f.source || !f.dirDeclared || !f.callable);
console.log(`  1. FETCHERS — ${fetchers.length} file(s), `
  + `${fetchers.length - unreachable.length} reachable by the one command`);
for (const f of unreachable) {
  const missing = [
    !f.source && 'source', !f.dirDeclared && 'dir', !f.callable && 'fetchSource()',
  ].filter(Boolean).join(', ');
  console.log(`     ✗ ${f.file.padEnd(26)} does not export: ${missing}`);
  note('gap', 'fetcher-unreachable',
    `${f.file} is skipped by \`fetch --all\` and \`--verify\` (missing ${missing})`);
}
if (!unreachable.length) console.log('     ✓ all export source, dir and fetchSource()');

// ── 2. pins present and reproducible ──────────────────────────────────────
console.log(`\n  2. PINS — ${pins.length} on disk`);
if (tracked) {
  const untracked = pins.filter((p) => !tracked.has(p));
  if (untracked.length) {
    console.log(`     ✗ ${untracked.length} pin(s) not tracked in git: ${untracked.join(', ')}`);
    note('gap', 'pin-untracked',
      `${untracked.length} SNAPSHOT.json not committed — cli/data/ is ignored, so these `
      + 'sources build here and are unreproducible everywhere else');
  } else {
    console.log('     ✓ every pin is committed, so every source is reproducible');
  }
} else {
  console.log('     · not a git checkout; skipped');
}

// ── 3. declared in the manifest, so the build dispatches it ───────────────
const pinNoManifest = pins.filter((p) => !declared.has(p) && !DELIBERATELY_UNUSED[p]);
const manifestNoPin = [...declared].filter((s) => !pinSet.has(s) && !s.startsWith('curated:'));
console.log(`\n  3. MANIFEST — ${declared.size} declared source(s)`);
if (pinNoManifest.length) {
  const withSize = pinNoManifest
    .map((p) => ({ p, mb: dirSizeMb(p) }))
    .sort((a, b) => (b.mb ?? 0) - (a.mb ?? 0));
  const totalMb = withSize.reduce((a, x) => a + (x.mb ?? 0), 0);
  console.log(`     ✗ ${pinNoManifest.length} dataset(s) pinned but NOT declared `
    + `(${totalMb} MB fetched and never read):`);
  for (const { p, mb } of withSize.slice(0, 12)) {
    console.log(`         ${p.padEnd(30)} ${mb === null ? '' : `${mb} MB`}`);
  }
  if (withSize.length > 12) console.log(`         … and ${withSize.length - 12} more`);
  note('gap', 'pinned-undeclared',
    `${pinNoManifest.length} dataset(s) are downloaded and pinned but absent from the `
    + 'manifest, so the build never reads them. Each needs a verdict: declare it with a '
    + 'handler, or record why it is deliberately unused.');
}
if (manifestNoPin.length) {
  console.log(`     ✗ ${manifestNoPin.length} declared source(s) have no pin: `
    + manifestNoPin.join(', '));
  note('gap', 'declared-unpinned',
    `${manifestNoPin.length} manifest source(s) have no SNAPSHOT — the build cannot verify them`);
}
for (const [name, why] of Object.entries(DELIBERATELY_UNUSED)) {
  if (pinSet.has(name)) console.log(`     · ${name} — deliberately unused: ${why.slice(0, 68)}…`);
}
if (!pinNoManifest.length && !manifestNoPin.length) {
  console.log('     ✓ every pin is declared and every declaration is pinned');
}

// ── 4. a fetcher exists for what we declare ───────────────────────────────
// Not every source needs its own fetcher — most CLDF datasets come through the
// shared Zenodo harvest — so this reports reach rather than demanding parity.
const fetcherSources = new Set(fetchers.map((f) => f.source).filter(Boolean));
const covered = [...declared].filter((s) => fetcherSources.has(s)).length;
console.log(`\n  4. REACH — ${covered} declared source(s) have a dedicated fetcher; `
  + `the rest come through the shared CLDF harvest`);

console.log(`\n  ${problems.length ? `${problems.length} GAP(S)` : 'NO GAPS'}\n`);
for (const p of problems) console.log(`    · ${p.kind}: ${p.detail}\n`);

if (STRICT && problems.length) process.exit(1);
