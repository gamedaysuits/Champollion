#!/usr/bin/env node

/**
 * compute-derived-scores.mjs
 * ────────────────────────────────────────────────────────────────
 * Computes two derived metrics for EVERY language in the
 * Champollion facts database:
 *
 *   1. digitalReadiness  (float 0–1)
 *      A weighted composite score measuring how "digitally ready"
 *      a language is for NLP/MT work, based on existing facts.
 *
 *   2. orthographicStatus  (categorical)
 *      Classifies a language's writing system maturity:
 *        standardized | developing | oral_tradition | unknown
 *
 * Both scores are stored as facts in domain='computed' with
 * source='champollion-derived', enabling full provenance tracking.
 *
 * Design decisions:
 *   - Uses the facts DB directly (not card JSON files) so that
 *     scores always reflect the latest enrichment state.
 *   - INSERT OR REPLACE semantics: re-running is idempotent.
 *   - Batches all writes in a single transaction for performance
 *     across ~8000 languages.
 *   - Confidence is 'cross-validated' because each score is
 *     derived from multiple independent upstream facts.
 *
 * Usage:
 *   node scripts/compute-derived-scores.mjs              # all languages
 *   node scripts/compute-derived-scores.mjs --dry-run    # preview only
 *   node scripts/compute-derived-scores.mjs --lang crk   # single language
 * ────────────────────────────────────────────────────────────────
 */

import { openDatabase } from './db.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const CREATED_BY = 'compute-derived-scores.mjs';
const SOURCE = 'champollion-derived';
const RETRIEVED_AT = new Date().toISOString();

// Valid confidence level — 'cross-validated' because we synthesize
// multiple independent facts into a single derived value
const CONFIDENCE = 'cross-validated';


// ═══════════════════════════════════════════════════════════════
//  DIGITAL READINESS SCORING
//
//  Weighted 0–1 score. Each component is binary (present/absent)
//  with a fixed weight. The weights reflect relative importance
//  for NLP pipeline viability:
//    - MT engines are highest because they enable immediate use
//    - Corpora (OPUS, UD) come next — they enable model training
//    - Speech data and keyboards are supporting infrastructure
//    - Wikipedia/Wiktionary and Grambank are auxiliary signals
//
//  The weights sum to exactly 1.0 (with two MT engines capped
//  at 0.3 total, even if more exist).
// ═══════════════════════════════════════════════════════════════

/**
 * MT engine weight allocation:
 *   0.15 per engine, capped at 0.3 total (so 2+ engines = max)
 *
 * This prevents a language with 5 MT engines from dominating
 * the score solely on translation availability.
 */
const MT_ENGINE_PROPERTIES = [
  'googleTranslate',
  'deepl',
  'microsoftTranslator',
  'nllb',
  'libreTranslate',
];
const MT_WEIGHT_PER_ENGINE = 0.15;
const MT_WEIGHT_CAP = 0.30;

/**
 * Static scoring components (non-MT).
 * Each maps a fact lookup to a fixed weight contribution.
 */
const STATIC_COMPONENTS = [
  // Parallel corpora — essential for training translation models
  { domain: 'corpus', property: 'opusAvailable',       weight: 0.10, label: 'OPUS parallel corpora' },

  // Treebanks — required for syntactic parsing and downstream NLP
  { domain: 'corpus', property: 'udAvailable',          weight: 0.10, label: 'Universal Dependencies' },

  // Speech data — enables ASR and TTS pipelines
  { domain: 'corpus', property: 'hasCommonVoiceData',   weight: 0.10, label: 'Common Voice speech data' },

  // Input method — indicates script standardization + accessibility
  { domain: 'corpus', property: 'keyboardSupport',      weight: 0.10, label: 'Keyboard support' },

  // Example sentences — useful for few-shot and evaluation
  { domain: 'corpus', property: 'tatoebaCount',         weight: 0.05, label: 'Tatoeba sentences' },

  // Script existence — minimal but foundational signal
  { domain: 'orthography', property: 'script',          weight: 0.05, label: 'Script defined' },

  // Online presence — proxy for digital content availability
  { domain: 'corpus', property: 'hasWikipedia',         weight: 0.05, label: 'Wikipedia' },
  { domain: 'corpus', property: 'hasWiktionary',        weight: 0.05, label: 'Wiktionary' },

  // Typological documentation — indicates linguistic research depth
  { domain: 'typology', property: 'featuresCoverage',   weight: 0.10, label: 'Grambank features' },
];


/**
 * Build a lookup map of all facts for a language, keyed by
 * `domain:property` for O(1) access during scoring.
 *
 * Why a map and not repeated DB queries? Because with ~8000
 * languages × ~10 lookups each, that would be ~80k queries.
 * Batch-loading all facts for each language is dramatically
 * faster with SQLite.
 *
 * @param {Array} facts — result of db.getFactsForLanguage(code)
 * @returns {Map<string, object>} keyed by 'domain:property'
 */
function buildFactMap(facts) {
  const map = new Map();
  for (const fact of facts) {
    const key = `${fact.domain}:${fact.property}`;
    // If multiple facts exist for the same domain:property (from
    // different sources), keep the first one (highest confidence
    // per the query's ORDER BY)
    if (!map.has(key)) {
      map.set(key, fact);
    }
  }
  return map;
}


/**
 * Determines whether a fact's value represents a "truthy" signal.
 *
 * Handles the heterogeneous value types in the DB:
 *   - boolean: 'true' → true, 'false' → false
 *   - integer: > 0 → true (e.g., tatoebaCount, keyboardSupport)
 *   - float:   > 0 → true (e.g., featuresCoverage)
 *   - json:    always truthy if present (e.g., udAvailable = {"treebanks":14})
 *   - string:  non-empty → true (e.g., script = 'Latn')
 */
function isTruthy(fact) {
  if (!fact) return false;

  const { value, value_type: vt } = fact;

  if (vt === 'boolean') return value === 'true';
  if (vt === 'integer') return parseInt(value, 10) > 0;
  if (vt === 'float')   return parseFloat(value) > 0;
  if (vt === 'json')    return value !== null && value !== '' && value !== '{}' && value !== '[]';
  if (vt === 'string')  return value !== null && value !== '';

  // Unknown type — assume false to avoid silent false positives
  return false;
}


/**
 * Computes the digitalReadiness score for a single language.
 *
 * @param {Map} factMap — output of buildFactMap()
 * @returns {{ score: number, breakdown: object }}
 */
function computeDigitalReadiness(factMap) {
  const breakdown = {};
  let score = 0;

  // ── MT engines: 0.15 each, capped at 0.30 ──
  let mtScore = 0;
  let mtCount = 0;
  for (const prop of MT_ENGINE_PROPERTIES) {
    const fact = factMap.get(`corpus:${prop}`);
    const supported = isTruthy(fact);
    breakdown[prop] = supported;
    if (supported) {
      mtCount++;
      mtScore += MT_WEIGHT_PER_ENGINE;
    }
  }
  // Apply the cap — prevents MT-heavy skew
  const mtContribution = Math.min(mtScore, MT_WEIGHT_CAP);
  score += mtContribution;
  breakdown._mtEngineCount = mtCount;
  breakdown._mtContribution = mtContribution;

  // ── Static components ──
  for (const component of STATIC_COMPONENTS) {
    const key = `${component.domain}:${component.property}`;
    const fact = factMap.get(key);
    const present = isTruthy(fact);
    breakdown[component.property] = present;
    if (present) {
      score += component.weight;
    }
  }

  // Clamp to [0, 1] to guard against floating-point drift
  score = Math.min(1.0, Math.max(0.0, score));

  // Round to 4 decimal places for clean storage
  score = Math.round(score * 10000) / 10000;

  return { score, breakdown };
}


// ═══════════════════════════════════════════════════════════════
//  ORTHOGRAPHIC STATUS CLASSIFICATION
//
//  Categorical classification based on three signals:
//    1. Does the language have a known script?
//    2. Does it have keyboard support?
//    3. Does it have MT engine support?
//
//  Decision cascade (highest confidence first):
//    standardized  — script + keyboard + at least one MT engine
//                    This means the language has a formalized
//                    writing system with digital infrastructure.
//    developing    — script exists but digital tools are limited
//                    (no keyboard, or no MT support)
//    oral_tradition — no script recorded in any source
//    unknown       — insufficient data to classify
// ═══════════════════════════════════════════════════════════════

function classifyOrthographicStatus(factMap) {
  const hasScript = isTruthy(factMap.get('orthography:script'));
  const hasKeyboard = isTruthy(factMap.get('corpus:keyboardSupport'));

  // Check for at least one MT engine
  let hasMT = false;
  for (const prop of MT_ENGINE_PROPERTIES) {
    if (isTruthy(factMap.get(`corpus:${prop}`))) {
      hasMT = true;
      break;
    }
  }

  // ── Decision cascade ──

  // Rule 1: Full digital writing infrastructure
  // Has script + keyboard support + machine translation
  // → The writing system is standardized and digitally integrated
  if (hasScript && hasKeyboard && hasMT) {
    return 'standardized';
  }

  // Rule 2: Script exists but digital tooling is limited
  // Has a script but missing either keyboard or MT support
  // → Writing system is in development or under-resourced
  if (hasScript) {
    return 'developing';
  }

  // Rule 3: No script recorded from any data source
  // Check if we have *any* facts at all for this language.
  // If we have substantial data but no script → oral tradition.
  // If we have almost nothing → insufficient data.
  const totalFacts = factMap.size;

  if (totalFacts >= 3) {
    // We have multiple facts about this language but none
    // assign a script — likely an oral/unwritten language
    return 'oral_tradition';
  }

  // Rule 4: Very few facts — we simply don't know enough
  return 'unknown';
}


// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Compute Derived Scores');
  console.log('  Scores: digitalReadiness (0–1), orthographicStatus');
  console.log('  Target: ' + (SINGLE_LANG || 'ALL languages'));
  console.log('  Mode:   ' + (DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const db = openDatabase();

  // ── Ensure source license is registered ──
  const existingLicense = db.getSourceLicense(SOURCE);
  if (!existingLicense) {
    console.log('  Registering source license for champollion-derived...');
    db.registerSourceLicense({
      source: SOURCE,
      licenseSpdx: 'LicenseRef-Champollion-Derived',
      attribution: 'Champollion Project. Computed metrics derived from multiple upstream sources.',
      allowsRedistribution: true,
      requiresAttribution: true,
      requiresSharealike: false,
      nonCommercialOnly: false,
      notes: 'Computed/derived properties (digitalReadiness, orthographicStatus, etc.).',
    });
    console.log('  ✓ Source license registered.\n');
  } else {
    console.log('  ✓ Source license already registered.\n');
  }

  // ── Load languages ──
  let languages;
  if (SINGLE_LANG) {
    const lang = db.getLanguage(SINGLE_LANG);
    if (!lang) {
      console.error(`  ❌ Language not found: ${SINGLE_LANG}`);
      process.exit(1);
    }
    languages = [lang];
  } else {
    languages = db.getAllLanguages();
  }

  console.log(`  Processing ${languages.length.toLocaleString()} languages...\n`);

  // ── Tracking stats ──
  let totalProcessed = 0;
  let totalFactsWritten = 0;
  let readinessSum = 0;

  const orthoDistribution = {
    standardized: 0,
    developing: 0,
    oral_tradition: 0,
    unknown: 0,
  };

  // Tier distribution for digitalReadiness
  const readinessTiers = {
    'high (0.7–1.0)': 0,
    'moderate (0.3–0.7)': 0,
    'low (0.1–0.3)': 0,
    'minimal (0–0.1)': 0,
  };

  // Top/bottom tracking
  const allResults = [];

  // ── Process all languages in a single transaction ──
  // Wrapping in a transaction is critical for performance:
  // ~16,000 INSERTs (2 per language × ~8000) without a
  // transaction would commit individually → extremely slow.
  const processAll = () => {
    for (const lang of languages) {
      const code = lang.code;
      totalProcessed++;

      // Load all existing facts for this language
      const facts = db.getFactsForLanguage(code);
      const factMap = buildFactMap(facts);

      // ── Compute digitalReadiness ──
      const { score: readinessScore, breakdown } = computeDigitalReadiness(factMap);
      readinessSum += readinessScore;

      // Classify into readiness tier for reporting
      if (readinessScore >= 0.7) readinessTiers['high (0.7–1.0)']++;
      else if (readinessScore >= 0.3) readinessTiers['moderate (0.3–0.7)']++;
      else if (readinessScore >= 0.1) readinessTiers['low (0.1–0.3)']++;
      else readinessTiers['minimal (0–0.1)']++;

      // ── Classify orthographicStatus ──
      const orthoStatus = classifyOrthographicStatus(factMap);
      orthoDistribution[orthoStatus]++;

      // Track for top/bottom reporting
      allResults.push({
        code,
        name: lang.name,
        readiness: readinessScore,
        ortho: orthoStatus,
      });

      // ── Store both facts ──
      if (!DRY_RUN) {
        // Fact 1: digitalReadiness
        db.insertFact({
          languageCode: code,
          domain: 'computed',
          property: 'digitalReadiness',
          value: String(readinessScore),
          valueType: 'float',
          source: SOURCE,
          sourceUrl: null,
          sourceRaw: JSON.stringify(breakdown),
          confidence: CONFIDENCE,
          retrievedAt: RETRIEVED_AT,
          createdBy: CREATED_BY,
          notes: `Weighted composite of ${breakdown._mtEngineCount} MT engines, ` +
                 `OPUS, UD, CommonVoice, keyboard, Tatoeba, script, wiki, Grambank`,
        });

        // Fact 2: orthographicStatus
        db.insertFact({
          languageCode: code,
          domain: 'computed',
          property: 'orthographicStatus',
          value: orthoStatus,
          valueType: 'string',
          source: SOURCE,
          sourceUrl: null,
          sourceRaw: null,
          confidence: CONFIDENCE,
          retrievedAt: RETRIEVED_AT,
          createdBy: CREATED_BY,
          notes: `Derived from script, keyboard, and MT availability`,
        });

        totalFactsWritten += 2;
      }

      // Progress logging every 1000 languages
      if (totalProcessed % 1000 === 0) {
        console.log(`  ... processed ${totalProcessed.toLocaleString()} / ${languages.length.toLocaleString()}`);
      }
    }
  };

  if (DRY_RUN) {
    processAll();
  } else {
    db.transaction(processAll);
  }

  // ── Sort by readiness for reporting ──
  allResults.sort((a, b) => b.readiness - a.readiness);
  const top10 = allResults.slice(0, 10);
  const bottom10 = allResults.slice(-10).reverse();

  const avgReadiness = totalProcessed > 0
    ? (readinessSum / totalProcessed).toFixed(4)
    : '0.0000';

  // ── Report ──
  console.log('\n  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Languages processed:  ${totalProcessed.toLocaleString()}`);
  console.log(`  Facts written:        ${totalFactsWritten.toLocaleString()}`);
  console.log(`  Avg digitalReadiness: ${avgReadiness}`);

  console.log('\n  DIGITAL READINESS DISTRIBUTION:');
  console.log('  ─────────────────────────────────────');
  for (const [tier, count] of Object.entries(readinessTiers)) {
    const pct = totalProcessed > 0
      ? ((count / totalProcessed) * 100).toFixed(1)
      : '0.0';
    const bar = '█'.repeat(Math.round(count / Math.max(1, totalProcessed) * 40));
    console.log(`  ${tier.padEnd(20)} ${String(count).padStart(5)}  (${pct.padStart(5)}%)  ${bar}`);
  }

  console.log('\n  ORTHOGRAPHIC STATUS DISTRIBUTION:');
  console.log('  ─────────────────────────────────────');
  for (const [status, count] of Object.entries(orthoDistribution)) {
    const pct = totalProcessed > 0
      ? ((count / totalProcessed) * 100).toFixed(1)
      : '0.0';
    const bar = '█'.repeat(Math.round(count / Math.max(1, totalProcessed) * 40));
    console.log(`  ${status.padEnd(20)} ${String(count).padStart(5)}  (${pct.padStart(5)}%)  ${bar}`);
  }

  console.log('\n  TOP 10 DIGITAL READINESS:');
  console.log('  ─────────────────────────────────────');
  for (const r of top10) {
    console.log(`  ${r.code.padEnd(6)} ${r.name.padEnd(30)} ${String(r.readiness).padStart(6)}  ${r.ortho}`);
  }

  console.log('\n  BOTTOM 10 DIGITAL READINESS:');
  console.log('  ─────────────────────────────────────');
  for (const r of bottom10) {
    console.log(`  ${r.code.padEnd(6)} ${r.name.padEnd(30)} ${String(r.readiness).padStart(6)}  ${r.ortho}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  // ── Final DB stats ──
  const stats = db.stats();
  console.log(`  DB: ${stats.languages.toLocaleString()} languages, ` +
              `${stats.facts.toLocaleString()} facts, ` +
              `${stats.unresolvedConflicts} unresolved conflicts`);
  console.log('═══════════════════════════════════════════════════════════\n');

  db.close();
}

main();
