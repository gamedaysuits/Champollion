/**
 * Corpora tool — "what benchmarks exist for X→Y (or family F)?"
 *
 * The corpus registry (arena/datasets/registry.json, published at
 * champollion.dev/registry.json) is the corpus SSOT: metadata cards only —
 * id, pair, size, license, contamination grade, domain, a sha-pinned
 * fetch-from-source recipe. Corpus CONTENT is never hosted and never returned
 * here. This tool is the MCP twin of the harness's `mt-eval corpora` and
 * `mt-eval list datasets` (arena/mt_eval_harness/corpora_browse.py):
 * `normalizeRegistryEntry` mirrors `corpora_browse.normalize_entry`, including
 * the availability vocabulary below. Keep the two in step.
 *
 * Availability (what the harness can actually DO with an entry):
 *   fetch          rebuilt on demand from the pinned upstream (has a builder)
 *   gated          fetch + an accept-terms step and an access token
 *   local          an in-repo file present next to the registry
 *   local-missing  declared in-repo but not found
 *   quarantined    catalogued, never runnable — see quarantine_reason
 *   unbuildable    no builder and no URL: catalogued but not materializable
 *
 * Source ladder (CHAMPOLLION_CORPORA_SOURCE forces one rung: registry | remote | db):
 *   1. registry — the in-repo arena/datasets/registry.json (or
 *      CHAMPOLLION_REGISTRY_PATH) when this server runs inside a checkout;
 *   2. remote   — https://champollion.dev/registry.json (the same file,
 *      published at build time; guarded against an HTML holding page);
 *   3. db       — the prod `datasets` table over PostgREST (anon read). It is a
 *      MIRROR that lags the registry until the next sync, so it is last, and
 *      the answer says so.
 * Every answer names the rung it came from. Entries are cached in memory for
 * CACHE_TTL_MS; failures are never cached.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REGISTRY_URL = 'https://champollion.dev/registry.json';
// Same project + publishable anon key the public leaderboard embeds; RLS makes
// `datasets` read-only for anon. CHAMPOLLION_-prefixed overrides (results.js
// convention) so an unrelated SUPABASE_URL in the environment cannot repoint us.
const SUPABASE_URL =
  process.env.CHAMPOLLION_SUPABASE_URL ||
  'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.CHAMPOLLION_SUPABASE_ANON_KEY ||
  'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const AVAILABILITY_VALUES = Object.freeze([
  'fetch', 'gated', 'local', 'local-missing', 'quarantined', 'unbuildable',
]);

/** The in-repo registry path: env override, else three levels up from src/tools/. */
export function inRepoRegistryPath() {
  return process.env.CHAMPOLLION_REGISTRY_PATH
    || resolve(__dirname, '..', '..', '..', 'arena', 'datasets', 'registry.json');
}

// ---------------------------------------------------------------------------
// Normalization — JS twin of corpora_browse.normalize_entry
// ---------------------------------------------------------------------------

function availabilityOf(entry, { gated, builder, registryDir }) {
  if (entry.quarantine) return 'quarantined';
  const access = entry.access;
  if (access === 'local') {
    const rel = entry.local_path || entry.path;
    const dataRoot = process.env.MT_EVAL_DATA_ROOT;
    const bases = [registryDir, dataRoot].filter(Boolean);
    if (rel && bases.some((b) => existsSync(join(b, rel)))) return 'local';
    return 'local-missing';
  }
  if (access === 'fetch-from-source') {
    if (!builder && !entry.url) return 'unbuildable';
    return gated ? 'gated' : 'fetch';
  }
  if (entry.url) return 'fetch';
  return 'unbuildable';
}

/**
 * Project a raw registry entry to the stable CorpusInfo shape.
 *
 * @param {object} entry        A registry `datasets[]` element.
 * @param {object} [opts]
 * @param {string} [opts.registryDir]  Directory of the registry file (for
 *   `access: local` existence checks); omit when the entry is not in-repo.
 */
export function normalizeRegistryEntry(entry, { registryDir } = {}) {
  const pair = entry.language_pair || {};
  const exp = entry.source_export || {};
  const gated = Boolean(entry.gated || exp.gated);
  const termsUrl = entry.terms_url || exp.terms_url || null;
  const tokenEnv = entry.token_env || exp.token_env || null;
  const builder = exp.builder || null;
  const quarantined = Boolean(entry.quarantine);
  return {
    id: entry.id ?? null,
    name: entry.name ?? '',
    source: pair.source ?? null,
    target: pair.target ?? null,
    size: entry.size ?? null,
    domain: entry.domain ?? null,
    contamination: entry.contamination ?? null,
    license: entry.license ?? null,
    provider: entry.source ?? null,
    attribution: entry.attribution ?? null,
    access: entry.access ?? null,
    do_not_train: entry.do_not_train ?? true,
    segment: entry.segment ?? null,
    builder,
    gated,
    terms_url: gated ? termsUrl : null,
    token_env: gated ? (tokenEnv || 'HF_TOKEN') : null,
    quarantine: quarantined,
    quarantine_reason: quarantined ? (entry.quarantine_reason || null) : null,
    family: entry.registry_source ?? null,
    availability: availabilityOf(entry, { gated, builder, registryDir }),
  };
}

/**
 * Map a prod `datasets` row (the sync script's column shape) back to a
 * registry-like entry so the same normalizer applies. `access` is not a table
 * column: a row with a `source_export` recipe is fetch-from-source; anything
 * else cannot be materialized from the mirror alone and reads `unbuildable`
 * (every `access: local` entry in the registry today is also quarantined, so
 * that label wins for them anyway).
 */
export function mapDatasetRow(row) {
  const [source, target] = String(row.language_pair || '').split('>');
  const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};
  const exp = meta.source_export;
  return {
    id: row.id,
    name: row.name,
    language_pair: { source: source || null, target: target || null },
    size: row.entry_count ?? null,
    domain: row.domain ?? null,
    license: row.license ?? null,
    source: row.source ?? null,
    segment: row.segment ?? null,
    sha256: row.sha256 ?? null,
    quarantine: Boolean(row.quarantined),
    quarantine_reason: row.quarantine_reason ?? null,
    contamination: meta.contamination ?? null,
    attribution: meta.attribution ?? null,
    registry_source: meta.registry_source ?? null,
    path: meta.path ?? null,
    access: exp ? 'fetch-from-source' : null,
    source_export: exp || undefined,
    gated: Boolean(exp && exp.gated),
  };
}

// ---------------------------------------------------------------------------
// Filtering — pure
// ---------------------------------------------------------------------------

/**
 * Filter normalized entries. Quarantined entries are dropped unless
 * `include_quarantined`, but always COUNTED in `hiddenQuarantined`.
 *
 * @returns {{ items: object[], hiddenQuarantined: number }}
 */
export function filterCorpora(infos, {
  source_language, target_language, family, include_quarantined = false,
} = {}) {
  const src = source_language ? String(source_language).trim().toLowerCase() : null;
  const tgt = target_language ? String(target_language).trim().toLowerCase() : null;
  const fam = family ? String(family).trim().toLowerCase() : null;
  const items = [];
  let hiddenQuarantined = 0;
  for (const info of infos) {
    if (src && info.source !== src) continue;
    if (tgt && info.target !== tgt) continue;
    if (fam && (info.family || '').toLowerCase() !== fam) continue;
    if (info.quarantine && !include_quarantined) { hiddenQuarantined += 1; continue; }
    items.push(info);
  }
  items.sort(sortKey);
  return { items, hiddenQuarantined };
}

const CONTAM_ORDER = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

// Lowest contamination first, then larger corpora, then id — same order the
// harness's `mt-eval corpora` table uses.
function sortKey(a, b) {
  const ca = CONTAM_ORDER[a.contamination] ?? 1;
  const cb = CONTAM_ORDER[b.contamination] ?? 1;
  if (ca !== cb) return ca - cb;
  const sa = a.size || 0, sb = b.size || 0;
  if (sa !== sb) return sb - sa;
  return String(a.id).localeCompare(String(b.id));
}

// ---------------------------------------------------------------------------
// Loading — the source ladder
// ---------------------------------------------------------------------------

let _cache = null;   // { source, infos, note }
let _cacheTime = 0;

/** Reset the in-memory cache (tests). */
export function _resetCorporaCache() { _cache = null; _cacheTime = 0; }

function fresh() {
  return _cache && (Date.now() - _cacheTime) < CACHE_TTL_MS ? _cache : null;
}

function parseRegistryText(text, what) {
  const trimmed = String(text).trimStart();
  if (trimmed.startsWith('<')) {
    throw new Error(`${what} returned an HTML page instead of JSON (gate or holding page)`);
  }
  const data = JSON.parse(trimmed);
  const list = Array.isArray(data) ? data : data?.datasets;
  if (!Array.isArray(list)) throw new Error(`${what} has no datasets[] array`);
  return list;
}

function loadInRepo(registryPath) {
  if (!existsSync(registryPath)) throw new Error(`no in-repo registry at ${registryPath}`);
  const list = parseRegistryText(readFileSync(registryPath, 'utf-8'), registryPath);
  const registryDir = dirname(registryPath);
  return {
    source: 'registry.json (in-repo)',
    infos: list.map((e) => normalizeRegistryEntry(e, { registryDir })),
    note: null,
  };
}

async function loadRemote(fetchImpl) {
  const resp = await fetchImpl(REGISTRY_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`registry.json HTTP ${resp.status}`);
  const list = parseRegistryText(await resp.text(), REGISTRY_URL);
  return {
    source: 'registry.json (remote)',
    infos: list.map((e) => normalizeRegistryEntry(e)),
    note: null,
  };
}

const DB_SELECT = [
  'id', 'name', 'language_pair', 'entry_count', 'domain', 'license', 'segment',
  'source', 'sha256', 'quarantined', 'quarantine_reason', 'metadata',
].join(',');

/** Build the PostgREST URL for the `datasets` mirror (exported for tests). */
export function buildDatasetsUrl({ source_language, target_language, family, quarantined } = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/datasets`);
  url.searchParams.set('select', DB_SELECT);
  const src = source_language ? String(source_language).toLowerCase() : null;
  const tgt = target_language ? String(target_language).toLowerCase() : null;
  if (src && tgt) url.searchParams.set('language_pair', `eq.${src}>${tgt}`);
  else if (src) url.searchParams.set('language_pair', `like.${src}>%`);
  else if (tgt) url.searchParams.set('language_pair', `like.%>${tgt}`);
  if (family) url.searchParams.set('metadata->>registry_source', `eq.${String(family).toLowerCase()}`);
  if (quarantined === true) url.searchParams.set('quarantined', 'eq.true');
  if (quarantined === false) url.searchParams.set('quarantined', 'eq.false');
  url.searchParams.set('order', 'entry_count.desc.nullslast,id.asc');
  return url.toString();
}

async function loadDb(fetchImpl, filters) {
  // The mirror is filtered server-side (it is 5,000+ rows); we fetch the
  // matching rows both ways so the quarantined count stays honest.
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: 'application/json',
    Prefer: 'count=exact',
  };
  const resp = await fetchImpl(buildDatasetsUrl(filters), {
    headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`datasets HTTP ${resp.status}`);
  const rows = parseRegistryText(await resp.text(), 'datasets table');
  return {
    source: 'live datasets table',
    infos: rows.map((r) => normalizeRegistryEntry(mapDatasetRow(r))),
    note: 'served from the prod datasets MIRROR, which lags the registry until '
      + 'the next sync (registry.json was unreachable)',
    total: Number((resp.headers?.get?.('content-range') || '').split('/')[1]) || null,
  };
}

/**
 * Load normalized entries via the source ladder.
 *
 * @param {object} [opts]
 * @param {Function} [opts.fetchImpl]      fetch replacement (tests)
 * @param {string}   [opts.corporaSource]  'registry' | 'remote' | 'db' | 'auto'
 * @param {string}   [opts.registryPath]   explicit in-repo registry path
 * @param {object}   [opts.filters]        filters (used by the db rung only)
 */
export async function loadCorpora({
  fetchImpl = globalThis.fetch, corporaSource, registryPath, filters = {},
} = {}) {
  const mode = corporaSource || process.env.CHAMPOLLION_CORPORA_SOURCE || 'auto';
  if (mode !== 'db') {
    const hit = fresh();
    if (hit) return hit;
  }
  const path = registryPath || inRepoRegistryPath();
  const attempts = [];
  const rungs = mode === 'auto' ? ['registry', 'remote', 'db'] : [mode];
  for (const rung of rungs) {
    try {
      let loaded;
      if (rung === 'registry') loaded = loadInRepo(path);
      else if (rung === 'remote') loaded = await loadRemote(fetchImpl);
      else if (rung === 'db') loaded = await loadDb(fetchImpl, filters);
      else throw new Error(`unknown CHAMPOLLION_CORPORA_SOURCE '${rung}'`);
      if (rung !== 'db') { _cache = loaded; _cacheTime = Date.now(); }
      return loaded;
    } catch (err) {
      attempts.push(`${rung}: ${err.message}`);
    }
  }
  throw new Error(`could not load the corpus registry — ${attempts.join('; ')}`);
}

// ---------------------------------------------------------------------------
// The tool entry point
// ---------------------------------------------------------------------------

/**
 * Select corpora for the given filters. At least one of source_language,
 * target_language, family is required — the registry is thousands of rows and
 * an unfiltered dump is never a useful answer to an agent.
 *
 * @returns {Promise<{ items: object[], total: number, hiddenQuarantined: number,
 *   source: string, note: string|null, filters: object, limit: number }>}
 */
export async function selectCorpora({
  source_language, target_language, family, include_quarantined = false,
  limit = DEFAULT_LIMIT, fetchImpl, corporaSource, registryPath,
} = {}) {
  const filters = { source_language, target_language, family, include_quarantined };
  const lim = Math.max(1, Math.min(MAX_LIMIT, Number(limit) || DEFAULT_LIMIT));
  if (!source_language && !target_language && !family) {
    return { items: [], total: 0, hiddenQuarantined: 0, source: null, note: null,
      filters, limit: lim, needsFilter: true };
  }
  const loaded = await loadCorpora({ fetchImpl, corporaSource, registryPath, filters });
  const { items, hiddenQuarantined } = filterCorpora(loaded.infos, filters);
  return {
    items: items.slice(0, lim),
    total: items.length,
    hiddenQuarantined,
    source: loaded.source,
    note: loaded.note,
    filters,
    limit: lim,
  };
}

const AVAIL_LABEL = {
  fetch: 'fetch', gated: 'gated', local: 'local ✓', 'local-missing': 'local ✗',
  quarantined: 'QUARANTINED', unbuildable: 'no builder',
};

/** Render a bounded, self-describing text answer. */
export function formatCorpora(result) {
  const f = result.filters || {};
  const scope = [
    f.source_language ? `source ${String(f.source_language).toLowerCase()}` : null,
    f.target_language ? `target ${String(f.target_language).toLowerCase()}` : null,
    f.family ? `family ${f.family}` : null,
  ].filter(Boolean).join(', ');

  if (result.needsFilter) {
    return 'list_corpora needs at least one filter: source_language, '
      + 'target_language (ISO 639-3, e.g. "eng", "yor") or family (a benchmark '
      + 'family such as "flores", "tatoeba", "wmt24pp", "in22"). The registry '
      + 'holds thousands of corpora; an unfiltered dump is never the answer. '
      + 'Try search_languages first if you only have a language name.';
  }

  const hidden = result.hiddenQuarantined
    ? `${result.hiddenQuarantined} quarantined hidden — pass include_quarantined=true to list them`
    : 'no quarantined entries hidden';
  const lines = [
    `Corpora for ${scope}: ${result.total} listed (${hidden}) · source: ${result.source}`,
  ];
  if (result.note) lines.push(`  note: ${result.note}`);
  if (result.total === 0) {
    lines.push(result.hiddenQuarantined
      ? '  (none runnable — every catalogued entry for this scope is quarantined; '
        + 'quarantined corpora are catalogued but never runnable or rankable)'
      : '  (none found — try a different pair, or search_languages to check the codes)');
    return lines.join('\n');
  }
  for (const i of result.items) {
    const pair = `${i.source ?? '?'}→${i.target ?? '?'}`;
    const size = i.size != null ? `${i.size} rows` : '? rows';
    const bits = [
      i.id, pair, size, i.license || 'license ?',
      `contamination ${i.contamination || '?'}`, i.domain || 'domain ?',
      AVAIL_LABEL[i.availability] || i.availability,
    ];
    if (i.gated) bits.push(`[gated: accept terms at ${i.terms_url} then set ${i.token_env}]`);
    if (i.quarantine && i.quarantine_reason) bits.push(`[why: ${i.quarantine_reason.slice(0, 140)}]`);
    lines.push('  ' + bits.join('  '));
  }
  if (result.total > result.items.length) {
    lines.push(`  … showing ${result.items.length} of ${result.total} (raise limit, max ${MAX_LIMIT}, or narrow the filter)`);
  }
  lines.push('Run one: mt-eval run --corpus <id> --attest-no-training  (or run_benchmark with its queue item). '
    + 'Corpus content is fetched from its pinned upstream on demand — never hosted here.');
  return lines.join('\n');
}
