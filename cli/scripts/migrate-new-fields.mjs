#!/usr/bin/env node

/**
 * migrate-new-fields.mjs
 *
 * Adds missing fields to ALL existing language cards:
 *   1. vitality — UNESCO status, speaker count, trend
 *   2. pipelineReadiness — tier, FST, corpus, eval status
 *   3. exposure on corpora entries — contamination tracking
 *   4. resources.tools — empty array if missing
 *   5. resources.fsts — empty array if missing
 *   6. regions — structured geographic data with coordinates
 *   7. culturalAphorism — null placeholder for human curation
 *
 * Rules:
 *   - NEVER overwrite fields that already exist with non-null data
 *   - Cards with `extends` skip vitality + pipelineReadiness (inherit from genus)
 *   - Conlangs (x-* prefix or tlh) get null for vitality + pipelineReadiness
 *   - Regional variants (es-MX, fr-CA, pt-PT, pt-BR, zh-TW, nb) get null for
 *     vitality + pipelineReadiness
 *   - HRL languages (Google + DeepL + Microsoft) get tier: not-applicable
 *   - Medium-resource (Google but not DeepL) get tier: not-applicable with
 *     hasEvalBenchmark: false
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');

// ── Counters ──────────────────────────────────────────────────────────────
let totalFiles = 0;
let totalChanges = 0;

// ── Vitality data for major world languages ──────────────────────────────
// Only used when a card does NOT already have vitality AND is not a conlang,
// regional variant, or extends-card.
const VITALITY_DATA = {
  ar: { unescoStatus: 'safe', egids: null, speakerCount: '~370M L1', trend: 'growing', notes: null },
  bg: { unescoStatus: 'safe', egids: null, speakerCount: '~8M L1', trend: 'stable', notes: null },
  bn: { unescoStatus: 'safe', egids: null, speakerCount: '~230M L1', trend: 'growing', notes: null },
  cs: { unescoStatus: 'safe', egids: null, speakerCount: '~10.7M L1', trend: 'stable', notes: null },
  da: { unescoStatus: 'safe', egids: null, speakerCount: '~5.6M L1', trend: 'stable', notes: null },
  de: { unescoStatus: 'safe', egids: null, speakerCount: '~95M L1', trend: 'stable', notes: null },
  el: { unescoStatus: 'safe', egids: null, speakerCount: '~13.5M L1', trend: 'stable', notes: null },
  en: { unescoStatus: 'safe', egids: null, speakerCount: '~380M L1', trend: 'growing', notes: null },
  es: { unescoStatus: 'safe', egids: null, speakerCount: '~490M L1', trend: 'growing', notes: null },
  fa: { unescoStatus: 'safe', egids: null, speakerCount: '~77M L1', trend: 'growing', notes: null },
  fi: { unescoStatus: 'safe', egids: null, speakerCount: '~5.4M L1', trend: 'stable', notes: null },
  fr: { unescoStatus: 'safe', egids: null, speakerCount: '~80M L1 (~310M total)', trend: 'growing', notes: null },
  he: { unescoStatus: 'safe', egids: null, speakerCount: '~9M L1', trend: 'growing', notes: null },
  hi: { unescoStatus: 'safe', egids: null, speakerCount: '~340M L1', trend: 'growing', notes: null },
  hu: { unescoStatus: 'safe', egids: null, speakerCount: '~13M L1', trend: 'stable', notes: null },
  id: { unescoStatus: 'safe', egids: null, speakerCount: '~43M L1 (~200M total)', trend: 'growing', notes: null },
  it: { unescoStatus: 'safe', egids: null, speakerCount: '~67M L1', trend: 'stable', notes: null },
  ja: { unescoStatus: 'safe', egids: null, speakerCount: '~125M L1', trend: 'stable', notes: null },
  ka: { unescoStatus: 'safe', egids: null, speakerCount: '~3.7M L1', trend: 'stable', notes: null },
  ko: { unescoStatus: 'safe', egids: null, speakerCount: '~77M L1', trend: 'stable', notes: null },
  ms: { unescoStatus: 'safe', egids: null, speakerCount: '~33M L1', trend: 'stable', notes: null },
  nb: null, // Regional variant — defer to parent Norwegian card
  nl: { unescoStatus: 'safe', egids: null, speakerCount: '~25M L1', trend: 'stable', notes: null },
  pl: { unescoStatus: 'safe', egids: null, speakerCount: '~45M L1', trend: 'stable', notes: null },
  pt: { unescoStatus: 'safe', egids: null, speakerCount: '~260M L1', trend: 'growing', notes: null },
  ro: { unescoStatus: 'safe', egids: null, speakerCount: '~24M L1', trend: 'stable', notes: null },
  ru: { unescoStatus: 'safe', egids: null, speakerCount: '~150M L1', trend: 'declining', notes: null },
  sk: { unescoStatus: 'safe', egids: null, speakerCount: '~5.2M L1', trend: 'stable', notes: null },
  sr: { unescoStatus: 'safe', egids: null, speakerCount: '~12M L1', trend: 'stable', notes: null },
  sv: { unescoStatus: 'safe', egids: null, speakerCount: '~10M L1', trend: 'stable', notes: null },
  sw: { unescoStatus: 'safe', egids: null, speakerCount: '~16M L1 (~100M total)', trend: 'growing', notes: null },
  th: { unescoStatus: 'safe', egids: null, speakerCount: '~21M L1 (~60M total)', trend: 'stable', notes: null },
  tl: { unescoStatus: 'safe', egids: null, speakerCount: '~28M L1 (~82M total)', trend: 'growing', notes: null },
  tr: { unescoStatus: 'safe', egids: null, speakerCount: '~80M L1', trend: 'growing', notes: null },
  uk: { unescoStatus: 'safe', egids: null, speakerCount: '~33M L1', trend: 'stable', notes: null },
  ur: { unescoStatus: 'safe', egids: null, speakerCount: '~70M L1 (~230M total)', trend: 'growing', notes: null },
  vi: { unescoStatus: 'safe', egids: null, speakerCount: '~85M L1', trend: 'growing', notes: null },
  zh: { unescoStatus: 'safe', egids: null, speakerCount: '~920M L1 (Mandarin)', trend: 'stable', notes: null },
};

// Regional variants — these get null vitality (defer to parent)
const REGIONAL_VARIANTS = new Set([
  'es-MX', 'fr-CA', 'pt-PT', 'pt-BR', 'zh-TW', 'nb',
]);

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Is this a conlang code?
 * Conlangs use x-* prefix (private-use subtag) or 'tlh' (Klingon).
 */
function isConlang(code) {
  return code.startsWith('x-') || code === 'tlh';
}

/**
 * Does this card extend a genus card?
 * Cards with `extends` inherit vitality/pipelineReadiness from the genus.
 */
function hasExtends(card) {
  return !!card.extends;
}

/**
 * Determine if a language is HRL (High Resource Language):
 * supported by Google Translate AND DeepL AND Microsoft Translator.
 */
function isHRL(card) {
  const ms = card.methodSupport;
  if (!ms) return false;
  return (
    ms.googleTranslate?.supported === true &&
    ms.deepl?.supported === true &&
    ms.microsoftTranslator?.supported === true
  );
}

/**
 * Determine if a language is medium-resource:
 * has Google Translate but NOT DeepL.
 */
function isMediumResource(card) {
  const ms = card.methodSupport;
  if (!ms) return false;
  return (
    ms.googleTranslate?.supported === true &&
    ms.deepl?.supported !== true
  );
}

// ── Main migration logic ─────────────────────────────────────────────────

function migrateCard(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const card = JSON.parse(raw);
  const code = card.code;
  const changes = [];

  // ── 1. Add vitality (if missing) ──────────────────────────────────

  if (!('vitality' in card)) {
    if (hasExtends(card)) {
      // Cards with extends skip vitality — inherit from genus
      changes.push('vitality: skipped (extends)');
    } else if (isConlang(code)) {
      card.vitality = null;
      changes.push('vitality: null (conlang)');
    } else if (REGIONAL_VARIANTS.has(code)) {
      card.vitality = null;
      changes.push('vitality: null (regional variant)');
    } else if (VITALITY_DATA[code]) {
      card.vitality = VITALITY_DATA[code];
      changes.push(`vitality: ${VITALITY_DATA[code].unescoStatus}/${VITALITY_DATA[code].trend}`);
    } else if (VITALITY_DATA[code] === null) {
      // Explicitly null in data table (e.g. nb)
      card.vitality = null;
      changes.push('vitality: null (deferred)');
    } else {
      // Unknown language — log but don't set
      changes.push('vitality: SKIPPED (no data for this code)');
    }
  }

  // ── 2. Add pipelineReadiness (if missing) ─────────────────────────

  if (!('pipelineReadiness' in card)) {
    if (hasExtends(card)) {
      changes.push('pipelineReadiness: skipped (extends)');
    } else if (isConlang(code)) {
      card.pipelineReadiness = null;
      changes.push('pipelineReadiness: null (conlang)');
    } else if (REGIONAL_VARIANTS.has(code)) {
      card.pipelineReadiness = null;
      changes.push('pipelineReadiness: null (regional variant)');
    } else if (isHRL(card)) {
      card.pipelineReadiness = {
        tier: 'not-applicable',
        hasFST: false,
        hasParallelCorpus: true,
        hasEvalBenchmark: true,
        blockers: [],
        notes: 'High-resource language with extensive commercial MT support. FST-gated pipeline not needed.',
      };
      changes.push('pipelineReadiness: not-applicable (HRL)');
    } else if (isMediumResource(card)) {
      card.pipelineReadiness = {
        tier: 'not-applicable',
        hasFST: false,
        hasParallelCorpus: true,
        hasEvalBenchmark: false,
        blockers: [],
        notes: 'Medium-resource language with Google Translate / NLLB support. FST-gated pipeline not primary focus.',
      };
      changes.push('pipelineReadiness: not-applicable (medium-resource)');
    } else {
      // No commercial MT — don't assume anything, skip
      changes.push('pipelineReadiness: SKIPPED (no commercial MT data)');
    }
  }

  // ── 3. Add exposure to corpora entries ────────────────────────────

  if (card.resources?.corpora && Array.isArray(card.resources.corpora)) {
    let corporaExposureCount = 0;
    for (const corpus of card.resources.corpora) {
      if (!('exposure' in corpus)) {
        // All known public datasets (OPUS, NLLB, JW300, FLORES, Wikipedia, etc.)
        // are open-web by default. This is the safe assumption.
        corpus.exposure = 'open-web';
        corporaExposureCount++;
      }
    }
    if (corporaExposureCount > 0) {
      changes.push(`exposure: added "open-web" to ${corporaExposureCount} corpora`);
    }
  }

  // ── 4. Add missing resources.tools ────────────────────────────────

  if (card.resources && !('tools' in card.resources)) {
    card.resources.tools = [];
    changes.push('resources.tools: added empty array');
  }

  // ── 5. Add missing resources.fsts ─────────────────────────────────

  if (card.resources && !('fsts' in card.resources)) {
    card.resources.fsts = [];
    changes.push('resources.fsts: added empty array');
  }

  // ── 6. Add missing regions (if missing) ───────────────────────────

  if (!('regions' in card)) {
    if (isConlang(code)) {
      card.regions = null;
      changes.push('regions: null (conlang)');
    } else {
      card.regions = [
        {
          country: `TODO: Primary country for ${card.name}`,
          countryCode: 'XX',
          officialStatus: null,
          region: null,
          speakerEstimate: null,
          coordinates: null,
        },
      ];
      changes.push('regions: added TODO scaffold');
    }
  } else if (Array.isArray(card.regions)) {
    // Ensure all existing region entries have coordinates and admin1Codes
    let fieldsAdded = 0;
    for (const region of card.regions) {
      if (!('coordinates' in region)) {
        region.coordinates = null;
        fieldsAdded++;
      }
      if (!('admin1Codes' in region)) {
        region.admin1Codes = null;
        fieldsAdded++;
      }
    }
    if (fieldsAdded > 0) {
      changes.push(`region fields: added null scaffolds to ${fieldsAdded} entries`);
    }
  }

  // ── 7. Add missing culturalAphorism (if missing) ──────────────────

  if (!('culturalAphorism' in card)) {
    card.culturalAphorism = null;
    changes.push('culturalAphorism: null (requires human curation)');
  }

  // ── Write back if changes were made ───────────────────────────────

  const actualChanges = changes.filter(c => !c.includes('skipped') && !c.includes('SKIPPED'));

  if (actualChanges.length > 0) {
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    totalChanges += actualChanges.length;
  }

  if (changes.length > 0) {
    console.log(`  ${code}: ${changes.join(', ')}`);
  }

  return actualChanges.length;
}

// ── Process all card files ────────────────────────────────────────────────

function processDirectory(dir, label) {
  const files = fs.readdirSync(dir).filter(f =>
    f.endsWith('.json') && f !== 'language-tree.json'
  );

  console.log(`\n── ${label} (${files.length} files) ──`);

  for (const filename of files) {
    const filePath = path.join(dir, filename);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) continue;

    totalFiles++;
    migrateCard(filePath);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Champollion Language Card Migration: New Fields            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// Process genera/ first (genus cards may get their own vitality/pipelineReadiness)
const generaDir = path.join(CARDS_DIR, 'genera');
if (fs.existsSync(generaDir)) {
  processDirectory(generaDir, 'Genera (genus/family cards)');
}

// Then process all top-level cards
processDirectory(CARDS_DIR, 'Language cards');

console.log('\n── Summary ──');
console.log(`  Files processed: ${totalFiles}`);
console.log(`  Total changes:   ${totalChanges}`);
console.log('  Done.\n');
