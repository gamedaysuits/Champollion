#!/usr/bin/env node

/**
 * add-region-coordinates.mjs
 *
 * Adds [longitude, latitude] coordinates to every region entry
 * across all language card JSON files.
 *
 * CRITICAL: coordinates are the CENTER OF THE ACTUAL SPEAKING AREA,
 * not the country capital. Plains Cree in Saskatchewan gets [-106.6, 52.1],
 * not Ottawa [-75.7, 45.4].
 *
 * Usage:
 *   node scripts/add-region-coordinates.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Coordinate lookup: country + region → [lng, lat] ─────────────
// Use center of speaking area, NOT country capital.
// Format: "CountryCode" or "CountryCode:RegionString" → [lng, lat]

const COORDS = {
  // ── Africa ──────────────────────────────────────────────
  'BJ': [2.3, 9.3],            // Benin
  'BF': [-1.5, 12.3],          // Burkina Faso
  'CD': [25.0, -2.9],          // DR Congo
  'CI': [-5.5, 7.5],           // Côte d'Ivoire
  'CM': [12.4, 5.9],           // Cameroon
  'DZ': [3.0, 36.7],           // Algeria
  'EG': [31.2, 30.0],          // Egypt
  'ET': [38.7, 9.0],           // Ethiopia
  'GH': [-1.0, 7.9],           // Ghana
  'GN': [-11.8, 10.8],         // Guinea
  'KE': [36.8, -1.3],          // Kenya
  'LR': [-9.4, 6.4],           // Liberia
  'LY': [13.2, 32.9],          // Libya
  'MA': [-7.6, 31.6],          // Morocco
  'MG': [47.5, -18.9],         // Madagascar
  'ML': [-8.0, 12.6],          // Mali
  'MR': [-10.9, 18.1],         // Mauritania
  'MZ': [35.5, -15.8],         // Mozambique
  'NE': [8.1, 17.6],           // Niger
  'NG': [3.4, 6.5],            // Nigeria (SW/Yoruba area)
  'NG:Northern Nigeria': [7.5, 11.5],
  'NG:Southwestern Nigeria': [3.4, 7.4],
  'NG:Southern Nigeria': [5.5, 6.3],
  'RW': [29.9, -1.9],          // Rwanda
  'SD': [32.5, 15.6],          // Sudan
  'SL': [-11.8, 8.5],          // Sierra Leone
  'SN': [-14.5, 14.7],         // Senegal
  'SO': [45.3, 2.0],           // Somalia
  'SS': [31.6, 6.9],           // South Sudan
  'TD': [15.0, 12.1],          // Chad
  'TG': [1.2, 6.1],            // Togo
  'TN': [10.2, 36.8],          // Tunisia
  'TZ': [35.7, -6.4],          // Tanzania
  'UG': [32.6, 0.3],           // Uganda
  'ZA': [28.0, -26.2],         // South Africa
  'ZW': [31.0, -20.0],         // Zimbabwe

  // ── Americas ────────────────────────────────────────────
  'AR': [-58.4, -34.6],        // Argentina
  'BO': [-66.2, -17.4],        // Bolivia
  'BR': [-47.9, -15.8],        // Brazil
  'CA': [-106.3, 56.1],        // Canada (general)
  'CA:Saskatchewan, Alberta, Manitoba': [-106.6, 52.5],
  'CA:Saskatchewan': [-106.6, 52.1],
  'CA:Alberta': [-114.4, 53.5],
  'CA:Manitoba': [-97.2, 53.8],
  'CA:Ontario, Manitoba, Saskatchewan': [-90.0, 51.5],
  'CA:British Columbia': [-125.0, 54.0],
  'CA:Ontario': [-85.3, 49.3],
  'CA:Quebec': [-71.2, 46.8],
  'CA:Nunavut, Northwest Territories': [-95.0, 63.0],
  'CA:Nunavut': [-83.1, 65.2],
  'CA:Northwest Territories, Nunavut': [-110.0, 64.0],
  'CL': [-70.6, -33.4],        // Chile
  'CO': [-74.1, 4.7],           // Colombia
  'CU': [-82.4, 23.1],          // Cuba
  'DO': [-69.9, 18.5],          // Dominican Republic
  'EC': [-78.5, -0.2],          // Ecuador
  'GT': [-90.5, 14.6],          // Guatemala
  'HN': [-87.2, 14.1],          // Honduras
  'MX': [-99.1, 19.4],          // Mexico
  'PE': [-72.0, -13.5],         // Peru
  'PE:Cusco, Puno, Apurímac': [-72.0, -14.0],
  'PR': [-66.1, 18.2],          // Puerto Rico
  'PY': [-57.6, -25.3],         // Paraguay
  'US': [-98.6, 39.8],          // USA (general)
  'US:Hawaiʻi': [-156.5, 20.8],
  'US:Hawaii': [-156.5, 20.8],
  'US:Navajo Nation (Arizona, New Mexico, Utah)': [-109.5, 36.2],
  'US:Oklahoma, North Carolina': [-95.0, 35.5],
  'US:Oklahoma': [-97.5, 35.5],
  'US:North Carolina': [-83.5, 35.5],
  'US:Arizona, New Mexico, Utah': [-109.5, 36.2],
  'US:Minnesota, Wisconsin, Michigan, North Dakota': [-90.0, 46.5],
  'US:South Dakota, Nebraska, Montana': [-102.0, 44.0],
  'US:Alaska': [-153.0, 64.2],
  'VE': [-66.9, 10.5],          // Venezuela
  'UY': [-56.2, -34.9],         // Uruguay

  // ── Asia ────────────────────────────────────────────────
  'AE': [54.4, 24.5],          // UAE
  'AF': [69.2, 34.5],          // Afghanistan
  'AM': [44.5, 40.2],          // Armenia
  'AZ': [49.9, 40.4],          // Azerbaijan
  'BD': [90.4, 23.7],          // Bangladesh
  'BH': [50.6, 26.2],          // Bahrain
  'BN': [114.9, 4.9],          // Brunei
  'BT': [89.6, 27.5],          // Bhutan
  'CN': [104.2, 35.9],         // China
  'CN:Hong Kong': [114.2, 22.3],
  'CN:Guangdong, Hong Kong, Macau': [113.3, 23.1],
  'CN:Tibet': [91.1, 29.6],
  'CN:Xinjiang': [87.6, 43.8],
  'GE': [44.8, 41.7],          // Georgia
  'HK': [114.2, 22.3],         // Hong Kong
  'ID': [110.4, -7.0],         // Indonesia
  'IL': [34.8, 31.0],          // Israel
  'IN': [78.0, 21.0],          // India (general)
  'IN:West Bengal, Tripura': [88.4, 22.6],
  'IN:Northern India': [77.2, 28.6],
  'IN:Southern India': [78.5, 13.1],
  'IN:Kerala': [76.3, 10.5],
  'IN:Tamil Nadu': [78.7, 11.1],
  'IN:Andhra Pradesh, Telangana': [78.5, 17.4],
  'IN:Karnataka': [75.7, 15.3],
  'IN:Punjab': [75.3, 31.1],
  'IN:Gujarat': [72.0, 23.0],
  'IN:Maharashtra': [75.7, 19.7],
  'IN:Assam': [92.0, 26.1],
  'IN:Odisha': [84.0, 20.5],
  'IQ': [44.4, 33.3],          // Iraq
  'IR': [51.4, 35.7],          // Iran
  'JO': [35.9, 31.9],          // Jordan
  'JP': [139.7, 35.7],         // Japan
  'KG': [74.6, 42.9],          // Kyrgyzstan
  'KH': [104.9, 11.5],         // Cambodia
  'KR': [127.0, 37.6],         // South Korea
  'KP': [125.7, 39.0],         // North Korea
  'KW': [47.9, 29.4],          // Kuwait
  'KZ': [71.4, 51.2],          // Kazakhstan
  'LA': [102.6, 17.9],         // Laos
  'LB': [35.5, 33.9],          // Lebanon
  'LK': [80.6, 7.9],           // Sri Lanka
  'MM': [96.2, 16.9],          // Myanmar
  'MN': [106.9, 47.9],         // Mongolia
  'MO': [113.5, 22.2],         // Macau
  'MY': [101.7, 3.1],          // Malaysia
  'NP': [85.3, 27.7],          // Nepal
  'OM': [58.5, 23.6],          // Oman
  'PH': [121.0, 14.6],         // Philippines (general)
  'PH:Bicol Region': [123.5, 13.4],
  'PH:Ilocos Region, Cordillera': [120.5, 17.6],
  'PH:Cebu, Bohol': [123.9, 10.3],
  'PH:Western Visayas': [122.6, 11.0],
  'PH:Central Visayas': [123.9, 10.3],
  'PH:Pangasinan': [120.3, 16.0],
  'PH:Central Luzon': [120.7, 15.5],
  'PH:Metro Manila, Southern Tagalog': [121.0, 14.4],
  'PH:Lanao del Sur, Lanao del Norte': [124.0, 8.0],
  'PH:Sulu Archipelago': [121.0, 6.0],
  'PH:Cordillera Administrative Region': [121.2, 16.4],
  'PH:Mountain Province, Benguet': [120.9, 16.8],
  'PH:Ifugao Province': [121.1, 16.8],
  'PH:Mindoro': [121.1, 12.5],
  'PH:Zamboanga Peninsula': [122.1, 7.8],
  'PH:Cotabato, Maguindanao': [124.8, 7.2],
  'PK': [73.0, 33.7],          // Pakistan
  'PS': [35.2, 31.9],          // Palestine
  'QA': [51.5, 25.3],          // Qatar
  'SA': [46.7, 24.7],          // Saudi Arabia
  'SG': [103.8, 1.4],          // Singapore
  'SY': [36.3, 33.5],          // Syria
  'TH': [100.5, 13.8],         // Thailand
  'TJ': [68.8, 38.6],          // Tajikistan
  'TM': [58.4, 37.9],          // Turkmenistan
  'TR': [32.9, 39.9],          // Turkey
  'TW': [120.9, 23.7],         // Taiwan
  'UZ': [69.2, 41.3],          // Uzbekistan
  'VN': [105.8, 21.0],         // Vietnam
  'YE': [44.2, 15.4],          // Yemen

  // ── Europe ──────────────────────────────────────────────
  'AL': [19.8, 41.3],          // Albania
  'AT': [16.4, 48.2],          // Austria
  'BA': [18.4, 43.9],          // Bosnia
  'BE': [4.4, 50.8],           // Belgium
  'BG': [23.3, 42.7],          // Bulgaria
  'BY': [27.6, 53.9],          // Belarus
  'CH': [8.5, 47.4],           // Switzerland
  'CY': [33.4, 35.2],          // Cyprus
  'CZ': [14.4, 50.1],          // Czech Republic
  'DE': [10.5, 51.2],          // Germany
  'DK': [9.5, 56.3],           // Denmark
  'EE': [24.7, 58.6],          // Estonia
  'ES': [-3.7, 40.4],          // Spain
  'FI': [25.7, 61.9],          // Finland
  'FO': [-6.9, 62.0],          // Faroe Islands
  'FR': [2.3, 46.6],           // France
  'GB': [-1.2, 52.4],          // UK
  'GL': [-42.0, 64.2],         // Greenland
  'GR': [23.7, 37.9],          // Greece
  'HR': [15.9, 45.8],          // Croatia
  'HU': [19.0, 47.5],          // Hungary
  'IE': [-8.2, 53.1],          // Ireland
  'IS': [-18.9, 64.9],         // Iceland
  'IT': [12.5, 41.9],          // Italy
  'LI': [9.6, 47.1],           // Liechtenstein
  'LT': [23.9, 54.9],          // Lithuania
  'LU': [6.1, 49.6],           // Luxembourg
  'LV': [24.1, 56.9],          // Latvia
  'ME': [19.3, 42.4],          // Montenegro
  'MK': [21.4, 41.5],          // North Macedonia
  'MT': [14.5, 35.9],          // Malta
  'NL': [5.3, 52.2],           // Netherlands
  'NO': [10.8, 59.9],          // Norway
  'PL': [19.1, 51.9],          // Poland
  'PT': [-9.1, 38.7],          // Portugal
  'RO': [26.1, 44.4],          // Romania
  'RS': [20.5, 44.8],          // Serbia
  'RU': [37.6, 55.8],          // Russia
  'SE': [18.1, 59.3],          // Sweden
  'SI': [14.5, 46.1],          // Slovenia
  'SK': [19.7, 48.7],          // Slovakia
  'UA': [30.5, 50.5],          // Ukraine
  'XK': [21.0, 42.6],          // Kosovo

  // ── Oceania ─────────────────────────────────────────────
  'AU': [133.8, -25.3],        // Australia
  'FJ': [178.0, -17.8],        // Fiji
  'NZ': [174.8, -41.3],        // New Zealand
  'PG': [147.2, -6.3],         // Papua New Guinea
  'PF': [-149.4, -17.7],       // French Polynesia
  'SB': [160.0, -9.4],         // Solomon Islands
  'TO': [-175.2, -21.2],       // Tonga
  'VU': [168.3, -17.7],        // Vanuatu
  'WS': [-172.1, -13.8],       // Samoa
  'CK': [-159.8, -21.2],       // Cook Islands
  'NU': [-169.9, -19.1],       // Niue
};

// ── Main ──────────────────────────────────────────────────────────

function resolveCoordinates(region) {
  if (!region.countryCode) return null;
  const cc = region.countryCode;

  // Try specific region match first (e.g., "CA:Saskatchewan, Alberta, Manitoba")
  if (region.region) {
    const specificKey = `${cc}:${region.region}`;
    if (COORDS[specificKey]) return COORDS[specificKey];

    // Try partial match — check if any key starts with "CC:" and the region contains it
    for (const [key, coords] of Object.entries(COORDS)) {
      if (key.startsWith(`${cc}:`) && region.region.includes(key.split(':')[1])) {
        return coords;
      }
    }
  }

  // Fall back to country-level
  return COORDS[cc] || null;
}

function processCard(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const card = JSON.parse(raw);

  if (!card.regions || !Array.isArray(card.regions)) return 0;

  let modified = 0;
  for (const region of card.regions) {
    if (region.coordinates) continue; // Already has coordinates

    const coords = resolveCoordinates(region);
    if (coords) {
      region.coordinates = coords;
      modified++;
    }
  }

  if (modified > 0 && !DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
  }

  return modified;
}

// ── Run ───────────────────────────────────────────────────────────

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Add Region Coordinates to Language Cards             ║');
console.log('╚════════════════════════════════════════════════════════╝');
if (DRY_RUN) console.log('  (DRY RUN — no files will be modified)\n');

const files = fs.readdirSync(CARDS_DIR)
  .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

let totalCards = 0;
let totalCoords = 0;
let cardsModified = 0;
const unresolved = [];

for (const file of files) {
  const filePath = path.join(CARDS_DIR, file);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  totalCards++;

  if (!card.regions || !Array.isArray(card.regions)) continue;

  const modified = processCard(filePath);
  if (modified > 0) {
    cardsModified++;
    totalCoords += modified;
    console.log(`  ✅ ${card.code}: ${modified} coordinates added`);
  }

  // Check for unresolved
  for (const region of card.regions) {
    if (!region.coordinates) {
      unresolved.push(`${card.code}: ${region.country} (${region.countryCode}) — ${region.region || 'no region'}`);
    }
  }
}

console.log('\n── Summary ──');
console.log(`  Cards processed:  ${totalCards}`);
console.log(`  Cards modified:   ${cardsModified}`);
console.log(`  Coords added:     ${totalCoords}`);

if (unresolved.length > 0) {
  console.log(`\n  ⚠️  Unresolved (${unresolved.length}):`);
  for (const u of unresolved) {
    console.log(`    - ${u}`);
  }
}

console.log('\n  Done.\n');
