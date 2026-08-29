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
pip install mt-eval-harness
```

---

## Step 1: Run the Harness

The harness scores your method against a standardized dataset:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Flag | What It Does |
|---|---|
| `--corpus` | Corpus file path or registered corpus id (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Model slug — short alias (e.g. `gemini-pro`) or full OpenRouter ID |
| `-n, --name` | Human-readable label for your run (appears on leaderboard) |
| `--temperature` | Sampling temperature (lower = more deterministic) |
| `--fst-retries` | Optional: number of FST retry attempts |
| `--publish` | Publish the run card to the leaderboard when the run finishes |

The harness produces a **run card** — a self-contained JSON file with your scores, the dataset hash, the model slug, and a cryptographic fingerprint tying results to the exact experiment configuration.

---

## Step 2: Review Your Run Card

Run cards are saved to `eval/logs/harness/`. Inspect yours before submitting:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

Key fields to check:
- `scores.chrf_plus_plus` — your primary quality metric
- `scores.exact_match_rate` — proportion of perfect translations
- `scores.fst_acceptance_rate` — morphological validity (if FST was used)
- `totals.total_cost_usd` — what the run cost
- `fingerprint` — the experiment's reproducibility hash

See the [Run Card Specification](/docs/network/specifications/run-card) for the full schema.

---

## Step 3: Submit

### Automatic publication

If you passed `--publish` when running the harness, your run card was already uploaded.

### Manual publication

Publish any run card with the harness:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

If you'd rather not use the publish flow, open a pull request against the
[eval harness repository](https://github.com/gamedaysuits/Champollion)
with your run card JSON in the `results/` directory.

:::note[The submission API and web upload are not live yet]
A `POST https://champollion.dev/api/leaderboard/submit` endpoint and a
Leaderboard upload UI are planned but **not yet implemented**. Until they ship,
the only working submission paths are `mt-eval publish` and a pull request to
the harness repo above.
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
