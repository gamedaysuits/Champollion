/**
 * liveQueue.js — DB-first live reads of the sweep queue (B1 / DB-as-queue).
 * ─────────────────────────────────────────────────────────────────────────
 * The queue used to be served only as a static /queue.json (+ a small
 * /queue-preview.json) blob, frozen the moment the Python ranker last ran.
 * Migrations 059 + 061 moved the STORAGE + live COVERAGE-FILTERING into
 * Postgres, served by two anon RPCs:
 *
 *   queue_top(p_rank_mode, p_limit, p_offset) → ranked page of items
 *   queue_pairs(p_rank_mode)                  → per-pair {pair, src, tgt,
 *                                               item_count, min_cost}
 *
 * Both live-exclude (corpus, model, condition) combos already covered by a
 * VERIFIED run, so the numbers are never stale against the board.
 *
 * These helpers are the STRANGLER-FIG front door: callers try the DB first and
 * fall back to the static /queue-preview.json (kept generated) if the DB is
 * unreachable, so the site never breaks. Each throws on failure so the caller's
 * try/catch can fall back cleanly. Client-side use only (they run in effects).
 *
 * Supabase public config (anon key is read-only, safe to embed in the frontend):
 *   URL: https://sjdomynysdljkbemupqa.supabase.co
 *   Key: sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp
 */

const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

// queue_top's server-side hard page cap (059) — mirror it so a caller can't ask
// for more than one page's worth in a single request.
const QUEUE_TOP_PAGE = 500;
const RPC_TIMEOUT_MS = 15_000;

// AbortSignal.timeout isn't in every browser we target; degrade to no timeout
// rather than throwing on the missing API (the DB path just relies on the
// browser's own fetch timeout, and any real failure still hits the fallback).
function timeoutSignal(ms) {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    return undefined;
  }
}

function rpcHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function callRpc(name, body, fetchImpl, { limit, offset } = {}) {
  // Paging goes in the query string: the deployed PostgREST does not honour a
  // Range header on this RPC (measured 2026-09-06 — every Range returned the
  // same first 1,000 rows), but ?limit=&offset= pages correctly.
  const qs = limit != null ? `?limit=${limit}&offset=${offset || 0}` : '';
  const resp = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${name}${qs}`, {
    method: 'POST',
    headers: rpcHeaders(),
    body: JSON.stringify(body),
    signal: timeoutSignal(RPC_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`${name} HTTP ${resp.status}`);
  const data = JSON.parse(await resp.text());
  if (!Array.isArray(data)) throw new Error(`${name} did not return an array`);
  return data;
}

/**
 * Fetch one ranked page of live queue items (queue_top / 059).
 *
 * @param {object}   [opts]
 * @param {string}   [opts.rankMode='map']  which ordering produced `priority`
 * @param {number}   [opts.limit=25]        page size (capped at 500 server-side)
 * @param {number}   [opts.offset=0]        page offset
 * @param {typeof fetch} [opts.fetchImpl]   injectable fetch (for tests)
 * @returns {Promise<object[]>} served queue items (throws on any failure)
 */
export async function fetchQueueTop({
  rankMode = 'map', limit = 25, offset = 0, fetchImpl = fetch,
} = {}) {
  return callRpc('queue_top', {
    p_rank_mode: rankMode,
    p_limit: Math.min(Math.max(1, limit), QUEUE_TOP_PAGE),
    p_offset: Math.max(0, offset),
  }, fetchImpl);
}

/**
 * Fetch the live per-pair queue aggregation (queue_pairs / 061), normalized to
 * the shape the website consumers use: `{ pair, src, tgt, count, minCost }`.
 * Because every item belongs to exactly one pair, summing `count` over the
 * result gives the live open-item total.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.rankMode='map']
 * @param {typeof fetch} [opts.fetchImpl]
 * @returns {Promise<Array<{pair,src,tgt,count,minCost}>>} (throws on failure)
 */
// PostgREST caps a single response at its `max-rows` (1,000 on prod), and
// queue_pairs returns one row PER OPEN PAIR (3,620 on 2026-09-06). An unpaged
// call silently got the first 1,000 rows, and the strip's "open items" sum
// (69,695) under-reported the true total (211,082) by 3× — DATABASE_SCHEMA
// D15. Page with limit/offset until a short page.
export const PAIRS_PAGE = 1000;

export async function fetchQueuePairs({ rankMode = 'map', fetchImpl = fetch } = {}) {
  const rows = [];
  for (let offset = 0; ; offset += PAIRS_PAGE) {
    const page = await callRpc('queue_pairs', { p_rank_mode: rankMode }, fetchImpl,
      { limit: PAIRS_PAGE, offset });
    rows.push(...page);
    if (page.length < PAIRS_PAGE) break;
  }
  return rows.map((r) => ({
    pair: r.pair,
    src: r.src,
    tgt: r.tgt,
    count: Number(r.item_count) || 0,
    minCost: r.min_cost == null ? null : Number(r.min_cost),
  }));
}
