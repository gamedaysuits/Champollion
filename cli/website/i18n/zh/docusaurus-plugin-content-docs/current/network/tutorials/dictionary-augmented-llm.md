---
sidebar_position: 4
title: "Cookbook: 字典增强型 LLM"
---

# 字典增强型大语言模型

> **核心思想：** 从双语字典中强制使用已知的、经过验证的特定术语翻译，让大语言模型处理句子结构和未知词汇。字典提供正确性的锚点；大语言模型提供流畅性。

:::info[这是一份食谱，不是完整的实现]
本指南概述了该方法。具体的字典匹配和注入策略将取决于您的语言对和可用的词汇资源。
:::

## 何时使用此方案

- **存在双语字典** 用于你的语言对（即使很小）
- 大语言模型 **持续幻觉关键术语** — 编造不存在的词汇
- 你需要 **术语一致性** 跨越翻译（同一词汇始终以相同方式翻译）
- 你在翻译 **特定领域内容** 其中标准大语言模型翻译有误（法律、医学、教育）

## 运作方式

1. **加载双语字典** — 键→值对，将源语言术语映射到经过验证的目标语言翻译
2. **将源文本与字典匹配** — 识别输入中具有已知翻译的术语
3. **将匹配项注入提示** — 告诉大语言模型"这些术语必须按如下方式翻译"
4. **大语言模型生成翻译** — 以字典约束作为硬性要求
5. **后处理** — 验证字典术语出现在输出中；如果没有则重试

## 字典格式

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## 提示结构

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## 关键设计决策

**匹配策略：** 精确匹配最简单。词元化匹配（"teachers"匹配"teacher"）覆盖更多，但需要源语言词元化工具。模糊匹配有误报风险。

**屈折处理：** 在多综合语言中，字典形式可能需要屈折以适应句子。你可以提供词根并让大语言模型进行屈折，或提供多个屈折形式。[FST](./fst-gated-pipeline) 可以验证结果。

**冲突解决：** 如果大语言模型忽略字典术语怎么办？选项：(a) 用更强的指令重试，(b) 通过字符串替换进行后处理，(c) 接受并标记供审查。

## 优缺点

| | |
|---|---|
| ✅ 消除已知术语的幻觉 | ❌ 字典覆盖范围总是不完整 |
| ✅ 保证关键词汇的一致性 | ❌ 屈折/共轭可能与句子上下文不匹配 |
| ✅ 易于审计和更新 | ❌ 过度约束可能产生不自然的输出 |
| ✅ 字典是可重用资产 | ❌ 首先需要存在字典 |

## 字典查找位置

- **[itwêwina](https://itwewina.altlab.app/)** — Plains Cree–英语（基于 FST；morphodict 平台是开源的——但词典内容本身未开放授权）
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — 详尽的 Plains Cree 参考资料（里贾纳大学出版社）
- **[Apertium](https://www.apertium.org/)** — 涵盖数十种语言对的双语词典
- **[Giellatekno](https://giellalt.github.io/)** — 萨米语、乌拉尔语及其他少数民族语言的词典
- 社区创建的词汇表、教育材料和术语表

## 配合良好的方案

- **[指导式大语言模型提示](./coached-llm-prompting)** — 字典条目是一种指导数据形式
- **[FST 门控管道](./fst-gated-pipeline)** — FST 验证字典术语是否正确屈折
- **[基于规则 + 大语言模型混合](./rule-based-hybrid)** — 确定性字典查找作为一个规则层

## 另请参阅

- [支持低资源语言](/docs/network/community/low-resource-languages) — 完整背景
- [方法接口](/docs/network/specifications/methods) — 方法的结构方式
