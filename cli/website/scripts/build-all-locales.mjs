#!/usr/bin/env node

/**
 * build-all-locales.mjs — per-locale, per-PROCESS Docusaurus production build.
 * ───────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *   `docusaurus build` builds all i18n locales sequentially inside ONE Node
 *   process (see @docusaurus/core build.js → mapAsyncSequential over locales).
 *   Heap is never reclaimed between locales, so on a constrained box
 *   (Vercel: 4 cores / 8 GB) memory climbs until ~locale 11 (vi) and the
 *   process is SIGKILLed — "At least one Out of Memory event was detected."
 *   The Docusaurus maintainer documents this exact problem in build.js and
 *   names child-process-per-locale as the fix. This script is that fix: each
 *   locale builds in a fresh child process whose memory is fully released on
 *   exit, and the heap ceiling is right-sized PER PROCESS (default 4096 MB)
 *   instead of being set to the whole machine.
 *
 * HOW THE TREE COMPOSES (identical to the all-in-one build)
 *   default locale (en) → build/          (baseUrl "/")
 *   every other locale  → build/<locale>/ (baseUrl "/<locale>/")
 *
 *   Docusaurus only derives those "/<locale>/" sub-paths when building ALL
 *   locales together. A lone `--locale fr` flips into "multi-domain" mode
 *   (baseUrl "/", outDir build/) — which would overwrite the en build. We
 *   defeat that by setting an explicit i18n.localeConfigs[locale].baseUrl in
 *   docusaurus.config.js, so a single-locale child still emits "/<locale>/".
 *
 *   The default locale MUST build first: its outDir IS the build root, and
 *   Docusaurus clears the outDir (recursive rm) before each build — building
 *   it last would erase the already-built sub-locale folders.
 *
 * THE 700 MB DATASET
 *   The shared-data plugin regenerates the language-card dataset in
 *   loadContent() once per locale. The first (default) child regenerates it;
 *   every subsequent child gets CHAMPOLLION_SKIP_DATA_REGEN=1 and reuses it, so
 *   it is built ONCE not 13×. The heavy /data copy already happens once
 *   (en-only postBuild). See plugins/shared-data/index.js.
 *
 * USAGE
 *   node scripts/build-all-locales.mjs            # all locales from config
 *   node scripts/build-all-locales.mjs en fr vi   # a subset (smoke test)
 *
 * ENV
 *   WEBSITE_BUILD_HEAP_MB   per-process V8 old-space ceiling (default 4096)
 * ───────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(__dirname, '..');
const buildDir = path.join(siteDir, 'build');

const require = createRequire(import.meta.url);
const docusaurusBin = require.resolve('@docusaurus/core/bin/docusaurus.mjs');

// SSOT: read the locale list straight from docusaurus.config.js so this script
// never drifts from the canonical i18n config.
const { default: config } = await import(
  pathToFileURL(path.join(siteDir, 'docusaurus.config.js')).href
);
const { defaultLocale, locales: allLocales } = config.i18n;

// Optional subset from argv (still ordered default-first below).
const requested = process.argv.slice(2).filter(Boolean);
const selected = requested.length ? requested : allLocales;
for (const l of selected) {
  if (!allLocales.includes(l)) {
    console.error(
      `[build-all-locales] Unknown locale "${l}" — not in docusaurus.config.js ` +
        `i18n.locales [${allLocales.join(', ')}].`,
    );
    process.exit(1);
  }
}

// Default locale FIRST — it owns the build root, and Docusaurus clears the
// outDir before each build, so building it last would wipe the sub-locales.
const ordered = selected.includes(defaultLocale)
  ? [defaultLocale, ...selected.filter((l) => l !== defaultLocale)]
  : selected;

const heapMb = Number(process.env.WEBSITE_BUILD_HEAP_MB || 4096);
const heapOpt = `--max-old-space-size=${heapMb}`;

console.log(
  `[build-all-locales] Building ${ordered.length} locale(s) in separate ` +
    `processes: ${ordered.join(', ')}`,
);
console.log(`[build-all-locales] Per-process heap ceiling: ${heapMb} MB`);

// ── Ensure the build's data inputs exist BEFORE any locale child runs ─────────
// The served Network artifacts (static/queue.json, mesh.json, registry.json) and
// the DB-derived tc-index.json are GENERATED at build, not committed to git
// (Supabase is the SSOT). The shared-data plugin reads static/queue.json during
// each locale's build, so these must exist first. The npm `prebuild` hook covers
// `npm run build`, but invoking THIS script directly (the documented
// `node scripts/build-all-locales.mjs en` path) bypasses npm lifecycle hooks —
// so we ensure them here too. Both ensure steps are idempotent ("ensure"
// semantics: a no-op when the outputs already exist), so the redundant run under
// `npm run build` is cheap.
function ensureBuildData() {
  const steps = [
    { label: 'network artifacts (queue/mesh/registry)', script: 'ensure-network-artifacts.mjs', fatal: true },
    { label: 'trading-card index (tc-index.json)', script: 'build-data-from-supabase.mjs', args: ['--index-only'], fatal: false },
  ];
  for (const step of steps) {
    console.log(`[build-all-locales] ensuring ${step.label}…`);
    const res = spawnSync(
      process.execPath,
      [path.join(__dirname, step.script), ...(step.args || [])],
      { cwd: siteDir, stdio: 'inherit' },
    );
    if (res.error || res.status !== 0) {
      const msg =
        `[build-all-locales] data-ensure step "${step.label}" failed ` +
        `(${res.error ? res.error.message : `exit ${res.status}`}).`;
      if (step.fatal) {
        console.error(`${msg} Aborting — the site cannot build without it.`);
        process.exit(res.status || 1);
      }
      // Non-fatal (e.g. tc-index needs network): the graph generator degrades
      // gracefully when tc-index is absent. Warn loudly and continue.
      console.warn(`${msg} Continuing (build degrades gracefully).`);
    }
  }
}

ensureBuildData();

const startedAll = Date.now();

for (let i = 0; i < ordered.length; i++) {
  const locale = ordered[i];
  const isDefault = locale === defaultLocale;

  const env = { ...process.env };
  // Append our ceiling without clobbering any caller-provided NODE_OPTIONS.
  env.NODE_OPTIONS = `${
    process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''
  }${heapOpt}`;
  // Only the first (default) locale regenerates the locale-independent
  // ~700 MB language dataset; every other locale reuses what it wrote.
  if (i > 0) env.CHAMPOLLION_SKIP_DATA_REGEN = '1';

  console.log(
    `\n[build-all-locales] ── [${i + 1}/${ordered.length}] ${locale}` +
      `${isDefault ? ' (default → build root)' : ` → build/${locale}/`} ──────`,
  );
  const t0 = Date.now();
  const res = spawnSync(
    process.execPath,
    [docusaurusBin, 'build', '--locale', locale],
    { cwd: siteDir, stdio: 'inherit', env },
  );
  if (res.error) {
    console.error(
      `[build-all-locales] ✗ failed to spawn build for "${locale}": ${res.error.message}`,
    );
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(
      `[build-all-locales] ✗ locale "${locale}" failed (exit ${res.status}` +
        `${res.signal ? `, signal ${res.signal}` : ''}). Aborting.`,
    );
    process.exit(res.status || 1);
  }
  console.log(
    `[build-all-locales] ✓ ${locale} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
}

// ── Trim per-locale duplication of large root-served static assets ───────────
// Docusaurus copies static/ into EVERY locale outDir, so the big public
// downloads (queue.json ~39 MB, registry.json ~8 MB) get cloned into
// build/<locale>/ for all non-default locales (~560 MB of dead weight). Every
// reference to them is an absolute ROOT path (/queue.json, /registry.json) —
// never baseUrl-prefixed — so only the build/ root copy is ever fetched. Prune
// the sub-locale clones; the root copy is always kept.
const HEAVY_ROOT_STATICS = ['queue.json', 'registry.json'];
let pruned = 0;
let prunedBytes = 0;
for (const locale of ordered) {
  if (locale === defaultLocale) continue; // root copy lives here — keep it
  for (const name of HEAVY_ROOT_STATICS) {
    const dup = path.join(buildDir, locale, name);
    const root = path.join(buildDir, name);
    // Only prune when the canonical root copy exists, so we never delete the
    // sole copy of a file (e.g. during an en-less subset smoke build).
    if (fs.existsSync(dup) && fs.existsSync(root)) {
      prunedBytes += fs.statSync(dup).size;
      fs.rmSync(dup);
      pruned++;
    }
  }
}
if (pruned) {
  console.log(
    `[build-all-locales] Pruned ${pruned} duplicated sub-locale static ` +
      `cop${pruned === 1 ? 'y' : 'ies'} (${(prunedBytes / 1e6).toFixed(0)} MB) — root copies kept.`,
  );
}

console.log(
  `\n[build-all-locales] ✅ All ${ordered.length} locale(s) built in ` +
    `${((Date.now() - startedAll) / 1000 / 60).toFixed(1)} min.`,
);
