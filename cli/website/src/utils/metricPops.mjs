/**
 * metricPops.mjs — the homepage seam's metric-name SSOT, thin adapter over the
 * GENERATED data/metric-pops.json (built by cli/scripts/build-metric-pops.mjs
 * from shared/metric-registry.json + the quz & crk language cards).
 *
 * Which metrics show where is DATA-DRIVEN + honesty-checked at generation time:
 *   • MEASURE float — universal reference metrics, all registry status:implemented.
 *   • IMPROVE card  — Quechua-appropriate (quz macroarea South America ⇒ COMET,
 *     never the African AfriCOMET).
 *   • SEAL          — the sovereign set's OWN metrics (crk.evalMetrics: the LYSS
 *     FST/morphological validators).
 * Numbers are illustrative (flagged in the JSON, shown under an on-surface caveat).
 * MQM never appears (roadmap; not in the registry). Metric names render as slate
 * instrument chrome, held apart from quality green/red + brand teal.
 */
import data from '../data/metric-pops.json';

if (!data || !Array.isArray(data.measureFloat) || !data.card || !data.seal) {
  throw new Error('metric-pops.json missing/malformed — run `node cli/scripts/build-metric-pops.mjs`');
}

// ── MEASURE beat float (names only). Primary metric weighted heavier. ──
export const MEASURE_METRICS = data.measureFloat;
const PRIMARY = MEASURE_METRICS[0];
const MEASURE_WEIGHTED = [PRIMARY, PRIMARY, ...MEASURE_METRICS];

/** Shuffle-bag picker: glances the whole suite before repeating. */
export function makeMetricBag(list = MEASURE_WEIGHTED) {
  let bag = [];
  return function next() {
    if (!bag.length) bag = list.slice();
    return bag.splice((Math.random() * bag.length) | 0, 1)[0];
  };
}

// ── IMPROVE chain-proof card ──
export const CARD_HERO = data.card.hero; // {metric, from, to} — illustrative
export const CARD_METRICS = data.card.concur; // [{name, from, to}] concurring lenses
export const CARD_CAVEAT = data.card.caveat;

// ── SEAL sovereign scorecard ──
export const SEAL_MAIN = data.seal.hero; // one illustrative number (e.g. "chrF++ 81")
export const SEAL_NAMES = data.seal.names; // morphology/FST names (from crk.evalMetrics)
export const SEAL_CAVEAT = data.seal.caveat;
export const SEAL_CODE = data.seal.code; // the sovereign set's language (crk)
export const SEAL_DATASET = data.seal.dataset; // its eval set (EdTeKLA eng↔crk)
