#!/usr/bin/env node

/**
 * ensure-network-artifacts.mjs — build-time producer for the public Network
 * data blobs that used to be committed to git.
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *   Supabase is the single source of truth; the website's bulk data is
 *   GENERATED / FETCHED at build time, never stored as giant JSON in git. Four
 *   served artifacts that previously lived in `static/` (the 49 MB `queue.json`,
 *   `mesh.json`, the `registry.json` duplicate, and the slim `queue-preview.json`)
 *   are now produced here, at `prebuild`, BEFORE Docusaurus runs — so
 *   `champollion.dev/queue.json`, `/mesh.json`, `/registry.json` still resolve on
 *   deploy and `generateGraphJson` (shared-data plugin) still finds its
 *   `static/queue.json` input.
 *
 * PRODUCTION CHAIN (first source that works wins; FAIL-LOUD never silent):
 *   1. GENERATE — if `arena/scripts/generate_sweep_queue.py` + `python3` are
 *      present (full monorepo checkout, or a Vercel build rooted at the
 *      monorepo), run it. It reads `arena/datasets/registry.json` (the corpora
 *      SSOT) + the cost manifest + the public Supabase leaderboard and writes
 *      all four artifacts at once. This is the authoritative path and the one
 *      the local build verifies. Online first (reads the live board from
 *      Supabase); falls back to `--offline` (structural ranking) if the board
 *      is unreachable, so a network blip never blocks a build. Force offline
 *      with CHAMPOLLION_QUEUE_OFFLINE=1.
 *   2. COPY/STORAGE — if Python is absent but `arena/datasets/registry.json`
 *      exists, copy it verbatim to `static/registry.json` (a pure file copy, no
 *      Python). The full `queue.json` / `mesh.json` are then expected to be
 *      served from Supabase Storage via the Vercel rewrite documented in
 *      mt-eval-arena/supabase/functions/regenerate-queue/README.md — that is the
 *      project's generate-and-serve origin. We still drop minimal stubs (step 3)
 *      so a cold build without the rewrite configured does not 404.
 *   3. STUB — last resort. Write MINIMAL, valid, clearly-labelled placeholder
 *      artifacts and print a loud WARNING. This keeps a brand-new cold build
 *      from 404-ing `/queue.json` etc.; the metadata says plainly that the file
 *      is a fallback and how to produce the real one. Never ship silently-empty
 *      data dressed up as real.
 *
 *   COLD-BUILD channel/wall: when `cli/shared/language-cards/` is ABSENT (a
 *   Vercel deploy of just cli/website), the shared-data plugin can't distill
 *   `data/channel.json` / `data/wall.json` from cards, and those files are no
 *   longer committed. So we materialise `data/languages.json` from Supabase
 *   (the existing build-data-from-supabase.mjs full path) and the plugin
 *   distills channel/wall from it. When cards ARE present (full monorepo), the
 *   plugin generates languages.json itself — we skip this step.
 *
 * "ENSURE" SEMANTICS: a no-op when all four static artifacts already exist
 *   (offline-safe, fast rebuilds) unless `--force`.
 *
 * USAGE
 *   node scripts/ensure-network-artifacts.mjs [--force]
 *
 * ENV
 *   CHAMPOLLION_QUEUE_OFFLINE=1   skip the live leaderboard read (structural)
 * ────────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const CLI_ROOT = path.resolve(SITE_DIR, '..');
const MONOREPO = path.resolve(CLI_ROOT, '..');
const STATIC_DIR = path.join(SITE_DIR, 'static');
const DATA_DIR = path.join(SITE_DIR, 'data');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const ARENA_GEN = path.join(MONOREPO, 'arena', 'scripts', 'generate_sweep_queue.py');
const CANONICAL_REGISTRY = path.join(MONOREPO, 'arena', 'datasets', 'registry.json');

const FORCE = process.argv.includes('--force');
const OFFLINE = process.env.CHAMPOLLION_QUEUE_OFFLINE === '1';

// The four served artifacts the generator emits together.
const ARTIFACTS = ['queue.json', 'queue-preview.json', 'mesh.json', 'registry.json'];

const log = (msg) => console.log(`[ensure-network-artifacts] ${msg}`);
const warn = (msg) => console.warn(`[ensure-network-artifacts] ⚠️  ${msg}`);

function allArtifactsPresent() {
  return ARTIFACTS.every((f) => fs.existsSync(path.join(STATIC_DIR, f)));
}

function pythonAvailable() {
  const res = spawnSync('python3', ['--version'], { stdio: 'ignore' });
  return !res.error && res.status === 0;
}

/**
 * Run the canonical generator. Returns true on success. Tries the live board
 * first (Supabase SSOT) unless forced offline; falls back to --offline so a
 * network failure degrades to a structural queue instead of blocking the build.
 */
function runGenerator() {
  // --rank-mode map is the PUBLISHED-QUEUE POLICY (founder flip 2026-07-19,
  // commit 283524f9a) and also the generator's default — passed explicitly
  // anyway so this pipeline states the policy it serves and can never regress
  // it if the default were ever touched. This is NOT just presentation: the
  // published (map) lane is the set that carries the per-item transmission
  // stamps on the no-train items across the license-restricted corpora
  // (test_transmission_policy pins it).
  const baseArgs = [
    ARENA_GEN,
    '--rank-mode', 'map',
    '--output', path.join(STATIC_DIR, 'queue.json'),
  ];
  const attempts = OFFLINE
    ? [[...baseArgs, '--offline']]
    : [baseArgs, [...baseArgs, '--offline']];

  for (let i = 0; i < attempts.length; i++) {
    const isOfflineAttempt = attempts[i].includes('--offline');
    log(
      `generating queue/mesh/registry via generate_sweep_queue.py ` +
        `(${isOfflineAttempt ? 'offline / structural' : 'online — live Supabase board'})…`,
    );
    const res = spawnSync('python3', attempts[i], {
      cwd: path.join(MONOREPO, 'arena'),
      stdio: 'inherit',
    });
    if (!res.error && res.status === 0) {
      log('✅ generated all four artifacts.');
      return true;
    }
    if (i < attempts.length - 1) {
      warn(
        `generator attempt failed (exit ${res.status ?? res.error?.code}); ` +
          `retrying offline…`,
      );
    }
  }
  return false;
}

/** Pure file copy of the canonical registry — no Python needed. */
function copyCanonicalRegistry() {
  if (!fs.existsSync(CANONICAL_REGISTRY)) return false;
  fs.mkdirSync(STATIC_DIR, { recursive: true });
  fs.copyFileSync(CANONICAL_REGISTRY, path.join(STATIC_DIR, 'registry.json'));
  log('✅ copied canonical arena/datasets/registry.json → static/registry.json');
  return true;
}

const STUB_NOTE =
  'MINIMAL FALLBACK STUB — generation was unavailable at build time. ' +
  'Produce the real artifact with `python3 arena/scripts/generate_sweep_queue.py` ' +
  '(full monorepo) or seed/serve it from Supabase Storage (see ' +
  'mt-eval-arena/supabase/functions/regenerate-queue/README.md).';

/**
 * Last-resort stubs: minimal but VALID so the site does not 404 and the
 * shared-data graph generator does not crash on a missing queue.json. Honest
 * about being a fallback (loud warning + metadata note) — never a silent empty.
 */
function writeStubs({ skipRegistry }) {
  fs.mkdirSync(STATIC_DIR, { recursive: true });
  const stamp = { note: STUB_NOTE, generated_by: 'ensure-network-artifacts.mjs (stub)' };

  const queue = { metadata: { ...stamp, open_items: 0 }, items: [] };
  fs.writeFileSync(path.join(STATIC_DIR, 'queue.json'), JSON.stringify(queue));

  const preview = {
    metadata: queue.metadata,
    full_queue: { path: '/queue.json', bytes: 0, items: 0 },
    preview_count: 0,
    items: [],
    pairs: [],
  };
  fs.writeFileSync(path.join(STATIC_DIR, 'queue-preview.json'), JSON.stringify(preview));

  const mesh = { ...stamp, nodes: [], edges: [] };
  fs.writeFileSync(path.join(STATIC_DIR, 'mesh.json'), JSON.stringify(mesh));

  if (!skipRegistry) {
    const registry = { registry_version: '0.0.0-stub', ...stamp, datasets: [] };
    fs.writeFileSync(path.join(STATIC_DIR, 'registry.json'), JSON.stringify(registry));
  }

  warn(
    'wrote MINIMAL FALLBACK STUB artifacts (queue/mesh' +
      (skipRegistry ? '' : '/registry') +
      '). The site will build but serve placeholder Network data until the ' +
      'real artifacts are generated or served from Supabase Storage.',
  );
}

/**
 * Cold-build only: when language cards are absent, materialise
 * data/languages.json from Supabase so the shared-data plugin can distill
 * channel.json / wall.json (no longer committed). Non-fatal — a failure here
 * leaves channel/wall to the plugin's own snapshot handling and warns.
 */
function ensureColdBuildLanguages() {
  if (fs.existsSync(CARDS_DIR)) return; // full monorepo: plugin builds it from cards
  if (fs.existsSync(path.join(DATA_DIR, 'languages.json')) && !FORCE) {
    log('cold build: data/languages.json already present — channel/wall will distill from it.');
    return;
  }
  log(
    'cold build (no language-cards/): fetching languages.json from Supabase so ' +
      'channel.json/wall.json can be distilled…',
  );
  const res = spawnSync(
    'node',
    [path.join(__dirname, 'build-data-from-supabase.mjs'), ...(FORCE ? ['--force'] : [])],
    { cwd: SITE_DIR, stdio: 'inherit' },
  );
  if (res.error || res.status !== 0) {
    warn(
      'could not fetch languages.json from Supabase — the homepage endonym ' +
        'channel/wall may be missing on this cold build. Configure Supabase ' +
        'access (anon key reachable) and rebuild.',
    );
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  if (allArtifactsPresent() && !FORCE) {
    log('all four static artifacts present — skipping (pass --force to refresh).');
    ensureColdBuildLanguages();
    return 0;
  }

  let produced = false;

  if (fs.existsSync(ARENA_GEN) && pythonAvailable()) {
    produced = runGenerator();
    if (!produced) {
      warn('generator present but failed — falling back to copy/stub.');
    }
  } else {
    log(
      'generate_sweep_queue.py / python3 not available here — using ' +
        'copy/stub fallback (Supabase Storage rewrite serves the full files in prod).',
    );
  }

  if (!produced) {
    const haveRegistry = copyCanonicalRegistry();
    writeStubs({ skipRegistry: haveRegistry });
  }

  ensureColdBuildLanguages();
  return 0;
}

process.exit(main());
