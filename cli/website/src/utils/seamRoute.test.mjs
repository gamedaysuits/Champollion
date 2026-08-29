/**
 * Guard: the living-route reroute is a REAL router decision, never hardcoded.
 * The seam claims that as the measured graph grows, meshChains.bestMeasuredChain
 * genuinely RE-DECIDES the lowest-loss path — and that the reroute CONDENSES the
 * chain, eliminating BOTH the Danish and Spanish relays for a single
 * high-resource pivot (fao→eng→quz), a 2→1 interlingua reduction (founder
 * 2026-07-24). If someone tweaks the illustrative edge values so the flip no
 * longer happens, this test fails.
 *
 * Run: node --test cli/website/src/utils/seamRoute.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bestMeasuredChain} from './meshChains.js';
import {ROUTE_EDGES, IMPROVE_EDGE, REROUTE_EDGES} from './seamStory.mjs';

const improvedEdges = ROUTE_EDGES.map((e) => (e.a === 'spa' && e.b === 'quz' ? IMPROVE_EDGE : e));
const rerouteEdges = [...improvedEdges, ...REROUTE_EDGES];

test('base router: the winner routes fao→dan→spa→quz', () => {
  const w = bestMeasuredChain(ROUTE_EDGES, 'fao', 'quz');
  assert.ok(w, 'a base route exists');
  assert.deepEqual(w.nodes, ['fao', 'dan', 'spa', 'quz']);
});

test('improve lifts the weak hop but keeps the same road', () => {
  const w = bestMeasuredChain(improvedEdges, 'fao', 'quz');
  assert.deepEqual(w.nodes, ['fao', 'dan', 'spa', 'quz'], 'same road, lower loss');
});

test('reroute CONDENSES the winner to fao→eng→quz (dan+spa eliminated, 2→1)', () => {
  const base = bestMeasuredChain(ROUTE_EDGES, 'fao', 'quz');
  const rerouted = bestMeasuredChain(rerouteEdges, 'fao', 'quz');
  assert.ok(rerouted, 'a rerouted path exists');
  assert.deepEqual(rerouted.nodes, ['fao', 'eng', 'quz'], 'the router re-decided through a single English pivot');
  // the flip is genuine: the node set changed and dan+spa dropped out.
  assert.notDeepEqual(rerouted.nodes, base.nodes, 'the route actually changed');
  assert.ok(!rerouted.nodes.includes('dan'), 'Danish hop eliminated');
  assert.ok(!rerouted.nodes.includes('spa'), 'Spanish hop eliminated');
  // the CONDENSE: fewer interlingua than the base (2 → 1).
  const interlingua = (w) => w.nodes.slice(1, -1).length;
  assert.equal(interlingua(base), 2, 'the base routes through two interlingua');
  assert.equal(interlingua(rerouted), 1, 'the reroute condenses to a single interlingua');
  assert.ok(interlingua(rerouted) < interlingua(base), 'the chain genuinely condenses');
  // and it is chosen by LOSS, not hop count.
  assert.ok(rerouted.totalLoss < base.totalLoss, 'the rerouted path has lower total loss');
});

test('every routing code appears in a language card (real languages)', () => {
  const codes = new Set([
    ...ROUTE_EDGES.flatMap((e) => [e.a, e.b]),
    IMPROVE_EDGE.a, IMPROVE_EDGE.b,
    ...REROUTE_EDGES.flatMap((e) => [e.a, e.b]),
  ]);
  for (const c of codes) assert.match(c, /^[a-z]{3}$/, `${c} is an ISO 639-3 code`);
  assert.ok(codes.has('eng') && codes.has('quz'), 'the reroute cast is present');
});
