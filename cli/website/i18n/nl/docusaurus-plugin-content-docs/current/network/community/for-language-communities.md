---
sidebar_position: 1
title: "Voor Taalgemeenschappen"
---

# Voor Taalgemeenschappen

> **Managementsamenvatting.** Uw gemeenschap kan haar eigen testset bezitten — het "antwoordmodel" waaraan elke vertaalmethode wordt getoetst — en een eigen competitie organiseren op haar eigen voorwaarden, zonder de gegevens ooit uit handen te geven. Deze pagina legt uit wat het Network vraagt van taalgemeenschappen (referentiewerk, beoordeling van vertalingen, coachinggegevens), wat u ervoor terugkrijgt (betaald werk tegen gepubliceerde tarieven zodra het werk gefinancierd is — er worden momenteel geen fondsen beheerd — plus eigendom van de code en volledige zeggenschap over de implementatie), en de soevereiniteitsbeschermingen die vooropstaan. Er is geen programmeerervaring vereist. Sommige beschermingen zijn ingebouwd in de software en de database; andere zijn vooralsnog toezeggingen, en [Eerlijke beperkingen](/docs/network/honest-limitations) licht toe welke.

U hoeft geen programmeur te zijn om bij te dragen aan het Netwerk. Als u een inheemse of laagbronnen taal spreekt, bent u de belangrijkste persoon in dit ecosysteem.

---

## Soevereiniteit Staat Voorop

Voordat we iets van u vragen, de basisregel: **uw taalgegevens zijn van u.** Taalgegevens zijn *biodata* — ze dragen de identiteit en relaties van uw gemeenschap in zich en kunnen niet op een betekenisvolle manier worden geanonimiseerd — dus de mensen die ze leveren, houden de sleutels in handen, evenals tot alles wat daaraan wordt afgemeten. Het Network is gebouwd op [principes van inheemse datasoevereiniteit](/docs/network/sovereignty/data-sovereignty):

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

De garanties achter dit alles zijn schriftelijk vastgelegd, niet impliciet:
[Datastewardship](/docs/network/sovereignty/data-sovereignty) (het standpunt over
datasoevereiniteit/CARE en wat het ons verbiedt te doen) en
[Eigenaarschap en voorwaarden](/docs/network/sovereignty/ownership-transfer) (wat
er contractueel gebeurt wanneer een methode wint).

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

Het opbouwen van een corpus en het beoordelen van vertalingen is professioneel werk, dat wordt betaald tegen
[gepubliceerde tarieven](/docs/network/perspectives/how-speakers-get-paid) zodra er financiering is
(momenteel worden er geen fondsen beheerd) — en betaling koopt uw gegevens niet af. U wordt betaald voor het werk *en* blijft de
eigenaar van wat u bouwt. Champollion is een niet-commercieel onderzoeksproject: het
verkoopt niets, meet geen verbruik, en [vraagt geen enkel aandeel](/docs/network/sovereignty/economic-model)
in wat uw gemeenschap eventueel verdient aan een methode die zij bezit.

### Controle

Uw bestuursorganisatie beheert:
- Wie toegang heeft tot de methode
- Of deze commercieel mag worden gebruikt — en zo ja, op uw voorwaarden, waarbij alles wat het oplevert bij u blijft
- Wanneer en hoe het wordt bijgewerkt
- Welke data wordt gebruikt voor verdere ontwikkeling

---

## Hoe U Kunt Deelnemen

:::tip[Iets wat sprekers vandaag al kunnen doen — mits de gemeenschap hiermee instemt]
Champollion bouwt of host geen corpora — testgegevens worden altijd opgehaald
bij de bron. Als sprekers in uw gemeenschap *op dit moment* zinnen willen bijdragen,
accepteert [Tatoeba](https://tatoeba.org) zin-voor-zin-bijdragen
in elke taal, en open collecties zoals
[OPUS](https://opus.nlpl.eu/) verzamelen parallelle teksten waar het Network
benchmarks op baseert. Zinnen die daar worden toegevoegd, kunnen hier evaluatiegegevens worden.

Wees u eerst bewust van de afweging: Tatoeba publiceert zinnen onder een open licentie
(standaard CC BY 2.0 FR), zodat iedereen ze kan kopiëren — inclusief voor het trainen van AI-modellen
— en reeds gemaakte kopieën kunnen niet worden ingetrokken. Dat kan de juiste
keuze zijn voor alledaagse zinnen. Voor alles wat uw gemeenschap onder haar eigen
controle wil houden, bewaart u de gegevens zelf en gebruikt u in plaats daarvan een
[verzegelde testset](/docs/network/sovereignty/run-a-sovereign-contest).
Een app voor directe bijdragen door sprekers en een corpusbouwer zijn gepland, maar nog
niet gebouwd.
:::

1. **Neem contact op** — Open een issue in de [Network-repository](https://github.com/gamedaysuits/Champollion) of stuur een e-mail naar [info@champollion.dev](mailto:info@champollion.dev)
2. **Beschrijf uw taal** — Tot welke familie behoort deze? Hoeveel sprekers zijn er? Welke schriftsystemen worden gebruikt? Welke computationele bronnen bestaan er (FST's, woordenboeken, corpora)?
3. **Begin klein** — Zelfs 50 gecureerde vertaalparen zijn al voldoende om een evaluatiedataset te maken en een nieuw leaderboard-traject te openen. Corpuswerk wordt [betaald tegen gepubliceerde tarieven](/docs/network/perspectives/how-speakers-get-paid) zodra er financiering is; momenteel worden er geen fondsen beheerd
4. **Houd het in eigen beheer** — Registreer het corpus als metadata in het traject van uw keuze ([Corpora registreren](/docs/network/sovereignty/registering-corpora)); als u de testset volledig geheim wilt houden, is het [draaiboek voor een soevereine competitie](/docs/network/sovereignty/run-a-sovereign-contest) de aangewezen route
5. **Breng ons in contact met het bestuur** — Wie binnen uw gemeenschap heeft zeggenschap over taalgegevens en technologie? Het soevereiniteitsmodel van het Network vereist een bestuurlijke partner

---

## Zie ook

- [Een soevereine competitie organiseren](/docs/network/sovereignty/run-a-sovereign-contest) — het draaiboek voor een evaluatie onder beheer van de gemeenschap
- [Sjablonen voor voorwaarden](/docs/network/sovereignty/terms-templates) — juridisch eenvoudige, 'trustless'-georiënteerde voorwaarden die uw gemeenschap kan aanpassen, met duidelijke toelichting op de risico's van een paard van Troje
- [Datastewardship](/docs/network/sovereignty/data-sovereignty) — het standpunt en de kaders (CARE, Te Mana Raraunga en andere instrumenten voor inheemse datasoevereiniteit) die hieraan ten grondslag liggen
- [Eigenaarschap en voorwaarden](/docs/network/sovereignty/ownership-transfer) — voorwaarden per taal en wat er gebeurt wanneer een methode wint
- [Hoe het werk wordt gefinancierd](/docs/network/sovereignty/economic-model) — hoe geldstromen lopen binnen een niet-commercieel project
- [Ondersteun een taal met weinig bronnen](/docs/network/community/low-resource-languages) — technische context voor onderzoekers die samenwerken met gemeenschappen
