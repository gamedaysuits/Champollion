---
sidebar_position: 2
title: "Eigendom & Voorwaarden"
---

# Eigendom & Voorwaarden

> **Samenvatting.** Champollion heeft bewust geen universele overeenkomst.
> Voorwaarden worden per corpus, per taal en per prijs vastgesteld door de
> beheerder die eigenaar is van de data — de taak van het platform is om die
> voorwaarden te respecteren, wat ze ook inhouden. Deze pagina beschrijft de
> dimensies die een termsheet omvat en het **Community Transfer Template**,
> het standaard uitgangspunt voor gesponsorde prijzen op corpora van
> Inheemse talen.

## Het voorwaardenraamwerk

Champollion is ontworpen om flexibel te zijn in zijn voorwaarden, zodat alle
licenties worden gerespecteerd — en zodat het nieuwe arrangementen kan
ondersteunen: geheime corpora, door de gemeenschap beheerde testsets en
soevereine implementatievereisten. Verschillende talen zullen verschillende
overeenkomsten hebben. Een CC0-corpus, een uitsluitend voor onderzoek bestemd
gemeenschapscorpus en een verzegelde goudstandaard-set die wordt beheerd door
een stamraad kunnen allemaal deelnemen, elk op eigen voorwaarden.

Wat uniform is, is de machinerie die die voorwaarden honoreert: exposure lanes,
licentiepoorten, quarantaine en fetch-from-source-registratie (zie
[Corpora registreren](/docs/network/sovereignty/registering-corpora)). Wat
*nooit* uniform is, is de overeenkomst zelf.

Wanneer een corpusbeheerder voorwaarden vaststelt — voor deelname aan een
benchmark, voor een gesponsorde prijs of voor iets anders — beantwoordt de
termsheet een beperkte reeks vragen:

| Dimensie | De vraag |
|---|---|
| **Corpus-exposure** | Welke lane — openbaar, uitsluitend voor onderzoek of privé? Worden referenties ooit getoond? |
| **Eigendom van de methode** | Als een prijs wordt gewonnen, wie is dan eigenaar van de winnende methode — de ontwikkelaar, de gemeenschap of gezamenlijk? |
| **Implementatie** | Wie mag de methode implementeren, waar en onder welke voorwaarden? |
| **Zelfhosting** | Moet de methode volledig draaien op door de gemeenschap beheerde infrastructuur? |
| **Geheimhouding** | Is de testset verzegeld? Wie beheert de sleutels? Wie autoriseert elke evaluatierun? |
| **Vergoeding** | Wat ontvangen bouwers, validators en reviewers? (Gepubliceerde standaarden: [Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid)) |

Geen van deze vragen heeft een door het platform opgelegde beantwoording. De
onderstaande standaarden zijn een template, geen regel.

## Het Community Transfer Template

Voor gesponsorde prijzen op corpora van Inheemse talen werkt het standaard
template — aangeboden als uitgangspunt voor het bestuurlijk orgaan van een
gemeenschap om te herzien — als volgt:

### 1. Methode-ontwikkeling
Een onderzoeker, student of ontwikkelaar bouwt een vertaalmethode — een
FST-gestuurde pipeline, een gecoachte LLM, een fijnafgestemd model of een
andere aanpak — met eigen middelen en openlijk gelicentieerde data.

### 2. Netwerkevaluatie
De methode wordt gebenchmarkt via de [eval harness](/docs/network/specifications/harness).
Elke inzending wordt gekoppeld aan een specifieke Git-commit en datasetversie
via een vingerafdruk. Scores zijn reproduceerbaar.

### 3. Gemeenschapsreview
Resultaten worden beoordeeld door taalwerkers uit de gemeenschap. Een hoge
score op het leaderboard bewijst dat de methode *werkt*; het bewijst niet dat
ze *passend* is. Tweetalige sprekers valideren een steekproef van uitvoer, en
de reviewers van de gemeenschap kunnen een methode om welke reden dan ook
afwijzen.

### 4. Eigendomsoverdracht
Wanneer een methode voldoet aan de prijsdrempel (geautomatiseerde statistieken
**en** menselijke validatie), draagt de ontwikkelaar de methode over — broncode,
getrainde gewichten, configuratie, coachingdata — aan de bestuurlijke
organisatie van de gemeenschap (een stamraad, taalautoriteit of vergelijkbaar
orgaan gekozen door de gemeenschap, nooit door Champollion). De gemeenschap is
volledig eigenaar van het artefact: zij kan het inspecteren, aanpassen,
implementeren, archiveren of in licentie geven, zonder enige voortdurende
aanspraak van de ontwikkelaar of van Champollion.

Componenten van derden waarvan de ontwikkelaar geen eigenaar is (een
open-weight basismodel, een AGPL FST) kunnen niet in eigendom worden
overgedragen — zij gaan over naar de gemeenschap onder hun eigen open
licenties, en dat is de reden waarom toelaatbaarheid voor een prijs vereist
dat elke afhankelijkheid rechten met zich meebrengt die de gemeenschap
daadwerkelijk kan ontvangen. Zie de afhankelijkheidsklassen in de
[Method Interface-specificatie](/docs/network/specifications/methods#method-validity-and-dependency-classes).

De ontwikkelaar behoudt wat onderzoekers dienen te behouden: het onbeperkte
recht om de aanpak en resultaten te publiceren, hun technieken overal opnieuw
te gebruiken en permanente naamsvermelding als maker van de methode.

### 5. Implementatie — als en hoe de gemeenschap dat kiest
De gemeenschap beslist of de methode überhaupt wordt geïmplementeerd, door wie
en onder welke voorwaarden. Onafhankelijke implementatie is volledig de
aangelegenheid van de gemeenschap: **Champollion ontvangt geen enkel aandeel
van wat een gemeenschap verdient met een asset die zij bezit**, en heeft zelf
geen implementatierechten.

:::note[Status: sjabloon, geen staat van dienst]
Er is nog geen prijs opengesteld en er heeft nog geen overdracht plaatsgevonden — het klassement
bevat momenteel geen gepubliceerde runs. Dit sjabloon is gedocumenteerd zodat de beoogde
voorwaarden transparant zijn voordat iemand er moeite in steekt, en zodat het bestuursorgaan van een gemeenschap
een concreet concept heeft om op te reageren in plaats van een blanco pagina.
Een ondertekend instrument, opgesteld met juridisch advies voor de specifieke partijen, is wat
dit alles bindend zou maken.
:::

## Voor onderzoekers

Als u een methode ontwikkelt voor een Inheemse taal:

1. **Bouw een relatie op** met de taalgemeenschap voordat u begint
2. **Gebruik openlijk gelicentieerde data** voor ontwikkeling (geen door de gemeenschap beperkte bronnen)
3. **Documenteer herkomst** in uw [run card](/docs/network/specifications/run-card) — elke bron, de licentie ervan en de oorsprong
4. **Lees de voorwaarden van de prijs voordat u ervoor bouwt** — als de voorwaarden overdracht omvatten, is uw bijdrage de architectuur en techniek (van u om te publiceren en opnieuw te gebruiken); de bijdrage van de gemeenschap is de taalkundige kennis die het laat werken voor hun taal

## Zie ook

- [Databeheer](/docs/network/sovereignty/data-sovereignty) — het standpunt dat deze voorwaarden implementeert
- [Hoe het werk wordt gefinancierd](/docs/network/sovereignty/economic-model) — waar geld naartoe gaat en wat Champollion ontvangt (niets)
- [Corpora registreren](/docs/network/sovereignty/registering-corpora) — exposure lanes en fetch-from-source
- [Prijsspecificatie](/docs/network/specifications/prizes) — drempelvoorwaarden en claimproces
