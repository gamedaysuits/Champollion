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
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# 从基准测试到日常使用：后编辑路径

> **简而言之**：排行榜得分不是产品。从“该方法测得 chrF++ 47.5”到“部落办公室每周用本族语言发布文档”，中间只贯穿一条工作流：机器生成初稿，流利说话者进行校对，唯有校对后的文本才会被发布。我们规范中的每一个质量阈值都是针对这一工作流进行校准的——而非针对无监督机器输出，我们在本平台上不支持对任何语言采用无监督输出。

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

## 排行榜得分能说明什么，不能说明什么

排行榜遵循机器翻译领域的标准方法进行排名：基于语料库级别的 **chrF++**（0–100）及其 95% 置信区间和 sacreBLEU 签名，同时辅以 BLEU、spBLEU、TER 和 COMET 指标，并单独报告 FST 接受率等诊断指标（[评分规范](/docs/network/specifications/scoring#how-runs-are-scored)）。在同一个评测集上某种方法是否优于另一种方法，由配对显著性检验决定，而不是仅凭肉眼比对两个数字（[显著性检验](/docs/network/specifications/significance)）。

这能向社区说明的是：哪些方法生成的输出更接近可信的参考翻译，以及两种方法之间的差距是否真实存在。它不能说明的是：初稿是否值得说话者花时间审阅。相同的 chrF++ 数值对于不同的语言和评测集含义各不相同，因此这里的自动评分均不带有质量评级标签。Network 过去曾将加权综合得分映射到具名的等级划分上（“可用”、“可部署”……）；这些标签已被废弃，部分原因在于一个对所有输入都只重复同一个有效句子的系统曾被判定为“可用”（[为何废弃综合得分](/docs/network/specifications/scoring#why-the-composite-was-retired)）。

根据[基准规范 §7](/docs/network/specifications/benchmark#7-human-validation)，由此引申出两条结构性诚信规则：

- **得分只是提请人工审查的依据，并非最终结论。** 较高的 chrF++ 意味着某种方法值得与说话者一起进行试点测试，但并不意味着它已准备就绪。
- **唯有社区审查才能决定某种方法是否准备好进入译后编辑工作流。** 该方法输出的分层抽样样本将送交精通双语的说话者，由他们将每条翻译评定为*弃用 / 达意 / 可接受 / 优秀*。由治理组织——而非排行榜——决定该方法是否推进。

作为对比，[创始人奖](/docs/network/specifications/prizes)的条件（chrF++ 底线、≥99% 形态有效词作为准入门槛、≥70% 经说话者评定为可接受或更优）所描述的方法，其剩余的错误属于*真实语言层面的错误*——即曲折变化错误，而非凭空捏造的词汇。这就是“值得说话者花时间的初稿”在数据上的体现，而说话者的评定则是决定性的评判条件。

## 从获胜方法到运作办公室

假设一个方法通过了这些关卡。剩余的步骤是组织性的，是规范而不是即兴的：

1. **所有权转移。** 该方法的代码成为社区治理组织的财产——开发者保留署名和发布权（[所有权转移](/docs/network/sovereignty/ownership-transfer)）。
2. **该方法成为服务——社区的服务。** 它被打包为插件，治理组织可以在自己的基础设施上运行，控制访问和允许的使用（[部署到生产环境](/docs/network/getting-started/deploy-to-production)）。如果社区选择商业化提供，那是它的业务——Champollion 不参与分享（[工作如何获得资金](/docs/network/sovereignty/economic-model)）。
3. **翻译者将其插入他们的日常工作。** 翻译办公室将其现有文件工作流指向该方法的 API：源文本输入，草稿输出，后编辑，发布。发布的文本带有翻译者的名字和权威——机器是他们桌上的工具，就像字典一样。

## 目前的进展

坦率地说：完整的路径已经完成了端到端的规范制定，并已部分构建。评测自动化套件（harness）、指标、运行卡（run cards）以及公开排行榜均已就绪；评测沙箱已经构建，但仅用玩具方法演练过；上游存在一个 Plains Cree 开发语料库；设立了奖项提案，但尚未正式开放；部署平台已经就绪。社区审查界面与校正文本反馈闭环已完成规范设计，但尚未投入运作——规范中将其标记为计划中，我们亦持此态度。目前尚无任何方法走完从基准测试到日常社区使用的完整历程。这条历程正是本项目对成功的定义，也正因如此，我们不会过早宣称成功。

---

## 这对你意味着什么

:::info[如果您是社区成员]
排行榜上的高分绝不意味着机器会在没有人工监督的情况下用您的语言发布内容——它意味着初稿生成器可能已经准备好在您的翻译人员面前进行*试用*，这完全按照您的条件进行，并由您的说话者担任评委（且是有偿的——参见[说话者如何获取报酬](/docs/network/perspectives/how-speakers-get-paid)）。如果您的社区设有翻译办公室，可以向我们提出相关的核心问题：“试点项目具体是什么样的，由谁来审查输出？”
:::

:::info[如果您是研究人员]
译后编辑的视角改变了真正值得衡量的指标：在说话者参与闭环的情况下达到“可接受文本的时间”，而不仅仅是 chrF++。Network 的各项指标正是这一目标的替代指标（[评分规范 §1](/docs/network/specifications/scoring)），而针对形态复杂语言的分语言译后编辑研究，正是本基础设施旨在支持的一项尚待填补的研究空白。
:::

:::info[如果你是开发者]
为编辑器优化，而不是为指标优化。产生真实词汇但偶尔有错误屈折的方法可以在几秒内被说话者修复；产生看似合理的形式的方法会毒害整个工作流——这就是为什么形态有效性在这里被严格把控。从[提交方法](/docs/network/getting-started/submit-a-method)开始，阅读[方法接口](/docs/network/specifications/methods)了解如果你赢了最终要交付的内容。
:::

## 另见

- [翻译不是复兴](/docs/network/perspectives/translation-is-not-revitalization)——为什么人工关卡是重点，而不是限制
- [报告错误和拥有修正](/docs/network/perspectives/reporting-errors-and-owning-corrections)——当发布的文本仍然错误时会发生什么
- [基准规范 §7](/docs/network/specifications/benchmark#7-human-validation)——人工验证关卡，正式版本
