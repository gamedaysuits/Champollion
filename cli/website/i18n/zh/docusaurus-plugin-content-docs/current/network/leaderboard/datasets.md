---
sidebar_position: 3
title: "评估数据集"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# 评估数据集

> **内容概要。** 本页面介绍了可用于基准测试的评估数据集，包括语料库条目规范、难度等级（1–5）以及溯源要求。目录包含**涵盖 19 个语料库家族的约 4,700 个从源抓取的评估数据集**（TICO-19、IN22、Tatoeba、GlobalVoices、SMOL、ALT、Turkic-x-WMT、WMT24++、WMT newstest/General 盲测集 2014–2025、MAFAND-MT、NusaX、NusaTranslation、LoResMT、AmericasNLP 2021、NICT-SAP、BSD、MENYO-20k、Gamayun、EdTeKLA）以及 FLORES+ —— 此处从不托管语料库*内容*；每个数据集都是根据其固定的上游存档确定性重建的 SHA 固定元数据卡片。**非商业/仅限研究通道**（Gamayun、EdTeKLA、MAFAND-MT、NusaTranslation、LoResMT、AmericasNLP、NICT-SAP、BSD、MENYO-20k 以及 WMT 研究用途集）被排除在任何商业/奖项/API 路径之外；在其中，采用修改版、定制或未说明许可的语料库还受到**同意门控（consent-gated）**——除非许可证文本本身明确授予评估用途（作为每个数据集的显式决策记录，例如 WMT 研究用途集），或者数据集条目中记录了权利持有者的许可，否则远程模型 API 评估将拒绝执行。两个人工策展的参考数据集 —— EDTeKLA Dev v1（平原克里语）和 FLORES+ Devtest（870 个编目语言对，每对 1,012 个句子）—— 详见下文；EdTeKLA 的完整条目数量明细仅在其[专属小节](#edtekla-development-set-v1)中说明一次。

数据集是测试框架运行的固定目标。每个数据集都是一个 JSON 文件，包含源→目标对及黄金标准参考。测试框架根据这些参考对模型输出进行评分 — 它从不修改它们。

:::danger[不要在评估数据上进行训练]

⚠️ **这些数据集仅用于评估。** 在评估数据上进行训练、微调、少样本提示或以其他方式暴露的方法将产生人为夸大的分数，并将被**从排行榜中取消资格**。

使用单独的语料库进行训练。评估集必须在开发期间对您的模型保持不可见。
:::

---

## 数据集格式 {#dataset-format}

每个数据集都遵循相同的 JSON 架构：

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[规范架构]
[基准规范](/docs/network/specifications/benchmark) 定义了规范语料库和条目架构。本页记录可用数据集以及如何创建新数据集。
:::

### 顶级 `dataset` 块

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `id` | `string` | 唯一数据集标识符（用于运行卡和排行榜） |
| `version` | `string` | 语义版本。增加此版本会使先前的运行卡比较失效 |
| `language_pair` | `string` | 显示标签（例如 `EN→CRK`） |
| `description` | `string` | 可选。人类可读的摘要 |
| `source_language` | `string` | BCP 47 源语言代码 |
| `target_language` | `string` | BCP 47 目标语言代码 |
| `created` | `string` | ISO 8601 创建日期 |
| `license` | `string` | SPDX 许可证标识符 |
| `provenance` | `string[]` | 跨条目使用的来源标签列表 |

### 条目字段

| 字段 | 类型 | 必需 | 描述 |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | 语料库内的唯一条目标识符 |
| `source` | `string` | ✅ | 要翻译的源文本 |
| `reference` | `string` | ✅ | 黄金标准参考翻译 |
| `difficulty` | `integer` | ✅ | 难度等级 1–5（见下文） |
| `provenance` | `string` | ✅ | 此条目的来源（例如 `gold_standard`、`textbook`、`elicited`） |
| `register` | `string` | ✅ | 寄存器/正式程度（例如 `conversational`、`formal`、`ceremonial`） |
| `context` | `string` | ✅ | 交际功能（例如 `greeting`、`declaration`、`instruction`） |
| `notes` | `string` | ❌ | 为人类审阅者提供的可选上下文 |
| `morphological_analysis` | `string` | ❌ | 黄金标准形态学分解 |
| `variant_class` | `string` | ❌ | 分组可接受翻译变体的类标签 |

---

## 可用数据集

该目录包含**涵盖 19 个语料库家族的约 4,700 个从源抓取的评估数据集**，外加下文详述的两个人工策展参考数据集（EDTeKLA + FLORES）—— 截至 2026-09-06，注册表总数达到 **5,601 个数据集**。每个语料库都是一张 **SHA 固定的元数据卡片** —— 语料库内容从不在此托管；它在评估时从其固定的上游存档确定性地重建。所有数据集均包含 `do_not_train`。一张源卡片会扇出到多个按语言对划分的数据集，因此注册表总数超过了约 1,417 张源卡片；开放通道的数据集直接进入扫描队列；仅限研究通道的数据集在其许可证明确允许的情况下按需运行（对于采用修改版/定制/未说明授权的语料库，远程模型 API 评估受到同意门控限制）。

| 家族 | 数据集数 | 构建者 / 来源 | 许可证 | 通道 |
|------|---------:|---------------|--------|------|
| **TICO-19** | 1,260 | TICO-19 联盟（CMU、JHU、GMU、Amazon、Appen、Facebook、Google、Microsoft、Translated、TWB） | CC0-1.0 | 开放 |
| **IN22** (Conv + Gen) | 1,012 | AI4Bharat / IIT Madras | CC-BY-4.0 | 开放（受 HF 门控下载限制） |
| **Tatoeba** | 874 | [Tatoeba 社区](https://tatoeba.org)，通过 Tatoeba Challenge | CC-BY-2.0 | 开放 |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | 开放 |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | 开放 |
| **WMT newstest / General**（2014–2025 盲测集） | 178 | WMT（机器翻译大会），通过 sacreBLEU | `LicenseRef-WMT-Research-Use` | **研究用途** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | 开放 |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | 开放 |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | 开放 |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **非商业 / 仅限研究** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | 开放（相同方式共享） |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **仅限研究** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop（评测任务组织者） | CC-BY-NC-SA-4.0 | **非商业 / 仅限研究** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task（组织者） | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **仅限研究** |
| **Gamayun** | 8 | CLEAR Global（前身为 Translators without Borders） | `LicenseRef-TWB-Gamayun` | **非商业 / 仅限研究** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **非商业 / 仅限研究** |
| **EDTeKLA / prize** | 2 | 阿尔伯塔大学 EdTeKLA 研究小组 | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **已隔离：不可运行且不参与排名** |
| **BSD** | 2 | 东京大学 Tsuruoka 实验室 | CC-BY-NC-SA-4.0 | **非商业 / 仅限研究** |
| **MENYO-20k** | 2 | Masakhane / 萨尔大学 (uds-lsv) | CC-BY-NC-4.0 | **非商业 / 仅限研究** |

*（FLORES+ devtest —— 870 个编目语言对，CC-BY-SA-4.0 —— 是下文详述的参考数据集，使注册表总数达到 5,601。）*

:::info[非商业仅限研究通道]
目录中的大部分内容均采用宽松许可证（CC0、CC-BY-2.0/3.0/4.0、MIT、Apache-2.0），并可在各个通道中使用。一小部分 —— **Gamayun**（TWB 的定制许可证）和 **EDTeKLA**（修改过的、限定数据主权的 CC BY-NC-SA）—— 为**非商业用途**：它被排除在任何商业、奖项或 API 路径之外。对于采用修改版、定制或未说明许可的语料库，远程模型 API 评估还受到**同意门控**限制：除非许可证文本本身明确授予评估用途（作为每个数据集的显式决策记录 —— WMT 研究用途集即带有此项），或者数据集条目中记录了权利持有者的明确许可，否则评估框架将拒绝将其文本发送到第三方模型 API（本地评估仍然可用）。资格是**基于用途**的：商业通道要求严格，研究通道较为宽松，且隔离策略始终拥有最高优先级（EdTeKLA 的语料库被直接隔离，数据库会拒绝针对它们提交的分数）。有关语料库如何选择其通道的信息，请参阅[注册语料库与开放通道](/docs/network/sovereignty/registering-corpora)。
:::

参考数据集详见下文；系列语料库遵循相同的 JSON 架构，并在数据集注册表中列出。

:::note[目录不是已填充的排行榜]
大型语料库目录是方法*可以*进行基准测试的对象 — 它不是充满结果的排行榜。排行榜本身正在初始化；参见 [排行榜规则](/docs/network/leaderboard/rules) 和 [诚实的局限性](/docs/network/honest-limitations)。
:::

### EDTeKLA 开发集 v1 {#edtekla-development-set-v1}

第一个评估数据集，为英语→平原克里语 (SRO) 翻译而构建。由阿尔伯塔大学 [EdTeKLA 研究小组](https://spaces.facsci.ualberta.ca/edtekla/)创建。

| 属性 | 值 |
|------|----|
| **ID** | `eval-eng-crk-edtekla-dev-v1`（以及 `eval-eng-crk-edtekla-textbook`） |
| **版本** | `1.0` |
| **语言对** | EN → CRK（平原克里语，SRO 正字法） |
| **条目数量** | 包含 436 个条目的开发集划分（`textbook_dev.json`）。处理链路：上游 589 行原始对齐行 → 规范化/去重后得到 486 个唯一样本对（此为 Champollion 计算得出的数量）→ 436 个开发集 + 50 个保留集（Champollion 使用 seed-42 的确定性划分 —— EdTeKLA 发布的是原始文件，并非划分集）。另一个由 62 个条目组成的黄金标准集（人工策展，仅供研究，**非** EdTeKLA 素材）使该项目合并后的平原克里语评估集总量达到 548。 |
| **难度分布** | 简单（Easy）、中等（Medium）、困难（Hard） |
| **溯源** | `gold_standard`（经母语者核对），`textbook`（已出版的教学资料） |
| **许可证** | [EdTeKLA 修改版 CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora)（`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` —— 涵盖数据主权范围；源教材为 CC BY-NC-ND 4.0）—— **已隔离**：已编目但不可运行，数据库会拒绝针对其提交的分数；排除在排行榜、奖项以及商业/API 通道之外（非商业） |

> **这是平原克里语评估集数量的权威声明。** 其他页面均链接至此处，不再重复声明。
> 486/436/50 等数据是 Champollion 根据 EdTeKLA 原始对齐文件计算得出的（EdTeKLA 本身不发布
> 任何数量或划分）；包含 62 个条目的黄金标准集具有独立的、非 EdTeKLA 的来源。
> 上述条目数量始终与其通道配对：EdTeKLA 采用修改过的、限定数据主权的 CC BY-NC-SA，并已**排除在排行榜、奖项以及商业/API 路径之外**。

**它测试什么：**

- 基本问候和常见短语
- 名词生命性和显著性
- 跨人称和时态的动词共轭
- 位置构造
- 所有格范式
- 复杂句子结构

:::tip[语料库结构]
源自 EdTeKLA 的材料分为公开开发集和保留集（Champollion 对 EdTeKLA 原始教材对齐数据的划分 —— 具体数量见上表）。独立的 62 条目黄金标准集是从其他来源人工策展的，不属于 EdTeKLA 语料库。一个规模较小、质量较高且配有经过验证的黄金标准的数据集，远比庞大但充满噪声的数据集更有用 —— 尤其是对于低资源语言而言，“相近”的翻译在形态学上往往是无效的。
:::

---

## 创建新数据集

要为新的语言对或域创建数据集：

### 1. 构造 JSON

遵循 [数据集格式](#dataset-format) 架构。每个条目必须具有 `source`、`reference`、`difficulty`、`provenance`、`register` 和 `context`。

### 2. 分配唯一 ID

使用描述性 slug：`{project}-{split}-v{version}`（例如 `edtekla-dev-v1`、`quechua-test-v1`）。

### 3. 验证黄金标准

每个 `reference` 值必须由流利使用者验证或来自已发布的、经过同行评审的资源。机器生成的参考会破坏评估的目的。

### 4. 设置难度等级

为每个条目分配一个整数难度级别：

| 等级 | 描述 | 示例 |
|------|-------------|----------|
| 1 — 基本词汇 | 单词、常见问候、数字 | "hello" → "tânisi" |
| 2 — 简单句子 | 主谓或 SVO、现在时 | "I see the dog" |
| 3 — 中等复杂性 | 过去/未来时、所有格、生命性 | "I saw his dog yesterday" |
| 4 — 复杂形态 | 显著性、被动语态、连接顺序 | "the woman whose son went to the store" |
| 5 — 高级 | 多子句、正式寄存器、仪式、习语 | 具有寄存器适当语气的完整段落 |

### 5. 标记来源

每个条目应指示其来源。常见标签：

- `gold_standard` — 由流利使用者验证
- `textbook` — 来自已发布的教育材料
- `elicited` — 通过结构化启发会话生成
- `corpus` — 从平行语料库中提取

### 6. 验证文件

使用任何模型针对您的数据集运行测试框架，以验证 JSON 格式正确且所有必需字段都存在：

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

测试框架将在缺少字段、重复索引或架构违规时出错。

### 7. 提交以供包含

针对 [eval 测试框架存储库](https://github.com/gamedaysuits/Champollion) 打开拉取请求，添加一个**从源获取元数据卡** — 一个注册表条目，指向测试框架的上游源（加载器/URL、SHA 固定、许可证和来源）。**永远不要提交语料库内容本身。** Champollion 不托管或跟踪第三方语料库文本；测试框架在运行时从上游源获取参考，并根据新获取的数据进行评分。先在本地验证（第 6 步），然后仅提交卡。包括您的验证方法和来源来源的文档。

---

## FLORES+ Devtest

由 [开放语言数据倡议（OLDI）](https://huggingface.co/datasets/openlanguagedata/flores_plus) 维护的广泛覆盖多语言基准。用于 champollion 的多模型前沿比较。

| 属性 | 值 |
|----------|-------|
| **ID** | 每对一张卡：`eval-flores-devtest-v1-<src>-<tgt>`（例如 `eval-flores-devtest-v1-amh-fra`） |
| **语言对** | 870 个编目和可运行的对（其中 812 个在两种非英语语言之间） |
| **条目计数** | 每对 1,012 个句子 |
| **许可证** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **来源** | Meta FLORES-200，现在由 OLDI 维护 — 从源获取，每对 SHA 固定（语料库内容从不在此处跟踪） |
| **污染** | **高** — 仅相对，测试/说明用（参见注释） |

:::warning[高污染 — 仅相对，永不绝对基准]
FLORES+ 是公开的、网络爬取的数据，前沿模型很可能已经看过。Champollion 在**仅相对**通道中运行它：可用于比较方法之间的优劣，但**永不报告为绝对质量分数**，且**永不用作 [翻译地图](https://champollion.dev) 上的链边**。它仅用于**测试和说明**。
:::

:::danger[仅用于评估]
FLORES+ 仅用于评估。策划者明确要求**不将其用作训练数据**。确保其内容被排除在任何训练语料库之外。
:::

---

## 另请参阅

- [MT 评估](/docs/network/leaderboard/rules) — 评估框架和排行榜概述
- [Eval 测试框架](/docs/network/specifications/harness) — 如何针对这些数据集运行评估
- [运行卡规范](/docs/network/specifications/run-card) — 用于记录结果的 JSON 架构
- [方法排行榜](https://champollion.dev/leaderboard) — 实时基准分数
- [EdTeKLA 项目](https://spaces.facsci.ualberta.ca/edtekla/) — 克里语数据集背后的阿尔伯塔大学研究小组
