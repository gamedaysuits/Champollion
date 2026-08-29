---
sidebar_position: 0
title: "Dus u wilt uw eigen model trainen"
description: "Een agent-gedreven, end-to-end walkthrough voor het trainen van een low-resource vertaalmodel met nmt-forge — u stuurt een coding agent aan, de guardrails vangen de beginnerfouten automatisch op."
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Wilt u uw eigen model trainen?

Dit is een volledige doorloop van het trainen van een machinevertaalmodel voor een taal met weinig middelen — van "ik spreek deze taal en er zijn nauwelijks gegevens" tot een model dat u eerlijk kunt rapporteren en indienen bij het [Network](/docs/network/). Het is geschreven voor beginners en gaat uit van de moderne manier van werken: **u geeft een codeeragent opdrachten** (Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity of vergelijkbaar), en de agent voert de tools uit.

Elke stap hieronder heeft dan ook dezelfde opbouw:

- 🗣️ **Vertel uw agent** — wat u moet vragen, in gewone taal.
- 🛠️ **Wat de tool doet** — wat [nmt-forge](/docs/network/getting-started/training-honestly) namens u uitvoert, en de **beveiliging** die de klassieke fout onderschept voordat die u iets kost.
- 👀 **Hoe u het resultaat leest** — hoe "goed" eruitziet en waar u op moet letten.

:::info[Eerst de terminologie]
Als termen als *dev set*, *decoding*, *chrF++*, *leakage* of *round-trip verification* nog niet vanzelfsprekend voor u zijn, lees dan eerst [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — dat definieert elk woord dat hier wordt gebruikt aan de hand van een uitgewerkt voorbeeld. Deze pagina maakt gebruik van al die termen.
:::

:::note[Eerlijkheid is de functie, niet de hindernis]
De tool is bewust opinionated. De beveiligingen mechaniseren echte, gemeten fouten die een echt project heeft gemaakt — zodat het eerlijke pad de standaard is, en de oneerlijke snelkoppelingen **worden geweigerd met een bericht dat de oplossing benoemt**. Waar u in deze handleiding een weigering ziet, doet de tool zijn werk. Dat is precies de bedoeling.
:::

---

## Wat u nodig heeft voordat u begint

- **Een codeeragent** met toegang tot een terminal en bestandssysteem. Dat is de bestuurder.
- **Enkele echte vertaalde zinnen** voor uw taalpaar — zelfs een paar honderd door mensen gemaakte paren is een haalbaar startpunt. Tweetalige leerboeken, gemeenschapsarchieven, vertaalde openbare documenten, educatief materiaal. Kwaliteit boven kwantiteit.
- **Optioneel maar krachtig:** eentalige tekst in uw doeltaal, een tweetalig woordenboek, een gepubliceerde referentiegrammatica en een morfologische analysator (FST). U heeft **niet** al deze elementen nodig om te beginnen — de tool vertelt u precies welke aanwezig zijn en welke mogelijkheden elk ontgrendelt.
- **Rekenkracht:** de beveiligingen, splitsing, synthese, auditing en scoring draaien op een laptop. Alleen de daadwerkelijke modeltrainingstap heeft een GPU nodig (en een klein model met LoRA past op bescheiden hardware).

> 🗣️ **Vertel uw agent:** *"Installeer nmt-forge vanuit het `forge/`-pakket van de Champollion monorepo en bevestig dat het commando `nmt-forge` werkt. We gaan een Engels → \<your language\> vertaalmodel trainen, eerlijk."*

Uw agent kan de `get_training_guardrails`-tool van de Champollion MCP-server aanroepen om het volledige regelboek — de tien beveiligingen en de fout die elk ervan voorkomt — in zijn eigen context te laden voordat het commando's schrijft. Als u een agent aanstuurt, vraag hem dat dan als eerste te doen.

---

## Stap 1 — Kies een taal en bekijk wat er werkelijk bestaat

Elk project begint met het eerlijk bevragen van de index over wat de taal *heeft*.

> 🗣️ **Vertel uw agent:** *"Voer `nmt-forge discover` uit voor de ISO 639-3-code van mijn doeltaal en geef een samenvatting van welke gegevens beschikbaar zijn en wat ontbreekt."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Wat de tool doet.** Het leest de Champollion **card** van de taal — de enige bron van waarheid over wat er over die taal bekend is — en rapporteert de scripts, morfologische analysatoren, woordenboeken, corpora en evaluatiedatasets die erin zijn opgenomen, en plaatst de taal vervolgens op de **asset ladder**:

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Hoe u het resultaat leest.** De `✓`-markeringen geven aan wat u nu kunt doen; de `?`-markeringen zijn sporten die wachten op een asset. Cruciaal is dat **afwezigheid op een card *onbekend* betekent, nooit "deze taal heeft niets".** Een schaarse card is een uitnodiging om toe te voegen wat u weet, geen doodlopende weg — en zelfs een kale card geeft u de volledige beveiligde trainingsloop op sport 1. Een rijke card (zoals Plains Cree) verbindt de hogere sporten automatisch: de bijbehorende evaluatiesets worden gemarkeerd als **NEVER TRAIN ON THIS**, en de taalspecifieke beoordelaar staat klaar om in te pluggen.

Maak vervolgens een project aan:

> 🗣️ **Vertel uw agent:** *"Maak een project aan met `nmt-forge init` voor dit taalpaar en lees mij de `NEXT_STEPS.md` voor die het genereert."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ Dit maakt een werkruimte aan (een `.forge/`-map die elke beveiliging raadpleegt), een **startconfiguratie**, en een `NEXT_STEPS.md`-briefing geschreven voor *u en uw agent* — de volgorde van commando's, de asset ladder voor uw taal, en de niet-onderhandelbare vereisten. Het is de kaart voor alles hieronder.

---

## Stap 2 — Wijs een analysator en woordenboek aan (indien beschikbaar)

Deze stap gaat over **sporten 3–4** van de ladder. Als uw taal geen analysator heeft, sla dan over naar [Stap 4](#step-4--split-your-real-data-safely) — u traint dan op echte (en terugvertaalde) gegevens alleen, wat een volledig legitiem pad is.

Als een analysator en woordenboek *wel* bestaan, ontgrendelen ze de mogelijkheid om geverifieerde trainingsgegevens te *produceren* — de grootste hefboom voor een taal met weinig parallelle tekst.

> 🗣️ **Vertel uw agent:** *"De card vermeldt een morfologische analysator en een woordenboek voor deze taal. Haal ze op volgens de installatie-instructies op de card, wijs het taalpakket ernaar via de gedocumenteerde omgevingsvariabelen, en bevestig dat de analysator een paar bekende woorden correct round-tript."*

🛠️ **Wat de tool doet — en een grens die het niet overschrijdt.** Analysatoren (FST's) en woordenboeken zijn **afzonderlijke, door de gebruiker op te halen tools met hun eigen licenties**. De suite **bundelt of herverdeelt ze nooit** — het wijst u op de herkomst en de licentie, en u haalt ze zelf op. Dit is geen bureaucratie: veel taalbronnen hebben echte toestemmings- en soevereiniteitsrestricties, en de tool respecteert die van nature.

Het verbindende weefsel is een **taalpakket**: een kleine plugin die *uw* analysator, woordenboek, orthografieregels en grammatica-geciteerde zinstemplates aanpast aan de engine. De suite levert **geen** pakketten zelf — pakketten leven bij hun talen (het Plains Cree-pakket leeft bijvoorbeeld in zijn eigen project en wordt ingeplugd via modulepad).

👀 **Hoe u het resultaat leest.** U wilt dat de analysator **round-tript**: schrijf een vorm, voer de spelling terug in, ontvang dezelfde grammaticale tags. Als dat niet lukt, heeft de **canonicalizer** van het pakket — de ene functie die spelling normaliseert waar twee componenten elkaar ontmoeten — waarschijnlijk een regel nodig. Dit goed krijgen is belangrijk: één niet-gereconcilieerd teken (`ý` vs `y`) verwijderde ooit stilzwijgend 1.375 werkwoorden uit een generatiepijplijn gedurende weken. De **funnel audit** van de tool telt overlevenden bij elke fase precies zodat een stille uitval als die zich niet kan verbergen.

---

## Stap 3 — Synthetiseer trainingsgegevens uit grammaticaregels

Met een analysator + woordenboek + een pakket grammatica-geciteerde templates kunt u honderdduizenden geverifieerde paren produceren.

> 🗣️ **Vertel uw agent:** *"Genereer synthetische trainingsgegevens met `nmt-forge synth` via ons taalpakket, en toon mij het dekkingsrapport."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Wat de tool doet — de emitteerwet.** Elke rij die de uitvoer bereikt moet voldoen aan regels waarvan geen enkel pakket kan afwijken:

- **Round-trip geverifieerd** — elk gegenereerd woord doorloopt *genereer → analyseer → zelfde analyse*, anders wordt de rij verwijderd. Er wordt nooit een niet-geverifieerde vorm uitgestoten.
- **Grammatica-geciteerd** — elk type template citeert de gepubliceerde grammatica die het transcribeert. Niet-geciteerde templates bestaan niet; de code weigert ze te laden.
- **Dekkingsgecontroleerd** — templates worden verantwoord aan de hand van een checklist van vereiste grammaticale verschijnselen (gebiedende wijs, vragen, bezit, inverse vormen…). Als een *vereist* verschijnsel nul voorbeelden heeft, mislukt de build. Dit is de beveiliging tegen de val van "een miljoen zinnen, allemaal dezelfde paar vormen" — volume dat structurele gaten verbergt.
- **Herkomststempel** — elke synthetische rij is gemarkeerd als `synthetic: true`. Die stempel is functioneel: het register **weigert** synthetische rijen als testset te registreren. Tests zijn uitsluitend echte gegevens.

👀 **Hoe u het resultaat leest.** Kijk in het dekkingsrapport naar **vereiste items met nuldekking** (een grammaticaal verschijnsel dat uw templates nooit hebben geproduceerd) en naar de **soortdistributie** — als twee templatevormen domineren, zal de per-soort-limiet van de sampler (standaard 15%) ze herbalanceren zodat geen enkel patroon de helft van de ervaring van het model wordt.

:::tip[Geen analysator? Gebruik terugvertaling]
Als u niet kunt synthetiseren vanuit regels maar wel **eentalige** doeltaaltekst heeft, vraag uw agent dan de **terugvertaling**-lane uit te voeren: `nmt-forge backtranslate` vertaalt uw eentalige tekst machinaal *naar* het Engels en koppelt elk resultaat aan de **echte** doelzin. De doelzijde blijft authentiek. De tool **controleert de eentalige tekst eerst op lekkage** — omdat die tekst stiekem uw evaluatiegegevens kan zijn. Zie het [Back-Translation cookbook](/docs/network/tutorials/back-translation).
:::

---

## Stap 4 — Splits uw echte gegevens veilig

Neem nu uw **echte** paren en verdeel ze in train / dev / test. Hier schuilt de meest resultaatvernietigende fout in low-resource MT, en hier verdient de beveiliging zijn waarde.

> 🗣️ **Vertel uw agent:** *"Splits het echte corpus in een test- en dev-set met `nmt-forge split`, groepsdisjunct, en registreer ze. Gebruik een vaste seed zodat het reproduceerbaar is."*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **Wat de tool doet — de splitsingsbeveiliging.** Het voert **groepsdisjuncte splitsing** uit: elk paar dat een bron *of* een doel deelt wordt in één groep gebonden, en elke volledige groep belandt volledig aan één kant. Vervolgens **verifieert het nul overlap** en weigert door te gaan als er overlap bestaat.

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Dit voorkomt de **"Feed him" / "Feed her"-lek**: een leerboek koppelt beide Engelse oefeningen aan één doelwoord (`asam`); een naïeve willekeurige splitsing plaatst één kopie in train en zijn tegenhanger in test, zodat het model "slaagt" op basis van geheugen. In één echt project lekten 17 van de 54 testrijen op deze manier en scoorden 83 versus 44 voor schone rijen — en elke bevinding die op dat getal was gebaseerd was ongeldig. `--register textbook` registreert de dev- en testsets (als `textbook-dev` en `textbook-test`) in de werkruimte zodat elk later commando weet dat dit *evaluatiesets zijn waarop u nooit mag trainen*.

👀 **Hoe u het resultaat leest.** U wilt de regel **verified: 0 shared** zien. Als u in plaats daarvan een `SplitLeakageError` krijgt, verwijder dan geen rijen handmatig — dat verschuift het probleem alleen maar. Voer de groepsdisjuncte splitsing opnieuw uit; dat is de oplossing, en de foutmelding zegt dat ook.

:::danger[Train nooit op een benchmark]
Als u een evaluatiedataset ophaalt uit het gedeelde register (`nmt-forge registry add-harness`), stempelt de tool deze en behandelt hem als verboden voor training — **elke** registerbenchmark is gemarkeerd als *do-not-train*. Finetune op wat u legitiem kunt; maar nooit op de testset. Dit is [de ene regel](/docs/network/leaderboard/rules) van het hele Network.
:::

---

## Stap 5 — Train

Één configuratiebestand beschrijft de volledige run; één commando voert hem reproduceerbaar uit.

> 🗣️ **Vertel uw agent:** *"Vul de trainingsconfiguratie in — wijs `dev` naar onze geregistreerde dev-set, vermeld de gold- en synthetische gegevenslanes, kies een klein basismodel met LoRA — voer dan `nmt-forge run` uit en bekijk de planningsdiagnostiek."*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **Wat de tool doet — vier beveiligingen tegelijk.**

- **Lekcontrole vóór training.** *Elke* lane — gold, synthetisch en eventuele terugvertaalde tekst — wordt gescreend tegen *elke* geregistreerde evaluatiesets. Exacte treffers, bijna-duplicaten (herformuleringen) en volledige bestandsovereenkomsten met een testset zijn fataal. Er wordt niets getraind totdat de mix schoon is.
- **Dev-omheining.** Training **weigert te starten zonder een geregistreerde dev-set**, en selecteert checkpoints uitsluitend op basis van die dev-set — nooit de testset. (Het controleert zelfs de inhoud van de dev-rijen tegen de testsets, om de `cp test.jsonl dev.jsonl`-truc te onderscheppen.) Checkpointselectie kan gebruikmaken van dev **loss** of een dev **generatiemetriek** — decodeer de dev-set en scoor de echte uitvoer, het eerlijkere signaal.
- **Planningssaniteit.** Als uw mix zwaar synthetisch is, *leidt* de tool een stopvloer af uit de omvang van uw mix en houdt de training gaande door het **plateau** — de fase waarin het model klaar is met het gemakkelijke synthetische leren en de overdracht naar echte kwaliteit nog niet heeft gemaakt. Dit voorkomt de "halve-epoch-dood", waarbij naïef vroeg stoppen op een twintigste van het plan stopt. Elke interventie drukt de dev-loss-trajectorie en de reden af, in gewone taal.
- **Blootstellingswiskunde + getagde synthese.** Goldgegevens worden opgewogen (herhaald) zodat de weinige echte gegevens niet worden overspoeld; het manifest noteert de **effectieve blootstelling per unieke zin** zodat een A/B eerlijk blijft. Synthetische bronnen dragen een tag; gold blijft ongetagd zodat het de uitvoerstijl verankert.

👀 **Hoe u het resultaat leest.** De run drukt een **dev-rapport met betrouwbaarheidsintervallen** af — er is geen kale scoreuitvoer:

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

Als u een `schedule-sanity`-bericht ziet dat uitlegt dat de training *voorbij* een voortijdige stop is gehouden, werkt de plateaubeveiliging — goed. De run schrijft ook een **manifest**: configuratiehash, gegevensbestandshashes, seeds en het afgeleide schema, zodat de volledige run reproduceerbaar is.

---

## Stap 6 — Evalueer eerlijk

U heeft een model. Voordat u het op de testset scoort, schrijft u op wat u verwacht — *eerst*.

> 🗣️ **Vertel uw agent:** *"Schrijf een preregistratie voor de testsetscoring — onze voorspelde metriek, richting en marge — decodeer dan de testset en scoor hem."*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **Wat de tool doet — de anti-verhaalbeveiliging.**

- **Preregistratie.** Het scoren van een geregistreerde **test**set vereist een preregistratie die *vóór* de eerste blik is geschreven. Zonder die preregistratie **weigert de vergelijkingstabel simpelweg te renderen**:

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  Dit is de beveiliging tegen het opsmukken van postdicties ("het verbeterde natuurlijk op mondelinge verhalen") als voorspellingen. Het opschrijven van de gissingen die *mislukken* is wat de gissingen die slagen betrouwbaar maakt.
- **Betrouwbaarheidsintervallen, altijd.** Elke score wordt weergegeven met zijn 95% bootstrap-CI; er is geen uitvoer zonder CI. Een `+0.5`-stijging waarvan de intervallen overlappen is geen winst.
- **Het eval-grootboek.** Elke lezing van elke evaluatiesets wordt gelogd (append-only, manipulatiebestendig). Vraag `nmt-forge ledger show --set textbook-test` hoe "verbruikt" een set is. **Verzegelde** sets zijn eenmalig — één keer gescoord, dan gesloten.

👀 **Hoe u het resultaat leest.** Lees het getal **met zijn interval en per register**, en controleer **welke metriek u moet geloven** voordat u viert:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` toont de **gemeten betrouwbaarheid** van elke metriek voor uw taalfamilie (uit de WMT-meta-evaluaties). Voor sommige families volgt een metriek als BLEU nauwelijks het menselijk oordeel terwijl COMET dat wel doet; voor veel low-resource-families is het eerlijke antwoord *niet gemeten* — in welk geval het oordeel van moedertaalsprekers, niet enig automatisch getal, het echte signaal is. Zie [Metric Reliability](/docs/network/specifications/metric-reliability).

:::tip[De eigen beoordelaar van uw taal]
Als uw taal een LYSS-evaluatiestandaard heeft (een linter die bijvoorbeeld weet dat twee spellingen alleen verschillen door een gedocumenteerde lange-klinkerconventie), plug die dan in met `--plugin` en hij scoort naast chrF++ — en kan zelfs checkpoints *selecteren*, zodat het model dat wint het model is dat de eigen beoordelaar van de taal verkiest. Elk plugingetal krijgt ook een betrouwbaarheidsinterval.
:::

---

## Stap 7 — Itereer

Nu verbetert u — en elke verbetering wordt op dezelfde eerlijke manier gemeten.

> 🗣️ **Vertel uw agent:** *"Verander één ding — voeg een templatesoort / meer terugvertaalde gegevens / een ander basismodel toe — train opnieuw, en vergelijk het A/B met de vorige run op de dev-set, met significantie."*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
```

🛠️ **Wat de tool doet.** `compare` voert een **gepaarde significantietest** uit, niet alleen een aftrekking, zodat "B verslaat A" een bewering is die de statistieken ondersteunen — geen ruis. Itereer op de **dev**-set (dat is waarvoor die dient); bewaar de **test**-set voor onfrequente, voorgeregistreerde controles; bewaar elke **verzegelde** set voor het allerlaatste.

👀 **Hoe u het resultaat leest.** Een echte verbetering haalt zijn betrouwbaarheidsinterval *en* de significantietest. Als dat niet lukt, heeft u toch iets geleerd — die hefboom is zwakker dan u hoopte, wat de moeite waard is om te weten. De plateau-/dekkings-/lekbeveiligingen betekenen dat de getallen die u vergelijkt betrouwbaar zijn, zodat u uw eigen iteratielus daadwerkelijk kunt vertrouwen.

Veelgebruikte volgende hefbomen, ruwweg in volgorde van opbrengst voor een gegevensarme taal:

1. **Meer dekking** in synthese — voeg de ontbrekende grammaticale verschijnselen toe die het dekkingsrapport heeft gemarkeerd.
2. **Terugvertaling** — zet eentalige doeltaaltekst om in meer trainingsparen.
3. **Een groter of beter passend basismodel**, of LoRA-rang/hyperparameterafstemming.
4. **Curriculum** — pretraining op synthetisch, dan finetuning op de echte paren.

---

## Stap 8 — Dien in bij het Network

Een eerlijk getraind model is precies wat het [Champollion Network](/docs/network/) is gebouwd om te ontvangen.

> 🗣️ **Vertel uw agent:** *"Verpak dit model als een methode en dien het in bij het leaderboard voor ons taalpaar."*

- **[Submit a Method](/docs/network/getting-started/submit-a-method)** maakt van uw model een Network-inzending, gescoord op openbare referentiecorpora en aan u toegeschreven.
- Omdat uw evaluatie schoon was — groepsdisjunct, dev-omheind, lekgecontroleerd, CI'd, voorgeregistreerd — overleeft uw inzending de scrutinie die de meeste low-resource MT-claims doet zinken. De anti-gamingarchitectuur (geheime, gemeenschapseigen testsets, reproduceerbaarheidscontroles, validatie door moedertaalsprekers) is geen obstakel voor een model dat op deze manier is gebouwd; het is een stempel van geloofwaardigheid.
- Als er een **prijs** openstaat voor uw taal, is een staande, beter-dan-basislijn-methode die eerlijk is gebouwd precies wat een gesponsorde pool beloont. En wanneer een methode werkt voor een inheemse taal, **kan het eigendom worden overgedragen aan de gemeenschap** — u bouwt het hier en zij zetten het in, op hun voorwaarden. Zie de [Prize Specification](/docs/network/specifications/prizes) en [Ownership Transfer](/docs/network/sovereignty/ownership-transfer).

---

## De hele boog, in één adem

1. **Ontdek** wat de taal heeft (`discover`, `init`) — afwezigheid is onbekend, niet nul.
2. **Wijs** een analysator + woordenboek aan als ze bestaan (sporten 3–4), met respect voor hun licenties.
3. **Synthetiseer** geverifieerde, geciteerde, dekkingsgecontroleerde trainingsgegevens (`synth`) — of **vertaal terug** eentalige tekst.
4. **Splits** echte gegevens groepsdisjunct en registreer de evaluatiesets (`split`).
5. **Train** met één configuratie, dev-omheind, lekgecontroleerd, plateaubewust (`run`).
6. **Evalueer** met vooraf opgeschreven voorspellingen, altijd CI's, de juiste metriek (`prereg`, `score`).
7. **Itereer** met significantiegetoetste A/B's (`compare`).
8. **Dien in** bij het Network — waar eerlijk werk het punt is.

U hoefde de tien manieren waarop low-resource MT-resultaten misgaan nooit uit het hoofd te leren. De tool maakte het eerlijke pad de standaard en weigerde de snelkoppelingen met een uitleg. Dat is het hele idee: **de beveiligingen vangen de amateurfouten op zodat u zich kunt concentreren op de taal.**

## Verder gaan

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — elk begrip hier, gedefinieerd met een voorbeeld.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — de tien beveiligingen op één pagina, elk met zijn gemeten achtergrondverhaal.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) en [**Back-Translation**](/docs/network/tutorials/back-translation) — diepgaandere cookbooks over specifieke technieken.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — het opbouwen van de echte gegevens waarop al het andere rust.
