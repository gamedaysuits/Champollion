---
sidebar_position: 4
title: "贡献计算资源"
description: "运行队列：使用你自己的 API 密钥运行公共队列中的开放基准测试扫描，并发布结果。"
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# 贡献计算资源

> **核心理念：** 排行榜上存在未填补的空白——即尚未有人测量过的（语言对、方法、条件）组合。我们维护了一个公开的任务队列。你可以使用自己的 API 密钥运行这些测试项，发布测试报告，从而填补这张语言覆盖图景。贡献算力是对低资源机器翻译评估的一项切实且可被引用的贡献。

队列中包含两类工作。**LLM 项目**用于测试对话模型在特定语言对上的表现，采用 `naive` 或 `coached` 提示条件。**引擎项目**（条件 `engine`）用于测试传统机器翻译服务（DeepL、Google Translate、Microsoft Translator、LibreTranslate、Tilde）在这些服务自身公开覆盖范围内的语言对；它们构成了覆盖图谱中经过实际测量的基石，而在 2026-08 之前，这些内容几乎完全是空白。这两类项目都通过相同的测试套件（harness）运行，并发布到同一个榜单上。

## 队列

实时队列由数据库提供服务（测试框架默认读取该数据库）；紧凑快照发布在 [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json)，完整文件位于 [queue.json](https://champollion.dev/queue.json)（文件达数十 MB——预览版是首次获取的理想选择）。你可以在 [champollion.dev 上的实时图谱](https://champollion.dev)上查看你运行的结果所构建出的内容——即展示谁能够翻译什么的覆盖图谱。此外还有一个零安装的终端查看器：

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

查看器只*显示*开放项目及其确切的 `mt-eval run` 命令 — 它永远不会执行任何操作或消耗你的令牌。每个项目包含：

- `run_command` —— 开箱即用，支持直接复制粘贴（自动获取语料库并运行测试框架）
- `est_cost_usd` 与 `est_basis` —— 可以是我们自己针对相同（语料库、模型）基准运行的**实测**成本，也可以是根据该模型扫描的平均单条成本 × 语料库条目数得出的**推算**值。每个测试项都会注明计算依据；你的实际花费取决于运行时的服务提供商定价。
- `priority` —— 公布的排名（调查模式：每美元在语言对、单语言和语系中带来的首次覆盖洞察）。预览版还公布了**预算层级**——展示在排名最前列投入 $1 / $10 / $100 / $1000 所能带来的产出（涵盖的项目数、语言对数、触达的模型数）——以便你在产生任何花费之前评估贡献规模。底层的价值模型为**预期链价值**：即预测此单次运行每花费一预估美元能为整个语言网络带来多大程度的增强。每个测试项都附带其完整的公式明细（`edge_strength`、`pair_prior`、`model_offset`、`exploration_bonus`、`predicted_strength`、`expected_mesh_gain`、`ecv_per_usd`），因此任何排名都可以手工重新推导——公式及其默认值发布在[队列构建规范](/docs/network/specifications/queue-construction)中，背后的设计考量则详见[为什么队列以这种方式构建](/docs/network/perspectives/why-the-queue)。

**无声明锁定 — 选择任何开放项目。** 两个人运行同一项目在设计上是无害的：每个运行卡都有指纹 (数据集哈希 + 模型 + 条件 + 系统提示的 SHA-256，[基准规范 §3.8](/docs/network/specifications/benchmark))，所以相同的运行在发布时会去重，相同配置的独立复制是有用的证据，不是浪费。

队列中的语料库是开发集分割、CC-BY 系列 (Tatoeba 衍生)，并标记为 `do_not_train` — 它们是评估集，不是训练数据。非商业许可和隔离的语料库被排除在开放队列之外。

## 设置 (一次性)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### 选择哪个提供商密钥？

测试框架接受四个提供商密钥，通过 `--provider` 在 `mt-eval run` 和 `mt-eval queue` 上选择 — 或从你的环境或 `.env` 中设置的任何密钥自动检测：

| `--provider` | 密钥 | 覆盖 |
|---|---|---|
| `openrouter` (默认) | `OPENROUTER_API_KEY` | 队列阵容中的每个模型 |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic Claude 模型 |
| `openai` | `OPENAI_API_KEY` | OpenAI GPT 模型 |
| `gemini` | `GOOGLE_API_KEY` | Google Gemini 模型 |

一个 [OpenRouter](https://openrouter.ai/keys) 密钥可以覆盖阵容中的每个模型，测试框架的成本跟踪和定价快照来自相同的 OpenRouter 元数据，所以报告的运行成本与你的密钥被计费的金额相匹配 — 这就是它成为默认值的原因。如果你的额度直接在 Anthropic、OpenAI 或 Google，设置该供应商的密钥，测试框架将直接调用供应商的 API，无需代理。直接密钥只能覆盖该供应商自己的模型 (适合单供应商批处理)，其成本数据来自已发布的供应商定价而非计费元数据 — 将其视为接近的估计。如果同时设置了 OpenRouter 密钥和直接密钥，自动检测会选择 OpenRouter；队列工作程序会告诉你这一点以及如何用 `--provider` 覆盖。每个运行卡在其 `api_provider` 字段中记录它通过哪条通道运行。

(`mt-eval run` 也接受 `--provider local` 用于自托管的 OpenAI 兼容端点 — Ollama、vLLM、LM Studio — 通过 `--base-url`。这是显式选择加入，永远不会自动检测。)

### 无 API 密钥：运行自托管模型

你完全不需要云端密钥。`local-model` 方法可以在你自己的硬件上运行开源神经机器翻译（NMT）模型——这些模型云端引擎通常不提供支持，而这恰恰是低资源语言覆盖所在之处：**NLLB-200**、**OPUS-MT**（Helsinki-NLP）以及 **MADLAD-400**。

```bash
# transformers backend (Hugging Face) — install the extra once:
python3 -m pip install 'mt-eval-harness[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**两种“常规”模型加载方式，自动选择——无需额外配置：**

- **transformers**（默认）：`--model` 是一个 Hugging Face hub ID（`facebook/nllb-200-distilled-600M`、`Helsinki-NLP/opus-mt-en-es`、`google/madlad400-3b-mt`）或本地 `from_pretrained()` 目录。需要 `python3 -m pip install 'mt-eval-harness[local-models]'`。
- **CTranslate2**（高速 CPU/GPU 推理）：`--model` 是一个转换为 CTranslate2 格式的模型目录（由 `ct2-transformers-converter` 生成，包含 `model.bin`）。需要 `python3 -m pip install 'mt-eval-harness[ctranslate2]'`。分词器（tokenizer）会从转换后的目录中读取，或者通过 `LOCAL_TOKENIZER_ID` 指定。

后端会根据模型路径自动检测（CTranslate2 目录包含 `model.bin`）；如果需要，也可以使用 `LOCAL_MODEL_BACKEND=transformers|ctranslate2` 进行强制指定。

**`-m` / `--model` 为必填项。** `local-model` 没有默认模型：没有指定模型的运行会被拒绝，且运行卡片会记录实际加载的模型（hub ID 及其修订版本，或附带文件 SHA-256 哈希的本地目录）。Hugging Face ID 会在首次运行时将其权重下载到 Hugging Face 缓存中（可通过 `HF_HOME` 更改路径）。

**专有语言对模型仅针对自身语言对进行翻译。** OPUS-MT 模型（`Helsinki-NLP/opus-mt-<src>-<tgt>`）只翻译其名称中指定的语言对。如果语料库属于其他语言对，该运行将被拒绝，除非你传入 `--allow-model-pair-mismatch` —— 适用于特意设置的亲属语言基准测试（例如在英语→北萨米语测试集上运行 `opus-mt-en-fi`）；运行卡片会记录该语言不匹配情况。

**语言代码直接取自语言卡片，绝非猜测。** 对于像 NLLB 这样的多语言模型，测试框架会直接从目标语言的卡片中读取 FLORES-200 代码（每种方法使用的同一事实源）。对于该模型确实不支持的语言——例如 NLLB-200 不支持平原克里语（`crk`）——会**如实报错**（“超出该模型支持范围”），而不是生成一个虚假代码和看似合理实则错误的翻译。OPUS-MT 模型针对特定语言对，因此该语言对*即*代表模型本身。

本地模型运行的评分与发布方式与其他任何运行完全相同——指标一致，运行卡片一致，排行榜一致。（它是测试框架的一种方法；CLI 翻译工具后续会通过子进程桥接来调用它，因此 Node 从不需要依赖 Python 机器学习栈。）

### 代理快速路径

如果你使用 Claude Code 或其他编码代理，整个贡献就是一个提示：

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## 第 0 层 — 一条命令

最快的贡献方式是让测试框架为你取队列的顶部：

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

它永远不会重新排序 — 队列顺序*就是* [优先级模型](/docs/network/specifications/queue-construction) — 它显示完整的计划，包括估计支出，并在执行任何操作前询问。除非你带上自己的教练文件 (`--include-coached --coaching-file my-coaching.txt`)，否则教练项目会被跳过。

**队列工作程序为你发布 — 无需账户。** 与单个 `mt-eval run` 不同 (它永远不会自动发布)，`mt-eval queue` 在花费任何令牌之前解析发布身份，并**在每次成功运行完成时自动发布**到排行榜 — 无需单独的发布步骤。仅当你想在排行榜上署名时才登录 (GitHub/Google)；否则继续匿名，结果将以提交者 `anonymous` 的身份发布 (`--anonymous` 强制执行，非交互式 `curl | bash` 运行且没有缓存的登录默认为此，并大声说出来)。传递 `--no-publish` 以保持结果本地 (你可以稍后用 `mt-eval publish` 发布它们)。然后在 [champollion.dev 的实时地图](https://champollion.dev)上观看你的运行构建的内容。

## 第 1 层 — 运行基准

每个队列项目的 `run_command` 都是自包含的。一个典型的：

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

你传递**注册表 id**，而不是文件 — 测试框架在运行时从其上游源获取参考，并针对新获取的数据进行评分 (语料库内容永远不会在此处托管或跟踪)。

运行打印其总成本，并将运行日志加上评分报告写入 `eval/logs/`。然后发布：

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**无需账户。** 发布提供 OAuth 登录 (GitHub/Google)，以便你的名字成为排行榜的署名 — 但这是可选的：`mt-eval publish <report> --anonymous` 无需账户即可发布，该行显示方式与任何其他自基准测试结果完全相同，提交者为 `anonymous`。匿名提交受速率限制 (每个连接每小时几张卡；登录是无限制的路径)，并通过与所有其他提交相同的数据库完整性门 — 隔离、分数范围、语料库-sha 绑定和语料库内容保护都相同适用。无论是匿名还是署名，社区提交都落在**自基准测试**信任层 — 明确标记为"由运行它的人提交"。这不是降级；这是信任模型在工作。运行卡包含任何人重新运行你的确切配置所需的一切：数据集哈希、模型、条件、完整系统提示和成本。提升的层级 (验证、社区验证) 通过审查授予 — 见 [排行榜规则](/docs/network/leaderboard/rules)。

:::note[审核]
匿名行与其他所有内容一样受到审核：提交对公开 API 是不可变的，任何策展人删除或更正都通过服务角色通道进行，其中数据库的审计跟踪保留先前的行 — 所以清除被记录并可逆转，永远不会无声。
:::

## 第 2 层 — 制作教练提示

测试框架对**教练**有一流的支持：用包含真实语言知识的提示替换朴素系统提示。传递 `--coaching-file` (或 `--coaching "inline text"` 用于短提示)，测试框架使用你的文本作为系统提示，在运行日志的出处块中记录**完整文本加其 SHA-256**，并将运行的条件标记为 **`coached`** (除非你显式设置 `--prompt`) — 所以提示制作是一个可重现、可归属的实验，两个不同的教练文件永远不会相互混淆，教练运行在排行榜上永远不会被误认为是朴素基准。

一个法罗语的实际例子，使用来自语言的[公开语言卡](https://champollion.dev/languages)的类型学事实和词汇表条目：

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(编写你自己的教练内容 — 上面的事实说明了*形状*：几条高影响语法规则、一个小的模型容易出错的术语词汇表、一条寄存器指令。[champollion.dev/languages](https://champollion.dev/languages) 的语言卡引用你可以借鉴的类型学来源。)

用 `mt-eval compare <naive_log> <coached_log>` 与朴素基准进行比较，迭代，并发布你最好的运行。运行自动以条件 `coached` 发布；如果你想排行榜显示命名方法而不是通用标签，在发布时附加方法卡 (发布流提供向导)。在低资源对上仅用提示工程击败朴素基准是一个真实的、可发布的发现 — 见完整的 [教练 LLM 提示烹饪书](/docs/network/tutorials/coached-llm-prompting)以获取设计指导。

## 第 3 层 — 构建方法

最雄心勃勃的贡献：实现 `TranslationMethod` 协议 (`translate(entries, config)`) 并基准测试一个实际系统，而不是提示。测试框架通过 `--method <plugin-dir>` 运行它，并将你的方法卡嵌入运行卡中。带有实际烹饪书的模式：

- **[FST 门控管道](/docs/network/tutorials/fst-gated-pipeline)** — 每个候选词都由形态分析器检查；LLM 重新生成直到门通过。半确定性、形态学保证的输出。
- **[字典增强生成](/docs/network/tutorials/dictionary-augmented-llm)** — 在翻译时在双语词典中查找源术语并约束输出。
- [链式模型](/docs/network/tutorials/chained-models)、[少样本检索](/docs/network/tutorials/few-shot-prompting)、[回译](/docs/network/tutorials/back-translation)、[基于规则的混合](/docs/network/tutorials/rule-based-hybrid)…

方法声明**依赖类** (S/O/A1/A2/X — 见 [方法规范](/docs/network/specifications/methods#method-validity-and-dependency-classes)) 描述它们需要什么来运行和转移：自包含管道是 S 类；在运行时调用许可字典 API 的是 A2。诚实声明 — 类决定你的方法可以在哪里竞争，清单被审计。

## 为什么这对排行榜之外很重要

每个发布的运行都是关于商业提供商不测量的语言对的机器翻译质量的独立证据。队列也充当*需求*的公开记录：社区认为值得测量的语言对、当前 API 价格下的覆盖成本，以及贡献的计算资源能延伸多远。当我们要求资助机构为系统扫描提供资金时，这个队列及其填充率是需求证据。
