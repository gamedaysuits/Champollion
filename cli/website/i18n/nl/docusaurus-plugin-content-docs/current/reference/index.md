---
title: "Referentie"
slug: /reference
description: "Elk technisch detail in één overzicht: de commando's, de bestandsformaten, de specificaties, de technische limieten, het hosten van een verzegelde test, het scorebord, app- en websitevertaling, de Atlas en de netwerkinfrastructuur."
---

# Referentie

Het volledige technische overzicht, voor ontwikkelaars, onderzoekers en AI-agents.
De [pagina's voor mensen](/docs/) vertellen hetzelfde verhaal in duidelijke bewoordingen, en
[de handleiding voor agents](/docs/agents) legt uit hoe een agent ermee werkt; elke onderstaande
pagina beschrijft dit met uiterste precisie.

## Opdrachten

- [`champollion`](/docs/reference/cli) — elke opdracht en vlag van het projecthulpmiddel
  en de app- en websitevertaler.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — elke
  opdracht van de modeltrainingssuite, gegenereerd vanuit de parser.
- [`mt-eval`](/docs/reference/mt-eval) — elke opdracht van de evaluatieharness,
  gegenereerd vanuit de parser.
- [De MCP-server](/docs/network/getting-started/mcp-server) — beide profielen,
  elke tool en elk argument.

## Formaten

- [Framework-formaten](/docs/reference/formats) — project/1, set/1, method/1,
  gate-chain/1, deployment/1 en service-api/1, volgens hun schema's.
- [Run-kaart](/docs/network/specifications/run-card) — wat een beoordeelde run
  registreert en publiceert.
- [Coachinggegevens](/docs/concepts/coaching-data) — de grammaticanotities en woordenlijsten
  die aan een LLM-methode worden meegegeven.
- [Plugin-specificatie](/docs/reference/plugin-spec) — het manifest voor methode-plugins
  (`method.json`) waarin een vertaalmethode wordt geleverd.
- [Taalkaart](/docs/reference/language-card-spec) — het schema van een kaart
  in de Atlas.

## Specificaties

- [Scoring](/docs/network/specifications/scoring) — scoring standard/1: de
  belangrijkste corpus-chrF++-score met het bijbehorende 95%-bootstrap-interval, de standaardmetrieken
  ernaast en de diagnostische gegevens apart gehouden.
- [Significantie](/docs/network/specifications/significance) — gepaarde toetsen,
  en wanneer de ene run beter is dan de andere.
- [Methode-interface](/docs/network/specifications/methods) — wat een methode is,
  de bijbehorende klassen en afhankelijkheden.
- [Betrouwbaarheid van metrieken](/docs/network/specifications/metric-reliability) —
  welke metriek te vertrouwen voor welk type taal, op basis van menselijke beoordelingen.
- [Benchmark](/docs/network/specifications/benchmark) — het protocol dat elke
  geldige run volgt.
- [Harness](/docs/network/specifications/harness) — hoe `mt-eval` draait,
  beoordeelt en publiceert.
- [Sprekervalidatie](/docs/network/specifications/speaker-validation) — de
  menselijke beoordeling waarvoor automatische scores als vervanging dienen.

## Technische beperkingen

- [Technische beperkingen](/docs/network/honest-limitations) — wat niet wordt beweerd:
  zelfgerapporteerde vertrouwensniveaus, nog geen sprekersbeoordeling, bewaring van verzegelde tests en geen
  betrouwbaarheid per zin.

## Een verzegelde test hosten

- [Een soevereine wedstrijd organiseren](/docs/network/sovereignty/run-a-sovereign-contest)
  — het end-to-end draaiboek voor een testset die de machine van de host nooit verlaat.
- [Soevereine evaluatienode](/docs/network/sovereignty/sovereign-eval-node) — de
  beoordelingsmachine: hardware, airgap en sleutelceremonie.
- [Corpora registreren](/docs/network/sovereignty/registering-corpora) —
  blootstellingsniveaus en licentietrajecten voor een corpus dat u beheert.
- [Eigendom & voorwaarden](/docs/network/sovereignty/ownership-transfer) en
  [Voorwaardensjablonen](/docs/network/sovereignty/terms-templates) — wat een inzending
  overdraagt, vastgelegd voordat iemand deelneemt.
- [Prijzen](/docs/network/specifications/prizes) — wat een prijs vereist, als een
  sponsor er een beschikbaar stelt.

## Ranglijst en publicatie

- [Ranglijst en publicatie](/docs/reference/leaderboard) — wat de ranglijst
  is, de twee soorten benchmarks en wat een gepubliceerde run bevat.
- [Inzendregels](/docs/network/leaderboard/rules) — wat wordt geaccepteerd,
  wat wordt gediskwalificeerd en de verificatieniveaus.
- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — de geregistreerde
  datasets en hun licentietrajecten.
- [Een methode inzenden](/docs/network/getting-started/submit-a-method) — voer de
  harness uit en publiceer een run-kaart.
- [Rekenkracht bijdragen](/docs/network/getting-started/contributing-compute) —
  verwerk items uit de openbare wachtrij met uw eigen sleutel.
- [Veelgestelde vragen](/docs/network/getting-started/faq) — metrieken, modellen, FST's en
  diskwalificatie.

## App- en websitevertaling

- [App- en websitevertaling](/docs/intro) — wat `champollion sync` doet, en
  een gids voor elke pagina erover: snelstart, installatie, configuratie,
  frameworks, CI/CD, methoden, inhoud, vertaalgeheugen, de kwaliteitsgate,
  beveiliging, scripts, vertalers en probleemoplossing.

## De Atlas

- [De Atlas](/docs/atlas) — wat de taalindex is en waar de feiten vandaan
  komen.
- [Specificatie van de taalkaart](/docs/reference/language-card-spec) en de
  [citatieprocedure](/docs/reference/language-card-citation-procedure) —
  elk veld, en hoe elk veld wordt geciteerd.
- [Wat telt als een taal](/docs/network/context/what-counts-as-a-language)
  — de antwoorden die de index geeft, en waarom.
- [Aanmelden bij de index](/docs/network/getting-started/submit-to-the-index) en
  [Fouten melden](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — een vermelding of correctie voorstellen.

## Netwerkinfrastructuur

- [Wachtrijopbouw](/docs/network/specifications/queue-construction) en
  [waarom de wachtrij zo is opgebouwd](/docs/network/perspectives/why-the-queue)
  — hoe de openbare werkwachtrij rangschikt wat als volgende moet worden gemeten.
- [Verbindingssterkte](/docs/network/specifications/connection-strength) —
  wat een boog op de netwerkkaart zegt over een paar, en het sterktetraject
  dat buiten gebruik is gesteld.
- [Rekenkracht bijdragen](/docs/network/getting-started/contributing-compute) —
  de wachtrij uitvoeren.
