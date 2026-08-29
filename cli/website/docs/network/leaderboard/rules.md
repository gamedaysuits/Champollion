---
sidebar_position: 1
title: Submission Rules
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How the composite score is computed"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# MT Evaluation

> **Executive Summary.** This page defines the leaderboard submission criteria, scoring metrics (chrF++, FST acceptance, exact match, equivalent match, semantic score), anti-gaming policies, verification tiers, and the submission workflow. Methods that have been exposed to evaluation data are disqualified.

champollion includes a machine translation evaluation framework designed for **reproducible benchmarking** of translation methods — especially for low-resource and Indigenous languages where standard MT benchmarks don't exist and quality claims are hard to verify.

---

## The Leaderboard

The centerpiece is the **[Method Leaderboard](https://champollion.dev/leaderboard)** — a public scoreboard, live and **open for submissions**, where researchers and community members submit and compare translation methods with fingerprinted, reproducible evaluation.

Every submission includes:

- **Fingerprinted pipeline** — tied to a specific Git commit and config hash, so results trace back to the exact code that produced them
- **Versioned dataset** — content-hashed and versioned; scores are only comparable within the same dataset version
- **Standardised metrics** — all scoring is computed by the shared evaluation harness, eliminating implementation differences
- **Trust tiers** — self-benchmarked, Champollion Verified, or Community Validated
- **Cost tracking** — API cost per submission, so cost–quality tradeoffs are transparent

The leaderboard scores five metrics. Three work for any language; two are available for Plains Cree and will be generalized as we expand:

| Metric | Type | What It Measures |
|--------|------|------------------|
| **chrF++** | Character n-gram F-score | Primary quality metric — correlates well with human judgement, especially for morphologically rich languages |
| **Exact Match** | Proportion of perfect matches | Strict accuracy — how often is the translation exactly the gold standard? |
| **FST Acceptance** | Morphological gate pass rate | For methods with finite-state transducer verification — what proportion of outputs are morphologically valid? |
| **Equivalent Match** | Acceptable variant rate | Fraction matching the reference or an acceptable variant (word order, orthographic convention). Currently CRK; generalizing. |
| **Semantic Score** | Semantic fidelity | Meaning preservation — does the translation capture the intended meaning regardless of surface form? Currently CRK; generalizing. |

:::info[Full Metric Suite]
The [Scoring Specification](/docs/network/specifications/scoring) defines the complete metric inventory (six categories: surface, structural, semantic, behavioral, compliance, and reported comparators), composite score formula, weight tables, and quality tier thresholds.
:::

**[→ View the leaderboard](https://champollion.dev/leaderboard)**

---

## Available Datasets

### EDTeKLA Development Set v1

The first evaluation dataset, built for English→Plains Cree (SRO) translation. Created by the [EdTeKLA research group](https://spaces.facsci.ualberta.ca/edtekla/) at the University of Alberta.

| Property | Value |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Language pair** | EN → CRK (Plains Cree, SRO orthography) |
| **Entry count** | 436-entry dev split (`textbook_dev.json`); full breakdown is stated once on the [Evaluation Datasets page](/docs/network/leaderboard/datasets#edtekla-development-set-v1) |
| **License** | [EdTeKLA's modified CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, sovereignty-scoped) — non-commercial; carved out of the leaderboard, prize, and commercial/API lanes |
| **Provenance** | `gold_standard` (verified by speakers), `textbook` (published educational materials) |

### FLORES+ Devtest — Development Use Only

> [!WARNING]
> **FLORES+ is available for development and debugging but is NOT used for official leaderboard evaluation.** FLORES+ (originally Meta FLORES-200) is a widely public benchmark dataset that frontier LLMs have almost certainly been trained on. Scores against FLORES+ do not reliably reflect real-world translation quality for LLM-based methods. Non-LLM methods (FST, rule-based, fine-tuned NMT) are less affected but FLORES+ scores are still not published to the leaderboard.

FLORES+ fixtures remain available in `test/benchmark/fixtures/` for pipeline smoke testing, cross-language validation, and development use. Official evaluation uses custom corpora built from human-authored text not publicly available in parallel form.

See [Evaluation Datasets](/docs/network/leaderboard/datasets) for the full dataset schema, difficulty tiers, and how to create your own.

:::danger[DO NOT TRAIN on evaluation data]

**These datasets are evaluation-only.** Methods trained, fine-tuned, few-shot-prompted, or otherwise exposed to evaluation data will produce artificially inflated scores and will be **disqualified from the leaderboard.**

This is not a suggestion — it is the single most important rule of evaluation integrity. Use separate corpora for training. Evaluation sets must remain unseen by your model during development.

If you are using coaching data or few-shot examples, those must come from **completely separate sources**. If in doubt, don't include it.
:::

:::warning[LLM non-determinism]

LLM outputs are non-deterministic. Scores represent point-in-time measurements under specific model versions and API configurations. Model providers may update weights, decoding strategies, or safety filters at any time, which can cause score drift between runs. The leaderboard records the exact model slug and timestamp for every submission.
:::

---

## What Makes a Good Method

Not all methods are created equal. Here's what separates rigorous work from inflated scores.

### Characteristics of a strong method

- **Clean separation of train and eval data** — your method has never seen the evaluation set during development, tuning, prompt engineering, or few-shot example selection
- **Reproducible** — someone else can clone your repo, run the harness, and get the same scores (within LLM non-determinism bounds)
- **Documented** — your [method card](/docs/network/specifications/methods) describes what your method does, what tools it uses, and what its limitations are
- **Honest about scope** — if your method only works for one language pair, say so; if it degrades on certain morphological patterns, document that
- **Community-aware** — for Indigenous languages, your method respects data sovereignty. You've consulted with language communities or used only openly licensed data

### Red flags (what gets disqualified)

| Red Flag | Why It's a Problem |
|----------|--------------------|
| Training on eval data | Defeats the purpose of evaluation entirely. Inflated scores mislead everyone. |
| Cherry-picking results | Running 10 times and submitting the best run without disclosing the others |
| Undisclosed post-processing | Manually fixing outputs before scoring |
| Contaminated coaching data | Using eval set examples as few-shot prompts or dictionary entries |
| Claiming commercial readiness without provenance | If your method uses CC BY-NC-SA data, it's not commercially ready |

### Verification tiers

Verification tiers describe **who validated the result** — separate from the quality tiers (Baseline → Fluent) defined in the [Scoring Specification, §5](/docs/network/specifications/scoring#5-quality-tiers), which describe what the automated composite score means.

| Tier | Meaning | How to Get It |
|------|---------|--------------|
| **Self-benchmarked** | You ran the harness yourself and submitted results | Publish your run card with `mt-eval publish` |
| **Champollion Verified** | The server independently re-scored your submitted outputs against the sha-pinned reference corpus and reproduced your score | Automatic — every submission is re-scored (see below) |
| **Community Validated** | Bilingual speakers of the target language, qualified under the community's own protocol, reviewed a stratified sample of the output (≥30 entries, ≥2 reviewers) and ≥70% met the community's bar. Conferred only by the community's own testing; demotion by spot-audit is symmetric | Submit method code to the governance org — they run it against the gold-standard set and put the output to community review |

### How verification scales: reputation-weighted auditing

**We do not claim provenance.** A leaderboard row is produced by a contributor
running the *open-source* harness on their *own* machine. "This run really came
through the harness" is not something a server can verify for self-hosted
compute — the harness's signing key is in the contributor's hands, so a
signature authenticates a *machine, not honesty*. Instead of pretending
otherwise, **validity here is earned and self-correcting**: a row is trustworthy
because its score is **reproducible** and because the contributor behind it has
**staked a reputation that a caught fabrication would destroy.** Verification is
run in four layers, so it is thorough where it must be and cheap where it can be
— the project never has to re-run everyone's work.

- **L0 — re-score everything (free, 100%).** The server re-derives your score
  from *your own submitted outputs* against the **sha-pinned reference corpus**
  (not your stored copy of it), with the same metric the harness uses. If the
  score doesn't reproduce from the outputs, or a stored reference was altered,
  the run is **disqualified** — this alone kills a typed-in or edited score. A
  run that reproduces is promoted to **Champollion Verified**, the only tier the
  board ranks. This runs on every submission and takes milliseconds.
- **L1 — a contributor reputation ladder.** Each contributor (identified by their
  sign-in) earns reputation *only* by surviving the deeper checks below — never
  by volume alone, so spinning up fresh identities buys nothing. Reputation is
  **public**, and it decides how often the expensive check fires.
- **L2 — re-run a *sample* (the expensive check).** For a *public* development
  set, L0 cannot catch a contributor who simply copies the reference as their
  "translation." Catching that needs actually re-running the model — real
  compute — so we do it on a **sample**, not on everyone. A run is sampled for an
  L2 re-run with a probability that rises with **stakes** (a run that lights the
  first bridge to a whole language family is *always* re-run), rises with
  **anomaly** (a too-good-to-be-true jump over the prior best is *always*
  re-run), and falls with **reputation** (a contributor who has passed many
  audits is spot-checked rarely; a newcomer or anonymous submitter is checked on
  every run until they've earned trust). Passing an L2 audit raises reputation.
- **L3 — corroboration (free verification).** When two *independent* contributors
  run the same model on the same corpus and their re-scored outputs **agree**,
  that agreement *is* verification — and it raises both of their reputations. A
  genuine **disagreement** flags both runs for an L2 audit. Replication is
  rewarded rather than treated as redundant.

**One caught fabrication is catastrophic — like a retraction.** A proven
fabrication zeroes the contributor's reputation, **re-audits their entire
verified history** (every one of their verified runs is sent back through
verification), and is recorded **publicly** in the audit log. That is what makes
light sampling safe: cheating a public dev set might slip past on one run, but
the expected cost — losing all earned trust and having your whole record
re-scrutinized — makes it a bad bet. These rules bind the maintainers' own runs
symmetrically.

**Why contributing is still worth it.** You always pay the expensive part
(running your method); the project pays only the free L0 re-score on everyone
plus an L2 re-run on a *shrinking sample* — high for newcomers and high-stakes
runs, low for proven contributors. Verification cost is *amortized by reputation
and shared by corroboration*, not re-paid in full every time.

---

## How to Submit

1. **Build your method** — see [Building a Method](/docs/network/specifications/methods) for the method interface
2. **Run the harness** — see [Eval Harness](/docs/network/specifications/harness) for setup and usage
3. **Generate a run card** — the harness produces a JSON run card with your scores, fingerprint, and metadata
4. **Publish** — `mt-eval publish eval/logs/harness/<your-run-card>.json` uploads the run card to the leaderboard
5. **Appear on the leaderboard** — your run is staged as *self-benchmarked (unverified)*, then the server automatically re-scores your outputs against the sha-pinned corpus (L0); when it reproduces, the run promotes to *Champollion Verified* — the only tier the [Method Leaderboard](https://champollion.dev/leaderboard) ranks. Deeper reputation-weighted auditing follows the trust tiers above

---

## Integrity Policy: Retractions, Re-runs, Delisting, Disputes

Written in advance so that enforcement is procedure, not drama. These rules
bind everyone symmetrically — including the maintainers' own runs.

**No retractions.** A published run is a permanent record. There is no
mechanism — for anyone — to delete a score because it is embarrassing.
Every run row carries a server-stamped `submitted_at` timestamp and an
immutable audit trail; moderation actions themselves are logged.

**Re-runs append, never replace.** If you improve your method, publish a new
run. The old run stays. Selective disclosure — privately testing many
variants and publishing only the winner — is what made other leaderboards
gameable; an append-only record is the structural answer. Fingerprint
de-duplication stops byte-identical resubmission spam; it never rewrites
history.

**Delisting is rule-execution, with the rule named.** A run is delisted
(marked `disqualified`, visibly — not silently removed) only for listed
causes: a quarantined or improper-subset dataset (enforced by database
trigger beneath every client), corpus-checksum mismatch, fabricated or
out-of-range scores, content-guard violations, or a steward's withdrawal of
the underlying data's registration. The delisting names the rule and the
evidence. New causes are added here by dated edit before they are ever
applied, never retroactively invented for one case.

**Trust tiers are labels, not edits.** `self-benchmarked` rows are claims;
`Champollion Verified` rows have been independently re-scored from the
submitter's outputs against the sha-pinned corpus; `Community Validated` is
conferred only by the community's own testing. Verification changes a row's
tier — it never changes the row's scores.

**Reputation is public and self-correcting.** Contributor reputation, and the
audit log that records every re-score, sampled re-run, corroboration, and
fabrication burn, are public. Reputation is not a score multiplier and never
touches a run's numbers — it only sets how often a contributor's runs are
re-audited (see *reputation-weighted auditing* above). A proven fabrication is
recorded as publicly as a retraction and re-audits the contributor's whole
verified history; the same rules apply to the maintainers' own runs.

**Disputes.** Open an issue with the run id and the specific claim (wrong
score, wrong dataset, rule misapplied). The maintainers re-run the
deterministic checks in public; the outcome and its evidence land on the
issue. If the dispute is about a community's data or validation, the
community's own authority decides and the board implements their decision.
For prize contests, the same rules apply plus the contest's pre-published
qualifier and audit steps — winners are audited **before** payout, and a
disqualification cites the rule exactly like any other delisting.

## Future Directions

- **Comprehensive model comparison runs** — systematic evaluation of frontier models (GPT-4o, Claude, Gemini, etc.) across champollion languages using custom evaluation corpora (not public benchmarks)
- **More language pairs** — Quechua, Inuktitut, and other low-resource languages as community-verified datasets become available
- **Dataset import** — tooling to convert external evaluation datasets (WMT, Tatoeba, etc.) into the champollion evaluation format
- **Automated re-runs** — detecting model version changes and re-running benchmarks to track score drift

---

## See Also

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — live scores and submissions
- **[Eval Harness](/docs/network/specifications/harness)** — how to run evaluations
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — dataset format and available datasets
- **[Building a Method](/docs/network/specifications/methods)** — the method interface specification
- **[Run Card Specification](/docs/network/specifications/run-card)** — the run card JSON schema
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — evaluation protocol, corpus format, sovereignty
- **[Scoring Specification](/docs/network/specifications/scoring)** — SSOT for metrics, composite weights, and quality tiers
