---
sidebar_position: 3
title: Evaluation Datasets
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# Evaluation Datasets

> **Executive Summary.** This page describes the evaluation datasets available for benchmarking, including the corpus entry schema, difficulty tiers (1–5), and provenance requirements. The catalogue is **~4,700 fetch-from-source evaluation datasets across 19 corpus families** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, the WMT newstest/General blind sets 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) plus FLORES+ — corpus *content* is never hosted here; each dataset is a sha-pinned metadata card rebuilt deterministically from its pinned upstream archive. A **non-commercial / research-only lane** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k, and the WMT research-use sets) is excluded from any commercial / prize / API path; within it, corpora under modified, bespoke, or unstated grants are additionally **consent-gated** — remote model-API evaluation refuses unless the license text itself grants evaluation use (recorded as an explicit per-dataset decision, as with the WMT research-use sets) or the rights-holder's permission is recorded on the dataset entry. The two human-curated reference datasets — EDTeKLA Dev v1 (Plains Cree) and FLORES+ Devtest (870 catalogued language pairs, 1,012 sentences each) — are detailed below; EdTeKLA's full entry-count breakdown is stated once, in [its section](#edtekla-development-set-v1).

Datasets are the fixed targets that the harness runs against. Each dataset is a JSON file containing source→target pairs with gold-standard references. The harness scores model outputs against these references — it never modifies them.

:::danger[DO NOT TRAIN on evaluation data]

⚠️ **These datasets are evaluation-only.** Methods trained, fine-tuned, few-shot-prompted, or otherwise exposed to evaluation data will produce artificially inflated scores and will be **disqualified from the leaderboard.**

Use separate corpora for training. Evaluation sets must remain unseen by your model during development.
:::

---

## Dataset Format {#dataset-format}

Every dataset follows the same JSON schema:

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[Canonical Schema]
The [Benchmark Specification](/docs/network/specifications/benchmark) defines the canonical corpus and entry schema. This page documents available datasets and how to create new ones.
:::

### Top-Level `dataset` Block

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique dataset identifier (used in run cards and leaderboard) |
| `version` | `string` | Semantic version. Incrementing this invalidates prior run card comparisons |
| `language_pair` | `string` | Display label (e.g., `EN→CRK`) |
| `description` | `string` | Optional. Human-readable summary |
| `source_language` | `string` | BCP 47 source language code |
| `target_language` | `string` | BCP 47 target language code |
| `created` | `string` | ISO 8601 creation date |
| `license` | `string` | SPDX license identifier |
| `provenance` | `string[]` | List of provenance tags used across entries |

### Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | Unique entry identifier within the corpus |
| `source` | `string` | ✅ | The source text to translate |
| `reference` | `string` | ✅ | The gold-standard reference translation |
| `difficulty` | `integer` | ✅ | Difficulty tier 1–5 (see below) |
| `provenance` | `string` | ✅ | Origin of this entry (e.g., `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | Register/formality level (e.g., `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | Communicative function (e.g., `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | Optional context for human reviewers |
| `morphological_analysis` | `string` | ❌ | Gold-standard morphological breakdown |
| `variant_class` | `string` | ❌ | Class label grouping acceptable translation variants |

---

## Available Datasets

The catalogue is **~4,700 fetch-from-source evaluation datasets across 19 corpus
families**, plus the two human-curated reference datasets (EDTeKLA + FLORES)
detailed below — a registry total of **5,602 datasets** as of 2026-07-12. Every
corpus is a **sha-pinned metadata card** — corpus content is never hosted here;
it is rebuilt deterministically from its pinned upstream archive at evaluation
time. All datasets carry `do_not_train`. One source card fans out to many
per-pair datasets, so the registry total exceeds the ~1,417 source cards; the
open-lane datasets feed the sweep queue directly; the research-only lane runs
on demand where its license clearly permits it (modified/bespoke/unstated
grants are consent-gated for remote model-API evaluation).

| Family | Datasets | Builder / source | License | Lane |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1,260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | open |
| **IN22** (Conv + Gen) | 1,012 | AI4Bharat / IIT Madras | CC-BY-4.0 | open (HF-gated download) |
| **Tatoeba** | 874 | [Tatoeba community](https://tatoeba.org), via the Tatoeba Challenge | CC-BY-2.0 | open |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | open |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | open |
| **WMT newstest / General** (2014–2025 blind sets) | 178 | WMT (Conference on Machine Translation), via sacreBLEU | `LicenseRef-WMT-Research-Use` | **research use** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | open |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | open |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | open |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **non-commercial / research-only** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | open (share-alike) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **research-only** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (shared-task organizers) | CC-BY-NC-SA-4.0 | **non-commercial / research-only** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (organizers) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **research-only** |
| **Gamayun** | 8 | CLEAR Global (formerly Translators without Borders) | `LicenseRef-TWB-Gamayun` | **non-commercial / research-only** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **non-commercial / research-only** |
| **EDTeKLA / prize** | 3 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **non-commercial / research-only (quarantined)** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **non-commercial / research-only** |
| **MENYO-20k** | 2 | Masakhane / Saarland University (uds-lsv) | CC-BY-NC-4.0 | **non-commercial / research-only** |

*(FLORES+ devtest — 870 catalogued pairs, CC-BY-SA-4.0 — is the reference
dataset detailed below, bringing the registry total to 5,602.)*

:::info[The non-commercial research-only lane]
Most of the catalogue is permissively licensed (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) and usable across every lane. A small set — **Gamayun** (TWB's
bespoke license) and **EDTeKLA** (a modified, sovereignty-scoped CC BY-NC-SA) — is **non-commercial**: it is
carved out of any commercial, prize, or API path. For corpora under
modified, bespoke, or unstated grants, remote model-API evaluation is
additionally **consent-gated**: the harness refuses to send their text to
third-party model APIs unless the license text itself grants evaluation use
(recorded as an explicit per-dataset decision — the WMT research-use sets
carry one) or the rights-holder's explicit permission is recorded on the
dataset entry (local evaluation remains possible). Eligibility is **use-based**: the commercial lane is strict,
the research lane is lenient, and quarantine always wins (so the improper EdTeKLA
slices can never rank). See
[Registering Corpora & Exposure Lanes](/docs/network/sovereignty/registering-corpora) for
how a corpus chooses its lane.
:::

The reference datasets are detailed below; the family corpora follow the same
JSON schema and are listed in the dataset registry.

:::note[A catalogue is not a populated board]
A large corpus catalogue is what methods *can* be benchmarked against — it is
not a leaderboard full of results. The board itself is seeding; see the
[leaderboard rules](/docs/network/leaderboard/rules) and
[Honest Limitations](/docs/network/honest-limitations).
:::

### EDTeKLA Development Set v1 {#edtekla-development-set-v1}

The first evaluation dataset, built for English→Plains Cree (SRO) translation. Created by the [EdTeKLA research group](https://spaces.facsci.ualberta.ca/edtekla/) at the University of Alberta.

| Property | Value |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Version** | `1.0` |
| **Language pair** | EN → CRK (Plains Cree, SRO orthography) |
| **Entry count** | 436-entry dev split (`textbook_dev.json`). Chain: 589 raw aligned lines upstream → 486 unique valid pairs after normalization/dedup (a Champollion-derived count) → 436 dev + 50 held-out (Champollion's deterministic seed-42 split — EdTeKLA publishes the raw files, not a split). A separate 62-entry gold-standard set (hand-curated, research-only, **not** EdTeKLA material) brings the project's combined Plains Cree eval collection to 548. |
| **Difficulty distribution** | Easy, Medium, Hard |
| **Provenance** | `gold_standard` (verified by speakers), `textbook` (published educational materials) |
| **License** | [EdTeKLA's modified CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — sovereignty-scoped; the root textbook is CC BY-NC-ND 4.0) — **carved out of the leaderboard, prize, and commercial/API lanes** (non-commercial) |

> **This is the canonical statement of the Plains Cree eval-set counts.** Other
> pages link here rather than restating them. The 486/436/50 figures are
> Champollion-derived from EdTeKLA's raw aligned files (EdTeKLA itself publishes
> no counts or splits); the 62-entry gold-standard set has separate, non-EdTeKLA
> provenance. The count above is always paired with its lane: EdTeKLA carries a modified,
> sovereignty-scoped CC BY-NC-SA and is **carved out of the leaderboard, prizes, and the
> commercial/API path**.

**What it tests:**

- Basic greetings and common phrases
- Noun animacy and obviation
- Verb conjugation across persons and tenses
- Locative constructions
- Possessive paradigms
- Complex sentence structures

:::tip[Corpus structure]
The EdTeKLA-derived material splits into a public dev set and a held-out set (Champollion's split of EdTeKLA's raw textbook alignment — counts in the table above). The separate 62-entry gold-standard set is hand-curated from other sources and is not part of the EdTeKLA corpus. A smaller, high-quality dataset with verified gold standards is more useful than a large, noisy one — especially for a low-resource language where "close enough" translations are often morphologically invalid.
:::

---

## Creating a New Dataset

To create a dataset for a new language pair or domain:

### 1. Structure the JSON

Follow the [Dataset Format](#dataset-format) schema. Every entry must have `source`, `reference`, `difficulty`, `provenance`, `register`, and `context`.

### 2. Assign a unique ID

Use a descriptive slug: `{project}-{split}-v{version}` (e.g., `edtekla-dev-v1`, `quechua-test-v1`).

### 3. Verify gold standards

Every `reference` value must be verified by a fluent speaker or sourced from a published, peer-reviewed resource. Machine-generated references defeat the purpose of evaluation.

### 4. Set difficulty tiers

Assign each entry an integer difficulty level:

| Tier | Description | Examples |
|------|-------------|----------|
| 1 — Basic vocabulary | Single words, common greetings, numbers | "hello" → "tânisi" |
| 2 — Simple sentences | Subject-verb or SVO, present tense | "I see the dog" |
| 3 — Moderate complexity | Past/future tense, possessives, animacy | "I saw his dog yesterday" |
| 4 — Complex morphology | Obviation, passive voice, conjunct order | "the woman whose son went to the store" |
| 5 — Advanced | Multi-clause, formal register, ceremonial, idiomatic | Full paragraph with register-appropriate tone |

### 5. Tag provenance

Each entry should indicate where it came from. Common tags:

- `gold_standard` — Verified by fluent speakers
- `textbook` — From published educational materials
- `elicited` — Produced through structured elicitation sessions
- `corpus` — Extracted from a parallel corpus

### 6. Validate the file

Run the harness against your dataset with any model to verify the JSON is well-formed and all required fields are present:

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

The harness will error on missing fields, duplicate indices, or schema violations.

### 7. Submit for inclusion

Open a pull request against the [eval harness repository](https://github.com/gamedaysuits/Champollion) that adds a **fetch-from-source metadata card** — a registry entry pointing the harness at the upstream source (loader/URL, SHA pin, license, and provenance). **Never commit corpus content itself.** Champollion does not host or track third-party corpus text; the harness fetches references from the upstream source at run time and scores against the freshly fetched data. Validate locally first (step 6), then submit only the card. Include documentation of your verification methodology and provenance sources.

---

## FLORES+ Devtest

A broad-coverage multilingual benchmark maintained by the [Open Language Data Initiative (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus). Used for champollion's multi-model frontier comparisons.

| Property | Value |
|----------|-------|
| **ID** | One card per pair: `eval-flores-devtest-v1-<src>-<tgt>` (e.g. `eval-flores-devtest-v1-amh-fra`) |
| **Language pairs** | 870 catalogued and runnable pairs (812 of them between two non-English languages) |
| **Entry count** | 1,012 sentences per pair |
| **License** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **Source** | Meta FLORES-200, now OLDI-maintained — fetched from source, SHA-pinned per pair (corpus content is never tracked here) |
| **Contamination** | **HIGH** — relative-only, test / illustration only (see note) |

:::warning[HIGH-contamination — relative-only, never an absolute benchmark]
FLORES+ is public, web-crawled data that frontier models have very likely already
seen. Champollion runs it in a **relative-only** lane: usable to compare methods
head-to-head, but **never reported as an absolute-quality score**, and **never
used as a chain edge** on the [translation map](https://champollion.dev).
It is for **testing and illustration only**.
:::

:::danger[Evaluation only]
FLORES+ is intended solely for evaluation. The curators explicitly request that it **not be used as training data**. Ensure its contents are excluded from any training corpora.
:::

---

## See Also

- [MT Evaluation](/docs/network/leaderboard/rules) — overview of the evaluation framework and leaderboard
- [Eval Harness](/docs/network/specifications/harness) — how to run evaluations against these datasets
- [Run Card Specification](/docs/network/specifications/run-card) — the JSON schema for recording results
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [EdTeKLA Project](https://spaces.facsci.ualberta.ca/edtekla/) — the University of Alberta research group behind the Cree dataset
