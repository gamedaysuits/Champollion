---
sidebar_position: 5
title: "烹饪书：微调模型"
---

# 微调模型

> **核心思想：** 在平行文本上微调一个开源权重模型（Llama、Mistral、Gemma），针对你的目标语言对。质量上限可能最高，但需要可能稀缺的平行数据——且评估数据污染规则严格。

:::info[这是一份食谱，不是完成的实现]
本指南概述了方法、数据需求和陷阱。实际的训练基础设施超出了 harness 的范围。
:::

## 何时使用此方案

- 你可以访问**平行语料库**（数百到数千个句子对），且**完全独立于**评估数据集
- 你可以**访问 GPU** 进行训练（本地硬件、云或大学计算集群）
- 你希望为特定语言对获得**最高质量上限**，并愿意投入训练
- 其他方法（引导式提示、少样本学习）已经达到质量瓶颈

## 工作原理

1. **组装平行数据** — 来自独立来源的源-目标句子对（教科书、社区档案、议会记录、宗教文本、教育材料）
2. **准备训练格式** — 指令微调格式（系统提示 + 输入 + 预期输出）
3. **微调** — 在基础模型上使用 LoRA/QLoRA（4 位量化使其在消费级 GPU 上可行）
4. **使用框架进行评估** — 通过评估框架运行微调后的模型
5. **迭代** — 调整训练数据、超参数、基础模型选择

## 数据需求

| 语料库大小 | 预期效果 |
|-------------|----------------|
| 50–200 对 | 相比零样本的边际改进；可能过拟合 |
| 200–1,000 对 | 明显的风格和术语改进 |
| 1,000–5,000 对 | 针对特定语言对的显著质量提升 |
| 5,000+ 对 | 接近基础模型的质量上限 |

:::danger[评估数据污染 = 取消资格]
你的训练数据必须不与评估数据集重叠。不是句子、不是词汇表、不是相同内容的释义。harness 会对你的输出进行指纹识别；统计重叠是可检测的。如果你不确定某个数据源是否独立，应该倾向于排除它。参见 [排行榜规则](/docs/network/leaderboard/rules)。
:::

## 骨架：LoRA 微调

```python
# Conceptual skeleton — adapt to your framework (HuggingFace, Axolotl, etc.)

# 1. Format your parallel data as instruction pairs
training_data = [
    {"instruction": "Translate to Plains Cree (SRO)", 
     "input": "The children are playing",
     "output": "awâsisak mêtawêwak"},
    # ... hundreds more
]

# 2. Fine-tune with LoRA (4-bit for consumer GPUs)
# Base model: meta-llama/Llama-3.1-8B, google/gemma-2-9b, etc.
# Rank: 16–64, Alpha: 32–128, Epochs: 3–5

# 3. Export and serve via the harness TranslationMethod protocol
```

## 平行数据来源

- **社区档案** — 教育材料、政府文件、双语出版物
- **努纳武特议会记录** — 130 万对对齐的英文-因纽特文对（加拿大 NRC）
- **圣经翻译** — 许多低资源语言都有，但领域特定
- **教育教科书** — 通常在语言学习背景下是双语的
- **自己创建** — 参见 [语料库创建指南](./corpus-creation)

## 优缺点

| | |
|---|---|
| ✅ 最高质量上限 | ❌ 需要平行数据（低资源语言稀缺） |
| ✅ 模型学习语言特定模式 | ❌ GPU 成本（虽然 LoRA 有帮助） |
| ✅ 可超越提示方法 | ❌ 小数据集过拟合风险 |
| ✅ 一次性训练成本，推理成本低 | ❌ 严格的评估污染规则 |

## 配合良好的方案

- **[语料库创建](./corpus-creation)** — 构建你需要的训练数据
- **[回译](./back-translation)** — 合成扩展你的平行语料库
- **[FST 门控管道](./fst-gated-pipeline)** — 微调模型 + 形态学验证
- **[引导式 LLM 提示](./coached-llm-prompting)** — 在微调基础模型之上进行引导

## 另请参阅

- [评估数据集](/docs/network/leaderboard/datasets) — 了解你**不能**训练的内容
- [排行榜规则](/docs/network/leaderboard/rules) — 污染政策
- [支持低资源语言](/docs/network/community/low-resource-languages)
