#!/usr/bin/env node

// ─── RETIRED (2026-08-18, champollion.db retirement B7) ─────────────────────
// This script belongs to the LEGACY champollion.db lane, which no card is
// built from. Running it would write to (or derive from) a store nothing
// reads. Refuse loudly instead of running against a retired store.
// Ledger: shared/cldf/deprecations.json.
console.error(
  'build-trading-card-data.mjs is RETIRED — the legacy champollion.db lane is retired.\n'
  + 'Replacement: node mt-eval-arena/scripts/build-trading-card-data.mjs (the live atlas-backed build)\n'
  + 'See shared/cldf/deprecations.json.'
);
process.exit(2);
// ────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ SUPERSEDED — DO NOT USE FOR THE WEBSITE DATA. Verified 2026-08-01.
 *
 * Running this against cli/website/data/ produces a tc-index.json that the
 * site's OWN GATE REJECTS, and the build then fails:
 *
 *   [tc-index] 8710 entries and NONE carries isoType — a schema-drifted
 *   Supabase round-trip (the trading_card_index taxonomy columns of migration
 *   056 are absent or were never backfilled).
 *
 * That is not a hypothetical. It happened: this script was run here, it
 * overwrote a good index with one missing the migration-056 taxonomy columns,
 * and the next `docusaurus build` refused. The gate did its job.
 *
 * THE LIVE PRODUCER of cli/website/data/ is
 * `cli/website/scripts/build-data-from-supabase.mjs`, which emits tc-index.json,
 * tc-lang/<code>.json AND languages.json, and is wired into the website's
 * prestart/prebuild:
 *
 *   cd cli/website && npm run ensure-tc-index -- --force
 *
 * The maintained SQLite→staging sibling of this file is
 * `mt-eval-arena/scripts/build-trading-card-data.mjs` — that one has an npm
 * script, a test pin (cli/test/tc-index-taxonomy.test.js), and the 056
 * taxonomy handling this copy lacks. It writes to data/staging/ for upload,
 * not to the website.
 *
 * Kept, not deleted, because it is the DB→cards reference implementation the
 * word-order re-derivation runbook still walks through. Deliberately given NO
 * npm script: a one-command path to a broken artifact is worse than a script
 * you have to type out on purpose.
 */


/**
 * build-trading-card-data.mjs — Bridge Script
 *
 * Queries the Champollion SQLite database and generates optimized JSON
 * data files for the trading cards website page.
 *
 * Outputs:
 *   cli/website/data/tc-index.json       — Compact index for the card grid
 *   cli/website/data/tc-lang/{code}.json  — Per-language detail for on-demand modal loading
 *
 * Design:
 *   - Every piece of data on a card is sourced from the database with citation
 *   - Nothing is invented — if the database doesn't have it, the card doesn't show it
 *   - Two-tier loading: index loads instantly for the grid, detail loads on-demand
 *   - Pre-computes stats and rarity at build time so the browser does no heavy lifting
 *
 * Usage:
 *   node scripts/build-trading-card-data.mjs
 *   node scripts/build-trading-card-data.mjs --lang crk   # Single language (debug)
 *   node scripts/build-trading-card-data.mjs --dry-run     # Preview, no file writes
 */

import { openDatabase } from './db.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'website', 'data');


// ---------------------------------------------------------------------------
// CLI ARGS
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const singleLang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;

// ---------------------------------------------------------------------------
// STAT COMPUTATION — Grounded Stats System
//
// Every stat is derived from citable, verifiable data sources:
//   - SQLite facts (corpus, typology, identity, orthography domains)
//
// Three stats replace the previous six arbitrary ones:
//   1. Challenge Rating (0–100): composite of 4 weighted components
//   2. Digital Toolkit (5 boolean pips): verifiable resource checklist
//   3. Vitality Badge (categorical): from Glottolog AES or UNESCO fallback
// ---------------------------------------------------------------------------

/**
 * Count how many translation methods are supported for this language.
 * Checks 6 known MT API/model keys from corpus-domain facts in the DB.
 * If no API support facts exist, we report 0 supported.
 */
function countSupportedMethods(facts) {
  const apiKeys = [
    'googleTranslate', 'deepl', 'microsoftTranslator',
    'libreTranslate', 'nllb', 'llm',
  ];
  let supported = 0;
  for (const key of apiKeys) {
    const fact = facts.find(f => f.property === key && (f.domain === 'corpus' || f.domain === 'identity'));
    if (fact && (fact.value === 'true' || fact.value === '1' || safeParse(fact.value)?.supported)) supported++;
  }
  return { supported, total: apiKeys.length };
}

/**
 * Safely parse a JSON string, returning null on failure.
 * Many fact values in the database are stored as JSON strings that need
 * to be parsed before their sub-fields can be inspected.
 */
function safeParse(jsonStr) {
  if (jsonStr == null) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Find a single fact by domain and property name from the facts array.
 * Returns the first match, or null if not found.
 */
function findFact(facts, domain, property) {
  return facts.find(f => f.domain === domain && f.property === property) || null;
}

/**
 * Compute all three grounded stats for a language.
 *
 * @param {string} code - Language code (for diagnostics only)
 * @param {Array} facts - All SQLite facts for this language (from db.getFactsForLanguage)
 * @returns {{ challengeRating, digitalToolkit, vitality }}
 */
function computeGroundedStats(code, facts) {
  // -------------------------------------------------------------------
  // COMPONENT A: API Support Gap (30% of Challenge Rating)
  // How many of the 6 known MT APIs/models lack support for this language?
  // More gaps = harder to translate via existing tools.
  // -------------------------------------------------------------------
  const { supported: apiSupported, total: apiTotal } = countSupportedMethods(facts);
  const apiGap = (1 - apiSupported / apiTotal) * 100;
  const apiGapSource = 'api-verification';

  // -------------------------------------------------------------------
  // COMPONENT B: Corpus Desert Score (25% of Challenge Rating)
  // Checks 3 key corpus resources in the SQLite 'corpus' domain.
  // Each missing resource adds ~33 points — all absent = 100.
  // -------------------------------------------------------------------
  const opusFact = findFact(facts, 'corpus', 'opusAvailable');
  const udFact = findFact(facts, 'corpus', 'udAvailable');
  const cvFact = findFact(facts, 'corpus', 'hasCommonVoiceData');

  // Parse each corpus fact value to determine availability
  const opusParsed = safeParse(opusFact?.value);
  const opusPresent = opusParsed != null
    && typeof opusParsed === 'object'
    && (opusParsed.corpora || 0) > 0;

  const udParsed = safeParse(udFact?.value);
  const udPresent = udParsed != null
    && typeof udParsed === 'object'
    && (udParsed.treebanks || 0) > 0;

  const cvParsed = safeParse(cvFact?.value);
  // hasCommonVoiceData can be the string 'true' or a JSON object with hours
  const cvPresent = cvFact != null
    && (cvFact.value === 'true'
        || (cvParsed != null && typeof cvParsed === 'object' && Object.keys(cvParsed).length > 0)
        || cvFact.value === '1');

  let corpusDesert = 0;
  if (!opusPresent) corpusDesert += 33.3;
  if (!udPresent)   corpusDesert += 33.3;
  if (!cvPresent)   corpusDesert += 33.4; // Rounds to 100 when all absent
  const corpusDesertSource = 'opus/ud/commonvoice';

  // -------------------------------------------------------------------
  // COMPONENT C: Typological Distance (25% of Challenge Rating)
  // Counts features that make MT from/to English structurally harder.
  // Each feature has a point value; total is capped at 100.
  // -------------------------------------------------------------------
  const typDistanceSources = [];
  let typDistance = 0;

  // Word order: dominance other than SVO (English baseline) adds difficulty.
  // Only WALS 81A makes a dominance claim. The grambank-derived 'wordOrder'
  // fact is an attested verb–object order — VO/OV/flexible, never SVO/SOV/…
  // (see enrich-grambank-v2.mjs) — where only VO aligns with English.
  const dominanceFact = findFact(facts, 'typology', 'Order of Subject, Object and Verb')
    || findFact(facts, 'typology', 'wordOrderDominant');
  const attestedOrderFact = findFact(facts, 'typology', 'wordOrder');
  if (dominanceFact) {
    if (dominanceFact.value !== 'SVO') {
      typDistance += 15;
    }
    typDistanceSources.push(`wordOrder:${dominanceFact.source}`);
  } else if (attestedOrderFact) {
    const wo = attestedOrderFact.value?.toUpperCase?.();
    if (wo && wo !== 'VO' && wo !== 'SVO') {
      typDistance += 15;
    }
    typDistanceSources.push(`wordOrder:${attestedOrderFact.source}`);
  }

  // Morphological case increases word-form count significantly
  const caseFact = findFact(facts, 'typology', 'hasCase')
    || findFact(facts, 'typology', 'hasCaseMorphology');
  if (caseFact && (caseFact.value === 'true' || caseFact.value === '1')) {
    typDistance += 15;
    typDistanceSources.push(`hasCase:${caseFact.source}`);
  }

  // Inclusive/exclusive distinction — no English equivalent
  const inclExclFact = findFact(facts, 'typology', 'hasInclusiveExclusive');
  if (inclExclFact && (inclExclFact.value === 'true' || inclExclFact.value === '1')) {
    typDistance += 15;
    typDistanceSources.push(`hasInclusiveExclusive:${inclExclFact.source}`);
  }

  // Numeral classifiers — no English equivalent
  const classifierFact = findFact(facts, 'typology', 'hasNumeralClassifiers');
  if (classifierFact && (classifierFact.value === 'true' || classifierFact.value === '1')) {
    typDistance += 15;
    typDistanceSources.push(`hasNumeralClassifiers:${classifierFact.source}`);
  }

  // Grammatical gender adds agreement complexity
  const genderFact = findFact(facts, 'typology', 'hasGender')
    || findFact(facts, 'typology', 'hasGenderSystem');
  if (genderFact && (genderFact.value === 'true' || genderFact.value === '1')) {
    typDistance += 10;
    typDistanceSources.push(`hasGender:${genderFact.source}`);
  }

  // RTL text direction introduces rendering and processing challenges
  const dirFact = findFact(facts, 'orthography', 'direction');
  if (dirFact && dirFact.value === 'rtl') {
    typDistance += 10;
    typDistanceSources.push(`dir:${dirFact.source}`);
  }

  // Multiple scripts increase tokenization and normalization complexity
  const scriptFacts = facts.filter(f => f.property === 'script' && f.domain === 'orthography');
  if (scriptFacts.length > 1) {
    typDistance += 10;
    typDistanceSources.push(`multiScript:${scriptFacts[0].source}`);
  }

  typDistance = Math.min(100, typDistance);

  // -------------------------------------------------------------------
  // COMPONENT D: Documentation Depth (20% of Challenge Rating)
  // Uses Glottolog's MED (Most Extensive Description) scale:
  //   0 = undocumented, 1 = wordlist, 2 = sketch, 3 = grammar, 4 = extensive grammar
  // Lower documentation = higher challenge score.
  // -------------------------------------------------------------------
  const medFact = findFact(facts, 'typology', 'Most Extensive Description');
  let medValue = 0; // Default: undocumented (worst case)
  let docDepthSource = 'glottolog';
  if (medFact) {
    const parsed = parseInt(medFact.value, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 4) {
      medValue = parsed;
    }
    docDepthSource = medFact.source || 'glottolog';
  }
  const docDepth = ((4 - medValue) / 4) * 100;

  // -------------------------------------------------------------------
  // FINAL CHALLENGE RATING: weighted composite of all 4 components
  // -------------------------------------------------------------------
  const challengeScore = Math.round(
    apiGap      * 0.30 +
    corpusDesert * 0.25 +
    typDistance  * 0.25 +
    docDepth     * 0.20
  );

  // Build a human-readable tooltip explaining the score breakdown
  const tooltipParts = [
    `API Gap: ${Math.round(apiGap)} (${apiSupported}/${apiTotal} APIs)`,
    `Corpus: ${Math.round(corpusDesert)} (OPUS:${opusPresent ? '✓' : '✗'} UD:${udPresent ? '✓' : '✗'} CV:${cvPresent ? '✓' : '✗'})`,
    `Typology: ${Math.round(typDistance)} (${typDistanceSources.length} features)`,
    `Docs: ${Math.round(docDepth)} (MED=${medValue})`,
  ];

  const challengeRating = {
    score: challengeScore,
    components: {
      apiGap: Math.round(apiGap),
      corpusDesert: Math.round(corpusDesert),
      typDistance: Math.round(typDistance),
      docDepth: Math.round(docDepth),
    },
    sources: [
      apiGapSource,
      corpusDesertSource,
      ...typDistanceSources,
      docDepthSource,
    ],
    tooltip: tooltipParts.join(' | '),
  };

  // -------------------------------------------------------------------
  // DIGITAL TOOLKIT: 5 verifiable boolean pips
  // Each represents a concrete, checkable resource existing for this language.
  // -------------------------------------------------------------------
  const hasParallelCorpus = opusPresent;
  const hasTreebank = udPresent;
  const hasSpeechData = cvPresent;
  const hasMTAPI = apiSupported >= 1;
  // Keyboard support — check facts for any keyboard-related data
  const kbFact = findFact(facts, 'corpus', 'keyboardSupport')
    || findFact(facts, 'identity', 'keyboardSupport');
  const hasKeyboard = !!kbFact;

  const pips = [hasParallelCorpus, hasTreebank, hasSpeechData, hasMTAPI, hasKeyboard];
  const pipCount = pips.filter(Boolean).length;

  const digitalToolkit = {
    pips,
    count: pipCount,
    labels: ['Parallel Corpus', 'Treebank', 'Speech Data', 'MT API', 'Keyboard'],
    details: {
      parallelCorpus: opusParsed,
      treebank: udParsed,
      speechData: cvParsed,
      mtApiCount: apiSupported,
      keyboard: hasKeyboard,
    },
    sources: [
      opusFact?.source || null,
      udFact?.source || null,
      cvFact?.source || null,
      apiGapSource,
      kbFact?.source || null,
    ].filter(Boolean),
  };

  // -------------------------------------------------------------------
  // VITALITY BADGE: categorical from Glottolog AES
  // AES (Agglomerated Endangerment Status) is a 1–6 integer scale.
  // If unavailable, we default to 'thriving' (safest assumption).
  // -------------------------------------------------------------------
  const AES_MAP = { 1: 'thriving', 2: 'shifting', 3: 'shifting', 4: 'endangered', 5: 'critical', 6: 'dormant' };
  const UNESCO_MAP = {
    'safe': 'thriving',
    'vulnerable': 'shifting',
    'endangered': 'endangered',
    'definitely-endangered': 'endangered',
    'severely-endangered': 'endangered',
    'critically-endangered': 'critical',
  };

  let vitalityLevel = 'thriving'; // Default for unlabeled languages
  let vitalitySource = 'default';
  let aesValue = null;

  const aesFact = findFact(facts, 'typology', 'Agglomerated Endangerment Status');
  if (aesFact) {
    const parsed = parseInt(aesFact.value, 10);
    if (!isNaN(parsed) && AES_MAP[parsed]) {
      aesValue = parsed;
      vitalityLevel = AES_MAP[parsed];
      vitalitySource = 'glottolog-aes';
    }
  }

  // UNESCO_MAP kept for future use when UNESCO status facts are ingested

  const vitality = {
    level: vitalityLevel,
    source: vitalitySource,
    aesValue,
  };

  return { challengeRating, digitalToolkit, vitality };
}

// ---------------------------------------------------------------------------
// RARITY TIER — derived from grounded stats
// ---------------------------------------------------------------------------

const RARITY_TIERS = {
  mythic:    { tier: 'mythic',    label: 'MYTHIC',    emoji: '🔮', cssClass: 'rarityMythic' },
  legendary: { tier: 'legendary', label: 'LEGENDARY', emoji: '⭐', cssClass: 'rarityLegendary' },
  epic:      { tier: 'epic',      label: 'EPIC',      emoji: '💎', cssClass: 'rarityEpic' },
  rare:      { tier: 'rare',      label: 'RARE',      emoji: '🔷', cssClass: 'rarityRare' },
  uncommon:  { tier: 'uncommon',  label: 'UNCOMMON',  emoji: '🟢', cssClass: 'rarityUncommon' },
  common:    { tier: 'common',    label: 'COMMON',    emoji: '⚪', cssClass: 'rarityCommon' },
};

/**
 * Compute rarity tier from grounded stats.
 *
 * Rarity is a weighted composite of:
 *   - Challenge Rating (50%): how hard is this language for MT?
 *   - Digital Toolkit deficit (30%): fewer tools = rarer
 *   - Vitality urgency (20%): endangered/critical languages are rarer collectibles
 */
function computeRarityTier(challengeRating, digitalToolkit, vitalityBadge) {
  // Map vitality level to a numeric urgency score
  const vitalityScores = { thriving: 10, shifting: 40, endangered: 70, critical: 90, dormant: 60 };
  const vitalityScore = vitalityScores[vitalityBadge.level] || 30;

  // Toolkit deficit: 5 possible pips, each missing pip = 10 points
  const toolkitDeficit = (5 - digitalToolkit.count) * 10;

  const rarityScore =
    challengeRating.score * 0.50 +
    toolkitDeficit        * 0.30 +
    vitalityScore         * 0.20;

  // Thresholds calibrated for the grounded stats distribution:
  // Max observed rarityScore ≈ 72, average ≈ 48, min ≈ 12.
  // Target: ~50 mythic, ~200 legendary, ~1500 epic, ~3000 rare, ~2500 uncommon, ~700 common
  if (rarityScore >= 70) return RARITY_TIERS.mythic;
  if (rarityScore >= 60) return RARITY_TIERS.legendary;
  if (rarityScore >= 52) return RARITY_TIERS.epic;
  if (rarityScore >= 45) return RARITY_TIERS.rare;
  if (rarityScore >= 35) return RARITY_TIERS.uncommon;
  return RARITY_TIERS.common;
}

function formatSpeakerCount(facts) {
  const speakerFact = facts.find(f => f.property === 'speakerCount');
  if (!speakerFact) return 'Unknown';
  const val = speakerFact.value;
  const num = parseInt(val, 10);
  if (!isNaN(num)) {
    if (num >= 1_000_000_000) return `~${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `~${Math.round(num / 1_000_000)}M`;
    if (num >= 1_000) return `~${Math.round(num / 1_000)}K`;
    return `~${num}`;
  }
  if (typeof val === 'string' && val.trim()) {
    return val.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*L[12]\s*$/i, '').trim();
  }
  return 'Unknown';
}

const PIPELINE_LABELS = {
  'strong': { label: 'Strong', emoji: '🟢' },
  'good': { label: 'Good', emoji: '🟡' },
  'moderate': { label: 'Moderate', emoji: '🟠' },
  'low': { label: 'Low', emoji: '🔴' },
  'minimal': { label: 'Minimal', emoji: '⚫' },
  'tier-1-production': { label: 'Production', emoji: '🟢' },
  'tier-2-feasible': { label: 'Feasible', emoji: '🟡' },
  'tier-3-buildable': { label: 'Buildable', emoji: '🟠' },
  'watch-list': { label: 'Watch List', emoji: '👁️' },
  'not-applicable': { label: 'N/A', emoji: '➖' },
};

function getPipelineReadiness(card) {
  const tier = card.pipelineReadiness?.tier || 'not-applicable';
  return PIPELINE_LABELS[tier] || PIPELINE_LABELS['not-applicable'];
}

// ---------------------------------------------------------------------------
// SPECIAL ABILITIES (mirrored from tradingCardStats.js)
// Pre-computed at build time so the browser does no string matching.
// ---------------------------------------------------------------------------

const ABILITY_MAP = [
  { match: 'polysynthes',            name: 'POLYSYNTHETIC',       desc: 'One word = one sentence' },
  { match: 'evidential',             name: 'EVIDENTIAL MARKERS',  desc: 'Must encode source of knowledge' },
  { match: 'tonaldiacrit',           name: 'TONE SHIFT',          desc: 'Same letters, different meanings' },
  { match: 'serialverb',             name: 'SERIAL VERBS',        desc: 'Multiple verbs, one subject' },
  { match: 'compoundnoun',           name: 'COMPOUND FORGE',      desc: 'Infinite noun concatenation' },
  { match: 'inclusiveexclusive',     name: 'CLUSIVITY',           desc: 'We-with-you vs we-without-you' },
  { match: 'classificatory',         name: 'CLASSIFICATORY',      desc: 'Verb changes by object shape' },
  { match: 'rootpattern',            name: 'ROOT PATTERN',        desc: 'Three consonants, infinite words' },
  { match: 'initialmutation',        name: 'INITIAL MUTATION',    desc: 'First consonant shifts by grammar' },
  { match: 'scriptmixing',           name: 'TRIPLE SCRIPT',       desc: 'Multiple writing systems at once' },
  { match: 'animacy',                name: 'ANIMACY',             desc: 'Grammar changes if noun is alive' },
  { match: 'dualnumber',             name: 'DUAL NUMBER',         desc: 'Special form for exactly two' },
  { match: 'complexplural',          name: 'BROKEN PLURALS',      desc: 'Internal vowel pattern changes' },
  { match: 'honorificverb',          name: 'HONORIFIC VERBS',     desc: 'Wrong ending = wrong respect' },
  { match: 'honorificvocab',         name: 'HONORIFIC VOCAB',     desc: 'Different words per politeness' },
  { match: 'subdotdiacrit',          name: 'SUB-DOT DIACRITICS', desc: 'Dots below change the phoneme' },
  { match: 'diacriticalsensit',      name: 'DIACRITICAL',         desc: 'Marks change meaning entirely' },
  { match: 'bidirectional',          name: 'BIDI TEXT',           desc: 'RTL + LTR in one string' },
  { match: 'ideophone',              name: 'IDEOPHONES',          desc: 'Sound-symbolic sensory words' },
  { match: 'countersufix',           name: 'COUNTER SYSTEM',      desc: 'Different counters per category' },
  { match: 'counters',               name: 'COUNTER SYSTEM',      desc: 'Different counters per category' },
  { match: 'subjectomission',        name: 'SUBJECT DROP',        desc: 'Knowing what to leave unsaid' },
  { match: 'dialectfragment',        name: 'DIALECT MOSAIC',      desc: 'Varieties are partially unintelligible' },
  { match: 'textexpansion',          name: 'TEXT EXPANSION',      desc: '20–30% longer than English' },
  { match: 'genderedaddress',        name: 'GENDER FLUX',         desc: 'No consensus on inclusive forms' },
  { match: 'genderagreement',        name: 'GENDER AGREEMENT',    desc: 'Every word must agree in gender' },
  { match: 'orthographydebate',      name: 'ORTHOGRAPHY WARS',    desc: 'Competing writing standards' },
  { match: 'diacriticomission',      name: 'GHOST MARKS',         desc: 'Digital text drops critical marks' },
  { match: 'katakanaloanword',       name: 'KATAKANA LAYER',      desc: 'Foreign words in angular script' },
  { match: 'spacingrule',            name: 'SPACING RULES',       desc: 'Complex word-spacing conventions' },
  { match: 'neologism',              name: 'NEOLOGISM GAP',       desc: 'No words for modern concepts' },
  { match: 'varietymismatch',        name: 'VARIETY MISMATCH',    desc: 'FST and corpora cover different dialects' },
  { match: 'extremelylimited',       name: 'DATA DESERT',         desc: 'Almost no digital text exists' },
  { match: 'limiteddigital',         name: 'DATA DESERT',         desc: 'Almost no digital text exists' },
  { match: 'particlesystem',         name: 'PARTICLE SYSTEM',     desc: 'Tiny words encode big meaning' },
  { match: 'culturalembedding',      name: 'CULTURAL DEPTH',      desc: 'Concepts resist simple translation' },
  { match: 'msadialect',             name: 'DIGLOSSIA',           desc: 'Written and spoken forms diverge' },
  { match: 'diacritics',             name: 'DIACRITICAL',         desc: 'Marks change meaning entirely' },
  { match: 'speechlevelconsist',     name: 'LEVEL LOCK',          desc: 'Mixing speech levels = incoherent' },
  { match: 'tvconsistency',          name: 'T-V LOCK',            desc: 'Mixing formal/informal = catastrophic' },
  { match: 'umlaut',                 name: 'UMLAUT SYSTEM',       desc: 'Dots above are essential phonemes' },
  { match: 'nouncapital',            name: 'NOUN CAPS',           desc: 'All nouns are capitalized' },
  { match: 'sovwordorder',           name: 'SOV ORDER',           desc: 'Verb always comes last' },
  { match: 'agglutinativeparticle',  name: 'PARTICLE GLUE',       desc: 'Grammar particles attach to nouns' },
  { match: 'dualnumbersystem',       name: 'DUAL NUMBERS',        desc: 'Two number systems in parallel' },
];

const FORMALITY_ABILITIES = {
  'keigo':         { name: 'KEIGO SYSTEM',    desc: 'Three-layer honorific register' },
  'speech-levels': { name: 'SPEECH LEVELS',   desc: 'Seven politeness tiers' },
  'T-V':           { name: 'T-V DISTINCTION', desc: 'Formal vs informal pronouns' },
};

function extractSpecialAbilities(card) {
  const abilities = [];
  const seen = new Set();
  const challenges = card.linguisticChallenges || {};
  for (const challengeKey of Object.keys(challenges)) {
    const keyLower = challengeKey.toLowerCase();
    for (const mapping of ABILITY_MAP) {
      if (keyLower.includes(mapping.match) && !seen.has(mapping.name)) {
        abilities.push({ id: mapping.match, name: mapping.name, description: mapping.desc });
        seen.add(mapping.name);
        break;
      }
    }
  }
  const formalityAbility = FORMALITY_ABILITIES[card.formality?.system];
  if (formalityAbility && !seen.has(formalityAbility.name)) {
    abilities.push({ id: card.formality.system, name: formalityAbility.name, description: formalityAbility.desc });
  }
  return abilities;
}

// ---------------------------------------------------------------------------
// FACT ASSEMBLY — Convert database facts into card display structures
//
// Each function takes an array of facts for one domain and returns
// a structured object for the card. Every value carries its source.
// ---------------------------------------------------------------------------

/**
 * Extract vocabulary samples from lexical facts.
 *
 * Source priority: native orthography and IPA sources first, ASJP last.
 *
 * Why ASJP is last: ASJP uses ASJPcode — a phonetic encoding for
 * computational comparison where e.g., 'E'=ɛ, '7'=ʔ, '3'=ə. The string
 * "E73" (which means /ɛʔə/) is NOT readable by end users and should only
 * be shown when no other lexical source exists for a language.
 *
 * All other lexical databases (IDS, NorthEuraLex, ABVD, TuLeD, WOLD, etc.)
 * store forms in native orthography, practical transcription, or IPA — all
 * of which are display-ready.
 *
 * Returns up to 12 items with concept → form mapping, each tagged with
 * a displayType so the UI can show appropriate labels.
 */
function assembleVocabulary(facts) {
  const lexical = facts.filter(f => f.domain === 'lexical');
  if (lexical.length === 0) return null;

  // Group by source to know what we have
  const bySrc = {};
  for (const f of lexical) {
    if (!bySrc[f.source]) bySrc[f.source] = [];
    bySrc[f.source].push(f);
  }

  // Priority order: display-ready sources first, ASJP dead last.
  // These are the major lexical databases that use native orthography/IPA:
  const preferredSources = [
    'ids',                    // Intercontinental Dictionary Series — native orthography
    'northeuralex',           // NorthEuraLex — IPA transcription
    'abvd',                   // Austronesian Basic Vocabulary Database — practical transcription
    'abvdoceanic',            // ABVD Oceanic subset
    'abvdphilippines',        // ABVD Philippines subset
    'tuled',                  // Tupían Lexical Database — IPA
    'wold',                   // World Loanword Database — native orthography
    'uralex',                 // Uralic Lexical Database — IPA
    'bowernpny',              // Pama-Nyungan cognates — IPA
    'huntergatherer',         // Hunter-Gatherer vocabulary — practical transcription
    'crossandean',            // Cross-Andean — practical transcription
    'acd',                    // Austronesian Comparative Dictionary
    'numeralbank',            // NumeralBank — practical transcription
    'transnewguineaorg',      // Trans-New Guinea — practical transcription
    'grollemundbantu',        // Bantu cognates
    'diacl',                  // DIACL — historical forms
    'iecor',                  // IE-CoR (Indo-European Cognate Relationships)
    'vanuatuvoices',          // Vanuatu Voices
    'papuanvoices',           // Papuan Voices
    'amazonianvoices',        // Amazonian Voices
    'datsemshift',            // DatSemShift — semantic shift data
    'kraftchadic',            // Chadic comparative
    'hubercolumbian',         // Columbian comparative
    'marrisonnaga',           // Naga comparative
    'chaconcolumbian',        // Chacón Columbian
    'galuciotupi',            // Galúcio Tupian — IPA
    'lsi',                    // Linguistic Survey of India
    'smithborneo',            // Borneo comparative
    'suntb',                  // SunTB
    'walkerarawakan',         // Arawakan comparative
    'chacolanguages',         // Chaco languages
  ];

  // Collect all non-ASJP sources not already in the preferred list,
  // so we never miss a regional database we didn't hardcode
  const allNonAsjpSources = Object.keys(bySrc).filter(s => s !== 'asjp');
  const catchAllSources = allNonAsjpSources.filter(s => !preferredSources.includes(s));

  // Final source order: preferred first, then any unlisted non-ASJP, then ASJP last
  const sourceOrder = [...preferredSources, ...catchAllSources, 'asjp'];

  const items = [];
  const seenConcepts = new Set();

  for (const src of sourceOrder) {
    if (!bySrc[src]) continue;
    const isAsjp = src === 'asjp';

    for (const f of bySrc[src]) {
      // property is the concept (e.g., "*water", "WATER", "hand", "ACAI PALM")
      // value is the word form
      const concept = f.property
        .replace(/^\*/, '')           // Remove ASJP asterisk prefix
        .replace(/_/g, ' ')           // Normalize underscores
        .toLowerCase()
        .trim();

      if (seenConcepts.has(concept) || !concept) continue;
      seenConcepts.add(concept);

      // Determine display type for the UI to render appropriate labels:
      // - 'native': native orthography or practical transcription (most sources)
      // - 'ipa': IPA transcription (NorthEuraLex, TuLeD, UraLex, etc.)
      // - 'asjp-phonetic': raw ASJP encoding — NOT display-ready, needs a label
      const ipaSources = new Set([
        'northeuralex', 'tuled', 'uralex', 'bowernpny', 'galuciotupi',
        'uclaphoneticslabarchive',
      ]);
      let displayType = 'native';
      if (isAsjp) {
        displayType = 'asjp-phonetic';
      } else if (ipaSources.has(src)) {
        displayType = 'ipa';
      }

      items.push({
        concept,
        form: f.value,
        source: f.source,
        sourceUrl: f.source_url || null,
        displayType,
      });

    }
  }

  // Track whether this language's vocabulary is ASJP-only (for UI warnings)
  const nonAsjpItemCount = items.filter(i => i.displayType !== 'asjp-phonetic').length;

  return items.length > 0 ? {
    items,
    totalFacts: lexical.length,
    sources: [...new Set(lexical.map(f => f.source))],
    asjpOnly: nonAsjpItemCount === 0 && items.length > 0,
  } : null;
}

/**
 * Extract typological features from typology facts.
 * Groups by source and picks the most interesting features for display.
 */
function assembleTypology(facts) {
  const typology = facts.filter(f => f.domain === 'typology');
  if (typology.length === 0) return null;

  // Group by source
  const bySrc = {};
  for (const f of typology) {
    if (!bySrc[f.source]) bySrc[f.source] = { count: 0, features: [] };
    bySrc[f.source].count++;
    bySrc[f.source].features.push({
      property: f.property,
      value: f.value,
      valueType: f.value_type,
      confidence: f.confidence,
    });
  }

  // CURATE — keep only LINGUISTIC typology we can explain + cite (WALS,
  // Grambank, APiCS, champollion-derived). The `typology` DB domain is polluted
  // with D-PLACE ethnography, AutoTyp raw stats, and body-part vocab that are
  // mis-tagged domain='typology' and have no explainer (dead info buttons).
  // Mirrors the curation in mt-eval-arena/scripts/build-trading-card-data.mjs
  // (the prod build) so the two artifacts agree.
  const EXPLAINED_TYPOLOGY_SOURCE = /^(wals|grambank|apics|champollion)/i;
  const seen = new Set();
  const allFeatures = typology
    .filter(f => EXPLAINED_TYPOLOGY_SOURCE.test(f.source || ''))
    .filter(f => {
      const k = `${f.source}|${f.property}`;
      if (seen.has(k)) return false; // de-dupe repeated (source, property)
      seen.add(k);
      return true;
    })
    .map(f => ({
      property: f.property,
      value: f.value,
      valueType: f.value_type,
      source: f.source,
      sourceUrl: f.source_url || null,
      confidence: f.confidence,
    }));

  if (allFeatures.length === 0) return null;

  return {
    rawFeatureCount: typology.length,
    totalFeatures: allFeatures.length,
    sourceBreakdown: Object.entries(bySrc).map(([src, data]) => ({
      source: src,
      featureCount: data.count,
    })),
    keyFeatures: allFeatures,
  };
}

/**
 * Extract phonological inventory from phonology facts.
 */
function assemblePhonology(facts) {
  const phonology = facts.filter(f => f.domain === 'phonology');
  if (phonology.length === 0) return null;

  const result = {
    totalFacts: phonology.length,
    sources: [...new Set(phonology.map(f => f.source))],
  };

  // Extract specific phonological properties
  for (const f of phonology) {
    if (f.property === 'consonant_count' || f.property === 'consonants') {
      result.consonants = parseInt(f.value) || f.value;
      result.consonantSource = f.source;
    }
    if (f.property === 'vowel_count' || f.property === 'vowels') {
      result.vowels = parseInt(f.value) || f.value;
      result.vowelSource = f.source;
    }
    if (f.property === 'tone_count' || f.property === 'tones') {
      result.tones = parseInt(f.value) || f.value;
      result.toneSource = f.source;
    }
    if (f.property === 'total_phonemes' || f.property === 'totalPhonemes') {
      result.totalPhonemes = parseInt(f.value) || f.value;
    }
    if (f.property === 'isTonal') {
      result.isTonal = f.value === 'true' || f.value === '1';
    }
  }

  return result;
}

/**
 * Extract colexification data from CLICS³ facts.
 * Colexification = same word form used for multiple concepts.
 */
function assembleColexification(facts) {
  const colex = facts.filter(f => f.source === 'clics3');
  if (colex.length === 0) return null;

  const items = colex.map(f => ({
    property: f.property,
    value: f.value,
    source: f.source,
    sourceUrl: f.source_url,
  }));

  return {
    items,
    totalFacts: colex.length,
  };
}

/**
 * Extract ethnographic/cultural context from D-PLACE and similar sources.
 */
function assembleCultural(facts) {
  const cultural = facts.filter(f => f.domain === 'cultural');
  if (cultural.length === 0) return null;

  const items = cultural.map(f => ({
    property: f.property.replace(/_/g, ' '),
    value: f.value,
    source: f.source,
    sourceUrl: f.source_url,
  }));

  return {
    items,
    totalFacts: cultural.length,
    sources: [...new Set(cultural.map(f => f.source))],
  };
}

/**
 * Assemble data provenance summary — how many facts from how many sources,
 * plus any unresolved conflicts.
 */
function assembleProvenance(facts, conflicts) {
  const sourceMap = {};
  for (const f of facts) {
    if (!sourceMap[f.source]) sourceMap[f.source] = { count: 0, url: f.source_url };
    sourceMap[f.source].count++;
  }

  return {
    totalFacts: facts.length,
    sources: Object.entries(sourceMap)
      .map(([name, data]) => ({ name, factCount: data.count, url: data.url }))
      .sort((a, b) => b.factCount - a.factCount),
    unresolvedConflicts: conflicts.length,
    conflicts: conflicts.map(c => ({
      property: c.property,
      valueA: c.value_a,
      sourceA: c.source_a,
      valueB: c.value_b,
      sourceB: c.source_b,
    })),
  };
}

/**
 * Assemble external links — clickable badges for the modal header.
 * Generates URLs from existing identifiers (code, glottocode) and DB facts.
 */
function assembleExternalLinks(code, glottocode, facts) {
  const links = [];

  // Glottolog — primary linguistic reference
  if (glottocode) {
    links.push({ name: 'Glottolog', url: `https://glottolog.org/resource/languoid/id/${glottocode}`, icon: '📚' });
  }

  // WALS — check if we have WALS data in facts
  const hasWals = facts.some(f => f.source === 'wals' || f.source?.startsWith('wals'));
  if (hasWals) {
    links.push({ name: 'WALS', url: `https://wals.info/languoid/lect/wals_code_${code}`, icon: '🗺️' });
  }

  // Ethnologue — always linkable by ISO code
  links.push({ name: 'Ethnologue', url: `https://www.ethnologue.com/language/${code}`, icon: '🌐' });

  // Tatoeba — check if we have Tatoeba data in facts
  const hasTatoeba = facts.some(f => f.source === 'tatoeba' || f.property === 'tatoebaCount');
  if (hasTatoeba) {
    links.push({ name: 'Tatoeba', url: `https://tatoeba.org/en/sentences/search?from=${code}`, icon: '💬' });
  }

  // OLAC — always linkable by ISO code
  links.push({ name: 'OLAC', url: `http://www.language-archives.org/language/${code}`, icon: '🏛️' });

  // PHOIBLE — check if we have PHOIBLE data
  const hasPhoible = facts.some(f => f.source && f.source.toLowerCase().includes('phoible'));
  if (hasPhoible) {
    links.push({ name: 'PHOIBLE', url: `https://phoible.org/languages/${code}`, icon: '🔊' });
  }

  // Grambank — check if we have Grambank data and a glottocode
  const hasGrambank = facts.some(f => f.source && f.source.toLowerCase().includes('grambank'));
  if (hasGrambank && glottocode) {
    links.push({ name: 'Grambank', url: `https://grambank.clld.org/languages/${glottocode}`, icon: '🧬' });
  }

  return links;
}

/**
 * Assemble per-API support status from DB facts.
 * Returns an array of { id, name, supported } objects.
 */
function assembleApiSupport(facts) {
  const apiDefs = [
    { id: 'googleTranslate',     name: 'Google Translate' },
    { id: 'deepl',               name: 'DeepL' },
    { id: 'microsoftTranslator', name: 'Microsoft Translator' },
    { id: 'libreTranslate',      name: 'LibreTranslate' },
    { id: 'nllb',                name: 'NLLB (Meta)' },
    { id: 'llm',                 name: 'LLM (GPT/Gemini)' },
  ];

  return apiDefs.map(api => {
    const fact = facts.find(f => f.property === api.id && (f.domain === 'corpus' || f.domain === 'identity'));
    const supported = fact && (fact.value === 'true' || fact.value === '1' || safeParse(fact.value)?.supported);
    return { id: api.id, name: api.name, supported: !!supported };
  });
}

// ---------------------------------------------------------------------------
// MAIN BUILD LOGIC
// ---------------------------------------------------------------------------

function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   build-trading-card-data.mjs — SQLite → Cards    ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log();

  const db = openDatabase();
  const dbStats = db.stats();
  console.log(`Database: ${dbStats.languages} languages, ${dbStats.facts.toLocaleString()} facts, ${dbStats.unresolvedConflicts} unresolved conflicts`);
  console.log();

  // Prepare conflict query — batch all conflicts for efficiency
  const allConflictsStmt = db._db.prepare(`
    SELECT c.language_code, c.property,
           fa.source as source_a, fa.value as value_a,
           fb.source as source_b, fb.value as value_b
    FROM conflicts c
    JOIN facts fa ON c.fact_a_id = fa.id
    JOIN facts fb ON c.fact_b_id = fb.id
    WHERE c.resolution = 'unresolved'
    ORDER BY c.language_code
  `);
  const allConflicts = allConflictsStmt.all();
  const conflictsByLang = {};
  for (const c of allConflicts) {
    if (!conflictsByLang[c.language_code]) conflictsByLang[c.language_code] = [];
    conflictsByLang[c.language_code].push(c);
  }

  // Get all languages from the database
  let allLanguages = db.getAllLanguages();
  if (singleLang) {
    allLanguages = allLanguages.filter(l => l.code === singleLang);
    if (allLanguages.length === 0) {
      console.error(`Language '${singleLang}' not found in database.`);
      process.exit(1);
    }
  }

  // Filter out conlangs and entries without names
  allLanguages = allLanguages.filter(l => {
    if (!l.code || !l.name) return false;
    if (l.code.startsWith('x-') || l.code === 'tlh') return false;
    return true;
  });

  console.log(`Processing ${allLanguages.length} languages...`);



  // Build index and detail data
  const indexEntries = [];
  const detailBuckets = {}; // Keyed by first letter of code

  let processed = 0;
  const startTime = Date.now();

  for (const lang of allLanguages) {
    const code = lang.code;

    const facts = db.getFactsForLanguage(code);
    const conflicts = conflictsByLang[code] || [];
    const nearest = db.getNearestLanguages(code);
    const naturalPair = db.getNaturalPair(code);

    // Build card EXCLUSIVELY from database — no v1 fallback
    const mergedCard = {
      // Identity — from languages table (authoritative)
      code: lang.code,
      name: lang.name,
      iso639_3: lang.iso639_3,
      glottocode: lang.glottocode,
      bcp47: lang.bcp47,
      macroarea: lang.macroarea,
      isIsolate: lang.is_isolate === 1,
      coordinates: (lang.lat != null && lang.lng != null)
        ? { lat: lang.lat, lng: lang.lng }
        : null,
      countries: lang.countries ? JSON.parse(lang.countries) : [],
      classification: {
        family: lang.family || 'Unknown',
        genus: lang.genus || null,
        ancestry: lang.ancestry ? JSON.parse(lang.ancestry) : [],
      },

      // Orthography — from facts table
      nativeName: findFact(facts, 'identity', 'nativeName')?.value || null,
      script: findFact(facts, 'orthography', 'script')?.value || null,
      scripts: facts.filter(f => f.property === 'script' && f.domain === 'orthography')
        .map(f => ({ name: f.value, source: f.source })),
      scriptUnicodeName: findFact(facts, 'orthography', 'scriptUnicodeName')?.value || null,
      dir: findFact(facts, 'orthography', 'direction')?.value || 'ltr',
      orthographicStatus: findFact(facts, 'orthography', 'orthographicStatus')?.value || null,

      // Vitality — computed in groundedStats, not stored on card
      vitality: null,
      speakerEstimates: [],

      // Linguistic features — empty until properly ingested from upstream
      linguisticChallenges: {},
      contactInfluences: [],
      formality: null,
      registers: {},
      gender: null,
      rules: {},
      culturalAphorism: null,
      dialectCount: (() => {
        const f = findFact(facts, 'classification', 'dialectCount');
        return f ? (parseInt(f.value, 10) || null) : null;
      })(),

      // NLP resources — empty until properly ingested from upstream
      methodSupport: {},
      resources: {},
      evalDatasets: [],
      pipelineReadiness: {},
      digitalPresence: {},
      corpusAvailability: {},
      databaseCoverage: {},
      keyboardSupport: null,
      omt1600: null,

      // Regions — derive from countries in languages table
      regions: lang.countries
        ? JSON.parse(lang.countries).map(c => ({ country: c }))
        : [],

      // Notes
      notes: null,
    };

    // Pre-compute grounded stats and rarity
    const groundedStats = computeGroundedStats(code, facts);
    const rarity = computeRarityTier(groundedStats.challengeRating, groundedStats.digitalToolkit, groundedStats.vitality);
    const speakers = formatSpeakerCount(facts);
    const pipeline = getPipelineReadiness(mergedCard);
    const abilities = extractSpecialAbilities(mergedCard);

    // ----- INDEX ENTRY (compact, for the grid) -----
    // Only contains what the card front needs. Heavy fields go in detail.
    indexEntries.push({
      // Identity
      code: mergedCard.code,
      name: mergedCard.name,
      nativeName: mergedCard.nativeName,
      family: mergedCard.classification.family,
      genus: mergedCard.classification.genus,
      macroarea: mergedCard.macroarea,
      isIsolate: mergedCard.isIsolate,

      // Display strings (pre-formatted at build time)
      speakers,
      pipelineLabel: pipeline.label,
      pipelineEmoji: pipeline.emoji,

      // Pre-computed grounded stats (browser does zero computation)
      stats: groundedStats.challengeRating,
      digitalToolkit: groundedStats.digitalToolkit,
      vitalityBadge: groundedStats.vitality,
      rarity,
      abilities,

      // Sort keys
      speakerCount: (() => { const f = facts.find(f => f.property === 'speakerCount'); return f ? (parseInt(f.value, 10) || 0) : 0; })(),
      rarityOrder: { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 }[rarity.tier] || 0,

      // Card front display data (minimal)
      script: mergedCard.script,
      scripts: mergedCard.scripts,
      dir: mergedCard.dir,
      vitalityLevel: null,
      vitalityTrend: null,
      culturalAphorism: null,
      dialectCount: mergedCard.dialectCount,

      // Data richness flags (so the UI knows what's available)
      factCount: facts.length,
      sourceCount: new Set(facts.map(f => f.source)).size,
      hasVocabulary: facts.some(f => f.domain === 'lexical'),
      hasTypology: facts.some(f => f.domain === 'typology'),
      hasPhonology: facts.some(f => f.domain === 'phonology'),
      hasNearest: nearest.length > 0,
      hasNaturalPair: !!naturalPair,
      hasCultural: facts.some(f => f.domain === 'cultural'),
      hasConflicts: conflicts.length > 0,

      // Card back display fields (Marvel-style data card)
      narrative: null,
      scriptName: mergedCard.scripts?.[0]?.name || mergedCard.script || null,
      regions: (mergedCard.regions || []).map(r => r.province || r.country).filter(Boolean),
      ancestry: mergedCard.classification?.ancestry || [],
      glottocode: mergedCard.glottocode || null,
    });

    // ----- DETAIL ENTRY (rich, loaded on-demand when modal opens) -----
    // Store detail data per-language (not in alphabetical buckets)
    detailBuckets[code] = {
      // Detail fields for the expanded modal
      // Sourced exclusively from the SQLite database

      // Endonym — explicitly null (never absent) when no attested native
      // name exists, so the detail UI can render an "endonym unknown —
      // tell us" affordance instead of silently omitting the field.
      // nativeNameStatus disambiguates for the renderer:
      //   'attested' — nativeName holds a sourced endonym
      //   'unknown'  — no citable endonym in any harvested/curated source
      //                (6k+ cards; see docs/CARD_DATA_QUALITY_AUDIT.md § 3)
      nativeName: mergedCard.nativeName ?? null,
      nativeNameStatus: mergedCard.nativeName ? 'attested' : 'unknown',

      classification: mergedCard.classification,
      vitality: mergedCard.vitality,
      speakerEstimates: mergedCard.speakerEstimates,
      linguisticChallenges: mergedCard.linguisticChallenges,
      contactInfluences: mergedCard.contactInfluences,
      formality: mergedCard.formality,
      methodSupport: mergedCard.methodSupport,
      resources: mergedCard.resources,
      evalDatasets: mergedCard.evalDatasets,
      pipelineReadiness: mergedCard.pipelineReadiness,
      digitalPresence: mergedCard.digitalPresence,
      corpusAvailability: mergedCard.corpusAvailability,
      databaseCoverage: mergedCard.databaseCoverage,
      omt1600: mergedCard.omt1600,
      regions: mergedCard.regions,
      countries: mergedCard.countries,
      coordinates: mergedCard.coordinates,
      alternateNames: [],
      orthographicStatus: mergedCard.orthographicStatus,
      notes: mergedCard.notes,

      // Narrative — not yet in DB, will be null until sourced from authoritative reference
      narrative: null,

      // External links — derived from facts and identifiers
      externalLinks: assembleExternalLinks(code, mergedCard.glottocode, facts),

      // Encyclopedic resources — not yet in DB
      encyclopedicResources: null,

      // Per-API support status — derived from facts
      apiSupport: assembleApiSupport(facts),

      // Dialect information — not yet in DB
      dialectInfo: null,

      // Glottocode for deep linking
      glottocode: mergedCard.glottocode || null,

      // Assembled from SQLite facts — every item has source citation
      vocabulary: assembleVocabulary(facts),
      typology: assembleTypology(facts),
      phonology: assemblePhonology(facts),
      colexification: assembleColexification(facts),
      cultural: assembleCultural(facts),

      // Relational data from dedicated tables
      nearestLanguages: nearest.map(n => ({
        code: n.neighbor_code,
        name: n.neighbor_name,
        relationship: n.relationship,
        sharedDepth: n.shared_depth,
        distanceKm: n.distance_km,
      })),
      naturalPair: naturalPair ? {
        code: naturalPair.pair_code,
        name: naturalPair.pair_name,
        rationale: naturalPair.rationale,
        source: naturalPair.source,
      } : null,

      // Grounded stat sources — full transparency on how stats were computed
      statSources: groundedStats.challengeRating.sources,
      statTooltip: groundedStats.challengeRating.tooltip,

      // Data provenance — full transparency
      provenance: assembleProvenance(facts, conflicts),
    };

    processed++;
    if (processed % 1000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ${processed}/${allLanguages.length} processed (${elapsed}s)`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAssembled ${processed} languages in ${elapsed}s`);

  // ----- WRITE OUTPUT FILES -----

  if (dryRun) {
    console.log('\n[DRY RUN] Would write:');
    console.log(`  tc-index.json — ${indexEntries.length} entries, ~${(JSON.stringify(indexEntries).length / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  tc-lang/ — ${Object.keys(detailBuckets).length} language files`);
  } else {
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write index
    const indexPath = join(OUTPUT_DIR, 'tc-index.json');
    const indexJson = JSON.stringify(indexEntries);
    writeFileSync(indexPath, indexJson);
    console.log(`\n✅ tc-index.json — ${indexEntries.length} entries, ${(indexJson.length / 1024 / 1024).toFixed(1)}MB`);

    // Write per-language detail files
    const langDir = join(OUTPUT_DIR, 'tc-lang');
    if (!existsSync(langDir)) {
      mkdirSync(langDir, { recursive: true });
    }

    let totalDetailBytes = 0;
    for (const [code, data] of Object.entries(detailBuckets)) {
      const langPath = join(langDir, `${code}.json`);
      const langJson = JSON.stringify(data);
      writeFileSync(langPath, langJson);
      totalDetailBytes += langJson.length;
    }
    console.log(`✅ tc-lang/ — ${Object.keys(detailBuckets).length} language files, ${(totalDetailBytes / 1024 / 1024).toFixed(1)}MB total`);
  }

  // ----- SUMMARY -----

  const rarityDist = {};
  for (const entry of indexEntries) {
    rarityDist[entry.rarity.tier] = (rarityDist[entry.rarity.tier] || 0) + 1;
  }

  console.log('\n── Rarity Distribution ──');
  for (const [tier, count] of Object.entries(rarityDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${RARITY_TIERS[tier]?.emoji || '?'} ${tier}: ${count}`);
  }

  // Challenge Rating distribution — shows how the grounded scoring spreads
  const crScores = indexEntries.map(e => e.stats.score);
  const crMin = Math.min(...crScores);
  const crMax = Math.max(...crScores);
  const crAvg = Math.round(crScores.reduce((a, b) => a + b, 0) / crScores.length);
  const crBuckets = { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 };
  for (const s of crScores) {
    if (s >= 80) crBuckets['80-100']++;
    else if (s >= 60) crBuckets['60-79']++;
    else if (s >= 40) crBuckets['40-59']++;
    else if (s >= 20) crBuckets['20-39']++;
    else crBuckets['0-19']++;
  }

  console.log('\n── Challenge Rating Distribution ──');
  console.log(`  Range: ${crMin}–${crMax}, Average: ${crAvg}`);
  for (const [bucket, count] of Object.entries(crBuckets)) {
    const bar = '█'.repeat(Math.round(count / Math.max(...Object.values(crBuckets)) * 20));
    console.log(`  ${bucket}: ${count} ${bar}`);
  }

  // Digital Toolkit coverage
  const toolkitCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const entry of indexEntries) {
    toolkitCounts[entry.digitalToolkit.count] = (toolkitCounts[entry.digitalToolkit.count] || 0) + 1;
  }
  console.log('\n── Digital Toolkit (pip counts) ──');
  for (let i = 0; i <= 5; i++) {
    console.log(`  ${i}/5 pips: ${toolkitCounts[i]} languages`);
  }

  // Vitality badge distribution
  const vitalityDist = {};
  for (const entry of indexEntries) {
    const lvl = entry.vitalityBadge.level;
    vitalityDist[lvl] = (vitalityDist[lvl] || 0) + 1;
  }
  console.log('\n── Vitality Badge Distribution ──');
  for (const [level, count] of Object.entries(vitalityDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${level}: ${count}`);
  }

  const withVocab = indexEntries.filter(e => e.hasVocabulary).length;
  const withTypology = indexEntries.filter(e => e.hasTypology).length;
  const withNearest = indexEntries.filter(e => e.hasNearest).length;
  const withNatPair = indexEntries.filter(e => e.hasNaturalPair).length;
  const withCultural = indexEntries.filter(e => e.hasCultural).length;

  console.log('\n── Data Coverage ──');
  console.log(`  Vocabulary samples: ${withVocab}/${processed} languages`);
  console.log(`  Typological features: ${withTypology}/${processed} languages`);
  console.log(`  Nearest languages: ${withNearest}/${processed} languages`);
  console.log(`  Natural pairs: ${withNatPair}/${processed} languages`);
  console.log(`  Cultural/ethnographic: ${withCultural}/${processed} languages`);

  db.close();
  console.log('\nDone.');
}

main();
