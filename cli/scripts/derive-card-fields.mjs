#!/usr/bin/env node

/**
 * derive-card-fields.mjs
 * ────────────────────────────────────────────────────────────────
 * Populates fields that can be deterministically derived from
 * other fields already on the card.
 *
 * Currently derives:
 *   1. `dir` (writing direction) from `script` code
 *   2. `supportTier` from card completeness assessment
 *   3. `_generated.completeness` from populated field count
 *
 * WHY THIS IS SEPARATE FROM ENRICHMENT:
 *   Enrichment pulls data from external sources (Glottolog, Wikidata, CLDR).
 *   Derivation uses only data already on the card. This script should run
 *   AFTER enrichment, as a final pass.
 *
 * Usage:
 *   node scripts/derive-card-fields.mjs              # all cards
 *   node scripts/derive-card-fields.mjs --dry-run    # preview changes
 *   node scripts/derive-card-fields.mjs --lang crk   # single card
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

// ─── Derivation: Writing direction from script code ────────────────
//
// ISO 15924 script codes map to a known writing direction.
// Source: Unicode CLDR supplemental/scriptMetadata.txt

const RTL_SCRIPTS = new Set([
  'Arab', 'Hebr', 'Thaa', 'Syrc', 'Mand', 'Nkoo', 'Yezi', 'Adlm',
  'Avst', 'Cprt', 'Hung', 'Lyci', 'Lydi', 'Mero', 'Orkh', 'Phnx',
  'Samr', 'Sarb',
]);

// Everything not RTL and not special (like top-to-bottom CJK) is LTR.
// CJK scripts (Hans, Hant, Jpan, Kore, Hang) are LTR in modern usage.

function deriveDirection(script) {
  if (!script) return null;
  if (RTL_SCRIPTS.has(script)) return 'rtl';
  return 'ltr';
}

// ─── Derivation: Macroarea from coordinates + country codes ────────
//
// Uses Glottolog's 6 macroareas, derived from the language's
// geographic coordinates and country codes. This is a rough
// derivation; Glottolog's own assignments take priority.
// Source: Glottolog geographic definitions (Hammarström et al.)

const AFRICA_COUNTRIES = new Set([
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','DJ','EG','GQ',
  'ER','SZ','ET','GA','GM','GH','GN','GW','CI','KE','LS','LR','LY','MG','MW','ML',
  'MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD',
  'TZ','TG','TN','UG','ZM','ZW','RE','YT',
]);
const NA_COUNTRIES = new Set([
  'US','CA','MX','GT','BZ','SV','HN','NI','CR','PA','CU','JM','HT','DO',
  'PR','TT','BS','BB','AG','DM','GD','KN','LC','VC','GL',
]);
const SA_COUNTRIES = new Set(['BR','AR','CO','PE','VE','CL','EC','BO','PY','UY','GY','SR','GF','FK']);
const AU_COUNTRIES = new Set(['AU','NZ']);
const PAPUNESIA_COUNTRIES = new Set(['PG','SB','VU','NC','FJ','TO','WS','TV','KI','MH','FM','PW','NR','TL']);

function deriveMacroarea(card) {
  if (!card.coordinates || card.coordinates.lat == null) return null;
  const lat = card.coordinates.lat;
  const lng = card.coordinates.lng;
  const countries = new Set((card.countries || []).map(c => typeof c === 'string' ? c : ''));

  // Country codes are the strongest signal
  if (countries.size > 0) {
    for (const c of countries) {
      if (AFRICA_COUNTRIES.has(c)) return 'Africa';
      if (AU_COUNTRIES.has(c)) return 'Australia';
      if (SA_COUNTRIES.has(c)) return 'South America';
      if (NA_COUNTRIES.has(c)) return 'North America';
      if (PAPUNESIA_COUNTRIES.has(c)) return 'Papunesia';
    }
  }

  // Coordinate-based fallback
  if (lat >= -35 && lat <= 37 && lng >= -20 && lng <= 55) return 'Africa';
  if (lat >= -50 && lat <= -10 && lng >= 110 && lng <= 180) return 'Australia';
  if (lat >= -60 && lat <= 15 && lng >= -90 && lng <= -30) return 'South America';
  if (lat >= 5 && lat <= 85 && lng >= -170 && lng <= -50) return 'North America';
  if (lat >= -15 && lat <= 5 && lng >= 120 && lng <= 180) return 'Papunesia';
  if (lat >= -25 && lat <= 0 && lng >= 140 && lng <= 180) return 'Papunesia';
  if (lat >= -10 && lat <= 75 && lng >= -30 && lng <= 180) return 'Eurasia';

  return null;
}

// ─── Derivation: Support tier from card completeness ───────────────
//
// Tier criteria:
//   "supported"   — formality + registers + linguisticChallenges populated
//   "developing"  — resources OR methodSupport with >2 methods supported
//   "emerging"    — vitality + speakerEstimates populated
//   "cataloged"   — everything else (identity + classification only)

function deriveSupportTier(card) {
  // Check for deep-research fields (supported tier)
  const hasFormality = card.formality !== null;
  const hasRegisters = card.registers !== null;
  const hasChallenges = card.linguisticChallenges !== null;
  if (hasFormality && hasRegisters && hasChallenges) return 'supported';

  // Check for resources/tooling (developing tier)
  const hasResources = card.resources !== null;
  const methodCount = Object.values(card.methodSupport || {})
    .filter(m => m?.supported).length;
  if (hasResources || methodCount >= 3) return 'developing';

  // Check for demographic data (emerging tier)
  const hasVitality = card.vitality !== null;
  const hasSpeakers = Array.isArray(card.speakerEstimates) && card.speakerEstimates.length > 0;
  if (hasVitality || hasSpeakers) return 'emerging';

  return 'cataloged';
}

// ─── Derivation: Completeness level ───────────────────────────────
//
// "partial"     — has identity + classification + coords
// "substantial" — + vitality + speakerEstimates + script
// "complete"    — all automatable fields populated

function deriveCompleteness(card) {
  const hasClassification = card.classification !== null;
  const hasCoords = card.coordinates !== null;
  const hasVitality = card.vitality !== null;
  const hasSpeakers = Array.isArray(card.speakerEstimates) && card.speakerEstimates.length > 0;
  const hasScript = card.script !== null;
  const hasNativeName = card.nativeName !== null;
  const hasMacroarea = card.macroarea !== null;
  const hasDir = card.dir !== null;

  if (hasClassification && hasVitality && hasSpeakers && hasScript &&
      hasNativeName && hasMacroarea && hasDir) {
    return 'substantial';
  }
  if (hasClassification && hasCoords) {
    return 'partial';
  }
  return 'partial';
}


// ─── Main ──────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Card Field Derivation Pass');
  console.log('  Populates dir, supportTier, and completeness from');
  console.log('  data already on the card.');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

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

  let dirDerived = 0;
  let macroareaDerived = 0;
  let tierChanged = 0;
  let completenessSet = 0;
  let totalModified = 0;

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }

    let modified = false;

    // 1. Derive dir from script (only if dir is currently null)
    if (card.dir === null && card.script) {
      const derived = deriveDirection(card.script);
      if (derived) {
        card.dir = derived;
        dirDerived++;
        modified = true;
      }
    }

    // 2. Derive macroarea from coordinates + country codes
    if (card.macroarea === null) {
      const macro = deriveMacroarea(card);
      if (macro) {
        card.macroarea = macro;
        // Source attribution: mark as coordinate-derived so it's
        // distinguishable from Glottolog's authoritative assignments
        if (!card._generated) card._generated = {};
        if (!card._generated.derivedFields) card._generated.derivedFields = {};
        card._generated.derivedFields.macroarea = 'derived-from-coordinates';
        macroareaDerived++;
        modified = true;
      }
    } else if (typeof card.macroarea === 'string' && card.macroarea.includes(';')) {
      // Multi-valued 'A;B' strings leaked in from a legacy ingest that
      // joined per-doculect macroareas. Glottolog assigns exactly ONE
      // macroarea per languoid — re-derive from coordinates/countries,
      // falling back to the first listed component. (2026-07-07)
      const macro = deriveMacroarea(card) || card.macroarea.split(';')[0].trim();
      if (macro && macro !== card.macroarea) {
        card.macroarea = macro;
        if (!card._generated) card._generated = {};
        if (!card._generated.derivedFields) card._generated.derivedFields = {};
        card._generated.derivedFields.macroarea = 'derived-from-coordinates';
        macroareaDerived++;
        modified = true;
      }
    }

    // 2. Derive supportTier
    const newTier = deriveSupportTier(card);
    if (card.supportTier !== newTier) {
      card.supportTier = newTier;
      tierChanged++;
      modified = true;
    }

    // 3. Derive _generated.completeness
    if (card._generated) {
      const newCompleteness = deriveCompleteness(card);
      if (card._generated.completeness !== newCompleteness) {
        card._generated.completeness = newCompleteness;
        completenessSet++;
        modified = true;
      }
    }

    if (modified) {
      totalModified++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards modified:         ${totalModified.toLocaleString()}`);
  console.log(`  dir derived from script: ${dirDerived.toLocaleString()}`);
  console.log(`  macroarea derived:       ${macroareaDerived.toLocaleString()}`);
  console.log(`  supportTier changed:     ${tierChanged.toLocaleString()}`);
  console.log(`  completeness updated:    ${completenessSet.toLocaleString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
