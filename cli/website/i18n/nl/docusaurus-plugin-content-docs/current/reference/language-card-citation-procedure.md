---
title: "Taalkaart Citatieprocedure"
sidebar_label: "Citation Procedure"
---

# Citatieproces voor Taalkaarten

*Hoe Champollion ervoor zorgt dat elke bewering op een taalkaart herleidbaar is tot een primaire bron.*

---

## 1. Het Probleem

Taalkaarten bevatten feitelijke beweringen — aantallen sprekers, bedreigingsstatus, contactinvloeden, morfologische eigenschappen, typografische conventies, ondersteuning van methoden — die **verifieerbaar moeten zijn**. Momenteel geldt:

- Het veld `dataSources` is een platte reeks tekenreeksen (bijv. `["cldr-48", "glottolog-5.3"]`)
- Er is geen citatiegranulariteit per veld
- Beweringen zoals "~2,8 miljoen sprekers" of "kwetsbaar" hebben geen traceerbare herkomst
- Een beoordelaar kan niet bepalen welke bron welke bewering onderbouwt

> [!CAUTION]
> **Een niet-onderbouwde bewering is een niet-verifieerbare bewering.** Voor een project dat zichzelf als professioneel rigoureus positioneert, moet elke bewering op een taalkaart herleidbaar zijn tot een specifieke, versioned primaire bron.

---

## 2. Gezaghebbende Bronnen (Gerangschikt op Prioriteit)

Voor elk type bewering zijn de volgende bronnen gezaghebbend. **Geef altijd de voorkeur aan de hoogst gerangschikte beschikbare bron.**

### Classificatie en Identiteit

| Prioriteit | Bron | Dekt | Licentie | Hoe te citeren |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | Familie, afstamming, glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | ISO-codes, macrotalen | Vrij | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | Genusdefinities, typologische kenmerken | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | Localecodes, schriftcodes, meervoudsregels | Unicode ToS | `cldr-{version}` |

### Demografische Gegevens en Vitaliteit van Sprekers

| Prioriteit | Bron | Dekt | Licentie | Hoe te citeren |
|---|---|---|---|---|
| 1 | Nationale volkstellingsgegevens | Officiële aantallen sprekers | Varieert (doorgaans openbaar) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | Schattingen van sprekers, EGIDS | Eigendomsrechtelijk (abonnement) | `ethnologue-{edition}` |
| 3 | [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | Bedreigingsstatus | Vrij | `unesco-atlas-{year}` |
| 4 | Gepubliceerde academische artikelen | Regionale sprekersenquêtes | Per-artikel licentie | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | Filipijnse talen | Academisch | `katig-{year}` |

> [!WARNING]
> **Gebruik nooit Wikipedia, door LLM gegenereerde tekst of eigen kennis als primaire bron voor demografische beweringen.** Dit zijn op zijn best secundaire of tertiaire bronnen. Herleid altijd terug naar de primaire gegevens.

### Ondersteuning van Methoden (Dekking van Vertaal-API's)

| Methode | Verificatiebron | Hoe te verifiëren | Hoe te citeren |
|---|---|---|---|
| Google Translate | [Talenlijst](https://cloud.google.com/translate/docs/languages) | API-aanroep of documentatiepagina | `google-translate-{date}` |
| DeepL | [Talenlijst](https://www.deepl.com/docs-api/translate-text/) | API-aanroep | `deepl-api-{date}` |
| Microsoft Translator | [Talenlijst](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | Documentatiepagina | `ms-translator-{date}` |
| LibreTranslate | [Talenlijst](https://libretranslate.com/languages) | API-aanroep | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + modelkaart | `nllb-200-{date}` |
| LLM | Altijd `true` | N.v.t. (kwaliteit varieert) | `llm-assumed` |

### DLS (Digitale Taalondersteuning)

| Prioriteit | Bron | Dekt | Hoe te citeren |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | DLS-scores (originele 143 tools) | `simons-2022` |
| 2 | Ethnologue 27e+ editie | DLS-scores (uitgebreide 211 tools) | `ethnologue-{edition}-dls` |

### Typografie, Meervoudsvormen, Schriften

| Prioriteit | Bron | Dekt | Hoe te citeren |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | Meervoudsregels, aanhalingstekens, getalopmaak | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | Schriftcodes | `iso15924-{date}` |
| 3 | Gepubliceerde grammatica's | Taalspecifieke regels | `{author}-{year}` |

### Contactinvloeden

| Prioriteit | Bron | Dekt | Hoe te citeren |
|---|---|---|---|
| 1 | Gepubliceerde artikelen over historische taalkunde | Studies naar leenwoorden, contactgeschiedenis | `{author}-{year}` |
| 2 | Referentiegrammatica's | Beschrijvingen van structurele invloed | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | Typologische vergelijkingen | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **Beweringen over contactinvloeden zijn het moeilijkst te onderbouwen.** Beweringen zoals "Spaans superstraat, diep, 1571–1898" vereisen expertise in historische taalkunde. Als er geen gepubliceerde bron gevonden kan worden, markeer de bewering dan met `"citation_needed": true` in plaats van te gissen.

---

## 3. Citatieproces (Stap voor Stap)

### Bij het Aanmaken van een Nieuwe Taalkaart

1. **Begin met automatisch ingevulde velden:**
   - Voer `node scripts/build-language-tree.mjs --enrich` uit → vult `classification` in vanuit Glottolog
   - Leg `"glottolog-{version}"` vast in `dataSources`

2. **Voeg CLDR-gegevens toe:**
   - Zoek meervoudsregels, aanhalingstekens en schriftcode op in CLDR
   - Leg `"cldr-{version}"` vast in `dataSources`

3. **Onderzoek demografische gegevens van sprekers:**
   - Raadpleeg EERST nationale volkstellingsgegevens
   - Vergelijk met Ethnologue (indien beschikbaar)
   - Vergelijk met de UNESCO Atlas
   - Leg ALLE geraadpleegde bronnen vast in `dataSources`

4. **Verifieer ondersteuning van methoden:**
   - Controleer de talenlijst van ELKE API (niet op basis van geheugen of aannames)
   - Leg de verificatiedatum vast

5. **Onderzoek contactinvloeden:**
   - Zoek gepubliceerde artikelen over historische taalkunde
   - Documenteer periode, type en diepte met citaten
   - Als er geen gepubliceerde bron bestaat, voeg `"citation_needed": true` toe aan het invloeditem

6. **Onderzoek vitaliteit:**
   - Raadpleeg Ethnologue voor EGIDS
   - Raadpleeg de UNESCO Atlas voor bedreigingsstatus
   - Noteer eventuele discrepanties tussen bronnen

7. **Vul `dataSources` in:**
   - Vermeld ELKE geraadpleegde bron (niet alleen bronnen die gegevens hebben verstrekt)
   - Gebruik het citatieformaat uit de bovenstaande tabellen

### Bij het Bijwerken van een Bestaande Kaart

1. **Wijzig nooit een feitelijke bewering zonder `dataSources` bij te werken**
2. **Als u een aantal sprekers bijwerkt**, verwijder dan de oude bron en voeg de nieuwe toe
3. **Als u ondersteuning voor een methode toevoegt**, verifieer dit via de API en leg de datum vast
4. **Voorzie alle controles van methodondersteuning van een datumstempel** — API-dekking verandert regelmatig

---

## 4. Voorgestelde Schemaverbetering: Citaten per Veld

### Huidig Schema (Platte `dataSources`)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**Probleem:** Welke velden zijn afkomstig van CLDR? Welke van Glottolog? Welke zijn niet geciteerd?

### Voorgestelde Verbetering: Gestructureerde `dataSources`

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### Migratiepad

Dit is een **achterwaarts compatibele** wijziging:
1. Bestaande kaarten behouden de platte reeks (nog steeds geldig)
2. Nieuwe kaarten gebruiken het gestructureerde formaat
3. Schemavalidatie accepteert beide formaten
4. Migreer bestaande kaarten incrementeel naarmate ze worden beoordeeld

> [!TIP]
> **Valideer met een script.** Voeg een `validate-citations.mjs`-script toe dat:
> - Controleert of elke kaart ten minste `classification` en `vitality` bronnen heeft
> - Kaarten met platte `dataSources`-reeksen markeert voor upgrade
> - Waarschuwt bij `methodSupport`-items zonder datumgestempelde verificatie

---

## 5. Kwaliteitscontrolelijst

Verifieer het volgende voordat u een wijziging aan een taalkaart samenvoegt:

- [ ] Elk aantal sprekers heeft een bron (volkstelling of Ethnologue, niet Wikipedia)
- [ ] Elke UNESCO/EGIDS-status heeft een bron
- [ ] Elke vlag voor methodondersteuning is geverifieerd via de daadwerkelijke API (niet aangenomen)
- [ ] Elke contactinvloed heeft een gepubliceerde academische bron OF is gemarkeerd met `citation_needed`
- [ ] Classificatie is automatisch ingevuld vanuit Glottolog (niet handmatig opgebouwd)
- [ ] `dataSources` vermeldt ALLE geraadpleegde bronnen
- [ ] Geen enkele bewering is uitsluitend gebaseerd op door LLM gegenereerde kennis
- [ ] `humanReviewed` is ingesteld op de identificatie van de beoordelaar en de datum als een moedertaalspreker de kaart heeft beoordeeld

---

## 6. Het Veld `humanReviewed`

Het taalkaartschema bevat een veld `humanReviewed` dat momenteel `null` is op alle kaarten. Dit veld dient te worden ingevuld wanneer een moedertaalspreker of gekwalificeerd taalkundige de kaart beoordeelt:

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **Gemeenschapsreview is de gouden standaard.** Geautomatiseerde gegevens en academische artikelen vormen de basis, maar de beoordeling door een moedertaalspreker is de definitieve validatie. Dit is met name van belang voor:
> - Beweringen over contactinvloeden (gemeenschapsleden weten welke leenwoorden daadwerkelijk worden gebruikt)
> - Vitaliteitsbeoordelingen (gemeenschapsleden weten of kinderen de taal nog spreken)
> - Formaliteitssystemen (academische beschrijvingen kunnen alledaagse gebruikspatronen missen)

---

## 7. Referenties voor Dit Proces

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — Vrij
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Unicode-gebruiksvoorwaarden
5. Ethnologue: https://www.ethnologue.com — Eigendomsrechtelijk (abonnement)
6. UNESCO Atlas: http://www.unesco.org/languages-atlas/ — Vrij
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Champollion Taalkaartspecificatie: `cli/website/docs/reference/language-card-spec.md`
