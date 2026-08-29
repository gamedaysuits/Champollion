---
sidebar_position: 4
title: "Language Card Specificatie"
description: "Canoniek schema voor de per-taal configuratiekaarten van Champollion."
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# Specificatie van Taalkaarten

> **Eén enkele bron van waarheid (Single source of truth).** Dit document definieert de canonieke vorm van elke taalkaart. Een kaart stelt alleen wat een geciteerde bron stelt: een veld dat door geen enkele bron wordt gesteld, wordt **weggelaten, niet null** — een ontbrekend veld betekent "geen bron heeft zich uitgesproken", nooit "er is niets om te weten". Het machinaal controleerbare schema wordt geleverd als `shared/schemas/language-card.schema.json` in het npm-pakket, en het [canonieke voorbeeld hieronder](#canonical-template) wordt bij elke site-build gegenereerd vanuit het live corpus, zodat deze pagina niet kan afwijken van de kaarten die het beschrijft.

## De atlas-rebuild van 2026-08 — wat er is veranderd in dit schema

Het kaarten-corpus is nu **build-output**: elke kaart wordt geprojecteerd vanuit een opslag van vastgepinde upstream-snapshots, en opnieuw gebouwd — nooit bewerkt — wanneer een feit verandert. Vier dingen aan de vorm zijn veranderd met die rebuild:

1. **Betwiste velden bevatten een attributie-envelop.** Waar geciteerde bronnen het daadwerkelijk oneens zijn, is het veld geen platte waarde maar `{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`, `speakerEstimates`, `endangerment`, en elk veld dat door een nieuwe bron betwist wordt. Gebruikers dienen kaarten te lezen via de gepubliceerde adapter (`normalizeCard()` in het npm-pakket) in plaats van uit te gaan van platte waarden — `display()` herleidt een envelop tot de overeengekomen waarde en retourneert opzettelijk niets bij een daadwerkelijk geschil in plaats van een winnaar te kiezen.

2. **Hernoemde velden.** `endonym` heeft `nativeName` vervangen · `codeAliases` heeft `aliases` vervangen · `scripts[]` (alle geattesteerde scripts) heeft het platte `script` vervangen, waarbij het primaire script wordt afgeleid van de maximale BCP 47-tag van de kaart · `endangerment` (de beoordeling van elke bron, op de eigen schaal van die bron) heeft het enkele `vitality`-object vervangen · `isoLanguageType` en `isoScope` bevatten nu de eigen woorden van ISO 639-3 ("Living", "Macrolanguage") in plaats van initialen. Nieuwe velden: `modality` ("spoken"/"signed", afgeleid van de afstamming van Glottolog), `glottologBucket` (de niet-genealogische categorieën van Glottolog, buiten het family-slot gehouden), `locale`/`localeScoped`.

3. **Niet-gestelde velden worden weggelaten, niet null.** Een veld dat door geen enkele bron wordt gesteld, ontbreekt op de kaart. De eerdere regel ("elke kaart MOET elk top-level veld bevatten, zelfs indien null") is afgeschaft: een lege waarde op een openbaar oppervlak wordt gelezen als een bewering dat er niets te weten valt, wat niet hetzelfde is als niet hebben gezocht.

4. **Er bestaan locale-kaarten.** Naast de taalkaarten bevatten locale-projecties (`fra-CA`, `cmn-Hant`) de feiten van hun taal, herleid voor een territorium of script, geïdentificeerd door een `locale: {language, region, script}`-blok. Een locale is geen taal: sluit locales uit van taaltellingen door middel van dat blok.

## Ontwerpprincipes

1. **Voorzie alles van een bron.** Elke feitelijke bewering is te herleiden tot een benoemde, geversioneerde, primaire bron. Beweringen zonder bron zijn onverifieerbare beweringen. De `_fieldSources`-map (en `source`-annotaties per veld in sub-objecten) maken de herkomst expliciet.

2. **Behoud onenigheid.** Wanneer autoriteiten het oneens zijn (de ene bron zegt 50.000 sprekers, een andere zegt 20.000), slaat de kaart *beide* op met bronvermelding — de envelopvorm hierboven. We nemen geen gemiddelde, lossen het niet op en kiezen geen kant. Gebruikers kunnen zelf door de nuance navigeren.

3. **Afwezig betekent niet-gesteld.** Een ontbrekend veld betekent dat geen enkele bron een waarde stelt. Wanneer een eigenschap daadwerkelijk niet van toepassing is (bijv. grammaticaal geslacht voor een taal die dat niet heeft), vermeldt de geciteerde waarde dit expliciet in plaats van leeg te zijn.

4. **Opnieuw gebouwd, nooit gepatcht.** Kaarten worden geprojecteerd vanuit vastgepinde bronnen door een deterministische build. Een feitelijk defect wordt verholpen bij de source-handler en het corpus wordt opnieuw gebouwd — geen in-place bewerkingen, geen verrijkingslaag die alleen samenvoegt (merge-only).

---

## Drielaagse Architectuur

| Laag | Locatie | Doel |
|------|---------|------|
| **Taalkaarten** | `shared/language-cards/<code>.json` | Per-taalconfiguratie: identiteit, classificatie, bronnen, alles |
| **Genuskaarten** | `shared/language-cards/genera/<genus>.json` | Gedeelde runtime-eigenschappen voor verwante talen (samengesteld, niet automatisch gegenereerd) |
| **Taalboom** | `shared/language-cards/language-tree.json` | Volledige Glottolog-hiërarchie — referentiegegevens voor de Lab-UI en taalontdekking |

---

## Overeringsmodel

> **Grotendeels historisch sinds de atlas-rebuild.** Geen enkele taalkaart op schijf bevat nog `extends` — elke kaart wordt volledig gematerialiseerd door de build, omdat geërfd proza niet citeerbaar was (een bewering op familieniveau droeg een adres op taalniveau). Het mechanisme zelf overleeft op één plek: de offline bundel van het npm-pakket levert locale-kaarten als compacte `extends`-delta's ten opzichte van hun taal, herleid door dezelfde merge die hier wordt beschreven.

Wanneer een kaart `"extends": "family-dravidian"` instelt, voegt de runtime de bovenliggende
kaart samen met de onderliggende kaart via `_deepMerge()` (in `lib/registers.js`). Hierdoor kunnen
genuskaarten gedeelde registers, formaliteitssystemen en genderbegeleiding definiëren die
doorstromen naar alle lidtalen — zonder gegevens te dupliceren over honderden
afzonderlijke kaarten.

### Samenvoegingssemantiek

| Waarde van kind | Gedrag | Waarom |
|-----------------|--------|--------|
| `null` | Overnemen van ouder | `null` betekent "ik definieer dit niet" — de waarde van de ouder stroomt door |
| Niet-null | Ouder overschrijven | De gegevens van het kind zijn specifieker — krijgen prioriteit |
| Genest object | Recursief samenvoegen | Velden van het kind overschrijven, velden van de ouder blijven behouden |
| Array | Volledig vervangen | Arrays worden niet item voor item samengevoegd — de array van het kind wint |

### Identiteitsvelden (nooit overgeërfd)

Sommige velden behoren tot de kaart zelf en mogen NOOIT worden overgeërfd van een ouder:

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

Zelfs als een ouderkaart `aliases: ["macro-code"]` definieert, zal een kindkaart
die aliassen NIET overnemen. Deze velden zijn altijd de eigen waarden van het kind (inclusief
`null` indien niet ingesteld).

**Waarom:** Zonder deze regel zou elke Cree-taal `aliases: ["cre"]`
overnemen van de macrotaalbovenliggende, waardoor elke variant een alias van de macro wordt.

### Voorbeeld: Hoe een Cree-kaart wordt opgelost

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

Tijdens runtime retourneert `getLanguageCard("crk")` een samengevoegd object met de registers van genus-cree + de eigenschappen van family-algic (indien aanwezig) + de eigen identiteit en metadata van crk.

### Genuskaartsjabloon

Genuskaarten bevinden zich in `shared/language-cards/genera/` en definiëren gedeelde eigenschappen
voor een taalgroep. Ze volgen hetzelfde schema als gewone kaarten, maar met
andere conventies:

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**Belangrijkste regel:** Genuskaarten mogen ALLEEN gegevens bevatten die werkelijk gedeeld worden door
de gehele groep en afkomstig zijn van gezaghebbende bronnen. Als een formaliteitssysteem
verschilt tussen leden, hoort het op de afzonderlijke kaarten thuis, niet op het genus.

## Canoniek voorbeeld \{#canonical-template}

> **Gegenereerd, niet geschreven.** Alles in deze sectie is afgeleid van het live corpus tijdens de build: de volledige `crk` (Plains Cree) kaart, byte-voor-byte, plus een `fra-CA` locale-fragment. Wanneer het corpus opnieuw wordt gebouwd, leidt de volgende site-build deze pagina opnieuw af. Er is geen handmatig onderhouden sjabloon meer over dat verouderd kan raken — het vorige liep een hele schemageneratie achter op de kaarten en is op 16-08-2026 afgeschaft.

Het voorbeeld toont de **vorm op schijf (on-disk shape)** — wat u krijgt als u het bestand opent. Gebruikers dienen kaarten nog steeds te lezen via de gepubliceerde adapter (`normalizeCard()` in het npm-pakket): deze herleidt enveloppen, overbrugt de namen van vóór de overgang (pre-cutover), en leidt de display-only waarden af (primair script, vitaliteitsniveau) die de ruwe kaart opzettelijk niet bevat.

Waar u op moet letten tijdens het lezen:

1. **Attributie-enveloppen.** `name`, `classification.family`, `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag`, en `politenessDistinction` bevatten elk `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment` heeft `"agreement": "incommensurable"`: de bronnen hiervan beoordelen op verschillende schalen, dus elke waarde benoemt zijn `scale` in plaats van te worden geconverteerd naar die van een winnaar.

2. **Weggelaten betekent niet-gesteld.** De kaart heeft geen `iso639_1` (Plains Cree heeft geen ISO 639-1-code) en geen `phonologicalInventory` (geen enkele geïngesteerde bron stelt er een) — die velden zijn simpelweg afwezig, nooit `null` of `[]`.

3. **Herkomst (provenance) is een eersterangs laag.** `_fieldSources` koppelt elk veld aan de bron(nen) die het hebben gesteld, waarbij `champollion-derived-v1` waarden markeert die door Champollion zijn berekend. `_card` stempelt het type, de id, de revisie van de kaart, en welke velden de correctiestraat (correction lane) mag aanraken; `_atlas` stempelt de corpus-release.

4. **Geen run-resultaten.** Niets op de kaart is een gemeten score van methode-output — chrF, FST-acceptatiepercentages en soortgelijke zaken zijn run-resultaten die worden gekoppeld aan (methode, dataset, metriek) en bevinden zich op het leaderboard. De kaart stelt alleen dat resources *bestaan* (`resources`, `lexicalResources`, `methodSupport`).

<CardSpecExample variant="language" />

### Een locale-kaart is een projectie, geen taal \{#locale-card-example}

Naast de taalkaarten bevinden zich locale-kaarten (`fra-CA`, `cmn-Hant`): de feiten van een taal **herleid voor een territorium of script**, geïdentificeerd door hun `locale`-blok — nooit door de vorm van de code. Een locale-kaart erft de feiten van zijn taal, herleidt de feiten die betrekking hebben op script en territorium (`script`, `localeScoped`), en is **geen taal**: sluit locale-kaarten uit van elke taaltelling en lijst per taal door middel van dat `locale`-blok.

<CardSpecExample variant="locale" />

---

## Veldreferentie \{#field-reference}

Twee conventies zijn van toepassing op elke onderstaande tabel:

- **"envelop"** betekent een attributie-envelop — `{agreement, consensus?, values: [{value, source, note?, scale?}]}` — die de bewering van *elke* bron bevat. Een veld dat wordt vermeld als `envelope` kan verschijnen als een platte waarde op kaarten waar slechts één bron zich uitspreekt (bijvoorbeeld, languoïden die alleen in Glottolog voorkomen, bevatten een platte `name`); gebruikers moeten met beide kunnen omgaan, wat de gepubliceerde adapter ook doet.
- Geen enkel veld is vereist behalve `code` en `name`; al het andere wordt **weggelaten wanneer geen enkele bron het stelt**. De bron(nen) die elk veld stellen, worden per kaart vastgelegd in `_fieldSources`, dus de tabellen beschrijven het *soort* bron in plaats van versies vast te pinnen die zouden kunnen afwijken.

### § 1. Identiteitsvelden

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `code` | `string` | **Vereist.** De kaart-ID en bestandsnaam. ISO 639-3 voor taalkaarten (`crk`); languoïden die alleen in Glottolog voorkomen, bevatten hun glottocode; locale-kaarten bevatten een locale-code (`fra-CA`). |
| `name` | envelop | **Vereist.** Engelse referentienaam (ISO 639-3-register, LinguaMeta, Glottolog). |
| `endonym` | envelop | Heeft `nativeName` vervangen. Hoe sprekers de taal noemen, in de taal zelf (LinguaMeta, Wikidata). Afwezig wanneer geen enkele bron er een stelt — een endoniem wordt nooit door ons verzonnen of getranslitereerd. |
| `alternateNames` | `string[]` | Andere geattesteerde Engelse namen. |
| `iso639_1` | `string` | Alleen aanwezig wanneer er een tweeletterige ISO 639-1-code bestaat (`fra` → `"fr"`). |
| `isoScope` | `string` | De eigen woorden van ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (heeft de initialen `"I"`/`"M"`/`"S"` vervangen). |
| `isoLanguageType` | `string` | Heeft `isoType` vervangen. De eigen woorden van ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | De macrotaal waartoe deze taal behoort (`crk` → `"cre"`). ISO 639-3 macrotaal-mappings. |
| `macrolanguageMembers` | `string[]` | Op macrotaal-hubkaarten: de individuele lidcodes (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelop | Op macrotaalkaarten: leden waarvan de tags door de BCP 47-registers worden samengevoegd in de tag van deze macrotaal (CLDR-aliastabel + SIL langtags, elk geattribueerd). |
| `supersededCodes` | `string[]` | Afgeschafte ISO 639-3-codes die SIL nu naar deze taal verwijst — vastgelegd op de opvolger zodat corpora die onder een oude code zijn gepubliceerd nog steeds worden herleid. |
| `codeAliases` | `string[]` | Heeft `aliases` vervangen. Identifiers op codeniveau die naar deze kaart herleiden. |
| `bcp47` | `string` | De BCP 47-tag van de taal zoals gesteld (LinguaMeta). |
| `bcp47Tag` | envelop | Afgeleid door Champollion: de RFC 5646-tag (kortste ISO 639-code wint). |
| `bcp47FullTag` | envelop | De maximale taal-script-regio-vorm (CLDR likelySubtags + SIL langtags). De adapter leidt het **primaire script** af van deze tag. |
| `modality` | `string` | `"spoken"` of `"signed"`, afgeleid van de afstamming van Glottolog. Schrijven is een orthografisch attribuut, geen modaliteit — een ongeschreven taal wordt nog steeds volledig gesproken of gebaard. |
| `locale` | `object` | **Alleen locale-kaarten.** `{language, region, script, publishedTag, source, note}` — DE locale-identiteit. Sluit locale-kaarten uit van taaltellingen door middel van dit blok, nooit door de vorm van de code. |
| `localeScoped` | `object` | Alleen locale-kaarten: waarden herleid voor het territorium/script van de locale (bijv. `scriptName`, `cldrOfficialStatus`). |

### § 2. Classificatievelden

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `glottocode` | `string` | De identifier van Glottolog voor deze languoïde (`crk` → `"plai1258"`). Languoïden die alleen in Glottolog voorkomen — talen die Glottolog registreert maar ISO 639-3 niet — gebruiken de glottocode als hun kaart-`code`. |
| `classification` | `object` | Container voor de onderstaande plaatsingsvelden. Elk veld is onafhankelijk voorzien van een bron en wordt onafhankelijk weggelaten — een isolaat, of een taal die in een Glottolog-categorie is geplaatst, bevat legitiem slechts een deel van dit object. |
| `classification.family` | envelop | De top-level familie die elke classificatie-autoriteit stelt. Glottolog en WALS zijn afzonderlijke taxonomieën die het niet altijd met elkaar eens zijn, dus beide worden bewaard en geattribueerd. Lint-regel R5 controleert de Glottolog-waarde in de envelop tegen de eigen boomstructuur van Glottolog: WALS mag het oneens zijn met Glottolog, maar Glottolog mag niet verkeerd worden geciteerd. Isolaten hebben helemaal geen familie. |
| `classification.familyGlottocode` | `string` | Glottocode van die top-level familie (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | De tussenliggende classificatie-node van WALS (`crk` → `"Algonquian"`). Een WALS-concept, **geen** Glottolog-concept — Glottolog publiceert een boomstructuur met willekeurige diepte zonder genus-niveau — dus het is alleen aanwezig waar WALS de taal codeert. |
| `classification.ancestry` | `string[]` | Het afstammingspad van Glottolog als voorouder-glottocodes, root eerst (`["algi1248", …, "plai1264"]`). De volgorde **is** de bewering: dit is een pad, nooit een alfabetische set. |
| `classification.glottologBucket` | `string` | De niet-genealogische categorieën van Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Buiten het family-slot gehouden omdat een categorie classificeert op soort, niet op afstamming: een kaart met een categorie heeft geen familie, en dat is het eerlijke resultaat. |
| `isIsolate` | `boolean` | Of Glottolog deze taal classificeert als een isolaat. |

De kaart van vóór de overgang bevatte ook een `genusGlottocode`. Deze is afgeschaft, samen met de categoriefout die deze heeft voortgebracht: het genus is een concept van WALS, en door het te kleden in een Glottolog-identifier werd een boom-node gesteld die Glottolog niet heeft. De Glottolog-hiërarchie wordt in plaats daarvan gedragen door `ancestry`.

### § 3. Geografische Velden

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `macroarea` | `string` | Het macrogebied van Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` of `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Het representatieve punt van Glottolog. Een punt, geen territorium: het plaatst de taal op een kaart en beweert niets over bereik of grenzen. |
| `countries` | `string[]` | ISO 3166-1 alpha-2-codes van de landen die Glottolog associeert met de taal (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Een officiële status die een bepaald territorium aan de taal toekent, zoals CLDR deze registreert (gedragen via LinguaMeta) — `"Official"`, `"Regional official"`. Op een locale-kaart bevindt de status die is herleid voor het territorium van *die locale* zich in `localeScoped.cldrOfficialStatus`. |

De `regions`-array van vóór de overgang (spreker-uitsplitsingen per land met admin-codes) en `arealContext` (Sprachbund-lidmaatschap) zijn afgeschaft: geen enkele geïngesteerde bron stelt ze, en curatie zonder bron overleeft een rebuild niet. Spreker-beweringen op regioniveau kunnen terugkeren op de dag dat een citeerbare bron in de pijplijn belandt; tot die tijd is afwezigheid de eerlijke staat.

### § 4. Schrijfsysteemvelden

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `scripts` | `string[]` | Heeft het platte `script` vervangen. **Alle** geattesteerde ISO 15924-codes (`crk` → `["Cans", "Latn"]`), ongeordend — lees `scripts[0]` nooit als "het" script. Het primaire script wordt door de adapter afgeleid van de maximale tag van `bcp47FullTag`. |
| `scriptNames` | `string[]` | Door Champollion afgeleide weergavenamen voor `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Heeft `dir` vervangen. De eigen woorden van de bron — `"left-to-right"` / `"right-to-left"` (was `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: het script dat zo canoniek is voor de taal dat BCP 47-tags het weglaten (`fra` → `"Latn"`). |
| `script` | `string` | **Alleen locale-kaarten**: het voor de locale herleide script (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Taalkaarten bevatten geen plat script-veld. |

Een taal zonder geattesteerd schrift heeft simpelweg **geen `scripts`-veld** — afwezigheid betekent dat geen enkele bron een script heeft gesteld, niet een bewering dat de taal "ongeschreven" is. (Gebarentalen vormen de grootste groep in deze categorie: geen enkel notatiesysteem heeft een standaardacceptatie binnen de gemeenschap voor alledaagse geletterdheid.)

### § 5. Demografische Velden en Vitaliteitsvelden

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `speakerEstimates` | envelop | De schatting van elke bron, geattribueerd. Waarden kunnen exacte tellingen zijn of de eigen bereik-strings van de bron (`"10000-99999"`), waarbij de voorbehouden van de bron letterlijk worden overgenomen in `note`. `"agreement": "conflicting"` komt vaak voor — het tonen van het conflict *is* het product; er wordt niets gemiddeld of gekozen. |
| `endangerment` | envelop | Heeft het enkele `vitality`-object vervangen. De beoordeling van elke bron **op de eigen schaal van die bron** — elke waarde bevat een `scale`-veld, en `"agreement": "incommensurable"` is de norm omdat de vocabulaires van ELCat, Glottolog AES en LinguaMeta geen vertalingen van elkaar zijn. De adapter leidt één *vitaliteitsniveau (vitality tier)* voor weergave af van een enkele benoemde bron volgens de gedeclareerde autoriteitsvolgorde; dat niveau is alleen voor weergave — de volledige geattribueerde set blijft op de kaart. |

Een *weergegeven* sprekersaantal ergens in Champollion moet overeenkomen met een van de geciteerde `speakerEstimates`-vermeldingen of expliciete `champollion-derived`-herkomst bevatten — afgedwongen door de regels voor kaartintegriteit.

### § 5.5 Documentatie- en Digitale Aanwezigheidsvelden

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `documentation` | `object` | Heeft `documentationDepth` vervangen. De registratie van Glottolog van hoe goed de taal beschreven is, in de eigen bewoordingen van Glottolog. |
| `documentation.medLevel` | `string` | Het 'Most Extensive Description'-niveau van Glottolog, letterlijk — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | De bibliografische sleutel van die meest uitgebreide beschrijving in de referentiecatalogus van Glottolog. |
| `documentation.firstDocumented` | `number` | De eigen 'first-year-of-documentation'-kolom van Glottolog, letterlijk — hierheen verplaatst vanuit het top-level veld van vóór de overgang. Slechts aanwezig bij een paar honderd talen, en de schaarsheid is op zichzelf al de moeite waard om te weten. |
| `documentation.lastDocumented` | `number` | De 'last-year-of-documentation'-kolom van Glottolog, letterlijk — aanwezig bij ongeveer duizend talen. |
| `wikipediaEdition` | `object` | Heeft `digitalPresence` vervangen. `{site, url, name}` — er bestaat een open Wikipedia-editie in deze taal (`afr` → `af.wikipedia.org`). Alleen het bestaan, opzettelijk **zonder artikeltellingen**: verschillende edities zijn grotendeels door bots gegenereerd, en een enorme editie is niet "beter gedocumenteerd" dan een kleine in enige zin die een vertaler kan gebruiken. |
| `dialectCount` | `number` | De eigen `child_dialect_count`-kolom van Glottolog, letterlijk — alleen directe kind-dialecten, niet de hele sub-boom. Dit is de bewering van Glottolog, niet onze berekening: een eerdere regel stempelde het als `champollion-derived` en liet duizenden kaarten de eer opstrijken voor de telling van Glottolog. |

De rest van het `digitalPresence`-blok van vóór de overgang (Common Voice-uren, Tatoeba-zintellingen) is afgeschaft totdat die bronnen in de pijplijn belanden — het Tatoeba-corpus zelf verschijnt al waar het hoort, als een parallel corpus onder `resources.corpora` (§ 9).

### § 6. Formaliteits-, Register- en Gendervelden

Het geprojecteerde corpus bevat hier precies één veld — het geciteerde feit:

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `politenessDistinction` | envelop | Of de taal beleefdheid grammaticaliseert in tweede-persoonsvormen. Geattribueerd over Grambank GB415 (binair: afwezig/aanwezig) en WALS 45A (vier niveaus: geen onderscheid / binair / meervoudig / voornaamwoorden vermeden). Dit zijn verschillende schalen, dus elke waarde benoemt zijn `scale` en de envelop rapporteert ze als **incommensurabel (onvergelijkbaar)** in plaats van als een meningsverschil. |

**Het registersysteem is configuratie, geen kaartfeit.** Het corpus van vóór de overgang sloeg `formality`-proza en `registers`-prompts op op bijna achttienhonderd kaarten elk — bijna allemaal gegenereerd uit dezelfde twee bronnen hierboven, en vervolgens meegedragen alsof het handmatig gecureerde configuratie was. De atlas behoudt het feit; de configuratie-oppervlakken — `formality`, `registers`, `gender`, `codeSwitching` — blijven onderdeel van het **gecureerde schema van het npm-pakket** (`language-card.schema.json`), bevinden zich op de gecureerde genus/familie-hubkaarten, en bereiken de CLI via de `extends`-merge van het registersysteem, beschreven in het [Overervingsmodel (Inheritance Model)](#inheritance-model). Het zijn geen geprojecteerde atlas-velden: geen enkele kaart in het geprojecteerde corpus bevat ze, en de atlas-build zal ze nooit schrijven. De richtlijnen in [Goede register-presets schrijven (Writing Good Register Presets)](#writing-good-register-presets) zijn van toepassing op die gecureerde straat.

### § 7. Taalkundig Profielvelden

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `typologicalProfile` | `object` | Eén sleutel per geïngesteerd typologisch kenmerk, elke waarde is de eigen codering van de bron, elke sleutel is alleen aanwezig waar de bron deze taal codeert. Booleans komen van Grambank-kenmerken, categorie-strings van WALS-hoofdstukken; het beslissingsregister (decision registry) benoemt de exacte upstream-parameter voor elke sleutel. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — tellingen berekend door Champollion over een geciteerde PHOIBLE-inventaris (PHOIBLE publiceert één rij per segment en stelt geen tellingen), dus elke waarde bevat `champollion-derived`-herkomst. **PHOIBLE is de enige autoriteit op het gebied van toon** (lint R1): Grambank heeft geen toon-kenmerk, en niets anders op de kaart mag tonaliteit claimen. |
| `numeralSystem` | `object` | `{base}` — het getallenstelsel (numeral base), letterlijk uit Chan's *Numeral Systems of the World's Languages* (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; bijna honderd verschillende waarden). Afwezig wanneer Chan's eigen basiskolom leeg is — ongeveer de helft van de onderzochte talen — omdat een eerdere generator de lege plek opvulde met `"decimal"` en waarden verzon voor tweeduizend talen. |
| `pluralCategories` | `string[]` | De kardinale meervoudscategorieën die CLDR voor deze taal vermeldt — Arabisch onderscheidt `["zero", "one", "two", "few", "many", "other"]`, Frans drie, Chinees één. Gelezen uit de sleutels van de eigen regelset van CLDR, dus het is de bewering van CLDR, niet onze afleiding. Heeft het `rules.plurals.categories` van vóór de overgang vervangen; een i18n-pijplijn heeft dit nodig om te weten hoeveel meervoudsvormen een bericht moet leveren. |

De `typologicalProfile`-sleutels die momenteel worden geprojecteerd, met hun upstream-parameters:

- **WALS-hoofdstukken** (categorie-strings, de eigen waardelabels van WALS): `fusion` (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication` (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A), `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Grambank-kenmerken** (booleans): `hasGenderInPronouns` (GB030), `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase` (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083), `marksPresentTense` (GB084)

De `linguisticChallenges`- en `contactInfluences`-blokken van vóór de overgang worden niet geprojecteerd — onderzocht proza zonder geïngesteerde bron blijft op het gecureerde schema van het npm-pakket, net als de register-oppervlakken in § 6 (de tabellen voor [Contactinvloedstypen (Contact Influence Types)](#contact-influence-types) hieronder bedienen die straat). Het `rules`-blok is afgeschaft: wat daarin citeerbaar was, overleeft hier als `pluralCategories` en de script-velden in § 4.

### § 8. Encyclopedische Velden

Afgeschaft van kaarten. De `encyclopedic`- (geschiedenis- en dialectessays, institutionele links), `culturalAphorism`- en `varieties`-blokken van vóór de overgang waren handmatig gecureerd proza op kaartniveau, wat de rebuild per definitie verwijdert. De lidmaatschapsfeiten waar `varieties` naar verwees, zijn nu geciteerde identiteitsvelden (§ 1 `macrolanguageMembers` en `canonicalisedMembers`), en de tooldekking per variëteit wordt beantwoord door de eigen kaart van elk lid (`methodSupport`, `resources`). Een representatief gezegde kan terugkeren via een straat voor bijdragen uit de gemeenschap, met toestemming en bronvermelding; het zal niet terugkeren als een ongeciteerd kaartveld.

### § 9. Digitale Bronvelden

Alles in deze sectie stelt **bestaan en capaciteit, nooit kwaliteit**: dat een resource is gepubliceerd en wie deze publiceert — nooit dat deze goed, compleet of bruikbaar is, en nooit een gemeten score. Elke gemeten score van methode-output is een run-resultaat gekoppeld aan (methode, dataset, metriek), bevindt zich op het leaderboard, en is verboden op kaarten (lint R3).

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `resources` | `object` | Container: elk subveld hieronder is een onafhankelijk van een bron voorziene lijst, weggelaten wanneer geen enkele bron het stelt. |
| `resources.fsts` | `object[]` | Gepubliceerde finite-state morfologische analysers: `{name, url, publisher, license, licenceEstablished, archived}`. De licentie reist mee met elke vermelding in plaats van dat deze als uniform wordt beschouwd over een catalogus — licentiegrenzen hebben de daadwerkelijke voorwaarden nodig. Voor een polysynthetische taal is een FST vaak de enige structurele controle die überhaupt bestaat. |
| `resources.corpora` | `object[]` | Parallelle corpora die deze taal attesteren: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Vermeld via **paren**, omdat een parallel corpus een taal alleen attesteert via een paar — "dekt Swahili" zonder te zeggen waartegen, beantwoordt een vraag die niemand heeft gesteld. Bestaan en omvang, nooit kwaliteit. |
| `resources.monolingualCorpora` | `object[]` | Eentalige corpora — gescheiden gehouden van `corpora` zodat "heeft een corpus" nooit twee onvergelijkbare dingen betekent. |
| `resources.speech` | `object[]` | Gepubliceerde spraak-resources. Alleen bestaan. |
| `resources.keyboards` | `object[]` | Gepubliceerde toetsenbordindelingen. Eenvoudig maar cruciaal: voor een orthografie die tekens nodig heeft die geen enkele standaardindeling produceert, is een indeling het verschil tussen of de taal typbaar is of niet. |
| `resources.typology` | `object[]` | Typologische datasets die deze taal *coderen*, met omvang: `{dataset, featuresCoded, datasetFeatureTotal}`. Bestaan en omvang, nooit inhoud — wat een kenmerk zegt, blijft van de kaart totdat een persoon de parameter-map schrijft die het accepteert (de geaccepteerde kenmerken verschijnen in `typologicalProfile` van § 7). De kenmerktellingen zijn onze berekening, dus ze bevatten `champollion-derived`-herkomst. |
| `lexicalResources` | `object` | Container voor lexicale bestaansfeiten. |
| `lexicalResources.datasets` | `object[]` | Gepubliceerde woordenlijsten met hun dekking: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Gepubliceerde woordenboeken — bestaan, nooit kwaliteit, en **gericht** waar de uitgever ze op richt: een woordenboek dat de ene kant op gaat, is een andere resource dan een woordenboek dat de andere kant op gaat. Vermeldingen zijn niet uniform van vorm (een CLDF-dataset kent zijn aantal vermeldingen; een repository kent zijn paar en richting); elk benoemt zijn eigen bron, en licentie en gearchiveerde status reizen mee per vermelding. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Door Champollion berekende tellingen over CLICS³: concepten geattesteerd voor deze taal, en vormen die mappen naar twee of meer verschillende concepten. `champollion-derived`. |
| `methodSupport` | `object` | Welke vertaalmethoden deze taal dekken — capaciteit, nooit een score. Vorm: `{total, byTier, named, truncated}`. Engels bevat duizenden methode-edges en de mediane taal een paar dozijn, dus de kaart bevat de *vorm* van het bewijs — `total` plus `byTier`-tellingen per betrouwbaarheidsniveau (`fetched`, `partially-confirmed`, `model-card-declared`) — en benoemt alleen de sterkste vermeldingen (elk `{value, variant, source, confidence}`), gemaximeerd. Register-**services** worden altijd volledig benoemd, boven het maximum, dus de afwezigheid van een service in `named` is een echt antwoord; de afwezigheid van een modelkaart-vermelding betekent alleen "niet bij de sterksten", en elke edge blijft opvraagbaar in de atlas-store. |
| `metricModelSupport` | envelop | Evaluatiemetriek-modellen die dekking van deze taal publiceren, met de model-identifier die een harness laadt (`masakhane/africomet-mtl`). Stuurt daadwerkelijk gedrag aan — COMET-modelselectie — en is nog steeds capaciteit, nooit een score. |

**Samengevoegd in de bovenstaande velden:** het `keyboardSupport` van vóór de overgang (→ `resources.keyboards`), `corpusAvailability` (→ `resources.corpora` / `resources.monolingualCorpora`), en `databaseCoverage` (→ `resources.typology` plus `lexicalResources` — een databasevermelding is nu een geciteerd dekkingsfeit met omvang, geen boolean).

**Afgeschaft van kaarten:** `omt1600`, `evalDatasets`, `pipelineReadiness`, en `metricPlugins` — geen van deze wordt gesteld door een geïngesteerde bron, en een gereedheidsniveau (readiness tier) is een oordeel, geen citaat.

**Gecureerd, niet geprojecteerd:** de eval-standard declaratie-oppervlakken (`evalStandard`, `evalMetrics`, `evalPack`) blijven in het gecureerde schema van het npm-pakket. Ze vertellen het evaluatie-harness welk extern scheidsrechterspakket (referee package) een taal scoort (scheidsrechters, geen deelnemers — de kern van het harness levert geen taalspecifieke scorer-code); het harness leest ze van een kaart wanneer ze aanwezig zijn, maar geen enkele kaart in het geprojecteerde corpus bevat ze momenteel, en de atlas-build schrijft ze niet. Hetzelfde geldt voor het `install`-blok dat de FST-installer van het harness leest uit `resources.fsts[]`-vermeldingen (`get_fst_install_info()` in `language_cards.py`): de geprojecteerde vermeldingen bevatten alleen bestaansfeiten.

### § 10. Herkomstvelden

| Veld | Vorm | Opmerkingen |
|-------|-------|-------|
| `_fieldSources` | `object` | Op elke kaart. Koppelt elk veldpad op de kaart (`"classification.family"`, `"coordinates.lat"`) aan de gesorteerde bron-id's die het hebben gesteld (`["glottolog-v5.3", "wals-v2020.5"]`). Waarden die door Champollion zijn berekend, bevatten `champollion-derived-v1`. Bron-id's zijn geversioneerd — `grambank-v1.0.3`, `iso639-3-20260715` — zodat elke bewering te herleiden is tot de exacte release die deze heeft gedaan. |
| `coverage` | `object` | Op elke kaart, en **berekend door de projector, niet gesteld door enige bron**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — hoeveel verschillende bronnen zich uitspreken over deze taal, hoeveel kaartcomponenten een waarde bevatten van het totaal aantal dat gevuld kan worden, en hoeveel waarden een bron positief heeft geregistreerd als *afwezig* (gezocht en nee gezegd — een ander feit dan nooit te hebben gezocht). Dit is wat een dunne kaart in staat stelt te zeggen **waarom** deze dun is, in plaats van er uit te zien als verwaarloosd. |
| `_card` | `object` | De eigen metadata van de kaart: `{type, id, revision, correctableFields}`. `type` is `"language"` of `"locale"` (methode- en corpuskaarten gebruiken dezelfde projector); `revision` is een content-hash, dus elke wijziging in de inhoud van de kaart verandert deze; `correctableFields` somt de veldpaden op die waarden bevatten — de velden die de correctiestraat mag aanraken. |
| `_atlas` | `object` | `{version}` — de corpus-release-stempel (`"unreleased"` tussen releases). Opzettelijk een release-id, **geen** build-timestamp: een timestamp zou twee builds van identieke pins laten verschillen door de kalender, wat de eigenschap vernietigt die iedereen in staat stelt de atlas te controleren — dezelfde pins erin, dezelfde bytes eruit. |

Het provenance-blok van vóór de overgang is in zijn geheel afgeschaft: `dataSources` (vervangen door de `_fieldSources`-map per veld), `supportTier` (een berekend oordeel, vervangen door de neutrale `coverage`-tellingen), `_generated` (het hele corpus wordt gegenereerd; de stempel is `_card.revision` plus `_atlas.version`), `humanReviewed` en `notes` (curatie die thuishoort in straten met hun eigen registraties), en de top-level `firstDocumented`/`lastDocumented` (verplaatst naar `documentation` in § 5.5, waar hun bron ze daadwerkelijk stelt).

---

## Taalcodebeleid

Champollion gebruikt **ISO 639-3** als canonieke identificator. Andere standaardcodes
worden geregistreerd als aliassen en worden tijdens runtime omgezet naar de ISO 639-3-code.

| Prioriteit | Standaard | Voorbeeld | Veld | Gebruik |
|----------|----------|---------|-------|-----|
| 1 (canoniek) | ISO 639-3 | `crk` | `code` | Kaartbestandsnaam, config-sleutels, API-parameters |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Geaccepteerd in CLI, herleid naar ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Geaccepteerd in CLI, herleid naar ISO 639-3 |
| Referentie | Glottocode | `plai1258` | `glottocode` | Alleen classificatie, niet voor runtime |

**Resolutievolgorde:** Wanneer een gebruiker een code opgeeft:
1. Directe match op `card.code` → gevonden
2. Match op `card.codeAliases[]` → gevonden, retourneer de canonieke kaart
3. Match op `card.iso639_1` → gevonden (fallback)
4. Niet gevonden → fout

### Migratiegeschiedenis: ISO 639-1 → ISO 639-3

Vóór v8 gebruikten kaartbestandsnamen ISO 639-1-codes waar beschikbaar (`fr.json`,
`de.json`, `ja.json`). Bij de migratie naar 639-3 werden alle kaarten hernoemd naar hun
ISO 639-3-equivalenten:

| Vóór | Na | Waarom |
|------|-----|--------|
| `fr.json` | `fra.json` | 639-3 is canoniek |
| `de.json` | `deu.json` | 639-3 is canoniek |
| `zh.json` | `cmn.json` | Macrotaal → standaard individuele taal |
| `ar.json` | `arb.json` | Macrotaal → Modern Standaard Arabisch |
| `ms.json` | `zsm.json` | Macrotaal → Standaard Maleis |

**Wat is er gebeurd met de oude codes?**
- De oude 639-1-code staat in `card.iso639_1`
- De oude 639-1-code staat in `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` retourneert `"fra"` tijdens runtime — backwards compatible
- Gebruikers kunnen nog steeds `"fr"` in hun configuratie schrijven — het wordt transparant herleid

**Wat er architecturaal is veranderd:**
- `_deepMerge()` slaat nu `null`-waarden over (erft van ouder)
- `_deepMerge()` heeft nu een identiteitsveldset (code, extends, aliassen worden nooit overgeërfd)
- `formality.default` wordt nu afgeleid van register-`isDefault: true`-vlaggen
- 205 op Grambank gebaseerde kaarten kregen een structurele `formality.default`-correctie
- 38 genus-/familie-/macrotaalkaarten bieden overervingsdoelen

---

## Randgevallen

### Gebarentalen
Gebarentalen (bijv. ASE — Amerikaanse Gebarentaal) zijn legitieme talen met ISO 639-3-codes. Ze hebben geografie en sprekersaantallen, maar:
- `modality` is `"signed"` — de positieve bewering van de kaart over wat de taal *is*; de afwezigheid van een schriftsysteem is een afzonderlijk feit
- `scripts` is doorgaans afwezig (geen enkel notatiesysteem heeft een standaardacceptatie binnen de gemeenschap), hoewel `"Sgnw"` (SignWriting) verschijnt waar een bron dit stelt
- `textDirection` is afwezig
- `linguisticChallenges` dient ruimtelijke grammatica, classifiers, enz. te behandelen

### Oude & Historische Talen
Talen zoals Latijn (`lat`, isoLanguageType `"Historical"`) en Sanskriet (`san`) worden nog steeds gebruikt in specifieke contexten (liturgisch, academisch) maar hebben geen moedertaalsprekers:
- `isoLanguageType` bevat het eigen statuswoord van ISO (`"Ancient"`, `"Historical"`, `"Extinct"`) — de kaart zwakt dit nooit af en overschrijft het nooit
- `endangerment` en `speakerEstimates` rapporteren wat de geciteerde bronnen daadwerkelijk beoordelen, met voorbehouden letterlijk overgenomen (L2-gemeenschapstellingen blijven gelabeld zoals hun bronnen ze labelen)
- `firstDocumented` / `lastDocumented` plaatsen ze in de tijd

### Kunsttalen (Constructed Languages)
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, enz.:
- `classification` kan afwezig zijn — Glottolog plaatst kunsttalen (conlangs) onder een niet-genealogische categorie, en de categorie wordt nooit weergegeven als een familie
- `contactInfluences` weerspiegelt het bronmateriaal (bijv. Esperanto put uit Romaans, Germaans, Slavisch)
- `endangerment` is ongebruikelijk — een groeiende sprekersgemeenschap maar geen oorspronkelijk thuisland

### Macrotalen
Arabisch (`ara`), Chinees (`zho`), Cree (`cre`), Quechua (`que`) zijn macrotalen die meerdere individuele talen omvatten:
- `isoScope: "Macrolanguage"` — een navigatie-hub, nooit een benchmark-doelwit
- `macrolanguageMembers` somt de individuele lidcodes op; `canonicalisedMembers` registreert welke leden door de BCP 47-registers worden samengevoegd in de tag van de macrotaal (elk register geattribueerd)
- `methodSupport` weerspiegelt wat de *macrotaalkaart* ondersteunt (meestal de gestandaardiseerde variëteit)
- Individuele leden hebben hun eigen kaarten, die `macrolanguage` terugdragen naar de hub

### Talen Zonder Gestandaardiseerde Orthografie
Veel talen (vooral talen met een mondelinge traditie) hebben geen gestandaardiseerd schriftsysteem, of hebben concurrerende orthografieën:
- `scripts`, `scriptNames`, en `textDirection` zijn afwezig — geen enkele bron heeft een script gesteld, wat niet dezelfde bewering is als "ongeschreven"
- `notes` dient de orthografische situatie uit te leggen
- `linguisticChallenges` dient te vermelden hoe dit MT (Machine Translation) beïnvloedt (bijv. geen trainingsdata)

### Diglossia
Talen zoals Arabisch (MSA vs. dialecten) of Guaraní (Jopará vs. puur Guaraní):
- `codeSwitching` legt de situatie van de gemengde variant vast
- `registers` kan presets aanbieden voor verschillende niveaus
- `varieties` kan het diglossische paar vermelden

---

## Typen Contactinvloed

| Type | Betekenis | Voorbeeld |
|------|-----------|---------|
| `superstrate` | Dominante taal opgelegd aan een gemeenschap | Frans → Engels (na 1066) |
| `substrate` | Moedertaal die een opgelegde taal beïnvloedt | Keltisch → Engels |
| `adstrate` | Naburige taal met wederzijdse invloed | Noors → Engels |
| `learned_borrowing` | Leenwoorden via onderwijs/wetenschap | Latijn → Engels |
| `lexical_borrowing` | Directe woordenschatontleningen via contact | Spaans → Filipijns |
| `relexification` | Volledige vervanging van woordenschat | Portugees → Papiamentu |

## Diepten van Contactinvloed

| Diepte | Betekenis |
|--------|-----------|
| `light` | Enkele leenwoorden, minimale structurele impact |
| `moderate` | Aanzienlijke woordenschat in specifieke domeinen |
| `heavy` | Doordringende woordenschat en enkele structurele kenmerken |
| `structural` | Grammatica, syntaxis en fonologie beïnvloed |
| `defining` | Kernidentiteit gevormd door contact (creolen, gemengde talen) |

---

## Goede Registerpresets Schrijven

**Goede presetprompts:**
- Benoem het formaliteitskenmerk expliciet (bijv. "해요체", "vous-vorm", "siz-vorm")
- Leg het specifieke voornaamwoord of de werkwoordsvorm uit die gebruikt moet worden
- Geef context voor wanneer dit register van toepassing is
- Vermeld scriptoverwegingen indien van toepassing

**Zet geen** genderinclusieve begeleiding in de presetprompt. Genderbegeleiding
hoort in `card.gender.inclusiveGuidance` — het wordt afzonderlijk ingevoegd.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### Naamgevingsconventie voor Presets

Presetsleutels moeten beschrijvend en in kleine letters met koppeltekens zijn:
- T-V-talen: `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- Spreekstijlen: `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- Neutraal: `professional`, `neutral-professional`
- Code-switching: `taglish-professional`, `pure-filipino`

---

## Hoe kaartfeiten worden bijgewerkt

Kaarten zijn **build-output** — een deterministische projectie vanuit vastgepinde upstream-snapshots. Er is geen verrijkingsprocedure per kaart meer: de handmatig uitgevoerde `enrich-*`-scriptstraat is afgeschaft, en een bewerking die direct in een kaartbestand wordt gemaakt, wordt door de volgende build verwijderd. Om een feit te wijzigen:

1. **Registreer de beslissing.** Elk veld is één rij in het beslissingsregister (decision registry) van de build: welke upstream-parameter het voedt, hoe het projecteert, en wat een afwezige waarde betekent.
2. **Repareer de ingest-laag.** Een verkeerde waarde is een defect in de source-handler (of een verouderde upstream-pin), nooit iets om op de kaart te patchen.
3. **Opnieuw bouwen en overschakelen (Rebuild and cut over).** De build projecteert elke kaart opnieuw vanuit de vastgepinde snapshots; gates weigeren gedeeltelijke builds, null/lege waarden, en kaarten die niet voldoen aan de integriteitsregels.

### Conflictafhandeling

Wanneer bronnen het oneens zijn:
1. **Sla ze allemaal op** met bronvermelding — daar is de attributie-envelop voor bedoeld
2. **Neem GEEN gemiddelde** en kies geen kant — `consensus` verschijnt alleen wanneer de bronnen het daadwerkelijk eens zijn
3. **Neem de voorbehouden van elke bron letterlijk over** in de `note` van die waarde
4. Een enkele waarde voor weergave of berekening wordt **door de adapter afgeleid** van de gedeclareerde autoriteitsvolgorde — de kaart zelf behoudt de volledige spreiding

---

## Validatie

Voer de linter uit na elke rebuild:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR-checklist

Bij het indienen van een wijziging die de kaarten raakt (onthoud: wijzig de build, niet de kaart):

- [ ] De fix bevindt zich in een ingest-handler of het beslissingsregister — geen enkel kaartbestand wordt handmatig bewerkt
- [ ] Velden bevatten alleen door bronnen gestelde waarden — er wordt niets opgevuld met `null` of `[]` om een kaart "compleet" te maken
- [ ] `classification` komt van Glottolog (niet handmatig gebouwd)
- [ ] De herkomst van elk aangeraakt veld belandt in `_fieldSources`, waarbij door Champollion berekende waarden `champollion-derived`-herkomst bevatten
- [ ] Er verschijnt nergens op een kaart een gemeten score van methode-output
- [ ] Linter en kaartintegriteits-gate slagen zonder fouten

---

## Professionele Referenties

| Standaard | Beheerd door | Ons gebruik |
|-----------|-------------|------------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | Canonieke taalcodes, macrotaalrelaties |
| [Glottolog](https://glottolog.org) | Max Planck Institute | Classificatie, coördinaten, AES-bedreigingsstatus |
| [WALS](https://wals.info) | Max Planck Institute | Genusdefinities, typologische kenmerken |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | Schriftcodes |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | Locale-gegevens, meervoudsregels, typografie |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | Sprekerscijfers, endoniemen, schriftgegevens |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, sprekersinschattingen, DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | Bedreigingsclassificatie |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | Taalcapsules voor Filipijnse talen |

Zie ook: [Citatieproces voor Taalkaarten](/docs/reference/language-card-citation-procedure)
voor gedetailleerde bron-voor-bronbegeleiding.
