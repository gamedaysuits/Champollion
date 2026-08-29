---
sidebar_position: 6
title: 'Benchmark Specification'
slug: '/network/specifications/benchmark'
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The corpora currently in play"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
---

# Benchmark Specification

> **Executive Summary.** This document defines the evaluation protocol for the Champollion MT evaluation ecosystem: corpus format (§2), run card schema (§3), benchmark protocol (§6), human validation requirements (§7), sovereignty mechanisms (§8), leaderboard and submission model (§9), cost framework (§10), and extensibility to new languages (§11). For metric definitions, composite scoring weights, quality tier thresholds, and cost/speed metric formulas, see `SCORING_SPEC.md` — the single source of truth for all scoring logic. This document references SCORING_SPEC for those details rather than duplicating them.


---

## 1. Principles

### 1.1 Languages Are Biodata

A language is not neutral test material. Like genetic or health data, language data is **biodata**: it carries the identity, kinship, and relationships of the people who speak it, and it cannot be meaningfully anonymized — strip the metadata and the language still encodes who its people are. The consequence for this specification is concrete: the people who provide a corpus hold the keys to it, and to anything measured against it. Sovereignty (§8) is therefore not an add-on to the protocol; it is a precondition of it, and every other principle below operates inside it.

### 1.2 Automated Metrics Are Proxies

Every metric defined in this document is machine-computed. chrF++, FST acceptance, morphological accuracy, semantic similarity — all of them are automated proxies for translation quality. They are useful for rapid iteration, systematic comparison, and detecting regressions. They are **not substitutes for human judgment**.

The evaluation hierarchy:

```
Automated metrics (run cards, benchmarks)
    ↓ proxy for
Human review (bilingual speakers validate output)
    ↓ proxy for
Actual utility (does this help a language community?)
```

No automated score, no matter how high, can replace a fluent speaker reading the output and confirming it is correct, natural, and culturally appropriate. The quality tiers defined in §5 are heuristic labels on automated composite scores — useful for tracking progress, but never sufficient on their own.

### 1.3 Methods, Not Models

We benchmark **methods**, not models. A model is one component. A method is the full recipe: model selection, prompt design, tool usage, pre/post-processing, coaching data, retry strategies, everything. Two teams using the same model with different methods will get different scores. That's the point.

### 1.4 Reproducibility

Every benchmark result must be reproducible. The run card (§3) captures the complete configuration of an experiment. The fingerprint (§3.5) identifies the experimental setup. The run card hash (§3.6) verifies the integrity of the result. Anyone with the same method, corpus, and configuration should achieve scores within ±2% (accounting for LLM sampling non-determinism at temperature > 0).

### 1.5 No Synthetic Evaluation Data

**This project does not generate, use, or endorse synthetic evaluation data.** All corpora must be sourced from genuine human-authored text — published translations, textbooks, bilingual documents, or elicited translations from fluent speakers.

LLMs may assist with:
- Sentence alignment (finding parallel passages in existing bilingual texts)
- Format conversion (converting published materials into the corpus schema)
- Metadata enrichment (suggesting difficulty tiers, register labels)
- Proposing source sentences for human translation (§11.3 — the translation step is always human)

LLMs must **never** generate reference translations or evaluation pairs.

**We are development-neutral on training data.** If a method developer uses synthetic training data, backtranslation, or data augmentation in their method, that is their choice — we evaluate the output, not the training process. Meta's OMT-1600 uses approximately 270 million synthetic parallel sentences generated via backtranslation. We have no objection to methods trained this way. We test on human curation only.

> **Why not Bible text for evaluation?** OMT-1600 evaluates 1,560 of 1,600 languages on Bible-domain text (Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026). Bible translations have archaic register, liturgical vocabulary, and formulaic sentence structure. Our evaluation corpora are sourced from community-curated, domain-diverse text — health, legal, educational, governmental, conversational, and technical domains (see §2.7). This is a deliberate design choice. Communities need translation for the domains where they actually live and work, not a single religious register. A method that scores well on Genesis 1:1 tells you almost nothing about its performance on a band council agenda or a clinic intake form.

---

## 2. Corpus Schema

A corpus is a curated set of parallel text pairs with structured metadata. It is the ground truth against which all methods are measured.

### 2.1 Dataset Envelope

The top-level structure of a corpus file:

```json
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-05-01",
    "license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique dataset identifier, used in run cards and leaderboard |
| `version` | string | ✅ | Semantic version. Incrementing invalidates prior run card comparisons |
| `language_pair` | string | ✅ | Display label (e.g., `EN→CRK`) |
| `source_language` | string | ✅ | BCP 47 source language code |
| `target_language` | string | ✅ | BCP 47 target language code |
| `created` | string | ✅ | ISO 8601 creation date |
| `license` | string | ✅ | SPDX license identifier |
| `provenance` | string[] | ✅ | List of provenance tags used across entries |

### 2.2 Entry Schema

Each entry in the corpus represents one translation challenge:

```json
{
  "id": 42,
  "source": "I see the dog",
  "reference": "niwâpamâw atim",
  "segment": "gold_standard",
  "difficulty": 2,
  "provenance": "gold_standard",
  "register": "conversational",
  "context": "declaration",
  "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
  "notes": "Animate noun (atim); direct form because speaker is proximate",
  "variant_class": "simple-ta-direct"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | integer | ✅ | Unique identifier within the corpus |
| `source` | string | ✅ | Source text in the source language |
| `reference` | string | ✅ | Gold-standard reference translation in the target language |
| `segment` | string | 📎 | Corpus partition: `gold_standard`, `held_out`, `development`, or `diagnostic` |
| `difficulty` | integer | 📎 | Difficulty rating 1–5 (see §2.4) |
| `provenance` | string | 📎 | Origin of this entry (see §2.5) |
| `register` | string | 📎 | Register/formality level (see §2.6) |
| `context` | string | 📎 | Communicative function (see §2.6) |
| `domain` | string | 📎 | Use-case domain from the 16-code taxonomy (see §2.7). Must be one of: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech`, `ui`. Validated at construction time. |

> **📎 = RECOMMENDED.** The harness handles missing optional fields gracefully via defaults. Third-party corpora need only provide `id`, `source`, and `reference` per entry.
| `morphological_analysis` | string | ❌ | Gold-standard morphological breakdown |
| `notes` | string | ❌ | Translator notes, dialectal variants, ambiguity flags |
| `variant_class` | string | ❌ | Class label grouping acceptable translation variants |


### 2.3 Corpus Segments

The corpus is divided into segments with different access levels:

| Segment | Purpose | Access | Minimum Size |
|---------|---------|--------|-------------|
| `development` | Method development and iteration. Developers use these freely. | **Public** | 30 entries |
| `diagnostic` | Targeted tests for specific linguistic phenomena. | **Public** | 10 entries |
| `gold_standard` | Official benchmark evaluation. Leaderboard scores come from here. | **Secret** — held by governance org | 50 entries |
| `held_out` | Reserved for future evaluation. Never used until activated. | **Secret** — held by governance org | 10 entries |

> **Current state:** Only the `development` segment exists in shipped datasets. The `diagnostic`, `gold_standard`, and `held_out` segments are defined for future use as corpora grow.

The `gold_standard` and `held_out` segments are fully secret. Both the source sentences and the reference translations are held on governance-controlled infrastructure. Method developers never see the questions or the answers. See §8 for the sovereignty mechanism.

### 2.4 Difficulty Tiers

| Tier | Description | Examples |
|------|-------------|----------|
| 1 — Basic vocabulary | Single words, common greetings, numbers | "hello" → "tânisi", "dog" → "atim" |
| 2 — Simple sentences | Subject-verb or SVO, present tense | "I see the dog" → "niwâpamâw atim" |
| 3 — Moderate complexity | Past/future tense, possessives, animacy | "I saw his dog yesterday" |
| 4 — Complex morphology | Obviation, passive voice, conjunct order, relative clauses | "the woman whose son went to the store" |
| 5 — Advanced | Multi-clause, formal register, ceremonial, idiomatic | Full paragraph with register-appropriate tone |

A well-constructed corpus should include entries across all five difficulty tiers, weighted toward tiers 2–4 where most real-world translation challenges fall.

### 2.5 Provenance Tags

Every entry must indicate its origin:

| Tag | Meaning |
|-----|---------|
| `gold_standard` | Verified by fluent speakers |
| `textbook` | From published educational materials |
| `elicited` | Produced through structured elicitation sessions |
| `corpus` | Extracted from a parallel corpus |

> **Note:** In practice, provenance values are free-form strings. The tags above are conventions, not a validated enum — datasets may use other descriptive provenance strings.

### 2.6 Register and Context

**Register** describes the formality and social context:

| Register | Description |
|----------|-------------|
| `conversational` | Everyday speech between equals |
| `formal` | Official or institutional language |
| `technical` | Domain-specific vocabulary |
| `ceremonial` | Traditional or sacred language use |
| `educational` | Language teaching materials |

**Context** describes the communicative function:

> 🔲 **Planned.** The `context` field is defined in the schema but not yet populated in current datasets. It is reserved for future corpus enrichment.

| Context | Description |
|---------|-------------|
| `greeting` | Social greeting or leave-taking |
| `declaration` | Statement of fact |
| `question` | Interrogative |
| `instruction` | Command or directive |
| `narrative` | Storytelling or description |
| `label` | UI label, button text, or heading |
| `error` | Error message or warning |

### 2.7 Domain {#27-domain}

**Domain** describes the real-world use case — the type of content being translated. This is orthogonal to register and context:

- **Register** answers: *How formal is this?*
- **Context** answers: *What is this sentence doing?*
- **Domain** answers: *What industry/use case is this for?*

A legal contract (domain: `legal`) might be formal (register: `formal`) and contain a declaration (context: `declaration`). A legal chatbot transcript (domain: `legal`) might be conversational (register: `conversational`) and contain questions (context: `question`). Same domain, different register and context.

| Domain Code | Description | Typical Consumers |
|-------------|-------------|-------------------|
| `ui` | Software interface strings | App developers, localization teams |
| `legal` | Contracts, statutes, court filings, immigration documents | Law firms, courts, compliance teams, IP lawyers |
| `medical` | Clinical notes, drug labels, patient communications, trial protocols | Hospitals, pharma, clinical trials, patient portals |
| `financial` | Banking, insurance, regulatory filings, audit reports | Banks, insurers, regulators, auditors |
| `edu` | Textbooks, curricula, lesson plans, academic materials | Schools, universities, textbook publishers |
| `ecommerce` | Product descriptions, reviews, marketplace listings | Online retailers, marketplace sellers |
| `marketing` | Ad copy, brand messaging, campaigns, slogans | Ad agencies, brand teams |
| `gov` | Policy documents, regulations, public notices, legislation | Government agencies, compliance teams |
| `scientific` | Research papers, abstracts, methodology, grant proposals | Researchers, journals, grant agencies |
| `religious` | Scripture, liturgical texts, theological commentary | Faith communities, liturgical publishers |
| `support` | FAQs, error messages, troubleshooting guides, chatbot scripts | SaaS companies, help desks |
| `subtitles` | Film, TV, streaming, and gaming dialogue | Streaming platforms, studios, gaming companies |
| `news` | Journalism, wire reports, editorial, press releases | Media organizations, wire services |
| `literary` | Fiction, poetry, narrative, cultural texts | Publishers, cultural preservation orgs |
| `conv` | Informal conversation, social media, messaging | Consumer apps, social platforms |
| `tech` | API docs, manuals, engineering specifications, technical guides | Documentation teams, engineering orgs |

> **Domain-specific benchmarks.** The general benchmark evaluates a method across all domains. But the Network also supports **domain-filtered benchmarks** — where scores are computed only on entries tagged with a specific domain. This lets users answer: "Which method is best for translating legal documents into French?" vs. "Which method has the best overall French score?"
>
> Domain-filtered leaderboard rankings let users compare methods within a single use case. Different methods perform differently across domains — a method fine-tuned on legal terminology may score far higher on legal text than on conversational text. The Network helps users find the method that works best for their specific use case.

> **Future: Network assistant.** A conversational assistant that helps users describe their MT use case (domain, language pair, quality requirements) and surfaces relevant community-validated methods from the leaderboard — for example, "which method scores highest on medical-domain EN→JA benchmarks?" — is a navigability aid we are considering, gated on sufficient domain-tagged evaluation data and method diversity.

---

## 3. Run Card Schema {#3-run-card-schema}

The run card is the atomic unit of evaluation. It is a self-contained JSON document that records the complete configuration and results of a single evaluation run: one method, one model, one configuration, one dataset.

Every run card captures three dimensions:
- **Quality** — how good are the translations?
- **Cost** — how much did it cost to produce them?
- **Speed** — how long did it take?

### 3.1 Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `run_id` | string | UUID v4 generated at the start of the run |
| `harness_version` | string | Semantic version of the harness (e.g., `2.0`) |
| `timestamp` | string | ISO 8601 UTC timestamp when the run started |
| `elapsed_seconds` | number | Wall-clock duration of the entire run |

### 3.2 Method Configuration

These fields define the experimental setup — what was tested and how.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_slug` | string | ✅ | Model identifier (e.g., `google/gemini-2.5-flash`) |
| `model_id` | string | ❌ | Resolved model identifier returned by the API |
| `condition` | string | ✅ | Experiment label (e.g., `baseline`, `coached-v3`, `few-shot`) |
| `temperature` | number | ✅ | Sampling temperature |
| `system_prompt_sha256` | string | ✅ | SHA-256 hash of the full system prompt |
| `system_prompt_used` | string | ✅ | The full system prompt text |
| `coaching_data_sha256` | string | ❌ | SHA-256 hash of coaching data file, if used |
| `fst_version` | string | ❌ | Version of FST analyzer, if used |
| `tools_enabled` | string[] | ❌ | List of tools available to the method |
| `batch_size` | number | ❌ | Entries per concurrent API batch |
| `max_retries` | number | ❌ | Maximum retries for FST rejection, if applicable |

:::info[Published Run Cards Include method_config]
When a run card is published to the leaderboard (via `mt-eval publish`), it also includes a `method_config` block containing the canonical 8-field MethodConfig (`model`, `temperature`, `batchSize`, `register`, `coachingFile`, `coachingPrompt`, `promptContext`, `qualityTier` — all camelCase). This enables zero-reconstruction import: `champollion leaderboard --install` reads `method_config` directly and writes it as a plugin manifest. The telemetry fields above (§3.2) record what the harness observed; `method_config` records what the developer intended.
:::

### 3.3 Dataset Reference

| Field | Type | Description |
|-------|------|-------------|
| `dataset.id` | string | Dataset identifier |
| `dataset.version` | string | Dataset version |
| `dataset.language_pair` | string | Display label |
| `dataset.sha256` | string | SHA-256 hash of the dataset file contents |
| `dataset.entry_count` | number | Number of entries evaluated |

The dataset SHA-256 pins the result to a specific version of the data. If the dataset changes, old run cards are not comparable.

### 3.4 Scores (Quality)

Aggregate metrics for the entire run. All quality metrics are **automated** — see §1.2.

| Field | Type | Description |
|-------|------|-------------|
| `scores.total` | number | Total entries evaluated |
| `scores.exact_matches` | number | Entries where output exactly matched reference |
| `scores.exact_match_rate` | number | 0.0–1.0 |
| `scores.equivalent_matches` | number | Entries matching an acceptable variant |
| `scores.equivalent_match_rate` | number | 0.0–1.0 |
| `scores.fst_accepted` | number | Entries accepted by FST analyzer |
| `scores.fst_acceptance_rate` | number | 0.0–1.0, `null` if no FST configured |
| `scores.morphological_accuracy` | number | 0.0–1.0, FST-derived (lemma-matched), `null` if no FST / no lemma-matched words. Advisory until activated — see Scoring Spec §2.2 |
| `scores.morph_coverage` | number | 0.0–1.0, fraction of analyzable predicted words lemma-matched to the reference (discloses how sparse `morphological_accuracy` is) |
| `scores.chrf_plus_plus` | number | Corpus-level chrF++ score (0–100) |
| `scores.semantic_score` | number | Embedding-based semantic similarity (0.0–1.0) |
| `scores.ter` | number | Translation Edit Rate (0–∞, lower is better) |
| `scores.length_ratio` | number | avg(len(predicted)/len(reference)), ideal = 1.0 |
| `scores.code_switching_rate` | number | 0.0–1.0, fraction of entries with source-language leakage |
| `scores.hallucination_rate` | number | 0.0–1.0, fraction of entries with hallucinated content |
| `scores.terminology_adherence` | number | 0.0–1.0, adherence to glossary terms (`null` if no glossary) |
| `scores.tokens_per_second` | number | total_tokens / elapsed_seconds |
| `scores.entries_per_minute` | number | entries translated per minute |
| `scores.composite` | number | Weighted composite score (0.0–1.0). See SCORING_SPEC §4 |
| `scores.errors` | number | Entries that failed (API error, timeout, etc.) |
| `scores.by_difficulty` | object | Scores broken down by difficulty tier |
| `scores.by_provenance` | object | Scores broken down by provenance tag |
| `scores.by_domain` | object | ✅ Implemented — Scores broken down by domain (§2.7). Enables domain-filtered leaderboard ranking. Computed by tester.py and passed through publish.py. |

### 3.5 Totals (Cost)

| Field | Type | Description |
|-------|------|-------------|
| `totals.prompt_tokens` | number | Total input tokens across all API calls |
| `totals.completion_tokens` | number | Total output tokens |
| `totals.reasoning_tokens` | number | Tokens used for chain-of-thought (0 for most models) |
| `totals.cached_tokens` | number | Tokens served from provider's prompt cache |
| `totals.total_cost_usd` | number | Total cost in USD |
| `totals.cost_per_entry_usd` | number | `total_cost_usd / entry_count` |
| `totals.cost_per_source_char` | number | USD per source character — comparable across languages |

### 3.6 Timing (Speed)

| Field | Type | Description |
|-------|------|-------------|
| `elapsed_seconds` | number | Wall-clock duration of the full run (top-level) |
| `scores.avg_latency_seconds` | number | Mean response time per entry |
| `scores.median_latency_seconds` | number | Median response time per entry |
| `scores.p95_latency_seconds` | number | 95th percentile response time per entry |

### 3.7 Per-Entry Results

Each entry in the `results[]` array records one translation. Per-entry data is persisted in the `run_card_entries` table (migration 005) with denormalized LYSS verdicts (migration 006).

| Field | Type | Description |
|-------|------|-------------|
| `entry_id` | string | Matches `entries[].id` in the corpus |
| `source` | string | Source text that was translated |
| `expected` | string | Gold-standard reference translation |
| `raw_predicted` | string \| null | Raw model output before post-processing |
| `predicted` | string | Method's actual output (post-processed) |
| `segment` | string | Segment identifier (e.g., sentence index) |
| `difficulty` | string \| null | Difficulty tier from the corpus |
| `domain` | string | Domain tag from the corpus (§2.7) |
| `exact_match` | boolean | Whether output exactly matched reference |
| `chrf_score` | number \| null | Sentence-level chrF++ (0–100) |
| `bleu_score` | number \| null | Sentence-level BLEU (0–100) |
| `latency_s` | number \| null | Response time in seconds |
| `cost_usd` | number \| null | Cost in USD for this entry |
| `tool_call_count` | integer | Number of tool calls used (0 if none) |
| `error` | string \| null | Error message if this entry failed |
| `plugin_metrics` | object | Full per-entry plugin output (JSONB) |
| `fst_valid` | boolean \| null | GiellaLT FST accepted the prediction (denormalized LYSS-fst) |
| `equivalent_match` | boolean \| null | CRK linter confirmed structural equivalence (denormalized LYSS-eq) |
| `semantic_verdict` | string \| null | LYSS-sem verdict: `VALID`, `MISMATCH`, `UNKNOWN`, `ERROR` |
| `code_switching_detected` | boolean \| null | Source-language tokens detected in output |
| `hallucination_detected` | boolean \| null | Fabricated content detected in output |



### 3.8 Fingerprint

A reproducibility identifier. Two runs with identical fingerprints used the same experimental setup.

The fingerprint is the SHA-256 hash of the sorted concatenation of:
- `dataset.sha256`
- `model_slug`
- `condition`
- `system_prompt_sha256`
- `temperature`
- `harness_version`
- `batch_size`
- `tools_enabled`

> **Why 8 components?** Batch size and tool-calling materially affect output quality and must be included in the identity. Two runs with different batch sizes or different tools enabled are different experimental setups, even if all other parameters match.

Two runs with identical fingerprints should produce comparable results. Differences are due to API non-determinism (temperature > 0) or provider-side model updates.

### 3.9 Run Card Hash

The SHA-256 hash of the entire run card JSON (with the `run_card_hash` field itself set to `""` during hashing). This is the tamper-detection seal. If any field changes, the hash breaks.

---

## 4. Automated Metrics

All metrics in this section are machine-computed. See §1.2.

### 4.1 Metric Definitions

| Metric | Status | What It Measures | Range |
|--------|--------|-----------------|-------|
| **chrF++** | ✅ Implemented | Character n-gram F-score. Operates at the character level, making it more robust than word-level metrics (BLEU) for morphologically rich languages where words are long and highly inflected. Computed by sacrebleu. | 0–100 (native scale). Divided by 100 when used in composite. |
| **FST acceptance rate** | ✅ Implemented | Fraction of predicted words accepted by the morphological analyzer (GiellaLT HFST) as valid forms in the target language. A word the FST accepts is a real, structurally valid word — not a hallucination. | 0.0–1.0 |
| **Exact match** | ✅ Implemented | Fraction of predictions that exactly match the reference after Unicode normalization. Strict but unambiguous — useful as a ceiling check. | 0.0–1.0 |
| **Morphological accuracy** | 🔲 Planned | For entries with gold-standard morphological analysis: fraction of morphemes correctly generated. More granular than FST acceptance — a word can be FST-valid but have the wrong morpheme structure (right root, wrong tense). | 0.0–1.0 |
| **Equivalent match** | ⚡ Partial | Fraction matching an acceptable variant of the reference — accounting for word order, dialectal differences, and orthographic conventions. Currently implemented for CRK via the CRK eval standard's `CrkLinterMetric` (in `eval_standards/crk/`); loaded automatically via the CRK language card's `evalMetrics` declaration. Generic implementation requires per-entry `variants[]` in corpus. | 0.0–1.0 |
| **Semantic score** | ⚡ Partial | Meaning preservation regardless of surface form. Currently implemented for CRK via the CRK eval standard's `CrkSemanticMetric` (in `eval_standards/crk/`, verdict-weighted proxy). Universal embedding-based cosine similarity is planned — see SCORING_SPEC §2.3. | 0.0–1.0 |

### 4.2 Composite Score

The composite score is a weighted average of all *available* metrics:

```
composite = Σ (weight_i × metric_i)   for all available metrics
             ─────────────────────
             Σ weight_i              (renormalized to sum to 1.0)
```

When a metric is unavailable (no FST configured, no variant classes defined, no embedding model), its weight is redistributed proportionally across the remaining metrics. This means the composite is always comparable within a language — it uses whatever metrics are available for that language and normalizes accordingly.

**Weight tables, input normalization rules, and the full metric inventory are defined in `SCORING_SPEC.md` §4.** That document is the SSOT for:
- Profile A weights (languages with FST coverage — 9 metrics, structural metrics carry 40%)
- Profile B weights (languages without FST coverage — 8 metrics)
- Normalization rules (chrF++ ÷ 100, code-switching and hallucination rate inversion)
- Metrics excluded from the composite (BLEU, COMET, TER, length ratio, consistency) and why

The harness code mirrors these tables in `mt_eval_harness/scoring.py`. When SCORING_SPEC changes, `scoring.py` is updated to match and `test_scoring_ssot.py` validates alignment.

> **Why not BLEU?** BLEU operates at the word level and penalizes morphological variation. For polysynthetic languages, a single word can be an entire clause — BLEU would treat minor inflectional differences as complete misses. chrF++ handles this better by operating at the character level. BLEU is excluded from both weight tables. See SCORING_SPEC Appendix A for the full rationale.


### 4.3 Cost-Adjusted Score

For methods using paid APIs, we also report a secondary ranking. The cost-adjusted formula is defined in `SCORING_SPEC.md` §6.3.

---

## 5. Quality Tiers {#5-quality-tiers}

Quality tiers are heuristic labels on automated composite scores. They describe what the scores tend to mean in practice, based on human review of outputs at each level. **They are not validated quality judgments** — only human review (§6) can confirm actual usability.

**The tier thresholds and descriptions are defined in `SCORING_SPEC.md` §5.** The tiers are: Baseline (0.00–0.30), Emerging (0.30–0.50), Functional (0.50–0.70), Deployable (0.70–0.85), and Fluent (0.85–1.00).

> [!IMPORTANT]
> **Automated tiers are provisional.** These labels are nominations for review, not quality declarations. A method reaching "Deployable" on automated metrics is a candidate for community evaluation — not a product to ship. Only human review (§7) can confirm actual usability. Tier boundaries may differ across languages.

These tiers are provisional. They will be recalibrated as human validation data accumulates and we learn where the actual "a speaker finds this useful" threshold falls for each language. The tier boundaries may differ across languages.

No method can claim **Deployable** or above without community review confirming that bilingual speakers agree the output is usable.

---

## 6. Benchmark Protocol

A **benchmark** is the systematic production of run cards across a declared parameter space on a given dataset. It is not a single run — it is a structured exploration of how different configurations perform.

### 6.1 What a Benchmark Produces

A benchmark produces a **matrix of run cards** — one for each combination of parameter values. The matrix enables multifaceted comparison across:

- **Quality** — composite score, individual metric breakdowns
- **Cost** — total and per-entry cost for each configuration
- **Speed** — wall-clock time and per-entry latency

There is no single "benchmark score." The benchmark is the full matrix. Different stakeholders will care about different facets: a researcher optimizes for composite score, a deployment engineer optimizes for cost-per-entry, a community reviews quality.

### 6.2 Parameter Space

A benchmark declares which parameters are permuted:

| Axis | Typical Values | Purpose |
|------|---------------|---------|
| `model` | 4–12 models (frontier + mid-tier + budget) | How much does model capability matter? |
| `temperature` | 0.0, 0.3, 0.7 | Does sampling randomness help or hurt? |
| `prompt_version` | 2–3 prompt strategies | How sensitive is the method to prompt design? |
| `coaching_config` | with/without coaching data | Does injecting linguistic knowledge improve output? |
| `tool_config` | with/without FST, with/without dictionary | Do linguistic tools improve output? |

The full permutation space:
```
runs = |models| × |temperatures| × |prompts| × |coaching| × |tools|
```

A typical initial benchmark: 12 models × 3 temperatures × 2 prompts × 2 coaching = 144 runs.

### 6.3 Baseline vs. Method Evaluation

A benchmark serves two distinct purposes:

**Baselining** — mapping the landscape with naive approaches. "What can existing models do for this language without any language-specific engineering?" This establishes the bar. The baseline matrix tells you: which models hallucinate least, which temperatures produce the most consistent output, whether coaching data helps at all, where all models fail uniformly (which reveals hard linguistic problems).

**Method evaluation** — testing a specific engineered method. "Does my FST-gated coached pipeline beat the baselines?" The method's run card is compared against the baseline matrix. A method is interesting when it outperforms the best baseline — when engineering adds value over naive model calls.

Both activities produce run cards with the same schema. The distinction is in the intent and the parameter space: baselines permute across models and configs; method evaluation tests one method against the best configurations.

### 6.4 Dev vs. Gold-Standard Evaluation

Method developers iterate freely against `development` and `diagnostic` corpus segments. This is informal — no limits, no submissions, no governance involvement. The developer is learning what works.

Official leaderboard scores come from `gold_standard` evaluation only. This is formal:
1. Developer submits their complete, runnable method (code + config + coaching data)
2. Governance org runs it in a sandboxed harness against the secret test set
3. Only scores come back

See §8 for the full sovereignty mechanism.

---

## 7. Human Validation {#7-human-validation}

Automated metrics are proxies. Human validation is the ground truth.

### 7.1 What Human Review Catches That Metrics Miss

- **Morphologically valid but semantically wrong** — the FST accepts the word, chrF++ is high, but the translation means something different
- **Culturally inappropriate** — the translation is technically correct but uses register or framing that a community would reject
- **Hallucinated plausibility** — the output looks like the target language to a non-speaker but is gibberish to a fluent speaker
- **Acceptable but unmarked variation** — the output is correct but the automated metrics mark it wrong because it uses a dialectal variant not in the reference

### 7.2 The Validation Gate

No method can advance from **Functional** to **Deployable** tier without human validation confirming that bilingual speakers agree the output is usable. This is not a formality — it is the point. The automated metrics exist to reduce the volume of output that needs human review. They cannot replace it.

### 7.3 Community Review Protocol

> 🔲 **Planned**: The community review interface is not yet live. This section describes the intended process.

1. A method reaches the Deployable threshold on automated metrics
2. A sample of outputs (stratified by difficulty tier) is presented to bilingual speakers
3. Speakers rate each translation on a scale: **reject**, **gist** (meaning is clear but phrasing is wrong), **acceptable** (correct with minor issues), **excellent** (indistinguishable from human translation)
4. The governance org reviews the aggregate ratings
5. If the community accepts the method, it proceeds to ownership transfer and deployment

The review has a minimum shape before it can confer the **Community Validated**
tier (§9.4): the stratified sample covers **at least 30 entries**, **at least 2
reviewers** — both qualified under the community's own protocol — and **at
least 70%** of entries must meet the community's acceptance bar. The tier is
conferred only by testing the community runs itself, at its discretion, and
demotion is symmetric: the same protocol run as a spot-audit removes the tier
just as publicly as it was granted.

---

## 8. Sovereignty

Evaluation datasets contain curated linguistic knowledge that belongs to the language community. This section defines the technical and legal framework for protecting that data.

### 8.1 The Problem

Conventional benchmarks publish test sets openly. Once published, the data cannot be un-published. For Indigenous and minority language communities, this creates an extractive dynamic — linguistic data is used without ongoing consent. Following Dhein's pragmatic view of biodata sovereignty, we treat linguistic data as a "mercurial resource with unknowable potential" requiring dynamic, relational governance.

### 8.2 Sandboxed Execution

The primary enforcement mechanism: the developer hands over their method module, the governance org runs it against the fully secret test set on their own infrastructure, and only scores are returned. The developer never sees the source sentences or the reference translations.

```mermaid
graph TD
    A["Developer builds method\nusing public development corpus"] --> B["Developer submits\nmethod module\n(code + config + coaching)"]
    B --> C["Governance org runs method\nin sandboxed harness\nagainst secret test set"]
    C --> D["Scores returned\nto developer"]
    D --> E{"Meets Deployable\nthreshold?"}
    E -->|Yes| F["Ownership transfer\n+ community review"]
    E -->|No| G["Developer iterates"]
    G --> A
```

The flow:
1. **Development corpus is public.** No restrictions on `development` and `diagnostic` segments.
2. **Gold-standard test set is fully secret.** Both source sentences and reference translations live on governance-controlled infrastructure.
3. **To get an official score, you hand over your method.** The governance org runs it in a sandbox. Only scores come back.
4. **The governance org already has the method.** The submission IS the method code. If it reaches the Deployable threshold, ownership transfer is already in progress.
5. **Submission requires agreement to terms.** Including the ownership transfer clause (§8.3).
6. **The governance org controls access entirely.** They can refuse or revoke evaluation at any time. Dynamic consent.
7. **Encryption at rest is defense-in-depth.** Primary enforcement is architectural.

### 8.3 Ownership Transfer

Methods that achieve a composite score at or above the Deployable threshold (0.70) against gold-standard evaluation, **and** that pass human validation (§7), are subject to ownership transfer.

**The developer retains:**
- Attribution and credit (name stays on the leaderboard)
- Right to publish about the method
- Right to use the method for other language pairs

**The governance org gains:**
- Right to use, modify, distribute, and monetize the method for their language
- Right to sublicense
- Physical possession of the method code (already held from evaluation submission)

### 8.4 Governance Organization Requirements

To serve as key custodian for a language benchmark:

1. **Represent the language community** — demonstrable relationship with speakers and cultural authorities
2. **Capacity for key management** — technical ability to manage cryptographic keys
3. **Commit to evaluation availability** — the benchmark must remain evaluable
4. **Publish terms of participation** — clear documentation of what developers agree to
5. **Operate under recognized data-sovereignty principles** — community ownership and control of language data, CARE, or equivalent

### 8.5 Serving Data-Sovereignty and CARE Principles

| Principle | Implementation |
|-----------|---------------|
| **Ownership** | Linguistic data belongs to the community. Governance org controls the evaluation infrastructure. |
| **Control** | Governance org controls evaluation via sandboxed execution. They decide who submits and on what terms. |
| **Access** | Community has unrestricted access to their own data, results, and methods developed against it. |
| **Possession** | Test set never leaves governance infrastructure. Encryption at rest as backup. |
| **Collective Benefit** (CARE) | Ownership transfer ensures methods benefit the community, which keeps the method and everything it earns — the platform takes no share. |
| **Authority to Control** (CARE) | Sandboxed execution is the technical implementation. |
| **Responsibility** (CARE) | Developers accept responsibility through terms of participation. |
| **Ethics** (CARE) | Community rights over researcher convenience. |

### 8.6 Dependency Classes and the Sandbox Network Policy

Sandboxed execution (§8.2) and ownership transfer (§8.3) both depend on knowing exactly what a method needs at runtime. The [Method Interface spec](/docs/network/specifications/methods#method-validity-and-dependency-classes) defines five **dependency classes** — S (self-contained), O (open external), A1 (substitutable LLM inference), A2 (non-substitutable external API), X (closed) — and the dependency manifest every method must declare. This subsection records how the sandbox network policy enforces them.

**Default-deny egress.** The sandbox specification requires that method containers have no network access by default. This is not a firewall rule — the specification removes the network from the execution environment, so an undeclared network dependency fails at the architecture layer, not the policy layer. Class S and O methods run entirely from artifacts vendored into the submission (Class O artifacts are pinned and mirrored in at submission time).

**The LLM gateway (🔲 planned).** Most methods call LLMs, so the sandbox specification defines exactly one egress exception: an **LLM gateway** operated by the evaluation infrastructure. The gateway:

- proxies inference requests to an **explicit allowlist of pinned models** — the model identifiers recorded in the method's manifest and run card;
- **logs every request and response** in the append-only, hash-chained audit log, so gateway traffic can be reviewed for data-exfiltration attempts before scores are released;
- is the *only* network path — there is no general egress, no DNS, no other endpoints.

This is what makes Class A1 methods evaluable without abandoning the verifiability guarantees of §8.2 — but it is a real trade-off, and the specification names it plainly: translating a secret source sentence through an external model **discloses that source sentence to the model provider**. Reference translations never leave (they are held by the harness, outside the container; see §8.2), and the method itself still cannot exfiltrate anything beyond what the logged, allowlisted inference calls contain. Whether that bounded disclosure is acceptable for a given corpus is a steward decision: authorizing a Class A1 evaluation means authorizing it knowingly, per run, like every other use of the data.

**Status.** The network-isolated method-execution **sandbox is implemented** for organizer-run contests (shipped 2026-07-08; see [Honest Limitations](/docs/network/honest-limitations) for exactly what is and is not built). The **LLM gateway is specified but not yet built.** Until the gateway is operational, only Class S and O methods can produce gold-standard scores; Class A1 methods remain prize-eligible in principle (see [Prize Specification §1.6](/docs/network/specifications/prizes)) but cannot yet be evaluated against secret segments. Class A2 dependencies cannot enter the sandbox at all until the rights holder grants permission — the artifact has to be allowed to *exist* in the sandbox before any network question arises.

---

## 9. Leaderboard & Submission

### 9.1 Submission Requirements

A valid leaderboard submission must include:

1. A complete run card (§3) with all required fields
2. The method code — fully runnable, with installation instructions
3. All dependencies — coaching data, dictionaries, FST binaries, prompts
4. A cost report
5. A README describing the method's approach and limitations

### 9.2 Legitimacy Criteria

1. **No training on evaluation data.** Methods must not have been exposed to `gold_standard` or `held_out` entries. (Architecturally enforced — you can't train on data you've never seen.)
2. **Declare development data usage.** Using `development` entries for few-shot prompting is allowed but must be declared.
3. **Reproducibility.** Governance org must be able to re-run and achieve scores within ±2%.
4. **Generalization.** Methods must work on unseen entries, not just memorized examples.

### 9.3 Anti-Gaming

1. **Variant-class linting** — suspiciously perfect performance on entries with known variants is flagged
2. **Corpus rotation** — governance org can rotate entries between segments without notice
3. **Community review** — the human validation gate (§7) catches methods that game metrics but produce bad output

### 9.4 Verification Tiers

Verification tiers describe **who validated the result** — orthogonal to quality tiers (§5), which describe what the automated score means.

| Tier | Meaning | How Achieved |
|------|---------|--------------|
| **Self-benchmarked** | Developer ran the harness and submitted the run card | PR or `--publish` flag against `development` segment |
| **Champollion Verified** | Maintainers reproduced the result independently | Submit method as installable plugin; maintainers re-run |
| **Community Validated** | Bilingual speakers of the target language, qualified under the community's own protocol, reviewed a stratified sample of the output (≥30 entries, ≥2 reviewers) and ≥70% met the community's bar. Conferred only by the community's own testing; demotion by spot-audit is symmetric | Submit method code to governance org (§8.2); they run it against `gold_standard` and the output passes human validation (§7) |

A method can be Self-benchmarked at a Functional quality tier. Quality tier and verification tier are independent axes on the leaderboard.

### 9.5 Layered Submission Model

The submission mechanism depends on which corpus segment you're evaluating against:

| Segment | Submission Path | Verification | Method Code Required? |
|---------|----------------|-------------|----------------------|
| `development` | Self-serve: run harness, submit run card via PR or API | Self-benchmarked | No — you keep your code |
| `development` | Maintainer re-run: submit method as plugin | Champollion Verified | Yes — method must be installable |
| `gold_standard` | Submit method to governance org; they run in sandbox | Community Validated | Yes — method is submitted and held |

The self-serve path (development segment) has no restrictions. The sovereign path (gold-standard segment) requires full method submission because (a) the developer never sees the test set, and (b) methods that reach Deployable are subject to ownership transfer (§8.3).

### 9.6 Method Classes

Methods are classified by type. The canonical enum is defined in the harness codebase (`VALID_METHOD_CLASSES` in `config.py`):

| Class | Description |
|-------|-------------|
| `raw-llm` | Direct LLM call with no language-specific engineering |
| `coached-llm` | LLM with coaching data (examples, grammar notes, dictionary entries) |
| `pipeline` | Multi-step pipeline (e.g., translate → FST validate → retry) |
| `custom-plugin` | Custom `TranslationMethod` plugin |
| `api` | External translation API (Google Translate, DeepL, etc.) |
| `human` | Human translator baseline |

### 9.7 Leaderboard Fields

| Field | Description |
|-------|-------------|
| Rank | Position by composite score |
| Method name | Developer-chosen identifier |
| Composite score | Weighted average of available metrics (§4.2) |
| chrF++ | Character n-gram score (0–100) |
| FST acceptance | Morphological validity rate (0.0–1.0) |
| Exact match | Strict match rate (0.0–1.0) |
| Semantic score | Meaning preservation (0.0–1.0) — 🔲 when available |
| Cost per entry | USD per corpus entry |
| Speed | Avg latency per entry (seconds) |
| Cost-adjusted score | Secondary ranking (§4.3) |
| Method class | From §9.6 enum |
| Model | LLM/engine used |
| Quality tier | Automated composite range (§5) |
| Verification tier | Who validated (§9.4) |
| Date | When evaluated |

> [!NOTE]
> **All scores displayed on the leaderboard are automated proxy measurements.** They indicate relative method performance under controlled conditions but do not constitute quality guarantees. Community-validated methods are marked separately via the Verification tier column. For methodology details, see [SCORING_SPEC.md](/docs/network/specifications/scoring).

---

## 10. Cost Framework {#10-cost-framework}

### 10.1 Per-Run Cost

```
run_cost = entries × api_calls_per_entry × cost_per_api_call
```

Typical per-run costs for a 150-entry corpus:

| Method | Model | Estimated Cost |
|--------|-------|---------------|
| Naive LLM | Gemini 2.5 Flash | $0.15–0.30 |
| Coached LLM | Gemini 2.5 Flash | $0.30–0.60 |
| FST-gated (3 retries) | Gemini 2.5 Flash | $0.45–1.20 |
| Naive LLM | Claude Sonnet 4 | $0.45–0.90 |
| Coached LLM | GPT-4.1 | $0.60–1.50 |

### 10.2 Benchmark (Sweep) Cost

```
sweep_cost = Σ run_cost(i)   for each parameter combination i
```

Typical sweep: 12 models × 3 temps × 2 prompts × 2 coaching = 144 runs at ~$0.50 avg = **~$72 per sweep**.

### 10.3 Per-Language Establishment

| Component | Cost Range | Notes |
|-----------|-----------|-------|
| Speaker compensation (corpus) | $2,500–6,000 | 50–150 entries at $50–65/hr |
| Speaker compensation (review) | $500–1,500 | Reviewing method output |
| Compute (benchmark sweeps) | $100–500 | Multiple sweeps during development |
| Compute (ongoing leaderboard) | $50–200/year | Running submitted methods |
| Infrastructure (sandbox) | $200–500/year | Governance org's eval infra |
| **Total establishment** | **$3,350–8,500** | |

### 10.4 Program Scale

| Scale | Annual Cost | Notes |
|-------|------------|-------|
| 1 language (maintenance) | $1,000–3,000 | After establishment |
| 5 languages (establishment + maintenance) | $25,000–65,000 | First year |
| 10 languages (steady state) | $15,000–40,000 | Per year after establishment |

---

## 11. Extending to New Languages {#11-extending-to-new-languages}

### 11.1 Minimum Requirements

1. **50+ entries** in the `gold_standard` segment
2. **30+ entries** in the `development` segment
3. **10+ entries** in the `diagnostic` segment targeting specific linguistic phenomena
4. **Provenance** for every entry
5. **Difficulty distribution** — at least 3 of 5 tiers
6. **Register distribution** — at least 2 registers
7. **Community consent** — documented agreement from the language community

### 11.2 Optional but Valuable

- **FST morphological analyzer** — enables the most powerful metric for polysynthetic languages
- **Bilingual dictionary** — enables dictionary-based methods, reduces hallucination
- **Gold-standard morphological analysis** — enables morphological accuracy metric
- **Variant classes** — enables equivalent match metric and anti-gaming linting
- **Governance organization** — enables cryptographic sovereignty and ownership transfer

### 11.3 The Agent-Assisted Path

> 🔲 **Planned**: Agent-assisted corpus creation is a future capability.

For languages without extensive existing resources:

1. An agent generates candidate source sentences across difficulty tiers and registers
2. A bilingual speaker translates them (this step is always human)
3. The agent proposes morphological analysis (validated by FST if available, otherwise by speaker)
4. The agent formats everything into the corpus schema
5. A linguist or speaker reviews the final corpus

This reduces speaker time from ~80 hours to ~30–40 hours per language.

---

*This spec is a living document. As we establish benchmarks for more languages, we'll learn what works and refine accordingly. The goal is rigorous enough to be credible, flexible enough to be useful, and open enough that anyone can participate — on the community's terms.*

