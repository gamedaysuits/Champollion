---
sidebar_position: 3
title: "CI/CD"
---

# Integração CI/CD

Automatize traduções em seu pipeline de build.

## GitHub Actions: Sincronizar ao fazer Push

Adicione sincronização de tradução ao seu pipeline de build existente:

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

## GitHub Actions: Sincronização Agendada

Execute traduções em um cronograma e faça commit automático:

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

Se estiver usando o método Google Translate integrado em vez de OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## Provedores LLM Diretos

Se estiver usando `openai`, `anthropic`, ou `gemini` métodos diretamente:

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

## API de Tradução Remota

Se estiver usando um endpoint de tradução remoto (por exemplo, um serviço de tradução hospedado):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## Pipeline CI de Três Camadas

Para cobertura máxima de i18n, gate seu pipeline com as três ferramentas:

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

| Camada | Comando | Quando | Propósito |
|-------|---------|--------|----------|
| **Lint** | `lint` | Pré-commit | Bloquear commits com strings hardcoded |
| **Sync** | `sync` | Pós-commit / CI | Traduzir chaves faltantes e alteradas |
| **Audit** | `audit` | Etapa de build | Falhar deployment se alguma locale estiver incompleta |

:::tip[Memória de Tradução em CI]
Se seu executor de CI tem um workspace persistente (ou faz cache de `.champollion/`), a Memória de Tradução entra em ação automaticamente — sincronizações subsequentes traduzem apenas chaves cujo texto de origem realmente mudou. Para executores efêmeros, considere fazer cache de `.champollion/tm.json` entre execuções:

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## Veja Também

- [Referência CLI](/docs/reference/cli) — referência completa de comandos
- [Como Sync Funciona](/docs/concepts/how-sync-works) — entendendo sincronização incremental
- [Memória de Tradução](/docs/concepts/translation-memory) — cache e economia de custos
- [Métodos de Tradução](/docs/guides/translation-methods) — seleção de método por par
- [Quality Gate](/docs/concepts/quality-gate) — o que acontece quando traduções falham
- [Configuração](/docs/getting-started/configuration) — referência de configuração
