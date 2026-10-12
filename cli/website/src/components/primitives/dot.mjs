/**
 * Dot primitive — one dot = one language.
 *
 * The seam's problem-field, the hero poster, and /color-lab all draw the SAME
 * dot, so "a language" reads identically everywhere (founder direction
 * 2026-07-21: reuse dot elements site-wide). Colour = STATE:
 *   unknown    a language, not yet coloured (neutral white)
 *   covered    at least one MT engine lists it (brand teal — a capability, not a score)
 *   good/ok/bad a MEASURED quality tier (qualityColors SSOT)
 *   uncovered  no MT reaches it (alarm red — the gap)
 *
 * Pure style SSOT: returns { fill, r, opacity } for a <circle>. No DOM, no React,
 * so the same helper serves SVG render, canvas blit, and GSAP `attr` tweens.
 */
import {QUALITY} from '../../utils/qualityColors.mjs';
import {BRAND, NEUTRAL} from '../../utils/brandColors.mjs';

/** Dot radii (viewBox units) by role. */
export const DOT_R = {sm: 1.7, md: 2.4, lg: 3.4, hub: 6};

/**
 * @typedef {'unknown'|'covered'|'uncovered'|'good'|'ok'|'bad'} DotState
 * @typedef {'sm'|'md'|'lg'|'hub'} DotSize
 */

/**
 * Style for a dot in a given state.
 * @param {DotState} state
 * @param {DotSize} [size]
 * @returns {{fill: string, r: number, opacity: number}}
 */
export function dotStyle(state, size = 'md') {
  const r = DOT_R[size] || DOT_R.md;
  switch (state) {
    case 'covered':
      return {fill: BRAND.teal.hex, r, opacity: 1};
    case 'good':
      return {fill: QUALITY.good.hex, r, opacity: 1};
    case 'ok':
      return {fill: QUALITY.ok.hex, r, opacity: 1};
    case 'uncovered':
    case 'bad':
      return {fill: QUALITY.bad.hex, r, opacity: 0.88};
    case 'unknown':
    default:
      return {fill: NEUTRAL.text, r, opacity: 0.7};
  }
}

/** The rgb triple for a dot state's glow (drop-shadow / filter). */
export function dotRgb(state) {
  switch (state) {
    case 'covered':
      return BRAND.teal.rgb;
    case 'good':
      return QUALITY.good.rgb;
    case 'ok':
      return QUALITY.ok.rgb;
    case 'uncovered':
    case 'bad':
      return QUALITY.bad.rgb;
    default:
      return '233, 236, 244';
  }
}
