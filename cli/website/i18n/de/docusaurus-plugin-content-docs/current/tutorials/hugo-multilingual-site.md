---
sidebar_position: 3
title: "Mehrsprachige Hugo-Website"
description: "Cookbook: Richten Sie eine vollständige mehrsprachige Hugo-Website ein, bei der champollion sowohl String-Dateien als auch die Übersetzung von Markdown-Inhalten übernimmt."
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

# Cookbook: Mehrsprachige Hugo-Website

Richten Sie das mehrsprachige System von Hugo ein, wobei champollion sowohl JSON-Zeichenkettendateien als auch die Übersetzung von Markdown-Inhalten verarbeitet. Dies deckt den vollständigen Arbeitsablauf von der Projekteinrichtung bis zur Produktivbereitstellung ab.

**Was Sie erstellen werden:** Eine Hugo-Website mit Englisch, Französisch und Japanisch — Zeichenkettenübersetzungen über Locale-Dateien, Inhaltsübersetzungen über die Markdown-Verarbeitung.

---

## Projektstruktur

Champollion verwendet Hugos **dateinamenbasierten** Übersetzungsmodus. Übersetzte Dateien werden im selben Verzeichnis wie die Quelldatei abgelegt, wobei dem Dateinamen ein Sprachsuffix hinzugefügt wird (z. B. `about.fr.md`):

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

:::note[Hugo i18n-Modi]
Hugo unterstützt zwei Übersetzungsstrategien: **dateinamenbasiert** (`about.fr.md` neben `about.md`) und **verzeichnisbasiert** (getrennte `content/fr/about.md`-Bäume). Champollion verwendet die dateinamenbasierte Übersetzung, da seine `getTargetContentPath()`-Funktion Zielpfade generiert, indem sie an den Namen der Quelldatei ein Sprachsuffix anhängt. Stellen Sie sicher, dass Ihre `hugo.toml` für die dateinamenbasierte Übersetzung konfiguriert ist, wenn Sie champollion verwenden.
:::

## Schritt 1: Hugo konfigurieren

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

## Schritt 2: Champollion konfigurieren

Champollion benötigt zwei konfigurierte Angaben: den Pfad zur Locale-Datei (für JSON-Zeichenketten) und das Inhaltsverzeichnis (für Markdown).

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

## Schritt 3: Quellinhalte erstellen

### Zeichenkettenübersetzungen (i18n/)

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

### Markdown-Inhalte (content/en/)

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

## Schritt 4: Die Synchronisierung ausführen

```bash
npx champollion sync
```

Champollion verarbeitet beide Typen:

1. **Zeichenkettendateien** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **Inhaltsdateien** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### Details zur Inhaltsübersetzung

Bei der Übersetzung von Markdown führt champollion automatisch Folgendes aus:

- **Schützt** Codeblöcke, Shortcodes (`{{< ... >}}`), Inline-Code und HTML
- **Übersetzt** Front-Matter-Felder (`title`, `description`, `summary`)
- **Bewahrt** alle anderen Front-Matter-Felder (`date`, `draft`, `weight`, `tags`)
- **Stellt** geschützte Blöcke nach der Übersetzung wieder her

Der Hugo-Shortcode `{{< team-grid >}}` wird unübersetzt durchgereicht.

## Schritt 5: Überprüfen

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

Navigieren Sie zu `localhost:1313/fr/` und `localhost:1313/ja/`, um die übersetzten Inhalte zu überprüfen.

## Schritt 6: Hugo-Sprachumschalter

Fügen Sie Ihrem Hugo-Layout einen Sprachumschalter hinzu:

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

## Inhalte synchron halten

Wenn Sie englische Inhalte aktualisieren, führen Sie die Synchronisierung erneut aus. Champollion übersetzt nur Dateien neu, die sich geändert haben:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

Die Lock-Datei verfolgt Inhalts-Hashes pro Datei, sodass stabile Seiten nicht neu übersetzt werden.

## Siehe auch

- **[Leitfaden zur Inhaltsübersetzung](/docs/guides/content-translation)** — Vertiefung zu Schutzmechanismen, Front Matter und Sonderfällen
- **[Framework-Integration](/docs/guides/framework-integration)** — Next.js- und React-Einrichtungen
- **[CI/CD-Leitfaden](/docs/guides/ci-cd)** — Synchronisierungen beim Push auf `content/en/` automatisieren
- **[Übersetzungsmethoden](/docs/guides/translation-methods)** — Vergleich von LLM-, TM- und Hybrid-Übersetzungsstrategien
- **[Unterstützte Sprachen](/docs/reference/supported-languages)** — Vollständige Liste der unterstützten Locales und Sprachcodes
