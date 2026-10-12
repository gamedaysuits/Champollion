---
sidebar_position: 2
title: "诚实地训练模型 (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# 诚实地训练模型 (nmt-forge)

**30 秒速览：** 绝大多数低资源机器翻译的“性能提升”在复查时都会站不住脚——测试集泄露到了训练集中、用测试集挑选了 checkpoint、或者所谓的提升只是没有误差范围（error bars）的噪声。**nmt-forge** 是一个在结构上杜绝此类错误的训练套件：其正常流程默认执行正确操作，而错误流程会直接拒绝执行，并附带一条信息说明发生了*什么*、*为什么*会导致结果失真以及确切的*修复方法*。它负责训练；[评估工具（eval harness）](/docs/network/specifications/harness)负责评分。其中的每一项防护机制（guard），都源自我们在构建普莱恩斯克里语（Plains Cree）翻译时实际犯过、测量过并记录下来的错误。安装命令为 `python3 -m pip install 'nmt-forge[hf]'`，其默认模型只需笔记本电脑 CPU 即可训练。

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

这就是该套件整个个性在一次拒绝中的体现。

## 五分钟的故事

这是该套件诞生的失败案例。一本克里语教科书将许多英文练习映射到一个目标：*"Feed him"* 和 *"Feed her"* 都翻译为 `asam`。标准的随机分割将一个副本放在训练中，将其孪生副本放在测试集中——所以模型实际上已经看到了 54 个"测试"答案中的 17 个，这些行的 chrF++ 得分为 83，而干净的行为 44。下游的所有内容（"冠军"模型、基于它的发现）都必须被丢弃。

nmt-forge 的分割器通过**构造**使这成为不可能：共享源*或*目标的对被分组，整个组落在一侧，零重叠验证在每次切割后运行：

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

（如果你的测试集已经是一个独立的、已注册的文件——比如你私密保留的、经教师核对的测试集——`--test 0` 将只切分训练集和开发集。）

所有其他防护机制都具有相同的特性——将一个真实的错误通过机制自动排除。
它们共同构成了**训练护栏（training guardrails）**：请在切分数据前阅读它们（`nmt-forge init` 和 `nmt-forge status` 会在该步骤指向此处；智能体可以通过 MCP 工具 `get_training_guardrails` 获取相同的规则以及每条规则背后测得的错误）。

| 防护机制 | 彻底杜绝的错误 |
|---|---|
| **split-guard** | 测试集答案通过共享的源文/目标文隐藏在训练集中 |
| **dev-fence** | 测试集被用来挑选 checkpoint（若没有注册开发集，训练将拒绝启动） |
| **leak-audit** | 在评估文本上进行训练——相同的提示词（即使翻译不同）、相同或近似重复的答案，或是整个文件。它还会说明它特意*保留*了什么以及原因：仅替换了一个词的模板同胞句（如 *"I see the dog"* / *"I see the cat"*）属于练习而非泄露的答案，会进行报告但不会移除——除非每条测试样本都存在对应句子，此时 `--clean-to … --drop-test-twins` 会移除固定测试集在训练集中的孪生句。确定性行为：相同语料，相同结果 |
| **funnel-audit** | 流水线中的无感知损耗（曾有一个正字法字符导致 1,375 个词典动词被隐形删除，且数周未被发现） |
| **convention-lint** | 在混合拼写约定的数据上训练（导致模型在句中混用不同的拼写体系） |
| **coverage-map** | 一百万对合成数据中完全没有祈使句、疑问句或领属结构——虚高的数据量掩盖了结构性缺失 |
| **sample-strata** | 两种模板类型霸占了一半的训练信号 |
| **ci-scoring** | 缺乏误差范围的分数（每个数字都附带其 95% bootstrap 置信区间——绝不输出毫无上下文的孤立分数） |
| **schedule-sanity** | 早停机制在半个 epoch 时就终止了合成数据占比极高的运行：当含有 97% 合成数据并配合诚实的*真实*开发集时，开发集损失很早就见底并开始上升——这是模型在拟合大量的合成数据，而非收敛。停止底限会根据你的数据配比自动推导，每次干预都会结合开发集损失的变化轨迹进行说明。这个机制正是*通过*规范严密的协议发现的——严谨诚实的实验设置才能暴露真实的 bug |
| **eval-ledger** | 对评估数据的无感知自适应使用（每次读取均被记录；封存的数据集仅限单次使用） |
| **preregister** | 伪装成预测的事后解释（未预注册 → 不提供测试分数，不生成对比表；统一的预测格式，即 JSON 数组——`nmt-forge prereg template` 会写入一份供编辑） |
| **score caveats** | 引用评估工具附加了保留意见的分数——例如*近乎恒定的输出*（无论输入何种内容都只输出少数几种固定句子：输出并未随输入变化）、输出长度远长于或远短于参考译文、直接复制源文。forge 本身不计算这些指标；它只是将评估工具记录的每条警示以评估工具的原话在分数旁原样传递——包含在导出摘要、`forge-model.json`、`DEPLOY.md`、`status`、`report`、`compare` 以及 `lint` 中——且绝不将带有保留意见的分数在缺少警示的情况下作为“可引用的最终数字”给出 |

## 任何语言、任何资产——从卡片开始

nmt-forge 是面向 Champollion 索引中全部约 8,700 种语言的统一工具，它首先会查询该索引，以了解某种语言实际具备哪些资源：

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

`?` 标记是该工具的诚实表现：卡片上的缺失意味着**未知**，永远不是"这种语言什么都没有"。每种语言都爬上相同的**资产阶梯**——(1) 仅平行文本已经获得完整的受保护训练循环；(2) 单语文本添加回译；(3) 字典加上已发布的语法使引用的模板包值得构建；(4) 形态分析器解锁验证的合成；(5) LYSS 裁判将语言自己的指标放入评分和检查点选择中。丰富的卡片（平原克里语）自动连接第 4-5 级——评估集到达时被标记为 `NEVER TRAIN ON THIS`，裁判的插件通道已准备好粘贴。

随后，`nmt-forge init <code>` 会基于语言卡片脚手架生成一个项目：包含工作空间、初始配置，以及一份为你*和你的智能体*编写的 `NEXT_STEPS.md` 简报，其中包含确切的命令执行顺序。它只需一个普通的 `pip install` 即可工作——卡片可以从你指定的目录、本地检出仓库或公共卡片索引（已缓存供离线使用）中读取——尚无卡片的语言同样可以生成项目（`--no-card --name "<name>"`），其中每项卡片事实都会被记录为未知而非凭空臆造。

## 从笔记本电脑到模型服务部署

诚实训练闭环并不需要 GPU。`init` 会将三种模型预设之一作为明确的数值写入配置：

| 预设 | 需求 | 预期效果 |
|---|---|---|
| `cpu-tiny`（默认）— 从头训练的小型 Transformer，词表仅从训练样本中学习 | 笔记本电脑 CPU，无需下载 | 预期能力较弱：在 1,000–2,000 对句对上，chrF++ 大致为 5–30——仅能学到你数据中的短语和句式，而非通用翻译能力 |
| `cpu-finetune --base <hf-id>` — 由你指定的相关语言对的小型预训练 Marian/opus-mt 模型 | CPU，约 300 MB 下载量 | 当存在相关语言对时通常优于 `cpu-tiny`——请通过评测验证 |
| `nllb-600m` — 采用 LoRA 的 NLLB-200 distilled 600M | GPU | 最强劲的起步方案 |

`cpu-tiny` 的存在是为了让你在第一天就能把*整个*流程完整跑通——包括隔离栅栏、各项审计、预注册测试集、CLI 可调用的模型——以便后续更优秀的模型可以直接放入同一个项目中，并以完全相同的方式进行评测。训练完成后，只需两个命令即可完成收尾工作：

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export` 对测试集进行单次评分（需要预注册，输出 95% 置信区间；`--prereg <id>` 指定了使用 `nmt-forge prereg new <id>` 为该模型写入的预注册——当两个模型在同一个测试集上评测时，各由其自身的预注册判定，export 拒绝进行盲目猜测），将结果写为 `mt-eval compare` 可读取的 mt-eval 报告，并打包一个包含 Champollion 插件清单和 `DEPLOY.md` 的自包含模型。`serve` 支持 Champollion api-method 契约以及兼容 OpenAI 的接口，因此 `champollion sync --method local` 可以使用它进行翻译；除非为其提供 token，否则它仅监听 localhost。每个命令都支持面向智能体的 `--json`（在 stdout 上输出单份 JSON 文档；拒绝执行时输出为 `{"error": {…, "why", "fix"}}`，退出码为 2）。完整的操作指南请参见[训练你的第一个模型](/docs/network/getting-started/train-your-first-model)；一旦你训练出值得测试的模型，[提交方法](/docs/network/getting-started/submit-a-method)会将其转化为一个 Network 条目。

## 你可以为之辩护的合成数据

对于具有形态分析器 (FST) 的语言，forge 通过**语言包**制造训练数据——并强制执行一个*发出法则*，任何包都不能选择退出：每个生成的单词必须通过分析器往返（生成 → 分析 → 相同分析）、每个模板引用它转录的已发布语法、每个合理性过滤器都被命名和计数，每一行都被标记为 `synthetic: true`。该标记是承重的：注册表**拒绝测试集中的合成行**。测试仅使用真实数据。

forge 本身不附带任何语言包——它是一个通用工具。包与其语言一起存放，并通过模块路径或入口点插入（平原克里语包位于 crk-translate 项目中）：

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

分析器和字典保持分离，用户获取的工具在各自的许可证下——永远不捆绑、永远不重新分发。

## 你的语言自己的裁判，在循环中

LYSS 评估标准（每种语言的 linter，知道例如两个克里语拼写仅因记录的长元音约定而不同）插入每个评分表面——以及检查点选择，所以赢得的模型是*语言的裁判*偏好的，而不仅仅是 chrF++：

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

每个插件数字都获得一个置信区间；一个其先决条件缺失的裁判报告*不可用*而不是一个虚构的分数。

**完整工具指标堆栈**也是如此——nmt-forge 说[评估工具](/docs/network/specifications/harness)说的一切，包括神经指标 (COMET、COMET-QE、MetricX)，推理运行一次，置信区间从缓存的每条目分数自助法获得。在你在任何自动指标上选择检查点之前，`discover` 显示每个指标对你的语言族的[测量可靠性](/docs/network/specifications/metric-reliability)——对于因纽特语，BLEU 几乎不跟踪人类判断 (r=0.16)，而 COMET 跟踪 (r=0.86)；对于大多数低资源族，诚实的答案是*未测量*。该工具在你优化它之前告诉你应该相信哪个数字。

## 深入了解的地方

- **刚接触这些术语？** [通俗易懂的机器翻译训练指南](/docs/network/context/mt-training-concepts)用通俗的实例详细解释了每个概念——训练数据 vs. 评估数据、损失 vs. 解码、数据泄露、chrF++、回译、平台期——专为零基础读者编写。
- **准备开始构建？** [如何训练你自己的模型](/docs/network/tutorials/train-your-own-model)是一份分步操作、面向智能体的实操教程：选择语言 → 收集数据 → 数据合成 → 数据切分 → 训练 → 评估 → 迭代 → 部署服务并提交，并展示了每项护栏是如何捕捉对应错误的。[为你自己的语言构建机器翻译](/docs/build-mt-for-your-language)将训练置于整个流程的大背景中——寻找现有资源、评估方案、部署上线。
- **训练，然后提交：** 经过诚实评测训练的模型可通过[提交方法](/docs/network/getting-started/submit-a-method)成为 Network 条目。
- **误差范围说明：** [统计显著性检验](/docs/network/specifications/significance)详细介绍了 forge 默认应用的数学方法。
- **该信任哪种指标：** 在根据任何自动化指标挑选 checkpoint 之前，请查阅[指标可靠性](/docs/network/specifications/metric-reliability)。
- **所有命令与参数标志：** 查阅直接从工具本身生成的 [forge 命令参考](/docs/network/getting-started/forge-command-reference)。
- **失败分类法（Failure taxonomy）**——每种错误、具体示例以及捕捉它的防护机制——已随 nmt-forge 源码一起提供。智能体可通过 MCP 服务器的 `get_training_guardrails` 工具（可选 `topic`）获取相同的规则集，并且每次拒绝执行都会附带其具体原因（what/why/fix）。
