---
sidebar_position: 9
title: "Agent Guide: Using champollion"
description: "AI agents 如何安装、配置和运行 champollion 来翻译 locale 文件。"
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# 代理指南：使用 champollion

champollion 是一个 CLI 工具，可以通过一条命令翻译你的应用的语言文件。本指南面向 AI 代理（或与 AI 代理合作的开发者），帮助你快速从零开始获得翻译后的语言文件。

:::tip[已经熟悉了？]
如果你只需要命令，跳转到 [CLI 参考](/docs/reference/cli)。如果你想构建和基准测试一个翻译方法，请参阅 [Network Agent Guide](/docs/network/getting-started/agent-guide)。
:::

---

## 环境设置

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**要求：**
- Node.js 20.11+（原生 ESM）
- 你的翻译提供商的 API 密钥

**API 密钥设置** — champollion 需要至少一个密钥，具体取决于你使用的方法：

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion 自动读取 `.env.local` 和 `.env`（优先级：`process.env` → `.env.local` → `.env`）。在 [openrouter.ai/keys](https://openrouter.ai/keys) 获取 OpenRouter 密钥。

---

## 首次同步

Champollion 自动检测你的区域设置文件、其格式（JSON、TOML 或 YAML）和你的目标语言：

```bash
npx champollion sync
```

**发生的过程：**
1. 加载 `champollion.config.json`（或自动检测设置）
2. 扫描源语言文件，展平嵌套键
3. 与 `.champollion.lock` 比较（先前翻译值的 SHA-256 哈希）
4. 检查 `.champollion/tm.json` 中的缓存翻译（翻译记忆库）
5. 通过配置的方法翻译**已更改、缺失或过期的键**
6. 对每个翻译运行质量门（5 项检查）
7. 将通过的翻译写入目标语言文件
8. 更新锁定文件和 TM 缓存

在更改一个键后的典型重新运行中，第 4 步从缓存提供 142 个键，第 5 步翻译 1 个键。这就是为什么后续同步速度快且成本低。

---

## 配置

在项目根目录创建 `champollion.config.json`：

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

配对键使用**冒号**（`en:fr`），而不是连字符 — 连字符保留用于区域语言代码，如 `es-MX`。

关键字段：

| 字段 | 用途 | 默认值 |
|-------|---------|---------|
| `inputLocale` | 源语言 | `en` |
| `languages` | 目标语言（数组或对象） | `[]` |
| `pairs` | 针对特定语言对的覆写（`"src:tgt"` 键）及方法配置 | 可选 |
| `localesDir` | 语言包文件所在位置 | `./locales` |
| `model` | 用于 `llm`/`llm-coached` 方法的 LLM 模型 | `google/gemini-3.8-flash` |
| `batchSize` | 单次 API 调用翻译的键数 | 80（LLM）；Google Translate 上限为 128 个分段/请求 |
| `jsonConcurrency` | JSON 键的并行语言环境翻译数 | 50 |
| `contentConcurrency` | 内容翻译的并行 API 调用数 | 48（Docusaurus 文档），12（`contentDir`） |

完整参考：[配置](/docs/getting-started/configuration)

---

## 翻译方法

| 方法 | 何时使用 | 成本 | 需要 API 密钥 |
|------|---------|------|-------------|
| **`llm`** | 通用，适合资源充足的语言 | 按令牌计费（取决于模型） | `OPENROUTER_API_KEY` |
| **`llm-coached`** | 当你有目标语言的语法规则/词典时 | 按令牌 + 指导上下文 | `OPENROUTER_API_KEY` |
| **`google-translate`** | 高资源语言，其中 GT 效果良好 | $20/百万字符 | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | 托管在 HTTP 端点后的自定义管道 | 服务器决定 | 无（端点处理身份验证） |
| **`plugin`** | 本地安装的预打包方法 | 变化 | 变化 |

详情：[翻译方法](/docs/guides/translation-methods)

---

## 教练数据

对于 `llm-coached` 对，指导数据用显式语言知识引导 LLM。创建一个指导文件：

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

在你的对配置中引用它：

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

质量门验证字典术语是否实际出现在输出中 — 违规被记录为 `[TERM]` 警告。

详情：[指导数据](/docs/concepts/coaching-data)

---

## 质量门

每个翻译在写入磁盘前都要通过五项自动检查：

| 检查项 | 捕获的问题 | 示例 |
|-------|----------------|---------|
| **空白/无内容** | 模型未返回任何内容 | `""` |
| **源语言回显** | 模型原样返回了英文输入 | 日语的 `"Welcome"` |
| **幻觉循环** | 重复的三元词组（trigram） | `"Qo' Qo' Qo' Qo'"` |
| **长度暴增** | 输出超过源文本长度的 4 倍（恰好 4 倍则通过） | 10 字符源文本 → 50 字符输出 |
| **文字系统合规性** | 目标语言环境使用了错误的文字系统 | 阿拉伯语语言环境出现拉丁文本 |

失败被记录为 `[GATE]` 前缀。没有静默回退 — 如果翻译失败，它会被报告，而不是被悄悄接受。

详情：[质量门](/docs/concepts/quality-gate)

---

## 翻译记忆库

Champollion 在 `.champollion/tm.json` 中缓存翻译，键为源文本 + 语言环境 + 方法。在后续同步中，未更改的键从缓存提供 — 无 API 调用，无成本。

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

要在一次运行中绕过缓存：`npx champollion sync --no-tm`

详情：[翻译记忆库](/docs/concepts/translation-memory)

---

## 生成的文件

Champollion 在你的项目中创建多个文件。了解它们是什么，这样你就不会意外删除或提交错误的文件：

| 文件 | 用途 | 是否纳入 Git？ |
|------|---------|------|
| `.champollion.lock` | 已翻译源文本值的 SHA-256 哈希（用于变更检测），加上各语言环境的记录：sync 写入的内容、redo 留待处理的键、拒绝后暂扣的键 | **是** — 提交此文件 |
| `.champollion-replaced-edits.jsonl` | sync 替换的手工编辑翻译及其原字句（仅在此情况发生时写入） | **是** — 提交此文件 |
| `.champollion-content.lock` | 同上，但针对 Markdown/MDX 内容文件 | **是** — 提交此文件 |
| `.champollion/` | 内部状态目录（`tm.json` 缓存、XLIFF 导出、备份） | **否** — 将其加入 gitignore；`tm.json` 是本地缓存（参见[配置](/docs/getting-started/configuration)） |
| 您编写的指引文件（例如 `coaching/fr.json`） | 您的语言知识储备 | **是** — 提交这些文件 |
| `champollion.config.json` | 项目配置 | **是** — 提交此文件 |

---

## 常见模式

**翻译所有已配置的语言对：**
```bash
npx champollion sync
```
Champollion 会并行翻译所有语言环境。借助翻译记忆库（TM）缓存，只有变更的键才会调用 API（未变更的语言对直接从缓存提供，因此全量同步的成本很低）。

**仅翻译特定语言对：**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` 将本次运行限制在指定的语言对；就绪检查和费用预算仅适用于这些语言对。指定未包含在已配置语言对图中的语言对将明确报错并列出已配置的语言对列表——绝不会静默跳过。

**如何书写语言对。** 项目语言对的写法与 `champollion.config.json` 的键相同，即 `en:fr`。`sync`、`verify` 和 `serve` 也可以读取 `en>fr` 和 `en-fr`，并且 `en-pt-BR` 会与您配置的语言对进行匹配。网络命令（`network register-corpus`、`leaderboard`、`recommend`、`submit`）将语言对写作 `eng>crk`（排行榜存储的格式），并且以相同方式读取 `eng-crk` 和 `eng:crk`。在这些命令中，仅含连字符的语言对必须是由两个或三个字母构成的两个代码（`eng-crk`）。自身带有连字符的代码需要使用 `>`：`--pair "eng>pt-BR"`。`eng-pt-BR` 也可能表示 `eng-pt` 和 `BR`，因此会被拒绝，绝不进行猜测。在终端 shell 中，请给 `>` 格式加上引号：`--pair "eng>crk"`。如果不加引号，shell 会将输出重定向到名为 `crk` 的文件中。

**内容模式（Markdown/MDX 文件夹：Hugo 的 `content/` 或任何文件夹；Docusaurus 文档无需指定即可自动找到）：**
```bash
npx champollion sync --content-dir ./content
```
在翻译语言包 JSON 的同时翻译文档、博文和内容文件。每个翻译文件都会以 `<name>.<locale>.md` 的命名保存在源文件旁；当源文件在其他地方变更时，审校人员对其所做的编辑将予以保留（[内容翻译](/docs/guides/content-translation#reviewing-and-editing-translations)）。内容翻译并行运行；可通过 `--content-concurrency` 进行调节。

**干运行（预览而不写入）：**
```bash
npx champollion sync --dry-run
```

**强制重新翻译特定键：**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**重新处理所有内容文件（复用已缓存文本，因此未更改的文本不产生费用）：**
```bash
npx champollion sync --force-content
```

**全新翻译特定内容文件（计费），或限制仅在部分文件上运行：**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**机器可读运行：** `--json` 每行输出一个 JSON 对象（NDJSON），每个对象都包含一个 `level`：标准输出（stdout）包含 `info` 和 `ok` 消息、`event` 记录（`"event": "cost"`——预估值，位于 `--max-cost` 门禁之前——以及每个内容文件和语言环境对应的一条 `"event": "file"`），最后是收尾的 `{"level": "summary", "command": "sync", …}`；标准错误（stderr）包含 `warn` 和 `error` 行，同样为 JSON。请通过其级别（level）筛选摘要，切勿仅凭行位置筛选：`npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`。退出代码 `2` 表示部分完成（完成了一部分工作，但有部分失败）。

在预估（`cost` 事件以及摘要中的 `costEstimate`）中，只要有任何部分没有已知价格，`totalEstimatedCost` 即为 `null`——绝不会是部分求和，也绝不会用 `0` 代表未知；`knownEstimatedCost` 包含已定价的部分，`unknownCost.reason` 列出没有价格的语言对，而 `unknownCost.notes` 说明缺少价格的项目及原因——`{ subject, pairs, note }`，例如 OpenRouter 列表中不存在的模型名称（很可能是拼写错误，并会附上最接近的列出名称）、列表中没有每 token 单价的模型，或是无法读取的价格列表。本机上的模型（位于 `localhost`/`127.0.0.1`/`::1` 的 `local` 或 `api` 端点）定价为 `0`，带有 `"local": true`。摘要中的 `sentToModel` 统计本次运行中发送给翻译方法的键数（`tmHits`：直接从缓存提供）。试运行（dry run）的摘要包含 `preflight: { ready, failures }`——`ready: false` 意味着实际运行会停止并以 `1` 退出（缺少密钥，或运行所需的模型服务器未响应），尽管试运行本身退出代码为 `0`（[退出代码](/docs/reference/cli#sync-exit-codes)）。在带有 `--max-cost` 时，它还会包含 `maxCost: { cap, estimatedCost, wouldStop }`——`wouldStop: true`（附带 `exitCode: 2` 和 `reason`）意味着实际运行会在发起任何 API 调用之前因达到上限而停止。`realRun: { exitCode, wouldStop, reasons }` 是根据预览能判断出的实际运行最终退出代码：包括预检（preflight）和费用上限，再加上会导致部分完成的情况——暂扣的键、磁盘上缺少目标语言所用复数形式且不会再次请求的复数消息（统计在试运行的 `totalPluralGaps` 中）。试运行不会验证任何内容（`verify: { "ran": false }`）。请使用实际运行的 `--method`/`--model` 执行试运行：如果不加这些参数，它将检查配置中指定的方法。

**检查翻译状态：**
```bash
npx champollion status
```
显示每个语言对的方法、模型、覆盖率和插件信息（仅在配置中设置时才显示 `qualityTier`——这是一个标签，而非度量值）。

**审计未翻译的回退：**
```bash
npx champollion audit
```
列出所有需要翻译的 `[EN]` 回退值。

---

## 故障排除

| 问题 | 解决方法 |
|---------|-----|
| `OPENROUTER_API_KEY not set` | 导出该密钥或将其添加到项目根目录的 `.env` 中 |
| `No locale files found` | 在配置中设置 `localesDir`，或确保您的语言包文件符合标准命名规范（`en.json`、`fr.json`） |
| `[GATE] Script compliance failed` | 目标语言环境收到了拉丁文本而非预期的文字系统——请尝试使用其他模型或添加指引数据 |
| `[GATE] Source echo` | 模型原样返回了英文——添加指引数据或换用其他模型通常可以解决此问题 |
| 所有翻译均已缓存 | 携带 `--no-tm` 运行以绕过缓存，或针对特定键使用 `--force-keys` |
| 锁定文件冲突 | `.champollion.lock` 保存哈希值——合并冲突可以安全解决：保留任意一版的版本，然后重新运行 sync。保留另一侧的分语言环境记录可能会导致少量值被识别为手工编辑（随后的批量 redo 会保留并指明它们；`--redo keys:` 会替换单个值）——绝不会反过来 |
| 键被“暂扣” | 质量门禁此前拒绝了该模型的回答；普通的 sync 不会重新发送它（否则会为相同的回答计费）。`champollion sync --redo keys:<key>` 会重新请求；或者添加 `fallback`，在 `noTranslate` 中列出它，或者手动编写翻译 |

---

## 接下来

- [快速开始](/docs/getting-started/quick-start) — 完整的入门演练
- [CLI 参考](/docs/reference/cli) — 每个命令和标志
- [工作原理](/docs/how-it-works) — 同步管道解释
- [评估工具桥接](/docs/guides/bridge) — champollion 如何连接到 Network
- **想构建自己的翻译方法？** 请参阅 [Network 代理指南](/docs/network/getting-started/agent-guide) — 构建方法，在公共排行榜上证明其有效性，如果/当奖项开放时竞争奖项（奖项是计划中的机制 — 请参阅 [诚实的局限性](/docs/network/honest-limitations)）。
