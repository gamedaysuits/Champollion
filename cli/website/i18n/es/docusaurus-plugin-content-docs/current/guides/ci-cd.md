---
sidebar_position: 3
title: "CI/CD"
---

# Integración CI/CD

Automatice traducciones en su pipeline de compilación.

## GitHub Actions: Sincronizar al hacer push

Agregue sincronización de traducciones a su pipeline de compilación existente:

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

## GitHub Actions: Sincronización programada

Ejecute traducciones según un cronograma y confirme automáticamente:

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

## Método Google Translate

Si utiliza el método Google Translate integrado en lugar de OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## Proveedores LLM directos

Si utiliza métodos `openai`, `anthropic` o `gemini` directamente:

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

## API de traducción remota

Si utiliza un endpoint de traducción remoto (por ejemplo, un servicio de traducción alojado):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## Pipeline CI de tres capas

Para cobertura máxima de i18n, controle su pipeline con las tres herramientas:

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

| Capa | Comando | Cuándo | Propósito |
|-------|---------|--------|----------|
| **Lint** | `lint` | Pre-commit | Bloquear confirmaciones con cadenas codificadas |
| **Sync** | `sync` | Post-commit / CI | Traducir claves faltantes y modificadas |
| **Audit** | `audit` | Paso de compilación | Fallar el despliegue si alguna configuración regional está incompleta |

:::tip[Memoria de Traducción en CI]
Si su ejecutor de CI tiene un espacio de trabajo persistente (o almacena en caché `.champollion/`), la Memoria de Traducción se activa automáticamente — las sincronizaciones posteriores solo traducen claves cuyo texto de origen cambió realmente. Para ejecutores efímeros, considere almacenar en caché `.champollion/tm.json` entre ejecuciones:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## Véase También

- [Referencia CLI](/docs/reference/cli) — referencia completa de comandos
- [Cómo funciona Sync](/docs/concepts/how-sync-works) — entendiendo la sincronización incremental
- [Memoria de traducción](/docs/concepts/translation-memory) — almacenamiento en caché y ahorro de costos
- [Métodos de traducción](/docs/guides/translation-methods) — selección de método por par
- [Quality Gate](/docs/concepts/quality-gate) — qué sucede cuando las traducciones fallan
- [Configuración](/docs/getting-started/configuration) — referencia de configuración
