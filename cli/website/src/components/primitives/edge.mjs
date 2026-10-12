/**
 * Edge primitive — one line = one language pair.
 *
 * The seam, the studio, and (later) the hero stroke every edge the same way, so
 * "a measured pair" reads identically site-wide (founder direction 2026-07-21:
 * reuse line elements everywhere). Two channels, each ONE meaning:
 *   COLOUR = quality tier (qualityColors SSOT). A route is only as good as its
 *            WEAKEST hop (routeTier), so a route's colour = its worst edge.
 *   DASH   = provisionality (not yet significant) — dashed + dimmed.
 * `unmeasured` edges are slate — a connection exists, no score yet (never the ramp).
 *
 * Pure style SSOT: returns a plain style object usable for SVG attrs, CSS, or a
 * GSAP `to({stroke, strokeWidth, ...})`. It leans on the same qualityColors /
 * networkEffects hex map the animated effects use, so a static edge and an
 * `edgeRecolor`'d edge land on identical colours.
 */
import {hexForTier} from '../../utils/networkEffects.mjs';
import {SLATE} from '../../utils/qualityColors.mjs';

/** @typedef {'good'|'ok'|'bad'|'unmeasured'} EdgeTier */

/**
 * Style for one edge.
 * @param {EdgeTier} tier
 * @param {{provisional?: boolean, strong?: boolean, chain?: boolean}} [opts]
 * @returns {{stroke: string, strokeWidth: number, dash: string|null, opacity: number}}
 */
export function edgeStyle(tier, opts = {}) {
  const {provisional = false, strong = false, chain = false} = opts;
  const unmeasured = tier === 'unmeasured';
  const stroke = unmeasured ? SLATE : hexForTier(tier);
  return {
    stroke,
    strokeWidth: strong || chain ? 2.6 : unmeasured ? 1 : 1.8,
    dash: provisional ? '6 5' : null,
    opacity: unmeasured ? 0.5 : chain ? 0.95 : 0.85,
  };
}

/** Curved-arc path between two [x,y] points (the seam/hero house curve). */
export function arcPath(a, b, bow = 0.18) {
  const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * bow;
  const my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * bow;
  return `M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`;
}
