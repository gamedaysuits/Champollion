import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import GraphEngine, {graphSupported} from '../components/GraphEngine';
import FLOORS from '../data/cchrf-floors.json';
import {arcStyle, MAX_ARCS} from '../utils/arcStrength.mjs';
import {isRelativeOnlyLane} from '../utils/contaminationBadge';
import {foldRuns, readyEdges, METRICS, metricById} from '../utils/testedEdges.mjs';
import styles from './tested.module.css';

/**
 * /tested — the map of what we have ACTUALLY tested.
 *
 * The honest counterpart to the homepage scroll. The scroll is a SYSTEM
 * ILLUSTRATION: it demonstrates the mechanism, with illustrative values under a
 * standing disclosure, because you cannot explain how a system works using only
 * the handful of runs performed so far. This screen is the other half of that
 * bargain — nothing here is illustrative. Every stroke is a run on the board.
 *
 * THE ATOMIC UNIT IS THE SCORED EDGE. A language card asserts language
 * PROPERTIES and resource EXISTENCE; a measured score of method output is a RUN
 * RESULT keyed by (method, dataset, metric) and lives on an edge. So: nodes are
 * slate and carry no number, ever. Colour lives only on strokes.
 *
 * ABSENCE IS THE EXHIBIT. Most of the world is dark here and that is the point,
 * not a loading failure. It has three states, and they are different facts:
 * measured (a stroke), corpus-registered-but-unrun (an opt-in hairline, which
 * is what the queue ranks), and untouched (nothing at all).
 */

const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

/** Columns we need to render an edge and every strip inside its drawer. */
const RUN_COLS = [
  'id', 'language_pair', 'dataset_id', 'model_slug', 'method_class', 'paradigm',
  'trust', 'corpus_size', 'harness_version', 'submitted_at',
  'chrf_plus_plus', 'chrf_ci_lower', 'chrf_ci_upper',
  'comet_score', 'composite_score', 'composite_ci_lower', 'composite_ci_upper',
  'ter', 'corpus_license', 'cost_per_entry_usd',
  /* The contamination grade has no top-level column — publish.py stamps it
   * inside the run_card JSONB. Extract it with the same JSON path the
   * leaderboard uses, so the lane gate can read each row's OWN grade without
   * lazy-loading the whole card. This is the fallback that stops a corpus
   * missing from the prod datasets table from ranking as absolute quality. */
  'contamination:run_card->>contamination',
].join(',');

const TRUSTS = [
  {id: 'any', label: 'any'},
  {id: 'verified', label: 'verified'},
  {id: 'unverified', label: 'unverified'},
];

const fmt = (v, digits = 1) => (typeof v === 'number' ? v.toFixed(digits) : '—');

export default function Tested() {
  const baseRef = useRef(null);
  const fxRef = useRef(null);
  const rootRef = useRef(null);
  const engineRef = useRef(null);
  const arcsRef = useRef([]);
  const readyRef = useRef([]);

  const [metric, setMetric] = useState('chrf');
  const [trust, setTrust] = useState('any');
  const [absoluteOnly, setAbsoluteOnly] = useState(true);
  const [showReady, setShowReady] = useState(false);
  const [rows, setRows] = useState(null);
  const [quarantined, setQuarantined] = useState(() => new Set());
  const [contam, setContam] = useState(() => new Map());
  const [status, setStatus] = useState('loading'); // loading | live | unreachable
  const [selected, setSelected] = useState(null);

  /* ── the board ─────────────────────────────────────────────────────────
   * One fetch, the same PostgREST surface and anon key the leaderboard
   * already uses. No new endpoint, no new backend. */
  useEffect(() => {
    let cancelled = false;
    const q = `${SUPABASE_URL}/rest/v1/run_cards?select=${RUN_COLS}&trust=neq.disqualified&order=submitted_at.desc`;
    Promise.all([
      fetch(q, {headers: {apikey: SUPABASE_ANON_KEY}}).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      /* Contamination is NOT a column — it lives in the dataset's metadata
       * JSONB (`metadata.contamination`), the same place the leaderboard reads
       * it from. Asking for a `contamination_grade` column 400s. */
      fetch(`${SUPABASE_URL}/rest/v1/datasets?select=id,quarantined,metadata`, {
        headers: {apikey: SUPABASE_ANON_KEY},
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([runRows, dsRows]) => {
        if (cancelled) return;
        const qset = new Set();
        const cmap = new Map();
        for (const d of dsRows || []) {
          if (d.quarantined) qset.add(d.id);
          const grade = d.metadata && d.metadata.contamination;
          if (grade) cmap.set(d.id, grade);
        }
        setQuarantined(qset);
        setContam(cmap);
        setRows(runRows || []);
        setStatus('live');
      })
      .catch(() => {
        if (!cancelled) setStatus('unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Fold runs → edges. The reduction picks a value to COLOUR by; it never
   * discards a run, and the chrome names it as a view. */
  const {edges, runs} = useMemo(() => {
    if (!rows) return {edges: [], runs: 0};
    const kept = rows.filter((r) => {
      if (trust !== 'any' && r.trust !== trust) return false;
      // HIGH-contamination corpora are relative-comparison-only — they must
      // not colour an absolute-quality view.
      if (absoluteOnly && isRelativeOnlyLane(contam.get(r.dataset_id), r.contamination)) {
        return false;
      }
      return true;
    });
    return foldRuns(kept, {metric, quarantined});
  }, [rows, metric, trust, absoluteOnly, quarantined, contam]);

  const totalEdges = useMemo(
    () => (rows ? foldRuns(rows, {metric, quarantined}).edges.length : 0),
    [rows, metric, quarantined],
  );

  /* ── engine ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!graphSupported()) return undefined;
    let cancelled = false;
    let engine = null;
    Promise.all([
      fetch('/data/graph.json').then((r) => (r.ok ? r.json() : null)),
      fetch('/data/field.json').then((r) => (r.ok ? r.json() : null)),
      // The snapshot is read for ONE thing: which pairs have a registered
      // corpus and no run. Those are registrations, not results — they carry
      // no score, so nothing from it can render as a measurement.
      fetch('/mesh.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([graph, field, mesh]) => {
      if (cancelled || !graph || !field || !baseRef.current || !fxRef.current) return;
      engine = new GraphEngine({
        base: baseRef.current,
        fx: fxRef.current,
        graph,
        field,
        interactive: true,
        layout: 'geo',
        displayMode: 'mesh',
        forceDark: true,
        tokenRoot: rootRef.current || undefined,
        // Orange and amber are SCORE BANDS on this screen. The endangerment
        // ember layer paints the field those same colours for an unrelated
        // reason, so it goes off and the nodes read as land.
        emberLayer: false,
        onSelect: (info) => {
          // A node opens its LANGUAGE, never a score.
          if (info && info.code) window.location.assign(`/languages?q=${encodeURIComponent(info.code)}`);
        },
        // onArcSelect receives {idx, x, y} — the anchor, not a bare index.
        onArcSelect: (hit) => {
          const arc = hit && arcsRef.current[hit.idx];
          if (arc) setSelected(arc.key);
        },
      });
      engineRef.current = engine;
      readyRef.current = readyEdges(mesh);
      /* A DARK FIELD. Mesh mode brings the provider hub-and-spoke layer and
       * the coverage greens with it, and on this screen they are a different
       * map's argument — they swamp the handful of measured edges and invite
       * the reader to confuse "a service lists this language" with "we
       * measured it". All method layers off gives the bare field of languages
       * (the engine's documented behaviour: mask & 0 = nothing lit), so the
       * only colourful marks left are the runs. */
      engine.setActiveMethods(0);
      /* The provider hubs are labelled nodes drawn independently of the method
       * mask, so turning the layers off leaves eight captioned suns sitting on
       * the field. They belong to the coverage map, not this one. Dropping the
       * list is what removes them; nothing on this screen routes packets
       * through a hub, so nothing else reads it. */
      engine.hubs = [];
      engine.autoPackets = false;
      engine.dirty = true;
      engine.start();
      if (typeof window !== 'undefined') window.__TESTED_ENGINE = engine;
    });
    return () => {
      cancelled = true;
      if (engine) engine.destroy();
      engineRef.current = null;
      if (typeof window !== 'undefined') delete window.__TESTED_ENGINE;
    };
  }, []);

  /* Push the measured layer whenever the view changes. */
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const idxOf = (c) => (e.idxByCode.has(c) ? e.idxByCode.get(c) : null);
    const m = metricById(metric);
    const arcs = [];
    const ordered = [...edges].sort((x, y) => {
      const a = x.metricValue == null ? -Infinity : x.metricValue;
      const b = y.metricValue == null ? -Infinity : y.metricValue;
      return m.hi ? b - a : a - b;
    });
    for (const edge of ordered) {
      if (arcs.length >= MAX_ARCS) break;
      const si = idxOf(edge.a);
      const ti = idxOf(edge.b);
      if (si == null || ti == null) continue;
      // arcStyle owns the colour rules: chance-corrected cchrF++ where both
      // floors are known, `provisional` dashing below n=100, and neutral slate
      // where a floor is unknown ("measured, not comparable" — NOT "unmeasured").
      const style = arcStyle(edge, FLOORS.floors) || {
        color: '#8b95a7', alpha: 0.4, width: 1, dash: [5, 5], corrected: false, provisional: true,
      };
      arcs.push({
        si, ti, key: edge.key, a: edge.a, b: edge.b,
        aName: e.names ? e.names[si] : edge.a,
        bName: e.names ? e.names[ti] : edge.b,
        ...style,
        width: style.width + Math.min(1.2, (edge.methodCount - 1) * 0.35),
        alpha: edge.verified > 0 ? style.alpha : style.alpha * 0.62,
      });
    }
    arcsRef.current = arcs;
    e.setMeasuredArcs(arcs);
  }, [edges, metric]);

  /* The opt-in "corpus ready" layer — registrations, never results. */
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    if (!showReady) {
      e.setAmbientArcs([]);
      return;
    }
    const idxOf = (c) => (e.idxByCode.has(c) ? e.idxByCode.get(c) : null);
    const pairs = [];
    for (const r of readyRef.current) {
      const si = idxOf(r.a);
      const ti = idxOf(r.b);
      if (si == null || ti == null) continue;
      pairs.push(si, ti);
    }
    e.setAmbientArcs([{color: '#68849c', alpha: 0.14, width: 0.6, pairs, mobilePairs: 200}]);
  }, [showReady]);

  const selectedEdge = useMemo(
    () => edges.find((x) => x.key === selected) || null,
    [edges, selected],
  );
  const closeDrawer = useCallback(() => setSelected(null), []);

  const m = metricById(metric);
  const readyCount = readyRef.current.length;

  return (
    <Layout
      title="What we have tested"
      description="Every language pair Champollion has actually measured — the run, the method, the dataset and the conditions behind each score.">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className={styles.root} ref={rootRef} data-force-dark="1">
        <div className={styles.stage}>
          <canvas ref={baseRef} className={styles.canvas} />
          <canvas ref={fxRef} className={styles.canvas} />
        </div>

        {/* ── the count, and the NAMED VIEW ─────────────────────────────
            The reduction below is a view, not a verdict, and it says so on
            screen at all times. That line is not chrome. */}
        <header className={styles.kicker}>
          <div className={styles.count}>
            {status === 'loading' && 'loading measurements…'}
            {status === 'unreachable' && 'board unreachable · measured layer unavailable'}
            {status === 'live' && (
              <>
                MEASURED · <b>{edges.length}</b> {edges.length === 1 ? 'pair' : 'pairs'} ·{' '}
                <b>{runs}</b> {runs === 1 ? 'run' : 'runs'}
              </>
            )}
          </div>
          <div className={styles.view}>
            VIEW {m.label} · {trust === 'any' ? 'all trust' : trust} ·{' '}
            {absoluteOnly ? 'absolute lane' : 'all lanes'} · best under filter ·{' '}
            <span className={styles.notRanking}>not a ranking</span>
          </div>
          {status === 'live' && edges.length === 0 && totalEdges > 0 && (
            <div className={styles.empty}>
              0 pairs under this view · {totalEdges} exist outside it
            </div>
          )}
          {status === 'live' && totalEdges === 0 && (
            <div className={styles.empty}>
              the board holds no publishable run yet ·{' '}
              <Link to="/contribute">run one →</Link>
            </div>
          )}
        </header>

        {/* ── controls ─────────────────────────────────────────────────── */}
        <div className={styles.controls}>
          <div className={styles.group}>
            {METRICS.map((x) => (
              <button
                key={x.id}
                type="button"
                className={x.id === metric ? styles.chipOn : styles.chip}
                onClick={() => setMetric(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <div className={styles.group}>
            {TRUSTS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={t.id === trust ? styles.chipOn : styles.chip}
                onClick={() => setTrust(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className={styles.group}>
            <button
              type="button"
              className={absoluteOnly ? styles.chipOn : styles.chip}
              onClick={() => setAbsoluteOnly((v) => !v)}
              title="HIGH-contamination corpora are relative-comparison-only and never colour an absolute-quality view.">
              absolute lane
            </button>
            <button
              type="button"
              className={showReady ? styles.chipOn : styles.chip}
              onClick={() => setShowReady((v) => !v)}
              title="Pairs with a registered eval corpus and no run yet. A registration, not a result — these carry no score.">
              corpus ready {readyCount ? `· ${readyCount}` : ''}
            </button>
          </div>
        </div>

        {/* ── the honest-absence register ───────────────────────────────── */}
        <p className={styles.register}>
          {showReady
            ? 'hairlines are pairs with a corpus registered and no run yet — a registration, not a result'
            : 'untested pairs are not drawn · the queue ranks what to run next'}
          {' · '}
          <Link className={styles.registerLink} to="/leaderboard">
            the board →
          </Link>
        </p>

        {/* ── drawer: edge → runs → the card ────────────────────────────── */}
        {selectedEdge && (
          <aside className={styles.drawer}>
            <button type="button" className={styles.close} onClick={closeDrawer} aria-label="Close">
              ×
            </button>
            <div className={styles.drawerHead}>
              <div className={styles.pair}>
                {selectedEdge.a} ↔ {selectedEdge.b}
              </div>
              <div className={styles.drawerMeta}>
                {selectedEdge.runs.length} {selectedEdge.runs.length === 1 ? 'run' : 'runs'} ·{' '}
                {selectedEdge.methodCount} {selectedEdge.methodCount === 1 ? 'method' : 'methods'} ·{' '}
                {selectedEdge.datasetCount} {selectedEdge.datasetCount === 1 ? 'dataset' : 'datasets'}
              </div>
            </div>

            {/* Every strip carries its conditions. A number without
                (method, dataset, metric, harness, corpus size) is not a
                result — it is a rumour. */}
            {selectedEdge.runs.map((r) => (
              <div key={r.id} className={styles.strip}>
                <div className={styles.stripHead}>
                  {r.model_slug} · {r.dataset_id} · {r.corpus_license || 'license unstated'}
                </div>
                <dl className={styles.metrics}>
                  <div>
                    <dt>chrF++</dt>
                    <dd>
                      {fmt(r.chrf_plus_plus)}
                      {typeof r.chrf_ci_lower === 'number' && typeof r.chrf_ci_upper === 'number' && (
                        <span className={styles.ci}>
                          {' '}
                          [CI {fmt(r.chrf_ci_lower)} – {fmt(r.chrf_ci_upper)}]
                        </span>
                      )}
                    </dd>
                  </div>
                  {typeof r.comet_score === 'number' && (
                    <div>
                      <dt>COMET</dt>
                      <dd>{fmt(r.comet_score, 2)}</dd>
                    </div>
                  )}
                  {typeof r.ter === 'number' && (
                    <div>
                      <dt>TER</dt>
                      <dd>{fmt(r.ter)}</dd>
                    </div>
                  )}
                </dl>
                <div className={styles.conditions}>
                  n={r.corpus_size ?? '—'} · harness {r.harness_version || '—'} ·{' '}
                  {r.method_class || 'method class unstated'} ·{' '}
                  {r.paradigm || 'paradigm unstated'} · <b>{r.trust}</b>
                </div>
                <div className={styles.stripFoot}>
                  <Link to={`/leaderboard?pair=${encodeURIComponent(selectedEdge.a)}>${encodeURIComponent(selectedEdge.b)}&id=${encodeURIComponent(r.id)}`}>
                    open in the leaderboard →
                  </Link>
                </div>
              </div>
            ))}

            {overlapNote(selectedEdge) && (
              <p className={styles.overlap}>{overlapNote(selectedEdge)}</p>
            )}
          </aside>
        )}
      </div>
    </Layout>
  );
}

/**
 * Where two runs' confidence intervals overlap we say so and stop. We do not
 * declare a winner: Champollion is an index, and "the higher number won" is a
 * claim the interval does not support.
 */
function overlapNote(edge) {
  const withCi = edge.runs.filter(
    (r) => typeof r.chrf_ci_lower === 'number' && typeof r.chrf_ci_upper === 'number',
  );
  if (withCi.length < 2) return null;
  for (let i = 0; i < withCi.length; i += 1) {
    for (let j = i + 1; j < withCi.length; j += 1) {
      const A = withCi[i];
      const B = withCi[j];
      if (A.chrf_ci_lower <= B.chrf_ci_upper && B.chrf_ci_lower <= A.chrf_ci_upper) {
        return 'intervals overlap · not distinguishable at 95%';
      }
    }
  }
  return null;
}
