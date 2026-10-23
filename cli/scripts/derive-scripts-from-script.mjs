#!/usr/bin/env node

/**
 * derive-scripts-from-script.mjs
 * ────────────────────────────────────────────────────────────────
 * Creates a minimal `scripts` array entry from the card's `script`
 * field when `scripts` is empty but `script` is populated.
 *
 * This is a derivation script (uses only existing card data).
 *
 * Source: derived-from-script (using the existing `script` code and
 *         the `_fieldSources.script` to determine the original source)
 *
 * Usage:
 *   node scripts/derive-scripts-from-script.mjs
 *   node scripts/derive-scripts-from-script.mjs --dry-run
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const DRY_RUN = process.argv.includes('--dry-run');

// ISO 15924 script names (common ones)
const SCRIPT_NAMES = {
  'Latn': 'Latin', 'Cyrl': 'Cyrillic', 'Arab': 'Arabic', 'Deva': 'Devanagari',
  'Hans': 'Simplified Chinese', 'Hant': 'Traditional Chinese', 'Kore': 'Korean',
  'Jpan': 'Japanese', 'Thai': 'Thai', 'Geor': 'Georgian', 'Armn': 'Armenian',
  'Grek': 'Greek', 'Hebr': 'Hebrew', 'Beng': 'Bengali', 'Guru': 'Gurmukhi',
  'Gujr': 'Gujarati', 'Orya': 'Odia', 'Taml': 'Tamil', 'Telu': 'Telugu',
  'Knda': 'Kannada', 'Mlym': 'Malayalam', 'Sinh': 'Sinhala', 'Mymr': 'Myanmar',
  'Tibt': 'Tibetan', 'Khmr': 'Khmer', 'Lao':  'Lao', 'Ethi': 'Ethiopic',
  'Cans': 'Canadian Syllabics', 'Cher': 'Cherokee', 'Hang': 'Hangul',
  'Bopo': 'Bopomofo', 'Kana': 'Katakana', 'Hira': 'Hiragana',
  'Thaa': 'Thaana', 'Syrc': 'Syriac', 'Mand': 'Mandaic', 'Nkoo': "N'Ko",
  'Tfng': 'Tifinagh', 'Vaii': 'Vai', 'Bamu': 'Bamum', 'Java': 'Javanese',
  'Bali': 'Balinese', 'Sund': 'Sundanese', 'Batk': 'Batak', 'Bugi': 'Buginese',
  'Tglg': 'Tagalog', 'Hano': 'Hanunoo', 'Buhd': 'Buhid', 'Tagb': 'Tagbanwa',
  'Ogam': 'Ogham', 'Runr': 'Runic', 'Osma': 'Osmanya', 'Adlm': 'Adlam',
  'Yezi': 'Yezidi', 'Wara': 'Warang Citi', 'Olck': 'Ol Chiki',
  'Limb': 'Limbu', 'Lepc': 'Lepcha', 'Mtei': 'Meetei Mayek',
};

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Scripts Array Derivation');
  console.log('  Creates scripts[] from existing script code');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let derived = 0;

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    // Only act on cards with script but no scripts array
    if (!card.script) continue;
    if (Array.isArray(card.scripts) && card.scripts.length > 0) continue;

    const scriptCode = card.script;
    const scriptName = SCRIPT_NAMES[scriptCode] || scriptCode;

    // Determine source from the _fieldSources if available,
    // otherwise fall back to dataSources
    const ds = Array.isArray(card.dataSources) ? card.dataSources : [];
    let source = 'derived-from-script';
    if (card._fieldSources?.script) {
      source = card._fieldSources.script;
    } else if (ds.includes('wikidata')) {
      source = 'wikidata-P282';
    } else if (ds.includes('linguameta-2024')) {
      source = 'linguameta-2024';
    }

    card.scripts = [{
      code: scriptCode,
      name: scriptName,
      source: source,
    }];

    derived++;
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  console.log(`  RESULTS:`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Scripts arrays derived: ${derived.toLocaleString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
