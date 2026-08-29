#!/usr/bin/env node

/**
 * build-cldr-snapshot.mjs
 * ────────────────────────────────────────────────────────────────
 * Materializes the pinned CLDR locale snapshot at data/cldr/ —
 * one <locale>.json per BASE-LANGUAGE locale in CLDR common/main,
 * each a verbatim byte copy of that locale's layout.json from the
 * cldr-misc-full npm package (unicode-org/cldr-json).
 *
 * WHY THIS EXISTS:
 *   scripts/derive-database-coverage.mjs derives
 *   databaseCoverage.cldr by FILENAME only: a card is covered iff
 *   <card.code>.json or <card.iso639_1>.json exists in data/cldr/.
 *   The original snapshot was gitignored and died with the
 *   pre-2026-07-08 machine, leaving 219 cards riding the script's
 *   preserve-on-absent-snapshot lane. The rebuilt snapshot is
 *   committed (force-added past the cli/data/ ignore rule, like
 *   data/glottolog/) so it can never be silently lost again.
 *
 * PINNING:
 *   The release is pinned by cli/package-lock.json — the same
 *   cldr-json release every other CLDR enrichment script consumes
 *   from node_modules (cards cite it as "cldr-48"). This script
 *   FAILS if the installed package version disagrees with the
 *   lockfile, so the snapshot can only ever be built from the
 *   pinned artifact. Bump the pin by updating package.json /
 *   package-lock.json, re-running this script, and updating
 *   data/cldr/README.txt.
 *
 * VARIANTS:
 *   Regional/script variant locales (en-GB, sr-Latn, …) are NOT
 *   materialized: they can never match a card code, and it is
 *   asserted below that every variant's base language exists as
 *   its own locale in common/main.
 *
 * Usage:
 *   node scripts/build-cldr-snapshot.mjs
 *   node scripts/build-cldr-snapshot.mjs --dry-run
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const NM = path.join(CLI_ROOT, 'node_modules');
const OUT_DIR = path.join(CLI_ROOT, 'data', 'cldr');
const DRY_RUN = process.argv.includes('--dry-run');

function fail(msg) {
  console.error(`\n  ❌ ${msg}\n`);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CLDR Snapshot Build');
  console.log('  Source: cldr-misc-full + cldr-core (npm, lockfile-pinned)');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Version coherence: installed packages must match the lockfile ──
  const lockPath = path.join(CLI_ROOT, 'package-lock.json');
  if (!fs.existsSync(lockPath)) fail('cli/package-lock.json not found');
  const lock = readJson(lockPath);

  const versions = {};
  for (const pkg of ['cldr-core', 'cldr-misc-full']) {
    const pkgJsonPath = path.join(NM, pkg, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      fail(`${pkg} is not installed — run \`npm install\` in cli/ first (worktrees: symlink cli/node_modules)`);
    }
    const installed = readJson(pkgJsonPath).version;
    const locked = lock.packages?.[`node_modules/${pkg}`]?.version;
    if (!locked) fail(`${pkg} missing from package-lock.json`);
    if (installed !== locked) {
      fail(`${pkg} installed ${installed} ≠ lockfile ${locked} — refusing to build from an unpinned artifact`);
    }
    versions[pkg] = installed;
  }
  if (versions['cldr-core'] !== versions['cldr-misc-full']) {
    fail(`cldr-core ${versions['cldr-core']} ≠ cldr-misc-full ${versions['cldr-misc-full']} — cldr-json packages must move in lockstep`);
  }
  const version = versions['cldr-misc-full'];
  console.log(`  cldr-json release: ${version} (installed = lockfile ✓)`);

  // ── Locale universe: misc-full main dirs, cross-checked against ──
  // ── cldr-core availableLocales.full (they must be identical)    ──
  const mainDir = path.join(NM, 'cldr-misc-full', 'main');
  const dirs = fs.readdirSync(mainDir).filter(d => !d.startsWith('.'));
  const avail = readJson(path.join(NM, 'cldr-core', 'availableLocales.json'))
    ?.availableLocales?.full;
  if (!Array.isArray(avail)) fail('cldr-core availableLocales.json: expected availableLocales.full array');
  const dirSet = new Set(dirs);
  const availSet = new Set(avail);
  const onlyAvail = avail.filter(l => !dirSet.has(l));
  const onlyDirs = dirs.filter(l => !availSet.has(l));
  if (onlyAvail.length || onlyDirs.length) {
    fail(`availableLocales.full and cldr-misc-full/main disagree — only in availableLocales: [${onlyAvail}], only in main/: [${onlyDirs}]`);
  }
  console.log(`  Locales in common/main: ${dirs.length} (= availableLocales.full ✓)`);

  // ── Base-language set; every base must exist as its own locale ──
  // 'und' is CLDR's root locale (identity.language: "root", BCP 47
  // "undetermined") — it is not a language and no card can match it.
  const bases = [...new Set(dirs.map(d => d.split('-')[0]))]
    .filter(b => b !== 'und')
    .sort();
  console.log(`  Excluded: und (CLDR root locale, not a language)`);
  const missingBare = bases.filter(b => !dirSet.has(b));
  if (missingBare.length) {
    fail(`variant locales whose base language has no bare locale in common/main: [${missingBare}] — base-only materialization would drop coverage`);
  }
  console.log(`  Base languages: ${bases.length}`);

  // ── Materialize: verbatim layout.json → <base>.json ──
  let written = 0, unchanged = 0;
  for (const b of bases) {
    const src = path.join(mainDir, b, 'layout.json');
    if (!fs.existsSync(src)) fail(`${b}: layout.json missing from cldr-misc-full/main/${b}/`);
    const raw = fs.readFileSync(src);
    let parsed;
    try { parsed = JSON.parse(raw.toString('utf-8')); } catch { fail(`${b}: layout.json is not valid JSON`); }
    if (parsed?.main?.[b]?.identity?.language !== b) {
      fail(`${b}: layout.json identity.language ≠ '${b}' — refusing to write a mislabeled locale file`);
    }
    const dest = path.join(OUT_DIR, `${b}.json`);
    if (fs.existsSync(dest) && fs.readFileSync(dest).equals(raw)) {
      unchanged++;
      continue;
    }
    if (!DRY_RUN) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(dest, raw);
    }
    written++;
  }

  // ── Remove stale locale files (full-regeneration semantics) ──
  const baseSet = new Set(bases);
  const stale = fs.existsSync(OUT_DIR)
    ? fs.readdirSync(OUT_DIR)
        .filter(f => f.endsWith('.json') && !baseSet.has(f.replace(/\.json$/, '')))
    : [];
  for (const f of stale) {
    console.log(`  ⚠️  removing stale locale file: ${f}`);
    if (!DRY_RUN) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Locale files written:   ${written}`);
  console.log(`  Unchanged (byte-equal): ${unchanged}`);
  console.log(`  Stale files removed:    ${stale.length}`);
  console.log('\n  Next: node scripts/derive-database-coverage.mjs');
  console.log('  (consumes this directory by FILENAME only)');
  if (DRY_RUN) console.log('\n  ℹ  DRY RUN — no files were modified');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
