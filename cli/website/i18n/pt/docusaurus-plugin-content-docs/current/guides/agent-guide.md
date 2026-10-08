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

| Campo | Finalidade | Padrão |
|-------|------------|--------|
| `inputLocale` | Idioma de origem | `en` |
| `languages` | Idiomas de destino (array ou objeto) | `[]` |
| `pairs` | Substituições por par (chaves `"src:tgt"`) com configuração de método | opcional |
| `localesDir` | Onde ficam os arquivos de localidade | `./locales` |
| `model` | Modelo LLM para os métodos `llm`/`llm-coached` | `google/gemini-3.8-flash` |
| `batchSize` | Chaves por chamada de API | 80 (LLM); o Google Translate limita em 128 segmentos/requisição |
| `jsonConcurrency` | Traduções paralelas de localidade para chaves JSON | 50 |
| `contentConcurrency` | Chamadas de API paralelas para tradução de conteúdo | 48 (docs do Docusaurus), 12 (`contentDir`) |

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
|-------------|---------------|---------|
| **Vazio/em branco** | O modelo não retornou nada | `""` |
| **Eco da origem** | O modelo retornou a entrada em inglês sem alterações | `"Welcome"` para japonês |
| **Loop de alucinação** | Trigramas repetidos | `"Qo' Qo' Qo' Qo'"` |
| **Inflação de tamanho** | A saída é superior a 4× o tamanho da origem (exatamente 4× passa) | origem de 10 caracteres → saída de 50 caracteres |
| **Conformidade de escrita** | Escrita incorreta para a localidade | Texto em alfabeto latino para localidade árabe |

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

| Arquivo | Finalidade | Git? |
|---------|------------|------|
| `.champollion.lock` | Hashes SHA-256 dos valores de origem traduzidos (detecção de alterações), além de, por localidade: o que a sincronização gravou, chaves deixadas pendentes por um redo, chaves retidas após uma recusa | **Sim** — faça commit disto |
| `.champollion-replaced-edits.jsonl` | Traduções editadas manualmente que uma sincronização substituiu, com sua redação (gravado apenas quando isso acontece) | **Sim** — faça commit disto |
| `.champollion-content.lock` | O mesmo, mas para arquivos de conteúdo Markdown/MDX | **Sim** — faça commit disto |
| `.champollion/` | Diretório de estado interno (cache `tm.json`, exportações XLIFF, backups) | **Não** — adicione ao .gitignore; `tm.json` é um cache local (consulte [Configuração](/docs/getting-started/configuration)) |
| Arquivos de orientação criados por você (ex.: `coaching/fr.json`) | Seu conhecimento linguístico | **Sim** — faça commit destes |
| `champollion.config.json` | Configuração do projeto | **Sim** — faça commit disto |

---

## Padrões Comuns

**Traduzir todos os pares configurados:**
```bash
npx champollion sync
```
O Champollion traduz todas as localidades em paralelo. Com o cache de TM, apenas chaves alteradas consultam a API (pares inalterados são servidos a partir do cache, tornando uma sincronização completa econômica).

**Traduzir apenas pares específicos:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` restringe a execução ao(s) par(es) especificado(s); as verificações de prontidão e os gastos se aplicam apenas a esses pares. Especificar um par que não esteja no grafo de pares configurado falha explicitamente exibindo a lista de pares configurados — nunca uma operação silenciosa sem efeito.

**Como escrever um par.** Um par do projeto é escrito da forma como `champollion.config.json` o define como chave, `en:fr`. `sync`, `verify` e `serve` também leem `en>fr` e `en-fr`, e `en-pt-BR` é comparado aos pares que você configurou. Os comandos de rede (`network register-corpus`, `leaderboard`, `recommend`, `submit`) escrevem um par `eng>crk`, o formato que o leaderboard armazena, e leem `eng-crk` e `eng:crk` da mesma forma. Lá, um par contendo apenas hifens deve ser composto por dois códigos de duas ou três letras (`eng-crk`). Um código com seu próprio hífen precisa de `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` também poderia significar `eng-pt` e `BR`, portanto é recusado, nunca adivinhado. No terminal (shell), coloque a forma `>` entre aspas: `--pair "eng>crk"`. Sem aspas, o shell redireciona a saída para um arquivo chamado `crk`.

**Modo de conteúdo (uma pasta de Markdown/MDX: um `content/` do Hugo ou qualquer pasta; a documentação do Docusaurus é encontrada sem ele):**
```bash
npx champollion sync --content-dir ./content
```
Traduz documentações, postagens de blog e arquivos de conteúdo juntamente com o JSON da localidade. Cada tradução é gravada ao lado de sua origem como `<name>.<locale>.md`; edições que um revisor fizer nela são mantidas quando a origem for alterada em outro ponto ([Tradução de Conteúdo](/docs/guides/content-translation#reviewing-and-editing-translations)). A tradução de conteúdo é executada em paralelo; ajuste com `--content-concurrency`.

**Dry run (visualizar sem escrever):**
```bash
npx champollion sync --dry-run
```

**Forçar re-tradução de chaves específicas:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Reprocessar todos os arquivos de conteúdo (o texto em cache é reutilizado, portanto o texto inalterado não tem custo):**
```bash
npx champollion sync --force-content
```

**Traduzir arquivos de conteúdo específicos do zero (cobrado), ou limitar uma execução a alguns arquivos:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**Execução legível por máquina:** `--json` grava um objeto JSON por linha (NDJSON), cada um com um `level`: no stdout, mensagens `info` e `ok`, registros `event` (`"event": "cost"` — a estimativa, antes do controle `--max-cost` — e um `"event": "file"` por arquivo de conteúdo e localidade) e, por último, o `{"level": "summary", "command": "sync", …}` de encerramento; no stderr, linhas `warn` e `error`, também em JSON. Selecione o resumo pelo seu nível, nunca apenas pela posição da linha: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. O código de saída `2` indica execução parcial (parte do trabalho foi concluída, algo falhou).

Na estimativa (evento `cost` e `costEstimate` no resumo), `totalEstimatedCost` é `null` sempre que qualquer parte não tiver preço conhecido — nunca uma soma parcial, nunca `0` para desconhecido; `knownEstimatedCost` contém a parte precificada, `unknownCost.reason` indica os pares sem preço e `unknownCost.notes` informa o que não possui preço e o motivo — `{ subject, pairs, note }`, como o nome de um modelo que não consta na lista do OpenRouter (provável erro de digitação, acompanhado dos nomes listados mais próximos), um modelo listado sem preço por token ou uma lista de preços que não pôde ser lida. Um modelo nesta máquina (um endpoint `local` ou `api` em `localhost`/`127.0.0.1`/`::1`) é precificado como `0` com `"local": true`. O campo `sentToModel` do resumo conta as chaves enviadas ao método nesta execução (`tmHits`: servidas a partir do cache). O resumo de uma simulação (dry run) inclui `preflight: { ready, failures }` — `ready: false` significa que a execução real seria interrompida e terminaria com código de saída `1` (uma chave ausente ou um servidor de modelos necessário para a execução que não responde), embora a simulação em si termine com `0` ([códigos de saída](/docs/reference/cli#sync-exit-codes)). Com `--max-cost`, ele também inclui `maxCost: { cap, estimatedCost, wouldStop }` — `wouldStop: true` (com `exitCode: 2` e o `reason`) significa que a execução real seria interrompida no limite máximo antes de qualquer chamada de API. `realRun: { exitCode, wouldStop, reasons }` é o código de saída com o qual a execução real terminaria, até onde uma prévia consegue prever: a verificação prévia (preflight) e o limite, além do que a deixaria parcial — chaves retidas, mensagens no plural no disco sem uma forma que o idioma utiliza que ele não solicitaria novamente (contabilizadas no `totalPluralGaps` da simulação). Uma simulação não verifica nada (`verify: { "ran": false }`). Execute a simulação com os mesmos `--method`/`--model` da execução real: sem eles, ela verifica o método especificado na configuração.

**Verificar o status da tradução:**
```bash
npx champollion status
```
Mostra o método, o modelo, a cobertura e informações de plug-in de cada par (um `qualityTier` apenas quando a configuração define um — um rótulo, não uma medição).

**Auditar fallbacks não traduzidos:**
```bash
npx champollion audit
```
Lista todos os valores de fallback `[EN]` que precisam de tradução.

---

## Solução de Problemas

| Problema | Correção |
|----------|----------|
| `OPENROUTER_API_KEY not set` | Exporte a chave ou adicione-a a `.env` na raiz do seu projeto |
| `No locale files found` | Defina `localesDir` na configuração ou garanta que os arquivos de localidade sigam a nomenclatura padrão (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Sua localidade de destino recebeu texto em alfabeto latino em vez da escrita esperada — tente um modelo diferente ou adicione dados de orientação (coaching) |
| `[GATE] Source echo` | O modelo retornou o inglês sem alterações — dados de orientação ou um modelo diferente geralmente corrigem isso |
| Todas as traduções em cache | Execute com `--no-tm` para ignorar o cache, ou `--force-keys` para chaves específicas |
| Conflitos no lockfile | O `.champollion.lock` armazena hashes — um conflito de mesclagem pode ser resolvido com segurança mantendo qualquer uma das versões e, em seguida, executando a sincronização novamente. Manter o registro por localidade do outro lado pode fazer com que alguns valores sejam lidos como editados manualmente (um redo em lote então os mantém e os nomeia; `--redo keys:` substitui um) — nunca o contrário |
| Chaves "retidas" (held back) | O controle de qualidade recusou a resposta desse modelo anteriormente; uma sincronização simples não a reenvia (cobrando pela mesma resposta). `champollion sync --redo keys:<key>` solicita novamente; ou adicione um `fallback`, liste-o em `noTranslate` ou escreva manualmente |

---

## Próximos Passos

- [Quick Start](/docs/getting-started/quick-start) — walkthrough completo de introdução
- [Referência CLI](/docs/reference/cli) — cada comando e flag
- [Como Funciona](/docs/how-it-works) — o pipeline de sync explicado
- [O Eval Harness Bridge](/docs/guides/bridge) — como champollion se conecta à Rede
- **Quer construir seu próprio método de tradução?** Veja o [Guia do Agente de Rede](/docs/network/getting-started/agent-guide) — construa um método, prove que funciona no leaderboard público, e compita por um prêmio se/quando um estiver aberto (prêmios são um mecanismo planejado — veja [Limitações Honestas](/docs/network/honest-limitations)).
