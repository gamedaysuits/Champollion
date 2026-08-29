---
sidebar_position: 4
title: "方法接口"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# 共享方法接口

> **执行摘要。** 本页规定了所有 Network 方法必须实现的 `TranslationMethod` 协议、六个方法类（`raw-llm`、`coached-llm`、`pipeline`、`custom-plugin`、`api`、`human`）、正交的**范式**轴（`rule-based`、`statistical`、`neural-nmt`、`llm`、`hybrid`、…），使得*方法如何翻译*在系统间可比较，方法插件格式，以及**依赖类**（S/O/A1/A2/X），这些决定了方法是否能在评估沙箱中运行并符合奖项资格。这是三个独立的轴。任何实现此协议的方法都可以进行基准测试；它所依赖的内容决定了它可以在哪里竞争。

eval harness 和 champollion 共享一个**翻译方法**的通用概念。方法是任何接收源文本并生成翻译文本的过程——无论是直接的 LLM 调用、多阶段管道、第三方 API 还是人工翻译。

## 架构

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

通过 `--method path/to/dir` 加载。harness 不会自动发现任何内容。

## 两个系统，一个接口

| | Eval Harness | champollion |
|---|---|---|
| **语言** | Python | Node.js |
| **入口点** | `translate.py` | `translate.js` |
| **接口** | `TranslationMethod` 协议 | `methodPlugin` 配置 |
| **用途** | 批量评估与评分 | 开发/CI 中的实时本地化 |
| **输出** | 带有指标的运行卡 | 翻译后的区域设置文件 |

支持两个系统的方法提供两个入口点——每个语言运行时一个。**方法卡**是桥梁：它以两个系统都能理解的格式描述方法。

## 方法卡 {#method-card}

方法卡描述*什么是*翻译方法，而不暴露专有细节，如完整的系统提示。它回答：

- 这是什么类型的方法？（原始 LLM、经过指导的 LLM、管道、API 等）
- 它使用什么**范式**？（基于规则、统计、神经机器翻译、LLM、混合）
- 它使用什么工具？（FST 分析器、字典等）
- 实现是开源的吗？
- 它支持哪些语言对？

参见[方法卡规范](/docs/network/specifications/methods#method-card)了解完整的 JSON 模式。

### 示例

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

`dependency_class` 字段总结了方法需要运行和传输的内容——参见下面的[方法有效性和依赖类](#method-validity-and-dependency-classes)。`paradigm` 字段将方法放在**范式轴**上（这里 `hybrid`：由基于规则的 FST 控制的 LLM）——参见下面的[范式](#paradigms)。

### 方法类

| 类 | 描述 |
|-------|-------------|
| `raw-llm` | 最少指令的直接 LLM 调用 |
| `coached-llm` | 具有结构化提示、示例、约束的 LLM |
| `pipeline` | 具有确定性组件的多阶段管道 |
| `custom-plugin` | 实现 `TranslationMethod` 协议的外部进程 |
| `api` | 第三方翻译 API（Google Translate、DeepL 等） |
| `human` | 人工翻译（用于建立基线） |

### 范式 {#paradigms}

**范式**是第三个独立的轴：*方法在算法级别如何翻译*。它与方法类和依赖类都正交。仅方法类是以 LLM 为中心的——基于规则的 [Apertium](https://www.apertium.org/) 系统和 Google Translate 都属于 `pipeline`/`api`，所以"基于规则 vs 神经"在没有它的情况下是不可见的。范式轴使该比较成为一流的、可在排行榜上过滤的。

| 范式 | 描述 | 示例 |
|----------|-------------|----------|
| `rule-based` | 有限状态转换器、手写语法、形态转移 | Apertium、GiellaLT FST 生成 |
| `statistical` | 短语统计 / 统计机器翻译（SMT），从平行语料库学习 | 经典 Moses |
| `neural-nmt` | 专用神经编码器-解码器机器翻译模型 | Google Translate、DeepL、Microsoft Translator、OPUS-MT、LibreTranslate、Tilde MT、Translated (Lara) |
| `llm` | 被提示进行翻译的通用大型语言模型 | 原始或经过指导的 GPT / Claude / Gemini 调用 |
| `hybrid` | 在一个方法中结合两个或多个范式 | 由基于规则的 FST 控制的 LLM (crk-translate)；NMT + 基于规则的后期编辑 |
| `human` | 人工翻译（范式级基线） | 社区翻译者基线 |
| `unknown` | 未指定——卡未声明范式 | 前范式卡的向后兼容默认值 |

这些轴是独立的。一些实际工作示例：

| 方法 | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate（自托管、开源） | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate（FST 控制、LLM 指导） | `pipeline` | `hybrid` | A2 |
| 原始 GPT 调用 | `raw-llm` | `llm` | A1 |

范式在方法卡上是**可选的**；缺失的范式被记录为 `unknown`（它永远不会阻止发布——该轴是附加的）。上面的枚举是规范的、受支持的词汇表，由 harness 强制执行（`config.VALID_PARADIGMS`）。因为强制执行是应用端而不是数据库约束，新范式可以在以后添加而无需迁移；只有在方法依赖它后重命名或删除值才是昂贵的。

## 方法有效性和依赖类 {#method-validity-and-dependency-classes}

方法的可运行性和可转移性只取决于其最不可用的依赖。两个 Network 机制取决于准确了解方法需要什么：

1. **沙箱评估**（[基准规范 §8.2](/docs/network/specifications/benchmark)）——官方黄金标准分数来自网络策略为**默认拒绝**的沙箱。无法在沙箱中运行的方法无法产生官方分数。
2. **奖项转移**（[奖项规范](/docs/network/specifications/prizes)）——获奖方法转移到语言社区的治理组织。捆绑提交者无权包含的内容的方法无法合法转移。提交者必须持有（或被授予）盒子中所有内容的权利。

为了使两项检查都是机械的而不是临时的，每个方法都声明一个**依赖类**，源自 `method.json` 中的**依赖清单**。

> **关于命名的注意——三个独立的轴。** *方法类*（上面的 §：`raw-llm`、`pipeline`、…）描述方法的*形状*——它呈现的接口契约。*范式*（[§范式](#paradigms)：`rule-based`、`neural-nmt`、`llm`、…）描述*它如何在算法上翻译*。*依赖类*（本节）描述*它需要什么来运行和转移*。这三个是正交的：`pipeline` 方法可以是 `rule-based` 或 `hybrid`，并且可以是任何依赖类。（类和范式是有意分开的，因为仅类是以 LLM 为中心的——当两者都呈现为 `pipeline` 或 `api` 时，它无法区分基于规则的系统和神经系统。）

### 五个依赖类

| 类 | 名称 | 定义 | 沙箱可运行？ | 奖项合格？ |
|-------|------|-----------|-------------------|-----------------|
| **S** | 自包含 | 所有代码、数据、模型和权重都在方法目录内发布，许可证允许重新分发和社区转移。 | ✅ 是，按原样 | ✅ 是 |
| **O** | 开放外部 | 依赖于在允许重新分发的开放许可证下的外部托管工件（包括 AGPL 等 copyleft 许可证）——例如，在安装时下载的 FST。 | ✅ 是——工件被固定并**镜像到提交中** | ✅ 是，具有许可证兼容性条件：copyleft 条款通过转移保留，社区获得许可证授予所有人的相同权利 |
| **A1** | API 依赖、可替换 | 需要运行时 LLM 推理，其中模型是**可替换配置**——任何足够能力的模型都可以插入。方法的价值在于其提示、指导数据和代码，而不是任何一个提供商的模型。 | ⚠️ 仅通过沙箱规范定义的 **LLM 网关**（🔲 计划中——见下文） | ⚠️ 条件性——见下文 |
| **A2** | API 依赖、不可替换 | 需要运行时调用无法镜像或替换的外部数据或服务 API——通常是因为服务的内容是专有或无许可的（例如，其基础字典没有公开许可证的字典 API）。 | ❌ 否——依赖在没有权利持有者许可的情况下无法存在于沙箱中 | ❌ 不是，直到权利持有者授予沙箱包含**和**转移权限。允许在开放（开发段）排行榜上使用可见的**"外部依赖"**标志 |
| **X** | 封闭 | 捆绑提交者无权重新分发的内容——无许可数据集、抓取的专有内容、许可证不兼容的组件。 | ❌ | ❌ 在每个通道中都不可接受。捆绑无权使用的内容是许可证违规，无论方法在哪里运行 |

**有效类。** 方法的依赖类是其所有声明依赖中*最严格*的类，顺序为 S < O < A1 < A2 < X。一个无许可字典使得原本自包含的管道成为 A2 类（如果在运行时访问）或 X 类（如果捆绑而无权）。

### A1/A2 区分：可替换性

大多数方法调用 LLM。Network 不否认这一点——但它区分两种非常不同的 API 依赖：

- **A1（可替换）：** API 提供商品 LLM 推理。模型标识符是配置：方法必须针对任何兼容的推理端点（包括社区托管的开放权重模型）端到端运行。输出质量可能因模型而异——这是开发者的风险，官方分数与评估中使用的固定模型相关联。依赖于**提供商端状态**的方法（仅在提供商处托管的微调、提供商文件存储、提供商特定助手）*不*可替换：该状态无法替换，所以依赖是 A2，除非基础权重或数据包含在提交中。
- **A2（不可替换）：** API 提供独特的东西——通常是专有或无许可数据。没有替代端点可以提供它，内容无法在没有权利持有者许可的情况下镜像到沙箱中。方法在开放排行榜上工作（已标记），但在权限存在之前无法产生官方沙箱分数或符合奖项资格。

**A1 奖项转移实际传达的内容。** 社区不会获得模型——没有人可以转移 Anthropic、Google 或 OpenAI 的权重。转移涵盖模型*周围*的完整配方：所有提示、指导数据、管道代码、重试逻辑、配置和记录的模型要求。因为模型在构造上是可替换的，社区可以将转移的方法指向他们选择的任何提供商——或指向他们自己硬件上的开放权重模型——无需开发者的参与。配方是拥有的；引擎是租赁的和可替换的。

### 依赖清单（`method.json`）

每个方法在 `method.json` 清单中声明其依赖。每个条目记录工件是什么、来自哪里、什么许可证涵盖它以及方法如何访问它：

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| 字段 | 必需 | 描述 |
|-------|----------|-------------|
| `id` | ✅ | 依赖的稳定标识符 |
| `kind` | ✅ | `data`、`model`、`software` 或 `service` |
| `license` | ✅ | SPDX 标识符、`proprietary` 或 `none`。`none` 意味着不存在公开许可证——被视为保留所有权利 |
| `access` | ✅ | `bundled`（在方法目录中发布）、`mirrored`（在安装时获取、固定、供应到提交中）、`gateway`（通过评估网关进行运行时 LLM 推理）、`external-api`（任何其他运行时网络调用） |
| `source` | ✅ | 规范 URL 或 `provider:slug` 标识符 |
| `pin` | 对于 `mirrored` | 固定确切工件的版本、提交或内容哈希 |
| `substitutable` | 对于 `gateway`/`external-api` | 任何兼容端点是否可以提供此依赖 |
| `redistributable` | ✅ | 许可证是否允许重新分发工件 |
| `transferable` | ✅ | 工件（或其权利）是否可以在奖项转移条款下转移到社区 |
| `notes` | ❌ | 自由格式上下文 |

**类派生。** 每个依赖贡献一个类；方法的 `dependency_class` 是最严格的：

| 依赖配置 | 贡献 |
|--------------------|-------------|
| `bundled` + 许可证允许重新分发和转移 | S |
| `mirrored` + 允许重新分发的开放许可证（包括 copyleft） | O |
| `gateway` + `substitutable: true`（LLM 推理） | A1 |
| `external-api`，或 `gateway` 带 `substitutable: false` | A2 |
| `bundled` + `license: none` 或不兼容重新分发的许可证 | X |

声明的 `dependency_class` 必须与 harness 从清单派生的类匹配。不匹配是验证错误。

**没有**外部依赖的方法声明 `"dependency_class": "S"` 和 `"dependencies": []`。空数组是一个肯定的陈述，像任何其他一样被审计。

### 有效性如何被验证

三层，从最便宜到最权威：

1. **清单审计。** harness 从清单派生有效类并拒绝不匹配。审查者根据其声明的许可证和来源检查每个声明的依赖——声明为 `redistributable: true` 但上游许可证另有说法的依赖会审查失败。
2. **静态分析。** 提交的代码被扫描以查找网络调用、动态下载和清单未说明的文件系统访问。在审查中发现的*未声明*依赖是拒绝的理由，无论它属于什么类——清单必须完整，而不仅仅是准确。
3. **沙箱网络策略。** 沙箱规范要求**默认拒绝出站**：方法容器除非明确允许列出路径，否则无法访问网络。规范定义的唯一出站路径是 **LLM 网关**——由评估基础设施运营的推理代理，限制为固定模型的显式允许列表，每个请求和响应都被记录以供运行后审计。不在允许列表上的任何内容在网络层失败，而不是在策略层。参见[基准规范 §8.6](/docs/network/specifications/benchmark)了解网络策略和网关设计。

> **两个不同的沙箱——一个计划中，一个已上线。** 请仔细阅读，因为"沙箱"一词涵盖两个不同的概念：
>
> - 🔲 **计划中：平台沙箱及其 LLM 网关。** 本节描述的由评估基础设施运营的环境——其 LLM 网关将允许 Class A1 方法生成官方黄金标准分数——已指定但尚未构建。在构建之前，Class A1 方法原则上符合奖项资格，但目前还无法生成官方黄金标准分数。
> - ✅ **已上线：组织者节点方法执行通道。** 竞赛组织者自己的评分节点已在网络隔离容器内执行提议的方法包（`mt-eval node run-method`）：使用 `--network=none` 构建和运行，只读根目录，依赖项已供应——这限制了它只能运行不需要运行时网络的方法（按构造属于 Class S/O）。它可以在真正的气隙机器上运行，通过可移动媒体传输签名的仅分数包。有关端到端路径，请参阅 [运行主权竞赛](/docs/network/sovereignty/run-a-sovereign-contest)。
>
> 本节描述的是平台规范的要求，而非当前在平台上运行的内容。

### 排行榜显示

- 排行榜在其方法类徽章旁边显示每个方法的依赖类。
- 开放排行榜上的 A2 类方法带有可见的**"外部依赖"**标志：它们的分数取决于可能改变或消失的第三方服务，它们目前不符合奖项资格。
- X 类方法未列出。

## Eval Harness：TranslationMethod 协议 {#eval-harness-translationmethod-protocol}

评估工具使用 Python 的结构化类型（`Protocol`）来处理插件。任何具有正确成员的类都可以工作——不需要继承。该协议有**三个**必需成员，不仅仅是 `translate`：

1. **`name`**（`str`）——人类可读的方法名称，用于运行 ID 和日志。
2. **`method_card()`**（`-> dict | None`）——用于来源追踪的方法元数据，嵌入在运行日志和已发布的运行卡中。如果方法没有卡，则返回 `None`。
3. **`async translate(entries, config)`**（`-> list[dict]`）——翻译本身：批量输入条目，每个条目输出一个结果字典。

当工具通过 `--method path/to/dir` 加载插件时，它验证 `translate` 是否可调用，然后读取 `method.name` 并无条件地调用 `method.method_card()`——缺少任一项的插件将在加载时崩溃，而不是优雅地失败。

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

插件目录需要一个 `method.json` 清单，至少包含 `name` 和 `entry_point`（`"module_name:ClassName"`——模块从插件目录加载，类被实例化）。如果返回的方法卡声明了 `class` 或 `paradigm`，它必须使用上面的规范词汇——非分类法卡将在加载时验证失败，而不是无声地从排行榜的过滤器中消失。

有关完整的实际示例——端到端构建、运行和提交插件——请参阅 [提交方法](/docs/network/getting-started/submit-a-method) 和 [FST-Gated Pipeline 食谱](/docs/network/tutorials/fst-gated-pipeline)。

## champollion：methodPlugin 配置

在 champollion 中，方法按语言对在 `champollion.config.json` 中注册：

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

参见[插件规范](https://champollion.dev/docs/reference/plugin-spec)了解 champollion 端接口。

## 排行榜集成

当方法卡附加到运行时（通过 `--method-card`），它被嵌入运行卡并显示在排行榜上：

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

如果未提供 `--method-card`，`mt-eval publish` 启动一个交互式向导，引导您完成描述方法的过程。

排行榜显示：
- **类徽章** — 视觉指示符（例如"pipeline"、"coached-llm"）
- **范式** — 算法范式（例如"rule-based"、"neural-nmt"、"llm"、"hybrid"），一个可过滤的列（参见[范式](#paradigms)）
- **依赖类** — S/O/A1/A2（参见[方法有效性和依赖类](#method-validity-and-dependency-classes)）；A2 方法带有"external dependency"标志
- **方法名称** — 来自方法卡
- **使用的工具** — 从方法卡列出
- **开源指示符**

当未附加方法卡时，排行榜显示 harness 原生配置（模型、提示版本、温度、启用的工具）。

:::danger[不要在评估数据上进行训练]
开发过程中接触过评估数据集的方法——作为训练数据、少样本示例、字典条目或提示调优材料——将被**取消资格**，不能进入排行榜。有关什么区分好方法和坏方法，请参阅 [MT 评估](/docs/network/leaderboard/rules)。
:::

---

## 另请参阅

- [机器翻译评估](/docs/network/leaderboard/rules) — 概述、排行榜价值和好/坏方法指导
- [Eval Harness](/docs/network/specifications/harness) — 如何运行评估
- [评估数据集](/docs/network/leaderboard/datasets) — 可用数据集（EDTeKLA、FLORES+）
- [运行卡规范](/docs/network/specifications/run-card) — 运行卡 JSON 模式
- [插件规范](https://champollion.dev/docs/reference/plugin-spec) — champollion 端插件接口
- [方法排行榜](https://champollion.dev/leaderboard) — 实时基准分数
- [基准规范](/docs/network/specifications/benchmark) — 评估协议、语料库格式、运行卡模式
- [评分规范](/docs/network/specifications/scoring) — 指标、复合权重和质量等级的 SSOT
