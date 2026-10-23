/**
 * MorphParticles — the Morph v2 particle-dissolution layer.
 *
 * When a morph sequence ends, the outgoing fused word does not fade:
 * it dissolves into a particle field (sand-fall / mist-drift /
 * petal-flutter / ember-rise / water-flow / murmuration) and the
 * particles converge onto the incoming beat's text positions before
 * the real DOM text crossfades in. Plain canvas 2D, rAF-driven,
 * transform-feedback-free; additive blending on dark surfaces.
 *
 * Doctrine (the design log §"The Morph v2", binding):
 *   - Transition states are linked to the MEANING of the example
 *     sentence where its content supports it — semantics-linked,
 *     never ethnicity-linked. Mode selection lives in MorphStage
 *     (each sequence's `dissolve` field + aesthetic rotation);
 *     this module only executes whatever mode it is handed.
 *   - Purely decorative: the canvas is aria-hidden, no information
 *     lives only in particles, and the layer is never mounted under
 *     prefers-reduced-motion (MorphStage gates it).
 *
 * Performance contract:
 *   - 1,000–3,400 particles depending on mode (typed arrays, batched
 *     fillStyle, one getImageData per text sampling, zero per-frame
 *     allocation, zero layout reads inside the rAF loop).
 *   - Frame-time probe: if the average frame exceeds ~22ms the session
 *     is flagged weak and every later flight runs at 800 particles;
 *     a mid-flight emergency cap (>34ms avg) decimates immediately.
 *   - document.hidden ends the flight (rAF paused, beat advanced) so
 *     background tabs do zero animation work.
 *   - Colors come from the live theme tokens (vitality triad + ink +
 *     accent), re-read on data-theme flips via a MutationObserver.
 *
 * Stats for verification land on window.__MORPH_STATS.
 */

const DPR_CAP = 2;
const WEAK_COUNT = 800;
const PROBE_FRAMES = 30;
const PROBE_WEAK_MS = 22;
const PANIC_MS = 34;
const FADE_MS = 230;

/** Session-sticky weak-device flag (survives across flights, not reloads). */
let sessionDegraded = false;

export function particlesSupported() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext && c.getContext('2d'));
  } catch (e) {
    return false;
  }
}

/** Parse a token hex value to [r,g,b]; tolerate rgb() strings. */
function rgb(raw, fallback) {
  const s = (raw || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) {
    return [
      parseInt(m[1][0] + m[1][0], 16),
      parseInt(m[1][1] + m[1][1], 16),
      parseInt(m[1][2] + m[1][2], 16),
    ];
  }
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    return [
      parseInt(m[1].slice(0, 2), 16),
      parseInt(m[1].slice(2, 4), 16),
      parseInt(m[1].slice(4, 6), 16),
    ];
  }
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return fallback;
}

/**
 * Per-mode tuning. `cols` are four palette slots (particles are
 * block-assigned so fillStyle changes stay rare); counts are full-power
 * targets, scaled down on narrow stages and clamped on weak devices.
 */
const MODES = {
  sand: {count: 3200, disperse: 1000, converge: 820, cols: ['vuln', 'ink', 'vuln', 'endg']},
  mist: {count: 1600, disperse: 1120, converge: 860, cols: ['ink', 'safe', 'ink', 'ink']},
  petals: {count: 900, disperse: 1250, converge: 900, cols: ['endg', 'endg', 'vuln', 'ink']},
  embers: {count: 2300, disperse: 1080, converge: 840, cols: ['vuln', 'endg', 'vuln', 'endg']},
  water: {count: 2700, disperse: 1020, converge: 820, cols: ['safe', 'accent', 'safe', 'ink']},
  murmuration: {count: 2100, disperse: 1250, converge: 940, cols: ['ink', 'accent', 'ink', 'safe']},
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export default class MorphParticles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d', {willReadFrequently: true});
    this.raf = 0;
    this.flying = false;
    this.flightSeq = 0;
    // Typed pools, allocated once at the cap.
    const cap = Math.max(...Object.values(MODES).map((m) => m.count));
    this.px = new Float32Array(cap);
    this.py = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.tx = new Float32Array(cap);
    this.ty = new Float32Array(cap);
    this.seed = new Float32Array(cap);
    for (let i = 0; i < cap; i += 1) this.seed[i] = Math.random();

    this.readTokens();
    this.themeObs = new MutationObserver(() => this.readTokens());
    this.themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    this.onVis = () => {
      // Background tab: stop all animation work and land the beat.
      if (document.hidden && this.flying) this.finish();
    };
    document.addEventListener('visibilitychange', this.onVis);
  }

  /** Read the live theme palette (vitality triad / ink / accent). */
  readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name);
    this.dark = document.documentElement.getAttribute('data-theme') !== 'light';
    const palette = {
      ink: rgb(v('--ifm-font-color-base'), this.dark ? [232, 234, 232] : [31, 36, 33]),
      safe: rgb(v('--vital-safe'), [14, 149, 148]),
      vuln: rgb(v('--vital-vulnerable'), [201, 138, 4]),
      endg: rgb(v('--vital-endangered'), [226, 96, 107]),
      accent: rgb(v('--ifm-color-primary'), [15, 118, 110]),
    };
    // Precomputed rgba strings: palette slot × 8 alpha buckets.
    this.fills = {};
    Object.keys(palette).forEach((k) => {
      const [r, g, b] = palette[k];
      this.fills[k] = [];
      for (let a = 0; a < 8; a += 1) {
        this.fills[k].push(`rgba(${r},${g},${b},${((a + 1) / 8).toFixed(3)})`);
      }
    });
  }

  /** Size the backing store to the canvas CSS box at capped DPR. */
  fit() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = Math.round(r.width * this.dpr);
    const h = Math.round(r.height * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.w = w;
    this.h = h;
    this.cssW = r.width;
    return true;
  }

  /**
   * Lay out a multi-word phrase the way the DOM flex row renders it
   * (gap-separated, centered). Returns center-anchored runs in canvas
   * CSS-px coordinates. measureText is transform-independent, so this
   * measures in CSS px directly.
   */
  layoutPhrase(words, font, sizePx, cx, cy) {
    const ctx = this.offCtx;
    ctx.font = font;
    const gap = 0.55 * sizePx;
    const widths = words.map((wd) => ctx.measureText(wd).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
    let x = cx - total / 2;
    return words.map((wd, i) => {
      const run = {text: wd, font, cx: x + widths[i] / 2, cy};
      x += widths[i] + gap;
      return run;
    });
  }

  /**
   * Rasterize text runs and sample opaque pixels into `count` particle
   * positions (device px). Renders through the real canvas text stack,
   * so syllabics, Arabic shaping, and combining diacritics sample
   * exactly as the browser draws them.
   */
  sample(runs, count, outX, outY) {
    const ctx = this.offCtx;
    if (this.off.width !== this.w || this.off.height !== this.h) {
      this.off.width = this.w;
      this.off.height = this.h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    runs.forEach((run) => {
      ctx.font = run.font;
      ctx.fillText(run.text, run.cx, run.cy);
    });
    // Bounded read: union bbox of the runs, padded for ascenders/marks.
    const pad = 26 * this.dpr;
    let x0 = this.w;
    let x1 = 0;
    let y0 = this.h;
    let y1 = 0;
    runs.forEach((run) => {
      ctx.font = run.font;
      const m = ctx.measureText(run.text);
      const hw = (m.width / 2 + 8) * this.dpr;
      x0 = Math.min(x0, run.cx * this.dpr - hw);
      x1 = Math.max(x1, run.cx * this.dpr + hw);
      y0 = Math.min(y0, run.cy * this.dpr - pad * 1.4);
      y1 = Math.max(y1, run.cy * this.dpr + pad * 1.4);
    });
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(this.w, Math.ceil(x1));
    y1 = Math.min(this.h, Math.ceil(y1));
    if (x1 - x0 < 2 || y1 - y0 < 2) return 0;
    const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const {data, width, height} = img;
    const step = 2; // device-px sampling stride
    const candX = [];
    const candY = [];
    for (let y = 0; y < height; y += step) {
      const row = y * width;
      for (let x = 0; x < width; x += step) {
        if (data[(row + x) * 4 + 3] > 110) {
          candX.push(x0 + x);
          candY.push(y0 + y);
        }
      }
    }
    const n = candX.length;
    if (n === 0) return 0;
    for (let i = 0; i < count; i += 1) {
      const j = (Math.random() * n) | 0;
      outX[i] = candX[j] + (Math.random() - 0.5) * step * 1.5;
      outY[i] = candY[j] + (Math.random() - 0.5) * step * 1.5;
    }
    return n;
  }

  /**
   * Run one dissolution flight.
   * @param {Object} opts
   * @param {Array} opts.from   center-anchored text runs of the outgoing word
   * @param {Array} opts.to     runs of the incoming text (see layoutPhrase)
   * @param {string} opts.mode  one of MODES
   * @param {Function} opts.onArrive  fired near convergence — swap in DOM text
   * @returns {boolean} whether the flight started
   */
  play({from, to, mode, onArrive}) {
    if (!MODES[mode] || document.hidden || !this.fit()) return false;
    this.cancel(); // a still-fading previous flight must not touch the pools
    const def = MODES[mode];
    let count = sessionDegraded ? WEAK_COUNT : def.count;
    if (this.cssW < 520) count = Math.max(WEAK_COUNT, Math.round(count * 0.65));
    if (
      this.sample(from, count, this.px, this.py) === 0 ||
      this.sample(to, count, this.tx, this.ty) === 0
    ) {
      return false;
    }
    this.flightSeq += 1;
    this.mode = mode;
    this.def = def;
    this.count = count;
    this.onArrive = onArrive;
    this.arrived = false;
    this.t = 0;
    this.last = 0;
    this.stats = {frames: 0, totalMs: 0};
    const s = this.dpr;
    // Mode-specific initial velocities (device px / second).
    for (let i = 0; i < count; i += 1) {
      const sd = this.seed[i];
      const a = sd * Math.PI * 2;
      if (mode === 'sand') {
        this.vx[i] = (sd - 0.5) * 50 * s;
        this.vy[i] = -sd * 26 * s;
      } else if (mode === 'mist') {
        // radial outward drift thins the cloud fast (no additive blow-out)
        this.vx[i] = Math.cos(a) * (16 + sd * 52) * s;
        this.vy[i] = Math.sin(a) * 18 * s - (14 + sd * 34) * s;
      } else if (mode === 'petals') {
        this.vx[i] = (sd - 0.5) * 90 * s;
        this.vy[i] = (26 + sd * 58) * s;
      } else if (mode === 'embers') {
        this.vx[i] = (sd - 0.5) * 46 * s;
        this.vy[i] = -(34 + sd * 66) * s;
      } else if (mode === 'water') {
        this.vx[i] = (sd - 0.5) * 30 * s;
        this.vy[i] = (28 + sd * 58) * s;
      } else {
        // murmuration: burst outward, the flock logic regroups them
        const sp = (120 + sd * 150) * s;
        this.vx[i] = Math.cos(a) * sp;
        this.vy[i] = Math.sin(a) * sp;
      }
    }
    this.flying = true;
    const seqAtStart = this.flightSeq;
    this.raf = requestAnimationFrame((now) => this.step(now, seqAtStart));
    return true;
  }

  step(now, seqId) {
    if (!this.flying || seqId !== this.flightSeq) return;
    if (this.last) {
      const dms = now - this.last;
      this.t += Math.min(dms, 64);
      this.stats.frames += 1;
      this.stats.totalMs += dms;
      const avg = this.stats.totalMs / this.stats.frames;
      if (this.stats.frames === PROBE_FRAMES && avg > PROBE_WEAK_MS) {
        sessionDegraded = true; // later flights run at WEAK_COUNT
      }
      if (this.stats.frames >= 20 && avg > PANIC_MS && this.count > WEAK_COUNT) {
        this.count = WEAK_COUNT; // emergency decimation, this flight
      }
      this.update(Math.min(dms, 64) / 1000);
    }
    this.last = now;
    this.render();

    const total = this.def.disperse + this.def.converge;
    if (!this.arrived && this.t >= this.def.disperse + this.def.converge * 0.8) {
      this.arrived = true;
      if (this.onArrive) this.onArrive();
    }
    if (this.t >= total + FADE_MS) {
      this.finish();
      return;
    }
    this.raf = requestAnimationFrame((n) => this.step(n, seqId));
  }

  /** Physics. dt in seconds; positions/velocities in device px. */
  update(dt) {
    const {mode, count, def} = this;
    const s = this.dpr;
    const t = this.t;
    const conv = Math.min(Math.max((t - def.disperse) / def.converge, 0), 1);
    // Convergence spring ramps in; mode forces ramp out.
    const k = conv > 0 ? 28 + 600 * easeInOut(conv) : 0;
    const damp = conv > 0 ? 2 * Math.sqrt(k) * 0.92 : 0;
    const force = 1 - conv;
    // The canvas bleeds 36 CSS px past the stage; settle surfaces sit
    // just above that bleed so dunes/pools land inside the stage box.
    const floor = this.h - 30 * s;
    const pool = this.h - 42 * s;
    const cx = this.w / 2;
    const cy = this.h / 2;

    for (let i = 0; i < count; i += 1) {
      const sd = this.seed[i];
      let ax = 0;
      let ay = 0;
      if (force > 0) {
        if (mode === 'sand') {
          // gentle enough that the fall itself is visible on screen
          ay = (240 + sd * 160) * s;
          ax = Math.sin(t * 0.004 + sd * 31) * 14 * s;
        } else if (mode === 'mist') {
          ay = -26 * s;
          ax = Math.sin(t * 0.0011 + sd * 17) * 46 * s;
        } else if (mode === 'petals') {
          ay = 64 * s;
          ax = Math.cos(t * 0.0035 + sd * 23) * 150 * s;
        } else if (mode === 'embers') {
          ay = -130 * s * (0.4 + sd);
          ax = Math.sin(t * 0.005 + sd * 41) * 60 * s;
        } else if (mode === 'water') {
          ay = 240 * s;
          ax = Math.sin(sd * 13) * 8 * s;
        } else {
          // murmuration: three orbiting attractors; particles band by seed
          const band = sd < 0.34 ? 0 : sd < 0.67 ? 1 : 2;
          const ph = t * 0.0016 + band * 2.1;
          const axp = cx + Math.cos(ph) * this.w * 0.27;
          const ayp = cy + Math.sin(ph * 1.7 + band) * this.h * 0.3;
          ax = (axp - this.px[i]) * 3.2;
          ay = (ayp - this.py[i]) * 3.2;
        }
        ax *= force;
        ay *= force;
      }
      if (k > 0) {
        ax += (this.tx[i] - this.px[i]) * k - this.vx[i] * damp;
        ay += (this.ty[i] - this.py[i]) * k - this.vy[i] * damp;
      }
      this.vx[i] += ax * dt;
      this.vy[i] += ay * dt;
      if (mode === 'murmuration' && force > 0.05) {
        // clamp flock speed so it reads as birds, not shrapnel
        const sp = Math.hypot(this.vx[i], this.vy[i]) || 1;
        const max = 330 * s;
        const min = 70 * s;
        const cl = sp > max ? max / sp : sp < min ? min / sp : 1;
        this.vx[i] *= cl;
        this.vy[i] *= cl;
      }
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      if (force > 0.1) {
        if (mode === 'sand' && this.py[i] > floor) {
          // settle into a shallow dune
          this.py[i] = floor + sd * 4 * s;
          this.vy[i] *= -0.14;
          this.vx[i] *= 0.82;
        } else if (mode === 'water' && this.py[i] > pool) {
          // pooling ripple
          this.py[i] =
            pool + Math.sin(this.px[i] / (13 * s) - t * 0.011 + sd * 5) * 3.2 * s;
          this.vy[i] = 0;
          this.vx[i] += (sd - 0.5) * 36 * s * dt * 60;
          this.vx[i] *= 0.94;
        }
      }
    }
  }

  render() {
    const {ctx, mode, count, def} = this;
    const s = this.dpr;
    const t = this.t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    // Additive blending is reserved for the luminous modes (embers,
    // mist, murmuration) on dark surfaces — they should glow. Material
    // modes (sand, petals, water) stay source-over so dense overlap
    // reads as pigment, not white-out; light theme is always source-over.
    const additive =
      this.dark && (mode === 'embers' || mode === 'mist' || mode === 'murmuration');
    ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
    const conv = Math.min(Math.max((t - def.disperse) / def.converge, 0), 1);
    const u = Math.min(t / def.disperse, 1);
    const total = def.disperse + def.converge;
    // Tail crossfade: canvas hands off to the DOM text.
    const fade = t > total - 40 ? Math.max(0, 1 - (t - (total - 40)) / (FADE_MS + 40)) : 1;
    // Per-mode alpha envelope. Additive blending stacks fast, so dense
    // diffuse modes (mist) run very low per-dot alpha during dispersal;
    // every mode ramps back up at convergence so the forming text reads.
    let base = 0.8;
    if (mode === 'mist') base = 0.12 * (1 - 0.35 * u);
    else if (mode === 'sand') base = 0.42;
    else if (mode === 'water') base = 0.55;
    else if (mode === 'embers') base = 0.8 * (1 - 0.4 * u);
    let gA = base + (0.92 - base) * easeInOut(conv);
    gA *= fade;
    // Quantize alpha to one of 8 precomputed rgba buckets (batched fills).
    const bucket = Math.max(0, Math.min(7, Math.round(gA * 8) - 1));
    const block = Math.ceil(count / 4);
    let lastFill = '';
    for (let i = 0; i < count; i += 1) {
      const sd = this.seed[i];
      const fill = this.fills[def.cols[(i / block) | 0]][bucket];
      if (fill !== lastFill) {
        ctx.fillStyle = fill;
        lastFill = fill;
      }
      const x = this.px[i];
      const y = this.py[i];
      if (mode === 'petals') {
        const rot = sd * 6.28 + t * 0.004 * (sd > 0.5 ? 1 : -1);
        const rx = (3.4 + sd * 2.6) * s * (1 - conv * 0.55);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.42, rot, 0, 6.2832);
        ctx.fill();
      } else if (mode === 'mist') {
        const r = (1.1 + u * 1.3 * (1 - conv)) * s * (0.6 + sd * 0.8);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.2832);
        ctx.fill();
      } else {
        let sz = (1.5 + sd * 1.1) * s;
        if (mode === 'embers') {
          // twinkle decay via size modulation (cheaper than per-dot alpha)
          sz *= (0.55 + 0.65 * Math.abs(Math.sin(t * 0.012 * (0.5 + sd) + sd * 9))) *
            (1 - 0.35 * u * (1 - conv));
        }
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Land the flight immediately: advance the beat, clear, stop. */
  finish() {
    if (!this.flying) return;
    if (!this.arrived && this.onArrive) {
      this.arrived = true;
      this.onArrive();
    }
    this.recordStats();
    this.cancel();
  }

  recordStats() {
    if (!this.stats || !this.stats.frames) return;
    const w = typeof window !== 'undefined' ? window : null;
    if (!w) return;
    const entry = {
      mode: this.mode,
      count: this.count,
      frames: this.stats.frames,
      avgFrameMs: Number((this.stats.totalMs / this.stats.frames).toFixed(2)),
      degraded: sessionDegraded,
    };
    if (!w.__MORPH_STATS) w.__MORPH_STATS = {flights: []};
    w.__MORPH_STATS.flights.push(entry);
    if (w.__MORPH_STATS.flights.length > 12) w.__MORPH_STATS.flights.shift();
    w.__MORPH_STATS.last = entry;
  }

  /** Stop without landing (interrupted flights: steering, unmount). */
  cancel() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.flying) {
      this.flying = false;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  destroy() {
    if (this.stats && this.stats.frames) this.recordStats();
    this.cancel();
    this.themeObs.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
  }
}
