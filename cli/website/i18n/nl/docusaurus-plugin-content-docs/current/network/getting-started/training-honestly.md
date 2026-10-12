---
sidebar_position: 2
title: "Train een Model Eerlijk (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# Een Model Eerlijk Trainen (nmt-forge)

**De versie in 30 seconden:** de meeste MT-"verbeteringen" voor talen met weinig bronnen houden bij nader onderzoek geen stand — de testset is gelekt naar de trainingsset, de testset heeft het checkpoint gekozen, of de winst was ruis zonder foutmarges. **nmt-forge** is een trainingssuite die deze fouten structureel bemoeilijkt: de standaardtravaux doen het juiste, en onjuiste paden weigeren dienst met een melding die uitlegt *wat* er is gebeurd, *waarom* het de resultaten corrumpeert en wat de exacte *oplossing* is. Het verzorgt de training; de [evaluatie-harness](/docs/network/specifications/harness) berekent de scores. Elke guard erin mechaniseert een fout die we daadwerkelijk hebben gemaakt, gemeten en gedocumenteerd tijdens het bouwen van de vertaling voor Plains Cree. Het kan worden geïnstalleerd met `python3 -m pip install 'nmt-forge[hf]'`, en het standaardmodel traint gewoon op de CPU van een laptop.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

Dat is de hele persoonlijkheid van de suite in één weigering.

## Het vijf-minutenverhaal

Dit is de fout waaruit de suite is ontstaan. Een Cree-leerboek koppelt veel Engelse oefeningen aan één doelzin: *"Feed him"* en *"Feed her"* vertalen beide naar `asam`. Een standaard willekeurige splitsing plaatste één kopie in de training en de tegenhanger in de testset — zodat het model letterlijk 17 van de 54 "test"-antwoorden al had gezien, en die rijen scoorden 83 chrF++ tegenover 44 voor schone rijen. Alles wat daarop volgde (het "kampioen"-model, de bevindingen die erop waren gebaseerd) moest worden weggegooid.

De splitter van nmt-forge maakt dat onmogelijk **door constructie**: paren die een bron *of* een doel delen worden gegroepeerd, hele groepen landen aan één kant, en een verificatie zonder overlap wordt uitgevoerd na elke splitsing:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(Als uw testset al een afzonderlijk, geregistreerd bestand is — een door docenten gecontroleerde set die u privé houdt — splitst `--test 0` alleen train en dev af.)

Elke andere guard heeft dezelfde opzet — een reële fout, mechanisch geëlimineerd.
Samen vormen ze de **trainings-guardrails**: lees ze voordat u splitst
(`nmt-forge init` en `nmt-forge status` verwijzen hiernaar bij die stap; agents ontvangen
dezelfde regels, inclusief de gemeten fout erachter, via de MCP-tool
`get_training_guardrails`).

| guard | de fout die ermee wordt geëlimineerd |
|---|---|
| **split-guard** | testantwoorden die verborgen zitten in trainingsdata via gedeelde bronnen/doelen |
| **dev-fence** | de testset die uw checkpoint kiest (training weigert te starten zonder een geregistreerde dev-set) |
| **leak-audit** | trainen op evaluatietekst — een identieke prompt (zelfs met een andere vertaling), een identiek of nagenoeg identiek antwoord, of het gehele bestand. Het vermeldt ook wat er bewust wordt *behouden* en waarom: template-varianten waarin één woord wisselt (*"Ik zie de hond"* / *"Ik zie de kat"*) zijn oefening, niet het antwoord, en worden gerapporteerd in plaats van verwijderd — tenzij elke testrij er een heeft, in welk geval `--clean-to … --drop-test-twins` de trainingstweelingen van een vaste testset verwijdert. Deterministisch: hetzelfde corpus levert hetzelfde resultaat op |
| **funnel-audit** | geruisloos verlies in de pipeline (één spellingsteken wiste ooit 1.375 woordenboekwerkwoorden, onzichtbaar, wekenlang) |
| **convention-lint** | trainen op gemengde spellingsconventies (waarna het model ze halverwege de zin door elkaar haalt) |
| **coverage-map** | een miljoen synthetische paren zonder gebiedende wijs, zonder vragen, zonder bezitsvormen — volume dat structurele hiaten maskeert |
| **sample-strata** | twee template-typen die de helft van het trainingssignaal opeisen |
| **ci-scoring** | scores zonder foutmarges (elk getal wordt weergegeven met zijn 95% bootstrap-BI — er is geen uitvoer van kale scores) |
| **schedule-sanity** | early stopping die een run met veel synthetische data na een halve epoch afbreekt: bij 97% synthetische data en een eerlijke, *echte* dev-set bereikt het dev-verlies al vroeg een dieptepunt en loopt het daarna op — dat is het model dat zich aanpast aan de synthetische massa, geen convergentie. De ondergrens voor stoppen wordt automatisch afgeleid uit uw mix, en elke ingreep licht zichzelf toe aan de hand van het dev-verliestraject. Dit werd ontdekt *dankzij* een zuiver protocol — eerlijke opstellingen brengen reële bugs aan het licht |
| **eval-ledger** | onzichtbaar adaptief gebruik van evaluatiedata (elke lezing wordt gelogd; verzegelde sets zijn eenmalig bruikbaar) |
| **preregister** | postdicties vermomd als voorspellingen (geen preregistratie → geen testscore, geen vergelijkingstabel; één voorspellingsformaat, een JSON-array — `nmt-forge prereg template` genereert een bestand om te bewerken) |
| **score caveats** | het citeren van een score waar de evaluatie-harness kanttekeningen bij plaatst — een *nagenoeg constante uitvoer* (een van enkele zinnen die aan veel verschillende invoeren wordt gekoppeld: de uitvoer volgt de invoer niet), uitvoer die veel langer of korter is dan de referenties, kopieën van de brontekst. forge berekent niets hiervan zelf; het geeft elke kanttekening die de harness heeft geplaatst, in de bewoordingen van de harness, door naast de score — in het exportsamenvatting, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` en `lint` — en biedt een score met kanttekeningen nooit aan als "het te citeren getal" zonder de bijbehorende waarschuwing |

## Elke taal, elk materiaal — begin bij de kaart

nmt-forge is één tool voor alle ~8.700 talen in de index van Champollion, en
het begint met de vraag aan de index wat er daadwerkelijk beschikbaar is voor een taal:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

De `?`-markeringen zijn de tool die eerlijk is: afwezigheid op een kaart betekent **onbekend**, nooit "deze taal heeft niets." Elke taal beklimt dezelfde **middelenladder** — (1) parallelle tekst alleen geeft al de volledige beveiligde trainingsloop; (2) eentalige tekst voegt terugvertaling toe; (3) een woordenboek plus een gepubliceerde grammatica maakt het de moeite waard een geciteerd sjabloonpakket te bouwen; (4) een morfologische analysator ontsluit geverifieerde synthese; (5) een LYSS-scheidsrechter brengt de eigen metriek van de taal in de scoring en checkpointselectie. Een rijke kaart (Plains Cree) verbindt treden 4–5 automatisch — evaluatiesets arriveren gemarkeerd als `NEVER TRAIN ON THIS`, en de plugin-lanes van de scheidsrechter zijn klaar om te plakken.

`nmt-forge init <code>` genereert vervolgens een projectsteiger op basis van de kaart: een werkruimte,
een startconfiguratie en een `NEXT_STEPS.md`-instructie geschreven voor u *en uw
agent* met de exacte volgorde van opdrachten. Het werkt vanaf een kale `pip install` —
kaarten worden gelezen uit een door u opgegeven map, een lokale checkout of de openbare
kaartenindex (gecached voor offline gebruik) — en een taal die nog geen kaart heeft,
krijgt ook een project (`--no-card --name "<name>"`), waarbij elk feit op de kaart wordt
vastgelegd als onbekend in plaats van verzonnen.

## Van een laptop naar een geserveerd model

De eerlijke cyclus heeft geen GPU nodig. `init` schrijft een van de drie modelpresets
naar de configuratie, als expliciete getallen:

| preset | vereist | wat u kunt verwachten |
|---|---|---|
| `cpu-tiny` (standaard) — een kleine transformer die vanaf nul is getraind, met een woordenschat die uitsluitend is geleerd uit uw trainingsrijen | een laptop-CPU, geen download | opzettelijk beperkt: op 1–2 duizend paren, chrF++ ruwweg 5–30 — de frasen en patronen van uw data, geen algemene vertaling |
| `cpu-finetune --base <hf-id>` — een klein vooraf getraind Marian/opus-mt-model naar keuze, voor een verwant paar | een CPU, ~300 MB download | doorgaans beter dan `cpu-tiny` wanneer er een verwant paar bestaat — meet het na |
| `nllb-600m` — NLLB-200 gedistilleerd 600M met LoRA | een GPU | het sterkste startpunt |

`cpu-tiny` is bedoeld om de *volledige* cyclus vanaf dag één werkelijkheid te maken — het hekwerk,
de audits, de voorgeregistreerde test, een model dat de CLI kan aanroepen — zodat een beter
model later naadloos in hetzelfde project past en op dezelfde wijze wordt gemeten. Na
de training voltooien twee opdrachten het proces:

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export` scoort de testset eenmalig (preregistratie vereist, 95%-betrouwbaarheidsintervallen;
`--prereg <id>` noemt de preregistratie die voor dit model is geschreven
met `nmt-forge prereg new <id>` — bij twee modellen op één testset, elk
beoordeeld op zijn eigen merites, weigert export te gokken), schrijft het resultaat weg als een
mt-eval-rapport dat `mt-eval compare` kan lezen, en verpakt een zelfstandig model met
een champollion-pluginmanifest en een `DEPLOY.md`. `serve` ondersteunt het champollion api-method-contract en een
OpenAI-compatibel eindpunt, zodat `champollion sync --method local` ermee kan
vertalen; het luistert uitsluitend op localhost, tenzij u het van een token voorziet. Elk commando
ondersteunt `--json` voor agents (één JSON-document op stdout; weigeringen als
`{"error": {…, "why", "fix"}}`, exitcode 2). De volledige handleiding vindt u in
[Train uw eerste model](/docs/network/getting-started/train-your-first-model);
zodra u iets heeft dat het testen waard is, zet
[Een methode indienen](/docs/network/getting-started/submit-a-method) dit om in
een Network-inzending.

## Synthetische data die u kunt verdedigen

Voor talen met morfologische analysatoren (FST's) produceert forge trainingsdata via **taalpakketten** — en handhaaft een *emitteerwet* waaraan geen enkel pakket zich kan onttrekken: elk gegenereerd woord moet de analysator doorlopen (genereren → analyseren → zelfde analyse), elk sjabloon citeert de gepubliceerde grammatica die het transcribeert, elk plausibiliteitsfilter is benoemd en geteld, en elke rij wordt gestempeld als `synthetic: true`. Dat stempel is essentieel: het register **weigert synthetische rijen in testsets**. Tests bevatten uitsluitend echte data.

forge zelf wordt geleverd zonder taalpakketten — het is een algemeen inzetbare tool. Pakketten leven bij hun talen en worden ingeplugd via modulepad of entry point (het Plains Cree-pakket bevindt zich in het crk-translate-project):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Analysatoren en woordenboeken blijven afzonderlijke, door de gebruiker op te halen tools onder hun eigen licenties — nooit gebundeld, nooit herverspreid.

## De eigen scheidsrechter van uw taal, in de loop

LYSS-evaluatiestandaarden (per-taal linters die weten, bijvoorbeeld, dat twee Cree-spellingen alleen verschillen door een gedocumenteerde lange-klinkerconventie) worden ingeplugd in elk scoringsvlak — en in de checkpointselectie, zodat het model dat wint het model is dat *de scheidsrechter van de taal* verkiest, niet alleen chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

Elk plugin-getal krijgt een betrouwbaarheidsinterval; een scheidsrechter waarvan de vereisten ontbreken rapporteert *niet beschikbaar* in plaats van een gefabriceerde score.

Hetzelfde geldt voor de **volledige harness-metriekstapel** — nmt-forge spreekt alles wat de [eval harness](/docs/network/specifications/harness) spreekt, inclusief de neurale metrieken (COMET, COMET-QE, MetricX), waarbij inferentie eenmalig wordt uitgevoerd en betrouwbaarheidsintervallen worden gebootstrapt vanuit gecachede per-invoer-scores. Voordat u checkpoints selecteert op basis van een automatische metriek, toont `discover` de [gemeten betrouwbaarheid](/docs/network/specifications/metric-reliability) van elke metriek voor uw taalfamilie — voor Inuktitut volgt BLEU nauwelijks menselijk oordeel (r=0,16) terwijl COMET dat wel doet (r=0,86); voor de meeste taalfamilies met weinig middelen is het eerlijke antwoord *ongemeten*. De tool vertelt u welk getal u kunt vertrouwen voordat u ernaar optimaliseert.

## Verder verdiepen

- **Nieuw met de terminologie?** [MT-training in duidelijke taal](/docs/network/context/mt-training-concepts) definieert elk begrip —
  trainings- vs. evaluatiedata, loss vs. decoding, datalekken, chrF++, backtranslation,
  het plateau — aan de hand van een uitgewerkt voorbeeld, geschreven voor lezers zonder voorkennis.
- **Klaar om te bouwen?** [Aan de slag met uw eigen model](/docs/network/tutorials/train-your-own-model) is de stapsgewijze,
  agent-gerichte handleiding: kies een taal → verzamel data → synthetiseer → splits
  → train → evalueer → itereer → serveer en dien in, waarbij elke guardrail wordt gedemonstreerd
  terwijl deze een fout onderschept. [Bouw MT voor uw taal](/docs/build-mt-for-your-language) plaatst training in de context van
  het gehele traject — inventariseren wat er bestaat, opties afwegen en meten, implementeren.
- **Train, dien daarna in:** een eerlijk getraind model wordt een Network-inzending
  via [Een methode indienen](/docs/network/getting-started/submit-a-method).
- **De foutmarges:** [Statistische significantietoetsing](/docs/network/specifications/significance) beschrijft de wiskundige methode die forge
  standaard toepast.
- **Welke metriek te vertrouwen:** raadpleeg [Betrouwbaarheid van metrieken](/docs/network/specifications/metric-reliability) voordat
  u checkpoints selecteert op basis van een automatische metriek.
- **Elke opdracht en vlag:** de [forge-opdrachtenreferentie](/docs/network/getting-started/forge-command-reference),
  gegenereerd vanuit de tool zelf.
- **De foutentaxonomie** — elke fout, een concreet voorbeeld en de guard
  die deze onderschept — wordt meegeleverd met de broncode van nmt-forge. Agents ontvangen dezelfde
  set regels via de tool `get_training_guardrails` van de MCP-server (optioneel `topic`), en elke weigering
  bevat een eigen toelichting met wat/waarom/oplossing.
