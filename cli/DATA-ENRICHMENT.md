# Champollion Data Enrichment: Philosophy & Procedure

> **Version:** 1.1  
> **Date:** 2026-06-09  
> **Status:** Canonical reference document  
> **Audience:** Contributors, linguists, data engineers, reviewers

---

## Current State (as of 2026-06-11)

The Champollion language card corpus contains **7,927 cards** covering individual languages, macrolanguages, genera, families, and conlangs. Each card conforms to `language-card.schema.json` and carries per-field provenance via `_fieldSources`. (Seven macrolanguage cards — ara, fas, msa, nor, sqi, swa, zho — were retired in the 2026-06-10 v1 purge; their content lives on the individual-language cards and `generate-all-cards.mjs` skips them via `PURGED_MACROLANGUAGES`.)

**Lexibank batch — 143 datasets** (2026-06-10): A bulk ingest via `batch-ingest-zenodo.mjs` → `ingest-cldf.mjs` added 143 CLDF datasets (Lexibank + cldf-datasets orgs) to the facts database. As of 2026-06-11 the database holds **3,972,494 facts** from **271 distinct sources** across **7,965 languages** (queries: `SELECT COUNT(*) FROM facts;` and `SELECT COUNT(DISTINCT source) FROM facts;`). Card-level Lexibank coverage was refreshed from the database via `enrich-corpus-availability.mjs --refresh-lexibank-from-db` (1,124 cards gained `corpusAvailability.lexibank`, 1,213 saw dataset counts increase).

**v2 Database Ingestion** (2026-06-09, (the current database uses the Lexibank batch above)): The v2 SQLite database (`cli/data/champollion.db`) at that point contained **1,793,337 facts** from **32 distinct sources** (plus 514 v1 card provenance chains) across **7,965 languages**, ingested via the universal CLDF ingester (`ingest-cldf.mjs`), CLICS³ custom ingester (`ingest-clics3.mjs`), and v1 card backfill (`backfill-from-cards.mjs`). Top sources by volume: ASJP (299K), IDS (243K), ABVD (157K), Numeralbank (136K), AUTOTYP (120K), v1 backfill (118K), ACD (109K), NorthEuraLex (98K), WALS (75K), D-PLACE (71K), HunterGatherer (59K 🔴 LRL), WOLD (52K), DIACL (37K), BowernPNY (35K 🔴 LRL), Grambank (34K), SAILS (31K 🔴 LRL), UraLex (27K 🔴 LRL), ElCat (22K), UraTyp (19K 🔴 LRL), APiCS (15K), SagartST (13K), VanuatuVoices (10K 🔴 LRL), CLICS³ (9K), SAPhon (9K 🔴 LRL), eWAVE (5K), CrossAndean (4K 🔴 LRL), WACL (3K), PapuanVoices (2K 🔴 LRL), SegBo (2K), AfBo (354), TonoDB (143), reference-grammar (180). See `docs/DATA-ARCHITECTURE.md` for the full data architecture.

**Decontamination** (2026-06-09): Two contaminated enrichment scripts (`enrich-grambank-typology.mjs`, `enrich-from-typology.mjs`) were deleted and 2,322 cards were decontaminated. Fields `hasGenderSystem`, `hasCaseMorphology`, `hasToneSystem`, `hasEvidentiality` were set to `null` where sourced from grambank. See `decontaminate-grambank-fields.mjs` for the audit trail.

**Waves III–IV enrichment** (2026-06-07) added data from 18+ databases including Numeralbank (4,088 cards enriched), D-PLACE Ethnographic Atlas (1,018 cards), CLICS³ colexifications (1,783 cards), AUTOTYP head/dependent marking (316 cards), SegBo borrowed phonemes (492 cards), PARADISEC archive holdings (1,013 cards), ABVD/NorthEuraLex lexical databases (841 + 103 cards), and OLAC/Rosetta Project/Kaipuleohone/AILLA archive presence across thousands of cards.

**Key fill rates** (§5.1): `typologicalProfile` is the best-covered structural field. `phonologicalInventory` covers 26.3% (2,083 cards). `nativeName` covers 22.8% (1,805 cards). The sparsest fields remain `codeSwitching` (3 cards), `culturalAphorism` (104 cards), and `gender` (446 cards). The test suite enforces schema compliance and provenance integrity across all 7,929 cards (244 suites, 37,413+ tests).

For the full field reference, see [LANGUAGE-CARD-FIELDS.md](shared/LANGUAGE-CARD-FIELDS.md). For license obligations, see [ATTRIBUTION.md](shared/ATTRIBUTION.md).

---

## 1. Guiding Philosophy

### 1.1 The Maximin Principle

Champollion's data enrichment program follows the **maximin principle** from distributive justice (Rawls 1971): we maximize the minimum knowledge available about the world's languages. In practice this means:

1. **Prioritise the least-documented.** A single authoritative fact about an unwritten Papuan language is worth more than a tenth metadata field about French.
2. **Never fabricate.** No field should be populated unless it traces to a citable, auditable source. An honest `null` is infinitely better than a plausible guess.
3. **Never displace.** Enrichment is *additive*. Existing curated data must never be overwritten by automated enrichment. New data is *merged alongside*, not substituted.

### 1.2 The Card as Linguistic Passport

Each language card is a **machine-readable record of what is known** about a language's structure, status, resources, and challenges for machine translation. It is not an encyclopedia article — it is a *decision-support document* for MT researchers, corpus builders, and language technologists.

The card answers questions like:
- What is the typological profile of this language? (word order, morphological type, alignment)
- How endangered is it, and by what assessments?
- What corpora, treebanks, and lexical databases exist?
- What phonological and orthographic challenges will MT systems face?
- What formality registers exist, and which should be used by default?

### 1.3 The Provenance Contract

Every fact on a card must satisfy the **provenance contract**:

```
For any field F on card C:
  C._fieldSources[F] identifies the authoritative source
  C.dataSources[] includes the database that contributed F
  The source is documented in shared/ATTRIBUTION.md with license
```

This contract is machine-verifiable. The test suite enforces `_fieldSources` presence. The `dataSources` array enables consumers to filter by provenance.

### 1.4 The Hierarchy of Evidence

When multiple sources provide data for the same field, we apply the following hierarchy:

| Tier | Source Type | Example | Treatment |
|------|-----------|---------|-----------|
| **1 — Primary** | Peer-reviewed linguistic databases | Grambank, WALS, PHOIBLE | Highest trust. Used directly. |
| **2 — Institutional** | Standards bodies & catalogues | ISO 639-3, CLDR, Glottolog, ElCat | High trust. Used directly. |
| **3 — Aggregated** | Community-curated databases | LinguaMeta, OPUS, Tatoeba, Wikipedia | Medium trust. Cross-referenced. |
| **4 — Derived** | Computed from Tier 1–3 data | `derive-*.mjs` scripts | Trust inherits from input sources. Marked `_derived: true`. |
| **5 — Manual** | Human expert curation | Hand-written register files, culturalAphorisms | Highest-quality but sparse. Marked `humanReviewed: true`. |

Lower-tier data **never overwrites** higher-tier data. Tier 4 (derived) fields explicitly note their derivation method.

### 1.5 CLDF: The Universal Data Standard

The majority of our external data sources use **Cross-Linguistic Data Formats** ([CLDF](https://cldf.clld.org/)) — the de facto interchange standard for comparative linguistics data, created by the Max Planck Institute for Evolutionary Anthropology. CLDF is not incidental to our pipeline — it is the **architectural foundation** of our data ingestion strategy.

**Key facts:**
- **30+ of our 35 data directories** use CLDF format
- Every CLDF dataset includes `cldf-metadata.json` (machine-readable schema), `languages.csv` (with Glottocodes/ISO codes), `parameters.csv` (feature definitions), and `sources.bib` (full BibTeX citations)
- A **single universal ingester** (`ingest-cldf.mjs`) can parse any CLDF dataset by reading its metadata — no dataset-specific parsing code required
- CLDF provides built-in provenance (citation per data point) that maps directly to our provenance contract (§1.3)

**Citation:** Forkel, R., List, J.-M., Greenhill, S.J., Rzymski, C., Bank, S., Cysouw, M., Hammarström, H., Haspelmath, M., Kaiping, G.A., & Gray, R.D. (2018). Cross-Linguistic Data Formats, advancing data sharing and re-use in comparative linguistics. *Scientific Data*, 5, 180205. https://doi.org/10.1038/sdata.2018.205

**For full data architecture details** — including the v2 SQLite database schema, complete data directory inventory, ingestion rules, and the CLDF ingester design — see `docs/DATA-ARCHITECTURE.md`.

---

## 2. Data Sources — Authoritative Citations

### 2.1 Peer-Reviewed Typological Databases

**Grambank**
- **Citation:** Skirgård, H., Haynie, H.J., Blasi, D.E., Hammarström, H., Collins, J., Latarche, J., ... & Gray, R.D. (2023). Grambank reveals the importance of genealogical constraints on linguistic diversity and highlights the impact of language loss. *Science Advances*, 9(16), eadg6175. https://doi.org/10.1126/sciadv.adg6175
- **Coverage:** 2,467 languages, 195 binary structural features
- **License:** CC BY 4.0
- **What we extract:** Morphological type, word order, case marking, politeness markers (GB415), nominal gender (GB103-106), ergativity, tone, evidentiality. *Wave II additions:* obligatory number marking (GB024), noun classifiers (GB522)
- **Card fields populated:** `typologicalProfile` (including `obligatoryNumberMarking`, `hasNounClassifiers`), `formality`, `gender`, `linguisticChallenges`

**WALS (World Atlas of Language Structures)**
- **Citation:** Dryer, M.S. & Haspelmath, M. (eds.) (2013). *WALS Online (v2020)*. Max Planck Institute for Evolutionary Anthropology. https://wals.info
- **Coverage:** 2,662 languages, 192 typological features
- **License:** CC BY 4.0
- **What we extract:** Word order (81A, 82A, 83A, 85A, 86A, 87A), morphological type (26A), nominal categories, phonological features. *Wave II additions:* numeral classifiers (55A), number of cases (49A), number of genders (30A), prefixing vs. suffixing (26A), ordinal numerals (53A), numeral-noun order (89A)
- **Card fields populated:** `typologicalProfile` (wordOrder, hasNumeralClassifiers, caseCount, genderCount, inflectionalStrategy, ordinalNumerals), `encyclopedic`, `phonologicalInventory`

**PHOIBLE**
- **Citation:** Moran, S. & McCloy, D. (eds.) (2019). *PHOIBLE 2.0*. Max Planck Institute for the Science of Human History. https://phoible.org
- **Coverage:** 2,186 distinct languages, 3,020 inventories
- **License:** CC BY-SA 3.0
- **What we extract:** Phoneme inventories, consonant/vowel counts, tonal status, click consonants
- **Card fields populated:** `phonologicalInventory`

### 2.2 Institutional Standards & Catalogues

**Glottolog**
- **Citation:** Hammarström, H., Forkel, R., Haspelmath, M., & Bank, S. (2024). *Glottolog 5.0*. Max Planck Institute for Evolutionary Anthropology. https://glottolog.org
- **Coverage:** 8,618 languages, 4,853 families, 13,706 dialects
- **License:** CC BY 4.0
- **What we extract:** Classification tree, Glottocodes, family hierarchy, macroarea, coordinates, countries, dialect counts, Agglomerated Endangerment Status (AES), documentation dates
- **Card fields populated:** `classification`, `glottocode`, `macroarea`, `coordinates`, `countries`, `dialectCount`, `vitality`, `firstDocumented`, `lastDocumented`
- **Editions used:** languoid.csv (classification + dialects), cldf-languages.csv (metadata + documentation), aes-values.csv (endangerment)

**CLDR (Common Locale Data Repository)**
- **Citation:** Unicode Consortium (2024). *Unicode CLDR v46*. https://cldr.unicode.org
- **Coverage:** 323+ locales with structured data
- **License:** Unicode Terms of Use (freely usable)
- **What we extract:** Script metadata, plural rules, text direction, formality conventions, native names, number formatting, collation
- **Card fields populated:** `script`, `dir`, `nativeName`, `formality`

**ISO 639-3**
- **Citation:** SIL International (2024). *ISO 639-3 Registration Authority*. https://iso639-3.sil.org
- **Coverage:** 7,920+ language codes
- **License:** Free to use
- **What we extract:** Language codes, scope (Individual/Macro/Special), type (Living/Extinct/Ancient/Historical/Constructed), macrolanguage membership
- **Card fields populated:** `code`, `iso639_3`, `isoScope`, `isoType`, `macrolanguage`

**OLAC (Open Language Archives Community)**
- **Citation:** Simons, G.F. & Bird, S. (2003). The Open Language Archives Community: An Infrastructure for Distributed Archiving of Language Resources. *Literary and Linguistic Computing*, 18(2), 117–128. https://doi.org/10.1093/llc/18.2.117; See also: http://www.language-archives.org
- **Coverage:** 400,000+ metadata records across 65+ participating archives, covering 7,000+ ISO 639-3 languages
- **License:** Metadata freely accessible via OAI-PMH protocol
- **What we extract:** MED (Most Extensive Description) classification via Glottolog's integration of OLAC data (Hammarström & Nordhoff 2011). The MED scale classifies documentation depth: long_grammar (0), grammar (1), grammar_sketch (2), phonology_or_text (3), wordlist_or_less (4). Resource counts per category (primary texts, lexical resources, language descriptions) are available via per-language pages.
- **Card fields populated:** `documentationDepth.med`, `documentationDepth.medLevel` (via Glottolog CLDF)
- **Note:** OLAC data is consumed indirectly through Glottolog's curation. Direct resource counts from OLAC language pages are a potential future enrichment target for `corpusAvailability`.

**ElCat (Endangered Languages Catalogue)**
- **Citation:** Campbell, L., Lee, N.H., Okura, E., Simpson, S., & Ueki, K. (2022). *Catalogue of Endangered Languages*. University of Hawaiʻi at Mānoa. http://endangeredlanguages.com
- **Coverage:** 3,378+ endangered languages with structured vitality assessments
- **License:** CC BY 4.0
- **What we extract:** Endangerment status, intergenerational transmission, domains of use, speaker number trends, alternate names, descriptive comments
- **Card fields populated:** `vitality`, `alternateNames`, `encyclopedic`

### 2.3 Community-Curated & Aggregated Sources

**LinguaMeta**
- **Citation:** Google Research (2024). *LinguaMeta*. https://github.com/AetherPrior/LinguaMeta
- **Coverage:** 7,511 languages with structured metadata
- **License:** Apache 2.0
- **What we extract:** Writing systems (ISO 15924 codes), speaker estimates, endangerment status, Wikidata descriptions, CLDR official status, macrolanguage mapping
- **Card fields populated:** `scripts`, `script`, `dir`, `speakerEstimates`, `vitality`, `encyclopedic`

**OPUS (Open Parallel Corpus)**
- **Citation:** Tiedemann, J. (2012). Parallel Data, Tools and Interfaces in OPUS. In *Proceedings of LREC 2012*. http://opus.nlpl.eu
- **Coverage:** 700+ language pairs
- **License:** Various (per-corpus)
- **What we extract:** Parallel corpus availability, sentence pair counts, corpus names
- **Card fields populated:** `corpusAvailability`, `resources`

**Tatoeba**
- **Citation:** Tatoeba Project (2024). *Tatoeba: Collection of sentences and translations*. https://tatoeba.org
- **Coverage:** 428 languages with sentence data
- **License:** CC BY 2.0 France
- **What we extract:** Sentence counts per language
- **Card fields populated:** `digitalPresence`

**Wikipedia / MediaWiki**
- **Citation:** Wikimedia Foundation (2024). *MediaWiki API: SiteInfo statistics*. https://www.mediawiki.org/wiki/API:Siteinfo
- **Coverage:** 330+ language editions
- **License:** CC BY-SA 3.0 / GFDL
- **What we extract:** Article counts, active editors, page statistics
- **Card fields populated:** `digitalPresence`

**Universal Dependencies**
- **Citation:** de Marneffe, M.-C., Manning, C.D., Nivre, J., & Zeman, D. (2021). Universal Dependencies. *Computational Linguistics*, 47(2), 255–308. https://doi.org/10.1162/coli_a_00402
- **Coverage:** 150+ languages with morpho-syntactic treebanks
- **License:** Various (per-treebank, mostly CC)
- **What we extract:** Treebank availability, sentence/token counts
- **Card fields populated:** `corpusAvailability`, `resources`

**WOLD (World Loanword Database)**
- **Citation:** Haspelmath, M. & Tadmor, U. (eds.) (2009). *Loanwords in the World's Languages: A Comparative Handbook*. De Gruyter Mouton. https://wold.clld.org
- **Coverage:** 41 languages with borrowing source data
- **License:** CC BY 4.0
- **What we extract:** Contact language influences, borrowing proportions, donor languages
- **Card fields populated:** `contactInfluences`

**APICS (Atlas of Pidgin and Creole Language Structures)**
- **Citation:** Michaelis, S.M., Maurer, P., Haspelmath, M., & Huber, M. (eds.) (2013). *Atlas of Pidgin and Creole Language Structures Online*. Max Planck Institute for Evolutionary Anthropology. https://apics-online.info
- **Coverage:** 76 pidgin and creole languages, 130 structural features
- **License:** CC BY 4.0
- **What we extract:** Structural features for contact languages, substrate/superstrate identification
- **Card fields populated:** `typologicalProfile`, `contactInfluences`

**Numeralbank (Chan's Numeral Systems of the World's Languages)**
- **Citation:** Chan, E. (2019). *Numeral Systems of the World's Languages*. Max Planck Institute for Evolutionary Anthropology. https://github.com/numeralbank/channumerals; See also: Hammarström, H. (2010). Rarities in Numeral Systems. In *Rethinking Universals* (pp. 11–59). De Gruyter Mouton.
- **Coverage:** 5,332 language entries, 4,169 unique Glottocodes, documenting numeral forms from 1 to 1,000,000+
- **License:** CC BY 4.0
- **What we extract:** Counting base type (decimal, vigesimal, quinary, restricted, etc.), highest documented numeral, body-part counting indicators. Base type inferred from documented numeral range and confirmed against source Comment field where vigesimal/quinary/senary systems are explicitly noted.
- **Card fields populated:** `numeralSystem`
- **Match rate:** 4,088 of our cards enriched

**D-PLACE (Ethnographic Atlas)**
- **Citation:** Kirby, K.R., Gray, R.D., Greenhill, S.J., Jordan, F.M., Gomes-Ng, S., Bibiko, H.-J., ... & Gavin, M.C. (2016). D-PLACE: A Global Database of Cultural, Linguistic and Environmental Diversity. *PLoS ONE*, 11(7), e0158391. https://doi.org/10.1371/journal.pone.0158391; Data originally from: Murdock, G.P. (1967). *Ethnographic Atlas*.
- **Coverage:** 1,291 societies mapped to 1,209 Glottocodes, 94 cultural/ecological variables
- **License:** CC BY-NC 4.0
- **What we extract:** Dominant subsistence economy (EA042), settlement patterns (EA030), jurisdictional hierarchy beyond local community (EA033), mean community size (EA031), ethnographic region
- **Card fields populated:** `arealContext.dominantSubsistence`, `arealContext.settlementPattern`, `arealContext.politicalComplexity`, `arealContext.communitySize`, `arealContext.dplaceRegion`
- **Match rate:** 1,018 of our cards enriched

**AUTOTYP (Typological Database of the University of Zürich)**
- **Citation:** Bickel, B., Nichols, J., Zakharko, T., Witzlack-Makarevich, A., Hildebrandt, K., Rießler, M., Biber, H., Zakharko, T., & Jäger, G. (2023). *AUTOTYP*. Version 1.0.0. University of Zürich. https://github.com/autotyp/autotyp-data. https://doi.org/10.5281/zenodo.7976754
- **Coverage:** 3,054 language registers, 2,829 unique Glottocodes, covering morphology and argument structure
- **License:** CC BY 4.0
- **What we extract:** Locus of marking for S and A arguments (head vs. dependent marking)
- **Card fields populated:** `typologicalProfile.headMarking`, `typologicalProfile.dependentMarking`
- **Match rate:** 316 of our cards enriched (new data not already in Grambank)

**SegBo (Segment Borrowing Database)**
- **Citation:** Grossman, E., Round, E., Zariquiey, R., & Grieve, J. (2020). *SegBo: A Database of Borrowed Sounds in the World's Languages*. https://github.com/segbo-db/segbo
- **Coverage:** 1,662 borrowed phoneme entries across 492 language inventories
- **License:** CC BY 4.0
- **What we extract:** Borrowed phonemes with donor language identification (Glottocode), result type (new phoneme, new distinction), and phoneme class
- **Card fields populated:** `contactInfluences[].borrowedPhonemes`, `contactInfluences[].contactLanguage`
- **Match rate:** 492 of our cards enriched

**ABVD (Austronesian Basic Vocabulary Database)**
- **Citation:** Greenhill, S.J., Blust, R., & Gray, R.D. (2008). The Austronesian Basic Vocabulary Database: From Bioinformatics to Lexomics. *Evolutionary Bioinformatics*, 4, 271–283. https://doi.org/10.4137/EBO.S893; Via Lexibank: https://github.com/lexibank/abvd
- **Coverage:** 2,036 language entries, 1,046 Glottocodes, 210-item Swadesh list
- **License:** CC BY 4.0
- **What we extract:** Lexical resource availability indicator with concept count
- **Card fields populated:** `resources[]` (type: lexical-database)
- **Match rate:** 841 of our cards enriched

**CLICS³ (Database of Cross-Linguistic Colexifications)**
- **Citation:** Rzymski, C., Tresoldi, T., Greenhill, S.J., Wu, M.-S., Schweikhard, N.E., Koptjevskaja-Tamm, M., ... & List, J.-M. (2020). The Database of Cross-Linguistic Colexifications, reproducible analysis of cross-linguistic polysemies. *Scientific Data*, 7, 13. https://doi.org/10.1038/s41597-019-0341-x; https://clics.clld.org
- **Coverage:** 2,279 language varieties from 30 lexical datasets, 18,954 semantic concepts (Concepticon)
- **License:** CC BY 4.0
- **What we extract:** Number of Concepticon concept sets documented per language, colexification pair count (number of meaning pairs sharing the same word form), notable colexification examples (e.g., HAND ≡ ARM, BONE ≡ FATHER)
- **Card fields populated:** `colexificationProfile`
- **Match rate:** 1,783 of our cards enriched (1,600 with colexification counts and examples)

**NorthEuraLex**
- **Citation:** Dellert, J., Daneyko, T., Münch, A., Leibber, A., Archambault, C., Klementyev, A., Novotná, M., & Jäger, G. (2020). NorthEuraLex: A wide-coverage lexical database of Northern Eurasia. *Language Resources and Evaluation*, 54, 273–301. https://doi.org/10.1007/s10579-019-09480-6; Via Lexibank: https://github.com/lexibank/northeuralex
- **Coverage:** 107 Northern Eurasian languages, ~1,016 concepts
- **License:** CC BY 4.0
- **What we extract:** Lexical resource availability indicator with concept count
- **Card fields populated:** `resources[]` (type: lexical-database)
- **Match rate:** 103 of our cards enriched

### 2.3a NLP Community Catalogs

**Masakhane**
- **Citation:** Nekoto, W., Marivate, V., Matsila, T., Fasubaa, T., Kolawole, T., Fagbohungbe, T., ... & Niyongabo, R.A. (2020). Participatory Research for Low-resourced Machine Translation: A Case Study in African Languages. In *Findings of EMNLP 2020*. https://doi.org/10.18653/v1/2020.findings-emnlp.195; https://github.com/masakhane-io
- **Coverage:** 37+ African languages (MT benchmarks), 12 languages (NER)
- **License:** Various (per-benchmark)
- **What we extract:** NLP benchmark availability indicator (MT, NER task coverage)
- **Card fields populated:** `resources[]` (type: nlp-benchmark)

**IndicNLP (AI4Bharat)**
- **Citation:** Kunchukuttan, A. (2020). *The IndicNLP Catalog*. AI4Bharat. https://indicnlp.ai4bharat.org
- **Coverage:** 14 scheduled Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi, Assamese, Nepali, Sanskrit, Urdu)
- **License:** Various (per-dataset)
- **What we extract:** NLP resource catalog availability indicator
- **Card fields populated:** `resources[]` (type: nlp-benchmark)

**AmericasNLP**
- **Citation:** Mager, M., Gutierrez-Vasques, X., Coto-Solano, R., & Meza Ruiz, I.V. (2021). AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas. In *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*. https://doi.org/10.18653/v1/2021.americasnlp-1.23
- **Coverage:** 13 Indigenous American languages (Quechua, Guaraní, Nahuatl, Bribri, Asháninka, Wixárika, Rarámuri, Shipibo-Konibo, Otomí, Aymara, etc.)
- **License:** CC BY (shared task data)
- **What we extract:** NLP shared task availability indicator
- **Card fields populated:** `resources[]` (type: nlp-benchmark)

### 2.3b Language Archives

**PARADISEC (Pacific And Regional Archive for Digital Sources in Endangered Cultures)**
- **Citation:** Thieberger, N. & Barwick, L. (2012). Keeping Records of Language Diversity in Melanesia: The Pacific and Regional Archive for Digital Sources in Endangered Cultures (PARADISEC). In *Melanesian Languages on the Edge of Asia: Challenges for the 21st Century* (pp. 239–253). University of Hawaiʻi Press. https://catalog.paradisec.org.au
- **Coverage:** 150,000+ items across 1,000+ ISO 639-3 languages (we harvested 10,000 records via OAI-PMH with OLAC metadata, yielding 1,029 unique language codes)
- **License:** Metadata freely accessible via OAI-PMH protocol (content access restricted to depositors)
- **Harvest method:** OAI-PMH ListRecords with `metadataPrefix=olac`. ISO 639-3 codes extracted from `<dc:subject xsi:type="olac:language" olac:code="xxx"/>` elements. Media types inferred from `<dc:type>`.
- **What we extract:** Archive item counts per language, media type availability (audio, video, text, image), collection counts
- **Card fields populated:** `archivePresence`
- **Match rate:** 1,013 of our cards enriched

### 2.4 Derived Data

Derived fields are computed from Tier 1–3 data by `derive-*.mjs` scripts. Each derived field:
- Documents its input fields and their sources in the header comment
- Sets `_fieldSources` to `"derived-from-<inputs>"`
- Never overwrites existing non-derived data
- Is idempotent and reproducible

| Derivation | Inputs | Output |
|-----------|--------|--------|
| `derive-encyclopedic-from-classification` | `classification`, `countries`, `speakerEstimates`, `vitality` | `encyclopedic.summary` |
| `derive-database-coverage` | Cross-ref against all local databases | `databaseCoverage` |
| `derive-challenges-from-existing` | `script`, `typologicalProfile`, `phonologicalInventory` | `linguisticChallenges` |
| `derive-registers-from-formality` | `formality`, Grambank GB415 | `registers`, `formality.default` |
| `derive-resources-from-coverage` | `corpusAvailability`, CLDR, NLLB, FLORES | `resources` |
| `derive-card-fields` | Multiple card fields | `supportTier`, `completeness` |

---

## 3. Enrichment Procedure

### 3.1 Script Contract

Every enrichment script (`enrich-*.mjs`) and derivation script (`derive-*.mjs`) must satisfy:

```
1. IDEMPOTENCY    — Running twice produces identical results
2. MERGE-ONLY     — Never overwrites existing non-null data
3. DRY-RUN        — Supports --dry-run flag for preview
4. PROVENANCE     — Updates _fieldSources and dataSources
5. REPORTING      — Prints counts of modified/skipped/unmatched cards
6. SINGLE-LANG    — Supports --lang <code> for targeted debugging
```

### 3.2 Standard Enrichment Workflow

```
Step 1: Data Audit
  └─ Identify gaps: which cards are missing which fields?
  └─ Identify sources: which databases cover the gap?
  └─ Cross-reference: how many cards can be enriched?

Step 2: Script Development
  └─ Write script following the standard contract
  └─ Cite the data source in the script header
  └─ Implement proper CSV/TSV parsing for the source format
  └─ Map source fields to card schema fields

Step 3: Dry Run
  └─ node scripts/enrich-<source>.mjs --dry-run
  └─ Verify counts are reasonable
  └─ Spot-check examples for accuracy

Step 4: Live Run
  └─ node scripts/enrich-<source>.mjs
  └─ Verify output matches dry-run counts

Step 5: Verification
  └─ npm test (all 37,413+ tests must pass)
  └─ Spot-check 5+ enriched cards manually
  └─ Verify _fieldSources and dataSources are correct

Step 6: Attribution
  └─ Ensure source is listed in shared/ATTRIBUTION.md
  └─ Ensure license obligations are documented
```

### 3.3 Matching Strategy

Cards are matched to external databases via a prioritised key cascade:

```
1. ISO 639-3 code (card.code)         — most reliable, unique per language
2. Glottocode (card.glottocode)       — broader coverage, used by CLLD databases
3. BCP 47 tag (card.bcp47)            — for CLDR and web platform data
4. ISO 639-1 code (card.iso639_1)     — legacy compatibility
```

When a database uses a different identifier system, the enrichment script must implement a robust mapping with documented fallbacks.

### 3.4 Field-Level Merge Rules

| Scenario | Action |
|----------|--------|
| Card field is `null` | Populate from source |
| Card field is empty array `[]` | Populate from source |
| Card field is empty object `{}` | Populate from source |
| Card field has existing data | **Do not overwrite** — merge alongside if the field supports it (e.g., add `elcatStatus` to existing `vitality`) |
| Card field has derived data | Overwrite only with Tier 1–2 (primary) data |
| Source value is empty/null | Skip — never set a field to null/empty from an external source |

### 3.5 Source Label Conventions

Source labels in `_fieldSources` follow this format:

```
<database-name>-<version>[-<component>]
```

Examples:
- `grambank-2023` — Grambank v1.0 (Skirgård et al. 2023)
- `glottolog-5.x-languoid` — Glottolog 5.x, languoid component
- `glottolog-5.x-cldf` — Glottolog 5.x, CLDF languages component
- `cldr-46` — Unicode CLDR v46
- `elcat-2022` — Endangered Languages Catalogue (Campbell et al. 2022)
- `linguameta-2024` — LinguaMeta (Google Research 2024)
- `derived-from-card-fields` — Computed from other card fields
- `derived-from-linguameta-writing-systems` — Specific derivation chain

---

## 4. Quality Assurance

### 4.1 Anti-Patterns

The following are **explicitly prohibited** in the enrichment pipeline:

| Anti-Pattern | Why It's Prohibited |
|-------------|---------------------|
| **LLM-generated data** | Not reproducible, not citable, hallucination risk. We previously purged 4,951 bogus "llm translation API" resource entries. |
| **Playing to metrics** | Filling fields with vacuous data to inflate completeness scores defeats the purpose. An honest null is better than a plausible fabrication. |
| **Silent fallbacks** | If a match fails, log it. Never silently substitute a default value. |
| **Overwriting curated data** | Automated enrichment must never displace human-curated entries. |
| **Unsourced data** | Every populated field must have a corresponding `_fieldSources` entry. The test suite enforces this. |

### 4.2 Test Suite Enforcement

The test suite (244 suites, 37,413+ tests) validates:
- Schema compliance for all 7,927+ cards
- `_fieldSources` block presence on every card
- `dataSources` array correctness
- Register/formality consistency (`formality.default` points to valid register key)
- `registers` includes `prompt` key when formality is set
- Classification tree integrity

### 4.3 Enrichment Audit Trail

After each enrichment session, the walkthrough artifact documents:
- Which scripts were run, in what order
- How many cards were modified per script
- Which data sources were consumed
- Before/after statistics (field fill rates, quintile averages)
- Test results

---

## 5. Remaining Enrichment Frontiers

### 5.1 Currently Under-Populated Fields

| Field | Fill Rate | Gap Size | Potential Sources |
|-------|-----------|----------|-------------------|
| `codeSwitching` | 0.0% (3/7,927) | 7,924 | Requires linguistic literature research; no bulk database exists |
| `culturalAphorism` | 1.3% (104) | 7,823 | Manual curation from native speakers, linguists, Wikidata proverbs |
| `gender` | 5.6% (446) | 7,481 | Grambank GB103–106 (grammatical gender), WALS 44A |
| `keyboardSupport` | 6.7% (528) | 7,399 | CLDR keyboard layouts, Keyman.com keyboard database |
| `digitalPresence` | 8.1% (641) | 7,286 | Wikipedia API, Tatoeba, Mozilla Common Voice, Wikimedia Incubator |
| `nativeName` | 22.8% (1,805) | 6,122 | Wikidata P1705 (native label), CLDR displayNames, SIL Ethnologue |
| `formality` | 22.5% (1,781) | 6,146 | Grambank GB415 (politeness distinctions), manual curation |
| `registers` | 22.4% (1,775) | 6,152 | Derived from `formality`; requires `derive-registers-from-formality.mjs` |
| `phonologicalInventory` | 26.3% (2,083) | 5,844 | PHOIBLE 2.0 (2,186 languages inventoried) |

### 5.2 Actionable Next Steps

**High-impact, data available now:**
1. **`gender` from Grambank GB103–106** — Binary features for grammatical gender (sex-based, noun class). ~2,467 languages covered.
2. **`nativeName` from Wikidata P1705** — Wikidata `P1705` (native label property) covers ~4,000+ languages.
3. **`keyboardSupport` from Keyman** — The Keyman keyboard database (keyman.com) catalogues 2,000+ keyboard layouts.
4. **`phonologicalInventory` expansion** — PHOIBLE has ~100 more inventories than we've ingested. Also: UPSID (UCLA Phonological Segment Inventory Database) as supplementary.

**Medium-impact, requires API work:**
5. **`digitalPresence` from Common Voice** — Mozilla Common Voice API provides hours-of-audio and speaker counts for 120+ languages.
6. **`digitalPresence` from Wikimedia Incubator** — For languages with Wikipedia editions in incubation.

**Long-term, requires human curation:**
7. **`culturalAphorism`** — Partner with language community members to gather representative sayings.
8. **`codeSwitching`** — Document code-switching patterns from sociolinguistic literature.

---

## 6. References

- Campbell, L., Lee, N.H., Okura, E., Simpson, S., & Ueki, K. (2022). *Catalogue of Endangered Languages*. University of Hawaiʻi at Mānoa. http://endangeredlanguages.com
- de Marneffe, M.-C., Manning, C.D., Nivre, J., & Zeman, D. (2021). Universal Dependencies. *Computational Linguistics*, 47(2), 255–308.
- Dryer, M.S. & Haspelmath, M. (eds.) (2013). *WALS Online (v2020)*. https://wals.info
- Hammarström, H., Forkel, R., Haspelmath, M., & Bank, S. (2024). *Glottolog 5.0*. https://glottolog.org
- Hammarström, H. & Nordhoff, S. (2011). LangDoc: Bibliographic Infrastructure for Linguistic Typology. *Oslo Studies in Language*, 3(2), 31–43.
- Haspelmath, M. & Tadmor, U. (eds.) (2009). *Loanwords in the World's Languages*. De Gruyter Mouton.
- Michaelis, S.M., Maurer, P., Haspelmath, M., & Huber, M. (eds.) (2013). *APiCS Online*. https://apics-online.info
- Moran, S. & McCloy, D. (eds.) (2019). *PHOIBLE 2.0*. https://phoible.org
- Rawls, J. (1971). *A Theory of Justice*. Harvard University Press.
- Simons, G.F. & Bird, S. (2003). The Open Language Archives Community: An Infrastructure for Distributed Archiving of Language Resources. *Literary and Linguistic Computing*, 18(2), 117–128.
- Skirgård, H., et al. (2023). Grambank reveals the importance of genealogical constraints on linguistic diversity. *Science Advances*, 9(16).
- Tiedemann, J. (2012). Parallel Data, Tools and Interfaces in OPUS. *Proceedings of LREC 2012*.
- Unicode Consortium (2024). *Unicode CLDR v46*. https://cldr.unicode.org
