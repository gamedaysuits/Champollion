#!/usr/bin/env node

/**
 * derive-word-order-dominant.mjs
 * ─────────────────────────────────────────────────────────────────
 * Re-derives `typologicalProfile.wordOrderDominant` across all cards.
 *
 * WHY: the original Grambank-based derivation misread the Grambank
 * word-order features (GB130/131/134/136 treated as OV/VO/SV/VS —
 * they are actually intransitive-S/V-order, verb-initial-attested,
 * same-order-in-subordinate-clauses, and order-fixed) and promoted
 * ATTESTED orders to DOMINANT ones. French ended up "VOS".
 *
 * Grambank has no dominance feature — its GB131/GB132/GB133 only say
 * which orders are attested as pragmatically unmarked. WALS 81A
 * ("Order of Subject, Object and Verb") IS a dominance feature.
 *
 * RULES applied per card with a typologicalProfile:
 *   1. WALS 81A value exists (by ISO code or glottocode)
 *        → wordOrderDominant = the 81A dominance value
 *          (81A-7 "No dominant order" → 'flexible')
 *        → merge 'wals-2024' into _fieldSources.typologicalProfile
 *   2. No WALS 81A and the profile's word order came from Grambank
 *      (profile.source grambank-*)
 *        → wordOrderDominant = null  (no dominance claim possible)
 *   3. No WALS 81A and the value came from a genuine dominance source
 *      (e.g. APiCS "Order of subject, object and verb")
 *        → left untouched
 *
 * Usage:
 *   node scripts/derive-word-order-dominant.mjs --dry-run
 *   node scripts/derive-word-order-dominant.mjs
 * ─────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CARDS_DIR = path.join(ROOT, 'shared', 'language-cards');

const DRY_RUN = process.argv.includes('--dry-run');

// ── WALS 81A lookup (dominant order of S, O and V) ─────────────
const WORD_ORDER_MAP = {
  '81A-1': 'SOV', '81A-2': 'SVO', '81A-3': 'VSO',
  '81A-4': 'VOS', '81A-5': 'OVS', '81A-6': 'OSV',
  '81A-7': 'flexible', // WALS: "No dominant order"
};

const walsLangs = fs.readFileSync(path.join(ROOT, 'data/wals/languages.csv'), 'utf8').split('\n');
const walsToIso = {};
const walsToGlotto = {};
for (let i = 1; i < walsLangs.length; i++) {
  const cols = walsLangs[i].split(',');
  if (cols.length < 7) continue;
  const walsId = cols[0]?.trim();
  if (!walsId) continue;
  if (cols[5]?.trim()) walsToGlotto[walsId] = cols[5].trim();
  if (cols[6]?.trim()) walsToIso[walsId] = cols[6].trim();
}

const iso81A = {};
const glotto81A = {};
const valueLines = fs.readFileSync(path.join(ROOT, 'data/wals/values.csv'), 'utf8').split('\n');
for (let i = 1; i < valueLines.length; i++) {
  const cols = valueLines[i].split(',');
  if (cols.length < 5) continue;
  if (cols[2]?.trim() !== '81A') continue;
  const walsId = cols[1]?.trim();
  const codeId = cols[4]?.trim();
  const order = WORD_ORDER_MAP[codeId];
  if (!walsId || !order) continue;
  if (walsToIso[walsId]) iso81A[walsToIso[walsId]] = order;
  if (walsToGlotto[walsId]) glotto81A[walsToGlotto[walsId]] = order;
}
console.log(`  WALS 81A dominance values: ${Object.keys(iso81A).length} ISO-indexed, ` +
            `${Object.keys(glotto81A).length} glottocode-indexed`);
if (DRY_RUN) console.log('  ⚠️  DRY RUN — no files will be modified');

// ── Re-derive across all cards ─────────────────────────────────
const files = fs.readdirSync(CARDS_DIR)
  .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

let scanned = 0;
let setFromWals = 0;      // value now backed by WALS 81A
let clearedGrambank = 0;  // grambank-derived dominance claim removed
let keptOtherSource = 0;  // non-grambank dominance source left alone
let unchanged = 0;
let changed = 0;
const changedExamples = [];
const newDist = {};

for (const filename of files) {
  const filePath = path.join(CARDS_DIR, filename);
  let card;
  try {
    card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { continue; }

  const tp = card.typologicalProfile;
  if (!tp || typeof tp !== 'object') continue;
  scanned++;

  const old = tp.wordOrderDominant ?? null;
  const wals = iso81A[card.code] || (card.glottocode ? glotto81A[card.glottocode] : null) || null;

  let next = old;
  let action = null;

  if (wals) {
    next = wals;
    action = 'wals';
  } else if (old !== null && typeof tp.source === 'string' && tp.source.startsWith('grambank')) {
    // Grambank attested-order features cannot support a dominance claim.
    next = null;
    action = 'clear-grambank';
  } else if (old !== null) {
    action = 'keep-other';
  }

  if (action === 'wals') setFromWals++;
  if (action === 'clear-grambank') clearedGrambank++;
  if (action === 'keep-other') keptOtherSource++;
  if (next) newDist[next] = (newDist[next] || 0) + 1;

  if (next === old) {
    unchanged++;
    // Still ensure provenance is stamped when the value is WALS-backed.
    if (action !== 'wals') continue;
  }

  if (next !== old) {
    changed++;
    if (changedExamples.length < 12) {
      changedExamples.push(`${card.code}: ${old ?? '∅'} → ${next ?? '∅'} (${action})`);
    }
    if ('wordOrderDominant' in tp || next !== null) {
      tp.wordOrderDominant = next;
    }
  }

  // Stamp provenance: merge wals-2024 into the composite source string.
  let stamped = false;
  if (action === 'wals') {
    if (!card._fieldSources || typeof card._fieldSources !== 'object' || Array.isArray(card._fieldSources)) {
      card._fieldSources = {};
    }
    const cur = card._fieldSources.typologicalProfile;
    if (typeof cur === 'string' && cur.length > 0) {
      if (!cur.split('+').includes('wals-2024') && !cur.split('+').includes('wals-2020')) {
        card._fieldSources.typologicalProfile = cur + '+wals-2024';
        stamped = true;
      }
    } else if (!cur) {
      card._fieldSources.typologicalProfile = 'wals-2024';
      stamped = true;
    }
    if (!Array.isArray(card.dataSources)) card.dataSources = [];
    if (!card.dataSources.includes('wals-2024') && !card.dataSources.includes('wals-2020')) {
      card.dataSources.push('wals-2024');
      stamped = true;
    }
  }

  if (next === old && !stamped) continue;

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n');
  }
}

console.log(`
  RESULTS (${DRY_RUN ? 'DRY RUN' : 'LIVE'}):
  ─────────────────────────────────────
  Cards with typologicalProfile:  ${scanned.toLocaleString().padStart(6)}
  wordOrderDominant from WALS:    ${setFromWals.toLocaleString().padStart(6)}
  Grambank false claims cleared:  ${clearedGrambank.toLocaleString().padStart(6)}
  Kept (non-grambank dominance):  ${keptOtherSource.toLocaleString().padStart(6)}
  Cards changed:                  ${changed.toLocaleString().padStart(6)}
  Cards unchanged:                ${unchanged.toLocaleString().padStart(6)}

  NEW DISTRIBUTION:`);
for (const [order, count] of Object.entries(newDist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${order.padEnd(12)} ${count.toString().padStart(5)}`);
}
console.log('\n  SAMPLE CHANGES:');
for (const ex of changedExamples) console.log(`    ${ex}`);
