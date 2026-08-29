/**
 * Generates `data/graph.json` + `data/graph-poster.json` — THE TRANSLATION
 * NETWORK dataset for the graph hero (lab stage: src/pages/graph-lab.js).
 *
 * The hero shows every catalogued language as a node in a living network
 * mesh: benchmarked languages are lit routers, queued languages half-glow,
 * and the dark mass of nodes is the work remaining. Real translation
 * packets travel routes between REAL benchmarked pair endpoints (the same
 * runs/sentences as data/field.json).
 *
 * LAYOUT — force-directed at build time (revised concept,
 * .claude plan "The Whole Graph", Track 1): language families cluster as
 * organic neighborhoods. Two-level simulation, fully deterministic
 * (seeded PRNG, no Math.random):
 *   1. Families (248 + isolate/unknown pseudo-families) are discs with
 *      radius ∝ sqrt(member count), initialized in macroarea sectors
 *      (a geographic whisper: Africa, Eurasia, Papunesia, the Americas,
 *      Australia each keep a side of the canvas) and relaxed with a
 *      collision-repulsion + anchor-spring force pass — neighborhoods
 *      pack organically without overlapping.
 *   2. Members are placed inside their family disc on a phyllotaxis
 *      spiral ordered by genus, so genera form contiguous arcs inside
 *      each neighborhood; seeded jitter keeps it organic, not gridded.
 *
 * TRUTHFULNESS (lab page is pre-integration; CLAIMS.md rows are drafted
 * in the build report and land with phase 4):
 *   - Node set: data/tc-index.json verbatim (7,959 languages).
 *   - Endonyms: joined from data/wall.json — verified endonyms only.
 *   - lit  = the language appears in a benchmarked pair (either side) on
 *     the Arena scoreboard (Supabase run_cards) — the system of record,
 *     never local harness logs (design directive).
 *   - queued = the language is the target of an open item in
 *     static/queue.json and is not already lit.
 *   - dark = everything else. Nothing is invented.
 *   - Routes: the field.json run pairs with each run's REAL run-level
 *     composite score (from the DB, carried on field.runs[].composite).
 *
 * tc-index.json (DB-derived, gitignored) is generated from Supabase by the
 * website `ensure-tc-index` prestart/prebuild step, so the graph regenerates
 * from the live scoreboard in every build (Vercel included); graph.json /
 * graph-poster.json are build artifacts, not committed snapshots. An
 * unreachable scoreboard during graph generation keeps any existing file.
 */

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const {fetchBenchmarkedPairs} = require('./supabaseRuns');
const {assertTcIndexTaxonomy} = require('../../scripts/lib/tc-index-remote');

/** Bump to force a layout/profile regeneration. */
// v10: brightness is strictly method coverage (benchmarked no longer lights
// nodes); living-qualified + tiered coverage stats (service vs open models,
// at-risk via Glottolog AES); methodEdges are per-method covered PAIRS for
// any-to-any providers and hub↔language shuttles for per-pair providers
// (OPUS-MT, Tilde); poster ships hubs + spokes + per-node vitality and NO
// registered routes (the ambient layer is an explicit default-off chip now);
// poster.monolith feeds the seam's true NLLB-200 scene.
// v11: hub ellipse gets a half-step angular offset (no hub at top-center,
// where the hero copy overlay swallowed the Google label) — engine twin.
// v12: monolith generalized from NLLB-only to ALL centralized MT (founder:
// "the problem is the same with Google Translate, with most MT") — covered
// flag = any dedicated engine (living union, 383), per-method list shipped
// for the seam's citation tip.
// v18 (R3, 2026-07-22d): ADDITIVE geo layout — cols.gx/gy carry a rough
// world-map (equirectangular Glottolog lat/lng) projection beside the family
// blobs (cols.x/y). /home-preview opts in (layout:'geo'); the poster, the live
// map, and every other consumer keep reading x/y and stay byte-identical.
const GENERATOR_VERSION = 18;

// Twin of the engine's first-frame camera + parallax (GraphEngine.js fit()
// and PF). If either changes there, change it here — the poster must frame
// the world exactly as the engine's first frame does.
const CAM_ZMUL = 1.16; // desktop opening zoom over zFit (mobile uses 1.05)
const CAM_BIAS = 0.32; // pull toward the lit centroid
const CAM_DOWN = 0.05; // downward bias (keeps Eurasia off the navbar)
const PF = [0.94, 1, 1.06]; // parallax factor per depth layer

const {
  COMMERCIAL_MASK,
  OPEN_MASK,
  coverageTier,
} = require('../../src/utils/pairReachability');

/**
 * Dedicated machine-translation engines whose published per-language support
 * lists are tracked in each card's `methodSupport` (cited `api-verification-2026`).
 * A language "lit" by COVERAGE = supported by at least one of these. The `llm`
 * method is tracked separately: an LLM can attempt any language, so it lights
 * the dim ambient layer (the frontier), not the bright dedicated-MT core.
 */
const DEDICATED_MT = [
  'googleTranslate',
  'deepl',
  'microsoftTranslator',
  'libreTranslate',
  'nllb',
];
const isSupported = (ms, key) => !!(ms && ms[key] && ms[key].supported);

/**
 * Per-method coverage bits — the map lights by which DEDICATED machine
 * translators actually cover a language (a method can intertranslate within its
 * own covered set), NOT by "LLM-reachable" (everything is, so it means nothing —
 * by design). Each method is a toggleable layer; bit order is fixed so
 * the client can decode the per-node mask + filter edges. `opus` (OPUS-MT /
 * Tatoeba) and `tilde` coverage come only from the imported
 * method-coverage.json (no card methodSupport key).
 */
// tier/anyToAny fallbacks mirror shared/catalogue/method-coverage.json (the
// SSOT; its per-method fields override these when the import file is present).
// anyToAny=false (OPUS-MT, Tilde) = per-pair/per-engine models: coverage of a
// language never implies a given PAIR exists, so their packets shuttle
// hub↔language instead of asserting language pairs.
const METHOD_BITS = [
  {key: 'google-translate', bit: 1, msKeys: ['googleTranslate'], tier: 'service', anyToAny: true},
  {key: 'microsoft-translator', bit: 2, msKeys: ['microsoftTranslator', 'microsoft'], tier: 'service', anyToAny: true},
  {key: 'deepl', bit: 4, msKeys: ['deepl'], tier: 'service', anyToAny: true},
  {key: 'libretranslate', bit: 8, msKeys: ['libreTranslate'], tier: 'service', anyToAny: true},
  {key: 'nllb', bit: 16, msKeys: ['nllb'], tier: 'open', anyToAny: true},
  {key: 'opus', bit: 32, msKeys: [], tier: 'open', anyToAny: false}, // from method-coverage.json (import)
  {key: 'tilde', bit: 64, msKeys: [], tier: 'open', anyToAny: false}, // from method-coverage.json (import)
  // translated (Lara) is reserved for bit 128 but NOT wired yet: its
  // method-coverage.json entry is count-only (empty iso6393, list pending
  // import), so a layer would render a legend chip with zero nodes. Add
  // {key: 'translated', bit: 128, msKeys: []} once the language list lands.
  // Small open models (founder directive 2026-07-19: the map must include
  // the small research models — Helsinki-style per-pair AND the compact
  // many-to-many ones). Lists derived from pinned model-card snapshots by
  // cli/scripts/derive-method-coverage-small-models.mjs. Bits >127 need
  // the engine's Uint16 mask (GraphEngine decodes cols.m into Uint16Array).
  {key: 'm2m100', bit: 256, msKeys: [], tier: 'open', anyToAny: true},
  {key: 'madlad', bit: 512, msKeys: [], tier: 'open', anyToAny: true},
];

/** World coordinate grid (square). 2048 keeps coords ≤4 digits — the
 * payload budget (≤120KB gz) is set by coordinate entropy + names. */
const WORLD = 2048;

/** Macroarea anchor angles (deg, 0 = east, CCW) — a geographic whisper. */
const MACRO_ANGLES = {
  'North America': 155,
  'South America': 205,
  Africa: 265,
  Eurasia: 75,
  Papunesia: 5,
  Australia: 318,
};
const ANCHOR_R = 0.46; // of world half-size

/** Vitality LEVEL (full AES resolution, v13): glottolog-aes level →
 * 0 thriving · 1 shifting · 2 endangered · 3 critical · 4 dormant ·
 * 5 unknown. The packed column stays v*15+q*3+st (q*3+st ≤ 14, so any
 * v range decodes uniquely). The level table is the CROSS-RUNTIME SSOT
 * src/utils/vitalityScale.js (same pattern as pairReachability) — this
 * generator, GraphEngine, PosterSvg, and the endangerment explorer all
 * read the ONE table; there is no local copy to drift. An unrecognized
 * non-null level fails the build loudly (see the node loop) so upstream
 * vocabulary drift can never silently bucket languages as unknown. */
const {
  VITALITY_LEVELS,
  V_UNKNOWN: VITALITY_UNKNOWN,
} = require('../../src/utils/vitalityScale');
const VITALITY_TIER = Object.fromEntries(
  VITALITY_LEVELS.map((l) => [l.id, l.v]),
);

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Two-level deterministic force layout.
 * @returns Map code → {x, y} in world coords.
 */
function layout(langs, rand) {
  // ---- group into (pseudo-)families --------------------------------
  const famOf = (l) => (l.isIsolate ? '(isolates)' : l.family || 'Unknown');
  const famMap = new Map();
  for (const l of langs) {
    const f = famOf(l);
    if (!famMap.has(f)) famMap.set(f, []);
    famMap.get(f).push(l);
  }
  const families = [...famMap.entries()].map(([name, members]) => {
    // Majority macroarea decides the anchor sector.
    const counts = {};
    for (const m of members) {
      const ma = (m.macroarea || '').split(';')[0];
      if (MACRO_ANGLES[ma] != null) counts[ma] = (counts[ma] || 0) + 1;
    }
    let best = null;
    for (const k of Object.keys(counts)) {
      if (!best || counts[k] > counts[best]) best = k;
    }
    return {name, members, macro: best};
  });
  // Stable order: big families first (they claim space), then name.
  families.sort(
    (a, b) => b.members.length - a.members.length || (a.name < b.name ? -1 : 1),
  );

  // ---- level 1: family discs ----------------------------------------
  // Disc area budget ≈ 42% of the world square.
  const totalN = langs.length;
  const C = Math.sqrt(
    (0.42 * WORLD * WORLD) / (Math.PI * (totalN + families.length * 3)),
  );
  const cx = WORLD / 2;
  const cy = WORLD / 2;
  const half = WORLD / 2;
  const perMacroIdx = {};
  for (const f of families) {
    f.r = C * Math.sqrt(f.members.length + 3);
    const ang =
      f.macro != null
        ? (MACRO_ANGLES[f.macro] * Math.PI) / 180
        : rand() * Math.PI * 2;
    const i = (perMacroIdx[f.macro || '?'] = (perMacroIdx[f.macro || '?'] || 0) + 1);
    // Spiral out from the sector anchor so init has no exact overlaps.
    const spread = 0.16 * half * Math.sqrt(i);
    const a2 = ang + (i - 1) * GOLDEN;
    const ar = f.macro != null ? ANCHOR_R * half : 0;
    f.ax = cx + Math.cos(ang) * ar;
    f.ay = cy - Math.sin(ang) * ar;
    f.x = f.ax + Math.cos(a2) * spread;
    f.y = f.ay - Math.sin(a2) * spread;
  }

  // Relaxation: disc-collision repulsion + weak anchor spring + bounds.
  const PAD = 26;
  const ITER = 720;
  for (let it = 0; it < ITER; it += 1) {
    const heat = 1 - it / ITER;
    for (let i = 0; i < families.length; i += 1) {
      const a = families[i];
      for (let j = i + 1; j < families.length; j += 1) {
        const b = families[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + PAD;
        if (d < min) {
          if (d < 1e-6) {
            const t = rand() * Math.PI * 2;
            dx = Math.cos(t);
            dy = Math.sin(t);
            d = 1;
          }
          const push = ((min - d) / d) * (0.5 + 0.3 * heat);
          // Lighter discs yield more (mass ∝ r²).
          const wa = b.r * b.r;
          const wb = a.r * a.r;
          const wt = wa + wb;
          a.x -= dx * push * (wa / wt);
          a.y -= dy * push * (wa / wt);
          b.x += dx * push * (wb / wt);
          b.y += dy * push * (wb / wt);
        }
      }
      // Anchor spring — keeps macroarea neighborhoods coherent.
      a.x += (a.ax - a.x) * 0.012 * heat;
      a.y += (a.ay - a.y) * 0.012 * heat;
      // Soft bounds.
      const margin = a.r * 0.55 + 30;
      if (a.x < margin) a.x += (margin - a.x) * 0.3;
      if (a.x > WORLD - margin) a.x -= (a.x - (WORLD - margin)) * 0.3;
      if (a.y < margin) a.y += (margin - a.y) * 0.3;
      if (a.y > WORLD - margin) a.y -= (a.y - (WORLD - margin)) * 0.3;
    }
  }

  // ---- level 2: members on a genus-ordered phyllotaxis spiral -------
  const pos = new Map();
  for (const f of families) {
    const ms = [...f.members].sort((a, b) => {
      const ga = a.genus || '~';
      const gb = b.genus || '~';
      if (ga !== gb) return ga < gb ? -1 : 1;
      return a.code < b.code ? -1 : 1;
    });
    const n = ms.length;
    const fr = mulberry32(hash32(f.name));
    const phase = fr() * Math.PI * 2;
    // Organic, not bubble-chart: each neighborhood is a seeded ellipse
    // (squash 0.72–1) at a seeded rotation, and jitter grows toward the
    // rim so disc edges feather instead of reading as drawn circles.
    const squash = 0.72 + fr() * 0.28;
    const tilt = fr() * Math.PI;
    const ct = Math.cos(tilt);
    const stl = Math.sin(tilt);
    const R = f.r * 0.94;
    for (let i = 0; i < n; i += 1) {
      const l = ms[i];
      const jr = mulberry32(hash32(l.code));
      if (n === 1) {
        pos.set(l.code, {x: f.x, y: f.y});
        continue;
      }
      const frac = (i + 0.5) / n;
      const rad = R * Math.sqrt(frac);
      const ang = phase + i * GOLDEN;
      let ex = Math.cos(ang) * rad;
      let ey = Math.sin(ang) * rad * squash;
      const rx = ex * ct - ey * stl;
      const ry = ex * stl + ey * ct;
      const j = R * (0.05 + 0.13 * frac);
      pos.set(l.code, {
        x: f.x + rx + (jr() - 0.5) * j,
        y: f.y + ry + (jr() - 0.5) * j,
      });
    }
  }

  // Normalize into the world grid with a margin.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pos.values()) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const M = 90;
  const s = Math.min(
    (WORLD - 2 * M) / (maxX - minX),
    (WORLD - 2 * M) / (maxY - minY),
  );
  const ox = (WORLD - s * (maxX - minX)) / 2;
  const oy = (WORLD - s * (maxY - minY)) / 2;
  for (const p of pos.values()) {
    p.x = Math.round(ox + (p.x - minX) * s);
    p.y = Math.round(oy + (p.y - minY) * s);
  }
  return {pos, famOf};
}

/**
 * ADDITIVE geo layout (v18) — a rough WORLD MAP so the field reads as "linking
 * humanity" (founder R3). Equirectangular projection of Glottolog lat/lng into
 * the WORLD square, then a per-cell golden-spiral de-clump so co-located
 * languages (dense regions like West Africa or the Caucasus) spread into
 * readable dot fields instead of stacking on one pixel. Missing coordinates
 * fall back to their family's centroid (+ jitter). Doesn't need to be
 * pixel-perfect — it needs to read as continents.
 * @returns Map code → {x, y} in world coords.
 */
function geoLayout(langs, coordsByCode) {
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  // 1) raw equirectangular unit coords for languages that have coordinates,
  //    accumulating family centroids for the fallback.
  const famOf = (l) => (l.isIsolate ? '(isolates)' : l.family || 'Unknown');
  const raw = new Map();
  const famCentroid = new Map(); // fam → {sx, sy, n}
  for (const l of langs) {
    const c = coordsByCode.get(l.code);
    if (!c) continue;
    const x = clamp01((c.lng + 180) / 360);
    const y = clamp01((90 - c.lat) / 180); // north up
    raw.set(l.code, {x, y});
    const f = famOf(l);
    const fc = famCentroid.get(f) || {sx: 0, sy: 0, n: 0};
    fc.sx += x;
    fc.sy += y;
    fc.n += 1;
    famCentroid.set(f, fc);
  }
  // 2) fallback for languages without coordinates: their family's centroid
  //    (+ small deterministic jitter), else the map centre.
  for (const l of langs) {
    if (raw.has(l.code)) continue;
    const jr = mulberry32(hash32(`geo-${l.code}`));
    const fc = famCentroid.get(famOf(l));
    if (fc && fc.n) {
      raw.set(l.code, {
        x: clamp01(fc.sx / fc.n + (jr() - 0.5) * 0.05),
        y: clamp01(fc.sy / fc.n + (jr() - 0.5) * 0.05),
      });
    } else {
      raw.set(l.code, {x: 0.5 + (jr() - 0.5) * 0.24, y: 0.5 + (jr() - 0.5) * 0.24});
    }
  }
  // 3) unit → world px with a margin.
  const M = 120;
  const inner = WORLD - 2 * M;
  const px = new Map();
  for (const l of langs) {
    const p = raw.get(l.code);
    px.set(l.code, {x: M + p.x * inner, y: M + p.y * inner});
  }
  // 4) de-clump: bucket into a coarse grid, and where a cell holds many
  //    languages, fan them out on a golden-angle spiral around the cell
  //    centroid so dense regions become dot fields, not one hot pixel.
  const CELL = 16;
  const buckets = new Map();
  for (const l of langs) {
    const p = px.get(l.code);
    const key = `${Math.round(p.x / CELL)}:${Math.round(p.y / CELL)}`;
    const arr = buckets.get(key) || [];
    arr.push(l.code);
    buckets.set(key, arr);
  }
  const pos = new Map();
  for (const arr of buckets.values()) {
    if (arr.length === 1) {
      pos.set(arr[0], px.get(arr[0]));
      continue;
    }
    let cx = 0;
    let cy = 0;
    for (const code of arr) {
      const p = px.get(code);
      cx += p.x;
      cy += p.y;
    }
    cx /= arr.length;
    cy /= arr.length;
    const spread = CELL * (0.6 + 0.5 * Math.sqrt(arr.length));
    arr.forEach((code, i) => {
      const rad = spread * Math.sqrt((i + 0.5) / arr.length);
      const ang = i * GOLDEN;
      pos.set(code, {x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad});
    });
  }
  // 5) round + clamp into the world square.
  for (const [code, p] of pos) {
    pos.set(code, {
      x: Math.round(Math.min(WORLD - 8, Math.max(8, p.x))),
      y: Math.round(Math.min(WORLD - 8, Math.max(8, p.y))),
    });
  }
  return pos;
}

/**
 * @param {object} opts
 * @param {string} opts.tcIndexFile   data/tc-index.json
 * @param {string} opts.wallFile      data/wall.json
 * @param {string} opts.queueFile     static/queue.json
 * @param {string} opts.languagesFile data/languages.json (for iso639-1 aliases)
 * @param {string} opts.fieldFile     data/field.json (route manifest)
 * @param {string} opts.outFile       data/graph.json
 * @param {string} opts.posterFile    src/data/graph-poster.json (SSR import)
 * @param {string} [opts.externalResultsFile] cli/shared/catalogue/external-results.json
 * @param {string} [opts.externalMtIndexFile] shared/catalogue/external-mt-index.json (bulk best-published index)
 */
async function generateGraphJson({
  tcIndexFile,
  wallFile,
  queueFile,
  languagesFile,
  fieldFile,
  outFile,
  posterFile,
  externalResultsFile,
  externalMtIndexFile,
  methodCoverageFile,
  // static/mesh.json — the queue's registered/measured pair edges. The
  // poster draws the same classified pair routes the live engine draws,
  // so the crossfade is line-to-line. Fail-soft when absent.
  meshFile,
}) {
  // The node set is read from tc-index.json, which is DB-derived and gitignored
  // (absent in every clean clone — CI, Vercel). Without it we cannot regenerate
  // the layout, so keep the committed graph.json + graph-poster.json snapshot
  // (a real, recent build) and say so loudly. Only a local checkout that has the
  // built dataset regenerates. This is what lets `vercel build` (which clones the
  // whole monorepo, so arena/ exists but tc-index.json does not) succeed instead
  // of crashing with ENOENT.
  if (!(await fs.pathExists(tcIndexFile))) {
    if ((await fs.pathExists(outFile)) && (await fs.pathExists(posterFile))) {
      console.log(
        `[shared-data] graph.json: ${path.basename(tcIndexFile)} absent ` +
          '(DB-derived, gitignored) — keeping the existing graph.json. The ' +
          '`ensure-tc-index` prestart/prebuild step normally generates it from ' +
          'Supabase; run `npm run ensure-tc-index` to refresh.',
      );
      return;
    }
    throw new Error(
      `[shared-data] graph.json: ${tcIndexFile} absent. It is generated from ` +
        'Supabase by the `ensure-tc-index` prestart/prebuild step (runs ' +
        'automatically before start/build) — run `npm run ensure-tc-index` ' +
        '(needs network), then rebuild.',
    );
  }

  // Refuse to bake a hero from a taxonomy-less index: every living/at-risk
  // stat below reads isoType, so a schema-drifted Supabase round-trip (an
  // index written before the migration-056 columns + card-SSOT heal landed)
  // would silently ship atRisk=0 / coveredLiving=0. ensure-tc-index now
  // heals or fails loud itself — an index that still lacks taxonomy here is
  // stale or hand-rolled, and regenerating it is the fix.
  const index = await fs.readJson(tcIndexFile);
  assertTcIndexTaxonomy(index, tcIndexFile);

  // ---- coverage states (from the DB scoreboard, never local logs) ----
  let reportPairs;
  try {
    reportPairs = await fetchBenchmarkedPairs();
  } catch (err) {
    if ((await fs.pathExists(outFile)) && (await fs.pathExists(posterFile))) {
      console.log(
        `[shared-data] graph.json: scoreboard unreachable (${err.message}) — keeping committed snapshot`,
      );
      return;
    }
    reportPairs = new Set(); // no snapshot to keep — build the all-dark map
  }
  const reportCount = reportPairs.size;

  // Canonical code normalizer (iso639_1 / card aliases → ISO 639-3), from the
  // language-card SSOT. run_cards.language_pair MAY carry 2-letter or alternate
  // codes (publish.py's _resolve_lang_to_code fallback, MT-adapter native codes
  // like Google's "iw"), and node codes from tc-index.json are 3-letter — so the
  // lit set, queued set, and routes must normalize to 3-letter before matching,
  // the SAME resolution the client (GraphHero.js promote/gateLiveRoutes) applies
  // to live routes. This map is also shipped in graph.json for that client use.
  const alias = {};
  // Coverage from the language cards' `methodSupport` (cited api-verification-2026).
  // coverage.get(code) = {ded, llm, living}: dedicated-MT support, LLM reach, and
  // whether the language is living (isoType 'L'). This drives the hero's lit tiers
  // and the displayed coverage counts. No values invented — read straight from the
  // cited cards.
  const coverage = new Map();
  const methodCounts = {
    googleTranslate: 0,
    microsoftTranslator: 0,
    deepl: 0,
    libreTranslate: 0,
    nllb: 0,
    tilde: 0, // no card methodSupport key — filled from method-coverage.json only
    llm: 0,
  };
  let catalogTotal = 0;
  let livingTotal = 0;
  let dedicatedTotal = 0;
  // Per-node method coverage bitmask (which dedicated MT engines cover each
  // language). Drives the lit set, the per-method toggle layers, and the
  // intertranslatable edges. Keyed by canonical 3-letter code.
  const maskByCode = new Map();
  // Glottolog lat/lng per code (v18 geo layout). Populated from the language
  // cards' `coordinates` block; the join is by canonical code, so it survives
  // the method-coverage override that later clears maskByCode.
  const coordsByCode = new Map();
  try {
    const allCards = await fs.readJson(languagesFile);
    // A LOCALE IS NOT A LANGUAGE.
    //
    // `fra-CA` is French projected onto Canada, not a language in its own
    // right. The corpus now serves 8,675 locale cards beside 8,685 languages,
    // and counting the files gave 17,360 — which would have published "17,360
    // languages" on the homepage and a living-language count of 14,922, both
    // roughly double the truth, by double-counting French once per territory.
    //
    // Locale cards identify themselves with a `locale` block naming their
    // parent, so they are excluded here rather than guessed at from the code
    // shape.
    const cards = allCards.filter((c) => !c?.locale?.language);
    catalogTotal = cards.length;
    for (const c of cards) {
      if (!c || !c.code) continue;
      const co = c.coordinates;
      if (co && Number.isFinite(co.lat) && Number.isFinite(co.lng)) {
        coordsByCode.set(c.code, {lat: co.lat, lng: co.lng});
      }
      if (c.iso639_1 && c.iso639_1 !== c.code && !alias[c.iso639_1]) {
        alias[c.iso639_1] = c.code; // "fr" → "fra", "cy" → "cym"
      }
      if (Array.isArray(c.aliases)) {
        for (const a of c.aliases) {
          if (a && a !== c.code && !alias[a]) alias[a] = c.code; // "iw" → "heb"
        }
      }
      const ms = c.methodSupport;
      const living = c.isoType === 'L';
      if (living) livingTotal += 1;
      let mask = 0;
      for (const m of METHOD_BITS) {
        if (m.msKeys.some((k) => isSupported(ms, k))) mask |= m.bit;
      }
      const ded = mask !== 0;
      if (ded) dedicatedTotal += 1;
      for (const k of Object.keys(methodCounts)) {
        if (isSupported(ms, k)) methodCounts[k] += 1;
      }
      maskByCode.set(c.code, mask);
      coverage.set(c.code, {ded, living});
    }
  } catch (e) {
    /* alias/coverage map is an enhancement; 3-letter pairs still resolve directly */
  }
  const norm = (code) => alias[code] || code;

  // AUTHORITATIVE per-method coverage: the imported, cited per-provider language
  // lists (shared/catalogue/method-coverage.json — Google/Microsoft/DeepL/
  // LibreTranslate/NLLB/OPUS-MT, each with a source_url + ISO-639-3 codes). When
  // present it OVERRIDES the card-methodSupport mask above (fuller + freshly
  // cited; project asked to "import everything"). methodSupport stays the
  // fallback when the import file is absent.
  let opusCount = 0;
  const methodMeta = []; // [{key,bit,count,source_url,asOf}]
  if (methodCoverageFile && (await fs.pathExists(methodCoverageFile))) {
    try {
      const cov = await fs.readJson(methodCoverageFile);
      const byKey = {};
      for (const m of cov.methods || []) byKey[m.key] = m;
      // Rebuild the mask + counts from the imported lists (authoritative).
      maskByCode.clear();
      for (const k of Object.keys(methodCounts)) methodCounts[k] = 0;
      for (const def of METHOD_BITS) {
        const entry = byKey[def.key];
        if (!entry) continue;
        const codes = entry.iso6393 || entry.languages || [];
        let n = 0;
        for (const raw of codes) {
          const code = norm(String(raw).trim());
          if (!code || !/^[a-z]{3}$/.test(code)) continue;
          maskByCode.set(code, (maskByCode.get(code) || 0) | def.bit);
          n += 1;
        }
        const stated = typeof entry.count === 'number' ? entry.count : n;
        if (def.key === 'opus') opusCount = stated;
        else {
          // METHOD_BITS keys are the SSOT's own ids (`google-translate`);
          // methodCounts keys are camelCase (`googleTranslate`). This mapping
          // still tested the SHORT names — `def.key === 'google'` — which
          // stopped matching when b3690ffdb gave each method one identity, so
          // `ck` stayed `google-translate`, was not a key of methodCounts, and
          // the count silently remained 0. The homepage showed Google,
          // Microsoft and LibreTranslate covering ZERO languages while the
          // SSOT said 194, 135 and 49.
          // Declared, not inferred: `google-translate` → `googleTranslate` is a
          // hyphen rule, but `libretranslate` → `libreTranslate` is not — the
          // SSOT spells it as one word and the counter camel-cases it. A regex
          // handles the first and silently drops the second, which is how
          // LibreTranslate kept reading 0 after Google and Microsoft were
          // fixed. One table, and the warning below catches anything it misses.
          const COUNTER_KEY = {
            'google-translate': 'googleTranslate',
            'microsoft-translator': 'microsoftTranslator',
            libretranslate: 'libreTranslate',
          };
          const ck = COUNTER_KEY[def.key] ?? def.key;
          if (ck in methodCounts) {
            methodCounts[ck] = stated;
          } else {
            // A method the SSOT covers but this display has no slot for is a
            // real gap: it renders as absent rather than as zero, and saying so
            // is how the next rename gets caught in one build instead of three.
            console.warn(`[shared-data] method '${def.key}' has coverage ${stated} in the SSOT `
              + `but no '${ck}' counter — it will not appear in the coverage stats`);
          }
        }
        methodMeta.push({
          key: def.key,
          bit: def.bit,
          count: stated,
          source_url: entry.source_url || null,
          asOf: entry.asOf || cov.asOf || null,
          tier: entry.tier || def.tier,
          anyToAny: typeof entry.anyToAny === 'boolean' ? entry.anyToAny : def.anyToAny,
          // Service-card metadata (hub cards on the hero map) — catalogue
          // facts riding straight through; absent fields stay null, never
          // invented.
          homepage: entry.homepage || null,
          license: entry.license || null,
          nature: entry.nature || null,
        });
      }
    } catch (e) {
      console.log(`[shared-data] graph.json: method-coverage.json read failed (${e.message}) — using card methodSupport.`);
    }
  }
  // Recompute the dedicated-coverage union over the FINAL mask.
  dedicatedTotal = 0;
  for (const m of maskByCode.values()) if (m !== 0) dedicatedTotal += 1;

  const lit = new Set();
  for (const p of reportPairs) {
    const [a, b] = p.split('>');
    if (a) lit.add(norm(a));
    if (b) lit.add(norm(b));
  }
  // queueFile (static/queue.json) is produced by the ensure-network-artifacts
  // prebuild step, not committed. If it's somehow absent (a cold build where
  // generation + Storage both failed), degrade to no queued-coverage overlay
  // rather than crashing the whole site build — lit nodes from the scoreboard
  // are unaffected, and the absence is logged, never hidden.
  let queue = { items: [] };
  try {
    queue = await fs.readJson(queueFile);
  } catch (e) {
    console.log(
      `[shared-data] graph.json: ${queueFile} unavailable (${e.message}) — ` +
        'building without the queued-coverage overlay. Run the ' +
        'ensure-network-artifacts prebuild step to produce it.',
    );
  }
  const queued = new Set();
  for (const it of queue.items || []) {
    const m = /^([a-z]{2,3})>([a-z]{2,3})$/.exec(it.language_pair || '');
    if (m && !lit.has(norm(m[2]))) queued.add(norm(m[2]));
  }

  // ---- benchmarked languages (measured frontier) ---------------------
  // Distinct languages that appear in a benchmark RESULT: our own runs
  // (reportPairs, from the scoreboard) plus cited external published results
  // (external-results.json — flagged "not reproduced by us", index-not-arbiter).
  const benchmarked = new Set();
  for (const p of reportPairs) {
    const [a, b] = p.split('>');
    if (a) benchmarked.add(norm(a));
    if (b) benchmarked.add(norm(b));
  }
  let externalPairCount = 0;
  if (externalResultsFile && (await fs.pathExists(externalResultsFile))) {
    try {
      const ext = await fs.readJson(externalResultsFile);
      const seenPairs = new Set();
      for (const r of ext.results || []) {
        const p = r && r.pair;
        if (!p || !p.source || !p.target) continue;
        const s = norm(p.source);
        const t = norm(p.target);
        benchmarked.add(s);
        benchmarked.add(t);
        const key = `${s}>${t}`;
        if (!seenPairs.has(key)) {
          seenPairs.add(key);
          externalPairCount += 1;
        }
      }
    } catch (e) {
      console.log(
        `[shared-data] graph.json: external-results.json read failed (${e.message}) — ` +
          'hero benchmarked count omits external published results.',
      );
    }
  }

  // The BULK published-results index (external-mt-index.json — best published
  // score per pair across the Helsinki leaderboards, relative-only lane). Its
  // languages join the benchmarked set — a language NLLB/OPUS-MT published a
  // FLORES/NTREX/Tatoeba score for HAS a published benchmark (indexed, not
  // reproduced by us) — and the pair count feeds the hero provenance copy.
  let externalIndexedPairs = 0;
  if (externalMtIndexFile && (await fs.pathExists(externalMtIndexFile))) {
    try {
      const idx = await fs.readJson(externalMtIndexFile);
      const pairs = Object.keys(idx.pairs || {});
      externalIndexedPairs = pairs.length;
      for (const p of pairs) {
        const [rawA, rawB] = p.split('-');
        if (!rawB) continue;
        benchmarked.add(norm(rawA.split('_')[0]));
        benchmarked.add(norm(rawB.split('_')[0]));
      }
    } catch (e) {
      console.log(
        `[shared-data] graph.json: external-mt-index.json read failed (${e.message}) — ` +
          'hero benchmarked count omits the bulk published-results index.',
      );
    }
  }

  // ---- freshness / cache hash ----------------------------------------
  const statSig = async (f) => {
    const st = await fs.stat(f);
    return `${path.basename(f)}:${st.size}`;
  };
  const inputsHash = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        v: GENERATOR_VERSION,
        tc: await statSig(tcIndexFile),
        wall: await statSig(wallFile),
        field: await statSig(fieldFile),
        mesh:
          meshFile && (await fs.pathExists(meshFile))
            ? await statSig(meshFile)
            : 'absent',
        lit: [...lit].sort(),
        queued: [...queued].sort(),
        benchmarked: [...benchmarked].sort(),
        coverage: {...methodCounts, dedicatedTotal, livingTotal, catalogTotal},
        reportCount,
        externalIndexedPairs,
      }),
    )
    .digest('hex')
    .slice(0, 16);
  if ((await fs.pathExists(outFile)) && (await fs.pathExists(posterFile))) {
    try {
      const existing = await fs.readJson(outFile);
      if (existing.hash === inputsHash) return; // cached layout is current
    } catch (e) {
      /* regenerate */
    }
  }

  const wall = await fs.readJson(wallFile);
  const endonym = new Map(wall.map((w) => [w.c, w.e]));

  // ---- layout ---------------------------------------------------------
  // PINNED seed (not GENERATOR_VERSION): the family blob layout must stay
  // byte-stable across version bumps — v18 adds geo columns WITHOUT reshuffling
  // the map (the / poster + live map must not move). Only change this string to
  // deliberately re-lay-out the whole field.
  const LAYOUT_SEED = 'champollion-graph-v17';
  const rand = mulberry32(hash32(LAYOUT_SEED));
  const {pos, famOf} = layout(index, rand);
  // v18: the additive Earth-map projection (cols.gx/gy). Family blobs stay the
  // default (cols.x/y); /home-preview opts into geo.
  const geoPos = geoLayout(index, coordsByCode);
  const geoCovered = index.filter((l) => coordsByCode.has(l.code)).length;

  // ---- living-qualified + tiered coverage, and at-risk (Glottolog AES) ----
  // The hero juxtaposes coverage against the 7,077 LIVING languages, so the
  // displayed union must be living-filtered (the raw provider union includes
  // historical/constructed codes — Latin, Esperanto…). Tier split qualifies
  // OPUS-MT-style coverage honestly: a "service" is a deployable consumer
  // API; "open" models exist but need deployment (and for per-pair systems a
  // model for YOUR pair may not exist). All derived values here are
  // champollion-derived (provider lists ∩ ISO 639-3 living ∩ Glottolog AES).
  const AT_RISK_LEVELS = new Set(['shifting', 'endangered', 'critical', 'dormant']);
  const livingByCode = new Map();
  let dedicatedLiving = 0;
  let serviceLiving = 0;
  let openOnlyLiving = 0;
  let coveredNonLiving = 0;
  let atRiskTotal = 0;
  let atRiskUncovered = 0;
  // Coverage-gap accumulators (champollion-derived): reported speaker
  // populations of LIVING languages with no dedicated-MT coverage — the
  // basis for the "more than a billion" homepage claim. speakerCount blends
  // L1/L2 across sources, so this is a FLOOR, not a de-duplicated L1 total.
  let uncoveredSpeakerSumRaw = 0;
  let uncoveredWithCount = 0;
  let uncoveredNoCount = 0;
  const atRiskLevels = {shifting: 0, endangered: 0, critical: 0, dormant: 0};
  // Full AES gradient over LIVING languages (v13, for the endangerment
  // explorer): every level with its no-MT remainder, plus the unknowns —
  // stated as data, never folded away.
  const emptyLvl = () => ({total: 0, uncovered: 0});
  const byLevel = {
    thriving: emptyLvl(),
    shifting: emptyLvl(),
    endangered: emptyLvl(),
    critical: emptyLvl(),
    dormant: emptyLvl(),
    unknown: emptyLvl(),
  };
  for (const l of index) {
    const living = l.isoType === 'L';
    livingByCode.set(l.code, living);
    const mask = maskByCode.get(l.code) || 0;
    if (mask !== 0) {
      if (living) {
        dedicatedLiving += 1;
        if (mask & COMMERCIAL_MASK) serviceLiving += 1;
        else if (mask & OPEN_MASK) openOnlyLiving += 1;
      } else {
        coveredNonLiving += 1;
      }
    } else if (living) {
      // Living, uncovered → part of the coverage gap.
      const sc = l.speakerCount;
      if (typeof sc === 'number' && sc > 0) {
        uncoveredSpeakerSumRaw += sc;
        uncoveredWithCount += 1;
      } else {
        uncoveredNoCount += 1;
      }
    }
    const lvl = living && l.vitalityBadge ? l.vitalityBadge.level : null;
    if (living) {
      const bucket = byLevel[lvl && byLevel[lvl] ? lvl : 'unknown'];
      bucket.total += 1;
      if (mask === 0) bucket.uncovered += 1;
    }
    if (lvl && AT_RISK_LEVELS.has(lvl)) {
      atRiskTotal += 1;
      atRiskLevels[lvl] += 1;
      if (mask === 0) atRiskUncovered += 1;
    }
  }

  // ---- speaker-count quintiles (known counts only; unknown → 0) -------
  const counts = index
    .map((l) => l.speakerCount)
    .filter((n) => typeof n === 'number' && n > 0)
    .sort((a, b) => a - b);
  const qAt = (p) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))];
  const q1 = qAt(0.25);
  const q2 = qAt(0.5);
  const q3 = qAt(0.75);
  const q4 = qAt(0.92);
  const quant = (n) =>
    !(typeof n === 'number' && n > 0)
      ? 0
      : n >= q4
        ? 4
        : n >= q3
          ? 3
          : n >= q2
            ? 2
            : n >= q1
              ? 1
              : 0;

  // ---- families table (index + deterministic hue bucket 0..5) ---------
  const famNames = [];
  const famIdx = new Map();
  const famFor = (l) => {
    const f = famOf(l);
    if (!famIdx.has(f)) {
      famIdx.set(f, famNames.length);
      famNames.push([f, hash32(f) % 6]);
    }
    return famIdx.get(f);
  };

  // ---- nodes (columnar — array-of-arrays punctuation costs ~25KB gz) ---
  // code: concatenated 3-char ISO 639-3 codes (tc-index is code-sorted);
  // endo: sparse {nodeIndex: verified endonym}; the rest are flat arrays.
  // FAIL-LOUD SSOT GUARD: a non-null vitalityBadge.level outside the
  // vitalityScale table means the DB's normalized vocabulary drifted —
  // refuse to build rather than silently bucket real languages as
  // "unknown" (repo rule: no silent failures).
  const unknownLevels = new Set();
  for (const l of index) {
    const lvl = l.vitalityBadge ? l.vitalityBadge.level : null;
    if (lvl != null && VITALITY_TIER[lvl] == null) unknownLevels.add(lvl);
  }
  if (unknownLevels.size) {
    throw new Error(
      `[shared-data] graph.json: vitalityBadge.level value(s) not in ` +
        `src/utils/vitalityScale.js: ${[...unknownLevels].join(', ')} — ` +
        `extend the ONE scale table (and its explorer copy) deliberately; ` +
        `never let new vocabulary silently land in "unknown".`,
    );
  }
  const nodes = index.map((l) => {
    const p = pos.get(l.code);
    const gp = geoPos.get(l.code) || p; // geo coords (fallback: family coords)
    const liv = l.isoType === 'L' ? 1 : 0;
    const v =
      l.vitalityBadge && VITALITY_TIER[l.vitalityBadge.level] != null
        ? VITALITY_TIER[l.vitalityBadge.level]
        : VITALITY_UNKNOWN;
    // Lighting is COVERAGE, full stop (founder decision 2026-07-17):
    //   2 (lit)  = a DEDICATED MT engine covers it (mask != 0).
    //   0 (dark) = no dedicated coverage — the unlit field (shows scale, not a claim).
    // Benchmarked no longer lights nodes — the hero's one question is "is this
    // covered deployably or not"; benchmark counts live on the leaderboard.
    // The per-method mask (m) drives the toggle layers + the packet edges.
    const mask = maskByCode.get(l.code) || 0;
    const st = mask !== 0 ? 2 : 0;
    return [
      l.code,
      l.name,
      endonym.get(l.code) || 0,
      p.x,
      p.y,
      famFor(l),
      v,
      quant(l.speakerCount),
      st,
      mask,
      liv,
      gp.x, // [11] geo x (v18)
      gp.y, // [12] geo y (v18)
    ];
  });
  // Codes are mostly 3-char ISO 639-3 but the catalog also carries
  // variant (cmn-Hant, fra-CA) and family/genus card ids — join on ','.
  const endoSparse = {};
  nodes.forEach((n, i) => {
    if (n[2]) endoSparse[i] = n[2];
  });
  const cols = {
    code: nodes.map((n) => n[0]).join(','),
    name: nodes.map((n) => n[1]),
    endo: endoSparse,
    x: nodes.map((n) => n[3]),
    y: nodes.map((n) => n[4]),
    fam: nodes.map((n) => n[5]),
    // packed = vitality*15 + speakerQuintile*3 + state  (v≤5, q≤4, st≤2)
    p: nodes.map((n) => n[6] * 15 + n[7] * 3 + n[8]),
    // per-node method coverage bitmask (google1 ms2 deepl4 libre8 nllb16 opus32 tilde64 m2m100·256 madlad·512)
    m: nodes.map((n) => n[9]),
    // living flag (ISO 639-3 isoType L) — the binary hero draws LIVING
    // languages only, so its frame equals the "552 of 7,077" counter.
    liv: nodes.map((n) => n[10]),
    // v18 geo layout — a rough world-map projection beside the family blobs.
    // Only /home-preview reads these (layout:'geo'); every other consumer uses
    // x/y and is byte-identical. Emitted last so a stale reader ignores them.
    gx: nodes.map((n) => n[11]),
    gy: nodes.map((n) => n[12]),
  };

  // ---- routes (real benchmarked pairs; composite from the DB via field.json) ----
  const field = await fs.readJson(fieldFile);
  const codeToIdx = new Map(nodes.map((n, i) => [n[0], i]));
  const routes = [];
  for (let r = 0; r < (field.runs || []).length; r += 1) {
    const run = field.runs[r];
    const [src, tgt] = (run.corpus || '').split('-');
    const si = codeToIdx.get(norm(src));
    const ti = codeToIdx.get(norm(tgt));
    if (si == null || ti == null) continue;
    const composite = typeof run.composite === 'number' ? run.composite : null;
    routes.push([si, ti, r, composite]);
  }

  // ---- per-method packet edges ----------------------------------------
  // For ANY-TO-ANY methods (a service or model that can intertranslate
  // within its whole covered set): sample real covered PAIRS [si, ti, bit].
  // For per-pair methods (OPUS-MT, Tilde — anyToAny=false): emit SHUTTLE
  // edges [si, -1, bit], flown hub↔language by the engine, so we never
  // assert a language-pair model that may not exist. Fresh seeded PRNG —
  // NEVER the layout's `rand` (drawing from it would shift every node).
  const metaTierByKey = {};
  for (const mm of methodMeta) metaTierByKey[mm.key] = mm;
  const isAnyToAny = (def) => {
    const mm = metaTierByKey[def.key];
    return mm && typeof mm.anyToAny === 'boolean' ? mm.anyToAny : def.anyToAny;
  };
  const EDGE_CAP_PER_METHOD = 150;
  const edgeRand = mulberry32(hash32('method-edges-v10'));
  const methodEdges = [];
  for (const m of METHOD_BITS) {
    const covered = [];
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i][9] & m.bit) covered.push(i);
    }
    if (!covered.length) continue;
    if (isAnyToAny(m) && covered.length >= 2) {
      const seen = new Set();
      const want = Math.min(EDGE_CAP_PER_METHOD, (covered.length * (covered.length - 1)) / 2);
      let guard = 0;
      while (seen.size < want && guard < want * 30) {
        guard += 1;
        const a = covered[(edgeRand() * covered.length) | 0];
        const b = covered[(edgeRand() * covered.length) | 0];
        if (a === b) continue;
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        methodEdges.push([a, b, m.bit]);
      }
    } else {
      // Shuttle sampling: up to the cap, spread across the covered set.
      const deck = [...covered];
      for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = (edgeRand() * (i + 1)) | 0;
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      for (const i of deck.slice(0, EDGE_CAP_PER_METHOD)) {
        methodEdges.push([i, -1, m.bit]);
      }
    }
  }

  // Methods legend (bit → key/label/count/source) for the toggle UI + tooltips.
  const LABELS = {
    google: 'Google Translate',
    microsoft: 'Microsoft Translator',
    deepl: 'DeepL',
    libre: 'LibreTranslate',
    nllb: 'NLLB-200',
    opus: 'OPUS-MT',
    tilde: 'Tilde MT',
    m2m100: 'M2M-100',
    madlad: 'MADLAD-400',
  };
  const metaByKey = {};
  for (const mm of methodMeta) metaByKey[mm.key] = mm;
  const methodsLegend = METHOD_BITS.map((m) => {
    const meta = metaByKey[m.key] || {};
    const fallbackCnt =
      m.key === 'opus'
        ? opusCount
        : methodCounts[
            m.key === 'google'
              ? 'googleTranslate'
              : m.key === 'microsoft'
                ? 'microsoftTranslator'
                : m.key === 'libre'
                  ? 'libreTranslate'
                  : m.key
          ] || 0;
    // Imported catalogue count wins (import-only providers — opus, tilde,
    // m2m100, madlad — have no card-methodSupport fallback key at all).
    const cnt = typeof meta.count === 'number' ? meta.count : fallbackCnt;
    return {
      key: m.key,
      bit: m.bit,
      label: LABELS[m.key] || m.key,
      count: cnt,
      source_url: meta.source_url || null,
      asOf: meta.asOf || null,
      // 'service' = deployable consumer/API service · 'open' = open research
      // models. anyToAny=false (OPUS-MT, Tilde) = per-pair models — packets
      // shuttle hub↔language, never asserting an unverified pair.
      tier: meta.tier || m.tier,
      anyToAny: typeof meta.anyToAny === 'boolean' ? meta.anyToAny : m.anyToAny,
      // Service-card fields (null when the catalogue doesn't state them).
      homepage: meta.homepage || null,
      license: meta.license || null,
      nature: meta.nature || null,
    };
  });

  // (The `alias` map shipped below for the client is built once, early —
  // see the normalizer near the coverage-states section.)

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    hash: inputsHash,
    note:
      'THE TRANSLATION NETWORK dataset. Nodes: data/tc-index.json (names, ' +
      'families, vitality, speaker quintiles) joined with verified endonyms ' +
      'from data/wall.json. Layout: deterministic build-time force simulation. ' +
      'Lighting is COVERAGE, full stop: state 2 (lit) = a DEDICATED MT engine ' +
      'covers it (per-node mask `m`: google1 ms2 deepl4 libre8 nllb16 opus32 ' +
      'tilde64 m2m100·256 madlad·512, from the imported method-coverage ' +
      'lists); state 0 = no dedicated coverage (the unlit field — shows ' +
      'scale, not a claim). The hero draws a THREE-tier green/green/red frame ' +
      'from that mask (v17, src/utils/pairReachability.coverageTier): a ' +
      'DEPLOYED SERVICE (google/ms/deepl/libre) = bright green + white core; ' +
      'an OPEN research model only (nllb/opus/tilde/m2m100/madlad — the code ' +
      'is in the model card but no service ships it) = dim green ring; none = ' +
      'red. The poster tuple carries this tier; cols.p keeps the binary st. ' +
      'Vitality level rides the packed `p` column ' +
      '(v*15+q*3+st; v: 0 thriving · 1 shifting · 2 endangered · 3 critical ' +
      '· 4 dormant · 5 unknown, Glottolog AES — src/utils/vitalityScale.js). ' +
      'The `liv` column (ISO 639-3 isoType L) scopes the binary hero to ' +
      'living languages only. ' +
      'methodEdges: [si,ti,bit] sampled covered pairs for any-to-any methods; ' +
      '[si,-1,bit] hub↔language shuttles for per-pair methods (OPUS-MT, ' +
      'Tilde) — never asserting an unverified pair. routes = real benchmarked ' +
      'pairs from field.json. Counts read straight from cited sources — ' +
      'nothing invented; *Living/atRisk stats are champollion-derived.',
    world: WORLD,
    stats: {
      total: nodes.length,
      // Displayed "languages cataloged" = resolved language-card count (the
      // canonical number), NOT the layout node count (which includes pseudo-
      // family/variant nodes). Falls back to node count if cards were absent.
      catalogTotal: catalogTotal || nodes.length,
      livingTotal,
      coverage: {
        google: methodCounts.googleTranslate,
        microsoft: methodCounts.microsoftTranslator,
        deepl: methodCounts.deepl,
        libre: methodCounts.libreTranslate,
        nllb: methodCounts.nllb,
        opus: opusCount,
        tilde: methodCounts.tilde,
        llm: methodCounts.llm,
        dedicated: dedicatedTotal,
        // Living-qualified tiers (champollion-derived: provider lists ∩ ISO
        // 639-3 living). dedicated (above) is the RAW union and includes
        // historical/constructed codes — display copy must use these.
        dedicatedLiving,
        serviceLiving,
        openOnlyLiving,
        uncoveredLiving: livingTotal - dedicatedLiving,
        coveredNonLiving,
      },
      // How many people can't get MT into their FIRST language — the sum of
      // reported speaker populations of living languages with no dedicated-MT
      // coverage. A FLOOR: speakerCount blends L1/L2 across sources, and
      // uncoveredNoCount languages have no reported figure. Method + caveats:
      // /docs/network/context/coverage-gap-estimate.
      coverageGap: {
        uncoveredLiving: livingTotal - dedicatedLiving,
        uncoveredSpeakerSumRaw,
        uncoveredWithCount,
        uncoveredNoCount,
      },
      // Endangerment (champollion-derived from the Glottolog AES badge on
      // tc-index rows): living languages at level shifting/endangered/
      // critical/dormant. Not a single-source truth claim — cards show the
      // full per-source vitality spread; this is the AES aggregate.
      atRisk: {
        total: atRiskTotal,
        uncovered: atRiskUncovered,
        levels: atRiskLevels,
        // v13: the full living-language gradient (every AES level +
        // unknown, each with its no-MT remainder) for the explorer UI.
        byLevel,
        source: 'derived from Glottolog AES (vitalityBadge)',
      },
      benchmarked: benchmarked.size,
      externalPairs: externalPairCount,
      externalIndexedPairs,
      lit: nodes.filter((n) => n[8] === 2).length,
      reportCount,
    },
    methods: methodsLegend,
    families: famNames,
    alias,
    n: nodes.length,
    cols,
    routes,
    methodEdges,
  };
  await fs.writeJson(outFile, out);

  // ---- poster (~700 nodes, SSR/static composition) ----------------------
  const POSTER_N = 700;
  // COMPOSITION IS THE CLAIM (founder 2026-07-19): coverage lights only a
  // small minority of languages (552/7,077 living), so the poster must not
  // ship every lit node against a token sample of the dark mass — that
  // first paint read "everything is covered", the opposite of the truth.
  // Lit nodes are CAPPED at ~30% of the frame (deterministic hash-sample,
  // stable across builds) and the remaining budget goes to the dark/ember
  // field, so the SSR frame carries the real proportions.
  // Covered share of the poster frame. The true covered share of living
  // languages is ~8%; 120/700 (~17%) keeps the green visibly present
  // while the frame still reads "a small minority is covered" — the
  // binary story must hold for reduced-motion users who only ever see
  // this static frame (the live engine shows the full real field).
  const POSTER_LIT_CAP = 120;
  const byFam = new Map();
  for (const n of nodes) {
    if (!byFam.has(n[5])) byFam.set(n[5], 0);
  }
  const picked = [];
  const taken = new Set();
  // BINARY FRAME = LIVING ONLY (founder 2026-07-19): the hero poster shows
  // exactly the population the counter claims (552 of 7,077 living), so
  // non-living codes (historical/constructed — Latin, Esperanto…) never
  // enter the sample; they belong to the explore-mode map.
  // 1) a capped, deterministic sample of the covered LIVING nodes
  //    (hash-ordered so the sample is stable and spread across families).
  const litIdx = [];
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i][8] === 2 && nodes[i][10] === 1) litIdx.push(i);
  }
  litIdx.sort((a, b) => hash32(nodes[a][0]) - hash32(nodes[b][0]));
  for (const i of litIdx.slice(0, POSTER_LIT_CAP)) {
    picked.push(i);
    taken.add(i);
    byFam.set(nodes[i][5], byFam.get(nodes[i][5]) + 1);
  }
  // 2) fill the rest of the budget with UNCOVERED LIVING nodes by speaker
  //    quintile/famcap so every neighborhood registers; unsampled covered
  //    nodes are excluded (they would render covered and re-inflate the
  //    green), and non-living nodes are excluded per the binary frame.
  const famSize = new Map();
  for (const n of nodes) famSize.set(n[5], (famSize.get(n[5]) || 0) + 1);
  const order = nodes
    .map((n, i) => i)
    .sort((a, b) => nodes[b][7] - nodes[a][7] || (nodes[a][0] < nodes[b][0] ? -1 : 1));
  for (const i of order) {
    if (picked.length >= POSTER_N) break;
    if (taken.has(i)) continue;
    if (nodes[i][8] === 2 || nodes[i][10] !== 1) continue;
    const f = nodes[i][5];
    const cap = Math.max(2, Math.round((famSize.get(f) * (POSTER_N - 60)) / nodes.length) + 2);
    if (byFam.get(f) >= cap) continue;
    picked.push(i);
    taken.add(i);
    byFam.set(f, byFam.get(f) + 1);
  }
  // ---- engine-parity camera + parallax bake ---------------------------
  // The live engine opens with fit(): camera pulled toward the lit
  // centroid, biased down, at zFit*CAM_ZMUL — and projects each node
  // through its parallax layer (PF). We bake BOTH into the poster so the
  // SSR frame and the engine's first painted frame are the same picture:
  //   baked = cam + (world − cam) · PF[layer]
  // makes the plain (parallax-free) SVG projection equal the engine's
  // parallax projection at any zoom. PosterSvg then renders the cam
  // window (see GraphHero.js) so framing matches too.
  let litCx = 0;
  let litCy = 0;
  let litN = 0;
  for (const n of nodes) {
    if (n[8] === 2) {
      litCx += n[3];
      litCy += n[4];
      litN += 1;
    }
  }
  litCx = litN ? litCx / litN : WORLD / 2;
  litCy = litN ? litCy / litN : WORLD / 2;
  const cam = {
    x: WORLD / 2 + (litCx - WORLD / 2) * CAM_BIAS,
    y: WORLD / 2 + (litCy - WORLD / 2) * CAM_BIAS + WORLD * CAM_DOWN,
    zMul: CAM_ZMUL,
  };
  // Engine layer assignment twin (GraphEngine constructor): lit/queued ride
  // the front layer; the dark mass spreads across three seeded depths.
  const layerOf = (i) => {
    if (nodes[i][8] > 0) return 2;
    const s = hash32(nodes[i][0]) / 4294967296;
    return s < 0.38 ? 0 : s < 0.76 ? 1 : 2;
  };
  const bakeX = (x, L) => cam.x + (x - cam.x) * PF[L];
  const bakeY = (y, L) => cam.y + (y - cam.y) * PF[L];

  // v15: the poster ships NO hubs and NO spokes — the SSR frame is the
  // BINARY hero (covered green / uncovered red, living only); the
  // hub-and-spoke provider view is explore-mode ("View the live map"),
  // drawn client-side by the engine in mesh displayMode. PosterSvg
  // tolerates the absent keys (destructure defaults), so stale consumers
  // degrade cleanly.

  // poster.monolith — the seam's TRUE "centralized MT" scene (v12): real
  // layout positions for a sample of LIVING languages, flagged covered by
  // AT LEAST ONE dedicated engine vs covered by none, normalized into the
  // beat's 600×400 viewBox. Generalizes the old NLLB-only scene — the
  // centralized-model critique holds for Google, NLLB, and most MT alike,
  // so the field shows every major service + model COMBINED still missing
  // the vast majority of living languages (figures in CLAIMS.md).
  const MONO_BOX = [600, 400];
  const MONO_MARGIN = 26;
  // Beat-1 field DISPLAY budget. The dots are a PROPORTIONAL sample of the
  // real covered vs uncovered living-language sets, so the field reads at the
  // TRUE ratio (~1 covered : 12 uncovered) — a small green core in a vast red
  // field — instead of the misleading near-even split a fixed uncovered cap
  // gave (all 552 covered vs only 380 uncovered). The honest counts
  // (coveredLiving / uncoveredTotal) are reported separately for the seam's
  // "covers just 552 of 7,077" copy — only the visual sample is downscaled.
  const MONO_TOTAL = 2600;
  const monoRand = mulberry32(hash32('monolith-v11'));
  const monoCovered = [];
  const monoUncovered = [];
  for (let i = 0; i < nodes.length; i += 1) {
    if (!livingByCode.get(nodes[i][0])) continue;
    if (nodes[i][9] !== 0) monoCovered.push(i);
    else monoUncovered.push(i);
  }
  const monoShuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = (monoRand() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };
  monoShuffle(monoCovered);
  monoShuffle(monoUncovered);
  const monoTrueTotal = monoCovered.length + monoUncovered.length || 1;
  const MONO_COVERED_CAP = Math.min(
    monoCovered.length,
    Math.max(1, Math.round((MONO_TOTAL * monoCovered.length) / monoTrueTotal)),
  );
  const MONO_UNCOVERED_CAP = Math.min(monoUncovered.length, MONO_TOTAL - MONO_COVERED_CAP);
  const monoCoveredPick = monoCovered.slice(0, MONO_COVERED_CAP);
  const monoPickIdx = monoCoveredPick.concat(monoUncovered.slice(0, MONO_UNCOVERED_CAP));
  let mnx = Infinity;
  let mxx = -Infinity;
  let mny = Infinity;
  let mxy = -Infinity;
  for (const i of monoPickIdx) {
    if (nodes[i][3] < mnx) mnx = nodes[i][3];
    if (nodes[i][3] > mxx) mxx = nodes[i][3];
    if (nodes[i][4] < mny) mny = nodes[i][4];
    if (nodes[i][4] > mxy) mxy = nodes[i][4];
  }
  const monoS = Math.min(
    (MONO_BOX[0] - 2 * MONO_MARGIN) / Math.max(mxx - mnx, 1),
    (MONO_BOX[1] - 2 * MONO_MARGIN) / Math.max(mxy - mny, 1),
  );
  const monoOx = (MONO_BOX[0] - monoS * (mxx - mnx)) / 2;
  const monoOy = (MONO_BOX[1] - monoS * (mxy - mny)) / 2;
  const monolith = {
    v: 2,
    box: MONO_BOX,
    // [x, y, covered] — real (normalized) layout positions of living
    // languages; covered = AT LEAST ONE dedicated MT engine lists it.
    pts: monoPickIdx.map((i) => [
      Math.round(monoOx + (nodes[i][3] - mnx) * monoS),
      Math.round(monoOy + (nodes[i][4] - mny) * monoS),
      nodes[i][9] !== 0 ? 1 : 0,
    ]),
    coveredLiving: monoCovered.length,
    // How many of each the FIELD actually draws (a proportional sample); the
    // covered dots are pts[0..coveredSampled-1].
    coveredSampled: monoCoveredPick.length,
    uncoveredSampled: MONO_UNCOVERED_CAP,
    uncoveredTotal: monoUncovered.length,
    // Per-method published counts + sources for the seam's citation tip.
    methods: methodsLegend
      .filter((m) => m.count > 0)
      .map((m) => ({label: m.label, count: m.count, tier: m.tier, source_url: m.source_url, asOf: m.asOf})),
    livingTotal,
  };

  // monolith.mesh — a sparse network drawn over the COVERED dots in Beat 1
  // (the "omnimodel" scene). Baked here so the browser never runs kNN: sample
  // ~120 covered pts, link each to its 2 nearest covered neighbours, dedupe,
  // cap at 160. Indices point into monolith.pts (covered pts are pts[0..
  // coveredSampled-1], since monoPickIdx = coveredPick.concat(uncovered)).
  {
    const cov = monolith.pts.slice(0, monolith.coveredSampled);
    const meshEdges = [];
    const seenMesh = new Set();
    const step = Math.max(1, Math.floor(cov.length / 120));
    for (let a = 0; a < cov.length && meshEdges.length < 160; a += step) {
      const near = [];
      for (let b = 0; b < cov.length; b += 1) {
        if (b === a) continue;
        const dx = cov[a][0] - cov[b][0];
        const dy = cov[a][1] - cov[b][1];
        near.push([dx * dx + dy * dy, b]);
      }
      near.sort((p, q) => p[0] - q[0]);
      for (let k = 0; k < 2 && k < near.length; k += 1) {
        const b = near[k][1];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seenMesh.has(key)) continue;
        seenMesh.add(key);
        meshEdges.push([a, b]);
      }
    }
    monolith.mesh = meshEdges;
  }

  const poster = {
    world: WORLD,
    // Engine-parity camera window; PosterSvg falls back to the legacy
    // full-world viewBox when absent (stale committed snapshot).
    cam,
    // [bakedX, bakedY, tier, quintile, vitalityLevel, living] — coords carry
    // the parallax bake. The poster renders the COVERAGE TIER (v17): 2 = a
    // deployed service lists it (bright green + white core), 1 = only an open
    // research model lists it (dim green ring, no core — "listed, not
    // deployed"), 0 = uncovered (red). Derived from the node's own coverage
    // bitmask (nodes[i][9]) via coverageTier — NOT the collapsed binary st
    // (nodes[i][8]), which flattened service and open-model coverage into one
    // green and over-stated the covered story. vitalityLevel rides along for
    // the AES gradient; living is 1 for every node (the sample is
    // living-only) and lets stale consumers detect the binary-frame contract.
    nodes: picked.map((i) => {
      const L = layerOf(i);
      return [
        Math.round(bakeX(nodes[i][3], L)),
        Math.round(bakeY(nodes[i][4], L)),
        coverageTier(nodes[i][9]),
        nodes[i][7],
        nodes[i][6],
        nodes[i][10],
      ];
    }),
    // Legacy field, kept empty for stale-consumer safety (PosterSvg maps it).
    routes: [],
    monolith,
    stats: out.stats,
  };
  await fs.ensureDir(path.dirname(posterFile));
  await fs.writeJson(posterFile, poster);

  console.log(
    `[shared-data] Wrote graph.json v${GENERATOR_VERSION} (${nodes.length} layout nodes, ` +
      `${out.stats.catalogTotal} cataloged / ${out.stats.livingTotal} living, ` +
      `${out.stats.coverage.dedicated} raw-union coverage / ${dedicatedLiving} LIVING ` +
      `[service ${serviceLiving} · open-only ${openOnlyLiving} · non-living ${coveredNonLiving}], ` +
      `at-risk ${atRiskTotal} (${atRiskUncovered} uncovered), ` +
      `${out.stats.benchmarked} benchmarked, ` +
      `${out.stats.lit} lit, ${methodEdges.length} method-edges) ` +
      `+ graph-poster.json (living-only: ${picked.length} nodes, ` +
      `${picked.filter((i) => coverageTier(nodes[i][9]) === 2).length} service · ` +
      `${picked.filter((i) => coverageTier(nodes[i][9]) === 1).length} open-model-only, ` +
      `monolith ${monolith.pts.length} pts)`,
  );
}

module.exports = {generateGraphJson};
