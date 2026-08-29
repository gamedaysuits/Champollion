---
sidebar_position: 3
title: "CI/CD"
---

# Intégration CI/CD

Automatisez les traductions dans votre pipeline de compilation.

## GitHub Actions : Synchronisation au push

Ajoutez la synchronisation des traductions à votre pipeline de compilation existant :

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

## GitHub Actions : Synchronisation planifiée

Exécutez les traductions selon un calendrier et validez automatiquement :

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

## Méthode Google Translate

Si vous utilisez la méthode Google Translate intégrée au lieu d'OpenRouter :

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## Fournisseurs LLM directs

Si vous utilisez les méthodes `openai`, `anthropic` ou `gemini` directement :

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

## API de traduction distante

Si vous utilisez un point de terminaison de traduction distant (par exemple, un service de traduction hébergé) :

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## Pipeline CI à trois niveaux

Pour une couverture i18n maximale, contrôlez votre pipeline avec les trois outils :

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

| Niveau | Commande | Quand | Objectif |
|--------|----------|-------|----------|
| **Lint** | `lint` | Pré-commit | Bloquer les validations avec des chaînes codées en dur |
| **Sync** | `sync` | Post-commit / CI | Traduire les clés manquantes et modifiées |
| **Audit** | `audit` | Étape de compilation | Échouer le déploiement si une locale est incomplète |

:::tip[Mémoire de traduction en CI]
Si votre exécuteur CI dispose d'un espace de travail persistant (ou met en cache `.champollion/`), la Mémoire de traduction s'active automatiquement — les synchronisations ultérieures ne traduisent que les clés dont le texte source a réellement changé. Pour les exécuteurs éphémères, envisagez de mettre en cache `.champollion/tm.json` entre les exécutions :

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## Voir aussi

- [Référence CLI](/docs/reference/cli) — référence complète des commandes
- [Fonctionnement de la synchronisation](/docs/concepts/how-sync-works) — comprendre la synchronisation incrémentale
- [Mémoire de traduction](/docs/concepts/translation-memory) — mise en cache et économies de coûts
- [Méthodes de traduction](/docs/guides/translation-methods) — sélection de méthode par paire
- [Portail de qualité](/docs/concepts/quality-gate) — ce qui se passe en cas d'échec des traductions
- [Configuration](/docs/getting-started/configuration) — référence de configuration
