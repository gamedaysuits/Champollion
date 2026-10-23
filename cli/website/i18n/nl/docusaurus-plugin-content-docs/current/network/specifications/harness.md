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

> **Samenvatting.** Deze pagina behandelt de installatie, configuratie en het gebruik van de MT-evaluatieharness — het hulpmiddel dat vertaalmethoden benchmarkt aan de hand van gestandaardiseerde corpora en gescoorde run cards produceert. Voor canonieke definities van metrische gegevens, schema's en het evaluatieprotocol, zie de [Benchmark Specification](/docs/network/specifications/benchmark).

De harness voert vertaalexperimenten uit en produceert run cards. Hij verzorgt de opbouw van prompts, API-aanroepen, scoring en serialisatie van resultaten — u levert de dataset en het model.

## Installatie

**Vereisten:** Python 3.11+

```bash
python3 -m pip install mt-eval-harness
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
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Pad naar corpusbestand (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Parallele tekstbestanden (FLORES+-, WMT-indeling) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Exacte model-slug: het volledige OpenRouter-id of de exacte eigen naam van een directe provider. Geen aliassen en geen zwevende id's (`~vendor/…`, `…-latest`): een korte naam zoals `gemini-pro` wordt geweigerd, en de weigering vermeldt de te schrijven slug. Door komma's gescheiden voor runs met meerdere modellen. Bij `--method local-model` is dit het uit te voeren model — een Hugging Face-id of een modelmap — en is het vereist: die engine heeft geen standaardmodel. Bij een methode-plugin wordt het aan de plugin doorgegeven als `config.method_model`. Elke andere MT-engine vertaalt met zijn eigen model en de run meldt dat `-m` niet wordt gebruikt |
| `-d, --dataset` | — | `all` | Datasetfilter: `all`, segmentnaam of ID-bereik |
| `--ids` | — | — | Door komma's gescheiden item-ID's om te evalueren |
| `--source-lang` | — | `English` | Naam van de brontaal |
| `--target-lang` | — | — | Naam van de doeltaal, zoals vermeld in de prompt. Een hier opgegeven code (`sme`) wordt benoemd vanuit de bijbehorende taalkaart ("Noord-Samisch"), en de run-header vermeldt dit; een code die op geen enkele kaart staat (een `qaa` voor privégebruik) blijft een code, met een waarschuwing dat de prompt deze zal bevatten |
| `-p, --prompt` | — | `naive` | Promptversie (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Pad naar tekstbestand met coaching-prompt. Dit **vervangt** de ingebouwde prompt: het model ontvangt het bestand zoals geschreven (plus de regel `--target-script`), niet de ingebouwde instructie "Translate the given … text to …; output only the translation". De proefuitvoering en de run-header vermelden dit in één oordeel: ✓ wanneer het bestand de doeltaal noemt (en onder welke naam of code), ⚠ wanneer het noch de taal noch de code ervan noemt, of niet gecontroleerd wanneer er geen naam of code bekend is |
| `--glossary` | — | — | Evaluatiewoordenlijst (JSON) voor terminologienaleving; uitsluitend voor de score, wordt nooit naar het model verzonden |
| `--coaching` | — | — | Inline coaching-tekst (tekenreeks tussen aanhalingstekens) |
| `--method` | — | — | Pad naar methode-pluginmap (bevat `method.json` + Python-module), of een geregistreerde MT-engine (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Bij `--method local-model`: voer een OPUS-MT-paarmodel uit waarvan het id een ander paar noemt dan dat van het corpus (`opus-mt-en-fi` op een `eng>sme`-corpus, als baseline voor een verwante taal). Zonder dit geweigerd; de run-kaart legt dit vast |
| `--method-card` | — | — | Pad naar methodekaart-JSON voor leaderboard-metagegevens |
| `--skip-fst` | — | `false` | Scoreer zonder FST-acceptatie, zelfs wanneer de taal over een FST beschikt, en vermeld er verder niets over. De run-kaart markeert dit als niet berekend. Zonder deze vlag stopt een ontbrekende FST (de analyzer of de bijbehorende pyhfst-runtime) de run evenmin: deze gaat door, de run-kaart markeert FST-acceptatie en morfologie als niet berekend, en de melding vermeldt `mt-eval setup --lang <code>`. Na die installatie voegt `mt-eval test <run log>` de FST-score toe aan de voltooide run zonder opnieuw te vertalen. Er wordt niets automatisch gedownload |
| `--skip-eval-standard` | — | `false` | Scoreer zonder de evaluatiestandaardmetrieken van de taalkaart (een extern pakket). De run-kaart markeert deze als niet berekend. Zonder deze vlag worden de metrieken van een geïnstalleerd pakket berekend; een pakket dat niet is geïnstalleerd, is een optionele add-on — de run gaat door zonder de bijbehorende metrieken (gemarkeerd als niet berekend) en vermeldt de `python3 -m pip install` die de kaart declareert. Er wordt niets geïnstalleerd door een run |
| `--tools` | — | `false` | Modus voor het aanroepen van tools inschakelen |
| `--tools-list` | — | — | Door komma's gescheiden toolnamen |
| `--max-tool-rounds` | — | `8` | Maximaal aantal tool-aanroep-rondes per item |
| `--style-profile` | — | — | Pad naar een stijlprofiel-JSON. Schakelt metrieken voor schrijfstijlconsistentie in (diagnostiek — nooit onderdeel van de hoofdscore; zie [§ Metrieken voor schrijfstijl en register](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Items per API-aanroep |
| `-c, --concurrency` | — | `8` | Parallelle API-aanroepen |
| `--max-tokens` | — | `32768` | Maximaal aantal tokens per API-aanroep |
| `--temperature` | — | `0.0` | Sampling-temperatuur (0.0 = deterministisch) |
| `--no-cache` | — | `false` | Reactie-caching uitschakelen |
| `--cache-dir` | — | `eval/cache/harness` | Pad naar cachemap (zie [De vertaalcache](#the-translation-cache)) |
| `--metricx` | — | `false` | Bereken ook MetricX-24 (Google, Apache-2.0), een neurale foutscore (0–25) waarbij lager beter is, gerapporteerd naast de chrF++-hoofdscore en er nooit mee vermengd. Vereist de `metricx`-extra en de modelcode van Google (zie [Opt-in neurale metrieken](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Bij `--metricx`: een ander MetricX-checkpoint (een xl/xxl-versie of een `google/metricx-25-*`-versie) |
| `--fuse` | — | `false` | Bereken ook de comparator in FUSE-stijl, een ongetrainde herimplementatie van de AmericasNLP 2025 FUSE-benadering, gerapporteerd als een diagnostische comparator, nooit in de hoofdscore. Vereist de `fuse`-extra (zie [Opt-in neurale metrieken](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Uitvoermap voor run-kaarten en logboeken |
| `-n, --name` | — | — | Voor mensen leesbare run-naam |
| `--dry-run` | — | `false` | Valideer configuratie en corpus zonder API-aanroepen te doen. Het vermeldt het coachingbestand en de woordenlijst die de run zou gebruiken (of `none`), toont de prompt (de ingebouwde volledig; een coachingbestand aan de hand van de eerste regel en de sha256, en dat het de ingebouwde vervangt), geeft aan waar de vertaalcache zich bevindt en voert dezelfde eval-pack-controle uit als de echte run, waarbij dit wordt gerapporteerd op regels die beginnen met `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …` of `none needed for <language>`) zonder te mislukken. Een tweede regel geeft aan of de echte run zou stoppen: een ontbrekende FST stopt deze nooit, terwijl elk ander ontbrekend onderdeel dat wel doet. Onder `--json` bevat de samenvatting `coaching_file`, `prompt` (het type, de sha256 en de lengte; de tekst van de ingebouwde prompt), `glossary_file` en `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | BCP-47-taalcode |
| `--target-script` | — | — | Het ISO 15924-schrift waarin de vertalingen moeten zijn geschreven (`Latn`, `Cans`, …), vermeld op de taalkaart van het doel. De prompt van de harness vraagt hierom (ook toegevoegd aan de tekst van een coachingbestand), waardoor het deel uitmaakt van de sha256 van de prompt. Gebruik voor een taal die in meer dan één schrift wordt geschreven, zoals Plains Cree, het schrift waarin uw referenties zijn geschreven. Zonder dit telt de harness de letters van de referenties per schrift (een aggregatie: er wordt geen zin getoond, dus dit geldt ook voor een corpus dat alleen lokaal beschikbaar is) en vraagt om het schrift dat 90% of meer ervan bevat, wat wordt aangegeven in de run-header ("references are 100% Latn → prompting for Latn") en wordt vastgelegd in het run-logboek (`config.target_script_source`); referenties die gemengd zijn, krijgen geen schrift en een waarschuwing met de aandelen, en een referentie in het andere schrift scoort dan nagenoeg nul. Geweigerd voor een MT-engine of een methode-plugin, die geen prompt krijgen |

`--champollion-config` en `--prompt champollion` zijn in 0.2.0 uitgefaseerd en worden geweigerd met opgave van reden. Dat geldt ook voor `--champollion-cards-dir`; stel `MT_EVAL_CARDS_DIR` in om de harness naar een andere kaartenmap te laten verwijzen. Ze bouwden de prompt van de CLI opnieuw op in Python, en die kopie was gaan afwijken van de CLI. Gebruik een methode-plug-in (`--method`) om een CLI-methode te evalueren, en `mt-eval export-config` om een resultaat terug te brengen naar een CLI-project.

### Opt-in neurale metrieken

COMET wordt berekend wanneer `unbabel-comet` is geïnstalleerd (`mt-eval setup --comet`: ongeveer 300 MB om te installeren, en ongeveer 2,3 GB aan model bij eerste gebruik). Twee andere metrieken staan uit, tenzij een run erom vraagt, omdat ze elk een groot model laden. Net als COMET draaien ze op deze machine (geen API-kosten, er wordt nergens tekst naartoe gestuurd), worden ze gerapporteerd naast de chrF++-hoofdscore en er nooit mee vermengd, en vermeldt de run card "not run" met de mee te geven vlag wanneer er niet om is gevraagd.

| Metriek | Vlag | Vereisten | Wat het kost |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`, lager is beter, 0–25) | `--metricx` (checkpoint: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) en Google's modelcode, die niet op PyPI staat: `python3 -m pip install git+https://github.com/google-research/metricx` | Het standaard `google/metricx-24-hybrid-large-v2p6`-checkpoint en de mT5-XL-tokenizer downloaden bij het eerste gebruik enkele GB's van Hugging Face; scoring is traag op een CPU. Zonder referentie scoort het in de referentieloze (QE-)modus |
| Comparator in FUSE-stijl (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | LaBSE downloadt bij eerste gebruik ongeveer 1,8 GB. Zonder LaBSE wordt de score niet berekend en het rapport vermeldt dit. Het is ongetraind (een ongewogen gemiddelde van de onderdelen) en het resultaat wordt gemarkeerd als `fuse_untrained` |

Via MCP (het volledige profiel, `--profile full`) accepteert `run_benchmark` `metricx` (met `metricx_model`) en `fuse`, en vereist `comet: true` COMET; het bijbehorende plan vermeldt of elk daarvan is geïnstalleerd, en een bevestigde run die vraagt om een metriek die de harness niet kan berekenen, wordt geweigerd.

Wat elke metriek meet en in hoeverre deze voor een taal te vertrouwen is, vindt u in [Scoring](/docs/network/specifications/scoring) en [Betrouwbaarheid van metrieken](/docs/network/specifications/metric-reliability).

### De vertaalcache

Elke run bewaart de uitvoer van het model voor elke bronzin in een cache (`--cache-dir`, standaard `eval/cache/harness` onder de map waarin de run start), zodat een herhaalde run met dezelfde configuratie deze kosteloos hergebruikt. De cachesleutel omvat het model, de verzonden prompt (de sha256 ervan), de instellingen die de uitvoer wijzigen en de harness-versie, zodat bij een wijziging van een van deze elementen nooit een oude uitvoer wordt geleverd. De cache bevat kopieën van de zinnen van het corpus:

- de run-header en de dry-run tonen waar deze zich bevindt en hoeveel entries deze bevat;
- de map bevat een `.gitignore`, zodat git deze negeert;
- deze wordt nooit geschreven naar een map `mt-eval contest prepare` die als vrij te geven is gemarkeerd (de `public/` ervan): `mt-eval run` weigert een dergelijke `--cache-dir` of `--output-dir` en noemt in plaats daarvan de `runs/`-map van de wedstrijd ([Een soevereine wedstrijd organiseren](/docs/network/sovereignty/run-a-sovereign-contest));
- een uitsluitend lokaal, verzegeld of toestemming vereisend corpus krijgt een eigen `protected/<namespace>/`-map, gekoppeld aan de instellingen van de run, de sha256 van het corpus en de voorwaarden ervan, en elk bestand daar draagt het merkteken van het corpus in een `<file>.champollion.json`-sidecar ([Corpora registreren](/docs/network/sovereignty/registering-corpora));
- verwijder de map om de kopieën te wissen, of geef `--no-cache` op om er geen te bewaren.

De `run_benchmark` van de MCP-server (volledig profiel) vermeldt de cache in het bijbehorende plan en resultaat. Voor een bestand waarover u beschikt, plaatst het de cache naast de resultaten van de run (`<corpus folder>/results/cache/`), en voor een geregistreerd corpus-id in een eigen map (`~/.champollion-mcp/cache/harness/`). Een cache die door eerdere runs al in `eval/cache/harness` onder de werkmap van de server staat, blijft worden gebruikt, zodat er voor de uitvoer niet tweemaal wordt betaald. De items zijn niet afhankelijk van de locatie van de map, dus deze kan worden verplaatst.

### Elk subcommando

Alle twintig subopdrachten op het hoogste niveau. Elke vlag van elk daarvan staat in de
gegenereerde [`mt-eval`-opdrachtreferentie](/docs/reference/mt-eval); dit gedeelte
beschrijft waarvoor ze elk dienen.

**Uitvoeren en scoren**

| Subcommando | Wat het doet |
|---|---|
| `mt-eval run` | Voer een vertaalrun uit (bovenstaande vlaggen) |
| `mt-eval test <log>` | Analyseer een voltooid run-logboek. `-o <path>` schrijft het rapport naar een andere locatie dan `<log>_report.json`, en het run-logboek registreert dat pad zodat `card` en `compare` het kunnen vinden. `--glossary <file>` scoort terminologie aan de hand van die woordenlijst; het rapport registreert de naam en sha256 ervan, en de kaart, `compare` en het publicatievoorbeeld vermelden aan de hand van welke woordenlijst de terminologienaleving (diagnostisch) is gescoord |
| `mt-eval compare <reports…>` | Vergelijk twee of meer runs (`*_report.json` of run-logboeken). Eén rij per metriek (chrF++, BLEU, spBLEU, TER, …), één kolom per run aangeduid met letters A, B, C…, metrieken waarbij lager beter is zijn gemarkeerd; `--significance` voegt gepaarde tests toe voor elk paar, waarbij elke tabel wordt benoemd naar de letters van de runs, met het 95%-betrouwbaarheidsinterval op Δ, en vermeldt dat de p-waarden per metriek en ongecorrigeerd zijn; `--method paired_bootstrap` vervangt de standaard approximate randomization door de Koehn-bootstrap ([Significantie](/docs/network/specifications/significance)). Schrijft `comparison-<hash>.json` (de hash van de id's van de vergeleken runs, zodat een andere vergelijking dit nooit overschrijft) naast de rapporten wanneer ze een map delen, anders in `comparisons/` in hun dichtstbijzijnde gemeenschappelijke map (nooit in de eigen map van één run), tenzij `-o` een bestand specificeert. Alleen de chrF++-test bepaalt welke run beter is; de overige rijen worden getoond, maar niet gebruikt voor de beslissing. Het samengestelde resultaat van een verouderd rapport wordt als uitgefaseerd aangemerkt en niet vergeleken |
| `mt-eval dashboard <logs…>` | Genereer een interactief HTML-dashboard |
| `mt-eval card <run log>` | Druk een mensenleesbare run card netjes af. De scores zijn afkomstig uit het rapport van de run: naast het logboek, waar `mt-eval test -o` het heeft geregistreerd, of `--report <path>`. Een run waarvoor geen rapport is gevonden, toont NOT SCORED en waar is gezocht, nooit nullen. Er kan ook een rapportbestand worden meegegeven; dit wordt gelezen in combinatie met het geregistreerde run-logboek |

**Een methode aan het werk zetten** (er wordt niets gescoord)

| Subopdracht | Wat het doet |
|---|---|
| `mt-eval translate` | Vertaal uitsluitend broninvoer met een methode — de run-pijplijn waarbij niets wordt gescoord. Schrijft `.jsonl` of `.tsv` met de termen van de invoer als een set/1-sidecar; een methode waarvan de uitvoer alleen lokaal is, schrijft uitsluitend binnen het project, tenzij `--holders-agreed-by` vermeldt wie van de datahouders heeft ingestemd |
| `mt-eval serve` | Stel een methode beschikbaar die op deze machine draait (`lexicon`, `local-model` of een plugin van afhankelijkheidsklasse S of O) achter het champollion-`/translate`-contract, vanuit een deployment/1-bestand of vlaggen, met een optioneel gate-chain/1-bestand dat elk antwoord controleert. Bindt standaard aan 127.0.0.1; voor een andere host is `$MT_EVAL_SERVE_TOKEN` vereist |

**Vind uw weg naar een methode**

| Subcommando | Wat het doet |
|---|---|
| `mt-eval recommend <src> <tgt>` | Methodebegeleiding voor een talenpaar — beschikbaarheid plus **geciteerd bewijs**, geen kale rangschikking. Het paar kan ook worden opgegeven als `--source <src> --target <tgt>`, de notatie die `corpora` hanteert |
| `mt-eval corpora --source X --target Y` | Toon beschikbare eval-corpora voor een paar. Beide vlaggen werken afzonderlijk: `--target Y` toont elk corpus naar Y, `--source X` elk corpus vanuit X |
| `mt-eval corpora --with-fst` | Alleen de corpora waarvan de doeltaal een FST heeft die door de harness wordt vastgezet, zodat FST-acceptatie kan worden gescoord. Elk doel wordt weergegeven met de vermelding of de FST op deze machine is geïnstalleerd en hoe deze kan worden geïnstalleerd (`mt-eval setup --lang <code>` of een handmatige installatie voor sommige indelingen). Combineer dit met `--source`/`--target`, of gebruik het afzonderlijk voor elk paar. Er wordt niets gedownload |
| `mt-eval list models\|prompts\|datasets` | Toon beschikbare bronnen |

**Bijdragen**

| Subopdracht | Wat het doet |
|---|---|
| `mt-eval publish <report>` | Dien een TestReport in bij het leaderboard |
| `mt-eval queue` | Voer het bovenste item van de community-rekenwachtrij uit met uw eigen sleutel — zie [Rekenkracht bijdragen](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Verpak een TestReport als een champollion-methode-plugin (een method/1 `method.json`) |
| `mt-eval generate-plugin` | Alias voor `export` |
| `mt-eval export-config` | Genereer een `champollion.config.json`-fragment uit een TestReport |

**Wedstrijden, en er zelf een organiseren**

| Subopdracht | Wat het doet |
|---|---|
| `mt-eval contest` | Organiseer of neem deel aan een **soevereine competitie** — voor de organisator: `prepare`, `register`, `create`, `rank`, `close`, `export`; voor de deelnemer: `qualify` (score zelf de openbare dev-set voor het toelatingsbewijs; de kwalificatie-eis is chrF++ op een schaal van 0–100), `validate` (oefen de controles van de node offline), `submit-model` / `submit-method` (overhandig een model of een methode), `status`, `list`. Deelname aan een competitie gebeurt door de node van de organisator iets te geven dat deze kan UITVOEREN; het uploaden van vertalingen en het koppelen van een zelf gerapporteerde kaart zijn op 2026-09-06 beëindigd als deelnamemethoden |
| `mt-eval shared-task` | Paraplu voor shared-task-edities met meerdere paren: één rij groepeert de N competities per paar van een shared-task-editie met meerdere paren en bevat de bijbehorende beleidsstandaarden. **Alleen groepering en standaarden — elke poort blijft per competitie** |
| `mt-eval node` | **De score-node van de organisator.** Poll de intake, controleer op de openbare kwalificatie-eis, autoriseer volgens het competitiebeleid, scoreer tegen **geheime referenties in beheer van de organisator**, publiceer uitsluitend scores. Dit is de opdracht achter [Een soevereine competitie organiseren](/docs/network/sovereignty/run-a-sovereign-contest) en de [Soevereine evaluatie-node](/docs/network/sovereignty/sovereign-eval-node) — het corpus verlaat nooit de machine van de organisator |

`mt-eval node` heeft achttien eigen subcommando's, waaronder het airgap-traject
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) en de
M-van-N-beheerceremonie (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Voer `mt-eval node --help` uit; de soevereiniteitsmechanismen
worden beschreven op de twee hierboven gelinkte pagina's.

**Setup**

| Subcommando | Wat het doet |
|---|---|
| `mt-eval setup` | Installeer optionele afhankelijkheden (COMET neurale metriek, FST-runtime) |
| `mt-eval logout` | Verwijder opgeslagen inloggegevens |

### Voorbeelden

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

De harness voert nooit nieuwe pogingen uit voor vertalingen die door de FST worden afgewezen en filtert deze evenmin: FST-acceptatie is een metriek die wordt gescoord wanneer het eval-pack van de taal over een FST beschikt. Een methode die door FST aangestuurde nieuwe pogingen wenst, voert deze uit binnen de eigen plugin, zoals de handleiding `fst-gated-pipeline` laat zien. (`--fst-retries` en `--hooks` zijn nooit gekoppeld aan functionaliteit op de opdrachtregel; beide worden met die reden geweigerd.)

---

## Run Card-schema

Elk experiment produceert een **run card** — een op zichzelf staand JSON-document. De structuur op het hoogste niveau:

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

Zie de [Run Card Specification](/docs/network/specifications/run-card) voor het volledige schema met elk veld gedocumenteerd.

:::info[Gezaghebbend schema]
De [Benchmark-specificatie](/docs/network/specifications/benchmark) is de single source of truth voor het run card-schema. Zie de [Scoring-specificatie](/docs/network/specifications/scoring) voor metriekdefinities en de manier waarop runs worden gescoord. Deze pagina beschrijft het gebruik van de harness; de specificaties bepalen wat de uitvoer betekent.
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
Deze metrieken zijn **diagnostisch** — ze maken nooit deel uit van de hoofdscore, en de formaliteitsdetectie is gebaseerd op markers (een heuristiek), niet op een getraind oordeel. Beschouw ze als een drift-detector voor registertrouw, niet als een oordeel over stijlkwaliteit.
:::

---

## Vingerafdruk versus run card-hash {#fingerprint-vs-run-card-hash}

De harness produceert twee afzonderlijke hashes. Ze dienen verschillende doeleinden:

### Vingerafdruk

De **vingerafdruk** beantwoordt de vraag: *"Kan deze run worden gereproduceerd?"*

Hij hasht de combinatie van invoergegevens die de experimentconfiguratie definiëren — niet de uitvoer:

- Dataset-SHA-256
- Model-slug
- Conditielabel
- Systeemprompt-SHA-256
- Temperatuur
- Batchgrootte
- Tools ingeschakeld
- Harness-versie

In totaal acht componenten: batchgrootte en tool-calling veranderen de uitvoer
wezenlijk, dus ze maken deel uit van de identiteit van het experiment — twee runs met
verschillende batchgroottes delen **geen** vingerafdruk. Zie
[Benchmark-specificatie §3.8](/docs/network/specifications/benchmark#38-fingerprint).

Twee runs met identieke vingerafdrukken hebben dezelfde configuratie gebruikt. Hun resultaten zouden vergelijkbaar moeten zijn (met uitzondering van API-niet-determinisme).

### Run card-hash

De **run card-hash** beantwoordt de vraag: *"Is dit specifieke resultaatbestand gemanipuleerd?"*

Het is de SHA-256 van de volledige run card JSON (exclusief het veld `run_card_hash` zelf). Als een veld wijzigt — een score, een tijdstempel, een enkele uitvoer — wordt de hash ongeldig.

:::info[Wanneer welke te gebruiken]
Gebruik de **fingerprint** om vergelijkbare runs te groeperen (hetzelfde experiment, verschillende uitvoeringen). Gebruik de **run card hash** om de integriteit van een specifiek resultaatbestand te verifiëren.
:::

---

## Publiceren naar het leaderboard

Gebruik na voltooiing van een run `mt-eval publish` op het `<run-id>_report.json` van de run. Voor het wegschrijven naar het live leaderboard is een expliciete `--prod` (of `MT_EVAL_ALLOW_PROD=1`) vereist; `mt-eval run --publish --prod` voert beide stappen tegelijk uit:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
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

- [MT-evaluatie](/docs/network/leaderboard/rules) — overzicht, de waardepropositie van het leaderboard en richtlijnen voor goede/slechte methoden
- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — datasetindeling, EDTeKLA, FLORES+
- [Run Card-specificatie](/docs/network/specifications/run-card) — het volledige JSON-schema
- [Een methode bouwen](/docs/network/specifications/methods) — de methode-interface voor het creëren van evalueerbare methoden
- [Method Leaderboard](https://champollion.dev/leaderboard) — actuele benchmarkscores
- [Benchmark-specificatie](/docs/network/specifications/benchmark) — evaluatieprotocol, corpusindeling, run card-schema
- [Scoring-specificatie](/docs/network/specifications/scoring) — SSOT voor metrieken en hoe runs worden gescoord
