---
sidebar_position: 1
title: "Voor Taalgemeenschappen"
---

# Voor Taalgemeenschappen

> **Samenvatting.** Uw gemeenschap kan haar eigen testset bezitten — de "antwoordsleutel" waaraan elke vertaalmethode wordt gemeten — en haar eigen wedstrijd op haar eigen voorwaarden uitvoeren, zonder de gegevens ooit uit handen te geven. Deze pagina legt uit wat het Netwerk van taalgemeenschappen vraagt (referentievertaingen, vertaalreview, coachingdata), wat u terugkrijgt (betaald werk tegen gepubliceerde tarieven, code-eigendom, volledige controle over implementatie), en de soevereiniteitsgaranties die vooropstaan. Programmeerkennis is niet vereist, en niets hier vereist vertrouwen in ons: de garanties zijn structureel, geen beloften.

U hoeft geen programmeur te zijn om bij te dragen aan het Netwerk. Als u een inheemse of laagbronnen taal spreekt, bent u de belangrijkste persoon in dit ecosysteem.

---

## Soevereiniteit Staat Voorop

Voordat we iets van u vragen, geldt de basisregel: **uw taaldata is van u.** Taaldata is *biodata* — het draagt de identiteit en relaties van uw gemeenschap en kan niet zinvol worden geanonimiseerd — dus de mensen die het aanleveren, houden de sleutels ervan in handen, en van alles wat eraan wordt gemeten. Het Netwerk is gebouwd op [Inheemse datasoevereiniteitsprincipes](/docs/network/sovereignty/data-sovereignty):

- Wij verzamelen of bewaren uw taalkundige gegevens nooit op onze servers
- Vertaalmethoden gebruiken de `api`-architectuur — alle coachingdata, woordenboeken en grammaticaregels blijven op infrastructuur die u beheert
- U bepaalt wie methoden voor uw taal mag ontwikkelen
- Leaderboard-scores bewijzen dat een methode werkt; ze verlenen geen toestemming om deze te implementeren

:::note[Huidige stand van zaken]
Het eigendomsoverdrachtsmodel dat hieronder wordt beschreven is een **vastgelegd ontwerp, nog geen actief programma.** Het leaderboard staat open voor inzendingen en heeft momenteel geen gepubliceerde runs, en er is nog geen methode overgedragen aan een gemeenschap. Wij beschrijven hoe het is ontworpen te werken zodat u ons daaraan kunt houden — niet om te suggereren dat het al in werking is. De relatie, en uw zeggenschap over uw gegevens, komen op de eerste plaats; de rest volgt daaruit.
:::

---

## Bezit Uw Testset

De sterkste positie die een gemeenschap in dit systeem kan innemen, is **eigenaar zijn van de benchmark zelf**. Een testset is de antwoordsleutel: wie deze bezit, bepaalt wat "goede vertaling" voor de taal betekent, en elke methode — de onze, die van een bedrijf, van wie dan ook — wordt gemeten aan *uw* standaard.

- **Registratie is metadata, geen inhoud.** Een corpus registreren bij het Netwerk betekent het publiceren van een beschrijvende kaart — nooit het uploaden van het corpus. U kiest de [blootstellingslane](/docs/network/sovereignty/registering-corpora): open, afgeschermd of volledig soeverein.
- **Soevereine benchmarks blijven geheim.** In de soevereine lane verlaat de testset nooit de gemeenschapsinfrastructuur en zien wij deze nooit. Methoden worden aan uw kant ertegenaan gescoord; alleen de score wordt doorgestuurd.
- **U kunt uw eigen wedstrijd uitvoeren.** Het stapsgewijze draaiboek — [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) — begeleidt u bij het hosten van een door de gemeenschap gecontroleerde evaluatie op uw eigen voorwaarden: uw testset, uw regels, uw beslissing over wat (indien überhaupt iets) wordt gepubliceerd.

De garanties achter dit alles zijn schriftelijk vastgelegd, niet impliciet: [Data Stewardship](/docs/network/sovereignty/data-sovereignty) (het datasoevereiniteits-/CARE-standpunt en wat het ons verbiedt te doen) en [Ownership & Terms](/docs/network/sovereignty/ownership-transfer) (wat er contractueel gebeurt wanneer een methode wint).

---

## Wat Wij van U Nodig Hebben

### Referentievertaingen

Wij hebben gecureerde vertaalparen nodig voor evaluatie — Engels aan de ene kant, uw taal aan de andere. Deze worden de "antwoordsleutel" waaraan alle vertaalmethoden worden gescoord.

U kunt deze samenstellen uit:
- **Educatief materiaal** — oefeningen uit leerboeken, lesplannen, werkbladen
- **Gemeenschapsdocumenten** — notulen, nieuwsbrieven, aankondigingen
- **Alledaagse uitdrukkingen** — UI-teksten, app-labels, veelgebruikte uitdrukkingen
- **Culturele inhoud** — verhalen, liederen of beschrijvingen (met de juiste toestemmingen)

Het formaat is eenvoudige JSON:
```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

### Vertaalreview

Elke methode die beweert werkende vertalingen te produceren, heeft menselijke validatie nodig. Tweetalige sprekers beoordelen de uitvoer en vertellen ons of de computer het goed heeft gedaan — en belangrijker nog, *waarom* het fout ging.

### Coachingdata

Grammaticaregels, woordenboekitems, morfologische patronen — dit zijn de taalkundige bronnen die vertaalmethoden laten werken. Uw kennis van hoe uw taal werkt is door geen enkel AI-model te vervangen.

---

## Wat U Terugkrijgt

### Eigendom

Wanneer een vertaalmethode voor uw taal is gebouwd en gevalideerd op het Netwerk, wordt het [eigendom overgedragen](/docs/network/sovereignty/ownership-transfer) aan de bestuursorganisatie van uw gemeenschap. U bezit de code, de modelgewichten en de implementatie.

### Betaald werk, geen extractie

Corpusbouw en vertaalreview zijn professioneel werk, betaald tegen [gepubliceerde tarieven](/docs/network/perspectives/how-speakers-get-paid) — en betaling geeft geen recht op uw data. U wordt betaald voor het werk *en* blijft eigenaar van wat u bouwt. Champollion is een niet-commercieel onderzoeksproject: het verkoopt niets, meet niets af en [neemt geen aandeel](/docs/network/sovereignty/economic-model) in wat uw gemeenschap ooit verdient aan een methode die zij bezit.

### Controle

Uw bestuursorganisatie beheert:
- Wie toegang heeft tot de methode
- Of deze commercieel mag worden gebruikt — en zo ja, op uw voorwaarden, waarbij alles wat het oplevert bij u blijft
- Wanneer en hoe het wordt bijgewerkt
- Welke data wordt gebruikt voor verdere ontwikkeling

---

## Hoe U Kunt Deelnemen

:::tip[Iets wat sprekers vandaag kunnen doen]
Champollion bouwt geen corpora en host deze ook niet — testgegevens worden altijd opgehaald
uit de bronlocatie. Als sprekers in uw gemeenschap *nu meteen* zinnen willen bijdragen,
accepteert [Tatoeba](https://tatoeba.org) bijdragen zin voor zin
in elke taal, en open verzamelingen zoals
[OPUS](https://opus.nlpl.eu/) aggregeren parallelle tekst waaruit het Netwerk
benchmarks opbouwt. Zinnen die daar worden toegevoegd kunnen bij de volgende corpusbouw
evaluatiegegevens worden op dit platform. Een directe app voor sprekersbijdragen en een corpusbouwer
zijn de geplande volgende stap op onze roadmap.
:::

1. **Neem contact op** — Open een issue op de [Network-repository](https://github.com/gamedaysuits/Champollion) of stuur een e-mail naar [info@champollion.dev](mailto:info@champollion.dev)
2. **Beschrijf uw taal** — Tot welke taalfamilie behoort ze? Hoeveel sprekers zijn er? Welke schrijfsystemen worden gebruikt? Welke computationele bronnen bestaan er (FST's, woordenboeken, corpora)?
3. **Begin klein** — Zelfs 50 gecureerde vertaalparen zijn voldoende om een evaluatiedataset te maken en een nieuw leaderboard-track te openen. Corpuswerk wordt [betaald tegen gepubliceerde tarieven](/docs/network/perspectives/how-speakers-get-paid)
4. **Houd het van u** — Registreer het corpus als metadata in de lane van uw keuze ([Registering Corpora](/docs/network/sovereignty/registering-corpora)); als u de testset volledig geheim wilt houden, is het [soevereine wedstrijddraaiboek](/docs/network/sovereignty/run-a-sovereign-contest) de aangewezen weg
5. **Verbind ons met het bestuur** — Wie in uw gemeenschap heeft zeggenschap over taaldata en technologie? Het soevereiniteitsmodel van het Netwerk vereist een bestuurspartner

---

## Zie ook

- [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) — het draaiboek voor een door de gemeenschap gecontroleerde evaluatie
- [Terms Templates](/docs/network/sovereignty/terms-templates) — juridisch eenvoudige, op vertrouwensloosheid gerichte voorwaarden die uw gemeenschap kan aanpassen, met de risico's van het trojaans-paard-type uitgelegd
- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — het standpunt en de kaders (First Nations-datasoevereiniteit, CARE, Te Mana Raraunga) die het hebben gevormd
- [Ownership & Terms](/docs/network/sovereignty/ownership-transfer) — taalspecifieke voorwaarden en wat er gebeurt wanneer een methode wint
- [How the Work Is Funded](/docs/network/sovereignty/economic-model) — hoe geld stroomt in een niet-commercieel project
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — technische context voor onderzoekers die samenwerken met gemeenschappen
