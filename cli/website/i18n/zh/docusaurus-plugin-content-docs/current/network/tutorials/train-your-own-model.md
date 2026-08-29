---
sidebar_position: 0
title: "想要训练自己的模型？"
description: "一份以智能体为中心的端到端演练，指导你使用 nmt-forge 训练低资源翻译模型——你指挥编码智能体，护栏会自动捕捉初学者的常见错误。"
related:
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

这是一份完整的低资源语言机器翻译模型训练指南——从"我会说这种语言，但几乎没有数据"到一个你可以诚实地报告并提交到[网络](/docs/network/)的模型。本指南面向初学者，并假设你采用现代工作方式：**你指挥一个编码代理**（Claude Code、OpenAI Codex、Cursor、OpenCode、Google Antigravity 或类似工具），由代理运行这些工具。

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

- **一个编码代理**，具有终端和文件系统访问权限。这是驱动程序。
- **一些真实翻译的句子**用于你的语言对——即使只有几百个人工翻译对也是一个可行的开始。双语教科书、社区档案、翻译的公共记录、教育材料。质量优于数量。
- **可选但强大的：**目标语言的单语文本、双语词典、已发布的参考语法和形态分析器（FST）。你**不**需要所有这些来开始——工具会准确告诉你哪些存在以及哪些解锁了哪些功能。
- **计算资源：**防护栏、分割、合成、审计和评分在笔记本电脑上运行。只有实际的模型训练步骤需要 GPU（带 LoRA 的小模型可以在适度的硬件上运行）。

> 🗣️ **告诉你的代理：***"从 Champollion monorepo 的 `forge/` 包安装 nmt-forge，并确认 `nmt-forge` 命令可以运行。我们将诚实地训练一个英语 → <your language\> 翻译模型。"*

你的代理可以调用 Champollion MCP 服务器的 `get_training_guardrails` 工具，将完整的规则手册——十个防护栏和每个防护栏阻止的错误——加载到它自己的上下文中，然后再编写任何命令。如果你在驱动代理，请先要求它这样做。

---

## 第 1 步 — 选择一种语言并查看实际存在的内容

每个项目都从询问索引该语言*有什么*开始，诚实地。

> 🗣️ **告诉你的代理：***"为我的目标语言的 ISO 639-3 代码运行 `nmt-forge discover`，并总结存在的数据和缺失的数据。"*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **工具做什么。** 它读取语言的 Champollion **卡片** — 关于该语言已知内容的单一真实来源 — 并报告它记录的脚本、形态分析器、词典、语料库和评估数据集，然后将语言放在**资产阶梯**上：

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **如何读取结果。** `✓` 标记是你现在可以做的；`?` 标记是等待资产的阶梯。至关重要的是，**卡片上的缺失意味着*未知*，永远不是"这种语言什么都没有"。** 稀疏的卡片是邀请你添加你知道的内容，而不是死胡同——即使是空白卡片也能让你获得第 1 阶梯上的完整受保护训练循环。丰富的卡片（如平原克里语）会自动连接上层阶梯：其评估集被标记为**永远不要在此训练**，其特定语言的裁判已准备好插入。

然后搭建一个项目：

> 🗣️ **告诉你的代理：***"用 `nmt-forge init` 为这个语言对搭建一个项目，并读给我听它生成的 `NEXT_STEPS.md`。"*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ 这创建了一个工作区（一个 `.forge/` 目录，每个防护栏都会查询）、一个**启动配置**和一份 `NEXT_STEPS.md` 简报——为*你和你的代理*编写的——命令顺序、你的语言的资产阶梯和不可协商的要求。这是下面所有内容的地图。

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
如果你无法从规则合成但你有**单语**目标语言文本，要求你的代理运行**反向翻译**通道：`nmt-forge backtranslate` 将你的单语文本机器翻译*成*英语，并将每个结果与**真实**目标句子配对。目标端保持真实。工具**首先对单语文本进行泄漏审计** — 因为该文本可能秘密地*是*你的评估数据。参见[反向翻译食谱](/docs/network/tutorials/back-translation)。
:::

---

## 第 4 步 — 安全地分割你的真实数据

现在取你的**真实**对并将它们分成训练/开发/测试。这是低资源 MT 中最具破坏性的错误隐藏的地方，也是防护栏发挥作用的地方。

> 🗣️ **告诉你的代理：***"用 `nmt-forge split` 将真实语料库分割成测试和开发集，组不相交，并注册它们。使用固定种子使其可重现。"*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **工具做什么 — 分割防护栏。** 它执行**组不相交分割**：每个共享源*或*目标的对被绑定到一个组中，每个整个组完全落在一侧。然后它**验证零重叠**并在存在任何重叠时拒绝继续。

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

这杀死了**"喂他"/"喂她"泄漏**：一本教科书将两个英语练习映射到一个目标词（`asam`）；天真的随机分割将一个副本放在训练中，其孪生放在测试中，所以模型通过记忆"通过"。在一个真实项目中，54 个测试行中的 17 个以这种方式泄漏，得分为 83 对 44 对干净行——每个基于该数字的发现都是无效的。`--register textbook` 在工作区中记录开发和测试集（作为 `textbook-dev` 和 `textbook-test`），以便每个后续命令都知道它们是*你必须永远不要训练的评估集*。

👀 **如何读取结果。** 你想看到**已验证：0 个共享**行。如果你得到 `SplitLeakageError`，不要手动删除行——那只是重新洗牌问题。重新运行组不相交分割；那是修复，错误消息会说明这一点。

:::danger[永远不要在基准上训练]
如果你从共享注册表中提取评估数据集（`nmt-forge registry add-harness`），工具会对其进行戳记并将其视为训练的禁区——**每个**注册表基准都被标记为*禁止训练*。微调你合法可以做的任何事情；只是永远不要在测试集上。这是[整个网络的唯一规则](/docs/network/leaderboard/rules)。
:::

---

## 第 5 步 — 训练

一个配置文件描述整个运行；一个命令可重现地执行它。

> 🗣️ **告诉你的代理：***"填写训练配置 — 将 `dev` 指向我们注册的开发集，列出黄金和合成数据通道，选择一个带 LoRA 的小基础模型 — 然后运行 `nmt-forge run` 并观察计划诊断。"*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **工具做什么 — 一次四个防护栏。**

- **训练前泄漏审计。** *每个*通道 — 黄金、合成和任何反向翻译文本 — 都针对*每个*注册的评估集进行筛选。精确匹配、近似重复（改写）匹配和测试集上的整个文件匹配是致命的。在混合干净之前，没有任何东西训练。
- **开发围栏。** 训练**拒绝在没有注册开发集的情况下启动**，它只会在该开发集上选择检查点 — 永远不是测试集。（它甚至对开发行进行内容检查，以防止 `cp test.jsonl dev.jsonl` 技巧。）检查点选择可以使用开发**损失**或开发**生成指标** — 解码开发集并评分真实输出，更诚实的信号。
- **计划理智。** 如果你的混合是合成重的，工具*推导*一个停止下限，从你的混合大小，并通过**平台** — 模型完成简单合成学习并尚未转移到真实质量的阶段 — 保持训练。这防止了"半时代死亡"，其中天真的早期停止在计划的二十分之一处退出。每个干预都打印开发损失轨迹和原因，用简洁的语言。
- **暴露数学 + 标记合成。** 黄金数据被加权（重复），以便少量真实数据不会被淹没；清单写下**每个唯一句子的有效暴露**，以便 A/B 保持公平。合成源携带标签；黄金保持未标记，以便它锚定输出风格。

👀 **如何读取结果。** 运行打印一个**带置信区间的开发报告** — 没有裸分数输出：

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

如果你看到 `schedule-sanity` 消息解释它*保持*训练超过过早停止，那是平台防护栏在工作 — 很好。运行还写一个**清单**：配置哈希、数据文件哈希、种子和推导的计划，所以整个运行是可重现的。

---

## 第 6 步 — 诚实地评估

你有一个模型。在你在测试集上评分之前，你写下你期望的 — *首先*。

> 🗣️ **告诉你的代理：***"为测试集评分写一个预注册 — 我们预测的指标、方向和边距 — 然后解码测试集并评分。"*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **工具做什么 — 反故事讲述防护栏。**

- **预注册。** 对注册的**测试**集评分需要在第一次查看*之前*编写的预注册。没有它，比较表简单地**拒绝渲染**：

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  这是防止将事后预测（"当然它在口头故事上改进了"）打扮成预测的防护栏。写下*失败*的猜测是使成功的猜测值得信赖的原因。
- **置信区间，总是。** 每个分数都用其 95% 引导 CI 渲染；没有无 CI 输出。一个 `+0.5` 凸起，其区间重叠，不是胜利。
- **评估账本。** 每次读取每个评估集都被记录（仅追加、防篡改）。询问 `nmt-forge ledger show --set textbook-test` 一个集合"花费"了多少。**密封**集合是一次性的 — 评分一次，然后关闭。

👀 **如何读取结果。** 用其区间和每个注册表读取数字，并在庆祝之前检查**相信哪个指标**：

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` 显示了**每个指标对你的语言族的测量可靠性**（来自 WMT 元评估）。对于某些族，像 BLEU 这样的指标几乎不追踪人类判断，而 COMET 追踪；对于许多低资源族，诚实的答案是*未测量* — 在这种情况下，母语使用者的判断，而不是任何自动数字，是真实的信号。参见[指标可靠性](/docs/network/specifications/metric-reliability)。

:::tip[你的语言自己的裁判]
如果你的语言有 LYSS 评估标准（一个 linter，知道，比如说，两个拼写仅因记录的长元音约定而不同），用 `--plugin` 插入它，它与 chrF++ 一起评分 — 甚至可以*选择*检查点，所以赢的模型是语言自己的裁判更喜欢的。每个插件数字也得到一个置信区间。
:::

---

## 第 7 步 — 迭代

现在你改进 — 每个改进都以相同的诚实方式测量。

> 🗣️ **告诉你的代理：***"改变一件事 — 添加一个模板类型/更多反向翻译数据/不同的基础模型 — 重新训练，并在开发集上用显著性对其进行 A/B 测试，与之前的运行相比。"*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
```

🛠️ **工具做什么。** `compare` 运行一个**配对显著性测试**，而不仅仅是减法，所以"B 击败 A"是统计数据支持的声明 — 不是噪声。在**开发**集上迭代（那是它的用途）；为不频繁的、预注册的检查保留**测试**集；为最后保留任何**密封**集。

👀 **如何读取结果。** 真正的改进清除其置信区间*和*显著性测试。如果它没有，你仍然学到了一些东西 — 那个杠杆比你希望的要弱，这值得知道。平台/覆盖率/泄漏防护栏意味着你比较的数字是值得信赖的，所以你可以真正相信你自己的迭代循环。

常见的下一个杠杆，大致按对数据匮乏语言的回报顺序：

1. **合成中的更多覆盖率** — 添加覆盖率报告标记的缺失语法现象。
2. **反向翻译** — 将单语目标文本转换为更多训练对。
3. **更大或更适合的基础模型**，或 LoRA 秩/超参数调整。
4. **课程** — 在合成上预训练，然后在真实对上微调。

---

## 第 8 步 — 将其带到网络

一个诚实训练的模型正是[Champollion 网络](/docs/network/)为接收而构建的。

> 🗣️ **告诉你的代理：***"将此模型打包为一个方法并将其提交到我们的语言对的排行榜。"*

- **[提交方法](/docs/network/getting-started/submit-a-method)**将你的模型转换为网络条目，在公共参考语料库上评分并归属于你。
- 因为你的评估是干净的 — 组不相交、开发围栏、泄漏审计、CI'd、预注册 — 你的提交经得起摧毁大多数低资源 MT 声明的审查。反游戏架构（秘密社区拥有的测试集、可重现性检查、母语使用者验证）不是这样构建的模型的障碍；这是信誉的戳记。
- 如果你的语言有**奖项**开放，一个诚实构建的站立、优于基线的方法正是赞助池奖励的。当一个方法对土著语言有效时，**所有权可以转移到社区** — 你在这里构建它，他们部署它，按照他们的条款。参见[奖项规范](/docs/network/specifications/prizes)和[所有权转移](/docs/network/sovereignty/ownership-transfer)。

---

## 整个弧线，一口气

1. **发现**语言有什么（`discover`、`init`）— 缺失是未知，不是零。
2. **指向**分析器 + 词典（如果存在）（第 3-4 阶），尊重它们的许可证。
3. **合成**经过验证、引用、覆盖率检查的训练数据（`synth`）— 或**反向翻译**单语文本。
4. **分割**真实数据组不相交并注册评估集（`split`）。
5. **训练**一个配置，开发围栏、泄漏审计、平台感知（`run`）。
6. **评估**首先写下预测，总是 CI，正确的指标（`prereg`、`score`）。
7. **迭代**带显著性测试的 A/B（`compare`）。
8. **提交**到网络 — 诚实的工作是重点。

你从不必记住低资源 MT 结果出错的十种方式。工具使诚实的路径成为默认值，并用解释拒绝了捷径。这就是整个想法：**防护栏捕捉业余错误，所以你可以专注于语言。**

## 继续

- [**MT 训练简明语言**](/docs/network/context/mt-training-concepts) — 这里的每个术语，用例子定义。
- [**诚实地训练模型**](/docs/network/getting-started/training-honestly) — 一页上的十个防护栏，每个都有其测量的背景故事。
- [**微调模型**](/docs/network/tutorials/fine-tuned-model)和[**反向翻译**](/docs/network/tutorials/back-translation) — 关于特定技术的更深入食谱。
- [**语料库创建**](/docs/network/tutorials/corpus-creation) — 构建一切其他内容所基于的真实数据。
