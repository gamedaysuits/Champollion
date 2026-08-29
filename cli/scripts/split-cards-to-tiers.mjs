#!/usr/bin/env node
/**
 * split-cards-to-tiers.mjs
 * ────────────────────────────────────────────────────────────────────
 * Migrates the language card system from a single-file monolith
 * to a two-tier architecture:
 *
 *   RUNTIME  → shared/language-cards/<code>.json
 *              Loaded eagerly at module init. Contains only fields
 *              consumed by the translation pipeline and register system.
 *
 *   REFERENCE → shared/language-reference/<code>.json
 *               Loaded lazily on demand. Contains developer-facing
 *               documentation: linguistic challenges, encyclopedic
 *               metadata, and NLP resource links.
 *
 * The split is based on a clear field classification:
 *
 *   REFERENCE-ONLY fields (extracted from runtime cards):
 *     - linguisticChallenges  (MT pitfalls, prose-heavy, ~2 KB)
 *     - encyclopedic          (family tree, demographics, history)
 *     - resources             (NLP tools, corpora, pre-trained models)
 *
 *   All other fields remain in the runtime card unchanged.
 *
 * Usage:
 *   node scripts/split-cards-to-tiers.mjs              # apply
 *   node scripts/split-cards-to-tiers.mjs --dry-run    # preview
 *
 * Idempotent: running twice produces the same result. Cards that
 * already lack reference fields are skipped (no reference file
 * created if nothing to extract).
 * ────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');

const CARDS_DIR = path.resolve(import.meta.dirname, '..', '..', '..', 'shared', 'language-cards');
const REFERENCE_DIR = path.resolve(import.meta.dirname, '..', '..', '..', 'shared', 'language-reference');

// Fields that belong in the reference tier, not runtime
const REFERENCE_FIELDS = ['linguisticChallenges', 'encyclopedic', 'resources'];

let splitCount = 0;
let skippedCount = 0;
let totalRuntimeBytes = 0;
let totalReferenceBytes = 0;

// Ensure the reference directory exists
if (!DRY_RUN) {
  fs.mkdirSync(REFERENCE_DIR, { recursive: true });
}

/**
 * Process a single card file.
 * Extracts reference fields, writes stripped runtime card
 * and separate reference file.
 */
function processCard(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const card = JSON.parse(raw);

  // Check if this card has any reference fields to extract
  const hasReferenceData = REFERENCE_FIELDS.some(f => card[f] != null);

  if (!hasReferenceData) {
    skippedCount++;
    return;
  }

  // ── Build the reference object ──────────────────────────────────
  // Include code and name so the reference file is self-identifying
  const reference = {
    code: card.code,
    name: card.name,
  };

  for (const field of REFERENCE_FIELDS) {
    if (card[field] != null) {
      reference[field] = card[field];
    }
  }

  // ── Build the stripped runtime card ─────────────────────────────
  const runtime = { ...card };
  for (const field of REFERENCE_FIELDS) {
    delete runtime[field];
  }

  // ── Determine output paths ─────────────────────────────────────
  // Preserve relative path structure (for subfamilies/families subdirs)
  const relPath = path.relative(CARDS_DIR, filePath);
  const refPath = path.join(REFERENCE_DIR, relPath);

  // ── Serialize ──────────────────────────────────────────────────
  const runtimeJson = JSON.stringify(runtime, null, 2) + '\n';
  const referenceJson = JSON.stringify(reference, null, 2) + '\n';

  totalRuntimeBytes += Buffer.byteLength(runtimeJson, 'utf-8');
  totalReferenceBytes += Buffer.byteLength(referenceJson, 'utf-8');

  if (DRY_RUN) {
    const rSize = (Buffer.byteLength(runtimeJson, 'utf-8') / 1024).toFixed(1);
    const eSize = (Buffer.byteLength(referenceJson, 'utf-8') / 1024).toFixed(1);
    console.log(`  📋 ${card.code.padEnd(14)} runtime: ${rSize} KB  |  reference: ${eSize} KB`);
  } else {
    // Ensure subdirectories exist for reference path
    fs.mkdirSync(path.dirname(refPath), { recursive: true });

    fs.writeFileSync(filePath, runtimeJson);
    fs.writeFileSync(refPath, referenceJson);
    console.log(`  ✅ ${card.code}`);
  }

  splitCount++;
}

/**
 * Recursively scan a directory for JSON card files.
 */
function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      processCard(fullPath);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────

console.log(DRY_RUN ? '\n  [DRY RUN] Preview of tiered split:\n' : '\n  Splitting cards into runtime + reference tiers:\n');

scanDir(CARDS_DIR);

const totalKB = ((totalRuntimeBytes + totalReferenceBytes) / 1024).toFixed(0);
const runtimeKB = (totalRuntimeBytes / 1024).toFixed(0);
const referenceKB = (totalReferenceBytes / 1024).toFixed(0);

console.log(`
  ────────────────────────────────────────
  Split:    ${splitCount} cards → runtime + reference
  Skipped:  ${skippedCount} cards (no reference data)
  ────────────────────────────────────────
  Runtime total:    ${runtimeKB} KB  (loaded eagerly)
  Reference total:  ${referenceKB} KB  (loaded lazily)
  Combined:         ${totalKB} KB
  ────────────────────────────────────────
`);
