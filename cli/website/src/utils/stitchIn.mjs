/**
 * stitchIn — the house word-reveal: a headline "zips" itself together.
 *
 * Extracted verbatim from ZipperSeam (founder pacing direction 2026-07-17b:
 * "sentences should click and pause") so every scroll story stitches type the
 * same way instead of each page growing its own drift-prone copy.
 *
 * The shape: even words drop from above, odd words rise from below, and the
 * line stitches shut on the scrub — the zipper metaphor, in type. The whole
 * line lands inside a FIXED window (`amount` spreads the stagger over the
 * total, however many words there are — never a per-word constant that
 * overruns the beat), each word snaps home with a back.out overshoot, the
 * finished sentence gets a micro scale "click", and callers leave dead scrub
 * after the click so the line HOLDS, readable, before anything else moves.
 *
 * Contract: transform/opacity only (motion contract, DESIGN.md §5). SSR-safe:
 * the caller passes its own dynamically-imported `gsap` + `SplitText` (the
 * plugin is free since GSAP 3.13 but must be imported fail-soft) and should
 * split only AFTER `document.fonts.ready`, or the word geometry re-wraps
 * under the split. Returns `false` when the plugin is unavailable or the
 * line is too short — callers then fall back to a whole-element tween, so a
 * story never loses a headline.
 *
 * @param {object} gsap - the caller's gsap instance (dynamic import)
 * @param {object|null} SplitText - the caller's SplitText plugin, or null
 * @param {object} tl - the gsap timeline the reveal is placed on
 * @param {Element|null} el - the headline element
 * @param {number} at - timeline position (in the caller's timeline units)
 * @param {object} [opts]
 * @param {'words'|'chars'} [opts.unit='words'] - split granularity
 * @param {number} [opts.dur=0.016] - per-unit flight time (timeline units)
 * @param {number} [opts.amount=0.012] - TOTAL stagger spread (line lands at at+amount+dur)
 * @param {string} [opts.ease='back.out(1.7)'] - per-word ease
 * @param {number|null} [opts.exitAt=null] - optional unzip-apart exit position
 * @param {boolean} [opts.pop=true] - the whole-line micro "click" on land
 * @param {string} [opts.wordsClass] - CSS-module class for word spans
 * @param {string} [opts.charsClass] - CSS-module class for char spans
 * @param {Array}  [opts.splits] - caller's SplitText collector (reverted on teardown)
 * @returns {number|false} the timeline position where the line lands, or
 *   false (caller falls back to a whole-line tween)
 */
export function stitchIn(gsap, SplitText, tl, el, at, opts = {}) {
  const {
    unit = 'words',
    dur = 0.016, // per-unit flight time
    amount = 0.012, // TOTAL stagger spread (line lands at at+amount+dur)
    ease = 'back.out(1.7)',
    exitAt = null,
    pop = true,
    wordsClass,
    charsClass,
    splits,
  } = opts;
  if (!el || !SplitText || !gsap || !tl) return false;
  let sp = null;
  try {
    sp = new SplitText(el, {
      type: unit,
      wordsClass,
      charsClass,
      aria: 'auto',
    });
  } catch (e) {
    return false;
  }
  const units = unit === 'chars' ? sp.chars : sp.words;
  if (!units || units.length < 2) {
    try {
      sp.revert();
    } catch (e) {
      /* nothing to restore */
    }
    return false;
  }
  if (splits) splits.push(sp);
  const evens = units.filter((_, i) => i % 2 === 0);
  const odds = units.filter((_, i) => i % 2 === 1);
  tl.fromTo(evens, {y: '-0.55em', opacity: 0}, {y: 0, opacity: 1, duration: dur, stagger: {amount, from: 'start'}, ease}, at);
  tl.fromTo(odds, {y: '0.55em', opacity: 0}, {y: 0, opacity: 1, duration: dur, stagger: {amount, from: 'start'}, ease}, at);
  const landAt = at + amount + dur;
  if (pop) {
    // The "click": one subtle whole-line pulse the moment the last word
    // snaps home, then stillness — the reading hold.
    tl.to(el, {scale: 1.015, transformOrigin: '50% 50%', duration: dur * 0.3125, ease: 'power2.out'}, landAt);
    tl.to(el, {scale: 1, duration: dur * 0.5, ease: 'power2.inOut'}, landAt + dur * 0.3125);
  }
  if (exitAt != null) {
    // Unzip apart on exit — wider spread than the entry.
    tl.to(evens, {y: '-0.5em', opacity: 0, duration: dur * 1.25, stagger: {amount: amount * 0.5}}, exitAt);
    tl.to(odds, {y: '0.5em', opacity: 0, duration: dur * 1.25, stagger: {amount: amount * 0.5}}, exitAt);
  }
  return landAt;
}
