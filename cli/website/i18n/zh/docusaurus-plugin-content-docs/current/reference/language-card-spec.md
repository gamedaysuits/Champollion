---
sidebar_position: 4
title: "语言卡片规范"
description: "Champollion 按语言配置卡片的规范架构。"
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# 语言卡规范

> **单一事实来源 (Single source of truth)。** 本文档定义了每个语言卡片 (language card) 的规范形态。卡片仅断言被引用来源所断言的内容：没有来源断言的字段会被**省略，而不是设为 null** —— 缺失的字段意味着“没有来源提及”，绝不代表“没有任何已知信息”。可供机器检查的 schema 作为 `shared/schemas/language-card.schema.json` 随 npm 包发布，并且[下方的规范示例](#canonical-template)在每次网站构建时都会从实时语料库中生成，因此本页面不会与其描述的卡片产生偏差。

## 2026-08 atlas 重建 —— 此 schema 发生了哪些变化

卡片语料库现在是**构建输出 (build output)**：每张卡片都是从固定的上游快照存储中投影生成的，并且在事实发生变化时进行重建（绝不进行手动编辑）。随着此次重建，卡片形态发生了四个变化：

1. **存在争议的字段带有归属包络 (attribution envelope)。** 当引用的来源确实存在分歧时，该字段不再是扁平值，而是 `{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`、`speakerEstimates`、`endangerment`，以及任何因新来源而变得有争议的字段。使用者应通过发布的适配器（npm 包中的 `normalizeCard()`）来读取卡片，而不是假定它们是扁平值 —— `display()` 会将包络解析为其达成一致的值，并在出现真正争议时故意不返回任何内容，而不是强行选出一个胜出者。

2. **重命名字段。** `endonym` 替换了 `nativeName` · `codeAliases` 替换了 `aliases` · `scripts[]`（所有已证实的文字）替换了扁平的 `script`，主要文字 (primary script) 则从卡片的最大 BCP 47 标签派生 · `endangerment`（每个来源基于其自身尺度的评估）替换了单一的 `vitality` 对象 · `isoLanguageType` 和 `isoScope` 现在使用 ISO 639-3 的原词（"Living"、"Macrolanguage"）而不是首字母缩写。新增字段：`modality`（"spoken"/"signed"，派生自 Glottolog 的谱系）、`glottologBucket`（Glottolog 的非谱系分类桶，不放入 family 槽位）、`locale`/`localeScoped`。

3. **未断言的字段会被省略，而不是设为 null。** 没有来源断言的字段不会出现在卡片中。早期的规则（“每张卡片必须包含每个顶级字段，即使为 null”）已被废弃：在公共界面上显示空值会被解读为“没有任何已知信息”，这与“尚未调查”是不同的。

4. **存在 Locale 卡片。** 除了语言卡片之外，locale 投影（`fra-CA`、`cmn-Hant`）还承载了针对特定地区或文字解析的语言事实，由 `locale: {language, region, script}` 块标识。Locale 不是语言：在统计语言数量时，请通过该块排除 locale。

## 设计原则

1. **一切皆有来源。** 每个事实声明都可以追溯到一个具名的、带版本号的主要来源。无来源的声明是无法验证的声明。`_fieldSources` 映射（以及子对象中每个字段的 `source` 注解）使出处 (provenance) 变得明确。

2. **保留分歧。** 当权威机构存在分歧时（一个来源说有 50,000 名使用者，另一个说有 20,000 名），卡片会存储**两者**并附带来源归属 —— 即上文提到的包络形态。我们不会进行平均、解析或选边站队。用户可以自行探索其中的细微差别。

3. **缺失意味着未断言。** 缺失的字段意味着没有来源断言该值。当某个属性确实不适用时（例如，对于没有语法性别的语言），引用的值会明确说明这一点，而不是留空。

4. **重建，绝不修补。** 卡片是通过确定性构建从固定的来源投影生成的。事实缺陷会在其来源处理程序 (source handler) 处修复并重建语料库 —— 没有就地编辑，也没有仅用于合并的丰富层 (enrichment layer)。

---

## 三层架构

| 层 | 位置 | 目的 |
|-------|----------|---------|
| **语言卡** | `shared/language-cards/<code>.json` | 每种语言的配置：身份、分类、资源、一切 |
| **属卡** | `shared/language-cards/genera/<genus>.json` | 相关语言的共享运行时属性（策划的，非自动生成） |
| **语言树** | `shared/language-cards/language-tree.json` | 完整的 Glottolog 层级——Lab UI 和语言发现的参考数据 |

---

## 继承模型

> **自 atlas 重建以来，这在很大程度上已成为历史。** 磁盘上不再有任何语言卡片带有 `extends` —— 每张卡片都由构建过程完全物化 (materialized)，因为继承的散文文本是无法引用的（语系级别的声明披着语言级别的外衣）。该机制本身仅在一个地方保留：npm 包的离线 bundle 将 locale 卡片作为针对其语言的紧凑 `extends` 增量 (deltas) 发布，并通过此处描述的相同合并方式进行解析。

当卡设置 `"extends": "family-dravidian"` 时，运行时使用 `_deepMerge()`（在 `lib/registers.js` 中）将父卡合并到子卡中。这让属卡定义共享的寄存器、正式系统和性别指导，流向所有成员语言——无需在数百张单独的卡中重复数据。

### 合并语义

| 子值 | 行为 | 原因 |
|-------------|----------|-----|
| `null` | 从父继承 | `null` 意味着"我不定义这个"——父的值流向下来 |
| 非 null | 覆盖父 | 子的数据更具体——优先 |
| 嵌套对象 | 递归合并 | 子字段覆盖，父字段保留 |
| 数组 | 完全替换 | 数组不逐项合并——子数组获胜 |

### 身份字段（永不继承）

某些字段属于卡本身，必须永不从父继承：

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

即使父卡定义了 `aliases: ["macro-code"]`，子卡也不会继承这些别名。这些字段始终是子卡自己的值（包括未设置时的 `null`）。

**原因：** 没有这条规则，每种 Cree 语言都会从宏语言父继承 `aliases: ["cre"]`，使每个变体都成为宏的别名。

### 示例：Cree 卡如何解析

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

在运行时，`getLanguageCard("crk")` 返回一个合并的对象，包含 genus-cree 的寄存器 + family-algic 的属性（如果有）+ crk 自己的身份和元数据。

### 属卡模板

属卡位于 `shared/language-cards/genera/` 并为语言组定义共享属性。它们遵循与常规卡相同的模式，但约定不同：

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**关键规则：** 属卡必须仅包含在整个组中真正共享且来自权威参考的数据。如果正式系统在成员之间变化，它应该在单个卡上，而不是属卡上。

## 规范示例 \{#canonical-template}

> **生成，而非手写。** 本节中的所有内容都是在构建时从实时语料库派生的：完整的 `crk` (Plains Cree) 卡片（逐字节一致），加上 `fra-CA` locale 摘录。当语料库重建时，下一次网站构建会重新派生此页面。不再有任何需要手动维护且容易过时的模板 —— 之前的模板落后了卡片整整一代 schema，并已于 2026-08-16 停用。

该示例展示了**磁盘上的形态** —— 即打开文件时看到的内容。使用者仍应通过发布的适配器（npm 包中的 `normalizeCard()`）来读取卡片：它会解析包络，桥接切换前的名称，并派生出原始卡片故意不包含的仅用于显示的值（主要文字、活力层级）。

阅读时需要注意的事项：

1. **归属包络。** `name`、`classification.family`、`endangerment`、`speakerEstimates`、`endonym`、`bcp47FullTag` 和 `politenessDistinction` 各自带有 `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment` 具有 `"agreement": "incommensurable"`：其来源在不同的尺度上进行评估，因此每个值都会命名其 `scale`，而不是转换为某个胜出者的尺度。

2. **省略意味着未断言。** 该卡片没有 `iso639_1`（Plains Cree 没有 ISO 639-1 代码），也没有 `phonologicalInventory`（没有摄入的来源断言它）—— 这些字段只是不存在，绝不会是 `null` 或 `[]`。

3. **出处是一等层 (first-class layer)。** `_fieldSources` 将每个字段映射到断言它的来源，其中 `champollion-derived-v1` 标记了 Champollion 计算的值。`_card` 标记了卡片的类型、ID、修订版本，以及修正通道 (correction lane) 可以触及哪些字段；`_atlas` 标记了语料库的发布版本。

4. **没有运行结果。** 卡片上的任何内容都不是方法输出的测量分数 —— chrF、FST 接受率及其同类指标是按 (method, dataset, metric) 键控的运行结果，并存在于排行榜 (leaderboard) 上。卡片仅断言资源**存在**（`resources`、`lexicalResources`、`methodSupport`）。

<CardSpecExample variant="language" />

### Locale 卡片是投影，而不是语言 \{#locale-card-example}

在语言卡片旁边是 locale 卡片（`fra-CA`、`cmn-Hant`）：语言事实**针对特定地区或文字进行了解析**，由其 `locale` 块标识 —— 绝不通过代码形态标识。Locale 卡片继承其语言的事实，解析作用域为文字和地区的事实（`script`、`localeScoped`），并且**不是语言**：在每次语言计数和按语言列出的清单中，请通过该 `locale` 块排除 locale 卡片。

<CardSpecExample variant="locale" />

---

## 字段参考 \{#field-reference}

以下每个表格均适用两个约定：

- **"envelope"** 指的是归属包络 —— `{agreement, consensus?, values: [{value, source, note?, scale?}]}` —— 承载**每个**来源的声明。列为 `envelope` 的字段在只有一个来源发声的卡片上可能显示为扁平值（例如，仅存在于 Glottolog 的 languoid 带有扁平的 `name`）；使用者必须处理这两种情况，这正是发布的适配器所做的工作。
- 除了 `code` 和 `name` 之外，没有任何字段是必需的；其他所有内容在**没有来源断言时都会被省略**。每个字段的断言来源都记录在每张卡片的 `_fieldSources` 中，因此表格描述的是来源的**类型**，而不是固定那些会发生漂移的版本。

### § 1. 身份字段

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `code` | `string` | **必需。** 卡片 ID 和文件名。语言卡片使用 ISO 639-3 (`crk`)；仅存在于 Glottolog 的 languoid 带有其 glottocode；locale 卡片带有 locale 代码 (`fra-CA`)。 |
| `name` | envelope | **必需。** 英文参考名称 (ISO 639-3 注册表、LinguaMeta、Glottolog)。 |
| `endonym` | envelope | 替换了 `nativeName`。使用者用该语言对该语言的称呼 (LinguaMeta、Wikidata)。当没有来源断言时缺失 —— 我们绝不会发明或音译内名 (endonym)。 |
| `alternateNames` | `string[]` | 其他已证实的英文名称。 |
| `iso639_1` | `string` | 仅当存在双字母 ISO 639-1 代码时出现 (`fra` → `"fr"`)。 |
| `isoScope` | `string` | ISO 639-3 的原词 —— `"Individual"`、`"Macrolanguage"`、`"Special"` (替换了 `"I"`/`"M"`/`"S"` 首字母缩写)。 |
| `isoLanguageType` | `string` | 替换了 `isoType`。ISO 639-3 的原词 —— `"Living"`、`"Extinct"`、`"Ancient"`、`"Historical"`、`"Constructed"`。 |
| `macrolanguage` | `string` | 该语言所属的宏语言 (macrolanguage) (`crk` → `"cre"`)。ISO 639-3 宏语言映射。 |
| `macrolanguageMembers` | `string[]` | 在宏语言中心卡片上：各个成员代码 (`nor` → `["nno", "nob"]`)。 |
| `canonicalisedMembers` | envelope | 在宏语言卡片上：BCP 47 注册表将其标签折叠到此宏语言标签中的成员 (CLDR 别名表 + SIL langtags，各自带有归属)。 |
| `supersededCodes` | `string[]` | SIL 现在指向此语言的已停用 ISO 639-3 代码 —— 记录在后继者上，以便在旧代码下发布的语料库仍能解析。 |
| `codeAliases` | `string[]` | 替换了 `aliases`。解析到此卡片的代码级标识符。 |
| `bcp47` | `string` | 断言的该语言的 BCP 47 标签 (LinguaMeta)。 |
| `bcp47Tag` | envelope | Champollion 派生：RFC 5646 标签 (最短的 ISO 639 代码胜出)。 |
| `bcp47FullTag` | envelope | 最大的 语言–文字–地区 形式 (CLDR likelySubtags + SIL langtags)。适配器从此标签派生出**主要文字 (primary script)**。 |
| `modality` | `string` | `"spoken"` 或 `"signed"`，派生自 Glottolog 的谱系。书写是正字法属性，而不是模态 —— 未书写的语言仍然是完全口语或手语的。 |
| `locale` | `object` | **仅限 Locale 卡片。** `{language, region, script, publishedTag, source, note}` —— locale 标识。在统计语言数量时，请通过此块排除 locale 卡片，绝不通过代码形态排除。 |
| `localeScoped` | `object` | 仅限 Locale 卡片：针对 locale 的地区/文字解析的值 (例如 `scriptName`、`cldrOfficialStatus`)。 |

### § 2. 分类字段

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `glottocode` | `string` | Glottolog 对此 languoid 的标识符 (`crk` → `"plai1258"`)。仅存在于 Glottolog 的 languoid —— 即 Glottolog 记录但 ISO 639-3 未记录的语言 —— 使用 glottocode 作为其卡片 `code`。 |
| `classification` | `object` | 以下位置字段的容器。每个字段都独立获取来源并独立省略 —— 孤立语言 (isolate) 或归入 Glottolog 分类桶的语言，合理地仅带有此对象的一部分。 |
| `classification.family` | envelope | 每个分类权威机构断言的顶级语系。Glottolog 和 WALS 是独立的分类法，并不总是达成一致，因此两者都被保留并附带归属。Lint 规则 R5 会根据 Glottolog 自己的树检查包络内的 Glottolog 值：WALS 可以不同意 Glottolog，但绝不能错误引用 Glottolog。孤立语言完全不带有语系。 |
| `classification.familyGlottocode` | `string` | 该顶级语系的 Glottocode (`crk` → `"algi1248"`)。 |
| `classification.genus` | `string` | WALS 的中间分类节点 (`crk` → `"Algonquian"`)。这是一个 WALS 概念，**不是** Glottolog 概念 —— Glottolog 发布的是任意深度的树，没有属 (genus) 级别 —— 因此它仅在 WALS 对该语言进行编码时出现。 |
| `classification.ancestry` | `string[]` | Glottolog 的血统路径，表示为祖先 glottocode，根节点在前 (`["algi1248", …, "plai1264"]`)。顺序**本身**就是声明：这是一条路径，绝不是按字母顺序排列的集合。 |
| `classification.glottologBucket` | `string` | Glottolog 的非谱系分类桶 —— `"Artificial Language"`、`"Pidgin"`、`"Mixed Language"`、`"Speech Register"`、`"Unclassifiable"`、`"Unattested"`。不放入 family 槽位，因为分类桶是按种类而不是按血统分类的：带有分类桶的卡片没有语系，这是真实的结果。 |
| `isIsolate` | `boolean` | Glottolog 是否将此语言分类为孤立语言。 |

切换前的卡片还带有一个 `genusGlottocode`。它与产生它的类别错误一起被废弃：属 (genus) 是 WALS 的概念，将其包装在 Glottolog 标识符中断言了一个 Glottolog 并不具备的树节点。Glottolog 层级结构现在由 `ancestry` 承载。

### § 3. 地理字段

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `macroarea` | `string` | Glottolog 的宏观区域 (macroarea) —— `"Africa"`、`"Australia"`、`"Eurasia"`、`"North America"`、`"Papunesia"` 或 `"South America"`。 |
| `coordinates` | `object` | `{lat, lng}` —— Glottolog 的代表点。这是一个点，而不是一个地区：它将语言放置在地图上，不对范围或边界做任何声明。 |
| `countries` | `string[]` | Glottolog 与该语言关联的国家的 ISO 3166-1 alpha-2 代码 (`["CA", "US"]`)。 |
| `cldrOfficialStatus` | `string` | 某些地区授予该语言的官方地位，如 CLDR 所记录 (通过 LinguaMeta 承载) —— `"Official"`、`"Regional official"`。在 locale 卡片上，针对*该 locale* 地区解析的地位位于 `localeScoped.cldrOfficialStatus` 中。 |

切换前的 `regions` 数组（带有行政代码的按国家/地区使用者细分）和 `arealContext`（语言联盟成员身份）已被废弃：没有摄入的来源断言它们，且无来源的策展 (curation) 无法在重建中保留。区域级别的使用者声明可以在可引用的来源进入管道的那一天回归；在此之前，缺失才是真实的状态。

### § 4. 书写系统字段

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `scripts` | `string[]` | 替换了扁平的 `script`。**所有**已证实的 ISO 15924 代码 (`crk` → `["Cans", "Latn"]`)，无序 —— 绝不要将 `scripts[0]` 视为“唯一”的文字。主要文字由适配器从 `bcp47FullTag` 的最大标签派生。 |
| `scriptNames` | `string[]` | Champollion 派生的 `scripts[]` 显示名称 (`"Unified Canadian Aboriginal Syllabics"`)。 |
| `textDirection` | `string` | 替换了 `dir`。来源的原词 —— `"left-to-right"` / `"right-to-left"` (以前是 `"ltr"`/`"rtl"`)。 |
| `suppressScript` | `string` | CLDR Suppress-Script：对于该语言非常规范以至于 BCP 47 标签将其省略的文字 (`fra` → `"Latn"`)。 |
| `script` | `string` | **仅限 Locale 卡片**：针对 locale 解析的文字 (`fra-CA` → `"Latn"`，`cmn-Hant` → `"Hant"`)。语言卡片不带有扁平的文字字段。 |

没有已证实书写系统的语言只是**没有 `scripts` 字段** —— 缺失意味着没有来源断言文字，而不是声明该语言是“无文字的”。（手语是此类中最大的群体：没有任何符号系统在日常读写中获得社区标准的采用。）

### § 5. 人口统计与活力字段

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `speakerEstimates` | envelope | 每个来源的估计值，附带归属。值可以是精确计数或来源自己的范围字符串 (`"10000-99999"`)，来源的注意事项原样保留在 `note` 中。`"agreement": "conflicting"` 很常见 —— 展示冲突**本身**就是产品；不会进行平均或选举。 |
| `endangerment` | envelope | 替换了单一的 `vitality` 对象。每个来源**基于其自身尺度**的评估 —— 每个值都带有一个 `scale` 字段，并且 `"agreement": "incommensurable"` 是常态，因为 ELCat、Glottolog AES 和 LinguaMeta 词汇表并不是彼此的翻译。适配器根据声明的权威顺序从单一具名来源派生出一个用于显示的*活力层级 (vitality tier)*；该层级仅用于显示 —— 完整的带归属集合保留在卡片上。 |

在 Champollion 中任何地方*显示*的使用者计数必须与引用的 `speakerEstimates` 条目之一匹配，或者带有明确的 `champollion-derived` 出处 —— 这由卡片完整性规则强制执行。

### § 5.5 文档与数字存在字段

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `documentation` | `object` | 替换了 `documentationDepth`。Glottolog 对该语言描述程度的记录，使用 Glottolog 的原词。 |
| `documentation.medLevel` | `string` | Glottolog 的最详尽描述 (Most Extensive Description) 级别，原样保留 —— `"long grammar"`、`"grammar"`、`"grammar sketch"`、`"phonology"`、`"wordlist"`。 |
| `documentation.medSourceId` | `string` | 该最详尽描述在 Glottolog 参考目录中的书目键 (bibliographic key)。 |
| `documentation.firstDocumented` | `number` | Glottolog 自己的首次记录年份列，原样保留 —— 从切换前的顶级字段移至此处。仅存在于几百种语言中，这种稀疏性本身就值得了解。 |
| `documentation.lastDocumented` | `number` | Glottolog 的最后记录年份列，原样保留 —— 存在于大约一千种语言中。 |
| `wikipediaEdition` | `object` | 替换了 `digitalPresence`。`{site, url, name}` —— 该语言存在开放的维基百科版本 (`afr` → `af.wikipedia.org`)。仅表示存在，故意**不包含条目数量**：有几个版本主要是由机器人生成的，在翻译人员可以利用的任何意义上，庞大的版本并不比小版本“记录得更好”。 |
| `dialectCount` | `number` | Glottolog 自己的 `child_dialect_count` 列，原样保留 —— 仅限直接子方言，而不是整个子树。这是 Glottolog 的断言，而不是我们的算术：早期的规则将其标记为 `champollion-derived`，导致数千张卡片将 Glottolog 的计数归功于自己。 |

切换前的 `digitalPresence` 块的其余部分（Common Voice 小时数、Tatoeba 句子计数）已被废弃，直到这些来源进入管道 —— Tatoeba 语料库本身已经出现在它所属的位置，即 `resources.corpora` 下的平行语料库（第 9 节）。

### § 6. 正式性、寄存器与性别字段

投影的语料库在此处仅承载一个字段 —— 引用的事实：

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `politenessDistinction` | envelope | 该语言是否在第二人称形式中将礼貌语法化。归属于 Grambank GB415 (二元：不存在/存在) 和 WALS 45A (四个级别：无区别 / 二元 / 多重 / 避免使用代词)。这些是不同的尺度，因此每个值都会命名其 `scale`，并且包络将它们报告为**不可通约 (incommensurable)**，而不是分歧。 |

**语域 (register) 系统是配置，而不是卡片事实。** 切换前的语料库在近一千八百张卡片上分别存储了 `formality` 散文和 `registers` 提示词 —— 几乎所有这些都是从上述两个相同的来源生成的，然后被当作手工策展的配置来承载。atlas 保留了事实；配置界面 —— `formality`、`registers`、`gender`、`codeSwitching` —— 仍然是 **npm 包策展 schema** (`language-card.schema.json`) 的一部分，存在于策展的属/语系中心卡片上，并通过[继承模型 (Inheritance Model)](#inheritance-model) 中描述的语域系统 `extends` 合并到达 CLI。它们不是投影的 atlas 字段：投影语料库中的任何卡片都不承载它们，atlas 构建也绝不会写入它们。[编写优秀的语域预设 (Writing Good Register Presets)](#writing-good-register-presets) 中的指南适用于该策展通道。

### § 7. 语言学档案字段

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `typologicalProfile` | `object` | 每个摄入的类型学特征对应一个键，每个值都是来源自己的编码，每个键仅在来源对该语言进行编码时出现。布尔值来自 Grambank 特征，类别字符串来自 WALS 章节；决策注册表为每个键命名了确切的上游参数。 |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` —— 由 Champollion 基于引用的 PHOIBLE 库存计算的计数 (PHOIBLE 为每个音段发布一行，不断言计数)，因此每个值都带有 `champollion-derived` 出处。**PHOIBLE 是唯一的声调权威** (lint R1)：Grambank 没有声调特征，卡片上的其他任何内容都不能声明声调。 |
| `numeralSystem` | `object` | `{base}` —— 记数基数，原样摘自 Chan 的 *Numeral Systems of the World's Languages* (`"decimal"`、`"quinary-vigesimal"`、`"body tally"`；近一百个不同的值)。当 Chan 自己的基数列为空时 (大约占调查语言的一半) 缺失 —— 因为之前的生成器用 `"decimal"` 填补了空白，并为两千种语言发明了值。 |
| `pluralCategories` | `string[]` | CLDR 为该语言声明的基数复数类别 —— 阿拉伯语区分 `["zero", "one", "two", "few", "many", "other"]`，法语区分其中三个，中文区分一个。从 CLDR 自己的规则集的键中读取，因此这是 CLDR 的声明，而不是我们的派生。替换了切换前的 `rules.plurals.categories`；i18n 管道需要它来知道消息必须提供多少种复数形式。 |

当前投影的 `typologicalProfile` 键及其上游参数：

- **WALS 章节** (类别字符串，WALS 自己的值标签)：`fusion` (20A)、`verbSynthesis` (22A)、`affixPreference` (26A)、`reduplication` (27A)、`genderCount` (30A)、`caseCount` (49A)、`wordOrder` (81A)、`subjectVerbOrder` (82A)、`verbalAlignment` (100A)、`negationOrder` (143A)
- **Grambank 特征** (布尔值)：`hasGenderInPronouns` (GB030)、`hasSexBasedGender` (GB051)、`hasNumeralClassifiers` (GB057)、`hasCoreCase` (GB070)、`hasObliqueCase` (GB071)、`marksPastTense` (GB083)、`marksPresentTense` (GB084)

切换前的 `linguisticChallenges` 和 `contactInfluences` 块未被投影 —— 没有摄入来源的研究散文保留在 npm 包的策展 schema 中，就像第 6 节中的语域界面一样（下面的[接触影响类型 (Contact Influence Types)](#contact-influence-types) 表格服务于该通道）。`rules` 块已被废弃：其中可引用的内容作为此处的 `pluralCategories` 和第 4 节中的文字字段保留了下来。

### § 8. 百科字段

已从卡片中废弃。切换前的 `encyclopedic`（历史和方言文章、机构链接）、`culturalAphorism` 和 `varieties` 块是卡片粒度的手工策展散文，重建过程按设计将其删除。`varieties` 所指向的成员身份事实现在是引用的标识字段（第 1 节 `macrolanguageMembers` 和 `canonicalisedMembers`），而每种变体的工具覆盖范围由每个成员自己的卡片（`methodSupport`、`resources`）来回答。代表性谚语可能会在获得同意和引用的情况下通过社区贡献通道回归；它不会作为未引用的卡片字段回归。

### § 9. 数字资源字段

本节中的所有内容都断言**存在性和能力，绝不断言质量**：即资源已发布以及由谁发布 —— 绝不断言它是好的、完整的或可用的，也绝不是测量分数。方法输出的任何测量分数都是按 (method, dataset, metric) 键控的运行结果，存在于排行榜上，并且禁止出现在卡片上 (lint R3)。

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `resources` | `object` | 容器：下面的每个子字段都是一个独立获取来源的列表，在没有来源断言时省略。 |
| `resources.fsts` | `object[]` | 已发布的有限状态形态分析器 (finite-state morphological analysers)：`{name, url, publisher, license, licenceEstablished, archived}`。许可证随每个条目一起提供，而不是假定整个目录统一 —— 许可证边界需要实际条款。对于多式综合语 (polysynthetic language)，FST 通常是唯一存在的结构检查工具。 |
| `resources.corpora` | `object[]` | 证实该语言的平行语料库：`{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`。通过**语言对 (pairs)** 声明，因为平行语料库仅通过语言对来证实一种语言 —— 仅说“覆盖斯瓦希里语”而不说明对应什么语言，回答的是一个没人问的问题。仅表示存在性和规模，绝不断言质量。 |
| `resources.monolingualCorpora` | `object[]` | 单语语料库 —— 与 `corpora` 保持分离，这样“有语料库”绝不会意味着两种无法比较的事物。 |
| `resources.speech` | `object[]` | 已发布的语音资源。仅表示存在。 |
| `resources.keyboards` | `object[]` | 已发布的键盘布局。简单但承重：对于需要标准布局无法生成的字符的正字法，布局决定了该语言是否可输入。 |
| `resources.typology` | `object[]` | 对该语言进行*编码*的类型学数据集，及其范围：`{dataset, featuresCoded, datasetFeatureTotal}`。仅表示存在性和范围，绝不包含内容 —— 特征说明的内容不会出现在卡片上，直到有人编写接受它的参数映射 (被接受的特征会出现在第 7 节的 `typologicalProfile` 中)。特征计数是我们的算术，因此它们带有 `champollion-derived` 出处。 |
| `lexicalResources` | `object` | 词汇存在事实的容器。 |
| `lexicalResources.datasets` | `object[]` | 已发布的词表及其覆盖范围：`{dataset, forms, concepts, release}`。 |
| `lexicalResources.dictionaries` | `object[]` | 已发布的词典 —— 仅表示存在，绝不断言质量，并且**具有方向性**，方向由发布者指定：单向词典与反向词典是不同的资源。条目的形态并不统一 (CLDF 数据集知道其条目数；存储库知道其语言对和方向)；每个条目都命名自己的来源，许可证和归档状态随每个条目一起提供。 |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Champollion 基于 CLICS³ 计算的计数：该语言已证实的概​​念，以及映射到两个或多个不同概念的形式。`champollion-derived`。 |
| `methodSupport` | `object` | 哪些翻译方法覆盖了该语言 —— 表示能力，绝不是分数。形态：`{total, byTier, named, truncated}`。英语带有数千个方法边缘 (method edges)，而中位数语言只有几十个，因此卡片保留了证据的*形态* —— `total` 加上每个置信度层级的 `byTier` 计数 (`fetched`、`partially-confirmed`、`model-card-declared`) —— 并且仅命名最强的条目 (每个 `{value, variant, source, confidence}`)，有数量上限。注册表**服务**始终全名列出，不受上限限制，因此 `named` 中缺少某项服务是一个真实的答案；缺少模型卡片条目仅意味着“不在最强之列”，并且每个边缘在 atlas 存储中仍然可查询。 |
| `metricModelSupport` | envelope | 发布该语言覆盖范围的评估指标模型，以及测试工具 (harness) 加载的模型标识符 (`masakhane/africomet-mtl`)。驱动实际行为 —— COMET 模型选择 —— 并且仍然是能力，绝不是分数。 |

**折叠到上述字段中：** 切换前的 `keyboardSupport` (→ `resources.keyboards`)、`corpusAvailability` (→ `resources.corpora` / `resources.monolingualCorpora`) 和 `databaseCoverage` (→ `resources.typology` 加上 `lexicalResources` —— 数据库条目现在是带有范围的引用覆盖事实，而不是布尔值)。

**已从卡片中废弃：** `omt1600`、`evalDatasets`、`pipelineReadiness` 和 `metricPlugins` —— 没有一个是由摄入的来源断言的，并且就绪层级 (readiness tier) 是一种判断，而不是引用。

**策展，而非投影：** 评估标准声明界面 (`evalStandard`、`evalMetrics`、`evalPack`) 保留在 npm 包的策展 schema 中。它们告诉评估测试工具 (evaluation harness) 哪个外部裁判包对语言进行评分 (是裁判，而不是参赛者 —— 测试工具核心不附带特定于语言的评分器代码)；当卡片上存在这些声明时，测试工具会读取它们，但目前投影语料库中没有任何卡片承载它们，atlas 构建也不会写入它们。测试工具的 FST 安装程序从 `resources.fsts[]` 条目 (`language_cards.py` 中的 `get_fst_install_info()`) 读取的 `install` 块也是如此：投影的条目仅承载存在事实。

### § 10. 出处字段

| 字段 | 形态 | 备注 |
|-------|-------|-------|
| `_fieldSources` | `object` | 在每张卡片上。将卡片上的每个字段路径 (`"classification.family"`、`"coordinates.lat"`) 映射到断言它的已排序来源 ID (`["glottolog-v5.3", "wals-v2020.5"]`)。Champollion 计算的值带有 `champollion-derived-v1`。来源 ID 是带版本的 —— `grambank-v1.0.3`、`iso639-3-20260715` —— 因此每个声明都可以追溯到做出该声明的确切发布版本。 |
| `coverage` | `object` | 在每张卡片上，并且**由投影器计算，而不是由任何来源断言**：`{sourceCount, componentsPresent, componentsTotal, notAttested}` —— 有多少个不同的来源谈论了该语言，在所有可填写的卡片组件中有多少个带有值，以及来源明确记录为*缺失*的值有多少个 (调查过并说没有 —— 这与从未调查过是不同的事实)。这使得内容单薄的卡片能够说明它**为什么**单薄，而不是看起来被忽视了。 |
| `_card` | `object` | 卡片自身的元数据：`{type, id, revision, correctableFields}`。`type` 是 `"language"` 或 `"locale"` (方法和语料库卡片使用相同的投影器)；`revision` 是内容哈希，因此卡片内容的任何更改都会改变它；`correctableFields` 列出了带有值的字段路径 —— 即修正通道可以触及的字段。 |
| `_atlas` | `object` | `{version}` —— 语料库发布标记 (在发布之间为 `"unreleased"`)。故意使用发布 ID，**而不是**构建时间戳：时间戳会使来自相同固定版本的两次构建因日历时间而不同，从而破坏了允许任何人检查 atlas 的属性 —— 相同的固定版本输入，相同的字节输出。 |

切换前的出处块已被整体废弃：`dataSources` (被每个字段的 `_fieldSources` 映射取代)、`supportTier` (一种计算出的判断，被中立的 `coverage` 计数取代)、`_generated` (整个语料库都是生成的；标记是 `_card.revision` 加上 `_atlas.version`)、`humanReviewed` 和 `notes` (属于具有自身记录的通道的策展)，以及顶级的 `firstDocumented`/`lastDocumented` (移至第 5.5 节的 `documentation` 中，它们的来源实际上在那里断言了它们)。

---

## 语言代码政策

Champollion 使用 **ISO 639-3** 作为规范标识符。其他标准代码注册为别名，在运行时解析为 ISO 639-3 代码。

| 优先级 | 标准 | 示例 | 字段 | 用途 |
|----------|----------|---------|-------|-----|
| 1 (规范) | ISO 639-3 | `crk` | `code` | 卡片文件名、配置键、API 参数 |
| 2 (别名) | ISO 639-1 | `iu` | `codeAliases[]` | 在 CLI 中接受，解析为 ISO 639-3 |
| 3 (别名) | BCP 47 | `fil` | `codeAliases[]` | 在 CLI 中接受，解析为 ISO 639-3 |
| 参考 | Glottocode | `plai1258` | `glottocode` | 仅用于分类，不用于运行时 |

**解析顺序：** 当用户提供代码时：
1. 直接匹配 `card.code` → 找到
2. 匹配 `card.codeAliases[]` → 找到，返回规范卡片
3. 匹配 `card.iso639_1` → 找到 (回退)
4. 未找到 → 错误

### 迁移历史：ISO 639-1 → ISO 639-3

在 v8 之前，卡文件名在可用时使用 ISO 639-1 代码（`fr.json`、`de.json`、`ja.json`）。在 639-3 迁移中，所有卡都重命名为其 ISO 639-3 等价物：

| 之前 | 之后 | 原因 |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3 是规范 |
| `de.json` | `deu.json` | 639-3 是规范 |
| `zh.json` | `cmn.json` | 宏语言 → 默认个体 |
| `ar.json` | `arb.json` | 宏语言 → 现代标准阿拉伯语 |
| `ms.json` | `zsm.json` | 宏语言 → 标准马来语 |

**旧代码怎么了？**
- 旧的 639-1 代码在 `card.iso639_1` 中
- 旧的 639-1 代码在 `card.codeAliases[]` 中 (`fra` → `["fr"]`)
- `resolveCode("fr")` 在运行时返回 `"fra"` —— 向后兼容
- 用户仍然可以在其配置中写入 `"fr"` —— 它会透明地解析

**架构上改变了什么：**
- `_deepMerge()` 现在跳过 `null` 值（从父继承）
- `_deepMerge()` 现在设置了身份字段（代码、扩展、别名永不继承）
- `formality.default` 现在从寄存器 `isDefault: true` 标志派生
- 205 个 Grambank 派生的卡获得了结构 `formality.default` 修复
- 38 个属/族/宏语言卡提供继承目标

---

## 边界情况

### 手语
手语 (例如，ASE —— 美国手语) 是具有 ISO 639-3 代码的合法语言。它们有地理分布和使用者计数，但是：
- `modality` 是 `"signed"` —— 卡片对该语言*是什么*的正面断言；没有书写系统是一个独立的事实
- `scripts` 通常缺失 (没有任何符号系统获得社区标准的采用)，尽管 `"Sgnw"` (SignWriting) 会在有来源断言它的地方出现
- `textDirection` 缺失
- `linguisticChallenges` 应涉及空间语法、量词等。

### 古代与历史语言
像拉丁语 (`lat`，isoLanguageType `"Historical"`) 和梵语 (`san`) 这样的语言仍在特定语境 (礼拜、学术) 中使用，但没有母语使用者：
- `isoLanguageType` 承载 ISO 自己的状态词 (`"Ancient"`、`"Historical"`、`"Extinct"`) —— 卡片绝不会软化或覆盖它
- `endangerment` 和 `speakerEstimates` 报告引用来源实际评估的任何内容，注意事项原样保留 (L2 社区计数保持其来源标记的方式)
- `firstDocumented` / `lastDocumented` 在时间上对它们进行定位

### 人造语言
世界语 (Esperanto) (`epo`，isoLanguageType `"Constructed"`)、逻辑语 (Lojban) 等：
- `classification` 可能缺失 —— Glottolog 将人造语言 (conlangs) 归入非谱系分类桶，并且该分类桶绝不会显示为语系
- `contactInfluences` 反映了源材料 (例如，世界语借鉴了罗曼语、日耳曼语、斯拉夫语)
- `endangerment` 比较特殊 —— 使用者社区在不断增长，但没有本土家园

### 宏语言
阿拉伯语 (`ara`)、中文 (`zho`)、克里语 (Cree) (`cre`)、克丘亚语 (Quechua) (`que`) 是包含多种独立语言的宏语言：
- `isoScope: "Macrolanguage"` —— 导航中心，绝不是基准测试目标
- `macrolanguageMembers` 列出了各个成员代码；`canonicalisedMembers` 记录了 BCP 47 注册表将哪些成员折叠到宏语言标签中 (每个注册表都有归属)
- `methodSupport` 反映了*宏语言卡片*支持的内容 (通常是标准化变体)
- 各个成员都有自己的卡片，带有指向中心的 `macrolanguage`

### 没有标准化正字法的语言
许多语言 (尤其是口头传统语言) 没有标准化的书写系统，或者存在相互竞争的正字法：
- `scripts`、`scriptNames` 和 `textDirection` 缺失 —— 没有来源断言文字，这与“无文字”的声明不同
- `notes` 应解释正字法情况
- `linguisticChallenges` 应注意这如何影响机器翻译 (MT) (例如，没有训练数据)

### 双言现象
阿拉伯语（MSA 对方言）或瓜拉尼语（Jopará 对纯瓜拉尼语）等语言：
- `codeSwitching` 捕捉混合变体情况
- `registers` 可以为不同级别提供预设
- `varieties` 可以列出双言对

---

## 接触影响类型

| 类型 | 含义 | 示例 |
|------|---------|---------|
| `superstrate` | 强加给社区的主导语言 | 法语 → 英语（1066 年后） |
| `substrate` | 本地语言影响强加的语言 | 凯尔特语 → 英语 |
| `adstrate` | 相邻语言有相互影响 | 诺斯语 → 英语 |
| `learned_borrowing` | 通过教育/学术借用 | 拉丁语 → 英语 |
| `lexical_borrowing` | 通过接触直接词汇借用 | 西班牙语 → 菲律宾语 |
| `relexification` | 大规模词汇替换 | 葡萄牙语 → 帕皮亚门图语 |

## 接触影响深度

| 深度 | 含义 |
|-------|---------|
| `light` | 少数借词，最小结构影响 |
| `moderate` | 特定领域的重要词汇 |
| `heavy` | 普遍的词汇和一些结构特征 |
| `structural` | 语法、句法和音韵受影响 |
| `defining` | 核心身份由接触塑造（克里奥尔语、混合语言） |

---

## 编写好的寄存器预设

**好的预设提示：**
- 明确命名正式性特征（例如，"해요체"、"vous-form"、"siz-form"）
- 解释要使用的特定代词或动词形式
- 为何时使用此寄存器提供背景
- 如果适用，提及脚本考虑

**不要**在预设提示中放置性别包容性指导。性别指导属于 `card.gender.inclusiveGuidance` ——它单独注入。

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### 预设命名约定

预设键应该是描述性的且小写连字符分隔：
- T-V 语言：`formal-vous`、`informal-tu`、`formal-Sie`、`casual-du`
- 言语级别：`polite-haeyo`、`formal-hapsyo`、`casual-hae`
- 中立：`professional`、`neutral-professional`
- 代码转换：`taglish-professional`、`pure-filipino`

---

## 卡片事实如何更新

卡片是**构建输出** —— 从固定的上游快照进行的确定性投影。不再有针对每张卡片的丰富程序：手动运行的 `enrich-*` 脚本通道已被废弃，直接对卡片文件进行的编辑将在下一次构建时被删除。要更改事实：

1. **注册决策。** 每个字段都是构建决策注册表中的一行：哪个上游参数为其提供数据、它如何投影，以及缺失值意味着什么。
2. **修复摄入层。** 错误的值是来源处理程序中的缺陷 (或过时的上游固定版本)，绝不是要在卡片上修补的内容。
3. **重建并切换。** 构建过程从固定的快照重新投影每张卡片；门控 (gates) 会拒绝部分构建、null/空值以及未通过完整性规则的卡片。

### 冲突处理

当来源存在分歧时：
1. **存储所有来源**并附带来源归属 —— 这正是归属包络的作用
2. **不要平均**或选边站队 —— `consensus` 仅在来源实际达成一致时出现
3. 将每个来源的注意事项原样**保留**在该值的 `note` 中
4. 用于显示或计算的单一值由**适配器**根据声明的权威顺序**派生** —— 卡片本身保留完整的分布

---

## 验证

在任何重建之后运行 linter：

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR 检查清单

提交涉及卡片的更改时 (请记住：更改构建，而不是卡片)：

- [ ] 修复位于摄入处理程序或决策注册表中 —— 没有手动编辑任何卡片文件
- [ ] 字段仅承载来源断言的值 —— 没有为了“完成”卡片而填充 `null` 或 `[]` 的内容
- [ ] `classification` 来自 Glottolog (非手工构建)
- [ ] 每个触及字段的出处都落在 `_fieldSources` 中，Champollion 计算的值带有 `champollion-derived` 出处
- [ ] 卡片上的任何地方都没有出现方法输出的测量分数
- [ ] Linter 和卡片完整性门控通过且无错误

---

## 专业参考

| 标准 | 维护者 | 我们的用途 |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | 规范语言代码、宏语言关系 |
| [Glottolog](https://glottolog.org) | Max Planck Institute | 分类、坐标、AES 濒危 |
| [WALS](https://wals.info) | Max Planck Institute | 属定义、类型特征 |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | 脚本代码 |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | 区域设置数据、复数规则、排版 |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | 使用者数量、内族名、脚本数据 |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS、使用者估计、DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | 濒危分类 |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | 菲律宾语言胶囊 |

另见：[语言卡引用程序](/docs/reference/language-card-citation-procedure)以获取详细的逐来源指导。
