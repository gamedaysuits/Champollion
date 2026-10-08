/**
 * connectionQuality.mjs — Connection Quality (cq-v1), JS twin.
 *
 * SSOT: docs/CONNECTION_QUALITY_SPEC.md (internal wiki), mirrored in code
 * by arena/mt_eval_harness/connection_quality.py (the Python reference).
 * These two files are function twins — same rules, same fail-honest
 * defaults — and both READ their numeric constants from the shared SSOT
 * shared/connection-quality.json, so a value is changed in ONE place: change
 * a RULE in both twins, a NUMBER only in the JSON. The pinned worked examples
 * live in arena/tests/test_connection_quality.py and
 * src/utils/connectionQuality.test.mjs (mirrored suites, no shared
 * fixture files — the repo's twin convention).
 *
 * Pure + framework-free (node --test compatible, like meshChains.js /
 * arcStrength.mjs). No I/O, no clock reads: callers pass resolved inputs
 * (age in days, effective length, resolved metric trust).
 *
 * Two channels, one composite:
 *   q  — quality: best supported, chance-corrected score, [0, 1]
 *   r  — reliability: product of evidence discounts, [0, 1]
 *   cq = q · r — ordering/routing currency; never displayed alone.
 *
 * arcStrength.mjs remains the display-band SSOT; the band constants here come
 * from shared/connection-quality.json and are pinned equal to arcStrength's by
 * test, not imported from it (this module's only import is that JSON).
 */

// ---------------------------------------------------------------------------
// §8 Constants — read from the cross-runtime SSOT shared/connection-quality.json
// (the Python twin connection_quality.py reads the SAME file). Values live in
// ONE place so the two twins can never silently drift. connection-quality.json
// beside this file is a tracked copy sync:shared derives from the monorepo-root
// SSOT; cli/test/connection-quality-ssot.test.js asserts the copy equals the
// root AND that these exports equal it. Import attributes (`with { type: 'json' }`)
// are required by Node's ESM loader and parsed by the Docusaurus webpack/babel
// build (webpack 5 resolves the JSON natively).
// ---------------------------------------------------------------------------

import CQ from './connection-quality.json' with { type: 'json' };

export const N_FULL = CQ.N_FULL;
export const L_HEALTHY = CQ.L_HEALTHY;
export const H_NOISE = CQ.H_NOISE;
export const RUNS_FULL = CQ.RUNS_FULL;

export const SIGNIFICANCE_N = CQ.SIGNIFICANCE_N;
export const LAMBDA_JUNCTION = CQ.LAMBDA_JUNCTION;

export const BIN_EDGES = CQ.BIN_EDGES;
export const BIN_LABELS = CQ.BIN_LABELS;

export const W_CONTAM = CQ.W_CONTAM;
export const W_CONTAM_UNKNOWN = W_CONTAM.MEDIUM; // derived; never assume clean

export const W_TRUST = CQ.W_TRUST;
export const W_TRUST_UNKNOWN = W_TRUST.unverified; // derived

export const W_METRIC_UNMEASURED = CQ.W_METRIC_UNMEASURED; // labeled prior; no borrowing

export const COVER_BASE = CQ.COVER_BASE;
export const COVER_STEP = CQ.COVER_STEP;
export const COVER_DOMAIN_CAP = CQ.COVER_DOMAIN_CAP;
export const COVER_REGISTER_CAP = CQ.COVER_REGISTER_CAP;
export const COVER_MIN = CQ.COVER_MIN;
export const DOMAIN_NO_CREDIT = new Set(CQ.DOMAIN_NO_CREDIT); // label-only, never credit

export const RECENCY_FRESH_DAYS = CQ.RECENCY_FRESH_DAYS;
export const RECENCY_AGING_DAYS = CQ.RECENCY_AGING_DAYS;
export const W_RECENCY_FRESH = CQ.W_RECENCY_FRESH;
export const W_RECENCY_AGING = CQ.W_RECENCY_AGING;
export const W_RECENCY_STALE = CQ.W_RECENCY_STALE;
export const DRIFT_EXEMPT_PARADIGMS = new Set(CQ.DRIFT_EXEMPT_PARADIGMS);

export const HUMAN_N_FULL = CQ.HUMAN_N_FULL;
export const HUMAN_REVIEWERS_FULL = CQ.HUMAN_REVIEWERS_FULL;

export const FORMULA_VERSION = CQ.FORMULA_VERSION;
export const PROVENANCE = CQ.PROVENANCE;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------------------
// §6.1–§6.3 Per-run test-quality factors (ECV v3, verbatim semantics)
// ---------------------------------------------------------------------------

/** Size credit: min(1, n/N_FULL). Missing n earns nothing. */
export function fSize(n) {
  if (!isNum(n) || n <= 0) return 0.0;
  return Math.min(1.0, n / N_FULL);
}

/** Richness credit; unknown effective length falls back to 0.5. */
export function fRich(lEff) {
  if (lEff == null) return 0.5;
  if (!isNum(lEff) || lEff <= 0) return 0.0;
  return Math.min(1.0, lEff / L_HEALTHY);
}

/** Confidence credit: min(1, H_NOISE/h); missing CI proxies 50/sqrt(n). */
export function fConf(h, n = null) {
  if (h == null) {
    if (!isNum(n) || n <= 0) return 0.0;
    h = 50.0 / Math.sqrt(n);
  }
  if (h <= 0) return 0.5;
  return Math.min(1.0, H_NOISE / h);
}

/** Replication credit: min(1, runs/RUNS_FULL). */
export function fRepl(k) {
  if (!isNum(k) || k <= 0) return 0.0;
  return Math.min(1.0, k / RUNS_FULL);
}

// ---------------------------------------------------------------------------
// §5 Quality channel — chance correction
// ---------------------------------------------------------------------------

/** Chance-corrected chrF++ on [0,1]; null when unusable. Clamp-at-0 = noise rail. */
export function cchrf(rawChrf, floor) {
  if (!isNum(rawChrf) || !isNum(floor) || floor >= 100) return null;
  return clamp01((rawChrf - floor) / (100.0 - floor));
}

/**
 * Floor for a pair. Directed ('a->b' | 'b->a'): the TARGET side's floor
 * (the research-repo rule — chrF++'s reference is target-language text).
 * Undirected: the HIGHER floor, both required — conservative projection
 * (larger floor can only understate, never inflate).
 */
export function floorForPair(floors, a, b, direction = null) {
  const fa = floors && isNum(floors[a]) ? floors[a] : null;
  const fb = floors && isNum(floors[b]) ? floors[b] : null;
  if (direction === 'a->b') return fb;
  if (direction === 'b->a') return fa;
  if (fa == null || fb == null) return null;
  return Math.max(fa, fb);
}

/** Band index 0–4 for a corrected quality value. */
export function strengthBin(q) {
  let b = 0;
  for (const edge of BIN_EDGES) if (q >= edge) b += 1;
  return b;
}

// ---------------------------------------------------------------------------
// §6.4–§6.7 Portfolio factors
// ---------------------------------------------------------------------------

/** Breadth credit for the pair's evidence portfolio (spec §6.4). */
export function fCover(domains, registers) {
  const dset = new Set(
    [...(domains || [])].filter((d) => d && !DOMAIN_NO_CREDIT.has(d)),
  );
  const gset = new Set([...(registers || [])].filter(Boolean));
  const d = Math.min(dset.size, COVER_DOMAIN_CAP);
  const g = Math.max(1, Math.min(gset.size, COVER_REGISTER_CAP));
  const raw = COVER_BASE + COVER_STEP * (d - 1) + COVER_STEP * (g - 1);
  return Math.min(1.0, Math.max(COVER_MIN, raw));
}

/** Chance-corrected instrument trust: clamp01(2·PA − 1). */
export function metricTrustWeight(pairwiseAccuracy) {
  if (pairwiseAccuracy == null) return W_METRIC_UNMEASURED;
  return clamp01(2.0 * pairwiseAccuracy - 1.0);
}

/**
 * Resolve (metric, target) → {w, basis, pa} from the metric-reliability
 * artifact. Ladder mirrors the recommend tier-4 consumers: exact preferred
 * sys cells ('pair') → family roll-up ('family') → UNMEASURED (no borrowing).
 */
export function resolveMetricTrust(artifact, metric, tgt) {
  const unmeasured = { w: W_METRIC_UNMEASURED, basis: 'unmeasured', pa: null };
  if (!artifact || !metric || !tgt) return unmeasured;
  const langs = artifact.languages || {};
  let info = langs[tgt];
  let code = tgt;
  if (!info) {
    for (const [k, entry] of Object.entries(langs)) {
      if (entry && entry.iso639_3 === tgt) {
        info = entry;
        code = k;
        break;
      }
    }
  }
  if (!info) return unmeasured;
  const cells = (artifact.cells || []).filter(
    (c) => c.preferred && c.level === 'sys' && c.metric === metric
      && c.tgt === code && c.pairwise_accuracy != null,
  );
  if (cells.length) {
    const wsum = cells.reduce((s, c) => s + (c.n_sys || 0), 0);
    if (wsum > 0) {
      const pa = cells.reduce((s, c) => s + (c.n_sys || 0) * c.pairwise_accuracy, 0) / wsum;
      return { w: metricTrustWeight(pa), basis: 'pair', pa };
    }
  }
  const fam = (artifact.families || {})[info.family || ''] || {};
  const sysRoll = ((fam.metrics || {})[metric] || {}).sys || {};
  const pa = sysRoll.pairwise_accuracy_weighted_mean;
  if (pa != null) return { w: metricTrustWeight(pa), basis: 'family', pa };
  return unmeasured;
}

/** Model-drift discount; deterministic paradigms exempt (spec §6.7). */
export function wRecency(ageDays, paradigm) {
  if (DRIFT_EXEMPT_PARADIGMS.has(paradigm)) return W_RECENCY_FRESH;
  if (ageDays == null) return W_RECENCY_STALE;
  if (ageDays <= RECENCY_FRESH_DAYS) return W_RECENCY_FRESH;
  if (ageDays <= RECENCY_AGING_DAYS) return W_RECENCY_AGING;
  return W_RECENCY_STALE;
}

export function wTrust(trust) {
  return Object.prototype.hasOwnProperty.call(W_TRUST, trust)
    ? W_TRUST[trust] : W_TRUST_UNKNOWN;
}

export function wContam(grade) {
  if (grade == null) return W_CONTAM_UNKNOWN;
  return Object.prototype.hasOwnProperty.call(W_CONTAM, grade)
    ? W_CONTAM[grade] : W_CONTAM_UNKNOWN;
}

/** r_run = fSize · fRich · fConf · fRepl for the supporting run. */
export function runReliability(run) {
  return fSize(run.n) * fRich(run.l_eff)
    * fConf(run.ci_halfwidth, run.n) * fRepl(run.runs_on_pair);
}

// ---------------------------------------------------------------------------
// §7 The pair composite
// ---------------------------------------------------------------------------

const grade = (run) => (run.contamination in W_CONTAM ? run.contamination : null);
const eligible = (runs) => (runs || []).filter((r) => r.trust !== 'disqualified');

function selectSupporting(evidence) {
  const scored = evidence.filter((r) => isNum(r.chrf_plus_plus));
  if (!scored.length) return null;
  return scored.slice().sort((x, y) => {
    if (y.chrf_plus_plus !== x.chrf_plus_plus) return y.chrf_plus_plus - x.chrf_plus_plus;
    const nx = x.n || 0; const ny = y.n || 0;
    if (ny !== nx) return ny - nx;
    const ax = x.age_days == null ? Infinity : x.age_days;
    const ay = y.age_days == null ? Infinity : y.age_days;
    if (ax !== ay) return ax - ay;
    return String(x.run_id || '').localeCompare(String(y.run_id || ''));
  })[0];
}

function unmeasuredTuple() {
  return {
    formula_version: FORMULA_VERSION,
    source: PROVENANCE,
    lane: 'unmeasured',
    evidence_class: null,
    rung: null,
    q: null,
    q_raw: null,
    r: null,
    cq: null,
    band: null,
    band_label: null,
    provisional: null,
    components: {},
    flags: [],
    provenance: { runs_considered: 0 },
  };
}

/**
 * The canonical pair tuple (spec §7). Twin of Python connection_quality().
 *
 * @param {Array<object>} runs — published run evidence (see spec §6.9 for
 *   fail-honest defaults on missing fields)
 * @param {Record<string, number>} floors — iso3 → chance floor (0–100)
 * @param {string} a
 * @param {string} b
 * @param {object} [opts] — { direction: null|'a->b'|'b->a',
 *   metricTrust: {w, basis, pa}|null, humanEvidence: {class, share, n,
 *   reviewers}|null }
 */
export function connectionQuality(runs, floors, a, b, opts = {}) {
  const { direction = null, metricTrust = null, humanEvidence = null } = opts;
  const elig = eligible(runs);
  if (!elig.length && !humanEvidence) return unmeasuredTuple();

  // §3 lane: clean if any LOW evidence; non-LOW can never strengthen.
  const clean = elig.filter((r) => grade(r) === 'LOW');
  let lane; let evidence;
  if (clean.length) { lane = 'clean'; evidence = clean; }
  else if (elig.length) { lane = 'relative'; evidence = elig; }
  else { lane = 'clean'; evidence = []; }

  const flags = [];

  // §4 evidence class precedence: speaker/expert human > automatic.
  if (humanEvidence && humanEvidence.share != null) {
    const share = clamp01(humanEvidence.share);
    const hfSize = Math.min(1.0, (humanEvidence.n || 0) / HUMAN_N_FULL);
    const hfRev = Math.min(1.0, (humanEvidence.reviewers || 0) / HUMAN_REVIEWERS_FULL);
    const r = hfSize * hfRev;
    const band = strengthBin(share);
    return {
      formula_version: FORMULA_VERSION,
      source: PROVENANCE,
      lane,
      evidence_class: humanEvidence.class || 'speaker',
      rung: 'human',
      q: share,
      q_raw: null,
      r,
      cq: share * r,
      band,
      band_label: BIN_LABELS[band],
      provisional: (humanEvidence.n || 0) < HUMAN_N_FULL,
      components: { f_size_human: hfSize, f_reviewers: hfRev },
      flags,
      provenance: { runs_considered: elig.length, evidence: 'human' },
    };
  }

  const floor = floorForPair(floors, a, b, direction);
  const supporting = selectSupporting(evidence);
  if (!supporting) {
    const out = unmeasuredTuple();
    out.lane = lane;
    out.rung = 'raw';
    out.flags = ['no_canonical_metric'];
    out.provenance = { runs_considered: elig.length };
    return out;
  }

  const raw = supporting.chrf_plus_plus;
  const q = cchrf(raw, floor);
  const rung = q != null ? 'L0' : 'raw';
  if (q === 0.0 && floor != null && raw <= floor) flags.push('at_or_below_floor');

  // §6 reliability channel.
  const nRuns = evidence.length;
  const rRun = runReliability({ ...supporting, runs_on_pair: nRuns });

  const domains = new Set(evidence.map((r) => r.domain || '_unlabeled'));
  const registers = new Set(evidence.map((r) => r.register || '_unlabeled'));
  const cover = fCover(domains, registers);

  const mt = metricTrust || { w: W_METRIC_UNMEASURED, basis: 'unmeasured', pa: null };
  const trustW = wTrust(supporting.trust);
  const recW = wRecency(supporting.age_days, supporting.paradigm);
  const contamW = lane === 'clean' ? 1.0 : wContam(grade(supporting));

  const r = rRun * cover * mt.w * trustW * recW * contamW;

  const band = q != null ? strengthBin(q) : null;
  const provisional = !((supporting.n || 0) >= SIGNIFICANCE_N);

  return {
    formula_version: FORMULA_VERSION,
    source: PROVENANCE,
    lane,
    evidence_class: 'automatic',
    rung,
    q,
    q_raw: clamp01(raw / 100.0),
    r,
    cq: q != null ? q * r : null,
    band,
    band_label: band != null ? BIN_LABELS[band] : null,
    provisional,
    components: {
      raw_chrf: raw,
      floor,
      f_size: fSize(supporting.n),
      f_rich: fRich(supporting.l_eff),
      f_conf: fConf(supporting.ci_halfwidth, supporting.n),
      f_repl: fRepl(nRuns),
      f_cover: cover,
      w_metric: mt.w,
      metric_basis: mt.basis,
      w_trust: trustW,
      w_recency: recW,
      w_contam: contamW,
      n_runs: nRuns,
    },
    flags,
    provenance: {
      runs_considered: elig.length,
      supporting_run: supporting.run_id,
      floor_rule: direction ? 'target-side' : 'max-of-pair',
    },
  };
}

// ---------------------------------------------------------------------------
// §7.4 Chains — ESTIMATED reachability, never a measurement
// ---------------------------------------------------------------------------

/**
 * Compose hop tuples into an ESTIMATED chain claim. Any ineligible hop
 * (non-clean lane, non-comparable rung, no positive q, or a never-chain
 * corpus like FLORES/NTREX) voids the chain — refused, not discounted.
 * Q composes multiplicatively with the λ junction discount; R is the
 * MINIMUM hop reliability (a chain claim is only as strong as its
 * weakest hop).
 */
export function chainQuality(hops) {
  if (!hops || !hops.length) return null;
  for (const h of hops) {
    if (h.lane !== 'clean' || !['L0', 'human'].includes(h.rung)
      || !h.q || h.q <= 0 || h.never_chain || h.r == null) {
      return null;
    }
  }
  let q = LAMBDA_JUNCTION ** (hops.length - 1);
  for (const h of hops) q *= h.q;
  const r = Math.min(...hops.map((h) => h.r));
  return {
    formula_version: FORMULA_VERSION,
    source: PROVENANCE,
    estimated: true,
    hops: hops.length,
    q,
    r,
    cq: q * r,
  };
}
