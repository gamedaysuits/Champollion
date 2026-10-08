---
sidebar_position: 1
title: "Enviar um Método"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# Enviar um Método

> **Resumo Executivo.** Um guia passo a passo para enviar sua primeira execução de benchmark para o placar. Instale o harness, execute-o contra um dataset, revise seu cartão de execução e publique. Leva 10 minutos se você tiver uma chave de API.

Este guia o orienta através do envio de sua primeira execução de benchmark para o placar da Network.

---

## Pré-requisitos

- **Python 3.11+**
- **Uma chave de API OpenRouter** (ou equivalente para seu provedor de modelo)
- **Um método de tradução** — qualquer coisa que produza traduções a partir de um texto de origem

```bash
# Install the eval harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

---

## Passo 1: Execute o Harness

O harness avalia seu método contra um dataset padronizado:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| Flag | O que faz |
|---|---|
| `--corpus` | Caminho do arquivo de corpus ou id de corpus registrado (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug exato do modelo — o id completo do OpenRouter (ex.: `google/gemini-3.1-pro-preview`); aliases curtos e ids flutuantes (`…-latest`) são recusados. Com `--method <plugin dir>`, o modelo passado ao seu plugin como `config.method_model` (qualquer nomenclatura que seu plugin utilize) |
| `-n, --name` | Rótulo legível por humanos para a sua execução (aparece na tabela de classificação) |
| `--temperature` | Temperatura de amostragem (menor = mais determinístico) |
| `--fst-retries` | Opcional: número de tentativas de repetição do FST |
| `--publish` | Publica o cartão de execução na tabela de classificação quando a execução terminar |

O harness produz um **cartão de execução** — um arquivo JSON autossuficiente com suas pontuações, o hash do dataset, o slug do modelo e uma impressão digital criptográfica vinculando resultados à configuração exata do experimento.

---

## Passo 2: Revise Seu Cartão de Execução

Cada execução grava dois arquivos em `eval/logs/harness/`: o log de execução `<run-id>.json`
e o relatório pontuado `<run-id>_report.json`. O relatório é o que você publica.
Inspecione-o primeiro:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

Campos principais no bloco `overall` do relatório:
- `corpus_chrf` — chrF++ em nível de corpus (0–100), a métrica principal e de
  classificação. Seu IC bootstrap de 95% é `confidence_intervals.corpus_chrf` e sua
  assinatura sacreBLEU é `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) e `primary_metric`
  (`"chrf_plus_plus"`) — o padrão sob o qual o relatório foi pontuado
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — as outras métricas padrão,
  exibidas ao lado do chrF++ e nunca misturadas a ele
- `exact_match_rate` — um diagnóstico: a proporção de traduções perfeitas
- `confidence_intervals` — intervalos de bootstrap para as métricas acima
- `total_cost_usd` — o custo da execução (`null` quando o modelo não tem preço
  publicado, por exemplo, um modelo local; nunca reportado como $0)

O relatório também registra o que foi informado ao modelo, como um ponteiro
(`instructions`: o nome e o SHA-256 do arquivo de coaching, o SHA-256
do prompt do sistema e onde está o texto completo, o log de execução na sua máquina). O cartão
de execução enviado para a tabela de classificação é montado a partir deste relatório. Ele adiciona o
cartão de método e o fingerprint de reprodutibilidade, e lidera com o mesmo
chrF++ e IC; seus `composite` e `quality_tier` são `null`, pois ambos estão
[descontinuados](/docs/network/specifications/scoring#how-runs-are-scored). (Um relatório
gerado antes do padrão pode conter um `published_composite`; trata-se de um composto
legado, descontinuado, e nunca comparado com o chrF++.)
`mt-eval publish <report> --dry-run` exibe o cartão exatamente como seria
publicado. Consulte a [Especificação do Run Card](/docs/network/specifications/run-card)
para conferir seu esquema.

---

## Passo 3: Envie

A publicação grava na tabela de classificação **ativa**, portanto requer um
`--prod` explícito — sem ele, o harness recusa e avisa você. Visualize uma prévia primeiro:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

Para publicar diretamente a partir de uma execução, adicione `--publish --prod` ao `mt-eval run`. Se a
etapa de publicação falhar, as pontuações da execução ainda são salvas e o harness exibe o
comando exato para tentar novamente. Definir `MT_EVAL_ALLOW_PROD=1` no ambiente é o
equivalente a `--prod` para scripts.

:::note[A API de envio e o upload via web ainda não estão disponíveis]
Um endpoint `POST https://champollion.dev/api/leaderboard/submit` e uma
interface de upload para a tabela de classificação estão planejados, mas **ainda não foram implementados**. Até que sejam lançados,
o único caminho de envio funcional é `mt-eval publish` (não há
recebimento via pull request).
:::

---

## O que Acontece Depois

1. Seu envio é validado (hash do dataset, integridade do run card)
2. Os resultados aparecem na tabela de classificação como **Self-benchmarked** (nível de confiança 1)
3. Para obter o status **Champollion Verified**, envie seu método como um plugin instalável para que os mantenedores possam reproduzir seus resultados
4. Para métodos de línguas indígenas: se o seu método alcançar o topo, o processo de [transferência de titularidade](/docs/network/sovereignty/ownership-transfer) é iniciado

---

## Veja Também

- [Uso do Harness](/docs/network/specifications/harness) — referência completa da CLI
- [Regras do Placar](/docs/network/leaderboard/rules) — critérios de envio e políticas anti-gaming
- [Construindo um Método](/docs/network/specifications/methods) — o protocolo TranslationMethod
- [Datasets](/docs/network/leaderboard/datasets) — datasets de avaliação disponíveis
