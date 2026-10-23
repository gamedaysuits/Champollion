/**
 * brandColors — Champollion's NON-SEMANTIC identity palette (founder picks
 * 2026-07-21). One SSOT, consumed by the seam, the hero, the labs, and (mirrored
 * into design-tokens.css) the whole site.
 *
 * The rule this file exists to enforce, everywhere:
 *   teal             = IDENTITY  — who we are (structure, accent, focus). NEVER a score.
 *   green/orange/red = a MEASUREMENT — a quality score on a pair (qualityColors.mjs).
 *
 * A colour must never mean two things. That is why the old amber `#e8b339`
 * (which used to be both "brand vulnerable" AND quality-"ok") was split: quality
 * "ok" moved to a true orange (#e8843a, qualityColors.mjs).
 *
 * Teal ships TWO values on purpose: #3fc1c0 for dark surfaces and #0f766e for
 * text and links on white (AA). Pick by surface via `brandTeal(surface)`, or
 * read `var(--accent)`, which design-tokens.css flips per theme.
 */

/** @typedef {{hex: string, rgb: string, label: string, onLight?: string}} Swatch */

/** Brand (non-semantic) identity colour. @type {{teal: Swatch}} */
// The founder rejected the cyan #4dd8ff and gold #ffcf4d on 2026-10-12
// ("vibecodey … it's on everything"). The identity colour is now DESIGN.md's
// scholarly-teal accent: #3fc1c0 on dark surfaces, #0f766e on white (5.47:1,
// WCAG AA for text). There is no second identity hue; the vitality triad is a
// hairline only, and a measured pair on a map is the neutral --measured ink.
export const BRAND = {
  teal: {hex: '#3fc1c0', rgb: '63, 193, 192', onLight: '#0f766e', label: 'brand teal (the accent)'},
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
 * @param {'dark'|'light'} [surface] 'dark' → #3fc1c0 (hero/seam), 'light' → #0f766e (docs).
 */
export function brandTeal(surface = 'dark') {
  return surface === 'light' ? BRAND.teal.onLight : BRAND.teal.hex;
}

/** "r, g, b" for a brand key ('teal'). */
export function brandRgb(key) {
  return (BRAND[key] && BRAND[key].rgb) || BRAND.teal.rgb;
}
