---
title: "De vangrails"
slug: /guardrails
description: "De fouten die vertaalprojecten ongemerkt verpesten, en wat de rails aan elk daarvan doen — in gewone woorden."
---

# De vangrails, één voor één

De meeste vertaalprojecten mislukken niet met veel kabaal. Ze mislukken in stilte. Woorden die
in vertrouwen zijn gedeeld, belanden ergens waar ze niet horen. Een vertaler lijkt geweldig —
omdat hij wordt getest op zinnen die hij al uit het hoofd heeft geleerd. Een gelukkige ronde
lijkt op vooruitgang.

Elke onderstaande vangrail voorkomt een van deze situaties. De hulpmiddelen handhaven de meeste
zelfstandig; een paar zijn afhankelijk van u en uw assistent, en dat staat er telkens bij vermeld.

Een woord dat u hieronder tegenkomt: een **score** is een getal dat aangeeft hoe dicht de zinnen
van een vertaler liggen bij de manier waarop een spreker ze heeft gezegd. Een hogere score betekent dichterbij.

## 1. Uw woorden die het huis verlaten

**Wat er misgaat.** Woorden die in vertrouwen zijn gedeeld, belanden op de computer van iemand anders,
of binnen de AI van iemand anders.

**Wat de rails doen.** Elk bestand krijgt een notitie, die er direct naast wordt bewaard, met daarin wat
de mensen aan wie het toebehoort hebben besloten: mag het ooit deze computer verlaten, en mag een
vertaler ervan leren. Elk hulpmiddel respecteert die notitie.

- Bestanden zijn standaard privé, totdat de mensen aan wie ze toebehoren antwoord geven.
- Zodra zij antwoorden, kunnen de hulpmiddelen de regels strenger maken, nooit soepeler. Alleen
  een mens kan ze versoepelen, met opzet, handmatig. Als iemand die niet was
  gevraagd later alsnog ja zegt, wordt die instemming toegevoegd.
- Niemands woorden worden gebruikt om een vertaler te leren totdat de mensen aangeven dat die
  sprekers ermee akkoord zijn gegaan. Woorden van sprekers die nog niet hebben ingestemd, of die
  nee hebben gezegd, worden weggelaten.
- Een vertaler die van privézinnen heeft geleerd, wordt eveneens als privé behandeld,
  omdat hij kan herhalen wat hij heeft geleerd.
- Voor bestanden die op deze computer blijven, tonen de hulpmiddelen uw AI-assistent aantallen,
  geen zinnen.

**Wat van u afhangt.** De meeste AI-assistenten draaien op computers van een bedrijf en
sturen alles wat ze lezen naar dat bedrijf door. Als u zo'n assistent vraagt uw bestanden te openen, kan
hij dat — geen enkel hulpmiddel kan dat tegenhouden. Gebruik voor woorden die u privé wilt houden een assistent
die op uw eigen computer draait, of vraag er niet om ze te openen. En de hulpmiddelen
kunnen niet zien wie een vraag heeft beantwoord, dus de mensen aan wie de woorden toebehoren moeten
zelf antwoorden. [Uw woorden, uw regels](/docs/your-words-your-rules) biedt het volledige
overzicht.

## 2. De toets die stiekem het huiswerk is

**Wat er misgaat.** U test een vertaler op zinnen waarvan hij heeft geleerd. Hij
onthoudt ze en lijkt briljant — om vervolgens over alles wat nieuw is te struikelen. Het is alsof
u een leerling beoordeelt op exact dezelfde vragen uit het huiswerk van gisteravond.

**Wat de rails doen.** Voordat het leren begint, zet u testzinnen opzij die
door een vloeiende spreker zijn gecontroleerd. Ze worden gemarkeerd zodat geen enkele vertaler er ooit
van leert, en de hulpmiddelen laten ze weg uit wat ze weergeven, tenzij een mens erom vraagt
ze te zien.

## 3. Bijna-kopieën

**Wat er misgaat.** De exacte testzin zit niet tussen de zinnen waarvan de
vertaler heeft geleerd — maar wel een zin die er bijna hetzelfde uitziet. *"We gaan naar de
winkel"* wordt getest, en *"We gaan nu naar de winkel"* is geleerd. De
vertaler krijgt waardering voor geheugen, niet voor vertalen.

**Wat de rails doen.** Voordat het leren begint, wordt elke zin waarvan de vertaler
zou leren vergeleken met de testzinnen. Kopieën en
bijna-kopieën worden apart gezet. Zinnen die alleen een patroon delen worden behouden maar
geteld, zodat u kunt zien in welke mate ze de score mogelijk rooskleuriger voorstellen dan
hij in werkelijkheid is.

## 4. Spieken naar de antwoorden

**Wat er misgaat.** Als u uw vertaler na elke kleine verandering controleert aan de hand van de testzinnen,
stemt u hem langzaam af op die specifieke zinnen. De test vertelt
u dan niets nieuws meer.

**Wat de rails doen.** De dagelijkse vooruitgang wordt beoordeeld aan de hand van een aparte set
**oefenzinnen**, apart gezet van uw gegevens. Elke keer dat de trainingshulpmiddelen
de testzinnen scoren, wordt dat vastgelegd, en ze tonen pas een testscore
nadat er een voorspelling is genoteerd.

## 5. Bepalen wat u verwachtte nadat u het resultaat hebt gezien

**Wat er misgaat.** Zodra een resultaat op het scherm staat, is het verleidelijk om te zeggen: *"dat is
ongeveer wat we dachten."* Dan kan het resultaat u niet meer verrassen, en kan het
u niets leren.

**Wat de rails doen.** Voordat de eerste vertaler wordt getraind, schrijven de mensen
die hem bouwen in hun eigen woorden op wat ze verwachten. De rails gaan pas
verder als dat is opgeschreven, en later wordt het resultaat daaraan getoetst.

## 6. Geluk aanzien voor vooruitgang

**Wat er misgaat.** Twee vertalers kunnen puur door toeval net iets anders scoren,
vooral bij een klein aantal zinnen. Een gelukkige ronde lijkt op
vooruitgang, en een daadwerkelijke verbetering kan verloren gaan in de ruis.

**Wat de rails doen.** Een nieuwe vertaler wordt zin voor zin vergeleken met degene die u
gebruikt, aan de hand van dezelfde oefenzinnen. Deze wordt u alleen
aangeboden als deze hoger scoort dan wat gewoonlijk door toeval te verklaren is — en
zelfs dan neemt deze het pas over wanneer u ja zegt. Anders
melden de tools *"geen meetbare verandering"* — en hoe klein een verbetering te klein is om
te kunnen zien bij zoveel oefenzinnen. Bij minder dan 50 oefenzinnen
kan geen enkele score uitsluitsel geven, dus nemen de tools helemaal geen besluit: de beoordelingen van de spreker, op
concepten van beide zonder te weten welke welke is, geven in plaats daarvan de doorslag.

## 7. Is het beter dan een woordenboek?

**Wat er misgaat.** Een score op zichzelf zegt heel weinig. Een vertaler doet het misschien
niet beter dan elk woord opzoeken in een woordenlijst.

**Wat de rails doen.** Als u een woordenlijst hebt, meten de hulpmiddelen eerst hoe
ver u komt door elk woord op te zoeken. Een vertaler is pas het gebruiken waard waar hij
dat overtreft.

## 8. Twee vertalers verborgen in één score

**Wat er misgaat.** Wanneer een vertaler een zin niet aankan, kan een tweede
reservevertaler inspringen. Dat is prima wanneer u hem gebruikt. Maar als een testscore beide mengt,
kunt u niet zien welke van de twee u hebt gemeten.

**Wat de rails doen.** Een testscore is altijd afkomstig van één vertaler. Een reservevertaler
is toegestaan wanneer u de vertaler gebruikt, nooit wanneer u hem meet.

## 9. Meer beweren dan waar is

**Wat er misgaat.** Een enthousiaste assistent kondigt aan: *"uw vertaler is
klaar!"* terwijl hij amper iets heeft geleerd.

**Wat de rails doen.** De hulpmiddelen houden bij wat er werkelijk is gebeurd. Uw
assistent krijgt de instructie om alleen dat te rapporteren, en om elke waarschuwing woord voor
woord door te geven. Dit punt hangt ervan af of de assistent zich aan de instructies houdt.

---

Niets hiervan maakt een vertaler per definitie goed. Het zorgt ervoor dat u altijd weet waar hij
staat — en dat de mensen van wie de taal is, de leiding houden.

**Volgende:** [Wat het nog niet kan →](/docs/what-it-cant-do-yet)

## Meer informatie

- [Het operationele contract voor AI-agenten](/docs/agents/contract) — elke regel,
  en of de hulpmiddelen deze handhaven of alleen de assistent zich eraan kan houden.
- [Elk commando, stap voor stap](/docs/agents/shell) — waar elke
  controle wordt uitgevoerd, met de exacte commando's.
- Wat "meer dan geluk" hier betekent: de chrF++ van de nieuwe vertaler op de
  oefenset (dev) moet hoger zijn in een gepaarde toets en het interval moet
  boven nul blijven. De oefenset bepaalde ook het beste checkpoint van de nieuwe vertaler,
  wat de nieuwe enigszins bevoordeelt.
- [Gegevensbeheer](/docs/your-words-your-rules) — hoe gegevens
  worden gebruikt zonder uit handen te worden gegeven.
