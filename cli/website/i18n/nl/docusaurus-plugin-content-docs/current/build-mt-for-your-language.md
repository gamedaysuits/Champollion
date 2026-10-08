---
slug: /build-mt-for-your-language
title: "MT bouwen voor uw taal"
description: "Van ‘hoe beginnen we?’ tot een geteste vertaalworkflow: ontdek wat er bestaat, bescherm uw testset, meet de opties, bouw iets beters, bewijs het en rol het uit — met de exacte commando’s en MCP-tool calls voor elke stap."
---

# Automatische vertaling bouwen voor uw taal

Deze pagina leidt u van *"we willen vertaling voor onze taal — hoe beginnen
we?"* naar een vertaalworkflow die u **op uw eigen zinnen hebt gemeten** en in
gebruik hebt genomen. Deze is geschreven voor mensen en voor AI-agents: elke
stap bevat de uit te voeren opdracht en, waar deze bestaat, de
[MCP-tool](/docs/network/getting-started/mcp-server) die een agent in plaats daarvan aanroept.

Twee doorlopende voorbeelden:

- **Een school** wil Engels → Plains Cree voor haar nieuwsbrief en een kleine app.
  Docenten hebben enkele honderden zinnen gecontroleerd en willen deze privé houden.
- **Een ziekenhuis** wil Engels → een taal die nauwelijks door de index wordt gedekt,
  voor een taalgids aan het bed. De testzinnen bevatten klinische bewoordingen en
  mogen nooit naar een externe AI-dienst worden verzonden.

U eindigt met: een besloten testset, scores voor verschillende methoden daarop,
een betere methode (een begeleid model of een model dat u zelf hebt getraind),
en die methode geïmplementeerd via de CLI — waarbij elk getal herleidbaar is
naar de bron die het heeft geproduceerd.

:::info[Wat dit niet doet]
Niets hier maakt een vertaling correct. Scores vertellen u welke optie
*minder fout is op uw zinnen*; een vloeiende spreker beslist nog steeds wat
geschikt is voor gebruik. Lees [Eerlijke beperkingen](/docs/network/honest-limitations)
voordat u op welk getal dan ook vertrouwt.
:::

:::warning[Agents: voordat u bestanden van de gebruiker opent]
Als een testset mogelijk privé is (gecontroleerd door docenten, gecontroleerd
door verpleegkundigen, of iets wat een gemeenschap niet heeft gepubliceerd),
lees deze dan niet — geen `cat`, `head` of voorvertoning, zelfs
niet om het formaat ervan te zien. Wat u leest, gaat naar uw modelprovider. Vraag
het aan de gebruiker en markeer het eerst als local-only ([stap 2](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. Installatie

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

Voeg voor een agent de MCP-server toe aan de configuratie:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. Onderzoek wat er bestaat

Wat er al bekend is over de taal — woordenboeken, grammatica's, corpora,
analysers (FST's), modellen, gepubliceerde resultaten, diensten — en waar
elk feit vandaan komt.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agent:** `search_languages { "query": "Atya" }` vindt de code, zelfs bij een
spelfout (dichtstbijzijnde namen op basis van bewerkingsafstand). Elk resultaat
toont alleen waar de taal wordt gesproken als de kaart daar een bron voor citeert,
en toont die bron, zodat de gebruiker kan kiezen tussen talen met vergelijkbare
namen. Een locatie zonder bron wordt nooit getoond: de regel vermeldt dit en
linkt in plaats daarvan naar het Glottolog-record van de taal, waar de kandidaten
bij de bron kunnen worden vergeleken. Bij een npm-installatie wordt een taal buiten
de gebundelde kernset aangevuld vanuit de gepubliceerde kaarttabellen van
champollion.dev, die nog geen bronnen per veld bevatten (deze volgen bij de
volgende upload van de tabellen), waardoor de regel een Glottolog-link heeft in
plaats van een locatie. Wanneer het getoonde geen uitsluitsel geeft tussen de
kandidaten, beslissen de sprekers (hieronder). Vervolgens biedt `language_overview { "code": "<code>" }` één
pagina: wat er bestaat, welke benchmarks en resultaten er zijn, en genummerde
volgende stappen. Elke tool die één taal accepteert, accepteert deze ook als `language`.

Lees de kaart zoals deze is geschreven: **afwezigheid betekent onbekend, niet nul.**
Een kaart die geen woordenboek vermeldt, betekent dat de index er geen heeft
geregistreerd — niet dat er geen bestaat. Waar bronnen elkaar tegenspreken
(bij sprekersaantallen is dat vaak het geval), toont de kaart ze allemaal.

Als uw taal helemaal geen kaart heeft, kunt u nog steeds alles hieronder doen;
de tools weten er simpelweg minder over (`nmt-forge init <code> --no-card --name <name>`
start hoe dan ook een trainingsproject).

### Wanneer de variëteit nog niet is bevestigd

Een naam kan op meerdere talen slaan. "Ayta" komt bijvoorbeeld overeen met zes
Ayta-talen in de Filipijnen, elk met een eigen code. **Vraag het eerst aan de
sprekers.** De gemeenschap weet welke variëteit zij spreekt, en een code die
voor hen wordt gekozen is een bewering over hen.

Als u moet beginnen voordat zij kunnen antwoorden, gebruik dan een code voor
privégebruik (private-use code): ISO 639 reserveert `qaa` tot en met
`qtz` voor precies dit doel. Geef het een weergavenaam, zodat prompts
en rapporten de taal bij naam noemen:

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

wat het volgende schrijft in `champollion.config.json`:

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` meldt dat de code een code voor privégebruik is zonder taalkaart (u
wordt niet gevraagd de spelling te controleren).

`init`, `sync`, `verify` en `network register-corpus` accepteren
allemaal een code voor privégebruik. Wat dit u kost, totdat de echte code deze vervangt:

- **Geen kaartfeiten.** Geen register-voorinstellingen, meervoudsregels of schrift
  vanuit een taalkaart. Synchronisatie gebruikt generieke instellingen, dus controleer
  de eerste resultaten met een spreker.
- **Geen FST.** Er is geen morfologische analyser gekoppeld aan een code voor
  privégebruik, dus er wordt niets woord voor woord gecontroleerd.
- **Geen eerdere resultaten.** Gepubliceerde benchmarks en de wachtrij zijn
  geïndexeerd op echte codes, waardoor `recommend` en `corpora` hiervoor
  niets kunnen tonen.

Wanneer de gemeenschap de variëteit bevestigt, schakelt u over naar de bijbehorende code:

1. Vervang in `champollion.config.json` `qaa` door de code (en verwijder de
   `name` als de naam op de kaart passend is).
2. Hernoem de localebestanden (`messages/qaa.json` → `messages/ayt.json`). De
   vertalingen blijven geldig: de volgende `champollion sync` behoudt ze en
   vertaalt alleen wat nieuw is.
3. Registreer de testset opnieuw onder het echte paar:
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`.
   De opdracht toont de mee te geven `--id`, omdat een geregistreerd
   bestand zijn id behoudt tenzij u een nieuwe kiest. (`--pair` accepteert
   hier en in `nmt-forge init` `eng-ayt` of `"eng>ayt"`; plaats de
   `>`-vorm tussen aanhalingstekens, omdat een shell een losse
   `>` leest als "schrijf naar een bestand".)

## 2. Verzamel uw gegevens — en bescherm uw testset

**Houd de testset eerst apart.** Zet de zinnen waarop u alles zult beoordelen
(degene die zijn gecontroleerd door docenten of verpleegkundigen) apart
voordat u iets traint of afstelt, en train er nooit op.

Een testset is een TSV-bestand: één zinnenpaar per regel, bron, een TAB, en
vervolgens de referentievertaling. Regels die beginnen met `# ` zijn opmerkingen.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

Bepaal vervolgens hoe ver deze gegevens mogen reizen:

| U wilt… | Doe dit |
|---|---|
| Niets verlaat deze machine — geen enkele externe AI-dienst mag deze zinnen ooit zien | Plaats een markeringsbestand ernaast (hieronder). Alleen een model op uw eigen machine kan ermee worden getest. |
| Anderen kunnen zien dat de testset bestaat, maar nooit de inhoud ervan | `champollion network register-corpus --tier private --role test …` registreert uitsluitend metadata |
| Een wedstrijd ermee, uitgevoerd op een machine die u beheert, mogelijk 'air-gapped' | `--tier sealed` plus de [soevereine node](/docs/network/sovereignty/sovereign-eval-node) |
| Deze is openbaar en heeft een open licentie | `--tier public` verwijst naar de locatie ervan; wij hosten deze nog steeds nooit |

De markering voor "verlaat deze machine nooit":

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Zodra deze is geplaatst, weigert `mt-eval run` elke externe provider voor dat
bestand en draait uitsluitend tegen een model op loopback. Details:
[Corpora registreren](/docs/network/sovereignty/registering-corpora).

**Welk licentie-id.** Registratie vraagt om `--license`: de voorwaarden die de
eigenaren van de gegevens daadwerkelijk verlenen, nooit een tijdelijke aanduiding.
Vraag het aan hen en kies vervolgens het id dat dit weergeeft: een SPDX-id als
ze de tekst al onder een dergelijke licentie publiceren;
`community-eval-grant-nc` voor "uitsluitend om systemen te scoren, nooit trainen, nooit
delen, geen betaalde scoring"; `community-eval-grant` voor hetzelfde met betaalde
scoring toegestaan; `proprietary` voor alle rechten voorbehouden; of
`LicenseRef-<name>` voor eigen voorwaarden. De laatste vier zijn `LicenseRef-…`-id's,
op maat gemaakte toekenningen: evaluatie op afstand hiermee wordt geweigerd totdat
de beheerder toestemming vastlegt. Totdat de beheerder
bevestigt, legt u uw keuze vast als voorlopig. Local-only blijft lokaal, ongeacht
de licentie: de markering, niet de licentie, bepaalt waar de zinnen naartoe gaan.
[Welk licentie-id voor een besloten testset](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set).

**Agents: lees een local-only testbestand niet.** Geen `cat`, `head` of het
openen om even te kijken. Wat u leest, gaat naar uw modelprovider, en dat is
juist de plek waar deze zinnen volgens de markering niet naartoe mogen. Het is ook
niet nodig: de tools houden de zinnen buiten wat ze afdrukken (`mt-eval compare` toont
in plaats daarvan invoer-id's en scores), en `--show-text` is er alleen voor een
persoon aan de terminal.

**Agent:** `language_overview { "code": "<code>" }` geeft een overzicht van de beveiligingskeuzes voor de taal;
`run_benchmark` respecteert de markering en retourneert een weigering (met de reden)
in plaats van beschermde zinnen te verzenden.

### Als u later mogelijk een model traint: registreer, screen, voorspel — vóór elke score

Doe deze drie dingen nu, in deze volgorde, voordat stap 3 iets meet op
de testset. Forge telt elke blik op een testset, en een benchmark (stap 3)
is een scoring-leesactie: een preregistratie die daarna wordt geschreven, wordt
geweigerd. De volgorde is van belang; het later doen is niet hetzelfde.

1. **Registreer de testset bij NMT Forge.** Het logboek van leesacties begint hier,
   zodat elke latere leesactie wordt geteld (een scoring-leesactie vóór registratie
   wordt wel vermeld, maar niet meegeteld).
2. **Screen uw trainingscorpus hierop** (`leak-audit`). Dit leest de
   testset voor een audit, nooit voor een score, dus het telt niet mee tegen
   uw voorspellingen. Lees het oordeel: als de meeste testrijen een bijna-duplicaat
   (near-twin) in uw corpus hebben, scoort een model dat op alle data is getraind
   op het reproduceren van trainingszinnen, niet op vertaling. U traint dan meestal
   twee modellen: één op alle data en één duplicaatvrij model (`--drop-test-twins`
   schrijft het corpus en de configuratie ervan, `config-notwins.json`).
3. **Noteer wat u verwacht, één preregistratie per model dat u van plan bent te
   trainen**, vernoemd naar het model. Deze voorspellingen zijn de maatstaf
   waartegen de testscores later worden beoordeeld: export beoordeelt elk model
   ten opzichte van het model dat u noemt met `--prereg <id>` (bij twee modellen op
   één testset weigert het te gokken). U kunt een voorspelling in plaats daarvan
   vastpinnen aan de configuratie van het model met `--config-hash <hash>`, de volledige hash
   die `nmt-forge preflight run --config config-notwins.json` afdrukt. Elke latere bewerking van die configuratie (bijvoorbeeld
   een tijdsbudget) verandert de hash en verbreekt de koppeling, dus het noemen van
   de preregistratie bij de export is de eenvoudigere weg.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

Als het oordeel SEVERE was, voeg dan het duplicaatvrije model en de bijbehorende voorspellingen toe (in `school-crk/`):

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

Het duplicaatvrije corpus krijgt een eigen bestand. `corpus.clean.jsonl` blijft het
corpus met alle data: leak-audit weigert een bestand te overschrijven dat door
een configuratie, een run of een split wordt gelezen, of dat door een andere audit
is geschreven (`--overwrite` vervangt er bewust één). Het `--json`-antwoord
vermeldt de eerste paar rijnummers van elke lijst; het `.audit.json`-bestand
naast het opgeschoonde corpus bewaart ze allemaal.

`--allow-after-reads` bestaat alleen voor voorspellingen die werkelijk vóór de
leesacties zijn opgeschreven (bijvoorbeeld op papier). Dit wordt vastgelegd, en elk rapport,
export and DEPLOY.md then says the predictions came after the scores.

**Agent:** `forge_init { "code": "<code>", "dir": "<dir>" }`, vervolgens
`forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`,
`forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }`
(paden worden gelezen uit `project_dir`, aangezien de bovenstaande opdrachten
vanuit het project worden uitgevoerd; een absoluut pad werkt overal),
vervolgens `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }`
met de gebruiker, één per model, elk vernoemd naar het model (`forge_export`
neemt dat id vervolgens als `prereg`; `config_hash` op `forge_prereg` pint er
in plaats daarvan één vast aan de configuratie). `forge_status` noemt deze stap zodra een
testset is geregistreerd. Stap 4 traint in hetzelfde project.
`language_overview` geeft deze stappen ook in deze volgorde weer.

## 3. Meet de opties

Voer elke kandidaat uit tegen **uw** testset (eerst geregistreerd, gescreend
en gepreregistreerd met forge, als u later mogelijk gaat trainen —
[stap 2](#2-gather-your-data--and-protect-your-test-set)). Het testkader (harness) scoort
elke kandidaat op dezelfde manier, zoals gebruikelijk is bij MT-evaluatie: de
belangrijkste maatstaf is corpus-chrF++ met het bijbehorende 95%-betrouwbaarheidsinterval,
met daarnaast BLEU, spBLEU en TER (nooit samengevoegd tot één getal). Exacte
overeenkomsten en gedragscontroles (uitvoer in het verkeerde schrift, signalen van
hallucinatie) worden gerapporteerd als diagnostiek, samen met kosten en snelheid.
Waar het testkader een morfologische analyser heeft vastgepind voor de taal, voegt
het FST-acceptatie en morfologische nauwkeurigheid toe als diagnostiek;
`mt-eval setup --status` vermeldt die talen, en `mt-eval setup --comet`
voegt COMET toe waar van toepassing.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` geeft aan of een verschil reëel is of binnen de ruis valt (paired
approximate randomization). Een verschil binnen de betrouwbaarheidsintervallen is
geen rangschikking. Het schrijft `comparison-<hash>.json`, genoemd naar de runs die het
vergelijkt, naast de rapporten wanneer ze een map delen, of in een
bovenliggende map `comparisons/` wanneer dat niet zo is, en nooit in de eigen
map van een run. Een andere vergelijking overschrijft dit nooit.

**Evaluatiepakketten.** Sommige talen declareren extra tools die hun metrieken
nodig hebben (voor Plains Cree een morfologische analyser). De eerste
`mt-eval run` noemt wat er ontbreekt. Een ontbrekende analyser stopt de run
nooit: FST-acceptatie wordt gemarkeerd als niet berekend, `mt-eval setup --lang crk` installeert
deze (eenmalig per machine), en `mt-eval test <run log>` voegt vervolgens de score toe
zonder opnieuw te vertalen.

**Agent:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`;
`get_run_status { "job_id": "<id>" }` retourneert de scores. Er wordt niets gepubliceerd,
tenzij u `publish: true` meegeeft. Een code als `target_language` wordt benoemd vanuit
de bijbehorende taalkaart ("Plains Cree") voordat deze de prompt bereikt, en het plan
toont de prompt die het model zal ontvangen. Een coachingbestand vervangt die prompt,
en het plan vermeldt dat. Wanneer de kaart twee schriften vermeldt en u geen
`script` meegeeft, leest het plan welk schrift de referenties gebruiken
(letters geteld op uw machine, zonder zinnen te tonen) en vraagt om dat schrift.
De rapporten komen naast het testbestand terecht, in `data/results/mcp-run-<id>/`, met de
vertaalcache van het testkader in `data/results/cache/`. `get_run_status` toont de
opdracht `mt-eval compare` ervoor, en voor runs op een geregistreerd corpus-id
vermeldt het de rapporten op pad. Een `local-model`-plan vermeldt eerst
hoeveel het bevestigen downloadt en waarheen.

**Welke metriek te vertrouwen is**, hangt af van de taal:
`get_metric_reliability { "language": "<code>" }` (MCP) rapporteert of er ooit een automatische metriek
is gevalideerd tegen menselijke oordelen voor die taal. Voor de meeste
laag-resourcetalen is dat niet het geval, dus chrF++ is de conventie — beschouw
het als een vergelijking tussen methoden op dezelfde testset, niet als een schoolcijfer.

## 4. Iets beters bouwen

Twee routes. Meet beide op dezelfde manier als in stap 3.

**Begeleid een algemeen model.** Geef het een woordenlijst en instructies, en
voer stap 3 opnieuw uit met de coaching:

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` accepteert Markdown, platte tekst of JSON; de volledige tekst
van het bestand vormt de instructies voor het model, verzonden zoals geschreven.

Om terminologie te scoren (komt elke vermelde term overeen met de vereiste
vertaling?), geeft u elke run die u vergelijkt dezelfde termenlijst mee met
`--glossary terms.json` (`{"blood pressure": "…"}`, of een lijst van geaccepteerde
vormen per term). De woordenlijst wordt alleen gebruikt voor de scoring; deze
wordt nooit naar het model verzonden, zodat een reguliere run en een begeleide run
op dezelfde termen worden gescoord.
Zonder `--glossary` wordt in plaats daarvan de `dictionary` van een JSON-coachingbestand
(de structuur van [begeleide prompting](/docs/network/tutorials/coached-llm-prompting):
`grammar_rules`, `dictionary`, `style_notes`) gebruikt. In
dat geval wordt de run gescoord tegen zijn eigen coaching, en dat wordt in de uitvoer
vermeld. Een Markdown-coachingbestand begeleidt op dezelfde manier, maar levert geen woordenlijst.

Zie [begeleide prompting](/docs/network/tutorials/coached-llm-prompting) en
[woordenboek-verrijkte prompting](/docs/network/tutorials/dictionary-augmented-llm).

**Train uw eigen model** met NMT Forge, dat fouten weigert die resultaten met
weinig data er beter uit laten zien dan ze zijn (gelekte testzinnen, slechte
splitsingen, het checkpoint kiezen op de testset, ruis aanzien voor vooruitgang):

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` voert de controles uit die `run` vóór de training uitvoert — de dev-set,
de lek-audit van elk trainingsbestand, de decodeerlengte — zodat een run die
hierdoorheen komt niet bij de start weigert. `config.json` leest de split uit
`data/split/`; een elders geschreven split geeft aan welke regels moeten worden gewijzigd.

Trainingsparen gaan in een TSV zoals de testset (of JSONL met `source` en
`target`); `leak-audit` (stap 2) heeft alle paren verwijderd die de testset
zouden laten lekken naar de training en gaf bij elk uitleg. Twee modellen? Voer na
de split de duplicaatvrije leak-audit uit stap 2 opnieuw uit (omdat de dev-set is
geregistreerd, verlaten de rijen daarvan ook het duplicaatvrije bestand), vervolgens `nmt-forge run config-notwins.json` en
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
de volgende opdracht op elk gewenst moment. Het standaardmodel
traint binnen enkele minuten op een CPU; verwacht bij 1.000–2.000 zinnenparen een chrF++
van rond de 5–30 — het leert de zinsneden en patronen van uw data, niet de
taal in het algemeen. `export` scoort de testset één keer en schrijft een mt-eval-rapport,
zodat het getrainde model kan worden vergeleken met alles uit stap 3. Volledige
handleiding: [Train uw eerste model](/docs/network/getting-started/train-your-first-model).

**Agent:** `forge_status { "project_dir": "<dir>" }` eerst en na elke
stap; na `forge_init`, `forge_register_eval`, `forge_leak_audit`
en `forge_prereg` van stap 2: `forge_split { corpus, test, seed, out }`,
`forge_preflight { "target": "run" }`, vervolgens — na `nmt-forge run` in een
terminal — `forge_export { run_manifest, out, prereg }`. Roep
`get_training_guardrails` eenmaal aan vóór `forge_split`: dit toont elke regel
die forge afdwingt en de fout die de regel voorkomt. `forge_split`'s
`register` accepteert een voorvoegsel of `true` (`project`), en `out` staat standaard op
`data/split`. Elke forge-tool na
`forge_init` accepteert het geretourneerde `project_dir`. `get_training_guardrails`
(optioneel `topic`) legt elke regel uit. Elk argument van elke tool:
[MCP-server](/docs/network/getting-started/mcp-server#arguments).

## 5. Bewijs het — besloten of in de openbaarheid

Uw scores zijn van u. Er wordt niets gepubliceerd tenzij u daar zelf voor kiest.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

Een besloten of local-only testset uploadt nooit zijn zinnen; `--dry-run`
bevestigt dit regel voor regel. Om anderen mee te laten dingen op uw testset zonder
deze ooit te zien, organiseert u een wedstrijd op een machine die u beheert: deelnemers
dragen hun methode over, deze draait op uw node, en alleen scores verlaten de machine.
Nieuwe wedstrijden verbergen alle scores totdat de wedstrijd sluit, zodat niemand kan
afstemmen op uw testset.
Zie [Een soevereine wedstrijd organiseren](/docs/network/sovereignty/run-a-sovereign-contest).
Om een model dat u hebt getraind in te zenden voor de wedstrijd van iemand anders, noemt
`DEPLOY.md` §6 in de export de bestanden die de inzending vormen en de exacte
opdracht `mt-eval contest submit-model`.

**Agent:** `list_contests { "language": "<code>" }`, `get_contest { id }`;
`get_results { "target_language": "<code>" }` en `get_run_card { id }` voor
het openbare scorebord.

## 6. Combineer het beste

**Kies eerst uit uw eigen metingen.** Alles wat u op uw testset hebt gescoord,
is een mt-eval-rapport: de baselines en begeleide runs uit stap 3 en 4 en
de export van elk getraind model (`evaluation/runlog_report.json` in de
export folder). A terminal run with `-o results` writes to
`results/*_report.json`; een run gestart met MCP `run_benchmark` schrijft
naast het testbestand, in `data/results/mcp-run-<id>/`). Vergelijk ze allemaal tegelijk —
het eerste glob-patroon voor terminal-runs, het tweede voor agent-runs (gebruik
het patroon dat overeenkomt met uw runs; zsh stopt bij een glob die met niets overeenkomt):

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

Een verschil binnen de betrouwbaarheidsintervallen is geen rangschikking, en een
getraind model waarvan de testrijen bijna-duplicaten in de trainingsdata hebben,
scoorde op reproductie: vermeld het duplicaatvrije getal ernaast (DEPLOY.md en
`nmt-forge report` geven aan welk getal), samen met eventuele **scorewaarschuwingen** (score caveats)
die mt-eval bij dat getal heeft geplaatst. Een waarschuwing voor *bijna-constante uitvoer* (een van
enkele zinnen die aan veel verschillende testzinnen wordt toegekend) betekent dat de uitvoer de
invoer niet volgt, ongeacht de score; forge toont dit naast de score in `export`,
`DEPLOY.md`, `status`, `report`, `compare` en `lint`. Bij meerdere geëxporteerde modellen
geeft `nmt-forge status` elk model weer met de score, de duplicaatvrije score en de waarschuwing,
en vraagt u te kiezen welk model u wilt implementeren. Leg de keuze vast met
`nmt-forge choose <export>/model` (of `nmt-forge serve <export>/model
--choose`). Het serveren van een model om het uit te proberen wordt geregistreerd als 'geserveerd',
niet als uw keuze, waardoor `status` blijft vragen totdat u kiest.

**Agent:** `forge_status { "project_dir": "<dir>" }` — toon de gebruiker
in de status `choose-export` `result.advice.exports`, de score van elke export
met diens `score_caveats`, en vraag welk model geïmplementeerd moet worden; het antwoord van de gebruiker wordt vastgelegd met `nmt-forge choose` in een
terminal. Een voorlopige serve beantwoordt de vraag niet. `forge_compare { eval_set, hyps_a, hyps_b }` voert een A/B-vergelijking uit tussen twee
forge-modellen met de near-twin-waarschuwing van elk model en de mt-eval-scorewaarschuwingen naast de winnaar;
het hypothesebestand van elk model is het `hypotheses`-pad dat `forge_export` retourneert
(`<export>/evaluation/battery-hyps.jsonl`).

Kijk vervolgens verder dan uw eigen runs. Verschillende methoden leveren de beste resultaten op voor verschillende paren
en verschillende soorten tekst. Het [Netwerk](/docs/network/) geeft een overzicht van de
methoden en diensten die bestaan en het bewijs voor elk — wat er is
gepubliceerd, niet wat u hebt gemeten:

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

Een methode die op het scorebord is gepubliceerd met de bijbehorende configuratie kan exact
zo worden geïnstalleerd als deze is gescoord: `champollion network leaderboard --install <method>
--apply` voegt deze toe aan uw project voor dat paar. De CLI configureert een methode
**per taalpaar**, zodat het Cree van de nieuwsbrief
uw getrainde model kan gebruiken terwijl het Frans een gehost model gebruikt. Het ketenen van
methoden (bijv. een model gevolgd door een controlemechanisme) wordt behandeld in
[geketende modellen](/docs/network/tutorials/chained-models).

## 7. Neem het in gebruik

Implementeer de methode die u hebt gemeten — geen andere.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Terwijl het actief is, meldt `nmt-forge status` `serving` (het controleert of de server
nog steeds antwoordt); nadat de server stopt, noemt het opnieuw de opdracht `serve`,
op dezelfde poort.

Of stel voor een begeleid gehost model het taalpaar in
`champollion.config.json` in. In beide gevallen:

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**Wat uw eigen model nog niet kan.** Een klein model dat op enkele
duizenden zinnen is getraind, leert de specifieke frasen daarvan. Het beschadigt vaak tijdelijke aanduidingen (placeholders)
(`{name}`), meervoudsvormen en opmaak, of verandert een kort label zoals "Home" in
een zin. De kwaliteitscontrole weigert die uitvoer; er wordt niets beschadigds
weggeschreven. Geef het paar een **fallback**, en die tekenreeksen gaan naar een tweede
methode binnen dezelfde synchronisatie:

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

Als er geen tekst van uw machines mag vertrekken, stel de fallback dan in op een model dat u daar
ook draait: `"fallback": { "method": "local", "model": "<your local model>" }` verzendt
naar een OpenAI-compatibele server op deze machine (Ollama, llama.cpp, vLLM), tegen
$0 API-kosten. Een gehost model is meestal de sterkere second opinion; gebruik dit
wanneer de tekst naar de provider ervan mag worden verzonden.

Uw model vertaalt alles wat het kan. De fallback ontvangt alleen wat de kwaliteitscontrole
daarvan heeft geweigerd, en de Markdown-blokken die het heeft weggelaten of beschadigd, en de
uitvoer ervan passeert dezelfde controle. `sync` toont een `[FALLBACK]`-regel per paar met
de aantallen, en `champollion verify` geeft een overzicht van alles wat geen van beide methoden kon
vertalen. Zie [Fallback-methode](/docs/getting-started/configuration#fallback).

Om het eenmalig anders aan te pakken, vertaalt u alleen die tekenreeksen op een andere manier:

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…of handmatig, of via een beoordelaar met `champollion xliff export`. En neem
de eigen tekenreeksen van de app op in uw testset: een model dat goed scoort op zinnen
van docenten kan het nog steeds mis hebben bij "Waar doet het pijn?".

**Schriftsystemen.** Als de taal in meer dan één schrift wordt geschreven
(Plains Cree: Standard Roman Orthography en syllabics), vraagt de CLI u te
kiezen voordat er wordt vertaald. Stel `"script"` voor die taal in de configuratie in;
het bericht geeft de opties weer.

Het vertaalgeheugen zorgt ervoor dat voor een ongewijzigde zin nooit twee keer wordt betaald,
en overstappen op een ander model vertaalt niet alles opnieuw. Koppel het aan CI met
de [CI/CD-gids](/docs/guides/ci-cd). `export/model/DEPLOY.md` (uit stap 4) bevat
de exacte configuratie voor een getraind model, inclusief de `api`-methode en
hoe u dit veilig op een netwerk beschikbaar stelt.

**Agent:** `translate { texts, source_language, target_language }` voert
tekenreeksen door dezelfde pipeline. Voeg `method: "local"` en `base_url`, of
`method: "api"` en `endpoint` toe voor een model dat u zelf serveert, en `script`
voor een taal die in meer dan één schrift wordt geschreven.

## Beslissingen onderweg

| Beslissing | Kies… | Wanneer |
|---|---|---|
| Waar de testset zich bevindt | local-only | Deze gevoelig is, of u het de auteurs nog niet hebt gevraagd |
| | private / sealed | U wilt dat anderen weten dat deze bestaat, of ermee kunnen concurreren, zonder deze te zien |
| Begeleiden of trainen | Begeleid een gehost model | U hebt een woordenlijst en weinig parallelle tekst, en externe diensten zijn acceptabel |
| | Train met forge | U hebt een paar duizend paren of meer, of de data moet op uw machines blijven |
| Publiceren | Alleen scores | Standaard voor alles wat u niet zelf hebt geschreven |
| | Niets | Altijd toegestaan — meten is ook privé nuttig |

## Wat het kost

- De tools zijn gratis voor niet-commercieel gebruik: een school, een openbaar
  ziekenhuis of kliniek, een goed doel of een onderzoeksproject valt hieronder
  (de CLI, nmt-forge en de MCP-server vallen onder PolyForm Noncommercial 1.0.0;
  het evaluatie-testkader is open source, AGPL-3.0-or-later). [Wie dit mag gebruiken](/docs/getting-started/who-may-use-this).
- Een gehost model kost wat de provider ervan in rekening brengt; `--max-cost` stopt een run
  voordat deze meer verbruikt dan u toestaat, en het rapport toont de kosten per
  zin. Een lokaal model kost niets behalve de rekentijd van uw machine.
- Het trainen van het standaard forge-model vereist een CPU en enkele minuten; grotere
  voorinstellingen vereisen een GPU.
