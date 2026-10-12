---
sidebar_position: 7
title: "Cookbook: 基于规则 + LLM 混合方法"
---

# 基于规则 + LLM 混合方案

> **核心思想：** 对于你确信正确的模式（形态词缀、数字格式、已知短语结构），使用确定性语言学规则；对于其他内容，交由 LLM 处理。规则在适用范围内优先于 LLM；LLM 填补空白。

:::info[这是一份食谱，不是完整的实现]
本指南概述了混合架构。具体规则完全取决于您的目标语言的语法和可用的语言资源。
:::

## 何时使用此方案

- 你在目标语言方面具有**深厚的语言学专业知识**（或能获得语言学家的支持）
- 某些翻译模式是**确定性的** — 你能确定正确的输出
- LLM **持续失败**于特定模式（数字格式、敬语、粘着语特征）
- 你希望对高风险模式**保证正确性**，同时保持其余部分的流畅性

## 工作原理

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **定义规则** — 正则表达式、FST 查询、已知翻译的查找表
2. **预处理** — 从源文本中识别并提取规则匹配的片段
3. **LLM 翻译** — 剩余文本，以规则输出作为约束
4. **合并** — 重新组装翻译，优先使用规则输出
5. **验证** — 可选的 FST/规则检查合并后的结果

## 示例：数字和日期规则

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## 关键设计决策

**规则优先级：** 当规则和 LLM 对同一片段都产生输出时，哪个优先？规则应在**正确性关键**的模式中优先。LLM 应在**流畅性关键**的模式中优先。

**粒度：** 词级规则（字典查询）vs. 短语级规则（习语映射）vs. 结构级规则（句子重排）。从词级开始；随着你识别模式，逐步添加短语级规则。

**规则维护：** 每条规则都是一项维护义务。宁可采用少量高置信度规则，也不要采用大量近似规则。如果你不确定某条规则是否正确，就交由 LLM 处理。

## 优缺点

| | |
|---|---|
| ✅ 规则适用范围内保证正确性 | ❌ 需要深厚的语言学专业知识 |
| ✅ 透明 — 规则可读且可审计 | ❌ 规则/LLM 接缝可能产生不自然的输出 |
| ✅ 规则速度快（无 API 成本） | ❌ 维护负担随规则数量增加而增长 |
| ✅ 渐进式 — 随着学习添加规则 | ❌ 难以处理规则边界处的屈折变化 |

## 配合良好的方案

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST 作为特定类型的规则引擎
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — 字典查询是一条简单规则
- **[Coached LLM Prompting](./coached-llm-prompting)** — 指导处理软性偏好，规则处理硬性要求

## 另请参阅

- [GiellaLT](https://giellalt.github.io/) — 100+ 种语言的开源 FST 基础设施
- [Apertium](https://www.apertium.org/) — 具有双语词典的基于规则的机器翻译平台
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
