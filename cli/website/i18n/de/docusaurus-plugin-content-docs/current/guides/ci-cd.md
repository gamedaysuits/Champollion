---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD-Integration

Automatisieren Sie Übersetzungen in Ihrer Build-Pipeline.

## GitHub Actions: Synchronisierung bei Push

Fügen Sie die Übersetzungssynchronisierung zu Ihrer bestehenden Build-Pipeline hinzu:

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

## GitHub Actions: Geplante Synchronisierung

Führen Sie Übersetzungen nach einem Zeitplan aus und committen Sie sie automatisch:

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

## Google-Translate-Methode

Wenn Sie die integrierte Google-Translate-Methode anstelle von OpenRouter verwenden:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## Direkte LLM-Anbieter

Wenn Sie die Methoden `openai`, `anthropic` oder `gemini` direkt verwenden:

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

## Remote-Übersetzungs-API

Wenn Sie einen Remote-Übersetzungsendpunkt verwenden (z. B. einen gehosteten Übersetzungsdienst):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## Dreischichtige CI-Pipeline

Für maximale i18n-Abdeckung sichern Sie Ihre Pipeline mit allen drei Tools ab:

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

| Schicht | Befehl | Wann | Zweck |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-Commit | Commits mit fest codierten Zeichenfolgen blockieren |
| **Sync** | `sync` | Post-Commit / CI | Fehlende und geänderte Schlüssel übersetzen |
| **Audit** | `audit` | Build-Schritt | Deployment fehlschlagen lassen, wenn eine Locale unvollständig ist |

:::tip[Translation Memory in CI]
Wenn Ihr CI-Runner über einen persistenten Arbeitsbereich verfügt (oder `.champollion/` zwischenspeichert), wird Translation Memory automatisch aktiviert — nachfolgende Synchronisierungen übersetzen nur Schlüssel, deren Quelltext sich tatsächlich geändert hat. Für kurzlebige Runner sollten Sie in Erwägung ziehen, `.champollion/tm.json` zwischen den Durchläufen zwischenzuspeichern:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## Siehe auch

- [CLI-Referenz](/docs/reference/cli) — vollständige Befehlsreferenz
- [Wie die Synchronisierung funktioniert](/docs/concepts/how-sync-works) — die inkrementelle Synchronisierung verstehen
- [Translation Memory](/docs/concepts/translation-memory) — Zwischenspeicherung und Kosteneinsparungen
- [Übersetzungsmethoden](/docs/guides/translation-methods) — Methodenauswahl pro Sprachpaar
- [Quality Gate](/docs/concepts/quality-gate) — was passiert, wenn Übersetzungen fehlschlagen
- [Konfiguration](/docs/getting-started/configuration) — Konfigurationsreferenz
