---
sidebar_position: 4
title: Run Card Specification
---

# Run Card Specification

> **Executive Summary.** The run card is the atomic unit of benchmarking — a JSON document recording the complete configuration, per-entry results, and aggregate scores of one evaluation run. This page documents the schema, fields, fingerprinting mechanism, and score structure. See the [Benchmark Specification](/docs/network/specifications/benchmark) for canonical definitions.

The run card is the complete record of a single evaluation run. It contains everything needed to understand, reproduce, and verify the experiment: configuration, scores, individual results, token usage, and environment metadata.

**Schema version:** 2.0

:::info[Authoritative Schema]
The [Benchmark Specification](/docs/network/specifications/benchmark) is the single source of truth for the run card schema. For metric definitions, composite weights, and quality tiers, see the [Scoring Specification](/docs/network/specifications/scoring). This page documents the current implementation.
:::

---

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 generated at the start of the run |
| `harness_version` | `string` | Semantic version of the harness that produced this card (e.g., `2.0`) |
| `model_slug` | `string` | Model slug used for the run (e.g., `google/gemini-3.1-pro`) |
| `model_id` | `string` | Resolved model identifier returned by the API (e.g., `gemini-3.1-pro-001`) |
| `condition` | `string` | Experiment label (e.g., `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | ISO 8601 UTC timestamp when the run started |
| `elapsed_seconds` | `number` | Wall-clock duration of the entire run |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

Identifies the evaluation dataset and pins it to a specific content version via SHA-256.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Dataset identifier (e.g., `edtekla-dev-v1`) |
| `version` | `string` | Dataset version string |
| `language_pair` | `string` | Display label (e.g., `EN→CRK`) |
| `sha256` | `string` | SHA-256 hash of the dataset file contents. Guarantees the exact data used |
| `entry_count` | `number` | Number of entries in the dataset |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

The API and batching configuration used for this run.

| Field | Type | Description |
|-------|------|-------------|
| `api_provider` | `string` | API provider name (e.g., `openrouter`) |
| `temperature` | `number` | Sampling temperature |
| `max_tokens` | `number` | Maximum tokens per completion |
| `batch_size` | `number` | Entries per concurrent batch |
| `concurrency` | `number` | Maximum parallel API requests |
| `coaching_file` | `string` | Path to coaching prompt file, if used |
| `method_path` | `string` | Path to method plugin directory, if used |
| `fst_retries` | `number` | Number of FST retry attempts |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[Published Run Cards Include `method_config`]
When a run card is published via `mt-eval publish`, `publish.py` injects a `method_config` block containing the canonical 8-field MethodConfig. This enables zero-friction leaderboard install — anyone can reproduce the method directly from the published card.

```json
{
  "method_config": {
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

All fields use **camelCase** and follow the canonical MethodConfig schema (see [Building a Method](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Field | Type | Description |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | SHA-256 hash of the system prompt. Included in the fingerprint |
| `system_prompt_used` | `string` | The full system prompt text sent to the model |

The prompt hash is part of the [fingerprint](#fingerprint) — two runs with different prompts will have different fingerprints even if all other settings match.

---

## `fingerprint`

A reproducibility identifier. Two runs with identical fingerprints used the same experimental setup.

| Field | Type | Description |
|-------|------|-------------|
| `hash` | `string` | SHA-256 hash of the sorted components |
| `components` | `object` | The input values that were hashed |

### Fingerprint Components

| Component | Description |
|-----------|-------------|
| `dataset_sha256` | Hash of the dataset file |
| `model_slug` | Model used |
| `condition` | Experiment condition label |
| `system_prompt_sha256` | Hash of the system prompt |
| `temperature` | Sampling temperature |
| `harness_version` | Harness version |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Fingerprint ≠ Run Card Hash]
The fingerprint identifies the *experiment configuration*. The `run_card_hash` verifies the *result file integrity*. See [Fingerprint vs Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) for details.
:::

---

## `scores`

Aggregate metrics for the entire run.

### Top-Level Scores

| Field | Type | Description |
|-------|------|-------------|
| `total` | `number` | Total entries evaluated |
| `exact_matches` | `number` | Entries where output exactly matched the gold standard |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | Entries where the FST analyzer accepted the output |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0.0–1.0). `null` if no FST analyzer was used |
| `chrf_plus_plus` | `number` | Corpus-level chrF++ score (0–100) |
| `errors` | `number` | Entries that failed (API error, timeout, etc.) |
| `avg_latency_seconds` | `number` | Mean response time across all entries |
| `median_latency_seconds` | `number` | Median response time |
| `p95_latency_seconds` | `number` | 95th percentile response time |

### `by_difficulty`

Scores broken down by difficulty tier. Each key (integer 1–5) contains the same metric fields as the top-level scores.

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

Scores broken down by entry provenance. Each key (e.g., `gold_standard`, `textbook`) contains the same metric fields.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `totals`

Token usage and cost tracking for the entire run.

| Field | Type | Description |
|-------|------|-------------|
| `prompt_tokens` | `number` | Total input tokens across all API calls |
| `completion_tokens` | `number` | Total output tokens |
| `reasoning_tokens` | `number` | Tokens used for chain-of-thought reasoning (model-dependent, 0 for most models) |
| `cached_tokens` | `number` | Tokens served from the provider's prompt cache |
| `total_cost_usd` | `number` | Total cost in USD (as reported by the API) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

Runtime environment metadata for reproducibility.

| Field | Type | Description |
|-------|------|-------------|
| `harness_version` | `string` | Harness version (mirrors top-level `harness_version`) |
| `harness_git_commit` | `string` | Git commit SHA of the harness at run time |
| `python_version` | `string` | Python interpreter version |
| `sacrebleu_version` | `string` | sacrebleu library version (used for chrF++ scoring) |
| `os` | `string` | Operating system identifier |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

The per-entry results array. One object per dataset entry, in index order.

| Field | Type | Description |
|-------|------|-------------|
| `entry_id` | `integer` | ID of this entry in the corpus (matches `entries[].id`) |
| `source` | `string` | The source text that was translated |
| `reference` | `string` | The gold-standard reference from the corpus |
| `predicted` | `string` | The method's actual output |
| `exact_match` | `boolean` | Whether `predicted` exactly matches `reference` after normalization |
| `entry_chrf` | `number` | Sentence-level chrF++ score for this entry (0–100) |
| `fst_accepted` | `boolean \| null` | Whether the FST analyzer accepted the output. `null` if no analyzer was configured |
| `fst_analysis` | `string[]` | FST analysis strings for the output (empty array if not analyzed or rejected) |
| `difficulty` | `integer` | Difficulty tier from the corpus (1–5) |
| `provenance` | `string` | Provenance tag from the corpus |
| `latency_seconds` | `number` | Response time for this individual entry |
| `usage` | `object` | Per-entry token usage: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Error message if this entry failed. `null` on success |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| Field | Type | Description |
|-------|------|-------------|
| `run_card_hash` | `string` | SHA-256 hash of the entire run card JSON, with the `run_card_hash` field itself set to `""` during hashing |

This is the tamper-detection seal. The leaderboard re-computes this hash on submission and rejects cards where it doesn't match.

**Computing the hash:**

1. Serialize the run card to JSON with `run_card_hash` set to `""`
2. Compute SHA-256 of the serialized string
3. Set `run_card_hash` to the resulting hex digest

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Per-Entry Drill-Down]
Published run cards also populate the `run_card_entries` Supabase table, which stores per-entry results for drill-down analysis on the leaderboard. This table is populated automatically during `mt-eval publish`.
:::

---

## See Also

- [MT Evaluation](/docs/network/leaderboard/rules) — overview, leaderboard value, and good/bad method guidance
- [Eval Harness](/docs/network/specifications/harness) — how to run evaluations and generate run cards
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — dataset format, EDTeKLA, FLORES+
- [Building a Method](/docs/network/specifications/methods) — the method interface and method card spec
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluation protocol, corpus format, run card schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT for metrics, composite weights, and quality tiers
