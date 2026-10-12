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

## 运作方式

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

1. **结构化辅导数据**（`llm-coached` 方法）——JSON 格式的语法规则、词典和风格说明。从 `.champollion/coaching/<locale>.json` 或插件的 `coaching/` 目录加载。其中的 `dictionary` 同时也是项目的术语表：每个 LLM 方法（`llm`、`openai`、`anthropic`、`gemini`、`local`）都会获知每个批次所包含的术语表词条，DeepL 会将其作为术语表发送，并且当任何方法的输出遗漏了某个词条时，sync 都会发出警告。语法规则和风格说明仅由 `llm-coached` 读取——支持任何提供商（`"provider": "openai"`、`"local"`、……）。
2. **自由文本辅导提示词**（`coachingFile` 配置字段）——注入到系统提示词中的附加指导纯文本文件。适用于任何 LLM 方法，而不仅限于 `llm-coached`。可通过配置中的 `coachingFile` 或 CLI 中的 `--coaching-file` 进行设置。

两者可以一起使用。评估工具使用完全相同的提示结构——因此你的基准分数反映你的实际生产提示。

由于教练数据是系统消息的一部分，它受益于**提示缓存**——Anthropic 和 Google 等提供商会缓存重复的系统前缀，因此你只需为每个会话支付一次教练上下文费用，而不是每个批次一次。

## 教练文件格式

在 `.champollion/coaching/` 中为每个 locale 创建一个 JSON 文件。下面的示例
针对 `qaa` 下的一种虚构语言，该私有代码不属于任何真实语言：
其中的每条规则和术语都是占位替代内容，并非关于任何语言的实际事实。
请编写您自己的内容，最好与该语言的使用者共同完成，并从可指明出处的来源中提取词典术语。

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
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
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
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
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### 词典

专注于**特定领域的术语**，即大语言模型会出错或编造的术语。不要费力处理大语言模型已经能处理的常见词——专注于特定于你的应用程序 UI 的术语。

**所有方法都会检查词典。** 无论采用哪种方法翻译
键值对——托管模型、通过 `local` 运行的自有模型、DeepL、`api`
端点——`champollion sync` 都会对照词典检查每个翻译后的字符串，并打印
`[TERM]` 警告，指出未使用的任何术语。
只有 `llm-coached`（在提示词中）和 `deepl`（作为 DeepL 术语表）会在翻译时同时
*应用* 它；对于其他方法，该检查会提示您需要修复哪些字符串，例如使用 `champollion sync --method llm-coached
--redo keys:<key>`。

### 风格说明

明确说明寄存器、正式性和约定：

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## 测试教练翻译

使用 [MT 评估工具](https://github.com/gamedaysuits/Champollion) 根据参考语料库对你的教练翻译进行基准测试：

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

# Score the results
mt-eval test eval/logs/run_*.json
```

这为你提供 chrF++、BLEU 和精确匹配分数。创建多个教练文件版本并进行比较——客观指标胜过主观审查。

---

## 另请参阅

- [翻译方法](/docs/guides/translation-methods) — llm-coached 方法
- [支持低资源语言](/docs/network/community/low-resource-languages) — 教练实践
- [插件规范](/docs/reference/plugin-spec) — 在插件中打包教练数据
- [质量门](/docs/concepts/quality-gate) — 教练翻译如何被验证
- [配置](/docs/getting-started/configuration) — 每个语言对的教练配置
