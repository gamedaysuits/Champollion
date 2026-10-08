---
sidebar_position: 1
title: "翻译不等于语言复兴"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "机器翻译对濒危语言的作用与局限——直言不讳。MT 是语言社区的基础设施。它永远无法替代人与人之间的交流。"
related:
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/network/perspectives/from-benchmark-to-daily-use
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Data-sovereignty principles, CARE, and consent before deployment"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# 翻译不是语言复兴

> **立场。** 机器翻译在语言之间转换文本。复兴创造新的使用者。这些是不同的活动，有不同的成功标准，任何排行榜分数都改变不了这一点。我们构建机器翻译作为基础设施，服务于社区的目标——永远不是作为代际传递的替代品。儿童从人那里学习语言，而不是从机器。

在 2026 年，人们很容易相信软件可以解决任何问题，包括正在失去使用者的语言。我们想要精确说明为什么这种信念是错误的——以及翻译技术*实际上*能诚实地贡献什么。

这篇文章存在是因为我们邀请的一位语言学家有力地论证了这个项目的批评：一个完美的英语→克里语翻译系统不会解决传递问题（儿童在家不学习该语言）、声望问题（英语作为经济权力的语言）或教学问题（沉浸式学校和训练有素的教师不足）。它甚至可能会让事情变得更糟，通过制造"计算机可以说克里语"的幻觉，削弱人类传递的紧迫性。我们接受了大部分批评，我们在这里发布我们的回应，而不是隐瞒它。

---

## 语言复兴实际上需要什么

关于语言复兴的研究文献在一点上是一致的：语言在代际之间传递时存活——当父母、祖父母和社区对儿童说这种语言，儿童长大后用它回应时（Fishman 1991; Hinton & Hale 2001）。其他一切——学校、媒体、词典、应用——要么支持这种传递，要么什么都不支持。

没有翻译系统参与那种交换。将英文文档转换为平原克里语的模型不会创造一个使用者。它不会配备沉浸式教室、培训教师，或与儿童坐在厨房餐桌前。如果我们的工作曾被描述为"拯救语言"，那个描述是错误的，我们会这样说。

## 机器翻译不能做什么

直言不讳地说，这样以后就没有歧义了：

- **它不能替代使用者。** 没有流利使用者审查过的输出是草稿，不是文本。我们自己的[评分规则](/docs/network/specifications/scoring)将每个自动化分数视为代理；只有人工审查才能确认可用性。
- **它不能教授第一语言。** 儿童通过关系和沉浸获得语言，而不是通过翻译文档。
- **它可以创造有害的幻觉。** 一个"说"某种语言的演示可能会暗示该语言是安全的，但实际上并非如此。这种声望风险是真实的，我们将其视为一个开放问题，需要*与*社区一起审视，而不是作为一个谈话要点来管理。
- **它不能决定任何事情。** 是否应该为某种语言存在翻译系统，以及在哪里可以使用它，是社区的决定——包括完全不部署它的决定。这种控制权内置于[所有权转移](/docs/network/sovereignty/ownership-transfer)和[数据主权](/docs/network/sovereignty/data-sovereignty)架构中，它包括上下文：社区可能接受机器翻译用于官方文件，但拒绝用于课堂材料。

## 机器翻译能诚实地做什么

在这个背景下，翻译基础设施贡献了具体的、有界的东西——每一个都服务于已经在做真正工作的人。

**1. 为超负荷的翻译者提供吞吐量。** 社区翻译办公室面临比人工翻译者能从零开始生成的更多*应该*用该语言存在的文档。机器草稿将工作从"翻译一切"改为"审查和更正"——受控研究发现后编辑比从零开始翻译明显更快，质量保持或改进（Plitt & Masselot 2010; Green, Heer & Manning 2013）。我们在[从基准到日常使用](/docs/network/perspectives/from-benchmark-to-daily-use)中详细描述了这个工作流程。需要说明的是：这些研究涵盖了高资源语言对；我们还没有多综合语言的等效证据，这是该项目设置来测量的一部分。

**2. 语言权利的实际杠杆。** 在多个司法管辖区，用土著语言获得政府服务的权利存在于法律中。通常缺少的是以官僚机构要求的速度生成翻译的实际能力。一个能在几天而不是几个月内将五十页政策文件转换为经过审查的翻译的社区处于更强的谈判地位。该技术不创造权利；它使权利更难被忽视。

**3. 可重用的语言学基础设施。** 我们用来验证翻译输出包含真实单词——而不是幻觉单词——的形态分析器（FST）编码了*为什么*每个单词形式是有效的。同样的机制是学习工具的基础：共轭训练器、纠错写作辅助、形态探索器。验证引擎和教学引擎是同一个工件。这是一条路径，不是承诺——学习工具需要构建，是否构建是社区决定。

**4. 支持第二语言学习者。** 复兴不仅仅是儿童获得第一语言。它也是成年人作为第二语言学习——可能永远达不到长者级流利度的人，但他们可以阅读社区文件、有理解地参与，并通过使用该语言来提高语言的公众存在。对于这个群体，翻译辅助是一个真正的工具，就像词典是一个工具一样。

**5. 工作在家获得资金和所有权的理由。** 在我们的模型中，经过验证的方法[转移到社区所有权](/docs/network/sovereignty/ownership-transfer)完全，社区从它拥有的资产中获得的任何东西完全是它自己的（[工作如何获得资金](/docs/network/sovereignty/economic-model)）。使用者[因其专业知识获得报酬](/docs/network/perspectives/how-speakers-get-paid)，而不是被要求志愿。这些都不是复兴——但它将资源指向做复兴的人，而不是远离他们。

## 诚实的框架

该领域有很长的技术项目记录，这些项目带着救援叙事到来，带着出版物离开（Bird 2020）。我们试图坚持一个更狭隘的主张：**机器翻译是基础设施。** 基础设施服务于其他人设定的目标。道路不决定你去哪里旅行；这项技术不决定一种语言是否存活。使用者、家庭和社区决定——[联合国土著语言国际十年](https://idil2022-2032.org/)框架正确地将土著人民而不是工具放在中心。

如果一个社区得出结论认为翻译技术有助于他们的目标，我们希望它是最好的、最负责任的版本——由他们拥有、由他们的使用者验证、按他们的条款部署。如果一个社区得出结论认为它没有帮助，那个结论是这个项目的有效结果，而不是失败。这句话的两个部分都是承诺。

---

## 这对你意味着什么

:::info[如果你是社区成员]
本项目不会声称某个应用能拯救你的语言——它做不到。它提供的是有限的：在流利使用者审查下更快的文档翻译、你的社区可以完全拥有的基础设施，以及对使用者专业知识的补偿。是否以及如何使用其中任何部分都由你的社区决定，包括选择不使用的决定。参见 [For Language Communities](/docs/network/community/for-language-communities) 和 [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections)。
:::

:::info[如果你是研究者]
将"濒危语言机器翻译"视为基础设施主张而非语言复兴主张，你的评估问题就会改变：不是"BLEU 分数高吗？"而是"这是否在相关人员的条件下可衡量地减少了他们的工作量？"[基准规范](/docs/network/specifications/benchmark) 和 [How It Works §8 (Tensions and Limitations)](/docs/network/how-it-works#8-tensions-and-limitations) 是我们坚守这一标准的地方。
:::

:::info[如果你是开发者]
为后编辑工作流而构建，而不是为演示而构建。你的方法的用户是一位流利的使用者在修正草稿，最坏的失败模式是对非使用者来说看起来合理的幻觉词——这就是为什么形态学验证在这里把控一切。从 [Submit a Method](/docs/network/getting-started/submit-a-method) 和 [From Benchmark to Daily Use](/docs/network/perspectives/from-benchmark-to-daily-use) 开始。
:::

---

## 来源

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## 另见

- [使用者如何获得报酬](/docs/network/perspectives/how-speakers-get-paid)——补偿模型，用数字表示
- [从基准到日常使用](/docs/network/perspectives/from-benchmark-to-daily-use)——后编辑路径
- [它如何工作](/docs/network/how-it-works)——完整的平台架构，包括 §8 关于我们尚未解决的张力
