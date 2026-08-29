---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Resumo Executivo.** Esta página cobre instalação, configuração e uso do harness de avaliação de MT — a ferramenta que faz benchmark de métodos de tradução contra corpora padronizados e produz run cards com pontuação. Para definições canônicas de métricas, esquemas e protocolo de avaliação, consulte a [Especificação de Benchmark](/docs/network/specifications/benchmark).

O harness executa experimentos de tradução e produz run cards. Ele lida com construção de prompts, chamadas de API, pontuação e serialização de resultados — você fornece o dataset e o modelo.

## Instalação

**Requisitos:** Python 3.10+

```bash
pip install mt-eval-harness
```

Isso instala o comando `mt-eval`.

## Uso

```bash
mt-eval run --corpus path/to/dataset.json
```

Isso executa cada entrada no corpus através do modelo configurado (ou plugin de método), pontua os outputs e escreve um arquivo JSON de run card no diretório de saída.

## Flags da CLI

### `mt-eval run`

| Flag | Obrigatório | Padrão | Descrição |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Caminho para arquivo de corpus (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Arquivos de texto paralelo (FLORES+, formato WMT) |
| `-m, --model` | — | `gemini-pro` | Slug do modelo (nome curto ou ID completo do OpenRouter). Resolvido via `shared/model-aliases.json`. Separado por vírgula para execuções multi-modelo |
| `-d, --dataset` | — | `all` | Filtro de dataset: `all`, nome do segmento ou intervalo de ID |
| `--ids` | — | — | IDs de entrada separados por vírgula para avaliar |
| `--source-lang` | — | `English` | Nome da língua de origem |
| `--target-lang` | — | — | Nome da língua de destino |
| `-p, --prompt` | — | `naive` | Versão do prompt (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Caminho para arquivo de texto de prompt de coaching |
| `--coaching` | — | — | Texto de coaching inline (string entre aspas) |
| `--method` | — | — | Caminho para diretório de plugin de método (contém `method.json` + módulo Python) |
| `--method-card` | — | — | Caminho para JSON de method card para metadados de leaderboard |
| `--fst-retries` | — | `0` | Número de tentativas de retry FST (apenas método LLM padrão) |
| `--skip-fst` | — | `false` | Pular o quality gate FST inteiramente |
| `--tools` | — | `false` | Ativar modo tool-calling |
| `--tools-list` | — | — | Nomes de ferramentas separados por vírgula |
| `--max-tool-rounds` | — | `8` | Máximo de rodadas de tool-calling por entrada |
| `--hooks` | — | — | Nomes de hooks pós-tradução |
| `--style-profile` | — | — | Caminho para JSON de perfil de estilo. Ativa métricas de consistência de estilo de escrita (informacional — nunca faz parte da pontuação composta; consulte [§ Métricas de estilo de escrita e registro](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entradas por chamada de API |
| `-c, --concurrency` | — | `8` | Chamadas de API paralelas |
| `--max-tokens` | — | `32768` | Máximo de tokens por chamada de API |
| `--temperature` | — | `0.0` | Temperatura de amostragem (0.0 = determinístico) |
| `--no-cache` | — | `false` | Desativar cache de resposta |
| `--cache-dir` | — | `eval/cache/harness` | Caminho do diretório de cache |
| `-o, --output-dir` | — | `eval/logs/harness` | Diretório de saída para run cards e logs |
| `-n, --name` | — | — | Nome de execução legível por humanos |
| `--dry-run` | — | `false` | Validar configuração sem fazer chamadas de API |
| `--champollion-config` | — | — | Caminho para `champollion.config.json` |
| `--champollion-cards-dir` | — | — | Diretório de language cards |
| `--target-lang-code` | — | — | Código de língua BCP-47 |

### Todos os subcomandos

Todos os dezoito subcomandos de nível superior, gerados em relação a `mt_eval_harness/cli.py`
em 01/08/2026. Até então, esta seção listava sete deles, e seis —
incluindo `node`, o nó de pontuação do organizador soberano — não estavam documentados
**nem aqui nem no guia do harness**.

**Executar e pontuar**

| Subcomando | O que faz |
|---|---|
| `mt-eval run` | Executa uma rodada de tradução (flags acima) |
| `mt-eval test <log>` | Analisa um log de execução concluído |
| `mt-eval compare <logs…>` | Compara múltiplos logs de execução |
| `mt-eval dashboard <logs…>` | Gera um dashboard HTML interativo |
| `mt-eval card <run-card>` | Formata (pretty-print) um cartão de execução legível por humanos |

**Encontre o caminho para um método**

| Subcomando | O que faz |
|---|---|
| `mt-eval recommend <src> <tgt>` | Orientação de método para um par de idiomas — disponibilidade mais **evidências citadas**, não um simples ranking |
| `mt-eval corpora --source X --target Y` | Lista os corpora de avaliação disponíveis para um par |
| `mt-eval list models\|prompts\|datasets` | Lista os recursos disponíveis |

**Contribuir**

| Subcomando | O que faz |
|---|---|
| `mt-eval publish <report>` | Envia um TestReport para o placar de líderes (leaderboard) |
| `mt-eval queue` | Executa o topo da fila de computação da comunidade com a sua própria chave — consulte [Contribuindo com Computação](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Empacota um TestReport como um plugin de método do champollion |
| `mt-eval generate-plugin` | Alias para `export` |
| `mt-eval export-config` | Gera um snippet `champollion.config.json` a partir de um TestReport |

**Competições e como organizar a sua própria**

| Subcomando | O que faz |
|---|---|
| `mt-eval contest` | Gerencia competições de avaliação — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | Guarda-chuva de edição de tarefa compartilhada (shared-task) multipar: uma linha agrupa as N competições por par de uma edição no estilo AmericasNLP e carrega seus padrões de política. **Apenas agrupamento e padrões — cada portão (gate) permanece por competição** |
| `mt-eval node` | **O nó de pontuação do organizador.** Faz polling da entrada, controla o acesso (gate) no qualificador público, autoriza conforme a política da competição, pontua contra **referências secretas mantidas pelo organizador**, publica apenas pontuações. Este é o comando por trás de [Executar uma Competição Soberana](/docs/network/sovereignty/run-a-sovereign-contest) e do [Nó de Avaliação Soberano](/docs/network/sovereignty/sovereign-eval-node) — o corpus nunca sai da máquina do organizador |

`mt-eval node` possui dezessete subcomandos próprios, incluindo a via airgap
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) e a
cerimônia de custódia M-de-N (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Execute `mt-eval node --help`; as mecânicas de
soberania estão descritas nas duas páginas com links acima.

**Configuração**

| Subcomando | O que faz |
|---|---|
| `mt-eval setup` | Instala dependências opcionais (métrica neural COMET, runtime FST) |
| `mt-eval logout` | Remove credenciais de autenticação armazenadas |

### Exemplos

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Esquema de Run Card

Cada experimento produz um **run card** — um documento JSON autossuficiente. A estrutura de nível superior:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

Consulte a [Especificação de Run Card](/docs/network/specifications/run-card) para o esquema completo com cada campo documentado.

:::info[Esquema Autoritativo]
A [Especificação de Benchmark](/docs/network/specifications/benchmark) é a única fonte de verdade para o esquema do cartão de execução. Para definições de métricas, pesos compostos e níveis de qualidade, consulte a [Especificação de Pontuação](/docs/network/specifications/scoring). Esta página documenta como usar o harness; as especificações definem o que os resultados significam.
:::

### Blocos Principais

**`dataset`** — Identifica qual dataset foi usado, incluindo seu hash de conteúdo para que os resultados estejam vinculados a uma versão específica:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Métricas agregadas para a execução:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Rastreamento de uso de tokens e custos:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Métricas de estilo de escrita e registro (informacional) {#writing-style-and-register-metrics-informational}

O harness pode avaliar se as traduções correspondem a um **registro** e **estilo de escrita** alvo, via o plugin de métrica `WritingStyleConsistency` (`mt_eval_harness/plugins/writing_style.py`). Uma tradução pode estar linguisticamente correta mas em um registro errado — fraseado informal em um documento legal, boilerplate formal em cópia de marketing — e métricas de string não notarão. Essas métricas notam.

**O que é medido (por entrada):**

| Métrica | Escala | Significado |
|--------|-------|---------|
| `style_register_match` | booleano | O output corresponde ao registro esperado? O alvo vem do campo `register` da entrada do corpus (consulte [Benchmark Spec §2.6](/docs/network/specifications/benchmark)) ou de um perfil de estilo |
| `style_sentence_length_ratio` | float | Comprimento médio de sentença previsto vs referência (1.0 = correspondência; divergência = desvio de estilo) |
| `style_formality_score` | 0.0–1.0 | Presença de marcadores formais/informais (pronomes T–V, contrações, …) usando recursos de marcadores por língua |

**Agregado:** `style_consistency_rate` — a fração de entradas sem incompatibilidade de registro detectada.

Ative um alvo personalizado com `--style-profile path/to/profile.json` (por exemplo, um perfil de voz de marca); sem um, o plugin volta aos metadados `register` de cada entrada do corpus onde presente.

:::caution[Escopo honesto]
Essas métricas são **apenas informativas** — nunca fazem parte da pontuação composta, e a detecção de formalidade é baseada em marcadores (uma heurística), não um julgamento aprendido. Trate-as como um detector de desvio para aderência de registro, não um veredicto sobre qualidade de estilo.
:::

---

## Fingerprint vs Hash de Run Card {#fingerprint-vs-run-card-hash}

O harness produz dois hashes distintos. Eles servem propósitos diferentes:

### Fingerprint

O **fingerprint** responde: *"Esta execução poderia ser reproduzida?"*

Ele faz hash da combinação de inputs que definem a configuração do experimento — não os outputs:

- SHA-256 do Dataset
- Slug do modelo
- Rótulo de condição
- SHA-256 do system prompt
- Temperatura
- Versão do harness

Duas execuções com fingerprints idênticos usaram a mesma configuração. Seus resultados devem ser comparáveis (módulo não-determinismo de API).

### Hash de Run Card

O **hash de run card** responde: *"Este arquivo de resultado específico foi adulterado?"*

É o SHA-256 do JSON de run card inteiro (excluindo o campo `run_card_hash` em si). Se qualquer campo mudar — uma pontuação, um timestamp, um único output — o hash quebra.

:::info[Quando usar qual]
Use a **fingerprint** para agrupar execuções comparáveis (mesmo experimento, execuções diferentes). Use o **hash do cartão de execução** para verificar a integridade de um arquivo de resultado específico.
:::

---

## Publicando no Leaderboard

Após completar uma execução, use `mt-eval publish` para enviar o run card:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Se nenhum `--method-card` foi fornecido durante a execução, `mt-eval publish` inicia um assistente interativo (`method_card_wizard.py`) que o guia através da descrição do seu método (nome, classe, ferramentas usadas, etc.). A saída do assistente é incorporada no run card antes do envio.

### Inspeção manual

Os cartões de execução são salvos como arquivos JSON no diretório de saída (`eval/logs/harness/` por padrão) — inspecione-os lá antes de publicar. `mt-eval publish` é o caminho de envio; não há ingestão de cartão de execução baseada em PR.

:::note[A API de envio e o upload web ainda não estão ativos]
Um endpoint `POST https://champollion.dev/api/leaderboard/submit` e uma interface de upload do Leaderboard estão planejados mas **ainda não implementados**. Até que sejam lançados, o único caminho de envio funcionando é `mt-eval publish`.
:::

:::warning[Validação do Leaderboard]
O leaderboard valida os cartões de execução enviados contra o registro de datasets. Envios que referenciam datasets desconhecidos, ou com um `run_card_hash` quebrado, são rejeitados.
:::

:::danger[NÃO TREINE com dados de avaliação]
Se seu método viu o dataset de avaliação durante o desenvolvimento — como dados de treinamento, exemplos few-shot, entradas de dicionário ou material de engenharia de prompt — seu envio será **desqualificado**. Consulte [Avaliação de MT](/docs/network/leaderboard/rules) para entender o que torna um método bom vs. ruim.
:::

---

## Veja Também

- [MT Evaluation](/docs/network/leaderboard/rules) — visão geral, proposta de valor do leaderboard e orientação de método bom/ruim
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — formato de dataset, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — o esquema JSON completo
- [Building a Method](/docs/network/specifications/methods) — a interface de método para criar métodos avaliáveis
- [Method Leaderboard](https://champollion.dev/leaderboard) — pontuações de benchmark ao vivo
- [Benchmark Specification](/docs/network/specifications/benchmark) — protocolo de avaliação, formato de corpus, esquema de run card
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT para métricas, pesos compostos e tiers de qualidade
