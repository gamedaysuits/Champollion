/**
 * liveQueue — the site's front door to the DB-as-queue RPCs.
 *
 * Pins D15 (DATABASE_SCHEMA): queue_pairs returns one row per open pair
 * (3,620 on 2026-09-06) and PostgREST serves at most 1,000 rows per response,
 * so fetchQueuePairs MUST page with limit/offset until a short page. Before
 * this, the /contribute strip summed the first 1,000 rows (69,695) and
 * under-reported the true open total (211,082) by 3×. No network: fetch is
 * injected.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchQueuePairs, PAIRS_PAGE } from './liveQueue.js';

function json(body) {
  return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) };
}

describe('fetchQueuePairs', () => {
  it('pages past the 1,000-row cap and returns every pair', async () => {
    const page1 = Array.from({ length: PAIRS_PAGE }, (_, i) => ({ pair: `p${i}`, src: 'a', tgt: 'b', item_count: '2', min_cost: '0.001' }));
    const page2 = Array.from({ length: 3 }, (_, i) => ({ pair: `q${i}`, src: 'c', tgt: 'd', item_count: '5', min_cost: null }));
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      const offset = Number(new URL(url).searchParams.get('offset') || 0);
      return json(offset === 0 ? page1 : offset === PAIRS_PAGE ? page2 : []);
    };
    const rows = await fetchQueuePairs({ fetchImpl });
    assert.equal(rows.length, PAIRS_PAGE + 3);
    assert.equal(rows.reduce((s, r) => s + r.count, 0), PAIRS_PAGE * 2 + 3 * 5);
    assert.equal(urls.length, 2, 'stops after the first short page');
    assert.match(urls[0], /\/rpc\/queue_pairs\?limit=1000&offset=0$/);
    assert.match(urls[1], /\/rpc\/queue_pairs\?limit=1000&offset=1000$/);
    assert.equal(rows[PAIRS_PAGE].minCost, null, 'null min_cost stays null');
  });

  it('a single short page is one call', async () => {
    let n = 0;
    const fetchImpl = async () => { n += 1; return json([{ pair: 'x', src: 'a', tgt: 'b', item_count: 4, min_cost: 1 }]); };
    const rows = await fetchQueuePairs({ fetchImpl });
    assert.equal(n, 1);
    assert.deepEqual(rows, [{ pair: 'x', src: 'a', tgt: 'b', count: 4, minCost: 1 }]);
  });

  it('throws on a non-array or failed response instead of returning a partial sum', async () => {
    await assert.rejects(fetchQueuePairs({ fetchImpl: async () => ({ ok: false, status: 500, text: async () => '' }) }), /queue_pairs HTTP 500/);
    await assert.rejects(fetchQueuePairs({ fetchImpl: async () => json({ not: 'an array' }) }), /did not return an array/);
  });
});
