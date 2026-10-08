/**
 * website-tested-edges.test.js — guard: the /tested screen's CARD BOUNDARY.
 *
 * `/tested` is the one surface that renders measured scores on the map, so it
 * is the one most able to break the invariant the whole index rests on: a
 * language card asserts language PROPERTIES and resource EXISTENCE, and any
 * MEASURED score of method output is a RUN RESULT keyed by
 * (method, dataset, metric) that belongs on an EDGE — never on a language.
 *
 * It also guards the two rules a results view is most tempted to soften:
 * a quarantined dataset may never contribute a ranking, and the "best under
 * filter" reduction is a VIEW, not a verdict — it may pick a value to colour
 * by, but it may never discard the run it did not pick.
 *
 * Lives in cli/test (not beside its module in website/src/utils) so `npm test`
 * runs it — the same bridge pattern as website-seam-runs.test.js. A boundary
 * test nobody runs is decoration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {foldRuns, readyEdges} from '../website/src/utils/testedEdges.mjs';

const run = (o) => ({
  language_pair: 'eng>quz',
  dataset_id: 'ds-1',
  model_slug: 'nllb-200',
  trust: 'verified',
  chrf_plus_plus: 50,
  corpus_size: 500,
  ...o,
});

test('/tested never emits a score keyed by a single language', () => {
  const {edges} = foldRuns([run({}), run({language_pair: 'eng>mos', chrf_plus_plus: 12})]);
  assert.ok(edges.length > 0, 'sanity: the fold produced edges');
  for (const e of edges) {
    assert.ok(e.a && e.b, 'every emitted score is keyed by a PAIR');
    assert.ok(e.key.includes('|'), 'the key is an edge key, not a language code');
    assert.equal('language' in e, false, 'no per-language score structure');
    assert.equal('code' in e, false, 'no per-language score structure');
  }
});

test('/tested drops a quarantined dataset before it can rank', () => {
  const {edges, dropped} = foldRuns([run({dataset_id: 'improper-subset'})], {
    quarantined: new Set(['improper-subset']),
  });
  assert.equal(edges.length, 0, 'an improper slice may never rank');
  assert.equal(dropped, 1);
});

test('/tested drops a disqualified run', () => {
  const {edges} = foldRuns([run({trust: 'disqualified'})]);
  assert.equal(edges.length, 0);
});

test('the "best under filter" reduction keeps every run it did not pick', () => {
  const {edges} = foldRuns([
    run({chrf_plus_plus: 40, model_slug: 'a'}),
    run({chrf_plus_plus: 61, model_slug: 'b'}),
  ]);
  assert.equal(edges[0].metricValue, 61, 'colours by the best under the view');
  assert.equal(edges[0].runs.length, 2, 'and still carries the loser — a view, not a verdict');
});

test('a pair aggregates onto ONE edge regardless of direction', () => {
  const {edges} = foldRuns([run({}), run({language_pair: 'quz>eng'})]);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].runs.length, 2);
});

test('the corpus-ready layer carries registrations and never a score', () => {
  const ready = readyEdges({
    edges: [
      {a: 'aar', b: 'eng', status: 'registered', best_chrf: null, size: 1609},
      {a: 'afr', b: 'spa', status: 'measured', best_chrf: 79.25, size: 400},
    ],
  });
  assert.equal(ready.length, 1, 'snapshot MEASURED rows are excluded — the live board is the only score source');
  assert.equal('best_chrf' in ready[0], false, 'a registration carries no score field at all');
});
