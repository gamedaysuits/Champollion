---
sidebar_position: 1
slug: /intro
title: "介绍"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

一个完全可定制的国际化框架。一条命令翻译你的语言文件。一个配置控制每种方法、模型和语言对。如果内置方法还不够——构建你自己的，测试它是否有效，然后部署它。

```bash
npx champollion sync
```

champollion 会自动检测你的语言环境文件、格式和目标语言。它只翻译缺失的内容，跳过已完成的部分，检查每条结果是否存在异常输出，并写入整洁的翻译内容。这就是它的起点。

:::info[更大项目的一部分]

该 CLI 是 **Champollion** 的部署端——Champollion 是一套为无人评测的语言衡量机器翻译质量并公开发布评估结果的基础设施。评测端负责构建评估测试集，并公开绘制出一幅图景：谁能在何种文本类型上翻译什么语言、翻译表现如何；而该 CLI 则将这些经过验证的方法转化为真正可直接运行的工具。

有一条规则决定了一切：语言数据被视为生物数据（biodata），因此提供语料库的人掌握着语料库本身以及任何基于它进行评测的内容的控制权。完整的全貌——涵盖现有体系、核心规则以及你身处的位置——详见 [Champollion 是什么](/docs/what-is-champollion)，而评测端则归属于[网络](/docs/network/)。

:::

---

## 为什么不自己编写脚本呢？

你可以编写一个快速循环，对每个键调用 Google Translate。大多数开发者都这样做——大约需要 30 行代码。问题出现在这里：

- **无变更检测。** 更新英文字符串后——翻译永远处于过时状态。champollion 使用 SHA-256 哈希跟踪每个源文本值，仅重新翻译发生变更的内容。
- **无批处理。** 每个键对应一次 API 调用意味着 200 个键需要 200 次往返请求。champollion 能够智能批处理（可配置，LLM 默认每批 80 个键，Google 为 128 个键）。
- **无缓存。** 每次同步都会全量重新翻译。champollion 的翻译记忆库（Translation Memory）按源文本 + 语言环境 + 翻译方法缓存翻译结果——在更改单个键后重新运行同步，只会翻译该键，而不会重新翻译整个文件。
- **无质量门禁。** 机器翻译会出现幻觉、回显源文本或输出错误的文字系统。champollion 会在写入之前检查每条翻译——空输出、源文本回显、重复循环、长度膨胀、内容丢失以及错误文字都会被捕获并拒绝。该门禁拦截的是损坏的输出，而非错误的语义。
- **无格式感知。** 硬编码为 JSON？champollion 支持 JSON、TOML、YAML 以及 Hugo Markdown（frontmatter + 正文），并具备自动检测能力。
- **无方法控制。** 所有语言对都只能使用同一种方法。champollion 允许你在同一个配置文件中为法语使用 Google Translate、为日语使用 LLM，并为克里语使用社区托管的自定义流水线。

champollion 是该脚本的生产版本。

---

## 有什么不同

### 每种方法都是一个插件

翻译方法**可按语言对配置**。在同一项目中混合 Google Translate、LLM、指导提示和自定义 API：

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

法语使用 Google Translate（快速、经济）。日语使用优质的大语言模型（精准传达细微语感）。平原克里语（Plains Cree）则使用基于你提供的语法规则和词典进行指导的 LLM。相同的 `sync` 命令。相同的质量门禁。同一个 CLI。

### 看看什么有效

认为你的方法可以翻译英文到西班牙文？土耳其文到阿塞拜疆文？英文到 Cree？

**构建它并测试它。** 配套的[评估工具](/docs/network/specifications/harness)用可重现的、指纹识别的评分对任何翻译方法进行基准测试。[排行榜](/leaderboard)记录每个已发布的运行，所以每个人都可以看到什么有效。

评估工具和生产 CLI 共享相同的插件接口。在工具中评分良好的方法可以在生产中使用——如果该语言所服务的社区给予同意。对于土著语言和低资源语言，该同意很重要。参见[数据主权](/docs/network/sovereignty/data-sovereignty)。

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

# Use it locally
npx champollion sync
```

相同的插件。插入并测试。

### 完整工具包

champollion 不仅仅是 `sync`。它是一个完整的 i18n 管道：

| 命令 | 功能 |
|---------|-------------|
| `sync` | 翻译缺失和陈旧的键（带同步后验证） |
| `watch` | 源文件更改时自动同步 |
| `lint` | 扫描源代码中的硬编码字符串 |
| `wrap` | 自动将硬编码字符串包装在 `t()` 调用中 |
| `audit` | 列出来自先前运行的所有 `[EN]` 回退标记 |
| `verify` | 验证翻译存在且正确（CI 门） |
| `integrity` | 检测占位符损坏、编码问题和 ICU 复数完整性 |
| `seo` | 生成 hreflang 标签、站点地图和 JSON-LD 架构 |
| `status` | 显示语言对配置、插件和基准评分 |
| `provenance` | 审计翻译资源许可 |
| `plugin` | 安装、删除和列出方法插件 |
| `fonts` | 下载 PUA 文字转换器的网络字体 |
| `tm` | 管理翻译记忆缓存（统计、清除、按语言） |
| `xliff` | 导出/导入 XLIFF 1.2 供专业翻译人员审查 |

其中四个——`lint`、`sync`、`verify`、`audit`——形成一个 CI 管道，捕获硬编码字符串、翻译它们、验证正确性，如果任何语言不完整则使构建失败。

---

## 网络

[方法排行榜](/leaderboard)就是计分板——实时、公开且开放提交。每次提交都会与特定的 Git commit 进行指纹关联，对应到具体的数据集版本，并通过相同的评测框架进行评分。任何人都可以提交。

**你可以构建什么？** 工具接受 JSON。插件接受 JSON。任何产生 JSON 的方法都可以被测试：

| 方法 | 示例 |
|----------|---------|
| **指导 LLM** | 将语法规则和字典注入前沿模型的提示中 |
| **微调模型** | 在平行文本上训练开源模型——只是不在评估数据上 |
| **FST 门控管道** | LLM 生成 → 有限状态转换器验证形态 → 重试 |
| **链式模型** | 模型 A 草稿 → 模型 B 后编辑 → 模型 C 评分 |
| **字典 + LLM** | 强制来自字典的已知术语，让 LLM 处理其余部分 |
| **进化型** | 生成候选、评分、变异最佳、重复 |
| **部分翻译** | 手工翻译样本、证明你的 LLM 匹配、自动翻译其余部分 |

微调模型。部署进化算法。测试语言考试中的学生答案。构建查找表。将三个模型链接在一起。只要你的方法产生 JSON，工具就会对其评分，框架就会运行它。

:::danger[唯一的规则]
**不要在评估数据上训练。** 暴露于基准数据集的方法将被取消资格。在任何你想要的东西上微调。只是不要在测试集上。
:::

这是一个公开邀请。如果你使用低资源语言——作为研究人员、社区成员、学生或只是关心的人——构建一个方法、运行工具并为每个人加强网络。问题尚未解决。基础设施在这里，它是开源的。

**[→ 查看排行榜](/leaderboard)**

---

## 后续步骤

**入门：**
- [安装](/docs/getting-started/installation) — 2 分钟内设置
- [快速开始](/docs/getting-started/quick-start) — 运行你的第一次同步
- [支持的语言](/docs/reference/supported-languages) — 开箱即用的可用内容

**自定义你的设置：**
- [翻译方法](/docs/guides/translation-methods) — 为每个语言对选择正确的方法
- [翻译记忆](/docs/concepts/translation-memory) — 缓存如何为你节省成本
- [配置](/docs/getting-started/configuration) — 完整配置参考
- [Hugo 多语言网站](/docs/tutorials/hugo-multilingual-site) — Markdown 内容翻译

**深入了解：**
- [与专业译员协作](/docs/guides/professional-translators) — XLIFF 导出/导入工作流
- [数据主权](/docs/network/sovereignty/data-sovereignty) — 原住民数据主权原则：社区对语言数据的所有权与控制权
- [支持低资源语言](/docs/network/community/low-resource-languages) — 一切缘起的挑战
- [Cookbook：FST 门禁流水线](/docs/network/tutorials/fst-gated-pipeline) — 构建词法分解流水线
- [机器翻译评测](/docs/network/leaderboard/rules) — 评测框架与排行榜的运作机制
- [方法排行榜](/leaderboard) — 实时得分与提交
