---
sidebar_position: 0
title: "Dus u wilt uw eigen model trainen"
description: "Een agent-gerichte, end-to-end walkthrough voor het trainen van een low-resource vertaalmodel met nmt-forge — van python3 -m pip install tot een model dat wordt geserveerd aan de champollion CLI. U stuurt een coding agent aan; de guardrails vangen beginnersfouten automatisch op."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
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

Dit is een complete handleiding voor het trainen van een machinevertalingsmodel voor een
data-arme taal — van "ik spreek deze taal en er zijn nauwelijks gegevens"
tot een model waarover u eerlijk kunt rapporteren, dat u via de
champollion CLI aan uw eigen app kunt leveren en kunt indienen bij het [Network](/docs/network/). Trainen is één
stap van een langere reis (zoek wat er bestaat, meet de opties, bouw
iets beters, bewijs het, implementeer het); [Machinevertaling bouwen voor uw
taal](/docs/build-mt-for-your-language) is het overzicht van het geheel.
Het is geschreven voor nieuwkomers en gaat uit van de moderne manier om dit werk te doen:
**u stuurt een coding-agent aan** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity of vergelijkbaar), en de agent voert de tools uit.

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

- **Een coding-agent** met een terminal en bestandssysteemtoegang. Dat is de bestuurder.
- **Enkele echte vertaalde zinnen** voor uw talenpaar — zelfs een paar
  honderd door mensen gemaakte paren vormen een bruikbaar begin. Tweetalige leerboeken,
  gemeenschapsarchieven, vertaalde openbare documenten, educatief materiaal. Kwaliteit boven
  kwantiteit.
- **Optioneel maar krachtig:** eentalige tekst in uw doeltaal, een
  tweetalig woordenboek, een gepubliceerde referentiegrammatica en een morfologische
  analyzer (FST). U heeft deze **niet** allemaal nodig om te beginnen — de tool vertelt
  u precies welke aanwezig zijn en welke welke mogelijkheden ontgrendelen.
- **Rekenkracht:** een laptop. De guardrails, het splitsen, de synthese, de audits en
  het scoren draaien allemaal op een CPU, en dat geldt ook voor het trainen van het standaardmodel (een kleine
  transformer die vanaf nul is getraind). Een GPU is alleen van belang als u de
  grootste preset kiest (`nllb-600m`) — zie [Stap 5](#step-5--train).

> 🗣️ **Vertel uw agent:** *"Installeer nmt-forge met de bijbehorende training-extra
> (`python3 -m pip install 'nmt-forge[hf]'`) en bevestig dat de opdracht `nmt-forge` werkt.
> We gaan een vertaalmodel voor Engels → \<your language\> trainen,
> op een eerlijke manier."*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

De `[hf]`-extra is de trainingsstack (torch, transformers, accelerate,
tokenizers, sentencepiece, peft); CPU-only wheels zijn prima. Verder is niets
nodig — geen clone van de Champollion-repository. Elke opdracht accepteert `--json`
(één JSON-document op stdout; een weigering wordt geretourneerd als `{"error": {…, "why",
"fix"}}` with exit code 2), and `nmt-forge status` noemt op elk gewenst moment
de volgende opdracht.

Uw agent kan de `get_training_guardrails`-tool van de Champollion MCP-server aanroepen (geen argumenten; optioneel `topic`)
om het volledige regelboek — de tien guardrails en de fout die elk ervan elimineert —
in zijn eigen context te laden voordat hij opdrachten schrijft. Als u een agent aanstuurt,
vraag hem dan om dat eerst te doen.

---

## Stap 1 — Kies een taal en bekijk wat er werkelijk bestaat

Elk project begint met het eerlijk bevragen van de index over wat de taal *heeft*.

> 🗣️ **Vertel uw agent:** *"Voer `nmt-forge discover` uit voor de ISO 639-3-code van mijn doeltaal en geef een samenvatting van welke gegevens beschikbaar zijn en wat ontbreekt."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Wat de tool doet.** Deze leest de Champollion-**card** van de taal — de
enige bron van waarheid voor wat er over die taal bekend is — en rapporteert de
schriften, morfologische analyzers, woordenboeken, corpora en evaluatiedatasets die
deze bevat, en plaatst de taal vervolgens op de **assetladder**. (Cards zijn afkomstig uit een
map die u opgeeft met `--cards-dir`, een lokale checkout of
`node_modules/champollion`, of de openbare card-index — gecachet, dus het werkt
offline na de eerste keer ophalen. Zonder internet en zonder cache exporteert u de card met
`champollion network card <code> --json` naar een map en geeft u `--cards-dir` mee.)

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Het resultaat interpreteren.** De `✓`-markeringen geven aan wat u nu kunt doen; de `?`-markeringen
zijn sporten die wachten op een asset. Cruciaal is: **afwezigheid op een card betekent
*onbekend*, nooit "deze taal heeft niets."** Een summiere card is een uitnodiging
om toe te voegen wat u weet, geen doodlopende weg — en zelfs met een lege card krijgt u de volledige
beveiligde trainingslus op sport 1. Een rijke card (zoals Plains Cree) sluit de hogere
sporten automatisch aan: de evaluatiesets worden gemarkeerd met **HIER NOOIT OP TRAINEN**, en
de taalspecifieke referee is direct klaar voor gebruik. Sport 5 is pas afgevinkt wanneer
het package van die referee hier is geïnstalleerd; anders staat er ✗ *UNAVAILABLE*
met de installatieopdracht — en de referee wordt nooit geladen voor een louter lokale of
verzegelde testset, omdat deze woorden kan opzoeken bij een externe dienst.

Maak vervolgens een project aan:

> 🗣️ **Vertel uw agent:** *"Maak een project aan met `nmt-forge init` voor dit taalpaar en lees mij de `NEXT_STEPS.md` voor die het genereert."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ Dit maakt een werkruimte aan (een `.forge/`-map die door elke guardrail
wordt geraadpleegd), een **startersconfiguratie** en een `NEXT_STEPS.md`-instructie geschreven voor *u
en uw agent* — de volgorde van opdrachten, de assetladder voor uw taal en
de harde voorwaarden. Het is de routekaart voor alles hieronder. De paden in de configuratie zijn
relatief, dus voer forge uit vanuit de projectmap.

`init` kiest ook het **model** dat u gaat trainen (`--model`, uitgeschreven als
expliciete getallen in `config.json`): standaard `cpu-tiny`, `cpu-finetune --base
<hf-id>`, or `nllb-600m`. In [Stap 5](#step-5--train) wordt de keuze toegelicht. Als uw
taal nog geen card heeft, genereert `nmt-forge init <code> --no-card --name "<name>"`
nog steeds de basisstructuur van het project — elk card-gegeven wordt geregistreerd als onbekend, er wordt niets
verzonnen.

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

:::tip[Geen analyzer? Gebruik in plaats daarvan retourvertaling]
Als u niet kunt synthetiseren op basis van regels, maar wel beschikt over **eentalige** doeltaaltekst,
vraag uw agent dan om de **retourvertalingsbaan** (backtranslation) te gebruiken: deze vertaalt
uw eentalige tekst machinaal *naar* het Engels met een omgekeerd model dat u aanlevert en koppelt
elk resultaat aan de **echte** doelzin. De doeltaalzijde blijft authentiek.
Het is een Python-bibliotheekaanroep (`nmt_forge.training.backtranslation.backtranslate`),
geen CLI-subopdracht: uw agent schrijft er een kort script omheen en voegt het
getagde uitvoerbestand toe aan de `data.synthetic`-banen van de configuratie. De aanroep
**voert eerst een lek-audit uit op de eentalige tekst** — omdat die tekst stiekem uw evaluatiedata kan *zijn*.
Zie het
[Retourvertalingskookboek](/docs/network/tutorials/back-translation).
:::

---

## Stap 4 — Splits uw echte gegevens veilig

Pak nu uw **echte** paren en zet de zinnen apart waarmee u alles zult
beoordelen. Dit is waar de meest resultaatvernietigende fout in
data-arme machinevertaling op de loer ligt, en waar de guardrail zijn waarde bewijst.

Uw bestanden kunnen `.tsv` zijn (bron, een TAB, daarna de vertaling, één paar per
regel; regels die beginnen met `# ` zijn commentaar) of `.jsonl` (`{"source": …,
"target": …}` per regel).

**Als u al een testset hebt** — gecontroleerd door een leraar, gecontroleerd door een verpleegkundige, privé —
bewaar deze dan als een afzonderlijk bestand, registreer deze, controleer het corpus hierop en splits
alleen train en dev af:

> 🗣️ **Vertel uw agent:** *"Registreer onze testset, voer een lek-audit uit op het corpus
> aan de hand daarvan, en splits vervolgens het opgeschoonde corpus in train en dev met
> `nmt-forge split`, groep-disjunct, met een vaste seed."*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**Als u dat niet hebt**, splits de testset dan in dezelfde stap af van het corpus:

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **Wat de tool doet — de split-guard.** Deze voert een **groep-disjuncte
splitsing** uit: elk paar dat een bron *of* een doel deelt, wordt samengevoegd in één groep,
en elke gehele groep belandt volledig aan één kant. Vervolgens **verifieert deze nul
overlap** en weigert door te gaan als er overlap bestaat:

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

Dit elimineert het **"Feed him" / "Feed her"-lek**: een leerboek koppelt beide Engelse
oefenzinnen aan één doelwoord (`asam`); een naïeve willekeurige splitsing plaatst het ene exemplaar in train
en het tweelingexemplaar in test, waardoor het model "slaagt" op basis van geheugen. In een echt project lekten 17
van de 54 testrijen op deze manier en scoorden 83 tegenover 44 voor schone rijen — en elke
conclusie die op dat getal was gebaseerd, was ongeldig. `--register project` registreert de dev-set
(en de testset, indien afgesplitst) als `project-dev` / `project-test` — de
namen waarnaar de startersconfiguratie al verwijst — zodat elke latere opdracht weet dat het
*evaluatiesets zijn waarop u nooit mag trainen*. Wanneer een testset al
geregistreerd is, controleert `split` de nieuwe train- en dev-bestanden daar direct ook op.

🛠️ **En de lek-audit.** `leak-audit` controleert rijen tegen elke geregistreerde
evaluatieset en geeft, met voorbeelden uit uw eigen corpus, aan wat het zou **verwijderen** —
een rij waarvan de bron identiek is aan een testprompt (zelfs als de vertaling
verschilt), een rij waarvan het doel identiek is aan een testantwoord, en een rij waarvan het
doel een bijna-duplicaat is van een testantwoord (het bevat het antwoord, is er een
fragment van, of is voor minstens 90% identiek met weglating van accentverschillen) — en wat het
**opzettelijk behoudt**: *sjabloonverwanten* (template siblings) die een zinsstructuur delen maar
een woord wisselen (*"I see the dog"* / *"I see the cat"*), en bijna-dubbele prompts met
een ander antwoord. De testrijen die een sjabloonverwant in de trainingsdata hebben, worden
weergegeven, en — omdat de startersconfiguratie `eval.near_dupe_corpus` instelt op uw
trainingsbestand — scoort het eindrapport de testrijen *zonder* verwant
afzonderlijk, als een "(strict)"-score, zodat het optimisme dat de verwanten toevoegen
zichtbaar wordt. Wanneer de meeste testrijen een verwant hebben en de testset vastligt,
verwijdert `--clean-to <file> --drop-test-twins` ook die trainingstweelingen (het
rapporteert de strikte deelverzameling voor en na, en weigert de training leeg te maken).
Geef het een eigen bestand (`corpus.notwins.jsonl`): dit is het corpus van het tweelingvrije
model, naast dat met alle gegevens, en leak-audit weigert te schrijven
over een bestand dat al door een configuratie, run of splitsing wordt gelezen.
Het resultaat is deterministisch en de eigen tekst van het testbestand
wordt nooit afgedrukt.

👀 **Hoe u het resultaat leest.** U wilt de regel **verified: 0 shared** zien. Als u in plaats daarvan een `SplitLeakageError` krijgt, verwijder dan geen rijen handmatig — dat verschuift het probleem alleen maar. Voer de groepsdisjuncte splitsing opnieuw uit; dat is de oplossing, en de foutmelding zegt dat ook.

:::danger[Train nooit op een benchmark]
Als u een evaluatiedataset ophaalt uit het gedeelde register (`nmt-forge registry add-harness`), stempelt de tool deze en behandelt hem als verboden voor training — **elke** registerbenchmark is gemarkeerd als *do-not-train*. Finetune op wat u legitiem kunt; maar nooit op de testset. Dit is [de ene regel](/docs/network/leaderboard/rules) van het hele Network.
:::

---

## Stap 5 — Train

Eén configuratiebestand beschrijft de volledige run; één opdracht voert deze
reproduceerbaar uit. `nmt-forge init` heeft het al geschreven.

> 🗣️ **Vertel uw agent:** *"Lees `config.json`, voeg onze synthetische baan toe als we die
> hebben gemaakt, voer `nmt-forge preflight run --config config.json` uit, herstel alles wat daarin
> wordt gemarkeerd, voer vervolgens `nmt-forge run config.json` uit en bekijk de
> planningsdiagnostiek."*

Een fragment uit de startersconfiguratie, met het standaard `cpu-tiny`-model en een
toegevoegde synthetische baan:

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**Welk model?** Kies dit wanneer u `init` uitvoert (`--model`); elk getal komt terecht in
`config.json`:

| preset | wat het is | vereisten | eerlijke verwachting |
|---|---|---|---|
| `cpu-tiny` (standaard) | een kleine transformer (~6M parameters) vanaf nul getraind; het vocabulaire wordt uitsluitend geleerd van uw **training**-rijen | een laptop-CPU, geen download | zwak: bij 1–2 duizend paren een chrF++ van ongeveer 5–30 (de bovengrens alleen bij sterk gestructureerde sjabloondata) — zinsneden en patronen uit uw data, geen algemene vertaling |
| `cpu-finetune --base <hf-id>` | fine-tunt een klein vooraf getraind Marian/opus-mt-model dat u opgeeft — kies er een voor een *verwant* talenpaar | een CPU, ~300 MB download | meestal beter dan `cpu-tiny` wanneer een verwant paar bestaat — meet het op dev, ga er niet zomaar van uit |
| `nllb-600m` | NLLB-200 gedistilleerd 600M met LoRA | een GPU, ~2,5 GB download | de sterkste start; op een CPU weigert de doorlooptijdcontrole dit binnen enkele minuten |

Het doel van `cpu-tiny` is niet de score. Het maakt de **volledige** cyclus werkelijkheid —
het dev-hek, de audits, de voorgeregistreerde test, een model dat de CLI kan aanroepen — zodat een
beter model later in hetzelfde project kan worden geplaatst en op dezelfde manier wordt gemeten.

`preflight` toont elke controlepoort die de run zal tegenkomen, ✓ of ✗, met de oplossing voor elke ✗
— inclusief of de training-extra is geïnstalleerd
(`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`).

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **Wat de tool doet — vier beveiligingen tegelijk.**

- **Lek-audit vóór het trainen.** *Elke* baan — gold, synthetisch en eventuele
  retourvertaalde tekst — wordt gecontroleerd tegen *elke* geregistreerde test- en verzegelde
  set. Antwoordlekkage (identieke prompts of antwoorden, bijna-dubbele antwoorden) en
  volledige bestandsovereenkomsten zijn fataal; sjabloonverwanten worden behouden en gerapporteerd
  (`--drop-test-twins` verwijdert ze voor een vaste testset).
  Er wordt niets getraind totdat de mix schoon is.
- **Dev-hek (dev-fence).** Het trainen **weigert te starten zonder een geregistreerde dev-set**, en
  zal checkpoints alleen ooit selecteren op basis van die dev-set — nooit de testset.
  (Er wordt zelfs een inhoudelijke controle van de dev-rijen tegen de testsets uitgevoerd om de
  `cp test.jsonl dev.jsonl`-truc te ontdekken.) Selectie van checkpoints kan gebruikmaken van dev-**loss** of
  een dev-**generatiemetriek** — decodeer de dev-set en beoordeel de werkelijke uitvoer,
  wat het eerlijkere signaal is (de startersconfiguratie gebruikt chrF++ op gedecodeerde dev-uitvoer).
- **Planningscontrole (schedule-sanity).** Als uw mix veel synthetische data bevat, *leidt* de tool een
  stop-ondergrens af uit de omvang van uw mix en zet het trainen voort gedurende het
  **plateau** — de fase waarin het model klaar is met het eenvoudige synthetische
  leren en dit nog niet heeft overgedragen naar echte kwaliteit. Dit voorkomt de
  "halve-epoch-dood", waarbij naïeve vroege stop al na een twintigste van het
  plan stopt. Hoe vaak de dev-set wordt geëvalueerd, wordt eveneens afgeleid uit de omvang van de run,
  zodat een kleine run nog steeds wordt geëvalueerd. Bij elke ingreep worden het dev-loss-traject
  en de reden in duidelijke taal afgedrukt.
- **Blootstellingsberekening + getagde synthetische data.** Gold-data krijgt een hoger gewicht (wordt herhaald), zodat
  de weinige echte data niet ondersneeuwt; het manifest legt de **effectieve
  blootstelling per unieke zin** vast, zodat een A/B-test eerlijk blijft. Synthetische bronnen krijgen een
  tag; gold blijft zonder tag zodat het de stijl van de uitvoer verankert.

Trainen is de enige stap die wat tijd kost. Uw agent moet dit op de
achtergrond uitvoeren met uitvoer naar een logbestand en letten op de regels die ertoe doen
(`refused`, `Error`, `wall-clock`, `RUN EXIT`) in plaats van te pollen. Er opent zich een livepaneel
met de loss-curves en een stopknop voor **u** (op
`http://127.0.0.1:8377` wanneer die poort vrij is). In de eerste minuten meet forge de trainingssnelheid
en toont een prognose van de werkelijke doorlooptijd, eerst een vroege schatting en daarna een
stabiele schatting. `init` stelt geen tijdsbudget in, want een budget is uw getal,
niet iets wat de tool verzint. Bekijk de prognose, bepaal wat u acceptabel vindt,
en voeg `"time_budget_hours": <hours>` toe aan `config.json` onder `model`. Vanaf
dat moment weigert forge een run die niet binnen die tijd kan worden voltooid, zodat een verkeerd gedimensioneerde run
snel faalt. Totdat u er een instelt, geldt alleen het veiligheidsplafond van forge: dit stopt
een run die dagen zou duren, en elke prognose vermeldt dit als "geen budget ingesteld;
… plafond", niet als een budget dat iemand heeft gekozen.

👀 **Het resultaat interpreteren.** De run toont een **dev-rapport met betrouwbaarheidsintervallen** —
er is geen uitvoer met enkel kale scores — en vervolgens de volgende opdracht (de
onderstaande getallen zijn ter illustratie):

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

Als u een `schedule-sanity`-bericht ziet dat uitlegt dat de training *voorbij* een voortijdige stop is gehouden, werkt de plateaubeveiliging — goed. De run schrijft ook een **manifest**: configuratiehash, gegevensbestandshashes, seeds en het afgeleide schema, zodat de volledige run reproduceerbaar is.

---

## Stap 6 — Evalueer eerlijk

U heeft een model. Voordat u het op de testset scoort, schrijft u op wat u verwacht — *eerst*.

> 🗣️ **Vertel uw agent:** *"Schrijf een preregistratie voor de testset-evaluatie —
> onze voorspelde metriek, richting en marge, met een toelichting van één regel — en exporteer
> vervolgens de run, waarmee de testset eenmalig wordt gescoord."*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg` noemt de preregistratie die dit model beoordeelt. Met één preregistratie op de
testset vindt export deze vanzelf; bij een tweede model met een eigen
preregistratie op dezelfde testset weigert export te gokken, dus noem ze allebei expliciet.

(Preregistratie kan op elk moment vóór de eerste testscore plaatsvinden — `nmt-forge
status` vraagt erom vóór het trainen.)

🛠️ **Wat de tool doet — de anti-verhaalbeveiliging.**

- **Preregistratie.** Het scoren van een geregistreerde **testset** vereist een
  preregistratie die is geschreven *vóór* de eerste blik op de data. Een voorspellingenbestand is een JSON-array:
  elke voorspelling noemt een metriek en een motivatie, plus een richting
  ten opzichte van een baseline (automatisch gecontroleerd door `nmt-forge prereg check`) of een
  verwachting in vrije tekst die door een persoon wordt gecontroleerd. De onbewerkte sjabloon, Markdown en
  lopende tekst worden geweigerd, met vermelding van het formaat en de oplossing. Zonder preregistratie
  zal het scoren simpelweg **weigeren**:

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  Dit is de beveiliging tegen het vermommen van voorspellingen achteraf ("natuurlijk verbeterde het bij
  mondelinge verhalen") als voorspellingen vooraf. Het opschrijven van de aannames die *mislukken*, maakt
  degene die slagen juist geloofwaardig.
- **Altijd betrouwbaarheidsintervallen.** Elke score wordt weergegeven met het 95% bootstrap-betrouwbaarheidsinterval;
  er is geen uitvoer zonder betrouwbaarheidsinterval. Een stijging van `+0.5` waarvan de intervallen overlappen, is geen
  overwinning.
- **Het evaluatielogboek (eval-ledger).** Elke lezing van elke evaluatieset wordt gelogd (alleen toevoegen,
  onwijzigbaar). Vraag `nmt-forge ledger show --set project-test` hoe "verbruikt" een
  set is. **Verzegelde** (sealed) sets zijn eenmalig — één keer gescoord en daarna gesloten (een tweede
  `export` weigert; `--no-eval` verpakt zonder opnieuw te scoren).

`export` decodeert de testset met het door dev geselecteerde checkpoint, scoort deze en
voegt een sectie **Diagnose & Aanbevelingen** in begrijpelijke taal toe. Het schrijft
het resultaat ook weg als een **mt-eval-rapport** (`export/evaluation/`), zodat `mt-eval
compare` uw model kan vergelijken met elke andere methode die met het testkader op
dezelfde testset is gemeten, en verpakt het model zelf (Stap 8) in `export/model/`,
dat geen testzinnen bevat. `export/evaluation/` bevat uw testzinnen:
kopieer dit nooit met het model mee en bewaar het bij de testset. `nmt-forge evaluate <run-manifest>` is het gedeelte dat alleen scoort,
wanneer u geen pakket wilt.

👀 **Het resultaat interpreteren.** Lees het getal **met het bijbehorende interval en per
register**, bekijk de "(strict)"-score als uw trainingsdata zinsjablonen deelt
met de testset, en controleer **welke metriek u moet geloven** voordat u
het viert. Om het uitvoerbestand van een ander systeem op dezelfde geregistreerde set te scoren,
met meer metrieken:

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` toont de **gemeten betrouwbaarheid** van elke metriek voor uw taalfamilie (uit de WMT-meta-evaluaties). Voor sommige families volgt een metriek als BLEU nauwelijks het menselijk oordeel terwijl COMET dat wel doet; voor veel low-resource-families is het eerlijke antwoord *niet gemeten* — in welk geval het oordeel van moedertaalsprekers, niet enig automatisch getal, het echte signaal is. Zie [Metric Reliability](/docs/network/specifications/metric-reliability).

:::tip[De eigen beoordelaar van uw taal]
Als uw taal een LYSS-evaluatiestandaard heeft (een linter die bijvoorbeeld weet dat twee spellingen alleen verschillen door een gedocumenteerde lange-klinkerconventie), plug die dan in met `--plugin` en hij scoort naast chrF++ — en kan zelfs checkpoints *selecteren*, zodat het model dat wint het model is dat de eigen beoordelaar van de taal verkiest. Elk plugingetal krijgt ook een betrouwbaarheidsinterval.
:::

---

## Stap 7 — Itereer

Nu verbetert u — en elke verbetering wordt op dezelfde eerlijke manier gemeten.

> 🗣️ **Vertel uw agent:** *"Verander één ding — voeg een sjabloontype toe / meer
> retourvertaalde data / een andere modelpreset — train opnieuw, en vergelijk dit via een A/B-test met
> de vorige run op de dev-set, inclusief significantie."*

Elke run toont zijn dev-score al met een betrouwbaarheidsinterval. Voor een gepaarde
toets decodeert u de dev-set met elke run — `nmt-forge evaluate <run-manifest>
--config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` is een
kopie van uw configuratie waarvan `eval.battery` `project-dev` is — vervolgens:

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **Wat de tool doet.** `compare` voert een **gepaarde significantietest** uit, niet alleen een aftrekking, zodat "B verslaat A" een bewering is die de statistieken ondersteunen — geen ruis. Itereer op de **dev**-set (dat is waarvoor die dient); bewaar de **test**-set voor onfrequente, voorgeregistreerde controles; bewaar elke **verzegelde** set voor het allerlaatste.

👀 **Hoe u het resultaat leest.** Een echte verbetering haalt zijn betrouwbaarheidsinterval *en* de significantietest. Als dat niet lukt, heeft u toch iets geleerd — die hefboom is zwakker dan u hoopte, wat de moeite waard is om te weten. De plateau-/dekkings-/lekbeveiligingen betekenen dat de getallen die u vergelijkt betrouwbaar zijn, zodat u uw eigen iteratielus daadwerkelijk kunt vertrouwen.

Veelgebruikte volgende hefbomen, ruwweg in volgorde van opbrengst voor een gegevensarme taal:

1. **Meer echte paren** — bij enkele duizenden zinnen telt elk extra echt
   paar zwaarder dan welke instelling dan ook.
2. **Betere dekking** bij de synthese — voeg de ontbrekende grammaticale verschijnselen toe die
   het dekkingsrapport heeft gesignaleerd.
3. **Retourvertaling** (backtranslation) — zet eentalige doeltekst om in meer trainingsparen.
4. **Een sterker startpunt** — `cpu-finetune` met een basismodel voor een
   verwant paar, of `nllb-600m` op een GPU — gemeten ten opzichte van `cpu-tiny` op
   dezelfde dev-set.
5. **Curriculum** — train eerst voor op synthetische data en fine-tune vervolgens op de echte paren.

---

## Stap 8 — Aan het werk zetten en toevoegen aan het Network

Een eerlijk getraind model is iets wat u vandaag al kunt gebruiken, en precies datgene waarvoor het
[Champollion Network](/docs/network/) is gebouwd.

**Gebruik het zelf.** `export` heeft het model al verpakt: een op zichzelf staande modelmap,
`forge-model.json` (wat het is en hoe het gemeten is), een
champollion-pluginmanifest (`method.json`), en `DEPLOY.md` met de exacte
opdrachten.

> 🗣️ **Vertel uw agent:** *"Host het geëxporteerde model en gebruik het om de
> strings van onze app te vertalen met de champollion CLI."*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` ondersteunt het champollion-**api method**-contract (`POST /translate`) en
een **OpenAI-compatibele** `/v1/chat/completions` — dat tweede is wat
`--method local` gebruikt; `DEPLOY.md` bevat het `champollion.config.json`-fragment voor
het eerste. Het luistert uitsluitend op `127.0.0.1`; het model beschikbaar maken op een netwerk vereist een
token (`--token` of `NMT_FORGE_SERVE_TOKEN`). Een NMT-model vertaalt tekst en
negeert instructies, dus toon-prompts, coaching-bestanden en woordenlijsten die de CLI
naar LLM-methoden stuurt hebben er geen effect op — en de uitvoer moet worden gecontroleerd door een
vloeiende spreker voordat deze lezers bereikt.

**Dien het in bij het Network.**

> 🗣️ **Vertel uw agent:** *"Verpak dit model als een methode en dien het in bij het leaderboard voor ons taalpaar."*

- **[Submit a Method](/docs/network/getting-started/submit-a-method)** maakt van uw model een Network-inzending, gescoord op openbare referentiecorpora en aan u toegeschreven.
- Omdat uw evaluatie schoon was — groepsdisjunct, dev-omheind, lekgecontroleerd, CI'd, voorgeregistreerd — overleeft uw inzending de scrutinie die de meeste low-resource MT-claims doet zinken. De anti-gamingarchitectuur (geheime, gemeenschapseigen testsets, reproduceerbaarheidscontroles, validatie door moedertaalsprekers) is geen obstakel voor een model dat op deze manier is gebouwd; het is een stempel van geloofwaardigheid.
- Als er een **prijs** openstaat voor uw taal, is een staande, beter-dan-basislijn-methode die eerlijk is gebouwd precies wat een gesponsorde pool beloont. En wanneer een methode werkt voor een inheemse taal, **kan het eigendom worden overgedragen aan de gemeenschap** — u bouwt het hier en zij zetten het in, op hun voorwaarden. Zie de [Prize Specification](/docs/network/specifications/prizes) en [Ownership Transfer](/docs/network/sovereignty/ownership-transfer).

---

## De hele boog, in één adem

1. **Ontdek** wat er voor de taal beschikbaar is (`discover`, `init`) — afwezigheid betekent onbekend, niet nul.
2. **Verwijs naar** een analyzer + woordenboek als deze bestaan (sporten 3–4), met inachtneming van hun licenties.
3. **Synthetiseer** geverifieerde, geciteerde, op dekking gecontroleerde trainingsdata (`synth`) — of **vertaal eentalige tekst terug**.
4. **Splits** echte data groep-disjunct, controleer deze tegen uw testset en registreer de evaluatiesets (`registry add`, `leak-audit`, `split`).
5. **Train** één configuratie — standaard op een CPU — met dev-hek, lek-audit en plateau-bewustzijn (`preflight`, `run`).
6. **Evalueer** met vooraf opgestelde voorspellingen, altijd betrouwbaarheidsintervallen en de juiste metriek (`prereg`, `export`).
7. **Itereer** met op significantie geteste A/B-vergelijkingen (`compare`).
8. **Gebruik** het model via de CLI (`serve`) en **dien het in** bij het Network — waar eerlijk werk het uitgangspunt is.

U hoefde de tien manieren waarop low-resource MT-resultaten misgaan nooit uit het hoofd te leren. De tool maakte het eerlijke pad de standaard en weigerde de snelkoppelingen met een uitleg. Dat is het hele idee: **de beveiligingen vangen de amateurfouten op zodat u zich kunt concentreren op de taal.**

## Verder gaan

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — elk begrip hier, gedefinieerd met een voorbeeld.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — de tien beveiligingen op één pagina, elk met zijn gemeten achtergrondverhaal.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) en [**Back-Translation**](/docs/network/tutorials/back-translation) — diepgaandere cookbooks over specifieke technieken.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — het opbouwen van de echte gegevens waarop al het andere rust.
