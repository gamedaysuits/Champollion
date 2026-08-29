/**
 * Tests for the queue fetch layer — the network boundary.
 *
 * Two regimes under test:
 *
 * 1. Error handling. champollion.dev/queue.json is served by a static host
 *    that can answer with an HTML holding page and HTTP 200 (site gated,
 *    maintenance, CDN error page). The fetch layer must convert that into ONE
 *    clean, user-facing error — never a raw JSON.parse SyntaxError — because
 *    every queue-backed tool relays err.message verbatim to the agent.
 *
 * 2. Bounded fetching. The live queue is six figures deep (211k+ open items
 *    as of 2026-08). The 0.1.0 DB path drained ALL of it — 423 sequential
 *    queue_top pages ≈ 3 minutes — blowing every MCP client's 60s request
 *    timeout. The layer must now fetch only what each caller's question
 *    needs: metadata without items, a ranked prefix just deep enough for the
 *    selection, and single items by primary key.
 *
 * fetch is injected (fetchImpl) — no network calls.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchQueue, fetchQueueMeta, selectFromQueue, lookupQueueItem,
  resetQueueCache,
} from '../src/tools/queue.js';

const PAGE = 500; // queue_top's hard page cap (QUEUE_TOP_PAGE)

const GOOD_QUEUE = {
  metadata: { open_items: 1, models: ['anthropic/claude-haiku-4.5'] },
  items: [{ id: 'eng-zul-dev-v1__anthropic_claude-haiku-4.5__naive', priority: 1 }],
};

const HOLDING_PAGE = [
  '<!doctype html>',
  '<html><head><title>Champollion</title></head>',
  '<body><h1>We\'ll be right back</h1></body></html>',
].join('\n');

function mockResponse({ ok = true, status = 200, body = '', contentType = 'text/html; charset=utf-8' } = {}) {
  return {
    ok,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  };
}

function json(body) {
  return mockResponse({ body: JSON.stringify(body), contentType: 'application/json' });
}

function fetchReturning(response) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return response;
  };
  return { fetchImpl, calls };
}

/**
 * URL-routing fetch mock for the DB path. Routes are [substring, handler]
 * pairs matched in order; a handler is a response, or a function
 * (url, opts) => response. Unmatched URLs throw (so a test that forgets a
 * lane fails loudly instead of silently exercising the wrong path).
 */
function routedFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const [needle, handler] of routes) {
      if (url.includes(needle)) {
        const resp = typeof handler === 'function' ? handler(url, opts) : handler;
        if (resp instanceof Error) throw resp;
        return resp;
      }
    }
    throw new Error(`unexpected url ${url}`);
  };
  const callsTo = (needle) => calls.filter((c) => c.url.includes(needle));
  return { fetchImpl, calls, callsTo };
}

/** A minimal valid queue_top row. */
function row(i, extra = {}) {
  return {
    priority: i, id: `item-${i}`, language_pair: 'eng>zul',
    source_language: 'eng', target_language: 'Zulu',
    corpus_id: `corpus-${i}`, corpus_license: 'CC-BY-4.0', entry_count: 100,
    contamination: 'low', domain: 'news', source_length: 20,
    model: 'anthropic/claude-haiku-4.5', condition: 'naive',
    est_cost_usd: 0.01, est_basis: 'tokens', run_command: 'true',
    // non-served ranking columns that must be projected away:
    rank_mode: 'map', map_value: 0.5, generation_id: 'g1',
    ...extra,
  };
}

/** queue_top handler paging over a fixed item list, honoring p_offset. */
function pagedQueueTop(allRows) {
  return (url, opts) => {
    const { p_offset: offset = 0, p_limit: limit = PAGE } = JSON.parse(opts.body || '{}');
    return json(allRows.slice(offset, offset + limit));
  };
}

const PREVIEW = {
  metadata: {
    open_items: 999, models: ['anthropic/claude-haiku-4.5'], rank_mode: 'map',
    priority_model: 'map-value v2', cost_basis: 'sweep', how_to_run: 'pipx',
    corpora: 42, conditions: ['naive', 'coached'],
    generated_at: '2026-08-27T17:57:40+00:00',
  },
};

// Isolate the module-level queue cache between tests.
beforeEach(resetQueueCache);

// ---------------------------------------------------------------------------
// Blob path (source: 'blob') — legacy behavior, unchanged.
// ---------------------------------------------------------------------------

describe('fetchQueue (blob source)', () => {
  it('parses a JSON queue and caches it within the TTL', async () => {
    const { fetchImpl, calls } = fetchReturning(json(GOOD_QUEUE));
    const first = await fetchQueue({ fetchImpl, source: 'blob' });
    assert.equal(first.items[0].priority, 1);
    const second = await fetchQueue({ fetchImpl, source: 'blob' });
    assert.equal(second, first);
    assert.equal(calls.length, 1, 'second call within the TTL must hit the cache');
  });

  it('returns a clean user-facing error for an HTML holding page served with HTTP 200', async () => {
    const { fetchImpl } = fetchReturning(mockResponse({ body: HOLDING_PAGE }));
    await assert.rejects(fetchQueue({ fetchImpl, source: 'blob' }), (err) => {
      assert.match(err.message, /not serving JSON/);
      assert.match(err.message, /gated or down/);
      assert.match(err.message, /text\/html/, 'names the content-type for diagnosis');
      assert.doesNotMatch(err.message, /Unexpected token/, 'raw JSON.parse error must not leak');
      assert.doesNotMatch(err.message, /<!doctype/i, 'HTML body must not leak');
      return true;
    });
  });

  it('returns the same clean error for any non-JSON body (plain text)', async () => {
    const { fetchImpl } = fetchReturning(mockResponse({
      body: 'Service temporarily unavailable',
      contentType: 'text/plain',
    }));
    await assert.rejects(fetchQueue({ fetchImpl, source: 'blob' }), /not serving JSON.*gated or down/);
  });

  it('does not cache a failure — a later good response succeeds', async () => {
    let call = 0;
    const fetchImpl = async () => {
      call += 1;
      return call === 1 ? mockResponse({ body: HOLDING_PAGE }) : json(GOOD_QUEUE);
    };
    await assert.rejects(fetchQueue({ fetchImpl, source: 'blob' }), /not serving JSON/);
    const queue = await fetchQueue({ fetchImpl, source: 'blob' });
    assert.equal(queue.items.length, 1);
    assert.equal(call, 2);
  });

  it('rejects JSON without the expected { metadata, items } queue shape', async () => {
    const shapes = [
      { error: 'gated' },              // JSON error object with HTTP 200
      { metadata: {} },                // no items array
      { items: [] },                   // no metadata
      { metadata: null, items: [] },   // null metadata
      [1, 2, 3],                       // top-level array
      null,                            // JSON null
    ];
    for (const shape of shapes) {
      resetQueueCache();
      const { fetchImpl } = fetchReturning(json(shape));
      await assert.rejects(fetchQueue({ fetchImpl, source: 'blob' }), /expected .*queue shape/s,
        `shape ${JSON.stringify(shape)} must be rejected cleanly`);
    }
  });

  it('still reports HTTP errors by status', async () => {
    const { fetchImpl } = fetchReturning(mockResponse({ ok: false, status: 503 }));
    await assert.rejects(fetchQueue({ fetchImpl, source: 'blob' }), /HTTP 503/);
  });
});

// ---------------------------------------------------------------------------
// fetchQueueMeta — stats without a single ranked item.
// ---------------------------------------------------------------------------

describe('fetchQueueMeta (DB source)', () => {
  it('fetches preview + queue_pairs only — never a queue_top page', async () => {
    const { fetchImpl, callsTo } = routedFetch([
      ['queue-preview.json', json(PREVIEW)],
      ['/rpc/queue_pairs', json([{ pair: 'a', item_count: 2 }, { pair: 'b', item_count: 3 }])],
    ]);
    const { metadata } = await fetchQueueMeta({ fetchImpl, source: 'db' });
    assert.equal(metadata.open_items, 5, 'live count = SUM of queue_pairs item_count');
    assert.equal(metadata.open_items_basis, 'live');
    assert.equal(metadata.priority_model, 'map-value v2', 'carries preview metadata');
    assert.equal(callsTo('/rpc/queue_top').length, 0, 'metadata must not page ranked items');
  });

  it('keeps the generation-time open_items when queue_pairs is down', async () => {
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', json(PREVIEW)],
      ['/rpc/queue_pairs', mockResponse({ ok: false, status: 500 })],
    ]);
    const { metadata } = await fetchQueueMeta({ fetchImpl, source: 'db' });
    assert.equal(metadata.open_items, 999, "preview's generation-time count stands");
    assert.equal(metadata.open_items_basis, 'generation');
  });

  it('falls back to blob metadata when the preview is down', async () => {
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', mockResponse({ ok: false, status: 500 })],
      ['queue.json', json(GOOD_QUEUE)],
    ]);
    const { metadata } = await fetchQueueMeta({ fetchImpl, source: 'db' });
    assert.equal(metadata.open_items, 1, 'served from the blob fallback');
  });
});

// ---------------------------------------------------------------------------
// selectFromQueue — fetch-until-satisfied over the ranked prefix.
// ---------------------------------------------------------------------------

describe('selectFromQueue (DB source)', () => {
  const routesWithRows = (allRows) => [
    ['queue-preview.json', json(PREVIEW)],
    ['/rpc/queue_pairs', json([{ pair: 'a', item_count: allRows.length }])],
    ['/rpc/queue_top', pagedQueueTop(allRows)],
  ];

  it('stops after ONE page when the selection is already satisfied', async () => {
    const allRows = Array.from({ length: PAGE * 3 }, (_, i) => row(i + 1));
    const { fetchImpl, callsTo } = routedFetch(routesWithRows(allRows));
    const sel = await selectFromQueue({ limit: 3, fetchImpl, source: 'db' });
    assert.equal(sel.selected.length, 3);
    assert.equal(callsTo('/rpc/queue_top').length, 1, 'no reason to page deeper');
    assert.equal(sel.scannedRows, PAGE);
    assert.equal(sel.complete, false, 'the full ranking was NOT examined');
    assert.equal(sel.metadata.open_items, PAGE * 3);
  });

  it('pages deeper until a sparse filter is satisfied, advancing p_offset', async () => {
    // Matches live only on page 2: rows 998-1000 are the target model.
    const allRows = Array.from({ length: PAGE * 3 }, (_, i) =>
      row(i + 1, { model: i >= 997 && i < 1000 ? 'openai/gpt-5.5' : 'anthropic/claude-haiku-4.5' }));
    const { fetchImpl, callsTo } = routedFetch(routesWithRows(allRows));
    const sel = await selectFromQueue({ model: 'gpt-5.5', limit: 3, fetchImpl, source: 'db' });
    assert.equal(sel.selected.length, 3);
    assert.deepEqual(sel.selected.map((it) => it.priority), [998, 999, 1000]);
    const offsets = callsTo('/rpc/queue_top')
      .map((c) => JSON.parse(c.opts.body).p_offset);
    assert.deepEqual(offsets, [0, PAGE], 'pages advance from the watermark');
  });

  it('marks the selection complete when the ranking ends before the limit', async () => {
    const allRows = Array.from({ length: 7 }, (_, i) => row(i + 1));
    const { fetchImpl } = routedFetch(routesWithRows(allRows));
    const sel = await selectFromQueue({ limit: 20, fetchImpl, source: 'db' });
    assert.equal(sel.selected.length, 7);
    assert.equal(sel.complete, true, 'a short page proves the ranking ended');
  });

  it('never exceeds MAX_DB_PAGES, reporting an honest truncation instead', async () => {
    // An endless queue where nothing matches the filter: the pager must stop
    // at the bound (default 20 pages = 10,000 rows), not run forever.
    const { fetchImpl, callsTo } = routedFetch([
      ['queue-preview.json', json(PREVIEW)],
      ['/rpc/queue_pairs', json([{ pair: 'a', item_count: 999999 }])],
      ['/rpc/queue_top', (url, opts) => {
        const { p_offset: offset } = JSON.parse(opts.body);
        return json(Array.from({ length: PAGE }, (_, i) => row(offset + i + 1)));
      }],
    ]);
    const sel = await selectFromQueue({ model: 'no-such-model', limit: 3, fetchImpl, source: 'db' });
    assert.equal(sel.selected.length, 0);
    assert.equal(callsTo('/rpc/queue_top').length, 20, 'hard page bound');
    assert.equal(sel.scannedRows, 20 * PAGE);
    assert.equal(sel.complete, false, 'truncation is reported, never silent');
  });

  it('reuses the cached prefix as a watermark — deeper calls never refetch page 0', async () => {
    const allRows = Array.from({ length: PAGE * 3 }, (_, i) => row(i + 1));
    const { fetchImpl, callsTo } = routedFetch(routesWithRows(allRows));

    const shallow = await selectFromQueue({ limit: 3, fetchImpl, source: 'db' });
    assert.equal(callsTo('/rpc/queue_top').length, 1);

    // Needs 501 naive items → one MORE page, not a restart from offset 0.
    const deep = await selectFromQueue({ limit: PAGE + 1, fetchImpl, source: 'db' });
    const offsets = callsTo('/rpc/queue_top').map((c) => JSON.parse(c.opts.body).p_offset);
    assert.deepEqual(offsets, [0, PAGE], 'second call extends, never restarts');
    assert.equal(deep.selected.length, PAGE + 1);
    assert.equal(deep.scanned, shallow.scanned, 'one growing prefix array, reference-stable');
    assert.equal(callsTo('queue-preview.json').length, 1, 'metadata fetched once per generation');
  });

  it('keeps the partial prefix when a LATER page fails mid-flight', async () => {
    let topCalls = 0;
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', json(PREVIEW)],
      ['/rpc/queue_pairs', json([])],
      ['/rpc/queue_top', () => {
        topCalls += 1;
        if (topCalls > 1) return mockResponse({ ok: false, status: 500 });
        return json(Array.from({ length: PAGE }, (_, i) => row(i + 1)));
      }],
    ]);
    const sel = await selectFromQueue({ limit: PAGE + 10, fetchImpl, source: 'db' });
    assert.equal(sel.selected.length, PAGE, 'page 1 rows survive the page-2 failure');
    assert.equal(sel.complete, false);
  });

  it('falls back to the blob when the FIRST page fails', async () => {
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', json(PREVIEW)],
      ['/rpc/queue_pairs', json([])],
      ['/rpc/queue_top', mockResponse({ ok: false, status: 500 })],
      ['queue.json', json(GOOD_QUEUE)],
    ]);
    const sel = await selectFromQueue({ limit: 3, fetchImpl, source: 'db' });
    assert.equal(sel.selected.length, 1, 'served from the blob fallback');
    assert.equal(sel.selected[0].priority, 1);
    assert.equal(sel.complete, true, 'the blob is a complete served snapshot');
  });

  it('reports BOTH causes when the DB and the blob are down', async () => {
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', mockResponse({ ok: false, status: 502 })],
      ['queue.json', mockResponse({ ok: false, status: 503 })],
    ]);
    await assert.rejects(selectFromQueue({ limit: 3, fetchImpl, source: 'db' }), (err) => {
      assert.match(err.message, /live queue unavailable/);
      assert.match(err.message, /502/);
      assert.match(err.message, /503/);
      return true;
    });
  });
});

// ---------------------------------------------------------------------------
// lookupQueueItem — primary-key lookups, never ranked paging.
// ---------------------------------------------------------------------------

describe('lookupQueueItem (DB source)', () => {
  const withLookup = (routes) => routedFetch([
    ['queue-preview.json', json(PREVIEW)],
    ['/rpc/queue_pairs', json([])],
    ...routes,
  ]);

  it('looks up by id on the queue_items primary key — zero queue_top pages', async () => {
    const target = row(42, { id: 'eng-zul-dev-v1__anthropic_claude-haiku-4.5__naive' });
    const { fetchImpl, callsTo } = withLookup([
      ['/rest/v1/queue_items?', (url) => {
        assert.match(url, /id=eq\./);
        assert.match(url, /limit=1/);
        return json([target]);
      }],
      ['/rest/v1/run_cards?', json([])],
    ]);
    const { item, covered } = await lookupQueueItem({
      id: target.id, fetchImpl, source: 'db',
    });
    assert.equal(item.id, target.id);
    assert.equal(item.rank_mode, undefined, 'projected to the served shape');
    assert.equal(covered, false, 'no verified run → an open work item');
    assert.equal(callsTo('/rpc/queue_top').length, 0, 'never pages the ranking');
  });

  it('looks up by priority via the mode+priority index (never offset arithmetic)', async () => {
    const { fetchImpl } = withLookup([
      ['/rest/v1/queue_items?', (url) => {
        assert.match(url, /rank_mode=eq\.map/);
        assert.match(url, /priority=eq\.7/);
        return json([row(7)]);
      }],
      ['/rest/v1/run_cards?', json([])],
    ]);
    const { item } = await lookupQueueItem({ priority: 7, fetchImpl, source: 'db' });
    assert.equal(item.priority, 7);
  });

  it('flags an item already covered by a VERIFIED run', async () => {
    const target = row(1);
    const { fetchImpl } = withLookup([
      ['/rest/v1/queue_items?', json([target])],
      ['/rest/v1/run_cards?', (url) => {
        assert.match(url, /dataset_id=eq\./);
        assert.match(url, /trust=eq\.verified/);
        return json([{ id: 'rc-1' }]);
      }],
    ]);
    const { item, covered } = await lookupQueueItem({ id: target.id, fetchImpl, source: 'db' });
    assert.equal(item.id, target.id);
    assert.equal(covered, true);
  });

  it('returns covered: null (unknown) when the coverage probe fails', async () => {
    const target = row(1);
    const { fetchImpl } = withLookup([
      ['/rest/v1/queue_items?', json([target])],
      ['/rest/v1/run_cards?', mockResponse({ ok: false, status: 500 })],
    ]);
    const { item, covered } = await lookupQueueItem({ id: target.id, fetchImpl, source: 'db' });
    assert.equal(item.id, target.id);
    assert.equal(covered, null);
  });

  it('returns a clean not-found for an empty result', async () => {
    const { fetchImpl } = withLookup([
      ['/rest/v1/queue_items?', json([])],
    ]);
    const { item } = await lookupQueueItem({ id: 'nope', fetchImpl, source: 'db' });
    assert.equal(item, null);
  });

  it('falls back to a blob scan when the DB is down, noting blob truncation', async () => {
    const truncatedBlob = {
      metadata: { ...GOOD_QUEUE.metadata, blob_truncated: { kept: 110421, total: 211082 } },
      items: GOOD_QUEUE.items,
    };
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', mockResponse({ ok: false, status: 500 })],
      ['queue.json', json(truncatedBlob)],
    ]);
    const hit = await lookupQueueItem({
      id: GOOD_QUEUE.items[0].id, fetchImpl, source: 'db',
    });
    assert.equal(hit.item.priority, 1, 'found in the blob');

    const miss = await lookupQueueItem({ id: 'deep-item', fetchImpl, source: 'db' });
    assert.equal(miss.item, null);
    assert.match(miss.truncatedNote, /top slice.*110421.*211082/s,
      'a truncated-blob miss must say the item may exist deeper');
  });
});

// ---------------------------------------------------------------------------
// fetchQueue (DB source) — legacy entry point, now a BOUNDED prefix.
// ---------------------------------------------------------------------------

describe('fetchQueue (DB source — default)', () => {
  it('serves live items from queue_top, projected, with preview metadata and a live count', async () => {
    const r = row(1, { diagnostics: { x: 1 } });
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', json(PREVIEW)],
      ['/rpc/queue_pairs', json([{ pair: 'a', item_count: 1 }])],
      ['/rpc/queue_top', pagedQueueTop([r])],
    ]);
    const q = await fetchQueue({ fetchImpl, source: 'db' });
    assert.equal(q.items.length, 1);
    assert.equal(q.items[0].id, r.id);
    assert.equal(q.items[0].est_cost_usd, 0.01);
    assert.equal(q.items[0].rank_mode, undefined, 'non-served columns projected away');
    assert.equal(q.items[0].diagnostics, undefined);
    assert.equal(q.metadata.open_items, 1, 'open_items reflects the LIVE served count (queue_pairs)');
    assert.equal(q.metadata.priority_model, 'map-value v2', 'carries preview metadata');
  });

  it('falls back to the static blob when the DB path fails', async () => {
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', mockResponse({ ok: false, status: 500 })],
      ['queue.json', json(GOOD_QUEUE)],
    ]);
    const q = await fetchQueue({ fetchImpl, source: 'db' });
    assert.equal(q.items[0].priority, 1, 'served from the blob fallback');
  });

  it('is bounded: stops at MAX_DB_PAGES instead of draining a huge queue', async () => {
    const { fetchImpl, callsTo } = routedFetch([
      ['queue-preview.json', json(PREVIEW)],
      ['/rpc/queue_pairs', json([{ pair: 'a', item_count: 999999 }])],
      ['/rpc/queue_top', (url, opts) => {
        const { p_offset: offset } = JSON.parse(opts.body);
        return json(Array.from({ length: PAGE }, (_, i) => row(offset + i + 1)));
      }],
    ]);
    const q = await fetchQueue({ fetchImpl, source: 'db' });
    assert.equal(callsTo('/rpc/queue_top').length, 20, 'the 0.1.0 full drain is gone');
    assert.equal(q.items.length, 20 * PAGE);
    assert.equal(q.metadata.open_items, 999999, 'the live TOTAL is still reported');
  });
});

describe('fetchQueue (db source) — restricted-corpus transmission stamp', () => {
  // The `transmission` stamp is a SERVED extra on queue.json but not a
  // queue_items COLUMN — the ranker writes it into the diagnostics JSONB.
  // Projecting columns only dropped it from every DB-served item, so agents
  // pulling work through MCP lost the no-train channel requirement that the
  // blob discloses (280 WMT research-use items live at the time of writing).
  const STAMP = {
    policy: 'no-train',
    reason: "license 'LicenseRef-WMT-Research-Use': explicit data-side transmission_policy='no-train' on the registry entry",
    openrouter_provider_prefs: { data_collection: 'deny' },
  };

  function stampRoutes(rows) {
    return routedFetch([
      ['queue-preview.json', json({ metadata: { rank_mode: 'map', open_items: rows.length } })],
      ['/rpc/queue_pairs', json([])],
      ['/rpc/queue_top', pagedQueueTop(rows)],
    ]);
  }

  it('lifts diagnostics.transmission onto the served item', async () => {
    const { fetchImpl } = stampRoutes([
      row(1, { id: 'restricted', corpus_id: 'eval-wmt24-x',
        corpus_license: 'LicenseRef-WMT-Research-Use',
        diagnostics: { transmission: STAMP } }),
      row(2, { id: 'cleared', corpus_id: 'eval-tatoeba-y',
        corpus_license: 'CC-BY-2.0', diagnostics: {} }),
    ]);
    const queue = await fetchQueue({ fetchImpl, source: 'db' });
    const byId = Object.fromEntries(queue.items.map((i) => [i.id, i]));
    assert.deepEqual(byId.restricted.transmission, STAMP);
    assert.equal(byId.cleared.transmission, undefined);
  });

  it('does not leak the ranking diagnostics onto served items', async () => {
    const { fetchImpl } = stampRoutes([
      row(1, { id: 'restricted', corpus_id: 'eval-wmt24-x',
        corpus_license: 'LicenseRef-WMT-Research-Use',
        diagnostics: { transmission: STAMP, ecv_breakdown: { a: 1 } } }),
    ]);
    const queue = await fetchQueue({ fetchImpl, source: 'db' });
    assert.equal(queue.items[0].diagnostics, undefined);
    assert.deepEqual(queue.items[0].transmission, STAMP);
  });

  it('the stamp also survives a primary-key lookup', async () => {
    const target = row(1, { id: 'restricted', diagnostics: { transmission: STAMP } });
    const { fetchImpl } = routedFetch([
      ['queue-preview.json', json(PREVIEW)],
      ['/rpc/queue_pairs', json([])],
      ['/rest/v1/queue_items?', json([target])],
      ['/rest/v1/run_cards?', json([])],
    ]);
    const { item } = await lookupQueueItem({ id: 'restricted', fetchImpl, source: 'db' });
    assert.deepEqual(item.transmission, STAMP);
    assert.equal(item.diagnostics, undefined);
  });
});
