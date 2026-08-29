---
sidebar_position: 3
title: "Hugo Meertalige Site"
description: "Kookboek: stel een volledige Hugo meertalige site in met champollion voor zowel de vertaling van stringbestanden als Markdown-inhoud."
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

# Kookboek: Hugo Meertalige Site

Stel Hugo's meertalig systeem in met champollion dat zowel JSON-stringbestanden als Markdown-inhoudsvertaling afhandelt. Dit behandelt de volledige workflow van projectopzet tot productie-implementatie.

**Wat u bouwt:** Een Hugo-site met Engels, Frans en Japans — stringvertalingen via locale-bestanden, inhoudsvertalingen via Markdown-verwerking.

---

## Projectstructuur

Champollion gebruikt Hugo's **bestandsnaam-gebaseerde** vertaalmodus. Vertaalde bestanden worden in dezelfde map geplaatst als het bronbestand, met een taalachtervoesel toegevoegd aan de bestandsnaam (bijv. `about.fr.md`):

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

:::note[Hugo i18n-modi]
Hugo ondersteunt twee vertaalstrategieën: **op bestandsnaam gebaseerd** (`about.fr.md` naast `about.md`) en **op map gebaseerd** (afzonderlijke `content/fr/about.md`-bomen). Champollion gebruikt op bestandsnaam gebaseerde vertaling omdat de functie `getTargetContentPath()` doelpaden genereert door een taalachtervoeging aan de bronbestandsnaam toe te voegen. Zorg ervoor dat uw `hugo.toml` is geconfigureerd voor op bestandsnaam gebaseerde vertaling wanneer u champollion gebruikt.
:::

## Stap 1: Hugo configureren

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

## Stap 2: Champollion configureren

Champollion heeft twee geconfigureerde zaken nodig: het pad naar het locale-bestand (voor JSON-strings) en de inhoudsmap (voor Markdown).

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

## Stap 3: Broninhoud aanmaken

### Stringvertalingen (i18n/)

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

### Markdown-inhoud (content/en/)

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

## Stap 4: De synchronisatie uitvoeren

```bash
npx champollion sync
```

Champollion verwerkt beide typen:

1. **Stringbestanden** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **Inhoudsbestanden** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### Details van inhoudsvertaling

Bij het vertalen van Markdown doet champollion automatisch het volgende:

- **Afschermen** van codeblokken, shortcodes (`{{< ... >}}`), inline code en HTML
- **Vertalen** van front matter-velden (`title`, `description`, `summary`)
- **Bewaren** van alle overige front matter-velden (`date`, `draft`, `weight`, `tags`)
- **Herstellen** van afgeschermde blokken na vertaling

De Hugo-shortcode `{{< team-grid >}}` wordt onvertaald doorgegeven.

## Stap 5: Verifiëren

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

Navigeer naar `localhost:1313/fr/` en `localhost:1313/ja/` om de vertaalde inhoud te bekijken.

## Stap 6: Hugo-taalkiezer

Voeg een taalkiezer toe aan uw Hugo-lay-out:

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

## Inhoud gesynchroniseerd houden

Wanneer u Engelstalige inhoud bijwerkt, voert u de synchronisatie opnieuw uit. Champollion vertaalt alleen bestanden opnieuw die zijn gewijzigd:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

Het vergrendelingsbestand houdt inhoudshashen per bestand bij, zodat stabiele pagina's niet opnieuw worden vertaald.

## Zie ook

- **[Handleiding inhoudsvertaling](/docs/guides/content-translation)** — Diepgaande uitleg over afscherming, front matter en randgevallen
- **[Framework-integratie](/docs/guides/framework-integration)** — Next.js- en React-configuraties
- **[CI/CD-handleiding](/docs/guides/ci-cd)** — Synchronisaties automatiseren bij push naar `content/en/`
- **[Vertaalmethoden](/docs/guides/translation-methods)** — Vergelijk LLM-, TM- en hybride vertaalstrategieën
- **[Ondersteunde talen](/docs/reference/supported-languages)** — Volledige lijst van ondersteunde locales en taalcodes
