---
sidebar_position: 4
title: "Espesipikasyon ng Run Card"
---

# Espesipikasyon ng Run Card

> **Executive Summary.** Ang run card ang atomikong yunit ng benchmarking — isang JSON document na nagtatala ng kumpletong configuration, mga resulta kada entry, at aggregate scores ng isang evaluation run. Idinodokumento ng pahinang ito ang schema, mga field, mekanismo ng fingerprinting, at istruktura ng score. Tingnan ang [Espesipikasyon ng Benchmark](/docs/network/specifications/benchmark) para sa mga kanonikal na depinisyon.

Ang run card ang kumpletong talaan ng isang evaluation run. Naglalaman ito ng lahat ng kinakailangan upang maunawaan, ma-reproduce, at ma-verify ang eksperimento: configuration, scores, indibiduwal na resulta, token usage, at environment metadata.

**Bersyon ng schema:** 2.0

:::info[Awtoritatibong Schema]
Ang [Espesipikasyon ng Benchmark](/docs/network/specifications/benchmark) ang nag-iisang pinagmumulan ng katotohanan para sa schema ng run card. Para sa mga depinisyon ng metric, composite weights, at quality tiers, tingnan ang [Espesipikasyon ng Scoring](/docs/network/specifications/scoring). Idinodokumento ng pahinang ito ang kasalukuyang implementasyon.
:::

---

## Mga Top-Level Field

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 na ginawa sa simula ng run |
| `harness_version` | `string` | Semantic version ng harness na gumawa ng card na ito (hal., `2.0`) |
| `model_slug` | `string` | Model slug na ginamit para sa run (hal., `google/gemini-3.1-pro`) |
| `model_id` | `string` | Na-resolve na model identifier na ibinalik ng API (hal., `gemini-3.1-pro-001`) |
| `condition` | `string` | Label ng eksperimento (hal., `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | ISO 8601 UTC timestamp noong nagsimula ang run |
| `elapsed_seconds` | `number` | Wall-clock duration ng buong run |

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

Tinutukoy nito ang evaluation dataset at ini-pin ito sa isang partikular na content version sa pamamagitan ng SHA-256.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `id` | `string` | Dataset identifier (hal., `edtekla-dev-v1`) |
| `version` | `string` | String ng bersyon ng dataset |
| `language_pair` | `string` | Display label (hal., `EN→CRK`) |
| `sha256` | `string` | SHA-256 hash ng nilalaman ng dataset file. Ginagarantiyahan nito ang eksaktong data na ginamit |
| `entry_count` | `number` | Bilang ng mga entry sa dataset |

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

Ang API at batching configuration na ginamit para sa run na ito.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `api_provider` | `string` | Pangalan ng API provider (hal., `openrouter`) |
| `temperature` | `number` | Sampling temperature |
| `max_tokens` | `number` | Maximum tokens kada completion |
| `batch_size` | `number` | Mga entry kada concurrent batch |
| `concurrency` | `number` | Maximum parallel API requests |
| `coaching_file` | `string` | Path papunta sa coaching prompt file, kung ginamit |
| `method_path` | `string` | Path papunta sa method plugin directory, kung ginamit |
| `fst_retries` | `number` | Bilang ng FST retry attempts |

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

:::info[Kasama sa mga Na-publish na Run Card ang `method_config`]
Kapag na-publish ang isang run card sa pamamagitan ng `mt-eval publish`, ini-inject ng `publish.py` ang isang `method_config` block na naglalaman ng canonical 8-field MethodConfig. Pinapagana nito ang zero-friction leaderboard install — maaaring i-reproduce ng sinuman ang method nang direkta mula sa na-publish na card.

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

Gumagamit ang lahat ng field ng **camelCase** at sumusunod sa kanonikal na MethodConfig schema (tingnan ang [Pagbuo ng Method](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | SHA-256 hash ng system prompt. Kasama sa fingerprint |
| `system_prompt_used` | `string` | Ang buong system prompt text na ipinadala sa model |

Bahagi ng [fingerprint](#fingerprint) ang prompt hash — magkakaroon ng magkaibang fingerprint ang dalawang run na may magkaibang prompt kahit magkatugma ang lahat ng iba pang setting.

---

## `fingerprint`

Isang reproducibility identifier. Gumamit ng parehong experimental setup ang dalawang run na may magkaparehong fingerprint.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `hash` | `string` | SHA-256 hash ng mga nakaayos na component |
| `components` | `object` | Ang mga input value na na-hash |

### Mga Component ng Fingerprint

| Component | Paglalarawan |
|-----------|-------------|
| `dataset_sha256` | Hash ng dataset file |
| `model_slug` | Model na ginamit |
| `condition` | Label ng experiment condition |
| `system_prompt_sha256` | Hash ng system prompt |
| `temperature` | Sampling temperature |
| `harness_version` | Bersyon ng harness |

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
Tinutukoy ng fingerprint ang *configuration ng eksperimento*. Vine-verify ng `run_card_hash` ang *integridad ng result file*. Tingnan ang [Fingerprint vs Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) para sa mga detalye.
:::

---

## `scores`

Aggregate metrics para sa buong run.

### Mga Top-Level Score

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `total` | `number` | Kabuuang mga entry na na-evaluate |
| `exact_matches` | `number` | Mga entry kung saan eksaktong tumugma ang output sa gold standard |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | Mga entry kung saan tinanggap ng FST analyzer ang output |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0.0–1.0). `null` kung walang FST analyzer na ginamit |
| `chrf_plus_plus` | `number` | Corpus-level chrF++ score (0–100) |
| `errors` | `number` | Mga entry na nabigo (API error, timeout, atbp.) |
| `avg_latency_seconds` | `number` | Mean response time sa lahat ng entry |
| `median_latency_seconds` | `number` | Median response time |
| `p95_latency_seconds` | `number` | 95th percentile response time |

### `by_difficulty`

Mga score na hinati ayon sa difficulty tier. Ang bawat key (integer 1–5) ay naglalaman ng parehong metric fields gaya ng mga top-level score.

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

Mga score na hinati ayon sa entry provenance. Ang bawat key (hal., `gold_standard`, `textbook`) ay naglalaman ng parehong metric fields.

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

Token usage at cost tracking para sa buong run.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `prompt_tokens` | `number` | Kabuuang input tokens sa lahat ng API call |
| `completion_tokens` | `number` | Kabuuang output tokens |
| `reasoning_tokens` | `number` | Mga token na ginamit para sa chain-of-thought reasoning (nakadepende sa model, 0 para sa karamihan ng mga model) |
| `cached_tokens` | `number` | Mga token na inihain mula sa prompt cache ng provider |
| `total_cost_usd` | `number` | Kabuuang gastos sa USD (ayon sa iniulat ng API) |
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

Runtime environment metadata para sa reproducibility.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `harness_version` | `string` | Bersyon ng harness (sumasalamin sa top-level `harness_version`) |
| `harness_git_commit` | `string` | Git commit SHA ng harness sa oras ng run |
| `python_version` | `string` | Bersyon ng Python interpreter |
| `sacrebleu_version` | `string` | Bersyon ng sacrebleu library (ginamit para sa chrF++ scoring) |
| `os` | `string` | Identifier ng operating system |

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

Ang array ng mga resulta kada entry. Isang object kada dataset entry, ayon sa pagkakasunod-sunod ng index.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `entry_id` | `integer` | ID ng entry na ito sa corpus (tumutugma sa `entries[].id`) |
| `source` | `string` | Ang source text na isinalin |
| `reference` | `string` | Ang gold-standard reference mula sa corpus |
| `predicted` | `string` | Ang aktuwal na output ng method |
| `exact_match` | `boolean` | Kung ang `predicted` ay eksaktong tumutugma sa `reference` pagkatapos ng normalization |
| `entry_chrf` | `number` | Sentence-level chrF++ score para sa entry na ito (0–100) |
| `fst_accepted` | `boolean \| null` | Kung tinanggap ng FST analyzer ang output. `null` kung walang analyzer na na-configure |
| `fst_analysis` | `string[]` | Mga FST analysis string para sa output (empty array kung hindi na-analyze o tinanggihan) |
| `difficulty` | `integer` | Difficulty tier mula sa corpus (1–5) |
| `provenance` | `string` | Provenance tag mula sa corpus |
| `latency_seconds` | `number` | Response time para sa indibiduwal na entry na ito |
| `usage` | `object` | Token usage kada entry: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Error message kung nabigo ang entry na ito. `null` kapag matagumpay |

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

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `run_card_hash` | `string` | SHA-256 hash ng buong run card JSON, kung saan ang mismong field na `run_card_hash` ay nakatakda sa `""` habang nagha-hash |

Ito ang tamper-detection seal. Muling kinukuwenta ng leaderboard ang hash na ito sa submission at tinatanggihan ang mga card kung saan hindi ito tumutugma.

**Pagkuwenta ng hash:**

1. I-serialize ang run card sa JSON na may `run_card_hash` na nakatakda sa `""`
2. Kuwentahin ang SHA-256 ng serialized string
3. Itakda ang `run_card_hash` sa nagresultang hex digest

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Drill-Down Bawat Entry]
Pinupunan din ng mga na-publish na run card ang `run_card_entries` Supabase table, na nag-iimbak ng mga resulta bawat entry para sa drill-down analysis sa leaderboard. Awtomatikong pinupunan ang table na ito sa panahon ng `mt-eval publish`.
:::

---

## Tingnan Din

- [MT Evaluation](/docs/network/leaderboard/rules) — pangkalahatang-ideya, halaga ng leaderboard, at gabay sa mabuti/masamang method
- [Eval Harness](/docs/network/specifications/harness) — kung paano magpatakbo ng mga evaluation at gumawa ng mga run card
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — format ng dataset, EDTeKLA, FLORES+
- [Pagbuo ng Method](/docs/network/specifications/methods) — ang method interface at method card spec
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [Espesipikasyon ng Benchmark](/docs/network/specifications/benchmark) — evaluation protocol, corpus format, run card schema
- [Espesipikasyon ng Scoring](/docs/network/specifications/scoring) — SSOT para sa metrics, composite weights, at quality tiers
