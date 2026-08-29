#!/usr/bin/env node

/**
 * conform-cards-to-spec.mjs
 * ────────────────────────────────────────────────────────────────
 * Ensures every language card has the canonical 60-field shape
 * defined in language-card-spec.md v3.
 *
 * This script does NOT look up or change any data values. It only:
 *   1. Adds missing fields with null/[] defaults
 *   2. Preserves every existing field and value
 *   3. Orders fields according to the spec's section order
 *
 * This is a structural migration, not an enrichment pass.
 *
 * Usage:
 *   node scripts/conform-cards-to-spec.mjs              # apply to all cards
 *   node scripts/conform-cards-to-spec.mjs --dry-run    # preview changes
 *   node scripts/conform-cards-to-spec.mjs --lang crk   # single card
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

// ─── Canonical field order and defaults ────────────────────────────────
// This defines the EXACT shape every card must have.
// Order matches the 10 sections in language-card-spec.md.
//
// Each entry: [fieldName, defaultValue]
// defaultValue is used ONLY when the field is missing entirely.
// Existing values (even null) are never overwritten.

const CANONICAL_FIELDS = [
  // § 1. Identity
  ['code',             null],
  ['name',             null],
  ['nativeName',       null],
  ['alternateNames',   []],
  ['iso639_3',         null],
  ['iso639_1',         null],
  ['bcp47',            null],
  ['aliases',          []],
  ['isoScope',         null],
  ['isoType',          null],
  ['macrolanguage',    null],
  ['extends',          null],

  // § 2. Classification
  ['glottocode',       null],
  ['classification',   null],
  ['isIsolate',        false],

  // § 3. Geography
  ['macroarea',        null],
  ['coordinates',      null],
  ['countries',        []],
  ['regions',          []],
  ['arealContext',     null],

  // § 4. Writing Systems
  ['script',           null],
  ['scriptUnicodeName', null],
  ['scripts',          []],
  ['dir',              null],
  ['scriptConverter',  null],
  ['orthographicStatus', null],
  ['orthographies',    null],   // Structured conventions (derive-orthographies.mjs)

  // § 5. Demographics & Vitality
  ['speakerEstimates', []],
  ['vitality',         null],

  // § 5.5. Documentation & Digital Presence
  ['documentationDepth', null],
  ['digitalPresence',  null],
  ['dialectCount',     null],

  // § 6. Formality, Registers & Gender
  ['formality',        null],
  ['registers',        null],
  ['gender',           null],
  ['codeSwitching',    null],

  // § 7. Linguistic Profile
  ['linguisticChallenges', null],
  ['contactInfluences',    []],
  ['rules',                null],
  ['typologicalProfile',   null],
  ['phonologicalInventory', null],

  // § 8. Encyclopedic
  ['encyclopedic',     null],
  ['culturalAphorism', null],
  ['varieties',        []],

  // § 9. Digital Resources & Tooling
  ['resources',        null],
  ['databaseCoverage', null],
  ['corpusAvailability', null],
  ['keyboardSupport',  null],
  ['methodSupport',    {
    googleTranslate:     { supported: false },
    deepl:               { supported: false },
    microsoftTranslator: { supported: false },
    libreTranslate:      { supported: false },
    nllb:                { supported: false },
    llm:                 { supported: true },
  }],
  ['metricModelSupport', null],
  ['metricPlugins',    null],
  ['scoringProfile',   null],   // Card-driven composite profile (SCORING_SPEC §4.3)
  ['evalStandard',     null],   // External eval-standard package to fetch (e.g. champollion-lyss)
  ['evalMetrics',      null],   // Eval-standard metric plugins (e.g. CRK LYSS)
  ['evalPack',         null],   // On-demand eval dependency manifest
  ['omt1600',          null],
  ['evalDatasets',     []],
  ['pipelineReadiness', null],

  // § 10. Provenance & Metadata
  ['dataSources',      []],
  ['supportTier',      'cataloged'],
  ['humanReviewed',    null],
  ['notes',            null],
  ['firstDocumented',  null],
  ['lastDocumented',   null],
  ['_generated',       null],
];

const CANONICAL_FIELD_NAMES = new Set(CANONICAL_FIELDS.map(([name]) => name));

// ─── Transient/migration fields that are allowed but not canonical ──────
// These are preserved in-place but not added to new cards.
const ALLOWED_EXTRA_FIELDS = new Set([
  '_migration',       // Transient: tracks code renames (ISO 639-1 → 639-3)
  '_meta',            // Transient: old metadata format
  '_fieldSources',    // Provenance: per-field source tracking from stamp-field-sources.mjs
  '_dataQualityFixes', // Provenance: repair log (fix-card-corruption / fix-endonym-authenticity)
  'nativeNameVerdict', // Endonym authenticity verdict (validate-endonyms.mjs): verified|plausible|suspect
  'stats',            // Legacy: should be migrated
  'families',         // Legacy: from old tree structure
  'isolates',         // Legacy: from old tree structure
]);

// ─── Processing ────────────────────────────────────────────────────────

/**
 * Conform a single card to the canonical spec shape.
 *
 * Strategy:
 *   1. Start with the canonical field order + defaults.
 *   2. For each canonical field: use existing value if present, otherwise default.
 *   3. Append any non-canonical fields the card has (preserving data, not deleting).
 *   4. Track what fields were added.
 *
 * @param {object} card - The existing card data
 * @returns {{ conformed: object, added: string[], extra: string[] }}
 */
function conformCard(card) {
  const conformed = {};
  const added = [];
  const extra = [];

  // Step 1: Build the canonical shape
  for (const [fieldName, defaultValue] of CANONICAL_FIELDS) {
    if (fieldName in card) {
      // Field exists — preserve its value exactly
      conformed[fieldName] = card[fieldName];
    } else {
      // Field missing — add with default
      // Deep-clone the default so we don't share object references
      conformed[fieldName] = JSON.parse(JSON.stringify(defaultValue));
      added.push(fieldName);
    }
  }

  // Step 2: Preserve any non-canonical fields (don't delete data)
  for (const key of Object.keys(card)) {
    if (!CANONICAL_FIELD_NAMES.has(key)) {
      conformed[key] = card[key];
      if (!ALLOWED_EXTRA_FIELDS.has(key)) {
        extra.push(key);
      }
    }
  }

  return { conformed, added, extra };
}

// ─── Main ──────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Language Card Conformance Migration');
  console.log('  Ensures all cards match the canonical 60-field spec v3.');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN (no files written)' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  // Discover card files
  let cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  if (SINGLE_LANG) {
    const target = `${SINGLE_LANG}.json`;
    if (!cardFiles.includes(target)) {
      console.error(`ERROR: Card not found: ${target}`);
      process.exit(1);
    }
    cardFiles = [target];
  }

  console.log(`  Cards to process: ${cardFiles.length.toLocaleString()}\n`);

  let totalModified = 0;
  let totalUnchanged = 0;
  let totalFieldsAdded = 0;
  const fieldAddCounts = {};
  const extraFieldCards = {};

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error(`  ✗ ${filename}: invalid JSON — ${err.message}`);
      continue;
    }

    const { conformed, added, extra } = conformCard(card);

    // Track extra (non-canonical, non-allowed) fields
    for (const field of extra) {
      if (!extraFieldCards[field]) extraFieldCards[field] = [];
      extraFieldCards[field].push(filename);
    }

    if (added.length === 0) {
      totalUnchanged++;
      continue;
    }

    // Track field additions
    for (const field of added) {
      fieldAddCounts[field] = (fieldAddCounts[field] || 0) + 1;
    }
    totalFieldsAdded += added.length;
    totalModified++;

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(conformed, null, 2) + '\n', 'utf-8');
    }
  }

  // ── Report ──
  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards modified:     ${totalModified.toLocaleString()}`);
  console.log(`  Cards unchanged:    ${totalUnchanged.toLocaleString()}`);
  console.log(`  Total fields added: ${totalFieldsAdded.toLocaleString()}`);
  console.log('');

  if (Object.keys(fieldAddCounts).length > 0) {
    console.log('  Fields added (by frequency):');
    const sorted = Object.entries(fieldAddCounts).sort((a, b) => b[1] - a[1]);
    for (const [field, count] of sorted) {
      console.log(`    ${field.padEnd(24)} ${count.toLocaleString().padStart(6)} cards`);
    }
    console.log('');
  }

  if (Object.keys(extraFieldCards).length > 0) {
    console.log('  ⚠ Non-canonical extra fields found (preserved, not in spec):');
    for (const [field, files] of Object.entries(extraFieldCards)) {
      console.log(`    ${field}: ${files.length} cards (e.g., ${files[0]})`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DONE');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
