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

> **执行摘要。** 这是 Champollion MT 评估生态系统中所有评估指标、综合评分、质量层级和成本分析的唯一事实来源。特定语言的评估指标——FST 形态有效性、linter 等价类和确定性语义验证——统称为 **LYSS** (Linguistically-informed Yield & Structural Scoring)。测试工具 (harness) 计算的每个指标、综合公式中的每个权重以及每个层级阈值都在此处定义——且仅在此处定义。代码、文档和数据库模式均源自本文档。当它们发生冲突时，以本文档为准。
>
> **范围。** 本文档定义了我们测量*什么*以及我们*如何对其进行评分*。它不定义运行卡片模式（参见 BENCHMARK_SPEC §3）、基准测试协议（BENCHMARK_SPEC §6）或排行榜规则（参见 arena 文档）。这些文档在指标定义和评分逻辑方面均引用本文档。


---

## 1. 评分哲学

### 1.1 微观评估哲学

> *"如果我们只关注什么是通用的，我们将不可避免地忘记它不适用的地方——并失去这些语言及其所有知识和智慧。"*

本项目践行**微观评估开发**：使用最佳可用的语言学工具——有限状态转换器、双语词典、形态分析器、语言学家策划的等价规则——为特定语言量身定制评估指标。这与机器翻译评估中的主流范式相反，后者寻求适用于所有语言的通用指标。通用指标很有价值，但它们在最需要的地方最薄弱：对于具有复杂形态、训练数据有限且在神经指标训练集中没有代表的语言。

我们在许多世界语言的机器翻译方面没有取得进展，不仅是因为我们缺乏语料库，还因为**我们甚至不知道进展是什么样的**——我们缺乏自动化评估工具来衡量翻译系统是否在改进。LYSS 是我们尝试逐语言构建这些工具的努力，使用任何存在的语言学资源。

### 1.2 自动化指标是代理

这里定义的每个指标都是机器计算的。它们对于快速迭代、系统比较和检测回归很有用。它们**不是人类判断的替代品**。§5 中的质量等级是启发式标签——只有人类审查才能确认实际可用性。

### 1.3 多信号设计

没有单一指标能捕捉翻译质量。翻译可以有完美的 chrF++ 重叠但未通过形态学验证。它可以通过 FST 检查但传达错误的含义。它可以在语义上准确但在风格上对目标语言陌生。§4 中的复合评分聚合多个独立信号，每个信号捕捉质量的不同维度。

### 1.4 可扩展性

此指标清单不是封闭的。新语言带来新要求：声调语言的音调准确性、闪含语言的变音符号精度、克里语的音节表准确性。架构（MetricPlugin 协议、带重新规范化的加权复合）设计为可以添加指标而不破坏现有评分。特定语言的指标（例如 CRK 的 linter 和语义验证器）在 `evalMetrics` 下的语言卡上声明，并从 `eval_standards/` 加载——评估工具仅附带通用行为指标（代码切换、幻觉、术语）。

### 1.5 三个评估维度

每个运行卡测量三个独立维度：

```
Quality   — How good is the translation?   (composite score, §4)
Cost      — How much does it cost?          (cost metrics, §6)
Speed     — How fast does it run?           (speed metrics, §7)
```

这些是独立的轴。一个方法可以是高质量但昂贵的、快速但不准确的，或任何组合。排行榜允许按任何维度排序。成本调整评分（§6.3）是唯一结合维度的指标。

### 1.6 验证状态

本规范中的每个指标都有一个**验证状态**，不同于其实现状态（§3）。实现状态跟踪代码是否存在。验证状态跟踪指标是否已被证明与人类质量判断相关。

| 验证级别 | 含义 | 当前指标 |
|---------|------|--------|
| **✅ 外部验证** | 存在已发表的人类相关性研究（WMT、学术论文） | `chrf_plus_plus`、`bleu`、`comet_score` *（仅高资源对）* |
| **⚡ 代理验证** | 为高资源语言验证；对我们的目标低资源语言未验证 | `comet_score` *（对于低资源语言：在高资源/欧盟对上验证，推断到例如 CRK——方向上有用但未校准）* |

> **为什么 `comet_score` 出现在两行中。** 这是按资源级别的分割，不是矛盾。COMET 在存在 WMT 人类相关性研究的地方是*外部验证*的——高资源、主要是欧洲对。对于我们的目标低资源语言，没有这样的研究，所以同一指标只是*代理验证*：该模型从具有不同形态系统的语言推断。这也是为什么 COMET 在单独的神经通道中报告，从不折叠到复合中（§4.3）。
| **🔶 工程启发式** | 从语言学原理或观察到的失败模式设计；没有人类相关性数据 | `fst_acceptance_rate`、`morphological_accuracy`（FST 衍生、引理匹配；**活跃**在 fst-coverage 复合中、验证器重新衍生）、`equivalent_match_rate`、`semantic_score`、`code_switching_rate`、`hallucination_rate`、`terminology_adherence` |
| **🔲 未验证** | 尚未在任何数据上测试 | `orthographic_accuracy`、`consistency_score` |

> **这在实践中意味着什么。** 复合评分（§4）聚合所有验证级别的指标。这是一个明确的设计选择：我们相信结构上有根据的工程启发式（FST 接受）对于多综合语言比仅在欧洲对上验证的神经指标（COMET）更有信息量。但我们还没有证明这一点。复合评分应被视为**工程估计**，而不是验证的质量测量，直到为每个目标语言完成人类相关性研究。
>
> **所需验证实验**（见 `mt-evaluation-landscape.md` §6 和 `speaker-validation.md`）：
> 1. 人类判断相关性研究：200+ 句子对由 3+ 双语使用者评分
> 2. FST 假拒绝率在代表性语料库上的测量
> 3. 第二语言端口（北萨米语）以测试泛化
> 4. 在相同数据上与 COMET 的直接比较


---

## 2. 指标清单 {#2-metric-inventory}

指标分为六类（表面、结构、语义、行为、合规和报告的比较器）。每个指标都有实现状态、规模和级别（按条目、语料库级别或两者）。

### 2.1 表面指标

表面指标在字符串级别将预测翻译与参考翻译进行比较。它们不需要语言学工具——只需字符串比较。

| ID | 指标 | 状态 | 规模 | 级别 | 实现 |
|----|------|------|------|------|------|
| `exact_match_rate` | 精确匹配 | ✅ 已实现 | 0.0–1.0 | 两者 | 二进制：预测 == 参考？语料库率 = 匹配数 / 总数。 |
| `equivalent_match_rate` | 等价匹配 | ⚡ 部分 | 0.0–1.0 | 两者 | 预测输出是否匹配任何接受的变体？对于 CRK：通过 CRK 评估标准的 `CrkLinterMetric`（在 `eval_standards/crk/` 中）使用确定性变体类规则（词序、正字法、可选粒子、引理同义词、进行式歧义）实现。通过 CRK 语言卡的 `evalMetrics` 声明自动加载。通用跨语言实现需要语料库中的每条目 `variants[]`。 |
| `chrf_plus_plus` | chrF++ | ✅ 已实现 | 0–100 | 两者 | 字符 n-gram F-分数（sacrebleu）。对形态学变化具有鲁棒性。对于胶着/多综合语言的主要表面指标。按条目使用 `sentence_chrf`；语料库使用 `corpus_chrf`。 |
| `bleu` | BLEU | ✅ 已实现 | 0–100 | 语料库 | 词级 n-gram 精度（sacrebleu）。**从复合中排除**——词级评分不公平地惩罚形态学变化。为与机器翻译文献兼容而计算和报告。 |
| `ter` | 翻译编辑率 | ✅ 已实现 | 0–∞（越低越好） | 两者 | 预测和参考之间的最小编辑距离，按参考长度规范化（sacrebleu `corpus_ter`）。与 chrF++ 和 BLEU 一起计算。从复合中排除——与 chrF++ 相关，所以包括两者会重复计算表面相似性。 |
| `length_ratio` | 长度比 | ✅ 已实现 | 0–∞（1.0 理想） | 两者 | `len(predicted) / len(reference)` 以字符为单位。检测截断（<0.5）和膨胀/幻觉（>2.0）。在语料库级别上跨条目平均。 |

### 2.2 结构指标

结构指标验证翻译的语言学良好形式。它们需要特定语言的工具（FST 分析器、形态分析器），是形态学丰富语言的最强信号。

| ID | 指标 | 状态 | 规模 | 级别 | 实现 |
|----|------|------|------|------|------|
| `fst_acceptance_rate` | FST 接受 | ✅ 已实现 | 0.0–1.0 | 两者 | 有限状态转换器（GiellaLT）接受的输出词的比例。如果 FST 返回至少一个形态学分析，则词是"有效的"。适用于任何具有 GiellaLT `.hfstol` 分析器的语言。 |
| `morphological_accuracy` | 形态学准确性 | ✅ 活跃（fst-coverage 配置文件；验证器重新衍生） | 0.0–1.0 | 两者 | 一个词可以是 FST 有效但有错误的屈折（正确的词根、错误的后缀）。**由 `plugins/giellalt_fst.py` 计算**：对于每个可分析的预测词，找到一个与其**引理**（词根）共享的参考词，并检查预测的**屈折**（FST 特征标签）是否匹配。按引理匹配——而不是位置——绕过词对齐：不同的词选择或错误对齐的对根本不被*覆盖*（从不被错误评分）。**不需要黄金注释**——参考的 FST 分析*是*地面真实。FST 无法分析的词或其词根不在参考中的词超出覆盖范围；`morph_coverage`（引理匹配的分数）被披露，指标仅在覆盖范围 ≥ `MORPH_COVERAGE_FLOOR`（0.25）时进入复合——低于下限时保持建议。它在 FST 歧义下是**宽松的**（具有多个分析的预测词如果*任何*匹配则是"正确的"→上界，已披露）。它在 fst-coverage 配置文件中携带 **0.15 权重**，并由验证器**针对规范语料库重新衍生**（`verifier.recompute_corpus_morph`，重新运行卡固定的 FST——如果 FST 不存在则失败关闭，与 COMET 相同的合约）。激活于 2026-06-16（迁移 029 应用于开发 + 生产）。 |
| `orthographic_accuracy` | 正字法准确性 | 🔲 计划 | 0.0–1.0 | 两者 | 验证脚本特定的正确性：克里语的 SRO 长音符/抑扬符使用、因纽特语的变音符号、奥吉布瓦语的元音长度标记。按语言规则集。 |

> **为什么结构指标很重要。** Meta 的 OMT-1600 — 有史以来最大的机器翻译系统（1,600 种语言；Meta AI，*Omnilingual MT*，arXiv:2603.16309，2026）— 使用 ChrF++、xCOMET、MetricX 和 BLASER 3 进行评估。这些指标都不能验证形态学正确性。ChrF++ 测量字符 n-gram 重叠：它奖励*看起来*像目标语言的字符串。对于多综合语言，这意味着形态学上无效但与参考文本共享许多字符的词会获得高分。我们的 FST 接受度指标是一个二元结构测试：该词要么是该语言中的有效形式，要么不是。没有其他机器翻译评估框架能在规模上提供这一点。ChrF++ 还有一个**非零的机会下限**，因语言文字系统而异 — 随机同文字系统文本的得分明显高于零，在某些书写系统中更高 — 因此原始 chrF++ 在语言间不具有可比性；网络图通过[机会修正 chrF++（cchrF++）](/docs/network/specifications/connection-strength)来纠正这一点。

### 2.3 语义指标

语义指标使用嵌入或学习模型测量意义保留。它们捕捉表面不同但意义等价的翻译，并标记表面相似但语义错误的翻译。

| ID | 指标 | 状态 | 规模 | 级别 | 实现 |
|----|------|------|------|------|------|
| `semantic_score` | 语义相似性 | ⚡ 部分 | 0.0–1.0 | 两者 | CRK：来自 CRK 评估标准的 `CrkSemanticMetric`（在 `eval_standards/crk/` 中，代理）的判决加权评分。通用：句子嵌入的余弦相似性（源 + 预测 vs 源 + 参考）。模型待定——必须支持低资源语言，这排除了大多数以英语为中心的嵌入模型。 |
| `comet_score` | COMET | ✅ 已实现 | ~0.0–1.0 | 两者 | 学习的机器翻译评估指标（Unbabel）。**单独计算和报告——从不在任何复合中**（复合是确定性的；§4.3）。由验证器重新衍生，所以报告的值必须重现。对于平原克里语等低资源语言标记为低资源校准警告。当 `unbabel-comet` 已安装时计算。对于 35 种非洲语言，评估工具通过 `resolve_comet_model()` 自动选择 AfriCOMET（`masakhane/africomet-mtl`），它对这些语言的人类判断相关性更好。 |

> **为什么 COMET 单独报告，不复合。** COMET 在 WMT 人类评估数据上训练，绝大多数是高资源欧洲对。应用于平原克里语或其他低资源语言时，该模型从具有不同形态系统的语言推断——方向上有用但未校准。复合不是折叠模型依赖、不均匀验证的信号，而是保持**确定性**（仅验证器可重现指标），COMET/AfriCOMET 在**单独的神经通道**中报告（§4.3），由验证器重新衍生。神经复合可能稍后添加，一旦验证。
>
> **高资源 COMET 被报告，不复合（按设计）。** 对于真正的高资源对（德语、法语……），默认 `Unbabel/wmt22-comet-da` 由 WMT 很好地验证，`resolve_comet_model()` 选择它。但 COMET **不**折叠到任何复合中——它像每个其他神经指标一样在单独的神经通道中计算和显示，并由验证器重新衍生。保持复合确定性避免使 2.3 GB 模型依赖指标对于携带 `metricModelSupport.xlmr.tier: "high"` 的 ~100+ 种语言强制，并保持标题评分从语料库单独可重现。

> **非洲语言的 AfriCOMET。** 每个语言卡都有一个 `metricModelSupport` 字段（见语言卡规范 §9），声明为该语言训练的哪些专门 COMET 模型。对于 35 种非洲语言（yor、hau、ibo、amh、swa 等），卡声明 AfriCOMET（`masakhane/africomet-mtl`）——由 Masakhane 社区在非洲语言机器翻译人类判断上微调的 COMET 模型。评估工具通过 `resolve_comet_model()` 从语言卡读取自动选择推荐模型，但这可以用 `--comet-model` 覆盖。添加新的语言→模型映射是通过丰富语言卡完成的（不编辑 Python 代码）。

### 2.4 行为指标

行为指标检测翻译输出中的特定失败模式。它们不直接测量质量——它们检测问题。

| ID | 指标 | 状态 | 规模 | 级别 | 实现 |
|----|------|------|------|------|------|
| `code_switching_rate` | 代码切换率 | ✅ 已实现 | 0.0–1.0（越低越好） | 两者 | 源语言中的输出词的比例（通常是英语）。通过 Unicode 脚本分析和/或源语言词表检测。非常常见的大语言模型失败模式：当模型不知道目标语言等价物时，它插入英语词。 |
| `hallucination_rate` | 幻觉率 | ✅ 已实现 | 0.0–1.0（越低越好） | 两者 | 没有对应源内容的输出内容的比例。通过词对齐或跨语言嵌入重叠检测。捕捉模型生成看似合理但虚构的翻译。 |
| `terminology_adherence` | 术语遵守 | ✅ 已实现 | 0.0–1.0 | 两者 | 对于指导方法：规定术语术语在输出中出现的比例。需要指导词典数据。测量模型是否尊重专家提供的词汇。 |
| `consistency_score` | 跨条目一致性 | 🔲 计划 | 0.0–1.0 | 仅语料库 | 模型是否以相同方式跨条目翻译相同的源术语？低一致性表明模型在猜测而不是应用学习的模式。需要语料库条目中的重复术语。 |

### 2.5 合规指标

合规指标验证翻译保留结构完整性——占位符、格式和排版约定。它们是质量门检查，不是质量评分。

| ID | 指标 | 状态 | 规模 | 级别 | 实现 |
|----|------|------|------|------|------|
| `compliance_index` | 双通合规 | ✅ 已实现 | 0.0–1.0 | 两者 | 加权复合：60% 变量完整性（`{placeholder}` 变量是否保留？）+ 20% 引号合规（每个语言卡的正确引号字符）+ 20% 大小写合规（无拉丁字母泄漏到无大小写语言）。在原始和后处理输出上计算。通过 `DoublePassCompliancePlugin`。 |
| `repair_effectiveness` | 修复有效性 | ✅ 已实现 | 0.0–1.0 | 语料库 | 由翻译后钩子自动修复的合规违规的比例。测量质量门改进原始输出的程度。 |

> **为什么合规不在复合中。** 合规指标测量结构保留（占位符、引号），不是翻译质量。翻译在语言学上可以是完美的但因为它丢弃了 `{name}` 变量而未通过合规。这些是质量门——它们阻止坏输出发货，但它们不排列翻译质量。

### 2.6 报告的比较器（从不在复合中）

这些仅为上下文/比较而报告，从不进入任何复合配置文件：

| ID | 指标 | 状态 | 注释 |
|----|------|------|------|
| `spbleu` | spBLEU（FLORES-200 分词器） | ✅ 已实现 | FLORES-200 SentencePiece 分词上的 BLEU——在脚本/分割中可比（NLLB/FLORES 通用语言）。需要 `sentencepiece`（核心依赖）。 |
| `chrf_plain` | 普通 chrF（`word_order=0`） | ✅ 已实现 | FLORES/WMT 表报告的 chrF 数字，与我们的 chrF++（`word_order=2`）一起。 |
| `fuse_score` | FUSE 风格比较器 | ⚡ 可选（`--fuse`） | AmericasNLP-2025 FUSE 方法的**未训练重新实现**（Raja & Vats）：LaBSE 语义 + 词汇令牌-F1 + 语音 Soundex + 模糊 difflib，混合为*无权平均*（我们没有人类判断训练数据来拟合原始 Ridge/GBM，并说明这一点）。LaBSE/Soundex 是可选的 `fuse` 额外；没有 LaBSE，`compute_fuse` 返回 `None`（已披露）而不是伪造评分。运行的每个组件都列在 `fuse_components` 中；结果被标记 `fuse_untrained=true`。让排行榜显示 FST 门控/结构评分与 FUSE 风格基线的对比。 |

### 2.7 指标命名空间 {#2-7-metric-namespaces}

单个指标在堆栈中携带最多四个协调的名称：
**规范 id**（运行卡中的 `scores` 键，例如 `equivalent_match_rate`）、
Python **插件名称**计算它（例如 `crk_linter`）、语言卡
**`evalMetrics` 键**声明它（例如 `lyss-eq`）和非规范化
**`run_cards` 列**在排行榜上（例如 `equivalent_match_rate`）。这些故意不同——插件名称说明*工具*，指标 id 说明*测量*——但它们必须保持同步。

该映射的唯一权威来源是 `shared/metric-registry.json`，由 `mt_eval_harness.metric_manifest` 加载。每个条目记录四个名称加 `scale`、
`direction`（更高/更低/中立）、`level`（条目/语料库/两者）、`in_composite` 和
`verifier_reproducible`。奇偶校验测试 `arena/tests/test_metric_registry_ssot.py`
如果 `scoring.py` 的权重表或由 `publish.py` 铸造的运行卡 `scores` 键从注册表漂移，则失败，所以新指标不能半连接发货。

两个相关的运行卡字段使指标来源明确：

- **`scores.metric_availability`** — 一个 `{metric: reason}` 块，消除 `null` 评分的歧义：`not_applicable`（语言/运行不使用它）、`unavailable`
（缺少可选依赖）、`below_coverage_floor`（存在但太稀疏而不能进入复合）、`not_run`（可选且未请求）或
`not_implemented`（计划）。块中不存在的指标是正常计算的。
- **`fst_version`** / **`fst_provenance`** — 安装的 GiellaLT 转换器发布和 `pyhfst` 版本在任何 FST 衍生指标后面，以相同方式捕获为 sacreBLEU 签名，所以结构评分可以追踪到精确的分析器构建。

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

## 4. 复合评分 {#4-composite-score}

> [!CAUTION]
> **复合是实验性的且未验证。** 它是*对不同语言意味着不同事物*的指标的加权聚合，权重是**工程判断，不是经验拟合到人类质量判断**。没有人类相关性研究支持任何目标语言的加权。将其视为粗略的便利排序键，**从不**作为质量测量或声称一个系统"更好"。真实信号是**按指标配置文件**——每个指标显示其值和验证等级（§1.6）。复合在出现的任何地方标记为"实验性——未验证"（包括排行榜），它从不是任何奖项或奖励的标准。（按设计。）

### 4.1 公式

复合评分是所有*可用*指标的加权平均，重新规范化使可用指标的权重总和为 1.0：

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

如果指标在运行卡中的值是数字（不是 `null`），则该指标是"可用的"。当指标不可用时——因为语言没有 FST，或因为指标尚未实现——其权重按比例分配到剩余指标中。

**这意味着复合在运行内总是可比的：** 它使用任何可用的指标并相应地规范化。当运行使用相同的可用指标集时，跨运行比较是有效的。

> [!WARNING]
> **跨运行可比性。** 当比较具有不同指标可用性的运行（例如，一次运行有 FST 分数，而另一次没有）时，其综合评分是**不可直接比较的**。由 5 个指标计算得出的 0.72 综合评分比由 2 个指标计算得出的 0.72 综合评分包含更多信息。每次运行的确切指标集都是可审计的：运行卡片记录了 `scores.scoring_profile` 和 `scores.metric_availability` (§2.7)，并且未测量的指标在排行榜上显示为“—”（破折号），绝不会是 0。为了进行严格的比较，请仅在共享指标上使用配对 bootstrap 显著性检验 (§8.2)。

### 4.2 输入规范化

在进入复合公式之前，所有指标必须在**0.0–1.0 规模**上，其中 1.0 = 完美：

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

不在任何复合配置文件中的指标（`bleu`、`ter`、`length_ratio`、`consistency_score` 和神经 `comet_score`/`qe_score`）不为此目的规范化。（神经指标单独报告，从不进入复合——§4.3。）

### 4.3 权重表 {#43-weight-tables}

**命名配置文件注册表（卡驱动）。** 复合不再由单个 `has_fst` 布尔值选择。每个语言通过 `language_cards.resolve_scoring_profile()` 解析为**命名配置文件**；配置文件命名权重表，在 `scoring.py` 的 `PROFILE_REGISTRY` 中镜像。卡可能声明 `scoringProfile.basis` 以覆盖；当不存在时，默认重现遗留行为（当 FST 评分运行时 `fst-coverage`，否则 `surface-only`）。生成每个复合的配置文件记录在运行卡上为 `scores.scoring_profile`，所以加权对每个排行榜行是可审计的。

**非活跃（保留）指标。** 一些指标携带下面声明的*权重*但尚未活跃，所以它们列在 `scoring.INACTIVE_METRICS` 中并**从复合中排除**直到它们既按条目计算又由验证器重新评分（信任门）。排除不存在的指标不改变任何评分——它只使"尚未评分"明确而不是无声。当前非活跃：

- `orthographic_accuracy` — 需要按语言正字法规则（未构建）。

（`morphological_accuracy` 通过 P5 非活跃；**激活于 2026-06-16** 在 `fst-coverage` 配置文件下——它被计算（引理匹配；§2.2），当 `morph_coverage ≥ 0.25` 时进入复合（低于下限时建议），并由验证器重新衍生。**神经指标（`comet_score`、`qe_score`）从每个复合中排除**——它们单独计算和报告；见下面的"神经指标"。）

#### `fst-coverage`（配置文件 A）：具有 FST 覆盖的语言

对于具有 GiellaLT 有限状态转换器可用的语言。结构指标占复合的 40%（FST 0.25 + 形态学准确性 0.15），反映了形态学正确性对于多综合/胶着语言的首要地位。

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

> **总计：1.00。** 当指标不可用时，其权重按比例分配到可用指标中。`morphological_accuracy`（0.15 权重）是**活跃的**——当 `morph_coverage ≥ 0.25` 时进入复合并由验证器重新衍生；低于下限时像任何不可用指标一样被重新分配。当它*确实*不存在时（没有 FST，或低于下限覆盖），剩余 8 个指标（总权重 0.85）各按 1/0.85 ≈ 1.176 缩放。例如：
> - FST：0.25/0.85 = 0.294
> - chrF++：0.15/0.85 = 0.176
> - 语义：0.15/0.85 = 0.176

#### `surface-only`（配置文件 B）：没有 FST 覆盖的语言

对于没有形态学验证工具的语言。语义和表面指标携带相等权重。

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

> **总计：1.00。** `orthographic_accuracy`（0.05 权重）在 `INACTIVE_METRICS` 中（计划，尚未计算）。不存在它，剩余 7 个指标（总权重 0.95）按 1/0.95 ≈ 1.053 缩放——对复合的可忽略影响。

#### `no-reference`：没有黄金参考的运行

对于语料库**没有黄金参考**的运行（例如我们拒绝评分的唯一受污染 FLORES 的下限语言）。基于参考的指标（`chrf_plus_plus`、`bleu`、`exact_match_rate`、`equivalent_match_rate`）无法计算，所以确定性复合依赖**参考无关、验证器可重现**的信号。

| 指标 | 目标权重 | 理由 |
|------|---------|------|
| `fst_acceptance_rate` | **0.40** | 形态学有效性不需要参考；当 FST 存在时最强的确定性信号。 |
| `code_switching_rate` | **0.25** | 源语言泄漏（反转）。 |
| `hallucination_rate` | **0.20** | 虚构内容（反转）。 |
| `terminology_adherence` | **0.15** | 指导词汇合规。 |

> **总计：1.00。** 所有四个都是确定性的且验证器可重现的。当无参考运行没有 FST 时，复合在行为检查单独上重新规范化（故意薄、诚实的信号）；**神经参考无关 QE 评分（AfriCOMET-QE）单独计算和报告**——见下面的"神经指标"——作为此类运行的充分性信号。

#### 神经指标——单独计算和报告（不在任何复合中）

复合是**确定性的**：其中的每个指标都可由验证器从语料库单独重现。**神经指标从每个复合中排除**并单独显示（设计决定——"确定性复合；神经分离，也许稍后分离复合"）：

| 指标 | 它是什么 | 它显示在哪里 |
|------|---------|-----------|
| `comet_score` | COMET / AfriCOMET 神经充分性（基于参考） | 其自己的排行榜列 + 运行卡 `neural_metrics`，带低资源校准警告。 |
| `qe_score` | AfriCOMET-QE 参考无关神经 QE（源 + MT） | 相同的单独神经通道；`no-reference` 运行的充分性信号。 |

两个仍然**由验证器重新衍生**（`verifier.recompute_corpus_comet` / `recompute_corpus_qe`），所以不重现的报告神经评分无法信任——但它们从不移动确定性复合。命名集是 `scoring.NEURAL_METRICS`。神经复合可能稍后引入；现在神经指标独立存在。

> **关于权重演变的注释。** 这些权重是临时的，将随着人类验证数据的积累而重新校准。长期目标是经验推导权重：哪些自动化指标最好预测每个语言族的人类质量判断？

### 4.4 向复合添加新指标

要向复合添加新指标：

1. **在 §2 中定义它**，状态为 `🔲 Planned`，包括规模、级别和计算方法。
2. **实现它**作为 MetricPlugin（或在 `tester.py` 中用于核心指标）。
3. **在运行卡评分块中添加空占位符**。
4. **在 §4.3 中分配目标权重**，通过向下调整现有权重。权重必须总和为 1.00。
5. **更新 BENCHMARK_SPEC.md** §3 如果运行卡模式改变。
6. **更新 `scoring.py`** 权重表（代码必须镜像本文档）。
7. **运行验证基准**以确认指标在真实数据上生成合理值。
8. **更新本文档**以将状态从 `🔲` 改为 `✅`。

---

## 5. 质量等级 {#5-quality-tiers}

这些等级是自动化复合评分上的启发式标签。它们描述评分在实践中倾向于意味着什么，基于每个级别输出的人类审查。**它们不是验证的质量判断**——只有人类审查才能确认实际可用性。

> [!IMPORTANT]
> **自动化等级是临时的。** 这些标签是审查提名，不是质量声明。在自动化指标上达到"可部署"的方法是社区评估的候选——不是要发货的产品。只有双语使用者的人类审查才能确认实际可用性（见 [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)）。没有方法可以声称可部署或更高而不进行社区审查确认使用者同意输出是可用的。等级边界可能随着人类验证数据的积累而在语言间不同。

| 等级 | 复合范围 | 使用者通常看到什么 |
|------|---------|-----------------|
| **基线** | 0.00–0.30 | 原始大语言模型输出，无特定语言支持。形态学大多是幻觉。 |
| **新兴** | 0.30–0.50 | 一些正确的模式出现。指导在帮助，但输出不可靠。 |
| **功能** | 0.50–0.70 | 输出对使用者是可识别的。主要语法类别通常正确。频繁的形态学错误。 |
| **可部署** | 0.70–0.85 | 适合人类审查的草稿翻译。大多数形态学是正确的。 |
| **流畅** | 0.85–1.00 | 接近有能力的人类翻译。错误很少且很小。 |

这些等级是临时的。随着人类验证数据的积累，我们学习每个语言的"使用者发现这有用"阈值实际上在哪里，它们将被重新校准。没有方法可以声称**可部署**或更高而不进行社区审查确认双语使用者同意输出是可用的。

### 5.1 等级阈值（机器可读）

对于代码实现，阈值是（从上到下评估，第一个匹配获胜）：

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

成本指标测量翻译方法的财务效率。它们与质量分开报告——成本不影响复合评分（除了成本调整的次要排名）。

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

### 6.3 成本调整评分

对于使用付费 API 的方法，我们计算次要排名：

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

这奖励有效实现良好评分的方法。它使用 `cost_per_entry_usd`（不是按令牌）因为成本调整评分总是在单个基准内计算（相同语料库），使按条目比较公平。

成本调整评分是**次要排名**——主排行榜按复合评分排名。它回答不同的问题："给定预算，哪个方法给出最好的结果？"

---

## 7. 速度指标

速度指标测量翻译方法的延迟和吞吐量。像成本一样，速度不影响复合评分。

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

所有关键指标支持引导置信区间（百分位数方法，n=1000 重新采样，α=0.05）：

| 指标 | CI 报告 |
|------|--------|
| `chrf_plus_plus` | ✅ `chrf_ci_lower`、`chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`、`exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`、`fst_ci_upper`（仅当 FST 数据存在时计算） |
| `comet_score` | ✅ `comet_ci_lower`、`comet_ci_upper`（从缓存的按条目评分引导——无冗余神经推理） |
| `composite` | ✅ `composite_ci_lower`、`composite_ci_upper`（当 chrF++ 和 exact_match 可用时计算） |
| 按等级 CI | ✅ `confidence_intervals_by_tier` — chrF++ 和 exact_match CI 按难度级别（等级 1-5） |

### 8.2 配对引导显著性测试

对于比较两个方法，评估工具计算配对引导重新采样测试：

```
H₀: The two methods perform equally on this corpus.
H₁: One method is significantly better.
```

如果 p 值 < 0.05 且差异的置信区间排除零，则差异在 95% 级别上统计显著。

---

## 9. 运行卡评分模式

本节定义运行卡中 `scores` 块的分层结构。此模式源自 §2–§7 中定义的指标，必须保持同步。

```jsonc
{
  "scores": {
    // §2.1 Surface metrics
    "exact_match_rate":       0.6613,       // 0.0–1.0
    "exact_matches":          41,           // count
    "equivalent_match_rate":  0.7258,       // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     45,           // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "chrf_plus_plus":         80.65,        // 0–100 (sacrebleu native scale)
    "bleu":                   54.78,        // 0–100, NOT in composite
    "ter":                    42.3,         // ✅ implemented, 0–∞ (lower=better)
    "length_ratio":           1.03,         // ✅ implemented, ideal=1.0

    // §2.2 Structural metrics
    "fst_acceptance_rate":    1.0,          // 0.0–1.0
    "fst_accepted":           74,           // count
    "morphological_accuracy": 0.83,         // ✅ active: FST-derived, lemma-matched, verifier-re-derived (fst-coverage profile — §4.3)
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     true,         // true when active AND coverage ≥ MORPH_COVERAGE_FLOOR (0.25); else advisory
    "orthographic_accuracy":  null,         // 🔲 planned

    // §2.3 Semantic metrics
    "semantic_score":         0.6842,       // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "comet_score":            null,         // nullable; NEURAL — reported separately, not in any composite (§4.3)
    "comet_model":            "",           // model ID used for COMET

    // §2.4 Behavioral metrics
    "code_switching_rate":    0.03,         // ✅ implemented (lower=better)
    "hallucination_rate":     0.01,         // ✅ implemented (lower=better)
    "terminology_adherence":  null,         // ✅ implemented (null when no glossary)
    "consistency_score":      null,         // 🔲 planned

    // §4 Composite
    "composite":              0.8988,       // 0.0–1.0
    "quality_tier":           "fluent",     // §5 tier label
    "cost_adjusted":          null,         // §6.3 secondary ranking

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "chrf_plus_plus":     { "ci_lower": 78.2, "ci_upper": 83.1 },
      "exact_match_rate":   { "ci_lower": 0.54, "ci_upper": 0.78 },
      "corpus_comet":       { "ci_lower": 0.71, "ci_upper": 0.76 }
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

> **模式历史。** 早期规范草案提议单独的 `cost`、`speed` 和 `tokens` 块。这些被合并到 `scores` 和 `totals` 中以简化。速度指标（`tokens_per_second`、`entries_per_minute`、延迟）位于 `scores` 中；令牌计数和成本数字位于 `totals` 中。

### 9.1 模式–数据库映射

运行卡 JSON 完整存储为 Supabase 中的 `jsonb` 列。关键指标也被非规范化到顶级列中以获得排序/过滤性能：

| 运行卡字段 | Supabase 列 | 类型 | 索引 |
|-----------|-----------|------|------|
| `scores.composite` | `composite_score` | `real` | `idx_composite` |
| `scores.quality_tier` | `quality_tier` | `text` | — |
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `scores.bleu` | `corpus_bleu` | `real` | — |
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
| *（完整卡）* | `run_card` | `jsonb` | — |

当实现新指标时，应通过 `arena/migrations/` 中的编号迁移添加相应的列。

---

## 10. 代码–规范同步

### 10.1 规范来源

本文档（`cli/website/docs/network/specifications/scoring.md`）是以下内容的规范来源：
- 指标定义（§2）
- 复合权重表（§4.3）
- 质量等级阈值（§5.1）
- 成本指标公式（§6.2）
- 运行卡评分模式（§9）

### 10.2 代码镜像

文件 `arena/mt_eval_harness/scoring.py` 镜像本文档中的权重表和等级阈值。它是 §4.3 和 §5.1 的**代码实现**。当本文档更新时：

1. 更新 `scoring.py` 以匹配
2. 运行 `pytest tests/test_scoring_ssot.py` 以验证对齐
3. 更新总结权重的常见问题和网站文档

### 10.3 参考本规范的文档

| 文档 | 它参考什么 | 如何保持同步 |
|------|----------|-----------|
| `cli/website/docs/network/specifications/benchmark-spec.md` §4–§5 | 复合公式、权重表、等级阈值 | 交叉参考本文档；不复制表 |
| `website/docs/getting-started/faq.md` | 简化权重摘要 | 必须匹配 §4.3；链接回本文档 |
| `cli/website/docs/network/how-it-works.md` | 可部署阈值 | 必须匹配 §5 |
| `publish.py` 通过 `scoring.py` | 权重字典 + 等级函数 | 自动化测试验证匹配 |

---

## 附录 A：不在复合中的指标（及原因）

| 指标 | 为什么排除 |
|------|----------|
| **BLEU** | 词级评分在多综合语言中不公平地惩罚形态学变化。轻微的屈折差异（正确的含义，略有不同的后缀）计为完全失误。chrF++ 在字符级别处理得更好。 |
| **COMET** | 在 WMT 数据上训练（高资源欧洲对）。对于低资源语言（例如克里语），模型推断且未校准。COMET/AfriCOMET 在**单独的神经通道中计算和报告——从不在任何复合中**（复合是确定性的；§4.3）——并由验证器重新衍生。 |
| **TER** | 编辑距离与大多数用例中的 chrF++ 相关。包括两者会重复计算表面相似性。TER 为参考而报告。 |
| **长度比** | 诊断，不是质量信号。1.02 的比率和 0.98 的比率都很好。只有极端值表示问题。 |
| **一致性评分** | 仅语料库级别——没有按条目值聚合。另外，一些不一致是合法的（相同英语词 → 不同目标语言翻译取决于上下文）。 |
| **合规指数** | 质量门，不是质量信号。测量结构保留（占位符、引号），不是翻译准确性。 |

## 附录 B：LYSS — 特定语言指标实现

**LYSS** 框架（语言学知情的产出与结构评分）提供超越表面字符串比较的特定语言指标。LYSS 有三个核心组件：

- **LYSS-fst** — 形态学有效性（`fst_acceptance_rate`）：每个词是目标语言中的有效形式吗？
- **LYSS-eq** — 语言学等价（`equivalent_match_rate`）：输出是参考的可接受变体吗？
- **LYSS-sem** — 语义验证（`semantic_score`）：输出是否保留源含义？

> **验证状态：🔶 工程启发式。** LYSS 指标**未**针对人类质量判断进行验证。它们从语言学原理设计（FST、词典、由阿尔伯塔大学 ALTLab 语言学家构建的语法规则），但 LYSS 评分与实际翻译质量之间的相关性尚未测量。见 [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) 了解所需的验证实验。

| 语言 | 插件 | 位置 | LYSS 组件 | 指标键 | 注释 |
|------|------|------|---------|-------|------|
| CRK（平原克里语） | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | 确定性变体类规则：词序、正字法、可选粒子、引理同义词、进行式歧义、包含/排斥。生成按条目 `lint_verdict`（EXACT/EQUIVALENT/MISS/NO_OUTPUT）。 |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | 确定性：FST 引理提取 + 词典注释 + spaCy 内容词重叠。生成判决（EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT）。 |
| GiellaLT 语言 | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | 通用：适用于 CRK、SME、SMA、SMJ、SMN、SMS、FIN、NOB、IKU——任何具有 `.hfstol` 分析器的语言。指标是通用的，但**评估语料库仅存在于平原克里语（crk）**今天，所以 crk 是实践中唯一 FST 评分的语言（见 [Honest Limitations](/docs/network/honest-limitations)）。 |

> **架构注释（2026 年 6 月）。** 特定语言 LYSS 指标现在在 `evalMetrics` 下的语言卡上声明，并由 `plugin_discovery.py` 从 `eval_standards/<lang>/` 加载。它们是**评估标准**（裁判），不是方法插件指标（参赛者）。这意味着任何针对 CRK 的翻译方法都自动由 LYSS 评分——不需要特定方法配置。`CrkFSTMetric` 被移除；其功能完全由通用 `GiellaLTFSTMetric` 覆盖。

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

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

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

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
