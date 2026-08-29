---
title: "Hoe een tokenizer bepaalt welke talen goedkoop zijn"
sidebar_label: "Tokenizers"
description: "Voordat een taalmodel een woord leest, hakt iets het in stukjes. Deze stap wordt geleerd uit data, optimaliseert compressie in plaats van betekenis, en bepaalt ongemerkt welke talen duur zijn in het gebruik. Een introductie voor lezers die vanaf nul beginnen."
---

# Hoe een tokenizer beslist welke talen goedkoop zijn

:::info[Voor wie dit is]
Iedereen. Deze pagina veronderstelt geen achtergrond in machine learning en geen achtergrond in de taalkunde.
Als u weet wat een taalmodel is — software die tekst aanneemt en
tekst produceert — dan is dat voldoende.
:::

Elk taalmodel heeft een onzichtbare eerste stap. Voordat het een woord leest, knipt een
stuk software dat woord in fragmenten. De fragmenten zijn wat het
model daadwerkelijk ziet.

Die stap wordt **tokenisatie** genoemd, en bijna niemand kijkt ernaar. Het is de moeite waard
om ernaar te kijken, omdat dit het punt is waarop sommige talen meerdere keren
duurder in gebruik worden dan andere — en de beslissing wordt genomen voordat iemand
überhaupt nadenkt over kwaliteit, eerlijkheid of dekking.

---

## 1. Een model kan niet lezen

Een neuraal netwerk voert berekeningen uit met getallen. Het heeft geen besef van letters of
woorden. Tekst moet dus eerst in getallen worden omgezet.

Een **tokenizer** is het stuk software dat deze conversie uitvoert, en deze
aan het einde weer omdraait. Het verandert een string in een lijst van gehele getallen (integers), waarbij elk getal verwijst
naar een rij in een grote opzoektabel.

Het neemt twee beslissingen:

**De woordenschat (vocabulary)** — de vaste inventaris van stukjes die het model mag zien.
Geen woorden: *stukjes*. Veelvoorkomende stukjes zijn hele woorden, maar zeldzamer materiaal wordt
opgebroken. De inventaris heeft een vaste grootte, die vooraf is gekozen — vaak tienduizenden
vermeldingen.

**De segmentatie** — voor elke daadwerkelijke string: welke stukjes, in welke volgorde. Het
woord *unbelievable* kan `un` + `believ` + `able` worden, of één enkel stukje, of
elf losse letters. Welke u krijgt, hangt volledig af van wat er in de
woordenschat zit.

> **Uitgewerkt voorbeeld.** Als `believ` in de woordenschat zit, kost *unbelievable*
> drie stukjes. Als dat niet zo is, valt de tokenizer terug op steeds kleinere
> fragmenten totdat het woord gedekt is — mogelijk één stukje per letter. Hetzelfde
> woord, dezelfde betekenis, drie keer zoveel stukjes of elf keer zoveel stukjes,
> afhankelijk van een beslissing die lang voordat u het typte is genomen.

---

## 2. De woordenschat is *aangeleerd*, en optimaliseert het verkeerde

Dit is het deel dat mensen verrast.

De woordenschat is niet ontworpen door een taalkundige. Deze is **aangeleerd uit een stapel
tekst**, door een algoritme waarvan het doel **compressie** is — dek deze tekst in zo
min mogelijk stukjes.

Betekenis speelt geen rol. Het algoritme heeft geen idee wat een woord is, wat een voorvoegsel
is, of dat er een taal bestaat. Het telt wat vaak samen voorkomt, en geeft
frequente reeksen een eigen vermelding omdat dat de tekst korter maakt.

Het gevolg ontstaat mechanisch. Stukjes worden aan een taal toegewezen, grofweg
in verhouding tot **hoeveel van die taal in de stapel zat**. Een taal die
een groot deel uitmaakte, krijgt veel specifieke stukjes, en de woorden ervan blijven heel
of bijna heel. Een taal die er bijna niet in voorkwam, krijgt vrijwel geen eigen stukjes,
en de woorden ervan worden gedekt door willekeurige generieke fragmenten die toevallig passen.

Een taal die helemaal niet in de stapel zat, krijgt **nul** specifieke stukjes. Het
werkt nog steeds — de tokenizer zal altijd *een* manier vinden om de tekst te representeren,
omdat deze kan terugvallen op individuele tekens of ruwe bytes. Het kost alleen
veel meer om iets te zeggen.

:::note[Dit is geen bug]
Er is niets defect. Het compressie-algoritme deed precies wat er werd
gevraagd. Het probleem is dat "maak de trainingstekst kort" werd geaccepteerd als een
maatstaf voor "representeer taal goed", en voor talen die in die tekst ontbreken, faalt
deze maatstaf volledig.
:::

---

## 3. Fertiliteit: het getal dat de schade benoemt

**Fertiliteit** is het gemiddelde aantal tokens dat een woord kost.

Voor een taal waarop de tokenizer zwaar is getraind, ligt de fertiliteit dicht bij 1 —
de meeste woorden zijn één enkel stukje. Voor een taal die het nog nooit heeft gezien, kan dezelfde maatstaf
vele malen hoger zijn, omdat elk woord uit fragmenten moet worden samengesteld.

Dat ene getal leidt tot vier afzonderlijke belastingen:

| Belasting | Wat het betekent |
|---|---|
| **Kosten (Cost)** | De meeste commerciële modellen factureren per token. Meer tokens per woord betekent dat dezelfde zin meer geld kost om te vertalen, samen te vatten of te genereren. |
| **Context** | Modellen hebben een vast venster. Een hoge fertiliteit betekent dat er minder van uw daadwerkelijke document in past. |
| **Rekenkracht (Compute)** | Langere reeksen zijn trager, overal, altijd. |
| **Leren (Learning)** | De moeilijkste. Betekenis is nu uitgesmeerd over veel fragmenten met weinig informatie, waardoor het model een moeilijker probleem moet oplossen — zelfs met identieke gegevens. |

De eerste drie zijn oneerlijk. De vierde is degene die de kwaliteit schaadt.

**Dit is gemeten, niet slechts beweerd.** Petrov, La Malfa, Torr en Bibi ontdekten dat
dezelfde tekst, vertaald in verschillende talen, in getokeniseerde
lengte tot wel **15 keer** kan verschillen, en dat de ongelijkheid blijft bestaan in tokenizers
die opzettelijk zijn gebouwd voor meertalig gebruik.

Hun bevinding compliceert de voor de hand liggende oplossing: modellen op teken- en byteniveau
— het intuïtieve antwoord, "gebruik gewoon letters, dan is elke taal gelijk" —
toonden nog steeds **meer dan 4 keer** het verschil voor sommige talenparen. Terugvallen
op kleinere eenheden verkleint de kloof. Het dicht deze niet.

> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.
> *Language Model Tokenizers Introduce Unfairness Between Languages.*
> [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/74bb24dca8334adce292883b4b651eda-Abstract-Conference.html).

---

## 4. Waarom dit sommige talen structureel raakt, niet alleen statistisch

Ondervertegenwoordiging in de trainingsstapel is één oorzaak. Er is een tweede, en
die verdwijnt niet door gegevens toe te voegen.

Talen verschillen in hoeveel werk een enkel woord verzet.

In het Engels bestaat een zin meestal uit losse woorden op een rij: *I saw them*. Drie
woorden, drie concepten, spaties ertussen. Tokenizers zijn gebouwd door mensen
die werken aan talen die zich op deze manier gedragen, en ze gaan hiervan uit — de meesten
behandelen een spatie letterlijk als een grens tussen stukjes.

Andere talen bouwen een hele bijzin in **één woord**, door betekenisvolle
delen op elkaar te stapelen. Taalkundigen noemen dit **polysynthetische** talen, en ze komen
vaak voor bij inheemse talen van de Amerika's, en elders.

> **Uitgewerkt voorbeeld.** In het Plains Cree (nêhiyawêwin) betekent *nikî-wâpamâwak*
> grofweg "Ik zag hen". Het is één woord. Daarbinnen bevinden zich verschillende betekenisvolle delen:
> wie er handelt, dat de handeling in het verleden ligt, het zien zelf, en wie er
> gezien wordt.
>
> Een spreker van het Engels krijgt daar vier woorden voor, en een tokenizer die is getraind op
> het Engels zal waarschijnlijk vier stukjes gebruiken. Een tokenizer die nog nooit Cree heeft gezien,
> heeft geen vermelding voor een van die delen, dus versnippert het dat ene woord in
> fragmenten die geen enkele van de betekenisdragende grenzen respecteren.

Er gaan twee dingen tegelijk stuk. Het woord kost veel meer stukjes dan zou moeten —
en de stukjes **doorkruisen de betekeniseenheden**, waardoor het model een
structuur opnieuw moet samenstellen die de tokenizer zojuist heeft vernietigd.

Het toevoegen van meer Cree-tekst aan de trainingsstapel verbetert het eerste probleem. Het helpt slechts
gedeeltelijk bij het tweede, omdat het algoritme nog steeds compressie optimaliseert,
en compressie niet weet dat een grens betekenisvol is.

---

## 5. Van tokenisatie naar een verkeerd antwoord

De keten van "slechte segmentatie" naar "verkeerde uitvoer" is kort.

1. De tokenizer breekt een woord af bij grenzen die geen betekenis dragen.
2. Het model leert zwakkere associaties, omdat hetzelfde concept verschijnt onder
   veel verschillende fragmentspellingen in plaats van één consistent stukje.
3. Bij het genereren stelt het model de uitvoer fragment voor fragment samen.
4. Fragmenten die afzonderlijk plausibel zijn, kunnen combineren tot een woord dat **niet
   bestaat** in de taal.

Die laatste stap is degene om vast te houden. In een taal waar woorden zijn opgebouwd uit
delen, kan een model iets produceren dat er goed gevormd uitziet voor iedereen die de taal
niet spreekt — correct ogende stukjes, samengevoegd tot een woord dat geen enkele spreker
ooit zou zeggen.

Standaard automatische beoordeling zal dit vaak niet opmerken, omdat die scores meestal
de overlap met een referentieantwoord meten, en een verkeerd woord dat is opgebouwd uit juist ogende
fragmenten nog steeds kan overlappen.

:::danger[Waarom dit belangrijk is buiten kwaliteitsscores om]
Een uitvoer die vloeiend en verkeerd is, is gevaarlijker dan een die overduidelijk
kapot is. Een lezer die de taal niet spreekt, heeft geen manier om dit te weten. Dit is een
groot deel van de reden waarom Champollion aandringt op validatie door mensen die de taal
spreken, en op structurele controles die vragen "is dit een echt woord?" in plaats van
alleen "lijkt dit op het verwachte antwoord?"
:::

---

## 6. Wie beslist, en waarom dat het eigenlijke punt is

Alles hierboven volgt uit één keuze: **welke tekst in de stapel zat waarvan de
tokenizer heeft geleerd.**

Degene die die keuze maakt, beslist hoe elke taal wordt opgeknipt, hoeveel het
zal kosten om deze te gebruiken, en hoe hard het model zal moeten werken om deze te representeren. Die
beslissing wordt één keer genomen, in een vroeg stadium, meestal door een kleine groep, en is in feite
permanent voor de levensduur van dat model — de tokenizer is niet iets dat u
achteraf kunt aanpassen.

Het wordt ook bijna nooit besproken. Debatten over taaltechnologie gaan meestal
over gegevens, modelgrootte en kwaliteitsscores. De stap die beslist of een
taal überhaupt representeerbaar is, ligt onder al deze zaken, en wordt behandeld als
loodgieterswerk.

Daarom bestaat deze pagina. Als een gemeenschap oprechte controle wil over hoe haar
taal door machines wordt behandeld, is het beheersen van de gegevens niet voldoende. De
vraag *"wie heeft besloten hoe onze woorden in stukjes worden geknipt?"* heeft een antwoord, en
voor de meeste talen in de wereld is dat antwoord momenteel: iemand anders, als een
bijwerking van het comprimeren van een stapel tekst die de taal nauwelijks
bevatte.

---

## Wat u hierna kunt lezen

- [Wat Champollion is](/docs/what-is-champollion) — het project waar deze pagina bij hoort, en wat het doet aan het bovenstaande.
- [Hoe modellen worden getraind](/docs/network/context/mt-training-concepts) — de woordenschat voor de stap *na* tokenisatie, met dezelfde 'beginnen vanaf nul'-benadering.
- [Eerlijke beperkingen](/docs/network/honest-limitations) — wat dit project **niet** beweert.
- [Gegevensbeheer (Data Stewardship)](/docs/network/sovereignty/data-sovereignty) — wie de sleutels van een corpus in handen heeft, en wat dat in de praktijk betekent.
