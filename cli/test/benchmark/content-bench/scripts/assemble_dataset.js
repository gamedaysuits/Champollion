#!/usr/bin/env node
/**
 * assemble_dataset.js — Build the content-bench dataset from raw scrapes
 *
 * Reads the raw block files from raw/{siteId}/{locale}.blocks.json,
 * filters for quality, and assembles source/en.json + reference/{lang}.json.
 *
 * Only includes sites where EN + at least 1 target locale succeeded.
 * Filters out blocks that are too short (<5 words) or too noisy.
 *
 * Usage:
 *   node scripts/assemble_dataset.js [--min-locales N] [--min-words N]
 */

import fs from 'node:fs';
import path from 'node:path';

const BENCH_DIR = path.resolve(import.meta.dirname, '..');
const RAW_DIR = path.join(BENCH_DIR, 'raw');
const SOURCE_DIR = path.join(BENCH_DIR, 'source');
const REF_DIR = path.join(BENCH_DIR, 'reference');
const META_FILE = path.join(BENCH_DIR, 'metadata.json');
const SITES_FILE = path.join(BENCH_DIR, 'config', 'sites.json');

const TARGET_LANGS = ['fr', 'de', 'ja', 'es', 'ko', 'zh'];

// Parse CLI args
const args = process.argv.slice(2);
let MIN_LOCALES = 2; // EN + at least 1 other
let MIN_WORDS = 4;   // minimum words per block to include

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--min-locales') MIN_LOCALES = parseInt(args[++i], 10);
  if (args[i] === '--min-words') MIN_WORDS = parseInt(args[++i], 10);
}

// Load site registry for industry metadata
const siteRegistry = JSON.parse(fs.readFileSync(SITES_FILE, 'utf-8'));
const siteIndustryMap = {};
for (const s of siteRegistry) {
  siteIndustryMap[s.id] = s.industry;
}

/**
 * Check if a text block is "clean" enough to include in the dataset.
 * Filters out:
 *   - Very short text (less than MIN_WORDS words)
 *   - Text that's mostly URLs or link fragments
 *   - Text that's mostly numbers/symbols
 *   - Repeated bullet noise that wasn't fully cleaned
 */
function isCleanBlock(text) {
  if (!text || typeof text !== 'string') return false;

  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length < MIN_WORDS) return false;

  // Reject if mostly URLs
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount > 0 && urlCount >= words.length / 3) return false;

  // Reject if mostly non-alpha
  const alphaChars = text.replace(/[^a-zA-Z\u00C0-\u024F\u3000-\u9FFF\uAC00-\uD7AF]/g, '').length;
  if (alphaChars < text.length * 0.3) return false;

  // Reject common nav/CTA fragments
  const navPatterns = /^(Learn more|Buy|Shop|Sign in|Log in|Subscribe|Download|Get started|Cookie|Accept|Reject|Close|Menu|Search|Cart|Back|Next|Previous|Skip|Share|Follow us|Terms|Privacy Policy)$/i;
  if (navPatterns.test(text.trim())) return false;

  return true;
}

function main() {
  // Discover all scraped sites
  const siteDirs = fs.readdirSync(RAW_DIR).filter(d => {
    const stat = fs.statSync(path.join(RAW_DIR, d));
    return stat.isDirectory();
  });

  console.log(`\nFound ${siteDirs.length} scraped sites\n`);

  // Collect all aligned blocks
  const enBlocks = {};     // key → text
  const refBlocks = {};    // lang → { key → text }
  const metadata = {};     // key → { site, industry, type, wordCount }

  for (const lang of TARGET_LANGS) {
    refBlocks[lang] = {};
  }

  let totalBlocks = 0;
  let includedBlocks = 0;
  let skippedNoEN = 0;
  let skippedShort = 0;

  for (const siteId of siteDirs) {
    const siteDir = path.join(RAW_DIR, siteId);

    // Must have EN blocks
    const enBlocksFile = path.join(siteDir, 'en.blocks.json');
    if (!fs.existsSync(enBlocksFile)) {
      skippedNoEN++;
      continue;
    }

    const enData = JSON.parse(fs.readFileSync(enBlocksFile, 'utf-8'));

    // Find which target locales we have for this site
    const availableLocales = [];
    for (const lang of TARGET_LANGS) {
      const langFile = path.join(siteDir, `${lang}.blocks.json`);
      if (fs.existsSync(langFile)) {
        availableLocales.push(lang);
      }
    }

    // Need at least MIN_LOCALES - 1 target languages (EN is always counted)
    if (availableLocales.length < MIN_LOCALES - 1) continue;

    // Load all available locale blocks
    const localeData = {};
    for (const lang of availableLocales) {
      const langFile = path.join(siteDir, `${lang}.blocks.json`);
      localeData[lang] = JSON.parse(fs.readFileSync(langFile, 'utf-8'));
    }

    // Align blocks by index — only include blocks that exist in EN
    // and at least one target locale at the same position
    for (const enBlock of enData) {
      totalBlocks++;

      if (!isCleanBlock(enBlock.text)) {
        skippedShort++;
        continue;
      }

      // Check if any target locale has a clean block at this index
      let hasMatch = false;
      const matchedLangs = [];

      for (const lang of availableLocales) {
        const langBlocks = localeData[lang];
        // Find block at same index
        const langBlock = langBlocks.find(b => b.index === enBlock.index);
        if (langBlock && isCleanBlock(langBlock.text)) {
          hasMatch = true;
          matchedLangs.push(lang);
        }
      }

      if (!hasMatch) continue;

      // Generate unique key
      const key = `${siteId}:${enBlock.index}`;
      const wordCount = enBlock.text.split(/\s+/).length;

      // Store EN source
      enBlocks[key] = enBlock.text;

      // Store references for each matched locale
      for (const lang of matchedLangs) {
        const langBlock = localeData[lang].find(b => b.index === enBlock.index);
        if (langBlock) {
          refBlocks[lang][key] = langBlock.text;
        }
      }

      // Store metadata
      metadata[key] = {
        site: siteId,
        industry: siteIndustryMap[siteId] || 'unknown',
        type: enBlock.type,
        wordCount,
        locales: matchedLangs,
      };

      includedBlocks++;
    }
  }

  // Write outputs
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(REF_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(SOURCE_DIR, 'en.json'),
    JSON.stringify(enBlocks, null, 2)
  );

  for (const lang of TARGET_LANGS) {
    const langData = refBlocks[lang];
    if (Object.keys(langData).length > 0) {
      fs.writeFileSync(
        path.join(REF_DIR, `${lang}.json`),
        JSON.stringify(langData, null, 2)
      );
    }
  }

  fs.writeFileSync(META_FILE, JSON.stringify({
    version: '1.0.0',
    generated: new Date().toISOString(),
    stats: {
      totalRawBlocks: totalBlocks,
      includedBlocks,
      skippedNoEN,
      skippedShort,
      sourceStrings: Object.keys(enBlocks).length,
    },
    languageCoverage: Object.fromEntries(
      TARGET_LANGS.map(l => [l, Object.keys(refBlocks[l]).length])
    ),
    industryBreakdown: getIndustryBreakdown(metadata),
    typeBreakdown: getTypeBreakdown(metadata),
  }, null, 2));

  // Report
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Content-Bench Dataset Assembly');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Raw blocks scanned:  ${totalBlocks}`);
  console.log(`  Included blocks:     ${includedBlocks}`);
  console.log(`  Skipped (no EN):     ${skippedNoEN} sites`);
  console.log(`  Skipped (quality):   ${skippedShort} blocks`);
  console.log(`  Source strings (EN): ${Object.keys(enBlocks).length}`);
  console.log('');
  console.log('  Reference coverage:');
  for (const lang of TARGET_LANGS) {
    const count = Object.keys(refBlocks[lang]).length;
    if (count > 0) {
      console.log(`    ${lang}: ${count} strings`);
    }
  }
  console.log('');
  console.log('  Industry breakdown:');
  const indBreak = getIndustryBreakdown(metadata);
  for (const [ind, count] of Object.entries(indBreak).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${ind}: ${count}`);
  }
  console.log('');
  console.log('  Type breakdown:');
  const typeBreak = getTypeBreakdown(metadata);
  for (const [type, count] of Object.entries(typeBreak).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }
  console.log('');
  console.log(`  Output: source/en.json, reference/{lang}.json`);
  console.log(`  Metadata: metadata.json`);
  console.log('═══════════════════════════════════════════════════════\n');
}

function getIndustryBreakdown(metadata) {
  const counts = {};
  for (const m of Object.values(metadata)) {
    counts[m.industry] = (counts[m.industry] || 0) + 1;
  }
  return counts;
}

function getTypeBreakdown(metadata) {
  const counts = {};
  for (const m of Object.values(metadata)) {
    counts[m.type] = (counts[m.type] || 0) + 1;
  }
  return counts;
}

main();
