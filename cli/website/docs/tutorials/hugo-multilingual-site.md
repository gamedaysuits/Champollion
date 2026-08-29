---
sidebar_position: 3
title: "Hugo Multilingual Site"
description: "Cookbook: set up a full Hugo multilingual site with champollion handling both string files and Markdown content translation."
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

# Cookbook: Hugo Multilingual Site

Set up Hugo's multilingual system with champollion handling both JSON string files and Markdown content translation. This covers the complete workflow from project setup to production deployment.

**What you'll build:** A Hugo site with English, French, and Japanese — string translations via locale files, content translations via Markdown processing.

---

## Project Structure

Champollion uses Hugo's **filename-based** translation mode. Translated files are placed in the same directory as the source file, with a language suffix added to the filename (e.g. `about.fr.md`):

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

:::note[Hugo i18n Modes]
Hugo supports two translation strategies: **filename-based** (`about.fr.md` next to `about.md`) and **directory-based** (separate `content/fr/about.md` trees). Champollion uses filename-based translation because its `getTargetContentPath()` function generates target paths by appending a language suffix to the source filename. Make sure your `hugo.toml` is configured for filename-based translation when using champollion.
:::

## Step 1: Configure Hugo

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

## Step 2: Configure Champollion

Champollion needs two things configured: the locale file path (for JSON strings) and the content directory (for Markdown).

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

## Step 3: Create Source Content

### String Translations (i18n/)

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

### Markdown Content (content/en/)

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

## Step 4: Run the Sync

```bash
npx champollion sync
```

Champollion processes both types:

1. **String files** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **Content files** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### Content Translation Details

When translating Markdown, champollion automatically:

- **Shields** code blocks, shortcodes (`{{< ... >}}`), inline code, and HTML
- **Translates** front matter fields (`title`, `description`, `summary`)
- **Preserves** all other front matter fields (`date`, `draft`, `weight`, `tags`)
- **Restores** shielded blocks after translation

The Hugo shortcode `{{< team-grid >}}` passes through untranslated.

## Step 5: Verify

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

Navigate to `localhost:1313/fr/` and `localhost:1313/ja/` to review the translated content.

## Step 6: Hugo Language Switcher

Add a language switcher to your Hugo layout:

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

## Keeping Content in Sync

When you update English content, run sync again. Champollion only retranslates files that have changed:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

The lock file tracks content hashes per file, so stable pages aren't retranslated.

## See Also

- **[Content Translation Guide](/docs/guides/content-translation)** — Deep dive into shielding, front matter, and edge cases
- **[Framework Integration](/docs/guides/framework-integration)** — Next.js and React setups
- **[CI/CD Guide](/docs/guides/ci-cd)** — Automate syncs on push to `content/en/`
- **[Translation Methods](/docs/guides/translation-methods)** — Compare LLM, TM, and hybrid translation strategies
- **[Supported Languages](/docs/reference/supported-languages)** — Full list of supported locales and language codes
