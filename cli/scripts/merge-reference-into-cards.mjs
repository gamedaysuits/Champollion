#!/usr/bin/env node

/**
 * merge-reference-into-cards.mjs
 * 
 * Phase 1.1: Merge language-reference/*.json data INTO language-cards/*.json.
 * 
 * For each reference file, reads the corresponding runtime card, deep-merges
 * the reference fields (linguisticChallenges, encyclopedic, resources) into it,
 * and writes the unified card back.
 * 
 * Run with: node scripts/merge-reference-into-cards.mjs [--dry-run]
 * 
 * --dry-run: Show what would be merged without writing files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const REFERENCE_DIR = path.join(__dirname, '..', 'shared', 'language-reference');

const dryRun = process.argv.includes('--dry-run');

function scanJsonFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip directories (families/ subfolder in reference dir)
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push({ name: entry.name, path: fullPath });
    }
  }
  return results;
}

function findCardPath(cardName, cardsDir) {
  // Check root
  const rootPath = path.join(cardsDir, cardName);
  if (fs.existsSync(rootPath)) return rootPath;
  
  // Check subdirectories (families/, subfamilies/)
  const subdirs = fs.readdirSync(cardsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
  
  for (const subdir of subdirs) {
    const subPath = path.join(cardsDir, subdir, cardName);
    if (fs.existsSync(subPath)) return subPath;
  }
  
  return null;
}

// Fields that belong to the reference tier and should be merged into runtime
const REFERENCE_FIELDS = ['linguisticChallenges', 'encyclopedic', 'resources'];

let merged = 0;
let skipped = 0;
let noCard = 0;

const refFiles = scanJsonFiles(REFERENCE_DIR);

console.log(`Found ${refFiles.length} reference files to merge.`);
console.log(`Cards directory: ${CARDS_DIR}`);
console.log(`Reference directory: ${REFERENCE_DIR}`);
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
console.log('---');

for (const refFile of refFiles) {
  const cardPath = findCardPath(refFile.name, CARDS_DIR);
  
  if (!cardPath) {
    console.log(`⚠️  No card found for ${refFile.name} — skipping`);
    noCard++;
    continue;
  }
  
  const refData = JSON.parse(fs.readFileSync(refFile.path, 'utf-8'));
  const cardData = JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
  
  // Check which reference fields exist and aren't already on the card
  const fieldsToMerge = [];
  for (const field of REFERENCE_FIELDS) {
    if (refData[field]) {
      if (cardData[field]) {
        console.log(`  ℹ️  ${refFile.name}: '${field}' already on card — will be overwritten with reference data`);
      }
      fieldsToMerge.push(field);
    }
  }
  
  // Also merge any encyclopedic sub-fields that might be at top level in reference
  // (some reference files have 'encyclopedic.resources' nested differently)
  
  if (fieldsToMerge.length === 0) {
    console.log(`⏭️  ${refFile.name}: No reference fields to merge — skipping`);
    skipped++;
    continue;
  }
  
  // Merge reference fields into card
  const mergedCard = { ...cardData };
  for (const field of fieldsToMerge) {
    mergedCard[field] = refData[field];
  }
  
  if (dryRun) {
    console.log(`🔍 ${refFile.name}: Would merge [${fieldsToMerge.join(', ')}] into ${path.relative(CARDS_DIR, cardPath)}`);
  } else {
    fs.writeFileSync(cardPath, JSON.stringify(mergedCard, null, 2) + '\n', 'utf-8');
    console.log(`✅ ${refFile.name}: Merged [${fieldsToMerge.join(', ')}] into ${path.relative(CARDS_DIR, cardPath)}`);
  }
  merged++;
}

console.log('---');
console.log(`Done. Merged: ${merged}, Skipped: ${skipped}, No card found: ${noCard}`);

if (!dryRun && merged > 0) {
  console.log(`\nReference files have been merged into runtime cards.`);
  console.log(`You can now safely delete the reference directory:`);
  console.log(`  rm -rf "${REFERENCE_DIR}"`);
  console.log(`And remove shared/schemas/language-reference.schema.json`);
}
