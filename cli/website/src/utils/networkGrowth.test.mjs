/**
 * networkGrowth unit tests — the pure time-slicing/binning the /growth page
 * draws from. Run: node --test src/utils/networkGrowth.test.mjs
 *
 * The mesh fixture mirrors the real artifact shape (generate_sweep_queue.py):
 * edges carry time-ordered runs[] = [[submitted_at ISO, chrF++ 0–100], …].
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRunEvents,
  growthTimeline,
  contributorLedger,
  countTicks,
  timeTicks,
  formatTimeTick,
  formatDate,
  BAND_COUNT,
} from './networkGrowth.mjs';
import { SIGNIFICANCE_N, BIN_LABELS } from './arcStrength.mjs';

/** Same floor fixture family as arcStrength.test.mjs (crk has NO floor). */
const FLOORS = { eng: 11.964, fra: 12.587, fao: 11.384, zho: 1.648 };

const T1 = '2026-06-12T10:00:00+00:00';
const T2 = '2026-06-20T09:30:00+00:00';
const T3 = '2026-07-01T18:00:00+00:00';
const T4 = '2026-07-10T08:00:00+00:00';

/**
 * Fixture:
 *  eng–fra (size 500, floors known):   30 @T1 → weak; 60 @T3 → developing;
 *                                      20 @T4 (worse — must NOT demote)
 *  crk–eng (size 62, crk floor unknown): 90 @T2 → floor-unknown + provisional
 *  eng–fao (size 100, floors known):   85 @T3 → strong (ties with eng–fra @T3)
 */
const MESH = {
  nodes: [],
  edges: [
    {
      a: 'eng', b: 'fra', size: 500, status: 'measured', clean: true,
      best_chrf: 60,
      runs: [[T1, 30], [T3, 60], [T4, 20]],
    },
    {
      a: 'crk', b: 'eng', size: 62, status: 'measured', clean: false,
      best_chrf: 90,
      runs: [[T2, 90]],
    },
    {
      a: 'eng', b: 'fao', size: 100, status: 'measured', clean: true,
      best_chrf: 85,
      runs: [[T3, 85]],
    },
    // Registered-only edge: no runs — must contribute nothing.
    { a: 'deu', b: 'eng', size: 900, status: 'registered', clean: true, best_chrf: null, runs: [] },
    // Malformed rows: never fabricate an event.
    {
      a: 'zho', b: 'eng', size: 200, status: 'measured', clean: true, best_chrf: 50,
      runs: [['not-a-date', 50], [T2, 'NaN-score'], [T2], 'garbage', null],
    },
  ],
};

test('parseRunEvents: flattens, sorts, and skips malformed rows', () => {
  const events = parseRunEvents(MESH);
  assert.equal(events.length, 5); // 3 + 1 + 1; zho edge contributes none
  assert.deepEqual(events.map((e) => e.t), events.map((e) => e.t).slice().sort((a, b) => a - b));
  assert.equal(events[0].chrf, 30);
  assert.ok(events.every((e) => Number.isFinite(e.t) && Number.isFinite(e.chrf)));
});

test('parseRunEvents: stub / absent mesh yields no events', () => {
  assert.deepEqual(parseRunEvents(null), []);
  assert.deepEqual(parseRunEvents({ note: 'stub', nodes: [], edges: [] }), []);
  assert.deepEqual(parseRunEvents({ edges: 'nope' }), []);
});

test('growthTimeline: empty board is reported empty, with no fabricated points', () => {
  const tl = growthTimeline({ nodes: [], edges: [] }, FLOORS);
  assert.equal(tl.empty, true);
  assert.deepEqual(tl.points, []);
  assert.equal(tl.totalRuns, 0);
  assert.equal(tl.totalPairs, 0);
});

test('growthTimeline: replays runs into per-band pair counts (bestNow semantics)', () => {
  const tl = growthTimeline(MESH, FLOORS);
  assert.equal(tl.empty, false);
  // T3 carries two simultaneous events (eng–fra + eng–fao) merged into one
  // point; T1, T2, T4 get one each → 4 points from 5 runs.
  assert.equal(tl.points.length, 4);
  assert.equal(tl.totalRuns, 5);
  assert.equal(tl.totalPairs, 3);

  const [p1, p2, p3, p4] = tl.points;

  // T1: eng–fra @30, floor 12.587 → cchrf ≈ 0.199 → band 1 ("weak").
  assert.equal(p1.pairs, 1);
  assert.equal(p1.runs, 1);
  assert.deepEqual(p1.bands, [0, 1, 0, 0, 0]);
  assert.equal(p1.uncorrected, 0);

  // T2: crk–eng lands — crk has no floor → floor-unknown, never on the ramp.
  assert.equal(p2.pairs, 2);
  assert.equal(p2.uncorrected, 1);
  assert.deepEqual(p2.bands, [0, 1, 0, 0, 0]);

  // T3 (merged tie): eng–fra improves 30→60 (cchrf ≈ 0.542 → band 2,
  // "developing") — the pair MOVES bands; eng–fao @85 → band 4 ("strong").
  assert.equal(p3.pairs, 3);
  assert.equal(p3.runs, 4);
  assert.deepEqual(p3.bands, [0, 0, 1, 0, 1]);
  assert.equal(p3.uncorrected, 1);

  // T4: a WORSE eng–fra run (20) must not demote the pair (best-so-far).
  assert.equal(p4.runs, 5);
  assert.deepEqual(p4.bands, p3.bands);
  assert.equal(p4.pairs, 3);
});

test('growthTimeline: stack total equals measured pairs at every point', () => {
  const tl = growthTimeline(MESH, FLOORS);
  for (const p of tl.points) {
    const stacked = p.bands.reduce((s, v) => s + v, 0) + p.uncorrected;
    assert.equal(stacked, p.pairs);
    assert.equal(p.bands.length, BAND_COUNT);
  }
  assert.equal(BIN_LABELS.length, BAND_COUNT); // the chart legend contract
});

test('growthTimeline: provisional counts pairs under the significance floor', () => {
  const tl = growthTimeline(MESH, FLOORS);
  const last = tl.points[tl.points.length - 1];
  // crk–eng (size 62) is under n<100; eng–fra (500) and eng–fao (100) are not.
  assert.ok(62 < SIGNIFICANCE_N && 100 >= SIGNIFICANCE_N);
  assert.equal(last.provisional, 1);
});

test('growthTimeline: without floors nothing rides the ramp (all floor-unknown)', () => {
  const tl = growthTimeline(MESH, null);
  const last = tl.points[tl.points.length - 1];
  assert.deepEqual(last.bands, [0, 0, 0, 0, 0]);
  assert.equal(last.uncorrected, last.pairs);
});

test('contributorLedger: empty / unusable rows are reported empty', () => {
  assert.equal(contributorLedger([]).empty, true);
  assert.equal(contributorLedger(null).empty, true);
  assert.equal(contributorLedger([{ submitter: 'a@b.c', submitted_at: 'garbage' }]).empty, true);
});

test('contributorLedger: cumulative distinct contributors + per-person totals', () => {
  const rows = [
    { submitter: 'ada@example.org', submitted_at: T2 },
    { submitter: 'ada@example.org', submitted_at: T3 },
    { submitter: 'grace@example.org', submitted_at: T3 }, // tie with ada @T3
    { submitter: '   ', submitted_at: T4 }, // blank → "(unattributed)"
    { submitter: 'ada@example.org', submitted_at: T1 },
    { submitter: 'x@y.z', submitted_at: 'not-a-date' }, // skipped
  ];
  const ledger = contributorLedger(rows);
  assert.equal(ledger.empty, false);
  assert.equal(ledger.totalRuns, 5);

  // Points: T1, T2, T3 (two rows merged), T4.
  assert.equal(ledger.points.length, 4);
  assert.deepEqual(ledger.points.map((p) => p.contributors), [1, 1, 2, 3]);
  assert.deepEqual(ledger.points.map((p) => p.runs), [1, 2, 4, 5]);

  // Totals sorted by runs desc, then first appearance.
  assert.deepEqual(
    ledger.contributors.map((c) => [c.name, c.runs]),
    [['ada@example.org', 3], ['grace@example.org', 1], ['(unattributed)', 1]],
  );
  assert.equal(ledger.contributors[0].firstAt, Date.parse(T1));
  assert.equal(ledger.contributors[0].lastAt, Date.parse(T3));
  // grace (T3) appeared before the unattributed row (T4) — tiebreak holds.
  assert.ok(ledger.contributors[1].firstAt < ledger.contributors[2].firstAt);
});

test('countTicks: clean integer steps from zero, never fractional', () => {
  assert.deepEqual(countTicks(3), [0, 1, 2, 3]);
  assert.deepEqual(countTicks(7), [0, 2, 4, 6, 8]);
  assert.deepEqual(countTicks(230), [0, 100, 200, 300]);
  assert.deepEqual(countTicks(0), [0, 1]); // an axis exists even at zero
  assert.ok(countTicks(1e6).every((v) => Number.isInteger(v)));
});

test('timeTicks: spans the domain inclusively; degenerate domains are safe', () => {
  const t0 = Date.parse(T1);
  const t1 = Date.parse(T4);
  const ticks = timeTicks(t0, t1, 5);
  assert.equal(ticks.length, 5);
  assert.equal(ticks[0], t0);
  assert.equal(ticks[4], t1);
  assert.deepEqual(timeTicks(t0, t0, 5), [t0]);
});

test('formatters: deterministic UTC output', () => {
  const t = Date.parse(T1);
  assert.equal(formatDate(t), 'Jun 12, 2026');
  const DAY = 24 * 60 * 60 * 1000;
  assert.equal(formatTimeTick(t, 30 * DAY), 'Jun 12');
  assert.equal(formatTimeTick(t, 400 * DAY), 'Jun 2026');
  assert.match(formatTimeTick(t, DAY), /Jun 12/); // hour form keeps the day
});
