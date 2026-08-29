---
sidebar_position: 3
title: "Site Hugo multilingue"
description: "Guide pratique : configurer un site Hugo multilingue complet avec Champollion gérant à la fois la traduction des fichiers de chaînes de caractères et du contenu Markdown."
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

# Livre de recettes : Site multilingue Hugo

Configurez le système multilingue de Hugo avec champollion gérant à la fois les fichiers de chaînes JSON et la traduction de contenu Markdown. Cela couvre le flux de travail complet, de la configuration du projet au déploiement en production.

**Ce que vous allez construire :** Un site Hugo avec l'anglais, le français et le japonais — traductions de chaînes via fichiers de paramètres régionaux, traductions de contenu via traitement Markdown.

---

## Structure du projet

Champollion utilise le mode de traduction **basé sur le nom de fichier** de Hugo. Les fichiers traduits sont placés dans le même répertoire que le fichier source, avec un suffixe de langue ajouté au nom de fichier (par exemple `about.fr.md`) :

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

:::note[Modes i18n Hugo]
Hugo prend en charge deux stratégies de traduction : **basée sur le nom de fichier** (`about.fr.md` à côté de `about.md`) et **basée sur le répertoire** (arbres `content/fr/about.md` séparés). Champollion utilise la traduction basée sur le nom de fichier, car sa fonction `getTargetContentPath()` génère les chemins cibles en ajoutant un suffixe de langue au nom de fichier source. Assurez-vous que votre `hugo.toml` est configuré pour la traduction basée sur le nom de fichier lors de l'utilisation de champollion.
:::

## Étape 1 : Configurer Hugo

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

## Étape 2 : Configurer Champollion

Champollion nécessite deux éléments configurés : le chemin du fichier de paramètres régionaux (pour les chaînes JSON) et le répertoire de contenu (pour Markdown).

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

## Étape 3 : Créer le contenu source

### Traductions de chaînes (i18n/)

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

### Contenu Markdown (content/en/)

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

## Étape 4 : Exécuter la synchronisation

```bash
npx champollion sync
```

Champollion traite les deux types :

1. **Fichiers de chaînes** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **Fichiers de contenu** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### Détails de la traduction de contenu

Lors de la traduction de Markdown, champollion effectue automatiquement :

- **Protection** des blocs de code, des shortcodes (`{{< ... >}}`), du code en ligne et du HTML
- **Traduction** des champs du front matter (`title`, `description`, `summary`)
- **Préservation** de tous les autres champs du front matter (`date`, `draft`, `weight`, `tags`)
- **Restauration** des blocs protégés après la traduction

Le shortcode Hugo `{{< team-grid >}}` passe sans être traduit.

## Étape 5 : Vérifier

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

Accédez à `localhost:1313/fr/` et `localhost:1313/ja/` pour examiner le contenu traduit.

## Étape 6 : Sélecteur de langue Hugo

Ajoutez un sélecteur de langue à votre mise en page Hugo :

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

## Maintenir le contenu synchronisé

Lorsque vous mettez à jour le contenu en anglais, exécutez à nouveau la synchronisation. Champollion ne retraduit que les fichiers qui ont changé :

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

Le fichier de verrouillage suit les hachages de contenu par fichier, de sorte que les pages stables ne sont pas retraduits.

## Voir aussi

- **[Guide de traduction de contenu](/docs/guides/content-translation)** — Exploration approfondie de la protection, du front matter et des cas limites
- **[Intégration de framework](/docs/guides/framework-integration)** — Configurations Next.js et React
- **[Guide CI/CD](/docs/guides/ci-cd)** — Automatisez les synchronisations lors de la transmission à `content/en/`
- **[Méthodes de traduction](/docs/guides/translation-methods)** — Comparez les stratégies de traduction LLM, TM et hybrides
- **[Langues prises en charge](/docs/reference/supported-languages)** — Liste complète des paramètres régionaux et codes de langue pris en charge
