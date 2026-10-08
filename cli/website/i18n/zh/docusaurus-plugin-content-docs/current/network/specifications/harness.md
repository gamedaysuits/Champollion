---
sidebar_position: 2
title: "Eval Harness v2.0"
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

> **执行摘要。** 本页涵盖 MT 评估工具的安装、配置和使用 — 该工具针对标准化语料库对翻译方法进行基准测试，并生成评分运行卡。有关指标、架构和评估协议的规范定义，请参阅[基准规范](/docs/network/specifications/benchmark)。

该工具运行翻译实验并生成运行卡。它处理提示构建、API 调用、评分和结果序列化 — 你提供数据集和模型。

## 安装

**要求：** Python 3.10+

```bash
python3 -m pip install mt-eval-harness
```

这将安装 `mt-eval` 命令。

## 使用

```bash
mt-eval run --corpus path/to/dataset.json
```

这会通过配置的模型（或方法插件）运行语料库中的每个条目，对输出进行评分，并将运行卡 JSON 文件写入输出目录。

## CLI 标志

### `mt-eval run`

| 标志 | 必填 | 默认值 | 描述 |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | 语料库文件路径（`.json`、`.jsonl`、`.tsv`） |
| `--source-file` / `--reference-file` | — | — | 平行文本文件（FLORES+、WMT 格式） |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | 精确模型 slug：完整的 OpenRouter ID，或直连提供商自身的精确名称。不支持别名和浮动 ID（`~vendor/…`、`…-latest`）：像 `gemini-pro` 这样的简短名称会被拒绝，且拒绝提示会指出应填写的 slug。多模型运行时以逗号分隔。若配合 `--method local-model`，它表示要运行的模型——Hugging Face ID 或模型目录——且该参数为必填项：该引擎没有默认模型。配合方法插件使用时，它会作为 `config.method_model` 传递给插件。任何其他机器翻译（MT）引擎都会使用其自带的模型进行翻译，且运行会提示 `-m` 未使用 |
| `-d, --dataset` | — | `all` | 数据集过滤器：`all`、分段名称或 ID 范围 |
| `--ids` | — | — | 要评估的条目 ID（逗号分隔） |
| `--source-lang` | — | `English` | 源语言名称 |
| `--target-lang` | — | — | 目标语言名称，与 prompt 中的表述一致。此处给出的代码（`sme`）会根据其语言卡片命名（“Northern Sami”），运行标头也会注明；卡片中未命名的代码（私有使用的 `qaa`）则保持为代码，并附带警告说明 prompt 将直接携带该代码 |
| `-p, --prompt` | — | `naive` | Prompt 版本（`naive`、`custom`、`champollion`） |
| `--coaching-file` | — | — | 引导 prompt 文本文件的路径。它会**替换**内置 prompt：模型将直接接收文件原文内容（加上 `--target-script` 行），而不是内置的“Translate the given … text to …; output only the translation”指令。预检运行（dry run）和运行标头会通过明确判定进行说明：当文件指明目标语言（以及使用哪个名称或代码）时显示 ✓；当既未指明语言也未指明代码时显示 ⚠；在未知任何名称或代码时显示未检查（not checked） |
| `--glossary` | — | — | 用于术语一致性的评估词汇表（JSON）；仅用于评分，绝不会发送给模型 |
| `--coaching` | — | — | 内联引导文本（带引号的字符串） |
| `--method` | — | — | 方法插件目录路径（包含 `method.json` + Python 模块），或已注册的机器翻译引擎（`google-translate`、`deepl`、`local-model`……） |
| `--allow-model-pair-mismatch` | — | `false` | 配合 `--method local-model`：运行 ID 所指定的语言对与语料库不同的 OPUS-MT 语言对模型（在 `eng>sme` 语料库上运行 `opus-mt-en-fi`，作为相关语言的基线）。未提供该标志则拒绝运行；运行卡片会记录此项 |
| `--method-card` | — | — | 用于排行榜元数据的方法卡片 JSON 路径 |
| `--fst-retries` | — | `0` | FST 重试尝试次数（仅限默认 LLM 方法） |
| `--skip-fst` | — | `false` | 即使该语言拥有 FST 也不计算 FST 接受率得分，且对此不再做额外提示。运行卡片会将其标记为未计算（not computed）。若未提供此标志，缺少 FST（分析器或其 pyhfst 运行时）同样不会阻止运行：运行将继续，运行卡片将 FST 接受率和形态学标记为未计算，且提示会指明 `mt-eval setup --lang <code>`。安装完成后，`mt-eval test <run log>` 会将 FST 分数添加到已完成的运行中，而无需重新翻译。系统不会自动下载任何内容 |
| `--skip-eval-standard` | — | `false` | 不计算语言卡片的评估标准指标（外部包）。运行卡片会将其标记为未计算。若未提供此标志，已安装包的指标将被计算；未安装的包属于可选附加项——运行将继续推进，但不包含其指标（标记为未计算），并指明卡片所声明的 `python3 -m pip install`。运行过程不会自动安装任何内容 |
| `--tools` | — | `false` | 启用工具调用模式 |
| `--tools-list` | — | — | 工具名称（逗号分隔） |
| `--max-tool-rounds` | — | `8` | 每个条目的最大工具调用轮数 |
| `--hooks` | — | — | 翻译后钩子名称 |
| `--style-profile` | — | — | 样式配置文件 JSON 路径。启用写作风格一致性指标（诊断性指标——绝不计入核心评分；参见[§ 写作风格与语域指标](#writing-style-and-register-metrics-informational)） |
| `-b, --batch-size` | — | `25` | 每次 API 调用处理的条目数 |
| `-c, --concurrency` | — | `8` | 并行 API 调用数 |
| `--max-tokens` | — | `32768` | 每次 API 调用的最大 token 数 |
| `--temperature` | — | `0.0` | 采样温度（0.0 = 确定性） |
| `--no-cache` | — | `false` | 禁用响应缓存 |
| `--cache-dir` | — | `eval/cache/harness` | 缓存目录路径（参见[翻译缓存](#the-translation-cache)） |
| `--metricx` | — | `false` | 同时计算 MetricX-24（Google，Apache-2.0），一种越低越好的神经错误分数（0–25），与核心 chrF++ 分数并列报告，绝不混合。需要 `metricx` 附加依赖及 Google 的模型代码（参见[可选神经指标](#opt-in-neural-metrics)） |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | 配合 `--metricx`：指定另一个 MetricX checkpoint（xl/xxl 版本或 `google/metricx-25-*` 版本） |
| `--fuse` | — | `false` | 同时计算 FUSE 风格对比器（AmericasNLP 2025 FUSE 方法的未经训练的重新实现），作为诊断对比器报告，绝不计入核心评分。需要 `fuse` 附加依赖（参见[可选神经指标](#opt-in-neural-metrics)） |
| `-o, --output-dir` | — | `eval/logs/harness` | 运行卡片与日志的输出目录 |
| `-n, --name` | — | — | 可读的运行名称 |
| `--dry-run` | — | `false` | 验证配置和语料库，不进行 API 调用。它会指出本次运行将使用的引导文件和词汇表（或 `none`），显示 prompt（完整显示内置 prompt；对于引导文件则显示首行、sha256 以及其替换内置 prompt 的说明），指明翻译缓存位置，并运行与实际运行相同的 eval-pack 检查，在以 `EVAL PACK:` 开头的行中进行报告（`ready (…)`、`missing — <pieces>; …` 或 `none needed for <language>`）而不会失败。第二行会说明实际运行是否会终止：缺少 FST 绝不会导致终止，而缺少任何其他组件则会导致终止。在 `--json` 下，摘要包含 `coaching_file`、`prompt`（其类型、sha256 和长度；内置 prompt 文本）、`glossary_file` 以及 `eval_pack`（`status`、`missing`、`setup_command`、`blocks_run`、`advisory`） |
| `--target-lang-code` | — | — | BCP-47 语言代码 |
| `--target-script` | — | — | 翻译必须采用的 ISO 15924 文字书写系统（`Latn`、`Cans`……），必须是目标语言卡片中列出的文字。harness 的 prompt 会对其提出要求（也会追加到引导文件文本后），因此它是 prompt sha256 的一部分。对于使用多种文字书写的语言（例如 Plains Cree），请使用参考译文所采用的文字书写系统。如果未指定，harness 会按文字统计参考译文的字母（汇总统计：不展示具体句子，因此对仅限本地的语料库同样有效），并请求占 90% 及以上的文字，在运行标头中进行说明（“references are 100% Latn → prompting for Latn”）并记录在运行日志中（`config.target_script_source`）；混合文字的参考译文不会指定文字，并会附带包含各文字比例的警告，且此时采用另一种文字的参考译文得分会接近于零。对于机器翻译引擎或方法插件会拒绝此标志，因为它们不接受 prompt |

`--champollion-config` 和 `--prompt champollion` 已在 0.2.0 中弃用，使用时会被拒绝并提示原因。`--champollion-cards-dir` 亦是如此；请设置 `MT_EVAL_CARDS_DIR` 使 harness 指向另一个卡片目录。它们在 Python 中重新构建了 CLI 的 prompt，而该副本已与 CLI 产生偏离。请使用方法插件（`--method`）来评估 CLI 方法，并使用 `mt-eval export-config` 将结果带回 CLI 项目中。

### 可选神经指标

只要安装了 `unbabel-comet`，就会计算 COMET（`mt-eval setup --comet`：安装约需 300 MB，首次使用需下载约 2.3 GB 的模型）。另外两项指标默认关闭，除非在运行时显式请求，因为它们各自都需要加载大型模型。与 COMET 一样，它们都在本机运行（无 API 成本，不会将文本发送到任何地方），与 chrF++ 核心指标并列报告且绝不混合；未请求它们时，运行卡片会显示“not run”（未运行）并提示需传入的标志。

| 指标 | 标志 | 依赖项 | 资源开销 |
|--------|------|---------------|---------------|
| MetricX-24（`metricx_score`，越低越好，0–25） | `--metricx`（checkpoint：`--metricx-model`） | `python3 -m pip install 'mt-eval-harness[metricx]'`（PyTorch、Transformers、SentencePiece）以及未发布在 PyPI 上的 Google 模型代码：`python3 -m pip install git+https://github.com/google-research/metricx` | 默认的 `google/metricx-24-hybrid-large-v2p6` checkpoint 与 mT5-XL 分词器在首次使用时会从 Hugging Face 下载数 GB 内容；在 CPU 上评分速度较慢。在没有参考译文的情况下，它会以无参考（质量评估/QE）模式评分 |
| FUSE 风格对比器（`fuse_score`） | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'`（sentence-transformers、jellyfish） | LaBSE 首次使用需下载约 1.8 GB。缺少 LaBSE 则不会计算该分数，报告中亦会注明。它是未经训练的（各组成部分的无权平均值），结果会被标记为 `fuse_untrained` |

在 MCP 上，`run_benchmark` 接收 `metricx`（附带 `metricx_model`）和 `fuse`，而 `comet: true` 需要 COMET；其执行计划会说明每项是否已安装，若确认的运行所请求的指标 harness 无法计算，则该运行会被拒绝。

各指标衡量的维度以及在特定语言上的可信度，请参阅[评分](/docs/network/specifications/scoring)与[指标可靠性](/docs/network/specifications/metric-reliability)。

### 翻译缓存

每次运行都会将模型对每个源句的输出保存在缓存中（`--cache-dir`，默认位于运行启动目录下的 `eval/cache/harness`），因此相同设置的重新运行可以免费复用已有输出。缓存键覆盖了模型、实际发送的 prompt（其 sha256）、影响输出的各项设置以及 harness 版本，因此一旦其中任何一项发生变更，绝不会返回旧的输出。缓存保存了语料库句子的副本：

- 运行标头和预检运行会打印其位置及包含的条目数；
- 该文件夹包含一个 `.gitignore`，因此 git 会忽略它；
- 它绝不会写入标记为可发布的文件夹 `mt-eval contest prepare`（其 `public/`）：`mt-eval run` 会拒绝此类 `--cache-dir` 或 `--output-dir`，并改用竞赛的 `runs/` 文件夹（参见[举办主权竞赛](/docs/network/sovereignty/run-a-sovereign-contest)）；
- 仅限本地、封装（sealed）或需要授权同意的语料库会获得其专属的 `protected/<namespace>/` 文件夹，以运行设置、语料库 sha256 及其条款为键，且其中的每个文件都会在 `<file>.champollion.json` 附随文件（sidecar）中携带语料库标识（参见[注册语料库](/docs/network/sovereignty/registering-corpora)）；
- 删除该文件夹即可移除这些副本，或传入 `--no-cache` 不保留任何缓存。

MCP 服务器的 `run_benchmark` 会在其执行计划和结果中指明缓存。对于您持有的文件，它会将缓存置于运行结果旁（`<corpus folder>/results/cache/`）；对于已注册的语料库 ID，则置于其专属文件夹中（`~/.champollion-mcp/cache/harness/`）。此前运行已经在服务器工作目录下的 `eval/cache/harness` 中生成的缓存会继续被使用，因此无需为其输出重复付费。缓存条目不依赖于文件夹所在位置，因此可以自由移动。

### 所有子命令

全部 18 个顶级子命令，于 2026-08-01 针对 `mt_eval_harness/cli.py` 生成。在此之前，本节仅列出了其中的 7 个，而包括主权组织者评分节点 `node` 在内的 6 个子命令**既未在此处记录，也未在 harness 指南中记录**。

**运行与评分**

| 子命令 | 功能说明 |
|---|---|
| `mt-eval run` | 执行翻译运行（标志见上文） |
| `mt-eval test <log>` | 分析已完成的运行日志。`-o <path>` 将报告写入 `<log>_report.json` 以外的位置，运行日志会记录该路径以便 `card` 和 `compare` 找到它。`--glossary <file>` 根据该词汇表对术语一致性进行评分；报告会记录其名称和 sha256，卡片、`compare` 以及发布预览中会说明术语遵循度（诊断指标）是基于哪个词汇表进行评分的 |
| `mt-eval compare <reports…>` | 比较两次或多次运行（`*_report.json` 或运行日志）。每个指标一行（chrF++、BLEU、spBLEU、TER……），每次运行一列（以字母 A、B、C……标示），标出越低越好的指标；`--significance` 为每对运行添加配对检验，每个表格以对应运行字母命名，包含 Δ 的 95% 置信区间，并说明 p 值为单指标且未经校正；`--method paired_bootstrap` 将默认的近似随机化检验替换为 Koehn 自助法（Bootstrap）（参见[显著性](/docs/network/specifications/significance)）。当报告共享文件夹时，将 `comparison-<hash>.json`（被比较运行 ID 的哈希值，确保其他比较绝不会覆盖它）写入报告旁，否则写入其最近公共文件夹中的 `comparisons/`（绝不写入单个运行自身的文件夹），除非 `-o` 指定了具体文件。仅依据 chrF++ 检验判定哪次运行更优；其他行仅作展示，不参与判定。旧版报告中的综合指标（composite）会被提示已弃用且不参与比较 |
| `mt-eval dashboard <logs…>` | 生成交互式 HTML 仪表盘 |
| `mt-eval card <run log>` | 美化输出可读的运行卡片。分数来自运行报告：位于日志旁、`mt-eval test -o` 所记录的位置或 `--report <path>`。未找到报告的运行会显示 NOT SCORED（未评分）及检索位置，绝不会显示零分。也可以传入报告文件；它将与其记录的运行日志一同读取 |

**寻找适合的方法**

| 子命令 | 功能说明 |
|---|---|
| `mt-eval recommend <src> <tgt>` | 针对特定语言对的方法指引——提供可用性分析以及**引证依据**，而非单纯的排名。语言对亦可指定为 `--source <src> --target <tgt>`（即 `corpora` 所采用的格式） |
| `mt-eval corpora --source X --target Y` | 列出某语言对可用的评估语料库。任一标志均可单独使用：`--target Y` 列出所有目标语言为 Y 的语料库，`--source X` 列出所有源语言为 X 的语料库 |
| `mt-eval corpora --with-fst` | 仅列出目标语言具有 harness 固定版本 FST 的语料库，以便对 FST 接受率进行评分。每个目标语言都会列出其 FST 是否已在本机安装以及如何安装（`mt-eval setup --lang <code>`，某些格式需手动安装）。可与 `--source`/`--target` 结合使用，或单独用于所有语言对。不会自动下载任何内容 |
| `mt-eval list models\|prompts\|datasets` | 列出可用资源 |

**贡献**

| 子命令 | 功能说明 |
|---|---|
| `mt-eval publish <report>` | 向排行榜提交 TestReport |
| `mt-eval queue` | 使用您自己的密钥运行社区算力队列头部的任务——参见[贡献算力](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | 将 TestReport 打包为 Champollion 方法插件 |
| `mt-eval generate-plugin` | `export` 的别名 |
| `mt-eval export-config` | 从 TestReport 生成 `champollion.config.json` 代码片段 |

**竞赛与自行举办竞赛**

| 子命令 | 功能说明 |
|---|---|
| `mt-eval contest` | 举办或参加**主权竞赛**——组织者的 `prepare`、`register`、`create`、`rank`、`close`、`export`；参赛者的 `qualify`（对公开开发集自行评分以获取准入凭据；资格线为 0–100 的 chrF++ 分数）、`validate`（离线演练节点检查）、`submit-model` / `submit-method`（交付模型或方法）、`status`、`list`。参加竞赛的方式是向组织者节点提供可运行（RUN）的实体；上传翻译结果及链接自报卡片的参赛方式已于 2026-09-06 弃用 |
| `mt-eval shared-task` | 多语言对共享任务（shared-task）版次总揽：单行汇总 AmericasNLP 风格版次中的 N 个单语言对竞赛，并携带其策略默认值。**仅用于分组和默认值——各项准入门槛仍然按单场竞赛生效** |
| `mt-eval node` | **组织者评分节点。**轮询接收通道、按公开资格线审核准入、根据竞赛策略授权、基于**组织者持有的机密参考译文**进行评分、仅发布得分。这是[举办主权竞赛](/docs/network/sovereignty/run-a-sovereign-contest)和[主权评估节点](/docs/network/sovereignty/sovereign-eval-node)背后的命令——语料库绝不会离开组织者的机器 |

`mt-eval node` 本身拥有 18 个子命令，包括物理隔离通道（`import-bundle`、`export-scores`、`relay`、`egress-check`、`manifest`）以及 M-of-N 托管仪式（`ceremony`、`seal`、`keygen`、`sign-manifest`、`verify-manifest`、`ledger`）。请运行 `mt-eval node --help`；主权运作机制在上方链接的两个页面中有详细说明。

**设置**

| 子命令 | 功能说明 |
|---|---|
| `mt-eval setup` | 安装可选依赖（COMET 神经指标、FST 运行时） |
| `mt-eval logout` | 移除已存储的身份验证凭据 |

### 示例

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## 运行卡架构

每个实验都会生成一个**运行卡** — 一个自包含的 JSON 文档。顶级结构：

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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

有关完整架构及每个字段的文档，请参阅[运行卡规范](/docs/network/specifications/run-card)。

:::info[权威规范]
[基准规范](/docs/network/specifications/benchmark)是运行卡片规范的唯一权威事实来源。关于指标定义及运行的评分方式，请参阅[评分规范](/docs/network/specifications/scoring)。本页介绍如何使用 harness；规范文档则定义了输出结果的具体含义。
:::

### 关键块

**`dataset`** — 标识使用了哪个数据集，包括其内容哈希，以便结果与特定版本相关联：

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

**`scores`** — 运行的聚合指标：

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

**`totals`** — 令牌使用情况和成本跟踪：

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

## 写作风格和寄存器指标（信息性） {#writing-style-and-register-metrics-informational}

工具可以通过 `WritingStyleConsistency` 指标插件（`mt_eval_harness/plugins/writing_style.py`）评估翻译是否与目标**寄存器**和**写作风格**相匹配。翻译在语言上可能是正确的，但寄存器错误 — 法律文件中的非正式措辞、营销文案中的正式样板 — 字符串指标不会注意到。这些指标会。

**测量内容（每个条目）：**

| 指标 | 范围 | 含义 |
|--------|-------|---------|
| `style_register_match` | 布尔值 | 输出是否与预期的寄存器相匹配？目标来自语料库条目的 `register` 字段（参见[基准规范 §2.6](/docs/network/specifications/benchmark)）或样式配置文件 |
| `style_sentence_length_ratio` | 浮点数 | 预测与参考平均句子长度（1.0 = 匹配；偏差 = 风格漂移） |
| `style_formality_score` | 0.0–1.0 | 正式/非正式标记的存在（T–V 代词、缩写等）使用每种语言的标记资源 |

**聚合：** `style_consistency_rate` — 没有检测到寄存器不匹配的条目的比例。

使用 `--style-profile path/to/profile.json` 启用自定义目标（例如品牌语音配置文件）；没有它，插件会回退到每个语料库条目的 `register` 元数据（如果存在）。

:::caution[明确适用范围]
这些指标属于**诊断指标**——绝不计入核心评分，且正式度（formality）检测基于标记词（启发式），而非模型习得的判断。请将其视为语域遵循度的偏离检测器，而非对风格质量的评定标准。
:::

---

## 指纹与运行卡哈希 {#fingerprint-vs-run-card-hash}

工具生成两个不同的哈希。它们有不同的用途：

### 指纹

**指纹**回答：*"这个运行能被重现吗？"*

它对定义实验配置的输入组合进行哈希 — 而不是输出：

- 数据集 SHA-256
- 模型 slug
- 条件标签
- 系统 Prompt SHA-256
- 温度
- 批处理大小
- 启用的工具
- Harness 版本

共计八个组成部分：批处理大小和工具调用会实质性地改变输出，因此它们构成了实验标识的一部分——批处理大小不同的两次运行**不会**共享相同的指纹。参见[基准规范 §3.8](/docs/network/specifications/benchmark#38-fingerprint)。

两个具有相同指纹的运行使用了相同的设置。它们的结果应该是可比较的（模除 API 非确定性）。

### 运行卡哈希

**运行卡哈希**回答：*"这个特定结果文件是否被篡改过？"*

它是整个运行卡 JSON 的 SHA-256（不包括 `run_card_hash` 字段本身）。如果任何字段改变 — 一个分数、一个时间戳、一个输出 — 哈希就会破裂。

:::info[何时使用哪个]
使用**指纹**对可比较的运行进行分组（相同实验，不同执行）。使用**运行卡哈希**验证特定结果文件的完整性。
:::

---

## 发布到排行榜

完成一次运行后，对该运行的 `<run-id>_report.json` 使用 `mt-eval publish`。写入线上实时排行榜需要显式指定 `--prod`（或 `MT_EVAL_ALLOW_PROD=1`）；`mt-eval run --publish --prod` 则一次性完成这两个步骤：

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
```

如果在运行期间没有提供 `--method-card`，`mt-eval publish` 会启动一个交互式向导（`method_card_wizard.py`），引导你描述你的方法（名称、类别、使用的工具等）。向导输出在提交前嵌入到运行卡中。

### 手动检查

运行卡作为 JSON 文件保存在输出目录中（默认为 `eval/logs/harness/`）— 在发布前在那里检查它们。`mt-eval publish` 是提交路径；没有基于 PR 的运行卡摄取。

:::note[提交 API 和网页上传尚未上线]
`POST https://champollion.dev/api/leaderboard/submit` 端点和排行榜上传 UI 已规划但**尚未实现**。在它们发布之前，唯一可用的提交路径是 `mt-eval publish`。
:::

:::warning[排行榜验证]
排行榜根据数据集注册表验证提交的运行卡。引用未知数据集或具有损坏的 `run_card_hash` 的提交将被拒绝。
:::

:::danger[不要在评估数据上进行训练]
如果您的方法在开发过程中已经看到过评估数据集 — 作为训练数据、少样本示例、字典条目或提示工程材料 — 您的提交将被**取消资格**。有关什么是好方法与坏方法，请参阅 [MT 评估](/docs/network/leaderboard/rules)。
:::

---

## 另请参阅

- [机器翻译评估](/docs/network/leaderboard/rules)——概述、排行榜价值主张及优劣方法指引
- [评估数据集](/docs/network/leaderboard/datasets)——数据集格式、EDTeKLA、FLORES+
- [运行卡片规范](/docs/network/specifications/run-card)——完整的 JSON Schema
- [构建方法](/docs/network/specifications/methods)——用于创建可评估方法的方法接口
- [方法排行榜](https://champollion.dev/leaderboard)——实时基准测试分数
- [基准规范](/docs/network/specifications/benchmark)——评估协议、语料库格式、运行卡片规范
- [评分规范](/docs/network/specifications/scoring)——指标及运行评分方式的唯一事实来源（SSOT）
