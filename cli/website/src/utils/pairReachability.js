/**
 * pairReachability — the SINGLE classification of an unmeasured language
 * pair by how it can be translated today, derived from the two endpoints'
 * method-coverage bitmasks (graph.json cols.m; bits from METHOD_BITS in
 * plugins/shared-data/generateGraphJson.js).
 *
 * Used by BOTH the build-time poster generator (CommonJS require) and the
 * client hero (webpack import) so the SSR poster and the live canvas draw
 * the same lines in the same colours — the poster→engine handoff must be
 * seamless.
 *
 * HONESTY CONTRACT: these categories describe REACHABILITY (a provider
 * publishes coverage of both sides), never quality. Only measured pairs
 * (mesh status 'measured') may use the strength ramp in arcStrength.mjs.
 * Unmeasured categories stay muted hairlines with their own flat colours.
 *
 * A pair is reachable via a provider only when BOTH endpoints share that
 * provider's bit (maskA & maskB). Categories, checked in order:
 *   commercial — a commercial service API covers the pair
 *                (Google 1 · Microsoft 2 · DeepL 4 · LibreTranslate 8)
 *   open       — an open-source model covers the pair
 *                (NLLB 16 · OPUS-MT 32 · Tilde 64)
 *   frontier   — no provider covers the pair: the Champollion
 *                method-agnostic LRL lane (the queue's reason to exist)
 */

const COMMERCIAL_MASK = 1 | 2 | 4 | 8; // google · microsoft · deepl · libre
// nllb · opus · tilde · m2m100 · madlad (128 stays reserved for translated,
// a commercial API — it joins COMMERCIAL_MASK when its list lands).
const OPEN_MASK = 16 | 32 | 64 | 256 | 512;

/** Category ids double as draw order: dimmest first, the frontier story last. */
const CATEGORIES = ['commercial', 'open', 'frontier'];

/**
 * Flat, theme-static colours (the homepage hero is pinned dark; these are
 * also baked into the SSR poster where CSS custom properties of the live
 * palette are unavailable at generation time).
 *  - commercial: steel blue — infrastructure that already exists
 *  - open:       teal (the --vital-safe family) — open models
 *  - frontier:   amber (the --vital-vulnerable family) — the LRL frontier,
 *                today's poster-route colour, kept for brand continuity
 */
const CATEGORY_STYLE = {
  commercial: {color: '#7d95c4', alpha: 0.1, width: 0.9},
  open: {color: '#3fc1c0', alpha: 0.12, width: 0.9},
  frontier: {color: '#e8b339', alpha: 0.16, width: 0.9},
};

const CATEGORY_LABELS = {
  commercial: 'registered · commercial API reaches both sides',
  open: 'registered · open-source model reaches both sides',
  frontier: 'registered · frontier (no provider covers the pair)',
};

/**
 * Classify a pair by its endpoints' coverage bitmasks.
 * @param {number} maskA
 * @param {number} maskB
 * @returns {'commercial'|'open'|'frontier'}
 */
function classifyPair(maskA, maskB) {
  const shared = (maskA || 0) & (maskB || 0);
  if (shared & COMMERCIAL_MASK) return 'commercial';
  if (shared & OPEN_MASK) return 'open';
  return 'frontier';
}

/** Numeric category id for compact artifacts (poster routes). */
const CATEGORY_ID = {commercial: 0, open: 1, frontier: 2};

/**
 * Coverage TIER of a single node from its own method-coverage bitmask — the
 * one classifier behind the hero's three-state green/green/red frame. A node
 * is drawn brightly only when a DEPLOYED SERVICE covers it; a node that only
 * appears in an open research model's published language list (MADLAD-400,
 * NLLB, M2M-100, OPUS, Tilde) is dim — "listed, not deployed" — never red.
 *
 * This is a per-NODE tier (does its own code appear in a provider's list?),
 * NOT classifyPair's per-PAIR reachability. The two share the same masks so
 * "bright green" and "commercial pair" mean the same provider set.
 *
 *   2 — a deployed service lists this language (COMMERCIAL_MASK)
 *   1 — only an open research model lists it (OPEN_MASK, no service)
 *   0 — no catalogued method lists it (the uncovered field)
 *
 * @param {number} mask  the node's cols.m bitmask
 * @returns {0|1|2}
 */
function coverageTier(mask) {
  const m = mask || 0;
  if (m & COMMERCIAL_MASK) return 2;
  if (m & OPEN_MASK) return 1;
  return 0;
}

/**
 * Per-SERVICE colours for the hub-and-spoke coverage layer (each provider
 * renders as a labeled hub node; spokes fan out to every language it
 * covers — "paths coded by coverage method", founder directive
 * 2026-07-15). Distinct hues per service; the frontier amber (#e8b339)
 * stays reserved for the Champollion queue lane.
 */
const SERVICE_COLORS = {
  google: '#5b8def', // blue
  microsoft: '#38bdf8', // sky
  deepl: '#a78bfa', // violet
  libre: '#f472b6', // pink
  nllb: '#2dd4bf', // teal
  opus: '#4ade80', // green
  tilde: '#d946ef', // fuchsia
  m2m100: '#fbbf24', // gold — small open many-to-many model
  madlad: '#ff8a4c', // coral — 400-language open research model
};

module.exports = {
  COMMERCIAL_MASK,
  OPEN_MASK,
  CATEGORIES,
  CATEGORY_STYLE,
  CATEGORY_LABELS,
  CATEGORY_ID,
  SERVICE_COLORS,
  classifyPair,
  coverageTier,
};
