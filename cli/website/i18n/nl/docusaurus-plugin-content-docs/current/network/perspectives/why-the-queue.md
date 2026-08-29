---
sidebar_position: 5
title: "Waarom de wachtrij zo is opgebouwd"
slug: '/network/perspectives/why-the-queue'
description: "De filosofie achter de community-compute-wachtrij: gedoneerde tokens zijn een budget, het netwerk is de missie, en een prioriteitenlijst is een geheel van overtuigingen dat opgeschreven, bekritiseerd en falsifieerbaar moet zijn."
related:
  - label: "Queue Construction Specification"
    to: /docs/network/specifications/queue-construction
    kind: spec
    note: "The formula this philosophy commits us to"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Waarom de Wachtrij Op Deze Manier Is Opgebouwd

De wachtrij is het meest bepalende redactionele artefact dat wij publiceren.
Elk item daarop zegt: *als u bereid bent een paar cent aan API-krediet te besteden aan machinale vertaling voor talen met weinig middelen, is dit de beste plek die wij kennen om dat te doen.* Die zin brengt verplichtingen met zich mee. Deze pagina gaat over wat die verplichtingen zijn en hoe de
[formule voor wachtrijconstructie](/docs/network/specifications/queue-construction)
daaraan voldoet.

## Een prioriteitenlijst is een geheel van overtuigingen

Elke ordening van werk bevat antwoorden op drie vragen, ongeacht of
iemand die ooit heeft opgeschreven:

1. **Wat waarderen wij?** Wat is een voltooide run eigenlijk *waard*?
2. **Wat geloven wij?** Wat verwachten wij te zien wanneer een run die
   wij nog niet hebben geprobeerd, wordt uitgevoerd?
3. **Wat geven wij toe niet te weten?** Waar moet nieuwsgierigheid
   voorrang krijgen boven voorspelling?

De meeste benchmark-wachtrijen beantwoorden deze vragen impliciet — "grootste kloof eerst,"
"nieuwste model eerst," iemands spreadsheet. Wij zijn van mening dat een project dat
vreemden vraagt geld uit te geven, expliciete antwoorden verdient, in een formule
die iedereen kan narekenen, met alle invoergegevens gepubliceerd. Niet omdat formules
neutraal zijn — dat zijn ze niet, de onze bevat onze missie en onze vermoedens —
maar omdat **een opgeschreven vooroordeel betwistbaar is, en een ongeschreven
vooroordeel niet.**

## Wat wij waarderen: ketens, geen vinkjes

Onze missie is *elke taal naar elke taal via gemeten individuele parenketens*. De wereldwijde vertaalinfrastructuur is Engels-centrisch; de onze begon ook zo — een ster van eng→X-benchmarks. Maar een ster meet altijd slechts één ding: afstand tot het Engels. De talen van de wereld verdienen een *netwerk*: wanneer er geen directe benchmark bestaat tussen twee talen, zou een keten van gemeten paren dat moeten opvangen — en de kwaliteit ervan zou iets moeten zijn dat wij kunnen schatten op basis van metingen, in plaats van iets dat wij simpelweg beweren.

De waarde van een voltooide run is dus niet "nog een rij op het scorebord." Het is **hoeveel sterker het gehele netwerk wordt**: de winst in onze kwaliteitsgewogen ketenkapaciteitsdoelstelling Φ, die voor elk geordend taalpaar op aarde dat wij bijhouden vraagt: *hoe goed is de beste keten daartussen op dit moment?* Een run die een geïsoleerde taal verbindt, is honderden runs waard die een al helder hoekje verder oppoetsen — en de formule zegt precies hoeveel honderden, in plaats van dat aan intuïtie over te laten. Dit is dezelfde gedachte die M2M-100 ertoe bracht "brugtalen" te ontginnen over taalfamilies heen, in plaats van meer Engels-gekoppelde data (Fan et al. 2021) — continu gemaakt, en gericht op evaluatie in plaats van training.

Twee gevolgen die wij bewust aanvaarden:

- **Een goedkope kleine run op een ongemeten paar verslaat doorgaans een dure
  run op een gemeten paar.** Bijgedragen rekenkracht is een budget; wij rangschikken op
  netwerkwinst *per dollar* (de klassieke gretige regel voor maximale dekking binnen een budget — Khuller, Moss & Naor 1999). De honderdste verbinding verlichten doet meer voor de missie dan de eerste vergulden.
- **Geschatte ketens zijn minder waard dan gemeten verbindingen.** Ons ketenmodel vermenigvuldigt verbindingskwaliteiten en brengt een getrouwheidskorting per tussenstation in rekening, omdat veertig jaar resultaten van pivotvertaling aantonen dat routering via een tussentaal meer verlies oplevert dan naïeve samenstelling suggereert (Utiyama & Isahara 2007; Wu & Wang 2007). De korting is de permanente prikkel van de formule om *het directe paar te meten* in plaats van te berusten in een plausibele keten.

## Wat wij geloven: voorspellingen eenvoudig genoeg om te controleren

Om een niet-uitgevoerd experiment te waarderen, moet u de uitkomst voorspellen. Hier bestaat een spectrum, van "neem niets aan" tot "train een model om te raden." Wij stoppen bewust vroeg op dat spectrum: onze voorspelling is een som die een bijdrager op een servetje kan controleren — *hoe scoort dit taalpaar doorgaans, hoe wijkt dit model doorgaans af, bestaat er coachingbewijs voor precies deze taal* — en verder niets. Geen geleerde gewichten, geen embeddings, geen model waarvan de eigen vooroordelen ook nog gecontroleerd zouden moeten worden.

Dit kost ons nauwkeurigheid. Een gradient-boosted voorspeller over taalkenmerken zou beter raden. Wij ruilen die nauwkeurigheid in voor een eigenschap die wij meer waarderen: **elke rang in de wachtrij is met de hand te herleiden uit cijfers die op het item zelf staan vermeld.** Wanneer iemand vraagt "waarom staat deze Faeröerse run op #1?", is het antwoord vier gepubliceerde cijfers en één zin, niet "het model zei het." Onderzoek naar actief leren heeft al lang de balans gezocht tussen de verfijning van selectie en vertrouwen en controleerbaarheid (Haffari, Roy & Sarkar 2009 brachten precies deze afweging naar machinale vertaling); een door vrijwilligers gefinancierde benchmark hoort aan het controleerbare uiteinde.

## Wat wij niet weten: nieuwsgierigheid met een budget

Een wachtrij die puur door voorspellingen wordt aangestuurd, heeft een zwak punt: zij laat vol vertrouwen alles verhongeren waarover zij slecht voorspelt, en komt er nooit achter dat zij het fout had. Het klassieke antwoord uit de bandit-literatuur is *optimisme bij onzekerheid*: geef elke onbeproefde optie een bonus die krimpt naarmate bewijs zich opstapelt (Auer, Cesa-Bianchi & Fischer 2002). Onze wachtrij draagt precies die bonus — geschaald, niet toevallig, naar de ruisdrempel van onze instrumenten: optimisme overschrijdt nooit de ~5 chrF++-punten die kleine dev-corpora toch niet kunnen onderscheiden ([Corpusontwerp §6.3](/docs/network/specifications/corpus-design)).

Dezelfde bescheidenheid komt tot uiting in twee asymmetrieën die het benoemen waard zijn:

- **Alles wat gepubliceerd is, is bewijs; alleen open corpora zijn acties.**
  Resultaten op corpora met een beperkte licentie informeren de kennis van het netwerk,
  maar de wachtrij vraagt bijdragers uitsluitend om wat iedereen vrij mag uitvoeren.
- **Coachingbewijs is niet overdraagbaar.** Waar gecoachte runs beter presteren dan naïeve,
  is dat een gemeten feit voor die taal — en stilte over alle andere. De wachtrij handhaaft de volgorde waarbij de baseline eerst komt, overal waar coaching ongemeten is, in plaats van aan te nemen dat de winst van één taal generaliseert.

## Wat wij weigeren te doen

- **Geen betrokkenheidsoptimalisatie.** Items worden nooit geordend om klikken, reeksen of voltooiingstevredenheid te maximaliseren. De netwerkdoelstelling is de enige doelstelling.
- **Geen verborgen redactionele duim.** Als wij ooit een paar moeten bevorderen (een gemeenschapspartnerschap, een deadline), zal dat verschijnen als een benoemde, versioned term in de specificatie — niet als een stille hersortering.
- **Geen claimvergrendeling.** Iedereen mag elk item op elk moment uitvoeren; identieke runs worden gededupliceerd op basis van vingerafdruk en onafhankelijke herhalingen zijn welkom als bewijs. Een wachtrijpositie is advies, geen toestemming.
- **Geen capabiliteitsteater.** Φ en elke score die daarin wordt verwerkt, zijn development-set-cijfers met bekende voorbehouden (bovengrenzen voor contaminatie, verschillen in schaal tussen talen). Zij sturen uitgaven; zij worden nooit geciteerd als wat een model "kan."

## Gebouwd om publiekelijk ongelijk te hebben

De formule is versioned (`ecv-v2`), de parameters worden herhaald in
elke gepubliceerde wachtrij, en de centrale modelleringsaanname — dat
ketenkwaliteit multiplicatief samengesteld wordt met een korting per tussenstation —
is nu *toetsbaar met onze eigen data*: het netwerk bevat gemeten driehoeken (directe deu→fra naast deu→eng en eng→fra), zodat wij werkelijke geketende vertalingen kunnen beoordelen aan de hand van de voorspellingen van het model en de korting empirisch kunnen bepalen in plaats van kiezen. Wanneer dat gebeurt, zal v3 dat vermelden, en zal deze pagina uitleggen wat er is veranderd en waarom. Dat is de norm waaraan wij willen worden gehouden: niet een wachtrij die altijd gelijk heeft, maar één waarvan de redenering altijd is vastgelegd.

*De wiskunde, standaardwaarden, een uitgewerkt voorbeeld en volledige citaten staan in de
[Specificatie voor Wachtrijconstructie](/docs/network/specifications/queue-construction).*
