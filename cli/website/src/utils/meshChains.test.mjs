/**
 * Unit tests for meshChains — the loss-minimizing chain finder behind the
 * /mesh "Unprecedented pairs" gallery.
 *
 * Run with: node --test src/utils/meshChains.test.mjs
 *
 * Headline guards:
 *   • Routing minimizes LOSS, not hops — a longer chain through a better
 *     bridge beats a shorter, lossier one (the Amharic→eng→spa→que story).
 *   • FLORES / HIGH (clean:false) edges are NEVER traversed.
 *   • Empty board → "awaiting measurement" with NO fabricated numbers.
 *   • Every curated pair is genuinely chained (no direct clean edge) and every
 *     hop is a clean edge in the regenerated mesh.json.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  pairKey,
  buildEdgeIndex,
  edgeQuality,
  isChainable,
  bestMeasuredChain,
  resolvePair,
  UNPRECEDENTED_PAIRS,
} from './meshChains.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESH_JSON = path.resolve(__dirname, '../../static/mesh.json');

/** Build a measured clean edge. */
const edge = (a, b, chrf, clean = true) => ({
  a, b, best_chrf: chrf, bestNow: chrf, clean,
});

describe('loss-minimizing routing (not fewest hops)', () => {
  // Direct A–C exists but is LOSSY (chrf 30 → q 0.30). The 2-hop detour
  // A–B–C is each 0.90 → product 0.81 ≫ 0.30. Loss routing must pick the
  // LONGER, lower-loss chain. (This is the Amharic→eng→spa→que principle.)
  const edges = [
    edge('A', 'C', 30), // direct but lossy
    edge('A', 'B', 90),
    edge('B', 'C', 90),
  ];

  it('chooses the longer, lower-loss chain over the short lossy one', () => {
    const r = bestMeasuredChain(edges, 'A', 'C');
    assert.deepEqual(r.nodes, ['A', 'B', 'C'], 'should route A→B→C, not A→C');
  });

  it('resolvePair reports the longer chain with a compounded predicted loss', () => {
    const idx = buildEdgeIndex(edges);
    const res = resolvePair({ source: 'A', target: 'C', via: ['B'] }, edges, idx);
    assert.equal(res.state, 'predicted');
    assert.deepEqual(res.nodes, ['A', 'B', 'C']);
    // 0.90 * 0.90 = 0.81 → chainScore 81, loss 0.19
    assert.equal(res.chainScore, 81);
    assert.ok(Math.abs(res.loss - 0.19) < 1e-9);
  });

  it('a shorter chain DOES win when it is also lower-loss', () => {
    // Now the direct edge is excellent (95) — fewer hops AND less loss.
    const e2 = [edge('A', 'C', 95), edge('A', 'B', 60), edge('B', 'C', 60)];
    const r = bestMeasuredChain(e2, 'A', 'C');
    assert.deepEqual(r.nodes, ['A', 'C']);
  });
});

describe('clean-edge gate (no FLORES / HIGH bridges)', () => {
  it('never traverses a clean:false edge even if it is the only short route', () => {
    const edges = [
      edge('X', 'Z', 99, false), // contaminated direct (e.g. FLORES) — forbidden
      edge('X', 'Y', 70, true),
      edge('Y', 'Z', 70, true),
    ];
    const r = bestMeasuredChain(edges, 'X', 'Z');
    assert.deepEqual(r.nodes, ['X', 'Y', 'Z'], 'must detour around the dirty edge');
  });

  it('returns null when the only route requires a contaminated edge', () => {
    const edges = [edge('X', 'Z', 99, false)];
    assert.equal(bestMeasuredChain(edges, 'X', 'Z'), null);
  });

  it('isChainable: only clean===true is usable; missing/false fail safe', () => {
    assert.equal(isChainable({ clean: true }), true);
    assert.equal(isChainable({ clean: false }), false);
    assert.equal(isChainable({}), false); // missing flag → NOT a bridge (fail safe)
    assert.equal(isChainable({ clean: 'yes' }), false); // non-boolean → not clean
    assert.equal(isChainable(null), false);
  });
});

describe('empty board → awaiting measurement, no fabricated numbers', () => {
  it('resolves to the curated skeleton with null quality/loss', () => {
    const edges = []; // no published runs
    const idx = buildEdgeIndex(edges);
    const res = resolvePair({ source: 'bod', target: 'que', via: ['eng'] }, edges, idx);
    assert.equal(res.state, 'awaiting');
    assert.deepEqual(res.nodes, ['bod', 'eng', 'que']);
    assert.equal(res.quality, null);
    assert.equal(res.chainScore, null);
    assert.equal(res.loss, null);
  });

  it('a partially-measured chain (one hop missing) stays awaiting', () => {
    const edges = [edge('bod', 'eng', 60)]; // eng→que not yet measured
    const idx = buildEdgeIndex(edges);
    const res = resolvePair({ source: 'bod', target: 'que', via: ['eng'] }, edges, idx);
    assert.equal(res.state, 'awaiting');
    assert.equal(res.chainScore, null);
  });
});

describe('predicted quality is the product of per-hop chrF++', () => {
  it('compounds loss across hops', () => {
    const edges = [edge('a', 'b', 80), edge('b', 'c', 50)];
    const idx = buildEdgeIndex(edges);
    const res = resolvePair({ source: 'a', target: 'c', via: ['b'] }, edges, idx);
    // 0.80 * 0.50 = 0.40 → predicted score 40 (lower than either hop)
    assert.equal(res.chainScore, 40);
    assert.ok(res.chainScore < 50, 'chain quality is below the worst hop');
  });

  it('edgeQuality clamps and rejects non-positive scores', () => {
    assert.equal(edgeQuality(edge('a', 'b', 0)), null);
    assert.equal(edgeQuality(edge('a', 'b', 100)), 1);
    assert.equal(edgeQuality({ a: 'a', b: 'b', best_chrf: null }), null);
  });
});

describe('curated gallery integrity', () => {
  it('has ~15-20 pairs', () => {
    assert.ok(UNPRECEDENTED_PAIRS.length >= 15 && UNPRECEDENTED_PAIRS.length <= 22);
  });

  it('every pair declares a via-chain and a note', () => {
    for (const p of UNPRECEDENTED_PAIRS) {
      assert.ok(p.source && p.target && Array.isArray(p.via) && p.via.length >= 1, JSON.stringify(p));
      assert.ok(typeof p.note === 'string' && p.note.length > 0);
    }
  });

  it('includes the named showcase pairs incl. Quechua→Cantonese via Spanish→Mandarin', () => {
    const has = (s, t) => UNPRECEDENTED_PAIRS.some((p) => p.source === s && p.target === t);
    assert.ok(has('que', 'yue'), 'Quechua→Cantonese');
    assert.ok(has('dtp', 'que'), 'Kadazan Dusun→Quechua');
    assert.ok(has('mya', 'que'), 'Burmese→Quechua');
    const qy = UNPRECEDENTED_PAIRS.find((p) => p.source === 'que' && p.target === 'yue');
    assert.deepEqual(qy.via, ['spa', 'cmn'], 'Quechua→Cantonese must bridge Spanish→Mandarin, with no English hop');
  });

  // The doctrine check: each curated chain must be a real CLEAN path with NO
  // direct clean edge between the endpoints — validated against the actual
  // regenerated mesh.json. Skips gracefully if the artifact is absent (e.g. a
  // cold checkout before prebuild), so it never blocks CI on a missing file.
  it('every curated chain is genuinely chained over clean mesh.json edges', { skip: !existsSync(MESH_JSON) && 'mesh.json not generated' }, () => {
    const mesh = JSON.parse(readFileSync(MESH_JSON, 'utf8'));
    const idx = buildEdgeIndex(mesh.edges || []);
    const clean = (a, b) => {
      const e = idx.get(pairKey(a, b));
      return !!e && e.clean === true;
    };
    for (const p of UNPRECEDENTED_PAIRS) {
      const label = `${p.source}→${p.target}`;
      assert.equal(clean(p.source, p.target), false, `${label}: must have NO direct clean edge (genuinely chained)`);
      const nodes = [p.source, ...p.via, p.target];
      for (let i = 0; i < nodes.length - 1; i++) {
        assert.ok(clean(nodes[i], nodes[i + 1]), `${label}: hop ${nodes[i]}→${nodes[i + 1]} must be a clean edge`);
      }
    }
  });
});
