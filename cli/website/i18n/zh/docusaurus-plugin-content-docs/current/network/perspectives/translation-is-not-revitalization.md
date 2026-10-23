---
sidebar_position: 1
title: "翻译不等于语言复兴"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "机器翻译对濒危语言的作用与局限——直言不讳。MT 是语言社区的基础设施。它永远无法替代人与人之间的交流。"
related:
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/put-it-to-work
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who decides what happens to language data, and consent before deployment"
---

# 翻译不是语言复兴

> **立场。** 机器翻译在语言之间转换文本。复兴创造新的使用者。这些是不同的活动，有不同的成功标准，任何排行榜分数都改变不了这一点。我们构建机器翻译作为基础设施，服务于社区的目标——永远不是作为代际传递的替代品。儿童从人那里学习语言，而不是从机器。

在 2026 年，人们很容易相信软件可以解决任何问题，包括正在失去使用者的语言。我们想要精确说明为什么这种信念是错误的——以及翻译技术*实际上*能诚实地贡献什么。

这篇文章之所以存在，是因为一份从语言学家视角对本项目的批评有力地指出：一个完美的英语→克里语翻译系统并不能解决传承问题（孩子们在家不学这门语言）、地位问题（英语作为代表经济权力的语言）或教学问题（沉浸式学校和受训教师不足）。它甚至可能会让情况变得更糟——制造出“计算机能说克里语”的错觉，并淡化人际传承的紧迫感。我们接受了其中的大部分批评，并在此公开我们的回应，而不是将其掩盖。

---

## 语言复兴实际上需要什么

关于语言复兴的研究文献在一点上是一致的：语言在代际之间传递时存活——当父母、祖父母和社区对儿童说这种语言，儿童长大后用它回应时（Fishman 1991; Hinton & Hale 2001）。其他一切——学校、媒体、词典、应用——要么支持这种传递，要么什么都不支持。

没有翻译系统参与那种交换。将英文文档转换为平原克里语的模型不会创造一个使用者。它不会配备沉浸式教室、培训教师，或与儿童坐在厨房餐桌前。如果我们的工作曾被描述为"拯救语言"，那个描述是错误的，我们会这样说。

## 机器翻译不能做什么

直言不讳地说，这样以后就没有歧义了：

- **它无法替代母语者。** 未经流利母语者审核的输出只是草稿，算不上文本。我们自己的[评分规则](/docs/network/specifications/scoring)将所有自动评分仅视为代用指标；唯有人工审核才能确认其可用性。
- **它无法传授母语。** 孩子们是通过人际纽带和沉浸式环境习得语言的，而不是通过翻译文档。
- **它可能会制造危险的假象。** 一个能够“讲”某种语言的演示，会让人误以为这种语言已经脱离险境，事实却并非如此。这种声望风险（prestige risk）是切实存在的，我们将其视为一个需要*与*社区共同审视的开放性课题，而非公关辞令。
- **它不能做任何决定。** 是否要为某种语言构建翻译系统，以及可以在何处使用它，完全由社区说了算——包括根本不部署它的决定。这种控制权已植入到[所有权转让](/docs/network/sovereignty/ownership-transfer)与[数据主权](/docs/your-words-your-rules)架构中，并且涵盖具体语境：一个社区可能允许将机器翻译用于官方文档，但拒绝在课堂教材中使用。

## 机器翻译能诚实地做什么

在这个背景下，翻译基础设施贡献了具体的、有界的东西——每一个都服务于已经在做真正工作的人。

**1. 为不堪重负的翻译人员提升吞吐量。** 社区翻译办公室面临的难题是：*应当*拥有该语言版本的文档，远远超出了人工从头翻译的承受能力。机器生成的草稿将工作重心从“通篇翻译”转变为“审核与校对”——受控实验研究表明，译后编辑（post-editing）明显比从头翻译更快，同时质量持平或有所提升（Plitt & Masselot 2010；Green, Heer & Manning 2013）。我们在[投入实际应用](/docs/put-it-to-work)中详细介绍了这一工作流。需要说明的是：这些研究针对的是高资源语言对；针对多式综合语，我们目前尚无同等证据，而这也正是本项目旨在衡量的部分内容。

**2. 语言权利的实际杠杆。** 在多个司法管辖区，用土著语言获得政府服务的权利存在于法律中。通常缺少的是以官僚机构要求的速度生成翻译的实际能力。一个能在几天而不是几个月内将五十页政策文件转换为经过审查的翻译的社区处于更强的谈判地位。该技术不创造权利；它使权利更难被忽视。

**3. 可重用的语言学基础设施。** 我们用来验证翻译输出包含真实单词——而不是幻觉单词——的形态分析器（FST）编码了*为什么*每个单词形式是有效的。同样的机制是学习工具的基础：共轭训练器、纠错写作辅助、形态探索器。验证引擎和教学引擎是同一个工件。这是一条路径，不是承诺——学习工具需要构建，是否构建是社区决定。

**4. 支持第二语言学习者。** 复兴不仅仅是儿童获得第一语言。它也是成年人作为第二语言学习——可能永远达不到长者级流利度的人，但他们可以阅读社区文件、有理解地参与，并通过使用该语言来提高语言的公众存在。对于这个群体，翻译辅助是一个真正的工具，就像词典是一个工具一样。

**5. 让工作在本地获得资助并归本地所有的理由。** 在我们的模式中，经过验证的方法将完全[转让给社区所有](/docs/network/sovereignty/ownership-transfer)，并且社区从其拥有的资产中获得的任何收益完全归其自身所有（[谁可以使用，以及费用说明](/docs/getting-started/who-may-use-this)）。母语者会因其专业知识[获得报酬](/docs/working-with-speakers)，而非被要求无偿志愿奉献。这些本身同样不是语言复兴——但它让资源流向从事复兴工作的人，而不是流走。

## 诚实的框架

该领域有很长的技术项目记录，这些项目带着救援叙事到来，带着出版物离开（Bird 2020）。我们试图坚持一个更狭隘的主张：**机器翻译是基础设施。** 基础设施服务于其他人设定的目标。道路不决定你去哪里旅行；这项技术不决定一种语言是否存活。使用者、家庭和社区决定——[联合国土著语言国际十年](https://idil2022-2032.org/)框架正确地将土著人民而不是工具放在中心。

如果一个社区得出结论认为翻译技术有助于他们的目标，我们希望它是最好的、最负责任的版本——由他们拥有、由他们的使用者验证、按他们的条款部署。如果一个社区得出结论认为它没有帮助，那个结论是这个项目的有效结果，而不是失败。这句话的两个部分都是承诺。

---

## 这对你意味着什么

:::info[如果你是社区成员]
本项目不会宣称某个应用程序能拯救你的语言——它做不到。它所提供的能力是有限度的：在流利母语者审核下加快文档翻译、可完全归你所在社区所有的基础设施，以及对母语者专业知识的合理报酬。是否使用以及如何使用其中任何内容，完全由你的社区决定，包括不使用它的决定。参见[你的语言，你的规则](/docs/your-words-your-rules)以及[报告错误与拥有修正成果](/docs/network/perspectives/reporting-errors-and-owning-corrections)。
:::

:::info[如果你是研究人员]
请将“面向濒危语言的机器翻译”视为一项基础设施主张，而非语言复兴主张，这样你的评估视角就会随之转变：不再是“BLEU 分数高吗？”，而是“这是否按照实际从事这项工作的人的意愿，切实减轻了他们的工作负担？”在[基准规范](/docs/network/specifications/benchmark)与[排行榜与发布机制](/docs/reference/leaderboard)中，我们正是以这一标准来要求自己的。
:::

:::info[如果你是开发者]
请面向译后编辑工作流进行构建，而不是面向演示 Demo。你所开发方法的用户是校对草稿的流利母语者，而最糟糕的失效模式就是生成在非母语者看来似乎合情合理的幻觉词汇——这正是形态学验证在这里把关一切的原因。请从[提交方法](/docs/network/getting-started/submit-a-method)和[投入实际应用](/docs/put-it-to-work)开始了解。
:::

---

## 数据来源

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## 另见

- [与母语者合作](/docs/working-with-speakers) — 用具体数据展示的报酬模型
- [投入实际应用](/docs/put-it-to-work) — 译后编辑路径
- [排行榜与发布机制](/docs/reference/leaderboard) — 完整的平台架构，包括第 8 节关于尚未解决的矛盾与权衡
