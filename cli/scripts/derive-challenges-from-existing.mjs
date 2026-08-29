#!/usr/bin/env node

/**
 * derive-challenges-from-existing.mjs
 * ────────────────────────────────────────────────────────────────
 * Generates minimal linguisticChallenges from data already on
 * the card (classification, script, dir, typology, phonology).
 *
 * This extends coverage to the ~5,000 languages not covered by
 * WALS or Grambank by deriving what we CAN say from:
 *   - Language family (classification) → known family-level traits
 *   - Script → script-specific MT challenges
 *   - Writing direction → RTL handling
 *   - Phonology → tone/phoneme inventory size
 *   - Typology → any features already on the card
 *
 * Sources: derived from existing card data (no new external data).
 * Each challenge cites the specific card field it was derived from.
 *
 * Merge-only: never overwrites existing challenges.
 *
 * Usage:
 *   node scripts/derive-challenges-from-existing.mjs
 *   node scripts/derive-challenges-from-existing.mjs --dry-run
 * ────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'shared', 'language-cards');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Family-level traits ──
// Some language families have well-documented shared features
// that create predictable MT challenges.
// Source: typological universals from Dryer & Haspelmath (2013), WALS.
const FAMILY_TRAITS = {
  'Sino-Tibetan': {
    tone: 'Member of Sino-Tibetan family — most languages in this family are tonal. Tone distinctions carry lexical meaning and are lost in text-only translation. (Source: family-level trait, Dryer & Haspelmath 2013)',
    classifiers: 'Sino-Tibetan languages commonly use numeral classifiers for counting nouns. Classifier selection depends on semantic properties of the noun. (Source: family-level trait)',
  },
  'Niger-Congo': {
    nounClasses: 'Member of Niger-Congo family — most languages have extensive noun class systems (similar to grammatical gender but with 10-20+ classes). Agreement patterns permeate grammar. (Source: family-level trait, Dryer & Haspelmath 2013)',
  },
  'Afro-Asiatic': {
    rootPattern: 'Member of Afro-Asiatic family — typically uses root-and-pattern morphology where consonantal roots interleave with vowel patterns. This non-concatenative morphology challenges standard tokenizers. (Source: family-level trait)',
  },
  'Austronesian': {
    voiceFocus: 'Member of Austronesian family — many languages use voice/focus systems (rather than active/passive) that determine argument structure differently from European languages. (Source: family-level trait)',
  },
  'Dravidian': {
    agglutination: 'Member of Dravidian family — typically agglutinative with extensive suffixation. Words can encode subject, object, tense, mood, and aspect in a single verbal complex. (Source: family-level trait)',
  },
  'Turkic': {
    agglutination: 'Member of Turkic family — highly agglutinative with regular, productive suffixation. Long words encoding multiple grammatical categories are normal. Vowel harmony affects suffix forms. (Source: family-level trait)',
    vowelHarmony: 'Turkic vowel harmony: suffixes change form to agree with the vowels in the word stem. This affects morphological generation in MT. (Source: family-level trait)',
  },
  'Uralic': {
    cases: 'Member of Uralic family — many languages have extensive case systems (Finnish: 15 cases, Hungarian: 18 cases). Grammatical relations encoded in case must be correctly generated. (Source: family-level trait)',
  },
  'Austroasiatic': {
    register: 'Member of Austroasiatic family — some languages use phonation-type register (breathy vs. modal voice) as a phonemic distinction, which is not captured in standard orthography. (Source: family-level trait)',
  },
  'Tai-Kadai': {
    tone: 'Member of Tai-Kadai family — typically tonal with tone carrying lexical distinctions. Tone patterns interact with sentence-level intonation. (Source: family-level trait)',
    serialVerbs: 'Tai-Kadai languages commonly use serial verb constructions where multiple verbs combine without conjunctions. (Source: family-level trait)',
  },
};

// ── Script-specific challenges ──
const SCRIPT_CHALLENGES = {
  'Arab': 'Arabic script: right-to-left with contextual letter forms (initial, medial, final). Short vowels often omitted in writing, creating ambiguity for MT systems. (Source: script properties)',
  'Hebr': 'Hebrew script: right-to-left. Like Arabic, vowel diacritics (niqqud) are usually omitted in modern text, creating lexical ambiguity. (Source: script properties)',
  'Deva': 'Devanagari script: complex conjunct consonants (ligatures) and virama stacking create challenges for character-level models and OCR. (Source: script properties)',
  'Thai': 'Thai script: no spaces between words. Word segmentation is required before tokenization and is a significant challenge for NLP/MT. (Source: script properties)',
  'Khmr': 'Khmer script: no spaces between words (similar to Thai). Complex stacking consonants and subscript forms. Word segmentation required. (Source: script properties)',
  'Mymr': 'Myanmar script: no standard word spacing. Complex stacking and reordering rules for consonant clusters. Word segmentation is a preprocessing challenge. (Source: script properties)',
  'Lao':  'Lao script: no spaces between words. Similar segmentation challenges to Thai. Limited digital resources and tools for preprocessing. (Source: script properties)',
  'Tibt': 'Tibetan script: syllables are separated by tsheg (interpunct) but word boundaries are not marked. Stacked consonant clusters (vertically). (Source: script properties)',
  'Ethi': 'Ethiopic (Ge\'ez) script: abugida where each symbol represents a consonant-vowel syllable. No capitalization. Gemination (consonant doubling) carries meaning but is not always written. (Source: script properties)',
  'Hans': 'Simplified Chinese characters: no word boundaries in text. Word segmentation is a critical preprocessing step. Character-level ambiguity (one character, multiple meanings). (Source: script properties)',
  'Hant': 'Traditional Chinese characters: no word boundaries. Each character typically represents one syllable/morpheme. Mapping to simplified Chinese adds translation complexity. (Source: script properties)',
  'Jpan': 'Japanese script mixes kanji, hiragana, katakana, and romaji. No word spacing. Multiple readings per kanji character create disambiguation challenges. (Source: script properties)',
  'Kore': 'Korean Hangul: syllable blocks composed of 2-4 jamo (letters). Word spacing exists but compound words are common. Extensive use of Sino-Korean vocabulary alongside native Korean. (Source: script properties)',
  'Cans': 'Canadian Aboriginal Syllabics: each symbol represents a consonant-vowel syllable. Finals (word-ending consonants) use superscript characters. Limited digital font and keyboard support. (Source: script properties)',
};


function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Challenge Derivation from Existing Card Data');
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE'));
  console.log('═══════════════════════════════════════════════════════════\n');

  const cardFiles = fs.readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'language-tree.json');

  let enriched = 0;
  let fromFamily = 0;
  let fromScript = 0;
  let fromTypology = 0;
  let fromPhonology = 0;

  for (const filename of cardFiles) {
    const filePath = path.join(CARDS_DIR, filename);
    let card;
    try {
      card = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    // Start with existing challenges or empty object
    const existing = card.linguisticChallenges !== null
      ? { ...card.linguisticChallenges }
      : {};
    let addedAny = false;

    // 1. Family-level traits
    const family = card.classification?.family;
    if (family && FAMILY_TRAITS[family]) {
      for (const [key, val] of Object.entries(FAMILY_TRAITS[family])) {
        if (!(key in existing)) {
          existing[key] = val;
          addedAny = true;
          fromFamily++;
        }
      }
    }

    // 2. Script-specific challenges
    const scriptCode = card.script;
    if (scriptCode && SCRIPT_CHALLENGES[scriptCode] && !existing.scriptChallenges) {
      existing.scriptChallenges = SCRIPT_CHALLENGES[scriptCode];
      addedAny = true;
      fromScript++;
    }

    // 3. RTL writing direction
    if (card.dir === 'rtl' && !existing.writingDirection) {
      existing.writingDirection = 'Right-to-left writing direction. Bidirectional text handling (bidi) is required when mixing with LTR content. UI layout must be mirrored. (Source: derived from script direction)';
      addedAny = true;
      fromScript++;
    }

    // 4. Phonology-derived challenges
    const phon = card.encyclopedic?.phonology;
    if (phon) {
      if (phon.toneCount && phon.toneCount > 0 && !existing.tone) {
        existing.tone = `Tonal language with ${phon.toneCount} distinct tone categories (Source: PHOIBLE). Tone carries lexical meaning that is lost in text-only translation but critical for TTS.`;
        addedAny = true;
        fromPhonology++;
      }
      if (phon.consonantCount && phon.consonantCount > 40 && !existing.largePhonemeInventory) {
        existing.largePhonemeInventory = `Large consonant inventory (${phon.consonantCount} consonants, Source: PHOIBLE). May include sounds not found in high-resource languages, creating challenges for transliteration and TTS.`;
        addedAny = true;
        fromPhonology++;
      }
    }

    // 5. Typology-derived challenges (for the 117 cards with typology but no challenges)
    const typ = card.encyclopedic?.typology;
    if (typ && card.linguisticChallenges === null) {
      if (typ.wordOrder && !existing.wordOrder) {
        const order = typ.wordOrder;
        if (order.includes('SOV')) {
          existing.wordOrder = `SOV word order (Source: WALS). Subject-Object-Verb requires significant reordering when translating to/from SVO languages.`;
        } else if (order.includes('VSO')) {
          existing.wordOrder = `VSO word order (Source: WALS). Verb-first placement requires reordering for most translation targets.`;
        } else if (order.includes('SVO')) {
          existing.wordOrder = `SVO word order (Source: WALS). Aligns with English but may need reordering for SOV/VSO targets.`;
        }
        if (existing.wordOrder) {
          addedAny = true;
          fromTypology++;
        }
      }
      if (typ.ergativeAbsolutive && !existing.ergativity) {
        existing.ergativity = 'Ergative-absolutive alignment (Source: Grambank). Subject/object marking follows different logic than nominative-accusative languages.';
        addedAny = true;
        fromTypology++;
      }
      if (typ.evidentiality && !existing.evidentiality) {
        existing.evidentiality = 'Has grammatical evidentiality (Source: Grambank). Speakers must mark information source (direct/hearsay/inference).';
        addedAny = true;
        fromTypology++;
      }
    }

    if (addedAny) {
      card.linguisticChallenges = existing;

      // Source attribution: update _fieldSources
      if (!card._fieldSources) card._fieldSources = {};
      const lcSources = Array.isArray(card._fieldSources.linguisticChallenges)
        ? [...card._fieldSources.linguisticChallenges]
        : card._fieldSources.linguisticChallenges
          ? [card._fieldSources.linguisticChallenges]
          : [];
      if (!lcSources.includes('derived-from-card-data')) {
        lcSources.push('derived-from-card-data');
      }
      card._fieldSources.linguisticChallenges = lcSources;

      enriched++;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf-8');
      }
    }
  }

  console.log('  RESULTS:');
  console.log('  ─────────────────────────────────────');
  console.log(`  Cards enriched:          ${enriched.toLocaleString()}`);
  console.log(`  From family traits:      ${fromFamily.toLocaleString()}`);
  console.log(`  From script properties:  ${fromScript.toLocaleString()}`);
  console.log(`  From typology:           ${fromTypology.toLocaleString()}`);
  console.log(`  From phonology:          ${fromPhonology.toLocaleString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
