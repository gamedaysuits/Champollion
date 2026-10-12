---
sidebar_position: 4
title: Run Card Specification
---

# Run Card Specification

> **Executive Summary.** The run card is the atomic unit of benchmarking — a JSON document recording the complete configuration, per-entry results, and aggregate scores of one evaluation run. This page documents the schema, fields, fingerprinting mechanism, and score structure. See the [Benchmark Specification](/docs/network/specifications/benchmark) for canonical definitions.

The run card is the complete record of a single evaluation run. It contains everything needed to understand, reproduce, and verify the experiment: configuration, scores, individual results, token usage, and environment metadata.

**Schema version:** 2.0

:::info[Authoritative Schema]
The [Benchmark Specification](/docs/network/specifications/benchmark) is the single source of truth for the run card schema. For metric definitions and how runs are scored (the chrF++ headline, the standard metrics beside it, the diagnostics), see the [Scoring Specification](/docs/network/specifications/scoring). This page documents the current implementation.
:::

---

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 generated at the start of the run |
| `harness_version` | `string` | Semantic version of the harness that produced this card (e.g., `2.0`) |
| `model_slug` | `string` | Model slug used for the run (e.g., `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | Resolved model identifier returned by the API (e.g., `gemini-3.1-pro-001`) |
| `condition` | `string` | Experiment label: what the harness writes is `naive` (its built-in prompt), `coached` (a coaching file replaced it) or, for a method plugin, its method class; free text, so a hand-built card may say `coached-v3` or `few-shot`. Not a quality label (quality tiers are retired; `scores.quality_tier` is null on every new card) |
| `timestamp` | `string` | ISO 8601 UTC timestamp when the run started |
| `elapsed_seconds` | `number` | Wall-clock duration of the entire run |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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
| `api_provider` | `string` | What carried the text: the API provider for the harness's own LLM path (`openrouter`, `openai`, `anthropic`, `gemini`, `local`); the engine id for an MT engine (e.g. `google-translate`); for a method plugin, `local` when its operator attested a fully local transport (`--attest-local-transport`), else `method-plugin` |
| `temperature` | `number` | Sampling temperature |
| `max_tokens` | `number` | Maximum tokens per completion |
| `batch_size` | `number` | Entries per concurrent batch |
| `concurrency` | `number` | Maximum parallel API requests |
| `coaching_file` | `string` | Path to coaching prompt file, if used (the run log's own record; a published card names the coaching by file name, or `inline coaching` for `--coaching` text — never a local path) |
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
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

`qualityTier` is always `null` on a new card: quality tiers are retired. All fields use **camelCase** and follow the canonical MethodConfig schema (see [Building a Method](/docs/network/specifications/methods)).
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

The canonical list is [Benchmark Specification §3.8](/docs/network/specifications/benchmark#38-fingerprint). In short:

| Component | Description |
|-----------|-------------|
| `dataset_sha256` | Hash of the dataset file |
| `model_slug` | Model used (for an MT engine or a method plugin, the engine or method id) |
| `condition` | Experiment condition label |
| `system_prompt_sha256` | Hash of the system prompt |
| `temperature` | Sampling temperature |
| `batch_size`, `tools_enabled` | Batching and tool use |
| `harness_version` | Harness version |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | Version 2 (harness 0.2.0 and later): the channel, the endpoint host (hashed), the token limit, and the method's version and code hash |
| `method_model`, `method_dependencies_sha256` | Version 2, method plugin runs only: the model the plugin was handed (`-m`) and the hash of its declared `dependencies` |
| `method_model`, `method_model_sha256` | Version 2, `--method local-model` runs only: the model that loaded (Hugging Face id or directory name) and its content hash (a directory) or revision (a Hugging Face id) |

`fingerprint.version` says which list a card was hashed under.

### `engine_model`

A run of an MT engine that runs a model it is given (`--method local-model -m <model>`) carries the model that loaded:

| Field | Description |
|-------|-------------|
| `given` | What `-m` said |
| `kind` | `directory` or `hub` (a Hugging Face id) |
| `id` | The Hugging Face id, or the directory's name (never its local path) |
| `sha256` | A directory only: SHA-256 over a `sha256sum`-style list of its files |
| `revision` | A Hugging Face id only: the revision that loaded |
| `family`, `backend` | `opus`, `nllb` or `madlad`; `transformers` or `ctranslate2` |
| `decode` | How long outputs could be: the length the model declares, or the harness rule (`max(64, 4 × source tokens)` new tokens, capped at the decoder's positions) |
| `pair_mismatch` | Present only when an OPUS-MT pair model for another pair was run on purpose (`--allow-model-pair-mismatch`) |

`method_config.model` names the same model (`<id>@<revision>`, or `<directory name>@sha256:<hash>`). A `local-model` run log that recorded no model publishes nothing: the card says `engine_model_unrecorded` and `mt-eval publish` refuses it.

### `method_plugin`

A method plugin run (`--method <plugin dir>`) also carries what identifies the plugin, as the runner recorded it:

| Field | Description |
|-------|-------------|
| `version` | The version `method.json` declares (`null` when it declares none) |
| `code_sha256` | SHA-256 over the plugin's files (`method.json` and its `.py` files, a `sha256sum`-style manifest) |
| `model_given` | The model the plugin was handed with `-m/--model`, or `null` |
| `models_called`, `models_basis` | The model(s) the plugin reported calling, and whether that was observed on its results or declared |
| `dependency_class` | The dependency class `method.json` declares |
| `dependencies` | The `dependencies` list `method.json` declares, without the free-text `notes` |
| `dependencies_sha256` | SHA-256 of the full declared list (the fingerprint component) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
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
| `fst_accepted` | `number` | Output **words** the FST analyzer accepted, summed over all entries (not a count of entries). `null` if no FST analyzer was used |
| `fst_acceptance_rate` | `number` | Mean of the per-entry acceptance rates (each entry's accepted words ÷ its words; an empty output counts as 0), 0.0–1.0. It is **not** `fst_accepted` ÷ all words — that pooled word rate is the report's `corpus_validity_rate`, shown on the run card as "Words accepted". `null` if no FST analyzer was used |
| `chrf_plus_plus` | `number` | **The headline and ranking metric:** corpus-level chrF++ (sacreBLEU chrF, `word_order=2`), 0–100. Its 95% bootstrap CI is `confidence_intervals.corpus_chrf` and its signature `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` on every new card. A card without it was scored under the retired composite (`legacy-composite`) and is verified that way |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | Standard metrics shown beside chrF++, never blended (BLEU is the card's top-level `corpus_bleu`; COMET is `comet_score` with `comet_model`, when computed) |
| `sacrebleu_signatures` | `object` | The sacreBLEU signature of each sacreBLEU metric computed: `chrf` (the headline), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | 95% bootstrap intervals; `corpus_chrf` is the headline's |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **Retired.** Always `null` on a new card. A legacy card keeps its stored values; a surface that still shows its composite labels it "legacy composite (retired)" |
| `errors` | `number` | Entries that failed (API error, timeout, etc.) |
| `avg_latency_seconds` | `number` | Mean response time across all entries |
| `median_latency_seconds` | `number` | Median response time |
| `p95_latency_seconds` | `number` | 95th percentile response time |

### `by_difficulty`

Scores broken down by difficulty tier, keyed by tier (`"1"`–`"5"`, `"0"` for unrated). The fields are **not** the top-level ones: `avg_chrf` and `avg_bleu` are the **mean of per-sentence** chrF++ and BLEU over the tier's entries, while the top-level `chrf_plus_plus` and BLEU are **corpus-level** (computed over all segments at once). The two are different statistics: corpus BLEU in particular is usually far below the mean of sentence BLEU, so a 0.5 headline beside a 10.2 tier value is not a contradiction. Compare tiers with each other, never with the headline.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
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

## `score_caveats`

Present only when something limits what the scores mean. A score can be
computed correctly and still not measure what its label says, so the
qualification travels with the number: `mt-eval test`, `mt-eval card`,
`mt-eval compare`, the dashboard and the `mt-eval publish` preview print it
next to the headline, and `publish` stores it here for the leaderboard to show.
It never changes a score: the chrF++ headline is computed as usual, and the
caveat says what limits it or a diagnostic beside it.

| Field | Type | Description |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` or `near_constant_output` |
| `source` | `string` | Who measured it: `nmt-forge` or `mt-eval-harness` |
| `severity` | `string` | `major` (read the headline through it) or `minor` |
| `message` | `string` | One sentence, at most 480 characters |

**`train_test_near_twin`**, written by nmt-forge. When `nmt-forge export` (or
`evaluate`) scores a model, it checks every test row for a near-identical twin
in the training data and records the result in the mt-eval files it writes.
The harness copies that reading onto the card: `near_twin_rows` of `n` test
rows have a twin (`near_twin_share`), and `strict_n` rows have none. When
there are enough of those, `strict_corpus_chrf` and `strict_corpus_chrf_ci`
give the chrF++ on them alone, which is the generalization number.
`recall_not_translation` is `true` when at least half the rows have a twin.
Then even a chrF++ of 100 measures how well the model recalls training
phrases, not how well it translates. If forge's check did not run,
the caveat is `minor` and says so. A check that found no twin adds no caveat.

**`length_inflation`**, measured by the harness. It is added when outputs
average more than 2× their reference length (the inflation bound of
[`length_ratio`](/docs/network/specifications/scoring)), or when at least a
quarter of the scored entries do. Leaked few-shot examples, notes or repeated
text inflate the outputs, and the reference-based scores then measure that.
The fields are `mean_length_ratio`, `inflated_entries` of `scored_entries`,
`ratio_bound` and `share_bound`.

**`length_deflation`**, measured by the harness. It is the mirror of
`length_inflation`: outputs much **shorter** than their references, so words
were left out. It is added when outputs average less than 0.5× their reference
length (the truncation bound of
[`length_ratio`](/docs/network/specifications/scoring)), or when at least a
quarter of the scored entries do. Some diagnostics judge only the words an
output contains: FST acceptance and code-switching. A system that drops what it
cannot translate raises them. When the run carries one of them, the caveat is
`major` and says not to read them as quality beside runs that translate
everything. The chrF++ headline weights recall, so it counts the missing words. With neither
metric present (chrF++ and exact match only), it is a `minor` note. The fields
are `mean_length_ratio`, `short_entries` of `scored_entries`, `ratio_bound`,
`share_bound` and `emitted_only_metrics`.

**`source_copy`**, measured by the harness. It is added when at least half of
the scored outputs are copies of their source (case, accents and punctuation
ignored). Lines whose reference is the source itself, such as names, are left
out. Metrics that do not compare against the reference can still credit copied
words. The fields are `copies` of `considered_entries`, `copy_share` and
`share_bound`.

**`near_constant_output`**, measured by the harness. One output was given
for many *different* inputs. Outputs and sources are compared with case,
punctuation and spacing ignored; diacritics count, because between two
outputs they tell words apart. An output is a cross-source repeat when at
least 3 distinct sources got it (5 when it is one or two words long, since
short answers legitimately recur). An output that equals its own reference
is a correct answer and is not counted. The caveat is added when repeats
cover at least a quarter of the distinct sources, and at least 5 of them. It
is always `major`. When the run carries a metric that judges an output
without its reference (FST acceptance, code-switching), the message names
it: such a metric credits a valid sentence every time it appears. The fields
are `repeated_sources` of `considered_sources`, `repeat_share`,
`repeated_outputs`, `top_output_sources` and `top_output_words` (the most
repeated output: how many sources got it, and its length), `share_bound`,
`min_repeats`, `min_sources`, `min_sources_short` and `emitted_only_metrics`.
They are counts only: the caveat never carries an output's text.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

The field sits inside the stored run card JSON, so it needs no database
column. It is not part of the [fingerprint](#fingerprint): it describes the
result, not the experiment.

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
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT for metrics and how runs are scored
