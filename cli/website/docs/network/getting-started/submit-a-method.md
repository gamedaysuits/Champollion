---
sidebar_position: 1
title: Submit a Method
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# Submit a Method

> **Executive Summary.** A step-by-step quickstart for submitting your first benchmark run to the leaderboard. Install the harness, run it against a dataset, review your run card, and publish. Takes 10 minutes if you have an API key.

This guide walks you through submitting your first benchmark run to the Network leaderboard.

---

## Prerequisites

- **Python 3.11+**
- **An OpenRouter API key** (or equivalent for your model provider)
- **A translation method** — anything that produces translations from a source text

```bash
# Install the eval harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

---

## Step 1: Run the Harness

The harness scores your method against a standardized dataset:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| Flag | What It Does |
|---|---|
| `--corpus` | Corpus file path or registered corpus id (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Exact model slug — the full OpenRouter id (e.g. `google/gemini-3.1-pro-preview`); short aliases and floating ids (`…-latest`) are refused. With `--method <plugin dir>`, the model handed to your plugin as `config.method_model` (any naming your plugin uses) |
| `-n, --name` | Human-readable label for your run (appears on leaderboard) |
| `--temperature` | Sampling temperature (lower = more deterministic) |
| `--fst-retries` | Optional: number of FST retry attempts |
| `--publish` | Publish the run card to the leaderboard when the run finishes |

The harness produces a **run card** — a self-contained JSON file with your scores, the dataset hash, the model slug, and a cryptographic fingerprint tying results to the exact experiment configuration.

---

## Step 2: Review Your Run Card

Each run writes two files to `eval/logs/harness/`: the run log `<run-id>.json`
and the scored report `<run-id>_report.json`. The report is what you publish.
Inspect it first:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

Key fields in the report's `overall` block:
- `corpus_chrf` — corpus-level chrF++ (0–100), the headline and ranking
  metric. Its 95% bootstrap CI is `confidence_intervals.corpus_chrf` and its
  sacreBLEU signature is `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) and `primary_metric`
  (`"chrf_plus_plus"`) — the standard the report was scored under
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — the other standard metrics,
  shown beside chrF++ and never blended with it
- `exact_match_rate` — a diagnostic: the proportion of perfect translations
- `confidence_intervals` — bootstrap intervals for the metrics above
- `total_cost_usd` — what the run cost (`null` when the model has no published
  price, e.g. a local model; never reported as $0)

The report also records what the model was told, as a pointer
(`instructions`: the coaching file's name and SHA-256, the system prompt's
SHA-256, and where the full text is, the run log on your machine). The run
card that goes to the leaderboard is assembled from this report. It adds the
method card and the reproducibility fingerprint, and leads with the same
chrF++ and CI; its `composite` and `quality_tier` are `null`, because both are
[retired](/docs/network/specifications/scoring#how-runs-are-scored). (A report
written before the standard may carry a `published_composite`; it is a legacy
composite, retired, and never compared with chrF++.)
`mt-eval publish <report> --dry-run` prints the card exactly as it would be
published. See the [Run Card Specification](/docs/network/specifications/run-card)
for its schema.

---

## Step 3: Submit

Publishing writes to the **live** leaderboard, so it takes an explicit
`--prod` — without it the harness refuses and tells you so. Preview first:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

To publish straight from a run, add `--publish --prod` to `mt-eval run`. If the
publish step fails, the run's scores are still saved and the harness prints the
exact retry command. Setting `MT_EVAL_ALLOW_PROD=1` in the environment is the
equivalent of `--prod` for scripts.

:::note[The submission API and web upload are not live yet]
A `POST https://champollion.dev/api/leaderboard/submit` endpoint and a
Leaderboard upload UI are planned but **not yet implemented**. Until they ship,
the only working submission path is `mt-eval publish` (there is no
pull-request intake).
:::

---

## What Happens Next

1. Your submission is validated (dataset hash, run card integrity)
2. Results appear on the leaderboard as **Self-benchmarked** (trust tier 1)
3. To get **Champollion Verified** status, submit your method as an installable plugin so maintainers can reproduce your results
4. For Indigenous language methods: if your method reaches the top, the [ownership transfer](/docs/network/sovereignty/ownership-transfer) process begins

---

## See Also

- [Harness Usage](/docs/network/specifications/harness) — full CLI reference
- [Leaderboard Rules](/docs/network/leaderboard/rules) — submission criteria and anti-gaming policies
- [Building a Method](/docs/network/specifications/methods) — the TranslationMethod protocol
- [Datasets](/docs/network/leaderboard/datasets) — available evaluation datasets
