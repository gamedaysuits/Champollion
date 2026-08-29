---
sidebar_position: 2
title: "Train een Model Eerlijk (nmt-forge)"
related:
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

**De 30-secondenversie:** de meeste MT-"verbeteringen" voor talen met weinig middelen houden geen stand bij heronderzoek — de testset is in de training terechtgekomen, de testset heeft het checkpoint geselecteerd, of de winst was ruis zonder foutmarges. **nmt-forge** is een trainingssuite die die fouten structureel moeilijk maakt: de normale paden doen het juiste, en de verkeerde paden weigeren met een bericht dat zegt *wat* er is gebeurd, *waarom* het resultaten corrumpeert, en de exacte *oplossing*. Het traint; de [eval harness](/docs/network/specifications/harness) scoort. Elke beveiliging erin mechaniseert een fout die we daadwerkelijk hebben gemaakt, gemeten en gedocumenteerd tijdens het bouwen van Plains Cree-vertaling.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

Dat is de hele persoonlijkheid van de suite in één weigering.

## Het vijf-minutenverhaal

Dit is de fout waaruit de suite is ontstaan. Een Cree-leerboek koppelt veel Engelse oefeningen aan één doelzin: *"Feed him"* en *"Feed her"* vertalen beide naar `asam`. Een standaard willekeurige splitsing plaatste één kopie in de training en de tegenhanger in de testset — zodat het model letterlijk 17 van de 54 "test"-antwoorden al had gezien, en die rijen scoorden 83 chrF++ tegenover 44 voor schone rijen. Alles wat daarop volgde (het "kampioen"-model, de bevindingen die erop waren gebaseerd) moest worden weggegooid.

De splitter van nmt-forge maakt dat onmogelijk **door constructie**: paren die een bron *of* een doel delen worden gegroepeerd, hele groepen landen aan één kant, en een verificatie zonder overlap wordt uitgevoerd na elke splitsing:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Elke andere beveiliging heeft dezelfde vorm — een echte fout, mechanisch weggenomen:

| beveiliging | de fout die het elimineert |
|---|---|
| **split-guard** | testantwoorden die via gedeelde bronnen/doelen in de training verborgen zitten |
| **dev-fence** | de testset die uw checkpoint selecteert (training weigert te starten zonder een geregistreerde dev-set) |
| **leak-audit** | trainen op evaluatietekst — exact, herformuleerd (Jaccard), of het volledige bestand |
| **funnel-audit** | stille pijplijn-uitval (één orthografieteken verwijderde ooit 1.375 woordenboekwerkwoorden, onzichtbaar, gedurende weken) |
| **convention-lint** | trainen op gemengde spellingconventies (het model mengt ze vervolgens midden in een zin) |
| **coverage-map** | een miljoen synthetische paren zonder gebiedende wijs, zonder vragen, zonder bezit — volume dat structurele hiaten verbergt |
| **sample-strata** | twee sjabloontypen die de helft van het trainingssignaal domineren |
| **ci-scoring** | scores zonder foutmarges (elk getal wordt weergegeven met zijn 95% bootstrap-BI — er is geen uitvoer met kale scores) |
| **schedule-sanity** | vroegtijdig stoppen dat een synthetisch-zwaar traject halverwege een epoch afbreekt: met 97% synthetische data en een eerlijke *echte* dev-set daalt het dev-verlies vroeg en stijgt het weer — dat is het model dat de synthetische massa aanpast, geen convergentie. De stopdrempel wordt automatisch afgeleid uit uw mix, en elke interventie legt zichzelf uit aan de hand van het dev-verliesverloop. Deze fout werd gevonden *dankzij* een schoon protocol — eerlijke opstellingen brengen echte bugs aan het licht |
| **eval-ledger** | onzichtbaar adaptief gebruik van evaluatiedata (elke leesbewerking wordt gelogd; verzegelde sets zijn eenmalig) |
| **preregister** | postdicties die als predicties worden gepresenteerd (geen preregistratie → geen vergelijkingstabel) |

## Elke taal, elk materiaal — begin bij de kaart

nmt-forge is één tool voor alle ~8.700 talen in de index van Champollion, en
het begint door aan de index te vragen wat een taal daadwerkelijk heeft:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

De `?`-markeringen zijn de tool die eerlijk is: afwezigheid op een kaart betekent **onbekend**, nooit "deze taal heeft niets." Elke taal beklimt dezelfde **middelenladder** — (1) parallelle tekst alleen geeft al de volledige beveiligde trainingsloop; (2) eentalige tekst voegt terugvertaling toe; (3) een woordenboek plus een gepubliceerde grammatica maakt het de moeite waard een geciteerd sjabloonpakket te bouwen; (4) een morfologische analysator ontsluit geverifieerde synthese; (5) een LYSS-scheidsrechter brengt de eigen metriek van de taal in de scoring en checkpointselectie. Een rijke kaart (Plains Cree) verbindt treden 4–5 automatisch — evaluatiesets arriveren gemarkeerd als `NEVER TRAIN ON THIS`, en de plugin-lanes van de scheidsrechter zijn klaar om te plakken.

`nmt-forge init <code>` stelt vervolgens een project op basis van de kaart samen: een werkruimte, een startconfiguratie, en een `NEXT_STEPS.md`-briefing geschreven voor u *en uw agent* — eindigend bij [Een Methode Indienen](/docs/network/getting-started/submit-a-method) zodra u iets heeft dat het testen waard is.

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

- **Nieuw in het vakgebied?** [MT-training in Gewone Taal](/docs/network/context/mt-training-concepts) definieert elk begrip — trainings- vs. evaluatiedata, verlies vs. decodering, lekkage, chrF++, terugvertaling, het plateau — met een uitgewerkt voorbeeld, geschreven voor nul achtergrondkennis.
- **Klaar om te bouwen?** [Zo Traint U Uw Eigen Model](/docs/network/tutorials/train-your-own-model) is de stapsgewijze, agent-gerichte doorloop: kies een taal → verzamel data → synthetiseer → splits → train → evalueer → itereer → dien in, met elke beveiliging die zijn fout opvangt.
- **Trainen, dan indienen:** een eerlijk getraind model wordt een Network-vermelding via [Een Methode Indienen](/docs/network/getting-started/submit-a-method).
- **De foutmarges:** [Statistisch Significantietesten](/docs/network/specifications/significance) is de wiskunde die forge standaard toepast.
- **Welke metriek te vertrouwen:** raadpleeg [Metriekbetrouwbaarheid](/docs/network/specifications/metric-reliability) voordat u checkpoints selecteert op basis van een automatische metriek.
- **Het volledige ontwerp** — het gedocumenteerde achtergrondverhaal van elke beveiliging, de pakketinterface, de standaardinstellingen van de trainingsloop — bevindt zich bij de code in de repository (`forge/DESIGN.md`).
