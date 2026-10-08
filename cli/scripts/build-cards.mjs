#!/usr/bin/env node

/**
 * build-cards.mjs — THE one command. Sources → facts → cards.
 *
 *     node cli/scripts/build-cards.mjs
 *
 * WHAT IT DOES, IN ORDER
 *   1. VERIFY every pinned source against its SNAPSHOT. Re-hashes the bytes on
 *      disk. A source that has drifted stops the build, because a fact derived
 *      from bytes that do not match their release is attributed to a release it
 *      did not come from.
 *   2. SPINE. Rebuild `languages` from ISO 639-3 and Glottolog directly.
 *   3. EXTRACT. Every extractor, each writing facts stamped with the release
 *      they came from. Wholesale per source: an extractor's previous rows are
 *      cleared first, so a correction propagates and a retraction removes.
 *   4. PROJECT. Facts + field spec → cards, into a shadow directory.
 *
 * WHAT IT WILL NOT DO
 *   Write to `cli/shared/language-cards/`. Cutover happens after a shadow diff
 *   has been read and every difference classified — not as a side effect of a
 *   build succeeding. `--out` exists so that is an explicit act.
 *
 * WHY VERIFICATION COMES FIRST AND IS FATAL
 *   The alternative is a build that silently produces cards from whatever
 *   happens to be on disk, which is precisely the situation this whole pass was
 *   convened to end. "Regenerate from source" means the source is checked.
 *
 * Usage:
 *   node cli/scripts/build-cards.mjs                          # full build
 *   node cli/scripts/build-cards.mjs --skip-spine             # facts + cards only
 *   node cli/scripts/build-cards.mjs --only glottolog,wals    # some extractors
 *   node cli/scripts/build-cards.mjs --out build/cards-projected
 *
 * Exit: 0 ok · 1 a step failed · 2 could not run
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verify } from './fetchers/lib/fetch-lib.mjs';
import { openDatabase } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const EXTRACTORS_DIR = path.join(__dirname, 'extractors');

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const OUT = flag('out', 'build/cards-projected');
const ONLY = (flag('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP_SPINE = argv.includes('--skip-spine');

const t0 = Date.now();
const step = (n, title) => console.log(`\n▸ ${n}. ${title}`);

// ── Load extractors ─────────────────────────────────────────────────────────
const extractors = [];
for (const file of fs.readdirSync(EXTRACTORS_DIR).sort()) {
  if (!file.endsWith('.mjs')) continue;
  const mod = await import(pathToFileURL(path.join(EXTRACTORS_DIR, file)).href);
  if (typeof mod.extract === 'function' && mod.source) {
    extractors.push({ file, ...mod });
  }
}
const selected = ONLY.length
  ? extractors.filter((e) => ONLY.includes(e.source)) : extractors;

if (ONLY.length && selected.length !== ONLY.length) {
  const missing = ONLY.filter((s) => !extractors.some((e) => e.source === s));
  console.error(`ERROR: no extractor for: ${missing.join(', ')}`);
  console.error(`Known: ${extractors.map((e) => e.source).join(', ')}`);
  process.exit(2);
}

// ── 1. Verify ───────────────────────────────────────────────────────────────
// A curated extractor pins to its own file's sha256 rather than a SNAPSHOT —
// there is no upstream directory to verify it against, because we are the
// upstream. Its release is registered at extraction time.
const fetched = selected.filter((e) => e.dir);
const curated = selected.filter((e) => !e.dir);

step(1, `Verify ${fetched.length} pinned source(s) against their snapshots`);
let bad = 0;
for (const e of fetched) {
  const r = verify(e.dir);
  if (r.ok) {
    console.log(`    ✓ ${e.source.padEnd(16)} ${r.checked} file(s) match`);
  } else {
    bad++;
    console.log(`    ✗ ${e.source.padEnd(16)} ${r.problems.slice(0, 2)
      .map((p) => `${p.path}: ${p.why}`).join('; ')}`);
  }
}
if (curated.length) {
  console.log(`    (${curated.length} curated source(s) pin to their own content hash: `
    + `${curated.map((c) => c.source).join(', ')})`);
}
if (bad) {
  console.error(`\n  ${bad} source(s) do not match their SNAPSHOT. Build stopped.`);
  console.error('  Facts extracted from drifted bytes would be attributed to a release');
  console.error('  they did not come from. Re-fetch, or investigate what changed.');
  process.exit(1);
}

// ── 2. Spine ────────────────────────────────────────────────────────────────
if (!SKIP_SPINE) {
  step(2, 'Rebuild the language spine from ISO 639-3 + Glottolog');
  try {
    const out = execFileSync('node', [path.join(__dirname, 'ingest-base.mjs')],
      { encoding: 'utf-8' });
    const total = /SPINE TOTAL\s+:\s+([\d,]+)/.exec(out)?.[1];
    const retired = /ISO-RETIRED — codes still in the table/.test(out);
    console.log(`    ✓ ${total ?? '?'} languages`);
    if (retired) {
      console.log('    ⚠ retired ISO codes still carried — see ingest-base output');
    }
  } catch (err) {
    console.error(`    ✗ ${err.message}`);
    process.exit(1);
  }
} else {
  step(2, 'Spine — SKIPPED (--skip-spine)');
}

// ── 3. Extract ──────────────────────────────────────────────────────────────
step(3, `Extract facts from ${selected.length} source(s)`);
const db = openDatabase();
let totalFacts = 0;
for (const e of selected) {
  try {
    const x = e.extract({ db });
    const r = x.commit();
    totalFacts += r.written;
    // Entity extractors have no language spine to fall off.
    const off = typeof x.offSpineReport === 'function' ? x.offSpineReport() : { codes: 0 };
    console.log(`    ✓ ${e.source.padEnd(24)} ${r.written.toLocaleString().padStart(9)} facts`
      + `  (${r.absent.toLocaleString()} absence)`
      + (r.entities ? `  ${r.entities} ${e.entityType}(s)` : '')
      + (off.codes ? `  ⚠ ${off.facts.toLocaleString()} off-spine dropped` : ''));
  } catch (err) {
    console.log(`    ✗ ${e.source.padEnd(24)} ${err.message}`);
    db.close();
    process.exit(1);
  }
}
const pinned = db._db.prepare(
  'SELECT COUNT(*) n FROM facts WHERE source_release_id IS NOT NULL',
).get().n;
const lineage = db._db.prepare('SELECT COUNT(*) n FROM fact_lineage').get().n;
db.close();
console.log(`    ${totalFacts.toLocaleString()} written this run · `
  + `${pinned.toLocaleString()} pinned facts in store · ${lineage.toLocaleString()} lineage edges`);

// ── 4. Project every card type ──────────────────────────────────────────────
//
// One atlas, three kinds of card. They are projected by the same program from
// the same fact store through their own specs — building a method card a
// different way is how a project ends up with two definitions of what a card is.
step(4, 'Project cards');
const TYPES = [
  { type: 'language', out: OUT },
  { type: 'method', out: OUT.replace(/cards-projected$/, 'cards-method') },
  { type: 'corpus', out: OUT.replace(/cards-projected$/, 'cards-corpus') },
];
for (const t of TYPES) {
  const specPath = path.join(__dirname, '..', '..', 'shared',
    t.type === 'language' ? 'card-field-spec.json' : `${t.type}-card-spec.json`);
  if (!fs.existsSync(specPath)) {
    console.log(`    · ${t.type.padEnd(9)} no spec yet — not projected`);
    continue;
  }
  try {
    const out = execFileSync('node',
      [path.join(__dirname, 'project-cards.mjs'), '--type', t.type, '--out', t.out],
      { encoding: 'utf-8' });
    const m = /PROJECTED ([\d,]+) /.exec(out);
    const f = /([\d,]+) field instances/.exec(out);
    console.log(`    ✓ ${t.type.padEnd(9)} ${(m?.[1] ?? '?').padStart(6)} cards, `
      + `${f?.[1] ?? '?'} field instances → ${t.out}/`);
  } catch (err) {
    console.error(`    ✗ ${t.type}: ${String(err.message).split('\n')[0]}`);
    process.exit(1);
  }
}

console.log(`\n  BUILD COMPLETE in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  Cards are in ${OUT}/ — NOT in cli/shared/language-cards/.`);
console.log('  Next:  node cli/scripts/diff-projected-cards.mjs --projected '
  + `${OUT}\n`);
