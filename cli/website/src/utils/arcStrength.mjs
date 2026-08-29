/**
 * arcStrength — the objective mapping from a measured pair edge
 * (mesh.json) to a drawable arc style for the network graph.
 *
 * Strength measure: chance-corrected chrF++ (cchrF++), champollion-derived:
 *
 *   cchrF++ = (chrF++ − floor) / (100 − floor), clamped to [0, 1]
 *
 * where `floor` is the chance floor — the chrF++ a random same-orthography
 * baseline scores against real references. Floors differ by writing system
 * (an orthography with few distinct characters overlaps "for free"), so raw
 * chrF++ is not comparable across languages; cchrF++ puts 0 at "no better
 * than chance" everywhere. Public explainer:
 * /docs/network/specifications/connection-strength
 *
 * Encoding rules (each channel carries ONE meaning, so the picture stays
 * objective):
 *   COLOR  = strength band only, and ONLY when the floor is known for both
 *            sides of the pair. Unknown floor → neutral slate, never the ramp.
 *   WIDTH  = mild redundancy for the same band (accessibility, not a second
 *            variable).
 *   DASH   = statistical provisionality: pairs under the leaderboard
 *            significance floor (n < 100) are dashed and dimmed — the same
 *            "gaps within ~5 chrF++ are noise" rule the board shows.
 *
 * Floor choice for an undirected pair: the HIGHER floor of the two sides.
 * Conservative by construction — the correction can understate strength but
 * never inflate it. A pair is `corrected` only when BOTH sides have
 * measured floors.
 */

/** Leaderboard significance floor: score gaps within ~5 chrF++ are noise below this n. */
export const SIGNIFICANCE_N = 100;

/** cchrF++ band edges (0–1). */
export const BIN_EDGES = [0.15, 0.35, 0.55, 0.75];

export const BIN_LABELS = ['near floor', 'weak', 'developing', 'usable', 'strong'];

/**
 * Red→amber→soft-green 5-step ramp, weak→strong (founder directive
 * 2026-07-14: low quality reads as a warning, high quality as a positive
 * soft green/yellow). Kept perceptually ordered in lightness so the ramp
 * still reads under color-vision deficiency; width redundancy (below)
 * carries the band a second way.
 */
export const BIN_COLORS = ['#d64550', '#e07b46', '#e8b339', '#b5cf6b', '#7fc97f'];

/** Measured but floor unknown for at least one side: neutral, off the ramp. */
export const UNCORRECTED_COLOR = '#8b95a7';

/** Bounded arc count so a dense future board cannot melt the frame budget. */
export const MAX_ARCS = 1500;

/** Higher floor of the pair, or null unless BOTH sides have measured floors. */
export function pairFloor(floors, a, b) {
  const fa = floors ? floors[a] : null;
  const fb = floors ? floors[b] : null;
  if (typeof fa !== 'number' || typeof fb !== 'number') return null;
  return Math.max(fa, fb);
}

/** Chance-corrected chrF++ on [0,1]; null when inputs are unusable. */
export function cchrf(rawChrf, floor) {
  if (typeof rawChrf !== 'number' || typeof floor !== 'number' || floor >= 100) {
    return null;
  }
  return Math.min(1, Math.max(0, (rawChrf - floor) / (100 - floor)));
}

/** Band index 0–4 for a cchrF++ value. */
export function strengthBin(c) {
  let b = 0;
  for (const edge of BIN_EDGES) if (c >= edge) b += 1;
  return b;
}

/**
 * Style for one mesh edge, or null when the edge is not a measured pair.
 * @param {{status:string,best_chrf:number|null,size:number,a:string,b:string}} edge
 * @param {Record<string, number>} floors  iso3 → chance floor (0–100)
 */
export function arcStyle(edge, floors) {
  if (!edge || edge.status !== 'measured' || typeof edge.best_chrf !== 'number') {
    return null;
  }
  const provisional = !(typeof edge.size === 'number' && edge.size >= SIGNIFICANCE_N);
  const floor = pairFloor(floors, edge.a, edge.b);
  if (floor == null) {
    return {
      corrected: false,
      cchrf: null,
      bin: null,
      color: UNCORRECTED_COLOR,
      alpha: provisional ? 0.3 : 0.5,
      width: 1.1,
      dash: [5, 5],
      provisional,
    };
  }
  const c = cchrf(edge.best_chrf, floor);
  const bin = strengthBin(c);
  return {
    corrected: true,
    cchrf: c,
    bin,
    color: BIN_COLORS[bin],
    alpha: provisional ? 0.45 : 0.85,
    width: 1 + bin * 0.3,
    dash: provisional ? [6, 5] : null,
    provisional,
  };
}
