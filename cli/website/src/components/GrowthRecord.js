/**
 * GrowthRecord — "how people are building the network": the time series of
 * the public board, drawn from REAL data only.
 *
 * Two sources, both already public:
 *   • /mesh.json — the served network artifact; every edge carries its
 *     time-ordered run history (runs[] = [[submitted_at, chrF++]]). Replayed
 *     into a stacked step-area of measured pairs, colored by the SAME five
 *     cchrF++ bands as the homepage arc layer (arcStrength.mjs) — one visual
 *     system, one meaning per channel.
 *   • run_cards (Supabase, public anon read — same query family as
 *     ZipperSeam/leaderboard) — submitter + submitted_at for the contributor
 *     ledger. Attribution is verbatim, exactly what the leaderboard's
 *     "Author" column already shows.
 *
 * Honesty rails:
 *   • Empty board → the honest empty state ("the record starts with the
 *     first run"), never a fabricated curve.
 *   • A source that cannot be reached says so — it is NOT presented as zero.
 *   • Every charted value is also readable without the tooltip: the
 *     legend + the "as a table" views carry the full record (the two darkest
 *     ramp steps sit under 3:1 against the ink surface, so color is never
 *     the only channel).
 *
 * All time-slicing/binning is pure and unit-tested (utils/networkGrowth.mjs).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import ProvenanceTip from './ProvenanceTip';
import FLOORS from '../data/cchrf-floors.json';
import {
  BIN_COLORS,
  BIN_LABELS,
  UNCORRECTED_COLOR,
  SIGNIFICANCE_N,
} from '../utils/arcStrength.mjs';
import {
  growthTimeline,
  contributorLedger,
  countTicks,
  timeTicks,
  formatTimeTick,
  formatDate,
  BAND_COUNT,
} from '../utils/networkGrowth.mjs';
import styles from './GrowthRecord.module.css';

// Public read-only anon key (same as ZipperSeam / GraphHero / leaderboard) —
// RLS-gated.
const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

/** Page size for the run_cards read; PostgREST caps responses anyway. */
const PAGE = 1000;
/** Hard cap so a runaway board can never wedge the page (25k runs). */
const MAX_PAGES = 25;

/**
 * Read the full public ledger (submitter + submitted_at), paginated.
 * Returns rows, or throws — the caller renders "unreachable" honestly
 * instead of an invented zero.
 */
async function fetchRunRows() {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/run_cards?select=submitter,submitted_at` +
        `&trust=neq.disqualified&order=submitted_at.asc` +
        `&limit=${PAGE}&offset=${page * PAGE}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );
    if (!resp.ok) throw new Error(`run_cards HTTP ${resp.status}`);
    const batch = await resp.json();
    if (!Array.isArray(batch)) throw new Error('run_cards: unexpected payload');
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
  // Never truncate silently: past the cap we cannot claim a complete ledger.
  console.warn(`growth: run_cards read stopped at the ${MAX_PAGES * PAGE}-row cap; ledger may be incomplete`);
  return rows;
}

/* ── Shared chart scaffolding ─────────────────────────────────────────── */

const W = 920;
const PAD = { top: 14, right: 18, bottom: 30, left: 44 };

function useScales({ t0, t1, yMax, height }) {
  return useMemo(() => {
    const span = Math.max(1, t1 - t0);
    const innerW = W - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const yTicks = countTicks(yMax);
    const yTop = yTicks[yTicks.length - 1];
    const x = (t) => PAD.left + ((t - t0) / span) * innerW;
    const y = (v) => PAD.top + innerH - (v / yTop) * innerH;
    return { x, y, yTicks, yTop, innerH, span };
  }, [t0, t1, yMax, height]);
}

/** Step-after path for one stacked layer between two cumulative levels. */
function layerPath(points, lows, highs, x, y, xEnd) {
  const n = points.length;
  let d = `M${x(points[0].t)},${y(highs[0])}`;
  for (let k = 1; k < n; k++) {
    d += `H${x(points[k].t)}V${y(highs[k])}`;
  }
  d += `H${xEnd}`;
  d += `V${y(lows[n - 1])}`;
  for (let k = n - 1; k >= 1; k--) {
    d += `H${x(points[k].t)}V${y(lows[k - 1])}`;
  }
  d += `H${x(points[0].t)}Z`;
  return d;
}

/** Step-after polyline for a single cumulative series. */
function stepLinePath(points, valueOf, x, y, xEnd) {
  let d = `M${x(points[0].t)},${y(valueOf(points[0]))}`;
  for (let k = 1; k < points.length; k++) {
    d += `H${x(points[k].t)}V${y(valueOf(points[k]))}`;
  }
  d += `H${xEnd}`;
  return d;
}

/** Index of the step active at time t (last point with point.t <= t). */
function activeIndex(points, t) {
  let lo = 0;
  let hi = points.length - 1;
  if (t < points[0].t) return 0;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Axes + gridlines shared by both charts (hairline, solid, recessive). */
function ChartFrame({ scales, t0, t1, height, children }) {
  const ticks = timeTicks(t0, t1, 5);
  const span = t1 - t0;
  return (
    <>
      {scales.yTicks.map((v) => (
        <g key={`y${v}`}>
          <line
            className={styles.gridline}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={scales.y(v)}
            y2={scales.y(v)}
          />
          <text className={styles.axisText} x={PAD.left - 8} y={scales.y(v) + 3.5} textAnchor="end">
            {v.toLocaleString('en-US')}
          </text>
        </g>
      ))}
      {children}
      {ticks.map((t, i) => (
        <text
          key={`x${i}`}
          className={styles.axisText}
          x={scales.x(t)}
          y={height - PAD.bottom + 18}
          textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
        >
          {formatTimeTick(t, span)}
        </text>
      ))}
    </>
  );
}

/* ── Chart A: measured pairs by strength band ─────────────────────────── */

/** Stack order, bottom→top: bands 0–4 (dark→bright), then floor-unknown. */
function stackLevels(point) {
  const levels = [0];
  let acc = 0;
  for (let b = 0; b < BAND_COUNT; b++) {
    acc += point.bands[b];
    levels.push(acc);
  }
  levels.push(acc + point.uncorrected);
  return levels;
}

function StrengthStack({ timeline, now }) {
  const HEIGHT = 340;
  const [active, setActive] = useState(null); // point index or null
  const { points } = timeline;
  const t0 = timeline.t0;
  const t1 = Math.max(timeline.t1, now);
  const scales = useScales({ t0, t1, yMax: timeline.totalPairs, height: HEIGHT });
  const xEnd = W - PAD.right;

  const levels = useMemo(() => points.map(stackLevels), [points]);
  const anyUncorrected = points.some((p) => p.uncorrected > 0);

  const layers = [];
  for (let b = 0; b < BAND_COUNT; b++) {
    if (!points.some((p) => p.bands[b] > 0)) continue; // layer never occupied
    layers.push({
      key: `band${b}`,
      color: BIN_COLORS[b],
      label: BIN_LABELS[b],
      d: layerPath(points, levels.map((l) => l[b]), levels.map((l) => l[b + 1]), scales.x, scales.y, xEnd),
    });
  }
  if (anyUncorrected) {
    layers.push({
      key: 'uncorrected',
      color: UNCORRECTED_COLOR,
      label: 'floor unknown',
      d: layerPath(
        points,
        levels.map((l) => l[BAND_COUNT]),
        levels.map((l) => l[BAND_COUNT + 1]),
        scales.x,
        scales.y,
        xEnd,
      ),
    });
  }

  const onMove = useCallback(
    (evt) => {
      const svg = evt.currentTarget;
      const rect = svg.getBoundingClientRect();
      const mx = ((evt.clientX - rect.left) / rect.width) * W;
      const t = t0 + ((mx - PAD.left) / (W - PAD.left - PAD.right)) * (t1 - t0);
      setActive(activeIndex(points, t));
    },
    [points, t0, t1],
  );
  const onKey = useCallback(
    (evt) => {
      if (evt.key === 'Escape') return setActive(null);
      if (evt.key !== 'ArrowLeft' && evt.key !== 'ArrowRight' && evt.key !== 'Home' && evt.key !== 'End') return;
      evt.preventDefault();
      setActive((cur) => {
        if (evt.key === 'Home') return 0;
        if (evt.key === 'End') return points.length - 1;
        const base = cur == null ? points.length - 1 : cur;
        return Math.min(points.length - 1, Math.max(0, base + (evt.key === 'ArrowRight' ? 1 : -1)));
      });
    },
    [points.length],
  );

  const ap = active != null ? points[active] : null;

  return (
    <figure className={styles.chartBlock}>
      <figcaption className={styles.chartTitle}>
        Measured pairs over time, by connection strength{' '}
        <a className={styles.chartTitleLink} href="/docs/network/specifications/connection-strength">
          (cchrF++)
        </a>
      </figcaption>
      <div className={styles.chartWrap}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${W} ${HEIGHT}`}
          role="img"
          aria-label={
            `Stacked step chart: ${timeline.totalPairs.toLocaleString('en-US')} measured ` +
            `language pairs accumulated over ${points.length} recorded moments, split by ` +
            `cchrF++ strength band. Full values in the table below.`
          }
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
        >
          <ChartFrame scales={scales} t0={t0} t1={t1} height={HEIGHT}>
            {layers.map((l) => (
              <path key={l.key} d={l.d} fill={l.color} fillOpacity={0.82} stroke="#06070b" strokeWidth={2} strokeLinejoin="round" />
            ))}
            {ap && (
              <line
                className={styles.crosshair}
                x1={scales.x(ap.t)}
                x2={scales.x(ap.t)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
              />
            )}
          </ChartFrame>
        </svg>
        {ap && (
          <div
            className={styles.tooltip}
            style={{ left: `${(scales.x(ap.t) / W) * 100}%` }}
            role="status"
          >
            <span className={styles.tooltipDate}>{formatDate(ap.t)}</span>
            <span className={styles.tooltipRow}>
              <b>{ap.pairs.toLocaleString('en-US')}</b> measured {ap.pairs === 1 ? 'pair' : 'pairs'} ·{' '}
              {ap.runs.toLocaleString('en-US')} {ap.runs === 1 ? 'run' : 'runs'}
            </span>
            {ap.bands.map((v, b) =>
              v > 0 ? (
                <span key={b} className={styles.tooltipRow}>
                  <i className={styles.swatch} style={{ background: BIN_COLORS[b] }} />
                  {BIN_LABELS[b]}: {v.toLocaleString('en-US')}
                </span>
              ) : null,
            )}
            {ap.uncorrected > 0 && (
              <span className={styles.tooltipRow}>
                <i className={styles.swatch} style={{ background: UNCORRECTED_COLOR }} />
                floor unknown: {ap.uncorrected.toLocaleString('en-US')}
              </span>
            )}
            {ap.provisional > 0 && (
              <span className={styles.tooltipNote}>
                {ap.provisional.toLocaleString('en-US')} under the n&nbsp;&lt;&nbsp;{SIGNIFICANCE_N} significance floor
              </span>
            )}
          </div>
        )}
      </div>
      <div className={styles.legendRow} role="group" aria-label="Strength band legend">
        {BIN_LABELS.map((label, b) => (
          <span key={label} className={styles.legendItem}>
            <i className={styles.swatch} style={{ background: BIN_COLORS[b] }} />
            {label}
          </span>
        ))}
        {anyUncorrected && (
          <span className={styles.legendItem}>
            <i className={styles.swatch} style={{ background: UNCORRECTED_COLOR }} />
            floor unknown
          </span>
        )}
        <span className={styles.legendNote}>
          a pair moves up as better runs land — each counts once, at its best score so far
        </span>
      </div>
      <details className={styles.tableView}>
        <summary>The record as a table</summary>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>Runs</th>
                <th>Pairs</th>
                {BIN_LABELS.map((l) => (
                  <th key={l}>{l}</th>
                ))}
                <th>floor unknown</th>
                <th>n&nbsp;&lt;&nbsp;{SIGNIFICANCE_N}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.t}>
                  <td>{formatDate(p.t)}</td>
                  <td>{p.runs.toLocaleString('en-US')}</td>
                  <td>{p.pairs.toLocaleString('en-US')}</td>
                  {p.bands.map((v, b) => (
                    <td key={b}>{v.toLocaleString('en-US')}</td>
                  ))}
                  <td>{p.uncorrected.toLocaleString('en-US')}</td>
                  <td>{p.provisional.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/* ── Chart B: the contributor ledger ──────────────────────────────────── */

/** Top-list length before folding into "+ N more". */
const TOP_CONTRIBUTORS = 8;

function ContributorPanel({ ledger, now }) {
  const HEIGHT = 220;
  const [active, setActive] = useState(null);
  const { points, contributors } = ledger;
  const t0 = points[0].t;
  const t1 = Math.max(points[points.length - 1].t, now);
  const total = points[points.length - 1].contributors;
  const scales = useScales({ t0, t1, yMax: total, height: HEIGHT });
  const xEnd = W - PAD.right;

  const linePath = useMemo(
    () => stepLinePath(points, (p) => p.contributors, scales.x, scales.y, xEnd),
    [points, scales, xEnd],
  );

  const onMove = useCallback(
    (evt) => {
      const rect = evt.currentTarget.getBoundingClientRect();
      const mx = ((evt.clientX - rect.left) / rect.width) * W;
      const t = t0 + ((mx - PAD.left) / (W - PAD.left - PAD.right)) * (t1 - t0);
      setActive(activeIndex(points, t));
    },
    [points, t0, t1],
  );

  const ap = active != null ? points[active] : null;
  const top = contributors.slice(0, TOP_CONTRIBUTORS);
  const folded = contributors.length - top.length;
  const maxRuns = top.length ? top[0].runs : 1;

  return (
    <div className={styles.contribGrid}>
      <figure className={styles.chartBlock}>
        <figcaption className={styles.chartTitle}>Contributors over time</figcaption>
        <div className={styles.chartWrap}>
          <svg
            className={styles.chart}
            viewBox={`0 0 ${W} ${HEIGHT}`}
            role="img"
            aria-label={
              `Step line: cumulative distinct contributors on the public board, ` +
              `${total.toLocaleString('en-US')} so far. Per-person totals listed beside the chart.`
            }
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
          >
            <ChartFrame scales={scales} t0={t0} t1={t1} height={HEIGHT}>
              <path className={styles.stepLine} d={linePath} />
              <circle
                className={styles.endDot}
                cx={xEnd}
                cy={scales.y(total)}
                r={4}
              />
              <text className={styles.endLabel} x={xEnd - 8} y={scales.y(total) - 8} textAnchor="end">
                {total.toLocaleString('en-US')}
              </text>
              {ap && (
                <line
                  className={styles.crosshair}
                  x1={scales.x(ap.t)}
                  x2={scales.x(ap.t)}
                  y1={PAD.top}
                  y2={HEIGHT - PAD.bottom}
                />
              )}
            </ChartFrame>
          </svg>
          {ap && (
            <div className={styles.tooltip} style={{ left: `${(scales.x(ap.t) / W) * 100}%` }} role="status">
              <span className={styles.tooltipDate}>{formatDate(ap.t)}</span>
              <span className={styles.tooltipRow}>
                <b>{ap.contributors.toLocaleString('en-US')}</b>{' '}
                {ap.contributors === 1 ? 'contributor' : 'contributors'} ·{' '}
                {ap.runs.toLocaleString('en-US')} {ap.runs === 1 ? 'run' : 'runs'}
              </span>
            </div>
          )}
        </div>
      </figure>
      <div className={styles.topList}>
        <p className={styles.chartTitle}>
          Runs by contributor
          <ProvenanceTip source="run_cards.submitter on the public board — the same attribution the leaderboard shows as Author. Verbatim; disqualified runs excluded." />
        </p>
        <ol className={styles.contribRows}>
          {top.map((c) => (
            <li key={c.name} className={styles.contribRow}>
              <span className={styles.contribName} title={`first run ${formatDate(c.firstAt)} · latest ${formatDate(c.lastAt)}`}>
                {c.name}
              </span>
              <span className={styles.contribBarTrack}>
                <span
                  className={styles.contribBar}
                  style={{ width: `${Math.max(2, (c.runs / maxRuns) * 100)}%` }}
                />
              </span>
              <span className={styles.contribCount}>{c.runs.toLocaleString('en-US')}</span>
            </li>
          ))}
        </ol>
        {folded > 0 && (
          <p className={styles.legendNote}>
            + {folded.toLocaleString('en-US')} more {folded === 1 ? 'contributor' : 'contributors'} — full
            attribution on the <Link to="/leaderboard">leaderboard</Link>
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Empty / unavailable states ───────────────────────────────────────── */

function EmptyRecord() {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyLead}>The record starts with the first run.</p>
      <p className={styles.emptyBody}>
        No benchmark runs have been published yet — so there is no curve to
        show, and we won&rsquo;t draw one. When the first verified run lands on
        the public board, this page becomes the network&rsquo;s time series:
        measured pairs accumulating run by run, colored by strength, with
        every contributor credited by name.
      </p>
      <div className={styles.emptyCtas}>
        <Link className={styles.emptyCta} to="/contribute">
          Run the first benchmark →
        </Link>
        <Link className={styles.emptyCtaGhost} to="/leaderboard">
          Watch the board →
        </Link>
      </div>
    </div>
  );
}

/* ── The section ──────────────────────────────────────────────────────── */

export default function GrowthRecord() {
  // null = loading · 'error' = source unreachable (NOT the same as empty).
  const [timeline, setTimeline] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setNow(Date.now());
    fetch('/mesh.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`mesh HTTP ${r.status}`))))
      .then((mesh) => {
        if (!cancelled) setTimeline(growthTimeline(mesh, FLOORS.floors));
      })
      .catch(() => {
        if (!cancelled) setTimeline('error');
      });
    fetchRunRows()
      .then((rows) => {
        if (!cancelled) setLedger(contributorLedger(rows));
      })
      .catch(() => {
        if (!cancelled) setLedger('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = timeline === null || ledger === null;
  const meshError = timeline === 'error';
  const boardError = ledger === 'error';
  const meshEmpty = !meshError && timeline !== null && timeline.empty;
  const boardEmpty = !boardError && ledger !== null && ledger.empty;
  // The honest big empty state: both sources answered and both are empty.
  const bothEmpty = meshEmpty && boardEmpty;
  const hasAnyData = (!meshError && !meshEmpty && timeline !== null) ||
    (!boardError && !boardEmpty && ledger !== null);

  return (
    <section className={clsx('labV4', styles.record)}>
      <div className={clsx('container', styles.inner)}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>THE BUILD RECORD</p>
          <h1 className={styles.title}>How people are building the network</h1>
          <p className={styles.sub}>
            Every benchmark run that lands on the public board is recorded —
            timestamped, attributed, and scored. This page replays that record:
            measured pairs accumulating over time, colored by the same five{' '}
            <a href="/docs/network/specifications/connection-strength">
              connection-strength bands (cchrF++)
            </a>{' '}
            as the map, and the people who put them there.
            <ProvenanceTip
              source={
                'Sources: the served network artifact (/mesh.json — per-edge run history ' +
                'stamped by the queue generator) and the public run_cards board (Supabase, ' +
                'read-only anon; disqualified runs excluded). Zeros are real zeros; an ' +
                'unreachable source is reported as unreachable, never as zero.'
              }
            />
          </p>
        </header>

        {loading && <p className={styles.loading}>Reading the record…</p>}

        {!loading && bothEmpty && <EmptyRecord />}

        {!loading && !bothEmpty && (
          <>
            {hasAnyData && (
              <dl className={styles.statRow}>
                <div className={styles.stat}>
                  <dt>measured pairs</dt>
                  <dd>
                    {meshError ? '—' : (timeline.totalPairs || 0).toLocaleString('en-US')}
                  </dd>
                </div>
                <div className={styles.stat}>
                  {/* Prefer whichever source actually has runs: the live board
                      when it answered with rows, else the mesh's own run
                      history (the two can briefly diverge between mesh
                      regenerations — never show a zero beside a drawn curve). */}
                  <dt>runs recorded</dt>
                  <dd>
                    {!boardError && !boardEmpty
                      ? ledger.totalRuns.toLocaleString('en-US')
                      : !meshError && !meshEmpty
                        ? timeline.totalRuns.toLocaleString('en-US')
                        : '—'}
                  </dd>
                </div>
                <div className={styles.stat}>
                  <dt>contributors</dt>
                  <dd>{boardError ? '—' : ledger.contributors.length.toLocaleString('en-US')}</dd>
                </div>
              </dl>
            )}

            {meshError && (
              <p className={styles.sourceNote}>
                The network artifact (/mesh.json) could not be reached — the
                strength timeline is unavailable right now, not empty.
              </p>
            )}
            {meshEmpty && !meshError && (
              <p className={styles.sourceNote}>
                The network artifact has no recorded runs yet — the strength
                timeline appears when the first run lands and the mesh
                regenerates.
              </p>
            )}
            {!meshError && !meshEmpty && timeline !== null && (
              <StrengthStack timeline={timeline} now={now} />
            )}

            {boardError && (
              <p className={styles.sourceNote}>
                The public board could not be reached — contributor attribution
                is unavailable right now, not empty.
              </p>
            )}
            {boardEmpty && !boardError && (
              <p className={styles.sourceNote}>
                No attributed runs on the public board yet — the first
                contributor starts the ledger.
              </p>
            )}
            {!boardError && !boardEmpty && ledger !== null && (
              <ContributorPanel ledger={ledger} now={now} />
            )}
          </>
        )}
      </div>
    </section>
  );
}
