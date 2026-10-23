---
title: "De cijfers lezen"
slug: /reading-the-numbers
description: "Wat elk getal dat de rails u tonen betekent, in begrijpelijke taal: de score op 100, het aandeel concepten dat de spreker als juist heeft gemarkeerd, bereiken en ‘geen meetbare verandering’."
---

# De cijfers lezen

De rails tonen u bij elke stap cijfers. Elk cijfer is pas nuttig als u er
drie dingen over weet: **wat het meet**, **waaruit**, en **op welke
zinnen**. De tools vermelden alle drie, en dat is uw assistent ook opgedragen. Deze pagina
legt elk type uit.

## Het aandeel concepten dat door de spreker als juist is beoordeeld

**Het cijfer dat er het meest toe doet.** In elke ronde beoordeelt een spreker de
concepten van de vertaler als juist of onjuist. *"31 van de 40 concepten als juist beoordeeld"* betekent precies wat er
staat: van de 40 zinnen die uw familie deze ronde vertaald wilde hebben, beoordeelde de
spreker er 31 als juist.

Niets wat een computer meet, weegt op tegen het oordeel van een spreker. Maar het hangt af van de
zinnen: een makkelijke week en een moeilijke week kunnen met dezelfde vertaler
verschillende cijfers opleveren. Daarom meten de tools ook telkens op dezelfde manier, op
dezelfde zinnen — de score.

## De score, uit 100

Een **score** is een getal van 0 tot 100 dat aangeeft hoe dicht de zinnen van de vertaler
in de buurt komen van de manier waarop een spreker dezelfde zinnen schreef. Het telt overeenkomende
letters en woorden, en kent gedeeltelijke punten toe: een vertaling die bijna
juist is, scoort hoger dan eentje die er ver naast zit. 100 betekent identiek.

Twee dingen om te weten:

- **Het meet nabijheid, niet juistheid.** Een goede vertaling die anders
  is geformuleerd dan die van de spreker, kan laag scoren. Een vloeiende vertaling die
  iets anders betekent, kan redelijk hoog scoren. Daarom is de controle door een spreker
  belangrijker.
- **Het is geen percentage juiste zinnen.** Een score van 60 betekent niet
  dat 60 op de 100 zinnen juist waren.

Voor wie nieuwsgierig is: deze score heet **chrF++**, en het is de gebruikelijke
methode in het vakgebied om vertalers te vergelijken. De tools rapporteren daarnaast ook andere scores.

## Bereiken

De meeste cijfers worden getoond met een **bereik**, zoals *14–22*. Dat zijn geen twee resultaten. Het geeft aan
hoe zeker de tools zijn: de werkelijke waarde ligt zeer waarschijnlijk ergens daartussenin. Bij
een klein aantal zinnen is het bereik breed. Bij veel zinnen wordt het smaller.

Wanneer twee bereiken elkaar sterk overlappen, zijn de twee vertalers in werkelijkheid mogelijk hetzelfde.

## Welke zinnen

Bij een cijfer staat altijd vermeld op welke zinnen het is gemeten:

- **Testzinnen** — de zinnen die een spreker heeft gecontroleerd en waar de vertaler nooit
  van heeft geleerd. Worden gebruikt voor de resultaten die ertoe doen, en slechts af en toe.
- **Oefenzinnen** — apart gehouden van uw gegevens, en waar eveneens nooit van is
  geleerd. Worden gebruikt om elke ronde te beoordelen, zodat de testzinnen vers blijven.
- **De zinnen van uw ronde** — de zinnen die uw familie vertaald wilde hebben; de
  beoordelingen van de spreker staan hierop.

Een cijfer dat is gemeten op zinnen waarvan de vertaler heeft geleerd, zou niets betekenen;
daarom tonen de rails u dat nooit als resultaat.

## "Geen meetbare verandering"

Dit betekent niet dat er niets is veranderd. Het betekent dat elke verandering te klein was om te
onderscheiden van toeval, gezien het aantal oefenzinnen dat u hebt. De tools geven aan
hoe groot een verandering was die ze *hadden kunnen* waarnemen. Met meer oefenzinnen kunnen ze
kleinere veranderingen zien — en dat is waarom, zolang de oefenset klein is, enkele rijen van
het formulier van elke ronde worden opengelaten voor de spreker om te schrijven.

## "Te weinig oefenzinnen om het te kunnen zeggen"

Met minder dan 50 oefenzinnen kan geen enkele score betrouwbaar aangeven
welke van twee vertalers beter is. Bij onze oefentaal, met 23 oefenzinnen,
merkte de voorzichtige regel twee nagenoeg gelijke vertalers 9 van de 100
keer als verschillend aan — en werd een werkelijke winst van ongeveer 6 punten
op 100 slechts 21 van de 100 keer opgemerkt. Bij 50 waren dat er 4 en 96.
Onder de 50 doen de hulpmiddelen dus geen uitspraak. Degene die u gebruikt
blijft behouden, en de beoordelingen van de spreker op het volgende blad
geven de doorslag.

## De woordenboekondergrens

Als u een woordenlijst hebt meegebracht, ziet u een score voor *alleen het opzoeken van elk
woord*. Dit is de ondergrens: een vertaler is pas het gebruiken waard als deze erboven
scoort. Bij zeer weinig zinnen kan een eerste vertaler daaronder vallen. Dat is
de moeite waard om te weten, niet iets om te verbergen.

## Een cijfer dat u op onze pagina's zult zien: "betekenis juist"

Wanneer we het hebben over onze verzonnen oefentaal, ziet u *"79 van de 100
exact juist"*. Dat is een aandeel van de zinnen: een computer heeft elk
onderdeel van de betekenis van elke vertaling vergeleken met de eigen grammatica van de verzonnen taal.
Dat is alleen mogelijk bij een taal die we zelf hebben bedacht, waar het juiste antwoord exact
bekend is. Bij een echte taal komt de beoordeling door een spreker daar het dichtst bij in de buurt.

**Volgende:** [Maak het beter, ronde na ronde →](/docs/make-it-better)

## Meer informatie

- [Meetregels](/docs/agents/measurement) — de exacte regels: chrF++
  met het 95%-bereik, de gepaarde vergelijking, gates en weigeringspercentages.
- [Scorespecificatie](/docs/network/specifications/scoring) — hoe elke
  gepubliceerde score wordt berekend.
- [Significantie](/docs/network/specifications/significance) — hoe wordt bepaald of iets
  "beter dan toeval" is.
