---
sidebar_position: 7
title: "Verbindingssterkte"
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

Wanneer de netwerkkaart een boog tekent tussen twee talen, beantwoordt de kleur daarvan
één vraag: **is dit paar daadwerkelijk gemeten?**

Dat is bewust minder dan wat de kaart voorheen claimde. Tot 2026-09-04 werd een boog
gekleurd op basis van een sterktegradiënt met vijf niveaus — hoe *goed* de beste vertaling
was, op een voor toeval gecorrigeerde schaal. Die gradiënt is buiten gebruik gesteld. Deze pagina
licht het getal toe dat erachter zat, waarom het verwijderen ervan de eerlijke keuze was,
en wat de kaart nu aangeeft.

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

Dit probleem is reëel, en het is de reden waarom de kaart de sterkte **niet** rangschikt over
talen heen. Het is geen probleem dat we hebben opgelost.

## De correctie die we hebben gebouwd, en waarom deze de kaart niet langer kleurt

**Voor toeval gecorrigeerde chrF++ (cchrF++)** herschaalt een score zodat 0 "niet
beter dan toeval" betekent *in die taal* en 1 perfect betekent:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

De ondergrenzen zijn gemeten, niet aangenomen: voor elke taal voeren we een Monte Carlo-schatting
uit — duizenden willekeurige baselines binnen dezelfde orthografie, gescoord tegen echte
referenties — uitsluitend met behulp van openbaar beschikbare eentalige tekst (FLORES-200 dev,
opgehaald bij de bron, nooit herdistribueerd). De ondergrenzentabel beslaat 196
talen en is een van Champollion afgeleid artefact.

**Wat die correctie daadwerkelijk aantoont.** De toevalsondergrens bestaat, varieert
ruwweg een factor negen over verschillende schriften, en kan worden geschat op basis van eentalige
tekst zonder enige menselijke kwaliteitslabels. Het aftrekken hiervan verwijdert aantoonbaar
de toevalscomponent uit triviale baselines: een kopieer-de-bron-truc die
ruw 15+ scoort in het Fins daalt naar ongeveer 2,5, en in de meeste talen naar exact
nul. Het "toeval" dat wordt verwijderd betreft oppervlaktestatistiek, geen resterende betekenis.

**Wat het niet aantoont.** Het zorgt ervoor dat **0** hetzelfde betekent in elke
taal. Het zorgt er niet voor dat **40** hetzelfde betekent. Boven de ondergrens is de
correctie een lineaire herschaling, en het bewijs dat gelijke *kwaliteit*
resulteert in gelijke gecorrigeerde scores over talen heen is alleen aangetoond aan de
onderkant van het bereik. Afgezet tegen pools van menselijke beoordelingen helpt het waar de
ondergrenzen daadwerkelijk verschillen, doet het niets waar dat niet zo is, en bij één pool met
uniform lage ondergrenzen bewoog de overeenstemming met menselijke beoordelaars de *verkeerde* kant op — een
resultaat dat we nog niet hebben opgelost.

Het inkleuren van een openbare kaart met een sterktegradiënt van vijf niveaus beweerde meer dan dat
bewijs ondersteunt, en wel precies bij de talen met schaarse bronnen waar ernaast zitten
het meeste uitmaakt. Daarom is de gradiënt buiten gebruik gesteld totdat nader onderzoek uitsluitsel geeft.

Merk op dat inkleuren op basis van **ruwe** chrF++ nooit een optie was: ruwe scores
zijn überhaupt niet vergelijkbaar tussen talen, wat de hele reden is waarom de
correctie is gebouwd. Een binaire codering is de eerlijke fallback, geen
degradatie naar iets zwakkers.

## Waar meting zich in de hiërarchie bevindt

Van meest naar minst betrouwbaar:

1. **Menselijke verificatie** — vloeiende sprekers die output beoordelen ([sprekersvalidatie](/docs/network/specifications/speaker-validation)). Niets
   automatisch overtreft dit.
2. **Expertannotatie volgens MQM** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — het
   protocol dat WMT gebruikt voor zijn goudenstandaard-beoordelingen; duur, zeldzaam, zeer goed.
3. **Automatische scores — uitsluitend binnen één taalpaar.** Ruwe chrF++, BLEU,
   COMET en de rest zijn nuttig om systemen te vergelijken op *hetzelfde* paar;
   zie [Betrouwbaarheid van metrieken](/docs/network/specifications/metric-reliability)
   voor hoe gebrekkig elk ervan de menselijke beoordeling op uw paar kan volgen.
4. **Taaloverschrijdende sterkte.** We publiceren geen ranglijst. Zie hierboven.

Naarmate menselijk geverifieerde en MQM-waardige resultaten het overzicht
binnenkomen, krijgen zij voorrang boven automatische scores voor hetzelfde
taalpaar.

## Hoe de kaart dit weergeeft

Elk visueel kanaal draagt precies één betekenis:

| Kanaal | Betekenis |
|---------|---------|
| **Kleur** | gemeten. Eén kleur, geen gradiënt — de boog geeft aan dat een run dit paar heeft gescoord, en niets over hoe goed |
| **Gestreept + gedimd** | voorlopig: de testset bevindt zich onder de [significantie-ondergrens](/docs/network/specifications/significance) (n &lt; 100), waar scoreverschillen binnen ~5 chrF++ ruis zijn. Dit is een eigenschap van de steekproefomvang, onafhankelijk van welke metriek dan ook |
| **Breedte** | constant. Er valt niets meer te coderen |

Alleen **gemeten** paren tekenen een gemeten boog. Geregistreerde paren — in de wachtrij
voor meting maar nog niet gescoord — verschijnen als vage, vlak gekleurde
haarlijnen waarvan de kleur alleen aangeeft *hoe het paar vandaag de dag bereikbaar is*
(commerciële API · open-source model · frontier, geen provider), nooit hoe
goed er iets vertaald wordt. De twee vocabulaires zijn bewust gescheiden:
gedempte, vlakke lijnen = bereikbaarheid, de ene gemeten kleur = gemeten.
De onderliggende score van een boog is de best gemeten run voor dat paar op het
openbare bord, automatisch bijgewerkt zodra er nieuwe runs binnenkomen, en wordt getoond als een
getal binnen het paar wanneer u de boog opent — nooit als een taaloverschrijdende rangorde.

## De kleine lettertjes

- De toevalsondergrenzen zijn metriek- × orthografie-eigenschappen die uitsluitend worden geschat
  op basis van eentalige tekst; er is geen parallelle corpusinhoud bij betrokken of opgeslagen.
- De ondergrenzenatlas en de correctie blijven gepubliceerd onderzoek, en de code
  blijft getest aanwezig in de repository. Ze zijn aan geen enkel openbaar oppervlak gekoppeld.
- **Het corrigeert de ondergrens, niet het plafond.** Hoe hoog een oprecht goede
  vertaling kan scoren verschilt nog steeds per taal, en de correctie doet
  daar niets aan.
- **Het is geen bescherming tegen kopiëren bij een gedeeld schrift.** Een output die simpelweg
  de bron kopieert kan nog steeds boven het toevalsniveau scoren wanneer bron en doel een
  schriftsysteem delen.
- **Het kan systemen binnen één taalpaar niet van volgorde veranderen.** Boven de ondergrens is de
  correctie een lineaire herschaling, waardoor rangordes binnen een paar voor en na identiek
  zijn — de enige mogelijke waarde ervan lag tussen paren.
- Een gemeten boog vertelt u dat een paar is gescoord. Het valideert **niet**
  de betekenis, het register of de culturele aansluiting. Dat blijven menselijke beoordelingen ([eerlijke
  beperkingen](/docs/network/honest-limitations)).
- De methodologie van toevalsondergrenzen is onderzoek van Champollion, hier gepubliceerd
  juist zodat deze kan worden gecontroleerd en betwist.
