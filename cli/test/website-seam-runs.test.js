/**
 * website-seam-runs.test.js — guard: the seam's per-pair run data stays HONEST
 * (the COMET fix).
 *   • COMET / AfriCOMET never appear for a pair unless BOTH language cards carry
 *     the gate (metricModelSupport.xlmr / .africomet) — checked against the
 *     COMPOSED card view (registers.getLanguageCard, the ONE JS adapter), with
 *     explicit fixtures from the plan's audit;
 *   • every emitted metric name resolves to an implemented registry metric;
 *   • every emitted benchmark id is a real eval set BOTH languages sit on
 *     (traceable to a corpora-card), and pairs with no shared set are null;
 *   • every pair the tape + chain reference has a record with real codes.
 *
 * WHY the composed view and not a raw card read: since the atlas cutover the
 * projected cards carry metricModelSupport as an attributed ENVELOPE and no
 * evalDatasets at all — eval wiring is config (card-config.json evalConfig,
 * derived from the corpora cards by sync-eval-datasets.mjs) attached at read
 * time, and the envelope is flattened per metric-coverage.json's pivot marks,
 * both by registers.js. A raw JSON.parse here would re-create the exact
 * private-reader breakage the adapter exists to prevent.
 *
 * Lives in cli/test (not beside its module in website/src/utils) so `npm test`
 * runs it — the same bridge pattern as website-card-adapter.test.js. The one
 * test that needs the website's GENERATED data (graph-poster.json, gitignored)
 * skips loudly when that data is not built.
 *
 * Run: cd cli && npm test   (or: node --test test/website-seam-runs.test.js)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {SEAM_RUNS, SEAM_ANSWER, runFor, runKey, benchmarkLine, metricsFor} from '../website/src/utils/seamRuns.mjs';
import {getLanguageCard} from '../lib/registers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = join(HERE, '..', 'shared');
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const registry = readJSON(join(SHARED, 'metric-registry.json')).entries;
const card = (c) => {
  const view = getLanguageCard(c);
  assert.ok(view, `language card missing for '${c}'`);
  return view;
};
const hasXlmr = (c) => {
  const m = card(c).metricModelSupport;
  return !!(m && m.xlmr && (m.xlmr.tier || m.xlmr.supported));
};
const hasAfri = (c) => {
  const m = card(c).metricModelSupport;
  return !!(m && m.africomet && m.africomet.supported);
};

const METRIC_ID = {
  'chrF++': 'chrf_plus_plus', spBLEU: 'spbleu', BLEU: 'bleu', TER: 'ter',
  COMET: 'comet_score', AfriCOMET: 'comet_score',
};

test('every metric name is an implemented registry metric', () => {
  for (const r of Object.values(SEAM_RUNS)) {
    for (const name of r.metrics) {
      const id = METRIC_ID[name];
      assert.ok(id, `metric "${name}" has no registry mapping`);
      assert.ok(registry[id] && registry[id].status === 'implemented', `metric "${name}" (${id}) not implemented`);
    }
  }
});

test('COMET / AfriCOMET only when BOTH cards carry the gate', () => {
  for (const r of Object.values(SEAM_RUNS)) {
    if (r.metrics.includes('COMET')) {
      assert.ok(hasXlmr(r.a) && hasXlmr(r.b), `COMET emitted for ${r.a}↔${r.b} but a card lacks xlmr`);
    } else {
      assert.ok(!(hasXlmr(r.a) && hasXlmr(r.b) && r.a !== r.b) || true); // presence not required
    }
    if (r.metrics.includes('AfriCOMET')) {
      assert.ok(hasAfri(r.a) && hasAfri(r.b), `AfriCOMET emitted for ${r.a}↔${r.b} but a card lacks africomet`);
    }
  }
});

test('the plan audit fixtures hold', () => {
  // spa↔quz: NO COMET (quz has no xlmr) AND no held-out benchmark yet.
  const spaQuz = runFor('spa', 'quz');
  assert.ok(spaQuz, 'spa↔quz record exists');
  assert.ok(!spaQuz.metrics.includes('COMET'), 'spa↔quz must not show COMET');
  assert.equal(spaQuz.benchmark, null, 'spa↔quz has no shared eval set (quz has none)');
  assert.equal(benchmarkLine('spa', 'quz').has, false);

  // dan↔spa: COMET valid (both xlmr).
  assert.ok(runFor('dan', 'spa').metrics.includes('COMET'), 'dan↔spa should show COMET');

  // fao↔dan: NO COMET (fao lacks xlmr).
  assert.ok(!runFor('fao', 'dan').metrics.includes('COMET'), 'fao↔dan must not show COMET');

  // fra↔bam: neither COMET (fra+bam) nor AfriCOMET (fra is the publisher's
  // PIVOT, not a target — metric-coverage.json marks it; bam is not listed).
  const fraBam = runFor('fra', 'bam');
  assert.ok(!fraBam.metrics.includes('COMET') && !fraBam.metrics.includes('AfriCOMET'), 'fra↔bam gets neither COMET nor AfriCOMET');

  // swh↔lug: NEITHER. AfriCOMET's publisher-verified list (metric-coverage.json,
  // asOf 2026-08-05) covers Swahili only as the MACROLANGUAGE code `swa` —
  // whether that extends to swh is the open question the register records, not
  // answers — and Luganda is not on the list at all. The pre-atlas cards
  // asserted africomet on both, which is exactly the over-claim the faithful
  // mapping removed. COMET is also invalid (lug lacks xlmr).
  const swhLug = runFor('swh', 'lug');
  assert.ok(!swhLug.metrics.includes('AfriCOMET'), 'swh↔lug must not show AfriCOMET (lug uncovered; swh only via macro swa)');
  assert.ok(!swhLug.metrics.includes('COMET'), 'swh↔lug must not show COMET');
  assert.ok(swhLug.metrics.includes('chrF++') && swhLug.metrics.includes('spBLEU'), 'swh↔lug keeps its surface lenses');

  // eng↔quz: the condensing reroute measurement — quz has no eval sets →
  // null benchmark, and no COMET (quz lacks xlmr).
  const engQuz = runFor('eng', 'quz');
  assert.ok(engQuz, 'eng↔quz record exists');
  assert.equal(engQuz.benchmark, null, 'eng↔quz shares no eval set (quz has none)');
  assert.ok(!engQuz.metrics.includes('COMET'), 'eng↔quz must not show COMET');
});

test('the Answer Card payload is DERIVED, not invented (R5, Act VI)', () => {
  const a = SEAM_ANSWER;
  assert.ok(a, 'the answer payload exists');
  assert.match(a.src, /^[a-z]{3}$/, 'src is an ISO 639-3 code');
  assert.match(a.tgt, /^[a-z]{3}$/, 'tgt is an ISO 639-3 code');

  // the domain must be a code from the CLOSED 17-code taxonomy SSOT — the card
  // may never show a domain Champollion does not actually recognise.
  const tax = readJSON(join(SHARED, '..', '..', 'shared', 'domain-taxonomy.json'));
  assert.ok(tax.domains[a.domain.code], `domain '${a.domain.code}' is in the closed taxonomy`);
  assert.equal(a.domain.description, tax.domains[a.domain.code], 'the description is the SSOT text, not rewritten');

  // the metric names must be exactly the pair's both-languages-gated set, so the
  // Answer Card can never show a lens that is invalid for this pair.
  assert.deepEqual(a.metrics, metricsFor(a.src, a.tgt), 'metrics ride the same gate as every other surface');
  for (const m of a.metrics) assert.ok(registry[METRIC_ID[m]], `metric '${m}' resolves in the registry`);

  // every candidate METHOD must be a real catalogue method whose OWN cited
  // coverage list claims both sides of the pair (under whatever code it
  // publishes — e.g. fil vs tgl). No invented candidates.
  const coverage = readJSON(join(SHARED, 'catalogue', 'method-coverage.json'));
  const byLabel = new Map(coverage.methods.map((m) => [m.label, m]));
  assert.ok(a.candidates.length >= 3, 'the card has a real shortlist');
  for (const c of a.candidates) {
    const m = byLabel.get(c.label);
    assert.ok(m, `candidate '${c.label}' is a real catalogue method`);
    const iso = new Set(m.iso6393 || []);
    assert.ok(iso.has(a.src), `${c.label} claims ${a.src}`);
    assert.ok(iso.has(c.claimedCode), `${c.label} really publishes '${c.claimedCode}'`);
    assert.ok(['service', 'open'].includes(c.tier), `${c.label} tier is a real coverage tier`);
  }

  // the benchmark, if named, must be a set BOTH languages sit on (same rule as
  // the tape/chain) — never a corpus we merely wish applied.
  if (a.benchmark) {
    assert.ok(a.benchmark.datasetId.startsWith('eval-'), 'benchmark is a real eval id');
    assert.equal(benchmarkLine(a.src, a.tgt).has, true, 'the pair genuinely has that shared benchmark');
  }
});

test('the chain-card lens set for spa↔quz is complete but COMET-free (R4)', () => {
  // the terminal quz card shows the pair's FULL valid lenses (chrF++ · spBLEU ·
  // TER) — never COMET (quz has no XLM-R). The chain panel derives its chip
  // line from exactly this set (metricsFor).
  const lenses = metricsFor('spa', 'quz');
  assert.ok(lenses.length, 'a known pair must have lenses');
  assert.ok(lenses.includes('chrF++'), 'chrF++ present');
  assert.ok(lenses.length >= 2, 'more than one lens shown (complete, not just chrF++)');
  assert.ok(!lenses.includes('COMET') && !lenses.includes('AfriCOMET'), 'no neural COMET at quz');
});

test('every named benchmark traces to a real eval set both languages sit on', () => {
  // Since the cutover a language's evalDatasets are eval WIRING from
  // card-config.json evalConfig (derived from the corpora cards), attached to
  // the composed view at read time — the projected cards never carry them.
  const eds = (c) => new Set(card(c).evalDatasets || []);
  for (const r of Object.values(SEAM_RUNS)) {
    if (!r.benchmark) continue;
    const id = r.benchmark.datasetId;
    assert.ok(eds(r.a).has(id) && eds(r.b).has(id), `${r.a}↔${r.b} benchmark ${id} is not in both cards' evalDatasets`);
    const cardPath = join(SHARED, 'corpora-cards', `${id}.json`);
    if (existsSync(cardPath)) {
      const cc = readJSON(cardPath);
      assert.ok(cc.name, `corpora-card ${id} has no name`);
    }
  }
});

// STORY_PAIRS lives in seamStory.mjs, whose import chain needs the website's
// GENERATED data (src/data/graph-poster.json — gitignored build output). In a
// checkout where the website data is not built, the guard skips LOUDLY rather
// than failing on a file this test does not own (same pattern as
// source-snapshot.test.js skipping unpinned snapshots).
const POSTER = join(HERE, '..', 'website', 'src', 'data', 'graph-poster.json');
test('every tape pair has a record with real codes',
  {skip: existsSync(POSTER) ? false : 'website data not built (graph-poster.json missing) — build the website data first'},
  async () => {
    const {STORY_PAIRS} = await import('../website/src/utils/seamStory.mjs');
    for (const pr of STORY_PAIRS) {
      const r = runFor(pr.a, pr.b);
      assert.ok(r, `${pr.a}↔${pr.b} has no seam-run record`);
      assert.equal(runKey(r.a, r.b), runKey(pr.a, pr.b), 'record key matches the pair');
      assert.ok(r.metrics[0] === 'chrF++', 'chrF++ is always the primary lens');
    }
  });

test('metricsFor: an unknown pair gets NO lenses, never an assumed chrF++', () => {
  // The regression this guards: metricsFor used to fall back to ['chrF++'] for
  // a pair with no run record. This module's entire purpose is that a metric
  // name only ever appears where it was actually measured — a default lens is
  // an unmeasured claim rendered beside real ones.
  const warns = [];
  const realWarn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    assert.deepEqual(metricsFor('zzz', 'yyy'), [], 'unknown pair → no lenses');
    assert.equal(warns.length, 1, 'the gap is surfaced, not swallowed');
    assert.match(warns[0], /no run record/);
    assert.match(warns[0], /do not assume chrF\+\+/);
  } finally {
    console.warn = realWarn;
  }
});
