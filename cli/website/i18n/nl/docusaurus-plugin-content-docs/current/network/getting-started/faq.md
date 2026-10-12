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

De hoofdscore, en het enige getal waarmee een run wordt gerangschikt, is **corpus chrF++** met het bijbehorende 95%-betrouwbaarheidsinterval. Daarnaast rapporteert de testomgeving de overige standaardmetrieken — **BLEU, spBLEU en TER**, en **COMET** indien geïnstalleerd — elk afzonderlijk, nooit samengevoegd. Al het overige is een **diagnose**: afzonderlijk gerapporteerd om een score te verklaren, maar nooit onderdeel daarvan. De onderstaande tabel behandelt chrF++ en de belangrijkste diagnoses; drie daarvan zijn taalonafhankelijk en twee zijn momenteel afhankelijk van CRK-specifieke plug-ins en zullen worden gegeneraliseerd naarmate we uitbreiden naar meer talen. De uitvoerbare referentiecorpora zijn momenteel openbaar gelicentieerde publieke sets — Global Voices, Tatoeba, TICO-19, IN22, SMOL en meer (zie [Datasets](/docs/network/leaderboard/datasets)) — en het klassement staat open voor inzendingen voor elk geregistreerd taalpaar. Plains Cree is simpelweg de taal waarvoor de twee taalspecifieke (door FST ondersteunde) metrieken voor het eerst zijn geïmplementeerd.

| Metriek | Schaal | Wat het meet | Status |
|---------|--------|--------------|--------|
| **chrF++** (hoofdscore) | 0–100 | Overlap in karakter-n-grammen tussen voorspelde en referentievertalingen, berekend over het gehele corpus met sacreBLEU (de signatuur ervan wordt vastgelegd). De standaard oppervlaktemetriek voor morfologisch rijke talen. | ✅ Alle talen |
| **Exact match** (diagnose) | 0,0–1,0 | Deel van de invoeritems waarbij de voorspelling na normalisatie exact overeenkomt met de referentie. | ✅ Alle talen |
| **FST-acceptatie** (diagnose) | 0,0–1,0 | Deel van de woorden in de uitvoer dat wordt geaccepteerd door een finite-state transducer (morfologische analysator). Wordt alleen berekend wanneer een binair FST-bestand is meegeleverd. | ✅ Alle talen met FST |
| **Equivalente match** (diagnose) | 0,0–1,0 | Fractie van de invoeritems die overeenkomt met de referentie of een acceptabele variant — rekening houdend met woordvolgorde, orthografische conventies en dialectverschillen. | ⚡ CRK (wordt gegeneraliseerd) |
| **Semantische score** (diagnose) | 0,0–1,0 | Score voor betekenisbehoud — hoe goed geeft de vertaling de bedoelde betekenis weer, ongeacht de oppervlaktevorm? | ⚡ CRK (wordt gegeneraliseerd) |

Verdere diagnoses — **morfologische nauwkeurigheid**, **code-switching**, **terminologienaleving**, **hallucinatie** en **schrijfstijl** — en de implementatiestatus van elke metriek zijn te vinden in [Scoringspecificatie §2](/docs/network/specifications/scoring#2-metric-inventory), het volledige overzicht van metrieken.

### Hoe wordt een run gescoord?

Elke nieuwe run wordt gescoord volgens de scoringsstandaard `standard/1`, zoals gebruikelijk is binnen het vakgebied voor MT-evaluaties (WMT, FLORES-200, AmericasNLP):

- **Hoofdscore:** corpus chrF++, weergegeven met het 95%-bootstrap-betrouwbaarheidsinterval en de sacreBLEU-signatuur — bijvoorbeeld `chrF++ 47.5 [45.9, 49.0]`.
- **Daarnaast:** BLEU, spBLEU, TER en COMET indien berekend. Nooit samengevoegd.
- **Diagnoses:** exact match, FST-acceptatie, morfologische nauwkeurigheid, code-switching, hallucinatie, terminologie, schrijfstijl. Afzonderlijk gerapporteerd; ze bepalen nooit de rangschikking van een run.
- **Waarschuwingen bij scores** worden direct naast de hoofdscore getoond wanneer de testomgeving een patroon detecteert dat het getal misleidend maakt.

Of de ene run **beter** is dan de andere, wordt bepaald door een gepaarde significantietoets op chrF++ (`mt-eval compare --significance`), niet door simpelweg twee getallen te vergelijken. Volledige regels: [Hoe runs worden gescoord](/docs/network/specifications/scoring#how-runs-are-scored) en de [Significantiespecificatie](/docs/network/specifications/significance).

### Wat is er gebeurd met de samengestelde score en kwaliteitsniveaus?

Beide zijn **buiten gebruik gesteld** voor nieuwe runs. De samengestelde score was een gewogen combinatie van chrF++, exact match, FST-acceptatie en andere signalen, en de niveaus (Baseline → Vloeiend) waren labels die hieruit werden afgeleid. Verschillende van deze invoerbronnen vergelijken de uitvoer nooit met de bron of referentie, waardoor een systeem het grootste deel van de score kon behalen zonder daadwerkelijk te vertalen: een ongetraind Engels→Noord-Samisch model dat voor elke invoer één geldige zin herhaalde, scoorde 0,6244 — aangeduid als "functioneel" — met een chrF++ van 5,5. Nieuwe run-kaarten publiceren `composite: null` en `quality_tier: null`.

Kaarten die vóór de invoering van de standaard zijn gepubliceerd, behouden hun opgeslagen samengestelde score en blijven controleerbaar; waar deze wordt getoond, staat deze aangeduid als **historische samengestelde score (buiten gebruik gesteld)**. Zie [waarom de samengestelde score buiten gebruik is gesteld](/docs/network/specifications/scoring#why-the-composite-was-retired).

Een automatische score is geen oordeel over de kwaliteit. Alleen een menselijke evaluatie door sprekers van de taal kan kwaliteit certificeren.

### Wat zijn verificatieniveaus?

**Verificatieniveaus** beschrijven *wie het resultaat heeft gevalideerd*, niet hoe goed het is:

| Verificatieniveau | Wat het betekent |
|-------------------|------------------|
| **Zelf gebenchmarkt** | De indiener heeft de testomgeving zelf uitgevoerd. Scores zijn aannemelijk maar niet geverifieerd. |
| **Champollion-geverifieerd** | Een beheerder heeft het resultaat gereproduceerd met behulp van de ingediende methodeconfiguratie. |
| **Gevalideerd door de gemeenschap** | Tweetalige sprekers van de doeltaal, gekwalificeerd volgens het eigen protocol van de gemeenschap, hebben een gestratificeerde steekproef van de uitvoer beoordeeld (≥30 items, ≥2 beoordelaars) en ≥70% voldeed aan de norm van de gemeenschap. Wordt uitsluitend toegekend via toetsing door de gemeenschap zelf; degradatie via steekproefcontroles is symmetrisch en eveneens openbaar. |

Een run kan een hoge chrF++ hebben en toch slechts "Zelf gebenchmarkt" zijn — wat betekent dat niemand de score onafhankelijk heeft bevestigd en geen enkele spreker de uitvoer heeft beoordeeld.

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

1. **Zelf gebenchmarkt:** Elke inzending begint hier, en op dit moment bevindt elke rij op het bord zich nog hier.
2. **Champollion-geverifieerd:** Het project scoort uw ingediende uitvoer opnieuw ten opzichte van het via SHA vastgelegde referentiecorpus met behulp van de metriek van de testomgeving. Wanneer uw score reproduceerbaar is, promoveert de run naar Champollion-geverifieerd — het niveau dat standaard wordt gebruikt voor de rangschikking in wedstrijden, en het enige niveau dat in aanmerking komt voor een prijs; op het openbare bord worden rijen met de status "zelf gebenchmarkt" ook vermeld, en als zodanig aangeduid. Als de score niet reproduceert of als een opgeslagen referentie is gewijzigd, wordt de run gediskwalificeerd. De herscoring is een batchproces van de beheerders dat handmatig wordt uitgevoerd: er is niets dat dit automatisch uitvoert bij inzending en niets dat dit inplant.
3. **Gevalideerd door de gemeenschap:** Tweetalige sprekers van de doeltaal, gekwalificeerd volgens het eigen protocol van de gemeenschap, beoordelen een gestratificeerde steekproef van de uitvoer van uw methode — ten minste 30 items, ten minste 2 beoordelaars — en ten minste 70% moet voldoen aan de norm van de gemeenschap. Dit niveau wordt uitsluitend toegekend door toetsing die de gemeenschap naar eigen inzicht zelf uitvoert, en kan op dezelfde manier worden ingetrokken: een mislukte steekproefcontrole degradeert de methode net zo openbaar. Dit kan niet worden geautomatiseerd — het vereist betrokkenheid van de gemeenschap.

### Waarom voert u niet de methode van iedereen opnieuw uit om deze te verifiëren?

Omdat we ons dat niet kunnen veroorloven en het ook niet nodig is. Het opnieuw scoren van de ingediende uitvoer van *iedereen* kost niets (daarmee worden handmatig ingevoerde of bewerkte scores opgespoord). Het daadwerkelijk opnieuw uitvoeren van een model kost aanzienlijke rekenkracht (compute), dus dat gebeurt op basis van een **steekproef** die wordt gekozen via **op reputatie gewogen audits** — het steekproefbeleid is gebouwd en getest, maar de uitvoermodule (re-runner) die hierdoor zou worden aangestuurd nog niet, waardoor er nog geen steekproefsgewijze heruitvoering heeft plaatsgevonden en een geselecteerde run wordt geregistreerd als *L2-pending*. Onder dat beleid wordt een run altijd geselecteerd als er veel op het spel staat (het slaat de eerste brug naar een volledige taalfamilie) of als deze afwijkend is (een sprong ten opzichte van de eerdere beste score die te mooi is om waar te zijn), terwijl bij bewezen bijdragers slechts zelden een steekproefcontrole plaatsvindt. Reputatie wordt uitsluitend opgebouwd door te slagen voor deze audits (of doordat een onafhankelijke bijdrager uw resultaat bevestigt) — nooit door volume — waardoor nieuwe wegwerpidentiteiten niets opleveren. Eén ontdekte vervalsing brengt de reputatie van een bijdrager terug naar nul, leidt tot een heraudit van diens gehele geverifieerde geschiedenis en wordt openbaar geregistreerd, zoals een rectificatie. We beweren **niet** dat uw run "uit de testomgeving afkomstig is" — voor lokaal gehoste rekenkracht is dat immers niet op de server te verifiëren — waardoor de geldigheid rust op *reproduceerbaarheid + reputatiebelang + bevestiging*, en niet op een verklaring vooraf. Zie de [MT-evaluatieregels](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) voor het volledige model.

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

Veel talen hebben geen finite-state transducer. Dat is geen probleem — de testomgeving werkt ook zonder. De hoofdscore is in beide gevallen chrF++, dus runs met en zonder FST worden op dezelfde manier gescoord; FST-acceptatie is een diagnose en wordt op de run-kaart gemarkeerd als `null` wanneer er geen FST is gebruikt.

De belangrijkste registers voor bestaande FST's:

| Register | Dekking | URL |
|----------|---------|-----|
| **GiellaLT** | 100+ talen — de Samische talen, Cree, Inuktitut en vele andere Oeraalse en minderheidstalen | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 taalparen, voornamelijk Europees | [apertium.org](https://apertium.org/) |
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

Voor inheemse talen activeert een methode die voldoet aan de eisen voor een prijs — de geautomatiseerde drempelwaarde en validatie door sprekers uit de gemeenschap — het proces voor [eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer) onder het standaardsjabloon. Het eigendom van de code wordt overgedragen van de onderzoeker naar de bestuursorganisatie van de taalgemeenschap.

De onderzoeker behoudt:
- Publicatierechten (academische artikelen over de methode)
- Vermelding op het leaderboard
- Het recht om dezelfde *technieken* toe te passen op andere talen

De bestuursorganisatie verkrijgt:
- Volledig eigendom van de methodecode en coachingdata
- Zeggenschap over inzet (wanneer, waar en hoe) — en alles wat een inzet oplevert. Champollion is niet-commercieel en neemt geen aandeel

### Kan ik champollion gebruiken voor niet-Inheemse talen zonder soevereiniteitsbezwaren?

Ja. Voor standaardtalen (Frans, Japans, Spaans, enz.) spelen er geen soevereiniteitskwesties. Gebruik champollion zoals gewoonlijk — vertaal, synchroniseer en publiceer zoals u wenst. Het soevereiniteitskader is specifiek van toepassing op inheemse en door de gemeenschap beheerde talen waar principes voor gegevensbeheer (data governance) — eigendom van en controle over taalgegevens door de gemeenschap, CARE, Te Mana Raraunga — bijzondere aandacht vereisen.

---

## Zie ook

- **[Hoe het werkt](https://champollion.dev/how-it-works)** — de volledige oplossingsuitleg
- **[Scoringspecificatie](/docs/network/specifications/scoring)** — de SSOT voor alle scoringlogica (statistieken, gewichten, niveaus)
- **[Benchmarkspecificatie](/docs/network/specifications/benchmark)** — evaluatieprotocol, corpusformaat, soevereiniteit
- **[Een methode indienen](/docs/network/getting-started/submit-a-method)** — stapsgewijze quickstart
- **[Leaderboard-regels](/docs/network/leaderboard/rules)** — indieningscriteria
- **[Databeheer](/docs/network/sovereignty/data-sovereignty)** — corpora blijven bij hun beheerders; elke licentie wordt gerespecteerd
