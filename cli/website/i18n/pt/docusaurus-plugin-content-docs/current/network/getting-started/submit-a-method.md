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
pip install mt-eval-harness
```

---

## Passo 1: Execute o Harness

O harness avalia seu método contra um dataset padronizado:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Flag | O que faz |
|---|---|
| `--corpus` | Caminho do arquivo de corpus ou ID de corpus registrado (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug do modelo — alias curto (ex. `gemini-pro`) ou ID completo do OpenRouter |
| `-n, --name` | Rótulo legível por humanos para sua execução (aparece no placar) |
| `--temperature` | Temperatura de amostragem (menor = mais determinístico) |
| `--fst-retries` | Opcional: número de tentativas de retry do FST |
| `--publish` | Publique o cartão de execução no placar quando a execução terminar |

O harness produz um **cartão de execução** — um arquivo JSON autossuficiente com suas pontuações, o hash do dataset, o slug do modelo e uma impressão digital criptográfica vinculando resultados à configuração exata do experimento.

---

## Passo 2: Revise Seu Cartão de Execução

Os cartões de execução são salvos em `eval/logs/harness/`. Inspecione o seu antes de enviar:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

Campos-chave para verificar:
- `scores.chrf_plus_plus` — sua métrica de qualidade primária
- `scores.exact_match_rate` — proporção de traduções perfeitas
- `scores.fst_acceptance_rate` — validade morfológica (se FST foi usado)
- `totals.total_cost_usd` — o que a execução custou
- `fingerprint` — o hash de reprodutibilidade do experimento

Veja a [Especificação do Cartão de Execução](/docs/network/specifications/run-card) para o schema completo.

---

## Passo 3: Envie

### Publicação automática

Se você passou `--publish` ao executar o harness, seu cartão de execução já foi enviado.

### Publicação manual

Publique qualquer cartão de execução com o harness:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Se você preferir não usar o fluxo de publicação, abra um pull request contra o
[repositório do harness de avaliação](https://github.com/gamedaysuits/Champollion)
com seu JSON do cartão de execução no diretório `results/`.

:::note[A API de envio e o upload web ainda não estão disponíveis]
Um endpoint `POST https://champollion.dev/api/leaderboard/submit` e uma
interface de upload do Leaderboard estão planejados mas **ainda não foram implementados**. Até que sejam lançados,
os únicos caminhos de envio funcionais são `mt-eval publish` e um pull request para
o repositório harness acima.
:::

---

## O que Acontece Depois

1. Sua submissão é validada (hash do dataset, integridade do run card)
2. Os resultados aparecem no leaderboard como **Self-benchmarked** (nível de confiança 1)
3. Para obter o status **Champollion Verified**, submeta seu método como um plugin instalável para que os mantenedores possam reproduzir seus resultados
4. Para métodos de línguas indígenas: se o seu método alcançar o topo, o processo de [transferência de propriedade](/docs/network/sovereignty/ownership-transfer) é iniciado

---

## Veja Também

- [Uso do Harness](/docs/network/specifications/harness) — referência completa da CLI
- [Regras do Placar](/docs/network/leaderboard/rules) — critérios de envio e políticas anti-gaming
- [Construindo um Método](/docs/network/specifications/methods) — o protocolo TranslationMethod
- [Datasets](/docs/network/leaderboard/datasets) — datasets de avaliação disponíveis
