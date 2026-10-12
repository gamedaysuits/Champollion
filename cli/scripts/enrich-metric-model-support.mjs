#!/usr/bin/env node

/**
 * enrich-metric-model-support.mjs
 *
 * Adds the `metricModelSupport` field to every language card.
 * This field records which MT metric models have specific support
 * for a given language — critical for knowing which automatic
 * evaluation metrics are valid for a language pair.
 *
 * Two metric models are tracked:
 *   - XLM-R: The backbone encoder for COMET/xCOMET. Languages in
 *     the top ~80 of XLM-R's CommonCrawl training data get "high"
 *     tier, meaning COMET scores are more reliable.
 *   - AfriCOMET: A COMET variant fine-tuned on African language
 *     human judgments by the Masakhane community. Languages with
 *     AfriCOMET support should prefer it over vanilla COMET.
 *
 * Field placement: inserted immediately after `methodSupport` in
 * JSON key order, to keep metric-related fields grouped together.
 *
 * Sources:
 *   - xlmr-conneau-2020: Conneau et al., "Unsupervised Cross-lingual
 *     Representation Learning at Scale", ACL 2020
 *   - africomet-wan-2022: Wan et al., "AfriCOMET: An Automatic MT
 *     Evaluation Metric for African Languages", Masakhane 2022
 *
 * Usage:
 *   node scripts/enrich-metric-model-support.mjs              # live run
 *   node scripts/enrich-metric-model-support.mjs --dry-run     # preview only
 *   node scripts/enrich-metric-model-support.mjs --lang swh    # single language
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── CLI flags ──────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const langIdx = args.indexOf('--lang');
const SINGLE_LANG = langIdx !== -1 ? args[langIdx + 1] : null;

// ── XLM-R high-resource languages ──────────────────────────
// These are the top ~80 languages by CommonCrawl volume in the
// XLM-R training data. COMET/xCOMET scores are most reliable
// for these languages because the underlying encoder has strong
// representations for them.
const XLMR_HIGH_CODES = new Set([
  'eng', 'fra', 'deu', 'spa', 'ita', 'por', 'nld', 'pol', 'rus', 'ukr',
  'ces', 'ron', 'bul', 'hrv', 'slk', 'slv', 'srp', 'hun', 'fin', 'swe',
  'dan', 'nob', 'nno', 'est', 'lav', 'lit', 'ell', 'tur', 'arb', 'ara',
  'heb', 'pes', 'urd', 'hin', 'ben', 'tam', 'tel', 'mal', 'kan', 'guj',
  'mar', 'pan', 'nep', 'sin', 'tha', 'lao', 'khm', 'vie', 'ind', 'zsm',
  'tgl', 'cmn', 'jpn', 'kor', 'kat', 'hye', 'aze', 'kaz', 'uzb', 'kir',
  'mon', 'mya', 'swh', 'afr', 'als', 'mkd', 'bos', 'mlt', 'isl', 'gle',
  'cym', 'eus', 'glg', 'cat', 'oci', 'ast', 'lat',
]);

// ── AfriCOMET supported languages ──────────────────────────
// AfriCOMET was trained on human judgment data from the Masakhane
// community. For these languages, AfriCOMET provides more
// culturally-grounded metric scores than vanilla COMET.
const AFRICOMET_CODES = new Set([
  'yor', 'ibo', 'hau', 'swa', 'swh', 'swc', 'zul', 'xho', 'sot', 'tsn',
  'nso', 'ssw', 'tso', 'ven', 'nbl', 'lin', 'lug', 'kin', 'run', 'nya',
  'sna', 'wol', 'bam', 'ewe', 'twi', 'aka', 'ful', 'fuc', 'mos',
  'amh', 'tir', 'orm', 'som', 'luo', 'pcm',
]);

/**
 * Build the metricModelSupport object for a given ISO 639-3 code.
 * Returns null if the language has no special metric model support,
 * or an object with xlmr and/or africomet entries.
 */
function buildMetricModelSupport(isoCode) {
  const hasXlmr = XLMR_HIGH_CODES.has(isoCode);
  const hasAfricomet = AFRICOMET_CODES.has(isoCode);

  // No special support — return null for uniform shape
  if (!hasXlmr && !hasAfricomet) {
    return null;
  }

  const support = {};

  if (hasXlmr) {
    support.xlmr = {
      tier: 'high',
      note: 'Top-100 XLM-R training language by CommonCrawl volume',
      source: 'xlmr-conneau-2020',
    };
  }

  if (hasAfricomet) {
    support.africomet = {
      supported: true,
      model: 'masakhane/africomet-mtl',
      note: 'Human judgment training data from Masakhane community',
      source: 'africomet-wan-2022',
    };
  }

  return support;
}

/**
 * Insert a key-value pair into a plain object right after a target key.
 * If the target key is not found, appends at the end.
 *
 * Why: JSON.stringify preserves insertion order of object keys. We want
 * metricModelSupport to appear right after methodSupport in the file
 * for logical grouping of metric-related fields.
 */
function insertAfterKey(obj, afterKey, newKey, newValue) {
  const entries = Object.entries(obj);
  const result = {};
  let inserted = false;

  for (const [key, value] of entries) {
    // Skip if the key already exists (we'll re-insert it in the right place)
    if (key === newKey) continue;

    result[key] = value;

    if (key === afterKey) {
      result[newKey] = newValue;
      inserted = true;
    }
  }

  // Fallback: if afterKey wasn't found, append at end
  if (!inserted) {
    result[newKey] = newValue;
  }

  return result;
}

// ── Process cards ──────────────────────────────────────────
const cardsDir = path.join(ROOT, 'shared/language-cards');
let files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'));
if (SINGLE_LANG) files = files.filter(f => f === `${SINGLE_LANG}.json`);

console.log(`\n  enrich-metric-model-support.mjs`);
console.log(`  ${'─'.repeat(50)}`);
console.log(`  Card files found:  ${files.length}`);
console.log(`  XLM-R codes:       ${XLMR_HIGH_CODES.size}`);
console.log(`  AfriCOMET codes:   ${AFRICOMET_CODES.size}`);
if (DRY_RUN) console.log('  ⚠️  DRY RUN — no files will be modified');
console.log();

let totalProcessed = 0;
let xlmrOnlyCount = 0;
let africometOnlyCount = 0;
let bothCount = 0;
let nullCount = 0;
let errorCount = 0;

for (const file of files) {
  const filePath = path.join(cardsDir, file);

  let card;
  try {
    card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (parseError) {
    console.error(`  ✗ Failed to parse ${file}: ${parseError.message}`);
    errorCount++;
    continue;
  }

  const isoCode = card.code;
  const metricSupport = buildMetricModelSupport(isoCode);

  // Insert metricModelSupport right after methodSupport in key order
  const updatedCard = insertAfterKey(card, 'methodSupport', 'metricModelSupport', metricSupport);

  // Track counts for the summary report
  const hasXlmr = metricSupport !== null && metricSupport.xlmr !== undefined;
  const hasAfricomet = metricSupport !== null && metricSupport.africomet !== undefined;

  if (hasXlmr && hasAfricomet) {
    bothCount++;
  } else if (hasXlmr) {
    xlmrOnlyCount++;
  } else if (hasAfricomet) {
    africometOnlyCount++;
  } else {
    nullCount++;
  }

  if (!DRY_RUN) {
    // Write back with 2-space indent and trailing newline (project convention)
    fs.writeFileSync(filePath, JSON.stringify(updatedCard, null, 2) + '\n');
  }

  totalProcessed++;
}

// ── Report ─────────────────────────────────────────────────
console.log(`  RESULTS:`);
console.log(`  ${'─'.repeat(50)}`);
console.log(`  Cards processed:             ${totalProcessed.toLocaleString().padStart(6)}`);
console.log(`  Errors:                      ${errorCount.toLocaleString().padStart(6)}`);
console.log();
console.log(`  XLM-R only:                  ${xlmrOnlyCount.toLocaleString().padStart(6)}`);
console.log(`  AfriCOMET only:              ${africometOnlyCount.toLocaleString().padStart(6)}`);
console.log(`  Both (XLM-R + AfriCOMET):    ${bothCount.toLocaleString().padStart(6)}`);
console.log(`  Null (no special support):   ${nullCount.toLocaleString().padStart(6)}`);
console.log();
console.log(`  Total tagged (non-null):     ${(xlmrOnlyCount + africometOnlyCount + bothCount).toLocaleString().padStart(6)}`);
console.log(`  ${'═'.repeat(50)}\n`);
