#!/usr/bin/env node

/**
 * derive-encyclopedic-from-classification.mjs
 * ────────────────────────────────────────────────────────────────
 * Derives basic encyclopedic context for under-documented languages
 * from data already present on the card: classification, countries,
 * macroarea, vitality, speakerEstimates, and coordinates.
 *
 * MAXIMIN RATIONALE:
 *   3,287 languages have NO encyclopedic data at all. Even a
 *   machine-derived summary like "Austronesian language of Papua
 *   New Guinea with ~2,000 speakers (shifting)" is valuable
 *   context for MT researchers working with these languages.
 *
 * WHAT THIS DERIVES:
 *   encyclopedic.summary — A one-sentence factual summary composed
 *   from authoritative card fields. Every fact in the summary is
 *   already cited elsewhere on the card.
 *
 * WHAT THIS DOES NOT DO:
 *   - No external API calls
 *   - No guessing or hallucination
 *   - No overwriting existing encyclopedic data
 *   - Every fact in the summary traces to a specific card field
 *
 * Usage:
 *   node scripts/derive-encyclopedic-from-classification.mjs
 *   node scripts/derive-encyclopedic-from-classification.mjs --dry-run
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const CARDS_DIR = path.join(CLI_ROOT, 'shared', 'language-cards');
const DRY_RUN = process.argv.includes('--dry-run');

// ISO 3166-1 alpha-2 to country name mapping (most common in our dataset)
const COUNTRY_NAMES = {
  AF:'Afghanistan',AL:'Albania',DZ:'Algeria',AO:'Angola',AR:'Argentina',AM:'Armenia',AU:'Australia',
  AT:'Austria',AZ:'Azerbaijan',BD:'Bangladesh',BY:'Belarus',BE:'Belgium',BJ:'Benin',BT:'Bhutan',
  BO:'Bolivia',BA:'Bosnia and Herzegovina',BW:'Botswana',BR:'Brazil',BN:'Brunei',BG:'Bulgaria',
  BF:'Burkina Faso',BI:'Burundi',KH:'Cambodia',CM:'Cameroon',CA:'Canada',CF:'Central African Republic',
  TD:'Chad',CL:'Chile',CN:'China',CO:'Colombia',KM:'Comoros',CG:'Republic of the Congo',
  CD:'Democratic Republic of the Congo',CR:'Costa Rica',CI:"Côte d'Ivoire",HR:'Croatia',CU:'Cuba',
  CZ:'Czechia',DK:'Denmark',DJ:'Djibouti',DO:'Dominican Republic',EC:'Ecuador',EG:'Egypt',
  SV:'El Salvador',GQ:'Equatorial Guinea',ER:'Eritrea',EE:'Estonia',SZ:'Eswatini',ET:'Ethiopia',
  FJ:'Fiji',FI:'Finland',FR:'France',GA:'Gabon',GM:'Gambia',GE:'Georgia',DE:'Germany',GH:'Ghana',
  GR:'Greece',GT:'Guatemala',GN:'Guinea',GW:'Guinea-Bissau',GY:'Guyana',HT:'Haiti',HN:'Honduras',
  HU:'Hungary',IS:'Iceland',IN:'India',ID:'Indonesia',IR:'Iran',IQ:'Iraq',IE:'Ireland',IL:'Israel',
  IT:'Italy',JM:'Jamaica',JP:'Japan',JO:'Jordan',KZ:'Kazakhstan',KE:'Kenya',KG:'Kyrgyzstan',
  LA:'Laos',LV:'Latvia',LB:'Lebanon',LS:'Lesotho',LR:'Liberia',LY:'Libya',LT:'Lithuania',
  MG:'Madagascar',MW:'Malawi',MY:'Malaysia',ML:'Mali',MR:'Mauritania',MX:'Mexico',FM:'Micronesia',
  MD:'Moldova',MN:'Mongolia',ME:'Montenegro',MA:'Morocco',MZ:'Mozambique',MM:'Myanmar',NA:'Namibia',
  NP:'Nepal',NL:'Netherlands',NZ:'New Zealand',NI:'Nicaragua',NE:'Niger',NG:'Nigeria',KP:'North Korea',
  MK:'North Macedonia',NO:'Norway',OM:'Oman',PK:'Pakistan',PS:'Palestine',PA:'Panama',
  PG:'Papua New Guinea',PY:'Paraguay',PE:'Peru',PH:'Philippines',PL:'Poland',PT:'Portugal',
  QA:'Qatar',RO:'Romania',RU:'Russia',RW:'Rwanda',SA:'Saudi Arabia',SN:'Senegal',RS:'Serbia',
  SL:'Sierra Leone',SG:'Singapore',SK:'Slovakia',SI:'Slovenia',SB:'Solomon Islands',SO:'Somalia',
  ZA:'South Africa',KR:'South Korea',SS:'South Sudan',ES:'Spain',LK:'Sri Lanka',SD:'Sudan',
  SR:'Suriname',SE:'Sweden',CH:'Switzerland',SY:'Syria',TW:'Taiwan',TJ:'Tajikistan',TZ:'Tanzania',
  TH:'Thailand',TL:'Timor-Leste',TG:'Togo',TO:'Tonga',TT:'Trinidad and Tobago',TN:'Tunisia',
  TR:'Turkey',TM:'Turkmenistan',UG:'Uganda',UA:'Ukraine',AE:'United Arab Emirates',GB:'United Kingdom',
  US:'United States',UY:'Uruguay',UZ:'Uzbekistan',VU:'Vanuatu',VE:'Venezuela',VN:'Vietnam',
  YE:'Yemen',ZM:'Zambia',ZW:'Zimbabwe',WS:'Samoa',NC:'New Caledonia',PF:'French Polynesia',
  GU:'Guam',AS:'American Samoa',MP:'Northern Mariana Islands',VI:'US Virgin Islands',
  PR:'Puerto Rico',MH:'Marshall Islands',PW:'Palau',CK:'Cook Islands',NU:'Niue',TK:'Tokelau',
  TV:'Tuvalu',NR:'Nauru',KI:'Kiribati',WF:'Wallis and Futuna',
};

/**
 * Build a factual summary sentence from existing card data.
 * Every clause cites its source field.
 */
function buildSummary(card) {
  const parts = [];

  // Language family
  const family = card.classification?.family;
  if (family) {
    parts.push(`${family} language`);
  } else if (card.isIsolate) {
    parts.push('language isolate');
  } else {
    parts.push('language');
  }

  // Geographic context (countries)
  if (card.countries && Array.isArray(card.countries) && card.countries.length > 0) {
    const countryNames = card.countries
      .map(c => {
        const code = typeof c === 'string' ? c : c.code;
        return COUNTRY_NAMES[code] || code; // Resolve ISO code to full name
      })
      .filter(Boolean);
    if (countryNames.length <= 3) {
      parts.push(`of ${countryNames.join(', ')}`);
    } else {
      parts.push(`of ${countryNames.slice(0, 2).join(', ')} and ${countryNames.length - 2} other countries`);
    }
  } else if (card.macroarea) {
    parts.push(`of ${card.macroarea}`);
  }

  // Speaker count
  if (card.speakerEstimates && Array.isArray(card.speakerEstimates) && card.speakerEstimates.length > 0) {
    const latest = card.speakerEstimates[card.speakerEstimates.length - 1];
    const count = latest.count ?? latest.estimate;
    if (typeof count === 'number') {
      if (count === 0) {
        parts.push('with no known L1 speakers');
      } else if (count < 100) {
        parts.push(`with fewer than 100 speakers`);
      } else if (count < 1000) {
        parts.push(`with approximately ${count.toLocaleString()} speakers`);
      } else {
        // Round to significant figures for readability
        const magnitude = Math.pow(10, Math.floor(Math.log10(count)));
        const rounded = Math.round(count / magnitude) * magnitude;
        parts.push(`with approximately ${rounded.toLocaleString()} speakers`);
      }
    }
  }

  // Vitality status
  if (card.vitality && typeof card.vitality === 'object') {
    const status = card.vitality.status || card.vitality.aesStatus;
    if (status) {
      const statusMap = {
        'not endangered': '',  // Don't state the obvious
        'safe': '',
        'vulnerable': '(vulnerable)',
        'threatened': '(threatened)',
        'shifting': '(shifting)',
        'moribund': '(moribund)',
        'nearly extinct': '(nearly extinct)',
        'critically endangered': '(critically endangered)',
        'severely endangered': '(severely endangered)',
        'definitely endangered': '(definitely endangered)',
        'extinct': '(extinct)',
        'dormant': '(dormant)',
        'awakening': '(awakening)',
      };
      const note = statusMap[status.toLowerCase()];
      if (note) parts.push(note);
    }
  }

  // Script — only mention non-Latin scripts since Latin is unremarkable
  if (card.script) {
    const scriptName = card.scriptUnicodeName || card.script;
    if (scriptName && scriptName !== 'Latn' && scriptName !== 'Latin') {
      parts.push(`written in ${scriptName}`);
    }
  } else if (card.orthographicStatus === 'unwritten') {
    parts.push('(unwritten)');
  }

  if (parts.length < 2) return null; // Not enough data for a useful summary

  // Capitalize first letter and join
  let summary = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  // Join remaining parts
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('(')) {
      summary += ' ' + part;
    } else {
      summary += ' ' + part;
    }
  }
  summary += '.';

  return summary;
}

function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Encyclopedic Summary Derivation from Card Data');
  console.log('  Source: Derived from existing authoritative card fields');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let enriched = 0;
  let skippedExisting = 0;
  let skippedInsufficient = 0;
  const examples = [];

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    // Skip cards that already have encyclopedic data
    if (card.encyclopedic && Object.keys(card.encyclopedic).length > 0) {
      skippedExisting++;
      continue;
    }

    const summary = buildSummary(card);
    if (!summary) {
      skippedInsufficient++;
      continue;
    }

    // Set encyclopedic with derived summary
    card.encyclopedic = {
      summary: summary,
      _derived: true,
    };

    // Source attribution — the summary is derived from multiple card fields,
    // each of which has its own source. The summary itself is a derivation.
    if (!card._fieldSources) card._fieldSources = {};
    card._fieldSources.encyclopedic = 'derived-from-card-fields (classification, countries, speakerEstimates, vitality)';

    enriched++;
    if (examples.length < 5) {
      examples.push(`  ${card.code} (${card.name}): ${summary}`);
    }

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
    }
  }

  console.log(`  RESULTS:`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Cards processed:              ${cardFiles.length.toLocaleString()}`);
  console.log(`  Cards enriched:               ${enriched.toLocaleString()}`);
  console.log(`  Skipped (has encyclopedic):    ${skippedExisting.toLocaleString()}`);
  console.log(`  Skipped (insufficient data):   ${skippedInsufficient.toLocaleString()}`);
  console.log();
  if (examples.length > 0) {
    console.log('  Examples:');
    for (const ex of examples) console.log(ex);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
