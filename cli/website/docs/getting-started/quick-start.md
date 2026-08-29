---
sidebar_position: 2
title: Quick Start
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Quick Start

Translate your first locale file in 60 seconds.

## 1. Set Up Your Locale Files

Create a source locale file. Champollion supports JSON, TOML, YAML and more — see the [CLI reference](/docs/reference/cli) for the full list:

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Set Your API Key

Pick a provider and set the key:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...
```

Get a free Gemini key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Get an OpenRouter key at [openrouter.ai](https://openrouter.ai).

## 3. Run Sync

```bash
npx champollion sync
```

:::tip[Using Gemini?]
If you chose Option B (Gemini), add `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion will:
1. Auto-detect `locales/en.json` as the source
2. Find (or prompt for) target languages
3. Translate all keys
4. Write `locales/fr.json`, `locales/ja.json`, etc.
5. Create `.champollion.lock` to track what's been translated

## 4. Check the Results

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## What Happens Next?

When you change a source string, champollion detects the change via SHA-256 hash tracking and re-translates only that key on the next sync:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

The unchanged key (`hero.subtitle`) is served from champollion's **Translation Memory** cache — no API call, no cost. The cache is built automatically during every sync and stored at `.champollion/tm.json`.

## Optional: Create a Config File

For more control, generate a config file:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

The guided wizard walks you through each language's **register presets** — pre-built tone/formality instructions tuned to its linguistic system. French has T-V presets (vouvoiement vs tutoiement), Korean has speech levels (해요체 vs 합쇼체 vs 해체), Japanese has keigo options (です/ます vs 丁寧語).

Or create a config manually with preset keys:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-2.5-flash"
}
```

Run `npx champollion init` to browse available presets for each language.

## Optional: Watch Mode

Auto-translate when your source file changes:

```bash
npx champollion watch
```

## Next Steps

- **[Configuration](/docs/getting-started/configuration)** — Full config reference
- **[Translation Methods](/docs/guides/translation-methods)** — Choose the right method per pair
- **[Translation Memory](/docs/concepts/translation-memory)** — How caching saves you money on re-runs
- **[Working with Professional Translators](/docs/guides/professional-translators)** — Export XLIFF for human review
- **[Framework Integration](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automate translations in your pipeline
- **[Troubleshooting](/docs/guides/troubleshooting)** — Common issues and solutions
