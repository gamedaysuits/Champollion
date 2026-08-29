# Data Source Attribution

> This document lists all third-party data sources used in the Champollion language card system. Every auto-generated card includes a `dataSources` array identifying which sources contributed data to that card.
>
> **Champollion is committed to full license compliance.** Before ingesting any new data source, verify its license and add it to this table.

Last updated: 2026-06-08

---

## Data Sources

| Source | License | URL | What We Use | Our Obligations |
|--------|---------|-----|-------------|-----------------|
| **Glottolog** | CC BY 4.0 (verify per release) | [glottolog.org](https://glottolog.org) | Language classification tree, Glottocodes, family hierarchy, MED documentation depth (via OLAC integration), AES endangerment, countries, dialect counts, documentation dates. Maintained by Max Planck Institute for Evolutionary Anthropology. | Attribution + link to source + indicate modifications. Derived tree data inherits CC BY 4.0. |
| **Grambank** | CC BY 4.0 | [grambank.clld.org](https://grambank.clld.org) | 195 typological features for 2,467 languages: morphological type, word order, grammatical gender (GB103–106), politeness (GB415), case, tone, evidentiality. Skirgård et al. (2023). | Attribution + link to source. |
| **WALS** (World Atlas of Language Structures) | CC BY 4.0 | [wals.info](https://wals.info) | Typological features: word order (81A–87A), morphological type (26A), nominal categories, numeral classifiers (55A), case count (49A), gender count (30A), inflectional strategy (26A), ordinal numerals (53A), numeral-noun order (89A). Dryer & Haspelmath (2013). | Attribution + link to source. |
| **PHOIBLE** | CC BY-SA 3.0 | [phoible.org](https://phoible.org) | Phoneme inventories, consonant/vowel counts, tonal status for 2,186 languages. Moran & McCloy (2019). | Attribution + ShareAlike on derived phonological data. |
| **ElCat** (Endangered Languages Catalogue) | CC BY 4.0 | [endangeredlanguages.com](http://endangeredlanguages.com) | Endangerment status, intergenerational transmission, domains of use, speaker trends, alternate names for 3,378+ endangered languages. Campbell et al. (2022). | Attribution + link to source. |
| **LinguaMeta** | Apache 2.0 | [github.com/AetherPrior/LinguaMeta](https://github.com/AetherPrior/LinguaMeta) | Writing systems (ISO 15924), speaker estimates, endangerment status, Wikidata descriptions for 7,511 languages. Google Research (2024). | Attribution. |
| **OLAC** (Open Language Archives Community) | Metadata freely accessible | [language-archives.org](http://www.language-archives.org) | MED (Most Extensive Description) classification consumed via Glottolog integration. Also harvested directly via OAI-PMH aggregator for archive presence data across 65+ language archives (7,500+ language codes). Simons & Bird (2003). | Attribution. |
| **CLDR / Unicode** | Unicode Terms of Use | [cldr.unicode.org](https://cldr.unicode.org) | Locale data, script metadata, plural rules, typography conventions, direction, script codes, native names. | Attribution. Data is freely usable under Unicode ToS. |
| **ISO 639-3** | Free to use | [iso639-3.sil.org](https://iso639-3.sil.org) | Language codes, scope, type, macrolanguage membership. SIL International (2024). | Attribution. |
| **IANA Language Subtag Registry** | Public Domain | [iana.org](https://www.iana.org/assignments/language-subtag-registry) | BCP 47 tags, ISO 639 codes, English language names. | None required — public domain. Attributed for good practice. |
| **ISO 15924** | Public Standard | [unicode.org/iso15924](https://unicode.org/iso15924/) | Script codes, script names, code-to-name mappings. | Reference the standard. |
| **UNESCO Atlas of the World's Languages in Danger** | CC BY-SA 3.0 IGO | [unesco.org](http://www.unesco.org/languages-atlas) | Endangerment status classifications. | Attribution + ShareAlike on derived endangerment data. |
| **OPUS** (Open Parallel Corpus) | Various (per-corpus) | [opus.nlpl.eu](http://opus.nlpl.eu) | Parallel corpus availability, sentence pair counts. Tiedemann (2012). | Per-corpus license compliance. |
| **Universal Dependencies** | Various (per-treebank, mostly CC) | [universaldependencies.org](https://universaldependencies.org) | Treebank availability, sentence/token counts for 150+ languages. de Marneffe et al. (2021). | Per-treebank license compliance. |
| **Tatoeba** | CC BY 2.0 FR | [tatoeba.org](https://tatoeba.org) | Sentence counts for 428 languages. | Attribution. |
| **Wikidata** | CC0 | [wikidata.org](https://www.wikidata.org) | Native language names (P1705), official names (P1448), speaker counts (P1098), writing systems (P282). Queried via SPARQL endpoint. | None — CC0 dedication. |
| **Wikipedia / MediaWiki / Incubator** | CC BY-SA 3.0 / GFDL | [mediawiki.org](https://www.mediawiki.org/wiki/API:Siteinfo), [incubator.wikimedia.org](https://incubator.wikimedia.org) | Article counts, active editors per language edition. Incubator test wiki page counts for 719 languages without their own Wikipedia. | Attribution + ShareAlike. |
| **WOLD** (World Loanword Database) | CC BY 4.0 | [wold.clld.org](https://wold.clld.org) | Contact language influences, borrowing proportions for 41 languages. Haspelmath & Tadmor (2009). | Attribution + link to source. |
| **APiCS** (Atlas of Pidgin and Creole Language Structures) | CC BY 4.0 | [apics-online.info](https://apics-online.info) | Structural features for 76 pidgin/creole languages. Michaelis et al. (2013). | Attribution + link to source. |
| **Lexibank** | CC BY 4.0 | [lexibank.clld.org](https://lexibank.clld.org) | Lexical dataset availability for 5,478 language varieties. | Attribution + link to source. |
| **PanLex** | CC0 (Public Domain Dedication) | [panlex.org](https://panlex.org) | Cross-lingual lexical data. | None — CC0 dedication. |
| **FLORES+** | CC BY-SA 4.0 | [github.com/openlanguagedata/flores](https://github.com/openlanguagedata/flores) | **Development/debugging only.** Available for smoke testing, pipeline validation, and cross-language coverage checks. NOT used for official leaderboard evaluation — frontier LLMs have likely been trained on this data, making scores unreliable for method comparison. | Attribution + ShareAlike if distributing derived datasets. |
| **GiellaLT** | varies per language repository (lang-crk: AGPL-3.0-or-later with a §7(b) attribution rider) | [github.com/giellalt](https://github.com/giellalt) | FST availability reference only. We reference which languages have FST tools available; we do NOT bundle or distribute any FST binaries. | No GPL obligation applies — we reference availability, not distribute code. |
| **Ethnologue** | Proprietary (limited free data) | [ethnologue.com](https://www.ethnologue.com) | Speaker count estimates (free tier only). | Respect free-tier usage limits. No bulk scraping. |
| **Numeralbank** (Chan's Numeral Systems) | CC BY 4.0 | [github.com/numeralbank/channumerals](https://github.com/numeralbank/channumerals) | Numeral systems for 4,000+ languages — counting base, highest documented numeral. Chan (2019). | Attribution + link to source. |
| **D-PLACE** (Ethnographic Atlas) | CC BY-NC 4.0 | [d-place.org](https://d-place.org) | Cultural and ecological variables for 1,291 societies: subsistence type, settlement patterns, political complexity. Kirby et al. (2016). | Attribution + NonCommercial. |
| **AUTOTYP** | CC BY 4.0 | [github.com/autotyp/autotyp-data](https://github.com/autotyp/autotyp-data) | Morphological type, locus of marking (head/dependent), for 750+ languages. Bickel et al. (2023). | Attribution + link to source. |
| **SegBo** (Segment Borrowing Database) | CC BY 4.0 | [github.com/segbo-db/segbo](https://github.com/segbo-db/segbo) | Borrowed phonemes and donor languages for 500+ languages. Grossman et al. (2020). | Attribution + link to source. |
| **ABVD** (Austronesian Basic Vocabulary Database) | CC BY 4.0 | [abvd.eva.mpg.de](https://abvd.eva.mpg.de/) | Swadesh-list vocabulary for 1,500+ Austronesian languages via Lexibank. Greenhill, Blust & Gray (2008). | Attribution + link to source. |
| **NorthEuraLex** | CC BY 4.0 | [northeuralex.org](https://northeuralex.org/) | Lexical data for 107 Northern Eurasian languages (~1016 concepts). Dellert et al. (2020). | Attribution + link to source. |
| **CLICS³** (Database of Cross-Linguistic Colexifications) | CC BY 4.0 | [clics.clld.org](https://clics.clld.org) | Colexification (shared word forms across concepts) for 2,279 language varieties from 30 datasets. Rzymski et al. (2020). | Attribution + link to source. |
| **Masakhane** | Various (per-benchmark) | [github.com/masakhane-io](https://github.com/masakhane-io) | African language NLP community — MT benchmarks for 37+ languages, NER for 12 languages. Nekoto et al. (2020). | Attribution + link to project. |
| **IndicNLP** | Various (per-dataset) | [indicnlp.ai4bharat.org](https://indicnlp.ai4bharat.org) | NLP resources catalog for 14 Indic languages. AI4Bharat. | Attribution + link to project. |
| **AmericasNLP** | CC BY (shared task data) | [americasnlp.github.io](https://turing.iimas.unam.mx/americasnlp/) | MT and NLP shared tasks for 13 Indigenous American languages. Mager et al. (2021). | Attribution + link to project. |
| **PARADISEC** (Pacific And Regional Archive for Digital Sources in Endangered Cultures) | Metadata: OAI-PMH open access | [catalog.paradisec.org.au](https://catalog.paradisec.org.au) | Archive holdings metadata for 1,000+ languages via OAI-PMH/OLAC protocol. Thieberger & Barwick (2012). | Attribution + link to archive. Metadata only — no content downloaded. |
| **ASJP** (Automated Similarity Judgement Program) | Open Access | [asjp.clld.org](https://asjp.clld.org) | 40-item basic vocabulary word lists (ASJPcode) for 7,000+ doculects (11,540 entries). Wichmann, Holman & Brown (2022). | Attribution + link to source. |
| **UniMorph** (Universal Morphology) | Open Source | [github.com/unimorph](https://github.com/unimorph) | Normalized morphological inflection paradigms for 188 languages derived from Wiktionary. Batsuren et al. (2022). | Attribution + link to source. |
| **Kaikki.org / Wiktextract** | CC BY-SA (via Wiktionary) | [kaikki.org](https://kaikki.org) | Machine-readable structured extraction of Wiktionary: definitions, POS, morphology, pronunciations for 457 languages. Ylonen (2022). | Attribution + ShareAlike (inherits from Wiktionary). |
| **eWAVE** (Electronic World Atlas of Varieties of English) | CC BY | [ewave-atlas.org](https://ewave-atlas.org) | Morphosyntactic features of 77 varieties of English (pidgins, creoles, L2 varieties). Kortmann & Lunkenheimer (2013). | Attribution + link to source. |
| **Open Multilingual Wordnet** (OMW) | Various open licenses | [omwn.org](https://omwn.org) | Linked wordnets (synsets, semantic relations) across 60 languages via Collaborative Interlingual Index. Bond & Foster (2013). | Per-wordnet license compliance. |
| **Kaipuleohone** (UH Digital Language Archive) | OAI-PMH metadata: open | [scholarspace.manoa.hawaii.edu](https://scholarspace.manoa.hawaii.edu) | Archive holdings metadata for 84+ Pacific and endangered languages via OAI-PMH. University of Hawaiʻi. | Attribution + link to archive. Metadata only. |
| **Rosetta Project** (Internet Archive) | Public Domain / CC | [archive.org/details/rosettaproject](https://archive.org/details/rosettaproject) | 6,500 items across 1,305 languages — word lists, grammars, descriptions. Long Now Foundation. | Attribution + link to archive. Metadata counts only. |
| **HuggingFace Datasets** | Various (per-dataset) | [huggingface.co/datasets](https://huggingface.co/datasets) | NLP dataset availability index — dataset counts per language. Metadata pointer only, no data downloaded. | Per-dataset license compliance. |
| **WACL** (World Atlas of Classifier Languages) | CC BY 4.0 | [github.com/cldf-datasets/wacl](https://github.com/cldf-datasets/wacl) | Classifier language typology for 3,338 languages. | Attribution + link to source. |
| **SAILS** (South American Indigenous Language Structures) | CC BY 4.0 | [github.com/cldf-datasets/sails](https://github.com/cldf-datasets/sails) | Typological features for 167 South American languages. Muysken et al. | Attribution + link to source. |
| **AfBo** (Affix Borrowing Database) | CC BY 4.0 | [github.com/cldf-datasets/afbo](https://github.com/cldf-datasets/afbo) | Affix borrowing patterns across 191 languages. Seifart (2024). | Attribution + link to source. |
| **DoReCo** (Language Documentation Reference Corpus) | CC BY 4.0 | [github.com/cldf-datasets/doreco](https://github.com/cldf-datasets/doreco) | Time-aligned annotated natural speech corpora for 47 languages. Paschen et al. (2020). | Attribution + link to source. |
| **TonoDB** | CC BY 4.0 | [github.com/cldf-datasets/tonodb](https://github.com/cldf-datasets/tonodb) | Tonal system classifications for 97 languages. | Attribution + link to source. |
| **SAPhon** (South American Phonological Inventories) | CC BY 4.0 | [github.com/cldf-datasets/saphon](https://github.com/cldf-datasets/saphon) | Phonological inventories for 363 South American languages. Michael et al. | Attribution + link to source. |
| **UraTyp** | CC BY 4.0 | [github.com/cldf-datasets/uratyp](https://github.com/cldf-datasets/uratyp) | Typological features for 39 Uralic languages. | Attribution + link to source. |
| **ACD** (Austronesian Comparative Dictionary) | CC BY | [lexibank/acd](https://github.com/lexibank/acd) | Comparative lexical data for 1,064 Austronesian languages. Blust & Trussel. | Attribution + link to source. |
| **DIACL** (Diachronic Atlas of Comparative Linguistics) | CC BY 4.0 | [lexibank/diacl](https://github.com/lexibank/diacl) | Diachronic comparative wordlists for 422 languages. Carling (2024). | Attribution + link to source. |
| **IDS** (Intercontinental Dictionary Series) | CC BY 4.0 | [github.com/intercontinental-dictionary-series](https://github.com/intercontinental-dictionary-series/ids) | Concept-aligned dictionaries across 319 languages, ~1,310 concepts. Key & Comrie (2023). | Attribution + link to source. |
| **Language Atlas of the Pacific Area** | CC BY 4.0 | [cldf-datasets/languageatlasofthepacificarea](https://github.com/cldf-datasets/languageatlasofthepacificarea) | 1,873 Pacific-area languages digitized from Wurm & Hattori (1981). ECAI. | Attribution + link to source. |
| **DatSemShift** (Database of Semantic Shifts) | CC BY 4.0 | [lexibank/datsemshift](https://github.com/lexibank/datsemshift) | Semantic shift patterns across 1,629 languages. Zalizniak et al. | Attribution + link to source. |
| **UCLA Phonetics Lab Archive** | CC BY 4.0 | [cldf-datasets/uclaphoneticslabarchive](https://github.com/cldf-datasets/uclaphoneticslabarchive) | Phonetic samples for 312 languages. Ladefoged (2009). | Attribution + link to source. |
| **Hunter-Gatherer Language Database** | CC BY 4.0 | [lexibank/huntergatherer](https://github.com/lexibank/huntergatherer) | Basic vocabulary for 324 hunter-gatherer languages. | Attribution + link to source. |
| **Pama-Nyungan Lexicon** | CC BY 4.0 | [lexibank/bowernpny](https://github.com/lexibank/bowernpny) | Comparative wordlists for 190 Pama-Nyungan languages. Bowern & Atkinson. | Attribution + link to source. |
| **Vanuatu Voices** | CC BY 4.0 | [lexibank/vanuatuvoices](https://github.com/lexibank/vanuatuvoices) | Sound-comparisons data for 236 Vanuatu languages. | Attribution + link to source. |
| **ValPaL** (Valency Patterns Leipzig) | CC BY 4.0 | [lexibank/valpal](https://github.com/lexibank/valpal) | Valency patterns across 36 languages. Hartmann et al. (2013). | Attribution + link to source. |
| **Sagart Sino-Tibetan** | CC BY 4.0 | [lexibank/sagartst](https://github.com/lexibank/sagartst) | Cognate-coded Sino-Tibetan comparative data for 50 languages. Sagart et al. | Attribution + link to source. |
| **UraLex** | CC BY 4.0 | [lexibank/uralex](https://github.com/lexibank/uralex) | Basic vocabulary for 43 Uralic languages. Syrjänen et al. | Attribution + link to source. |
| **CrossAndean** | CC BY 4.0 | [lexibank/crossandean](https://github.com/lexibank/crossandean) | Andean language comparative data for 50 languages. | Attribution + link to source. |
| **Lexibank Batch** (143 family-level datasets) | CC BY 4.0 | [github.com/lexibank](https://github.com/lexibank) | Comparative lexical data from 143 individual family-level datasets in the Lexibank ecosystem. Each dataset covers a specific language family (e.g., abvdoceanic, transnewguineaorg, grollemundbantu). Individual attributions listed per-card in `dataSources`. | Attribution per individual dataset. |
| **Language Atlas of the Pacific Area** | CC BY 4.0 | [cldf-datasets/languageatlasofthepacificarea](https://github.com/cldf-datasets/languageatlasofthepacificarea) | 1,873 Pacific-area languages digitized from Wurm & Hattori (1981). ECAI. | Attribution + link to source. |
| **DatSemShift** (Database of Semantic Shifts) | CC BY 4.0 | [lexibank/datsemshift](https://github.com/lexibank/datsemshift) | Semantic shift patterns across 1,629 languages. Zalizniak et al. | Attribution + link to source. |
| **UCLA Phonetics Lab Archive** | CC BY 4.0 | [cldf-datasets/uclaphoneticslabarchive](https://github.com/cldf-datasets/uclaphoneticslabarchive) | Phonetic samples for 312 languages. Ladefoged (2009). | Attribution + link to source. |
| **Hunter-Gatherer Language Database** | CC BY 4.0 | [lexibank/huntergatherer](https://github.com/lexibank/huntergatherer) | Basic vocabulary for 324 hunter-gatherer languages. | Attribution + link to source. |
| **AILLA** (Archive of Indigenous Languages of Latin America) | Public access | [ailla.utexas.org](https://ailla.utexas.org/) | 644 indigenous American languages with ISO codes, indigenous names, alternative names, and language families. University of Texas at Austin. | Attribution + link to source. NEH/NSF funded. |

---

## Restricted-Access Sources

### ELAR (Endangered Languages Archive)

**Source**: [elararchive.org](https://www.elararchive.org/) / [elar.soas.ac.uk](https://elar.soas.ac.uk/)  
**License**: Custom ELAR User Agreement (NOT open-access)  
**Our usage**: **Metadata citation only** — we record that ELAR holds deposits for a language. We do NOT redistribute any ELAR materials.

> **⚠️ ELAR materials may be cited but NEVER distributed.**

The following terms govern all interaction with ELAR materials and must be observed by anyone working on this project:

1. Materials are for **non-commercial private research or educational activity only**. Any other usage requires explicit written agreement from the Collection Steward and rights holders.
2. **AI training/fine-tuning** use must comply with **CC BY-NC-SA**: non-commercial, attributed, share-alike on derivatives. Automated extraction that circumvents access controls is prohibited.
3. **No transfer** of materials to any other person or equipment unless explicitly permitted in writing by the Collection Steward.
4. Individual collections may state further conditions; these must be identified and observed.
5. Any publication or dissemination using ELAR materials must **acknowledge ELAR** and, if required, the Collection Steward per the citation instructions on the collection's landing page. A copy of the publication should be sent to ELAR where possible.
6. Materials must not be used in any way that causes **disparagement, disrespect, damage to reputation, or harm** to any individual or group.
7. ELAR stores user data securely under EU law and may share access records with materials owners for management purposes.

**What this means for Champollion**: We may add `archivePresence.elar = true` to language cards and note deposit counts, but we must NEVER include actual ELAR content (recordings, transcriptions, texts) in the cards or any distributed package. Users who want ELAR materials must register at elararchive.org and agree to these terms themselves.

---

## ShareAlike Obligations

Some sources use **ShareAlike** licenses (CC BY-SA 3.0 IGO, CC BY-SA 4.0). This means:

- **Derived data** from these sources must be distributed under the same or a compatible license.
- **Our original metadata** (register presets, formality systems, LLM prompts, method support flags) is our own creative work and is NOT subject to ShareAlike obligations.
- The `language-tree.json` classification tree, if derived from Glottolog, inherits Glottolog's license.
- Endangerment status fields derived from UNESCO Atlas inherit CC BY-SA 3.0 IGO.

## Traceability

Every auto-generated language card includes:

```json
{
  "dataSources": ["cldr-48.2", "glottolog-5.3", "wals-2024", "iana-2026-05"],
  "cldrVersion": "48.2",
  "glottologVersion": "5.3",
  "generatedAt": "2026-06-01T00:00:00Z"
}
```

This allows anyone to verify what data contributed to each card and reproduce the generation process.

---

## Adding New Sources

Before ingesting any new data source:

1. Verify its license
2. Add it to the table above
3. Confirm our obligations are met
4. Add the source identifier to the `dataSources` array in the card schema
5. Document the version used
