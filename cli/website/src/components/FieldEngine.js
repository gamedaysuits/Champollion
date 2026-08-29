/**
 * FieldEngine — the Translation Field's canvas scheduler (Landing v3,
 * the design log §"The Landing v3", binding).
 *
 * The homepage background IS the machine: real corpus sentences drift
 * into a transformation zone, dissolve into a particle state (the
 * Morph v2 engine's physics, cannibalized from MorphParticles.js),
 * travel, and reassemble as the REAL model output recorded for that
 * entry — with the RUN's corpus-level composite score chip attaching
 * on arrival (`runs[].composite`: the model × pair whole-corpus score,
 * design decision — composite foregrounded, never raw
 * chrF++; per-entry scores are not displayed). Content comes from
 * data/field.json (generated from in-repo harness run reports;
 * CLAIMS.md §"The Translation Field" is binding — this module renders
 * whatever it is handed and invents nothing: no composite in the data,
 * no chip).
 *
 * THE GUARDRAIL (Morph v2, unchanged): a flow's dissolution mode comes
 * from the MEANING of its sentence when the build-time keyword pass
 * found one (`m` on the flow), otherwise from an aesthetic rotation —
 * never from the language.
 *
 * Choreography (one coherent rhythm — Landing v3 doctrine 3):
 *   - ONE sentence type size, ONE meta type size, for everything.
 *   - A flow spawns every ~4.8s (jittered); 2–3 concurrent max.
 *   - Lanes avoid the center band where the hero copy is pinned.
 *   - Depth = alpha only (never size — size mixing reads as a list).
 *
 * Performance contract (same school as MorphParticles):
 *   - Single rAF loop, typed-array particle pool allocated once,
 *     batched fills (palette slots × 8 alpha buckets), one getImageData
 *     per text sampling, zero DOM reads inside the loop, DPR capped at 2.
 *   - Frame-time probe degrades concurrency/particle counts (level 1 at
 *     >24ms avg, level 2 at >34ms) and records to window.__FIELD_STATS.
 *   - document.hidden and off-screen (component IO) stop the loop dead.
 *   - prefers-reduced-motion: this module is never constructed (the
 *     component renders the static composition instead).
 */

const DPR_CAP = 2;

/** Phase durations (ms). One rhythm for every flow. */
const PH = {
  drift: 2600,
  dissolve: 1500,
  converge: 1300,
  cryst: 650,
  hold: 3100,
  exit: 750,
};
const B1 = PH.drift;
const B2 = B1 + PH.dissolve;
const B3 = B2 + PH.converge;
const B4 = B3 + PH.cryst;
const B5 = B4 + PH.hold;
const B6 = B5 + PH.exit;

/** Spawn cadence — slow, considered. */
const SPAWN_MS = 4800;
const FIRST_SPAWN_MS = 350;

/**
 * Desktop minimum aloft (design-log iteration 13, nit (b)): if the
 * field is about to read empty-ish (fewer than 2 flows), the next
 * spawn is pulled forward instead of waiting out the full cadence —
 * but never as a burst: catch-up spawns keep a hard stagger from the
 * previous spawn, and the minimum never exceeds what the perf-degrade
 * level allows (level 2 / mobile stay at 1).
 */
const MIN_CONCURRENT_DESKTOP = 2;
const MIN_STAGGER_MS = 1600;

/** Particles per flow by degrade level. */
const COUNTS = [820, 520, 340];
const MAX_CONCURRENT = [3, 2, 1];

/** Probe thresholds (avg ms/frame). */
const PROBE_FRAMES = 45;
const WEAK_MS = 24;
const PANIC_MS = 34;

/** Modes a hint-less flow rotates through (aesthetic, no claim). */
const ROTATION = ['mist', 'murmuration', 'sand', 'petals', 'embers', 'water'];

/** Palette slots per mode (4 block-assigned slots → rare fillStyle swaps). */
const MODE_COLS = {
  sand: ['vuln', 'ink', 'vuln', 'endg'],
  mist: ['ink', 'safe', 'ink', 'ink'],
  petals: ['endg', 'endg', 'vuln', 'ink'],
  embers: ['vuln', 'endg', 'vuln', 'endg'],
  water: ['safe', 'accent', 'safe', 'ink'],
  murmuration: ['ink', 'accent', 'ink', 'safe'],
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Parse a hex/rgb token to [r,g,b]. */
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

export function fieldSupported() {
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

export default class FieldEngine {
  /**
   * @param {HTMLCanvasElement} canvas full-bleed, aria-hidden
   * @param {{runs: Array, flows: Array}} data field.json payload
   */
  constructor(canvas, data) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d', {willReadFrequently: true});
    this.runs = data.runs;
    this.level = 0;
    this.running = false;
    this.raf = 0;
    this.rot = 0;
    this.flights = [];
    this.lastLane = -1;
    this.lastSpawnAt = -1; // catch-up spawns only after the first regular one
    this.frameMs = 0;
    this.frames = 0;
    this.lastNow = 0;

    // Pool sized for the strongest configuration.
    const cap = MAX_CONCURRENT[0] * COUNTS[0];
    this.px = new Float32Array(cap);
    this.py = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.tx = new Float32Array(cap);
    this.ty = new Float32Array(cap);
    this.seed = new Float32Array(cap);
    for (let i = 0; i < cap; i += 1) this.seed[i] = Math.random();
    this.slots = MAX_CONCURRENT[0]; // pool partitions
    this.slotSize = COUNTS[0];
    this.usedSlots = new Array(this.slots).fill(false);

    // Shuffled deck of flow indices — variety without repetition.
    this.deck = data.flows.map((f, i) => i);
    for (let i = this.deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this.flows = data.flows;
    this.deckPos = 0;

    this.readTokens();
    this.themeObs = new MutationObserver(() => this.readTokens());
    this.themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    this.onVis = () => {
      if (document.hidden) this.stop();
      else if (this.shouldRun) this.start();
    };
    document.addEventListener('visibilitychange', this.onVis);
    this.shouldRun = false;

    this.ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.onResize())
        : null;
    if (this.ro) this.ro.observe(canvas);
  }

  /** Read live theme tokens (vitality triad / ink / accent / secondary). */
  readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name);
    this.dark = document.documentElement.getAttribute('data-theme') !== 'light';
    const palette = {
      ink: rgb(v('--ifm-font-color-base'), this.dark ? [232, 234, 232] : [31, 36, 33]),
      sec: rgb(v('--ifm-font-color-secondary'), this.dark ? [154, 165, 160] : [91, 102, 97]),
      safe: rgb(v('--vital-safe'), [14, 149, 148]),
      vuln: rgb(v('--vital-vulnerable'), [201, 138, 4]),
      endg: rgb(v('--vital-endangered'), [226, 96, 107]),
      accent: rgb(v('--ifm-color-primary'), [15, 118, 110]),
    };
    this.pal = palette;
    this.fills = {};
    Object.keys(palette).forEach((k) => {
      const [r, g, b] = palette[k];
      this.fills[k] = [];
      for (let a = 0; a < 8; a += 1) {
        this.fills[k].push(`rgba(${r},${g},${b},${((a + 1) / 8).toFixed(3)})`);
      }
    });
    this.inkAt = (a) => `rgba(${palette.ink[0]},${palette.ink[1]},${palette.ink[2]},${a.toFixed(3)})`;
    this.secAt = (a) => `rgba(${palette.sec[0]},${palette.sec[1]},${palette.sec[2]},${a.toFixed(3)})`;
    this.accAt = (a) => `rgba(${palette.accent[0]},${palette.accent[1]},${palette.accent[2]},${a.toFixed(3)})`;
  }

  /** Fit backing store to the CSS box; work in CSS px via transform. */
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
    this.w = r.width;
    this.h = r.height;
    this.mobile = r.width < 640;
    // ONE type scale for all field text (Landing v3 doctrine 3).
    const size = this.mobile ? 16.5 : 15;
    this.fontText = `500 ${size}px "Inter Variable", Inter, "Noto Sans", system-ui, sans-serif`;
    this.fontMeta = `600 10.5px "JetBrains Mono", "Fira Code", ui-monospace, Menlo, monospace`;
    this.textPx = size;
    // The pinned hero copy ([data-field-avoid]) — flows whose lane
    // crosses it run dimmed so the copy always wins. Read here (rare,
    // resize/start only), never inside the rAF loop.
    this.avoid = null;
    const avoidEl = document.querySelector('[data-field-avoid]');
    if (avoidEl) {
      const ar = avoidEl.getBoundingClientRect();
      this.avoid = {top: ar.top - r.top, bottom: ar.bottom - r.top};
    }
    // Lanes (absolute px): two clear of the navbar up top, two at the
    // bottom clear of the legend, and — desktop only — two traversing
    // the copy band (iteration-13 nit (b): the old four lanes
    // systematically skipped the vertical middle, leaving it vacant).
    // Mid-lane flows cross [data-field-avoid], so spawn()'s existing
    // ×0.5 copy dim applies and the hero text still wins.
    const navSafe = 94;
    const t1 = Math.max(this.h * 0.115, navSafe);
    const t2 = Math.max(this.h * 0.225, t1 + 58);
    // Mobile's legend pill wraps to ~3 lines — keep the target lane
    // (with its meta line below and chip above) well clear of it.
    const b2 = this.mobile
      ? Math.min(this.h * 0.84, this.h - 118)
      : Math.min(this.h * 0.905, this.h - 72);
    const b1 = Math.min(this.h * 0.785, b2 - 58);
    const m1 = Math.max(this.h * 0.42, t2 + 58);
    const m2 = Math.min(Math.max(this.h * 0.56, m1 + 58), b1 - 58);
    // Order = round-robin allocation order: top → bottom → middle →
    // upper-top → lower-bottom → middle, so consecutive spawns spread
    // vertically instead of stacking in one half.
    this.laneYs = this.mobile ? [t1, b2] : [t1, b1, m1, t2, b2, m2];
    return true;
  }

  onResize() {
    const prevW = this.w;
    const prevH = this.h;
    if (!this.fit()) return;
    if (prevW && (Math.abs(prevW - this.w) > 2 || Math.abs(prevH - this.h) > 2)) {
      // Geometry is computed at spawn — drop in-flight flows cleanly.
      this.flights.forEach((f) => this.freeSlot(f));
      this.flights = [];
      this.nextSpawn = (this.lastNow || 0) + 500;
      if (this.ctx) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  maxConcurrent() {
    return this.mobile ? 1 : MAX_CONCURRENT[this.level];
  }

  /** Floor the field holds on desktop (≤ the degrade level's ceiling). */
  minConcurrent() {
    return this.mobile ? 1 : Math.min(MIN_CONCURRENT_DESKTOP, MAX_CONCURRENT[this.level]);
  }

  count() {
    return Math.min(COUNTS[this.level], this.slotSize);
  }

  takeSlot() {
    const i = this.usedSlots.indexOf(false);
    if (i === -1) return -1;
    this.usedSlots[i] = true;
    return i;
  }

  freeSlot(flight) {
    if (flight.slot >= 0) this.usedSlots[flight.slot] = false;
    flight.slot = -1;
  }

  start() {
    this.shouldRun = true;
    if (this.running || document.hidden) return;
    if (!this.fit()) return;
    this.running = true;
    this.lastNow = 0;
    if (this.nextSpawn == null) this.nextSpawn = -1; // set on first frame
    this.raf = requestAnimationFrame((t) => this.step(t));
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** External pause (IO off-screen): stop and remember not to resume. */
  suspend() {
    this.shouldRun = false;
    this.stop();
  }

  destroy() {
    this.stop();
    this.themeObs.disconnect();
    if (this.ro) this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
  }

  /** Next flow from the deck; reshuffle-free wraparound. */
  nextFlow() {
    if (!this.flows.length) return null;
    const flow = this.flows[this.deck[this.deckPos % this.deck.length]];
    this.deckPos += 1;
    if (this.mobile && (flow.s.length > 26 || flow.t.length > 28)) {
      // Mobile shows short flows only; try a few more, then give up
      // this tick (the next spawn picks up where the deck left off).
      for (let k = 0; k < 8; k += 1) {
        const f2 = this.flows[this.deck[this.deckPos % this.deck.length]];
        this.deckPos += 1;
        if (f2.s.length <= 26 && f2.t.length <= 28) return f2;
      }
      return null;
    }
    return flow;
  }

  spawn(now) {
    if (this.flights.length >= this.maxConcurrent()) return;
    const flow = this.nextFlow();
    if (!flow) return;
    const slot = this.takeSlot();
    if (slot === -1) return;
    const run = this.runs[flow.r];
    const mode = flow.m || ROTATION[this.rot++ % ROTATION.length];

    const ctx = this.offCtx;
    ctx.font = this.fontText;
    const srcW = ctx.measureText(flow.s).width;
    const tgtW = ctx.measureText(flow.t).width;
    ctx.font = this.fontMeta;
    // The chip is the RUN's corpus-level composite — the model × pair
    // whole-corpus score, never a per-sentence claim. If the data
    // carries no composite the chip is omitted, never invented.
    const chipText =
      typeof run.composite === 'number'
        ? `corpus composite ${run.composite.toFixed(2)}`
        : null;
    const chipW = chipText ? ctx.measureText(chipText).width + 18 : 0;

    // Lane: alternate halves so concurrent flows spread vertically.
    const lanes = this.laneYs;
    const used = new Set(this.flights.map((f) => f.laneIdx));
    let laneIdx = -1;
    for (let k = 0; k < lanes.length; k += 1) {
      const cand = (this.lastLane + 1 + k) % lanes.length;
      if (!used.has(cand)) {
        laneIdx = cand;
        break;
      }
    }
    if (laneIdx === -1) return;
    this.lastLane = laneIdx;

    let x0;
    let xZone;
    let xTgt;
    let ySrc;
    let yTgt;
    if (this.mobile) {
      // Vertical pipeline: source in the top lane, target in the bottom.
      x0 = this.w * 0.07;
      xZone = Math.min(this.w * 0.32, this.w - srcW - 16);
      xTgt = Math.max(12, Math.min(this.w * 0.1, this.w - tgtW - 16));
      ySrc = lanes[0];
      yTgt = lanes[lanes.length - 1];
    } else {
      ySrc = lanes[laneIdx];
      yTgt = ySrc;
      xTgt = Math.min(this.w * 0.58, this.w - tgtW - chipW - 36);
      x0 = this.w * 0.05;
      xZone = Math.min(this.w * 0.36, xTgt - srcW - 70);
    }

    // Depth = alpha only. Flows whose lane crosses the pinned copy run
    // extra-dim so the hero text always wins.
    let depth =
      this.flights.length === 0 ? 1 : this.flights.length === 1 ? 0.72 : 0.52;
    if (
      this.avoid &&
      ySrc > this.avoid.top - 30 &&
      ySrc < this.avoid.bottom + 14
    ) {
      depth *= 0.5;
    }

    this.flights.push({
      flow,
      run,
      mode,
      slot,
      laneIdx,
      born: now,
      depth,
      x0,
      xZone,
      xTgt,
      ySrc,
      yTgt,
      srcW,
      tgtW,
      chipW,
      sampled: false,
      particlesOk: false,
      modelShort: String(run.model).split('/').pop(),
      chipText,
    });
  }

  /**
   * Rasterize a single text run and fill a pool slice with sampled
   * positions (CSS px). Returns candidate count.
   */
  sample(text, x, y, outX, outY, base, n) {
    const ctx = this.offCtx;
    const dpr = this.dpr;
    const w = Math.round(this.w * dpr);
    const h = Math.round(this.h * dpr);
    if (this.off.width !== w || this.off.height !== h) {
      this.off.width = w;
      this.off.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = this.fontText;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    const m = ctx.measureText(text);
    const pad = 18;
    const x0 = Math.max(0, Math.floor((x - 6) * dpr));
    const x1 = Math.min(w, Math.ceil((x + m.width + 6) * dpr));
    const y0 = Math.max(0, Math.floor((y - pad) * dpr));
    const y1 = Math.min(h, Math.ceil((y + pad) * dpr));
    if (x1 - x0 < 2 || y1 - y0 < 2) return 0;
    const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const {data, width, height} = img;
    const step = Math.max(1, Math.round(dpr));
    const candX = [];
    const candY = [];
    for (let yy = 0; yy < height; yy += step) {
      const row = yy * width;
      for (let xx = 0; xx < width; xx += step) {
        if (data[(row + xx) * 4 + 3] > 110) {
          candX.push((x0 + xx) / dpr);
          candY.push((y0 + yy) / dpr);
        }
      }
    }
    const total = candX.length;
    if (!total) return 0;
    for (let i = 0; i < n; i += 1) {
      const j = (Math.random() * total) | 0;
      outX[base + i] = candX[j] + (Math.random() - 0.5) * 1.4;
      outY[base + i] = candY[j] + (Math.random() - 0.5) * 1.4;
    }
    return total;
  }

  /** Source dissolves where it stands; targets are the incoming word. */
  samplePair(f) {
    f.sampled = true;
    const n = this.count();
    const base = f.slot * this.slotSize;
    f.base = base;
    f.n = n;
    const okFrom = this.sample(f.flow.s, f.xZone, f.ySrc, this.px, this.py, base, n);
    const okTo = this.sample(f.flow.t, f.xTgt, f.yTgt, this.tx, this.ty, base, n);
    if (!okFrom || !okTo) return; // graceful: text crossfade only
    f.particlesOk = true;
    const s = 1; // CSS px space
    for (let k = 0; k < n; k += 1) {
      const i = base + k;
      const sd = this.seed[i];
      const a = sd * Math.PI * 2;
      if (f.mode === 'sand') {
        this.vx[i] = (sd - 0.5) * 26 * s;
        this.vy[i] = -sd * 13 * s;
      } else if (f.mode === 'mist') {
        this.vx[i] = Math.cos(a) * (8 + sd * 26) * s;
        this.vy[i] = Math.sin(a) * 9 * s - (7 + sd * 17) * s;
      } else if (f.mode === 'petals') {
        this.vx[i] = (sd - 0.5) * 46 * s;
        this.vy[i] = (13 + sd * 29) * s;
      } else if (f.mode === 'embers') {
        this.vx[i] = (sd - 0.5) * 24 * s;
        this.vy[i] = -(17 + sd * 33) * s;
      } else if (f.mode === 'water') {
        this.vx[i] = (sd - 0.5) * 15 * s;
        this.vy[i] = (14 + sd * 29) * s;
      } else {
        const sp = (60 + sd * 76) * s;
        this.vx[i] = Math.cos(a) * sp;
        this.vy[i] = Math.sin(a) * sp;
      }
    }
  }

  /** Physics for one flight's slice. dt seconds, t ms into dissolve. */
  updateParticles(f, dt, tMs) {
    const {mode, base, n} = f;
    const t = tMs;
    const conv = clamp01((t - PH.dissolve) / PH.converge);
    const k = conv > 0 ? 26 + 540 * easeInOut(conv) : 0;
    const damp = conv > 0 ? 2 * Math.sqrt(k) * 0.92 : 0;
    const force = 1 - conv;
    // Gentle advection carries the cloud toward the target — the
    // "travel" of the pipeline (scaled down near convergence).
    const drift = ((f.xTgt - f.xZone) / ((PH.dissolve + PH.converge) / 1000)) * 0.9;
    const driftY = this.mobile
      ? ((f.yTgt - f.ySrc) / ((PH.dissolve + PH.converge) / 1000)) * 0.9
      : 0;
    const floor = f.ySrc + 34;

    for (let idx = 0; idx < n; idx += 1) {
      const i = base + idx;
      const sd = this.seed[i];
      let ax = 0;
      let ay = 0;
      if (force > 0) {
        if (mode === 'sand') {
          ay = (95 + sd * 70) * 1;
          ax = Math.sin(t * 0.004 + sd * 31) * 8;
        } else if (mode === 'mist') {
          ay = -14;
          ax = Math.sin(t * 0.0011 + sd * 17) * 24;
        } else if (mode === 'petals') {
          ay = 30;
          ax = Math.cos(t * 0.0035 + sd * 23) * 70;
        } else if (mode === 'embers') {
          ay = -62 * (0.4 + sd);
          ax = Math.sin(t * 0.005 + sd * 41) * 30;
        } else if (mode === 'water') {
          ay = 105;
          ax = Math.sin(sd * 13) * 5;
        } else {
          // murmuration: orbiting attractors between zone and target
          const band = sd < 0.34 ? 0 : sd < 0.67 ? 1 : 2;
          const ph = t * 0.0016 + band * 2.1;
          const axp = (f.xZone + f.xTgt) / 2 + Math.cos(ph) * (f.xTgt - f.xZone) * 0.4;
          const ayp = (f.ySrc + f.yTgt) / 2 + Math.sin(ph * 1.7 + band) * 42;
          ax = (axp - this.px[i]) * 3.0;
          ay = (ayp - this.py[i]) * 3.0;
        }
        ax = ax * force + drift * 0.55 * force;
        ay = ay * force + driftY * 0.55 * force;
      }
      if (k > 0) {
        ax += (this.tx[i] - this.px[i]) * k - this.vx[i] * damp;
        ay += (this.ty[i] - this.py[i]) * k - this.vy[i] * damp;
      }
      this.vx[i] += ax * dt;
      this.vy[i] += ay * dt;
      if (mode === 'murmuration' && force > 0.05) {
        const sp = Math.hypot(this.vx[i], this.vy[i]) || 1;
        const max = 165;
        const min = 36;
        const cl = sp > max ? max / sp : sp < min ? min / sp : 1;
        this.vx[i] *= cl;
        this.vy[i] *= cl;
      }
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      if (force > 0.1 && !this.mobile) {
        if (mode === 'sand' && this.py[i] > floor) {
          this.py[i] = floor + sd * 3;
          this.vy[i] *= -0.14;
          this.vx[i] *= 0.82;
        } else if (mode === 'water' && this.py[i] > floor) {
          this.py[i] = floor + Math.sin(this.px[i] / 11 - t * 0.011 + sd * 5) * 2.4;
          this.vy[i] = 0;
          this.vx[i] += (sd - 0.5) * 18 * dt * 60;
          this.vx[i] *= 0.94;
        }
      }
    }
  }

  drawParticles(f, tMs, globalAlpha) {
    const {ctx} = this;
    const {mode, base, n} = f;
    const t = tMs;
    const conv = clamp01((t - PH.dissolve) / PH.converge);
    const u = clamp01(t / PH.dissolve);
    const additive =
      this.dark && (mode === 'embers' || mode === 'mist' || mode === 'murmuration');
    ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
    let baseA = 0.8;
    if (mode === 'mist') baseA = 0.2 * (1 - 0.3 * u);
    else if (mode === 'sand') baseA = 0.5;
    else if (mode === 'water') baseA = 0.6;
    else if (mode === 'embers') baseA = 0.8 * (1 - 0.35 * u);
    let gA = (baseA + (0.95 - baseA) * easeInOut(conv)) * globalAlpha;
    const bucket = Math.max(0, Math.min(7, Math.round(gA * 8) - 1));
    const cols = MODE_COLS[mode];
    const block = Math.ceil(n / 4);
    let lastFill = '';
    for (let idx = 0; idx < n; idx += 1) {
      const i = base + idx;
      const sd = this.seed[i];
      const fill = this.fills[cols[(idx / block) | 0]][bucket];
      if (fill !== lastFill) {
        ctx.fillStyle = fill;
        lastFill = fill;
      }
      const x = this.px[i];
      const y = this.py[i];
      if (mode === 'petals') {
        const rot2 = sd * 6.28 + t * 0.004 * (sd > 0.5 ? 1 : -1);
        const rx = (2.1 + sd * 1.6) * (1 - conv * 0.55);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.42, rot2, 0, 6.2832);
        ctx.fill();
      } else if (mode === 'mist') {
        const r = (0.9 + u * 1.0 * (1 - conv)) * (0.6 + sd * 0.8);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.2832);
        ctx.fill();
      } else {
        let sz = 1.1 + sd * 0.9;
        if (mode === 'embers') {
          sz *= (0.55 + 0.65 * Math.abs(Math.sin(t * 0.012 * (0.5 + sd) + sd * 9))) *
            (1 - 0.35 * u * (1 - conv));
        }
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Rounded-rect chip (manual path — Safari<16 lacks roundRect). */
  chipPath(x, y, w, h, r) {
    const {ctx} = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  drawFlight(f, now) {
    const {ctx} = this;
    const t = now - f.born;
    const exitA = t > B5 ? 1 - clamp01((t - B5) / PH.exit) : 1;
    const depth = f.depth * exitA;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (t < B2) {
      // Source text drifting toward the zone (visible through dissolve
      // start at decreasing alpha while particles take over).
      const driftP = clamp01(t / PH.drift);
      const x = f.x0 + (f.xZone - f.x0) * easeOut(driftP);
      const inA = clamp01(t / 600);
      const dissolveA = t > B1 ? 1 - clamp01((t - B1) / 480) : 1;
      const a = inA * dissolveA * 0.92 * depth;
      if (a > 0.01) {
        ctx.font = this.fontText;
        ctx.fillStyle = this.inkAt(a);
        ctx.fillText(f.flow.s, x, f.ySrc);
        ctx.font = this.fontMeta;
        const metaA = clamp01((t - 350) / 550) * dissolveA * 0.74 * depth;
        if (metaA > 0.01) {
          ctx.fillStyle = this.secAt(metaA);
          ctx.fillText(`${f.run.pair} · TATOEBA`, x + 1, f.ySrc + this.textPx * 1.15);
        }
      }
    }

    if (t >= B1 && t < B3 + 220 && f.particlesOk) {
      const pA = t > B3 ? 1 - clamp01((t - B3) / 220) : 1;
      this.drawParticles(f, t - B1, pA * depth);
    }

    if (t >= B3 - 160) {
      // Crystallized target: model output + meta + the run's
      // corpus-composite chip.
      const cA = clamp01((t - (B3 - 160)) / PH.cryst) * depth;
      if (cA > 0.01) {
        ctx.font = this.fontText;
        ctx.fillStyle = this.inkAt(0.97 * cA);
        ctx.fillText(f.flow.t, f.xTgt, f.yTgt);
        ctx.font = this.fontMeta;
        ctx.fillStyle = this.secAt(0.74 * cA);
        ctx.fillText(
          `${f.modelShort} · MODEL OUTPUT`,
          f.xTgt + 1,
          f.yTgt + this.textPx * 1.15,
        );
        // Chip pops shortly after the text lands.
        const chipP = clamp01((t - (B3 + 200)) / 380);
        if (f.chipText && chipP > 0) {
          const pop = 0.82 + 0.18 * (1 + 1.9 * (1 - chipP)) * easeOut(chipP) ** 1.2;
          const scale = Math.min(pop, 1.04 - 0.04 * chipP);
          const chipH = 19;
          const cx = this.mobile ? f.xTgt : f.xTgt + f.tgtW + 12;
          const cy = this.mobile
            ? f.yTgt - this.textPx * 1.6 - chipH / 2
            : f.yTgt;
          const a2 = chipP * cA;
          ctx.save();
          ctx.translate(cx + f.chipW / 2, cy);
          ctx.scale(scale, scale);
          this.chipPath(-f.chipW / 2, -chipH / 2, f.chipW, chipH, 6);
          ctx.fillStyle = this.accAt(0.13 * a2);
          ctx.fill();
          ctx.strokeStyle = this.accAt(0.55 * a2);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.font = this.fontMeta;
          ctx.textAlign = 'center';
          ctx.fillStyle = this.accAt(0.96 * a2);
          ctx.fillText(f.chipText, 0, 0.5);
          ctx.restore();
          ctx.textAlign = 'left';
        }
      }
    }
  }

  step(now) {
    if (!this.running) return;
    if (this.lastNow) {
      const dms = now - this.lastNow;
      this.frames += 1;
      this.frameMs += dms;
      if (this.frames === PROBE_FRAMES) {
        const avg = this.frameMs / this.frames;
        if (avg > PANIC_MS) this.level = 2;
        else if (avg > WEAK_MS) this.level = Math.max(this.level, 1);
        if (typeof window !== 'undefined') {
          window.__FIELD_STATS = {
            avgFrameMs: Number(avg.toFixed(2)),
            frames: this.frames,
            level: this.level,
            concurrent: this.flights.length,
          };
        }
        this.frames = 0;
        this.frameMs = 0;
      }
      const dt = Math.min(dms, 64) / 1000;
      for (const f of this.flights) {
        const t = now - f.born;
        if (t >= B1 && !f.sampled) this.samplePair(f);
        if (t >= B1 && t < B3 && f.particlesOk) {
          this.updateParticles(f, dt, t - B1);
        }
      }
    }
    this.lastNow = now;

    if (this.nextSpawn === -1) this.nextSpawn = now + FIRST_SPAWN_MS;
    // Catch-up spawn (min-concurrency floor): pull the next flow
    // forward when the field is under its desktop minimum — staggered
    // (≥ MIN_STAGGER_MS since the last spawn), never a same-frame burst,
    // and only once the first regular spawn has happened.
    const catchUp =
      this.flights.length < this.minConcurrent() &&
      this.lastSpawnAt >= 0 &&
      now - this.lastSpawnAt >= MIN_STAGGER_MS;
    if (now >= this.nextSpawn || catchUp) {
      this.spawn(now);
      this.lastSpawnAt = now;
      this.nextSpawn = now + SPAWN_MS * (0.8 + Math.random() * 0.55);
    }

    // Retire finished flights.
    for (let i = this.flights.length - 1; i >= 0; i -= 1) {
      if (now - this.flights[i].born >= B6) {
        this.freeSlot(this.flights[i]);
        this.flights.splice(i, 1);
      }
    }

    const {ctx} = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    for (const f of this.flights) this.drawFlight(f, now);

    this.raf = requestAnimationFrame((t) => this.step(t));
  }
}
