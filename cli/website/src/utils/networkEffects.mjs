/**
 * networkEffects — reusable "living network" motion primitives.
 *
 * These are the Act-3/Act-4 story effects of the seam, factored OUT of the
 * component so the future benefits page / launch ad can replay them verbatim
 * (founder direction 2026-07-21: "build these as REUSABLE helpers … so the
 * future benefits page/ad can reuse them").
 *
 * Every helper follows the lockPop.mjs contract:
 *   - the caller passes its own `gsap` instance (SSR-safe, zero import cost);
 *   - it APPENDS pure `fromTo` / `to` tweens to a timeline at position `at`
 *     (so the whole thing is scrub-reversible by construction — no Flip, no
 *     imperative state that can't run backwards);
 *   - transform / opacity / filter / SVG attr only (DESIGN.md §5 compositor
 *     contract; `attr:{...}` and `stroke`/`fill` are cheap on the few tagged
 *     elements these target — never a per-dot tween storm);
 *   - it returns the timeline position where the effect settles, so callers
 *     can chain a reading "dwell" after it.
 *
 * Colour is MEANING (qualityColors SSOT): red = not reliable, orange =
 * measured-but-mediocre, green = cleanly deployable, slate = unmeasured.
 */
import {QUALITY, SLATE, TIER_ORDER, routeTier} from './qualityColors.mjs';

/** Hex for a quality tier key ('bad'|'ok'|'good'); anything else → slate. */
export function hexForTier(q) {
  return (QUALITY[q] && QUALITY[q].hex) || SLATE;
}
/** "r, g, b" for a quality tier key; anything else → slate's rgb. */
export function rgbForTier(q) {
  return (QUALITY[q] && QUALITY[q].rgb) || '139, 149, 167';
}
/** A drop-shadow glow string for a tier. */
export function glowForTier(q, px = 6, a = 0.75) {
  return `drop-shadow(0 0 ${px}px rgba(${rgbForTier(q)}, ${a}))`;
}

/**
 * Recolour ONE edge (an SVG <line>) from one tier to another, optionally
 * passing through the intermediate tiers so a red→green fix visibly climbs
 * red → orange → green (the founder's favourite "score climb", in edge form).
 * Glow blooms at each step and settles to a held rim on the final tier.
 * Returns the settle position.
 */
export function edgeRecolor(gsap, tl, edge, at, opts = {}) {
  if (!edge) return at;
  const {from = 'bad', to = 'good', stepDur = 0.012, throughTiers = true} = opts;
  const fi = TIER_ORDER.indexOf(from);
  const ti = TIER_ORDER.indexOf(to);
  const steps = throughTiers && ti > fi
    ? TIER_ORDER.slice(fi + 1, ti + 1)
    : [to];
  let cursor = at;
  steps.forEach((tier, i) => {
    const last = i === steps.length - 1;
    tl.to(edge, {
      stroke: hexForTier(tier),
      strokeWidth: last ? 2.6 : 2.2,
      opacity: 1,
      attr: {'stroke-opacity': 1},
      // bloom, then (on the last step) settle to a held rim
      filter: glowForTier(tier, last ? 7 : 9, last ? 0.7 : 0.95),
      duration: stepDur,
      ease: last ? 'back.out(1.8)' : 'power2.out',
    }, cursor);
    cursor += stepDur;
  });
  return cursor;
}

/**
 * Brighten a TAGGED SET of edges together — "a better hop opens new routes"
 * (Mode A) and "a stronger hub makes many routes more reliable" (Mode B).
 * Grouped so it reads as ONE second-order effect, not per-edge noise.
 * `tone` is a tier key (defaults to 'good') the whole set warms toward.
 * Returns the settle position.
 */
export function rippleBrighten(gsap, tl, edges, at, opts = {}) {
  const list = Array.from(edges || []).filter(Boolean);
  if (!list.length) return at;
  // keepColor: brighten (opacity + glow) WITHOUT recolouring — for "a better
  // hop opens routes / a stronger hub" ripples, where the second-order effect
  // is that routes become VIABLE, not that each pair's measured quality
  // improved. Recolouring a measured-red edge green would assert a quality
  // that doesn't exist (qualityColors SSOT / honesty rule).
  const {tone = 'good', dur = 0.03, stagger = 0.002, hold = false, keepColor = false} = opts;
  tl.to(list, {
    ...(keepColor ? {} : {stroke: hexForTier(tone)}),
    strokeWidth: 2.2,
    opacity: 1,
    attr: {'stroke-opacity': 0.95},
    filter: keepColor
      ? `brightness(1.35) drop-shadow(0 0 5px rgba(234, 241, 239, 0.5))`
      : glowForTier(tone, 6, 0.6),
    duration: dur,
    stagger,
    ease: 'power2.out',
  }, at);
  const settle = at + dur + stagger * list.length;
  if (hold) {
    // a gentle residual — keeps the newly-lit routes "alive" through the dwell
    tl.to(list, {filter: glowForTier(tone, 4, 0.4), duration: 0.01}, settle);
  }
  return settle;
}

/**
 * Trace a request packet (an SVG <circle>/<g>) along a polyline of viewBox
 * points, hop by hop. If `stallAt` is set, the packet stutters + dims as it
 * crosses that segment (the weak/red hop degrading the request), then arrives
 * visibly weakened. Pure segment tweens on cx/cy → scrub-reversible.
 * Returns the arrival position.
 */
export function routeTrace(gsap, tl, packet, points, at, opts = {}) {
  if (!packet || !Array.isArray(points) || points.length < 2) return at;
  const {segDur = 0.02, stallAt = null, tone = 'good', arriveDim = 0.45} = opts;
  // Positioned set (not build-time) so scrubbing back before `at` and reusing
  // the same packet for a second trace both reset cleanly.
  tl.set(packet, {attr: {cx: points[0].x, cy: points[0].y, r: 4}, opacity: 0, filter: 'none'}, at);
  tl.to(packet, {opacity: 1, duration: 0.008}, at);
  let cursor = at + 0.008;
  for (let i = 1; i < points.length; i++) {
    const isStall = stallAt != null && i - 1 === stallAt;
    const d = isStall ? segDur * 1.8 : segDur;
    tl.to(packet, {
      attr: {cx: points[i].x, cy: points[i].y},
      duration: d,
      ease: isStall ? 'power3.inOut' : 'power1.inOut',
    }, cursor);
    if (isStall) {
      // stutter: two tiny back-jitters mid-segment + a dim on arrival
      tl.to(packet, {attr: {r: 3.2}, opacity: 0.55, duration: d * 0.3, yoyo: true, repeat: 3, ease: 'power1.inOut'}, cursor + d * 0.15);
      tl.to(packet, {opacity: arriveDim, filter: glowForTier('bad', 5, 0.5), duration: d * 0.25}, cursor + d * 0.72);
    }
    cursor += d;
  }
  return cursor;
}

/**
 * Animate a numeric readout (route-strength / score) climbing from → to,
 * writing the element's text each frame, with a lock-and-pop settle. Uses a
 * proxy object so the tween is scrub-reversible (scrolling back counts down).
 * `format` maps the running value to display text. Returns the settle position.
 */
export function strengthTicker(gsap, tl, el, at, opts = {}) {
  if (!el) return at;
  const {
    from = 0, to = 100, dur = 0.03,
    tone = 'good',
    format = (v) => String(Math.round(v)),
    prefix = '', suffix = '',
  } = opts;
  const proxy = {v: from};
  tl.to(proxy, {
    v: to,
    duration: dur,
    ease: 'power1.out',
    onUpdate: () => { el.textContent = prefix + format(proxy.v) + suffix; },
  }, at);
  // the DIGITS walk to the tier colour in lockstep (not just the glow) — a
  // good score must not stay painted not-reliable-red.
  const c = rgbForTier(tone);
  tl.to(el, {color: hexForTier(tone), duration: dur, ease: 'power1.out'}, at);
  // the "lock": one glow bloom + micro-pop as it lands on the final value
  tl.to(el, {scale: 1.12, filter: `brightness(1.5) drop-shadow(0 0 14px rgba(${c},0.9))`, duration: 0.006, ease: 'power3.out', transformOrigin: '50% 50%'}, at + dur);
  tl.to(el, {scale: 1, filter: `brightness(1) drop-shadow(0 0 5px rgba(${c},0.55))`, duration: 0.014, ease: 'back.out(2.2)'}, at + dur + 0.006);
  return at + dur + 0.02;
}

/**
 * Warm a field of "unreached" dots back to life — cohort by cohort, spreading
 * OUTWARD (the network expanding through effort). Each cohort is one group
 * tween (never per-dot): red → orange for the far ring, red → green for the
 * inner rings nearest the network's reach. `cohorts` is an ordered array of
 * NodeLists/arrays (inner→outer). Returns the settle position.
 */
export function reviveWave(gsap, tl, cohorts, at, opts = {}) {
  const list = (cohorts || []).filter((c) => c && c.length);
  if (!list.length) return at;
  const {stagger = 0.01, dur = 0.02, reachRatio = 0.55} = opts;
  let last = at;
  list.forEach((cohort, i) => {
    const near = i / Math.max(list.length - 1, 1) < reachRatio;
    const tier = near ? 'good' : 'ok';
    const cAt = at + i * stagger;
    tl.to(Array.from(cohort), {
      fill: hexForTier(tier),
      opacity: near ? 0.95 : 0.8,
      duration: dur,
      ease: 'power1.out',
      // a soft bloom as each ring warms
      filter: glowForTier(tier, near ? 5 : 3, 0.5),
    }, cAt);
    last = cAt + dur;
  });
  return last;
}

/**
 * Fly "flight" SVG <line>s from measured start positions (the zipper
 * connectors, mapped into the network's viewBox) to their target network edge
 * endpoints, carrying each pair's quality colour — the literal "the pieces
 * BECOME the edges" morph. `flights` is an array of
 *   { el, from:{x1,y1,x2,y2}, to:{x1,y1,x2,y2}, q }
 * Pure fromTo on attr → fully scrub-reversible (verified backward). Returns
 * the landing position.
 */
export function morphFlights(gsap, tl, flights, at, opts = {}) {
  const list = (flights || []).filter((f) => f && f.el);
  if (!list.length) return at;
  const {dur = 0.05, stagger = 0.004, ease = 'power2.inOut'} = opts;
  list.forEach((f, i) => {
    const c = rgbForTier(f.q);
    const fAt = at + i * stagger;
    // Positioned set so scrubbing back before the morph resets the piece to
    // its connector origin (fully reversible).
    tl.set(f.el, {attr: {...f.from, 'stroke-opacity': 0}, stroke: hexForTier(f.q)}, fAt);
    // fade the travelling piece in as it detaches…
    tl.to(f.el, {attr: {'stroke-opacity': 0.95}, duration: dur * 0.2}, fAt);
    // …fly + stretch/rotate into the straight edge…
    tl.to(f.el, {
      attr: {x1: f.to.x1, y1: f.to.y1, x2: f.to.x2, y2: f.to.y2},
      filter: `drop-shadow(0 0 6px rgba(${c},0.7))`,
      duration: dur,
      ease,
    }, fAt);
    // …and settle to a held rim exactly on the edge.
    tl.to(f.el, {filter: `drop-shadow(0 0 3px rgba(${c},0.45))`, duration: dur * 0.3}, fAt + dur);
  });
  return at + dur + stagger * list.length + dur * 0.3;
}

/**
 * Map a viewport-space rectangle/point into an SVG's viewBox units, using the
 * live layout rect + the viewBox dims. (Build-time helper for the morph — the
 * connectors live in a DOM layer, the edges in viewBox space.)
 */
export function makeViewportToViewBox(svgRect, vbW, vbH) {
  return (clientX, clientY) => ({
    x: ((clientX - svgRect.left) / svgRect.width) * vbW,
    y: ((clientY - svgRect.top) / svgRect.height) * vbH,
  });
}

export {routeTier};
