---
sidebar_position: 6
title: "Specificatie van metrische betrouwbaarheid"
slug: '/network/specifications/metric-reliability'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What each metric measures and how the harness computes it"
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
---

# Specificatie voor Metrische Betrouwbaarheid

> **Samenvatting.** Een benchmarkscore is slechts zo betekenisvol als de
> metriek erachter — en automatische metrieken komen niet even goed overeen
> met menselijk oordeel in alle talen. Dit document specificeert hoe
> Champollion **metrische betrouwbaarheid** meet: voor elke taalfamilie, hoe
> sterk elke automatische metriek (BLEU, spBLEU, chrF, chrF++, COMET,
> MetricX) correleert met menselijke kwaliteitsoordelen, berekend uit de
> WMT Metrics shared-task-archieven (2019–2025). Het resultaat is een
> gepubliceerd, machineleesbaar bewijs-artefact dat de harness, de CLI en
> de MCP-server raadplegen voordat een score als betrouwbaar wordt
> gepresenteerd. Voor zover wij weten publiceert geen andere
> evaluatie-infrastructuur dit bewijs per taal; het is wat "we hebben een
> metriek uitgevoerd" omzet in "hier is hoeveel u er op kunt vertrouwen."
>
> **Reikwijdte.** Dit document definieert *wat het betrouwbaarheidsbewijs
> is, waar het vandaan komt, hoe het precies wordt berekend, en wat het
> bewust uitsluit*. De definities van metrieken zelf staan in de
> [Scoringsspecificatie](/docs/network/specifications/scoring); statistische
> toetsing van scoreverschillen staat in
> [Significantie](/docs/network/specifications/significance). De importer
> die het artefact regenereert is `arena/scripts/import_wmt_metaeval.py` in de
> harness-repository — de code is het definitieve woord over
> implementatiedetails en staat open voor beoordeling.

---

## 1. Het probleem dat dit oplost

Kwaliteit van machinevertaling is uiteindelijk een menselijk oordeel.
Automatische metrieken bestaan omdat menselijke evaluatie traag en duur is;
elke automatische score is een *proxy* voor wat een competente tweetalige
zou zeggen. De verkorte notatie van het hele vakgebied — "Systeem A verslaat
Systeem B met 2 BLEU" — gaat stilzwijgend uit van de aanname dat de proxy
betrouwbaar is.

Die aanname wordt al jaren getoetst door de WMT Metrics shared task, maar
bijna altijd *in het aggregaat*: metrieken worden gerangschikt op basis van
gemiddelde correlatie met menselijk oordeel over de taalparen die de
campagne van dat jaar omvatte — voornamelijk Europese taalparen met veel
bronmateriaal, plus Chinees en Japans. De details per taal bestaan in de
ruwe data en in bevindingspapers per jaar, maar worden nergens gepubliceerd
als een bevraagbare, per-taalfamilie bewijs-laag die een evaluatiepijplijn
kan raadplegen.

De details zijn enorm belangrijk voor talen met weinig bronmateriaal en
morfologisch rijke talen. Twee bevindingen uit onze eigen import illustreren
de inzet (§7 bevat de volledige tabel):

- **Engels→Inuktitut (wmt20).** De correlatie van BLEU op systeemniveau met
  menselijk oordeel is **+0,16** — in wezen niet-informatief. chrF haalt
  +0,35. COMET bereikt +0,86. Een ranglijst gerangschikt op BLEU voor dit
  taalpaar zou ruis rangschikken; dezelfde ranglijst gerangschikt op COMET
  bevat een signaal.
- **Engels→Maasai (wmt25).** Het omgekeerde falen: de correlatie van
  MetricX-25 is **−0,09** — een geavanceerde *aangeleerde* metriek die een
  taal scoort die afwezig is uit zijn trainingsdata geeft getallen die
  niet gecorreleerd zijn met menselijk oordeel, terwijl berekende chrF++
  (een "domme" tekenreeksmetriek zonder trainingsdata om te missen) +0,50
  haalt.

Geen van beide faalpatronen is zichtbaar in een globaal gemiddelde, en ze
wijzen in tegengestelde richtingen: voor de ene taal is de aangeleerde
metriek de enige bruikbare; voor de andere is het de enige *onbruikbare*.
Elke infrastructuur die honderden taalparen scoort met een vaste
metriekensuite — zoals Champollion doet — is haar gebruikers dit bewijs
verschuldigd.

## 2. Definities

De onderstaande definities zijn het minimum dat nodig is om de rest van het
document nauwkeurig te lezen. Lezers die bekend zijn met MT-evaluatie kunnen
doorgaan naar §3.

**Automatische metriek.** Een functie van (systeemuitvoer, referentievertaling,
en soms de bron) naar een getal. *Tekenreeksmetrieken* — BLEU, spBLEU,
chrF, chrF++ — vergelijken oppervlakteoverlap tussen uitvoer en referentie.
*Aangeleerde metrieken* — COMET, MetricX, BLEURT — zijn neurale modellen
getraind op vroegere menselijke oordelen om kwaliteit te voorspellen.
Canonieke identificatoren voor alle metrieken in dit document komen uit
Champollions metriekregister (`shared/metric-registry.json`): `bleu`, `spbleu`, `chrf_plain`,
`chrf_plus_plus`, `comet_score`, `metricx_score`.

**Menselijke beoordelingsprotocollen.** De WMT-campagnes verzamelden
menselijke kwaliteitsscores onder verschillende protocollen, die dit
artefact afzonderlijk houdt:

- **DA (Direct Assessment)** — crowdworkers of onderzoekers beoordelen een
  vertaling op een schaal van 0–100. *z-genormaliseerde* DA (geschreven
  `wmt-z`) standaardiseert de scores van elke beoordelaar naar gemiddelde 0,
  variantie 1, waardoor effecten van beoordelaarsgrootmoedigheid worden
  verwijderd.
- **DA+SQM** (`da-sqm`, `wmt`) — DA verzameld op een schaal van 0–100
  geannoteerd met beschrijvingen van ankerpunten voor scalaire
  kwaliteitsmetrieken; gebruikt vanaf WMT22.
- **MQM (Multidimensional Quality Metrics)** (`mqm`) — professionele
  annotatoren markeren en classificeren individuele foutspannen met
  ernstgraden; het gewogen foutenaantal wordt een segmentscore. Traag,
  duur, en het meest betrouwbare beschikbare signaal; alleen verzameld voor
  een paar taalparen met veel bronmateriaal per jaar (de annotaties zijn
  afkomstig uit Googles `wmt-mqm-human-evaluation`-releases).
- **ESA (Error Span Annotation)** (`esa`, `esa-merged`) — het protocol van
  WMT24 en WMT25 dat foutspanmarkering combineert met een scalaire
  beoordeling; goedkoper dan MQM, informatiever dan DA.

**Meta-evaluatie.** De evaluatoren evalueren: meten hoe goed de scores van
elke automatische metriek overeenkomen met de menselijke scores over
dezelfde vertalingen. Overeenstemming wordt gemeten op twee niveaus:

- **Systeemniveau** (`sys`): elk MT-systeem krijgt één geaggregeerde
  menselijke score en één geaggregeerde metriekenscore voor een testset;
  overeenstemming wordt berekend over systemen. Dit vraagt: *rangschikt de
  metriek hele systemen zoals mensen dat doen?* — de vraag waar een
  ranglijst om geeft.
- **Segmentniveau** (`seg`): overeenstemming over individuele
  (systeem, zin)-paren. Dit vraagt: *kan de metriek een goede zin
  onderscheiden van een slechte?* — de vraag waar kwaliteitsschatting en
  datafiltering om geven. Dit is veel moeilijker, en correlaties zijn
  systematisch lager.

**Correlatiestatistieken.** Vier standaardstatistieken, hier precies
gedefinieerd zoals berekend:

- **Pearson's r** — lineaire correlatie tussen de twee scorevectoren.
- **Spearman's ρ** — Pearson's r berekend op gemiddelde rangen; meet
  monotone overeenstemming, niet gevoelig voor schaal.
- **Kendall's τ-b** — van alle paren items, het (voor gelijke waarden
  gecorrigeerde) overschot van concordant geordende paren boven discordant
  geordende paren. We gebruiken de standaard voor gelijke waarden
  gecorrigeerde τ-b-formulering (equivalent aan `scipy.stats.kendalltau`;
  onze implementatie is afhankelijkheidsvrij en wordt kruisgecontroleerd
  tegen een brute-force-referentie in de testsuite).
- **Paarsgewijze rangschikkingsnauwkeurigheid** (alleen systeemniveau) —
  van alle systeemparen die mensen *strikt* ordenen, het aandeel dat de
  metriek op dezelfde manier ordent, waarbij een metriekgelijkspel wordt
  geteld als een mislukking om de volgorde te reproduceren. Dit is de
  nauwkeurigheidsstatistiek van Kocmi et al. (2021), die recente
  WMT-campagnes gebruiken als hun hoofdgetal op systeemniveau.

**Taalfamilie.** De genealogische groepering van de *doeltaal* (de taal
waarnaar wordt vertaald), zoals vastgelegd in Champollions taaldatabase
(`languages.family`, afgeleid van Glottolog). §5 bespreekt waarom de
doelzijde, en wat een familie wel en niet als proxy kan dienen.

## 3. Gegevens

### 3.1 Bronnen, vastgezet

| Bron | Wat het biedt | Vastgezet |
|---|---|---|
| `google-research/mt-metrics-eval` (data-archief v2) | Menselijke scores, metriekscores, systeemuitvoer, bronnen en referenties voor elke WMT Metrics-taak-testset, wmt19–wmt25 | code-commit `68a481ae…`; data-tarball `mt-metrics-eval-v2.tgz` van `data.statmt.org`, vastgezet **sha256 `6708eec9aaa8a9deca5e370bdd0e23db4881aeca129f29d5281575eaa66c7e10`**, ETag `36579a46-64ff8bb1d3080`, Last-Modified 2026-04-21, 911.710.790 bytes |
| `google/wmt-mqm-human-evaluation` | De upstream-oorsprong van de MQM-expertannotaties die mt-metrics-eval in samengevoegde vorm herverdeelt; Apache-2.0 | commit `7fadea28…` |

Twee feiten over gegevensintegriteit bepalen de vastzetdiscipline. Ten
eerste is **de data-tarball niet onveranderlijk** — hij wordt op dezelfde
locatie opnieuw gepubliceerd naarmate campagnes worden toegevoegd — dus het
artefact registreert de checksum, ETag en tijdstempel van de exacte kopie
waaruit de getallen zijn berekend, en de importer weigert te draaien zonder
een checksum. Ten tweede dekt de Apache-2.0-licentie van de toolkit zijn
*code*; **de gebundelde menselijke-oordeel- en testsetgegevens bevatten geen
expliciete licentiemelding**. De gevolgen daarvan staan in §8.

De archiefinhoud (≈4,2 GB ongecomprimeerd: menselijke oordelen, referenties
en volledige systeemuitvoer voor elke campagne) wordt **nooit opgeslagen in
deze repository of herverdeeld door Champollion**. Ze worden van de bron
opgehaald naar een lokale cache; alleen afgeleide correlatiegetallen worden
gepubliceerd. Dit is dezelfde ophaal-van-bron-houding die elke
Champollion-benchmark volgt.

### 3.2 Wat elke campagne bijdraagt

| Testset | Paren met menselijke oordelen | Hier gebruikte menselijke protocollen |
|---|---|---|
| wmt19 | 18 | DA-z |
| wmt20 | 18 (incl. en→iu, en→ta, km→en, ps→en) | DA-z; MQM (en→de, zh→en) |
| wmt21.news | 16 (incl. en→ha, en→is) | DA-z; MQM (en→de, zh→en, en→ru) |
| wmt21.tedtalks | 3 | MQM |
| wmt21.flores | 4 (bn↔hi, xh↔zu) | DA-z |
| wmt22 | 17 (incl. en→liv, sah→ru, cs↔uk) | DA-SQM; MQM (en→de, zh→en, en→ru) |
| wmt23 | 9 (incl. he→en) | DA-SQM; MQM |
| wmt23.sent | 1 | MQM |
| wmt24 | 11 (incl. en→is, en→hi) | ESA; MQM |
| wmt25 | 16 (incl. en→bho, en→mas, en→ar) | ESA-merged; MQM |

**Uitgesloten: wmt24pp.** De WMT24++-release breidt de dekking uit naar 55
taalparen maar bevat *alleen referenties en systeemuitvoer* — geen
menselijke oordelen — zodat er geen correlatie uit berekend kan worden. Het
staat vermeld in het uitsluitingsregister van het artefact in plaats van
stilzwijgend te worden weggelaten.

## 4. Methode

De importer doorloopt elke (testset, taalpaar) en berekent één **cel** per
(menselijke-beoordelingslane, niveau, metriek):

1. **Ontdek menselijke lanes.** Alle beschikbare menselijke scorebestanden
   voor het paar worden vergeleken met een expliciete acceptatielijst
   (§4.1). Beoordelaarsbestanden, ruwe foutspanbestanden en scores op
   document-/domeinniveau vallen buiten de reikwijdte.
2. **Sluit menselijke "systemen" uit.** WMT-scorebestanden bevatten de
   referentievertalingen zelf als gescoorde systemen (`refA`, `refb`,
   `HUMAN.0`…). Een metriek correleren met zijn eigen referentie is
   zinloos, dus elk systeem dat overeenkomt met de referentieset van het
   paar of de prefixen `ref`/`human`/`synthetic` wordt overal uitgesloten.
3. **Uitlijnen.** Systeemniveau: de doorsnede van systemen die zowel een
   menselijke als een metriekenscore bevatten (ontbrekende waarden worden
   weggelaten, nooit naar nul gedwongen). Segmentniveau: elk (systeem,
   segment) met beide scores, samengevoegd over systemen zonder groepering
   — dit is mt-metrics-eval's "geen middeling"-afvlakking. Onregelmatige
   bestanden (niet-overeenkomende segmentaantallen) laten de cel mislukken
   in plaats van bij benadering uit te lijnen.
4. **Berekenen.** Pearson, Spearman en Kendall τ-b op beide niveaus;
   paarsgewijze rangschikkingsnauwkeurigheid op systeemniveau. Cellen met
   minder dan 3 uitgelijnde systemen (sys) of minder dan 10 uitgelijnde
   punten over ten minste 2 systemen (seg), of met nulvariantie aan een
   van beide zijden, worden in het uitsluitingsregister opgenomen als
   gedegenereerd (20 cellen in de huidige build).
5. **Samenvoegen.** Per doeltaalfamilie, per metriek, per niveau: het
   n-gewogen gemiddelde van elke statistiek over de *voorkeurs*cellen
   (§4.1), waarbij de bijdragende (testset, paar)-lijst wordt bewaard
   zodat elk aggregaat kan worden teruggeleid naar zijn invoer.

### 4.1 Voorkeur voor menselijke lanes

Waar een paar meerdere menselijke-beoordelingslanes heeft, worden alle
berekend, maar precies één wordt gemarkeerd als **voorkeur** en alleen
voorkeurscellen worden opgenomen in de familiesamenvatting — anders zou een
paar beoordeeld onder zowel MQM als DA dubbel tellen. De voorkeursvolgorde
is op basis van signaalkwaliteit:

```
mqm > esa-merged > esa > da-sqm > wmt-z > wmt-appraise-z > wmt-appraise > wmt > wmt-raw
```

Expertfoutannotatie (MQM) heeft voorrang boven foutspanprotocollen (ESA),
die voorrang hebben boven scalaire directe beoordeling; binnen DA hebben
z-genormaliseerde lanes voorrang boven ruwe. De niet-voorkeurscellen blijven
in het artefact voor iedereen die protocoleffecten wil bestuderen.

### 4.2 Metriekidentiteit en versiebeheer

Aangeleerde metrieken veranderen van jaar tot jaar (COMET-20, COMET-22,
MetricX-23/24/25 zijn verschillende modellen), en ze als één metriek
behandelen zou precies het onderscheid vervagen dat meta-evaluatie bestaat
om te maken. Elke cel registreert daarom de **verbatim upstream-scorenaam**
(`COMET-22`, `MetricX-25-Ref`, `metricx_xxl_MQM_2020`…) naast de canonieke
register-id, en het artefact vermeldt welke upstream-namen elke id hebben
gevoed. Waar een campagne een metriek heeft gescoord tegen meerdere
referenties, wordt de gebruikte referentiestroom ook per cel vastgelegd.

Scores worden gebruikt precies zoals het archief ze distribueert (alle lanes
hoger-is-beter; MQM-foutscores en MetricX worden upstream negatief
opgeslagen). Er wordt geen tekenomkering of herschaling toegepast;
correlaties zijn invariant voor de schaal en de oriëntatieconventie is
empirisch geverifieerd vóór import.

### 4.3 De berekende chrF++-lane

chrF++ — de primaire tekenreeksmetriek van de harness — werd alleen
ingediend bij de wmt20-campagne, zodat upstream-scores voor één jaar
bestaan. Voor elke andere testset berekent de importer chrF++ zelf
(sacreBLEU, `word_order=2`) uit de gecachede systeemuitvoer tegen de
vastgelegde referentie. Deze cellen zijn gemarkeerd als `computed: true` en hun
upstream-naam zegt dit ook: een door Champollion berekende score wordt nooit
gepresenteerd als een WMT-inzending. Alle andere metriekcellen zijn verbatim
upstream-waarden; het enige dat Champollion eraan toevoegt is de
correlatierekenkunde.

## 5. Ontwerpkeuzes, alternatieven en motivering

Dit zijn de beslissingen die een beoordelaar zou moeten onderzoeken. Elke
beslissing vermeldt wat is gekozen, wat niet, en waarom.

**Gesleuteld op doeltaalfamilie.** *Gekozen:* aggregeren op de familie van
de taal waarnaar wordt vertaald. *Alternatieven:* alleen per paar (geen
aggregatie); typologie aan de bronzijde of op paarsniveau; typologische
kenmerkvectoren in plaats van genealogie. *Motivering:* metrische
betrouwbaarheid wordt gedomineerd door hoe moeilijk de *uitvoer*taal te
scoren is — morfologische rijkheid vergroot oppervlaktemismatch voor
tekenreeksmetrieken, en schaarste aan trainingsdata degradeert aangeleerde
metrieken — beide eigenschappen van het doel. Familie is een grove maar
universeel beschikbare sleutel (elke taal in Champollions database heeft
er één); typologische kenmerken zouden fijnmaziger zijn maar ontbreken of
zijn omstreden voor precies de talen met weinig bronmateriaal waarvoor dit
bestaat. De per-paar-cellen worden volledig bewaard, zodat fijnere
heraggregaties (per genus, per morfologisch type) uit het artefact kunnen
worden gebouwd zonder opnieuw te importeren.

**Afgevlakte correlatie op segmentniveau.** *Gekozen:* Kendall τ-b over de
samengevoegde (systeem, segment)-vector. *Alternatieven:* item-gegroepeerde
paarsgewijze nauwkeurigheid met gelijkspelkalibratie (de acc*-eq van recente
WMT-bevindingen); per-segment τ gemiddeld over segmenten. *Motivering:* de
afgevlakte statistiek is de eenvoudigste verdedigbare keuze, is exact
reproduceerbaar vanuit zijn definitie zonder een gelijkspelkalibratieproce-
dure, en behoudt de taaloverkoepelende vergelijkbaarheid die dit artefact
nodig heeft. Het is *niet* de nieuwste WMT-hoofdstatistiek, en §8 vermeldt
dat als een beperking in plaats van equivalentie voor te wenden.

**Metriekgelijkspellen tellen tegen de metriek** in paarsgewijze
nauwkeurigheid. Een metriek die twee systemen niet kan scheiden die mensen
wel scheiden, heeft de menselijke volgorde niet gereproduceerd; halve
punten geven zou scorekwantisering belonen.

**Gewogen gemiddelden in de samenvatting.** Familieaggregaten wegen elke
cel naar zijn steekproefomvang (systemen op sys-niveau, punten op
seg-niveau), zodat een 17-systeem MQM-paar meer telt dan een 6-systeem
DA-paar. De ongewogen per-celwaarden blijven beschikbaar.

**Drempelwaarden.** Cellen hebben ≥3 uitgelijnde systemen nodig (een
correlatie over 2 punten is zinloos) of ≥10 uitgelijnde segmentpunten over
≥2 systemen. Dit zijn ondergrenzen tegen gedegenereerde rekenkunde, geen
significantieclaims — §8.

**Verbatim-upstream-discipline.** Champollion herberekent niets wat het kan
citeren (behalve de gemarkeerde chrF++-lane), omdat opnieuw gescoorde
aangeleerde metrieken versie- en omgevingsdrift zouden introduceren die de
per-cel upstream-namen bestaan om te voorkomen. De afweging —
dekkingslacunes waar een campagne een metriek niet heeft uitgevoerd — is
zichtbaar als ontbrekende cellen in plaats van weggemoffeld.

**Eerlijk-mislukken-uitsluitingen.** Alles wat wordt overgeslagen (een
testset zonder menselijke oordelen, een onoplosbare taalcode, een
gedegenereerde cel) wordt met een reden naar een uitsluitingsregister
geschreven. Een lezer van het artefact kan opsommen wat er *niet* in staat
— de eigenschap die de meeste geaggregeerde rapporten missen.

## 6. Het gepubliceerde artefact

Het bewijs wordt geleverd als één machineleesbaar JSON-bestand, bijgehouden
in de monorepo (bewust niet gebundeld in de npm/PyPI-pakketten):

```
shared/catalogue/metric-reliability.json    # the artifact (≈0.6 MB)
shared/schemas/metric-reliability.schema.json  # its JSON-Schema contract
```

Huidige build: **1.810 cellen** (1.052 voorkeur) over **57 taalparen**,
**10 testsets**, **11 doelfamilies**, met 21 registeruitsluitingen.
Blokken op het hoogste niveau: vastgezette `sources` en `provenance` (elke
afgeleide waarde draagt `champollion-derived`-herkomst die de upstreams benoemt —
de correlaties zijn van ons, de oordelen niet); `correlation_definitions` (de exacte
statistiekdefinities van §2); `metrics` (register-id ↔ upstream-namen);
`languages` (code → familie/genus); `families` (de samenvatting); `cells`
(elke correlatie, volledig toegeschreven); `excluded` (het register).

Drie consumentenoppervlakken lezen het vandaag:

- **Harness CLI:** `mt-eval recommend SRC TGT` geeft een blok "metriekvertrouwen
  voor het doel" weer naast beschikbaarheid van methoden en geciteerde
  resultaten.
- **Champollion CLI:** `champollion recommend SRC TGT` (zelfde payload-contract;
  het artefact wordt bijgehouden in de monorepo, zodat verpakte installaties
  degraderen naar een expliciete melding "index niet beschikbaar").
- **MCP-server:** het `get_metric_reliability`-gereedschap beantwoordt "welke metriek
  moet ik vertrouwen voor taal X?" voor elke verbonden AI-agent, inclusief
  een expliciet UNMEASURED-antwoord voor talen die geen WMT-campagne heeft
  beoordeeld.

## 7. Overzicht van resultaten

Pearson-correlatie op systeemniveau met de voorkeurs menselijke lane,
gewogen gemiddelde per doelfamilie (huidige build; segmentniveaugetallen,
Spearman, τ-b en paarsgewijze nauwkeurigheid staan in het artefact):

| Doelfamilie | Paren | BLEU | spBLEU | chrF | chrF++ | COMET | MetricX |
|---|---|---|---|---|---|---|---|
| Afro-Aziatisch | 2 | +0,88 | +0,95 | +0,85 | +0,87 | +0,67 | **−0,62** |
| Dravidisch | 1 | +0,88 | — | +0,94 | +0,93 | +0,94 | — |
| Eskimo-Aleut | 1 | **+0,16** | — | +0,35 | +0,33 | **+0,86** | — |
| Indo-Europees | 42 | +0,75 | +0,76 | +0,79 | +0,76 | +0,81 | +0,84 |
| Japons | 1 | +0,52 | +0,89 | +0,93 | +0,84 | +0,73 | +0,74 |
| Koreaans | 1 | +0,89 | +0,87 | +0,87 | +0,88 | +0,55 | +0,77 |
| Niger-Congo | 2 | +0,94 | — | +1,00 | +1,00 | +1,00 | — |
| Nilotisch | 1 | — | — | — | +0,50 | — | **−0,09** |
| Sino-Tibetaans | 2 | +0,49 | +0,68 | +0,68 | +0,62 | +0,72 | +0,82 |
| Turks | 1 | +0,85 | — | +0,97 | +0,97 | — | — |
| Oeraalsch | 3 | +0,85 | +0,88 | +0,91 | +0,91 | +0,75 | +0,81 |

Hoe dit te lezen — en hoe niet:

- **Het brede patroon komt overeen met de geaggregeerde bevindingen van het
  vakgebied.** Op de 42-paar Indo-Europese bulk leiden aangeleerde metrieken
  (MetricX +0,84, COMET +0,81) met chrF erachter en BLEU als laatste —
  het standaard WMT-resultaat, hier gereproduceerd uit ruwe data als
  betrouwbaarheidsanker.
- **De per-familie afwijkingen zijn de kern van de zaak.** Voor het
  polysynthetische Inuktitut storten tekenreeksmetrieken in en is COMET
  het enige bruikbare signaal. Voor Maasai en voor Engels→Arabisch in
  wmt25 correleert MetricX *negatief* terwijl tekenreeksmetrieken bruikbaar
  blijven — een aangeleerde metriek die extrapoleer buiten zijn
  trainingsdistributie faalt stilzwijgend, met zelfverzekerd ogende scores.
  Dit zijn precies de gevallen die een globaal gemiddelde uitwist.
- **Eén-paar-families zijn bewijs, geen conclusies.** Acht van de elf
  families steunen op één of twee paren uit één campagne. De eerlijke
  lezing van "Eskimo-Aleut: BLEU +0,16" is *"in de ene campagne waar
  mensen en→iu beoordeelden, was BLEU niet-informatief"* — een gedocumenteerde
  meting, een waarschuwingssignaal, en een reden om meer te verzamelen,
  geen wet over de familie.
- **Een negatieve cel betekent niet dat de metriek overal kapot is.** Het
  betekent: op dat paar, in de systeempool van die campagne, ordende de
  metriek systemen tegen het menselijk oordeel in. Bereikbeperking (zie §8)
  kan elke correlatie verlagen wanneer systemen qua kwaliteit dicht bij
  elkaar liggen.

## 8. Beperkingen

Duidelijk gesteld, omdat de waarde van het artefact zijn eerlijkheid is:

1. **Familie is een proxy, geen mechanisme.** Genealogische familie
   correleert met, maar bepaalt niet, de morfologische eigenschappen die
   metriekgedrag sturen. De per-paar-cellen (met genus vastgelegd per taal)
   maken fijnere segmentatie mogelijk; de familiesleutel is een bevraagbare
   standaard, geen claim van typologische causaliteit.
2. **Dekking is wat WMT heeft beoordeeld, niet wat de wereld spreekt.**
   57 paren, zwaar Europa-gewogen; elk xx→Engels-paar valt onder
   Indo-Europees; hele macrofamilies (Algonquian, Austronesisch, Quechua, …)
   hebben *helemaal geen menselijke-oordeelsdekking*. Daarvoor antwoorden
   Champollions oppervlakken UNMEASURED in plaats van het getal van een
   buurman te lenen. Champollions eigen soevereine-benchmark-programma —
   door de gemeenschap gecontroleerde testsets met validatie door
   moedertaalsprekers — is de langetermijnoplossing voor precies deze lacune.
3. **Overdracht binnen de familie is een aanname.** Wanneer een bevraagde
   taal nooit direct is beoordeeld, komt bewijs op familieniveau van
   *andere* talen in de familie, en elk consumentenoppervlak zegt dit
   expliciet.
4. **Nog geen betrouwbaarheidsintervallen.** Cellen bevatten steekproef-
   omvangen maar geen bootstrap-intervallen; eén-paar-familieaggregaten
   in het bijzonder moeten worden gelezen met de breedtes die §7 impliceert.
   Het toevoegen van per-cel bootstrap-CI's (de harness heeft al de
   machinerie voor score-CI's) is gepland werk.
5. **Bereikbeperking.** Correlaties worden berekend over de ingediende
   systemen van elke campagne. Recente campagnes clusteren veel sterke
   systemen dicht bij elkaar, wat correlaties voor alle metrieken verlaagt
   — deels waarom wmt25-afgeleide cellen (Maasai, Arabisch) extreme waarden
   tonen. De per-testset-toeschrijving op elke cel houdt dit inspecteerbaar.
6. **Keuze van statistiek op segmentniveau.** De afgevlakte τ-b is eenvoudig
   en reproduceerbaar maar is niet de gelijkspelgekalibreerde gegroepeerde
   nauwkeurigheid van de meest recente WMT-bevindingspapers; getallen hier
   mogen niet cijfer voor cijfer worden vergeleken met die publicaties.
7. **Gegevenslicentie.** De upstream menselijke-oordeelsgegevens bevatten
   geen expliciete licentiemelding (§3.1). Champollion herverdeelt er geen
   van, publiceert alleen afgeleide statistieken met volledige toeschrijving,
   en houdt dit artefact in een **niet-commerciële bewijs-lane**
   (`license_lane.commercial_ok: false`) totdat de houding is opgelost. De MQM-lanes zijn
   bovendien terug te voeren op Googles Apache-2.0-annotatie-releases.
8. **Het archief is een bewegend doel.** Nieuwe campagnes worden toegevoegd
   aan dezelfde tarball-URL. De vastzetpunten identificeren onze momentopname
   exact; regeneratie tegen een nieuwere momentopname is een nieuwe
   artefactversie met nieuwe vastzetpunten, nooit een stille update.

## 9. Reproductie

Het artefact kan door iedereen opnieuw worden gegenereerd vanuit de bron:

```bash
# 1. Fetch the archive (912 MB compressed; NOT immutable — keep the pins)
mkdir -p ~/.mt-eval/mt-metrics-eval && cd ~/.mt-eval/mt-metrics-eval
curl -sSL -D mt-metrics-eval-v2.headers -o mt-metrics-eval-v2.tgz \
     https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz
shasum -a 256 mt-metrics-eval-v2.tgz > mt-metrics-eval-v2.sha256
tar xzf mt-metrics-eval-v2.tgz

# 2. Regenerate (refuses to run without a checksum pin)
python3 arena/scripts/import_wmt_metaeval.py
```

Merk op dat de eigen README van het archief verwijst naar een buiten gebruik
gestelde storage.googleapis.com-URL; `data.statmt.org` is de actieve host. De
importer is pure Python-standaardbibliotheek (alleen sacreBLEU voor de
berekende chrF++-lane); de correlatie-implementaties worden kruisgecontroleerd
tegen brute-force-referenties in `arena/tests/test_wmt_metaeval.py`, en het
structurele contract van het artefact wordt afgedwongen door zijn
JSON-schema plus integriteitstests in beide runtimes.

## 10. Dankbetuigingen en citatie

De hier samengevatte menselijke oordelen zijn het werk van de **WMT
Metrics shared-task-organisatoren en annotatoren** — waaronder Markus
Freitag, Nitika Mathur, Tom Kocmi, en vele medewerkers over de campagnes
van 2019–2025 — en van het **Google MQM-annotatieprogramma** (Freitag et
al., *Experts, Errors, and Context*, TACL 2021; `google/wmt-mqm-human-evaluation`). Het archief
en de toolkit worden onderhouden als `google-research/mt-metrics-eval`. Paarsgewijze
rangschikkingsnauwkeurigheid volgt Kocmi, Federmann et al. (2021), *To Ship
or Not to Ship*. Champollions bijdrage is de per-taalfamilie-organisatie,
de correlatieberekening en de eerlijkheidssteiger eromheen — elk getal in
het artefact draagt `champollion-derived`-herkomst die de upstream benoemt waarvan het
is afgeleid, en geen van hun tekst, oordelen of scores wordt herverdeeld.

Wanneer u betrouwbaarheidsgetallen uit dit artefact citeert, citeer dan
zowel de WMT-campagne(s) die de cellen toeschrijven als de artefactversie
van Champollion (het `sources`-blok bevat de exacte gegevensvastzetpunten),
en respecteer de niet-commerciële bewijs-lane beschreven in §8.
