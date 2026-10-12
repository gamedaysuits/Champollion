#!/usr/bin/env node

/**
 * compute-natural-pairs.mjs
 * ─────────────────────────────────────────────────────────────────
 * Derives the most natural major translation pair for each language
 * card and writes them as staged JSON (B4 of the champollion.db
 * retirement — this script no longer reads the legacy sqlite store
 * or writes the `natural_pairs` table).
 *
 * Inputs are the language cards in cli/shared/language-cards/, read
 * through normalizeCard() (the ONE card adapter — never bare
 * JSON.parse; it resolves the attributed name envelope to a string).
 * Locale cards (identified by their `locale` block) and the ISO
 * special codes mis/mul/und/zxx are excluded. The "pair language
 * exists" check is now "is there a language card for that code".
 *
 * KNOWN CONSEQUENCE OF THE INPUT CHANGE — "primary country":
 *   The legacy db's `countries` array put the primary country first.
 *   A card's `countries[]` is Glottolog's list, ALPHABETICAL by
 *   ISO 3166 code — so "first country" is now alphabetical-first,
 *   not primacy. This is invisible for the majority of languages
 *   (spoken in one or two countries) but shifts the pair for some
 *   multi-country majors: e.g. fra's first country is AD (Andorra),
 *   so its pair derives from Andorra's official language (Catalan)
 *   rather than France's. The algorithm ("official language of the
 *   first listed country") is preserved verbatim; if primacy matters
 *   to a consumer, the fix is a cited primary-country source, not a
 *   silent re-sort here.
 *
 * Algorithm (unchanged semantics):
 *   1. Build a country→official-language map (200+ countries) using
 *      ISO 3166-1 alpha-2 → ISO 639-3 official language codes.
 *   2. For each language, look at its card's `countries` array.
 *   3. The natural pair is the official language of the primary
 *      country (first in the array), UNLESS the language IS the
 *      official language of that country.
 *   4. For languages that ARE the official language: pair with
 *      English (the default international pair).
 *
 * The `rationale` is descriptive, e.g.:
 *   'National language of Brazil (Portuguese)'
 *   'Official language of Canada (English/French)'
 *
 * Output:
 *   mt-eval-arena/data/staging/tc-natural-pairs.json
 *   { <code>: { code, name, rationale,
 *               source: 'derived-from-country-official-language' }, … }
 *
 * Usage:
 *   node scripts/compute-natural-pairs.mjs              # live run
 *   node scripts/compute-natural-pairs.mjs --dry-run    # preview
 *   node scripts/compute-natural-pairs.mjs --lang aqz   # single lang
 * ─────────────────────────────────────────────────────────────────
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readCard, listCodes, normalizeCard } from '../lib/cards/reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const OUT_DIR = path.join(__dirname, '..', '..', 'mt-eval-arena', 'data', 'staging');
const OUT_PATH = path.join(OUT_DIR, 'tc-natural-pairs.json');

const SCRIPT_NAME = 'compute-natural-pairs.mjs';
const SOURCE = 'derived-from-country-official-language';

// ISO special codes are not languages; they never get a pair.
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

// ── Country → Official Language Map ───────────────────────────
//
// Maps ISO 3166-1 alpha-2 country codes to their primary official
// language using ISO 639-3 codes. When a country has multiple
// official languages, the most widely used one is listed first.
//
// Sources:
//   - CIA World Factbook (official/national languages)
//   - Ethnologue (primary language by speaker count)
//   - ISO 639-3 code table
//
// We use ISO 639-3 codes throughout (e.g. 'arb' for Standard Arabic,
// 'cmn' for Mandarin Chinese, 'swh' for Swahili) because that's
// what our database uses — NOT ISO 639-1 macrolanguage codes.

const COUNTRY_OFFICIAL_LANGUAGE = {
  // ── Africa ──────────────────────────────────────────────────
  'DZ': { code: 'arb', name: 'Standard Arabic',     country: 'Algeria' },
  'AO': { code: 'por', name: 'Portuguese',           country: 'Angola' },
  'BJ': { code: 'fra', name: 'French',               country: 'Benin' },
  'BW': { code: 'eng', name: 'English',              country: 'Botswana' },
  'BF': { code: 'fra', name: 'French',               country: 'Burkina Faso' },
  'BI': { code: 'fra', name: 'French',               country: 'Burundi' },
  'CV': { code: 'por', name: 'Portuguese',            country: 'Cabo Verde' },
  'CM': { code: 'fra', name: 'French',               country: 'Cameroon' },
  'CF': { code: 'fra', name: 'French',               country: 'Central African Republic' },
  'TD': { code: 'fra', name: 'French',               country: 'Chad' },
  'KM': { code: 'fra', name: 'French',               country: 'Comoros' },
  'CG': { code: 'fra', name: 'French',               country: 'Congo (Brazzaville)' },
  'CD': { code: 'fra', name: 'French',               country: 'Congo (DRC)' },
  'CI': { code: 'fra', name: 'French',               country: "Côte d'Ivoire" },
  'DJ': { code: 'fra', name: 'French',               country: 'Djibouti' },
  'EG': { code: 'arb', name: 'Standard Arabic',     country: 'Egypt' },
  'GQ': { code: 'spa', name: 'Spanish',              country: 'Equatorial Guinea' },
  'ER': { code: 'tir', name: 'Tigrinya',             country: 'Eritrea' },
  'SZ': { code: 'eng', name: 'English',              country: 'Eswatini' },
  'ET': { code: 'amh', name: 'Amharic',              country: 'Ethiopia' },
  'GA': { code: 'fra', name: 'French',               country: 'Gabon' },
  'GM': { code: 'eng', name: 'English',              country: 'Gambia' },
  'GH': { code: 'eng', name: 'English',              country: 'Ghana' },
  'GN': { code: 'fra', name: 'French',               country: 'Guinea' },
  'GW': { code: 'por', name: 'Portuguese',            country: 'Guinea-Bissau' },
  'KE': { code: 'eng', name: 'English',              country: 'Kenya' },
  'LS': { code: 'eng', name: 'English',              country: 'Lesotho' },
  'LR': { code: 'eng', name: 'English',              country: 'Liberia' },
  'LY': { code: 'arb', name: 'Standard Arabic',     country: 'Libya' },
  'MG': { code: 'fra', name: 'French',               country: 'Madagascar' },
  'MW': { code: 'eng', name: 'English',              country: 'Malawi' },
  'ML': { code: 'fra', name: 'French',               country: 'Mali' },
  'MR': { code: 'arb', name: 'Standard Arabic',     country: 'Mauritania' },
  'MU': { code: 'eng', name: 'English',              country: 'Mauritius' },
  'MA': { code: 'arb', name: 'Standard Arabic',     country: 'Morocco' },
  'MZ': { code: 'por', name: 'Portuguese',            country: 'Mozambique' },
  'NA': { code: 'eng', name: 'English',              country: 'Namibia' },
  'NE': { code: 'fra', name: 'French',               country: 'Niger' },
  'NG': { code: 'eng', name: 'English',              country: 'Nigeria' },
  'RW': { code: 'eng', name: 'English',              country: 'Rwanda' },
  'ST': { code: 'por', name: 'Portuguese',            country: 'São Tomé and Príncipe' },
  'SN': { code: 'fra', name: 'French',               country: 'Senegal' },
  'SC': { code: 'eng', name: 'English',              country: 'Seychelles' },
  'SL': { code: 'eng', name: 'English',              country: 'Sierra Leone' },
  'SO': { code: 'som', name: 'Somali',               country: 'Somalia' },
  'ZA': { code: 'eng', name: 'English',              country: 'South Africa' },
  'SS': { code: 'eng', name: 'English',              country: 'South Sudan' },
  'SD': { code: 'arb', name: 'Standard Arabic',     country: 'Sudan' },
  'TZ': { code: 'swh', name: 'Swahili',              country: 'Tanzania' },
  'TG': { code: 'fra', name: 'French',               country: 'Togo' },
  'TN': { code: 'arb', name: 'Standard Arabic',     country: 'Tunisia' },
  'UG': { code: 'eng', name: 'English',              country: 'Uganda' },
  'ZM': { code: 'eng', name: 'English',              country: 'Zambia' },
  'ZW': { code: 'eng', name: 'English',              country: 'Zimbabwe' },
  'EH': { code: 'arb', name: 'Standard Arabic',     country: 'Western Sahara' },

  // ── Americas ────────────────────────────────────────────────
  'AG': { code: 'eng', name: 'English',              country: 'Antigua and Barbuda' },
  'AR': { code: 'spa', name: 'Spanish',              country: 'Argentina' },
  'BS': { code: 'eng', name: 'English',              country: 'Bahamas' },
  'BB': { code: 'eng', name: 'English',              country: 'Barbados' },
  'BZ': { code: 'eng', name: 'English',              country: 'Belize' },
  'BO': { code: 'spa', name: 'Spanish',              country: 'Bolivia' },
  'BR': { code: 'por', name: 'Portuguese',            country: 'Brazil' },
  'CA': { code: 'eng', name: 'English',              country: 'Canada' },
  'CL': { code: 'spa', name: 'Spanish',              country: 'Chile' },
  'CO': { code: 'spa', name: 'Spanish',              country: 'Colombia' },
  'CR': { code: 'spa', name: 'Spanish',              country: 'Costa Rica' },
  'CU': { code: 'spa', name: 'Spanish',              country: 'Cuba' },
  'DM': { code: 'eng', name: 'English',              country: 'Dominica' },
  'DO': { code: 'spa', name: 'Spanish',              country: 'Dominican Republic' },
  'EC': { code: 'spa', name: 'Spanish',              country: 'Ecuador' },
  'SV': { code: 'spa', name: 'Spanish',              country: 'El Salvador' },
  'GD': { code: 'eng', name: 'English',              country: 'Grenada' },
  'GT': { code: 'spa', name: 'Spanish',              country: 'Guatemala' },
  'GY': { code: 'eng', name: 'English',              country: 'Guyana' },
  'HT': { code: 'fra', name: 'French',               country: 'Haiti' },
  'HN': { code: 'spa', name: 'Spanish',              country: 'Honduras' },
  'JM': { code: 'eng', name: 'English',              country: 'Jamaica' },
  'MX': { code: 'spa', name: 'Spanish',              country: 'Mexico' },
  'NI': { code: 'spa', name: 'Spanish',              country: 'Nicaragua' },
  'PA': { code: 'spa', name: 'Spanish',              country: 'Panama' },
  'PY': { code: 'spa', name: 'Spanish',              country: 'Paraguay' },
  'PE': { code: 'spa', name: 'Spanish',              country: 'Peru' },
  'KN': { code: 'eng', name: 'English',              country: 'Saint Kitts and Nevis' },
  'LC': { code: 'eng', name: 'English',              country: 'Saint Lucia' },
  'VC': { code: 'eng', name: 'English',              country: 'Saint Vincent' },
  'SR': { code: 'nld', name: 'Dutch',                country: 'Suriname' },
  'TT': { code: 'eng', name: 'English',              country: 'Trinidad and Tobago' },
  'US': { code: 'eng', name: 'English',              country: 'United States' },
  'UY': { code: 'spa', name: 'Spanish',              country: 'Uruguay' },
  'VE': { code: 'spa', name: 'Spanish',              country: 'Venezuela' },

  // ── Americas: Territories / Dependencies ────────────────────
  'GF': { code: 'fra', name: 'French',               country: 'French Guiana' },
  'GP': { code: 'fra', name: 'French',               country: 'Guadeloupe' },
  'MQ': { code: 'fra', name: 'French',               country: 'Martinique' },
  'PR': { code: 'spa', name: 'Spanish',              country: 'Puerto Rico' },
  'AW': { code: 'nld', name: 'Dutch',                country: 'Aruba' },
  'CW': { code: 'nld', name: 'Dutch',                country: 'Curaçao' },
  'VI': { code: 'eng', name: 'English',              country: 'US Virgin Islands' },
  'BM': { code: 'eng', name: 'English',              country: 'Bermuda' },
  'KY': { code: 'eng', name: 'English',              country: 'Cayman Islands' },
  'FK': { code: 'eng', name: 'English',              country: 'Falkland Islands' },

  // ── Europe ──────────────────────────────────────────────────
  'AL': { code: 'sqi', name: 'Albanian',              country: 'Albania' },
  'AD': { code: 'cat', name: 'Catalan',              country: 'Andorra' },
  'AT': { code: 'deu', name: 'German',               country: 'Austria' },
  'BY': { code: 'bel', name: 'Belarusian',           country: 'Belarus' },
  'BE': { code: 'nld', name: 'Dutch',                country: 'Belgium' },
  'BA': { code: 'bos', name: 'Bosnian',              country: 'Bosnia and Herzegovina' },
  'BG': { code: 'bul', name: 'Bulgarian',            country: 'Bulgaria' },
  'HR': { code: 'hrv', name: 'Croatian',             country: 'Croatia' },
  'CY': { code: 'ell', name: 'Greek',                country: 'Cyprus' },
  'CZ': { code: 'ces', name: 'Czech',                country: 'Czechia' },
  'DK': { code: 'dan', name: 'Danish',               country: 'Denmark' },
  'EE': { code: 'est', name: 'Estonian',              country: 'Estonia' },
  'FI': { code: 'fin', name: 'Finnish',              country: 'Finland' },
  'FR': { code: 'fra', name: 'French',               country: 'France' },
  'DE': { code: 'deu', name: 'German',               country: 'Germany' },
  'GR': { code: 'ell', name: 'Greek',                country: 'Greece' },
  'HU': { code: 'hun', name: 'Hungarian',            country: 'Hungary' },
  'IS': { code: 'isl', name: 'Icelandic',            country: 'Iceland' },
  'IE': { code: 'eng', name: 'English',              country: 'Ireland' },
  'IT': { code: 'ita', name: 'Italian',              country: 'Italy' },
  'XK': { code: 'sqi', name: 'Albanian',             country: 'Kosovo' },
  'LV': { code: 'lav', name: 'Latvian',              country: 'Latvia' },
  'LI': { code: 'deu', name: 'German',               country: 'Liechtenstein' },
  'LT': { code: 'lit', name: 'Lithuanian',           country: 'Lithuania' },
  'LU': { code: 'fra', name: 'French',               country: 'Luxembourg' },
  'MT': { code: 'mlt', name: 'Maltese',              country: 'Malta' },
  'MD': { code: 'ron', name: 'Romanian',              country: 'Moldova' },
  'MC': { code: 'fra', name: 'French',               country: 'Monaco' },
  'ME': { code: 'cnr', name: 'Montenegrin',           country: 'Montenegro' },
  'NL': { code: 'nld', name: 'Dutch',                country: 'Netherlands' },
  'MK': { code: 'mkd', name: 'Macedonian',           country: 'North Macedonia' },
  'NO': { code: 'nob', name: 'Norwegian Bokmål',     country: 'Norway' },
  'PL': { code: 'pol', name: 'Polish',               country: 'Poland' },
  'PT': { code: 'por', name: 'Portuguese',            country: 'Portugal' },
  'RO': { code: 'ron', name: 'Romanian',              country: 'Romania' },
  'RU': { code: 'rus', name: 'Russian',              country: 'Russia' },
  'SM': { code: 'ita', name: 'Italian',              country: 'San Marino' },
  'RS': { code: 'srp', name: 'Serbian',              country: 'Serbia' },
  'SK': { code: 'slk', name: 'Slovak',               country: 'Slovakia' },
  'SI': { code: 'slv', name: 'Slovenian',            country: 'Slovenia' },
  'ES': { code: 'spa', name: 'Spanish',              country: 'Spain' },
  'SE': { code: 'swe', name: 'Swedish',              country: 'Sweden' },
  'CH': { code: 'deu', name: 'German',               country: 'Switzerland' },
  'UA': { code: 'ukr', name: 'Ukrainian',            country: 'Ukraine' },
  'GB': { code: 'eng', name: 'English',              country: 'United Kingdom' },
  'VA': { code: 'ita', name: 'Italian',              country: 'Vatican City' },

  // ── Asia ────────────────────────────────────────────────────
  'AF': { code: 'pes', name: 'Iranian Persian',      country: 'Afghanistan' },
  'AM': { code: 'hye', name: 'Armenian',             country: 'Armenia' },
  'AZ': { code: 'azj', name: 'North Azerbaijani',    country: 'Azerbaijan' },
  'BH': { code: 'arb', name: 'Standard Arabic',     country: 'Bahrain' },
  'BD': { code: 'ben', name: 'Bengali',              country: 'Bangladesh' },
  'BT': { code: 'dzo', name: 'Dzongkha',             country: 'Bhutan' },
  'BN': { code: 'zlm', name: 'Malay',                country: 'Brunei' },
  'KH': { code: 'khm', name: 'Khmer',                country: 'Cambodia' },
  'CN': { code: 'cmn', name: 'Mandarin Chinese',     country: 'China' },
  'GE': { code: 'kat', name: 'Georgian',             country: 'Georgia' },
  'IN': { code: 'hin', name: 'Hindi',                country: 'India' },
  'ID': { code: 'ind', name: 'Indonesian',           country: 'Indonesia' },
  'IR': { code: 'pes', name: 'Iranian Persian',      country: 'Iran' },
  'IQ': { code: 'arb', name: 'Standard Arabic',     country: 'Iraq' },
  'IL': { code: 'heb', name: 'Hebrew',               country: 'Israel' },
  'JP': { code: 'jpn', name: 'Japanese',             country: 'Japan' },
  'JO': { code: 'arb', name: 'Standard Arabic',     country: 'Jordan' },
  'KZ': { code: 'kaz', name: 'Kazakh',               country: 'Kazakhstan' },
  'KW': { code: 'arb', name: 'Standard Arabic',     country: 'Kuwait' },
  'KG': { code: 'kir', name: 'Kyrgyz',               country: 'Kyrgyzstan' },
  'LA': { code: 'lao', name: 'Lao',                  country: 'Laos' },
  'LB': { code: 'arb', name: 'Standard Arabic',     country: 'Lebanon' },
  'MY': { code: 'zlm', name: 'Malay',                country: 'Malaysia' },
  'MV': { code: 'div', name: 'Dhivehi',              country: 'Maldives' },
  'MN': { code: 'khk', name: 'Halh Mongolian',       country: 'Mongolia' },
  'MM': { code: 'mya', name: 'Burmese',              country: 'Myanmar' },
  'NP': { code: 'nep', name: 'Nepali',               country: 'Nepal' },
  'KP': { code: 'kor', name: 'Korean',               country: 'North Korea' },
  'OM': { code: 'arb', name: 'Standard Arabic',     country: 'Oman' },
  'PK': { code: 'urd', name: 'Urdu',                 country: 'Pakistan' },
  'PS': { code: 'arb', name: 'Standard Arabic',     country: 'Palestine' },
  'PH': { code: 'fil', name: 'Filipino',             country: 'Philippines' },
  'QA': { code: 'arb', name: 'Standard Arabic',     country: 'Qatar' },
  'SA': { code: 'arb', name: 'Standard Arabic',     country: 'Saudi Arabia' },
  'SG': { code: 'eng', name: 'English',              country: 'Singapore' },
  'KR': { code: 'kor', name: 'Korean',               country: 'South Korea' },
  'LK': { code: 'sin', name: 'Sinhala',              country: 'Sri Lanka' },
  'SY': { code: 'arb', name: 'Standard Arabic',     country: 'Syria' },
  'TW': { code: 'cmn', name: 'Mandarin Chinese',     country: 'Taiwan' },
  'TJ': { code: 'tgk', name: 'Tajik',                country: 'Tajikistan' },
  'TH': { code: 'tha', name: 'Thai',                 country: 'Thailand' },
  'TL': { code: 'por', name: 'Portuguese',            country: 'Timor-Leste' },
  'TR': { code: 'tur', name: 'Turkish',              country: 'Turkey' },
  'TM': { code: 'tuk', name: 'Turkmen',              country: 'Turkmenistan' },
  'AE': { code: 'arb', name: 'Standard Arabic',     country: 'United Arab Emirates' },
  'UZ': { code: 'uzn', name: 'Northern Uzbek',       country: 'Uzbekistan' },
  'VN': { code: 'vie', name: 'Vietnamese',           country: 'Vietnam' },
  'YE': { code: 'arb', name: 'Standard Arabic',     country: 'Yemen' },

  // ── Oceania ─────────────────────────────────────────────────
  'AU': { code: 'eng', name: 'English',              country: 'Australia' },
  'FJ': { code: 'eng', name: 'English',              country: 'Fiji' },
  'KI': { code: 'eng', name: 'English',              country: 'Kiribati' },
  'MH': { code: 'eng', name: 'English',              country: 'Marshall Islands' },
  'FM': { code: 'eng', name: 'English',              country: 'Micronesia' },
  'NR': { code: 'eng', name: 'English',              country: 'Nauru' },
  'NZ': { code: 'eng', name: 'English',              country: 'New Zealand' },
  'PW': { code: 'eng', name: 'English',              country: 'Palau' },
  'PG': { code: 'eng', name: 'English',              country: 'Papua New Guinea' },
  'WS': { code: 'eng', name: 'English',              country: 'Samoa' },
  'SB': { code: 'eng', name: 'English',              country: 'Solomon Islands' },
  'TO': { code: 'eng', name: 'English',              country: 'Tonga' },
  'TV': { code: 'eng', name: 'English',              country: 'Tuvalu' },
  'VU': { code: 'eng', name: 'English',              country: 'Vanuatu' },

  // ── Oceania: Territories ────────────────────────────────────
  'NC': { code: 'fra', name: 'French',               country: 'New Caledonia' },
  'PF': { code: 'fra', name: 'French',               country: 'French Polynesia' },
  'WF': { code: 'fra', name: 'French',               country: 'Wallis and Futuna' },
  'GU': { code: 'eng', name: 'English',              country: 'Guam' },
  'AS': { code: 'eng', name: 'English',              country: 'American Samoa' },
  'MP': { code: 'eng', name: 'English',              country: 'Northern Mariana Islands' },
  'CK': { code: 'eng', name: 'English',              country: 'Cook Islands' },
  'NU': { code: 'eng', name: 'English',              country: 'Niue' },
  'TK': { code: 'eng', name: 'English',              country: 'Tokelau' },

  // ── Additional territories and special cases ────────────────
  'HK': { code: 'cmn', name: 'Mandarin Chinese',     country: 'Hong Kong' },
  'MO': { code: 'cmn', name: 'Mandarin Chinese',     country: 'Macao' },
  'RE': { code: 'fra', name: 'French',               country: 'Réunion' },
  'YT': { code: 'fra', name: 'French',               country: 'Mayotte' },
  'SX': { code: 'nld', name: 'Dutch',                country: 'Sint Maarten' },
  'BQ': { code: 'nld', name: 'Dutch',                country: 'Bonaire' },
  'PM': { code: 'fra', name: 'French',               country: 'Saint Pierre and Miquelon' },
  'TC': { code: 'eng', name: 'English',              country: 'Turks and Caicos' },
  'AI': { code: 'eng', name: 'English',              country: 'Anguilla' },
  'MS': { code: 'eng', name: 'English',              country: 'Montserrat' },
  'VG': { code: 'eng', name: 'English',              country: 'British Virgin Islands' },
  'GI': { code: 'eng', name: 'English',              country: 'Gibraltar' },
  'SH': { code: 'eng', name: 'English',              country: 'Saint Helena' },
  'IO': { code: 'eng', name: 'English',              country: 'British Indian Ocean Territory' },
  'CC': { code: 'eng', name: 'English',              country: 'Cocos Islands' },
  'CX': { code: 'eng', name: 'English',              country: 'Christmas Island' },
  'NF': { code: 'eng', name: 'English',              country: 'Norfolk Island' },
  'PN': { code: 'eng', name: 'English',              country: 'Pitcairn Islands' },
  'GL': { code: 'kal', name: 'Kalaallisut',          country: 'Greenland' },
  'FO': { code: 'fao', name: 'Faroese',              country: 'Faroe Islands' },
  'AX': { code: 'swe', name: 'Swedish',              country: 'Åland Islands' },
};

// Build a reverse lookup: official language code → Set of country codes
// This lets us quickly check "is language X the official language of country Y?"
const officialLangToCountries = new Map();
for (const [countryCode, info] of Object.entries(COUNTRY_OFFICIAL_LANGUAGE)) {
  if (!officialLangToCountries.has(info.code)) {
    officialLangToCountries.set(info.code, new Set());
  }
  officialLangToCountries.get(info.code).add(countryCode);
}

// ── Main ───────────────────────────────────────────────────────

console.log('═'.repeat(60));
console.log('  Compute Natural Translation Pairs');
console.log('═'.repeat(60));
console.log(`  Script:     ${SCRIPT_NAME}`);
console.log(`  Cards:      ${CARDS_DIR}`);
console.log(`  Output:     ${OUT_PATH}`);
console.log(`  Countries:  ${Object.keys(COUNTRY_OFFICIAL_LANGUAGE).length} mapped`);
if (DRY_RUN) console.log('  ⚠️  DRY RUN — staging JSON will NOT be written');
if (SINGLE_LANG) console.log(`  🔍 Single language mode: ${SINGLE_LANG}`);
console.log('');

console.log('  Loading language-card corpus...');

// code → { name, countries } — language cards only, via the one adapter.
const langData = new Map();
let localeCount = 0;

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

  langData.set(code, {
    name: typeof card.name === 'string' ? card.name : null,
    countries: Array.isArray(card.countries) ? card.countries : [],
  });
}

console.log(`  Language cards loaded:  ${langData.size.toLocaleString()}`);
console.log(`  Locale cards excluded:  ${localeCount.toLocaleString()}`);
console.log('');

// ── Step 1: Compute natural pairs ─────────────────────────────

console.log('  Computing natural pairs...');

let processedCount = 0;
let pairedCount = 0;
let selfOfficialCount = 0;   // Language IS the official lang → paired with English
let noCountryCount = 0;       // No country data available
let unmappedCountryCount = 0; // Country not in our map

// Track pair distribution for reporting
const pairDist = {};

// Collect results
const results = new Map(); // code → { pairCode, pairName, rationale }

for (const [code, lang] of langData) {
  if (SINGLE_LANG && code !== SINGLE_LANG) continue;

  processedCount++;

  const countries = lang.countries;

  // Skip languages with no country data
  if (countries.length === 0) {
    noCountryCount++;
    continue;
  }

  // Use the primary (first) country
  const primaryCountry = countries[0];
  const officialInfo = COUNTRY_OFFICIAL_LANGUAGE[primaryCountry];

  if (!officialInfo) {
    // Country not in our map — rare edge case (very small territories)
    unmappedCountryCount++;
    continue;
  }

  let pairCode, pairName, rationale;

  // Check: is this language THE official language of this country?
  if (code === officialInfo.code) {
    // The language IS the official language → pair with English
    // (unless it's already English, in which case pair with French
    // as the next most universal international language)
    if (code === 'eng') {
      pairCode = 'fra';
      pairName = 'French';
      rationale = `English is the official language of ${officialInfo.country}; French is the default secondary international pair`;
    } else {
      pairCode = 'eng';
      pairName = 'English';
      rationale = `${lang.name} is the official language of ${officialInfo.country}; English is the default international pair`;
    }
    selfOfficialCount++;
  } else {
    // The language is NOT the official language → pair with the
    // official language of the primary country
    pairCode = officialInfo.code;
    pairName = officialInfo.name;
    rationale = `National language of ${officialInfo.country} (${officialInfo.name})`;
  }

  // Verify that the pair language actually has a language card
  if (!langData.has(pairCode)) {
    // Pair language has no card — fall back to English
    // This shouldn't happen in practice since we use proper ISO 639-3
    // codes, but we handle it defensively
    if (pairCode !== 'eng') {
      pairCode = 'eng';
      pairName = 'English';
      rationale += ' (official language has no card; defaulting to English)';
    } else {
      // Even English has no card? Skip this language
      unmappedCountryCount++;
      continue;
    }
  }

  results.set(code, { pairCode, pairName, rationale });
  pairDist[pairCode] = (pairDist[pairCode] || 0) + 1;
  pairedCount++;
}

console.log('');

// ── Step 2: Write to database or show dry-run ─────────────────

if (DRY_RUN) {
  console.log('  DRY RUN — Preview:');
  console.log('  ' + '─'.repeat(50));

  const previewCodes = SINGLE_LANG
    ? [SINGLE_LANG]
    : ['aqz', 'crk', 'eng', 'fra', 'cmn', ...([...results.keys()].slice(0, 3))];

  for (const code of [...new Set(previewCodes)]) {
    const result = results.get(code);
    if (!result) continue;
    const lang = langData.get(code);
    console.log(`\n  ${code} (${lang?.name || '???'}):`);
    console.log(`    Pair: ${result.pairCode} (${result.pairName})`);
    console.log(`    Rationale: ${result.rationale}`);
  }

  console.log('');
  console.log(`  Re-run without --dry-run to write ${OUT_PATH}`);
} else {
  console.log('  Writing staged natural-pairs JSON...');

  mkdirSync(OUT_DIR, { recursive: true });
  const out = {};
  for (const [code, { pairCode, pairName, rationale }] of results) {
    out[code] = { code: pairCode, name: pairName, rationale, source: SOURCE };
  }
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + '\n');

  console.log(`  Wrote ${OUT_PATH}`);
  console.log(`  Rows written: ${pairedCount.toLocaleString()}`);
}

// ── Step 3: Report ─────────────────────────────────────────────

console.log('');
console.log('  RESULTS:');
console.log('  ' + '─'.repeat(45));
console.log(`  Languages processed:          ${processedCount.toLocaleString().padStart(6)}`);
console.log(`  Languages with pairs:         ${pairedCount.toLocaleString().padStart(6)}`);
console.log(`  Self-official (→ English):    ${selfOfficialCount.toLocaleString().padStart(6)}`);
console.log(`  No country data:              ${noCountryCount.toLocaleString().padStart(6)}`);
console.log(`  Unmapped country:             ${unmappedCountryCount.toLocaleString().padStart(6)}`);

console.log('');
console.log('  TOP PAIR LANGUAGES:');
console.log('  ' + '─'.repeat(45));

const sortedPairs = Object.entries(pairDist).sort((a, b) => b[1] - a[1]).slice(0, 15);
for (const [pCode, count] of sortedPairs) {
  const pLang = langData.get(pCode);
  const bar = '█'.repeat(Math.round(count / 100));
  console.log(`  ${pCode.padEnd(5)} ${(pLang?.name || '???').padEnd(22)} ${count.toLocaleString().padStart(6)}  ${bar}`);
}

// Show examples for aqz and crk
if (!SINGLE_LANG) {
  for (const code of ['aqz', 'crk']) {
    const result = results.get(code);
    const lang = langData.get(code);
    if (!result || !lang) continue;

    console.log('');
    console.log(`  EXAMPLE — ${code} (${lang.name}):`);
    console.log('  ' + '─'.repeat(45));
    console.log(`    Natural pair: ${result.pairCode} (${result.pairName})`);
    console.log(`    Rationale:    ${result.rationale}`);
    console.log(`    Source:       ${SOURCE}`);
  }
}

console.log('');
console.log('═'.repeat(60));
