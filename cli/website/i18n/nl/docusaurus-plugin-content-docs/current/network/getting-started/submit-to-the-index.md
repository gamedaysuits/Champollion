---
sidebar_position: 0
title: "Indienen bij de Index"
description: "Draag een dataset, bron, methode, menselijke vertaaldienst of extern resultaat aan — of stel een correctie voor een taalkaart voor. Elke inzending wordt door een mens beoordeeld op naleving van intellectueel eigendom (IP), licenties en soevereiniteit — niets wordt automatisch goedgekeurd."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# Indienen bij de Index

> **Samenvatting.** Stel iets voor aan de Champollion-index — een benchmark, een resource, een vertaalmethode, een menselijke vertaaldienst of een extern gepubliceerd resultaat. U dient een kort gestructureerd formulier in (via uw browser of vanuit de CLI); een **beheerder beoordeelt elke inzending handmatig** op IP, licentie en naleving van gemeenschaps- en soevereiniteitsvereisten voordat er iets wordt toegevoegd. **Niets wordt automatisch goedgekeurd.**

De index is de gedeelde kaart: de datasets waarop methoden worden gebenchmarkt, de woordenboeken en hulpmiddelen die ondersteuning bieden, de methoden zelf, de mensen die handmatig vertalen, en de resultaten die anderen hebben gepubliceerd. Iedereen kan een toevoeging voorstellen. Omdat dit infrastructuur is voor taalgemeenschappen, doorloopt elk voorstel eerst een menselijke beoordelingspoort.

---

## Wat u kunt indienen

| Type | Wat het is | Wat wij toevoegen |
|---|---|---|
| **Benchmark / dataset** | Een evaluatiecorpus of benchmark | Een metadatakaart + een *fetch-from-source* verwijzing — nooit de inhoud van het corpus |
| **Resource** | Een woordenboek, archief, app, FST (morfologische analysator) of tool | Een vermelding met een verwijzing + toegangsniveau (open / beperkt / toestemming vereist) |
| **Vertaalmethode** | Een MT-engine, LLM-provider of pipeline | Een vermelding in de method-registry zodat deze kan worden uitgevoerd en gebenchmarkt |
| **Menselijke vertaaldienst** | Een opt-in gemeenschapskantoor, bureau of individuele vertaler | Een vermelding per talenpaar (contactgegevens blijven out-of-band — nooit in de openbare issue) |
| **Extern gepubliceerd resultaat** | Een score gerapporteerd door een ander systeem of paper | Een **citatie** — externe resultaten worden geciteerd, nooit opnieuw gehost of opnieuw gerangschikt als onze eigen meting |
| **Correctie van language card** | Iets op een [language card](/catalogue) is onjuist, verouderd of ontbreekt — een schatting van het aantal sprekers, een status, een schrift, een resource die we niet hebben vermeld | Een **geciteerde correctie toegepast bij de databron** (kaarten worden gegenereerd, dus de correctie blijft behouden); wanneer bronnen elkaar tegenspreken, toont de kaart ze allemaal, met bronvermelding |

Elke language card bevat ook een link **"Stel een correctie of toevoeging voor"**
die het correctieformulier opent waarbij de taal vooraf is ingevuld.

**Verzoeken tot verwijdering en beperking vanuit de gemeenschap.** Als u een lid van de gemeenschap
of een autoriteit bent en wilt dat gegevens over uw taal worden beperkt of verwijderd, gebruik dan het
correctieformulier (of neem out-of-band contact op met de beheerder als u liever niet heeft dat dit
openbaar is). Deze doorlopen de [sovereignty review](/docs/network/sovereignty/data-sovereignty)
met prioriteit — geen citatie vereist.

---

## Hoe de beoordeling werkt

Dit is het belangrijkste onderdeel: **inzendingen worden beoordeeld door een mens, niet door een robot.** Wanneer u iets indient, opent u een GitHub-issue. Dat issue vormt de beoordelingswachtrij. Een beheerder leest het en toetst het aan de regels van het project voordat er iets wordt toegevoegd:

- **IP & licentie.** We moeten toestemming hebben om het te vermelden. Materiaal met een niet-commerciële licentie, een verbod op herverdeling of een onduidelijke licentie kan nog steeds worden *gecatalogiseerd*, maar wordt uitgesloten van elke commerciële, prijs- of openbare-fetch-baan.
- **Gemeenschap & soevereiniteit.** Gegevens van inheemse en gemeenschapstalen worden alleen vermeld met toestemming van de gemeenschap. Een provider of beheerder wordt nooit publiekelijk genoemd voordat deze bevestiging heeft gegeven.
- **We hosten nooit corpusinhoud.** Datasets worden vermeld als metadata plus een verwijzing naar de locatie waar de gegevens worden opgehaald. **Plak geen bron- of referentiezinnen in een inzending.**
- **Geen persoonsgegevens.** Geen e-mailadressen, telefoonnummers of andere persoonsgegevens in een openbaar issue. Voor menselijke vertaaldiensten worden contactgegevens buiten de band aan de beheerder verstrekt.
- **Reikwijdte.** Bijbelse/liturgische en andere corpora die voortkomen uit koloniale oplegging vallen buiten de reikwijdte en worden afgewezen.

Elk formulier eindigt met een verplichte verklaring:

> *"Ik bevestig dat dit openbaar vermeld mag worden, GEEN corpusinhoud of persoonsgegevens bevat, en de licentie van de bron en eventuele gemeenschaps- of soevereiniteitsbeperkingen respecteert."*

---

## Twee manieren om in te dienen

### Via uw browser

Open de issue-kiezer en selecteer het formulier dat overeenkomt met wat u indient:

➡️ **[Open een inzendingsformulier op GitHub](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Elk formulier vraagt alleen om wat de bijbehorende index nodig heeft (naam, talen/taalparen, licentie, bron-URL, enzovoort) en het bevestigingsvakje.

### Vanuit de CLI

Als u de [champollion CLI](/docs/network/getting-started/submit-a-method) hebt, verzamelt `champollion submit` de velden en geeft u een **vooraf ingevulde** versie van hetzelfde GitHub-formulier:

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

De CLI geeft een URL weer — open deze, controleer de verklaring in de browser en dien in. Voeg `--out submission.json` toe om ook een lokale, inhoudsvrije kopie op te slaan van wat u voorstelt. De CLI uploadt zelf niets en schrijft nooit naar de index.

---

## Wat er gebeurt nadat u heeft ingediend

1. Uw inzending arriveert als een GitHub-issue — de beoordelingswachtrij.
2. Een beheerder beoordeelt het aan de hand van de bovenstaande IP-, licentie- en soevereiniteitsregels.
3. **Bij acceptatie:** de beheerder voegt de vermelding toe aan de relevante bron van waarheid (het datasetregister, een kaart, het methode- of menselijke-dienstenregister, of de catalogus met externe resultaten) via een normale wijziging, en labelt het issue als **accepted**.
4. **Als het niet als zodanig kan worden vermeld:** de beheerder labelt het als **declined** (of vraagt om meer informatie) met vermelding van de reden.

Er is geen automatische samenvoeging en geen automatische publicatie. Elke keer neemt een persoon de beslissing.

---

## Zie ook

- [Een methode indienen](/docs/network/getting-started/submit-a-method) — heeft u al een benchmarkrun? Publiceer de run-kaart rechtstreeks.
- [Corpora registreren](/docs/network/sovereignty/registering-corpora) — blootstellingsniveaus (lokaal / privé / openbaar / verzegeld) voor corpora die u bezit.
- [Gegevenssoevereiniteit](/docs/network/sovereignty/data-sovereignty) — hoe gemeenschapscontrole over taalgegevens hier werkt.
- [Voor taalgemeenschappen](/docs/network/community/for-language-communities) — partnerschap, toestemming en sleutelbeheer.
