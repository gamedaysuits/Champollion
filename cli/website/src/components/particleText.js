/**
 * particleText — text-pixel particle physics, extracted from
 * FieldEngine.js (Morph v2 lineage) so other surfaces can reuse the
 * school without importing the whole Translation Field scheduler.
 *
 * Used by the graph hero's Rosetta inscription register: when a packet
 * lands, the model output is "chiseled" into the stone band — particles
 * converge into the glyph positions (spring converge, FieldEngine
 * constants) while excess chisel dust falls away under sand physics.
 *
 * Truthfulness: this module renders whatever text it is handed and
 * invents nothing. It is pure choreography.
 *
 * Performance school (same as FieldEngine):
 *   - typed-array pools allocated once, one getImageData per sampling,
 *     batched fills, no DOM reads in the step path.
 *   - NO rAF loop of its own: the host engine drives `step(now, dt)`
 *     from its single sanctioned loop (DESIGN.md §5).
 */

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * Rasterize one text run on `offCtx` and sample opaque pixels.
 * Identical sampling approach to FieldEngine.sample (one getImageData).
 *
 * @returns {{xs: number[], ys: number[]}} candidate positions (CSS px)
 */
export function sampleTextPoints(offCanvas, offCtx, text, x, y, font, dpr, w, h) {
  const W = Math.round(w * dpr);
  const H = Math.round(h * dpr);
  if (offCanvas.width !== W || offCanvas.height !== H) {
    offCanvas.width = W;
    offCanvas.height = H;
  }
  offCtx.setTransform(1, 0, 0, 1, 0, 0);
  offCtx.clearRect(0, 0, W, H);
  offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  offCtx.font = font;
  offCtx.fillStyle = '#fff';
  offCtx.textAlign = 'left';
  offCtx.textBaseline = 'middle';
  offCtx.fillText(text, x, y);
  const m = offCtx.measureText(text);
  const pad = 20;
  const x0 = Math.max(0, Math.floor((x - 6) * dpr));
  const x1 = Math.min(W, Math.ceil((x + m.width + 6) * dpr));
  const y0 = Math.max(0, Math.floor((y - pad) * dpr));
  const y1 = Math.min(H, Math.ceil((y + pad) * dpr));
  const xs = [];
  const ys = [];
  if (x1 - x0 < 2 || y1 - y0 < 2) return {xs, ys};
  const img = offCtx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const {data, width, height} = img;
  const step = Math.max(1, Math.round(dpr));
  for (let yy = 0; yy < height; yy += step) {
    const row = yy * width;
    for (let xx = 0; xx < width; xx += step) {
      if (data[(row + xx) * 4 + 3] > 110) {
        xs.push((x0 + xx) / dpr);
        ys.push((y0 + yy) / dpr);
      }
    }
  }
  return {xs, ys};
}

const N_GLYPH = 520; // converging glyph particles
const N_DUST = 150; // falling chisel dust
const CONVERGE_MS = 1050;
const DUST_MS = 1400;
const SETTLE_MS = 260; // crossfade from particles to crisp text

/**
 * InscriptionFx — drives one "chisel" crystallization at a time on a
 * dedicated canvas (the register's mid-band overlay). The host calls
 * step(now, dt) every frame; idle costs one boolean check.
 */
export default class InscriptionFx {
  /** @param {HTMLCanvasElement} canvas overlay canvas, CSS-sized by host */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d', {willReadFrequently: true});
    const cap = N_GLYPH + N_DUST;
    this.px = new Float32Array(cap);
    this.py = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.tx = new Float32Array(cap);
    this.ty = new Float32Array(cap);
    this.seed = new Float32Array(cap);
    for (let i = 0; i < cap; i += 1) this.seed[i] = Math.random();
    this.active = null;
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
  }

  fit() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(r.width * this.dpr);
    const H = Math.round(r.height * this.dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    this.w = r.width;
    this.h = r.height;
    return true;
  }

  /**
   * Begin a crystallization: `text` assembles at (x, y) from chisel
   * dust. Color is an [r,g,b] triple (theme token, read by the host).
   * onDone fires when the crisp text has fully settled.
   */
  inscribe(now, {text, x, y, font, color, onDone}) {
    if (!this.fit()) return false;
    const {xs, ys} = sampleTextPoints(
      this.off,
      this.offCtx,
      text,
      x,
      y,
      font,
      this.dpr,
      this.w,
      this.h,
    );
    if (!xs.length) {
      // Sampling failed (zero-size, odd font state): no particles —
      // the host's DOM text simply appears. Honest degradation.
      if (onDone) onDone();
      return false;
    }
    const total = xs.length;
    for (let i = 0; i < N_GLYPH; i += 1) {
      const j = (Math.random() * total) | 0;
      this.tx[i] = xs[j] + (Math.random() - 0.5) * 1.2;
      this.ty[i] = ys[j] + (Math.random() - 0.5) * 1.2;
      // Start scattered around/above the glyph line — struck stone.
      const sd = this.seed[i];
      const a = sd * Math.PI * 2;
      const rad = 14 + sd * 46;
      this.px[i] = this.tx[i] + Math.cos(a) * rad * 1.6;
      this.py[i] = this.ty[i] + Math.sin(a) * rad - 8;
      this.vx[i] = (sd - 0.5) * 30;
      this.vy[i] = -10 - sd * 22;
    }
    // Chisel dust: spawned along the glyph extents, falls and fades.
    let minX = Infinity;
    let maxX = -Infinity;
    for (let k = 0; k < total; k += 1) {
      if (xs[k] < minX) minX = xs[k];
      if (xs[k] > maxX) maxX = xs[k];
    }
    for (let i = N_GLYPH; i < N_GLYPH + N_DUST; i += 1) {
      const sd = this.seed[i];
      this.px[i] = minX + (maxX - minX) * sd;
      this.py[i] = y + (this.seed[(i * 7) % (N_GLYPH + N_DUST)] - 0.3) * 10;
      this.vx[i] = (sd - 0.5) * 34;
      this.vy[i] = 6 + sd * 26;
    }
    this.active = {born: now, text, x, y, font, color, onDone, done: false};
    return true;
  }

  get busy() {
    return Boolean(this.active);
  }

  /** Host-driven step. Returns true while drawing. */
  step(now, dt) {
    const a = this.active;
    if (!a) return false;
    const t = now - a.born;
    const {ctx} = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const [r, g, b] = a.color;

    const conv = clamp01(t / CONVERGE_MS);
    const k = 30 + 560 * easeInOut(conv);
    const damp = 2 * Math.sqrt(k) * 0.9;

    // Glyph particles: spring-converge into the sampled positions
    // (FieldEngine converge constants), fading out as the crisp text
    // crossfades in.
    const settle = clamp01((t - CONVERGE_MS) / SETTLE_MS);
    const pAlpha = (1 - settle) * 0.92;
    if (pAlpha > 0.02) {
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.8 * pAlpha).toFixed(3)})`;
      for (let i = 0; i < N_GLYPH; i += 1) {
        const ax = (this.tx[i] - this.px[i]) * k - this.vx[i] * damp;
        const ay = (this.ty[i] - this.py[i]) * k - this.vy[i] * damp;
        this.vx[i] += ax * dt;
        this.vy[i] += ay * dt;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        const sz = 1 + this.seed[i] * 0.9;
        ctx.fillRect(this.px[i] - sz / 2, this.py[i] - sz / 2, sz, sz);
      }
    }

    // Chisel dust: sand physics (gravity + lateral wobble), fading.
    const dustA = 1 - clamp01(t / DUST_MS);
    if (dustA > 0.02) {
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.4 * dustA).toFixed(3)})`;
      for (let i = N_GLYPH; i < N_GLYPH + N_DUST; i += 1) {
        const sd = this.seed[i];
        this.vy[i] += (90 + sd * 60) * dt;
        this.vx[i] += Math.sin(t * 0.004 + sd * 31) * 8 * dt;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        const sz = 0.8 + sd * 0.8;
        ctx.fillRect(this.px[i] - sz / 2, this.py[i] - sz / 2, sz, sz);
      }
    }

    // Crisp text crossfades in as particles settle.
    if (settle > 0) {
      ctx.font = a.font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.97 * settle).toFixed(3)})`;
      ctx.fillText(a.text, a.x, a.y);
    }

    if (settle >= 1 && !a.done) {
      a.done = true;
      if (a.onDone) a.onDone();
    }
    if (t > CONVERGE_MS + SETTLE_MS && dustA <= 0.02) {
      // Finished: clear the overlay (the DOM text owns the glyphs now).
      ctx.clearRect(0, 0, this.w, this.h);
      this.active = null;
      return false;
    }
    return true;
  }

  clear() {
    this.active = null;
    if (this.w && this.h) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  }
}
