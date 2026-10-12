---
title: "MCP Server — de toegang voor de agent"
sidebar_label: "MCP Server"
description: "Verbind een AI-agent met Champollion via het Model Context Protocol: 34 tools voor het opzoeken van talen, het doorbladeren van de benchmarkwachtrij en het corpusregister, het uitvoeren van evaluaties, het trainen en exporteren van modellen en vertalen — plus welke precies meer vereisen dan een npx install."
---

# MCP Server — de deur voor agenten

`champollion-mcp-server` stelt Champollion beschikbaar aan AI-agents via het [Model
Context Protocol](https://modelcontextprotocol.io). Als u een agent bent, of er
een configureert, is dit de toegangspoort: **34 tools, 3 resources en 4 prompts**
via stdio.

Alles hier is ook bereikbaar als gewone HTTP — zie [Machineleesbare eindpunten](#machine-readable-endpoints) — maar de MCP-server is het enige oppervlak dat een agent in staat stelt om te *handelen* (vertalen, een benchmark uitvoeren, een model trainen) in plaats van alleen te lezen.

## Installatie

```bash
npx -y champollion-mcp-server
```

Registreer het vervolgens bij uw client. Voor Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Voor clients die via een bestand worden geconfigureerd (Claude Desktop, Cursor, Antigravity), voegt u het volgende toe:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## Lees dit voordat u erop vertrouwt

**Veertien van de 34 tools werken vanuit een kale `npx`-installatie, en `translate` werkt
zodra het over een engine beschikt. De overige negentien vereisen Python-pakketten die het npm-pakket
niet meelevert en ook niet kan meeleveren.** Ze falen niet geruisloos — elk retourneert een
bruikbare foutmelding met vermelding van wat er ontbreekt — maar u dient de opzet te kennen voordat
u er plannen omheen maakt.

| Tools | Werken na `npx`? | Wat ze verder nodig hebben |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Ja** — alleen-lezen, geleverd vanaf openbare eindpunten | niets |
| `translate` | **Ja**, met een engine | een API-sleutel voor de engine die u kiest — of geen, met methode `local` en een modelserver op uw eigen machine |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Nee | het evaluatieharnas — `pipx install mt-eval-harness` |
| de vijftien `forge_*`-tools | Nee | NMT Forge 0.2.0 of nieuwer — `python3 -m pip install nmt-forge` (voeg `'nmt-forge[hf]'` toe om te trainen en te serveren). Het brengt het evaluatieharnas mee en vindt taalkaarten zelfstandig; er is geen clone nodig |

Voor niets hiervan is een clone van de repository nodig.

## Wat de tools doen

**Bladeren en de kosten van het werk berekenen.** `list_queue` en `get_queue_item` doorlopen de open benchmark-wachtrij — de gerangschikte lijst van metingen die de kaart het meest zouden verbeteren. `estimate_cost` berekent de prijs van een reeks runs voordat u iets uitgeeft.

**Dingen opzoeken.** `search_languages` doorzoekt de taalkaarten op naam,
code, taalfamilie of regio, en tolereert spelfouten. Elk resultaat vermeldt ook waar
de taal wordt gesproken (landen, een punt op de kaart, macrogebied) en de alternatieve
namen — uitsluitend de feiten waarvoor de kaart een bron citeert, telkens voorzien van die bron, zodat
talen met vergelijkbare namen uit elkaar kunnen worden gehouden. Een locatie zonder bron wordt
nooit getoond; de regel geeft dit aan en linkt in plaats daarvan naar het Glottolog-record van de taal.
Kaarten die zijn aangevuld vanuit de gepubliceerde kaarttabellen van champollion.dev (bij een
npm-installatie elke taal buiten de meegeleverde kernset) bevatten nog geen bronnen
per veld — deze volgen bij de volgende upload van de tabellen — dus bevatten die
regels de Glottolog-link in plaats van een locatie. `language_overview` is het
startpunt van één pagina voor het ontwikkelen voor een taal: wat er bestaat, wat er kan
draaien en de vervolgstappen. `get_language` retourneert de volledige geciteerde kaart.
`list_corpora` toont de geregistreerde evaluatiecorpora
voor een taalpaar of benchmarkfamilie — uitsluitend metadata (omvang,
licentie, contaminatiegraad, en of het harnas het kan ophalen, een
toegangstoken vereist of het in quarantaine houdt); corpusinhoud wordt nooit geretourneerd,
en bij een taalpaar waarvan alle corpora in quarantaine zijn geplaatst, wordt dit vermeld in plaats van
dat het niet-ondersteund lijkt. `get_results` en `get_run_card` lezen beoordeelde runs van
het openbare leaderboard. `get_metric_reliability` beantwoordt de vraag die de meeste
agents fout beantwoorden — *welke metriek moet ik vertrouwen voor deze doeltaal* —
op basis van correlaties met menselijke beoordelingen per taalfamilie. `list_contests`
en `get_contest` tonen wedstrijden en hun gedeclareerde voorwaarden; deelnemen aan een wedstrijd is een
door mensen geautoriseerde CLI-stap, nooit een tool.

**Handelen.** `translate` voert tekst door de geteste pipeline, met Translation
Memory (herhalingen kosten niets) en een deterministische kwaliteitscontrole. Elk antwoord
vermeldt de engine die daadwerkelijk heeft gedraaid, inclusief het model en eindpunt voor zover aanwezig.
`run_benchmark` start een evaluatie en retourneert **onmiddellijk een job-id**,
omdat echte runs langer duren dan welke client-time-out dan ook; u pollt `get_run_status` met
die id. Een job overleeft een herstart van de server: de run gaat door en
het naderhand pollen van dezelfde id retourneert nog steeds de status en resultaten. Er wordt niets
gepubliceerd tenzij u `publish: true` meegeeft; het plan geeft vervolgens aan wat er openbaar
zou worden — elke rij met de bijbehorende zinstekst, of alleen scores; de prompt, of alleen
de hash ervan; en waar — en een daadwerkelijke publicatie vereist `publish_ack` met de exacte
bewoordingen die het plan aangeeft, zodat de gebruiker deze eerst heeft gezien. Een run die zonder is uitgevoerd,
kan later worden gepubliceerd, achter dezelfde controle. `preview_publish` is alleen-lezen:
het toont het eigen publicatievoorbeeld van het harnas, de exacte bewoordingen en de exacte
`publish_report`-aanroep die het zou publiceren, en kan zelf niet publiceren. Het
bevat de MCP-annotatie `readOnlyHint: true`, zodat een agent-host die voorafgaand
aan elke schrijfactie om bevestiging vraagt, dit zelfstandig kan toestaan. `publish_report` voert de schrijfactie uit
(geannoteerd met `destructiveHint` en `openWorldHint`), en `scores_only`
laat de zinstekst achterwege. Elk plan opent tevens met de
`EVAL PACK:`-status van de doeltaal — `missing` (met de opdracht die
deze installeert), `ready` of `none needed` — en noemt de corpuslicentie en de bijbehorende
`do_not_train`-voorwaarde, omdat de run `--yes` doorgeeft. Een ontbrekende FST (de
analyzer of diens pyhfst-runtime) onderbreekt de run nooit: deze gaat door en de runkaart
markeert FST-acceptatie als niet berekend. Elk ander ontbrekend onderdeel stopt de run
voordat er vertaald wordt. `skip_fst` en `skip_eval_standard` scoren zonder die
onderdelen, en de runkaart markeert wat er is weggelaten. Het plan geeft ook aan of
COMET berekend zal worden (het harnas berekent dit wanneer `unbabel-comet` is
geïnstalleerd; `comet: true` maakt dit vereist voor de run), en `metricx` en `fuse`
vragen om de opt-in MetricX-24 en FUSE-achtige comparator van het harnas. Voor elk
onderdeel vermeldt het plan, op basis van het harnas, of het is geïnstalleerd, wat er geïnstalleerd moet worden
en wat er gedownload wordt. Een bevestigde run die vraagt om een metriek die het harnas
niet kan berekenen, wordt geweigerd in plaats van uitgevoerd zonder die metriek. De regels `Results:`
en `Cache:` van het plan geven aan waar het runlogboek, het rapport en de vertaalcache terechtkomen.
Een testbestand in een map die door `mt-eval contest prepare` als vrij te geven is gemarkeerd
(de `public/` van een wedstrijd) wordt in plaats daarvan weggeschreven naar de map `runs/` van de wedstrijd, zodat
niets van wat een run schrijft daarmee wordt vrijgegeven. Een model op uw eigen
machine (een lokale server, of `method: "local-model"`, die het harnas in-process
uitvoert en geen attestatie vereist) wordt gerapporteerd als `$0 API cost (runs on
this machine)`.

**Trainen zonder uzelf voor de gek te houden.** `get_training_guardrails` retourneert de regels
die zijn afgeleid uit echte gemeten mislukkingen. De vijftien `forge_*`-tools voeren
[NMT Forge](/docs/network/getting-started/training-honestly) stap voor bewaakte stap
uit — `forge_status` eerst en na elke stap (het vermeldt de volgende
opdracht en de tool die deze uitvoert), `forge_preflight` om te zien welke controles een
opdracht zal tegenkomen voordat deze weigert, `forge_prereg_template` en `forge_prereg`
om voorspellingen vast te leggen voordat er enige testscore bestaat (en vóór enige
benchmark op de testset: een scorende leesactie blokkeert een latere preregistratie),
`forge_export` om de testset eenmalig te scoren en het getrainde model te verpakken,
`forge_compare` om twee modellen A/B te testen met het voorbehoud voor bijna-duplicaten van elk model naast
de winnaar, en
`forge_prereg_verdict` om het eigen oordeel van de gebruiker vast te leggen over een voorspelling die forge
niet kan beoordelen (een vrije-tekstbereik) — weergegeven als een menselijk oordeel, nooit als een
berekend oordeel. `forge_status` somt elke getrainde run op met de dev-score en
geeft aan wanneer een dev-set verzadigd is (een perfecte dev-score waarbij er voor
checkpointselectie niets te kiezen valt). Wanneer het evaluatieharnas een voorbehoud
plaatst bij een testscore (bijvoorbeeld een nagenoeg constante uitvoer: een handvol uitvoeren
voor elke bronzin), nemen `forge_export`, `forge_status`,
`forge_compare` en `forge_lint` dit over in de eigen bewoordingen van het harnas, en een
belangrijk voorbehoud staat voorop in de volgende stap: de score wordt er nooit zonder
geciteerd. Een weigering wordt geretourneerd
met wat er misging, waarom het van belang is en de oplossing. Twee stappen duren langer dan welke tool-aanroep
dan ook en worden in plaats daarvan in een terminal uitgevoerd: training (`nmt-forge run`) en het serveren van het
geëxporteerde model (`nmt-forge serve`, waarmee het achter een lokaal eindpunt wordt geplaatst dat
`translate` en de CLI kunnen gebruiken).

### Argumenten

`name` is vereist en `name?` is optioneel. Elke tool die één
taal accepteert, accepteert deze ook als `language`: "`code` of `language`" betekent dat beide
namen werken en dat u er één opgeeft. De oorspronkelijke namen blijven werken.

| Tool | Argumenten |
|---|---|
| `search_languages` | `query` of `language`, `limit?` |
| `language_overview` | `code` of `language`, `source?` |
| `get_language` | `code` of `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (ten minste een van deze drie), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` of `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | geen |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` of `priority?` (een van beide) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (een gettext msgctxt: één voor elke tekst, of één per tekst), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | één modus: `budget?` of `top?` (wachtrij), `item_id?`, of `corpus?` met `model?` (met `method_dir`, het model dat de plugin laadt), `method?` of `method_dir?` (een map voor method-plugins; `local-model` vereist `model` — het heeft geen standaardwaarde), `allow_model_pair_mismatch?` (`local-model`: voer een OPUS-MT-paarmodel uit dat een ander paar noemt, als baseline voor een verwante taal), `attest_local_transport?` (een MT-engine of een plugin; nooit nodig voor `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (LLM-runs: het ISO 15924-schrift waarin de uitvoer geschreven moet worden, zoals `Cans` of `Latn`; het plan geeft aan wanneer de kaart van de doeltaal er meer dan één vermeldt), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` en `skip_eval_standard?` (item- en corpus-runs: scoor zonder de FST of de standaard evaluatiemetrieken, gemarkeerd als niet berekend), `comet?` (COMET vereisen: de run wordt geweigerd zolang dit niet geïnstalleerd is), `metricx?` met `metricx_model?`, en `fuse?` (item- en corpus-runs: de opt-in MetricX-24 en FUSE-achtige comparator van het harnas, geweigerd zolang niet geïnstalleerd); vervolgens `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (bij een daadwerkelijke publicatie: de exacte bewoordingen die het plan afdrukt), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (de `*_report.json` van een voltooide run), `scores_only?`, `redact_coaching?`, `anonymous?` (alleen-lezen: geen `confirm`, kan niet publiceren) |
| `publish_report` | `report` (de `*_report.json` van een voltooide run), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (de exacte bewoordingen die het voorbeeld afdrukt) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (de te controleren opdracht), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` of `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` of `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (standaard `data/split`, het pad dat de config.json van `forge_init` leest), `dev?`, `register?` (een naamvoorvoegsel, of `true` voor `project`), `allow_rotate?`, `near_dupe?` (een Jaccard-drempelwaarde zoals 0.6, wanneer forge de uitsplitsing van bijna-duplicaten aanbeveelt), `max_group?` (met `near_dupe`: de grootste groep bijna-duplicaten), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (met een eigen `clean_to`, bijv. `corpus.notwins.jsonl` — nooit het bestand met alle data), `companion_config?` (met `drop_test_twins`: waar de configuratie van het duplicaatvrije model terechtkomt; standaard `config-notwins.json`), `overwrite?` (vervang een `clean_to`-bestand dat door een configuratie, run, split of andere audit wordt gebruikt — zonder dit geweigerd), `full_indices?` (elke lijst met rijnummers volledig; standaard worden lange lijsten geretourneerd als `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (vastzetten op één run), `allow_after_reads?` (alleen voor voorspellingen die zijn weggeschreven vóór de scorende leesacties van de set), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (het nummer ervan, of de eigen id), `verdict` (`held` of `missed`), `by` (wie heeft beoordeeld), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (het runmanifest van elk model: de trainingsdata ervan wordt gecontroleerd op bijna-duplicaten), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Bijvoorbeeld, `get_metric_reliability { "language": "crk" }` en
`get_metric_reliability { "target": "crk" }` stellen dezelfde vraag.

### Vertalen met een model dat u hebt geïmplementeerd

`nmt-forge serve` print twee adressen voor het model dat het serveert. Wijs
`translate` naar een van beide:

| Argument | Gebruik het met | Voorbeeld |
|---|---|---|
| `base_url` | `method: "local"` — een OpenAI-compatibele server (ook `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — het Champollion-API-contract | `http://127.0.0.1:8378/translate` |
| `model` | Uitsluitend LLM-engines; geweigerd voor machinevertalings-API's, aangezien die er geen hebben | `llama3.1` |
| `project_dir` | elke methode — gebruik het Translation Memory van dat project | `~/my-app` |

Een server op uw eigen machine vereist geen sleutel. Een extern `api`-eindpunt leest zijn
sleutel uit `CHAMPOLLION_API_KEY` in de serveromgeving. De tool weigert
een argument dat het niet herkent, met naam en toenaam, in plaats van het te negeren, zodat een verkeerd gespeld
argument niet stilletjes uw tekst naar een ander model kan sturen.

### Waar de server zijn status bewaart

Alles bevindt zich in `~/.champollion-mcp/` (stel `CHAMPOLLION_MCP_HOME` in om het te
verplaatsen):

- **Het Translation Memory van `translate`** is een eigen bestand,
  `.champollion/tm.json` in die map. Het staat los van de `.champollion/tm.json`
  van welk project dan ook. Geef `project_dir` op om in plaats daarvan het bestand van een project te gebruiken,
  het bestand dat `champollion sync` daar gebruikt.
- **`run_benchmark`-jobs** worden vastgelegd in `jobs.json`, waarin de
  nieuwste 50 worden bewaard. Elke job heeft een map in `jobs/` met zijn uitvoer en, voor een
  wachtrij-item of een geregistreerd corpus, de resultaten van het harnas. Een run op een testbestand
  in uw beheer schrijft de resultaten en cache naast dat bestand, in
  `results/` — behalve een bestand in een map die door `mt-eval contest prepare`
  als vrij te geven is gemarkeerd, waarvan de run naar de map `runs/` van de wedstrijd schrijft.
  Wachtrij-runs schrijven hun rapporten naar `eval/logs/harness/queue/` onder de
  werkmap van de server, zoals het harnas altijd doet.

:::note[Uitgaven zijn by design begrensd]
`run_benchmark` **weigert een onbegrensde wachtrij-run.** U moet precies één limiet doorgeven — `budget`, `top`, of een specifieke `item_id`. Er is geen "voer gewoon de wachtrij uit"-aanroep, omdat een agent die de wachtrij verkeerd begrijpt anders onbeperkt zou kunnen uitgeven.
:::

## Protocolversie

Transport is **alleen stdio** — één serverproces per agent.

De [2026-07-28 revisie](https://blog.modelcontextprotocol.io/posts/2026-07-28/) van MCP maakte het protocol standaard stateless, waardoor de `initialize` handshake en de `Mcp-Session-Id` header zijn afgeschaft. Deze server is qua ontwerp niet beïnvloed: hij gebruikt geen van de verouderde mogelijkheden (Roots, Sampling, Logging), heeft nooit het verouderde HTTP+SSE-transport gebruikt en volgt al de nieuwe richtlijnen voor cross-call state — `run_benchmark` genereert een expliciete job-handle die het model teruggeeft, in plaats van te leunen op een transportsessie.

Het is **niet** geüpgraded naar de nieuwe revisie, omdat nog geen enkele gepubliceerde TypeScript SDK deze spreekt. Zie de [server README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) voor het volledige standpunt.

## Machineleesbare eindpunten

Hiervoor is geen MCP-client nodig:

| Eindpunt | Wat het is |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | De [voordeur voor agenten](/for-agents), als ruwe markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | De gecureerde index van deze site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Elke geïndexeerde pagina, inline |
| [`/queue.json`](https://champollion.dev/queue.json) | De volledige benchmark-wachtrij |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Top wachtrij-items |
| [`/registry.json`](https://champollion.dev/registry.json) | Het corpusregister |
| [`/mesh.json`](https://champollion.dev/mesh.json) | De gemeten taalgrafiek |

## Volgende

- [Agent Guide — bouwen & benchmarken](/docs/network/getting-started/agent-guide)
- [Agent Guide — vertalen met de CLI](/docs/guides/agent-guide)
- [Een methode indienen](/docs/network/getting-started/submit-a-method)
