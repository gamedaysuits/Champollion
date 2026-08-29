---
sidebar_position: 2
title: Eval Harness v2.0
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Executive Summary.** This page covers installation, configuration, and usage of the MT evaluation harness — the tool that benchmarks translation methods against standardized corpora and produces scored run cards. For canonical definitions of metrics, schemas, and evaluation protocol, see the [Benchmark Specification](/docs/network/specifications/benchmark).

The harness runs translation experiments and produces run cards. It handles prompt construction, API calls, scoring, and result serialization — you supply the dataset and the model.

## Installation

**Requirements:** Python 3.10+

```bash
pip install mt-eval-harness
```

This installs the `mt-eval` command.

## Usage

```bash
mt-eval run --corpus path/to/dataset.json
```

This runs every entry in the corpus through the configured model (or method plugin), scores the outputs, and writes a run card JSON file to the output directory.

## CLI Flags

### `mt-eval run`

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Path to corpus file (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Parallel text files (FLORES+, WMT format) |
| `-m, --model` | — | `gemini-pro` | Model slug (short name or full OpenRouter ID). Resolves via `shared/model-aliases.json`. Comma-separated for multi-model runs |
| `-d, --dataset` | — | `all` | Dataset filter: `all`, segment name, or ID range |
| `--ids` | — | — | Comma-separated entry IDs to evaluate |
| `--source-lang` | — | `English` | Source language name |
| `--target-lang` | — | — | Target language name |
| `-p, --prompt` | — | `naive` | Prompt version (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Path to coaching prompt text file |
| `--coaching` | — | — | Inline coaching text (quoted string) |
| `--method` | — | — | Path to method plugin directory (contains `method.json` + Python module) |
| `--method-card` | — | — | Path to method card JSON for leaderboard metadata |
| `--fst-retries` | — | `0` | Number of FST retry attempts (default LLM method only) |
| `--skip-fst` | — | `false` | Skip the FST quality gate entirely |
| `--tools` | — | `false` | Enable tool-calling mode |
| `--tools-list` | — | — | Comma-separated tool names |
| `--max-tool-rounds` | — | `8` | Maximum tool-calling rounds per entry |
| `--hooks` | — | — | Post-translation hook names |
| `--style-profile` | — | — | Path to a style profile JSON. Enables writing-style consistency metrics (informational — never part of the composite score; see [§ Writing-style and register metrics](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entries per API call |
| `-c, --concurrency` | — | `8` | Parallel API calls |
| `--max-tokens` | — | `32768` | Max tokens per API call |
| `--temperature` | — | `0.0` | Sampling temperature (0.0 = deterministic) |
| `--no-cache` | — | `false` | Disable response caching |
| `--cache-dir` | — | `eval/cache/harness` | Cache directory path |
| `-o, --output-dir` | — | `eval/logs/harness` | Output directory for run cards and logs |
| `-n, --name` | — | — | Human-readable run name |
| `--dry-run` | — | `false` | Validate configuration without making API calls |
| `--champollion-config` | — | — | Path to `champollion.config.json` |
| `--champollion-cards-dir` | — | — | Language cards directory |
| `--target-lang-code` | — | — | BCP-47 language code |

### Every subcommand

All eighteen top-level subcommands, generated against `mt_eval_harness/cli.py`
on 2026-08-01. Until then this section listed seven of them, and six —
including `node`, the sovereign organizer scoring node — were documented
**neither here nor in the harness guide**.

**Run and score**

| Subcommand | What it does |
|---|---|
| `mt-eval run` | Execute a translation run (flags above) |
| `mt-eval test <log>` | Analyze a completed run log |
| `mt-eval compare <logs…>` | Compare multiple run logs |
| `mt-eval dashboard <logs…>` | Generate an interactive HTML dashboard |
| `mt-eval card <run-card>` | Pretty-print a human-readable run card |

**Find your way to a method**

| Subcommand | What it does |
|---|---|
| `mt-eval recommend <src> <tgt>` | Method guidance for a language pair — availability plus **cited evidence**, not a bare ranking |
| `mt-eval corpora --source X --target Y` | List eval corpora available for a pair |
| `mt-eval list models\|prompts\|datasets` | List available resources |

**Contribute**

| Subcommand | What it does |
|---|---|
| `mt-eval publish <report>` | Submit a TestReport to the leaderboard |
| `mt-eval queue` | Run the top of the community compute queue with your own key — see [Contributing Compute](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Package a TestReport as a champollion method plugin |
| `mt-eval generate-plugin` | Alias for `export` |
| `mt-eval export-config` | Generate a `champollion.config.json` snippet from a TestReport |

**Contests, and running one yourself**

| Subcommand | What it does |
|---|---|
| `mt-eval contest` | Manage evaluation contests — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | Multi-pair shared-task edition umbrella: one row groups the N per-pair contests of an AmericasNLP-style edition and carries its policy defaults. **Grouping and defaults only — every gate stays per-contest** |
| `mt-eval node` | **The organizer scoring node.** Poll intake, gate on the public qualifier, authorize per contest policy, score against **organizer-held secret references**, publish scores-only. This is the command behind [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) and the [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node) — the corpus never leaves the organizer's machine |

`mt-eval node` has seventeen subcommands of its own, including the airgap lane
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) and the
M-of-N custody ceremony (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Run `mt-eval node --help`; the sovereignty
mechanics are described on the two pages linked above.

**Setup**

| Subcommand | What it does |
|---|---|
| `mt-eval setup` | Install optional dependencies (COMET neural metric, FST runtime) |
| `mt-eval logout` | Remove stored authentication credentials |

### Examples

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Run Card Schema

Every experiment produces a **run card** — a self-contained JSON document. The top-level structure:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

See the [Run Card Specification](/docs/network/specifications/run-card) for the full schema with every field documented.

:::info[Authoritative Schema]
The [Benchmark Specification](/docs/network/specifications/benchmark) is the single source of truth for the run card schema. For metric definitions, composite weights, and quality tiers, see the [Scoring Specification](/docs/network/specifications/scoring). This page documents how to use the harness; the specs define what the outputs mean.
:::

### Key Blocks

**`dataset`** — Identifies which dataset was used, including its content hash so results are tied to a specific version:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Aggregate metrics for the run:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Token usage and cost tracking:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Writing-style and register metrics (informational) {#writing-style-and-register-metrics-informational}

The harness can evaluate whether translations match a target **register** and **writing style**, via the `WritingStyleConsistency` metric plugin (`mt_eval_harness/plugins/writing_style.py`). A translation can be linguistically correct but in the wrong register — informal phrasing in a legal document, formal boilerplate in marketing copy — and string metrics won't notice. These metrics do.

**What is measured (per entry):**

| Metric | Scale | Meaning |
|--------|-------|---------|
| `style_register_match` | boolean | Does the output match the expected register? The target comes from the corpus entry's `register` field (see [Benchmark Spec §2.6](/docs/network/specifications/benchmark)) or from a style profile |
| `style_sentence_length_ratio` | float | Predicted vs reference average sentence length (1.0 = match; divergence = style drift) |
| `style_formality_score` | 0.0–1.0 | Presence of formal/informal markers (T–V pronouns, contractions, …) using per-language marker resources |

**Aggregate:** `style_consistency_rate` — the fraction of entries with no detected register mismatch.

Enable a custom target with `--style-profile path/to/profile.json` (e.g. a brand-voice profile); without one, the plugin falls back to each corpus entry's `register` metadata where present.

:::caution[Honest scoping]
These metrics are **informational only** — they are never part of the composite score, and the formality detection is marker-based (a heuristic), not a learned judgment. Treat them as a drift detector for register adherence, not a verdict on style quality.
:::

---

## Fingerprint vs Run Card Hash {#fingerprint-vs-run-card-hash}

The harness produces two distinct hashes. They serve different purposes:

### Fingerprint

The **fingerprint** answers: *"Could this run be reproduced?"*

It hashes the combination of inputs that define the experiment configuration — not the outputs:

- Dataset SHA-256
- Model slug
- Condition label
- System prompt SHA-256
- Temperature
- Harness version

Two runs with identical fingerprints used the same setup. Their results should be comparable (modulo API non-determinism).

### Run Card Hash

The **run card hash** answers: *"Has this specific result file been tampered with?"*

It's the SHA-256 of the entire run card JSON (excluding the `run_card_hash` field itself). If any field changes — a score, a timestamp, a single output — the hash breaks.

:::info[When to use which]
Use the **fingerprint** to group comparable runs (same experiment, different executions). Use the **run card hash** to verify integrity of a specific result file.
:::

---

## Publishing to the Leaderboard

After completing a run, use `mt-eval publish` to submit the run card:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

If no `--method-card` was provided during the run, `mt-eval publish` launches an interactive wizard (`method_card_wizard.py`) that walks you through describing your method (name, class, tools used, etc.). The wizard output is embedded in the run card before submission.

### Manual inspection

Run cards are saved as JSON files in the output directory (`eval/logs/harness/` by default) — inspect them there before publishing. `mt-eval publish` is the submission path; there is no PR-based run-card intake.

:::note[The submission API and web upload are not live yet]
A `POST https://champollion.dev/api/leaderboard/submit` endpoint and a Leaderboard upload UI are planned but **not yet implemented**. Until they ship, the only working submission path is `mt-eval publish`.
:::

:::warning[Leaderboard validation]
The leaderboard validates submitted run cards against the dataset registry. Submissions referencing unknown datasets, or with a broken `run_card_hash`, are rejected.
:::

:::danger[DO NOT TRAIN on evaluation data]
If your method has seen the evaluation dataset during development — as training data, few-shot examples, dictionary entries, or prompt engineering material — your submission will be **disqualified**. See [MT Evaluation](/docs/network/leaderboard/rules) for what makes a good vs. bad method.
:::

---

## See Also

- [MT Evaluation](/docs/network/leaderboard/rules) — overview, leaderboard value proposition, and good/bad method guidance
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — dataset format, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — the full JSON schema
- [Building a Method](/docs/network/specifications/methods) — the method interface for creating evaluable methods
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluation protocol, corpus format, run card schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT for metrics, composite weights, and quality tiers

