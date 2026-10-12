---
sidebar_position: 4
title: "运行卡规范"
---

# 运行卡规范

> **执行摘要。** 运行卡是基准测试的原子单位——一份 JSON 文档，记录一次评估运行的完整配置、逐条结果和聚合分数。本页面文档化了模式、字段、指纹机制和分数结构。有关规范定义，请参阅[基准规范](/docs/network/specifications/benchmark)。

运行卡是单次评估运行的完整记录。它包含理解、复现和验证实验所需的一切：配置、分数、单条结果、令牌使用情况和环境元数据。

**模式版本：** 2.0

:::info[权威规范]
[基准规范](/docs/network/specifications/benchmark)是运行卡（run card）模式的单一真实来源（SSOT）。有关指标定义以及运行评分机制（chrF++ 主要指标、旁注标准指标、诊断指标），请参阅[评分规范](/docs/network/specifications/scoring)。本页记录了当前的实现。
:::

---

## 顶级字段

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `run_id` | `string` | 运行开始时生成的 UUID v4 |
| `harness_version` | `string` | 生成此卡片的评测套件语义化版本（例如 `2.0`） |
| `model_slug` | `string` | 运行所使用的模型标识符（例如 `google/gemini-3.1-pro-preview`） |
| `model_id` | `string` | API 返回的已解析模型标识符（例如 `gemini-3.1-pro-001`） |
| `condition` | `string` | 实验标签：套件写入的内容为 `naive`（其内置提示词）、`coached`（由指导文件替换）或方法插件的方法类；自由文本，因此手动构建的卡片可能会写 `coached-v3` 或 `few-shot`。非质量标签（质量等级已废弃；所有新卡片上的 `scores.quality_tier` 均为 null） |
| `timestamp` | `string` | 运行开始时的 ISO 8601 UTC 时间戳 |
| `elapsed_seconds` | `number` | 整个运行的挂钟时间（wall-clock duration） |

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

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `api_provider` | `string` | 承载文本的途径：套件自身 LLM 路径的 API 提供商（`openrouter`、`openai`、`anthropic`、`gemini`、`local`）；机器翻译引擎的引擎 ID（例如 `google-translate`）；对于方法插件，当操作员证明完全使用本地传输时为 `local`（`--attest-local-transport`），否则为 `method-plugin` |
| `temperature` | `number` | 采样温度 |
| `max_tokens` | `number` | 每次补全的最大 token 数 |
| `batch_size` | `number` | 每个并发批次的条目数 |
| `concurrency` | `number` | 最大并行 API 请求数 |
| `coaching_file` | `string` | 指导提示词文件路径（如果使用）（运行日志的自身记录；已发布的卡片会按文件名命名指导文件，或对于 `--coaching` 文本显示为 `inline coaching`——绝非本地路径） |
| `method_path` | `string` | 方法插件目录路径（如果使用） |
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

新卡片上的 `qualityTier` 始终为 `null`：质量等级已废弃。所有字段均使用 **camelCase**，并遵循规范的 MethodConfig 模式（参见[构建方法](/docs/network/specifications/methods)）。
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

权威列表见[基准规范 §3.8](/docs/network/specifications/benchmark#38-fingerprint)。简要概括如下：

| 组件 | 说明 |
|-----------|-------------|
| `dataset_sha256` | 数据集文件的哈希值 |
| `model_slug` | 所用模型（对于机器翻译引擎或方法插件，指引擎或方法 ID） |
| `condition` | 实验条件标签 |
| `system_prompt_sha256` | 系统提示词的哈希值 |
| `temperature` | 采样温度 |
| `batch_size`, `tools_enabled` | 批处理与工具使用 |
| `harness_version` | 评测套件版本 |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | 版本 2（评测套件 0.2.0 及更高版本）：通道、端点主机（哈希后）、token 上限，以及方法的版本和代码哈希值 |
| `method_model`, `method_dependencies_sha256` | 版本 2，仅限方法插件运行：传递给插件的模型（`-m`）及其声明的 `dependencies` 的哈希值 |
| `method_model`, `method_model_sha256` | 版本 2，仅限 `--method local-model` 运行：加载的模型（Hugging Face ID 或目录名称）及其内容哈希值（目录）或修订版本（Hugging Face ID） |

`fingerprint.version` 表示卡片哈希计算所依据的列表版本。

### `engine_model`

运行传入指定模型的机器翻译引擎（`--method local-model -m <model>`）时，会携带已加载的模型信息：

| 字段 | 说明 |
|-------|-------------|
| `given` | `-m` 的输出内容 |
| `kind` | `directory` 或 `hub`（Hugging Face ID） |
| `id` | Hugging Face ID 或目录名称（绝非本地路径） |
| `sha256` | 仅限目录：对其文件列表按 `sha256sum` 风格计算的 SHA-256 |
| `revision` | 仅限 Hugging Face ID：已加载的修订版本 |
| `family`, `backend` | `opus`、`nllb` 或 `madlad`；`transformers` 或 `ctranslate2` |
| `decode` | 允许的输出长度上限：模型声明的长度，或评测套件规则（`max(64, 4 × source tokens)` 个新 token，受限于解码器位置） |
| `pair_mismatch` | 仅当特意运行针对另一语言对的 OPUS-MT 语言对模型时存在（`--allow-model-pair-mismatch`） |

`method_config.model` 指定了相同的模型（`<id>@<revision>` 或 `<directory name>@sha256:<hash>`）。未记录模型的 `local-model` 运行日志不会发布任何内容：卡片显示为 `engine_model_unrecorded`，且 `mt-eval publish` 会拒绝接受它。

### `method_plugin`

方法插件运行（`--method <plugin dir>`）还会携带用于标识该插件的信息，正如运行器所记录的一样：

| 字段 | 说明 |
|-------|-------------|
| `version` | `method.json` 声明的版本（未声明时为 `null`） |
| `code_sha256` | 插件文件的 SHA-256（`method.json` 及其 `.py` 文件，按 `sha256sum` 风格清单） |
| `model_given` | 通过 `-m/--model` 传递给插件的模型，或 `null` |
| `models_called`, `models_basis` | 插件报告调用的模型，以及该调用是根据其结果观察到的还是声明的 |
| `dependency_class` | `method.json` 声明的依赖类 |
| `dependencies` | `method.json` 声明的 `dependencies` 列表，不包含自由文本 `notes` |
| `dependencies_sha256` | 完整声明列表的 SHA-256（指纹组件） |

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

:::info[指纹 ≠ 运行卡哈希]
指纹标识*实验配置*。`run_card_hash` 验证*结果文件完整性*。详见[指纹与运行卡哈希](/docs/network/specifications/harness#fingerprint-vs-run-card-hash)。
:::

---

## `scores`

整个运行的聚合指标。

### 顶级分数

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `total` | `number` | 评估的条目总数 |
| `exact_matches` | `number` | 输出与黄金标准完全匹配的条目数 |
| `exact_match_rate` | `number` | `exact_matches / total`（0.0–1.0） |
| `fst_accepted` | `number` | FST 分析器接受的输出**单词**数，按所有条目求和（非条目计数）。如果未使用 FST 分析器，则为 `null` |
| `fst_acceptance_rate` | `number` | 单条目接受率的均值（每个条目的接受单词数 ÷ 其单词数；空输出计为 0），范围 0.0–1.0。它**不是** `fst_accepted` ÷ 所有单词——该合并词汇率是报告的 `corpus_validity_rate`，在运行卡上显示为“Words accepted”。如果未使用 FST 分析器，则为 `null` |
| `chrf_plus_plus` | `number` | **主要及排名指标：**语料库级 chrF++（sacreBLEU chrF，`word_order=2`），范围 0–100。其 95% bootstrap 置信区间为 `confidence_intervals.corpus_chrf`，其签名为 `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | 每个新卡片上均为 `"standard/1"`。未包含该项的卡片是按已废弃的综合评分（`legacy-composite`）进行评分的，并据此进行验证 |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | 与 chrF++ 并列显示的标准指标，绝不混合（BLEU 是卡片顶层的 `corpus_bleu`；COMET 计算时为 `comet_model` 伴随 `comet_score`） |
| `sacrebleu_signatures` | `object` | 计算的每个 sacreBLEU 指标的 sacreBLEU 签名：`chrf`（主要指标）、`chrf_plain`、`bleu`、`spbleu`、`ter` |
| `confidence_intervals` | `object` | 95% bootstrap 区间；`corpus_chrf` 为主要指标的区间 |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **已废弃。**新卡片上始终为 `null`。旧版卡片保留其存储的值；仍显示其综合评分的界面会将其标记为“legacy composite (retired)” |
| `errors` | `number` | 失败的条目数（API 错误、超时等） |
| `avg_latency_seconds` | `number` | 所有条目的平均响应时间 |
| `median_latency_seconds` | `number` | 中位数响应时间 |
| `p95_latency_seconds` | `number` | 第 95 百分位响应时间 |

### `by_difficulty`

按难度等级细分的得分，以等级为键（`"1"`–`"5"`，未评级为 `"0"`）。这些字段**不同于**顶层字段：`avg_chrf` 和 `avg_bleu` 是该等级各条目的 **句级均值** chrF++ 和 BLEU，而顶层的 `chrf_plus_plus` 和 BLEU 则是**语料库级**（一次性针对所有片段计算）。两者是不同的统计量：尤其是语料库 BLEU 通常远低于句级 BLEU 的均值，因此在 10.2 的等级值旁出现 0.5 的主要指标并不矛盾。各等级之间可以相互比较，但切勿与主要指标进行比较。

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

## `score_caveats`

仅在某些因素限制了得分含义时出现。得分即使计算完全正确，也可能无法衡量其标签所代表的实际含义，因此限制说明会随数值一同展示：`mt-eval test`、`mt-eval card`、`mt-eval compare`、仪表板以及 `mt-eval publish` 预览都会在主要指标旁边打印该说明，`publish` 会将其存储于此供排行榜展示。它绝不会更改得分：chrF++ 主要指标照常计算，告诫说明则指明限制该指标或其旁注诊断指标的因素。

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`、`length_inflation`、`length_deflation`、`source_copy` 或 `near_constant_output` |
| `source` | `string` | 评测方：`nmt-forge` 或 `mt-eval-harness` |
| `severity` | `string` | `major`（需结合此项解读主要指标）或 `minor` |
| `message` | `string` | 一句话，最多 480 个字符 |

**`train_test_near_twin`**，由 nmt-forge 写入。当 `nmt-forge export`（或 `evaluate`）对模型进行评分时，它会检查每一测试行在训练数据中是否存在近乎相同的孪生样本，并将结果记录在它写入的 mt-eval 文件中。评测套件将该读数复制到卡片上：`n` 个测试行中有 `near_twin_rows` 个存在孪生样本（`near_twin_share`），且有 `strict_n` 行不存在。当此类样本足够多时，`strict_corpus_chrf` 和 `strict_corpus_chrf_ci` 会单独给出针对它们的 chrF++，即泛化数值。当至少一半的测试行存在孪生样本时，`recall_not_translation` 为 `true`。此时即使 chrF++ 达到 100，衡量的也只是模型对训练短语的记忆召回程度，而非其实际翻译能力。如果 forge 的检查未运行，则告诫说明为 `minor` 并注明原因。未发现孪生样本的检查不会添加告诫说明。

**`length_inflation`**，由评测套件测定。当输出平均长度超过其参考长度的 2 倍（[`length_ratio`](/docs/network/specifications/scoring)的虚增上限），或至少四分之一的已评分条目超过该上限时添加。泄露的 few-shot 示例、备注或重复文本会导致输出虚增，进而使基于参考的评分仅反映了这些冗余内容。字段包括 `mean_length_ratio`、`scored_entries` 中的 `inflated_entries`、`ratio_bound` 以及 `share_bound`。

**`length_deflation`**，由评测套件测定。它是 `length_inflation` 的镜像情况：输出远**短于**其参考文本，表明漏译了单词。当输出平均长度小于其参考长度的 0.5 倍（[`length_ratio`](/docs/network/specifications/scoring)的截断下限），或至少四分之一的已评分条目低于该下限时添加。某些诊断指标仅评判输出中实际包含的单词：FST 接受率和语码转换（code-switching）。丢弃无法翻译内容的系统会虚高这些指标。当运行包含其中任一指标时，告诫说明为 `major`，并提示不要将其与翻译了全部内容的运行相提并论作为质量指标。chrF++ 主要指标对召回率赋予权重，因此它会统计缺失的单词。如果两个指标均不存在（仅有 chrF++ 和完全匹配），则它是一条 `minor` 备注。字段包括 `mean_length_ratio`、`scored_entries` 中的 `short_entries`、`ratio_bound`、`share_bound` 以及 `emitted_only_metrics`。

**`source_copy`**，由评测套件测定。当至少一半已评分输出是源文本的原样复制时（忽略大小写、重音符和标点）添加。参考文本本身即为源文本的行（如人名）会被排除在外。不与参考文本进行比较的指标仍可能对抄袭的单词给予好评。字段包括 `considered_entries` 中的 `copies`、`copy_share` 以及 `share_bound`。

**`near_constant_output`**，由评测套件测定。针对多个*不同*的输入给出了同一个输出。在忽略大小写、标点和空格的情况下对比输出与源文本；由于变音符号在不同输出之间能够区分单词，因此会被计入考量。当至少 3 个不同的源文本生成了相同的输出时（若输出仅有一到两个词长则为 5 个，因为简短答案合理重复），该输出被视为跨源重复。与自身参考文本相等的输出属于正确答案，不予统计。当重复覆盖至少四分之一且不少于 5 个不同的源文本时，添加该告诫说明。它始终为 `major`。当运行携带脱离参考文本评估输出的指标（FST 接受率、语码转换）时，提示信息会点名该指标：这类指标每当有效句子出现时都会给予好评。字段包括 `considered_sources` 中的 `repeated_sources`、`repeat_share`、`repeated_outputs`、`top_output_sources` 以及 `top_output_words`（重复最多的输出：匹配了多少源文本，及其长度）、`share_bound`、`min_repeats`、`min_sources`、`min_sources_short` 和 `emitted_only_metrics`。这些仅为统计计数：告诫说明绝不携带输出的实际文本。

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

该字段位于存储的运行卡 JSON 内部，因此无需数据库列。它不是[指纹](#fingerprint)的一部分：它描述的是结果，而非实验本身。

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

- [机器翻译评测](/docs/network/leaderboard/rules) — 概述、排行榜价值以及良性/恶性方法指引
- [评测套件](/docs/network/specifications/harness) — 如何运行评测并生成运行卡
- [评测数据集](/docs/network/leaderboard/datasets) — 数据集格式、EDTeKLA、FLORES+
- [构建方法](/docs/network/specifications/methods) — 方法接口与方法卡规范
- [方法排行榜](https://champollion.dev/leaderboard) — 实时基准得分
- [基准规范](/docs/network/specifications/benchmark) — 评估协议、语料库格式、运行卡模式
- [评分规范](/docs/network/specifications/scoring) — 指标与运行评分机制的单一真实来源（SSOT）
