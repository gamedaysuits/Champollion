---
sidebar_position: 2
title: "Cookbook: 指导式 LLM 提示词"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# 教练式 LLM 提示

> **核心思想：** 将语法规则、双语词典和风格注记直接注入 LLM 的系统提示中。无需训练、无需微调——只需结构化的语言学知识来引导输出朝向有效的翻译。

:::info[这是一份食谱，不是完整的实现]
本指南概述了该方法及其关键设计决策。请根据您的语言对、可用资源和评估目标进行调整。
:::

## 何时使用此方案

- 你对目标语言有**语言学知识**（语法规则、词典条目、风格偏好），但没有足够的平行数据用于微调
- 你想要**快速迭代**——提示变更在几秒内部署，无需重新训练
- 目标语言有 LLM 经常出错的**已知模式**（性数一致、文字约定、正式程度）
- 你想要对标教练式提示与基线，并迭代改进有效的方法

## 工作原理

1. **汇编教练数据** —— 将语法规则、双语词典和风格注记组织成结构化的 JSON 文件
2. **配置寄存器** —— 一个系统提示前缀，设置语言、文字和语调
3. **运行工具** —— 教练数据被注入到每个 LLM 提示中
4. **审查失败** —— 查看质量门拒绝的内容，添加规则以解决模式
5. **迭代** —— 每个教练文件修订都是一个新实验；工具跟踪所有实验

## 教练数据结构

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## 关键设计决策

**规则特异性 vs. 上下文窗口：** 更多规则为 LLM 提供更多指导，但会占用实际翻译的上下文窗口。从 5–10 条高影响规则开始，仅当你看到特定失败模式时才添加更多。

**词典覆盖范围：** 你不需要完整的词典——专注于 LLM 一致出错的术语。即使 20–30 个强制术语也能显著提高一致性。

**规则顺序很重要：** 将最重要的规则放在最前面。LLM 对早期指令的关注度更高。

## 运行实验

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## 优缺点

| | |
|---|---|
| ✅ 零训练成本 | ❌ 质量上限受 LLM 基础知识限制 |
| ✅ 即时迭代（改变提示 → 重新运行） | ❌ 上下文窗口限制了能容纳多少教练数据 |
| ✅ 适用于任何 LLM 提供商 | ❌ 规则可能冲突——调试提示交互是一门艺术 |
| ✅ 透明——你可以准确读到 LLM 看到的内容 | ❌ 不创建新知识，只引导现有知识 |

## 配合良好的方案

- **[FST-Gated Pipeline](./fst-gated-pipeline)** —— 教练 + 形态学验证捕捉单独教练遗漏的内容
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** —— 强制术语是教练的一种形式
- **[Few-Shot Prompting](./few-shot-prompting)** —— 示例 + 规则结合比单独使用任一方法更强大

## 另请参阅

- [Method Interface](/docs/network/specifications/methods) —— 教练数据格式和 TranslationMethod 协议
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) —— 完整背景
- [Eval Harness](/docs/network/specifications/harness) —— 如何运行实验
