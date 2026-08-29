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

champollion 自动检测你的语言文件、格式和目标语言。它翻译缺失的内容，跳过已完成的部分，验证每个结果，并输出干净的文件。这是起点。

:::info[更大项目的一部分]

此 CLI 是 **Champollion** 的部署端——该基础设施专门评估其他无人评估的语言的机器翻译质量，并公开发布其发现。评估端构建了评估测试集，并绘制了一份公开图谱，展示谁能翻译什么、翻译质量如何，以及适用于哪种类型的文本；而 CLI 则是将经过验证的方法转化为你可以实际运行的工具的地方。

有一条规则决定了一切：语言数据被视为生物数据，因此，提供语料库的人掌握着该语料库以及任何基于其进行评估的内容的控制权。全貌——存在什么、规则是什么、你的定位在哪里——详见 [什么是 Champollion](/docs/what-is-champollion)，而评估端的内容则位于 [网络](/docs/network/) 之下。

:::

---

## 为什么不自己编写脚本呢？

你可以编写一个快速循环，对每个键调用 Google Translate。大多数开发者都这样做——大约需要 30 行代码。问题出现在这里：

- **没有变更检测。** 更新一个英文字符串——翻译永远保持陈旧。champollion 用 SHA-256 哈希跟踪每个源值，仅重新翻译已更改的内容。
- **没有批处理。** 每个键一个 API 调用意味着 200 个键 = 200 次往返。champollion 智能批处理（可配置，LLM 默认 80 个键/批，Google 默认 128 个）。
- **没有缓存。** 每次同步都重新翻译所有内容。champollion 的翻译记忆按源文本 + 语言 + 方法缓存翻译——在一个键更改后重新运行同步仅翻译该键，而不是整个文件。
- **没有质量门。** 机器翻译会产生幻觉、回显源文本或输出错误的文字。champollion 在写入前验证每个翻译——错误的文字、长度膨胀和源回显都会被捕获并拒绝。
- **没有格式感知。** 硬编码为 JSON？champollion 处理 JSON、TOML、YAML 和 Hugo Markdown（frontmatter + body），具有自动检测功能。
- **没有方法控制。** 每个语言对都使用相同的方法。champollion 让你对法语使用 Google Translate，对日语使用 LLM，对 Cree 使用自定义社区托管管道——在同一个配置文件中。

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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

法语使用 Google Translate（快速、便宜）。日语使用高级 LLM（细致入微）。Plains Cree 使用带有语法规则、字典和形态验证的指导插件。相同的 `sync` 命令。相同的质量门。相同的 CLI。

### 看看什么有效

认为你的方法可以翻译英文到西班牙文？土耳其文到阿塞拜疆文？英文到 Cree？

**构建它并测试它。** 配套的[评估工具](/docs/network/specifications/harness)用可重现的、指纹识别的评分对任何翻译方法进行基准测试。[排行榜](/leaderboard)记录每个已发布的运行，所以每个人都可以看到什么有效。

评估工具和生产 CLI 共享相同的插件接口。在工具中评分良好的方法可以在生产中使用——如果该语言所服务的社区给予同意。对于土著语言和低资源语言，该同意很重要。参见[数据主权](/docs/network/sovereignty/data-sovereignty)。

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

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

[方法排行榜](/leaderboard) 就是计分板——实时、公开，并开放提交。每次提交都会通过指纹绑定到一个 Git 提交（commit），与特定数据集进行版本关联，并由同一个测试框架（harness）进行评分。任何人都可以提交。

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
- [与专业译者合作](/docs/guides/professional-translators) —— XLIFF 导出/导入工作流
- [数据主权](/docs/network/sovereignty/data-sovereignty) —— 原住民数据主权原则：语言数据由社区拥有和控制
- [支持低资源语言](/docs/network/community/low-resource-languages) —— 开启这一切的挑战
- [实战指南：FST 门控流水线](/docs/network/tutorials/fst-gated-pipeline) —— 构建分解流水线
- [机器翻译评估](/docs/network/leaderboard/rules) —— 测试框架和排行榜的工作原理
- [方法排行榜](/leaderboard) —— 实时分数与提交
