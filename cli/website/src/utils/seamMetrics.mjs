/**
 * seamMetrics.mjs — the seam's illustrative metric-VALUE helpers, shared by the
 * tape's run-card, the chain panel's bridge run-cards, and the transmit beat so
 * a measurement reads the same everywhere. NAMES come from seamRuns (SSOT-gated,
 * per language); this module only turns one illustrative quality `q` into
 * believable per-lens NUMBERS (disclosed under the run-card's standing footer).
 * No DOM, no React — node-testable.
 */

/**
 * Illustrative target value + decimals for a metric at quality q∈[0,1].
 * Metrics where lower is better (TER, MetricX) invert q. One q → all its lenses
 * agree, so a pair's whole run moves together.
 * @param {string} name a registry metric display name (chrF++, COMET, spBLEU, …)
 * @param {number} q 0..1 illustrative quality
 * @returns {{v: number, d: number}} value + decimal places
 */
export function lensTarget(name, q) {
  switch (name) {
    case 'COMET':
    case 'AfriCOMET':
    case 'Semantic':
      return {v: 0.28 + q * 0.62, d: 2};
    case 'spBLEU':
    case 'BLEU':
      return {v: Math.max(2, q * 88 - 4), d: 1};
    case 'TER':
      return {v: Math.max(3, (1 - q) * 82 + 8), d: 1}; // lower is better
    case 'MetricX-24':
      return {v: Math.max(0.5, (1 - q) * 22 + 1), d: 1}; // lower is better
    default: // chrF++
      return {v: q * 100, d: 1};
  }
}

const ss = (k) => {
  const t = Math.min(1, Math.max(0, k));
  return t * t * (3 - 2 * t);
};

// deterministic 0..1 hash — a measurement's rolling wobble must scrub the same.
function dHash(a, b, c) {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The displayed text for a metric while a measurement is running: an em-dash
 * before the head arrives, a rolling wobble that converges toward the target,
 * then the locked value. Pure in its inputs → scrubs both ways.
 * @param {string} name metric display name
 * @param {number} q illustrative quality
 * @param {{arrived: boolean, dwellT: number, lockAt: number, seed?: number}} m
 * @returns {string}
 */
export function measureText(name, q, {arrived, dwellT, lockAt, seed = 0}) {
  const {v, d} = lensTarget(name, q);
  if (!arrived) return '—';
  if (dwellT >= lockAt) return v.toFixed(d);
  const prog = ss(dwellT / lockAt);
  const wob = (dHash(seed * 7 + 1, 13, Math.floor(dwellT * 26)) - 0.5) * (1 - prog) * (d === 2 ? 0.16 : 11);
  return Math.max(0, v * (0.3 + 0.7 * prog) + wob).toFixed(d);
}
