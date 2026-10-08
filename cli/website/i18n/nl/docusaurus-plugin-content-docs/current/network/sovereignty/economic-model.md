---
sidebar_position: 3
title: "Hoe het werk wordt gefinancierd"
---

# Hoe het werk wordt gefinancierd

> **Managementsamenvatting.** Champollion is een niet-commercieel onderzoeksproject —
> source-available en gratis voor niet-commercieel gebruik, met een evaluatie-omgeving en
> registers die open source zijn — en vandaag de dag wordt het **volledig door de
> oprichter zelf gefinancierd**. Geen subsidies,
> geen sponsors, geen instelling erachter — nog niet: we [nodigen sponsors nu
> actief uit](/get-involved#sponsors). Elke vorm van sponsoring is
> **100% pass-through**: het financiert corpusopbouw, tooling en gemeenschapswerk
> tegen openbare tarieven, met een publieke verantwoording — niets daarvan gaat naar Champollion. Er is
> nog niets ontvangen en er worden momenteel geen fondsen beheerd.
> Niets hiervan is gemonetariseerd: er is geen betaalde API, geen verbruiksmeting, geen
> omzetaandeel en geen platformaanspraak op eigendommen van een gemeenschap. Deze pagina legt
> duidelijk uit waar het geld momenteel vandaan komt, wat met financiering bekostigd zou worden en hoe u
> ons kunt bereiken als u aan het eerste deel wilt bijdragen.

Champollion is tooling voor onderzoek en ontwikkeling op het gebied van machinevertaling —
source-available en gratis voor niet-commercieel gebruik. De CLI, de MCP-server
en de modeltrainingssuite (nmt-forge) vallen onder PolyForm Noncommercial 1.0.0;
de evaluatie-omgeving is open-source AGPL-3.0-or-later; de data-
registers zijn open-source Apache-2.0. [Wie dit mag gebruiken](/docs/getting-started/who-may-use-this)
legt in duidelijke bewoordingen uit wat elke licentie omvat. Er zit geen commercieel
product achter — en vooralsnog evenmin enige financiering.

## Waar het geld vandaag vandaan komt

**Één persoon.** Alles wat tot nu toe is gebouwd — het raamwerk, de CLI, de taalindex, de benchmarkspecificaties, de site — is zelfgefinancierd door de oprichter van het project. We zeggen dit ronduit om twee redenen:

1. **Eerlijkheid over schaal.** Een zelfgefinancierd project kan nog niet betalen voor de corpusconstructie en sprekersvalidatie die de specificaties berekenen. De gepubliceerde tarieven zijn toezeggingen over *hoe* geld beweegt wanneer het er is, niet het bewijs dat het al beweegt.
2. **Het is een open uitnodiging.** De infrastructuur is gebouwd en de eenheidskosten zijn gepubliceerd. Wat ontbreekt is de financiering om het te laten draaien. Als u taaltechnologie financiert — als subsidieverlener, stichting, afdeling of individu — **horen we graag van u**: open een issue op [GitHub](https://github.com/gamedaysuits/Champollion) of neem contact op via [champollion.dev](https://champollion.dev).

## Wat financiering oplevert

De kosten zijn al gespecificeerd, zodat een financier concrete, afgebakende zaken kan financieren:

- **Een corpusopdracht voor een taal** — $2.500–6.000 aan sprekervergoeding ($50–65 CAD/uur, gepubliceerde tarieven) bouwt een benchmarkcorpus dat eigendom blijft van de bouwer. Zie [Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid).
- **Een ronde metriekvalidatie** — $1.475–1.920 betaalt drie tweetalige sprekers om de geautomatiseerde metrieken te toetsen aan menselijk oordeel.
- **Een gesponsorde prijs** — financier een gerichte drempel (bijvoorbeeld betrouwbaar Engels → Plains Cree). Prijsfondsen worden beheerd en toegekend door een door de gemeenschap bestuurd fonds, op de voorwaarden van de gemeenschap — niet door Champollion. Zie de [Prijsspecificatie](/docs/network/specifications/prizes).
- **Reken- en API-credits** — gebundeld om de openbare benchmarkwachtrij te draaien.

In de praktijk maakt dit het Network tot een mechanisme voor de verdeling van financiering voor taaldatawerk: geld erin, betaald werk voor de mensen die corpora bouwen eruit — en zij behouden wat zij bouwen.

## Waar het geld naartoe gaat

Zodra die er wel is — momenteel worden er geen fondsen beheerd:

- **Naar corpusbouwers en validators, tegen gepubliceerde tarieven.** Betaling draagt geen eigendom over: een bouwer wordt betaald voor het werk *en* blijft de beheerder van het corpus.
- **Naar prijswinnaars, via gemeenschapsfondsen.** Wanneer een gesponsorde prijs wordt opgeëist, betaalt het fonds de ontwikkelaar; de methode wordt overgedragen aan de gemeenschap onder de voorwaarden van die prijs (zie [Eigendom & Voorwaarden](/docs/network/sovereignty/ownership-transfer)).
- **Naar infrastructuur** — hosting, evaluatieruns en onderhoud.
- **Openbaar verantwoord.** Gesponsorde opdrachten worden openbaar geregistreerd — wat er is gefinancierd, tegen welk gepubliceerd tarief en wat er is geleverd — zodat een sponsor (en iedereen anders) kan controleren dat de doorstroombelofte is nagekomen.

## Wat Champollion inhoudt

**Niets.** Er is geen inkomstenverdeling, geen infrastructuurpercentage en geen aanspraak op gemeenschapsbezit. Als een gemeenschap een methode die zij bezit inzet — op eigen servers, via eigen kanalen, commercieel of niet — is alles wat zij verdient van haarzelf. Corpora die bij het Network zijn geregistreerd blijven volledig eigendom van de beheerder, voor, tijdens en na elke evaluatie.

Als er ooit commerciële mogelijkheden rond dit werk ontstaan, staan we open voor dat gesprek — maar een dergelijke regeling zou op dat moment worden onderhandeld, met de beheerders wiens data of methoden betrokken zijn, op hun voorwaarden. Niets is vooraf vastgelegd in deze documentatie, en geen enkel document hier mag worden gelezen als een reservering van een aandeel van iets voor het platform.

## Voor financiers

De duurzaamheidsvraag voor taaltechnologie is doorgaans: "wat gebeurt er na afloop van de subsidie?" Voor een niet-commercieel project is het eerlijke antwoord: de *bezittingen* overleven de financiering, omdat ze eigendom zijn van de mensen die ze kunnen onderhouden.

| Traditioneel model | Beheermodel |
|---|---|
| Subsidie financiert onderzoek | Subsidie financiert onderzoek |
| Artikel gepubliceerd | Corpus gebouwd, methoden gemeten |
| Subsidie eindigt, tool verlaten | Gemeenschap bezit het corpus en elke overgedragen methode volledig |
| Gemeenschap ontvangt niets | Sprekers zijn betaald voor elk uur; de bezittingen blijven thuis |

Meetbare resultaten voor een financier:

- Corpora gebouwd en geregistreerd, onder beheerdersbeheer
- Betaalde sprekeruren geleverd aan taalgemeenschappen
- Methoden gemeten en (waar de voorwaarden van een prijs dit bepalen) overgedragen aan gemeenschapseigendom
- Taalparen gedekt door betrouwbare openbare benchmarks

Zie de [Benchmarkspecificatie](/docs/network/specifications/benchmark), §10 voor gedetailleerde kostenmodellen.

## Zie ook

- [Eigendom & Voorwaarden](/docs/network/sovereignty/ownership-transfer) — voorwaarden per taal en de overdrachtssjabloon
- [Databeheer](/docs/network/sovereignty/data-sovereignty) — het standpunt dat dit model implementeert
- [Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid) — gepubliceerde tarieven
