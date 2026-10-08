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

> **单一事实来源。** 本文档定义了每张语言卡片的规范结构。
> 卡片仅断言引用的来源所断言的内容：没有任何来源断言的字段会被**省略，而非为 null** —— 缺失的字段意味着“没有任何来源提及”，绝非“无可探知”。机器可校验的模式作为 npm 包中的 `shared/schemas/language-card.schema.json` 提供，且[下方的规范示例](#canonical-template)在每次网站构建时从实时语料库生成，因此本页面不会与它所描述的卡片产生偏差。

## 2026-08 图集重构 —— 本模式有哪些变更

卡片语料库现在是**构建产物**：每张卡片均从固定的上游快照存储中投影生成，并在事实变更时重新构建（绝不手动编辑）。伴随此次重构，结构上发生了四项变化：

1. **存在争议的字段包含归属信封（attribution envelope）。** 当引用的来源确实存在分歧时，该字段不是平铺值，而是
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`、
   `speakerEstimates`、`endangerment`，以及任何因新来源引入而产生争议的字段。使用者应通过已发布的适配器（npm 包中的 `normalizeCard()`）读取卡片，而非假定其为平铺值 ——
   `display()` 会将信封解析为其达成共识的值，并在出现真正的争议时特意不返回任何内容，而不是强行选出一个胜出者。

2. **重命名字段。** `endonym` 替代了 `nativeName` · `codeAliases`
   替代了 `aliases` · `scripts[]`（所有见证的书写系统）替代了平铺的
   `script`，主要文字系统则从卡片的最长 BCP 47 标签派生 · `endangerment`（每个来源基于其自身标准的评估）替代了单个 `vitality` 对象 · `isoLanguageType` 与
   `isoScope` 现在直接采用 ISO 639-3 自身的表述（"Living"、"Macrolanguage"），而非首字母缩写。新增字段：`modality`（"spoken"/"signed"，派生自 Glottolog 的谱系关系）、`glottologBucket`（Glottolog 的非谱系分类桶，与语族位置区分开）、`locale`/`localeScoped`。

3. **未断言的字段直接省略，而非设为 null。** 没有任何来源断言的字段不会出现在卡片中。早期的规则（“每张卡片必须包含所有顶级字段，即使值为 null”）已被废弃：在公开暴露的表面上，空值看起来像是在断言无可探知，这与尚未查证并不相同。

4. **区域设置卡片现已存在。** 除语言卡片外，区域设置投影（`fra-CA`、`cmn-Hant`）承载了针对特定地区或文字系统解析后的语言事实，通过 `locale: {language, region, script}` 块进行标识。区域设置并非语言：在统计语言数量时，请根据该块排除区域设置。

## 设计原则

1. **一切皆有出处。** 每一个事实断言均可追溯至具名的、带版本的主要来源。无出处的断言即为不可验证的断言。`_fieldSources` 映射（以及子对象中按字段设置的 `source` 注释）使溯源信息清晰明确。

2. **保留分歧。** 当权威来源存在分歧时（例如一个来源称有 50,000 名使用者，另一个来源称有 20,000 名），卡片会通过来源归属*同时*存储这两者 —— 即上述的信封结构。我们不会取平均值、强行调和或选边站队。用户可以自行体会其中的细微差异。

3. **缺失即未断言。** 字段缺失意味着没有任何来源断言该值。当某项属性确实不适用时（例如缺乏语法性别的语言中的语法性别），引用的值会明确予以说明，而不是留空。

4. **重构而非修补。** 卡片是通过确定性构建过程从固定来源投影而成的。事实缺陷应在其来源处理器中修复，随后重新构建语料库 —— 不允许就地编辑，也没有仅合并的丰富层。

---

## 三层架构

| 层 | 位置 | 目的 |
|-------|----------|---------|
| **语言卡** | `shared/language-cards/<code>.json` | 每种语言的配置：身份、分类、资源、一切 |
| **属卡** | `shared/language-cards/genera/<genus>.json` | 相关语言的共享运行时属性（策划的，非自动生成） |
| **语言树** | `shared/language-cards/language-tree.json` | 完整的 Glottolog 层级——Lab UI 和语言发现的参考数据 |

---

## 继承模型

> **自图集重构后基本已成历史。** 磁盘上的语言卡片不再带有 `extends` —— 构建过程会将每张卡片完全实体化，因为继承的文本是无法引用的（语族级的断言冠上了语言级的地址）。该机制本身仅在一处保留：npm 包的离线 bundle 将区域设置卡片作为相对于其语言的紧凑 `extends` 增量分发，并由此处描述的相同合并机制进行解析。

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

> **自动生成，而非手工撰写。** 本节中的所有内容均在构建时从实时语料库派生：完整的 `crk`（平原克里语）卡片（逐字节一致），加上 `fra-CA` 区域设置节选。当语料库重新构建时，下一次网站构建会重新派生本页面。不再有手动维护的模板会落后过期 —— 先前的模板滞后了卡片整整一个模式代际，已于 2026-08-16 停用。

该示例展示了**磁盘上的结构** —— 即打开文件时看到的原始形态。使用者仍应通过已发布的适配器（npm 包中的 `normalizeCard()`）来读取卡片：它负责解析信封、桥接切换前的旧名称，并派生原始卡片特意不包含的仅用于展示的值（主要文字系统、活力等级）。

阅读时的注意事项：

1. **归属信封。** `name`、`classification.family`、
   `endangerment`、`speakerEstimates`、`endonym`、`bcp47FullTag` 和
   `politenessDistinction` 均包含 `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   具有 `"agreement": "incommensurable"`：其来源基于不同标准进行评估，因此每个值都会标明其 `scale`，而不是强行转换为主导标准的格式。

2. **省略即未断言。** 卡片中没有 `iso639_1`（平原克里语没有 ISO 639-1 代码），也没有 `phonologicalInventory`（摄取的来源均未断言该值）—— 这些字段只是直接缺省，绝不会是 `null` 或 `[]`。

3. **溯源是一等层级。** `_fieldSources` 将每个字段映射到断言它的来源，其中 `champollion-derived-v1` 标记 Champollion 计算得出的值。`_card` 标记卡片的类型、ID、版本修订，以及校正通道可以触及的字段；`_atlas` 则标记语料库发布版本。

4. **不包含运行结果。** 卡片上的任何内容都不是方法输出的实测评分 —— chrF、FST 接受率等指标属于运行结果，以 (method, dataset, metric) 为键，存在于排行榜上。卡片仅断言资源*存在*（`resources`、`lexicalResources`、`methodSupport`）。

<CardSpecExample variant="language" />

### 区域设置卡片是投影，而非语言 \{#locale-card-example}

在语言卡片旁边存在着区域设置卡片（`fra-CA`、`cmn-Hant`）：即针对**特定地区或文字系统解析后**的语言事实，通过其 `locale` 块标识 —— 绝不能单凭代码形式来判断。区域设置卡片继承其语言的事实，解析针对文字和地区作用域的事实（`script`、`localeScoped`），并且它**不是语言**：在所有语言统计和按语言列出的清单中，请通过该 `locale` 块排除区域设置卡片。

<CardSpecExample variant="locale" />

---

## 字段参考 \{#field-reference}

下方的所有表格均遵循两条约定：

- **“envelope”** 指归属信封 —— `{agreement, consensus?, values: [{value, source, note?, scale?}]}` —— 包含*每一个*来源的主张。列为 `envelope` 的字段在仅有一个来源发声的卡片上可能表现为平铺值（例如，仅记录于 Glottolog 的语言实体带有平铺的 `name`）；使用者必须同时处理这两种情况，已发布的适配器正是这样做的。
- 除 `code` 和 `name` 之外，没有任何字段是必需的；其余所有字段在**没有来源断言时均会被省略**。每个字段的断言来源均按卡片记录在 `_fieldSources` 中，因此表格描述的是来源的*类型*，而非可能发生漂移的固定版本。

### § 1. 身份字段

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `code` | `string` | **必需。** 卡片 ID 和文件名。语言卡片使用 ISO 639-3（`crk`）；仅记录于 Glottolog 的语言实体使用其 glottocode；区域设置卡片使用区域设置代码（`fra-CA`）。 |
| `name` | envelope | **必需。** 英语参考名称（ISO 639-3 注册表、LinguaMeta、Glottolog）。 |
| `endonym` | envelope | 替代了 `nativeName`。使用者用该语言对其自身的称谓（LinguaMeta、Wikidata）。当没有来源断言时缺省 —— 我们绝不自行发明或音译自称。 |
| `alternateNames` | `string[]` | 其他见证的英语名称。 |
| `iso639_1` | `string` | 仅在存在两位字母的 ISO 639-1 代码时存在（`fra` → `"fr"`）。 |
| `isoScope` | `string` | ISO 639-3 自身的表述 —— `"Individual"`、`"Macrolanguage"`、`"Special"`（替代了 `"I"`/`"M"`/`"S"` 首字母缩写）。 |
| `isoLanguageType` | `string` | 替代了 `isoType`。ISO 639-3 自身的表述 —— `"Living"`、`"Extinct"`、`"Ancient"`、`"Historical"`、`"Constructed"`。 |
| `macrolanguage` | `string` | 该语言所属的宏语言（`crk` → `"cre"`）。来自 ISO 639-3 宏语言映射。 |
| `macrolanguageMembers` | `string[]` | 位于宏语言中枢（hub）卡片上：各个具体成员代码（`nor` → `["nno", "nob"]`）。 |
| `canonicalisedMembers` | envelope | 位于宏语言卡片上：其标签被 BCP 47 注册表合并入该宏语言标签的成员（CLDR 别名表 + SIL langtags，均附带归属）。 |
| `supersededCodes` | `string[]` | SIL 当前指向该语言的已废弃 ISO 639-3 代码 —— 记录在继承者卡片上，以确保用旧代码发布的语料库仍能解析。 |
| `codeAliases` | `string[]` | 替代了 `aliases`。解析到此卡片的代码级标识符。 |
| `bcp47` | `string` | 断言的该语言 BCP 47 标签（LinguaMeta）。 |
| `bcp47Tag` | envelope | Champollion 派生：RFC 5646 标签（最短的 ISO 639 代码胜出）。 |
| `bcp47FullTag` | envelope | 最长语言–文字–地区形式（CLDR likelySubtags + SIL langtags）。适配器从该标签派生**主要文字系统**。 |
| `modality` | `string` | `"spoken"` 或 `"signed"`，派生自 Glottolog 的谱系关系。书写是正字法属性，而非模态 —— 未书写的语言仍然具有完整的口语或手语模态。 |
| `locale` | `object` | **仅限区域设置卡片。** `{language, region, script, publishedTag, source, note}` —— 区域设置的核心标识。在统计语言数量时，请始终通过该块排除区域设置卡片，绝不能单凭代码形式来判断。 |
| `localeScoped` | `object` | 仅限区域设置卡片：针对该区域设置的地区/文字系统解析后的值（例如 `scriptName`、`cldrOfficialStatus`）。 |

### § 2. 分类字段

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `glottocode` | `string` | Glottolog 为该语言实体分配的标识符（`crk` → `"plai1258"`）。仅记录于 Glottolog 的语言实体 —— 即 Glottolog 收录但 ISO 639-3 未收录的语言 —— 使用 glottocode 作为其卡片 `code`。 |
| `classification` | `object` | 下方归类字段的容器。每个字段均独立溯源并独立省略 —— 孤立语言或归入 Glottolog 分类桶中的语言，仅包含该对象的一部分属于正常现象。 |
| `classification.family` | envelope | 各分类权威机构断言的顶级语族。Glottolog 和 WALS 是彼此独立的分类体系，并不总是一致，因此两者均予以保留并附带归属。代码检查规则 R5 会根据 Glottolog 自身的树结构检查信封内的 Glottolog 值：WALS 可以与 Glottolog 不一致，但不得错引 Glottolog。孤立语言完全不包含语族。 |
| `classification.familyGlottocode` | `string` | 该顶级语族的 glottocode（`crk` → `"algi1248"`）。 |
| `classification.genus` | `string` | WALS 的中间分类节点（`crk` → `"Algonquian"`）。这是 WALS 的概念，**不是** Glottolog 的概念 —— Glottolog 发布的是没有语属（genus）层级的任意深度树 —— 因此仅在 WALS 对该语言进行了编码时存在。 |
| `classification.ancestry` | `string[]` | Glottolog 的世系路径，表示为祖先 glottocode，根节点在前（`["algi1248", …, "plai1264"]`）。该顺序**即**断言本身：这是一条路径，绝不是按字母排序的集合。 |
| `classification.glottologBucket` | `string` | Glottolog 的非谱系分类桶 —— `"Artificial Language"`、`"Pidgin"`、`"Mixed Language"`、`"Speech Register"`、`"Unclassifiable"`、`"Unattested"`。与语族位置区分开，因为分类桶是按类型而非世系进行分类的：带有分类桶的卡片没有语族，这是忠实于事实的结果。 |
| `isIsolate` | `boolean` | Glottolog 是否将该语言分类为孤立语言。 |

切换前的卡片还包含 `genusGlottocode`。它与导致它的范畴错误一同被废弃：语属是 WALS 的概念，冠以 Glottolog 标识符意味着断言了 Glottolog 并不存在的树节点。Glottolog 的层级结构现在改由 `ancestry` 承载。

### § 3. 地理字段

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `macroarea` | `string` | Glottolog 的大区 —— `"Africa"`、`"Australia"`、`"Eurasia"`、`"North America"`、`"Papunesia"` 或 `"South America"`。 |
| `coordinates` | `object` | `{lat, lng}` —— Glottolog 的代表性坐标点。这是一个点，而非领土：它将语言标在地图上，对分布范围或边界不作任何断言。 |
| `countries` | `string[]` | Glottolog 关联到该语言的国家/地区的 ISO 3166-1 alpha-2 代码（`["CA", "US"]`）。 |
| `cldrOfficialStatus` | `string` | 某些地区授予该语言的官方地位，如 CLDR 所记录（通过 LinguaMeta 传递）—— `"Official"`、`"Regional official"`。在区域设置卡片上，针对*该区域设置*所在地区解析出的地位保存在 `localeScoped.cldrOfficialStatus` 中。 |

切换前的 `regions` 数组（带行政区划代码的各国使用者明细）和 `arealContext`（语言联盟成员资格）已被废弃：摄取的来源中没有任何一个断言它们，且无来源的人工整理无法在重构中留存。待可引用的来源接入流水线之日，地区级使用者断言便可回归；在此之前，保持缺失才是忠实的状态。

### § 4. 书写系统字段

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `scripts` | `string[]` | 替代了平铺的 `script`。**所有**见证的 ISO 15924 代码（`crk` → `["Cans", "Latn"]`），无序 —— 绝不能将 `scripts[0]` 理解为“唯一的”书写系统。主要文字系统由适配器从 `bcp47FullTag` 的最长标签中派生。 |
| `scriptNames` | `string[]` | Champollion 派生的 `scripts[]` 显示名称（`"Unified Canadian Aboriginal Syllabics"`）。 |
| `textDirection` | `string` | 替代了 `dir`。来源自身的表述 —— `"left-to-right"` / `"right-to-left"`（原为 `"ltr"`/`"rtl"`）。 |
| `suppressScript` | `string` | CLDR Suppress-Script：该文字系统对于该语言而言极为规范，以至于 BCP 47 标签将其省略（`fra` → `"Latn"`）。 |
| `script` | `string` | **仅限区域设置卡片**：经区域设置解析的文字系统（`fra-CA` → `"Latn"`、`cmn-Hant` → `"Hant"`）。语言卡片不包含平铺的文字系统字段。 |

没有见证书写系统的语言直接**没有 `scripts` 字段** —— 缺失意味着没有来源断言书写系统，而不是断言该语言是“无文字的”。（手语是此类群体中最大的类别：没有任何记音记号系统在日常读写中获得社区标准的采纳。）

### § 5. 人口统计与活力字段

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `speakerEstimates` | envelope | 每个来源的估算值，附带归属。值可以是确切数字，也可以是来源自身的范围字符串（`"10000-99999"`），来源的附加说明逐字保留在 `note` 中。`"agreement": "conflicting"` 很常见 —— 展现冲突*即是*产品价值所在；绝不取平均值或强行定论。 |
| `endangerment` | envelope | 替代了单个 `vitality` 对象。每个来源**基于其自身标准**的评估 —— 每个值都带有 `scale` 字段，且 `"agreement": "incommensurable"` 是常态，因为 ELCat、Glottolog AES 和 LinguaMeta 的词汇表彼此之间并非等价转换。适配器会根据声明的权威顺序，从单个指定来源派生出一个用于展示的*活力等级*；该等级仅用于展示 —— 完整的归属集合仍保留在卡片上。 |

Champollion 中任何*展示*的使用者数量必须与引用的 `speakerEstimates` 条目之一匹配，或者带有明确的 `champollion-derived` 溯源信息 —— 这是由卡片完整性规则强制约束的。

### § 5.5 文档与数字存在字段

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `documentation` | `object` | 替代了 `documentationDepth`。Glottolog 对该语言描述充分程度的记录，采用 Glottolog 自身的术语。 |
| `documentation.medLevel` | `string` | Glottolog 的最详尽描述级别，逐字保留 —— `"long grammar"`、`"grammar"`、`"grammar sketch"`、`"phonology"`、`"wordlist"`。 |
| `documentation.medSourceId` | `string` | 该最详尽描述在 Glottolog 参考文献目录中的文献引用键。 |
| `documentation.firstDocumented` | `number` | Glottolog 自身的首次文献记录年份列，逐字保留 —— 从切换前的顶级字段移至此处。仅存在于几百种语言中，这种稀疏性本身就值得了解。 |
| `documentation.lastDocumented` | `number` | Glottolog 的末次文献记录年份列，逐字保留 —— 存在于大约一千种语言中。 |
| `wikipediaEdition` | `object` | 替代了 `digitalPresence`。`{site, url, name}` —— 该语言存在公开的维基百科版本（`afr` → `af.wikipedia.org`）。仅记录存在性，特意**不包含条目数**：有几个版本主要由机器人生成，就翻译人员可用的意义而言，庞大的版本并不比小版本“记载得更好”。 |
| `dialectCount` | `number` | Glottolog 自身的 `child_dialect_count` 列，逐字保留 —— 仅包含直接子方言，而非整个子树。这是 Glottolog 的断言，而不是我们的算术计算：早期的规则将其标记为 `champollion-derived`，导致数千张卡片把 Glottolog 的统计归功于自身。 |

切换前 `digitalPresence` 块的其余部分（Common Voice 时长、Tatoeba 句子数量）已被停用，直至这些来源接入流水线 —— Tatoeba 语料库本身已经出现在其应属的位置，即 § 9 `resources.corpora` 下的平行语料库。

### § 6. 正式性、寄存器与性别字段

投影后的语料库在此仅包含一个字段 —— 引用的事实：

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `politenessDistinction` | envelope | 该语言是否在第二人称形式中将礼貌程度语法化。归属涵盖 Grambank GB415（二元：不存在/存在）和 WALS 45A（四个等级：无区别 / 二元 / 多级 / 避免使用代词）。由于它们属于不同的标准体系，因此每个值都会标明其 `scale`，且信封会将其报告为**不可通约（incommensurable）**，而非存在分歧。 |

**语域系统是配置，而非卡片事实。** 切换前的语料库在近一千八百张卡片上分别存储了 `formality` 文本和 `registers` 提示词 —— 几乎全都是从上述两个相同的来源生成的，然后作为手工整理的配置进行传递。图集保留了这一事实；而配置层 —— `formality`、`registers`、`gender`、`codeSwitching` —— 仍作为 **npm 包的人工策展模式**（`language-card.schema.json`）的一部分，存在于经过人工策展的语属/语族中枢卡片上，并通过[继承模型](#inheritance-model)中描述的语域系统 `extends` 合并传递给 CLI。它们不是投影的图集字段：投影语料库中没有任何卡片包含它们，图集构建也绝不会写入它们。[编写优秀的语域预设](#writing-good-register-presets)中的指南适用于该策展通道。

### § 7. 语言学档案字段

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `typologicalProfile` | `object` | 每个摄取的类型学特征对应一个键，每个值为来源自身的编码，且每个键仅在来源对该语言进行编码时存在。布尔值来自 Grambank 特征，分类字符串来自 WALS 章节；决策注册表指明了每个键对应的确切上游参数。 |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` —— 由 Champollion 针对引用的 PHOIBLE 清单计算出的数量（PHOIBLE 每行发布一个音段，不断言任何计数），因此每个值都带有 `champollion-derived` 溯源。**PHOIBLE 是声调属性的唯一权威依据**（规则 R1）：Grambank 没有声调特征，卡片上的其他任何内容均不得主张声调属性。 |
| `numeralSystem` | `object` | `{base}` —— 进位制基数，逐字取自 Chan 的 *Numeral Systems of the World's Languages*（`"decimal"`、`"quinary-vigesimal"`、`"body tally"`；包含近百种不同的值）。当 Chan 自身的基数列为空时缺省 —— 约占调查语言的一半 —— 因为先前的生成器用 `"decimal"` 填补了空白，为两千种语言凭空捏造了值。 |
| `pluralCategories` | `string[]` | CLDR 为该语言陈述的基数复数类别 —— 阿拉伯语区分 `["zero", "one", "two", "few", "many", "other"]`，法语区分其中的三种，汉语区分一种。直接从 CLDR 自身规则集的键中读取，因此这是 CLDR 的主张，而非我们的推导。替代了切换前的 `rules.plurals.categories`；国际化流水线需要借助它来确定一条消息必须提供多少种复数形式。 |

当前投影的 `typologicalProfile` 键及其上游参数：

- **WALS 章节**（分类字符串，WALS 自身的值标签）：`fusion`
  (20A)、`verbSynthesis` (22A)、`affixPreference` (26A)、`reduplication`
  (27A)、`genderCount` (30A)、`caseCount` (49A)、`wordOrder` (81A)、
  `subjectVerbOrder` (82A)、`verbalAlignment` (100A)、`negationOrder` (143A)
- **Grambank 特征**（布尔值）：`hasGenderInPronouns` (GB030)、
  `hasSexBasedGender` (GB051)、`hasNumeralClassifiers` (GB057)、`hasCoreCase`
  (GB070)、`hasObliqueCase` (GB072)、`marksPastTense` (GB083)、
  `marksPresentTense` (GB082)

切换前的 `linguisticChallenges` 和 `contactInfluences` 块不参与投影 —— 无摄取来源的研究性文本将保留在 npm 包的策展模式中，类似于 § 6 中的语域层（下方的[语言接触影响类型](#contact-influence-types)表格即服务于该通道）。`rules` 块已被废弃：其中可引用的内容作为此处的 `pluralCategories` 和 § 4 中的书写系统字段得以保留。

### § 8. 百科字段

已从卡片中停用。切换前的 `encyclopedic`（历史与方言短文、机构链接）、`culturalAphorism` 和 `varieties` 块属于卡片粒度的人工撰写文本，重构设计便将其移除。`varieties` 所涉及的成员从属事实现在已成为附带引用的标识字段（§ 1 `macrolanguageMembers` 和 `canonicalisedMembers`），而针对每种变体的工具覆盖情况则由各成员自身的卡片负责说明（`methodSupport`、`resources`）。代表性谚语未来可通过社区贡献通道在获得许可并附带引用的前提下回归；它不会作为无引用的卡片字段重新引入。

### § 9. 数字资源字段

本节中的所有内容均断言**存在性与功能性，绝非质量**：即某项资源已发布以及由谁发布 —— 绝非断言其优良、完备或可用，也绝非实测评分。方法输出的任何实测评分均是以 (method, dataset, metric) 为键的运行结果，存在于排行榜上，且严禁出现在卡片中（代码检查规则 R3）。

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `resources` | `object` | 容器：下方的每个子字段均为独立溯源的列表，在无来源断言时予以省略。 |
| `resources.fsts` | `object[]` | 已发布的有限状态形态分析器：`{name, url, publisher, license, licenceEstablished, archived}`。许可证信息随每个条目单独附带，而非假定整个目录一致 —— 许可证边界必须依据实际条款。对于多式综合语，FST 往往是唯一存在的结构化校验手段。 |
| `resources.corpora` | `object[]` | 见证该语言的平行语料库：`{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`。通过**语言对**陈述，因为平行语料库只能通过语言对来见证一种语言 —— 脱离对照语言空谈“覆盖斯瓦希里语”，是在回答一个没人提出的问题。仅陈述存在性与规模，绝非质量。 |
| `resources.monolingualCorpora` | `object[]` | 单语语料库 —— 与 `corpora` 分开存放，以避免“拥有语料库”指代两种不可比拟的事物。 |
| `resources.speech` | `object[]` | 已发布的语音资源。仅陈述存在性。 |
| `resources.keyboards` | `object[]` | 已发布的键盘布局。简单却至关重要：对于需要标准布局所没有的字符的正字法，键盘布局决定了该语言是否可输入。 |
| `resources.typology` | `object[]` | 对该语言进行*编码*的类型学数据集，附带覆盖范围：`{dataset, featuresCoded, datasetFeatureTotal}`。仅陈述存在性与范围，绝非内容 —— 某个特征所表达的具体内容不会出现在卡片上，直到有人编写出接受该特征的参数映射（被接受的特征会呈现在 § 7 的 `typologicalProfile` 中）。特征计数属于我们的算术统计，因此带有 `champollion-derived` 溯源。 |
| `lexicalResources` | `object` | 词汇存在性事实的容器。 |
| `lexicalResources.datasets` | `object[]` | 已发布的词表及其覆盖范围：`{dataset, forms, concepts, release}`。 |
| `lexicalResources.dictionaries` | `object[]` | 已发布的词典 —— 仅陈述存在性，绝非质量，且在发布者指明方向时**具备方向性**：单向词典与反向词典属于不同的资源。条目结构不尽相同（CLDF 数据集包含条目数；软件仓库包含语言对和方向）；每个条目均指明自身来源，许可证和归档状态按条目附带。 |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Champollion 基于 CLICS³ 计算的计数：见证该语言的概念数量，以及映射到两个或更多不同概念的词形数量。`champollion-derived`。 |
| `methodSupport` | `object` | 哪些翻译方法覆盖该语言 —— 仅陈述功能性，绝非评分。结构：`{total, byTier, named, truncated}`。英语包含数千条方法连接，而中位数语言仅有数十条，因此卡片保留了证据的*整体分布* —— `total` 加上各置信等级的 `byTier` 计数（`fetched`、`partially-confirmed`、`model-card-declared`）—— 并仅列出最强的条目（各 `{value, variant, source, confidence}`），设有上限。注册表**服务**始终完整列出，不受上限限制，因此服务在 `named` 中的缺失是一个确切的结论；而模型卡条目的缺失仅表示其“不属于最强之列”，所有连接在图集存储中仍可被完整查询。 |
| `metricModelSupport` | envelope | 发布了对该语言支持的评估指标模型，附带测试框架加载的模型标识符（`masakhane/africomet-mtl`）。用于驱动实际行为 —— COMET 模型选择 —— 且仍属于功能性，绝非评分。 |

**合并到上述字段中：** 切换前的 `keyboardSupport`（→
`resources.keyboards`）、`corpusAvailability`（→ `resources.corpora` /
`resources.monolingualCorpora`）以及 `databaseCoverage`（→
`resources.typology` 加 `lexicalResources` —— 数据库条目现在是附带引用的覆盖范围事实，而不是布尔值）。

**已从卡片中停用：** `omt1600`、`evalDatasets`、`pipelineReadiness` 和
`metricPlugins` —— 均无摄取来源断言，且就绪等级属于主观判断，而非引用依据。

**人工策展而非投影生成：** 评测标准声明层（`evalStandard`、`evalMetrics`、`evalPack`）保留在 npm 包的策展模式中。它们用于告知评测框架由哪个外部裁判包为语言评分（裁判，而非参赛者 —— 评测框架核心代码不包含特定语言的评分器代码）；评测框架在卡片存在这些字段时会予以读取，但目前投影语料库中没有任何卡片包含它们，图集构建也不会写入它们。评测框架的 FST 安装程序从 `resources.fsts[]` 条目（`language_cards.py` 中的 `get_fst_install_info()`）读取的 `install` 块也是如此：投影条目仅包含存在性事实。

### § 10. 出处字段

| 字段 | 结构 | 说明 |
|-------|-------|-------|
| `_fieldSources` | `object` | 存在于每张卡片中。将卡片上的每个字段路径（`"classification.family"`、`"coordinates.lat"`）映射到断言它的已排序来源 ID（`["glottolog-v5.3", "wals-v2020.5"]`）。Champollion 计算的值带有 `champollion-derived-v1`。来源 ID 均附带版本 —— `grambank-v1.0.3`、`iso639-3-20260715` —— 从而使每个断言均可追溯至做出该断言的确切发布版本。 |
| `coverage` | `object` | 存在于每张卡片中，且**由投影器计算，非任何来源断言**：`{sourceCount, componentsPresent, componentsTotal, notAttested}` —— 论及该语言的独立来源数量、有值的卡片组件在所有待填充组件中的占比，以及来源明确记录为*缺失*的值的数量（查证过并表明不存在 —— 这与从未查证是不同的事实）。正是依靠这一点，内容较少的卡片能够阐明**为何**较少，而不是显得疏于维护。 |
| `_card` | `object` | 卡片自身的元数据：`{type, id, revision, correctableFields}`。`type` 为 `"language"` 或 `"locale"`（方法和语料库卡片复用同一套投影器）；`revision` 为内容哈希，因此卡片内容的任何更改都会导致其改变；`correctableFields` 列出了包含值的字段路径 —— 即校正通道可以触及的字段。 |
| `_atlas` | `object` | `{version}` —— 语料库发布版本戳（在版本发布之间为 `"unreleased"`）。特意使用版本发布 ID，**而非**构建时间戳：时间戳会使来自相同版本锁定的两次构建因日历时间而产生差异，从而破坏让任何人都能校验图集的关键特性 —— 相同的锁定输入，必定产生逐字节相同的输出。 |

切换前的溯源块已被整体废弃：`dataSources`（被按字段划分的 `_fieldSources` 映射取代）、`supportTier`（属于计算得出的评判，被客观的 `coverage` 计数取代）、`_generated`（整个语料库均为自动生成；版本戳由 `_card.revision` 加 `_atlas.version` 承担）、`humanReviewed` 与 `notes`（属于各自拥有独立记录通道的策展内容），以及顶级的 `firstDocumented`/`lastDocumented`（移入 § 5.5 中的 `documentation`，其来源在那里做出了实际断言）。

---

## 语言代码政策

Champollion 使用 **ISO 639-3** 作为规范标识符。其他标准代码注册为别名，在运行时解析为 ISO 639-3 代码。

| 优先级 | 标准 | 示例 | 字段 | 用途 |
|----------|----------|---------|-------|-----|
| 1（规范） | ISO 639-3 | `crk` | `code` | 卡片文件名、配置键、API 参数 |
| 2（别名） | ISO 639-1 | `iu` | `codeAliases[]` | CLI 中受支持，解析为 ISO 639-3 |
| 3（别名） | BCP 47 | `fil` | `codeAliases[]` | CLI 中受支持，解析为 ISO 639-3 |
| 参考 | Glottocode | `plai1258` | `glottocode` | 仅用于分类，不在运行时使用 |

**解析顺序：** 当用户提供代码时：
1. 直接匹配 `card.code` → 命中
2. 匹配 `card.codeAliases[]` → 命中，返回规范卡片
3. 匹配 `card.iso639_1` → 命中（回退匹配）
4. 未找到 → 报错

### 迁移历史：ISO 639-1 → ISO 639-3

在 v8 之前，卡文件名在可用时使用 ISO 639-1 代码（`fr.json`、`de.json`、`ja.json`）。在 639-3 迁移中，所有卡都重命名为其 ISO 639-3 等价物：

| 之前 | 之后 | 原因 |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3 是规范 |
| `de.json` | `deu.json` | 639-3 是规范 |
| `zh.json` | `cmn.json` | 宏语言 → 默认个体 |
| `ar.json` | `arb.json` | 宏语言 → 现代标准阿拉伯语 |
| `ms.json` | `zsm.json` | 宏语言 → 标准马来语 |

**旧代码怎么处理？**
- 旧的 639-1 代码位于 `card.iso639_1`
- 旧的 639-1 代码位于 `card.codeAliases[]`（`fra` → `["fr"]`）
- `resolveCode("fr")` 在运行时返回 `"fra"` —— 向后兼容
- 用户仍可在其配置中书写 `"fr"` —— 它会被透明解析

**架构上改变了什么：**
- `_deepMerge()` 现在跳过 `null` 值（从父继承）
- `_deepMerge()` 现在设置了身份字段（代码、扩展、别名永不继承）
- `formality.default` 现在从寄存器 `isDefault: true` 标志派生
- 205 个 Grambank 派生的卡获得了结构 `formality.default` 修复
- 38 个属/族/宏语言卡提供继承目标

---

## 边界情况

### 手语
手语（例如 ASE —— 美国手语）是拥有 ISO 639-3 代码的正规语言。它们拥有地理分布和使用者数量，但是：
- `modality` 为 `"signed"` —— 这是卡片对该语言本质的肯定性断言；书写系统的缺席是一个独立的事实
- `scripts` 通常缺省（没有任何记音记号系统在日常读写中获得社区标准的采纳），不过在有来源断言之处会显示 `"Sgnw"` (SignWriting)
- `textDirection` 缺省
- `linguisticChallenges` 应涉及空间语法、分类词等

### 古代与历史语言
拉丁语（`lat`，isoLanguageType `"Historical"`）和梵语（`san`）等语言仍在特定语境（宗教仪式、学术研究）中使用，但已无母语使用者：
- `isoLanguageType` 采用 ISO 自身的状态词汇（`"Ancient"`、`"Historical"`、`"Extinct"`）—— 卡片绝不会对其进行软化或覆写
- `endangerment` 和 `speakerEstimates` 如实报告引用的来源实际评估的内容，逐字保留附加说明（第二语言社区的使用人数保留来源赋予的标签）
- `firstDocumented` / `lastDocumented` 在时间轴上定位它们

### 人工语言
世界语（`epo`，isoLanguageType `"Constructed"`）、逻辑语等：
- `classification` 可能缺省 —— Glottolog 将人工语言归入非谱系分类桶，且该分类桶绝不会显示为语族
- `contactInfluences` 反映了源素材（例如世界语借鉴了罗曼语族、日耳曼语族、斯拉夫语族）
- `endangerment` 较为特殊 —— 拥有不断壮大的使用者社区，但没有原生故土

### 宏语言
阿拉伯语（`ara`）、汉语（`zho`）、克里语（`cre`）、克丘亚语（`que`）是涵盖多种具体语言的宏语言：
- `isoScope: "Macrolanguage"` —— 作为导航中枢，绝不能用作基准测试目标
- `macrolanguageMembers` 列出各个具体成员代码；`canonicalisedMembers` 记录 BCP 47 注册表将哪些成员合并入该宏语言标签（各个注册表均附带归属）
- `methodSupport` 反映*宏语言卡片*所支持的内容（通常为标准化变体）
- 具体成员拥有各自的独立卡片，并带有指回中枢的 `macrolanguage`

### 无标准正字法的语言
许多语言（尤其是口传传统的语言）没有标准化的书写系统，或存在相互竞争的正字法：
- `scripts`、`scriptNames` 和 `textDirection` 缺省 —— 没有来源断言存在文字系统，这与断言“无文字”并非同等概念
- `notes` 应当说明正字法现状
- `linguisticChallenges` 应当注明这对机器翻译的影响（例如缺乏训练数据）

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

## 卡片事实的更新方式

卡片是**构建产物** —— 从固定的上游快照中确定性投影而来。不再有针对每张卡片的数据丰富流程：手动运行的 `enrich-*` 脚本通道已被停用，直接对卡片文件所做的编辑将在下一次构建时被删除。若要修改某项事实：

1. **注册决策。** 每个字段都是构建决策注册表中的一行：哪个上游参数为其提供数据、它如何投影，以及缺失的值代表什么含义。
2. **修复摄取层。** 错误的值属于来源处理器中的缺陷（或上游版本固定过时），绝不应该直接在卡片上打补丁。
3. **重建与切换。** 构建过程会从固定的快照中重新投影每张卡片；门禁会拦截不完整的构建、null/空值以及未通过完整性规则的卡片。

### 冲突处理

当来源发生分歧时：
1. **存储所有来源**并附带来源归属 —— 这正是归属信封的作用
2. **不要取平均值**或选边站队 —— `consensus` 仅在来源确实一致时出现
3. 在该值的 `note` 中逐字**保留各来源的附加说明**
4. 用于展示或计算的单一值**由适配器**根据声明的权威顺序**派生** —— 卡片本身保留全部分布

---

## 验证

在任何重新构建后运行代码检查工具：

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR 检查清单

提交涉及卡片的变更时（切记：修改构建逻辑，而非卡片本身）：

- [ ] 修复代码位于摄取处理器或决策注册表中 —— 没有手动编辑任何卡片文件
- [ ] 字段仅包含来源断言的值 —— 没有为“补全”卡片而填充为 `null` 或 `[]`
- [ ] `classification` 来自 Glottolog（而非手动构建）
- [ ] 每个涉及的字段溯源信息均已记录在 `_fieldSources` 中，Champollion 计算得出的值带有 `champollion-derived` 溯源
- [ ] 卡片上的任何位置均未出现方法输出的实测评分
- [ ] 代码检查与卡片完整性门禁通过且无错误

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
