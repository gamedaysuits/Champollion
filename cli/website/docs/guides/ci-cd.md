---
sidebar_position: 3
title: CI/CD
---

# CI/CD Integration

Automate translations in your build pipeline.

## GitHub Actions: Sync on Push

Add translation sync to your existing build pipeline:

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

## GitHub Actions: Scheduled Sync

Run translations on a schedule and auto-commit:

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

## Google Translate Method

If using the built-in Google Translate method instead of OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## Direct LLM Providers

If using `openai`, `anthropic`, or `gemini` methods directly:

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

If using a remote translation endpoint (e.g., a hosted translation service):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## Three-Layer CI Pipeline

For maximum i18n coverage, gate your pipeline with all three tools:

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

| Layer | Command | When | Purpose |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | Block commits with hardcoded strings |
| **Sync** | `sync` | Post-commit / CI | Translate missing and changed keys |
| **Audit** | `audit` | Build step | Fail deployment if any locale is incomplete |

:::tip[Translation Memory in CI]
If your CI runner has a persistent workspace (or caches `.champollion/`), Translation Memory kicks in automatically — subsequent syncs only translate keys whose source text actually changed. For ephemeral runners, consider caching `.champollion/tm.json` between runs:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## See Also

- [CLI Reference](/docs/reference/cli) — full command reference
- [How Sync Works](/docs/concepts/how-sync-works) — understanding incremental sync
- [Translation Memory](/docs/concepts/translation-memory) — caching and cost savings
- [Translation Methods](/docs/guides/translation-methods) — method selection per pair
- [Quality Gate](/docs/concepts/quality-gate) — what happens when translations fail
- [Configuration](/docs/getting-started/configuration) — config reference
