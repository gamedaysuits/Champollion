---
title: "Serving en uitrol"
slug: /agents/serving
description: "Zet een gemeten model aan het werk: het deployment/1-bestand dat nmt-forge export schrijft, mt-eval translate en serve, nmt-forge serve en de bijbehorende try-pagina, het service-api/1-/translate-contract, champollion connect en champollion sync aangestuurd door een agent — met wat uitsluitend lokale uitvoer wel en niet mag doen."
---

# Serving en deployment

**Een deployment is de meetpijplijn op invoer die uitsluitend uit brontekst bestaat.** Eén
deployment/1-bestand specificeert de methode, het bijbehorende model, de bijbehorende gates en het taalpaar. Hetzelfde
bestand wordt getest op een testset, uitgevoerd over een bestand en geserveerd, zodat wat
gemeten is ook daadwerkelijk wordt geleverd. Deze pagina is het agents-deel van
[In gebruik nemen](/docs/put-it-to-work).

Overal geldt: een model dat heeft geleerd van zinnen die als local-only zijn gemarkeerd, kan deze
herhalen, dus **de uitvoer is eveneens local-only**. Elke onderstaande tool houdt die uitvoer
op deze computer tenzij de datahouders anders zijn overeengekomen, en
`--holders-agreed-by` legt vast wie akkoord is gegaan. **Opmerking.** Geef die vlag alleen mee met
de naam die de persoon u gaf, nadat deze heeft bevestigd dat de houders akkoord zijn gegaan.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. Vereist: `id`,
`pair` (`source`, `target`, optioneel `target_script`), `method` (`method`,
optioneel `model`). Optioneel: `gates` (een gate-chain/1-bestand) en `serve`
(`host`, standaard `127.0.0.1`; `port`). Paden zijn relatief ten opzichte van de projectroot,
waar de rails opdrachten uitvoeren. Het bevat geen score.

**Wie het schrijft.** `nmt-forge export`, wanneer de export zich binnen een rails-project
bevindt (een `champollion.project.json` erboven), schrijft
`deploy/<name>.json` — `<name>` is `--name` in kebab-case, anders
`nmt-forge-<run>`:

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

Er wordt niets geschreven (en geeft `no deployment file: …` aan) wanneer de export zich buiten
een rails-project bevindt, wanneer het model is geselecteerd onder een decode-hook (alleen
`nmt-forge serve` voert de hooks van forge uit), wanneer de configuratie geen taalpaar noemt, wanneer het
document niet valideert, of wanneer `deploy/<name>.json` al
een ander model uitrolt (wordt nooit vervangen).

**Wie het leest.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**Vergrendelingen.** Met `--deployment` weigeren `run` en `translate` `--method`,
`-m`/`--model`, `--gates` en `--target-script` (*"--deployment … specificeert de
methode, het bijbehorende model, de bijbehorende gates en het doelschrift; verwijder … (of pas het
bestand aan)"*); `serve` weigert ook `--pair`. Invoer in een ander taalpaar wordt geweigerd
(`deployment <id> translates from <src>; this input is in <x>`). Een
deployment waarvan de gate-chain terugvalt, kan worden vertaald en geserveerd, maar niet
worden gemeten: `mt-eval run` weigert een keten die terugvalt
([methoden en gates](/docs/agents/methods#gate-chains)).

## Wat een export bevat

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` schrijft:

| Pad | Wat het is |
|---|---|
| `<dir>/model/` | De map om te implementeren: gewichten en tokenizer, `forge-model.json` (waarop het getraind is, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, type `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (poort 8378 tenzij `--port`), `card.commercial_ready: false`, `evidence` met de chrF++ van de testset, het interval en n |
| `<dir>/evaluation/` | Het testset-bewijs. Kopieer dit nooit samen met het model |
| `<dir>/input-words.json` | De woorden van de invoerzijde van de trainingszinnen, van elk één, gesorteerd (`words`, `english`, `sentences`, `from`, en `notes` met vermelding van een trainingsbestand dat niet kon worden gelezen zoals de run het las). Naast `model/`, nooit erin: het zijn woorden uit de data van de gemeenschap. Wordt geschreven wanneer de export het model bevat en de trainingsbestanden ervan op deze computer staan; anders vermeldt de samenvatting van de export `input_words.written: false` met `why`. `nmt-forge serve` leest dit om de woorden te benoemen die het model nooit heeft gezien ([hieronder](#words-the-model-never-saw)) |
| `<dir>/README.md` | Wat de export is |

## `mt-eval translate`

De pijplijn over een bestand, niets gescoord. `--out` accepteert `.jsonl` (één rij per
segment: `id`, `source`, `output`, `error`, en met gates `gates`,
`shipped_from`, `fallback`) of `.tsv` (bron, tab, uitvoer). Zonder `--out`
schrijft het `<run id>.translations.jsonl` in de uitvoermap (`-o`). De
uitvoer draagt de voorwaarden van de invoer — en die van het model — mee in een set/1-sidecar.

**Vergrendeling.** Wanneer de uitvoer van de methode local-only is (of die van de fallback
van de gate-chain), wordt een bestemming buiten het project geweigerd voordat er iets
wordt vertaald: *"weigeren te schrijven naar …: wat deze methode schrijft is local-only
(…), en dat bevindt zich buiten … — een plaats die de datahouders niet hebben gekozen. Alleen
zij kunnen daarmee instemmen — vraag het hun; als zij dat doen: --holders-agreed-by "<who
agreed>" (vastgelegd in de sidecar van het bestand; het blijft gemarkeerd als local-only). Of
schrijf het binnen het project"*. Met de overeenkomst legt de sidecar
`holders_agreed: {by, date}` vast; het bestand blijft local-only voor elke tool.

`--json` toont `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` en `output_gates`. Exit 1 wanneer elke rij is mislukt. `--publish`
wordt geweigerd: er is geen score.

## `mt-eval serve`

| | |
|---|---|
| Standaardadres | `127.0.0.1:8379` (`--host`, `--port`, of het `serve`-blok van de deployment) |
| Wat het serveert | Alleen een methode die in dit proces draait: `lexicon`, `local-model`, of een plug-in waarvan method.json `dependency_class` `S` of `O` declareert. Een LLM of een gehoste engine wordt geweigerd |
| Token | `MT_EVAL_SERVE_TOKEN`, uitsluitend vanuit de omgeving. Vereist om te luisteren op elk ander adres dan `127.0.0.1`, `::1` of `localhost`; indien ingesteld, vereist bij elke `POST` (ook loopback). `GET /health` heeft dit nooit nodig |
| Limieten | Body van 1.000.000 bytes, 500 sleutels, 20.000 tekens per tekenreeks — meer dan een van deze is `413` |
| Gates | `--gates <chain>` (of de `gates` van de deployment). De plug-in van elke gate moet zonder referenties oordelen, anders start deze niet. Een fallback is hier toegestaan en moet in dit proces draaien |

**Vergrendeling — buiten loopback.** Zonder token: *"weigeren te luisteren op … zonder
token — iedereen die de poort kan bereiken, zou de methode kunnen gebruiken"*. Met local-only
uitvoer en zonder toestemming: *"weigeren te serveren op …: wat deze methode schrijft is
local-only (…), en een adres dat andere machines kunnen bereiken stuurt het weg van deze
machine. Alleen de datahouders kunnen daarmee instemmen — vraag het hun; als zij dat doen:
--holders-agreed-by "<who agreed>" (gerapporteerd op /health), of behoud --host
127.0.0.1"*. Uitvoer is local-only wanneer de sidecar van een woordenboek dat aangeeft (of
niet kan worden gelezen), of wanneer `forge-model.json` van een modelmap local-only
trainingstermen vastlegt of er geen vastlegt; het wordt gerapporteerd als niet bekend (`null`) voor een
plug-in of een modelmap zonder `forge-model.json`.

`/health` antwoordt met `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (in dit proces — er wordt niets ergens naartoe gestuurd), `scored`
(niets), `output_gates` en `gates` (chain-id, vingerafdruk, gates, fallback),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (de repository) en `version`.

Met gates wordt een geweigerd segment geretourneerd zoals de desbetreffende gate voorschrijft: `drop` — de sleutel
onder `errors`; `keep-source` — de brontekst; `flag` — de uitvoer, de sleutel
genoemd in `meta.gates.flagged`; `fallback` — de vertaling van de fallback als de
gates deze accepteren. Zonder gates controleert het niets van wat het retourneert.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| Standaardadres | `127.0.0.1`, poort `NMT_FORGE_SERVE_PORT` of 8378 |
| Token | `--token` of `NMT_FORGE_SERVE_TOKEN`; vereist buiten loopback. `--detach` haalt dit alleen uit de omgeving |
| Routes | `GET /` — een uitprobeerpagina voor de persoon (geen token; vraagt erom wanneer er een is ingesteld); `GET /health`; `POST /translate` (service-api/1); `POST /v1/chat/completions` (OpenAI-compatibel); `GET /v1/models` |
| `--detach` | Keert terug zodra `/health` antwoordt; wordt gestopt als dit niet binnen 120 s gebeurt. Geweigerd wanneer de poort al antwoordt |
| `--no-hook` | Serveren zonder de decode-hook van de run (vermeld op `/health` en in `meta`) |
| `--allow-locale` | Accepteer ook deze locale-codes (herhaalbaar) |
| `--device` | `auto` (standaard) of `cpu`. Met `auto` gebruikt een server die gestart is terwijl een trainingstaak van hetzelfde project draait de CPU in plaats van de GPU te delen, en `/health` geeft dit aan (`device_note`) |
| Limieten | Body van 1.000.000 bytes, 500 sleutels, 20.000 tekens per tekenreeks, 5.000 eenheden modelwerk per verzoek — meer dan een van deze is `413`. Het model wordt per 32 delen tegelijk bevraagd, waardoor een zin uit een ander verzoek op één chunk wacht, nooit op een volledig verzoek. Een verzoek dat na 600 s nog steeds draait, wordt in zijn geheel geweigerd — `503`, *"stuur minder delen tegelijk"* — nooit gedeeltelijk beantwoord |
| Decodering | Beam search met `num_beams` van de export wanneer de export `beams_applied` vastlegt (zoals het model is gemeten); greedy voor een oudere export. Verzonden tekst wordt genormaliseerd naar NFC, net als trainingsdata |

**Vergrendeling.** Buiten loopback wordt een model waarvan de uitvoer local-only is — getraind op
local-only zinnen, of zonder registratie van waarvan het geleerd heeft — geweigerd
zonder `--holders-agreed-by`. `/health` rapporteert `pair`, `accepts`,
`decode_hook`, `run`, de dev- en testrapporten, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` en `output_gates`. Elk `/translate`-antwoord van een
local-only model bevat `meta.output_local_only: true`, en elk
`/v1/chat/completions`-antwoord bevat `meta.output_local_only` (true of false).
Wanneer de lengtelimieten iets afkappen in een verzoek, telt de `meta.cut` ervan de
zinnen die bij de invoer zijn afgekapt (`inputs`) en de vertalingen die zijn gestopt bij de
limiet (`outputs`) ([training](/docs/agents/training#the-guarded-loop)).

**Opmerking.** De uitprobeerpagina is voor de persoon bedoeld. `try_translation` (MCP) verwijst hen
daarheen voor een local-only model; roep `/translate` nooit zelf aan om de
uitvoer ervan te lezen ([contract](/docs/agents/contract) §1).

### Woorden die het model nooit heeft gezien

Een zin die een woord bevat dat het model tijdens de training nooit heeft gezien, is zeer waarschijnlijk
verkeerd vertaald, hoe vloeiend deze ook leest. Op de verzonnen testtaal werd een
achtergehouden zin met een inhoudswoord dat het model niet had gezien 0 van de 358 keer
correct vertaald (ByT5-small bij 1.600, 6.400 en 25.600 trainingsparen),
en kwam zelfverzekerd fout naar voren — vloeiend, elk woord een bestaande vorm, de betekenis
verkeerd — in 32%, 55% en 83% van de gevallen: hoe beter het model, hoe
overtuigender de gok. Daarom noemt de server die woorden.

- **`/health`** geeft aan of dit mogelijk is: `unseen_words_check` is `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- **`/translate`** voegt, uitsluitend wanneer een verzoek dergelijke woorden bevat,
  `meta.unseen_words` toe (sleutel → de woorden van de tekst van die sleutel die het model nooit
  heeft gezien, elk één keer, op volgorde) en `meta.unseen_note`. **`/v1/chat/completions`**
  voegt hetzelfde toe, gekoppeld aan wat er werd gevraagd: `SEG_<id>` per segment in block-modus,
  `page` voor een pagina, de eigen sleutels van het JSON-object, of `text`.
- **Geen registratie, gemeld bij elk antwoord.** De server leest `input-words.json`
  uit de map boven de modelmap die hij serveert. Als daar niets aanwezig is — een
  export made before 2026-10-13, one made without its training files on this
  computer, of een modelmap die is weggekopieerd uit de export — vermeldt de `meta.unseen_check` van elk
  antwoord dat er niet kan worden gecontroleerd, en waarom. Serveer het model vanuit de bijbehorende
  export, or export it again.
- **De uitprobeerpagina** markeert de regel: *"Nooit gezien tijdens training: … — deze regel is
  hoogstwaarschijnlijk onjuist, hoe vloeiend deze ook leest."*

Een woord is een aaneenschakeling van letters in elk schrift (inwendige apostrofs blijven behouden),
omgezet naar kleine letters, in NFC. Wanneer de invoerzijde Engels is, telt een gewone
Engelse uitgang in beide richtingen als gezien (`walk` gezien → `walked` telt mee; `walked`
gezien → `walk` telt mee).

## service-api/1 — het `/translate`-contract

`$schema` `https://champollion.dev/schemas/service-api/1.json`, gehouden aan
`shared/test-fixtures/framework/service-api-vectors.json` (uitgevoerd tegen
`mt-eval serve` en `nmt-forge serve`).

- **Verzoek** `POST /translate`: `keys` (sleutel → brontekenreeks; vereist),
  optioneel `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` voor documenttekst), `instructions` (sleutel → notitie; alleen verzonden naar een
  server die verklaart deze te volgen, `accepts_instructions`). Een veld dat een server
  niet gebruikt, wordt genegeerd, nooit geweigerd.
- **Respons:** `200` `{translations, meta}` — `meta` is vereist; `207` voegt
  `errors` toe (sleutel → `{message}`). Fouten zijn `{error: {message}}`: `400` een
  verzoek dat het niet kan verwerken, `401` een ontbrekend of onjuist token, `404` een onbekende
  route, `413` te groot, `500` de methode is mislukt — nooit een gedeeltelijk antwoord.
  (`nmt-forge serve` antwoordt ook met `503` voor een verzoek dat de limiet van 600 s overschrijdt.)
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false of null), `cost_usd`; servers mogen velden toevoegen.
- **`GET /health`** vereist `status` (`ok`), `pair`, `output_gates` en
  `output_local_only`; optioneel `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`.
- **De regel:** een server waarvan `/health` `output_local_only: true` aangeeft, plaatst
  `output_local_only: true` in de `meta` van elke respons, en een client schrijft
  dergelijke uitvoer alleen waar de datahouders hebben ingestemd.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

Het zoekt de `method.json` (het genoemde bestand, of `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` in
de map), installeert dit in de `.champollion/methods/` van de app, en verwijst
elk van de paren (`<inputLocale>:<target>`) ernaar als `methodPlugin`, met behoud
van de rest van het paar. De app-map heeft `champollion.config.json` nodig, en de
methode moet vertalen vanuit de `inputLocale` van de app.

**Vergrendeling.** Een model waarvan de uitvoer local-only is — bekend uit de
`forge-model.json` ervan (een ontbrekende telt mee), of uit de `/health` van de service —
wordt geweigerd zonder `--holders-agreed-by`: wat het in de locale-bestanden van de
app schrijft, wordt samen met de app gepubliceerd. Hiermee legt elk paar
`holdersAgreed: {by, date, method, what}` vast. Het waarschuwt, zonder te falen, wanneer
er niets antwoordt op het eindpunt (`nmt-forge serve <dir> --detach` start dit)
of wanneer `/health` service-api/1 niet volgt. `--json` toont `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`.

## `champollion sync`, aangestuurd door een agent

`sync` vertaalt de locale-bestanden van een app of site met de methoden die de
`champollion.config.json` ervan noemt. Het vraagt niets interactiefs.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**`--json`-uitvoer** is één JSON-object per regel. Op stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` met
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` en meer; een dry-run voegt `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) en `maxCost` toe. Op stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` en
`error`.

| Exit | Betekenis |
|---|---|
| 0 | Schoon |
| 1 | Een `--redo`- of `--force-keys`-naam kwam met geen enkele sleutel overeen; mislukkingen waarbij niets is verwerkt; een fout |
| 2 | `--max-cost` heeft het gestopt vóór een aanroep (of de schatting was onbekend); of gedeeltelijk: er is iets mislukt, sleutels zijn achtergehouden, meervoudsvormen ontbreken, of verify heeft fouten gevonden |

Een dry-run verzendt en schrijft niets, verifieert niet en sluit af met exitcode 0, tenzij een
genoemde sleutel met niets overeenkwam of er een fout was. Verify draait na een echte synchronisatie,
tenzij `--no-verify`.

**Vergrendeling — local-only antwoorden.** Voor een `api`-methode wordt een batch waarvan
`meta.output_local_only` `true` is niet geschreven, tenzij de `holdersAgreed` van het
taalpaar die methode noemt; `sync` meldt dit eenmalig en noemt de
`champollion connect … --holders-agreed-by`-aanroep. Die sleutels blijven
onvertaald (of gaan naar de fallback van het paar).

**Vergrendeling — de `local`-methode.** De `local`-methode (een OpenAI-compatibel
eindpunt) vraagt eenmalig de `/health` van de server op. Wanneer deze
`output_local_only: true` aangeeft — zoals `nmt-forge serve` doet voor een model dat is getraind op
local-only zinnen — wordt er niets van die server geschreven, tenzij de `holdersAgreed`
van het taalpaar `local` vermeldt: *"het model op … geeft aan dat wat het schrijft
local-only is … er is niets van geschreven"*, gevolgd door de
`champollion connect <the model> --holders-agreed-by "<who agreed>"`-aanroep. Een
server waarvan `/health` niet antwoordt of geen `true` aangeeft (bijvoorbeeld een Ollama- of
LM Studio-server), wordt zoals voorheen gebruikt.

**Opmerking.** Verbind een forge-model met `champollion connect` (de `api`-route):
deze leest de eigen registratie van het model over waarvan het geleerd heeft, en legt
de toestemming van de datahouders vast voor het taalpaar onder de methode die het installeert.

**Woorden die het model nooit heeft gezien.** Wanneer een forge-server sleutels noemt in
`meta.unseen_words`, waarschuwen de methoden `local` en `api` met de sleutels —
nooit de tekst of de woorden: *"<API batch N | Local method>: <n> sleutel(s) bevatten
woorden die het model nooit heeft gezien tijdens de training — hoogstwaarschijnlijk verkeerd
vertaald, hoe vloeiend ook; laat een spreker ze controleren: <up to 20 keys>"* (vervolgens *"en nog <n> meer"*).
De vertalingen worden alsnog geschreven; de waarschuwing is de manier waarop de gemeenschap weet welke
ze moeten controleren ([coaching](/docs/agents/coaching)).

**Opmerking.** Geef elke `warn`-regel door. Machinaal vertaalde tekenreeksen zijn concepten
totdat een spreker ze beoordeelt; noem ze nooit correct.

## `champollion serve`

Een andere server: deze serveert de eigen geconfigureerde vertaalstack van een
**app-project** (methode, coaching, vertaalgeheugen, kwaliteitsgate) aan
andere projecten. Standaardwaarden `127.0.0.1`, poort 1822. Er is een bearer-token
vereist, zelfs op loopback (`--token` of `CHAMPOLLION_SERVE_TOKEN`, minimaal 12
tekens), tenzij `--no-auth`, wat alleen wordt geaccepteerd bij een loopback-binding.
`--emit-manifest` schrijft een method/1-manifest van het type `service` voor afnemers.
De `/health` ervan is `{ok, service, version}`, niet het health-document van service-api/1,
waardoor `champollion connect` statusproblemen hiervoor rapporteert.

## Meer informatie

- [In gebruik nemen](/docs/put-it-to-work) — de versie voor de gemeenschap.
- [Methoden en gates](/docs/agents/methods) — method/1 en gate-chain/1.
- [Data- en transmissieregels](/docs/agents/data-rules) — local-only en
  `holders_agreed`.
- [Het rails-model](/docs/agents/rails-model) — de universele pijplijn.
- [`mt-eval`-referentie](/docs/reference/mt-eval) en
  [`nmt-forge`-referentie](/docs/network/getting-started/forge-command-reference).
- App- en sitevertaling: [CI/CD](/docs/guides/ci-cd),
  [probleemoplossing](/docs/guides/troubleshooting).
