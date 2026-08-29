---
sidebar_position: 6
title: "Cookbook: 链式模型"
---

# 链式模型（多阶段管道）

> **核心思想：** 模型 A 生成粗略翻译 → 模型 B 进行后编辑 → 模型 C 评分或验证结果。每个阶段专注于一项任务。管道的输出优于任何单一模型。

:::info[这是一份食谱，不是完整的实现]
本指南概述了多阶段管道架构。具体的模型和链配置取决于您的语言对和预算。
:::

## 何时使用此方案

- 单一模型产生**质量不一致** — 某些输入效果好，其他输入效果差
- 您想要**分离生成和验证** — 一个模型创建，另一个批评
- 您有预算用于**每次翻译的多个 API 调用**（延迟和成本随阶段线性增长）
- 您想要结合具有**不同优势的模型**（例如，创意生成器 + 精确编辑器）

## 工作原理

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## 示例：三阶段管道

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## 常见链模式

| 模式 | 阶段 | 用例 |
|---------|--------|----------|
| **生成 → 编辑** | 快速 LLM → 强大 LLM | 成本高效的质量改进 |
| **生成 → 验证 → 重试** | LLM → FST/规则 → LLM（失败时重试） | 形态学正确性（参见 [FST-Gated](./fst-gated-pipeline)） |
| **生成 → 回译 → 评分** | LLM(en→crk) → LLM(crk→en) → 比较 | 往返一致性检查 |
| **集成 → 投票** | 3 个 LLM 独立运行 → 多数投票 | 通过多样性实现鲁棒性 |

## 关键设计决策

**延迟预算：** 每个阶段都会增加延迟。一个 3 阶段链，每阶段 2 秒 = 每次翻译 6 秒。对于批量评估这是可以接受的；对于实时应用可能不行。

**成本倍数：** 3 个阶段 = 3 倍的 API 成本。在早期阶段使用更便宜的模型，在关键阶段使用昂贵的模型。

**错误传播：** 不好的第 1 阶段输出可能会误导第 2 阶段。在每个阶段都包含原始源文本，以便后续模型可以恢复。

## 优缺点

| | |
|---|---|
| ✅ 可以结合专家优势 | ❌ 延迟和成本随每个阶段增加 |
| ✅ 关注点分离（生成 vs. 验证） | ❌ 调试复杂 — 哪个阶段引入了错误？ |
| ✅ 易于交换单个阶段 | ❌ 阶段之间的错误传播 |
| ✅ 往返验证捕捉幻觉 | ❌ 超过 2-3 个阶段后收益递减 |

## 配合良好的方案

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST 作为验证阶段
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 在生成阶段进行字典注入
- **[Coached LLM Prompting](./coached-llm-prompting)** — 在一个或多个阶段进行指导

## 另请参阅

- [Eval Harness](/docs/network/specifications/harness) — 测试工具测量端到端管道输出
- [Run Card Specification](/docs/network/specifications/run-card) — 延迟和成本按条目记录
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
