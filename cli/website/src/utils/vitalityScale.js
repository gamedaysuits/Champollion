/**
 * vitalityScale — the ONE vocabulary for the AES endangerment gradient on
 * the hero map (founder directive 2026-07-19: endangerment must be an
 * explorer over ALL the levels, not one flat bucket).
 *
 * SSOT ACROSS BOTH RUNTIMES (the pairReachability.js pattern): the
 * build-time graph generator REQUIREs this file (CommonJS) to map each
 * card's `vitalityBadge.level` into the packed node column, and the client
 * hero/engine webpack-import it for the explorer panel, chip copy, and the
 * per-level ember sprites. There is deliberately no second copy of this
 * table anywhere — change it here or nowhere. The generator FAILS LOUDLY
 * on any level string not listed here, so upstream vocabulary drift can
 * never silently bucket languages as "unknown".
 *
 * AUTHORITY: per-language levels are Glottolog's Agglomerated Endangerment
 * Status (AES), champollion-normalized upstream in the DB to the five ids
 * below (each language card cites its Glottolog entry; `desc` carries the
 * AES reading). Aggregate COUNTS over these levels are computed by
 * Champollion and carry champollion-derived provenance — Glottolog
 * publishes per-language ratings, never these totals.
 *
 * Numeric `v` values match graph.json's packed column (generateGraphJson
 * v13: p = v*15 + q*3 + st) and the poster node tuple's 5th element;
 * V_UNKNOWN marks unrated codes.
 *
 * Colors are the map's ember ramp (theme-static — the hero is pinned dark,
 * and the SSR poster bakes colors at build time): warmth deepens as risk
 * deepens, and dormant cools to an ash violet — a light gone out, not a
 * hotter fire. thriving keeps the field's cool slate (never highlighted
 * as risk).
 */

const V_UNKNOWN = 5;

const VITALITY_LEVELS = [
  {
    id: 'thriving',
    v: 0,
    label: 'Not endangered',
    color: '#64778c', // cool slate — the healthy baseline, not a warning
    desc: 'Glottolog AES: not endangered — intergenerational transmission intact.',
    atRisk: false,
  },
  {
    id: 'shifting',
    v: 1,
    label: 'Shifting',
    color: '#e0a33a', // amber — first warmth
    desc: 'Glottolog AES: shifting — some children no longer acquire the language.',
    atRisk: true,
  },
  {
    id: 'endangered',
    v: 2,
    label: 'Endangered',
    color: '#e0763a', // orange
    desc: 'Glottolog AES: endangered — children no longer acquire the language.',
    atRisk: true,
  },
  {
    id: 'critical',
    v: 3,
    label: 'Critically endangered',
    color: '#e0503a', // deep ember red
    desc: 'Glottolog AES: nearly extinct — few elderly speakers remain.',
    atRisk: true,
  },
  {
    id: 'dormant',
    v: 4,
    label: 'Dormant / sleeping',
    color: '#a08bb8', // ash violet — a light gone out
    desc: 'Glottolog AES: dormant — no known first-language speakers; revival possible.',
    atRisk: true,
  },
];

const LEVEL_BY_V = new Map(VITALITY_LEVELS.map((l) => [l.v, l]));
const LEVEL_BY_ID = new Map(VITALITY_LEVELS.map((l) => [l.id, l]));

/** The v values the "at risk" aggregate covers (shifting…dormant). */
const AT_RISK_VS = VITALITY_LEVELS.filter((l) => l.atRisk).map((l) => l.v);

module.exports = {
  V_UNKNOWN,
  VITALITY_LEVELS,
  LEVEL_BY_V,
  LEVEL_BY_ID,
  AT_RISK_VS,
};
