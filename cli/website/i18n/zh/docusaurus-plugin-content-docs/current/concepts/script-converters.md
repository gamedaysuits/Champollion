---
sidebar_position: 6
title: "脚本转换器"
---

# 脚本转换器

脚本转换器是确定性的、无需 LLM 的后翻译钩子，可将文本从一种书写系统转换为另一种。它们支持"翻译一次，多脚本渲染"的工作流——你翻译成一种可用的脚本（通常是拉丁字母），然后在同步时自动转换为显示脚本。

## 为什么需要脚本转换器？

某些语言对同一种口语使用多种脚本：

- **Plains Cree**：SRO（拉丁字母）用于编辑 → 音节文字（ᓀᐦᐃᔭᐍᐏᐣ）用于显示
- **塞尔维亚语**：拉丁字母用于国际使用 → 西里尔字母用于国内使用
- **克林贡语**：罗马化用于输入 → pIqaD（  ）用于显示

直接翻译成非拉丁脚本会产生问题：LLM 会产生字符幻觉、JSON 文件变得难以版本控制、diff 工具无法比较更改。脚本转换器通过在版本控制友好的脚本中保持翻译，并在同步时确定性地转换来解决这个问题。

## 可用的转换器

Champollion 内置五个脚本转换器：

| 语言代码 | 来源 | 目标 | 类型 | 需要字体？ |
|--------|------|----|------|----------------|
| `crk` | SRO（标准罗马正字法） | Cree 音节文字 | 确定性 | 否 — 原生 Unicode |
| `sr` | 拉丁字母 | 西里尔字母 | 确定性 | 否 — 原生 Unicode |
| `tlh` | 罗马化 | pIqaD | 确定性 | 是 — PUA U+F8D0–F8FF |
| `x-elvish-s` | 拉丁字母 | Tengwar（贝勒瑞安德模式） | 确定性 | 是 — PUA U+E000–E07F |
| `x-kryptonian` | 拉丁字母 | 氪星文 | 基于字体的密码 | 是 — PUA U+E100–E119 |

### 确定性 vs. 基于字体

- **确定性转换器**（Cree、塞尔维亚语、克林贡语、Tengwar）使用语言学规则执行真正的字符到字符映射。输出包含实际的 Unicode 字符。
- **基于字体的转换器**（氪星文）是 1:1 替换密码，其中输出是 Unicode PUA 字符，只有在加载特定字体时才能正确渲染。

## 工作原理

脚本转换器在翻译后作为后处理步骤运行。管道如下：

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

例如，Plains Cree：
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### 贪心左到右匹配

所有转换器使用相同的算法：在每个字符位置，首先尝试最长的可能匹配，然后逐步尝试更短的匹配。与任何模式都不匹配的字符（空格、标点符号、数字）保持不变。

这正确处理二合字母和三合字母：
- 克林贡语：`tlh` → 单个 pIqaD 字符（不是 `t` + `l` + `h`）
- 塞尔维亚语：`nj` → `њ`（不是 `н` + `ј`）
- Cree：`twê` → 单个音节文字（不是 `t` + `w` + `ê`）

## 使用脚本转换器

转换是一项**配置决定，绝非自动进行**（自 0.3.0 版本起——早期版本会无条件进行转换，这导致向那些字体预期为拉丁转写的项目输出了无法渲染的 PUA 文本）：

- **crk 和 sr 拥有两种实际的正字法**（SRO/音节文字，拉丁/西里尔字母）。这里没有默认设置：`champollion init` 会询问要写入哪一种，而 `sync` 在配置明确说明之前会拒绝运行。Champollion 不会替社区选择书写系统。
- **tlh、x-elvish-s 和 x-kryptonian 默认使用罗马化转写**——它们的显示文字属于私用区（Private Use Area），如果没有特殊字体则无法渲染。需要显式选择启用。

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

当 champollion 将 `en:crk` 与 `"script": "Cans"` 同步时，翻译会以 SRO（门控验证的工作文字）生成，然后在写入 `crk.json` 之前转换为音节文字。如果使用 `"script": "Latn"`——或者对于完全没有 `script:` 的 tlh——工作文字即为交付物，不会进行任何转换。

转换器无法映射的字母（克林贡语没有 `d`、`c`、`f`、`g`、`i`、`k`、`s`、`x`、`z`——因此 "GitHub" 无法完全转换）会在工作文字中保留**完整值**，而不是混合使用不同的文字，并会发出包含这些字母名称的警告。请使用 [`scriptFallback`](/docs/getting-started/configuration#script-fallback) 声明你自己的转写规则。

要撤销在无条件转换时期发生的转换，请运行 [`champollion repair-script`](/docs/getting-started/configuration#repair-script)；如果在关闭转换的地方发现了 PUA，`champollion integrity` 将会失败。

### 检查转换器状态

```bash
npx champollion status
```

状态输出会显示每个语言对已决定的文字方案——将要写入的内容，以及是否有可用但未启用的转换器。

## Web 字体要求

三个转换器输出需要自定义 web 字体的 Unicode 私有使用区域（PUA）字符：

### 克林贡语（pIqaD）

安装 CSUR 兼容的 pIqaD 字体（例如"pIqaD qolqoS"或"Klingon pIqaD HaSta"）：

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar（辛达林语）

安装 CSUR 兼容的 Tengwar 字体（例如"Tengwar Formal CSUR"、"Tengwar Annatar"）：

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### 氪星文

安装映射到 PUA 码点 U+E100–E119 的氪星文字体：

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[Kryptonian 的替代方案]
由于 Kryptonian 是纯 A-Z 密码，你可以完全跳过脚本转换器，直接通过 CSS 将字体应用于拉丁文本。这对于网页部署通常更简单——只需提供 Kryptonian 字体并在相关元素上设置 `font-family`。
:::

## 添加自定义转换器

要为新语言添加转换器，编辑 `lib/scripts.js`：

1. **创建转换映射** — 一个有序的 `[from, to]` 对数组，最长序列优先
2. **创建转换器函数** — 一个贪心左到右扫描器（使用 `sroToSyllabics` 作为模板）
3. **在 `SCRIPT_CONVERTERS` 对象中注册它**，以语言代码作为键
4. **添加 `script` 字段**到语言在 `registers.js` 中的注册条目

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## 另请参阅

- [Conlangs、脚本与正字法](/docs/guides/conlangs-scripts-orthography) — PUA 字体、Unicode、添加新转换器
- [质量门](/docs/concepts/quality-gate) — 在脚本转换前运行的验证
- [支持的语言](/docs/reference/supported-languages) — 哪些语言具有脚本转换器
- [支持低资源语言](/docs/network/community/low-resource-languages) — SRO→音节文字的实际应用
- [Cookbook：FST 门控管道](/docs/network/tutorials/fst-gated-pipeline) — 多阶段管道中的脚本转换
