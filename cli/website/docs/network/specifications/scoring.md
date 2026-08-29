---
sidebar_position: 5
title: 'Scoring Specification'
slug: '/network/specifications/scoring'
related:
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# Scoring Specification

> **Executive Summary.** This is the single source of truth for all evaluation metrics, composite scoring, quality tiers, and cost analysis in the Champollion MT evaluation ecosystem. The language-specific evaluation metrics — FST morphological validity, linter equivalence classes, and deterministic semantic validation — are collectively named **LYSS** (Linguistically-informed Yield & Structural Scoring). Every metric computed by the harness, every weight in the composite formula, and every tier threshold is defined here — and only here. Code, documentation, and database schemas derive from this document. When they conflict, this document is authoritative.
>
> **Scope.** This document defines *what* we measure and *how we score it*. It does not define the run card schema (see BENCHMARK_SPEC §3), the benchmark protocol (BENCHMARK_SPEC §6), or the leaderboard rules (see arena docs). Those documents reference this one for metric definitions and scoring logic.


---

## 1. Scoring Philosophy

### 1.1 Microeval Philosophy

> *"If we only focus on what generalizes, we will inevitably forget about where it doesn't — and lose these languages and all their knowledge and wisdom."*

This project practices **microeval development**: building evaluation metrics tailored to specific languages using the best available linguistic tools — finite-state transducers, bilingual dictionaries, morphological analyzers, linguist-curated equivalence rules. This is the opposite of the dominant paradigm in MT evaluation, which seeks universal metrics that work across all languages. Universal metrics are valuable, but they are weakest precisely where they are needed most: for languages with complex morphology, limited training data, and no representation in neural metric training sets.

We are not making progress in machine translation for many of the world's languages not only because we lack corpora, but because **we don't even know what progress looks like** — we lack the automated evaluation tools to measure whether a translation system is improving. LYSS is our attempt to build those tools, language by language, using whatever linguistic resources exist.

### 1.2 Automated Metrics Are Proxies

Every metric defined here is machine-computed. They are useful for rapid iteration, systematic comparison, and detecting regressions. They are **not substitutes for human judgment**. The quality tiers in §5 are heuristic labels — only human review can confirm actual usability.

### 1.3 Multi-Signal Design

No single metric captures translation quality. A translation can have perfect chrF++ overlap but fail morphological validation. It can pass FST checks but carry the wrong meaning. It can be semantically accurate but stylistically alien to the target language. The composite score in §4 aggregates multiple independent signals, each capturing a different dimension of quality.

### 1.4 Extensibility

This metric inventory is not closed. New languages bring new requirements: tone accuracy for tonal languages, diacritical precision for Semitic scripts, syllabary correctness for Cree. The architecture (MetricPlugin protocol, weighted composite with re-normalization) is designed for metrics to be added without breaking existing scores. Language-specific metrics (e.g., CRK's linter and semantic validator) are declared on language cards under `evalMetrics` and loaded from `eval_standards/` — the harness ships with generic behavioral metrics only (code-switching, hallucination, terminology).

### 1.5 Three Dimensions of Evaluation

Every run card measures three independent dimensions:

```
Quality   — How good is the translation?   (composite score, §4)
Cost      — How much does it cost?          (cost metrics, §6)
Speed     — How fast does it run?           (speed metrics, §7)
```

These are independent axes. A method can be high-quality but expensive, fast but inaccurate, or any combination. The leaderboard enables sorting by any dimension. The cost-adjusted score (§6.3) is the only metric that combines dimensions.

### 1.6 Validation Status

Every metric in this specification has a **validation status** distinct from its implementation status (§3). Implementation status tracks whether code exists. Validation status tracks whether the metric has been shown to correlate with human quality judgments.

| Validation Level | Meaning | Current Metrics |
|------------------|---------|----------------|
| **✅ Externally validated** | Published human-correlation studies exist (WMT, academic papers) | `chrf_plus_plus`, `bleu`, `comet_score` *(high-resource pairs only)* |
| **⚡ Proxy-validated** | Validated for high-resource languages; unvalidated for our target LRLs | `comet_score` *(for LRLs: validated on high-resource/EU pairs, extrapolated to e.g. CRK — directionally useful but uncalibrated)* |

> **Why `comet_score` appears in two rows.** This is a split by resource level, not a contradiction. COMET is *externally validated* where WMT human-correlation studies exist — high-resource, mostly European pairs. For our target low-resource languages there are no such studies, so the same metric is only *proxy-validated*: the model extrapolates from languages with different morphological systems. This is also why COMET is reported in a separate neural lane and never folded into the composite (§4.3).
| **🔶 Engineering heuristic** | Designed from linguistic principles or observed failure modes; no human correlation data | `fst_acceptance_rate`, `morphological_accuracy` (FST-derived, lemma-matched; **active** in the fst-coverage composite, verifier-re-derived), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Unvalidated** | Not yet tested on any data | `orthographic_accuracy`, `consistency_score` |

> **What this means in practice.** The composite score (§4) aggregates metrics at all validation levels. This is an explicit design choice: we believe that a structurally-grounded engineering heuristic (FST acceptance) is more informative for polysynthetic languages than a neural metric validated only on European pairs (COMET). But we have not proven this. The composite score should be treated as an **engineering estimate**, not a validated quality measurement, until human correlation studies are completed for each target language.
>
> **Required validation experiments** (see `mt-evaluation-landscape.md` §6 and `speaker-validation.md`):
> 1. Human judgment correlation study: 200+ sentence pairs rated by 3+ bilingual speakers
> 2. FST false rejection rate measurement on a representative corpus
> 3. Second-language port (North Sámi) to test generalization
> 4. Direct comparison with COMET on the same data


---

## 2. Metric Inventory {#2-metric-inventory}

Metrics are organized into six categories (surface, structural, semantic, behavioral, compliance, and reported comparators). Each metric has an implementation status, scale, and level (per-entry, corpus-level, or both).

### 2.1 Surface Metrics

Surface metrics compare the predicted translation to the reference translation at the string level. They require no linguistic tools — just string comparison.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Exact Match | ✅ Implemented | 0.0–1.0 | Both | Binary: does predicted == reference? Corpus rate = matches / total. |
| `equivalent_match_rate` | Equivalent Match | ⚡ Partial | 0.0–1.0 | Both | Does the predicted output match any accepted variant? For CRK: implemented via the CRK eval standard's `CrkLinterMetric` (in `eval_standards/crk/`) using deterministic variant-class rules (word order, orthographic, optional particle, lemma synonym, progressive ambiguity). Loaded automatically via the CRK language card's `evalMetrics` declaration. Generic cross-language implementation requires per-entry `variants[]` in corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implemented | 0–100 | Both | Character n-gram F-score (sacrebleu). Robust to morphological variation. The primary surface metric for agglutinative/polysynthetic languages. Per-entry uses `sentence_chrf`; corpus uses `corpus_chrf`. |
| `bleu` | BLEU | ✅ Implemented | 0–100 | Corpus | Word-level n-gram precision (sacrebleu). **Excluded from composite** — word-level scoring penalizes morphological variation unfairly. Computed and reported for compatibility with MT literature. |
| `ter` | Translation Edit Rate | ✅ Implemented | 0–∞ (lower is better) | Both | Minimum edit distance between predicted and reference, normalized by reference length (sacrebleu `corpus_ter`). Computed alongside chrF++ and BLEU. Excluded from composite — correlates with chrF++ so including both would double-count surface similarity. |
| `length_ratio` | Length Ratio | ✅ Implemented | 0–∞ (1.0 is ideal) | Both | `len(predicted) / len(reference)` in characters. Detects truncation (<0.5) and inflation/hallucination (>2.0). Averaged across entries at corpus level. |

### 2.2 Structural Metrics

Structural metrics validate the linguistic well-formedness of the translation. They require language-specific tools (FST analyzers, morphological parsers) and are the strongest signals for morphologically rich languages.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | FST Acceptance | ✅ Implemented | 0.0–1.0 | Both | Proportion of output words accepted by a finite-state transducer (GiellaLT). A word is "valid" if the FST returns at least one morphological analysis. Available for any language with a GiellaLT `.hfstol` analyzer. |
| `morphological_accuracy` | Morphological Accuracy | ✅ Active (fst-coverage profile; verifier-re-derived) | 0.0–1.0 | Both | A word can be FST-valid but have the wrong inflection (right root, wrong suffix). **Computed** by `plugins/giellalt_fst.py`: for each analyzable predicted word, find a reference word sharing its **lemma** (root) and check whether the predicted **inflection** (FST feature tags) matches. Matching by lemma — not position — sidesteps word alignment: a different word choice or a mis-aligned pair simply isn't *covered* (never falsely scored). **No gold annotations needed** — the FST analysis of the reference *is* the ground truth. Words the FST can't analyze, or whose root isn't in the reference, are out of coverage; `morph_coverage` (the fraction lemma-matched) is disclosed, and the metric only enters the composite when coverage ≥ `MORPH_COVERAGE_FLOOR` (0.25) — below the floor it stays advisory. It is **lenient under FST ambiguity** (a predicted word with several analyses is "correct" if *any* matches → an upper bound, disclosed). It carries a **0.15 weight** in the fst-coverage profile and is **re-derived by the verifier** against the canonical corpus (`verifier.recompute_corpus_morph`, which re-runs the card-pinned FST — fail-closed if the FST is absent, same contract as COMET). Activated 2026-06-16 (migration 029 applied to dev + prod). |
| `orthographic_accuracy` | Orthographic Accuracy | 🔲 Planned | 0.0–1.0 | Both | Validates script-specific correctness: SRO macron/circumflex usage for Cree, diacritical marks for Inuktitut, vowel length markers for Ojibwe. Per-language rule sets. |

> **Why structural metrics matter.** Meta's OMT-1600 — the largest MT system ever published (1,600 languages; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — evaluates with ChrF++, xCOMET, MetricX, and BLASER 3. None of these validate morphological correctness. ChrF++ measures character n-gram overlap: it rewards strings that *look* like the target language. For polysynthetic languages, this means a morphologically invalid word that shares many characters with the reference scores well. Our FST acceptance metric is a binary structural test: the word is either a valid form in the language, or it is not. No other MT evaluation framework provides this at scale. ChrF++ also has a **nonzero chance floor** that differs by orthography — random same-script text scores measurably above zero, more in some writing systems than others — so raw chrF++ is not comparable across languages; the network map corrects for this with [chance-corrected chrF++ (cchrF++)](/docs/network/specifications/connection-strength).

### 2.3 Semantic Metrics

Semantic metrics measure meaning preservation using embeddings or learned models. They catch translations that are surface-different but meaning-equivalent, and flag translations that are surface-similar but semantically wrong.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Semantic Similarity | ⚡ Partial | 0.0–1.0 | Both | CRK: verdict-weighted score from the CRK eval standard's `CrkSemanticMetric` (in `eval_standards/crk/`, proxy). Universal: cosine similarity of sentence embeddings (source + predicted vs source + reference). Model TBD — must support low-resource languages, which rules out most English-centric embedding models. |
| `comet_score` | COMET | ✅ Implemented | ~0.0–1.0 | Both | Learned MT evaluation metric (Unbabel). **Computed and reported SEPARATELY — never in any composite** (the composite is deterministic; §4.3). Re-derived by the verifier, so a reported value must reproduce. Flagged with a low-resource calibration caveat for languages like Plains Cree. Computed when `unbabel-comet` is installed. For 35 African languages, the harness auto-selects AfriCOMET (`masakhane/africomet-mtl`) via `resolve_comet_model()`, which has better human-judgment correlation for those languages. |

> **Why COMET is reported separately, not composited.** COMET is trained on WMT human-evaluation data, overwhelmingly high-resource European pairs. Applied to Plains Cree or other LRLs the model extrapolates from languages with different morphological systems — directionally useful but not calibrated. Rather than fold a model-dependent, unevenly-validated signal into the headline score, the composite is kept **deterministic** (verifier-reproducible metrics only) and COMET/AfriCOMET are reported in a **separate neural lane** (§4.3), re-derived by the verifier. A neural composite may be added later, once validated.
>
> **High-resource COMET is reported, not composited (by design).** For genuinely high-resource pairs (German, French, …) the default `Unbabel/wmt22-comet-da` is well-validated by WMT, and `resolve_comet_model()` selects it. But COMET is **not** folded into any composite — it is computed and shown in the separate neural lane like every other neural metric, and re-derived by the verifier. Keeping the composite deterministic avoids making a 2.3 GB model-dependent metric mandatory for the ~100+ languages carrying `metricModelSupport.xlmr.tier: "high"`, and keeps the headline score reproducible from the corpus alone.

> **AfriCOMET for African languages.** Each language card has a `metricModelSupport` field (see language card spec §9) that declares which specialized COMET models are trained for that language. For 35 African languages (yor, hau, ibo, amh, swa, etc.), the card declares AfriCOMET (`masakhane/africomet-mtl`) — a COMET model fine-tuned on African language MT human judgments by the Masakhane community. The harness auto-selects the recommended model via `resolve_comet_model()` reading from language cards, but this can be overridden with `--comet-model`. Adding new language→model mappings is done by enriching the language card (not editing Python code).

### 2.4 Behavioral Metrics

Behavioral metrics detect specific failure modes in translation output. They don't measure quality directly — they detect problems.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Code-Switching Rate | ✅ Implemented | 0.0–1.0 (lower is better) | Both | Proportion of output words that are in the source language (typically English). Detected via Unicode script analysis and/or a source-language word list. Very common LLM failure mode: the model inserts English words when it doesn't know the target-language equivalent. |
| `hallucination_rate` | Hallucination Rate | ✅ Implemented | 0.0–1.0 (lower is better) | Both | Proportion of output content that has no corresponding source content. Detected via word alignment or cross-lingual embedding overlap. Catches the model generating plausible-sounding but fabricated translations. |
| `terminology_adherence` | Terminology Adherence | ✅ Implemented | 0.0–1.0 | Both | For coached methods: proportion of prescribed terminology terms that appear in the output. Requires coaching dictionary data. Measures whether the model respects expert-provided vocabulary. |
| `consistency_score` | Cross-Entry Consistency | 🔲 Planned | 0.0–1.0 | Corpus only | Does the model translate the same source term the same way across entries? Low consistency suggests the model is guessing rather than applying learned patterns. Requires repeated terms across corpus entries. |

### 2.5 Compliance Metrics

Compliance metrics validate that translations preserve structural integrity — placeholders, formatting, and typography conventions. They are quality-gate checks, not quality scores.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Double-Pass Compliance | ✅ Implemented | 0.0–1.0 | Both | Weighted composite: 60% variable integrity (are `{placeholder}` vars preserved?) + 20% quote compliance (correct quote characters per language card) + 20% casing compliance (no Latin letter leakage for caseless languages). Computed on both raw and post-processed output. Via `DoublePassCompliancePlugin`. |
| `repair_effectiveness` | Repair Effectiveness | ✅ Implemented | 0.0–1.0 | Corpus | Proportion of compliance violations that were automatically repaired by post-translation hooks. Measures how much the quality gate improved the raw output. |

> **Why compliance is not in the composite.** Compliance metrics measure structural preservation (placeholders, quotes), not translation quality. A translation can be perfect linguistically but fail compliance because it dropped a `{name}` variable. These are quality gates — they block bad output from shipping, but they don't rank translation quality.

### 2.6 Reported comparators (NEVER in the composite)

These are reported for context/comparison only and never enter any composite profile:

| ID | Metric | Status | Notes |
|----|--------|--------|-------|
| `spbleu` | spBLEU (FLORES-200 tokenizer) | ✅ Implemented | BLEU on the FLORES-200 SentencePiece tokenization — comparable across scripts/segmentation (the NLLB/FLORES lingua-franca). Needs `sentencepiece` (core dep). |
| `chrf_plain` | Plain chrF (`word_order=0`) | ✅ Implemented | The chrF figure FLORES/WMT tables report, alongside our chrF++ (`word_order=2`). |
| `fuse_score` | FUSE-style comparator | ⚡ Opt-in (`--fuse`) | An **UNTRAINED reimplementation** of the AmericasNLP-2025 FUSE approach (Raja & Vats): LaBSE semantic + lexical token-F1 + phonetic Soundex + fuzzy difflib, blended as an *unweighted mean* (we have no human-judgment training data to fit the original Ridge/GBM, and say so). LaBSE/Soundex are the optional `fuse` extra; without LaBSE, `compute_fuse` returns `None` (disclosed) rather than faking a score. Each component that ran is listed in `fuse_components`; the result is flagged `fuse_untrained=true`. Lets the leaderboard show FST-gated/structural scoring against a FUSE-style baseline. |

### 2.7 Metric Namespaces {#2-7-metric-namespaces}

A single metric carries up to four coordinated names across the stack: the
**canonical id** (the `scores` key in a run card, e.g. `equivalent_match_rate`),
the Python **plugin name** that computes it (e.g. `crk_linter`), the language-card
**`evalMetrics` key** that declares it (e.g. `lyss-eq`), and the denormalized
**`run_cards` column** on the leaderboard (e.g. `equivalent_match_rate`). These are
deliberately distinct — the plugin name states the *tool*, the metric id states the
*measurement* — but they must stay in lockstep.

The single source of truth for that mapping is `shared/metric-registry.json`, loaded
by `mt_eval_harness.metric_manifest`. Each entry records the four names plus `scale`,
`direction` (higher/lower/neutral), `level` (entry/corpus/both), `in_composite`, and
`verifier_reproducible`. The parity test `arena/tests/test_metric_registry_ssot.py`
fails if `scoring.py`'s weight tables or the run-card `scores` keys minted by
`publish.py` drift from the registry, so a new metric cannot ship half-wired.

Two related run-card fields make metric provenance explicit:

- **`scores.metric_availability`** — a `{metric: reason}` block that disambiguates a
  `null` score: `not_applicable` (the language/run does not use it), `unavailable`
  (an optional dependency was missing), `below_coverage_floor` (present but too
  sparse to enter the composite), `not_run` (opt-in and not requested), or
  `not_implemented` (planned). A metric absent from the block was computed normally.
- **`fst_version`** / **`fst_provenance`** — the installed GiellaLT transducer
  release and `pyhfst` version behind any FST-derived metric, captured the same way
  as the sacreBLEU signatures so a structural score can be traced to an exact
  analyzer build.

---

## 3. Metric Status Tiers

Every metric in §2 falls into one of four implementation tiers:

| Tier | Meaning | Run Card Behavior |
|------|---------|-------------------|
| **✅ Implemented** | Code exists, tested, producing values in run cards today | Numeric value in run card |
| **⚡ Partial** | Language-specific proxy exists (e.g., CRK) but universal implementation is pending | Numeric value when proxy applies, `null` otherwise |
| **🔲 Planned** | Specified but not yet implemented | `null` in run card (field present, value absent) |
| **💡 Proposed** | Under discussion, not yet specified | Not in run card |

A metric moves from Planned → Partial when:
1. A language-specific implementation is merged and tested
2. It produces values for at least one language pair
3. The universal implementation remains pending (documented in this spec)

A metric moves from Partial → Implemented when:
1. A language-agnostic implementation is merged and tested
2. It produces values for any language pair without language-specific plugins
3. This document is updated to reflect ✅ status

A metric moves from Planned → Implemented when:
1. Implementation is merged and tested
2. It has been validated on at least one real evaluation run
3. This document is updated with its implementation details

A metric moves from Proposed → Planned when:
1. Its definition, scale, and computation method are agreed upon
2. It is added to this document with a `🔲 Planned` status
3. A null placeholder is added to the run card schema

---

## 4. Composite Score {#4-composite-score}

> [!CAUTION]
> **The composite is EXPERIMENTAL and NOT VALIDATED.** It is a weighted aggregate of metrics that *mean different things for different languages*, with weights that are **engineering judgment, not empirically fitted to human quality judgments**. No human-correlation study backs the weighting for any target language. Treat it as a rough convenience sort key, **never** as a quality measurement or a claim that one system is "better." The real signal is the **per-metric profile** — each metric shown with its value and validation tier (§1.6). The composite is labeled "experimental — not validated" wherever it appears (leaderboard included), and it is never the criterion for any prize or award. (By design.)

### 4.1 Formula

The composite score is a weighted average of all *available* metrics, re-normalized so the weights of available metrics sum to 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

A metric is "available" if its value in the run card is a number (not `null`). When a metric is unavailable — because the language has no FST, or because a metric is not yet implemented — its weight is redistributed proportionally across the remaining metrics.

**This means the composite is always comparable within a run:** it uses whatever metrics are available and normalizes accordingly. Cross-run comparison is valid when runs use the same set of available metrics.

> [!WARNING]
> **Cross-run comparability.** When comparing runs with different metric availability (e.g., one run has FST scores, another doesn't), the composite scores are **not directly comparable**. A composite of 0.72 computed from 5 metrics carries more information than a composite of 0.72 computed from 2 metrics. Each run's exact metric set is auditable: the run card records `scores.scoring_profile` and `scores.metric_availability` (§2.7), and an unmeasured metric renders as "—" on the leaderboard, never as 0. For rigorous comparison, use paired bootstrap significance tests (§8.2) on shared metrics only.

### 4.2 Input Normalization

Before entering the composite formula, all metrics must be on a **0.0–1.0 scale** where 1.0 = perfect:

| Metric | Native Scale | Normalization |
|--------|-------------|---------------|
| `exact_match_rate` | 0.0–1.0 | None (already normalized) |
| `equivalent_match_rate` | 0.0–1.0 | None |
| `fst_acceptance_rate` | 0.0–1.0 | None |
| `morphological_accuracy` | 0.0–1.0 | None |
| `chrf_plus_plus` | 0–100 | **Divide by 100** |
| `semantic_score` | 0.0–1.0 | None |
| `code_switching_rate` | 0.0–1.0 (lower = better) | **`1.0 - value`** (invert: 0% code-switching = 1.0) |
| `hallucination_rate` | 0.0–1.0 (lower = better) | **`1.0 - value`** (invert) |
| `terminology_adherence` | 0.0–1.0 | None |

Metrics not in any composite profile (`bleu`, `ter`, `length_ratio`, `consistency_score`, and the neural `comet_score`/`qe_score`) are not normalized for this purpose. (Neural metrics are reported separately and never enter a composite — §4.3.)

### 4.3 Weight Tables {#43-weight-tables}

**Named profile registry (card-driven).** The composite is no longer chosen by a single `has_fst` boolean. Each language resolves to a **named profile** via `language_cards.resolve_scoring_profile()`; the profile names a weight table, mirrored in `scoring.py`'s `PROFILE_REGISTRY`. A card may declare `scoringProfile.basis` to override; when absent, the default reproduces the legacy behavior (`fst-coverage` when an FST scored the run, else `surface-only`). The profile that produced each composite is recorded on the run card as `scores.scoring_profile`, so the weighting is auditable per leaderboard row.

**Inactive (reserved) metrics.** Some metrics carry a *declared* weight below but are not yet active, so they are listed in `scoring.INACTIVE_METRICS` and **excluded from the composite** until they are both computed per-entry and re-scorable by the verifier (the trust gate). Excluding an absent metric changes no score — it only makes "not yet scoring" explicit instead of silent. Currently inactive:

- `orthographic_accuracy` — needs per-language orthographic rules (not built).

(`morphological_accuracy` was inactive through P5; **activated 2026-06-16** under the `fst-coverage` profile — it is computed (lemma-matched; §2.2), enters the composite when `morph_coverage ≥ 0.25` (advisory below the floor), and is re-derived by the verifier. **Neural metrics (`comet_score`, `qe_score`) are excluded from every composite** — they are computed and reported separately; see "Neural metrics" below.)

#### `fst-coverage` (Profile A): Languages WITH FST Coverage

For languages that have a GiellaLT finite-state transducer available. Structural metrics carry 40% of the composite (FST 0.25 + morphological accuracy 0.15), reflecting the primacy of morphological correctness for polysynthetic/agglutinative languages.

| Metric | Target Weight | Rationale |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.25** | Highest weight. If the FST rejects a word, it's not a valid form in the language — regardless of what other metrics say. Binary, structurally grounded. |
| `morphological_accuracy` | **0.15** | A word can be FST-valid but morphologically wrong (right root, wrong inflection). Together with FST, structural metrics carry 40%. |
| `chrf_plus_plus` | **0.15** | Character n-gram overlap: the best surface-level proxy for polysynthetic languages. Handles agglutinative morphology better than word-level metrics. |
| `semantic_score` | **0.15** | Meaning preservation when surface form diverges. Catches semantically wrong translations that pass structural checks. |
| `equivalent_match_rate` | **0.10** | Rewards acceptable variants, not just the one reference translation. Important for languages with flexible word order. |
| `code_switching_rate` | **0.05** | Penalizes source-language leakage. Inverted: 0% code-switching = 1.0. |
| `terminology_adherence` | **0.05** | Rewards coached methods that respect prescribed vocabulary. Only active when coaching data is present. |
| `hallucination_rate` | **0.05** | Penalizes fabricated content. Inverted: 0% hallucination = 1.0. |
| `exact_match_rate` | **0.05** | Lowest weight. Too strict for polysynthetic languages — multiple correct translations exist. Kept as a ceiling check. |

> **Total: 1.00.** When metrics are unavailable, their weights are redistributed proportionally across available metrics. `morphological_accuracy` (0.15 weight) is **active** — it enters the composite when `morph_coverage ≥ 0.25` and is verifier-re-derived; below the floor it is redistributed like any unavailable metric. When it *is* absent (no FST, or sub-floor coverage), the remaining 8 metrics (total weight 0.85) are each scaled by 1/0.85 ≈ 1.176. For example:
> - FST: 0.25/0.85 = 0.294
> - chrF++: 0.15/0.85 = 0.176
> - semantic: 0.15/0.85 = 0.176

#### `surface-only` (Profile B): Languages WITHOUT FST Coverage

For languages without morphological validation tools. Semantic and surface metrics carry equal weight.

| Metric | Target Weight | Rationale |
|--------|--------------|-----------|
| `semantic_score` | **0.25** | Without structural validation, meaning preservation is the strongest available signal. |
| `chrf_plus_plus` | **0.25** | Without FST, character-level overlap becomes the primary surface check. |
| `equivalent_match_rate` | **0.15** | Variant matching provides structured quality assessment without requiring morphological tools. |
| `exact_match_rate` | **0.10** | Without FST, exact match carries more weight as the only structural validation proxy. |
| `code_switching_rate` | **0.10** | Source language leakage matters more when there's no FST to catch bad output. |
| `terminology_adherence` | **0.05** | Coached vocabulary compliance. |
| `hallucination_rate` | **0.05** | Fabricated content detection. |
| `orthographic_accuracy` | **0.05** | Script-specific correctness fills part of the gap left by absent FST. |

> **Total: 1.00.** `orthographic_accuracy` (0.05 weight) is in `INACTIVE_METRICS` (planned, not yet computed). With it absent, the remaining 7 metrics (total weight 0.95) are scaled by 1/0.95 ≈ 1.053 — a negligible impact on the composite.

#### `no-reference`: runs with NO gold reference

For runs whose corpus has **no gold references** (e.g. floor languages with only contaminated FLORES we decline to score against). Reference-based metrics (`chrf_plus_plus`, `bleu`, `exact_match_rate`, `equivalent_match_rate`) can't be computed, so the deterministic composite leans on the **reference-free, verifier-reproducible** signals.

| Metric | Target Weight | Rationale |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | Morphological validity needs no reference; the strongest deterministic signal when an FST exists. |
| `code_switching_rate` | **0.25** | Source-language leakage (inverted). |
| `hallucination_rate` | **0.20** | Fabricated content (inverted). |
| `terminology_adherence` | **0.15** | Coached vocabulary compliance. |

> **Total: 1.00.** All four are deterministic and verifier-reproducible. When a no-reference run has no FST, the composite renormalizes over the behavioral checks alone (a deliberately thin, honest signal); the **neural reference-free QE score (AfriCOMET-QE) is computed and reported separately** — see "Neural metrics" below — as the adequacy signal for such runs.

#### Neural metrics — computed and reported SEPARATELY (not in any composite)

The composite is **deterministic**: every metric in it is reproducible by the verifier from the corpus alone. **Neural metrics are excluded from every composite** and surfaced on their own (design decision — "deterministic composite; neural separate, maybe separately composited later"):

| Metric | What it is | Where it shows |
|--------|-----------|----------------|
| `comet_score` | COMET / AfriCOMET neural adequacy (reference-based) | Its own leaderboard column + run-card `neural_metrics`, with a low-resource calibration caveat. |
| `qe_score` | AfriCOMET-QE reference-free neural QE (source + MT) | Same separate neural lane; the adequacy signal for `no-reference` runs. |

Both are still **re-derived by the verifier** (`verifier.recompute_corpus_comet` / `recompute_corpus_qe`), so a reported neural score that doesn't reproduce can't be trusted — but they never move the deterministic composite. The named set is `scoring.NEURAL_METRICS`. A neural composite may be introduced later; for now neural metrics stand alone.

> **Note on weight evolution.** These weights are provisional and will be recalibrated as human validation data accumulates. The long-term goal is to derive weights empirically: which automated metrics best predict human quality judgments for each language family?

### 4.4 Adding a New Metric to the Composite

To add a new metric to the composite:

1. **Define it** in §2 with status `🔲 Planned`, including scale, level, and computation method.
2. **Implement it** as a MetricPlugin (or in `tester.py` for core metrics).
3. **Add a null placeholder** in the run card scores block.
4. **Assign it a target weight** in §4.3 by adjusting existing weights downward. Weights must sum to 1.00.
5. **Update BENCHMARK_SPEC.md** §3 if the run card schema changes.
6. **Update `scoring.py`** weight tables (the code must mirror this document).
7. **Run a validation benchmark** to confirm the metric produces sensible values on real data.
8. **Update this document** to change status from `🔲` to `✅`.

---

## 5. Quality Tiers {#5-quality-tiers}

These tiers are heuristic labels on automated composite scores. They describe what the scores tend to mean in practice, based on human review of outputs at each level. **They are not validated quality judgments** — only human review can confirm actual usability.

> [!IMPORTANT]
> **Automated tiers are provisional.** These labels are nominations for review, not quality declarations. A method reaching "Deployable" on automated metrics is a candidate for community evaluation — not a product to ship. Only human review by bilingual speakers can confirm actual usability (see [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)). No method can claim Deployable or above without community review confirming speakers agree the output is usable. Tier boundaries may differ across languages as human validation data accumulates.

| Tier | Composite Range | What a Speaker Typically Sees |
|------|----------------|-------------------------------|
| **Baseline** | 0.00–0.30 | Raw LLM output with no language-specific support. Morphology is mostly hallucinated. |
| **Emerging** | 0.30–0.50 | Some correct patterns appearing. Coaching is helping, but output is not reliable. |
| **Functional** | 0.50–0.70 | Output is recognizable to a speaker. Major grammatical categories usually correct. Frequent morphological errors. |
| **Deployable** | 0.70–0.85 | Suitable for draft translation with human review. Most morphology is correct. |
| **Fluent** | 0.85–1.00 | Approaching competent human translation. Errors are rare and minor. |

These tiers are provisional. They will be recalibrated as human validation data accumulates and we learn where the "a speaker finds this useful" threshold actually falls for each language. No method can claim **Deployable** or above without community review confirming bilingual speakers agree the output is usable.

### 5.1 Tier Thresholds (Machine-Readable)

For code implementations, the thresholds are (evaluated top-down, first match wins):

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. Cost Metrics

Cost metrics measure the financial efficiency of a translation method. They are reported separately from quality — cost does not influence the composite score (except in the cost-adjusted secondary ranking).

### 6.1 Token Metrics

| ID | Metric | Computation |
|----|--------|-------------|
| `prompt_tokens` | Total input tokens | Sum of `usage.prompt_tokens` across all API calls |
| `completion_tokens` | Total output tokens | Sum of `usage.completion_tokens` |
| `reasoning_tokens` | Chain-of-thought tokens | Sum of `usage.completion_tokens_details.reasoning_tokens` (0 for most models) |
| `cached_tokens` | Provider-cached tokens | Sum of `usage.prompt_tokens_details.cached_tokens` |
| `total_tokens` | Total tokens consumed | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | Average tokens per translation | ✅ `total_tokens / entry_count` |

### 6.2 Cost Metrics

| ID | Metric | Computation | Use Case |
|----|--------|-------------|----------|
| `total_cost_usd` | Total run cost | Provider-reported pricing × token counts | "How much did this benchmark cost?" |
| `cost_per_entry_usd` | Cost per corpus entry | `total_cost_usd / entry_count` | Comparing methods on the same corpus |
| `cost_per_1k_tokens` | Cost per 1,000 tokens | ✅ `total_cost_usd / total_tokens × 1000` | Universal LLM efficiency — comparable across corpora |
| `cost_per_source_char` | Cost per source character | `total_cost_usd / total_source_chars` | Comparable across languages with different tokenization |

> **Why multiple cost metrics?** An "entry" varies in length — a 3-word phrase costs less than a paragraph. `cost_per_entry_usd` is useful for comparing methods on the *same* corpus (same entries = same lengths = fair comparison). `cost_per_1k_tokens` is the standard LLM efficiency metric, comparable *across* corpora. `cost_per_source_char` normalizes for tokenization differences — the same sentence may tokenize into different numbers of tokens depending on the model's vocabulary.

### 6.3 Cost-Adjusted Score

For methods using paid APIs, we compute a secondary ranking:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

This rewards methods that achieve good scores efficiently. It uses `cost_per_entry_usd` (not per-token) because the cost-adjusted score is always computed within a single benchmark (same corpus), making per-entry comparison fair.

The cost-adjusted score is a **secondary ranking** — the primary leaderboard ranks by composite score. It answers a different question: "given a budget, which method gives the best results?"

---

## 7. Speed Metrics

Speed metrics measure the latency and throughput of a translation method. Like cost, speed does not influence the composite score.

| ID | Metric | Computation | Level |
|----|--------|-------------|-------|
| `elapsed_seconds` | Wall-clock run duration | `time_end - time_start` | Run |
| `avg_latency_seconds` | Mean per-entry latency | `Σ latency_s / n_entries` | Corpus |
| `median_latency_seconds` | Median per-entry latency | 50th percentile of `latency_s` | Corpus |
| `p95_latency_seconds` | 95th percentile latency | 95th percentile of `latency_s` | Corpus |
| `tokens_per_second` | Throughput | `total_tokens / elapsed_seconds` | Run |
| `entries_per_minute` | Translation rate | `entry_count / (elapsed_seconds / 60)` | Run |

---

## 8. Confidence and Significance

### 8.1 Bootstrap Confidence Intervals

All key metrics support bootstrap confidence intervals (percentile method, n=1000 resamples, α=0.05):

| Metric | CI Reported |
|--------|------------|
| `chrf_plus_plus` | ✅ `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (only computed when FST data exists) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (bootstrapped from cached per-entry scores — no redundant neural inference) |
| `composite` | ✅ `composite_ci_lower`, `composite_ci_upper` (computed when chrF++ and exact_match are available) |
| per-tier CIs | ✅ `confidence_intervals_by_tier` — chrF++ and exact_match CIs per difficulty level (Tier 1-5) |

### 8.2 Paired Bootstrap Significance Tests

For comparing two methods, the harness computes paired bootstrap resampling tests:

```
H₀: The two methods perform equally on this corpus.
H₁: One method is significantly better.
```

If the p-value < 0.05 and the confidence interval of the difference excludes zero, the difference is statistically significant at the 95% level.

---

## 9. Run Card Scores Schema

This section defines the hierarchical structure of the `scores` block in a run card. This schema is derived from the metrics defined in §2–§7 and must be kept in sync.

```jsonc
{
  "scores": {
    // §2.1 Surface metrics
    "exact_match_rate":       0.6613,       // 0.0–1.0
    "exact_matches":          41,           // count
    "equivalent_match_rate":  0.7258,       // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     45,           // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "chrf_plus_plus":         80.65,        // 0–100 (sacrebleu native scale)
    "bleu":                   54.78,        // 0–100, NOT in composite
    "ter":                    42.3,         // ✅ implemented, 0–∞ (lower=better)
    "length_ratio":           1.03,         // ✅ implemented, ideal=1.0

    // §2.2 Structural metrics
    "fst_acceptance_rate":    1.0,          // 0.0–1.0
    "fst_accepted":           74,           // count
    "morphological_accuracy": 0.83,         // ✅ active: FST-derived, lemma-matched, verifier-re-derived (fst-coverage profile — §4.3)
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     true,         // true when active AND coverage ≥ MORPH_COVERAGE_FLOOR (0.25); else advisory
    "orthographic_accuracy":  null,         // 🔲 planned

    // §2.3 Semantic metrics
    "semantic_score":         0.6842,       // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "comet_score":            null,         // nullable; NEURAL — reported separately, not in any composite (§4.3)
    "comet_model":            "",           // model ID used for COMET

    // §2.4 Behavioral metrics
    "code_switching_rate":    0.03,         // ✅ implemented (lower=better)
    "hallucination_rate":     0.01,         // ✅ implemented (lower=better)
    "terminology_adherence":  null,         // ✅ implemented (null when no glossary)
    "consistency_score":      null,         // 🔲 planned

    // §4 Composite
    "composite":              0.8988,       // 0.0–1.0
    "quality_tier":           "fluent",     // §5 tier label
    "cost_adjusted":          null,         // §6.3 secondary ranking

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "chrf_plus_plus":     { "ci_lower": 78.2, "ci_upper": 83.1 },
      "exact_match_rate":   { "ci_lower": 0.54, "ci_upper": 0.78 },
      "corpus_comet":       { "ci_lower": 0.71, "ci_upper": 0.76 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

> **Schema history.** Earlier spec drafts proposed separate `cost`, `speed`, and `tokens` blocks. These were merged into `scores` and `totals` respectively for simplicity. Speed metrics (`tokens_per_second`, `entries_per_minute`, latencies) live in `scores`; token counts and cost figures live in `totals`.

### 9.1 Schema–Database Mapping

The run card JSON is stored in full as a `jsonb` column in Supabase. Key metrics are also denormalized into top-level columns for sort/filter performance:

| Run Card Field | Supabase Column | Type | Index |
|---------------|----------------|------|-------|
| `scores.composite` | `composite_score` | `real` | `idx_composite` |
| `scores.quality_tier` | `quality_tier` | `text` | — |
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `scores.bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(full card)* | `run_card` | `jsonb` | — |

When new metrics are implemented, the corresponding column should be added via a numbered migration in `arena/migrations/`.

---

## 10. Code–Spec Synchronization

### 10.1 Canonical Source

This document (`cli/website/docs/network/specifications/scoring.md`) is the canonical source for:
- Metric definitions (§2)
- Composite weight tables (§4.3)
- Quality tier thresholds (§5.1)
- Cost metric formulas (§6.2)
- Run card scores schema (§9)

### 10.2 Code Mirror

The file `arena/mt_eval_harness/scoring.py` mirrors the weight tables and tier thresholds from this document. It is the **code implementation** of §4.3 and §5.1. When this document is updated:

1. Update `scoring.py` to match
2. Run `pytest tests/test_scoring_ssot.py` to validate alignment
3. Update FAQ and website docs that summarize the weights

### 10.3 Documents That Reference This Spec

| Document | What It References | How to Keep in Sync |
|----------|-------------------|---------------------|
| `cli/website/docs/network/specifications/benchmark-spec.md` §4–§5 | Composite formula, weight tables, tier thresholds | Cross-reference this doc; do not duplicate tables |
| `website/docs/getting-started/faq.md` | Simplified weight summary | Must match §4.3; link back to this doc |
| `cli/website/docs/network/how-it-works.md` | Deployable threshold | Must match §5 |
| `publish.py` via `scoring.py` | Weight dicts + tier function | Automated test validates match |

---

## Appendix A: Metrics NOT in Composite (and Why)

| Metric | Why Excluded |
|--------|-------------|
| **BLEU** | Word-level scoring penalizes morphological variation in polysynthetic languages. A minor inflectional difference (correct meaning, slightly different suffix) counts as a complete miss. chrF++ handles this better at the character level. |
| **COMET** | Trained on WMT data (high-resource European pairs). For LRLs (e.g. Cree) the model extrapolates and is uncalibrated. COMET/AfriCOMET are **computed and reported in a separate neural lane — never in any composite** (the composite is deterministic; §4.3) — and re-derived by the verifier. |
| **TER** | Edit distance correlates with chrF++ for most use cases. Including both would double-count surface similarity. TER is reported for reference. |
| **Length Ratio** | A diagnostic, not a quality signal. A ratio of 1.02 and a ratio of 0.98 are both fine. Only extreme values indicate problems. |
| **Consistency Score** | Corpus-level only — no per-entry value to aggregate. Also, some inconsistency is legitimate (same English word → different target-language translations depending on context). |
| **Compliance Index** | Quality gate, not quality signal. Measures structural preservation (placeholders, quotes), not translation accuracy. |

## Appendix B: LYSS — Language-Specific Metric Implementations

The **LYSS** framework (Linguistically-informed Yield & Structural Scoring) provides language-specific metrics that go beyond surface-level string comparison. LYSS has three core components:

- **LYSS-fst** — Morphological validity (`fst_acceptance_rate`): Is each word a valid form in the target language?
- **LYSS-eq** — Linguistic equivalence (`equivalent_match_rate`): Is the output an acceptable variant of the reference?
- **LYSS-sem** — Semantic validation (`semantic_score`): Does the output preserve the source meaning?

> **Validation status: 🔶 Engineering heuristic.** LYSS metrics have NOT been validated against human quality judgments. They are designed from linguistic principles (FSTs, dictionaries, grammar rules built by linguists at UAlberta ALTLab), but the correlation between LYSS scores and actual translation quality has not been measured. See the [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) for the required validation experiments.

| Language | Plugin | Location | LYSS Component | Metric Key | Notes |
|----------|--------|----------|----------------|------------|-------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Deterministic variant-class rules: word order, orthographic, optional particle, lemma synonym, progressive ambiguity, inclusive/exclusive. Produces per-entry `lint_verdict` (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Deterministic: FST lemma extraction + dictionary glosses + spaCy content-word overlap. Produces verdicts (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| GiellaLT langs | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Generic: works for CRK, SME, SMA, SMJ, SMN, SMS, FIN, NOB, IKU — any language with a `.hfstol` analyzer. The metric is generic, but **evaluation corpora exist only for Plains Cree (crk)** today, so crk is the only language FST-scored in practice (see [Honest Limitations](/docs/network/honest-limitations)). |

> **Architecture note (June 2026).** Language-specific LYSS metrics are now declared on the language card under `evalMetrics` and loaded from `eval_standards/<lang>/` by `plugin_discovery.py`. They are **evaluation standards** (referee), not method plugin metrics (contestant). This means any translation method targeting CRK is automatically scored by LYSS — no method-specific configuration needed. `CrkFSTMetric` was removed; its functionality is fully covered by the generic `GiellaLTFSTMetric`.

## Appendix C: Metrics Under Consideration

These are ideas being evaluated but not yet specified enough for §2:

| Idea | What It Would Measure | Blockers |
|------|----------------------|----------|
| Fluency (LM perplexity) | Is the output well-formed prose in the target language? | Requires a target-language LM. No good models exist for most LRLs. |
| Register match | Does the translation match the expected formality level? | Requires sociolinguistic classifiers. Research problem. |
| Cultural appropriateness | Are cultural references handled correctly? | Cannot be automated — inherently requires human review. |
| Discourse coherence | Do consecutive translations form a coherent passage? | Requires document-level evaluation, not sentence-level. |

---

## References

Academic papers, tools, and language resources cited throughout this specification.

### Surface Metrics

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhagen, Denmark.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Neural Metrics

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Ababa, Ethiopia.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Online.

### Morphological and Linguistic Tools

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### Error Classification and Diagnostic Evaluation

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Related work on feature-based evaluation metrics, including FUSE.)

### Hallucination Detection

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. Online.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croatia.

### Cree Language Resources

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### Data Governance

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
