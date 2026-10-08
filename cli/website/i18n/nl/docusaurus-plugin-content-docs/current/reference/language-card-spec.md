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

> **Enkele bron van waarheid.** Dit document definieert de canonieke vorm van
> elke taalkaart. Een kaart beweert alleen wat een geciteerde bron beweert: een
> veld dat door geen enkele bron wordt beweerd, wordt **weggelaten, niet null** — een ontbrekend veld betekent
> "geen enkele bron heeft zich uitgesproken", nooit "er valt niets te weten". Het machinaal controleerbare
> schema wordt geleverd als `shared/schemas/language-card.schema.json` in het npm-pakket,
> en het [canonieke voorbeeld hieronder](#canonical-template) wordt
> bij elke sitebuild gegenereerd vanuit het live corpus, zodat deze pagina niet kan
> afwijken van de kaarten die zij beschrijft.

## De atlas-herbouw van 2026-08 — wat er veranderde in dit schema

Het kaartencorpus is nu **build-uitvoer**: elke kaart wordt geprojecteerd vanuit een opslag
van vastgezette upstream-snapshots en herbouwd — nooit bewerkt — wanneer een feit
verandert. Vier zaken met betrekking tot de vorm zijn veranderd bij die herbouw:

1. **Betwiste velden bevatten een attributie-envelope.** Waar geciteerde bronnen
   oprecht van mening verschillen, is het veld geen platte waarde maar
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment` en elk veld dat door een nieuwe bron betwist
   wordt. Afnemers dienen kaarten te lezen via de gepubliceerde adapter
   (`normalizeCard()` in het npm-pakket) in plaats van uit te gaan van platte waarden —
   `display()` herleidt een envelope naar zijn overeengekomen waarde en retourneert
   bij een echt geschil bewust niets in plaats van een winnaar te kiezen.

2. **Hernoemde velden.** `endonym` verving `nativeName` · `codeAliases`
   verving `aliases` · `scripts[]` (alle geattesteerde schriften) verving het platte
   `script`, waarbij het primaire schrift wordt afgeleid van de maximale BCP 47-tag
   van de kaart · `endangerment` (de beoordeling van elke bron, op de eigen
   schaal van die bron) verving het enkele `vitality`-object · `isoLanguageType` en
   `isoScope` bevatten nu de eigen bewoordingen van ISO 639-3 ("Living", "Macrolanguage")
   in plaats van initialen. Nieuwe velden: `modality` ("spoken"/"signed", afgeleid
   van de afstamming in Glottolog), `glottologBucket` (Glottologs niet-genealogische
   buckets, weggehouden uit het familieslot), `locale`/`localeScoped`.

3. **Niet-beweerde velden worden weggelaten, niet null.** Een veld dat door geen enkele bron wordt beweerd, is
   afwezig op de kaart. De eerdere regel ("elke kaart MOET elk veld
   op het hoogste niveau bevatten, zelfs als het null is") is afgeschaft: een lege waarde op een publiek
   oppervlak leest als een bewering dat er niets te weten valt, wat niet hetzelfde
   is als niet gekeken hebben.

4. **Er bestaan locale-kaarten.** Naast de taalkaarten bevatten locale-projecties
   (`fra-CA`, `cmn-Hant`) de feiten van hun taal, herleid voor een
   gebied of schrift, aangeduid door een `locale: {language, region, script}`-blok.
   Een locale is geen taal: sluit locales uit van taaltellingen op basis
   van dat blok.

## Ontwerpprincipes

1. **Voorzie alles van een bron.** Elke feitelijke bewering herleidt naar een benoemde, geversioneerde,
   primaire bron. Beweringen zonder bron zijn niet-verifieerbare beweringen. De
   `_fieldSources`-map (en `source`-annotaties per veld in subobjecten)
   maken herkomst expliciet.

2. **Behoud meningsverschillen.** Wanneer autoriteiten van mening verschillen (de ene bron noemt
   50.000 sprekers, een andere 20.000), slaat de kaart *beide* op met bronattributie —
   de envelop-vorm hierboven. We middelen niet, beslechten het niet en kiezen
   geen partij. Gebruikers kunnen navigeren door de nuance.

3. **Afwezig betekent niet-beweerd.** Een ontbrekend veld betekent dat geen enkele bron een
   waarde beweert. Wanneer een eigenschap daadwerkelijk niet van toepassing is (bijv. grammaticaal geslacht
   voor een taal die dat niet heeft), vermeldt de geciteerde waarde dit expliciet in plaats van
   leeg te zijn.

4. **Herbouwd, nooit gepatched.** Kaarten worden geprojecteerd vanuit vastgezette bronnen via een
   deterministische build. Een feitelijke fout wordt hersteld in de desbetreffende bron-handler waarna het
   corpus wordt herbouwd — geen in-place bewerkingen, geen verrijkingslaag die uitsluitend samenvoegt.

---

## Drielaagse Architectuur

| Laag | Locatie | Doel |
|------|---------|------|
| **Taalkaarten** | `shared/language-cards/<code>.json` | Per-taalconfiguratie: identiteit, classificatie, bronnen, alles |
| **Genuskaarten** | `shared/language-cards/genera/<genus>.json` | Gedeelde runtime-eigenschappen voor verwante talen (samengesteld, niet automatisch gegenereerd) |
| **Taalboom** | `shared/language-cards/language-tree.json` | Volledige Glottolog-hiërarchie — referentiegegevens voor de Lab-UI en taalontdekking |

---

## Overeringsmodel

> **Grotendeels historisch sinds de atlas-herbouw.** Geen enkele taalkaart op schijf
> bevat nog `extends` — elke kaart wordt volledig gematerialiseerd door de build,
> omdat overgeërfde tekst niet citeerbaar was (een bewering op familieniveau droeg een
> adres op taalniveau). Het mechanisme zelf blijft op één plek bewaard: de
> offline bundel van het npm-pakket levert locale-kaarten als compacte `extends`-delta's
> ten opzichte van hun taal, herleid via dezelfde merge die hier wordt beschreven.

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

> **Gegenereerd, niet geschreven.** Alles in deze sectie wordt tijdens het bouwen afgeleid
> van het live corpus: de volledige kaart voor `crk` (Plains Cree), byte voor byte,
> plus een `fra-CA`-locale-fragment. Wanneer het corpus wordt herbouwd, leidt de volgende
> sitebuild deze pagina opnieuw af. Er is geen handmatig onderhouden sjabloon meer over die
> kan verouderen — de vorige liep een hele schemageneratie achter op de kaarten
> en werd op 2026-08-16 afgeschaft.

Het voorbeeld toont de **vorm op schijf** — wat u te zien krijgt als u het bestand opent.
Afnemers dienen kaarten nog steeds te lezen via de gepubliceerde adapter
(`normalizeCard()` in het npm-pakket): deze lost envelopes op, overbrugt de
namen van vóór de overstap en leidt de weergave-enkele waarden af (primair schrift,
vitaliteitsniveau) die de ruwe kaart bewust niet bevat.

Waar u op moet letten tijdens het lezen:

1. **Attributie-envelopes.** `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` en
   `politenessDistinction` bevatten elk `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   heeft `"agreement": "incommensurable"`: de bronnen ervan beoordelen op verschillende
   schalen, dus elke waarde vermeldt zijn `scale` in plaats van te worden omgezet naar die
   van een winnaar.

2. **Weggelaten betekent niet-beweerd.** De kaart heeft geen `iso639_1` (Plains Cree heeft
   geen ISO 639-1-code) en geen `phonologicalInventory` (geen enkele opgenomen bron
   beweert er een) — die velden zijn simpelweg afwezig, nooit `null` of `[]`.

3. **Herkomst is een eersteklas laag.** `_fieldSources` koppelt elk veld aan
   de bron(nen) die het hebben beweerd, waarbij `champollion-derived-v1` waarden
   markeert die door Champollion zijn berekend. `_card` stempelt het type, het id en de revisie van de kaart,
   evenals welke velden de correctiestraat mag aanpassen; `_atlas` stempelt de corpusrelease.

4. **Geen run-resultaten.** Niets op de kaart is een gemeten score van methode-uitvoer —
   chrF, FST-acceptatiepercentages en dergelijke zijn run-resultaten gekoppeld aan
   (method, dataset, metric) en bevinden zich op het scorebord. De kaart beweert alleen
   dat bronnen *bestaan* (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### Een locale-kaart is een projectie, geen taal \{#locale-card-example}

Naast de taalkaarten bevinden zich locale-kaarten (`fra-CA`, `cmn-Hant`): de feiten van een taal
**herleid voor een gebied of schrift**, aangeduid door hun
`locale`-blok — nooit door de vorm van de code. Een locale-kaart erft de feiten van zijn taal,
lost degene op die betrekking hebben op schrift en gebied (`script`,
`localeScoped`), en is **geen taal**: sluit locale-kaarten uit van elke
taaltelling en overzicht per taal op basis van dat `locale`-blok.

<CardSpecExample variant="locale" />

---

## Veldreferentie \{#field-reference}

Voor elke onderstaande tabel gelden twee conventies:

- **"envelope"** betekent een attributie-envelope — `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}` — die de bewering van *elke* bron
  bevat. Een veld dat wordt aangeduid als `envelope` kan als een platte waarde voorkomen op kaarten
  waar slechts één bron zich uitspreekt (Glottolog-only languoïden bevatten bijvoorbeeld een
  platte `name`); afnemers moeten met beide kunnen omgaan, en dat is wat de gepubliceerde
  adapter doet.
- Geen enkel veld is vereist buiten `code` en `name`; al het overige wordt
  **weggelaten wanneer geen enkele bron het beweert**. De bewerende bron(nen) van elk veld
  worden per kaart vastgelegd in `_fieldSources`, waardoor de tabellen het
  *type* bron beschrijven in plaats van versies vast te pinnen die zouden kunnen afwijken.

### § 1. Identiteitsvelden

| Veld | Vorm | Notities |
|-------|-------|-------|
| `code` | `string` | **Vereist.** De kaart-ID en bestandsnaam. ISO 639-3 voor taalkaarten (`crk`); languoïden die alleen in Glottolog voorkomen bevatten hun glottocode; locale-kaarten bevatten een locale-code (`fra-CA`). |
| `name` | envelope | **Vereist.** Engelse referentienaam (ISO 639-3-register, LinguaMeta, Glottolog). |
| `endonym` | envelope | Verving `nativeName`. Hoe sprekers de taal noemen, in de taal zelf (LinguaMeta, Wikidata). Afwezig wanneer geen enkele bron er een beweert — een endoniem wordt door ons nooit verzonnen of getranslitereerd. |
| `alternateNames` | `string[]` | Andere geattesteerde Engelse namen. |
| `iso639_1` | `string` | Alleen aanwezig wanneer er een tweeletterige ISO 639-1-code bestaat (`fra` → `"fr"`). |
| `isoScope` | `string` | De eigen bewoordingen van ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (verving de initialen `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Verving `isoType`. De eigen bewoordingen van ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | De macrogroep/macrotaal waartoe deze taal behoort (`crk` → `"cre"`). ISO 639-3-macrotaalkoppelingen. |
| `macrolanguageMembers` | `string[]` | Op macrotaal-hubkaarten: de individuele lidcodes (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Op macrotaalkaarten: leden waarvan de tags door de BCP 47-registers worden samengevoegd onder de tag van deze macrotaal (CLDR-aliastabel + SIL-langtags, elk geattribueerd). |
| `supersededCodes` | `string[]` | Vervallen ISO 639-3-codes die SIL nu doorverwijst naar deze taal — vastgelegd op de opvolger zodat corpora die onder een oude code zijn gepubliceerd nog steeds worden herleid. |
| `codeAliases` | `string[]` | Verving `aliases`. Identifiers op codeniveau die naar deze kaart herleiden. |
| `bcp47` | `string` | De BCP 47-tag van de taal zoals beweerd (LinguaMeta). |
| `bcp47Tag` | envelope | Afgeleid door Champollion: de RFC 5646-tag (de kortste ISO 639-code wint). |
| `bcp47FullTag` | envelope | De maximale taal–schrift–regiovorm (CLDR likelySubtags + SIL-langtags). De adapter leidt het **primaire schrift** af van deze tag. |
| `modality` | `string` | `"spoken"` of `"signed"`, afgeleid van Glottologs afstamming. Schrift is een orthografie-eigenschap, geen modaliteit — een ongeschreven taal is nog steeds volledig gesproken of gebaard. |
| `locale` | `object` | **Alleen locale-kaarten.** `{language, region, script, publishedTag, source, note}` — DÉ locale-identiteit. Sluit locale-kaarten uit van taaltellingen op basis van dit blok, nooit op basis van de vorm van de code. |
| `localeScoped` | `object` | Alleen locale-kaarten: waarden die zijn herleid voor het gebied/schrift van de locale (bijv. `scriptName`, `cldrOfficialStatus`). |

### § 2. Classificatievelden

| Veld | Vorm | Notities |
|-------|-------|-------|
| `glottocode` | `string` | De identifier van Glottolog voor deze languoïde (`crk` → `"plai1258"`). Languoïden die alleen in Glottolog voorkomen — talen die Glottolog registreert maar ISO 639-3 niet — gebruiken de glottocode als hun kaart-`code`. |
| `classification` | `object` | Container voor de onderstaande plaatsingsvelden. Elk veld is onafhankelijk van een bron voorzien en wordt onafhankelijk weggelaten — een isolaat, of een taal die in een Glottolog-bucket is ondergebracht, bevat terecht slechts een deel van dit object. |
| `classification.family` | envelope | De familie op het hoogste niveau die elke classificatieautoriteit beweert. Glottolog en WALS zijn afzonderlijke taxonomieën die het niet altijd eens zijn, dus beide worden bewaard en voorzien van bronvermelding. Lint-regel R5 controleert de Glottolog-waarde binnen de envelope tegen de eigen boom van Glottolog: WALS mag afwijken van Glottolog, maar Glottolog mag niet verkeerd geciteerd worden. Isolaten bevatten helemaal geen familie. |
| `classification.familyGlottocode` | `string` | Glottocode van die familie op het hoogste niveau (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | WALS' intermediaire classificatieknooppunt (`crk` → `"Algonquian"`). Een concept van WALS, **niet** van Glottolog — Glottolog publiceert een boom met willekeurige diepte zonder genusniveau — dus alleen aanwezig waar WALS de taal codeert. |
| `classification.ancestry` | `string[]` | Het afstammingspad van Glottolog als voorouder-glottocodes, te beginnen bij de wortel (`["algi1248", …, "plai1264"]`). De volgorde **is** de bewering: dit is een pad, nooit een alfabetisch geordende set. |
| `classification.glottologBucket` | `string` | Niet-genealogische buckets van Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Weggehouden uit het familieslot omdat een bucket classificeert op soort, niet op afstamming: een kaart met een bucket heeft geen familie, en dat is het eerlijke resultaat. |
| `isIsolate` | `boolean` | Of Glottolog deze taal classificeert als een isolaat. |

De kaart van vóór de overstap bevatte ook een `genusGlottocode`. Deze is afgeschaft samen
met de categoriefout die ertoe leidde: het genus is een concept van WALS, en
het bekleden met een Glottolog-identifier beweerde een boomknooppunt dat Glottolog niet
heeft. De Glottolog-hiërarchie wordt in plaats daarvan weergegeven door `ancestry`.

### § 3. Geografische Velden

| Veld | Vorm | Notities |
|-------|-------|-------|
| `macroarea` | `string` | Macrogebied van Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` of `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — het representatieve punt van Glottolog. Een punt, geen territorium: het plaatst de taal op een kaart en beweert niets over verspreidingsgebied of grenzen. |
| `countries` | `string[]` | ISO 3166-1 alpha-2-codes van de landen die Glottolog aan de taal koppelt (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Een officiële status die een bepaald gebied aan de taal toekent, zoals geregistreerd door CLDR (doorgegeven via LinguaMeta) — `"Official"`, `"Regional official"`. Op een locale-kaart staat de status die herleid is voor het gebied van *die locale* in `localeScoped.cldrOfficialStatus`. |

De array `regions` van vóór de overstap (uitsplitsingen van sprekersaantallen per land met admin-codes)
en `arealContext` (Sprachbund-lidmaatschap) zijn afgeschaft: geen enkele opgenomen
bron beweert ze, en handmatige curatie zonder bron overleeft een herbouw niet.
Beweringen over sprekersaantallen op regioniveau kunnen terugkeren zodra er een citeerbare bron in de
pipeline landt; tot die tijd is afwezigheid de eerlijke toestand.

### § 4. Schrijfsysteemvelden

| Veld | Vorm | Notities |
|-------|-------|-------|
| `scripts` | `string[]` | Verving het platte `script`. **Alle** geattesteerde ISO 15924-codes (`crk` → `["Cans", "Latn"]`), ongeordend — lees `scripts[0]` nooit als "het" schrift. Het primaire schrift wordt door de adapter afgeleid van de maximale tag van `bcp47FullTag`. |
| `scriptNames` | `string[]` | Door Champollion afgeleide weergavenamen voor `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Verving `dir`. De eigen bewoordingen van de bron — `"left-to-right"` / `"right-to-left"` (was `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: het schrift dat zo canoniek is voor de taal dat BCP 47-tags het weglaten (`fra` → `"Latn"`). |
| `script` | `string` | **Alleen locale-kaarten**: het op basis van de locale herleide schrift (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Taalkaarten bevatten geen plat schriftveld. |

Een taal zonder geattesteerd schrift heeft simpelweg **geen `scripts`-veld** —
afwezigheid betekent dat geen enkele bron een schrift heeft beweerd, niet de bewering dat de taal
"ongeschreven" is. (Gebarentalen vormen de grootste groep hiervan: geen enkel notatiesysteem
kent gemeenschapsbrede acceptatie voor alledaagse geletterdheid.)

### § 5. Demografische Velden en Vitaliteitsvelden

| Veld | Vorm | Notities |
|-------|-------|-------|
| `speakerEstimates` | envelope | De schatting van elke bron, met bronvermelding. Waarden kunnen exacte aantallen zijn of de eigen bereikreeksen van de bron (`"10000-99999"`), waarbij de kanttekeningen van de bron letterlijk worden overgenomen in `note`. `"agreement": "conflicting"` komt vaak voor — het tonen van het conflict *is* het product; er wordt niets gemiddeld of gekozen. |
| `endangerment` | envelope | Verving het enkele `vitality`-object. De beoordeling van elke bron **op de eigen schaal van die bron** — elke waarde bevat een `scale`-veld, en `"agreement": "incommensurable"` is de norm omdat de vocabulaires van ELCat, Glottolog AES en LinguaMeta geen vertalingen van elkaar zijn. De adapter leidt één *vitaliteitsniveau* voor weergave af van één benoemde bron volgens de vastgelegde gezagsvolgorde; dat niveau dient uitsluitend voor weergave — de volledige geattribueerde set blijft op de kaart staan. |

Een *weergegeven* aantal sprekers waar dan ook in Champollion moet overeenkomen met een van de
geciteerde `speakerEstimates`-vermeldingen of expliciete `champollion-derived`-herkomst
bevatten — afgedwongen door de kaartintegriteitsregels.

### § 5.5 Documentatie- en Digitale Aanwezigheidsvelden

| Veld | Vorm | Notities |
|-------|-------|-------|
| `documentation` | `object` | Verving `documentationDepth`. De registratie van Glottolog over hoe goed de taal beschreven is, in Glottologs eigen termen. |
| `documentation.medLevel` | `string` | Glottologs Most Extensive Description-niveau, letterlijk — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | De bibliografische sleutel van die meest uitgebreide beschrijving in Glottologs referentiecatalogus. |
| `documentation.firstDocumented` | `number` | Glottologs eigen kolom voor het eerste jaar van documentatie, letterlijk — verplaatst hiernaartoe vanaf het veld op het hoogste niveau van vóór de overstap. Slechts aanwezig bij een paar honderd talen, en de zeldzaamheid is op zichzelf wetenswaardig. |
| `documentation.lastDocumented` | `number` | Glottologs kolom voor het laatste jaar van documentatie, letterlijk — aanwezig bij ongeveer duizend talen. |
| `wikipediaEdition` | `object` | Verving `digitalPresence`. `{site, url, name}` — er bestaat een open Wikipedia-editie in deze taal (`afr` → `af.wikipedia.org`). Alleen het bestaan, bewust **zonder artikelaantallen**: verschillende edities zijn grotendeels door bots gegenereerd, en een enorme editie is in geen enkele voor een vertaler bruikbare zin "beter gedocumenteerd" dan een kleine. |
| `dialectCount` | `number` | Glottologs eigen `child_dialect_count`-kolom, letterlijk — uitsluitend directe onderliggende dialecten, niet de hele deelboom. Dit is een bewering van Glottolog, niet onze berekening: een eerdere regel stempelde dit als `champollion-derived` en liet duizenden kaarten de eer opstrijken voor Glottologs telling. |

De rest van het `digitalPresence`-blok van vóór de overstap (uren in Common Voice,
aantallen zinnen in Tatoeba) is afgeschaft totdat die bronnen in de pipeline landen —
het Tatoeba-corpus zelf verschijnt al waar het hoort, als een parallel
corpus onder `resources.corpora` (§ 9).

### § 6. Formaliteits-, Register- en Gendervelden

Het geprojecteerde corpus bevat hier precies één veld — het geciteerde feit:

| Veld | Vorm | Notities |
|-------|-------|-------|
| `politenessDistinction` | envelope | Of de taal beleefdheid grammaticaliseert in vormen van de tweede persoon. Geattribueerd over Grambank GB415 (binair: absent/present) en WALS 45A (vier niveaus: no distinction / binary / multiple / pronouns avoided). Dat zijn verschillende schalen, dus elke waarde vermeldt zijn `scale` en de envelope rapporteert ze als **onvergelijkbaar** in plaats van als een meningsverschil. |

**Het registersysteem is configuratie, geen kaartfeit.** Het corpus van vóór de overstap
sloeg `formality`-tekst en `registers`-prompts op op elk bijna achttienhonderd
kaarten — vrijwel alles gegenereerd uit dezelfde twee bovenstaande bronnen, en
vervolgens meegedragen alsof het handmatig gecureerde configuratie was. De atlas
behoudt het feit; de configuratievlakken — `formality`, `registers`,
`gender`, `codeSwitching` — blijven onderdeel van het **gecureerde schema
van het npm-pakket** (`language-card.schema.json`), staan op de gecureerde genus-/familie-hubkaarten,
en bereiken de CLI via de `extends`-samenvoeging van het registersysteem,
zoals beschreven in het [Overervingsmodel](#inheritance-model). Het zijn geen
geprojecteerde atlasvelden: geen enkele kaart in het geprojecteerde corpus bevat ze, en de
atlasbuild zal ze nooit wegschrijven. De richtlijnen in
[Goede register-presets schrijven](#writing-good-register-presets) zijn van toepassing op
die gecureerde straat.

### § 7. Taalkundig Profielvelden

| Veld | Vorm | Notities |
|-------|-------|-------|
| `typologicalProfile` | `object` | Eén sleutel per opgenomen typologische eigenschap, waarbij elke waarde de eigen codering van de bron is en elke sleutel alleen aanwezig is waar de bron deze taal codeert. Booleans zijn afkomstig van Grambank-eigenschappen, categorietekstreeksen van WALS-hoofdstukken; het beslissingsregister vermeldt de exacte upstream-parameter voor elke sleutel. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — aantallen berekend door Champollion over een geciteerde PHOIBLE-inventaris (PHOIBLE publiceert één rij per segment en beweert geen aantallen), dus elke waarde bevat `champollion-derived`-herkomst. **PHOIBLE is de enige toonautoriteit** (lint R1): Grambank heeft geen tooneigenschap, en niets anders op de kaart mag tonaliteit beweren. |
| `numeralSystem` | `object` | `{base}` — het talstelselbasisgetal, letterlijk overgenomen uit Chans *Numeral Systems of the World's Languages* (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; bijna honderd verschillende waarden). Afwezig wanneer Chans eigen basiskolom leeg is — ongeveer de helft van de onderzochte talen — omdat een vorige generator de lege plek opvulde met `"decimal"` en zo waarden verzon voor tweeduizend talen. |
| `pluralCategories` | `string[]` | De hoofdtelwoord-meervoudscategorieën die CLDR voor deze taal aangeeft — het Arabisch onderscheidt `["zero", "one", "two", "few", "many", "other"]`, het Frans drie daarvan, het Chinees één. Uitgelezen uit de sleutels van CLDR's eigen regelset, dus het is een bewering van CLDR, niet onze afleiding. Verving het `rules.plurals.categories` van vóór de overstap; een i18n-pipeline heeft dit nodig om te weten hoeveel meervoudsvormen een bericht moet leveren. |

De `typologicalProfile`-sleutels die momenteel worden geprojecteerd, met hun upstream-parameters:

- **WALS-hoofdstukken** (categorietekstreeksen, de eigen waardelabels van WALS): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Grambank-kenmerken** (booleans): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB072), `marksPastTense` (GB083),
  `marksPresentTense` (GB082)

De blokken `linguisticChallenges` en `contactInfluences` van vóór de overstap worden niet
geprojecteerd — onderzochte tekst zonder opgenomen bron blijft in het gecureerde
schema van het npm-pakket, net als de registervlakken in § 6 (de onderstaande
tabellen voor [Soorten contactinvloed](#contact-influence-types) bedienen die
straat). Het `rules`-blok is afgeschaft: wat daarin citeerbaar was, overleeft hier als
`pluralCategories` en in de schriftvelden in § 4.

### § 8. Encyclopedische Velden

Afgeschaft van kaarten. De blokken `encyclopedic` (essays over geschiedenis en dialecten,
institutionele links), `culturalAphorism` en `varieties` van vóór de overstap waren
handmatig gecureerde teksten op kaartniveau, die door de herbouw opzettelijk zijn verwijderd. De
feiten over lidmaatschap waarnaar `varieties` verwees, zijn nu geciteerde identiteitsvelden
(§ 1 `macrolanguageMembers` en `canonicalisedMembers`), en de gereedschapsdekking per variëteit
wordt beantwoord door de eigen kaart van elk lid (`methodSupport`,
`resources`). Een representatieve uitdrukking kan terugkeren via een community-bijdragetraject
met toestemming en bronvermelding; deze zal niet terugkeren als een
ongeciteerd kaartveld.

### § 9. Digitale Bronvelden

Alles in deze sectie beweert **bestaan en capaciteit, nooit
kwaliteit**: dat een bron gepubliceerd is en wie deze publiceert — nooit dat deze
goed, compleet of bruikbaar is, en nooit een gemeten score. Elke gemeten score
van methode-uitvoer is een run-resultaat gekoppeld aan (method, dataset, metric), staat op
het scorebord en is verboden op kaarten (lint R3).

| Veld | Vorm | Notities |
|-------|-------|-------|
| `resources` | `object` | Container: elk onderstaand subveld is een onafhankelijk van een bron voorziene lijst, die wordt weggelaten wanneer geen enkele bron deze beweert. |
| `resources.fsts` | `object[]` | Gepubliceerde morfologische analysers op basis van eindige toestanden (FST): `{name, url, publisher, license, licenceEstablished, archived}`. De licentie reist mee met elke vermelding in plaats van uniform te worden verondersteld over een catalogus — licentiegrenzen vereisen de daadwerkelijke voorwaarden. Voor een polysynthetische taal is een FST vaak de enige structurele controle die überhaupt bestaat. |
| `resources.corpora` | `object[]` | Parallelle corpora die deze taal attesteren: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Aangegeven via **paren**, omdat een parallel corpus een taal alleen via een paar attesteert — "dekt Swahili" zonder te vermelden ten opzichte van wat, beantwoordt een vraag die niemand heeft gesteld. Bestaan en omvang, nooit kwaliteit. |
| `resources.monolingualCorpora` | `object[]` | Monolinguale corpora — gescheiden gehouden van `corpora` zodat "heeft een corpus" nooit twee onvergelijkbare dingen betekent. |
| `resources.speech` | `object[]` | Gepubliceerde spraakbronnen. Alleen bestaan. |
| `resources.keyboards` | `object[]` | Gepubliceerde toetsenbordindelingen. Eenvoudig maar cruciaal: voor een orthografie die tekens vereist die geen enkele standaardindeling produceert, is een indeling het verschil tussen het wel of niet kunnen typen van de taal. |
| `resources.typology` | `object[]` | Typologische datasets die deze taal *coderen*, met omvang: `{dataset, featuresCoded, datasetFeatureTotal}`. Bestaan en omvang, nooit inhoud — wat een kenmerk inhoudt blijft van de kaart af totdat een persoon de parametertoewijzing schrijft die het accepteert (de geaccepteerde kenmerken verschijnen in `typologicalProfile` van § 7). De tellingen van kenmerken zijn onze berekening, dus ze bevatten `champollion-derived`-herkomst. |
| `lexicalResources` | `object` | Container voor feiten over lexicaal bestaan. |
| `lexicalResources.datasets` | `object[]` | Gepubliceerde woordenlijsten met hun dekking: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Gepubliceerde woordenboeken — bestaan, nooit kwaliteit, en **gericht** waar de uitgever ze richt: een woordenboek dat één richting opwerkt is een andere bron dan een woordenboek dat de andere kant opgaat. Vermeldingen zijn niet uniform van vorm (een CLDF-dataset kent zijn aantal invoeren; een repository kent zijn paar en richting); elk vermeldt zijn eigen bron, en licentie en gearchiveerde status reizen per vermelding mee. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Door Champollion berekende aantallen over CLICS³: concepten geattesteerd voor deze taal, en vormen die verwijzen naar twee of meer verschillende concepten. `champollion-derived`. |
| `methodSupport` | `object` | Welke vertaalmethoden deze taal dekken — capaciteit, nooit een score. Vorm: `{total, byTier, named, truncated}`. Het Engels bevat duizenden methode-edges en de mediaantaal een paar dozijn, dus de kaart bevat de *vorm* van het bewijs — `total` plus `byTier` aantallen per betrouwbaarheidsniveau (`fetched`, `partially-confirmed`, `model-card-declared`) — en vermeldt alleen de sterkste vermeldingen (elk `{value, variant, source, confidence}`), met een limiet. Register-**services** worden altijd volledig vermeld, boven de limiet, zodat de afwezigheid van een service in `named` een echt antwoord is; de afwezigheid van een modelkaart-vermelding betekent alleen "behoort niet tot de sterkste", en elke edge blijft opvraagbaar in de atlas-opslag. |
| `metricModelSupport` | envelope | Evaluatiemetriekmodellen die dekking van deze taal publiceren, met de model-identifier die een harness laadt (`masakhane/africomet-mtl`). Stuurt echt gedrag aan — COMET-modelselectie — en blijft capaciteit, nooit een score. |

**Samengevoegd in de bovenstaande velden:** de vóór de overstap bestaande `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`) en `databaseCoverage` (→
`resources.typology` plus `lexicalResources` — een databasevermelding is nu een
geciteerd dekkingsfeit met omvang, geen boolean).

**Afgeschaft van kaarten:** `omt1600`, `evalDatasets`, `pipelineReadiness` en
`metricPlugins` — geen hiervan wordt beweerd door een opgenomen bron, en een gereedheidsniveau
is een oordeel, geen citaat.

**Gecureerd, niet geprojecteerd:** de declaratievlakken voor evaluatiestandaarden
(`evalStandard`, `evalMetrics`, `evalPack`) blijven in het gecureerde schema
van het npm-pakket. Ze vertellen het evaluatie-harness welk extern scheidsrechterspakket
een taal scoort (scheidsrechters, geen deelnemers — de kern van het harness levert geen
taalspecifieke beoordelingscode); het harness leest ze van een kaart af wanneer ze aanwezig zijn,
maar geen enkele kaart in het geprojecteerde corpus bevat ze momenteel, en de
atlasbuild schrijft ze niet. Hetzelfde geldt voor het `install`-blok dat het
FST-installatieprogramma van het harness leest uit `resources.fsts[]`-vermeldingen
(`get_fst_install_info()` in `language_cards.py`): de geprojecteerde vermeldingen
bevatten uitsluitend feiten over het bestaan.

### § 10. Herkomstvelden

| Veld | Vorm | Notities |
|-------|-------|-------|
| `_fieldSources` | `object` | Op elke kaart. Koppelt elk veldpad op de kaart (`"classification.family"`, `"coordinates.lat"`) aan de gesorteerde bron-id's die het hebben beweerd (`["glottolog-v5.3", "wals-v2020.5"]`). Waarden die door Champollion zijn berekend, bevatten `champollion-derived-v1`. Bron-id's zijn geversioneerd — `grambank-v1.0.3`, `iso639-3-20260715` — zodat elke bewering herleidt naar de exacte release die deze heeft gedaan. |
| `coverage` | `object` | Op elke kaart, en **berekend door de projector, niet beweerd door enige bron**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — hoeveel verschillende bronnen zich uitspreken over deze taal, hoeveel kaartcomponenten een waarde bevatten van het totaal dat ingevuld kan worden, en hoeveel waarden een bron expliciet als *afwezig* heeft geregistreerd (gekeken en nee gezegd — een ander feit dan nooit gekeken hebben). Dit stelt een beknopte kaart in staat om uit te leggen **waarom** deze beknopt is in plaats van verwaarloosd te lijken. |
| `_card` | `object` | De eigen metadata van de kaart: `{type, id, revision, correctableFields}`. `type` is `"language"` of `"locale"` (methode- en corpuskaarten gebruiken dezelfde projector); `revision` is een inhoudshash, dus elke wijziging in de inhoud van de kaart verandert deze; `correctableFields` geeft een overzicht van de veldpaden die waarden bevatten — de velden die het correctietraject mag aanpassen. |
| `_atlas` | `object` | `{version}` — de release-stempel van het corpus (`"unreleased"` tussen releases). Bewust een release-id, **geen** tijdstempel van de build: een tijdstempel zou ervoor zorgen dat twee builds van identieke pins verschillen op basis van de kalender, wat de eigenschap tenietdoet waarmee iedereen de atlas kan verifiëren — dezelfde pins erin, dezelfde bytes eruit. |

Het herkomstblok van vóór de overstap is in zijn geheel afgeschaft: `dataSources`
(vervangen door de veldspecifieke `_fieldSources`-map), `supportTier` (een berekend
oordeel, vervangen door de neutrale tellingen van `coverage`), `_generated` (het
gehele corpus wordt gegenereerd; de stempel is `_card.revision` plus
`_atlas.version`), `humanReviewed` en `notes` (curatie die thuishoort in
straten met hun eigen registraties), en de op het hoogste niveau staande
`firstDocumented`/`lastDocumented` (verplaatst naar `documentation` in § 5.5,
waar hun bron ze daadwerkelijk beweert).

---

## Taalcodebeleid

Champollion gebruikt **ISO 639-3** als canonieke identificator. Andere standaardcodes
worden geregistreerd als aliassen en worden tijdens runtime omgezet naar de ISO 639-3-code.

| Prioriteit | Standaard | Voorbeeld | Veld | Gebruik |
|------------|-----------|-----------|------|---------|
| 1 (canoniek) | ISO 639-3 | `crk` | `code` | Bestandsnaam van kaart, configuratiesleutels, API-parameters |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Geaccepteerd in CLI, herleid naar ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Geaccepteerd in CLI, herleid naar ISO 639-3 |
| Referentie | Glottocode | `plai1258` | `glottocode` | Alleen classificatie, niet voor runtime |

**Herleidingsvolgorde:** Wanneer een gebruiker een code opgeeft:
1. Directe overeenkomst op `card.code` → gevonden
2. Overeenkomst op `card.codeAliases[]` → gevonden, retourneer de canonieke kaart
3. Overeenkomst op `card.iso639_1` → gevonden (fallback)
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
- `resolveCode("fr")` retourneert tijdens runtime `"fra"` — achterwaarts compatibel
- Gebruikers kunnen nog steeds `"fr"` schrijven in hun configuratie — het wordt transparant herleid

**Wat er architecturaal is veranderd:**
- `_deepMerge()` slaat nu `null`-waarden over (erft van ouder)
- `_deepMerge()` heeft nu een identiteitsveldset (code, extends, aliassen worden nooit overgeërfd)
- `formality.default` wordt nu afgeleid van register-`isDefault: true`-vlaggen
- 205 op Grambank gebaseerde kaarten kregen een structurele `formality.default`-correctie
- 38 genus-/familie-/macrotaalkaarten bieden overervingsdoelen

---

## Randgevallen

### Gebarentalen
Gebarentalen (bijv. ASE — American Sign Language) zijn volwaardige talen
met ISO 639-3-codes. Ze hebben geografie en aantallen sprekers, maar:
- `modality` is `"signed"` — de positieve bewering van de kaart over wat de
  taal *is*; de afwezigheid van een schriftsysteem is een afzonderlijk feit
- `scripts` is doorgaans afwezig (geen enkel notatiesysteem kent
  gemeenschapsbrede acceptatie), hoewel `"Sgnw"` (SignWriting) verschijnt waar een bron dit beweert
- `textDirection` is afwezig
- `linguisticChallenges` dient ruimtelijke grammatica, classificatoren, enz. te behandelen

### Oude en historische talen
Talen zoals Latijn (`lat`, isoLanguageType `"Historical"`) en Sanskriet
(`san`) worden nog steeds gebruikt in specifieke contexten (liturgisch, academisch) maar hebben
geen moedertaalsprekers:
- `isoLanguageType` bevat het eigen statuswoord van ISO (`"Ancient"`,
  `"Historical"`, `"Extinct"`) — de kaart zwakt dit nooit af en overschrijft het nooit
- `endangerment` en `speakerEstimates` rapporteren wat de geciteerde bronnen
  daadwerkelijk beoordelen, met kanttekeningen letterlijk overgenomen (aantallen in L2-gemeenschappen blijven gelabeld
  zoals hun bronnen ze labelen)
- `firstDocumented` / `lastDocumented` plaatsen ze in de tijd

### Kunsttalen
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, enz.:
- `classification` kan afwezig zijn — Glottolog plaatst kunsttalen in een
  niet-genealogische bucket, en de bucket wordt nooit weergegeven als een familie
- `contactInfluences` weerspiegelt het bronmateriaal (Esperanto ontleent bijv. aan Romaans, Germaans, Slavisch)
- `endangerment` is ongebruikelijk — een groeiende sprekersgemeenschap maar geen natuurlijk thuisland

### Macrotalen
Arabisch (`ara`), Chinees (`zho`), Cree (`cre`), Quechua (`que`) zijn macrotalen
die meerdere individuele talen omvatten:
- `isoScope: "Macrolanguage"` — een navigatie-hub, nooit een benchmarkdoel
- `macrolanguageMembers` vermeldt de individuele lidcodes;
  `canonicalisedMembers` legt vast welke leden de BCP 47-registers samenvoegen
  onder de tag van de macrotaal (elk register geattribueerd)
- `methodSupport` weerspiegelt wat de *macrotaalkaart* ondersteunt (meestal de gestandaardiseerde variëteit)
- Individuele leden hebben hun eigen kaarten, die via `macrolanguage` terugverwijzen naar de hub

### Talen zonder gestandaardiseerde orthografie
Veel talen (vooral talen met een mondelinge traditie) hebben geen gestandaardiseerd
schriftsysteem, of kennen concurrerende orthografieën:
- `scripts`, `scriptNames` en `textDirection` zijn afwezig — geen enkele bron
  heeft een schrift beweerd, wat niet dezelfde bewering is als "ongeschreven"
- `notes` dient de orthografische situatie toe te lichten
- `linguisticChallenges` dient te vermelden welke invloed dit heeft op automatische vertaling (MT) (bijv. geen trainingsdata)

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

Kaarten zijn **build-uitvoer** — een deterministische projectie vanuit vastgezette upstream-snapshots.
Er is geen verrijkingsprocedure per kaart meer: het handmatig uitgevoerde
`enrich-*`-scripttraject is afgeschaft, en een bewerking die direct in een kaartbestand
wordt aangebracht, wordt bij de volgende build verwijderd. Om een feit te wijzigen:

1. **Registreer de beslissing.** Elk veld is één rij in het beslissingsregister
   van de build: welke upstream-parameter het voedt, hoe het projecteert en wat een
   afwezige waarde betekent.
2. **Herstel de opnamelaag.** Een onjuiste waarde is een fout in de bron-handler
   (of een verouderde upstream-pin), nooit iets om op de kaart zelf te patchen.
3. **Herbouw en stap over.** De build herprojecteert elke kaart vanuit de vastgezette
   snapshots; kwaliteitscontroles (gates) weigeren gedeeltelijke builds, null-/lege waarden en kaarten die
   niet voldoen aan de integriteitsregels.

### Conflictafhandeling

Wanneer bronnen van mening verschillen:
1. **Sla ze allemaal op** met bronattributie — dat is waar de
   attributie-envelope voor bedoeld is
2. **Middel NIET** en kies geen partij — `consensus` verschijnt alleen wanneer de
   bronnen het daadwerkelijk eens zijn
3. **Neem de kanttekeningen van elke bron letterlijk over** in de `note` van die waarde
4. Eén enkele waarde voor weergave of berekening wordt **door de adapter afgeleid**
   op basis van de vastgelegde gezagsvolgorde — de kaart zelf behoudt de volledige spreiding

---

## Validatie

Voer de linter uit na elke herbouw:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR-checklist

Bij het indienen van een wijziging die betrekking heeft op de kaarten (onthoud: pas de build aan,
niet de kaart):

- [ ] De oplossing bevindt zich in een opname-handler of het beslissingsregister — geen enkel
      kaartbestand is handmatig bewerkt
- [ ] Velden bevatten uitsluitend door bronnen beweerde waarden — niets opgevuld met `null` of
      `[]` om een kaart te "voltooien"
- [ ] `classification` is afkomstig van Glottolog (niet handmatig opgebouwd)
- [ ] De herkomst van elk aangeraakt veld komt terecht in `_fieldSources`, waarbij door
      Champollion berekende waarden `champollion-derived`-herkomst dragen
- [ ] Er verschijnt nergens op een kaart een gemeten score van methode-uitvoer
- [ ] Linter en de kaartintegriteitscontrole (gate) slagen zonder fouten

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
