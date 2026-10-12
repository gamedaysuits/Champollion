---
sidebar_position: 8
title: "队列构造规范"
slug: '/network/specifications/queue-construction'
description: "社区计算队列背后的透明公式：期望链值排名、每个组件已发布、每个排名都可手工重新推导。"
related:
  - label: "Why the Queue Is Built This Way"
    to: /docs/network/perspectives/why-the-queue
    kind: position
    note: "The philosophy behind this formula"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
    note: "How to actually run queue items"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "Small-corpus floors and noise thresholds the formula inherits"
---

# 队列构造规范

**公式版本：`ecv-v3`（预期链值与桥接可靠性）。** 本文档是 [champollion.dev/queue.json](https://champollion.dev/queue.json) 排序方式的规范定义。实现（公开测试框架仓库中的 `arena/scripts/generate_sweep_queue.py`）逐节镜像本页；队列的元数据回显生成时使用的确切参数值，**每个项目都携带其完整的公式分解**，因此任何排名都可以仅从发布的 JSON 手工推导。如果本页与队列不一致，那是一个 bug — 请报告。

**今日队列，一言以蔽之。** 公共队列在同一个面板上同时承载 LLM 项（原生和辅导提示条件）和机器翻译（MT）服务引擎项，并按调查排序（`map`，§2.2）进行排名：优先考虑每美元在语言对、语言和语系中首次亮相（first light）的项，对从未被测量过的语言给予首次读取提升（first-reading boost）（§2.2），在预览中发布预算层级（§2.1.1），并从数据库提供完整的排名（当完整排名超出大小上限时，静态文件仅包含顶部切片，并会对此进行说明）。以下各节是规范性定义，并保留了其注明日期的决策历史——任何提供的队列上的元数据都会指明对其进行排名的确切参数。

> **v3（2026-06-13）。** 每条边现在是一个*桥接*，有两个数字 — 质量和可靠性 — 链矩阵在其乘积上运行（§1.5）。62 个单词词汇项目运行一次不再看起来像一条路径；复制、更大的语料库、更丰富的语料库和更紧的置信区间都带有定价价值。v2 队列（仅质量）通过其自身元数据保持可解释性。

## 1. 目标：质量加权网格

使命是*每种语言到每种语言，通过测量的单个语言对链*。两种语言之间没有直接基准的翻译由**链接**基准语言对（X→枢纽→Y）提供，因此基准的价值不是其语料库的数量，而是**其图的链容量**。

**定义。** 让*基准图*有每种语言一个节点，对于每个至少有一个已发布、未被取消资格的运行的语言对，一个**边强度**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

语料库级 chrF++ 是规范发布的数字（见[评分规范](/docs/network/specifications/scoring)）；*最佳*因为链会通过每跳最佳演示系统路由。没有已发布运行的语言对有 s(e) = 0。

路径 P 在两种语言之间的**估计链强度**是

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— 边质量以乘法方式组合，每个*交点*（每个中间枢纽）成本为额外的保真因子 **λ < 1**。两个选择都基于枢纽翻译文献：通过枢纽的翻译相对于直接翻译可靠地损失质量，超过朴素组合所建议的（Utiyama & Isahara 2007；Wu & Wang 2007），损失的大小取决于选择的枢纽（Paul et al. 2009），构建*直接*非英语中心的语言对在规模上明显优于英语枢纽 — 在 M2M-100 的多对多设置中约 10 BLEU（Fan et al. 2021）。λ 是公式的常设提醒，估计链不是测量：只有直接运行才能消除折扣。

**最佳链矩阵**和**网格目标**是

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Q 作为标准对数变换下的最短路径问题精确计算（边权重 −ln(λ·s(e)) ≥ 0，Dijkstra，然后 Q = exp(−d)/λ）。Φ 是 [Latora & Marchiori（2001）](https://arxiv.org/abs/cond-mat/0101396)*全局效率*构造，其中 1/距离核被乘法链保真度替换 — 当边携带每跳质量保留而非单位长度时的自然核。（队列 v1 按无权全局效率增益排名 — 这个族的特殊情况，其中你对边的了解只是它是否存在。）

### 1.5 可靠性：桥接是 (q, r)

一个在微小、薄弱、从未复制的语料库上的闪亮分数不是桥接。v3 因此将每条测量的边分为：

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| 因子 | 定义 | 完全信用在 | 锚点 |
|---|---|---|---|
| `f_size` | min(1, n/100)，n = 最佳运行的评估条目数 | 100 条目 | [语料库设计](/docs/network/specifications/corpus-design)显著性下限；Koehn (2004) 验证了约 300 句集合上的自举测试 — 即使 300 也是"小的"，所以大小折扣可靠性而不仅仅是门控显示 |
| `f_rich` | min(1, L̄/5)，L̄ = 平均*有效*源长度 | 5 个有效词 | AmericasNLP (Mager et al. 2021) 采用了 chrF，因为词级单位在丰富形态学上破裂；Mager et al. (2022) 记录空格标记作为错误的单位 |
| `f_conf` | min(1, 5/h)，h = 最佳运行的 chrF 95% CI 半宽（代理 `50/√n` 未发布时） | CI ≤ ±5 chrF | 噪声下限，低于此的增量在小语料库上无法区分；Kocmi et al. (2021) 显示 CI 内增量经常与人类偏好矛盾 |
| `f_repl` | min(1, runs/2) | 2 个已发布运行 | Marie, Fujita & Rubino (2021)，元评估 769 篇论文：未复制的单一比较是该领域记录的可信度失败 |

**有效长度**以内容单位而非空格词测量：`L̄ = mean source chars / c(L)`，其中*字符经济*`c(L)` 是语言 L 一侧每个英文词对齐一侧的中位字符数，从该项目自己的平行语料库测量（v3 发货时 7,400+ 对齐条目：cmn 1.6、jpn 2.3、kor 2.6；eng 基线 5.0；deu 6.0；crk 4.7 — 多综合词按其携带的内容定价）。无类型学查找表；估计随着语料库增长而改进；没有 eng 配对数据的语言使用默认经济。在注册表中按语料库标记（`richness` 块）。

**桥接层级**（显示词汇）：**已建立** — n ≥ 100、L̄ ≥ 5、h ≤ 5、runs ≥ 2；**临时** — 测量但失败任何；**已注册** — 无已发布运行。链声明（"你可以从 X 到 Y"）的强度只与其最弱跳的层级一样强，网格可视化将可靠性显示为边不透明度。

**工作检查**（来自签入的验证脚本，在 v3 发货前运行）：*62 个单词词汇项目，一次运行* → r ≈ **0.04**（不是路径）；*200 句，±3 CI，3 次运行* → r = **1.00**；一个 101 条目日语语料库，其朴素词数为 1.0（脚本工件）恢复到 6.5 个有效词和完全 `f_rich`。界限和每因子单调性是属性测试的。

**v3 下运行的价值。** 运行可以通过两种方式改进桥接，ΔΦ 取更好的：**(a)** 它成为边的最佳运行 — `ŝ_eff = 预测质量 × r(其语料库的 n、丰富性、CI 代理、runs+1)`；或 **(b)** 它仅复制 — 当前最佳保持，`f_repl` 上升。单运行边上的复制因此是真实的、定价的价值，单个测量对上的更大或更丰富的语料库优于小的重新运行。项目公开 `edge_quality`、`edge_reliability`、`edge_tier`、`effective_strength`、`post_run_reliability` 和 `predicted_effective` 以及 v2 预测字段。

**Φ 不是什么。** Φ 是队列的内部优先级货币，不是能力声明。其输入是开发集分数，具有[语料库设计框架](/docs/network/specifications/corpus-design)的所有注意事项：可能的训练数据污染使每个分数成为上界，chrF++ 值在语言间不严格可比，小语料库携带宽置信区间。公式只需要 Φ 来*按有用性排序运行*；它从不作为质量保证发布。

## 2. 决策问题

队列的开放项是每一个符合条件（开发集划分、可重新分发的许可证、未被隔离、符合传输条件，且**基准可解析（benchmark-resolvable）**——见 §2.2 中的语言身份门控）且尚未出现在排行榜上的（语料库、模型、条件）组合。已覆盖组合的完全相同的重复运行将被排除——运行卡（run-card）指纹会在发布时对它们进行去重——但在已测量的语言对上的新模型或新条件仍属于开放项。

贡献的计算是一个预算。选择接下来运行哪个开放项目以使网格改进最快是一个预算覆盖风格的最大化，规范方法是按**单位成本的边际价值**贪心选择：对于单调子模目标，贪心规则携带经典 (1 − 1/e) 保证（Nemhauser、Wolsey & Fisher 1978），其收益/成本比形式是预算下的标准算法（Khuller、Moss & Naor 1999）。我们使用比率规则作为我们的排名原则。（诚实说明：我们的目标在其确定性核心中具有覆盖类似的递减回报，但随机预测层意味着我们引用贪心保证作为*动机*，而不是关于这个确切系统的定理。）

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

项目按 ECV 降序排名。平局打破：朴素优于教练、更便宜优先，然后项目 id。

### 2.1 排名补救措施 — 2026-07-12

四项调整分层应用于贪心 ECV 规则，每项都在队列的元数据中回显（`priority_parameters.contamination_ecv_factors`、
`priority_parameters.frontier_interleave`、`metadata.preview_policy`）：

1. **污染乘数。** 每个项目的 ECV 乘以其语料库污染等级的因子：**LOW 1.0 / MEDIUM 0.4 / HIGH 0.1**，未知或缺失的等级视为 MEDIUM（不假设清洁）。理由：清洁链图仅允许 LOW 污染边，因此非 LOW 运行无法进入清洁链图，不应在相等成本下超越清洁网格工作。非 LOW 项目保持排队状态——相对车道比较具有实际价值——它们只是排在清洁工作之后。
2. **前沿交错。** 在贪心排序后，每第 5 个优先级槽位承载来自前沿模型集合的最高排名未放置项目（在生成器中作为数据维护，并在元数据中回显），使得前沿证据提前到达预测先验，而不是仅在廉价层饱和后才到达。纯重新排序：不删除或重复任何内容，获得自然槽位的前沿项目保留该槽位，优先级从编织顺序编号——发布的排名是真实的。
3. **预览源中心上限。** 前 25 个公开预览最多显示**6**个共享一种源语言的项目，因此单个资源充足的中心无法垄断展示窗口。超出上限的项目在完整队列中保留其真实优先级；预览只是按排名顺序拉取下一个符合条件的项目。
4. **预览人工语言排除。** 源语言或目标语言为人工语言的项目被预览跳过。该判定由卡片族驱动（Glottolog 的人工语言桶，从语言卡片读取——从不使用硬编码语言集），派生的代码列表发布在 `metadata.preview_policy` 中，以便服务器端刷新应用相同的选择。

(3) 和 (4) 是**仅表示策略**：完整的 `queue.json`、其排名和优先级不受影响。

### 2.1.1 预算层级——“$X 能买到什么？”（2026-08-24）

`queue-preview.json` 包含一个 `budget_tiers` 数组，针对 **$1 / $10 / $100 / $1000** 的预算，总结了已发布排名的贪心可负担前缀：按优先级顺序遍历各项，选取预估成本仍符合预算的每一项，跳过不符合的项，并继续用后续更便宜的项进行填充。每个层级会报告该预算能买到多少项、它们的总预估成本、涉及多少个不同的语言对和模型，以及该预算能触及排名的多深位置（`max_priority`）。

因为排名已经是基于单位成本边际价值（§2），所以贪心可负担前缀**正是**该模型为该支出推荐的分配方案——无论是小额贡献者还是大额贡献者，都能从同一个已发布的排名中读取到一个具体的、最优的答案，而不是一个实际上不适合任何人的隐式规模列表。层级仅作为摘要：分配本身就是排名，只需根据你自己的预算按顺序遍历即可。服务器端刷新会使用相同的遍历方式对剩余项重新计算层级（生成器和刷新函数将其实现为孪生函数，并在两端都进行了测试）。

### 2.2 通道与排名模式（Lanes and ranking modes）—— 2026-07-19

提供的队列会在其自身的元数据中声明它承载了哪个**通道（lane）**以及是哪种**排名模式（ranking mode）**对其进行了排序。元数据具有权威性；本节定义了相关词汇。

**通道（Lanes）**（`metadata.lane`，`metadata.lane_policy`）。自 2026-08-27 起，公共队列承载 **both**（两者）通道：LLM 项（模型 × 提示条件）**以及** MT 服务项（条件 `engine` —— DeepL、Google Translate、Microsoft Translator、LibreTranslate、Tilde；每个服务仅针对其自身发布的覆盖列表内的语言对入队）。2026-07-19 的 **llm** 通道——仅限 LLM 项，且限制在至少有一端位于所有 MT 服务发布的覆盖范围之外的语言对——为从未运行过的组织者发起的活动保留了服务基准测试，这搁置了目录中的大部分内容；测量这些服务*正是*覆盖地图的骨干，因此这两种工作现在都放在同一个面板上。覆盖范围的并集（通过语言卡片进行宏语言别名处理）仍作为 `service_coverage_methods` 和 `service_covered_languages` 回显，并且 llm 通道队列仍将其排除的语言对报告为 `pairs_dropped_fully_covered`。

**Blob 大小上限**（2026-08-27）。提供的 `queue.json` 是一个具有硬性托管上限的静态文件，因此当完整排名超出该上限时，该文件将承载排名的**顶部切片（top slice）**，并在 `metadata.blob_truncated {kept, total}` 中对此进行说明——绝不会静默截断。数据库队列（`queue_top()` / `queue_pairs()`）始终提供**完整**排名，并且是权威的工作列表；预览的语言对聚合和预算层级描述了它们随附的产物。

**语言身份门控**（2026-07-19）。队列项仅针对**活跃的独立 ISO 639-3 代码**——针对宏语言（“Arabic”）或集合语系代码（“Berber languages”）的评分，将是对从未评估过的变体做出的不可证伪的声明（这与 FLORES-200/NLLB 将数据编码为 `arb`/`quy`/`zsm` 的推理相同）。上游语料库标签会被*解析*，而绝不会被盲从或丢弃：脚本标签会被机械地剥离（一个 `eng→cmn-Hans` 语料库会作为 `eng→cmn` 入队，脚本作为项显示元数据 `source_script`/ `target_script` 保留）；完全退役的代码遵循其官方的 ISO 继任者；而带有宏标签的语料库仅在其注册表条目上记录并引用的**变体解析（variety resolution）**下入队（例如，FLORES+ 将其 Quechua 记录为 `quy`）。在这两条路径上都无法解析的语料库将被排除，并在 `metadata.doctrine_exclusions` 中发布机器可读的原因（总数、按原因分类的计数、按语料库分类的原因），并计入荒漠分类账（desert ledger）（`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`）——可见的排除，绝不静默丢弃。在伞形标签（umbrella-labeled）语料库上的历史结果保留其自身诚实命名的网格节点（节点 `scope`：`macrolanguage` / `collective` / `retired`），绝不会合并到成员变体中。解析输入全部公开：注册表中每个条目的 `language_resolution` 标记带有解析后的代码、范围和固定引用。

**排名模式**（`metadata.rank_mode`，在 `metadata.priority_model` 中描述）。相同项的两种排序方式：

- **ecv** —— §2–§3 的贪心预期链价值（expected-chain-value）规则：每预估美元的网格改进。这是利用型（exploitation）排序；当面板足够密集，使得预测和 ΔΦ 能够携带信号时，这种排序是正确的。
- **map**（map-value v2）—— 调查排序：`MapValue = novelty × uncertainty × promise × connectivity × corpus-quality × contamination ÷ cost`，通过精确的贪心追踪组装而成。*Novelty（新颖性）* 是位置性的首次亮相积分，随着已放置的项占据相同的有向语言对（1/(1+n)）、目标语言、目标语系、方法 × 目标语系单元格以及目标 × 领域单元格（各为 1/√(1+n)；语系来自语言卡片，领域来自语料库注册表的分类——目标的早期覆盖应分布在不同的语域中，而不是重复测量第一个领域）而衰减。*Uncertainty（不确定性）* 是 §3.1 预测的回退深度（语言对 0.25 · 目标语言 0.55 · 源语言 0.75 · 全局 1.0）× 1/(1+边缘上已发布的运行数)。*Promise（潜力）* 是 §3.1 预测的强度，下限为 0.25——可能有效的未知项领先，并且映射一个可能的荒漠仍然具有价值。*Connectivity（连通性）* 提升了那些**将已测量的网络连接到其尚未能触达的语言**的语言对的排名：当一个端点位于已测量的网格边缘（`mesh.json`，状态 `measured`）或任何 MT 服务发布的覆盖列表（宏语言别名，与上述通道门控相同的别名）内时，该端点即被视为*已建立（established）*；**桥梁（bridges）**（恰好有一个已建立的端点）和**孤岛（islands）**（两者均未建立）的得分均为 1.0——自 2026-08-27 起，断开连接的荒漠的首次亮相被完全计入（在 2026-07-19 的“从网络向外扩展”规模下，孤岛得分为 0.5，这在结构上降低了最深尾部的优先级）——而**内部（interior）**致密化（两者均已建立）得分为 0.5：在已知点之间进行强化是 ecv 模式的工作。**首次读取提升（first-reading boost）**（×2.0）会额外乘以任何源语言或目标语言在任何地方都具有零发布测量值的项的调查价值——第九条原则，简单来说：**语言的首次读取优先于细化**。单靠不确定性因素无法表达这一点（它对两种充分测量的语言之间的未测量语言对的评分，与对从未测量过的语言的评分相同）；这种提升使长尾的首次亮相成为一个明确的目标，而不是一个突发的偶然事件。这两个因素都依赖于 `metadata.map_value_parameters`，并在 edv 的调查组件（§2.3）中同样适用。

  第九条原则的另一半存在于排名**之外**：对现有项的任何排序都无法触及完全没有语料库的语言（目前约有 7,500 种现存的独立代码语言）。**语料库愿望清单（corpus wish-list）**（`/corpus-wishlist.json`，在队列旁重新生成）发布了该获取前沿：每一种现存的、具有独立代码的、零语料库的语言，按其被引用的最高使用者人数进行排名——使用者人数作为能够实际构建语料库的社区的可行性代理指标——每个计数都归因于其来源，且从不进行仲裁。
  *Corpus-quality（语料库质量）* 是来自 §1.5 的语料库内在可靠性潜力 `f_size × f_rich`——调查应落在能够承受权重的语料库上，因此一个包含 62 个条目的单字词汇表不再仅仅因为便宜而占据头条；缺失的丰富度测量保持中立（没有测量并不代表贫乏）。成本和污染约束与 ecv 相同。前沿交错和打破平局规则（§2.1）保持不变。这对于调查阶段是正确的：它最大化了每美元*地图所学到的内容*——跨语言对、语言、语系、方法单元格和领域的首次测量，从已测量的网络向外扩展而不是分散——其刻意付出的代价是网格强度的增长变慢。

> **map-value v2 (2026-07-19)。** 调查排序中新增了两个由创始人主导的补充：*桥接到已测量网络*的语言对现在排在断开连接的探测和内部致密化之前，并且语料库质量（大小下限 × 有效丰富度，§1.5）加上每个目标的领域分布会影响排名权重——贡献者的计算资源应该将已建立的路径与新路径连接起来，并在足以承受权重的语料库上进行。许可证仍然是一个**门控，而不是权重**：许可和传输通道规则决定了什么可以入队（§2，以及队列的 `transmission_note`）；在符合条件的语料库中，排名是无视许可证的，因此受限但被固定的研究集——通常是某个语言对唯一的语料库——绝不会被系统性地饿死。v1 队列（仅包含新颖性 × 不确定性 × 潜力）仍可通过其自身的元数据进行解释。

生成时使用的确切因子值随 `metadata.map_value_parameters` 一起发布；连通性和质量输入可从已发布的 `mesh.json`（已测量的边缘）、元数据中回显的服务覆盖并集以及 `registry.json`（条目计数 + 丰富度）中重新推导出来。无论哪种模式，每个项都会额外保留完整的 ecv-v3 诊断字段，因此任何一种排序都可以从相同的产物中重新推导出来。

### 2.3 排名模式 `edv` —— 预期决策价值（2026-08-27）

*状态：已实现，默认关闭，等待 §2.3.6 中的测量比较。在此之前，发布的默认值仍为 `map`。*

队列确切地购买两种产品：**能力地图（capability map）**（哪种方法擅长什么，带有诚实的不确定性）和**路由网格（routing mesh）**（链接成路由的已测量语言对）。`edv` 根据每个候选项对这两者的推进程度对其进行定价，作为一个加权组合：

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

默认值为 `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40`（创始人可调；每次生成都会在 `metadata.edv_parameters` 中回显实际使用的权重）。污染因子（§2.1 补救措施 1）作为外部乘数仅应用一次。许可和传输仍然是**门控，而不是权重**——资格在计算任何价值之前决定，并且在符合条件的语料库中，排名是无视许可证的。

#### 2.3.1 Ĵ —— 方法判断价值（method-judgment value）

对该运行在多大程度上推进了**解决同语料库方法比较**进行定价——这是本项目自身的测量研究许可的唯一跨方法声明。（W2 难度转移研究拒绝了跨语言能力链接；其许可的积极结果——语言内加性方法 × 语料库调整——正是该组件所使用的。根据校准试点，分数仅用于排序和分离，绝不会转换为可接受性概率。）

对于一个候选项（语料库 C，方法 M，条件）：**对比伙伴（contrast partners）**是已经在（C，相同条件）上发布过运行的方法 M′。对于每个伙伴，`sep` 是在合并的 CI 半宽（记录的 CI；未发布时使用代理 `50/√n`）上的 chrF 分数分离度，而 `sep_pred` 是针对 §3.1 预测分数计算的相同值：

| {M, M′} 在该语言对上的对比状态 | 积分 |
|---|---|
| **未满足（unmet）** —— 尚无共享语料库 | `JUDGE_FIRST = 1.0` |
| **有争议（contested）** —— 存在共享语料库，全部 `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **已决定（decided）** —— 部分 `sep ≥ Z_DEC`，由 n_dec 个语料库决定 | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

每一项都乘以 `w_top = 1/√(rank(M)·rank(M′))`——决定第一名与第二名的价值高于决定第七名与第八名。当语言对有 ≥2 种方法 × ≥2 个语料库被测量时，每个语言对的方法排名使用许可的加性方法 × 语料库拟合（在观察到的单元格上交替最小二乘法），否则使用每种方法的最高分；该拟合是**严格按语言对进行的，绝不跨语言合并**。`Z_DEC = 1.96`。

在相同的 (C, M) 上进行的辅导与原生（coached-vs-naive）对比会增加 `JUDGE_COND = 0.5 / (1 + n_cond)`。一个项的对比会以边际收益递减的方式求和（每个额外的对比 `JUDGE_GAMMA = 0.7`，降序排列），加上一个**种子项（seed term）** `JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality`（m_C = 在 C 上有队列项的其他阵容方法），因此一个空面板仍然偏好那些可以判断未来比较的语料库——这是场地价值，绝不是借来的分数。在组装过程中，判断组件会衰减 `1/(1 + items already placed on the same pair and condition lane)`。

#### 2.3.2 M̂ 和 Ŝ

`M̂` 是 §3 的预期网格增益（ΔΦ），保持不变，链矩阵在生成时被冻结。`Ŝ` 是 §2.2 的 map-value v2 核心——带有位置新颖性衰减的 `uncertainty × promise × connectivity × corpus-quality`——保持不变。预测分数的*水平*（潜力）仅存在于 Ŝ 中；Ĵ 仅使用分数*分离度*——这两个组件不能重复计算相同的乐观度。

#### 2.3.3 归一化

这三个组件存在于不可通约的尺度上，因此每个静态组件都除以其在候选集上的第 95 个百分位数（上限为 `EDV_NORM_CAP = 4.0`）；这三个归一化器随 `metadata.edv_parameters.normalizers` 一起发布，使得每个发布的 EDV 值都可以从其自身的产物中重新推导出来。

#### 2.3.4 组装

排序与 map 模式完全相同的惰性贪心（lazy-greedy）追踪：每个依赖于顺序的乘数（调查新颖性、判断放置衰减）随着项的放置呈单调非递增，因此过时的堆条目只会高估——惰性贪心不变量成立，且该追踪等同于暴力贪心。前沿交错、预览策略和预算层级保持不变。

#### 2.3.5 可解释性

每个项在其诊断信息中保留：为其记分的对比列表（伙伴、状态、预测分离度、排名权重）、种子和衰减项、所有 §2.2 和 §3 字段、权重和归一化器——发布的 EDV 值可以完全从该行重新计算得出。“这个项是如何获得这个排名的？”这个问题无需任何外部状态即可回答。

#### 2.3.6 采用标准

`edv` 只有在同一面板上与 `map` 和 `ecv` 进行测量比较后，才会成为发布的默认值：在每个调查指标（首次亮相深度百分位数、深度上的不同语言对/语言/语系、边际新语言对率）上与 map 的差距在 10% 以内，在两个判断指标（每模拟 $1k 解决的有争议对比；固定支出下的方法排名恢复）上严格更好，且每美元网格增长不差于 map。比较报告将与切换操作一起发布。

## 3. 一次运行的价值

### 3.1 运行前预测分数

未运行（对、模型、条件）的预期分数是一个故意简单、完全可检查的总和 — 一个双向主效应预测加结构化乐观主义，每个术语在项目上发布：

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — 已发布强度上的分层回退：此对上的平均值 → 此目标语言上的平均值 → 此源语言上的平均值 → 全局平均值 → `S0_FALLBACK`。使用的级别发布为 `prior_basis`。
- **`model_offset`** — 此模型相对于同一对上的*其他*模型的表现，平均所有存在比较的对。从未见过的模型为零。
- **`condition_offset`** — 同一对上观察到的教练减朴素增量（回退到相同目标语言），**否则为零**：教练增益在测量的地方是真实的，但不假设在语言间转移，所以在未证实的对上，基线优先约定成立。
- **`exploration_bonus`** — 面对不确定性的乐观主义，使用 UCB1 计划（Auer、Cesa-Bianchi & Fischer 2002）：`κ·sqrt(2·ln(1+N)/(1+n))`，其中 N 是已发布评分运行的总数，n 是此（对、模型）上的数量。从未尝试的单元获得最大奖励；测量良好的单元衰减到零。我们借用计划 — 使欠探索臂以正确速率重新浮出水面的形状 — 而不是遗憾定理，它假设一个这个系统不是的平稳老虎机。

### 3.2 网格增益，闭式形式

运行只能通过将其对的边提升到 `s' = max(s(e), ŝ)` 来改进网格。对于单边变化，任何两种语言之间的新最佳链要么忽略新边，要么恰好使用一次，因此升级矩阵 — 因此 ΔΦ — 有一个精确的单行形式（无需重新求解整个图）：

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

E 是"到新边端点的最佳链，支付交点以拼接到其上"；两个术语是穿过边的两个方向。这在测试框架套件中针对 Φ 的蛮力重新计算进行了测试。

无法击败当前边强度的预测产生 ΔΦ = 0：公式花费捐赠者的钱确认未知，而不是重新测量已演示的。（探索奖励使弱或欠采样的单元不会永远被饿死。）

### 3.3 什么算作证据与什么可以排队

两个不同的门，故意不对称：

- **证据**来自*每个*已发布、未被取消资格的运行 — 包括在无法公开排队的语料库上的运行（例如非商业许可集）。对的已发布测量是知识，无论你是否可以重新运行它。
- **操作**（队列项目）仅来自开放可运行的语料库：开发分割、CC-BY 系列许可证、任何人都可获取。

只能通过不可排队语料库到达的语言仍然在图中：改进*围绕*它们的边改变其链值，公式对其进行了说明。

## 4. 参数

| 参数 | 默认值 | 含义和理由 |
|---|---|---|
| `λ`（`lambda_junction_discount`） | **0.9** | *估计*链的每交点保真度保留。编码"直接测量优于乘积相等链接"（Utiyama & Isahara 2007；Wu & Wang 2007；Fan et al. 2021）。约 10% 的削减是一个校准选择，随着测量的链三角形积累而重新审视（§6）。 |
| `κ`（`kappa_exploration_scale`） | **0.05** | 探索奖励规模，以强度单位。0.05 ≡ 5 chrF++ 点 — 噪声下限，低于此分数差异在子 100 条目语料库上无法区分（[语料库设计 §6.3](/docs/network/specifications/corpus-design)）。乐观主义上限为仪器的分辨率。 |
| `S_CAP` | **0.95** | 预测上限 — 没有估计边可能声称它未演示的接近完美保真度。 |
| `S0_FALLBACK` | **0.5** | 对先验的最后手段，仅在完全没有已发布结果时使用（观察到的全局平均值 — 在前 429 次运行中约 0.54 — 在任何结果存在时优先）。 |
| `COST_FLOOR` | **$0.01** | ECV 分母的下限，所以近乎免费的运行不能声称无限的每美元价值。 |
| `N_FULL` | **100** | 完整大小信用的评估条目（§1.5）。 |
| `L_HEALTHY` | **5.0** | 完整丰富性信用的有效词（§1.5）。 |
| `H_NOISE` | **±5 chrF** | 完整置信度信用的 CI 半宽；缺失 CI 代理为 50/√n（在 n=100 时锚定为 ±5）。 |
| `RUNS_FULL` | **2** | 完整复制信用的已发布运行。 |

**版本控制。** 参数或公式更改会提升 `formula_version`（元数据）和本页的版本行。队列始终在 `metadata.priority_parameters` 下回显使用的确切值，包括当前 Φ，因此历史队列保持可解释性。敏感性运行是一个标志之外：`generate_sweep_queue.py --lam 0.8 --kappa 0.1`。

## 5. 工作示例（实时值，2026-06-12）

针对 424 个评分运行、59 条测量边、60 种语言生成；**Φ = 0.272**。顶部项目：

```
eng>fao · claude-haiku-4.5 · naive
  edge_strength        0.0      (no published eng→fao runs)
  pair_prior           0.613    basis: target-language (Faroese runs exist via dan→fao)
  model_offset        −0.114    (haiku trails other models on shared pairs)
  condition_offset     0.0      (no coaching evidence for fao)
  exploration_bonus   +0.174    (never-run cell: κ·√(2·ln 425 / 1))
  predicted_strength   0.673
  expected_mesh_gain   0.0181   (eng→fao is a near-component join)
  est_cost_usd         0.0101
  ecv_per_usd          1.79     ← rank #1
```

读回：法罗语仅通过丹麦语连接到网格，所以测量的 eng→fao 边快捷了大量链族（大 ΔΦ）；模型在这样的对上预测中等（先验 + 偏移），没有人曾尝试过这个单元（大奖励），运行成本一分钱。队列中没有其他东西为每美元购买更多网格。相同的算术，每个输入发布，产生每个其他排名。

## 6. 已知限制（以及什么会修复它们）

1. **chrF++ 在语言间不可比。** 形态学移动了规模；0.5 边进入巴斯克语不是进入荷兰语的相同成就。缓解：优先级由*结构*主导（s = 0 → s > 0 转换），其中规模效应是二阶的。修复：每语言分数归一化，或随着它们对这些语言变得可用而具有更好跨语言校准的指标。
2. **乘积-λ 链模型是先验，不是测量。** 它在枢纽文献中方向上得到支持，但对 LLM 翻译未校准。修复（计划）：网格现在包含测量的三角形（例如 deu→fra 直接与 deu→eng→fra 一起），所以链接输出可以直接评分，λ 拟合数据而不是选择。
3. **污染和开发集状态。** 边强度继承公共开发集的每个注意事项 — 将 Φ 视为上界规划信号，从不是能力声明（[语料库设计](/docs/network/specifications/corpus-design)）。
4. **域盲目性。** 在会话文本上测量的边被视为一个数字；跨域链接将比 λ 预测的更多地降级。
5. **方向性。** 边目前是无向的（X→Y 证据点亮 X↔Y）。当链组合在实践中变得方向敏感时，强度按方向分割 — 公式不变，图只是翻倍。

## 7. 参考文献

- Latora, V. & Marchiori, M. (2001). *Efficient Behavior of
  Small-World Networks.* Physical Review Letters 87, 198701.
  [arXiv:cond-mat/0101396](https://arxiv.org/abs/cond-mat/0101396)
- Auer, P., Cesa-Bianchi, N. & Fischer, P. (2002). *Finite-time
  Analysis of the Multiarmed Bandit Problem.* Machine Learning 47,
  235–256. [doi:10.1023/A:1013689704352](https://link.springer.com/article/10.1023/A:1013689704352)
- Nemhauser, G., Wolsey, L. & Fisher, M. (1978). *An Analysis of
  Approximations for Maximizing Submodular Set Functions—I.*
  Mathematical Programming 14, 265–294.
  [doi:10.1007/BF01588971](https://link.springer.com/article/10.1007/BF01588971)
- Khuller, S., Moss, A. & Naor, J. (1999). *The Budgeted Maximum
  Coverage Problem.* Information Processing Letters 70(1), 39–45.
  [doi:10.1016/S0020-0190(99)00031-9](https://dl.acm.org/doi/10.1016/S0020-0190(99)00031-9)
- Utiyama, M. & Isahara, H. (2007). *A Comparison of Pivot Methods for
  Phrase-Based Statistical Machine Translation.* HLT-NAACL 2007,
  484–491. [ACL Anthology N07-1061](https://aclanthology.org/N07-1061/)
- Wu, H. & Wang, H. (2007). *Pivot Language Approach for Phrase-Based
  Statistical Machine Translation.* ACL 2007; journal version Machine
  Translation 21(3), 165–181.
  [doi:10.1007/s10590-008-9041-6](https://link.springer.com/article/10.1007/s10590-008-9041-6)
- Paul, M., Yamamoto, H., Sumita, E. & Nakamura, S. (2009). *On the
  Importance of Pivot Language Selection for Statistical Machine
  Translation.* NAACL-HLT 2009 Short Papers, 221–224.
  [ACL Anthology N09-2056](https://aclanthology.org/N09-2056/)
- Haffari, G., Roy, M. & Sarkar, A. (2009). *Active Learning for
  Statistical Phrase-Based Machine Translation.* NAACL-HLT 2009,
  415–423. [ACL Anthology N09-1047](https://aclanthology.org/N09-1047/)
- Fan, A. et al. (2021). *Beyond English-Centric Multilingual Machine
  Translation.* Journal of Machine Learning Research 22(107), 1–48.
  [arXiv:2010.11125](https://arxiv.org/abs/2010.11125)
