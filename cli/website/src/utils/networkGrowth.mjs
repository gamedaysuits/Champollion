/**
 * networkGrowth — pure, framework-free time-slicing for the /growth page
 * ("how people are building the network").
 * ──────────────────────────────────────────────────────────────────────────
 * No React / CSS imports so it is unit-testable with `node --test`
 * (src/utils/networkGrowth.test.mjs).
 *
 * Two ledgers, two sources, one honesty rule (real data only, zeros stay
 * zeros):
 *
 *   1. THE STRENGTH TIMELINE — from mesh.json. Every edge carries its
 *      time-ordered run history (`runs[] = [[submitted_at, chrF++ 0–100]]`,
 *      stamped by arena/scripts/generate_sweep_queue.py). Replaying those
 *      events gives, at every moment, each measured pair's best-so-far score
 *      — the same "time-sliced edges carrying bestNow" the retired /mesh
 *      scrubber used — which cchrF++-corrects and bins EXACTLY like the
 *      homepage arc layer (arcStrength.mjs), so the growth chart and the map
 *      can never disagree about a pair's band.
 *
 *   2. THE CONTRIBUTOR LEDGER — from the public run_cards board (submitter +
 *      submitted_at; the same columns the leaderboard already displays as
 *      "Author"). Cumulative distinct contributors over time plus per-person
 *      run totals. Attribution is verbatim: never invented, never dropped —
 *      a row with no usable submitter is folded into "(unattributed)".
 *
 * Banding rules inherited from arcStrength (one meaning per channel):
 *   • A pair rides the 5-band cchrF++ ramp ONLY when both sides have a
 *     measured chance floor; otherwise it counts in the neutral
 *     "floor unknown" series — never on the ramp.
 *   • Pairs under the leaderboard significance floor (n < SIGNIFICANCE_N)
 *     are additionally counted as `provisional` so the page can say how many
 *     of the measured pairs the board still treats as noise-level.
 */

import {
  SIGNIFICANCE_N,
  pairFloor,
  cchrf,
  strengthBin,
} from './arcStrength.mjs';
import { pairKey } from './meshChains.js';

export const BAND_COUNT = 5;

/**
 * Flatten mesh.json into a time-sorted list of run events.
 * Tolerates a stub/absent mesh and skips malformed rows (bad timestamps,
 * non-numeric scores) — a corrupt run must never fabricate a point.
 * @returns {Array<{t:number, iso:string, a:string, b:string, size:number, chrf:number}>}
 */
export function parseRunEvents(mesh) {
  const events = [];
  if (!mesh || !Array.isArray(mesh.edges)) return events;
  for (const e of mesh.edges) {
    if (!e || typeof e.a !== 'string' || typeof e.b !== 'string') continue;
    if (!Array.isArray(e.runs)) continue;
    const size = typeof e.size === 'number' && Number.isFinite(e.size) ? e.size : 0;
    for (const run of e.runs) {
      if (!Array.isArray(run) || run.length < 2) continue;
      const [iso, chrf] = run;
      const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
      if (!Number.isFinite(t)) continue;
      if (typeof chrf !== 'number' || !Number.isFinite(chrf)) continue;
      events.push({ t, iso, a: e.a, b: e.b, size, chrf });
    }
  }
  // Deterministic order: time, then pair key (stable across reloads even
  // when several runs share a timestamp).
  events.sort((x, y) => x.t - y.t || (pairKey(x.a, x.b) < pairKey(y.a, y.b) ? -1 : 1));
  return events;
}

/** One timeline snapshot: pair counts by band at a moment.\n *  (`best` maps pairKey -> {a, b, chrf}; the NUL-joined key is never parsed back.) */
function snapshot(t, best, sizes, floors, runs) {
  const bands = new Array(BAND_COUNT).fill(0);
  let uncorrected = 0;
  let provisional = 0;
  for (const [key, { a, b, chrf }] of best) {
    const floor = pairFloor(floors, a, b);
    const c = floor == null ? null : cchrf(chrf, floor);
    if (c == null) uncorrected += 1;
    else bands[strengthBin(c)] += 1;
    if (!(sizes.get(key) >= SIGNIFICANCE_N)) provisional += 1;
  }
  return { t, runs, pairs: best.size, bands, uncorrected, provisional };
}


/**
 * Replay the mesh's run history into a growth timeline.
 *
 * One point per distinct event timestamp (ties are merged), each carrying:
 *   t            — event time (ms since epoch)
 *   runs         — cumulative run count
 *   pairs        — cumulative distinct measured pairs (monotone)
 *   bands[5]     — measured pairs per cchrF++ band, by best-so-far score
 *   uncorrected  — measured pairs whose chance floor is unknown (off-ramp)
 *   provisional  — measured pairs under the n<100 significance floor
 *
 * A pair can MOVE between bands as better runs land (bestNow semantics); the
 * stack total always equals `pairs`.
 *
 * @param {object} mesh    parsed mesh.json (may be a stub)
 * @param {Record<string,number>} floors  iso3 → chance floor (0–100)
 */
export function growthTimeline(mesh, floors) {
  const events = parseRunEvents(mesh);
  if (!events.length) {
    return { empty: true, points: [], totalRuns: 0, totalPairs: 0, t0: null, t1: null };
  }
  const best = new Map(); // pairKey → {a, b, chrf: best chrF++ so far}
  const sizes = new Map(); // pairKey → eval-set size (significance)
  const points = [];
  let runs = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    runs += 1;
    const key = pairKey(ev.a, ev.b);
    const prev = best.get(key);
    if (prev === undefined || ev.chrf > prev.chrf) {
      best.set(key, { a: ev.a, b: ev.b, chrf: ev.chrf });
    }
    if (!(sizes.get(key) >= ev.size)) sizes.set(key, ev.size);
    // Merge simultaneous events into one point.
    if (i + 1 < events.length && events[i + 1].t === ev.t) continue;
    points.push(snapshot(ev.t, best, sizes, floors, runs));
  }
  const last = points[points.length - 1];
  return {
    empty: false,
    points,
    totalRuns: runs,
    totalPairs: last.pairs,
    t0: points[0].t,
    t1: last.t,
  };
}

/**
 * Fold public run_cards rows ({submitter, submitted_at}) into the
 * contributor ledger:
 *   points        — cumulative step series [{t, contributors, runs}]
 *                   (one per distinct timestamp, ties merged)
 *   contributors  — [{name, runs, firstAt, lastAt}] sorted by runs desc,
 *                   then by first appearance (earlier contributor wins ties)
 * Rows without a parseable submitted_at are skipped (they cannot be placed
 * in time); a blank submitter is kept, attributed to "(unattributed)".
 */
export function contributorLedger(rows) {
  const clean = [];
  for (const r of rows || []) {
    if (!r) continue;
    const t = typeof r.submitted_at === 'string' ? Date.parse(r.submitted_at) : NaN;
    if (!Number.isFinite(t)) continue;
    const name =
      typeof r.submitter === 'string' && r.submitter.trim()
        ? r.submitter.trim()
        : '(unattributed)';
    clean.push({ t, name });
  }
  if (!clean.length) {
    return { empty: true, points: [], contributors: [], totalRuns: 0 };
  }
  clean.sort((a, b) => a.t - b.t || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const byName = new Map();
  const points = [];
  let runs = 0;
  for (let i = 0; i < clean.length; i++) {
    const { t, name } = clean[i];
    runs += 1;
    let c = byName.get(name);
    if (!c) {
      c = { name, runs: 0, firstAt: t, lastAt: t };
      byName.set(name, c);
    }
    c.runs += 1;
    c.lastAt = t;
    if (i + 1 < clean.length && clean[i + 1].t === t) continue;
    points.push({ t, contributors: byName.size, runs });
  }
  const contributors = [...byName.values()].sort(
    (a, b) => b.runs - a.runs || a.firstAt - b.firstAt,
  );
  return { empty: false, points, contributors, totalRuns: runs };
}

/* ── Axis helpers (pure, deterministic — UTC everywhere) ─────────────── */

/**
 * Integer y-axis ticks from 0 to a "nice" ceiling ≥ max, using a
 * 1/2/5×10^k step aimed at ~`target` divisions. Counts are integers, so the
 * step never drops below 1.
 */
export function countTicks(max, target = 4) {
  const m = Number.isFinite(max) && max > 0 ? max : 1;
  const raw = m / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  let step = pow;
  for (const mult of [1, 2, 5, 10]) {
    if (pow * mult >= raw) {
      step = pow * mult;
      break;
    }
  }
  step = Math.max(1, Math.round(step));
  const top = Math.ceil(m / step) * step;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

/** Evenly spaced time ticks across [t0, t1] (domain ends included). */
export function timeTicks(t0, t1, count = 5) {
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return [t0].filter(Number.isFinite);
  const n = Math.max(2, count);
  const ticks = [];
  for (let i = 0; i < n; i++) ticks.push(t0 + ((t1 - t0) * i) / (n - 1));
  return ticks;
}

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Format a time tick for its span: hours within ~2 days, "Jun 12" within
 * ~10 months, "Jun 2026" beyond. UTC, en-US — deterministic in tests.
 */
export function formatTimeTick(t, spanMs) {
  const d = new Date(t);
  if (spanMs <= 2 * MS_DAY) {
    return d.toLocaleString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      hour12: false,
    });
  }
  if (spanMs <= 300 * MS_DAY) {
    return d.toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  }
  return d.toLocaleString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' });
}

/** Full date for tooltips and the table view (UTC, unambiguous). */
export function formatDate(t) {
  return new Date(t).toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
