---
sidebar_position: 4
title: "Especificação do Cartão de Execução"
---

# Especificação de Run Card

> **Resumo Executivo.** O run card é a unidade atômica de benchmarking — um documento JSON que registra a configuração completa, resultados por entrada e pontuações agregadas de uma execução de avaliação. Esta página documenta o esquema, campos, mecanismo de fingerprinting e estrutura de pontuação. Veja a [Especificação de Benchmark](/docs/network/specifications/benchmark) para definições canônicas.

O run card é o registro completo de uma única execução de avaliação. Ele contém tudo o que você precisa para entender, reproduzir e verificar o experimento: configuração, pontuações, resultados individuais, uso de tokens e metadados de ambiente.

**Versão do esquema:** 2.0

:::info[Schema Autoritativo]
A [Especificação de Benchmark](/docs/network/specifications/benchmark) é a fonte única da verdade para o schema do run card. Para definições de métricas e como as execuções são pontuadas (o destaque chrF++, as métricas padrão ao lado dele, os diagnósticos), consulte a [Especificação de Pontuação](/docs/network/specifications/scoring). Esta página documenta a implementação atual.
:::

---

## Campos de Nível Superior

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 gerado no início da execução |
| `harness_version` | `string` | Versão semântica do harness que gerou este card (ex.: `2.0`) |
| `model_slug` | `string` | Slug do modelo utilizado para a execução (ex.: `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | Identificador resolvido do modelo retornado pela API (ex.: `gemini-3.1-pro-001`) |
| `condition` | `string` | Rótulo do experimento: o que o harness grava é `naive` (seu prompt integrado), `coached` (um arquivo de coaching o substituiu) ou, para um plugin de método, sua classe de método; texto livre, de modo que um card criado manualmente pode indicar `coached-v3` ou `few-shot`. Não é um rótulo de qualidade (os níveis de qualidade foram descontinuados; `scores.quality_tier` é nulo em todo novo card) |
| `timestamp` | `string` | Carimbo de data/hora ISO 8601 UTC de quando a execução começou |
| `elapsed_seconds` | `number` | Duração de tempo real (wall-clock) de toda a execução |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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
|-------|------|-------------|
| `api_provider` | `string` | O que transportou o texto: o provedor de API para o caminho de LLM próprio do harness (`openrouter`, `openai`, `anthropic`, `gemini`, `local`); o ID do mecanismo para um mecanismo de MT (ex.: `google-translate`); para um plugin de método, `local` quando o seu operador atestou um transporte totalmente local (`--attest-local-transport`), caso contrário `method-plugin` |
| `temperature` | `number` | Temperatura de amostragem |
| `max_tokens` | `number` | Máximo de tokens por conclusão (completion) |
| `batch_size` | `number` | Entradas por lote simultâneo |
| `concurrency` | `number` | Máximo de requisições paralelas à API |
| `coaching_file` | `string` | Caminho para o arquivo de prompt de coaching, se utilizado (o próprio registro do log de execução; um card publicado nomeia o coaching pelo nome do arquivo, ou `inline coaching` para texto `--coaching` — nunca um caminho local) |
| `method_path` | `string` | Caminho para o diretório do plugin de método, se utilizado |
| `fst_retries` | `number` | Número de tentativas de repetição (retries) do FST |

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
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

`qualityTier` é sempre `null` em um card novo: os níveis de qualidade foram descontinuados. Todos os campos usam **camelCase** e seguem o schema canônico do MethodConfig (consulte [Criando um Método](/docs/network/specifications/methods)).
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

A lista canônica está na [Especificação de Benchmark §3.8](/docs/network/specifications/benchmark#38-fingerprint). Em resumo:

| Componente | Descrição |
|-----------|-------------|
| `dataset_sha256` | Hash do arquivo do dataset |
| `model_slug` | Modelo utilizado (para um mecanismo de MT ou plugin de método, o ID do mecanismo ou método) |
| `condition` | Rótulo da condição experimental |
| `system_prompt_sha256` | Hash do prompt de sistema |
| `temperature` | Temperatura de amostragem |
| `batch_size`, `tools_enabled` | Envio em lote e uso de ferramentas |
| `harness_version` | Versão do harness |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | Versão 2 (harness 0.2.0 e posterior): o canal, o host do endpoint (com hash), o limite de tokens e a versão e hash do código do método |
| `method_model`, `method_dependencies_sha256` | Versão 2, somente execuções de plugin de método: o modelo fornecido ao plugin (`-m`) e o hash do seu `dependencies` declarado |
| `method_model`, `method_model_sha256` | Versão 2, somente execuções de `--method local-model`: o modelo carregado (ID do Hugging Face ou nome do diretório) e seu hash de conteúdo (um diretório) ou revisão (um ID do Hugging Face) |

`fingerprint.version` indica sob qual lista o hash de um card foi gerado.

### `engine_model`

Uma execução de um mecanismo de MT que roda um modelo fornecido a ele (`--method local-model -m <model>`) traz o modelo que foi carregado:

| Campo | Descrição |
|-------|-------------|
| `given` | O que `-m` indicou |
| `kind` | `directory` ou `hub` (um ID do Hugging Face) |
| `id` | O ID do Hugging Face ou o nome do diretório (nunca seu caminho local) |
| `sha256` | Apenas diretório: SHA-256 sobre uma lista no estilo `sha256sum` de seus arquivos |
| `revision` | Apenas ID do Hugging Face: a revisão que foi carregada |
| `family`, `backend` | `opus`, `nllb` ou `madlad`; `transformers` ou `ctranslate2` |
| `decode` | Qual comprimento as saídas poderiam ter: o comprimento declarado pelo modelo ou a regra do harness (`max(64, 4 × source tokens)` novos tokens, limitado pelas posições do decodificador) |
| `pair_mismatch` | Presente apenas quando um modelo de par OPUS-MT para outro par foi executado intencionalmente (`--allow-model-pair-mismatch`) |

`method_config.model` nomeia o mesmo modelo (`<id>@<revision>` ou `<directory name>@sha256:<hash>`). Um log de execução de `local-model` que não registrou nenhum modelo não publica nada: o card indica `engine_model_unrecorded` e `mt-eval publish` o recusa.

### `method_plugin`

Uma execução de plugin de método (`--method <plugin dir>`) também traz as informações que identificam o plugin, conforme registradas pelo executor:

| Campo | Descrição |
|-------|-------------|
| `version` | A versão que `method.json` declara (`null` quando nenhuma for declarada) |
| `code_sha256` | SHA-256 sobre os arquivos do plugin (`method.json` e seus arquivos `.py`, um manifesto no estilo `sha256sum`) |
| `model_given` | O modelo fornecido ao plugin com `-m/--model`, ou `null` |
| `models_called`, `models_basis` | O(s) modelo(s) que o plugin informou ter chamado e se isso foi observado em seus resultados ou declarado |
| `dependency_class` | A classe de dependência que `method.json` declara |
| `dependencies` | A lista `dependencies` que `method.json` declara, sem o texto livre `notes` |
| `dependencies_sha256` | SHA-256 da lista declarada completa (o componente do fingerprint) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
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
|-------|------|-------------|
| `total` | `number` | Total de entradas avaliadas |
| `exact_matches` | `number` | Entradas onde a saída correspondeu exatamente ao padrão de referência (gold standard) |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | **Palavras** de saída aceitas pelo analisador FST, somadas em todas as entradas (não é uma contagem de entradas). `null` se nenhum analisador FST foi utilizado |
| `fst_acceptance_rate` | `number` | Média das taxas de aceitação por entrada (palavras aceitas de cada entrada ÷ suas palavras; uma saída vazia conta como 0), 0.0–1.0. **Não** é `fst_accepted` ÷ todas as palavras — essa taxa agregada de palavras é o `corpus_validity_rate` do relatório, exibido no run card como "Words accepted". `null` se nenhum analisador FST foi utilizado |
| `chrf_plus_plus` | `number` | **A métrica principal e de classificação:** chrF++ no nível de corpus (sacreBLEU chrF, `word_order=2`), 0–100. Seu IC bootstrap de 95% é `confidence_intervals.corpus_chrf` e sua assinatura é `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` em todo novo card. Um card sem ele foi pontuado sob o índice composto descontinuado (`legacy-composite`) e é verificado dessa forma |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | Métricas padrão exibidas ao lado do chrF++, nunca combinadas (o BLEU é o `corpus_bleu` de nível superior do card; o COMET é `comet_score` com `comet_model`, quando computado) |
| `sacrebleu_signatures` | `object` | A assinatura sacreBLEU de cada métrica sacreBLEU computada: `chrf` (a métrica principal), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | Intervalos de bootstrap de 95%; `corpus_chrf` é o da métrica principal |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **Descontinuado.** Sempre `null` em um card novo. Um card legado mantém seus valores armazenados; uma interface que ainda exiba seu índice composto o rotula como "legacy composite (retired)" |
| `errors` | `number` | Entradas que falharam (erro de API, tempo limite, etc.) |
| `avg_latency_seconds` | `number` | Tempo médio de resposta em todas as entradas |
| `median_latency_seconds` | `number` | Tempo mediano de resposta |
| `p95_latency_seconds` | `number` | Tempo de resposta no 95º percentil |

### `by_difficulty`

Pontuações detalhadas por nível de dificuldade, indexadas por nível (`"1"`–`"5"`, `"0"` para não avaliadas). Os campos **não** são os de nível superior: `avg_chrf` e `avg_bleu` são a **média por sentença** de chrF++ e BLEU nas entradas do nível, enquanto o `chrf_plus_plus` e o BLEU de nível superior são no **nível de corpus** (computados sobre todos os segmentos de uma só vez). As duas são estatísticas diferentes: o BLEU de corpus, em particular, costuma ser muito inferior à média do BLEU por sentença, portanto um destaque de 0.5 ao lado de um valor de nível de 10.2 não é uma contradição. Compare os níveis entre si, nunca com o valor principal.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
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

## `score_caveats`

Presente apenas quando algo limita o significado das pontuações. Uma pontuação pode ser computada corretamente e ainda assim não medir o que seu rótulo diz; por isso, a ressalva acompanha o número: `mt-eval test`, `mt-eval card`, `mt-eval compare`, o dashboard e a pré-visualização do `mt-eval publish` a exibem ao lado da métrica principal, e `publish` a armazena aqui para exibição no leaderboard. Ela nunca altera uma pontuação: a métrica principal chrF++ é calculada normalmente, e a ressalva indica o que a limita ou um diagnóstico ao lado dela.

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` ou `near_constant_output` |
| `source` | `string` | Quem realizou a medição: `nmt-forge` ou `mt-eval-harness` |
| `severity` | `string` | `major` (interprete a métrica principal por meio dela) ou `minor` |
| `message` | `string` | Uma frase, com no máximo 480 caracteres |

**`train_test_near_twin`**, gravado pelo nmt-forge. Quando o `nmt-forge export` (ou
`evaluate`) pontua um modelo, ele verifica cada linha de teste em busca de um par quase idêntico (twin)
nos dados de treinamento e registra o resultado nos arquivos de mt-eval que gera.
O harness copia essa leitura para o card: `near_twin_rows` de `n` linhas de teste
possuem um par correspondente (`near_twin_share`), e `strict_n` linhas não possuem nenhum. Quando
há uma quantidade suficiente destas, `strict_corpus_chrf` e `strict_corpus_chrf_ci`
fornecem o chrF++ apenas sobre elas, que é o número de generalização.
`recall_not_translation` é `true` quando pelo menos metade das linhas possui um par correspondente.
Nesse caso, mesmo um chrF++ de 100 mede o quão bem o modelo memorizou
frases de treinamento, e não o quão bem ele traduz. Se a verificação do forge não foi executada,
a ressalva é `minor` e indica isso. Uma verificação que não encontrou nenhum par não adiciona nenhuma ressalva.

**`length_inflation`**, medido pelo harness. É adicionado quando o comprimento médio
das saídas é superior a 2× o comprimento de suas referências (o limite de inflação da
[`length_ratio`](/docs/network/specifications/scoring)), ou quando pelo menos um
quarto das entradas avaliadas atinge esse limiar. Exemplos de few-shot vazados, notas ou texto
repetido inflam as saídas, e as pontuações baseadas em referência acabam medindo isso.
Os campos são `mean_length_ratio`, `inflated_entries` de `scored_entries`,
`ratio_bound` e `share_bound`.

**`length_deflation`**, medido pelo harness. É o espelho de
`length_inflation`: saídas muito mais **curtas** que suas referências, indicando que palavras
foram omitidas. É adicionado quando o comprimento médio das saídas é inferior a 0.5× o de suas referências
(o limite de truncamento da
[`length_ratio`](/docs/network/specifications/scoring)), ou quando pelo menos um
quarto das entradas avaliadas atinge esse limiar. Alguns diagnósticos avaliam apenas as palavras que
uma saída contém: aceitação de FST e code-switching. Um sistema que descarta o que não
consegue traduzir eleva essas métricas. Quando a execução inclui uma delas, a ressalva é
`major` e avisa para não interpretá-las como qualidade em comparação com execuções que traduzem
tudo. A métrica principal chrF++ pondera o recall, portanto ela contabiliza as palavras faltantes. Sem nenhuma
dessas métricas presentes (apenas chrF++ e correspondência exata), é uma nota de `minor`. Os campos
são `mean_length_ratio`, `short_entries` de `scored_entries`, `ratio_bound`,
`share_bound` e `emitted_only_metrics`.

**`source_copy`**, medido pelo harness. É adicionado quando pelo menos metade
das saídas avaliadas são cópias da sua origem (ignorando maiúsculas/minúsculas, acentos e pontuação).
Linhas cuja referência é a própria origem, como nomes, são
desconsideradas. Métricas que não comparam com a referência ainda podem pontuar palavras
copiadas. Os campos são `copies` de `considered_entries`, `copy_share` e
`share_bound`.

**`near_constant_output`**, medido pelo harness. Uma única saída foi retornada
para muitas entradas *diferentes*. As saídas e origens são comparadas ignorando maiúsculas/minúsculas,
pontuação e espaçamento; os sinais diacríticos contam, pois entre duas
saídas eles diferenciam as palavras. Uma saída é considerada uma repetição entre origens (cross-source repeat) quando
pelo menos 3 origens distintas a receberam (5 quando tem uma ou duas palavras, já que
respostas curtas legitimamente se repetem). Uma saída que seja igual à sua própria referência
é uma resposta correta e não é contabilizada. A ressalva é adicionada quando as repetições
cobrem pelo menos um quarto das origens distintas, e no mínimo 5 delas. Ela
é sempre `major`. Quando a execução inclui uma métrica que avalia uma saída
sem sua referência (aceitação de FST, code-switching), a mensagem a
menciona: tal métrica pontua uma frase válida a cada vez que ela aparece. Os campos
são `repeated_sources` de `considered_sources`, `repeat_share`,
`repeated_outputs`, `top_output_sources` e `top_output_words` (a saída mais
repetida: quantas origens a receberam e seu comprimento), `share_bound`,
`min_repeats`, `min_sources`, `min_sources_short` e `emitted_only_metrics`.
Eles são apenas contagens: a ressalva nunca contém o texto da saída.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

O campo fica localizado dentro do JSON armazenado do run card, portanto não precisa de uma
coluna no banco de dados. Ele não faz parte do [fingerprint](#fingerprint): ele descreve o
resultado, não o experimento.

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

- [Avaliação de MT](/docs/network/leaderboard/rules) — visão geral, valor do leaderboard e diretrizes de métodos bons/ruins
- [Harness de Avaliação](/docs/network/specifications/harness) — como executar avaliações e gerar run cards
- [Datasets de Avaliação](/docs/network/leaderboard/datasets) — formato do dataset, EDTeKLA, FLORES+
- [Criando um Método](/docs/network/specifications/methods) — a interface do método e especificação do method card
- [Leaderboard de Métodos](https://champollion.dev/leaderboard) — pontuações do benchmark em tempo real
- [Especificação de Benchmark](/docs/network/specifications/benchmark) — protocolo de avaliação, formato do corpus, schema do run card
- [Especificação de Pontuação](/docs/network/specifications/scoring) — SSOT para métricas e como as execuções são pontuadas
