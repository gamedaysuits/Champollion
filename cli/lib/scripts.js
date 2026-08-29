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
 *   - fromScript ISO 15924 code of the working script the LLM emits
 *   - toScript:  ISO 15924 code of the converted output, or null when the
 *               target script has no registered code (Kryptonian). A null
 *               toScript CANNOT be selected via `script:` config — see
 *               resolveTargetScript.
 *   - type:      'deterministic' (pure lookup), or 'font-based' (needs web font)
 *   - converter: function(string) → string
 *   - map:       the forward table, used to derive letter coverage and the
 *               reverse table. Null for converters that are pure arithmetic.
 *   - puaRange:  [lo, hi] of the Private Use Area block the converter emits,
 *               or null when output is in assigned Unicode.
 *   - fontNote:  (optional) font requirement for PUA-based converters
 */
const SCRIPT_CONVERTERS = {
  crk: {
    from: 'SRO (Standard Roman Orthography)',
    to: 'Cree Syllabics',
    fromScript: 'Latn',
    toScript: 'Cans',
    type: 'deterministic',
    map: SRO_TO_SYLLABICS_MAP,
    puaRange: null,
    converter: sroToSyllabics,
  },
  sr: {
    from: 'Latin',
    to: 'Cyrillic',
    fromScript: 'Latn',
    toScript: 'Cyrl',
    type: 'deterministic',
    map: Object.entries(LATIN_TO_CYRILLIC_SR),
    puaRange: null,
    converter: latinToCyrillicSr,
  },
  tlh: {
    from: 'Romanization',
    to: 'pIqaD',
    fromScript: 'Latn',
    toScript: 'Piqd',
    type: 'deterministic',
    map: KLINGON_TO_PIQAD_MAP,
    puaRange: [0xF8D0, 0xF8FF],
    fontNote: 'Requires pIqaD web font (PUA U+F8D0–F8FF)',
    converter: romanizationToPiqad,
  },
  'x-elvish-s': {
    from: 'Latin',
    to: 'Tengwar (Mode of Beleriand)',
    fromScript: 'Latn',
    toScript: 'Teng',
    type: 'deterministic',
    map: SINDARIN_TO_TENGWAR_MAP,
    puaRange: [0xE000, 0xE07F],
    fontNote: 'Requires CSUR Tengwar font (PUA U+E000–E07F)',
    converter: latinToTengwar,
  },
  'x-kryptonian': {
    from: 'Latin',
    to: 'Kryptonian',
    fromScript: 'Latn',
    // Kryptonian has no ISO 15924 code — not even a provisional one. The
    // encoded form is therefore unreachable through `script:` and must be
    // requested with the explicit escape hatch (see resolveTargetScript).
    toScript: null,
    type: 'font-based',
    map: null,
    puaRange: [0xE100, 0xE119],
    fontNote: 'Requires Kryptonian font mapped to PUA U+E100–E119',
    converter: latinToKryptonian,
  },
};

// -----------------------------------------------------------------
// Target-script resolution
// -----------------------------------------------------------------

/**
 * ISO 15924 codes are exactly four letters, initial capital: Latn, Cans, Cyrl.
 */
const ISO_15924 = /^[A-Z][a-z]{3}$/;

/**
 * Legacy/informal script names that used to appear in `script:` config, mapped
 * to the ISO 15924 code that replaces them. The field was accepted but never
 * read, so no project can have been depending on the old values working —
 * but they were documented, so name the replacement rather than just rejecting.
 */
const LEGACY_SCRIPT_ALIASES = {
  syllabics: 'Cans',
  latin: 'Latn',
  roman: 'Latn',
  cyrillic: 'Cyrl',
  piqad: 'Piqd',
  tengwar: 'Teng',
};

/**
 * The explicit escape hatch for converters whose output script has no ISO
 * 15924 code. Set `script: "x-kryptonian"` (the converter key) to opt in.
 */
function isConverterKeyEscapeHatch(value) {
  return Object.prototype.hasOwnProperty.call(SCRIPT_CONVERTERS, value);
}

/**
 * The converter registered for a locale, resolved through the card.
 *
 * The registry is keyed by converter key, which is USUALLY the locale code but
 * not always: Serbian's converter is keyed `sr` while the card's canonical
 * code is `srp`. The card's `scriptConverter` field records the key, so the
 * card is the join — never guess from the code alone.
 *
 * @param {string} localeCode - Target locale code
 * @param {object|null} card - The language card, or null
 * @returns {string|null} The converter key, or null when none is registered
 */
function converterKeyForLocale(localeCode, card = null) {
  if (card?.scriptConverter && SCRIPT_CONVERTERS[card.scriptConverter]) {
    return card.scriptConverter;
  }
  return SCRIPT_CONVERTERS[localeCode] ? localeCode : null;
}

/**
 * Resolve which script a locale's output should be written in.
 *
 * WHY this exists: until 0.2.0 the decision was a bare lookup —
 * `hasScriptConverter(target)` — so every project targeting crk/sr/tlh/
 * x-elvish-s/x-kryptonian had its output rewritten into the converter's
 * display script unconditionally, with no way to decline. For the PUA
 * converters that shipped unrenderable text to anyone whose font was keyed
 * to Latin transliteration rather than Private Use Area codepoints; for
 * crk it silently chose a community's display orthography on their behalf.
 *
 * Resolution:
 *   1. Explicit `script:` config (per-language or per-pair) — user intent
 *      wins. ISO 15924, any casing accepted ("cans" → "Cans"); a value the
 *      locale's converter cannot produce fails loud listing what it can.
 *   2. No config, and the locale's converter targets a REAL Unicode script
 *      (puaRange null — crk → Cans, sr → Cyrl): `{ source: 'choice-required',
 *      choices }`. Both orthographies are legitimate; picking one is not a
 *      default we get to make. Translation lanes refuse to run until the
 *      config says which; read-only lanes (status, integrity, repair) may
 *      proceed and display the state.
 *   3. No config, and the converter targets a PUA block (tlh, x-elvish-s,
 *      x-kryptonian — scripts NOT in Unicode): default to the working script
 *      (Latn romanization), the only output that renders without a custom
 *      font. Opting into the PUA form is one config line away.
 *   4. No converter at all: `script` passes through informationally,
 *      converterKey null, zero behavior change.
 *
 * @param {string} localeCode - Target locale code
 * @param {object} langConfig - Per-language / per-pair config (reads .script)
 * @param {object|null} card - The language card, or null when none exists
 * @returns {{ script: string|null, source: 'config'|'default'|'choice-required'|'none',
 *             converterKey: string|null, choices?: Array<{script: string, label: string}> }}
 * @throws {Error} on an unusable `script:` value — fail loud, never guess
 */
function resolveTargetScript(localeCode, langConfig = {}, card = null) {
  const registeredKey = converterKeyForLocale(localeCode, card);
  const conv = registeredKey ? SCRIPT_CONVERTERS[registeredKey] : null;
  const requested = langConfig?.script;

  if (requested != null && requested !== '') {
    if (typeof requested !== 'string') {
      throw new Error(
        `Invalid "script" for ${localeCode}: expected an ISO 15924 code string, got ${typeof requested}.`
      );
    }

    // The escape hatch for scripts with no ISO 15924 code (Kryptonian).
    // Only valid on the locale that owns the converter — running the
    // Kryptonian cipher on some other language is never what anyone meant.
    if (isConverterKeyEscapeHatch(requested) && SCRIPT_CONVERTERS[requested].toScript === null) {
      if (requested !== registeredKey) {
        throw new Error(
          `Invalid "script" for ${localeCode}: "${requested}" is the ${SCRIPT_CONVERTERS[requested].to} ` +
          `converter, which belongs to the ${requested} locale, not ${localeCode}.`
        );
      }
      return { script: null, source: 'config', converterKey: requested };
    }

    const alias = LEGACY_SCRIPT_ALIASES[requested.toLowerCase()];
    if (alias && !ISO_15924.test(requested)) {
      throw new Error(
        `Invalid "script" for ${localeCode}: "${requested}" is not an ISO 15924 code. Use "${alias}".`
      );
    }

    // Case-normalize a 4-letter value before validating: "cans", "PIQD" and
    // "Cans" all mean the same code, and the project's own docs used the
    // lowercase form for years — erroring on it would punish people for
    // following us.
    const normalized = /^[A-Za-z]{4}$/.test(requested)
      ? requested[0].toUpperCase() + requested.slice(1).toLowerCase()
      : requested;
    if (!ISO_15924.test(normalized)) {
      throw new Error(
        `Invalid "script" for ${localeCode}: "${requested}" is not an ISO 15924 code ` +
        `(four letters — e.g. "Latn", "Cans", "Cyrl").`
      );
    }

    // A locale WITH a converter can produce exactly two scripts: the working
    // script and the converter's target. Anything else is a config mistake
    // that would otherwise no-op silently — name what IS available.
    if (conv && normalized !== conv.fromScript && normalized !== conv.toScript) {
      const options = [`"${conv.fromScript}" (${conv.from})`, conv.toScript ? `"${conv.toScript}" (${conv.to})` : `"${registeredKey}" (${conv.to})`];
      throw new Error(
        `Invalid "script" for ${localeCode}: "${requested}" is not a script this locale can produce. ` +
        `Available: ${options.join(' or ')}.`
      );
    }

    return {
      script: normalized,
      source: 'config',
      converterKey: conv && normalized === conv.toScript ? registeredKey : null,
    };
  }

  // No explicit choice. What happens next depends on what KIND of converter
  // this locale has — a real-Unicode orthography choice is the user's to
  // make; an out-of-Unicode display encoding defaults safely off.
  if (conv) {
    if (conv.puaRange === null) {
      return {
        script: null,
        source: 'choice-required',
        converterKey: null,
        choices: [
          { script: conv.fromScript, label: conv.from },
          { script: conv.toScript, label: conv.to },
        ],
      };
    }
    return { script: conv.fromScript, source: 'default', converterKey: null };
  }

  // No converter — nothing to decide. An informational `script` from config
  // never reaches here (handled above); absence means absence.
  return { script: null, source: 'none', converterKey: null };
}

/**
 * Format the choice-required error for a locale, shared by every lane that
 * refuses to translate without the decision — one message, everywhere.
 *
 * @param {string} localeCode
 * @param {{choices: Array<{script: string, label: string}>}} resolution
 * @returns {string}
 */
function formatScriptChoiceError(localeCode, resolution) {
  const opts = resolution.choices
    .map(c => `"script": "${c.script}" (${c.label})`)
    .join(' or ');
  return (
    `${localeCode} has more than one real orthography and Champollion will not pick one ` +
    `for a community. Set ${opts} for ${localeCode} in champollion.config.json.`
  );
}

// -----------------------------------------------------------------
// Transliteration fallbacks — user-declared rules for unmapped letters
// -----------------------------------------------------------------

/**
 * Validate a `scriptFallback` map against a converter.
 *
 * Each entry maps a working-script sequence the converter does NOT cover to a
 * replacement it DOES ("d" → "D", "c" → "ch" for Klingon). The replacement is
 * itself converted through the normal table, so it must be fully mapped — a
 * fallback that lands on another unmapped letter would just move the hole.
 *
 * Champollion ships NO fallbacks of its own: inventing orthographic
 * adaptations — especially for a real language's orthography — is not ours to
 * do. The docs list conventions with their sources; adopting one is a
 * deliberate, per-project act.
 *
 * @param {object} fallbackMap - { sequence: replacement }
 * @param {string} converterKey - Key into SCRIPT_CONVERTERS
 * @throws {Error} naming the offending entry
 */
function validateScriptFallback(fallbackMap, converterKey) {
  if (fallbackMap == null) return;
  if (typeof fallbackMap !== 'object' || Array.isArray(fallbackMap)) {
    throw new Error(
      `"scriptFallback" must be an object mapping letters to replacements, got ${Array.isArray(fallbackMap) ? 'array' : typeof fallbackMap}.`
    );
  }
  for (const [from, to] of Object.entries(fallbackMap)) {
    if (typeof to !== 'string' || to === '') {
      throw new Error(
        `"scriptFallback" entry "${from}": replacement must be a non-empty string, got ${JSON.stringify(to)}.`
      );
    }
    if (from === '') {
      throw new Error('"scriptFallback" has an empty-string key — nothing to replace.');
    }
    const holes = unmappedLetters(to, converterKey);
    if (holes.length > 0) {
      throw new Error(
        `"scriptFallback" entry "${from}" → "${to}": the replacement itself contains ` +
        `letter(s) the ${converterKey} converter cannot map (${holes.join(', ')}). ` +
        'A fallback must land on fully-mapped text.'
      );
    }
  }
}

/**
 * Apply a scriptFallback map to working-script text, longest keys first so
 * "ck" wins over "c" + "k". Pure textual substitution — the result then runs
 * through the normal conversion table.
 *
 * @param {string} text - Working-script text
 * @param {object|null} fallbackMap - Validated { sequence: replacement } map
 * @returns {string}
 */
function applyScriptFallback(text, fallbackMap) {
  if (!fallbackMap || typeof text !== 'string' || text === '') return text;
  const keys = Object.keys(fallbackMap).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return text;

  let out = '';
  let i = 0;
  while (i < text.length) {
    let matched = null;
    for (const k of keys) {
      if (text.startsWith(k, i)) { matched = k; break; }
    }
    if (matched) {
      out += fallbackMap[matched];
      i += matched.length;
    } else {
      out += text[i];
      i++;
    }
  }
  return out;
}

// -----------------------------------------------------------------
// Coverage and reversal — making the converters honest
// -----------------------------------------------------------------

/**
 * The set of source sequences a converter's map covers, longest first.
 * Derived from the map itself so coverage can never drift from behaviour.
 */
function mappedSequences(converterKey) {
  const conv = SCRIPT_CONVERTERS[converterKey];
  if (!conv?.map) return null;
  return conv.map.map(([from]) => from).sort((a, b) => b.length - a.length);
}

/**
 * Report the letters a converter would silently pass through untranslated.
 *
 * WHY: every converter here passes unmatched characters through, which is
 * correct for spaces, digits and punctuation and wrong for letters. Klingon
 * romanization has no `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` or `z`, so text
 * containing them is not Klingon romanization — but the converter mapped what
 * it recognised and emitted the rest as Latin, producing strings that are half
 * pIqaD and half English with nothing raising a hand. 23 of the 32 affected
 * strings found in the wild were this shape.
 *
 * Digits, whitespace and punctuation are legitimate passthrough and are never
 * reported.
 *
 * @param {string} text - Text in the converter's working script
 * @param {string} converterKey - Key into SCRIPT_CONVERTERS
 * @returns {string[]} Distinct unmapped letters, in first-appearance order
 */
function unmappedLetters(text, converterKey) {
  const conv = SCRIPT_CONVERTERS[converterKey];
  if (!conv || typeof text !== 'string' || text === '') return [];

  // Kryptonian is arithmetic over A–Z with no table; every letter outside
  // the basic Latin alphabet is unmapped.
  if (!conv.map) {
    const out = [];
    for (const ch of text) {
      if (!/\p{L}/u.test(ch)) continue;
      if (/[A-Za-z]/.test(ch)) continue;
      if (!out.includes(ch)) out.push(ch);
    }
    return out;
  }

  const sequences = mappedSequences(converterKey);
  // Converters that lowercase (or uppercase) their input before matching must
  // be probed in that same normalised form, or every capital reads as unmapped.
  const probe = conv.converter === latinToTengwar || conv.converter === sroToSyllabics
    ? text.toLowerCase()
    : text;

  const out = [];
  let i = 0;
  while (i < probe.length) {
    let matched = 0;
    for (const seq of sequences) {
      if (probe.startsWith(seq, i)) { matched = seq.length; break; }
    }
    if (matched) { i += matched; continue; }
    const ch = probe[i];
    if (/\p{L}/u.test(ch) && !out.includes(ch)) out.push(ch);
    i++;
  }
  return out;
}

/**
 * Reverse a converter's output back to its working script.
 *
 * Used by `champollion repair-script` to undo conversions that should never
 * have happened. Reversal is exact for pIqaD (the map is injective — only the
 * straight and curly apostrophe share a codepoint, and both restore as `'`).
 * Tengwar, Cree syllabics and Kryptonian normalise case on the way in, so the
 * reverse cannot recover the original capitalisation; callers are told this
 * via `caseLossy` rather than being left to discover it.
 *
 * @param {string} text - Converted text
 * @param {string} converterKey - Key into SCRIPT_CONVERTERS
 * @returns {{ reversed: string, caseLossy: boolean, unreversed: string[] }}
 */
function reverseScript(text, converterKey) {
  const conv = SCRIPT_CONVERTERS[converterKey];
  if (!conv || typeof text !== 'string' || text === '') {
    return { reversed: text, caseLossy: false, unreversed: [] };
  }

  const caseLossy = conv.converter !== romanizationToPiqad;

  if (!conv.map) {
    // Kryptonian: U+E100–E119 → A–Z.
    const [lo, hi] = conv.puaRange;
    let out = '';
    const unreversed = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp >= lo && cp <= hi) out += String.fromCharCode(65 + (cp - lo));
      else {
        out += ch;
        if (isPrivateUse(cp) && !unreversed.includes(ch)) unreversed.push(ch);
      }
    }
    return { reversed: out, caseLossy, unreversed };
  }

  // Build the reverse table. Later duplicate targets do not overwrite earlier
  // ones, so `'` wins over `’` for the shared glottal-stop codepoint.
  const reverse = new Map();
  for (const [from, to] of conv.map) {
    if (!reverse.has(to)) reverse.set(to, from);
  }

  let out = '';
  const unreversed = [];
  for (const ch of text) {
    const hit = reverse.get(ch);
    if (hit !== undefined) { out += hit; continue; }
    out += ch;
    const cp = ch.codePointAt(0);
    if (isPrivateUse(cp) && !unreversed.includes(ch)) unreversed.push(ch);
  }
  return { reversed: out, caseLossy, unreversed };
}

/**
 * Unicode Private Use Area membership — the BMP block plus both supplementary
 * planes. `\p{Co}` in one predicate, without a regex per call.
 */
function isPrivateUse(codePoint) {
  return (codePoint >= 0xE000 && codePoint <= 0xF8FF)
    || (codePoint >= 0xF0000 && codePoint <= 0xFFFFD)
    || (codePoint >= 0x100000 && codePoint <= 0x10FFFD);
}

/**
 * Convert text using the registered converter for a locale.
 *
 * `unmapped` lists letters the converter could not translate and passed
 * through as-is. A non-empty `unmapped` means the input was not valid text in
 * the converter's working script, and the output is a mix of both scripts —
 * callers must treat it as a failure rather than writing it out.
 *
 * @param {string} text - Text in the source script
 * @param {string} localeCode - Locale code (e.g., "crk", "sr")
 * @returns {{ converted: string, converterUsed: string|null, unmapped: string[] }}
 */
function convertScript(text, localeCode) {
  const converter = SCRIPT_CONVERTERS[localeCode];
  if (!converter) {
    return { converted: text, converterUsed: null, unmapped: [] };
  }

  return {
    converted: converter.converter(text),
    converterUsed: `${converter.from} → ${converter.to}`,
    unmapped: unmappedLetters(text, localeCode),
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
  const info = {
    from: conv.from,
    to: conv.to,
    type: conv.type,
    fromScript: conv.fromScript,
    toScript: conv.toScript,
    puaRange: conv.puaRange,
  };
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
  resolveTargetScript,
  converterKeyForLocale,
  formatScriptChoiceError,
  validateScriptFallback,
  applyScriptFallback,
  unmappedLetters,
  reverseScript,
  isPrivateUse,
  SCRIPT_CONVERTERS,
};
