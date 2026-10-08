---
sidebar_position: 7
title: "数据管理"
description: "Champollion 对语言数据的立场：语料库由其管理者保管，尊重每项许可证，社区数据由社区条款管理。"
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# 数据管理

> **执行摘要。** Champollion 是一套机器翻译研发工具链——源码可用且非商业用途免费，其评估框架完全开源。本页面完整阐明其对语言数据的立场：语料库归属于产生它们的群体；每一项许可证和社区条款均通过机械化手段严格执行，而非仅凭承诺；平台自身不对任何人的语言施加任何条款。

:::info[语言数据是生物数据]
语言数据是**生物数据**。就像遗传数据或健康数据一样，语言承载着使用者的身份、亲缘关系和人际关系——就像基因组一样，它无法被有意义地匿名化：即使删除名字，语言仍然编码了其使用者的身份。因此，提供语料库的人掌握着它的钥匙，也掌握着针对它进行的任何测量的钥匙。这是下面所有内容的前提。
:::

基于这一前提，设计随之而来。Champollion 将每个语料库贡献者视为**管理者**：语料库在法律上、物理上和实际上仍属于他们——同时基础设施使其*可测量*。

## 承诺

1. **我们从不持有数据。** 语料库以哈希固定的元数据卡片形式注册，在评估时从管理者自己的托管服务器获取。没有任何内容被复制到本仓库或从我们的基础设施提供。将你的存档离线，针对它的评估就会停止。参见 [注册语料库](/docs/network/sovereignty/registering-corpora)。

2. **严格遵守每一项许可证——依靠门禁，而非承诺。** 非商业及仅限研究用途的语料库，会在机械层面被彻底排除在其许可证未允许的任何用途之外。社区在许可证之外主张的限制，将连同其出处一并记录，并以相同方式予以遵守。这一约束机制落实于每次推送前在本地运行的 pre-push 门禁（CI 目前已停用）以及数据库触发器中，而非写在行为准则里。

3. **条款属于管理者，且各不相同。** 不同的语言将有不同的协议——公开的 CC0 语料库、仅限研究的社区语料库和具有主权部署要求的密封测试集都可以参与，各自按其自身条款。这里没有通用合同，也没有对任何事物的默认声明。参见 [条款框架](/docs/network/sovereignty/ownership-transfer)。

4. **密封语料库作为架构而非例外得到支持。** 社区可以保持测试集密封——托管在其自己的基础设施上，Champollion 或开发者永远看不到——同时仍然可以对其进行方法评分。可测量性而无可提取性是一个设计目标，而非变通方案。

5. **署名与贡献认定与数据同行。** 语料库出现的每一个界面，均必须标明构建者与语言学家的贡献。若社区已应用 [Local Contexts](https://localcontexts.org/) TK（传统知识）或 BC（生物文化）标签（Labels），我们计划展示这些标签并遵守其编码的协议；目前尚未实现对 Label 的支持。我们将承载这些 Label，但绝不自行签发。

6. **贡献者将获得报酬。** 语料库的构建与验证是专业工作，一旦获得资金（目前暂无托管资金），将按公布费率支付报酬——参见[发言人如何获得报酬](/docs/network/perspectives/how-speakers-get-paid)。支付报酬并不等于买断语料库：构建者在获得报酬的*同时*，依然是数据的管理者（steward）。

## 许可证如何转化为强制执行

承诺 2 具有具体的运作形态，值得完整阐明——这是“严格遵守每一项许可证”在实际运行中的具体机制，而非仅仅是一份良好意愿的总结。

**所有基准在录入时均处于保留（held）状态。** 新收录的测试集默认处于隔离状态：在索引中可见，但被排除在评估队列、评测竞赛以及所有排名之外。在录入时，不对语料库作任何预设——即使其看起来采用宽松许可证——直到依据固定上游版本的实际许可证文本完成条款审查为止。

**审查结论完全机械化，疑难情况维持保留状态。** 明确声明的宽松许可证可让语料库进入所有通道。明确声明的非商业许可证可让其进入研究通道，该通道与所有商业、奖项和 API 界面相隔离。而对于未声明、经过修改、混合或定制的许可证，**绝不代表权利持有人进行揣测解释**：语料库保持收录但处于保留状态——不进入队列、评测竞赛和排名——直至权利持有人明确条款或记录授权。审查结论、日期、对应通道及其依据均以机器可读的方式标记在语料库卡片及其注册表条目上，因此“为何可以运行？”始终有据可查，“为何不能运行？”亦是如此。

**向模型发送文本属于数据传输，受到严格门禁限制。** 评估模型意味着向其发送源句——这代表语料库离开了本地环境，必须遵循许可证的约束。采用宽松许可证的语料库可以使用标准通道。采用明确非商业许可证的语料库，仅能通过在合同层面保证不使用输入数据进行训练的通道传输——明确界定为：提供“不用于训练”的保证，而非仅仅是“不保留数据”。对于授权未声明或经过修改的语料库，在记录明确同意之前直接拒绝远程评估；密封的社区数据集则绝不离开其管理者的基础设施。当门禁拒绝执行时，其拒绝信息会直接引用许可证审查结论。

**执行机制位于所有客户端之下。** 保留状态由任何客户端都无法绕过的数据库触发器强制执行；禁止托管规则由 pre-push 门禁强制执行，该门禁在每次推送前于本地运行（CI 目前已停用），扫描所有被跟踪和推送的路径以查找语料库内容；传输门禁则在评估框架内部直接运行。其中任何一个环节都可以拒绝我们的操作，这正是其设计目的所在。

## 这不是什么

Champollion 不是数据经纪商，不是翻译供应商，也不是商业平台。它是研究工具。高排行榜分数证明一种方法在技术上有效；它不是发布翻译、重新分发语料库或针对社区意愿部署任何内容的许可证。这些决定始终属于管理者。

## 塑造这一设计的框架

这种立场不是在这里发明的。它受到并感谢过去二十年的土著数据治理工作的启发：

- **第一民族数据主权原则** — 加拿大第一民族明确阐述了对其自身信息拥有社区所有权、控制权、访问权和占有权（OCAP® 原则）；此处的管理模式旨在与这些主张保持兼容。
- **[CARE 原则](https://www.gida-global.org/care)**（集体利益、控制权、责任、伦理）— 全球原住民数据联盟（Global Indigenous Data Alliance）。
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — 毛利数据主权网络。
- **[Kaitiakitanga 许可证](https://tehiku.nz/)** — Te Hiku Media 为毛利语（te reo Māori）数据制定的基于监护权（guardianship）的许可证，对本文采用的“管理者掌管密钥”托管模式有直接影响。

我们指导任何为自己语言的数据设计治理的人直接参考这些来源——它们是权威，而不是我们。当社区为其语料库采用这些框架中的任何一个时，语料库卡片会记录该声明，工具会尊重它。

Champollion 计划采纳 Local Contexts 的**“开放合作”（Open to Collaborate）通告**与标签（Labels）；目前两者均未实现。一旦实现，社区自行制定的标签将优先于我们对其数据所作的任何说明。

## 另请参阅

- [从零了解数据主权](/docs/learn/data-sovereignty) — 本页面的入门导读版，面向初次接触该概念的读者

- [注册语料库与曝光通道](/docs/network/sovereignty/registering-corpora) ——机制
- [面向语言社区](/docs/network/community/for-language-communities) ——平白易懂的指南
- [说话者如何获得报酬](/docs/network/perspectives/how-speakers-get-paid) ——公开的费率和条款
- [翻译方法](https://champollion.dev/docs/guides/translation-methods) ——`api` 方法，将社区的提示、词典和指导数据保留在其自己的服务器上
