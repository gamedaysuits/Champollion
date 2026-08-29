---
sidebar_position: 1
title: "Een methode indienen"
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

# Een Methode Indienen

> **Samenvatting.** Een stapsgewijze snelstart voor het indienen van uw eerste benchmark-run bij het leaderboard. Installeer de harness, voer deze uit tegen een dataset, bekijk uw run card en publiceer. Duurt 10 minuten als u een API-sleutel heeft.

Deze handleiding begeleidt u bij het indienen van uw eerste benchmark-run bij het Network-leaderboard.

---

## Vereisten

- **Python 3.11+**
- **Een OpenRouter API-sleutel** (of equivalent voor uw modelprovider)
- **Een vertaalmethode** — alles wat vertalingen produceert vanuit een brontekst

```bash
# Install the eval harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

---

## Stap 1: Voer de Harness Uit

De harness beoordeelt uw methode aan de hand van een gestandaardiseerde dataset:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Vlag | Wat Het Doet |
|---|---|
| `--corpus` | Pad naar corpusbestand of geregistreerd corpus-id (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Model-slug — korte alias (bijv. `gemini-pro`) of volledig OpenRouter-ID |
| `-n, --name` | Leesbaar label voor uw run (verschijnt op het leaderboard) |
| `--temperature` | Samplingtemperatuur (lager = meer deterministisch) |
| `--fst-retries` | Optioneel: aantal FST-herpogingen |
| `--publish` | Publiceer de run card naar het leaderboard wanneer de run is voltooid |

De harness produceert een **run card** — een op zichzelf staand JSON-bestand met uw scores, de dataset-hash, de model-slug en een cryptografische vingerafdruk die de resultaten koppelt aan de exacte experimentconfiguratie.

---

## Stap 2: Bekijk Uw Run Card

Run-kaarten worden opgeslagen in `eval/logs/harness/`. Inspecteer de uwe vóór het indienen:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

Belangrijke velden om te controleren:
- `scores.chrf_plus_plus` — uw primaire kwaliteitsmetriek
- `scores.exact_match_rate` — aandeel perfecte vertalingen
- `scores.fst_acceptance_rate` — morfologische geldigheid (indien FST werd gebruikt)
- `totals.total_cost_usd` — wat de run heeft gekost
- `fingerprint` — de reproduceerbaarheidshash van het experiment

Zie de [Run Card-specificatie](/docs/network/specifications/run-card) voor het volledige schema.

---

## Stap 3: Indienen

### Automatische publicatie

Als u `--publish` heeft meegegeven bij het uitvoeren van de harness, is uw run card al geüpload.

### Handmatige publicatie

Publiceer een willekeurige run card met de harness:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Als u de publicatiestroom liever niet gebruikt, opent u een pull request tegen de
[eval harness-repository](https://github.com/gamedaysuits/Champollion)
met uw run card JSON in de map `results/`.

:::note[De inzending-API en webupload zijn nog niet beschikbaar]
Een `POST https://champollion.dev/api/leaderboard/submit`-eindpunt en een
uploadinterface voor het Leaderboard zijn gepland, maar **nog niet geïmplementeerd**. Totdat deze beschikbaar zijn,
zijn de enige werkende inzendingsmethoden `mt-eval publish` en een pull request naar
de bovengenoemde harness-repository.
:::

---

## Wat Gebeurt Er Daarna

1. Uw inzending wordt gevalideerd (dataset-hash, integriteit van de run card)
2. Resultaten verschijnen op het leaderboard als **Self-benchmarked** (vertrouwensniveau 1)
3. Om de status **Champollion Verified** te verkrijgen, moet u uw methode indienen als een installeerbare plug-in, zodat maintainers uw resultaten kunnen reproduceren
4. Voor methoden voor inheemse talen: als uw methode de top bereikt, begint het proces van [eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer)

---

## Zie ook

- [Gebruik van de Harness](/docs/network/specifications/harness) — volledige CLI-referentie
- [Leaderboard-regels](/docs/network/leaderboard/rules) — indieningscriteria en anti-misbruikbeleid
- [Een Methode Bouwen](/docs/network/specifications/methods) — het TranslationMethod-protocol
- [Datasets](/docs/network/leaderboard/datasets) — beschikbare evaluatiedatasets
