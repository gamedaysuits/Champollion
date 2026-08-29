---
sidebar_position: 1
title: "Magsumite ng Paraan"
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

# Magsumite ng Method

> **Pangkalahatang Buod.** Isang step-by-step quickstart para sa pagsusumite ng inyong unang benchmark run sa leaderboard. I-install ang harness, patakbuhin ito laban sa isang dataset, suriin ang inyong run card, at i-publish. Tumatagal ng 10 minuto kung mayroon kayong API key.

Gagabayan kayo ng gabay na ito sa pagsusumite ng inyong unang benchmark run sa Network leaderboard.

---

## Mga Prerequisite

- **Python 3.11+**
- **Isang OpenRouter API key** (o katumbas nito para sa inyong model provider)
- **Isang paraan ng pagsasalin** — anumang gumagawa ng mga salin mula sa pinagmulang teksto

```bash
# Install the eval harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

---

## Hakbang 1: Patakbuhin ang Harness

Ini-score ng harness ang inyong method laban sa isang standardized dataset:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Flag | Ginagawa Nito |
|---|---|
| `--corpus` | File path ng corpus o nakarehistrong corpus id (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Model slug — maikling alias (hal. `gemini-pro`) o buong OpenRouter ID |
| `-n, --name` | Label na nababasa ng tao para sa inyong run (lumalabas sa leaderboard) |
| `--temperature` | Sampling temperature (mas mababa = mas deterministic) |
| `--fst-retries` | Opsyonal: bilang ng mga FST retry attempt |
| `--publish` | I-publish ang run card sa leaderboard kapag natapos ang run |

Gumagawa ang harness ng **run card** — isang self-contained na JSON file na naglalaman ng inyong mga score, dataset hash, model slug, at cryptographic fingerprint na nag-uugnay sa mga resulta sa eksaktong configuration ng eksperimento.

---

## Hakbang 2: Suriin ang Inyong Run Card

Sine-save ang mga run card sa `eval/logs/harness/`. Suriin ang sa inyo bago magsumite:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

Mahahalagang field na dapat suriin:
- `scores.chrf_plus_plus` — ang inyong pangunahing metric ng kalidad
- `scores.exact_match_rate` — proporsyon ng mga perpektong salin
- `scores.fst_acceptance_rate` — morphological validity (kung ginamit ang FST)
- `totals.total_cost_usd` — gastos ng run
- `fingerprint` — reproducibility hash ng eksperimento

Tingnan ang [Run Card Specification](/docs/network/specifications/run-card) para sa buong schema.

---

## Hakbang 3: Magsumite

### Awtomatikong publication

Kung ipinasa ninyo ang `--publish` noong pinatakbo ang harness, na-upload na ang inyong run card.

### Manual na publication

I-publish ang anumang run card gamit ang harness:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Kung mas nais ninyong hindi gamitin ang publish flow, magbukas ng pull request laban sa
[eval harness repository](https://github.com/gamedaysuits/Champollion)
kasama ang inyong run card JSON sa directory na `results/`.

:::note[Hindi pa live ang submission API at web upload]
Isang `POST https://champollion.dev/api/leaderboard/submit` endpoint at isang
Leaderboard upload UI ang nakaplano ngunit **hindi pa naipapatupad**. Hanggang mailabas ang mga ito,
ang tanging gumaganang mga paraan ng pagsusumite ay `mt-eval publish` at isang pull request sa
harness repo sa itaas.
:::

---

## Ano ang Susunod na Mangyayari

1. Ang inyo pong isinumite ay dadaan sa balidasyon (dataset hash, run card integrity)
2. Lalabas po ang mga resulta sa leaderboard bilang **Self-benchmarked** (trust tier 1)
3. Upang makuha po ang **Champollion Verified** status, isumite po ang inyong method bilang isang installable plugin upang ma-reproduce ng mga maintainer ang inyong mga resulta
4. Para po sa mga method ng mga Katutubong wika: kung manguna po ang inyong method, magsisimula na po ang proseso ng [paglipat ng pagmamay-ari](/docs/network/sovereignty/ownership-transfer)

---

## Tingnan Din

- [Paggamit ng Harness](/docs/network/specifications/harness) — buong CLI reference
- [Mga Panuntunan ng Leaderboard](/docs/network/leaderboard/rules) — criteria sa pagsusumite at mga anti-gaming policy
- [Pagbuo ng Method](/docs/network/specifications/methods) — ang TranslationMethod protocol
- [Mga Dataset](/docs/network/leaderboard/datasets) — mga available na evaluation dataset
