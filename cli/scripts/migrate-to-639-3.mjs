#!/usr/bin/env node

/**
 * migrate-to-639-3.mjs
 *
 * One-shot migration script for the Champollion language card system.
 * Migrates all language cards to use ISO 639-3 as the canonical code.
 *
 * What this script does:
 * 1. Deletes 639-1 duplicate files (where 639-3 version already has the data)
 * 2. Merges macrolanguage hand-crafted content into default varieties
 * 3. Renames regional variant files to 639-3 base codes
 * 4. De-aliases Filipino from Tagalog
 * 5. Auto-wires `extends` from classification.ancestry data
 * 6. Normalizes `macrolanguage` fields to 639-3 codes
 * 7. Fixes broken Cree/Bantu/Celtic/Polynesian inheritance
 *
 * Usage:
 *   node scripts/migrate-to-639-3.mjs --dry-run    # Preview changes
 *   node scripts/migrate-to-639-3.mjs              # Execute
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.resolve(__dirname, '../shared/language-cards');
const GENERA_DIR = path.join(CARDS_DIR, 'genera');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ─── Logging ──────────────────────────────────────────────────────────
const report = {
  deletedFiles: [],
  mergedMacrolanguages: [],
  renamedRegionals: [],
  wiredExtends: [],
  normalizedMacrolanguage: [],
  dealiased: [],
  fixedInheritance: [],
  errors: [],
};

function log(msg) { console.log(msg); }
function verbose(msg) { if (VERBOSE) console.log('  [verbose] ' + msg); }
function warn(msg) { console.warn('  ⚠️  ' + msg); }

// ─── ISO 639-1 → 639-3 Mapping ──────────────────────────────────────
// Only for codes that have BOTH a 639-1 and 639-3 file present.
// Built dynamically from the cards themselves.

// ─── Macrolanguage → Default Variety Mapping ─────────────────────────
// Maps the 639-1 macrolanguage code to its default 639-3 individual variety.
const MACROLANGUAGE_DEFAULTS = {
  // 639-1 code → { macroFile639_1, macroFile639_3, defaultVariety639_3 }
  'zh': { macro639_3: 'zho', default: 'cmn' },
  'ar': { macro639_3: 'ara', default: 'arb' },
  'ms': { macro639_3: 'msa', default: 'zsm' },
  'fa': { macro639_3: 'fas', default: 'pes' },
  'no': { macro639_3: 'nor', default: 'nob' },
  'sw': { macro639_3: 'swa', default: 'swh' },
  'sq': { macro639_3: 'sqi', default: 'als' },
  // Kurdish and Lahnda have NO default — user must specify
};

// Additional macrolanguage file handling for Norwegian
// nb.json is the hand-crafted one, nor.json is the macrolanguage
const EXTRA_MACROLANGUAGE_FILES = {
  'nb': { macro639_3: 'nor', default: 'nob' },
};

// Regional variant renames: old filename → new filename
// Only includes files that actually exist on disk
const REGIONAL_RENAMES = {
  'fr-CA.json':  'fra-CA.json',   // Both exist; script merges into fra-CA.json
  'pt-PT.json':  'por-PT.json',   // Both exist; script merges into por-PT.json
  'es-MX.json':  'spa-MX.json',   // Both exist; script merges into spa-MX.json
  'zh-TW.json':  'cmn-Hant.json', // Special: Chinese Traditional → Mandarin Traditional
  'zho-TW.json': null,            // Delete (duplicate of zh-TW)
};

// Convenience aliases for macrolanguage → default variety
const MACROLANGUAGE_ALIASES = {
  'cmn': ['zh', 'zh-CN', 'zh-Hans', 'zho'],
  'arb': ['ar', 'ara'],
  'zsm': ['ms', 'msa'],
  'pes': ['fa', 'fas'],
  'nob': ['nb', 'no', 'nor'],
  'swh': ['sw', 'swa'],
  'als': ['sq', 'sqi'],
};

// 639-1 → 639-3 normalization for macrolanguage field values
const MACROLANGUAGE_CODE_NORMALIZE = {
  'ar': 'ara',
  'sq': 'sqi',
  'zh': 'zho',
  'cr': 'cre',
  'iu': 'iku',
  'sw': 'swa',
  'ms': 'msa',
  'no': 'nor',
  'fa': 'fas',
  'ku': 'kur',
  'ff': 'ful',
  'mg': 'mlg',
  'qu': 'que',
  'za': 'zha',
  'oj': 'oji',
  'sh': 'hbs',
};

// ─── Ancestry → Genus Card Mapping ──────────────────────────────────
// Maps ancestry keywords to our genus card codes.
// Checked in order: first match wins (more specific first).
const ANCESTRY_TO_GENUS = [
  // Sub-family genus cards (most specific — check first)
  { test: (anc) => anc.includes('Romance'), genus: 'genus-romance' },
  { test: (anc) => anc.some(a => /^Slavic$|^East Slavic$|^West Slavic$|^South Slavic$/.test(a)), genus: 'genus-slavic' },
  { test: (anc) => anc.some(a => /^Germanic$|^West Germanic$|^North Germanic$/.test(a)), genus: 'genus-germanic' },
  { test: (anc) => anc.some(a => /^Indo-Aryan$|^Core Indo-Aryan$/.test(a)), genus: 'genus-indic' },
  { test: (anc) => anc.some(a => /^Iranian$|^Core Iranian$|^Western Iranian$|^Eastern Iranian$/.test(a)), genus: 'genus-iranian' },
  { test: (anc) => anc.some(a => /^Semitic$|^Central Semitic$|^West Semitic$/.test(a)), genus: 'genus-semitic' },
  { test: (anc) => anc.some(a => /^Sinitic$|^Core Sinitic$/.test(a)), genus: 'genus-sinitic' },

  // Existing genus cards
  { test: (anc) => anc.includes('Celtic'), genus: 'genus-celtic' },
  { test: (anc) => anc.includes('Cree-Montagnais-Naskapi'), genus: 'genus-cree' },
  { test: (anc) => anc.some(a => /^Philippine$|^Philippinic$|^Greater Central Philippine$/.test(a)), genus: 'genus-philippine' },
  { test: (anc) => anc.includes('Polynesian'), genus: 'genus-polynesian' },
  { test: (anc) => anc.some(a => /^Narrow Bantu$|^Bantoid$/.test(a)), genus: 'genus-bantu' },

  // Existing family cards
  { test: (anc) => anc.includes('Algonquian'), genus: 'family-algonquian' },
];

// Family classification → family card mapping
const FAMILY_TO_CARD = {
  'Atlantic-Congo': 'family-atlantic-congo',
  'Austronesian': 'family-austronesian',
  'Indo-European': 'family-indo-european',
  'Sino-Tibetan': 'family-sino-tibetan',
  'Afro-Asiatic': 'family-afro-asiatic',
  'Nuclear Trans New Guinea': 'family-trans-new-guinea',
  'Pama-Nyungan': 'family-pama-nyungan',
  'Otomanguean': 'family-otomanguean',
  'Austroasiatic': 'family-austroasiatic',
  'Tai-Kadai': 'family-tai-kadai',
  'Dravidian': 'family-dravidian',
  'Turkic': 'family-turkic',
  'Uralic': 'family-uralic',
  'Algic': 'family-algic',
  'Eskimo-Aleut': 'family-eskimo-aleut',
};

// Macrolanguage code → macrolanguage genus card mapping
const MACROLANGUAGE_TO_GENUS = {
  'zho': 'macrolanguage-zho',
  'ara': 'macrolanguage-ara',
  'msa': 'macrolanguage-msa',
  'fas': 'macrolanguage-fas',
  'nor': 'macrolanguage-nor',
  'swa': 'macrolanguage-swa',
  'sqi': 'macrolanguage-sqi',
  'kur': 'macrolanguage-kur',
  'lah': 'macrolanguage-lah',
  'cre': 'genus-cree',  // Cree already has a genus card, use it
};

// ─── Helpers ─────────────────────────────────────────────────────────

function loadCard(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeCard(filePath, card) {
  if (DRY_RUN) {
    log(`  [dry-run] Would write ${path.basename(filePath)}`);
    return;
  }
  fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
}

function deleteFile(filePath) {
  if (DRY_RUN) {
    log(`  [dry-run] Would delete ${path.basename(filePath)}`);
    return;
  }
  fs.unlinkSync(filePath);
}

function renameFile(oldPath, newPath) {
  if (DRY_RUN) {
    log(`  [dry-run] Would rename ${path.basename(oldPath)} → ${path.basename(newPath)}`);
    return;
  }
  fs.renameSync(oldPath, newPath);
}

/**
 * Deep merge source into target. Source values take priority.
 * Arrays from source replace target arrays entirely.
 * Only merges plain objects recursively.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];
    if (
      srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal) &&
      tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else if (srcVal !== null && srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result;
}

// ─── Step 1: Build Inventory ─────────────────────────────────────────

function buildInventory() {
  log('\n📦 Step 1: Building card inventory...');
  const allFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  const cards = new Map(); // code → { card, filePath }
  const duplicatePairs = []; // { iso639_1File, iso639_3File, iso639_1, iso639_3 }

  for (const f of allFiles) {
    const filePath = path.join(CARDS_DIR, f);
    try {
      const card = loadCard(filePath);
      cards.set(card.code, { card, filePath, fileName: f });
    } catch (e) {
      report.errors.push(`Failed to load ${f}: ${e.message}`);
    }
  }

  // Find 639-1 / 639-3 duplicate pairs
  for (const [code, { card, filePath, fileName }] of cards) {
    // This is a 639-1 file if: code is a simple 2-letter code (no hyphens)
    // AND the 639-3 version also exists.
    // Skip regional variants (fr-CA, zh-TW) — those are separate cards, not duplicates.
    if (card.iso639_3 && card.code !== card.iso639_3 && !card.code.includes('-')) {
      const iso3File = card.iso639_3 + '.json';
      const iso3Path = path.join(CARDS_DIR, iso3File);
      if (fs.existsSync(iso3Path)) {
        duplicatePairs.push({
          iso639_1: card.code,
          iso639_3: card.iso639_3,
          iso639_1File: fileName,
          iso639_3File: iso3File,
        });
      }
    }
  }

  log(`  Found ${cards.size} cards, ${duplicatePairs.length} duplicate pairs`);
  return { cards, duplicatePairs };
}

// ─── Step 2: Delete Simple 639-1 Duplicates ──────────────────────────

function deleteSimpleDuplicates(duplicatePairs) {
  log('\n🗑️  Step 2: Deleting 639-1 duplicates (where 639-3 has the data)...');

  // Skip macrolanguage pairs — those are handled in step 3
  const macroCodesSet = new Set([
    ...Object.keys(MACROLANGUAGE_DEFAULTS),
    ...Object.keys(EXTRA_MACROLANGUAGE_FILES),
    // Also skip regional variants
    ...Object.keys(REGIONAL_RENAMES).map(f => f.replace('.json', '')),
  ]);

  let deleted = 0;
  for (const pair of duplicatePairs) {
    // Skip if this is a macrolanguage pair
    if (macroCodesSet.has(pair.iso639_1)) {
      verbose(`Skipping ${pair.iso639_1File} (macrolanguage/regional — handled later)`);
      continue;
    }

    const iso3Path = path.join(CARDS_DIR, pair.iso639_3File);
    const iso3Card = loadCard(iso3Path);

    // Verify the 639-3 file has migration marker (data was already copied)
    if (!iso3Card._migration?.previousCode) {
      warn(`${pair.iso639_3File} has no migration marker — skipping, needs manual merge`);
      report.errors.push(`No migration marker: ${pair.iso639_3File}`);
      continue;
    }

    // Ensure the 639-1 code is in the 639-3 card's aliases
    if (!iso3Card.aliases?.includes(pair.iso639_1)) {
      iso3Card.aliases = iso3Card.aliases || [];
      iso3Card.aliases.push(pair.iso639_1);
      writeCard(iso3Path, iso3Card);
      verbose(`Added alias '${pair.iso639_1}' to ${pair.iso639_3File}`);
    }

    // Ensure iso639_1 field is set
    if (!iso3Card.iso639_1) {
      iso3Card.iso639_1 = pair.iso639_1;
      writeCard(iso3Path, iso3Card);
    }

    // Delete the 639-1 file
    const iso1Path = path.join(CARDS_DIR, pair.iso639_1File);
    deleteFile(iso1Path);
    report.deletedFiles.push(pair.iso639_1File);
    deleted++;
    verbose(`Deleted ${pair.iso639_1File} (covered by ${pair.iso639_3File})`);
  }

  log(`  Deleted ${deleted} duplicate 639-1 files`);
}

// ─── Step 3: Merge Macrolanguage Hand-Crafted Content ────────────────

function mergeMacrolanguages() {
  log('\n🔀 Step 3: Merging macrolanguage content into default varieties...');

  for (const [macroCode, config] of Object.entries(MACROLANGUAGE_DEFAULTS)) {
    const macroFile = macroCode + '.json';
    const macroPath = path.join(CARDS_DIR, macroFile);
    const macro3File = config.macro639_3 + '.json';
    const macro3Path = path.join(CARDS_DIR, macro3File);
    const defaultFile = config.default + '.json';
    const defaultPath = path.join(CARDS_DIR, defaultFile);

    if (!fs.existsSync(macroPath)) {
      verbose(`${macroFile} does not exist, skipping`);
      continue;
    }
    if (!fs.existsSync(defaultPath)) {
      warn(`Default variety ${defaultFile} does not exist for macrolanguage ${macroCode}`);
      continue;
    }

    const macroCard = loadCard(macroPath);
    const defaultCard = loadCard(defaultPath);

    // Merge hand-crafted fields from macro → default
    // Priority: macro hand-crafted data wins for: formality, registers, gender,
    // rules, linguisticChallenges, contactInfluences, culturalAphorism,
    // encyclopedic, resources
    const HANDCRAFTED_FIELDS = [
      'formality', 'registers', 'gender', 'rules',
      'linguisticChallenges', 'contactInfluences', 'culturalAphorism',
      'encyclopedic', 'resources', 'codeSwitching',
    ];

    for (const field of HANDCRAFTED_FIELDS) {
      const macroVal = macroCard[field];
      const defaultVal = defaultCard[field];

      if (macroVal === null || macroVal === undefined) continue;

      // If default has no value, use macro's
      if (defaultVal === null || defaultVal === undefined) {
        defaultCard[field] = macroVal;
        verbose(`  ${config.default}.${field}: copied from ${macroCode}`);
        continue;
      }

      // If both have values and they're objects, deep merge (macro wins)
      if (typeof macroVal === 'object' && !Array.isArray(macroVal) &&
          typeof defaultVal === 'object' && !Array.isArray(defaultVal)) {
        defaultCard[field] = deepMerge(defaultVal, macroVal);
        verbose(`  ${config.default}.${field}: deep merged from ${macroCode}`);
      } else if (Array.isArray(macroVal) && macroVal.length > 0) {
        // Arrays: prefer macro if it has content
        if (!Array.isArray(defaultVal) || defaultVal.length === 0) {
          defaultCard[field] = macroVal;
          verbose(`  ${config.default}.${field}: array copied from ${macroCode}`);
        }
      }
    }

    // Add macrolanguage convenience aliases
    const aliases = new Set(defaultCard.aliases || []);
    const macroAliases = MACROLANGUAGE_ALIASES[config.default] || [];
    for (const alias of macroAliases) {
      aliases.add(alias);
    }
    // Also add 639-1 if the macrolanguage card had one
    if (macroCard.iso639_1) aliases.add(macroCard.iso639_1);
    defaultCard.aliases = [...aliases];

    // Set iso639_1 if not already set
    if (!defaultCard.iso639_1 && macroCard.iso639_1) {
      defaultCard.iso639_1 = macroCard.iso639_1;
    }

    // Ensure supportTier is at least as good as the macro's
    if (macroCard.supportTier === 'supported' && defaultCard.supportTier !== 'supported') {
      defaultCard.supportTier = macroCard.supportTier;
    }

    // Write updated default card
    defaultCard._migration = defaultCard._migration || {};
    defaultCard._migration.mergedFrom = macroCode;
    defaultCard._migration.mergedAt = new Date().toISOString();
    writeCard(defaultPath, defaultCard);

    // Delete the 639-1 macrolanguage file
    deleteFile(macroPath);
    report.deletedFiles.push(macroFile);
    report.mergedMacrolanguages.push(`${macroCode} → ${config.default}`);

    // Also delete the 639-3 macrolanguage file if it exists and is a leaf card
    // (it's a duplicate of the hand-crafted one)
    if (fs.existsSync(macro3Path)) {
      const macro3Card = loadCard(macro3Path);
      // Only delete if it has _migration marker (was auto-generated from the 639-1)
      if (macro3Card._migration?.previousCode) {
        deleteFile(macro3Path);
        report.deletedFiles.push(macro3File);
        verbose(`  Also deleted ${macro3File} (auto-generated duplicate)`);
      }
    }

    log(`  Merged ${macroCode} → ${config.default}, deleted ${macroFile}`);
  }

  // Handle nb → nob (Norwegian Bokmål is a special case)
  // nb.json is the hand-crafted file, nob.json is the 639-3 version
  // This is NOT a macrolanguage merge — nb is already 639-1 for nob
  // It should have been caught by step 2, but let's verify
  const nbPath = path.join(CARDS_DIR, 'nb.json');
  if (fs.existsSync(nbPath)) {
    const nobPath = path.join(CARDS_DIR, 'nob.json');
    if (fs.existsSync(nobPath)) {
      const nobCard = loadCard(nobPath);
      const aliases = new Set(nobCard.aliases || []);
      aliases.add('nb');
      aliases.add('no');
      aliases.add('nor');
      nobCard.aliases = [...aliases];
      writeCard(nobPath, nobCard);
      deleteFile(nbPath);
      report.deletedFiles.push('nb.json');
      log('  Merged nb → nob (Norwegian Bokmål)');
    }
  }

  // Delete no.json and nor.json if they exist (macrolanguage files)
  for (const f of ['no.json', 'nor.json']) {
    const p = path.join(CARDS_DIR, f);
    if (fs.existsSync(p)) {
      deleteFile(p);
      report.deletedFiles.push(f);
      verbose(`  Deleted ${f} (macrolanguage duplicate)`);
    }
  }
}

// ─── Step 4: Rename Regional Variants ────────────────────────────────

function renameRegionalVariants() {
  log('\n📝 Step 4: Renaming regional variant files...');

  for (const [oldName, newName] of Object.entries(REGIONAL_RENAMES)) {
    const oldPath = path.join(CARDS_DIR, oldName);
    if (!fs.existsSync(oldPath)) {
      verbose(`${oldName} does not exist, skipping`);
      continue;
    }

    if (newName === null) {
      // Delete this file (it's a duplicate)
      deleteFile(oldPath);
      report.deletedFiles.push(oldName);
      log(`  Deleted ${oldName} (duplicate)`);
      continue;
    }

    const newPath = path.join(CARDS_DIR, newName);
    const card = loadCard(oldPath);
    const oldCode = card.code;
    const newCode = newName.replace('.json', '');

    // If target already exists (e.g., fra-CA.json was auto-generated),
    // merge into the existing target and delete the old file
    if (fs.existsSync(newPath) && !DRY_RUN) {
      const existingCard = loadCard(newPath);
      // Ensure the existing card has the old code as an alias
      const aliases = new Set(existingCard.aliases || []);
      aliases.add(oldCode);
      existingCard.aliases = [...aliases];
      writeCard(newPath, existingCard);
      deleteFile(oldPath);
      report.deletedFiles.push(oldName);
      report.renamedRegionals.push(`${oldName} → ${newName} (merged into existing)`);
      log(`  Merged ${oldName} into existing ${newName}`);
      continue;
    } else if (fs.existsSync(newPath) && DRY_RUN) {
      log(`  [dry-run] Would merge ${oldName} into existing ${newName}`);
      report.renamedRegionals.push(`${oldName} → ${newName} (merge)`);
      continue;
    }

    // Target doesn't exist — rename with updated fields
    card.code = newCode;
    if (!card.aliases) card.aliases = [];
    if (!card.aliases.includes(oldCode)) card.aliases.push(oldCode);

    card._migration = card._migration || {};
    card._migration.previousCode = oldCode;
    card._migration.migratedAt = new Date().toISOString();

    // Special handling for cmn-Hant (Chinese Traditional)
    if (newCode === 'cmn-Hant') {
      const aliases = new Set(card.aliases);
      aliases.add('zh-TW');
      aliases.add('zh-Hant');
      aliases.add('zh-Hant-TW');
      aliases.add('zho-TW');
      card.aliases = [...aliases];
      card.bcp47 = 'zh-Hant';
    }

    // Write to new path, delete old
    writeCard(newPath, card);
    deleteFile(oldPath);
    report.renamedRegionals.push(`${oldName} → ${newName}`);
    log(`  Renamed ${oldName} → ${newName}`);
  }
}

// ─── Step 5: De-alias Filipino from Tagalog ──────────────────────────

function dealiasFilipinoTagalog() {
  log('\n🔓 Step 5: De-aliasing Filipino from Tagalog...');

  const tglPath = path.join(CARDS_DIR, 'tgl.json');
  if (!fs.existsSync(tglPath)) {
    warn('tgl.json does not exist');
    return;
  }

  const tglCard = loadCard(tglPath);
  const originalAliases = [...(tglCard.aliases || [])];

  // Remove 'fil' from tgl.json aliases, keep 'tl'
  tglCard.aliases = (tglCard.aliases || []).filter(a => a !== 'fil' && a !== 'tgl');

  if (JSON.stringify(originalAliases) !== JSON.stringify(tglCard.aliases)) {
    writeCard(tglPath, tglCard);
    report.dealiased.push('Removed "fil" from tgl.json aliases');
    log(`  tgl.json aliases: [${originalAliases}] → [${tglCard.aliases}]`);
  } else {
    log('  tgl.json already does not alias fil');
  }

  // Also delete tl.json if it still exists (639-1 duplicate of tgl)
  const tlPath = path.join(CARDS_DIR, 'tl.json');
  if (fs.existsSync(tlPath)) {
    deleteFile(tlPath);
    report.deletedFiles.push('tl.json');
    log('  Deleted tl.json (639-1 duplicate of tgl)');
  }

  // Ensure fil.json exists and is independent
  const filPath = path.join(CARDS_DIR, 'fil.json');
  if (fs.existsSync(filPath)) {
    const filCard = loadCard(filPath);
    // Make sure fil doesn't alias to tgl
    filCard.aliases = (filCard.aliases || []).filter(a => a !== 'tgl' && a !== 'tl');
    writeCard(filPath, filCard);
    log('  fil.json confirmed as independent card');
  } else {
    warn('fil.json does not exist — Filipino card is missing');
  }
}

// ─── Step 6: Auto-Wire extends ───────────────────────────────────────

function autoWireExtends() {
  log('\n🔗 Step 6: Auto-wiring extends from classification data...');

  // Load all available genus/family card codes
  const generaFiles = fs.readdirSync(GENERA_DIR).filter(f => f.endsWith('.json'));
  const availableGenera = new Set(generaFiles.map(f => f.replace('.json', '')));

  // Load all leaf cards
  const leafFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let wired = 0;
  let alreadyWired = 0;
  let noMatch = 0;

  for (const f of leafFiles) {
    const filePath = path.join(CARDS_DIR, f);
    const card = loadCard(filePath);

    // Skip genus/family cards themselves
    if (card.code?.startsWith('genus-') || card.code?.startsWith('family-') || card.code?.startsWith('macrolanguage-')) {
      continue;
    }

    // Skip if already has a correct extends
    if (card.extends && availableGenera.has(card.extends)) {
      alreadyWired++;
      continue;
    }

    const ancestry = card.classification?.ancestry || [];
    const family = card.classification?.family;
    const macrolanguage = card.macrolanguage;

    // Determine the best extends target
    let newExtends = null;

    // Priority 1: Macrolanguage genus card
    // Normalize the macrolanguage code first
    const normalizedMacro = macrolanguage
      ? (MACROLANGUAGE_CODE_NORMALIZE[macrolanguage] || macrolanguage)
      : null;
    if (normalizedMacro && MACROLANGUAGE_TO_GENUS[normalizedMacro]) {
      const macroGenus = MACROLANGUAGE_TO_GENUS[normalizedMacro];
      if (availableGenera.has(macroGenus)) {
        newExtends = macroGenus;
      }
    }

    // Priority 2: Ancestry-based genus matching
    if (!newExtends && ancestry.length > 0) {
      for (const rule of ANCESTRY_TO_GENUS) {
        if (rule.test(ancestry) && availableGenera.has(rule.genus)) {
          newExtends = rule.genus;
          break;
        }
      }
    }

    // Priority 3: Family-based matching (broadest)
    if (!newExtends && family && FAMILY_TO_CARD[family]) {
      const familyCard = FAMILY_TO_CARD[family];
      if (availableGenera.has(familyCard)) {
        newExtends = familyCard;
      }
    }

    if (newExtends) {
      if (card.extends !== newExtends) {
        card.extends = newExtends;
        writeCard(filePath, card);
        wired++;
        report.wiredExtends.push(`${card.code} → ${newExtends}`);
        verbose(`${card.code} → extends ${newExtends}`);
      } else {
        alreadyWired++;
      }
    } else {
      noMatch++;
      verbose(`${card.code}: no genus/family match (family: ${family})`);
    }
  }

  log(`  Wired: ${wired}, Already correct: ${alreadyWired}, No match: ${noMatch}`);
}

// ─── Step 7: Normalize Macrolanguage Fields ──────────────────────────

function normalizeMacrolanguageFields() {
  log('\n🏷️  Step 7: Normalizing macrolanguage fields to 639-3...');

  const leafFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let normalized = 0;
  for (const f of leafFiles) {
    const filePath = path.join(CARDS_DIR, f);
    const card = loadCard(filePath);

    if (card.macrolanguage && MACROLANGUAGE_CODE_NORMALIZE[card.macrolanguage]) {
      const oldCode = card.macrolanguage;
      const newCode = MACROLANGUAGE_CODE_NORMALIZE[oldCode];
      card.macrolanguage = newCode;
      writeCard(filePath, card);
      normalized++;
      report.normalizedMacrolanguage.push(`${card.code}: ${oldCode} → ${newCode}`);
      verbose(`${card.code}: macrolanguage ${oldCode} → ${newCode}`);
    }
  }

  log(`  Normalized ${normalized} macrolanguage fields`);
}

// ─── Step 8: Fix Known Broken Inheritance ────────────────────────────

function fixBrokenInheritance() {
  log('\n🔧 Step 8: Fixing known broken inheritance...');

  // Cree varieties that should extend genus-cree
  const creeVarieties = ['csw', 'cwd', 'crm', 'crl', 'crj', 'atj', 'moe', 'nsk'];

  for (const code of creeVarieties) {
    const filePath = path.join(CARDS_DIR, code + '.json');
    if (!fs.existsSync(filePath)) continue;

    const card = loadCard(filePath);
    let changed = false;

    if (card.extends !== 'genus-cree') {
      card.extends = 'genus-cree';
      changed = true;
    }
    if (card.macrolanguage !== 'cre') {
      card.macrolanguage = 'cre';
      changed = true;
    }

    if (changed) {
      writeCard(filePath, card);
      report.fixedInheritance.push(`${code}: extends→genus-cree, macrolanguage→cre`);
      log(`  Fixed ${code}: extends → genus-cree, macrolanguage → cre`);
    }
  }

  // Delete fil.json duplicate alias issue is handled by step 5
  // Delete other known duplicates
  const filDupe = path.join(CARDS_DIR, 'fil.json');
  // fil.json stays — it's the independent Filipino card (per plan)
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  log('═══════════════════════════════════════════════════════');
  log('  Champollion ISO 639-3 Migration');
  log(DRY_RUN ? '  MODE: DRY RUN (no files will be modified)' : '  MODE: LIVE (files will be modified!)');
  log('═══════════════════════════════════════════════════════');

  // Check genera dir exists
  if (!fs.existsSync(GENERA_DIR)) {
    log('⚠️  genera/ directory does not exist. Create genus cards first.');
    process.exit(1);
  }

  const { cards, duplicatePairs } = buildInventory();

  deleteSimpleDuplicates(duplicatePairs);
  mergeMacrolanguages();
  renameRegionalVariants();
  dealiasFilipinoTagalog();
  autoWireExtends();
  normalizeMacrolanguageFields();
  fixBrokenInheritance();

  // ─── Report ──────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════════════════');
  log('  Migration Report');
  log('═══════════════════════════════════════════════════════');
  log(`  Files deleted: ${report.deletedFiles.length}`);
  log(`  Macrolanguages merged: ${report.mergedMacrolanguages.length}`);
  log(`  Regional variants renamed: ${report.renamedRegionals.length}`);
  log(`  Cards wired with extends: ${report.wiredExtends.length}`);
  log(`  Macrolanguage fields normalized: ${report.normalizedMacrolanguage.length}`);
  log(`  De-aliased: ${report.dealiased.length}`);
  log(`  Inheritance fixes: ${report.fixedInheritance.length}`);
  log(`  Errors: ${report.errors.length}`);

  if (report.errors.length > 0) {
    log('\n❌ Errors:');
    report.errors.forEach(e => log('  ' + e));
  }

  // Write full report to file
  const reportPath = path.resolve(__dirname, '../migration-report.json');
  if (!DRY_RUN) {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
    log(`\n📄 Full report written to ${reportPath}`);
  }
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
