---
sidebar_position: 1
title: "Vertaling Is Geen Revitalisering"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "Wat machinevertaling wel en niet kan betekenen voor bedreigde talen — zonder omwegen gesteld. MT is infrastructuur voor taalgemeenschappen. Het vervangt nooit mensen die met mensen spreken."
related:
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/put-it-to-work
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who decides what happens to language data, and consent before deployment"
---

# Vertaling Is Geen Revitalisering

> **Standpunt.** Machinevertaling converteert tekst tussen talen. Revitalisering creëert nieuwe sprekers. Dit zijn verschillende activiteiten met verschillende succescriteria, en geen enkele score op een ranglijst verandert dat. Wij bouwen MT als infrastructuur die de doelen van een gemeenschap dient — nooit als vervanging voor intergenerationele overdracht. Kinderen leren taal van mensen, niet van machines.

In 2026 is het verleidelijk te geloven dat software alles kan oplossen, inclusief een taal die sprekers verliest. Wij willen nauwkeurig uiteenzetten waarom die overtuiging onjuist is — en wat vertaaltechnologie *eerlijk gezegd* kan bijdragen.

Dit stuk bestaat omdat een kritiek op dit project, geschreven vanuit het perspectief van een taalkundige, met klem betoogde: een perfect Engels→Cree-vertaalsysteem zou het overdrachtsprobleem (kinderen die de taal thuis niet leren), het prestigeprobleem (Engels als de taal van economische macht) of het pedagogische probleem (niet genoeg immersiescholen en opgeleide leerkrachten) niet oplossen. Het zou de situatie zelfs kunnen verergeren, door de illusie te wekken dat "de computer Cree kan spreken" en de urgentie van menselijke overdracht af te zwakken. We hebben het grootste deel van die kritiek aanvaard, en we publiceren onze reactie hier in plaats van deze te verbergen.

---

## Wat revitalisering werkelijk vereist

De onderzoeksliteratuur over taalrevitalisering is consistent op één punt: talen overleven wanneer zij tussen generaties worden doorgegeven — wanneer ouders, grootouders en gemeenschappen ze spreken met kinderen, en kinderen opgroeien en ze terugspreken (Fishman 1991; Hinton & Hale 2001). Al het andere — scholen, media, woordenboeken, apps — ondersteunt die overdracht, of het ondersteunt niets.

Geen enkel vertaalsysteem neemt deel aan die uitwisseling. Een model dat een Engelstalig document omzet naar Plains Cree creëert geen spreker. Het bezet geen klas voor immersieonderwijs, leidt geen leraar op en zit niet met een kind aan een keukentafel. Als ons werk ooit wordt omschreven als "talen redden", is die omschrijving onjuist en zullen wij dat zeggen.

## Wat MT niet kan doen

Duidelijk gesteld, zodat er later geen onduidelijkheid bestaat:

- **Het kan sprekers niet vervangen.** Uitvoer die niet is beoordeeld door een vloeiende spreker is een concept, geen tekst. Onze eigen [beoordelingsregels](/docs/network/specifications/scoring) behandelen elke geautomatiseerde score als een benadering; alleen menselijke beoordeling bevestigt de bruikbaarheid.
- **Het kan geen eerste taal aanleren.** Kinderen verwerven taal door relaties en onderdompeling, niet door vertaalde documenten.
- **Het kan een schadelijke illusie wekken.** Een demo die een taal "spreekt" kan de indruk wekken dat de taal veilig is, terwijl dat niet zo is. Dit prestigerisico is reëel, en we beschouwen het als een open vraagstuk dat *samen met* gemeenschappen moet worden onderzocht, niet als een gespreksonderwerp om te beheersen.
- **Het kan niets beslissen.** Of er een vertaalsysteem voor een taal moet bestaan en waar het mag worden gebruikt, is aan de gemeenschap — inclusief de beslissing om het helemaal niet in te zetten. Die controle is ingebouwd in de architectuur voor [eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer) en [datasoevereiniteit](/docs/your-words-your-rules), en omvat ook contexten: een gemeenschap kan machinevertaling accepteren voor officiële documenten en weigeren voor lesmateriaal.

## Wat MT eerlijk gezegd kan doen

Tegen die achtergrond zijn er concrete, afgebakende bijdragen die vertaalinfrastructuur levert — elk ten dienste van mensen die het echte werk al doen.

**1. Doorvoercapaciteit voor overbelaste vertalers.** Vertaalbureaus binnen gemeenschappen zien meer documenten die in de taal *zouden moeten* bestaan dan menselijke vertalers vanuit het niets kunnen produceren. Een machinaal concept verandert het werk van "alles vertalen" naar "controleren en corrigeren" — en gecontroleerde onderzoeken hebben uitgewezen dat post-editing aanzienlijk sneller is dan vertalen vanuit het niets, met behoud of verbetering van de kwaliteit (Plitt & Masselot 2010; Green, Heer & Manning 2013). We beschrijven deze workflow in detail in [In de praktijk brengen](/docs/put-it-to-work). De kanttekening: die onderzoeken hadden betrekking op talenparen met veel beschikbare data; we hebben nog geen gelijkwaardig bewijs voor polysynthetische talen, en dat is deels wat dit project beoogt te meten.

**2. Praktische hefboomwerking voor taalrechten.** Het recht op overheidsdiensten in Inheemse talen bestaat juridisch in verschillende rechtsgebieden. Wat vaak ontbreekt, is de praktische capaciteit om vertalingen te produceren op de snelheid die de bureaucratie vereist. Een gemeenschap die een beleidsdocument van vijftig pagina's in dagen in plaats van maanden kan omzetten naar een beoordeelde vertaling, staat sterker in onderhandelingen. De technologie creëert het recht niet; zij maakt het recht moeilijker te negeren.

**3. Herbruikbare taalkundige infrastructuur.** De morfologische analysator (FST) die wij gebruiken om te verifiëren dat vertaaluitvoer echte woorden bevat — geen gehallusineerde — legt vast *waarom* elke woordvorm geldig is. Diezelfde machinerie vormt de basis voor leermiddelen: vervoegingstrainers, schrijfhulpen met foutcorrectie, morfologische verkenners. De verificatie-engine en de pedagogische engine zijn hetzelfde artefact. Dit is een mogelijke weg, geen belofte — de leermiddelen moeten nog worden gebouwd, en of dat gebeurt is een beslissing van de gemeenschap.

**4. Ondersteuning voor tweedetaalleerders.** Revitalisering betreft niet alleen kinderen die een eerste taal verwerven. Het betreft ook volwassenen die de taal als tweede taal leren — mensen die misschien nooit de vloeiendheid van een Oudste bereiken, maar die gemeenschapsdocumenten kunnen lezen, met begrip kunnen deelnemen en de publieke aanwezigheid van de taal kunnen vergroten door haar te gebruiken. Voor deze groep is een vertaalhulpmiddel een echt instrument, zoals een woordenboek een instrument is.

**5. Een reden om het werk lokaal te financieren en te bezitten.** In ons model gaan beproefde methoden volledig [over in gemeenschapseigendom](/docs/network/sovereignty/ownership-transfer), en alles wat een gemeenschap verdient aan een bezit dat haar eigendom is, is volledig voor haarzelf ([Wie het mag gebruiken en wat het kost](/docs/getting-started/who-may-use-this)). Sprekers worden [betaald voor hun expertise](/docs/working-with-speakers), niet gevraagd om het vrijwillig te doen. Ook dat is op zichzelf geen revitalisering — maar het zorgt ervoor dat middelen naar de mensen gaan die zich inzetten voor revitalisering, in plaats van van hen weg.

## De eerlijke formulering

Het vakgebied kent een lange geschiedenis van technologieprojecten die arriveren met reddingsnarratieven en vertrekken met publicaties (Bird 2020). Wij proberen een beperktere claim te handhaven: **MT is infrastructuur.** Infrastructuur dient doelen die door anderen worden gesteld. Wegen beslissen niet waar u naartoe reist; deze technologie besluit niet of een taal voortleeft. Sprekers, families en gemeenschappen doen dat — en de formulering van het [UNESCO Internationaal Decennium van Inheemse Talen](https://idil2022-2032.org/) heeft gelijk door Inheemse volkeren, niet instrumenten, centraal te stellen.

Als een gemeenschap concludeert dat vertaaltechnologie haar doelen dient, willen wij dat dit de best mogelijke, meest verantwoorde versie is — eigendom van hen, gevalideerd door hun sprekers, ingezet op hun voorwaarden. Als een gemeenschap concludeert dat het niet helpt, is die conclusie een geldig resultaat van dit project, geen mislukking ervan. Beide helften van die zin zijn toezeggingen.

---

## Wat dit voor u betekent

:::info[Als u lid bent van een gemeenschap]
Dit project zal u niet vertellen dat een app uw taal kan redden — dat kan het niet. Wat het biedt, is begrensd: snellere documentvertaling onder controle van vloeiende sprekers, infrastructuur die uw gemeenschap volledig in eigendom kan hebben, en compensatie voor de expertise van sprekers. Of en hoe het wordt gebruikt, is de beslissing van uw gemeenschap, inclusief de beslissing om het niet te gebruiken. Zie [Uw woorden, uw regels](/docs/your-words-your-rules) en [Fouten melden en correcties bezitten](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Als u onderzoeker bent]
Beschouw "machinevertaling voor bedreigde talen" als een infrastructurele claim, niet als een claim over revitalisering, en uw evaluatievraag verandert: niet "is de BLEU-score hoog?", maar "vermindert dit meetbaar de werklast van de mensen die het echte werk doen, onder hun voorwaarden?" In de [benchmarkspecificatie](/docs/network/specifications/benchmark) en [Scorebord en publiceren](/docs/reference/leaderboard) houden we onszelf aan die standaard.
:::

:::info[Als u een bouwer bent]
Bouw voor de post-editing-workflow, niet voor de demo. De gebruiker van uw methode is een vloeiende spreker die een concept corrigeert, en het ergste faalscenario zijn gehallucineerde woorden die voor niet-sprekers plausibel lijken — daarom vormt morfologische validatie hier de poortwachter voor alles. Begin met [Een methode indienen](/docs/network/getting-started/submit-a-method) en [In de praktijk brengen](/docs/put-it-to-work).
:::

---

## Bronnen

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## Zie ook

- [Samenwerken met sprekers](/docs/working-with-speakers) — het vergoedingsmodel, in cijfers
- [In de praktijk brengen](/docs/put-it-to-work) — het post-editing-traject
- [Scorebord en publiceren](/docs/reference/leaderboard) — de volledige platformarchitectuur, inclusief §8 over spanningen die we nog niet hebben opgelost
