---
sidebar_position: 3
title: "训练你的第一个模型（使用你的 agent）"
description: "通过指挥编程 Agent 训练低资源 MT 模型的分步指南——涵盖安装、保护测试集、在笔记本电脑 CPU 上训练、单次评分，以及向 champollion CLI 提供模型服务。详细说明你说什么、forge 做什么，以及拒绝响应是什么样。"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
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

本页介绍了从 `pip install` 到生成 champollion CLI
可调用的模型的整个闭环流程。每一步都按照**您对 Agent 说什么**、**forge
做什么**、**拒绝时呈现的形式**（以便触发拒绝时双方都不会惊慌 ——
被拒绝说明工具在正常运作），以及最后的**如何解读报告**来编写。这属于
[为您的语言构建机器翻译](/docs/build-mt-for-your-language)中步骤 2 和步骤 4 的 forge 部分，
该指南涵盖了前期准备（寻找现有资源）、中期评估（衡量现有选项）和后期工作（发布、组合各种方法）。

**执行顺序至关重要。**在**对测试集进行任何评分之前**，必须先注册您的测试集、对照测试集筛查训练数据，
并写下您的预测（步骤 1–3）——
包括指南步骤 3 中使用 `mt-eval run` 衡量的基线。基线测试属于评分性质的读取：forge 会对此进行计数，
并拒绝在评分之后写入的预测。完成之后再进行切分和训练（步骤 4）。

:::tip 给 Agent 的唯一准则
告诉它：*“始终先运行 `nmt-forge status --json`，并且每一步之后都要运行。
严格按照其 `next_command` 的指示操作。”* 这个习惯能让 forge
变成一条受引导的轨道。每个 forge 命令都接受 `--json`：在 stdout 上只输出一个 JSON 文档，
若被拒绝则返回 `{"error": {…, "why", "fix"}}`，退出代码为 2。如果您的 Agent 通过 MCP 连接，
同样的循环即为 `forge_status` 工具（`{ "project_dir": "<dir>" }`）—— 参见 [Agent 指南](/docs/network/getting-started/agent-guide)。
:::

---

## 步骤 0 —— 安装并让 Agent 对准您的语言

**您说：**“安装带有训练额外依赖（extra）的 nmt-forge。我想训练一个
英语→[您的语言] 模型。首先探索一下 forge 对该语言的了解情况。
ISO 639-3 代码是 `crk`”（请使用您语言的代码）。

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

`[hf]` extra 会添加训练库（torch、transformers、accelerate、
tokenizers、sentencepiece、peft）。对于默认模型，仅限 CPU 的 wheel 包就已经足够。
普通的 `python3 -m pip install nmt-forge` 可以在不进行训练的情况下为您提供防线守卫（guards）、切分、审计和评分功能。

**forge 所做的工作：**`nmt-forge discover crk` 会读取该语言的卡片（card）—— 书写系统、
词典、形态分析器、现有语料库和评估集（包括任何 `do_not_train` / 隔离标记），以及各语言的专属裁判指标。您不需要
Champollion 仓库的本地副本：卡片可以在您指定的目录（`--cards-dir`）、本地检出或 `node_modules/champollion`，
或是公共卡片索引（已缓存，因此后续可离线工作）中找到。随后 forge 会将您的语言置于**资产阶梯**上：
(1) 平行文本 → 受防线保护的训练；(2) + 单语数据 → 带有标记的回译；(3) + 词典/语法 → 带引用的合成数据；
(4) + 分析器 → 经往返验证的合成；(5) + 裁判指标 → 在评分和检查点选择中采用该语言专属的指标。

**空白字段表示未知，永远不是零。** 稀疏的卡片不是"这种语言没有任何东西" — 它可能只是还没有记录该资源。你总是可以带上你自己的平行语料库。

然后说：*“搭建项目脚手架。”*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

这会写入一个工作区（`.forge/`）、一个初始 `config.json`，以及一份带有确切命令顺序的
`NEXT_STEPS.md` 简报。**后续所有命令都必须在项目目录内部运行** —— 配置中的路径都是相对于该目录的。

除非您选择了其他预设，否则初始配置将使用 **`cpu-tiny`** 模型预设：

| `--model` | 说明 | 所需环境 | 预期效果 |
|---|---|---|---|
| `cpu-tiny`（默认） | 一个小型 Transformer（约 600 万参数），完全基于您的句对从零开始训练；其词表仅从您的训练行中学习 | CPU，无需下载 | 较弱：在 1–2 千个句对上，chrF++ 大致为 5–30（仅在高度模板化的数据上达到上限）。它学习的是您数据中的短语和模式，而不是通用的语言知识 |
| `cpu-finetune --base <hf-id>` | 微调您指定的小型预训练 Marian/opus-mt 模型（请选择一个*相关*语言对的模型） | CPU，约 300 MB 下载 | 当存在相关语言对时，通常优于 `cpu-tiny` —— 请在验证集上实际衡量，不要想当然 |
| `nllb-600m` | 带有 LoRA 的 NLLB-200 distilled 600M | GPU，约 2.5 GB 下载 | 最强起点；forge 的运行时间检查会在几分钟内拒绝在 CPU 上运行它 |

该预设在 `config.json` → `model` 中写为显式数值，因此
没有任何隐藏内容，修改数值会生成单独计算哈希的新运行。

**没有适用于您语言的卡片？**`nmt-forge init <code> --no-card --name "<name>"`
仍然会搭建项目脚手架；卡片本应说明的所有内容都会记录为未知，不会凭空捏造任何信息。

---

## 步骤 1 —— 留出测试集并注册 {#step-1--set-your-test-set-aside-then-split}

**您说：**“这是我的平行语料库，另外还有经过教师审核的测试集。
请确保测试集不参与训练，并在对其进行任何评分之前先完成注册。”

文件可以是 `.tsv`（源文本、制表符 TAB、译文，每行一对；
以 `# ` 开头的行是注释）或 `.jsonl`（每行一个 `{"source": …, "target": …}`）。
如果测试集是私有的，请在任何对象（包括您的 Agent）读取它**之前**将其标记为仅限本地：
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`。
这样 forge 就绝不会输出其中的句子。

**forge 所做的工作 —— 如果您有自己的测试集**（学校或诊所的常见情况）：

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

注册会启动该文件的**读取日志**（`<file>.reads.jsonl`）：从现在开始，
每次对该文件的评分 —— 无论是通过 forge 还是通过 `mt-eval run` / `mt-eval compare`
—— 都会被计数。这就是必须先进行注册的原因：在注册之前进行的基准测试运行会在注册时列出，但不会被计数。

**如果您没有单独的测试集**，可以从语料库中切分出一个 ——
一步执行 `nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split --register project` registers `project-test` and `project-dev`
（步骤 4 会详细说明切分流程）—— 然后直接进入步骤 3。

`nmt-forge status` 现在会提示下一步：在进行任何基准测试之前，记录预测（步骤 3）—— 请先筛查您的语料库（步骤 2）。

---

## 第 2 步 — 筛选泄漏

**您说：**“在训练之前，对照测试集检查语料库，告诉我您会剔除哪些内容以及原因。”

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forge 所做的工作：**它会针对每个已注册的 dev/test/sealed 集合筛查每一行数据。
相同的语料库和相同的注册集合始终会得到相同的结果。它会说明要**剔除**哪些内容：

- **完全相同的提示（Identical prompt）** —— 该行的源句子与测试集的源句子相同
  （忽略大小写、标点和空格后）。**即使该行的翻译不同也会被剔除**：
  因为模型仍然会在完全相同的测试提示上进行过练习。
- **完全相同的答案（Identical answer）** —— 该行的目标文本与测试参考答案相同。
- **高度近似的答案（Near-duplicate answer）** —— 该行的目标文本与测试答案共享至少 60% 的词汇
  （折叠重音符号，因此拼写变体也计入），**并且**包含完整答案、是答案的片段，或者相似度至少达到 90%。
  这相当于向模型展示了大部分答案。

……以及它**特意保留**的内容（会报告但绝不移除）：

- **模板同胞句（Template siblings）** —— 该行与测试答案共享同一个句式框架，
  但各替换了一个词（*“I see the dog”* / *“I see the cat”*）。模型仍然必须生成它在该框架中从未见过的词。
  模板化的教科书和学校语料库中充斥着这类句子。forge 会列出在训练集中存在同胞句的测试行；
  由于初始配置设置了 `eval.near_dupe_corpus`，最终报告会在完整得分旁边显示一份针对不存在同胞句行的 **“(strict)”** 得分。
- **相似提示，不同答案（Similar prompt, different answer）** —— 源句子与测试源句子高度近似
  （不是完全相同的复制），但翻译不同：这是合理的最小对立对，而不是数据泄露。

以下是对照 3 行测试集筛查 12 行玩具语料库的报告
（经过截断；玩具句子为英语，目标为类法语文本）：

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

第 3 行的翻译与测试行*不同*，但依然被剔除：
因为其提示句就是测试集的提示句。

示例按行号引用**您的语料库**行；测试文件自身的文本绝不会被打印出来，
与**密封（sealed）**集合匹配的行仅按行号显示。
（当语料库行与测试行完全相同或包含测试行时，引用语料库行也会展示该测试句子 ——
如果输出需要共享，请传入 `--no-examples`。）

`--clean-to pairs.clean.jsonl` 会写入留存下来的行，并在它们旁边生成一份不含具体内容的审计记录（`pairs.clean.audit.json`）。
请在切分**之前**筛查语料库（步骤 4 会切分清洗后的文件）。
从语料库中切分出 dev 集后，不要对整个语料库重新进行筛查 —— 否则 dev 集各行会与自身匹配并被剔除。
在将任何*追加*数据（网络抓取数据、单语文本）加入训练之前，请以同样的方式进行筛查。

**筛查不会消耗您的测试集。**leak-audit 读取测试集是为了比对行，
forge 会将其记录为一次*审计*读取，绝不是评分读取：
它不会妨碍您在步骤 3 中编写的预测。

**首先查看判定结论**（`VERDICT:` 行；搭配 `--json` 时为 `verdict` 键）。
如果它表明大多数测试行在您的语料库中都有近似孪生句（near-twin），那么在全部数据上训练的模型
其评分体现的将是对训练短语的记忆召回，而不是翻译能力。对于固定的测试集（经教师或护士审核），
您通常会训练**两个模型**：一个基于全部数据训练 —— 通常是更适于部署的模型；
另一个是去除了孪生句的模型，其评分能体现该方法处理新句子的能力。无孪生句的语料库来自于 `--drop-test-twins`：

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

它会移除属于测试行近似孪生句的训练行，报告处理前后的严格子集，
如果这会导致没有可供训练的内容则会拒绝执行 —— 并在您的配置旁边写入无孪生句模型的配置，
**`config-notwins.json`**：相同的配置，带有自己的 `run_name`，并将 `data.gold` / `eval.near_dupe_corpus`
设置为无孪生句文件（`--companion-config <file>` 指定了另一个文件；绝不会覆盖现有文件）。
它会打印训练该模型的命令。在 dev 集注册之前（步骤 4），它会提示先切分 dev 集并再次运行此审计，
以便 dev 行也能从无孪生句文件中剔除。在您采取行动之前，`nmt-forge status` 会将该结论 ——
以及随后未训练的无孪生句模型 —— 保留在其警告中。

**拒绝时呈现的形式：**您无需刻意记住去运行它 —— `nmt-forge run`
会针对您的测试集和密封集审计每一个训练文件，并在发生泄漏时拒绝执行：
*“[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0 identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12 template sibling(s) … which are KEPT”*。
修复方法：`nmt-forge leak-audit <file> --clean-to <file.clean.jsonl>`，并在清洗后的文件上进行训练。

---

## 第 3 步 — 预测然后再看

**您说：**“在我们对测试集进行任何衡量之前，写下我们预期每个模型在测试集上的得分。”

**forge 所做的工作：**为您计划训练的每个模型生成一份预注册记录，以该模型命名：

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

预测文件是一个由预测项组成的 JSON 数组。每一项都指定了一个指标和一句解释理由，
再加上相对于基线的方向（`"direction": "increase", "baseline_score": 0, "margin": 5`）——
稍后会自动检查 —— 或是由人工核对的自由文本预期（`"expect": "between 10 and 30"`）。
您（或您的 Agent 口头确认）必须在产生任何测试得分**之前**提交这些内容 ——
**并且要在对测试集上的现有模型进行任何基准测试之前**：[为您的语言构建机器翻译](/docs/build-mt-for-your-language#3-measure-the-options)中步骤 3 的基线测试
位于此步骤*之后*。导出时，`--prereg <id>` 会说明哪个预测用于评判哪个模型。
或者现在就将预测固定到其模型配置中：在 `prereg new` 上运行 `--config-hash <hash>`，
使用 `nmt-forge preflight run --config config-notwins.json` 输出的完整哈希。后续对该配置的任何编辑（例如修改时间预算）
都会改变哈希并取消固定，因此在导出时指定预注册是更简单的方法。

**拒绝时呈现的形式：**您在此处可能会遇到四种情况。

- 未经编辑的模板会被拒绝：其中的 `REPLACE` 占位符没有预测任何内容。请写下您自己的预期和理由。
- Markdown 或纯文本文件会被拒绝，并附带正确的格式和模板生成命令。格式只有一种：JSON 数组。
- 在测试集已被评分后编写的预注册会被拒绝：*“[preregister] eval set 'project-test' was already read for scoring … before this preregistration”*。基准测试也算作评分读取。`--allow-after-reads` 仅适用于那些确实在读取之前就已经记录下来的预测（例如写在纸上的）；它会被记录在案，随后每份报告、导出、`DEPLOY.md` 和 `nmt-forge status` 都会声明这些预测是在经过 N 次评分读取后生成的。
- 在没有预注册的情况下对测试集进行评分会被拒绝：*“[preregister] no preregistration for eval set 'project-test' … why: results looked at without written-down expectations become post-hoc stories”*。这就是真实结果与“先看结果后讲故事”的区别。

:::info 为什么这感觉像额外的工作
这就是工作。这里的每个守卫都是一个欺骗过真实研究人员的错误。该工具使诚实的路径成为简单的路径，不诚实的路径成为阻止你的路径。
:::

现在请在测试集上衡量现有选项 —— 参见[为您的语言构建机器翻译](/docs/build-mt-for-your-language#3-measure-the-options)的步骤 3 —— 然后返回继续进行训练。

---

## 步骤 4 —— 切分、检查门禁，然后训练 {#step-4--check-the-gates-then-train}

**您说：**“将清洗后的语料库切分为 train 和 dev。训练运行能否通过所有检查？如果能，开始训练。”

**forge 所做的工作 —— 切分：**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

`--test 0` 仅切分出 train 和 dev，因为您的测试集已经作为单独的注册文件存在（如果测试集是切分出来的，步骤 1 中就已经完成了切分）。
`--register project` 会在工作区中记录 `project-dev` —— 这正是初始配置已经指向的名称。

切分采用**组互斥（group-disjoint）**策略：凡是共享源文本*或*目标文本的任意两个句对都会被分配到**同一**侧。
这是低资源评分虚高的最常见原因 —— 教科书通常将许多英语练习句映射到同一个目标词，
幼稚的随机切分会将一份副本放入训练集，而将其孪生句放入测试集，导致模型只是“翻译”了它死记硬背的答案。
输出会说明具体处理过程：

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

在已经注册测试集的情况下，`split` 还会当场针对测试集筛查新的 train 和 dev 文件，
并在后续可能被拒绝时发出警告。

**模板化语料库（常用语手册、练习题）。** `--near-dupe 0.6` 还会将*高度近似*的重复项（基于相同框架构建的句子）
保留在同一侧，从而确保 dev 或 test 行在训练集中绝不会有模板孪生句。在高度模板化的语料库中，
句子框架可能会连锁成一个巨大的组（*“Does your arm hurt?”* ~ *“Does your leg hurt?”* ~ *“Your leg looks swollen”* ……），
而一个组只能完整地分到某一侧。当这会导致某一侧分到的行数远多于您的请求时 ——
超过请求数量的 **1.5 倍** —— 或者导致训练集保留的数据不足请求保留量的一半时，
`split` 会拒绝执行且不写入任何内容：*“[split-guard] split refused — nothing was written: the carve does not match the request (dev: asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the 773 rows the request leaves it)”*，
随后附带原因（连锁情况及最大组的大小）以及可行的解决途径：提高阈值、限制组大小（`--near-dupe 0.6 --max-group 51` —— 超过上限的近似重复链接保持不断开，切分过程会统计这些链接）、使用 `leak-audit --drop-test-twins` 剔除固定测试集的孪生句，或者独立于训练材料编写 dev/test 句子。forge 会自行检查连锁情况：在此类语料库上，其近似孪生句建议（此处、预检中以及导出的 DEPLOY.md 中）不推荐使用 `--near-dupe 0.6`。

**拒绝时呈现的形式：**如果您向 forge 提交自己切分的数据，
当两侧存在重叠时 `nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` 会拒绝执行 ——
*“[split-guard] 3 shared canonical source keys and 1 shared target keys between 'train' and 'test'”* —— 并提供修复方法：
使用 `split` 重新切分；不要手动删除违规行。

**训练两个模型？** 现在 dev 集已经注册，请再次运行步骤 2 中的无孪生句审计（dev 行也会从无孪生句文件中剔除）；
其 `config-notwins.json` 会在下方训练第二个模型。

**forge 所做的工作 —— 门禁检查：**`nmt-forge preflight run --config config.json` 会列出本次运行将经过的每个门禁，
标记为 ✓ 或 ✗，每个 ✗ 都会附带修复方法 —— 包括是否已安装训练 extra：

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

当检查全部变绿通过后：运行 `nmt-forge run config.json`（对于无孪生句模型，运行
`nmt-forge preflight run --config config-notwins.json && nmt-forge run config-notwins.json`）。

采用默认的 `cpu-tiny` 预设时，这可以在普通的笔记本电脑 CPU 上运行 —— 无需 GPU，
无需下载。训练仍然是唯一一个**不是**瞬时工具调用的步骤，
因此您的 Agent 应该在后台运行它，并将输出重定向到日志文件，
仅监控关键行（`refused`、`Error`、`wall-clock`、`RUN EXIT`），
而不是轮询。一个带有损失曲线和停止按钮的实时面板会为**您**打开
（当该端口空闲时位于 `http://127.0.0.1:8377`）—— 这是供您查看的，而不是 Agent。
在运行初期，forge 会测量其速度，并在几分钟内（而不是几天后）拒绝无法在配置的 `model.time_budget_hours` 内完成的运行。

`[schedule-sanity]` 行显示了 forge 根据您的数据混合推导出的早停**下限**，
这样当真实验证集损失波动时，高度依赖合成数据的运行不会在半个轮次（epoch）就过早停止
（这是一种真实的失效模式 —— 参见[诊断训练运行](/docs/network/getting-started/diagnosing-training)）。

运行结束时，forge 已经**在隔离的 dev 集上选出了最佳检查点**（绝不会在测试集上选择），
写入了 `run-manifest.json`，并输出了 dev 得分 ——
始终附带其 95% 置信区间 —— 随后给出了下一步命令。

---

## 步骤 5 —— 评估一次并打包

**您说：**“在测试集上评估该模型并进行打包，以便我们使用。”

**forge 所做的工作：**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

一个命令即可完成：

- 使用训练运行选出的检查点对测试集进行解码并评分 ——
  若无预注册则拒绝执行，记录在工作区的账本中，每个数字都附带 95%
  置信区间，并包含一份通俗易懂的**诊断与建议**部分；
- 将结果作为 **mt-eval 报告**写入 `export/evaluation/`，因此
  `mt-eval compare` 可以将该模型与您使用该套件衡量的任何模型并列对比
  （例如[为您的语言构建机器翻译](/docs/build-mt-for-your-language#3-measure-the-options)步骤 3 中的托管模型）；
- 在 `export/model/` 中打包一个**自包含模型**（包含权重和分词器，
  不含训练状态）、`forge-model.json`（说明其是什么以及如何评测的）、一个
  champollion 插件清单，以及包含确切命令的 `DEPLOY.md`。
  `export/model/` 不包含任何测试句子；它是您唯一需要部署的文件夹。

**得分**是评测套件的核心指标：语料库 chrF++ 及其 95% 置信区间，
在 forge 展示它的所有地方写法都完全一致 ——
例如 `chrF++ 31.2 [28.4, 34.0]` —— 并在完整记录（`forge-model.json`、导出摘要、`DEPLOY.md`）中附带其 sacreBLEU 签名。
BLEU、spBLEU 和 TER 会并列显示，绝不会混在一起；
完全匹配（exact match）和其他测试项属于诊断指标。任何 forge 界面都不会打印综合评分或质量标签：
输出结果的价值应当由该语言的使用者来判断。

**影响得分可信度的限定条件会随得分一同传递。**mt-eval 报告记录了所有限制得分含义的因素 ——
例如*近乎恒定的输出*（模型对许多不同的输入总是给出极少数固定的句子，
因此其输出并不跟随输入变化）、输出长度远长于或远短于参考译文，或者直接复制源句。
`export` 会用评测套件的原话完整传递这些信息：在其摘要
（`score_caveats`）、`forge-model.json` 以及 `DEPLOY.md` 的得分正下方。
`status`、`report`、`compare` 和 `lint` 也会表达相同的内容。带有警示说明的得分绝不会在脱离说明的情况下单独作为“可引用的数字”呈现。

如果任何环节失败，绝不会留下只写了一半的导出文件。两点注意事项：
`export/evaluation/` 包含您的测试句子 —— 绝不要将其与模型一同复制；
请将其与测试集放在一起。（当测试集标记为私有时，其中的每个文件都会带有相同的标记。）
此外，**密封（sealed）**测试集是一次性的：导出操作会消耗它，第二次导出将被拒绝，
除非您传入 `--no-eval`（仅打包模型而不重新评分）。

如果您只需要指标而不需要打包，`nmt-forge evaluate <run-manifest>` 是 `export` 的仅评分部分
（`--harness-out DIR` 会写入 mt-eval 报告）。

**在同一个测试集上评估两个模型**（例如一个在全部数据上训练，另一个带有
`--drop-test-twins`）：一旦工作区中包含第二次运行，该运行的 `NEXT` 行和
`nmt-forge status` 会为每次运行指定一个文件夹（`--out export-<run>/`）。
顺序并不重要：无论哪个模型后导出，全部数据模型的 `DEPLOY.md` 最终都会引用无孪生句模型的得分。
对于同一个测试集上的两个预注册，`nmt-forge status` 和 `nmt-forge report` 会指明哪一个适用于哪次运行
（或者必须通过 `--prereg <id>` 做出决定 ——
export the twin-free model with `--prereg notwins`). `nmt-forge compare` 会在测试集上对两者进行 A/B 对比，并针对每个模型报告有多少测试行在其训练数据中存在近似孪生句：
在召回记忆上的胜出会被如实报告为胜出）。它会获取每个模型的假设译文 ——
`<export>/evaluation/battery-hyps.jsonl`（在导出摘要中称为 `hypotheses`）—— 并传递 mt-eval 为该次导出所写的得分警示。
仅当结合其上的任何警示说明时，无孪生句得分才可以作为新句子的引用指标：如果无孪生句模型的输出近乎恒定，
其得分就不能作为其能够翻译新句子的证据，`DEPLOY.md` 会在数字旁边明确注明这一点。

**评测套件的读取同样计入次数。**当 forge 注册测试集时，它会在文件旁启动一个小型读取日志（`<file>.reads.jsonl`），
每次 `mt-eval run` / `mt-eval compare` 对该文件进行评分时，都会追加一行无具体内容的信息（运行 ID、目的、文件的 sha256、时间戳）。
forge 会读取该日志：在发生此类读取之后写入的预注册会被作为事后假说（postdiction）予以拒绝（除非使用 `--allow-after-reads`，
随后每份报告都会披露这一点）—— 这就是步骤 3 必须在基准测试之前进行的原因 ——
被 `mt-eval` 读取的密封集合会被消耗，`status` 和 `ledger show --set` 会统计读取次数，
而 `DEPLOY.md` 会在导出的得分不是首次观察结果时予以说明。

### 如何阅读 battery-lint 报告

报告是一张**按语域**（教科书、政府公文、口述故事等）划分的得分表 ——
如果测试行未指定语域，则为单一分组 `all` —— 每个语域都附带置信区间，随后是诊断分析。
诊断会指出您的**最弱语域**，并针对每个语域给出最可能的原因和下一步应采取的**调节杠杆**：

| 如果诊断显示…… | 意味着…… | 调节杠杆 |
|---|---|---|
| `R1-vocabulary-gap` | 该语域得分低**且**输出不完整；模型缺乏相应词汇 | **词汇（VOCABULARY）** —— 扩充词表，然后重新检查漏斗 |
| `R2-structure-gap` | 词汇已知，但句子*结构*未知 | **结构（STRUCTURE）** —— 添加缺失的句式结构（模板/组合器） |
| `R3-mixed-convention` | 输出中混杂了多种拼写方式 | **正字法（ORTHOGRAPHY）** —— 将语料库规范化为一种书写规范，重新训练 |
| `R4-optimism-bound` | “完整”得分因测试集中的近似孪生行而虚高 | **评测度量（MEASUREMENT）** —— 引用严格（strict）得分以衡量泛化能力 |
| `R5-low-power` | 置信区间过宽 | **评测度量（MEASUREMENT）** —— 不要针对小于置信区间的差值采取行动；扩充测试集 |
| `R7-transfer-plateau` | 在合成数据上表现极佳，但在真实文本上停滞不前 | **真实数据（REAL-DATA）** —— 回译单语数据或获取真实的平行句子 |
| `R9-harness-score-caveat` | mt-eval 报告对得分提出了限定条件（例如输出近乎恒定）；当 mt-eval 判定为严重问题时显示 `high` | **评测度量（MEASUREMENT）** —— 仅在附带警示说明的情况下引用得分，并在将其称为翻译质量之前先阅读部分输出样本 |

每项发现都附带其触发时的证据。对于 `--json` 发现，您的 Agent 可以通过程序化方式处理：`nmt-forge lint export/evaluation/battery-hyps-battery.json --json`.

---

## 步骤 6 —— 将模型提供给 champollion CLI 服务

**您说：**“启动导出模型的服务，并用它翻译我们应用的字符串。”

**forge 所做的工作：**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` 提供两种响应方式：champollion **api 方法**协议
（`POST /translate`）以及**兼容 OpenAI** 的 `/v1/chat/completions`，
这也是 `champollion sync --method local` 通信的方式。`export/model/DEPLOY.md` 中包含推荐的 `api` 方法对应的
`champollion.config.json` 代码片段，以及插件清单的内容。该服务仅在 `127.0.0.1` 上监听；
若要在网络上暴露该服务，您必须为其提供一个令牌（`--token` 或 `NMT_FORGE_SERVE_TOKEN`），
因为任何能够访问该端口的人都可以使用您的模型。CLI 访问本地回环（loopback）服务器无需密钥；
带令牌启动的服务器则需要在 `CHAMPOLLION_API_KEY` 中配置相同的值。

如果有两个导出模型，部署哪一个由您决定：
`nmt-forge choose export-<run>/model` 会记录您的选择，随后的 `nmt-forge status` 就会指明该模型。
仅启动某个模型进行试用会被记录为已提供服务，而不会被记录为最终选择。
若要让该模型参加主权评测（sovereign contest），`DEPLOY.md` 第 6 节列出了构成声明式（Lane A）参赛条目的文件，
以及确切的 `mt-eval contest submit-model` 命令。

请清楚了解您部署的是什么：NMT 模型只负责翻译文本；它**不**遵循指令，
因此 CLI 发送给 LLM 方法的语气指引、指导文件和术语表都会被忽略。
此外，低资源语言的机器翻译在内容触达读者之前，必须经过流利使用者的审核。

---

## 你刚才做了什么

您训练出了一个得分真正值得信赖的模型：没有泄漏的答案，在不偷看测试集的情况下选出的检查点，
每个数字都有误差范围，结果公布之前写好的预测，明确指出下一个应对杠杆而不是让您凭空猜测的诊断分析 ——
以及一个 CLI 可以调用、且能与您衡量的所有其他方法直接进行横向对比的打包模型。
这就是核心所在 —— **诚实可靠的结果是默认内置的标准，而且实现这一切并不需要机器翻译专家知识（甚至不需要 GPU）。**

当指标令人失望时（初次尝试时往往如此 —— 默认模型在设计上就是较弱的基线），
请阅读[诊断训练运行](/docs/network/getting-started/diagnosing-training) ——
它是以症状为导向编写的，专为应对该时刻而准备。
