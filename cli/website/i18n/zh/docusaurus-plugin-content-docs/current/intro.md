---
sidebar_position: 1
slug: /intro
title: "应用与网站翻译"
description: "使用 `champollion sync` 翻译应用或网站自身文件的参考文档：介绍其功能、适用场景以及所有相关页面的指南。"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# 应用与网站翻译

`champollion sync` 让应用或网站的翻译与源语言保持同步。它会读取你的语言区域文件（或 Markdown 页面），查找缺失或过期的内容，仅翻译这部分内容，检查每个结果，并按文件本身的格式写回。

```bash
npx champollion sync
```

本节是该流程的参考文档。如果你想先阅读通俗浅显的说明，请参阅[翻译应用或网站](/docs/translate-an-app-or-website)。

## `sync` 的工作原理

1. **查找你的文件。** 它会检测语言区域文件夹和格式（JSON、TOML、YAML、gettext PO、Flutter ARB），或包含 Markdown/MDX 页面的文件夹（Hugo、Docusaurus，或你用 `--content-dir` 指定的任意文件夹）。
2. **计算出变更内容。** 每个源语言值都会通过其 SHA-256 哈希值记录在 `.champollion.lock` 中。缺失、为空或源文本已变更的键会被加入队列；其余内容则保持不变。
3. **使用你为每种语言对选择的方法进行翻译。** 一个配置文件可以将一个语言对发送给 LLM，另一个发送给机器翻译 API，第三个发送给你自行训练并托管的模型。LLM 方法默认以 temperature 0 进行翻译（`shared/model-defaults.json` 中唯一的默认值）；托管模型在不同运行之间仍可能略有差异，这也是翻译记忆库保留已有结果的原因之一。
4. **复用已付费的内容。** 翻译记忆库会按源文本、语言区域和方法缓存每次翻译：再次出现的文本（改回先前的字符串、另一个文件中的相同句子、重新执行）均为免费。
5. **在写入前检查每个结果。** 质量门禁会拒绝空输出、照抄源文本、重复循环、文字系统错误输出、损坏的占位符以及类似的破损情况，并提供一次反馈重试。它拦截的是破损输出，而非语义错误。
6. **写入后进行校验。** 同步后的阶段会重新读取已写入的文件，并检查键的一致性、空值、文字系统和占位符；`champollion verify` 和 `champollion audit` 作为 CI 门禁运行同类检查。

任何内容都不会静默写入。在重试后门禁仍拒绝的键将保持未翻译状态并报错，同步流程以 `2` 退出。该拒绝会被记住，因此下一次普通同步不会就相同的答案再次向同一个模型付费：你可以使用 `--redo` 重新请求，为该语言对添加 `fallback` 方法，或者手动填写该值。

## 何时使用

- 你的应用或网站的文本存储在语言区域文件或 Markdown 中，并且你希望随着源语言的变更，其他语言能够保持同步更新。
- 你希望在一个项目中为不同的语言对使用不同的翻译方法，同时支出受限（`--max-cost`）且在产生账单前完全可见（`--dry`）。
- 你基于该流程构建了翻译器，并希望应用能够使用它：`champollion connect` 将托管的模型接入应用项目，随后 `sync` 使用它进行翻译。基于仅限本地数据训练的模型，只有在数据所有者同意时才会接入。

`sync` 并非用于为尚无服务良好支持的语言构建翻译器。如需构建翻译器，请从[启动项目](/docs/start)开始。

## 本节包含的页面

**入门**

- [快速入门](/docs/getting-started/quick-start) — 数分钟内完成首次同步。
- [安装](/docs/getting-started/installation) — 依赖要求、API 密钥与许可证。
- [配置](/docs/getting-started/configuration) — `champollion.config.json` 中的每个字段、各个语言对的设置、语言区域布局以及回退机制。

**框架与流水线**

- [框架集成](/docs/integrations/frameworks) — Hugo、next-intl、react-i18next、Flutter 以及配合 gettext 的 Django。
- [CI/CD](/docs/guides/ci-cd) — 将 `lint`、`sync`、`verify` 和 `audit` 作为门禁。
- [内容翻译](/docs/guides/content-translation) — Markdown 与 MDX 页面、front matter 以及保留的内容。

**选择翻译方式**

- [翻译方法](/docs/guides/translation-methods) — 每种方法、其配置键以及适用场景。
- [辅导数据](/docs/concepts/coaching-data) — 在每次请求中随附给 LLM 的语法说明和词汇表。
- [文字转换器](/docs/concepts/script-converters)与[人造语言、文字系统与正字法](/docs/guides/conlangs-scripts-orthography) — 书写系统、字体与人造语言。

**内部工作原理**

- [同步工作原理](/docs/concepts/how-sync-works) — 逐步拆解流水线。
- [翻译记忆库](/docs/concepts/translation-memory) — 缓存机制及其索引键。
- [质量门禁](/docs/concepts/quality-gate) — 每项检查，以及被拒绝的键或块的处理方式。
- [安全](/docs/concepts/security) — 特制的键与路径、受保护的代码块以及明确报错（failing loudly）。

**人员与问题**

- [与专业译员协作](/docs/guides/professional-translators) — 用于审校的 XLIFF 导出与导入。
- [故障排查](/docs/guides/troubleshooting) — 常见错误及解决办法。

所有命令和参数均可在 [CLI 参考](/docs/reference/cli)中找到，方法插件格式参见[插件规范](/docs/reference/plugin-spec)。

## 许可证

`champollion` CLI 在 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) 下源码可用（source-available）；[谁可以使用](/docs/getting-started/who-may-use-this)说明了适用范围。
遇到问题，或需要为你的项目寻求帮助？[与我们交流](/docs/getting-help)。
