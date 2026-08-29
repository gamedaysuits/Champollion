---
sidebar_position: 4
title: "支持的语言"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# 支持的语言

champollion 配备了**语言卡片** — 50 种语言的结构化配置文件。每张卡片包含寄存器预设、正式程度系统元数据、方法支持标志、排版规则和文字信息。任何你的 LLM 知道的语言都可以通过单行配置添加 — 这些是具有精心策划、生产就绪寄存器的语言。

---

## 翻译方法

每种语言可以使用以下一种或多种翻译方法：

| 图标 | 方法 | 工作原理 | 成本 |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | 神经机器翻译基线。194 种语言。仅支持键值对字符串 — 无法安全地翻译 Markdown 内容。 | 约 $20/100万字符 |
| 🔵 | **LLM (OpenRouter)** | 模型掌握的任何语言。语域引导的提示词。处理键值对 + Markdown 内容。 | 因模型而异 |
| 🟣 | **LLM-Coached** | LLM + 语法词典 + 注入到提示词中的辅导数据。最适合形态复杂的语言。 | 因模型而异 |
| 🟠 | **API (插件)** | 通过 HTTP 提供的社区托管翻译流水线。[以数据主权为目标](/docs/network/community/low-resource-languages)。 | 因提供商而异 |

为 Google Translate 设置 `GOOGLE_TRANSLATE_API_KEY`，或为 LLM 方法设置 `OPENROUTER_API_KEY`。详见[翻译方法](/docs/guides/translation-methods)。

---

## 优先语言

这些是网络和移动应用最常请求的区域设置，按 champollion 推荐的无障碍优先顺序列出。

| 旗帜 | 语言 | 代码 | Google | LLM | Coached | 文字 | 备注 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | 阿拉伯语 | `ar` | ✅ | ✅ | ✅ | — | RTL。现代标准阿拉伯语（فصحى）。 |
| 🇵🇭 | 菲律宾语（Taglish） | `tl` / `fil` | ✅ | ✅ | ✅ | — | 在 Docusaurus 配置中使用 `fil`。champollion 解析两者。 |
| 🇫🇷 | 法语 | `fr` | ✅ | ✅ | ✅ | — | Vous 形式。性别包容性（Connecté·e）。 |
| 🇪🇸 | 西班牙语 | `es` | ✅ | ✅ | ✅ | — | 中立拉丁美洲。 |
| 🇩🇪 | 德语 | `de` | ✅ | ✅ | ✅ | — | Sie 形式。性别包容性（Benutzer:innen）。 |
| 🇯🇵 | 日语 | `ja` | ✅ | ✅ | ✅ | — | 正文使用 です/ます，UI 标签使用 する。 |
| 🇨🇳 | 中文（简体） | `zh` | ✅ | ✅ | ✅ | — | 简体中文。 |
| 🇮🇹 | 意大利语 | `it` | ✅ | ✅ | ✅ | — | Lei 形式。 |
| 🇧🇷 | 葡萄牙语（巴西） | `pt` | ✅ | ✅ | ✅ | — | 巴西葡萄牙语。 |
| 🇰🇷 | 韩语 | `ko` | ✅ | ✅ | ✅ | — | 해요체 敬语寄存器。 |

## 主要世界语言

| 旗帜 | 语言 | 代码 | Google | LLM | Coached | 文字 | 备注 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | 孟加拉语 | `bn` | ✅ | ✅ | ✅ | — | শুদ্ধ ভাষা 偏好。 |
| 🇧🇬 | 保加利亚语 | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | 捷克语 | `cs` | ✅ | ✅ | ✅ | — | Vykání（vy 形式）。 |
| 🇩🇰 | 丹麦语 | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | 希腊语 | `el` | ✅ | ✅ | ✅ | — | 现代 Δημοτική。 |
| 🇮🇷 | 波斯语 | `fa` | ✅ | ✅ | ✅ | — | RTL。 |
| 🇫🇮 | 芬兰语 | `fi` | ✅ | ✅ | ✅ | — | 无语法性别。 |
| 🇮🇱 | 希伯来语 | `he` | ✅ | ✅ | ✅ | — | RTL。 |
| 🇮🇳 | 印地语 | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी。最少英语借词。 |
| 🇭🇺 | 匈牙利语 | `hu` | ✅ | ✅ | ✅ | — | Ön 形式。 |
| 🇮🇩 | 印度尼西亚语 | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | 马来语 | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | 荷兰语 | `nl` | ✅ | ✅ | ✅ | — | U 形式。 |
| 🇳🇴 | 挪威语 | `nb` | ✅ | ✅ | ✅ | — | 书面挪威语。 |
| 🇵🇱 | 波兰语 | `pl` | ✅ | ✅ | ✅ | — | Pan/Pani 形式。 |
| 🇵🇹 | 葡萄牙语（欧洲） | `pt-PT` | ✅ | ✅ | ✅ | — | 欧洲葡萄牙语。 |
| 🇷🇴 | 罗马尼亚语 | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | 俄语 | `ru` | ✅ | ✅ | ✅ | — | Вы 形式。 |
| 🇸🇰 | 斯洛伐克语 | `sk` | ✅ | ✅ | ✅ | — | Vykanie（vy 形式）。 |
| 🇷🇸 | 塞尔维亚语 | `sr` | ✅ | ✅ | ✅ | 🔤 拉丁→西里尔文 | 确定性文字转换器。 |
| 🇸🇪 | 瑞典语 | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | 斯瓦希里语 | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | 泰语 | `th` | ✅ | ✅ | ✅ | — | ครับ/ค่ะ 敬语粒子。 |
| 🇹🇷 | 土耳其语 | `tr` | ✅ | ✅ | ✅ | — | Siz 形式。 |
| 🇺🇦 | 乌克兰语 | `uk` | ✅ | ✅ | ✅ | — | Ви 形式。 |
| 🇵🇰 | 乌尔都语 | `ur` | ✅ | ✅ | ✅ | — | RTL。آپ 形式。 |
| 🇻🇳 | 越南语 | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | 中文（繁体） | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文。 |
| 🇬🇪 | 格鲁吉亚语 | `ka` | ✅ | ✅ | — | — | ქართული。卡特维尔语族。 |
| 🇳🇬 | 约鲁巴语 | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá。声调语言（3 个声调）。 |

## 地区变体

| 旗帜 | 语言 | 代码 | Google | LLM | Coached | 文字 | 备注 |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | 墨西哥西班牙语 | `es-MX` | ✅ | ✅ | ✅ | — | Tú 形式。温暖的寄存器。 |
| 🇨🇦 | 加拿大法语 | `fr-CA` | ✅ | ✅ | ✅ | — | 魁北克习语。 |

---

## 土著语言和低资源语言

商业机器翻译（MT）服务不支持这些语言。champollion 为语言社区提供工具，以便在[社区数据主权原则](/docs/network/community/low-resource-languages)下构建自己的方法。

| | 语言 | 代码 | Google | LLM | Coached | 文字 | 状态 |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | 平原克里语 | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→音节文字 | 🚧 开发中 |
| 🌄 | 克丘亚语 | `qu` | ✅ | ✅ | — | — | Runasimi。证据后缀。 |

:::info[平原克里语（Plains Cree）正在积极开发中]
平原克里语的语域、辅导基础设施、文字转换器和评估测试套件均已具备功能，但翻译流水线**尚未发布**。我们正在[社区数据主权原则](/docs/network/community/low-resource-languages)下与语言社区合作，以确保发布前的质量。请参阅 [支持低资源语言](/docs/network/community/low-resource-languages) 了解完整背景 — 以及您如何参与贡献。
:::

:::tip[添加更多低资源语言]
champollion 的方法插件系统就是为此设计的。语言社区可以构建自定义翻译方法，在自己的控制下托管它，并通过 [API 方法](/docs/guides/serving-a-method)提供服务。[方法排行榜](/leaderboard)跟踪任何语言对的分数——构建一个方法，运行工具，并争取最高分。
:::

---

## 构造语言

构造语言通过 LLM 寄存器和可选的文字转换器得到支持。它们使用与真实语言相同的基础设施 — 质量门、教练系统和文字转换管道的工作方式完全相同。

| | 语言 | 代码 | Google | LLM | 文字 | 备注 |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | 克林贡语 | `tlh` | ❌ | ✅ | 🔤 罗马化→pIqaD | 需要 PUA 字体。Marc Okrand 词汇。 |
| 🧝 | 辛达林语（托尔金精灵语） | `x-elvish-s` | ❌ | ✅ | 🔤 拉丁→Tengwar | 需要 CSUR PUA 字体。 |
| 🏴‍☠️ | 海盗英语 | `x-pirate` | ❌ | ✅ | — | 仅寄存器。航海隐喻。 |
| 🦸 | 氪星语 | `x-kryptonian` | ❌ | ✅ | 🔤 拉丁→氪星文 | 需要 PUA 字体。 |
| 🎭 | 莎士比亚英语 | `x-shakespeare` | ❌ | ✅ | — | 仅寄存器。Thee/thou、-eth/-est 形式。 |
| 🐸 | 尤达说话方式 | `x-yoda` | ❌ | ✅ | — | 仅寄存器。OSV 词序。 |

详见[构造语言、文字和正字法](/docs/guides/conlangs-scripts-orthography)了解 PUA 字体要求、Unicode 限制以及如何添加你自己的。

---

## 语言预设

`init` 向导支持预设名称以快速设置。你可以混合预设与单个代码。

| 预设 | 展开为 |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## 添加任何语言

champollion 可以翻译到**你的 LLM 知道的任何语言** — 上表只列出了具有内置寄存器预设的语言。要添加未列出的语言，在你的配置中包含其 BCP-47 代码：

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

LLM 将使用其对该语言的训练知识进行翻译。设置 `register` 让你控制语调、正式程度和正字法约定。详见[配置](/docs/getting-started/configuration)。

---

## 语言卡片 {#language-cards}

每种内置语言都有一张**语言卡片** — `shared/language-cards/` 中的统一 JSON 文件，包含所有元数据：寄存器、正式程度、方法支持、排版规则、系谱分类、语言学挑战和 NLP 资源。

### 统一卡片架构

每张卡片在导入时急切加载。没有单独的参考层 — 所有数据都存在于每种语言的单个文件中。卡片从权威来源进行丰富：

| 来源 | 数据 |
|--------|------|
| [Glottolog](https://glottolog.org) | 族系分类、祖先链、Glottocode |
| [WALS](https://wals.info) | 属分类、类型学特征 |
| [CLDR](https://cldr.unicode.org) | 文字、方向、复数规则、排版 |
| [ISO 15924](https://unicode.org/iso15924/) | 文字代码 |

### 关键卡片字段

| 字段 | 包含内容 |
|-------|------------------|
| **`nativeName`** | 内族名 — 语言用其自己的文字对自己的称呼（例如 ქართული、Runasimi） |
| **`classification`** | 系谱锚点：族系、属、来自 Glottolog 的完整祖先链 |
| **`contactInfluences`** | 通用接触历史 — 借用层、上层语言、下层语言 |
| **正式程度系统** | T-V 区分、言语级别、敬语、粒子等。 |
| **寄存器预设** | 特定于语言特征的命名 LLM 提示预设 |
| **方法支持** | 哪些翻译 API 支持此语言 |
| **性别指导** | 语法性别规则和包容性写作提示 |
| **文字/方向** | ISO 15924 文字代码和 RTL/LTR |
| **规则** | 排版（引号、间距）、大小写、复数类别 |
| **`glottocode`** | 规范 Glottolog 标识符用于交叉引用 |
| **`dataSources`** | 来源跟踪（例如 `["glottolog-5.3", "cldr-48"]`） |

### 搭建新语言卡片

使用生成器从权威数据源（IANA、CLDR、Glottolog）搭建卡片：

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

生成器自动填充元数据（代码、文字、方向、复数、引号、方法支持、分类），并将语言学判断字段标记为 TODO 供人工策划。

### 使用预设键

你可以使用预设键名而不是编写完整的寄存器文本：

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion 将键解析为完整的寄存器提示。运行 `npx champollion init` 查看每种语言的可用预设。

### 示例预设

| 语言 | 预设 | 默认 |
|----------|---------|--------|
| 法语 | `formal-vous`、`casual-tu` | `formal-vous` |
| 韩语 | `polite-haeyo`、`formal-hapsyo`、`casual-hae` | `polite-haeyo` |
| 日语 | `polite`、`formal-keigo`、`casual` | `polite` |
| 德语 | `formal-Sie`、`casual-du` | `formal-Sie` |
| 泰语 | `neutral-professional`、`polite-male`、`polite-female` | `neutral-professional` |
| 西班牙语 | `neutral-professional`、`formal-usted`、`casual-tuteo` | `neutral-professional` |

详见[贡献语言卡片](https://github.com/gamedaysuits/champollion)了解完整规范，包括字段验证和 PR 检查清单。

---

## 另请参阅

- [配置](/docs/getting-started/configuration) — 完整配置参考，包括语言设置
- [翻译方法](/docs/guides/translation-methods) — 每种方法如何工作
- [文字转换器](/docs/concepts/script-converters) — 确定性文字转换管道
- [构造语言、文字和正字法](/docs/guides/conlangs-scripts-orthography) — PUA 字体、Unicode、添加构造语言
- [支持低资源语言](/docs/network/community/low-resource-languages) — 为服务不足的语言构建方法
