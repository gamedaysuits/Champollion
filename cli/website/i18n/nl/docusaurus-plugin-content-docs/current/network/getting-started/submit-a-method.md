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
python3 -m pip install mt-eval-harness
```

---

## Stap 1: Voer de Harness Uit

De harness beoordeelt uw methode aan de hand van een gestandaardiseerde dataset:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| Vlag | Werking |
|---|---|
| `--corpus` | Corpusbestandspad of geregistreerde corpus-id (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Exacte model-slug — de volledige OpenRouter-id (bijv. `google/gemini-3.1-pro-preview`); korte aliassen en zwevende id's (`…-latest`) worden geweigerd. Met `--method <plugin dir>` het model dat aan uw plug-in wordt doorgegeven als `config.method_model` (elke naamgeving die uw plug-in gebruikt) |
| `-n, --name` | Menselijk leesbaar label voor uw run (verschijnt op het leaderboard) |
| `--temperature` | Samplingtemperatuur (lager = deterministischer) |
| `--fst-retries` | Optioneel: aantal FST-herhaalpogingen |
| `--publish` | Publiceer de run-kaart naar het leaderboard wanneer de run is voltooid |

De harness produceert een **run card** — een op zichzelf staand JSON-bestand met uw scores, de dataset-hash, de model-slug en een cryptografische vingerafdruk die de resultaten koppelt aan de exacte experimentconfiguratie.

---

## Stap 2: Bekijk Uw Run Card

Elke run schrijft twee bestanden naar `eval/logs/harness/`: het runlogbestand `<run-id>.json`
en het beoordeelde rapport `<run-id>_report.json`. Het rapport is wat u publiceert.
Inspecteer het eerst:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

Belangrijke velden in het `overall`-blok van het rapport:
- `corpus_chrf` — chrF++ op corpusniveau (0–100), de hoofd- en rangschikkingsmetriek.
  Het bijbehorende 95%-bootstrap-BI is `confidence_intervals.corpus_chrf` en de bijbehorende
  sacreBLEU-handtekening is `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) en `primary_metric`
  (`"chrf_plus_plus"`) — de standaard waaronder het rapport is beoordeeld
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — de andere standaardmetrieken,
  weergegeven naast chrF++ en er nooit mee vermengd
- `exact_match_rate` — een diagnostiek: het aandeel perfecte vertalingen
- `confidence_intervals` — bootstrap-intervallen voor de bovenstaande metrieken
- `total_cost_usd` — wat de run heeft gekost (`null` wanneer het model geen gepubliceerde
  prijs heeft, bijv. een lokaal model; wordt nooit gerapporteerd als $0)

Het rapport legt ook vast wat het model is meegegeven, als een pointer
(`instructions`: de naam en SHA-256 van het coaching-bestand, de SHA-256 van de
systeemprompt, en waar de volledige tekst zich bevindt: het runlogbestand op uw machine). De
run-kaart die naar het leaderboard gaat, wordt samengesteld uit dit rapport. Deze voegt de
methodekaart en de reproduceerbaarheidsvingerafdruk toe, en begint met dezelfde
chrF++ en BI; de `composite` en `quality_tier` ervan zijn `null`, omdat beide
[buiten gebruik zijn gesteld](/docs/network/specifications/scoring#how-runs-are-scored). (Een rapport
dat vóór de standaard is geschreven, kan een `published_composite` bevatten; dit is een verouderde
samengestelde score, buiten gebruik gesteld en wordt nooit vergeleken met chrF++.)
`mt-eval publish <report> --dry-run` drukt de kaart precies af zoals deze zou worden
gepubliceerd. Zie de [Run-kaartspecificatie](/docs/network/specifications/run-card)
voor het schema ervan.

---

## Stap 3: Indienen

Publiceren schrijft naar het **live** leaderboard, dus vereist een expliciete
`--prod` — zonder deze weigert de harness en meldt dit aan u. Bekijk eerst een voorbeeld:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

Om rechtstreeks vanuit een run te publiceren, voegt u `--publish --prod` toe aan `mt-eval run`. Als de
publicatiestap mislukt, worden de scores van de run alsnog opgeslagen en toont de harness de
exacte opdracht voor opnieuw proberen. Het instellen van `MT_EVAL_ALLOW_PROD=1` in de omgeving is het
equivalent van `--prod` voor scripts.

:::note[De indienings-API en webupload zijn nog niet live]
Een `POST https://champollion.dev/api/leaderboard/submit`-eindpunt en een
upload-UI voor het leaderboard zijn gepland, maar **nog niet geïmplementeerd**. Totdat deze beschikbaar zijn,
is de enige werkende indieningsroute `mt-eval publish` (er is geen
inname via pull requests).
:::

---

## Wat Gebeurt Er Daarna

1. Uw inzending wordt gevalideerd (dataset-hash, integriteit van de run-kaart)
2. Resultaten verschijnen op het leaderboard als **Self-benchmarked** (vertrouwensniveau 1)
3. Om de status **Champollion Verified** te verkrijgen, dient u uw methode in als een installeerbare plug-in zodat beheerders uw resultaten kunnen reproduceren
4. Voor methoden voor inheemse talen: als uw methode de top bereikt, begint het proces voor [eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer)

---

## Zie ook

- [Gebruik van de Harness](/docs/network/specifications/harness) — volledige CLI-referentie
- [Leaderboard-regels](/docs/network/leaderboard/rules) — indieningscriteria en anti-misbruikbeleid
- [Een Methode Bouwen](/docs/network/specifications/methods) — het TranslationMethod-protocol
- [Datasets](/docs/network/leaderboard/datasets) — beschikbare evaluatiedatasets
