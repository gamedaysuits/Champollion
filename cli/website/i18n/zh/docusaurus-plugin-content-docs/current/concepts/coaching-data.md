---
sidebar_position: 5
title: "教练数据"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# 教练数据

教练数据是 champollion 用于教导大语言模型处理其训练数据中不存在的语言的机制。通过在每个翻译请求中提供语法规则、词典和风格说明，你可以将通用大语言模型转变为任何语言的上下文感知翻译器——包括完全没有现有机器翻译支持的语言。

## 工作原理

当你将一个语言对的方法设置为 `llm-coached` 时，champollion 会从 `.champollion/coaching/<locale>.json` 加载教练文件，并将其内容作为系统消息的一部分注入到每个大语言模型提示中。大语言模型会在翻译请求旁边看到你的语言学规则，从而生成遵循你的语法和术语的输出，而不是猜测。

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

教练内容有两种类型：

1. **结构化教练数据**（`llm-coached` 方法）— JSON 格式的语法规则、词典和风格说明。从 `.champollion/coaching/<locale>.json` 或插件的 `coaching/` 目录加载。
2. **自由文本教练提示**（`coachingFile` 配置字段）— 一个纯文本文件，包含注入到系统提示中的额外指导。适用于任何大语言模型方法，不仅限于 `llm-coached`。通过配置中的 `coachingFile` 或 CLI 中的 `--coaching-file` 设置。

两者可以一起使用。评估工具使用完全相同的提示结构——因此你的基准分数反映你的实际生产提示。

由于教练数据是系统消息的一部分，它受益于**提示缓存**——Anthropic 和 Google 等提供商会缓存重复的系统前缀，因此你只需为每个会话支付一次教练上下文费用，而不是每个批次一次。

## 教练文件格式

在 `.champollion/coaching/` 中为每个语言环境创建一个 JSON 文件：

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### 字段

| 字段 | 类型 | 必需 | 描述 |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | 否 | 注入到系统提示中的语法规则数组。每条规则应该是大语言模型可以遵循的简洁、可操作的指令。 |
| `dictionary` | `object` | 否 | 英文术语 → 目标语言术语的键值映射。用于大语言模型不知道的特定领域词汇。 |
| `style_notes` | `string` | 否 | 自由格式的风格指导（寄存器、语调、正式性约定）。 |

所有字段都是可选的——你可以从仅有词典开始，然后在优化时添加语法规则。

## 回退行为

如果一个语言对配置为 `llm-coached` 但该语言环境不存在教练文件，champollion **会回退到标准 `llm` 方法**并显示控制台警告：

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

这意味着你可以安全地全局设置 `"defaultMethod": "llm-coached"`——具有教练数据的语言将使用它，其余的将获得标准大语言模型翻译而不会出错。

## 何时使用教练

| 场景 | 推荐方法 |
|----------|-------------------|
| 第一级语言（法语、西班牙语、德语） | `llm` 或 `google-translate` — 大语言模型已经很了解这些语言 |
| 第二级语言（韩语、土耳其语、泰语） | `llm` 加上寄存器 — 大语言模型通过风格指导可以充分处理这些语言 |
| 第三级语言（平原克里语、约鲁巴语、克丘亚语） | `llm-coached` — 大语言模型需要语法规则和词典 |
| 人造语言（克林贡语、辛达林语、氪星语） | `llm-coached` — 大语言模型有一些训练数据但需要更正 |

## 构建优质教练数据

### 语法规则

将规则写成**指令**，而不是描述。大语言模型遵循指令的效果比解释语言学理论要好。

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### 词典

专注于**特定领域的术语**，即大语言模型会出错或编造的术语。不要费力处理大语言模型已经能处理的常见词——专注于特定于你的应用程序 UI 的术语。

### 风格说明

明确说明寄存器、正式性和约定：

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## 测试教练翻译

使用 [MT 评估工具](https://github.com/gamedaysuits/Champollion) 根据参考语料库对你的教练翻译进行基准测试：

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

这为你提供 chrF++、BLEU 和精确匹配分数。创建多个教练文件版本并进行比较——客观指标胜过主观审查。

---

## 另见

- [翻译方法](/docs/guides/translation-methods) — llm-coached 方法
- [支持低资源语言](/docs/network/community/low-resource-languages) — 教练实践
- [插件规范](/docs/reference/plugin-spec) — 在插件中打包教练数据
- [质量门](/docs/concepts/quality-gate) — 教练翻译如何被验证
- [配置](/docs/getting-started/configuration) — 每个语言对的教练配置
