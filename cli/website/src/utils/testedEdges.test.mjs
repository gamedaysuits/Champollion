import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foldRuns, readyEdges, splitPair, edgeKey, metricById} from './testedEdges.mjs';

const run = (o) => ({
  language_pair: 'eng>quz',
  dataset_id: 'ds-1',
  model_slug: 'nllb-200',
  trust: 'verified',
  chrf_plus_plus: 50,
  corpus_size: 500,
  ...o,
});

test('a pair aggregates onto ONE edge regardless of direction', () => {
  const {edges, runs} = foldRuns([run({}), run({language_pair: 'quz>eng'})]);
  assert.equal(edges.length, 1);
  assert.equal(runs, 2);
  assert.equal(edges[0].runs.length, 2, 'both runs survive — the edge never discards one');
});

test('a quarantined dataset can never contribute an edge', () => {
  const {edges, dropped} = foldRuns([run({dataset_id: 'bad'})], {
    quarantined: new Set(['bad']),
  });
  assert.equal(edges.length, 0);
  assert.equal(dropped, 1);
});

test('a disqualified run can never contribute an edge', () => {
  const {edges} = foldRuns([run({trust: 'disqualified'})]);
  assert.equal(edges.length, 0);
});

test('the reduction picks a VALUE to colour by and keeps every run', () => {
  const {edges} = foldRuns([
    run({chrf_plus_plus: 40, model_slug: 'a'}),
    run({chrf_plus_plus: 61, model_slug: 'b'}),
  ]);
  assert.equal(edges[0].metricValue, 61, 'colours by the best under the view');
  assert.equal(edges[0].runs.length, 2, 'and still carries the one it did not pick');
  assert.equal(edges[0].methodCount, 2);
});

test('TER inverts — lower is better', () => {
  const {edges} = foldRuns([run({ter: 80}), run({ter: 30})], {metric: 'ter'});
  assert.equal(edges[0].metricValue, 30);
  assert.equal(metricById('ter').hi, false);
});

test('size is the LARGEST corpus the pair was measured on (significance)', () => {
  const {edges} = foldRuns([run({corpus_size: 90}), run({corpus_size: 1200})]);
  assert.equal(edges[0].size, 1200);
});

test('trust is counted, never collapsed into the score', () => {
  const {edges} = foldRuns([run({trust: 'verified'}), run({trust: 'unverified'})]);
  assert.equal(edges[0].verified, 1);
  assert.equal(edges[0].unverified, 1);
});

test('a malformed language_pair is dropped, never guessed at', () => {
  const {edges, dropped} = foldRuns([run({language_pair: 'eng'}), run({language_pair: null})]);
  assert.equal(edges.length, 0);
  assert.equal(dropped, 2);
});

/* THE BOUNDARY INVARIANT. The whole screen exists to keep measured scores on
 * edges. If a score ever reaches a node this test is the thing that should
 * have caught it. */
test('no score is ever emitted keyed by a single language', () => {
  const {edges} = foldRuns([run({}), run({language_pair: 'eng>mos', chrf_plus_plus: 12})]);
  for (const e of edges) {
    assert.ok(e.a && e.b, 'every emitted score is keyed by a PAIR');
    assert.ok(e.key.includes('|'), 'the key is an edge key, not a language code');
  }
  // and the fold produces no per-language structure at all
  assert.equal(edges.some((e) => 'language' in e || 'code' in e), false);
});

test('the ready layer carries corpus registrations and NEVER a score', () => {
  const ready = readyEdges({
    edges: [
      {a: 'aar', b: 'eng', status: 'registered', best_chrf: null, size: 1609},
      {a: 'afr', b: 'spa', status: 'measured', best_chrf: 79.25, size: 400},
      {a: 'x', b: 'x', status: 'registered', best_chrf: null, size: 10},
    ],
  });
  assert.equal(ready.length, 1, 'measured snapshot rows are excluded — the board is the only score source');
  assert.equal(ready[0].a, 'aar');
  assert.equal('best_chrf' in ready[0], false, 'a registration carries no score field at all');
});

test('splitPair / edgeKey are order-free and total', () => {
  assert.deepEqual(splitPair('eng>quz'), ['eng', 'quz']);
  assert.equal(splitPair('nope'), null);
  assert.equal(edgeKey('quz', 'eng'), edgeKey('eng', 'quz'));
});
