---
sidebar_position: 5
title: Content Translation
---

# Content Translation (Hugo Markdown)

Champollion translates Hugo Markdown files — both front matter fields and body content — with full protection of code blocks, shortcodes, and structured elements.

## Setup

Set `contentDir` in your config to enable Markdown content translation:

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

## What Gets Translated

### Front Matter

Both YAML (`---`) and TOML (`+++`) delimiters are supported. By default, these fields are translated:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

All other fields (`date`, `draft`, `tags`, `weight`, `slug`, etc.) are preserved as-is. Customize with `translatableFields` in your config.

### Body Content

The full Markdown body is translated with block protection — structured elements are shielded using Unicode sentinel placeholders before translation and restored after.

## Block Protection

These elements pass through translation untouched:

| Element | Example | Protection |
|---------|---------|-----------|
| Code blocks | ``````` ```js ... ``` ``````` | Full block shielded |
| Inline code | `` `variable` `` | Shielded |
| Hugo shortcodes | `{{< figure >}}`, `{{% note %}}` | Full block shielded |
| Raw HTML | `<div>`, `<table>` | Shielded |
| Links (URLs) | `[text](https://...)` | URL preserved, text translated |
| Interpolation | `{{ .Count }}` | Shielded |

## Filename Convention

Follows Hugo's translation-by-filename pattern:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## Skip Behavior

Existing translated files are **never overwritten**. If `my-post.fr.md` already exists, it's skipped. Delete the target file to force re-translation.

## Markdown-Only Methods

:::warning[Google Translate and Markdown]
Google Translate has **no awareness** of code blocks, shortcodes, or interpolation variables. It will corrupt structured Markdown content. Use LLM methods (`llm` or `llm-coached`) for content translation — they explicitly shield structured elements.
:::

When content translation falls back from Google Translate to an LLM method, champollion logs a warning explaining why.
