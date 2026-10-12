---
sidebar_position: 8
title: "烹饪书：回译增强"
---

# 回译增强

> **核心思想：** 通过将现有目标语言文本翻译回源语言来生成合成平行数据，然后使用这些合成对来训练或提示前向模型。这能廉价地扩展平行语料库——但需要注意质量问题。

:::info[这是一份食谱，不是完成的实现]
本指南概述了该策略及其关键陷阱。回译功能强大，但如果处理不当可能会放大错误。
:::

## 何时使用此方案

- 你拥有**单语目标语言文本**但平行数据有限
- 你想要**扩展训练语料库**用于[微调](./fine-tuned-model)而无需手动翻译
- 你需要**更多少样本示例**但无法快速获得人工翻译
- 你愿意**积极质量过滤**合成数据

## 工作原理

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **收集单语文本** — 目标语言的书籍、文章、转录、社交媒体
2. **回译** — 使用 LLM 或 MT API 将每个句子翻译到源语言
3. **质量过滤** — 往返翻译（再次翻译回来）并比较；保留往返翻译≈原文的对
4. **使用合成语料库** — 用于微调、少样本示例或指导数据

## 质量过滤：往返测试

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## 关键陷阱：错误放大

:::warning[回译会放大现有模型偏差]
如果你的回译模型持续犯同样的错误，你的合成语料库将把这些错误编码为"正确"。这会形成反馈循环：用坏数据训练 → 产生更差的翻译 → 生成更差的合成数据。**始终要积极进行质量过滤**，并将合成数据与经过验证的人工翻译混合使用。
:::

## 单语文本来源

- 社区通讯、报纸和出版物
- 目标语言的政府文件（例如因纽特语的努纳武特议会记录）
- 教育材料和教科书
- 宗教文本（许多语言广泛可用）
- 社交媒体（需获得适当许可和质量过滤）
- 语言项目的转录音频/视频

## 优缺点

| | |
|---|---|
| ✅ 廉价扩展训练数据 | ❌ 如果未过滤会放大模型错误 |
| ✅ 利用丰富的单语文本 | ❌ 质量上限受回译模型限制 |
| ✅ 易于大规模生成 | ❌ 往返过滤计算密集 |
| ✅ 补充其他方法 | ❌ 合成数据永远不如人工翻译 |

## 配合良好的方案

- **[微调模型](./fine-tuned-model)** — 回译为微调创建训练数据
- **[语料库创建](./corpus-creation)** — 合成数据补充人工创建的语料库
- **[指导 LLM 提示](./coached-llm-prompting)** — 合成示例可以指导指导字典

## 另请参阅

- [评估数据集](/docs/network/leaderboard/datasets) — 合成数据不得与评估数据重叠
- [排行榜规则](/docs/network/leaderboard/rules) — 污染政策
- [支持低资源语言](/docs/network/community/low-resource-languages)
