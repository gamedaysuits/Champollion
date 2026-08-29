/**
 * lockPop — Champollion's signature "lock-and-pop" motion primitive.
 *
 * This is the house-style emphasis effect (founder direction 2026-07-20):
 * derived faithfully from the two moments already in the scroll-seam that the
 * founder chose as the brand's visual guide —
 *
 *   1. the chrF++ score CLIMBING through corrections and then SNAPPING into
 *      place on `back.out(2.5)` with a held green glow
 *      (ZipperSeam Beat 4, the `.scoreImproved` chip, ZipperSeam.js ~903-908);
 *   2. the sovereign seal's authorization "click" — a glow that CHARGES up
 *      (`power2.in`) then SETTLES to a residual rim, over the slow perpetual
 *      breathe of the sealed bars (ZipperSeam Beat 5 lock ~975-981 +
 *      the `sealShimmer` keyframe, 2.8s ease-in-out).
 *
 * The signature, distilled:
 *   CHARGE  — the element compresses and its glow winds up (`power2.in`)
 *   POP     — it springs past its resting size (`power3.out`)
 *   LOCK    — it settles home with a `back.out` rebound (the "clunk")
 *   HOLD    — a residual glow that never goes fully dark ("verified / strong")
 *   BREATHE — an optional slow perpetual pulse of strength (sealShimmer cadence)
 *
 * Contract: transform / opacity / FILTER only (DESIGN.md §5, compositor-safe).
 * Every function takes the caller's `gsap` instance so this module stays
 * SSR-safe and adds zero import cost until a client dynamically imports gsap.
 * Reduced motion: callers gate on prefers-reduced-motion and use `setLocked`.
 */

// Tone = the glow color, as an "r, g, b" string so callers can vary alpha.
// THE BRAND STANDARD (founder pick 2026-07-20) — the same three tiers reused
// across the hero map, the lock-and-pop, the network, and the seam. Colour
// carries QUALITY meaning: red = not reliable, orange = measured-but-mediocre,
// green = cleanly deployable.
//   green  #4caf50  (leaf)   — a good hop / deployable
//   orange #e8843a  (signal) — measured but not great (quality "ok" tier)
//   red    #d64550  (signal) — not reliable
// Callers may also pass an explicit `rgb: 'r, g, b'` in opts to override.
// NOTE: `orange` now matches qualityColors.ok (#e8843a) — a true quality orange,
// deliberately distinct from brand yellow. `amber`/`frontier` remain the legacy
// gold (#e8b339, the brand frontier/queue lane) for back-compat callers only.
export const TONES = {
  green: '76, 175, 80',
  red: '214, 69, 80',
  orange: '232, 132, 58',
  amber: '232, 179, 57',
  // back-compat aliases used by earlier callers
  frontier: '232, 179, 57',
  verified: '76, 175, 80',
  alarm: '214, 69, 80',
};

// All durations are real-time SECONDS for standalone/triggered use. When this
// primitive is placed inside the seam's scrubbed master timeline, the caller
// scales these into normalized progress units (the SHAPE is what's reused).
const DEFAULTS = {
  tone: 'frontier',
  dip: 0.965, // charge compress
  peak: 1.09, // pop overshoot
  chargeGlow: 8, // px, drop-shadow radius while charging
  peakGlow: 16, // px, at the pop
  restGlow: 5, // px, the held residual rim
  chargeBright: 1.12,
  peakBright: 1.6,
  chargeDur: 0.16,
  popDur: 0.13,
  settleDur: 0.5,
  breathe: true,
  breatheDur: 2.8, // matches sealShimmer's cadence
  breatheGlow: 3, // +px oscillation on the residual rim
  breatheBright: 1.06,
  breatheScale: 1.012,
};

const rgb = (tone) => TONES[tone] || TONES.frontier;
const shadow = (px, c, a) => `drop-shadow(0 0 ${px}px rgba(${c}, ${a}))`;

/**
 * Append the charge → pop → lock tweens to an existing timeline at position
 * `at`. Returns the timeline position where the lock completes — use that as
 * the start of a "dwell" plateau so a fast scroller lands on the locked state.
 */
export function addLockPop(gsap, tl, el, at, opts = {}) {
  if (!el) return at;
  const o = {...DEFAULTS, ...opts};
  const c = o.rgb || rgb(o.tone);
  gsap.set(el, {transformOrigin: '50% 50%', willChange: 'transform, filter'});

  // CHARGE — compress + glow winds up.
  tl.to(
    el,
    {
      scale: o.dip,
      filter: `brightness(${o.chargeBright}) ${shadow(o.chargeGlow, c, 0.85)}`,
      duration: o.chargeDur,
      ease: 'power2.in',
    },
    at,
  );
  // POP — spring past resting size, glow peaks.
  tl.to(
    el,
    {
      scale: o.peak,
      filter: `brightness(${o.peakBright}) ${shadow(o.peakGlow, c, 0.95)}`,
      duration: o.popDur,
      ease: 'power3.out',
    },
    at + o.chargeDur,
  );
  // LOCK — settle home with a back.out rebound; glow decays to the held rim.
  tl.to(
    el,
    {
      scale: 1,
      filter: `brightness(1) ${shadow(o.restGlow, c, 0.55)}`,
      duration: o.settleDur,
      ease: 'back.out(2.2)',
    },
    at + o.chargeDur + o.popDur,
  );
  return at + o.chargeDur + o.popDur + o.settleDur;
}

/**
 * Start an independent, perpetual "strength" breathe on a LOCKED element.
 * Runs on its own tween (not scrubbed), so it works standalone AND after a
 * lock inside a scrubbed seam. Returns the tween so callers can `.kill()` it.
 */
export function breathe(gsap, el, opts = {}) {
  if (!el) return null;
  const o = {...DEFAULTS, ...opts};
  const c = o.rgb || rgb(o.tone);
  return gsap.to(el, {
    scale: o.breatheScale,
    filter: `brightness(${o.breatheBright}) ${shadow(o.restGlow + o.breatheGlow, c, 0.7)}`,
    duration: o.breatheDur / 2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });
}

/**
 * Standalone, self-playing lock-and-pop — for the lab, and for any triggered
 * (non-scrubbed) use. Builds its own timeline and, on complete, hands off to a
 * perpetual `breathe`. Returns the timeline.
 */
export function playLockPop(gsap, el, opts = {}) {
  if (!el) return null;
  const o = {...DEFAULTS, ...opts};
  const tl = gsap.timeline();
  const end = addLockPop(gsap, tl, el, 0, o);
  if (o.breathe) tl.add(() => breathe(gsap, el, o), end);
  return tl;
}

/** Reduced-motion fallback: set the LOCKED end-state directly, no animation. */
export function setLocked(gsap, el, opts = {}) {
  if (!el) return;
  const o = {...DEFAULTS, ...opts};
  const c = o.rgb || rgb(o.tone);
  gsap.set(el, {scale: 1, filter: `brightness(1) ${shadow(o.restGlow, c, 0.55)}`});
}
