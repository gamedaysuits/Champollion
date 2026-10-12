---
sidebar_position: 5
title: "评分规范"
slug: '/network/specifications/scoring'
related:
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# 评分规范

> **执行摘要。** 本文是 Champollion 机器翻译（MT）评估生态系统中运行评分方式的唯一事实来源：包括单一的核心头条指标、与其并列展示的其他标准指标、单独报告的诊断指标，以及成本和速度。运行的评分方式与学术界及业界通行标准完全一致：**语料库级别的 chrF++ 附带其 sacreBLEU 签名和 95% bootstrap 置信区间**，并列报告 BLEU、spBLEU、TER 与 COMET，并采用配对显著性检验来判定一个系统是否优于另一个系统。特定语言的诊断工具（FST 形态学有效性、linter 等价类、确定性语义验证）统称为 **LYSS**（语言学知情收益与结构评分，Linguistically-informed Yield & Structural Scoring）。此前采用的加权综合得分和质量等级标签现已**废弃**（§4、§5）；本文保留其对照表仅为验证旧卡片之用。代码、文档和数据库模式均派生自本文档。若存在冲突，以本文档为准。
>
> **适用范围。** 本文档定义了我们衡量*什么*以及*如何评分*。本文档不定义运行卡片模式（参见 BENCHMARK_SPEC §3）、基准测试协议（BENCHMARK_SPEC §6）或排行榜规则（参见竞技场文档）。这些文档在指标定义和评分逻辑方面均引用本文档。


---

## 运行评分方式 {#how-runs-are-scored}

每次新的运行均按照**评分标准 `standard/1`**进行评分。运行卡片对此有明确说明：`scores.scoring_standard` 为 `"standard/1"`，且 `scores.primary_metric` 为 `"chrf_plus_plus"`。

| 角色 | 内容 | 出现位置 |
|------|------|------------------|
| **头条与排名指标** | 语料库级别 **chrF++**（采用 `word_order=2` 的 sacreBLEU chrF），范围 0–100，附带其 95% bootstrap 置信区间与 sacreBLEU 签名 | 记为 `chrF++ 47.5 [45.9, 49.0]`，其后附带签名。运行卡片：`scores.chrf_plus_plus`，置信区间位于 `scores.confidence_intervals.corpus_chrf`，签名位于 `scores.sacrebleu_signatures.chrf`。数据库：`chrf_plus_plus`、`chrf_ci_lower`、`chrf_ci_upper`。 |
| **其他标准指标** | BLEU、spBLEU（FLORES-200 SentencePiece）、TER，以及计算所得的 COMET | 与 chrF++ 并列展示，各自附带其签名或 COMET 模型 ID。绝不与 chrF++ 或彼此混合。 |
| **诊断指标** | 完全匹配、FST 接受率、形态学准确率、语码转换、幻觉、术语一致性、书写风格，以及每一项评分预警说明（§2.8） | 单独报告并标注为诊断指标。它们绝不计入头条数值，也绝不用于运行排名。预警说明醒目地展示在头条指标旁。 |
| **成本与速度** | Token 数、美元成本、延迟（§6、§7） | 与评分并列报告，绝不与其混合折算。 |

**判定“更优”。** 在同一评估集上的两次运行通过 chrF++ 上的配对显著性检验（默认采用近似随机化检验，配对 bootstrap 重抽样作为可选方案；§8.2）进行比较。其他标准指标也会进行检验并予以展示。凡是不显著的差异均报告为不显著，无论这两个数字大小如何。

**无质量标签。** 自动评分绝非质量定论。新卡片不带有任何等级，也不包含诸如“functional”（可用）或“deployable”（可部署）之类的标签；只有母语者的同行人工评估才能证明翻译质量（参见 [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)）。

**已废弃的内容。** 新卡片发布 `composite: null`、`quality_tier: null` 和 `cost_adjusted: null`（成本调整后得分曾为综合得分除以成本系数；成本本身仍会报告）。新输出均不再打印综合得分或等级。在该标准之前发布的卡片将保留其存储的综合得分并保持可验证性：验证器会使用旧版计算方法（§4）重新派生不含 `scoring_standard` 的卡片，并通过重新派生 chrF++ 来验证 `standard/1` 卡片。只要仍展示旧卡片的综合得分，均会标注为**旧版综合得分（已废弃）**。

**为何以此为标准。** 这是机器翻译评估领域的通行报告方式：

- **WMT** 通过人工评估对其共同任务系统进行排名，并在其旁报告带有 sacreBLEU 签名的自动指标，以便复现这些数值（Post 2018；Kocmi 等，2024）。
- **FLORES-200**（NLLB 团队 2022）报告了 200 种语言的 chrF++ 和 spBLEU，其中大部分为低资源语言。
- 美洲原住民语言翻译的 **AmericasNLP** 共同任务使用 chrF 对系统进行排名（Mager 等，2021；Ebrahimi 等，2023），因为字符级 n-gram 处理丰富形态的能力明显优于词级 BLEU（Popović 2015, 2017）。
- Kocmi 等人（2021）在将自动指标与数千条人工判断进行对比后发现，指标差异的幅度及其是否具有统计学显著性，才是预测人类偏好的关键因素；这正是此处采用配对显著性检验（Koehn 2004；Riezler & Maxwell 2005）而非单纯两数并列对比的原因。

**竞赛。** 竞赛的资格评判标准仅采用 chrF++（0–100），且竞赛的 `primary_metric` 默认为 `chrf_plus_plus`。任何要求将 `composite` 作为其指标的新竞赛都会被拒绝并附带原因说明；在该标准出台之前创建的竞赛继续保持运作。主办方仍可在奖励条款中设置诊断性门槛（例如最低 FST 接受率），作为参赛方案必须通过的关卡，但绝不能作为评分本身（参见[奖励规范](/docs/network/specifications/prizes)）。

**变更标准。** 头条指标仅能随新的标准版本（`standard/2`）发生变更。每张卡片均标明其评分所依据的标准，并依据该标准进行验证。

---

## 1. 评分哲学

### 1.1 微观评估哲学

> *"如果我们只关注什么是通用的，我们将不可避免地忘记它不适用的地方——并失去这些语言及其所有知识和智慧。"*

本项目践行**微观评估开发**：使用最佳可用的语言学工具——有限状态转换器、双语词典、形态分析器、语言学家策划的等价规则——为特定语言量身定制评估指标。这与机器翻译评估中的主流范式相反，后者寻求适用于所有语言的通用指标。通用指标很有价值，但它们在最需要的地方最薄弱：对于具有复杂形态、训练数据有限且在神经指标训练集中没有代表的语言。

我们在许多世界语言的机器翻译方面没有取得进展，不仅是因为我们缺乏语料库，还因为**我们甚至不知道进展是什么样的**——我们缺乏自动化评估工具来衡量翻译系统是否在改进。LYSS 是我们尝试逐语言构建这些工具的努力，使用任何存在的语言学资源。

### 1.2 自动化指标是代理

本文定义的所有指标均为机器计算得出。它们可用于快速迭代、系统对比以及回归检测。它们**不能替代人类判断**，这正是为何任何自动评分都不带有质量标签的原因——唯有人工审查才能确认实际可用性。

### 1.3 一个头条指标，多个辅助信号

没有任何单一指标能够完全捕捉翻译质量。某段翻译可能具有很高的 chrF++ 重合度，但形态学验证不通过。它可能通过 FST 检查，但表达了错误的含义。它可能语义准确，但对目标语言而言文风极不自然。因此，每次运行都会报告多个信号——但唯有 chrF++ 作为头条与排名指标，其他信号则并列展示，绝不混合折算。对于不同语言具有不同含义的信号混合体极易被在低成本信号上表现良好的系统所投机利用（§4 记录了已废弃的综合得分是如何被投机的），而且读者无法从混合数值中看出究竟是哪个信号发生了变化。

### 1.4 可扩展性

该指标库并不是封闭的。新的语言会带来新的需求：声调语言的声调准确性、闪含语系文字的变音符号精度、克里语的音节文字正确性。该架构（MetricPlugin 协议）允许在不改变任何头条得分的情况下添加诊断指标。特定语言的指标（例如 CRK 的 linter 和语义验证器）在语言卡片的 `evalMetrics` 下声明，并从 `eval_standards/` 加载——测试框架本身仅附带通用行为指标（语码转换、幻觉、术语）。

### 1.5 三个评估维度

每个运行卡测量三个独立维度：

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

这些是相互独立的维度。某种方法可能得分很高但成本昂贵、速度极快但不准确，或者二者的任意组合。排行榜支持按任意维度进行排序。发布的数值绝不会将它们合并（此前合并二者的成本调整后得分，§6.3，现已废弃）。

### 1.6 验证状态

本规范中的每个指标都有一个**验证状态**，不同于其实现状态（§3）。实现状态跟踪代码是否存在。验证状态跟踪指标是否已被证明与人类质量判断相关。

| 验证级别 | 含义 | 当前指标 |
|---------|------|--------|
| **✅ 外部验证** | 存在已发表的人类相关性研究（WMT、学术论文） | `chrf_plus_plus`、`bleu`、`comet_score` *（仅高资源对）* |
| **⚡ 代理验证** | 为高资源语言验证；对我们的目标低资源语言未验证 | `comet_score` *（对于低资源语言：在高资源/欧盟对上验证，推断到例如 CRK——方向上有用但未校准）* |

| **🔶 工程启发式** | 根据语言学原理或观察到的故障模式设计；无人类相关性数据 | `fst_acceptance_rate`、`morphological_accuracy`（基于 FST、词元匹配、验证器重新派生）、`equivalent_match_rate`、`semantic_score`、`code_switching_rate`、`hallucination_rate`、`terminology_adherence` |
| **🔲 未经验证** | 尚未在任何数据上进行测试 | `orthographic_accuracy`、`consistency_score` |

> **为什么 `comet_score` 出现在两行中。** 这是按资源水平进行的区分，并非矛盾。在存在 WMT 人类相关性研究的高资源、主要是欧洲语言对中，COMET 是*经过外部验证的*。对于我们的目标低资源语言，尚无此类研究，因此该指标仅为*代理验证*：模型是从具有不同形态系统的语言中外推得出的。它附带模型 ID 和校准预警说明与 chrF++ 并列展示，绝不混合计算。

> **这在实践中意味着什么。** 头条指标（chrF++）是一项经过外部验证的指标，其使用方式与学术界通行做法完全一致。上述所有工程启发式均为**诊断指标**：它们可以解释*为什么*某次运行会得到这样的分数（词汇不是有效形式、输出中夹杂英语），但绝不能作为评分本身，也绝不参与运行排名。已废弃的综合得分（§4）将所有验证级别的启发式指标放入头条指标中，导致系统在未进行翻译的情况下就能获得大部分分数（§4）。
>
> **要求的验证实验**（参见 `mt-evaluation-landscape.md` §6 和 `speaker-validation.md`）：
> 1. 人类判断相关性研究：由 3 名以上双语母语者对 200+ 句对进行评分
> 2. 代表性语料库上的 FST 错误拒绝率测定
> 3. 第二语言移植（北萨米语）以测试泛化能力
> 4. 在同一数据上与 COMET 进行直接对比


---

## 2. 指标清单 {#2-metric-inventory}

指标分为六个类别（表面、结构、语义、行为、合规性与报告的对照指标）。每个指标都有实现状态、尺度和级别（单条目、语料库级别或二者兼有），并在标准下担任三种角色之一：**头条指标**（仅限 chrF++）、**标准指标**（BLEU、spBLEU、TER、COMET——并列展示于头条指标旁）或**诊断指标**（其他所有指标——单独报告）。

### 2.1 表面指标

表面指标在字符串级别将预测翻译与参考翻译进行比较。它们不需要语言学工具——只需字符串比较。

| ID | 指标 | 状态 | 尺度 | 级别 | 实现说明 |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | 完全匹配 (Exact Match) | ✅ 已实现 | 0.0–1.0 | 二者兼有 | **诊断指标。** 二元判定：预测值是否 == 参考值？语料库比率 = 匹配数 / 总数。 |
| `equivalent_match_rate` | 等价匹配 (Equivalent Match) | ⚡ 部分实现 | 0.0–1.0 | 二者兼有 | **诊断指标。** 预测输出是否与任何被接受的变体匹配？对于 CRK：通过 CRK 评估标准的 `CrkLinterMetric`（位于 `eval_standards/crk/` 中）使用确定性变体类规则（语序、正字法、可选助词、词元同义词、进行体歧义）实现。通过 CRK 语言卡片的 `evalMetrics` 声明自动加载。通用跨语言实现需要语料库中包含逐条目的 `variants[]`。 |
| `chrf_plus_plus` | chrF++ | ✅ 已实现 | 0–100 | 二者兼有 | **头条与排名指标。** 结合单词 unigram 和 bigram 的字符 n-gram F 分数（sacreBLEU chrF，`word_order=2`；Popović 2017）。对形态变化具有稳健性。发布的数值为语料库级别（`corpus_chrf`），附带 95% bootstrap 置信区间及其 sacreBLEU 签名；单条目数值（`sentence_chrf`）用于显著性检验。 |
| `bleu` | BLEU | ✅ 已实现 | 0–100 | 语料库 | **标准指标，与 chrF++ 并列展示**（运行卡片与数据库 `corpus_bleu`，附带其 sacreBLEU 签名）。词级 n-gram 精确率（Papineni 等，2002）。未作为头条指标是因为词级匹配会将后缀不同的正确词汇视为完全未命中，这对形态丰富的语言极不公平。 |
| `ter` | 翻译编辑率 (TER) | ✅ 已实现 | 0–∞（越低越好） | 二者兼有 | **标准指标，与 chrF++ 并列展示**（`scores.ter`，附带其 sacreBLEU 签名）。预测与参考之间的最小编辑距离，按参考长度归一化（sacreBLEU `corpus_ter`；Snover 等，2006）。 |
| `length_ratio` | 长度比 (Length Ratio) | ✅ 已实现 | 0–∞（1.0 为理想值） | 二者兼有 | **诊断指标。** 字符维度的 `len(predicted) / len(reference)`。检测截断（<0.5）和膨胀/幻觉（>2.0）。在语料库级别按条目取平均值。 |

### 2.2 结构指标

结构指标验证翻译的语言学良好形式。它们需要特定语言的工具（FST 分析器、形态分析器），是形态学丰富语言的最强信号。

| ID | 指标 | 状态 | 尺度 | 级别 | 实现说明 |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | FST 接受率 (FST Acceptance) | ✅ 已实现 | 0.0–1.0 | 二者兼有 | **诊断指标。** 有限状态传感器（GiellaLT）对输出词汇的接受情况。若 FST 返回至少一个形态分析结果，则该词为“有效”。**聚合方式：**发布的语料库数值为**单条目比率的均值**——即各条目的接受词数 ÷ 该条目总词数，并在 FST 分析过的条目上取平均值，空输出计为 0（插件的 `avg_fst_validity`）。合并词汇比率（所有接受词数 ÷ 所有词数，`corpus_validity_rate`）在运行报告和运行卡片中并列报告，但不是发布的正式数值；当条目长度不一时，两者存在差异。适用于任何具备 GiellaLT `.hfstol` 分析器的语言。**大小写：**词汇按原样查找；如果 FST 拒绝该词且该词以大写字母开头，则将其首字母转为小写后再次查找（`Mun` → `mun`），全大写词汇先转为词首字母大写（Titlecase）再转为全小写查找（`OSLO` → `Oslo`，`GIITU` → `giitu`）。反之则不然：以小写形式书写的专有名词（`oslo`）仍保持被拒绝状态。GiellaLT 的拼写检查接受器（北萨米语、阿姆哈拉语、巴斯克语）和 ALTLab 的严格平原克里语分析器大多仅列出小写词汇，而将大小写处理留给外部程序，因此如果不做此处理，正确的句首大写词会被判为无效词。此计算版本为 `case-fallback/1`，在报告（`fst_acceptance_method`，附带 `total_case_folded_words` 及各条目的 `fst_case_folded_words`）和运行卡片（`fst_provenance.acceptance_method`）中均有标明。未标明该版本的报告均采用区分大小写的方式评分，对于大写文本其得分会偏低；`mt-eval compare` 在对比两者时会指出这一点，且 `mt-eval test <run log>` 会对旧运行重新评分。验证器会根据已发布卡片标明的方法重新派生基于 FST 的数值，若卡片未标明则按区分大小写重新派生，从而确保卡片始终针对其发布时的计算方式进行校验。 |
| `morphological_accuracy` | 形态学准确率 (Morphological Accuracy) | ✅ 已实现（验证器重新派生） | 0.0–1.0 | 二者兼有 | **诊断指标。** 词汇可能在 FST 层面有效，但屈折变化错误（词根正确，后缀错误）。由 `plugins/giellalt_fst.py` **计算**：针对每个可分析的预测词，寻找与其共享**词元**（词根）的参考词，并检查预测的**屈折**（FST 特征标签）是否匹配。通过词元而非位置进行匹配避开了词对齐问题：不同的词汇选择或未对齐的词对仅被视为未覆盖（绝不会误判给分）。**无需黄金标准标注**——参考译文的 FST 分析结果*本身即是*真值。FST 无法分析或词根不在参考译文中的词均超出覆盖范围；系统会公开 `morph_coverage`（词元匹配的比例），低于 `MORPH_COVERAGE_FLOOR`（0.25）时该值会被标记为仅供参考。在 **FST 存在歧义时采取宽容判定**（具有多个分析结果的预测词只要有*任意一个*匹配即算作“正确” → 相当于公开的上限）。它需要一个**分析器**：仅为拼写检查**接受器**的 FST（为北萨米语、阿姆哈拉语和巴斯克语安装的 Divvun 拼写检查包）只能判断词汇是否存在，但不提供词元或标签。对于此类语言，`morphological_accuracy` 和 `morph_coverage` 均为 null，且 `metric_availability` 会说明原因；FST 接受率仍会正常报告。FST 固定配置声明了这一点（`kind: "acceptor"`），并且该指标还能检测出从不返回标签的传感器。它**由验证器针对规范语料库重新派生**（`verifier.recompute_corpus_morph` 会重新运行卡片固定的 FST——如果缺失 FST 则按故障闭锁处理，约定与 COMET 相同）。在已废弃的综合得分中，它在 fst-coverage 配置文件中占 0.15 的权重（§4.3）。 |
| `orthographic_accuracy` | 正字法准确率 (Orthographic Accuracy) | 🔲 计划中 | 0.0–1.0 | 二者兼有 | **诊断指标（计划中）。** 验证特定文字的正确性：克里语的标准罗马正字法（SRO）长音符号/折音符号用法、伊努克提图特语的变音符号、奥吉布瓦语的元音长度标记。针对不同语言设立独立规则集。 |

> **结构指标增加了什么，以及为什么它们是诊断指标。** Meta 的 OMT-1600——有史以来发布的最大 MT 系统（涵盖 1,600 种语言；Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026）——使用 ChrF++、xCOMET、MetricX 和 BLASER 3 进行评估。这些指标均未验证形态学正确性：chrF++ 衡量字符 n-gram 重叠度并奖励*看起来*像参考译文的字符串，因此与参考译文共享许多字符但形态无效的词汇仍能得分。FST 接受率回答的是另一个问题：每个词是否都是该语言中的有效形式？这使它成为多式综合语非常有用的诊断指标。它不是翻译评分：它从不检查源文或参考译文，因此对每个输入都输出同一句有效句子的系统能完全通过该项测试（§4 给出了实测案例）。ChrF++ 还有一个因正字法而异的**非零随机底线**——相同文字的随机文本得分明显高于零，且在某些书写系统中比其他书写系统更高——因此原始 chrF++ 无法跨语言直接比较；它仅用于对同一评估集上的系统进行排名。因此网络图**绝不**跨语言对实力进行横向排名——连线仅表示该语言对已进行了测量，仅此而已。我们为此构建的随机底线校正（cchrF++）属于已发表的研究，未接入任何公开展示界面；[连接强度](/docs/network/specifications/connection-strength)阐明了它能证明什么以及不能证明什么。

### 2.3 语义指标

语义指标使用嵌入或学习模型测量意义保留。它们捕捉表面不同但意义等价的翻译，并标记表面相似但语义错误的翻译。

| ID | 指标 | 状态 | 尺度 | 级别 | 实现说明 |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | 语义相似度 (Semantic Similarity) | ⚡ 部分实现 | 0.0–1.0 | 二者兼有 | **诊断指标。** CRK：来自 CRK 评估标准 `CrkSemanticMetric`（位于 `eval_standards/crk/` 中，代理）的判定加权分。通用：句子嵌入的余弦相似度（源文 + 预测值 vs 源文 + 参考值）。模型待定——必须支持低资源语言，这排除了大多数以英语为中心的嵌入模型。 |
| `comet_score` | COMET | ✅ 已实现 | ~0.0–1.0 | 二者兼有 | **计算时作为标准指标，附带模型 ID 与 chrF++ 并列展示**（`comet_model`）。基于学习的 MT 评估指标（Rei 等，2020）。绝不与 chrF++ 混合。由验证器重新派生，因此报告的数值必须能够复现。针对平原克里语等语言标记低资源校准预警说明。当安装了 `unbabel-comet` 时进行计算。对于 35 种非洲语言，测试框架会通过 `resolve_comet_model()` 自动选择 AfriCOMET（`masakhane/africomet-mtl`），该模型在这些语言上具有更好的人类判断相关性。 |

> **为什么 COMET 并列于头条指标旁，而非作为头条指标。** COMET 是在 WMT 人工评估数据上训练的，其中绝大多数是高资源欧洲语言对。对于真正的高资源语言对（德语、法语……），默认的 `Unbabel/wmt22-comet-da` 得到了 WMT 的充分验证，`resolve_comet_model()` 也会自动选择它。应用于平原克里语或其他低资源语言（LRL）时，该模型是从形态系统不同的语言中外推的——具有方向指导意义但未经校准，卡片对此也会特别注明。此外它还需要一个 2.3 GB 的模型，因此并非每次运行都会计算。chrF++ 仅凭语料库即可在所有语言上完全复现，这正是将其作为头条指标并在计算出 COMET 时并列报告的原因。

> **非洲语言的 AfriCOMET。** 每个语言卡都有一个 `metricModelSupport` 字段（见语言卡规范 §9），声明为该语言训练的哪些专门 COMET 模型。对于 35 种非洲语言（yor、hau、ibo、amh、swa 等），卡声明 AfriCOMET（`masakhane/africomet-mtl`）——由 Masakhane 社区在非洲语言机器翻译人类判断上微调的 COMET 模型。评估工具通过 `resolve_comet_model()` 从语言卡读取自动选择推荐模型，但这可以用 `--comet-model` 覆盖。添加新的语言→模型映射是通过丰富语言卡完成的（不编辑 Python 代码）。

### 2.4 行为指标

行为指标用于检测翻译输出中的特定故障模式。它们不直接衡量质量——而是检测问题。所有这些指标均为**诊断指标**。

| ID | 指标 | 状态 | 尺度 | 级别 | 实现说明 |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | 语码转换率 (Code-Switching Rate) | ✅ 已实现 | 0.0–1.0（越低越好） | 二者兼有 | 输出词汇中属于源语言（通常为英语）的比例。通过 Unicode 脚本分析和/或源语言词表检测。非常常见的 LLM 故障模式：当模型不知道目标语言对应词汇时会直接插入英语单词。 |
| `hallucination_rate` | 幻觉率 (Hallucination Rate) | ✅ 已实现 | 0.0–1.0（越低越好） | 二者兼有 | 输出内容中没有对应源内容的比例。通过词对齐或跨语言嵌入重叠度检测。捕获模型生成听起来合理但实属捏造的翻译的情况。 |
| `terminology_adherence` | 术语一致性 (Terminology Adherence) | ✅ 已实现 | 0.0–1.0 | 二者兼有 | 针对带提示引导（coached）的方法：输出中出现规定术语的比例。需要术语表（`{"source term": "translation"}`，或每个术语的可接受翻译列表）。数据源为 `--glossary <file.json>`，这是一个从不发送给模型且提供给所有参与对比运行的评估输入。否则为 JSON `--coaching-file` 的 `dictionary` 对象：此时运行将根据其自身的提示引导内容进行评分，运行输出会注明这一点。若两者皆无，则该指标处于非活动状态（null）。衡量模型是否遵循专家提供的词汇。 |
| `consistency_score` | 跨条目一致性 (Cross-Entry Consistency) | 🔲 计划中 | 0.0–1.0 | 仅语料库 | 模型在不同条目中对同一源术语的翻译是否一致？低一致性表明模型是在猜测而非应用习得的模式。需要语料库条目间存在重复出现的术语。 |

### 2.5 合规指标

合规性指标验证翻译是否保留了结构完整性——占位符、格式和排版惯例。它们是质量把关检查，而非质量评分，在标准下均归为诊断指标。

| ID | 指标 | 状态 | 尺度 | 级别 | 实现说明 |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | 双阶段合规性 (Double-Pass Compliance) | 🔲 计划中 | 0.0–1.0 | 二者兼有 | 加权综合得分：60% 变量完整性（`{placeholder}` 变量是否保留？）+ 20% 引号合规性（目标语言的引号字符）+ 20% 大小写合规性（对无大小写区分的语言无拉丁字母泄漏）。在原始输出和后处理输出上同时计算。存在 `DoublePassCompliancePlugin` 类，但目前没有评估运行加载它，也尚无每种语言引号和大小写惯例的引用来源。语言卡片暂不包含它们。若无该数据源，仅有变量完整性项具有实际测量意义。 |
| `repair_effectiveness` | 修复有效性 (Repair Effectiveness) | 🔲 计划中 | 0.0–1.0 | 语料库 | 被翻译后钩子自动修复的合规性违规比例。衡量质量关卡对原始输出的改善程度。因与 `compliance_index` 相同的原因目前处于计划阶段。 |

> **为什么合规性是一道门槛，而不是评分。** 合规性指标衡量的是结构保留情况（占位符、引号），而非翻译质量。某段翻译在语言学上可能无懈可击，但由于遗漏了 `{name}` 变量导致合规性不合格。它们被设计为质量关卡，旨在阻止糟糕输出上线，而非对翻译质量进行高低排序。

### 2.6 报告的对照指标

spBLEU 是与 chrF++ 并列展示的标准指标之一；标准 chrF 和 FUSE 风格的对照指标也会予以报告，以便与已发表的其他表格进行对比。它们均不与任何其他指标混合：

| ID | 指标 | 状态 | 说明 |
|----|--------|--------|-------|
| `spbleu` | spBLEU（FLORES-200 分词器） | ✅ 已实现 | **标准指标，与 chrF++ 并列展示**（`scores.spbleu`，附带其 sacreBLEU 签名）。在 FLORES-200 SentencePiece 分词（Goyal 等，2022）上的 BLEU——可跨书写系统/分词进行比较（NLLB/FLORES 通用标准）。需要 `sentencepiece`（核心依赖）。 |
| `chrf_plain` | 标准 chrF (`word_order=0`) | ✅ 已实现 | AmericasNLP 和许多 WMT 表格所报告的 chrF 数值，与我们的 chrF++ 头条指标（`word_order=2`）并列展示。其签名为 `sacrebleu_signatures.chrf_plain`。 |
| `fuse_score` | FUSE 风格对照指标 | ⚡ 需主动启用 (`--fuse`) | AmericasNLP-2025 FUSE 方法（Raja & Vats）的**未训练重新实现**：LaBSE 语义 + 词汇 token-F1 + 语音 Soundex + 模糊 difflib，按*无权均值*混合（我们缺乏人工判断训练数据来拟合原版的 Ridge/GBM，并对此予以明示）。LaBSE/Soundex 属于可选的 `fuse` 附加组件；在缺少 LaBSE 的情况下，`compute_fuse` 会返回 `None`（已声明）而不是伪造分数。运行的每个组件均列在 `fuse_components` 中；结果标记为 `fuse_untrained=true`。仅作为诊断对照指标。 |

### 2.7 指标命名空间 {#2-7-metric-namespaces}

单个指标在堆栈中携带最多四个协调的名称：
**规范 id**（运行卡中的 `scores` 键，例如 `equivalent_match_rate`）、
Python **插件名称**计算它（例如 `crk_linter`）、语言卡
**`evalMetrics` 键**声明它（例如 `lyss-eq`）和非规范化
**`run_cards` 列**在排行榜上（例如 `equivalent_match_rate`）。这些故意不同——插件名称说明*工具*，指标 id 说明*测量*——但它们必须保持同步。

该映射的唯一事实来源是由 `mt_eval_harness.metric_manifest` 加载的 `shared/metric-registry.json`。每个条目记录了四个名称，外加 `scale`、`direction`（更高/更低/中性）、`level`（条目/语料库/二者兼有）、`in_composite`（是否包含在已废弃的综合得分中；保留用于验证旧卡片）以及 `verifier_reproducible`。如果 `scoring.py` 的表格或由 `publish.py` 生成的运行卡片 `scores` 键脱离了注册表定义，一致性测试将会失败，从而防止新指标在接线不完整的情况下上线。

两个相关的运行卡字段使指标来源明确：

- **`scores.metric_availability`** —— 用于明确 `null` 分数具体含义的 `{metric: reason}` 块：`not_applicable`（该语言/运行不使用该指标）、`unavailable`（缺少可选依赖项）、`below_coverage_floor`（存在但数据过于稀疏，仅作参考）、`not_run`（需主动启用但未请求）或 `not_implemented`（计划中）。该块中未出现的指标表示正常计算。
- **`fst_version`** / **`fst_provenance`** —— 任何基于 FST 的指标背后安装的 GiellaLT 传感器版本和 `pyhfst` 版本，以与 sacreBLEU 签名相同的方式进行捕获，以便结构评分可以追溯到确切的分析器构建版本。`fst_provenance.acceptance_method` 说明了接受率是如何根据传感器的响应计算得出的（`case-fallback/1`，§1）；不含该字段的卡片表示按区分大小写方式评分。
- **`scores.sacrebleu_signatures`** —— 运行所计算的每个 sacreBLEU 指标的 sacreBLEU 签名：`chrf`（chrF++ 头条指标，`word_order=2`）、`chrf_plain`、`bleu`、`spbleu`、`ter`。两个 chrF++ 数值仅在签名匹配时才具有可比性（Post 2018）。

### 2.8 评分预警说明 {#2-8-score-caveats}

某项评分即使计算正确，其实际含义也可能偏离表面标签所代表的意义。测试框架会针对所有已知的此类情况对每次运行进行检查，一旦触发，便会在测试摘要、`mt-eval compare`、发布预览及信息看板中紧随头条指标打印该预警说明，发布的卡片也会将其携带为 `score_caveats`，以便排行榜同步展示。预警说明绝不会篡改评分；它仅指明其局限性所在。每项预警都是一个诊断项，包含一个 `severity`（`major` 或 `minor`）以及一句包含具体统计数字的说明文本，绝不会直接引用输出文本本身。

| 预警说明 | 触发条件 |
|--------|-----------|
| `source_copy` | 至少有一半的评分输出与源文相同（忽略大小写、重音和标点）。其参考译文本身即为源文的条目（如专有名词、数字）不计在内。 |
| `length_deflation` | 输出平均长度低于参考译文长度的 0.5 倍，或有四分之一及以上的输出存在此情况——表明遗漏了词汇。FST 接受率和语码转换仅对实际存在的词汇进行判定，因此删减词汇反而会使其数值虚高。 |
| `length_inflation` | 输出平均长度超过参考译文长度的 2 倍，或有四分之一及以上的输出存在此情况（例如少样本提示的示例泄露到了每个输出中）。 |
| `near_constant_output` | 多个不同的输入得到了完全相同的单一输出：重复输出覆盖了至少四分之一且不少于 5 个不同的源文本。当有 3 个源文本得到该输出（三个词及以上的输出）或 5 个源文本得到该输出（一到两个词的输出，因为短回答如“Yes.”属于合法的重复）时计为重复输出；与自身参考译文相同的输出属于正确答案，不计入重复。在选定这些界限之前，该规则曾在 WMT 2019–2025 指标任务中的 2,161 个真实系统输出和参考译文上运行验证；其标记出的 5 处均为异常故障输出。 |
| `train_test_near_twin` | 由 nmt-forge 记录：测试集中的每一行（或几乎每一行）在训练数据中都有高度相似的副本，因此该得分衡量的是对训练短语的记忆召回能力，而非翻译能力。 |

---

## 3. 指标状态等级

§2 中的每个指标都属于四个实现等级之一：

| 等级 | 含义 | 运行卡行为 |
|------|------|----------|
| **✅ 已实现** | 代码存在、已测试、今天在运行卡中生成值 | 运行卡中的数值 |
| **⚡ 部分** | 特定语言代理存在（例如 CRK）但通用实现待定 | 当代理适用时的数值，否则 `null` |
| **🔲 计划** | 已指定但尚未实现 | 运行卡中的 `null`（字段存在，值不存在） |
| **💡 提议** | 正在讨论，尚未指定 | 不在运行卡中 |

指标从计划 → 部分移动当：
1. 特定语言实现被合并和测试
2. 它为至少一个语言对生成值
3. 通用实现保持待定（在本规范中记录）

指标从部分 → 已实现移动当：
1. 特定语言无关的实现被合并和测试
2. 它为任何语言对生成值而不需要特定语言插件
3. 本文档更新以反映 ✅ 状态

指标从计划 → 已实现移动当：
1. 实现被合并和测试
2. 它已在至少一个真实评估运行上验证
3. 本文档用其实现细节更新

指标从提议 → 计划移动当：
1. 其定义、规模和计算方法被同意
2. 它被添加到本文档中，带有 `🔲 Planned` 状态
3. 空占位符被添加到运行卡模式

---

## 4. 已废弃：综合得分（旧版） {#4-composite-score}

> [!CAUTION]
> **新运行均不再使用综合得分进行评分。** 该指标已随评分标准 `standard/1` 废弃（参见[运行评分方式](#how-runs-are-scored)）。新卡片发布 `composite: null`。保留本节**仅**为了让在该标准之前发布的卡片仍可被读取和验证：验证器使用下文完全相同的公式和表格，对任何不带 `scores.scoring_standard` 的卡片重新派生其存储的综合得分。只要仍展示旧卡片的综合得分，均会标注为**旧版综合得分（已废弃）**，且绝不与 chrF++ 或新卡片进行对比。

### 废弃原因 {#why-the-composite-was-retired}

综合得分是 chrF++/100、完全匹配、FST 接受率（权重 0.25）、形态学准确率、语义得分、语码转换、幻觉和术语的加权混合，其权重由工程经验设定，从未与人类判断进行拟合。由于其多项输入指标从不将输出与源文或参考译文进行比对，系统在完全不翻译的情况下也能获得大部分分数：

- **对所有输入输出相同的一句话。** 一个未经训练的英语→北萨米语模型对每个输入都重复输出同一句合法的北萨米语句子，其综合得分高达 **0.6244**——被贴上“functional”（可用）的标签——而其 **chrF++ 仅为 5.5**。重复的词汇是合法的萨米语，因此 FST 接受率为 100%，对于 FST 仅为拼写检查接受器的语言，在将缺失指标重新加权剔除后，FST 接受率约占综合得分的 45%。
- **丢弃无法翻译的内容。** 一个简易词表将所有不认识的词汇直接丢弃，得分却高达 **0.6612**，因为 FST 接受率和语码转换仅针对输出中包含的词汇进行判定。
- **直接复制源文。** 英语未做任何修改直接作为“北萨米语”输出仍能获得 FST 得分，因为拼写检查器会接受大写词汇和部分英语单词。

没有任何标准的评估体系会将这些系统排在真正翻译的前面，chrF++ 也不会：它将每个输出都与其参考译文进行严格比对。测试框架的预警说明（§2.8）也能捕捉到这些模式，并在 chrF++ 头条指标旁醒目展示。

### 4.1 公式（旧版）

综合得分是所有*可用*指标的加权平均值，经过重新归一化以使可用指标的权重之和为 1.0：

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

如果某个指标在运行卡片中的值为数值（非 `null`），则该指标为“可用”。当某个指标不可用时（例如语言缺少 FST，或某个指标尚未实现），其权重将按比例重新分配给其余指标。由不同指标集计算出的综合得分绝不具有可比性；每张旧版卡片均记录了其 `scores.scoring_profile` 和 `scores.metric_availability`（§2.7），以便验证器知道使用哪个集合。

### 4.2 输入归一化（旧版）

在代入综合得分公式之前，每个指标都会被转换到 **0.0–1.0 尺度**上，其中 1.0 = 完美：

| 指标 | 原生规模 | 规范化 |
|------|---------|------|
| `exact_match_rate` | 0.0–1.0 | 无（已规范化） |
| `equivalent_match_rate` | 0.0–1.0 | 无 |
| `fst_acceptance_rate` | 0.0–1.0 | 无 |
| `morphological_accuracy` | 0.0–1.0 | 无 |
| `chrf_plus_plus` | 0–100 | **除以 100** |
| `semantic_score` | 0.0–1.0 | 无 |
| `code_switching_rate` | 0.0–1.0（越低越好） | **`1.0 - value`**（反转：0% 代码切换 = 1.0） |
| `hallucination_rate` | 0.0–1.0（越低越好） | **`1.0 - value`**（反转） |
| `terminology_adherence` | 0.0–1.0 | 无 |

### 4.3 权重表（旧版） {#43-weight-tables}

每种语言通过 `language_cards.resolve_scoring_profile()` 解析为**指定配置文件**（当 FST 参与评分时为 `fst-coverage`，否则为 `surface-only`，除非语言卡片声明了 `scoringProfile.basis`）；该配置文件映射在 `scoring.py` 的 `PROFILE_REGISTRY` 中，并在每张旧版卡片上记录为 `scores.scoring_profile`。`orthographic_accuracy` 虽然列在 `scoring.INACTIVE_METRICS` 中但从未实际计算，因此其权重总是被重新分配。`morphological_accuracy` 仅在 `morph_coverage ≥ 0.25` 时计入。神经评估指标（`comet_score`、`qe_score`；`scoring.NEURAL_METRICS`）从未包含在任何综合得分中。

#### `fst-coverage`（配置文件 A）：具有 FST 覆盖的语言

| 指标 | 目标权重 | 理由 |
|------|---------|------|
| `fst_acceptance_rate` | **0.25** | 最高权重。如果 FST 拒绝一个词，它不是语言中的有效形式——无论其他指标说什么。二进制、结构上有根据。 |
| `morphological_accuracy` | **0.15** | 一个词可以是 FST 有效但形态学错误（正确的词根、错误的屈折）。与 FST 一起，结构指标占 40%。 |
| `chrf_plus_plus` | **0.15** | 字符 n-gram 重叠：多综合语言的最佳表面级代理。比词级指标更好地处理胶着形态学。 |
| `semantic_score` | **0.15** | 表面形式分散时的意义保留。捕捉通过结构检查但语义错误的翻译。 |
| `equivalent_match_rate` | **0.10** | 奖励可接受的变体，不仅仅是一个参考翻译。对于具有灵活词序的语言很重要。 |
| `code_switching_rate` | **0.05** | 惩罚源语言泄漏。反转：0% 代码切换 = 1.0。 |
| `terminology_adherence` | **0.05** | 奖励尊重规定词汇的指导方法。仅当存在指导数据时活跃。 |
| `hallucination_rate` | **0.05** | 惩罚虚构内容。反转：0% 幻觉 = 1.0。 |
| `exact_match_rate` | **0.05** | 最低权重。对多综合语言太严格——存在多个正确翻译。保留为天花板检查。 |

> **总计：1.00。** 在 `morphological_accuracy` 缺失的情况下（无 FST 分析器、仅有接受器的 FST 或覆盖率低于 0.25），其余 8 个指标（总计 0.85）各自乘以 1/0.85 ≈ 1.176 进行缩放。对于仅有接受器 FST 且缺乏评估标准和词表的语言（北萨米语、阿姆哈拉语、巴斯克语），仅剩下 FST 接受率 0.25、chrF++ 0.15、语码转换、幻觉和完全匹配（各 0.05）——总计 0.55——因此 FST 接受率占到了综合得分的 **0.25/0.55 ≈ 45%**。上述漏洞案例正是利用了这一加权机制。

#### `surface-only`（配置文件 B）：没有 FST 覆盖的语言

| 指标 | 目标权重 | 理由 |
|------|---------|------|
| `semantic_score` | **0.25** | 没有结构验证，意义保留是最强的可用信号。 |
| `chrf_plus_plus` | **0.25** | 没有 FST，字符级重叠成为主要表面检查。 |
| `equivalent_match_rate` | **0.15** | 变体匹配提供结构化质量评估而不需要形态学工具。 |
| `exact_match_rate` | **0.10** | 没有 FST，精确匹配作为唯一结构验证代理携带更多权重。 |
| `code_switching_rate` | **0.10** | 没有 FST 捕捉坏输出时，源语言泄漏更重要。 |
| `terminology_adherence` | **0.05** | 指导词汇合规。 |
| `hallucination_rate` | **0.05** | 虚构内容检测。 |
| `orthographic_accuracy` | **0.05** | 脚本特定的正确性填补缺失 FST 留下的部分空白。 |

> **总计：1.00。** `orthographic_accuracy` 从未计算，因此其余 7 个指标（总计 0.95）按 1/0.95 ≈ 1.053 进行缩放。

#### `no-reference`：没有黄金参考的运行

| 指标 | 目标权重 | 理由 |
|------|---------|------|
| `fst_acceptance_rate` | **0.40** | 形态学有效性不需要参考；当 FST 存在时最强的确定性信号。 |
| `code_switching_rate` | **0.25** | 源语言泄漏（反转）。 |
| `hallucination_rate` | **0.20** | 虚构内容（反转）。 |
| `terminology_adherence` | **0.15** | 指导词汇合规。 |

> **总计：1.00。** 适用于语料库缺少黄金标准参考译文的运行。如果此类运行同时缺少 FST，综合得分将仅基于行为检查项重新归一化。

### 4.4 添加新指标

新指标作为**诊断指标**添加；它绝不能更改头条指标：

1. 在 §2 中**定义它**，状态设为 `🔲 Planned`，包括尺度、级别、方向和计算方法。
2. 将其**实现**为一个 MetricPlugin（或针对核心指标在 `tester.py` 中实现）。
3. 在 `shared/metric-registry.json` 中**注册它**，并在运行卡片的得分块中添加 null 占位符。
4. 若运行卡片模式发生变化，**更新 BENCHMARK_SPEC.md** §3。
5. **运行验证基准测试**以确认该指标在真实数据上能够生成合理的数值。
6. **更新本文档**将状态从 `🔲` 修改为 `✅`。

更改头条或排名指标不属于“添加指标”范畴：它需要发布新的评分标准版本（参见[运行评分方式](#how-runs-are-scored)）。

---

## 5. 已废弃：质量等级（旧版） {#5-quality-tiers}

> [!CAUTION]
> **新卡片均不带有质量等级。** 新卡片发布 `quality_tier: null`，新输出中也不再打印任何等级或诸如“functional”（可用）或“deployable”（可部署）之类的标签。自动评分绝非质量定论：同样的数字在不同语言和评估集中的含义截然不同，而且旧版等级曾将对所有输入重复同一句话的系统评为“可用”（§4）。唯有母语者的人工评估才能证明质量（参见 [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)）。

等级是直接从旧版综合得分读取的标签。旧版卡片仍存储它们；保留在此仅供读取旧卡片之用，不代表任何质量保证。

| 旧版等级 | 旧版综合得分范围 |
|------|----------------|
| Baseline（基线） | 0.00–0.30 |
| Emerging（初现） | 0.30–0.50 |
| Functional（可用） | 0.50–0.70 |
| Deployable（可部署） | 0.70–0.85 |
| Fluent（流畅） | 0.85–1.00 |

### 5.1 等级阈值（机器可读，旧版）

旧版阈值（自顶向下评估，命中首项生效）：

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. 成本指标

成本指标衡量翻译方法的经济效率。它们与评分并列报告，绝不与其合并折算。

### 6.1 令牌指标

| ID | 指标 | 计算 |
|----|------|------|
| `prompt_tokens` | 总输入令牌 | 所有 API 调用中 `usage.prompt_tokens` 的总和 |
| `completion_tokens` | 总输出令牌 | `usage.completion_tokens` 的总和 |
| `reasoning_tokens` | 思维链令牌 | `usage.completion_tokens_details.reasoning_tokens` 的总和（大多数模型为 0） |
| `cached_tokens` | 提供商缓存令牌 | `usage.prompt_tokens_details.cached_tokens` 的总和 |
| `total_tokens` | 总消耗令牌 | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | 每个翻译的平均令牌 | ✅ `total_tokens / entry_count` |

### 6.2 成本指标

| ID | 指标 | 计算 | 用例 |
|----|------|------|------|
| `total_cost_usd` | 总运行成本 | 提供商报告的定价 × 令牌计数 | "这个基准花了多少钱？" |
| `cost_per_entry_usd` | 每个语料库条目的成本 | `total_cost_usd / entry_count` | 在相同语料库上比较方法 |
| `cost_per_1k_tokens` | 每 1,000 令牌的成本 | ✅ `total_cost_usd / total_tokens × 1000` | 通用大语言模型效率——在语料库间可比 |
| `cost_per_source_char` | 每个源字符的成本 | `total_cost_usd / total_source_chars` | 在具有不同分词的语言间可比 |

> **为什么有多个成本指标？** 一个"条目"的长度变化——3 个词的短语成本低于段落。`cost_per_entry_usd` 对于在*相同*语料库上比较方法很有用（相同条目 = 相同长度 = 公平比较）。`cost_per_1k_tokens` 是标准大语言模型效率指标，在*不同*语料库间可比。`cost_per_source_char` 规范化分词差异——相同句子可能根据模型的词汇分词成不同数量的令牌。

### 6.3 成本调整后得分（已废弃）

旧版卡片包含基于已废弃综合得分计算的成本调整后得分：

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

它已随综合得分一同废弃：新卡片发布 `cost_adjusted: null`。若要综合权衡成本与质量，请将 chrF++（附带其置信区间）与 `cost_per_entry_usd` 并列查看；排行榜支持按任一维度进行排序。

---

## 7. 速度指标

速度指标衡量翻译方法的延迟和吞吐量。与成本一样，速度与评分并列报告，绝不与其合并折算。

| ID | 指标 | 计算 | 级别 |
|----|------|------|------|
| `elapsed_seconds` | 挂钟运行持续时间 | `time_end - time_start` | 运行 |
| `avg_latency_seconds` | 平均按条目延迟 | `Σ latency_s / n_entries` | 语料库 |
| `median_latency_seconds` | 中位按条目延迟 | `latency_s` 的 50 百分位数 | 语料库 |
| `p95_latency_seconds` | 95 百分位延迟 | `latency_s` 的 95 百分位数 | 语料库 |
| `tokens_per_second` | 吞吐量 | `total_tokens / elapsed_seconds` | 运行 |
| `entries_per_minute` | 翻译率 | `entry_count / (elapsed_seconds / 60)` | 运行 |

---

## 8. 置信度和显著性

### 8.1 引导置信区间

置信区间是基于评估集句子片段的分位数 bootstrap 区间（n=1000 次重抽样，α=0.05；Koehn 2004）。chrF++ 区间是头条展示的一部分：`chrF++ 47.5 [45.9, 49.0]`。在评估集较小时区间较宽，若子集过小以致无法生成有意义的区间，测试框架会发出警告。

| 指标 | 报告置信区间 |
|--------|------------|
| `chrf_plus_plus`（头条指标） | ✅ 运行卡片 `confidence_intervals.corpus_chrf`；数据库 `chrf_ci_lower`、`chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`、`exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`、`fst_ci_upper`（仅在存在 FST 数据时计算） |
| `comet_score` | ✅ `comet_ci_lower`、`comet_ci_upper`（从缓存的逐条目得分进行 bootstrap——无冗余神经推理） |
| `composite` | 仅限旧版卡片（`composite_ci_lower`、`composite_ci_upper`）；新运行不再计算 |
| 各难度等级置信区间 | ✅ `confidence_intervals_by_tier` —— 按难度等级（Tier 1-5）划分的 chrF++ 和 exact_match 置信区间 |

### 8.2 配对显著性检验 {#82-paired-significance-tests}

一个运行是否优于另一个运行，由两次运行均翻译过的片段上的 chrF++ 配对显著性检验决定，绝不通过简单的两个数字大小对比来判定。`mt-eval compare --significance` 执行：

- **近似随机化检验**（默认方式；Riezler & Maxwell 2005，亦为 sacreBLEU 默认设置）：将两个系统的输出逐段随机对调 1,000 次，以观察偶然出现至少同样大差异的概率。
- **配对 bootstrap 重抽样**（`--method paired_bootstrap`；Koehn 2004）：对片段进行有放回抽样并在每次样本上重新计算差异。这是一种更为保守的估计，提供此选项以便与较早的论文进行对比。

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

每个差异都附带其 95% 置信区间，并在 p < 0.05 时报告为显著。两次运行中均存在的 BLEU、spBLEU、TER 和诊断指标也会进行检验并展示（p 值为各指标独立计算，未针对多重检验进行校正），但关于“更优”的定论严格依据 chrF++ 检验。两个 chrF++ 数值仅在 sacreBLEU 签名匹配时才具有可比性。若参与对比的报告中包含旧版报告，compare 命令会提示其综合得分已废弃并不予对比。完整方法请参阅：[统计显著性检验](/docs/network/specifications/significance)。

---

## 9. 运行卡评分模式

本节定义运行卡中 `scores` 块的分层结构。此模式源自 §2–§7 中定义的指标，必须保持同步。

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

评分预警说明（§2.8）位于卡片顶级字段 `score_caveats`（一个包含 `{kind, source, severity, message, …}` 对象的列表）；BLEU 作为 `corpus_bleu` 放置在该处。

> **模式历史。** 早期规范草案提议单独的 `cost`、`speed` 和 `tokens` 块。这些被合并到 `scores` 和 `totals` 中以简化。速度指标（`tokens_per_second`、`entries_per_minute`、延迟）位于 `scores` 中；令牌计数和成本数字位于 `totals` 中。

### 9.1 模式–数据库映射

运行卡 JSON 完整存储为 Supabase 中的 `jsonb` 列。关键指标也被非规范化到顶级列中以获得排序/过滤性能：

| 运行卡片字段 | Supabase 列 | 类型 | 索引 |
|---------------|----------------|------|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — 仅限旧版卡片；对于 `standard/1` 为 null |
| `scores.quality_tier` | `quality_tier` | `text` | — 仅限旧版卡片；对于 `standard/1` 为 null |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(完整卡片)* | `run_card` | `jsonb` | — |

当实现新指标时，应通过 `arena/migrations/` 中的编号迁移添加相应的列。

---

## 10. 代码–规范同步

### 10.1 规范来源

本文档为下列内容的规范依据来源：
- 评分标准：头条指标、并列展示的标准指标以及诊断指标（[运行评分方式](#how-runs-are-scored)）
- 指标定义（§2）和评分预警说明（§2.8）
- 旧版综合得分权重表（§4.3）和等级阈值（§5.1），保留用于验证旧卡片
- 成本指标计算公式（§6.2）
- 运行卡片得分模式（§9）

### 10.2 代码镜像

文件 `arena/mt_eval_harness/scoring.py` 是本文档的代码实现：包括标准的指标角色（`SCORING_STANDARD`、`PRIMARY_METRIC`、`SECONDARY_METRICS`、`DIAGNOSTIC_METRICS`），以及位于其下的、仅用于验证旧卡片的旧版综合得分表和等级阈值。没有其他模块定义它们；测试框架的测试集将二者固定。当本文档更新时，请同步更新 `scoring.py` 并重新运行测试框架的测试。

### 10.3 参考本规范的文档

| 文档 | 引用的内容 | 如何保持同步 |
|----------|-------------------|---------------------|
| [基准测试规范](/docs/network/specifications/benchmark) §4–§5 | 头条指标、排名、旧版综合得分 | 交叉引用本文档；勿重复复制表格 |
| [统计显著性检验](/docs/network/specifications/significance) | 如何判定“更优” | 必须与 §8.2 保持一致 |
| [常见问题解答](/docs/network/getting-started/faq) 与 [工作原理](/docs/network/how-it-works) | 标准的通俗语言概述 | 链接回本文档 |
| 经由 `scoring.py` 的 `publish.py` | `standard_score_fields()` 及旧版综合得分 | 测试框架的测试验证一致性 |

---

## 附录 A：为何将 chrF++ 作为头条指标（而其他指标不是）

| 指标 | 角色 | 原因 |
|--------|------|-----|
| **chrF++** | 头条指标 | 字符 n-gram 可以对词根正确但后缀不同的词汇给予部分分数，因此相较于词级指标，它能更好地应对丰富的形态变化（Popović 2015, 2017）。它仅基于语料库即可在所有语言和书写系统上复现，这也是 FLORES-200 和 AmericasNLP 共同任务所报告的标准指标。 |
| **BLEU** | 标准指标，并列展示 | 词级匹配将微小的屈折变化差异视为完全未命中，这对多式综合语极不公平。予以报告是为了方便与机器翻译学术文献进行对照。 |
| **spBLEU** | 标准指标，并列展示 | 基于共享 SentencePiece 分词的 BLEU，可跨书写系统比较；由 FLORES-200 报告。 |
| **TER** | 标准指标，并列展示 | 编辑距离；在大多数用例中与 chrF++ 强相关。 |
| **COMET** | 标准指标，并列展示（计算时） | 在 WMT 数据（高资源欧洲语言对）上训练。对于低资源语言（如克里语），该模型属于外推且未经校准，同时需要体积庞大的模型，因此无法作为每次运行必有的单一指标。由验证器重新派生。 |
| **长度比** | 诊断指标 | 1.02 和 0.98 的比率都完全正常。只有极端异常值才表明存在问题（§2.8）。 |
| **FST 接受率、形态学准确率、LYSS** | 诊断指标 | 属于工程启发式，无人类相关性数据；FST 接受率从不检查源文或参考译文（§4）。 |
| **一致性得分** | 诊断指标（计划中） | 某些不一致是合理的（同一个英语单词根据上下文可能翻译为目标语言的不同词汇）。 |
| **合规性指数** | 关卡门槛（计划中） | 衡量结构保留情况（占位符、引号），而非翻译准确率。 |

## 附录 B：LYSS — 特定语言指标实现

**LYSS** 框架（语言学知情的产出与结构评分）提供超越表面字符串比较的特定语言指标。LYSS 有三个核心组件：

- **LYSS-fst** — 形态学有效性（`fst_acceptance_rate`）：每个词是目标语言中的有效形式吗？
- **LYSS-eq** — 语言学等价（`equivalent_match_rate`）：输出是参考的可接受变体吗？
- **LYSS-sem** — 语义验证（`semantic_score`）：输出是否保留源含义？

按照评分标准，这三者均属于**诊断指标**：在 chrF++ 头条指标旁单独展示，绝不计入核心评分。

> **验证状态：🔶 工程启发式。** LYSS 指标**未**针对人类质量判断进行验证。它们从语言学原理设计（FST、词典、由阿尔伯塔大学 ALTLab 语言学家构建的语法规则），但 LYSS 评分与实际翻译质量之间的相关性尚未测量。见 [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) 了解所需的验证实验。

| 语言 | 插件 | 位置 | LYSS 组件 | 指标键 | 说明 |
|----------|--------|----------|----------------|------------|-------|
| CRK（平原克里语） | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | 确定性变体类规则：语序、正字法、可选助词、词元同义词、进行体歧义、包含式/排除式。生成逐条目的 `lint_verdict`（EXACT/EQUIVALENT/MISS/NO_OUTPUT）。 |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | 确定性：FST 词元提取 + 词典释义 + spaCy 实词重叠度。生成判定结果（EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT）。 |
| GiellaLT 语言 | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | 通用：在测试框架中固定有 FST 的任何语言（`mt_eval_harness/data/fst-pins.json`）。分析器 FST 还会生成 `morphological_accuracy`；仅含接受器的拼写检查器（为北萨米语、阿姆哈拉语和巴斯克语固定的 Divvun 包）仅报告接受率。在实践中接受 FST 评分还需要该语言对存在能够排名的评估集：平原克里语的两个数据集（EdTeKLA）为隔离标签，数据库拒绝针对其进行评分；而其他几种 FST 语言则拥有公开数据集（Tatoeba、WMT、WMT24++）。[数据集页面](/docs/network/leaderboard/datasets)列出了目录，且 `mt-eval corpora --source eng --target <code>` 列出了某个语言对可以运行的内容（参见[坦诚的局限性](/docs/network/honest-limitations)）。 |

> **架构说明（2026 年 6 月）。** 特定语言的 LYSS 指标现已在语言卡片的 `evalMetrics` 下声明，并由 `plugin_discovery.py` 从 `eval_standards/<lang>/` 中加载。它们属于**评估标准**（裁判），而非方法插件指标（选手）。这意味着任何以 CRK 为目标的翻译方法都会自动接受 LYSS 诊断检查——无需针对方法进行任何特定配置。`CrkFSTMetric` 已被移除；其功能已由通用的 `GiellaLTFSTMetric` 完全覆盖。

## 附录 C：正在考虑的指标

这些是正在评估但还不够指定用于 §2 的想法：

| 想法 | 它会测量什么 | 阻碍 |
|------|-----------|------|
| 流畅性（LM 困惑度） | 输出在目标语言中是否是良好形式的散文？ | 需要目标语言 LM。大多数低资源语言不存在好模型。 |
| 寄存器匹配 | 翻译是否匹配预期的正式程度？ | 需要社会语言学分类器。研究问题。 |
| 文化适当性 | 文化参考是否正确处理？ | 无法自动化——本质上需要人类审查。 |
| 话语连贯性 | 连续翻译是否形成连贯的段落？ | 需要文档级评估，不是句子级。 |

---

## 参考文献

本规范中引用的学术论文、工具和语言资源。

### 表面指标

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhagen, Denmark.

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lisbon, Portugal.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### 评估实践与显著性检验

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, Spain.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; reports chrF++ and spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

### 神经指标

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Ababa, Ethiopia.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Online.

### 形态学和语言学工具

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### 错误分类和诊断评估

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Related work on feature-based evaluation metrics, including FUSE.)

### 幻觉检测

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. Online.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croatia.

### 克里语资源

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### 数据治理

18. 全球原住民数据联盟 (Global Indigenous Data Alliance). "CARE 原住民数据治理原则 (CARE Principles for Indigenous Data Governance)." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
