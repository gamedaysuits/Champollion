---
sidebar_position: 7
title: "Corpus Design Framework"
---

# Raamwerk voor het Ontwerp van Evaluatiecorpora

Wanneer u een frontier-model evalueert op FLORES+ en het een score van 85 chrF++ behaalt, kunt u geen onderscheid maken tussen "het model is goed in vertalen" en "het model heeft deze specifieke zinsparen uit het hoofd geleerd." Die ene ambiguïteit is de reden waarom dit framework bestaat: het bouwen van een evaluatiecorpus is alleen zinvol als de scores betekenen wat ze beweren, en dat vereist een weloverwogen ontwerp — nieuwe paren, getraceerde herkomst, gestratificeerde domeinen, gelaagde moeilijkheidsgraad. Deze pagina is de bron van waarheid voor hoe Champollion evaluatiedatasets worden ontworpen, geconstrueerd en onderhouden.

> **Versie:** 1.0 · **Status:** Concept · Bijbehorend: de [Corpus Partnership](/docs/network/specifications/corpus-partnership) workflow brengt deze methodologie in de praktijk met een onderzoeksafdeling.

---

## 1. Ontwerpprincipes

### 1.1 — Waarom geen openbare benchmarks?

Openbare parallelle corpora (FLORES+, Tatoeba, WMT-testsets, OPUS) zijn beschikbaar voor ontwikkeling en foutopsporing, maar zijn **uitgesloten van officiële leaderboard-evaluatie**. De reden is eenvoudig:

**Contaminatie.** Frontier LLM's worden getraind op enorme webscrapes. Elke parallelle tekst die publiekelijk heeft bestaan — in het bijzonder in gecureerde, veelgeciteerde benchmarkdatasets — bevindt zich waarschijnlijk in hun trainingsdata. Dit is geen theoretische zorg — [onderzoek heeft aangetoond](https://arxiv.org/abs/2311.04850) dat er meetbare contaminatie-effecten zijn op MT-benchmarks. (Publieke benchmarks worden hier nog steeds uitgevoerd — maar alleen in een traject voor *relatieve vergelijking* dat methoden ten opzichte van elkaar kan rangschikken, nooit als absolute kwaliteit.)

Voor Champollion is dit uiterst belangrijk omdat:
- Het leaderboard LLM-methoden, klassieke MT-diensten en specifiek gebouwde systemen zij aan zij vergelijkt
- Onze waardepropositie een *eerlijke, rigoureuze evaluatie* is
- Onze doelgebruikers (taalgemeenschappen) implementatiebeslissingen nemen op basis van deze scores

### 1.2 — Kernvereisten

Elk Champollion-evaluatiecorpus moet voldoen aan:

| Vereiste | Motivering |
|----------|------------|
| **Door mensen geschreven** | Geen synthetische data. Alle bronteksten en referentievertaingen moeten door mensen zijn geschreven. LLM's mogen helpen bij uitlijning en opmaak, maar mogen nooit inhoud genereren. |
| **Niet openbaar beschikbaar in parallelle vorm** | De brontekst mag openbaar zijn; de referentievertaingen mogen openbaar zijn; maar de specifieke *koppeling* mag niet bestaan als een downloadbaar parallel corpus. |
| **Herkomst gedocumenteerd** | Elk item moet een gedocumenteerde oorsprong hebben: brondocument, vertaler, licentie, datum. |
| **Taalkundig onderbouwd** | De dekking moet worden geleid door typologische kenmerken, niet door willekeurige steekproeven. |
| **Domein-gestratificeerd** | Items moeten zich uitstrekken over gedefinieerde tekstdomeinen met gecontroleerde vertegenwoordiging. |
| **Moeilijkheidsgraad ingedeeld** | Items moeten worden ingedeeld in moeilijkheidsgraden (1–5) op basis van structurele complexiteit. |
| **Versiebeheerd** | Corpusversies zijn inhoudsgehasht. Scores zijn alleen vergelijkbaar binnen dezelfde versie. |
| **Beoordeelbaar door de gemeenschap** | Referentievertaingen moeten beoordeelbaar zijn door leden van de taalgemeenschap. |

### 1.3 — Neutraliteit ten aanzien van corpustype, lengte en stijl

Champollion is een open vertaalevaluatiehub die **neutraal staat ten opzichte van wat een vertaaleenheid is**. Een corpusitem is tekst van willekeurige lengte — een enkele korte zin, een lange meervoudige zin, een alinea of een volledig document — en het platform evalueert ze allemaal op dezelfde manier. **Er is geen beperking tot korte of eenvoudige tekst.** De harness legt geen lengtelimiet op (het stelt bewust royale uitvoertokenruimte in om te voorkomen dat lange vertalingen worden afgekapt); moeilijkheidsgraden (§3) en domeinen (§2.1) zijn *configureerbare assen*, geen poorten die moeilijk of lang materiaal uitsluiten.

De hub is neutraal en configureerbaar op de volgende assen:

| As | Bereik |
|----|--------|
| **Granulariteit** | zin · lange zin · alinea · document (`sizeUnit: entries \| sentences \| segments \| documents`) |
| **Lengte en complexiteit** | kort → lang; eenvoudig → zeer complex (moeilijkheidsgraden 1–5) |
| **Stijl en register** | formeel, informeel, technisch, literair, conversationeel, administratief (domaintaxonomie, §2.1) |
| **Methode** | elke `TranslationMethod` — LLM, neuraal NMT, regelgebaseerd, hybride, menselijk |
| **Taal en taalpaar** | elk gericht paar; geen ingebakken voorkeur voor talen met veel bronmateriaal |

Een corpus declareert zijn eigen type, granulariteit, register en moeilijkheidsgraad in zijn kaart, en de harness respecteert wat de kaart declareert. De standaard Tatoeba-gebaseerde **ontwikkelings**corpora bestaan uit korte zinnen omdat Tatoeba dat is — dat is een eigenschap van die broncorpora, **niet** een platformbeperking. Evaluatiesets op documentniveau en voor lange teksten zijn volwaardige burgers; registreer ze op dezelfde manier (en configureer bijvoorbeeld voor zeer lange items een kleinere aanvraagbatch).

---

## 2. Selectie van bronteksten

### 2.1 — Domaintaxonomie

Champollion evalueert vertaling voor **praktische implementatiecontexten**, niet voor academische oefeningen. Elk corpusitem wordt getagd met een domein uit de **canonieke 16-code domaintaxonomie**, die wordt gevalideerd tijdens de constructie.

De taxonomie wordt eenmalig gedefinieerd — in [Benchmarkspecificatie §2.7](/docs/network/specifications/benchmark#27-domain), de enige bron van waarheid — en wordt hier niet herhaald om afwijkingen te voorkomen. De codes zijn: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech` en `ui`. Zie §2.7 voor de beschrijving en typische gebruikers van elke code. Introduceer geen domaincodes buiten die set.

### 2.2 — Domainverdeling

Een standaard evaluatiecorpus moet streven naar een spreiding over de domeinen die het meest relevant zijn voor de doelgemeenschap. De exacte codes en percentages variëren per taalpaar; de onderstaande tabel is één *illustratieve* doelverdeling, met behulp van de canonieke codes uit §2.1:

| Domein | Code | Doel % | Motivering |
|--------|------|--------|------------|
| Software-UI | `ui` | 25% | Primaire implementatiecontext voor Champollion CLI-gebruikers |
| Overheid / administratief | `gov` | 15% | Hoogrisico-vertaling met juridische implicaties |
| Educatief | `edu` | 15% | Kerngebruiksscenario voor taalrevitalisering |
| Literair / narratief | `literary` | 10% | Test culturele nuance en literair register |
| Conversationeel | `conv` | 10% | Test informeel register en natuurlijke spreekpatronen |
| Technisch | `tech` | 10% | Test precisie en terminologieconsistentie |
| Medisch / gezondheid | `medical` | 10% | Hoogrisico, test domeinspecifiek vocabulaire |
| Nieuws / journalistiek | `news` | 5% | Test hedendaags vocabulaire en neutraal register |

### 2.3 — Selectiecriteria voor bronteksten

Bij het selecteren van bronteksten voor een nieuw corpus:

1. **Licentiecompatibiliteit.** Brontekst moet onder een licentie vallen die gebruik in een evaluatiecorpus toestaat. Geef de voorkeur aan CC BY, CC BY-SA of publiek domein. Documenteer de licentie.

2. **Actualiteit.** Geef de voorkeur aan teksten die in de afgelopen 10 jaar zijn gepubliceerd. Taal evolueert — met name vocabulaire rond technologie, bestuur en geneeskunde.

3. **Registerdiversiteit.** Zoek binnen elk domein naar teksten op verschillende formaliteitsniveaus. Een persconferentie van de overheid (formeel) en een bericht op sociale media van de overheid (informeel) behoren beide tot het `admin`-domein, maar hebben verschillende registers.

4. **Culturele relevantie.** Geef voor inheemse en minderheidstalen prioriteit aan teksten die van belang zijn voor de gemeenschap — documenten over landbeheer, educatief materiaal in de taal, teksten voor cultureel behoud — boven teksten die toevallig in parallel bestaan.

5. **Geen machinaal vertaalde bronnen.** Als een "parallel" document is gemaakt door het origineel door Google Translate te halen en vervolgens na te bewerken, is het NIET acceptabel als referentievertaling. De referentie moet een onafhankelijke menselijke vertaling zijn.

---

## 3. Systeem van moeilijkheidsgraden

### 3.1 — Definitie van de graden

Elk item krijgt een moeilijkheidsgraad (1–5) toegewezen op basis van de structurele complexiteit van de *brontekst*, niet de vertaalmoeilijkheid (die varieert per methode).

| Graad | Label | Structurele kenmerken |
|-------|-------|----------------------|
| 1 | **Elementair** | Eenvoudige zinnen. Enkelvoudige bijzin. Tegenwoordige tijd. Gangbaar vocabulaire. Geen idiomen. Geen ingebedde structuren. |
| 2 | **Gemiddeld** | Samengestelde zinnen. Twee bijzinnen verbonden door een voegwoord. Verleden/toekomstige tijd. Enig domeinvocabulaire. |
| 3 | **Gevorderd** | Complexe zinnen. Bijzinnen, betrekkelijke bijzinnen. Gemengde tijden. Domeinspecifieke terminologie. Lijdende vorm. |
| 4 | **Expert** | Meerdere ingebedde bijzinnen. Juridisch/technisch register. Voorwaardelijke structuren. Abstracte concepten. Culturele verwijzingen. |
| 5 | **Extreem** | Dicht proza met meerdere gelijktijdige uitdagingen: geneste onderschikking, ambigue pronominale verwijzing, culturele idiomen, gemengd register, zeldzaam vocabulaire. |

### 3.2 — Taalkundig onderbouwde moeilijkheidsfactoren

Naast structurele complexiteit wordt de moeilijkheidsgraad beïnvloed door de **typologische afstand** tussen de bron- en doeltaal. Deze factoren zijn ontleend aan WALS-typologische kenmerken en de classificatiegegevens van de taalkaart:

| Factor | Lage moeilijkheid | Hoge moeilijkheid |
|--------|-------------------|-------------------|
| **Woordvolgorde** | Dezelfde basisvolgorde (bijv. SVO→SVO) | Verschillende basisvolgorde (bijv. SVO→SOV) |
| **Morfologisch type** | Vergelijkbaar type (bijv. analytisch→analytisch) | Verschillend type (bijv. analytisch→polysynthetisch) |
| **Grammaticaal geslacht** | Hetzelfde systeem of geen geslacht | Bron heeft geen geslacht, doel heeft complex geslachtssysteem |
| **Beleefdheids-/register** | Geen registermarkering | Doel heeft complex registersysteem (bijv. Japans, Koreaans) |
| **Schrift** | Hetzelfde schrift | Verschillend schrift (transliteratie vereist) |
| **Animaatheid** | Geen animaatheidsonderscheid | Doel heeft animaatheidsgebaseerde congruentie (bijv. Cree) |
| **Evidentialiteit** | Geen evidentialiteit | Doel markeert informatiebron grammaticaal |

### 3.3 — Verdeling van moeilijkheidsgraden

Een standaard corpus moet bij benadering de volgende verdeling hebben:

| Graad | Doel % | Motivering |
|-------|--------|------------|
| 1 | 15% | Stelt de basislijn vast — zelfs slechte methoden zouden hiermee overweg moeten kunnen |
| 2 | 25% | De dagelijkse praktische vertaling |
| 3 | 30% | Hier worden kwaliteitsverschillen tussen methoden zichtbaar |
| 4 | 20% | Onderscheidt goede methoden van uitstekende |
| 5 | 10% | Plafondtest — zeer weinig methoden zullen hiermee goed omgaan |

---

## 4. Kwaliteit van referentievertaingen

### 4.1 — Vereisten voor vertalers

Referentievertaingen moeten worden geproduceerd door mensen die:

1. **Vloeiende sprekers** zijn van de doeltaal (moedertaal of gelijkwaardig)
2. **Geletterd** zijn in zowel de bron- als de doeltaal
3. **Domeinbewust** zijn voor het domein van de tekst (een medisch vertaler voor gezondheidsteksten, enz.)
4. **Onafhankelijk** zijn — de vertaler mag tijdens het vertalen geen toegang hebben tot MT-uitvoer voor dezelfde tekst

### 4.2 — Vertaalopdracht

Elke vertaler ontvangt een opdracht die het volgende bevat:

- Het te gebruiken **register** (formeel, conversationeel, enz.)
- Het **doelpubliek** (algemeen publiek, specialisten, kinderen, enz.)
- Eventuele **terminologieconventies** die specifiek zijn voor de taalgemeenschap
- Expliciete instructie: "Vertaal de betekenis, niet de woorden. Een natuurlijk klinkende vertaling is waardevoller dan een letterlijke."

### 4.3 — Kwaliteitsborging

1. **Dubbele vertaling.** Idealiter heeft elk item twee onafhankelijke referentievertaingen door verschillende vertalers. Waar dit niet haalbaar is, geef dan prioriteit aan dubbele vertaling voor graden 4–5.

2. **Gemeenschapsbeoordeling.** Referentievertaingen moeten worden beoordeeld door ten minste één extra spreker die de vertaling niet heeft geproduceerd.

3. **Acceptabele varianten.** Documenteer voor elke referentie bekende acceptabele varianten (woordvolgorde, orthografische conventies, dialectvormen). Deze voeden de `equivalent_match_rate`-metriek.

### 4.4 — Wat een slechte referentie maakt

| Probleem | Waarom het de evaluatie ongeldig maakt |
|----------|---------------------------------------|
| Machinaal vertaald en vervolgens nabewerkt | Nabewerking behoudt de MT-structuur; benadeelt methoden die meer natuurlijke vertalingen produceren |
| Vertaald door een leerder, niet een vloeiende spreker | De referentie kan fouten bevatten die correcte MT-uitvoer benadelen |
| Overdreven letterlijk | Natuurlijke vertalingen scoren slecht ten opzichte van letterlijke referenties |
| Enkelvoudige geldige interpretatie voor een ambigue bron | Benadeelt geldige alternatieve interpretaties |

---

## 5. Contaminatiepreventie

### 5.1 — Het contaminatiedreigingsmodel

| Dreiging | Beschrijving | Maatregel |
|----------|--------------|-----------|
| **Overlap met trainingsdata** | LLM's getraind op het parallelle corpus | Publiceer het parallelle corpus niet openbaar |
| **Few-shot-lekkage** | Methode-auteur gebruikt evaluatie-items als few-shot-voorbeelden | Vingerafdrukcontrole: items in de prompt worden gedetecteerd en gemarkeerd |
| **Indirecte contaminatie** | Brontekst bestaat in LLM-trainingsdata (eentalig) | Acceptabel — eentalige brontekst is te verwachten. De *koppeling* moet nieuw zijn. |
| **Gemeenschapscontaminatie** | Gemeenschapsbeoordelaars delen items openbaar | Licentievoorwaarden verbieden herdistributie van het parallelle corpus |

### 5.2 — Geheimhoudingsniveaus voor corpora

| Niveau | Zichtbaarheid | Gebruik |
|--------|--------------|---------|
| **Openbare ontwikkelingsset** | Volledig openbaar | Methode-ontwikkeling, foutopsporing, regressietesten. Scores worden NIET gepubliceerd op het leaderboard. |
| **Afgeschermde evaluatieset** | Brontekst zichtbaar, referenties geheim | Officiële leaderboard-evaluatie. Methoden ontvangen brontekst en retourneren vertalingen; scoring vindt server-side plaats. Referenties worden nooit blootgesteld aan de methode. |
| **Goudstandaard-set** | Volledig geheim, beheerd door de gemeenschap | Door de gemeenschap gevalideerde evaluatie. Beheerd door een governance-organisatie. Gebruikt voor het verificatieniveau "Community Validated". |

### 5.3 — Rotatiebeleid

Evaluatiecorpora moeten periodiek worden **geroteerd**:

1. Nadat een corpus 12 maanden in gebruik is, begint u met het samenstellen van een vervanger
2. Zet het oude corpus terug naar de status "ontwikkelingsset" (openbaar)
3. Promoveer het nieuwe corpus naar "afgeschermde evaluatieset"
4. Dit voorkomt geleidelijke contaminatie door iteratieve optimalisatie tegen een vast doel

---

## 6. Workflow voor corpusconstructie

### 6.1 — Stapsgewijs proces

```
Step 1: Language Pair Selection
    └─ Identify target language, read language card
    └─ Review typological features (WALS), contact influences, scripts
    └─ Identify which difficulty factors apply

Step 2: Source Text Curation
    └─ Identify candidate source documents per domain
    └─ Verify licenses
    └─ Extract candidate sentences/segments
    └─ Classify by domain and preliminary difficulty tier

Step 3: Segment Selection
    └─ Sample segments to match domain distribution (§2.2)
    └─ Sample segments to match difficulty distribution (§3.3)
    └─ Ensure linguistic phenomenon coverage (§6.2)
    └─ Target minimum corpus size (§6.3)

Step 4: Reference Translation
    └─ Assign segments to qualified translators
    └─ Provide translation brief
    └─ Collect translations
    └─ Dual-translate Tier 4–5 entries

Step 5: Quality Assurance
    └─ Community review of references
    └─ Document acceptable variants
    └─ Flag and resolve disagreements

Step 6: Metadata & Packaging
    └─ Assign final difficulty tiers
    └─ Add provenance metadata per entry
    └─ Content-hash the corpus for versioning
    └─ Package as corpus JSON per harness spec

Step 7: Registration
    └─ Register in Supabase datasets table
    └─ Add to ATTRIBUTION.md if new sources used
    └─ Document in arena website
```

### 6.2 — Dekking van taalkundige verschijnselen

Elk corpus moet items bevatten die specifieke taalkundige verschijnselen testen die relevant zijn voor het taalpaar. Deze zijn ontleend aan de `linguisticChallenges`- en `contactInfluences`-velden van de taalkaart:

**Universele verschijnselen (alle taalparen):**
- Pronominale verwijzing (ambigue antecedenten)
- Negatie (enkelvoudig, dubbel, bereik)
- Kwantoren (alle, sommige, geen, de meeste)
- Tijdsuitdrukkingen (relatieve datums, duren)
- Eigennamen (personen, plaatsen, organisaties)
- Getallen en maten
- Lijsten en opsommingen

**Paarsspecifieke verschijnselen (uit de taalkaart):**
- Voor polysynthetische doeltalen: complexe werkwoordsmorfologie, incorporatie
- Voor doeltalen met geslacht: geslachtscongruentie, neutrale/inclusieve verwijzing
- Voor SOV-doeltalen: werkwoorden aan het einde van de bijzin, postposities
- Voor toontalen: betekenisonderscheidingen op basis van toon
- Voor talen met beleefdheidsvormen: registermarkeringen, sociale context
- Voor contacttalen: grenzen van code-switching, integratie van leenwoorden

### 6.3 — Minimale corpusomvang

Statistische betrouwbaarheid vereist minimale itemaantallen. Deze zijn gebaseerd op vereisten voor betrouwbaarheidsintervallen via paired bootstrap (uit `significance.py`):

| Doel | Minimum items | Aanbevolen |
|------|---------------|------------|
| Ontwikkelingsset | 50 | 100–200 |
| Afgeschermde evaluatieset | 100 | 200–500 |
| Goudstandaard-set | 200 | 500+ |
| Minimum per domein | 10 | 25+ |
| Minimum per graad | 10 | 20+ |

**Waarom minimaal 100 voor evaluatie?** Met minder dan ~100 items kunnen paired bootstrap-significantietests (1.000 hersteekproeven) geen verschillen kleiner dan ~5 chrF++-punten betrouwbaar detecteren. Met 200+ items kunnen we ~2-puntverschillen detecteren bij p<0,05.

---

## 7. JSON-formaat voor corpora

Elk corpusitem volgt de harness-specificatie:

```json
{
  "id": "edtekla-dev-v1-042",
  "source": "The school board will meet on Tuesday to discuss the new curriculum.",
  "reference": "ᑭᓯᑭᓄᐦᐊᒫᑐᐏᓐ ᑲ ᐃᔑ ᐱᒥᐸᔨᐦᑕᐦᒃ ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓇ ᐁ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ ᓂᔓ ᑭᔑᑲᐤ",
  "acceptable_variants": [
    "ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓐ ᓂᔓ ᑭᔑᑲᐤ ᑲ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ"
  ],
  "domain": "edu",
  "difficulty": 3,
  "phenomena": ["temporal_expression", "named_entity", "future_tense"],
  "provenance": {
    "source_doc": "EdTeKLA Module 4, Unit 7",
    "source_license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "translator": "anonymous-speaker-001",
    "translator_qualification": "L1 Plains Cree, certified translator",
    "translation_date": "2025-11-15",
    "reviewer": "anonymous-speaker-002",
    "review_date": "2025-12-01"
  }
}
```

---

## 8. Maatregelen tegen manipulatie

### 8.1 — Corpusintegriteit

| Maatregel | Implementatie |
|-----------|---------------|
| **Inhoudshashing** | Corpusversie = SHA-256 van gesorteerde item-ID's + referenties. Elke wijziging produceert een nieuwe versie. |
| **Item-vingerafdruk** | Elk item heeft een inhoudsafgeleid ID. Als iemand resultaten indient tegen een gewijzigd corpus, komt de vingerafdruk niet overeen. |
| **Handhaving van afscherming** | Voor officiële evaluatie ontvangen methoden ALLEEN brontekst. Referenties worden nooit blootgesteld. Scoring vindt server-side plaats. |
| **Rotatieschema** | Corpora roteren jaarlijks om langdurige optimalisatie tegen een vast doel te voorkomen. |

### 8.2 — Integriteit van inzendingen

| Maatregel | Implementatie |
|-----------|---------------|
| **Deterministische vingerafdruk** | De uitvoeringsconfiguratie (model, temperatuur, prompt, corpusversie) wordt gehasht. Identieke configuraties produceren identieke vingerafdrukken. |
| **Detectie van selectieve inzending** | Inzenders moeten alle uitvoeringen bekendmaken, niet alleen de beste. Meerdere inzendingen met dezelfde vingerafdruk worden gemarkeerd. |
| **Contaminatiecontrole** | Als evaluatie-items woordelijk voorkomen in de prompt of trainingsdata van de methode, wordt de inzending gediskwalificeerd. |

---

## 9. Bestaande corpora

### 9.1 — EDTeKLA-ontwikkelingsset v1

| Eigenschap | Waarde |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Talenpaar** | EN → CRK (Plains Cree, SRO) |
| **Items** | Dev-split van 436 items (`textbook_dev.json`). De volledige uitsplitsing wordt eenmalig vermeld op de [pagina Evaluatiedatasets](/docs/network/leaderboard/datasets#edtekla-development-set-v1). |
| **Domeinen** | Educatief (100%) |
| **Niveaus** | 1–5 (verdeling nader te bepalen per item-audit) |
| **Licentie** | EdTeKLA's gewijzigde CC BY-NC-SA (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, sovereignty-scoped) — **uitgesloten van de leaderboard-, prijzen- en commerciële/API-trajecten** (niet-commercieel) |
| **Status** | Ontwikkelingsset (publiek) |

**Beperkingen:** Enkel domein (uitsluitend educatief). Geen domeinstratisficatie. Graadtoewijzingen vereisen mogelijk een audit. Kleine corpusomvang beperkt de statistische kracht voor significantietesten.

### 9.2 — Geplande corpora

| Corpus | Paar | Status | Eigenaar |
|--------|------|--------|----------|
| Aangepast corpus EN → TL (Filipijns) | EN → TL | Gepland | Projecteigenaar |
| Afgeschermde set EN → CRK | EN → CRK | Toekomstig (gemeenschapspartner vereist) | Gemeenschaps-governance-organisatie |

---

## 10. Integratie van taalkaarten

Het corpusraamwerk integreert met het taalkaartensysteem:

1. **Domainselectie** wordt geïnformeerd door het `linguisticChallenges`-veld van de kaart — als een taal unieke uitdagingen heeft (polysynthese, toon, animaatheid), moet het corpus items bevatten die deze testen.

2. **Kalibratie van moeilijkheidsgraad** maakt gebruik van het `classification`-veld van de kaart — de typologische afstand tussen bron- en doeltaalfamilies beïnvloedt wat als "moeilijk" wordt beschouwd.

3. **Registerdekking** maakt gebruik van het `registers`-veld van de kaart — als een taal gedefinieerde registers heeft (formeel-Filipijns, taglish-professioneel, taglish-informeel), moet het corpus items bevatten op elk registerniveau.

4. **Testen van contactinvloed** maakt gebruik van het `contactInfluences`-veld van de kaart — voor talen met zware leenwoordlagen (Filipijns: Spaans + Engels + Arabisch), neem items op die testen of methoden leenwoorden correct verwerken versus ze oververtalen.

5. **Schriftverwerking** maakt gebruik van het `scripts[]`-veld van de kaart — voor meertalige schriften (Servisch: Cyrillisch + Latijn), neem items op die de correcte schriftselectie testen.

---

## Referenties

- **Champollion-scoringsspecificatie** — definieert alle metriken, samengestelde gewichten, kwaliteitsgraden
- **Champollion-benchmarkspecificatie** — evaluatieprotocol, corpusformaat, datasouvereiniteit
- **WALS** (World Atlas of Language Structures) — database van typologische kenmerken
- **Glottolog** — bron van waarheid voor taalclassificatie
- **ISO 639-3** — standaard voor taalidentificatie
- **EdTeKLA** — bron van het eerste evaluatiecorpus

---

*Dit document is een levende specificatie. Werk het bij naarmate nieuwe corpora worden opgebouwd en lessen worden geleerd.*
