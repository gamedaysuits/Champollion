---
title: "排行榜与发布"
slug: /reference/leaderboard
description: "什么是公开排行榜、两类基准（公开与密封）、其涵盖与未涵盖的范围，以及已发布的运行具体包含哪些内容。"
---

# 排行榜与发布

[排行榜](/leaderboard)是已评分翻译运行记录的公开档案。
任何人都可以向其添加内容：你在自己的机器上针对已注册的数据集运行评估套件（`mt-eval`），并将结果作为**运行卡片**发布。排行榜保存卡片；它不会替你运行你的方法。它仅对采用开放许可、可重新分发的数据集保存逐句文本——对于非商业、受限、密封、隔离或仅限本地的数据集则绝不保存，且当你使用 `--scores-only` 发布时也绝不保存。

它是一本测量账本，而不是对任何翻译系统的裁决。其上的排名仅说明某种方法在特定指标下针对某个数据集的得分情况。它并不代表翻译质量优秀，也未授予任何人将某种方法用于某个社区语言的许可。

## 三者各自独立

| | 是什么 | 运行位置 |
|---|---|---|
| **评估套件** ([`mt-eval`](/docs/network/specifications/harness)) | 评分工具。给定某种方法和测试集，它会生成评分和运行卡片 | 你的机器 |
| **排行榜** | 提交入口和运行卡片账本，按数据集和语言对方向建立索引 | champollion.dev |
| **网络图谱** | 所有已发布运行的总览：哪些语言对已完成测量，哪些尚未测量 | 账本的一种视图，而非独立组件 |

除了通过排行榜，任何内容都无法进入图谱；除了作为已评分、带指纹的运行记录，任何内容都无法进入排行榜。没有来源证明的测量结果无法成为其中的一部分。

## 两类基准测试

**公开基准测试**使用开放数据集。每个数据集均注册为一张包含“从源获取”指针的元数据卡片：评估套件在运行时从上游下载参考文本，根据固定的 SHA-256 进行校验，并根据所获取的内容进行评分。公开数据可能已经存在于模型的训练数据中，因此数据集带有数据污染评级。评级为 `HIGH` 或 `MEDIUM`（FLORES+ 为 `HIGH`）或完全未评级的数据集属于**仅限相对比较**：可用于比较在其上运行的不同方法，绝不能报告为绝对质量。只有评级为 `LOW` 的数据集才会按绝对质量进行排名。隔离的数据集绝不参与排名：数据库会拒绝针对其提交的分数。
已注册的数据集及其许可通道详见[评估数据集](/docs/network/leaderboard/datasets)。

**密封基准测试**是主办方保留在自己机器上的保留测试集。参赛者永远看不到它们。参赛条目是一个模型或方法，由主办方自己的评分节点针对密封测试集运行；输出的只有评分，且每一次密封运行都需要主办方的授权。目前这些测试集的密钥由组织者持有。社区密钥保管人——目前尚未指定；Champollion 不持有任何密钥份额。奖项仅存在于密封竞赛中，且依循主办方在任何人参赛前声明的条款。如何主办竞赛：[举办主权竞赛](/docs/network/sovereignty/run-a-sovereign-contest)。

## 适用范围

- **书面文本。** 排行榜衡量书面文本的翻译：文档、教育和官方材料、UI 字符串。它不衡量语音、实时口译或开放式对话。
- **基于文本的语言。** 手语机器翻译是另一个完全不同的问题；索引中的手语条目标注为“尚未支持”（[语言的界定](/docs/network/context/what-counts-as-a-language)）。
- **一次仅限一个数据集。** 分数仅能与相同数据集版本上的分数进行比较。排名绝不跨数据集或跨语言比较。
- **针对方法，而非句子。** 分数描述的是某种方法在基准测试上的表现。不会为任何翻译发布逐句置信度（[技术局限](/docs/network/honest-limitations#system-vs-output)）。

## 已发布运行包含的内容

每张新卡片均依据 **scoring standard/1**（[评分规范](/docs/network/specifications/scoring)）进行评分：

- **核心指标：** 语料库级别的 chrF++（0–100），包含其 95% Bootstrap 置信区间及其 sacreBLEU 签名，以便任何人都能重新计算。
- **并列指标：** BLEU、spBLEU 和 TER，以及计算过的 COMET。它们会一并展示，但绝不混合到核心指标中。
- **独立诊断项：** 在相应工具存在的情况下，包含 FST 接受率和精确匹配等诊断指标。它们绝不会计入核心指标或用于运行排名。
- **废弃字段：** 在每张新卡片上，`composite`、`quality_tier` 和 `cost_adjusted` 均为 `null`。旧卡片保留其已存储的综合分，显示为“旧版综合分（已废弃）”。任何自动评分均不带有质量标签。
- **来源追踪：** 数据集 ID 及其 SHA-256、精确的模型标识符（slug）、测试条件、传递给模型的内容（Prompt 的 SHA-256，以及其文本，除非你进行了涂抹脱敏）、成本、评估套件版本以及配置的指纹。完全相同的运行在发布时会自动去重，而独立复现将作为证据计入。
- **信任层级：** 每一行在刚提交时均为*自测*。*Champollion Verified* 表示该评分是根据你提交的输出对照固定的参考文本重新计算得出的；该重新评分程序是由维护人员手动运行的命令，因此目前没有任何行在提交时直接晋级。*Community Validated* 仅能通过社区自身的审核赋予（[验证层级](/docs/network/leaderboard/rules#verification-tiers)）。

完整的模式结构详见[运行卡片规范](/docs/network/specifications/run-card)。

## 发布

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- 向线上排行榜写入必须使用 `--prod`（或 `MT_EVAL_ALLOW_PROD=1`）；缺少此参数时评估套件将拒绝执行。
- `--anonymous` 可在未登录的情况下发布；排行榜上将显示为“anonymous”。
- `--scores-only` 仅发布聚合评分以及数据集的哈希和大小，绝不发布源文本或参考文本——适用于你自己的语料库或私有语料库。
- `--redact-coaching` 会将 Prompt 文本替换为标记占位符并保留其哈希值。仅限本地语料库的指导性 Prompt 默认会被涂抹脱敏。

分步指南详见[提交方法](/docs/network/getting-started/submit-a-method)。

## 全局适用规则

- **绝不在评估数据上训练。** 任何接触过基准测试集的方法——无论是作为训练数据、少样本示例、词典条目还是 Prompt 素材——都将被取消资格（[提交规则](/docs/network/leaderboard/rules)）。
- **优劣由统计检验决定，而非仅看两个数字。** 一个运行记录是否优于另一个，取决于在 chrF++ 上的配对显著性检验；检验无法区分的相邻项将并列排名（[显著性](/docs/network/specifications/significance)）。
- **语料库不在此托管。** 注册仅包含元数据；语料库均从其源头获取。开放许可数据集的已发布运行可包含其逐句文本（如前所述）。
- **许可通道具有结构性约束。** 非商业语料库被排除在所有奖项、API 和商业路径之外。采用修改版、定制或未声明许可（`LicenseRef-*`）的语料库将拒绝远程模型 API 评估，直至权利持有者的同意记录在其卡片上；标准非商业许可仅能通过不用于训练的通道发送至远程模型；密封分段绝不发送至远程。EdTeKLA Plains Cree 数据集被编目为隔离标签，数据库会拒绝针对它们提交的任何评分。

## 当前运行状态

- 排行榜已上线、公开并开放提交。其内容为实时数据，因此本页面不作赘述——请[查看排行榜](/leaderboard)。
- 当前每一行均为自测（参见上文的信任层级）。
- 目前没有设立奖项，也没有任何分数达到奖项门槛（[奖项规范](/docs/network/specifications/prizes)）。
- 尚未开展过社区母语者评审（[母语者验证](/docs/network/specifications/speaker-validation)）。
- 尚未有任何方法根据竞赛条款交付给社区。

[技术局限](/docs/network/honest-limitations)列出了未作承诺的完整清单；若本页面与该页面存在差异，以该页面为准。

## 另见

- [提交规则](/docs/network/leaderboard/rules)——接收标准、取消资格、验证与声誉。
- [评估数据集](/docs/network/leaderboard/datasets)——注册表及其许可通道。
- [提交方法](/docs/network/getting-started/submit-a-method)与[常见问题解答](/docs/network/getting-started/faq)。
- [评分](/docs/network/specifications/scoring)、[显著性](/docs/network/specifications/significance)以及[运行卡片](/docs/network/specifications/run-card)。
- [贡献算力](/docs/network/getting-started/contributing-compute)——使用你自己的密钥运行公共队列中的任务。
