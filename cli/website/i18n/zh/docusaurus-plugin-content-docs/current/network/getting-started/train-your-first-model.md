---
sidebar_position: 3
title: "训练你的第一个模型（使用你的 agent）"
description: "分步指南：通过指导编码 agent 来训练低资源机器翻译模型——你的指令、forge 的操作、拒绝的表现形式，以及如何解读诊断结果。"
related:
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# 训练你的第一个模型（与你的代理一起）

你不需要知道如何训练神经机器翻译模型。你需要能够**告诉编码代理你想要什么** — Claude，或 Sonnet/Flash 级别的模型，或任何能运行 shell 命令的代理。**nmt-forge** 的构建方式使代理能够*机械地*驱动它：在每一步，工具都会准确告诉代理接下来该做什么，当某一步会破坏你的结果时，它会大声拒绝并提供修复方案。

这个页面是完整的循环。每一步都写成了**你告诉代理什么**、**forge 做什么**、**拒绝看起来像什么**（这样当拒绝发生时你们都不会惊慌 — 拒绝是工具在工作），以及最后**如何阅读报告**。

:::tip 给你的代理的唯一规则
告诉它：*"总是先运行 `nmt-forge status --json`，然后在每一步之后运行。做它的 `next_command` 说的任何事。"* 这个单一的习惯会把 forge 变成一条引导轨道。如果你的代理通过 MCP 连接，同样的循环就是 `forge_status` 工具 — 见 [Agent Guide](/docs/network/getting-started/agent-guide)。
:::

---

## 第 0 步 — 将你的代理指向你的语言

**你说：** *"我想训练一个英语→[你的语言]模型。首先发现 forge 对它了解什么。ISO 639-3 代码是 `crk`"*（使用你的语言代码）。

**forge 做：** `nmt-forge discover crk` 读取语言的卡片 — 文字系统、词典、形态分析器、现有语料库和评估集（带有任何 `do_not_train` / 隔离标志），以及每种语言的裁判指标。它将你的语言放在**资产阶梯**上：(1) 平行文本 → 受保护的训练；(2) + 单语 → 标记的回译；(3) + 词典/语法 → 引用的合成数据；(4) + 分析器 → 往返验证的合成；(5) + 裁判指标 → 语言在评分和检查点选择中的自有指标。

**空白字段表示未知，永远不是零。** 稀疏的卡片不是"这种语言没有任何东西" — 它可能只是还没有记录该资源。你总是可以带上你自己的平行语料库。

然后：*"搭建项目。"* → `nmt-forge init crk` 写入一个工作区、一个启动配置和一个 `NEXT_STEPS` 简介。

---

## 第 1 步 — 雕刻一个无法作弊的分割

**你说：** *"这是我的平行语料库 `corpus.jsonl`。将其分割为训练/开发/测试并注册开发和测试集。"*

**forge 做：** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7 --out data/splits --register mypair`。它进行**组不相交**分割：任何两个共享源*或*目标的句子对都落在**同一**侧。这是低资源分数被夸大的最常见的单一方式 — 一本教科书将许多英文练习映射到一个目标词，一个天真的随机分割将一个副本放在训练中，其孪生放在测试中，模型"翻译"它记忆的答案。

**拒绝看起来像什么：** 如果你给 forge 一个你自己制作的分割，而它不是不相交的，`verify-split` 会崩溃并列出共享的键 — *"这些行在训练和测试中共享一个规范目标。"* 修复：让 forge 做分割。

---

## 第 2 步 — 筛选泄漏

**你说：** *"在我们训练之前，检查训练语料库是否对评估集有泄漏。"*

**forge 做：** `nmt-forge leak-audit corpus.jsonl`。它针对每个已注册的开发/测试/密封集筛选你的语料库：

- **目标端精确或近似重复**（参考答案在你的训练数据中）→ **致命**。这是答案泄漏。
- **源端近似重复但有*不同*的答案** → **信息性，保留**。相同的提示、不同的翻译是合法的最小对比对，不是泄漏 — forge 报告它但从不删除它。（这个区别是我们通过自我测试发现的真实错误：早期版本标记了 44 行为致命，但只有 17 行是真正的泄漏。）

**拒绝看起来像什么：** *"第 118 行：测试集 `mypair-test` 的目标端近似重复（Jaccard 0.83）— 答案泄漏。"* 修复：你的代理运行 `nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` 并在幸存者上训练。

---

## 第 3 步 — 预测然后再看

**你说：** *"写下我们期望模型做什么，然后我们将训练。"*

**forge 做：** `nmt-forge prereg new p1 --eval-set mypair-test --predictions predictions.md`。你（或你的代理，大声说出来）提交可证伪的预测 — 哪个指标、哪个方向、多大 — **在**任何测试分数存在之前。

**拒绝看起来像什么：** 如果你的代理尝试在没有预注册的情况下对测试集评分，`score` 拒绝：*"在没有早于第一次评分读取的预注册的情况下拒绝对测试集评分。"* 这就是将结果与结果优先叙述区分开来的东西。修复：先预注册。

:::info 为什么这感觉像额外的工作
这就是工作。这里的每个守卫都是一个欺骗过真实研究人员的错误。该工具使诚实的路径成为简单的路径，不诚实的路径成为阻止你的路径。
:::

---

## 第 4 步 — 检查门，然后训练

**你说：** *"训练运行会通过所有检查吗？如果是，就训练。"*

**forge 做：** `nmt-forge preflight run` 列出运行将遇到的每个门 — 开发围栏存在、泄漏审计清洁、计划下限派生、解码余量检查 — 每个都有 ✓ 或 ✗ 和修复。当全部变绿时：`nmt-forge run config.json`。

训练是**不是**即时工具调用的唯一步骤 — 它使用 GPU 并需要数分钟到数小时。你的代理在终端中运行它并监视 `[schedule-sanity]` 行。forge 从你的数据混合中派生早期停止**下限**，所以合成数据较多的运行不会在真实开发损失摇晃时在半个 epoch 处死亡（一个真实的失败模式 — 见 [Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training)）。

当它完成时，forge 已经**在围栏开发集上选择了一个检查点**（从不在测试集上）并写入了 `run-manifest.json`。

---

## 第 5 步 — 关闭循环：评估和诊断

**你说：** *"对测试电池上的模型评分，并告诉我要改进什么。"*

**forge 做：** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config config.json`。这在一个命令中**关闭循环**：它用运行选择的检查点解码测试电池，对其评分（预注册门控，每个数字都有 95% 置信区间），并附加一个纯语言的**诊断与建议**部分。（在这个命令存在之前，你必须符号链接检查点并手动运行解码器 — 正是新手迷失的地方。）

### 如何阅读 battery-lint 报告

报告是按**寄存器**（教科书、政府、口头故事等）的分数表，每个都有其置信区间，后面是诊断。诊断命名你的**最弱寄存器**，对于每个，最可能的原因和**下一步要拉的杠杆**：

| 如果诊断说… | 这意味着… | 杠杆 |
|---|---|---|
| `R1-vocabulary-gap` | 寄存器分数低**且**输出未完成；模型缺少单词 | **词汇** — 增长词汇表，然后重新检查漏斗 |
| `R2-structure-gap` | 单词是已知的但句子*形状*不是 | **结构** — 添加缺失的构造（模板/合成器） |
| `R3-mixed-convention` | 输出混合拼写 | **正字法** — 将语料库规范化为一个约定，重新训练 |
| `R4-optimism-bound` | "完整"分数因近似孪生评估行而膨胀 | **测量** — 引用严格分数以实现泛化 |
| `R5-low-power` | 置信区间很宽 | **测量** — 不要对小于 CI 的增量采取行动；增加评估集 |
| `R7-transfer-plateau` | 在合成上很好，在真实文本上停滞 | **真实数据** — 回译单语数据或获取真实平行句子 |

每个发现都带有它触发的证据。对于 `--json` 发现，你的代理可以以编程方式采取行动：`nmt-forge lint <battery-manifest.json>`。

---

## 你刚才做了什么

你训练了一个分数你可以真正相信的模型：没有泄漏的答案、一个在不查看测试集的情况下选择的检查点、每个数字上的误差条、在结果之前写的预测，以及一个命名下一个杠杆而不是让你猜测的诊断。这就是全部要点 — **诚实的结果是默认的，获得它不需要 MT 专业知识。**

当数字令人失望时（它们会的，第一次），去 [Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training) — 它是症状优先的，为正好那个时刻而写。
