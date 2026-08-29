---
sidebar_position: 1
title: "Vertaling Is Geen Revitalisering"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "Wat machinevertaling wel en niet kan betekenen voor bedreigde talen — zonder omwegen gesteld. MT is infrastructuur voor taalgemeenschappen. Het vervangt nooit mensen die met mensen spreken."
related:
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/network/perspectives/from-benchmark-to-daily-use
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Data-sovereignty principles, CARE, and consent before deployment"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Vertaling Is Geen Revitalisering

> **Standpunt.** Machinevertaling converteert tekst tussen talen. Revitalisering creëert nieuwe sprekers. Dit zijn verschillende activiteiten met verschillende succescriteria, en geen enkele score op een ranglijst verandert dat. Wij bouwen MT als infrastructuur die de doelen van een gemeenschap dient — nooit als vervanging voor intergenerationele overdracht. Kinderen leren taal van mensen, niet van machines.

In 2026 is het verleidelijk te geloven dat software alles kan oplossen, inclusief een taal die sprekers verliest. Wij willen nauwkeurig uiteenzetten waarom die overtuiging onjuist is — en wat vertaaltechnologie *eerlijk gezegd* kan bijdragen.

Dit stuk bestaat omdat een taalkundige die wij uitnodigden om dit project te bekritiseren het argument krachtig naar voren bracht: een perfect Engels→Cree-vertaalsysteem zou het transmissieprobleem niet oplossen (kinderen die de taal thuis niet leren), het prestigeprobleem (Engels als de taal van economische macht), noch het pedagogische probleem (te weinig immersieonderwijs en opgeleide leraren). Het zou de situatie zelfs kunnen verslechteren, door de illusie te wekken dat "de computer Cree spreekt" en de urgentie van menselijke overdracht te verzachten. Wij hebben het grootste deel van die kritiek aanvaard, en wij publiceren ons antwoord hier in plaats van het te verdoezelen.

---

## Wat revitalisering werkelijk vereist

De onderzoeksliteratuur over taalrevitalisering is consistent op één punt: talen overleven wanneer zij tussen generaties worden doorgegeven — wanneer ouders, grootouders en gemeenschappen ze spreken met kinderen, en kinderen opgroeien en ze terugspreken (Fishman 1991; Hinton & Hale 2001). Al het andere — scholen, media, woordenboeken, apps — ondersteunt die overdracht, of het ondersteunt niets.

Geen enkel vertaalsysteem neemt deel aan die uitwisseling. Een model dat een Engelstalig document omzet naar Plains Cree creëert geen spreker. Het bezet geen klas voor immersieonderwijs, leidt geen leraar op en zit niet met een kind aan een keukentafel. Als ons werk ooit wordt omschreven als "talen redden", is die omschrijving onjuist en zullen wij dat zeggen.

## Wat MT niet kan doen

Duidelijk gesteld, zodat er later geen onduidelijkheid bestaat:

- **Het kan sprekers niet vervangen.** Uitvoer die geen vloeiende spreker heeft beoordeeld, is een concept, geen tekst. Onze eigen [scoringsregels](/docs/network/specifications/scoring) behandelen elke geautomatiseerde score als een benadering; alleen menselijke beoordeling bevestigt bruikbaarheid.
- **Het kan geen eerste taal aanleren.** Kinderen verwerven taal via relaties en onderdompeling, niet via vertaalde documenten.
- **Het kan een schadelijke illusie creëren.** Een demo die een taal "spreekt", kan suggereren dat de taal veilig is terwijl dat niet het geval is. Dit prestigerisico is reëel, en wij behandelen het als een open vraag die *samen met* gemeenschappen onderzocht moet worden, niet als een gespreksonderwerp dat beheerd moet worden.
- **Het kan niets beslissen.** Of een vertaalsysteem voor een taal zou moeten bestaan, en waar het mag worden gebruikt, is de beslissing van de gemeenschap — inclusief de beslissing om het helemaal niet in te zetten. Die controle is ingebouwd in de architectuur voor [eigendomsoverdracht](/docs/network/sovereignty/ownership-transfer) en [gegevenssouvereiniteit](/docs/network/sovereignty/data-sovereignty), en omvat ook contexten: een gemeenschap kan MT accepteren voor officiële documenten en weigeren voor lesmateriaal.

## Wat MT eerlijk gezegd kan doen

Tegen die achtergrond zijn er concrete, afgebakende bijdragen die vertaalinfrastructuur levert — elk ten dienste van mensen die het echte werk al doen.

**1. Doorvoer voor overbelaste vertalers.** Gemeenschapsvertaalbureaus worden geconfronteerd met meer documenten die *zouden moeten* bestaan in de taal dan menselijke vertalers vanaf nul kunnen produceren. Een machineconcept verandert de taak van "alles vertalen" naar "beoordelen en corrigeren" — en gecontroleerde studies hebben aangetoond dat postediting aanzienlijk sneller is dan vertalen vanaf nul, met behoud of verbetering van kwaliteit (Plitt & Masselot 2010; Green, Heer & Manning 2013). Wij beschrijven deze workflow in detail in [Van Benchmark naar Dagelijks Gebruik](/docs/network/perspectives/from-benchmark-to-daily-use). De kanttekening: die studies hadden betrekking op taalparen met veel bronmateriaal; wij beschikken nog niet over gelijkwaardig bewijs voor polysynthetische talen, wat deels is wat dit project is opgezet om te meten.

**2. Praktische hefboomwerking voor taalrechten.** Het recht op overheidsdiensten in Inheemse talen bestaat juridisch in verschillende rechtsgebieden. Wat vaak ontbreekt, is de praktische capaciteit om vertalingen te produceren op de snelheid die de bureaucratie vereist. Een gemeenschap die een beleidsdocument van vijftig pagina's in dagen in plaats van maanden kan omzetten naar een beoordeelde vertaling, staat sterker in onderhandelingen. De technologie creëert het recht niet; zij maakt het recht moeilijker te negeren.

**3. Herbruikbare taalkundige infrastructuur.** De morfologische analysator (FST) die wij gebruiken om te verifiëren dat vertaaluitvoer echte woorden bevat — geen gehallusineerde — legt vast *waarom* elke woordvorm geldig is. Diezelfde machinerie vormt de basis voor leermiddelen: vervoegingstrainers, schrijfhulpen met foutcorrectie, morfologische verkenners. De verificatie-engine en de pedagogische engine zijn hetzelfde artefact. Dit is een mogelijke weg, geen belofte — de leermiddelen moeten nog worden gebouwd, en of dat gebeurt is een beslissing van de gemeenschap.

**4. Ondersteuning voor tweedetaalleerders.** Revitalisering betreft niet alleen kinderen die een eerste taal verwerven. Het betreft ook volwassenen die de taal als tweede taal leren — mensen die misschien nooit de vloeiendheid van een Oudste bereiken, maar die gemeenschapsdocumenten kunnen lezen, met begrip kunnen deelnemen en de publieke aanwezigheid van de taal kunnen vergroten door haar te gebruiken. Voor deze groep is een vertaalhulpmiddel een echt instrument, zoals een woordenboek een instrument is.

**5. Een reden voor het werk om thuis gefinancierd en eigendom te zijn.** In ons model worden bewezen methoden [overgedragen aan gemeenschapseigendom](/docs/network/sovereignty/ownership-transfer) zonder voorbehoud, en alles wat een gemeenschap verdient met een bezit dat zij in eigendom heeft, is volledig van haarzelf ([hoe het werk wordt gefinancierd](/docs/network/sovereignty/economic-model)). Sprekers worden [betaald voor hun expertise](/docs/network/perspectives/how-speakers-get-paid), niet gevraagd die vrijwillig in te zetten. Niets van dat alles is revitalisering — maar het leidt middelen naar de mensen die revitalisering doen, in plaats van weg van hen.

## De eerlijke formulering

Het vakgebied kent een lange geschiedenis van technologieprojecten die arriveren met reddingsnarratieven en vertrekken met publicaties (Bird 2020). Wij proberen een beperktere claim te handhaven: **MT is infrastructuur.** Infrastructuur dient doelen die door anderen worden gesteld. Wegen beslissen niet waar u naartoe reist; deze technologie besluit niet of een taal voortleeft. Sprekers, families en gemeenschappen doen dat — en de formulering van het [UNESCO Internationaal Decennium van Inheemse Talen](https://idil2022-2032.org/) heeft gelijk door Inheemse volkeren, niet instrumenten, centraal te stellen.

Als een gemeenschap concludeert dat vertaaltechnologie haar doelen dient, willen wij dat dit de best mogelijke, meest verantwoorde versie is — eigendom van hen, gevalideerd door hun sprekers, ingezet op hun voorwaarden. Als een gemeenschap concludeert dat het niet helpt, is die conclusie een geldig resultaat van dit project, geen mislukking ervan. Beide helften van die zin zijn toezeggingen.

---

## Wat dit voor u betekent

:::info[Als u een gemeenschapslid bent]
Dit project zal u niet vertellen dat een app uw taal kan redden — dat kan ze niet. Wat het biedt is begrensd: snellere documentvertaling onder toezicht van vloeiende sprekers, infrastructuur die uw gemeenschap volledig in eigen beheer kan nemen, en vergoeding voor de expertise van sprekers. Of en hoe dit wordt gebruikt, is de beslissing van uw gemeenschap, inclusief de beslissing om het niet te gebruiken. Zie [Voor Taalgemeenschappen](/docs/network/community/for-language-communities) en [Fouten Melden en Correcties in Eigen Beheer Nemen](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Als u een onderzoeker bent]
Beschouw "MT voor bedreigde talen" als een infrastructuurclaim, niet als een revitalisatieclaim, en uw evaluatievraag verandert: niet "is de BLEU-score hoog?" maar "vermindert dit aantoonbaar de werklast van de mensen die het echte werk doen, op hun eigen voorwaarden?" De [benchmarkspecificatie](/docs/network/specifications/benchmark) en [Hoe Het Werkt §8 (Spanningsvelden en Beperkingen)](/docs/network/how-it-works#8-tensions-and-limitations) zijn de plaatsen waar wij onszelf aan die standaard houden.
:::

:::info[Als u een ontwikkelaar bent]
Bouw voor de post-editing-workflow, niet voor de demo. De gebruiker van uw methode is een vloeiende spreker die een concept corrigeert, en het ergste faalscenario is gehallusineerde woorden die plausibel lijken voor niet-sprekers — daarom bewaakt morfologische validatie hier alles. Begin met [Een Methode Indienen](/docs/network/getting-started/submit-a-method) en [Van Benchmark naar Dagelijks Gebruik](/docs/network/perspectives/from-benchmark-to-daily-use).
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

- [Hoe Sprekers Worden Betaald](/docs/network/perspectives/how-speakers-get-paid) — het vergoedingsmodel, in cijfers
- [Van Benchmark naar Dagelijks Gebruik](/docs/network/perspectives/from-benchmark-to-daily-use) — het postediting-traject
- [Hoe Het Werkt](/docs/network/how-it-works) — de volledige platformarchitectuur, inclusief §8 over spanningen die wij nog niet hebben opgelost
