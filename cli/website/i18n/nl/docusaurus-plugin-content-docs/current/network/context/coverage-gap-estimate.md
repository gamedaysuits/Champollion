---
sidebar_position: 5
title: "De dekkingskloof: hoe we deze schatten"
description: "Hoe Champollion het cijfer van “meer dan een miljard mensen” onderbouwt — de methode, de twee afwegingen die eraan ten grondslag liggen, en waarom de site opzettelijk een conservatieve ondergrens vermeldt. Correcties en debat zijn welkom."
---

# De dekkingskloof: hoe we deze schatten

> **Samenvatting.** De homepage van Champollion stelt dat *meer dan een miljard* mensen die vandaag de dag leven, geen toegang hebben tot automatische vertaling in hun eerste taal. Deze pagina toont de berekening achter die uitspraak, benoemt de twee beoordelingskeuzes die het getal beïnvloeden, en legt uit waarom we een conservatieve ondergrens publiceren in plaats van het grotere ruwe totaal. Champollion is een index, geen autoriteit — elk cijfer hier is af te leiden uit de openbare build, en correcties zijn welkom.

## De vraag die we daadwerkelijk stellen

Niet "hoeveel talen missen automatische vertaling (MT)", maar **hoeveel mensen geen automatische vertaling naar hun eerste taal kunnen krijgen.** De eerste taal (L1) van een persoon is de taal waarin zij denken en waarin zij het liefst het nieuws zouden lezen. Tweetaligheid sluit niemand uit van deze telling: een Quechua-Spaanse tweetalige wiens eerste taal Quechua is, kan nog steeds geen webpagina *in het Quechua* lezen. De doelgroep is dus: iedereen wiens L1 een van de levende talen is die door geen enkele specifieke MT-engine wordt ondersteund.

## Hoe dit getal wordt berekend

Twee ingrediënten, beide in de repository:

1. **Welke levende talen MT hebben.** De build snijdt de unie van de taallijsten van negen gevolgde engines (Google, Microsoft, DeepL, LibreTranslate, NLLB-200, OPUS-MT, M2M-100, MADLAD-400, Tilde — `shared/catalogue/method-coverage.json`, elke lijst geciteerd en gedateerd) met de ISO 639-3 *individuele levende* talen (`isoType: 'L'`) in `data/tc-index.json`. Resultaat: **552 levende talen gedekt, 6.525 ongedekt**, van de in totaal **7.077** levende talen (`stats.coverage.dedicatedLiving` / `uncoveredLiving`).
2. **Hoeveel mensen de ongedekte talen spreken.** Voor elke ongedekte levende taal nemen we de `speakerCount` (gehaald uit de geciteerde schattingen van de taalkaart) en tellen deze op. De build voert dit uit als `stats.coverageGap`. De ruwe som over alle 6.525 ongedekte talen is ongeveer **2,9 miljard** (`uncoveredSpeakerSumRaw` ≈ 2.974.871.273).

Die 2,9 miljard is een **soort bovengrens**, en dat zeggen we ook duidelijk.

### Waarom de ruwe som niet zuiver is

`speakerCount` mengt sprekers van de eerste taal (L1) en het totaal aantal sprekers (L1+L2), afhankelijk van wat elke bron rapporteert, en een meertalig persoon kan bij meer dan één taal worden meegeteld. Het bewijs: het optellen van `speakerCount` over *alle* 7.082 levende talen geeft ruwweg **10,8 miljard** — meer dan de ~8,1 miljard mensen die in leven zijn (UN World Population Prospects). Een zuivere L1-telling kan de wereldbevolking niet overschrijden; deze doet dat wel, wat bewijst dat het veld niet puur L1 is.

## Twee beoordelingskeuzes (elk beïnvloedt het getal)

**(a) Alleen L1 vs. totale tellingen.** Beperking tot sprekers van de eerste taal zou de schatting verlagen — L2-sprekers zijn per definitie mensen die een andere taal *hebben*. Maar L1-cijfers per taal zijn niet uniform beschikbaar in de bronnen die we citeren, dus we kunnen niet overal een 'alleen L1'-regel toepassen zonder getallen te verzinnen. Het gebruik van de gemengde telling drijft de schatting *omhoog*.

**(b) De 777 ongedekte talen zonder gerapporteerd aantal.** Van de 6.525 ongedekte levende talen **hebben er 5.748 een sprekersaantal en 777 niet** (`uncoveredWithCount` / `uncoveredNoCount`). Het terzijde schuiven van de 777 — wat de ruwe som doet — leidt tot een *ondertelling*, omdat dit echte talen zijn met echte (ongemeten) sprekers, waarvan de meeste klein en bedreigd zijn.

De twee afwijkingen wijzen dus in tegengestelde richtingen: de L1/L2-menging verhoogt het getal, en de staart van 777 talen verlaagt het.

## Waarom we een ondergrens van "meer dan een miljard" rapporteren

De aannemelijke marge loopt van een ondergrens rond de **1 miljard** tot de ruwe **~2,9 miljard**. Zelfs na een sterke correctie voor L2-dubbeltellingen *en* het terzijde schuiven van de volledige ongemeten staart van 777 talen, blijft de populatie met een eerste taal in de ongedekte talen ruim boven de één miljard. In plaats van het grotere, minder zuivere getal als hoofdkop te gebruiken, rapporteert de site de conservatieve kant. "Meer dan een miljard" is de bewering waarvan we het meest overtuigd zijn dat deze een kritische blik doorstaat.

## Wat dit zou kunnen veranderen

Een scherpere schatting vereist **L1-sprekersaantallen per taal, elk met een bronvermelding**, zodat we L1 direct zouden kunnen optellen in plaats van de L1/L2-menging, en een verdedigbare schatting zouden kunnen maken voor de 777 momenteel niet-getelde talen. Naarmate engines talen toevoegen, stijgt het aantal van 552 en wordt de kloof kleiner; naarmate kaarten beter onderbouwde tellingen krijgen, wordt de som nauwkeuriger. Dit is een **doorlopende schatting**, die bij elke build opnieuw wordt berekend — geen vaststaand feit.

## Correcties en debat zijn welkom

Als u betere gegevens heeft, denkt dat een beslissing hier onjuist is, of bronnen kunt vinden voor de ontbrekende 777, laat het ons dan weten. Dat is precies de bedoeling. Open een issue op [github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues) of stuur een e-mail naar [info@champollion.dev](mailto:info@champollion.dev).

---

## Bronnen

- **Dekking** — `cli/shared/catalogue/method-coverage.json` (negen engines, elke lijst geciteerd en gedateerd) ∩ ISO 639-3 individuele levende talen in `cli/website/data/tc-index.json`; weergegeven als `stats.coverage.dedicatedLiving` / `uncoveredLiving`. Afgeleid van Champollion.
- **Sprekerssommen** — `speakerCount` op `tc-index.json` rijen (uit de geciteerde `speakerEstimates` van elke taalkaart), door de build opgeteld tot `stats.coverageGap` (`uncoveredSpeakerSumRaw`, `uncoveredWithCount`, `uncoveredNoCount`). Afgeleid van Champollion; mengt L1/L2 per bron.
- **Wereldbevolking** — ruwweg 8,1 miljard (Verenigde Naties, *World Population Prospects*), uitsluitend gebruikt als een realiteitscheck voor de sprekerssommen.

## Waar dit toe leidt op deze site

Deze getallen geven de omvang van het probleem aan. Het antwoord van de site hierop begint
bij [Wat Champollion is](/docs/what-is-champollion); de methodologie achter
de verdeling tussen gedekt/ongedekt staat in
[hoe dekking wordt geteld](/docs/network/context/coverage-counting), en de
talen aan de verkeerde kant van de streep — gerangschikt op wie het meest
aannemelijk als volgende een evaluatieset zou kunnen bouwen — zijn gepubliceerd in de
[corpus-verlanglijst](https://champollion.dev/corpus-wishlist.json).
