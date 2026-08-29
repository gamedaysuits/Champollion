---
sidebar_position: 0
title: "MT-training in begrijpelijke taal"
description: "Een toegankelijk glossarium van de begrippen die u nodig heeft om een vertaalmodel te trainen — elk term gedefinieerd met een uitgewerkt voorbeeld, geschreven voor mensen die een coding agent aansturen."
related:
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on walkthrough these words are for"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The suite that turns every rule here into a guardrail"
  - label: "MT Field Briefing"
    to: /docs/network/context/mt-field-briefing
    kind: doc
    note: "Broader context on where machine translation stands"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind error bars — why one number is never enough"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Which score to believe for your language"
---

# MT-training in gewone taal

Het trainen van een machine-vertaalmodel (MT) heeft zijn eigen vocabulaire, en het grootste deel daarvan wordt nooit uitgelegd aan nieuwkomers — het wordt als vanzelfsprekend beschouwd. Deze pagina gaat nergens van uit. Elk begrip hieronder wordt in gewone woorden gedefinieerd en gekoppeld aan een concreet voorbeeld, zodat u wanneer u de [trainingswalkthrough](/docs/network/tutorials/train-your-own-model) leest of uw codeeragent een opdracht ziet uitvoeren, weet wat de woorden betekenen en, nog belangrijker, **welke van hen de fouten verbergen die resultaten stilletjes ruïneren.**

:::info[Voor wie is dit bedoeld]
U hoeft geen Python te schrijven. De verwachte manier om dit werk nu te doen is het **aansturen van een codeeragent** — Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity, of vergelijkbaar — die de tools voor u uitvoert. Uw taak is de concepten goed genoeg te begrijpen om goede instructies te geven en de resultaten eerlijk te lezen. Dat is precies waarvoor deze pagina dient. Wanneer we een tool noemen, bedoelen we [**nmt-forge**](/docs/network/getting-started/training-honestly), de trainingssuite waarin deze ideeën zijn ingebouwd; de woorden echter zijn van het hele vakgebied, niet van ons.
:::

Een doorlopend voorbeeld verbindt de pagina. Stel dat u een model wilt bouwen dat **Engels → een taal met weinig middelen** vertaalt — noem het uw *doeltaal* — waarvoor nauwelijks vertaalde tekst bestaat. Alles hieronder is een onderdeel van dat project.

---

## 1. De twee stapels: trainingsdata en evaluatiedata

**Parallelle data** is tekst gekoppeld aan de vertaling ervan — dezelfde betekenis in twee talen, zin voor zin uitgelijnd.

> `The children are playing.` → `awâsisak mêtawêwak.`

Een model leert door duizenden van dergelijke paren te bestuderen. Maar u moet de paren in **twee stapels bewaren die elkaar nooit raken**:

- **Trainingsdata** — de paren die het model *mag bestuderen*. Het leest deze keer op keer en past zichzelf aan om ze te reproduceren.
- **Evaluatiedata** (of **evaldata**) — paren die het model *tijdens de training nooit mag zien*. U verbergt de vertalingen, vraagt het model de bronkant koud te vertalen, en vergelijkt het antwoord met de verborgen waarheid. Dit is de enige eerlijke maatstaf voor of het heeft geleerd te *vertalen* in plaats van te *memoriseren*.

:::tip[De éénzinsversie van alles op deze pagina]
Een toets betekent alleen iets als het model de antwoorden nooit heeft gezien. Bijna elke fout hieronder is een andere manier waarop de antwoorden van de evalstapel naar de trainingsstapel lekken zonder dat iemand het merkt.
:::

### Echte versus synthetische parallelle data

- **Echte (of *gouden*) parallelle data** is door mensen gemaakt: een tweetalig leerboek, overheidsdocumenten vertaald door mensen, door de gemeenschap gearchiveerde verhalen. Het is betrouwbaar maar, voor de meeste talen, pijnlijk schaars — vaak slechts een paar honderd zinsparen.
- **Synthetische parallelle data** wordt door een programma *vervaardigd* in plaats van door een persoon geschreven. Wanneer u slechts 400 echte paren heeft, kunt u geen bruikbaar model trainen — dus genereert u honderdduizenden extra paren op basis van regels (meer over hoe in [§7](#7-manufacturing-data-when-you-dont-have-enough)).

De relatie is enorm belangrijk:

> **Uitgewerkt voorbeeld.** Een project heeft 435 echte Engels→Cree-paren en vervaardigt ~1.000.000 synthetische. Het model traint op de grote synthetische stapel *plus* de paar honderd echte paren. Synthetische data koopt dekking; echte data verankert het model aan hoe de taal werkelijk wordt gebruikt. Het hele vakmanschap bestaat uit (a) de synthetische stapel zo veel mogelijk van de taal te laten dekken, en (b) uitsluitend meten op echte tekst die het model nooit heeft aangeraakt.

:::danger[Test nooit op synthetische data]
Een evaluatieset moet **uitsluitend uit echte data** bestaan. Als u op vervaardigde zinnen test, meet u of het model uw *generator* nabootst — niet of het kan vertalen. Een goede trainingssuite weigert synthetische rijen überhaupt als testset te registreren.
:::

---

## 2. Splitsen: train, dev en test

U begint met één stapel echte paren en **splitst** deze in drie rollen.

| Splitsing | Ook wel | Waarvoor | Ziet het model het tijdens training? |
|---|---|---|---|
| **train** | trainingsset | De paren die het model bestudeert | Ja |
| **dev** | validatieset, held-in | Beslissen *wanneer te stoppen* en *welke versie het beste is* | Nee (alleen *gescoord*, nooit bestudeerd) |
| **test** | held-out, evaluatieset | Het definitieve eerlijke cijfer | **Nooit** |

Twee ideeën schuilen in die tabel:

- **Held-out** betekent simpelweg "opzijgezet en buiten de training gehouden." Een testset wordt bewust held-out gehouden.
- De **devset** is het slimme middelste kind. Het model *bestudeert* hem nooit, maar u *kijkt* tijdens de training hoe goed het model het erop doet om beslissingen te nemen — als een oefenexamen dat u vertelt of u moet blijven studeren, zonder het echte examen te zijn. De devset op deze manier gebruiken is legitiem; de *test*set op deze manier gebruiken is vals spelen (zie [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).

### Verzegelde sets en heropsplitsingen

- Een **verzegelde set** is een testset die **precies één keer** gescoord mag worden. Op het moment dat u uw score erop bekijkt, is hij "verbruikt" — want zodra u het getal kent, wordt elke latere beslissing die u neemt er subtiel door beïnvloed. Verzegelde sets zijn hoe wedstrijden en gemeenschappen een definitief cijfer werkelijk definitief houden.
- Een **heropsplitsing** is wanneer u de train/dev/test-verdeling van de grond af opnieuw opbouwt — gewoonlijk omdat u ontdekte dat de oude splitsing verontreinigd was. U kunt een lekkende splitsing niet repareren door een paar rijen te verwijderen; u hergroepeert alles en snijdt opnieuw ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results) legt uit waarom).

---

## 3. Wat "training" werkelijk doet: verlies en zijn twee gezichten

Training is een lus. Het model doet een voorspelling, ziet hoe fout het was, en past zijn interne getallen een beetje aan om de volgende keer minder fout te zijn — miljoenen keren achter elkaar.

**Verlies** is het enkelvoudige getal dat "hoe fout" meet. Lager is beter. Maar er zijn *twee* verliezen, en ze door elkaar halen is een klassieke valkuil:

- **Trainingsverlies** — hoe fout het model is op de paren die het actief bestudeert. Dit blijft bijna altijd dalen, omdat het model in het uiterste geval de trainingsparen simpelweg kan *memoriseren*.
- **Devverlies** (validatieverlies) — hoe fout het model is op de achtergehouden devset die het *niet* bestudeert. Dit is het eerlijke signaal. Wanneer het devverlies stopt met verbeteren terwijl het trainingsverlies blijft dalen, is het model gestopt met *de taal leren* en begonnen met *de trainingsset memoriseren*.

> **Uitgewerkt voorbeeld.** Na een tijdje ziet u trainingsverlies op 0,8 en dalend, maar devverlies vastgezet op 1,9 en langzaam *stijgend*. Dat verschil is het teken: het model wordt beter in het opdreunen van zijn trainingsparen en niet beter — zelfs slechter — in het vertalen van iets nieuws.

### Verlies is een benadering. Decodering is het echte werk.

Hier is een subtiliteit die bijna iedereen struikelt. Verlies meet of het model een hoge waarschijnlijkheid toekent aan het juiste volgende woord *wanneer het juiste antwoord al voor hem ligt*. Dat is **niet** hetzelfde als het model dat zelf een goede vertaling produceert.

- **Decodering** (ook *generatie* of *inferentie*) is het model dat **werkelijk vertaalt**: gegeven alleen de bronzin, produceert het woord voor woord een doelzin, zonder iets om op te leunen.
- **Verlies** is een goedkope *benadering* berekend tijdens training. Het correleert met kwaliteit, maar onvolmaakt.

> **Uitgewerkt voorbeeld.** Twee checkpoints hebben bijna identiek devverlies, maar wanneer u de devzinnen *decodeert* en de werkelijke vertalingen scoort, is de ene duidelijk vloeiender. Verlies kon dat verschil niet zien; decodering wel. Daarom decodeert serieuze checkpointselectie de devset en scoort de werkelijke uitvoer, in plaats van alleen op verlies te vertrouwen.

:::note["Volgt devverlies kwaliteit?" is een open vraag, geen volkswijsheid]
U zult stellige beweringen horen dat "evalloss liegt." Behandel dat als **onbepaald**, niet bewezen — veel van die volkswijsheid kwam voort uit verontreinigde experimenten. Het eerlijke standpunt: devverlies is een nuttig, goedkoop signaal; een dev **generatiemetriek** (decodeer, dan scoor) is een directere. Geef de voorkeur aan de directe voor definitieve beslissingen, en herhaal "loss liegt" niet als een feit.
:::

---

## 4. Verontreiniging en lekkage: de fout die resultaten vernietigt

**Verontreiniging** (of **lekkage**) betekent dat evalantwoorden stiekem in de trainingsstapel zijn terechtgekomen. Het model "haalt dan de toets" uit geheugen, uw score ziet er geweldig uit, en het resultaat is waardeloos. Dit is de meest voorkomende manier waarop MT-resultaten met weinig middelen nep blijken te zijn — en het belangrijkste waarvoor deze hele pagina u waarschuwt.

De klassieke, sluipende vorm is een **gedeeld-doel minimaal paar**:

> **Uitgewerkt voorbeeld — "Feed him" / "Feed her".** Een taalleerboek koppelt veel verschillende Engelse oefeningen aan **één** doelwoord. *"Feed him"* en *"Feed her"* vertalen beide naar dezelfde vorm, `asam`. Een naïeve willekeurige splitsing plaatst *"Feed him"* → `asam` in **training** en *"Feed her"* → `asam` in de **testset**. Het doelantwoord, `asam`, zit nu in beide stapels. Het model memoriseerde `asam` uit training en "krijgt het goed" op de test — maar het heeft niets geleerd. In één echt project lekte 17 van de 54 "test"-rijen op deze manier, en die rijen scoorden **83** op de kwaliteitsmetriek versus **44** voor schone rijen. Elke bevinding gebaseerd op dat getal moest worden weggegooid.

Lekkage heeft meerdere gedaanten, en een goede **lekaudit** controleert ze allemaal:

- **Exacte overlap** — dezelfde bron *of* hetzelfde doel verschijnt aan beide kanten (het bovenstaande voorbeeld).
- **Bijna-duplicaatoverlap** — niet identiek, maar een *herformuleerde* versie van een testzin zit in training. Documenten uit hetzelfde domein delen parafrasen; exacte matching mist deze, dus audits meten ook woordoverlapgelijkenis.
- **Geheel-bestandsoverlap** — iemand heeft per ongeluk getraind op een kopie van het testbestand zelf. (Dit gebeurt echt: een "trainings"-oogst bleek het gouden leerboek *te zijn*, 489 van de 489 regels kwamen overeen.)

### Groepsdisjuncte splitsing — de oplossing

U kunt lekkage niet repareren door de betreffende rijen één voor één te verwijderen; het patroon verschijnt gewoon opnieuw. De oplossing is **groepsdisjuncte splitsing**: bind vóór het splitsen elk paar dat een bron *of* een doel deelt samen in een **groep**, en stuur vervolgens elke *hele groep* naar precies één kant. Nu leven `asam` en alles wat het deelt volledig in train *of* volledig in test — nooit in beide. Na het snijden **verifieert u nul overlap** en weigert u door te gaan als er nog overlap is.

:::tip[Dit is wat "de splitsbewaker" voor u doet]
Wanneer uw agent de splitter uitvoert, doet hij standaard groepsdisjuncte splitsing en verifieert hij automatisch nul overlap. U hoeft de "Feed him / Feed her"-val niet te onthouden — de tool maakt het moeilijk om hem te begaan, en als u eromheen probeert te werken, weigert hij met een bericht dat de oplossing benoemt.
:::

---

## 5. Overfitting, vroegtijdig stoppen en het plateau

**Overfitting** is wat er gebeurt wanneer een model blijft studeren voorbij het punt van leren en begint te *memoriseren*. Het trainingsverlies ziet er prachtig uit; de werkelijke vertaalkwaliteit verslechtert. Het verliesverschil uit [§3](#3-what-training-actually-does-loss-and-its-two-faces) is hoe u het herkent.

**Vroegtijdig stoppen** is de verdediging: houd het devsignaal in de gaten, en wanneer het stopt met verbeteren gedurende een ingesteld aantal controles (zijn **geduld**), stop dan met trainen en bewaar de beste eerdere versie — het beste **checkpoint** (een opgeslagen momentopname van het model halverwege de training). Vroegtijdig stoppen voorkomt verspild rekenwerk en overfitting tegelijk.

Maar vroegtijdig stoppen heeft een bekende faalwijze wanneer u voornamelijk op synthetische data traint — het **synthetisch→echt transferplateau**:

> **Uitgewerkt voorbeeld — de halve-epoch-dood.** Een model traint op een mix die voor 97,5% synthetisch is en wordt beoordeeld op een *echte* devset van 42 zinnen. In het begin wordt het model snel goed in de synthetische massa, zodat het devverlies op de echte zinnen snel daalt, rond stap 8.000 een bodem bereikt — en dan *omhoog* drijft. Naïef vroegtijdig stoppen ziet "devverlies steeg 6 controles op rij" en verklaart de overwinning bij epoch 0,52, een twintigste van de geplande training. Maar het model was niet klaar; het had slechts het *gemakkelijke* synthetische leren afgerond en was nog niet begonnen aan de langzame **overdracht** naar echte taalkundige kwaliteit. Het werd gestopt bij het plateau, vóór de beloning.

De les: bij een synthetisch-zware mix is een *vroege* daling-en-stijging in devverlies **verwacht**, geen convergentie. De stoppregel moet slim genoeg zijn om de training door het plateau heen te houden — een ondergrens afgeleid van de grootte van uw mix, niet een magisch getal dat u geacht wordt te kennen.

:::note[Eerlijke opstellingen brengen echte bugs aan het licht]
Die plateaubug was maandenlang onzichtbaar — omdat eerdere runs (onrechtmatig) de *test*set als hun devset hadden gebruikt, wat hem verborg. De eerste *schone* run was wat hem blootlegde. Dit is het terugkerende thema: het eerlijk doen houdt u niet alleen eerlijk, het maakt echte problemen zichtbaar.
:::

---

## 6. Kwaliteit meten: metrieken, batterijen, registers

Wanneer het model een testzin *decodeert*, hoe scoort u dan het antwoord ervan ten opzichte van de referentievertaling?

### Gedeeltelijk-kredietmetrieken: chrF++ en BLEU

Een vertaling is zelden exact woord voor woord gelijk aan de referentie, maar kan toch perfect goed zijn. Daarom gebruikt MT **gedeeltelijk-krediet**metrieken die *overlap* belonen in plaats van een exacte overeenkomst te eisen:

- **chrF++** scoort overlap van **tekenreeksen** (plus enkele woordreeksen) tussen de uitvoer van het model en de referentie. Omdat het op tekenniveau werkt, geeft het gedeeltelijk krediet voor het *bijna* goed krijgen van een woord — de juiste stam met een verkeerde uitgang levert nog steeds iets op. Dat maakt het goed geschikt voor morfologisch rijke talen, waar één wortel vele vormen aanneemt. Hoger is beter; het wordt gewoonlijk gerapporteerd op een schaal van 0–100.
- **BLEU** is de oudere standaard. Het scoort overlap van **hele-woord**stukken (n-grammen). Het wordt nog steeds breed gerapporteerd, maar het is streng voor talen waar woorden veel verbuigde vormen hebben, omdat een bijna-mis op een uitgang telt als een volledige mis.

> **Uitgewerkt voorbeeld.** Referentie: `awâsisak mêtawêwak`. Modeluitvoer: `awâsisak mêtawêw` (juiste wortel, verkeerde eindlettergreep). BLEU ziet het tweede woord als simpelweg fout. chrF++ ziet dat de meeste tekens overeenkomen en kent gedeeltelijk krediet toe. Dezelfde uitvoer, heel verschillende score — daarom verandert de metriek die u kiest het verhaal.

:::tip[Welke metriek te geloven is een gemeten vraag]
Niet elke metriek volgt menselijk oordeel even goed voor elke taal. Voor sommige taalfamilies correleert BLEU nauwelijks met wat mensen denken; voor andere is een geavanceerde neurale metriek de onbetrouwbare. Voordat u naar *welke* metriek dan ook optimaliseert, controleer de [Metriekbetrouwbaarheid](/docs/network/specifications/metric-reliability)-evidentie voor uw taalfamilie — en als het eerlijke antwoord "ongemeten" is, zeg dat dan in plaats van een getal te vertrouwen.
:::

### Neurale metrieken: COMET, MetricX

Naast teken-/woordoverlap gebruiken **neurale metrieken** (COMET, COMET-QE, MetricX) een getraind model om vertalingen te *beoordelen* meer zoals een mens dat zou doen. Ze kunnen veel betrouwbaarder zijn — maar alleen voor talen waarvoor ze zijn getraind om te beoordelen, wat de meeste talen met weinig middelen uitsluit. Ze werken ook richtingsafhankelijk: **MetricX** is **lager-is-beter**, het tegenovergestelde van chrF++ — een detail dat de moeite waard is te weten voordat u getallen vergelijkt.

### Foutmarges: vertrouw nooit één getal

Een enkel getal zonder onzekerheid is een valkuil. Op kleine testsets zijn verschillen vaak slechts ruis.

> **Uitgewerkt voorbeeld.** "Het model verbeterde van 16,7 naar 18,1 op de mondelinge-verhalenset" klinkt als vooruitgang — totdat u merkt dat de set 37 zinnen heeft. Met zo weinig data is een schommeling van ±3 punten puur toeval. Het eerlijke rapport is `17.4 [15.1, 19.8] 95% CI`: het getal, plus het **betrouwbaarheidsinterval (BI)** — het bereik waarbinnen de werkelijke waarde plausibel valt. Als de intervallen van twee modellen sterk overlappen, kunt u niet beweren dat het ene beter is.

Goede tooling weigert een score af te drukken zonder het bijbehorende BI, en gebruikt een [significantietest](/docs/network/specifications/significance) voordat een A-wint-van-B-overwinning wordt verklaard.

### Batterijen en registers

Echte taal is niet één vlak geheel. Een **register** (of **domein**) is een *soort* taal: informeel gesprek, een leerboekoefen, een nieuwsartikel, een mondeling verhaal, formele overheidsproza. Een model kan uitstekend zijn in het ene en slecht in het andere.

Een **batterij** is een evaluatieset die bewust in meerdere registers is opgesplitst en **afzonderlijk** gescoord, zodat één enkel gemiddelde een zwakte niet kan verbergen.

> **Uitgewerkt voorbeeld.** Een model scoort 46 overall — respectabel. Maar de batterij-uitsplitsing toont 58 op leerboekoefen en 22 op mondelinge verhalen. Het gemiddelde maskeerde een bijna-totaal falen op natuurlijke spraak. Alleen de per-register-batterij onthulde het.

---

## 7. Data vervaardigen wanneer u niet genoeg heeft

Wanneer echte paren schaars zijn, vervaardigt u synthetische. Twee technieken domineren, en beide staan of vallen met één woord: **verificatie**.

### FST's en morfologische analysatoren

Een **morfologische analysator** is een tool die de woordgrammatica van een taal kent: hoe wortels combineren met voor- en achtervoegsels om geldige woorden te vormen. Veel zijn gebouwd als **FST's** — *eindige-toestandstransducers*, een precieze, regelgebaseerde technologie (geen neuraal netwerk) die in twee richtingen kan werken:

- **analyseren**: gegeven een woord, breek het op in wortel + grammaticale tags (`nipâw` → "slapen, 3de persoon enkelvoud").
- **genereren**: gegeven een wortel + tags, spel de juiste woordvorm (`sleep + 3sg` → `nipâw`).

Voor een polysynthetische taal — waar één woord kan dragen wat het Engels een hele zin voor nodig heeft — is een FST goud: het kan *elke* geldige vorm van *elke* bekende wortel spellen, wat precies het ruwe materiaal is voor het vervaardigen van trainingsdata.

### Rondreis-verificatie — de regel die synthetische data betrouwbaar maakt

Data vervaardigen is gevaarlijk: een generator kan stilzwijgend onzin produceren. De discipline die dit voorkomt is de **rondreisregel**: elk vervaardigd woord moet *genereer → analyseer → dezelfde analyse waarmee u begon* doorstaan. Als u de FST vraagt een vorm te spellen en die spelling vervolgens terugvoert en uw tags niet terugkrijgt, wordt het woord verworpen. Niets dat de rondreis niet doorstaat, mag ooit in de trainingsdata terechtkomen.

> **Uitgewerkt voorbeeld — het één-teken-lek.** Een woordenboek spelde een klank met de letter `ý`; de analysator verwachtte gewone `y`. Omdat niemand de twee spellingen op de grens had afgestemd, werden *1.375 werkwoorden* stilzwijgend als "onbekend" beoordeeld en uit de generatie verwijderd — wekenlang, onzichtbaar. De oplossing is een **canonicalisator**: één functie die spelling normaliseert naar één enkele conventie *overal* waar twee componenten elkaar ontmoeten, plus een **trechteraudit** die telt hoeveel items elke pijplijnfase overleven zodat een stille uitval van 1.375 items zich nooit meer kan verbergen.

### Dekking, niet alleen volume

Een miljoen vervaardigde zinnen klinkt uitgebreid. Dat zijn ze niet, als het een miljoen variaties van dezelfde paar vormen zijn.

> **Uitgewerkt voorbeeld.** Een synthetisch corpus van 1.000.000 paren bleek **geen imperatieven** te bevatten ("Stem!"), **geen wh-vragen** ("wie/waar/wanneer"), **geen bezit** ("mijn hond"), en **geen inverse vormen** ("zij ziet *mij*" — kerngrammatica in veel talen). De analysator kon ze allemaal genereren; de sjablonen vroegen er simpelweg nooit om. Volume verborg een structureel gat.

De verdediging is een **dekkingschecklist** overgenomen uit een gepubliceerde grammatica: de vereiste grammaticale verschijnselen, elk geciteerd, zodat de build mislukt als een vereist verschijnsel nul voorbeelden heeft. En een **per-soort-limiet** voorkomt dat één sjabloonvorm domineert — in één corpus waren twee vormen 54% van de data, zodat de helft van de "ervaring" van het model uit twee zinspatronen bestond.

### Terugvertaling

**Terugvertaling** is de andere grote synthetische techniek, en ze is vernuftig. Als u gewone, *onvertaalde* tekst in uw doeltaal heeft (een **eentalig** corpus — veel gemakkelijker te vinden dan parallelle tekst), kunt u:

1. een *omgekeerd* model nemen (doeltaal → Engels),
2. uw eentalige doeltekst *naar* het Engels machine-vertalen,
3. elke machine-Engelse zin koppelen aan de **echte** doelzin waarmee u begon, en
4. uw voorwaartse (Engels → doeltaal) model trainen op die paren.

De doelkant is echte taal; alleen de Engelse kant is synthetisch — gewoonlijk een goede ruil.

> **Uitgewerkt voorbeeld.** U heeft 50.000 echte zinnen in uw doeltaal maar slechts 400 parallelle paren. Terugvertaal de 50.000 naar ruw Engels, en u heeft eentalige tekst omgezet in 50.000 trainingsparen waarvan de *doel*kant authentiek is.

:::danger[Voer ook een lekaudit uit op uw eentalige tekst]
Terugvertaling voelt veilig aan omdat "het slechts eentalige tekst is" — maar die tekst kan *uw evaldata in vermomming zijn*. In één project ving de lekaudit een eentalige oogst die exact overeenkwam met de gouden testset. Controleer **elke** invoer tegen **elke** evalset, synthetisch en eentalig inbegrepen — niet alleen uw voor de hand liggende parallelle corpus.
:::

### Synthetische data taggen

Nog één laatste praktijk: **tag** synthetische bronnen met een markering (zoals `<synth>` of `<bt>`) en laat echte (gouden) data ongetagd. Dit stelt het model in staat "oefenmateriaal" te onderscheiden van "het echte werk", zodat de authentieke data de uitvoerstijl verankert; bij vertaaltijd voegt u de tag niet toe, en het model leunt op wat het van goud heeft geleerd. (Zie het [Terugvertaling-kookboek](/docs/network/tutorials/back-translation) voor deze techniek in detail.)

---

## 8. Hoe de stukken samenhangen

Van boven naar beneden gelezen is dit één workflow:

1. Verzamel **echte parallelle data** ([§1](#1-the-two-piles-training-data-and-evaluation-data)) — gewoonlijk te weinig.
2. **Splits** het groepsdisjunct in train / dev / test ([§2](#2-splitting-train-dev-and-test), [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).
3. **Vervaardig** synthetische data om het gat te vullen — rondreis-geverifieerd, dekkingsgecontroleerd, lekgeauditeerd ([§7](#7-manufacturing-data-when-you-dont-have-enough)).
4. **Train** op de mix, terwijl u **devverlies / devgeneratie** in de gaten houdt om **overfitting** te vermijden en het **plateau** te overleven ([§3](#3-what-training-actually-does-loss-and-its-two-faces), [§5](#5-overfitting-early-stopping-and-the-plateau)).
5. **Decodeer** de achtergehouden **testbatterij** en scoor deze met **gedeeltelijk-kredietmetrieken + betrouwbaarheidsintervallen**, per **register** ([§6](#6-measuring-quality-metrics-batteries-registers)).
6. Doe dit alles zonder ooit evalantwoorden de training te laten raken ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)) — de regel die de andere vijf dienen.

Elke regel hier correspondeert met een echte, gemeten fout die een echt project heeft gemaakt en gedocumenteerd. U hoeft ze niet te memoriseren: de trainingssuite mechaniseert elk ervan zodat het eerlijke pad de standaard is en de oneerlijke paden weigeren met een uitleg. Dat is het onderwerp van de volgende pagina.

## Uw agent aansturen met dit vocabulaire

Omdat u via een codeeragent zult werken, is de praktische opbrengst van deze pagina dat u nu instructies als deze kunt geven — en controleren:

- *"Splits het corpus groepsdisjunct en verifieer nul overlap vóór de training."*
- *"Snijd een devset uit de trainingskant; selecteer nooit checkpoints op de testset."*
- *"Voer een lekaudit uit op elke invoer tegen elke evalset, inclusief de synthetische en eentalige data."*
- *"Rapporteer chrF++ met 95%-betrouwbaarheidsintervallen, uitgesplitst per register."*
- *"Controleer de metriekbetrouwbaarheid voor deze taalfamilie voordat we naar welke score dan ook optimaliseren."*

Als uw agent de Champollion MCP-server beschikbaar heeft, kan hij `get_training_guardrails` aanroepen om deze regels — en de fout die elk ervan elimineert — rechtstreeks in zijn context te laden voordat hij ook maar één opdracht schrijft.

**Volgende:** zet het aan het werk in [**So You Want to Train Your Own Model**](/docs/network/tutorials/train-your-own-model), de stapsgewijze walkthrough — of lees [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) voor hoe de suite elk concept hier omzet in een automatische beveiliging.

Als termen zoals *tokenizer* nog onduidelijk zijn, is [Tokenizers](/docs/learn/tokenizers) de basisintroductie — leest u deze één keer door en alles hierboven wordt eenvoudiger.
