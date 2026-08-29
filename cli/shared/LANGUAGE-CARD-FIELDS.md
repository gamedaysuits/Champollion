# Language Card Field Reference

> **Version:** 1.0
> **Date:** 2026-06-09
> **Schema:** `cli/shared/schemas/language-card.schema.json` (v2020-12)
> **Audience:** Contributors, enrichment script authors, downstream consumers

This document describes every field in the Champollion language card schema. For each field you will find the JSON key, type, data source(s), a plain-English description, and a real value from an existing card.

For the enrichment philosophy, provenance rules, and merge semantics see [DATA-ENRICHMENT.md](../DATA-ENRICHMENT.md).
For license obligations see [ATTRIBUTION.md](./ATTRIBUTION.md).

---

## 1. Core Identity

These fields uniquely identify a language and provide its basic naming and coding information.

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `code` | `string` | ISO 639-3 | Primary language identifier. ISO 639-3 three-letter code for individual languages (`fra`, `crk`), BCP 47 with region for regional variants (`por-PT`), or prefixed codes for genera/families (`genus-cree`, `family-algic`). Conlangs use `x-` prefix. **Required.** | `"crk"` (Plains Cree) |
| `name` | `string` | ISO 639-3 | English display name of the language. **Required.** | `"Plains Cree"` |
| `nativeName` | `string \| null` | Wikidata P1705 | Name in the language's own script (endonym). For dual orthographies, both forms separated by ` / `. Must render in native script — never romanized. Null for conlangs without established endonyms. | `"nêhiyawêwin / ᓀᐦᐃᔭᐍᐏᐣ"` (crk) |
| `bcp47` | `string \| null` | LinguaMeta | BCP 47 language tag. Null for languages without a registered subtag (430+ cards have null). | `"yo-Latn-NG"` (yor), `"es"` (spa) |
| `iso639_1` | `string \| null` | ISO 639-3 | ISO 639-1 two-letter code. Null if none exists. Pattern: `^[a-z]{2}$`. | `"es"` (spa), `null` (crk) |
| `iso639_3` | `string \| null` | ISO 639-3 | ISO 639-3 three-letter code. Null for conlangs. Pattern: `^[a-z]{3}$`. | `"yor"` (Yoruba) |
| `glottocode` | `string \| null` | Glottolog 5.3 | Glottolog identifier for cross-referencing the Glottolog language database. Pattern: `^[a-z]{4}[0-9]{4}$`. | `"plai1258"` (crk), `"stan1288"` (spa) |
| `isoScope` | `string \| null` | ISO 639-3 | ISO 639-3 scope: `"I"` (individual), `"M"` (macrolanguage), `"S"` (special). Null if not in ISO 639-3. | `"I"` (spa, yor), `null` (crk) |
| `isoType` | `string \| null` | ISO 639-3 | ISO 639-3 type: `"L"` (living), `"E"` (extinct), `"A"` (ancient), `"H"` (historical), `"C"` (constructed), `"S"` (special). Null if not in ISO 639-3. | `"L"` (cmn, yor) |
| `script` | `string \| null` | Wikidata P282, LinguaMeta | Primary ISO 15924 script code. Pattern: `^[A-Z][a-z]{3}$`. Null for unwritten languages or when unknown (1,400+ null). | `"Cans"` (crk), `"Latn"` (spa, yor), `"Hans"` (cmn) |
| `scripts` | `array \| null` | LinguaMeta | All scripts used by this language. Each entry has `code` (ISO 15924), `name` (human-readable), and `primary` (boolean). Many languages use multiple scripts. | `[{"code": "Cans", "name": "Unified Canadian Aboriginal Syllabics", "primary": true}, {"code": "Latn", "name": "Latin (SRO)", "primary": false}]` (crk) |
| `dir` | `string \| null` | Derived from script | Text directionality: `"ltr"`, `"rtl"`, or `null` for unwritten languages (620+ null). | `"ltr"` (all example cards) |
| `aliases` | `array` | Manual / LinguaMeta | Alternative locale codes that resolve to this card (e.g., `"no"` → `"nb"`, `"iw"` → `"he"`). | `["zh", "zh-CN", "zh-Hans", "zho"]` (cmn), `["es"]` (spa) |
| `alternateNames` | `array` | Glottolog, WALS, LinguaMeta, ElCat | Alternative English names for search and display. | `["Cree (Plains)", "ᓀᐦᐃᔭᐍᐏᐣ", "Cree"]` (crk) |

---

## 2. Classification

Genealogical classification placing the language in the world's language family tree.

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `classification` | `object \| null` | Glottolog 5.3 | Full genealogical classification. Contains `family`, `familyGlottocode`, `genus`, `genusGlottocode`, and `ancestry`. Null for conlangs. | See sub-fields below |
| `classification.family` | `string` | Glottolog 5.3 | Top-level language family. | `"Algic"` (crk), `"Indo-European"` (spa), `"Niger-Congo"` (yor), `"Sino-Tibetan"` (cmn) |
| `classification.familyGlottocode` | `string` | Glottolog 5.3 | Glottocode of the top-level family node. | `"algi1248"` (crk), `"indo1319"` (spa) |
| `classification.genus` | `string` | Glottolog 5.3 / WALS | WALS-style genus — lowest-level grouping sharing runtime properties. Used for genus card inheritance. | `"Plains Creeic"` (crk), `"Castilic"` (spa), `"Yoruboid"` (yor), `"Mandarinic"` (cmn) |
| `classification.genusGlottocode` | `string` | Glottolog 5.3 | Glottocode of the genus node. | `"plai1264"` (crk), `"cast1243"` (spa) |
| `classification.ancestry` | `array` | Glottolog 5.3 | Full ancestry chain from top-level family to genus. | `["Algic", "Algonquian-Blackfoot", "Algonquian", "Cree-Montagnais-Naskapi", "Cree", "Plains Creeic"]` (crk) |
| `macroarea` | `string \| null` | Derived from coordinates / Glottolog | Glottolog macroarea. One of: `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"`, `"South America"`, or `null`. | `"Africa"` (yor), `"South America"` (spa), `"Eurasia"` (cmn), `null` (crk) |
| `isIsolate` | `boolean` | Glottolog 5.3 | Whether this language has no known genetic relatives. | `false` (all example cards) |
| `macrolanguage` | `string \| null` | LinguaMeta | ISO 639-3 macrolanguage code if part of a macrolanguage umbrella. Null otherwise. Pattern: `^[a-z]{3}$`. | `"zho"` (cmn), `"cre"` (crk), `null` (spa, yor) |
| `extends` | `string \| null` | Manual | Locale code of another card/family this card inherits from. | `"macrolanguage-zho"` (cmn), `"genus-cree"` (crk), `"genus-romance"` (spa), `null` (yor) |

---

## 3. Vitality & Speakers

Endangerment status and speaker population data.

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `vitality` | `object \| null` | LinguaMeta, ElCat, UNESCO | Language vitality and endangerment status. Used for LRL prioritization. | See sub-fields below |
| `vitality.unescoStatus` | `string \| null` | LinguaMeta / UNESCO | UNESCO classification: `"safe"`, `"vulnerable"`, `"definitely-endangered"`, `"severely-endangered"`, `"critically-endangered"`, `"extinct"`. | `"safe"` (spa, cmn, yor), `"severely-endangered"` (crk) |
| `vitality.egids` | `string \| null` | Manual / LinguaMeta | Ethnologue EGIDS level (0–10). | `"6b"` (crk), `"2"` (yor), `null` (spa) |
| `vitality.speakerCount` | `string \| number \| null` | Derived from speakerEstimates | Approximate total speaker count. Uses ranges: `"~50M"`, `"20K-25K"`. | `"~490M L1"` (spa), `20000` (crk), `"~47M (L1 + L2)"` (yor) |
| `vitality.trend` | `string \| null` | Derived / ElCat / UNESCO | Speaker population trend: `"growing"`, `"stable"`, `"declining"`, `"rapidly-declining"`, `"moribund"`. | `"growing"` (spa, yor), `"stable"` (cmn), `"declining"` (crk) |
| `vitality.notes` | `string \| null` | Manual | Context notes about endangerment. | `"Intergenerational transmission breaking down in most communities..."` (crk) |
| `speakerEstimates` | `array` | Wikidata, LinguaMeta, Ethnologue | Speaker count estimates from multiple sources. Each entry has `source`, `count` (integer), optional `date` (ISO 8601), and optional `type` (`"L1"`, `"L2"`, `"total"`). | `[{"source": "wikidata", "count": 37800000, "date": "2026-06-07"}, {"count": 28000000, "source": "linguameta", "date": "2024"}]` (yor) |
| `dialectCount` | `integer \| null` | Glottolog 5.3 | Number of recognized dialects or varieties. | `3` (crk), `22` (yor), `31` (cmn), `38` (spa) |

---

## 4. Typological Profile

Structural/typological features describing the grammar and phonology of the language.

### 4.1 `typologicalProfile`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `typologicalProfile` | `object \| null` | Grambank, WALS, AUTOTYP, WACL | Typological features. Auto-populated by `enrich-grambank-typology.mjs`. | See sub-fields below |
| `.featuresDocumented` | `integer` | Grambank | Number of Grambank features documented. | `195` (cmn), `174` (crk), `155` (spa), `140` (yor) |
| `.featuresCoverage` | `number` | Grambank | Fraction of Grambank features documented (0.0–1.0). | `1` (cmn), `0.89` (crk) |
| `.wordOrderDominant` | `string \| null` | Grambank / WALS | Dominant word order. | `"SVO"` (spa, yor), `"SOV"` (cmn) |
| `.hasDefiniteArticle` | `boolean \| null` | Grambank | Whether the language has a definite article. | `true` (spa), `false` (cmn, crk, yor) |
| `.hasIndefiniteArticle` | `boolean \| null` | Grambank | Whether the language has an indefinite article. | `true` (spa), `false` (cmn, crk, yor) |
| `.hasGenderSystem` | `boolean \| null` | Grambank / WALS | Whether the language has a grammatical gender system. | `true` (spa, cmn, crk), `false` (yor) |
| `.hasCaseMorphology` | `boolean \| null` | Grambank | Whether the language has morphological case marking. | `true` (cmn, crk), `false` (spa, yor) |
| `.hasEvidentiality` | `boolean \| null` | Grambank | Whether the language has grammatical evidentiality. | `false` (all example cards) |
| `.hasToneSystem` | `boolean \| null` | Grambank | Whether the language uses lexical or grammatical tone. | `true` (crk, yor), `false` (cmn, spa) |
| `.source` | `string \| null` | — | Data source and version. | `"grambank-1.0.3"` (cmn, crk), `"wals-2024"` (spa, yor) |
| `.headMarking` | `boolean \| null` | AUTOTYP | Whether the language uses head-marking for S/A arguments. | `true` (crk, spa), `false` (cmn, yor) |
| `.dependentMarking` | `boolean \| null` | AUTOTYP | Whether the language uses dependent-marking. | `false` (all example cards) |
| `.hasNumeralClassifiers` | `boolean \| null` | WALS 55A | Whether the language uses numeral classifiers. | `true` (cmn), `false` (crk, yor) |
| `.numeralClassifierType` | `string \| null` | WALS 55A | Classifier type: `"Obligatory"`, `"Optional"`, `"Absent"`. | `"Obligatory"` (cmn), `"Absent"` (crk, yor) |
| `.caseCount` | `integer \| null` | WALS 49A | Number of grammatical cases. | `0` (cmn, spa, yor) |
| `.genderCount` | `string \| integer \| null` | WALS 30A | Number of grammatical genders. | `"2"` (spa), `0` (cmn, yor) |
| `.inflectionalStrategy` | `string \| null` | WALS 26A | Prefixing vs. suffixing strategy. | `"Strongly suffixing"` (cmn, spa), `"Equal prefixing and suffixing"` (crk), `"Little affixation"` (yor) |
| `.morphologicalSynthesis` | `string \| null` | Champollion-derived (derive-morphological-synthesis.mjs) | Synthesis-degree enum: `"analytic"`, `"synthetic"`, `"polysynthetic"`. Derived STRICTLY from cited on-card signals — the WALS 22A categories-per-word value (`encyclopedic.typology.verbSynthesis` / `linguisticChallenges.morphologicalComplexity`; 0–1 → analytic, 2–7 → synthetic, 8+ → polysynthetic), WALS 26A `"Little affixation"` (analytic), and cited polysynthesis prose (polysynthetic). Absent when signals are missing or conflict. Provenance MUST be a `derived:` stamp (lint R6). | `"polysynthetic"` (crk) |
| `.ordinalNumerals` | `string \| null` | WALS 53A | How ordinal numerals are formed. | `"One-th, two-th, three-th"` (cmn, yor), `"First, second, three-th"` (spa) |
| `.obligatoryNumberMarking` | `boolean \| null` | Grambank GB024 | Whether number marking on nouns is obligatory. | `true` (cmn), `false` (crk) |
| `.hasNounClassifiers` | `boolean \| null` | Grambank GB522 | Whether the language has noun classifiers. | `true` (cmn, crk) |
| `.classifierLanguage` | `boolean \| null` | WACL | Whether classified as a classifier language. | `true` (all example cards) |
| `.valencyPatterns` | `boolean \| null` | ValPaL | Whether valency pattern data is available. | `true` (cmn, yor) |

### 4.2 `phonologicalInventory`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `phonologicalInventory` | `object \| null` | PHOIBLE 2.0 | Phoneme inventory. Auto-populated by `enrich-phoible-phonemes.mjs`. Null if undocumented. | `null` (crk) |
| `.consonants` | `integer` | PHOIBLE | Number of consonant phonemes. | `25` (cmn), `19` (spa), `18` (yor) |
| `.vowels` | `integer` | PHOIBLE | Number of vowel phonemes. | `17` (cmn), `7` (spa), `11` (yor) |
| `.tones` | `integer` | PHOIBLE | Number of tonal contrasts (0 for non-tonal). | `2` (cmn), `0` (spa, yor) |
| `.totalPhonemes` | `integer` | PHOIBLE | Total phoneme count (consonants + vowels + tones). | `42` (cmn), `26` (spa), `29` (yor) |
| `.isTonal` | `boolean` | PHOIBLE | Whether the language uses lexical/grammatical tone. | `true` (cmn), `false` (spa, yor) |
| `.inventorySize` | `string \| null` | PHOIBLE | Qualitative classification: `"small"`, `"moderately-small"`, `"average"`, `"moderately-large"`, `"large"`. | `"large"` (cmn), `"average"` (spa, yor) |
| `.source` | `string \| null` | — | Data source. | `"phoible-2.0"` (all) |

---

## 5. Orthography & Writing

Fields describing the language's writing system, keyboard availability, and script conversion.

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `orthographicStatus` | `string \| null` | Derived (CLDR + script + keyboard) | Status of the writing system: `"has-orthography"`, `"no-orthography"`, `"disputed"`, `"emerging"`, `"historical-only"`, or `null`. | `"has-orthography"` (yor), `"developing"` (crk, spa), `"unwritten"` (cmn) |
| `script` | `string \| null` | Wikidata P282, LinguaMeta | See §1 Core Identity above. | `"Cans"` (crk), `"Latn"` (spa) |
| `scriptUnicodeName` | `string \| null` | Derived via enrich-script-unicode-names.mjs | Unicode script block name mapped from the ISO 15924 `script` code. Used by `code_switching` metric plugin to detect script mixing. | `"Canadian_Aboriginal"` (crk), `"Latin"` (spa, yor), `"CJK"` (cmn) |
| `keyboardSupport` | `object \| null` | Keyman API | Keyboard layout availability. Null if no data. | `{"keymanKeyboards": 1, "keyboardNames": ["Pan Africa Mnemonic (SIL)"], "source": "keyman-api"}` (yor) |
| `keyboardSupport.keymanKeyboards` | `integer` | Keyman API | Number of Keyman keyboard layouts available. | `1` (cmn, yor) |
| `keyboardSupport.keyboardNames` | `array` | Keyman API | Names of available keyboards. | `["Pinyin Mandarin"]` (cmn) |
| `scriptConverter` | `string \| null` | Manual | Key in the `SCRIPT_CONVERTERS` registry (from `scripts.js`) if the language has a deterministic script conversion step. Null if not applicable. | `"crk"` (crk), `null` (spa, cmn, yor) |
| `orthographies` | `array \| null` | Derived (derive-orthographies.mjs) from `scripts[]` + `orthographicStatus` + `shared/curated-orthography-conventions.json` | Structured writing-convention entries, one per script: `script` (ISO 15924, required), optional `scheme` (named convention, e.g. `"SRO"`), optional `longVowelMarking` (`"circumflex"`, `"macron"`, …), optional `canonicalForMt` (the pipeline's working form — derived for sole-script written cards, curated otherwise; the `primary` display flag is NOT this signal), `source` (required). Optional keys are omitted when unknown — never guessed. | `[{"script": "Cans", "canonicalForMt": false, ...}, {"script": "Latn", "scheme": "SRO", "longVowelMarking": "circumflex", "canonicalForMt": true, ...}]` (crk) |

---

## 6. Corpus & Resource Availability

Information about available corpora, NLP resources, digital presence, and archive holdings.

### 6.1 `corpusAvailability`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `corpusAvailability` | `object \| null` | OPUS, Lexibank, UD, ASJP, etc. | Available parallel and monolingual corpora. | See sub-fields below |
| `.opus` | `object \| null` | OPUS NLP API | OPUS parallel corpus data. | `{"corpora": 164, "corpusNames": ["NLLB", "CCMatrix", "OpenSubtitles", "MultiParaCrawl", "ParaCrawl"], "languagePairs": 665, "totalAlignmentPairs": 7936408771, "source": "opus-nlpl-api"}` (spa) |
| `.opus.corpora` | `integer` | OPUS | Number of OPUS corpora containing this language. | `164` (spa), `12` (yor), `1` (cmn, crk) |
| `.opus.corpusNames` | `array` | OPUS | Names of the most significant corpora. | `["Tatoeba"]` (cmn, crk) |
| `.lexibank` | `object \| null` | Lexibank | Lexical dataset availability. Has `datasets` (count) and `totalForms`. | `{"datasets": 6, "totalForms": 3582}` (spa), `null` (crk) |
| `.ud` | `object \| null` | Universal Dependencies | Treebank availability with `treebanks` (count), `treebankNames`, and `source`. | `{"treebanks": 7, "treebankNames": ["GSD", "GSDSimp", "CFL", "HK", "PUD"], "source": "universal-dependencies"}` (cmn) |
| `.asjpWordlists` | `integer` | ASJP | Number of ASJP basic vocabulary word lists. | `184` (cmn), `2` (spa), `21` (yor), `1` (crk) |
| `.asjpForms` | `integer` | ASJP | Number of ASJP lexical forms. | `9516` (cmn), `226` (spa), `1440` (yor), `39` (crk) |
| `.wiktionaryStructuredDump` | `boolean` | Kaikki/Wiktextract | Whether a structured Wiktionary dump is available. | `true` (cmn, spa, yor) |
| `.openMultilingualWordnet` | `boolean` | OMW | Whether linked wordnet data is available. | `true` (cmn, spa) |
| `.unimorphParadigms` | `boolean` | UniMorph | Whether normalized morphological paradigms are available. | `true` (spa) |
| `.huggingFaceDatasets` | `integer` | HuggingFace | Number of HuggingFace datasets tagged for this language. | `32` (spa), `7` (yor), `4` (cmn), `2` (crk) |
| `.diachronicAtlas` | `boolean` | DIACL | Whether diachronic comparative lexical data is available. | `true` (cmn, spa) |
| `.intercontinentalDictionarySeries` | `boolean` | IDS | Whether IDS concept-aligned dictionary data is available. | `true` (spa) |
| `.semanticShiftDatabase` | `boolean` | DatSemShift | Whether semantic shift pattern data is available. | `true` (cmn, spa, yor) |
| `.lexibankDatasets` | `array` | Lexibank (batch) | Names of Lexibank family-level datasets covering this language. | `["dyenindoeuropean", "ielexfinal", "joophonosemantic", ...]` (spa) |

### 6.2 `digitalPresence`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `digitalPresence` | `object \| null` | Wikipedia, Tatoeba, Common Voice, Wikimedia Incubator | Digital presence indicators. | See sub-fields below |
| `.wikipedia` | `object \| null` | Wikimedia SiteMatrix + SiteInfo | Wikipedia edition data: `code`, `url`, `articles`, `activeUsers`, `totalEdits`. | `{"code": "es", "url": "https://es.wikipedia.org", "articles": 2118142, "activeUsers": 43996, ...}` (spa) |
| `.tatoeba` | `object \| null` | Tatoeba | Sentence count. | `{"sentences": 443270, "source": "tatoeba"}` (spa), `{"sentences": 52, "source": "tatoeba"}` (crk) |
| `.commonVoice` | `object \| null` | Common Voice 20.0 | Speech data: `validatedHours`, `totalHours`, `speakers`, `sentences`, `locale`. | `{"validatedHours": 6.5, "totalHours": 9.2, "speakers": 135, "sentences": 5419, "locale": "yo", ...}` (yor) |
| `.incubatorWikiPages` | `integer` | Wikimedia Incubator | Page count in Wikimedia Incubator test wiki (for languages without full Wikipedia). | `9` (crk), `1` (cmn) |

### 6.3 `resources`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `resources` | `object \| null` | Manual, Masakhane, ABVD, NorthEuraLex | NLP resources: corpora, models, FSTs, tools. | See sub-fields below |
| `.fsts` | `array` | Manual / GiellaLT | Morphological analyzers and FSTs. Each entry has `name`, `type`, `url`, optional `notes`, and optional `install` metadata for automated download. **See §6.3.1 — getting this field wrong fails silently.** | `[{"name": "GiellaLT Plains Cree FST (lang-crk)", "type": "morphological-analyzer", "install": {"repo": "giellalt/lang-crk", "format": "giellalt-nightly-apt", "aptPool": ".../g/giella-crk/", "debFile": "giella-crk_0.2.0+g4278~e1f96fea-1~sid1_all.deb", "debSha256": "de10b471…", "langCommit": "e1f96fea…"}}]` (crk) |
| `.corpora` | `array` | Manual / OPUS | Parallel and monolingual corpora. Each entry has `name`, `type` (`"parallel"`, `"monolingual"`, `"speech"`, `"nmt"`), optional `url`, `size`, `pairLanguages`, `license`, `domain`, `exposure`. | `[{"name": "MENYO-20k", "type": "parallel", "size": "~20K pairs", "domain": "mixed", "exposure": "open-web"}]` (yor) |
| `.models` | `array` | Manual | Pretrained NLP/MT models. Each entry has `name`, `url`, `type`. | `[{"name": "NLLB-200 (spa_Latn)", "type": "nmt", ...}]` (spa) |
| `.tools` | `array` | Manual | Other NLP tools (tokenizers, diacritic restorers, etc.). | `[{"name": "jieba (Chinese text segmentation)", "type": "tokenizer", ...}]` (cmn) |
| `.lexical` | `array` | ABVD, NorthEuraLex (via Lexibank) | Lexical databases with `type: "lexical-database"`, `name`, `description`, `source`. | `[{"name": "ABVD", "description": "102 concepts documented", ...}, {"name": "NorthEuraLex", "description": "1010/1016 concepts documented", ...}]` (cmn) |
| `.nlp` | `array` | Masakhane, IndicNLP, AmericasNLP | NLP community benchmark indicators with `type: "nlp-benchmark"`. | `[{"name": "Masakhane", "description": "MT, NER benchmarks for African languages", ...}]` (yor) |
| `.dictionaries` | `array` | derive-dictionaries.mjs (promotes `encyclopedic.resources.dictionaries` + dictionary-shaped `resources.lexical` entries; flags from `shared/curated-dictionary-flags.json`) | Schematized dictionary/lexical-database pointers: `name` (required), `url`, optional `license`, optional `machineReadable`, optional `redistributable` (`false` = pointer-only, content must never be copied/redistributed), `source`. Existence pointers only — never dictionary content, never scores. | `[{"name": "itwêwina (Plains Cree Dictionary)", "url": "https://itwewina.altlab.app/", "machineReadable": true, "redistributable": false, ...}]` (crk) |
| `.grammars` | `array` | enrich-grammars-from-glottolog.mjs (Glottolog 5.3 MED citation records, pinned dump) | Bibliographic reference grammars — the MED-best few (≤3), filtered to grammar-typed records (`hhtype` grammar/grammar_sketch): optional `author`, optional `year`, `title` (required), `url` (stable Glottolog reference URL), `type`. `documentationDepth.med` proves a grammar exists; these entries name it. Citation metadata only. | `[{"author": "Edwards, Mary", "year": 1961, "title": "Cree: an intensive language course", "url": "https://glottolog.org/resource/reference/id/701784", "type": "grammar"}]` (crk) |

### 6.3.1 `resources.fsts[].install` — FST install channels

> ⚠️ **GitHub Releases is NOT GiellaLT/ALTLab's distribution channel.** They ship
> continuously; the release tags on `lang-*` repos are **vestigial**.
> **"No release since YEAR" does not mean "no update since YEAR."**
>
> `crk` sat on lang-crk's *newest* release tag — `fst-v2021.7.8` (2021) — for five
> years. The cost was invisible until someone measured it: the 2021 build uses `y`
> on the analysis side, current lang-crk uses **`ý`**, so the generator returned
> `None` **silently** for every ý-lemma. **4,989 of 28,268 lemmas (17.6%) were
> ungeneratable.** Surfaces were byte-identical either way (`ayisiyiniw` both
> times), so nothing ever looked broken. A stale FST pin does not throw.

| `format` | Channel | Pin | Use when |
|---|---|---|---|
| `giellalt-nightly-apt` | GiellaLT/Apertium nightly apt pool (`apertium.projectjj.com`) | `debFile` (carries the upstream commit) + `debSha256` | **Default for GiellaLT languages.** This is where upstream actually ships. |
| `legacy-zip` | GitHub Releases zip | `releaseTag` | Only when upstream genuinely publishes usable releases — and only after checking the tag is not stale. |
| `divvun-macos-pkg` | Divvun speller `.pkg` from a GitHub release | `releaseTag` + `bundlePattern` | Divvun-packaged spellers. |
| `divvun` | — | — | Divvun manager required; the installer refuses and tells the user. |
| `manual` | — | — | No automated path exists. |

**`giellalt-nightly-apt` fields:** `aptPool` (pool directory URL), `debFile` (exact
filename — **this is the pin**), `debSha256` (verified *before* extraction; install
aborts on mismatch), `langCommit` (upstream source commit), `include` (exact `.hfstol`
basenames to install), `stripSuffix` (e.g. `-giellaltbuild`).

**Three rules learned the hard way:**

1. **Lexicon and binary move together, in one commit.** If a project extracts a
   lexicon from `lang-X` source, the binary must be pinned to the *same* commit.
   `crk`'s `data/lexc_source/*.lexc` are byte-identical to `e1f96fea`, so the card
   pins `e1f96fea`. That is the whole reason the ý-skew existed.
2. **`include` explicitly; never glob everything.** A GiellaLT `.deb` ships ~31
   transducers of several **kinds** (`strict` / `relaxed` / `-gt-desc` descriptive /
   `-gt-norm` normative / `.Cans` syllabics). Installing all of them wastes ~250MB
   and invites comparing across kinds, which is **never valid** — it once produced a
   fictitious "16.7% regression rate" that was really 2.1%.
3. **Newer is not automatically better.** Re-pinning `crk` from 2021 → `e1f96fea`
   *lost* `namôya`, `mwêstas`, `nisis`, `okîsikâw` (upstream deleted them). Any
   re-pin needs a regression run, not just a version bump.

**Nightly pools are pruned.** A pinned `debFile` can eventually 404. When it does,
re-pin deliberately and re-verify — **do not fall back to a release tag.**

### 6.4 `archivePresence`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `archivePresence` | `object \| null` | PARADISEC, OLAC, ELAR, AILLA, Rosetta Project, Kaipuleohone | Presence in language documentation archives. Null if not present in any archive. | See sub-fields below |
| `.paradisec` | `object \| null` | PARADISEC (OAI-PMH) | PARADISEC holdings: `itemCount`, `collectionCount`, `mediaTypes`. | `{"itemCount": 485, "collectionCount": null, "mediaTypes": ["audio", "image", "text", "video"]}` (cmn) |
| `.olacResourceCount` | `integer` | OLAC Aggregator | Total resource count across OLAC archives. | `2624` (spa), `168` (cmn), `33` (yor), `13` (crk) |
| `.olacArchiveCount` | `integer` | OLAC Aggregator | Number of distinct OLAC archives holding resources. | `6` (spa), `4` (cmn, yor), `2` (crk) |
| `.olacArchives` | `array` | OLAC Aggregator | Archive domain names. | `["ethnologue.com", "gial.edu", "refdb.wals.info", "www.mpi.nl"]` (cmn, yor) |
| `.rosettaProjectItems` | `integer` | Rosetta Project (Internet Archive) | Number of items in the Rosetta Project. | `151` (spa), `2` (cmn), `1` (crk, yor) |
| `.kaipuleohoneItems` | `integer` | Kaipuleohone (UH) | Number of items in the Kaipuleohone archive. | `13` (spa) |
| `.ailla` | `boolean` | AILLA | Whether the language has entries in the Archive of Indigenous Languages of Latin America. | `true` (cmn, spa, yor) |

---

## 7. Evaluation

Fields for MT evaluation — benchmark datasets, metric model support, pipeline readiness.

### 7.1 `evalDatasets`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `evalDatasets` | `array` | Manual | IDs of evaluation datasets from the companion eval harness (the MT Eval Arena). Metadata only — not consumed at runtime. | `["edtekla-dev-v1"]` (crk), `["flores-plus-devtest"]` (spa, yor), `[]` (cmn) |

### 7.2 `pipelineReadiness`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `pipelineReadiness` | `object \| null` | Derived | Readiness assessment for the Champollion FST-gated translation pipeline. | See sub-fields below |
| `.tier` | `string` | Derived | Readiness tier: `"tier-1-ready"`, `"tier-2-feasible"`, `"tier-3-buildable"`, `"watch-list"`, `"not-applicable"`. (In practice, computed values include `"strong"`, `"good"`, `"low"`.) | `"strong"` (spa, yor), `"good"` (cmn), `"low"` (crk) |
| `.score` | `integer` | Derived | Numeric readiness score. | `85` (spa, yor), `60` (cmn), `25` (crk) |
| `.hasFST` | `boolean` | Derived | Whether a usable FST/morphological analyzer exists. | (present in schema; some cards use `.components` instead) |
| `.hasParallelCorpus` | `boolean` | Derived | Whether a parallel corpus >10K pairs exists. | (present in schema) |
| `.hasEvalBenchmark` | `boolean` | Derived | Whether a held-out evaluation benchmark exists (not FLORES — contaminated). | (present in schema) |
| `.components` | `object` | Derived | Component availability flags (`commonVoice`, `wikipedia`, `opus`, `lexibank`, `ud`, `keyboard`, `resources`, `googleTranslate`, `deepl`, `nllb`). | `{"commonVoice": false, "wikipedia": true, "opus": true, ...}` (cmn) |
| `.blockers` | `array \| null` | Derived | Key blockers preventing higher tier. | (present in schema) |

### 7.3 `methodSupport`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `methodSupport` | `object` | API verification | Which translation APIs/methods support this language. Single Source of Truth for method availability. Each key is a method, value is an object with `supported` (boolean) plus optional metadata. | See sub-fields below |
| `.googleTranslate` | `object` | API verification | Google Cloud Translation / Google Translate. | `{"supported": true, "verifiedDate": "2026-06-07"}` (spa, yor), `{"supported": false}` (crk) |
| `.deepl` | `object` | API verification | DeepL Translation API. Includes optional `formality` (boolean) for formality parameter support. | `{"supported": true, "formality": true}` (spa), `{"supported": false}` (crk, yor) |
| `.microsoftTranslator` | `object` | API verification | Microsoft Azure Cognitive Services Translator. | `{"supported": true}` (spa, yor), `{"supported": false}` (crk) |
| `.libreTranslate` | `object` | API verification | LibreTranslate open-source translation. | `{"supported": true}` (spa), `{"supported": false}` (crk, yor) |
| `.nllb` | `object` | API verification | Meta's NLLB-200 model. Includes optional `code` (NLLB language code), `variety`, `qualityNotes`. | `{"supported": true, "code": "spa_Latn"}` (spa), `{"supported": true, "code": "yor_Latn"}` (yor), `{"supported": false}` (crk) |
| `.llm` | `object` | API verification | General LLM-based translation. | `{"supported": true}` (all example cards) |

### 7.4 `metricModelSupport`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `metricModelSupport` | `object \| null` | enrich-metric-model-support.mjs | Which MT evaluation models produce reliable scores. Drives automatic model selection in `metrics_comet.py`. | See sub-fields below |
| `.xlmr` | `object \| null` | XLM-R training data analysis | XLM-R quality tier: `"high"`, `"medium"`, `"low"`. High = well-represented, standard COMET is reliable. | `{"tier": "high", "note": "Top-100 XLM-R training language by CommonCrawl volume"}` (cmn, spa) |
| `.africomet` | `object \| null` | AfriCOMET | Whether AfriCOMET covers this language. When true, AfriCOMET is preferred over standard COMET. | `{"supported": true, "model": "masakhane/africomet-mtl"}` (yor), `null` (crk) |

### 7.5 `metricPlugins`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `metricPlugins` | `object \| null` | Derived | Declares which per-language metric plugin resource packs are available. Each key is a plugin pack name, value is `true` if a resource file exists at `plugins/resources/{packName}/{code}.json`. | `null` (all example cards) |

### 7.6 `omt1600`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `omt1600` | `object \| null` | Manual | Meta OMT-1600 benchmark coverage. | See sub-fields below |
| `.covered` | `boolean` | Manual | Whether the language is covered by OMT-1600. | `true` (crk, spa, yor) |
| `.tier` | `string \| null` | Manual | Resource tier in OMT-1600 (`"R1"` high-resource through `"R5"` very-low-resource). | `"R1"` (crk), `"R3"` (yor), `"R5"` (spa) |
| `.evalMetrics` | `array` | Manual | Evaluation metrics used. | `["chrF++", "BLASER-3"]` (all) |
| `.notes` | `string \| null` | Manual | Context notes. | `"Plains Cree: no web-crawled bitext..."` (crk) |

---

## 8. Sociolinguistic

Formality, gender, register presets, code-switching, and contact influences.

### 8.1 `formality`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `formality` | `object \| null` | Manual, WALS 45A (Helmbrecht) | Structured description of the formality system. Null for languages with no formal/informal distinction. | See sub-fields below |
| `.system` | `string` | Manual / WALS | Category of formality system. Examples: `"T-V"`, `"speech-levels"`, `"keigo"`, `"register-levels"`, `"none"`. | `"T-V"` (spa), `"register-levels"` (cmn, crk, yor) |
| `.description` | `string` | Manual | Human-readable explanation of how formality works, written for a developer. | `"Spanish has a complex T-V system that varies by region..."` (spa) |
| `.default` | `string` | Manual | Register preset key to use by default. Must match a key in `registers`. | `"neutral-latam"` (spa), `"professional"` (cmn, yor), `"standard"` (crk) |

### 8.2 `gender`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `gender` | `object \| null` | Manual, WALS 44A | Grammatical gender information. Null if not applicable. | See sub-fields below |
| `.grammatical` | `boolean` | Manual / WALS | Whether the language has grammatical gender. **Required.** | `true` (spa), `false` (cmn, yor) |
| `.inclusiveGuidance` | `string \| null` | Manual | Guidance for gender-inclusive language, injected into register prompts. | `"Spanish has grammatical gender. For inclusive language, avoid gendered defaults..."` (spa) |

### 8.3 `registers`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `registers` | `object` | Manual | Named register presets. Keys are preset identifiers. At least one required when present. Each preset has `label`, `description`, `prompt`, and optional `deeplFormality`. | See below |
| `registers.{key}.label` | `string` | Manual | Short display label shown in CLI. | `"Neutro (Latin American)"` (spa: `neutral-latam`) |
| `registers.{key}.description` | `string` | Manual | One-sentence explanation of when to use this preset. | `"Standard for international Spanish-language products..."` (spa: `neutral-latam`) |
| `registers.{key}.prompt` | `string` | Manual | The register instruction injected into the LLM system prompt. This steers translation tone. | `"Neutral Latin American Spanish. Professional register using usted-form..."` (spa: `neutral-latam`) |
| `registers.{key}.deeplFormality` | `string` | Manual | DeepL API formality value: `"prefer_more"`, `"prefer_less"`, `"default"`. Only relevant when `deepl.formality` is `true`. | `"prefer_more"` (spa: `formal-usted`), `"prefer_less"` (spa: `informal-tu`) |

### 8.4 `codeSwitching`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `codeSwitching` | `object \| null` | Manual | Active code-switching patterns that affect MT I/O. Different from `contactInfluences` (historical). | `null` (cmn, crk, spa) |
| `.contactLanguage` | `string` | Manual | Contact language name. **Required.** | `"English"` (yor) |
| `.contactIso639_3` | `string \| null` | Manual | ISO 639-3 code of the contact language. | `"eng"` (yor) |
| `.mixedVarietyName` | `string \| null` | Manual | Named mixed variety (e.g., `"Jopará"`, `"Taglish"`, `"Hinglish"`). | `null` (yor) |
| `.prevalence` | `string` | Manual | How common code-switching is: `"rare"`, `"common"`, `"dominant"`. **Required.** | `"common"` (yor) |
| `.morphologicalIntegration` | `boolean` | Manual | Whether borrowed words take target-language morphology. **Required.** | `false` (yor) |
| `.pipelineStrategy` | `string \| null` | Manual | Recommended strategy: `"hybrid-fst"`, `"language-id-preprocessing"`, `"ignore"`. | `"ignore"` (yor) |

### 8.5 `contactInfluences`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `contactInfluences` | `array \| object \| null` | Manual, WOLD, SegBo, AfBo | Universal contact history — borrowing layers, superstrates, substrates. Affects ALL languages. | See sub-fields below |
| `[].source` | `string` | Manual / WOLD | Contact language name. **Required.** | `"French"` (crk), `"Arabic"` (yor) |
| `[].sourceIso639_3` | `string \| null` | Manual | ISO 639-3 code of the contact language. | `"fra"` (crk), `"ara"` (yor) |
| `[].type` | `string` | Manual / WOLD | Contact type: `"superstrate"`, `"substrate"`, `"adstrate"`, `"learned_borrowing"`, `"lexical_borrowing"`, `"relexification"`. **Required.** | `"superstrate"` (crk: English), `"lexical_borrowing"` (crk: French; yor: Arabic, Portuguese) |
| `[].domains` | `array` | Manual | Domains affected (e.g., `"legal"`, `"culinary"`, `"religious"`). | `["education", "government", "technology", "commerce"]` (crk: English) |
| `[].depth` | `string` | Manual / WOLD | Depth: `"light"`, `"moderate"`, `"heavy"`, `"structural"`, `"defining"`. **Required.** | `"deep"` (crk: English), `"moderate"` (crk: French; yor: Arabic), `"light"` (yor: Portuguese) |
| `[].period` | `string \| null` | Manual | Historical period. | `"1670–1870"` (crk: French), `"colonial + ongoing"` (yor: English) |
| `[].notes` | `string \| null` | Manual | Free-form notes. | `"Fur trade era borrowings, many fully nativized..."` (crk: French) |

### 8.6 `arealContext`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `arealContext` | `object \| null` | D-PLACE (Ethnographic Atlas), areal linguistics | Sprachbund membership, contact zones, ethnographic context. | See sub-fields below |
| `.dominantSubsistence` | `string` | D-PLACE EA042 | Dominant subsistence economy. | `"Hunting"` (crk), `"Intensive agriculture"` (cmn, spa) |
| `.settlementPattern` | `string` | D-PLACE EA030 | Settlement pattern. | `"Nomadic"` (crk), `"Villages/towns"` (cmn, spa) |
| `.politicalComplexity` | `string` | D-PLACE EA033 | Jurisdictional hierarchy level. | `"Acephalous"` (crk), `"Four levels"` (cmn), `"Three levels"` (spa) |
| `.communitySize` | `string` | D-PLACE EA031 | Mean community size. | `"Missing data"` (crk), `"50000+"` (cmn, spa) |
| `.dplaceRegion` | `string` | D-PLACE | Ethnographic region. | `"North-Central U.S.A."` (crk), `"China"` (cmn), `"Southwestern Europe"` (spa) |
| `.arealZone` | `string` | Manual / areal linguistics | Sprachbund or convergence area. | `"Mainland Southeast Asian Sprachbund"` (cmn) |
| `.arealFeatures` | `string` | Manual | Description of areal convergence features. | `"Tonal convergence, classifier systems, topic-prominence..."` (cmn) |
| `.contacts` | `array` | Manual | Areal contact descriptions. | (cmn has entries for Classical Chinese, Sanskrit/Pali) |

---

## 9. Linguistic Challenges

MT-relevant linguistic challenges for the language.

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `linguisticChallenges` | `object \| null` | Manual, WALS, Grambank, PHOIBLE | Keys are challenge IDs, values are description strings. Covers polysynthesis, animacy, tonal diacritics, tokenization, gender agreement, and more. | See examples below |

**Common challenge keys found across cards:**

| Key | Source(s) | Description | Example Value |
|-----|-----------|-------------|---------------|
| `polysynthesis` | Manual | Polysynthetic morphology challenges. | `"Cree is highly polysynthetic. A single verb can incorporate subject/object pronouns..."` (crk) |
| `animacy` | Manual | Animacy-based verb conjugation. | `"Verb conjugation changes completely based on whether the subject/object nouns are animate or inanimate."` (crk) |
| `tonalDiacritics` | Manual | Tonal diacritics are essential for disambiguation. | `"Yoruba has three lexical tones... 'ọkọ' without diacritics could mean husband, hoe, vehicle, or spear."` (yor) |
| `tokenization` | Manual | Word segmentation challenges. | `"Chinese has no spaces between words, making tokenization non-trivial."` (cmn) |
| `wordOrder` | WALS / Manual | Word order alignment with English. | `"SVO. Subject-Verb-Object order aligns well with English..."` (spa, yor, cmn) |
| `morphologicalComplexity` | WALS | Inflectional synthesis level. | `"High inflectional synthesis (WALS level 4: \"6-7 categories per word\")."` (crk, yor) |
| `genderAgreement` | WALS / Grambank | Grammatical gender agreement challenges. | `"Grammatical gender system (WALS: \"Two\"). Agreement patterns affect adjectives..."` (spa, crk) |
| `serialVerbs` | Grambank | Serial verb construction challenges. | `"Uses serial verb constructions (Grambank)."` (cmn, crk) |
| `reduplication` | WALS | Reduplication as a grammatical process. | `"Uses productive reduplication (WALS: \"Productive full and partial reduplication\")."` (cmn, crk, yor) |
| `scriptChallenges` | Derived from script properties | Script-specific processing challenges. | `"Canadian Aboriginal Syllabics: each symbol represents a consonant-vowel syllable..."` (crk) |
| `regionalVocabularyDivergence` | Manual | Vocabulary differences across regions. | `"Spanish has the largest regional vocabulary split of any European language..."` (spa) |
| `subjunctiveMood` | Manual | Subjunctive mood mapping challenges. | `"Spanish has a productive subjunctive mood..."` (spa) |

---

## 10. Cultural Context

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `culturalAphorism` | `object \| null` | Manual (verified) | An iconic proverb or saying from the language community. Must be a real, documented proverb — never fabricated. Null if no verifiable proverb is available. | See sub-fields below |
| `.text` | `string` | Manual | The aphorism in the original language/script. **Required.** | `"En boca cerrada no entran moscas"` (spa) |
| `.transliteration` | `string \| null` | Manual | Romanized form if non-Latin script. Null for Latin-script languages. | `"Xué wú zhǐ jìng"` (cmn), `null` (spa, crk, yor) |
| `.translation` | `string` | Manual | English translation. **Required.** | `"Flies don't enter a closed mouth"` (spa) |
| `.literal` | `string \| null` | Manual | Literal word-for-word translation if the idiomatic meaning differs significantly. | `"In mouth closed not enter flies"` (spa), `"Learning without end boundary"` (cmn) |
| `.source` | `string \| null` | Manual | Attribution or cultural context. | `"Traditional Spanish proverb (refrán). Documented in Correas, G. (1627)."` (spa) |
| `encyclopedic` | `object \| null` | Multiple (Wikidata, WALS, PHOIBLE, manual) | Encyclopedic metadata: family, demographics, dialect information, typological summary, resource links. Free-form structure. | Contains sub-objects: `typology`, `demographics`, `dialects`, `history`, `resources`, `wikidataDescription`, `phonology` |

---

## 11. Enrichment Fields

Fields added during Waves III–IV data enrichment.

### 11.1 `colexificationProfile`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `colexificationProfile` | `object \| null` | CLICS³ | Cross-linguistic colexification data — which semantic concepts share the same word form. Null if not covered. 1,783 cards enriched. | See sub-fields below |
| `.conceptsDocumented` | `integer \| null` | CLICS³ | Number of Concepticon concept sets documented. | `2872` (cmn), `2516` (spa) |
| `.colexificationCount` | `integer \| null` | CLICS³ | Number of colexification pairs (meanings sharing a word form). | `443` (cmn), `530` (spa) |
| `.notableColexifications` | `array \| null` | CLICS³ | Notable colexification patterns as `{concepts: [A, B]}` pairs. | `[{"concepts": ["SMALL (NOT TALL)", "LOW"]}, {"concepts": ["HUSBAND", "WIFE"]}]` (cmn) |
| `.source` | `string \| null` | — | Data source identifier. | `"clics3-2020"` |

### 11.2 `numeralSystem`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `numeralSystem` | `object \| null` | Numeralbank (Chan's database) | Numeral system properties. Null if undocumented. 4,088 cards enriched. | See sub-fields below |
| `.base` | `integer \| null` | Numeralbank | Primary counting base (10 = decimal, 20 = vigesimal, 5 = quinary, etc.). | `10` (all example cards) |
| `.baseType` | `string \| null` | Numeralbank | Named base type: `"decimal"`, `"vigesimal"`, `"quinary"`, `"octal"`, `"duodecimal"`, `"senary"`, `"mixed"`, `"body-part"`, `"restricted"`. | `"decimal"` (all example cards) |
| `.highestDocumented` | `integer \| null` | Numeralbank | Highest numeral documented in the source data. | `2000` (all example cards) |
| `.bodyPartCounting` | `boolean \| null` | Numeralbank | Whether the language uses a body-part counting system. | `null` (all example cards) |
| `.source` | `string \| null` | — | Data source identifier. | `"numeralbank-channumerals"` |

### 11.3 `databaseCoverage`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `databaseCoverage` | `object \| null` | Derived | Coverage in major linguistic databases. Boolean flags for each database plus `totalDatabases` count. | `{"grambank": true, "wals": true, "phoible": false, "cldr": false, "linguameta": true, "opus": true, "totalDatabases": 4}` (crk) |

### 11.4 `documentationDepth`

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `documentationDepth` | `object \| null` | Glottolog (via OLAC) | Most Extensive Description (MED) level. Indicates depth of grammatical documentation. | See sub-fields below |
| `.med` | `string \| null` | Glottolog CLDF | MED category: `"long_grammar"`, `"grammar"`, `"grammar_sketch"`, `"phonology"`, `"wordlist"`. | `"long_grammar"` (all example cards) |
| `.medLevel` | `integer \| null` | Glottolog CLDF | Numeric MED level (0 = highest documentation). | `0` (all example cards) |
| `.source` | `string \| null` | — | Data source. | `"glottolog-5.3"` |

---

## 12. Internal Fields

Fields used for provenance tracking, generation metadata, and internal pipeline state. Not typically consumed by downstream users.

### 12.1 Provenance

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `dataSources` | `array \| null` | All enrichment scripts | Provenance tracking — which data sources contributed to this card. Required for license compliance. | `["iso639-3-2024", "glottolog-5.3", "wikidata", "wals-2024", "linguameta-2024", ...]` (cmn — 49 sources) |
| `_fieldSources` | `object` | All enrichment scripts | Per-field provenance. Maps each card field to the data source(s) that populated it. Machine-verifiable — enforced by the test suite. | `{"code": "iso639-3-2024", "classification": "glottolog-5.3", "nativeName": "wikidata-P1705", "numeralSystem": "numeralbank-channumerals", ...}` |

### 12.2 Generation Metadata

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `_generated` | `object \| null` | Generation scripts | Generation metadata for auto-generated cards: `by` (script name), `at` (ISO 8601 timestamp), `sources` (data sources used), `completeness`, `lastEnriched`, `derivedFields`. Null for hand-curated cards. | `{"by": "generate-all-cards.mjs", "at": "2026-06-07T07:16:44.778Z", "sources": ["iso639-3", "glottolog-5.3", "wikidata"], "completeness": "substantial"}` (cmn) |
| `_migration` | `object \| null` | Migration scripts | Migration metadata. Records `mergedFrom` / `previousCode` and `mergedAt` / `migratedAt` when cards were consolidated or renamed. | `{"mergedFrom": "zh", "mergedAt": "2026-06-08T03:26:23.376Z"}` (cmn), `{"previousCode": "es", "migratedAt": "2026-06-07T07:16:44.778Z"}` (spa) |

### 12.3 Status & Geography

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `supportTier` | `string \| null` | Derived | Champollion support tier: `"supported"`, `"experimental"`, `"cataloged"`, `"community"`, or `null`. | `"supported"` (spa, yor), `"developing"` (cmn, crk) |
| `countries` | `array` | Glottolog 5.3 | ISO 3166-1 alpha-2 country codes where the language is spoken. | `["CA", "US"]` (crk), `["BJ", "NG"]` (yor), `["CN", "KP", "LA", "MM", "MN", "RU", "TW", "VN"]` (cmn) |
| `coordinates` | `object \| null` | Glottolog 5.3 | Geographic coordinates of the language's primary area: `lat` (latitude), `lng` (longitude), `source`. | `{"lat": 7.15345, "lng": 3.67225, "source": "glottolog-5.3"}` (yor), `null` (crk) |
| `regions` | `array \| null` | Manual | Detailed geographic regions where the language is spoken. Each entry has `country`, `countryCode`, `officialStatus`, optional `region`, `speakerEstimate`, `coordinates` [lon, lat], `admin1Codes`. | `[{"country": "Canada", "countryCode": "CA", "officialStatus": "recognized", "region": "Saskatchewan, Alberta, Manitoba", "speakerEstimate": "~20,000", "coordinates": [-106.6, 52.1], "admin1Codes": ["CA-SK", "CA-AB", "CA-MB"]}]` (crk) |
| `varieties` | `array \| null` | Manual | Major dialect/variety differences relevant to MT. Each entry has `name`, optional `iso639_3`, `region`, `fstCoverage`, `corpusCoverage`, `nllbCoverage`, `mutualIntelligibility`, `notes`. | `[]` (all example cards currently empty) |

### 12.4 Other Internal Fields

| Field | Type | Source(s) | Description | Example |
|-------|------|-----------|-------------|---------|
| `humanReviewed` | `object \| null` | Manual | Whether the card has been reviewed by a human. Contains `reviewed` (boolean), `reviewer` (GitHub handle), `date` (ISO 8601). Null if not yet reviewed. | `null` (all example cards) |
| `firstDocumented` | `string \| null` | Manual | ISO 8601 date when this card was first created. | `null` (all example cards) |
| `lastDocumented` | `string \| null` | Manual | ISO 8601 date when this card was last significantly updated. | `null` (all example cards) |
| `notes` | `string \| null` | Manual | Free-form notes for developers and contributors. | `"Low-resource language under active development..."` (crk) |
| `rules` | `object \| null` | Manual | Executable rules for typography (`quoteStart`, `quoteEnd`, `usesSpaces`, `punctuationSpacing`), plurals (`categories`, `guidance`), capitalization (`hasCase`, `uiConventions`), and variables (`syntax`, `guidance`). | `{"typography": {"quoteStart": "\"", "quoteEnd": "\"", "usesSpaces": true}, "capitalization": {"hasCase": true}, "plurals": {"categories": ["one", "many", "other"]}}` (spa) |

---

## Source Label Conventions

Source labels in `_fieldSources` follow the format `<database-name>-<version>[-<component>]`:

| Label | Meaning |
|-------|---------|
| `iso639-3-2024` | ISO 639-3 Registration Authority (2024) |
| `glottolog-5.3` | Glottolog version 5.3 |
| `glottolog-5.x-languoid` | Glottolog 5.x, languoid component |
| `wikidata-P1705` | Wikidata native label property |
| `wikidata-P282` | Wikidata writing system property |
| `linguameta-2024` | LinguaMeta (Google Research 2024) |
| `grambank-1.0.3` | Grambank v1.0.3 (Skirgård et al. 2023) |
| `wals-2024` | WALS Online (Dryer & Haspelmath) |
| `phoible-2.0` | PHOIBLE 2.0 (Moran & McCloy) |
| `numeralbank-channumerals` | Numeralbank / Chan's Numeral Systems |
| `clics3-2020` | CLICS³ (Rzymski et al. 2020) |
| `dplace-ea-2016` | D-PLACE Ethnographic Atlas |
| `autotyp-2023` | AUTOTYP (Bickel et al. 2023) |
| `opus-nlpl-api` | OPUS parallel corpus API |
| `keyman-api` | Keyman keyboard database |
| `common-voice-20.0` | Mozilla Common Voice v20.0 |
| `paradisec-olac-2026` | PARADISEC via OAI-PMH |
| `olac-aggregator-2026` | OLAC aggregator harvest |
| `asjp-v20` | ASJP v20 (Wichmann et al.) |
| `derived-from-script` | Computed from `script` field |
| `derived-from-coordinates` | Computed from `coordinates` field |
| `manual-curation` | Hand-written by human contributor |
| `manual-curation-verified` | Hand-written and independently verified |
| `api-verification-2026` | Verified against live API (2026) |
