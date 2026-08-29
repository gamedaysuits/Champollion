---
sidebar_position: 4
title: "Run Card-specificatie"
---

# Run Card Specificatie

> **Samenvatting.** De run card is de atomaire eenheid van benchmarking — een JSON-document dat de volledige configuratie, resultaten per invoer en geaggregeerde scores van één evaluatierun vastlegt. Deze pagina documenteert het schema, de velden, het vingerafdruksmechanisme en de scorestructuur. Zie de [Benchmark Specificatie](/docs/network/specifications/benchmark) voor canonieke definities.

De run card is het volledige verslag van één enkele evaluatierun. Het bevat alles wat nodig is om het experiment te begrijpen, te reproduceren en te verifiëren: configuratie, scores, individuele resultaten, tokengebruik en omgevingsmetadata.

**Schemaversie:** 2.0

:::info[Gezaghebbend Schema]
De [Benchmark Specificatie](/docs/network/specifications/benchmark) is de enige bron van waarheid voor het run card-schema. Voor metriekdefinities, samengestelde gewichten en kwaliteitsniveaus, zie de [Scoring Specificatie](/docs/network/specifications/scoring). Deze pagina documenteert de huidige implementatie.
:::

---

## Velden op het hoogste niveau

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 gegenereerd bij de start van de run |
| `harness_version` | `string` | Semantische versie van de harness die deze card heeft geproduceerd (bijv. `2.0`) |
| `model_slug` | `string` | Model-slug gebruikt voor de run (bijv. `google/gemini-3.1-pro`) |
| `model_id` | `string` | Opgelost modelidentificator teruggegeven door de API (bijv. `gemini-3.1-pro-001`) |
| `condition` | `string` | Experimentlabel (bijv. `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | ISO 8601 UTC-tijdstempel van het moment waarop de run is gestart |
| `elapsed_seconds` | `number` | Wandkloktijd van de volledige run |

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

Identificeert de evaluatiedataset en koppelt deze aan een specifieke inhoudsversie via SHA-256.

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `id` | `string` | Dataset-identificator (bijv. `edtekla-dev-v1`) |
| `version` | `string` | Versietekenreeks van de dataset |
| `language_pair` | `string` | Weergavelabel (bijv. `EN→CRK`) |
| `sha256` | `string` | SHA-256-hash van de bestandsinhoud van de dataset. Garandeert de exacte gebruikte gegevens |
| `entry_count` | `number` | Aantal invoeren in de dataset |

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

De API- en batchconfiguratie die voor deze run is gebruikt.

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `api_provider` | `string` | Naam van de API-provider (bijv. `openrouter`) |
| `temperature` | `number` | Samplingtemperatuur |
| `max_tokens` | `number` | Maximum aantal tokens per aanvulling |
| `batch_size` | `number` | Invoeren per gelijktijdige batch |
| `concurrency` | `number` | Maximum aantal parallelle API-verzoeken |
| `coaching_file` | `string` | Pad naar het coaching-promptbestand, indien gebruikt |
| `method_path` | `string` | Pad naar de methode-pluginmap, indien gebruikt |
| `fst_retries` | `number` | Aantal FST-pogingen bij herhaalde aanvragen |

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

:::info[Gepubliceerde Run Cards bevatten `method_config`]
Wanneer een run card wordt gepubliceerd via `mt-eval publish`, injecteert `publish.py` een `method_config`-blok met de canonieke 8-veld MethodConfig. Dit maakt installatie via het leaderboard zonder wrijving mogelijk — iedereen kan de methode rechtstreeks vanuit de gepubliceerde card reproduceren.

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

Alle velden gebruiken **camelCase** en volgen het canonieke MethodConfig-schema (zie [Een methode bouwen](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | SHA-256-hash van de systeemprompt. Opgenomen in de vingerafdruk |
| `system_prompt_used` | `string` | De volledige tekst van de systeemprompt die naar het model is verzonden |

De prompthash maakt deel uit van de [vingerafdruk](#fingerprint) — twee runs met verschillende prompts hebben verschillende vingerafdrukken, zelfs als alle andere instellingen overeenkomen.

---

## `fingerprint`

Een reproduceerbaar identificatiemiddel. Twee runs met identieke vingerafdrukken hebben dezelfde experimentele opzet gebruikt.

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `hash` | `string` | SHA-256-hash van de gesorteerde componenten |
| `components` | `object` | De invoerwaarden die zijn gehasht |

### Vingerafdrukcomponenten

| Component | Beschrijving |
|-----------|-------------|
| `dataset_sha256` | Hash van het datasetbestand |
| `model_slug` | Gebruikt model |
| `condition` | Label van de experimentele conditie |
| `system_prompt_sha256` | Hash van de systeemprompt |
| `temperature` | Samplingtemperatuur |
| `harness_version` | Harnessversie |

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

:::info[Vingerafdruk ≠ Run Card Hash]
De vingerafdruk identificeert de *experimentconfiguratie*. De `run_card_hash` verifieert de *integriteit van het resultatenbestand*. Zie [Vingerafdruk vs. Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) voor meer informatie.
:::

---

## `scores`

Geaggregeerde metriekwaarden voor de volledige run.

### Scores op het hoogste niveau

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `total` | `number` | Totaal aantal geëvalueerde invoeren |
| `exact_matches` | `number` | Invoeren waarbij de uitvoer exact overeenkwam met de gouden standaard |
| `exact_match_rate` | `number` | `exact_matches / total` (0,0–1,0) |
| `fst_accepted` | `number` | Invoeren waarbij de FST-analysator de uitvoer heeft geaccepteerd |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0,0–1,0). `null` als er geen FST-analysator is gebruikt |
| `chrf_plus_plus` | `number` | chrF++-score op corpusniveau (0–100) |
| `errors` | `number` | Invoeren die zijn mislukt (API-fout, time-out, enz.) |
| `avg_latency_seconds` | `number` | Gemiddelde responstijd over alle invoeren |
| `median_latency_seconds` | `number` | Mediane responstijd |
| `p95_latency_seconds` | `number` | 95e-percentiel responstijd |

### `by_difficulty`

Scores uitgesplitst naar moeilijkheidsgraad. Elke sleutel (geheel getal 1–5) bevat dezelfde metriekvelden als de scores op het hoogste niveau.

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

Scores uitgesplitst naar herkomst van de invoer. Elke sleutel (bijv. `gold_standard`, `textbook`) bevat dezelfde metriekvelden.

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

Tokengebruik en kostenbewaking voor de volledige run.

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `prompt_tokens` | `number` | Totaal aantal invoertokens over alle API-aanroepen |
| `completion_tokens` | `number` | Totaal aantal uitvoertokens |
| `reasoning_tokens` | `number` | Tokens gebruikt voor chain-of-thought-redenering (modelafhankelijk, 0 voor de meeste modellen) |
| `cached_tokens` | `number` | Tokens geserveerd vanuit de promptcache van de provider |
| `total_cost_usd` | `number` | Totale kosten in USD (zoals gerapporteerd door de API) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0,0–1,0) |

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

Metadata van de runtime-omgeving ten behoeve van reproduceerbaarheid.

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `harness_version` | `string` | Harnessversie (spiegelt het veld `harness_version` op het hoogste niveau) |
| `harness_git_commit` | `string` | Git-commit-SHA van de harness ten tijde van de run |
| `python_version` | `string` | Versie van de Python-interpreter |
| `sacrebleu_version` | `string` | Versie van de sacrebleu-bibliotheek (gebruikt voor chrF++-scoring) |
| `os` | `string` | Besturingssysteemidentificator |

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

De resultatenarray per invoer. Één object per dataset-invoer, in indexvolgorde.

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `entry_id` | `integer` | ID van deze invoer in het corpus (komt overeen met `entries[].id`) |
| `source` | `string` | De brontekst die is vertaald |
| `reference` | `string` | De gouden-standaardreferentie uit het corpus |
| `predicted` | `string` | De werkelijke uitvoer van de methode |
| `exact_match` | `boolean` | Of `predicted` na normalisatie exact overeenkomt met `reference` |
| `entry_chrf` | `number` | chrF++-score op zinsniveau voor deze invoer (0–100) |
| `fst_accepted` | `boolean \| null` | Of de FST-analysator de uitvoer heeft geaccepteerd. `null` als er geen analysator is geconfigureerd |
| `fst_analysis` | `string[]` | FST-analysestrings voor de uitvoer (lege array als niet geanalyseerd of afgewezen) |
| `difficulty` | `integer` | Moeilijkheidsgraad uit het corpus (1–5) |
| `provenance` | `string` | Herkomsttag uit het corpus |
| `latency_seconds` | `number` | Responstijd voor deze individuele invoer |
| `usage` | `object` | Tokengebruik per invoer: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Foutmelding als deze invoer is mislukt. `null` bij succes |

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

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `run_card_hash` | `string` | SHA-256-hash van de volledige run card-JSON, waarbij het veld `run_card_hash` zelf tijdens het hashen is ingesteld op `""` |

Dit is het manipulatiedetectiemechanisme. Het leaderboard herberekent deze hash bij indiening en wijst cards af waarbij de hash niet overeenkomt.

**De hash berekenen:**

1. Serialiseer de run card naar JSON met `run_card_hash` ingesteld op `""`
2. Bereken de SHA-256 van de geserialiseerde tekenreeks
3. Stel `run_card_hash` in op de resulterende hexadecimale samenvatting

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Per-item Detailweergave]
Gepubliceerde run cards vullen ook de `run_card_entries` Supabase-tabel, die per-item resultaten opslaat voor detailanalyse op het leaderboard. Deze tabel wordt automatisch gevuld tijdens `mt-eval publish`.
:::

---

## Zie ook

- [MT-evaluatie](/docs/network/leaderboard/rules) — overzicht, leaderboard-waarde en richtlijnen voor goede en slechte methoden
- [Eval Harness](/docs/network/specifications/harness) — hoe evaluaties uit te voeren en run cards te genereren
- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — datasetformaat, EDTeKLA, FLORES+
- [Een methode bouwen](/docs/network/specifications/methods) — de methode-interface en de methode card-specificatie
- [Methode-leaderboard](https://champollion.dev/leaderboard) — live benchmarkscores
- [Benchmark Specificatie](/docs/network/specifications/benchmark) — evaluatieprotocol, corpusformaat, run card-schema
- [Scoring Specificatie](/docs/network/specifications/scoring) — SSOT voor metriekwaarden, samengestelde gewichten en kwaliteitsniveaus
