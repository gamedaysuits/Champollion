#!/usr/bin/env node

/**
 * build-explainers.mjs
 * ────────────────────────────────────────────────────────────────
 * Builds cli/shared/explainers/tc-features.json — the typological
 * feature explainer register that lets the card UI render human
 * labels instead of raw dataset codes.
 *
 * WHY THIS EXISTS:
 *   Facts ingested from CLDF StructureDatasets historically stored
 *   bare categorical codes (WALS 84A value "6" instead of
 *   "No dominant order") because the legacy-CSV ingest path never
 *   loaded codes.csv. Until the database is re-ingested (see the
 *   RE-INGEST NOTE in ingest-cldf.mjs), the display layer joins the
 *   code → label mapping through this file. Even after re-ingest,
 *   this file remains the canonical place for:
 *     - plain-English feature names and "what this tells you" text
 *     - per-value plain-language meanings
 *     - MT-relevance one-liners
 *     - real citations (WALS chapter authors, Grambank release, APiCS)
 *
 * SOURCES (all local CLDF CSVs — nothing is invented at build time):
 *   cli/data/wals/parameters.csv + codes.csv + chapters.csv + areas.csv
 *   cli/data/grambank/parameters.csv + codes.csv
 *   cli/data/apics/parameters.csv + codes.csv
 *
 * The hand-written `question` / `mt_relevance` / value `plain`
 * sentences live in the CURATED_* maps below. Where no curated text
 * exists, the builder falls back to the dataset's own parameter/code
 * Description text (per policy: never invent meanings).
 *
 * OUTPUT STRUCTURE:
 *   {
 *     _meta: { generated, counts, sources },
 *     features: {
 *       "wals-84A":        { id, source, property, name, question,
 *                            values: { "6": { label, plain } },
 *                            mt_relevance, citation },
 *       "grambank-GB020":  { ... },
 *       "apics-1":         { ... },
 *       "derived-wordOrderDominant": { ... }   // composite card fields
 *     },
 *     propertyIndex: {
 *       // join key used by the card UI: "<fact source>|<property string>"
 *       "wals|Order of Object, Oblique, and Verb": "wals-84A",
 *       "grambank-1.0.3|hasDefiniteArticle": "grambank-GB020",
 *       // card-level composite keys use the "card|" prefix
 *       "card|wordOrderDominant": "derived-wordOrderDominant"
 *     }
 *   }
 *
 * Usage:
 *   node scripts/build-explainers.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '..');
const DATA = path.join(CLI_ROOT, 'data');
const OUT_DIR = path.join(CLI_ROOT, 'shared', 'explainers');
const OUT_FILE = path.join(OUT_DIR, 'tc-features.json');

// ─── Curated explainer prose (tracked, reviewable editorial layer) ──
// Plain-English `question` + feature-specific `mt_relevance` for the WALS
// features not covered by the inline CURATED_WALS map (148 of them) and for
// every APiCS feature (336). Distilled from the WALS/APiCS chapter meaning and
// value labels — the tooltip content the reader actually sees. These override
// the mechanical fallbacks below. Regenerate via scripts/explainer-content/.
const CURATED_CONTENT_DIR = path.join(__dirname, 'explainer-content');
function loadCuratedContent(name) {
  const p = path.join(CURATED_CONTENT_DIR, name);
  if (!fs.existsSync(p)) {
    console.warn(`  ⚠️  curated content missing: ${p}`);
    return {};
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}
const WALS_CURATED_EXT = loadCuratedContent('wals-curated.json'); // { "3A": {question, mt_relevance} }
const APICS_CURATED = loadCuratedContent('apics-curated.json');   // { "1": {question, mt_relevance} }

// ─── Tiny CSV reader (quoted fields, embedded commas/newlines) ──

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function readCSVObjects(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️  missing: ${filePath}`);
    return [];
  }
  const rows = parseCSV(fs.readFileSync(filePath, 'utf-8'));
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i] ?? ''; });
    return o;
  });
}

// ─── Curated prose: WALS area-level MT relevance ────────────────
// One sentence per WALS area, used when no feature-specific override
// exists. Kept deliberately neutral and short.

const WALS_AREA_MT = {
  'Phonology': 'Mainly affects speech and transliteration; for text MT it signals how names and loanwords may be reshaped.',
  'Morphology': 'Richer morphology means many word forms per dictionary word, which increases data sparsity for MT systems.',
  'Nominal Categories': 'Categories marked on nouns and pronouns often have no one-to-one match across languages, so MT must supply or drop information.',
  'Nominal Syntax': 'Differences in how noun phrases are built lead to reordering and agreement errors in MT output.',
  'Verbal Categories': 'Verb marking for tense, aspect, mood and similar rarely lines up across languages, so MT must infer categories the source never states.',
  'Word Order': 'Word-order differences between source and target require long-distance reordering, a classic source of MT errors.',
  'Simple Clauses': 'Clause-level grammar (alignment, negation, questions) shapes how whole sentences must be restructured in translation.',
  'Complex Sentences': 'How clauses combine determines whether MT can keep sentence structure or must split and rejoin clauses.',
  'Lexicon': 'When one language uses one word where another uses several, MT makes word-choice errors that fluency alone cannot catch.',
  'Sign Languages': 'Relevant to signed-language data; text MT pipelines do not model these features.',
  'Other': 'A general typological trait whose effect on machine translation is indirect.',
};

// ─── Curated prose: feature-specific overrides ──────────────────
// Keyed by WALS parameter ID. `q` = "what this tells you" sentence,
// `mt` = MT-relevance sentence. Only features that commonly surface
// on cards or have outsized MT impact get bespoke text; the rest use
// the mechanical fallbacks below.

const CURATED_WALS = {
  '1A':  { q: 'How many distinct consonant sounds the language uses.',
           mt: 'Large or unusual consonant inventories complicate transliteration of names and loanwords.' },
  '2A':  { q: 'How many basic vowel qualities the language distinguishes.',
           mt: 'Vowel-poor or vowel-rich systems reshape borrowed words, affecting named-entity handling.' },
  '13A': { q: 'Whether the language uses pitch (tone) to distinguish word meanings.',
           mt: 'Tone is usually invisible in romanized text, so toneless input collapses distinct words into one spelling.' },
  '20A': { q: 'How tightly the language fuses grammatical markers onto words.',
           mt: 'Highly fused (or highly isolating) word structure changes how much information each token carries for the MT model.' },
  '22A': { q: 'How many grammatical categories a single verb form can pack in.',
           mt: 'Verbs that encode a whole clause (polysynthesis) explode the vocabulary and defeat word-by-word translation.' },
  '26A': { q: 'Whether grammatical marking mostly attaches before or after the word stem.',
           mt: 'Prefix- vs suffix-heavy morphology determines where subword tokenizers should split words.' },
  '30A': { q: 'How many grammatical genders or noun classes the language has.',
           mt: 'Gender systems force MT to choose agreement forms the source language may not specify.' },
  '31A': { q: 'Whether grammatical gender is assigned by sex, or by other criteria.',
           mt: 'Sex-based gender forces MT to guess the gender of people the source leaves unspecified — a common source of bias errors.' },
  '33A': { q: 'How the language marks that a noun is plural.',
           mt: 'Languages without obligatory plural marking make MT guess number from context.' },
  '37A': { q: 'Whether the language has a word like "the" for definite nouns.',
           mt: 'Translating into article languages forces a definiteness choice the source never made.' },
  '38A': { q: 'Whether the language has a word like "a/an" for indefinite nouns.',
           mt: 'Indefinite articles must be inserted or dropped wholesale when translating between article and article-less languages.' },
  '41A': { q: 'How the language distinguishes "this" and "that" by distance.',
           mt: 'Demonstrative systems with more (or fewer) distance distinctions than the target force approximation.' },
  '45A': { q: 'Whether pronouns change to show politeness (like French tu/vous).',
           mt: 'Politeness distinctions require MT to pick a formality register the source text may not reveal.' },
  '49A': { q: 'How many grammatical cases nouns can take.',
           mt: 'Large case systems multiply word forms and demand correct case selection in generation.' },
  '51A': { q: 'Whether case is marked by suffixes, prefixes, or separate words.',
           mt: 'Case affixes interact with tokenization: suffix stacking creates rare word forms MT models handle poorly.' },
  '55A': { q: 'Whether counting requires a classifier word (like "three head of cattle" for everything).',
           mt: 'Classifier languages need the right classifier per noun, which MT must select without an equivalent cue in the source.' },
  '57A': { q: 'Whether possessive marking sits on the owner or the thing owned.',
           mt: 'Possession marked on the possessed noun (head-marking) reverses the structure MT expects from European languages.' },
  '65A': { q: 'Whether verbs grammatically mark perfective vs imperfective aspect.',
           mt: 'Aspect choices (e.g. Slavic verb pairs) must be inferred when the source language does not mark them.' },
  '66A': { q: 'Whether the language marks past tense on verbs, and how many degrees of remoteness.',
           mt: 'Languages with remoteness distinctions (recent vs distant past) need temporal context the source rarely gives.' },
  '67A': { q: 'Whether the language marks future time grammatically.',
           mt: 'Inflectional futures must be chosen or dropped when the source expresses futurity lexically.' },
  '69A': { q: 'Where tense and aspect markers sit relative to the verb stem.',
           mt: 'Affix position shapes subword segmentation and the locality of grammatical cues.' },
  '70A': { q: 'How the language forms commands (imperatives).',
           mt: 'Dedicated imperative morphology must be selected correctly for instructions and UI text.' },
  '77A': { q: 'Whether speakers must grammatically mark how they know what they say (evidentiality).',
           mt: 'Evidential systems force MT to state an information source (seen, heard, inferred) that the source text never specifies.' },
  '78A': { q: 'How evidentiality is expressed — by affixes, particles, or tense forms.',
           mt: 'Evidential affixes are obligatory in some languages; omitting them produces ungrammatical or misleading output.' },
  '81A': { q: 'The dominant order of subject, object and verb in a plain sentence.',
           mt: 'Basic word order is the single biggest driver of reordering between language pairs (e.g. SOV ↔ SVO).' },
  '82A': { q: 'Whether the subject typically comes before or after the verb.',
           mt: 'Subject–verb order differences cause systematic reordering in every sentence.' },
  '83A': { q: 'Whether the object typically comes before or after the verb.',
           mt: 'OV ↔ VO mismatch forces verb movement across the whole clause, where MT errors concentrate.' },
  '84A': { q: 'How the object and other phrases (like "with a key") are ordered around the verb.',
           mt: 'Languages without a dominant order give MT weaker positional cues for argument roles.' },
  '85A': { q: 'Whether the language uses prepositions (before the noun) or postpositions (after it).',
           mt: 'Adposition direction flips the bracketing of every spatial and temporal phrase.' },
  '86A': { q: 'Whether the possessor ("the farmer\'s") comes before or after the noun ("duck").',
           mt: 'Genitive order interacts with case marking and produces nested reordering inside noun phrases.' },
  '87A': { q: 'Whether adjectives come before or after the noun they describe.',
           mt: 'Adjective–noun order errors are among the most visible fluency failures in MT output.' },
  '88A': { q: 'Whether words like "this/that" come before or after the noun.',
           mt: 'Demonstrative order is a short-range reordering pattern MT usually learns, but it fails in low-data settings.' },
  '89A': { q: 'Whether numerals come before or after the noun.',
           mt: 'Numeral–noun order affects dates, prices and quantities — high-stakes content in practical translation.' },
  '90A': { q: 'Whether relative clauses ("the man who left") come before or after the noun.',
           mt: 'Prenominal relative clauses (as in Japanese or Turkish) require inverting long stretches of text.' },
  '92A': { q: 'Where the question particle sits in yes/no questions.',
           mt: 'Question particles must be inserted at the right clause edge or questions read as statements.' },
  '93A': { q: 'Whether question words like "who/what" move to the front or stay in place.',
           mt: 'Wh-in-situ languages (e.g. Chinese) need question words relocated when translating to fronting languages.' },
  '97A': { q: 'How verb–object order relates to other word-order traits in this language.',
           mt: 'Harmonic word-order profiles are easier for MT; mixed profiles produce inconsistent reordering.' },
  '112A': { q: 'How the language expresses negation ("not").',
           mt: 'Negation markers that attach as affixes or split in two (like French ne…pas) are frequent MT failure points — and negation errors invert meaning.' },
  '116A': { q: 'How yes/no questions are marked (particle, intonation, word order…).',
           mt: 'If questionhood is marked only by intonation, written MT input gives no cue at all.' },
  '129A': { q: 'Whether "hand" and "arm" are the same word or different words.',
           mt: 'A classic lexical-split example: one source word maps to two target words and MT must pick by context.' },
  '136A': { q: 'Whether the language has distinct words for "m" and "n" sounds — an areal lexical trait (M-T pronouns).',
           mt: 'Mostly of historical interest; little direct effect on machine translation.' },
  '138A': { q: 'What the word for "tea" reveals about trade routes (te vs cha).',
           mt: 'Loanword pathways predict how the language adapts international vocabulary.' },
  '143A': { q: 'Where the negation marker sits relative to subject, object and verb.',
           mt: 'Misplaced negation is a meaning-inverting error class, so target-language negation order matters.' },
  '144A': { q: 'The position of negative words in SVO languages.',
           mt: 'Negative-word placement must be restructured, not copied, between word-order types.' },
};

// Mechanical question fallback from the feature name.
function walsQuestionFallback(name) {
  const order = name.match(/^Order of (.+)$/i);
  if (order) {
    return `Which order ${order[1].replace(/ and /g, ' and ').toLowerCase()} typically take in this language.`;
  }
  const position = name.match(/^(?:The )?Position of (.+)$/i);
  if (position) {
    return `Where ${position[1].toLowerCase()} sit relative to the words around them.`;
  }
  return `How this language is classified for "${name}" in WALS.`;
}

// ─── Curated prose: Grambank features used by the pipeline ──────
// Grambank parameter names are already questions; we add MT lines for
// the features the enrichment pipeline (enrich-grambank-v2.mjs) maps
// onto card fields.

const CURATED_GRAMBANK_MT = {
  GB020: 'Definite-article mismatches force MT to add or drop "the"-type words on every noun phrase.',
  GB021: 'Indefinite-article mismatches force MT to add or drop "a/an"-type words throughout.',
  GB028: 'Inclusive/exclusive "we" cannot be expressed in English, so MT loses or must guess this distinction.',
  GB030: 'Gendered third-person pronouns require MT to infer referent gender that the source may not state.',
  GB044: 'Without obligatory plural marking, MT must infer number from context.',
  GB051: 'Sex-based gender assignment drives agreement choices and is a known source of biased MT output.',
  GB053: 'Animacy-based classes mean noun agreement depends on meaning, not form — hard for MT to learn from small data.',
  GB057: 'Numeral classifiers must be chosen per noun; the wrong classifier is immediately visible to native speakers.',
  GB070: 'Core-argument case on nouns lets word order float free, weakening the positional cues MT relies on.',
  GB083: 'A language with no dedicated past marker leaves tense to context, so a translator must infer from discourse what the source never states.',
  GB084: 'Present-tense marking interacts with aspect: rendering it as a plain English present often asserts a habituality the source did not.',
  GB071: 'Pronoun case errors (I/me-type) are highly salient grammatical mistakes in generated text.',
  GB130: 'Subject–verb order in intransitive clauses shapes basic clause structure that MT must reproduce.',
  GB131: 'A verb-initial unmarked order (as in Welsh or Tagalog-type clauses) inverts the structure most MT training data shows.',
  GB132: 'A verb-medial unmarked order (SVO-type clauses) sets the main reordering pattern for this language pair.',
  GB133: 'A verb-final unmarked order (SOV-type clauses) requires long-distance reordering relative to English.',
  GB322: 'Direct-evidential marking states "I saw it" grammatically — information the source text usually lacks.',
  GB323: 'Indirect-evidential (hearsay/inference) marking must be added when translating into the language, with no source cue.',
  GB415: 'Classifier systems require noun-specific function words that have no counterpart in non-classifier languages.',
};

const GRAMBANK_CITATION = {
  authors: 'Skirgård, Hedvig, Hannah J. Haynie, Damián E. Blasi, Hedvig Skirgård et al. (Grambank Consortium)',
  title: 'Grambank v1.0.3',
  source_url: 'https://grambank.clld.org',
};

// Derived grambank-1.0.3 DB properties that are COMPOSITES of several
// GB features (built by enrich-grambank-v2.mjs), or bookkeeping fields.
const GRAMBANK_DERIVED = {
  wordOrder: {
    name: 'Attested word order (derived)',
    question: 'The verb–object order attested as pragmatically unmarked, derived from Grambank word-order features (GB131 verb-initial / GB132 verb-medial / GB133 verb-final, with GB130 disambiguating). Grambank records attested unmarked orders, not dominance — dominant order comes from WALS 81A.',
    mt: 'Basic word order is the single biggest driver of reordering between language pairs.',
    values: {
      'OV': { label: 'Object–Verb', plain: 'Objects come before the verb, as in Japanese or Turkish.' },
      'VO': { label: 'Verb–Object', plain: 'The verb comes before its object, as in English or Spanish.' },
      'flexible': { label: 'Flexible', plain: 'More than one unmarked order is attested; word order varies with discourse.' },
    },
  },
  hasGender: {
    name: 'Has grammatical gender (derived)',
    question: 'Whether the language has any gender or noun-class system, combining Grambank gender features (GB051/GB053/GB030).',
    mt: 'Gender systems force MT to choose agreement forms the source language may not specify.',
  },
  hasSexBasedGender: {
    name: 'Sex-based gender (GB051)',
    question: 'Whether sex (male/female) is a factor in gender/noun-class assignment.',
    mt: CURATED_GRAMBANK_MT.GB051,
  },
  hasGenderAnimacy: {
    name: 'Animacy-based gender (GB053)',
    question: 'Whether animacy (alive vs not) is a factor in gender/noun-class assignment.',
    mt: CURATED_GRAMBANK_MT.GB053,
  },
  hasGenderInPronouns: {
    name: 'Gender in pronouns (GB030)',
    question: 'Whether third-person pronouns distinguish gender (like he/she).',
    mt: CURATED_GRAMBANK_MT.GB030,
  },
  hasCase: {
    name: 'Has case morphology (derived)',
    question: 'Whether nouns or pronouns take grammatical case endings, combining GB070 and GB071.',
    mt: 'Case marking lets word order float free, weakening the positional cues MT relies on.',
  },
  hasCoreCase: {
    name: 'Core-argument case (GB070)',
    question: 'Whether full nouns take case marking for core grammatical roles.',
    mt: CURATED_GRAMBANK_MT.GB070,
  },
  hasObliqueCase: {
    name: 'Oblique case (GB071)',
    question: 'Whether pronouns take case marking for core grammatical roles.',
    mt: CURATED_GRAMBANK_MT.GB071,
  },
  marksPastTense: {
    name: 'Marks past tense (GB083)',
    question: 'Whether the grammar has a dedicated marker for past time reference.',
    mt: CURATED_GRAMBANK_MT.GB083,
  },
  marksPresentTense: {
    name: 'Marks present tense (GB084)',
    question: 'Whether the grammar has a dedicated marker for present time reference.',
    mt: CURATED_GRAMBANK_MT.GB084,
  },
  hasEvidentiality: {
    name: 'Has evidentiality (derived)',
    question: 'Whether the grammar marks information source (seen/heard/inferred), combining GB322 and GB323.',
    mt: 'Evidential marking states how the speaker knows something — information the source text usually lacks.',
  },
  hasDefiniteArticle: { gb: 'GB020' },
  hasIndefiniteArticle: { gb: 'GB021' },
  hasProductivePlural: { gb: 'GB044' },
  hasInclusiveExclusive: { gb: 'GB028' },
  hasNumeralClassifiers: { gb: 'GB057' },
  featuresDocumented: {
    name: 'Grambank features documented',
    question: 'How many of Grambank’s 195 grammatical features have a recorded value for this language.',
    mt: 'A coverage statistic: higher numbers mean the typological profile (and the MT guidance built on it) rests on more evidence.',
    skipBooleanValues: true,
  },
  featuresCoverage: {
    name: 'Grambank coverage ratio',
    question: 'The share of Grambank features with a recorded value for this language (0–1).',
    mt: 'A coverage statistic, not a property of the language itself.',
    skipBooleanValues: true,
  },
};

const BOOLEAN_VALUES = {
  'true':  { label: 'Yes', plain: 'The language has this feature.' },
  'false': { label: 'No', plain: 'The language does not have this feature.' },
};

// ─── Curated prose: composite card fields (typologicalProfile) ──
// These keys appear on shipped cards in `typologicalProfile` and are
// assembled by the card build pipeline from the cited datasets.

const CARD_COMPOSITES = {
  wordOrderDominant: {
    name: 'Dominant word order',
    question: 'The dominant order of subject, object and verb in a plain statement, per WALS feature 81A (or an equivalent dominance source such as APiCS).',
    mt: 'Basic word order is the single biggest driver of reordering between language pairs.',
    dataset: 'WALS 81A — Order of Subject, Object and Verb',
    url: 'https://wals.info/feature/81A',
  },
  morphologicalSynthesis: {
    name: 'Morphological synthesis',
    question: 'How much grammatical information a single word carries: analytic (little to none), synthetic (several categories per word), or polysynthetic (whole-sentence words). Champollion-derived from the WALS inflectional-synthesis value and cited polysynthesis descriptions already on the card; absent when the signals are missing or disagree.',
    mt: 'High synthesis multiplies word forms and starves MT of repeated tokens — the languages that reward morphological (FST) validation and synthesis-aware training.',
    dataset: 'WALS 22A — Inflectional Synthesis of the Verb (+ WALS 26A, cited card prose)',
    url: 'https://wals.info/feature/22A',
  },
  hasGenderSystem: {
    name: 'Grammatical gender system',
    question: 'Whether nouns divide into grammatical genders or classes that other words must agree with.',
    mt: 'Gender systems force MT to choose agreement forms the source language may not specify.',
    dataset: 'Grambank gender features (GB051/GB053/GB030)',
    url: 'https://grambank.clld.org/parameters/GB051',
  },
  hasCaseMorphology: {
    name: 'Case morphology',
    question: 'Whether nouns or pronouns change form to show their grammatical role.',
    mt: 'Case marking lets word order float free, weakening positional cues MT relies on.',
    dataset: 'Grambank case features (GB070/GB071)',
    url: 'https://grambank.clld.org/parameters/GB070',
  },
  hasEvidentiality: {
    name: 'Evidentiality',
    question: 'Whether the grammar requires marking how the speaker knows what they say.',
    mt: 'Evidential marking must be generated without any cue in most source languages.',
    dataset: 'Grambank evidentiality features (GB322/GB323)',
    url: 'https://grambank.clld.org/parameters/GB322',
  },
  hasToneSystem: {
    name: 'Tone system',
    question: 'Whether pitch distinguishes word meanings.',
    mt: 'Tone is usually invisible in romanized text, collapsing distinct words into one spelling.',
    dataset: 'PHOIBLE phonological inventories',
    url: 'https://phoible.org',
  },
  hasDefiniteArticle: {
    name: 'Definite article',
    question: 'Whether the language has a word like "the".',
    mt: CURATED_GRAMBANK_MT.GB020,
    dataset: 'Grambank GB020',
    url: 'https://grambank.clld.org/parameters/GB020',
  },
  hasIndefiniteArticle: {
    name: 'Indefinite article',
    question: 'Whether the language has a word like "a/an".',
    mt: CURATED_GRAMBANK_MT.GB021,
    dataset: 'Grambank GB021',
    url: 'https://grambank.clld.org/parameters/GB021',
  },
  obligatoryNumberMarking: {
    name: 'Obligatory plural marking',
    question: 'Whether plurality must always be marked on nouns.',
    mt: CURATED_GRAMBANK_MT.GB044,
    dataset: 'Grambank GB044',
    url: 'https://grambank.clld.org/parameters/GB044',
  },
  hasNounClassifiers: {
    name: 'Noun classifiers',
    question: 'Whether nouns combine with classifier words that sort them by type.',
    mt: CURATED_GRAMBANK_MT.GB415,
    dataset: 'Grambank GB415',
    url: 'https://grambank.clld.org/parameters/GB415',
  },
  classifierLanguage: {
    name: 'Classifier language',
    question: 'Whether the language routinely uses classifiers when counting or referring to nouns.',
    mt: CURATED_GRAMBANK_MT.GB415,
    dataset: 'Grambank GB415 / WALS 55A',
    url: 'https://grambank.clld.org/parameters/GB415',
  },
  hasNumeralClassifiers: {
    name: 'Numeral classifiers',
    question: 'Whether counting requires a classifier word between numeral and noun.',
    mt: CURATED_GRAMBANK_MT.GB057,
    dataset: 'Grambank GB057 / WALS 55A',
    url: 'https://grambank.clld.org/parameters/GB057',
  },
  numeralClassifierType: {
    name: 'Numeral classifier type',
    question: 'Whether numeral classifiers are absent, optional, or obligatory.',
    mt: 'Obligatory classifiers must be generated correctly for every counted noun.',
    dataset: 'WALS 55A',
    url: 'https://wals.info/chapter/55',
  },
  inflectionalStrategy: {
    name: 'Inflectional strategy',
    question: 'Whether grammatical marking mostly uses prefixes, suffixes, or both equally.',
    mt: 'Prefix- vs suffix-heavy morphology determines where subword tokenizers should split words.',
    dataset: 'WALS 26A',
    url: 'https://wals.info/chapter/26',
  },
  headMarking: {
    name: 'Head marking',
    question: 'Whether grammatical relationships are marked on the head of a phrase (e.g. the verb or possessed noun).',
    mt: 'Head-marking grammar concentrates clause information on the verb, the opposite of what most MT training data shows.',
    dataset: 'WALS 23A–25A',
    url: 'https://wals.info/chapter/23',
  },
  dependentMarking: {
    name: 'Dependent marking',
    question: 'Whether grammatical relationships are marked on dependents (e.g. case on nouns).',
    mt: 'Dependent marking shifts grammatical signal onto noun endings that tokenizers may split poorly.',
    dataset: 'WALS 23A–25A',
    url: 'https://wals.info/chapter/23',
  },
  ordinalNumerals: {
    name: 'Ordinal numerals',
    question: 'How the language forms ordinals like "first, second, third".',
    mt: 'Irregular ordinal formation trips up MT on dates, rankings and headings.',
    dataset: 'WALS 53A',
    url: 'https://wals.info/chapter/53',
  },
  caseCount: {
    name: 'Number of cases',
    question: 'How many grammatical cases the language distinguishes.',
    mt: 'More cases mean more word forms per noun and more opportunities for agreement errors.',
    dataset: 'WALS 49A',
    url: 'https://wals.info/chapter/49',
  },
  genderCount: {
    name: 'Number of genders',
    question: 'How many grammatical genders or noun classes the language distinguishes.',
    mt: 'Each added gender multiplies the agreement choices MT must get right.',
    dataset: 'WALS 30A',
    url: 'https://wals.info/chapter/30',
  },
  toneComplexity: {
    name: 'Tone complexity',
    question: 'Whether the tone system is simple (two levels) or complex (more contrasts).',
    mt: 'Complex tone raises the cost of working from unmarked romanized text.',
    dataset: 'WALS 13A',
    url: 'https://wals.info/chapter/13',
  },
  sailsFeatures: {
    name: 'SAILS features documented',
    question: 'How many South American typology (SAILS) features are recorded for this language.',
    mt: 'A coverage statistic: more documented features mean better-grounded MT guidance.',
    dataset: 'SAILS',
    url: 'https://sails.clld.org',
  },
  uratypFeatures: {
    name: 'UraTyp features documented',
    question: 'How many Uralic typology (UraTyp) features are recorded for this language.',
    mt: 'A coverage statistic: more documented features mean better-grounded MT guidance.',
    dataset: 'UraTyp',
    url: 'https://uralic.clld.org',
  },
  ewaveFeatureCount: {
    name: 'eWAVE features documented',
    question: 'How many World Atlas of Varieties of English features are recorded for this variety.',
    mt: 'A coverage statistic for English varieties.',
    dataset: 'eWAVE',
    url: 'https://ewave-atlas.org',
  },
  ewaveVarietyType: {
    name: 'eWAVE variety type',
    question: 'How eWAVE classifies this English variety (e.g. creole, L2, traditional dialect).',
    mt: 'Variety type signals how far the variety departs from standard-English MT training data.',
    dataset: 'eWAVE',
    url: 'https://ewave-atlas.org',
  },
  valencyPatterns: {
    name: 'Valency patterns',
    question: 'How verbs encode who-does-what-to-whom (their argument patterns).',
    mt: 'Valency mismatches make literal translations assign the wrong roles to participants.',
    dataset: 'ValPaL',
    url: 'https://valpal.info',
  },
  featuresDocumented: {
    name: 'Typological features documented',
    question: 'How many grammatical features have a recorded value for this language.',
    mt: 'A coverage statistic: higher numbers mean the typological profile rests on more evidence.',
    dataset: 'Grambank',
    url: 'https://grambank.clld.org',
  },
  featuresCoverage: {
    name: 'Typological coverage ratio',
    question: 'The share of surveyed grammatical features with a recorded value (0–1).',
    mt: 'A coverage statistic, not a property of the language itself.',
    dataset: 'Grambank',
    url: 'https://grambank.clld.org',
  },
};

// typologicalProfile keys that are metadata, not features.
const CARD_META_KEYS = new Set(['source']);

// ─── Build: WALS ─────────────────────────────────────────────────

function buildWals(features, propertyIndex) {
  const dir = path.join(DATA, 'wals');
  const params = readCSVObjects(path.join(dir, 'parameters.csv'));
  const codes = readCSVObjects(path.join(dir, 'codes.csv'));
  const chapters = readCSVObjects(path.join(dir, 'chapters.csv'));
  const areas = readCSVObjects(path.join(dir, 'areas.csv'));

  const areaById = new Map(areas.map(a => [a.ID, a.Name]));
  const chapterById = new Map(chapters.map(c => [c.ID, c]));

  // Group codes by parameter
  const codesByParam = new Map();
  for (const c of codes) {
    if (!codesByParam.has(c.Parameter_ID)) codesByParam.set(c.Parameter_ID, []);
    codesByParam.get(c.Parameter_ID).push(c);
  }

  let count = 0;
  for (const p of params) {
    const id = `wals-${p.ID}`;
    const chapter = chapterById.get(p.Chapter_ID);
    const areaName = chapter ? (areaById.get(chapter.Area_ID) || 'Other') : 'Other';
    const curated = CURATED_WALS[p.ID];
    const ext = WALS_CURATED_EXT[p.ID]; // curated question/mt for the non-inline features

    const values = {};
    for (const c of codesByParam.get(p.ID) || []) {
      // DB facts store the bare Number ("6"); key values by it.
      values[c.Number] = {
        label: c.Name,
        // Per policy: when we have no bespoke sentence, use the
        // dataset's own Description text (it is the value's meaning).
        plain: c.Description && c.Description !== c.Name ? c.Description : c.Name,
      };
    }

    features[id] = {
      id,
      source: 'wals-2020',
      property: p.Name,           // exact DB/card property string
      name: p.Name,
      area: areaName,
      question: curated?.q || ext?.question || walsQuestionFallback(p.Name),
      values,
      mt_relevance: curated?.mt || ext?.mt_relevance || WALS_AREA_MT[areaName] || WALS_AREA_MT.Other,
      citation: {
        authors: chapter?.Contributor || 'Dryer, Matthew S. & Haspelmath, Martin (eds.)',
        title: `${chapter?.Name || p.Name} (WALS Online chapter ${chapter?.Number || p.Chapter_ID})`,
        source_url: `https://wals.info/chapter/${chapter?.Number || p.Chapter_ID}`,
      },
    };
    // Facts use source 'wals'; cards may also reference 'wals-2009'/'wals-2020'.
    propertyIndex[`wals|${p.Name}`] = id;
    count++;
  }
  return count;
}

// ─── Build: Grambank ─────────────────────────────────────────────

function buildGrambank(features, propertyIndex) {
  const dir = path.join(DATA, 'grambank');
  const params = readCSVObjects(path.join(dir, 'parameters.csv'));
  const codes = readCSVObjects(path.join(dir, 'codes.csv'));

  const paramById = new Map(params.map(p => [p.ID, p]));
  const codesByParam = new Map();
  for (const c of codes) {
    if (!codesByParam.has(c.Parameter_ID)) codesByParam.set(c.Parameter_ID, []);
    codesByParam.get(c.Parameter_ID).push(c);
  }

  let count = 0;

  function addGB(gbId, propertyName) {
    const p = paramById.get(gbId);
    if (!p) return null;
    const id = `grambank-${gbId}`;
    if (!features[id]) {
      const values = {};
      for (const c of codesByParam.get(gbId) || []) {
        values[c.Name] = {
          label: c.Description || c.Name,
          plain: c.Description || c.Name,
        };
      }
      // Card/DB values are booleans, so alias true/false too.
      if (values['1'] || values['0']) {
        values['true'] = values['1'] || BOOLEAN_VALUES.true;
        values['false'] = values['0'] || BOOLEAN_VALUES.false;
      }
      features[id] = {
        id,
        source: 'grambank-1.0.3',
        property: propertyName || gbId,
        name: p.Name, // Grambank names are already questions
        question: p.Name,
        values,
        mt_relevance: CURATED_GRAMBANK_MT[gbId]
          || 'A grammatical trait that shapes how much restructuring translation into or out of this language requires.',
        citation: {
          authors: GRAMBANK_CITATION.authors,
          title: `${p.Name} (Grambank ${gbId})`,
          source_url: `https://grambank.clld.org/parameters/${gbId}`,
        },
      };
      count++;
    }
    if (propertyName) propertyIndex[`grambank-1.0.3|${propertyName}`] = id;
    return id;
  }

  // 1:1 derived properties → their GB feature
  for (const [prop, spec] of Object.entries(GRAMBANK_DERIVED)) {
    if (spec.gb) {
      addGB(spec.gb, prop);
    } else {
      const id = `derived-grambank-${prop}`;
      features[id] = {
        id,
        source: 'grambank-1.0.3',
        property: prop,
        name: spec.name,
        question: spec.question,
        values: spec.values || (spec.skipBooleanValues ? {} : BOOLEAN_VALUES),
        mt_relevance: spec.mt,
        citation: {
          authors: GRAMBANK_CITATION.authors,
          title: `${spec.name} — derived from ${GRAMBANK_CITATION.title}`,
          source_url: GRAMBANK_CITATION.source_url,
        },
      };
      propertyIndex[`grambank-1.0.3|${prop}`] = id;
      count++;
    }
    // These derived features are stamped source='champollion-derived' on the
    // cards (property e.g. 'hasGender', 'wordOrder', 'hasCase'). Alias the
    // propertyIndex to that source AND the 'card|' prefix so the display join
    // resolves — without this the 10 most common typology features (gender,
    // case, word order, clusivity, plural) are orphaned and silently dropped
    // from ~2,300 cards each. (audit 2026-07-20 finding #9)
    const resolvedId = propertyIndex[`grambank-1.0.3|${prop}`];
    if (resolvedId) {
      propertyIndex[`champollion-derived|${prop}`] = resolvedId;
      if (!propertyIndex[`card|${prop}`]) propertyIndex[`card|${prop}`] = resolvedId;
    }
  }

  // GB415 appears in card _fieldSources (classifierLanguage provenance).
  addGB('GB415', null);

  return count;
}

// ─── Build: APiCS ────────────────────────────────────────────────

function buildApics(features, propertyIndex) {
  const dir = path.join(DATA, 'apics');
  const params = readCSVObjects(path.join(dir, 'parameters.csv'));
  const codes = readCSVObjects(path.join(dir, 'codes.csv'));

  const codesByParam = new Map();
  for (const c of codes) {
    if (!codesByParam.has(c.Parameter_ID)) codesByParam.set(c.Parameter_ID, []);
    codesByParam.get(c.Parameter_ID).push(c);
  }

  let count = 0;
  for (const p of params) {
    const id = `apics-${p.ID}`;
    const values = {};
    for (const c of codesByParam.get(p.ID) || []) {
      values[c.Number] = {
        label: c.Name,
        plain: c.Description && c.Description !== c.Name ? c.Description : c.Name,
      };
    }
    // Curated plain-English question + feature-specific MT relevance (distilled
    // from the APiCS chapter prose). Falls back to the first sentence of the raw
    // description only if a curated entry is somehow absent.
    const cur = APICS_CURATED[p.ID];
    const desc = (p.Description || '').replace(/<[^>]+>/g, '').split(/(?<=\.)\s/)[0].trim();
    features[id] = {
      id,
      source: 'apics-2013',
      property: p.Name,
      name: p.Name,
      area: p.Area || undefined,
      question: cur?.question || (desc && desc.length <= 300
        ? desc
        : `How this contact language is classified for "${p.Name}" in APiCS.`),
      values,
      mt_relevance: cur?.mt_relevance
        || 'Creole/pidgin structural traits often diverge from the lexifier language, so MT systems trained on the lexifier mistranslate them.',
      citation: {
        authors: 'Michaelis, Susanne Maria, Philippe Maurer, Martin Haspelmath & Magnus Huber (eds.)',
        title: `${p.Name} (APiCS Online)`,
        source_url: `https://apics-online.info/parameters/${p.ID}`,
      },
    };
    propertyIndex[`apics|${p.Name}`] = id;
    count++;
  }
  return count;
}

// ─── Build: card-level composites ────────────────────────────────

function buildCardComposites(features, propertyIndex) {
  let count = 0;
  for (const [key, spec] of Object.entries(CARD_COMPOSITES)) {
    const id = `derived-${key}`;
    if (!features[id]) {
      features[id] = {
        id,
        source: 'champollion-derived',
        property: key,
        name: spec.name,
        question: spec.question,
        values: {},
        mt_relevance: spec.mt,
        citation: {
          authors: 'Champollion enrichment pipeline (derived)',
          title: `${spec.name} — derived from ${spec.dataset}`,
          source_url: spec.url,
        },
      };
      count++;
    }
    propertyIndex[`card|${key}`] = id;
  }
  // typologicalProfile.source is metadata, mapped to nothing on purpose.
  return count;
}

// ─── Main ────────────────────────────────────────────────────────

function main() {
  const features = {};
  const propertyIndex = {};

  console.log('Building tc-features.json …');
  const walsCount = buildWals(features, propertyIndex);
  console.log(`  WALS features:      ${walsCount}`);
  const gbCount = buildGrambank(features, propertyIndex);
  console.log(`  Grambank features:  ${gbCount}`);
  const apicsCount = buildApics(features, propertyIndex);
  console.log(`  APiCS features:     ${apicsCount}`);
  const compCount = buildCardComposites(features, propertyIndex);
  console.log(`  Card composites:    ${compCount}`);

  const out = {
    _meta: {
      generated: new Date().toISOString(),
      generator: 'cli/scripts/build-explainers.mjs',
      description:
        'Typological feature explainers: per-feature plain-English names, ' +
        'value code → label maps, MT-relevance notes and citations. ' +
        'Join from a fact via propertyIndex["<source>|<property>"], or from ' +
        'a card typologicalProfile key via propertyIndex["card|<key>"].',
      counts: {
        features: Object.keys(features).length,
        indexEntries: Object.keys(propertyIndex).length,
        wals: walsCount,
        grambank: gbCount,
        apics: apicsCount,
        cardComposites: compCount,
      },
      datasets: {
        'wals-2020': 'https://wals.info (CC BY 4.0) — Dryer & Haspelmath (eds.) 2013',
        'grambank-1.0.3': 'https://grambank.clld.org (CC BY 4.0) — Skirgård et al. 2023',
        'apics-2013': 'https://apics-online.info (CC BY 4.0) — Michaelis et al. (eds.) 2013',
      },
      notes:
        'AUTOTYP and other StructureDatasets already store human-readable ' +
        'value labels in the facts DB, so they are rendered as-is and not ' +
        'duplicated here.',
    },
    features,
    propertyIndex,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const json = JSON.stringify(out, null, 2) + '\n';
  fs.writeFileSync(OUT_FILE, json);
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  console.log(`  Wrote ${OUT_FILE} (${kb} KB, ${Object.keys(features).length} features)`);

  // Also write the served copy the website fetches from /data/explainers/, so
  // the canonical build output and the deployed asset never drift (there was no
  // sync step for tc-features.json — the two copies were kept in step by hand).
  const WEB_FILE = path.join(CLI_ROOT, 'website', 'data', 'explainers', 'tc-features.json');
  if (fs.existsSync(path.dirname(WEB_FILE))) {
    fs.writeFileSync(WEB_FILE, json);
    console.log(`  Synced  ${WEB_FILE}`);
  } else {
    console.warn(`  ⚠️  website data dir absent — skipped served copy (${WEB_FILE})`);
  }
}

main();
