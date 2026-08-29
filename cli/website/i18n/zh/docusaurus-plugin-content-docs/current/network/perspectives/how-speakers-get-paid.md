---
sidebar_position: 2
title: "说话者如何获得报酬"
slug: '/network/perspectives/how-speakers-get-paid'
description: "社区验证者和翻译者在基准工作中的报酬、为什么向说话者支付报酬是不可协商的，以及随着网络增长报酬如何扩展。所有数字均来自已发布的规范。"
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# 发言人如何获得报酬

> **透明度说明。** 本页面上的每个数字都已出现在已发布的规范中 — [基准规范 §10](/docs/network/specifications/benchmark#10-cost-framework)、[发言人验证协议](/docs/network/specifications/speaker-validation)和[奖项规范](/docs/network/specifications/prizes)。本页面用通俗易懂的语言将它们汇集在一处，这样任何人都不必阅读规范就能了解发言人时间的价值。本页面不做出这些文件已经陈述的内容之外的任何承诺。

能够判断机器生成的句子是否真实、流畅且含义正确的双语发言人是整个系统中最稀缺、最有价值的参与者。其他一切 — 工具、指标、排行榜 — 都存在于让这个人的少量时间发挥最大作用。

因此第一条规则很简单：**发言人按专业费率获得报酬，无论结果如何。**

---

## 为什么支付发言人报酬是不可协商的

语言技术研究长期以来有一个习惯，即将流利的发言人视为免费资源 — "社区参与"为数据集、论文和每个人的职业生涯做出贡献，除了发言人本身。我们认为这种模式是剥削性的，而最有资格从事这项工作的人正是那些时间已被用于教学、翻译和用该语言养育孩子这些紧迫工作所占据的人。

由此产生三个设计结果：

1. **没有志愿者渠道。** 我们不要求发言人将评估工作作为对研究的帮助而捐献。参与是一项有偿工作，拒绝参与对发言人没有任何成本。
2. **报酬是无条件的。** 无论发言人的评分是否被使用，他们都会获得报酬，报酬不以结果为条件。已发布的协议承诺在完成每个任务块后两周内支付报酬。
3. **补偿不是全部。** 贡献评分的发言人还会获得署名（署名或匿名，由他们选择）、可选的在使用其评分的出版物上的共同作者身份、随时撤回其贡献的权利，以及对他们认为有问题的结果发布的否决权。这些条款在[发言人验证协议 §5–6](/docs/network/specifications/speaker-validation)中，而不是在附加协议中。

## 已发布的费率

基准成本框架将双语发言人补偿设定为**每小时 50–65 加元**，用于语料库和验证工作。这对每个角色意味着什么：

### 构建基准语料库

创建每种方法都要评分的参考翻译是基础发言人任务。每种语言的已发布建立预算：

| 工作 | 已发布范围 | 依据 |
|------|-----------|------|
| 语料库策划（50–150 条目） | $2,500–6,000 | $50–65/小时，双语发言人时间 |
| 审查方法输出 | $500–1,500 | 相同的小时费率 |

完整的语料库传统上需要发言人大约 80 小时；计划的代理辅助工作流程（句子起草和格式化由工具处理，翻译始终由人类完成）旨在将其缩短至 30–40 小时 — 更少的重复工作时间，相同的小时费率，发言人只做真正需要人类的部分。

### 验证指标

在自动化评分有任何意义之前，发言人必须根据人类判断来检查它们。[发言人验证协议](/docs/network/specifications/speaker-validation)发布了确切的任务、小时数和报酬：

| 任务 | 时间 | 每位发言人报酬 |
|------|------|---------------|
| A — 对 200 个机器翻译的充分性和流畅性进行评分 | ~8 小时 | $400–520 加元 |
| B — 审查 50 对"等价"翻译对 | ~2 小时 | $100–130 加元 |
| C — 审查 100 个形态分析器拒绝的单词 | ~1.5 小时 | $75–100 加元 |

一位发言人完成全部三项任务在两到四周内投入约 11.5 小时，获得**$575–750 加元**。完整的三发言人验证轮次花费项目 $1,475–1,920 — 这正是重点：发言人验证对项目来说是一个小的预算项目，永远不应该是成本被"节省"的地方。

### 审查奖项申请

没有奖项仅基于自动化评分而支付。[创始人奖](/docs/network/specifications/prizes)（$10,000 加元，英语→平原克里语）要求至少两位双语发言人独立审查至少 30 个输出的分层样本，且 70% 或更多被评为"可接受"或"优秀"。该审查是按相同费率的有偿发言人工作 — 它也是一个门槛：发言人可以否决奖项申请，这是设计使然。

## 它如何随竞赛扩展

该模型的构建方式使得发言人补偿随着平台增长而增长，而不是被其稀释：

- **每种新语言都从有偿语料库工作开始。** 每种语言的已发布建立成本（$3,350–8,500 全包）主要是发言人补偿 — 最大的单一组成部分，刻意如此。
- **每个新奖项池都带来其自己的有偿审查。** 遵循[奖项模板](/docs/network/specifications/prizes#4-future-prize-pools)的每个赞助竞赛都带有相同的社区验证要求，这意味着每个竞赛为该语言的发言人审查工作提供资金。
- **社区所有的方法保持社区资助的资产。** 转移的方法完全属于治理组织 — 从部署它获得的任何收益完全属于社区（[工作如何获得资金](/docs/network/sovereignty/economic-model)），可用于持续审查、语料库增长和语言项目，由社区自行决定。该分配是社区的决定，不是我们的。

## 我们*没有*承诺的内容

诚实要求标记边界：

- 上述费率是当前平原克里语工作的已发布费率。未来语言的费率将与合作伙伴社区一起设定并以相同方式发布 — 在规范中，在工作开始之前。
- Champollion 是非商业性的，自身不产生收入，目前**由其创始人自筹资金** — 赠款和赞助资金是我们正在寻求的，而不是我们已有的。[工作如何获得资金](/docs/network/sovereignty/economic-model)描述了机制，而不是保证。
- "公平报酬"是必要的但不充分的。报酬本身不能使项目非剥削性 — 所有权和控制权才能，这就是为什么补偿位于[管理模式](/docs/network/sovereignty/data-sovereignty)内部而不是替代它。

---

## 这对你意味着什么

:::info[如果你是社区成员]
如果你是某种服务不足的语言和英语的双语使用者，你的判断是这个系统中最有价值的输入，已公布的条款为：50–65 加元/小时、灵活的日程安排、两周内付款、按你的条款获得署名，以及撤回你的贡献的权利。无需编程。从[为语言社区](/docs/network/community/for-language-communities)或[说话者验证协议 §7](/docs/network/specifications/speaker-validation#7-how-to-get-started)开始。
:::

:::info[如果你是研究人员]
将说话者补偿作为一流的研究成本——已公布的数字（一轮指标验证 $1,475–1,920；语料库策划 $2,500–6,000）按补助金标准来说很小，但它们是使自动化评分具有可防御性的关键。[语料库合作策略](/docs/network/specifications/corpus-partnership)展示了学术部门如何通过内置资助的说话者工作来接入这个系统。
:::

:::info[如果你是开发者]
即使你从不资助说话者工作，你也能从中受益：经过验证的指标是使你的排行榜评分有意义的关键，而付费社区审查是你的方法与奖项之间的防线。如果你获胜，预期说话者已被付费来审查你的输出——并预期[你的方法的所有权将转移](/docs/network/sovereignty/ownership-transfer)给使用该语言的社区。
:::

## 另见

- [翻译不是复兴](/docs/network/perspectives/translation-is-not-revitalization) — 为什么发言人权威框架了其他一切
- [报告错误和拥有更正](/docs/network/perspectives/reporting-errors-and-owning-corrections) — 基准之后的发言人权威
- [基准规范 §10](/docs/network/specifications/benchmark#10-cost-framework) — 这些数字来自的完整成本框架
