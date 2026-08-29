---
sidebar_position: 2
title: "Hoe Sprekers Worden Betaald"
slug: '/network/perspectives/how-speakers-get-paid'
description: "Wat gemeenschapsvalidatoren en vertalers worden betaald voor benchmarkwerk, waarom het betalen van sprekers niet onderhandelbaar is, en hoe de vergoeding schaalt naarmate het Netwerk groeit. Alle cijfers zijn afkomstig uit de gepubliceerde specificaties."
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# Hoe Sprekers Worden Betaald

> **Transparantienota.** Elk getal op deze pagina staat al in een gepubliceerde specificatie — de [Benchmark Specificatie §10](/docs/network/specifications/benchmark#10-cost-framework), het [Sprekervalidatieprotocol](/docs/network/specifications/speaker-validation) en de [Prijsspecificatie](/docs/network/specifications/prizes). Deze pagina brengt ze op één plek samen, in begrijpelijke taal, zodat niemand een specificatie hoeft te lezen om te weten wat sprekerstijd hier waard is. Er worden geen toezeggingen gedaan die verder gaan dan wat die documenten al vermelden.

Een tweetalige spreker die kan beoordelen of een machinaal geproduceerde zin echt, vloeiend en correct van betekenis is, is de schaarsste en meest waardevolle deelnemer in dit hele systeem. Al het andere — harnesses, statistieken, leaderboards — bestaat om een kleine hoeveelheid van die persoons tijd zo ver mogelijk te laten reiken.

De eerste regel is dan ook eenvoudig: **sprekers worden betaald voor hun tijd, tegen professionele tarieven, ongeacht wat de resultaten laten zien.**

---

## Waarom het betalen van sprekers niet onderhandelbaar is

Taalkundig technologieonderzoek heeft een lange gewoonte om vloeiende sprekers te behandelen als een gratis hulpbron — "gemeenschapsbetrokkenheid" die datasets, publicaties en carrières oplevert voor iedereen behalve de sprekers zelf. Wij beschouwen dat patroon als extractief, en de mensen die het meest gekwalificeerd zijn voor dit werk zijn precies de mensen wier tijd al wordt opgeëist door het urgente werk van lesgeven, vertalen en kinderen opvoeden in de taal.

Drie ontwerpconsequenties volgen hieruit:

1. **Geen vrijwilligerspijplijn.** Wij vragen sprekers niet om evaluatiewerk te doneren als gunst aan het onderzoek. Deelname is een betaalde opdracht, en het afwijzen ervan kost een spreker niets.
2. **Betaling is onvoorwaardelijk.** Sprekers worden betaald ongeacht of hun beoordelingen worden gebruikt, en betaling is niet afhankelijk van resultaten. Het gepubliceerde protocol verbindt zich tot betaling binnen twee weken na het voltooien van elk taakblok.
3. **Vergoeding is niet het enige.** Sprekers die beoordelingen bijdragen ontvangen ook naamsvermelding (met naam of anoniem, naar eigen keuze), optioneel mede-auteurschap op publicaties die hun beoordelingen gebruiken, het recht om hun bijdragen op elk moment in te trekken, en vetorecht over publicatie van resultaten die zij problematisch achten. Die voorwaarden staan in het [Sprekervalidatieprotocol §5–6](/docs/network/specifications/speaker-validation), niet in een bijlage.

## De gepubliceerde tarieven

Het benchmark-kostenraamwerk stelt de vergoeding voor tweetalige sprekers vast op **$50–65 CAD per uur** voor corpus- en validatiewerk. Wat dat per rol betekent:

### Een benchmarkcorpus opbouwen

Het aanmaken van de referentievertaingen waaraan elke methode wordt beoordeeld, is de fundamentele sprekertaak. Het gepubliceerde oprichtingsbudget per taal:

| Werk | Gepubliceerd bereik | Basis |
|------|---------------------|-------|
| Corpuscuratie (50–150 items) | $2.500–6.000 | $50–65/uur, tweetalige sprekerstijd |
| Beoordeling van methode-uitvoer | $500–1.500 | Zelfde uurtarieven |

Een volledig corpus kost een spreker traditioneel ongeveer 80 uur; de geplande agent-ondersteunde workflow (zinnen opstellen en opmaken wordt door tooling afgehandeld, vertalen altijd door een mens) is ontworpen om dat terug te brengen naar 30–40 uur — minder uren repetitief werk, hetzelfde uurtarief, waarbij de spreker alleen de onderdelen uitvoert die werkelijk een mens vereisen.

### De statistieken valideren

Voordat geautomatiseerde scores iets betekenen, moeten sprekers ze toetsen aan menselijk oordeel. Het [Sprekervalidatieprotocol](/docs/network/specifications/speaker-validation) publiceert de exacte taken, uren en vergoeding:

| Taak | Tijd | Vergoeding per spreker |
|------|------|------------------------|
| A — Beoordeel 200 machinevertaingen op adequaatheid en vloeiendheid | ~8 uur | $400–520 CAD |
| B — Beoordeel 50 "equivalente" vertaalparen | ~2 uur | $100–130 CAD |
| C — Beoordeel 100 woorden die de morfologische analysator heeft afgewezen | ~1,5 uur | $75–100 CAD |

Een spreker die alle drie uitvoert, verbindt zich aan ongeveer 11,5 uur verspreid over twee tot vier weken voor **$575–750 CAD**. De volledige validatieronde met drie sprekers kost het project $1.475–1.920 — en dat is precies het punt: sprekervalidatie is een kleine kostenpost voor het project en mag nooit de plek zijn waar kosten worden "bespaard."

### Prijsclaims beoordelen

Er wordt geen prijs uitgekeerd op basis van geautomatiseerde scores alleen. De [Stichtersprijs](/docs/network/specifications/prizes) ($10.000 CAD, Engels→Plains Cree) vereist dat ten minste twee tweetalige sprekers onafhankelijk van elkaar een gestratificeerde steekproef van ten minste 30 uitvoerresultaten beoordelen, en dat 70% of meer wordt beoordeeld als "aanvaardbaar" of "uitstekend." Die beoordeling is betaald sprekerwerk tegen dezelfde tarieven — en het is ook een drempel: sprekers kunnen een prijsclaim torpederen, en dat is bewust zo ontworpen.

## Hoe het schaalt met wedstrijden

Het model is zo opgebouwd dat sprekervergoeding meegroeit met het platform in plaats van erdoor te worden verdund:

- **Elke nieuwe taal begint met een betaalde corpusopdracht.** De gepubliceerde oprichtingskosten per taal ($3.350–8.500 alles inbegrepen) bestaan grotendeels uit sprekervergoeding — de grootste afzonderlijke component, bewust zo.
- **Elke nieuwe prijzenpot brengt zijn eigen betaalde beoordeling mee.** Elke gesponsorde wedstrijd die het [prijssjabloon](/docs/network/specifications/prizes#4-future-prize-pools) volgt, draagt dezelfde gemeenschapsvalidatievereiste met zich mee, wat betekent dat elke wedstrijd sprekerbeoordelingswerk voor die taal financiert.
- **Gemeenschapseigen methoden blijven gemeenschapsgefinancierde activa.** Een overgedragen methode behoort volledig toe aan de bestuursorganisatie — alles wat het oplevert door het in te zetten is volledig van de gemeenschap ([Hoe het Werk Wordt Gefinancierd](/docs/network/sovereignty/economic-model)), beschikbaar voor voortdurende beoordeling, corpusgroei en taalprogramma's naar eigen inzicht. Die toewijzing is de beslissing van de gemeenschap, niet de onze.

## Wat wij *niet* hebben beloofd

Eerlijkheid vereist dat de grenzen worden aangegeven:

- De bovenstaande tarieven zijn de gepubliceerde tarieven voor het huidige Plains Cree-werk. Tarieven voor toekomstige talen worden vastgesteld met de partnergemeenschap en op dezelfde manier gepubliceerd — in de specificaties, vóór het werk begint.
- Champollion is niet-commercieel, genereert geen eigen inkomsten en wordt momenteel **gefinancierd door de oprichter** — subsidie- en sponsorfinanciering is wat wij zoeken, niet wat wij hebben. [Hoe het Werk Wordt Gefinancierd](/docs/network/sovereignty/economic-model) beschrijft het mechanisme, niet een garantie.
- "Eerlijk betaald" is noodzakelijk maar niet voldoende. Betaling maakt een project op zichzelf niet niet-extractief — eigendom en zeggenschap doen dat wel, en daarom is vergoeding ingebed in het [beheerdersmodel](/docs/network/sovereignty/data-sovereignty) in plaats van het te vervangen.

---

## Wat dit voor u betekent

:::info[Als u een gemeenschapslid bent]
Als u tweetalig bent in een ondervertegenwoordigde taal en het Engels, is uw oordeel de meest waardevolle bijdrage aan dit systeem. De gepubliceerde voorwaarden zijn: $50–65 CAD/uur, flexibele planning, betaling binnen twee weken, vermelding op uw eigen voorwaarden, en het recht om uw bijdragen in te trekken. Programmeerkennis is niet vereist. Begin met [Voor Taalgemeenschappen](/docs/network/community/for-language-communities) of het [Sprekervalidatieprotocol §7](/docs/network/specifications/speaker-validation#7-how-to-get-started).
:::

:::info[Als u een onderzoeker bent]
Begroot sprekervergoeding als een eersteklas onderzoekskosten — de gepubliceerde bedragen ($1.475–1.920 voor een ronde van metriekvalidatie; $2.500–6.000 voor corpuscuratie) zijn bescheiden naar subsidienormen, en zij zijn wat geautomatiseerde scores verdedigbaar maakt. De [Corpuspartnerschapsstrategie](/docs/network/specifications/corpus-partnership) laat zien hoe een academische afdeling hierop aansluit met gefinancierd sprekerwerk als integraal onderdeel.
:::

:::info[Als u een ontwikkelaar bent]
U profiteert van betaald sprekerwerk, ook als u het nooit financiert: gevalideerde metrieken zijn wat uw leaderboard-score betekenisvol maakt, en betaalde gemeenschapsreview is wat staat tussen uw methode en een prijs. Als u wint, kunt u ervan uitgaan dat sprekers betaald zijn om uw uitvoer kritisch te beoordelen — en verwacht dat [het eigendom van uw methode wordt overgedragen](/docs/network/sovereignty/ownership-transfer) aan de gemeenschap wier taal zij dient.
:::

## Zie ook

- [Vertaling Is Geen Revitalisering](/docs/network/perspectives/translation-is-not-revitalization) — waarom sprekersgezag alles omlijst
- [Fouten Melden en Correcties Bezitten](/docs/network/perspectives/reporting-errors-and-owning-corrections) — sprekersgezag ook na de benchmark
- [Benchmark Specificatie §10](/docs/network/specifications/benchmark#10-cost-framework) — het volledige kostenraamwerk waaruit deze cijfers afkomstig zijn
