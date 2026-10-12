---
sidebar_position: 5
title: "Scoringsspecificatie"
slug: '/network/specifications/scoring'
related:
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# Scoringsspecificatie

> **Managementsamenvatting.** Dit is de centrale bron van waarheid voor hoe runs worden beoordeeld binnen het evaluatie-ecosysteem voor machinevertaling (MT) van Champollion: de ene hoofdstatistiek, de andere standaardstatistieken die daarnaast worden gerapporteerd, de diagnostische gegevens die afzonderlijk worden gerapporteerd, evenals kosten en snelheid. Runs worden beoordeeld zoals het vakgebied ze beoordeelt: **chrF++ op corpusniveau met de bijbehorende sacreBLEU-handtekening en een 95%-bootstrap-betrouwbaarheidsinterval**, daarnaast BLEU, spBLEU, TER en COMET, en gepaarde significantietoetsen om te bepalen of het ene systeem beter is dan het andere. De taalspecifieke diagnostiek (morfologische validiteit via FST, linter-equivalentieklassen, deterministische semantische validatie) wordt gezamenlijk **LYSS** (Linguistically-informed Yield & Structural Scoring) genoemd. De gewogen samengestelde score en de kwaliteitsniveaulabels die voorheen werden gebruikt, zijn **buiten gebruik gesteld** (§4, §5); hun tabellen blijven hier alleen staan zodat oude kaarten nog steeds kunnen worden geverifieerd. Code, documentatie en databaseschema's zijn afgeleid van dit document. Bij tegenstrijdigheden is dit document maatgevend.
>
> **Toepassingsgebied.** Dit document definieert *wat* we meten en *hoe we dit beoordelen*. Het definieert niet het schema voor run-cards (zie BENCHMARK_SPEC §3), het benchmarkprotocol (BENCHMARK_SPEC §6) of de regels van het leaderboard (zie arena-documentatie). Die documenten verwijzen naar dit document voor metrische definities en scoringslogica.


---

## Hoe runs worden beoordeeld {#how-runs-are-scored}

Elke nieuwe run wordt beoordeeld onder **beoordelingsstandaard `standard/1`**. De run-card geeft dit aan: `scores.scoring_standard` is `"standard/1"` en `scores.primary_metric` is `"chrf_plus_plus"`.

| Rol | Wat | Waar het verschijnt |
|------|------|------------------|
| **Hoofd- en rangschikkingsstatistiek** | **chrF++** op corpusniveau (sacreBLEU chrF met `word_order=2`), 0–100, met het 95%-bootstrap-betrouwbaarheidsinterval en de bijbehorende sacreBLEU-handtekening | Geschreven als `chrF++ 47.5 [45.9, 49.0]`, gevolgd door de handtekening. Run-card: `scores.chrf_plus_plus`, het BI in `scores.confidence_intervals.corpus_chrf`, de handtekening in `scores.sacrebleu_signatures.chrf`. Database: `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **Andere standaardstatistieken** | BLEU, spBLEU (FLORES-200 SentencePiece), TER, en COMET wanneer deze is berekend | Weergegeven naast chrF++, elk met zijn handtekening of COMET-model-ID. Nooit samengevoegd met chrF++ of met elkaar. |
| **Diagnostiek** | Exacte overeenkomst, FST-acceptatie, morfologische nauwkeurigheid, codewisseling, hallucinatie, terminologienaleving, schrijfstijl en elk scorevoorbehoud (§2.8) | Afzonderlijk gerapporteerd en gelabeld als diagnostiek. Ze maken nooit deel uit van een hoofdcijfer en bepalen nooit de rangorde van een run. Voorbehouden blijven prominent zichtbaar naast het hoofdcijfer. |
| **Kosten en snelheid** | Tokens, dollars, latentie (§6, §7) | Gerapporteerd naast de score, er nooit mee gecombineerd. |

**Bepalen wat "beter" is.** Twee runs op dezelfde evaluatieset worden vergeleken met een gepaarde significantietoets op chrF++ (standaard approximatieve randomisatie, gepaarde bootstrap-hertoetsing als optie; §8.2). De andere standaardstatistieken worden eveneens getoetst en getoond. Een verschil dat niet significant is, wordt gerapporteerd als niet significant, ongeacht wat de twee getallen zijn.

**Geen kwaliteitslabels.** Een automatische score is geen oordeel over kwaliteit. Nieuwe kaarten bevatten geen niveau en geen label zoals "functioneel" of "inzetbaar"; alleen menselijke evaluatie door sprekers certificeert kwaliteit ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**Wat buiten gebruik is gesteld.** Nieuwe kaarten publiceren `composite: null`, `quality_tier: null` en `cost_adjusted: null` (de kostengecorrigeerde score was de samengestelde score gedeeld door een kostenfactor; de kosten zelf worden nog steeds gerapporteerd). Geen enkele nieuwe uitvoer toont een samengestelde score of een niveau. Kaarten die vóór de standaard zijn gepubliceerd, behouden hun opgeslagen samengestelde score en blijven verifieerbaar: de verificateur leidt een kaart zonder `scoring_standard` opnieuw af met de verouderde berekening (§4), en een `standard/1`-kaart door chrF++ opnieuw af te leiden. Waar de samengestelde score van een oude kaart nog wordt getoond, staat deze gelabeld als **verouderde samengestelde score (buiten gebruik)**.

**Waarom dit de standaard is.** Dit is hoe het vakgebied over MT-evaluatie rapporteert:

- **WMT** rangschikt zijn shared-task-systemen op basis van menselijke evaluatie en rapporteert daarnaast automatische statistieken met sacreBLEU-handtekeningen, zodat de cijfers kunnen worden gereproduceerd (Post 2018; Kocmi et al. 2024).
- **FLORES-200** (NLLB Team 2022) rapporteert chrF++ en spBLEU voor 200 talen, waarvan de meeste laagbebrond zijn.
- Shared tasks van **AmericasNLP** over vertaling naar inheemse talen van Amerika rangschikken systemen op basis van chrF (Mager et al. 2021; Ebrahimi et al. 2023), omdat karakter-n-grammen beter omgaan met een rijke morfologie dan BLEU op woordniveau (Popović 2015, 2017).
- Kocmi et al. (2021), die automatische statistieken vergeleken met duizenden menselijke beoordelingen, ontdekten dat de omvang van een verschil in statistiek en de statistische significantie ervan bepalend zijn voor het voorspellen van menselijke voorkeur; daarom zijn vergelijkingen hier gepaarde significantietoetsen (Koehn 2004; Riezler & Maxwell 2005), en niet twee getallen naast elkaar.

**Wedstrijden.** De kwalificatie voor een wedstrijd is uitsluitend chrF++, op een schaal van 0–100, en de `primary_metric` van een wedstrijd is standaard `chrf_plus_plus`. Een nieuwe wedstrijd die vraagt om `composite` als statistiek wordt gemotiveerd geweigerd; wedstrijden die vóór de standaard zijn aangemaakt, blijven werken. Een organisator kan in de prijsvoorwaarden nog steeds diagnostische drempels instellen (bijvoorbeeld een minimale FST-acceptatie), als voorwaarden waaraan een inzending moet voldoen, nooit als de score ([Prijzenspecificatie](/docs/network/specifications/prizes)).

**De standaard wijzigen.** De hoofdstatistiek verandert alleen bij een nieuwe versie van de standaard (`standard/2`). Elke kaart vermeldt de standaard waaronder deze is beoordeeld en wordt volgens die standaard geverifieerd.

---

## 1. Scoringsfilosofie

### 1.1 Microeval-filosofie

> *"Als we ons alleen richten op wat generaliseert, zullen we onvermijdelijk vergeten waar dat niet het geval is — en deze talen en al hun kennis en wijsheid verliezen."*

Dit project hanteert **microeval-ontwikkeling**: het bouwen van evaluatiemetrieken die zijn afgestemd op specifieke talen met behulp van de beste beschikbare linguïstische hulpmiddelen — eindige-toestandstransducers, tweetalige woordenboeken, morfologische analysatoren en door taalkundigen samengestelde equivalentieregels. Dit is het tegenovergestelde van het dominante paradigma in MT-evaluatie, dat streeft naar universele metrieken die voor alle talen werken. Universele metrieken zijn waardevol, maar ze zijn het zwakst precies waar ze het meest nodig zijn: voor talen met complexe morfologie, beperkte trainingsdata en geen vertegenwoordiging in neurale metriek-trainingssets.

We boeken niet alleen geen vooruitgang in machinevertaling voor veel talen in de wereld omdat we corpora missen, maar ook omdat **we niet eens weten hoe vooruitgang eruitziet** — we missen de geautomatiseerde evaluatietools om te meten of een vertaalsysteem verbetert. LYSS is onze poging om die tools te bouwen, taal voor taal, met behulp van welke linguïstische middelen er ook beschikbaar zijn.

### 1.2 Geautomatiseerde metrieken zijn benaderingen

Elke hier gedefinieerde statistiek wordt computergestuurd berekend. Ze zijn nuttig voor snelle iteratie, systematische vergelijking en het opsporen van regressies. Ze zijn **geen vervanging voor menselijk oordeel**; daarom draagt geen enkele automatische score een kwaliteitslabel — alleen menselijke beoordeling kan de daadwerkelijke bruikbaarheid bevestigen.

### 1.3 Eén hoofdstatistiek, vele signalen

Geen enkele afzonderlijke statistiek omvat de volledige vertaalkwaliteit. Een vertaling kan een hoge chrF++-overlap hebben, maar zakken voor morfologische validatie. Ze kan FST-controles doorstaan, maar de verkeerde betekenis dragen. Ze kan semantisch nauwkeurig zijn, maar stilistisch vreemd aanvoelen voor de doeltaal. Daarom rapporteert elke run vele signalen — maar slechts één daarvan, chrF++, is de hoofd- en rangschikkingsstatistiek, en de andere worden daarnaast weergegeven, nooit erin samengevoegd. Een samenvoeging van signalen die voor verschillende talen verschillende betekenissen hebben, kan worden gemanipuleerd door een systeem dat goed scoort op de goedkope signalen (§4 legt vast hoe dat bij de buiten gebruik gestelde samengestelde score gebeurde), en een lezer kan uit een samengevoegd getal niet afleiden welk signaal is veranderd.

### 1.4 Uitbreidbaarheid

Deze inventaris van statistieken is niet definitief gesloten. Nieuwe talen brengen nieuwe vereisten met zich mee: toonnauwkeurigheid voor toontalen, diakritische precisie voor Semitische schriften, syllabische correctheid voor Cree. De architectuur (het MetricPlugin-protocol) maakt het mogelijk om diagnostiek toe te voegen zonder dat een hoofdscore verandert. Taalspecifieke statistieken (bijv. de linter en semantische validator voor CRK) worden op taalkaarten gedeclareerd onder `evalMetrics` en geladen vanuit `eval_standards/` — het testharnas wordt standaard alleen geleverd met algemene gedragsstatistieken (codewisseling, hallucinatie, terminologie).

### 1.5 Drie dimensies van evaluatie

Elke run card meet drie onafhankelijke dimensies:

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

Dit zijn onafhankelijke assen. Een methode kan goed scoren maar duur zijn, snel zijn maar onnauwkeurig, of een willekeurige combinatie hiervan. Het leaderboard maakt sorteren op elke dimensie mogelijk. Geen enkel gepubliceerd getal combineert ze (de kostengecorrigeerde score die dat wel deed, §6.3, is buiten gebruik gesteld).

### 1.6 Validatiestatus

Elke metriek in deze specificatie heeft een **validatiestatus** die losstaat van de implementatiestatus (§3). De implementatiestatus geeft aan of er code bestaat. De validatiestatus geeft aan of is aangetoond dat de metriek correleert met menselijke kwaliteitsoordelen.

| Validatieniveau | Betekenis | Huidige metrieken |
|-----------------|-----------|-------------------|
| **✅ Extern gevalideerd** | Gepubliceerde studies naar menselijke correlatie bestaan (WMT, academische artikelen) | `chrf_plus_plus`, `bleu`, `comet_score` *(alleen voor taalcombinaties met veel middelen)* |
| **⚡ Proxy-gevalideerd** | Gevalideerd voor talen met veel middelen; niet gevalideerd voor onze doeltalen met weinig middelen | `comet_score` *(voor LRL's: gevalideerd op taalcombinaties met veel middelen/EU-paren, geëxtrapoleerd naar bijv. CRK — richtinggevend nuttig maar niet gekalibreerd)* |

| **🔶 Technische heuristiek** | Ontworpen vanuit taalkundige principes of waargenomen foutpatronen; geen correlatiegegevens met menselijke beoordelingen | `fst_acceptance_rate`, `morphological_accuracy` (afgeleid van FST, op lemma gematcht, opnieuw afgeleid door verificateur), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Niet-gevalideerd** | Nog niet getest op data | `orthographic_accuracy`, `consistency_score` |

> **Waarom `comet_score` in twee rijen voorkomt.** Dit is een uitsplitsing naar bebronningsniveau, geen tegenstrijdigheid. COMET is *extern gevalideerd* waar WMT-correlatiestudies met menselijke oordelen bestaan — hoogbebronde, veelal Europese talenparen. Voor onze doelgroep van laagbebronde talen bestaan dergelijke studies niet, waardoor dezelfde statistiek slechts *proxy-gevalideerd* is: het model extrapoleert vanuit talen met andere morfologische systemen. Het wordt naast chrF++ weergegeven met het model-ID en een kalibratievoorbehoud, nooit ermee samengevoegd.

> **Wat dit in de praktijk betekent.** Het hoofdcijfer (chrF++) is een extern gevalideerde statistiek, gebruikt zoals het vakgebied deze gebruikt. Elke bovenstaande technische heuristiek is een **diagnostisch gegeven**: het kan verklaren *waarom* een run zo heeft gescoord (de woorden zijn geen geldige vormen, de uitvoer schakelde over naar het Engels), maar het is nooit een score en rangschikt nooit een run. De buiten gebruik gestelde samengestelde score (§4) nam heuristieken op alle validatieniveaus op in het hoofdcijfer, waardoor een systeem het grootste deel ervan kon behalen zonder daadwerkelijk te vertalen (§4).
>
> **Vereiste validatie-experimenten** (zie `mt-evaluation-landscape.md` §6 en `speaker-validation.md`):
> 1. Correlatiestudie met menselijke oordelen: 200+ zinnenparen beoordeeld door 3+ tweetalige sprekers
> 2. Meting van het FST-fout-negatief-percentage (false rejection rate) op een representatief corpus
> 3. Overzetting naar een tweede taal (Noord-Samisch) om generalisatie te testen
> 4. Directe vergelijking met COMET op dezelfde data


---

## 2. Metriekinventaris {#2-metric-inventory}

Statistieken zijn onderverdeeld in zes categorieën (oppervlakte, structureel, semantisch, gedrag, conformiteit en gerapporteerde vergelijkingsstatistieken). Elke statistiek heeft een implementatiestatus, schaal en niveau (per invoeritem, op corpusniveau of beide), en een van de drie rollen onder de standaard: **hoofdstatistiek** (alleen chrF++), **standaard** (BLEU, spBLEU, TER, COMET — weergegeven naast de hoofdstatistiek) of **diagnostiek** (al het overige — afzonderlijk gerapporteerd).

### 2.1 Oppervlaktemetrieken

Oppervlaktemetrieken vergelijken de voorspelde vertaling met de referentievertaling op tekenreeksniveau. Ze vereisen geen linguïstische hulpmiddelen — alleen tekenreeksvergelijking.

| ID | Statistiek | Status | Schaal | Niveau | Implementatie |
|----|------------|--------|--------|--------|---------------|
| `exact_match_rate` | Exacte overeenkomst | ✅ Geïmplementeerd | 0.0–1.0 | Beide | **Diagnostiek.** Binair: is voorspeld == referentie? Corpuspercentage = overeenkomsten / totaal. |
| `equivalent_match_rate` | Equivalente overeenkomst | ⚡ Gedeeltelijk | 0.0–1.0 | Beide | **Diagnostiek.** Komt de voorspelde uitvoer overeen met een van de geaccepteerde varianten? Voor CRK: geïmplementeerd via de `CrkLinterMetric` van de CRK-evaluatiestandaard (in `eval_standards/crk/`) met behulp van deterministische regels voor variantklassen (woordvolgorde, orthografie, optioneel partikel, lemmasynoniem, progressieve ambiguïteit). Automatisch geladen via de declaratie `evalMetrics` van de CRK-taalkaart. Generieke meertalige implementatie vereist `variants[]` per item in het corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Geïmplementeerd | 0–100 | Beide | **Hoofd- en rangschikkingsstatistiek.** Karakter-n-gram-F-score met woord-unigrammen en -bigrammen (sacreBLEU chrF, `word_order=2`; Popović 2017). Robuust tegen morfologische variatie. De gepubliceerde waarde is op corpusniveau (`corpus_chrf`), met een 95%-bootstrap-BI en de bijbehorende sacreBLEU-handtekening; waarden per invoeritem (`sentence_chrf`) voeden de significantietoetsen. |
| `bleu` | BLEU | ✅ Geïmplementeerd | 0–100 | Corpus | **Standaardstatistiek, weergegeven naast chrF++** (run-card en database `corpus_bleu`, met bijbehorende sacreBLEU-handtekening). Precisie van n-grammen op woordniveau (Papineni et al. 2002). Niet de hoofdstatistiek omdat vergelijking op woordniveau een correct woord met een ander achtervoegsel als een volledige misser telt, wat morfologisch rijke talen benadeelt. |
| `ter` | Translation Edit Rate | ✅ Geïmplementeerd | 0–∞ (lager is beter) | Beide | **Standaardstatistiek, weergegeven naast chrF++** (`scores.ter`, met bijbehorende sacreBLEU-handtekening). Minimale bewerkingsafstand tussen voorspelling en referentie, genormaliseerd door referentielengte (sacreBLEU `corpus_ter`; Snover et al. 2006). |
| `length_ratio` | Lengteverhouding | ✅ Geïmplementeerd | 0–∞ (1.0 is ideaal) | Beide | **Diagnostiek.** `len(predicted) / len(reference)` in tekens. Detecteert afkapping (<0.5) en inflatie/hallucinatie (>2.0). Gemiddeld over alle items op corpusniveau. |

### 2.2 Structurele metrieken

Structurele metrieken valideren de linguïstische welgevormdheid van de vertaling. Ze vereisen taalspecifieke hulpmiddelen (FST-analysatoren, morfologische parsers) en zijn de sterkste signalen voor morfologisch rijke talen.

| ID | Statistiek | Status | Schaal | Niveau | Implementatie |
|----|------------|--------|--------|--------|---------------|
| `fst_acceptance_rate` | FST-acceptatie | ✅ Geïmplementeerd | 0.0–1.0 | Beide | **Diagnostiek.** Acceptatie van uitvoerwoorden door een finite-state transducer (GiellaLT). Een woord is "geldig" als de FST ten minste één morfologische analyse oplevert. **Aggregatie:** de gepubliceerde corpuswaarde is het **gemiddelde van de percentages per item** — geaccepteerde woorden per item ÷ aantal woorden, gemiddeld over de items die de FST heeft geanalyseerd, waarbij een lege uitvoer telt als 0 (de `avg_fst_validity` van de plugin). Het samengevoegde woordpercentage (alle geaccepteerde woorden ÷ alle woorden, `corpus_validity_rate`) wordt daarnaast gerapporteerd in het run-rapport en op de run-card, maar is niet de gepubliceerde waarde; de twee verschillen wanneer items in lengte variëren. Beschikbaar voor elke taal met een GiellaLT-`.hfstol`-analysator. **Hoofdlettergebruik:** een woord wordt opgezocht zoals geschreven; als de FST het weigert en het begint met een hoofdletter, wordt het opnieuw opgezocht met een kleine beginletter (`Mun` → `mun`), en een woord dat VOLLEDIG IN HOOFDLETTERS staat eerst als Titlecase en vervolgens in kleine letters (`OSLO` → `Oslo`, `GIITU` → `giitu`). Nooit andersom: een eigennaam geschreven in kleine letters (`oslo`) blijft geweigerd. De spellingcontrole-acceptors van GiellaLT (Noord-Samisch, Amhaars, Baskisch) en de strikte Plains Cree-analysator van ALTLab vermelden de meeste woorden alleen in kleine letters en laten hoofdlettergebruik over aan het omliggende programma; zonder dit mechanisme telde een correcte hoofdletter aan het begin van een zin als een ongeldig woord. Dit betreft berekeningsversie `case-fallback/1`, vermeld in het rapport (`fst_acceptance_method`, met `total_case_folded_words` en `fst_case_folded_words` van elk item) en op de run-card (`fst_provenance.acceptance_method`). Een rapport zonder deze vermelding werd hoofdlettergevoelig beoordeeld en scoort lager bij tekst met hoofdletters; `mt-eval compare` geeft dit aan wanneer de twee worden vergeleken, en `mt-eval test <run log>` berekent de score van een oude run opnieuw. De verificateur leidt de van FST afgeleide cijfers van een gepubliceerde kaart opnieuw af met de methode die de kaart vermeldt, en voor een kaart zonder vermelding gebeurt dit hoofdlettergevoelig, zodat een kaart wordt gecontroleerd aan de hand van de berekening waarmee deze is gepubliceerd. |
| `morphological_accuracy` | Morfologische nauwkeurigheid | ✅ Geïmplementeerd (opnieuw afgeleid door verificateur) | 0.0–1.0 | Beide | **Diagnostiek.** Een woord kan FST-geldig zijn, maar de verkeerde verbuiging/vervoeging hebben (juiste stam, verkeerd achtervoegsel). **Berekend** door `plugins/giellalt_fst.py`: zoek voor elk analyseerbaar voorspeld woord een referentiewoord met hetzelfde **lemma** (stam) en controleer of de voorspelde **buigingsvorm** (FST-kenmerktags) overeenkomt. Overeenkomen op basis van lemma — niet op positie — omzeilt woorduitlijning: een andere woordkeuze of een verkeerd uitgelijnd paar valt simpelweg buiten het *bereik* (wordt nooit onjuist beoordeeld). **Geen gouden annotaties nodig** — de FST-analyse van de referentie *is* de ground truth. Woorden die de FST niet kan analyseren of waarvan de stam niet in de referentie voorkomt, vallen buiten de dekking; `morph_coverage` (de fractie die op lemma is gematcht) wordt vermeld, en onder `MORPH_COVERAGE_FLOOR` (0,25) wordt de waarde als adviserend gemarkeerd. De statistiek is **clement bij FST-ambiguïteit** (een voorspeld woord met meerdere analyses is "correct" als er *één* overeenkomt → een bovengrens, die wordt vermeld). Er is een **analysator** voor nodig: een FST die slechts een spellingcontrole-**acceptor** is (de Divvun-spellerpakketten die zijn geïnstalleerd voor Noord-Samisch, Amhaars en Baskisch) geeft aan of een woord bestaat, maar levert geen lemma of tags. Voor die talen zijn `morphological_accuracy` en `morph_coverage` null en legt `metric_availability` uit waarom; FST-acceptatie wordt nog steeds gerapporteerd. De FST-pin declareert dit (`kind: "acceptor"`), en de statistiek detecteert ook een transducer die nooit een tag retourneert. Deze wordt **opnieuw afgeleid door de verificateur** ten opzichte van het canonieke corpus (`verifier.recompute_corpus_morph`, waarmee de aan de kaart gekoppelde FST opnieuw wordt uitgevoerd — fail-closed als de FST ontbreekt, hetzelfde contract als bij COMET). Onder de buiten gebruik gestelde samengestelde score had dit een gewicht van 0,15 in het fst-coverage-profiel (§4.3). |
| `orthographic_accuracy` | Orthografische nauwkeurigheid | 🔲 Gepland | 0.0–1.0 | Beide | **Diagnostiek (gepland).** Valideert schrift-specifieke correctheid: SRO-macron-/circumflexgebruik voor Cree, diakritische tekens voor Inuktitut, klinkerslengtemarkeringen voor Ojibwe. Regelsets per taal. |

> **Wat structurele statistieken toevoegen en waarom het diagnostische gegevens zijn.** Meta's OMT-1600 — het grootste MT-systeem dat ooit is gepubliceerd (1.600 talen; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — evalueert met ChrF++, xCOMET, MetricX en BLASER 3. Geen van deze valideert morfologische correctheid: chrF++ meet overlap van karakter-n-grammen en beloont reeksen die *lijken* op de referentie, zodat een morfologisch ongeldig woord dat veel tekens deelt met de referentie toch punten krijgt. FST-acceptatie beantwoordt een andere vraag: is elk woord een geldige vorm in de taal? Dat maakt het een nuttige diagnostiek voor polysynthetische talen. Het is geen vertaalscore: het kijkt nooit naar de bron of de referentie, dus een systeem dat voor elke invoer dezelfde geldige zin uitvoert, slaagt hier volledig voor (§4 toont de gemeten casus). ChrF++ heeft bovendien een **kans-ondergrens (chance floor) groter dan nul** die verschilt per orthografie — willekeurige tekst in hetzelfde schrift scoort meetbaar boven nul, bij sommige schriftsystemen meer dan bij andere — waardoor ruwe chrF++ niet vergelijkbaar is tussen verschillende talen; het rangschikt systemen uitsluitend binnen dezelfde evaluatieset. De netwerkkaart rangschikt daarom de sterkte tussen talen **helemaal niet** — een verbindingsboog betekent enkel dat het paar is gemeten, niets meer. De correctie voor de kans-ondergrens die we hiervoor hebben ontwikkeld (cchrF++) is gepubliceerd onderzoek en is aan geen enkele publieke interface gekoppeld; [Verbindingssterkte](/docs/network/specifications/connection-strength) legt uit wat dit wel en niet aantoont.

### 2.3 Semantische metrieken

Semantische metrieken meten betekenisbehoud met behulp van inbeddingen of aangeleerde modellen. Ze detecteren vertalingen die oppervlakkig verschillend maar betekenismatig equivalent zijn, en markeren vertalingen die oppervlakkig gelijkend maar semantisch onjuist zijn.

| ID | Statistiek | Status | Schaal | Niveau | Implementatie |
|----|------------|--------|--------|--------|---------------|
| `semantic_score` | Semantische overeenkomst | ⚡ Gedeeltelijk | 0.0–1.0 | Beide | **Diagnostiek.** CRK: score gewogen naar oordeel vanuit de `CrkSemanticMetric` van de CRK-evaluatiestandaard (in `eval_standards/crk/`, proxy). Universeel: cosinus-overeenkomst van zins-embeddings (bron + voorspelling versus bron + referentie). Model nog te bepalen — moet laagbebronde talen ondersteunen, wat de meeste op het Engels gerichte embedding-modellen uitsluit. |
| `comet_score` | COMET | ✅ Geïmplementeerd | ~0.0–1.0 | Beide | **Standaardstatistiek indien berekend, weergegeven naast chrF++ met bijbehorend model-ID** (`comet_model`). Getrainde evaluatiestatistiek voor machinevertaling (Rei et al. 2020). Nooit samengevoegd met chrF++. Wordt opnieuw afgeleid door de verificateur, dus een gerapporteerde waarde moet reproduceerbaar zijn. Voorzien van een kalibratievoorbehoud voor laagbebronde talen zoals Plains Cree. Berekend wanneer `unbabel-comet` is geïnstalleerd. Voor 35 Afrikaanse talen selecteert het testharnas automatisch AfriCOMET (`masakhane/africomet-mtl`) via `resolve_comet_model()`, wat een betere correlatie heeft met menselijke oordelen voor die talen. |

> **Waarom COMET naast de hoofdstatistiek staat en niet de hoofdstatistiek is.** COMET is getraind op menselijke evaluatiedata van WMT, overwegend hoogbebronde Europese talenparen. Voor echt hoogbebronde paren (Duits, Frans, …) is de standaard `Unbabel/wmt22-comet-da` goed gevalideerd door WMT, en `resolve_comet_model()` selecteert deze. Toegepast op Plains Cree of andere LRL's (talen met weinig bronnen) extrapoleert het model vanuit talen met andere morfologische systemen — indicatief nuttig maar niet gekalibreerd, en dat wordt op de kaart vermeld. Het vereist bovendien een model van 2,3 GB, waardoor het niet voor elke run wordt berekend. chrF++ is voor elke taal uitsluitend reproduceerbaar vanuit het corpus, en daarom is het de hoofdstatistiek en wordt COMET daarnaast gerapporteerd wanneer deze is berekend.

> **AfriCOMET voor Afrikaanse talen.** Elke taalkaart heeft een `metricModelSupport`-veld (zie taalkaartspecificatie §9) dat aangeeft welke gespecialiseerde COMET-modellen zijn getraind voor die taal. Voor 35 Afrikaanse talen (yor, hau, ibo, amh, swa, enz.) declareert de kaart AfriCOMET (`masakhane/africomet-mtl`) — een COMET-model dat is verfijnd op menselijke oordelen over Afrikaanse taal-MT door de Masakhane-gemeenschap. Het harnas selecteert automatisch het aanbevolen model via `resolve_comet_model()` dat taalkaarten leest, maar dit kan worden overschreven met `--comet-model`. Het toevoegen van nieuwe taal→model-koppelingen gebeurt door de taalkaart te verrijken (niet door Python-code te bewerken).

### 2.4 Gedragsmetrieken

Gedragsstatistieken detecteren specifieke foutpatronen in vertaaluitvoer. Ze meten kwaliteit niet direct — ze detecteren problemen. Ze zijn stuk voor stuk **diagnostiek**.

| ID | Statistiek | Status | Schaal | Niveau | Implementatie |
|----|------------|--------|--------|--------|---------------|
| `code_switching_rate` | Codewisselingspercentage | ✅ Geïmplementeerd | 0.0–1.0 (lager is beter) | Beide | Aandeel woorden in de uitvoer dat in de brontaal staat (meestal Engels). Gedetecteerd via Unicode-schriftanalyse en/of een brontaalwoordenlijst. Zeer veelvoorkomend foutpatroon bij LLM's: het model voegt Engelse woorden in wanneer het het equivalent in de doeltaal niet kent. |
| `hallucination_rate` | Hallucinatiepercentage | ✅ Geïmplementeerd | 0.0–1.0 (lager is beter) | Beide | Aandeel van de inhoud in de uitvoer dat geen overeenkomstige broninhoud heeft. Gedetecteerd via woorduitlijning of meertalige embedding-overlap. Detecteert wanneer het model aannemelijk klinkende maar verzonnen vertalingen genereert. |
| `terminology_adherence` | Terminologienaleving | ✅ Geïmplementeerd | 0.0–1.0 | Beide | Voor methoden met coaching: aandeel van voorgeschreven terminologietermen dat in de uitvoer voorkomt. Vereist een woordenlijst (`{"source term": "translation"}`, of een lijst van geaccepteerde vertalingen per term). De bron is `--glossary <file.json>`, een evaluatie-invoer die nooit naar het model wordt gestuurd en aan elke vergeleken run wordt meegegeven. Anders is het het `dictionary`-object van een JSON-`--coaching-file`: de run wordt dan beoordeeld aan de hand van zijn eigen coaching, en dat vermeldt de run-uitvoer. Zonder een van beide is de statistiek inactief (null). Meet of het model door experts aangeleverde woordenschat respecteert. |
| `consistency_score` | Consistentie over items heen | 🔲 Gepland | 0.0–1.0 | Alleen corpus | Vertaalt het model dezelfde bronterm op dezelfde manier over verschillende items heen? Een lage consistentie suggereert dat het model gokt in plaats van geleerde patronen toe te passen. Vereist herhaalde termen in de corpusitems. |

### 2.5 Compliancemetrieken

Conformiteitsstatistieken valideren of vertalingen de structurele integriteit behouden — tijdelijke aanduidingen (placeholders), opmaak en typografische conventies. Het zijn kwaliteitscontroles (quality gates), geen kwaliteitsscores, en onder de standaard gelden ze als diagnostiek.

| ID | Statistiek | Status | Schaal | Niveau | Implementatie |
|----|------------|--------|--------|--------|---------------|
| `compliance_index` | Conformiteit na dubbele doorgang | 🔲 Gepland | 0.0–1.0 | Beide | Gewogen samengestelde score: 60% variabele-integriteit (zijn `{placeholder}`-variabelen behouden?) + 20% aanhalingsteken-conformiteit (de aanhalingstekens van de doeltaal) + 20% hoofdletter-conformiteit (geen lekkage van Latijnse letters bij talen zonder hoofdletters). Berekend op zowel ruwe als nabewerkte uitvoer. Er bestaat een `DoublePassCompliancePlugin`-klasse, maar geen enkele evaluatierun laadt deze, en er is nog geen geciteerde bron voor aanhalingsteken- en hoofdletterconventies per taal. Taalkaarten bevatten deze niet. Zonder die bron meet alleen de variabele-integriteitsterm iets. |
| `repair_effectiveness` | Hersteleffectiviteit | 🔲 Gepland | 0.0–1.0 | Corpus | Aandeel conformiteitsschendingen dat automatisch is hersteld door hooks na vertaling. Meet hoeveel de quality gate de ruwe uitvoer heeft verbeterd. Gepland om dezelfde reden als `compliance_index`. |

> **Waarom conformiteit een drempel (gate) is en geen score.** Conformiteitsstatistieken meten structureel behoud (placeholders, aanhalingstekens), niet de vertaalkwaliteit. Een vertaling kan taalkundig perfect zijn, maar niet voldoen aan de conformiteit omdat een `{name}`-variabele is weggelaten. Ze zijn ontworpen als kwaliteitsdrempels om te voorkomen dat slechte uitvoer wordt geleverd, niet om vertaalkwaliteit te rangschikken.

### 2.6 Gerapporteerde vergelijkingsstatistieken

spBLEU is een van de standaardstatistieken die naast chrF++ worden weergegeven; gewone chrF en de vergelijker in FUSE-stijl worden gerapporteerd ter vergelijking met andere gepubliceerde tabellen. Geen van deze wordt met iets samengevoegd:

| ID | Statistiek | Status | Opmerkingen |
|----|------------|--------|-------------|
| `spbleu` | spBLEU (FLORES-200 tokenizer) | ✅ Geïmplementeerd | **Standaardstatistiek, weergegeven naast chrF++** (`scores.spbleu`, met bijbehorende sacreBLEU-handtekening). BLEU op de FLORES-200 SentencePiece-tokenisatie (Goyal et al. 2022) — vergelijkbaar over schriften/segmentatie heen (de NLLB/FLORES lingua franca). Vereist `sentencepiece` (kernafhankelijkheid). |
| `chrf_plain` | Gewone chrF (`word_order=0`) | ✅ Geïmplementeerd | Het chrF-getal dat AmericasNLP en veel WMT-tabellen rapporteren, naast ons chrF++-hoofdcijfer (`word_order=2`). De bijbehorende handtekening is `sacrebleu_signatures.chrf_plain`. |
| `fuse_score` | Vergelijker in FUSE-stijl | ⚡ Opt-in (`--fuse`) | Een **ONGETRAINDE herimplementatie** van de AmericasNLP-2025 FUSE-aanpak (Raja & Vats): LaBSE semantisch + lexicale token-F1 + fonetische Soundex + fuzzy difflib, gecombineerd als een *ongewogen gemiddelde* (we hebben geen trainingsdata met menselijke oordelen om de oorspronkelijke Ridge/GBM te fitten, en vermelden dat ook). LaBSE/Soundex vormen het optionele `fuse`-extra; zonder LaBSE retourneert `compute_fuse` `None` (aangegeven) in plaats van een score te simuleren. Elk onderdeel dat is uitgevoerd, wordt vermeld in `fuse_components`; het resultaat is gemarkeerd als `fuse_untrained=true`. Uitsluitend een diagnostische vergelijker. |

### 2.7 Metrieknaamruimten {#2-7-metric-namespaces}

Een enkele metriek heeft tot vier gecoördineerde namen in de stack: de
**canonieke id** (de `scores`-sleutel in een run card, bijv. `equivalent_match_rate`),
de Python-**pluginnaam** die deze berekent (bijv. `crk_linter`), de taalkaart-
**`evalMetrics`-sleutel** die deze declareert (bijv. `lyss-eq`), en de gedenormaliseerde
**`run_cards`-kolom** op het leaderboard (bijv. `equivalent_match_rate`). Deze zijn
bewust onderscheiden — de pluginnaam geeft het *hulpmiddel* aan, de metriek-id geeft de
*meting* aan — maar ze moeten gesynchroniseerd blijven.

De centrale bron van waarheid voor die toewijzing is `shared/metric-registry.json`, geladen
door `mt_eval_harness.metric_manifest`. Elk item registreert de vier namen plus `scale`,
`direction` (hoger/lager/neutraal), `level` (item/corpus/beide), `in_composite`
(of het onderdeel was van de buiten gebruik gestelde samengestelde score; bewaard voor het verifiëren van oude kaarten), en
`verifier_reproducible`. Een gelijkheidstest faalt als de tabellen van `scoring.py` of de
run-card-sleutels van `scores` die door `publish.py` zijn gegenereerd afwijken van het register, zodat een nieuwe
statistiek niet half geïmplementeerd kan worden uitgebracht.

Twee gerelateerde run card-velden maken metriekherkomst expliciet:

- **`scores.metric_availability`** — een `{metric: reason}`-blok dat verduidelijkt waarom een
  score `null` is: `not_applicable` (de taal/run gebruikt deze niet), `unavailable`
  (een optionele afhankelijkheid ontbrak), `below_coverage_floor` (aanwezig maar te
  schaars om meer dan adviserend te zijn), `not_run` (opt-in en niet aangevraagd), of
  `not_implemented` (gepland). Een statistiek die niet in het blok staat, is normaal berekend.
- **`fst_version`** / **`fst_provenance`** — de geïnstalleerde GiellaLT-transducer-release
  en `pyhfst`-versie achter elke van FST afgeleide statistiek, op dezelfde manier
  vastgelegd als de sacreBLEU-handtekeningen, zodat een structurele score kan worden herleid naar een exacte
  analysator-build. `fst_provenance.acceptance_method` vermeldt hoe acceptatie werd
  berekend op basis van de antwoorden van de transducer (`case-fallback/1`, §1); een kaart zonder
  deze vermelding werd hoofdlettergevoelig beoordeeld.
- **`scores.sacrebleu_signatures`** — de sacreBLEU-handtekening van elke
  sacreBLEU-statistiek die de run heeft berekend: `chrf` (het chrF++-hoofdcijfer,
  `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. Twee chrF++-getallen zijn
  alleen vergelijkbaar wanneer hun handtekeningen overeenkomen (Post 2018).

### 2.8 Scorevoorbehouden {#2-8-score-caveats}

Een score kan correct berekend zijn en toch niet betekenen wat het label suggereert. Het
testharnas controleert elke run op de bekende manieren waarop dit gebeurt en, wanneer er een optreedt,
wordt dit afgedrukt naast de hoofdstatistiek in de testsamenvatting, `mt-eval compare`, de
publicatievoorvertoning en het dashboard, en de gepubliceerde kaart bevat dit als
`score_caveats` zodat het leaderboard dit ook toont. Een voorbehoud verandert nooit een score;
het geeft aan wat de beperkingen ervan zijn. Elk voorbehoud is een diagnostiek met een `severity` (`major` of
`minor`) en een bericht van één zin dat aantallen noemt, nooit de uitvoer
zelf.

| Voorbehoud | Treedt op wanneer |
|------------|-------------------|
| `source_copy` | Minstens de helft van de beoordeelde uitvoer gelijk is aan de bron (hoofdletters, accenten en leestekens genegeerd). Een item waarvan de referentie identiek is aan de bron (een naam, een getal) wordt weggelaten. |
| `length_deflation` | Uitvoer gemiddeld minder dan 0,5× de referentielengte is, of een kwart of meer van de uitvoer dat is — er zijn woorden weggelaten. FST-acceptatie en codewisseling beoordelen alleen de aanwezige woorden, dus het weglaten van woorden verhoogt deze scores. |
| `length_inflation` | Uitvoer gemiddeld meer dan 2× de referentielengte is, of een kwart of meer van de uitvoer dat is (bijvoorbeeld wanneer few-shot-voorbeelden in elke uitvoer doorsijpelen). |
| `near_constant_output` | Eén uitvoer wordt gegeven voor veel verschillende invoeren: herhalingen beslaan minstens een kwart van de afzonderlijke bronnen, en minstens 5 daarvan. Een uitvoer telt als een herhaling wanneer 3 bronnen deze kregen (bij een uitvoer van drie of meer woorden) of 5 (bij een uitvoer van één of twee woorden, aangezien korte antwoorden zoals "Ja." legitiem vaker voorkomen); een uitvoer die gelijk is aan de eigen referentie is een correct antwoord, geen herhaling. Voordat deze grenzen werden gekozen, werd de regel getoetst op 2.161 echte systeemuitvoeren en referenties uit de WMT 2019–2025-statistiektaken; de vijf die werden gemarkeerd, waren allemaal defecte uitvoer. |
| `train_test_near_twin` | Geschreven door nmt-forge: elke (of bijna elke) testrij heeft een nagenoeg identieke tegenhanger in de trainingsdata, zodat de score het ophalen van trainingszinnen meet, en niet vertaling. |

---

## 3. Metriekstatustiers

Elke metriek in §2 valt in een van vier implementatietiers:

| Tier | Betekenis | Run card-gedrag |
|------|-----------|-----------------|
| **✅ Geïmplementeerd** | Code bestaat, getest, produceert vandaag waarden in run cards | Numerieke waarde in run card |
| **⚡ Gedeeltelijk** | Taalspecifieke proxy bestaat (bijv. CRK) maar universele implementatie is in behandeling | Numerieke waarde wanneer proxy van toepassing is, anders `null` |
| **🔲 Gepland** | Gespecificeerd maar nog niet geïmplementeerd | `null` in run card (veld aanwezig, waarde afwezig) |
| **💡 Voorgesteld** | Onder bespreking, nog niet gespecificeerd | Niet in run card |

Een metriek gaat van Gepland → Gedeeltelijk wanneer:
1. Een taalspecifieke implementatie is samengevoegd en getest
2. Deze waarden produceert voor ten minste één taalcombinatie
3. De universele implementatie in behandeling blijft (gedocumenteerd in deze specificatie)

Een metriek gaat van Gedeeltelijk → Geïmplementeerd wanneer:
1. Een taalonafhankelijke implementatie is samengevoegd en getest
2. Deze waarden produceert voor elke taalcombinatie zonder taalspecifieke plugins
3. Dit document is bijgewerkt om de ✅-status te weerspiegelen

Een metriek gaat van Gepland → Geïmplementeerd wanneer:
1. De implementatie is samengevoegd en getest
2. Deze is gevalideerd op ten minste één echte evaluatierun
3. Dit document is bijgewerkt met de implementatiedetails

Een metriek gaat van Voorgesteld → Gepland wanneer:
1. De definitie, schaal en berekeningsmethode zijn overeengekomen
2. Deze aan dit document is toegevoegd met een `🔲 Planned`-status
3. Een nulplaatshouder is toegevoegd aan het run card-schema

---

## 4. Buiten gebruik gesteld: de samengestelde score (verouderd) {#4-composite-score}

> [!CAUTION]
> **Geen enkele nieuwe run wordt beoordeeld met de samengestelde score.** Deze is buiten gebruik gesteld door beoordelingsstandaard `standard/1` ([Hoe runs worden beoordeeld](#how-runs-are-scored)). Nieuwe kaarten publiceren `composite: null`. Dit gedeelte wordt **uitsluitend** bewaard zodat kaarten die vóór de standaard zijn gepubliceerd nog steeds kunnen worden gelezen en geverifieerd: de verificateur leidt de opgeslagen samengestelde score van elke kaart zonder `scores.scoring_standard` opnieuw af, exact volgens de onderstaande formule en tabellen. Waar de samengestelde score van een oude kaart nog wordt getoond, staat deze gelabeld als **verouderde samengestelde score (buiten gebruik)**, en deze wordt nooit vergeleken met chrF++ of met een nieuwe kaart.

### Waarom deze buiten gebruik is gesteld {#why-the-composite-was-retired}

De samengestelde score was een gewogen combinatie van chrF++/100, exacte overeenkomst, FST-acceptatie (gewicht 0,25), morfologische nauwkeurigheid, de semantische score, codewisseling, hallucinatie en terminologie, met gewichten die waren vastgesteld op basis van technische inschatting en nooit waren afgestemd op menselijke beoordelingen. Omdat verschillende van de invoerwaarden de uitvoer nooit vergelijken met de bron of de referentie, kon een systeem het grootste deel van de score behalen zonder te vertalen:

- **Eén zin voor elke invoer.** Een ongetraind Engels→Noord-Samisch model dat voor elke invoer één geldige Noord-Samische zin herhaalde, behaalde een samengestelde score van **0,6244** — gelabeld als "functioneel" — met een **chrF++ van 5,5**. De herhaalde woorden zijn geldig Samisch, dus de FST-acceptatie was 100%, en voor een taal waarvan de FST een spellingcontrole-acceptor is, bepaalde FST-acceptatie ongeveer 45% van de samengestelde score nadat de ontbrekende statistieken waren weggewogen.
- **Weglaten wat niet kan worden vertaald.** Een eenvoudige woordenlijst die elk woord weglaat dat het niet kent, scoorde **0,6612**, omdat FST-acceptatie en codewisseling alleen de woorden beoordelen die een uitvoer bevat.
- **De bron kopiëren.** Engels dat ongewijzigd werd doorgekopieerd als "Noord-Samische" uitvoer kreeg toch FST-punten, aangezien een spellingcontrole woorden met een hoofdletter en sommige Engelse woorden accepteert.

Geen enkele standaardevaluatie zou deze systemen hoger rangschikken dan een echte vertaling, en dat doet chrF++ dan ook niet: het vergelijkt elke uitvoer met de referentie. De voorbehouden van het testharnas (§2.8) vangen deze patronen eveneens op en blijven prominent zichtbaar naast de chrF++-hoofdstatistiek.

### 4.1 Formule (verouderd)

De samengestelde score was een gewogen gemiddelde van alle *beschikbare* statistieken, opnieuw genormaliseerd zodat de gewichten van de beschikbare statistieken optellen tot 1,0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Een statistiek is "beschikbaar" als de waarde ervan op de run-card een getal is (niet `null`). Wanneer een statistiek niet beschikbaar was — omdat de taal geen FST heeft, of omdat een statistiek nog niet is geïmplementeerd — werd het gewicht ervan proportioneel herverdeeld over de overige statistieken. Samengestelde scores die zijn berekend op basis van verschillende sets statistieken waren nooit vergelijkbaar; elke verouderde kaart legt zijn `scores.scoring_profile` en `scores.metric_availability` vast (§2.7), zodat de verificateur weet welke set moet worden gebruikt.

### 4.2 Invoernormalisatie (verouderd)

Voordat ze in de formule voor de samengestelde score werden opgenomen, werd elke statistiek op een **schaal van 0,0–1,0** geplaatst, waarbij 1,0 = perfect:

| Metriek | Oorspronkelijke schaal | Normalisatie |
|---------|----------------------|--------------|
| `exact_match_rate` | 0,0–1,0 | Geen (al genormaliseerd) |
| `equivalent_match_rate` | 0,0–1,0 | Geen |
| `fst_acceptance_rate` | 0,0–1,0 | Geen |
| `morphological_accuracy` | 0,0–1,0 | Geen |
| `chrf_plus_plus` | 0–100 | **Delen door 100** |
| `semantic_score` | 0,0–1,0 | Geen |
| `code_switching_rate` | 0,0–1,0 (lager = beter) | **`1.0 - value`** (inverteren: 0% code-switching = 1,0) |
| `hallucination_rate` | 0,0–1,0 (lager = beter) | **`1.0 - value`** (inverteren) |
| `terminology_adherence` | 0,0–1,0 | Geen |

### 4.3 Gewichtstabellen (verouderd) {#43-weight-tables}

Elke taal werd herleid naar een **benoemd profiel** via `language_cards.resolve_scoring_profile()` (`fst-coverage` wanneer een FST de run beoordeelde, anders `surface-only`, tenzij de taalkaart `scoringProfile.basis` declareerde); het profiel wordt weerspiegeld in `PROFILE_REGISTRY` van `scoring.py` en op elke verouderde kaart vastgelegd als `scores.scoring_profile`. `orthographic_accuracy` wordt vermeld in `scoring.INACTIVE_METRICS` en werd nooit berekend, waardoor het gewicht ervan altijd werd herverdeeld. `morphological_accuracy` telde alleen mee wanneer `morph_coverage ≥ 0.25`. Neurale statistieken (`comet_score`, `qe_score`; `scoring.NEURAL_METRICS`) maakten nooit deel uit van enige samengestelde score.

#### `fst-coverage` (Profiel A): Talen MET FST-dekking

| Metriek | Doelgewicht | Motivering |
|---------|------------|------------|
| `fst_acceptance_rate` | **0,25** | Hoogste gewicht. Als de FST een woord afwijst, is het geen geldige vorm in de taal — ongeacht wat andere metrieken zeggen. Binair, structureel onderbouwd. |
| `morphological_accuracy` | **0,15** | Een woord kan FST-geldig zijn maar morfologisch onjuist (juiste stam, verkeerde verbuiging). Samen met FST dragen structurele metrieken 40%. |
| `chrf_plus_plus` | **0,15** | Teken-n-gram-overlap: de beste oppervlakteproxy voor polysynthetische talen. Gaat beter om met agglutinerende morfologie dan woordniveaumetrieken. |
| `semantic_score` | **0,15** | Betekenisbehoud wanneer de oppervlaktevorm afwijkt. Detecteert semantisch onjuiste vertalingen die structurele controles doorstaan. |
| `equivalent_match_rate` | **0,10** | Beloont aanvaardbare varianten, niet alleen de ene referentievertaling. Belangrijk voor talen met flexibele woordvolgorde. |
| `code_switching_rate` | **0,05** | Bestraft lek van de brontaal. Geïnverteerd: 0% code-switching = 1,0. |
| `terminology_adherence` | **0,05** | Beloont begeleide methoden die voorgeschreven vocabulaire respecteren. Alleen actief wanneer coachingdata aanwezig is. |
| `hallucination_rate` | **0,05** | Bestraft verzonnen inhoud. Geïnverteerd: 0% hallucinatie = 1,0. |
| `exact_match_rate` | **0,05** | Laagste gewicht. Te strikt voor polysynthetische talen — meerdere correcte vertalingen bestaan. Behouden als plafondcontrole. |

> **Totaal: 1,00.** Bij afwezigheid van `morphological_accuracy` (geen FST-analysator, een FST die alleen acceptor is, of een dekking onder 0,25) werden de resterende 8 statistieken (totaal 0,85) elk geschaald met 1/0,85 ≈ 1,176. Voor een taal met een FST die alleen acceptor is (Noord-Samisch, Amhaars, Baskisch) zonder evaluatiestandaard en zonder woordenlijst, bleven alleen FST-acceptatie 0,25, chrF++ 0,15, codewisseling, hallucinatie en exacte overeenkomst (elk 0,05) over — totaal 0,55 — waardoor FST-acceptatie **0,25/0,55 ≈ 45%** van de samengestelde score bepaalde. Dat is de weging waarvan de bovenstaande voorbeelden misbruik maakten.

#### `surface-only` (Profiel B): Talen ZONDER FST-dekking

| Metriek | Doelgewicht | Motivering |
|---------|------------|------------|
| `semantic_score` | **0,25** | Zonder structurele validatie is betekenisbehoud het sterkste beschikbare signaal. |
| `chrf_plus_plus` | **0,25** | Zonder FST wordt tekenovereenkomst de primaire oppervlaktecontrole. |
| `equivalent_match_rate` | **0,15** | Variantmatching biedt gestructureerde kwaliteitsbeoordeling zonder morfologische tools. |
| `exact_match_rate` | **0,10** | Zonder FST draagt exacte overeenkomst meer gewicht als de enige structurele validatieproxy. |
| `code_switching_rate` | **0,10** | Lek van de brontaal is belangrijker wanneer er geen FST is om slechte uitvoer te detecteren. |
| `terminology_adherence` | **0,05** | Naleving van begeleid vocabulaire. |
| `hallucination_rate` | **0,05** | Detectie van verzonnen inhoud. |
| `orthographic_accuracy` | **0,05** | Schriftspecifieke correctheid vult een deel van de leemte die de afwezige FST achterlaat. |

> **Totaal: 1,00.** `orthographic_accuracy` werd nooit berekend, dus de resterende 7 statistieken (totaal 0,95) werden geschaald met 1/0,95 ≈ 1,053.

#### `no-reference`: runs ZONDER gouden referentie

| Metriek | Doelgewicht | Motivering |
|---------|------------|------------|
| `fst_acceptance_rate` | **0,40** | Morfologische geldigheid heeft geen referentie nodig; het sterkste deterministische signaal wanneer een FST bestaat. |
| `code_switching_rate` | **0,25** | Lek van de brontaal (geïnverteerd). |
| `hallucination_rate` | **0,20** | Verzonnen inhoud (geïnverteerd). |
| `terminology_adherence` | **0,15** | Naleving van begeleid vocabulaire. |

> **Totaal: 1,00.** Voor runs waarvan het corpus geen gouden referenties bevatte. Wanneer een dergelijke run geen FST had, werd de samengestelde score uitsluitend over de gedragscontroles opnieuw genormaliseerd.

### 4.4 Een nieuwe statistiek toevoegen

Een nieuwe statistiek wordt toegevoegd als **diagnostiek**; deze verandert nooit de hoofdstatistiek:

1. **Definieer de statistiek** in §2 met status `🔲 Planned`, inclusief schaal, niveau, richting en berekeningsmethode.
2. **Implementeer deze** als een MetricPlugin (of in `tester.py` voor kernstatistieken).
3. **Registreer deze** in `shared/metric-registry.json` en voeg een null-placeholder toe in het scores-blok van de run-card.
4. **Werk BENCHMARK_SPEC.md** §3 bij als het schema van de run-card verandert.
5. **Voer een validatiebenchmark uit** om te bevestigen dat de statistiek zinnige waarden oplevert op echte data.
6. **Werk dit document bij** om de status te wijzigen van `🔲` naar `✅`.

Het wijzigen van de hoofd- of rangschikkingsstatistiek is niet hetzelfde als "een statistiek toevoegen": hiervoor is een nieuwe versie van de beoordelingsstandaard nodig ([Hoe runs worden beoordeeld](#how-runs-are-scored)).

---

## 5. Buiten gebruik gesteld: kwaliteitsniveaus (verouderd) {#5-quality-tiers}

> [!CAUTION]
> **Geen enkele nieuwe kaart bevat een kwaliteitsniveau.** Nieuwe kaarten publiceren `quality_tier: null`, en geen enkele nieuwe uitvoer toont een niveau of een label zoals "functioneel" of "inzetbaar". Een automatische score is geen oordeel over kwaliteit: hetzelfde getal betekent verschillende dingen voor verschillende talen en evaluatiesets, en de buiten gebruik gestelde niveaus bestempelden een systeem dat voor elke invoer één zin herhaalde als "functioneel" (§4). Alleen menselijke evaluatie door sprekers certificeert kwaliteit ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

De niveaus waren labels afgeleid van de verouderde samengestelde score. Verouderde kaarten slaan deze nog steeds op; ze worden hier alleen bewaard zodat een oude kaart kan worden gelezen, en vormen geen kwaliteitsclaims.

| Verouderd niveau | Bereik verouderde samengestelde score |
|------|----------------|
| Baseline | 0,00–0,30 |
| Emerging | 0,30–0,50 |
| Functional | 0,50–0,70 |
| Deployable | 0,70–0,85 |
| Fluent | 0,85–1,00 |

### 5.1 Niveaudrempels (machineleesbaar, verouderd)

De verouderde drempelwaarden (van boven naar beneden geëvalueerd, eerste overeenkomst geldt):

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. Kostenmetrieken

Kostenstatistieken meten de financiële efficiëntie van een vertaalmethode. Ze worden gerapporteerd naast de score en er nooit mee gecombineerd.

### 6.1 Tokenmetrieken

| ID | Metriek | Berekening |
|----|---------|------------|
| `prompt_tokens` | Totaal invoertokens | Som van `usage.prompt_tokens` over alle API-aanroepen |
| `completion_tokens` | Totaal uitvoertokens | Som van `usage.completion_tokens` |
| `reasoning_tokens` | Chain-of-thought-tokens | Som van `usage.completion_tokens_details.reasoning_tokens` (0 voor de meeste modellen) |
| `cached_tokens` | Door provider gecachede tokens | Som van `usage.prompt_tokens_details.cached_tokens` |
| `total_tokens` | Totaal verbruikte tokens | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | Gemiddeld tokens per vertaling | ✅ `total_tokens / entry_count` |

### 6.2 Kostenmetrieken

| ID | Metriek | Berekening | Gebruiksscenario |
|----|---------|------------|-----------------|
| `total_cost_usd` | Totale runkosten | Door provider gerapporteerde prijzen × tokenaantallen | "Hoeveel heeft deze benchmark gekost?" |
| `cost_per_entry_usd` | Kosten per corpusinvoer | `total_cost_usd / entry_count` | Methoden vergelijken op hetzelfde corpus |
| `cost_per_1k_tokens` | Kosten per 1.000 tokens | ✅ `total_cost_usd / total_tokens × 1000` | Universele LLM-efficiëntie — vergelijkbaar over corpora heen |
| `cost_per_source_char` | Kosten per bronteken | `total_cost_usd / total_source_chars` | Vergelijkbaar over talen heen met verschillende tokenisatie |

> **Waarom meerdere kostenmetrieken?** Een "invoer" varieert in lengte — een uitdrukking van 3 woorden kost minder dan een alinea. `cost_per_entry_usd` is nuttig voor het vergelijken van methoden op *hetzelfde* corpus (dezelfde invoeren = dezelfde lengten = eerlijke vergelijking). `cost_per_1k_tokens` is de standaard LLM-efficiëntiemetriek, vergelijkbaar *over* corpora heen. `cost_per_source_char` normaliseert voor tokenisatieverschillen — dezelfde zin kan worden getokeniseerd in verschillende aantallen tokens afhankelijk van het vocabulaire van het model.

### 6.3 Kostengecorrigeerde score (buiten gebruik)

Verouderde kaarten bevatten een kostengecorrigeerde score, berekend op basis van de buiten gebruik gestelde samengestelde score:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Deze is samen met de samengestelde score buiten gebruik gesteld: nieuwe kaarten publiceren `cost_adjusted: null`. Om kosten af te wegen tegen kwaliteit, bekijkt u chrF++ (met het bijbehorende BI) en `cost_per_entry_usd` naast elkaar; het leaderboard kan op beide sorteren.

---

## 7. Snelheidsmetrieken

Snelheidsstatistieken meten de latentie en doorvoer van een vertaalmethode. Net als kosten wordt snelheid gerapporteerd naast de score en er nooit mee gecombineerd.

| ID | Metriek | Berekening | Niveau |
|----|---------|------------|--------|
| `elapsed_seconds` | Wandkloktijdsduur van de run | `time_end - time_start` | Run |
| `avg_latency_seconds` | Gemiddelde latentie per invoer | `Σ latency_s / n_entries` | Corpus |
| `median_latency_seconds` | Mediane latentie per invoer | 50e percentiel van `latency_s` | Corpus |
| `p95_latency_seconds` | 95e percentiellatentie | 95e percentiel van `latency_s` | Corpus |
| `tokens_per_second` | Doorvoer | `total_tokens / elapsed_seconds` | Run |
| `entries_per_minute` | Vertaalsnelheid | `entry_count / (elapsed_seconds / 60)` | Run |

---

## 8. Betrouwbaarheid en significantie

### 8.1 Bootstrap-betrouwbaarheidsintervallen

Betrouwbaarheidsintervallen zijn percentiel-bootstrapintervallen over de segmenten van de evaluatieset (n=1000 hersteekproeven, α=0,05; Koehn 2004). Het chrF++-interval maakt deel uit van de hoofdstatistiek: `chrF++ 47.5 [45.9, 49.0]`. Bij een kleine evaluatieset is het interval breed, en het testharnas waarschuwt wanneer een subset te klein is voor een betekenisvol interval.

| Statistiek | BI gerapporteerd |
|------------|------------------|
| `chrf_plus_plus` (hoofdstatistiek) | ✅ run-card `confidence_intervals.corpus_chrf`; database `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (alleen berekend wanneer FST-data bestaat) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (gebootstrapt vanuit gecachte scores per item — geen overbodige neurale inferentie) |
| `composite` | Alleen verouderde kaarten (`composite_ci_lower`, `composite_ci_upper`); niet berekend voor nieuwe runs |
| BI's per niveau | ✅ `confidence_intervals_by_tier` — chrF++- en exact_match-BI's per moeilijkheidsgraad (Tier 1-5) |

### 8.2 Gepaarde significantietoetsen {#82-paired-significance-tests}

Of een run beter is dan een andere, wordt bepaald door een gepaarde significantietoets op chrF++ over de segmenten die beide runs hebben vertaald, nooit door simpelweg twee getallen te vergelijken. `mt-eval compare --significance` voert uit:

- **Approximatieve randomisatie** (de standaard; Riezler & Maxwell 2005, tevens de standaard van sacreBLEU): de uitvoer van de twee systemen wordt segment voor segment willekeurig omgewisseld, 1.000 keer, om te zien hoe vaak een verschil dat minstens zo groot is door toeval ontstaat.
- **Gepaarde bootstrap-hertoetsing** (`--method paired_bootstrap`; Koehn 2004): segmenten worden opnieuw bemonsterd met teruglegging en het verschil wordt op elke steekproef opnieuw berekend. Dit is een conservatievere schatting, aangeboden ter vergelijking met oudere publicaties.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

Elk verschil gaat vergezeld van het bijbehorende 95%-betrouwbaarheidsinterval en wordt gerapporteerd als significant wanneer p < 0,05. BLEU, spBLEU, TER en de diagnostische statistieken die in beide runs aanwezig zijn, worden eveneens getoetst en getoond (p-waarden gelden per statistiek en zijn niet gecorrigeerd voor meervoudig toetsen), maar het eindoordeel over "beter" is gebaseerd op de chrF++-toets. Twee chrF++-getallen zijn alleen vergelijkbaar wanneer hun sacreBLEU-handtekeningen overeenkomen. Als een van de vergeleken rapporten een verouderd rapport is, meldt compare dat de samengestelde score buiten gebruik is gesteld en vergelijkt deze niet. Volledige methode: [Statistische significantietoetsing](/docs/network/specifications/significance).

---

## 9. Run card-scoresschema

Dit gedeelte definieert de hiërarchische structuur van het `scores`-blok in een run card. Dit schema is afgeleid van de metrieken gedefinieerd in §2–§7 en moet gesynchroniseerd worden gehouden.

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

Scorevoorbehouden (§2.8) bevinden zich op het hoogste niveau van de kaart als `score_caveats`, een lijst van `{kind, source, severity, message, …}`-objecten; BLEU bevindt zich daar als `corpus_bleu`.

> **Schemageschiedenis.** Eerdere specificatieconcepten stelden afzonderlijke `cost`-, `speed`- en `tokens`-blokken voor. Deze zijn samengevoegd in respectievelijk `scores` en `totals` voor eenvoud. Snelheidsmetrieken (`tokens_per_second`, `entries_per_minute`, latenties) staan in `scores`; tokenaantallen en kostencijfers staan in `totals`.

### 9.1 Schema–databasekoppeling

De run card JSON wordt volledig opgeslagen als een `jsonb`-kolom in Supabase. Sleutelmetrieken worden ook gedenormaliseerd in kolommen op het hoogste niveau voor sorteer-/filterprestaties:

| Run-card-veld | Supabase-kolom | Type | Index |
|---------------|----------------|------|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — alleen verouderde kaarten; null voor `standard/1` |
| `scores.quality_tier` | `quality_tier` | `text` | — alleen verouderde kaarten; null voor `standard/1` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(volledige kaart)* | `run_card` | `jsonb` | — |

Wanneer nieuwe metrieken worden geïmplementeerd, moet de bijbehorende kolom worden toegevoegd via een genummerde migratie in `arena/migrations/`.

---

## 10. Code–specificatiesynchronisatie

### 10.1 Canonieke bron

Dit document is de canonieke bron voor:
- De beoordelingsstandaard: de hoofdstatistiek, de standaardstatistieken daarnaast en de diagnostiek ([Hoe runs worden beoordeeld](#how-runs-are-scored))
- Metrische definities (§2) en scorevoorbehouden (§2.8)
- De verouderde gewichtstabellen voor de samengestelde score (§4.3) en niveaudrempels (§5.1), bewaard voor het verifiëren van oude kaarten
- Formules voor kostenstatistieken (§6.2)
- Schema voor scores op de run-card (§9)

### 10.2 Codespiegel

Het bestand `arena/mt_eval_harness/scoring.py` is de code-implementatie van dit document: de metrische rollen van de standaard (`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`) en daaronder de verouderde tabellen en niveaudrempels voor de samengestelde score die alleen worden gebruikt om oude kaarten te verifiëren. Geen enkele andere module definieert deze; de tests van het testharnas borgen beide. Wanneer dit document wordt bijgewerkt, dient u `scoring.py` dienovereenkomstig bij te werken en de tests van het harnas opnieuw uit te voeren.

### 10.3 Documenten die naar deze specificatie verwijzen

| Document | Waarnaar het verwijst | Hoe synchroon te houden |
|----------|-----------------------|-------------------------|
| [Benchmarkspecificatie](/docs/network/specifications/benchmark) §4–§5 | De hoofdstatistiek, rangschikking, verouderde samengestelde score | Verwijs naar dit document; dupliceer geen tabellen |
| [Statistische significantietoetsing](/docs/network/specifications/significance) | Hoe "beter" wordt bepaald | Moet overeenkomen met §8.2 |
| [Veelgestelde vragen](/docs/network/getting-started/faq) en [Hoe het werkt](/docs/network/how-it-works) | Samenvatting van de standaard in begrijpelijke taal | Link terug naar dit document |
| `publish.py` via `scoring.py` | `standard_score_fields()` en de verouderde samengestelde score | Harnastests valideren de overeenstemming |

---

## Bijlage A: Waarom chrF++ de hoofdstatistiek is (en de andere niet)

| Statistiek | Rol | Waarom |
|------------|-----|--------|
| **chrF++** | Hoofdstatistiek | Karakter-n-grammen geven gedeeltelijke punten voor een woord met de juiste stam en een ander achtervoegsel, waardoor het beter omgaat met rijke morfologie dan statistieken op woordniveau (Popović 2015, 2017). Het is uitsluitend vanuit het corpus reproduceerbaar voor elke taal en elk schrift, en het is wat FLORES-200 en de AmericasNLP-shared-tasks rapporteren. |
| **BLEU** | Standaard, ernaast | Vergelijking op woordniveau telt een klein buigingsverschil als een volledige misser, wat polysynthetische talen benadeelt. Gerapporteerd ter vergelijking met de MT-literatuur. |
| **spBLEU** | Standaard, ernaast | BLEU op een gedeelde SentencePiece-tokenisatie, vergelijkbaar over schriften heen; gerapporteerd door FLORES-200. |
| **TER** | Standaard, ernaast | Bewerkingsafstand; correleert in de meeste gebruiksscenario's met chrF++. |
| **COMET** | Standaard, ernaast (indien berekend) | Getraind op WMT-data (hoogbebronde Europese paren). Voor LRL's (bijv. Cree) extrapoleert het model en is het ongekalibreerd, en het vereist een groot model, waardoor het niet het ene cijfer kan zijn dat elke run heeft. Wordt opnieuw afgeleid door de verificateur. |
| **Lengteverhouding** | Diagnostiek | Een verhouding van 1,02 en een verhouding van 0,98 zijn beide prima. Alleen extreme waarden duiden op problemen (§2.8). |
| **FST-acceptatie, morfologische nauwkeurigheid, LYSS** | Diagnostiek | Technische heuristieken zonder correlatiegegevens met menselijke beoordelingen; FST-acceptatie kijkt nooit naar de bron of referentie (§4). |
| **Consistentiescore** | Diagnostiek (gepland) | Enige inconsistentie is legitiem (hetzelfde Engelse woord → verschillende vertalingen in de doeltaal afhankelijk van de context). |
| **Conformiteitsindex** | Drempel (gepland) | Meet structureel behoud (placeholders, aanhalingstekens), niet de vertaalnauwkeurigheid. |

## Bijlage B: LYSS — Taalspecifieke metriekimplementaties

Het **LYSS**-raamwerk (Linguistically-informed Yield & Structural Scoring) biedt taalspecifieke metrieken die verder gaan dan oppervlakkige tekenreeksvergelijking. LYSS heeft drie kerncomponenten:

- **LYSS-fst** — Morfologische geldigheid (`fst_acceptance_rate`): Is elk woord een geldige vorm in de doeltaal?
- **LYSS-eq** — Linguïstische equivalentie (`equivalent_match_rate`): Is de uitvoer een aanvaardbare variant van de referentie?
- **LYSS-sem** — Semantische validatie (`semantic_score`): Behoudt de uitvoer de bronbetekenis?

Alle drie zijn **diagnostiek** onder de beoordelingsstandaard: gerapporteerd naast de chrF++-hoofdstatistiek, nooit erin opgenomen.

> **Validatiestatus: 🔶 Technische heuristiek.** LYSS-metrieken zijn NIET gevalideerd tegen menselijke kwaliteitsoordelen. Ze zijn ontworpen op basis van linguïstische principes (FST's, woordenboeken, grammaticaregels gebouwd door taalkundigen bij UAlberta ALTLab), maar de correlatie tussen LYSS-scores en werkelijke vertaalkwaliteit is niet gemeten. Zie het [Sprekervalidatieprotocol](/docs/network/specifications/speaker-validation) voor de vereiste validatie-experimenten.

| Taal | Plugin | Locatie | LYSS-component | Metrische sleutel | Opmerkingen |
|------|--------|---------|----------------|-------------------|-------------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Deterministische regels voor variantklassen: woordvolgorde, orthografie, optioneel partikel, lemmasynoniem, progressieve ambiguïteit, inclusief/exclusief. Levert per item `lint_verdict` op (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Deterministisch: FST-lemma-extractie + woordenboekverklaringen + spaCy-inhoudswoordoverlap. Levert oordelen op (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| GiellaLT-talen | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Generiek: elke taal met een in het harnas vastgelegde FST (`mt_eval_harness/data/fst-pins.json`). Een analyserende FST levert tevens `morphological_accuracy` op; een speller die alleen acceptor is (de Divvun-pakketten die zijn vastgelegd voor Noord-Samisch, Amhaars en Baskisch) rapporteert alleen acceptatie. Om in de praktijk door een FST te worden beoordeeld, is tevens een evaluatieset voor het talenpaar vereist die kan rangschikken: de twee sets van Plains Cree (EdTeKLA) zijn in quarantaine geplaatste labels waarvoor de database een score weigert, terwijl verschillende andere FST-talen open sets hebben (Tatoeba, WMT, WMT24++). De [datasetpagina](/docs/network/leaderboard/datasets) vermeldt de catalogus, en `mt-eval corpora --source eng --target <code>` geeft aan wat voor een paar kan worden uitgevoerd (zie [Eerlijke beperkingen](/docs/network/honest-limitations)). |

> **Architectuurnotitie (juni 2026).** Taalspecifieke LYSS-statistieken worden nu gedeclareerd op de taalkaart onder `evalMetrics` en geladen vanuit `eval_standards/<lang>/` door `plugin_discovery.py`. Het zijn **evaluatiestandaarden** (scheidsrechter), geen method-plugin-statistieken (deelnemer). Dit betekent dat elke vertaalmethode die gericht is op CRK automatisch wordt gecontroleerd door de LYSS-diagnostiek — er is geen methodespecifieke configuratie vereist. `CrkFSTMetric` is verwijderd; de functionaliteit ervan wordt volledig gedekt door het generieke `GiellaLTFSTMetric`.

## Bijlage C: Metrieken onder overweging

Dit zijn ideeën die worden geëvalueerd maar nog niet voldoende zijn gespecificeerd voor §2:

| Idee | Wat het zou meten | Belemmeringen |
|------|------------------|---------------|
| Vloeiendheid (LM-perplexiteit) | Is de uitvoer goed gevormd proza in de doeltaal? | Vereist een doeltaal-LM. Er bestaan geen goede modellen voor de meeste LRL's. |
| Registerovereenkomst | Komt de vertaling overeen met het verwachte formaliteitsniveau? | Vereist sociolinguïstische classificatoren. Onderzoeksprobleem. |
| Culturele gepastheid | Worden culturele verwijzingen correct behandeld? | Kan niet worden geautomatiseerd — vereist inherent menselijke beoordeling. |
| Discourssamenhang | Vormen opeenvolgende vertalingen een samenhangend geheel? | Vereist evaluatie op documentniveau, niet op zinsniveau. |

---

## Referenties

Academische artikelen, hulpmiddelen en taalbronnen waarnaar in deze specificatie wordt verwezen.

### Oppervlaktemetrieken

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Kopenhagen, Denemarken.

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lissabon, Portugal.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. België, Brussel. Referentie-implementatie: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Evaluatiepraktijk en significantietoetsing

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, Spanje.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; rapporteert chrF++ en spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

### Neurale metrieken

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Abeba, Ethiopië.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Online.

### Morfologische en linguïstische hulpmiddelen

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlijn, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### Foutclassificatie en diagnostische evaluatie

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Verwant werk over op kenmerken gebaseerde evaluatiemetrieken, inclusief FUSE.)

### Hallucinatiedetectie

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. Online.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Kroatië.

### Cree-taalbronnen

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, Universiteit van Regina.

### Gegevensbeheer

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
