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

> **Managementsamenvatting.** Dit is de enige bron van waarheid voor alle evaluatiemetrieken, samengestelde scores, kwaliteitsniveaus en kostenanalyse in het Champollion MT-evaluatie-ecosysteem. De taalspecifieke evaluatiemetrieken — FST-morfologische validiteit, linter-equivalentieklassen en deterministische semantische validatie — worden gezamenlijk **LYSS** (Linguistically-informed Yield & Structural Scoring) genoemd. Elke metriek die door de harness wordt berekend, elk gewicht in de samengestelde formule en elke drempelwaarde voor niveaus wordt hier gedefinieerd — en alleen hier. Code, documentatie en databaseschema's zijn afgeleid van dit document. Bij tegenstrijdigheden is dit document leidend.
>
> **Reikwijdte.** Dit document definieert *wat* we meten en *hoe we het scoren*. Het definieert niet het run card-schema (zie BENCHMARK_SPEC §3), het benchmarkprotocol (BENCHMARK_SPEC §6) of de regels voor het leaderboard (zie arena-documentatie). Die documenten verwijzen naar dit document voor definities van metrieken en scorelogica.


---

## 1. Scoringsfilosofie

### 1.1 Microeval-filosofie

> *"Als we ons alleen richten op wat generaliseert, zullen we onvermijdelijk vergeten waar dat niet het geval is — en deze talen en al hun kennis en wijsheid verliezen."*

Dit project hanteert **microeval-ontwikkeling**: het bouwen van evaluatiemetrieken die zijn afgestemd op specifieke talen met behulp van de beste beschikbare linguïstische hulpmiddelen — eindige-toestandstransducers, tweetalige woordenboeken, morfologische analysatoren en door taalkundigen samengestelde equivalentieregels. Dit is het tegenovergestelde van het dominante paradigma in MT-evaluatie, dat streeft naar universele metrieken die voor alle talen werken. Universele metrieken zijn waardevol, maar ze zijn het zwakst precies waar ze het meest nodig zijn: voor talen met complexe morfologie, beperkte trainingsdata en geen vertegenwoordiging in neurale metriek-trainingssets.

We boeken niet alleen geen vooruitgang in machinevertaling voor veel talen in de wereld omdat we corpora missen, maar ook omdat **we niet eens weten hoe vooruitgang eruitziet** — we missen de geautomatiseerde evaluatietools om te meten of een vertaalsysteem verbetert. LYSS is onze poging om die tools te bouwen, taal voor taal, met behulp van welke linguïstische middelen er ook beschikbaar zijn.

### 1.2 Geautomatiseerde metrieken zijn benaderingen

Elke hier gedefinieerde metriek wordt door een machine berekend. Ze zijn nuttig voor snelle iteratie, systematische vergelijking en het detecteren van regressies. Ze zijn **geen vervanging voor menselijk oordeel**. De kwaliteitstiers in §5 zijn heuristische labels — alleen menselijke beoordeling kan de werkelijke bruikbaarheid bevestigen.

### 1.3 Multi-signaalontwerp

Geen enkele metriek geeft een volledig beeld van de vertaalkwaliteit. Een vertaling kan een perfecte chrF++-overlap hebben maar morfologische validatie niet doorstaan. Ze kan FST-controles doorstaan maar de verkeerde betekenis dragen. Ze kan semantisch nauwkeurig zijn maar stilistisch vreemd aanvoelen voor de doeltaal. De samengestelde score in §4 aggregeert meerdere onafhankelijke signalen, elk met een andere dimensie van kwaliteit.

### 1.4 Uitbreidbaarheid

Deze metriekinventaris is niet gesloten. Nieuwe talen brengen nieuwe vereisten met zich mee: toonnauwkeurigheid voor toontalen, diacritische precisie voor Semitische schriften, lettergreepnauwkeurigheid voor Cree. De architectuur (MetricPlugin-protocol, gewogen samenstelling met hernormalisatie) is ontworpen zodat metrieken kunnen worden toegevoegd zonder bestaande scores te verstoren. Taalspecifieke metrieken (bijv. de linter en semantische validator van CRK) worden gedeclareerd op taalkaarten onder `evalMetrics` en geladen vanuit `eval_standards/` — het harnas wordt alleen geleverd met generieke gedragsmetrieken (code-switching, hallucinatie, terminologie).

### 1.5 Drie dimensies van evaluatie

Elke run card meet drie onafhankelijke dimensies:

```
Quality   — How good is the translation?   (composite score, §4)
Cost      — How much does it cost?          (cost metrics, §6)
Speed     — How fast does it run?           (speed metrics, §7)
```

Dit zijn onafhankelijke assen. Een methode kan van hoge kwaliteit maar duur zijn, snel maar onnauwkeurig, of een willekeurige combinatie. Het leaderboard maakt sorteren op elke dimensie mogelijk. De kostengewogen score (§6.3) is de enige metriek die dimensies combineert.

### 1.6 Validatiestatus

Elke metriek in deze specificatie heeft een **validatiestatus** die losstaat van de implementatiestatus (§3). De implementatiestatus geeft aan of er code bestaat. De validatiestatus geeft aan of is aangetoond dat de metriek correleert met menselijke kwaliteitsoordelen.

| Validatieniveau | Betekenis | Huidige metrieken |
|-----------------|-----------|-------------------|
| **✅ Extern gevalideerd** | Gepubliceerde studies naar menselijke correlatie bestaan (WMT, academische artikelen) | `chrf_plus_plus`, `bleu`, `comet_score` *(alleen voor taalcombinaties met veel middelen)* |
| **⚡ Proxy-gevalideerd** | Gevalideerd voor talen met veel middelen; niet gevalideerd voor onze doeltalen met weinig middelen | `comet_score` *(voor LRL's: gevalideerd op taalcombinaties met veel middelen/EU-paren, geëxtrapoleerd naar bijv. CRK — richtinggevend nuttig maar niet gekalibreerd)* |

> **Waarom `comet_score` in twee rijen voorkomt.** Dit is een splitsing op basis van het niveau van beschikbare middelen, geen tegenstrijdigheid. COMET is *extern gevalideerd* waar WMT-studies naar menselijke correlatie bestaan — taalcombinaties met veel middelen, voornamelijk Europese paren. Voor onze doeltalen met weinig middelen bestaan dergelijke studies niet, waardoor dezelfde metriek slechts *proxy-gevalideerd* is: het model extrapoleer vanuit talen met andere morfologische systemen. Dit is ook de reden waarom COMET wordt gerapporteerd in een aparte neurale baan en nooit wordt opgenomen in de samenstelling (§4.3).
| **🔶 Technische heuristiek** | Ontworpen op basis van linguïstische principes of waargenomen faalpatronen; geen gegevens over menselijke correlatie | `fst_acceptance_rate`, `morphological_accuracy` (FST-afgeleid, lemma-gematcht; **actief** in het fst-coverage-composiet, opnieuw afgeleid door de verifier), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Niet gevalideerd** | Nog niet getest op enige data | `orthographic_accuracy`, `consistency_score` |

> **Wat dit in de praktijk betekent.** De samengestelde score (§4) aggregeert metrieken op alle validatieniveaus. Dit is een bewuste ontwerpkeuze: wij zijn van mening dat een structureel onderbouwde technische heuristiek (FST-acceptatie) informatiever is voor polysynthetische talen dan een neurale metriek die alleen is gevalideerd op Europese paren (COMET). Maar dit hebben we niet bewezen. De samengestelde score moet worden behandeld als een **technische schatting**, niet als een gevalideerde kwaliteitsmeting, totdat studies naar menselijke correlatie zijn voltooid voor elke doeltaal.
>
> **Vereiste validatie-experimenten** (zie `mt-evaluation-landscape.md` §6 en `speaker-validation.md`):
> 1. Studie naar correlatie met menselijk oordeel: 200+ zinsparen beoordeeld door 3+ tweetalige sprekers
> 2. Meting van de FST-fout-afwijzingsrate op een representatief corpus
> 3. Tweede-taalpoort (Noord-Sámi) om generalisatie te testen
> 4. Directe vergelijking met COMET op dezelfde data


---

## 2. Metriekinventaris {#2-metric-inventory}

Metrieken zijn georganiseerd in zes categorieën (oppervlak, structureel, semantisch, gedragsmatig, compliance en gerapporteerde vergelijkingen). Elke metriek heeft een implementatiestatus, schaal en niveau (per invoer, corpusniveau of beide).

### 2.1 Oppervlaktemetrieken

Oppervlaktemetrieken vergelijken de voorspelde vertaling met de referentievertaling op tekenreeksniveau. Ze vereisen geen linguïstische hulpmiddelen — alleen tekenreeksvergelijking.

| ID | Metriek | Status | Schaal | Niveau | Implementatie |
|----|---------|--------|--------|--------|---------------|
| `exact_match_rate` | Exacte overeenkomst | ✅ Geïmplementeerd | 0,0–1,0 | Beide | Binair: is de voorspelling == de referentie? Corpusrate = overeenkomsten / totaal. |
| `equivalent_match_rate` | Equivalente overeenkomst | ⚡ Gedeeltelijk | 0,0–1,0 | Beide | Komt de voorspelde uitvoer overeen met een geaccepteerde variant? Voor CRK: geïmplementeerd via de `CrkLinterMetric` van de CRK-evalstandaard (in `eval_standards/crk/`) met behulp van deterministische variant-klasseregels (woordvolgorde, orthografisch, optioneel partikel, lemmasynoniem, progressieve ambiguïteit). Automatisch geladen via de `evalMetrics`-declaratie van de CRK-taalkaart. Generieke taaloverschrijdende implementatie vereist `variants[]` per invoer in het corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Geïmplementeerd | 0–100 | Beide | Teken-n-gram F-score (sacrebleu). Robuust bij morfologische variatie. De primaire oppervlaktemetriek voor agglutinerende/polysynthetische talen. Per invoer gebruikt `sentence_chrf`; corpus gebruikt `corpus_chrf`. |
| `bleu` | BLEU | ✅ Geïmplementeerd | 0–100 | Corpus | Woordniveau n-gram precisie (sacrebleu). **Uitgesloten van samenstelling** — woordniveauscoring bestraft morfologische variatie onterecht. Berekend en gerapporteerd voor compatibiliteit met MT-literatuur. |
| `ter` | Translation Edit Rate | ✅ Geïmplementeerd | 0–∞ (lager is beter) | Beide | Minimale bewerkingsafstand tussen voorspelling en referentie, genormaliseerd door referentielengte (sacrebleu `corpus_ter`). Berekend naast chrF++ en BLEU. Uitgesloten van samenstelling — correleert met chrF++, dus beide opnemen zou oppervlaktegelijkenis dubbel tellen. |
| `length_ratio` | Lengteratio | ✅ Geïmplementeerd | 0–∞ (1,0 is ideaal) | Beide | `len(predicted) / len(reference)` in tekens. Detecteert afkapping (<0,5) en opblazing/hallucinatie (>2,0). Gemiddeld over invoeren op corpusniveau. |

### 2.2 Structurele metrieken

Structurele metrieken valideren de linguïstische welgevormdheid van de vertaling. Ze vereisen taalspecifieke hulpmiddelen (FST-analysatoren, morfologische parsers) en zijn de sterkste signalen voor morfologisch rijke talen.

| ID | Metriek | Status | Schaal | Niveau | Implementatie |
|----|---------|--------|--------|--------|---------------|
| `fst_acceptance_rate` | FST-acceptatie | ✅ Geïmplementeerd | 0,0–1,0 | Beide | Aandeel uitvoerwoorden dat wordt geaccepteerd door een eindige-toestandstransducer (GiellaLT). Een woord is "geldig" als de FST ten minste één morfologische analyse retourneert. Beschikbaar voor elke taal met een GiellaLT `.hfstol`-analysator. |
| `morphological_accuracy` | Morfologische nauwkeurigheid | ✅ Actief (fst-coverage-profiel; opnieuw afgeleid door verifier) | 0,0–1,0 | Beide | Een woord kan FST-geldig zijn maar de verkeerde verbuiging hebben (juiste stam, verkeerd achtervoegsel). **Berekend** door `plugins/giellalt_fst.py`: voor elk analyseerbaar voorspeld woord wordt een referentiewoord gezocht dat zijn **lemma** (stam) deelt en wordt gecontroleerd of de voorspelde **verbuiging** (FST-kenmerktags) overeenkomt. Matching op lemma — niet op positie — omzeilt woorduitlijning: een andere woordkeuze of een verkeerd uitgelijnd paar wordt simpelweg niet *gedekt* (nooit foutief gescoord). **Geen gouden annotaties nodig** — de FST-analyse van de referentie *is* de grondwaarheid. Woorden die de FST niet kan analyseren, of waarvan de stam niet in de referentie staat, vallen buiten de dekking; `morph_coverage` (het aandeel lemma-gematcht) wordt bekendgemaakt, en de metriek treedt alleen in de samenstelling wanneer de dekking ≥ `MORPH_COVERAGE_FLOOR` (0,25) — onder de drempel blijft het adviserend. Het is **tolerant bij FST-ambiguïteit** (een voorspeld woord met meerdere analyses is "correct" als *een ervan* overeenkomt → een bovengrens, bekendgemaakt). Het draagt een **gewicht van 0,15** in het fst-coverage-profiel en wordt **opnieuw afgeleid door de verifier** ten opzichte van het canonieke corpus (`verifier.recompute_corpus_morph`, dat de kaart-vastgezette FST opnieuw uitvoert — fail-closed als de FST afwezig is, zelfde contract als COMET). Geactiveerd op 2026-06-16 (migratie 029 toegepast op dev + prod). |
| `orthographic_accuracy` | Orthografische nauwkeurigheid | 🔲 Gepland | 0,0–1,0 | Beide | Valideert schriftspecifieke correctheid: SRO-macron/circumflexgebruik voor Cree, diacritische tekens voor Inuktitut, klinkerlengtemarkeringen voor Ojibwe. Regelsets per taal. |

> **Waarom structurele meetwaarden van belang zijn.** Meta's OMT-1600 — het grootste MT-systeem dat ooit gepubliceerd is (1.600 talen; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — evalueert met ChrF++, xCOMET, MetricX en BLASER 3. Geen van deze methoden valideert morfologische correctheid. ChrF++ meet overlapping van karakter-n-grammen: het beloont tekenreeksen die *eruitzien* als de doeltaal. Voor polysynthetische talen betekent dit dat een morfologisch ongeldig woord dat veel tekens deelt met de referentie toch een hoge score behaalt. Onze FST-acceptatiemeetwaarde is een binaire structurele test: het woord is ofwel een geldige vorm in de taal, ofwel niet. Geen enkel ander MT-evaluatieraamwerk biedt dit op schaal. ChrF++ heeft bovendien een **niet-nul kansondergrens** die verschilt per orthografie — willekeurige tekst in hetzelfde schrift scoort meetbaar boven nul, meer in sommige schrijfsystemen dan in andere — waardoor ruwe chrF++-scores niet vergelijkbaar zijn tussen talen; de netwerkkaart corrigeert hiervoor met [kans-gecorrigeerde chrF++ (cchrF++)](/docs/network/specifications/connection-strength).

### 2.3 Semantische metrieken

Semantische metrieken meten betekenisbehoud met behulp van inbeddingen of aangeleerde modellen. Ze detecteren vertalingen die oppervlakkig verschillend maar betekenismatig equivalent zijn, en markeren vertalingen die oppervlakkig gelijkend maar semantisch onjuist zijn.

| ID | Metriek | Status | Schaal | Niveau | Implementatie |
|----|---------|--------|--------|--------|---------------|
| `semantic_score` | Semantische gelijkenis | ⚡ Gedeeltelijk | 0,0–1,0 | Beide | CRK: verdictgewogen score van de `CrkSemanticMetric` van de CRK-evalstandaard (in `eval_standards/crk/`, proxy). Universeel: cosinusgelijkenis van zinsinbeddingen (bron + voorspelling vs. bron + referentie). Model nader te bepalen — moet talen met weinig middelen ondersteunen, wat de meeste Engelstalige inbeddingsmodellen uitsluit. |
| `comet_score` | COMET | ✅ Geïmplementeerd | ~0,0–1,0 | Beide | Aangeleerde MT-evaluatiemetriek (Unbabel). **Afzonderlijk berekend en gerapporteerd — nooit in enige samenstelling** (de samenstelling is deterministisch; §4.3). Opnieuw afgeleid door de verifier, zodat een gerapporteerde waarde reproduceerbaar moet zijn. Gemarkeerd met een voorbehoud over kalibratie voor talen met weinig middelen, zoals Plains Cree. Berekend wanneer `unbabel-comet` is geïnstalleerd. Voor 35 Afrikaanse talen selecteert het harnas automatisch AfriCOMET (`masakhane/africomet-mtl`) via `resolve_comet_model()`, dat een betere correlatie met menselijk oordeel heeft voor die talen. |

> **Waarom COMET afzonderlijk wordt gerapporteerd en niet samengesteld.** COMET is getraind op WMT-menselijke-evaluatiedata, overwegend Europese taalcombinaties met veel middelen. Toegepast op Plains Cree of andere LRL's extrapoleer het model vanuit talen met andere morfologische systemen — richtinggevend nuttig maar niet gekalibreerd. In plaats van een modelafhankelijk, ongelijkmatig gevalideerd signaal op te nemen in de hoofdscore, wordt de samenstelling **deterministisch** gehouden (alleen door de verifier reproduceerbare metrieken) en worden COMET/AfriCOMET gerapporteerd in een **aparte neurale baan** (§4.3), opnieuw afgeleid door de verifier. Een neurale samenstelling kan later worden toegevoegd, zodra deze is gevalideerd.
>
> **COMET voor talen met veel middelen wordt gerapporteerd, niet samengesteld (by design).** Voor werkelijk goed gedekte taalcombinaties (Duits, Frans, …) is de standaard `Unbabel/wmt22-comet-da` goed gevalideerd door WMT, en `resolve_comet_model()` selecteert deze. Maar COMET wordt **niet** opgenomen in enige samenstelling — het wordt berekend en weergegeven in de aparte neurale baan zoals elke andere neurale metriek, en opnieuw afgeleid door de verifier. Door de samenstelling deterministisch te houden, wordt voorkomen dat een modelafhankelijke metriek van 2,3 GB verplicht wordt voor de ~100+ talen met `metricModelSupport.xlmr.tier: "high"`, en blijft de hoofdscore reproduceerbaar vanuit het corpus alleen.

> **AfriCOMET voor Afrikaanse talen.** Elke taalkaart heeft een `metricModelSupport`-veld (zie taalkaartspecificatie §9) dat aangeeft welke gespecialiseerde COMET-modellen zijn getraind voor die taal. Voor 35 Afrikaanse talen (yor, hau, ibo, amh, swa, enz.) declareert de kaart AfriCOMET (`masakhane/africomet-mtl`) — een COMET-model dat is verfijnd op menselijke oordelen over Afrikaanse taal-MT door de Masakhane-gemeenschap. Het harnas selecteert automatisch het aanbevolen model via `resolve_comet_model()` dat taalkaarten leest, maar dit kan worden overschreven met `--comet-model`. Het toevoegen van nieuwe taal→model-koppelingen gebeurt door de taalkaart te verrijken (niet door Python-code te bewerken).

### 2.4 Gedragsmetrieken

Gedragsmetrieken detecteren specifieke faalpatronen in vertaaluitvoer. Ze meten kwaliteit niet direct — ze detecteren problemen.

| ID | Metriek | Status | Schaal | Niveau | Implementatie |
|----|---------|--------|--------|--------|---------------|
| `code_switching_rate` | Code-switchingrate | ✅ Geïmplementeerd | 0,0–1,0 (lager is beter) | Beide | Aandeel uitvoerwoorden dat in de brontaal staat (doorgaans Engels). Gedetecteerd via Unicode-scriptanalyse en/of een woordenlijst van de brontaal. Zeer veelvoorkomend LLM-faalpatroon: het model voegt Engelse woorden in wanneer het het equivalent in de doeltaal niet kent. |
| `hallucination_rate` | Hallucinatierate | ✅ Geïmplementeerd | 0,0–1,0 (lager is beter) | Beide | Aandeel uitvoerinhoud zonder overeenkomstige broninhoud. Gedetecteerd via woorduitlijning of taaloverschrijdende inbeddingsoverlap. Detecteert het geval waarbij het model aannemelijk klinkende maar verzonnen vertalingen genereert. |
| `terminology_adherence` | Terminologienaleving | ✅ Geïmplementeerd | 0,0–1,0 | Beide | Voor begeleide methoden: aandeel voorgeschreven terminologietermen dat in de uitvoer voorkomt. Vereist coachingwoordenboekdata. Meet of het model door experts aangeleverd vocabulaire respecteert. |
| `consistency_score` | Consistentie tussen invoeren | 🔲 Gepland | 0,0–1,0 | Alleen corpus | Vertaalt het model dezelfde bronterm op dezelfde manier over invoeren heen? Lage consistentie suggereert dat het model raadt in plaats van aangeleerde patronen toe te passen. Vereist herhaalde termen over corpusinvoeren. |

### 2.5 Compliancemetrieken

Compliancemetrieken valideren dat vertalingen de structurele integriteit bewaren — plaatshouders, opmaak en typografische conventies. Het zijn kwaliteitspoortcontroles, geen kwaliteitsscores.

| ID | Metriek | Status | Schaal | Niveau | Implementatie |
|----|---------|--------|--------|--------|---------------|
| `compliance_index` | Dubbele-doorgang-compliance | ✅ Geïmplementeerd | 0,0–1,0 | Beide | Gewogen samenstelling: 60% variabele integriteit (zijn `{placeholder}`-variabelen bewaard?) + 20% aanhalingstekencompliance (correcte aanhalingstekens per taalkaart) + 20% hoofdlettercompliance (geen Latijns letterlek voor talen zonder hoofdletters). Berekend op zowel ruwe als nabewerkte uitvoer. Via `DoublePassCompliancePlugin`. |
| `repair_effectiveness` | Hersteleffectiviteit | ✅ Geïmplementeerd | 0,0–1,0 | Corpus | Aandeel complianceovertredingen dat automatisch is hersteld door hooks na vertaling. Meet hoeveel de kwaliteitspoort de ruwe uitvoer heeft verbeterd. |

> **Waarom compliance niet in de samenstelling zit.** Compliancemetrieken meten structuurbehoud (plaatshouders, aanhalingstekens), niet vertaalkwaliteit. Een vertaling kan linguïstisch perfect zijn maar compliance niet doorstaan omdat een `{name}`-variabele is weggevallen. Dit zijn kwaliteitspoorten — ze blokkeren slechte uitvoer van verzending, maar ze rangschikken vertaalkwaliteit niet.

### 2.6 Gerapporteerde vergelijkingen (NOOIT in de samenstelling)

Deze worden uitsluitend gerapporteerd voor context/vergelijking en treden nooit toe tot enig samengesteld profiel:

| ID | Metriek | Status | Opmerkingen |
|----|---------|--------|-------------|
| `spbleu` | spBLEU (FLORES-200-tokenizer) | ✅ Geïmplementeerd | BLEU op de FLORES-200 SentencePiece-tokenisatie — vergelijkbaar over schriften/segmentatie heen (de NLLB/FLORES lingua franca). Vereist `sentencepiece` (kernafhankelijkheid). |
| `chrf_plain` | Gewone chrF (`word_order=0`) | ✅ Geïmplementeerd | Het chrF-cijfer dat FLORES/WMT-tabellen rapporteren, naast onze chrF++ (`word_order=2`). |
| `fuse_score` | FUSE-stijl vergelijking | ⚡ Opt-in (`--fuse`) | Een **ongetrainde herimplementatie** van de AmericasNLP-2025 FUSE-aanpak (Raja & Vats): LaBSE semantisch + lexicaal token-F1 + fonetisch Soundex + fuzzy difflib, gemengd als een *ongewogen gemiddelde* (we hebben geen menselijke-oordeeltrainingsdata om de originele Ridge/GBM te fitten, en vermelden dit). LaBSE/Soundex zijn de optionele `fuse`-extra; zonder LaBSE retourneert `compute_fuse` `None` (bekendgemaakt) in plaats van een score te verzinnen. Elk onderdeel dat is uitgevoerd, wordt vermeld in `fuse_components`; het resultaat is gemarkeerd als `fuse_untrained=true`. Hiermee kan het leaderboard FST-gepoortde/structurele scoring vergelijken met een FUSE-stijl basislijn. |

### 2.7 Metrieknaamruimten {#2-7-metric-namespaces}

Een enkele metriek heeft tot vier gecoördineerde namen in de stack: de
**canonieke id** (de `scores`-sleutel in een run card, bijv. `equivalent_match_rate`),
de Python-**pluginnaam** die deze berekent (bijv. `crk_linter`), de taalkaart-
**`evalMetrics`-sleutel** die deze declareert (bijv. `lyss-eq`), en de gedenormaliseerde
**`run_cards`-kolom** op het leaderboard (bijv. `equivalent_match_rate`). Deze zijn
bewust onderscheiden — de pluginnaam geeft het *hulpmiddel* aan, de metriek-id geeft de
*meting* aan — maar ze moeten gesynchroniseerd blijven.

De enige gezaghebbende bron voor die koppeling is `shared/metric-registry.json`, geladen
door `mt_eval_harness.metric_manifest`. Elke invoer registreert de vier namen plus `scale`,
`direction` (hoger/lager/neutraal), `level` (invoer/corpus/beide), `in_composite` en
`verifier_reproducible`. De pariteitstest `arena/tests/test_metric_registry_ssot.py`
mislukt als de gewichtstabellen van `scoring.py` of de `scores`-sleutels van run cards die zijn aangemaakt door
`publish.py` afwijken van het register, zodat een nieuwe metriek niet half-bedraad kan worden verzonden.

Twee gerelateerde run card-velden maken metriekherkomst expliciet:

- **`scores.metric_availability`** — een `{metric: reason}`-blok dat een
  `null`-score verduidelijkt: `not_applicable` (de taal/run gebruikt het niet), `unavailable`
  (een optionele afhankelijkheid ontbrak), `below_coverage_floor` (aanwezig maar te
  schaars om in de samenstelling op te nemen), `not_run` (opt-in en niet aangevraagd), of
  `not_implemented` (gepland). Een metriek die afwezig is uit het blok is normaal berekend.
- **`fst_version`** / **`fst_provenance`** — de geïnstalleerde GiellaLT-transducer-
  release en `pyhfst`-versie achter elke FST-afgeleide metriek, vastgelegd op dezelfde manier
  als de sacreBLEU-handtekeningen zodat een structurele score kan worden herleid tot een exacte
  analysatorbuild.

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

## 4. Samengestelde score {#4-composite-score}

> [!CAUTION]
> **De samenstelling is EXPERIMENTEEL en NIET GEVALIDEERD.** Het is een gewogen aggregaat van metrieken die *voor verschillende talen verschillende dingen betekenen*, met gewichten die **technisch oordeel zijn, niet empirisch afgestemd op menselijke kwaliteitsoordelen**. Geen enkele studie naar menselijke correlatie onderbouwt de weging voor enige doeltaal. Behandel het als een ruwe handige sorteersleutel, **nooit** als een kwaliteitsmeting of een bewering dat het ene systeem "beter" is. Het echte signaal is het **per-metriekprofiel** — elke metriek weergegeven met zijn waarde en validatietier (§1.6). De samenstelling is gelabeld als "experimenteel — niet gevalideerd" overal waar het verschijnt (inclusief het leaderboard), en het is nooit het criterium voor enige prijs of onderscheiding. (By design.)

### 4.1 Formule

De samengestelde score is een gewogen gemiddelde van alle *beschikbare* metrieken, hernormaliseerd zodat de gewichten van beschikbare metrieken optellen tot 1,0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Een metriek is "beschikbaar" als de waarde in de run card een getal is (niet `null`). Wanneer een metriek niet beschikbaar is — omdat de taal geen FST heeft, of omdat een metriek nog niet is geïmplementeerd — wordt het gewicht proportioneel herverdeeld over de resterende metrieken.

**Dit betekent dat de samenstelling altijd vergelijkbaar is binnen een run:** het gebruikt welke metrieken ook beschikbaar zijn en normaliseert dienovereenkomstig. Vergelijking tussen runs is geldig wanneer runs dezelfde set beschikbare metrieken gebruiken.

> [!WARNING]
> **Vergelijkbaarheid tussen runs.** Bij het vergelijken van runs met verschillende beschikbaarheid van metrieken (bijv. de ene run heeft FST-scores, de andere niet), zijn de samengestelde scores **niet direct vergelijkbaar**. Een samengestelde score van 0.72 berekend uit 5 metrieken bevat meer informatie dan een samengestelde score van 0.72 berekend uit 2 metrieken. De exacte set metrieken van elke run is controleerbaar: de run card registreert `scores.scoring_profile` en `scores.metric_availability` (§2.7), en een ongemeten metriek wordt weergegeven als "—" op het leaderboard, nooit als 0. Gebruik voor een rigoureuze vergelijking gepaarde bootstrap-significantietests (§8.2), uitsluitend op gedeelde metrieken.

### 4.2 Invoernormalisatie

Voordat metrieken de samengestelde formule ingaan, moeten alle metrieken op een **0,0–1,0-schaal** staan waarbij 1,0 = perfect:

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

Metrieken die niet in enig samengesteld profiel zitten (`bleu`, `ter`, `length_ratio`, `consistency_score` en de neurale `comet_score`/`qe_score`) worden voor dit doel niet genormaliseerd. (Neurale metrieken worden afzonderlijk gerapporteerd en treden nooit toe tot een samenstelling — §4.3.)

### 4.3 Gewichtstabellen {#43-weight-tables}

**Benoemd profielregister (kaartgestuurd).** De samenstelling wordt niet langer gekozen door een enkele `has_fst`-boolean. Elke taal wordt omgezet naar een **benoemd profiel** via `language_cards.resolve_scoring_profile()`; het profiel benoemt een gewichtstabel, gespiegeld in de `PROFILE_REGISTRY` van `scoring.py`. Een kaart kan `scoringProfile.basis` declareren om te overschrijven; wanneer afwezig, reproduceert de standaard het verouderde gedrag (`fst-coverage` wanneer een FST de run heeft gescoord, anders `surface-only`). Het profiel dat elke samenstelling heeft geproduceerd, wordt op de run card vastgelegd als `scores.scoring_profile`, zodat de weging controleerbaar is per leaderboard-rij.

**Inactieve (gereserveerde) metrieken.** Sommige metrieken dragen een *gedeclareerd* gewicht hieronder maar zijn nog niet actief, zodat ze worden vermeld in `scoring.INACTIVE_METRICS` en **uitgesloten van de samenstelling** totdat ze zowel per invoer worden berekend als opnieuw scoreerbaar zijn door de verifier (de vertrouwenspoort). Het uitsluiten van een afwezige metriek verandert geen score — het maakt "nog niet scoren" expliciet in plaats van stil. Momenteel inactief:

- `orthographic_accuracy` — vereist orthografische regels per taal (nog niet gebouwd).

(`morphological_accuracy` was inactief tot en met P5; **geactiveerd op 2026-06-16** onder het `fst-coverage`-profiel — het wordt berekend (lemma-gematcht; §2.2), treedt toe tot de samenstelling wanneer `morph_coverage ≥ 0.25` (adviserend onder de drempel), en wordt opnieuw afgeleid door de verifier. **Neurale metrieken (`comet_score`, `qe_score`) zijn uitgesloten van elke samenstelling** — ze worden afzonderlijk berekend en gerapporteerd; zie "Neurale metrieken" hieronder.)

#### `fst-coverage` (Profiel A): Talen MET FST-dekking

Voor talen die een GiellaLT eindige-toestandstransducer beschikbaar hebben. Structurele metrieken dragen 40% van de samenstelling (FST 0,25 + morfologische nauwkeurigheid 0,15), wat de primauteit van morfologische correctheid voor polysynthetische/agglutinerende talen weerspiegelt.

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

> **Totaal: 1,00.** Wanneer metrieken niet beschikbaar zijn, worden hun gewichten proportioneel herverdeeld over beschikbare metrieken. `morphological_accuracy` (gewicht 0,15) is **actief** — het treedt toe tot de samenstelling wanneer `morph_coverage ≥ 0.25` en wordt opnieuw afgeleid door de verifier; onder de drempel wordt het herverdeeld zoals elke niet-beschikbare metriek. Wanneer het *afwezig* is (geen FST, of sub-drempel dekking), worden de resterende 8 metrieken (totaalgewicht 0,85) elk geschaald met 1/0,85 ≈ 1,176. Bijvoorbeeld:
> - FST: 0,25/0,85 = 0,294
> - chrF++: 0,15/0,85 = 0,176
> - semantisch: 0,15/0,85 = 0,176

#### `surface-only` (Profiel B): Talen ZONDER FST-dekking

Voor talen zonder morfologische validatietools. Semantische en oppervlaktemetrieken dragen gelijk gewicht.

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

> **Totaal: 1,00.** `orthographic_accuracy` (gewicht 0,05) staat in `INACTIVE_METRICS` (gepland, nog niet berekend). Met het afwezig, worden de resterende 7 metrieken (totaalgewicht 0,95) geschaald met 1/0,95 ≈ 1,053 — een verwaarloosbare impact op de samenstelling.

#### `no-reference`: runs ZONDER gouden referentie

Voor runs waarvan het corpus **geen gouden referenties** heeft (bijv. vloertalen met alleen vervuilde FLORES die we weigeren te scoren). Referentiegebaseerde metrieken (`chrf_plus_plus`, `bleu`, `exact_match_rate`, `equivalent_match_rate`) kunnen niet worden berekend, dus de deterministische samenstelling leunt op de **referentievrije, door de verifier reproduceerbare** signalen.

| Metriek | Doelgewicht | Motivering |
|---------|------------|------------|
| `fst_acceptance_rate` | **0,40** | Morfologische geldigheid heeft geen referentie nodig; het sterkste deterministische signaal wanneer een FST bestaat. |
| `code_switching_rate` | **0,25** | Lek van de brontaal (geïnverteerd). |
| `hallucination_rate` | **0,20** | Verzonnen inhoud (geïnverteerd). |
| `terminology_adherence` | **0,15** | Naleving van begeleid vocabulaire. |

> **Totaal: 1,00.** Alle vier zijn deterministisch en door de verifier reproduceerbaar. Wanneer een run zonder referentie geen FST heeft, hernormaliseert de samenstelling over alleen de gedragscontroles (een bewust dun, eerlijk signaal); de **neurale referentievrije QE-score (AfriCOMET-QE) wordt afzonderlijk berekend en gerapporteerd** — zie "Neurale metrieken" hieronder — als het adequaatheidssignaal voor dergelijke runs.

#### Neurale metrieken — afzonderlijk berekend en gerapporteerd (niet in enige samenstelling)

De samenstelling is **deterministisch**: elke metriek erin is reproduceerbaar door de verifier vanuit het corpus alleen. **Neurale metrieken zijn uitgesloten van elke samenstelling** en worden op zichzelf weergegeven (ontwerpbeslissing — "deterministische samenstelling; neuraal afzonderlijk, mogelijk later afzonderlijk samengesteld"):

| Metriek | Wat het is | Waar het verschijnt |
|---------|-----------|---------------------|
| `comet_score` | COMET / AfriCOMET neurale adequaatheid (referentiegebaseerd) | Eigen leaderboard-kolom + run-card `neural_metrics`, met een voorbehoud over kalibratie voor talen met weinig middelen. |
| `qe_score` | AfriCOMET-QE referentievrije neurale QE (bron + MT) | Dezelfde aparte neurale baan; het adequaatheidssignaal voor `no-reference`-runs. |

Beide worden nog steeds **opnieuw afgeleid door de verifier** (`verifier.recompute_corpus_comet` / `recompute_corpus_qe`), zodat een gerapporteerde neurale score die niet reproduceert niet kan worden vertrouwd — maar ze verplaatsen nooit de deterministische samenstelling. De benoemde set is `scoring.NEURAL_METRICS`. Een neurale samenstelling kan later worden geïntroduceerd; voorlopig staan neurale metrieken op zichzelf.

> **Opmerking over gewichtsontwikkeling.** Deze gewichten zijn voorlopig en zullen worden geherkaliberd naarmate menselijke validatiedata zich opstapelt. Het langetermijndoel is om gewichten empirisch af te leiden: welke geautomatiseerde metrieken voorspellen het beste menselijke kwaliteitsoordelen voor elke taalfamilie?

### 4.4 Een nieuwe metriek toevoegen aan de samenstelling

Om een nieuwe metriek toe te voegen aan de samenstelling:

1. **Definieer het** in §2 met status `🔲 Planned`, inclusief schaal, niveau en berekeningsmethode.
2. **Implementeer het** als een MetricPlugin (of in `tester.py` voor kernmetrieken).
3. **Voeg een nulplaatshouder toe** in het scores-blok van de run card.
4. **Wijs een doelgewicht toe** in §4.3 door bestaande gewichten naar beneden aan te passen. Gewichten moeten optellen tot 1,00.
5. **Werk BENCHMARK_SPEC.md** §3 bij als het run card-schema verandert.
6. **Werk `scoring.py`** gewichtstabellen bij (de code moet dit document weerspiegelen).
7. **Voer een validatiebenchmark uit** om te bevestigen dat de metriek zinvolle waarden produceert op echte data.
8. **Werk dit document bij** om de status te wijzigen van `🔲` naar `✅`.

---

## 5. Kwaliteitstiers {#5-quality-tiers}

Deze tiers zijn heuristische labels op geautomatiseerde samengestelde scores. Ze beschrijven wat de scores in de praktijk doorgaans betekenen, gebaseerd op menselijke beoordeling van uitvoer op elk niveau. **Het zijn geen gevalideerde kwaliteitsoordelen** — alleen menselijke beoordeling kan de werkelijke bruikbaarheid bevestigen.

> [!IMPORTANT]
> **Geautomatiseerde tiers zijn voorlopig.** Deze labels zijn nominaties voor beoordeling, geen kwaliteitsverklaringen. Een methode die "Inzetbaar" bereikt op geautomatiseerde metrieken is een kandidaat voor gemeenschapsevaluatie — geen product om te verzenden. Alleen menselijke beoordeling door tweetalige sprekers kan de werkelijke bruikbaarheid bevestigen (zie [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)). Geen enkele methode kan Inzetbaar of hoger claimen zonder gemeenschapsbeoordeling die bevestigt dat sprekers het oordeel zijn dat de uitvoer bruikbaar is. Tierdrempels kunnen per taal verschillen naarmate menselijke validatiedata zich opstapelt.

| Tier | Samengesteld bereik | Wat een spreker doorgaans ziet |
|------|--------------------|---------------------------------|
| **Basislijn** | 0,00–0,30 | Ruwe LLM-uitvoer zonder taalspecifieke ondersteuning. Morfologie is grotendeels gehallusineerd. |
| **Opkomend** | 0,30–0,50 | Enkele correcte patronen verschijnen. Coaching helpt, maar uitvoer is niet betrouwbaar. |
| **Functioneel** | 0,50–0,70 | Uitvoer is herkenbaar voor een spreker. Grote grammaticale categorieën zijn doorgaans correct. Frequente morfologische fouten. |
| **Inzetbaar** | 0,70–0,85 | Geschikt voor conceptvertaling met menselijke beoordeling. De meeste morfologie is correct. |
| **Vloeiend** | 0,85–1,00 | Benadert competente menselijke vertaling. Fouten zijn zeldzaam en gering. |

Deze tiers zijn voorlopig. Ze zullen worden geherkaliberd naarmate menselijke validatiedata zich opstapelt en we leren waar de drempel "een spreker vindt dit nuttig" werkelijk ligt voor elke taal. Geen enkele methode kan **Inzetbaar** of hoger claimen zonder gemeenschapsbeoordeling die bevestigt dat tweetalige sprekers het eens zijn dat de uitvoer bruikbaar is.

### 5.1 Tierdrempels (machineleesbaar)

Voor code-implementaties zijn de drempels (van boven naar beneden geëvalueerd, eerste overeenkomst wint):

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

Kostenmetrieken meten de financiële efficiëntie van een vertaalmethode. Ze worden afzonderlijk van kwaliteit gerapporteerd — kosten beïnvloeden de samengestelde score niet (behalve in de kostengewogen secundaire rangschikking).

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

### 6.3 Kostengewogen score

Voor methoden die betaalde API's gebruiken, berekenen we een secundaire rangschikking:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Dit beloont methoden die goede scores efficiënt behalen. Het gebruikt `cost_per_entry_usd` (niet per token) omdat de kostengewogen score altijd wordt berekend binnen één enkele benchmark (hetzelfde corpus), waardoor vergelijking per invoer eerlijk is.

De kostengewogen score is een **secundaire rangschikking** — het primaire leaderboard rangschikt op samengestelde score. Het beantwoordt een andere vraag: "gegeven een budget, welke methode geeft de beste resultaten?"

---

## 7. Snelheidsmetrieken

Snelheidsmetrieken meten de latentie en doorvoer van een vertaalmethode. Net als kosten beïnvloedt snelheid de samengestelde score niet.

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

Alle sleutelmetrieken ondersteunen bootstrap-betrouwbaarheidsintervallen (percentielmethode, n=1000 hersteekproeven, α=0,05):

| Metriek | CI gerapporteerd |
|---------|-----------------|
| `chrf_plus_plus` | ✅ `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (alleen berekend wanneer FST-data bestaat) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (gebootstrapt vanuit gecachede per-invoer-scores — geen redundante neurale inferentie) |
| `composite` | ✅ `composite_ci_lower`, `composite_ci_upper` (berekend wanneer chrF++ en exact_match beschikbaar zijn) |
| per-tier CI's | ✅ `confidence_intervals_by_tier` — chrF++ en exact_match CI's per moeilijkheidsniveau (Tier 1-5) |

### 8.2 Gepaarde bootstrap-significantietests

Voor het vergelijken van twee methoden berekent het harnas gepaarde bootstrap-hersteekproeftests:

```
H₀: The two methods perform equally on this corpus.
H₁: One method is significantly better.
```

Als de p-waarde < 0,05 en het betrouwbaarheidsinterval van het verschil nul uitsluit, is het verschil statistisch significant op het 95%-niveau.

---

## 9. Run card-scoresschema

Dit gedeelte definieert de hiërarchische structuur van het `scores`-blok in een run card. Dit schema is afgeleid van de metrieken gedefinieerd in §2–§7 en moet gesynchroniseerd worden gehouden.

```jsonc
{
  "scores": {
    // §2.1 Surface metrics
    "exact_match_rate":       0.6613,       // 0.0–1.0
    "exact_matches":          41,           // count
    "equivalent_match_rate":  0.7258,       // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     45,           // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "chrf_plus_plus":         80.65,        // 0–100 (sacrebleu native scale)
    "bleu":                   54.78,        // 0–100, NOT in composite
    "ter":                    42.3,         // ✅ implemented, 0–∞ (lower=better)
    "length_ratio":           1.03,         // ✅ implemented, ideal=1.0

    // §2.2 Structural metrics
    "fst_acceptance_rate":    1.0,          // 0.0–1.0
    "fst_accepted":           74,           // count
    "morphological_accuracy": 0.83,         // ✅ active: FST-derived, lemma-matched, verifier-re-derived (fst-coverage profile — §4.3)
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     true,         // true when active AND coverage ≥ MORPH_COVERAGE_FLOOR (0.25); else advisory
    "orthographic_accuracy":  null,         // 🔲 planned

    // §2.3 Semantic metrics
    "semantic_score":         0.6842,       // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "comet_score":            null,         // nullable; NEURAL — reported separately, not in any composite (§4.3)
    "comet_model":            "",           // model ID used for COMET

    // §2.4 Behavioral metrics
    "code_switching_rate":    0.03,         // ✅ implemented (lower=better)
    "hallucination_rate":     0.01,         // ✅ implemented (lower=better)
    "terminology_adherence":  null,         // ✅ implemented (null when no glossary)
    "consistency_score":      null,         // 🔲 planned

    // §4 Composite
    "composite":              0.8988,       // 0.0–1.0
    "quality_tier":           "fluent",     // §5 tier label
    "cost_adjusted":          null,         // §6.3 secondary ranking

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "chrf_plus_plus":     { "ci_lower": 78.2, "ci_upper": 83.1 },
      "exact_match_rate":   { "ci_lower": 0.54, "ci_upper": 0.78 },
      "corpus_comet":       { "ci_lower": 0.71, "ci_upper": 0.76 }
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

> **Schemageschiedenis.** Eerdere specificatieconcepten stelden afzonderlijke `cost`-, `speed`- en `tokens`-blokken voor. Deze zijn samengevoegd in respectievelijk `scores` en `totals` voor eenvoud. Snelheidsmetrieken (`tokens_per_second`, `entries_per_minute`, latenties) staan in `scores`; tokenaantallen en kostencijfers staan in `totals`.

### 9.1 Schema–databasekoppeling

De run card JSON wordt volledig opgeslagen als een `jsonb`-kolom in Supabase. Sleutelmetrieken worden ook gedenormaliseerd in kolommen op het hoogste niveau voor sorteer-/filterprestaties:

| Run card-veld | Supabase-kolom | Type | Index |
|--------------|----------------|------|-------|
| `scores.composite` | `composite_score` | `real` | `idx_composite` |
| `scores.quality_tier` | `quality_tier` | `text` | — |
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `scores.bleu` | `corpus_bleu` | `real` | — |
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

Dit document (`cli/website/docs/network/specifications/scoring.md`) is de canonieke bron voor:
- Metriekdefinities (§2)
- Samengestelde gewichtstabellen (§4.3)
- Kwaliteitstierdrempels (§5.1)
- Kostenmetriekformules (§6.2)
- Run card-scoresschema (§9)

### 10.2 Codespiegel

Het bestand `arena/mt_eval_harness/scoring.py` spiegelt de gewichtstabellen en tierdrempels van dit document. Het is de **code-implementatie** van §4.3 en §5.1. Wanneer dit document wordt bijgewerkt:

1. Werk `scoring.py` bij om overeen te komen
2. Voer `pytest tests/test_scoring_ssot.py` uit om uitlijning te valideren
3. Werk FAQ en websitedocumentatie bij die de gewichten samenvatten

### 10.3 Documenten die naar deze specificatie verwijzen

| Document | Waarnaar het verwijst | Hoe gesynchroniseerd te houden |
|----------|----------------------|-------------------------------|
| `cli/website/docs/network/specifications/benchmark-spec.md` §4–§5 | Samengestelde formule, gewichtstabellen, tierdrempels | Kruisverwijzing naar dit document; tabellen niet dupliceren |
| `website/docs/getting-started/faq.md` | Vereenvoudigde gewichtssamenvatting | Moet overeenkomen met §4.3; terugkoppelen naar dit document |
| `cli/website/docs/network/how-it-works.md` | Inzetbare drempel | Moet overeenkomen met §5 |
| `publish.py` via `scoring.py` | Gewichtsdicts + tierfunctie | Geautomatiseerde test valideert overeenkomst |

---

## Bijlage A: Metrieken NIET in de samenstelling (en waarom)

| Metriek | Reden voor uitsluiting |
|---------|------------------------|
| **BLEU** | Woordniveauscoring bestraft morfologische variatie in polysynthetische talen. Een kleine verbuigingsverschil (correcte betekenis, iets ander achtervoegsel) telt als een volledige misser. chrF++ gaat hier beter mee om op tekenniveau. |
| **COMET** | Getraind op WMT-data (Europese taalcombinaties met veel middelen). Voor LRL's (bijv. Cree) extrapoleer het model en is het niet gekalibreerd. COMET/AfriCOMET worden **berekend en gerapporteerd in een aparte neurale baan — nooit in enige samenstelling** (de samenstelling is deterministisch; §4.3) — en opnieuw afgeleid door de verifier. |
| **TER** | Bewerkingsafstand correleert met chrF++ voor de meeste gebruiksscenario's. Beide opnemen zou oppervlaktegelijkenis dubbel tellen. TER wordt gerapporteerd ter referentie. |
| **Lengteratio** | Een diagnostisch hulpmiddel, geen kwaliteitssignaal. Een ratio van 1,02 en een ratio van 0,98 zijn beide prima. Alleen extreme waarden duiden op problemen. |
| **Consistentiescore** | Alleen op corpusniveau — geen per-invoerwaarde om te aggregeren. Bovendien is enige inconsistentie legitiem (hetzelfde Engelse woord → verschillende doeltaalvertalingen afhankelijk van context). |
| **Compliance-index** | Kwaliteitspoort, geen kwaliteitssignaal. Meet structuurbehoud (plaatshouders, aanhalingstekens), niet vertaalnauwkeurigheid. |

## Bijlage B: LYSS — Taalspecifieke metriekimplementaties

Het **LYSS**-raamwerk (Linguistically-informed Yield & Structural Scoring) biedt taalspecifieke metrieken die verder gaan dan oppervlakkige tekenreeksvergelijking. LYSS heeft drie kerncomponenten:

- **LYSS-fst** — Morfologische geldigheid (`fst_acceptance_rate`): Is elk woord een geldige vorm in de doeltaal?
- **LYSS-eq** — Linguïstische equivalentie (`equivalent_match_rate`): Is de uitvoer een aanvaardbare variant van de referentie?
- **LYSS-sem** — Semantische validatie (`semantic_score`): Behoudt de uitvoer de bronbetekenis?

> **Validatiestatus: 🔶 Technische heuristiek.** LYSS-metrieken zijn NIET gevalideerd tegen menselijke kwaliteitsoordelen. Ze zijn ontworpen op basis van linguïstische principes (FST's, woordenboeken, grammaticaregels gebouwd door taalkundigen bij UAlberta ALTLab), maar de correlatie tussen LYSS-scores en werkelijke vertaalkwaliteit is niet gemeten. Zie het [Sprekervalidatieprotocol](/docs/network/specifications/speaker-validation) voor de vereiste validatie-experimenten.

| Taal | Plugin | Locatie | LYSS-component | Metrieksleutel | Opmerkingen |
|------|--------|---------|----------------|----------------|-------------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Deterministische variant-klasseregels: woordvolgorde, orthografisch, optioneel partikel, lemmasynoniem, progressieve ambiguïteit, inclusief/exclusief. Produceert per-invoer `lint_verdict` (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Deterministisch: FST-lemma-extractie + woordenboekglossen + spaCy inhoudswoordoverlap. Produceert verdicts (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| GiellaLT-talen | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Generiek: werkt voor CRK, SME, SMA, SMJ, SMN, SMS, FIN, NOB, IKU — elke taal met een `.hfstol`-analysator. De metriek is generiek, maar **evaluatiecorpora bestaan vandaag alleen voor Plains Cree (crk)**, dus crk is de enige taal die in de praktijk FST-gescoord wordt (zie [Eerlijke beperkingen](/docs/network/honest-limitations)). |

> **Architectuurnotitie (juni 2026).** Taalspecifieke LYSS-metrieken worden nu gedeclareerd op de taalkaart onder `evalMetrics` en geladen vanuit `eval_standards/<lang>/` door `plugin_discovery.py`. Het zijn **evaluatiestandaarden** (scheidsrechter), geen methode-pluginmetrieken (deelnemer). Dit betekent dat elke vertaalmethode gericht op CRK automatisch wordt gescoord door LYSS — geen methodespecifieke configuratie nodig. `CrkFSTMetric` is verwijderd; de functionaliteit ervan wordt volledig gedekt door de generieke `GiellaLTFSTMetric`.

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

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. België, Brussel. Referentie-implementatie: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

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

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montreal, Canada.

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
