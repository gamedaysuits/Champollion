---
sidebar_position: 4
title: "Fouten melden en correcties beheren"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Hoe een spreker een onjuist feit of een slechte vertaling meldt, wie bepaalt wat er vervolgens gebeurt, hoe correcties voorzien worden van herkomstinformatie, en waarom gemeenschappen vetorecht hebben over hun taalgegevens."
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# Fouten Melden en Correcties Beheren

> **Standpunt.** Fouten maken is onvermijdelijk voor een platform dat feiten en beoordelingen over duizenden talen publiceert. Wat *niet* onvermijdelijk is, is wie er geloofd wordt wanneer een fout wordt gemeld, en wie de correctie beheert. Ons antwoord: de melding van een vloeiende spreker heeft meer gewicht dan onze automatisering, elke correctie bevat herkomstinformatie over wie wat heeft gewijzigd en waarom, en een gemeenschap kan het gebruik van haar taalgegevens intrekken of verbieden — niet als een gunst, maar als een afdwingbare eigenschap van de architectuur.

De meeste dataplatforms behandelen foutmeldingen als supporttickets: een gebruiker klaagt, een beheerder beslist, het record wordt stilzwijgend gewijzigd. Voor gegevens over Inheemse talen staat dat model op zijn kop. De persoon die de fout meldt, is doorgaans gezaghebbender dan het platform — een spreker die ons vertelt dat een woord onjuist is, is geen "gebruiker"; zij zijn de grondwaarheid die een proxy corrigeert. Het onderstaande ontwerp volgt uit het serieus nemen van dat gegeven.

---

## Twee soorten fouten, één principe

Het platform publiceert twee soorten beweringen die onjuist kunnen zijn:

1. **Feiten over een taal** — de taalkaarten die evaluatie sturen: classificatiegegevens, orthografie, taalkundige kenmerken, welke statistieken van toepassing zijn. Een kaart kan een onjuiste schattting van het aantal sprekers bevatten, een onjuiste dialectrelatie, of een onjuiste status van het schrijfsysteem.
2. **Oordelen over vertalingen** — een referentievertaling in een corpus die een spreker als onjuist of onnatuurlijk beschouwt; een geautomatiseerde statistiek die een geldig woord afwijst of een ongeldig woord accepteert; een "Deployable"-badge op uitvoer die sprekers niet zouden accepteren.

Het principe dat beide dekt, reeds bindend in de [Scoringsspecificatie](/docs/network/specifications/scoring) en [Benchmarkspecificatie §7](/docs/network/specifications/benchmark#7-human-validation): **geautomatiseerde uitvoer zijn proxies; sprekers zijn de grondwaarheid.** De gepubliceerde toezegging in het [Sprekervalidatieprotocol §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) stelt het onomwonden: als een spreker zegt dat de linter ergens fout over zit, passen wij de linter aan.

## Hoe een melding verloopt

Hieronder staat het traject dat een melding aflegt, met eerlijke statusmarkeringen — een deel hiervan werkt vandaag al, een deel is gespecificeerd maar nog niet gebouwd.

**Een onjuiste vertaling of statistisch oordeel melden (vandaag operationeel, via direct kanaal).** Een spreker die een onjuiste referentievertaling, een ten onrechte afgewezen woord, of een onaanvaardbaar "equivalent" ziet, kan dit melden via de openbare issue tracker van het project of door rechtstreeks contact op te nemen met het project. De gestructureerde versie hiervan — beoordelingsschermen met opties *afwijzen / globaal / acceptabel / uitstekend* en vrije-tekstnotities — is de community-reviewinterface, die is gespecificeerd in [Benchmarkspecificatie §7.3](/docs/network/specifications/benchmark#7-human-validation) maar nog niet live is. Tot die tijd worden meldingen persoonlijk afgehandeld, en zijn de validatietaken zelf (betaalde, gestructureerde sprekersbeoordeling — zie [Hoe Sprekers Betaald Worden](/docs/network/perspectives/how-speakers-get-paid)) de voornaamste correctiepijplijn.

**Een onjuist feit op een taalkaart melden (vandaag operationeel, via dezelfde kanalen).** Kaartcorrecties volgen hetzelfde traject: melden, beoordelen, versiegebonden wijziging. Omdat kaarten het evaluatiegedrag sturen — welke statistieken worden geladen, welke modellen worden aanbevolen — kan een kaartcorrectie scores wijzigen; correcties worden daarom toegepast als vastgelegde gegevenswijzigingen, nooit als stille bewerkingen.

**Wat er daarna gebeurt — wie beslist:**

- **Taalkundige oordeelsvragen behoren toe aan sprekers van die taal.** Of een vorm geldig is, of twee formuleringen equivalent zijn, of een register passend is — het platform implementeert het antwoord; het levert het niet. Waar sprekers het oneens zijn (dialecten, orthografische conventies), wordt het antwoord vastgelegd als variatie, niet door ons beslecht — de corpus- en linterschema's ondersteunen het labelen van dialectvarianten als aanvaardbare alternatieven in plaats van één winnaar af te dwingen.
- **Beslissingen over de gegevens van een gemeenschap behoren toe aan haar bestuursorganisatie.** Voor talen met een bestuursorganisatie verlopen wijzigingen in evaluatiecorpora, acceptatie van correcties in verzegelde testsets en implementatiegevolgen via hen — dat is het beginsel van zeggenschap uit de [Inheemse datasoevereiniteitsprincipes](/docs/network/sovereignty/data-sovereignty) geïmplementeerd als proces, niet als poster.
- **Mechanische fouten worden gewoon gecorrigeerd.** Een typefout, een verbroken link, een verkeerd geparseerd veld — gemeld, gecorrigeerd, gelogd. Niet alles vereist een raadsvergadering.

## Correcties bevatten herkomstinformatie

Een correctie die u niet kunt traceren, is slechts een nieuwere mening. Drie herkomstregels gelden voor elk feit en elke correctie:

1. **Elk feit vermeldt zijn bron.** Taalkaarten en corpusitems leggen vast waar elke waarde vandaan komt — een gepubliceerde dataset, een gemeenschapsbijdrage, de beoordeling van een spreker.
2. **Afgeleide waarden worden als onze waarden gelabeld, niet als die van de upstream.** Wanneer het platform iets berekent — een aggregaat, een hercodering, een samenstelling — wordt dit vastgelegd als een platformafleiding *van* de upstreambron, nooit onder de naam van de upstream geschreven. Een upstreamdataset mag nooit verantwoordelijk worden gehouden voor, of gecrediteerd worden met, een getal dat zij niet heeft gepubliceerd.
3. **Correcties worden onderdeel van het record.** De correctie van een spreker wordt vastgelegd als een nieuwe, toegeschreven bewering (op naam of anoniem, naar keuze van de spreker — dezelfde voorwaarden als voor validatiewerk) die de oude waarde vervangt; de geschiedenis van wat er is gewijzigd blijft controleerbaar. Corpusversies zijn hash-geverifieerd ([Corpuspartnerschap §4.4](/docs/network/specifications/corpus-partnership)), zodat een gecorrigeerd corpus een zichtbaar nieuwe versie is, en elke uitvoeringskaart legt exact vast tegen welke versie deze is gescoord — oude scores blijven interpreteerbaar, nieuwe scores weerspiegelen de correctie.

## Het veto, concreet

"Gemeenschapscontrole" is gemakkelijk te claimen. Hier is wat het concreet betekent in de gepubliceerde architectuur:

- **Sprekers kunnen hun bijdragen intrekken.** Een spreker kan zijn of haar beoordelingen op elk moment intrekken, en intrekking verwijdert deze uit alle analyses ([Sprekervalidatie §5](/docs/network/specifications/speaker-validation#5-data-governance)). Sprekers hebben ook vetorecht over publicatie van resultaten die zij problematisch achten.
- **Gemeenschappen kunnen evaluatie volledig stopzetten.** Verzegelde testsets zijn versleuteld, met sleutels die zo worden bewaard dat het platform ze nooit alleen kan reconstrueren; een gemeenschap kan evaluatietoegang intrekken door te weigeren deel te nemen aan sleutelreconstructie ([Corpuspartnerschap §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)). "Wat als we willen stoppen?" heeft een gespecificeerd antwoord: de verzegelde gegevens worden nooit blootgesteld, en de evaluatie eindigt.
- **Geen enkele score overschrijft een gemeenschapsbeslissing.** Een methode die bovenaan de ranglijst staat, wordt pas ingezet als de bestuursorganisatie daarmee instemt ([Eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer)) — en een gemeenschap die besluit dat MT helemaal niet voor haar taal mag worden ingezet, maakt gebruik van het systeem zoals het is ontworpen, en breekt het niet (zie [Vertaling Is Geen Revitalisering](/docs/network/perspectives/translation-is-not-revitalization)).

## Wat we nog niet hebben gebouwd

In de geest van de rest van dit gedeelte: de community-reviewinterface is gepland, maar niet live. Bestuursorganisaties zijn voor geen van de huidige talen opgericht — gemeenschapsbeheer voor de Plains Cree-benchmark is in bevestiging, en wij noemen beheerders niet publiekelijk voordat zij toestemming hebben gegeven. Tot die onderdelen bestaan, verlopen correcties via directe, traceerbare kanalen, en blijven de gepubliceerde specificaties — niet deze pagina — de bindende beschrijving van het proces. Waar deze pagina en een specificatie van elkaar afwijken, prevaleert de specificatie, en wij beschouwen de afwijking zelf als een fout die het melden waard is.

---

## Wat dit voor u betekent

:::info[Als u een gemeenschapslid bent]
Als er iets op dit platform onjuist is over uw taal — een feit, een vertaling, een label — dan is uw melding een getuigenis vanuit de primaire bron, geen klacht die in een wachtrij belandt. U bepaalt zelf of uw correctie op naam wordt vermeld; uw bijdrage kan later worden ingetrokken; en uw gemeenschap kan het gebruik van haar gegevens volledig stopzetten. Begin bij [Voor Taalgemeenschappen](/docs/network/community/for-language-communities), of open gewoon een issue in de publieke repository.
:::

:::info[Als u een onderzoeker bent]
Correcties hier zijn gegevens met herkomst, geen stille bewerkingen: corpusversies worden gehasht, run cards vermelden de exacte versie waarop ze zijn beoordeeld, en afgeleide waarden worden als afleidingen aangeduid. Als u voortbouwt op Network-scores of corpora, citeer dan de versie — en beschouw een door sprekers gedreven correctiegolf als een bevinding over de geldigheid van meetwaarden, want dat is wat het is.
:::

:::info[Als u een ontwikkelaar bent]
De score van uw methode kan legitiem veranderen zonder dat uw code wijzigt — een ten onrechte afgewezen woord wordt op de allowlist geplaatst, een referentievertaling wordt gecorrigeerd, een variantklasse wordt hersteld. Ontwerp hierop in: pin corpusversies in uw run cards ([Run Card-specificatie](/docs/network/specifications/run-card)), houd dataset-changelogs bij, en beschouw sprekercorrecties als het betrouwbaarste foutssignaal dat u ooit gratis zult ontvangen.
:::

## Zie ook

- [Hoe Sprekers Betaald Worden](/docs/network/perspectives/how-speakers-get-paid) — dezelfde sprekersgezaghebbendheid, in de benchmarkfase
- [Van Benchmark naar Dagelijks Gebruik](/docs/network/perspectives/from-benchmark-to-daily-use) — waar correcties de publicatieworkflow ontmoeten
- [Gegevenssouvereiniteit](/docs/network/sovereignty/data-sovereignty) — First Nations-datasoevereiniteitsprincipes, CARE en Te Mana Raraunga, de principes achter dit ontwerp
