/**
 * testedEdges.mjs — the /tested screen's data layer.
 *
 * THE ATOMIC UNIT IS THE SCORED EDGE, never the language. A language card
 * asserts language PROPERTIES and resource EXISTENCE; any MEASURED score of
 * method output is a RUN RESULT keyed by (method, dataset, metric) and belongs
 * on an edge. Nothing in here may ever be attached to a node.
 *
 * ONE SOURCE: the live board. `static/mesh.json` is a 2026-07-19 BUILD SNAPSHOT
 * carrying 258 measured pairs while the board carries a different set entirely;
 * colouring from the snapshot and explaining from the board would make the
 * product disagree with itself, and the archived pre-wipe runs it holds must
 * not be republished (CLAUDE.md, dataset doctrine). The snapshot is used here
 * for exactly one thing — the REGISTERED-BUT-UNRUN pairs, which are corpus
 * registrations rather than results and carry no score at all.
 */

/** A run row is publishable if the board would rank it. */
export const PUBLISHABLE_TRUST = ['unverified', 'verified'];

/** The metrics this screen can colour by; `col` is the run_cards column. */
export const METRICS = [
  {id: 'chrf', col: 'chrf_plus_plus', label: 'chrF++', hi: true, corrected: true},
  {id: 'comet', col: 'comet_score', label: 'COMET', hi: true, corrected: false},
  {id: 'composite', col: 'composite_score', label: 'composite', hi: true, corrected: false},
  {id: 'ter', col: 'ter', label: 'TER', hi: false, corrected: false},
];

export const metricById = (id) => METRICS.find((m) => m.id === id) || METRICS[0];

/** `"eng>quz"` → `['eng','quz']`; null for anything that is not a pair. */
export function splitPair(languagePair) {
  if (typeof languagePair !== 'string') return null;
  const parts = languagePair.split('>');
  if (parts.length !== 2) return null;
  const a = parts[0].trim();
  const b = parts[1].trim();
  return a && b ? [a, b] : null;
}

/** Order-free key so eng>quz and quz>eng aggregate onto ONE edge. */
export function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Fold run rows into edges.
 *
 * Every edge keeps EVERY run that produced it — the reduction below picks a
 * value to COLOUR by, it does not pick a winner. Champollion is an index: the
 * drawer shows all of them, and the chrome names the reduction as a view.
 *
 * @param {Array<object>} rows        run_cards rows
 * @param {object}   opts
 * @param {string}   opts.metric      metric id (see METRICS)
 * @param {Set<string>} [opts.quarantined]  dataset ids that may never rank
 * @returns {{edges: Array<object>, runs: number, dropped: number}}
 */
export function foldRuns(rows, {metric = 'chrf', quarantined = new Set()} = {}) {
  const m = metricById(metric);
  const byKey = new Map();
  let runs = 0;
  let dropped = 0;

  for (const row of rows || []) {
    // A quarantined dataset may never rank — the DB trigger already refuses
    // these on insert; this is defence in depth, not a second rule.
    if (row.dataset_id && quarantined.has(row.dataset_id)) {
      dropped += 1;
      continue;
    }
    if (row.trust === 'disqualified') {
      dropped += 1;
      continue;
    }
    const pair = splitPair(row.language_pair);
    if (!pair) {
      dropped += 1;
      continue;
    }
    const [a, b] = pair;
    const key = edgeKey(a, b);
    let edge = byKey.get(key);
    if (!edge) {
      edge = {
        key,
        a: a < b ? a : b,
        b: a < b ? b : a,
        status: 'measured',
        best_chrf: null,
        size: 0,
        runs: [],
        methods: new Set(),
        datasets: new Set(),
        verified: 0,
        unverified: 0,
      };
      byKey.set(key, edge);
    }
    runs += 1;
    edge.runs.push(row);
    if (row.model_slug) edge.methods.add(row.model_slug);
    if (row.dataset_id) edge.datasets.add(row.dataset_id);
    if (row.trust === 'verified') edge.verified += 1;
    else edge.unverified += 1;

    // `size` drives the significance test (arcStrength.SIGNIFICANCE_N): the
    // LARGEST corpus this pair has been measured on.
    if (typeof row.corpus_size === 'number' && row.corpus_size > edge.size) {
      edge.size = row.corpus_size;
    }

    // The coloured value. `best_chrf` is arcStyle's input name and is always
    // chrF++ — the other metrics ride `metricValue` and skip the correction.
    const v = row[m.col];
    if (typeof v === 'number') {
      const better = edge.metricValue == null || (m.hi ? v > edge.metricValue : v < edge.metricValue);
      if (better) edge.metricValue = v;
    }
    const raw = row.chrf_plus_plus;
    if (typeof raw === 'number' && (edge.best_chrf == null || raw > edge.best_chrf)) {
      edge.best_chrf = raw;
    }
  }

  const edges = [...byKey.values()].map((e) => ({
    ...e,
    methodCount: e.methods.size,
    datasetCount: e.datasets.size,
  }));
  return {edges, runs, dropped};
}

/**
 * The REGISTERED-BUT-UNRUN layer: pairs that have an eval corpus and no result.
 *
 * This is the third state of absence, and the honest one. "Untested" is not one
 * bucket: there is the world we have not touched, and there is the set already
 * standing ready with a corpus registered, which is what the queue ranks. It is
 * opt-in and default-off so the first impression stays truthful — the measured
 * set is small — while giving the absence somewhere to lead.
 *
 * These rows carry NO score by construction (`status: 'registered'`,
 * `best_chrf: null`), so nothing here can read as a result.
 */
export function readyEdges(mesh) {
  if (!mesh || !Array.isArray(mesh.edges)) return [];
  return mesh.edges
    .filter((e) => e.status === 'registered' && e.best_chrf == null && a2(e))
    .map((e) => ({key: edgeKey(e.a, e.b), a: e.a, b: e.b, size: e.size || 0}));
}
const a2 = (e) => typeof e.a === 'string' && typeof e.b === 'string' && e.a !== e.b;
