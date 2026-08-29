# Corpora Cards v1 — Reference Document

> **⚠️ SUPERSEDED SNAPSHOT (frozen 2026-06-09).** The cards under
> [`corpora-cards/`](./corpora-cards/) are the source of truth and have moved
> on — notably the EdTeKLA entries: the corpus has a **public** GitHub source
> (pinned ref) and its contamination rating was corrected from "NONE /
> private corpus" to **MEDIUM** on 2026-06-11. Where this document and a card
> disagree, the card wins. Kept for rebuild archaeology only.

> **Generated**: 2026-06-09  
> **Cards**: 51 total (2 EDTeKLA, 46 Tatoeba eval, 3 reference)  
> **Schema**: [`corpora-card.schema.json`](./schemas/corpora-card.schema.json)  
> **Card directory**: [`corpora-cards/`](./corpora-cards/)

This document catalogues every v1 corpora card for use when rebuilding, validating, or extending the card set.

---

## Table of Contents

1. [EDTeKLA Cards](#1-edtekla-cards-2)
2. [Tatoeba Eval Cards](#2-tatoeba-eval-cards-46)
3. [Reference Cards](#3-reference-cards-3)
4. [Field Inventory](#4-field-inventory)
5. [Schema Migration Notes](#5-schema-migration-notes-oldnew-field-mapping)
6. [Vitality Legend](#6-vitality-legend)

---

## 1. EDTeKLA Cards (2)

Private Plains Cree evaluation sets from the EDTeKLA Project, University of Alberta. Not publicly available. Zero contamination risk.

| ID | Pair | Dev Size | License | Commercial | doNotTrain | secretTest | stewardship | Contam. | Domain | Target Vitality |
|----|------|----------|---------|------------|------------|------------|-------------|---------|--------|-----------------|
| `eval-eng-crk-edtekla-dev-v1` | eng→crk | 436 entries | CC BY-NC-SA 4.0 | ❌ | ✅ | null | null | NONE | educational | **severely-endangered** |
| `eval-eng-crk-edtekla-textbook` | eng→crk | 486 entries | CC BY-NC-SA 4.0 | ❌ | ✅ | null | null | NONE | educational | **severely-endangered** |

**Key details:**
- **Relationship**: `textbook` is the full corpus (486 = 436 dev + 50 held-out). `dev-v1` is the 436-entry dev split only.
- **Quality**: Human-translated by L1 Plains Cree speakers, certified educators. Multi-pass expert review. SRO orthography.
- **AI Training**: Non-commercial only.
- **Publisher**: EDTeKLA Project, University of Alberta. No public URL, paper, or citation.
- **Data file**: `curated/eng-crk-dev-v1.json` (harness-json format).
- **Submission**: null (no submission terms defined yet).

---

## 2. Tatoeba Eval Cards (46)

Community-curated evaluation sets built via Tatoeba API by `corpora-builder v0.1.0`. All are:
- **License**: CC-BY-2.0 (commercial ✅, redistribution ✅)
- **doNotTrain**: ✅ (all set to `true`)
- **secretTest**: null (none have secret test sets yet)
- **stewardship**: null (no steward governance established yet)
- **submission**: null (no submission terms defined yet)
- **Domain**: mixed
- **Quality**: Human-translated (Tatoeba community volunteers). No translator qualifications, review process, or orthography specified.
- **Format**: harness-json

### Grouped by Target Language Vitality

#### Critically Endangered (1)

| ID | Pair | Dev Size | Contam. | Target Language |
|----|------|----------|---------|-----------------|
| `eval-eng-haw-tatoeba-dev-v1` | eng→haw | 194 entries | MEDIUM | Hawaiian |

#### Definitely Endangered (1)

| ID | Pair | Dev Size | Contam. | Target Language |
|----|------|----------|---------|-----------------|
| `eval-eng-sme-tatoeba-dev-v1` | eng→sme | 58 entries | LOW | Northern Sámi |

#### Vulnerable (10)

| ID | Pair | Dev Size | Contam. | Target Language |
|----|------|----------|---------|-----------------|
| `eval-eng-cym-tatoeba-dev-v1` | eng→cym | 47 entries | LOW | Welsh |
| `eval-eng-ibo-tatoeba-dev-v1` | eng→ibo | 35 entries | LOW | Igbo |
| `eval-eng-pag-tatoeba-dev-v1` | eng→pag | 60 entries | LOW | Pangasinan |
| `eval-eng-pam-tatoeba-dev-v1` | eng→pam | 48 entries | LOW | Kapampangan |
| `eval-eng-war-tatoeba-dev-v1` | eng→war | 131 entries | LOW | Waray |
| `eval-fra-cat-tatoeba-dev-v1` | fra→cat | 57 entries | LOW | Catalan |
| `eval-fra-eus-tatoeba-dev-v1` | fra→eus | 59 entries | LOW | Basque |
| `eval-nld-fry-tatoeba-dev-v1` | nld→fry | 58 entries | LOW | Western Frisian |
| `eval-por-glg-tatoeba-dev-v1` | por→glg | 102 entries | LOW | Galician |
| `eval-spa-que-tatoeba-dev-v1` | spa→que | 95 entries | LOW | Quechua |

#### Safe (33)

| ID | Pair | Dev Size | Contam. | Target Language |
|----|------|----------|---------|-----------------|
| `eval-dan-fao-tatoeba-dev-v1` | dan→fao | 168 entries | MEDIUM | Faroese |
| `eval-deu-ltz-tatoeba-dev-v1` | deu→ltz | 179 entries | MEDIUM | Luxembourgish |
| `eval-eng-amh-tatoeba-dev-v1` | eng→amh | 73 entries | LOW | Amharic |
| `eval-eng-bos-tatoeba-dev-v1` | eng→bos | 64 entries | LOW | Bosnian |
| `eval-eng-ceb-tatoeba-dev-v1` | eng→ceb | 132 entries | LOW | Cebuano |
| `eval-eng-guj-tatoeba-dev-v1` | eng→guj | 165 entries | MEDIUM | Gujarati |
| `eval-eng-hau-tatoeba-dev-v1` | eng→hau | 140 entries | LOW | Hausa |
| `eval-eng-hil-tatoeba-dev-v1` | eng→hil | 56 entries | LOW | Hiligaynon |
| `eval-eng-ilo-tatoeba-dev-v1` | eng→ilo | 105 entries | LOW | Ilocano |
| `eval-eng-kan-tatoeba-dev-v1` | eng→kan | 61 entries | LOW | Kannada |
| `eval-eng-kaz-tatoeba-dev-v1` | eng→kaz | 113 entries | LOW | Kazakh |
| `eval-eng-lao-tatoeba-dev-v1` | eng→lao | 68 entries | LOW | Lao |
| `eval-eng-lug-tatoeba-dev-v1` | eng→lug | 183 entries | MEDIUM | Ganda |
| `eval-eng-mal-tatoeba-dev-v1` | eng→mal | 59 entries | LOW | Malayalam |
| `eval-eng-mlt-tatoeba-dev-v1` | eng→mlt | 129 entries | LOW | Maltese |
| `eval-eng-mon-tatoeba-dev-v1` | eng→mon | 138 entries | LOW | Mongolian |
| `eval-eng-mya-tatoeba-dev-v1` | eng→mya | 77 entries | LOW | Burmese |
| `eval-eng-pan-tatoeba-dev-v1` | eng→pan | 68 entries | LOW | Panjabi |
| `eval-eng-sin-tatoeba-dev-v1` | eng→sin | 69 entries | LOW | Sinhala |
| `eval-eng-sna-tatoeba-dev-v1` | eng→sna | 47 entries | LOW | Shona |
| `eval-eng-tam-tatoeba-dev-v1` | eng→tam | 153 entries | MEDIUM | Tamil |
| `eval-eng-tel-tatoeba-dev-v1` | eng→tel | 71 entries | LOW | Telugu |
| `eval-eng-tir-tatoeba-dev-v1` | eng→tir | 54 entries | LOW | Tigrinya |
| `eval-eng-urd-tatoeba-dev-v1` | eng→urd | 181 entries | MEDIUM | Urdu |
| `eval-eng-uzb-tatoeba-dev-v1` | eng→uzb | 167 entries | MEDIUM | Uzbek |
| `eval-eng-xho-tatoeba-dev-v1` | eng→xho | 75 entries | LOW | Xhosa |
| `eval-eng-yor-tatoeba-dev-v1` | eng→yor | 68 entries | LOW | Yoruba |
| `eval-eng-zsm-tatoeba-dev-v1` | eng→zsm | 148 entries | LOW | Standard Malay |
| `eval-eng-zul-tatoeba-dev-v1` | eng→zul | 112 entries | LOW | Zulu |
| `eval-fra-hau-tatoeba-dev-v1` | fra→hau | 168 entries | MEDIUM | Hausa |
| `eval-fra-ltz-tatoeba-dev-v1` | fra→ltz | 196 entries | MEDIUM | Luxembourgish |
| `eval-ita-mlt-tatoeba-dev-v1` | ita→mlt | 180 entries | MEDIUM | Maltese |
| `eval-rus-uzb-tatoeba-dev-v1` | rus→uzb | 51 entries | LOW | Uzbek |

#### No Language Card (1)

| ID | Pair | Dev Size | Contam. | Target Language |
|----|------|----------|---------|-----------------|
| `eval-eng-sqi-tatoeba-dev-v1` | eng→sqi | 61 entries | LOW | Albanian (no `sqi.json` language card) |

**Note**: `sqi` uses the ISO 639-3 macrolanguage code for Albanian. The language cards directory may use a more specific code (e.g., `aln` for Gheg Albanian or `als` for Tosk Albanian). This needs resolution.

### Tatoeba Source Pairs Summary

| Source Language | # Pairs |
|----------------|---------|
| eng (English) | 34 |
| fra (French) | 4 |
| dan (Danish) | 1 |
| deu (German) | 1 |
| ita (Italian) | 1 |
| nld (Dutch) | 1 |
| por (Portuguese) | 1 |
| rus (Russian) | 1 |
| spa (Spanish) | 1 |

### Dev Set Size Distribution

| Range | Count | Cards |
|-------|-------|-------|
| < 50 entries | 5 | cym (47), ibo (35), pam (48), sna (47), bos (64→corrected: see below) |
| 50–99 | 18 | amh, hil, kaz, kan, lao, mal, pan, sin, sme, sqi, tel, tir, uzb-rus, yor, cat, eus, fry, mya |
| 100–149 | 11 | ceb, hau, ilo, kaz, mlt, mon, war, glg, que, zul, zsm |
| 150–199 | 9 | dan→fao, deu→ltz, guj, haw, lug, tam, urd, uzb-eng, fra→ltz |
| ≥ 200 | 1 | fra→hau (168→corrected: none ≥200) |

**Actual smallest**: eng→ibo at 35 entries.  
**Actual largest**: fra→ltz at 196 entries.

---

## 3. Reference Cards (3)

Multi-language reference corpora catalogued for development use. These do NOT have `pair`, `dev`, `doNotTrain`, `secretTest`, or `stewardship` fields — they use `languages`, `segments`, and `download` instead.

| ID | Name | Version | # Languages | Segments | License | Commercial | Contam. |
|----|------|---------|-------------|----------|---------|------------|---------|
| `ref-flores-plus` | FLORES+ | 2.0 | 197 | dev: 997 sent, devtest: 1012 sent | CC-BY-SA-4.0 | ❌ | **HIGH** |
| `ref-ntrex-128` | NTREX-128 | 1.0 | 104 | test: 1997 sent | CC-BY-SA-4.0 | ❌ | MEDIUM |
| `ref-tatoeba-challenge` | Tatoeba Challenge | 2023-09-26 | 108 | test: varies, dev: varies | CC-BY-2.0 | ✅ | MEDIUM |

### FLORES+
- **Publisher**: Meta AI (NLLB Team)
- **Source**: English Wikipedia + Wikinews, professionally translated
- **Known in training of**: NLLB-200
- **Download**: `git clone https://github.com/openlanguagedata/flores.git`
- **Warning**: Heavily contaminated in frontier LLM training data. Scores should be treated as relative comparisons only.

### NTREX-128
- **Publisher**: Microsoft Research
- **Source**: WMT19 English news test set, professionally translated into 128 languages
- **Download**: `git clone https://github.com/MicrosoftTranslator/NTREX.git`
- **Note**: Less contaminated than FLORES+ but source sentences from WMT may appear in training data.

### Tatoeba Challenge
- **Publisher**: Tatoeba community / OPUS / University of Helsinki
- **Source**: User-contributed translations, short conversational sentences
- **Known in training of**: OPUS-MT, Helsinki-NLP models
- **Download**: Per-pair packages from `https://github.com/Helsinki-NLP/Tatoeba-Challenge/tree/master/data`
- **License caveat**: Individual sentences may have different licenses. CC-BY-2.0 applies to the collection as distributed.

---

## 4. Field Inventory

### Fields Present on All Cards

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | ✅ | Pattern: `^(ref\|eval)-[a-z0-9][a-z0-9-]*$` |
| `type` | `"reference"` \| `"eval"` | ✅ | |
| `name` | string | ✅ | |
| `version` | string | ✅ | Semver recommended |
| `description` | string | ✅ | |
| `source` | object | ✅ | `{publisher, url, paper, citation, fundedBy}` |
| `license` | object | ✅ | `{spdx, commercial, redistribution, aiTraining, notes}` |
| `contamination` | object | ✅ | `{risk, reasoning, knownInTrainingOf?}` |
| `_provenance` | object | ✅ | `{addedAt, lastUpdated, populatedFrom}` |

### Eval-Only Fields (required when `type: "eval"`)

| Field | Type | Required | Current Status |
|-------|------|----------|----------------|
| `pair` | object | ✅ | `{source, target, direction}` — all cards use `"unidirectional"` |
| `dev` | object | ✅ | `{size, sizeUnit, domain, domainDistribution, dataFile, format}` |
| `doNotTrain` | boolean | ✅ | All 48 eval cards set to `true` |
| `secretTest` | object \| null | — | All cards currently `null` |
| `stewardship` | object \| null | — | All cards currently `null` |
| `submission` | object \| null | — | All cards currently `null` |
| `quality` | object \| null | — | Populated for EDTeKLA; partially populated for Tatoeba |

### Reference-Only Fields (required when `type: "reference"`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `languages` | string[] | ✅ | ISO 639-3 codes |
| `download` | object | ✅ | `{method, url, instructions, sha256}` |
| `segments` | object[] | — | `{id, name, size?, sizeUnit?, purpose}` |

---

## 5. Schema Migration Notes (Old→New Field Mapping)

The schema currently contains these fields inside `submission`, which represent an older naming convention that will be restructured:

| Old Field (in schema) | Current Location | Planned New Location | Purpose |
|-----------------------|------------------|---------------------|---------|
| `ipTransfer` | `submission.ipTransfer` | `submission.transfer` | Whether method authors must transfer IP rights |
| `ipTransferTerms` | `submission.ipTransferTerms` | `submission.transfer` (merged) / `submission.retained` | Full text of transfer agreement |
| `doNotTrain` | top-level `doNotTrain` | Stays top-level + also informs `usageRestrictions` | Prohibits use for ML training |

**Current state**: The `submission` field is `null` on all 51 cards. The `ipTransfer` and `ipTransferTerms` fields exist in the schema but have never been populated in any card. When these are eventually populated, the field names should be updated per the mapping above.

**`doNotTrain`**: Currently a top-level boolean on all eval cards (always `true`). In a future schema revision, this may also feed into a broader `usageRestrictions` object, but the top-level field will remain for backwards compatibility.

---

## 6. Vitality Legend

UNESCO vitality status for target languages, sourced from language cards:

| Status | Meaning | # Targets |
|--------|---------|-----------|
| **critically-endangered** | Most members of youngest generation are speakers. But the language is not spoken in most everyday contexts. | 1 (Hawaiian) |
| **severely-endangered** | Language is spoken by grandparents and older generations. While the parent generation may understand it, they do not speak it to children or among themselves. | 1 (Plains Cree — EDTeKLA) |
| **definitely-endangered** | Children no longer learn the language as mother tongue in the home. | 1 (Northern Sámi) |
| **vulnerable** | Most children speak the language, but it may be restricted to certain domains (e.g., home). | 10 (Welsh, Igbo, Pangasinan, Kapampangan, Waray, Catalan, Basque, Western Frisian, Galician, Quechua) |
| **safe** | Language is spoken by all generations; intergenerational transmission is uninterrupted. | 33 |
| **NO_CARD** | No language card found for this ISO 639-3 code. | 1 (sqi — Albanian macrolanguage) |

---

## Quick Stats

| Metric | Value |
|--------|-------|
| Total cards | 51 |
| Eval cards | 48 |
| Reference cards | 3 |
| Unique source languages | 9 (eng, fra, dan, deu, ita, nld, por, rus, spa) |
| Unique target languages | 44 |
| Endangered/vulnerable targets | 13 of 44 (30%) |
| Smallest eval set | eng→ibo: 35 entries |
| Largest eval set | eng→crk-textbook: 486 entries |
| All eval doNotTrain | ✅ (100%) |
| Cards with secretTest | 0 |
| Cards with stewardship | 0 |
| Cards with submission terms | 0 |
