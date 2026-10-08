---
sidebar_position: 3
title: "Van Benchmark naar Dagelijks Gebruik: Het Pad van Nabewerkingen"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "Hoe een gebenchmarkte vertaalmethode een communityvertaalworkflow wordt: machineconcept, nabewerking door een vloeiende spreker, gepubliceerde tekst — met eerlijke kwaliteitsdrempels bij elke stap."
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Van Benchmark naar Dagelijks Gebruik: Het Pad van Nabewerkingen

> **De korte versie.** Een score op het scorebord is geen product. De weg van "deze methode scoort chrF++ 47,5" naar "het band office publiceert wekelijks documenten in de taal" loopt via precies één workflow: de machine genereert een concept, een vloeiende spreker corrigeert dit en uitsluitend de gecorrigeerde tekst wordt gepubliceerd. Elke kwaliteitsdrempel in onze specificaties is afgestemd op die workflow — niet op machine-uitvoer zonder toezicht, wat we voor geen enkele taal op dit platform ondersteunen.

Mensen vragen soms wanneer een vertaalmethode "goed genoeg is om gewoon te gebruiken." Voor de talen die dit Netwerk bedient, zit daar een valkuil in. Het eerlijke antwoord is dat de lat die het waard is om na te streven niet "goed genoeg om zonder beoordeling te publiceren" is — maar **"goed genoeg dat het nakijken van een concept sneller gaat dan vertalen vanaf nul."** Die lat ligt veel lager, is meetbaar, en het halen ervan verandert wat een gemeenschappelijk vertaalbureau in een week kan produceren.

---

## De workflow, van begin tot eind

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

Drie dingen om op te letten:

1. **De machine publiceert nooit.** De eenheid van uitvoer is een concept. De correctieronde van de spreker is geen kwaliteitsborging die achteraf wordt toegevoegd — het ís de workflow.
2. **De tijd van de spreker is de te optimaliseren resource.** Een methode is beter dan een andere methode precies voor zover ze de spreker minder te corrigeren overlaat. Onderzoek naar nabewerking voor goed gedocumenteerde talen laat consistent zien dat het sneller gaat dan vertalen vanaf nul bij een matige MT-kwaliteit (Plitt & Masselot 2010; Green, Heer & Manning 2013, beide geciteerd met links in [Vertaling Is Geen Revitalisering](/docs/network/perspectives/translation-is-not-revitalization)). Of dat geldt voor polysynthetische talen is precies wat de benchmark moet uitwijzen — wij behandelen het als een hypothese die per taal geverifieerd moet worden, niet als een aanname.
3. **De feedbacklus is in eigen beheer.** Elk gecorrigeerd document is potentiële trainings- en coachingsdata — en het behoort toe aan de gemeenschap, om terug te voeren (of niet) op hun eigen voorwaarden onder de regels voor [gegevenssouvereiniteit](/docs/network/sovereignty/data-sovereignty). Het feedbackmechanisme is een ontwerpdoel van het platform, maar nog geen gebouwde functie; zie [Fouten Melden en Correcties in Eigen Beheer Houden](/docs/network/perspectives/reporting-errors-and-owning-corrections) voor hoe correcties en herkomst bedoeld zijn te werken.

## Wat een score op het scorebord u wel en niet kan vertellen

Het scorebord rangschikt methoden zoals gebruikelijk is binnen het MT-vakgebied: op basis van **chrF++** (0–100) op corpusniveau, inclusief het 95%-betrouwbaarheidsinterval en de sacreBLEU-signature, vergezeld van BLEU, spBLEU, TER en COMET, waarbij diagnostische gegevens zoals FST-acceptatie afzonderlijk worden gerapporteerd ([Score-specificatie](/docs/network/specifications/scoring#how-runs-are-scored)). Of de ene methode beter is dan de andere op dezelfde evaluatieset, wordt bepaald door een gepaarde significantietoets, niet door twee getallen op het oog te vergelijken ([Significantietoetsing](/docs/network/specifications/significance)).

Wat dit een gemeenschap vertelt: welke methoden uitvoer produceren die dichter bij betrouwbare referentievevertalingen ligt, en of een verschil tussen twee methoden reëel is. Wat het u niet kan vertellen: of een concept de tijd van een spreker waard is. Dezelfde chrF++-waarde heeft een verschillende betekenis voor verschillende talen en evaluatiesets; daarom is aan geen enkele automatische score hier een kwaliteitslabel gekoppeld. Het Network bracht voorheen een gewogen samengestelde score onder in benoemde niveaus ("functioneel", "implementeerbaar", …); deze labels zijn afgeschaft, deels omdat een systeem dat voor elke invoer één geldige zin herhaalde als "functioneel" werd aangemerkt ([waarom de samengestelde score is afgeschaft](/docs/network/specifications/scoring#why-the-composite-was-retired)).

Hieruit volgen twee structurele eerlijkheidsregels, afkomstig uit de [Benchmarkspecificatie §7](/docs/network/specifications/benchmark#7-human-validation):

- **Een score is een nominatie voor menselijke beoordeling, geen eindoordeel.** Een sterke chrF++ maakt een methode de moeite waard om met sprekers te testen; het maakt deze nog niet gereed.
- **Alleen een beoordeling door de gemeenschap bepaalt of een methode klaar is voor een post-editing workflow.** Een gestratificeerde steekproef van de uitvoer gaat naar tweetalige sprekers, die elke vertaling beoordelen als *afwijzen / strekking / acceptabel / uitstekend*. De bestuursorganisatie — niet het scorebord — beslist of de methode doorgaat.

Ter vergelijking: de voorwaarden van de [Founder's Prize](/docs/network/specifications/prizes) (een chrF++-ondergrens, ≥99% morfologisch geldige woorden als toelatingscriterium, ≥70% door sprekers beoordeeld als acceptabel of beter) beschrijven een methode waarvan de resterende fouten *fouten in de echte taal* zijn — een verkeerde verbuiging, geen verzonnen woorden. Dat is hoe "een concept dat de tijd van een spreker waard is" er in cijfers uitziet, en het oordeel van de sprekers is de doorslaggevende voorwaarde.

## Van een winnende methode naar een werkend bureau

Stel dat een methode die drempels haalt. De resterende stappen zijn organisatorisch van aard, en ze zijn gespecificeerd in plaats van geïmproviseerd:

1. **Het eigendom wordt overgedragen.** De code van de methode wordt eigendom van de bestuursorganisatie van de gemeenschap — de ontwikkelaar behoudt naamsvermelding en publicatierechten ([Eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer)).
2. **De methode wordt een dienst — de dienst van de gemeenschap.** Ze wordt verpakt als een plugin die de bestuursorganisatie op haar eigen infrastructuur kan draaien, met controle over toegang en toegestane toepassingen ([Implementeren in Productie](/docs/network/getting-started/deploy-to-production)). Als de gemeenschap ervoor kiest om het commercieel aan te bieden, is dat haar zaak in alle opzichten — Champollion neemt geen aandeel ([Hoe het Werk Wordt Gefinancierd](/docs/network/sovereignty/economic-model)).
3. **Vertalers integreren het in hun dagelijkse werk.** Een vertaalbureau koppelt zijn bestaande documentworkflow aan de API van de methode: brontekst in, concept uit, nabewerken, publiceren. De gepubliceerde tekst draagt de naam en het gezag van de vertaler — de machine is een hulpmiddel op hun bureau, zoals een woordenboek.

## Waar dit vandaag staat

Kort gezegd: het volledige traject is van begin tot eind gespecificeerd en gedeeltelijk gebouwd. De evaluatie-harness, metrieken, run cards en het openbare scorebord bestaan; de evaluatie-sandbox is gebouwd maar is uitsluitend getest met een eenvoudige demonstratiemethode; een Plains Cree-ontwikkelingscorpus is upstream beschikbaar; er is een prijs voorgesteld, maar er staat er geen open; het implementatieplatform bestaat. De interface voor beoordeling door de gemeenschap en de feedbacklus voor gecorrigeerde tekst zijn gespecificeerd maar nog niet operationeel — de specificaties markeren deze als gepland, en dat doen wij ook. Geen enkele methode heeft tot nu toe het volledige traject van benchmark tot dagelijks gebruik door de gemeenschap doorlopen. Dat traject is de definitie van succes voor dit project, en dat is precies de reden waarom we dit niet voortijdig zullen claimen.

---

## Wat dit voor u betekent

:::info[Als u lid bent van een gemeenschap]
Een hoge score op het scorebord betekent nooit dat een machine zonder toezicht in uw taal publiceert — het betekent dat een conceptgenerator mogelijk klaar is voor een *auditie* voor uw vertalers, op uw voorwaarden, waarbij uw sprekers als beoordelaars optreden (betaald — zie [Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid)). Als uw gemeenschap een vertaalbureau beheert, is de relevante vraag die u ons kunt stellen: "hoe zou een pilot eruitzien, en wie beoordeelt de uitvoer?"
:::

:::info[Als u onderzoeker bent]
Het kader van post-editing verandert wat de moeite waard is om te meten: de tijd tot acceptabele tekst met een spreker in de lus, niet alleen chrF++. De metrieken van het Network zijn daarvoor indicatoren ([Score-specificatie §1](/docs/network/specifications/scoring)), en post-editing-onderzoeken per taal voor morfologisch complexe talen vormen een open onderzoeksleemte die deze infrastructuur beoogt te ondersteunen.
:::

:::info[Als u een ontwikkelaar bent]
Optimaliseer voor de redacteur, niet voor de statistiek. Een methode die echte woorden produceert met af en toe een verkeerde vervoeging is in seconden te corrigeren door een spreker; een methode die plausibel ogende vormen hallucineert, vergiftigt de hele workflow — daarom wordt morfologische geldigheid hier zo streng bewaakt. Begin bij [Een methode indienen](/docs/network/getting-started/submit-a-method) en lees de [Methode-interface](/docs/network/specifications/methods) voor wat u uiteindelijk overdraagt als u wint.
:::

## Zie ook

- [Vertaling Is Geen Revitalisering](/docs/network/perspectives/translation-is-not-revitalization) — waarom de menselijke drempel het punt is, niet een beperking
- [Fouten Melden en Correcties in Eigen Beheer Houden](/docs/network/perspectives/reporting-errors-and-owning-corrections) — wat er gebeurt als de gepubliceerde tekst toch onjuist is
- [Benchmarkspecificatie §7](/docs/network/specifications/benchmark#7-human-validation) — de menselijke validatiedrempel, formeel beschreven
