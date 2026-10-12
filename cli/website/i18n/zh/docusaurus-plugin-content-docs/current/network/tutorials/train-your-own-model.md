---
sidebar_position: 0
title: "想要训练自己的模型？"
description: "一份面向 Agent 的端到端全流程演练，介绍如何使用 nmt-forge 训练低资源翻译模型 —— 从 python3 -m pip install 到将模型接入 champollion CLI。你只需指挥编程 Agent，护栏机制会自动拦截新手错误。"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# 所以你想训练自己的模型

这是一份为低资源语言训练机器翻译模型的完整实操指南——从“我会说这种语言，但几乎没有任何数据”开始，直到训练出一个可以如实报告结果、通过 champollion CLI 接入自己的应用程序并提交至 [Network](/docs/network/) 的模型。训练只是漫长旅程中的一步（发现已有资源、评估各种方案、构建更好的成果、验证它、部署它）；[为您的语言构建机器翻译](/docs/build-mt-for-your-language)是整个流程的综述。
本文专为新手编写，并假定采用当下主流的工作方式：**由你指导编码智能体（Coding Agent）**（Claude Code、OpenAI Codex、Cursor、OpenCode、Google Antigravity 等），并由智能体来运行这些工具。

因此下面的每一步都遵循相同的结构：

- 🗣️ **告诉你的代理** — 用简洁的语言要求什么。
- 🛠️ **工具做什么** — [nmt-forge](/docs/network/getting-started/training-honestly) 代表你运行什么，以及**防护栏**在经典错误造成损失之前捕捉它。
- 👀 **如何读取结果** — "好"的样子是什么，以及需要注意什么。

:::info[首先，词汇表]
如果*开发集*、*解码*、*chrF++*、*泄漏*或*往返验证*这样的术语还不是你的常识，请先阅读[**MT 训练简明语言**](/docs/network/context/mt-training-concepts)——它用实例定义了这里使用的每个词。本页将依赖所有这些术语。
:::

:::note[诚实是特性，不是摩擦]
该工具有意见地设计。它的防护栏将真实的、经过测量的错误机械化——这些错误来自真实项目——所以诚实的路径是默认的，不诚实的捷径**拒绝执行并显示一条消息，说明修复方法**。在本指南中，每当你看到拒绝时，那就是工具在做它的工作。你会希望它这样做。
:::

---

## 开始前你需要什么

- **一个编码智能体**，具备终端与文件系统访问权限。它是核心驱动者。
- **目标语言对的部分真实翻译句子**——即使只有几百对由人工翻译的句对，也是一个可行的开端。双语教材、社区档案、翻译后的公共记录、教育材料皆可。质量优于数量。
- **可选但十分强大：**目标语言的单语文本、双语词典、已出版的参考语法以及形态分析器（FST）。开始前**并不**需要备齐所有这些——工具会明确告诉你当前存在哪些资源，以及哪些资源能解锁哪些能力。
- **算力：**一台笔记本电脑即可。护栏检查、数据切分、数据合成、审计与评分均可在 CPU 上运行，训练默认模型（从零训练的小型 Transformer）也是如此。只有在选择最大的预设配置（`nllb-600m`）时才需要 GPU——参见[第 5 步](#step-5--train)。

> 🗣️ **告诉你的智能体：** *“安装带有训练扩展的 nmt-forge（`python3 -m pip install 'nmt-forge[hf]'`）并确认 `nmt-forge` 命令可以正常运行。我们将实事求是地训练一个英语 → \<your language\> 的翻译模型。”*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

`[hf]` 扩展包含训练技术栈（torch、transformers、accelerate、tokenizers、sentencepiece、peft）；纯 CPU 的 wheel 即可。不需要其他任何内容——无需克隆 Champollion 仓库。每个命令都支持 `--json`（在 stdout 上输出单个 JSON 文档；若被拒绝，则返回 `{"error": {…, "why",
"fix"}}` with exit code 2), and `nmt-forge status` 会在任何时刻指出下一步应执行的命令。

你的智能体可以调用 Champollion MCP 服务的 `get_training_guardrails` 工具（无参数；可选 `topic`），在编写任何命令之前将完整的规则手册——包括十大护栏及其各自杜绝的错误——加载到其自身的上下文中。如果你正在指导智能体，请先让它执行此操作。

---

## 第 1 步 — 选择一种语言并查看实际存在的内容

每个项目都从询问索引该语言*有什么*开始，诚实地。

> 🗣️ **告诉你的代理：***"为我的目标语言的 ISO 639-3 代码运行 `nmt-forge discover`，并总结存在的数据和缺失的数据。"*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **工具的作用。** 它会读取该语言的 Champollion **卡片（card）**——记录该语言已知信息的唯一真实数据源——并报告其中记录的书写系统、形态分析器、词典、语料库以及评估数据集，随后将该语言定位在**资产阶梯**上。（卡片来自你通过 `--cards-dir` 指定的目录、本地检出或 `node_modules/champollion`，亦或来自公共卡片索引——该索引具有缓存机制，因此首次获取后可离线使用。若在没有缓存的情况下离线，可用 `champollion network card <code> --json` 将卡片导出至某个目录，并传入 `--cards-dir`。）

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **如何解读结果。** `✓` 标记表示你当前可以做的事情；`?` 标记表示正在等待对应资产的阶梯层级。至关重要的是，**卡片上的缺失仅意味着*未知*，绝不代表“这种语言一无所有”。** 一张信息稀疏的卡片是在邀请你补充所了解的信息，而不是一条死胡同——即使是一张空白卡片，也能让你在第 1 阶梯上获得完整的带护栏训练循环。一张内容丰富的卡片（如平原克里语 / Plains Cree）会自动连通更高阶梯：其评估集附带有 **NEVER TRAIN ON THIS（切勿用于训练）** 标记，并且其特定语言的裁判程序（referee）已就绪随时可以接入。仅当本地安装了该裁判程序的软件包时，第 5 阶梯才会勾选；否则会显示 ✗ *UNAVAILABLE* 并附带安装命令——且裁判程序绝不会加载于仅供本地使用或已封存（sealed）的测试集，因为它可能会向外部服务查询词汇。

然后搭建一个项目：

> 🗣️ **告诉你的代理：***"用 `nmt-forge init` 为这个语言对搭建一个项目，并读给我听它生成的 `NEXT_STEPS.md`。"*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ 这将创建一个工作区（每个护栏都会查阅的 `.forge/` 目录）、一个**初学者配置**，以及一份为你和你的智能体编写的 `NEXT_STEPS.md` 简要说明——涵盖命令顺序、针对你的语言的资产阶梯以及不可妥协的硬性要求。它是后续所有操作的路线图。该配置中的路径均为相对路径，因此请在项目目录内运行 forge。

`init` 还会选定你将训练的**模型**（`--model`，以明确的数值形式写入 `config.json`）：默认为 `cpu-tiny`，`cpu-finetune --base
<hf-id>`, or `nllb-600m`。[第 5 步](#step-5--train) 解释了这一选择。如果你的语言目前还没有卡片，`nmt-forge init <code> --no-card --name "<name>"` 依然会为项目搭建脚手架——卡片中的所有事实均记录为未知，绝不会凭空捏造。

---

## 第 2 步 — 指向分析器和词典（如果你有的话）

这一步是关于阶梯的**第 3-4 阶**。如果你的语言没有分析器，跳到[第 4 步](#step-4--split-your-real-data-safely)——你将仅在真实数据（和反向翻译数据）上训练，这是一条完全合法的路径。

如果分析器和词典*确实*存在，它们解锁了*制造*经过验证的训练数据的能力——这是对平行文本很少的语言最大的杠杆。

> 🗣️ **告诉你的代理：***"卡片列出了这种语言的形态分析器和词典。根据卡片上的安装说明获取它们，通过记录的环境变量将语言包指向它们，并确认分析器对几个已知单词进行往返验证。"*

🛠️ **工具做什么 — 以及它不会跨越的边界。** 分析器（FST）和词典是**独立的、用户获取的工具，各有自己的许可证**。该套件**从不捆绑或重新分发它们** — 它指向它们的来源和许可证是什么，你去获取它们。这不是官僚主义：许多语言资源承载真实的权限和主权约束，工具通过构造尊重它们。

连接组织是一个**语言包**：一个小插件，将*你的*分析器、词典、正字法规则和语法引用的句子模板适配到引擎。该套件**不**自己提供任何包——包与它们的语言一起存在（例如，平原克里语包存在于它自己的项目中，并通过模块路径插入）。

👀 **如何读取结果。** 你希望分析器**往返验证**：拼写一个形式，将拼写反馈回去，获得相同的语法标签。如果它不这样做，包的**规范化器** — 规范化两个组件相遇处拼写的唯一函数 — 可能需要一条规则。把这个做对很重要：单个未协调的字符（`ý` vs `y`）曾经在几周内无声地从生成管道中删除了 1,375 个动词。工具的**漏斗审计**精确计算每个阶段的幸存者，以便像这样的无声删除无法隐藏。

---

## 第 3 步 — 从语法规则合成训练数据

有了分析器 + 词典 + 一包语法引用的模板，你可以制造数十万个经过验证的对。

> 🗣️ **告诉你的代理：***"使用我们的语言包用 `nmt-forge synth` 生成合成训练数据，然后给我看覆盖率报告。"*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **工具做什么 — 发出法则。** 到达输出的每一行必须满足任何包都无法选择退出的规则：

- **往返验证** — 每个生成的单词都通过*生成 → 分析 → 相同分析*，否则该行被丢弃。没有未验证的形式被发出。
- **语法引用** — 每个模板类型引用它转录的已发布语法。未引用的模板不存在；代码拒绝加载它们。
- **覆盖率检查** — 模板根据所需语法现象的检查清单进行计数（祈使句、疑问句、所有格、反向形式……）。如果*必需的*现象有零个例子，构建失败。这是防止"一百万个句子，都是相同的几个形状"陷阱的防护——隐藏结构漏洞的数量。
- **来源戳记** — 每个合成行都标记为 `synthetic: true`。该戳记是承重的：注册表将**拒绝**将合成行注册为测试集。测试是真实数据。

👀 **如何读取结果。** 查看覆盖率报告中的**零覆盖必需项**（你的模板从未生成的语法现象）和**类型分布** — 如果两个模板形状占主导地位，采样器的每类上限（默认 15%）将重新平衡它们，以便没有单个模式成为模型体验的一半。

:::tip[没有分析器？改用反向翻译]
如果你无法基于规则进行合成，但拥有目标语言的**单语**文本，可以让你的智能体使用**反向翻译（backtranslation）**泳道：它会利用你提供的反向模型将单语文本机器翻译*成*英语，并将每个翻译结果与**真实的**目标语言句子配对。目标语言端始终保持地道原汁原味。这是一个 Python 库调用（`nmt_forge.training.backtranslation.backtranslate`），而不是 CLI 子命令：你的智能体围绕它编写一个简短的脚本，并将打标后的输出文件添加到配置的 `data.synthetic` 泳道中。该调用会**首先对单语文本进行数据泄露审计**——因为这些文本暗中可能*正是*你的评估数据。参见[反向翻译指南](/docs/network/tutorials/back-translation)。
:::

---

## 第 4 步 — 安全地分割你的真实数据

现在，准备好你的**真实**句对，并留出一部分句子作为最终评判所有结果的基准。这正是低资源机器翻译中最具毁灭性的错误藏身之处，也是护栏机制展现价值的地方。

你的文件格式可以是 `.tsv`（源文本、制表符 TAB、然后是译文，每行一个句对；以 `# ` 开头的行为注释），也可以是 `.jsonl`（每行 `{"source": …, "target": …}`）。

**如果你已经有测试集**——经由教师核对、护士核对或属于私有数据——请将其保存在独立文件中，进行注册，针对其筛选语料库，并仅划分出训练集和开发集：

> 🗣️ **告诉你的智能体：** *“注册我们的测试集，针对测试集对语料库进行数据泄露审计，然后使用 `nmt-forge split` 将清理后的语料库切分为训练集和开发集，采用组不相交（group-disjoint）方式，并设定固定随机种子。”*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**如果你没有测试集**，可以在同一步骤中从语料库中切分出测试集：

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **工具的作用——切分护栏。** 它执行**组不相交切分**：凡是共享同一个源句*或*同一个目标句的句对都会被绑定到一个组中，每个完整的组会完全落入其中一侧。随后它会**验证重叠率为零**，如果存在任何重叠则拒绝继续执行：

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

这杜绝了 **“Feed him” / “Feed her” 泄露**：某本教材将这两个英语练习句映射到了同一个目标词（`asam`）；简单的随机切分会将其中一个副本放入训练集，将其孪生副本放入测试集，导致模型仅凭死记硬背就能“通过测试”。在一个真实项目中，54 条测试数据中有 17 条以此种方式泄露，得分高达 83，而纯净数据仅为 44——基于该数字得出的所有结论因而全部作废。`--register project` 会将开发集（以及切分出的测试集）记录为 `project-dev` / `project-test`——初学者配置中已经指向了这些名称——因此后续的每个命令都知道它们是*切勿用于训练的评估集*。当测试集已被注册时，`split` 还会立即针对该测试集筛选新生成的训练和开发文件。

🛠️ **以及数据泄露审计。** `leak-audit` 会针对每个已注册的评估集筛查数据行，并结合你自身语料库中的示例说明它会**丢弃**哪些内容——源文本与测试提示完全相同的数据行（即使其翻译不同）、目标文本与测试答案完全相同的数据行，以及目标文本与测试答案高度近似的数据行（包含答案、是答案的片段，或在忽略变音符号后重合度达到至少 90%）——以及它**特意保留**的内容：共享句子框架但替换了某个单词的*模板同胞句*（例如 *“I see the dog”* / *“I see the cat”*），以及提示词高度近似但答案不同的句子。在训练集中拥有模板同胞句的测试行会被列出，并且——因为初学者配置将 `eval.near_dupe_corpus` 设置为了你的训练文件——最终报告会对*没有*同胞句的测试行单独评分，记为“(strict)”得分，以便直观展现同胞句所带来的虚高乐观程度。当大多数测试行都存在同胞句且测试集固定时，`--clean-to <file> --drop-test-twins` 还会移除训练集中的这些孪生句子（它会报告处理前后的严格子集情况，并拒绝将训练集清空）。请为它指定一个独立文件（`corpus.notwins.jsonl`）：这就是无孪生句模型的语料库，与全量数据语料库并存，并且 leak-audit 会拒绝覆盖已被某个配置、某次运行或某一切分所读取的文件。其结果是确定性的，且绝不会打印测试文件本身的文本内容。

👀 **如何读取结果。** 你想看到**已验证：0 个共享**行。如果你得到 `SplitLeakageError`，不要手动删除行——那只是重新洗牌问题。重新运行组不相交分割；那是修复，错误消息会说明这一点。

:::danger[永远不要在基准上训练]
如果你从共享注册表中提取评估数据集（`nmt-forge registry add-harness`），工具会对其进行戳记并将其视为训练的禁区——**每个**注册表基准都被标记为*禁止训练*。微调你合法可以做的任何事情；只是永远不要在测试集上。这是[整个网络的唯一规则](/docs/network/leaderboard/rules)。
:::

---

## 第 5 步 — 训练

一个配置文件即可描述整套运行流程；一个命令即可可复现地执行它。`nmt-forge init` 已经生成了该文件。

> 🗣️ **告诉你的智能体：** *“读取 `config.json`，如果我们生成了合成泳道就添加进去，运行 `nmt-forge preflight run --config config.json` 并修复其标记的所有问题，然后运行 `nmt-forge run config.json` 并观察调度诊断信息。”*

初学者配置的摘录，包含默认的 `cpu-tiny` 模型并添加了合成泳道：

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**选择哪个模型？** 在运行 `init` 时进行选择（`--model`）；各项具体数值都会写入 `config.json`：

| 预设配置 | 说明 | 所需资源 | 客观预期 |
|---|---|---|---|
| `cpu-tiny`（默认） | 从零开始训练的小型 Transformer（约 600 万参数）；其词表仅从你的**训练**行中学习得到 | 笔记本 CPU，无需下载 | 较弱：在 1000–2000 个句对上，chrF++ 大致为 5–30（仅在高度模板化的数据上能达到上限）——学到的是你数据中的短语和模式，而非通用翻译 |
| `cpu-finetune --base <hf-id>` | 微调由你指定的小型预训练 Marian/opus-mt 模型——选择一个针对*相近*语言对的模型 | CPU，约 300 MB 下载量 | 当存在相近语言对时通常优于 `cpu-tiny`——请在开发集上实际衡量，不要凭空假设 |
| `nllb-600m` | 带有 LoRA 的 NLLB-200 distilled 600M | GPU，约 2.5 GB 下载量 | 最强起点；在 CPU 上运行，耗时检查会在数分钟内直接拒绝执行 |

`cpu-tiny` 的意义并不在于其得分高低。它让**整个**闭环得以成真——护栏隔离、审计、预注册测试、CLI 可调用的模型——以便后续更优的模型可以直接放入同一个项目中，并以相同的方式进行度量。

`preflight` 会列出本次运行将经过的每个关卡（✓ 或 ✗），并给出针对每个 ✗ 的修复方法——包括是否已安装训练扩展（`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`）。

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **工具做什么 — 一次四个防护栏。**

- **训练前的数据泄露审计。** *每个*泳道——黄金数据、合成数据以及任何反向翻译文本——都会针对*每个*已注册的测试集和封存集进行筛查。答案泄露（完全相同的提示或答案、高度近似的答案）以及整文件匹配均为致命错误；模板同胞句会被保留并报告（`--drop-test-twins` 会针对固定的测试集移除它们）。在混合数据清理干净之前，不会开始任何训练。
- **开发集隔离护栏。** **若未注册开发集，训练将拒绝启动**，且它只会基于该开发集来挑选检查点——绝不使用测试集。（它甚至会对开发集行与测试集进行内容核验，以捕获 `cp test.jsonl dev.jsonl` 这类把戏。）检查点选择可以使用开发集**损失**或开发集**生成指标**——对开发集进行解码并对真实输出进行评分，这是更客观诚实的信号（初学者配置在解码后的开发集输出上使用 chrF++）。
- **调度合理性校验。** 如果你的混合数据中包含大量合成数据，工具会根据混合数据的规模*推导*出一个停止训练的底线，并维持训练跨越**平台期**——即模型已完成对简单合成数据的学习、但尚未迁移至真实质量的阶段。这防止了“半轮猝死”现象，即天真的早停机制在计划进度的二十分之一处就过早退出。开发集的评估频率同样根据运行规模推导得出，以保证小型运行仍能得到评估。每一次干预都会用通俗易懂的语言打印开发集损失的变化轨迹及原因。
- **曝光计算与带标签的合成数据。** 黄金数据会被赋予更高权重（重复采样），以确保少量的真实数据不会被淹没；清单中会记录**每个独立句子的有效曝光量**，从而保证 A/B 测试的公平性。合成数据源带有标签；黄金数据保持无标签状态，从而锚定输出风格。

训练是唯一耗时较长的步骤。你的智能体应将其置于后台运行，并将输出重定向至日志文件，关注关键日志行（`refused`、`Error`、`wall-clock`、`RUN EXIT`），而不是轮询。一个带有损失曲线和停止按钮的实时面板会为你**本人**开启（在端口空闲时位于 `http://127.0.0.1:8377`）。在最初的几分钟内，forge 会测量训练速度并打印实际耗时预估，先是一个早期估计，随后是稳态估计。`init` 不会设置时间预算，因为预算应由你决定，而非由工具凭空臆造。请阅读耗时预估，确定你可以接受的时长，并在 `config.json` 的 `model` 下添加 `"time_budget_hours": <hours>`。此后，forge 会拒绝无法在该预算内完成的运行，从而让规格不当的运行能够快速失败。在你设置预算之前，仅应用 forge 的安全上限：它会终止可能需要数天的运行，并且每次预估都会将其打印为“no budget set; … ceiling”，而不是任何人主动选择的预算。

👀 **如何解读结果。** 运行完成后会打印一份**带有置信区间的开发集报告**——绝不会输出毫无置信区间的裸分数——随后给出下一个命令（以下数值仅供示意）：

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

如果你看到 `schedule-sanity` 消息解释它*保持*训练超过过早停止，那是平台防护栏在工作 — 很好。运行还写一个**清单**：配置哈希、数据文件哈希、种子和推导的计划，所以整个运行是可重现的。

---

## 第 6 步 — 诚实地评估

你有一个模型。在你在测试集上评分之前，你写下你期望的 — *首先*。

> 🗣️ **告诉你的智能体：** *“为测试集评分编写一份预注册记录——包括我们预测的指标、变化方向和幅度，并附带一行简短理由——然后导出运行结果，这将对测试集进行单次评分。”*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg` 指定了用于评判该模型的预注册记录。如果测试集上只有一份预注册记录，export 会自动找到它；如果存在第二个模型且在同一测试集上有其自己的预注册记录，export 会拒绝盲目猜测，因此需要分别显式指定。

（预注册可以在首次测试评分之前的任何时间进行——`nmt-forge status` 会在训练前提示需要预注册。）

🛠️ **工具做什么 — 反故事讲述防护栏。**

- **预注册。** 对已注册的**测试集**进行评分，必须在首次查看结果*之前*编写预注册记录。预测文件是一个 JSON 数组：每条预测都会指定一个指标和理由，再加上相对于基线的变化方向（由 `nmt-forge prereg check` 自动校验）或人工检查的自由文本预期。未编辑的模板、Markdown 和散文文本都会被拒绝，并提示正确的格式和修复方案。如果没有预注册记录，评分流程将直接**拒绝执行**：

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  这是为了防范将“马后炮”（“它在口述故事上当然有所提升”）伪装成事先预测。将那些*失败*的猜测记录下来，才能让那些成功的预测值得信赖。
- **始终包含置信区间。** 每个分数在渲染时都会附带其 95% Bootstrap 置信区间；绝不会有缺少置信区间的输出。区间发生重叠的 `+0.5` 提升不能算作胜利。
- **评估账本。** 每次对每个评估集的读取都会被记录下来（仅追加、防篡改）。可通过 `nmt-forge ledger show --set project-test` 查询某个数据集被“消耗”了多少。**封存**数据集为一次性使用——仅评分一次，随后即关闭（第二次调用 `export` 将被拒绝；`--no-eval` 会在不重新评分的情况下打包）。

`export` 会使用在开发集上选出的检查点对测试集进行解码、评分，并附上通俗易懂的 **Diagnosis & Recommendations** 章节。它还会将结果写入为 **mt-eval 报告**（`export/evaluation/`），这样 `mt-eval compare` 就可以将你的模型与在同一测试集上使用评估框架测量的任何其他方法进行横向对比，并将模型本身（第 8 步）打包在 `export/model/` 中（该目录不含任何测试句）。`export/evaluation/` 包含了你的测试句子：切勿将其与模型一起复制，应将其与测试集保存在一起。当你不需要打包时，`nmt-forge evaluate <run-manifest>` 则是仅进行评分的一半流程。

👀 **如何解读结果。** 查看数值时**需结合其置信区间并按语域细分查看**，如果你的训练数据与测试集共享句子模板，请查看“(strict)”得分，并在庆祝之前核对**应该信任哪个指标**。要在相同的已注册数据集上使用更多指标对另一个系统的输出文件进行评分：

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` 显示了**每个指标对你的语言族的测量可靠性**（来自 WMT 元评估）。对于某些族，像 BLEU 这样的指标几乎不追踪人类判断，而 COMET 追踪；对于许多低资源族，诚实的答案是*未测量* — 在这种情况下，母语使用者的判断，而不是任何自动数字，是真实的信号。参见[指标可靠性](/docs/network/specifications/metric-reliability)。

:::tip[你的语言自己的裁判]
如果你的语言有 LYSS 评估标准（一个 linter，知道，比如说，两个拼写仅因记录的长元音约定而不同），用 `--plugin` 插入它，它与 chrF++ 一起评分 — 甚至可以*选择*检查点，所以赢的模型是语言自己的裁判更喜欢的。每个插件数字也得到一个置信区间。
:::

---

## 第 7 步 — 迭代

现在你改进 — 每个改进都以相同的诚实方式测量。

> 🗣️ **告诉你的智能体：** *“改动一处内容——添加一种模板类型 / 增加反向翻译数据 / 更换不同的模型预设——重新训练，并在开发集上与上一次运行进行 A/B 测试，并附带显著性检验。”*

每次运行都会打印附带置信区间的开发集分数。对于配对检验，使用每次运行对开发集进行解码——`nmt-forge evaluate <run-manifest>
--config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` 是你配置的一个副本，其 `eval.battery` 为 `project-dev`——然后：

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **工具做什么。** `compare` 运行一个**配对显著性测试**，而不仅仅是减法，所以"B 击败 A"是统计数据支持的声明 — 不是噪声。在**开发**集上迭代（那是它的用途）；为不频繁的、预注册的检查保留**测试**集；为最后保留任何**密封**集。

👀 **如何读取结果。** 真正的改进清除其置信区间*和*显著性测试。如果它没有，你仍然学到了一些东西 — 那个杠杆比你希望的要弱，这值得知道。平台/覆盖率/泄漏防护栏意味着你比较的数字是值得信赖的，所以你可以真正相信你自己的迭代循环。

常见的下一个杠杆，大致按对数据匮乏语言的回报顺序：

1. **更多真实句对**——在几千个句子的规模下，每增加一个真实句对，其作用都超过调整任何配置参数。
2. **更高的数据合成覆盖度**——补充覆盖度报告中标记缺失的语法现象。
3. **反向翻译**——将目标语言的单语文本转化为更多的训练句对。
4. **更强的起点**——采用针对相关语言对的基础模型的 `cpu-finetune`，或者在 GPU 上使用 `nllb-600m`——在同一个开发集上与 `cpu-tiny` 进行对比度量。
5. **课程学习**——先在合成数据上预训练，然后在真实句对上微调。

---

## 第 8 步 — 投入实际使用，并提交至 Network

一个秉持严谨客观态度训练出来的模型，是你今天就可以实际使用的成果，这也正是 [Champollion Network](/docs/network/) 旨在接纳的目标。

**自己使用它。** `export` 已经对模型进行了打包：一个自包含的模型目录、`forge-model.json`（模型介绍以及测量方式）、一个 champollion 插件清单（`method.json`），以及包含具体命令的 `DEPLOY.md`。

> 🗣️ **告诉你的智能体：** *“启动导出模型的服务，并使用 champollion CLI 用它来翻译我们应用的字符串。”*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` 支持 champollion **api method** 协议（`POST /translate`）和**兼容 OpenAI 的** `/v1/chat/completions`——后者正是 `--method local` 所使用的；`DEPLOY.md` 中包含针对前者的 `champollion.config.json` 代码片段。它仅在 `127.0.0.1` 上监听；将其暴露在网络中需要令牌（`--token` 或 `NMT_FORGE_SERVE_TOKEN`）。NMT 模型只负责翻译文本并会忽略指令，因此 CLI 发送给 LLM 方法的语气提示、指导文件和术语表对其无效——而且其输出在呈现给读者之前需要母语流利者的审核。

**提交至 Network。**

> 🗣️ **告诉你的代理：***"将此模型打包为一个方法并将其提交到我们的语言对的排行榜。"*

- **[提交方法](/docs/network/getting-started/submit-a-method)**将你的模型转换为网络条目，在公共参考语料库上评分并归属于你。
- 因为你的评估是干净的 — 组不相交、开发围栏、泄漏审计、CI'd、预注册 — 你的提交经得起摧毁大多数低资源 MT 声明的审查。反游戏架构（秘密社区拥有的测试集、可重现性检查、母语使用者验证）不是这样构建的模型的障碍；这是信誉的戳记。
- 如果你的语言有**奖项**开放，一个诚实构建的站立、优于基线的方法正是赞助池奖励的。当一个方法对土著语言有效时，**所有权可以转移到社区** — 你在这里构建它，他们部署它，按照他们的条款。参见[奖项规范](/docs/network/specifications/prizes)和[所有权转移](/docs/network/sovereignty/ownership-transfer)。

---

## 整个弧线，一口气

1. **发现**该语言拥有的资源（`discover`、`init`）——缺失代表未知，而非不存在。
2. **指向**分析器和词典（若存在，阶梯 3–4），并遵守其许可协议。
3. **合成**经过验证、注明出处且通过覆盖度检查的训练数据（`synth`）——或者对单语文本进行**反向翻译**。
4. **切分**真实数据（采用组不相交方式），针对测试集进行筛查，并注册评估集（`registry add`、`leak-audit`、`split`）。
5. **训练**单个配置——默认在 CPU 上——具备开发集隔离、泄露审计和平台期感知机制（`preflight`、`run`）。
6. **评估**先写好预测、始终附带置信区间、选用正确指标（`prereg`、`export`）。
7. **迭代**通过带显著性检验的 A/B 测试（`compare`）。
8. **使用**通过 CLI 调用该模型（`serve`）并将其**提交**至 Network——在这里，求真务实才是核心所在。

你从不必记住低资源 MT 结果出错的十种方式。工具使诚实的路径成为默认值，并用解释拒绝了捷径。这就是整个想法：**防护栏捕捉业余错误，所以你可以专注于语言。**

## 继续

- [**MT 训练简明语言**](/docs/network/context/mt-training-concepts) — 这里的每个术语，用例子定义。
- [**诚实地训练模型**](/docs/network/getting-started/training-honestly) — 一页上的十个防护栏，每个都有其测量的背景故事。
- [**微调模型**](/docs/network/tutorials/fine-tuned-model)和[**反向翻译**](/docs/network/tutorials/back-translation) — 关于特定技术的更深入食谱。
- [**语料库创建**](/docs/network/tutorials/corpus-creation) — 构建一切其他内容所基于的真实数据。
