---
sidebar_position: 2
title: "翻译 30 种语言"
description: "Cookbook：使用按语言对方法混合、批处理和 CI 集成，将项目从 3 种语言扩展到 30 种语言。"
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# 食谱：翻译 30 种语言

将项目从少数几个语言环境扩展到全球覆盖。本食谱介绍了真实多语言部署中的方法选择、成本优化和 CI 集成。

**场景：** 您有一个 SaaS 应用程序，包含 `en`、`fr`、`es`。您需要添加 27 种语言，跨越三个质量要求层级。

---

## 第 1 步：对语言进行分类

并非所有 30 种语言都需要相同的方法。按可用方法质量对它们进行分组：

| 层级 | 语言 | 方法 | 原因 |
|------|-----------|--------|-----|
| **第 1 层 — 高级** | `ja`、`ko`、`zh`、`de`、`pt` | `llm` (GPT-4o) | 高价值市场，语法细微差别 |
| **第 2 层 — 标准** | `it`、`nl`、`pl`、`sv`、`da`、`fi`、`no`、`cs`、`ro`、`hu`、`el`、`tr`、`id`、`ms`、`th`、`vi`、`uk`、`bg` | `google-translate` | 高容量，Google 支持良好 |
| **第 3 层 — 指导** | `crk`、`oj`、`mi`、`haw` | `llm-coached` + 插件 | 低资源，需要术语强制执行 |

## 第 2 步：按语言对配置

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**注意：** 未在 `pairs` 中列出的语言继承 `defaultMethod: "google-translate"`。您无需列出全部 30 种。

:::info
`crk` 支持正在开发中 — 请参阅[支持低资源语言](/docs/network/community/low-resource-languages)了解状态和贡献指南。
:::

## 第 3 步：设置 API 密钥

此配置需要两个 API 密钥：

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## 第 4 步：先进行试运行

在翻译 30 种语言之前始终预览：

```bash
npx champollion sync --dry
```

查看输出。它将显示：
- 哪些语言对使用哪种方法
- 每个语言环境有多少新增/更改的密钥
- 每个层级的估计 API 调用次数

## 第 5 步：运行同步

```bash
npx champollion sync
```

Champollion 独立处理每个语言对。使用 Google Translate 的第 2 层语言对将很快。第 1 层 LLM 语言对会更慢，但质量更高。第 3 层指导语言对使用插件的指导数据。

### 增量更新

初始同步后，后续运行仅翻译**更改或新增**的密钥：

```bash
# Only keys that changed since last sync
npx champollion sync
```

锁定文件（`.champollion.lock`）跟踪已翻译的内容，因此您永远不会重新翻译稳定内容。

## 第 6 步：审计质量

检查所有语言对的状态：

```bash
npx champollion status
```

这输出一个表格，显示每个语言对的方法、模型、质量层级，以及是否有可用的指导数据或基准分数。

### 输出是否尊重了您的语言风格？

在第 2 步中，您为每种语言声明了一个[语言风格](/glossary#term-register) — 日语为 `"Polite/formal"`，德语为 `"Formal (Sie)"`。（对这个术语不熟悉？词汇表用通俗语言解释了它。）这些指令进入翻译提示，但提示是请求，不是保证。

[Network 工具](/docs/network/specifications/harness) — 为公共排行榜提供支持的同一工具 — 可以在翻译样本上测量语言风格和风格一致性。其写作风格指标根据预期的语言风格（正式/非正式标记、T–V 代词、缩写、句子长度漂移）检查每个输出，并报告运行中的 `style_consistency_rate`。您也可以使用 `--style-profile` 指向自定义品牌语音配置文件。

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

两个诚实的警告：这些指标是**信息性的**（它们永远不会进入排行榜的综合分数），正式性检测是基于标记的 — 是漂移检测器，而不是人类判断。详情和指标定义：[写作风格和语言风格指标](/docs/network/specifications/harness#writing-style-and-register-metrics-informational)。

## 第 7 步：CI 集成

添加到您的 GitHub Actions 工作流，以便在每次推送时保持翻译最新：

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## 成本估计

对于包含 500 个源密钥跨 30 种语言的项目：

| 层级 | 语言 | 方法 | 大约成本 |
|------|-----------|--------|-----------------|
| 第 1 层 (5 种语言) | ja、ko、zh、de、pt | GPT-4o | ~$2.50/完整同步 |
| 第 2 层 (18 种语言) | it、nl、pl 等 | Google Translate | ~$0.90/完整同步 |
| 第 3 层 (4 种语言) | crk、oj、mi、haw | GPT-4o-mini 指导 | ~$0.40/完整同步 |
| **总计** | **30 种语言** | **混合** | **~$3.80/完整同步** |

增量同步（5–20 个更改的密钥）成本仅为完整同步的一小部分。

## 另请参阅

- [翻译方法](/docs/guides/translation-methods) — 每种翻译方法的工作原理及使用时机
- [插件规范](/docs/reference/plugin-spec) — 为任何第 3 层语言创建指导数据
- [CI/CD 指南](/docs/guides/ci-cd) — 高级 CI 模式，包括 PR 预览构建
- [质量门](/docs/concepts/quality-gate) — Champollion 如何在写入前验证每个翻译
- [支持的语言](/docs/reference/supported-languages) — 完整的语言代码列表和方法兼容性
- [写作风格和语言风格指标](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — 使用评估工具测量语言风格/风格一致性（信息性指标）
- [词汇表：语言风格](/glossary#term-register) — 用通俗语言解释"语言风格"的含义
- [支持低资源语言](/docs/network/community/low-resource-languages) — 为没有广泛机器翻译覆盖的语言添加指导数据
