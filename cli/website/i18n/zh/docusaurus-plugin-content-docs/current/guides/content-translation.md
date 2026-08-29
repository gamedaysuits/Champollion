---
sidebar_position: 5
title: "内容翻译"
---

# Hugo Markdown 内容翻译

Champollion 翻译 Hugo Markdown 文件 — 包括前置元数据字段和正文内容 — 完全保护代码块、短代码和结构化元素。

## 设置

在配置中设置 `contentDir` 以启用 Markdown 内容翻译：

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## 翻译内容

### 前置元数据

支持 YAML (`---`) 和 TOML (`+++`) 分隔符。默认情况下，这些字段会被翻译：

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

所有其他字段 (`date`、`draft`、`tags`、`weight`、`slug` 等) 保持原样。使用配置中的 `translatableFields` 自定义。

### 正文内容

完整的 Markdown 正文通过块保护进行翻译 — 结构化元素在翻译前使用 Unicode 哨兵占位符进行屏蔽，翻译后恢复。

## 块保护

这些元素在翻译过程中保持不变：

| 元素 | 示例 | 保护 |
|---------|---------|-----------|
| 代码块 | ``````` ```js ... ``` ``````` | 完整块屏蔽 |
| 行内代码 | `` `variable` `` | 屏蔽 |
| Hugo 短代码 | `{{< figure >}}`、`{{% note %}}` | 完整块屏蔽 |
| 原始 HTML | `<div>`、`<table>` | 屏蔽 |
| 链接 (URL) | `[text](https://...)` | URL 保留，文本翻译 |
| 插值 | `{{ .Count }}` | 屏蔽 |

## 文件名约定

遵循 Hugo 的按文件名翻译模式：

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## 跳过行为

现有翻译文件**永远不会被覆盖**。如果 `my-post.fr.md` 已存在，则跳过。删除目标文件以强制重新翻译。

## 仅限 Markdown 的方法

:::warning[Google Translate 和 Markdown]
Google Translate **完全不了解**代码块、短代码或插值变量。它会破坏结构化的 Markdown 内容。使用 LLM 方法（`llm` 或 `llm-coached`）进行内容翻译——它们明确保护结构化元素。
:::

当内容翻译从 Google Translate 回退到 LLM 方法时，champollion 会记录一条警告，说明原因。
