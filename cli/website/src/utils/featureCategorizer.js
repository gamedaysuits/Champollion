/**
 * featureCategorizer.js
 *
 * The brain of the Typology Explorer's information architecture.
 *
 * Instead of dumping 500+ features grouped by database source (which nobody
 * understands), this module organizes them into human-meaningful SEMANTIC
 * CATEGORIES with:
 *
 *   1. Category grouping — "Sound System", "Word Structure", etc.
 *   2. Auto-explanations — pattern-matched plain-English descriptions
 *   3. Category metadata — icons, intros, significance for MT
 *
 * Philosophy: A researcher clicking "Case Syncretism → 2" should instantly
 * understand what that means and why it matters. We're building an epistemic
 * tool, not a database viewer.
 */


// ============================================================================
// CATEGORY DEFINITIONS — the top-level structure the user sees
// ============================================================================

export const CATEGORIES = {
  soundSystem: {
    id: 'soundSystem',
    icon: '🔊',
    title: 'Sound System',
    intro: 'The phonological building blocks — consonants, vowels, tone, and rhythm. These determine how the language sounds and affect speech recognition, text-to-speech, and transliteration.',
    order: 1,
  },
  wordStructure: {
    id: 'wordStructure',
    icon: '🧱',
    title: 'Word Structure',
    intro: 'How words are built from smaller meaningful units (morphology). Languages range from isolating (one meaning per word, like Chinese) to polysynthetic (entire sentences packed into one word, like Mohawk). This is often the #1 factor in MT difficulty.',
    order: 2,
  },
  sentenceStructure: {
    id: 'sentenceStructure',
    icon: '📐',
    title: 'Sentence Structure',
    intro: 'The rules for arranging words into sentences — word order, negation, questions, and complex constructions. These determine how much structural rearrangement an MT system must do.',
    order: 3,
  },
  nominalSystem: {
    id: 'nominalSystem',
    icon: '📦',
    title: 'Nouns & Pronouns',
    intro: 'How nouns behave — gender, number, case, articles, and classifiers. Mismatches in these systems are a major source of MT errors (e.g., inserting "the" in a language that has no articles).',
    order: 4,
  },
  verbalSystem: {
    id: 'verbalSystem',
    icon: '⚡',
    title: 'Verbs & Tense-Aspect',
    intro: 'How verbs encode time, evidence, mood, and agreement. Some languages require you to say HOW you know something (evidentiality) or mark politeness on every verb.',
    order: 5,
  },
  semantics: {
    id: 'semantics',
    icon: '🎨',
    title: 'Meaning & Concepts',
    intro: 'How the language carves up meaning — color terms, body-part terminology, and conceptual boundaries. These reveal deep differences in how speakers categorize the world.',
    order: 6,
  },
  endangerment: {
    id: 'endangerment',
    icon: '🛡️',
    title: 'Language Vitality',
    intro: 'The health and transmission status of this language — how many speakers remain, whether children are learning it, and in what domains it\'s still used.',
    order: 7,
  },
  culturalContext: {
    id: 'culturalContext',
    icon: '🌍',
    title: 'Cultural & Ethnographic Context',
    intro: 'Anthropological data about the speech community from the D-PLACE database — social organization, subsistence, kinship, and settlement patterns. This contextualizes the language within its cultural ecosystem.',
    order: 8,
  },
  metadata: {
    id: 'metadata',
    icon: '📋',
    title: 'Database Metadata',
    intro: 'Technical metadata about how this language is classified and documented in linguistic databases.',
    order: 9,
  },
};


// ============================================================================
// FEATURE CLASSIFICATION — maps property names to categories
// ============================================================================

/**
 * Classify a feature into a semantic category.
 *
 * Uses a priority chain: explicit map → source-based → pattern-matching → fallback.
 *
 * @param {string} property — the feature property name
 * @param {string} source — the source database
 * @returns {string} category ID from CATEGORIES
 */
export function categorizeFeature(property, source) {
  // 1. Source-based overrides — some sources are entirely one category
  if (source === 'elcat') return 'endangerment';
  if (source?.startsWith('dplace')) return 'culturalContext';
  if (source === 'lapsyd' || source === 'segbo') return 'soundSystem';

  // 2. Metadata features — these aren't linguistic features per se
  const metaProps = ['Category', 'Classification', 'Level', 'Subclassification',
    'Most Extensive Description', 'Most Extensive Description over time',
    'featuresCoverage', 'featuresDocumented', 'Adjusted frequencies'];
  if (metaProps.includes(property)) return 'metadata';

  // 3. Pattern matching on the property name
  const p = property.toLowerCase();

  // Sound System
  if (p.includes('consonant') || p.includes('vowel') || p.includes('tone') ||
      p.includes('stress') || p.includes('syllable') || p.includes('nasal') ||
      p.includes('uvular') || p.includes('glottalized') || p.includes('lateral') ||
      p.includes('velar') || p.includes('rhythm') || p.includes('phonem') ||
      p.includes('rounded') || p.includes('click') || p.includes('plosive') ||
      p.includes('voicing') || p.includes('fricative') || p.includes('tonal') ||
      p.includes('laminal') || p.includes('apical') || p.includes('suprasegmental') ||
      p.includes('prominence')) {
    return 'soundSystem';
  }

  // Word Structure (Morphology)
  if (p.includes('prefix') || p.includes('suffix') || p.includes('reduplicat') ||
      p.includes('inflect') || p.includes('fusion') || p.includes('exponence') ||
      p.includes('affix') || p.includes('morpholog') || p.includes('synthesis') ||
      p.includes('locus') || p.includes('suppletion') || p.includes('clitic') ||
      p.includes('formative') || p.includes('incorporat') || p.includes('compound') ||
      p.includes('flexiv') || p.includes('conjugation')) {
    return 'wordStructure';
  }

  // Sentence Structure (Syntax)
  if (p.includes('order') || p.includes('negat') || p.includes('passive') ||
      p.includes('causativ') || p.includes('applicativ') || p.includes('relative clause') ||
      p.includes('question') || p.includes('polar') || p.includes('complement') ||
      p.includes('subordinat') || p.includes('conjunction') || p.includes('compar') ||
      p.includes('purpose') || p.includes('reason') || p.includes('alignment') ||
      p.includes('ergativity') || p.includes('copula') || p.includes('predica') ||
      p.includes('reciprocal') || p.includes('intensifier') || p.includes('reflexiv') ||
      p.includes('antipassive') || p.includes('ditransit') || p.includes('serial verb') ||
      p.includes('clause chain') || p.includes('tail-head') || p.includes('light-verb') ||
      p.includes('verb-adjunct') || p.includes('adposition') ||
      p.includes('positionv') || p.includes('vfinal') || p.includes('vinitial') ||
      p.includes('vmedial')) {
    return 'sentenceStructure';
  }

  // Nouns & Pronouns
  if (p.includes('gender') || p.includes('number') || p.includes('article') ||
      p.includes('classifier') || p.includes('case') || p.includes('plural') ||
      p.includes('pronoun') || p.includes('demonstrat') || p.includes('possessi') ||
      p.includes('inclusive') || p.includes('politeness') || p.includes('noun') ||
      p.includes('nominal') || p.includes('syncretism') || p.includes('clusivity') ||
      p.includes('alienab') || p.includes('minimal-augmented') || p.includes('person') ||
      p.includes('nphasa') || p.includes('nphas') || p.includes('npstruct') ||
      p.includes('marking strategies') || p.includes('1st and 2nd') ||
      p.includes('person categories')) {
    return 'nominalSystem';
  }

  // Verbs & Tense-Aspect
  if (p.includes('tense') || p.includes('aspect') || p.includes('mood') ||
      p.includes('evidential') || p.includes('person marking') || p.includes('imperative') ||
      p.includes('prohibit') || p.includes('optative') || p.includes('perfect') ||
      p.includes('future') || p.includes('past') || p.includes('verbal') ||
      p.includes('modal') || p.includes('hortative') || p.includes('agreement') ||
      p.includes('tam ') || p.includes('existential') || p.includes('desiderative') ||
      p.includes('quotative') || p.includes('verb stem')) {
    return 'verbalSystem';
  }

  // Meaning & Concepts (semantics)
  if (p.includes('colour') || p.includes('color') || p.includes('green and blue') ||
      p.includes('red and yellow') || p.includes('finger') || p.includes('hand') ||
      p.includes('arm') || p.includes('tea') || p.includes('counting') ||
      p.includes('numeral base')) {
    return 'semantics';
  }

  // Endangerment
  if (p.includes('endangerment') || p.includes('vitality') || p.includes('speaker') ||
      p.includes('transmission') || p.includes('domain')) {
    return 'endangerment';
  }

  // Head/dependent marking from AUTOTYP → sentence structure
  if (p.startsWith('has') && (p.includes('headmarking') || p.includes('dependentmarking'))) {
    return 'sentenceStructure';
  }

  // Default
  return 'metadata';
}


// ============================================================================
// AUTO-EXPLANATIONS
//
// ARCHITECTURE: The SSOT for concept explanations is linguisticGlossary.js.
// This function checks the glossary FIRST for a real, sourced explanation.
// It falls back to structural pattern-matching ONLY for things the glossary
// cannot cover statically:
//   - "Order of X and Y" patterns (infinite combos, must be generated)
//   - "Number of X" patterns (same)
//   - Individual phoneme entries (LAPSyD/SEGBO — thousands of combos)
//   - D-PLACE cultural features (generic description only)
//   - NTS survey questions (self-describing)
// ============================================================================

import { lookupConcept } from './linguisticGlossary';

/**
 * Generate a plain-English explanation for a feature.
 *
 * DELEGATION ORDER:
 *   1. Check linguisticGlossary.js (SSOT) — returns sourced, educational content
 *   2. Structural pattern-matching — for dynamic patterns the glossary can't hold
 *   3. null — the UI should show a minimal fallback
 *
 * @param {string} property — the feature property name
 * @param {string} source — the data source
 * @returns {{ description: string, mtRelevance?: string, sources?: string[] }|null}
 */
export function autoExplainFeature(property, source) {
  // ── 1. SSOT LOOKUP — check the linguistic glossary first ─────────
  const glossaryEntry = lookupConcept(property);
  if (glossaryEntry) {
    return {
      description: glossaryEntry.explain,
      mtRelevance: glossaryEntry.mtChallenge,
      example: glossaryEntry.example,
      sources: glossaryEntry.sources,
      related: glossaryEntry.related,
    };
  }

  // ── 2. DYNAMIC PATTERNS — things that can't live in a static glossary ─

  // WALS "Order of X and Y" features (infinite combinations)
  const orderMatch = property.match(/^Order of (.+) and (.+)$/);
  if (orderMatch) {
    const [, a, b] = orderMatch;
    return {
      description: `Whether ${a.toLowerCase()} typically comes before or after ${b.toLowerCase()} in this language. Different languages arrange these elements in different orders.`,
      mtRelevance: `Word order differences require the MT system to correctly rearrange ${a.toLowerCase()} and ${b.toLowerCase()} when translating.`,
      sources: ['https://wals.info/'],
    };
  }

  // WALS "Number of X" features
  const numberMatch = property.match(/^Number of (.+)$/);
  if (numberMatch) {
    return {
      description: `How many distinct ${numberMatch[1].toLowerCase()} this language has. More categories means more distinctions the language makes.`,
      mtRelevance: `Languages with more ${numberMatch[1].toLowerCase()} require the MT model to make finer-grained distinctions.`,
      sources: ['https://wals.info/'],
    };
  }

  // WALS "Position of X" features
  const posMatch = property.match(/^Position of (.+)$/);
  if (posMatch) {
    return {
      description: `Where ${posMatch[1].toLowerCase()} are placed relative to other elements in this language.`,
      mtRelevance: `Positional differences must be correctly handled during translation to produce grammatical output.`,
      sources: ['https://wals.info/'],
    };
  }

  // NTS question-format features (self-describing)
  if (property.startsWith('Are there ') || property.startsWith('Is there ')) {
    return {
      description: `${property} This is a typological survey question from the Nichols Typological Survey (NTS), documenting whether this construction type exists in this language.`,
      sources: ['https://en.wikipedia.org/wiki/Johanna_Nichols'],
    };
  }
  if (property.startsWith('Are ') || property.startsWith('Is ') ||
      property.startsWith('Can ') || property.startsWith('Do ') ||
      property.startsWith('What ')) {
    return {
      description: `${property} (Survey question from the Nichols Typological Survey documenting this language's grammatical properties.)`,
      sources: ['https://en.wikipedia.org/wiki/Johanna_Nichols'],
    };
  }

  // AUTOTYP Has* boolean features — try glossary first for the concept,
  // then fall back to a generic template
  const hasMatch = property.match(/^Has(Any)?(.+?)(?:For(?:Nouns|Verbs|SAndA))?$/);
  if (hasMatch) {
    const featureName = hasMatch[2]
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase();
    return {
      description: `Whether this language has ${featureName}. From the AUTOTYP typological database (Bickel & Nichols, University of Zurich).`,
      sources: ['https://www.autotyp.uzh.ch/'],
    };
  }

  // LAPSyD / SEGBO phoneme inventory entries (thousands of individual phonemes)
  if (source === 'lapsyd' || source === 'segbo') {
    const phonemeChar = property.split('_')[0];
    const dbName = source === 'lapsyd'
      ? 'Lyon-Albuquerque Phonological Systems Database (LAPSyD)'
      : 'Segment Borrowing Database (SEGBO)';
    return {
      description: `Phoneme /${phonemeChar}/ is present in this language's sound inventory.`,
      sources: [
        source === 'lapsyd'
          ? 'https://lapsyd.huma-num.fr/'
          : 'https://segbo.net/',
      ],
    };
  }

  // D-PLACE cultural features
  if (source?.startsWith('dplace')) {
    return {
      description: 'Ethnographic observation from the D-PLACE database, which compiles cultural, environmental, and linguistic data about human societies worldwide.',
      sources: ['https://d-place.org/'],
    };
  }

  // ELCAT endangerment features
  if (source === 'elcat') {
    return {
      description: 'Assessment from the Catalogue of Endangered Languages (ELCat), which evaluates the vitality and endangerment status of the world\'s languages.',
      sources: ['https://endangeredlanguages.com/'],
    };
  }

  // Grambank boolean features
  if (source?.startsWith('grambank')) {
    const gbMatch = property.match(/^has(.+)$/);
    if (gbMatch) {
      const featureName = gbMatch[1]
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase();
      return {
        description: `Whether this language has ${featureName}, according to the Grambank grammatical features database (Skirgård et al. 2023).`,
        sources: ['https://grambank.clld.org/'],
      };
    }
  }

  return null;
}


// ============================================================================
// SIGNIFICANCE SCORING — which features are most interesting for THIS language?
// ============================================================================

/**
 * Score how "interesting" or notable a feature is for display prominence.
 *
 * Higher scores = more interesting. Used to sort features within categories
 * so the most notable ones appear first.
 *
 * @param {object} feature — the feature object { property, value, source, valueType }
 * @returns {number} significance score (0-100)
 */
export function scoreSignificance(feature) {
  let score = 50; // baseline

  // Features from curated typological databases are more interesting
  if (feature.source === 'wals') score += 20;
  if (feature.source?.startsWith('grambank')) score += 15;
  if (feature.source === 'autotyp') score += 10;

  // NTS survey questions are interesting — they describe actual constructions
  if (feature.source === 'nts') score += 10;

  // Metadata is least interesting
  if (['Category', 'Classification', 'Level', 'Subclassification',
       'featuresCoverage', 'featuresDocumented'].includes(feature.property)) {
    score -= 40;
  }

  // Individual phoneme inventories (LAPSyD) are low-interest individually
  if (feature.source === 'lapsyd' || feature.source === 'segbo') score -= 20;

  // Boolean "true" features are more interesting than "false" ones
  // (a language HAVING something is more notable than NOT having it)
  if (feature.value === 'true' || feature.value === '1') score += 5;
  if (feature.value === 'false' || feature.value === '0') score -= 5;

  return Math.max(0, Math.min(100, score));
}


// ============================================================================
// INFORMATIVENESS RANKING — what should a human see FIRST on a card?
//
// scoreSignificance (above) ranks by database prestige, which surfaces odd
// lexical features first (a creole's "'Body hair' and 'feather'" led its card).
// This ranker instead answers "what is genuinely notable about THIS language?":
//
//   1. Headline dimensions everyone recognizes — word order, morphological
//      type, alignment, case, gender/noun class, tone, evidentiality,
//      classifiers, articles — lead, because they ORIENT the reader.
//   2. Typologically MARKED / rare values (verb-initial order, polysynthesis,
//      ejectives, clusivity, obviation…) beat common ones, because they are
//      what make a language distinctive.
//   3. Lexical/semantic trivia (body-part words, kinship terms) and coverage
//      statistics sink to the bottom.
//
// It reads the feature's human NAME (from the tc-features explainer, when
// available) and its VALUE label, so it works uniformly across WALS, Grambank,
// and APiCS without per-source special-casing.
// ============================================================================

// Dimension tiers, checked in order (first match wins). Each entry is
// [regex on the feature name/property, base score]. Finer-grained than a flat
// "prestige" so the PRIMARY headline facts (dominant word order, morphological
// type, tone, alignment, case, gender) outrank secondary orderings and — well
// below them — correlational and lexical parameters.
const DIMENSION_TIERS = [
  // ── The orienting headline facts ──
  [/\border of subject,? (and )?object,? and verb\b|\bdominant order of|\bword order\b/i, 100],
  [/\b(polysynth|inflectional synthesis|morphological type|index of synthesis|fusion of|exponence of|prefixing vs\.? suffix|locus of marking|isolating|agglutinat)\b/i, 97],
  [/\b(alignment|ergativ|accusativ|absolutive|split-s|active-stative|tripartite)\b/i, 95],
  [/\btone\b|\btonal\b/i, 94],
  [/\b(grammatical )?(gender|noun class)\b/i, 92],
  [/\bcase\b|case marking|case system|number of cases\b/i, 91],
  [/\bevidential/i, 90],
  [/\b(numeral )?classifier/i, 86],
  [/\b(definite|indefinite) article\b/i, 84],
  [/\b(inclusive[/ -]?exclusive|clusivity)\b/i, 83],
  // ── Secondary word-order pairs & other primary grammar (still notable) ──
  [/\border of (object|adjective|adposition|genitive|relative|numeral|demonstrat|adverbial|noun|degree)/i, 78],
  [/\b(negat|question|polar|interrogat|tense|aspect|mood\b|modal|imperative|voice\b|passive|causativ|applicativ|relative clause|adposition|preposition|postposition|possess|demonstrat|plural|number marking|reduplicat|reflexiv|reciprocal|comparison of|coordinat|subordinat|serial verb|nominaliz|valency|person marking)\b/i, 70],
  // ── Correlational "harmony" parameters — derived, less headline ──
  [/\brelationship between the order|\bconsistency\b|\bharmon/i, 62],
  // ── Phonology detail: inventory sizes & specific segments ──
  [/\b(consonant|vowel|syllable|stress|nasal|fricative|plosive|uvular|ejectiv|click|glottal|phonem|prosod|rhythm|diphthong|labializ|aspirat)\b/i, 52],
  // ── Lexical / semantic trivia: real, but rarely what leads ──
  [/\b(colou?r|body hair|feather|\bhand\b|\barm\b|finger|toe|tears|nail|kin(ship)?|\btea\b|word for|identity and differentiation|meaning of|numeral base)\b/i, 26],
];

// Coverage statistics & bookkeeping — never lead.
const COVERAGE_RE = /\b(documented|coverage|ratio|number of features|features? (documented|coverage)|most extensive description|adjusted frequenc)\b/i;

// A descriptive ABSENCE that is genuinely informative (free word order, etc.)
// — kept out of the plain-absence penalty below.
const INFORMATIVE_ABSENCE = /\b(no dominant order|free word order|flexible|neither|no basis for|both\b)/i;
// A plain "the language lacks X" value — real, but less notable than having it.
const PLAIN_ABSENCE = /^(no\b|none|absent|not\b|without|lacks|nil|zero\b|non-)/i;

// Value strings that signal a typologically MARKED / rare trait — added on top
// of the dimension base (only for POSITIVE values), so the unusual instance of
// a dimension leads its peers.
// NB: stems (ergativ, ejectiv…) intentionally have NO trailing \b so they match
// the inflected value strings ("Ergative", "ejective").
const MARKED_VALUE_PATTERNS = [
  [/\b(osv|ovs|vos|vso|verb[- ]?initial|object[- ]?initial|verb[- ]?first)\b/i, 24], // rare word orders
  [/\bpolysynthetic/i, 26],
  [/\b(purely )?isolating/i, 12],
  [/\b(ergativ|active[- ]?inactive|active[- ]?stative|tripartite|split[- ]?s)/i, 18],
  [/\b(ejectiv|clicks?\b|implosiv|pharyngeal|labiovelar|preaspirat)/i, 14],
  [/\b(complex tone|three|four|five|six|multiple)[ -](?:level )?tone/i, 18],
  [/\bevidential/i, 14],
  [/\binclusive/i, 12], // clusivity-present values all read "inclusive/exclusive…"; avoids matching the adverb "exclusively"
  [/\b(obviativ|obviation|fourth person)/i, 18],
  [/\b(trial|paucal|quadral|dual)\b/i, 12],
  [/\b(more than (five|5)|exceptionally|unusually)\b/i, 8],
];

/**
 * Score a feature by how genuinely NOTABLE it is for this language — the value
 * that should sort it toward the top of "Notable Features". Headline dimensions
 * lead; typologically marked/present values beat common/absent ones; lexical
 * trivia and coverage stats sink.
 *
 * @param {object} feature — { property, value, source }
 * @param {object|null} explainer — the tc-features explainer (has .name), if joined
 * @returns {number} informativeness score (higher = show first)
 */
export function scoreInformativeness(feature, explainer) {
  const name = String(explainer?.name || feature?.property || '');
  const prop = String(feature?.property || '');
  const hay = `${name} ${prop}`;
  const value = String(feature?.value ?? '').trim();

  if (COVERAGE_RE.test(hay)) return 4;

  let score = 45; // default: an ordinary, un-recognized typological trait
  for (const [re, base] of DIMENSION_TIERS) {
    if (re.test(hay)) { score = base; break; }
  }

  const isAbsence = PLAIN_ABSENCE.test(value) && !INFORMATIVE_ABSENCE.test(value);
  if (isAbsence) {
    // A language LACKING a feature is a fact, but less notable than having it —
    // sink it below the positive members of its own dimension.
    score -= 16;
  } else {
    // Markedness bonus applies only to present/positive values.
    for (const [re, bonus] of MARKED_VALUE_PATTERNS) {
      if (re.test(value)) { score += bonus; break; }
    }
  }

  // Gentle source tie-breaker: the hand-curated atlases read a touch cleaner
  // than raw contact-language lexical parameters at equal dimension weight.
  if (feature?.source === 'wals' || feature?.source?.startsWith('grambank') ||
      feature?.source === 'champollion-derived') score += 2;

  return score;
}
