---
sidebar_position: 2
title: "Traduzir 30 Idiomas"
description: "Cookbook: escale um projeto de 3 idiomas para 30 usando mistura de método por pares, batching e integração com CI."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Livro de Receitas: Traduzir 30 Idiomas

Escale um projeto de alguns poucos locales para cobertura global. Este livro de receitas o guia pela seleção de método, otimização de custos e integração com CI para uma implantação multilíngue real.

**Cenário:** Você tem um app SaaS com `en`, `fr`, `es`. Você precisa adicionar 27 idiomas a mais em três níveis de requisitos de qualidade.

---

## Passo 1: Categorize Seus Idiomas

Nem todos os 30 idiomas precisam da mesma abordagem. Agrupe-os pela qualidade do método disponível:

| Nível | Idiomas | Método | Por quê |
|------|-----------|--------|-----|
| **Nível 1 — Premium** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | Mercados de alto valor, gramática nuançada |
| **Nível 2 — Padrão** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | Alto volume, bem suportado pelo Google |
| **Nível 3 — Orientado** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + plugins | Baixo recurso, requerem aplicação de terminologia |

## Passo 2: Configure Por Par

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**Nota:** Idiomas não listados em `pairs` herdam `defaultMethod: "google-translate"`. Você não precisa listar todos os 30.

:::info
O suporte a `crk` está em desenvolvimento — veja [Suporte a um Idioma de Baixo Recurso](/docs/network/community/low-resource-languages) para status e diretrizes de contribuição.
:::

## Passo 3: Configure as Chaves de API

Você precisará de ambas as chaves de API para esta configuração:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## Passo 4: Faça uma Execução de Teste Primeiro

Sempre visualize antes de traduzir 30 idiomas:

```bash
npx champollion sync --dry
```

Revise a saída. Ela mostrará:
- Quais pares usam qual método
- Quantas chaves são novas/alteradas por locale
- Chamadas de API estimadas por nível

## Passo 5: Execute a Sincronização

```bash
npx champollion sync
```

Champollion processa cada par independentemente. Os pares do Nível 2 usando Google Translate serão rápidos. Os pares LLM do Nível 1 serão mais lentos, mas de qualidade superior. Os pares orientados do Nível 3 usam os dados de coaching do plugin.

### Atualizações Incrementais

Após a sincronização inicial, as execuções subsequentes traduzem apenas chaves **alteradas ou novas**:

```bash
# Only keys that changed since last sync
npx champollion sync
```

O arquivo de lock (`.champollion.lock`) rastreia o que foi traduzido, então você nunca retraduz conteúdo estável.

## Passo 6: Audite a Qualidade

Verifique o status de todos os pares de idiomas:

```bash
npx champollion status
```

Isso gera uma tabela mostrando o método, modelo, nível de qualidade de cada par e se dados de coaching ou pontuações de benchmark estão disponíveis.

### A saída respeitou seus registros?

No Passo 2 você declarou um [registro](/glossary#term-register) por idioma — `"Polite/formal"` para japonês, `"Formal (Sie)"` para alemão. (Novo no termo? O glossário explica em linguagem simples.) Essas instruções entram no prompt de tradução, mas um prompt é um pedido, não uma garantia.

O [harness de Rede](/docs/network/specifications/harness) — a mesma ferramenta que alimenta o leaderboard público — pode medir a aderência de registro e estilo em uma amostra de suas traduções. Suas métricas de estilo de escrita verificam cada saída contra o registro esperado (marcadores formais/informais, pronomes T–V, contrações, desvio de comprimento de sentença) e relatam um `style_consistency_rate` em toda a execução. Você também pode apontá-lo para um perfil de voz de marca personalizado com `--style-profile`.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

Duas ressalvas honestas: essas métricas são **informacionais** (nunca entram na pontuação composta do leaderboard), e a detecção de formalidade é baseada em marcadores — um detector de desvio, não um julgamento humano. Detalhes e definições de métricas: [Métricas de estilo de escrita e registro](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## Passo 7: Integração com CI

Adicione ao seu fluxo de trabalho do GitHub Actions para que as traduções permaneçam atualizadas a cada push:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## Estimativa de Custo

Para um projeto com 500 chaves de origem em 30 idiomas:

| Nível | Idiomas | Método | Custo Aproximado |
|------|-----------|--------|-----------------|
| Nível 1 (5 idiomas) | ja, ko, zh, de, pt | GPT-4o | ~$2,50/sincronização completa |
| Nível 2 (18 idiomas) | it, nl, pl, etc. | Google Translate | ~$0,90/sincronização completa |
| Nível 3 (4 idiomas) | crk, oj, mi, haw | GPT-4o-mini orientado | ~$0,40/sincronização completa |
| **Total** | **30 idiomas** | **Misto** | **~$3,80/sincronização completa** |

Sincronizações incrementais (5–20 chaves alteradas) custam uma fração de uma sincronização completa.

## Veja Também

- [Métodos de Tradução](/docs/guides/translation-methods) — Como cada método de tradução funciona e quando usá-lo
- [Especificação de Plugin](/docs/reference/plugin-spec) — Crie dados de coaching para qualquer um de seus idiomas do Nível 3
- [Guia de CI/CD](/docs/guides/ci-cd) — Padrões avançados de CI incluindo compilações de visualização de PR
- [Quality Gate](/docs/concepts/quality-gate) — Como Champollion valida cada tradução antes de escrevê-la
- [Idiomas Suportados](/docs/reference/supported-languages) — Lista completa de códigos de idioma e compatibilidade de método
- [Métricas de estilo de escrita e registro](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — Meça a aderência de registro/estilo com o harness de avaliação (métricas informacionais)
- [Glossário: registro](/glossary#term-register) — O que "registro" significa, em linguagem simples
- [Suporte a um Idioma de Baixo Recurso](/docs/network/community/low-resource-languages) — Adicione dados de coaching para idiomas sem cobertura ampla de MT
