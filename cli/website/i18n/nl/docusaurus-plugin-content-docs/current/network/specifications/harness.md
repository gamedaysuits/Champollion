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

> **Samenvatting.** Deze pagina behandelt de installatie, configuratie en het gebruik van de MT-evaluatieharness — het hulpmiddel dat vertaalmethoden benchmarkt aan de hand van gestandaardiseerde corpora en gescoorde run cards produceert. Voor canonieke definities van metrische gegevens, schema's en het evaluatieprotocol, zie de [Benchmark Specification](/docs/network/specifications/benchmark).

De harness voert vertaalexperimenten uit en produceert run cards. Hij verzorgt de opbouw van prompts, API-aanroepen, scoring en serialisatie van resultaten — u levert de dataset en het model.

## Installatie

**Vereisten:** Python 3.10+

```bash
pip install mt-eval-harness
```

Dit installeert het `mt-eval`-commando.

## Gebruik

```bash
mt-eval run --corpus path/to/dataset.json
```

Dit verwerkt elk item in het corpus via het geconfigureerde model (of de methode-plugin), scoort de uitvoer en schrijft een run card JSON-bestand naar de uitvoermap.

## CLI-vlaggen

### `mt-eval run`

| Vlag | Vereist | Standaard | Beschrijving |
|------|---------|-----------|--------------|
| `--corpus` | ✅ | — | Pad naar corpusbestand (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Parallelle tekstbestanden (FLORES+, WMT-formaat) |
| `-m, --model` | — | `gemini-pro` | Model-slug (korte naam of volledig OpenRouter-ID). Wordt opgelost via `shared/model-aliases.json`. Kommagescheiden voor runs met meerdere modellen |
| `-d, --dataset` | — | `all` | Datasetfilter: `all`, segmentnaam of ID-bereik |
| `--ids` | — | — | Kommagescheiden item-ID's om te evalueren |
| `--source-lang` | — | `English` | Naam van de brontaal |
| `--target-lang` | — | — | Naam van de doeltaal |
| `-p, --prompt` | — | `naive` | Promptversie (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Pad naar tekstbestand met coaching-prompt |
| `--coaching` | — | — | Inline coaching-tekst (geciteerde tekenreeks) |
| `--method` | — | — | Pad naar map met methode-plugin (bevat `method.json` + Python-module) |
| `--method-card` | — | — | Pad naar methode-card JSON voor leaderboard-metadata |
| `--fst-retries` | — | `0` | Aantal FST-herpogingen (alleen standaard LLM-methode) |
| `--skip-fst` | — | `false` | FST-kwaliteitspoort volledig overslaan |
| `--tools` | — | `false` | Tool-calling-modus inschakelen |
| `--tools-list` | — | — | Kommagescheiden toolnamen |
| `--max-tool-rounds` | — | `8` | Maximum aantal tool-calling-rondes per item |
| `--hooks` | — | — | Namen van post-vertaalhooks |
| `--style-profile` | — | — | Pad naar een stijlprofiel JSON. Schakelt metrische gegevens voor schrijfstijlconsistentie in (informatief — nooit onderdeel van de samengestelde score; zie [§ Schrijfstijl- en registermetrische gegevens](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Items per API-aanroep |
| `-c, --concurrency` | — | `8` | Parallelle API-aanroepen |
| `--max-tokens` | — | `32768` | Maximaal aantal tokens per API-aanroep |
| `--temperature` | — | `0.0` | Samplingtemperatuur (0.0 = deterministisch) |
| `--no-cache` | — | `false` | Responscaching uitschakelen |
| `--cache-dir` | — | `eval/cache/harness` | Pad naar cachemap |
| `-o, --output-dir` | — | `eval/logs/harness` | Uitvoermap voor run cards en logbestanden |
| `-n, --name` | — | — | Leesbare naam voor de run |
| `--dry-run` | — | `false` | Configuratie valideren zonder API-aanroepen te doen |
| `--champollion-config` | — | — | Pad naar `champollion.config.json` |
| `--champollion-cards-dir` | — | — | Map met taalkaarten |
| `--target-lang-code` | — | — | BCP-47-taalcode |

### Elk subcommando

Alle achttien top-level subcommando's, gegenereerd tegen `mt_eval_harness/cli.py`
op 2026-08-01. Tot die tijd vermeldde deze sectie er zeven, en zes daarvan —
waaronder `node`, de soevereine organisator scoring node — waren
**noch hier, noch in de harness-gids** gedocumenteerd.

**Uitvoeren en scoren**

| Subcommando | Wat het doet |
|---|---|
| `mt-eval run` | Een vertaalrun uitvoeren (vlaggen hierboven) |
| `mt-eval test <log>` | Een voltooid run-logboek analyseren |
| `mt-eval compare <logs…>` | Meerdere run-logboeken vergelijken |
| `mt-eval dashboard <logs…>` | Een interactief HTML-dashboard genereren |
| `mt-eval card <run-card>` | Een voor mensen leesbare run-kaart pretty-printen |

**Vind uw weg naar een methode**

| Subcommando | Wat het doet |
|---|---|
| `mt-eval recommend <src> <tgt>` | Methode-advies voor een talenpaar — beschikbaarheid plus **geciteerd bewijs**, niet slechts een kale ranglijst |
| `mt-eval corpora --source X --target Y` | Beschikbare eval-corpora voor een paar weergeven |
| `mt-eval list models\|prompts\|datasets` | Beschikbare bronnen weergeven |

**Bijdragen**

| Subcommando | Wat het doet |
|---|---|
| `mt-eval publish <report>` | Een TestReport indienen bij het leaderboard |
| `mt-eval queue` | De top van de community compute-wachtrij uitvoeren met uw eigen sleutel — zie [Rekenkracht bijdragen](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Een TestReport verpakken als een champollion-methodeplug-in |
| `mt-eval generate-plugin` | Alias voor `export` |
| `mt-eval export-config` | Een `champollion.config.json`-snippet genereren uit een TestReport |

**Competities, en er zelf een organiseren**

| Subcommando | Wat het doet |
|---|---|
| `mt-eval contest` | Evaluatiecompetities beheren — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | Multi-pair shared-task editie-paraplu: één rij groepeert de N per-paar competities van een AmericasNLP-achtige editie en bevat de beleidsstandaarden ervan. **Alleen groepering en standaarden — elke toegangscontrole blijft per competitie** |
| `mt-eval node` | **De organisator scoring node.** Intake pollen, toegang controleren via de publieke kwalificatie, autoriseren volgens het competitiebeleid, scoren tegen **geheime referenties in het bezit van de organisator**, uitsluitend scores publiceren. Dit is het commando achter [Een soevereine competitie uitvoeren](/docs/network/sovereignty/run-a-sovereign-contest) en de [Soevereine Eval Node](/docs/network/sovereignty/sovereign-eval-node) — het corpus verlaat nooit de machine van de organisator |

`mt-eval node` heeft zeventien eigen subcommando's, waaronder de airgap-lane
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) en de
M-of-N custody ceremony (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Voer `mt-eval node --help` uit; de soevereiniteitsmechanismen
worden beschreven op de twee hierboven gelinkte pagina's.

**Setup**

| Subcommando | Wat het doet |
|---|---|
| `mt-eval setup` | Optionele afhankelijkheden installeren (COMET neural metric, FST runtime) |
| `mt-eval logout` | Opgeslagen authenticatiegegevens verwijderen |

### Voorbeelden

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

## Run Card-schema

Elk experiment produceert een **run card** — een op zichzelf staand JSON-document. De structuur op het hoogste niveau:

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

Zie de [Run Card Specification](/docs/network/specifications/run-card) voor het volledige schema met elk veld gedocumenteerd.

:::info[Gezaghebbend schema]
De [Benchmark Specificatie](/docs/network/specifications/benchmark) is de enige bron van waarheid voor het run card-schema. Voor metriekdefinities, samengestelde gewichten en kwaliteitsniveaus, zie de [Scoring Specificatie](/docs/network/specifications/scoring). Deze pagina documenteert hoe u de harness gebruikt; de specificaties definiëren wat de uitvoer betekent.
:::

### Belangrijkste blokken

**`dataset`** — Identificeert welke dataset is gebruikt, inclusief de inhoudshash zodat resultaten aan een specifieke versie zijn gekoppeld:

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

**`scores`** — Geaggregeerde metrische gegevens voor de run:

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

**`totals`** — Bijhouden van tokengebruik en kosten:

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

## Schrijfstijl- en registermetrische gegevens (informatief) {#writing-style-and-register-metrics-informational}

De harness kan evalueren of vertalingen overeenkomen met een doelregister en **schrijfstijl**, via de `WritingStyleConsistency`-metrische plugin (`mt_eval_harness/plugins/writing_style.py`). Een vertaling kan taalkundig correct zijn maar in het verkeerde register staan — informele bewoordingen in een juridisch document, formele standaardtekst in marketingmateriaal — en tekenreeksmetrische gegevens zullen dit niet opmerken. Deze metrische gegevens wel.

**Wat wordt gemeten (per item):**

| Metriek | Schaal | Betekenis |
|---------|--------|-----------|
| `style_register_match` | booleaans | Komt de uitvoer overeen met het verwachte register? Het doel is afkomstig uit het veld `register` van het corpusitem (zie [Benchmark Spec §2.6](/docs/network/specifications/benchmark)) of uit een stijlprofiel |
| `style_sentence_length_ratio` | float | Voorspelde versus referentie gemiddelde zinslengte (1.0 = overeenkomst; afwijking = stijldrift) |
| `style_formality_score` | 0.0–1.0 | Aanwezigheid van formele/informele markers (T–V-voornaamwoorden, samentrekkingen, …) met behulp van taalspecifieke markerresources |

**Geaggregeerd:** `style_consistency_rate` — het aandeel items zonder gedetecteerde registermismatch.

Schakel een aangepast doel in met `--style-profile path/to/profile.json` (bijv. een merkstemprofiel); zonder dit valt de plugin terug op de `register`-metadata van elk corpusitem waar aanwezig.

:::caution[Eerlijke afbakening]
Deze metrieken zijn **uitsluitend informatief** — ze maken nooit deel uit van de samengestelde score, en de formaliteitsdetectie is op markeringen gebaseerd (een heuristiek), geen aangeleerd oordeel. Behandel ze als een driftdetector voor registerconformiteit, niet als een uitspraak over stijlkwaliteit.
:::

---

## Vingerafdruk versus run card-hash {#fingerprint-vs-run-card-hash}

De harness produceert twee afzonderlijke hashes. Ze dienen verschillende doeleinden:

### Vingerafdruk

De **vingerafdruk** beantwoordt de vraag: *"Kan deze run worden gereproduceerd?"*

Hij hasht de combinatie van invoergegevens die de experimentconfiguratie definiëren — niet de uitvoer:

- Dataset SHA-256
- Model-slug
- Conditielabel
- Systeemprompt SHA-256
- Temperatuur
- Harness-versie

Twee runs met identieke vingerafdrukken hebben dezelfde configuratie gebruikt. Hun resultaten zouden vergelijkbaar moeten zijn (met uitzondering van API-niet-determinisme).

### Run card-hash

De **run card-hash** beantwoordt de vraag: *"Is dit specifieke resultaatbestand gemanipuleerd?"*

Het is de SHA-256 van de volledige run card JSON (exclusief het veld `run_card_hash` zelf). Als een veld wijzigt — een score, een tijdstempel, een enkele uitvoer — wordt de hash ongeldig.

:::info[Wanneer welke te gebruiken]
Gebruik de **fingerprint** om vergelijkbare runs te groeperen (hetzelfde experiment, verschillende uitvoeringen). Gebruik de **run card hash** om de integriteit van een specifiek resultaatbestand te verifiëren.
:::

---

## Publiceren naar het leaderboard

Na het voltooien van een run gebruikt u `mt-eval publish` om de run card in te dienen:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Als er tijdens de run geen `--method-card` is opgegeven, start `mt-eval publish` een interactieve wizard (`method_card_wizard.py`) die u begeleidt bij het beschrijven van uw methode (naam, klasse, gebruikte tools, enz.). De uitvoer van de wizard wordt in de run card ingesloten vóór indiening.

### Handmatige inspectie

Run cards worden opgeslagen als JSON-bestanden in de uitvoermap (`eval/logs/harness/` standaard) — inspecteer ze daar vóór publicatie. `mt-eval publish` is het indieningspad; er is geen op PR gebaseerde run card-intake.

:::note[De indiening-API en webupload zijn nog niet beschikbaar]
Een `POST https://champollion.dev/api/leaderboard/submit`-eindpunt en een Leaderboard-upload-UI zijn gepland maar **nog niet geïmplementeerd**. Totdat ze beschikbaar zijn, is `mt-eval publish` het enige werkende indieningspad.
:::

:::warning[Leaderboard-validatie]
Het leaderboard valideert ingediende run cards aan de hand van het datasetregister. Inzendingen die verwijzen naar onbekende datasets, of met een gebroken `run_card_hash`, worden afgewezen.
:::

:::danger[TRAIN NIET op evaluatiedata]
Als uw methode de evaluatiedataset tijdens de ontwikkeling heeft gezien — als trainingsdata, few-shot-voorbeelden, woordenboekitems of prompt engineering-materiaal — wordt uw inzending **gediskwalificeerd**. Zie [MT Evaluatie](/docs/network/leaderboard/rules) voor wat een goede versus slechte methode onderscheidt.
:::

---

## Zie ook

- [MT Evaluation](/docs/network/leaderboard/rules) — overzicht, de waardepropositie van het leaderboard en richtlijnen voor goede en slechte methoden
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — datasetformaat, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — het volledige JSON-schema
- [Building a Method](/docs/network/specifications/methods) — de methode-interface voor het maken van evalueerbare methoden
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmarkscores
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluatieprotocol, corpusformaat, run card-schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT voor metrische gegevens, samengestelde gewichten en kwaliteitsniveaus
