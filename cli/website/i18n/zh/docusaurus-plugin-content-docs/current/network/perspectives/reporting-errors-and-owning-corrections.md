---
sidebar_position: 4
title: "错误报告与更正所有权"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "讲者如何报告错误事实或不当翻译、谁决定后续处理、更正如何追溯来源，以及为什么社区对其语言数据拥有否决权。"
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# 报告错误和纠正所有权

> **立场。** 对于发布数千种语言的事实和评估的平台来说，犯错是不可避免的。*不可避免的*是当报告错误时谁会被相信，以及谁拥有纠正的所有权。我们的答案是：流利使用者的报告优先于我们的自动化，每项纠正都附带说明谁改变了什么以及为什么的来源信息，社区可以撤回或否决其语言数据的使用——不是作为一种礼貌，而是作为架构的强制属性。

大多数数据平台将错误报告视为支持工单：用户投诉，维护者决定，记录无声地改变。对于土著语言数据，这种模式是颠倒的。报告错误的人通常比平台更有权威性——使用者告诉我们一个词是错误的不是"用户"，他们是纠正代理的基本事实。下面的设计遵循认真对待这一点。

---

## 两种错误，一个原则

该平台发布两种可能出错的主张：

1. **关于语言的事实** ——驱动评估的语言卡片：分类数据、正字法、语言特征、哪些指标适用。卡片可能声称错误的使用者估计、错误的方言关系、错误的书写系统状态。
2. **关于翻译的判断** ——语料库中的参考翻译，使用者认为其错误或不自然；自动化指标拒绝有效词汇或接受无效词汇；使用者不会接受的"可部署"徽章。

涵盖两者的原则，已在[评分规范](/docs/network/specifications/scoring)和[基准规范 §7](/docs/network/specifications/benchmark#7-human-validation)中生效：**自动化输出是代理；使用者是基本事实。** [使用者验证协议 §6](/docs/network/specifications/speaker-validation#6-what-speakers-get)中的已发布承诺直言不讳：如果使用者说 linter 在某些方面是错误的，我们会修复 linter。

## 报告如何流转

以下是报告采取的路径，带有诚实的状态标记——其中一些现在运行，一些已指定但尚未构建。

**报告错误的翻译或指标判断（现在运行，通过直接渠道）。** 看到错误参考翻译、错误拒绝词汇或不可接受"等价物"的使用者可以通过项目的公共存储库问题跟踪器或直接联系项目来报告。这个的结构化版本——带有*拒绝 / 要点 / 可接受 / 优秀*选项和自由文本注释的评分屏幕——是社区审查界面，在[基准规范 §7.3](/docs/network/specifications/benchmark#7-human-validation)中指定但尚未上线。在此之前，报告通过人对人处理，验证任务本身（付费、结构化使用者审查——见[使用者如何获得报酬](/docs/network/perspectives/how-speakers-get-paid)）是主要纠正管道。

**报告语言卡片上的错误事实（现在运行，相同渠道）。** 卡片纠正遵循相同路径：报告、审查、版本化更改。因为卡片驱动评估行为——哪些指标加载、推荐哪些模型——卡片修复可以改变分数，所以纠正作为记录的数据更改应用，从不无声编辑。

**接下来会发生什么——谁决定：**

- **语言学判断属于该语言的使用者。** 一个形式是否有效、两个措辞是否等价、一个寄存器是否合适——平台实现答案；它不提供答案。使用者不同意的地方（方言、正字法约定），答案被记录为变体，而不是由我们裁定——语料库和 linter 模式支持将方言变体标记为可接受的替代方案，而不是强制一个赢家。
- **关于社区数据的决定属于其治理组织。** 对于有治理组织的语言，对评估语料库的更改、对密封测试集纠正的接受以及部署后果通过它们运行——这正是语言数据由社区控制（参见[数据主权](/docs/network/sovereignty/data-sovereignty)）作为流程而不是海报的实现。
- **机械错误只是被修复。** 打字错误、损坏的链接、解析错误的字段——报告、纠正、记录。不是所有事情都需要委员会。

## 纠正附带来源信息

无法追踪的纠正只是一个更新的观点。三个来源规则适用于每个事实和每个修复：

1. **每个事实都命名其来源。** 语言卡片和语料库条目记录每个值的来源——已发布的数据集、社区贡献、使用者的审查。
2. **派生值被标记为我们的，而不是上游的。** 当平台计算某些东西时——聚合、重新编码、复合——它被记录为来自上游源的平台派生，从不以上游的名义写入。上游数据集不应因其未发布的数字而受到指责或获得信用。
3. **纠正成为记录的一部分。** 使用者的纠正被记录为新的、有属性的断言（由使用者选择命名或匿名——与验证工作相同的条款），取代旧值；什么改变的历史保持可审计。语料库版本是哈希清单化的（[语料库合作 §4.4](/docs/network/specifications/corpus-partnership)），所以纠正的语料库是一个明显的新版本，每个运行卡片记录它被评分的确切版本——旧分数保持可解释，新分数反映修复。

## 否决权，具体来说

"社区控制"很容易声称。以下是它在已发布架构中的具体体现：

- **使用者可以撤回他们的贡献。** 使用者可以随时撤回他们的评分，撤回会将其从所有分析中删除（[使用者验证 §5](/docs/network/specifications/speaker-validation#5-data-governance)）。使用者也对他们认为有问题的结果发布拥有否决权。
- **社区可以完全停止评估。** 密封测试集是加密的，密钥由平台单独持有，平台永远无法重建它们；社区可以通过拒绝参与密钥重建来撤回评估访问权限（[语料库合作 §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)）。"如果我们想停止怎么办？"有一个指定的答案：密封数据永远不会暴露，评估结束。
- **没有分数覆盖社区决定。** 排行榜顶部的方法仍然只在治理组织同意的情况下部署（[所有权转移](/docs/network/sovereignty/ownership-transfer)）——社区决定 MT 根本不应为其语言部署是按设计使用系统，而不是破坏它（见[翻译不是复兴](/docs/network/perspectives/translation-is-not-revitalization)）。

## 我们尚未构建的内容

本着这个书架其余部分的精神：社区审查界面已计划，但尚未上线。治理组织对当前任何语言都未建立——Plains Cree 基准的社区监管处于确认中，我们在监管人同意之前不会公开命名他们。在这些部分存在之前，纠正通过直接、可归因的渠道运行，已发布的规范——而不是本页——仍然是流程的约束性描述。如果本页和规范不同意，规范获胜，我们会认为这种分歧是值得报告的错误。

---

## 这对你意味着什么

:::info[如果你是社区成员]
如果此平台上你所使用语言的某些内容有误——无论是事实、翻译还是标签——你的报告代表的是来自实地的真实情况，而非需要分类处理的投诉。你可以决定是否以名义获得认可；你的贡献可以在之后撤回；你的社区可以完全停止使用其数据。请从 [For Language Communities](/docs/network/community/for-language-communities) 开始，或直接在公开仓库中提交 issue。
:::

:::info[如果你是研究人员]
这里的更正是带有来源信息的数据，而非无声的编辑：语料库版本经过哈希处理，运行卡会固定它们所针对的确切版本，衍生值会被标记为衍生。如果你基于 Network 分数或语料库进行构建，请引用版本——并将由说话者驱动的大规模更正波视为关于指标有效性的一项发现，因为这正是它的本质。
:::

:::info[如果你是开发者]
你的方法的分数可以在代码未变的情况下合理地改变——一个被错误拒绝的词被加入允许列表，一个参考翻译被更正，一个变体类被修复。为此进行设计：在运行卡中固定语料库版本（[Run Card spec](/docs/network/specifications/run-card)），监控数据集变更日志，并将说话者更正视为你能免费获得的最可靠的错误信号。
:::

## 另见

- [使用者如何获得报酬](/docs/network/perspectives/how-speakers-get-paid) ——相同的使用者权威，在基准阶段
- [从基准到日常使用](/docs/network/perspectives/from-benchmark-to-daily-use) ——纠正与发布工作流相遇的地方
- [数据主权](/docs/network/sovereignty/data-sovereignty) ——原住民数据主权原则、CARE 和 Te Mana Raraunga，这个设计背后的原则
