---
sidebar_position: 3
title: "Multilingual na Site ng Hugo"
description: "Cookbook: i-set up ang isang kumpletong multilingual na site ng Hugo, kung saan pinangangasiwaan ng champollion ang pagsasalin ng parehong mga string file at Markdown content."
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

# Cookbook: Multilingual na Hugo Site

I-set up ang multilingual system ng Hugo na gumagamit ng champollion para pangasiwaan ang parehong mga JSON string file at pagsasalin ng Markdown content. Saklaw nito ang kumpletong workflow mula sa pag-set up ng proyekto hanggang sa deployment sa production.

**Ang inyong bubuuin:** Isang Hugo site na may English, French, at Japanese — mga pagsasalin ng string sa pamamagitan ng locale files, at mga pagsasalin ng content sa pamamagitan ng Markdown processing.

---

## Estruktura ng Proyekto

Ginagamit ng Champollion ang **filename-based** translation mode ng Hugo. Inilalagay ang mga naisaling file sa parehong directory ng source file, na may language suffix na idinadagdag sa filename (hal. `about.fr.md`):

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

:::note[Mga Mode ng Hugo i18n]
Sinusuportahan ng Hugo ang dalawang estratehiya sa pagsasalin: **filename-based** (`about.fr.md` sa tabi ng `about.md`) at **directory-based** (magkakahiwalay na mga tree ng `content/fr/about.md`). Gumagamit ang Champollion ng filename-based translation dahil ang function nitong `getTargetContentPath()` ay bumubuo ng mga target path sa pamamagitan ng pagdaragdag ng language suffix sa source filename. Tiyaking naka-configure ang inyong `hugo.toml` para sa filename-based translation kapag gumagamit ng champollion.
:::

## Hakbang 1: I-configure ang Hugo

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

## Hakbang 2: I-configure ang Champollion

Kailangang i-configure ang dalawang bagay para sa Champollion: ang locale file path (para sa JSON strings) at ang content directory (para sa Markdown).

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

## Hakbang 3: Gumawa ng Source Content

### Mga Pagsasalin ng String (i18n/)

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

## Hakbang 4: Patakbuhin ang Sync

```bash
npx champollion sync
```

Pinoproseso ng Champollion ang parehong uri:

1. **Mga string file** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **Mga content file** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### Mga Detalye ng Pagsasalin ng Content

Kapag nagsasalin ng Markdown, awtomatikong ginagawa ng champollion ang mga sumusunod:

- **Sinasangga** ang mga code block, shortcode (`{{< ... >}}`), inline code, at HTML
- **Isinasalin** ang mga front matter field (`title`, `description`, `summary`)
- **Pinapanatili** ang lahat ng iba pang front matter field (`date`, `draft`, `weight`, `tags`)
- **Ibinabalik** ang mga sinanggahang block pagkatapos ng pagsasalin

Ang Hugo shortcode na `{{< team-grid >}}` ay dumadaan nang hindi isinasalin.

## Hakbang 5: I-verify

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

Pumunta sa `localhost:1313/fr/` at `localhost:1313/ja/` upang suriin ang naisaling content.

## Hakbang 6: Hugo Language Switcher

Magdagdag ng language switcher sa inyong Hugo layout:

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

## Pagpapanatiling Naka-sync ang Content

Kapag in-update ninyo ang English content, patakbuhin muli ang sync. Muling isinasalin lamang ng Champollion ang mga file na nagbago:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

Sinusubaybayan ng lock file ang content hashes kada file, kaya hindi muling isinasalin ang mga stable na page.

## Tingnan Din

- **[Gabay sa Pagsasalin ng Content](/docs/guides/content-translation)** — Masusing pagtalakay sa shielding, front matter, at mga edge case
- **[Integrasyon sa Framework](/docs/guides/framework-integration)** — Mga setup para sa Next.js at React
- **[Gabay sa CI/CD](/docs/guides/ci-cd)** — I-automate ang mga sync sa push sa `content/en/`
- **[Mga Paraan ng Pagsasalin](/docs/guides/translation-methods)** — Paghambingin ang LLM, TM, at hybrid translation strategies
- **[Mga Sinusuportahang Wika](/docs/reference/supported-languages)** — Kumpletong listahan ng mga sinusuportahang locale at language code
