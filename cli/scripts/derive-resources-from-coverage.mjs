#!/usr/bin/env node

/**
 * derive-resources-from-coverage.mjs
 * ────────────────────────────────────────────────────────────────
 * Populates the `resources` field by aggregating known resource
 * indicators already present in the card data or derivable from
 * it. Instead of requiring per-language research, this uses:
 *
 *   1. NLLB-200 coverage → MT training data exists
 *   2. FLORES+ coverage → MT evaluation data exists
 *   3. CLDR locale → digital locale data exists
 *   4. PHOIBLE coverage → phonological documentation exists
 *   5. WALS/Grambank coverage → grammatical documentation exists
 *   6. Wikidata linkage → Wikipedia/Wiktionary likely exists
 *   7. methodSupport → verified API support
 *
 * Each resource entry cites its derivation source.
 *
 * Merge-only: never overwrites existing resources.
 *
 * Usage:
 *   node scripts/derive-resources-from-coverage.mjs
 *   node scripts/derive-resources-from-coverage.mjs --dry-run
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const DATA_DIR = path.join(CLI_ROOT, 'data');
const DRY_RUN = process.argv.includes('--dry-run');

// Load known NLLB-200 language codes
function loadListFile(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const content = fs.readFileSync(filePath, 'utf-8');
  return new Set(content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')));
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Resource Derivation from Coverage Indicators');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  // Detect available lookup sets
  // NLLB language list
  const nllbDir = path.join(DATA_DIR, 'nllb');
  let nllbCodes = new Set();
  if (fs.existsSync(nllbDir)) {
    const files = fs.readdirSync(nllbDir).filter(f => f.endsWith('.txt') || f.endsWith('.csv'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(nllbDir, f), 'utf-8');
      for (const line of content.split('\n')) {
        const code = line.trim().split(/[\t,]/)[0].trim();
        if (code && code.length >= 3) nllbCodes.add(code);
      }
    }
  }
  console.log(`  NLLB codes loaded: ${nllbCodes.size}`);

  // FLORES+ language list
  const floresDir = path.join(DATA_DIR, 'flores');
  let floresCodes = new Set();
  if (fs.existsSync(floresDir)) {
    const files = fs.readdirSync(floresDir).filter(f => f.endsWith('.txt') || f.endsWith('.csv'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(floresDir, f), 'utf-8');
      for (const line of content.split('\n')) {
        const code = line.trim().split(/[\t,]/)[0].trim();
        if (code && code.length >= 3) floresCodes.add(code);
      }
    }
  }
  console.log(`  FLORES+ codes loaded: ${floresCodes.size}`);

  // CLDR locales (from the misc-full package)
  const cldrDir = path.join(CLI_ROOT, 'node_modules', 'cldr-misc-full', 'main');
  let cldrLocales = new Set();
  if (fs.existsSync(cldrDir)) {
    for (const d of fs.readdirSync(cldrDir)) {
      const base = d.split('-')[0];
      if (base.length >= 2) cldrLocales.add(base);
    }
  }
  console.log(`  CLDR locale bases: ${cldrLocales.size}`);

  // Process cards
  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let enriched = 0;

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    // Skip cards that already have resources
    if (card.resources !== null) continue;

    const iso3 = card.iso639_3 || card.code;
    if (!iso3) continue;

    const resources = [];

    // 1. Check NLLB-200 coverage
    const nllbCode = card.nllbCode || card.methodSupport?.nllb?.code;
    if (nllbCode && nllbCodes.has(nllbCode)) {
      resources.push({
        type: 'parallel-corpus',
        name: 'NLLB-200 training data',
        description: `Included in Meta NLLB-200 as code ${nllbCode}. Parallel corpus used for training multilingual MT models.`,
        url: 'https://github.com/facebookresearch/fairseq/tree/nllb',
        source: 'nllb-200',
      });
    }

    // 2. Check FLORES+ coverage
    const floresCode = card.floresCode;
    if (floresCode && floresCodes.has(floresCode)) {
      resources.push({
        type: 'evaluation-dataset',
        name: 'FLORES+ evaluation set',
        description: `Included in FLORES+ benchmark as code ${floresCode}. Multi-domain evaluation sentences for MT quality measurement.`,
        url: 'https://github.com/openlanguagedata/flores',
        source: 'flores-plus',
      });
    }

    // 3. Check CLDR locale coverage
    const bcp47Base = (card.bcp47 || '').split('-')[0];
    if (bcp47Base && cldrLocales.has(bcp47Base)) {
      resources.push({
        type: 'locale-data',
        name: 'Unicode CLDR locale',
        description: `Has CLDR locale data: number formatting, date/time patterns, pluralization rules, and character sets.`,
        url: `https://github.com/unicode-org/cldr`,
        source: 'cldr',
      });
    }

    // 4. Check phonological documentation (PHOIBLE)
    const phon = card.encyclopedic?.phonology;
    if (phon && phon.source === 'phoible-2.0') {
      resources.push({
        type: 'phonological-inventory',
        name: 'PHOIBLE phonological inventory',
        description: `Documented phonological inventory: ${phon.consonantCount || '?'} consonants, ${phon.vowelCount || '?'} vowels${phon.toneCount ? `, ${phon.toneCount} tones` : ''}.`,
        url: 'https://phoible.org/',
        source: 'phoible-2.0',
      });
    }

    // 5. Check grammatical documentation (WALS/Grambank)
    const typ = card.encyclopedic?.typology;
    if (typ) {
      const typSources = typ._sources || [];
      if (typSources.includes('wals-2024')) {
        resources.push({
          type: 'grammatical-description',
          name: 'WALS typological profile',
          description: 'Typological features documented in the World Atlas of Language Structures (word order, morphology, phonology, nominal categories).',
          url: 'https://wals.info/',
          source: 'wals-2024',
        });
      }
      if (typSources.includes('grambank-1.0.3')) {
        resources.push({
          type: 'grammatical-description',
          name: 'Grambank grammatical features',
          description: 'Grammatical features documented in Grambank (195 binary features covering phonology, morphology, syntax).',
          url: 'https://grambank.clld.org/',
          source: 'grambank-1.0.3',
        });
      }
    }

    // 6. Check MT API support (only dedicated translation APIs, not generic LLM)
    // Why exclude 'llm': llm.supported is true for ALL 7,927 languages because
    // you can always send text to GPT-4 and get *something* back. That's not
    // meaningful coverage — it says nothing about translation quality. Only
    // dedicated MT APIs (Google Translate, DeepL, Microsoft, NLLB, LibreTranslate)
    // represent genuine, verified translation support worth citing as a resource.
    const ms = card.methodSupport;
    if (ms) {
      const REAL_MT_APIS = ['googleTranslate', 'deepl', 'microsoft', 'nllb', 'libreTranslate'];
      const apis = REAL_MT_APIS.filter(k => ms[k]?.supported === true);
      for (const api of apis) {
        resources.push({
          type: 'mt-api',
          name: `${api} translation API`,
          description: `Supported by ${api} for machine translation (verified ${ms[api].verifiedDate || 'date unknown'}).`,
          source: `api-verification`,
        });
      }
    }

    if (resources.length === 0) continue;

    card.resources = resources;

    // Source attribution
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.resources = 'derived-from-coverage-indicators';

    enriched++;
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  console.log(`\n  RESULTS:`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Cards enriched with resources: ${enriched.toLocaleString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
