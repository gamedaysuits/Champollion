---
title: "De rails aansturen via MCP"
slug: /agents/mcp
description: "Verbind een MCP-client met het rails-profiel van Champollion en doorloop een taalproject met behulp van zes tools: configuratie per client, elk argument en elke retourwaarde, de lus, de stapmodi, weigeringen en de explain-onderwerpen."
---

# De rails besturen via MCP

Het standaardprofiel van de MCP-server is de rails: zes tools die één
taalproject begeleiden van een lege map naar een gemeten model op de eigen
computer van de persoon. Elke tool voert de `champollion` CLI uit als een afzonderlijk, begrensd
proces — dezelfde opdrachten die een persoon typt. De server verstrekt uw client
bij het verbinden tevens korte bedieningsinstructies (`instructions-rails.md`).

## Verbinding maken

De server communiceert via MCP over stdio en vereist Node.js 20.11 of nieuwer. De
configuratie die elke via een bestand geconfigureerde client accepteert:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| Client | Waar het moet staan |
|---|---|
| Claude desktop | Settings → Developer → Edit Config. Voeg het item toe, sla op, herstart de app |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | `mcp.json` in de map `.cursor` van het project, of in `.cursor` in de thuismap |

Andere clients die een lokale stdio-server kunnen starten, gebruiken dezelfde opdracht; deze
pagina beschrijft alleen de drie hierboven.

**Pad naar tools.** De server vindt de CLI waarvan hij afhankelijk is zelf. Hij vindt
`nmt-forge` op `PATH`, vervolgens in `UV_TOOL_BIN_DIR` (standaard `~/.local/bin`,
waar `uv tool install` het plaatst) — een client die wordt gestart vanuit een desktop-app
heeft vaak een korter `PATH` dan een terminal. Overschrijvingen, als omgevingsvariabelen in
`env` van het serveritem:

| Variabele | Effect |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails` (standaard) of `full` |
| `CHAMPOLLION_CLI_BIN` | het entrypoint van de `champollion` CLI om uit te voeren in plaats van de meegeleverde versie |
| `NMT_FORGE_BIN` | het uitvoerbare bestand voor `nmt-forge` (het CLI-traject respecteert dezelfde variabele) |
| `UV_TOOL_BIN_DIR` | waar gezocht moet worden naar `nmt-forge` en `uv` na `PATH` |

## Profielen

| Profiel | Selecteren met | Wat het is |
|---|---|---|
| rails | de standaard | Zes tools en korte instructies; één taalproject van begin tot eind |
| full | `--profile full` in `args`, of `CHAMPOLLION_MCP_PROFILE=full` | Elke tool: taalkaarten, corpora, benchmarks, de wachtrij, competities, forge-training, publiceren |

Elke andere waarde stopt de server: `unknown MCP profile "<value>" (rails or
full)`. De volledige set is gecatalogiseerd op
[de pagina over de MCP-server](/docs/network/getting-started/mcp-server). Blijf voor een
taalproject op het rails-profiel: dat is het profiel waarvan elke stap
wordt afgelezen uit de bestanden van het project.

## De lus

1. Nog geen project → `start_project`. De eerste aanroep maakt niets aan: zeg de
   `ask_first` tegen de persoon en doe vervolgens de aanroep die het aangeeft voor diens antwoord.
2. `project_status` → lees `step.mode`, `step.say`, `step.why`.
3. Doe wat de modus aangeeft, met `step.call` — de exacte aanroep die de
   stap uitvoert.
4. Terug naar 2. Na elke wijziging die u of de persoon handmatig hebt aangebracht, roept u
   `project_status` opnieuw aan: de volgende stap wordt altijd uit de bestanden gelezen.
5. `step: null` → de rails zijn voltooid. Vertel de persoon wat `finished` zegt.

| `step.mode` | Doe dit | `step.call` |
|---|---|---|
| `auto` | Voer het uit | `run_next_step` met `project_dir`, `step_id` |
| `confirm` | Vertel de persoon wat het doet (installaties, training); vraag ja of nee; voer het alleen uit bij ja. Bij "niet nu", leg het vast: er wordt niets uitgevoerd | `run_next_step` met `confirmed: true` toegevoegd na de ja; `declined: true` bij "niet nu" |
| `ask_user` | Vraag `step.question` in duidelijke bewoordingen; geef hun antwoorden door via de sleutels in `step.answers`. Bij "niet nu": wanneer `not-now` een van de eigen `enum`-waarden van een slot is, is het een antwoord — geef het door; leg het anders vast: er wordt niets uitgevoerd | `run_next_step` met `answers` — elk slot geschreven als `<…>`, te vervangen door de woorden van de persoon; `declined: true` bij een "niet nu" dat niet een van de antwoorden is |
| `wait` | Er wordt iets uitgevoerd | `project_status` met `wait_seconds: 120`; herhaal zolang de modus `wait` blijft |
| `use_tool` | U doet het nu met `step.tool`; geef het niet terug | bijv. `add_data` met `path: "<each file the person named, where it is>"` |
| `human_only` | Een persoon doet het: vertel diegene `step.say` | geen |

`step.command` is wat de rails uitvoeren — nooit de naam van een tool. Een `<…>` in een aanroep is
een slot voor het antwoord of bestand van de persoon; een slot dat ongewijzigd wordt teruggestuurd, wordt
geweigerd.

## De zes tools

### `start_project`

| Argument | Type | Betekenis |
|---|---|---|
| `folder` | string, vereist | Nieuwe map voor het project, relatief ten opzichte van `parent_dir` |
| `from` | string, vereist | De taal die mensen invoeren: een code of een naam |
| `to` | string, vereist | De taal die eruit komt: een code of een naam |
| `target_name`, `source_name` | string | De naam van de taal zoals de sprekers ervan die zelf noemen; vereist voor een code voor privégebruik (`qaa`–`qtz`) |
| `purpose` | string | Waar de vertalingen voor bedoeld zijn, in de woorden van de persoon |
| `parent_dir` | string | Waar de map moet worden aangemaakt (standaard: de werkmap van de server) |
| `confirmed` | boolean | `true` pas nadat de persoon heeft ingestemd met de richting |

Zonder `confirmed: true` voert het `champollion new --dry` uit en retourneert het
`made: false`, `ask_first` (een zin om uit te spreken: *"Deze vertaler neemt X en
geeft Y terug — u voert X in en Y komt eruit. Is dat de richting die u
wilt?"*), `if_yes` en `if_the_other_way` (elk een volledige aanroep) en
`languages` — waarnaar elke naam is herleid, met `matchedAs` wanneer het woord van de persoon
een andere naam is die op een kaart staat geregistreerd, en `alsoNamed` wanneer hetzelfde woord
andere talen aanduidt. Zeg beide terug. Met `confirmed: true` maakt het het project aan
en retourneert het `project`, `languages` en `next` (de eerste stap).

Bij een naam die op geen enkele kaart voorkomt en waarvoor geen nabije bestaat: de weigering voegt
`if_it_has_no_code` toe, dezelfde aanroep met `to: "qaa"` en hun naam als
`target_name`. Gebruik dit alleen voor de naam die de persoon heeft opgegeven.

### `project_status`

Argumenten: `project_dir` (vereist); `wait_seconds` (0–120). Met
`wait_seconds` leest het elke 5 seconden opnieuw zolang de stap `wait` is, en
keert het terug wanneer de stap verandert of de tijd verstrijkt.

Retourneert `project`, `stage` (`"2/6 Gather your data"`), `step` (`id`, `mode`,
`say`, `why`, `call`, en indien aanwezig `question`, `answers`, `command`,
`tool`, `for_the_person`), en de volgende velden wanneer ze van toepassing zijn:

| Veld | Wat het is | Wat u doet |
|---|---|---|
| `true_now` | Het eigen verslag van Forge, in volzinnen: getrainde modellen en hun beste dev chrF++, het oordeel van de lekaudit per testset, testsetscores, of training actief is, of een model wordt geserveerd en waar | Zeg wat er is gedaan uitsluitend op basis van deze regels, nooit meer |
| `waiting_for_agreement` | Bestanden waarvan de sprekers nog niet hebben ingestemd (`speakers_agreed: not-yet`): elk met `file`, `question`, `say` en een eigen `call` | Stel elke vraag één keer per sessie, op vriendelijke toon; doe de aanroep pas wanneer de persoon zegt dat iedereen heeft ingestemd |
| `files_not_added` | Bestanden die `add_data` deze sessie heeft geweigerd en die nog niet in het project zijn opgenomen, elk met de reden van weigering | Voeg elk bestand toe (de weigering legt uit hoe), of vertel de persoon welk bestand is weggelaten en waarom |
| `model_in_use` | Zodra een model wordt geserveerd, naast de stappen van de verbeteringsrondes: `say` (de uitprobeerpagina en hoe deze wordt gebruikt) en `for_the_person` (de opdracht `champollion connect` die het in hun app of website plaatst) | Vertel het de persoon eenmaal; diegene voert connect uit wanneer gewenst |
| `blockers`, `warnings` | Die van Forge, letterlijk | Geef ze woord voor woord door |
| `finished` | Wanneer er geen stappen meer over zijn: wat de mensen nu kunnen doen (het model uitproberen op de pagina ervan; een app) | Vertel het de persoon |
| `error` | Waarom er geen stap kon worden aangewezen | Geef het door |

Een projectmap die niet bestaat of geen `champollion.project.json` heeft,
wordt geweigerd met de projecten die in de buurt zijn aangetroffen.

### `run_next_step`

| Argument | Type | Betekenis |
|---|---|---|
| `project_dir` | string, vereist | De projectmap |
| `step_id` | string, vereist | De zojuist geretourneerde `step.id` (of de id van een `waiting_for_agreement`-item) |
| `answers` | object van strings | `ask_user`: de antwoorden van de persoon volgens de sleutels in `step.answers` |
| `confirmed` | boolean | `confirm`: `true` pas nadat de persoon ja heeft gezegd. Ook: een stap die tweemaal is mislukt, uitsluitend wanneer de persoon zegt het ongewijzigd opnieuw te proberen |
| `declined` | boolean | `true` wanneer de persoon niet nu heeft gezegd tegen een `confirm`-stap, of tegen een vraag zonder eigen `not-now`-antwoord: er wordt niets uitgevoerd en de vraag wordt deze sessie niet opnieuw gesteld. Waar `not-now` een van de antwoorden is, geeft u dit door in `answers` |

Het leest de volgende stap opnieuw voordat er iets wordt uitgevoerd. **Vergrendelingen:**

- Een afwijkende id wordt geweigerd: `the project changed since that step was named
  — call project_status again`, with `current`.
- `human_only` wordt geweigerd (`a person does this step: …`); een `human_only`-stap
  die een agent met een tool uitvoert, wordt geweigerd met vermelding van de te gebruiken tool.
- `wait` wordt geweigerd; `confirm` zonder `confirmed: true` wordt geweigerd (`ask the
  person first, then call again with confirmed: true`).
- `ask_user`: elk antwoord is verplicht (`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>` placeholder is
  refused; an answer outside an `enum` is refused.
- Alleen de eigen programma's van de rails worden uitgevoerd: `champollion`, `nmt-forge` en `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` of een
  losse `&` wordt geweigerd; `&&` voegt onderdelen samen, uitgevoerd op volgorde, stoppend bij de eerste
  fout.
- Elk onderdeel is begrensd op 10 minuten (de installatie van `uv` op 15).
- `declined: true` bij een stap die noch `confirm` noch `ask_user` is, wordt
  geweigerd: `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- `declined: true` bij een stap waarvan `answers` ook `not-now` bevatten (momenteel de
  `try_it` van het aanbod voor een sterker model), wordt geweigerd en de weigering bevat de
  `answers` van de stap: `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

Retourneert `ran` — per onderdeel: `command`, `exit_code`, `timed_out` wanneer dit het geval was, en
de laatste 40 regels van `output` — en `next`, de volgende stap in
de vorm van `project_status`.

#### "Niet nu"

Er zijn twee manieren om dit vast te leggen, en de stap bepaalt welke:

| De stap | "Niet nu" is | Wat het vastlegt | Wanneer het terugkomt |
|---|---|---|---|
| Een `ask_user`-stap waarvan `answers` ook `not-now` bevatten (het aanbod voor een sterker model: `try_it`, `yes` of `not-now`) | Een antwoord: `answers: {"try_it": "not-now"}` | Het grootboek van Forge (`model-change`, `answer: "not-now"`); verder verandert er niets | Na nog twee rondes die de dev-set beoordeelde als **no-change** of **worse** — over sessies heen |
| Een `confirm`-stap (training, een installatie, een model in gebruik nemen) of een vraag die de persoon nog niet kan beantwoorden | `declined: true` | Alleen het geheugen van deze server | Wanneer de server herstart (de volgende sessie) |

`declined: true` voert niets uit en retourneert `declined` (de stap-id), `ran: []`,
`say` (*"Nothing ran. It is not asked again this session; if they bring it up
and say yes, take it then."*) en `next`. De afwijzing wordt bewaard gedurende de
levensduur van de server — één sessie; een herstartte server is deze vergeten. Zolang dit
geldt, komt die stap terug van `project_status` en `run_next_step` met
`declined_this_session` (wanneer, als ISO-tijdstip) en het bijbehorende `say` dat begint met *"They
said not now (HH:MM UTC) to this: …"* en eindigt met *"Do not ask again this
session — nothing that needs their yes runs. If they bring it up themselves
and say yes, take it with confirmed: true (or their answers)."* Een latere
`confirmed: true`, of antwoorden, voert de stap uit en wist de afwijzing.
**Let op.** Vraag er deze sessie niet opnieuw naar en omzeil de stap niet; als
de persoon er zelf over begint en ja zegt, voer het dan uit.

#### Wanneer een stap mislukt

**Vergrendeling.** Een stap die tweemaal achter elkaar is mislukt (niet-nul afsluitcode of time-out, geteld
over de levensduur van de server) wordt een derde keer geweigerd, tenzij `confirmed: true`,
met de bijbehorende `last_output`. **Let op.** Die vlag kunt u zelf instellen: vertel de persoon
wat de melding was, waarna diegene het oplost (een gecorrigeerde opdracht uitvoeren in een terminal is
prima — roep vervolgens `project_status` aan), of zegt het ongewijzigd opnieuw te proberen.

### `add_data`

| Argument | Type | Betekenis |
|---|---|---|
| `project_dir` | string, vereist | De projectmap |
| `path` | string, vereist | Het bestand waar het staat: absoluut, of relatief ten opzichte van de projectmap of waar de server is gestart |
| `into` | `parallel` (standaard) · `test` · `lexicon` | Paren om van te leren; de gecontroleerde testzinnen; een woordenlijst |
| `source_col`, `target_col` | string | Een kolom als letter (`A`), nummer of kolomkop; voor ELAN het tiernummer dat de weigering vermeldt (of een exacte tier-id die de persoon heeft getypt); voor LIFT een taalcode |
| `sheet` | string | Welk werkblad of welke tabel, wanneer er meerdere zijn |
| `header` | boolean | `true`: de eerste rij is een koptekst; `false`: het is data |
| `usfm_source` | string | Uitsluitend USFM-schrift: de tekst van de andere taal (een `.usfm`-bestand of -map) |
| `replace` | boolean | Een reeds toegevoegd bestand opnieuw inlezen (een andere koptekst of kolommen); de antwoorden van de houders blijven behouden |

Het voert `champollion data add` uit. Roep het eerst aan met alleen het pad: een koptekst
die de talen van het paar noemt, bepaalt de kolommen; anders vraagt het erom en vraagt u
het aan de persoon — beslis nooit op basis van de inhoud. Het leest spreadsheets
(`.xlsx`, `.ods`, `.csv`), `.tsv` en `.txt`, tabellen in Word `.docx`, Toolbox-
en LIFT-woordenboeken, ELAN-`.eaf`-bestanden en USFM.

Retourneert `result` (het rapport van de CLI: tellingen, kolommen, ELAN-tiers op nummer en
de rijnummers die de controle van de rijen noemt — kopieën, herhalingen, afwijkende lengtes,
omgewisselde of verschoven rijen, niets verwijderd — nooit zinnen), `read_from` wanneer
het bestand is gevonden vanuit de startmap van de server, en `also` wanneer het
bestand meer bevat (de voorbeeldzinnen van een woordenboek als paren, of de glossen als
een woordenlijst) — elk item een volledige `add_data`-aanroep. Voer deze uit, tenzij de
voorwaarden van de persoon voor dat bestand dit uitsluiten. Geef de rijcontrole ongewijzigd door: de
persoon bekijkt die rijen in het eigen bestand
([dataregels](/docs/agents/data-rules#what-tools-print-and-never-print)).
Vraag de persoon nooit om een bestand te verplaatsen; `inbox/` is slechts een plek waar men er
een kan neerzetten.

### `try_translation`

Argumenten: `project_dir`; `text` — maximaal 10 regels, ten hoogste 2.000 tekens,
één zin per regel, woorden die de persoon u heeft gegeven.

Het zoekt het model dat dit project serveert (de nieuwste gezonde `serve`-taak in
`nmt-forge jobs --json`), uitsluitend op deze computer, en leest de `/health` ervan.

- **Vergrendeling.** Als `output_local_only` niet `false` is (waar of onbekend),
  retourneert het geen vertaling: `shown_to_person_only: true`, `open` (de eigen
  pagina van het model) en `say`. Verwijs de persoon daarheen; vraag diegene niet om de
  vertalingen ervan terug te plakken naar u.
- Een server die om een token vraagt, wordt geweigerd: tokens worden nooit overhandigd aan een
  agent.
- Anders retourneert het `model`, `pair`, `translations` (`source`,
  `translation` per regel), `errors` indien aanwezig, en `say`: geef deze ongewijzigd
  door; de server controleert niets van wat hij retourneert.

### `explain`

Argument: `topic`. Teksten in duidelijke bewoordingen om door te geven:

| `topic` | Behandelt |
|---|---|
| `rails` | De projectmap en de volgorde van de stappen |
| `privacy` | Wat de sidecar betekent; waarom u de bestanden nooit opent |
| `quality` | Wat een score wel en niet belooft |
| `modes` | Hoe elk type stap moet worden uitgevoerd |
| `improve` | De rondes nadat een model in gebruik is genomen: ongeveer één beoordelingsrij op tien *"comes back from an earlier sheet on purpose (the sheet says so …)"*; een beter model wordt voor gebruik aangeboden en de mensen zeggen ja (*"a verdict alone changes nothing"*); het oordeel 'te weinig' (too-few); het aanbod voor een sterker model na *"two rounds in a row that the dev set could judge show no gain (counted from the last model put to use)"* |
| `off_rails` | Van de rails afstappen: voer een expertopdracht uit en roep vervolgens `project_status` aan |

## Opmerkingen voor de gehele sessie

- **Let op.** Alles wat u leest, gaat naar uw modelprovider. `add_data`,
  `project_status` en `run_next_step` rapporteren tellingen, kolommen en statussen, nooit
  zinnen; houd dat zo. Open de bestanden niet zelf.
- **Let op.** De antwoorden voor `ask_user`, `confirmed: true` en de
  ja voor `waiting_for_agreement` zijn van de persoon. De tools controleren of een antwoord
  aanwezig en juist geformatteerd is; alleen u kunt ervoor zorgen dat het van hen afkomstig is.
- **Let op.** Geef `blockers`, `warnings` en elk voorbehoud woord voor woord door, evenals
  elk getal met de bijbehorende eenheid en de set waarop het is gemeten
  ([coaching](/docs/agents/coaching)).

## Meer informatie

- [Het operationele contract](/docs/agents/contract) — vergrendelingen en opmerkingen.
- [Het rails-model](/docs/agents/rails-model) — het traject, de modi en de
  stap-id's die deze tools lezen.
- [De rails besturen vanuit de shell](/docs/agents/shell) — dezelfde stappen als
  opdrachten.
- [De MCP-server](/docs/network/getting-started/mcp-server) — beide profielen
  en de volledige toolcatalogus.
