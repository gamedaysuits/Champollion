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
    to: https://champollion.dev/docs/getting-started/configuration
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Resumo Executivo.** Esta página cobre instalação, configuração e uso do harness de avaliação de MT — a ferramenta que faz benchmark de métodos de tradução contra corpora padronizados e produz run cards com pontuação. Para definições canônicas de métricas, esquemas e protocolo de avaliação, consulte a [Especificação de Benchmark](/docs/network/specifications/benchmark).

O harness executa experimentos de tradução e produz run cards. Ele lida com construção de prompts, chamadas de API, pontuação e serialização de resultados — você fornece o dataset e o modelo.

## Instalação

**Requisitos:** Python 3.11+

```bash
python3 -m pip install mt-eval-harness
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
|------|-------------|--------|-----------|
| `--corpus` | ✅ | — | Caminho para o arquivo de corpus (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Arquivos de texto paralelo (formato FLORES+, WMT) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Slug exato do modelo: o ID completo do OpenRouter ou o nome exato do próprio provedor direto. Sem aliases e sem IDs flutuantes (`~vendor/…`, `…-latest`): um nome curto como `gemini-pro` é recusado, e a recusa indica o slug a ser informado. Separados por vírgula para execuções com múltiplos modelos. Com `--method local-model`, é o modelo a ser executado — um ID do Hugging Face ou um diretório de modelo — e é obrigatório: esse motor não possui modelo padrão. Com um plugin de método, ele é repassado ao plugin como `config.method_model`. Qualquer outro motor de MT traduz com seu próprio modelo e a execução indica que `-m` não foi utilizado |
| `-d, --dataset` | — | `all` | Filtro do conjunto de dados: `all`, nome do segmento ou intervalo de IDs |
| `--ids` | — | — | IDs de entrada separados por vírgula a serem avaliados |
| `--source-lang` | — | `English` | Nome do idioma de origem |
| `--target-lang` | — | — | Nome do idioma de destino, conforme expresso no prompt. Um código fornecido aqui (`sme`) é nomeado a partir de seu cartão de idioma ("Northern Sami"), e o cabeçalho da execução indica isso; um código que nenhum cartão nomeia (um `qaa` de uso privado) permanece como código, com um aviso de que o prompt o incluirá |
| `-p, --prompt` | — | `naive` | Versão do prompt (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Caminho para o arquivo de texto do prompt de coaching. Ele **substitui** o prompt integrado: o modelo recebe o arquivo exatamente como foi escrito (mais a linha `--target-script`), e não a instrução integrada "Translate the given … text to …; output only the translation". O dry run e o cabeçalho da execução indicam isso em um único veredito: ✓ quando o arquivo nomeia o idioma de destino (e por qual nome ou código), ⚠ quando não nomeia nem o idioma nem o seu código, ou não verificado quando nenhum nome ou código é conhecido |
| `--glossary` | — | — | Glossário de avaliação (JSON) para aderência terminológica; apenas para pontuação, nunca enviado ao modelo |
| `--coaching` | — | — | Texto de coaching em linha (string entre aspas) |
| `--method` | — | — | Caminho para o diretório de plugins de método (contém `method.json` + módulo Python) ou um motor de MT registrado (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Com `--method local-model`: executa um modelo de par OPUS-MT cujo ID indica outro par diferente daquele do corpus (`opus-mt-en-fi` em um corpus `eng>sme`, como baseline de idioma relacionado). Recusado sem esta opção; o cartão de execução registra isso |
| `--method-card` | — | — | Caminho para o JSON do cartão de método para metadados da tabela de classificação |
| `--skip-fst` | — | `false` | Pontua sem aceitação de FST, mesmo quando o idioma possui um FST, sem nenhum aviso adicional. O cartão de execução marca como não calculado. Sem esta flag, um FST ausente (o analisador ou seu runtime pyhfst) também não interrompe a execução: ela prossegue, o cartão de execução marca aceitação de FST e morfologia como não calculados, e o aviso menciona `mt-eval setup --lang <code>`. Após essa instalação, `mt-eval test <run log>` adiciona a pontuação FST à execução concluída sem traduzir novamente. Nada é baixado automaticamente |
| `--skip-eval-standard` | — | `false` | Pontua sem as métricas de avaliação padrão do cartão de idioma (um pacote externo). O cartão de execução as marca como não calculadas. Sem esta flag, as métricas de um pacote instalado são calculadas; um pacote não instalado é um complemento opcional — a execução continua sem as suas métricas (marcadas como não calculadas) e indica o `python3 -m pip install` declarado pelo cartão. Nada é instalado por uma execução |
| `--tools` | — | `false` | Habilita o modo de chamada de ferramentas |
| `--tools-list` | — | — | Nomes de ferramentas separados por vírgula |
| `--max-tool-rounds` | — | `8` | Número máximo de rodadas de chamada de ferramentas por entrada |
| `--style-profile` | — | — | Caminho para o JSON do perfil de estilo. Habilita métricas de consistência de estilo de escrita (diagnósticos — nunca fazem parte da pontuação principal; consulte [§ Métricas de estilo de escrita e registro](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entradas por chamada de API |
| `-c, --concurrency` | — | `8` | Chamadas de API paralelas |
| `--max-tokens` | — | `32768` | Máximo de tokens por chamada de API |
| `--temperature` | — | `0.0` | Temperatura de amostragem (0.0 = determinística) |
| `--no-cache` | — | `false` | Desativa o cache de respostas |
| `--cache-dir` | — | `eval/cache/harness` | Caminho do diretório de cache (consulte [O cache de tradução](#the-translation-cache)) |
| `--metricx` | — | `false` | Também calcula o MetricX-24 (Google, Apache-2.0), uma pontuação neural de erro em que menor é melhor (0–25), informada ao lado da pontuação principal de chrF++ e nunca combinada com ela. Requer o extra `metricx` e o código do modelo do Google (consulte [Métricas neurais opcionais](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Com `--metricx`: outro checkpoint do MetricX (um xl/xxl ou um `google/metricx-25-*`) |
| `--fuse` | — | `false` | Também calcula o comparador no estilo FUSE, uma reimplementação não treinada da abordagem FUSE do AmericasNLP 2025, relatada como um comparador diagnóstico, nunca na pontuação principal. Requer o extra `fuse` (consulte [Métricas neurais opcionais](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Diretório de saída para cartões de execução e logs |
| `-n, --name` | — | — | Nome da execução legível para humanos |
| `--dry-run` | — | `false` | Valida a configuração e o corpus sem fazer chamadas de API. Indica o arquivo de coaching e o glossário que a execução utilizaria (ou `none`), exibe o prompt (o integrado na íntegra; um arquivo de coaching por sua primeira linha e sha256, e que ele substitui o integrado), informa onde está o cache de tradução e executa a mesma verificação do pacote de avaliação que a execução real faz, relatando isso em linhas que começam com `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …` ou `none needed for <language>`) sem falhar. Uma segunda linha indica se a execução real seria interrompida: um FST ausente nunca a interrompe, enquanto qualquer outra parte ausente interrompe. Sob `--json`, o resumo inclui `coaching_file`, `prompt` (seu tipo, sha256 e tamanho; o texto do prompt integrado), `glossary_file` e `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | Código de idioma BCP-47 |
| `--target-script` | — | — | O sistema de escrita ISO 15924 em que as traduções devem ser escritas (`Latn`, `Cans`, …), um dos listados no cartão de idioma de destino. O prompt do harness solicita isso (também anexado ao texto de um arquivo de coaching), portanto faz parte do sha256 do prompt. Para um idioma escrito em mais de um sistema de escrita, como o Cree das Planícies, use o sistema de escrita em que suas referências estão escritas. Sem isso, o harness conta as letras das referências por sistema de escrita (um agregado: nenhuma frase é exibida, portanto isso vale também para um corpus somente local) e solicita o sistema de escrita que contenha 90% ou mais delas, indicando isso no cabeçalho da execução ("as referências são 100% Latn → solicitando Latn no prompt") e registrando no log de execução (`config.target_script_source`); referências mistas não recebem nenhum sistema de escrita e geram um aviso com as proporções, e uma referência no outro sistema de escrita pontua perto de zero. Recusado para um motor de MT ou plugin de método, que não recebem prompt |

`--champollion-config` e `--prompt champollion` foram descontinuados na versão 0.2.0 e são recusados com o motivo. O mesmo se aplica a `--champollion-cards-dir`; defina `MT_EVAL_CARDS_DIR` para apontar o harness para outro diretório de cards. Eles reconstruíam o prompt da CLI em Python, e essa cópia havia divergido da CLI. Use um plugin de método (`--method`) para avaliar um método da CLI, e `mt-eval export-config` para levar um resultado de volta para um projeto da CLI.

### Métricas neurais opcionais

O COMET é computado sempre que `unbabel-comet` estiver instalado (`mt-eval setup --comet`: cerca de 300 MB para instalar e cerca de 2,3 GB de modelo no primeiro uso). Mais duas métricas ficam desativadas a menos que uma execução as solicite, porque cada uma carrega um modelo grande. Assim como o COMET, elas rodam nesta máquina (sem custo de API, sem envio de texto para lugar algum), são informadas ao lado da pontuação principal de chrF++ e nunca combinadas a ela, e o run card indica "not run" com a flag a ser passada quando não foram solicitadas.

| Métrica | Flag | O que necessita | O que custa |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`, menor é melhor, 0–25) | `--metricx` (checkpoint: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) e o código de modelo do Google, que não está no PyPI: `python3 -m pip install git+https://github.com/google-research/metricx` | O checkpoint padrão `google/metricx-24-hybrid-large-v2p6` e o tokenizador mT5-XL baixam vários GB do Hugging Face no primeiro uso; a pontuação é lenta em uma CPU. Sem uma referência, ele pontua em seu modo livre de referência (QE) |
| Comparador no estilo FUSE (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | O LaBSE baixa cerca de 1,8 GB no primeiro uso. Sem o LaBSE, a pontuação não é computada, e o relatório indica isso. Ele não é treinado (uma média não ponderada de suas partes), e o resultado é sinalizado como `fuse_untrained` |

Via MCP (o perfil completo, `--profile full`), `run_benchmark` aceita `metricx` (com `metricx_model`) e `fuse`, e `comet: true` requer COMET; seu plano informa se cada um está instalado, e uma execução confirmada que solicite algo que o harness não possa calcular é recusada.

O que cada métrica mede e até que ponto confiar nela para um idioma está em [Pontuação](/docs/network/specifications/scoring) e [Confiabilidade das métricas](/docs/network/specifications/metric-reliability).

### O cache de tradução

Cada execução mantém a saída do modelo para cada frase de origem em um cache (`--cache-dir`, por padrão `eval/cache/harness` sob o diretório em que a execução é iniciada), para que uma nova execução da mesma configuração a reutilize sem custos. A chave de cache abrange o modelo, o prompt conforme enviado (seu sha256), as configurações que alteram as saídas e a versão do harness, de modo que uma alteração em qualquer um deles nunca receba uma saída antiga. O cache armazena cópias das frases do corpus:

- o cabeçalho da execução e o dry run exibem onde ele está e quantas entradas contém;
- a pasta contém um `.gitignore`, para que o git a ignore;
- ele nunca é gravado em uma pasta `mt-eval contest prepare` marcada como liberável (seu `public/`): `mt-eval run` recusa tal `--cache-dir` ou `--output-dir` e indica, em vez disso, a pasta `runs/` do concurso ([Executar um concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest));
- um corpus estritamente local, selado ou que exige consentimento recebe sua própria pasta `protected/<namespace>/`, indexada pelas configurações da execução, pelo sha256 do corpus e seus termos, e cada arquivo ali contém a marcação do corpus em um sidecar `<file>.champollion.json` ([Registrando corpora](/docs/network/sovereignty/registering-corpora));
- exclua a pasta para remover as cópias ou passe `--no-cache` para não reter nenhuma.

O `run_benchmark` do servidor MCP (perfil completo) indica o cache em seu plano e em seu resultado. Para um arquivo que você possui, ele coloca o cache ao lado dos resultados da execução (`<corpus folder>/results/cache/`) e, para um ID de corpus registrado, em sua própria pasta (`~/.champollion-mcp/cache/harness/`). Um cache que já esteja em `eval/cache/harness` sob o diretório de trabalho do servidor proveniente de execuções anteriores continua sendo usado, de modo que suas saídas não sejam pagas duas vezes. Suas entradas não dependem de onde a pasta está localizada, portanto ela pode ser movida.

### Todos os subcomandos

Todos os vinte subcomandos de nível superior. Todas as flags de cada um deles estão na
[referência de comandos do `mt-eval`](/docs/reference/mt-eval) gerada; esta seção
explica para que serve cada um.

**Execução e pontuação**

| Subcomando | O que faz |
|---|---|
| `mt-eval run` | Executa uma sessão de tradução (flags acima) |
| `mt-eval test <log>` | Analisa o log de uma execução concluída. `-o <path>` grava o relatório em outro local que não `<log>_report.json`, e o log da execução registra esse caminho para que `card` e `compare` o encontrem. `--glossary <file>` pontua a terminologia em relação a esse glossário; o relatório registra seu nome e sha256, e o card, `compare` e a prévia de publicação informam em relação a qual glossário a aderência terminológica (um diagnóstico) foi pontuada |
| `mt-eval compare <reports…>` | Compara duas ou mais execuções (`*_report.json` ou logs de execução). Uma linha por métrica (chrF++, BLEU, spBLEU, TER, …), uma coluna por execução identificada por letras A, B, C…, com métricas do tipo "menor é melhor" marcadas; `--significance` adiciona testes pareados para cada par, cada tabela nomeada pelas letras das execuções, com o IC de 95% sobre Δ, e informa que os valores de p são por métrica e não corrigidos; `--method paired_bootstrap` substitui a randomização aproximada padrão pelo bootstrap de Koehn ([Significância](/docs/network/specifications/significance)). Grava `comparison-<hash>.json` (o hash dos IDs das execuções comparadas, para que outra comparação nunca o sobrescreva) ao lado dos relatórios quando compartilham uma pasta, caso contrário em `comparisons/` na pasta comum mais próxima (nunca na pasta da própria execução), a menos que `-o` especifique um arquivo. Apenas o teste chrF++ decide qual execução é melhor; as outras linhas são exibidas, mas não usadas para decisão. O composto de um relatório legado é indicado como descontinuado e não é comparado |
| `mt-eval dashboard <logs…>` | Gera um painel interativo em HTML |
| `mt-eval card <run log>` | Exibe de forma formatada um run card legível por humanos. As pontuações vêm do relatório da execução: ao lado do log, onde `mt-eval test -o` o registrou, ou `--report <path>`. Uma execução sem relatório encontrado mostra NOT SCORED e onde procurou, nunca zeros. Um arquivo de relatório também pode ser passado; ele é lido junto com o log de execução que registra |

**Colocar um método em funcionamento** (nada é pontuado)

| Subcomando | O que faz |
|---|---|
| `mt-eval translate` | Traduz uma entrada apenas com o texto de origem usando um método — o pipeline de execução sem nada para pontuar. Grava `.jsonl` ou `.tsv` com os termos da entrada como um sidecar set/1; um método cuja saída seja somente local grava apenas dentro do projeto, a menos que `--holders-agreed-by` mencione quais dos detentores dos dados concordaram |
| `mt-eval serve` | Serve um método executado nesta máquina (`lexicon`, `local-model` ou um plugin de classe de dependência S ou O) sob o contrato `/translate` do champollion, a partir de um arquivo deployment/1 ou de flags, com um arquivo opcional gate-chain/1 controlando cada resposta. Vincula-se a 127.0.0.1 por padrão; outro host requer `$MT_EVAL_SERVE_TOKEN` |

**Encontrando um método**

| Subcomando | O que faz |
|---|---|
| `mt-eval recommend <src> <tgt>` | Orientação de método para um par de idiomas — disponibilidade mais **evidências citadas**, e não um mero ranking. O par também pode ser fornecido como `--source <src> --target <tgt>`, o formato aceito por `corpora` |
| `mt-eval corpora --source X --target Y` | Lista os corpora de avaliação disponíveis para um par. Qualquer uma das flags funciona isoladamente: `--target Y` lista todos os corpora para Y, `--source X` todos os corpora a partir de X |
| `mt-eval corpora --with-fst` | Apenas os corpora cujo idioma de destino possui um FST fixado pelo harness, para que a aceitação de FST possa ser pontuada. Cada destino é listado com a informação de se o seu FST está instalado nesta máquina e como instalá-lo (`mt-eval setup --lang <code>`, ou uma instalação manual para alguns formatos). Combine com `--source`/`--target` ou use isoladamente para todos os pares. Nada é baixado |
| `mt-eval list models\|prompts\|datasets` | Lista recursos disponíveis |

**Contribua**

| Subcomando | O que faz |
|---|---|
| `mt-eval publish <report>` | Envia um TestReport para a tabela de classificação |
| `mt-eval queue` | Executa o topo da fila de computação comunitária com a sua própria chave — consulte [Contribuindo com computação](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Empacota um TestReport como um plugin de método do champollion (um method/1 `method.json`) |
| `mt-eval generate-plugin` | Alias para `export` |
| `mt-eval export-config` | Gera um snippet de `champollion.config.json` a partir de um TestReport |

**Concursos e como organizar um**

| Subcomando | O que faz |
|---|---|
| `mt-eval contest` | Executa ou participa de uma **competição soberana** — do organizador: `prepare`, `register`, `create`, `rank`, `close`, `export`; do participante: `qualify` (autoavalia o conjunto público de desenvolvimento para obter o comprovante de admissão; o qualificador é o chrF++ em escala de 0–100), `validate` (testa as verificações do nó offline), `submit-model` / `submit-method` (entrega um modelo ou método), `status`, `list`. A participação em uma competição é feita fornecendo ao nó do organizador algo que ele possa EXECUTAR; o envio de traduções e a vinculação de um cartão autorrelatado foram descontinuados como vias de inscrição em 2026-09-06 |
| `mt-eval shared-task` | Guarda-chuva de edição de tarefa compartilhada multipar: uma linha agrupa as N competições por par de uma edição de tarefa compartilhada multipar e contém seus padrões de política. **Apenas agrupamento e padrões — cada controle permanece por competição** |
| `mt-eval node` | **O nó de pontuação do organizador.** Monitora as entradas, controla o acesso pelo qualificador público, autoriza de acordo com a política da competição, pontua em relação às **referências secretas mantidas pelo organizador** e publica apenas as pontuações. Este é o comando por trás de [Executar uma competição soberana](/docs/network/sovereignty/run-a-sovereign-contest) e do [Nó de avaliação soberano](/docs/network/sovereignty/sovereign-eval-node) — o corpus nunca sai da máquina do organizador |

O `mt-eval node` possui dezoito subcomandos próprios, incluindo a trilha airgap
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) e a
cerimônia de custódia M-de-N (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Execute `mt-eval node --help`; a mecânica
de soberania é descrita nas duas páginas linkadas acima.

**Configuração**

| Subcomando | O que faz |
|---|---|
| `mt-eval setup` | Instala dependências opcionais (métrica neural COMET, runtime FST) |
| `mt-eval logout` | Remove credenciais de autenticação armazenadas |

### Exemplos

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline
```

O harness nunca tenta novamente nem filtra uma tradução rejeitada pelo FST: a
aceitação de FST é uma métrica, pontuada quando o pacote de avaliação do idioma possui um FST. Um
método que deseje novas tentativas guiadas por FST deve realizá-las dentro de seu próprio plugin, como
mostra o tutorial `fst-gated-pipeline`. (`--fst-retries` e `--hooks` nunca foram
conectados a nada na linha de comando; ambos são recusados com esse motivo.)

---

## Esquema de Run Card

Cada experimento produz um **run card** — um documento JSON autossuficiente. A estrutura de nível superior:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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

:::info[Esquema de autoridade]
A [Especificação do Benchmark](/docs/network/specifications/benchmark) é a fonte única da verdade para o esquema do run card. Para definições de métricas e como as execuções são pontuadas, consulte a [Especificação de pontuação](/docs/network/specifications/scoring). Esta página documenta como usar o harness; as especificações definem o significado das saídas.
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

:::caution[Delimitação honesta]
Estas métricas são **diagnósticos** — elas nunca fazem parte da pontuação principal, e a detecção de formalidade é baseada em marcadores (uma heurística), não em um julgamento aprendido. Trate-as como um detector de desvio para aderência de registro, não como um veredito sobre a qualidade do estilo.
:::

---

## Fingerprint vs Hash de Run Card {#fingerprint-vs-run-card-hash}

O harness produz dois hashes distintos. Eles servem propósitos diferentes:

### Fingerprint

O **fingerprint** responde: *"Esta execução poderia ser reproduzida?"*

Ele faz hash da combinação de inputs que definem a configuração do experimento — não os outputs:

- SHA-256 do dataset
- Slug do modelo
- Rótulo de condição
- SHA-256 do prompt de sistema
- Temperatura
- Tamanho do lote
- Ferramentas habilitadas
- Versão do harness

Oito componentes no total: o tamanho do lote e as chamadas de ferramentas alteram a saída
materialmente, portanto fazem parte da identidade do experimento — duas execuções com
tamanhos de lote diferentes **não** compartilham uma impressão digital. Consulte
a [Especificação do Benchmark §3.8](/docs/network/specifications/benchmark#38-fingerprint).

Duas execuções com fingerprints idênticos usaram a mesma configuração. Seus resultados devem ser comparáveis (módulo não-determinismo de API).

### Hash de Run Card

O **hash de run card** responde: *"Este arquivo de resultado específico foi adulterado?"*

É o SHA-256 do JSON de run card inteiro (excluindo o campo `run_card_hash` em si). Se qualquer campo mudar — uma pontuação, um timestamp, um único output — o hash quebra.

:::info[Quando usar qual]
Use a **fingerprint** para agrupar execuções comparáveis (mesmo experimento, execuções diferentes). Use o **hash do cartão de execução** para verificar a integridade de um arquivo de resultado específico.
:::

---

## Publicando no Leaderboard

Após concluir uma execução, use `mt-eval publish` no `<run-id>_report.json` da execução. Uma gravação na tabela de classificação em tempo real precisa de um `--prod` explícito (ou `MT_EVAL_ALLOW_PROD=1`); `mt-eval run --publish --prod` realiza ambas as etapas de uma vez:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
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

- [Avaliação de MT](/docs/network/leaderboard/rules) — visão geral, proposta de valor da tabela de classificação e orientações de métodos bons/ruins
- [Datasets de avaliação](/docs/network/leaderboard/datasets) — formato de datasets, EDTeKLA, FLORES+
- [Especificação do Run Card](/docs/network/specifications/run-card) — o esquema JSON completo
- [Construindo um método](/docs/network/specifications/methods) — a interface de método para criar métodos avaliáveis
- [Tabela de classificação de métodos](https://champollion.dev/leaderboard) — pontuações do benchmark em tempo real
- [Especificação do Benchmark](/docs/network/specifications/benchmark) — protocolo de avaliação, formato de corpus, esquema de run card
- [Especificação de pontuação](/docs/network/specifications/scoring) — SSOT para métricas e como as execuções são pontuadas
