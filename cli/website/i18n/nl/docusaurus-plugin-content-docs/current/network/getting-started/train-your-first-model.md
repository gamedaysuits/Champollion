---
sidebar_position: 3
title: "Train uw eerste model (met uw agent)"
description: "Een stapsgewijze handleiding voor het trainen van een MT-model met beperkte middelen door een coding agent aan te sturen — wat u zegt, wat forge doet, hoe een weigering eruitziet en hoe u de diagnose interpreteert."
related:
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Uw Eerste Model Trainen (met uw agent)

U hoeft niet te weten hoe u een neuraal machinevertaalmodel traint. U moet in staat zijn om **een codeeragent te vertellen wat u wilt** — Claude, of een Sonnet/Flash-klasse model, of een agent die shell-opdrachten kan uitvoeren. **nmt-forge**
is zo gebouwd dat de agent het *mechanisch* kan aansturen: bij elke stap vertelt het hulpmiddel de agent precies wat er vervolgens gedaan moet worden, en weigert — luidruchtig, met een oplossing — wanneer een stap uw resultaten zou kunnen beschadigen.

Deze pagina beschrijft de volledige cyclus. Elke stap is uitgeschreven als **wat u uw agent vertelt**, **wat forge doet**, **hoe een weigering eruitziet** (zodat geen van beiden in paniek raakt wanneer er een optreedt — een weigering betekent dat het hulpmiddel correct werkt), en, aan het einde, **hoe u het rapport leest**.

:::tip De ene regel voor uw agent
Vertel het: *"Voer altijd eerst `nmt-forge status --json` uit, en na elke stap.
Doe wat de `next_command` zegt."* Die ene gewoonte maakt van forge een
geleide rail. Als uw agent verbinding maakt via MCP, is dezelfde cyclus het
`forge_status` hulpmiddel — zie de [Agentgids](/docs/network/getting-started/agent-guide).
:::

---

## Stap 0 — Wijs uw agent op uw taal

**U zegt:** *"Ik wil een Engels→[uw taal] model trainen. Begin met het ontdekken wat forge erover weet. De ISO 639-3-code is `crk`"* (gebruik de code van uw taal).

**forge doet:** `nmt-forge discover crk` leest de taalkaart — schriften,
woordenboeken, morfologische analysatoren, bestaande corpora en evaluatiesets (met eventuele
`do_not_train` / quarantainevlaggen), en taalspecifieke beoordelingsstatistieken. Het plaatst
uw taal op de **asset-ladder**: (1) parallelle tekst → bewaakt trainen;
(2) + eentalig → getagde terugvertaling; (3) + woordenboek/grammatica → geciteerde
synthetische data; (4) + analysator → rondreis-geverifieerde synthese; (5) + een beoordelingsstatistiek
→ de eigen statistiek van de taal bij scoring en checkpointselectie.

**Een leeg veld betekent ONBEKEND, nooit nul.** Een schaarse kaart betekent niet "deze taal heeft niets" — het is mogelijk dat de bron nog niet geregistreerd is. U kunt altijd uw eigen parallelle corpus meebrengen.

Dan: *"Stel het project op."* → `nmt-forge init crk` schrijft een werkruimte, een
startconfiguratie en een `NEXT_STEPS` briefing.

---

## Stap 1 — Maak een splitsing die niet kan valsspelen

**U zegt:** *"Hier is mijn parallelle corpus `corpus.jsonl`. Splits het op in
train/dev/test en registreer de dev- en testsets."*

**forge doet:** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7
--out data/splits --register mypair`. Het maakt een **groep-disjuncte** splitsing: elk
tweetal zinsparen dat een bron *of* een doel deelt, belandt aan **dezelfde** kant.
Dit is de meest voorkomende manier waarop low-resource-scores worden opgeblazen — een leerboek
koppelt veel Engelse oefeningen aan één doelwoord, een naïeve willekeurige splitsing plaatst één kopie
in train en zijn tweelingbroer in test, en het model "vertaalt" antwoorden die het heeft gememoriseerd.

**Hoe een weigering eruitziet:** als u forge een zelf gemaakte splitsing aanlevert die niet disjunct is, crasht `verify-split` met de gedeelde sleutels vermeld — *"deze rijen delen een canoniek doel over train en test."* Oplossing: laat forge de splitsing uitvoeren.

---

## Stap 2 — Controleer op lekkage

**U zegt:** *"Controleer vóór het trainen het trainingskorpus op lekkage ten opzichte van de evaluatiesets."*

**forge doet:** `nmt-forge leak-audit corpus.jsonl`. Het controleert uw corpus
op elke geregistreerde dev/test/verzegelde set:

- **Exacte of bijna-duplicaat aan doelzijde** (het referentieantwoord bevindt zich in uw
  trainingsdata) → **fataal**. Dit is antwoordlekkage.
- **Bijna-duplicaat aan bronzijde met een *ander* antwoord** → **informatief,
  behouden**. Dezelfde prompt, een andere vertaling is een legitiem minimaal-contrastpaar, geen lekkage — forge rapporteert het maar verwijdert het nooit. (Dit onderscheid
  was een echte bug die we ontdekten door dogfooding: een eerdere versie markeerde 44 rijen
  als fataal terwijl slechts 17 echte lekken waren.)

**Hoe een weigering eruitziet:** *"rij 118: bijna-duplicaat aan doelzijde van testset
`mypair-test` (Jaccard 0,83) — antwoordlekkage."* Oplossing: uw agent voert
`nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` uit en traint op
de overgebleven rijen.

---

## Stap 3 — Voorspel voordat u kijkt

**U zegt:** *"Schrijf op wat we verwachten dat het model zal doen, dan gaan we trainen."*

**forge doet:** `nmt-forge prereg new p1 --eval-set mypair-test --predictions
predictions.md`. U (of uw agent, hardop) legt falsifieerbare voorspellingen vast —
welke statistiek, welke richting, hoe groot — **voordat** er een testscore bestaat.

**Hoe een weigering eruitziet:** als uw agent de testset probeert te scoren zonder
preregistratie, weigert `score`: *"het scoren van een testset wordt geweigerd zonder een
preregistratie die dateert van vóór de eerste scoringlezing."* Dit is wat een resultaat onderscheidt van resultaatgerichte storytelling. Oplossing: registreer eerst voor.

:::info Waarom dit aanvoelt als extra werk
Het ís het werk. Elke beveiliging hier is een fout die echte onderzoekers heeft misleid.
Het hulpmiddel maakt het eerlijke pad het gemakkelijke pad en het oneerlijke pad het pad dat
u tegenhoudt.
:::

---

## Stap 4 — Controleer de poorten, train dan

**U zegt:** *"Zal de trainingsrun alle controles doorstaan? Zo ja, train dan."*

**forge doet:** `nmt-forge preflight run` geeft een overzicht van elke poort die de run zal passeren —
dev-fence aanwezig, lekkage-audit schoon, planningsvloer afgeleid, decodeerruimte
gecontroleerd — elk met ✓ of ✗ en een oplossing. Wanneer alles groen is:
`nmt-forge run config.json`.

Trainen is de enige stap die **niet** een directe hulpmiddelaanroep is — het gebruikt een GPU en
duurt minuten tot uren. Uw agent voert het uit in een terminal en bekijkt de
`[schedule-sanity]` regels. forge leidt de vroeg-stoppen **vloer** af uit uw
datamix, zodat een synthetisch-zware run niet halverwege een epoch sterft wanneer het echte-dev-verlies schommelt (een echte faalwijze — zie
[Een Trainingsrun Diagnosticeren](/docs/network/getting-started/diagnosing-training)).

Wanneer het klaar is, heeft forge **een checkpoint geselecteerd op de afgeschermde devset** (nooit
op de testset) en een `run-manifest.json` geschreven.

---

## Stap 5 — Sluit de cyclus: evalueer en diagnosticeer

**U zegt:** *"Score het model op de testbatterij en vertel me wat ik moet verbeteren."*

**forge doet:** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config
config.json`. Dit **sluit de cyclus** in één opdracht: het decodeert de testbatterij met het checkpoint dat de run heeft geselecteerd, scoort het (prereg-beveiligd, met 95%-betrouwbaarheidsintervallen op elk getal), en voegt een begrijpelijke sectie **Diagnose & Aanbevelingen** toe. (Voordat deze opdracht bestond, moest u het checkpoint handmatig symlinken en een decoder met de hand uitvoeren — precies waar een beginner vastliep.)

### Het battery-lint-rapport lezen

Het rapport is een tabel van scores **per register** (leerboek, overheid, mondeling
verhaal, …), elk met het betrouwbaarheidsinterval, gevolgd door de diagnose. De
diagnose noemt uw **zwakste registers** en, voor elk, de meest waarschijnlijke oorzaak en
de **hendel** om aan te trekken:

| Als de diagnose zegt… | Het betekent… | De hendel |
|---|---|---|
| `R1-vocabulary-gap` | het register scoort laag **en** uitvoer is onafgemaakt; het model mist de woorden | **WOORDENSCHAT** — vergroot het lexicon, controleer dan de trechter opnieuw |
| `R2-structure-gap` | de woorden zijn bekend maar zinsstructuren *niet* | **STRUCTUUR** — voeg de ontbrekende constructies toe (sjablonen/compositor) |
| `R3-mixed-convention` | uitvoer mengt spellingen | **ORTHOGRAFIE** — normaliseer het corpus naar één conventie, train opnieuw |
| `R4-optimism-bound` | de "volledige" score is opgeblazen door bijna-identieke evaluatierijen | **METING** — citeer de strikte score voor generalisatie |
| `R5-low-power` | het betrouwbaarheidsinterval is breed | **METING** — handel niet op delta's kleiner dan het BI; vergroot de evaluatieset |
| `R7-transfer-plateau` | uitstekend op synthetisch, vastgelopen op echte tekst | **ECHTE-DATA** — terugvertaal eentalige data of verzamel echte parallelle zinnen |

Elke bevinding bevat het bewijs waarop het is gebaseerd. Voor de `--json` bevindingen kan
uw agent programmatisch handelen: `nmt-forge lint <battery-manifest.json>`.

---

## Wat u zojuist heeft gedaan

U heeft een model getraind waarvan u de score daadwerkelijk kunt vertrouwen: geen gelekte antwoorden, een checkpoint gekozen zonder naar de testset te kijken, foutmarges op elk getal, voorspellingen geschreven vóór de resultaten, en een diagnose die de volgende hendel benoemt in plaats van u te laten raden. Dat is het hele punt — **het eerlijke resultaat is de standaard, en er was geen MT-expertise voor nodig.**

Wanneer de cijfers tegenvallen (dat zullen ze, de eerste keer), ga naar
[Een Trainingsrun Diagnosticeren](/docs/network/getting-started/diagnosing-training) —
het is symptoomgericht, geschreven voor precies dat moment.
