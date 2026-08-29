#!/usr/bin/env node

/**
 * migrate-method-support.mjs — One-shot migration script
 *
 * Transforms `methodSupport` from flat booleans:
 *   { googleTranslate: true, deepl: true, deeplFormality: true, ... }
 *
 * To enriched objects:
 *   { googleTranslate: { supported: true }, deepl: { supported: true, formality: true }, ... }
 *
 * Also:
 *   - Moves `deeplFormality` from top-level into `deepl.formality`
 *   - Adds `nllb` entry based on iso639_3 + script
 *   - Preserves all other card fields unchanged
 *
 * USAGE:
 *   node scripts/migrate-method-support.mjs [--dry-run]
 *
 * Run with --dry-run first to see what would change without modifying files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.resolve(__dirname, '..', 'shared', 'language-cards');
const GENERA_DIR = path.join(CARDS_DIR, 'genera');

const dryRun = process.argv.includes('--dry-run');

// ─── NLLB code lookup ──────────────────────────────────────────────
// NLLB-200 uses 3-letter ISO 639-3 + underscore + script code.
// Not all languages are in NLLB — this is a curated subset of the
// languages we have cards for.
const NLLB_CODES = {
  // Well-resourced languages in NLLB
  afr: 'afr_Latn', amh: 'amh_Ethi', ara: 'ara_Arab', aze: 'aze_Latn',
  bel: 'bel_Cyrl', bul: 'bul_Cyrl', ben: 'ben_Beng', bos: 'bos_Latn',
  cat: 'cat_Latn', ces: 'ces_Latn', cym: 'cym_Latn', dan: 'dan_Latn',
  deu: 'deu_Latn', ell: 'ell_Grek', eng: 'eng_Latn', spa: 'spa_Latn',
  est: 'est_Latn', eus: 'eus_Latn', fas: 'fas_Arab', fin: 'fin_Latn',
  fra: 'fra_Latn', gle: 'gle_Latn', glg: 'glg_Latn', guj: 'guj_Gujr',
  hau: 'hau_Latn', heb: 'heb_Hebr', hin: 'hin_Deva', hrv: 'hrv_Latn',
  hun: 'hun_Latn', hye: 'hye_Armn', ind: 'ind_Latn', ibo: 'ibo_Latn',
  isl: 'isl_Latn', ita: 'ita_Latn', jpn: 'jpn_Jpan', jav: 'jav_Latn',
  kat: 'kat_Geor', kaz: 'kaz_Cyrl', khm: 'khm_Khmr', kan: 'kan_Knda',
  kor: 'kor_Hang', kir: 'kir_Cyrl', lao: 'lao_Laoo', lit: 'lit_Latn',
  lav: 'lav_Latn', mkd: 'mkd_Cyrl', mal: 'mal_Mlym', mon: 'mon_Cyrl',
  mar: 'mar_Deva', msa: 'msa_Latn', mlt: 'mlt_Latn', mya: 'mya_Mymr',
  nob: 'nob_Latn', nep: 'nep_Deva', nld: 'nld_Latn', pol: 'pol_Latn',
  pus: 'pus_Arab', por: 'por_Latn', ron: 'ron_Latn', rus: 'rus_Cyrl',
  snd: 'snd_Arab', sin: 'sin_Sinh', slk: 'slk_Latn', slv: 'slv_Latn',
  som: 'som_Latn', sqi: 'sqi_Latn', srp: 'srp_Cyrl', swe: 'swe_Latn',
  swa: 'swa_Latn', tam: 'tam_Taml', tel: 'tel_Telu', tgk: 'tgk_Cyrl',
  tha: 'tha_Thai', tur: 'tur_Latn', ukr: 'ukr_Cyrl', urd: 'urd_Arab',
  uzb: 'uzb_Latn', vie: 'vie_Latn', xho: 'xho_Latn', yor: 'yor_Latn',
  zho: 'zho_Hans', zul: 'zul_Latn', tgl: 'tgl_Latn',
  // LRL languages in NLLB
  que: 'que_Latn', grn: 'grn_Latn',
  // Cree is NOT in NLLB
};

// zh-TW uses Traditional Chinese
const SPECIAL_NLLB = {
  'zh-TW': 'zho_Hant',
  'pt-PT': 'por_Latn',
};

function migrateCard(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const card = JSON.parse(raw);
  const filename = path.basename(filePath);

  if (!card.methodSupport) {
    console.log(`  [SKIP] ${filename}: no methodSupport field`);
    return false;
  }

  // Check if already migrated (first value is an object, not boolean)
  const firstValue = Object.values(card.methodSupport)[0];
  if (typeof firstValue === 'object' && firstValue !== null) {
    console.log(`  [SKIP] ${filename}: already migrated`);
    return false;
  }

  const old = card.methodSupport;

  // Build new methodSupport object
  const newSupport = {};

  // Google Translate
  newSupport.googleTranslate = { supported: !!old.googleTranslate };

  // DeepL — absorbs deeplFormality
  const deeplEntry = { supported: !!old.deepl };
  if (old.deepl) {
    deeplEntry.formality = !!old.deeplFormality;
  }
  newSupport.deepl = deeplEntry;

  // Microsoft Translator
  newSupport.microsoftTranslator = { supported: !!old.microsoftTranslator };

  // LibreTranslate
  newSupport.libreTranslate = { supported: !!old.libreTranslate };

  // NLLB — derive from iso639_3 + script
  const iso3 = card.iso639_3;
  const nllbCode = SPECIAL_NLLB[card.code] || (iso3 && NLLB_CODES[iso3]) || null;
  newSupport.nllb = {
    supported: nllbCode !== null,
    ...(nllbCode ? { code: nllbCode } : {}),
  };

  // LLM
  newSupport.llm = { supported: !!old.llm };

  // Preserve any extra keys that aren't in our known set
  const knownKeys = new Set([
    'googleTranslate', 'deepl', 'deeplFormality',
    'microsoftTranslator', 'libreTranslate', 'llm',
  ]);
  for (const [key, value] of Object.entries(old)) {
    if (!knownKeys.has(key)) {
      // Unknown key — preserve it as-is, wrapping in object if boolean
      if (typeof value === 'boolean') {
        newSupport[key] = { supported: value };
      } else {
        newSupport[key] = value;
      }
    }
  }

  card.methodSupport = newSupport;

  if (dryRun) {
    console.log(`  [DRY] ${filename}:`);
    console.log(`    Old: ${JSON.stringify(old)}`);
    console.log(`    New: ${JSON.stringify(newSupport)}`);
  } else {
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    console.log(`  [OK]  ${filename}: migrated`);
  }

  return true;
}

function main() {
  console.log(`\nmigrate-method-support.mjs${dryRun ? ' [DRY RUN]' : ''}`);
  console.log('─'.repeat(50));

  let migrated = 0;
  let skipped = 0;

  // Process main cards
  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  for (const file of cardFiles) {
    if (migrateCard(path.join(CARDS_DIR, file))) {
      migrated++;
    } else {
      skipped++;
    }
  }

  // Process genus/family cards
  if (fs.existsSync(GENERA_DIR)) {
    const generaFiles = fs.readdirSync(GENERA_DIR)
      .filter(f => f.endsWith('.json'));

    for (const file of generaFiles) {
      if (migrateCard(path.join(GENERA_DIR, file))) {
        migrated++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done: ${migrated} migrated, ${skipped} skipped.\n`);
}

main();
