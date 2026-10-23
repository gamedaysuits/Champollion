---
title: "MCP Server — de toegang voor agents"
sidebar_label: "MCP Server"
description: "Verbind een AI-agent met Champollion via het Model Context Protocol. Twee profielen: het rails-profiel (de standaard) doorloopt één taalproject met zes tools; --profile full biedt 34 tools voor het opzoeken van talen, het bekijken van de benchmarkwachtrij en het corpusregister, het uitvoeren van evaluaties, het trainen en exporteren van modellen en vertalen — plus precies welke er meer vereisen dan een npx install."
---

# MCP-server — de toegangspoort voor agents

`champollion-mcp-server` ontsluit Champollion voor AI-agents via het [Model
Context Protocol](https://modelcontextprotocol.io), via stdio. Het bevat twee
profielen:

| Profiel | Starten met | Wat het levert | Gebouwd voor |
|---|---|---|---|
| **rails** (standaard) | `npx -y champollion-mcp-server` | zes tools: `start_project`, `project_status`, `run_next_step`, `add_data`, `try_translation`, `explain` | het stap voor stap begeleiden van één taalproject van een lege map naar een geëvalueerd model op de eigen computer van de gebruiker |
| **full** | `npx -y champollion-mcp-server --profile full` (of `CHAMPOLLION_MCP_PROFILE=full`) | 34 tools, 3 resources en 4 prompts | verkenning, benchmarking, stap voor stap trainen, vertalen en het netwerk |

Als u iemand helpt bij het bouwen van een vertaler voor diens taal, gebruik dan het
rails-profiel; hoe u dit aanstuurt leest u in [Aansturing via rails via
MCP](/docs/agents/mcp), en de regels waaronder u werkt staan in [het operationeel
contract](/docs/agents/contract).

Alles hier is ook bereikbaar via standaard HTTP — zie [Machineleesbare
eindpunten](#machine-readable-endpoints) — maar de MCP-server is de enige interface
waarmee een agent kan *handelen* (vertalen, een benchmark uitvoeren, een model trainen) in plaats van
alleen lezen.

## Installatie

```bash
npx -y champollion-mcp-server
```

Registreer het vervolgens bij uw client. Voor Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Voeg voor clients die via een bestand worden geconfigureerd (Claude Desktop, Cursor, Antigravity) het volgende toe:

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

Voeg voor het full-profiel `"--profile", "full"` toe achter de pakketnaam in
`args`, of sluit de opdracht `claude mcp add` af met `--profile full`.

## Het rails-profiel (standaard)

De zes tools begeleiden één taalproject van een lege map naar een geëvalueerd
model op de eigen computer van de gebruiker. Elke stap geeft precies aan welke tool moet worden aangeroepen,
en elke vraag die alleen de persoon kan beantwoorden (wie een bestand bezit, of een
model ervan mag leren, of de tekst de computer mag verlaten, wat men
verwacht, of het resultaat goed genoeg is) wordt aan diegene voorgelegd. De tools
rapporteren aantallen en kolommen, nooit zinnen. Elke tool stuurt de `champollion`
commandoregel aan als een afzonderlijk, begrensd proces — dezelfde opdrachten die een persoon
typt. Dit profiel is gebouwd voor kleine agents, met korte instructies.

| Tool | Argumenten | Wat het doet |
|---|---|---|
| `start_project` | `folder`, `from`, `to`, `target_name?`, `source_name?`, `purpose?`, `parent_dir?`, `confirmed?` | Maakt een project aan (`champollion new`). De eerste aanroep maakt niets aan en retourneert `ask_first`: herhaal de vertaalrichting naar de persoon en voer vervolgens de aanroep uit die wordt gegeven voor diens antwoord |
| `project_status` | `project_dir`, `wait_seconds?` (maximaal 120) | De volgende stap, gelezen uit de bestanden (`champollion next --json`): de modus, wat er gezegd moet worden, waarom, en de exacte aanroep die hiervoor nodig is |
| `run_next_step` | `project_dir`, `step_id`, `answers?`, `confirmed?` | Voert de stap uit die zojuist door `project_status` is genoemd. Een `confirm`-stap vereist `confirmed: true` nadat de persoon ja heeft gezegd; een `ask_user`-stap heeft de eigen antwoorden van de persoon nodig; `human_only`- en `wait`-stappen worden geweigerd met instructies wat in plaats daarvan te doen |
| `add_data` | `project_dir`, `path`, `into?` (`parallel`, `test` of `lexicon`), `source_col?`, `target_col?`, `sheet?`, `header?`, `usfm_source?`, `replace?` | Importeert een bestand waar het zich bevindt — een spreadsheet, een Word-tabel, een Toolbox- of LIFT-woordenboek, een ELAN-bestand of USFM-schriftteksten (`champollion data add`) — en rapporteert aantallen en kolommen, nooit zinnen |
| `try_translation` | `project_dir`, `text` (maximaal 10 regels) | Vertaalt een paar zinnen van de persoon met het model dat door het project wordt geserveerd. Voor een model dat heeft geleerd van uitsluitend lokale zinnen retourneert het het adres van de eigen pagina van het model, nooit de tekst |
| `explain` | `topic`: `rails`, `privacy`, `quality`, `modes`, `improve` of `off_rails` | Eenvoudige uitleg in duidelijke bewoordingen om door te geven |

## Het full-profiel

Alles hieronder beschrijft het **full-profiel** — alle tools, voor verkenning,
benchmarking en het netwerk:

```bash
npx -y champollion-mcp-server --profile full
```

## Lees dit voordat u hierop vertrouwt

**In het full-profiel werken veertien van de 34 tools direct vanuit een kale `npx`-installatie, en `translate` werkt
zodra er een engine aanwezig is. De overige negentien vereisen Python-pakketten die het npm-pakket
niet meelevert en ook niet kan meeleveren.** Ze falen niet geruisloos — elk retourneert een
bruikbare foutmelding waarin staat wat er ontbreekt — maar u dient op de hoogte te zijn van deze structuur voordat
u er plannen omheen bouwt.

| Tools | Werken na `npx`? | Wat er verder nodig is |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Ja** — alleen-lezen, geleverd via openbare eindpunten | niets |
| `translate` | **Ja**, met een engine | een API-sleutel voor de gekozen engine — of geen, bij methode `local` en een modelserver op uw eigen machine |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Nee | het evaluatieharnas — `pipx install mt-eval-harness` |
| de vijftien `forge_*`-tools | Nee | NMT Forge 0.2.0 of nieuwer — `python3 -m pip install nmt-forge` (voeg `'nmt-forge[hf]'` toe om te trainen en te serveren). Dit brengt het evaluatieharnas mee en vindt taalkaarten zelfstandig; klonen is niet nodig |

Er is voor niets hiervan een kloon van de repository nodig.

## Wat de tools doen

**Het werk verkennen en begroten.** `list_queue` en `get_queue_item` doorlopen de openstaande
benchmarkwachtrij — de gerangschikte lijst met metingen die de
kaart het meest zouden verbeteren. `estimate_cost` berekent de kosten van een reeks runs voordat u iets uitgeeft.

**Gegevens opzoeken.** `search_languages` zoekt in de taalkaarten op naam,
code, taalfamilie of regio, en tolereert spelfouten. Elk resultaat vermeldt ook waar
de taal wordt gesproken (landen, een kaartpunt, macroregio) en andere
namen — uitsluitend feiten waarvoor de kaart een bron vermeldt, telkens met die bron, zodat
talen met vergelijkbare namen kunnen worden onderscheiden. Een locatie zonder bron wordt
nooit getoond; de regel vermeldt dit en linkt in plaats daarvan naar het Glottolog-record
van de taal. Kaarten die zijn ingevuld vanuit de gepubliceerde kaarttabellen van champollion.dev (in een
npm-installatie elke taal buiten de meegeleverde kernset) bevatten nog geen
bronnen per veld — deze worden toegevoegd bij de volgende upload van de tabellen — dus die
regels bevatten de Glottolog-link in plaats van een locatie. `language_overview` is het
startpunt van één pagina voor het bouwen voor een taal: wat er bestaat, wat er kan
draaien en de volgende stappen. `get_language` retourneert de volledige geciteerde kaart.
`list_corpora` geeft een overzicht van de geregistreerde evaluatiecorpora
voor een taalpaar of benchmarkfamilie — uitsluitend metadata (omvang,
licentie, contaminatiegraad, en of het harnas dit kan ophalen, een
toegangstoken nodig heeft of dit in quarantaine houdt); corpusinhoud wordt nooit geretourneerd,
en een taalpaar waarvan alle corpora in quarantaine zijn geplaatst, geeft dit aan in plaats van
niet-ondersteund te lijken. `get_results` en `get_run_card` lezen beoordeelde runs uit
van het openbare scorebord. `get_metric_reliability` beantwoordt de vraag die de meeste
agents fout beantwoorden — *welke metriek moet ik vertrouwen voor deze doeltaal* —
op basis van correlaties met menselijke beoordelingen per taalfamilie. `list_contests`
en `get_contest` tonen competities en hun vastgelegde voorwaarden; deelname hieraan is een
door mensen geautoriseerde CLI-stap, nooit een tool.

**Handelen.** `translate` voert tekst door de geteste pipeline, met Translation
Memory (herhalingen kosten niets) en een deterministische kwaliteitscontrole. Elk antwoord
noemt de engine die daadwerkelijk heeft gedraaid, inclusief diens model en eindpunt voor zover aanwezig.
`run_benchmark` start een evaluatie en retourneert **onmiddellijk een job-id**,
omdat echte runs langer duren dan welke client-time-out dan ook; u pollt `get_run_status` met
dat id. Een taak overleeft een herstart van de server: de run loopt door, en
het naderhand pollen van hetzelfde id levert nog steeds de status en resultaten op. Er wordt
niets gepubliceerd tenzij u `publish: true` meegeeft; het plan geeft vervolgens aan wat er
openbaar zou worden gemaakt — elke rij met de bijbehorende zinstekst, of alleen scores; de prompt, of alleen
de hash ervan; en waar — en een daadwerkelijke publicatie vereist `publish_ack` in exact
de bewoordingen die het plan aangeeft, zodat de gebruiker deze eerst heeft gezien. Een run die zonder deze optie is
uitgevoerd, kan later worden gepubliceerd, achter dezelfde controle. `preview_publish` is alleen-lezen:
het toont het eigen publicatievoorbeeld van het harnas, de exacte bewoordingen en de exacte
`publish_report`-aanroep waarmee het zou worden gepubliceerd, en kan zelf niet publiceren. Het
bevat de MCP-annotatie `readOnlyHint: true`, zodat een agent-host die voorafgaand aan
elke schrijfactie toestemming vraagt, dit zelfstandig kan toestaan. `publish_report` voert de schrijfactie uit
(geannoteerd als `destructiveHint` en `openWorldHint`), en `scores_only`
houdt de zinstekst achter. Elk plan opent ook met de
`EVAL PACK:`-status van de doeltaal — `missing` (met de opdracht die
deze installeert), `ready` of `none needed` — en vermeldt de corpuslicentie en de
`do_not_train`-voorwaarde, omdat de run `--yes` doorgeeft. Een ontbrekende FST (de
analysator of de pyhfst-runtime ervan) stopt de run nooit: deze gaat door, en de run-kaart
markeert FST-acceptatie als niet berekend. Elk ander ontbrekend onderdeel stopt de run
voordat deze vertaalt. `skip_fst` en `skip_eval_standard` berekenen de score zonder die
onderdelen, en de run-kaart markeert wat er is weggelaten. Het plan geeft ook aan of
COMET wordt berekend (het harnas berekent dit wanneer `unbabel-comet` is
geïnstalleerd; `comet: true` stelt dit verplicht voor de run), en `metricx` en `fuse`
vragen om de optionele MetricX-24 en FUSE-achtige comparator van het harnas. Voor elk
onderdeel vermeldt het plan, vanuit het harnas, of het geïnstalleerd is, wat er geïnstalleerd moet worden
en wat het downloadt. Een bevestigde run die vraagt om een metriek die het harnas
niet kan berekenen, wordt geweigerd in plaats van uitgevoerd zonder die metriek. De regels `Results:`
en `Cache:` van het plan geven aan waar het run-logboek, het rapport en de vertaalcache terechtkomen.
Een testbestand in een map die door `mt-eval contest prepare` als vrijgeefbaar is gemarkeerd
(de `public/` van een competitie) draait in plaats daarvan naar de map `runs/` van de competitie, zodat
niets wat een run wegschrijft daarmee wordt vrijgegeven. Een model op uw eigen
machine (een lokale server, of `method: "local-model"`, dat door het harnas in-process
wordt uitgevoerd en geen attestatie vereist) wordt gerapporteerd als `$0 API cost (runs on
this machine)`.

**Trainen zonder uzelf voor de gek te houden.** `get_training_guardrails` retourneert de regels
die zijn afgeleid uit echte, gemeten mislukkingen. De vijftien `forge_*`-tools voeren
[NMT Forge](/docs/agents/training) stap voor bewaakte stap
uit — `forge_status` eerst en na elke stap (deze noemt de volgende
opdracht en de tool die deze uitvoert), `forge_preflight` om te zien tegen welke controles een
opdracht aanloopt voordat deze weigert, `forge_prereg_template` en `forge_prereg`
om voorspellingen vast te leggen voordat er een testscore bestaat (en vóór elke
benchmark op de testset: een scorende uitlezing blokkeert een latere preregistratie),
`forge_export` om de testset eenmalig te scoren en het getrainde model te verpakken,
`forge_compare` om twee modellen via A/B-tests te vergelijken met het voorbehoud van bijna-dubbelingen van elk model naast
de winnaar, en
`forge_prereg_verdict` om het eigen oordeel van de gebruiker vast te leggen over een voorspelling die forge
niet kan beoordelen (een bereik in vrije tekst) — weergegeven als een menselijk oordeel, nooit als een
berekend oordeel. `forge_status` toont elke getrainde run met diens dev-score en
geeft aan wanneer een dev-set verzadigd is (een perfecte dev-score waarbij er voor
checkpointselectie niets te kiezen valt). Wanneer het evaluatieharnas een voorbehoud
plaatst bij een testscore (bijvoorbeeld een nagenoeg constante uitvoer: een handvol uitvoeren
voor elke bronzin), nemen `forge_export`, `forge_status`,
`forge_compare` en `forge_lint` dit over in de eigen bewoordingen van het harnas, en een
belangrijk voorbehoud komt als eerste aan bod in de volgende stap: de score wordt er nooit zonder
geciteerd. Een weigering wordt geretourneerd
met wat er misging, waarom het belangrijk is en de oplossing. Twee stappen duren langer dan welke tool-aanroep
dan ook en draaien daarom in een terminal: trainen (`nmt-forge run`) en het serveren van het
geëxporteerde model (`nmt-forge serve`, waarmee het achter een lokaal eindpunt wordt geplaatst dat
door `translate` en de CLI kan worden gebruikt).

### Argumenten

`name` is verplicht en `name?` is optioneel. Elke tool die één
taal accepteert, accepteert deze ook als `language`: "`code` of `language`" betekent dat beide
namen werken, en u er één doorgeeft. De oorspronkelijke namen blijven werken.

| Tool | Argumenten |
|---|---|
| `search_languages` | `query` of `language`, `limit?` |
| `language_overview` | `code` of `language`, `source?` |
| `get_language` | `code` of `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (ten minste één van deze drie), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` of `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | geen |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` of `priority?` (één hiervan) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (een gettext-msgctxt: één voor elke tekst, of één per tekst), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | één modus: `budget?` of `top?` (wachtrij), `item_id?`, of `corpus?` met `model?` (met `method_dir`, het model dat de plugin laadt), `method?` of `method_dir?` (een directory voor een method-plugin; `local-model` vereist `model` — heeft geen standaardwaarde), `allow_model_pair_mismatch?` (`local-model`: voer een OPUS-MT-paarmodel uit dat een ander paar noemt, als gerelateerde taal-baseline), `attest_local_transport?` (een MT-engine of een plugin; nooit vereist voor `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (LLM-runs: het ISO 15924-schrift waarin de uitvoer geschreven moet zijn, zoals `Cans` of `Latn`; het plan geeft aan wanneer de kaart van het doel er meer dan één vermeldt), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` en `skip_eval_standard?` (item- en corpus-runs: bereken de score zonder de FST of de standaard evaluatiemetrieken, gemarkeerd als niet berekend), `comet?` (COMET vereisen: de run wordt geweigerd zolang dit niet geïnstalleerd is), `metricx?` met `metricx_model?`, en `fuse?` (item- en corpus-runs: de optionele MetricX-24 en FUSE-achtige comparator van het harnas, geweigerd zolang niet geïnstalleerd); vervolgens `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (bij een echte publicatie: de exacte bewoordingen die het plan afdrukt), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (het `*_report.json` van een voltooide run), `scores_only?`, `redact_coaching?`, `anonymous?` (alleen-lezen: geen `confirm`, kan niet publiceren) |
| `publish_report` | `report` (het `*_report.json` van een voltooide run), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (de exacte bewoordingen die het voorbeeld afdrukt) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (de te controleren opdracht), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` of `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` of `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (standaard `data/split`, het pad dat door config.json van `forge_init` wordt gelezen), `dev?`, `register?` (een naamvoorvoegsel, of `true` voor `project`), `allow_rotate?`, `near_dupe?` (een Jaccard-drempelwaarde zoals 0,6, wanneer forge de uitsplitsing van bijna-dubbelingen aanbeveelt), `max_group?` (met `near_dupe`: de grootste groep bijna-dubbelingen), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (met een eigen `clean_to`, bijv. `corpus.notwins.jsonl` — nooit het bestand met alle gegevens), `companion_config?` (met `drop_test_twins`: waar de configuratie van het model zonder dubbelingen naartoe gaat; standaard `config-notwins.json`), `overwrite?` (vervang een `clean_to`-bestand dat door een configuratie, run, splitsing of andere audit wordt gebruikt — zonder dit geweigerd), `full_indices?` (elke lijst met rijnummers volledig; standaard worden lange lijsten geretourneerd als `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (vastmaken aan één run), `allow_after_reads?` (alleen voor voorspellingen die zijn vastgelegd vóór de scorende uitlezingen van de set), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (het nummer ervan, of het eigen id), `verdict` (`held` of `missed`), `by` (wie heeft geoordeeld), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (het run-manifest van elk model: de trainingsgegevens ervan worden gecontroleerd op bijna-dubbelingen), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Bijvoorbeeld, `get_metric_reliability { "language": "crk" }` en
`get_metric_reliability { "target": "crk" }` stellen dezelfde vraag.

### Vertalen met een door u geïmplementeerd model

`nmt-forge serve` toont twee adressen voor het model dat het serveert. Wijs
`translate` naar een van beide:

| Argument | Gebruik met | Voorbeeld |
|---|---|---|
| `base_url` | `method: "local"` — een met OpenAI compatibele server (ook `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — het Champollion-API-contract | `http://127.0.0.1:8378/translate` |
| `model` | uitsluitend LLM-engines; geweigerd voor machinevertalings-API's, die dit niet hebben | `llama3.1` |
| `project_dir` | elke methode — gebruik het Translation Memory van dat project | `~/my-app` |

Een server op uw eigen machine heeft geen sleutel nodig. Een extern `api`-eindpunt leest zijn
sleutel uit `CHAMPOLLION_API_KEY` in de omgeving van de server. De tool weigert
een argument dat hij niet kent bij naam, in plaats van het te negeren, zodat een verkeerd gespeld
argument uw tekst niet stilletjes naar een ander model kan sturen.

### Waar de server zijn status bewaart

Alles bevindt zich in `~/.champollion-mcp/` (stel `CHAMPOLLION_MCP_HOME` in om het te
verplaatsen):

- **Het Translation Memory van `translate`** is een eigen bestand,
  `.champollion/tm.json` in die map. Het staat los van de `.champollion/tm.json` van
  welk project dan ook. Geef `project_dir` mee om in plaats daarvan het bestand van een project te gebruiken,
  het bestand dat `champollion sync` daar gebruikt.
- **`run_benchmark`-taken** worden vastgelegd in `jobs.json`, waarin de
  nieuwste 50 worden bewaard. Elke taak heeft een map in `jobs/` met de uitvoer ervan en, voor een
  wachtrij-item of een geregistreerd corpus, de resultaten van het harnas. Een run op een testbestand
  dat u bezit, schrijft de resultaten en cache naast dat bestand, in
  `results/` — behalve een bestand in een map die door `mt-eval contest prepare`
  als vrijgeefbaar is gemarkeerd, waarvan de run naar de map `runs/` van de competitie schrijft. Elke
  dergelijke run krijgt daar een eigen `mcp-run-<id>/`-map, en `get_run_status`
  toont de opdracht `mt-eval compare` voor al deze runs samen
  (`results/mcp-run-*/*_report.json`).
  Wachtrij-runs schrijven hun rapporten naar `eval/logs/harness/queue/` onder de
  werkmap van de server, zoals het harnas altijd doet.

:::note[Uitgaven zijn bewust begrensd]
`run_benchmark` **weigert een onbegrensde wachtrij-run.** U moet exact één
begrenzing meegeven — `budget`, `top` of een specifieke `item_id`. Er is geen aanroep om "gewoon de
wachtrij uit te voeren", omdat een agent die de wachtrij verkeerd begrijpt anders
onbeperkt geld zou kunnen uitgeven.
:::

## Protocolversie

Transport verloopt **uitsluitend via stdio** — één serverproces per agent.

De [revisie van 28-07-2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/) van MCP
maakte het protocol standaard staatloos, waarmee de `initialize`-handshake en
de `Mcp-Session-Id`-header kwamen te vervallen. Deze server ondervindt qua opzet geen gevolgen: hij gebruikt geen
van de verouderde mogelijkheden (Roots, Sampling, Logging), heeft nooit het verouderde
HTTP+SSE-transport gebruikt, en volgt reeds de nieuwe richtlijnen voor status over meerdere aanroepen —
`run_benchmark` genereert een expliciete job-handle die het model terugstuurt, in plaats van
te leunen op een transportsessie.

Het is **niet** bijgewerkt naar de nieuwe revisie, omdat er nog geen gepubliceerde
TypeScript-SDK is die dit ondersteunt. Zie de [README van de
server](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) voor
het volledige standpunt.

## Machineleesbare eindpunten

Hiervoor is geen MCP-client nodig:

| Eindpunt | Wat het is |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | De [toegangspoort voor agents](/for-agents), als ruwe markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | De samengestelde index van deze site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Elke geïndexeerde pagina, inline opgenomen |
| [`/queue.json`](https://champollion.dev/queue.json) | De volledige benchmarkwachtrij |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Belangrijkste wachtrij-items |
| [`/registry.json`](https://champollion.dev/registry.json) | Het corpusregister |
| [`/mesh.json`](https://champollion.dev/mesh.json) | De gemeten taalgraaf |

## Volgende stappen

- [Aansturing via rails via MCP](/docs/agents/mcp) — het rails-profiel, stap voor stap
- [Het operationeel contract](/docs/agents/contract) — de regels waaronder een agent werkt
- [Agenthandleiding — bouwen en benchmarken](/docs/agents/measurement)
- [Agenthandleiding — vertalen met de CLI](/docs/agents/serving)
- [Een methode indienen](/docs/network/getting-started/submit-a-method)
