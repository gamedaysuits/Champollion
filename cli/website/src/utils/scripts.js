/**
 * Script conversion registry — deterministic orthography converters.
 *
 * WHY: Some languages have multiple scripts for the same spoken language.
 * Translation workflows often prefer a "working script" (easier to type,
 * edit, and version-control) that gets converted to a "display script"
 * as a post-translation step.
 *
 * Examples:
 *   - Plains Cree: SRO (Standard Roman Orthography) → Syllabics (ᓀᐦᐃᔭᐍᐏᐣ)
 *   - Serbian: Latin → Cyrillic
 *   - Japanese: Romaji → Hiragana/Katakana
 *   - Hindi: Romanized → Devanagari
 *
 * All converters here are DETERMINISTIC — no LLM needed, pure lookup tables.
 * They run as a post-translation hook: translate in working script, then
 * convert to display script.
 *
 * ADDING A NEW CONVERTER:
 *   1. Add the conversion map below
 *   2. Create the converter function (input string → output string)
 *   3. Register it in SCRIPT_CONVERTERS with the locale code
 *   4. Add the `scripts` field to the language's register entry in registers.js
 */

// -----------------------------------------------------------------
// Plains Cree: SRO → Syllabics
// -----------------------------------------------------------------

/**
 * SRO to Cree Syllabics conversion table.
 *
 * This is the standard mapping used by the University of Alberta's
 * ALTLab and documented in Wolvengrey's Cree: Words dictionary.
 *
 * The mapping is context-sensitive: consonant+vowel combinations map
 * to specific syllabic characters, while standalone consonants use
 * finals (small superscript forms).
 *
 * ORDER MATTERS: Longer sequences must be matched before shorter ones
 * (e.g., "twê" before "tw" before "t").
 */
const SRO_TO_SYLLABICS_MAP = [
  // Long vowels with w-glide (must come before short vowel w-glide)
  ['pwê', 'ᐻ'], ['pwî', 'ᐽ'], ['pwô', 'ᐿ'], ['pwâ', 'ᑁ'],
  ['twê', 'ᑗ'], ['twî', 'ᑙ'], ['twô', 'ᑛ'], ['twâ', 'ᑝ'],
  ['kwê', 'ᑵ'], ['kwî', 'ᑷ'], ['kwô', 'ᑹ'], ['kwâ', 'ᑻ'],
  ['cwê', 'ᒑ'], ['cwî', 'ᒓ'], ['cwô', 'ᒕ'], ['cwâ', 'ᒗ'],
  ['mwê', 'ᒫ'], ['mwî', 'ᒭ'], ['mwô', 'ᒯ'], ['mwâ', 'ᒱ'],
  ['nwê', 'ᓇ'], ['nwî', 'ᓉ'], ['nwô', 'ᓋ'], ['nwâ', 'ᓍ'],
  ['swê', 'ᓭ'], ['swî', 'ᓯ'], ['swô', 'ᓱ'], ['swâ', 'ᓳ'],
  ['ywê', 'ᔋ'], ['ywî', 'ᔍ'], ['ywô', 'ᔏ'], ['ywâ', 'ᔑ'],

  // Short vowels with w-glide
  ['pwe', 'ᐺ'], ['pwi', 'ᐼ'], ['pwo', 'ᐾ'], ['pwa', 'ᑀ'],
  ['twe', 'ᑖ'], ['twi', 'ᑘ'], ['two', 'ᑚ'], ['twa', 'ᑜ'],
  ['kwe', 'ᑴ'], ['kwi', 'ᑶ'], ['kwo', 'ᑸ'], ['kwa', 'ᑺ'],
  ['cwe', 'ᒐ'], ['cwi', 'ᒒ'], ['cwo', 'ᒔ'], ['cwa', 'ᒖ'],
  ['mwe', 'ᒪ'], ['mwi', 'ᒬ'], ['mwo', 'ᒮ'], ['mwa', 'ᒰ'],
  ['nwe', 'ᓈ'], ['nwi', 'ᓊ'], ['nwo', 'ᓌ'], ['nwa', 'ᓎ'],
  ['swe', 'ᓬ'], ['swi', 'ᓮ'], ['swo', 'ᓰ'], ['swa', 'ᓲ'],
  ['ywe', 'ᔊ'], ['ywi', 'ᔌ'], ['ywo', 'ᔎ'], ['ywa', 'ᔐ'],

  // Long vowels (macron forms — these must come before short vowels)
  ['pê', 'ᐯ'], ['pî', 'ᐲ'], ['pô', 'ᐴ'], ['pâ', 'ᐹ'],
  ['tê', 'ᑌ'], ['tî', 'ᑏ'], ['tô', 'ᑑ'], ['tâ', 'ᑖ'],
  ['kê', 'ᑫ'], ['kî', 'ᑮ'], ['kô', 'ᑰ'], ['kâ', 'ᑳ'],
  ['cê', 'ᒉ'], ['cî', 'ᒌ'], ['cô', 'ᒎ'], ['câ', 'ᒑ'],
  ['mê', 'ᒣ'], ['mî', 'ᒦ'], ['mô', 'ᒨ'], ['mâ', 'ᒫ'],
  ['nê', 'ᓀ'], ['nî', 'ᓃ'], ['nô', 'ᓅ'], ['nâ', 'ᓈ'],
  ['sê', 'ᓭ'], ['sî', 'ᓰ'], ['sô', 'ᓲ'], ['sâ', 'ᓵ'],
  ['yê', 'ᔦ'], ['yî', 'ᔩ'], ['yô', 'ᔫ'], ['yâ', 'ᔮ'],

  // Short vowels (consonant+vowel)
  ['pe', 'ᐯ'], ['pi', 'ᐱ'], ['po', 'ᐳ'], ['pa', 'ᐸ'],
  ['te', 'ᑌ'], ['ti', 'ᑎ'], ['to', 'ᑐ'], ['ta', 'ᑕ'],
  ['ke', 'ᑫ'], ['ki', 'ᑭ'], ['ko', 'ᑯ'], ['ka', 'ᑲ'],
  ['ce', 'ᒉ'], ['ci', 'ᒋ'], ['co', 'ᒍ'], ['ca', 'ᒐ'],
  ['me', 'ᒣ'], ['mi', 'ᒥ'], ['mo', 'ᒧ'], ['ma', 'ᒪ'],
  ['ne', 'ᓀ'], ['ni', 'ᓂ'], ['no', 'ᓄ'], ['na', 'ᓇ'],
  ['se', 'ᓭ'], ['si', 'ᓯ'], ['so', 'ᓱ'], ['sa', 'ᓴ'],
  ['ye', 'ᔦ'], ['yi', 'ᔨ'], ['yo', 'ᔪ'], ['ya', 'ᔭ'],

  // Standalone vowels (long first)
  ['ê', 'ᐁ'], ['î', 'ᐄ'], ['ô', 'ᐆ'], ['â', 'ᐋ'],
  ['e', 'ᐁ'], ['i', 'ᐃ'], ['o', 'ᐅ'], ['a', 'ᐊ'],

  // Digraphs (must come before single-char finals)
  ['th', 'ᖧ'],

  // Finals (standalone consonants — no following vowel)
  ['p', 'ᑊ'], ['t', 'ᐟ'], ['k', 'ᐠ'], ['c', 'ᐨ'],
  ['m', 'ᒼ'], ['n', 'ᐣ'], ['s', 'ᐢ'], ['y', 'ᐩ'],

  // Special characters
  ['h', 'ᐦ'], ['w', 'ᐤ'], ['l', 'ᓬ'], ['r', 'ᕒ'],
];

/**
 * Convert SRO text to Cree Syllabics.
 *
 * This is a greedy left-to-right scan: at each position, try the longest
 * possible match first. Characters that don't match any pattern (spaces,
 * punctuation, numbers) pass through unchanged.
 *
 * @param {string} sro - SRO text to convert
 * @returns {string} Syllabics text
 */
function sroToSyllabics(sro) {
  const input = sro.toLowerCase();
  let result = '';
  let i = 0;

  while (i < input.length) {
    let matched = false;

    // Try longest matches first (up to 3 characters)
    for (const [from, to] of SRO_TO_SYLLABICS_MAP) {
      if (input.startsWith(from, i)) {
        result += to;
        i += from.length;
        matched = true;
        break;
      }
    }

    // No match — pass character through (space, punctuation, etc.)
    if (!matched) {
      result += input[i];
      i++;
    }
  }

  return result;
}

// -----------------------------------------------------------------
// Serbian: Latin → Cyrillic
// -----------------------------------------------------------------

const LATIN_TO_CYRILLIC_SR = {
  'lj': 'љ', 'nj': 'њ', 'dž': 'џ',
  'Lj': 'Љ', 'Nj': 'Њ', 'Dž': 'Џ',
  'LJ': 'Љ', 'NJ': 'Њ', 'DŽ': 'Џ',
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д',
  'đ': 'ђ', 'e': 'е', 'ž': 'ж', 'z': 'з', 'i': 'и',
  'j': 'ј', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н',
  'o': 'о', 'p': 'п', 'r': 'р', 's': 'с', 't': 'т',
  'ć': 'ћ', 'u': 'у', 'f': 'ф', 'h': 'х', 'c': 'ц',
  'č': 'ч', 'š': 'ш',
  'A': 'А', 'B': 'Б', 'V': 'В', 'G': 'Г', 'D': 'Д',
  'Đ': 'Ђ', 'E': 'Е', 'Ž': 'Ж', 'Z': 'З', 'I': 'И',
  'J': 'Ј', 'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н',
  'O': 'О', 'P': 'П', 'R': 'Р', 'S': 'С', 'T': 'Т',
  'Ć': 'Ћ', 'U': 'У', 'F': 'Ф', 'H': 'Х', 'C': 'Ц',
  'Č': 'Ч', 'Š': 'Ш',
};

/**
 * Convert Serbian Latin text to Cyrillic.
 * Digraphs (lj, nj, dž) are matched first.
 *
 * @param {string} latin - Latin text
 * @returns {string} Cyrillic text
 */
function latinToCyrillicSr(latin) {
  let result = '';
  let i = 0;

  while (i < latin.length) {
    // Try digraphs first (2 characters)
    if (i + 1 < latin.length) {
      const digraph = latin.slice(i, i + 2);
      if (LATIN_TO_CYRILLIC_SR[digraph]) {
        result += LATIN_TO_CYRILLIC_SR[digraph];
        i += 2;
        continue;
      }
    }

    // Single character
    const ch = latin[i];
    result += LATIN_TO_CYRILLIC_SR[ch] || ch;
    i++;
  }

  return result;
}

// -----------------------------------------------------------------
// Klingon: Romanization → pIqaD (CSUR PUA U+F8D0–F8FF)
// -----------------------------------------------------------------

/**
 * Klingon romanization to pIqaD conversion table.
 *
 * Based on the ConScript Unicode Registry (CSUR) mapping maintained
 * at evertype.com. Characters are in the Unicode Private Use Area
 * — they require a pIqaD-compatible web font to render visually.
 *
 * Klingon romanization is case-sensitive: 'D' ≠ 'd', 'S' ≠ 's',
 * 'I' ≠ 'i', 'Q' ≠ 'q'. The table preserves this distinction.
 *
 * ORDER: Trigraphs (tlh) → digraphs (ch, gh, ng) → single chars.
 */
const KLINGON_TO_PIQAD_MAP = [
  // Trigraph (must come first)
  ['tlh', '\uF8E4'],

  // Digraphs
  ['ch', '\uF8D2'], ['gh', '\uF8D5'], ['ng', '\uF8DC'],

  // Case-sensitive single characters
  // Uppercase-only letters (distinct phonemes in Klingon)
  ['D', '\uF8D3'], ['H', '\uF8D6'], ['I', '\uF8D7'],
  ['Q', '\uF8E0'], ['S', '\uF8E2'],

  // Lowercase letters
  ['a', '\uF8D0'], ['b', '\uF8D1'], ['e', '\uF8D4'],
  ['j', '\uF8D8'], ['l', '\uF8D9'], ['m', '\uF8DA'],
  ['n', '\uF8DB'], ['o', '\uF8DD'], ['p', '\uF8DE'],
  ['q', '\uF8DF'], ['r', '\uF8E1'], ['t', '\uF8E3'],
  ['u', '\uF8E5'], ['v', '\uF8E6'], ['w', '\uF8E7'],
  ['y', '\uF8E8'],

  // Glottal stop (apostrophe)
  ["'", '\uF8E9'],
  ['\u2019', '\uF8E9'],  // right single quote (common in copy-pasted text)
];

/**
 * Convert Klingon romanization to pIqaD script.
 *
 * Greedy left-to-right scan, longest match first.
 * Case-sensitive: 'D' (retroflex) ≠ 'd' (not a Klingon phoneme).
 * Non-Klingon characters (spaces, punctuation, numbers) pass through.
 *
 * NOTE: Output uses Unicode PUA characters (U+F8D0–F8FF).
 * A pIqaD web font (e.g., "pIqaD qolqoS" or "Klingon pIqaD HaSta")
 * must be loaded for visual rendering.
 *
 * @param {string} romanized - Klingon text in standard romanization
 * @returns {string} pIqaD text
 */
function romanizationToPiqad(romanized) {
  let result = '';
  let i = 0;

  while (i < romanized.length) {
    let matched = false;

    for (const [from, to] of KLINGON_TO_PIQAD_MAP) {
      if (romanized.startsWith(from, i)) {
        result += to;
        i += from.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += romanized[i];
      i++;
    }
  }

  return result;
}

// -----------------------------------------------------------------
// Tengwar: Sindarin Latin → Tengwar (CSUR PUA U+E000–E07F)
// Mode of Beleriand — full vowel letters (not diacritics)
// -----------------------------------------------------------------

/**
 * Sindarin Latin to Tengwar conversion table.
 *
 * Uses the "Mode of Beleriand" where vowels are full tengwar letters
 * rather than tehtar (diacritics). This is the most deterministic
 * mode — the Ómatehtar mode requires context-dependent diacritic
 * placement which is significantly more complex.
 *
 * Based on the CSUR Tengwar block (U+E000–E07F) as documented by
 * the Free Tengwar Font Project. Requires a CSUR-compatible Tengwar
 * font (e.g., "Tengwar Formal CSUR", "Tengwar Annatar") to render.
 *
 * This is a simplified converter — it handles the most common
 * Sindarin consonants and vowels but does not implement:
 *   - Double consonant bars (nasal signs)
 *   - Sa-rincë (s-hooks)
 *   - Ligatures for common combinations
 *
 * ORDER: Digraphs → single characters.
 */
const SINDARIN_TO_TENGWAR_MAP = [
  // Digraphs (must come before single chars)
  ['th', '\uE003'], // thúlë (voiceless th)
  ['dh', '\uE004'], // anto (voiced th/dh)
  ['ch', '\uE002'], // hwesta (voiceless velar fricative)
  ['ph', '\uE00E'], // formen (labialized)
  ['ng', '\uE016'], // noldo
  ['nd', '\uE022'], // ando+númen combo — using ando
  ['mb', '\uE022'], // umbar area
  ['nn', '\uE015'], // doubled númen
  ['mm', '\uE012'], // doubled malta
  ['ll', '\uE00B'], // doubled lambe
  ['rh', '\uE00C'], // rómen (voiceless r)
  ['lh', '\uE00D'], // silmë (voiceless l)
  ['hw', '\uE017'], // hwesta sindarinwa

  // Consonants (single)
  ['t', '\uE001'], // tinco
  ['p', '\uE00E'], // parma
  ['c', '\uE002'], // calma (hard c/k)
  ['k', '\uE002'], // calma
  ['d', '\uE005'], // ando
  ['b', '\uE00F'], // umbar
  ['g', '\uE006'], // anga (hard g)
  ['f', '\uE010'], // formen
  ['v', '\uE011'], // ampa
  ['n', '\uE015'], // númen
  ['m', '\uE012'], // malta
  ['r', '\uE00C'], // óre/rómen
  ['l', '\uE00B'], // lambe
  ['s', '\uE008'], // silmë
  ['h', '\uE017'], // hyarmen
  ['w', '\uE013'], // vilya/vala
  ['y', '\uE014'], // anna

  // Vowels — Mode of Beleriand uses full letters, not diacritics
  // Long vowels (circumflex or macron) mapped to long carriers
  ['á', '\uE040'], // long a carrier
  ['é', '\uE042'], // long e carrier
  ['í', '\uE044'], // long i carrier
  ['ó', '\uE046'], // long o carrier
  ['ú', '\uE048'], // long u carrier
  ['â', '\uE040'],
  ['ê', '\uE042'],
  ['î', '\uE044'],
  ['ô', '\uE046'],
  ['û', '\uE048'],

  // Short vowels
  ['a', '\uE03F'], // short a
  ['e', '\uE041'], // short e
  ['i', '\uE043'], // short i
  ['o', '\uE045'], // short o
  ['u', '\uE047'], // short u
];

/**
 * Convert Sindarin Latin text to Tengwar script (Mode of Beleriand).
 *
 * NOTE: Output uses Unicode PUA characters (U+E000–E07F).
 * A CSUR-compatible Tengwar font must be loaded for visual rendering.
 *
 * @param {string} latin - Sindarin text in Latin script
 * @returns {string} Tengwar text
 */
function latinToTengwar(latin) {
  const input = latin.toLowerCase();
  let result = '';
  let i = 0;

  while (i < input.length) {
    let matched = false;

    for (const [from, to] of SINDARIN_TO_TENGWAR_MAP) {
      if (input.startsWith(from, i)) {
        result += to;
        i += from.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += input[i];
      i++;
    }
  }

  return result;
}

// -----------------------------------------------------------------
// Kryptonian: Latin → Kryptonian (font-based cipher)
// -----------------------------------------------------------------

/**
 * Kryptonian "script conversion" — 1:1 Latin alphabet cipher.
 *
 * Unlike the other converters, Kryptonian has NO standard Unicode
 * assignment (not even PUA/CSUR). The DC Comics script is a pure
 * substitution cipher of the Latin alphabet, rendered via custom fonts.
 *
 * This converter maps A-Z to Unicode PUA characters (U+E100–E119)
 * using a conventional fan-community assignment. The mapping is:
 *   A=U+E100, B=U+E101, ..., Z=U+E119
 *
 * FONT REQUIRED: A Kryptonian font mapped to these PUA codepoints
 * (e.g., "Kryptonian" from kryptonian.info). Without the font,
 * output will render as empty boxes.
 *
 * Alternative approach: skip this converter entirely and use
 * CSS `font-family: 'Kryptonian'` on the element. The text stays
 * as Latin characters but renders in Kryptonian glyphs. This is
 * often simpler for web deployments.
 */
function latinToKryptonian(text) {
  let result = '';

  for (const ch of text) {
    const upper = ch.toUpperCase();
    const code = upper.charCodeAt(0);

    // Map A-Z (65-90) to PUA U+E100-E119
    if (code >= 65 && code <= 90) {
      result += String.fromCharCode(0xE100 + (code - 65));
    } else {
      // Non-alpha characters (spaces, punctuation, numbers) pass through
      result += ch;
    }
  }

  return result;
}

// -----------------------------------------------------------------
// Converter Registry
// -----------------------------------------------------------------

/**
 * Registry of available script converters.
 *
 * Each entry maps a locale code to its converter configuration:
 *   - from:      source script name
 *   - to:        target script name
 *   - type:      'deterministic' (pure lookup), or 'font-based' (needs web font)
 *   - converter: function(string) → string
 *   - fontNote:  (optional) font requirement for PUA-based converters
 */
const SCRIPT_CONVERTERS = {
  crk: {
    from: 'SRO (Standard Roman Orthography)',
    to: 'Cree Syllabics',
    type: 'deterministic',
    converter: sroToSyllabics,
  },
  sr: {
    from: 'Latin',
    to: 'Cyrillic',
    type: 'deterministic',
    converter: latinToCyrillicSr,
  },
  tlh: {
    from: 'Romanization',
    to: 'pIqaD',
    type: 'deterministic',
    fontNote: 'Requires pIqaD web font (PUA U+F8D0–F8FF)',
    converter: romanizationToPiqad,
  },
  'x-elvish-s': {
    from: 'Latin',
    to: 'Tengwar (Mode of Beleriand)',
    type: 'deterministic',
    fontNote: 'Requires CSUR Tengwar font (PUA U+E000–E07F)',
    converter: latinToTengwar,
  },
  'x-kryptonian': {
    from: 'Latin',
    to: 'Kryptonian',
    type: 'font-based',
    fontNote: 'Requires Kryptonian font mapped to PUA U+E100–E119',
    converter: latinToKryptonian,
  },
};

/**
 * Convert text using the registered converter for a locale.
 *
 * @param {string} text - Text in the source script
 * @param {string} localeCode - Locale code (e.g., "crk", "sr")
 * @returns {{ converted: string, converterUsed: string|null }} Result and converter name
 */
function convertScript(text, localeCode) {
  const converter = SCRIPT_CONVERTERS[localeCode];
  if (!converter) {
    return { converted: text, converterUsed: null };
  }

  return {
    converted: converter.converter(text),
    converterUsed: `${converter.from} → ${converter.to}`,
  };
}

/**
 * Check if a locale has a registered script converter.
 *
 * @param {string} localeCode - Locale code
 * @returns {boolean}
 */
function hasScriptConverter(localeCode) {
  return localeCode in SCRIPT_CONVERTERS;
}

/**
 * Get converter info for a locale (without the function reference).
 * Safe for serialization into config/reports.
 *
 * @param {string} localeCode - Locale code
 * @returns {object|null}
 */
function getConverterInfo(localeCode) {
  const conv = SCRIPT_CONVERTERS[localeCode];
  if (!conv) return null;
  const info = { from: conv.from, to: conv.to, type: conv.type };
  if (conv.fontNote) info.fontNote = conv.fontNote;
  return info;
}

export {
  sroToSyllabics,
  latinToCyrillicSr,
  romanizationToPiqad,
  latinToTengwar,
  latinToKryptonian,
  convertScript,
  hasScriptConverter,
  getConverterInfo,
  SCRIPT_CONVERTERS,
};
