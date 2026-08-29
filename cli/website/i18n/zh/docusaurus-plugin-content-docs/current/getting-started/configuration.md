---
sidebar_position: 3
title: "配置"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# 配置

Champollion 开箱即用——它会自动检测项目中的区域设置文件、格式和目标语言。如需更多控制，请在项目根目录创建 `champollion.config.json`，或运行：

```bash
npx champollion init
```

## 完整配置参考

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen 尚未实现]
配置加载器可以识别并保留 `typegen` 配置块，但 TypeScript 类型生成尚未实现。这是计划功能的占位符。设置这些值无效。
:::


### 字段

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `version` | `number` | `3` | 配置架构版本。始终为 `3`。 |
| `inputLocale` | `string` | `"en"` | 源语言代码 (BCP 47)。 |
| `localesDir` | `string` | `"./locales"` | 本地化文件路径。Champollion 会扫描此目录。 |
| `contentDir` | `string` | `null` | Hugo 内容目录。启用 Markdown 正文翻译。 |
| `translatableFields` | `string[]` | `null` | 覆盖内容翻译的默认可翻译 frontmatter 字段。`null` 使用内置默认值（`title`、`description`、`summary`）。 |
| `format` | `string` | `"auto"` | 文件格式：`json`、`toml`、`yaml` 或 `auto`（根据扩展名检测）。 |
| `model` | `string` | `"google/gemini-3.5-flash"` | LLM 方法的默认模型。接受完整的 OpenRouter 标识符（`provider/model`）或来自 `shared/model-aliases.json` 的简短别名（例如 `gemini-flash`）。直接提供商使用裸名称（例如 `gpt-4o`）。 |
| `temperature` | `number` | `0.3` | LLM 温度值 (0.0–2.0)。值越低 = 结果越具确定性。 |
| `defaultMethod` | `string` | `"llm"` | 默认翻译方法：`llm`、`llm-coached`、`google-translate`、`deepl`、`microsoft-translator`、`libretranslate`、`openai`、`anthropic`、`gemini`、`api`。可被 `--method` CLI 标志覆盖。 |
| `batchSize` | `number` | `80` | 每个翻译批处理的键数量。值越高 = API 调用越少，但提示词（prompt）越大。 |
| `coachingFile` | `string` | `null` | 自由文本辅导提示词（coaching prompt）文件的路径（相对于项目根目录）。内容在启动时读取，并作为 `Coaching guidance:` 块注入到系统提示词中。 |
| `promptContext` | `string` | `null` | 注入到系统提示词中的应用上下文（context）字符串（例如，“电子商务产品描述”）。帮助模型根据你的领域定制翻译。 |
| `jsonConcurrency` | `number` | `200` | JSON 键同步的最大并行本地化翻译数。可被 `--json-concurrency` CLI 标志覆盖。 |
| `contentConcurrency` | `number` | `48` | 内容（Markdown/MDX）翻译的最大并行 API 调用数。可被 `--content-concurrency` CLI 标志覆盖。 |
| `fallbackPrefix` | `string` | `"[EN] "` | `audit` 和 `verify` 用于检测先前运行中遗留的未翻译值的标记前缀。Champollion 不会写入此前缀——它仅读取该前缀用于检测。 |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | API 密钥的环境变量名称。覆盖以使用自定义环境变量名称。 |
| `minContentRetention` | `number` | `0.35` | 在[内容删除检查](/docs/concepts/quality-gate)参考其第二个信号之前，输出必须保留的源文本字母/数字的比例。也可以按语言对和按语言进行设置。 |
| `noTranslate` | `string[]` | `[]` | 其值被原样复制到每个本地化语言的点路径（dot-path）键和 glob 模式。参见[不翻译键](#no-translate)。也接受 `skipKeys`。 |
| `noTranslateUrls` | `boolean` | `true` | 将仅包含 `scheme://` URL 的源值视为不翻译。设置为 `false` 可将 URL 值的键发送到翻译后端。 |
| `baseUrl` | `string` | `""` | 用于生成 SEO 产物（hreflang、站点地图、JSON-LD）的基础 URL。 |
| `pairs` | `object` | `{}` | 按语言对覆盖方法、模型和质量设置。参见[语言对配置](#pair-configuration)。 |
| `languages` | `object` | `{}` | 按语言覆盖设置。参见[语言配置](#language-configuration)。 |
| `lint.srcDir` | `string` | `null` | 用于 lint 扫描的源目录。`null` = 从框架自动检测。 |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | 要从 lint 中排除的 glob 模式。 |
| `lint.minLength` | `number` | `2` | 标记为硬编码的最小字符串长度。 |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | 用于生成 hreflang 标签的 URL 模式模板。 |
| `seo.pages` | `string[]` | `null` | 用于 SEO 的显式页面列表。`null` = 从本地化键自动检测。 |
| `typegen.output` | `string` | `null` | 生成的 TypeScript 类型的输出路径。`null` = 禁用。 |
| `typegen.autoGenerate` | `boolean` | `false` | 每次同步后自动重新生成类型。 |

## 不翻译键 {#no-translate}

有些值在每种语言中只有一种正确的呈现方式：URL、仓库路径、包名、产品标识符。`https://example.org/paper` 的正确翻译就是 `https://example.org/paper`。

Champollion 的[质量门禁](/docs/concepts/quality-gate)会拒绝源文本回显（source-echo）——即与源文本完全相同的翻译——因为这通常意味着模型拒绝执行翻译工作。对于这些键，这会导致正确的答案反而被拒绝，并且模型无法生成任何能通过门禁的输出。较弱的模型会学会通过稍微修改值来绕过门禁（例如伪造的 `#fragment`、多余的尾部斜杠、不可见的零宽空格），从而导致发布损坏的链接。较强的模型则会原样返回该值并导致门禁失败，因此 `sync` 在每次运行时都会以非零状态退出。

请改为声明这些键：

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

匹配的键会**从源本地化语言中原样复制**——永远不会发送到翻译后端，永远不会经过质量门禁，永远不会被计为失败，也永远不会计费。出于同样的原因，它也会被排除在运行前的成本估算之外。

### 模式语法

模式是扁平化键空间上的点路径（dot-paths），支持两个通配符：

| 模式 | 匹配 | 不匹配 |
|---------|---------|----------------|
| `nav.brand` | `nav.brand`（精确路径） | `nav.brandName` |
| `**.url` | `url`、`pages.a.b.url`（任意深度的 `url` 叶子节点） | `pages.urlLabel`、`pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`、`meta.ogTitle` | `meta.twitterImage`、`meta.og.image` |

`*` 在单个段内匹配；`**` 匹配零个或多个完整段。没有通配符的模式是精确的键路径。

### 默认处理 URL

由于 URL 值的键在门禁下没有正确的结果，因此 `noTranslateUrls` 开箱即用默认为 `true`：任何仅包含绝对 `scheme://` URL 的源值都会被视为不翻译，无需额外配置。

检测范围被刻意收窄——修剪后的整个值必须是 URL。仅仅包含链接的文本（`"Read the paper at https://…"`）仍会正常翻译。

如果你的 URL 确实是特定于本地化语言的（例如，每种语言有不同的文档主机），请使用 `"noTranslateUrls": false` 将其关闭——然后使用 `noTranslate` 声明那些非特定语言的 URL。

### 修复与强制执行

对于不翻译键，只有一个正确的目标值，因此任何差异都是缺陷。Champollion 在两个方向上强制执行此规则：

- **`sync` 会修复它。** 如果不翻译键的目标值缺失、带有 `[EN] ` 前缀或被篡改，它将从源文本重写。这不消耗 API 调用，并且是幂等的：一旦值匹配，后续的同步将完全跳过该键。
- **`verify` 和 `integrity` 会在此处失败。** 发生偏移的不翻译键会被报告为 `NO-TRANSLATE DRIFT`，并附带预期值和实际值——不可见字符会被转义为 `\uXXXX`，因为这类损坏在差异对比（diff）中通常是无法察觉的。`champollion integrity` 会以 `1` 退出，因此连接到它的构建过程可以在发布前捕获损坏的 URL。

如果 `integrity` 在你刚刚配置的项目中以这种方式失败，说明它报告的是你的本地化文件中已经存在的损坏。运行一次 `champollion sync` 即可修复它。

## 文字转换 {#script-conversion}

Champollion 翻译的某些语言可以有多种*书写*方式。模型始终使用该语言的**工作文字（working script）**（拉丁罗马化——平原克里语为 SRO，克林贡语为 Okrand 罗马化）进行处理，然后确定性转换器可以将输出重写为显示文字（display script）。是否应该进行转换由配置决定——**绝不是默认行为**：

| 本地化 | 工作文字 | 可转换为 | 类型 |
|--------|---------------|----------------|------|
| `crk`（平原克里语） | `Latn`（SRO） | `Cans`（音节文字） | 真实 Unicode — **必须选择** |
| `sr` / `srp`（塞尔维亚语） | `Latn` | `Cyrl`（西里尔字母） | 真实 Unicode — **必须选择** |
| `tlh`（克林贡语） | `Latn`（罗马化） | `Piqd`（pIqaD） | PUA — 需选择加入 |
| `x-elvish-s`（辛达林语） | `Latn` | `Teng`（腾格瓦字母） | PUA — 需选择加入 |
| `x-kryptonian` | `Latn` | 氪星语（Kryptonian） | PUA — 通过 `"script": "x-kryptonian"` 选择加入 |

**真实 Unicode 语言对（crk、sr）需要做出选择。** 克里语音节文字和西里尔字母是普通的 Unicode——它们可以在任何地方渲染——并且这两种正字法都在实际使用中。Champollion 不会代表项目为社区选择书写系统：当你选择语言时，`init` 会进行询问，并且在配置明确指定之前，`sync` 会拒绝运行：

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA 文字（tlh、x-elvish-s、x-kryptonian）默认为罗马化。** pIqaD、腾格瓦字母和氪星语*不在 Unicode 中*——转换器会输出私用区（Private Use Area）代码点，除非你提供映射到这些代码点的字体，否则它们将无法渲染。罗马化是唯一能在任何地方渲染的输出，因此它是默认设置。若要改为输出显示文字：

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

……并运行 `champollion fonts install`，以便你的网站拥有可以绘制它的字体。如果你的字体是基于拉丁音译的（许多人造语言字体都是如此），请保持默认设置。

`script` 接受 ISO 15924 代码，不区分大小写（`"cans"`、`"Cans"` 和 `"CANS"` 是相同的）。它也可以按语言对进行设置，其优先级高于语言级别的设置。无效的值或本地化无法生成的文字会在启动时（在任何 API 调用之前）导致失败。

### 未映射的字母与 `scriptFallback` {#script-fallback}

转换器仅翻译其正字法定义的内容，别无其他。克林贡语罗马化没有 `d`、`c`、`f`、`g`、`i`、`k`、`s`、`x` 或 `z`——因此包含像“GitHub”这样专有名词的模型输出无法完全转换。Champollion **从不写入半转换的值**：如果任何字母无法映射，整个值将保留在工作文字中，并且警告会指出这些字母以及可以映射它们的配置行。

这些映射需要由你来声明：

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

每条规则在转换运行之前，将工作文字序列替换为转换器*可以*映射的序列。规则在启动时进行验证——本身无法映射的替换将被拒绝。

Champollion **不附带任何自身的后备（fallback）规则**：发明正字法改编（尤其是对于真实语言的书写系统）不是索引工具该做的事。社区和粉丝圈有自己的约定——请在每个项目中谨慎采用它们。

### 修复不需要的转换 {#repair-script}

在 0.3.0 之前，转换是无条件的——无论是否需要，针对 PUA 本地化的项目都会得到无法渲染的输出。有两个工具可以形成闭环：

- **`champollion repair-script`** 会扫描配置中已*关闭*转换的本地化文件中的 PUA 代码点，并使用转换器自身的反向表恢复罗马化（使用 `--dry` 进行预览）。pIqaD 可以精确反向转换；腾格瓦字母和氪星语的反向转换会丢失大小写，并会给出相应提示。
- **`champollion integrity`** 在转换关闭的情况下发现 PUA 时会失败（退出码 1）——因此构建门禁可以在发布前捕获无法渲染的文本，并且报告会指明修复方法。

翻译记忆库（Translation Memory）永远不需要修复：它存储的是转换前的值，因此稍后开启或关闭 `script:` 不需要任何缓存处理。

文字转换适用于 UI 字符串（键值文件和 Docusaurus JSON）。Markdown 正文永远不会被转换——贪婪的字符转换器无法安全地处理代码片段、URL 和 front matter。

## 对配置 {#pair-configuration}

每个源→目标对可以独立配置：

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### 对字段

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `method` | `string` | 翻译方法：`llm`、`llm-coached`、`google-translate`、`deepl`、`microsoft-translator`、`libretranslate`、`openai`、`anthropic`、`gemini`、`api` |
| `methodPlugin` | `string` | 已安装插件的名称（来自 `.champollion/methods/`） |
| `model` | `string` | 覆盖此对的默认模型 |
| `temperature` | `number` | 覆盖此对的默认温度 |
| `batchSize` | `number` | 覆盖此对的默认批次大小 |
| `register` | `string` | 寄存器/语调覆盖（预设键或自由文本） |
| `endpoint` | `string` | 远程 API 端点 URL。当 `method` 为 `api` 时必需。 |
| `coachingFile` | `string` | 此对的指导提示文件路径 |
| `promptContext` | `string` | 此对的应用程序上下文 |
| `qualityTier` | `string` | 显示层级：`standard`、`high`、`research`、`verified` |

## 语言配置 {#language-configuration}

语言接受三种格式：

### 代码数组（最简单）

```json
{
  "languages": ["fr", "de", "ja"]
}
```

每种语言从内置寄存器表获取其默认寄存器。没有默认值的语言获得 `"Professional register."`。

### 带有寄存器字符串的对象

该值可以是语言卡中的**预设键**，或自定义寄存器文本：

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion 检查字符串是否与语言卡中的预设键匹配。如果匹配，则使用卡中的完整寄存器提示。如果不匹配，则按原样使用字符串。有关可用预设，请参见[支持的语言](/docs/reference/supported-languages#language-cards)。

### 带有完整配置的对象

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

您可以在同一块中混合简写和完整对象。


### 语言字段

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `register` | `string` | 风格/语气指令。可以是**预设键**（例如 `casual-tu`、`formal-hapsyo`）或自定义文本。参见[语言卡片](/docs/reference/supported-languages#language-cards)。 |
| `name` | `string` | 人类可读的语言名称（用于状态显示） |
| `model` | `string` | 覆盖默认模型 |
| `temperature` | `number` | 覆盖默认温度值 |
| `batchSize` | `number` | 覆盖默认批处理大小 |
| `coachingFile` | `string` | 该语言的辅导提示词（coaching prompt）文件路径 |
| `promptContext` | `string` | 该语言的应用上下文 |
| `maxRetries` | `number` | 失败批处理的最大重试预算（默认值：3） |
| `script` | `string` | Champollion 写入的正字法的 ISO 15924 代码（例如 `"Cans"`、`"Piqd"`）。参见[文字转换](#script-conversion)。 |
| `scriptFallback` | `object` | 文字转换器无法映射的字母的音译规则。参见[文字转换](#script-conversion)。 |

:::info[继承链]
设置按此顺序解析（首先获胜）：

**对级别** → **语言级别** → **全局配置** → **默认值**

例如，如果 `pairs["en:fr"]` 设置 `model`，它会覆盖语言级别和全局 `model` 值。
:::

## 非英文源

如果您的源语言不是英文：

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## 锁定文件

Champollion 创建 `.champollion.lock` 来跟踪已翻译源值的 SHA-256 哈希。**提交此文件**，以便所有开发人员共享相同的翻译基线。

当源值更改时，哈希不再匹配，champollion 会在下次同步时重新翻译该键。

## `.champollionignore`

在项目根目录创建 `.champollionignore` 以从 `lint` 扫描中排除文件。使用 glob 模式，如 `.gitignore`：

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/` 目录

Champollion 在项目根目录创建 `.champollion/` 目录用于内部状态。您通常应该**将其添加到 `.gitignore`**——这是本地优化，不是项目源：

```gitignore
.champollion/
```

| 文件 | 用途 | 提交？ |
|------|---------|--------|
| `tm.json` | 翻译记忆缓存——存储按源文本 + 区域设置 + 方法键入的先前翻译 | 否（本地缓存） |
| `xliff/*.xliff` | XLIFF 导出文件供专业翻译人员审查 | 否（临时） |
| `methods/` | 已安装的方法插件清单 | 是（共享配置） |
| `backups/` | 预包装备份（由 `wrap --undo` 创建） | 否（安全网） |

有关 `tm.json` 的详细信息以及它如何节省 API 成本，请参见[翻译记忆](/docs/concepts/translation-memory)。

---

## 程序化 API

对于构建脚本和自定义集成，直接从包导入：

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### 可用导出

| 导出 | 功能 |
|--------|-------------|
| `TranslationMethod` | 所有方法的基类 |
| `LLMMethod` | LLM 方法的基类（OpenRouter） |
| `DirectLLMMethod` | 直接 LLM 提供商的基类（OpenAI、Anthropic、Gemini） |
| `OpenAIMethod`、`AnthropicMethod`、`GeminiMethod` | 直接 LLM 提供商类 |
| `DeepLMethod`、`MicrosoftTranslatorMethod`、`LibreTranslateMethod`、`TildeMethod`、`TranslatedMethod` | 传统 MT 类 |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | 指导 LLM（OpenRouter + 指导数据） |
| `APIMethod` | 远程 API 客户端 |
| `runSync`、`runContentSync` | 完整同步管道 |
| `resolveConfig`、`resolvePairs` | 配置解析 |
| `validateTranslations` | 质量门 |
| `loadCoachingData`、`findDictionaryMatches` | 指导实用程序 |

### 自定义提供商扩展

扩展 `DirectLLMMethod` 以在约 40 行中添加新的 LLM 提供商：

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

您可以免费获得翻译、指导、重试循环、模型验证、质量层级和设置帮助。只有 HTTP 请求形状是特定于提供商的。对于使用原始 `fetch()` 的非 LLM 适配器，请使用来自 `lib/methods/fetch-with-retry.js` 的共享 `fetchWithRetry()` 助手，而不是编写自己的重试循环。

---

## 另请参阅

- [CLI 参考](/docs/reference/cli) — 所有命令和标志
- [翻译方法](/docs/guides/translation-methods) — 选择和混合方法
- [翻译记忆](/docs/concepts/translation-memory) — 缓存和成本节省
- [与专业翻译人员合作](/docs/guides/professional-translators) — XLIFF 工作流
- [插件规范](/docs/reference/plugin-spec) — 方法插件清单格式
- [架构](/docs/concepts/architecture) — 各部分如何连接
- [支持的语言](/docs/reference/supported-languages) — 内置语言支持
- [同步如何工作](/docs/concepts/how-sync-works) — 翻译管道
