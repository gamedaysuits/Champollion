---
sidebar_position: 2
title: "诚实地训练模型 (nmt-forge)"
related:
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

**30 秒版本：** 大多数低资源 MT"改进"在重新审视时都会失效——测试集泄露到训练中、测试集选择了检查点，或者收益只是没有误差条的噪声。**nmt-forge** 是一个训练套件，它在结构上使这些错误难以发生：其正常路径做正确的事，错误的路径会拒绝并显示一条消息，说明*发生了什么*、*为什么*它会破坏结果，以及确切的*修复方法*。它负责训练；[评估工具](/docs/network/specifications/harness)负责评分。其中的每个守卫都机制化了我们在构建平原克里语翻译时实际犯过、测量过和记录过的一个错误。

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

这就是该套件整个个性在一次拒绝中的体现。

## 五分钟的故事

这是该套件诞生的失败案例。一本克里语教科书将许多英文练习映射到一个目标：*"Feed him"* 和 *"Feed her"* 都翻译为 `asam`。标准的随机分割将一个副本放在训练中，将其孪生副本放在测试集中——所以模型实际上已经看到了 54 个"测试"答案中的 17 个，这些行的 chrF++ 得分为 83，而干净的行为 44。下游的所有内容（"冠军"模型、基于它的发现）都必须被丢弃。

nmt-forge 的分割器通过**构造**使这成为不可能：共享源*或*目标的对被分组，整个组落在一侧，零重叠验证在每次切割后运行：

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

其他每个守卫都有相同的形式——一个真实的错误，被机制化地消除：

| 守卫 | 它消除的错误 |
|---|---|
| **split-guard** | 通过共享源/目标隐藏在训练中的测试答案 |
| **dev-fence** | 测试集选择你的检查点（训练拒绝在没有注册开发集的情况下启动） |
| **leak-audit** | 在评估文本上训练——精确的、改写的 (Jaccard) 或整个文件 |
| **funnel-audit** | 无声的管道衰减（一个正字法字符曾经删除了 1,375 个字典动词，无形中持续了数周） |
| **convention-lint** | 在混合拼写约定上训练（模型随后在句子中间混合它们） |
| **coverage-map** | 一百万个合成对，没有祈使句、没有疑问句、没有所有格——体积隐藏结构差距 |
| **sample-strata** | 两种模板类型占据了一半的训练信号 |
| **ci-scoring** | 没有误差条的分数（每个数字都用其 95% 自助法置信区间呈现——没有裸分数输出） |
| **schedule-sanity** | 早期停止在半个 epoch 处杀死合成密集型运行：有 97% 的合成数据和诚实的*真实*开发集，开发损失很早就达到底部并向上漂移——这是模型拟合合成质量，而不是收敛。停止下限从你的混合自动推导，每次干预都用开发损失轨迹解释自己。这个是*通过*干净协议发现的——诚实的设置会暴露真实的错误 |
| **eval-ledger** | 评估数据的无形自适应使用（每次读取都被记录；密封集是一次性的） |
| **preregister** | 伪装成预测的后测（无预注册 → 无比较表） |

## 任何语言、任何资产——从卡片开始

nmt-forge 是一个适用于 Champollion 索引中所有约 8,700 种语言的工具，
它首先会向索引查询某种语言实际拥有的资源：

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

`?` 标记是该工具的诚实表现：卡片上的缺失意味着**未知**，永远不是"这种语言什么都没有"。每种语言都爬上相同的**资产阶梯**——(1) 仅平行文本已经获得完整的受保护训练循环；(2) 单语文本添加回译；(3) 字典加上已发布的语法使引用的模板包值得构建；(4) 形态分析器解锁验证的合成；(5) LYSS 裁判将语言自己的指标放入评分和检查点选择中。丰富的卡片（平原克里语）自动连接第 4-5 级——评估集到达时被标记为 `NEVER TRAIN ON THIS`，裁判的插件通道已准备好粘贴。

`nmt-forge init <code>` 然后从卡片搭建一个项目：一个工作区、一个启动配置和一个为你*和你的代理*编写的 `NEXT_STEPS.md` 简介——在你有值得测试的东西后结束于[提交方法](/docs/network/getting-started/submit-a-method)。

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

- **刚接触词汇？** [平白语言中的 MT 训练](/docs/network/context/mt-training-concepts)定义了每个术语——训练与评估数据、损失与解码、泄露、chrF++、回译、平台——有一个实际例子，为零背景编写。
- **准备好构建？** [所以你想训练你自己的模型](/docs/network/tutorials/train-your-own-model)是分步的、代理前向的演练：选择语言 → 收集数据 → 合成 → 分割 → 训练 → 评估 → 迭代 → 提交，每个护栏都显示捕捉其错误。
- **训练，然后提交：** 诚实训练的模型通过[提交方法](/docs/network/getting-started/submit-a-method)成为网络条目。
- **误差条：** [统计显著性测试](/docs/network/specifications/significance)是 forge 默认应用的数学。
- **哪个指标可信：** 在任何自动指标上选择检查点之前检查[指标可靠性](/docs/network/specifications/metric-reliability)。
- **完整设计**——每个守卫的测量背景故事、包接口、训练循环默认值——与代码一起存放在存储库中 (`forge/DESIGN.md`)。
