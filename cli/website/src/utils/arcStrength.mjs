/**
 * arcStrength — the objective mapping from a measured pair edge
 * (mesh.json) to a drawable arc style for the network graph.
 *
 * ENCODING: BINARY (founder decision 2026-09-04).
 *
 *   An arc says ONE thing: this pair has been measured, or it has not.
 *   No strength band, no colour ramp, no cross-language quality claim.
 *
 * Why: the map previously coloured arcs by chance-corrected chrF++ (cchrF++).
 * That correction is real research — it demonstrably removes the writing
 * system's chance component and unmasks trivial baselines — but the evidence
 * that it makes scores comparable across languages ABOVE the floor is not
 * settled: it is demonstrated at the floor, argued in the interior, and on one
 * pool of human judgments with uniformly low floors it moved agreement the
 * wrong way, unresolved. Colouring a public map by a five-band strength ramp
 * asserted more than that evidence supports, so the ramp is retired until the
 * further studies land. See docs/CCHRF_FLOOR_COVERAGE_DESIGN_NOTE_2026-09-04.
 *
 * Note that colouring by RAW chrF++ instead is not an option and never was:
 * raw chrF++ is not comparable across languages at all, which is the very
 * problem the correction was built for. Binary is the honest fallback.
 *
 * Encoding rules (each channel carries ONE meaning):
 *   COLOR  = measured. One colour, no ramp, no strength reading.
 *   DASH   = statistical provisionality: pairs under the leaderboard
 *            significance floor (n < 100) are dashed and dimmed — the same
 *            "gaps within ~5 chrF++ are noise" rule the board shows. This is a
 *            property of the SAMPLE SIZE, independent of any metric, so it
 *            survives the retirement.
 *   WIDTH  = constant. Nothing left to encode.
 */

/** Leaderboard significance floor: score gaps within ~5 chrF++ are noise below this n. */
export const SIGNIFICANCE_N = 100;

/** Bounded arc count so a dense future board cannot melt the frame budget. */
export const MAX_ARCS = 1500;

/** The one arc colour: "measured". Seam accent; asserts no strength. */
export const MEASURED_COLOR = '#4dd8ff';

/**
 * Style for one mesh edge, or null when the edge is not a measured pair.
 * @param {{status:string,best_chrf:number|null,size:number,a:string,b:string}} edge
 */
export function arcStyle(edge) {
  if (!edge || edge.status !== 'measured' || typeof edge.best_chrf !== 'number') {
    return null;
  }
  const provisional = !(typeof edge.size === 'number' && edge.size >= SIGNIFICANCE_N);
  return {
    measured: true,
    color: MEASURED_COLOR,
    alpha: provisional ? 0.35 : 0.75,
    width: 1.2,
    dash: provisional ? [6, 5] : null,
    provisional,
  };
}

/* ==========================================================================
 * RESEARCH ONLY — NOT WIRED TO ANY SURFACE (2026-09-04)
 * --------------------------------------------------------------------------
 * The cchrF++ chance-floor machinery below is retained, exported and tested
 * because the underlying finding is real and the study continues. NOTHING IN
 * THE SITE CONSUMES IT. Do not re-wire it to a public surface without a
 * founder decision — the open question is interior comparability, not whether
 * the floor exists. Mirrors arena/mt_eval_harness/connection_quality.py.
 * ==========================================================================*/

/** cchrF++ band edges (0–1). RESEARCH ONLY. */
export const BIN_EDGES = [0.15, 0.35, 0.55, 0.75];

/** RESEARCH ONLY. Mirrored by connectionQuality.mjs (twin-mirror test). */
export const BIN_LABELS = ['near floor', 'weak', 'developing', 'usable', 'strong'];

/** RESEARCH ONLY. Retired from the map 2026-09-04. */
export const BIN_COLORS = ['#d64550', '#e07b46', '#e8b339', '#b5cf6b', '#7fc97f'];

/** Higher floor of the pair, or null unless BOTH sides have measured floors.
 *  Conservative: the correction can understate strength, never inflate it.
 *  RESEARCH ONLY. */
export function pairFloor(floors, a, b) {
  const fa = floors ? floors[a] : null;
  const fb = floors ? floors[b] : null;
  if (typeof fa !== 'number' || typeof fb !== 'number') return null;
  return Math.max(fa, fb);
}

/** Chance-corrected chrF++ on [0,1]; null when inputs are unusable.
 *  RESEARCH ONLY. */
export function cchrf(rawChrf, floor) {
  if (typeof rawChrf !== 'number' || typeof floor !== 'number' || floor >= 100) {
    return null;
  }
  return Math.min(1, Math.max(0, (rawChrf - floor) / (100 - floor)));
}

/** Band index 0–4 for a cchrF++ value. RESEARCH ONLY. */
export function strengthBin(c) {
  let b = 0;
  for (const edge of BIN_EDGES) if (c >= edge) b += 1;
  return b;
}
