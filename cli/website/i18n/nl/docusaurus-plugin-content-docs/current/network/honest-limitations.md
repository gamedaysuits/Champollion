---
title: "Eerlijke Beperkingen"
description: "Wat Champollion (nog) niet claimt. De controleerbare grenzen van onze evaluatie, vertrouwensniveaus, communityvalidatie en gereserveerde infrastructuur."
---

# Eerlijke Beperkingen

> Dit zijn de claims die wij **niet** zullen overschrijden. Als iets elders op
> deze site meer impliceert dan wat hier staat, beschouw dat dan als een fout en
> [meld het ons](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Evaluatie-infrastructuur verdient vertrouwen alleen door eerlijk te zijn over haar grenzen. Hier zijn de onze, duidelijk genoeg geformuleerd om te controleren.

## 1. Diepe morfologische validatie is afhankelijk van een FST *en* een rangschikbare testset

Op FST gebaseerde morfologische validatie — controleren of elk geproduceerd woord een
welgevormd woord is in de doeltaal — vereist twee zaken voor een taalpaar:
een FST die door de testomgeving is vastgezet (pinned), en een evaluatieset voor het paar
die kan rangschikken. De `GiellaLTFSTMetric` zelf is **generiek**: hij beoordeelt elke
taal met een vastgezette GiellaLT-FST (Plains Cree, de Samische talen,
Fins, Noors Bokmål, Inuktitut en andere). Verschillende van deze talen
hebben open evaluatiesets (Tatoeba, WMT, WMT24++) — de
[datasetpagina](/docs/network/leaderboard/datasets) toont de catalogus,
`mt-eval corpora --source eng --target <code>` toont wat er voor een paar kan worden uitgevoerd,
en `mt-eval corpora --with-fst` toont uitsluitend de paren waarvan het doel een
vastgezette FST heeft, inclusief de informatie of deze op uw machine is geïnstalleerd.
Plains Cree, de taal waarmee het FST-werk begon, vormt de uitzondering: de
twee evaluatiesets (EdTeKLA) zijn gecatalogiseerd als 'quarantined labels', en de
database weigert elke score die hiervoor wordt ingediend.

Er gelden nog twee andere beperkingen. Waar de vastgezette FST slechts een
spellingcontrole-**acceptor** is (Noord-Samisch, Amhaars, Baskisch), geeft deze aan of een woord bestaat,
maar niet of het correct verbogen is; `morphological_accuracy` wordt daarom niet
berekend — en een acceptor accepteert sommige Engelse woorden en woorden met hoofdletters,
waardoor FST-acceptatie onvertaalde uitvoer kan goedkeuren (de runkaart toont dan
een 'source-copy'-voorbehoud; zie [scorevoorbehouden](/docs/network/specifications/scoring#2-8-score-caveats)). FST-acceptatie is een diagnostisch middel: het telt nooit mee voor de chrF++-hoofdscore en rangschikt geen runs.
Het keurt ook één geldige zin goed die voor elke invoer wordt herhaald; de runkaart
toont dan een voorbehoud voor nagenoeg constante uitvoer.
Bovendien wordt elk paar zonder FST beoordeeld met oppervlaktestatistieken (chrF++, BLEU)
en gedragscontroles. Dat zijn nuttige signalen, maar ze bieden **geen**
garantie voor morfologische geldigheid. Wij claimen geen morfologische validatie
voor talen die niet beschikken over zowel een FST als een evaluatieset die kan rangschikken.

## 2. Vertrouwensniveaus zijn bij lancering zelfgerapporteerd

De meeste scores worden berekend door bijdragers die de harness zelf uitvoeren en het resultaat publiceren. Server-side **verificatie** — het opnieuw scoren van een inzending aan de hand van het SHA-vastgezette canonieke corpus — bestaat en wordt uitgebreid, maar "geverifieerd" is nog niet universeel. Lees het vertrouwenskeurmerk op elke rij: **"zelfgerapporteerd" betekent precies dat**, en het is de standaard.

## 3. Gemeenschapsvalidatie door sprekers heeft nog niet plaatsgevonden

Onze prijs vereist **≥ 70% acceptatie door tweetalige sprekers**. Deze voorwaarde is
gespecificeerd en de tools om dit uit te voeren zijn in ontwikkeling — maar **er is nog
geen beoordeling door moedertaalsprekers uit de gemeenschap uitgevoerd**, en **geen enkele score op deze site heeft de
sprekersvoorwaarde behaald**. chrF++ en alle andere automatische cijfers zijn machinesignalen,
geen oordeel van de gemeenschap; daarom draagt geen enkele score hier een kwaliteitslabel.

## 4. De evaluatiesandbox en sleutelceremonie bestaan; geen enkele beheerder heeft ze gebruikt

We halen corpora op bij hun bron en zetten deze vast met een SHA-hash, en gereserveerde splitsingen (held-out splits)
zijn verzegeld. Wanneer een gemeenschap een geheime testset beheert, kan een methode
daaraan worden getoetst zonder dat de set ooit hun handen verlaat — en die evaluatie
heeft nu **twee trajecten**. Het
voorkeurstraject, voor standaard neurale modellen, is **declaratief**: de deelnemer
dient uitsluitend data in — safetensors-gewichten + een declaratieve tokenizer + een configuratie —
en de organisator voert dit uit in de eigen vertrouwde inferentie-engine
(`trust_remote_code=False`, offline; permissief wat betreft de architectuur omdat
de veiligheid schuilt in het codevrije formaat, niet in de architectuurnaam). Er wordt in het geheel geen deelnemerscode
uitgevoerd, dus er valt niets in een sandbox te plaatsen; de veiligheidscontrole is een beslisbare formaatvalidatie
(is dit safetensors en geen pickle? geen `trust_remote_code`?), en geen
poging om te bewijzen dat willekeurige code veilig is. Voor methoden die daadwerkelijk uit code bestaan
(pipelines, hybride vormen met LLM-aansturing), is de fallback de van het netwerk geïsoleerde
**sandbox** (statische controles, `--network=none`-containers, uitgaand verkeer uitsluitend voor scores, een
optioneel transportbestand voor een volledige air-gap). Omdat de sandbox geen netwerkverbinding heeft, wordt een
methode daar alleen uitgevoerd met elk model dat deze aanroept binnen de bundel: een
hybride methode met LLM-aansturing moet haar LLM als open gewichten meeleveren, aangezien een gehoste LLM-API
niet kan worden bereikt. De sandbox bevat niet-vertrouwde code in plaats van
de uitvoering ervan te weigeren, waardoor dit het verklaarbaar zwakkere traject is — de dragende
garantie is `--network=none` (een heuristische statische scan kan een binair
model niet verifiëren), en diepere beveiliging (seccomp, microVM's) is uitgesteld. Zie
[een soevereine competitie organiseren](/docs/network/sovereignty/run-a-sovereign-contest)
voor wat er precies actief is en wat niet. De **sleutelceremonie** van de offline node is
**gebouwd** — de sleutel van de set wordt M-van-N gesplitst en alleen in het geheugen opnieuw samengesteld tijdens een
door een quorum geautoriseerde run — maar deze is nog nooit gebruikt met een echte beheerder, en
shares zijn in deze eerste versie gewone bestanden. Wat **niet** is gebouwd: threshold
signing (een score wordt ondertekend met een enkele nodesleutel) en hardware-attestatie (scoremanifesten
worden uitsluitend in software ondertekend). Er is geen beheerder aangesteld, waardoor de
evaluatie voor de **hoofdprijs** gesloten blijft totdat beheerders en
toestemming van de gemeenschap geregeld zijn.

## 5. Sleutelbeheer is ontworpen; er zijn nog geen beheerders aangesteld

Het beheer*mechanisme* is ontworpen: een drempelschema (threshold scheme) waarin **Champollion
is ontworpen om nul sleutelaandelen (key shares) te bezitten**. Het is nog niet uitgevoerd met echte
beheerders. Beheerders worden gekozen door de gemeenschappen zelf, en er is er nog geen
aangesteld, dus hanteren we: **"sleutelbeheerders vanuit de gemeenschap — nog geen aangesteld."**
Beheer is geen toestemming: het relationele proces voor toestemming vanuit de gemeenschap is een eigen,
trager en belangrijker traject.

## 6. We meten methoden op benchmarks; we beoordelen geen individuele vertalingen {#system-vs-output}

Twee verschillende zaken worden "betrouwbare machinevertaling" genoemd. Wij doen een van
beide.

**Systeemniveau — wat we wél doen.** Gegeven een taalpaar, een testset en een methode:
hoe scoort die methode, onder welke metriek, op welk domein, in welk
contaminatietraject, op welk vertrouwensniveau? Dat is een claim over een *methode op een
benchmark*, plus een claim over wie de lat heeft gelegd. De scoreregels zijn
gepubliceerd, de corpora zijn vastgezet (pinned), en bij een soevereine benchmark bepaalt de gemeenschap
die eigenaar is van de testset wat er slaagt. Het scorebord, de kaart, de runkaarten
en `mt-eval` zijn allemaal dit, en uitsluitend dit.

**Uitvoerniveau — wat we níét doen.** Gegeven één bronzin en één
vertaling daarvan: hoe waarschijnlijk is het dat *die* vertaling klopt? In MT en NLP
is dat kwaliteitsinschatting (quality estimation) en onzekerheidskwantificering, en dat is een onderzoeksveld
op zich. Wij publiceren **geen betrouwbaarheid per segment voor welke vertaling dan ook**,
en niets hier is een gekalibreerde waarschijnlijkheid dat een bepaalde uitvoer correct is. Een
hoog scorende rij is geen garantie voor de volgende zin die een methode produceert.

Het omgekeerde is een fout die sneller wordt gemaakt, en dat geldt ook voor ons. Wanneer een pagina hier stelt
dat geen enkele methode voor een paar goed genoeg scoort om in productie te nemen — zoals
[menselijke vertaaldiensten](/human-services) doet — dan is dat een uitspraak over
gemeten methoden op gemeten testsets. Het is een goede reden om geen machinevertalingen
voor dat paar te publiceren. Het is geen oordeel over een specifieke zin.

**Kwaliteitsinschatting is een openstaande plek, geen verborgen leemte.** De testomgeving
berekent al één referentievrije neurale score, AfriCOMET-QE (`qe_score`), als het
adequaatheidssignaal voor runs zonder gouden referentie. Deze wordt gerapporteerd als een
waarde op **corpusniveau** in het afzonderlijke neurale traject, wordt opnieuw afgeleid door de
verificateur, en telt nooit mee voor de chrF++-hoofdscore
([Scorespecificatie](/docs/network/specifications/scoring#how-runs-are-scored)). Metrieken zijn
plug-ins ([Plug-inspecificatie](/docs/reference/plugin-spec)), dus een
QE-metriek op segmentniveau is iets wat deze testomgeving aankan. Totdat een dergelijke metriek is gekoppeld,
gepubliceerd en per taal is gemeta-evalueerd zoals dat voor de op referenties gebaseerde metrieken
gebeurt ([Betrouwbaarheid van metrieken](/docs/network/specifications/metric-reliability)), doen
we geen uitspraken over individuele uitvoer.

---

Deze beperkingen zullen verschuiven naarmate het werk vordert. Wanneer een van deze beperkingen verandert, verandert deze pagina mee — en de wijziging dient zichtbaar te zijn in de paginageschiedenis, niet stilzwijgend verwijderd.
