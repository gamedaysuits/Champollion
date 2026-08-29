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

> **执行摘要。** Champollion 是机器翻译研发
> 工具——源码可用且非商业用途免费，其
> 评估测试框架开源。本页面完整阐述了其对语言数据的
> 立场：语料库属于其来源的人群，每一项许可证和社区
> 条款都通过机制而非口头承诺来尊重，并且平台不会
> 对任何人的语言设定自己的条款。

:::info[语言数据是生物数据]
语言数据是**生物数据**。就像遗传数据或健康数据一样，语言承载着使用者的身份、亲缘关系和人际关系——就像基因组一样，它无法被有意义地匿名化：即使删除名字，语言仍然编码了其使用者的身份。因此，提供语料库的人掌握着它的钥匙，也掌握着针对它进行的任何测量的钥匙。这是下面所有内容的前提。
:::

基于这一前提，设计随之而来。Champollion 将每个语料库贡献者视为**管理者**：语料库在法律上、物理上和实际上仍属于他们——同时基础设施使其*可测量*。

## 承诺

1. **我们从不持有数据。** 语料库以哈希固定的元数据卡片形式注册，在评估时从管理者自己的托管服务器获取。没有任何内容被复制到本仓库或从我们的基础设施提供。将你的存档离线，针对它的评估就会停止。参见 [注册语料库](/docs/network/sovereignty/registering-corpora)。

2. **每项许可证都得到尊重——通过门控而非承诺。** 非商业和仅限研究的语料库在机制上被排除在其许可证不允许的任何使用之外。社区在许可证之外提出的限制条件会被记录其来源并以相同方式得到尊重。执行机制存在于 CI 门控和数据库触发器中，而非行为准则中。

3. **条款属于管理者，且各不相同。** 不同的语言将有不同的协议——公开的 CC0 语料库、仅限研究的社区语料库和具有主权部署要求的密封测试集都可以参与，各自按其自身条款。这里没有通用合同，也没有对任何事物的默认声明。参见 [条款框架](/docs/network/sovereignty/ownership-transfer)。

4. **密封语料库作为架构而非例外得到支持。** 社区可以保持测试集密封——托管在其自己的基础设施上，Champollion 或开发者永远看不到——同时仍然可以对其进行方法评分。可测量性而无可提取性是一个设计目标，而非变通方案。

5. **署名和致谢随数据一起传播。** 构建者和语言学家的署名在语料库出现的每个界面上都是强制性的。当社区应用了 [Local Contexts](https://localcontexts.org/) TK 或 BC 标签时，我们显示它们并尊重它们编码的协议。我们携带标签；我们从不创建标签。

6. **贡献者获得报酬。** 语料库构建和验证是按公开费率进行的专业工作——参见 [说话者如何获得报酬](/docs/network/perspectives/how-speakers-get-paid)。报酬不购买语料库：构建者获得报酬*并且*仍然是管理者。

## 许可证如何转化为强制执行

承诺 2 具有具体的形式，值得完整阐述——这说明了
“尊重每一项许可证”在实际中是如何运作的，而不仅仅是良好
意愿的总结。

**每个基准测试在录入时均处于挂起（held）状态。** 新编目的测试集默认处于隔离状态：
在索引中可见，但被排除在评估队列、
竞赛以及所有排名之外。在录入时，不会对语料库做任何假设
——即使是看起来很宽松的许可证——直到其条款与
固定上游版本的实际许可证文本进行审查比对。

**审查裁决是机制化的，复杂情况将保持挂起状态。** 明确
声明的宽松许可证会放行该语料库进入所有通道。明确声明的
非商业许可证会将其放行至研究通道，该通道被排除在
所有商业、奖项和 API 层面之外。而未声明、
修改过、混合或定制的许可证**绝不会代权利人进行解释**：
语料库保持编目但处于挂起状态——排除在队列、竞赛
和排名之外——直到权利人声明条款或记录授权。该
裁决、其日期、其通道及其依据会以机器可读的方式标记在
语料库卡片及其注册表条目上，因此“为什么这个可以运行？”始终有
可引用的答案，“为什么这个不能？”也是如此。

**向模型发送文本是一种传输，且受到门控限制。** 评估一个
模型意味着向其发送源句子——这就是语料库离开本地，且
受许可证管辖。采用宽松许可证的语料库可以使用标准
通道。在明确的非商业许可证下的语料库，仅通过
在合同上承诺不对输入进行训练的通道传输——明确表述为：
不训练保证，而不仅仅是不保留保证。在未声明或
修改过授权下的语料库，会被直接拒绝远程评估，直到记录了
同意许可，而封闭的社区数据集则绝不会离开其管护者的
基础设施。当门控拒绝时，其拒绝消息会引用
许可证审查的裁决。

**强制执行位于每个客户端底层。** 挂起状态由
任何客户端都无法绕过的数据库触发器强制执行，禁止托管规则由
扫描每个跟踪路径以查找语料库内容的存储库门控强制执行，而
传输门控则运行在评估测试框架本身内部。其中任何一个都可以
对我们说“不”，这正是关键所在。

## 这不是什么

Champollion 不是数据经纪商，不是翻译供应商，也不是商业平台。它是研究工具。高排行榜分数证明一种方法在技术上有效；它不是发布翻译、重新分发语料库或针对社区意愿部署任何内容的许可证。这些决定始终属于管理者。

## 塑造这一设计的框架

这种立场不是在这里发明的。它受到并感谢过去二十年的土著数据治理工作的启发：

- **First Nations 数据主权原则**——加拿大的 First Nations（第一民族）主张对其自身信息的所有权、控制权、访问权和占有权；这里使用的管理者模式设计为与这些主张兼容。
- **[CARE 原则](https://www.gida-global.org/care)** （集体利益、控制权、责任、伦理）——全球土著数据联盟。
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** ——毛利人数据主权网络。
- **[Kaitiakitanga 许可证](https://tehiku.nz/)** ——Te Hiku Media 为毛利语数据制定的基于监护的许可证，直接影响了这里使用的管理者掌握钥匙的保管模式。

我们指导任何为自己语言的数据设计治理的人直接参考这些来源——它们是权威，而不是我们。当社区为其语料库采用这些框架中的任何一个时，语料库卡片会记录该声明，工具会尊重它。

Champollion 显示 Local Contexts **"开放合作通知"**：我们与其语言出现在这里的社区建立关系，社区编写的标签优先于我们对其数据的任何说法。

## 另请参阅

- [数据主权，从零开始](/docs/learn/data-sovereignty) —— 本页面的入门版本，适合刚接触该概念的读者

- [注册语料库与曝光通道](/docs/network/sovereignty/registering-corpora) ——机制
- [面向语言社区](/docs/network/community/for-language-communities) ——平白易懂的指南
- [说话者如何获得报酬](/docs/network/perspectives/how-speakers-get-paid) ——公开的费率和条款
- [翻译方法](https://champollion.dev/docs/guides/translation-methods) ——`api` 方法，将社区的提示、词典和指导数据保留在其自己的服务器上
