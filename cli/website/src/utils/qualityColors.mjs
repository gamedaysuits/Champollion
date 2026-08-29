/**
 * Quality tiers — colour = meaning (founder direction 2026-07-20).
 *
 * One SSOT reused by the seam (zipper + network), the hero map, and the
 * lock-and-pop. A hop's colour states how good that translation is:
 *   red    not reliable            (low chrF++)
 *   orange measured, but not great  (mid chrF++)
 *   green  cleanly deployable       (high chrF++)
 *
 * The routing truth these encode: a route is only as good as its WEAKEST hop —
 * one red hop makes the whole route unreliable. Improving a single hop
 * (red→orange→green) lifts the route, and can light a better route for the
 * whole network. That is why one contributor improving one pair matters.
 */
export const QUALITY = {
  bad: {key: 'bad', hex: '#d64550', rgb: '214, 69, 80', label: 'not reliable'},
  ok: {key: 'ok', hex: '#e8843a', rgb: '232, 132, 58', label: 'measured, not great'},
  good: {key: 'good', hex: '#4caf50', rgb: '76, 175, 80', label: 'cleanly deployable'},
};

// Neutral / unmeasured line colour.
export const SLATE = '#8b95a7';

// The tier order, worst → best (a route upgrades along this).
export const TIER_ORDER = ['bad', 'ok', 'good'];

// Map a chrF++ score (0–100) to a tier. Thresholds are illustrative for the
// seam's storytelling; the leaderboard uses the full cchrF++ ramp.
export function tierForScore(chrf) {
  if (typeof chrf !== 'number') return 'bad';
  if (chrf >= 60) return 'good';
  if (chrf >= 40) return 'ok';
  return 'bad';
}

// A route's tier is its WEAKEST hop (one bad hop spoils the bunch).
export function routeTier(hopTiers) {
  let worst = 'good';
  for (const t of hopTiers) {
    if (TIER_ORDER.indexOf(t) < TIER_ORDER.indexOf(worst)) worst = t;
  }
  return worst;
}

// ── The quality SPECTRUM (founder direction 2026-07-22) ──
// Quality is continuous, not three buckets: everywhere a quality is shown as
// colour it should sit on the red→orange→green spectrum anchored EXACTLY on
// the three tier colours above (t=0 ≡ bad, t=0.5 ≡ ok, t=1 ≡ good). The
// named tiers stay as the SSOT anchors and as labels; this function is the
// SSOT interpolation between them. Piecewise-linear in sRGB through the ok
// midpoint — simple, monotone, and endpoint-exact by construction.

const _rgbOf = (tier) => QUALITY[tier].rgb.split(',').map((s) => Number(s.trim()));
const _hex2 = (n) => n.toString(16).padStart(2, '0');

/**
 * Continuous quality colour. Input clamped to [0, 1].
 * @param {number} t 0 = not reliable (bad) · 0.5 = measured-not-great (ok) · 1 = deployable (good)
 * @returns {{hex: string, rgb: [number, number, number]}}
 */
export function qualitySpectrum(t) {
  const x = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const [a, b, f] = x <= 0.5
    ? [_rgbOf('bad'), _rgbOf('ok'), x * 2]
    : [_rgbOf('ok'), _rgbOf('good'), (x - 0.5) * 2];
  const rgb = /** @type {[number, number, number]} */ (
    a.map((av, i) => Math.round(av + (b[i] - av) * f))
  );
  return {hex: `#${rgb.map(_hex2).join('')}`, rgb};
}
