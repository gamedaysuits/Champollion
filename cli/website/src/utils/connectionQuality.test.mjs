/**
 * connectionQuality.test.mjs — JS-twin suite for cq-v1.
 *
 * Mirrors the Python parity pins (arena/tests/test_connection_quality.py):
 * the spec's §9 worked examples to the digit, factor bounds and fail-honest
 * defaults, lane/chain rules, and — JS-side only — the constants-parity pin
 * against arcStrength.mjs (the display-band SSOT this module deliberately
 * does not import).
 *
 * Run: node --test src/utils/connectionQuality.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as cq from './connectionQuality.mjs';
import {
  BIN_EDGES as ARC_BIN_EDGES,
  BIN_LABELS as ARC_BIN_LABELS,
  SIGNIFICANCE_N as ARC_SIGNIFICANCE_N,
  cchrf as arcCchrf,
  pairFloor as arcPairFloor,
} from './arcStrength.mjs';

// Floors pinned from src/data/cchrf-floors.json for the spec's §9 examples
// (restated, not loaded — pure unit tests; same convention as the Python twin).
const FLOORS = { eng: 11.964, fao: 11.384, yor: 8.628, deu: 12.214 };

const run = (over = {}) => ({
  run_id: 'r1',
  chrf_plus_plus: 55.0,
  n: 200,
  ci_halfwidth: 3.0,
  l_eff: 6.0,
  contamination: 'LOW',
  trust: 'verified',
  paradigm: 'llm',
  age_days: 100,
  domain: 'news',
  register: null,
  ...over,
});

const E1_RUNS = [
  run(),
  run({ run_id: 'r2', chrf_plus_plus: 52.1, ci_halfwidth: 3.2, age_days: 40 }),
];
const MT_UNMEASURED = { w: 0.5, basis: 'unmeasured', pa: null };

const approx = (got, want, eps = 1e-9) => {
  assert.ok(Math.abs(got - want) <= eps, `expected ${want}, got ${got}`);
};

// ---- factors: bounds, anchors, fail-honest defaults -----------------------

test('factors: full-credit anchors', () => {
  assert.equal(cq.fSize(100), 1.0);
  assert.equal(cq.fRich(5.0), 1.0);
  assert.equal(cq.fConf(5.0), 1.0);
  assert.equal(cq.fRepl(2), 1.0);
});

test('factors: fail-honest defaults', () => {
  assert.equal(cq.fSize(null), 0.0);
  assert.equal(cq.fRich(null), 0.5);
  approx(cq.fConf(null, 100), 1.0);
  approx(cq.fConf(null, 62), 0.7874007874011811);
  assert.equal(cq.fConf(null, null), 0.0);
  assert.equal(cq.fRepl(null), 0.0);
});

test('factors: queue worked check — 62-item vocab list prices at ~0.04', () => {
  const r = cq.fSize(62) * cq.fRich(1.0) * cq.fConf(8.0) * cq.fRepl(1);
  approx(r, 0.03875, 1e-4);
});

// ---- chance correction + floors -------------------------------------------

test('cchrf: formula, noise rail, clamps, unusable inputs', () => {
  approx(cq.cchrf(55.0, 11.384), 0.4921910264512052);
  assert.equal(cq.cchrf(8.0, 11.384), 0.0);
  assert.equal(cq.cchrf(100.0, 10.0), 1.0);
  assert.equal(cq.cchrf(null, 10.0), null);
  assert.equal(cq.cchrf(55.0, null), null);
  assert.equal(cq.cchrf(55.0, 100.0), null);
});

test('floorForPair: directed target-side; undirected max, both required', () => {
  assert.equal(cq.floorForPair(FLOORS, 'eng', 'fao', 'a->b'), 11.384);
  assert.equal(cq.floorForPair(FLOORS, 'eng', 'fao', 'b->a'), 11.964);
  assert.equal(cq.floorForPair(FLOORS, 'eng', 'fao'), 11.964);
  assert.equal(cq.floorForPair(FLOORS, 'eng', 'iku'), null);
});

test('floorForPair: undirected correction is the conservative projection', () => {
  const raw = 55.0;
  const qu = cq.cchrf(raw, cq.floorForPair(FLOORS, 'eng', 'fao'));
  const qa = cq.cchrf(raw, cq.floorForPair(FLOORS, 'eng', 'fao', 'a->b'));
  const qb = cq.cchrf(raw, cq.floorForPair(FLOORS, 'eng', 'fao', 'b->a'));
  approx(qu, Math.min(qa, qb));
});

// ---- portfolio factors -----------------------------------------------------

test('fCover: base, full-credit shapes, religious never credits, caps', () => {
  assert.equal(cq.fCover(new Set(['news']), new Set(['_unlabeled'])), 0.5);
  assert.equal(cq.fCover(new Set(['news', 'legal', 'conv']), new Set(['x'])), 1.0);
  assert.equal(cq.fCover(new Set(['news', 'legal']), new Set(['textbook', 'government'])), 1.0);
  assert.equal(cq.fCover(new Set(['religious']), new Set(['x'])), 0.25);
  assert.equal(cq.fCover(new Set(['news', 'religious']), new Set(['x'])), 0.5);
  assert.equal(cq.fCover(new Set(['a', 'b', 'c', 'd']), new Set(['g1', 'g2', 'g3'])), 1.0);
});

test('metricTrustWeight: chance-anchored 2·PA − 1', () => {
  assert.equal(cq.metricTrustWeight(0.5), 0.0);
  assert.equal(cq.metricTrustWeight(1.0), 1.0);
  approx(cq.metricTrustWeight(0.6545), 0.309, 1e-12);
  assert.equal(cq.metricTrustWeight(0.44), 0.0);
  assert.equal(cq.metricTrustWeight(null), cq.W_METRIC_UNMEASURED);
});

const ARTIFACT = {
  languages: {
    iu: { iso639_3: 'iku', family: 'Eskimo-Aleut' },
    cs: { iso639_3: 'ces', family: 'Indo-European' },
  },
  cells: [
    { preferred: true, level: 'sys', metric: 'chrf_plus_plus', tgt: 'iu', pairwise_accuracy: 0.6545, n_sys: 11 },
  ],
  families: {
    'Indo-European': { metrics: { chrf_plus_plus: { sys: { pairwise_accuracy_weighted_mean: 0.7946 } } } },
    'Eskimo-Aleut': { metrics: {} },
  },
};

test('resolveMetricTrust: pair → family → unmeasured ladder, no borrowing', () => {
  assert.equal(cq.resolveMetricTrust(ARTIFACT, 'chrf_plus_plus', 'iu').basis, 'pair');
  assert.equal(cq.resolveMetricTrust(ARTIFACT, 'chrf_plus_plus', 'iku').basis, 'pair');
  const fam = cq.resolveMetricTrust(ARTIFACT, 'chrf_plus_plus', 'cs');
  assert.equal(fam.basis, 'family');
  approx(fam.w, 2 * 0.7946 - 1);
  assert.deepEqual(cq.resolveMetricTrust(ARTIFACT, 'chrf_plus_plus', 'fao'),
    { w: 0.5, basis: 'unmeasured', pa: null });
});

test('wRecency: steps, exemptions, unknowns drift', () => {
  assert.equal(cq.wRecency(100, 'llm'), 1.0);
  assert.equal(cq.wRecency(400, 'llm'), 0.8);
  assert.equal(cq.wRecency(1000, 'llm'), 0.6);
  assert.equal(cq.wRecency(null, 'llm'), 0.6);
  assert.equal(cq.wRecency(10000, 'rule-based'), 1.0);
  assert.equal(cq.wRecency(null, 'human'), 1.0);
  assert.equal(cq.wRecency(1000, null), 0.6);
});

test('trust + contamination maps', () => {
  assert.equal(cq.wTrust('verified'), 1.0);
  assert.equal(cq.wTrust('unverified'), 0.6);
  assert.equal(cq.wTrust(null), 0.6);
  assert.equal(cq.wContam('LOW'), 1.0);
  assert.equal(cq.wContam('MEDIUM'), 0.4);
  assert.equal(cq.wContam('HIGH'), 0.1);
  assert.equal(cq.wContam(null), 0.4);
});

// ---- §9 worked examples, pinned to the digit -------------------------------

test('E1 directed: eng→fao healthy pair', () => {
  const t = cq.connectionQuality(E1_RUNS, FLOORS, 'eng', 'fao',
    { direction: 'a->b', metricTrust: MT_UNMEASURED });
  assert.equal(t.lane, 'clean');
  assert.equal(t.rung, 'L0');
  approx(t.q, 0.4921910264512052);
  approx(t.r, 0.25);
  approx(t.cq, 0.1230477566128013);
  assert.equal(t.band_label, 'developing');
  assert.equal(t.provisional, false);
  assert.equal(t.source, 'champollion-derived');
  assert.equal(t.provenance.supporting_run, 'r1');
  assert.equal(t.components.f_repl, 1.0);
});

test('E1 undirected: max-of-pair floor is conservative', () => {
  const t = cq.connectionQuality(E1_RUNS, FLOORS, 'eng', 'fao',
    { metricTrust: MT_UNMEASURED });
  assert.equal(t.components.floor, 11.964);
  approx(t.q, 0.4888454723067836);
  assert.ok(t.q <= 0.4921910264512052);
});

test('E2: 62-item self-benchmarked vocabulary list is not a connection', () => {
  const runs = [run({
    run_id: 'v1', chrf_plus_plus: 41.0, n: 62, ci_halfwidth: null,
    l_eff: 1.0, trust: 'unverified', age_days: 10, domain: null,
  })];
  const t = cq.connectionQuality(runs, FLOORS, 'eng', 'yor',
    { direction: 'a->b', metricTrust: MT_UNMEASURED });
  approx(t.q, 0.35428796567876375);
  approx(t.r, 0.007322827322830985);
  approx(t.cq, 0.0025943895952226575);
  assert.equal(t.provisional, true);
});

test('E3: floor unknown → rung raw, off the ramp, unrankable', () => {
  const runs = [run({ run_id: 'i1', n: 300, ci_halfwidth: 2.5, l_eff: 7.0, age_days: 60 })];
  const t = cq.connectionQuality(runs, FLOORS, 'eng', 'iku',
    { direction: 'a->b', metricTrust: { w: 0.309, basis: 'pair', pa: 0.6545 } });
  assert.equal(t.rung, 'raw');
  assert.equal(t.q, null);
  approx(t.q_raw, 0.55);
  assert.equal(t.cq, null);
  assert.equal(t.band, null);
  approx(t.r, 0.07725, 1e-12);
});

test('E4: unknown contamination → MEDIUM, relative lane', () => {
  const runs = [run({
    run_id: 'f1', chrf_plus_plus: 60.0, n: 1012, ci_halfwidth: 1.5,
    l_eff: 6.5, contamination: null, age_days: 30, never_chain: true,
  })];
  const t = cq.connectionQuality(runs, FLOORS, 'eng', 'deu', { direction: 'a->b' });
  assert.equal(t.lane, 'relative');
  assert.equal(t.components.w_contam, 0.4);
  approx(t.q, 0.544346478937416);
  approx(t.r, 0.05);
  approx(t.cq, 0.0272173239468708);
});

test('non-LOW evidence can never strengthen a clean pair', () => {
  const clean = cq.connectionQuality(E1_RUNS, FLOORS, 'eng', 'fao',
    { direction: 'a->b', metricTrust: MT_UNMEASURED });
  const withMed = cq.connectionQuality(
    [...E1_RUNS, run({
      run_id: 'm1', chrf_plus_plus: 70.0, n: 1000, ci_halfwidth: 1.0,
      contamination: 'MEDIUM', age_days: 5,
    })],
    FLOORS, 'eng', 'fao', { direction: 'a->b', metricTrust: MT_UNMEASURED });
  assert.equal(withMed.q, clean.q);
  assert.equal(withMed.cq, clean.cq);
  assert.equal(withMed.components.n_runs, clean.components.n_runs);
});

test('disqualified runs are invisible; empty board stays UNMEASURED', () => {
  assert.equal(cq.connectionQuality([run({ trust: 'disqualified' })], FLOORS, 'eng', 'fao').lane, 'unmeasured');
  const t = cq.connectionQuality([], FLOORS, 'eng', 'fao');
  assert.equal(t.lane, 'unmeasured');
  assert.equal(t.q, null);
  assert.equal(t.r, null);
  assert.equal(t.cq, null);
});

test('noise rail flags at-or-below-floor output', () => {
  const t = cq.connectionQuality([run({ run_id: 'n1', chrf_plus_plus: 10.0 })],
    FLOORS, 'eng', 'fao', { direction: 'a->b' });
  assert.equal(t.q, 0.0);
  assert.ok(t.flags.includes('at_or_below_floor'));
});

test('no canonical metric → rung raw with flag', () => {
  const t = cq.connectionQuality([run({ run_id: 'b1', chrf_plus_plus: null })],
    FLOORS, 'eng', 'fao');
  assert.equal(t.rung, 'raw');
  assert.ok(t.flags.includes('no_canonical_metric'));
});

// ---- human evidence precedence ---------------------------------------------

test('speaker evidence sets q and outranks automatic scores', () => {
  const t = cq.connectionQuality(E1_RUNS, FLOORS, 'eng', 'fao', {
    direction: 'a->b',
    humanEvidence: { class: 'speaker', share: 0.8, n: 30, reviewers: 2 },
  });
  assert.equal(t.evidence_class, 'speaker');
  assert.equal(t.rung, 'human');
  assert.equal(t.q, 0.8);
  assert.equal(t.r, 1.0);
  approx(t.cq, 0.8);
  assert.equal(t.provisional, false);
});

test('thin speaker review discounts by the T3 anchors', () => {
  const t = cq.connectionQuality([], FLOORS, 'eng', 'fao', {
    humanEvidence: { class: 'speaker', share: 0.9, n: 15, reviewers: 1 },
  });
  approx(t.r, (15 / 30) * (1 / 2));
  assert.equal(t.provisional, true);
});

// ---- chains -----------------------------------------------------------------

const HOP1 = { lane: 'clean', rung: 'L0', q: 0.62, r: 0.9, never_chain: false };
const HOP2 = { lane: 'clean', rung: 'L0', q: 0.4921910264512052, r: 0.25, never_chain: false };

test('E5 chain: quality composes with λ, reliability takes the weakest hop', () => {
  const c = cq.chainQuality([HOP1, HOP2]);
  assert.equal(c.estimated, true);
  approx(c.q, 0.27464259275977254);
  assert.equal(c.r, 0.25);
  approx(c.cq, 0.06866064818994314);
});

test('ineligible hops void the chain — refused, not discounted', () => {
  assert.equal(cq.chainQuality([HOP1, { ...HOP2, never_chain: true }]), null);
  assert.equal(cq.chainQuality([{ ...HOP1, lane: 'relative' }]), null);
  assert.equal(cq.chainQuality([{ ...HOP1, rung: 'raw' }]), null);
});

test('single hop pays no junction discount; human rung is chainable', () => {
  approx(cq.chainQuality([HOP1]).q, 0.62);
  assert.notEqual(cq.chainQuality([{ ...HOP1, rung: 'human' }]), null);
});

// ---- honesty properties + display-layer parity ------------------------------

test('no fail-honest default is the most favorable value of its factor', () => {
  assert.ok(cq.fSize(null) < 1.0);
  assert.ok(cq.fRich(null) < 1.0);
  assert.ok(cq.fRepl(null) < 1.0);
  assert.ok(cq.W_CONTAM_UNKNOWN < cq.W_CONTAM.LOW);
  assert.ok(cq.W_TRUST_UNKNOWN < cq.W_TRUST.verified);
  assert.ok(cq.W_METRIC_UNMEASURED < 1.0);
  assert.ok(cq.wRecency(null, 'llm') < 1.0);
  assert.ok(cq.fCover(new Set(), new Set()) < 1.0);
});

test('parity pin: band constants and correction agree with arcStrength.mjs', () => {
  assert.deepEqual(cq.BIN_EDGES, ARC_BIN_EDGES);
  assert.deepEqual(cq.BIN_LABELS, ARC_BIN_LABELS);
  assert.equal(cq.SIGNIFICANCE_N, ARC_SIGNIFICANCE_N);
  // Same correction arithmetic as the display layer…
  approx(cq.cchrf(55.0, 11.964), arcCchrf(55.0, 11.964));
  // …and the same undirected max-of-pair floor rule.
  assert.equal(
    cq.floorForPair(FLOORS, 'eng', 'fao'),
    arcPairFloor(FLOORS, 'eng', 'fao'),
  );
});
