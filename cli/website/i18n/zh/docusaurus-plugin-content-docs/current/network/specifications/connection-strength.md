---
sidebar_position: 7
title: "连接强度 (cchrF++)"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# 连接强度

当网络地图在两种语言之间绘制一条弧线时，其颜色回答了一个问题：**两者之间最好的测量翻译有多好——诚实地说？**

诚实的部分比听起来要难。本页用通俗语言解释了颜色背后的数字。

## 问题：原始分数在零处不为零

我们的大多数分数是 **chrF++**（字符 n-gram F 分数，[Popović
2017](https://aclanthology.org/W17-4770/)）——它衡量翻译的字符和词与参考翻译的重叠程度，范围从 0 到 100。

但*随机文本不为零*。每种书写系统都会"免费"提供一些重叠：具有少数不同字符的正字法，或长的可预测词汇，即使"翻译"是无意义的，分数也会明显高于零。这种免费重叠——**机会基线**——因语言而异。在我们的测量中，它的范围从大约 1.6（中文字符）到超过 13（某些拉丁字母和阿拉伯字母脚本语言）。原始 chrF++ 为 14 在一种语言中接近随机噪声，在另一种语言中是真实信号——因此原始 chrF++ **在语言之间不可比较**，按其着色的地图会悄悄地偏袒某些字符系统。

## 解决方案：减去基线

**机会修正 chrF++（cchrF++）** 重新调整分数，使得 0 表示"不优于该语言中的机会"，1 表示完美：

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

基线是测量的，而不是假设的：对于每种语言，我们运行蒙特卡洛估计——数千个随机同正字法基线与真实参考进行评分——仅使用公开可用的单语文本（FLORES-200 dev，从源获取，从不重新分发）。基线表目前涵盖 196 种语言，是 Champollion 衍生的工件（`champollion-derived` 来源；由 `cli/website/scripts/build-cchrf-floors.mjs` 重新生成）。

两条保守规则保持修正的诚实性：

- **仅当两侧都有测量的基线时，才修正一对。** 如果任一侧缺失，弧线以中性石板色显示——*已测量，基线未知*——并且永远不会进入颜色范围。
- **该对使用两个基线中较高的一个。** 修正可能低估强度，但永远不会夸大它。

## cchrF++ 在层级中的位置

cchrF++ 是我们最好的*自动*强度度量——它不是层级的顶端。从最可信到最不可信：

1. **人工验证**——流利使用者判断输出（[说话者验证](/docs/network/specifications/speaker-validation)）。没有自动方法能超越它。
2. **MQM 风格的专家标注**（[多维质量指标](https://aclanthology.org/2014.tc-1.6/)，Lommel 等）——WMT 用于其黄金判断的协议；昂贵、罕见、非常好。
3. **cchrF++**——机会修正、在语言间可比较、计算成本低廉。
4. **原始 chrF++ / BLEU / 神经网络指标**——在一个数据集内有用；参见 [指标可靠性](/docs/network/specifications/metric-reliability) 了解每个指标在您的语言对上与人工判断的跟踪效果有多差。

当人工验证和 MQM 级别的结果进入公告板时，它们对同一对的自动分数优先。

## 地图如何绘制它

每个视觉通道恰好传达一个含义：

| 通道 | 含义 |
|---------|---------|
| **颜色** | cchrF++ 带——五个步骤，红色到柔和绿色：*接近基线*（< 0.15）、*弱*（0.15–0.35）、*发展中*（0.35–0.55）、*可用*（0.55–0.75）、*强*（≥ 0.75） |
| **中性石板色** | 已测量，但至少一侧的机会基线未知——永远不会放在颜色范围上 |
| **虚线 + 变暗** | 临时的：测试集低于 [显著性基线](/docs/network/specifications/significance)（n < 100），其中分数差异在 ~5 chrF++ 内是噪声 |
| **宽度** | 重复颜色带（可访问性冗余，不是第二个变量） |

只有**已测量**的对才能进入强度范围。已注册的对——排队等待测量但尚未评分——显示为淡色平坦的细线，其颜色仅表示*该对今天如何可达*（商业 API · 开源模型 · 前沿，无提供商），永远不是任何东西翻译效果如何。这两个词汇表是故意不相交的：柔和平坦的线程 = 可达性，红色→绿色范围 = 测量强度。弧线的基础分数是该对在公告板上的最佳测量运行，随着新运行到达而自动刷新。

## 细则

- 基线是从仅单语文本估计的指标 × 正字法属性；不涉及或存储任何平行语料库内容。
- cchrF++ 告诉您翻译是否超过机会以及超过多少——它**不**验证含义、寄存器或文化适配。这些仍然是人工判断（[诚实的局限](/docs/network/honest-limitations)）。
- 机会基线方法是 Champollion 研究；基线图集和修正在此发布，正是为了可以检查和质疑它们。
