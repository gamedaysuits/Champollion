#!/usr/bin/env node

/**
 * build-data-from-supabase.mjs
 * ────────────────────────────────────────────────────────────────
 * Materializes the gitignored website datasets from the production
 * Supabase trading-card tables (read-only anon key), for build
 * environments that don't have cli/shared/language-cards/ on disk
 * (e.g. git-connected Vercel builds of a tree without the full card
 * directory). Reuses the CLI's dynamic-card fetch layer
 * (cli/lib/cards/remote.js) — same endpoints, same reconstruction.
 *
 * Writes (under cli/website/data/):
 *   tc-index.json     — camelCase index entries (inverse of the upload
 *                       mapping in mt-eval-arena/scripts/upload-trading-cards.mjs;
 *                       lossless except vitalityLevel/vitalityTrend,
 *                       which were never uploaded — the site's own
 *                       Supabase runtime path lacks them too). The
 *                       taxonomy fields (isoType/modality/isoScope/
 *                       macrolanguage) come from the migration-056
 *                       columns and are HEALED from the language-card
 *                       SSOT when this checkout has it; an index whose
 *                       entries all lack isoType is REFUSED (it would
 *                       silently zero the homepage living/at-risk stats
 *                       — the 2026-07-19 latent hero bug).
 *   tc-lang/<code>.json — detail blobs, verbatim (LOSSLESS)
 *   tc-vocab/<code>.json — vocabulary blobs from trading_card_vocabulary
 *                       (migration 069), camelCase — the static fallback
 *                       behind languageLoader.loadTradingCardVocabulary().
 *                       Fail-soft when the table doesn't exist yet (prod
 *                       before migration 069): warned and skipped, so the
 *                       site still builds — the runtime Supabase lane is
 *                       equally absent then, and old detail blobs carry
 *                       vocabulary inline.
 *   languages.json    — resolved cards for the wall/channel/graph
 *                       generators. Core languages come from the
 *                       bundled fallback set (full fidelity, includes
 *                       nativeNameVerdict); the long tail is
 *                       reconstructed from index+detail and therefore
 *                       lacks registers/rules/gender and endonym
 *                       vetting verdicts — the channel/wall generators
 *                       fall back to English names for those, by design.
 *
 * Local checkouts with shared/language-cards/ present should keep
 * using the standard shared-data generators (this script exits early
 * unless --force).
 *
 * Usage:
 *   node scripts/build-data-from-supabase.mjs [--force] [--skip-languages] [--out <dir>]
 *
 *   --out defaults to cli/website/data/. Local checkouts: NEVER point
 *   it at your real data/ dir — the locally generated languages.json
 *   is higher-fidelity than the remote reconstruction.
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  indexRowToEntry,
  healTaxonomyFromCards,
  assertTcIndexTaxonomy,
} from './lib/tc-index-remote.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..', '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const FALLBACK_FILE = path.join(CLI_ROOT, 'shared', 'cards-fallback.json');

const FORCE = process.argv.includes('--force');
const SKIP_LANGUAGES = process.argv.includes('--skip-languages');
// --index-only: fetch ONLY trading_card_index → tc-index.json (skip detail +
// languages.json). This is the website `prestart`/`prebuild` step that gives
// the homepage graph generator its DB-derived node set in EVERY build env —
// tc-index.json is gitignored, so it's absent on Vercel and fresh clones, and
// graph.json/graph-poster.json are no longer committed snapshots. "Ensure"
// semantics: a no-op when tc-index.json already exists (offline-safe) unless
// --force.
const INDEX_ONLY = process.argv.includes('--index-only');
const outFlag = process.argv.indexOf('--out');
const DATA_DIR = outFlag !== -1 && process.argv[outFlag + 1]
  ? path.resolve(process.argv[outFlag + 1])
  : path.join(__dirname, '..', 'data');

if (INDEX_ONLY) {
  if (fs.existsSync(path.join(DATA_DIR, 'tc-index.json')) && !FORCE) {
    console.log(
      '[build-data-from-supabase] --index-only: tc-index.json present — skipping (pass --force to refresh).',
    );
    process.exit(0);
  }
} else if (fs.existsSync(CARDS_DIR) && !FORCE) {
  console.log(
    '[build-data-from-supabase] shared/language-cards/ is present — use the standard\n' +
    'shared-data generators (Docusaurus plugin) instead, or pass --force to fetch anyway.',
  );
  process.exit(0);
}

// Never let the card registry spawn per-code fetch children while this
// script runs — it does its own batched fetching below.
process.env.CHAMPOLLION_OFFLINE = '1';

const { fetchIndexRows, fetchAllDetailRows, buildCardFromRemote } =
  await import(path.join(CLI_ROOT, 'lib', 'cards', 'remote.js'));
const { getLanguageCard, getAllLanguageCodes } =
  await import(path.join(CLI_ROOT, 'lib', 'registers.js'));

console.log('[build-data-from-supabase] Fetching trading_card_index…');
const indexRows = await fetchIndexRows({ select: '*' });
console.log(`[build-data-from-supabase]   ${indexRows.length} index rows`);

// Row→entry mapping lives in scripts/lib/tc-index-remote.js (shared with the
// graph generator's guard). The taxonomy fields reached the table with
// migration 056; older snapshots — or rows uploaded before the migration —
// leave them null, so heal from the language-card SSOT when this checkout has
// it (Vercel clones the whole monorepo, so it does there), then refuse to
// write an index that would zero the homepage living/at-risk stats.
const indexEntries = indexRows.map(indexRowToEntry);
if (fs.existsSync(CARDS_DIR)) {
  const { healedEntries, filledFields } = await healTaxonomyFromCards(indexEntries, CARDS_DIR);
  if (healedEntries > 0) {
    console.log(
      `[build-data-from-supabase]   taxonomy healed from the language-card SSOT: ` +
        `${healedEntries} entries (${filledFields} fields) — apply migration 056 and ` +
        're-run upload-trading-cards.mjs to carry these on the index rows',
    );
  }
}
assertTcIndexTaxonomy(indexEntries, 'tc-index.json (reconstructed from trading_card_index)');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(DATA_DIR, 'tc-index.json'),
  JSON.stringify(indexEntries),
  'utf-8',
);
console.log('[build-data-from-supabase] ✅ tc-index.json');

if (INDEX_ONLY) {
  console.log('[build-data-from-supabase] --index-only: done (skipped detail + languages.json).');
  process.exit(0);
}

fs.mkdirSync(path.join(DATA_DIR, 'tc-lang'), { recursive: true });
console.log('[build-data-from-supabase] Fetching trading_card_detail (paginated)…');
const detailByCode = new Map();
let detailCount = 0;
await fetchAllDetailRows({
  pageSize: 200,
  onPage: (rows, offset) => {
    for (const row of rows) {
      detailByCode.set(row.code, row);
      fs.writeFileSync(
        path.join(DATA_DIR, 'tc-lang', `${row.code}.json`),
        JSON.stringify(row.detail),
        'utf-8',
      );
    }
    detailCount += rows.length;
    if (offset % 2000 === 0) {
      console.log(`[build-data-from-supabase]   …${detailCount} detail rows`);
    }
  },
});
console.log(`[build-data-from-supabase] ✅ tc-lang/ (${detailCount} files)`);

// Vocabulary fallbacks (migration 069). New detail blobs carry only a
// vocabularySummary; the items live in trading_card_vocabulary and the site
// lazy-fetches them — /data/tc-vocab/<code>.json is its static fallback, so
// a DB-reconstructed build environment must materialize it too. Paginated
// like the detail fetch (vocab blobs are the largest payloads in the
// catalogue). Fail-soft if the table is missing (prod before migration 069).
try {
  const { fetchJson, SUPABASE_URL: SB_URL } =
    await import(path.join(CLI_ROOT, 'lib', 'cards', 'remote.js'));
  const VOCAB_PAGE = 100;
  fs.mkdirSync(path.join(DATA_DIR, 'tc-vocab'), { recursive: true });
  console.log('[build-data-from-supabase] Fetching trading_card_vocabulary (paginated)…');
  let vocabCount = 0;
  for (let offset = 0; ; offset += VOCAB_PAGE) {
    const params = new URLSearchParams({
      select: 'code,items,total_forms,sources,asjp_only',
      order: 'code.asc',
      limit: String(VOCAB_PAGE),
      offset: String(offset),
    });
    const page = await fetchJson(
      `${SB_URL}/rest/v1/trading_card_vocabulary?${params}`,
      { timeoutMs: 60000 },
    );
    for (const row of page) {
      fs.writeFileSync(
        path.join(DATA_DIR, 'tc-vocab', `${row.code}.json`),
        JSON.stringify({
          code: row.code,
          totalForms: row.total_forms ?? (row.items?.length || 0),
          asjpOnly: !!row.asjp_only,
          sources: row.sources || [],
          items: row.items || [],
        }),
        'utf-8',
      );
    }
    vocabCount += page.length;
    if (page.length < VOCAB_PAGE) break;
  }
  console.log(`[build-data-from-supabase] ✅ tc-vocab/ (${vocabCount} files)`);
} catch (err) {
  console.warn(
    '[build-data-from-supabase] ⚠️  trading_card_vocabulary fetch failed — ' +
      'tc-vocab/ fallbacks NOT written. If this database predates migration ' +
      '069 (069_create_trading_card_vocabulary.sql) this is expected and the ' +
      `detail blobs still carry vocabulary inline. Error: ${err.message}`,
  );
}

if (!SKIP_LANGUAGES) {
  // Aliases for reconstructed cards come from the bundled manifest.
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8')).manifest || {};
  } catch {
    console.warn('[build-data-from-supabase] No cards-fallback.json — reconstructed cards get no aliases');
  }

  // Codes the card registry can serve locally (bundled fallback set in
  // packaged mode, or everything when --force ran in a full checkout):
  // those cards are full-fidelity, extends already resolved.
  const localCodes = new Set(getAllLanguageCodes());

  const cards = [];
  for (const row of indexRows) {
    const local = localCodes.has(row.code) ? getLanguageCard(row.code) : null;
    if (local) {
      cards.push(local);
    } else {
      cards.push(
        buildCardFromRemote(row, detailByCode.get(row.code) || null, {
          aliases: manifest[row.code]?.a,
        }),
      );
    }
  }
  cards.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  fs.writeFileSync(path.join(DATA_DIR, 'languages.json'), JSON.stringify(cards), 'utf-8');
  console.log(`[build-data-from-supabase] ✅ languages.json (${cards.length} cards, ${localCodes.size} full-fidelity)`);
}

console.log('[build-data-from-supabase] Done.');
