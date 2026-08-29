#!/usr/bin/env node

/**
 * add-admin1-codes.mjs
 *
 * Adds ISO 3166-2 admin1Codes to language card region entries.
 * These codes specify exactly which provinces/states a language
 * is spoken in, enabling accurate boundary highlighting on maps.
 *
 * WHY: A dot in Saskatchewan doesn't show where Plains Cree is
 * spoken. Highlighting SK, AB, MB boundaries does.
 *
 * Usage:
 *   node scripts/add-admin1-codes.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Admin-1 code lookup ──────────────────────────────────────────
// Keyed by card code → array of region patches.
// Each patch matches by countryCode and optionally region string,
// then sets admin1Codes.
//
// Sources: ISO 3166-2, Natural Earth admin-1 boundaries.

const ADMIN1_DATA = {
  // ── Indigenous Canadian languages ──────────────────────────────
  crk: [{ cc: 'CA', admin1: ['CA-SK', 'CA-AB', 'CA-MB'] }],
  oj:  [{ cc: 'CA', admin1: ['CA-ON', 'CA-MB', 'CA-SK'] },
        { cc: 'US', admin1: ['US-MN', 'US-WI', 'US-MI', 'US-ND'] }],
  iu:  [{ cc: 'CA', admin1: ['CA-NU', 'CA-NT', 'CA-QC'] }],
  ikt: [{ cc: 'CA', admin1: ['CA-NT', 'CA-NU'] }],

  // ── US Indigenous languages ────────────────────────────────────
  haw: [{ cc: 'US', admin1: ['US-HI'] }],
  nv:  [{ cc: 'US', admin1: ['US-AZ', 'US-NM', 'US-UT'] }],
  chr: [{ cc: 'US', admin1: ['US-OK', 'US-NC'] }],
  lkt: [{ cc: 'US', admin1: ['US-SD', 'US-ND', 'US-NE', 'US-MT'] }],

  // ── Philippine languages ───────────────────────────────────────
  tl:  [{ cc: 'PH', admin1: ['PH-MNL', 'PH-CAV', 'PH-LAG', 'PH-BTG', 'PH-RIZ', 'PH-QUE', 'PH-BUL'] }],
  bcl: [{ cc: 'PH', admin1: ['PH-CAN', 'PH-CAS', 'PH-ALB', 'PH-SOR', 'PH-CAT', 'PH-MAS'] }],
  ilo: [{ cc: 'PH', admin1: ['PH-ILN', 'PH-ILS', 'PH-LUN', 'PH-PAN', 'PH-CAG'] }],
  ceb: [{ cc: 'PH', admin1: ['PH-CEB', 'PH-BOH', 'PH-LEY', 'PH-SLE'] }],
  hil: [{ cc: 'PH', admin1: ['PH-ILI', 'PH-NEC', 'PH-AKL', 'PH-ANT', 'PH-CAP', 'PH-GUI'] }],
  pam: [{ cc: 'PH', admin1: ['PH-PAM', 'PH-TAR', 'PH-BAN'] }],
  pag: [{ cc: 'PH', admin1: ['PH-PAN'] }],
  mrw: [{ cc: 'PH', admin1: ['PH-LAN', 'PH-LAS'] }],
  tsg: [{ cc: 'PH', admin1: ['PH-SLU', 'PH-TAW', 'PH-BAS'] }],
  war: [{ cc: 'PH', admin1: ['PH-LEY', 'PH-SLE', 'PH-WSA', 'PH-EAS', 'PH-NSA', 'PH-BIL'] }],
  ifk: [{ cc: 'PH', admin1: ['PH-IFU'] }],
  kne: [{ cc: 'PH', admin1: ['PH-KAL'] }],
  mdh: [{ cc: 'PH', admin1: ['PH-MAG', 'PH-NCO', 'PH-SUK'] }],

  // ── India (sub-national) ───────────────────────────────────────
  hi:  [{ cc: 'IN', admin1: ['IN-UP', 'IN-MP', 'IN-BR', 'IN-RJ', 'IN-HR', 'IN-JH', 'IN-CG', 'IN-DL', 'IN-UK'] },
        { cc: 'FJ', admin1: null }, { cc: 'NP', admin1: null },
        { cc: 'MU', admin1: null }, { cc: 'TT', admin1: null }],
  bn:  [{ cc: 'BD', admin1: null },
        { cc: 'IN', admin1: ['IN-WB', 'IN-TR'] }],
  ta:  [{ cc: 'IN', admin1: ['IN-TN'] },
        { cc: 'LK', admin1: null }, { cc: 'SG', admin1: null }, { cc: 'MY', admin1: null }],
  te:  [{ cc: 'IN', admin1: ['IN-TG', 'IN-AP'] }],
  kn:  [{ cc: 'IN', admin1: ['IN-KA'] }],
  ml:  [{ cc: 'IN', admin1: ['IN-KL'] }],
  mr:  [{ cc: 'IN', admin1: ['IN-MH'] }],
  gu:  [{ cc: 'IN', admin1: ['IN-GJ'] }],
  pa:  [{ cc: 'IN', admin1: ['IN-PB'] },
        { cc: 'PK', admin1: ['PK-PB'] }],
  or:  [{ cc: 'IN', admin1: ['IN-OR'] }],
  ur:  [{ cc: 'PK', admin1: null },
        { cc: 'IN', admin1: ['IN-UP', 'IN-BR', 'IN-JH', 'IN-JK', 'IN-DL', 'IN-TG'] }],
  ne:  [{ cc: 'NP', admin1: null },
        { cc: 'IN', admin1: ['IN-WB', 'IN-SK'] }],
  si:  [{ cc: 'LK', admin1: null }],

  // ── China (sub-national) ───────────────────────────────────────
  zh:  [{ cc: 'CN', admin1: null }, { cc: 'SG', admin1: null },
        { cc: 'MY', admin1: null }, { cc: 'ID', admin1: null }, { cc: 'TH', admin1: null }],
  'zh-TW': [{ cc: 'TW', admin1: null }, { cc: 'HK', admin1: null }, { cc: 'MO', admin1: null }],
  yue: [{ cc: 'CN', admin1: ['CN-GD'] }, { cc: 'HK', admin1: null }],

  // ── Canada (French) ────────────────────────────────────────────
  'fr-CA': [{ cc: 'CA', admin1: ['CA-QC', 'CA-NB', 'CA-ON'] }],

  // ── North/South American languages ─────────────────────────────
  'es-MX': [{ cc: 'MX', admin1: null }, { cc: 'US', admin1: null }],
  qu:  [{ cc: 'PE', admin1: ['PE-CUS', 'PE-PUN', 'PE-APU', 'PE-AYA', 'PE-HUV', 'PE-JUN'] },
        { cc: 'BO', admin1: null }, { cc: 'EC', admin1: null }, { cc: 'AR', admin1: null }],
  gn:  [{ cc: 'PY', admin1: null }, { cc: 'AR', admin1: null }, { cc: 'BO', admin1: null }],
  ay:  [{ cc: 'BO', admin1: null }, { cc: 'PE', admin1: null }],

  // ── African languages ──────────────────────────────────────────
  yo:  [{ cc: 'NG', admin1: null }, { cc: 'BJ', admin1: null }],
  sw:  [{ cc: 'TZ', admin1: null }, { cc: 'KE', admin1: null },
        { cc: 'UG', admin1: null }, { cc: 'CD', admin1: null },
        { cc: 'RW', admin1: null }, { cc: 'MZ', admin1: null }],
  am:  [{ cc: 'ET', admin1: null }],
  ig:  [{ cc: 'NG', admin1: null }],
  ha:  [{ cc: 'NG', admin1: null }, { cc: 'NE', admin1: null }, { cc: 'GH', admin1: null }],
  rw:  [{ cc: 'RW', admin1: null }, { cc: 'CD', admin1: null }, { cc: 'UG', admin1: null }],
  lg:  [{ cc: 'UG', admin1: null }],
  ti:  [{ cc: 'ER', admin1: null }, { cc: 'ET', admin1: null }],
  sn:  [{ cc: 'ZW', admin1: null }, { cc: 'MZ', admin1: null }],
  xh:  [{ cc: 'ZA', admin1: null }, { cc: 'ZW', admin1: null }],
  zu:  [{ cc: 'ZA', admin1: null }],

  // ── European languages ─────────────────────────────────────────
  ga:  [{ cc: 'IE', admin1: null }, { cc: 'GB', admin1: null }],
  cy:  [{ cc: 'GB', admin1: ['GB-WLS'] }],
  gd:  [{ cc: 'GB', admin1: ['GB-SCT'] }],
  eu:  [{ cc: 'ES', admin1: ['ES-PV', 'ES-NC'] }, { cc: 'FR', admin1: null }],
  ca:  [{ cc: 'ES', admin1: ['ES-CT', 'ES-VC', 'ES-IB'] },
        { cc: 'AD', admin1: null }, { cc: 'FR', admin1: null }],
  gl:  [{ cc: 'ES', admin1: ['ES-GA'] }],
  fy:  [{ cc: 'NL', admin1: null }],
  lb:  [{ cc: 'LU', admin1: null }],
  mt:  [{ cc: 'MT', admin1: null }],
  se:  [{ cc: 'NO', admin1: null }, { cc: 'SE', admin1: null },
        { cc: 'FI', admin1: null }, { cc: 'RU', admin1: null }],
  fo:  [{ cc: 'FO', admin1: null }, { cc: 'DK', admin1: null }],

  // Nationwide European languages — whole country for each
  de:  [{ cc: 'DE', admin1: null }, { cc: 'AT', admin1: null }, { cc: 'CH', admin1: null },
        { cc: 'LU', admin1: null }, { cc: 'LI', admin1: null }, { cc: 'BE', admin1: null }, { cc: 'IT', admin1: null }],
  fr:  [{ cc: 'FR', admin1: null }, { cc: 'BE', admin1: null }, { cc: 'CH', admin1: null },
        { cc: 'CD', admin1: null }, { cc: 'CA', admin1: ['CA-QC', 'CA-NB'] },
        { cc: 'CM', admin1: null }, { cc: 'CI', admin1: null }, { cc: 'SN', admin1: null },
        { cc: 'MG', admin1: null }, { cc: 'HT', admin1: null }],
  es:  [{ cc: 'ES', admin1: null }, { cc: 'MX', admin1: null }, { cc: 'CO', admin1: null },
        { cc: 'AR', admin1: null }, { cc: 'PE', admin1: null }, { cc: 'VE', admin1: null },
        { cc: 'CL', admin1: null }, { cc: 'US', admin1: null }, { cc: 'CU', admin1: null }, { cc: 'EC', admin1: null }],
  pt:  [{ cc: 'BR', admin1: null }, { cc: 'MZ', admin1: null }, { cc: 'AO', admin1: null },
        { cc: 'PT', admin1: null }, { cc: 'GW', admin1: null }, { cc: 'TL', admin1: null },
        { cc: 'CV', admin1: null }, { cc: 'ST', admin1: null }],
  'pt-PT': [{ cc: 'PT', admin1: null }],
  en:  [{ cc: 'US', admin1: null }, { cc: 'GB', admin1: null }, { cc: 'CA', admin1: null },
        { cc: 'AU', admin1: null }, { cc: 'IN', admin1: null }, { cc: 'NG', admin1: null },
        { cc: 'ZA', admin1: null }, { cc: 'NZ', admin1: null }, { cc: 'IE', admin1: null }, { cc: 'PH', admin1: null }],
  nl:  [{ cc: 'NL', admin1: null }, { cc: 'BE', admin1: null }, { cc: 'SR', admin1: null },
        { cc: 'CW', admin1: null }, { cc: 'AW', admin1: null }],
  it:  [{ cc: 'IT', admin1: null }, { cc: 'CH', admin1: null }, { cc: 'SM', admin1: null }, { cc: 'VA', admin1: null }],
  ru:  [{ cc: 'RU', admin1: null }, { cc: 'BY', admin1: null }, { cc: 'KZ', admin1: null },
        { cc: 'KG', admin1: null }, { cc: 'UA', admin1: null }],
  uk:  [{ cc: 'UA', admin1: null }],
  pl:  [{ cc: 'PL', admin1: null }],
  ro:  [{ cc: 'RO', admin1: null }, { cc: 'MD', admin1: null }],
  hu:  [{ cc: 'HU', admin1: null }, { cc: 'RO', admin1: null },
        { cc: 'SK', admin1: null }, { cc: 'RS', admin1: null }],
  cs:  [{ cc: 'CZ', admin1: null }],
  sk:  [{ cc: 'SK', admin1: null }, { cc: 'CZ', admin1: null }],
  bg:  [{ cc: 'BG', admin1: null }],
  sr:  [{ cc: 'RS', admin1: null }, { cc: 'BA', admin1: null },
        { cc: 'ME', admin1: null }, { cc: 'XK', admin1: null }],
  bs:  [{ cc: 'BA', admin1: null }],
  sq:  [{ cc: 'AL', admin1: null }, { cc: 'XK', admin1: null }, { cc: 'MK', admin1: null }],
  mk:  [{ cc: 'MK', admin1: null }],
  el:  [{ cc: 'GR', admin1: null }, { cc: 'CY', admin1: null }],
  da:  [{ cc: 'DK', admin1: null }, { cc: 'GL', admin1: null }, { cc: 'DE', admin1: null }],
  sv:  [{ cc: 'SE', admin1: null }, { cc: 'FI', admin1: null }],
  nb:  [{ cc: 'NO', admin1: null }],
  fi:  [{ cc: 'FI', admin1: null }, { cc: 'SE', admin1: null }],
  et:  [{ cc: 'EE', admin1: null }],
  lt:  [{ cc: 'LT', admin1: null }],
  lv:  [{ cc: 'LV', admin1: null }],
  is:  [{ cc: 'IS', admin1: null }],
  be:  [{ cc: 'BY', admin1: null }],

  // ── Middle East / Central Asia ─────────────────────────────────
  ar:  [{ cc: 'SA', admin1: null }, { cc: 'EG', admin1: null }, { cc: 'IQ', admin1: null },
        { cc: 'MA', admin1: null }, { cc: 'DZ', admin1: null }, { cc: 'SD', admin1: null },
        { cc: 'YE', admin1: null }, { cc: 'SY', admin1: null }, { cc: 'JO', admin1: null }, { cc: 'AE', admin1: null }],
  fa:  [{ cc: 'IR', admin1: null }, { cc: 'AF', admin1: null }, { cc: 'TJ', admin1: null }],
  tr:  [{ cc: 'TR', admin1: null }, { cc: 'CY', admin1: null }],
  he:  [{ cc: 'IL', admin1: null }],
  ka:  [{ cc: 'GE', admin1: null }],
  az:  [{ cc: 'AZ', admin1: null }, { cc: 'IR', admin1: null }],
  kk:  [{ cc: 'KZ', admin1: null }, { cc: 'CN', admin1: null }],
  uz:  [{ cc: 'UZ', admin1: null }, { cc: 'AF', admin1: null }],
  tk:  [{ cc: 'TM', admin1: null }],

  // ── East / Southeast Asia ──────────────────────────────────────
  ja:  [{ cc: 'JP', admin1: null }, { cc: 'PW', admin1: null }],
  ko:  [{ cc: 'KR', admin1: null }, { cc: 'KP', admin1: null }, { cc: 'CN', admin1: null }],
  vi:  [{ cc: 'VN', admin1: null }],
  th:  [{ cc: 'TH', admin1: null }],
  km:  [{ cc: 'KH', admin1: null }],
  lo:  [{ cc: 'LA', admin1: null }, { cc: 'TH', admin1: null }],
  my:  [{ cc: 'MM', admin1: null }],
  ms:  [{ cc: 'MY', admin1: null }, { cc: 'BN', admin1: null }, { cc: 'SG', admin1: null }, { cc: 'ID', admin1: null }],
  id:  [{ cc: 'ID', admin1: null }],
  mn:  [{ cc: 'MN', admin1: null }, { cc: 'CN', admin1: null }],

  // ── Oceania ────────────────────────────────────────────────────
  mi:  [{ cc: 'NZ', admin1: null }],
};

// ── Process cards ────────────────────────────────────────────────

let modified = 0;
let skipped = 0;

const files = fs.readdirSync(CARDS_DIR)
  .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

for (const file of files) {
  const filePath = path.join(CARDS_DIR, file);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const code = card.code;

  if (!ADMIN1_DATA[code] || !card.regions || !Array.isArray(card.regions)) {
    skipped++;
    continue;
  }

  const patches = ADMIN1_DATA[code];
  let cardModified = false;

  for (const region of card.regions) {
    // Skip if already has admin1Codes
    if (region.admin1Codes) continue;

    // Find matching patch by country code
    const patch = patches.find(p => p.cc === region.countryCode);
    if (patch) {
      region.admin1Codes = patch.admin1;
      cardModified = true;
    }
  }

  if (cardModified) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
    modified++;
    console.log(`  ✅ ${code}: admin1Codes added`);
  } else {
    skipped++;
  }
}

console.log(`\nModified: ${modified}, Skipped: ${skipped}`);
