---
sidebar_position: 4
title: "运行卡规范"
---

# 运行卡规范

> **执行摘要。** 运行卡是基准测试的原子单位——一份 JSON 文档，记录一次评估运行的完整配置、逐条结果和聚合分数。本页面文档化了模式、字段、指纹机制和分数结构。有关规范定义，请参阅[基准规范](/docs/network/specifications/benchmark)。

运行卡是单次评估运行的完整记录。它包含理解、复现和验证实验所需的一切：配置、分数、单条结果、令牌使用情况和环境元数据。

**模式版本：** 2.0

:::info[权威架构]
[基准规范](/docs/network/specifications/benchmark)是运行卡架构的唯一权威来源。有关指标定义、复合权重和质量等级，请参阅[评分规范](/docs/network/specifications/scoring)。本页面记录当前实现。
:::

---

## 顶级字段

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `run_id` | `string` | 在运行开始时生成的 UUID v4 |
| `harness_version` | `string` | 生成此卡的工具的语义版本（例如 `2.0`） |
| `model_slug` | `string` | 用于运行的模型 slug（例如 `google/gemini-3.1-pro`） |
| `model_id` | `string` | API 返回的已解析模型标识符（例如 `gemini-3.1-pro-001`） |
| `condition` | `string` | 实验标签（例如 `baseline`、`coached-v3`、`few-shot`） |
| `timestamp` | `string` | 运行开始时的 ISO 8601 UTC 时间戳 |
| `elapsed_seconds` | `number` | 整个运行的挂钟时长 |

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

标识评估数据集并通过 SHA-256 将其固定到特定内容版本。

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `id` | `string` | 数据集标识符（例如 `edtekla-dev-v1`） |
| `version` | `string` | 数据集版本字符串 |
| `language_pair` | `string` | 显示标签（例如 `EN→CRK`） |
| `sha256` | `string` | 数据集文件内容的 SHA-256 哈希。保证使用的确切数据 |
| `entry_count` | `number` | 数据集中的条目数 |

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

用于此运行的 API 和批处理配置。

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `api_provider` | `string` | API 提供商名称（例如 `openrouter`） |
| `temperature` | `number` | 采样温度 |
| `max_tokens` | `number` | 每次完成的最大令牌数 |
| `batch_size` | `number` | 每个并发批次的条目数 |
| `concurrency` | `number` | 最大并行 API 请求数 |
| `coaching_file` | `string` | 指导提示文件的路径（如果使用） |
| `method_path` | `string` | 方法插件目录的路径（如果使用） |
| `fst_retries` | `number` | FST 重试尝试次数 |

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

:::info[已发布的运行卡包含 `method_config`]
当运行卡通过 `mt-eval publish` 发布时，`publish.py` 会注入一个 `method_config` 块，其中包含规范的 8 字段 MethodConfig。这样可以实现零摩擦的排行榜安装 — 任何人都可以直接从已发布的卡片重现该方法。
:::

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

所有字段使用 **camelCase** 并遵循规范的 MethodConfig 模式（参见[构建方法](/docs/network/specifications/methods)）。
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | 系统提示的 SHA-256 哈希。包含在指纹中 |
| `system_prompt_used` | `string` | 发送给模型的完整系统提示文本 |

提示哈希是[指纹](#fingerprint)的一部分——两个具有不同提示的运行将具有不同的指纹，即使所有其他设置相同。

---

## `fingerprint`

可复现性标识符。两个具有相同指纹的运行使用了相同的实验设置。

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `hash` | `string` | 排序组件的 SHA-256 哈希 |
| `components` | `object` | 被哈希的输入值 |

### 指纹组件

| 组件 | 描述 |
|-----------|-------------|
| `dataset_sha256` | 数据集文件的哈希 |
| `model_slug` | 使用的模型 |
| `condition` | 实验条件标签 |
| `system_prompt_sha256` | 系统提示的哈希 |
| `temperature` | 采样温度 |
| `harness_version` | 工具版本 |

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

:::info[指纹 ≠ 运行卡哈希]
指纹标识*实验配置*。`run_card_hash` 验证*结果文件完整性*。详见[指纹与运行卡哈希](/docs/network/specifications/harness#fingerprint-vs-run-card-hash)。
:::

---

## `scores`

整个运行的聚合指标。

### 顶级分数

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `total` | `number` | 评估的总条目数 |
| `exact_matches` | `number` | 输出与金标准完全匹配的条目 |
| `exact_match_rate` | `number` | `exact_matches / total`（0.0–1.0） |
| `fst_accepted` | `number` | FST 分析器接受的条目 |
| `fst_acceptance_rate` | `number` | `fst_accepted / total`（0.0–1.0）。如果未使用 FST 分析器，则为 `null` |
| `chrf_plus_plus` | `number` | 语料库级 chrF++ 分数（0–100） |
| `errors` | `number` | 失败的条目（API 错误、超时等） |
| `avg_latency_seconds` | `number` | 所有条目的平均响应时间 |
| `median_latency_seconds` | `number` | 中位数响应时间 |
| `p95_latency_seconds` | `number` | 第 95 百分位数响应时间 |

### `by_difficulty`

按难度等级分解的分数。每个键（整数 1–5）包含与顶级分数相同的指标字段。

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

按条目来源分解的分数。每个键（例如 `gold_standard`、`textbook`）包含相同的指标字段。

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

整个运行的令牌使用情况和成本跟踪。

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `prompt_tokens` | `number` | 所有 API 调用中的总输入令牌数 |
| `completion_tokens` | `number` | 总输出令牌数 |
| `reasoning_tokens` | `number` | 用于链式思维推理的令牌（取决于模型，大多数模型为 0） |
| `cached_tokens` | `number` | 从提供商的提示缓存提供的令牌 |
| `total_cost_usd` | `number` | 总成本（美元）（由 API 报告） |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens`（0.0–1.0） |

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

用于可复现性的运行时环境元数据。

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `harness_version` | `string` | 工具版本（镜像顶级 `harness_version`） |
| `harness_git_commit` | `string` | 运行时工具的 Git 提交 SHA |
| `python_version` | `string` | Python 解释器版本 |
| `sacrebleu_version` | `string` | sacrebleu 库版本（用于 chrF++ 评分） |
| `os` | `string` | 操作系统标识符 |

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

逐条结果数组。每个数据集条目一个对象，按索引顺序排列。

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `entry_id` | `integer` | 此条目在语料库中的 ID（匹配 `entries[].id`） |
| `source` | `string` | 被翻译的源文本 |
| `reference` | `string` | 语料库中的金标准参考 |
| `predicted` | `string` | 方法的实际输出 |
| `exact_match` | `boolean` | 规范化后 `predicted` 是否完全匹配 `reference` |
| `entry_chrf` | `number` | 此条目的句子级 chrF++ 分数（0–100） |
| `fst_accepted` | `boolean \| null` | FST 分析器是否接受输出。如果未配置分析器，则为 `null` |
| `fst_analysis` | `string[]` | 输出的 FST 分析字符串（如果未分析或被拒绝，则为空数组） |
| `difficulty` | `integer` | 语料库中的难度等级（1–5） |
| `provenance` | `string` | 语料库中的来源标签 |
| `latency_seconds` | `number` | 此单条条目的响应时间 |
| `usage` | `object` | 逐条令牌使用情况：`{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | 如果此条目失败，则为错误消息。成功时为 `null` |

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

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `run_card_hash` | `string` | 整个运行卡 JSON 的 SHA-256 哈希，在哈希期间将 `run_card_hash` 字段本身设置为 `""` |

这是防篡改封条。排行榜在提交时重新计算此哈希，并拒绝不匹配的卡。

**计算哈希：**

1. 将运行卡序列化为 JSON，`run_card_hash` 设置为 `""`
2. 计算序列化字符串的 SHA-256
3. 将 `run_card_hash` 设置为生成的十六进制摘要

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[按条目钻取]
已发布的运行卡还会填充 `run_card_entries` Supabase 表，该表存储按条目的结果以供排行榜上的钻取分析。此表在 `mt-eval publish` 期间自动填充。
:::

---

## 另请参阅

- [MT 评估](/docs/network/leaderboard/rules) — 概述、排行榜价值和良好/不良方法指导
- [评估工具](/docs/network/specifications/harness) — 如何运行评估和生成运行卡
- [评估数据集](/docs/network/leaderboard/datasets) — 数据集格式、EDTeKLA、FLORES+
- [构建方法](/docs/network/specifications/methods) — 方法接口和方法卡规范
- [方法排行榜](https://champollion.dev/leaderboard) — 实时基准分数
- [基准规范](/docs/network/specifications/benchmark) — 评估协议、语料库格式、运行卡模式
- [评分规范](/docs/network/specifications/scoring) — 指标、复合权重和质量等级的单一真实来源
