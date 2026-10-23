---
sidebar_position: 0
title: "Indienen bij de Index"
description: "Stel een dataset, bron, methode, menselijke vertaaldienst of extern resultaat voor — of draag een correctie voor een taalkaart aan. Elke inzending wordt door mensen beoordeeld op naleving van intellectueel eigendom (IP), licenties en soevereiniteit — niets wordt automatisch goedgekeurd."
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
    to: /docs/your-words-your-rules
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

| Type | Wat het is | Wat we toevoegen |
|---|---|---|
| **Benchmark / dataset** | Een evaluatiecorpus of benchmark | Een metadatakaart + een *fetch-from-source*-verwijzing — nooit de inhoud van het corpus |
| **Hulpbron** | Een woordenboek, archief, app, FST (morfologische ontleder) of tool | Een vermelding met een verwijzing + toegangsniveau (open / beperkt / toestemming vereist) |
| **Vertaalmethode** | Een MT-engine, LLM-provider of pipeline | Een vermelding in het methodenregister zodat deze kan worden uitgevoerd en gebenchmarkt |
| **Menselijke vertaaldienst** | Een opt-in gemeenschapsbureau, agentschap of individuele vertaler | Een vermelding per talenpaar (contactgegevens blijven out-of-band — nooit in de openbare issue) |
| **Extern gepubliceerd resultaat** | Een score gerapporteerd door een ander systeem of een andere paper | Een **citatie** — externe resultaten worden geciteerd, nooit opnieuw gehost of herrangschikt als onze eigen meting |
| **Taalkaartcorrectie** | Iets op een [taalkaart](/catalogue) is onjuist, verouderd of ontbreekt — een schatting van het aantal sprekers, een status, een schrift, een hulpbron die we nog niet hebben vermeld | Een **geciteerde correctie die direct bij de gegevensbron wordt toegepast** (kaarten worden gegenereerd, waardoor de correctie behouden blijft); wanneer bronnen van mening verschillen, toont de kaart ze allemaal, met bronvermelding |

Elke taalkaart bevat ook een link **"Een correctie of toevoeging voorstellen"**
waarmee het correctieformulier wordt geopend waarin de taal al is ingevuld.

**Verzoeken vanuit de gemeenschap tot verwijdering of beperking.** Bent u lid
of vertegenwoordiger van een gemeenschap en wilt u dat gegevens over uw taal worden beperkt
of verwijderd? Gebruik dan het correctieformulier (of neem via een ander kanaal contact op
met de beheerder als u liever hebt dat dit niet openbaar gebeurt). Deze verzoeken doorlopen
met voorrang de [soevereiniteitsbeoordeling](/docs/your-words-your-rules) —
bronvermelding is niet vereist.

---

## Hoe de beoordeling werkt

Dit is het belangrijkste onderdeel: **inzendingen worden beoordeeld door een mens, niet door een robot.** Wanneer u iets indient, opent u een GitHub-issue. Dat issue vormt de beoordelingswachtrij. Een beheerder leest het en toetst het aan de regels van het project voordat er iets wordt toegevoegd:

- **IP & licentie.** Het moet ons toegestaan zijn om dit op te nemen. Materiaal dat niet-commercieel is, niet herdistribueerd mag worden of een onduidelijke licentie heeft, kan nog steeds worden *gecatalogiseerd*, maar wordt uitgesloten van elk commercieel, prijs- of openbaar ophaaltraject.
- **Gemeenschap & soevereiniteit.** Taalgegevens van inheemse talen en gemeenschapstalen worden uitsluitend opgenomen met toestemming van de gemeenschap. Een aanbieder of beheerder wordt nooit publiekelijk genoemd voordat deze heeft bevestigd (er staat er momenteel nog geen vermeld).
- **We hosten nooit corpusinhoud.** Datasets worden opgenomen als metadata plus een verwijzing naar de locatie waar de gegevens worden opgehaald. **Plak geen bron- of referentiezinnen in een inzending.**
- **Geen persoonsgegevens.** Geen e-mailadressen, telefoonnummers of andere PII in een openbare issue. Voor menselijke vertaaldiensten worden contactgegevens out-of-band aan de beheerder verstrekt.
- **Scope.** Bijbelse / liturgische en andere koloniaal opgelegde corpora vallen buiten de scope en worden afgewezen.

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

- [Een methode indienen](/docs/network/getting-started/submit-a-method) — hebt u al een benchmarkrun uitgevoerd? Publiceer de run-kaart direct.
- [Corpora registreren](/docs/network/sovereignty/registering-corpora) — zichtbaarheidsniveaus (lokaal / privé / openbaar / verzegeld) voor corpora waarvan u de eigenaar bent.
- [Uw woorden, uw regels](/docs/your-words-your-rules) — hoe zeggenschap van de gemeenschap over taalgegevens hier werkt.
- [Uw woorden, uw regels](/docs/your-words-your-rules) — partnerschap, toestemming en sleutelbeheer.
