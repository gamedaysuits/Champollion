---
sidebar_position: 7
title: "Verbindingssterkte (chrF++)"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Verbindingssterkte

Wanneer de netwerkkaart een boog tekent tussen twee talen, geeft de kleur
antwoord op één vraag: **hoe goed is de best gemeten vertaling tussen
deze talen — eerlijk gezegd?**

Het eerlijke deel is moeilijker dan het klinkt. Deze pagina legt, in
begrijpelijke taal, het getal achter de kleur uit.

## Het probleem: ruwe scores zijn niet nul bij nul

De meeste van onze scores zijn **chrF++** (karakter-n-gram F-score, [Popović
2017](https://aclanthology.org/W17-4770/)) — dit meet hoeveel de tekens en
woorden van een vertaling overlappen met een referentievertaling, op een
schaal van 0 tot 100.

Maar *willekeurige tekst is niet nul*. Elk schrijfsysteem geeft enige
overlapping "gratis": een orthografie met weinig verschillende tekens, of
lange voorspelbare woorden, scoort meetbaar boven nul zelfs wanneer de
"vertaling" onzin is. Die gratis overlapping — de **kansbodem** — verschilt
per taal. In onze metingen varieert deze van ongeveer 1,6 (Chinees schrift)
tot meer dan 13 (sommige talen met Latijns en Arabisch schrift). Een ruwe
chrF++ van 14 is bijna willekeurige ruis in de ene taal en een echt signaal
in de andere — ruwe chrF++ is dus **niet vergelijkbaar tussen talen**, en
een kaart die hierop gekleurd is, zou sommige schriften stilzwijgend
flatterend weergeven.

## De oplossing: trek de bodem af

**Kansgecorrigeerde chrF++ (cchrF++)** schaalt de score zodat 0 betekent
"niet beter dan toeval" *in die taal* en 1 perfect betekent:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

De bodems worden gemeten, niet aangenomen: voor elke taal voeren we een
Monte-Carlo-schatting uit — duizenden willekeurige basislijnen met dezelfde
orthografie, gescoord tegen echte referenties — waarbij uitsluitend
openbaar beschikbare eentalige tekst wordt gebruikt (FLORES-200 dev,
opgehaald uit de bron, nooit herverspreid). De bodementabel omvat momenteel
196 talen en is een door Champollion afgeleid artefact
(`champollion-derived` herkomst; opnieuw gegenereerd door
`cli/website/scripts/build-cchrf-floors.mjs`).

Twee conservatieve regels houden de correctie eerlijk:

- **Een paar wordt alleen gecorrigeerd wanneer BEIDE zijden een gemeten
  bodem hebben.** Als een van beide ontbreekt, wordt de boog weergegeven
  in neutraal leisteengrijs — *gemeten, bodem onbekend* — en verschijnt
  nooit op de kleurschaal.
- **Het paar gebruikt de HOOGSTE van de twee bodems.** De correctie kan
  de sterkte onderschatten, maar nooit opblazen.

## Waar cchrF++ zich bevindt in de hiërarchie

cchrF++ is onze beste *automatische* sterktemaat — het staat niet bovenaan
de hiërarchie. Van meest naar minst betrouwbaar:

1. **Menselijke verificatie** — vloeiende sprekers die uitvoer beoordelen
   ([sprekervalidatie](/docs/network/specifications/speaker-validation)).
   Niets automatisch overtreft dit.
2. **MQM-stijl expertannotatie** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — het
   protocol dat WMT gebruikt voor zijn gouden oordelen; duur, zeldzaam,
   zeer goed.
3. **cchrF++** — kansgecorrigeerd, vergelijkbaar tussen talen, overal
   goedkoop te berekenen.
4. **Ruwe chrF++ / BLEU / neurale maatstaven** — nuttig binnen één dataset;
   zie [Betrouwbaarheid van maatstaven](/docs/network/specifications/metric-reliability)
   voor hoe slecht elk menselijk oordeel kan bijhouden voor uw taalpaar.

Naarmate menselijk geverifieerde en MQM-waardige resultaten het overzicht
binnenkomen, krijgen zij voorrang boven automatische scores voor hetzelfde
taalpaar.

## Hoe de kaart dit weergeeft

Elk visueel kanaal draagt precies één betekenis:

| Kanaal | Betekenis |
|--------|-----------|
| **Kleur** | cchrF++-band — vijf stappen, rood tot zachtgroen: *nabij bodem* (&lt; 0,15), *zwak* (0,15–0,35), *in ontwikkeling* (0,35–0,55), *bruikbaar* (0,55–0,75), *sterk* (≥ 0,75) |
| **Neutraal leisteengrijs** | gemeten, maar de kansbodem is onbekend voor ten minste één zijde — nooit op de kleurschaal geplaatst |
| **Gestippeld + gedimd** | voorlopig: de testset ligt onder de [significantiebodem](/docs/network/specifications/significance) (n &lt; 100), waarbij scoreverschillen binnen ~5 chrF++ ruis zijn |
| **Breedte** | herhaalt de kleurband (toegankelijkheidsredundantie, geen tweede variabele) |

Alleen **gemeten** paren verschijnen op de sterkteramp. Geregistreerde
paren — in de wachtrij voor meting maar nog niet gescoord — verschijnen
als vage effen haarlijnen waarvan de kleur uitsluitend aangeeft *hoe het
paar vandaag bereikbaar is* (commerciële API · open-source model · frontier,
geen aanbieder), nooit hoe goed iets vertaalt. De twee vocabulaires zijn
bewust gescheiden: gedempte effen draden = bereikbaarheid, de rood→groen
ramp = gemeten sterkte. De onderliggende score van een boog is de best
gemeten uitvoering voor dat paar op het publieke overzicht, automatisch
vernieuwd naarmate nieuwe uitvoeringen binnenkomen.

## De kleine lettertjes

- Bodems zijn metrische × orthografische eigenschappen geschat op basis van
  uitsluitend eentalige tekst; er is geen parallelle corpusinhoud bij
  betrokken of opgeslagen.
- cchrF++ geeft aan dat een vertaling toeval overtreft en in welke mate —
  het **valideert geen** betekenis, register of culturele geschiktheid.
  Die blijven menselijke oordelen
  ([eerlijke beperkingen](/docs/network/honest-limitations)).
- De kansbodem-methodologie is Champollion-onderzoek; de bodenatlas en de
  correctie worden hier gepubliceerd zodat ze gecontroleerd en betwist
  kunnen worden.
