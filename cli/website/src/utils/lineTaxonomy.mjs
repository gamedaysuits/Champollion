/**
 * lineTaxonomy — the ONE canonical registry of every line (and glow) type
 * the network map draws. The legend renders from this list; nothing may be
 * drawn that is not defined here (founder directive 2026-07-19: no
 * inconsistent ad-hoc lines).
 *
 * THE TEMPLATE — adding a line type requires ALL of these, in one PR:
 *   1. An entry in LINE_TYPES below, with every field filled:
 *      - id / label / meaning (one plain sentence a visitor understands)
 *      - dataRequirements: which artifact + fields must exist before this
 *        line may be drawn (the "data-building requirement")
 *      - style: derived from an existing SSOT (arcStrength.mjs,
 *        pairReachability.js, graph.json methods) — NEVER a new literal
 *        color/dash invented here
 *      - interactive: whether hover/click do anything, stated honestly
 *      - cap: the hard bound that keeps a busy map drawable
 *   2. The engine draw code (GraphEngine.js) pointing back at the entry id
 *      in a comment.
 *   3. The legend picks it up automatically (MapLegend maps LINE_TYPES) —
 *      verify it renders.
 *   4. The consistency test (cli/test/website-line-taxonomy.test.js) —
 *      extend it if the entry derives from a new SSOT.
 *
 * Style single-sourcing: measured-arc styles are COMPUTED via arcStyle()
 * fixtures (so an encoding change propagates here automatically); registered
 * hairline styles come from pairReachability's CATEGORY_STYLE; coverage
 * spokes/packets take their color per method from graph.json's methods
 * legend at runtime (represented here by a token, not a literal).
 */

import {arcStyle, SIGNIFICANCE_N} from './arcStrength.mjs';
import {
  CATEGORIES,
  CATEGORY_STYLE,
  CATEGORY_LABELS,
} from './pairReachability.js';

/** Compute a measured-arc style through the real SSOT mapping. */
function measuredStyle({chrf, size}) {
  return arcStyle({status: 'measured', best_chrf: chrf, size, a: 'aaa', b: 'bbb'});
}

export const LINE_TYPES = [
  {
    id: 'measured',
    label: 'Measured pair',
    meaning:
      'A run on the public board scored this pair. One colour, one meaning: ' +
      'measured. No strength band — the cchrF++ ramp was retired 2026-09-04.',
    dataRequirements: [
      'mesh.json edge with status "measured" and numeric best_chrf',
      `n ≥ ${SIGNIFICANCE_N} for a solid line (below: provisional dash)`,
    ],
    style: measuredStyle({chrf: 75, size: 150}),
    interactive: {hover: 'measured tooltip', click: 'connection card (methods + winner + route)'},
    cap: 'MAX_ARCS = 1500 strongest arcs (arcStrength.mjs)',
    layer: 'base canvas',
  },
  {
    id: 'measured-provisional',
    label: 'Measured, provisional (n < 100)',
    meaning:
      'Same measured claim, but the corpus is under the significance ' +
      'floor — dashed and dimmed until a bigger run lands.',
    dataRequirements: [
      'mesh.json measured edge with size < 100',
    ],
    style: measuredStyle({chrf: 75, size: 60}),
    interactive: {hover: 'measured tooltip', click: 'connection card'},
    cap: 'shares MAX_ARCS',
    layer: 'base canvas',
  },
  ...CATEGORIES.map((cat) => ({
    id: `registered-${cat}`,
    // CATEGORY_LABELS already lead with "registered · " — strip it so the
    // legend reads "Registered — commercial API reaches both sides".
    label: `Registered — ${CATEGORY_LABELS[cat].replace(/^registered · /, '')}`,
    meaning:
      'A corpus exists and the pair is queued, but nothing has measured ' +
      'it yet — a reachability claim, never a quality claim.',
    dataRequirements: [
      'mesh.json edge with status "registered"',
      'reachability classification (pairReachability.js)',
      'visible only when the Registered chip is on (default off)',
    ],
    style: {
      color: CATEGORY_STYLE[cat].color,
      alpha: CATEGORY_STYLE[cat].alpha,
      width: CATEGORY_STYLE[cat].width,
      dash: CATEGORY_STYLE[cat].dash || null,
    },
    interactive: {hover: 'none yet', click: 'none yet'},
    cap: 'AMBIENT_CAP = 600 (250 on phones), per-category thirds',
    layer: 'base canvas (dimmest)',
  })),
  {
    id: 'coverage-spoke',
    label: 'Coverage spoke (hub → language)',
    meaning:
      'A provider hub claims support for this language (its published ' +
      'list) — coverage, not measurement. Color = the method chip color.',
    dataRequirements: [
      'graph.json per-node coverage bitmask + methods legend',
      'the method chip toggled on',
    ],
    style: {color: 'per-method (methods legend)', alpha: 0.16, width: 0.6, dash: null},
    interactive: {hover: 'none (hub labels + chips carry the names)', click: 'hub tap toggles the layer'},
    cap: 'drawn per visible node; phone draw-time cuts',
    layer: 'base canvas',
  },
  {
    id: 'packet-trail',
    label: 'Packet (animated)',
    meaning:
      'BINARY HERO ONLY (founder 2026-07-19): illustrative traffic between ' +
      'covered living languages — motion only, never a data claim; the ' +
      'explore-mode map flies no packets (every mark there carries ' +
      'information).',
    dataRequirements: ['graph.json methodEdges (covered living pairs)', 'motion enabled'],
    style: {color: 'teal-white (--vital-safe family)', alpha: 0.9, width: 1.0, dash: null},
    interactive: {hover: 'none', click: 'none'},
    cap: 'MAX_PACKETS ladder ×2.5 in binary mode (frame-time probe degrades)',
    layer: 'fx canvas',
  },
  {
    id: 'endpoint-glow',
    label: 'Measured endpoint glow',
    meaning:
      'A language lights up when any measured pair touches it — the map ' +
      'literally lights as queue runs land.',
    dataRequirements: ['any measured mesh edge touching the node'],
    style: {color: 'warm glow', alpha: 0.8, width: null, dash: null},
    interactive: {hover: 'node tooltip', click: 'language mini-card'},
    cap: 'bounded by MAX_ARCS endpoints',
    layer: 'fx canvas',
  },
];

/** Legend entries that draw a swatch line (skip glows/packets tokens). */
export function swatchOf(type) {
  const s = type.style || {};
  return {
    color: typeof s.color === 'string' && s.color.startsWith('#') ? s.color : null,
    dash: s.dash || null,
    width: s.width || 1,
    alpha: s.alpha == null ? 1 : s.alpha,
  };
}
