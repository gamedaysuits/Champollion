#!/usr/bin/env node

/**
 * derive-pipeline-readiness.mjs
 * ────────────────────────────────────────────────────────────────
 * Computes a `pipelineReadiness` score for each language card based
 * on which NLP-relevant fields are populated. This is a pure
 * derivation — it uses only data already on the card.
 *
 * SCORING (0–100 points):
 *   digitalPresence.commonVoice  → 10 pts  (validatedHours > 0)
 *   digitalPresence.wikipedia    → 10 pts  (has Wikipedia edition)
 *   corpusAvailability.opus      → 15 pts  (present in OPUS)
 *   corpusAvailability.lexibank  →  5 pts  (has Lexibank data)
 *   corpusAvailability.ud        → 15 pts  (has UD treebanks)
 *   keyboardSupport              →  5 pts  (has Keyman keyboards)
 *   resources (not null)         → 10 pts  (has NLP resources)
 *   methodSupport.googleTranslate → 15 pts (Google Translate)
 *   methodSupport.deepl          →  5 pts  (DeepL)
 *   methodSupport.nllb           → 10 pts  (NLLB)
 *
 * TIERS:
 *    0–10:  minimal
 *   11–30:  low
 *   31–50:  moderate
 *   51–75:  good
 *   76–100: strong
 *
 * OVERWRITE BEHAVIOR:
 *   Unlike most enrichment scripts, this ALWAYS overwrites the
 *   existing `pipelineReadiness` field because it's a computed
 *   derivation, not curated data. Re-running after enrichment
 *   updates will produce fresh scores.
 *
 * IDEMPOTENT: Yes. Running multiple times produces identical output
 * for the same input data.
 *
 * Usage:
 *   node scripts/derive-pipeline-readiness.mjs              # all cards
 *   node scripts/derive-pipeline-readiness.mjs --dry-run    # preview
 *   node scripts/derive-pipeline-readiness.mjs --lang crk   # single card
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_LANG = (() => {
  const idx = process.argv.indexOf('--lang');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();


// ─── Scoring configuration ───────────────────────────────────────
//
// Each component maps to a check function and a point value.
// Keeping this as a declarative table makes future adjustments
// and auditing straightforward.

const SCORING_COMPONENTS = [
  {
    key: 'commonVoice',
    points: 10,
    label: 'Common Voice (validated audio)',
    check: (card) => {
      const cv = card.digitalPresence?.commonVoice;
      return cv != null && cv.validatedHours > 0;
    },
  },
  {
    key: 'wikipedia',
    points: 10,
    label: 'Wikipedia edition',
    check: (card) => {
      return card.digitalPresence?.wikipedia != null;
    },
  },
  {
    key: 'opus',
    points: 15,
    label: 'OPUS parallel corpora',
    check: (card) => {
      // corpusAvailability.opus can be `true` (boolean) or a truthy object with details
      const opus = card.corpusAvailability?.opus;
      return opus === true || (opus != null && typeof opus === 'object');
    },
  },
  {
    key: 'lexibank',
    points: 5,
    label: 'Lexibank data',
    check: (card) => {
      const lb = card.corpusAvailability?.lexibank;
      // Present as an object with datasets count, or as `true`
      return lb != null && lb !== false;
    },
  },
  {
    key: 'ud',
    points: 15,
    label: 'Universal Dependencies treebanks',
    check: (card) => {
      const ud = card.corpusAvailability?.ud;
      return ud != null && ud !== false;
    },
  },
  {
    key: 'keyboard',
    points: 5,
    label: 'Keyman keyboard support',
    check: (card) => {
      return card.keyboardSupport != null;
    },
  },
  {
    key: 'resources',
    points: 10,
    label: 'NLP resources',
    check: (card) => {
      return card.resources != null;
    },
  },
  {
    key: 'googleTranslate',
    points: 15,
    label: 'Google Translate support',
    check: (card) => {
      return card.methodSupport?.googleTranslate?.supported === true;
    },
  },
  {
    key: 'deepl',
    points: 5,
    label: 'DeepL support',
    check: (card) => {
      return card.methodSupport?.deepl?.supported === true;
    },
  },
  {
    key: 'nllb',
    points: 10,
    label: 'NLLB support',
    check: (card) => {
      return card.methodSupport?.nllb?.supported === true;
    },
  },
];

// Verify total possible score equals 100 at startup
const MAX_SCORE = SCORING_COMPONENTS.reduce((sum, c) => sum + c.points, 0);
if (MAX_SCORE !== 100) {
  console.error(`FATAL: Scoring components sum to ${MAX_SCORE}, expected 100.`);
  process.exit(1);
}


// ─── Tier classification ──────────────────────────────────────────

function scoreTier(score) {
  if (score <= 10) return 'minimal';
  if (score <= 30) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'good';
  return 'strong';
}


// ─── Compute readiness for a single card ──────────────────────────

function computeReadiness(card) {
  const components = {};
  let score = 0;

  for (const component of SCORING_COMPONENTS) {
    const met = component.check(card);
    components[component.key] = met;
    if (met) score += component.points;
  }

  return {
    score,
    tier: scoreTier(score),
    components,
    source: 'derived',
  };
}


// ─── Main ──────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Pipeline Readiness Derivation');
  console.log('  Computes readiness score from populated NLP fields.');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  if (SINGLE_LANG) console.log(`  Target: ${SINGLE_LANG}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  let cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  if (SINGLE_LANG) {
    const target = `${SINGLE_LANG}.json`;
    if (!cardFiles.includes(target)) {
      console.error(`  ERROR: Card not found: ${target}`);
      process.exit(1);
    }
    cardFiles = [target];
  }

  // ── Tracking stats ──
  let totalProcessed = 0;
  let totalModified = 0;
  let totalSkippedParse = 0;
  let scoreSum = 0;

  // Tier distribution
  const tierCounts = { minimal: 0, low: 0, moderate: 0, good: 0, strong: 0 };

  // Component hit rates (how many cards have each component)
  const componentHits = {};
  for (const c of SCORING_COMPONENTS) componentHits[c.key] = 0;

  // For top/bottom reporting
  const allResults = [];

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      totalSkippedParse++;
      continue;
    }

    totalProcessed++;

    const readiness = computeReadiness(card);
    scoreSum += readiness.score;
    tierCounts[readiness.tier]++;

    // Track component hits for summary
    for (const [key, met] of Object.entries(readiness.components)) {
      if (met) componentHits[key]++;
    }

    allResults.push({
      code: card.code || filename.replace('.json', ''),
      name: card.name || '(unnamed)',
      score: readiness.score,
      tier: readiness.tier,
    });

    // Check if the readiness actually changed (avoid no-op writes)
    const existingReadiness = card.pipelineReadiness;
    const changed = !existingReadiness ||
      existingReadiness.score !== readiness.score ||
      existingReadiness.tier !== readiness.tier;

    if (changed) {
      // Always overwrite — this is a derived field
      card.pipelineReadiness = readiness;

      // Source attribution
      if (!card._fieldSources) card._fieldSources = {};
      card._fieldSources.pipelineReadiness = 'derived';

      // Add 'derived' to dataSources if not already present
      if (Array.isArray(card.dataSources) && !card.dataSources.includes('derived')) {
        card.dataSources.push('derived');
      }

      totalModified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  // ── Sort for top/bottom reporting ──
  allResults.sort((a, b) => b.score - a.score);
  const top10 = allResults.slice(0, 10);
  const bottom10 = allResults.slice(-10).reverse();

  const avgScore = totalProcessed > 0
    ? (scoreSum / totalProcessed).toFixed(1)
    : '0.0';

  // ── Report ──
  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards processed:    ${totalProcessed.toLocaleString()}`);
  console.log(`  Cards modified:     ${totalModified.toLocaleString()}`);
  if (totalSkippedParse > 0) {
    console.log(`  Parse errors:       ${totalSkippedParse.toLocaleString()}`);
  }
  console.log(`  Average score:      ${avgScore}`);
  console.log('');

  console.log('  TIER DISTRIBUTION:');
  console.log('  ─────────────────────────────────────');
  for (const [tier, count] of Object.entries(tierCounts)) {
    const pct = totalProcessed > 0
      ? ((count / totalProcessed) * 100).toFixed(1)
      : '0.0';
    const bar = '█'.repeat(Math.round(count / Math.max(1, totalProcessed) * 40));
    console.log(`  ${tier.padEnd(10)} ${String(count).padStart(4)}  (${pct.padStart(5)}%)  ${bar}`);
  }
  console.log('');

  console.log('  COMPONENT COVERAGE:');
  console.log('  ─────────────────────────────────────');
  for (const c of SCORING_COMPONENTS) {
    const hits = componentHits[c.key];
    const pct = totalProcessed > 0
      ? ((hits / totalProcessed) * 100).toFixed(1)
      : '0.0';
    console.log(`  ${c.label.padEnd(35)} ${String(hits).padStart(4)}  (${pct.padStart(5)}%)`);
  }
  console.log('');

  console.log('  TOP 10 LANGUAGES BY SCORE:');
  console.log('  ─────────────────────────────────────');
  for (const r of top10) {
    console.log(`  ${r.code.padEnd(6)} ${r.name.padEnd(30)} ${String(r.score).padStart(3)}  ${r.tier}`);
  }
  console.log('');

  console.log('  BOTTOM 10 LANGUAGES BY SCORE:');
  console.log('  ─────────────────────────────────────');
  for (const r of bottom10) {
    console.log(`  ${r.code.padEnd(6)} ${r.name.padEnd(30)} ${String(r.score).padStart(3)}  ${r.tier}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
