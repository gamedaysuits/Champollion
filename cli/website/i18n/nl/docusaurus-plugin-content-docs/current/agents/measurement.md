---
title: "Meetregels"
slug: /agents/measurement
description: "Hoe Champollion een vertaler meet en hoe een agent hierover rapporteert: de scoringsstandaard (corpus-chrF++ met een bootstrap-interval van 95%), gated scores, dev versus test, voorspellingen, bijna-kopieën, de woordenboekondergrens, de regel voor gepaarde oordelen en de ondergrens van 50 zinnen daaronder, waar de wensenlijst op stuurt, de beoordelingen van de spreker, de blinde vergelijking tussen twee modellen, het oordeel van de spreker, opnieuw getoonde rijen (overeenstemming, willekeurige fout, drift) en hoe u een getal uitdrukt."
---

# Meetregels

De rails beloven dat de mensen zullen **weten** hoe goed een model is op hun eigen
zinnen — niet dat het goed is. Die belofte rust op enkele regels, waarvan de meeste
worden afgedwongen. Deze pagina zet ze exact uiteen en sluit af met hoe u een
getal verwoordt.

## De scorestandaard (standard/1)

Elke nieuwe run wordt op dezelfde manier gescoord (`arena/mt_eval_harness/scoring.py`):

- **Het hoofdresultaat:** **chrF++** op corpusniveau (sacreBLEU chrF met woordvolgorde
  2), van 0 tot 100 — hoger betekent dichter bij de referentvertalingen —
  met het bijbehorende **95%-bootstrap-interval** en de sacreBLEU-handtekening. Geschreven als
  `chrF++ 47.5 [45.9, 49.0]`.
- **Welke segmenten meetellen:** één regel voor het hoofdresultaat, het interval en elke
  vergelijking. Een segment waarvan de vertaling is mislukt, telt als een lege uitvoer —
  nooit weggelaten, nooit gescoord als tijdelijke aanduiding; een segment zonder referentie
  wordt overal buiten beschouwing gelaten.
- **Het interval:** dat van het hoofdresultaat zelf — percentielbootstrap over die
  segmenten, 1.000 resamples, seed 12345, α 0,05. Bij minder dan 30 segmenten waarschuwen de tools
  dat het interval mogelijk een gebrekkige dekking heeft; bij minder dan 2 is er
  geen interval.
- **Ernaast, nooit vermengd:** BLEU, spBLEU, TER en COMET wanneer deze is
  berekend, elk met de bijbehorende handtekening of model-ID.
- **Diagnostiek, apart:** exacte overeenkomst, equivalente overeenkomst, FST-acceptatie,
  morfologische nauwkeurigheid, semantische validator, codewisseling, hallucinatie,
  terminologienaleving, schrijfstijl. Ze komen nooit in een hoofdresultaat terecht en bepalen
  nooit een rangorde.
- **"Beter" is een gepaarde significantietoets** op chrF++, nooit twee getallen
  die op het oog worden vergeleken.
- **Geen kwaliteitslabels.** Alleen menselijke evaluatie certificeert kwaliteit.

**Vervallen:** de gewogen samengestelde score en de kwaliteitsniveaulabels. Een
standard/1-runcard bevat `composite: null` en `quality_tier: null`.
**Let op.** Toon, bereken of citeer nooit een samengestelde score of niveau, zelfs niet van een
oude kaart.

**Score-voorbehouden** zijn diagnostische gegevens die naast een score worden vermeld, nooit een wijziging ervan:
`source_copy` (de helft of meer van de uitvoer kopieert de bron),
`length_inflation` en `length_deflation` (uitvoer die meer dan tweemaal, of minder dan de helft,
van de referentielengte is — gemiddeld, of in een kwart of meer van de segmenten), `near_constant_output` (één uitvoer herhaald over veel
bronnen), en `train_test_near_twin` (testrijen met een tweeling in de trainingsdata —
ernstig wanneer de helft of meer dat heeft). **Let op.** Geef elk voorbehoud samen met de score
woord voor woord door.

## Gated meting

Wanneer een run een poortketen heeft ([methoden en poorten](/docs/agents/methods#gate-chains)),
is **wat gemeten wordt wat geleverd wordt**:

- de chrF++ van het hoofdresultaat scoort de gated uitvoer;
- de ungated chrF++, met het bijbehorende interval, staat ernaast
  (`overall.gates.ungated`);
- het **weigeringspercentage** — segmenten die de poorten weigerden ÷ beoordeelde segmenten — is een
  opzichzelfstaand getal, met tellingen per poort en op basis van wat er geleverd is (`shipped_from`:
  methode, bron, fallback, niets);
- de **vingerafdruk** van de keten (sha256 van de canonieke JSON) reist mee met het
  rapport en elke gepubliceerde run.

**Vergrendeling.** Geen fallback bij metingen: `mt-eval run` en `mt-eval test` weigeren
een keten waarvan de poorten geweigerde segmenten doorgeven aan een fallback, voordat er iets wordt
vertaald of verbruikt.

**Let op.** Rapporteer een gated-score altijd samen met de ungated-score en het weigeringspercentage.
Een gated-score alleen verbergt wat de poorten hebben verworpen.

## Sets en waar ze voor dienen

| Rol | Gebruikt voor | Lezen |
|---|---|---|
| `train` | Leren | Nooit gescoord als resultaat |
| `dev` (oefenen) | Het checkpoint kiezen; beoordelen van verbeteringsrondes (vanaf 50 zinnen); de woordenboekondergrens | Vrij |
| `test` | Mijlpalen: een model testen, afgezet tegen de voorspelling van de mensen | Voor elke lezing die scoort is een preregistratie (forge) nodig; elke lezing wordt gelogd |
| `sealed` | Een test die niemand buiten de houders ervan te zien krijgt | Eenmalig |

**In nmt-forge** (het register, `.forge/eval-registry.json`; het grootboek):

- **Vergrendeling.** Elke leesactie van een geregistreerde set wordt met het doel ervan vastgelegd
  in het hash-gekoppelde grootboek (`score`, `dev-selection`, `audit`, `inspect`).
- **Vergrendeling.** Het scoren van een testset vereist een geldige preregistratie voor de
  huidige inhoud ervan.
- **Vergrendeling.** Een verzegelde set wordt eenmaal gescoord. Een tweede score wordt geweigerd (`sealed
  set '<name>' has already been spent`); a single `mt-eval`-leesactie van het verzegelde
  bestand verbruikt deze eveneens. `--override-respend '<reason>'` (op `nmt-forge score`
  en `nmt-forge compare`) wordt naar het grootboek geschreven. `export` weigert
  opnieuw te verbruiken en vermeldt `--no-eval`.
- **Vergrendeling.** Het dev-hekwerk: training vereist een geregistreerde `dev`-set; dev-rijen mogen
  geen exacte bron of doel delen met een test- of verzegelde set; geen enkele trainingsrij
  mag een dev-rij zijn.

**In mt-eval:**

- **Let op.** `mt-eval run` en `mt-eval compare` scoren een test- of verzegeld bestand
  zonder enige preregistratie en weigeren nooit op basis van het aantal leesacties. `mt-eval run`
  voegt alleen een regel toe aan het leeslogboek van het bestand (`<file>.reads.jsonl`) wanneer forge
  er een heeft aangemaakt; `compare` en `test` loggen niets. Scoor de testset nooit met
  mt-eval voordat de voorspelling van de mensen is vastgelegd.

## Voorspellingen

```bash
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge prereg new round-2 --eval-set project-test --predictions predictions.json
nmt-forge prereg template --out predictions.json
```

- `--expect` en `--rationale`: één vrije-tekstvoorspelling over chrF++, in de
  eigen woorden van de mensen. Het oordeel is aan de mensen: `nmt-forge prereg verdict
  <id> --prediction <n> --held` (or `--missed`) `--by "<who>"`.
- `--predictions <file>`: een JSON-array; elke voorspelling bevat een `metric` en
  een `rationale`, en ofwel een `direction` (`increase`, `decrease`,
  `no_change`) met een `baseline_score` (en optioneel `margin`) — beoordeeld door de
  tools — of een vrije-tekst-`expect`.
- **Vergrendeling.** Een voorspelling die is geschreven na een leesactie voor scores van de set (door forge,
  of door `mt-eval run`) wordt geweigerd: *"eval set '…' was already read for scoring
  (N time(s): …) before this preregistration"*. `--allow-after-reads` laat dit
  door, en elk rapport, elke export en elke status vermeldt dit.
- **Let op.** De voorspelling is van de mensen, geschreven voordat er enige score bestaat,
  nooit door u geherformuleerd of ingeperkt. De vraag van de rails suggereert geen getal
  (*"No number is suggested here, so the guess stays theirs"*); doe dat zelf dus ook niet.

## Bijna-kopieën

`nmt-forge leak-audit` vergelijkt elk trainingspaar met elke geregistreerde dev-,
test- en verzegelde set:

| Gevonden | Regel | Wat er gebeurt |
|---|---|---|
| Zelfde bestand | sha256 | Verwijderd |
| Exacte kopie | Zelfde bron of zelfde doel na normalisatie | Verwijderd |
| Bijna-kopie | Doelwoordensets overlappen ≥ 0,6 (Jaccard) waarbij de ene de andere bevat, of ≥ 0,9 | Verwijderd |
| Sjabloonverwant | Zelfde zinsframe, ander antwoord | **Behouden** om van te leren, en geteld, zodat de score kan worden gelezen met en zonder die testrijen |
| Alleen-bron-overeenkomst | Zelfde prompt, ander antwoord | Behouden, gerapporteerd |

Korte zinnen worden vergeleken op basis van karakter-trigrammen; zeer korte alleen op
exacte overeenkomst. Een testrij is een **bijna-tweeling** wanneer een trainingsrij identiek is of
deze aan weerszijden voor ≥ 0,6 overlapt; wanneer de helft of meer van de testrijen
tweelingen heeft, is de score voornamelijk herinnering, geen vertaling, en is het voorbehoud ernstig.
`--clean-to` schrijft het gecontroleerde bestand; `--drop-test-twins` verwijdert ook de
trainingsrijen die een tweeling vormen met een testrij, voor een tweelingvrije score.

De eerste dev-splitsing van de rails hanteert dezelfde drempel: `--near-dupe 0.6` op
`nmt-forge split` behoudt rijen waarvan de woorden voor ≥ 0,6 overlappen aan één zijde van de
dev/training-grens, zodat de eerste dev-score geen bijna-kopiegeheugen bevat dat bij de controle
van een latere ronde geweigerd zou worden. `--max-group` begrenst een bijna-kopiegroep op de helft van de
dev-omvang plus één, zodat een bestand dat vanuit sjablonen is opgesteld alsnog wordt gesplitst.

**Let op.** Zeg alleen "de lekaudit vond …" op basis van `true_now` of de eigen uitvoer
van de audit, en zeg nooit uit uzelf "de testset is schoon".

## De woordenboekondergrens

`nmt-forge floor <word lists>` vertaalt de dev-set woord voor woord met het
woordenboek (langste frase eerst) en scoort deze met dezelfde code als de dev-score
van een run: chrF++ met het bijbehorende 95%-interval. Dit draait op deze computer, leest nooit
de testset, en legt alleen de namen van de woordenboeken, hashes en aantallen invoeren vast,
hoeveel bronwoorden ze bereikten, en de scores. Een run **verslaat de ondergrens**
alleen wanneer de ondergrens van het dev-interval boven de bovengrens van dat van
de ondergrens ligt; `nmt-forge status` waarschuwt bij een run waarbij dat niet het geval is.

## Twee modellen vergelijken

**Een verbeteringsronde** (`nmt-forge compare-runs <in-use> <new>`): de vertalingen van beide modellen van
**dezelfde dev-zinnen**, rij voor rij gekoppeld; een gepaarde
approximate-randomization-toets (1.000 trials) en een 95%-bootstrap-interval op
het verschil.

| Oordeel | Regel |
|---|---|
| **too-few** | minder dan 50 dev-zinnen, ongeacht de scores — het model in gebruik blijft, en de blinde beoordelingen van de spreker geven de doorslag (hieronder) |
| **better** | 50 of meer, p < 0,05 **en** de ondergrens van het interval ligt boven 0 — het nieuwe model wordt voor gebruik aangeboden; het wordt alleen in gebruik genomen bij een 'ja' van de gemeenschap |
| **worse** | 50 of meer, p < 0,05 en de bovengrens van het interval ligt onder 0 |
| **no-change** | al het andere — het model in gebruik blijft |

**Waarom 50.** Gemeten aan de hand van de ByT5-small-uitvoer van de verzonnen testtaal, 100
willekeurige oefensets per grootte, met deze regel: bij 23 dev-zinnen noemde
het twee nagenoeg gelijke modellen (0,7 chrF++ verschil op 500 zinnen) 9 van
de 100 keer verschillend, en noemde het een werkelijke winst van +5,9 chrF++ slechts
21 van de 100 keer **better**; bij 50 zinnen was dat 4 keer en 96 keer op de 100.
Het kleinste verschil dat in 8 van de 10 gevallen werd gezien, was 8,1 chrF++-punten
bij 23 zinnen, 5,8 bij 50, 4,0 bij 100 en 2,8 bij 200. Daarom reserveert de eerste
splitsing van de rails minstens 50 dev-zinnen wanneer er 200 paren of meer zijn —
een op de tien van de gecontroleerde paren, maximaal 500; bij minder dan 200 paren
een kwart daarvan, wat minder dan 50 is — en breiden de controlebladen de set
uit met oefenrijen: één op de twee rijen zolang het aantal onder de 50 ligt, één
op de vier totdat het 200 bereikt.

Elk oordeel vermeldt ook het kleinste verschil dat de dev-set betrouwbaar
aantoont (8 van de 10 keer): de breedte van het interval × (1,96 + 0,84) ÷ (2 × 1,96). Wanneer dat
meer dan 3 chrF++-punten is, is "no-change" de beperking van de dev-set, geen bewijs dat
de ronde niets heeft opgeleverd. De dev-set koos ook het checkpoint van de nieuwe run, wat
het nieuwe model licht bevoordeelt — **vermeld dit** wanneer u een oordeel doorgeeft.

Een blinde voorkeur van de spreker voor het nieuwere model (hieronder) zorgt
ervoor dat forge het pas voor gebruik aanbiedt na een oordeel **too-few** of
**no-change** — nooit na **worse** — en de mensen zeggen eerst ja (`improve-promote`,
modus `confirm`). Een blinde voorkeur voor het model dat door een promotie werd
vervangen, zet het nooit direct terug: de actie in het ronderapport vraagt het aan de mensen.

**Willekeurige twee runs** (`mt-eval compare <report> <report> --significance`):
standaard approximate randomization (`--method paired_bootstrap` voor de
andere), 1.000 trials (`--n-bootstrap`), α 0,05, seed 12345, op de vermeldingen die de
rapporten delen op id (een waarschuwing onder de 10). chrF++ eerst, daarna de secundaire
metrieken. Elk paar runs wordt getoetst; er is geen correctie voor meervoudig toetsen,
en de uitvoer vermeldt dat.

## Waar de verlanglijst op stuurt

`nmt-forge analyze` splitst de dev-chrF++ van een run uit naar zinstype (met
minstens 5 dev-zinnen van dat type). Een type is het **zwakst** — en weegt mee op
de verlanglijst — alleen wanneer het 95%-interval voor hoever de zinnen ervan onder
de rest scoren volledig boven nul ligt (Welchs interval op chrF++ op zinsniveau).
Een lagere score die op toeval kan berusten, wordt als zodanig gerapporteerd (*"… could be chance —
the wishlist does not steer by it"*) en weegt nooit mee op het overzicht.

De sectie "Woorden die het nog nooit heeft gezien" vraagt om twee of drie zinnen met
elk woord, die elk iets anders uitdrukken, niet één: bij de verzonnen testtaal
kwam een woord dat één keer in de training werd gezien in 27–29% van de gevallen goed uit de verf en
een woord dat 2–4 keer werd gezien in 63–95%; en bij 3.200 trainingszinnen had ByT5-small,
getraind op zinnen geselecteerd op de meeste nieuwe woorden, bij 39,4% van 500 apart gehouden
zinnen de betekenis juist, tegenover 53,4% bij alledaagse zinnen, bij
iets meer tijd van de spreker (ongeveer 57 uur tegenover 54).

## De beoordelingen van de spreker

In elke verbeterronde markeert de spreker de concepten van het model voor nieuwe zinnen als
`Y`, `N` of `?`. Het aandeel juist is `Y ÷ (Y + N)` (`?`, ongemarkeerd,
oefenrijen en opnieuw getoonde rijen weggelaten), met een 95%-Wilson-interval. Een stijging tussen rondes telt alleen als
**vooruitgang** wanneer het interval van de laatste ronde volledig boven dat van de
eerste ligt, tussendoor een model uit een ronde in gebruik is genomen — gekozen door de mensen
(de records `export` en `choose` van forge), hetzij na een **beter**-oordeel,
op basis van de blinde beoordelingen van de spreker of op eigen keuze; een **beter**-oordeel
alleen telt niet — **en** de blinde controles van elke promotie door de spreker
(hieronder), samengevoegd over de tussenliggende rondes, de nieuwe modellen duidelijk
vaker als juist beoordeelden dan degene die ze vervingen (|z| > 1,96).
Dit zijn zinnen die geen enkel model had gezien: de maatstaf die er het meest toe doet, en degene
om mee te beginnen ([coaching](/docs/agents/coaching)).

**Twee modellen, blind.** `champollion improve sheet` laat een tweede model concepten maken voor een
met een seed bepaalde willekeurige helft van de opgestelde rijen (`nmt-forge draft-newer`), ongemarkeerd:
het nieuwst getrainde model wanneer dit niet het model in gebruik is — zoals na een ronde
waarvan het oordeel te weinig, geen verandering of slechter was — of, bij het bezoek na een
promotie, het model dat door het model in gebruik is vervangen. Welke rijen van wie zijn, wordt
naast het werkblad bijgehouden in `improve/round-<k>/sheet-key.json` (`in_use`, `other`,
`relation` `newer` of `replaced`, de trainingsparen van elk model `in_use_pairs`
en `other_pairs`, `other_rows` en `repeat_rows`, hieronder).
`champollion improve marks` telt de twee modellen vervolgens apart, waarbij opnieuw
getoonde rijen overal buiten worden gelaten:

- het aandeel correct hierboven — de voortgangsmaatstaf — telt alleen de
  rijen van het model in gebruik mee;
- elk als correct gemarkeerd concept en elke correctie wordt een trainingspaar,
  ongeacht welk model het heeft opgesteld;
- een toets voor twee proporties (gepoolde variantie, tweezijdig op 5%: |z| > 1,96)
  geeft aan welk model de spreker vaker als juist heeft gemarkeerd, als dat al het geval
  is: `clear` is `newer` of `replaced` (het andere model), `in-use` of `neither`,
  vastgelegd in `marks.json` (`blind`) met beide tellingen (`in_use_right`, `in_use_judged`,
  `other_right`, `other_judged`, `in_use_share`, `other_share`), `other`,
  `relation` en het aantal trainingsparen van beide; een vergelijking met een nieuwer model
  bewaart ook `newer`, `newer_right`, `newer_judged` en `newer_share`. Wanneer
  een van beide modellen geen rij heeft die als `Y` of `N` is gemarkeerd,
  is `clear` `null` en luidt de tekst *"te weinig rijen van één model beoordeeld om te vergelijken"*;
- tegenover een nieuwer model, waarbij van elk minstens één concept is beoordeeld,
  gaan de tellingen naar forge (`nmt-forge speaker-verdict`), dat dezelfde toets uitvoert en
  `clear` (`newer`, `in-use` of `neither`) vastlegt in zijn grootboek
  (`improve-speaker`). Na een oordeel **too-few** of **no-change** bij die
  run zorgt `clear: newer` ervoor dat forge het nieuwere model voor gebruik aanbiedt;
  `champollion improve marks` meldt vervolgens *"forge heeft het vastgelegd: het stelt voor om het nieuwere model in gebruik te nemen (de mensen zeggen eerst ja)"*
  ([training](/docs/agents/training#the-improve-rounds)).

De rijen zijn willekeurig toegewezen, op één blad, beoordeeld door dezelfde spreker, op
de eigen nieuwe zinnen van de familie — dus een duidelijk verschil zegt iets wat de dev-set
mogelijk te klein is om te tonen, en een verandering in hoe coulant de spreker beoordeelt
raakt beide modellen gelijk. **Let op.** Vertel de spreker nooit welke rijen van welk model
afkomstig waren voordat diens beoordelingen zijn uitgelezen.

**Opnieuw getoonde rijen.** Vanaf ronde 2 plaatst `champollion improve sheet` voor
elke 10 nieuwe zinnen op het werkblad één rij terug (`REPEAT_EVERY`; naar beneden afgerond,
en minder wanneer er minder in aanmerking komen): een concept dat de spreker op een
eerder werkblad als `Y` of `N` heeft gemarkeerd, met het eerdere concept ervan, ongemarkeerd, op een met een seed bepaalde willekeurige plek —
nooit een oefenrij, een rij die zelf al een herhaling was, een rij die al opnieuw is
getoond, of een zin op dit werkblad. De eerste regel van het werkblad, boven de
koptekst, luidt: *"Een paar rijen hieronder komen opzettelijk terug van eerdere werkbladen.
Beoordeel ze alstublieft opnieuw, alsof ze nieuw zijn: hoe vaak de beoordelingen overeenkomen, geeft aan in hoeverre
ze kunnen worden vertrouwd."* Er wordt nooit vermeld welke; `sheet-key.json` bewaart ze als
`repeat_rows` (`row`, `from_round`, `from_row` en `mark`, de eerdere
beoordeling). Ze kosten de spreker ongeveer 10 seconden per rij.

`improve marks` beoordeelt elk exemplaar uitsluitend ten opzichte van de eerdere beoordeling van de spreker zelf: een
herhaling wordt nooit meegeteld in het aandeel van de ronde, wordt nooit opnieuw een trainingspaar en
nooit opgenomen in de blinde vergelijking. `marks.json` krijgt `repeats`: `shown`,
`judged` (dit keer gemarkeerd als `Y` of `N`; `?` of leeg wordt getoond, niet beoordeeld),
`agreed`, `agreement` (overeenstemmend ÷ beoordeeld), `wrong_to_right`,
`right_to_wrong`, `wrong_before` (beoordeelde rijen die ooit als `N` waren gemarkeerd) en
`rounds_apart_wrong_before`. Het toont *"Opnieuw getoonde rijen: de spreker
beoordeelde A van de J zoals voorheen (P%) — W ooit onjuist nu juist, R ooit
juist nu onjuist. Niet meegeteld in het aandeel van deze ronde en niet opnieuw
op getraind."*

Samengevoegd over de rondes leest het ronderapport, zodra er 10 of meer zijn beoordeeld (`MIN_REPEATS`),
hier twee zaken uit af:

- **Willekeurige fout** `e`, uit de wisselingen die beide kanten op even vaak voorkomen. Twee beoordelingen van
  één concept wijken door toeval in 2e(1 − e) van de gevallen af, gelijk verdeeld over beide kanten; met
  d = 2 × min(`wrong_to_right`, `right_to_wrong`) ÷ `judged`,
  e = (1 − √(1 − 2d)) ÷ 2. Fouten trekken elk aandeel richting 50%: een concept dat in werkelijkheid
  met een aandeel p juist is, wordt in e + p(1 − 2e) van de gevallen als juist gemarkeerd, waardoor
  bij e = 10% "in werkelijkheid 80% juist" als ongeveer 74% wordt afgelezen.
- **Drift**: wisselingen één kant op die de evenwichtige wisselingen overstijgen. Het rapport waarschuwt dat de
  beoordeling mogelijk milder wordt wanneer wisselingen van ooit onjuist naar nu juist duidelijk
  talrijker zijn dan de andere kant op: 6 wisselingen of meer en een tekentoets,
  (`wrong_to_right` − flips ÷ 2) ÷ √(flips ÷ 4) > 1,96.

De controle-regel ervan: *"De spreker beoordeelde A van de J opnieuw getoonde rijen zoals voorheen
(P%): ongeveer E% van de beoordelingen valt door toeval de andere kant op, wat elk
aandeel dat als juist is gemarkeerd naar 50% trekt — de projectie houdt hier rekening mee."* — en over
drift: *"En W concepten die ooit als onjuist waren gemarkeerd, zijn nu als juist gemarkeerd, tegenover R de
andere kant op: de beoordeling wordt mogelijk milder, wat een stijging van het aandeel niet
zou laten zien."* Bij minder dan 10 beoordeeld: *"Tot nu toe zijn N opnieuw getoonde rijen beoordeeld — de
eigen beoordelingsfout van de spreker wordt geschat vanaf 10."*

**Waar de rondes heen wijzen.** De projectie van het ronderapport wordt alleen gemaakt op basis van
echte vooruitgang (hierboven) zolang het aandeel juist onder de 80% ligt. Leercurves
stijgen met grofweg gelijke stappen in log-odds per verdubbeling van de trainingsdata, dus
het leest de stap af uit dezelfde blinde controles na promoties: de som van
`logit(in_use_share) − logit(other_share)` over de som van
`log2(in_use_pairs ÷ other_pairs)` (aandelen begrensd op 1–99%), met een 95%-bereik
op basis van de variantie van elk aandeel, ongeveer 1 ÷ (n·p·(1 − p)) voor n beoordeelde
concepten. Op basis van de trainingsparen van het model in gebruik geeft het aan hoeveel er nog nodig zijn om
80% als juist gemarkeerd te bereiken — de schatting — en de uren van de spreker bij 70 seconden per
zin. Het bereik omvat het interval van de stap (geen bovengrens na meer dan nog zes
verdubbelingen) en, zodra 10 opnieuw getoonde rijen zijn beoordeeld, waar "in werkelijkheid op
80% juist" kan liggen volgens de beoordelingen van deze spreker: e + 0,8(1 − 2e) + 0,2 × K, maximaal
97%, waarbij K de drift per ronde is (wisselingen bovenop de evenwichtige wisselingen, gedeeld door het
aantal rondes dat tussen de twee beoordelingen van de ooit onjuiste rijen zat) vermenigvuldigd met de rondes
tussen de eerste en laatste beoordelingen, gemaximeerd op ±30%. Het minimum is het kleinste van de twee doelen bij de
bovengrens van de stap, het maximum de grootste bij de ondergrens ervan; een minimum van 0 geeft
"geen" weer. De tekst voegt vervolgens toe: *"De eigen beoordeling van de spreker: deze beoordeelde A van de J
opnieuw getoonde rijen zoals voorheen (P%), dus ongeveer E% van de beoordelingen valt door
toeval de andere kant op … concepten die in werkelijkheid voor 80% juist zijn, worden volgens hun beoordelingen in ongeveer T%
van de gevallen als juist gemarkeerd — het bereik houdt hier rekening mee."* (met, wanneer K
1% of meer in een van beide richtingen is, hoeveel vaker of minder vaak concepten die ooit als onjuist waren gemarkeerd
nu als juist zijn gemarkeerd); daarvóór: *"(Er wordt nog geen rekening gehouden met de eigen beoordelingsfout van de spreker:
er zijn te weinig opnieuw getoonde rijen beoordeeld.)"* `report.json`
bevat de getallen als `projection_numbers` (`more_sentences`, `range`,
`speaker_hours`).

In simulatie — een spreker met ruis, de eigen dev-splitsing van de rails en deze oordeelsregels,
200 tests per scenario op twee sets seeds — kwam de schatting in 69–78% van de gevallen
binnen een factor 2 van het werkelijke aantal uit bij 400 nieuwe zinnen per ronde en in
53–56% bij 800, en viel het werkelijke aantal in 89–94% en 76–80% van de gevallen binnen
het bereik (zonder herhalingen 91–93% en 51–54%). Het aanpassen van de schatting zelf
aan de beoordelingen van de spreker hielp bij 800 per ronde en schaadde bij 400 (binnen
een factor 2: 64% en 19%), dus deze blijft op de eenvoudige 80%. Een opmerking dat het model
"mogelijk al werkt" werd geprobeerd en weer geschrapt: deze was 2–3 keer vaker fout dan
goed. Een ruwe schatting, en dat wordt ook zo gezegd.

## Wat de getallen niet zeggen

- Een score geldt voor het systeem op die specifieke set, niet voor een afzonderlijke zin: er is geen
  betrouwbaarheidsscore per zin.
- chrF++ meet de overlap met een referentie. Een goede vertaling die anders is
  verwoord kan laag scoren; een vlot lezende onjuiste vertaling kan tamelijk hoog scoren.
- FST-acceptatie geeft aan dat woorden bestaan, niet dat een zin het juiste betekent.
- Gepubliceerde rijen op het scorebord zijn standaard zelf gerapporteerd; de verificateur
  scoort ingediende uitvoer opnieuw tegen het hash-vastgezette corpus (binnen 1,0
  chrF++), en voert methoden niet opnieuw uit.

## Hoe u een getal rapporteert

Elk getal draagt **de bijbehorende eenheid, wat het meet en de set waarop het is
gemeten** — met de omvang van de set en het bereik wanneer dat er is.

| Zeg | Nooit |
|---|---|
| "chrF++ 24,1 van de 100 op de 50 oefenzinnen (dev), bereik 20,6–27,6" | "24,1" · "24% accuraat" |
| "de spreker markeerde 9 van de 24 nieuwe concepten als correct — 38% (21%–57%)" | "38% accuraatheid" |
| "geen meetbare verandering: op 50 dev-zinnen is pas een verschil van ongeveer 5,8 punten zichtbaar" | "het is iets verbeterd" |
| "nog te weinig oefenzinnen om te beoordelen: onder de 50 geeft geen enkele vergelijking de doorslag — de blinde markeringen van de spreker bepalen het" | "geen verandering" voor een oordeel **too-few** |
| "op de 50 vergrendelde testzinnen, eenmalig, afgezet tegen de voorspelling die u schreef: '…'" (hun eigen woorden, herhaald) | een testscore zonder set of voorspelling |
| "blind, op nieuwe zinnen, markeerde de spreker het nieuwere model bij 7 van de 12 als correct en het model in gebruik bij 5 van de 12 — geen duidelijk verschil op 24 zinnen" | "het nieuwe model is beter" enkel op basis van de markeringen |
| "chrF++ 31,0 gated (wat wordt geleverd), 33,5 ungated, 12% geweigerd door de gates" | alleen de gated score |

- Een bereik geeft aan hoe zeker de tools zijn, het zijn geen twee resultaten.
- Twee scores op verschillende sets zijn niet vergelijkbaar. Twee scores op dezelfde set
  verschillen pas wanneer de gepaarde toets dat aantoont.
- Citeer voorbehouden en waarschuwingen woord voor woord.
- Noem een score nooit goed of slecht; koppel er nooit een kwaliteitswoord aan. Een vloeiende
  spreker beslist wat geschikt is voor gebruik.

## Meer informatie

- [De scorespecificatie](/docs/network/specifications/scoring) en
  [significantie](/docs/network/specifications/significance).
- [De runcard](/docs/network/specifications/run-card) — wat een gescoorde run
  vastlegt.
- [Betrouwbaarheid van metrieken](/docs/network/specifications/metric-reliability) —
  welke metriek voor welke talen is gecontroleerd tegen menselijke beoordelingen.
- [De technische beperkingen](/docs/network/honest-limitations).
- [De vangrails](/docs/guardrails) — de versie voor de mensen.
