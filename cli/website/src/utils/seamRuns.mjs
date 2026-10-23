/**
 * seamRuns.mjs — typed, fail-loud adapter over the GENERATED data/seam-runs.json
 * (built by cli/scripts/build-seam-runs.mjs). ONE source, three surfaces: the
 * tape's run-card, the chain panel's bridge cards, and the transmit pop chips
 * all read metric NAMES + the corpus a pair is measured on from here — so COMET
 * can never show on a pair where COMET is invalid (founder R3, 2026-07-22d).
 *
 * The record for a pair (order-free):
 *   { a, b, metrics: string[], benchmark: {name, short, datasetId}|null,
 *     license: string|null }
 * benchmark:null means the two languages share NO eval set — the UI says
 * "no held-out benchmark yet" (true for spa↔quz / quy↔quz: quz has none).
 */
import data from '../data/seam-runs.json' with {type: 'json'};

if (!data || !data.runs || typeof data.runs !== 'object') {
  throw new Error('seam-runs.json missing/malformed — run `node cli/scripts/build-seam-runs.mjs`');
}

/** Order-free pair key, matching the generator. */
export function runKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export const SEAM_RUNS = data.runs;

/**
 * The Answer Card query (Act VI). Everything structural is generator-derived:
 * the domain comes from the closed domain-taxonomy SSOT, the candidate methods
 * are the methods whose OWN cited coverage list claims both sides of the pair,
 * and the metrics/benchmark ride the same both-languages gate as every other
 * seam surface. Only the ranking is illustrative (CLAIMS.md).
 * @type {{src:string, tgt:string, domain:{code:string, description:string},
 *   metrics:string[], benchmark:({name:string,short:string,datasetId:string}|null),
 *   license:(string|null), candidates:{label:string,tier:string,claimedCode:string,anyToAny:boolean}[]}}
 */
export const SEAM_ANSWER = data.answer || null;
if (!SEAM_ANSWER || !Array.isArray(SEAM_ANSWER.candidates) || !SEAM_ANSWER.candidates.length) {
  throw new Error('seam-runs.json missing the `answer` payload — run `node cli/scripts/build-seam-runs.mjs`');
}

/**
 * The run record for a pair, or null if the seam has no record for it.
 * @param {string} a ISO 639-3
 * @param {string} b ISO 639-3
 * @returns {{a:string,b:string,metrics:string[],benchmark:({name:string,short:string,datasetId:string}|null),license:(string|null)}|null}
 */
export function runFor(a, b) {
  return SEAM_RUNS[runKey(a, b)] || null;
}

/**
 * The metric names for a pair — EMPTY when the seam has no record for it.
 *
 * This used to fall back to `['chrF++']`, which is the one thing this module
 * exists to prevent: for a pair we hold no run for, that asserts chrF++ was
 * measured, and the caller renders it beside real metric names with no way to
 * tell the difference. An unmeasured pair has no lenses, so it gets none.
 *
 * Empty, not a throw: the seam pairs are a closed generated set, so a miss is
 * a build-time bug, not a runtime state — and `metricsFor` runs inside the
 * homepage render loop, where throwing would blank the page over a cosmetic
 * gap. Both callers already map/filter the array, so `[]` renders as no lens
 * line. The console warning is what surfaces the bug to whoever caused it.
 *
 * @returns {string[]} metric names, or [] when the pair has no run record
 */
export function metricsFor(a, b) {
  const r = runFor(a, b);
  if (r && Array.isArray(r.metrics) && r.metrics.length) return r.metrics;
  console.warn(
    `[seamRuns] no run record for ${runKey(a, b)} — showing NO metric lenses. `
    + 'Add the pair in cli/scripts/build-seam-runs.mjs and rebuild; do not '
    + 'assume chrF++.',
  );
  return [];
}

/**
 * The benchmark line for a pair: the corpus short-name + license, or the
 * standing "no held-out benchmark yet" when the pair shares no eval set.
 * The rerun (community re-measure) overrides this at the call site.
 * @returns {{label:string, name:string|null, license:string|null, has:boolean}}
 */
export function benchmarkLine(a, b) {
  const r = runFor(a, b);
  if (!r || !r.benchmark) {
    return {label: 'no held-out benchmark yet', name: null, license: null, has: false};
  }
  const lic = r.license ? ` · ${r.license}` : '';
  return {
    label: `${r.benchmark.short}${lic}`,
    name: r.benchmark.name,
    license: r.license || null,
    has: true,
  };
}
