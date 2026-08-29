---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD-integratie

Automatiseer vertalingen in uw build-pipeline.

## GitHub Actions: Synchroniseren bij push

Voeg vertaalsynchronisatie toe aan uw bestaande build-pipeline:

```yaml title=".github/workflows/deploy.yml"
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - run: npm run build
```

## GitHub Actions: Geplande synchronisatie

Voer vertalingen uit op een schema en commit automatisch:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          git add i18n/ content/ locales/ messages/
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git push
```

## Google Translate-methode

Als u de ingebouwde Google Translate-methode gebruikt in plaats van OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## Directe LLM-providers

Als u de methoden `openai`, `anthropic` of `gemini` rechtstreeks gebruikt:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx champollion sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx champollion sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx champollion sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx champollion sync --method deepl
```

## Externe vertaal-API

Als u een extern vertaaleindpunt gebruikt (bijv. een gehoste vertaalservice):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## Drielaagse CI-pipeline

Voor maximale i18n-dekking beveiligt u uw pipeline met alle drie de tools:

```yaml
jobs:
  i18n:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      # 1. Catch hardcoded strings before they ship
      - run: npx champollion lint

      # 2. Translate missing keys
      - run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}

      # 3. Fail if any locale is incomplete
      - run: npx champollion audit
```

| Laag | Opdracht | Wanneer | Doel |
|------|---------|---------|------|
| **Lint** | `lint` | Vóór commit | Commits met hardgecodeerde teksten blokkeren |
| **Sync** | `sync` | Na commit / CI | Ontbrekende en gewijzigde sleutels vertalen |
| **Audit** | `audit` | Build-stap | Implementatie blokkeren als een locale onvolledig is |

:::tip[Vertaalgeheugen in CI]
Als uw CI-runner een persistente werkruimte heeft (of `.champollion/` cachet), wordt Vertaalgeheugen automatisch geactiveerd — volgende synchronisaties vertalen alleen sleutels waarvan de brontekst daadwerkelijk is gewijzigd. Voor tijdelijke runners kunt u overwegen om `.champollion/tm.json` tussen runs te cachen:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## Zie ook

- [CLI-referentie](/docs/reference/cli) — volledige opdrachtreference
- [Hoe synchronisatie werkt](/docs/concepts/how-sync-works) — inzicht in incrementele synchronisatie
- [Vertaalgeheugen](/docs/concepts/translation-memory) — caching en kostenbesparingen
- [Vertaalmethoden](/docs/guides/translation-methods) — methodeselectie per taalpaar
- [Kwaliteitspoort](/docs/concepts/quality-gate) — wat er gebeurt wanneer vertalingen mislukken
- [Configuratie](/docs/getting-started/configuration) — configuratiereference
