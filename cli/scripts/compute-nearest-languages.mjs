#!/usr/bin/env node

/**
 * compute-nearest-languages.mjs
 * ─────────────────────────────────────────────────────────────────
 * Computes the nearest living languages for each language card and
 * writes them as staged JSON (B4 of the champollion.db retirement —
 * this script no longer reads the legacy sqlite store or writes the
 * `nearest_languages` table).
 *
 * Inputs are the language cards in cli/shared/language-cards/, read
 * through normalizeCard() (the ONE card adapter — never bare
 * JSON.parse). Locale cards (identified by their `locale` block) and
 * the ISO special codes mis/mul/und/zxx are excluded.
 *
 * ANCESTRY KEY CHANGE — names → glottocodes:
 *   The legacy db stored `languages.ancestry` as Glottolog family
 *   NAMES (['Tupian','Arikem-Tupari',…]). Cards carry
 *   `classification.ancestry` as GLOTTOCODES (['algi1248','algo1256',…]).
 *   The shared-prefix-depth algorithm is identical over either key
 *   space, and codes are the better key (no name collisions across
 *   families). Consequence: the `relationship` labels keep the same
 *   VOCABULARY (same_genus / same_subfamily / same_family /
 *   same_macrofamily / geographic_only) and the same depth thresholds,
 *   but the depth of a glottocode chain differs from the old name
 *   chain, so per-pair labels and row totals shift versus the legacy
 *   78,013-row table. That delta is expected, not a bug.
 *
 * Algorithm (unchanged semantics):
 *   1. For each language, take its glottocode ancestry chain.
 *   2. Find other languages sharing the longest ancestry prefix.
 *   3. Sort by shared depth (descending), then geographic distance
 *      (ascending) using the Haversine formula.
 *   4. Keep the top MAX_NEIGHBORS (10) per language.
 *
 * For isolates (isIsolate or empty ancestry), only geographic
 * neighbors are computed.
 *
 * Output:
 *   mt-eval-arena/data/staging/tc-nearest.json
 *   { <code>: [ { code, name, relationship, sharedDepth, distanceKm }, … ], … }
 *   (neighbor `name` is read from the neighbor's own card)
 *
 * Usage:
 *   node scripts/compute-nearest-languages.mjs              # live run
 *   node scripts/compute-nearest-languages.mjs --dry-run    # preview
 *   node scripts/compute-nearest-languages.mjs --lang aqz   # single lang
 * ─────────────────────────────────────────────────────────────────
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readCard, listCodes, normalizeCard } from '../lib/cards/reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const OUT_DIR = path.join(__dirname, '..', '..', 'mt-eval-arena', 'data', 'staging');
const OUT_PATH = path.join(OUT_DIR, 'tc-nearest.json');

const SCRIPT_NAME = 'compute-nearest-languages.mjs';
const MAX_NEIGHBORS = 10;

// ISO special codes are not languages; they never get neighbors.
const SPECIAL_CODES = new Set(['mis', 'mul', 'und', 'zxx']);

// ── CLI args ───────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const langIdx = args.indexOf('--lang');
const SINGLE_LANG = langIdx !== -1 ? args[langIdx + 1] : null;

// ── Pre-flight check ──────────────────────────────────────────

if (!existsSync(CARDS_DIR)) {
  console.error(`ERROR: Language-card corpus not found at ${CARDS_DIR}`);
  console.error('Run the atlas build + cutover first.');
  process.exit(1);
}

// ── Haversine distance ────────────────────────────────────────

/**
 * Calculate distance between two geographic points in kilometers
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lng1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lng2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometers
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ── Shared ancestry computation ────────────────────────────────

/**
 * Count how many ancestry nodes two languages share, starting from
 * the root (index 0). Returns 0 if no shared ancestry.
 *
 * E.g. ['algi1248','algo1256','algo1257'] vs
 *      ['algi1248','algo1256','cent2054']
 * → shared depth = 2 (both share 'algi1248' and 'algo1256')
 */
function computeSharedDepth(ancestryA, ancestryB) {
  let depth = 0;
  const maxCheck = Math.min(ancestryA.length, ancestryB.length);

  for (let i = 0; i < maxCheck; i++) {
    if (ancestryA[i] === ancestryB[i]) {
      depth++;
    } else {
      break;
    }
  }

  return depth;
}

/**
 * Classify the relationship between two languages based on shared
 * ancestry depth relative to the total ancestry depth.
 *
 * @param {number} sharedDepth - Number of shared ancestry nodes
 * @param {number} depthA - Total ancestry depth of language A
 * @param {number} depthB - Total ancestry depth of language B
 * @returns {string} Relationship classification
 */
function classifyRelationship(sharedDepth, depthA, depthB) {
  if (sharedDepth === 0) return 'geographic_only';

  // If both share the deepest node of the shorter ancestry
  const minDepth = Math.min(depthA, depthB);

  // same_genus: shared depth reaches the deepest or second-deepest
  // level — these are closest relatives within the family tree
  if (sharedDepth >= minDepth - 1 && sharedDepth >= depthA - 1) {
    return 'same_genus';
  }

  // same_subfamily: shared depth is more than half of the total
  if (sharedDepth > depthA / 2) {
    return 'same_subfamily';
  }

  // same_family: share at least the root family node, and the
  // language has moderate depth
  if (sharedDepth >= 1 && depthA <= 3) {
    return 'same_family';
  }

  // same_macrofamily: for deep trees, sharing just the first 1-2
  // nodes means a distant macro-family connection
  if (sharedDepth <= 2 && depthA >= 4) {
    return 'same_macrofamily';
  }

  return 'same_family';
}

// ── Main ───────────────────────────────────────────────────────

console.log('═'.repeat(60));
console.log('  Compute Nearest Languages');
console.log('═'.repeat(60));
console.log(`  Script:     ${SCRIPT_NAME}`);
console.log(`  Cards:      ${CARDS_DIR}`);
console.log(`  Output:     ${OUT_PATH}`);
if (DRY_RUN) console.log('  ⚠️  DRY RUN — staging JSON will NOT be written');
if (SINGLE_LANG) console.log(`  🔍 Single language mode: ${SINGLE_LANG}`);
console.log('');

console.log('  Loading language-card corpus...');

// ── Step 1: Load cards, filter locales/specials, collect ancestry ──

/**
 * Pre-process all language cards: read via normalizeCard (the one
 * adapter — resolves attributed envelopes so `name` is a string) and
 * collect ancestry glottocodes + coordinates. We store everything in
 * memory so we can do pairwise comparisons efficiently.
 */
const langData = new Map(); // code → { name, ancestry, lat, lng, isIsolate }

// Index: for each ancestry node at each depth, track which language
// codes have that node. This avoids O(n²) comparisons.
// Structure: `${depth}:${glottocode}` → Set<code>
const ancestryIndex = new Map();

let localeCount = 0;
let withAncestry = 0;
let withCoords = 0;
let isolateCount = 0;

for (const code of listCodes({ dir: CARDS_DIR })) {
  if (SPECIAL_CODES.has(code)) continue;

  const card = normalizeCard(readCard(code, { dir: CARDS_DIR }));
  if (!card) continue;

  // A locale card is a projection of a language, not a language —
  // excluded by its locale block, never by code shape.
  if (card.locale && typeof card.locale.language === 'string') {
    localeCount++;
    continue;
  }

  const ancestry = Array.isArray(card.classification?.ancestry)
    ? card.classification.ancestry
    : [];
  const lat = typeof card.coordinates?.lat === 'number' ? card.coordinates.lat : null;
  const lng = typeof card.coordinates?.lng === 'number' ? card.coordinates.lng : null;

  const isIsolate = card.isIsolate === true || ancestry.length === 0;
  if (isIsolate) isolateCount++;
  if (ancestry.length > 0) withAncestry++;
  if (lat != null && lng != null) withCoords++;

  langData.set(code, {
    name: typeof card.name === 'string' ? card.name : null,
    ancestry,
    lat,
    lng,
    isIsolate,
  });

  // Build the ancestry index for fast lookups
  // Index each node at each depth level
  for (let depth = 0; depth < ancestry.length; depth++) {
    const node = ancestry[depth];
    const key = `${depth}:${node}`;
    if (!ancestryIndex.has(key)) {
      ancestryIndex.set(key, new Set());
    }
    ancestryIndex.get(key).add(code);
  }
}

console.log(`  Language cards loaded:      ${langData.size.toLocaleString()}`);
console.log(`  Locale cards excluded:      ${localeCount.toLocaleString()}`);
console.log(`  Languages with ancestry:    ${withAncestry.toLocaleString()}`);
console.log(`  Languages with coordinates: ${withCoords.toLocaleString()}`);
console.log(`  Isolates:                   ${isolateCount.toLocaleString()}`);
console.log('');

// ── Step 2: Compute nearest languages ─────────────────────────

console.log('  Computing nearest languages...');

let processedCount = 0;
let enrichedCount = 0;
let isolateEnrichedCount = 0;
let noNeighborsCount = 0;

// For progress reporting
const totalToProcess = SINGLE_LANG ? 1 : langData.size;
let lastProgressPct = -1;

/**
 * Find the nearest languages for a given language code.
 *
 * For languages with ancestry: find languages sharing the deepest
 * ancestry nodes, then sort by shared depth DESC, distance ASC.
 *
 * For isolates: find the geographically nearest languages regardless
 * of family affiliation.
 *
 * @param {string} code - The ISO 639-3 code
 * @param {Object} data - The language data from langData
 * @returns {Array} Top N nearest languages with metadata
 */
function findNearestLanguages(code, data) {
  const { ancestry, lat, lng, isIsolate } = data;
  const candidates = new Map(); // code → { sharedDepth, distanceKm }

  if (!isIsolate && ancestry.length > 0) {
    // ── Related language: find by shared ancestry ──────────

    // Collect candidate languages that share ANY ancestry node.
    // Start from the deepest level (most specific) for efficiency.
    const candidateCodes = new Set();

    for (let depth = ancestry.length - 1; depth >= 0; depth--) {
      const key = `${depth}:${ancestry[depth]}`;
      const matches = ancestryIndex.get(key);
      if (matches) {
        for (const matchCode of matches) {
          if (matchCode !== code) {
            candidateCodes.add(matchCode);
          }
        }
      }

      // Once we have enough candidates from deeper levels, stop
      // expanding to shallower levels unless we don't have enough
      if (candidateCodes.size >= 500 && depth < ancestry.length - 2) {
        break;
      }
    }

    // Compute shared depth and distance for each candidate
    for (const candidateCode of candidateCodes) {
      const candidateData = langData.get(candidateCode);
      if (!candidateData) continue;

      const sharedDepth = computeSharedDepth(ancestry, candidateData.ancestry);
      if (sharedDepth === 0) continue;

      // Calculate geographic distance if both have coordinates
      let distanceKm = null;
      if (lat != null && lng != null &&
          candidateData.lat != null && candidateData.lng != null) {
        distanceKm = Math.round(haversineKm(lat, lng, candidateData.lat, candidateData.lng));
      }

      candidates.set(candidateCode, { sharedDepth, distanceKm });
    }
  }

  // If we're an isolate OR we didn't find enough related languages,
  // add geographic neighbors
  if (candidates.size < MAX_NEIGHBORS && lat != null && lng != null) {
    // Find geographically close languages not already candidates
    // We use a rough bounding box first (±5 degrees ≈ ~550km) then
    // expand if needed
    const radiusDeg = isIsolate ? 10 : 5;

    for (const [otherCode, otherData] of langData) {
      if (otherCode === code) continue;
      if (candidates.has(otherCode)) continue;
      if (otherData.lat == null || otherData.lng == null) continue;

      // Quick bounding box filter (avoids expensive trig for distant langs)
      if (Math.abs(otherData.lat - lat) > radiusDeg) continue;
      if (Math.abs(otherData.lng - lng) > radiusDeg) continue;

      const distanceKm = Math.round(haversineKm(lat, lng, otherData.lat, otherData.lng));

      // Only include if within a reasonable geographic radius
      const maxDistKm = isIsolate ? 1500 : 800;
      if (distanceKm > maxDistKm) continue;

      // Check if this language shares any ancestry at all
      const sharedDepth = computeSharedDepth(ancestry, otherData.ancestry);

      candidates.set(otherCode, {
        sharedDepth,
        distanceKm,
      });

      // Cap how many geographic neighbors we scan
      if (candidates.size >= 200) break;
    }
  }

  // ── Sort: shared depth DESC, then distance ASC ──────────

  const sorted = [...candidates.entries()]
    .sort((a, b) => {
      // Primary sort: shared ancestry depth (deeper = more related)
      const depthDiff = b[1].sharedDepth - a[1].sharedDepth;
      if (depthDiff !== 0) return depthDiff;

      // Secondary sort: geographic distance (closer = better)
      // Treat null distance as very far
      const distA = a[1].distanceKm ?? 99999;
      const distB = b[1].distanceKm ?? 99999;
      return distA - distB;
    })
    .slice(0, MAX_NEIGHBORS);

  // ── Build result with relationship labels ───────────────

  return sorted.map(([neighborCode, { sharedDepth, distanceKm }]) => {
    const neighborData = langData.get(neighborCode);
    const relationship = classifyRelationship(
      sharedDepth,
      ancestry.length,
      neighborData.ancestry.length
    );

    return {
      code: neighborCode,
      name: neighborData.name,
      relationship,
      sharedDepth,
      distanceKm,
    };
  });
}

// ── Step 3: Process all languages ─────────────────────────────

// Collect results before writing, so we can handle dry-run cleanly
const results = new Map(); // code → neighbors[]

for (const [code, data] of langData) {
  // If filtering to a single language, skip others
  if (SINGLE_LANG && code !== SINGLE_LANG) continue;

  const neighbors = findNearestLanguages(code, data);
  processedCount++;

  if (neighbors.length > 0) {
    results.set(code, neighbors);
    if (data.isIsolate) isolateEnrichedCount++;
    enrichedCount++;
  } else {
    noNeighborsCount++;
  }

  // Progress reporting every 5%
  const pct = Math.floor((processedCount / totalToProcess) * 100);
  if (pct !== lastProgressPct && pct % 5 === 0 && !SINGLE_LANG) {
    process.stdout.write(`\r  Progress: ${pct}% (${processedCount.toLocaleString()} / ${totalToProcess.toLocaleString()})`);
    lastProgressPct = pct;
  }
}

if (!SINGLE_LANG) {
  process.stdout.write(`\r  Progress: 100% (${processedCount.toLocaleString()} / ${totalToProcess.toLocaleString()})\n`);
}

console.log('');

// ── Step 4: Write staging JSON or show dry-run preview ────────

let totalRows = 0;
for (const neighbors of results.values()) totalRows += neighbors.length;

if (DRY_RUN) {
  console.log('  DRY RUN — Preview:');
  console.log('  ' + '─'.repeat(50));

  // Show specific languages if requested, or first 3 + aqz/crk
  const previewCodes = SINGLE_LANG
    ? [SINGLE_LANG]
    : ['aqz', 'crk', ...([...results.keys()].slice(0, 3))];

  for (const code of [...new Set(previewCodes)]) {
    const neighbors = results.get(code);
    const data = langData.get(code);
    if (!neighbors || !data) continue;

    console.log(`\n  ${code} (${data.name}):`);
    for (const n of neighbors) {
      const distStr = n.distanceKm != null ? `${n.distanceKm}km` : 'N/A';
      console.log(`    ${n.code.padEnd(6)} ${(n.name || '???').padEnd(25)} ` +
                  `depth=${n.sharedDepth} dist=${distStr.padEnd(8)} ${n.relationship}`);
    }
  }

  console.log('');
  console.log(`  Re-run without --dry-run to write ${OUT_PATH}`);
} else {
  console.log(`  Writing staged nearest-languages JSON...`);

  mkdirSync(OUT_DIR, { recursive: true });
  const out = {};
  for (const [code, neighbors] of results) out[code] = neighbors;
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + '\n');

  console.log(`  Wrote ${OUT_PATH}`);
  console.log(`  Rows written: ${totalRows.toLocaleString()}`);
}

// ── Step 5: Report ─────────────────────────────────────────────

// Count relationship type distribution
const relDist = {};
for (const neighbors of results.values()) {
  for (const n of neighbors) {
    relDist[n.relationship] = (relDist[n.relationship] || 0) + 1;
  }
}

console.log('');
console.log('  RESULTS:');
console.log('  ' + '─'.repeat(45));
console.log(`  Languages processed:          ${processedCount.toLocaleString().padStart(6)}`);
console.log(`  Languages with neighbors:     ${enrichedCount.toLocaleString().padStart(6)}`);
console.log(`  Isolates with geo-neighbors:  ${isolateEnrichedCount.toLocaleString().padStart(6)}`);
console.log(`  Languages with no neighbors:  ${noNeighborsCount.toLocaleString().padStart(6)}`);
console.log(`  Total neighbor rows:          ${totalRows.toLocaleString().padStart(6)}`);
console.log('');
console.log('  RELATIONSHIP DISTRIBUTION:');
console.log('  ' + '─'.repeat(45));

const sortedRels = Object.entries(relDist).sort((a, b) => b[1] - a[1]);
for (const [rel, count] of sortedRels) {
  const bar = '█'.repeat(Math.round(count / 500));
  console.log(`  ${rel.padEnd(20)} ${count.toLocaleString().padStart(7)}  ${bar}`);
}

// Show example output for aqz and crk
if (!SINGLE_LANG) {
  for (const code of ['aqz', 'crk']) {
    const neighbors = results.get(code);
    const data = langData.get(code);
    if (!neighbors || !data) continue;

    console.log('');
    console.log(`  EXAMPLE — ${code} (${data.name}):`);
    console.log('  ' + '─'.repeat(45));
    for (const n of neighbors) {
      const distStr = n.distanceKm != null ? `${n.distanceKm}km` : 'N/A';
      console.log(`    ${n.code.padEnd(6)} ${(n.name || '???').padEnd(28)} ` +
                  `depth=${n.sharedDepth} dist=${distStr.padEnd(8)} ${n.relationship}`);
    }
  }
}

console.log('');
console.log('═'.repeat(60));
