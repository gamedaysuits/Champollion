---
sidebar_position: 3
title: "构造语言、文字系统与正字法"
---

# 构造语言、文字系统与正字法

champollion 通过 LLM 寄存器和确定性文字转换器为构造语言提供一流支持。本指南涵盖构造语言支持的工作原理、所需字体以及如何添加自己的构造语言。

:::tip[为什么人造语言很重要]
人造语言不仅仅是新奇之物——它们使用与真实服务不足语言完全相同的基础设施。质量门控、教练系统和脚本转换管道对克林贡语和平原克里语的工作方式完全相同。如果你的人造语言管道有效，你的低资源语言管道也会有效。
:::

---

## 支持的构造语言

| 语言 | 代码 | 文字转换器 | 所需字体 |
|----------|------|:----------------:|:-------------:|
| 克林贡语 | `tlh` | ✅ 罗马字 → pIqaD | PUA 字体（例如 pIqaD qolqoS） |
| 辛达林语（托尔金精灵语） | `x-elvish-s` | ✅ 拉丁字 → 腾瓦尔文 | CSUR PUA 字体 |
| 氪星语 | `x-kryptonian` | ✅ 拉丁字 → 氪星文 | PUA 字体 |
| 海盗英语 | `x-pirate` | ❌ 仅寄存器 | 无 |
| 莎士比亚英语 | `x-shakespeare` | ❌ 仅寄存器 | 无 |
| 尤达语 | `x-yoda` | ❌ 仅寄存器 | 无 |

构造语言代码按照 BCP-47 私有用途约定使用 `x-` 前缀，克林贡语除外（`tlh`），它拥有由 SIL International 分配的 [ISO 639-3](https://iso639-3.sil.org/code/tlh) 代码。

---

## Unicode、PUA 和字体要求

### 私有使用区

克林贡语（pIqaD）、辛达林语（腾瓦尔文）和氪星语使用 Unicode **私有使用区（PUA）** 字符。PUA 是 U+E000–U+F8FF 范围——这些码位**没有标准分配**。[ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) 维护虚构文字的社区约定映射，但这些不是 Unicode 标准的一部分。

实际含义：

- 没有加载正确字体的 PUA 文本呈现为**空框**（□□□）
- 不同字体可能将不同的字形映射到相同的 PUA 码位
- champollion 不捆绑 PUA 字体——你必须自己加载它们
- 系统字体永远不会呈现这些字符

### 按文字系统的 PUA 范围

| 文字系统 | PUA 范围 | CSUR 参考 |
|--------|-----------|---------------|
| 克林贡语（pIqaD） | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| 腾瓦尔文（精灵语） | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| 氪星文 | 因字体而异 | 无 CSUR 标准 |

### 加载 PUA 网络字体

champollion 包含一个内置命令来下载和管理 PUA 网络字体：

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

`fonts install` 命令从经过验证的开源仓库下载：

| 字体 | 文字系统 | 许可证 | 来源 |
|------|--------|---------|--------|
| pIqaD qolqoS | 克林贡语 | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | 腾瓦尔文 | GNU GPL v3（含字体例外） | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *（用户提供）* | 氪星文 | 因情况而异 | 无可用开源 PUA 字体 |

输出目录从你的项目结构自动检测（Docusaurus → `static/fonts/`，Hugo → `static/fonts/`，默认 → `public/fonts/`）。使用 `--dir` 覆盖。

如果你更喜欢手动管理字体，在你的 CSS 中添加 `@font-face` 规则：

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[Unicode 支持不保证]
Unicode 联盟已[明确拒绝](https://www.unicode.org/faq/private_use.html)在标准中编码虚构脚本。PUA 分配由社区维护，可能在字体实现之间产生冲突。始终指定你的项目使用的确切字体，并在浏览器中测试渲染。
:::

---

## 文字转换器

### 工作原理

champollion 的书写系统转换是一个**翻译后置钩子，仅在配置要求时才会应用**：

1. LLM 将文本翻译为**工作书写系统**（通常是拉丁字母或 SRO）
2. [质量门禁](/docs/concepts/quality-gate)验证输出结果
3. 如果该语言对的 `script:` 设置选择了显示书写系统，确定性转换器将对已验证的文本进行转换 —— 包含转换器无法映射的字母的值将完整保留在工作书写系统中，并针对每个键（key）发出警告
4. 结果写入磁盘

这种两步方法有效，因为 LLM 在使用基于拉丁字的文字时产生更好的输出。确定性转换器保证正确的文字输出，无需依赖模型的（通常不可靠的）文字知识。

步骤 3 是否运行完全是项目级别的决定 —— 参见 [书写系统转换](/docs/getting-started/configuration#script-conversion)。PUA 显示书写系统（pIqaD、Tengwar、Kryptonian）默认关闭，因为如果没有专用字体，它们将无法渲染出任何内容；crk 和 sr 完全没有默认设置，因为它们的两种正字法都是真实存在的，选择权在于项目本身。

### 全部五个转换器

champollion 附带五个内置文字转换器：

#### 平原克里语：SRO → 音节文字（`crk`）

标准罗马正字法到加拿大土著音节文字。

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

长元音使用长音符/抑扬符：ê、î、ô、â。转换器处理所有 SRO 变音符号并将其映射到正确的音节字符。参见[支持低资源语言](/docs/network/community/low-resource-languages)了解完整的克里语管道。

#### 塞尔维亚语：拉丁字 → 西里尔字（`sr`）

塞尔维亚语的确定性拉丁字到西里尔字转换。

```
Input:  "zdravo"
Output: "здраво"
```

这处理完整的塞尔维亚字母映射，包括二合字母（lj → љ、nj → њ、dž → џ）。

#### 克林贡语：罗马字 → pIqaD（`tlh`）

Marc Okrand 的罗马字系统到 pIqaD PUA 字符。

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### 辛达林语：拉丁字 → 腾瓦尔文（`x-elvish-s`）

托尔金的辛达林模式腾瓦尔文映射。

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### 氪星语：拉丁字 → 氪星文（`x-kryptonian`）

粉丝词汇表氪星文文字映射。

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### 触发转换器

将 `script` 字段设置为你希望写入的正字法的 ISO 15924 代码：

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

没有此设置，任何内容都不会被转换。对于 `crk` 和 `sr`，该字段是**必填项** —— 它们的两种正字法都是真实存在的，且 `sync` 拒绝替你做出选择。对于 PUA 区域设置，它是覆盖默认罗马化（romanization）的自选项。参见 [书写系统转换](/docs/getting-started/configuration#script-conversion)。

---

## 多文字系统语言

某些真实语言使用多个活跃文字系统：

| 语言 | 书写系统 | champollion 处理方式 |
|----------|---------|-----------------|
| 塞尔维亚语 | 拉丁字母 + 西里尔字母 | 单一区域设置，显式选择：`"script": "Cyrl"` 进行转换，`"script": "Latn"` 保留拉丁字母 |
| 平原克里语 | SRO（拉丁字母） + 音节文字 | 单一区域设置，显式选择：`"script": "Cans"` 或 `"script": "Latn"` |
| 中文 | 简体 + 繁体 | 独立的区域设置代码（`zh` 与 `zh-TW`），具有不同的语域 |

对于两种书写系统服务于同一受众的语言（塞尔维亚语、平原克里语），使用单一区域设置加上显式的 `script` 选择，可保持单一的翻译流水线。对于书写系统服务于不同受众的语言（中国大陆的简体中文，台湾/香港的繁体中文），请使用独立的区域设置代码。

---

## 正字法注记

寄存器不仅仅是语调——它们携带**正字法指令**，引导 LLM 朝向正确的书写约定。

### 正式称呼形式

champollion 的内置寄存器包括每种语言文化上适当的正式称呼：

| 语言 | 正式形式 | 寄存器指令 |
|----------|------------|---------------------|
| 德语 | Sie | `Use Sie-form for formal address` |
| 法语 | vous | `Use vous-form` |
| 俄语 | вы | `Professional register with вы-form` |
| 土耳其语 | siz | `Professional register with siz-form` |
| 韩语 | 합쇼체 | `Formal Korean (합쇼체)` |
| 日语 | です/ます | `Polite professional register (です/ます form)` |
| 波兰语 | Pan/Pani | `Professional register with Pan/Pani form` |

### 性别包容性写作

每个语言卡都有一个 `gender.inclusiveGuidance` 字段，包含特定于语言的建议。这被单独注入到 LLM 翻译提示中，与寄存器预设分开，因此无论用户选择哪个正式性预设，它都一致适用：

- **法语**：包容性写作，带间隔号符号（例如"Connecté·e"）
- **德语**：冒号符号（例如"Benutzer:innen"）
- **西班牙语**：首选性别中立重组；斜杠符号（例如"usuario/a"）作为备选

对于其语言卡中没有特定指导的语言（例如韩语、构造语言），系统回退到通用规则：*"优先使用性别中立形式或最包容的可用选项。"*

### RTL 文字要求

阿拉伯语、希伯来语、波斯语和乌尔都语寄存器都注明从右到左要求：`Ensure text reads naturally in RTL layout contexts.`

### 覆盖任何寄存器

每个寄存器都是一个配置值——覆盖它以匹配你的项目的声调：

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

参见[配置](/docs/getting-started/configuration)了解完整的配置参考。

---

## 添加新构造语言

### 逐步说明

1. **选择 BCP-47 私有用途代码**：使用 `x-` 前缀（例如 `x-dothraki`、`x-valyrian`）。

2. **添加到你的配置**：

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **（可选）添加文字转换器**：如果你的构造语言使用非拉丁显示文字，在 `lib/scripts.js` 中添加转换器并在 `SCRIPT_CONVERTERS` 中注册它。

4. **测试**：运行 `champollion sync --dry` 预览翻译而不写入文件。

5. **检查质量门**：[质量门](/docs/concepts/quality-gate)可能需要为你的构造语言调整——特别是如果你的构造语言使用 PUA 字符，`requireNonLatin` 检查可能需要调整。

:::note[人造语言质量取决于 LLM 知识]
LLM 只能翻译成它在训练数据中见过的人造语言。文档完善的人造语言（克林贡语、辛达林语、多斯拉克语）效果很好。晦涩或新创造的人造语言可能会产生不一致的结果。使用[教练数据](/docs/concepts/coaching-data)来提高质量。
:::

---

## 另请参阅

- [支持的语言](/docs/reference/supported-languages)——完整的语言表，包含方法可用性
- [文字转换器](/docs/concepts/script-converters)——转换管道的技术细节
- [翻译方法](/docs/guides/translation-methods)——每种翻译方法的工作原理
- [配置](/docs/getting-started/configuration)——配置参考，包括语言和寄存器设置
- [支持低资源语言](/docs/network/community/low-resource-languages)——应用于真实低资源语言的相同基础设施
