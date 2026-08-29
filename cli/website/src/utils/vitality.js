/**
 * vitality.js — the single source of truth for language-vitality DISPLAY
 * helpers (AES / endangerment levels) on the ESM (client) side.
 *
 * The per-level DATA (canonical order + label strings) is owned by
 * ./vitalityScale — the one CommonJS table the build-time graph generator
 * REQUIREs and the hero legend imports. This module re-derives its ESM-facing
 * shapes (a bare id array, a plain id→label map) FROM that table so a level's
 * label can never drift between the hero legend, the detail panel and the grid
 * tile again (defect #33: "Not Endangered" vs "Not endangered",
 * "Critically Endangered" vs "Critically endangered", …). The short labels,
 * plain-language explanations and sourcing note are ESM-only display copy and
 * live here.
 *
 * Levels are Glottolog's Agglomerated Endangerment Status buckets:
 *   thriving · shifting · endangered · critical · dormant
 */

import { VITALITY_LEVELS as VITALITY_SCALE_LEVELS } from './vitalityScale';

/** Canonical level order (least → most endangered), from the vitalityScale SSOT. */
export const VITALITY_LEVELS = VITALITY_SCALE_LEVELS.map((l) => l.id);

/**
 * Full, most human-readable labels (used in the detail panel), deduped from
 * the vitalityScale SSOT so the hero legend and the panel read ONE string per
 * level.
 */
export const VITALITY_LABELS = Object.fromEntries(
  VITALITY_SCALE_LEVELS.map((l) => [l.id, l.label]),
);

/** Compact labels for tight surfaces (the grid tile's inline dot label). */
export const VITALITY_LABELS_SHORT = {
  thriving: 'Not endangered',
  shifting: 'Shifting',
  endangered: 'Endangered',
  critical: 'Critical',
  dormant: 'Dormant',
};

/** Plain-language meaning of each level. */
export const VITALITY_EXPLANATIONS = {
  thriving: 'Not endangered — actively spoken and being passed on to children.',
  shifting: 'Language shift under way — younger generations may be moving to a dominant language.',
  endangered: 'Endangered — the speaker population is declining and transmission to children is at risk.',
  critical: 'Critically endangered — very few speakers remain, most of them elderly.',
  dormant: 'Dormant — no known fluent speakers today, though documentation may support revival.',
};

/** The sourcing caveat shown wherever the vitality badge appears. */
export const VITALITY_SOURCE_NOTE =
  "Status is Glottolog's expert endangerment assessment (AES); the speaker count is sourced separately. The two can disagree — we show each as its source reports it, without reconciling.";

/**
 * UNESCO Atlas endangerment vocabulary — a SEPARATE 6-level scale from the
 * Glottolog AES levels above. The public Index (/catalogue) tags each language
 * with one of these slugs (safe … extinct); this maps a slug to its display
 * label so a raw enum slug never reaches the screen (defect #13).
 */
export const UNESCO_VITALITY_LABELS = {
  safe: 'Safe',
  vulnerable: 'Vulnerable',
  'definitely-endangered': 'Definitely endangered',
  'severely-endangered': 'Severely endangered',
  'critically-endangered': 'Critically endangered',
  extinct: 'Extinct',
};

/**
 * getVitalityLabel(level, {short}) — human label for a level, never a bare
 * UPPERCASED code. Falls back to a title-cased version of an unknown level
 * (the old `level.toUpperCase()` fallback was the detail-panel #17 defect).
 */
export function getVitalityLabel(level, { short = false } = {}) {
  if (!level) return null;
  const map = short ? VITALITY_LABELS_SHORT : VITALITY_LABELS;
  return map[level] || (String(level).charAt(0).toUpperCase() + String(level).slice(1));
}

/** getVitalityExplanation(level) — the plain-language meaning, or ''. */
export function getVitalityExplanation(level) {
  return (level && VITALITY_EXPLANATIONS[level]) || '';
}

/**
 * getUnescoVitalityLabel(slug) — display label for a UNESCO endangerment slug,
 * falling back to a de-slugged, capitalized form for any unlisted value.
 */
export function getUnescoVitalityLabel(slug) {
  if (!slug) return null;
  return (
    UNESCO_VITALITY_LABELS[slug] ||
    String(slug).replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}
