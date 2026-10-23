---
title: "Technische beperkingen"
description: "Wat Champollion (nog) niet claimt, precies geformuleerd: de grenzen van morfologische validatie, zelfgerapporteerde vertrouwensniveaus, sprekervalidatie, het beheer van verzegelde tests en waarom er geen betrouwbaarheidsscore per zin wordt gegeven."
---

# Technische beperkingen

> **Nieuw hier?** [Wat het nog niet kan](/docs/what-it-cant-do-yet) legt
> hetzelfde uit in eenvoudige bewoordingen. Deze pagina is de nauwkeurige versie, voor
> ontwikkelaars, onderzoekers en agents.

Dit zijn de toezeggingen die we **niet** zullen overschrijden. Als er elders op deze
site iets wordt gesuggereerd dat verder gaat dan wat hier staat, beschouw dit dan als een fout en
[laat het ons weten](/docs/network/perspectives/reporting-errors-and-owning-corrections).

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

## 2. Vertrouwensniveaus: elke rij is momenteel zelfgerapporteerd {#2-trust-tiers-are-self-reported-at-launch}

De meeste scores worden berekend doordat bijdragers het testkader zelf uitvoeren en
het resultaat publiceren. **Verificatie** — het opnieuw scoren van een inzending aan de hand van de eigen
uitvoer tegen het canonieke corpus met SHA-pinning — is gebouwd, maar het is een
beheerdersopdracht die handmatig wordt uitgevoerd: niets voert dit uit bij inzending en niets
plant dit in, dus momenteel arriveert en blijft elke rij zelf-geëvalueerd
([Inzendregels](/docs/network/leaderboard/rules#verification-tiers)). Bekijk
de vertrouwensbadge bij elke rij: **"zelfgerapporteerd" betekent exact dat**, en het is
de standaard.

## 3. Gemeenschapsvalidatie door sprekers heeft nog niet plaatsgevonden

De voorgestelde prijs vereist **≥ 70% acceptatie door tweetalige sprekers** (er staat geen prijs open). Deze drempel is
gespecificeerd en de hulpmiddelen om deze uit te voeren zijn in ontwikkeling — maar **er is geen beoordeling door sprekers uit de gemeenschap uitgevoerd**, en **geen enkele score op deze site heeft de
sprekersdrempel gehaald**. chrF++ en elk ander automatisch getal zijn machinesignalen,
geen oordeel van de gemeenschap; daarom draagt geen enkele score hier een kwaliteitslabel.

## 4. De evaluatiesandbox en sleutelceremonie bestaan; geen enkele beheerder heeft ze gebruikt

We halen corpora op bij hun bron en voorzien ze van een SHA-pin, en achtergehouden splitsingen worden
verzegeld. Wanneer een gemeenschap een geheime testset beheert, kan een methode daartegen
worden geëvalueerd zonder dat de set ooit hun handen verlaat — en die evaluatie
heeft nu **twee trajecten**. Het
voorkeurstraject, voor standaard neurale modellen, is **declaratief**: de deelnemer
levert uitsluitend gegevens aan — safetensors-gewichten + een declaratieve tokenizer + een configuratie —
en de organisator voert dit uit in de eigen vertrouwde inference engine
(`trust_remote_code=False`, offline; permissief wat betreft de architectuur omdat
de veiligheid in de codevrije indeling zit, niet in de architectuurnaam). Er wordt in het geheel geen deelnemerscode
uitgevoerd, dus er hoeft niets in een sandbox te worden geplaatst; de veiligheidscontrole is een beslisbare
indelingsvalidatie (is dit safetensors en geen pickle? geen `trust_remote_code`?), en geen
poging om te bewijzen dat willekeurige code veilig is. Voor methoden die daadwerkelijk uit code bestaan
(pipelines, door LLM's begeleide hybriden), is de terugvaloptie de netwerkgeïsoleerde
**sandbox** (statische controles, `--network=none`-containers, uitgaand verkeer met uitsluitend scores, een
optioneel bestandstransport met een echte air-gap). Omdat de sandbox geen netwerkverbinding heeft, draait een
methode daar alleen met elk model dat deze aanroept binnen de eigen bundel: een
door een LLM begeleide hybride moet zijn LLM als open gewichten meeleveren, aangezien een gehoste LLM-API
niet bereikbaar is. De sandbox bevat niet-vertrouwde code in plaats van
de uitvoering ervan te weigeren, waardoor dit eerlijk gezegd het zwakkere traject is — de dragende
garantie ervan is `--network=none` (een heuristische statische scan kan een binair
model niet valideren), en verdere verharding (seccomp, microVM's) is uitgesteld. Zie
[een soevereine competitie organiseren](/docs/network/sovereignty/run-a-sovereign-contest)
voor wat er precies wel en niet actief is. De **sleutelceremonie van het offline knooppunt is
gebouwd** — de sleutel van de set wordt M-uit-N gesplitst en alleen in het geheugen opnieuw samengesteld tijdens een
door een quorum goedgekeurde uitvoering — maar deze is nog nooit gebruikt met een echte beheerder, en
de delen zijn in deze eerste versie gewone bestanden. Wat **niet** is gebouwd: drempelondertekening
(een score wordt ondertekend door een enkele knooppuntsleutel) en hardware-attestatie (scoremanifesten
worden uitsluitend in software ondertekend). Er is nog geen sleutelbeheerder vanuit de gemeenschap
aangesteld, waardoor de evaluatie voor de gouden-standaard-**prijs** gesloten blijft totdat
beheerders en de toestemming van de gemeenschap zijn geregeld.

## 5. Sleutels zijn momenteel in handen van de organisator; er zijn geen beheerders vanuit de gemeenschap aangesteld {#5-key-custody-is-designed-no-custodians-are-appointed-yet}

**Momenteel zijn de sleutels van een verzegelde set in handen van de organisator** — degene die deze heeft verzegeld,
op de eigen machine. **Champollion bewaart geen sleuteldelen.** Het bewaar*mechanisme*
voor meer dan één houder is gebouwd: de M-uit-N-sleutelceremonie van het offline knooppunt
splitst een setsleutel over beheerders. Dit is nog niet uitgevoerd met echte
beheerders. Beheerders worden gekozen door de gemeenschappen zelf, en er is er nog geen
aangesteld: **sleutelbeheerders vanuit de gemeenschap — nog niemand aangesteld.** Bewaarneming is
geen toestemming: het relationele proces voor toestemming van de gemeenschap is een eigen, langzamer en
belangrijker traject.

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
