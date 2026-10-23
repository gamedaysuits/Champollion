---
title: "Het railsmodel"
slug: /agents/rails-model
description: "Hoe een project op de rails van Champollion wordt opgebouwd: de projectstructuur, de zes schemagevalideerde formaten die elke tool leest, de ene pijplijn van toegelaten invoer tot gemeten uitvoer, het traject als data en de vorm van elke weigering."
---

# Het rails-model

Een project op de rails is een map met gewone bestanden. Elke tool — de
`champollion`-CLI, `nmt-forge`, `mt-eval` en de MCP-server — leest dezelfde
bestanden native, tegen dezelfde schema's, met dezelfde uitkomsten. De volgende
stap wordt altijd uit de bestanden gelezen, nooit onthouden. (Twee zaken bevinden zich
buiten het project: de MCP-server telt het aantal mislukte pogingen van een stap voor zijn eigen
levensduur, en nmt-forge houdt één machinewijde trainingswachtrij bij in
`~/.nmt-forge`.) Wijzigt u handmatig een bestand en vraagt u vervolgens om de volgende stap, dan
geeft het antwoord die wijziging weer.

Deze pagina is de overzichtskaart. De operationele regels staan in
[het contract](/docs/agents/contract); de tool-aanroepen staan in
[MCP](/docs/agents/mcp) en [de shell](/docs/agents/shell).

## De tools

| Tool | Installatie | Wat het doet op de rails |
|---|---|---|
| `champollion` | npm (Node 20.11+) | Start projecten, brengt gegevens binnen, legt de voorwaarden vast, noemt de volgende stap, voert de verbeteringsrondes uit, verbindt een model met een app |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | Traint, screent, splitst, legt voorspellingen vast, scoort modellen op de testset en exporteert ze, serveert ze; houdt het grootboek bij |
| `mt-eval` | meegeleverd met `nmt-forge` (het package `mt-eval-harness`) | Voert een methode uit over een testset, een bestand of een verzoek; past gates toe; scoort |
| `champollion-mcp-server` | npx | Stuurt de `champollion`-CLI aan als begrensde child-processen; het rails-profiel bestaat uit zes tools |

Elke tool draait als een eigen proces. De MCP-server voert dezelfde commando's uit die
een mens typt (zijn `run_next_step` weigert elk programma behalve
`champollion`, `nmt-forge` en `uv tool install … nmt-forge`).

## De projectstructuur

`champollion new <folder> --from <language> --to <language>` schrijft:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

Het weigert een map die al een project bevat (exit 1) of enig
niet-verborgen bestand (exit 1), en een andere `kind` dan `language`: projecten van het type `task` en
`service` bevinden zich nog niet op de rails. `--dry` lost de talen
op en schrijft niets.

De stappen voegen de rest toe terwijl ze worden uitgevoerd:

| Pad | Geschreven door | Bevat |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — de voorwaarden van het bestand ernaast |
| `data/combined-from/` | `champollion data combine` | de originelen die combine heeft samengevoegd (verplaatst, nooit verwijderd) |
| `data/not-for-training/` | `champollion data combine` | bestanden waarvan de houders hebben aangegeven dat geen enkel model ervan mag leren |
| `.forge/` | `nmt-forge init` | de werkplaats: `eval-registry.json`, `ledger.jsonl`, preregistraties, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | de trainingsconfiguratie (een modelvoorinstelling uitgevouwen tot expliciete getallen) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | de gescreende trainingsparen |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | de dev-set; het trainingsbestand van elke ronde |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | zinnen die de spreker voor de dev-set heeft geschreven — rol `dev`, alleen lokaal, nooit op getraind |
| `improve/time.json` | `champollion improve time` | de tijd van de spreker, in diens eigen woorden |
| `improve/round-<k>/` | de improve-stappen | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (welke rijen het andere model heeft opgesteld — een nieuwer model dat niet in gebruik is, of het model dat door een promotie is vervangen: rijnummers, runnamen, de relatie en het aantal trainingsparen van elk model — en, vanaf ronde 2, `repeat_rows`: de rijen die opnieuw worden getoond, elke `row`, `from_round`, `from_row` en de eerdere `mark`), `marks.json` (de aantallen, het aandeel juist met het bijbehorende interval, `blind` en `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | een geëxporteerd model en de bijbehorende method.json |
| `deploy/<name>.json` | `nmt-forge export` (binnen een rails-project) | deployment/1 — wat er is geïmplementeerd |
| `gates/*.json` | mensen | gate-chain/1 — controles tussen uitvoer en wat er wordt uitgeleverd |
| `methods/<id>/method.json` | mensen | method/1 (tevens geschreven door `nmt-forge export` naar een modelmap, `mt-eval export` en `champollion serve --emit-manifest`) |

## De formaten

Zes framework-schema's bevinden zich in `shared/schemas/framework/`. Elk document
noemt zijn schema in `$schema`. Onbekende sleutels worden geweigerd; een eigen
sleutel plaatst u onder `x-`.

| Formaat | `$schema` | Waar | Wat het is |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | Alleen beslissingen: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | De voorwaarden van een gegevensbestand: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, registratievelden, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | Eén methode: `id`, `name`, `kind` en de specifieke instelling van dat type, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | Geordende `metric-threshold`-gates en een optionele `fallback` |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | Eén methode, bijbehorende gates, één paar; optionele `serve` host en poort |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | het `/translate`-contract | Verzoek-, respons-, fout- en `/health`-documenten |

`project.defaults` — wat gegevens die aan het project worden toegevoegd krijgen wanneer niemand
iets anders aangeeft. `champollion new` schrijft `{"transmission": "local-only",
"training": "ask", "share_scores": "ask"}`. The values: `transmission`
`local-only` of `ask`; `training` `allowed`, `not-allowed` of `ask`;
`share_scores` `never` of `ask`. `ask` zorgt ervoor dat de tools stoppen en het navragen — de rails
verzinnen nooit een antwoord.

Twee andere records zijn geen framework-schema's, maar maken wel deel uit van het model:

- **Het forge-grootboek**, `.forge/ledger.jsonl`: append-only en hash-geketend
  (elke invoer sluit de hash van de voorgaande in; `nmt-forge ledger verify`
  mislukt bij elke bewerking). Het registreert registraties, elke leesactie van een geregistreerde
  set, preregistraties, scores, verbruiken van verzegelde sets, overschrijvingen,
  oordelen van lek-audits, de woordenboekondergrens, exports, keuzes, serves, ronde-oordelen
  (`improve-compare`: `better`, `worse`, `no-change` of `too-few` onder 50
  dev-zinnen), hoe elke ronde traint (`round-plan`), de concepten van het andere model
  voor een beoordelingsblad (`draft-newer`: runnamen, `relation`, het aantal
  trainingsparen van elk model en een telling van concepten), het blinde oordeel van de
  spreker over een nieuwer model (`improve-speaker`: runnamen, vier tellingen, `z`,
  `clear`), modelwijzigingen (`model-change`, inclusief een `not-now`) en wat
  `nmt-forge tidy` heeft verwijderd (`tidy`: runs en bytes). Tellingen, hashes en
  paden — nooit een zin. Het is een boekhouding met
  manipulatieherkenning, geen cryptografische beveiliging.
- **De run-kaart**: wat `mt-eval run` registreert voor een beoordeelde run, en wat een
  gepubliceerd resultaat bevat. Zie de [run-kaartspecificatie](/docs/network/specifications/run-card).

**Vergrendeling.** `champollion validate [folder]` controleert het projectbestand, elk
sidecar-bestand, elke `method.json` (in de hoofdmap, in `methods/*/` en
`.champollion/methods/*/`), `gates/*.json` en `deploy/*.json` aan de hand van deze
schema's. Het testkader leest dezelfde bestanden met dezelfde uitkomsten. Exit 0 = geen
fouten, 1 = een document is ongeldig, 2 = gebruiksfout. Het opent uitsluitend deze JSON-bestanden,
nooit een gegevensbestand.

`champollion upgrade [folder]` herschrijft sidecars die vóór set/1 zijn geschreven (zonder
`$schema`) naar set/1, waarbij elke waarde behouden blijft (een sleutel die set/1 niet kent, wordt
verplaatst naar `x-<key>`). Een ongeldige sidecar wordt ongemoeid gelaten, en een oudere
`method.json` wordt vermeld zonder deze te wijzigen: elke tool leest deze nog steeds, als method/0,
met een waarschuwing.

## De ene pipeline

Elke manier waarop een methode met tekst in aanraking komt, is één pipeline in de evaluatie-engine:

1. **Toelaten.** De voorwaarden van de invoer worden gelezen (de set/1-sidecar, een JSON-envelope,
   het registeritem) en het transmissiebeleid wordt vastgesteld en
   gehandhaafd voordat er iets wordt vertaald. Een kanaal dat volgens het beleid niet
   is toegestaan, wordt hier geweigerd (zie [gegevensregels](/docs/agents/data-rules)).
2. **Methode.** Eén methode vertaalt (typen method/1: `llm`, `llm-coached`,
   `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`,
   `human`).
3. **Gates.** Als er een gate-keten is opgegeven, wordt elk segment beoordeeld; de eerste gate
   die weigert, bepaalt wat er wordt verzonden (`drop`, `keep-source`, `flag`,
   `fallback`). Zie [methoden en gates](/docs/agents/methods).
4. **Uitvoer.** Het runlogboek wordt weggeschreven; bestanden die zijn afgeleid van gemarkeerde invoer
   dragen de voorwaarden ervan mee in een sidecar ernaast.
5. **Metrieken.** Alleen wanneer er referenties bestaan: de hoofdscore beoordeelt wat er is verzonden,
   de score zonder gates staat ernaast. Zie [metingen](/docs/agents/measurement).

De modi zijn dezelfde pipeline op verschillende invoer:

| Modus | Commando | Invoer | Metrieken |
|---|---|---|---|
| Meten | `mt-eval run` (`mt-eval test` scoort een runlogboek opnieuw) | een test- of dev-set | ja |
| Een bestand vertalen | `mt-eval translate --out <file>` | uitsluitend brontekst | nee |
| Serveren | `mt-eval serve` | één verzoek tegelijk | nee |

**Een implementatie is de meetpipeline op invoer die uitsluitend brontekst bevat.** Eén
deployment/1-bestand wordt getest (`mt-eval run --deployment`), uitgevoerd over een bestand
(`mt-eval translate --deployment`) en geserveerd (`mt-eval serve --deployment`),
zodat wat gemeten is ook daadwerkelijk wordt verzonden. Met `--deployment` worden de vlaggen die het bestand
bepaalt (`--method`, `-m`/`--model`, `--gates`, `--target-script`) geweigerd.
Een implementatie noemt geen score: een gemeten getal is een run-resultaat, dat bij de
run wordt bewaard. Zie [serveren](/docs/agents/serving).

## Het traject, als gegevens

De volgorde van de werkzaamheden is een bestand: `shared/journeys/language.json`. De
evaluator, `cli/lib/framework/journey.js`, is de enige lezer;
`champollion next`, het MCP rails-profiel en `NEXT.md` stellen alle dezelfde
vraag. **De eerste stap die nog niet voltooid is, is de volgende stap.** Deze leest alleen
sidecars, het projectbestand en het register en grootboek van forge — nooit de tekst van een
gegevensbestand — en voert niets uit behalve `nmt-forge --version` (begrensd op
30 s) voor de installatiestap en `nmt-forge status --json` (begrensd op 60 s)
zodra het werk de trainingsfase bereikt.

**Fasen.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

**Een stap** heeft een `id`, een `stage`, een `mode`, eenvoudige woorden om de persoon
te informeren (`say`) en waarom het belangrijk is (`why`), en meestal een `command`. Optionele velden:

| Veld | Betekenis |
|---|---|
| `done_when` | De controle die aangeeft dat de stap voltooid is. Vereist (behalve bij een delegeerstap) |
| `when` | Een controle die moet gelden wil de stap überhaupt van toepassing zijn (de woordenboekondergrens geldt alleen wanneer `data/lexicon/` een bestand bevat) |
| `question`, `answers` | De vraag van een `ask_user`-stap en de antwoordvelden: `{"enum": [...]}` of `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | Wat een agent zelfstandig doet voor de stap van een persoon (de genoemde bestanden binnenhalen met `add_data`) |
| `outdated` | Een variant die wordt gebruikt wanneer de controle vaststelt dat de tool te oud is |
| `delegate` | `"nmt-forge"`: overdragen aan de eigen adviseur van forge |

`{placeholders}` in `say`, `question` en `command` worden ingevuld vanuit het projectbestand
en de gevonden bestanden.

**Controles** vormen een gesloten set; de evaluator genereert een uitzondering bij een onbekende controle:
`project_valid`, `data_files`, `every_data_file_has_terms`,
`protected_test_set`, `tool_on_path` (met `min_version`), `path_exists`,
`forge_test_registered`, `single_file`, `forge_role_registered`,
`forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`,
`improve_prepared`, `forge_trained_on_current`.

**Modi:**

| Modus | Wie handelt | Wat de rails toestaan |
|---|---|---|
| `auto` | de agent | het commando uitvoeren |
| `confirm` | de agent, na bevestiging | installaties, training, alles wat kosten met zich meebrengt of publiceert; uitsluitend uitvoeren nadat de persoon akkoord heeft gegeven |
| `ask_user` | de persoon antwoordt | vraag `question`; geef de antwoorden door via de sleutels in `answers`; antwoord nooit namens hen |
| `wait` | niemand | er draait momenteel iets; vraag het later opnieuw |
| `human_only` | een mens | zinnen verzamelen, concepten markeren, kiezen |
| `use_tool` | de agent, met zijn eigen tool | alleen MCP: een `human_only`-stap met een `agent`-veld wordt weergegeven als `use_tool` met `step.tool` |

**Delegatie.** Bij de stap `forge` vraagt het traject `nmt-forge status
--json` op en neemt de status van forge over als de stap. De statussen van forge worden gekoppeld aan modi:
`training` → `wait`; `ready-to-train` en `needs-training-extra` → `confirm`;
`missing-preregistration` → `ask_user`; `choose-export` → `human_only`;
`improve-compare` → `auto`; `improve-promote` → `confirm`;
`improve-stronger-model` → `ask_user`. Elke andere status is `auto` wanneer forge
een commando opgeeft, en `human_only` wanneer dat niet het geval is. Een status van `serving` beëindigt de
bouwfase, waarna de verbeteringsfase begint.

Twee soorten stappen zijn afkomstig van buiten de stappenlijst:

- **De voorspelling beoordelen.** Na een export die op de testset is gescoord, wacht een
  voorspelling die de mensen in hun eigen woorden hebben geschreven op hun oordeel: een
  `ask_user`-stap met `answers` `verdict` (`held` of `missed`) en `by` (wie
  het heeft beoordeeld), die `nmt-forge prereg verdict` uitvoert.
- **Wachten op toestemming.** Elk bestand waarvan de sidecar `speakers_agreed:
  not-yet` becomes its own `ask_user` question in `waiting` vermeldt, beantwoord via zijn
  eigen stap-id zodra de persoon het antwoord heeft. Dit houdt de rest
  van de rails nooit tegen.

**Het stap-id** is `<journey step id>:<8 hex characters>` — een hash van de stap
en het ingevulde commando. Als het project wijzigt, verandert het id, en wordt een
`run_next_step` met het oude id geweigerd (`the project changed since that
step was named`).

**Wat `champollion next --json` retourneert:** `project`, `kind`, `stage` (`n`,
`of`, `id`, `title`), `done` (stap-id's), `step` (`id`, `mode`, `say`, `why`,
en waar aanwezig `command`, `question`, `answers`, `agent`, `agent_tool`,
`file`, `source`), `now` (de feiten van forge — wat op dit moment waar is), `waiting`,
`forge` (`state`, `blockers`, `warnings`), `finished` (wanneer er geen stappen meer over zijn)
en `error`. Exit 1 wanneer er een fout optreedt en er geen stap is.

## Vormen van weigering

Elke weigering vermeldt wat er is gebeurd, en de meeste vermelden waarom en hoe dit kan worden opgelost.

| Tool | Uitvoer voor mensen | Uitvoer voor machines | Exit |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, vervolgens `  why: …` en `  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` op stdout | 2 geweigerd |
| `champollion` | `[ERR] message` op stderr | `--json` waar het commando dit ondersteunt | 1 geweigerd, 2 gebruik |
| MCP rails-tools | — | `{"refused": "<reason>", …}` met `isError: true`, plus de nieuwe poging waar van toepassing (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

`type` in de foutmelding van forge is de exception-klasse (`UsageError` voor ongeldige
argumenten — forge weigert afgekorte vlaggen liever dan te raden). De guard-namen
van Forge omvatten `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` en `disk-room` (een
trainingsrun die niet op de schijf past). Wanneer een foutmelding
een zin uit een achtergehouden corpus zou citeren, luidt de zin
`[sentence withheld]` en voegt het object `text_withheld` toe.

Geef een weigering in duidelijke bewoordingen door en volg de bijbehorende oplossing, of vraag opnieuw
om de volgende stap. Een stap die tweemaal is mislukt, wordt pas weer uitgevoerd nadat de persoon
dit beslist ([MCP](/docs/agents/mcp#when-a-step-fails)).

## Meer informatie

- [Het operationele contract](/docs/agents/contract) — de regels, vergrendelingen en toelichtingen.
- [De rails aansturen via MCP](/docs/agents/mcp) en [vanuit de shell](/docs/agents/shell).
- [Gegevens- en transmissieregels](/docs/agents/data-rules) — set/1 volledig uitgelegd.
- [Methoden en gates](/docs/agents/methods) en [serveren](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1.
- [De run card-specificatie](/docs/network/specifications/run-card) en de
  [harness-specificatie](/docs/network/specifications/harness).
- [`mt-eval` commandoreferentie](/docs/reference/mt-eval) en de
  [`nmt-forge` commandoreferentie](/docs/network/getting-started/forge-command-reference).
