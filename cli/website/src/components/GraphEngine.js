/**
 * GraphEngine — THE TRANSLATION NETWORK renderer (lab stage,
 * src/pages/graph-lab.js; revised concept: packet-transfer
 * network, NOT a lattice/sphere).
 *
 * Every catalogued language is a node in a living mesh (positions
 * precomputed by plugins/shared-data/generateGraphJson.js — build-time
 * force layout, families as organic neighborhoods). Benchmarked
 * languages are lit routers; queued languages half-glow; the dark mass
 * is the work remaining — drawn dim but VISIBLE, a constellation of
 * potential. Real translation packets (the same real sentences/runs as
 * data/field.json) travel curved routes between REAL pair endpoints
 * with light trails.
 *
 * Architecture: two stacked Canvas 2D layers.
 *   - base: all dark/queued nodes + zoom labels. Redrawn only when the
 *     camera/theme/coverage changes (dirty flag) — idle frames never
 *     touch the 7,927-node draw.
 *   - fx: lit routers (breathing), packets + trails, landing pulses,
 *     hover/focus rings. Redrawn every frame (tens of sprites, cheap).
 *
 * Performance contract (FieldEngine school):
 *   - Single rAF loop; typed arrays decoded once; pre-rendered glow
 *     sprites (drawImage, no per-node gradients); zero DOM reads in the
 *     loop; DPR ≤ 2; frame probe degrades (level 1 >24ms, level 2
 *     >34ms) and records to window.__GRAPH_STATS; document.hidden and
 *     off-screen stop the loop dead (host IO calls suspend()).
 *   - prefers-reduced-motion: this module is never constructed (the
 *     host renders the SSR poster instead).
 *
 * Truthfulness: renders only what graph.json/field.json hand it.
 * Node brightness is strictly method COVERAGE (recomputed client-side
 * from the per-node mask — all methods off = a dark field); packets fly
 * only active methods' edges and route THROUGH the method's hub (or
 * shuttle hub↔language for per-pair providers). The at-risk ember tint
 * is the Glottolog-AES tier already carried per node. Names everywhere —
 * tooltips give language NAME + endonym, never a bare ISO code.
 */

import {
  SERVICE_COLORS,
  COMMERCIAL_MASK,
  coverageTier,
} from '../utils/pairReachability';
import {VITALITY_LEVELS} from '../utils/vitalityScale';

const DPR_CAP = 2;

/** Packet cadence/concurrency.
 * Steady-state concurrency ≈ meanLifetime / meanSpawnInterval:
 * lifetime ≈ dur·1.25 ≈ 5.9s, interval = PACKET_MS·1.05 ≈ 294ms → ≈20
 * concurrent on desktop level 0 ("routes currently up", founder directive
 * 2026-07-17). MAX_PACKETS caps just above steady state per degrade level. */
const PACKET_MS = 280;
const FIRST_PACKET_MS = 900;
const MAX_PACKETS = [24, 12, 6]; // concurrent packets by degrade level
const PACKET_FLIGHT_MS = 4400;
const TRAIL_N = 26;

/** Probe thresholds (avg ms/frame), FieldEngine constants. */
const PROBE_FRAMES = 45;
const WEAK_MS = 24;
const PANIC_MS = 34;

/** Parallax buckets (depth via subtle layers, NOT 3D). */
const PF = [0.94, 1, 1.06];

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Parse a hex/rgb token to [r,g,b] (FieldEngine.rgb). */
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

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

export function graphSupported() {
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

export default class GraphEngine {
  /**
   * @param {object} o
   * @param {HTMLCanvasElement} o.base   node layer
   * @param {HTMLCanvasElement} o.fx     packet/interaction layer (on top)
   * @param {object} o.graph  data/graph.json payload
   * @param {object} o.field  data/field.json payload (flow sentences)
   * @param {function} [o.onHover]  (info|null) info: {code,name,endonym,family,state,vitality,x,y}
   * @param {function} [o.onSelect] (info) click on a node
   * @param {function} [o.onArcHover]  ({idx,x,y}|null) pointer over a
   *   measured arc (idx into the setMeasuredArcs array; x/y = projected
   *   curve midpoint). Nodes win over arcs.
   * @param {function} [o.onArcSelect] ({idx,x,y}) click on a measured arc
   * @param {function} [o.onPacket] (packetInfo) packet departs
   * @param {function} [o.onLand]   (packetInfo) packet arrives
   * @param {function} [o.onFirstFrame] fired once, after the first full
   *   frame has actually painted — the host crossfades the SSR poster out
   *   on this signal, never on construction (fetch + IO gating mean
   *   construction can precede the first paint by seconds).
   */
  constructor(o) {
    this.base = o.base;
    this.fx = o.fx;
    this.bctx = this.base.getContext('2d');
    this.fctx = this.fx.getContext('2d');
    this.onHover = o.onHover || null;
    this.onSelect = o.onSelect || null;
    this.onArcHover = o.onArcHover || null;
    this.onArcSelect = o.onArcSelect || null;
    this.hoverArcIdx = -1;
    this.onPacket = o.onPacket || null;
    this.onFirstFrame = o.onFirstFrame || null;
    this.firstFrameDone = false;
    // When interactive is false the mesh is ambient-only: no pan, zoom,
    // or drag — scroll events pass through to the page. Hover tooltips
    // and click-to-select still work. Default true for the /mesh page;
    // the homepage sets false so the hero doesn't trap scroll.
    this.interactive = o.interactive !== false;
    // Display mode (founder 2026-07-19): 'binary' is the marketing hero —
    // ONE story, covered (green, white-hot core) vs uncovered living
    // languages (red, no core), amplified illustrative packets, NOTHING
    // else (no hubs/spokes/arcs/labels). 'mesh' is the full data view
    // behind "View the live map". Default 'mesh' preserves legacy callers.
    this.displayMode = o.displayMode === 'binary' ? 'binary' : 'mesh';
    this.onLand = o.onLand || null;
    /* THEME OVERRIDE (2026-08-19). The homepage seam is authored in ink —
     * every caption, instrument and backdrop is a hardcoded dark value — so a
     * light-theme visitor got a grey map under a dark play. It commits to
     * dark. But it must NOT do that by writing data-theme on <html>: that is
     * Docusaurus's own attribute, and rewriting it would fight the navbar
     * toggle and desync the rest of the site. Instead the host passes
     * forceDark plus a tokenRoot — an element carrying the dark custom
     * properties — and readTokens() resolves against that. The data-theme
     * MutationObserver below stays correct either way. */
    this.forceDark = o.forceDark === true;
    this.tokenRoot = o.tokenRoot || document.documentElement;
    /* The endangerment ember layer (uncovered at-risk languages glowing warm)
     * is on by default — it is the loss story, and the hero is where that
     * argument belongs. A host answering a DIFFERENT question can turn it off:
     * on /tested the warm field competes with the quality spectrum, where
     * orange and amber are score bands, so a warm node and a warm edge would
     * be two unrelated claims in one colour. Off, nodes fall through to the
     * family-tinted dark sprite — land, not data. */
    this.emberLayer = o.emberLayer !== false;

    // ---- decode columnar payload into typed arrays -------------------
    const g = o.graph;
    this.world = g.world;
    this.n = g.n;
    this.codes = g.cols.code.split(',');
    this.names = g.cols.name;
    this.endo = g.cols.endo; // sparse {idx: endonym}
    // Layout (v18): 'family' = the organic family blobs (cols.x/y, the default
    // for the hero + live map); 'geo' = a rough world-map projection
    // (cols.gx/gy). Both are kept so setLayout(t) can morph between them.
    // Everything downstream reads the ACTIVE this.xs/this.ys.
    this.layout = o.layout === 'geo' ? 'geo' : 'family';
    this.famX = Float32Array.from(g.cols.x);
    this.famY = Float32Array.from(g.cols.y);
    this.hasGeo =
      Array.isArray(g.cols.gx) && Array.isArray(g.cols.gy) && g.cols.gx.length === this.n;
    this.geoX = this.hasGeo ? Float32Array.from(g.cols.gx) : this.famX;
    this.geoY = this.hasGeo ? Float32Array.from(g.cols.gy) : this.famY;
    const useGeo = this.layout === 'geo' && this.hasGeo;
    this.xs = Float32Array.from(useGeo ? this.geoX : this.famX);
    this.ys = Float32Array.from(useGeo ? this.geoY : this.famY);
    /* PARALLAX vs GEOGRAPHY (2026-08-19). Depth parallax was designed for the
     * family-blob layout, where a node's position is already an abstraction and
     * a 6% depth spread costs nothing true. On the GEO layout it is a
     * misstatement: it slides a language off its own coordinates by
     * PF-difference x distance-from-centre, which at the frame edge is tens of
     * pixels. It also desynced every seam overlay, which anchors nodes at a
     * fixed layer 2 — an uncovered language's edge, packet landing and endpoint
     * dot all missed the dot they were supposed to light. Geographic positions
     * are therefore projected FLAT; `layer` still carries the tonal depth band
     * (layerA alpha + draw batching), so the field keeps its starfield depth. */
    this.flatParallax = useGeo;
    this.fam = Uint16Array.from(g.cols.fam);
    this.famNames = g.families.map((f) => f[0]);
    this.famHue = Uint8Array.from(g.families.map((f) => f[1]));
    this.v = new Uint8Array(this.n);
    this.q = new Uint8Array(this.n);
    this.st = new Uint8Array(this.n);
    // Per-node method-coverage bitmask (google1 ms2 deepl4 libre8 nllb16
    // opus32 tilde64 m2m100·256 madlad·512). Uint16: bits above 128 exist
    // since the small-open-models import (v13) — a Uint8 view silently
    // truncated them.
    this.mask = g.cols.m ? Uint16Array.from(g.cols.m) : new Uint16Array(this.n);
    // Living flag (v15) — the binary hero draws living languages only.
    // Stale payloads without the column treat every node as living.
    this.liv = g.cols.liv
      ? Uint8Array.from(g.cols.liv)
      : new Uint8Array(this.n).fill(1);
    // Brightness is strictly COVERAGE (founder decision 2026-07-17): st is
    // recomputed from the mask CLIENT-SIDE — never trusted from the packed
    // payload — so a stale artifact (whose st still baked benchmarked→lit)
    // can never light a node no method covers.
    let litBase = 0;
    for (let i = 0; i < this.n; i += 1) {
      const p = g.cols.p[i];
      this.v[i] = (p / 15) | 0;
      this.q[i] = ((p / 3) | 0) % 5;
      this.st[i] = this.mask[i] !== 0 ? 2 : 0;
      if (this.st[i] === 2) litBase += 1;
    }
    // All method bits on by default (the union view). Derived from the
    // shipped methods legend so a new provider bit (tilde=64, later
    // translated=128) extends automatically; the literal covers legacy
    // payloads without `methods`.
    this.ALL_METHODS =
      Array.isArray(g.methods) && g.methods.length
        ? g.methods.reduce((acc, m) => acc | m.bit, 0)
        : 1 | 2 | 4 | 8 | 16 | 32 | 64;
    this.activeMethods = this.ALL_METHODS;
    this.seed = new Float32Array(this.n);
    this.layer = new Uint8Array(this.n);
    for (let i = 0; i < this.n; i += 1) {
      const s = hash32(this.codes[i]) / 4294967296;
      this.seed[i] = s;
      // Lit/queued nodes ride the front band; dark mass spreads across three
      // depth bands. The band drives TONE (layerA alpha) always, and parallax
      // position only on the family layout — see `flatParallax`.
      this.layer[i] = this.st[i] > 0 ? 2 : s < 0.38 ? 0 : s < 0.76 ? 1 : 2;
    }
    this.idxByCode = new Map(this.codes.map((c, i) => [c, i]));
    this.alias = g.alias || {};

    // ---- service hubs (Layer S) --------------------------------------
    // One labeled hub node per provider; spokes fan out to EVERY language
    // it covers, coloured per service ("paths coded by coverage method").
    // Drawing 200 spokes into one hub instead of 200² pair lines is what
    // keeps full coverage legible (founder design, 2026-07-15). Clicking
    // a hub toggles its layer — same mask the method chips drive.
    this.onMethodsChange = o.onMethodsChange || null;
    // When provided, a hub tap opens the service card (onHubSelect) instead
    // of blind-toggling the layer — the card carries the toggle plus the
    // service's nature/license/links (founder directive 2026-07-19).
    this.onHubSelect = o.onHubSelect || null;
    this.hubs = [];
    if (Array.isArray(g.methods)) {
      const active = g.methods.filter((m) => m.count > 0);
      // Ellipse in the field's dark margins, inside the opening frame.
      const cx = this.world / 2;
      const cy = this.world / 2;
      const rx = this.world * 0.47;
      const ry = this.world * 0.36;
      active.forEach((m, i) => {
        // Half-step offset: no hub sits at top-center, where the ambient
        // hero's copy overlay would swallow its label.
        const ang = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / active.length;
        const spokes = [];
        for (let n = 0; n < this.n; n += 1) {
          if (this.mask[n] & m.bit) spokes.push(n);
        }
        this.hubs.push({
          key: m.key,
          bit: m.bit,
          label: m.label,
          count: m.count,
          // 'service' (deployable API) vs 'open' (research models) — shown
          // on the hub sub-label so the tier qualification lives on the map.
          tier: m.tier || null,
          anyToAny: m.anyToAny !== false,
          // Service-card metadata (nature/license/links) rides the legend
          // straight from the coverage catalogue; null when unstated.
          source_url: m.source_url || null,
          asOf: m.asOf || null,
          homepage: m.homepage || null,
          license: m.license || null,
          nature: m.nature || null,
          color: SERVICE_COLORS[m.key] || '#8b95a7',
          x: cx + rx * Math.cos(ang),
          y: cy + ry * Math.sin(ang),
          spokes,
        });
      });
    }
    this.hubByBit = new Map(this.hubs.map((hb) => [hb.bit, hb]));
    // Endangerment ember layer: uncovered nodes at any at-risk AES level
    // (shifting/endangered/critical/dormant) tint warm by default — the
    // loss story on the map itself. setVitalityHighlight(levels) boosts a
    // chosen set of levels (the explorer); null = no highlight.
    this.vitHighlight = null;
    // Packets travel INTERTRANSLATABLE pairs — the per-method hub-and-spoke
    // edges (methodEdges: [si, ti, methodBit]). These have no run/flow data, so
    // they fly as geometric pulses. Fall back to field routes (real benchmarked
    // runs, with sentences) only if methodEdges are absent.
    this.methodEdges = g.methodEdges || [];
    this.geometricPackets = this.methodEdges.length > 0;
    this.routes = this.geometricPackets ? this.methodEdges : g.routes;
    this.runs = o.field.runs;
    this.flowsByRun = this.runs.map(() => []);
    for (const f of o.field.flows) {
      if (this.flowsByRun[f.r]) this.flowsByRun[f.r].push(f);
    }
    // Counted, never trusted from the payload (stale artifacts may still
    // bake benchmarked-only nodes as lit).
    this.litCount = litBase;
    // Lit-hub centroid: the initial camera favors the active region so
    // packet routes play in frame at the opening zoom.
    let lcx = 0;
    let lcy = 0;
    let lc = 0;
    for (let i = 0; i < this.n; i += 1) {
      if (this.st[i] === 2) {
        lcx += this.xs[i];
        lcy += this.ys[i];
        lc += 1;
      }
    }
    this.litCx = lc ? lcx / lc : this.world / 2;
    this.litCy = lc ? lcy / lc : this.world / 2;

    // Visible subset (mobile samples the mesh; desktop draws all).
    this.drawList = null; // computed in fit()

    // ---- interaction state -------------------------------------------
    this.cam = {x: this.world / 2, y: this.world / 2, z: 1};
    this.zFit = 1;
    this.drag = null;
    this.velX = 0;
    this.velY = 0;
    this.pointers = new Map();
    this.pinch = null;
    this.hoverIdx = -1;
    this.focus = null; // {idx, until} search-lift ring
    this.camAnim = null;

    // ---- packets -------------------------------------------------------
    this.packets = [];
    this.pulses = [];
    // Measured-pair arcs (the strength layer): [{si,ti,color,alpha,width,dash}].
    this.measuredArcs = [];
    this.measuredSet = new Set();
    // Ambient arcs — the persistent UNMEASURED network (registered queue
    // pairs classified by reachability). Grouped by shared style so each
    // group strokes as ONE batched path: [{color,alpha,width,pairs:[si,ti,...]}].
    this.ambientArcGroups = [];
    // activeRoutes: the subset of routes confirmed by the live leaderboard.
    // Defaults to all routes (build baseline); gateLiveRoutes() narrows it
    // once the Supabase query resolves. spawnPacket reads activeRoutes,
    // NOT this.routes, so packets only fly on verified pairs.
    this.activeRoutes = this.routes;
    this.routeDeck = this.activeRoutes.map((_, i) => i);
    for (let i = this.routeDeck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.routeDeck[i], this.routeDeck[j]] = [this.routeDeck[j], this.routeDeck[i]];
    }
    this.routePos = 0;
    this.flowPos = this.runs.map(() => 0);
    this.nextPacket = -1;

    // ---- loop state ----------------------------------------------------
    this.level = 0;
    this.running = false;
    this.shouldRun = false;
    this.raf = 0;
    this.lastNow = 0;
    this.frames = 0;
    this.frameMs = 0;
    this.dirty = true;
    this.aux = []; // host-registered steppers (inscription fx)

    this.readTokens();
    this.themeObs = new MutationObserver(() => {
      this.readTokens();
      this.dirty = true;
    });
    this.themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    this.onVis = () => {
      if (document.hidden) this.stop();
      else if (this.shouldRun) this.start();
    };
    document.addEventListener('visibilitychange', this.onVis);
    this.ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (this.fit()) this.dirty = true;
          })
        : null;
    if (this.ro) this.ro.observe(this.fx);

    // Only bind pan/zoom/drag when interactive; always bind hover/click.
    if (this.interactive) {
      this.bindPointer();
    } else {
      this.bindPassivePointer();
    }
  }

  // ---------------------------------------------------------------- theme
  readTokens() {
    // tokenRoot lets a host scope a palette to its own subtree — see forceDark.
    const cs = getComputedStyle(this.tokenRoot || document.documentElement);
    const v = (name) => cs.getPropertyValue(name);
    this.dark = this.forceDark
      ? true
      : document.documentElement.getAttribute('data-theme') !== 'light';
    const ink = rgb(v('--ifm-font-color-base'), this.dark ? [232, 234, 232] : [31, 36, 33]);
    const sec = rgb(v('--ifm-font-color-secondary'), this.dark ? [154, 165, 160] : [91, 102, 97]);
    const safe = rgb(v('--vital-safe'), this.dark ? [63, 193, 192] : [14, 149, 148]);
    const vuln = rgb(v('--vital-vulnerable'), this.dark ? [232, 179, 57] : [201, 138, 4]);
    const endg = rgb(v('--vital-endangered'), this.dark ? [240, 138, 147] : [226, 96, 107]);
    const accent = rgb(v('--ifm-color-primary'), this.dark ? [63, 193, 192] : [15, 118, 110]);
    this.pal = {ink, sec, safe, vuln, endg, accent};
    // Family "color whisper": six hue buckets interpolated around the
    // vitality triad, mixed well toward ink so family neighborhoods read
    // as tints, never as vitality data (DESIGN.md §2 triad rule).
    const hues = [
      safe,
      mix(safe, vuln, 0.5),
      vuln,
      mix(vuln, endg, 0.5),
      endg,
      mix(endg, safe, 0.5),
    ];
    const whisper = this.dark ? 0.33 : 0.5;
    this.hueCols = hues.map((h) => mix(ink, h, whisper));
    // Lit router glow: warm city light on dark; deep accent on paper.
    this.litCore = this.dark ? [255, 240, 205] : accent;
    this.litHalo = this.dark ? vuln : accent;
    this.packetCol = this.dark ? [255, 244, 214] : accent;
    this.buildSprites();
    this.inkAt = (a) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a.toFixed(3)})`;
    this.secAt = (a) => `rgba(${sec[0]},${sec[1]},${sec[2]},${a.toFixed(3)})`;
  }

  /** One glow sprite (white-ish core inside a coloured halo) — the house
   *  node/packet look. Extracted from buildSprites' local helper so the
   *  seam's spectrum-tinted sprites (`_spriteForRgb`) share the exact same
   *  rendering instead of a drifting copy. */
  _makeSprite(core, halo, coreA, haloA, R) {
    const c = document.createElement('canvas');
    const S = R * 2;
    c.width = S;
    c.height = S;
    const x = c.getContext('2d');
    const g1 = x.createRadialGradient(R, R, 0, R, R, R);
    g1.addColorStop(0, `rgba(${halo[0]},${halo[1]},${halo[2]},${haloA})`);
    g1.addColorStop(0.45, `rgba(${halo[0]},${halo[1]},${halo[2]},${(haloA * 0.28).toFixed(3)})`);
    g1.addColorStop(1, `rgba(${halo[0]},${halo[1]},${halo[2]},0)`);
    x.fillStyle = g1;
    x.fillRect(0, 0, S, S);
    const g2 = x.createRadialGradient(R, R, 0, R, R, R * 0.32);
    g2.addColorStop(0, `rgba(${core[0]},${core[1]},${core[2]},${coreA})`);
    g2.addColorStop(1, `rgba(${core[0]},${core[1]},${core[2]},0)`);
    x.fillStyle = g2;
    x.fillRect(0, 0, S, S);
    return c;
  }

  /** SEAM-ONLY: cached spectrum-tinted sprite for an arbitrary [r,g,b]. The
   *  seam quantizes its qualitySpectrum inputs, so this cache stays tiny
   *  (≤ a few dozen); rebuilt on theme change via buildSprites. */
  _spriteForRgb(rgbCol) {
    if (!this._rgbSpriteCache) this._rgbSpriteCache = new Map();
    const key = rgbCol.join(',');
    let sp = this._rgbSpriteCache.get(key);
    if (!sp) {
      sp = this._makeSprite(mix(rgbCol, [255, 255, 255], 0.5), rgbCol, 1, 0.5, 26);
      this._rgbSpriteCache.set(key, sp);
    }
    return sp;
  }

  /** Pre-render glow sprites: 6 hues × {dark, queued} + lit + packet. */
  buildSprites() {
    const make = (core, halo, coreA, haloA, R) => this._makeSprite(core, halo, coreA, haloA, R);
    // Theme changed (or first build) — any cached seam tint sprites are stale.
    this._rgbSpriteCache = new Map();
    const dim = this.dark ? 1 : 1.15;
    // The dark mass — 90%+ of all languages, and the story. Present and
    // countable as a dense starfield, not an afterthought behind the glow.
    this.spDark = this.hueCols.map((h) => make(mix(h, this.pal.ink, 0.25), h, 0.85 * dim, 0.3, 24));
    // Dim tier (LLM-reachable living languages) — the ambient field. Brighter
    // than before so the "lit map" reads as full, not empty, at ambient zoom.
    this.spQueued = this.hueCols.map(() =>
      make(this.litCore, this.litHalo, 0.85, 0.4, 30),
    );
    // Bright tier (dedicated-MT coverage) — a crisp point with a modest
    // halo. Restrained on purpose (founder 2026-07-19): 500+ lit nodes at
    // the old 0.62-alpha/44px halo bled into one wall of glow and told the
    // OPPOSITE of the truth — the dark field is the point.
    this.spLit = make(this.litCore, this.litHalo, 1, 0.4, 34);
    this.spPacket = make(this.packetCol, this.packetCol, 1, 0.55, 26);
    // On-theme service hubs: one glow sprite per hub in its service hue,
    // plus per-method packet sprites so flights read as their method.
    this.spHub = {};
    this.packetColBy = {};
    this.spPacketBy = {};
    for (const hb of this.hubs || []) {
      const col = rgb(hb.color, [139, 149, 167]);
      this.spHub[hb.key] = make(mix(col, [255, 255, 255], 0.55), col, 0.95, 0.5, 40);
      const pc = mix(col, [255, 255, 255], this.dark ? 0.45 : 0.1);
      this.packetColBy[hb.key] = pc;
      this.spPacketBy[hb.key] = make(pc, pc, 1, 0.55, 26);
    }
    // Endangerment ember ramp (uncovered + Glottolog-AES at-risk levels):
    // the dim field glows warm where languages are being lost, deepening
    // with the level; dormant cools to ash violet. One sprite + one color
    // per at-risk level (v 1..4), from the vitalityScale SSOT — the same
    // swatches the explorer panel shows.
    this.vitCols = {};
    this.spVit = {};
    for (const lvl of VITALITY_LEVELS) {
      if (!lvl.atRisk) continue;
      const base = rgb(lvl.color, [224, 80, 58]);
      const blend = [0.62, 0.72, 0.85, 0.62][lvl.v - 1] || 0.7;
      const c = mix(this.pal.ink, this.dark ? base : mix(base, [0, 0, 0], 0.18), blend);
      this.vitCols[lvl.v] = c;
      this.spVit[lvl.v] = make(mix(c, this.pal.ink, 0.2), c, 0.72 * dim, 0.3, 24);
    }
    // Binary-hero sprites (founder 2026-07-19). Colorblind contract, in
    // order of redundancy: (1) traffic-light-balance hues — teal-green
    // (--vital-safe) vs ember red-orange (the vitalityScale critical red,
    // SSOT) with clear luminance separation; (2) STRUCTURE — covered nodes
    // carry a white-hot CORE inside the green halo, uncovered are soft
    // solid dots with no core; (3) MOTION — packets travel only among
    // covered nodes. Distinguishable with zero hue perception.
    const binRed = rgb(
      (VITALITY_LEVELS.find((l) => l.id === 'critical') || {}).color,
      [224, 80, 58],
    );
    const binRedC = this.dark ? binRed : mix(binRed, [0, 0, 0], 0.15);
    this.binaryRedCol = mix(this.pal.ink, binRedC, 0.85);
    this.spCovered = make(
      mix(this.pal.safe, [255, 255, 255], 0.72),
      this.pal.safe,
      1,
      0.42,
      34,
    );
    // Open-model-only coverage (tier 1): the language is listed by an open
    // research model (MADLAD-400/NLLB/…) but NO deployed service ships it —
    // "listed, not deployed". Same teal hue, but DIM and with NO white-hot
    // core, so the colorblind channel is core-present(service) vs
    // core-absent(open) vs red(uncovered) — luminance + structure, not hue.
    this.spCoveredOpen = make(
      this.pal.safe,
      this.pal.safe,
      0.5 * dim,
      0.26,
      26,
    );
    this.spUncoveredRed = make(
      this.binaryRedCol,
      this.binaryRedCol,
      0.8 * dim,
      0.3,
      24,
    );
    this.spPacketBinary = make(
      mix(this.pal.safe, [255, 255, 255], 0.6),
      this.pal.safe,
      1,
      0.5,
      26,
    );
    this.binaryPacketCol = mix(
      this.pal.safe,
      [255, 255, 255],
      this.dark ? 0.45 : 0.1,
    );
    // Seam-only outcome colours + sprites. MEASURE beat: a translation that
    // WORKS (quality green #4caf50) / FAILS (quality red #d64550). BRIDGE beat:
    // a PREDICTED hop (brand teal #4dd8ff) — never green, because a predicted
    // reachability estimate is not a measured score. Only the seam's spawn*
    // methods use these; ambient packets are unaffected.
    this.qGood = [76, 175, 80];
    this.qBad = [214, 69, 80];
    this.qPred = [77, 216, 255];
    this.spPacketGreen = make(mix(this.qGood, [255, 255, 255], 0.5), this.qGood, 1, 0.5, 26);
    this.spPacketRed = make(mix(this.qBad, [255, 255, 255], 0.35), this.qBad, 1, 0.5, 26);
    this.spPacketPred = make(mix(this.qPred, [255, 255, 255], 0.5), this.qPred, 1, 0.5, 26);
  }

  // ----------------------------------------------------------------- fit
  fit() {
    const r = this.fx.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    for (const c of [this.base, this.fx]) {
      const W = Math.round(r.width * this.dpr);
      const H = Math.round(r.height * this.dpr);
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
    }
    const first = !this.w;
    this.w = r.width;
    this.h = r.height;
    this.mobile = r.width < 640;
    this.zFit = Math.min(this.w / this.world, this.h / this.world) * 1.06;
    // Open framing: the network fills the frame (the world is roughly
    // circular, so a straight fit leaves dead margins); users can zoom
    // out to the full map.
    if (first) {
      this.cam.z = this.zFit * (this.mobile ? 1.05 : 1.16);
      this.cam.x = this.world / 2 + (this.litCx - this.world / 2) * 0.32;
      // Bias the framing DOWN a touch so the dense high-resource (Eurasia)
      // cluster doesn't ride up under the navbar / get clipped at the top.
      this.cam.y =
        this.world / 2 + (this.litCy - this.world / 2) * 0.32 + this.world * 0.05;
      // The opening frame — resetView() glides back here on explore exit.
      this.home = {x: this.cam.x, y: this.cam.y, z: this.cam.z};
    }
    this.cam.z = clamp(this.cam.z, this.zFit * 0.8, this.zFit * 14);

    // Mobile samples ~3,200 nodes: every lit/queued node always, then
    // the largest-audience nodes per quintile, deterministically. (The
    // frame probe's degrade ladder is the safety net on weak devices.)
    if (this.mobile && !this.mobileList) {
      const order = [];
      for (let i = 0; i < this.n; i += 1) order.push(i);
      order.sort(
        (a, b) =>
          this.st[b] - this.st[a] ||
          this.q[b] - this.q[a] ||
          this.seed[a] - this.seed[b],
      );
      this.mobileList = Uint16Array.from(order.slice(0, 3200));
    }
    this.drawList = this.mobile ? this.mobileList : null;
    return true;
  }

  // ------------------------------------------------------------ transforms
  /** Parallax factor for depth band L. Flat layouts collapse onto the FRONT
   *  band (PF[2]) rather than 1: every lit node and every seam overlay already
   *  projects there, so the collapse leaves the tuned camera framing
   *  pixel-identical and moves only the dots that were drifting. A single
   *  uniform factor is just zoom — it states no per-node position. */
  pf(L) {
    return this.flatParallax ? PF[2] : PF[L];
  }

  /** World → screen for a node on parallax layer L. */
  sx(wx, L) {
    return (wx - this.cam.x) * this.cam.z * this.pf(L) + this.w / 2;
  }

  sy(wy, L) {
    return (wy - this.cam.y) * this.cam.z * this.pf(L) + this.h / 2;
  }

  /** Screen → world at parallax layer L. */
  wx(px, L) {
    return (px - this.w / 2) / (this.cam.z * this.pf(L)) + this.cam.x;
  }

  wy(py, L) {
    return (py - this.h / 2) / (this.cam.z * this.pf(L)) + this.cam.y;
  }

  /** Node screen radius: grows sub-linearly with zoom (router hierarchy).
   * Balance (founder 2026-07-19): the UNCOVERED dark mass is the story —
   * covered nodes are compact city-lights, never floodlights that swamp
   * the field into reading "everything is covered". */
  nodeR(i) {
    const zf = (this.cam.z / this.zFit) ** 0.45;
    if (this.st[i] === 2) return (4.0 + this.q[i] * 0.4) * zf;
    if (this.st[i] === 1) return (3.2 + this.q[i] * 0.4) * zf;
    return (2.0 + this.q[i] * 0.62) * zf;
  }

  // ------------------------------------------------------------- pointer

  /**
   * Passive pointer binding for non-interactive mode (homepage hero).
   * Hover tooltips and click-to-select work, but NO drag/pan/zoom —
   * scroll events pass straight through to the page. Touch scrolling
   * is NOT blocked (no touchAction override).
   */
  bindPassivePointer() {
    const el = this.fx;
    // Intentionally do NOT set touchAction — let the browser scroll.
    // Pointer TYPE, not viewport width, decides tap semantics: an iPad is
    // wide but touches, a narrow desktop window still mouses.
    this.onMove = (e) => {
      if (e.pointerType === 'mouse') this.hoverAt(e.offsetX, e.offsetY);
    };
    this.onUp = (e) => {
      // Hubs first — a hub tap opens the service card (nature, license,
      // links, and the hide/show toggle); legacy fallback: blind toggle.
      const hub =
        this.displayMode === 'mesh'
          ? this.hitHub(e.offsetX, e.offsetY)
          : null; // hubs are invisible in the binary hero — not tappable
      if (hub) {
        if (this.onHubSelect) this.onHubSelect(this.hubInfo(hub));
        else this.toggleHub(hub);
        return;
      }
      // Click/tap: select the node under the pointer (touch gets a wider
      // magnetic ring); a miss falls through to the measured-arc layer.
      const touch = e.pointerType !== 'mouse';
      const idx = this.hitTest(e.offsetX, e.offsetY, touch ? 14 : 0);
      if (idx >= 0) {
        if (this.onSelect) {
          this.onSelect(this.nodeInfo(idx));
        } else if (touch) {
          this.hoverAt(e.offsetX, e.offsetY, 14);
        }
      } else {
        const arcIdx = this.hitTestArc(
          e.offsetX, e.offsetY, touch ? 12 : 6,
        );
        if (arcIdx >= 0 && this.onArcSelect) {
          this.onArcSelect({idx: arcIdx, ...this.arcAnchor(arcIdx)});
        }
        this.setHover(-1);
      }
    };
    this.onLeave = () => {
      this.setHover(-1);
      this.setArcHover(-1);
    };
    // No pointerdown (no drag), no wheel (no zoom).
    this.onDown = null;
    this.onWheel = null;
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointerleave', this.onLeave);
  }

  /**
   * Full interactive pointer binding (pan/zoom/drag) for the /mesh page
   * and any context that wants exploration.
   */
  bindPointer() {
    const el = this.fx;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    this.onDown = (e) => {
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY});
      if (this.pointers.size === 1) {
        this.drag = {
          x: e.offsetX,
          y: e.offsetY,
          moved: false,
          t: performance.now(),
        };
        this.velX = 0;
        this.velY = 0;
        this.camAnim = null;
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        this.pinch = {
          d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          z: this.cam.z,
        };
        this.drag = null;
      }
    };
    this.onMove = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (p) {
        p.x = e.offsetX;
        p.y = e.offsetY;
      }
      if (this.pinch && this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.zoomTo((this.pinch.z * d) / Math.max(this.pinch.d, 1), this.w / 2, this.h / 2);
        return;
      }
      if (this.drag) {
        const dx = e.offsetX - this.drag.x;
        const dy = e.offsetY - this.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.drag.moved = true;
        const now = performance.now();
        const dt = Math.max(now - this.drag.t, 1);
        this.velX = (dx / dt) * 16;
        this.velY = (dy / dt) * 16;
        this.cam.x -= dx / this.cam.z;
        this.cam.y -= dy / this.cam.z;
        this.clampCam();
        this.drag.x = e.offsetX;
        this.drag.y = e.offsetY;
        this.drag.t = now;
        this.dirty = true;
        this.setHover(-1);
      } else if (e.pointerType === 'mouse') {
        this.hoverAt(e.offsetX, e.offsetY);
      }
    };
    this.onUp = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.drag && !this.drag.moved) {
        // Hubs first — a hub tap opens the service card (with the toggle
        // inside); legacy fallback: blind toggle.
        const hub =
          this.displayMode === 'mesh'
            ? this.hitHub(e.offsetX, e.offsetY)
            : null; // hubs are invisible in the binary hero — not tappable
        if (hub) {
          if (this.onHubSelect) this.onHubSelect(this.hubInfo(hub));
          else this.toggleHub(hub);
          this.drag = null;
          return;
        }
        // Click/tap: select the node under the pointer (touch gets a
        // wider magnetic ring — pointer TYPE decides, not viewport); a
        // miss falls through to the measured-arc layer.
        const touch = e.pointerType !== 'mouse';
        const idx = this.hitTest(e.offsetX, e.offsetY, touch ? 14 : 0);
        if (idx >= 0) {
          if (this.onSelect) {
            this.onSelect(this.nodeInfo(idx));
          } else if (touch) {
            this.hoverAt(e.offsetX, e.offsetY, 14);
          }
        } else {
          const arcIdx = this.hitTestArc(
            e.offsetX, e.offsetY, touch ? 12 : 6,
          );
          if (arcIdx >= 0 && this.onArcSelect) {
            this.onArcSelect({idx: arcIdx, ...this.arcAnchor(arcIdx)});
          }
          this.setHover(-1);
        }
      }
      this.drag = null;
    };
    this.onWheel = (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0014);
      this.zoomTo(this.cam.z * f, e.offsetX, e.offsetY);
    };
    this.onLeave = () => this.setHover(-1);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('wheel', this.onWheel, {passive: false});
  }

  zoomTo(z, px, py) {
    const nz = clamp(z, this.zFit * 0.85, this.zFit * 14);
    // Keep the world point under the cursor fixed.
    const wx0 = this.wx(px, 1);
    const wy0 = this.wy(py, 1);
    this.cam.z = nz;
    this.cam.x = wx0 - (px - this.w / 2) / nz;
    this.cam.y = wy0 - (py - this.h / 2) / nz;
    this.clampCam();
    this.dirty = true;
  }

  clampCam() {
    const m = this.world * 0.08;
    this.cam.x = clamp(this.cam.x, -m, this.world + m);
    this.cam.y = clamp(this.cam.y, -m, this.world + m);
  }

  /**
   * Nearest measured ARC under the pointer, or -1. Nodes always win first
   * (callers try hitTest before hitTestArc), so node tooltips/cards keep
   * their behavior; arcs are the between-nodes fallback. Distance is
   * measured against the same quadratic curve drawBase strokes (endpoints
   * on parallax layer 2, perpendicular bulge 0.16), sampled as a short
   * polyline — exact enough at arc widths (1–2px) with a magnetic pad.
   */
  hitTestArc(px, py, pad = 6) {
    const arcs = this.measuredArcs;
    if (!arcs || !arcs.length) return -1;
    const AL = 2;
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < arcs.length; k += 1) {
      const A = arcs[k];
      const x1 = this.sx(this.xs[A.si], AL);
      const y1 = this.sy(this.ys[A.si], AL);
      const x2 = this.sx(this.xs[A.ti], AL);
      const y2 = this.sy(this.ys[A.ti], AL);
      const reach = pad + (A.width || 1) + 4;
      // Cheap bounding-box cull (the bulge stays within ~0.16·span).
      const bx1 = Math.min(x1, x2) - reach - Math.abs(y1 - y2) * 0.16;
      const bx2 = Math.max(x1, x2) + reach + Math.abs(y1 - y2) * 0.16;
      const by1 = Math.min(y1, y2) - reach - Math.abs(x1 - x2) * 0.16;
      const by2 = Math.max(y1, y2) + reach + Math.abs(x1 - x2) * 0.16;
      if (px < bx1 || px > bx2 || py < by1 || py > by2) continue;
      const cx = (x1 + x2) / 2 + (y1 - y2) * 0.16;
      const cy = (y1 + y2) / 2 + (x2 - x1) * 0.16;
      // Sample the quad bezier as a 12-segment polyline.
      let qx = x1;
      let qy = y1;
      for (let s = 1; s <= 12; s += 1) {
        const t = s / 12;
        const mt = 1 - t;
        const nx = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
        const ny = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
        // Point-to-segment distance (qx,qy)–(nx,ny).
        const dx = nx - qx;
        const dy = ny - qy;
        const len2 = dx * dx + dy * dy || 1;
        const u = clamp(((px - qx) * dx + (py - qy) * dy) / len2, 0, 1);
        const d = Math.hypot(qx + u * dx - px, qy + u * dy - py);
        if (d < bestD) {
          bestD = d;
          if (d <= reach) best = k;
        }
        qx = nx;
        qy = ny;
      }
    }
    return best >= 0 && bestD <= pad + (arcs[best].width || 1) + 4 ? best : -1;
  }

  /** Projected midpoint of a measured arc (tooltip/card anchor). */
  arcAnchor(k) {
    const A = this.measuredArcs[k];
    const AL = 2;
    const x1 = this.sx(this.xs[A.si], AL);
    const y1 = this.sy(this.ys[A.si], AL);
    const x2 = this.sx(this.xs[A.ti], AL);
    const y2 = this.sy(this.ys[A.ti], AL);
    // Bezier midpoint (t=0.5) of the drawn curve.
    const cx = (x1 + x2) / 2 + (y1 - y2) * 0.16;
    const cy = (y1 + y2) / 2 + (x2 - x1) * 0.16;
    return {
      x: 0.25 * x1 + 0.5 * cx + 0.25 * x2,
      y: 0.25 * y1 + 0.5 * cy + 0.25 * y2,
    };
  }

  setArcHover(k) {
    if (k === this.hoverArcIdx) return;
    this.hoverArcIdx = k;
    if (this.onArcHover) {
      this.onArcHover(k >= 0 ? {idx: k, ...this.arcAnchor(k)} : null);
    }
  }

  hitTest(px, py, pad = 0) {
    // Three inverse transforms (one per parallax layer); nearest within
    // the ring wins, lit nodes get priority via a larger radius. `pad`
    // widens the ring for imprecise pointers (fat-finger touch): the
    // nearest-within-radius scan IS the magnetic snap.
    let best = -1;
    let bestD = Infinity;
    const list = this.drawList;
    const count = list ? list.length : this.n;
    const box = 18 + pad;
    const binary = this.displayMode === 'binary';
    for (let k = 0; k < count; k += 1) {
      const i = list ? list[k] : k;
      // Binary frame draws living languages only — an invisible
      // non-living node must not be hover/tap-able there.
      if (binary && !this.liv[i]) continue;
      const L = this.layer[i];
      const x = this.sx(this.xs[i], L);
      if (x < px - box || x > px + box) continue;
      const y = this.sy(this.ys[i], L);
      if (y < py - box || y > py + box) continue;
      const d = Math.hypot(x - px, y - py);
      const r = Math.max(this.nodeR(i) + 4, (this.st[i] > 0 ? 14 : 9) + pad);
      if (d <= r && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  hoverAt(px, py, pad = 0) {
    // Anchor the tooltip to the NODE's projected position, not the
    // cursor — it stays glued to the node at any zoom (founder-flagged:
    // cursor-anchored tips drifted when zoomed deep). Nodes win; a miss
    // falls through to the measured-arc layer (strength tooltips).
    const idx = this.hitTest(px, py, pad);
    this.setHover(idx);
    const arcIdx = idx >= 0 ? -1 : this.hitTestArc(px, py);
    this.setArcHover(arcIdx);
    if (idx < 0 && arcIdx >= 0) this.fx.style.cursor = 'pointer';
  }

  /** Hub under the pointer (disc or its label strip), or null. */
  hitHub(px, py) {
    const AL = 2;
    for (const hb of this.hubs) {
      const x = this.sx(hb.x, AL);
      const y = this.sy(hb.y, AL);
      if (
        Math.hypot(x - px, y - py) <= 30 ||
        (Math.abs(x - px) <= 78 && py >= y + 16 && py <= y + 50)
      ) {
        return hb;
      }
    }
    return null;
  }

  /** Click a hub label: toggle that service's layer (chips stay synced). */
  toggleHub(hb) {
    this.setActiveMethods(this.activeMethods ^ hb.bit);
    if (this.onMethodsChange) this.onMethodsChange(this.activeMethods);
  }

  /** Service-card payload for a hub tap (screen-anchored, like nodeInfo). */
  hubInfo(hb) {
    const AL = 2;
    return {
      key: hb.key,
      bit: hb.bit,
      label: hb.label,
      count: hb.count,
      tier: hb.tier,
      anyToAny: hb.anyToAny,
      color: hb.color,
      source_url: hb.source_url,
      asOf: hb.asOf,
      homepage: hb.homepage,
      license: hb.license,
      nature: hb.nature,
      on: !!(this.activeMethods & hb.bit),
      x: this.sx(hb.x, AL),
      y: this.sy(hb.y, AL),
    };
  }

  setHover(idx, px, py) {
    if (idx === this.hoverIdx && idx === -1) return;
    this.hoverIdx = idx;
    this.fx.style.cursor =
      idx >= 0 ? 'pointer' : this.interactive ? 'grab' : '';
    if (this.onHover) {
      this.onHover(idx >= 0 ? this.nodeInfo(idx, px, py) : null);
    }
  }

  nodeInfo(i, px, py) {
    const L = this.layer[i];
    return {
      idx: i,
      code: this.codes[i],
      name: this.names[i],
      endonym: this.endo[i] || null,
      family: this.famNames[this.fam[i]],
      state: this.st[i],
      // Coverage TIER from this node's own bitmask: 2 = a deployed service
      // lists it, 1 = only an open research model lists it, 0 = uncovered.
      // Lets the hover/card copy distinguish the two greens honestly.
      coverageTier: coverageTier(this.mask[i]),
      mask: this.mask[i],
      // A scored run on the public board touches this language (measured
      // layer on) — shown honestly in the hover/card copy.
      measured: this.measuredSet ? this.measuredSet.has(i) : false,
      vitality: this.v[i],
      x: px != null ? px : this.sx(this.xs[i], L),
      y: py != null ? py : this.sy(this.ys[i], L),
    };
  }

  /** Search-lift hook: glide the camera to a language and ring it. */
  focusLanguage(code) {
    const i = this.idxByCode.get(code);
    if (i == null) return false;
    const targetZ = Math.max(this.cam.z, this.zFit * 5);
    this.camAnim = {
      t0: performance.now(),
      dur: 950,
      x0: this.cam.x,
      y0: this.cam.y,
      z0: this.cam.z,
      x1: this.xs[i],
      y1: this.ys[i],
      z1: targetZ,
    };
    this.focus = {idx: i, until: performance.now() + 4200};
    return true;
  }

  /**
   * Toggle which method layers are active. `activeMask` is a bitmask over the
   * method bits (google1 ms2 deepl4 libre8 nllb16 opus32 tilde64). A node is
   * lit ONLY while an active method covers it — all methods off = a fully
   * dark field (founder truth requirement 2026-07-17; the old benchmarked
   * bypass is gone). Active edges (packets) are the method edges whose bit is
   * on. Recomputes lit states, the packet deck, and repaints. In-flight
   * packets of still-active methods keep flying; only the toggled method's
   * flights vanish.
   */
  setActiveMethods(activeMask) {
    this.activeMethods = activeMask;
    let lit = 0;
    for (let i = 0; i < this.n; i += 1) {
      const next = (this.mask[i] & activeMask) !== 0 ? 2 : 0;
      if (this.st[i] !== next) {
        this.st[i] = next;
        this.layer[i] = next === 2 ? 2 : this.seed[i] < 0.38 ? 0 : this.seed[i] < 0.76 ? 1 : 2;
      }
      if (next === 2) lit += 1;
    }
    this.litCount = lit;
    // Active edges = method edges with an active bit.
    this.activeRoutes = this.geometricPackets
      ? this.methodEdges.filter((e) => (e[2] & activeMask) !== 0)
      : this.routes;
    this.routeDeck = this.activeRoutes.map((_, i) => i);
    for (let i = this.routeDeck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.routeDeck[i], this.routeDeck[j]] = [this.routeDeck[j], this.routeDeck[i]];
    }
    this.routePos = 0;
    this.packets = this.packets.filter(
      (p) => p.bit == null || (p.bit & activeMask) !== 0,
    );
    this.dirty = true;
  }

  /**
   * Endangerment-level highlight (the explorer panel): boost the ember
   * layer for a chosen SET of AES levels (vitalityScale v values 1..4).
   * Pass null / an empty iterable to clear. setAtRiskHighlight(true)
   * remains as the all-at-risk shorthand.
   */
  setVitalityHighlight(levels) {
    const set = levels ? new Set(levels) : null;
    this.vitHighlight = set && set.size ? set : null;
    this.dirty = true;
  }

  /** At-risk (Glottolog AES) ember layer boost — all at-risk levels. */
  setAtRiskHighlight(on) {
    this.setVitalityHighlight(on ? [1, 2, 3, 4] : null);
  }

  /**
   * Measured-pair arc layer: persistent connections for pairs with a
   * MEASURED score on the public board (mesh.json edges, status
   * "measured"), colour-coded by connection strength — cchrF++ where the
   * chance floor is known for both sides, neutral otherwise (see
   * src/utils/arcStrength.mjs and the public explainer at
   * /docs/network/specifications/connection-strength). The caller bounds
   * the array (MAX_ARCS) so a dense future board cannot melt the frame
   * budget; arcs repaint only on dirty frames like the rest of the base
   * layer.
   * @param {Array<{si:number,ti:number,color:string,alpha:number,width:number,dash:number[]|null}>} arcs
   */
  setMeasuredArcs(arcs) {
    this.measuredArcs = Array.isArray(arcs) ? arcs : [];
    // The layer changed under the pointer — any arc hover is now stale
    // (indices refer to the new array; toggling the layer off must also
    // dismiss its tooltip).
    this.setArcHover(-1);
    // A measured pair LIGHTS its endpoint languages while the layer is on:
    // the colour-coded arc and the endpoint glow are one claim — a scored
    // run on the public board demonstrated this pathway. This is how a
    // queue run visibly lights up languages no provider covers.
    this.measuredSet = new Set();
    for (const a of this.measuredArcs) {
      this.measuredSet.add(a.si);
      this.measuredSet.add(a.ti);
    }
    this.dirty = true;
  }

  /**
   * Ambient arc layer: the persistent unmeasured network — registered
   * queue pairs classified by reachability (see src/utils/pairReachability
   * .js: commercial API / open-source model / Champollion frontier). These
   * are REACHABILITY hairlines, never quality claims: flat muted colours,
   * strictly dimmer than the measured strength ramp that overlays them.
   * Grouped by style so each category strokes as one batched path — the
   * whole layer costs three stroke() calls on dirty frames.
   * @param {Array<{color:string,alpha:number,width:number,pairs:number[]}>} groups
   *   pairs = flat [si,ti, si,ti, ...] node-index pairs.
   */
  setAmbientArcs(groups) {
    this.ambientArcGroups = Array.isArray(groups) ? groups : [];
    this.dirty = true;
  }

  // (gateLiveRoutes removed 2026-07-17: it was caller-less and wrote `st`
  // directly — brightness is strictly coverage now; nothing but
  // setActiveMethods may touch node lit state.)

  // -------------------------------------------------------------- packets
  maxPackets() {
    const cap = this.mobile ? 5 : MAX_PACKETS[this.level];
    // Binary hero: amplified traffic (founder 2026-07-19 — "lots of
    // packets traveling through covered languages… so many left out").
    return this.displayMode === 'binary' ? Math.round(cap * 2.5) : cap;
  }

  /**
   * Binary-hero packet routes: DIRECT covered↔covered LIVING pairs from
   * the method edges — shuttles ([si,-1,bit]) and non-living endpoints
   * dropped, pairs deduped across methods. No hubs exist in the binary
   * frame, so flights bow along the chord instead of arcing through a
   * provider hub. Built once per payload, lazily.
   */
  buildBinaryRoutes() {
    if (this.binaryRoutes) return this.binaryRoutes;
    const seen = new Set();
    const out = [];
    for (const e of this.methodEdges) {
      const si = e[0];
      const ti = e[1];
      if (ti === -1) continue;
      if (!this.liv[si] || !this.liv[ti]) continue;
      // Only the DEPLOYED-SERVICE network moves. A packet flies a pair only
      // when a single commercial service covers BOTH ends (mask ∩ mask ∩
      // COMMERCIAL_MASK) — so open-model-only nodes never carry traffic,
      // matching their dim/static rendering (founder 2026-07-19).
      if (!(this.mask[si] & this.mask[ti] & COMMERCIAL_MASK)) continue;
      const key = si < ti ? `${si}:${ti}` : `${ti}:${si}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([si, ti]);
    }
    this.binaryRoutes = out;
    return out;
  }

  /** Spawn one binary-hero packet: teal-white pulse on a direct chord bow
   * between two covered living languages. Illustrative traffic — the
   * legend/provenance tip say so; no method identity, no hub flash. */
  spawnBinaryPacket(now) {
    const routes = this.buildBinaryRoutes();
    if (!routes.length) return;
    const pick = routes[(Math.random() * routes.length) | 0];
    const flip = Math.random() < 0.5;
    const si = flip ? pick[1] : pick[0];
    const ti = flip ? pick[0] : pick[1];
    const x0 = this.xs[si];
    const y0 = this.ys[si];
    const x1 = this.xs[ti];
    const y1 = this.ys[ti];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const side = Math.random() < 0.5 ? 1 : -1;
    const bow = len * 0.16 * side;
    this.packets.push({
      born: now,
      dur: PACKET_FLIGHT_MS * (0.85 + (len / this.world) * 0.7),
      x0,
      y0,
      cx: mx + (-dy / len) * bow,
      cy: my + (dx / len) * bow,
      x1,
      y1,
      si,
      ti,
      bit: null,
      method: null,
      binary: true,
      hubX: null,
      hubY: null,
      midHit: true, // no hub — never flash mid-flight
      hubLabel: null,
      run: null,
      flow: null,
      composite: null,
      trail: [],
      landed: false,
    });
  }

  /**
   * SEAM-ONLY: fire one "translation" packet along a route and colour it by
   * OUTCOME — green (works) / red (fails). The homepage seam calls this so the
   * pulse traces read as translations Champollion's queue is measuring. Route:
   * 'good' = a covered↔covered pair (green); 'bad' = a covered language reaching
   * toward one no service covers (red). Never auto-spawned; opt-in only.
   */
  spawnMeasurePulse(now, kind, tag) {
    const routes = this.buildBinaryRoutes();
    if (!routes.length) return;
    const pick = routes[(Math.random() * routes.length) | 0];
    let si = Math.random() < 0.5 ? pick[0] : pick[1];
    let ti = si === pick[0] ? pick[1] : pick[0];
    const bad = kind === 'bad';
    if (bad) {
      for (let tries = 0; tries < 48; tries += 1) {
        const c = (Math.random() * this.n) | 0;
        if (this.liv && this.liv[c] && this.st[c] === 0) {
          ti = c;
          break;
        }
      }
    }
    this._pushPulse(now, si, ti, bad ? 'bad' : 'good', undefined, tag);
  }

  /**
   * SEAM-ONLY: fire one outcome-coloured pulse between EXPLICIT node indices
   * (used by the bridging beat — the failed direct attempt in red, and the
   * teal hops that trace the predicted route). kind: 'good' → quality-green,
   * 'bad' → quality-red, 'predict' → brand-teal. No-op on bad indices.
   */
  spawnPulseBetween(now, si, ti, kind, durScale) {
    if (
      si == null || ti == null || si === ti ||
      si < 0 || ti < 0 || si >= this.n || ti >= this.n
    ) {
      return;
    }
    this._pushPulse(now, si, ti, kind, durScale);
  }

  /** SEAM-ONLY core: push one outcome-coloured pulse packet si→ti.
   *  kind ∈ {'good','bad','predict'} → green / red / brand-teal. `tag` (a
   *  metric NAME string, e.g. "chrF++") rides to the landing and prints as a
   *  slate instrument glyph — show-don't-tell "measured by many SOTA metrics". */
  _pushPulse(now, si, ti, kind, durScale, tag) {
    this._pushPulseXY(now, this.xs[si], this.ys[si], this.xs[ti], this.ys[ti], kind, durScale, tag, si, ti);
  }

  /** SEAM-ONLY core (explicit world coords). Lets a pulse emanate from an
   *  arbitrary origin — the queue/zipper head — not just a node. si/ti default
   *  to -1 (no node identity; the landing skips onLand). */
  _pushPulseXY(now, x0, y0, x1, y1, kind, durScale, tag, si = -1, ti = -1) {
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const side = Math.random() < 0.5 ? 1 : -1;
    const bow = len * 0.16 * side;
    this.packets.push({
      born: now,
      dur: PACKET_FLIGHT_MS * (durScale != null ? durScale : 0.7 + (len / this.world) * 0.6),
      x0,
      y0,
      cx: mx + (-dy / len) * bow,
      cy: my + (dx / len) * bow,
      x1,
      y1,
      si,
      ti,
      bit: null,
      method: null,
      binary: true,
      hubX: null,
      hubY: null,
      midHit: true,
      hubLabel: null,
      run: null,
      flow: null,
      composite: null,
      trail: [],
      landed: false,
      col: kind === 'bad' ? this.qBad : kind === 'predict' ? this.qPred : this.qGood,
      sprite:
        kind === 'bad'
          ? this.spPacketRed
          : kind === 'predict'
            ? this.spPacketPred
            : this.spPacketGreen,
      tag: tag || null,
    });
  }

  /**
   * SEAM-ONLY: fire one measurement pulse FROM an explicit world origin (the
   * running queue/zipper head) OUT to a node — 'good' lands on a covered node
   * (green), 'bad' reaches toward an uncovered living one (red). This is what
   * makes the zipper read as the queue: measurements emanate from it as it
   * sweeps the network. `tag` is an optional metric name.
   */
  spawnMeasureFrom(now, wx, wy, kind, tag) {
    let ti = -1;
    if (kind === 'bad') {
      for (let t = 0; t < 48; t += 1) {
        const c = (Math.random() * this.n) | 0;
        if (this.liv && this.liv[c] && this.st[c] === 0) {
          ti = c;
          break;
        }
      }
    } else {
      const routes = this.buildBinaryRoutes();
      if (!routes.length) return;
      const pick = routes[(Math.random() * routes.length) | 0];
      ti = Math.random() < 0.5 ? pick[0] : pick[1];
    }
    if (ti < 0) return;
    this._pushPulseXY(now, wx, wy, this.xs[ti], this.ys[ti], kind, 0.62, tag, -1, ti);
  }

  /**
   * SEAM-ONLY: a SUBMITTED method flying INTO the queue — a teal token from a
   * frame edge (wx0,wy0) to the queue/zipper head (wx1,wy1), carrying the method
   * NAME as its landing tag. Teal = a method ENTERING (brand/candidate, zero
   * quality claim); the measured OUT pulse asserts green/red. Shows "we measure
   * every method — existing AND submitted": submissions flow in, results fan out.
   */
  spawnIntake(now, wx0, wy0, wx1, wy1, tag) {
    this._pushPulseXY(now, wx0, wy0, wx1, wy1, 'predict', 0.55, tag);
  }

  /**
   * SEAM-ONLY: one pulse between explicit node indices in an ARBITRARY
   * [r,g,b] — the transmission-test packets whose colour climbs the quality
   * SPECTRUM (qualityColors.qualitySpectrum) as a link improves, instead of
   * jumping between three buckets. Same flight/trail as every other packet.
   */
  spawnPulseColored(now, si, ti, rgbCol, durScale, tag) {
    if (
      si == null || ti == null || si === ti ||
      si < 0 || ti < 0 || si >= this.n || ti >= this.n
    ) {
      return;
    }
    this._pushPulseRGB(now, this.xs[si], this.ys[si], this.xs[ti], this.ys[ti], rgbCol, durScale, tag, si, ti);
  }

  /**
   * SEAM-ONLY: a measured pair THREADING from the zipper queue onto the map —
   * a spectrum-coloured pulse from an explicit world origin (the queue's edge)
   * to the pair's node. The zipper is the engine, the map is the result: this
   * is the visible hand-off from "scored in the queue" to "edge on the network".
   */
  spawnThread(now, wxo, wyo, ti, rgbCol, tag) {
    if (ti == null || ti < 0 || ti >= this.n) return;
    this._pushPulseRGB(now, wxo, wyo, this.xs[ti], this.ys[ti], rgbCol, 0.6, tag, -1, ti);
  }

  /** SEAM-ONLY core: `_pushPulseXY` with an explicit colour instead of a kind. */
  _pushPulseRGB(now, x0, y0, x1, y1, rgbCol, durScale, tag, si = -1, ti = -1) {
    this._pushPulseXY(now, x0, y0, x1, y1, 'good', durScale, tag, si, ti);
    const p = this.packets[this.packets.length - 1];
    if (p) {
      p.col = rgbCol;
      p.sprite = this._spriteForRgb(rgbCol);
    }
  }

  /**
   * SEAM-ONLY: a pulse FROM a node TO an explicit world point — a language's
   * text flying INTO a processor (the omnimodel hub cards) or any other
   * screen-anchored instrument. The mirror of spawnThread.
   */
  spawnPulseToXY(now, si, wxt, wyt, rgbCol, durScale, tag) {
    if (si == null || si < 0 || si >= this.n) return;
    this._pushPulseRGB(now, this.xs[si], this.ys[si], wxt, wyt, rgbCol, durScale != null ? durScale : 0.6, tag, si, -1);
  }

  /**
   * SEAM-ONLY: an ambient DOT pulse — a radial wave that breathes through the
   * language dots themselves (dots = languages, the story's opening grammar).
   * Purely driver-fed (`t` from scroll progress → scrubs both ways), rendered
   * in drawFx under the coverage glow, zero cost when unset.
   *
   * mode: 'all'       every living dot            (beat 1 — languages exist)
   *       'covered'   any-MT dots (st===2)        (beat 2a — pulse greener)
   *       'service'   deployed-service dots       (beat 2b — greener still)
   *       'uncovered' no-MT living dots (st===0)  (beat 3 — pulse redder)
   * opts: {mode, color:[r,g,b], t:0..1 wave phase, width?, boost?, strength?,
   *        wash?: boolean} — `wash` holds every eligible dot at a uniform
   * glow (the "field turns white" opening) instead of the travelling sweep.
   * Pass null to clear.
   */
  setPulseWave(opts) {
    if (!opts || !opts.mode || !(opts.strength == null || opts.strength > 0.001)) {
      if (this.pulseWave) {
        this.pulseWave = null;
      }
      return;
    }
    this._ensureWave(opts.mode);
    this.pulseWave = {
      mode: opts.mode,
      color: opts.color || [77, 216, 255],
      t: clamp01(opts.t || 0),
      width: opts.width || 0.13,
      boost: opts.boost != null ? opts.boost : 1,
      strength: opts.strength != null ? clamp01(opts.strength) : 1,
      wash: opts.wash === true,
    };
    // fx-only state (drawFx runs every frame regardless) — dirtying the base
    // here forced a full n-node drawBase on every driver frame.
  }

  clearPulseWave() {
    this.setPulseWave(null);
  }

  /** Build (once per mode) the wave's eligible index list + each node's
   *  normalized phase. Phase is the node's position along the world X axis —
   *  the sweep travels ACROSS the map (founder R1: "the green then red should
   *  sweep across"), left → right, jittered per-dot at draw time so the front
   *  stays organic. Respects the mobile drawList so the wave never lights
   *  dots the base pass doesn't draw. */
  _ensureWave(mode) {
    if (this._waveMode === mode && this._waveList) return;
    let drawn = null;
    if (this.drawList) {
      drawn = new Uint8Array(this.n);
      for (const i of this.drawList) drawn[i] = 1;
    }
    const list = [];
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < this.n; i += 1) {
      if (!this.liv[i]) continue;
      if (drawn && !drawn[i]) continue;
      if (mode === 'covered' && this.st[i] !== 2) continue;
      if (mode === 'service' && !(this.mask[i] & COMMERCIAL_MASK)) continue;
      if (mode === 'uncovered' && this.st[i] !== 0) continue;
      list.push(i);
      if (this.xs[i] < minX) minX = this.xs[i];
      if (this.xs[i] > maxX) maxX = this.xs[i];
    }
    const span = Math.max(1, maxX - minX);
    const phase = new Float32Array(list.length);
    for (let k = 0; k < list.length; k += 1) {
      phase[k] = (this.xs[list[k]] - minX) / span;
    }
    this._waveMode = mode;
    this._waveList = Uint32Array.from(list);
    this._wavePhase = phase;
  }

  /**
   * SEAM-ONLY: sparse per-node tint overlay — a dot LIGHTING UP as it joins
   * the measured network (network expansion shown on the dots themselves, not
   * only the lines). entries: [[idx, [r,g,b], alpha]…] (alpha 0..1); null
   * clears. Composites over the node's sprite in drawFx; never touches
   * st/mask — a story overlay, not a coverage claim.
   */
  setNodeTints(entries) {
    if (!entries || !entries.length) {
      if (this.nodeTints) {
        this.nodeTints = null;
      }
      return;
    }
    const m = new Map();
    for (const [idx, rgbCol, a] of entries) {
      if (idx == null || idx < 0 || idx >= this.n) continue;
      const al = clamp01(a != null ? a : 1);
      if (al < 0.01) continue;
      m.set(idx, {col: rgbCol || [77, 216, 255], a: al});
    }
    this.nodeTints = m.size ? m : null;
    // fx-only state — see setPulseWave. No base redraw.
  }

  clearNodeTints() {
    this.setNodeTints(null);
  }

  /**
   * SEAM-ONLY: persistent STORY EDGES — the binary-mode-safe measured-network
   * overlay (mesh arcs/hubs don't render on the binary hero). The scored edge
   * is the seam's atomic unit: measurement accretes, so these persist while
   * set, colour = quality (spectrum), reveal grows each edge in.
   *
   * list: [{a, b, rgb:[r,g,b], alpha?, width?, dash?, reveal?}]
   *   a/b: {idx} (a node) OR {fx, fy} (viewport FRACTIONS 0..1 — screen
   *   anchors for hub-column fans; resize-safe by construction).
   */
  setStoryEdges(list) {
    this.storyEdges = list && list.length ? list : null;
    // fx-only overlay — drawFx runs every frame; no base redraw.
  }

  clearStoryEdges() {
    if (this.storyEdges) {
      this.storyEdges = null;
    }
  }

  /**
   * SEAM-ONLY: light a PREDICTED bridge route through a sequence of pivot node
   * indices. Drawn as a dashed BRAND-teal polyline with yellow pivot rings —
   * deliberately NOT quality-green: a predicted reachability estimate is not a
   * measured end-to-end score, and the colour says so. `reveal` (0..1) grows
   * the line; the seam ramps it as the story explains the route.
   */
  setPredictedRoute(seq, opts = {}) {
    const clean = (seq || []).filter(
      (i) => i != null && i >= 0 && i < this.n,
    );
    if (clean.length < 2) {
      this.predictedRoute = null;
      return;
    }
    this.predictedRoute = {
      seq: clean,
      reveal: opts.reveal != null ? clamp01(opts.reveal) : 0,
      // [r,g,b] line + endpoint colour (default brand teal = predicted); the
      // improvement beat drives this orange→green as a weak hop is fixed.
      color: opts.color || null,
      pivotColor: opts.pivotColor || null, // pivot rings (default brand yellow)
    };
    // fx-only overlay — drawFx runs every frame; no base redraw.
  }

  clearPredictedRoute() {
    if (this.predictedRoute) {
      this.predictedRoute = null;
      this.dirty = true;
    }
  }

  /**
   * SEAM-ONLY: the routing SEARCH → RESOLVE model (does the linking/routing
   * justice). `model` = {candidates:[{seq:[idx…], hopCols:[[r,g,b]…]}],
   * winnerIdx, searchA, resolveA, aimA} — all reveal params in 0..1, set purely
   * from scroll progress so it scrubs both ways. Candidates render faint dashed
   * TEAL (predicted/exploring); losers fade as resolveA rises; the winner's
   * per-hop segments SOLIDIFY into their measured-hop colour (green/orange/red)
   * under a dashed-teal end-to-end AIM overlay. THE LINK grammar: teal = aim,
   * solid = measured. The target is NEVER painted green — it stays uncovered.
   */
  setRouteSearch(model) {
    this.routeSearch = model || null;
    // fx-only overlay — drawFx runs every frame; no base redraw.
  }

  clearRouteSearch() {
    if (this.routeSearch) {
      this.routeSearch = null;
    }
  }

  /**
   * SEAM-ONLY: AIM-LINKS — thin dashed-teal structural links that accrete from
   * the covered core toward the overlooked margin (the network visibly LINKING
   * UP toward languages services deprioritize). `pairs` = [[si,ti]…] node-index
   * pairs; `reveal` (0..1) staggers them in. Deliberately thin, dim, dashed, and
   * TEAL (predicted/aim, brand) — they must NEVER read as measured coverage, and
   * the seam fades them out on settle so they don't masquerade as reach.
   */
  setAimLinks(pairs, opts = {}) {
    if (!pairs || !pairs.length) {
      this.aimLinks = null;
      return;
    }
    this.aimLinks = {pairs, reveal: opts.reveal != null ? clamp01(opts.reveal) : 0};
    // fx-only overlay — drawFx runs every frame; no base redraw.
  }

  clearAimLinks() {
    if (this.aimLinks) {
      this.aimLinks = null;
      this.dirty = true;
    }
  }

  /**
   * Spawn one packet. Every geometric packet is METHOD-ROUTED (founder
   * directive 2026-07-17): a covered-pair flight [si,ti,bit] flies a
   * quadratic whose apex passes EXACTLY through the method's hub (control
   * point C = 2H − (P0+P1)/2 puts B(0.5) on H), with a hub flash at
   * mid-flight; a shuttle edge [si,-1,bit] (per-pair providers — OPUS-MT,
   * Tilde) flies hub↔language directly, never asserting an unverified
   * language pair. Packets carry their method bit + colour.
   */
  spawnPacket(now) {
    if (this.packets.length >= this.maxPackets()) return;
    if (this.displayMode === 'binary') {
      this.spawnBinaryPacket(now);
      return;
    }
    if (!this.activeRoutes.length) return;
    const route = this.activeRoutes[this.routeDeck[this.routePos % this.routeDeck.length]];
    this.routePos += 1;
    const [si, ti, third, composite] = route;
    // Geometric packets (method edges) carry no run/flow data — they're pulses
    // on a method route. Field-route packets still require flow data.
    let flow = null;
    let run = null;
    const comp = typeof composite === 'number' ? composite : null;
    const hub = this.geometricPackets ? this.hubByBit.get(third) : null;
    if (!this.geometricPackets) {
      const flows = this.flowsByRun[third];
      if (!flows || !flows.length) return;
      flow = flows[this.flowPos[third] % flows.length];
      this.flowPos[third] += 1;
      run = this.runs[third];
    }
    const shuttle = ti === -1;
    if (shuttle && !hub) return; // stale payload without a matching hub
    let x0 = this.xs[si];
    let y0 = this.ys[si];
    let x1 = shuttle ? hub.x : this.xs[ti];
    let y1 = shuttle ? hub.y : this.ys[ti];
    // Shuttles alternate direction so the hub both sends and receives.
    if (shuttle && (this.routePos & 1) === 0) {
      [x0, y0, x1, y1] = [x1, y1, x0, y0];
    }
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    let cx;
    let cy;
    let pathLen = len;
    if (hub && !shuttle) {
      // Through-hub apex: B(0.5) = H exactly.
      cx = 2 * hub.x - mx;
      cy = 2 * hub.y - my;
      pathLen =
        Math.hypot(hub.x - x0, hub.y - y0) + Math.hypot(x1 - hub.x, y1 - hub.y);
    } else {
      // Chord bow (shuttles + field routes).
      const side = (this.routePos & 1) === 0 ? 1 : -1;
      const bow = len * 0.16 * side;
      cx = mx + (-dy / len) * bow;
      cy = my + (dx / len) * bow;
    }
    const packet = {
      born: now,
      dur: PACKET_FLIGHT_MS * (hub && !shuttle
        ? 0.6 + (pathLen / this.world) * 0.5
        : 0.85 + (len / this.world) * 0.7),
      x0,
      y0,
      cx,
      cy,
      x1,
      y1,
      si,
      ti,
      bit: this.geometricPackets ? third : null,
      method: hub ? hub.key : null,
      hubX: hub && !shuttle ? hub.x : null,
      hubY: hub && !shuttle ? hub.y : null,
      midHit: false,
      hubLabel: hub ? hub.label : null,
      run,
      flow,
      composite: comp,
      trail: [],
      landed: false,
    };
    this.packets.push(packet);
    if (this.onPacket) this.onPacket(this.packetInfo(packet));
  }

  packetInfo(p) {
    return {
      flow: p.flow,
      run: p.run,
      composite: p.composite,
      sourceName: this.names[p.si],
      targetName: p.ti === -1 ? p.hubLabel : this.names[p.ti],
      sourceEndonym: this.endo[p.si] || null,
      targetEndonym: p.ti === -1 ? null : this.endo[p.ti] || null,
    };
  }

  bez(p, t) {
    const u = 1 - t;
    return {
      x: u * u * p.x0 + 2 * u * t * p.cx + t * t * p.x1,
      y: u * u * p.y0 + 2 * u * t * p.cy + t * t * p.y1,
    };
  }

  // ---------------------------------------------------------------- loop
  start() {
    this.shouldRun = true;
    if (this.running || document.hidden) return;
    if (!this.fit()) return;
    this.running = true;
    this.lastNow = 0;
    this.dirty = true;
    this.raf = requestAnimationFrame((t) => this.step(t));
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  suspend() {
    this.shouldRun = false;
    this.stop();
  }

  /** Remove whichever pointer listeners the current mode bound. */
  unbindPointer() {
    const el = this.fx;
    // Remove only the listeners that were actually bound. In passive
    // mode (interactive=false) we skip pointerdown, pointercancel, and
    // wheel — trying to removeEventListener with null is harmless but
    // this keeps intent clear.
    if (this.onDown) el.removeEventListener('pointerdown', this.onDown);
    if (this.onMove) el.removeEventListener('pointermove', this.onMove);
    if (this.onUp) {
      el.removeEventListener('pointerup', this.onUp);
      el.removeEventListener('pointercancel', this.onUp);
    }
    if (this.onLeave) el.removeEventListener('pointerleave', this.onLeave);
    if (this.onWheel) el.removeEventListener('wheel', this.onWheel);
    this.onDown = null;
    this.onMove = null;
    this.onUp = null;
    this.onLeave = null;
    this.onWheel = null;
  }

  /**
   * Flip pointer mode on a LIVE instance — the homepage explore toggle.
   * Interactive binds pan/pinch/wheel and traps touch; passive gives
   * scroll back to the page. Transient gesture state is reset so a
   * mid-gesture flip can never strand a drag or pinch.
   */
  /**
   * Flip between the binary hero frame and the full mesh view. Clears
   * transient fx (packets/pulses/arc hover) so nothing from the other
   * mode lingers across the switch, and restarts the packet cadence.
   */
  /**
   * Morph the active node coordinates between the family blobs (t=0) and the
   * geo world-map (t=1) — v18. Cheap Float32 lerp; also recomputes the lit
   * centroid so the camera framing stays sensible mid-morph. No-op when the
   * payload carries no geo columns (older graph.json). Callers that pin the
   * camera themselves (e.g. /home-preview) get a stable frame; call fit()
   * afterwards to re-home the ambient camera on the new positions.
   * @param {number} t 0 = family blobs · 1 = geo world map
   */
  setLayout(t) {
    if (!this.hasGeo) return;
    const u = Math.min(1, Math.max(0, t));
    let lcx = 0;
    let lcy = 0;
    let lc = 0;
    for (let i = 0; i < this.n; i += 1) {
      this.xs[i] = this.famX[i] + (this.geoX[i] - this.famX[i]) * u;
      this.ys[i] = this.famY[i] + (this.geoY[i] - this.famY[i]) * u;
      if (this.st[i] === 2) {
        lcx += this.xs[i];
        lcy += this.ys[i];
        lc += 1;
      }
    }
    this.litCx = lc ? lcx / lc : this.world / 2;
    this.litCy = lc ? lcy / lc : this.world / 2;
    if (u >= 0.999) this.layout = 'geo';
    else if (u <= 0.001) this.layout = 'family';
    this.dirty = true;
  }

  /**
   * Recompute the opening `home` frame from the CURRENT canvas size + lit
   * centroid — mirrors fit()'s first-frame framing. fit() only sets `home` on
   * its very first run, so if that ran before the layout settled (e.g. the
   * /home-preview seam floats the navbar via data-seam-top, changing the
   * initial layout), `home` gets locked too zoomed-out. Callers that own the
   * camera (the seam) call this after the layout settles / on resize to correct
   * it. Harmless elsewhere (only invoked explicitly).
   */
  recomputeHome() {
    // Guard on `w`, NOT on `zFit`: zFit is initialised to 1 in the constructor,
    // so a truthiness check passes BEFORE the first real fit() and writes a
    // garbage home (z = 1.16 instead of zFit*1.16 ≈ 0.5). `w` is only set by a
    // successful fit, so it is the honest "have we ever measured?" flag.
    if (!this.w) return;
    this.home = {
      x: this.world / 2 + (this.litCx - this.world / 2) * 0.32,
      y: this.world / 2 + (this.litCy - this.world / 2) * 0.32 + this.world * 0.05,
      z: this.zFit * (this.mobile ? 1.05 : 1.16),
    };
  }

  setDisplayMode(mode) {
    const next = mode === 'binary' ? 'binary' : 'mesh';
    if (next === this.displayMode) return;
    this.displayMode = next;
    this.packets = [];
    this.pulses = [];
    this.nextPacket = -1;
    this.setArcHover(-1);
    // Coverage state (st) is PER-MODE and must be restored on every switch —
    // otherwise a leftover explore-mode method-layer toggle leaks into the
    // hero. Symptom (founder 2026-07-19): returning to the binary map with
    // activeMethods left at a subset/zero blanked every node to red-uncovered
    // while packets kept flying (packets come from methodEdges, node colour
    // from st). The binary hero ALWAYS shows the FULL provider coverage,
    // independent of any layer toggle; mesh restores the user's selection.
    if (next === 'binary') {
      this.restoreBinaryCoverage();
    } else {
      this.setActiveMethods(this.activeMethods);
    }
    this.dirty = true;
  }

  /** Reset st/layer to the FULL-coverage binary baseline (mask ≠ 0 ⇒ covered),
   *  matching the constructor — the hero never depends on activeMethods. */
  restoreBinaryCoverage() {
    let lit = 0;
    for (let i = 0; i < this.n; i += 1) {
      const st = this.mask[i] !== 0 ? 2 : 0;
      this.st[i] = st;
      this.layer[i] =
        st === 2 ? 2 : this.seed[i] < 0.38 ? 0 : this.seed[i] < 0.76 ? 1 : 2;
      if (st === 2) lit += 1;
    }
    this.litCount = lit;
  }

  setInteractive(on) {
    const next = Boolean(on);
    if (next === this.interactive) return;
    this.unbindPointer();
    this.interactive = next;
    this.drag = null;
    this.pinch = null;
    this.pointers.clear();
    this.velX = 0;
    this.velY = 0;
    if (next) {
      this.bindPointer(); // sets touchAction:'none', cursor:'grab'
    } else {
      this.fx.style.touchAction = '';
      this.fx.style.cursor = '';
      this.bindPassivePointer();
    }
  }

  /** Glide the camera back to the opening frame (explore-mode exit). */
  resetView() {
    if (!this.home) return;
    this.camAnim = {
      t0: performance.now(),
      dur: 700,
      x0: this.cam.x,
      y0: this.cam.y,
      z0: this.cam.z,
      x1: this.home.x,
      y1: this.home.y,
      z1: this.home.z,
    };
    this.dirty = true;
  }

  destroy() {
    this.stop();
    this.themeObs.disconnect();
    if (this.ro) this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.unbindPointer();
  }

  step(now) {
    if (!this.running) return;
    const dms = this.lastNow ? now - this.lastNow : 16;
    this.lastNow = now;
    const dt = Math.min(dms, 64) / 1000;

    // Zoom-adaptive mobile density: past ~2.5× the sampled list gives way
    // to the full catalog — the viewport shows a small world window, the
    // per-node cull discards the rest cheaply, and zoomed exploration
    // reveals every language (hitTest reads drawList, so taps too).
    if (this.mobile && this.mobileList) {
      const want = this.cam.z / this.zFit > 2.5 ? null : this.mobileList;
      if (want !== this.drawList) {
        this.drawList = want;
        this.dirty = true;
      }
    }

    // Probe (FieldEngine school).
    this.frames += 1;
    this.frameMs += dms;
    if (this.frames === PROBE_FRAMES) {
      const avg = this.frameMs / this.frames;
      // First window is load/sprite-warmup jank — measure, never ratchet.
      if (!this.probeWarm) this.probeWarm = true;
      else if (avg > PANIC_MS) this.level = 2;
      else if (avg > WEAK_MS) this.level = Math.max(this.level, 1);
      window.__GRAPH_STATS = {
        avgFrameMs: Number(avg.toFixed(2)),
        frames: this.frames,
        level: this.level,
        packets: this.packets.length,
        nodes: this.drawList ? this.drawList.length : this.n,
        zoom: Number((this.cam.z / this.zFit).toFixed(2)),
      };
      this.frames = 0;
      this.frameMs = 0;
    }

    // Inertia.
    if (!this.drag && (Math.abs(this.velX) > 0.08 || Math.abs(this.velY) > 0.08)) {
      this.cam.x -= this.velX / this.cam.z;
      this.cam.y -= this.velY / this.cam.z;
      this.velX *= 0.93;
      this.velY *= 0.93;
      this.clampCam();
      this.dirty = true;
    }
    // Camera glide (focusLanguage).
    if (this.camAnim) {
      const a = this.camAnim;
      const t = clamp01((now - a.t0) / a.dur);
      const e = easeInOut(t);
      this.cam.x = a.x0 + (a.x1 - a.x0) * e;
      this.cam.y = a.y0 + (a.y1 - a.y0) * e;
      this.cam.z = a.z0 + (a.z1 - a.z0) * e;
      this.dirty = true;
      if (t >= 1) this.camAnim = null;
    }

    // Packet scheduling — BINARY MODE ONLY (founder 2026-07-19): packets
    // are the hero's illustrative network-aliveness; the explore-mode map
    // draws only information-carrying marks, so it flies none. Binary
    // cadence is roughly twice the old ambient rate.
    if (this.autoPackets !== false && this.displayMode === 'binary') {
      if (this.nextPacket === -1) this.nextPacket = now + FIRST_PACKET_MS * 0.5;
      if (now >= this.nextPacket) {
        this.spawnPacket(now);
        this.nextPacket = now + PACKET_MS * 0.5 * (0.85 + Math.random() * 0.4);
      }
    }
    for (let i = this.packets.length - 1; i >= 0; i -= 1) {
      const p = this.packets[i];
      const t = (now - p.born) / p.dur;
      // Through-hub flights flash their hub at mid-flight (B(0.5) = H) —
      // the visible proof that the route goes THROUGH the method.
      if (!p.midHit && p.hubX != null && t >= 0.5) {
        p.midHit = true;
        this.pulses.push({
          x: p.hubX,
          y: p.hubY,
          born: now,
          small: true,
          col: p.method ? this.packetColBy[p.method] : null,
        });
      }
      if (t >= 1 && !p.landed) {
        p.landed = true;
        p.landAt = now;
        this.pulses.push({
          x: p.x1,
          y: p.y1,
          born: now,
          col: p.col
            ? p.col
            : p.binary
              ? this.binaryPacketCol
              : p.method
                ? this.packetColBy[p.method]
                : null,
          label: p.tag || null,
        });
        if (this.onLand && p.si >= 0) this.onLand(this.packetInfo(p));
      }
      if (t >= 1.25) this.packets.splice(i, 1);
    }
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      if (now - this.pulses[i].born > 900) this.pulses.splice(i, 1);
    }

    if (this.dirty) {
      this.drawBase(now);
      this.dirty = false;
    }
    this.drawFx(now, dt);
    for (let i = this.aux.length - 1; i >= 0; i -= 1) {
      this.aux[i](now, dt);
    }
    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      if (this.onFirstFrame) this.onFirstFrame();
    }

    this.raf = requestAnimationFrame((t) => this.step(t));
  }

  // ---------------------------------------------------------------- draw
  /** The dark constellation + queued half-glows + zoom labels. */
  drawBase(now) {
    const ctx = this.bctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const cheap = this.level === 2;
    const zf = this.cam.z / this.zFit;
    const list = this.drawList;
    const count = list ? list.length : this.n;
    // Depth fog: back layers dimmer; everything stays VISIBLE — the
    // dark mass must read as a constellation of potential, not noise.
    // Dark-field presence raised (founder 2026-07-19): the uncovered mass
    // must register against the lit minority at every depth.
    const layerA = this.dark ? [0.56, 0.78, 1] : [0.62, 0.82, 1];
    ctx.globalCompositeOperation = 'source-over';
    // 'mesh' = the full data view (explore mode); 'binary' = the hero's
    // one-story frame: covered green vs uncovered-living red, NOTHING
    // else — no spokes, no arcs, no hubs, no labels (founder 2026-07-19).
    const mesh = this.displayMode === 'mesh';

    // Service-hub spokes (Layer S): one batched path per provider in its
    // own colour — full coverage stays legible because every spoke meets
    // at its hub instead of forming O(n²) pair lines. Mesh mode only.
    if (mesh && this.hubs.length) {
      const AL = 2;
      ctx.lineCap = 'round';
      for (const hb of this.hubs) {
        if (!(this.activeMethods & hb.bit)) continue;
        const hx = this.sx(hb.x, AL);
        const hy = this.sy(hb.y, AL);
        ctx.globalAlpha = 0.09;
        ctx.strokeStyle = hb.color;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const n of hb.spokes) {
          ctx.moveTo(hx, hy);
          ctx.lineTo(this.sx(this.xs[n], this.layer[n]), this.sy(this.ys[n], this.layer[n]));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Ambient reachability arcs — the persistent unmeasured network,
    // drawn under everything (dimmest layer). One batched path per
    // category group; same viewport cull and bulge as measured arcs.
    // Mesh mode only (defensive — the hero never sets them).
    if (mesh && this.ambientArcGroups.length) {
      const AL = 2;
      ctx.lineCap = 'round';
      for (const G of this.ambientArcGroups) {
        const P = G.pairs;
        if (!P || !P.length) continue;
        // Phones draw fewer hairlines; pairs are strongest-first so the
        // draw-time cut keeps the most meaningful ones. Adapts on resize.
        const end =
          this.mobile && G.mobilePairs != null
            ? Math.min(P.length, G.mobilePairs * 2)
            : P.length;
        ctx.globalAlpha = G.alpha;
        ctx.strokeStyle = G.color;
        ctx.lineWidth = G.width;
        ctx.beginPath();
        for (let k = 0; k + 1 < end; k += 2) {
          const x1 = this.sx(this.xs[P[k]], AL);
          const y1 = this.sy(this.ys[P[k]], AL);
          const x2 = this.sx(this.xs[P[k + 1]], AL);
          const y2 = this.sy(this.ys[P[k + 1]], AL);
          if (
            (x1 < -40 && x2 < -40) ||
            (x1 > this.w + 40 && x2 > this.w + 40) ||
            (y1 < -40 && y2 < -40) ||
            (y1 > this.h + 40 && y2 > this.h + 40)
          ) {
            continue;
          }
          ctx.moveTo(x1, y1);
          // Same perpendicular bulge as the poster + measured arcs (0.16).
          ctx.quadraticCurveTo(
            (x1 + x2) / 2 + (y1 - y2) * 0.16,
            (y1 + y2) / 2 + (x2 - x1) * 0.16,
            x2,
            y2,
          );
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Measured-pair arcs (the strength layer) — drawn first, so the
    // constellation, labels, and the fx-layer lit routers stay legible
    // above the connections. Lit endpoints ride the front parallax layer.
    if (mesh && this.measuredArcs.length) {
      const AL = 2;
      ctx.lineCap = 'round';
      for (let k = 0; k < this.measuredArcs.length; k += 1) {
        const A = this.measuredArcs[k];
        const x1 = this.sx(this.xs[A.si], AL);
        const y1 = this.sy(this.ys[A.si], AL);
        const x2 = this.sx(this.xs[A.ti], AL);
        const y2 = this.sy(this.ys[A.ti], AL);
        // Cheap whole-span cull: skip arcs entirely outside the viewport.
        if (
          (x1 < -40 && x2 < -40) ||
          (x1 > this.w + 40 && x2 > this.w + 40) ||
          (y1 < -40 && y2 < -40) ||
          (y1 > this.h + 40 && y2 > this.h + 40)
        ) {
          continue;
        }
        ctx.globalAlpha = A.alpha;
        ctx.strokeStyle = A.color;
        ctx.lineWidth = A.width;
        ctx.setLineDash(A.dash || []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        // Same perpendicular bulge the SSR poster routes use (0.16).
        ctx.quadraticCurveTo(
          (x1 + x2) / 2 + (y1 - y2) * 0.16,
          (y1 + y2) / 2 + (x2 - x1) * 0.16,
          x2,
          y2,
        );
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    for (let L = 0; L < 3; L += 1) {
      const a = layerA[L];
      for (let k = 0; k < count; k += 1) {
        const i = list ? list[k] : k;
        // mesh: covered (st2) is drawn bright by drawFx, skip here. binary:
        // only a DEPLOYED SERVICE is drawn bright by drawFx — open-model-only
        // coverage falls through to the dim-teal pass below.
        const isService = (this.mask[i] & COMMERCIAL_MASK) !== 0;
        if (this.layer[i] !== L || (mesh ? this.st[i] === 2 : isService)) continue;
        // BINARY: living languages only — non-living (historical/
        // constructed) belong to the explore-mode map, never the hero.
        if (!mesh && !this.liv[i]) continue;
        const x = this.sx(this.xs[i], L);
        if (x < -24 || x > this.w + 24) continue;
        const y = this.sy(this.ys[i], L);
        if (y < -24 || y > this.h + 24) continue;
        const r = this.nodeR(i);
        if (!mesh) {
          // BINARY open-model-only pass (tier 1): the code is in an open
          // research model's list (MADLAD-400/NLLB/…) but NO deployed
          // service ships it. Dim teal, NO white core, STATIC — "listed,
          // not deployed", visibly outside the moving service network.
          if (this.mask[i] !== 0) {
            if (cheap) {
              const h = this.pal.safe;
              ctx.fillStyle = `rgba(${h[0]},${h[1]},${h[2]},${(a * 0.6).toFixed(3)})`;
              ctx.fillRect(x - r / 2, y - r / 2, r, r);
            } else {
              ctx.globalAlpha = Math.min(1, a * 0.9);
              const s = r * 5.0;
              ctx.drawImage(this.spCoveredOpen, x - s / 2, y - s / 2, s, s);
            }
            continue;
          }
          // BINARY uncovered pass: one soft solid red dot — no white core
          // (the core is the covered nodes' colorblind channel), no family
          // hue, no vitality ramp. STATIC on purpose: the base canvas is
          // dirty-frame-only, and the stillness of the left-behind mass
          // against the breathing/packet-carrying covered network IS the
          // story (motion = inclusion).
          if (cheap) {
            const h = this.binaryRedCol;
            ctx.fillStyle = `rgba(${h[0]},${h[1]},${h[2]},${(a * 0.85).toFixed(3)})`;
            ctx.fillRect(x - r / 2, y - r / 2, r, r);
          } else {
            ctx.globalAlpha = Math.min(1, a * 0.98);
            const s = r * 5.4;
            ctx.drawImage(this.spUncoveredRed, x - s / 2, y - s / 2, s, s);
          }
          continue;
        }
        // Endangerment ember: uncovered nodes at any at-risk AES level
        // (1 shifting … 4 dormant) tint on the vitalityScale ramp — subtle
        // by default; the explorer boosts the SELECTED levels only.
        const lv = this.v[i];
        const risky = lv >= 1 && lv <= 4;
        if (cheap) {
          const h = risky ? this.vitCols[lv] : this.hueCols[this.famHue[this.fam[i]]];
          ctx.fillStyle = `rgba(${h[0]},${h[1]},${h[2]},${(a * 0.8).toFixed(3)})`;
          ctx.fillRect(x - r / 2, y - r / 2, r, r);
        } else if (this.st[i] === 1) {
          ctx.globalAlpha = Math.min(1, a * 1.25);
          const s = r * 5.4;
          ctx.drawImage(this.spQueued[0], x - s / 2, y - s / 2, s, s);
        } else if (risky && this.emberLayer !== false) {
          const hl = this.vitHighlight != null && this.vitHighlight.has(lv);
          const baseA = [0.95, 1.02, 1.1, 0.9][lv - 1] || 1;
          ctx.globalAlpha = Math.min(1, a * baseA * (hl ? 1.65 : 1));
          const s = r * (hl ? 6.6 : 5.4);
          ctx.drawImage(this.spVit[lv], x - s / 2, y - s / 2, s, s);
        } else {
          ctx.globalAlpha = a;
          const s = r * 5.4;
          ctx.drawImage(this.spDark[this.famHue[this.fam[i]]], x - s / 2, y - s / 2, s, s);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Names appear as the camera commits to a neighborhood (names
    // everywhere — never bare codes). Endonym leads when verified.
    if (zf > 3.4) {
      const labelA = clamp01((zf - 3.4) / 1.6) * 0.9;
      ctx.font = `500 11px "Inter Variable", Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let drawn = 0;
      for (let k = 0; k < count && drawn < 160; k += 1) {
        const i = list ? list[k] : k;
        const L = this.layer[i];
        const x = this.sx(this.xs[i], L);
        if (x < -10 || x > this.w + 10) continue;
        const y = this.sy(this.ys[i], L);
        if (y < -10 || y > this.h + 10) continue;
        const e = this.endo[i];
        ctx.fillStyle = this.st[i] === 2 ? this.inkAt(labelA) : this.secAt(labelA * 0.8);
        const text = e ? `${e} · ${this.names[i]}` : this.names[i];
        // Keep labels on-canvas: flip to the node's left side when the text
        // would run off the right edge (labels used to clip at the viewport).
        let tx = x + this.nodeR(i) + 5;
        if (tx + ctx.measureText(text).width > this.w - 6) {
          ctx.textAlign = 'right';
          ctx.fillText(text, x - this.nodeR(i) - 5, y);
          ctx.textAlign = 'left';
        } else {
          ctx.fillText(text, tx, y);
        }
        drawn += 1;
      }
    }

    // Hubs: on-theme stars in the field — a pre-rendered glow in the
    // service hue, a hot core, a thin ring, and the always-visible label.
    // A toggled-off hub dims to a ghost but keeps its "hidden · tap to
    // show" affordance (the only canvas path back on). Mesh mode only.
    if (mesh && this.hubs.length) {
      const AL = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const hb of this.hubs) {
        const on = !!(this.activeMethods & hb.bit);
        const x = this.sx(hb.x, AL);
        const y = this.sy(hb.y, AL);
        if (x < -160 || x > this.w + 160 || y < -60 || y > this.h + 60) continue;
        const sp = this.spHub && this.spHub[hb.key];
        if (sp) {
          ctx.globalAlpha = on ? 0.9 : 0.16;
          const s = 72;
          ctx.drawImage(sp, x - s / 2, y - s / 2, s, s);
        }
        const core = rgb(hb.color, [139, 149, 167]);
        const cc = mix(core, [255, 255, 255], 0.6);
        ctx.globalAlpha = on ? 0.95 : 0.3;
        ctx.fillStyle = `rgb(${cc[0]},${cc[1]},${cc[2]})`;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = on ? 0.55 : 0.2;
        ctx.strokeStyle = hb.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = on ? 0.95 : 0.45;
        ctx.font = '600 12px "Inter Variable", Inter, system-ui, sans-serif';
        ctx.fillStyle = this.inkAt(1);
        ctx.fillText(`${hb.label} · ${hb.count.toLocaleString('en-US')}`, x, y + 27);
        ctx.font = '500 9px "Inter Variable", Inter, system-ui, sans-serif';
        ctx.fillStyle = this.secAt(0.9);
        // The tier qualification lives ON the map: 'service' = deployable
        // API; 'open models' = research models needing deployment.
        const tierWord =
          hb.tier === 'service' ? 'service' : hb.tier === 'open' ? 'open models' : 'coverage';
        ctx.fillText(on ? `${tierWord} · tap for details` : 'hidden · tap for details', x, y + 41);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  }

  /** Lit routers, packets + trails, pulses, hover/focus rings. */
  drawFx(now, dt) {
    const ctx = this.fctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const L = 2;
    const mesh = this.displayMode === 'mesh';

    // SEAM-ONLY: the ambient dot-pulse wave (dots = languages). A radial
    // band sweeps the eligible dots from the covered core outward; each dot
    // in the band brightens in the wave's colour. Drawn FIRST (under the
    // coverage glow) so it reads as the field itself breathing. Banded: only
    // dots near the wavefront draw, so the per-frame cost is a cheap
    // subtract/compare over the list plus a few hundred sprite draws.
    // Killed at degrade level 2.
    if (this.pulseWave && this._waveList && this.level < 2) {
      const pw = this.pulseWave;
      const sp = this._spriteForRgb(pw.color);
      // Two regimes, both t-driven (scrubs both ways):
      //  WASH — every eligible dot holds a uniform glow with a soft per-dot
      //  twinkle riding on it (the opening: the field turns WHITE — these are
      //  languages, before coverage colours them).
      //  SWEEP — a front travels ACROSS the map (x-phase + seed jitter), each
      //  dot surging as it passes; squared amplitude keeps the field from
      //  fusing into a glow wall (the covered-halo 4.2× lesson).
      const TAU = 6.2832;
      for (let k = 0; k < this._waveList.length; k += 1) {
        const i = this._waveList[k];
        let amp;
        if (pw.wash) {
          const tw = 0.8 + 0.2 * Math.sin(TAU * (pw.t * 2.2 + (this.seed[i] % 23) / 23));
          amp = tw * pw.boost * pw.strength;
        } else {
          const ph = this._wavePhase[k] * 0.72 + ((this.seed[i] % 29) / 29) * 0.28;
          const amp0 = 0.5 - 0.5 * Math.cos(TAU * (pw.t * 1.6 - ph));
          amp = amp0 * amp0 * pw.boost * pw.strength;
        }
        if (amp < 0.07) continue;
        const x = this.sx(this.xs[i], L);
        if (x < -30 || x > this.w + 30) continue;
        const y = this.sy(this.ys[i], L);
        if (y < -30 || y > this.h + 30) continue;
        const s = this.nodeR(i) * (2.3 + 2.1 * amp);
        ctx.globalAlpha = Math.min(0.78, amp * 0.85);
        ctx.drawImage(sp, x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }

    // Lit routers breathe slowly — cities at night, not blinkers. In
    // binary mode the covered node IS the green story: white-hot core in
    // a teal halo (spCovered — the core doubles as the colorblind
    // channel; uncovered red dots carry no core). Binary skips non-living.
    for (let i = 0; i < this.n; i += 1) {
      if (this.st[i] !== 2) continue;
      if (!mesh && !this.liv[i]) continue;
      // BINARY: only a DEPLOYED SERVICE earns the bright breathing glow +
      // white core. Open-model-only coverage (in a research model's list,
      // no service) is drawn dim & static by drawBase — it is not part of
      // the moving service network (founder 2026-07-19: the map must be true).
      if (!mesh && !(this.mask[i] & COMMERCIAL_MASK)) continue;
      const x = this.sx(this.xs[i], L);
      if (x < -40 || x > this.w + 40) continue;
      const y = this.sy(this.ys[i], L);
      if (y < -40 || y > this.h + 40) continue;
      const breathe = 0.9 + 0.1 * Math.sin(now * 0.0011 + this.seed[i] * 9);
      // 4.2×, was 6.8× — with 500+ covered nodes the wide halos merged
      // into a single glow wall that visually claimed universal coverage.
      const s = this.nodeR(i) * 4.2 * breathe;
      ctx.globalAlpha = 1;
      ctx.drawImage(mesh ? this.spLit : this.spCovered, x - s / 2, y - s / 2, s, s);
    }
    // Measured-pair endpoints (queue runs) glow too — even languages no
    // provider covers light up at the ends of their colour-coded arc.
    // Projected at the node's OWN parallax layer (they aren't promoted to
    // the front layer like coverage-lit nodes, so L=2 would drift).
    // Mesh mode only (the arcs themselves are mesh-only).
    if (mesh && this.measuredSet && this.measuredSet.size) {
      const zf = (this.cam.z / this.zFit) ** 0.45;
      for (const i of this.measuredSet) {
        if (this.st[i] === 2) continue; // already lit by coverage
        const li = this.layer[i];
        const x = this.sx(this.xs[i], li);
        if (x < -40 || x > this.w + 40) continue;
        const y = this.sy(this.ys[i], li);
        if (y < -40 || y > this.h + 40) continue;
        const breathe = 0.9 + 0.1 * Math.sin(now * 0.0011 + this.seed[i] * 9);
        const s = (4.0 + this.q[i] * 0.4) * zf * 4.2 * breathe;
        ctx.drawImage(this.spLit, x - s / 2, y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;

    // SEAM-ONLY: per-node tint overlay — dots LIGHTING UP as measured pairs
    // join the network (expansion on the dots, not just the lines). Sparse
    // (a Map of at most a few hundred), spectrum-coloured, breathing with the
    // node's own phase. A story overlay over the sprite — never a coverage
    // rewrite (st/mask untouched).
    if (this.nodeTints && this.nodeTints.size) {
      for (const [i, tint] of this.nodeTints) {
        const li = this.st[i] === 2 ? L : this.layer[i];
        const x = this.sx(this.xs[i], li);
        if (x < -40 || x > this.w + 40) continue;
        const y = this.sy(this.ys[i], li);
        if (y < -40 || y > this.h + 40) continue;
        const breathe = 0.9 + 0.1 * Math.sin(now * 0.0011 + this.seed[i] * 9);
        const s = this.nodeR(i) * 4.6 * breathe;
        ctx.globalAlpha = tint.a;
        ctx.drawImage(this._spriteForRgb(tint.col), x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }

    // Active hubs pulse gently — alive, receiving traffic. Off hubs stay
    // still (state legible at a glance). Mesh mode only.
    if (mesh && this.hubs.length) {
      for (let hi = 0; hi < this.hubs.length; hi += 1) {
        const hb = this.hubs[hi];
        if (!(this.activeMethods & hb.bit)) continue;
        const hx = this.sx(hb.x, L);
        const hy = this.sy(hb.y, L);
        if (hx < -80 || hx > this.w + 80 || hy < -80 || hy > this.h + 80) continue;
        const ph = 0.5 + 0.5 * Math.sin(now * 0.0016 + hi * 1.7);
        ctx.globalAlpha = 0.08 + 0.1 * ph;
        ctx.strokeStyle = hb.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, 13 + 2.5 * ph, 0, 6.2832);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // SEAM-ONLY: STORY EDGES — the persistent, binary-safe measured-network
    // overlay (the scored edge = the atomic unit; measurement ACCRETES). Each
    // edge is a quadratic arc in its quality-spectrum colour; endpoints are
    // nodes ({idx}) or viewport-fraction anchors ({fx,fy} — the hub column).
    // `reveal` grows an edge in; drawn under routes/packets so live traffic
    // reads on top of the settled network.
    if (this.storyEdges && this.storyEdges.length) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.lineCap = 'round';
      for (const eg of this.storyEdges) {
        const rev = eg.reveal != null ? clamp01(eg.reveal) : 1;
        const alpha = (eg.alpha != null ? eg.alpha : 0.55) * (rev < 0.12 ? rev / 0.12 : 1);
        if (rev <= 0.002 || alpha < 0.015) continue;
        const pa = eg.a.idx != null
          ? [this.sx(this.xs[eg.a.idx], L), this.sy(this.ys[eg.a.idx], L)]
          : [eg.a.fx * this.w, eg.a.fy * this.h];
        const pb = eg.b.idx != null
          ? [this.sx(this.xs[eg.b.idx], L), this.sy(this.ys[eg.b.idx], L)]
          : [eg.b.fx * this.w, eg.b.fy * this.h];
        const offX = Math.min(pa[0], pb[0]);
        const offY = Math.min(pa[1], pb[1]);
        const spanX = Math.abs(pa[0] - pb[0]);
        const spanY = Math.abs(pa[1] - pb[1]);
        if (offX > this.w + 60 || offY > this.h + 60 || offX + spanX < -60 || offY + spanY < -60) continue;
        const dx = pb[0] - pa[0];
        const dy = pb[1] - pa[1];
        const len = Math.hypot(dx, dy) || 1;
        // Deterministic bow side (no randomness — scrub-stable): hash the
        // endpoint identity so an edge always bows the same way.
        const side = ((eg.a.idx != null ? eg.a.idx : 7) + (eg.b.idx != null ? eg.b.idx : 3)) % 2 ? 1 : -1;
        const bow = len * 0.16 * side;
        const cxp = (pa[0] + pb[0]) / 2 + (-dy / len) * bow;
        const cyp = (pa[1] + pb[1]) / 2 + (dx / len) * bow;
        const [er, egc, eb2] = eg.rgb || [77, 216, 255];
        ctx.strokeStyle = `rgba(${er},${egc},${eb2},${alpha.toFixed(3)})`;
        ctx.lineWidth = eg.width || 1.3;
        ctx.setLineDash(eg.dash || []);
        ctx.beginPath();
        // Partial-quadratic reveal: sample the curve to the reveal fraction.
        const STEPS = 14;
        const kMax = Math.max(1, Math.ceil(STEPS * rev));
        ctx.moveTo(pa[0], pa[1]);
        for (let k = 1; k <= kMax; k += 1) {
          const u = Math.min(rev, k / STEPS);
          const omu = 1 - u;
          ctx.lineTo(
            omu * omu * pa[0] + 2 * omu * u * cxp + u * u * pb[0],
            omu * omu * pa[1] + 2 * omu * u * cyp + u * u * pb[1],
          );
        }
        ctx.stroke();
        // A small endpoint dot where the edge meets a language — the pair's
        // nodes visibly participate (dots light, not just lines).
        ctx.fillStyle = `rgba(${er},${egc},${eb2},${Math.min(0.9, alpha * 1.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pa[0], pa[1], 1.8, 0, 6.2832);
        ctx.fill();
        if (rev > 0.98) {
          ctx.beginPath();
          ctx.arc(pb[0], pb[1], 1.8, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // SEAM-ONLY: the PREDICTED bridge route — a dashed brand-teal polyline
    // through pivot nodes, yellow pivot rings, revealed as the story explains
    // it. Brand colours (teal/yellow), never quality-green: a predicted
    // reachability estimate is NOT a measured end-to-end score. Drawn under the
    // tracing packets (source-over) so the green hops read on top of the guide.
    if (this.predictedRoute && this.predictedRoute.seq.length >= 2) {
      const seq = this.predictedRoute.seq;
      const rev = clamp01(this.predictedRoute.reveal);
      const [cr, cg, cb] = this.predictedRoute.color || [77, 216, 255];
      const [vr, vg, vb] = this.predictedRoute.pivotColor || [255, 207, 77];
      const pts = seq.map((idx) => [this.sx(this.xs[idx], L), this.sy(this.ys[idx], L)]);
      const cum = [0];
      for (let k = 0; k < pts.length - 1; k += 1) {
        cum.push(cum[k] + Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]));
      }
      const revLen = cum[cum.length - 1] * rev;
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -(now * 0.03) % 13;
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.9)`;
      ctx.lineWidth = 1.7;
      ctx.shadowColor = `rgba(${cr},${cg},${cb},0.75)`;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 0; k < pts.length - 1; k += 1) {
        if (cum[k + 1] <= revLen) {
          ctx.lineTo(pts[k + 1][0], pts[k + 1][1]);
        } else if (cum[k] < revLen) {
          const f = (revLen - cum[k]) / (cum[k + 1] - cum[k]);
          ctx.lineTo(
            pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f,
            pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f,
          );
          break;
        } else {
          break;
        }
      }
      ctx.stroke();
      ctx.restore();
      // Endpoint rings in the route colour, pivot rings in the pivot colour;
      // each appears as the revealed line reaches it.
      ctx.save();
      for (let k = 0; k < pts.length; k += 1) {
        if (cum[k] > revLen + 0.5) break;
        const isEnd = k === 0 || k === pts.length - 1;
        ctx.strokeStyle = isEnd
          ? `rgba(${cr},${cg},${cb},0.95)`
          : `rgba(${vr},${vg},${vb},0.92)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pts[k][0], pts[k][1], isEnd ? 7.5 : 5.5, 0, 6.2832);
        ctx.stroke();
      }
      ctx.restore();
    }

    // SEAM-ONLY: AIM-LINKS — thin dashed-teal links accreting from the covered
    // core toward the overlooked margin: the network visibly LINKING UP. Faint,
    // thin, dashed, brand-teal (predicted/aim, NEVER measured coverage).
    if (this.aimLinks && this.aimLinks.pairs.length && this.aimLinks.reveal > 0.01) {
      const rev = clamp01(this.aimLinks.reveal);
      const nlk = this.aimLinks.pairs.length;
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = -(now * 0.02) % 10;
      ctx.lineWidth = 0.8;
      ctx.shadowColor = 'rgba(77,216,255,0.5)';
      ctx.shadowBlur = 4;
      this.aimLinks.pairs.forEach((pr, i) => {
        const a = clamp01(rev * nlk - i) * 0.42;
        if (a < 0.02) return;
        const x0 = this.sx(this.xs[pr[0]], L);
        const y0 = this.sy(this.ys[pr[0]], L);
        const x1 = this.sx(this.xs[pr[1]], L);
        const y1 = this.sy(this.ys[pr[1]], L);
        ctx.strokeStyle = `rgba(77,216,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        // a small teal node-dot where a link touches an overlooked language
        ctx.fillStyle = `rgba(77,216,255,${(a * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x0, y0, 1.6, 0, 6.2832);
        ctx.fill();
      });
      ctx.restore();
    }

    // SEAM-ONLY: the routing SEARCH → RESOLVE (linking/routing justice). THE LINK
    // grammar — candidates render faint dashed TEAL (predicted/exploring); losers
    // fade as the winner resolves; the winner's per-hop segments SOLIDIFY into
    // their measured-hop colour (green/orange/red); a dashed-teal AIM overlay
    // spans the whole route. The target is NEVER painted green — teal aim only.
    if (this.routeSearch && this.routeSearch.candidates && this.routeSearch.candidates.length) {
      const rs = this.routeSearch;
      const searchA = clamp01(rs.searchA || 0);
      const resolveA = clamp01(rs.resolveA || 0);
      const aimA = clamp01(rs.aimA || 0);
      const proj = (idx) => [this.sx(this.xs[idx], L), this.sy(this.ys[idx], L)];
      const dash = -(now * 0.03) % 13;
      ctx.globalCompositeOperation = 'source-over';

      // (1) candidate fan — faint dashed teal; losers fade as the winner resolves
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = dash;
      rs.candidates.forEach((c, ci) => {
        if (!c.seq || c.seq.length < 2) return;
        const isWin = ci === rs.winnerIdx;
        const a = (isWin ? 0.24 : 0.13) * searchA * (isWin ? 1 : 1 - resolveA);
        if (a < 0.02) return;
        const pts = c.seq.map(proj);
        ctx.strokeStyle = `rgba(77,216,255,${a.toFixed(3)})`;
        ctx.lineWidth = isWin ? 1.5 : 1.1;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k += 1) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.stroke();
      });
      ctx.restore();

      const win = rs.candidates[rs.winnerIdx];
      if (win && win.seq && win.seq.length >= 2) {
        const wp = win.seq.map(proj);
        const nHop = wp.length - 1;
        // (2) winner per-hop segments SOLIDIFY into their measured-hop colour
        ctx.save();
        ctx.setLineDash([]);
        for (let k = 0; k < nHop; k += 1) {
          const segT = clamp01(resolveA * nHop - k);
          if (segT <= 0) break;
          const [r, g, b] = (win.hopCols && win.hopCols[k]) || [77, 216, 255];
          const [ax, ay] = wp[k];
          ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
          ctx.lineWidth = 2.2;
          ctx.shadowColor = `rgba(${r},${g},${b},0.7)`;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + (wp[k + 1][0] - ax) * segT, ay + (wp[k + 1][1] - ay) * segT);
          ctx.stroke();
        }
        ctx.restore();
        // (3) end-to-end AIM overlay — dashed teal over the whole winner
        if (aimA > 0.01) {
          ctx.save();
          ctx.setLineDash([7, 6]);
          ctx.lineDashOffset = dash;
          ctx.strokeStyle = `rgba(77,216,255,${(0.55 * aimA).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(wp[0][0], wp[0][1]);
          for (let k = 1; k < wp.length; k += 1) ctx.lineTo(wp[k][0], wp[k][1]);
          ctx.stroke();
          ctx.restore();
        }
        // (4) yellow pivot rings on interior nodes, teal endpoints
        ctx.save();
        for (let k = 0; k < wp.length; k += 1) {
          const appear = clamp01(resolveA * nHop - (k - 0.5));
          if (appear <= 0) continue;
          const isEnd = k === 0 || k === wp.length - 1;
          ctx.strokeStyle = isEnd
            ? `rgba(77,216,255,${(0.95 * appear).toFixed(3)})`
            : `rgba(255,207,77,${(0.92 * appear).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(wp[k][0], wp[k][1], isEnd ? 7.5 : 5.5, 0, 6.2832);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Packets: light pulses on curved routes with decaying trails. Mesh
    // packets carry their METHOD's colour; binary packets are a single
    // teal-white — illustrative traffic among covered languages, method
    // identity being mesh-mode information (founder 2026-07-19).
    ctx.globalCompositeOperation = this.dark ? 'lighter' : 'source-over';
    for (const p of this.packets) {
      const [pr, pg, pb] = p.col
        ? p.col
        : p.binary
          ? this.binaryPacketCol
          : (p.method && this.packetColBy && this.packetColBy[p.method]) ||
            this.packetCol;
      const sprite = p.sprite
        ? p.sprite
        : p.binary
          ? this.spPacketBinary
          : (p.method && this.spPacketBy && this.spPacketBy[p.method]) ||
            this.spPacket;
      const t = clamp01((now - p.born) / p.dur);
      const pos = this.bez(p, easeInOut(t));
      // The route itself: a faint curve from source to target while the
      // packet flies — the network's wiring made momentarily visible.
      const routeA = (p.landed ? 1 - clamp01((now - p.landAt) / 1100) : 1) * 0.13;
      if (routeA > 0.01) {
        ctx.strokeStyle = `rgba(${pr},${pg},${pb},${routeA.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.sx(p.x0, L), this.sy(p.y0, L));
        ctx.quadraticCurveTo(
          this.sx(p.cx, L),
          this.sy(p.cy, L),
          this.sx(p.x1, L),
          this.sy(p.y1, L),
        );
        ctx.stroke();
      }
      p.trail.push(pos.x, pos.y);
      if (p.trail.length > TRAIL_N * 2) p.trail.splice(0, p.trail.length - TRAIL_N * 2);
      const m = p.trail.length / 2;
      const fade = p.landed ? 1 - clamp01((now - p.landAt) / 1100) : 1;
      if (m > 1 && fade > 0.02) {
        ctx.lineCap = 'round';
        for (let s = 1; s < m; s += 1) {
          const a = (s / m) ** 1.5 * 0.78 * fade;
          ctx.strokeStyle = `rgba(${pr},${pg},${pb},${a.toFixed(3)})`;
          ctx.lineWidth = 1.2 + (s / m) * 3;
          ctx.beginPath();
          ctx.moveTo(
            this.sx(p.trail[(s - 1) * 2], L),
            this.sy(p.trail[(s - 1) * 2 + 1], L),
          );
          ctx.lineTo(this.sx(p.trail[s * 2], L), this.sy(p.trail[s * 2 + 1], L));
          ctx.stroke();
        }
      }
      if (!p.landed) {
        const x = this.sx(pos.x, L);
        const y = this.sy(pos.y, L);
        const s = 30;
        ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
        ctx.drawImage(sprite, x - 9, y - 9, 18, 18); // hot core
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // Pulses: landing rings + the smaller through-hub flashes.
    for (const pu of this.pulses) {
      const t = clamp01((now - pu.born) / 900);
      const x = this.sx(pu.x, L);
      const y = this.sy(pu.y, L);
      const [ur, ug, ub] = pu.col || this.packetCol;
      ctx.strokeStyle = `rgba(${ur},${ug},${ub},${((pu.small ? 0.45 : 0.6) * (1 - t)).toFixed(3)})`;
      ctx.lineWidth = pu.small ? 1.1 : 1.4;
      ctx.beginPath();
      ctx.arc(x, y, pu.small ? 4 + easeOut(t) * 13 : 6 + easeOut(t) * 26, 0, 6.2832);
      ctx.stroke();
      // SEAM-ONLY: a metric-NAME instrument glyph rising off the landing —
      // slate monospace (deliberately NON-semantic: not quality green/red, not
      // brand teal), a momentary "measured by <metric>" readout. Names only,
      // no numbers on the open map (nothing to caveat). Show don't tell.
      if (pu.label) {
        const gt = clamp01((now - pu.born) / 620);
        const a = (1 - gt) * 0.55;
        if (a > 0.02) {
          ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = `rgba(139,149,167,${a.toFixed(3)})`;
          ctx.fillText(pu.label, x + 8, y - 7 - gt * 13);
        }
      }
    }

    // Hover ring.
    if (this.hoverIdx >= 0) {
      const i = this.hoverIdx;
      const li = this.layer[i];
      const x = this.sx(this.xs[i], li);
      const y = this.sy(this.ys[i], li);
      ctx.strokeStyle = this.inkAt(0.85);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, this.nodeR(i) + 5, 0, 6.2832);
      ctx.stroke();
    }
    // Focus ring (search lift).
    if (this.focus && now < this.focus.until) {
      const i = this.focus.idx;
      const x = this.sx(this.xs[i], this.layer[i]);
      const y = this.sy(this.ys[i], this.layer[i]);
      const blink = 0.55 + 0.35 * Math.sin(now * 0.006);
      ctx.strokeStyle = this.inkAt(blink);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, this.nodeR(i) + 9, 0, 6.2832);
      ctx.stroke();
    } else if (this.focus) {
      this.focus = null;
    }
  }
}
