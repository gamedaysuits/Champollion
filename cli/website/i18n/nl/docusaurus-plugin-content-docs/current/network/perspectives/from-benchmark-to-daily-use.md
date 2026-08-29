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
    note: "The quality thresholds behind the path"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Van Benchmark naar Dagelijks Gebruik: Het Pad van Nabewerkingen

> **De korte versie.** Een score op een ranglijst is geen product. Het pad van "deze methode scoort 0,78" naar "het bandkantoor publiceert wekelijks documenten in de taal" loopt langs precies één workflow: de machine produceert een concept, een vloeiende spreker corrigeert het, en alleen de gecorrigeerde tekst wordt gepubliceerd. Elke kwaliteitsdrempel in onze specificaties is gekalibreerd op die workflow — niet op onbeheerde machine-uitvoer, die wij voor geen enkele taal op dit platform onderschrijven.

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

## Wat de kwaliteitsniveaus betekenen voor dagelijks gebruik

De ranglijst beoordeelt methoden op een samengesteld geheel van geautomatiseerde statistieken ([Scoringsspecificatie](/docs/network/specifications/scoring)), en de scores worden toegewezen aan benoemde niveaus. Hier volgt de eerlijke vertaling van die niveaus naar termen voor dagelijks gebruik:

| Niveau (samengesteld) | Wat het betekent voor het nabewerkingspad |
|---|---|
| **Basislijn** (0,00–0,30) | Niet bruikbaar voor wat dan ook. De uitvoer is grotendeels niet de doeltaal. Alleen nuttig als onderzoeksbodem. |
| **Opkomend** (0,30–0,50) | Nog steeds geen concepttool. Correcte fragmenten verschijnen, maar een spreker zou meer tijd kwijt zijn aan corrigeren dan aan vers schrijven. |
| **Functioneel** (0,50–0,70) | Het eerste niveau waarbij nabewerking *mogelijk* sneller gaat dan vertalen vanaf nul voor eenvoudige teksten — de moeite waard om te testen met een spreker, maar niet om op te vertrouwen. Frequente morfologische fouten blijven aanwezig. |
| **Inzetbaar** (0,70–0,85) | Het doelniveau voor de bovenstaande workflow: concepten waarbij de meeste morfologie correct is en een vloeiende spreker zinvol sneller kan corrigeren dan opnieuw vertalen. **"Inzetbaar" betekent inzetbaar *in een nabewerkingsworkflow* — nooit "publiceren zonder beoordeling."** |
| **Vloeiend** (0,85–1,00) | Benadert competente menselijke vertaling; fouten zijn zeldzaam en gering. De beoordelingsronde blijft — ze gaat alleen sneller. |

Twee structurele eerlijkheidsregels staan bovenop deze tabel, rechtstreeks uit de [Benchmarkspecificatie §5 en §7](/docs/network/specifications/benchmark#5-quality-tiers):

- **Geautomatiseerde niveaus zijn voorlopige labels, geen uitspraken.** Het zijn nominaties voor menselijke beoordeling. De drempelwaarden worden opnieuw gekalibreerd naarmate er meer sprekersvalidatiedata beschikbaar komt, en ze kunnen per taal anders uitvallen.
- **Geen enkele methode kan Inzetbaar of hoger claimen zonder gemeenschapsbeoordeling.** Een gestratificeerde steekproef van de uitvoer gaat naar tweetalige sprekers, die elke vertaling beoordelen als *afwijzen / globaal / acceptabel / uitstekend*. De bestuursorganisatie — niet de ranglijst — beslist of de methode verder gaat.

Ter vergelijking: de drempel voor de [Stichtersprijs](/docs/network/specifications/prizes) (samengesteld ≥ 0,80, ≥99% morfologisch geldige woorden, ≥70% door sprekers beoordeeld als acceptabel of beter) beschrijft een methode waarvan de resterende fouten *echte taalfouten* zijn — verkeerde vervoeging, geen gefabriceerde woorden. Dat is hoe "een concept dat een spreker zijn tijd waard is" er in cijfers uitziet.

## Van een winnende methode naar een werkend bureau

Stel dat een methode die drempels haalt. De resterende stappen zijn organisatorisch van aard, en ze zijn gespecificeerd in plaats van geïmproviseerd:

1. **Het eigendom wordt overgedragen.** De code van de methode wordt eigendom van de bestuursorganisatie van de gemeenschap — de ontwikkelaar behoudt naamsvermelding en publicatierechten ([Eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer)).
2. **De methode wordt een dienst — de dienst van de gemeenschap.** Ze wordt verpakt als een plugin die de bestuursorganisatie op haar eigen infrastructuur kan draaien, met controle over toegang en toegestane toepassingen ([Implementeren in Productie](/docs/network/getting-started/deploy-to-production)). Als de gemeenschap ervoor kiest om het commercieel aan te bieden, is dat haar zaak in alle opzichten — Champollion neemt geen aandeel ([Hoe het Werk Wordt Gefinancierd](/docs/network/sovereignty/economic-model)).
3. **Vertalers integreren het in hun dagelijkse werk.** Een vertaalbureau koppelt zijn bestaande documentworkflow aan de API van de methode: brontekst in, concept uit, nabewerken, publiceren. De gepubliceerde tekst draagt de naam en het gezag van de vertaler — de machine is een hulpmiddel op hun bureau, zoals een woordenboek.

## Waar dit vandaag staat

Ronduit gezegd: het volledige pad is van begin tot eind gespecificeerd en gedeeltelijk gebouwd. De evaluatieomgeving, statistieken, run cards en de openbare ranglijst bestaan; het Plains Cree-ontwikkelingscorpus en een actieve prijs bestaan; het implementatieplatform bestaat. De gemeenschapsbeoordelingsinterface, de evaluatiesandbox en de feedbacklus voor gecorrigeerde teksten zijn gespecificeerd maar nog niet operationeel — de specificaties markeren ze als gepland, en dat doen wij ook. Geen enkele methode heeft tot nu toe de volledige reis van benchmark naar dagelijks gemeenschapsgebruik voltooid. Die reis is de definitie van succes van het project, en dat is precies waarom wij het niet vroegtijdig zullen claimen.

---

## Wat dit voor u betekent

:::info[Als u een gemeenschapslid bent]
Een "Deployable"-badge op een ranglijst betekent nooit dat een machine zonder toezicht in uw taal publiceert — het betekent dat een conceptgenerator klaar kan zijn om *auditie te doen* voor uw vertalers, op uw voorwaarden, met uw sprekers als de beoordelaars (betaalde — zie [Hoe sprekers betaald worden](/docs/network/perspectives/how-speakers-get-paid)). Als uw gemeenschap een vertaalbureau heeft, is de relevante vraag die u aan ons kunt stellen: "hoe zou een pilot eruitzien, en wie beoordeelt de uitvoer?"
:::

:::info[Als u een onderzoeker bent]
De post-editing-benadering verandert wat het meten waard is: tijd-tot-aanvaardbare-tekst met een spreker in de lus, niet alleen een samengestelde score. De statistieken van het Network zijn proxies daarvoor ([Scoringsspecificatie §1](/docs/network/specifications/scoring)), en per-taal post-editing-studies voor morfologisch complexe talen vormen een open onderzoekslacune die deze infrastructuur is ontworpen om te ondersteunen.
:::

:::info[Als u een ontwikkelaar bent]
Optimaliseer voor de redacteur, niet voor de statistiek. Een methode die echte woorden produceert met af en toe een verkeerde vervoeging is in seconden te corrigeren door een spreker; een methode die plausibel ogende vormen hallucineert, vergiftigt de hele workflow — daarom wordt morfologische geldigheid hier zo streng bewaakt. Begin bij [Een methode indienen](/docs/network/getting-started/submit-a-method) en lees de [Methode-interface](/docs/network/specifications/methods) voor wat u uiteindelijk overdraagt als u wint.
:::

## Zie ook

- [Vertaling Is Geen Revitalisering](/docs/network/perspectives/translation-is-not-revitalization) — waarom de menselijke drempel het punt is, niet een beperking
- [Fouten Melden en Correcties in Eigen Beheer Houden](/docs/network/perspectives/reporting-errors-and-owning-corrections) — wat er gebeurt als de gepubliceerde tekst toch onjuist is
- [Benchmarkspecificatie §7](/docs/network/specifications/benchmark#7-human-validation) — de menselijke validatiedrempel, formeel beschreven
