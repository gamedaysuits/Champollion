---
sidebar_position: 3
title: "Hugo 多语言网站"
description: "烹饪书：使用 Champollion 设置完整的 Hugo 多语言网站，处理字符串文件和 Markdown 内容翻译。"
related:
  - label: "Content Translation"
    to: /docs/guides/content-translation
    kind: guide
    note: "Markdown and long-form content, not just strings"
  - label: "Framework Integration"
    to: /docs/guides/framework-integration
    kind: guide
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale the same setup to thirty locales"
---

# 食谱：Hugo 多语言网站

使用 champollion 设置 Hugo 的多语言系统，处理 JSON 字符串文件和 Markdown 内容翻译。本指南涵盖从项目设置到生产部署的完整工作流程。

**你将构建的内容：** 一个包含英文、法文和日文的 Hugo 网站 — 通过区域设置文件进行字符串翻译，通过 Markdown 处理进行内容翻译。

---

## 项目结构

Champollion 使用 Hugo 的**基于文件名**的翻译模式。翻译后的文件与源文件放在同一目录中，文件名中添加语言后缀（例如 `about.fr.md`）：

```
my-hugo-site/
├── content/
│   └── en/
│       ├── _index.md
│       ├── _index.fr.md           ← champollion generates
│       ├── _index.ja.md           ← champollion generates
│       ├── about.md
│       ├── about.fr.md            ← champollion generates
│       ├── about.ja.md            ← champollion generates
│       └── blog/
│           ├── first-post.md
│           ├── first-post.fr.md   ← champollion generates
│           └── first-post.ja.md   ← champollion generates
├── i18n/
│   ├── en.json
│   ├── fr.json                    ← champollion generates
│   └── ja.json                    ← champollion generates
└── hugo.toml
```

:::note[Hugo 国际化模式]
Hugo 支持两种翻译策略：**基于文件名的**（`about.fr.md` 与 `about.md` 相邻）和**基于目录的**（独立的 `content/fr/about.md` 树）。Champollion 使用基于文件名的翻译，因为其 `getTargetContentPath()` 函数通过在源文件名后附加语言后缀来生成目标路径。使用 champollion 时，请确保你的 `hugo.toml` 配置为基于文件名的翻译。
:::

## 步骤 1：配置 Hugo

```toml title="hugo.toml"
defaultContentLanguage = 'en'

[languages]
  [languages.en]
    languageName = 'English'
    weight = 1
  [languages.fr]
    languageName = 'Français'
    weight = 2
  [languages.ja]
    languageName = '日本語'
    weight = 3
```

## 步骤 2：配置 Champollion

Champollion 需要配置两项内容：区域设置文件路径（用于 JSON 字符串）和内容目录（用于 Markdown）。

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "method": "llm" },
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" }
  },
  "languages": {
    "fr": { "name": "French", "register": "Formal (vous-form)" },
    "ja": { "name": "Japanese", "register": "Polite/formal" }
  }
}
```

## 步骤 3：创建源内容

### 字符串翻译 (i18n/)

```json title="i18n/en.json"
{
  "nav": {
    "home": "Home",
    "about": "About",
    "blog": "Blog",
    "contact": "Contact"
  },
  "footer": {
    "copyright": "© 2026 My Company. All rights reserved.",
    "privacy": "Privacy Policy"
  }
}
```

### Markdown 内容 (content/en/)

```markdown title="content/en/about.md"
---
title: "About Us"
description: "Learn more about our team and mission"
date: 2026-01-15
---

We build software that helps businesses communicate across languages.

Our platform supports **real-time translation** for over 30 languages,
with specialized support for low-resource languages.

## Our Mission

Language should never be a barrier to understanding.

## The Team

{{< team-grid >}}
```

## 步骤 4：运行同步

```bash
npx champollion sync
```

Champollion 处理两种类型：

1. **字符串文件**（`i18n/en.json` → `i18n/fr.json`、`i18n/ja.json`）
2. **内容文件**（`content/en/about.md` → `content/en/about.fr.md`、`content/en/about.ja.md`）

### 内容翻译详情

翻译 Markdown 时，champollion 会自动：

- **保护** 代码块、短代码（`{{< ... >}}`）、内联代码和 HTML
- **翻译** 前置元数据字段（`title`、`description`、`summary`）
- **保留** 所有其他前置元数据字段（`date`、`draft`、`weight`、`tags`）
- **恢复** 翻译后的受保护块

Hugo 短代码 `{{< team-grid >}}` 保持未翻译状态。

## 步骤 5：验证

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

导航到 `localhost:1313/fr/` 和 `localhost:1313/ja/` 查看翻译后的内容。

## 步骤 6：Hugo 语言切换器

在你的 Hugo 布局中添加语言切换器：

```html title="layouts/partials/language-switcher.html"
<nav class="language-switcher">
  {{ range $.Site.Home.AllTranslations }}
    <a href="{{ .Permalink }}"
       {{ if eq .Lang $.Site.Language.Lang }}class="active"{{ end }}>
      {{ .Language.LanguageName }}
    </a>
  {{ end }}
</nav>
```

## 保持内容同步

更新英文内容时，再次运行同步。Champollion 仅重新翻译已更改的文件：

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

锁定文件跟踪每个文件的内容哈希值，因此稳定的页面不会被重新翻译。

## 另请参阅

- **[内容翻译指南](/docs/guides/content-translation)** — 深入了解保护、前置元数据和边界情况
- **[框架集成](/docs/guides/framework-integration)** — Next.js 和 React 设置
- **[CI/CD 指南](/docs/guides/ci-cd)** — 在推送到 `content/en/` 时自动化同步
- **[翻译方法](/docs/guides/translation-methods)** — 比较 LLM、TM 和混合翻译策略
- **[支持的语言](/docs/reference/supported-languages)** — 支持的区域设置和语言代码的完整列表
