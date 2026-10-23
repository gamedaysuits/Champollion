---
sidebar_position: 4
title: "Fouten melden en correcties beheren"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Hoe een spreker een onjuist feit of een slechte vertaling meldt, wie bepaalt wat er vervolgens gebeurt, hoe correcties voorzien worden van herkomstinformatie, en waarom gemeenschappen vetorecht hebben over hun taalgegevens."
related:
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
---

# Fouten Melden en Correcties Beheren

> **Standpunt.** Fouten maken is onvermijdelijk voor een platform dat feiten en evaluaties over vele talen publiceert. Wat *niet* onvermijdelijk is, is wie er wordt geloofd wanneer een fout wordt gemeld, en wie eigenaar is van de correctie. Ons antwoord: de melding van een vloeiende spreker heeft voorrang op onze automatisering, elke correctie bevat herkomstgegevens die vermelden wie wat heeft gewijzigd en waarom, en een gemeenschap kan het gebruik van haar taalgegevens intrekken of hiertegen een veto uitspreken — niet uit beleefdheid, maar als een afgedwongen eigenschap van de architectuur.

De meeste dataplatforms behandelen foutmeldingen als supporttickets: een gebruiker klaagt, een beheerder beslist, het record wordt stilzwijgend gewijzigd. Voor gegevens over Inheemse talen staat dat model op zijn kop. De persoon die de fout meldt, is doorgaans gezaghebbender dan het platform — een spreker die ons vertelt dat een woord onjuist is, is geen "gebruiker"; zij zijn de grondwaarheid die een proxy corrigeert. Het onderstaande ontwerp volgt uit het serieus nemen van dat gegeven.

---

## Twee soorten fouten, één principe

Het platform publiceert twee soorten beweringen die onjuist kunnen zijn:

1. **Feiten over een taal** — de taalkaarten die de evaluatie sturen: classificatiegegevens, orthografie, taalkundige kenmerken, welke metrieken van toepassing zijn. Een kaart kan een onjuiste schatting van het aantal sprekers bevatten, een onjuiste dialectrelatie of een onjuiste status van het schriftsysteem.
2. **Oordelen over vertalingen** — een referentievertaling in een corpus die een spreker als onjuist of onnatuurlijk beschouwt; een geautomatiseerde metriek die een geldig woord afwijst of een ongeldig woord accepteert; een hoge automatische score voor uitvoer die sprekers niet zouden accepteren.

Het principe dat beide dekt, reeds bindend in de [Scoringsspecificatie](/docs/network/specifications/scoring) en [Benchmarkspecificatie §7](/docs/network/specifications/benchmark#7-human-validation): **geautomatiseerde uitvoer zijn proxies; sprekers zijn de grondwaarheid.** De gepubliceerde toezegging in het [Sprekervalidatieprotocol §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) stelt het onomwonden: als een spreker zegt dat de linter ergens fout over zit, passen wij de linter aan.

## Hoe een melding verloopt

Hieronder staat het traject dat een melding aflegt, met eerlijke statusmarkeringen — een deel hiervan werkt vandaag al, een deel is gespecificeerd maar nog niet gebouwd.

**Een slechte vertaling of metrische beoordeling melden (reeds actief, via direct kanaal).** Een spreker die een onjuiste referentiervertaling, een ten onrechte afgewezen woord of een onaanvaardbaar "equivalent" ziet, kan dit melden via de issue-tracker van de openbare repository van het project of door rechtstreeks contact op te nemen met het project. De gestructureerde versie hiervan — beoordelingsschermen met de opties *afwijzen / strekking / acceptabel / uitstekend* en notities in een vrij tekstveld — is de community-beoordelingsinterface, die is gespecificeerd in de [Benchmarkspecificatie §7.3](/docs/network/specifications/benchmark#7-human-validation), maar nog niet live is. Totdat dit wel het geval is, worden meldingen van persoon tot persoon afgehandeld en vormen de validatietaken zelf (betaalde, gestructureerde beoordeling door sprekers — zie [Samenwerken met sprekers](/docs/working-with-speakers)) het belangrijkste correctieproces.

**Een onjuist feit op een taalkaart melden (vandaag operationeel, via dezelfde kanalen).** Kaartcorrecties volgen hetzelfde traject: melden, beoordelen, versiegebonden wijziging. Omdat kaarten het evaluatiegedrag sturen — welke statistieken worden geladen, welke modellen worden aanbevolen — kan een kaartcorrectie scores wijzigen; correcties worden daarom toegepast als vastgelegde gegevenswijzigingen, nooit als stille bewerkingen.

**Wat er daarna gebeurt — wie beslist:**

- **Taalkundige afwegingen behoren toe aan sprekers van die taal.** Of een vorm geldig is, of twee formuleringen gelijkwaardig zijn, of een register gepast is — het platform implementeert het antwoord; het levert het niet zelf. Waar sprekers van mening verschillen (dialecten, orthografische conventies), wordt het antwoord vastgelegd als variatie en niet door ons beslecht — de corpus- en linter-schema's ondersteunen het labelen van dialectvarianten als acceptabele alternatieven in plaats van één winnaar af te dwingen.
- **Beslissingen over de gegevens van een gemeenschap behoren toe aan haar bestuursorganisatie.** Voor talen met een bestuursorganisatie verlopen wijzigingen in evaluatiecorpora, acceptatie van correcties in verzegelde testsets en implementatiegevolgen via hen — dat is zeggenschap van de gemeenschap over taalgegevens — zie [Uw woorden, uw regels](/docs/your-words-your-rules) — geïmplementeerd als proces, niet als poster.
- **Mechanische fouten worden gewoon hersteld.** Een typefout, een verbroken link, een verkeerd geparseerd veld — gemeld, gecorrigeerd, gelogd. Niet alles vereist een raad.

## Correcties bevatten herkomstinformatie

Een correctie die u niet kunt traceren, is slechts een nieuwere mening. Drie herkomstregels gelden voor elk feit en elke correctie:

1. **Elk feit noemt zijn bron.** Taalkaarten en corpusitems leggen vast waar elke waarde vandaan kwam — een gepubliceerde dataset, een bijdrage van de gemeenschap, een beoordeling door een spreker.
2. **Afgeleide waarden worden gelabeld als die van ons, niet die van de upstream-bron.** Wanneer het platform iets berekent — een geaggregeerde waarde, een hercodering, een samengestelde waarde — wordt dit geregistreerd als een platformafleiding *van* de upstream-bron, nooit geschreven onder de naam van de upstream-bron. Een upstream-dataset mag nooit de schuld of de eer krijgen van een cijfer dat deze zelf niet heeft gepubliceerd.
3. **Correcties worden onderdeel van het dossier.** De correctie van een spreker wordt vastgelegd als een nieuwe, toegeschreven bewering (op naam of anoniem, naar keuze van de spreker — volgens dezelfde voorwaarden als validatiewerk) die de oude waarde vervangt; de geschiedenis van wat er is gewijzigd blijft controleerbaar. Corpusversies zijn voorzien van een hash-manifest ([Corpora registreren](/docs/network/sovereignty/registering-corpora)), zodat een gecorrigeerd corpus zichtbaar een nieuwe versie is, en elke runkaart exact registreert ten opzichte van welke versie deze is gescoord — oude scores blijven interpreteerbaar, nieuwe scores weerspiegelen de correctie.

## Het veto, concreet

"Gemeenschapscontrole" is gemakkelijk te claimen. Hier is wat het concreet betekent in de gepubliceerde architectuur:

- **Sprekers kunnen hun bijdragen intrekken.** Een spreker kan zijn of haar beoordelingen op elk gewenst moment intrekken, en intrekking verwijdert ze uit alle analyses ([Sprekervalidatie §5](/docs/network/specifications/speaker-validation#5-data-governance)). Sprekers hebben tevens vetorecht over de publicatie van resultaten die zij problematisch vinden.
- **Gemeenschappen kunnen de evaluatie volledig stopzetten.** Verzegelde testsets zijn versleuteld en Champollion bezit geen sleuteldelen, waardoor het platform ze alleen nooit kan reconstrueren. Momenteel worden de sleutels van een verzegelde set beheerd door de organisator — sleutelbeheerders vanuit de gemeenschap: nog geen aangesteld. Zodra beheerders die door een gemeenschap zijn aangewezen delen van de sleutel van een set bezitten, kunnen zij de evaluatie stopzetten door te weigeren deel te nemen aan de sleutelreconstructie ([Corpora registreren](/docs/network/sovereignty/registering-corpora)). "Wat als we willen stoppen?" heeft een welomschreven antwoord: de verzegelde gegevens worden nooit vrijgegeven en de evaluatie wordt beëindigd.
- **Geen enkele score heeft voorrang op een besluit van de gemeenschap.** Een plaats op de ranglijst geeft niemand toestemming om een methode in te zetten voor de taal van een gemeenschap ([Eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer)) — en een gemeenschap die besluit dat machinevertaling helemaal niet moet worden ingezet voor haar taal, gebruikt het systeem zoals ontworpen en breekt het niet af (zie [Vertaling is geen revitalisering](/docs/network/perspectives/translation-is-not-revitalization)).

## Wat we nog niet hebben gebouwd

In de geest van de rest van deze sectie: de interface voor gemeenschapsbeoordeling is gepland, nog niet operationeel. Voor geen van de huidige talen zijn er al bestuursorganisaties opgericht — er zijn voor geen enkele benchmark gemeenschapsbeheerders aangesteld, inclusief Plains Cree, en we maken beheerders niet publiekelijk bekend voordat zij hebben ingestemd. Totdat deze onderdelen bestaan, verlopen correcties via directe, toewijsbare kanalen, en de gepubliceerde specificaties — niet deze pagina — blijven de bindende beschrijving van het proces. Waar deze pagina en een specificatie van mening verschillen, heeft de specificatie voorrang, en beschouwen we die tegenstrijdigheid eveneens als een bug die het melden waard is.

---

## Wat dit voor u betekent

:::info[Als u lid bent van een gemeenschap]
Als er iets over uw taal op dit platform niet klopt — een feit, een vertaling, een label — dan is uw melding een getuigenis van de feitelijke waarheid, geen klacht die moet worden getrieerd. U bepaalt of uw correctie met naam wordt vermeld; uw bijdrage kan later worden ingetrokken; en uw gemeenschap kan het gebruik van haar gegevens direct stopzetten. Begin bij [Uw woorden, uw regels](/docs/your-words-your-rules), of open gewoon een issue in de openbare repository.
:::

:::info[Als u een onderzoeker bent]
Correcties hier zijn gegevens met herkomst, geen stille bewerkingen: corpusversies worden gehasht, run cards vermelden de exacte versie waarop ze zijn beoordeeld, en afgeleide waarden worden als afleidingen aangeduid. Als u voortbouwt op Network-scores of corpora, citeer dan de versie — en beschouw een door sprekers gedreven correctiegolf als een bevinding over de geldigheid van meetwaarden, want dat is wat het is.
:::

:::info[Als u een ontwikkelaar bent]
De score van uw methode kan legitiem veranderen zonder dat uw code wijzigt — een ten onrechte afgewezen woord wordt op de allowlist geplaatst, een referentievertaling wordt gecorrigeerd, een variantklasse wordt hersteld. Ontwerp hierop in: pin corpusversies in uw run cards ([Run Card-specificatie](/docs/network/specifications/run-card)), houd dataset-changelogs bij, en beschouw sprekercorrecties als het betrouwbaarste foutssignaal dat u ooit gratis zult ontvangen.
:::

## Zie ook

- [Samenwerken met sprekers](/docs/working-with-speakers) — dezelfde zeggenschap van sprekers, in de benchmarkfase
- [In de praktijk brengen](/docs/put-it-to-work) — waar correcties en de publicatieworkflow samenkomen
- [Uw woorden, uw regels](/docs/your-words-your-rules) — wie beslist wat er met taalgegevens gebeurt, wat de tools afdwingen en wat geen enkele tool kan tegenhouden
