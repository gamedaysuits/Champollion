#!/usr/bin/env node

/**
 * derive-contacts-from-areal.mjs
 * ────────────────────────────────────────────────────────────────
 * Derives contactInfluences from known Sprachbunds (linguistic
 * areas) and colonial/trade language overlay.
 *
 * Uses coordinates and country codes to assign languages to known
 * linguistic areas, then documents the expected contact languages.
 *
 * Sources:
 *   - Campbell, Lyle. 2017. "Why is it so hard to define a
 *     linguistic area?" In The Cambridge Handbook of Areal Ling.
 *   - Thomason, Sarah G. 2001. Language Contact. Edinburgh UP.
 *   - Matras, Yaron. 2009. Language Contact. Cambridge UP.
 *
 * Merge-only: never overwrites existing contactInfluences.
 *
 * Usage:
 *   node scripts/derive-contacts-from-areal.mjs
 *   node scripts/derive-contacts-from-areal.mjs --dry-run
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Known Sprachbunds and Areal Contact Zones ──
// Each zone is defined by geographic bounds + known contact languages
// that have historically influenced languages in the area.
const AREAL_ZONES = [
  {
    name: 'Mainland Southeast Asian Sprachbund',
    bounds: { latMin: 5, latMax: 30, lonMin: 90, lonMax: 115 },
    countries: ['TH', 'VN', 'KH', 'LA', 'MM'],
    contacts: [
      { language: 'Classical Chinese', type: 'literary/lexical', period: 'historical', description: 'Extensive lexical borrowing from Classical Chinese across the region, especially in Vietnamese, Thai, and Khmer.' },
      { language: 'Sanskrit/Pali', type: 'religious/lexical', period: 'historical', description: 'Sanskrit and Pali borrowings via Hinduism and Theravada Buddhism. Affects register, formal vocabulary, and literary traditions.' },
    ],
    features: 'Tonal convergence, classifier systems, topic-prominence, monosyllabicity trend (Campbell 2017).',
    source: 'areal-linguistics (Enfield 2005, Matisoff 2001)',
  },
  {
    name: 'South Asian Sprachbund',
    bounds: { latMin: 5, latMax: 37, lonMin: 60, lonMax: 100 },
    countries: ['IN', 'PK', 'BD', 'LK', 'NP', 'BT'],
    contacts: [
      { language: 'Sanskrit', type: 'literary/lexical', period: 'historical', description: 'Sanskrit influence via Hindu-Buddhist literary tradition. Massive lexical layer in most South Asian languages.' },
      { language: 'Persian', type: 'literary/administrative', period: 'Mughal era', description: 'Persian borrowings via Mughal administration (1526-1857). Particularly strong in Urdu, Hindi, Bengali.' },
      { language: 'English', type: 'colonial/modern', period: 'British Raj onwards', description: 'English as colonial and post-colonial prestige language. Technical, legal, academic vocabulary extensively borrowed.' },
      { language: 'Arabic', type: 'religious/lexical', period: 'Islamic period', description: 'Arabic loanwords via Islam, especially in Urdu, Bengali, and Malay-influenced languages.' },
    ],
    features: 'Retroflex consonants, SOV convergence, dative subjects, quotative constructions (Emeneau 1956, Masica 1976).',
    source: 'areal-linguistics (Emeneau 1956, Masica 1976)',
  },
  {
    name: 'Mesoamerican Sprachbund',
    bounds: { latMin: 14, latMax: 24, lonMin: -105, lonMax: -84 },
    countries: ['MX', 'GT', 'BZ', 'HN', 'SV'],
    contacts: [
      { language: 'Classical Nahuatl', type: 'lingua franca', period: 'pre-Columbian', description: 'Nahuatl as pre-Columbian trade language. Widespread lexical influence across Mesoamerican families.' },
      { language: 'Spanish', type: 'colonial/modern', period: '1519–present', description: 'Spanish colonial and continued national language. Massive lexical borrowing, code-switching in modern speech.' },
    ],
    features: 'Vigesimal numerals, relational nouns, possessed body-part classifiers (Campbell et al. 1986).',
    source: 'areal-linguistics (Campbell et al. 1986)',
  },
  {
    name: 'Balkan Sprachbund',
    bounds: { latMin: 38, latMax: 47, lonMin: 16, lonMax: 30 },
    countries: ['AL', 'BG', 'GR', 'MK', 'RO', 'RS', 'XK', 'ME', 'BA'],
    contacts: [
      { language: 'Greek', type: 'literary/lexical', period: 'ancient–present', description: 'Greek as literary and Byzantine administrative language. Deep lexical and structural influence.' },
      { language: 'Turkish/Ottoman', type: 'administrative/lexical', period: 'Ottoman period', description: 'Ottoman Turkish lexical influence (1299-1922). Administrative, military, culinary vocabulary.' },
      { language: 'Latin/Romance', type: 'substrate/literary', period: 'Roman period', description: 'Latin substrate influence, particularly strong in Romanian.' },
    ],
    features: 'Postposed definite articles, loss of infinitive, evidential mood, case syncretism (Joseph 1992, Friedman 2006).',
    source: 'areal-linguistics (Joseph 1992, Friedman 2006)',
  },
  {
    name: 'Ethiopian Linguistic Area',
    bounds: { latMin: 3, latMax: 15, lonMin: 33, lonMax: 48 },
    countries: ['ET', 'ER'],
    contacts: [
      { language: "Ge'ez", type: 'literary/religious', period: 'historical', description: "Ge'ez as classical liturgical language of the Ethiopian Orthodox Church. Lexical influence on all Ethiopian Semitic languages." },
      { language: 'Amharic', type: 'lingua franca', period: 'medieval–present', description: 'Amharic as national lingua franca. Lexical influence on neighboring Cushitic and Omotic languages.' },
    ],
    features: 'Ejective consonants, SOV order, converb-heavy syntax, gerund forms (Ferguson 1976, Crass & Meyer 2008).',
    source: 'areal-linguistics (Ferguson 1976, Crass & Meyer 2008)',
  },
  {
    name: 'West African Convergence Area',
    bounds: { latMin: 4, latMax: 18, lonMin: -17, lonMax: 16 },
    countries: ['NG', 'GH', 'SN', 'ML', 'BF', 'BJ', 'TG', 'CI', 'NE', 'GN', 'SL', 'LR', 'GM'],
    contacts: [
      { language: 'Arabic', type: 'religious/literary', period: 'Islamic period', description: 'Arabic influence via Islam. Ajami script tradition, religious vocabulary, and scholarly terms.' },
      { language: 'Hausa', type: 'trade lingua franca', period: 'historical–present', description: 'Hausa as major West African trade language. Lexical influence on neighboring languages.' },
      { language: 'French/English/Portuguese', type: 'colonial/modern', period: 'colonial era–present', description: 'European colonial languages as official languages. Technical, administrative, educational vocabulary borrowed extensively.' },
    ],
    features: 'Labial-velar consonants, extensive tone systems, serial verb constructions, logophoric pronouns (Heine & Nurse 2008).',
    source: 'areal-linguistics (Heine & Nurse 2008)',
  },
];

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Contact Influences from Areal Linguistics');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let enriched = 0;
  const byZone = {};

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    // Only populate if contactInfluences is empty/null
    const ci = card.contactInfluences;
    if (ci !== null && !(Array.isArray(ci) && ci.length === 0)) continue;

    // Match against areal zones using coordinates and country
    const coords = card.coordinates;
    const countries = card.countries || [];

    let matchedZone = null;

    for (const zone of AREAL_ZONES) {
      // Check geographic bounds
      if (coords) {
        const lat = coords.lat ?? coords.latitude;
        const lon = coords.lng ?? coords.lon ?? coords.longitude;
        if (lat >= zone.bounds.latMin && lat <= zone.bounds.latMax &&
            lon >= zone.bounds.lonMin && lon <= zone.bounds.lonMax) {
          matchedZone = zone;
          break;
        }
      }

      // Fall back to country code matching
      if (!matchedZone && countries.length > 0) {
        for (const cc of countries) {
          if (zone.countries.includes(cc)) {
            matchedZone = zone;
            break;
          }
        }
        if (matchedZone) break;
      }
    }

    if (!matchedZone) continue;

    // Don't assign contact data of a language's own family
    // (e.g., don't list "Sanskrit" as contact for Sanskrit itself)
    const langName = card.name?.toLowerCase() || '';
    const contacts = matchedZone.contacts.filter(c =>
      !langName.includes(c.language.toLowerCase().split('/')[0])
    );
    if (contacts.length === 0) continue;

    card.contactInfluences = {
      arealZone: matchedZone.name,
      arealFeatures: matchedZone.features,
      contacts: contacts,
      source: matchedZone.source,
    };

    // Source attribution
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.contactInfluences = matchedZone.source;

    byZone[matchedZone.name] = (byZone[matchedZone.name] || 0) + 1;
    enriched++;

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards enriched:  ${enriched.toLocaleString()}`);
  for (const [zone, count] of Object.entries(byZone).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${zone}: ${count}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
