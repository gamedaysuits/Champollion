---
sidebar_position: 4
title: "Run Card-specificatie"
---

# Run Card Specificatie

> **Samenvatting.** De run card is de atomaire eenheid van benchmarking — een JSON-document dat de volledige configuratie, resultaten per invoer en geaggregeerde scores van één evaluatierun vastlegt. Deze pagina documenteert het schema, de velden, het vingerafdruksmechanisme en de scorestructuur. Zie de [Benchmark Specificatie](/docs/network/specifications/benchmark) voor canonieke definities.

De run card is het volledige verslag van één enkele evaluatierun. Het bevat alles wat nodig is om het experiment te begrijpen, te reproduceren en te verifiëren: configuratie, scores, individuele resultaten, tokengebruik en omgevingsmetadata.

**Schemaversie:** 2.0

:::info[Gezaghebbend schema]
De [Benchmarkspecificatie](/docs/network/specifications/benchmark) is de single source of truth voor het run card-schema. Zie de [Scoringspecificatie](/docs/network/specifications/scoring) voor definities van metrieken en hoe runs worden gescoord (het chrF++-hoofdcijfer, de standaardmetrieken ernaast, de diagnostiek). Deze pagina documenteert de huidige implementatie.
:::

---

## Velden op het hoogste niveau

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 gegenereerd bij de start van de run |
| `harness_version` | `string` | Semantische versie van de harness die deze kaart heeft geproduceerd (bijv. `2.0`) |
| `model_slug` | `string` | Model-slug die voor de run is gebruikt (bijv. `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | Opgeloste modelidentificatie geretourneerd door de API (bijv. `gemini-3.1-pro-001`) |
| `condition` | `string` | Experimentlabel: wat de harness schrijft is `naive` (de ingebouwde prompt), `coached` (een coachingbestand heeft deze vervangen) of, voor een methode-plugin, de methodeklasse; vrije tekst, dus een handmatig samengestelde kaart kan `coached-v3` of `few-shot` bevatten. Geen kwaliteitslabel (kwaliteitsniveaus zijn buiten gebruik gesteld; `scores.quality_tier` is null op elke nieuwe kaart) |
| `timestamp` | `string` | ISO 8601 UTC-tijdstempel van wanneer de run begon |
| `elapsed_seconds` | `number` | Totale verstreken tijd (wall-clock) van de gehele run |

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
| `api_provider` | `string` | Wat de tekst heeft overgebracht: de API-provider voor het eigen LLM-pad van de harness (`openrouter`, `openai`, `anthropic`, `gemini`, `local`); de engine-id voor een MT-engine (bijv. `google-translate`); voor een methode-plugin `local` wanneer de beheerder een volledig lokaal transport heeft bevestigd (`--attest-local-transport`), anders `method-plugin` |
| `temperature` | `number` | Sampling-temperatuur |
| `max_tokens` | `number` | Maximaal aantal tokens per voltooiing |
| `batch_size` | `number` | Items per gelijktijdige batch |
| `concurrency` | `number` | Maximaal aantal parallelle API-verzoeken |
| `coaching_file` | `string` | Pad naar het coaching-promptbestand, indien gebruikt (de eigen vermelding in het run-logboek; een gepubliceerde kaart vermeldt de coaching op bestandsnaam, of `inline coaching` voor `--coaching`-tekst — nooit een lokaal pad) |
| `method_path` | `string` | Pad naar de map van de methode-plugin, indien gebruikt |
| `fst_retries` | `number` | Aantal FST-herhaalpogingen |

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

`qualityTier` is altijd `null` op een nieuwe kaart: kwaliteitsniveaus zijn buiten gebruik gesteld. Alle velden gebruiken **camelCase** en volgen het canonieke MethodConfig-schema (zie [Een methode bouwen](/docs/network/specifications/methods)).
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

De canonieke lijst is [Benchmarkspecificatie §3.8](/docs/network/specifications/benchmark#38-fingerprint). In het kort:

| Component | Beschrijving |
|-----------|-------------|
| `dataset_sha256` | Hash van het datasetbestand |
| `model_slug` | Gebruikt model (voor een MT-engine of een methode-plugin: de engine- of methode-id) |
| `condition` | Label van de experimentconditie |
| `system_prompt_sha256` | Hash van de systeemprompt |
| `temperature` | Sampling-temperatuur |
| `batch_size`, `tools_enabled` | Batching en toolgebruik |
| `harness_version` | Harness-versie |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | Versie 2 (harness 0.2.0 en later): het kanaal, de endpoint-host (gehasht), de tokenlimiet en de versie en code-hash van de methode |
| `method_model`, `method_dependencies_sha256` | Versie 2, alleen runs van methode-plugins: het model dat aan de plugin is meegegeven (`-m`) en de hash van de gedeclareerde `dependencies` |
| `method_model`, `method_model_sha256` | Versie 2, alleen runs van `--method local-model`: het model dat is geladen (Hugging Face-id of mapnaam) en de bijbehorende inhouds-hash (een map) of revisie (een Hugging Face-id) |

`fingerprint.version` geeft aan onder welke lijst een kaart is gehasht.

### `engine_model`

Een run van een MT-engine die een model uitvoert dat eraan wordt meegegeven (`--method local-model -m <model>`), bevat het model dat is geladen:

| Veld | Beschrijving |
|-------|-------------|
| `given` | Wat `-m` aangaf |
| `kind` | `directory` of `hub` (een Hugging Face-id) |
| `id` | De Hugging Face-id of de naam van de map (nooit het lokale pad) |
| `sha256` | Alleen bij een map: SHA-256 over een lijst van bestanden in de stijl van `sha256sum` |
| `revision` | Alleen bij een Hugging Face-id: de revisie die is geladen |
| `family`, `backend` | `opus`, `nllb` of `madlad`; `transformers` of `ctranslate2` |
| `decode` | Hoe lang de uitvoer mocht zijn: de lengte die het model declareert, of de regel van de harness (`max(64, 4 × source tokens)` nieuwe tokens, begrensd door de posities van de decoder) |
| `pair_mismatch` | Alleen aanwezig wanneer een OPUS-MT-paarmodel voor een ander paar opzettelijk werd uitgevoerd (`--allow-model-pair-mismatch`) |

`method_config.model` noemt hetzelfde model (`<id>@<revision>` of `<directory name>@sha256:<hash>`). Een `local-model`-runlogboek waarin geen model is vastgelegd, publiceert niets: de kaart geeft `engine_model_unrecorded` aan en `mt-eval publish` weigert deze.

### `method_plugin`

Een run van een methode-plugin (`--method <plugin dir>`) bevat ook wat de plugin identificeert, zoals vastgelegd door de runner:

| Veld | Beschrijving |
|-------|-------------|
| `version` | De versie die `method.json` declareert (`null` wanneer er geen wordt gedeclareerd) |
| `code_sha256` | SHA-256 over de bestanden van de plugin (`method.json` en de bijbehorende `.py`-bestanden, een manifest in `sha256sum`-stijl) |
| `model_given` | Het model dat met `-m/--model` aan de plugin is doorgegeven, of `null` |
| `models_called`, `models_basis` | Het model / de modellen die de plugin volgens de melding heeft aangeroepen, en of dat is waargenomen aan de hand van de resultaten of gedeclareerd |
| `dependency_class` | De afhankelijkheidsklasse die `method.json` declareert |
| `dependencies` | De lijst `dependencies` die `method.json` declareert, zonder de vrije tekst `notes` |
| `dependencies_sha256` | SHA-256 van de volledige gedeclareerde lijst (de fingerprint-component) |

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

:::info[Vingerafdruk ≠ Run Card Hash]
De vingerafdruk identificeert de *experimentconfiguratie*. De `run_card_hash` verifieert de *integriteit van het resultatenbestand*. Zie [Vingerafdruk vs. Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) voor meer informatie.
:::

---

## `scores`

Geaggregeerde metriekwaarden voor de volledige run.

### Scores op het hoogste niveau

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `total` | `number` | Totaal aantal geëvalueerde items |
| `exact_matches` | `number` | Items waarvan de uitvoer exact overeenkwam met de gouden standaard |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | Uitvoer-**woorden** die de FST-analyzer heeft geaccepteerd, opgeteld over alle items (geen aantal items). `null` als er geen FST-analyzer is gebruikt |
| `fst_acceptance_rate` | `number` | Gemiddelde van de acceptatiepercentages per item (de geaccepteerde woorden van elk item ÷ het aantal woorden; een lege uitvoer telt als 0), 0.0–1.0. Dit is **niet** `fst_accepted` ÷ alle woorden — dat samengevoegde woordpercentage is `corpus_validity_rate` van het rapport, op de run card weergegeven als "Words accepted". `null` als er geen FST-analyzer is gebruikt |
| `chrf_plus_plus` | `number` | **Het hoofdcijfer en de rangschikkingsmetriek:** chrF++ op corpusniveau (sacreBLEU chrF, `word_order=2`), 0–100. Het 95%-bootstrap-BI is `confidence_intervals.corpus_chrf` en de signature `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` op elke nieuwe kaart. Een kaart zonder dit veld is gescoord onder de buiten gebruik gestelde samengestelde score (`legacy-composite`) en wordt op die manier geverifieerd |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | Standaardmetrieken die naast chrF++ worden getoond, nooit gemengd (BLEU is de `corpus_bleu` op het hoogste niveau van de kaart; COMET is `comet_score` met `comet_model`, indien berekend) |
| `sacrebleu_signatures` | `object` | De sacreBLEU-signature van elke berekende sacreBLEU-metriek: `chrf` (het hoofdcijfer), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | 95%-bootstrap-intervallen; `corpus_chrf` is die van het hoofdcijfer |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **Buiten gebruik gesteld.** Altijd `null` op een nieuwe kaart. Een verouderde kaart behoudt de opgeslagen waarden; een weergave die deze samengestelde score nog toont, labelt deze als "legacy composite (retired)" |
| `errors` | `number` | Items die zijn mislukt (API-fout, time-out, enz.) |
| `avg_latency_seconds` | `number` | Gemiddelde reactietijd over alle items |
| `median_latency_seconds` | `number` | Mediane reactietijd |
| `p95_latency_seconds` | `number` | 95e percentiel van reactietijd |

### `by_difficulty`

Scores uitgesplitst naar moeilijkheidsniveau, ingedeeld op niveau (`"1"`–`"5"`, `"0"` voor niet-beoordeeld). De velden zijn **niet** dezelfde als die op het hoogste niveau: `avg_chrf` en `avg_bleu` zijn het **gemiddelde per zin** van chrF++ en BLEU over de items van het niveau, terwijl de `chrf_plus_plus` en BLEU op het hoogste niveau op **corpusniveau** liggen (berekend over alle segmenten tegelijk). Dit zijn twee verschillende statistieken: met name corpus-BLEU ligt gewoonlijk ver onder het gemiddelde van zin-BLEU, dus een hoofdcijfer van 0.5 naast een niveauwaarde van 10.2 is geen tegenstrijdigheid. Vergelijk niveaus met elkaar, nooit met het hoofdcijfer.

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

## `score_caveats`

Alleen aanwezig wanneer iets de betekenis van de scores beperkt. Een score kan
correct worden berekend en toch niet meten wat het label aangeeft, dus het
voorbehoud reist mee met het cijfer: `mt-eval test`, `mt-eval card`,
`mt-eval compare`, het dashboard en de voorvertoning van `mt-eval publish` tonen het
naast het hoofdcijfer, en `publish` slaat het hier op zodat het scorebord dit kan weergeven.
Het verandert nooit een score: het chrF++-hoofdcijfer wordt zoals gebruikelijk berekend, en de
kanttekening vermeldt wat dit cijfer of een diagnostiek ernaast beperkt.

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` of `near_constant_output` |
| `source` | `string` | Wie het heeft gemeten: `nmt-forge` of `mt-eval-harness` |
| `severity` | `string` | `major` (interpreteer het hoofdcijfer in dit licht) of `minor` |
| `message` | `string` | Eén zin, maximaal 480 tekens |

**`train_test_near_twin`**, geschreven door nmt-forge. Wanneer `nmt-forge export` (of
`evaluate`) een model scoort, controleert het elke testrij op een nagenoeg identieke tegenhanger
in de trainingsgegevens en legt het resultaat vast in de mt-eval-bestanden die het schrijft.
De harness kopieert die meting naar de kaart: `near_twin_rows` van de `n` testrijen
heeft een tegenhanger (`near_twin_share`), en `strict_n` rijen hebben er geen. Wanneer
daarvan voldoende zijn, geven `strict_corpus_chrf` en `strict_corpus_chrf_ci`
de chrF++ uitsluitend daarover weer, wat het generalisatiecijfer is.
`recall_not_translation` is `true` wanneer ten minste de helft van de rijen een tegenhanger heeft.
In dat geval meet zelfs een chrF++ van 100 hoe goed het model trainingszinnen
onthoudt, en niet hoe goed het vertaalt. Als de controle van forge niet is uitgevoerd,
is de kanttekening `minor` en vermeldt dit. Een controle die geen tegenhanger vond, voegt geen kanttekening toe.

**`length_inflation`**, gemeten door de harness. Dit wordt toegevoegd wanneer de uitvoer
gemiddeld meer dan 2× de referentielengte bedraagt (de inflatiegrens van
[`length_ratio`](/docs/network/specifications/scoring)), of wanneer ten minste een
kwart van de gescoorde items dat doet. Uitgelekte few-shot-voorbeelden, notities of herhaalde
tekst blazen de uitvoer op, en de op referenties gebaseerde scores meten vervolgens dat effect.
De velden zijn `mean_length_ratio`, `inflated_entries` van `scored_entries`,
`ratio_bound` en `share_bound`.

**`length_deflation`**, gemeten door de harness. Het is de tegenhanger van
`length_inflation`: uitvoer die veel **korter** is dan de referentie, waardoor woorden
zijn weggelaten. Dit wordt toegevoegd wanneer de uitvoer gemiddeld minder dan 0.5× de referentielengte
bedraagt (de afkappingsgrens van
[`length_ratio`](/docs/network/specifications/scoring)), of wanneer ten minste een
kwart van de gescoorde items dat doet. Sommige diagnostieken beoordelen alleen de woorden die een
uitvoer bevat: FST-acceptatie en code-switching. Een systeem dat weglaat wat het
niet kan vertalen, verhoogt deze scores. Wanneer de run een van deze metrieken bevat, is de kanttekening
`major` en geeft aan deze niet als kwaliteit te interpreteren naast runs die alles
vertalen. Het chrF++-hoofdcijfer weegt recall mee, waardoor ontbrekende woorden worden meegeteld. Wanneer geen van
beide metrieken aanwezig is (alleen chrF++ en exacte overeenkomst), is het een `minor`-opmerking. De velden
zijn `mean_length_ratio`, `short_entries` van `scored_entries`, `ratio_bound`,
`share_bound` en `emitted_only_metrics`.

**`source_copy`**, gemeten door de harness. Dit wordt toegevoegd wanneer ten minste de helft van
de gescoorde uitvoer een kopie is van de bron (waarbij hoofd-/kleine letters, accenten en interpunctie
worden genegeerd). Regels waarvan de referentie identiek is aan de bron, zoals namen, worden buiten
beschouwing gelaten. Metrieken die niet met de referentie vergelijken, kunnen gekopieerde
woorden nog steeds positief waarderen. De velden zijn `copies` van `considered_entries`, `copy_share` en
`share_bound`.

**`near_constant_output`**, gemeten door de harness. Eén enkele uitvoer werd gegeven
voor veel *verschillende* invoeren. Uitvoer en bronnen worden vergeleken waarbij hoofd-/kleine letters,
interpunctie en spatiëring worden genegeerd; diakritische tekens tellen wel mee, omdat ze tussen twee
uitvoeren woorden van elkaar onderscheiden. Een uitvoer is een bronoverstijgende herhaling (cross-source repeat) wanneer ten
minste 3 afzonderlijke bronnen deze hebben gekregen (5 wanneer deze een of twee woorden lang is, aangezien
korte antwoorden legitiem vaker voorkomen). Een uitvoer die gelijk is aan de eigen referentie
is een correct antwoord en wordt niet meegeteld. De kanttekening wordt toegevoegd wanneer herhalingen
ten minste een kwart van de afzonderlijke bronnen beslaan, en ten minste 5 daarvan. Dit
is altijd `major`. Wanneer de run een metriek bevat die een uitvoer beoordeelt
zonder referentie (FST-acceptatie, code-switching), vermeldt het bericht deze:
een dergelijke metriek waardeert een geldige zin telkens wanneer deze voorkomt positief. De velden
zijn `repeated_sources` van `considered_sources`, `repeat_share`,
`repeated_outputs`, `top_output_sources` en `top_output_words` (de meest
herhaalde uitvoer: hoeveel bronnen deze kregen, en de lengte ervan), `share_bound`,
`min_repeats`, `min_sources`, `min_sources_short` en `emitted_only_metrics`.
Dit zijn uitsluitend tellingen: de kanttekening bevat nooit de tekst van een uitvoer.

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

Het veld bevindt zich in de opgeslagen run card-JSON, dus er is geen databasekolom
voor nodig. Het maakt geen deel uit van de [fingerprint](#fingerprint): het beschrijft het
resultaat, niet het experiment.

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

- [MT-evaluatie](/docs/network/leaderboard/rules) — overzicht, scorebordwaarde en richtlijnen voor goede/slechte methoden
- [Eval-harness](/docs/network/specifications/harness) — hoe u evaluaties uitvoert en run cards genereert
- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — datasetindeling, EDTeKLA, FLORES+
- [Een methode bouwen](/docs/network/specifications/methods) — de methode-interface en specificatie voor methodekaarten
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmarkscores
- [Benchmarkspecificatie](/docs/network/specifications/benchmark) — evaluatieprotocol, corpusindeling, run card-schema
- [Scoringspecificatie](/docs/network/specifications/scoring) — SSOT voor metrieken en hoe runs worden gescoord
