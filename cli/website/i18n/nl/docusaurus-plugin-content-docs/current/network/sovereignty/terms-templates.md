---
sidebar_position: 10
title: "Voorwaarden Templates"
slug: /network/sovereignty/terms-templates
description: "Aanpasbare, vertrouwensarme voorwaardensuggesties voor een gemeenschap die een soevereine wedstrijd organiseert — eigenaarschap, licenties op basis van scores, hash-verankerde integriteit, standaard gesloten bij fouten, en een eerlijke bespreking van trojan-horse-risico's."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The runbook these terms attach to"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Termsjablonen

> **Samenvatting.** Startpunttermen die een gemeenschap of organisatie kan
> aanpassen bij het uitvoeren van een [soeverein wedstrijdprogramma](/docs/network/sovereignty/run-a-sovereign-contest).
> De ontwerpfilosofie is doorlopend **vertrouwensloos-gericht**: waar mogelijk
> wordt een term onderbouwd door een mechanisme (een hash, een toegangspoort,
> een append-only log) in plaats van een belofte. Elke term bestaat uit één
> korte alinea plus een begrijpelijke toelichting.

:::warning[Dit is geen juridisch advies]
Dit zijn ontwerpideeën vanuit een niet-commercieel onderzoeksproject, geen juridisch
advies, en wij zijn geen juristen. Wetgeving verschilt per rechtsgebied, en Indigenous
data governance-kaders leggen verplichtingen op die geen enkel sjabloon kan
nakomen. Laat alles door uw eigen juridisch adviseur — en uw eigen gemeenschapsbestuur —
beoordelen voordat u er gebruik van maakt.
:::

---

## Kernbepalingen

### 1. Het corpus is en blijft eigendom van de eigenaar

*Bepaling.* Het evaluatiecorpus, alle inzendingen daarin en alle afgeleide
metadata blijven het uitsluitende eigendom van de registrerende
gemeenschap/organisatie. Geen enkel gebruik van de registratie-, wedstrijd- of
evaluatiemechanismen van het netwerk draagt enig recht, titel of belang in het
corpus over aan het platform, aan methodeontwikkelaars of aan enige sponsor.
Het platform bewaart geen kopie en maakt geen aanspraak op een licentie buiten
de digest van de versleutelde blob.

*Toelichting:* het uitvoeren van een wedstrijd op basis van uw corpus geeft
niemand een aandeel daarin. Champollion bewaart een hash, geen aanspraak.

### 2. Evaluatie verleent uitsluitend een licentie voor scores — niets anders

*Bepaling.* Een geautoriseerde evaluatierun verleent het platform en de
methodeontwikkelaar een licentie om **uitsluitend numerieke scores en
geaggregeerde statistieken** te ontvangen en te publiceren. De licentie verleent
**geen** recht om corpusinhoud na de run te bewaren, **geen** recht om een
model daarop te trainen, bij te sturen of te coachen, en **geen** recht om
afgeleide corpora, gememoriseerde voorbeelden of opzoektabellen daaruit samen
te stellen. Elke inhoudsbewaring na de run beëindigt de licentie en maakt de
resultaten van de run ongeldig.

*Toelichting:* wat uit een verzegelde run komt, is een getal. Zinnen komen er
nooit uit — niet in een leaderboard, niet in een trainingsset, niet in iemands
cache.

### 3. Hash-verankerde integriteit: de digest wordt gepubliceerd, de inhoud nooit

*Bepaling.* Het corpus wordt uitsluitend geïdentificeerd door de gepubliceerde
SHA-256 digest van de versleutelde blob en een versielabel. Alleen blobs die
overeenkomen met de digest gelden als het corpus; elke run op niet-overeenkomende
bytes is ongeldig. Publicatie van de digest is geen publicatie van de inhoud,
en niets in deze bepalingen verplicht de eigenaar ooit de inhoud aan wie dan
ook openbaar te maken.

*Toelichting:* iedereen kan controleren *welk* corpus is gebruikt; niemand
krijgt het te *lezen*. Als de bytes niet overeenkomen met de hash, telt de run
niet.

### 4. Standaard gesloten bij twijfel

*Bepaling.* Elke onduidelijkheid wordt opgelost in de richting van geen toegang
en geen publicatie. Een verzoek dat niet uitdrukkelijk is goedgekeurd door de
bewaardrempelwaarde wordt geweigerd; een verlopen of gebruikte machtiging is
vervallen; een resultaat waarvan de herkomst niet kan worden geverifieerd wordt
niet gepubliceerd; een corpus waarvan de registratie verloopt, kan niet meer
worden uitgevoerd. Stilzwijgen geldt nooit als toestemming.

*Toelichting:* bij twijfel is het antwoord nee. Niets staat standaard open.

### 5. Bewaardersmachtiging is vereist voor elke run

*Bepaling.* Geen enkele evaluatie mag worden uitgevoerd op het verzegelde corpus
zonder een vastgelegde, drempelwaarde-goedgekeurde machtiging en een eenmalige,
tijdgebonden machtiging die is gekoppeld aan de specifieke methode, corpusversie
en evaluatieomgeving. Alle machtigingsgebeurtenissen, inclusief weigeringen en
geblokkeerde pogingen, worden vastgelegd in een append-only, openbaar
herhaalbaar auditlog.

*Toelichting:* uw bewaarders keuren elke afzonderlijke run goed, één run
tegelijk, en de volledige geschiedenis is openbaar en manipulatiebestendig.
(De cryptografische drempelwaarde-ondertekeningstools zijn nog in ontwikkeling
— zie het [statusvak in het draaiboek](/docs/network/sovereignty/run-a-sovereign-contest) —
dus momenteel wordt deze bepaling gehandhaafd als vastgelegd proces, nog niet
als wiskunde.)

### 6. Prijsfondsen worden beheerd door de sponsor en de toekenningsregel is openbaar

*Bepaling.* Prijsfondsen worden beheerd door de genoemde sponsororganisatie of
een aangewezen gemeenschapsfonds — nooit door het platform. De
toekenningsdrempel wordt gepubliceerd voordat de wedstrijd opent, is
verifieerbaar op basis van gepubliceerde scores plus het eigen
sprekervalidatieoordeel van de gemeenschap, en de toekenningsbeslissing behoort
uitsluitend toe aan de houder van de fondsen.

*Toelichting:* het geld berust bij degene die het heeft ingelegd, de lat is
openbaar, en of de lat is gehaald is voor iedereen controleerbaar. Champollion
kan geen prijs uitbetalen, inhouden of doorsturen, omdat Champollion nooit over
het geld beschikt.

---

## Trojaans-paard-risico's {#trojan-horse-risks}

Een eerlijk termsdocument benoemt de manieren waarop de regeling kan worden
aangevallen. Neem deze op in uw document — een sponsor of gemeenschap die ze
heeft gelezen, is moeilijker te misleiden.

### Kwaadaardige methode-inzendingen die testdata proberen te exfiltreren

Een "methode" is ingediende code. Een vijandige methode kan proberen
testzinnen te smokkelen — door ze te coderen in de uitvoer, ze naar logs te
schrijven of ze naar buiten te sturen. **Mitigaties:** uitsluitend scores als
uitvoer (uitvoertekst per inzending uit verzegelde runs wordt nooit gepubliceerd
— vandaag gehandhaafd op de datalaag); een **sandbox zonder uitvoer** voor
verzegelde uitvoering (🔲 in ontwikkeling — totdat dit beschikbaar is, dient
u deze mitigatie als gedeeltelijk te beschouwen en de goedkeuringen van uw
bewaarders dienovereenkomstig te wegen); en **query-/runbudgetten per methode
per ronde** — een methode krijgt een klein, vast aantal verzegelde runs, zodat
het corpus niet kan worden gereconstrueerd door herhaald testen, zelfs niet via
het scoreskanaal.

### Vergiftigde of gecontamineerde ingediende corpora

De aanval kan ook de andere kant op lopen: iemand biedt een gemeenschap een
"kant-en-klaar" testcorpus aan dat subtiel onjuist, aanstootgevend of al
openbaar is (zodat methoden het hebben gememoriseerd en scores betekenisloos
zijn). **Mitigaties:** herkomstvereisten voor elke inzending (wie het heeft
geschreven, wanneer, uit welke bron); [sprekervalidatie](/docs/network/specifications/speaker-validation)
van het corpus zelf vóór verzegeling; en contaminatiescreening op openbare
gegevens voordat een corpus wordt geaccepteerd als kwalificatie- of
goudstandaard.

### Licentie-trojanen in afhankelijkheden

Een winnende methode die stilzwijgend inhoud of code bundelt waarvan de
licentie het beoogde gebruik door de gemeenschap verbiedt (commerciële
inzet, herdistributie), vergiftigt de overdracht — u wint een tool die u
juridisch niet kunt gebruiken. **Mitigaties:** declaraties van
afhankelijkheidsklassen en een mechanische licentiepoort voor inzendingen
(zie de tabel met afhankelijkheidsklassen in de [Prijsspecificatie](/docs/network/specifications/prizes));
niet-gedeclareerde afhankelijkheden zijn diskwalificerend.

### Credential-phishing

Iedereen die een wedstrijd uitvoert, wordt een doelwit voor aanvallen in de
trant van "plak hier uw token om uw registratie te verifiëren".
**Mitigaties:** plak nooit tokens, sleutels of inloggegevens in pagina's van
derden en deel ze niet via chat; alle authenticatie in dit project verloopt
via de OAuth-flow van de CLI, en **er bestaan geen persoonlijke
toegangstokenflows via de browser meer** — elke pagina die daarom vraagt, is
vijandig. Bewaardersbeslissingen dienen te verlopen via kanalen die uw
gemeenschap al vertrouwt.

### Wanbetaling van de prijs door de sponsor

Het stille faalscenario: methoden halen de lat en de sponsor betaalt niet.
**Mitigaties:** publiceer de identiteit van de fondsbeheerder en de
beheersregeling (organisatieaccount, fonds, escrow-agent) *voordat* de
wedstrijd opent; maak toekenningsvoorwaarden verifieerbaar op basis van
gepubliceerde scores, zodat een wanbetaling openbaar zichtbaar is als
wanbetaling en niet ontkend kan worden als een beoordelingskwestie; en geef
de voorkeur aan een beheerder met iets te verliezen qua reputatie. Champollion
kan dit risico niet garanderen — het beheert de fondsen nooit, by design —
dus de geloofwaardigheid van een prijs is precies de geloofwaardigheid van de
genoemde beheerder.

---

## Gebruik van deze sjablonen

Kopieer wat van toepassing is, verwijder wat niet van toepassing is, voeg toe
wat uw bestuur vereist, en publiceer het resultaat naast uw wedstrijd zodat
deelnemers instemmen met *uw* voorwaarden, niet met een vaag gevoel. Voorwaarden
per gemeenschap — inclusief overdracht van methode-eigendom voor gesponsorde
prijzen — zijn hier de norm, niet de uitzondering: zie
[Eigendom & Voorwaarden](/docs/network/sovereignty/ownership-transfer).
