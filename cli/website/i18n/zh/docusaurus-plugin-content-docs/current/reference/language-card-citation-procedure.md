---
title: "语言卡片引用流程"
sidebar_label: "Citation Procedure"
---

# 语言卡引用程序

*Champollion 如何确保语言卡上的每项声明都可追溯到主要来源。*

---

## 1. 问题所在

语言卡包含事实性声明——使用者数量、濒危状态、接触影响、形态学属性、排版约定、方法支持——这些**必须是可验证的**。目前：

- `dataSources` 字段是一个平面字符串数组（例如 `["cldr-48", "glottolog-5.3"]`）
- 没有按字段的引用粒度
- "约 280 万使用者"或"易危"等声明没有可追溯的来源
- 审阅者无法确定哪个来源支持哪项声明

> [!CAUTION]
> **无来源的声明是无法验证的声明。** 对于一个将自己定位为专业严谨的项目，语言卡上的每项断言都必须可追溯到特定的、有版本的主要来源。

---

## 2. 权威来源（按优先级排序）

对于每种类型的声明，以下来源是权威的。**始终优先使用最高排名的可用来源。**

### 分类和身份

| 优先级 | 来源 | 涵盖范围 | 许可证 | 如何引用 |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org)（Max Planck） | 语族、血缘关系、glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org)（SIL） | ISO 代码、宏语言 | 免费 | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info)（Max Planck） | 属定义、类型学特征 | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org)（Unicode） | 区域设置代码、文字代码、复数规则 | Unicode ToS | `cldr-{version}` |

### 使用者人口统计和活力

| 优先级 | 来源 | 涵盖范围 | 许可证 | 如何引用 |
|---|---|---|---|---|
| 1 | 国家人口普查数据 | 官方使用者数量 | 各不相同（通常为公开） | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | 使用者估计、EGIDS | 专有（订阅） | `ethnologue-{edition}` |
| 3 | [UNESCO 地图集](http://www.unesco.org/languages-atlas/) | 濒危状态 | 免费 | `unesco-atlas-{year}` |
| 4 | 已发表的学术论文 | 地区使用者调查 | 按论文许可证 | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | 菲律宾语言 | 学术 | `katig-{year}` |

> [!WARNING]
> **切勿使用 Wikipedia、LLM 生成的文本或自有知识作为人口统计声明的主要来源。** 这些最多是二级/三级来源。始终追溯到主要数据。

### 方法支持（翻译 API 覆盖范围）

| 方法 | 验证来源 | 如何验证 | 如何引用 |
|---|---|---|---|
| Google Translate | [语言列表](https://cloud.google.com/translate/docs/languages) | API 调用或文档页面 | `google-translate-{date}` |
| DeepL | [语言列表](https://www.deepl.com/docs-api/translate-text/) | API 调用 | `deepl-api-{date}` |
| Microsoft Translator | [语言列表](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | 文档页面 | `ms-translator-{date}` |
| LibreTranslate | [语言列表](https://libretranslate.com/languages) | API 调用 | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + 模型卡 | `nllb-200-{date}` |
| LLM | 始终 `true` | 不适用（质量各异） | `llm-assumed` |

### DLS（数字语言支持）

| 优先级 | 来源 | 涵盖范围 | 如何引用 |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | DLS 分数（原始 143 个工具） | `simons-2022` |
| 2 | Ethnologue 第 27 版及以后 | DLS 分数（扩展 211 个工具） | `ethnologue-{edition}-dls` |

### 排版、复数、文字

| 优先级 | 来源 | 涵盖范围 | 如何引用 |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | 复数规则、引号、数字格式 | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | 文字代码 | `iso15924-{date}` |
| 3 | 已发表的语法书 | 特定语言规则 | `{author}-{year}` |

### 接触影响

| 优先级 | 来源 | 涵盖范围 | 如何引用 |
|---|---|---|---|
| 1 | 已发表的历史语言学论文 | 借词研究、接触历史 | `{author}-{year}` |
| 2 | 参考语法书 | 结构影响描述 | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | 类型学比较 | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **接触影响声明最难获得来源。** 诸如"西班牙语上层语言、深层、1571–1898"之类的声明需要历史语言学专业知识。如果找不到已发表的来源，请用 `"citation_needed": true` 标记该声明，而不是猜测。

---

## 3. 引用程序（逐步）

### 创建新语言卡时

1. **从自动填充字段开始：**
   - 运行 `node scripts/build-language-tree.mjs --enrich` → 从 Glottolog 填充 `classification`
   - 在 `dataSources` 中记录 `"glottolog-{version}"`

2. **添加 CLDR 数据：**
   - 从 CLDR 查找复数规则、引号、文字代码
   - 在 `dataSources` 中记录 `"cldr-{version}"`

3. **研究使用者人口统计：**
   - 首先检查国家人口普查数据
   - 与 Ethnologue 交叉参考（如果可用）
   - 与 UNESCO 地图集交叉参考
   - 在 `dataSources` 中记录所有咨询的来源

4. **验证方法支持：**
   - 检查每个 API 的语言列表（不是记忆、不是假设）
   - 记录验证日期

5. **研究接触影响：**
   - 查找已发表的历史语言学论文
   - 用引用记录时期、类型、深度
   - 如果不存在已发表的来源，请在影响条目中添加 `"citation_needed": true`

6. **研究活力：**
   - 检查 Ethnologue 的 EGIDS
   - 检查 UNESCO 地图集的濒危状态
   - 注意来源之间的任何差异

7. **填充 `dataSources`：**
   - 列出咨询的每个来源（不仅仅是提供数据的来源）
   - 使用上表中的引用格式

### 更新现有卡时

1. **不要在不更新 `dataSources` 的情况下更改事实性声明**
2. **如果更新使用者数量**，删除旧来源并添加新来源
3. **如果添加方法支持**，针对 API 进行验证并记录日期
4. **为所有方法支持检查添加日期戳** — API 覆盖范围变化频繁

---

## 4. 建议的架构增强：按字段引用

### 当前架构（平面 `dataSources`）

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**问题：** 哪些字段来自 CLDR？哪些来自 Glottolog？哪些没有引用？

### 建议的增强：结构化 `dataSources`

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### 迁移路径

这是一个**向后兼容**的更改：
1. 现有卡保持平面数组（仍然有效）
2. 新卡使用结构化格式
3. 架构验证接受两种格式
4. 在审查现有卡时逐步迁移

> [!TIP]
> **用脚本验证。** 添加一个 `validate-citations.mjs` 脚本，该脚本：
> - 检查每张卡至少有 `classification` 和 `vitality` 来源
> - 标记具有平面 `dataSources` 数组的卡以供升级
> - 警告没有日期戳验证的 `methodSupport` 条目

---

## 5. 质量检查清单

在合并任何语言卡更改之前，验证：

- [ ] 每个使用者数量都有来源（人口普查或 Ethnologue，不是 Wikipedia）
- [ ] 每个 UNESCO/EGIDS 状态都有来源
- [ ] 每个方法支持标志都针对实际 API 进行了验证（不是假设）
- [ ] 每个接触影响都有已发表的学术来源或标记为 `citation_needed`
- [ ] 分类是从 Glottolog 自动填充的（不是手工构建）
- [ ] `dataSources` 列出了所有咨询的来源
- [ ] 没有声明仅依赖于 LLM 生成的知识
- [ ] 如果母语使用者审查了卡，`humanReviewed` 设置为审查者的标识符和日期

---

## 6. `humanReviewed` 字段

语言卡架构包括一个 `humanReviewed` 字段，目前在所有卡上都是 `null`。当母语使用者或合格的语言学家审查卡时，应填充此字段：

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **社区审查是黄金标准。** 自动化数据和学术论文提供基础，但母语使用者的审查是最终验证。这对以下方面特别关键：
> - 接触影响声明（社区成员知道实际使用哪些借词）
> - 活力评估（社区成员知道儿童是否在说这种语言）
> - 正式系统（学术描述可能会遗漏日常使用模式）

---

## 7. 本程序的参考资料

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — 免费
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Unicode 使用条款
5. Ethnologue: https://www.ethnologue.com — 专有（订阅）
6. UNESCO 地图集: http://www.unesco.org/languages-atlas/ — 免费
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Champollion 语言卡规范: `cli/website/docs/reference/language-card-spec.md`
