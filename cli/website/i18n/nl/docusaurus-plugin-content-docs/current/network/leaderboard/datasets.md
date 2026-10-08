---
sidebar_position: 3
title: "Evaluatiedatasets"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# Evaluatiedatasets

> **Managementsamenvatting.** Deze pagina beschrijft de evaluatiedatasets die beschikbaar zijn voor benchmarking, inclusief het corpusschema, moeilijkheidsniveaus (1–5) en herkomstvereisten. De catalogus bevat **~4.700 fetch-from-source-evaluatiedatasets over 19 corpusfamilies** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, de WMT newstest/General blind sets 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) plus FLORES+ — corpus*inhoud* wordt hier nooit gehost; elke dataset is een sha-gepinde metadatakaart die deterministisch opnieuw wordt opgebouwd vanuit het gepinde upstream-archief. Een **niet-commerciële / uitsluitend voor onderzoek bedoelde lane** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k en de WMT-onderzoekssets) is uitgesloten van commerciële / prijs- / API-trajecten; daarbinnen zijn corpora onder gewijzigde, op maat gemaakte of niet-gespecificeerde toekenningen bovendien **onderworpen aan toestemming (consent-gated)** — evaluatie via externe model-API's weigert tenzij de licentietekst zelf evaluatiegebruik toestaat (vastgelegd als een expliciete beslissing per dataset, zoals bij de WMT-onderzoekssets) of de toestemming van de rechthebbende is vastgelegd in de datasetvermelding. De twee door mensen samengestelde referentiedatasets — EDTeKLA Dev v1 (Plains Cree) en FLORES+ Devtest (870 gecatalogiseerde taalparen, elk 1.012 zinnen) — worden hieronder in detail beschreven; EdTeKLA's volledige uitsplitsing van het aantal vermeldingen wordt eenmalig vermeld, in [de betreffende sectie](#edtekla-development-set-v1).

Datasets zijn de vaste doelwitten waarop het harnas wordt uitgevoerd. Elke dataset is een JSON-bestand met bron→doelparen en goudstandaardreferenties. Het harnas beoordeelt modeluitvoer aan de hand van deze referenties — het past ze nooit aan.

:::danger[GEBRUIK evaluatiedata NIET voor training]

⚠️ **Deze datasets zijn uitsluitend bedoeld voor evaluatie.** Methoden die zijn getraind, verfijnd, few-shot-geprompt of op een andere manier blootgesteld aan evaluatiedata produceren kunstmatig opgeblazen scores en worden **gediskwalificeerd van het leaderboard.**

Gebruik afzonderlijke corpora voor training. Evaluatiesets mogen tijdens de ontwikkeling niet door uw model zijn gezien.
:::

---

## Datasetformaat {#dataset-format}

Elke dataset volgt hetzelfde JSON-schema:

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[Canoniek schema]
De [Benchmark Specification](/docs/network/specifications/benchmark) definieert het canonieke corpus- en invoerschema. Deze pagina documenteert beschikbare datasets en hoe u nieuwe kunt aanmaken.
:::

### Blok `dataset` op het hoogste niveau

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `id` | `string` | Unieke dataset-identifier (gebruikt in run cards en het leaderboard) |
| `version` | `string` | Semantische versie. Het verhogen hiervan maakt eerdere run card-vergelijkingen ongeldig |
| `language_pair` | `string` | Weergavelabel (bijv. `EN→CRK`) |
| `description` | `string` | Optioneel. Leesbare samenvatting voor mensen |
| `source_language` | `string` | BCP 47-brontalcode |
| `target_language` | `string` | BCP 47-doeltalcode |
| `created` | `string` | ISO 8601-aanmaakdatum |
| `license` | `string` | SPDX-licentie-identifier |
| `provenance` | `string[]` | Lijst van herkomsttags die in invoeren worden gebruikt |

### Invoervelden

| Veld | Type | Vereist | Beschrijving |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | Unieke invoer-identifier binnen het corpus |
| `source` | `string` | ✅ | De te vertalen brontekst |
| `reference` | `string` | ✅ | De goudstandaard referentievertaling |
| `difficulty` | `integer` | ✅ | Moeilijkheidsgraad 1–5 (zie hieronder) |
| `provenance` | `string` | ✅ | Herkomst van deze invoer (bijv. `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | Register/formaliteitsniveau (bijv. `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | Communicatieve functie (bijv. `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | Optionele context voor menselijke beoordelaars |
| `morphological_analysis` | `string` | ❌ | Goudstandaard morfologische uitsplitsing |
| `variant_class` | `string` | ❌ | Klasselabel dat acceptabele vertaalvarianten groepeert |

---

## Beschikbare datasets

De catalogus bevat **~4.700 fetch-from-source-evaluatiedatasets over 19 corpusfamilies**,
plus de twee door mensen samengestelde referentiedatasets (EDTeKLA + FLORES)
die hieronder worden beschreven — een registertotaal van **5.601 datasets** per 2026-09-06. Elk
corpus is een **sha-gepinde metadatakaart** — corpusinhoud wordt hier nooit gehost;
deze wordt tijdens de evaluatie deterministisch opnieuw opgebouwd vanuit het gepinde upstream-archief.
Alle datasets bevatten `do_not_train`. Eén bronkaart vertakt zich naar vele
datasets per paar, waardoor het registertotaal aanzienlijk groter is dan de ~1.417 bronkaarten; de
open-lane-datasets voeden de sweep-wachtrij rechtstreeks; de research-only-lane draait
op aanvraag waar de licentie dit expliciet toestaat (gewijzigde/op maat gemaakte/ongespecificeerde
toekenningen vereisen toestemming voor evaluaties via externe model-API's).

| Familie | Datasets | Bouwer / bron | Licentie | Lane |
|---------|---------:|---------------|----------|------|
| **TICO-19** | 1.260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | open |
| **IN22** (Conv + Gen) | 1.012 | AI4Bharat / IIT Madras | CC-BY-4.0 | open (HF-gated download) |
| **Tatoeba** | 874 | [Tatoeba-community](https://tatoeba.org), via de Tatoeba Challenge | CC-BY-2.0 | open |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | open |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | open |
| **WMT newstest / General** (blind sets 2014–2025) | 178 | WMT (Conference on Machine Translation), via sacreBLEU | `LicenseRef-WMT-Research-Use` | **onderzoeksgebruik** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | open |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | open |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | open |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **niet-commercieel / alleen onderzoek** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | open (share-alike) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **alleen onderzoek** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (organisatoren van de shared task) | CC-BY-NC-SA-4.0 | **niet-commercieel / alleen onderzoek** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (organisatoren) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **alleen onderzoek** |
| **Gamayun** | 8 | CLEAR Global (voorheen Translators without Borders) | `LicenseRef-TWB-Gamayun` | **niet-commercieel / alleen onderzoek** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **niet-commercieel / alleen onderzoek** |
| **EDTeKLA / prize** | 2 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **in quarantaine: nooit uitvoerbaar of gerangschikt** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **niet-commercieel / alleen onderzoek** |
| **MENYO-20k** | 2 | Masakhane / Saarland University (uds-lsv) | CC-BY-NC-4.0 | **niet-commercieel / alleen onderzoek** |

*(FLORES+ devtest — 870 gecatalogiseerde paren, CC-BY-SA-4.0 — is de referentiedataset
die hieronder in detail wordt beschreven, waarmee het registertotaal op 5.601 komt.)*

:::info[De niet-commerciële research-only-lane]
Het merendeel van de catalogus heeft een permissieve licentie (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) en is bruikbaar in elke lane. Een kleine groep — **Gamayun** (de op maat gemaakte
licentie van TWB) en **EDTeKLA** (een gewijzigde, op soevereiniteit gerichte CC BY-NC-SA) — is **niet-commercieel**: deze is
uitgesloten van elk commercieel, prijs- of API-traject. Voor corpora onder
gewijzigde, op maat gemaakte of niet-gespecificeerde toekenningen is evaluatie via externe model-API's
bovendien **afhankelijk van toestemming (consent-gated)**: het harness weigert hun tekst naar
model-API's van derden te sturen tenzij de licentietekst zelf evaluatiegebruik toestaat
(vastgelegd als een expliciete beslissing per dataset — de WMT-onderzoekssets
bevatten er een) of de expliciete toestemming van de rechthebbende is geregistreerd op het
dataset-item (lokale evaluatie blijft mogelijk). Toelaatbaarheid is **gebaseerd op gebruik**: de commerciële lane is strikt,
de research-lane is coulant, en quarantaine wint altijd (de corpora van EdTeKLA zijn
volledig in quarantaine geplaatst, en de database weigert scores die hiervoor worden ingediend). Zie
[Corpora registreren en exposure-lanes](/docs/network/sovereignty/registering-corpora) voor
informatie over hoe een corpus zijn lane kiest.
:::

De referentiedatasets worden hieronder toegelicht; de familiecorpora volgen hetzelfde JSON-schema en zijn opgenomen in het datasetregister.

:::note[Een catalogus is geen gevuld scorebord]
Een uitgebreide corpuscatalogus geeft aan waartegen methoden *kunnen* worden
gebenchmarkt — het is geen scorebord vol resultaten. Het scorebord zelf wordt
gevuld; zie de [scorebordregels](/docs/network/leaderboard/rules) en
[Eerlijke beperkingen](/docs/network/honest-limitations).
:::

### EDTeKLA Development Set v1 {#edtekla-development-set-v1}

De eerste evaluatiedataset, opgebouwd voor Engels→Plains Cree (SRO)-vertaling. Samengesteld door de [EdTeKLA-onderzoeksgroep](https://spaces.facsci.ualberta.ca/edtekla/) aan de University of Alberta.

| Eigenschap | Waarde |
|------------|--------|
| **ID** | `eval-eng-crk-edtekla-dev-v1` (en `eval-eng-crk-edtekla-textbook`) |
| **Versie** | `1.0` |
| **Taalpaar** | EN → CRK (Plains Cree, SRO-spelling) |
| **Aantal vermeldingen** | Dev-split van 436 vermeldingen (`textbook_dev.json`). Keten: 589 ruwe uitgelijnde regels upstream → 486 unieke geldige paren na normalisatie/ontdubbeling (een aantal afgeleid door Champollion) → 436 dev + 50 held-out (Champollions deterministische seed-42-split — EdTeKLA publiceert de ruwe bestanden, geen split). Een afzonderlijke gouden-standaardset van 62 vermeldingen (handmatig samengesteld, alleen voor onderzoek, **geen** EdTeKLA-materiaal) brengt de gecombineerde Plains Cree-evaluatiecollectie van het project op 548. |
| **Moeilijkheidsverdeling** | Eenvoudig, Gemiddeld, Moeilijk |
| **Herkomst** | `gold_standard` (geverifieerd door sprekers), `textbook` (gepubliceerd lesmateriaal) |
| **Licentie** | [Gewijzigde CC BY-NC-SA van EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — gericht op soevereiniteit; het oorspronkelijke leerboek is CC BY-NC-ND 4.0) — **in quarantaine**: gecatalogiseerd maar nooit uitvoerbaar, en een score die hiervoor wordt ingediend, wordt geweigerd door de database; uitgesloten van het klassement, prijzen en de commerciële/API-lanes (niet-commercieel) |

> **Dit is de gezaghebbende opgave van de tellingen voor de Plains Cree-evaluatieset.** Andere
> pagina's linken hiernaar in plaats van ze opnieuw te vermelden. De getallen 486/436/50 zijn
> door Champollion afgeleid uit de ruwe uitgelijnde bestanden van EdTeKLA (EdTeKLA publiceert
> zelf geen tellingen of splits); de gouden-standaardset van 62 vermeldingen heeft een afzonderlijke,
> niet van EdTeKLA afkomstige herkomst. De bovenstaande telling is altijd gekoppeld aan de bijbehorende lane: EdTeKLA hanteert een gewijzigde,
> op soevereiniteit gerichte CC BY-NC-SA en is **uitgesloten van het klassement, prijzen en het
> commerciële/API-traject**.

**Wat het test:**

- Basisbegroetingen en veelgebruikte uitdrukkingen
- Naamwoordanimaatheid en obviatie
- Werkwoordvervoeging over personen en tijden
- Locatieve constructies
- Bezittelijke paradigma's
- Complexe zinsstructuren

:::tip[Corpusstructuur]
Het van EdTeKLA afgeleide materiaal is opgedeeld in een openbare dev-set en een held-out-set (Champollions split van EdTeKLA's ruwe leerboekuitlijning — aantallen in de bovenstaande tabel). De afzonderlijke gouden-standaardset van 62 vermeldingen is handmatig samengesteld uit andere bronnen en maakt geen deel uit van het EdTeKLA-corpus. Een kleinere dataset van hoge kwaliteit met geverifieerde gouden standaarden is nuttiger dan een grote dataset met veel ruis — vooral voor een taal met beperkte middelen (low-resource) waar "bijna goede" vertalingen morfologisch vaak ongeldig zijn.
:::

---

## Een nieuwe dataset aanmaken

Om een dataset voor een nieuw taalpaar of domein aan te maken:

### 1. Structureer de JSON

Volg het schema uit [Datasetformaat](#dataset-format). Elke invoer moet `source`, `reference`, `difficulty`, `provenance`, `register` en `context` bevatten.

### 2. Wijs een unieke ID toe

Gebruik een beschrijvende slug: `{project}-{split}-v{version}` (bijv. `edtekla-dev-v1`, `quechua-test-v1`).

### 3. Verifieer de goudstandaarden

Elke `reference`-waarde moet worden geverifieerd door een vloeiende spreker of afkomstig zijn uit een gepubliceerde, peer-reviewed bron. Door machines gegenereerde referenties ondermijnen het doel van evaluatie.

### 4. Stel moeilijkheidsgraden in

Wijs elke invoer een geheel getal als moeilijkheidsniveau toe:

| Graad | Beschrijving | Voorbeelden |
|------|-------------|----------|
| 1 — Basiswoordenschat | Losse woorden, veelgebruikte begroetingen, getallen | "hello" → "tânisi" |
| 2 — Eenvoudige zinnen | Onderwerp-werkwoord of SVO, tegenwoordige tijd | "I see the dog" |
| 3 — Gemiddelde complexiteit | Verleden/toekomstige tijd, bezittelijkheden, animaatheid | "I saw his dog yesterday" |
| 4 — Complexe morfologie | Obviatie, lijdende vorm, conjunctvolgorde | "the woman whose son went to the store" |
| 5 — Gevorderd | Meerdere bijzinnen, formeel register, ceremonieel, idiomatisch | Volledige alinea met registerpassend taalgebruik |

### 5. Tag de herkomst

Elke invoer moet aangeven waar deze vandaan komt. Veelgebruikte tags:

- `gold_standard` — Geverifieerd door vloeiende sprekers
- `textbook` — Afkomstig uit gepubliceerd educatief materiaal
- `elicited` — Verkregen via gestructureerde elicitatiesessies
- `corpus` — Geëxtraheerd uit een parallel corpus

### 6. Valideer het bestand

Voer het harnas uit op uw dataset met een willekeurig model om te controleren of de JSON correct is opgemaakt en alle vereiste velden aanwezig zijn:

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

Het harnas geeft een foutmelding bij ontbrekende velden, dubbele indices of schemaschendingen.

### 7. Dien in voor opname

Open een pull request in de [eval harness-repository](https://github.com/gamedaysuits/Champollion) waarin u een **fetch-from-source metadatakaart** toevoegt — een registervermelding die het harnas naar de upstream-bron verwijst (loader/URL, SHA-pin, licentie en herkomst). **Commit nooit de corpusinhoud zelf.** Champollion host of beheert geen tekst van derde-partijcorpora; het harnas haalt referenties op uit de upstream-bron tijdens uitvoering en beoordeelt aan de hand van de vers opgehaalde data. Valideer eerst lokaal (stap 6) en dien vervolgens alleen de kaart in. Voeg documentatie toe van uw verificatiemethodologie en herkomstbronnen.

---

## FLORES+ Devtest

Een meertalige benchmark met brede dekking, onderhouden door het [Open Language Data Initiative (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus). Gebruikt voor de multi-model frontiersvergelijkingen van Champollion.

| Eigenschap | Waarde |
|----------|-------|
| **ID** | Één kaart per paar: `eval-flores-devtest-v1-<src>-<tgt>` (bijv. `eval-flores-devtest-v1-amh-fra`) |
| **Taalparen** | 870 gecatalogiseerde en uitvoerbare paren (812 daarvan tussen twee niet-Engelstalige talen) |
| **Aantal invoeren** | 1.012 zinnen per paar |
| **Licentie** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **Bron** | Meta FLORES-200, nu onderhouden door OLDI — opgehaald uit de bron, SHA-vastgezet per paar (corpusinhoud wordt hier nooit bijgehouden) |
| **Contaminatie** | **HOOG** — uitsluitend relatief, alleen voor testen/illustratie (zie opmerking) |

:::warning[HOGE contaminatie — uitsluitend relatief, nooit een absoluut benchmark]
FLORES+ is publiek beschikbare, webcrawled data die frontiermodellen zeer
waarschijnlijk al hebben gezien. Champollion gebruikt het uitsluitend in een
**relatieve lane**: bruikbaar om methoden onderling te vergelijken, maar **nooit
gerapporteerd als een absolute kwaliteitsscore**, en **nooit gebruikt als
ketenverbinding** op de [vertaalkaart](https://champollion.dev).
Het is **uitsluitend bedoeld voor testen en illustratie**.
:::

:::danger[Uitsluitend voor evaluatie]
FLORES+ is uitsluitend bedoeld voor evaluatie. De samenstellers verzoeken uitdrukkelijk dat het **niet als trainingsdata wordt gebruikt**. Zorg ervoor dat de inhoud ervan is uitgesloten van alle trainingscorpora.
:::

---

## Zie ook

- [MT-evaluatie](/docs/network/leaderboard/rules) — overzicht van het evaluatieraamwerk en het leaderboard
- [Eval Harness](/docs/network/specifications/harness) — hoe u evaluaties uitvoert op deze datasets
- [Run Card-specificatie](/docs/network/specifications/run-card) — het JSON-schema voor het vastleggen van resultaten
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmarkscores
- [EdTeKLA Project](https://spaces.facsci.ualberta.ca/edtekla/) — de onderzoeksgroep van de University of Alberta achter de Cree-dataset
