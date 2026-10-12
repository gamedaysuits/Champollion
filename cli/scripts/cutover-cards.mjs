#!/usr/bin/env node

/**
 * cutover-cards.mjs — make the projected cards the real ones.
 *
 * WHAT THIS DOES, AND WHY IT IS ITS OWN PROGRAM
 *   Replaces `cli/shared/language-cards/` with build output. From then on the
 *   corpus is a BUILD ARTEFACT: reproducible from pinned sources by one
 *   command, and never hand-edited again.
 *
 *   It is separate from the build on purpose. A build that silently replaced the
 *   corpus would mean every experiment, every half-finished extractor, every
 *   spec typo went straight to the thing the CLI, the harness and the website
 *   read. Cutover is a decision; building is not.
 *
 * THE FOUR GATES
 *   1. The disposition register agrees with reality — every live field has a
 *      decision, every DONE is built, nothing is built that is not decided.
 *      Without this, cutover DELETES whatever the spec has not reached yet.
 *   2. The projection exists and is non-empty.
 *   3. No projected card carries a null, an empty string, an empty array or an
 *      empty object — the web must never render a blank row.
 *   4. A backup is taken first, and its restore command is printed.
 *
 * WHAT IT DOES NOT CHECK, AND SAYS SO
 *   It cannot tell you the projection is CORRECT. That is what the shadow diff
 *   is for, and reading it is a human act. This gate refuses the obviously
 *   unsafe; it does not certify the subtle.
 *
 * Usage:
 *   node cli/scripts/cutover-cards.mjs                  # dry run, always
 *   node cli/scripts/cutover-cards.mjs --apply
 *   node cli/scripts/cutover-cards.mjs --restore <dir>  # undo
 *
 * Exit: 0 ok · 1 a gate failed · 2 could not run
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const LIVE = path.join(REPO, 'cli', 'shared', 'language-cards');
const PROJECTED = path.join(REPO, 'build', 'atlas', 'cards-language');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const RESTORE = argv[argv.indexOf('--restore') + 1];

if (argv.includes('--restore')) {
  if (!RESTORE || !fs.existsSync(RESTORE)) {
    console.error(`ERROR: --restore needs an existing backup directory.`);
    process.exit(2);
  }
  fs.rmSync(LIVE, { recursive: true, force: true });
  fs.cpSync(RESTORE, LIVE, { recursive: true });
  console.log(`  ✓ restored ${LIVE} from ${RESTORE}`);
  process.exit(0);
}

console.log('\n  CUTOVER — replacing the live card corpus with build output\n');

// ── Gate 1: the register and reality agree ─────────────────────────────────
process.stdout.write('  1. field disposition … ');
try {
  execFileSync('node', [path.join(__dirname, 'audit-field-disposition.mjs')],
    { encoding: 'utf-8' });
  console.log('✓ every live field has a decision');
} catch {
  console.log('✗');
  console.error('\n  The disposition register disagrees with reality. Cutover would');
  console.error('  DELETE whatever the spec has not reached yet, silently.');
  console.error('  Run: node cli/scripts/audit-field-disposition.mjs');
  process.exit(1);
}

// ── Gate 2: there is something to cut over to ──────────────────────────────
process.stdout.write('  2. projection present … ');
if (!fs.existsSync(PROJECTED)) {
  console.log('✗');
  console.error(`\n  ${PROJECTED} does not exist. Run build-cards.mjs first.`);
  process.exit(1);
}
// LOCALES SHIP WITH LANGUAGES.
//
// `fra-CA`, `por-PT`, `spa-MX` and `cmn-Hant` are translation targets the CLI
// offers, and they are locale projections rather than spine languages. Copying
// only cards-language left them out of the live corpus entirely — the previous
// cutover silently dropped four working targets, which is precisely the
// "nothing disappears without a decision" failure the gates exist to catch.
//
// They are read from their own directory and copied alongside, so a locale is
// resolvable by exactly the same lookup as a language.
const LOCALES = path.join(REPO, 'build', 'atlas', 'cards-locale');
const localeFiles = fs.existsSync(LOCALES)
  ? fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json')) : [];

const projFiles = fs.readdirSync(PROJECTED).filter((f) => f.endsWith('.json'));
const liveFiles = fs.existsSync(LIVE)
  ? fs.readdirSync(LIVE).filter((f) => f.endsWith('.json') && f !== 'language-tree.json') : [];
if (!projFiles.length) {
  console.log('✗');
  console.error('\n  The projection is empty.');
  process.exit(1);
}

// A PARTIAL BUILD MUST NEVER BECOME THE LIVE CORPUS.
//
// `build-atlas.mjs --only grambank` writes real cards to the same directory a
// full build uses. Gate 2's only other test is "not empty", so a forty-card
// subset would have replaced 8,685 live cards and reported success. The build
// now stamps `partial` into ATLAS-RELEASE.json; this refuses it.
const RELEASE_FILE = path.join(REPO, 'build', 'atlas', 'ATLAS-RELEASE.json');
try {
  const release = JSON.parse(fs.readFileSync(RELEASE_FILE, 'utf-8'));
  if (Array.isArray(release.partial) && release.partial.length) {
    console.log('✗');
    console.error(`\n  This projection came from a PARTIAL build (--only `
      + `${release.partial.join(', ')}).`);
    console.error('  It covers a subset of sources, so cutting over would delete every');
    console.error('  card the other sources contribute. Run a full build first:');
    console.error('    node cli/scripts/cldf/build-atlas.mjs\n');
    process.exit(1);
  }
  // AN UNVERSIONED BUILD MUST NEVER BECOME THE LIVE CORPUS.
  //
  // Every card stamps `_atlas.version`, and requireAtlas() — the designed-in
  // drift tripwire — compares against it. The first cutover shipped
  // 'unreleased' onto all 17,360 cards, which made the tripwire structurally
  // inert: no consumer can pin a build nobody named. Building unversioned
  // stays cheap (experiments never need a name); CUTTING OVER is the release
  // act, and a release has a name:
  //   node cli/scripts/cldf/build-atlas.mjs --version 2026.8.0
  if (!release.version || release.version === 'unreleased') {
    console.log('✗');
    console.error('\n  This projection is UNVERSIONED (version: '
      + `${JSON.stringify(release.version ?? null)}).`);
    console.error('  Cutover is the release act — rebuild with a release label:');
    console.error('    node cli/scripts/cldf/build-atlas.mjs --version <YYYY.M.P>\n');
    process.exit(1);
  }
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.log('✗');
    console.error(`\n  ${RELEASE_FILE} is unreadable (${err.message}).`);
    console.error('  Refusing to cut over from a projection whose provenance cannot be read.');
    process.exit(1);
  }
}

// A LOCALE CORPUS THAT EXISTS MUST NOT VANISH BECAUSE ITS DIRECTORY DID.
//
// The delete pass below removes every .json in LIVE that the copy pass does not
// restore. `cards-locale` was optional, and this gate counted only
// `cards-language` — so a build that emitted no locale directory (a crash after
// language projection, a `--only` run, a stale tree) would have deleted all
// 8,675 live locale cards and reported success. That is the same failure the
// locale support was written to fix, at two thousand times the scale.
//
// The disposition audit cannot cover this: `locale` and `localeScoped` are
// status PROJECTED, which it deliberately skips.
const liveLocales = liveFiles.filter((f) => {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(LIVE, f), 'utf-8'));
    return Boolean(c?.locale?.language);
  } catch { return false; }
}).length;
if (liveLocales > 0 && localeFiles.length === 0) {
  console.log('✗');
  console.error(`\n  The live corpus has ${liveLocales.toLocaleString()} locale card(s) and this`);
  console.error(`  build produced none. ${LOCALES}`);
  console.error('  is missing or empty, so cutover would DELETE every one of them.');
  console.error('\n  Rebuild the atlas before cutting over. If locale cards are being retired');
  console.error('  on purpose, record that decision first — a deletion this size is not');
  console.error('  something a gate should infer from an absent directory.');
  process.exit(1);
}
console.log(`✓ ${projFiles.length.toLocaleString()} cards + `
  + `${localeFiles.length.toLocaleString()} locale(s) (live: ${liveFiles.length.toLocaleString()})`);

// ── Gate 3: nothing renders as a blank ─────────────────────────────────────
process.stdout.write('  3. no null or empty values … ');
const BOOK = new Set(['_fieldSources', '_generated', '_card', '_atlas', '_config']);
// Fields where NULL is the value's MEANING, not an omission. OPUS publishes no
// alignment count for a fifth of its pairs, and the fetcher records null there
// PRECISELY so "not published" can never render as "measured, and zero" — the
// same rule that keeps Ubuntu's 23,988 unsized pairs from claiming emptiness.
// Deleting these nulls at cutover would undo that distinction; a consumer that
// renders them still must render "unknown", never a blank.
const NULL_IS_THE_FACT = new Set([
  'alignmentPairs', 'sourceTokens', 'targetTokens', 'largestPairAlignments',
  'alignmentPairsTotal', 'license', 'version', 'lastModified', 'archiveBytes',
]);
let bad = 0;
let firstBad = null;
const walk = (o, p, file) => {
  if (o === null || o === '') {
    const leaf = p.split('.').pop();
    if (o === null && NULL_IS_THE_FACT.has(leaf)) return;
    bad++; firstBad ??= `${file}: ${p}`; return;
  }
  if (Array.isArray(o)) {
    if (!o.length) { bad++; firstBad ??= `${file}: ${p} (empty array)`; return; }
    for (const i of o) walk(i, p, file);
    return;
  }
  if (typeof o === 'object') {
    if (!Object.keys(o).length) { bad++; firstBad ??= `${file}: ${p} (empty object)`; return; }
    for (const [k, v] of Object.entries(o)) {
      if (BOOK.has(k)) continue;
      walk(v, p ? `${p}.${k}` : k, file);
    }
  }
};
for (const f of projFiles) {
  walk(JSON.parse(fs.readFileSync(path.join(PROJECTED, f), 'utf-8')), '', f);
}
// Locales are shipped by this script, so they are checked by it. They were
// copied at the end without ever passing this gate, which meant the "an empty
// row on the web asserts there is nothing to know" invariant held for 8,685
// cards and not for the 8,675 beside them.
for (const f of localeFiles) {
  walk(JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf-8')), '', `locale/${f}`);
}
if (bad) {
  console.log('✗');
  console.error(`\n  ${bad} null/empty value(s), first at ${firstBad}.`);
  console.error('  A field with nothing in it must be OMITTED, not published empty —');
  console.error('  an empty row on the web asserts that there is nothing to know.');
  process.exit(1);
}
console.log('✓ every projected field carries a real value');

// ── Gate 4: backup ─────────────────────────────────────────────────────────
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
const backup = path.join(REPO, 'build', `language-cards-backup-${stamp}`);

if (!APPLY) {
  console.log('\n  DRY RUN — nothing moved.');
  console.log(`    would replace ${liveFiles.length.toLocaleString()} live card(s) `
    + `with ${projFiles.length.toLocaleString()} projected`);
  console.log(`    would back up to build/language-cards-backup-<stamp>/`);
  console.log('\n  This gate refuses the obviously unsafe. It CANNOT tell you the');
  console.log('  projection is correct — that is what the shadow diff is for, and');
  console.log('  reading it is a human act:');
  console.log('    node cli/scripts/diff-projected-cards.mjs --projected build/atlas/cards-language');
  console.log('\n  Then re-run with --apply.\n');
  process.exit(0);
}

console.log(`  4. backing up → build/${path.basename(backup)}/ …`);
fs.cpSync(LIVE, backup, { recursive: true });

// Preserve everything in the directory that is NOT a projected card: the
// language-tree index, and the genera/ subdirectory of card templates. Those
// are not projection output and deleting them would be collateral damage from
// a cutover that was only ever meant to replace cards.
//
// Directories matter here: an earlier version read every preserved entry with
// readFileSync and died on genera/. Keep the check on the filesystem, not on
// the filename.
const preserved = fs.readdirSync(LIVE, { withFileTypes: true })
  .filter((e) => e.isDirectory() || !e.name.endsWith('.json') || e.name === 'language-tree.json')
  .map((e) => e.name);
const keep = new Set(preserved);

// THE UNDO IS PRINTED BEFORE THE DAMAGE, NOT AFTER IT.
//
// Delete-then-copy is not transactional: an ENOSPC or EPERM part-way through
// leaves the corpus half-replaced. The restore command used to be printed only
// on success, which is exactly when it is not needed. An operator staring at a
// broken corpus needs it on screen already.
console.log(`\n  Replacing the corpus now. If this fails part-way, restore with:`);
console.log(`    node cli/scripts/cutover-cards.mjs --restore ${backup}\n`);

try {
  for (const f of fs.readdirSync(LIVE)) {
    if (keep.has(f)) continue;
    fs.rmSync(path.join(LIVE, f), { recursive: true, force: true });
  }
  for (const f of projFiles) {
    fs.copyFileSync(path.join(PROJECTED, f), path.join(LIVE, f));
  }
  // Locales after languages. The claim that a locale id can never collide with
  // a spine code is CHECKED rather than asserted: locales are copied second, so
  // a collision would silently overwrite a language card with a locale one.
  for (const f of localeFiles) {
    if (projFiles.includes(f)) {
      throw new Error(`locale card ${f} collides with a language card of the same name — `
        + 'refusing to overwrite a language with a locale. The locale id scheme '
        + '(code + script? + region) is supposed to make this impossible, so this '
        + 'means the projector produced something unexpected.');
    }
    fs.copyFileSync(path.join(LOCALES, f), path.join(LIVE, f));
  }
} catch (err) {
  console.error(`\n  ✗ CUTOVER FAILED PART-WAY: ${err.message}`);
  console.error('\n  The corpus may be incomplete. Restore it with:');
  console.error(`    node cli/scripts/cutover-cards.mjs --restore ${backup}\n`);
  process.exit(1);
}

console.log(`\n  ✓ CUTOVER COMPLETE`);
console.log(`    ${projFiles.length.toLocaleString()} language cards are now build output`);
console.log(`    ${localeFiles.length.toLocaleString()} locale cards alongside them`);
console.log(`    ${preserved.length} non-card file(s) preserved: ${preserved.join(', ') || '(none)'}`);
console.log(`    backup: build/${path.basename(backup)}/`);
console.log(`\n  Undo:  node cli/scripts/cutover-cards.mjs --restore ${backup}`);
console.log('\n  The corpus is now a BUILD ARTEFACT. Hand-editing a card means');
console.log('  losing the edit on the next build — fix the extractor or the spec.\n');
