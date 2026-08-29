---
sidebar_position: 5
title: "支持低资源语言"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# 支持低资源语言

> **内容摘要。** 本文是为低资源和多式综合语（polysynthetic languages）构建机器翻译的综合指南。涵盖了这些语言的翻译难点（形态复杂性、数据稀疏、幻觉），现有的计算资源（ALTLab FST、GiellaLT、Apertium、UniMorph、EdTeKLA），10 多种应对策略，champollion 辅导（coaching）系统，以及评估循环。如果您想为服务不足的语言贡献翻译方法，请从这里开始。

:::info[状态：积极开发中]
平原克里语（Plains Cree，nêhiyawêwin）的支持目前正在开发中。这里描述的工具、评估测试工具（evaluation harness）和排行榜在今天都是真实可用的，但克里语翻译流水线尚未发布。发布后，这将作为其他具有 FST 基础设施的多式综合语和低资源语言的蓝图。
:::

## 尚未解决的问题

Google 的 Cloud Translation 服务列出了 194 种语言（[Google 发布的列表](https://docs.cloud.google.com/translate/docs/languages)）。Meta 的 OMT-1600（2026 年 3 月）声称覆盖 1,600 种语言——这是有史以来发布的最大机器翻译（MT）系统。但对于其长尾中的约 1,200 种语言——我们的算法是：它覆盖的 1,600 种减去作者报告模型“理解得足够好”的 400 多种——质量低于可用阈值，训练数据主要由《圣经》文本主导，模型权重不可下载，并且没有独立的评估或社区治理框架。对于剩下的约 5,400 种语言，没有任何预训练模型能产生任何输出。

情况已经发生了显著变化——大型科技公司现在正在投资低资源语言（LRL）的覆盖。但覆盖率不等于质量，没有独立验证的质量也无法带来信任。低资源语言需要的不仅仅是一个声称覆盖它们的模型——它们需要带有形态学验证的独立评估、社区策划的语料库以及尊重主权的治理。

**champollion 就是为了改变这一现状而诞生的。**

[方法排行榜（Method Leaderboard）](https://champollion.dev/leaderboard) 是一项公开挑战：为服务不足的语言构建最佳翻译方法，通过可复现的评估来证明它，并夺取最高分。世界上的任何人都可以做出贡献——语言学家、机器学习研究人员、社区语言工作者、学生、业余爱好者。问题尚未解决。基础设施已经就绪。排行榜正虚位以待。

---

## 为什么这很难：多式综合语形态学

大多数商业机器翻译系统是为英语、法语和中文等语言设计的——这些语言的单词相对较短，句子由离散的词元（tokens）构成。但许多原住民语言，包括平原克里语，都是**多式综合语（polysynthetic）**：一个单词就可以编码英语中需要用一整句话来表达的内容。

### 克里语示例

请看这个平原克里语单词：

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"当我上学时"*

这只是**一个单词**。它编码了时态（过去时）、方向（去往）、词根（学习）、语态（被动/反身）和人称（第一人称单数）。主要在英语上训练的大语言模型（LLM）对这种形态密度没有任何直觉。

挑战是复合的：

| 挑战 | 含义 |
|-----------|--------------|
| **形态复杂性 (Morphological complexity)** | 单个动词词根可以通过前缀、后缀和环缀生成数千种有效的屈折形式 |
| **有生/无生区分 (Animate/inanimate distinction)** | 名词在语法上分为有生或无生——这会影响动词变位、指示代词和复数形式。这种分类并不总是遵循生物学上的有生性（*askiy*“地球”是有生的；*maskisin*“鞋子”也是有生的） |
| **旁指 (Obviation)** | 第三人称指代按接近度/显著性排序。“就近（proximate）”和“旁指（obviative）”的区分在英语中没有对等概念 |
| **训练数据稀疏 (Sparse training data)** | LLM 见过的平原克里语文本非常少。它们见过的文本可能会混合方言（Y 方言、TH 方言）或正字法（SRO 与音节文字） |
| **商业基准薄弱 (Weak commercial baseline)** | OMT-1600 将 CRK（克里语）列入 R1（极低资源）层级，使用圣经领域的训练数据和标准的 BPE 分词。Google 翻译不支持克里语。使用形态学指标进行独立评估，正是让这些基准变得有意义的原因。 |

多式综合语的翻译仍然是一个**开放的研究问题**——OMT-1600 包含了多式综合语，但使用了标准的 BPE 分词（256K 词表），没有任何形态学感知，这意味着它会将复合词撕裂成毫无意义的字节碎片。

---

## 现有技术：人们是如何解决这个问题的

### ALTLab FST

平原克里语最重要的计算资源是**有限状态转换器（FST）**，由阿尔伯塔大学的 [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) 与挪威北极圈大学（UiT）的 [Giellatekno](https://giellatekno.uit.no/) 合作开发。

ALTLab FST 是一个**形态分析器和生成器**：给定一个屈折变化的克里语单词，它可以将其分解为词根和语法标签；给定一个词根加上标签，它可以生成正确的屈折形式。这是确定性的——没有神经网络，没有幻觉，没有概率。如果 FST 接受一个单词，那么该单词在形态学上就是有效的。

这就是为什么 champollion 排行榜将 **FST 接受率（FST Acceptance Rate）** 作为一个跟踪指标。如果一种翻译方法生成的单词被 FST 拒绝，那么它生成的克里语在形态学上就是无效的——无论 chrF++ 分数有多高。

**关键的 ALTLab 资源：**
- [itwêwina](https://itwewina.altlab.app/) — 由 FST 驱动的智能平原克里语-英语词典
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — 开源的形态学感知词典平台
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — 平原克里语词汇数据库
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — 更广泛的项目背景

### 全球 FST 与形态学注册表

平原克里语并不是唯一拥有高质量 FST 基础设施的语言。如果您想为其他低资源或形态复杂的语言开发翻译流水线，您可以利用这些成熟的全球中心：

* **[GiellaLT / Giellatekno](https://giellalt.github.io/)（挪威北极圈大学 UiT）：** 最大的开源 FST 形态分析器和生成器存储库，涵盖 100 多种语言。重点领域包括萨米语（`sme`、`smj`、`sma` 等）、乌拉尔语（科米语、厄尔兹亚语、乌德穆尔特语等）以及其他少数民族/原住民语言。他们在 [GitHub 组织](https://github.com/giellalt/) 中托管了公开的处理过的文本语料库（`corpus-xxx`）。
* **[The Apertium Project](https://www.apertium.org/)：** 一个开源的基于规则的机器翻译平台。Apertium 为数十种语言维护高度优化的 FST 形态分析器（使用 `lttoolbox` 和 `hfst`）和双语词典，包括大量的突厥语族语言（哈萨克语、鞑靼语、吉尔吉斯语等）和欧洲少数民族语言。所有资源都在 [Apertium 的 GitHub](https://github.com/apertium) 上公开。
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/)：** 一个为 150 多种语言提供标准化形态范式的协作项目。该数据集托管在 Hugging Face 上，地址为 [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies)。如果某种语言没有编译好的 FST 二进制文件，UniMorph 表可以用作静态数据库查找门控。
* **[加拿大国家研究委员会 (NRC)](https://nrc-digital-repository.canada.ca/)：** 提供加拿大原住民语言的工具，包括 **Uqailaut** 因纽特语 FST 形态分析器和海量的 **Nunavut Hansard 平行语料库**（130 万对齐的英语-因纽特语双语对）。

### EdTeKLA 语料库

[EdTeKLA 研究组](https://spaces.facsci.ualberta.ca/edtekla/)（同样位于阿尔伯塔大学）从教育材料、音频转录和社区来源中组建了一个平原克里语语料库。champollion 评估数据集 [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) 源自这项工作，并在 [EdTeKLA 修改版的 CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora)（主权范围、非商业条款）下发布。

### 人们尝试过或可以尝试的其他方法

排行榜与具体方法无关（method-agnostic）。以下是为低资源机器翻译探索或提出的一些策略，其中任何一种都可以提交：

| 方法 | 工作原理 | 优点 | 缺点 |
|----------|-------------|------|------|
| **[辅导式 LLM 提示词 (Coached LLM prompting)](/docs/network/tutorials/coached-llm-prompting)** | 将语法规则、词典和示例对注入到系统提示词中 | 迭代速度快，无需训练 | 质量上限受限于 LLM 的基础知识 |
| **[少样本提示词 (Few-shot prompting)](/docs/network/tutorials/few-shot-prompting)** | 包含经过验证的翻译作为上下文示例 | 有利于保持一致的风格 | 上下文窗口小；示例**绝不能**来自评估数据 |
| **[FST 门控流水线 (FST-gated pipeline)](/docs/network/tutorials/fst-gated-pipeline)** | LLM 生成 → FST 验证 → 拒绝并重试无效形态 | 保证形态学的有效性 | 需要 FST 基础设施；重试循环会增加延迟和成本 |
| **[词典查找 + LLM (Dictionary lookup + LLM)](/docs/network/tutorials/dictionary-augmented-llm)** | 强制使用双语词典中的已知术语，让 LLM 处理其余部分 | 减少已知术语的幻觉 | 词典覆盖率总是不完整的 |
| **[微调模型 (Fine-tuned model)](/docs/network/tutorials/fine-tuned-model)** | 在平行文本上微调开源模型（Llama、Mistral）——只要不在评估数据上微调即可 | 潜力最高的质量 | 需要平行语料库（稀缺）；成本高昂；存在过拟合风险 |
| **[链式模型 (Chained models)](/docs/network/tutorials/chained-models)** | 模型 A 生成粗略翻译 → 模型 B 译后编辑 → 模型 C 评分 | 可以结合专家的优势 | 复杂；缓慢；成本高昂 |
| **[基于规则 + LLM 混合 (Rule-based + LLM hybrid)](/docs/network/tutorials/rule-based-hybrid)** | 对已知模式使用语言学规则，其余部分使用 LLM | 在规则适用的地方非常精确 | 需要深厚的语言学专业知识 |
| **[回译增强 (Back-translation augmentation)](/docs/network/tutorials/back-translation)** | 通过将克里语翻译成英语生成合成平行数据，然后在反向数据上进行训练 | 廉价地扩展训练数据 | 会放大现有的模型错误 |
| **[演化方法 (Evolutionary approach)](/docs/network/tutorials/evolutionary-approach)** | 生成候选翻译，对其进行评分，对表现最好的进行变异，重复此过程 | 可以发现新颖的解决方案；可并行化 | 计算成本高昂；需要一个好的适应度函数 |
| **[部分翻译 (Partial translation)](/docs/network/tutorials/partial-translation)** | 手动翻译一个具有代表性的样本，证明您的方法在风格上与之匹配，然后自动翻译剩余的大部分内容 | 结合了人类质量和机器规模 | 需要初期的人力投入 |
| **手动 JSON / 考试评分 (Manual JSON / exam grading)** | 手工制作一个数据集 JSON 文件来测试学生在语言考试中的答案，或者根据黄金标准对一批人工翻译进行评分 | 零机器学习要求；适用于教育和 QA | 无法扩展以满足持续的翻译需求 |

### 它只是 JSON

测试工具（harness）接收 JSON 输入并输出 JSON 评分。[数据集格式](/docs/network/leaderboard/datasets)很简单：

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

您可以手动构建它。您可以从电子表格中导出它。您可以从语料库中生成它。语言老师可以用它来给学生的翻译打分。翻译机构可以用它来对自由职业者进行基准测试。研究实验室可以用它来比较模型架构。测试工具不在乎 JSON 从何而来——它只负责评分。

而且，由于生产部署框架采用相同的插件接口，在测试工具中得分很高的方法只需更改一次配置即可部署到您的网站。**证明它并使用它。**

可能性真的是无限的。**如果您有想法，请构建它，运行测试工具，并提交您的分数。**

---

## champollion 的作用

champollion 提供基础设施层——您提供方法。

### 辅导系统

champollion 的 `llm-coached` 方法允许您将语言学知识直接注入到 LLM 提示词中：

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

辅导数据会被注入到 `en:crk` 语言对的每个 LLM 提示词中，为模型提供它原本不具备的结构化语言学上下文。有关完整规范，请参阅 [辅导数据 (Coaching Data)](https://champollion.dev/docs/concepts/coaching-data)。

### 语域 (Registers)

语域（register）是系统提示词的一部分，用于引导语气、正式程度和正字法约定。champollion 附带了一个平原克里语语域：

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

您可以在配置中覆盖它，以尝试不同的提示词策略：

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

不同的语域会产生不同的翻译风格——以及排行榜上不同的分数。每次提交都会记录所使用的确切语域和系统提示词（作为 SHA-256 哈希值记录在 [运行卡片 (run card)](/docs/network/specifications/run-card) 中），因此实验是可复现的。

### 文字转换

平原克里语使用两种文字书写：**标准罗马正字法（SRO）**和**加拿大原住民音节文字（Canadian Aboriginal Syllabics）**。champollion 的流水线：

1. LLM 翻译为 SRO（基于拉丁字母，LLM 处理得更好）
2. 质量门控验证 SRO 输出
3. 确定性转换器将 SRO 转换为音节文字
4. 转换后的文本写入磁盘

转换器处理所有 SRO 变音符号（长元音 ê、î、ô、â）并将它们映射到正确的音节字符。有关技术细节，请参阅 [文字转换器 (Script Converters)](https://champollion.dev/docs/concepts/script-converters)。

### 评估循环

[评估测试工具 (eval harness)](/docs/network/specifications/harness) 针对评估数据集运行您的方法，并生成带有评分的 [运行卡片 (run card)](/docs/network/specifications/run-card)：

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

`--name` 标志是您选择的标签。它会显示在排行榜上，以便人们可以看到您使用了什么提示词策略。测试工具会在运行卡片中记录完整的系统提示词，因此您的确切方法是可复现的。

:::tip[自由实验，提交最佳结果]
测试工具专为快速迭代而设计。使用不同的模型、辅导数据、语域和条件运行数十次实验。只有当您获得了引以为豪的结果时，才提交到排行榜。
:::

---

## 数据主权原则 {#data-sovereignty-principles}

champollion 旨在支持原住民数据主权。语言数据由社区**拥有、控制、访问和占有**——这指导我们如何为原住民社区处理语言技术：

| 原则 | champollion 如何支持它 |
|-----------|------------------------|
| **所有权 (Ownership)** | 语言社区拥有其语言数据。champollion 从不“打电话回家（phone home）”或将数据传输到我们的服务器 |
| **控制权 (Control)** | [API 方法](https://champollion.dev/docs/guides/serving-a-method) 允许社区托管他们自己的翻译流水线——我们提供接口，他们控制实现 |
| **访问权 (Access)** | 社区决定谁可以使用他们的方法。API 可以设置在身份验证之后 |
| **占有权 (Possession)** | 所有翻译数据都保留在您项目的文件系统中。[溯源系统 (provenance system)](https://champollion.dev/docs/concepts/security) 会跟踪每条翻译的来源 |

插件架构意味着社区可以在内部构建一种包含神圣或受限知识的方法，仅公开翻译 API，并保持对其语言资源的完全控制。

---

## 愿景：下一步是什么

平原克里语是第一个目标。一旦流水线得到验证并且社区对质量感到满意，相同的架构将扩展到其他具有 FST 基础设施的多式综合语：

- **其他阿尔冈昆语族语言**：林地克里语（Woods Cree）、沼泽克里语（Swampy Cree）、奥吉布瓦语（Ojibwe）、黑脚语（Blackfoot）
- **因纽特语族语言**：因纽特语（Inuktitut）、因纽纳克语（Inuinnaqtun）（它们也使用音节文字）
- **其他语系**：任何具有 FST 分析器的语言都可以使用 FST 门控流水线

排行榜的作用域是语言对。随着语言社区贡献新的评估数据集，新的排行榜赛道将自动开放。

**这是一份公开邀请。** 如果您从事低资源语言相关工作——无论是作为研究人员、社区成员、学生，还是仅仅是一个关心此事的人——champollion 都能为您提供工具，让您构建真实的东西，诚实地衡量它，并与世界分享。[方法排行榜](https://champollion.dev/leaderboard)正等待您的提交。

---

## 另请参阅

- **[方法排行榜 (Method Leaderboard)](https://champollion.dev/leaderboard)** — 提交您的分数并查看方法的比较
- **[机器翻译评估 (MT Evaluation)](/docs/network/leaderboard/rules)** — 什么是好方法，什么会被取消资格
- **[评估测试工具 (Eval Harness)](/docs/network/specifications/harness)** — 如何运行实验
- **[评估数据集 (Evaluation Datasets)](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 和 FLORES+
- **[辅导数据 (Coaching Data)](https://champollion.dev/docs/concepts/coaching-data)** — 如何为 LLM 构建语言学知识
- **[文字转换器 (Script Converters)](https://champollion.dev/docs/concepts/script-converters)** — SRO→音节文字流水线
- **[通过 API 提供方法 (Serving a Method via API)](https://champollion.dev/docs/guides/serving-a-method)** — 托管社区控制的翻译
- **[ALTLab](https://altlab.ualberta.ca/)** — 阿尔伯塔语言技术实验室
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — 教育技术、知识与语言研究组
- **[itwêwina 词典](https://itwewina.altlab.app/)** — 由 FST 驱动的平原克里语-英语词典
