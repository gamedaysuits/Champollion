#!/usr/bin/env node

/**
 * archive-legacy.mjs — retire the old card pipeline, once, with a record.
 *
 * FOUNDER RULING, 2026-08-04: "We are not to be migrating anything, just
 * archive that. We are re-ingesting and rebuilding."
 *
 * WHAT IS BEING RETIRED AND WHY
 *   The previous corpus was written by ~93 scripts, most of them merge-only
 *   ("skip if already populated"). Three consequences followed, and all three
 *   are why the atlas is being rebuilt rather than repaired:
 *
 *     - a wrong value could never be corrected by re-running
 *     - a retracted upstream claim was never removed
 *     - re-running reproduced nothing, because every script no-opped
 *
 *   The thirteen fix-*, decontaminate-* and cleanup-* scripts are the
 *   accumulated cost of that design. Wholesale projection makes every one of
 *   them structurally unnecessary: the way to change a card is now to change an
 *   extractor and rebuild.
 *
 *   Leaving them on disk is not neutral. Any of them can still be run, and each
 *   one mutates the live corpus in place — which is exactly the thing that must
 *   stop being possible.
 *
 * THE LAUNDERING FILE
 *   `shared/curated-facts/language-facts.json` is stamped
 *   `_migratedFrom: cli/shared/language-cards/`. It is the previous corpus read
 *   back in as though it were a source, so the generator would reproduce
 *   unverifiable content under new provenance. 1,854 of its entries are
 *   `experts` whose values are ARCHIVES, not people. It is archived, not
 *   repaired, and nothing reads it.
 *
 * WHAT IS DELIBERATELY *NOT* ARCHIVED YET
 *   `cli/shared/language-cards/` itself. The CLI, harness and website still
 *   serve it, and it is replaced at CUTOVER, not before. Archiving it now would
 *   break every consumer for no gain — the new corpus is already built beside
 *   it and the tests already forbid reading it back into the pipeline.
 *
 * GIT IS THE ARCHIVE
 *   Deleted files remain in history and are recoverable by path. This script
 *   records WHAT was retired and WHY in a manifest, because a git deletion says
 *   when something went and never says what it was for.
 *
 * Usage:
 *   node cli/scripts/cldf/archive-legacy.mjs            # dry run
 *   node cli/scripts/cldf/archive-legacy.mjs --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..', '..');
const SCRIPTS = path.join(REPO, 'cli', 'scripts');
const ARCHIVE = path.join(REPO, 'build', 'archive-2026-08-05');
const MANIFEST = path.join(REPO, 'shared', 'cldf', 'retired-pipeline.json');

const APPLY = process.argv.includes('--apply');

/** Scripts that mutate the live corpus in place. All merge-only or dead. */
const LEGACY_PREFIXES = /^(enrich-|fix-|decontaminate-|normalize-|stamp-|cleanup-)/;
// Deliberately NOT listed: ingest-cldf.mjs and ingest-base.mjs. Both still have
// live referrers inside the previous pipeline (build-cards.mjs, export-cldf.mjs,
// download-cldf-datasets.mjs, …), and that whole cluster is retired together at
// CUTOVER when its consumers go too. Pulling one out now would leave a broken
// pipeline standing next to a working one, which is worse than leaving both.
const LEGACY_EXACT = new Set();

/** Files moved to the archive rather than deleted, because they hold content. */
const MOVE = [
  {
    from: 'shared/curated-facts/language-facts.json',
    why: 'The previous corpus read back in as a source. Stamped _migratedFrom, '
      + 'author "champollion-curation" on every entry, and 1,854 "experts" whose values '
      + 'are archives rather than people. Archived, never migrated.',
  },
];

/**
 * Tests that exist only to guard retired machinery.
 *
 * Empty on purpose. enrich-cards-bulk.test.js belongs here on the merits — it
 * tests mergeEnrichment, the merge-only pattern being retired — but it is also
 * the ONLY referrer of enrich-cards-bulk.mjs. Deleting the test would orphan the
 * script one step after the referrer check had decided to keep it, leaving a
 * script nothing calls and no record of why it survived. The pair goes together
 * at cutover.
 */
const TESTS = [];

/**
 * Anything still imported or invoked elsewhere is NOT retired here, whatever its
 * name suggests. Checked mechanically rather than by eye: I had listed
 * ingest-base.mjs for deletion and it turned out to have five referrers, which
 * is the kind of thing a prefix rule cannot know and a person should not be
 * trusted to remember.
 */
function referrers(name) {
  const stem = name.replace(/\.(mjs|py)$/, '');
  const roots = ['cli/scripts', 'cli/lib', 'cli/bin', 'cli/test', 'cli/website/src',
    'arena/mt_eval_harness', 'mcp-server/src'];
  const hits = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(mjs|js|py|json)$/.test(e.name)) continue;
      const rel = path.relative(REPO, full);
      if (rel.endsWith(`scripts/${name}`)) continue;      // itself
      if (rel.startsWith('cli/scripts/cldf/')) continue;  // the new pipeline only mentions it in prose
      let src;
      try { src = fs.readFileSync(full, 'utf-8'); } catch { continue; }
      // Strip comments: a header explaining what a script REPLACED is not a use.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
      if (code.includes(stem)) hits.push(rel);
    }
  };
  for (const r of roots) walk(path.join(REPO, r));
  return hits;
}

const retired = [];
const kept = [];
for (const f of fs.readdirSync(SCRIPTS).sort()) {
  if (!f.endsWith('.mjs') && !f.endsWith('.py')) continue;
  if (!LEGACY_PREFIXES.test(f) && !LEGACY_EXACT.has(f)) continue;
  const refs = referrers(f);
  if (refs.length) { kept.push({ file: f, referrers: refs }); continue; }
  retired.push(f);
}

console.log(`\n  RETIRE THE LEGACY CARD PIPELINE${APPLY ? '' : '  (dry run)'}\n`);
console.log(`    ${retired.length} in-place mutating script(s)`);
console.log(`    ${MOVE.length} content file(s) to archive`);
console.log(`    ${TESTS.length} test file(s) guarding retired machinery`);
if (kept.length) {
  console.log(`\n    ${kept.length} KEPT — still referenced, so retired with their consumers at cutover:`);
  for (const k of kept) console.log(`      ${k.file.padEnd(38)} ← ${k.referrers.slice(0, 2).join(', ')}`);
}

if (!APPLY) {
  console.log('\n    scripts:');
  for (const f of retired) console.log(`      ${f}`);
  console.log('\n  Re-run with --apply.\n');
  process.exit(0);
}

fs.mkdirSync(ARCHIVE, { recursive: true });

// ── Move content ────────────────────────────────────────────────────────────
const moved = [];
for (const m of MOVE) {
  const src = path.join(REPO, m.from);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(ARCHIVE, path.basename(m.from));
  fs.copyFileSync(src, dest);
  fs.rmSync(src, { force: true });
  moved.push({ ...m, bytes: fs.statSync(dest).size, archivedTo: path.relative(REPO, dest) });
  console.log(`    archived  ${m.from}`);
}
// Remove the directory only if the move emptied it.
const curatedDir = path.join(REPO, 'shared', 'curated-facts');
if (fs.existsSync(curatedDir) && fs.readdirSync(curatedDir).length === 0) {
  fs.rmdirSync(curatedDir);
}

// ── Delete scripts and their tests ──────────────────────────────────────────
for (const f of retired) fs.rmSync(path.join(SCRIPTS, f), { force: true });
for (const t of TESTS) fs.rmSync(path.join(REPO, t.file), { force: true });
const deadExtractor = path.join(SCRIPTS, 'extractors', 'curated-language.mjs');
const hadDeadExtractor = fs.existsSync(deadExtractor);
if (hadDeadExtractor) fs.rmSync(deadExtractor, { force: true });

// ── Record ──────────────────────────────────────────────────────────────────
const commit = (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf-8' }).trim();
  } catch { return null; }
})();

fs.writeFileSync(MANIFEST, `${JSON.stringify({
  _doc:
    'The card pipeline retired on 2026-08-05, and why. Git history is the archive — '
    + 'every deleted file is recoverable by path from the commit recorded here. This '
    + 'manifest exists because a git deletion records WHEN something went and never '
    + 'records what it was for.',
  retiredOn: '2026-08-05',
  parentCommit: commit,
  reason:
    'The previous corpus was written by ~93 scripts, most merge-only. A wrong value '
    + 'could never be corrected by re-running, a retracted upstream claim was never '
    + 'removed, and re-running reproduced nothing because every script no-opped. The '
    + 'thirteen fix-/decontaminate-/cleanup- scripts are the accumulated cost. Wholesale '
    + 'projection makes them structurally unnecessary: the way to change a card is now '
    + 'to change an extractor and rebuild. Leaving them on disk is not neutral — each '
    + 'one can still be run, and each mutates the live corpus in place.',
  notArchivedYet: {
    'cli/shared/language-cards/':
      'Still served by the CLI, harness and website. Replaced at CUTOVER, not before. '
      + 'The new corpus is already built beside it, and cli/test/cldf-atlas.test.js '
      + 'already forbids any atlas script from reading it back in.',
  },
  archivedFiles: moved,
  deletedScripts: retired,
  keptBecauseStillReferenced: kept,
  deletedTests: TESTS,
  deletedExtractors: hadDeadExtractor
    ? [{ file: 'cli/scripts/extractors/curated-language.mjs', why: 'Read the archived laundering file. Dead once it was archived.' }]
    : [],
}, null, 2)}\n`);

console.log(`\n  ✓ ${retired.length} script(s) and ${TESTS.length} test(s) deleted`);
console.log(`    ${moved.length} file(s) archived to build/${path.basename(ARCHIVE)}/`);
console.log(`    record: ${path.relative(REPO, MANIFEST)}`);
console.log('\n  Git history is the archive. Recover any file by path from '
  + `${commit?.slice(0, 12) ?? 'the parent commit'}.\n`);
