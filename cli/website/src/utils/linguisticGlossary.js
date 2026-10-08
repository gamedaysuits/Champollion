/**
 * linguisticGlossary.js — SINGLE SOURCE OF TRUTH for linguistic concept explanations
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ALL explanations, examples, and educational content live HERE.        ║
 * ║  No other file should contain duplicate concept descriptions.          ║
 * ║                                                                        ║
 * ║  Other files reference this module:                                    ║
 * ║    • typologyGlossary.js   → re-exports getFeatureInfo/DisplayName    ║
 * ║    • featureCategorizer.js → calls lookupConcept() instead of inline  ║
 * ║    • DetailPanel.js        → uses lookupConcept() for expanded pills  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * CITATION POLICY:
 * Every entry that makes factual claims includes a `sources` array linking to
 * verifiable references. Wikipedia is cited as the primary cross-reference
 * for accessibility. Where specific claims come from academic sources (WALS,
 * Grambank, Haspelmath, Dryer, etc.), those are noted.
 *
 * ENTRY SCHEMA:
 *   {
 *     name:         string   – human-readable display name
 *     explain:      string   – plain-English explanation (smart non-linguist level)
 *     example:      string   – concrete example with language attribution
 *     mtChallenge:  string   – why this matters for machine translation
 *     sources:      string[] – verifiable citation URLs
 *     grambankId:   string|null – Grambank feature ID (e.g. 'GB020')
 *     walsId:       string|null – WALS chapter ID (e.g. '81A')
 *     category:     string   – semantic category for grouping
 *     related:      string[] – keys of related concepts for cross-linking
 *   }
 */


// ============================================================================
// THE GLOSSARY
//
// Organized alphabetically by key. Keys are camelCase concept identifiers
// that match property names from Grambank (e.g., "hasCase"), WALS
// (e.g., "caseSyncretism"), AUTOTYP (e.g., "polyexponence"), and general
// linguistic terms.
//
// SOURCES CITED:
//   WALS   = Dryer, Matthew S. & Haspelmath, Martin (eds.) 2013.
//            The World Atlas of Language Structures Online. Leipzig: MPI-EVA.
//            https://wals.info/
//   Grambank = Skirgård et al. 2023. "Grambank reveals the importance of
//            genealogical constraints on linguistic diversity and highlights
//            the impact of language loss." Science Advances 9(16).
//            https://grambank.clld.org/
//   AUTOTYP = Bickel, Balthasar & Nichols, Johanna. 2002–. The AUTOTYP
//            typological database. https://www.autotyp.uzh.ch/
// ============================================================================

const GLOSSARY = {

  /* ==================================================================== */
  /*  WORD ORDER                                                          */
  /* ==================================================================== */

  wordOrder: {
    name: 'Basic Word Order',
    explain:
      'The default order of subject (S), verb (V), and object (O) in a main ' +
      'declarative sentence. English is SVO ("The cat chased the mouse"), ' +
      'Japanese is SOV ("The cat the-mouse chased"), and Irish is VSO ' +
      '("Chased the-cat the-mouse").',
    example:
      'Japanese is SOV: 猫が ネズミを 追いかけた (neko-ga nezumi-wo oikaketa, ' +
      'cat-SUBJ mouse-OBJ chased). English is SVO: "The cat chased the mouse." ' +
      '(Dryer 2013, WALS ch. 81)',
    mtChallenge:
      'Word-order mismatches are the single biggest source of garbled MT output, ' +
      'because the model must learn to completely rearrange sentence structure.',
    sources: [
      'https://en.wikipedia.org/wiki/Word_order',
      'https://wals.info/chapter/81',
    ],
    grambankId: 'GB020',
    walsId: '81A',
    category: 'word-order',
    related: ['case', 'alignment'],
  },

  hasPrepositions: {
    name: 'Prepositions',
    explain:
      'Uses words placed BEFORE the noun to show location, time, or direction — ' +
      'like "in the box" or "at noon" in English. The alternative is postpositions, ' +
      'where the same word comes after the noun.',
    example:
      'English: "in the house". French: "dans la maison". Both place the ' +
      'relationship word before the noun. (Dryer 2013, WALS ch. 85)',
    mtChallenge:
      'Translating between a prepositional and a postpositional language requires ' +
      'flipping the position of these markers relative to the noun.',
    sources: [
      'https://en.wikipedia.org/wiki/Preposition_and_postposition',
      'https://wals.info/chapter/85',
    ],
    grambankId: 'GB074',
    walsId: '85A',
    category: 'word-order',
    related: ['hasPostpositions', 'wordOrder'],
  },

  hasPostpositions: {
    name: 'Postpositions',
    explain:
      'Uses words placed AFTER the noun to show location, time, or direction — ' +
      'the mirror image of English prepositions. Japanese, Korean, and Turkish ' +
      'all use postpositions.',
    example:
      'Japanese: 学校に (gakkō ni) — literally "school TO". ' +
      'Turkish: ev-de — literally "house-AT". (Dryer 2013, WALS ch. 85)',
    mtChallenge:
      'Postposition-to-preposition conversion requires correctly reordering ' +
      'small but critical function words.',
    sources: [
      'https://en.wikipedia.org/wiki/Preposition_and_postposition',
      'https://wals.info/chapter/85',
    ],
    grambankId: 'GB075',
    walsId: '85A',
    category: 'word-order',
    related: ['hasPrepositions', 'wordOrder'],
  },

  relativeClauseOrder: {
    name: 'Relative Clause Order',
    explain:
      'Whether a clause that describes a noun (like "who ran" in "the man who ran") ' +
      'comes BEFORE or AFTER that noun. In English the clause follows the noun ' +
      '(post-nominal), but in Japanese and Chinese it precedes it (pre-nominal).',
    example:
      'English (post-nominal): "the book [that I read]". ' +
      'Japanese (pre-nominal): "[私が読んだ] 本" (I-read book). ' +
      '(Dryer 2013, WALS ch. 90)',
    mtChallenge:
      'Pre-nominal relative clauses force the MT system to buffer an entire clause ' +
      'before generating the head noun — error-prone for long sentences.',
    sources: [
      'https://en.wikipedia.org/wiki/Relative_clause',
      'https://wals.info/chapter/90',
    ],
    grambankId: null,
    walsId: '90A',
    category: 'word-order',
    related: ['hasRelativizer', 'wordOrder'],
  },

  adjectiveOrder: {
    name: 'Adjective–Noun Order',
    explain:
      'Whether adjectives come before the noun ("big house" in English) or after ' +
      'it ("maison grande" in French). This small difference affects every noun ' +
      'phrase in a sentence.',
    example:
      'English: "red car". Spanish: "carro rojo" (car red). ' +
      '(Dryer 2013, WALS ch. 87)',
    mtChallenge:
      'Adjective placement errors are among the most common fluency issues in MT ' +
      'output, even for high-resource language pairs.',
    sources: [
      'https://en.wikipedia.org/wiki/Adjective#Order',
      'https://wals.info/chapter/87',
    ],
    grambankId: null,
    walsId: '87A',
    category: 'word-order',
    related: ['wordOrder'],
  },

  numeralOrder: {
    name: 'Numeral–Noun Order',
    explain:
      'Whether numbers come before ("three cats") or after the noun ("cats three"). ' +
      'Languages that place numbers after the noun often also require a classifier ' +
      'word between them.',
    example:
      'English: "five books". Thai: หนังสือห้าเล่ม (nangsue ha lem — ' +
      'books five CLF). (Dryer 2013, WALS ch. 89)',
    mtChallenge:
      'Misplacing numerals or dropping required classifiers leads to ungrammatical ' +
      'or confusing quantity expressions.',
    sources: [
      'https://en.wikipedia.org/wiki/Numeral_(linguistics)',
      'https://wals.info/chapter/89',
    ],
    grambankId: null,
    walsId: '89A',
    category: 'word-order',
    related: ['hasClassifiers', 'wordOrder'],
  },

  /* ==================================================================== */
  /*  NOMINAL FEATURES (Nouns, Pronouns, Case)                            */
  /* ==================================================================== */

  hasDefiniteArticle: {
    name: 'Definite Article',
    explain:
      'Has a word like "the" to mark known/specific nouns. Many languages — ' +
      'including Japanese, Chinese, Russian, and most Bantu languages — lack ' +
      'definite articles entirely, using context instead.',
    example:
      'English: "the dog". German: "der Hund". Japanese has no article: ' +
      '犬 (inu) means "a dog" or "the dog" depending on context. ' +
      '(Dryer 2013, WALS ch. 37)',
    mtChallenge:
      'Translating from article-less languages forces the MT model to guess "the" ' +
      'vs "a" from context — a frequent and persistent error type.',
    sources: [
      'https://en.wikipedia.org/wiki/Article_(grammar)',
      'https://wals.info/chapter/37',
    ],
    grambankId: 'GB036',
    walsId: '37A',
    category: 'nominal',
    related: ['hasIndefiniteArticle', 'definiteness'],
  },

  hasIndefiniteArticle: {
    name: 'Indefinite Article',
    explain:
      'Has a word like "a/an" to mark non-specific nouns. Many languages lack ' +
      'a dedicated indefinite article and instead use the numeral "one" or leave ' +
      'the noun bare.',
    example:
      'English: "a cat". Turkish uses the numeral: "bir kedi" (one cat). ' +
      'Russian has no article at all. (Dryer 2013, WALS ch. 38)',
    mtChallenge:
      'Missing indefinite articles in the source language leave the MT system ' +
      'uncertain about definiteness.',
    sources: [
      'https://en.wikipedia.org/wiki/Article_(grammar)',
      'https://wals.info/chapter/38',
    ],
    grambankId: 'GB037',
    walsId: '38A',
    category: 'nominal',
    related: ['hasDefiniteArticle', 'definiteness'],
  },

  hasGrammaticalGender: {
    name: 'Grammatical Gender',
    explain:
      'Every noun belongs to a class — often called masculine, feminine, or neuter — ' +
      'and adjectives, articles, and sometimes verbs must agree. Assignment is ' +
      'largely arbitrary: German "Mädchen" (girl) is grammatically neuter.',
    example:
      'Spanish: "el libro" (the-MASC book) vs. "la mesa" (the-FEM table). ' +
      '(Corbett 1991; Dryer 2013, WALS ch. 30)',
    mtChallenge:
      'Translating into a gendered language requires assigning the correct gender ' +
      'to every noun and propagating agreement across the whole sentence.',
    sources: [
      'https://en.wikipedia.org/wiki/Grammatical_gender',
      'https://wals.info/chapter/30',
    ],
    grambankId: 'GB030',
    walsId: '30A',
    category: 'nominal',
    related: ['hasNounClasses', 'agreement'],
  },

  hasNounClasses: {
    name: 'Noun Classes',
    explain:
      'An expanded gender system with many categories. Instead of 2-3 genders, ' +
      'languages like Swahili have up to 18 noun classes loosely grouped by ' +
      'meaning (people, plants, abstracts, etc.).',
    example:
      'Swahili: "m-tu m-zuri" (person good, class 1) vs. "ki-tabu ki-zuri" ' +
      '(book good, class 7). (Katamba 2003; Dryer 2013, WALS ch. 112)',
    mtChallenge:
      'Noun-class agreement is notoriously difficult for MT — a single wrong prefix ' +
      'cascades errors through the entire clause.',
    sources: [
      'https://en.wikipedia.org/wiki/Noun_class',
      'https://wals.info/chapter/112',
    ],
    grambankId: 'GB031',
    walsId: '112A',
    category: 'nominal',
    related: ['hasGrammaticalGender', 'agreement', 'classifier'],
  },

  hasClusivity: {
    name: 'Clusivity (Inclusive/Exclusive "We")',
    explain:
      'Distinguishes "we including you" from "we excluding you." Many Austronesian, ' +
      'Dravidian, and indigenous American languages make this distinction; English ' +
      'and most European languages do not.',
    example:
      'Tagalog: "tayo" (we, including you) vs. "kami" (we, excluding you). ' +
      '(Cysouw 2003; Dryer 2013, WALS ch. 39)',
    mtChallenge:
      'Translating from a clusivity language into English loses information; ' +
      'the reverse requires inferring which "we" is meant from context.',
    sources: [
      'https://en.wikipedia.org/wiki/Clusivity',
      'https://wals.info/chapter/39',
    ],
    grambankId: 'GB044',
    walsId: '39A',
    category: 'nominal',
    related: ['pronoun', 'person', 'minimalAugmented'],
  },

  hasDualNumber: {
    name: 'Dual Number',
    explain:
      'A special grammatical form for exactly two of something, separate from ' +
      'singular (one) and plural (more than two). Arabic, Slovenian, and ' +
      'many Oceanic languages have dual number.',
    example:
      'Arabic: كتاب (kitāb, 1 book), كتابان (kitābān, 2 books), ' +
      'كتب (kutub, 3+ books). (Corbett 2000; Dryer 2013, WALS ch. 34)',
    mtChallenge:
      'Failing to use the dual form when required sounds glaringly wrong to ' +
      'native speakers, even if the meaning is technically clear.',
    sources: [
      'https://en.wikipedia.org/wiki/Dual_(grammatical_number)',
      'https://wals.info/chapter/34',
    ],
    grambankId: 'GB034',
    walsId: '34A',
    category: 'nominal',
    related: ['number', 'plural'],
  },

  hasCaseSystem: {
    name: 'Case System',
    explain:
      'Nouns change form to show their role in the sentence. English retains a ' +
      'tiny case system in pronouns (he/him/his); Finnish has 15 cases and ' +
      'Turkish has 6.',
    example:
      'Turkish: "ev" (house), "ev-i" (house-ACC, as object), "ev-de" ' +
      '(house-LOC, at the house), "ev-den" (house-ABL, from the house). ' +
      '(Blake 2001; Dryer 2013, WALS ch. 49)',
    mtChallenge:
      'Case-rich languages encode grammatical relationships inside the noun — ' +
      'a wrong case ending completely changes meaning.',
    sources: [
      'https://en.wikipedia.org/wiki/Grammatical_case',
      'https://wals.info/chapter/49',
    ],
    grambankId: 'GB051',
    walsId: '49A',
    category: 'nominal',
    related: ['caseSyncretism', 'alignment', 'ergativity'],
  },

  case: {
    name: 'Case',
    explain:
      'A system where nouns change form to show their role in a sentence. English ' +
      'has remnants: "I" (subject) vs "me" (object). Finnish has 15 cases — ' +
      'separate forms for location, motion, instrument, and more.',
    example:
      'Finnish: "talo" (house), "talossa" (in the house), "talosta" (from ' +
      'the house), "taloon" (into the house). (Blake 2001)',
    mtChallenge:
      'Translating into a case-rich language requires generating the correct case ' +
      'suffix based on the noun\'s grammatical role.',
    sources: [
      'https://en.wikipedia.org/wiki/Grammatical_case',
      'https://wals.info/chapter/49',
    ],
    grambankId: null,
    walsId: '49A',
    category: 'nominal',
    related: ['hasCaseSystem', 'caseSyncretism', 'alignment'],
  },

  caseSyncretism: {
    name: 'Case Syncretism',
    explain:
      'When different grammatical cases share the same physical form, creating ' +
      'ambiguity. In German, "das Buch" (the book) is identical in nominative ' +
      'and accusative — you can\'t tell from form alone whether it\'s subject or object.',
    example:
      'German: "Das Mädchen sieht den Hund" vs "Den Hund sieht das Mädchen" — ' +
      'word order disambiguates because "das" (neuter) is syncretic between ' +
      'nominative and accusative. (Baerman et al. 2005; WALS ch. 28)',
    mtChallenge:
      'Syncretic case forms create parsing ambiguity — the MT model must use word ' +
      'order, agreement, and context to determine grammatical roles.',
    sources: [
      'https://en.wikipedia.org/wiki/Syncretism_(linguistics)',
      'https://wals.info/chapter/28',
    ],
    grambankId: null,
    walsId: '28A',
    category: 'nominal',
    related: ['case', 'hasCaseSystem'],
  },

  /* ==================================================================== */
  /*  VERBAL FEATURES                                                     */
  /* ==================================================================== */

  hasEvidentiality: {
    name: 'Evidentiality',
    explain:
      'A grammatical system that REQUIRES speakers to mark HOW they know something: ' +
      'did they see it happen, hear about it, infer it, or assume? Some languages ' +
      'have 2 evidential levels; others have 5+.',
    example:
      'Turkish: "geldi" (he came — I saw it) vs. "gelmiş" (he came — ' +
      'I heard/inferred). Same event, different evidential marking. ' +
      '(Aikhenvald 2004; Dryer 2013, WALS ch. 77)',
    mtChallenge:
      'English doesn\'t grammatically mark evidentiality. Translating INTO an ' +
      'evidential language requires the model to infer the evidence source.',
    sources: [
      'https://en.wikipedia.org/wiki/Evidentiality',
      'https://wals.info/chapter/77',
    ],
    grambankId: 'GB065',
    walsId: '77A',
    category: 'verbal',
    related: ['mood', 'tense'],
  },

  hasTenseDistinction: {
    name: 'Tense Distinction',
    explain:
      'Verbs change form to indicate WHEN an action happens. Some languages have ' +
      'no tense at all (Mandarin uses time words instead), while others distinguish ' +
      'multiple pasts (recent past, remote past, yesterday, mythological time).',
    example:
      'English: "I eat" / "I ate". Mandarin: 我吃 (wǒ chī) for both, ' +
      'with context clarifying. (Comrie 1985; Dryer 2013, WALS ch. 65)',
    mtChallenge:
      'Translating from a tenseless language requires the MT model to infer ' +
      'temporal reference from context.',
    sources: [
      'https://en.wikipedia.org/wiki/Grammatical_tense',
      'https://wals.info/chapter/65',
    ],
    grambankId: 'GB066',
    walsId: '65A',
    category: 'verbal',
    related: ['hasAspectDistinction', 'mood'],
  },

  hasAspectDistinction: {
    name: 'Aspect Distinction',
    explain:
      'Verbs mark the internal structure of an event: is it completed (perfective), ' +
      'ongoing (imperfective), or habitual? Russian verbs come in perfective/' +
      'imperfective pairs for almost every action.',
    example:
      'Russian: "писал" (pisal, was writing — imperfective) vs. "написал" ' +
      '(napisal, finished writing — perfective). (Comrie 1976; WALS ch. 65)',
    mtChallenge:
      'Aspect mismatches cause subtle meaning shifts: "I read the book" (completed?) ' +
      'vs. "I was reading the book" (interrupted?).',
    sources: [
      'https://en.wikipedia.org/wiki/Grammatical_aspect',
      'https://wals.info/chapter/65',
    ],
    grambankId: 'GB068',
    walsId: '65A',
    category: 'verbal',
    related: ['hasTenseDistinction'],
  },

  hasSerialVerbs: {
    name: 'Serial Verb Constructions',
    explain:
      'Multiple verbs strung together without conjunctions ("and") or ' +
      'subordinators ("to") to describe a single event. Common in West African, ' +
      'Southeast Asian, and creole languages.',
    example:
      'Yoruba: "Ó mú ìwé wá" — literally "He take book come" (He brought ' +
      'a book). Two verbs, no conjunction. (Aikhenvald & Dixon 2006; WALS)',
    mtChallenge:
      'Serial verbs must be unpacked into separate clauses or combined into one ' +
      'verb in languages that lack this construction.',
    sources: [
      'https://en.wikipedia.org/wiki/Serial_verb_construction',
    ],
    grambankId: 'GB276',
    walsId: null,
    category: 'verbal',
    related: ['clauseChaining', 'tailHeadLinkage'],
  },

  hasPolarityDistinction: {
    name: 'Polarity Distinction on Verbs',
    explain:
      'Verbs change form to indicate positive vs. negative meaning, building ' +
      'negation directly into the verb rather than using a separate word.',
    example:
      'Turkish: "geliyorum" (I am coming) vs. "gelmiyorum" (I am not coming). ' +
      'The -mi- negation infix is inside the verb. (Dryer 2013, WALS ch. 112)',
    mtChallenge:
      'If the MT model misses a negation morpheme embedded inside a verb, it ' +
      'inverts the entire sentence meaning — a catastrophic error.',
    sources: [
      'https://en.wikipedia.org/wiki/Negation_(linguistics)',
      'https://wals.info/chapter/112',
    ],
    grambankId: 'GB070',
    walsId: '112A',
    category: 'verbal',
    related: ['negation', 'hasNegationParticle'],
  },

  hasPassiveVoice: {
    name: 'Passive Voice',
    explain:
      'A construction that promotes the object to subject: "The mouse was chased ' +
      'by the cat." Not all languages have a dedicated passive; some use other ' +
      'strategies like word order or agent-dropping.',
    example:
      'English: "The cake was eaten." Japanese: ケーキが食べられた ' +
      '(kēki-ga taberareta, cake-SUBJ eat-PASSIVE-PAST). (Siewierska 1984; WALS ch. 107)',
    mtChallenge:
      'Passive-to-active conversion is often needed for natural output; errors can ' +
      'swap who is doing what to whom.',
    sources: [
      'https://en.wikipedia.org/wiki/Passive_voice',
      'https://wals.info/chapter/107',
    ],
    grambankId: 'GB108',
    walsId: '107A',
    category: 'verbal',
    related: ['antipassive', 'applicative'],
  },

  hasCausative: {
    name: 'Causative Construction',
    explain:
      'A grammatical way to express "make someone do something." Many languages ' +
      'build this meaning into the verb with a suffix, rather than using a ' +
      'separate word like English "make."',
    example:
      'Turkish: "öl-mek" (to die) → "öl-dür-mek" (to kill / to cause to die). ' +
      'Japanese: 食べる → 食べさせる (to make eat). (Comrie 1989; WALS ch. 110)',
    mtChallenge:
      'Causative morphemes pack a two-clause meaning ("X causes Y to do Z") into ' +
      'one word, requiring accurate synthesis or decomposition.',
    sources: [
      'https://en.wikipedia.org/wiki/Causative',
      'https://wals.info/chapter/110',
    ],
    grambankId: 'GB110',
    walsId: '110A',
    category: 'verbal',
    related: ['applicative', 'passive'],
  },

  hasApplicative: {
    name: 'Applicative Construction',
    explain:
      'A verb form that promotes an oblique participant (beneficiary, instrument) ' +
      'to direct object. Common in Bantu and indigenous American languages, ' +
      'rare in European languages.',
    example:
      'Swahili: "ni-li-pik-a chakula" (I cooked food) → "ni-li-pik-i-a mama ' +
      'chakula" (I cooked food FOR Mom — Mom becomes primary object). ' +
      '(Peterson 2007; WALS ch. 109)',
    mtChallenge:
      'Applicatives change which participant is "main object," confusing MT models ' +
      'trained on European languages where this construction doesn\'t exist.',
    sources: [
      'https://en.wikipedia.org/wiki/Applicative_voice',
      'https://wals.info/chapter/109',
    ],
    grambankId: 'GB109',
    walsId: '109A',
    category: 'verbal',
    related: ['passive', 'causative'],
  },

  /* ==================================================================== */
  /*  SYNTAX                                                              */
  /* ==================================================================== */

  hasNegationParticle: {
    name: 'Negation Particle',
    explain:
      'Uses a separate word — like English "not" — to negate sentences, rather ' +
      'than building negation into the verb. Position varies: before the verb, ' +
      'after it, or surrounding it.',
    example:
      'French: "ne … pas" (two-part negation surrounding the verb). ' +
      'Mandarin: 不 (bù) before the verb. (Dryer 2013, WALS ch. 112)',
    mtChallenge:
      'Correctly placing negation particles is critical — a misplaced "not" ' +
      'reverses the intended meaning.',
    sources: [
      'https://en.wikipedia.org/wiki/Negation_(linguistics)',
      'https://wals.info/chapter/112',
    ],
    grambankId: 'GB058',
    walsId: '112A',
    category: 'syntax',
    related: ['hasPolarityDistinction', 'negation'],
  },

  hasQuestionParticle: {
    name: 'Question Particle',
    explain:
      'Uses a dedicated word or suffix to mark yes/no questions, rather than ' +
      'changing word order (as English does). Makes questions unambiguous ' +
      'regardless of intonation.',
    example:
      'Japanese: "行きますか" (ikimasu ka — "Do you go?"). ' +
      'Mandarin: "你去吗？" (nǐ qù ma). (Dryer 2013, WALS ch. 116)',
    mtChallenge:
      'Dropping a question particle turns a question into a statement; the MT ' +
      'model must reliably detect and reproduce these markers.',
    sources: [
      'https://en.wikipedia.org/wiki/Interrogative',
      'https://wals.info/chapter/116',
    ],
    grambankId: 'GB116',
    walsId: '116A',
    category: 'syntax',
    related: [],
  },

  hasRelativizer: {
    name: 'Relativizer',
    explain:
      'Has a dedicated word (like "who", "which", "that") introducing relative ' +
      'clauses. Some languages use a single all-purpose relativizer; others use ' +
      'verb forms or simple juxtaposition.',
    example:
      'English: "the person [who] came". Mandarin: "来的人" — "come-DE person" ' +
      '(the particle 的 acts as a general linker). (Dryer 2013, WALS ch. 90)',
    mtChallenge:
      'Relativizer choice affects readability; wrong choices ("the house that" vs ' +
      '"the house which") sound unnatural.',
    sources: [
      'https://en.wikipedia.org/wiki/Relative_clause',
      'https://wals.info/chapter/90',
    ],
    grambankId: null,
    walsId: '90A',
    category: 'syntax',
    related: ['relativeClauseOrder'],
  },

  hasComplementizer: {
    name: 'Complementizer',
    explain:
      'A word like "that" introducing embedded clauses ("I know [that she left]"). ' +
      'Not all languages need one; Japanese uses the quotative particle と (to) ' +
      'and Russian uses что (chto).',
    example:
      'English: "I believe [that] it works." Japanese: "うまくいくと信じている" — ' +
      'uses the quotative と instead.',
    mtChallenge:
      'Complementizer errors create ungrammatical embedded clauses, especially ' +
      'problematic in formal text.',
    sources: [
      'https://en.wikipedia.org/wiki/Complementizer',
    ],
    grambankId: null,
    walsId: null,
    category: 'syntax',
    related: [],
  },

  hasErgativity: {
    name: 'Ergative–Absolutive Alignment',
    explain:
      'The subject of "I sleep" is treated like the OBJECT of "He sees me," and ' +
      'the AGENT of "He sees me" gets special marking — the reverse of how English ' +
      'works. Found in Basque, many Australian, and some Mayan languages.',
    example:
      'Basque: "Gizon-a-k emakume-a ikusi du" = man-the-ERG woman-the-ABS seen ' +
      'has — "The man saw the woman." The man gets the ergative marker -k. ' +
      '(Dixon 1994; Dryer 2013, WALS ch. 98)',
    mtChallenge:
      'Ergative alignment reverses which participant gets default marking — MT ' +
      'models trained on nominative-accusative languages can confuse agents and patients.',
    sources: [
      'https://en.wikipedia.org/wiki/Ergative%E2%80%93absolutive_alignment',
      'https://wals.info/chapter/98',
    ],
    grambankId: 'GB054',
    walsId: '98A',
    category: 'syntax',
    related: ['alignment', 'case', 'antipassive'],
  },

  /* ==================================================================== */
  /*  MORPHOLOGY                                                          */
  /* ==================================================================== */

  hasPrefixes: {
    name: 'Prefixing',
    explain:
      'Adds meaningful units to the BEGINNING of words. Bantu languages are ' +
      'famously prefix-heavy, marking noun class, tense, subject, and object ' +
      'all before the verb root.',
    example:
      'Swahili: "a-na-soma" (he-PRESENT-read = "he is reading"). Three ' +
      'prefixes before the root "soma". (Dryer 2013, WALS ch. 26)',
    mtChallenge:
      'Prefix-heavy languages pack multiple grammatical meanings into one word; ' +
      'MT must decompose each prefix to translate them into separate words.',
    sources: [
      'https://en.wikipedia.org/wiki/Prefix',
      'https://wals.info/chapter/26',
    ],
    grambankId: 'GB024',
    walsId: '26A',
    category: 'morphology',
    related: ['hasSuffixes', 'hasInfixes'],
  },

  hasSuffixes: {
    name: 'Suffixing',
    explain:
      'Adds meaningful units to the END of words. Turkish is an extreme example: ' +
      'a single verb can carry a chain of 6+ suffixes encoding tense, aspect, ' +
      'mood, person, number, and negation.',
    example:
      'Turkish: "gel-e-me-yecek-ler-miş" = come-ABIL-NEG-FUT-PL-EVID ' +
      '("they apparently will not be able to come"). Six suffixes on one root. ' +
      '(Dryer 2013, WALS ch. 26)',
    mtChallenge:
      'Agglutinative suffix chains encode entire English clauses in one word, ' +
      'making tokenization and alignment extremely challenging.',
    sources: [
      'https://en.wikipedia.org/wiki/Suffix',
      'https://wals.info/chapter/26',
    ],
    grambankId: 'GB025',
    walsId: '26A',
    category: 'morphology',
    related: ['hasPrefixes', 'hasInfixes', 'agglutination'],
  },

  hasInfixes: {
    name: 'Infixing',
    explain:
      'Inserts meaningful units INSIDE a word root — not at the beginning or end. ' +
      'Relatively rare worldwide but common in Austronesian languages.',
    example:
      'Tagalog: "sulat" (write) → "s-um-ulat" (wrote). The infix "-um-" is ' +
      'inserted after the first consonant. (Dryer 2013, WALS ch. 26)',
    mtChallenge:
      'Infixes break up word roots, making simple string-matching morphological ' +
      'analysis fail; the MT model needs deeper morphological awareness.',
    sources: [
      'https://en.wikipedia.org/wiki/Infix',
      'https://wals.info/chapter/26',
    ],
    grambankId: 'GB026',
    walsId: '26A',
    category: 'morphology',
    related: ['hasPrefixes', 'hasSuffixes', 'endoclitics'],
  },

  hasReduplication: {
    name: 'Reduplication',
    explain:
      'Repeating all or part of a word to express grammatical changes — like ' +
      'plurality, intensity, or repetition. Can be full (whole word) or partial ' +
      '(just a syllable).',
    example:
      'Indonesian: "orang" (person) → "orang-orang" (people). ' +
      'Japanese: "hito-bito" (people, from "hito" = person). ' +
      '(Rubino 2013; Dryer 2013, WALS ch. 27)',
    mtChallenge:
      'Reduplication-based plurals have no direct equivalent in most European ' +
      'languages, requiring pattern recognition and structural mapping.',
    sources: [
      'https://en.wikipedia.org/wiki/Reduplication',
      'https://wals.info/chapter/27',
    ],
    grambankId: 'GB027',
    walsId: '27A',
    category: 'morphology',
    related: ['plural'],
  },

  hasNounIncorporation: {
    name: 'Noun Incorporation',
    explain:
      'A noun (usually the object) fuses INTO the verb to create one compound ' +
      'word. Common in polysynthetic languages. Somewhat analogous to English ' +
      'compounds like "babysit" or "breastfeed."',
    example:
      'Mohawk: "wak-nakt-ahninu-s" = I-bed-buy-HAB = "I buy beds (as a habit)." ' +
      'The noun "bed" is inside the verb. (Mithun 1984)',
    mtChallenge:
      'Incorporated nouns must be extracted and translated as separate words ' +
      'in languages lacking this feature — requires deep morphological decomposition.',
    sources: [
      'https://en.wikipedia.org/wiki/Incorporation_(linguistics)',
    ],
    grambankId: 'GB028',
    walsId: null,
    category: 'morphology',
    related: ['polysynthesis', 'headMarking'],
  },

  polyexponence: {
    name: 'Polyexponence',
    explain:
      'When a SINGLE grammatical meaning (like "plural" or "1st person") is ' +
      'simultaneously expressed in MULTIPLE places within the same word. ' +
      'The information is redundantly scattered across prefixes, suffixes, ' +
      'and/or internal changes.',
    example:
      'Georgian verbs: person is marked as BOTH a prefix AND a suffix: ' +
      '"v-xedav-t" (we see) — the v- (subject) and -t (plural) both contribute ' +
      'to marking "we." (Harris 1981; Bickel & Nichols, AUTOTYP)',
    mtChallenge:
      'Polyexponence means grammatical information is redundantly scattered ' +
      'across a word. BPE tokenizers that split words may capture some markers ' +
      'but miss others, causing inconsistent morphological analysis.',
    sources: [
      'https://en.wikipedia.org/wiki/Polyexponence',
      'https://www.autotyp.uzh.ch/',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['exponence', 'flexivity', 'fusion', 'agreement'],
  },

  exponence: {
    name: 'Exponence',
    explain:
      'The formal realization of a grammatical category. "Monoexponence" means ' +
      'one marker per meaning; "polyexponence" means multiple markers for the ' +
      'same meaning; "cumulative exponence" means one marker bundling several meanings.',
    example:
      'Latin "-ō" in "amō" (I love) is cumulative: it simultaneously marks ' +
      '1st person + singular + present + active + indicative — five ' +
      'grammatical categories in one morpheme. (Matthews 1974)',
    mtChallenge:
      'Cumulative exponence makes morphological decomposition non-trivial: one ' +
      'form maps to many meanings, and you can\'t separate them.',
    sources: [
      'https://en.wikipedia.org/wiki/Exponence',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['polyexponence', 'fusion', 'flexivity'],
  },

  flexivity: {
    name: 'Flexivity',
    explain:
      'The degree to which a language uses inflection (word-form changes) to ' +
      'encode grammatical information. Highly flexive languages like Latin pack ' +
      'enormous amounts of information into word endings; analytic languages ' +
      'like Mandarin use separate words instead.',
    example:
      'Latin: "amāvissēmus" = love + past + subjunctive + 1st person + plural — ' +
      'five grammatical features fused into one word form. (Bickel & Nichols, AUTOTYP)',
    mtChallenge:
      'Flexive languages produce thousands of word forms per verb, many rare in ' +
      'training data. MT models struggle with unseen inflected forms.',
    sources: [
      'https://en.wikipedia.org/wiki/Fusional_language',
      'https://www.autotyp.uzh.ch/',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['fusion', 'polyexponence', 'inflection'],
  },

  fusion: {
    name: 'Fusion (Fusional Morphology)',
    explain:
      'When multiple grammatical meanings are packed into a SINGLE indivisible ' +
      'morpheme. Instead of stacking separate markers (agglutination), fusional ' +
      'languages blend them together so you can\'t pull them apart.',
    example:
      'Spanish: "hablé" (I spoke) — the "-é" simultaneously encodes: past tense ' +
      '+ 1st person + singular + indicative mood. You cannot separate these. ' +
      '(Dryer 2013, WALS ch. 20)',
    mtChallenge:
      'Fused morphemes are hard for BPE tokenizers to decompose. A tokenizer ' +
      'may treat "hablé" as one opaque token without understanding the grammar inside.',
    sources: [
      'https://en.wikipedia.org/wiki/Fusional_language',
      'https://wals.info/chapter/20',
    ],
    grambankId: null,
    walsId: '20A',
    category: 'morphology',
    related: ['flexivity', 'polyexponence', 'agglutination'],
  },

  formative: {
    name: 'Formative',
    explain:
      'A grammatical element (prefix, suffix, infix, or free morpheme) that ' +
      'contributes meaning or grammatical information to a word. "Formatives" ' +
      'is the catch-all term for any meaning-bearing piece.',
    example:
      'In English "un-believ-able-ness", the formatives are: un- (negation), ' +
      'believ- (root), -able (capability), -ness (noun-forming). (Hockett 1958)',
    mtChallenge:
      'Languages with many formatives per word pack information densely, ' +
      'requiring MT models to decompose and recompose word structure.',
    sources: [
      'https://en.wikipedia.org/wiki/Morpheme',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['prefix', 'suffix', 'infix'],
  },

  enclitics: {
    name: 'Enclitics',
    explain:
      'Small grammatical particles that attach to the END of the preceding word ' +
      'but aren\'t full suffixes — they\'re phonologically bound but syntactically ' +
      'independent. English contractions are weak examples: "I\'ve" = I + \'ve.',
    example:
      'Latin: "-que" (and) — "Senatus populusque" = Senate people-and = "the Senate ' +
      'and people." The "and" attaches to the second word. (Zwicky 1977)',
    mtChallenge:
      'Clitics blur word boundaries — MT tokenizers may misparse them as part of ' +
      'the host word, leading to incorrect analysis.',
    sources: [
      'https://en.wikipedia.org/wiki/Clitic#Enclitics',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['proclitics', 'endoclitics', 'hasClitics'],
  },

  endoclitics: {
    name: 'Endoclitics',
    explain:
      'Extremely rare particles that insert INSIDE a word, between its stem and ' +
      'affixes. One of the rarest grammatical phenomena in human language — only ' +
      'attested in a handful of languages.',
    example:
      'Pashto: "wá-ye-lidum" — the clitic "-ye-" (him/her) is inserted inside ' +
      'the verb between the prefix and stem, literally splitting the word open. ' +
      '(Anderson 2005)',
    mtChallenge:
      'Endoclitics violate the assumption that words are linear edge-modified ' +
      'sequences. BPE tokenizers that split from edges fail on these.',
    sources: [
      'https://en.wikipedia.org/wiki/Clitic#Endoclitics',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['enclitics', 'proclitics', 'hasInfixes'],
  },

  proclitics: {
    name: 'Proclitics',
    explain:
      'Small grammatical particles that attach to the BEGINNING of the following ' +
      'word. They\'re phonologically bound to the next word but syntactically ' +
      'independent — like reverse enclitics.',
    example:
      'French: "j\'ai" = je + ai (I have) — the pronoun "je" is reduced and ' +
      'attached to the front of "ai." (Zwicky 1977)',
    mtChallenge:
      'Like enclitics, proclitics blur word boundaries. Tokenizers may fail to ' +
      'separate them, causing out-of-vocabulary errors.',
    sources: [
      'https://en.wikipedia.org/wiki/Clitic#Proclitics',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['enclitics', 'endoclitics', 'hasClitics'],
  },

  hasClitics: {
    name: 'Clitics',
    explain:
      'Small words that are grammatically independent but phonologically lean on ' +
      'an adjacent word — they can\'t stand alone. English contractions ("I\'m", ' +
      '"don\'t") are clitic-like. Romance languages have extensive clitic pronoun systems.',
    example:
      'Spanish: "dá-me-lo" (give-me-it). The pronouns "me" and "lo" are ' +
      'clitics attached to the verb. (Zwicky & Pullum 1983)',
    mtChallenge:
      'Clitic placement rules are complex and language-specific; errors create ' +
      'words that look malformed to native speakers.',
    sources: [
      'https://en.wikipedia.org/wiki/Clitic',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['enclitics', 'proclitics', 'endoclitics'],
  },

  agglutination: {
    name: 'Agglutinative Morphology',
    explain:
      'Words are built by snapping together discrete, clearly-bounded affixes — ' +
      'each affix adds exactly ONE meaning (tense, plural, possession, etc.). ' +
      'Unlike fusional languages, each piece is identifiable and separable.',
    example:
      'Turkish: "ev-ler-imiz-den" = house-PLURAL-our-FROM ("from our houses"). ' +
      'Four distinct morphemes, each with one job. (Comrie 1989)',
    mtChallenge:
      'Agglutinative words can be very long, causing BPE tokenizers to split ' +
      'them unpredictably. But the regularity helps — once the model learns ' +
      'the affix inventory, it can generalize.',
    sources: [
      'https://en.wikipedia.org/wiki/Agglutinative_language',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['fusional', 'analytic', 'polysynthesis'],
  },

  fusional: {
    name: 'Fusional Morphology',
    explain:
      'Multiple grammatical meanings are fused into a SINGLE affix that cannot ' +
      'be cleanly separated. A single ending might simultaneously encode person, ' +
      'number, tense, and mood.',
    example:
      'Spanish: "habl-ó" — the ending "-ó" simultaneously means 3rd person, ' +
      'singular, past tense, and indicative mood. One morpheme, four meanings. ' +
      '(Comrie 1989)',
    mtChallenge:
      'Fusional languages require the model to simultaneously predict multiple ' +
      'grammatical categories in a single morpheme — getting any one wrong ' +
      'produces an ungrammatical form.',
    sources: [
      'https://en.wikipedia.org/wiki/Fusional_language',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['agglutination', 'analytic', 'polyexponence'],
  },

  analytic: {
    name: 'Analytic (Isolating) Morphology',
    explain:
      'Words tend to be single morphemes with no inflection — grammatical ' +
      'relationships are expressed through word ORDER and separate function words, ' +
      'not affixes. The opposite of polysynthetic.',
    example:
      'Mandarin: 我 昨天 买了 三 本 书 (wǒ zuótiān mǎi-le sān běn shū) = ' +
      'I yesterday buy-PERF three CLF book. Each word is one or two morphemes. ' +
      '(Comrie 1989)',
    mtChallenge:
      'Isolating languages rely heavily on word order for meaning — ' +
      'word-order errors are more catastrophic than in languages with case marking.',
    sources: [
      'https://en.wikipedia.org/wiki/Analytic_language',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['agglutination', 'fusional', 'polysynthesis'],
  },

  polysynthesis: {
    name: 'Polysynthesis',
    explain:
      'A morphological type where ENTIRE SENTENCES can be expressed as a single ' +
      'word by incorporating nouns, adverbs, and multiple verbal affixes. The ' +
      'most morphologically complex type of language.',
    example:
      'Mohawk: "Washakotya\'tawitsherahetkvhta\'se" = "He made the thing that ' +
      'one puts on one\'s body ugly for her" — an entire sentence in one word. ' +
      '(Mithun 1999)',
    mtChallenge:
      'Polysynthetic languages are catastrophic for standard MT. BPE tokenizers ' +
      'destroy word-internal structure, and training data is vanishingly sparse.',
    sources: [
      'https://en.wikipedia.org/wiki/Polysynthetic_language',
    ],
    grambankId: null,
    walsId: null,
    category: 'morphology',
    related: ['hasNounIncorporation', 'headMarking'],
  },

  /* ==================================================================== */
  /*  PHONOLOGY                                                           */
  /* ==================================================================== */

  hasToneDistinction: {
    name: 'Tone',
    explain:
      'Pitch changes on syllables distinguish different words. About 60-70% of ' +
      'the world\'s languages are tonal. Mandarin has 4 tones; some languages ' +
      'like Cantonese have 6+.',
    example:
      'Mandarin: 妈 mā (mother) vs. 马 mǎ (horse) — same consonant and vowel, ' +
      'different tone, completely different meaning. (Yip 2002; WALS ch. 13)',
    mtChallenge:
      'Tone is invisible in most writing systems, creating homograph ambiguity ' +
      'in text-based MT. Vietnamese diacritics are one exception.',
    sources: [
      'https://en.wikipedia.org/wiki/Tone_(linguistics)',
      'https://wals.info/chapter/13',
    ],
    grambankId: 'GB079',
    walsId: '13A',
    category: 'phonology',
    related: ['stress'],
  },

  hasVowelHarmony: {
    name: 'Vowel Harmony',
    explain:
      'A phonological pattern where all vowels in a word must belong to the same ' +
      '"group" — e.g., all front vowels or all back vowels. Suffixes have ' +
      'multiple forms; the correct one is chosen to match the root.',
    example:
      'Turkish: "ev-ler" (houses, front vowel -ler) vs. "at-lar" (horses, back ' +
      'vowel -lar). Same plural suffix, different vowel. (van der Hulst 2016; WALS ch. 16)',
    mtChallenge:
      'Vowel harmony violations are immediately obvious to native speakers and ' +
      'mark output as machine-generated.',
    sources: [
      'https://en.wikipedia.org/wiki/Vowel_harmony',
      'https://wals.info/chapter/16',
    ],
    grambankId: null,
    walsId: '16A',
    category: 'phonology',
    related: [],
  },

  tonal: {
    name: 'Tone',
    explain:
      'Pitch changes on syllables distinguish different words. About 60-70% of ' +
      'the world\'s languages are tonal. Mandarin has 4 tones; some languages ' +
      'like Cantonese have 6+.',
    example:
      'Mandarin: 妈 mā (mother) vs. 马 mǎ (horse) — same consonant and vowel, ' +
      'different tone, completely different meaning. (Yip 2002; WALS ch. 13)',
    mtChallenge:
      'Tone is invisible in most writing systems, creating homograph ambiguity ' +
      'in text-based MT. Vietnamese diacritics are one exception.',
    sources: [
      'https://en.wikipedia.org/wiki/Tone_(linguistics)',
      'https://wals.info/chapter/13',
    ],
    grambankId: 'GB079',
    walsId: '13A',
    category: 'phonology',
    related: ['hasToneDistinction', 'stress'],
  },

  nasalVowels: {
    name: 'Nasal Vowels',
    explain:
      'Vowels pronounced with airflow through both the mouth AND the nose. ' +
      'French, Portuguese, Polish, Yoruba, and many other languages have ' +
      'nasal vowels as separate phonemes.',
    example:
      'French: "bon" /bɔ̃/ (good, nasal) vs. "beau" /bo/ (beautiful, oral). ' +
      'Portuguese: "pão" /pɐ̃w/ (bread). (WALS ch. 10)',
    mtChallenge:
      'Nasal vowels affect spelling conventions and diacritics — MT systems ' +
      'must handle the orthographic conventions that mark nasality.',
    sources: [
      'https://en.wikipedia.org/wiki/Nasal_vowel',
      'https://wals.info/chapter/10',
    ],
    grambankId: null,
    walsId: '10A',
    category: 'phonology',
    related: ['hasToneDistinction', 'hasVowelHarmony'],
  },

  /* ==================================================================== */
  /*  ADDITIONAL FEATURES                                                 */
  /* ==================================================================== */

  hasClassifiers: {
    name: 'Numeral Classifiers',
    explain:
      'Counting nouns requires a special word — a classifier — between the number ' +
      'and noun. The classifier categorizes the noun by shape, animacy, or type. ' +
      'English has faint echoes: "a sheet of paper," "a head of cattle."',
    example:
      'Mandarin: 三本书 (sān běn shū) = three CLF-volume book. ' +
      'Japanese: 三匹の猫 (san-biki no neko) = three CLF-animal cat. ' +
      '(Aikhenvald 2000; WALS ch. 55)',
    mtChallenge:
      'Classifier selection depends on the semantic class of each noun — choosing ' +
      '"flat-thing" for paper but "long-thing" for a pencil.',
    sources: [
      'https://en.wikipedia.org/wiki/Classifier_(linguistics)',
      'https://wals.info/chapter/55',
    ],
    grambankId: 'GB089',
    walsId: '55A',
    category: 'nominal',
    related: ['hasGrammaticalGender', 'hasNounClasses'],
  },

  hasHonorifics: {
    name: 'Grammatical Honorifics / Politeness',
    explain:
      'Grammar encodes social relationships. Japanese and Korean have elaborate ' +
      'systems where verb forms, pronouns, and even nouns change based on social ' +
      'hierarchy. Using the wrong level is a serious social error.',
    example:
      'Japanese: "食べる" (taberu, plain) → "食べます" (tabemasu, polite) → ' +
      '"召し上がる" (meshiagaru, honorific). Three verbs for "eat." ' +
      '(Shibatani 1990)',
    mtChallenge:
      'Politeness-level selection requires social context that is rarely explicit ' +
      'in source text — one of the hardest pragmatic challenges for MT.',
    sources: [
      'https://en.wikipedia.org/wiki/Honorifics_(linguistics)',
    ],
    grambankId: null,
    walsId: null,
    category: 'verbal',
    related: ['pronoun', 'person'],
  },

  agreement: {
    name: 'Agreement',
    explain:
      'When parts of a sentence must match in features like gender, number, or ' +
      'person. In French, adjectives agree with the noun: "la grande maison" ' +
      '(feminine) vs "le grand jardin" (masculine).',
    example:
      'Spanish: "Los niños altos" — article (los), noun (niños), and adjective ' +
      '(altos) all agree in masculine plural. (Corbett 2006)',
    mtChallenge:
      'Languages with rich agreement require the MT model to track grammatical ' +
      'features across long distances and generate correct agreement forms.',
    sources: [
      'https://en.wikipedia.org/wiki/Agreement_(linguistics)',
    ],
    grambankId: null,
    walsId: null,
    category: 'syntax',
    related: ['hasGrammaticalGender', 'case', 'verbAgreement'],
  },

  verbAgreement: {
    name: 'Verb Agreement',
    explain:
      'When the verb changes form to match its subject (and sometimes object) in ' +
      'person, number, and/or gender. English has remnants: "I walk" vs "she walks." ' +
      'Some languages mark BOTH subject AND object on the verb.',
    example:
      'Basque: "d-i-o-t" (I-give-it-to-him) — the verb contains markers for ALL ' +
      'three participants: giver (I), thing (it), recipient (him). (Hualde & Ortiz de Urbina 2003)',
    mtChallenge:
      'Languages with full subject+object agreement require generating verb forms ' +
      'that encode multiple participants simultaneously.',
    sources: [
      'https://en.wikipedia.org/wiki/Agreement_(linguistics)',
    ],
    grambankId: null,
    walsId: null,
    category: 'verbal',
    related: ['agreement', 'person'],
  },

  antipassive: {
    name: 'Antipassive',
    explain:
      'A construction that "demotes" the patient/object — the reverse of passive. ' +
      'While passive removes the agent ("The ball was kicked"), antipassive removes ' +
      'or demotes the patient ("He was doing kicking"). Common in ergative languages.',
    example:
      'West Greenlandic: "Angut-ip arnaq kunik-paa" (The man kissed the woman) → ' +
      '"Angut kunis-su-voq" (The man did kissing) — the woman is removed. ' +
      '(Polinsky 2017)',
    mtChallenge:
      'Languages with antipassive can omit objects that English requires. MT must ' +
      'sometimes reconstruct deleted patients from context.',
    sources: [
      'https://en.wikipedia.org/wiki/Antipassive_voice',
    ],
    grambankId: null,
    walsId: null,
    category: 'syntax',
    related: ['hasPassiveVoice', 'hasErgativity'],
  },

  headMarking: {
    name: 'Head-Marking',
    explain:
      'Grammatical relationships are marked on the HEAD (main word) of a phrase, ' +
      'not the dependent. In "I see him", a head-marking language marks WHO is ' +
      'seen on the VERB (the head), not on the pronoun.',
    example:
      'Mohawk: "Wa-hi-hnínu" (I-him-bought) — the verb "bought" contains markers ' +
      'for both buyer and purchased. No separate pronouns needed. (Nichols 1986)',
    mtChallenge:
      'Head-marking languages pack entire sentences into single verb forms. MT ' +
      'models trained on English struggle with this information density.',
    sources: [
      'https://en.wikipedia.org/wiki/Head-marking_language',
    ],
    grambankId: null,
    walsId: null,
    category: 'syntax',
    related: ['dependentMarking', 'polysynthesis'],
  },

  dependentMarking: {
    name: 'Dependent-Marking',
    explain:
      'Grammatical relationships are marked on the DEPENDENT word, not the head. ' +
      'In "John\'s book", English marks the possessor (John\'s) — the dependent — ' +
      'not the book (the head).',
    example:
      'Turkish: "adam-ın ev-i" (man-GEN house-POSS) — the dependent "man" gets ' +
      'genitive marking, and the head "house" also gets possessive marking ' +
      '(double marking). (Nichols 1986)',
    mtChallenge:
      'Translating between head-marking and dependent-marking systems requires ' +
      'moving grammatical information from one word to another.',
    sources: [
      'https://en.wikipedia.org/wiki/Dependent-marking_language',
    ],
    grambankId: null,
    walsId: null,
    category: 'syntax',
    related: ['headMarking', 'case'],
  },

  clauseChaining: {
    name: 'Clause Chaining',
    explain:
      'Sentences are linked in long chains, with only the FINAL verb fully inflected ' +
      'for tense and subject. All preceding verbs appear in reduced forms. It\'s like ' +
      'writing one enormous run-on sentence — but grammatically correct.',
    example:
      'Amele (Papua New Guinea): a single sentence can chain 10+ clauses: "Having ' +
      'gone, having arrived, having sat down, having spoken..." with only the last ' +
      'verb showing tense. (Roberts 1988)',
    mtChallenge:
      'Breaking clause chains into separate sentences for English requires ' +
      'understanding the temporal and logical relationships between events.',
    sources: [
      'https://en.wikipedia.org/wiki/Clause_chaining',
    ],
    grambankId: null,
    walsId: null,
    category: 'syntax',
    related: ['hasSerialVerbs', 'tailHeadLinkage'],
  },

  tailHeadLinkage: {
    name: 'Tail-Head Linkage',
    explain:
      'A narrative strategy where the LAST verb of one clause is REPEATED at the ' +
      'beginning of the next: "He arrived. Having arrived, he sat down. Having sat ' +
      'down, he spoke." Creates an overlapping chain of events.',
    example:
      'Amele: "uqa bel-ig, bel-ig-a, ho-ig-a..." — each clause starts by echoing ' +
      'the previous one. (de Vries 2005)',
    mtChallenge:
      'English doesn\'t repeat verbs this way. MT must recognize this as a discourse ' +
      'device and eliminate the repetition.',
    sources: [
      'https://en.wikipedia.org/wiki/Tail%E2%80%93head_linkage',
    ],
    grambankId: null,
    walsId: null,
    category: 'syntax',
    related: ['clauseChaining', 'hasSerialVerbs'],
  },

  /* ==================================================================== */
  /*  WALS-SPECIFIC FEATURES (from WALS chapter names)                    */
  /* ==================================================================== */

  predicativeAdjectives: {
    name: 'Predicative Adjectives',
    explain:
      'How adjectives work as predicates ("The sky IS blue"). Some languages treat ' +
      'adjectives as verbs (no "is" needed), while others require a copula or ' +
      'special predicate form.',
    example:
      'Korean: "하늘이 파랗다" (haneuri parata) — "blue" acts as a verb: "The sky ' +
      'blues." No "is" needed. (Dryer 2013, WALS ch. 118)',
    mtChallenge:
      'If adjectives are verbal in the source language, MT must insert a copula ' +
      'when translating to English, and vice versa.',
    sources: [
      'https://en.wikipedia.org/wiki/Predicate_(grammar)',
      'https://wals.info/chapter/118',
    ],
    grambankId: null,
    walsId: '118A',
    category: 'syntax',
    related: ['copula'],
  },

  copula: {
    name: 'Zero Copula',
    explain:
      'Whether the language omits the verb "to be" in sentences like "She IS a ' +
      'doctor" → "She doctor." Russian, Arabic, and many other languages ' +
      'regularly drop the copula.',
    example:
      'Russian: "Она врач" (She doctor) — no "is." Arabic: "البيت كبير" ' +
      '(The-house big) — "is" absent. (Dryer 2013, WALS ch. 120)',
    mtChallenge:
      'Translating from zero-copula languages into English requires inserting ' +
      '"is/are/am" where none exists in the source.',
    sources: [
      'https://en.wikipedia.org/wiki/Copula_(linguistics)',
      'https://wals.info/chapter/120',
    ],
    grambankId: null,
    walsId: '120A',
    category: 'syntax',
    related: ['predicativeAdjectives'],
  },

  alienability: {
    name: 'Alienable vs. Inalienable Possession',
    explain:
      'Some languages distinguish inherent possession (inalienable: body parts, ' +
      'family — "my hand") from acquired possession (alienable: "my car"). ' +
      'Different grammatical constructions mark each type.',
    example:
      'Many Oceanic languages: body parts and kinship terms require obligatory ' +
      'possessive marking and use different constructions than regular possession. ' +
      '(Chappell & McGregor 1996)',
    mtChallenge:
      'English makes no such distinction. Translating "my X" into a language with ' +
      'alienability requires knowing whether X is a body part, kin term, or object.',
    sources: [
      'https://en.wikipedia.org/wiki/Inalienable_possession',
    ],
    grambankId: null,
    walsId: null,
    category: 'nominal',
    related: ['possession', 'case'],
  },

  /* ==================================================================== */
  /*  WALS NAMED FEATURES — keyed by exact WALS feature name              */
  /*  These keys must match how they appear in our data verbatim.          */
  /* ==================================================================== */

  'Asymmetrical Case-Marking': {
    name: 'Asymmetrical Case-Marking',
    explain:
      'Whether case marking treats different types of participants differently. ' +
      'Some languages only mark subjects (or objects) in certain tense/aspect ' +
      'constructions, creating asymmetry in how roles are identified.',
    example:
      'Hindi: the ergative marker -ne only appears on agents in perfective ' +
      'tenses — "Ram-ne kitab parhi" (Ram-ERG book read-PERF) but "Ram ' +
      'kitab parhta hai" (Ram book reads — no ergative in imperfective). ' +
      '(Dryer 2013, WALS ch. 98)',
    mtChallenge:
      'Asymmetric marking makes it harder for MT to consistently identify ' +
      'grammatical roles across different sentence types.',
    sources: [
      'https://en.wikipedia.org/wiki/Differential_object_marking',
      'https://wals.info/chapter/98',
    ],
    grambankId: null,
    walsId: '98A',
    category: 'nominal',
    related: ['case', 'hasErgativity'],
  },

  'Zero Marking of A and P Arguments': {
    name: 'Zero Marking of A and P Arguments',
    explain:
      'Whether the language leaves agent (A) and patient (P) arguments ' +
      'unmarked, relying on word order or context to distinguish who ' +
      'does what to whom — as English mostly does.',
    example:
      'English: "The dog chased the cat" — neither "dog" nor "cat" has ' +
      'any morphological case marking; word order alone signals roles. ' +
      '(Dryer 2013, WALS ch. 98)',
    mtChallenge:
      'Zero marking means the MT model must rely heavily on context and ' +
      'word order to determine argument roles.',
    sources: [
      'https://en.wikipedia.org/wiki/Morphosyntactic_alignment',
      'https://wals.info/chapter/98',
    ],
    grambankId: null,
    walsId: '98A',
    category: 'syntax',
    related: ['case', 'alignment', 'wordOrder'],
  },

  'Zero Copula for Predicate Nominals': {
    name: 'Zero Copula for Predicate Nominals',
    explain:
      'Whether the language omits "to be" in sentences like "She IS a doctor" → ' +
      '"She doctor." Russian, Arabic, Hungarian, and many other languages ' +
      'regularly drop the copula in present tense.',
    example:
      'Russian: "Она врач" (She doctor, no "is"). Arabic: "البيت كبير" ' +
      '(The-house big). (Dryer 2013, WALS ch. 120)',
    mtChallenge:
      'Translating from a zero-copula language requires inserting "is/are/am" ' +
      'where none exists in the source.',
    sources: [
      'https://en.wikipedia.org/wiki/Copula_(linguistics)',
      'https://wals.info/chapter/120',
    ],
    grambankId: null,
    walsId: '120A',
    category: 'syntax',
    related: ['copula', 'predicativeAdjectives'],
  },

  'Locus of Marking: Whole-language Typology': {
    name: 'Locus of Marking',
    explain:
      'An overall classification of whether grammatical relationships are marked ' +
      'on the HEAD word (head-marking, like Mohawk), the DEPENDENT word ' +
      '(dependent-marking, like Turkish), both (double-marking), or neither.',
    example:
      'Mohawk is head-marking: "Wa-hi-hnínu" = the verb carries markers for ' +
      'both subject and object. Turkish is dependent-marking: "adam-ın ev-i" = ' +
      'the nouns carry case endings. (Nichols 1986; WALS ch. 23)',
    mtChallenge:
      'The locus of marking fundamentally affects WHERE grammatical information ' +
      'appears in a sentence, requiring different parsing strategies for MT.',
    sources: [
      'https://en.wikipedia.org/wiki/Head-marking_language',
      'https://wals.info/chapter/23',
    ],
    grambankId: null,
    walsId: '23A',
    category: 'syntax',
    related: ['headMarking', 'dependentMarking'],
  },

  'Comitatives and Instrumentals': {
    name: 'Comitatives and Instrumentals',
    explain:
      'Whether the language uses the SAME marker for "with" (accompaniment: ' +
      '"I went with John") and "with" (instrument: "I cut it with a knife"), ' +
      'or uses DIFFERENT markers for each meaning.',
    example:
      'English merges them: "with" covers both senses. Russian distinguishes: ' +
      '"с Иваном" (with Ivan, accompaniment) uses the same preposition as ' +
      '"с ножом" (with a knife, instrument), but case marking differs. ' +
      '(Stolz et al. 2006; WALS ch. 52)',
    mtChallenge:
      'Languages that split these meanings require MT to disambiguate the ' +
      'English "with" — is it accompaniment or instrument?',
    sources: [
      'https://en.wikipedia.org/wiki/Comitative_case',
      'https://wals.info/chapter/52',
    ],
    grambankId: null,
    walsId: '52A',
    category: 'nominal',
    related: ['case'],
  },

  'Tea': {
    name: 'Tea (Linguistic Etymology)',
    explain:
      'Whether the word for "tea" in this language derives from Sinitic "chá" ' +
      '(borrowed via the overland Silk Road through Central Asia) or from ' +
      'Min Chinese "te" (borrowed via maritime trade through Southeast Asia ' +
      'and Europe). This single word traces centuries of trade history.',
    example:
      'Portuguese "chá" came overland via Macau. English "tea" came by sea ' +
      'via Dutch traders who got it from Hokkien "tê". ' +
      '(Dryer 2013, WALS ch. 138)',
    mtChallenge:
      'Primarily a cultural-historical feature. The word "tea" reveals trade ' +
      'routes, not grammatical complexity.',
    sources: [
      'https://en.wikipedia.org/wiki/Etymology_of_tea',
      'https://wals.info/chapter/138',
    ],
    grambankId: null,
    walsId: '138A',
    category: 'semantics',
    related: [],
  },

  'Nominal and Verbal Conjunction': {
    name: 'Nominal and Verbal Conjunction',
    explain:
      'Whether the language uses the SAME word for "and" when joining nouns ' +
      '("cats and dogs") and when joining clauses ("she sang and he danced"), ' +
      'or uses DIFFERENT words for each.',
    example:
      'English uses "and" for both. Japanese uses "to" (と) for nouns but ' +
      'different connective forms for clauses. (Dryer 2013, WALS ch. 64)',
    mtChallenge:
      'Languages with distinct conjunctions for nouns vs. clauses require MT ' +
      'to distinguish noun-phrase from clause coordination.',
    sources: [
      'https://en.wikipedia.org/wiki/Conjunction_(grammar)',
      'https://wals.info/chapter/64',
    ],
    grambankId: null,
    walsId: '64A',
    category: 'syntax',
    related: [],
  },

  'Nominal and Locational Predication': {
    name: 'Nominal and Locational Predication',
    explain:
      'How the language expresses "X is a Y" (nominal predication: "She is a ' +
      'doctor") vs. "X is at/in Y" (locational predication: "She is in the ' +
      'room"). Some languages use the same verb for both; others use different ' +
      'verbs or constructions.',
    example:
      'Spanish: "Ella es doctora" (She is a doctor — ser) vs. "Ella está en ' +
      'la sala" (She is in the room — estar). Two different "to be" verbs. ' +
      '(Dryer 2013, WALS ch. 119)',
    mtChallenge:
      'Mismatched predication strategies require careful restructuring of "is" ' +
      'sentences during translation — especially for ser/estar languages.',
    sources: [
      'https://en.wikipedia.org/wiki/Predicate_(grammar)',
      'https://wals.info/chapter/119',
    ],
    grambankId: null,
    walsId: '119A',
    category: 'syntax',
    related: ['copula'],
  },

  'Obligatory Possessive Inflection': {
    name: 'Obligatory Possessive Inflection',
    explain:
      'Whether certain nouns (especially body parts and kinship terms) MUST ' +
      'appear with a possessor. In many languages you cannot say "hand" alone — ' +
      'only "my hand," "his hand," etc.',
    example:
      'Many Polynesian and Amerindian languages require possessive marking on ' +
      'body parts: *"hand" is ungrammatical — it must be "someone\'s hand." ' +
      '(Dryer 2013, WALS ch. 58)',
    mtChallenge:
      'Translating INTO an obligatory-possession language requires adding ' +
      'possessive markers that have no counterpart in the source.',
    sources: [
      'https://en.wikipedia.org/wiki/Inalienable_possession',
      'https://wals.info/chapter/58',
    ],
    grambankId: null,
    walsId: '58A',
    category: 'nominal',
    related: ['alienability', 'possession'],
  },

  'M-T Pronouns': {
    name: 'M-T Pronoun Pattern',
    explain:
      'A striking cross-linguistic pattern: languages worldwide tend to use "m" ' +
      'sounds for 1st person ("me", "moi", "mình") and "t/n" sounds for 2nd person ' +
      '("thou", "tu", "tú"). This is one of the few near-universal patterns in ' +
      'human language, possibly reflecting shared ancestry or sound symbolism.',
    example:
      'English "me" / "thou", French "moi" / "toi", Turkish "ben" / "sen", ' +
      'Hebrew "ani" / "ata" — all show the m/n (1st) vs. t (2nd) pattern. ' +
      '(Nichols 1992; WALS ch. 136)',
    mtChallenge:
      'Primarily a typological observation about sound patterns, not a direct ' +
      'MT challenge.',
    sources: [
      'https://en.wikipedia.org/wiki/World_Atlas_of_Language_Structures',
      'https://wals.info/chapter/136',
    ],
    grambankId: null,
    walsId: '136A',
    category: 'semantics',
    related: ['pronoun'],
  },

  'Green and Blue': {
    name: 'Green and Blue Distinction',
    explain:
      'Whether this language has SEPARATE words for "green" and "blue," or uses ' +
      'a single term (linguists call it "grue") for both. Many languages worldwide ' +
      'do not distinguish these colors — speakers use context to specify which shade.',
    example:
      'Japanese: historically 青 (ao) covered both blue AND green. Vietnamese: ' +
      '"xanh" covers both blue and green; "xanh da trời" (sky-blue) and "xanh lá ' +
      'cây" (leaf-green) specify further. (Kay & Berlin 1969; WALS ch. 134)',
    mtChallenge:
      'Color term boundaries differ across languages: "blue" may map to multiple ' +
      'terms or merge with "green," requiring contextual disambiguation.',
    sources: [
      'https://en.wikipedia.org/wiki/Blue%E2%80%93green_distinction_in_language',
      'https://wals.info/chapter/134',
    ],
    grambankId: null,
    walsId: '134A',
    category: 'semantics',
    related: ['Red and Yellow'],
  },

  'Red and Yellow': {
    name: 'Red and Yellow Distinction',
    explain:
      'Whether this language distinguishes "red" from "yellow" with separate basic ' +
      'color terms, or groups them under one term. Color vocabulary reflects how ' +
      'cultures categorize the visible spectrum.',
    example:
      'Some Australian languages use a single term for the warm end of the ' +
      'spectrum covering both red and yellow. (Kay & Berlin 1969; WALS ch. 135)',
    mtChallenge:
      'Color vocabulary mismatches require the MT model to select the right ' +
      'color term based on context.',
    sources: [
      'https://en.wikipedia.org/wiki/Color_term',
      'https://wals.info/chapter/135',
    ],
    grambankId: null,
    walsId: '135A',
    category: 'semantics',
    related: ['Green and Blue'],
  },

  'Finger and Hand': {
    name: 'Finger and Hand Distinction',
    explain:
      'Whether this language uses the SAME word for "finger" and "hand," or has ' +
      'distinct terms. Many languages worldwide use a single term for both — ' +
      'speakers rely on context to specify which body part.',
    example:
      'Many Niger-Congo languages use a single word covering both "finger" and ' +
      '"hand." Japanese distinguishes: 手 (te, hand) vs 指 (yubi, finger). ' +
      '(Brown 2013; WALS ch. 130)',
    mtChallenge:
      'Body-part terminology boundaries differ across languages — translating ' +
      '"hand" may include or exclude "finger" depending on the language.',
    sources: [
      'https://en.wikipedia.org/wiki/Body_part_(linguistics)',
      'https://wals.info/chapter/130',
    ],
    grambankId: null,
    walsId: '130A',
    category: 'semantics',
    related: ['Hand and Arm'],
  },

  'Hand and Arm': {
    name: 'Hand and Arm Distinction',
    explain:
      'Whether this language uses the SAME word for "hand" and "arm," or has ' +
      'distinct terms. This is a well-studied example of how languages divide ' +
      'the body into different semantic regions.',
    example:
      'Russian: "рука" (ruka) covers both "hand" AND "arm" — there is no common ' +
      'separate word for each. Japanese: 手 (te, hand) vs 腕 (ude, arm). ' +
      '(Brown 2013; WALS ch. 129)',
    mtChallenge:
      'Translating between merged and split body-part terms requires knowing ' +
      'which body region is contextually intended.',
    sources: [
      'https://en.wikipedia.org/wiki/Body_part_(linguistics)',
      'https://wals.info/chapter/129',
    ],
    grambankId: null,
    walsId: '129A',
    category: 'semantics',
    related: ['Finger and Hand'],
  },
};


// ============================================================================
// LOOKUP FUNCTIONS — the public API other modules consume
// ============================================================================

/**
 * Normalize a feature property name to a glossary key.
 *
 * Strips common prefixes/suffixes from any naming convention:
 *   "HasAnyPolyexponence"     →  "polyexponence"
 *   "Has Any Enclitics"       →  "enclitics"
 *   "hasCase"                 →  "case"
 *   "Case Syncretism"         →  "caseSyncretism"
 *   "HasAnyFlexivityForVerbs" →  "flexivity"
 *
 * @param {string} property — raw feature property name
 * @returns {string} normalized concept key
 */
export function extractConcept(property) {
  let concept = property;

  // Strip "Has Any " / "HasAny" / "Has " / "has" prefixes
  concept = concept.replace(/^Has\s*Any\s*/i, '');
  concept = concept.replace(/^Has\s*/i, '');
  concept = concept.replace(/^Is\s*/i, '');

  // Strip " For Nouns" / " For Verbs" / " For S And A" etc. suffixes
  concept = concept.replace(/\s+For\s+.+$/i, '');

  // Normalize spaces/underscores to camelCase
  concept = concept.replace(/[\s_-]+(.)/g, (_, c) => c.toUpperCase());

  // Lowercase the first character
  concept = concept.charAt(0).toLowerCase() + concept.slice(1);

  return concept;
}


/**
 * Look up a concept in the glossary, trying multiple normalization strategies.
 *
 * @param {string} property — raw feature property name from any source
 * @returns {object|null} glossary entry (with added `key` field) or null
 */
export function lookupConcept(property) {
  // Direct match
  if (GLOSSARY[property]) return { ...GLOSSARY[property], key: property };

  // Extracted concept
  const concept = extractConcept(property);
  if (GLOSSARY[concept]) return { ...GLOSSARY[concept], key: concept };

  // Case-insensitive match
  const lower = concept.toLowerCase();
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    if (key.toLowerCase() === lower) return { ...entry, key };
  }

  // Substring match (only for substantial overlaps)
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      if (Math.min(key.length, concept.length) >= 5) {
        return { ...entry, key };
      }
    }
  }

  return null;
}


/**
 * Return the glossary entry for a given property name.
 * Alias for lookupConcept, matching the old typologyGlossary.js API.
 *
 * @param {string} propertyName
 * @returns {object|null}
 */
export function getFeatureInfo(propertyName) {
  const entry = lookupConcept(propertyName);
  if (!entry) return null;

  // Map to the legacy API shape expected by DetailPanel
  return {
    name: entry.name,
    description: entry.explain,
    mtImpact: entry.mtChallenge,
    learnMore: entry.sources?.[0] || null,
    example: entry.example,
    sources: entry.sources,
    grambankId: entry.grambankId,
    walsId: entry.walsId,
    category: entry.category,
    related: entry.related,
  };
}


/**
 * Return a human-friendly display name for a property.
 * Checks the glossary first; falls back to camelCase → Title Case conversion.
 *
 * @param {string} propertyName
 * @returns {string}
 */
export function getFeatureDisplayName(propertyName) {
  const entry = lookupConcept(propertyName);
  if (entry?.name) return entry.name;

  // Fallback: strip "has"/"Has", split camelCase, title-case
  return propertyName
    .replace(/^has/i, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^./, s => s.toUpperCase());
}


/**
 * Get all concept keys in the glossary (for building indexes).
 */
export function getAllConcepts() {
  return Object.keys(GLOSSARY);
}
