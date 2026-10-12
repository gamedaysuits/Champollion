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

> **Executive Summary.** This is the single source of truth for how runs are scored in the Champollion MT evaluation ecosystem: the one headline metric, the other standard metrics reported beside it, the diagnostics reported separately, and cost and speed. Runs are scored the way the field scores them: **corpus-level chrF++ with its sacreBLEU signature and a 95% bootstrap confidence interval**, BLEU, spBLEU, TER and COMET beside it, and paired significance tests to decide whether one system is better than another. The language-specific diagnostics (FST morphological validity, linter equivalence classes, deterministic semantic validation) are collectively named **LYSS** (Linguistically-informed Yield & Structural Scoring). The weighted composite and the quality-tier labels used before are **retired** (§4, §5); their tables stay here only so old cards can still be verified. Code, documentation, and database schemas derive from this document. When they conflict, this document is authoritative.
>
> **Scope.** This document defines *what* we measure and *how we score it*. It does not define the run card schema (see BENCHMARK_SPEC §3), the benchmark protocol (BENCHMARK_SPEC §6), or the leaderboard rules (see arena docs). Those documents reference this one for metric definitions and scoring logic.


---

## How runs are scored {#how-runs-are-scored}

Every new run is scored under **scoring standard `standard/1`**. The run card says so: `scores.scoring_standard` is `"standard/1"` and `scores.primary_metric` is `"chrf_plus_plus"`.

| Role | What | Where it appears |
|------|------|------------------|
| **Headline and ranking metric** | Corpus-level **chrF++** (sacreBLEU chrF with `word_order=2`), 0–100, with its 95% bootstrap confidence interval and its sacreBLEU signature | Written as `chrF++ 47.5 [45.9, 49.0]`, followed by the signature. Run card: `scores.chrf_plus_plus`, the CI in `scores.confidence_intervals.corpus_chrf`, the signature in `scores.sacrebleu_signatures.chrf`. Database: `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **Other standard metrics** | BLEU, spBLEU (FLORES-200 SentencePiece), TER, and COMET when it was computed | Shown beside chrF++, each with its signature or COMET model id. Never blended with chrF++ or with each other. |
| **Diagnostics** | Exact match, FST acceptance, morphological accuracy, code-switching, hallucination, terminology adherence, writing style, and every score caveat (§2.8) | Reported separately and labelled as diagnostics. They never enter a headline number and never rank a run. Caveats stay prominent beside the headline. |
| **Cost and speed** | Tokens, dollars, latency (§6, §7) | Reported beside the score, never combined with it. |

**Deciding "better".** Two runs on the same evaluation set are compared with a paired significance test on chrF++ (approximate randomization by default, paired bootstrap resampling as an option; §8.2). The other standard metrics are tested and shown too. A difference that is not significant is reported as not significant, whatever the two numbers are.

**No quality labels.** An automatic score is not a quality verdict. New cards carry no tier and no label such as "functional" or "deployable"; only human evaluation by speakers certifies quality ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**What is retired.** New cards publish `composite: null`, `quality_tier: null` and `cost_adjusted: null` (the cost-adjusted score was the composite divided by a cost factor; cost itself is still reported). No new output prints a composite or a tier. Cards published before the standard keep their stored composite and stay verifiable: the verifier re-derives a card with no `scoring_standard` using the legacy computation (§4), and a `standard/1` card by re-deriving chrF++. Wherever an old card's composite is still shown, it is labelled **legacy composite (retired)**.

**Why this is the standard.** It is how the field reports MT evaluation:

- **WMT** ranks its shared-task systems by human evaluation and reports automatic metrics beside it with sacreBLEU signatures so the numbers can be reproduced (Post 2018; Kocmi et al. 2024).
- **FLORES-200** (NLLB Team 2022) reports chrF++ and spBLEU for 200 languages, most of them low-resource.
- **AmericasNLP** shared tasks on translation into Indigenous languages of the Americas rank systems by chrF (Mager et al. 2021; Ebrahimi et al. 2023), because character n-grams cope with rich morphology better than word-level BLEU (Popović 2015, 2017).
- Kocmi et al. (2021), comparing automatic metrics against thousands of human judgments, found that the size of a metric difference and whether it is statistically significant are what predict human preference, which is why comparisons here are paired significance tests (Koehn 2004; Riezler & Maxwell 2005), not two numbers side by side.

**Contests.** A contest's qualifier is chrF++ alone, on 0–100, and a contest's `primary_metric` defaults to `chrf_plus_plus`. A new contest that asks for `composite` as its metric is refused with a reason; contests created before the standard keep working. An organizer may still set diagnostic gates in prize terms (for example a minimum FST acceptance), as gates a submission must pass, never as the score ([Prize Specification](/docs/network/specifications/prizes)).

**Changing the standard.** The headline metric changes only with a new standard version (`standard/2`). Every card names the standard it was scored under and is verified under that standard.

---

## 1. Scoring Philosophy

### 1.1 Microeval Philosophy

> *"If we only focus on what generalizes, we will inevitably forget about where it doesn't — and lose these languages and all their knowledge and wisdom."*

This project practices **microeval development**: building evaluation metrics tailored to specific languages using the best available linguistic tools — finite-state transducers, bilingual dictionaries, morphological analyzers, linguist-curated equivalence rules. This is the opposite of the dominant paradigm in MT evaluation, which seeks universal metrics that work across all languages. Universal metrics are valuable, but they are weakest precisely where they are needed most: for languages with complex morphology, limited training data, and no representation in neural metric training sets.

We are not making progress in machine translation for many of the world's languages not only because we lack corpora, but because **we don't even know what progress looks like** — we lack the automated evaluation tools to measure whether a translation system is improving. LYSS is our attempt to build those tools, language by language, using whatever linguistic resources exist.

### 1.2 Automated Metrics Are Proxies

Every metric defined here is machine-computed. They are useful for rapid iteration, systematic comparison, and detecting regressions. They are **not substitutes for human judgment**, which is why no automatic score carries a quality label — only human review can confirm actual usability.

### 1.3 One Headline, Many Signals

No single metric captures translation quality. A translation can have high chrF++ overlap but fail morphological validation. It can pass FST checks but carry the wrong meaning. It can be semantically accurate but stylistically alien to the target language. So every run reports many signals — but only one of them, chrF++, is the headline and the ranking metric, and the others are shown beside it, never blended into it. A blend of signals that mean different things for different languages can be gamed by a system that does well on the cheap signals (§4 records how the retired composite was), and a reader cannot tell from a blended number which signal moved.

### 1.4 Extensibility

This metric inventory is not closed. New languages bring new requirements: tone accuracy for tonal languages, diacritical precision for Semitic scripts, syllabary correctness for Cree. The architecture (MetricPlugin protocol) lets diagnostics be added without changing any headline score. Language-specific metrics (e.g., CRK's linter and semantic validator) are declared on language cards under `evalMetrics` and loaded from `eval_standards/` — the harness ships with generic behavioral metrics only (code-switching, hallucination, terminology).

### 1.5 Three Dimensions of Evaluation

Every run card measures three independent dimensions:

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

These are independent axes. A method can score well but be expensive, be fast but inaccurate, or any combination. The leaderboard enables sorting by any dimension. No published number combines them (the cost-adjusted score that did, §6.3, is retired).

### 1.6 Validation Status

Every metric in this specification has a **validation status** distinct from its implementation status (§3). Implementation status tracks whether code exists. Validation status tracks whether the metric has been shown to correlate with human quality judgments.

| Validation Level | Meaning | Current Metrics |
|------------------|---------|----------------|
| **✅ Externally validated** | Published human-correlation studies exist (WMT, academic papers) | `chrf_plus_plus`, `bleu`, `comet_score` *(high-resource pairs only)* |
| **⚡ Proxy-validated** | Validated for high-resource languages; unvalidated for our target LRLs | `comet_score` *(for LRLs: validated on high-resource/EU pairs, extrapolated to e.g. CRK — directionally useful but uncalibrated)* |

| **🔶 Engineering heuristic** | Designed from linguistic principles or observed failure modes; no human correlation data | `fst_acceptance_rate`, `morphological_accuracy` (FST-derived, lemma-matched, verifier-re-derived), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Unvalidated** | Not yet tested on any data | `orthographic_accuracy`, `consistency_score` |

> **Why `comet_score` appears in two rows.** This is a split by resource level, not a contradiction. COMET is *externally validated* where WMT human-correlation studies exist — high-resource, mostly European pairs. For our target low-resource languages there are no such studies, so the same metric is only *proxy-validated*: the model extrapolates from languages with different morphological systems. It is shown beside chrF++ with its model id and a calibration caveat, never blended.

> **What this means in practice.** The headline (chrF++) is an externally validated metric, used the way the field uses it. Every engineering heuristic above is a **diagnostic**: it can explain *why* a run scored as it did (the words are not valid forms, the output switched into English), but it is never a score and never ranks a run. The retired composite (§4) put heuristics at all validation levels into the headline, and a system could earn most of it without translating (§4).
>
> **Required validation experiments** (see `mt-evaluation-landscape.md` §6 and `speaker-validation.md`):
> 1. Human judgment correlation study: 200+ sentence pairs rated by 3+ bilingual speakers
> 2. FST false rejection rate measurement on a representative corpus
> 3. Second-language port (North Sámi) to test generalization
> 4. Direct comparison with COMET on the same data


---

## 2. Metric Inventory {#2-metric-inventory}

Metrics are organized into six categories (surface, structural, semantic, behavioral, compliance, and reported comparators). Each metric has an implementation status, scale, and level (per-entry, corpus-level, or both), and one of three roles under the standard: **headline** (chrF++ only), **standard** (BLEU, spBLEU, TER, COMET — shown beside the headline), or **diagnostic** (everything else — reported separately).

### 2.1 Surface Metrics

Surface metrics compare the predicted translation to the reference translation at the string level. They require no linguistic tools — just string comparison.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Exact Match | ✅ Implemented | 0.0–1.0 | Both | **Diagnostic.** Binary: does predicted == reference? Corpus rate = matches / total. |
| `equivalent_match_rate` | Equivalent Match | ⚡ Partial | 0.0–1.0 | Both | **Diagnostic.** Does the predicted output match any accepted variant? For CRK: implemented via the CRK eval standard's `CrkLinterMetric` (in `eval_standards/crk/`) using deterministic variant-class rules (word order, orthographic, optional particle, lemma synonym, progressive ambiguity). Loaded automatically via the CRK language card's `evalMetrics` declaration. Generic cross-language implementation requires per-entry `variants[]` in corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implemented | 0–100 | Both | **Headline and ranking metric.** Character n-gram F-score with word unigrams and bigrams (sacreBLEU chrF, `word_order=2`; Popović 2017). Robust to morphological variation. The published value is corpus-level (`corpus_chrf`), with a 95% bootstrap CI and its sacreBLEU signature; per-entry values (`sentence_chrf`) feed the significance tests. |
| `bleu` | BLEU | ✅ Implemented | 0–100 | Corpus | **Standard metric, shown beside chrF++** (run card and database `corpus_bleu`, with its sacreBLEU signature). Word-level n-gram precision (Papineni et al. 2002). Not the headline because word-level matching counts a correct word with a different suffix as a complete miss, which penalizes morphologically rich languages. |
| `ter` | Translation Edit Rate | ✅ Implemented | 0–∞ (lower is better) | Both | **Standard metric, shown beside chrF++** (`scores.ter`, with its sacreBLEU signature). Minimum edit distance between predicted and reference, normalized by reference length (sacreBLEU `corpus_ter`; Snover et al. 2006). |
| `length_ratio` | Length Ratio | ✅ Implemented | 0–∞ (1.0 is ideal) | Both | **Diagnostic.** `len(predicted) / len(reference)` in characters. Detects truncation (<0.5) and inflation/hallucination (>2.0). Averaged across entries at corpus level. |

### 2.2 Structural Metrics

Structural metrics validate the linguistic well-formedness of the translation. They require language-specific tools (FST analyzers, morphological parsers) and are the strongest signals for morphologically rich languages.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | FST Acceptance | ✅ Implemented | 0.0–1.0 | Both | **Diagnostic.** Acceptance of output words by a finite-state transducer (GiellaLT). A word is "valid" if the FST returns at least one morphological analysis. **Aggregation:** the published corpus value is the **mean of per-entry rates** — each entry's accepted words ÷ its words, averaged over the entries the FST analyzed, an empty output counting as 0 (the plugin's `avg_fst_validity`). The pooled word rate (all accepted words ÷ all words, `corpus_validity_rate`) is reported beside it in the run report and on the run card but is not the published value; the two differ when entries differ in length. Available for any language with a GiellaLT `.hfstol` analyzer. **Case:** a word is looked up as written; if the FST rejects it and it starts with a capital, it is looked up again with its first letter lowered (`Mun` → `mun`), and an ALL-CAPS word as Titlecase and then in lower case (`OSLO` → `Oslo`, `GIITU` → `giitu`). Never the other way: a proper noun written in lower case (`oslo`) stays rejected. GiellaLT's spell-checker acceptors (Northern Sámi, Amharic, Basque) and ALTLab's strict Plains Cree analyser list most words only in lower case and leave case to the program around them, so without this a correct sentence-initial capital counted as an invalid word. This is computation version `case-fallback/1`, named in the report (`fst_acceptance_method`, with `total_case_folded_words` and each entry's `fst_case_folded_words`) and on the run card (`fst_provenance.acceptance_method`). A report without it was scored case-sensitively and reads lower for capitalised text; `mt-eval compare` says so when it compares the two, and `mt-eval test <run log>` re-scores an old run. The verifier re-derives a published card's FST-derived numbers with the method that card names, and a card without one case-sensitively, so a card is checked against the computation it was published with. |
| `morphological_accuracy` | Morphological Accuracy | ✅ Implemented (verifier-re-derived) | 0.0–1.0 | Both | **Diagnostic.** A word can be FST-valid but have the wrong inflection (right root, wrong suffix). **Computed** by `plugins/giellalt_fst.py`: for each analyzable predicted word, find a reference word sharing its **lemma** (root) and check whether the predicted **inflection** (FST feature tags) matches. Matching by lemma — not position — sidesteps word alignment: a different word choice or a mis-aligned pair simply isn't *covered* (never falsely scored). **No gold annotations needed** — the FST analysis of the reference *is* the ground truth. Words the FST can't analyze, or whose root isn't in the reference, are out of coverage; `morph_coverage` (the fraction lemma-matched) is disclosed, and below `MORPH_COVERAGE_FLOOR` (0.25) the value is marked advisory. It is **lenient under FST ambiguity** (a predicted word with several analyses is "correct" if *any* matches → an upper bound, disclosed). It needs an **analyzer**: an FST that is only a spell-checker **acceptor** (the Divvun speller packages installed for Northern Sámi, Amharic and Basque) says whether a word exists but gives no lemma or tags. For those, `morphological_accuracy` and `morph_coverage` are null and `metric_availability` says why; FST acceptance is still reported. The FST pin declares this (`kind: "acceptor"`), and the metric also detects a transducer that never returns a tag. It is **re-derived by the verifier** against the canonical corpus (`verifier.recompute_corpus_morph`, which re-runs the card-pinned FST — fail-closed if the FST is absent, same contract as COMET). Under the retired composite it carried a 0.15 weight in the fst-coverage profile (§4.3). |
| `orthographic_accuracy` | Orthographic Accuracy | 🔲 Planned | 0.0–1.0 | Both | **Diagnostic (planned).** Validates script-specific correctness: SRO macron/circumflex usage for Cree, diacritical marks for Inuktitut, vowel length markers for Ojibwe. Per-language rule sets. |

> **What structural metrics add, and why they are diagnostics.** Meta's OMT-1600 — the largest MT system ever published (1,600 languages; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — evaluates with ChrF++, xCOMET, MetricX, and BLASER 3. None of these validate morphological correctness: chrF++ measures character n-gram overlap and rewards strings that *look* like the reference, so a morphologically invalid word that shares many characters with the reference still earns credit. FST acceptance answers a different question: is each word a valid form in the language? That makes it a useful diagnostic for polysynthetic languages. It is not a translation score: it never looks at the source or the reference, so a system that prints one valid sentence for every input passes it completely (§4 gives the measured case). ChrF++ also has a **nonzero chance floor** that differs by orthography — random same-script text scores measurably above zero, more in some writing systems than others — so raw chrF++ is not comparable across languages; it ranks systems on the same evaluation set only. The network map therefore does **not** rank strength across languages at all — an arc means the pair has been measured, nothing more. The chance-floor correction we built for this (cchrF++) is published research and is wired to no public surface; [Connection Strength](/docs/network/specifications/connection-strength) explains what it establishes and what it does not.

### 2.3 Semantic Metrics

Semantic metrics measure meaning preservation using embeddings or learned models. They catch translations that are surface-different but meaning-equivalent, and flag translations that are surface-similar but semantically wrong.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Semantic Similarity | ⚡ Partial | 0.0–1.0 | Both | **Diagnostic.** CRK: verdict-weighted score from the CRK eval standard's `CrkSemanticMetric` (in `eval_standards/crk/`, proxy). Universal: cosine similarity of sentence embeddings (source + predicted vs source + reference). Model TBD — must support low-resource languages, which rules out most English-centric embedding models. |
| `comet_score` | COMET | ✅ Implemented | ~0.0–1.0 | Both | **Standard metric when computed, shown beside chrF++ with its model id** (`comet_model`). Learned MT evaluation metric (Rei et al. 2020). Never blended with chrF++. Re-derived by the verifier, so a reported value must reproduce. Flagged with a low-resource calibration caveat for languages like Plains Cree. Computed when `unbabel-comet` is installed. For 35 African languages, the harness auto-selects AfriCOMET (`masakhane/africomet-mtl`) via `resolve_comet_model()`, which has better human-judgment correlation for those languages. |

> **Why COMET is beside the headline, not the headline.** COMET is trained on WMT human-evaluation data, overwhelmingly high-resource European pairs. For genuinely high-resource pairs (German, French, …) the default `Unbabel/wmt22-comet-da` is well-validated by WMT, and `resolve_comet_model()` selects it. Applied to Plains Cree or other LRLs the model extrapolates from languages with different morphological systems — directionally useful but not calibrated, and the card says so. It also needs a 2.3 GB model, so it is not computed for every run. chrF++ is reproducible from the corpus alone for every language, which is why it is the headline and COMET is reported beside it whenever it was computed.

> **AfriCOMET for African languages.** Each language card has a `metricModelSupport` field (see language card spec §9) that declares which specialized COMET models are trained for that language. For 35 African languages (yor, hau, ibo, amh, swa, etc.), the card declares AfriCOMET (`masakhane/africomet-mtl`) — a COMET model fine-tuned on African language MT human judgments by the Masakhane community. The harness auto-selects the recommended model via `resolve_comet_model()` reading from language cards, but this can be overridden with `--comet-model`. Adding new language→model mappings is done by enriching the language card (not editing Python code).

### 2.4 Behavioral Metrics

Behavioral metrics detect specific failure modes in translation output. They don't measure quality directly — they detect problems. All of them are **diagnostics**.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Code-Switching Rate | ✅ Implemented | 0.0–1.0 (lower is better) | Both | Proportion of output words that are in the source language (typically English). Detected via Unicode script analysis and/or a source-language word list. Very common LLM failure mode: the model inserts English words when it doesn't know the target-language equivalent. |
| `hallucination_rate` | Hallucination Rate | ✅ Implemented | 0.0–1.0 (lower is better) | Both | Proportion of output content that has no corresponding source content. Detected via word alignment or cross-lingual embedding overlap. Catches the model generating plausible-sounding but fabricated translations. |
| `terminology_adherence` | Terminology Adherence | ✅ Implemented | 0.0–1.0 | Both | For coached methods: proportion of prescribed terminology terms that appear in the output. Requires a glossary (`{"source term": "translation"}`, or a list of accepted translations per term). The source is `--glossary <file.json>`, an evaluation input that is never sent to the model and is given to every run compared. Otherwise it is the `dictionary` object of a JSON `--coaching-file`: the run is then scored against its own coaching, and the run output says so. Without either, the metric is inactive (null). Measures whether the model respects expert-provided vocabulary. |
| `consistency_score` | Cross-Entry Consistency | 🔲 Planned | 0.0–1.0 | Corpus only | Does the model translate the same source term the same way across entries? Low consistency suggests the model is guessing rather than applying learned patterns. Requires repeated terms across corpus entries. |

### 2.5 Compliance Metrics

Compliance metrics validate that translations preserve structural integrity — placeholders, formatting, and typography conventions. They are quality-gate checks, not quality scores, and are diagnostics under the standard.

| ID | Metric | Status | Scale | Level | Implementation |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Double-Pass Compliance | 🔲 Planned | 0.0–1.0 | Both | Weighted composite: 60% variable integrity (are `{placeholder}` vars preserved?) + 20% quote compliance (the target language's quote characters) + 20% casing compliance (no Latin letter leakage for caseless languages). Computed on both raw and post-processed output. A `DoublePassCompliancePlugin` class exists, but no evaluation run loads it, and no cited source for per-language quote and casing conventions exists yet. Language cards do not carry them. Without that source, only the variable-integrity term measures anything. |
| `repair_effectiveness` | Repair Effectiveness | 🔲 Planned | 0.0–1.0 | Corpus | Proportion of compliance violations that were automatically repaired by post-translation hooks. Measures how much the quality gate improved the raw output. Planned for the same reason as `compliance_index`. |

> **Why compliance is a gate, not a score.** Compliance metrics measure structural preservation (placeholders, quotes), not translation quality. A translation can be perfect linguistically but fail compliance because it dropped a `{name}` variable. They are designed as quality gates, to block bad output from shipping, not to rank translation quality.

### 2.6 Reported comparators

spBLEU is one of the standard metrics shown beside chrF++; plain chrF and the FUSE-style comparator are reported for comparison with other published tables. None of them is blended with anything:

| ID | Metric | Status | Notes |
|----|--------|--------|-------|
| `spbleu` | spBLEU (FLORES-200 tokenizer) | ✅ Implemented | **Standard metric, shown beside chrF++** (`scores.spbleu`, with its sacreBLEU signature). BLEU on the FLORES-200 SentencePiece tokenization (Goyal et al. 2022) — comparable across scripts/segmentation (the NLLB/FLORES lingua-franca). Needs `sentencepiece` (core dep). |
| `chrf_plain` | Plain chrF (`word_order=0`) | ✅ Implemented | The chrF figure AmericasNLP and many WMT tables report, alongside our chrF++ headline (`word_order=2`). Its signature is `sacrebleu_signatures.chrf_plain`. |
| `fuse_score` | FUSE-style comparator | ⚡ Opt-in (`--fuse`) | An **UNTRAINED reimplementation** of the AmericasNLP-2025 FUSE approach (Raja & Vats): LaBSE semantic + lexical token-F1 + phonetic Soundex + fuzzy difflib, blended as an *unweighted mean* (we have no human-judgment training data to fit the original Ridge/GBM, and say so). LaBSE/Soundex are the optional `fuse` extra; without LaBSE, `compute_fuse` returns `None` (disclosed) rather than faking a score. Each component that ran is listed in `fuse_components`; the result is flagged `fuse_untrained=true`. A diagnostic comparator only. |

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
`direction` (higher/lower/neutral), `level` (entry/corpus/both), `in_composite`
(whether it was in the retired composite; kept for verifying old cards), and
`verifier_reproducible`. A parity test fails if `scoring.py`'s tables or the
run-card `scores` keys minted by `publish.py` drift from the registry, so a new
metric cannot ship half-wired.

Two related run-card fields make metric provenance explicit:

- **`scores.metric_availability`** — a `{metric: reason}` block that disambiguates a
  `null` score: `not_applicable` (the language/run does not use it), `unavailable`
  (an optional dependency was missing), `below_coverage_floor` (present but too
  sparse to be more than advisory), `not_run` (opt-in and not requested), or
  `not_implemented` (planned). A metric absent from the block was computed normally.
- **`fst_version`** / **`fst_provenance`** — the installed GiellaLT transducer
  release and `pyhfst` version behind any FST-derived metric, captured the same way
  as the sacreBLEU signatures so a structural score can be traced to an exact
  analyzer build. `fst_provenance.acceptance_method` names how acceptance was
  computed from the transducer's answers (`case-fallback/1`, §1); a card without
  it was scored case-sensitively.
- **`scores.sacrebleu_signatures`** — the sacreBLEU signature of every
  sacreBLEU metric the run computed: `chrf` (the chrF++ headline,
  `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. Two chrF++ numbers are
  comparable only when their signatures match (Post 2018).

### 2.8 Score Caveats {#2-8-score-caveats}

A score can be computed correctly and still not mean what its label says. The
harness checks every run for the known ways that happens and, when one fires,
prints it beside the headline in the test summary, `mt-eval compare`, the
publish preview and the dashboard, and the published card carries it as
`score_caveats` so the leaderboard shows it too. A caveat never changes a score;
it says what limits it. Each is a diagnostic with a `severity` (`major` or
`minor`) and a one-sentence message that names counts, never the outputs
themselves.

| Caveat | Fires when |
|--------|-----------|
| `source_copy` | At least half of the scored outputs equal their source (case, accents and punctuation ignored). An entry whose reference is itself the source (a name, a number) is left out. |
| `length_deflation` | Outputs average under 0.5× the reference length, or a quarter or more of them do — words were left out. FST acceptance and code-switching judge only the words present, so dropping words raises them. |
| `length_inflation` | Outputs average over 2× the reference length, or a quarter or more of them do (for example, few-shot examples leaking into every output). |
| `near_constant_output` | One output is given for many different inputs: repeats cover at least a quarter of the distinct sources, and at least 5 of them. An output counts as a repeat when 3 sources got it (an output of three or more words) or 5 (a one- or two-word output, since short answers such as "Yes." legitimately recur); an output equal to its own reference is a correct answer, not a repeat. Before choosing those bounds the rule was run over 2,161 real system outputs and references from the WMT 2019–2025 metrics tasks; the five it flags are all broken output. |
| `train_test_near_twin` | Written by nmt-forge: every (or nearly every) test row has a near-identical twin in the training data, so the score measures recall of training phrases, not translation. |

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

## 4. Retired: the Composite (legacy) {#4-composite-score}

> [!CAUTION]
> **No new run is scored with the composite.** It was retired by scoring standard `standard/1` ([How runs are scored](#how-runs-are-scored)). New cards publish `composite: null`. This section is kept **only** so cards published before the standard can still be read and verified: the verifier re-derives the stored composite of any card that carries no `scores.scoring_standard`, with exactly the formula and tables below. Wherever an old card's composite is still shown, it is labelled **legacy composite (retired)**, and it is never compared with chrF++ or with a new card.

### Why it was retired {#why-the-composite-was-retired}

The composite was a weighted blend of chrF++/100, exact match, FST acceptance (weight 0.25), morphological accuracy, the semantic score, code-switching, hallucination and terminology, with weights set by engineering judgment and never fitted to human judgments. Because several of its inputs never compare the output with the source or the reference, a system could earn most of it without translating:

- **One sentence for every input.** An untrained English→Northern Sámi model that repeated one valid Northern Sámi sentence for every input scored a composite of **0.6244** — labelled "functional" — with **chrF++ 5.5**. The repeated words are valid Sámi, so FST acceptance was 100%, and for a language whose FST is a spell-checking acceptor, FST acceptance carried about 45% of the composite once the absent metrics were re-weighted away.
- **Dropping what it cannot translate.** A toy glossary that leaves out every word it does not know scored **0.6612**, because FST acceptance and code-switching judge only the words an output contains.
- **Copying the source.** English copied through unchanged as "Northern Sámi" output still earned FST credit, since a speller accepts capitalised and some English words.

No standard evaluation would rank these systems above a real translation, and chrF++ does not: it compares every output with its reference. The harness's caveats (§2.8) catch these patterns too, and stay prominent beside the chrF++ headline.

### 4.1 Formula (legacy)

The composite score was a weighted average of all *available* metrics, re-normalized so the weights of available metrics sum to 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

A metric is "available" if its value in the run card is a number (not `null`). When a metric was unavailable — because the language has no FST, or because a metric is not yet implemented — its weight was redistributed proportionally across the remaining metrics. Composites computed from different metric sets were never comparable; each legacy card records its `scores.scoring_profile` and `scores.metric_availability` (§2.7), so the verifier knows which set to use.

### 4.2 Input Normalization (legacy)

Before entering the composite formula, every metric was put on a **0.0–1.0 scale** where 1.0 = perfect:

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

### 4.3 Weight Tables (legacy) {#43-weight-tables}

Each language resolved to a **named profile** via `language_cards.resolve_scoring_profile()` (`fst-coverage` when an FST scored the run, else `surface-only`, unless the language card declared `scoringProfile.basis`); the profile is mirrored in `scoring.py`'s `PROFILE_REGISTRY` and recorded on each legacy card as `scores.scoring_profile`. `orthographic_accuracy` is listed in `scoring.INACTIVE_METRICS` and was never computed, so its weight was always redistributed. `morphological_accuracy` entered only when `morph_coverage ≥ 0.25`. Neural metrics (`comet_score`, `qe_score`; `scoring.NEURAL_METRICS`) were never in any composite.

#### `fst-coverage` (Profile A): Languages WITH FST Coverage

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

> **Total: 1.00.** With `morphological_accuracy` absent (no FST analyzer, an acceptor-only FST, or coverage under 0.25), the remaining 8 metrics (total 0.85) were each scaled by 1/0.85 ≈ 1.176. For an acceptor-only FST language (Northern Sámi, Amharic, Basque) with no evaluation standard and no glossary, only FST acceptance 0.25, chrF++ 0.15, code-switching, hallucination and exact match (0.05 each) remained — total 0.55 — so FST acceptance carried **0.25/0.55 ≈ 45%** of the composite. That is the weighting the examples above exploited.

#### `surface-only` (Profile B): Languages WITHOUT FST Coverage

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

> **Total: 1.00.** `orthographic_accuracy` was never computed, so the remaining 7 metrics (total 0.95) were scaled by 1/0.95 ≈ 1.053.

#### `no-reference`: runs with NO gold reference

| Metric | Target Weight | Rationale |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | Morphological validity needs no reference; the strongest deterministic signal when an FST exists. |
| `code_switching_rate` | **0.25** | Source-language leakage (inverted). |
| `hallucination_rate` | **0.20** | Fabricated content (inverted). |
| `terminology_adherence` | **0.15** | Coached vocabulary compliance. |

> **Total: 1.00.** For runs whose corpus had no gold references. When such a run had no FST, the composite renormalized over the behavioral checks alone.

### 4.4 Adding a New Metric

A new metric is added as a **diagnostic**; it never changes the headline:

1. **Define it** in §2 with status `🔲 Planned`, including scale, level, direction, and computation method.
2. **Implement it** as a MetricPlugin (or in `tester.py` for core metrics).
3. **Register it** in `shared/metric-registry.json` and add a null placeholder in the run card scores block.
4. **Update BENCHMARK_SPEC.md** §3 if the run card schema changes.
5. **Run a validation benchmark** to confirm the metric produces sensible values on real data.
6. **Update this document** to change status from `🔲` to `✅`.

Changing the headline or ranking metric is not "adding a metric": it needs a new scoring standard version ([How runs are scored](#how-runs-are-scored)).

---

## 5. Retired: Quality Tiers (legacy) {#5-quality-tiers}

> [!CAUTION]
> **No new card carries a quality tier.** New cards publish `quality_tier: null`, and no new output prints a tier or a label such as "functional" or "deployable". An automatic score is not a quality verdict: the same number means different things for different languages and evaluation sets, and the retired tiers labelled a system that repeated one sentence for every input "functional" (§4). Only human evaluation by speakers certifies quality ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

The tiers were labels read off the legacy composite. Legacy cards still store them; they are kept here only so an old card can be read, and are not quality claims.

| Legacy tier | Legacy composite range |
|------|----------------|
| Baseline | 0.00–0.30 |
| Emerging | 0.30–0.50 |
| Functional | 0.50–0.70 |
| Deployable | 0.70–0.85 |
| Fluent | 0.85–1.00 |

### 5.1 Tier Thresholds (Machine-Readable, legacy)

The legacy thresholds (evaluated top-down, first match wins):

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

Cost metrics measure the financial efficiency of a translation method. They are reported beside the score and never combined with it.

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

### 6.3 Cost-Adjusted Score (retired)

Legacy cards carry a cost-adjusted score, computed from the retired composite:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

It is retired with the composite: new cards publish `cost_adjusted: null`. To weigh cost against quality, read chrF++ (with its CI) and `cost_per_entry_usd` side by side; the leaderboard can sort by either.

---

## 7. Speed Metrics

Speed metrics measure the latency and throughput of a translation method. Like cost, speed is reported beside the score and never combined with it.

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

Confidence intervals are percentile bootstrap intervals over the evaluation set's segments (n=1000 resamples, α=0.05; Koehn 2004). The chrF++ interval is part of the headline: `chrF++ 47.5 [45.9, 49.0]`. With a small evaluation set the interval is wide, and the harness warns when a subset is too small for a meaningful interval.

| Metric | CI Reported |
|--------|------------|
| `chrf_plus_plus` (headline) | ✅ run card `confidence_intervals.corpus_chrf`; database `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (only computed when FST data exists) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (bootstrapped from cached per-entry scores — no redundant neural inference) |
| `composite` | Legacy cards only (`composite_ci_lower`, `composite_ci_upper`); not computed for new runs |
| per-tier CIs | ✅ `confidence_intervals_by_tier` — chrF++ and exact_match CIs per difficulty level (Tier 1-5) |

### 8.2 Paired Significance Tests {#82-paired-significance-tests}

Whether one run is better than another is decided by a paired significance test on chrF++ over the segments both runs translated, never by comparing two numbers. `mt-eval compare --significance` runs:

- **Approximate randomization** (the default; Riezler & Maxwell 2005, also sacreBLEU's default): the two systems' outputs are swapped segment by segment at random, 1,000 times, to see how often a difference at least as large arises by chance.
- **Paired bootstrap resampling** (`--method paired_bootstrap`; Koehn 2004): segments are resampled with replacement and the difference is recomputed on each sample. It is a more conservative estimate, offered for comparison with older papers.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

Each difference comes with its 95% confidence interval and is reported as significant when p < 0.05. BLEU, spBLEU, TER and the diagnostics present in both runs are tested and shown too (p-values are per metric and uncorrected for multiple tests), but the verdict on "better" is the chrF++ test. Two chrF++ numbers are comparable only when their sacreBLEU signatures match. If one of the compared reports is a legacy one, compare says its composite is retired and does not compare it. Full method: [Statistical Significance Testing](/docs/network/specifications/significance).

---

## 9. Run Card Scores Schema

This section defines the hierarchical structure of the `scores` block in a run card. This schema is derived from the metrics defined in §2–§7 and must be kept in sync.

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
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

Score caveats (§2.8) ride at the card's top level as `score_caveats`, a list of `{kind, source, severity, message, …}` objects; BLEU rides there as `corpus_bleu`.

> **Schema history.** Earlier spec drafts proposed separate `cost`, `speed`, and `tokens` blocks. These were merged into `scores` and `totals` respectively for simplicity. Speed metrics (`tokens_per_second`, `entries_per_minute`, latencies) live in `scores`; token counts and cost figures live in `totals`.

### 9.1 Schema–Database Mapping

The run card JSON is stored in full as a `jsonb` column in Supabase. Key metrics are also denormalized into top-level columns for sort/filter performance:

| Run Card Field | Supabase Column | Type | Index |
|---------------|----------------|------|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — legacy cards only; null for `standard/1` |
| `scores.quality_tier` | `quality_tier` | `text` | — legacy cards only; null for `standard/1` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
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

This document is the canonical source for:
- The scoring standard: the headline metric, the standard metrics beside it, and the diagnostics ([How runs are scored](#how-runs-are-scored))
- Metric definitions (§2) and score caveats (§2.8)
- The legacy composite weight tables (§4.3) and tier thresholds (§5.1), kept for verifying old cards
- Cost metric formulas (§6.2)
- Run card scores schema (§9)

### 10.2 Code Mirror

The file `arena/mt_eval_harness/scoring.py` is the code implementation of this document: the standard's metric roles (`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`) and, below them, the legacy composite tables and tier thresholds used only to verify old cards. No other module defines them; the harness's tests pin both. When this document is updated, update `scoring.py` to match and re-run the harness tests.

### 10.3 Documents That Reference This Spec

| Document | What It References | How to Keep in Sync |
|----------|-------------------|---------------------|
| [Benchmark Specification](/docs/network/specifications/benchmark) §4–§5 | The headline metric, ranking, legacy composite | Cross-reference this doc; do not duplicate tables |
| [Statistical Significance Testing](/docs/network/specifications/significance) | How "better" is decided | Must match §8.2 |
| [FAQ](/docs/network/getting-started/faq) and [How It Works](/docs/network/how-it-works) | Plain-language summary of the standard | Link back to this doc |
| `publish.py` via `scoring.py` | `standard_score_fields()` and the legacy composite | Harness tests validate the match |

---

## Appendix A: Why chrF++ Is the Headline (and the Others Are Not)

| Metric | Role | Why |
|--------|------|-----|
| **chrF++** | Headline | Character n-grams give partial credit for a word with the right root and a different suffix, so it copes with rich morphology better than word-level metrics (Popović 2015, 2017). It is reproducible from the corpus alone for every language and script, and it is what FLORES-200 and the AmericasNLP shared tasks report. |
| **BLEU** | Standard, beside | Word-level matching counts a minor inflectional difference as a complete miss, which penalizes polysynthetic languages. Reported for comparison with the MT literature. |
| **spBLEU** | Standard, beside | BLEU on a shared SentencePiece tokenization, comparable across scripts; reported by FLORES-200. |
| **TER** | Standard, beside | Edit distance; correlates with chrF++ for most use cases. |
| **COMET** | Standard, beside (when computed) | Trained on WMT data (high-resource European pairs). For LRLs (e.g. Cree) the model extrapolates and is uncalibrated, and it needs a large model, so it cannot be the one number every run has. Re-derived by the verifier. |
| **Length Ratio** | Diagnostic | A ratio of 1.02 and a ratio of 0.98 are both fine. Only extreme values indicate problems (§2.8). |
| **FST acceptance, morphological accuracy, LYSS** | Diagnostic | Engineering heuristics with no human-correlation data; FST acceptance never looks at the source or reference (§4). |
| **Consistency Score** | Diagnostic (planned) | Some inconsistency is legitimate (same English word → different target-language translations depending on context). |
| **Compliance Index** | Gate (planned) | Measures structural preservation (placeholders, quotes), not translation accuracy. |

## Appendix B: LYSS — Language-Specific Metric Implementations

The **LYSS** framework (Linguistically-informed Yield & Structural Scoring) provides language-specific metrics that go beyond surface-level string comparison. LYSS has three core components:

- **LYSS-fst** — Morphological validity (`fst_acceptance_rate`): Is each word a valid form in the target language?
- **LYSS-eq** — Linguistic equivalence (`equivalent_match_rate`): Is the output an acceptable variant of the reference?
- **LYSS-sem** — Semantic validation (`semantic_score`): Does the output preserve the source meaning?

All three are **diagnostics** under the scoring standard: reported beside the chrF++ headline, never in it.

> **Validation status: 🔶 Engineering heuristic.** LYSS metrics have NOT been validated against human quality judgments. They are designed from linguistic principles (FSTs, dictionaries, grammar rules built by linguists at UAlberta ALTLab), but the correlation between LYSS scores and actual translation quality has not been measured. See the [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) for the required validation experiments.

| Language | Plugin | Location | LYSS Component | Metric Key | Notes |
|----------|--------|----------|----------------|------------|-------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Deterministic variant-class rules: word order, orthographic, optional particle, lemma synonym, progressive ambiguity, inclusive/exclusive. Produces per-entry `lint_verdict` (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Deterministic: FST lemma extraction + dictionary glosses + spaCy content-word overlap. Produces verdicts (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| GiellaLT langs | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Generic: any language with an FST pinned in the harness (`mt_eval_harness/data/fst-pins.json`). An analyzer FST also yields `morphological_accuracy`; an acceptor-only speller (the Divvun packages pinned for Northern Sámi, Amharic and Basque) reports acceptance only. Being FST-scored in practice also takes an evaluation set for the pair that can rank: Plains Cree's two sets (EdTeKLA) are quarantined labels the database refuses a score against, while several other FST languages have open sets (Tatoeba, WMT, WMT24++). The [datasets page](/docs/network/leaderboard/datasets) lists the catalogue, and `mt-eval corpora --source eng --target <code>` lists what can run for a pair (see [Honest Limitations](/docs/network/honest-limitations)). |

> **Architecture note (June 2026).** Language-specific LYSS metrics are now declared on the language card under `evalMetrics` and loaded from `eval_standards/<lang>/` by `plugin_discovery.py`. They are **evaluation standards** (referee), not method plugin metrics (contestant). This means any translation method targeting CRK is automatically checked by the LYSS diagnostics — no method-specific configuration needed. `CrkFSTMetric` was removed; its functionality is fully covered by the generic `GiellaLTFSTMetric`.

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

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lisbon, Portugal.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Evaluation Practice and Significance Testing

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, Spain.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; reports chrF++ and spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

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
