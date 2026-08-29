---
sidebar_position: 10
title: "Cookbook: 部分翻译（人工 + 机器）"
---

# 部分翻译（人工 + 机器）

> **核心思想：** 手工翻译一个代表性样本，证明你的机器方法与人工风格相匹配，然后自动翻译剩余的大量内容。结合人工质量与机器规模——人工设定标准，机器跟随执行。

:::info[这是一份食谱，不是完整的实现]
本指南概述了混合人机工作流程。它特别适用于翻译机构、社区语言工作者和教育环境。
:::

## 何时使用此方案

- 你能**接触到流利的使用者**，但他们的时间有限
- 你需要翻译**大量内容**，但只有一小部分需要完美
- 你想**建立质量基线**（通过人工翻译），然后用机器翻译扩展
- 你在**教育或社区背景**中工作，其中对子集的人工审查是可行的

## 工作原理

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **选择代表性样本** — 涵盖不同的句子类型、长度和主题
2. **人工翻译样本** — 建立风格、语域和术语的黄金标准
3. **配置你的机器方法** — 使用人工翻译作为指导数据、少样本示例或微调数据
4. **在人工样本上评分机器** — 机器是否匹配人工的风格？
5. **自动翻译其余部分** — 如果机器在样本上的质量可接受
6. **可选的人工审查** — 标记低置信度输出供使用者审查

## 质量保证：风格匹配测试

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## 选择样本

**覆盖分布。** 你的 100 条条目应包括：
- 短语（1–3 个词）和完整句子
- 常见词汇和领域特定术语
- 简单结构和复杂结构
- 多种语法特征（疑问句、祈使句、条件句）

**不要只挑简单的。** 样本必须包括你的方法可能难以处理的条目——这是人工质量最重要的地方。

## 社区审查工作流程

对于土著语言社区，这种方法尊重使用者的时间：

1. **使用者翻译 50–100 条条目**（2–4 小时的集中工作）
2. **机器翻译剩余的 900 条**，使用使用者的工作作为指导数据
3. **使用者审查标记的条目** — 仅审查机器置信度最低的条目（另外 1–2 小时）
4. **结果：** 1,000 条接近人工质量的翻译，仅需约 5 小时的使用者时间，而不是约 50 小时

## 优缺点

| | |
|---|---|
| ✅ 结合人工质量与机器规模 | ❌ 需要初始人工投入 |
| ✅ 尊重有限的使用者可用性 | ❌ 机器可能无法捕捉所有风格细微差别 |
| ✅ 自然的质量保证工作流程 | ❌ 样本选择影响整体质量 |
| ✅ 适合社区/教育背景 | ❌ 标记条目的人工审查瓶颈 |

## 配合良好的方案

- **[指导式 LLM 提示](./coached-llm-prompting)** — 人工翻译为指导数据提供信息
- **[少样本提示](./few-shot-prompting)** — 人工翻译作为上下文示例
- **[语料库创建](./corpus-creation)** — 人工样本就是语料库创建

## 另请参阅

- [面向语言社区](/docs/network/community/for-language-communities) — 社区参与模型
- [数据主权](/docs/network/sovereignty/data-sovereignty) — 翻译数据的所有权
- [支持低资源语言](/docs/network/community/low-resource-languages)
