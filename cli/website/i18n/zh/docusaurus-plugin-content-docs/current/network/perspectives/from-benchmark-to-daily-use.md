---
sidebar_position: 3
title: "从基准测试到日常使用：后期编辑路径"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "如何将经过基准测试的翻译方法转化为社区翻译工作流：机器初稿、流利使用者后期编辑、发布文本——每一步都有明确的质量阈值。"
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The quality thresholds behind the path"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# 从基准测试到日常使用：后编辑路径

> **简短版本。** 排行榜分数不是产品。从"这个方法得分 0.78"到"部落办公室每周用该语言发布文件"的路径只经过一个工作流：机器生成草稿，流利使用者修正它，只有修正后的文本才会发布。我们规范中的每个质量阈值都是针对该工作流校准的——而不是针对无监督的机器输出，我们不认可在本平台上对任何语言使用无监督输出。

人们有时会问翻译方法何时才会"好到可以直接使用"。对于本网络服务的语言，这个问题中存在陷阱。诚实的答案是，值得追求的标准不是"好到可以不经审查就发布"——而是**"好到审查草稿比从零开始翻译更快。"** 这个标准要低得多，是可衡量的，跨越它会改变社区翻译办公室一周内能产出的内容。

---

## 端到端的工作流

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

需要注意三点：

1. **机器永远不发布。** 输出单位是草稿。使用者的修正过程不是事后附加的质量保证——它就是工作流。
2. **使用者的时间是被优化的资源。** 一个方法比另一个方法更好，恰好在于它让使用者需要修正的内容更少。针对资源充足的语言的后编辑研究一致发现，在中等机器翻译质量下，后编辑比从零开始翻译更快（Plitt & Masselot 2010；Green, Heer & Manning 2013，两者都在[翻译不是复兴](/docs/network/perspectives/translation-is-not-revitalization)中引用并附有链接）。这是否适用于多综合语言正是基准测试存在的目的——我们将其视为每种语言需要验证的假设，而不是假定。
3. **反馈循环由社区拥有。** 每份修正的文件都是潜在的训练和指导数据——它属于社区，可根据[数据主权](/docs/network/sovereignty/data-sovereignty)规则选择是否反馈。反馈机制是平台的设计目标，但尚未成为内置功能；参见[报告错误和拥有修正](/docs/network/perspectives/reporting-errors-and-owning-corrections)了解修正和来源如何工作。

## 质量等级对实际使用的含义

排行榜根据自动化指标的组合对方法进行评分（[评分规范](/docs/network/specifications/scoring)），分数映射到命名等级。以下是这些等级对日常使用术语的诚实翻译：

| 等级（组合） | 对后编辑路径的含义 |
|---|---|
| **基础** (0.00–0.30) | 任何用途都不可用。输出基本不是目标语言。仅作为研究基线有用。 |
| **新兴** (0.30–0.50) | 仍不是草稿工具。出现正确的片段，但使用者花在修正上的时间会比重新写作更多。 |
| **功能性** (0.50–0.70) | 后编辑*可能*对简单文本比从零开始翻译更快的第一个等级——值得与使用者试点，但不值得依赖。仍存在频繁的形态错误。 |
| **可部署** (0.70–0.85) | 上述工作流的目标等级：大多数形态正确的草稿，流利使用者可以比重新翻译更快地修正。**"可部署"意味着可部署*到后编辑工作流中*——永远不是"不经审查就发布。"** |
| **流利** (0.85–1.00) | 接近有能力的人工翻译；错误罕见且轻微。审查过程仍然存在——只是速度更快。 |

两条结构性诚实规则位于此表之上，直接来自[基准规范 §5 和 §7](/docs/network/specifications/benchmark#5-quality-tiers)：

- **自动化等级是临时标签，不是判决。** 它们是提名供人工审查。随着使用者验证数据的积累，阈值将被重新校准，对不同语言可能有不同的结果。
- **没有方法可以声称可部署或更高等级而没有社区审查。** 其输出的分层样本提交给双语使用者，他们对每个翻译进行评分：*拒绝 / 要点 / 可接受 / 优秀*。治理组织——而不是排行榜——决定该方法是否晋级。

作为比较，[创始人奖](/docs/network/specifications/prizes)阈值（组合 ≥ 0.80，≥99% 形态有效词，≥70% 使用者评分可接受或更好）描述了一个方法，其剩余错误是*真实语言错误*——错误的屈折，而不是虚构的词。这就是"值得使用者时间的草稿"在数字上的样子。

## 从获胜方法到运作办公室

假设一个方法通过了这些关卡。剩余的步骤是组织性的，是规范而不是即兴的：

1. **所有权转移。** 该方法的代码成为社区治理组织的财产——开发者保留署名和发布权（[所有权转移](/docs/network/sovereignty/ownership-transfer)）。
2. **该方法成为服务——社区的服务。** 它被打包为插件，治理组织可以在自己的基础设施上运行，控制访问和允许的使用（[部署到生产环境](/docs/network/getting-started/deploy-to-production)）。如果社区选择商业化提供，那是它的业务——Champollion 不参与分享（[工作如何获得资金](/docs/network/sovereignty/economic-model)）。
3. **翻译者将其插入他们的日常工作。** 翻译办公室将其现有文件工作流指向该方法的 API：源文本输入，草稿输出，后编辑，发布。发布的文本带有翻译者的名字和权威——机器是他们桌上的工具，就像字典一样。

## 目前的进展

坦白说：完整路径已端到端规范，部分已构建。评估工具、指标、运行卡和公共排行榜存在；Plains Cree 开发语料库和活跃的奖项存在；部署平台存在。社区审查界面、评估沙箱和修正文本反馈循环已规范但尚未运作——规范将其标记为计划中，我们也是如此。还没有任何方法完成从基准测试到日常社区使用的整个旅程。这个旅程是项目成功的定义，这正是我们不会提前声称它的原因。

---

## 这对你意味着什么

:::info[如果你是社区成员]
排行榜上的"可部署"徽章永远不意味着机器将在你的语言中无监督地发布——它意味着草稿生成器可能已准备好向你的翻译人员进行*试用*，按照你的条件，由你的使用者作为评判（付费的——见[说话者如何获得报酬](/docs/network/perspectives/how-speakers-get-paid)）。如果你的社区运营翻译办公室，向我们提出的相关问题应该是："试点会是什么样的，谁来审查输出？"
:::

:::info[如果你是研究人员]
后编辑框架改变了什么值得测量：有说话者参与的可接受文本的时间成本，而不仅仅是综合评分。网络的指标是这一点的代理（[评分规范 §1](/docs/network/specifications/scoring)），针对形态复杂语言的逐语言后编辑研究是这一基础设施设计用来支持的开放研究空白。
:::

:::info[如果你是开发者]
为编辑器优化，而不是为指标优化。产生真实词汇但偶尔有错误屈折的方法可以在几秒内被说话者修复；产生看似合理的形式的方法会毒害整个工作流——这就是为什么形态有效性在这里被严格把控。从[提交方法](/docs/network/getting-started/submit-a-method)开始，阅读[方法接口](/docs/network/specifications/methods)了解如果你赢了最终要交付的内容。
:::

## 另见

- [翻译不是复兴](/docs/network/perspectives/translation-is-not-revitalization)——为什么人工关卡是重点，而不是限制
- [报告错误和拥有修正](/docs/network/perspectives/reporting-errors-and-owning-corrections)——当发布的文本仍然错误时会发生什么
- [基准规范 §7](/docs/network/specifications/benchmark#7-human-validation)——人工验证关卡，正式版本
