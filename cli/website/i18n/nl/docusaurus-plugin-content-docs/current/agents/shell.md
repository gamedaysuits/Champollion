---
title: "De rails aansturen vanuit de shell"
slug: /agents/shell
description: "Elke rails-stap als een gewoon commando: installeren, een project starten, data importeren, de termen ervan vastleggen, een model trainen en testen met nmt-forge, de verbeteringsrondes uitvoeren, vertalen en serveren met mt-eval — plus de offlinemodus, de omgevingsvariabelen die de tools uitlezen en exitcodes."
---

# De rails besturen vanuit de shell

Elke stap op de rails is een gewone opdracht. Een agent zonder MCP — of een
persoon achter een terminal — doorloopt dezelfde rails met drie programma's:
`champollion`, `nmt-forge` en `mt-eval`. De volgorde hoeft nooit te worden
onthouden: `champollion next` noemt de volgende stap, met de bijbehorende modus en de
exacte opdracht, uitgelezen uit de bestanden van het project.

De regels zijn hetzelfde als via MCP. Een `confirm`-stap wordt pas uitgevoerd
nadat de persoon ja zegt; de antwoorden van een `ask_user`-stap zijn van hen
([het contract](/docs/agents/contract)).

## Installatie

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**Opmerking.** Beide downloaden pakketten: `confirm`-modus — vraag eerst om toestemming. Als `uv
--version` mislukt, installeert de persoon uv via https://docs.astral.sh/uv/;
een agent downloadt geen installatieprogramma's. Voor trainen is ook de training-extra
van forge vereist (PyTorch en Hugging Face transformers, enkele honderden MB). Forge vermeldt
dit wanneer het ontbreekt (status `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

De rails vereisen `nmt-forge` 0.3.0 of nieuwer; een oudere versie wordt vermeld met de
bijbehorende upgrade-opdracht (`uv tool install --upgrade --python 3.12 nmt-forge`).

## De lus

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

`How:` in de uitvoer voor mensen is de modus: `run it` (`auto`), `vraag eerst, voer het dan
uit` (`confirm`), `vraag het aan de persoon die de gegevens beheert — antwoord nooit voor
hen` (`ask_user`), `wacht, vraag dan opnieuw` (`wait`), `een persoon doet dit`
(`human_only`). Voer de genoemde opdracht uit en vraag het vervolgens opnieuw. Van de rails
afwijken is prima — voer een willekeurige expert-opdracht uit en daarna `champollion next`: de volgende stap
wordt uit de bestanden gelezen.

## Start

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

Talen zijn codes of namen, herleid via de taalkaarten. Een variëteit
zonder code krijgt een code voor privégebruik (`qaa`–`qtz`) en de naam die
haar gemeenschap eraan geeft (`--target-name`, `--source-name`). **Opmerking.** Bevestig de richting
voordat het project wordt aangemaakt: `--dry` herleidt beide talen en schrijft
niets weg. Geef elke taal exact door zoals de persoon deze heeft genoemd.

## Verzamelen en voorwaarden vastleggen

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` leest `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, Word-`.docx`-tabellen,
Toolbox- en LIFT-woordenboeken, ELAN-`.eaf` en USFM
(`--usfm-source`). Het schrijft `<stem>.tsv` en het bijbehorende sidecar-bestand, laat het origineel
onaangeroerd en toont aantallen, kolommen en de rijnummers die uit de controle van de
rijen naar voren komen (kopieën, herhalingen, afwijkende lengtes, verwisselde of verschoven rijen — er
wordt niets verwijderd) — nooit zinnen. Wanneer het niet kan bepalen welke kolom (of welke ELAN-laag,
op nummer, of LIFT-taal) welke is, weigert het en vraagt het om opheldering; vraag dit aan de
persoon. `--replace` leest hetzelfde origineel opnieuw met andere kolommen, met behoud van
de antwoorden van de rechthebbenden; `--name <stem>` voegt nog een bestand onder een andere naam toe.
Zie [dataregels](/docs/agents/data-rules#what-tools-print-and-never-print).

Vervolgens de voorwaarden, bestand voor bestand, op basis van de antwoorden van de persoon:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

`--local-only` of `--may-leave` is vereist voor een bestand dat nog niet uitsluitend lokaal is.
De voorwaardenstap van de journey vraagt naar elk bestand in `data/parallel/`,
`data/lexicon/`, `data/grammar/` en `data/monolingual/` totdat zowel het
trainingsantwoord als `--speakers-agreed` zijn vastgelegd. Elke waarde is aan de
rechthebbenden — zie [dataregels](/docs/agents/data-rules) voor wat elke waarde doet en
wat de opdracht weigert.

## De testset beschermen

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## Een model bouwen en testen

De journey noemt deze op volgorde (waarbij `{placeholders}` is ingevuld vanuit het
project):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` kiest op basis van het geheugen het sterkste model dat deze
  computer binnen enkele uren kan trainen ([training](/docs/agents/training#models)). Met een
  taalkaart blijft `--no-card --name` achterwege.
- `data combine` wordt alleen uitgevoerd wanneer `data/parallel/` meer dan één bestand bevat. Het
  hanteert de strengste voorwaarden van de bestanden die het samenvoegt en weigert een bestand
  waarvan de houders nog niet hebben geantwoord — of een model ervan mag leren en
  of iedereen wiens woorden erin staan heeft ingestemd.
- `prereg new` is een `ask_user`-stap: `--expect` en `--rationale` zijn de
  woorden van de mensen, precies zoals zij ze hebben uitgesproken, vastgelegd voordat er enige score bestaat.
  De vraag suggereert geen getal, en u doet dat evenmin.
- De dev-omvang die het traject invult (`dev_n`) is een op de tien van de gecontroleerde
  paren, minimaal 50 en maximaal 500; bij minder dan 200 paren is het in plaats daarvan een
  kwart daarvan, zodat de training het merendeel behoudt — en dat is minder dan 50.
  Dus: 40 dev-zinnen uit 160 paren, 50 uit 200 tot 500 paren, 160 uit
  1.600, 500 uit 5.000 of meer. Onder de 50 kan geen enkele ronde op de dev-set
  worden beoordeeld ([meting](/docs/agents/measurement#comparing-two-models)).
  `--near-dupe 0.6` houdt bijna-kopieën aan één kant; `--max-group` is de helft van de
  dev-omvang, naar beneden afgerond, plus één.
- `floor` is alleen van toepassing wanneer `data/lexicon/` een woordenlijst bevat.

Vanaf hier noemt de eigen advisor van forge elke stap. `champollion next` geeft dit door;
`nmt-forge status` zegt het direct:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

Trainen is `confirm` (het kost rekenkracht, van minuten tot uren); terwijl een losgekoppelde
run traint, is de stap `wait`. `nmt-forge run` weigert een run waarvoor de schijf onvoldoende
ruimte heeft voordat deze start (`[disk-room]`), met vermelding van de vrije ruimte, de schatting en
wat `nmt-forge tidy` zou vrijmaken; `nmt-forge tidy --yes` maakt dit vrij, en
`--skip-disk-check` op `run` start desondanks, wat in de run wordt vastgelegd. Die twee zijn
de keuze van de persoon, niet die van u ([training](/docs/agents/training#disk-space)).
De export scoort het model één keer op de testset, afgezet tegen de voorspelling.
Kiezen tussen meerdere exports is aan de persoon
(`nmt-forge choose <model folder>`). Na een testset-score beoordelen de mensen
hun voorspelling:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed` wanneer deze niet standhield; `--prediction` is het nummer van de voorspelling,
1 voor een enkele `--expect`; `--by` vermeldt wie het heeft beoordeeld, precies zoals zij zeiden.) Zie
[trainen](/docs/agents/training) voor elke forge-opdracht en weigering.

## De verbeteringsrondes

Zodra een model wordt geserveerd, beginnen de rondes:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: zolang de dev-set (oefenset) minder dan 200 zinnen telt, heeft
  een aantal rijen geen concept — één op de twee zolang het er minder dan 50 zijn,
  één op de vier vanaf 50 — en schrijft de spreker ze. `improve marks` schrijft
  ze naar `data/dev/` en `improve prepare` voegt ze toe aan de dev-set (`nmt-forge grow-dev`),
  nooit aan de trainingsdata. Het voert ook `nmt-forge draft-newer` uit. Wanneer er een
  ander model is — het nieuwste getrainde model wanneer het niet in gebruik is
  (niet in gebruik genomen na zijn ronde: te weinig om te beoordelen, geen meetbare
  verandering of slechter), of, na een promotie, het model dat vervangen is door het
  model dat in gebruik is — stelt dat model voor een willekeurige helft van de van een
  concept voorziene rijen een concept op, ongemarkeerd, en blijft de sleutel naast het
  werkblad liggen (`sheet-key.json`). `improve marks` telt elk model vervolgens apart —
  de blinde vergelijking, die na een promotie de controle is die het rapport
  nodig heeft voordat het een stijging echte vooruitgang noemt
  ([meting](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, vanaf ronde 2: één rij per 10 nieuwe zinnen
  (naar beneden afgerond) is een concept dat de spreker op een eerder
  werkblad als `Y` of `N` heeft gemarkeerd, ongemarkeerd teruggeplaatst
  op een willekeurige plek. De eerste regel van het werkblad vermeldt dat een paar
  rijen met opzet terugkomen, nooit welke; `sheet-key.json` somt ze op
  (`repeat_rows`). Het commando toont hoeveel er zijn teruggekomen, *"(welke,
  is niet gemarkeerd)"*, en dat ze *"ongeveer 10 seconden per rij kosten, er wordt
  nooit meer mee getraind"*.
- `improve marks` beoordeelt een opnieuw getoonde rij uitsluitend ten opzichte van
  de eerdere markering van de spreker — nooit in het aandeel van de ronde, de
  trainingsparen of de blinde vergelijking — schrijft `repeats` naar `marks.json`
  en toont *"Opnieuw getoonde rijen: de spreker markeerde A van de J zoals voorheen
  (P%) — W ooit fout nu goed, R ooit goed nu fout. Niet meegeteld in het aandeel
  van deze ronde en er wordt niet meer op getraind."*
- `improve marks`, wanneer het andere model het nieuwere is en de spreker
  van elk minstens één concept heeft beoordeeld, legt de tellingen vast met forge
  (alleen tellingen, nooit een zin):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  Wanneer de spreker het nieuwere model duidelijk vaker als juist heeft gemarkeerd, toont
  het *"forge heeft het vastgelegd: het biedt aan om het nieuwere model in gebruik te nemen (de
  mensen zeggen eerst ja)"*; wanneer forge niet is geïnstalleerd of weigert, meldt het
  dat de markeringen niet zijn vastgelegd, en waarom.
- `improve prepare` eindigt met `nmt-forge round-plan`: de ronde gaat verder
  vanuit het model in gebruik (4 doorgangen over alle zinnen tot nu toe) of traint
  vanaf het begin, en vermeldt waarom ([training](/docs/agents/training#the-improve-rounds)).

Forge beoordeelt het nieuwe model vervolgens ten opzichte van het model dat in gebruik is
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`), en stelt alleen voor om het in gebruik te nemen (`confirm`) als het meetbaar
beter is — of, waar er te weinig was om uitsluitsel te geven (minder dan 50 dev-zinnen)
of er geen meetbare verandering was, zodra de blinde beoordelingen van de spreker er duidelijk de
voorkeur aan gaven. Een oordeel alleen neemt niets in gebruik: alleen een 'ja' van de
mensen (de `nmt-forge export` en `nmt-forge choose` van die stap) doet dat. De nieuwe paren uit `improve marks` krijgen
eerst hun eigen termen — het traject vraagt erom. Hoe u het rapport overbrengt: [coaching](/docs/agents/coaching).

## Vertalen en serveren met mt-eval

`nmt-forge export` binnen een project schrijft `deploy/<name>.json` (deployment/1).
Hetzelfde bestand meet, vertaalt en serveert:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **Opmerking.** `mt-eval run` op een testbestand vereist geen voorafgaande registratie — het
  logt enkel het uitlezen. Scoor de testset via `nmt-forge export` (of nadat de
  voorspelling is vastgelegd), nooit ervoor.
- `--gates gates/<chain>.json` voegt een gate-keten toe aan `run`, `translate` of
  `serve` (zonder `--deployment`); `run` en `test` weigeren een keten die
  terugvalt. Zie [methoden en gates](/docs/agents/methods) en
  [serveren](/docs/agents/serving).

## Buiten de rails: wat er bestaat voor een taal

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## De bestanden controleren en upgraden

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## Offline

`CHAMPOLLION_OFFLINE=1` zorgt ervoor dat de `champollion`-CLI geen verbinding maakt met het netwerk:
taalkaarten zijn uitsluitend afkomstig uit de meegeleverde set en de lokale cache (een
longtail-kaart wordt niet opgehaald), de dagelijkse vernieuwing van de kaartcache wordt overgeslagen en
`register-corpus` vergelijkt de hash van een bestand niet met de openbare catalogus
(de vergelijking wordt geregistreerd als niet uitgevoerd). Het verandert niets aan wat een methode
verzendt: een methode die een provider aanroept heeft nog steeds het netwerk nodig, en de
overdrachtsregels blijven van kracht.

`MT_EVAL_NO_REMOTE_REGISTRY=1` voorkomt dat `mt-eval` het datasetregister
van het web ophaalt (voor een machine met een air gap).

Wat op de rails hoe dan ook het netwerk nodig heeft: het installeren van de tools, de
training-extra en de eerste download van een vooraf getraind model (`byt5-small` of
`byt5-small-lowmem`, ongeveer 1,2 GB; `cpu-tiny` downloadt niets).

## Omgevingsvariabelen

Gelezen door de code, voor een beheerder. API-sleutels van providers zijn alleen nodig
voor methoden die een provider aanroepen, nooit op het standaardpad van de rails.

| Variabele | Gelezen door | Effect |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | MCP-server | `rails` (standaard) of `full` |
| `CHAMPOLLION_CLI_BIN` | MCP-server | Het uit te voeren startpunt van `champollion` |
| `NMT_FORGE_BIN` | `champollion`, MCP-server | Het uitvoerbare bestand van `nmt-forge` |
| `UV_TOOL_BIN_DIR` | `champollion`, MCP-server | Waar na `PATH` naar `nmt-forge` en `uv` moet worden gezocht (standaard `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: geen netwerk voor kaarten of zoekacties in de catalogus |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | De kaartcache per gebruiker (standaard `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | Hoe vaak de kaartcache wordt gecontroleerd op updates (standaard 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | Zet de voorinstelling vast die `auto` kiest (moet de naam van een voorinstelling zijn) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | Standaardpoort (8378 zonder deze variabele) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | Het bearertoken; vereist buiten loopback |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: geen live trainingspaneel |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | Het bearertoken (nooit een waarde op de opdrachtregel) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | Het bearertoken voor de eigen server van de CLI |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: register niet ophalen |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | Waar paden van geregistreerde datasets als eerste worden herleid |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | De sleutel van de standaardprovider voor gehoste modellen |

## Uitvoer voor programma's

| Tool | Machine-uitvoer | Exitcodes |
|---|---|---|
| `champollion` | `--json` bij de rails-opdrachten (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 ok · 1 geweigerd · 2 gebruik |
| `nmt-forge` | `--json` bij elke subopdracht: één JSON-document op stdout, al het andere op stderr | 0 ok · 2 geweigerd (`{"error": …}`) |
| `mt-eval` | `--json` en `--non-interactive` bij elke subopdracht | 0 ok · ongelijk aan nul geweigerd |

Weigeringsvormen: [het railsmodel](/docs/agents/rails-model#refusal-shapes).

## Meer informatie

- [De opdrachtreferentie van `champollion`](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) en
  [`mt-eval`](/docs/reference/mt-eval).
- [Het railsmodel](/docs/agents/rails-model) — de journey en `next --json`.
- [De rails besturen via MCP](/docs/agents/mcp) — dezelfde stappen als zes tools.
- [Trainen met nmt-forge](/docs/agents/training) en
  [dataregels](/docs/agents/data-rules).
