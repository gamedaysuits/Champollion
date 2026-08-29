/**
 * walsValueDecoder.js
 *
 * Static decoder for WALS (World Atlas of Language Structures) feature values.
 * WALS stores typological features as numeric category codes. This module maps
 * those codes back to human-readable labels.
 *
 * Source: https://wals.info/
 * Each feature has a chapter ID (e.g. "1A" for Consonant Inventories) and
 * numbered value categories (e.g. 1 = "Small", 2 = "Moderately small", etc.)
 *
 * The feature names here match EXACTLY what the pipeline stores in the
 * typology.keyFeatures[].property field (from the WALS CLDF data).
 *
 * This is NOT exhaustive — WALS has 192 features. We cover the ~100 most
 * linguistically interesting ones. Unknown features fall back to showing the
 * raw numeric value.
 */

const WALS_FEATURES = {
  /* ===== PHONOLOGY ===== */

  'Consonant Inventories': {
    id: '1A',
    values: { 1: 'Small', 2: 'Moderately small', 3: 'Average', 4: 'Moderately large', 5: 'Large' },
  },
  'Vowel Quality Inventories': {
    id: '2A',
    values: { 1: 'Small (2–4)', 2: 'Average (5–6)', 3: 'Large (7–14)' },
  },
  'Consonant-Vowel Ratio': {
    id: '3A',
    values: { 1: 'Low', 2: 'Moderately low', 3: 'Average', 4: 'Moderately high', 5: 'High' },
  },
  'Voicing in Plosives and Fricatives': {
    id: '4A',
    values: { 1: 'No voicing contrast', 2: 'In plosives alone', 3: 'In fricatives alone', 4: 'In both' },
  },
  'Voicing and Gaps in Plosive Systems': {
    id: '5A',
    values: { 1: 'Other', 2: 'None missing in /p b t d k g/', 3: '/p/ missing', 4: '/g/ missing', 5: 'Both missing', 6: 'Other missing' },
  },
  'Uvular Consonants': {
    id: '6A',
    values: { 1: 'None', 2: 'Uvular stops only', 3: 'Uvular continuants only', 4: 'Uvular stops and continuants' },
  },
  'Glottalized Consonants': {
    id: '7A',
    values: { 1: 'No glottalized consonants', 2: 'Ejectives only', 3: 'Implosives only', 4: 'Glottalized resonants only', 5: 'Ejectives and implosives', 6: 'Ejectives and glottalized resonants', 7: 'Implosives and glottalized resonants' },
  },
  'Lateral Consonants': {
    id: '8A',
    values: { 1: 'No laterals', 2: '/l/, no obstruent laterals', 3: 'Laterals, including obstruent laterals' },
  },
  'The Velar Nasal': {
    id: '9A',
    values: { 1: 'No velar nasal', 2: 'Velar nasal, only in codas', 3: 'Also in onsets', 4: 'No initial velar nasal' },
  },
  'Vowel Nasalization': {
    id: '10A',
    values: { 1: 'Contrast present', 2: 'Contrast absent' },
  },
  'Front Rounded Vowels': {
    id: '11A',
    values: { 1: 'None', 2: 'High and mid', 3: 'High only', 4: 'Mid only' },
  },
  'Syllable Structure': {
    id: '12A',
    values: { 1: 'Simple', 2: 'Moderately complex', 3: 'Complex' },
  },
  'Tone': {
    id: '13A',
    values: { 1: 'No tones', 2: 'Simple tone system', 3: 'Complex tone system' },
  },
  'Fixed Stress Locations': {
    id: '14A',
    values: { 1: 'Right-edge: ultimate', 2: 'Right-edge: penultimate', 3: 'Right-edge: antepenultimate', 4: 'Left-edge: initial', 5: 'Left-edge: second', 6: 'Left-edge: third', 7: 'No fixed stress' },
  },
  'Weight-Sensitive Stress': {
    id: '15A',
    values: { 1: 'Unbounded: left-edge', 2: 'Unbounded: right-edge', 3: 'Bounded: left-edge', 4: 'Bounded: right-edge', 5: 'Fixed stress (no weight-sensitivity)', 6: 'Combined', 7: 'Not predictable' },
  },
  'Rhythm Types': {
    id: '17A',
    values: { 1: 'Trochaic', 2: 'Iambic', 3: 'Undetermined', 4: 'No rhythmic stress' },
  },
  'Absence of Common Consonants': {
    id: '18A',
    values: { 1: 'All present', 2: 'No bilabials', 3: 'No fricatives', 4: 'No nasals', 5: 'No bilabials or nasals', 6: 'No bilabials or fricatives' },
  },
  'Presence of Uncommon Consonants': {
    id: '19A',
    values: { 1: 'None', 2: 'Clicks', 3: 'Labial-velars', 4: 'Pharyngeals', 5: 'Th', 6: 'Clicks and labial-velars' },
  },

  /* ===== MORPHOLOGY ===== */

  'Fusion of Selected Inflectional Formatives': {
    id: '20A',
    values: { 1: 'Exclusively concatenative', 2: 'Predominantly concatenative', 3: 'Predominantly non-concatenative' },
  },
  'Exponence of Selected Inflectional Formatives': {
    id: '21A',
    values: { 1: 'Monoexponential case', 2: 'Case + number', 3: 'Case + referentiality', 4: 'No case' },
  },
  'Inflectional Synthesis of the Verb': {
    id: '22A',
    values: { 1: '0–1 categories per word', 2: '2–3 categories per word', 3: '4–5 categories per word', 4: '6–7 categories per word', 5: '8–9 categories per word', 6: '10–11 categories per word', 7: '12–13 categories per word' },
  },
  'Locus of Marking in the Clause': {
    id: '23A',
    values: { 1: 'Head marking', 2: 'Dependent marking', 3: 'Double marking', 4: 'No marking', 5: 'Other' },
  },
  'Locus of Marking in Possessive Noun Phrases': {
    id: '24A',
    values: { 1: 'Head marking', 2: 'Dependent marking', 3: 'Double marking', 4: 'No marking', 5: 'Other' },
  },
  'Prefixing vs. Suffixing in Inflectional Morphology': {
    id: '26A',
    values: { 1: 'Little affixation', 2: 'Predominantly suffixing', 3: 'Predominantly prefixing', 4: 'Equal prefixing and suffixing', 5: 'Weakly suffixing', 6: 'Weakly prefixing' },
  },
  'Reduplication': {
    id: '27A',
    values: { 1: 'Productive full and partial reduplication', 2: 'Full reduplication only', 3: 'No productive reduplication' },
  },

  /* ===== NOMINAL CATEGORIES ===== */

  'Number of Genders': {
    id: '30A',
    values: { 1: 'None', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five or more' },
  },
  'Sex-based and Non-sex-based Gender Systems': {
    id: '31A',
    values: { 1: 'Sex-based', 2: 'Non-sex-based', 3: 'No gender' },
  },
  'Systems of Gender Assignment': {
    id: '32A',
    values: { 1: 'Semantic', 2: 'Semantic and formal', 3: 'No gender' },
  },
  'Coding of Nominal Plurality': {
    id: '33A',
    values: { 1: 'Plural suffix', 2: 'Plural prefix', 3: 'Plural stem change', 4: 'Plural clitic', 5: 'Plural word', 6: 'Mixed morphological plurality', 7: 'No plural' },
  },
  'Occurrence of Nominal Plurality': {
    id: '34A',
    values: { 1: 'All nouns always', 2: 'All nouns optional', 3: 'All nouns, always in pronouns', 4: 'Some nouns only', 5: 'No plural', 6: 'Obligatory in all nouns' },
  },
  'Plurality in Independent Personal Pronouns': {
    id: '35A',
    values: { 1: 'Person-number affixes', 2: 'Person affixes; no number', 3: 'Number affixes; no person', 4: 'No person or number affixes' },
  },
  'Definite Articles': {
    id: '37A',
    values: { 1: 'Definite word, distinct from demonstrative', 2: 'Definite word, same as demonstrative', 3: 'Definite affix', 4: 'No definite, but indefinite article', 5: 'No article' },
  },
  'Indefinite Articles': {
    id: '38A',
    values: { 1: 'Indefinite word, distinct from "one"', 2: 'Indefinite word, same as "one"', 3: 'Indefinite affix', 4: 'No indefinite, but definite article', 5: 'No article' },
  },
  'Inclusive/Exclusive Distinction in Independent Pronouns': {
    id: '39A',
    values: { 1: 'No inclusive/exclusive', 2: 'Inclusive/exclusive' },
  },
  'Distance Contrasts in Demonstratives': {
    id: '41A',
    values: { 1: 'Two-way contrast', 2: 'Three-way contrast', 3: 'Four-way contrast', 4: 'Five+-way contrast', 5: 'No distance contrast' },
  },
  'Gender Distinctions in Independent Personal Pronouns': {
    id: '44A',
    values: { 1: 'No gender distinctions', 2: '3rd person only', 3: '3rd person + 1st/2nd person', 4: '1st person only', 5: '3rd and 2nd but not 1st' },
  },
  'Politeness Distinctions in Pronouns': {
    id: '45A',
    values: { 1: 'No politeness distinction', 2: 'Binary politeness distinction', 3: 'Multiple politeness distinctions', 4: 'Pronouns avoided for politeness' },
  },
  'Number of Cases': {
    id: '49A',
    values: { 1: 'No morphological case-marking', 2: '2 cases', 3: '3–4 cases', 4: '5 cases', 5: '6–7 cases', 6: '8–9 cases', 7: '10 or more cases' },
  },
  'Numeral Classifiers': {
    id: '55A',
    values: { 1: 'Absent', 2: 'Optional', 3: 'Obligatory' },
  },
  'Ordinal Numerals': {
    id: '53A',
    values: { 1: 'None', 2: 'One, two, three', 3: 'First, two, three', 4: 'First, second, three', 5: 'First, second, third' },
  },
  'Numeral Bases': {
    id: '131A',
    values: { 1: 'Decimal', 2: 'Hybrid vigesimal-decimal', 3: 'Pure vigesimal', 4: 'Other', 5: 'Quinary', 6: 'Body-part tally system', 7: 'Restricted (1-5 only)', 8: 'Senary' },
  },

  /* ===== VERBAL CATEGORIES ===== */

  'Perfective/Imperfective Aspect': {
    id: '65A',
    values: { 1: 'Grammatical marking', 2: 'No grammatical marking' },
  },
  'The Past Tense': {
    id: '66A',
    values: { 1: 'No past tense', 2: '2–3 past tenses', 3: '4+ past tenses', 4: 'Present, no remoteness distinctions' },
  },
  'The Future Tense': {
    id: '67A',
    values: { 1: 'Inflectional future', 2: 'No inflectional future' },
  },
  'The Perfect': {
    id: '68A',
    values: { 1: 'From possessive', 2: 'From "finish"/"already"', 3: 'Other', 4: 'No perfect' },
  },
  'Position of Tense-Aspect Affixes': {
    id: '69A',
    values: { 1: 'Tense-aspect prefixes', 2: 'Tense-aspect suffixes', 3: 'Mixed type' },
  },
  'The Morphological Imperative': {
    id: '70A',
    values: { 1: 'Second singular and second plural', 2: 'Second singular only', 3: 'Only other', 4: 'No morphological imperative' },
  },
  'The Prohibitive': {
    id: '71A',
    values: { 1: 'Normal imperative + normal negative', 2: 'Normal imperative + special negative', 3: 'Special imperative + normal negative', 4: 'Special imperative + special negative' },
  },
  'The Optative': {
    id: '73A',
    values: { 1: 'Inflectional optative present', 2: 'No inflectional optative' },
  },
  'Situational Possibility': {
    id: '74A',
    values: { 1: 'Verbal constructions', 2: 'Affixal', 3: 'Other' },
  },
  'Epistemic Possibility': {
    id: '75A',
    values: { 1: 'Verbal constructions', 2: 'Affixal', 3: 'Other' },
  },
  'Coding of Evidentiality': {
    id: '78A',
    values: { 1: 'Part of tense system', 2: 'Part of modal system', 3: 'Mixed: TAM + separate', 4: 'Separate evidentials' },
  },
  'Suppletion According to Tense and Aspect': {
    id: '79A',
    values: { 1: 'Tense', 2: 'Aspect', 3: 'Tense and aspect', 4: 'None' },
  },

  /* ===== WORD ORDER ===== */

  'Order of Subject, Object and Verb': {
    id: '81A',
    values: { 1: 'SOV', 2: 'SVO', 3: 'VSO', 4: 'VOS', 5: 'OVS', 6: 'OSV', 7: 'No dominant order' },
  },
  'Order of Subject and Verb': {
    id: '82A',
    values: { 1: 'SV', 2: 'VS', 3: 'No dominant order' },
  },
  'Order of Object and Verb': {
    id: '83A',
    values: { 1: 'OV', 2: 'VO', 3: 'No dominant order' },
  },
  'Order of Adposition and Noun Phrase': {
    id: '85A',
    values: { 1: 'Postpositions', 2: 'Prepositions', 3: 'Inpositions', 4: 'No dominant order' },
  },
  'Order of Genitive and Noun': {
    id: '86A',
    values: { 1: 'Genitive-Noun', 2: 'Noun-Genitive', 3: 'No dominant order' },
  },
  'Order of Adjective and Noun': {
    id: '87A',
    values: { 1: 'Adjective-Noun', 2: 'Noun-Adjective', 3: 'No dominant order', 4: 'Only internally-headed relative clauses' },
  },
  'Order of Demonstrative and Noun': {
    id: '88A',
    values: { 1: 'Demonstrative-Noun', 2: 'Noun-Demonstrative', 3: 'Demonstrative prefix', 4: 'Demonstrative suffix', 5: 'Demonstrative-before and -after Noun', 6: 'Mixed' },
  },
  'Order of Numeral and Noun': {
    id: '89A',
    values: { 1: 'Numeral-Noun', 2: 'Noun-Numeral', 3: 'No dominant order' },
  },
  'Order of Relative Clause and Noun': {
    id: '90A',
    values: { 1: 'Noun-Relative clause', 2: 'Relative clause-Noun', 3: 'Internally headed', 4: 'Correlative', 5: 'Adjoined', 6: 'Double-headed' },
  },
  'Order of Degree Word and Adjective': {
    id: '91A',
    values: { 1: 'Degree word-Adjective', 2: 'Adjective-Degree word', 3: 'No dominant order' },
  },

  /* ===== CASE AND AGREEMENT ===== */

  'Position of Case Affixes': {
    id: '51A',
    values: { 1: 'Case suffixes', 2: 'Case prefixes', 3: 'Case tone', 4: 'No case affixes or adpositional clitics' },
  },
  'Alignment of Case Marking of Full Noun Phrases': {
    id: '98A',
    values: { 1: 'Nominative-accusative', 2: 'Ergative-absolutive', 3: 'Tripartite', 4: 'Active-inactive', 5: 'Neutral', 6: 'Marked nominative' },
  },
  'Alignment of Case Marking of Pronouns': {
    id: '99A',
    values: { 1: 'Nominative-accusative', 2: 'Ergative-absolutive', 3: 'Tripartite', 4: 'Active-inactive', 5: 'Neutral' },
  },
  'Alignment of Verbal Person Marking': {
    id: '100A',
    values: { 1: 'Accusative', 2: 'Ergative', 3: 'Active', 4: 'Hierarchical', 5: 'Neutral' },
  },
  'Verbal Person Marking': {
    id: '102A',
    values: { 1: 'Only A', 2: 'Only P', 3: 'A and P', 4: 'No person marking' },
  },
  'Order of Person Markers on the Verb': {
    id: '104A',
    values: { 1: 'A and P do not, or not both, parsing verb', 2: 'A before P', 3: 'P before A' },
  },
  'Expression of Pronominal Subjects': {
    id: '101A',
    values: { 1: 'Obligatory pronouns in subject position', 2: 'Subject affixes on verb', 3: 'Subject clitics on verb', 4: 'Subject pronouns in different position', 5: 'No subject expression', 6: 'Mixed' },
  },
  'Person Marking on Adpositions': {
    id: '48A',
    values: { 1: 'No person marking', 2: 'Person marking' },
  },

  /* ===== COMPLEX CONSTRUCTIONS ===== */

  'Passive Constructions': {
    id: '107A',
    values: { 1: 'Present', 2: 'Absent' },
  },
  'Antipassive Constructions': {
    id: '108A',
    values: { 1: 'No antipassive', 2: 'Antipassive' },
  },
  'Applicative Constructions': {
    id: '109A',
    values: { 1: 'No applicative construction', 2: 'Applicative only, no secondary object', 3: 'Secondary objects and applicatives', 4: 'Secondary objects but no applicatives' },
  },
  'Periphrastic Causative Constructions': {
    id: '110A',
    values: { 1: 'Sequential but no purposive', 2: 'Purposive but no sequential', 3: 'Both', 4: 'Neither' },
  },
  'Nonperiphrastic Causative Constructions': {
    id: '111A',
    values: { 1: 'Morphological but no compound', 2: 'Compound but no morphological', 3: 'Both', 4: 'Neither' },
  },
  'Negative Morphemes': {
    id: '112A',
    values: { 1: 'Negative affix', 2: 'Negative particle', 3: 'Negative auxiliary verb', 4: 'Negative word, unclear if verb or particle', 5: 'Mixed', 6: 'Negative suffix + negative word' },
  },
  'Polar Questions': {
    id: '116A',
    values: { 1: 'Question particle', 2: 'Interrogative verb morphology', 3: 'Question particle and interrogative verb morphology', 4: 'Interrogative word order', 5: 'Absence of declarative morphemes', 6: 'No interrogative-declarative distinction' },
  },
  'Predicative Adjectives': {
    id: '118A',
    values: { 1: 'Verbal encoding', 2: 'Nonverbal encoding', 3: 'Mixed' },
  },
  'Comparative Constructions': {
    id: '121A',
    values: { 1: 'Locational', 2: 'Exceed', 3: 'Conjoined', 4: 'Particle' },
  },

  /* ===== COLOUR ===== */

  'Number of Basic Colour Categories': {
    id: '133A',
    values: { 1: '3–4', 2: '5', 3: '6', 4: '7', 5: '8', 6: '9', 7: '10', 8: '11', 9: '12', 10: '3', 11: '4' },
  },
  'Green and Blue': {
    id: '134A',
    values: { 1: 'Green vs. blue', 2: 'Green/blue (grue)', 3: 'Black = green/blue' },
  },
  'Red and Yellow': {
    id: '135A',
    values: { 1: 'Red vs. yellow', 2: 'Red/yellow' },
  },
  'Finger and Hand': {
    id: '130A',
    values: { 1: 'Identical', 2: 'Different' },
  },
  'Hand and Arm': {
    id: '129A',
    values: { 1: 'Identical', 2: 'Different' },
  },
};


/**
 * Decode a WALS numeric value to its human-readable label.
 *
 * @param {string} featureName — the WALS feature name (e.g. "Consonant Inventories")
 * @param {string|number} value — the numeric category code (e.g. "1", "3")
 * @returns {string} Human-readable label, or the raw value if unknown
 */
export function decodeWalsValue(featureName, value) {
  const feature = WALS_FEATURES[featureName];
  if (!feature) return String(value);

  const numVal = parseInt(value, 10);
  if (isNaN(numVal)) return String(value);

  return feature.values[numVal] || String(value);
}


/**
 * Get the WALS feature page URL for a given feature name.
 *
 * @param {string} featureName — the WALS feature name
 * @returns {string|null} URL to the WALS feature chapter, or null if unknown
 */
export function getWalsFeatureUrl(featureName) {
  const feature = WALS_FEATURES[featureName];
  if (!feature) return null;
  return `https://wals.info/feature/${feature.id}`;
}


/**
 * Check whether a feature name is a known WALS feature.
 */
export function isKnownWalsFeature(featureName) {
  return featureName in WALS_FEATURES;
}
