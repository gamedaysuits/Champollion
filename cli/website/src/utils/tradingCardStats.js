/**
 * Trading Card Stats — Browser-side display utilities.
 *
 * Stats, rarity, and abilities are now pre-computed at build time by
 * build-trading-card-data.mjs from SQLite facts. This file provides
 * ONLY the display-layer helpers the UI needs:
 *
 * Exports:
 *   STAT_LABELS                 → labels and descriptions for the 3 stats
 *   VITALITY_BADGES             → color/label config for vitality badges
 *   TOOLKIT_LABELS              → labels for the 5 Digital Toolkit pips
 *   DATA_QUALITY_BADGES         → data quality tier config
 *   RARITY_TIERS                → rarity tier config (for display only)
 *   getFamilyTheme(card)        → { gradient, accent, glow }
 *   formatSpeakerCount(card)    → "~20K" | "~125M" | "Unknown"
 *   getPipelineReadiness(card)  → { label, emoji }
 *   getDataQualityBadge(factCount) → { label, emoji, cssClass }
 *   getVitalityBadgeConfig(level)  → { label, color, emoji }
 */

// ---------------------------------------------------------------------------
// 1. STAT SYSTEM — Labels and display configuration
//
// The actual stat values are pre-computed in tc-index.json by the build
// script. These constants tell the UI how to render them.
// ---------------------------------------------------------------------------

/**
 * The 3 front-facing stats. Each card carries pre-computed values for these
 * in its index entry. The UI renders them using these labels.
 */
export const STAT_LABELS = {
  challengeRating: {
    label: 'Challenge Rating',
    emoji: '⚔️',
    description: 'How hard is this language to machine translate? A composite of API support, corpus availability, typological distance from English, and documentation depth.',
    methodology: 'Composite of: API Support Gap (30%), Corpus Desert Score (25%), Typological Distance (25%), Documentation Depth (20%). Each component is individually cited from linguistic databases.',
  },
  digitalToolkit: {
    label: 'Digital Toolkit',
    emoji: '🧰',
    description: 'What tools and resources exist for working with this language?',
    methodology: 'Each pip represents one real, verifiable resource: Parallel Corpus (OPUS), Treebank (UD), Speech Data (CommonVoice), MT API, Keyboard.',
  },
  vitality: {
    label: 'Language Vitality',
    emoji: '🌱',
    description: 'What is the preservation status of this language?',
    methodology: 'This badge shows ONE source: Glottolog’s Agglomerated Endangerment Status (AES) — Glottolog’s own aggregation of expert assessments, reported here as Glottolog’s value. Other cited sources (UNESCO/Wikidata, ELCat) can and do disagree; the full card shows each source’s own assessment. Champollion is an index, not an arbiter.',
  },
};

/**
 * Vitality badge display configuration.
 * Maps the vitality.level string (from the build script) to display properties.
 */
export const VITALITY_BADGES = {
  thriving:   { label: 'THRIVING',   color: '#4caf50', emoji: '🟢', cssClass: 'vitalityThriving' },
  shifting:   { label: 'SHIFTING',   color: '#ff9800', emoji: '🟡', cssClass: 'vitalityShifting' },
  endangered: { label: 'ENDANGERED', color: '#f4511e', emoji: '🟠', cssClass: 'vitalityEndangered' },
  critical:   { label: 'CRITICAL',   color: '#d32f2f', emoji: '🔴', cssClass: 'vitalityCritical' },
  dormant:    { label: 'DORMANT',    color: '#9e9e9e', emoji: '⚫', cssClass: 'vitalityDormant' },
};

/**
 * Digital Toolkit pip labels — matches the build script's pip order.
 */
export const TOOLKIT_LABELS = [
  'Parallel Corpus',
  'Treebank',
  'Speech Data',
  'MT API',
  'Keyboard',
];

// ---------------------------------------------------------------------------
// 2. RARITY TIERS — Display configuration
// ---------------------------------------------------------------------------

export const RARITY_TIERS = {
  mythic:    { tier: 'mythic',    label: 'MYTHIC',    emoji: '🔮', cssClass: 'rarityMythic' },
  legendary: { tier: 'legendary', label: 'LEGENDARY', emoji: '⭐', cssClass: 'rarityLegendary' },
  epic:      { tier: 'epic',      label: 'EPIC',      emoji: '💎', cssClass: 'rarityEpic' },
  rare:      { tier: 'rare',      label: 'RARE',      emoji: '🔷', cssClass: 'rarityRare' },
  uncommon:  { tier: 'uncommon',  label: 'UNCOMMON',  emoji: '🟢', cssClass: 'rarityUncommon' },
  common:    { tier: 'common',    label: 'COMMON',    emoji: '⚪', cssClass: 'rarityCommon' },
};

// ---------------------------------------------------------------------------
// 3. DATA QUALITY BADGES
//
// Based on fact count — how well-documented is this language in our database?
// ---------------------------------------------------------------------------

const DATA_QUALITY_TIERS = [
  { min: 500, label: 'Well-Documented', emoji: '🟢', cssClass: 'dataQualityHigh' },
  { min: 100, label: 'Moderate',        emoji: '🟡', cssClass: 'dataQualityMedium' },
  { min: 30,  label: 'Sparse',          emoji: '🟠', cssClass: 'dataQualityLow' },
  { min: 0,   label: 'Minimal',         emoji: '🔴', cssClass: 'dataQualityMinimal' },
];

/**
 * Determine the data quality badge based on the number of cited facts
 * in our database for this language.
 */
export function getDataQualityBadge(factCount) {
  for (const tier of DATA_QUALITY_TIERS) {
    if (factCount >= tier.min) return tier;
  }
  return DATA_QUALITY_TIERS[DATA_QUALITY_TIERS.length - 1];
}

/**
 * Get the vitality badge display configuration for a given level.
 */
export function getVitalityBadgeConfig(level) {
  return VITALITY_BADGES[level] || VITALITY_BADGES.shifting;
}

// ---------------------------------------------------------------------------
// 4. FAMILY THEME (Color palette per language family)
// ---------------------------------------------------------------------------

/**
 * Color themes keyed by classification.family.
 * Each theme defines CSS custom properties for the card gradient.
 */
const FAMILY_THEMES = {
  'Algic':            { gradient: 'linear-gradient(135deg, #0d4f5e 0%, #1a3040 100%)', accent: '#e8b84c', glow: 'rgba(232, 184, 76, 0.5)' },
  'Indo-European':    { gradient: 'linear-gradient(135deg, #1e2050 0%, #3a3a78 100%)', accent: '#8b9fd4', glow: 'rgba(139, 159, 212, 0.4)' },
  'Japonic':          { gradient: 'linear-gradient(135deg, #2a1040 0%, #5c1818 100%)', accent: '#e0b862', glow: 'rgba(224, 184, 98, 0.5)' },
  'Sino-Tibetan':     { gradient: 'linear-gradient(135deg, #401010 0%, #0e2e0e 100%)', accent: '#68c468', glow: 'rgba(104, 196, 104, 0.4)' },
  'Afro-Asiatic':     { gradient: 'linear-gradient(135deg, #2e1248 0%, #4a2810 100%)', accent: '#e0c480', glow: 'rgba(224, 196, 128, 0.5)' },
  'Austronesian':     { gradient: 'linear-gradient(135deg, #0e3840 0%, #402020 100%)', accent: '#4ce8d8', glow: 'rgba(76, 232, 216, 0.4)' },
  'Koreanic':         { gradient: 'linear-gradient(135deg, #0e2858 0%, #203868 100%)', accent: '#60b8f0', glow: 'rgba(96, 184, 240, 0.5)' },
  'Atlantic-Congo':   { gradient: 'linear-gradient(135deg, #2e1030 0%, #103828 100%)', accent: '#e8c040', glow: 'rgba(232, 192, 64, 0.5)' },
  'Quechuan':         { gradient: 'linear-gradient(135deg, #4a2810 0%, #0e2810 100%)', accent: '#d08840', glow: 'rgba(208, 136, 64, 0.5)' },
  'Na-Dené':          { gradient: 'linear-gradient(135deg, #0e3838 0%, #402010 100%)', accent: '#50d8c8', glow: 'rgba(80, 216, 200, 0.5)' },
  'Turkic':           { gradient: 'linear-gradient(135deg, #282810 0%, #3e3820 100%)', accent: '#e8d080', glow: 'rgba(232, 208, 128, 0.4)' },
  'Uralic':           { gradient: 'linear-gradient(135deg, #102840 0%, #203850 100%)', accent: '#90c8e0', glow: 'rgba(144, 200, 224, 0.4)' },
  'Kartvelian':       { gradient: 'linear-gradient(135deg, #2e1810 0%, #182828 100%)', accent: '#c88060', glow: 'rgba(200, 128, 96, 0.4)' },
  'Dravidian':        { gradient: 'linear-gradient(135deg, #181030 0%, #282810 100%)', accent: '#e0a848', glow: 'rgba(224, 168, 72, 0.4)' },
  'Niger-Congo':      { gradient: 'linear-gradient(135deg, #2e1030 0%, #103828 100%)', accent: '#e8c040', glow: 'rgba(232, 192, 64, 0.5)' },
  'Austroasiatic':    { gradient: 'linear-gradient(135deg, #102828 0%, #283010 100%)', accent: '#98d070', glow: 'rgba(152, 208, 112, 0.4)' },
  'Tai-Kadai':        { gradient: 'linear-gradient(135deg, #201040 0%, #382010 100%)', accent: '#e0c050', glow: 'rgba(224, 192, 80, 0.4)' },
  'Constructed':      { gradient: 'linear-gradient(135deg, #141430 0%, #282840 100%)', accent: '#9898e0', glow: 'rgba(152, 152, 224, 0.4)' },
};

// Default theme for families not in the map
const DEFAULT_THEME = {
  gradient: 'linear-gradient(135deg, #181828 0%, #282838 100%)',
  accent: '#3FC1C0',
  glow: 'rgba(63, 193, 192, 0.4)',
};

/**
 * Get the color theme for a language card based on its family classification.
 */
export function getFamilyTheme(card) {
  // Conlang detection
  if (card.code?.startsWith('x-') || card.code === 'tlh') {
    return FAMILY_THEMES['Constructed'];
  }

  const family = card.family || card.classification?.family || card.encyclopedic?.family || '';

  // Try direct match first
  if (FAMILY_THEMES[family]) return FAMILY_THEMES[family];

  // Try partial match (e.g., "Semitic (Afro-Asiatic)" → "Afro-Asiatic")
  for (const [key, theme] of Object.entries(FAMILY_THEMES)) {
    if (family.includes(key) || key.includes(family)) return theme;
  }

  return DEFAULT_THEME;
}

// ---------------------------------------------------------------------------
// 5. SPEAKER COUNT FORMATTING
// ---------------------------------------------------------------------------

/**
 * Extract and format speaker count for display on the card.
 * Tries vitality.speakerCount first (can be a number or string),
 * then falls back to encyclopedic.demographics.speakers.
 */
export function formatSpeakerCount(card) {
  // Try numeric speakerCount first
  const vitalityCount = card.vitality?.speakerCount;
  if (typeof vitalityCount === 'number') {
    if (vitalityCount >= 1_000_000_000) return `~${(vitalityCount / 1_000_000_000).toFixed(1)}B`;
    if (vitalityCount >= 1_000_000) return `~${Math.round(vitalityCount / 1_000_000)}M`;
    if (vitalityCount >= 1_000) return `~${Math.round(vitalityCount / 1_000)}K`;
    return `~${vitalityCount}`;
  }

  // Try string speakerCount (e.g., "~125M L1")
  if (typeof vitalityCount === 'string' && vitalityCount.trim()) {
    // Clean up common patterns: remove "L1", "L2", "(all varieties)"
    return vitalityCount
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/\s*L[12]\s*$/i, '')
      .replace(/\s*\+\s*L2.*$/i, '')
      .trim();
  }

  // Fallback to encyclopedic demographics
  const demoSpeakers = card.encyclopedic?.demographics?.speakers;
  if (demoSpeakers) {
    return demoSpeakers
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/Approx\.\s*/i, '~')
      .trim();
  }

  return 'Unknown';
}

// ---------------------------------------------------------------------------
// 6. PIPELINE READINESS LABEL
// ---------------------------------------------------------------------------

/**
 * Maps pipelineReadiness.tier values from language cards to display labels.
 * Tiers are derived by derive-pipeline-readiness.mjs based on the number
 * of NLP resource components present (score 0–100).
 */
const PIPELINE_LABELS = {
  // Current card schema tiers (from derive-pipeline-readiness.mjs)
  'strong':   { label: 'Strong',   emoji: '🟢' },
  'good':     { label: 'Good',     emoji: '🟡' },
  'moderate': { label: 'Moderate', emoji: '🟠' },
  'low':      { label: 'Low',      emoji: '🔴' },
  'minimal':  { label: 'Minimal',  emoji: '⚫' },
  // Legacy tier names (kept for backward compatibility)
  'tier-1-production': { label: 'Production', emoji: '🟢' },
  'tier-2-feasible':   { label: 'Feasible',   emoji: '🟡' },
  'tier-3-buildable':  { label: 'Buildable',  emoji: '🟠' },
  'watch-list':        { label: 'Watch List',  emoji: '👁️' },
  'not-applicable':    { label: 'N/A',         emoji: '➖' },
};

export function getPipelineReadiness(card) {
  const tier = card.pipelineReadiness?.tier || 'not-applicable';
  return PIPELINE_LABELS[tier] || PIPELINE_LABELS['not-applicable'];
}
