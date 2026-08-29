---
sidebar_position: 9
title: "Guia do Agente: Usando champollion"
description: "Como agentes de IA podem instalar, configurar e executar champollion para traduzir arquivos de locale."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Guia do Agente: Usando champollion

champollion é uma ferramenta CLI que traduz os arquivos de locale do seu app com um único comando. Este guia é para agentes de IA (ou desenvolvedores trabalhando com agentes de IA) que querem ir de zero a arquivos de locale traduzidos rapidamente.

:::tip[Já familiarizado?]
Se você só precisa dos comandos, vá para a [Referência CLI](/docs/reference/cli). Se quer construir e fazer benchmark de um método de tradução, veja o [Guia do Agente de Rede](/docs/network/getting-started/agent-guide).
:::

---

## Configuração do Ambiente

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**Requisitos:**
- Node.js 20.11+ (ESM nativo)
- Uma chave de API para seu provedor de tradução

**Configuração da chave de API** — champollion precisa de pelo menos uma chave dependendo de quais métodos você usa:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion lê `.env.local` e `.env` automaticamente (prioridade: `process.env` → `.env.local` → `.env`). Obtenha uma chave OpenRouter em [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Primeiro Sync

Champollion detecta automaticamente seus arquivos de locale, seu formato (JSON, TOML ou YAML) e seus idiomas de destino:

```bash
npx champollion sync
```

**O que acontece:**
1. Carrega `champollion.config.json` (ou detecta automaticamente as configurações)
2. Escaneia seu arquivo de locale de origem, achata chaves aninhadas
3. Compara contra `.champollion.lock` (hashes SHA-256 de valores previamente traduzidos)
4. Verifica `.champollion/tm.json` para traduções em cache (Memória de Tradução)
5. Traduz apenas **chaves alteradas, ausentes ou obsoletas** via o método configurado
6. Executa o quality gate (5 verificações) em cada tradução
7. Escreve traduções aprovadas no arquivo de locale de destino
8. Atualiza o arquivo de lock e cache de TM

Em uma re-execução típica após alterar uma chave, a etapa 4 serve 142 chaves do cache e a etapa 5 traduz 1 chave. É por isso que os syncs subsequentes são rápidos e baratos.

---

## Configuração

Crie `champollion.config.json` na raiz do seu projeto:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

Pares de chaves usam **dois-pontos** (`en:fr`), não hífen — hífens são reservados para códigos de locale regional como `es-MX`.

Campos principais:

| Campo | Propósito | Padrão |
|-------|----------|--------|
| `inputLocale` | Idioma de origem | `en` |
| `languages` | Idiomas de destino (array ou objeto) | `[]` |
| `pairs` | Sobrescrita por par (chaves `"src:tgt"`) com config de método | opcional |
| `localesDir` | Onde os arquivos de locale vivem | `./locales` |
| `model` | Modelo LLM para métodos `llm`/`llm-coached` | `google/gemini-3.5-flash` |
| `batchSize` | Chaves por chamada de API | 80 (LLM); Google Translate limita a 128 segmentos/requisição |
| `jsonConcurrency` | Traduções paralelas de locale para chaves JSON | 50 |
| `contentConcurrency` | Chamadas de API paralelas para tradução de conteúdo | 48 (Docusaurus docs), 12 (Hugo `contentDir`) |

Referência completa: [Configuração](/docs/getting-started/configuration)

---

## Métodos de Tradução

| Método | Quando usar | Custo | Chave de API necessária |
|--------|------------|-------|------------------------|
| **`llm`** | Propósito geral, bom para idiomas bem-recursos | Por token (dependente do modelo) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | Quando você tem regras de gramática/dicionário para o idioma de destino | Por token + contexto de coaching | `OPENROUTER_API_KEY` |
| **`google-translate`** | Idiomas de alto recurso onde GT funciona bem | $20/milhão de caracteres | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Pipeline customizado hospedado atrás de um endpoint HTTP | Determinado pelo servidor | Nenhum (endpoint cuida da autenticação) |
| **`plugin`** | Método pré-empacotado instalado localmente | Varia | Varia |

Detalhes: [Métodos de Tradução](/docs/guides/translation-methods)

---

## Dados de Coaching

Para pares `llm-coached`, dados de coaching orientam o LLM com conhecimento linguístico explícito. Crie um arquivo de coaching:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

Referencie-o na configuração do seu par:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

O quality gate verifica que os termos do dicionário realmente aparecem na saída — violações são registradas como avisos `[TERM]`.

Detalhes: [Dados de Coaching](/docs/concepts/coaching-data)

---

## Quality Gate

Cada tradução passa por cinco verificações automatizadas antes de ser escrita no disco:

| Verificação | O que detecta | Exemplo |
|-------------|--------------|---------|
| **Vazio/em branco** | Modelo não retornou nada | `""` |
| **Echo de origem** | Modelo retornou a entrada em inglês inalterada | `"Welcome"` para japonês |
| **Loop de alucinação** | Trigramas repetidos | `"Qo' Qo' Qo' Qo'"` |
| **Inflação de comprimento** | Saída é 4×+ mais longa que a origem | Origem de 10 caracteres → saída de 50 caracteres |
| **Conformidade de script** | Script errado para o locale | Texto latino para locale árabe |

Falhas são registradas com prefixo `[GATE]`. Sem fallbacks silenciosos — se uma tradução falhar, é reportada, não silenciosamente aceita.

Detalhes: [Quality Gate](/docs/concepts/quality-gate)

---

## Memória de Tradução

Champollion cacheia traduções em `.champollion/tm.json`, indexadas por texto de origem + locale + método. Em syncs subsequentes, chaves inalteradas são servidas do cache — sem chamada de API, sem custo.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

Para contornar o cache em uma execução: `npx champollion sync --no-tm`

Detalhes: [Memória de Tradução](/docs/concepts/translation-memory)

---

## Arquivos Gerados

Champollion cria vários arquivos no seu projeto. Saiba o que são para não deletar ou fazer commit acidentalmente dos errados:

| Arquivo | Propósito | Git? |
|---------|----------|------|
| `.champollion.lock` | Hashes SHA-256 dos valores de origem traduzidos (detecção de mudanças) | **Sim** — faça commit |
| `.champollion-content.lock` | Mesmo, mas para arquivos de conteúdo Markdown/MDX | **Sim** — faça commit |
| `.champollion/` | Diretório de estado interno (cache `tm.json`, exportações XLIFF, backups) | **Não** — adicione ao gitignore; `tm.json` é um cache local (veja [Configuração](/docs/getting-started/configuration)) |
| Arquivos de coaching que você cria (ex. `coaching/fr.json`) | Seu conhecimento linguístico | **Sim** — faça commit destes |
| `champollion.config.json` | Configuração do projeto | **Sim** — faça commit |

---

## Padrões Comuns

**Traduzir todos os pares configurados:**
```bash
npx champollion sync
```
O Champollion traduz todos os locales em paralelo. Com o cache de TM, apenas as chaves alteradas fazem requisições à API (pares inalterados são servidos do cache, portanto, uma sincronização completa tem baixo custo).

**Traduzir apenas pares específicos:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` restringe a execução ao(s) par(es) nomeado(s); as verificações de prontidão e os gastos se aplicam apenas a esses pares. Informar um par que não está no seu grafo de pares configurados gera um erro explícito com a lista de pares configurados — nunca um no-op silencioso.

**Modo de conteúdo (Markdown/MDX para Docusaurus, Hugo, etc.):**
```bash
npx champollion sync --content-dir ./content
```
Traduz docs, posts de blog e arquivos de conteúdo junto com JSON de locale. A tradução de conteúdo roda em paralelo; ajuste com `--content-concurrency`.

**Dry run (visualizar sem escrever):**
```bash
npx champollion sync --dry-run
```

**Forçar re-tradução de chaves específicas:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Forçar re-tradução de todos os arquivos de conteúdo:**
```bash
npx champollion sync --force-content
```

**Verificar status de tradução:**
```bash
npx champollion status
```
Mostra cobertura, níveis de qualidade e informações de plugin para cada par.

**Auditar fallbacks não traduzidos:**
```bash
npx champollion audit
```
Lista todos os valores de fallback `[EN]` que precisam de tradução.

---

## Solução de Problemas

| Problema | Solução |
|----------|---------|
| `OPENROUTER_API_KEY not set` | Exporte a chave ou adicione-a a `.env` na raiz do seu projeto |
| `No locale files found` | Defina `localesDir` na config, ou garanta que seus arquivos de locale correspondam à nomenclatura padrão (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Seu locale de destino recebeu texto latino em vez do script esperado — tente um modelo diferente ou adicione dados de coaching |
| `[GATE] Source echo` | O modelo retornou inglês inalterado — dados de coaching ou um modelo diferente geralmente corrigem isso |
| Todas as traduções em cache | Execute com `--no-tm` para contornar o cache, ou `--force-keys` para chaves específicas |
| Conflitos de arquivo de lock | `.champollion.lock` usa hashes SHA-256 — conflitos de merge são seguros de resolver mantendo qualquer versão, depois re-executando sync |

---

## Próximos Passos

- [Quick Start](/docs/getting-started/quick-start) — walkthrough completo de introdução
- [Referência CLI](/docs/reference/cli) — cada comando e flag
- [Como Funciona](/docs/how-it-works) — o pipeline de sync explicado
- [O Eval Harness Bridge](/docs/guides/bridge) — como champollion se conecta à Rede
- **Quer construir seu próprio método de tradução?** Veja o [Guia do Agente de Rede](/docs/network/getting-started/agent-guide) — construa um método, prove que funciona no leaderboard público, e compita por um prêmio se/quando um estiver aberto (prêmios são um mecanismo planejado — veja [Limitações Honestas](/docs/network/honest-limitations)).
