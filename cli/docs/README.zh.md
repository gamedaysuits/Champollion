# Champollion

[![npm 版本](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![许可证：PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


只需一条命令即可翻译你的本地化文件：

```bash
npx champollion sync
```

Champollion 会自动检测你的本地化文件、文件格式以及目标语言。它会翻译缺失的键值，跳过已翻译的内容，并将结果写入文件。就这么简单。

**许可证：** 源码可用（source-available），基于 [PolyForm Noncommercial License 1.0.0](../LICENSE) 协议 —— 可免费用于非商业目的（个人项目、研究、教学，以及慈善机构、学校和公共机构的使用）、修改和分享。将其用于商业目的不在本许可证的涵盖范围内。评估测试工具（evaluation harness）是开源的（AGPL-3.0-or-later）。[谁可以使用本项目](https://champollion.dev/docs/getting-started/who-may-use-this) · [详情](#license)。

> **Champollion 的一部分** —— 旨在为所有语言提供可信赖的机器翻译评估基础设施，源码可用且可免费用于非商业用途（评估测试工具和共享注册表是开源的）。此 CLI 是一个更大项目的部署端，该项目构建测试集和映射图，以展示谁能翻译什么、每种方法在各类文本上的表现如何，以及目前仍存在哪些空白。它运行在两种基准测试上：基于开放数据的公共基准测试（覆盖面广、成本低、欢迎所有方法）和主权基准测试（sovereign benchmarks）—— 由社区创建、拥有和控制的秘密测试集，我们永远不会看到这些数据。该基础设施源码可用且由单一主体管理；针对某个社区语言的测试集和方法归该社区所有。专为与社区合作而设计，从不托管他们的语料库 —— 这种设计将控制权交到了他们手中。欢迎所有方法，无论是人工还是机器。在 [champollion.dev/docs/network](https://champollion.dev/docs/network/) 探索该网络。

## 为什么不自己写个脚本？

你可以写个简单的脚本，遍历英文键值并调用 Google Translate。大多数开发者都是这么做的 —— 大概只需要 30 行代码。但这种做法往往会出问题，原因如下：

- **无变更检测。** 当你更新一个英文字符串时，翻译会永远处于过时状态。Champollion 使用 SHA-256 哈希跟踪每个源值，并且只重新翻译发生变更的内容。
- **无批处理。** 每个键调用一次 API 意味着 200 个键 = 200 次往返请求。Champollion 会进行智能批处理（可配置，LLM 默认为 80 个键/批次，Google 默认为 128 个）。
- **无质量门禁。** 机器翻译会出现幻觉、原样返回源文本或输出错误的文字系统（script）。Champollion 在写入之前会检查每一条翻译 —— 空输出、源文本回显、重复循环、长度膨胀、内容丢失和错误的文字系统都会被捕获并拒绝。该门禁捕获的是损坏的输出，而不是错误的含义。
- **无格式感知。** 硬编码为 JSON？Champollion 支持 JSON、TOML、YAML 和 Hugo Markdown（前置元数据 + 正文），并具备自动检测功能。
- **无安全性。** Champollion 可防止原型污染、通过精心构造的区域设置代码（locale codes）进行的路径遍历，以及 Markdown 翻译过程中的代码块损坏。

Champollion 就是那个脚本的生产级版本。

> [!NOTE]
> **Champollion 翻译什么。** Champollion 针对的是**本地化文件和结构化内容** —— JSON 键值对、TOML/YAML 配置、Hugo Markdown 页面、XLIFF 交换文档。它针对正式的书面文本进行了优化：UI 字符串、文档、官方通信、教育材料。它不是聊天机器人、实时语音翻译器或通用对话 AI。对于每种语言对，翻译方法都是可配置的 —— 从商业 API（Google Translate、DeepL）到通过 [MT Eval Arena](https://champollion.dev/arena) 进行基准测试的社区开发插件。

## 快速开始

```bash
npm install --save-dev champollion
```

### 获取 API 密钥

Champollion 需要一个翻译后端。请选择一个：

| 提供商 | 密钥 | 最适用场景 |
|----------|-----|----------|
| **OpenRouter**（推荐） | `OPENROUTER_API_KEY` | 内容密集型项目、Markdown、200+ 模型 |
| **OpenAI** | `OPENAI_API_KEY` | 直接访问 GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | 直接访问 Claude |
| **Gemini** | `GEMINI_API_KEY` | 提供免费额度 |
| **DeepL** | `DEEPL_API_KEY` | 欧洲语言、术语表支持 |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130+ 语言、高吞吐量 |

**最快上手**（免费）：在 [aistudio.google.com](https://aistudio.google.com/apikey) 注册以获取免费的 Gemini 密钥：

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter**（200+ 模型）：在 [openrouter.ai](https://openrouter.ai) 注册，然后：

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

**Google Translate** 替代方案（仅限键值对 —— 不支持 Markdown 感知）：

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **注意**：如果仅设置了 `GOOGLE_TRANSLATE_API_KEY`，champollion 会自动切换到 Google Translate。无需更改配置。直接使用 REST API —— 无需 SDK，无需服务账号，无需 `pip install`。只需密钥即可。

就是这样。如需更多控制选项，请创建一个配置文件：

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

每种语言都带有**语域预设（register presets）** —— 针对其语言系统调整的预置语气/正式程度指令（例如法语的 vouvoiement，德语的 Siezen，日语的 です/ます，韩语的 해요체）。初始化向导允许你浏览并选择预设，或者传递 `--yes` 以接受默认设置。

### 非英语源语言

如果你的源语言不是英语：

```bash
champollion sync --source fr                      # CLI flag
```

或者在你的配置中永久设置：

```json
{ "inputLocale": "fr" }
```

## 它的功能

你负责处理 i18n 框架（next-intl、i18next、Hugo）。Champollion 负责处理翻译文件。

- **多格式** —— JSON、TOML、YAML、Hugo Markdown（前置元数据 + 正文）以及 XLIFF 1.2
- **增量式** —— 仅翻译发生变更的内容（SHA-256 哈希跟踪）
- **已缓存** —— 翻译记忆库（Translation Memory）存储先前的结果；对于未更改的键，重新运行同步不产生任何成本
- **质量门禁** —— 检查每条翻译是否存在损坏的输出：重复循环、错误的文字系统输出、源文本回显、长度膨胀和内容丢失（不检查含义）
- **内容感知** —— LLM 方法在 Markdown 翻译期间会保护代码块、短代码（shortcodes）、链接和插值变量
- **流水线工具** —— `lint`、`audit`、`integrity`、`seo` 用于 CI 门禁
- **XLIFF 互操作性** —— 导出翻译以便在 CAT 工具（memoQ、SDL Trados、Phrase）中进行专业审校，然后再将其导入回来
- **极简依赖** —— 两个运行时依赖项：`@translated/lara`（Lara 提供商 SDK）和 `cree-sro-syllabics`（ALTLab/NRC 的 Plains Cree SRO ⇄ 音节文字转换器）。需要 Node 20+

## 超越 Google Translate

快速开始指南能让你使用 LLM 或 Google Translate 运行起来。但 Google Translate 仅支持约 130 种语言。而世界上有超过 7,000 种语言。

**Champollion 的核心理念：翻译方法可按语言对（language pair）进行配置。** 对法语使用 Google Translate，对 Plains Cree 使用结合你自己的语法注释和词典进行指导的 LLM，对没有任何服务覆盖的语言使用你自己托管的 API —— 所有这些都在同一个项目中，全部使用同一个 CLI。

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

如果你能找到翻译某种语言对的方法 —— 无论是通过提示词工程、社区词典、FST 流水线，还是微调模型 —— champollion 都能让你将该方法打包为插件，并与其他所有内容一起部署。

> 诞生于将一个生产环境网站翻译成平原克里语（Plains Cree）的过程中，当时没有任何现成的 API 可用。这种按语言对配置的架构并非理论 —— 它的存在是因为一个项目需要同时使用 Google Translate 翻译法语，并使用经过指导的 FST 流水线翻译一种原住民语言，两者在同一个同步命令中并行运行。

配套的 [MT Eval Harness](https://github.com/gamedaysuits/Champollion) 允许你对翻译方法进行基准测试和比较，然后将有效的方法导出为 champollion 插件。任何会说这两种语言的人都可以开发、测试和分享翻译方法 —— 无需专有平台。

### 选择你的方法

Champollion 支持 10 种翻译方法。每种语言对都可以使用不同的方法。

**LLM 提供商** —— 质量最佳，支持 Markdown 感知，兼容指导（coaching）：

| 方法 | 键 | 功能说明 |
|--------|-----|-------------|
| `llm`（默认） | `OPENROUTER_API_KEY` | 通过 OpenRouter 调用 LLM —— 200+ 模型，自动路由 |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + 语法规则、词典、样式注释 |
| `openai` | `OPENAI_API_KEY` | 直连 OpenAI API（gpt-4o、gpt-4o-mini） |
| `anthropic` | `ANTHROPIC_API_KEY` | 直连 Anthropic API（Claude Sonnet、Haiku、Opus） |
| `gemini` | `GEMINI_API_KEY` | 直连 Google Gemini API（Flash、Pro）—— 提供免费额度 |
| `local` | *（无）* | 位于兼容 OpenAI 端点背后的自有模型（Ollama、vLLM、LM Studio，或使用 `nmt-forge` 训练的模型）。如果它不在 Ollama 的默认位置，请设置 `LOCAL_API_BASE`。文本永远不会离开你的基础设施 |

**传统机器翻译（MT）** —— 速度最快、成本最低，适合高吞吐量的键值对：

| 方法 | 密钥 | 功能说明 |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2（130+ 语言） |
| `deepl` | `DEEPL_API_KEY` | 支持术语表的 DeepL API（30+ 语言） |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator（100+ 语言） |
| `libretranslate` | *（自托管）* | 自托管的 LibreTranslate（AGPL，免费） |

**基础设施** —— 用于自定义或社区托管的端点：

| 方法 | 密钥 | 功能说明 |
|--------|-----|-------------|
| `api` | *（按提供商）* | 适用于任何 REST 端点的轻量级 HTTP 客户端 |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **注意**：传统机器翻译方法（Google Translate、DeepL、Microsoft Translator、LibreTranslate）能很好地处理键值对，但无法安全地翻译 Markdown 内容。对于内容密集型项目，推荐使用 LLM 方法 —— 它们会显式保护代码块、短代码和插值变量。

## 插件

插件是针对特定语言对的预打包翻译配方。它们是 JSON 清单（而非代码），用于告诉 champollion 使用哪种方法、采用什么设置，以及已经通过了何种质量基准测试。

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

有关清单（manifest）格式，请参阅[参考文档](https://champollion.dev/docs/reference/plugin-spec)。

## 命令

| 命令 | 用途 |
|---------|---------|
| `init` | 交互式设置向导（或使用 `--yes` 快速应用默认设置） |
| `sync` | 翻译并同步所有区域设置（locale）文件 |
| `serve` | 通过 HTTP 提供此项目的翻译技术栈（api-method 契约） |
| `watch` | 在文件更改时自动同步 |
| `audit` | 标记不完整的区域设置（CI 门禁） |
| `lint` | 在源代码中查找硬编码的字符串 |
| `status` | 显示语言对配置、方法、语域（registers）和插件基准测试 |
| `provenance` | 审计翻译资源的许可证 |
| `wrap` | 自动将硬编码字符串包装在 `t()` 调用中（支持撤销） |
| `seo` | 生成 hreflang、sitemap.xml 或 JSON-LD 模式 |
| `integrity` | 检查占位符损坏、编码和 ICU 复数完整性 |
| `plugin` | 安装、移除或列出方法插件 |
| `fonts` | 为 PUA 文字转换器下载 Web 字体 |
| `tm` | 管理翻译记忆库缓存（统计、清除、播种、修剪） |
| `xliff` | 导出/导入 XLIFF 1.2 以供专业译员审校 |
| `models` | 列出提供商的可用模型（`--method gemini`） |
| `verify` | 重新读取已写入的区域设置文件，并确认翻译存在且正确（CI 门禁） |
| `doctor` | 系统健康检查：卡片、配置、方法和转换器 |

与共享索引和排行榜（而非你的项目）配合使用的命令分组在 `champollion network` 下（每个命令也可以不带前缀使用）：

| 命令 | 用途 |
|---------|---------|
| `network card` | 格式化打印语言卡片（`network card <code>`，使用 `--json` 查看原始数据） |
| `network recommend` | 语言对的方法指南 —— 可用性 + 引用证据（`network recommend eng fra`、`--use`、`--json`） |
| `network leaderboard` | 显示机器翻译（MT）排行榜（`--pair`、`--sort`、`--install N`） |
| `network register-corpus` | 注册评估语料库：选择许可证 + 暴露层级（仅本地/私有/公开/密封） |
| `network seal-corpus` | 密封层级（Sealed-tier）加密动词：`keygen` / `seal` / `open`（组织者-节点桥接） |
| `network submit` | 提议一个索引条目（需经过审核门禁）—— 打印预先填写的 GitHub Issue |

运行 `champollion <command> --help` 获取任何命令的详细帮助。

完整参考：[参考文档](https://champollion.dev/docs/reference/cli)

### Pre-commit 门禁

`champollion lint` 专为提交门禁而构建：当发现硬编码的面向用户的字符串时，它会以 `1` 退出；当没有问题时，以 `0` 退出（`--warn-only` 仅报告而不阻塞）。将其接入项目中受版本控制的 hooks 目录：

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.5 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

或者通过 [lint-staged](https://github.com/lint-staged/lint-staged) 触发它，使其仅在源文件被暂存时运行：

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

不要将 `champollion sync` 放入 pre-commit 中 —— 它会进行网络 API 调用，因此最好的情况是速度很慢，最坏的情况是在离线时阻塞提交。请改在 CI 或 pre-push 钩子中运行它，并使用 `champollion audit` / `champollion verify` 作为门禁。

## 配置

创建 `champollion.config.json` 或运行 `champollion init`：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| 选项 | 默认值 | 描述 |
|--------|---------|-------------|
| `inputLocale` | `"en"` | 源语言代码 |
| `localesDir` | `"./locales"` | 区域设置文件路径：每种语言一个文件（`fr.json`）或每种语言一个文件夹（`fr/common.json`，i18next） |
| `localesPattern` | `null` | 任何其他布局，例如 `"src/i18n/{ns}/{lang}.json"`（替换 `localesDir`） |
| `contentDir` | `null` | 要翻译的 Markdown/MDX 文件夹（Hugo 的 `content/` 或任何文件夹）；每份翻译都会作为 `<name>.<locale>.md` 写入其源文件旁边 |
| `format` | `"auto"` | 文件格式：`json`、`toml`、`yaml` 或 `auto` |
| `model` | `"google/gemini-3.8-flash"` | 默认模型（OpenRouter slug）。直连提供商在运行时解析其自己的默认值。运行 `champollion models --method gemini` 以发现可用模型。 |
| `defaultMethod` | `"llm"` | 默认翻译方法（可被 `--method` 标志覆盖） |
| `batchSize` | `80` | 每个翻译批次的键数量 |
| `pairs` | `{}` | 按语言对覆盖的方法、模型和质量设置 |

**按语言覆盖**：每种语言都有一个[语言卡片（Language Card）](https://champollion.dev/docs/reference/language-card-spec) —— 50 个精心制作的卡片之一，包含语域预设、正式度系统、排版规则和方法支持标志。卡片采用[双层架构](https://champollion.dev/docs/concepts/architecture)（运行时 + 参考），以实现大规模性能。使用 `node scripts/generate-language-card.mjs <code>` 搭建新卡片。使用预设键作为简写，或编写自定义语域文本：

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**零配置模式**：没有配置文件？Champollion 会自动从你的项目中检测本地化文件、格式和目标语言。

语言值可以是预设键（例如 `"casual-tu"`）、自定义语域文本或对象（完全控制）。`pairs` 中的语言对级别覆盖优先于语言级别设置。运行 `npx champollion init` 浏览每种语言的可用预设。

有关特定框架的设置详情，请参阅 [CLI 参考](https://champollion.dev/docs/reference/cli)。

## CLI 输出

当你运行 `sync` 时，champollion 会准确显示正在发生的情况：

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

估算的最后一行指明了每个数字的定价费率、来源以及时间（`--json` 包含详细信息）。只有在将要发送内容时才会显示“Translating …”：如果是试运行（dry run），或者没有内容要发送的运行，则会显示正在检查区域设置。进度条会在每个批次完成时就地更新（每次更新约 80 个键）。当设置了 `contentDir` 时，同步操作会指明文件夹及其翻译的去向；只有当它找到真正的 Hugo 站点（`hugo.toml`、带有 Hugo 设置的 `config.toml`、`archetypes/` 等）时，才会显示 `Detected framework: Hugo`。格式检测会区分 `(auto)` 和 `(config)`，以阐明格式是如何解析的。

**输出模式**：`--quiet` 会抑制信息输出（仅显示错误和警告）。`--json` 会为 CI/CD 流水线输出机器可读的 NDJSON。

## 加固

- **指数退避** —— 在遇到 429/5xx 错误时进行 3 次带抖动（jitter）的重试
- **30 秒请求超时** —— AbortController 防止挂起
- **响应验证** —— 仅接受发送去翻译的键
- **质量把控** —— 捕获幻觉循环、错误的文字系统输出、长度异常膨胀以及直接返回原文
- **级联重试** —— 在 JSON 解析失败时，重试批次 → 半批次 → 单个键（通过 `maxRetries` 限制预算）
- **翻译记忆库** —— `.champollion/tm.json` 缓存以源文本 + 语言环境 + 方法为键的翻译；在后续同步中，未更改的键由缓存提供，从而消除冗余的 API 调用
- **提示词缓存** —— 系统/用户消息分离启用了提供商级别的缓存，降低了跨批次的 Token 成本
- **术语强制执行** —— 在 LLM 响应后，会根据词典术语验证经过指导的翻译
- **原型污染防护** —— 阻止 `__proto__`、`constructor`、`prototype`
- **路径限制** —— 验证文件写入操作，确保其保留在配置的目录内
- **块保护** —— 在内容翻译期间保护代码块、短代码和 HTML
- **显式报错架构** —— 翻译失败总是抛出带有可操作错误消息的异常，绝不会静默写入垃圾数据
- **同步后验证** —— `verify` 命令重新读取已写入的文件，并确认翻译存在、文字系统正确且占位符完好无损
- **部分成功** —— 一个失败的批次不会阻塞其余批次

## 测试

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**极简依赖** —— 见上文。

## 许可证

PolyForm Noncommercial 1.0.0。Champollion CLI 源码可用 —— 基于 [PolyForm Noncommercial License 1.0.0](../LICENSE) 协议，可免费安装、使用和修改以用于非商业目的（研究、教育、社区工作）；将其用于商业目的不在本许可证的涵盖范围内。简而言之，举例来说 —— 学校、公立医院或诊所、慈善机构、个人或研究项目都在涵盖范围内；而营利性企业的产品（例如商店的店面）则不在涵盖范围内：[谁可以使用本项目](https://champollion.dev/docs/getting-started/who-may-use-this)（仅为摘要，非法律建议；以许可证文本为准）。发布的 `champollion` npm 包采用 PolyForm-Noncommercial-1.0.0 协议；`cli/LICENSE` 是分发包的权威许可证。配套的机器翻译评估测试工具（MT Eval Harness）和规范是开源的，采用 AGPL-3.0-or-later 许可证 —— 带有 §7 eval-standard-plugin 例外条款 —— 位于公开的[测试工具仓库](https://github.com/gamedaysuits/Champollion)。
