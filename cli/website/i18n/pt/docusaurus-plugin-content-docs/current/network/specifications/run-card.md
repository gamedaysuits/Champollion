---
sidebar_position: 4
title: "Especificação do Cartão de Execução"
---

# Especificação de Run Card

> **Resumo Executivo.** O run card é a unidade atômica de benchmarking — um documento JSON que registra a configuração completa, resultados por entrada e pontuações agregadas de uma execução de avaliação. Esta página documenta o esquema, campos, mecanismo de fingerprinting e estrutura de pontuação. Veja a [Especificação de Benchmark](/docs/network/specifications/benchmark) para definições canônicas.

O run card é o registro completo de uma única execução de avaliação. Ele contém tudo o que você precisa para entender, reproduzir e verificar o experimento: configuração, pontuações, resultados individuais, uso de tokens e metadados de ambiente.

**Versão do esquema:** 2.0

:::info[Schema Autoritário]
A [Especificação de Benchmark](/docs/network/specifications/benchmark) é a única fonte de verdade para o schema do run card. Para definições de métricas, pesos compostos e níveis de qualidade, consulte a [Especificação de Scoring](/docs/network/specifications/scoring). Esta página documenta a implementação atual.
:::

---

## Campos de Nível Superior

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `run_id` | `string` | UUID v4 gerado no início da execução |
| `harness_version` | `string` | Versão semântica do harness que produziu este card (ex: `2.0`) |
| `model_slug` | `string` | Slug do modelo usado na execução (ex: `google/gemini-3.1-pro`) |
| `model_id` | `string` | Identificador de modelo resolvido retornado pela API (ex: `gemini-3.1-pro-001`) |
| `condition` | `string` | Rótulo do experimento (ex: `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | Timestamp ISO 8601 UTC quando a execução começou |
| `elapsed_seconds` | `number` | Duração de tempo real de toda a execução |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

Identifica o dataset de avaliação e o fixa a uma versão de conteúdo específica via SHA-256.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Identificador do dataset (ex: `edtekla-dev-v1`) |
| `version` | `string` | String de versão do dataset |
| `language_pair` | `string` | Rótulo de exibição (ex: `EN→CRK`) |
| `sha256` | `string` | Hash SHA-256 do conteúdo do arquivo do dataset. Garante os dados exatos usados |
| `entry_count` | `number` | Número de entradas no dataset |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

A configuração de API e batching usada para esta execução.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `api_provider` | `string` | Nome do provedor de API (ex: `openrouter`) |
| `temperature` | `number` | Temperatura de amostragem |
| `max_tokens` | `number` | Máximo de tokens por conclusão |
| `batch_size` | `number` | Entradas por lote concorrente |
| `concurrency` | `number` | Máximo de requisições paralelas à API |
| `coaching_file` | `string` | Caminho para arquivo de prompt de coaching, se usado |
| `method_path` | `string` | Caminho para diretório de plugin de método, se usado |
| `fst_retries` | `number` | Número de tentativas de retry FST |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[Run Cards Publicados Incluem `method_config`]
Quando um run card é publicado via `mt-eval publish`, `publish.py` injeta um bloco `method_config` contendo o MethodConfig canônico de 8 campos. Isso permite instalação sem atrito no leaderboard — qualquer pessoa pode reproduzir o método diretamente do card publicado.

```json
{
  "method_config": {
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

Todos os campos usam **camelCase** e seguem o esquema MethodConfig canônico (veja [Construindo um Método](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `system_prompt_sha256` | `string` | Hash SHA-256 do prompt do sistema. Incluído no fingerprint |
| `system_prompt_used` | `string` | O texto completo do prompt do sistema enviado ao modelo |

O hash do prompt faz parte do [fingerprint](#fingerprint) — duas execuções com prompts diferentes terão fingerprints diferentes mesmo que todas as outras configurações correspondam.

---

## `fingerprint`

Um identificador de reprodutibilidade. Duas execuções com fingerprints idênticos usaram a mesma configuração experimental.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `hash` | `string` | Hash SHA-256 dos componentes ordenados |
| `components` | `object` | Os valores de entrada que foram hashados |

### Componentes do Fingerprint

| Componente | Descrição |
|-----------|-----------|
| `dataset_sha256` | Hash do arquivo do dataset |
| `model_slug` | Modelo usado |
| `condition` | Rótulo da condição do experimento |
| `system_prompt_sha256` | Hash do prompt do sistema |
| `temperature` | Temperatura de amostragem |
| `harness_version` | Versão do harness |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Fingerprint ≠ Hash do Run Card]
O fingerprint identifica a *configuração do experimento*. O `run_card_hash` verifica a *integridade do arquivo de resultado*. Consulte [Fingerprint vs Hash do Run Card](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) para detalhes.
:::

---

## `scores`

Métricas agregadas para toda a execução.

### Pontuações de Nível Superior

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `total` | `number` | Total de entradas avaliadas |
| `exact_matches` | `number` | Entradas onde a saída correspondeu exatamente ao padrão ouro |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | Entradas onde o analisador FST aceitou a saída |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0.0–1.0). `null` se nenhum analisador FST foi usado |
| `chrf_plus_plus` | `number` | Pontuação chrF++ em nível de corpus (0–100) |
| `errors` | `number` | Entradas que falharam (erro de API, timeout, etc.) |
| `avg_latency_seconds` | `number` | Tempo médio de resposta em todas as entradas |
| `median_latency_seconds` | `number` | Tempo mediano de resposta |
| `p95_latency_seconds` | `number` | Tempo de resposta do 95º percentil |

### `by_difficulty`

Pontuações divididas por nível de dificuldade. Cada chave (inteiro 1–5) contém os mesmos campos de métricas das pontuações de nível superior.

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

Pontuações divididas por proveniência de entrada. Cada chave (ex: `gold_standard`, `textbook`) contém os mesmos campos de métricas.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `totals`

Rastreamento de uso de tokens e custo para toda a execução.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `prompt_tokens` | `number` | Total de tokens de entrada em todas as chamadas de API |
| `completion_tokens` | `number` | Total de tokens de saída |
| `reasoning_tokens` | `number` | Tokens usados para raciocínio chain-of-thought (dependente do modelo, 0 para a maioria dos modelos) |
| `cached_tokens` | `number` | Tokens servidos do cache de prompt do provedor |
| `total_cost_usd` | `number` | Custo total em USD (conforme relatado pela API) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

Metadados de ambiente de tempo de execução para reprodutibilidade.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `harness_version` | `string` | Versão do harness (espelha `harness_version` de nível superior) |
| `harness_git_commit` | `string` | SHA do commit Git do harness no tempo de execução |
| `python_version` | `string` | Versão do interpretador Python |
| `sacrebleu_version` | `string` | Versão da biblioteca sacrebleu (usada para pontuação chrF++) |
| `os` | `string` | Identificador do sistema operacional |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

O array de resultados por entrada. Um objeto por entrada do dataset, em ordem de índice.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `entry_id` | `integer` | ID desta entrada no corpus (corresponde a `entries[].id`) |
| `source` | `string` | O texto de origem que foi traduzido |
| `reference` | `string` | A referência padrão ouro do corpus |
| `predicted` | `string` | A saída real do método |
| `exact_match` | `boolean` | Se `predicted` corresponde exatamente a `reference` após normalização |
| `entry_chrf` | `number` | Pontuação chrF++ em nível de sentença para esta entrada (0–100) |
| `fst_accepted` | `boolean \| null` | Se o analisador FST aceitou a saída. `null` se nenhum analisador foi configurado |
| `fst_analysis` | `string[]` | Strings de análise FST para a saída (array vazio se não analisado ou rejeitado) |
| `difficulty` | `integer` | Nível de dificuldade do corpus (1–5) |
| `provenance` | `string` | Tag de proveniência do corpus |
| `latency_seconds` | `number` | Tempo de resposta para esta entrada individual |
| `usage` | `object` | Uso de tokens por entrada: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Mensagem de erro se esta entrada falhou. `null` em caso de sucesso |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `run_card_hash` | `string` | Hash SHA-256 de todo o JSON do run card, com o campo `run_card_hash` definido como `""` durante o hashing |

Este é o selo de detecção de adulteração. O leaderboard recalcula este hash na submissão e rejeita cards onde não corresponde.

**Computando o hash:**

1. Serialize o run card para JSON com `run_card_hash` definido como `""`
2. Compute SHA-256 da string serializada
3. Defina `run_card_hash` como o digest hexadecimal resultante

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Drill-Down por Entrada]
Run cards publicados também preenchem a tabela `run_card_entries` do Supabase, que armazena resultados por entrada para análise de drill-down no leaderboard. Esta tabela é preenchida automaticamente durante `mt-eval publish`.
:::

---

## Veja Também

- [Avaliação de MT](/docs/network/leaderboard/rules) — visão geral, valor do leaderboard e orientação de métodos bons/ruins
- [Eval Harness](/docs/network/specifications/harness) — como executar avaliações e gerar run cards
- [Datasets de Avaliação](/docs/network/leaderboard/datasets) — formato de dataset, EDTeKLA, FLORES+
- [Construindo um Método](/docs/network/specifications/methods) — a interface de método e especificação de method card
- [Leaderboard de Métodos](https://champollion.dev/leaderboard) — pontuações de benchmark ao vivo
- [Especificação de Benchmark](/docs/network/specifications/benchmark) — protocolo de avaliação, formato de corpus, esquema de run card
- [Especificação de Pontuação](/docs/network/specifications/scoring) — SSOT para métricas, pesos compostos e níveis de qualidade
