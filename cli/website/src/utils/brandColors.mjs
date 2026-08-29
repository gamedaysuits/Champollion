/**
 * brandColors — Champollion's NON-SEMANTIC identity palette (founder picks
 * 2026-07-21). One SSOT, consumed by the seam, the hero, the labs, and (mirrored
 * into design-tokens.css) the whole site.
 *
 * The rule this file exists to enforce, everywhere:
 *   teal + yellow    = IDENTITY  — who we are (structure, accent, focus). NEVER a score.
 *   green/orange/red = a MEASUREMENT — a quality score on a pair (qualityColors.mjs).
 *
 * A colour must never mean two things. That is why the old amber `#e8b339`
 * (which used to be both "brand vulnerable" AND quality-"ok") was split: quality
 * "ok" moved to a true orange (#e8843a, qualityColors.mjs) and brand yellow is
 * now its own hue here.
 *
 * Teal ships TWO values on purpose: a bright cyan for the dark cinematic
 * surfaces (hero / seam) and an accessible darker teal for text and links on the
 * white docs pages (the light cyan fails contrast on white). Pick by surface via
 * `brandTeal(surface)`, or read `var(--brand-teal)` which design-tokens.css
 * flips per theme.
 */

/** @typedef {{hex: string, rgb: string, label: string, onLight?: string}} Swatch */

/** Brand (non-semantic) identity colours. @type {{teal: Swatch, yellow: Swatch}} */
export const BRAND = {
  teal: {hex: '#4dd8ff', rgb: '77, 216, 255', onLight: '#0d9488', label: 'brand teal'},
  yellow: {hex: '#ffcf4d', rgb: '255, 207, 77', label: 'brand yellow'},
};

/** Neutral / surface scale — the dark stage the seam lives on. */
export const NEUTRAL = {
  ink: '#06070b', // page / stage background
  surface: '#12151d', // raised panel
  text: '#e9ecf4', // primary text on ink
  muted: '#8b95a7', // secondary text / unmeasured (=== qualityColors SLATE)
};

/**
 * Brand teal for a given surface.
 * @param {'dark'|'light'} [surface] 'dark' → #4dd8ff (hero/seam), 'light' → #0d9488 (docs).
 */
export function brandTeal(surface = 'dark') {
  return surface === 'light' ? BRAND.teal.onLight : BRAND.teal.hex;
}

/** "r, g, b" for a brand key ('teal'|'yellow'). */
export function brandRgb(key) {
  return (BRAND[key] && BRAND[key].rgb) || BRAND.teal.rgb;
}
