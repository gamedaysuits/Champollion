---
sidebar_position: 2
title: "FAQ"
related:
  - label: "How It Works"
    to: /docs/network/how-it-works
    kind: doc
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Glossary"
    to: https://champollion.dev/glossary
    kind: glossary
    note: "Plain-language definitions for every technical term"
---

# Veelgestelde Vragen

> **Samenvatting.** Antwoorden op veelgestelde vragen over het Champollion Network — hoe scoring werkt, wat tot diskwalificatie leidt, hoe om te gaan met talen zonder FST's, aanbevelingen voor modellen en parameters, en het indieningsproces.

---

## Scoring & Statistieken

### Welke statistieken berekent het harnas?

Het testframework berekent vijf meetwaarden. Drie zijn taalonafhankelijk en werken voor elk taalpaar; twee zijn momenteel afhankelijk van CRK-specifieke plugins en zullen worden gegeneraliseerd naarmate we meer talen toevoegen. De uitvoerbare referentiecorpora zijn vandaag de dag open-gelicentieerde publieke sets — Global Voices, Tatoeba, TICO-19, IN22, SMOL en meer (zie [Datasets](/docs/network/leaderboard/datasets)) — en het leaderboard staat open voor inzendingen voor elk geregistreerd taalpaar. Plains Cree is simpelweg de taal waarvoor de twee taalspecifieke (FST-ondersteunde) meetwaarden als eerste zijn geïmplementeerd.

| Statistiek | Schaal | Wat het meet | Status |
|--------|-------|-----------------|--------|
| **chrF++** | 0–100 | Overlapping van karakter-n-grammen tussen voorspelde en referentievertaling. Beste oppervlaktestatistiek voor morfologisch rijke talen. Maakt gebruik van de native scoring van sacrebleu. | ✅ Alle talen |
| **Exacte overeenkomst** | 0,0–1,0 | Aandeel van vermeldingen waarbij de voorspelling na normalisatie exact overeenkomt met de referentie. | ✅ Alle talen |
| **FST-acceptatie** | 0,0–1,0 | Aandeel van uitvoerwoorden dat wordt geaccepteerd door een eindige-toestandstransducer (morfologische analysator). Wordt alleen berekend wanneer een FST-binair bestand is opgegeven. | ✅ Alle talen met FST |
| **Equivalente overeenkomst** | 0,0–1,0 | Aandeel van vermeldingen dat overeenkomt met de referentie of een aanvaardbare variant — rekening houdend met woordvolgorde, orthografische conventies en dialectale verschillen. | ⚡ CRK (wordt gegeneraliseerd) |
| **Semantische score** | 0,0–1,0 | Score voor betekenisbehoud — in hoeverre legt de vertaling de beoogde betekenis vast, ongeacht de oppervlaktevorm? | ⚡ CRK (wordt gegeneraliseerd) |

Aanvullende statistieken zijn gepland: **morfologische nauwkeurigheid**, **code-switching-detectie**, **terminologienaleving** en **hallucinatiedetectie**. Zie [Scoringspecificatie §2](/docs/network/specifications/scoring#2-metric-inventory) voor de volledige statistiekinventaris (zes categorieën).

### Hoe wordt de samengestelde score berekend?

De samengestelde score is een gewogen gemiddelde van beschikbare statistieken, genormaliseerd naar een schaal van 0,0–1,0. Gewichten zijn gedefinieerd in twee profielen:

- **Profiel A** (talen met FST): 9 statistieken, structurele statistieken (FST + morfologische nauwkeurigheid) dragen 40% bij aan het samengestelde gewicht
- **Profiel B** (talen zonder FST): 8 statistieken, semantiek en chrF++ dragen een gelijk topgewicht

Wanneer een statistiek niet beschikbaar is, wordt het gewicht ervan proportioneel herverdeeld over de overige statistieken. Dit betekent dat benchmarks in een vroeg stadium (waarbij alleen chrF++ en exacte overeenkomst beschikbaar zijn) nog steeds geldige samengestelde scores opleveren — de effectieve gewichten weerspiegelen simpelweg wat beschikbaar is.

**De volledige gewichtstabellen, normalisatieregels en uitsluitingsratio zijn te vinden in [Scoringspecificatie §4](/docs/network/specifications/scoring#4-composite-score).** De harnascode weerspiegelt deze tabellen in `mt_eval_harness/scoring.py`. chrF++ wordt genormaliseerd door te delen door 100 vóór weging; code-switching- en hallucinatiepercentages worden omgekeerd (lager = beter).

### Wat zijn kwaliteitsniveaus?

Kwaliteitsniveaus zijn heuristische labels die zijn gekoppeld aan bereiken van samengestelde scores. Ze helpen te communiceren wat een score *praktisch betekent*:

| Niveau | Samengesteld bereik | Interpretatie |
|------|----------------|----------------|
| **Basislijn** | 0,00 – 0,30 | Onder bruikbare kwaliteit. Methode vereist aanzienlijke verbetering. |
| **Opkomend** | 0,30 – 0,50 | Veelbelovend. Sommige vertalingen zijn correct, maar inconsistent. |
| **Functioneel** | 0,50 – 0,70 | Bruikbaar als referentie met menselijke beoordeling. Niet geschikt voor inzet zonder beoordeling. |
| **Inzetbaar** | 0,70 – 0,85 | Gereed voor productiegebruik met periodieke beoordeling. Activeert geschiktheid voor eigendomsoverdracht. |
| **Vloeiend** | 0,85 – 1,00 | Bijna-native kwaliteit. Geschikt voor inzet zonder toezicht. |

### Wat is het verschil tussen kwaliteitsniveaus en verificatieniveaus?

**Kwaliteitsniveaus** beschrijven *wat de geautomatiseerde score betekent* (Basislijn → Vloeiend). **Verificatieniveaus** beschrijven *wie het resultaat heeft gevalideerd*:

| Verificatieniveau | Wat het betekent |
|-------------------|------------------|
| **Self-benchmarked** | De indiener heeft de harness zelf uitgevoerd. Scores zijn aannemelijk maar ongecontroleerd. |
| **Champollion Verified** | Een beheerder heeft het resultaat gereproduceerd met behulp van de ingediende methodeconfiguratie. |
| **Community Validated** | Tweetalige sprekers van de doeltaal, gekwalificeerd volgens het eigen protocol van de community, hebben een gestratificeerde steekproef van de uitvoer beoordeeld (≥30 invoeren, ≥2 beoordelaars) en ≥70% voldeed aan de norm van de community. Uitsluitend toegekend door de eigen tests van de community; degradatie door een steekproefcontrole is symmetrisch en even openbaar. |

Een methode kan "Inzetbaar" zijn qua kwaliteit maar slechts "Zelf-gebenchmarkt" qua verificatie — wat betekent dat de score er goed uitziet, maar dat niemand deze onafhankelijk heeft bevestigd.

---

## Indiening & Diskwalificatie

### Wat leidt tot diskwalificatie van mijn inzending?

Uw inzending wordt afgewezen of gemarkeerd als:

1. **Uw methode is blootgesteld aan evaluatiedata.** Als u vermeldingen uit de evaluatiedataset hebt gebruikt voor training, fine-tuning, few-shot-prompting of op een andere manier, zijn uw scores kunstmatig verhoogd. Dit omvat het gebruik van de referentievertalingen in uw prompt.
2. **Uw run card slaagt niet voor integriteitschecks.** De vingerafdruk moet overeenkomen met de configuratie. Gemanipuleerde run cards worden afgewezen.
3. **Uw methode implementeert het TranslationMethod-protocol niet.** Het harnas verwacht `translate(entries, config) → results`. Aangepaste integraties die het harnas omzeilen, worden niet geaccepteerd.

### Kan ik meerdere keren indienen?

Ja. Het leaderboard registreert alle inzendingen. U kunt itereren — tientallen experimenten uitvoeren en alleen uw beste indienen. Elke inzending registreert een unieke vingerafdruk, zodat er geen onduidelijkheid bestaat over welke run welke score heeft opgeleverd.

### Hoe laat ik mijn score verifiëren?

1. **Self-benchmarked (automatisch):** Elke inzending begint hier.
2. **Champollion Verified (automatisch):** De server herbeoordeelt uw ingediende uitvoer tegen het sha-vastgezette referentiecorpus met de harness-metriek. Wanneer uw score wordt gereproduceerd, promoveert de run naar Champollion Verified — het enige niveau dat door het scorebord wordt gerangschikt. Als deze niet wordt gereproduceerd, of als een opgeslagen referentie is gewijzigd, wordt de run gediskwalificeerd.
3. **Community Validated:** Tweetalige sprekers van de doeltaal, gekwalificeerd volgens het eigen protocol van de community, beoordelen een gestratificeerde steekproef van de uitvoer van uw methode — minimaal 30 invoeren, minimaal 2 beoordelaars — en minimaal 70% moet voldoen aan de norm van de community. Het niveau wordt uitsluitend toegekend door tests die de community zelf naar eigen inzicht uitvoert, en kan op dezelfde manier worden ingetrokken: een mislukte steekproefcontrole degradeert de methode net zo openbaar. Dit kan niet worden geautomatiseerd — het vereist betrokkenheid van de community.

### Waarom voert u niet ieders methode opnieuw uit om deze te verifiëren?

Omdat we ons dat niet kunnen veroorloven en het niet nodig is. De server herbeoordeelt de ingediende uitvoer van *iedereen* gratis (dat ondervangt handmatig ingevoerde of bewerkte scores). Het daadwerkelijk opnieuw uitvoeren van een model kost echte rekenkracht, dus doen we dit op een **steekproef** gekozen door **reputatiegewogen auditing**: een run wordt altijd opnieuw uitgevoerd als er veel op het spel staat (het slaat de eerste brug naar een hele taalfamilie) of als deze afwijkend is (een te-mooi-om-waar-te-zijn sprong ten opzichte van de vorige beste), en bij bewezen bijdragers wordt deze zelden steekproefsgewijs gecontroleerd. Reputatie wordt alleen verdiend door voor deze audits te slagen (of doordat een onafhankelijke bijdrager uw resultaat bevestigt) — nooit door volume — dus nieuwe wegwerpidentiteiten leveren niets op. Eén ontdekte vervalsing reduceert de reputatie van een bijdrager tot nul, leidt tot een hernieuwde audit van hun volledige geverifieerde geschiedenis en wordt openbaar vastgelegd, vergelijkbaar met een intrekking. We beweren **niet** dat uw run "door de harness is gegaan" — voor zelf-gehoste rekenkracht die niet door de server kan worden geverifieerd — dus de geldigheid berust op *reproduceerbaarheid + reputatiebelang + bevestiging*, niet op attestatie. Zie de [MT Evaluatieregels](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) voor het volledige model.

### Is de inzending-API live?

Nog niet. Het `https://champollion.dev/api/leaderboard/submit`-eindpunt is toekomstgericht. Het huidige indieningspad is `mt-eval publish` — dit uploadt een run card vanuit de uitvoermap van het testframework (`eval/logs/harness/`) rechtstreeks naar het leaderboard als *zelfgerapporteerd (niet geverifieerd)*.

---

## Modellen & Parameters

### Welk model moet ik gebruiken?

Er is geen enkel beste model — het hangt af van het taalpaar, uw budget en uw aanpak. Algemene richtlijnen:

| Taaltype | Aanbevolen startpunt | Waarom |
|---------------|---------------------------|-----|
| **Hoog-resource** (Frans, Spaans, Japans) | `google/gemini-2.5-flash` of `gpt-4o-mini` | Snel, goedkoop, sterke basislijn |
| **Laag-resource met enige LLM-dekking** (Quechua, Yoruba) | `google/gemini-2.5-pro` of `anthropic/claude-sonnet-4` | Grotere modellen hebben betere latente kennis |
| **Polysynthetisch / zeer laag-resource** (Plains Cree, Inuktitut) | `google/gemini-2.5-pro` met coaching | Coachingdata is belangrijker dan modelkeuze. OMT-1600 bevat enkele polysynthetische talen (bijv. CRK op R1-niveau) maar met standaard BPE-tokenisatie — benchmark het als basislijn in het Network. |

Het evaluatietestframework maakt gebruik van OpenRouter, zodat elk model dat beschikbaar is op OpenRouter kan worden gebenchmarkt. Zie [openrouter.ai/models](https://openrouter.ai/models) voor de beschikbare lijst.

### Welke temperatuur moet ik gebruiken?

Lager is over het algemeen beter voor vertaling:

| Temperatuur | Effect | Aanbevolen voor |
|-------------|--------|-----------------|
| **0,0 – 0,2** | Sterk deterministisch, consistente uitvoer | Productiemethoden, definitieve benchmarks |
| **0,3 – 0,5** | Enige variatie, soms creatiever | Verkenning, vroege iteratie |
| **0,6+** | Hoge variatie, onvoorspelbaar | Niet aanbevolen voor MT-benchmarking |

De temperatuur wordt vastgelegd in de run card, zodat verschillende temperaturen verschillende vingerafdrukken opleveren — ze worden behandeld als afzonderlijke experimenten.

### Helpt coachingdata?

Ja, aanzienlijk — voor laag-resource talen. Coachingdata (grammaticaregels, woordenboekitems, stijlnotities) wordt geïnjecteerd in de systeemprompt van de LLM. Voor Plains Cree presteren gecoachte methoden consistent beter dan onbewerkte LLM-methoden voor polysynthetische talen, omdat algemene LLM's beperkte blootstelling aan polysynthetische structuren hebben en geen morfologisch bewustzijn. Zelfs OMT-1600, dat specifiek is getraind voor CRK, maakt gebruik van standaard BPE-tokenisatie die polysynthetische morfologie structureel niet kan representeren. De coachingdata biedt de linguïstische context die het model mist.

Voor hoog-resource talen (Frans, Spaans) heeft coaching minder impact, omdat het model al over sterke basiskennis beschikt.

Zie [Coachingdata](https://champollion.dev/docs/concepts/coaching-data) voor de volledige specificatie.

---

## FST & Morfologische Validatie

### Wat als er geen FST is voor mijn taal?

Veel talen hebben geen eindige-toestandstransducer. Dat is geen probleem — het harnas werkt ook zonder. De samengestelde score gebruikt Profiel B-gewichten (zie [Scoringspecificatie §4.3](/docs/network/specifications/scoring#43-weight-tables)), waarbij het gewicht verschuift naar semantische en oppervlaktestatistieken. FST-acceptatie wordt gemarkeerd als `null` in de run card.

De belangrijkste registers voor bestaande FST's:

| Register | Dekking | URL |
|----------|---------|-----|
| **GiellaLT** | 100+ talen — de Samische talen, Cree, Inuktitut en vele andere Oeraalse en minderheidstalen | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 talenparen, voornamelijk Europees | [apertium.org](https://apertium.org/) |
| **UniMorph** | Morfologische paradigma's voor 150+ talen | [unimorph.github.io](https://unimorph.github.io/) |

### Kan ik een FST bouwen?

Ja, maar het is niet eenvoudig. Een FST codeert de morfologische regels van een taal — alle geldige woordvormen. Het bouwen ervan vereist diepgaande linguïstische kennis van de taal. Als u toegang heeft tot een morfologische grammatica (bijv. van een taalkundeafdeling), kan deze worden gecompileerd tot een FST met behulp van tools zoals [HFST](https://hfst.github.io/) of [Foma](https://fomafst.github.io/).

### Hoe werkt FST-gating in de praktijk?

De FST-gated pipeline werkt als volgt:

1. De LLM genereert een vertaling
2. Elk woord in de uitvoer wordt gecontroleerd aan de hand van de FST
3. Woorden die de FST afwijst, worden gemarkeerd als morfologisch ongeldig
4. De methode kan het opnieuw proberen met feedback ("het woord X is niet geldig, probeer het opnieuw")
5. Na nieuwe pogingen worden resterende ongeldige woorden geregistreerd

De FST-acceptatiesnelheid meet hoeveel woorden de validatie doorstaan. Zie de [FST-Gated Pipeline Tutorial](/docs/network/tutorials/fst-gated-pipeline) voor een volledig uitgewerkt voorbeeld.

---

## Data & Datasets

### Kan ik een dataset bijdragen voor een nieuwe taal?

Ja. Minimumvereisten uit [Benchmarkspecificatie §11](/docs/network/specifications/benchmark#11-extending-to-new-languages):

- **50 goudstandaard-vermeldingen** (bron + geverifieerde referentievertaling)
- **30 ontwikkelingsvermeldingen** (mogen overlappen met de goudstandaard voor kleine corpora)
- **Toestemming van de gemeenschap** (voor Inheemse talen: expliciete autorisatie van een bestuursorgaan)
- **Herkomstdocumentatie** (waar de data vandaan komt, welke licentie van toepassing is)

Nieuwe datasets openen automatisch nieuwe leaderboard-tracks. Zie [Voor Taalgemeenschappen](/docs/network/community/for-language-communities) voor de bijdragersgids.

### In welk formaat moet mijn dataset zijn?

JSON met de canonieke veldnamen:

```json
{
  "name": "my-language-dev-v1",
  "language_pair": "en-xxx",
  "segment": "development",
  "version": "1.0",
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "[translation in target language]",
      "difficulty": 1,
      "domain": "general"
    }
  ]
}
```

Zie [Datasets](/docs/network/leaderboard/datasets) voor het volledige schema en de definities van moeilijkheidsniveaus.

---

## Soevereiniteit & Eigendom

### Wie is eigenaar van een methode die is gebouwd voor een Inheemse taal?

Voor Inheemse talen activeren methoden die het niveau Inzetbaar bereiken (samengestelde score ≥ 0,70) ÉN community-validatie doorstaan het proces van [eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer). Het code-eigendom gaat over van de onderzoeker naar de bestuursorganisatie van de taalgemeenschap.

De onderzoeker behoudt:
- Publicatierechten (academische artikelen over de methode)
- Vermelding op het leaderboard
- Het recht om dezelfde *technieken* toe te passen op andere talen

De bestuursorganisatie verkrijgt:
- Volledig eigendom van de methodecode en coachingdata
- Zeggenschap over inzet (wanneer, waar en hoe) — en alles wat een inzet oplevert. Champollion is niet-commercieel en neemt geen aandeel

### Kan ik champollion gebruiken voor niet-Inheemse talen zonder soevereiniteitsbezwaren?

Ja. Voor standaardtalen (Frans, Japans, Spaans, enz.) zijn er geen soevereiniteitsoverwegingen. Gebruik champollion normaal — vertaal, synchroniseer en publiceer naar wens. Het soevereiniteitskader is specifiek van toepassing op Inheemse en door de gemeenschap beheerde talen, waarbij principes voor databeheer (First Nations-datasoevereiniteit, CARE, Te Mana Raraunga) bijzondere aandacht vereisen.

---

## Zie ook

- **[Hoe het werkt](https://champollion.dev/how-it-works)** — de volledige oplossingsuitleg
- **[Scoringspecificatie](/docs/network/specifications/scoring)** — de SSOT voor alle scoringlogica (statistieken, gewichten, niveaus)
- **[Benchmarkspecificatie](/docs/network/specifications/benchmark)** — evaluatieprotocol, corpusformaat, soevereiniteit
- **[Een methode indienen](/docs/network/getting-started/submit-a-method)** — stapsgewijze quickstart
- **[Leaderboard-regels](/docs/network/leaderboard/rules)** — indieningscriteria
- **[Databeheer](/docs/network/sovereignty/data-sovereignty)** — corpora blijven bij hun beheerders; elke licentie wordt gerespecteerd
