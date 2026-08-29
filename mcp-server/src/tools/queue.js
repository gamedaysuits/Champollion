/**
 * Queue tools — fetch, filter, and inspect the Champollion sweep queue.
 *
 * Data source (default): the live queue served from Postgres via the queue_top
 * RPC — a ranked list of (corpus, model, condition) items, coverage-filtered
 * against VERIFIED runs, so nothing stale or already-done is shown.
 *
 * The queue is six figures deep (211k+ open items as of 2026-08), so the DB
 * path NEVER drains it: metadata comes from the small queue-preview.json (with
 * a live open-item count from the unpaged queue_pairs RPC), ranked items are
 * paged from queue_top only as deep as the caller's selection needs (bounded
 * by MAX_DB_PAGES), and single-item lookups go straight to the queue_items
 * primary key over PostgREST. Draining was the 0.1.0 failure mode: 423
 * sequential pages ≈ 3 minutes, past every MCP client's 60s request timeout.
 *
 * If the DB is unreachable, every entry point falls back to the static
 * queue.json blob, so the tools never break. Set CHAMPOLLION_QUEUE_SOURCE=blob
 * to force the blob. An in-memory CACHE_TTL_MS cache (a growing ranked prefix,
 * never re-fetched from page 0) avoids re-fetching on every tool call.
 */

const QUEUE_URL = 'https://champollion.dev/queue.json';
// DB-as-queue (B1): the live queue is served from Postgres (the queue_top RPC),
// coverage-filtered against VERIFIED runs, so items are never stale. Metadata
// (open_items, models, priority_model, cost_basis, how_to_run) comes from the
// small queue-preview.json companion. The full static blob remains the FALLBACK
// so this tool never breaks if the DB is unreachable. (The blob itself is a
// self-describing top slice when the ranking outgrows its size cap — see
// metadata.blob_truncated — so "fallback" never silently means "everything".)
const PREVIEW_URL = 'https://champollion.dev/queue-preview.json';
const SUPABASE_URL = process.env.MT_EVAL_SUPABASE_URL
  || 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = process.env.MT_EVAL_SUPABASE_ANON_KEY
  || 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';
const QUEUE_TOP_PAGE = 500; // matches the RPC's hard page cap
// 'db' (default) serves live from queue_top with a blob fallback; 'blob' forces
// the legacy static file (used by the existing fetch tests).
const QUEUE_SOURCE = process.env.CHAMPOLLION_QUEUE_SOURCE || 'db';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// Selection-depth bound for the DB path: at most this many queue_top pages per
// cache generation (default 20 → 10,000 ranked rows ≈ 8-10s of paging). Every
// consumer needs ≤500 post-filter items, so the bound only bites on narrow
// filters over a huge queue — and then the tools SAY how deep they looked
// (no silent caps). Env-tunable for agents that want to scan deeper.
const MAX_DB_PAGES = (() => {
  const n = Number.parseInt(process.env.CHAMPOLLION_QUEUE_MAX_PAGES ?? '', 10);
  return Number.isInteger(n) && n > 0 ? n : 20;
})();
// Wall-clock budget for one exported queue operation's DB round trips.
// Chosen so that even the worst ladder — DB hangs to the full deadline, THEN
// the blob fallback takes its whole 30s request window — still lands under
// the 60s MCP client default (25s + 30s + parse < 60s). A slow network
// degrades to a truncated-but-honest answer, not a dead tool.
const DB_DEADLINE_MS = 25_000;

// Served item fields (what queue.json publishes / consumers rely on). queue_top
// rows also carry rank_mode/map_value/diagnostics/generation_id/generated_at —
// projected away so DB-sourced items match the blob shape exactly.
const SERVED_FIELDS = [
  'priority', 'id', 'language_pair', 'source_language', 'target_language',
  'corpus_id', 'corpus_license', 'entry_count', 'contamination', 'domain',
  'source_length', 'model', 'condition', 'est_cost_usd', 'est_basis',
  'run_command',
];

// The queue cache: ONE generation at a time. On the DB path `items` is a
// ranked PREFIX that grows in place as callers ask deeper (never re-fetching
// page 0); on the blob path it is whatever the blob shipped. `complete` means
// "we have seen the end of the served ranking". A generation lives CACHE_TTL_MS
// from its first fetch, then the whole thing resets.
let _cache = null;   // { source, metadata, items, complete, pages }
let _cacheTime = 0;

/** Standard headers for Supabase REST/RPC calls (anon key is publishable). */
function dbHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/** Per-request abort signal that also respects the operation deadline. */
function signalFor(deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('queue operation deadline exceeded');
  return AbortSignal.timeout(Math.min(30_000, remaining));
}

/** Project a queue_top/queue_items row down to the served item shape. */
function projectRow(row) {
  const item = {};
  for (const f of SERVED_FIELDS) if (row[f] !== undefined) item[f] = row[f];
  // The restricted-corpus `transmission` stamp is a SERVED extra on
  // queue.json but not a queue_items COLUMN — the ranker writes it into
  // the diagnostics JSONB. Projecting columns alone dropped it from every
  // DB-served item, so agents pulling work through MCP lost the no-train
  // channel requirement the blob discloses. Lift it back.
  const stamp = row.diagnostics?.transmission;
  if (stamp && typeof stamp === 'object' && stamp.policy) item.transmission = stamp;
  return item;
}

/** Return the fresh cache generation for `source`, or null. */
function freshCache(source) {
  if (_cache && _cache.source === source
      && (Date.now() - _cacheTime) < CACHE_TTL_MS) {
    return _cache;
  }
  return null;
}

/**
 * Ensure a cache generation exists: metadata loaded, items array started.
 *
 * DB path: metadata from queue-preview.json, then the LIVE open-item count
 * from one unpaged queue_pairs call (SUM of per-pair counts — same verified-
 * coverage filter as queue_top, so it is the true served total without
 * draining anything). If queue_pairs fails, the preview's generation-time
 * open_items stands, stamped `open_items_basis: 'generation'`.
 *
 * Blob path: the whole blob (metadata + items, complete by definition —
 * "complete" meaning the end of what the blob SERVES; a size-capped blob
 * says so itself via metadata.blob_truncated).
 *
 * Throws on failure so callers can fall back — never caches a failure.
 */
async function ensureCache(fetchImpl, source, deadline) {
  const hit = freshCache(source);
  if (hit) return hit;

  let gen;
  if (source === 'blob') {
    const data = await fetchQueueFromBlob(fetchImpl);
    gen = {
      source, metadata: data.metadata, items: data.items,
      complete: true, pages: 0,
    };
  } else {
    // Metadata + preview from the companion file (a few hundred KB — ~292 KB
    // as of 2026-08; it grows with the queue, so never assume it is tiny).
    const pResp = await fetchImpl(PREVIEW_URL, {
      headers: { 'Accept': 'application/json' },
      signal: signalFor(deadline),
    });
    if (!pResp.ok) throw new Error(`preview HTTP ${pResp.status}`);
    const preview = JSON.parse(await pResp.text());
    const metadata = preview?.metadata;
    if (metadata === null || typeof metadata !== 'object') {
      throw new Error('queue-preview.json missing metadata');
    }
    gen = {
      source,
      metadata: { ...metadata, open_items_basis: 'generation' },
      items: [],
      complete: false,
      pages: 0,
    };
    // Live open count — best-effort; the generation-time count stands if the
    // aggregate RPC is down (the ranked items themselves are unaffected).
    try {
      const resp = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/queue_pairs`, {
        method: 'POST',
        headers: dbHeaders(),
        body: JSON.stringify({ p_rank_mode: metadata.rank_mode || 'map' }),
        signal: signalFor(deadline),
      });
      if (resp.ok) {
        const pairs = JSON.parse(await resp.text());
        if (Array.isArray(pairs)) {
          // Live count = SUM over per-pair counts. Never used to short-circuit
          // paging — a misreported 0 must not suppress the ranked fetch.
          const live = pairs.reduce((s, p) => s + (Number(p.item_count) || 0), 0);
          gen.metadata.open_items = live;
          gen.metadata.open_items_basis = 'live';
        }
      }
    } catch {
      // keep generation-time open_items
    }
  }

  _cache = gen;
  _cacheTime = Date.now();
  return gen;
}

/** Fetch ONE queue_top page at the generation's current watermark and append
 *  it. Returns the number of rows appended. Marks the generation complete on
 *  a short page. Throws on failure (callers decide whether that is fatal). */
async function fetchNextPage(fetchImpl, gen, deadline) {
  const resp = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/queue_top`, {
    method: 'POST',
    headers: dbHeaders(),
    body: JSON.stringify({
      p_rank_mode: gen.metadata.rank_mode || 'map',
      p_limit: QUEUE_TOP_PAGE,
      p_offset: gen.items.length,
    }),
    signal: signalFor(deadline),
  });
  if (!resp.ok) throw new Error(`queue_top HTTP ${resp.status}`);
  const page = JSON.parse(await resp.text());
  if (!Array.isArray(page)) throw new Error('queue_top did not return an array');
  for (const row of page) gen.items.push(projectRow(row));
  gen.pages += 1;
  if (page.length < QUEUE_TOP_PAGE) gen.complete = true;
  return page.length;
}

/**
 * Deepen the generation's ranked prefix until it satisfies `isSatisfied(items)`
 * or a stop condition: ranking complete, MAX_DB_PAGES spent, deadline reached,
 * or a mid-flight page error AFTER some rows already arrived (page-1 errors
 * rethrow so the caller can fall back to the blob; later errors degrade to a
 * truncated-but-honest prefix rather than throwing away everything fetched).
 */
async function deepenUntil(fetchImpl, gen, deadline, isSatisfied) {
  while (!gen.complete
      && !isSatisfied(gen.items)
      && gen.pages < MAX_DB_PAGES
      && Date.now() < deadline) {
    try {
      await fetchNextPage(fetchImpl, gen, deadline);
    } catch (err) {
      if (gen.items.length === 0) throw err;
      break; // keep the partial prefix; tools report the depth honestly
    }
  }
}

/**
 * Fetch queue metadata only — no ranked items. This is what get_project_info
 * and any stats display should use: on the DB path it costs one preview GET
 * plus one unpaged aggregate RPC, never a queue_top page.
 *
 * Falls back to the blob's metadata if the DB path fails outright.
 *
 * @returns {Promise<{ metadata: object }>}
 */
export async function fetchQueueMeta({ fetchImpl = fetch, source = QUEUE_SOURCE } = {}) {
  const deadline = Date.now() + DB_DEADLINE_MS;
  if (source === 'blob') {
    const gen = await ensureCache(fetchImpl, 'blob', deadline);
    return { metadata: gen.metadata };
  }
  try {
    const gen = await ensureCache(fetchImpl, source, deadline);
    return { metadata: gen.metadata };
  } catch (dbErr) {
    return { metadata: (await blobFallback(fetchImpl, dbErr, source)).metadata };
  }
}

/**
 * Fetch enough of the ranked queue to satisfy a filterQueue selection, then
 * run the (untouched, SSOT-locked) filterQueue over it.
 *
 * The deepening loop exists because filter/budget semantics make "rows
 * scanned" ≠ "items selected": budget mode SKIPS over-budget items and keeps
 * walking, and narrow language/model filters may match sparsely. So we page,
 * re-filter, and page again until the selection is satisfied or a bound hits.
 *
 * @param {object} [opts]  filterQueue filters + { limit, fetchImpl, source }
 * @returns {Promise<{
 *   selected: object[],   // filterQueue's picks, in ranking order
 *   scanned:  object[],   // the ranked prefix examined (for estimateCost)
 *   metadata: object,
 *   complete: boolean,    // true = the WHOLE served ranking was examined
 *   scannedRows: number,  // how deep the examination went
 * }>}
 */
export async function selectFromQueue({
  budget = null, language = null, source_language = null, model = null,
  condition = null, limit = 20,
  fetchImpl = fetch, source = QUEUE_SOURCE,
} = {}) {
  const deadline = Date.now() + DB_DEADLINE_MS;
  const filters = { budget, language, source_language, model, condition, limit };

  let gen;
  if (source === 'blob') {
    gen = await ensureCache(fetchImpl, 'blob', deadline);
  } else {
    try {
      gen = await ensureCache(fetchImpl, source, deadline);
      await deepenUntil(fetchImpl, gen, deadline,
        (items) => filterQueue(items, filters).length >= limit);
    } catch (dbErr) {
      gen = await blobFallback(fetchImpl, dbErr, source);
    }
  }

  return {
    selected: filterQueue(gen.items, filters),
    scanned: gen.items,
    metadata: gen.metadata,
    complete: gen.complete === true,
    scannedRows: gen.items.length,
  };
}

/**
 * Look up ONE queue item by id or priority rank — without touching the ranked
 * paging at all. On the DB path this is a primary-key (or mode+priority index)
 * read on queue_items over PostgREST, plus a one-row run_cards probe that
 * replicates queue_top's verified-coverage filter (queue_items itself is the
 * raw registered set, so a row can exist yet already be verified-covered).
 *
 * NOTE: never offset arithmetic — queue_top's coverage filter means row N of
 * the served ranking is NOT the row with priority N, so priority lookups
 * match the stored priority field, exactly like the in-memory getQueueItem.
 *
 * @param {{ id?: string, priority?: number, fetchImpl?, source? }} opts
 * @returns {Promise<{
 *   item: object|null,
 *   covered: boolean|null,   // true = exists but a VERIFIED run already covers
 *                            // it (not an open work item); null = probe failed
 *   truncatedNote: string|null, // set when a not-found came from a truncated
 *                               // blob fallback and the item might exist deeper
 * }>}
 */
export async function lookupQueueItem({
  id, priority, fetchImpl = fetch, source = QUEUE_SOURCE,
} = {}) {
  const deadline = Date.now() + DB_DEADLINE_MS;

  const fromItems = (gen) => {
    const item = getQueueItem(gen.items, { id, priority });
    const truncated = !item && gen.metadata?.blob_truncated
      ? `Note: the fallback queue snapshot is a top slice (${gen.metadata.blob_truncated.kept} of ${gen.metadata.blob_truncated.total} items) — the item may exist deeper in the live queue.`
      : null;
    // Blob/queue.json items are coverage-filtered at generation time, so a hit
    // there is an open item by construction.
    return { item, covered: item ? false : null, truncatedNote: truncated };
  };

  if (source === 'blob') {
    return fromItems(await ensureCache(fetchImpl, 'blob', deadline));
  }

  try {
    const gen = await ensureCache(fetchImpl, source, deadline);
    const rankMode = gen.metadata.rank_mode || 'map';
    const query = id
      ? `id=eq.${encodeURIComponent(id)}`
      : `rank_mode=eq.${encodeURIComponent(rankMode)}&priority=eq.${Number(priority)}`;
    const resp = await fetchImpl(
      `${SUPABASE_URL}/rest/v1/queue_items?${query}&limit=1`,
      { headers: dbHeaders(), signal: signalFor(deadline) },
    );
    if (!resp.ok) throw new Error(`queue_items lookup HTTP ${resp.status}`);
    const rows = JSON.parse(await resp.text());
    if (!Array.isArray(rows)) throw new Error('queue_items lookup did not return an array');
    if (rows.length === 0) return { item: null, covered: null, truncatedNote: null };

    const row = rows[0];
    const item = projectRow(row);

    // Coverage probe — the same NOT EXISTS queue_top applies (migration 059):
    // a verified run_card for (corpus, model, condition) closes the item.
    let covered = null;
    try {
      const probeQ = `dataset_id=eq.${encodeURIComponent(row.corpus_id)}`
        + `&model_slug=eq.${encodeURIComponent(row.model)}`
        + `&condition=eq.${encodeURIComponent(row.condition)}`
        + '&trust=eq.verified&select=id&limit=1';
      const probe = await fetchImpl(
        `${SUPABASE_URL}/rest/v1/run_cards?${probeQ}`,
        { headers: dbHeaders(), signal: signalFor(deadline) },
      );
      if (probe.ok) {
        const hits = JSON.parse(await probe.text());
        if (Array.isArray(hits)) covered = hits.length > 0;
      }
    } catch {
      // covered stays null (unknown) — the item itself is still served
    }
    return { item, covered, truncatedNote: null };
  } catch (dbErr) {
    return fromItems(await blobFallback(fetchImpl, dbErr, source));
  }
}

/** Fall back to the blob after a DB-path failure, chaining both causes if the
 *  blob is down too — the agent should see WHY both lanes failed, not just
 *  the second one. Caches the blob generation so retries stay cheap. */
async function blobFallback(fetchImpl, dbErr, source = QUEUE_SOURCE) {
  try {
    const data = await fetchQueueFromBlob(fetchImpl);
    // Cached under the CALLER's source key so retries within the TTL reuse
    // the blob instead of hammering a DB that just failed.
    const gen = {
      source, metadata: data.metadata, items: data.items,
      complete: true, pages: 0,
    };
    _cache = gen;
    _cacheTime = Date.now();
    return gen;
  } catch (blobErr) {
    throw new Error(
      `live queue unavailable (${dbErr.message}) and the static fallback also `
      + `failed (${blobErr.message})`,
    );
  }
}

/**
 * Fetch the queue, returning the cached version if still fresh.
 *
 * LEGACY entry point: returns a `{ metadata, items }` queue object. On the
 * blob path this is the whole blob, exactly as before. On the DB path it is
 * now a BOUNDED ranked prefix (up to MAX_DB_PAGES pages), never the 0.1.0
 * full drain — prefer fetchQueueMeta / selectFromQueue / lookupQueueItem,
 * which fetch only what the caller's question needs.
 *
 * The static host can serve an HTML holding page with HTTP 200 (site gated,
 * maintenance, CDN error page) — `resp.json()` would then surface a raw
 * `SyntaxError: Unexpected token '<'` to every queue-backed tool. The body is
 * therefore read as text and parsed at one choke point, so a non-JSON
 * response becomes ONE clean, user-facing error. Failures are never cached —
 * the next call re-fetches.
 *
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]  Injectable fetch (for tests).
 * @returns {Promise<{ metadata: object, items: object[] }>}
 */
export async function fetchQueue({ fetchImpl = fetch, source = QUEUE_SOURCE } = {}) {
  const deadline = Date.now() + DB_DEADLINE_MS;
  let gen;
  if (source === 'blob') {
    gen = await ensureCache(fetchImpl, 'blob', deadline);
  } else {
    try {
      gen = await ensureCache(fetchImpl, source, deadline);
      await deepenUntil(fetchImpl, gen, deadline, () => false);
    } catch (dbErr) {
      gen = await blobFallback(fetchImpl, dbErr, source);
    }
  }
  // One stable view per generation — callers within a TTL get the SAME object
  // (metadata/items are the live cache references, so a deepened prefix shows
  // through), preserving the original fetchQueue cache contract.
  if (!gen.legacyView) gen.legacyView = { metadata: gen.metadata, items: gen.items };
  return gen.legacyView;
}

/** The legacy path: the full static queue.json blob. Also the DB-path fallback. */
async function fetchQueueFromBlob(fetchImpl) {
  const resp = await fetchImpl(QUEUE_URL, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    throw new Error(`Queue fetch failed: HTTP ${resp.status}`);
  }

  const body = await resp.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    const contentType = resp.headers?.get?.('content-type') || 'unknown content-type';
    throw new Error(
      'the Champollion queue endpoint is not serving JSON — the site may be '
      + `gated or down (got ${contentType} from ${QUEUE_URL}). `
      + 'Try again later, or check https://champollion.dev.',
    );
  }
  // Parsed, but not a queue: a gate/deploy step could serve a JSON error
  // object with HTTP 200. Fail cleanly here rather than crashing downstream
  // in filterQueue with a raw TypeError.
  if (data === null || typeof data !== 'object'
      || !Array.isArray(data.items)
      || data.metadata === null || typeof data.metadata !== 'object') {
    throw new Error(
      'the Champollion queue endpoint returned JSON without the expected '
      + '{ metadata, items } queue shape — the site may be gated or '
      + 'mid-deploy. Try again later, or check https://champollion.dev.',
    );
  }

  return data;
}

/** Clear the in-memory queue cache. For test isolation. */
export function resetQueueCache() {
  _cache = null;
  _cacheTime = 0;
}

/**
 * Filter queue items by language, model, budget, and condition.
 *
 * Core selection follows the same rules as queue_runner.py select_items:
 *   - Items are walked in queue order (the ranking IS the priority)
 *   - Budget mode: only items whose est_cost fits entirely within
 *     the remaining budget are selected
 *   - Items without cost estimates are skipped in budget mode
 *   - Coached items are included only when condition='coached'
 *
 * This function adds language/model/source_language filters on top
 * of the core selection logic (those are MCP-only features).
 *
 * SSOT: Canonical implementation is arena/mt_eval_harness/queue_runner.py.
 * Both are tested against shared/queue-selection-vectors.json — if you
 * change core selection behavior here, update the vectors and run both
 * test suites (npm test + pytest).
 *
 * @param {object[]} items      All queue items (already sorted by priority)
 * @param {object}   filters    Filter options
 * @returns {object[]}          Filtered items
 */
export function filterQueue(items, {
  budget = null,
  language = null,
  source_language = null,
  model = null,
  condition = null,
  limit = 20,
} = {}) {
  const selected = [];
  let spend = 0;

  // Normalize filter strings for case-insensitive matching
  const langLower = language?.toLowerCase();
  const modelLower = model?.toLowerCase();
  const srcLower = source_language?.toLowerCase();

  for (const item of items) {
    if (selected.length >= limit) break;

    // --- Condition filter ---
    // Skip coached items unless explicitly requested (mirrors queue_runner.py)
    if (condition) {
      if (item.condition !== condition) continue;
    } else if (item.condition === 'coached') {
      continue;
    }

    // --- Language filter ---
    // Matches against target_language name or the target side of the pair code
    if (langLower) {
      const targetCode = item.language_pair?.split('>')[1] || '';
      const targetName = (item.target_language || '').toLowerCase();
      if (!targetName.includes(langLower) && !targetCode.includes(langLower)) {
        continue;
      }
    }

    // --- Source language filter ---
    if (srcLower) {
      const sourceCode = item.language_pair?.split('>')[0] || '';
      if (sourceCode.toLowerCase() !== srcLower) continue;
    }

    // --- Model filter ---
    if (modelLower) {
      const itemModel = (item.model || '').toLowerCase();
      if (!itemModel.includes(modelLower)) continue;
    }

    // --- Budget filter ---
    if (budget != null) {
      const est = item.est_cost_usd;
      if (est == null) continue; // unknown cost — skip in budget mode
      if (spend + est > budget) continue; // would exceed budget
      spend += est;
    }

    selected.push(item);
  }

  return selected;
}

/**
 * Look up a single queue item by ID or priority rank.
 *
 * @param {object[]} items     All queue items
 * @param {{ id?: string, priority?: number }} lookup
 * @returns {object|null}      The matching item, or null
 */
export function getQueueItem(items, { id, priority }) {
  if (id) {
    return items.find(it => it.id === id) || null;
  }
  if (priority != null) {
    return items.find(it => it.priority === priority) || null;
  }
  return null;
}

/**
 * Estimate cost for a set of queue items matching the given filters.
 *
 * Returns aggregate statistics without executing anything.
 *
 * @param {object[]} items     All queue items
 * @param {object}   filters   Same filters as filterQueue
 * @returns {{ count, totalCost, cheapest, mostExpensive, languages }}
 */
export function estimateCost(items, filters) {
  // Use a high limit to get all matching items for cost estimation
  // Hard cap so a broad filter can't blow up the response; callers see
  // `capped` and must not read `count` as the queue-wide total.
  const ESTIMATE_CAP = 500;
  const matched = filterQueue(items, { ...filters, limit: ESTIMATE_CAP });
  const costs = matched
    .map(it => it.est_cost_usd)
    .filter(c => c != null);
  const languages = [...new Set(matched.map(it => it.target_language))];

  return {
    count: matched.length,
    capped: matched.length >= ESTIMATE_CAP,
    totalCost: costs.reduce((s, c) => s + c, 0),
    cheapest: costs.length ? Math.min(...costs) : 0,
    mostExpensive: costs.length ? Math.max(...costs) : 0,
    languages,
  };
}
