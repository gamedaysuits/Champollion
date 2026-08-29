---
sidebar_position: 3
title: "CI/CD"
---

# Integrasyon ng CI/CD

I-automate po ang mga pagsasalin sa inyong build pipeline.

## GitHub Actions: Pag-sync sa Push

Idagdag po ang translation sync sa inyong kasalukuyang build pipeline:

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

## GitHub Actions: Naka-iskedyul na Pag-sync

Patakbuhin po ang mga pagsasalin ayon sa iskedyul at awtomatikong mag-commit:

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

## Paraan ng Google Translate

Kung ginagamit po ang built-in na paraan ng Google Translate sa halip na OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## Mga Direktang LLM Provider

Kung direktang ginagamit po ang mga paraang `openai`, `anthropic`, o `gemini`:

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

## Remote Translation API

Kung gumagamit po ng remote translation endpoint (hal., isang hosted translation service):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## Tatlong-Layer na CI Pipeline

Para sa pinakamalawak na i18n coverage, i-gate po ang inyong pipeline gamit ang lahat ng tatlong tool:

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

| Layer | Command | Kailan | Layunin |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | Harangin ang mga commit na may mga hardcoded string |
| **Sync** | `sync` | Post-commit / CI | Isalin ang mga nawawala at nabagong key |
| **Audit** | `audit` | Build step | Ipabigo ang deployment kung may alinmang locale na hindi kumpleto |

:::tip[Translation Memory sa CI]
Kung ang inyong CI runner ay may persistent na workspace (o nag-cache ng `.champollion/`), awtomatikong gagana ang Translation Memory — isasalin lamang ng mga susunod na sync ang mga key na talagang nagbago ang source text. Para sa mga ephemeral na runner, isaalang-alang ang pag-cache ng `.champollion/tm.json` sa pagitan ng mga run:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## Tingnan Din

- [CLI Reference](/docs/reference/cli) — kumpletong command reference
- [Paano Gumagana ang Sync](/docs/concepts/how-sync-works) — pag-unawa sa incremental sync
- [Translation Memory](/docs/concepts/translation-memory) — caching at pagtitipid sa gastos
- [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods) — pagpili ng paraan kada pair
- [Quality Gate](/docs/concepts/quality-gate) — kung ano ang nangyayari kapag nabigo ang mga pagsasalin
- [Configuration](/docs/getting-started/configuration) — config reference
