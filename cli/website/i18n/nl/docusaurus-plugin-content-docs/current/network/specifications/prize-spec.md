---
sidebar_position: 8
title: "Prijsspecificatie"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Prijsspecificatie

Een prijs vormt de stimulerende helft van de 'eval-first'-overeenkomst. Een gemeenschap of
onderzoeksgroep cureert een kleine, verzegelde evaluatieset — een paar honderd paren,
stuk voor stuk gecontroleerd ([Corpus Partnership](/docs/network/specifications/corpus-partnership)
is die workflow). Een sponsor looft een prijs uit voor een doelscore op die
set. Vanaf dat moment is de taal een permanente uitdaging: elke methodeontwikkelaar
ter wereld kan zich erop richten, het scorebord meet elke poging
in het openbaar en de lat wordt bepaald door het eigen antwoordmodel van de gemeenschap
in plaats van door wie het hardst roept. Dit document specificeert hoe een dergelijke prijs
werkt — drempelvoorwaarden, claimproces, afhankelijkheidsklassen en regels —
zodat de lat ondubbelzinnig en methode-agnostisch is wanneer er een wordt geopend.

Prijzen worden **gefinancierd en beheerd door sponsors**: het geld blijft bij de
sponsororganisatie of bij een door de sponsor aangewezen gemeenschapstrust —
**Champollion beheert, bewaart of routeert nooit prijzengeld.** Elke gemeenschap
of organisatie kan er zelfstandig een organiseren via het selfservicetraject in
[Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest),
met behoud van het eigen corpus en het eigen geld.

> **Status: VOORGESTELD — er is geen prijs geopend en er kan hier nog niets worden geclaimd.**
> Wat het *openen* van een prijs tegenhoudt, is de meetzijde: een
> door de gemeenschap goedgekeurd goudstandaardcorpus en de beoordelingsfase door moedertaalsprekers.
> Geen van beide bestaat nog. De fysiek gescheiden (air-gapped) evaluatiesandbox wordt wel
> meegeleverd — zie de
> [Benchmarkspecificatie §8.6](/docs/network/specifications/benchmark#86-dependency-classes-and-the-sandbox-network-policy).
> Geen enkele score op deze site heeft een prijsdrempel gehaald. Zie
> [Eerlijke beperkingen](/docs/network/honest-limitations). Referentie voor metrieken:
> de [Scoringspecificatie](/docs/network/specifications/scoring); protocol:
> de [Benchmarkspecificatie](/docs/network/specifications/benchmark).

> **De beloftelaag is live.** De bevriezing die een gedeclareerde prijsvoorwaarde
> onbewerkbaar maakt zodra er inzendingen zijn, en achtergehouden (`hidden_until_close`) resultaten,
> worden sinds 2026-09-07 afgedwongen in de database op het netwerk-gehoste eindpunt.
> Een gefedereerde host krijgt dezelfde regels door de migratie toe te passen die met
> de harness wordt meegeleverd; bij een ouder eindpunt valt de harness terug op de basisset
> en meldt dit in plaats van te doen alsof. De egressregel 'aggregates-only'
> in §3.2 is altijd overal gehandhaafd.

---

## Wilt u helpen een taal in het netwerk te brengen?

U hoeft niet te wachten op een prijs. De meest impactvolle dingen die u vandaag kunt doen:

- **Sponsor een MT-prestatieprijs.** Financier een gerichte lat — bijvoorbeeld een betrouwbare methode voor Engels → Plains Cree. Champollion coördineert de meting; de fondsen blijven bij **u** (uw organisatie, of een gemeenschapsfonds dat u aanwijst) en worden toegekend op de voorwaarden van de gemeenschap (zie
  [Gegevenssoevereiniteit](/docs/network/sovereignty/data-sovereignty)
  en het [Economisch model](/docs/network/sovereignty/economic-model)). Het volledige zelfbedieningspad is gedocumenteerd in
  [Een soevereine wedstrijd uitvoeren](/docs/network/sovereignty/run-a-sovereign-contest); het introduceren van een nieuw taalpaar begint met een
  [corpuspartnerschap](/docs/network/specifications/corpus-partnership).
- **Coördineer een computerschenking.** Bundel API-credits/tokens zodat de publieke wachtrij meer taalparen kan in kaart brengen en zichtbaar maakt waar vertaling wel — en nog niet — betrouwbaar is.
- **Ondersteun de open-source-initiatieven waarop wij voortbouwen — *rechtstreeks*.** Champollion is loodgieterswerk dat het open werk van anderen samenvoegt; *hen* ondersteunen is deze kaart ondersteunen (wij verwijzen u liever naar de bron dan hun werk op te eisen):
  - [Tatoeba](https://tatoeba.org) — door de gemeenschap bijgedragen parallelle zinnen
  - [Endangered Languages Catalog (ELCat)](https://www.endangeredlanguages.com) — gegevens over bedreigingsstatus
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — taalcatalogi en typologie
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — de morfologische transducers (FST's)
  - [Masakhane](https://www.masakhane.io) — MT-gemeenschap voor Afrikaanse talen
  - [OPUS](https://opus.nlpl.eu) — open parallelle corpora

> Neem contact op met het project via [GitHub](https://github.com/gamedaysuits) om
> een prijs te sponsoren, een donatie van rekenkracht te organiseren of een partnerschap
> te bespreken. Er zijn nog geen sleutelbeheerders vanuit gemeenschappen aangesteld en geen
> enkele natie of organisatie wordt als partner genoemd voordat deze heeft ingestemd.

---

## 1. Filosofie

> **De overeenkomst in één regel: ontcijfer een taal, win, onder de door de host gedeclareerde voorwaarden.**
> Champollion is met opzet een ML-benchmarkoperatie — concurrentie is hoe moeilijke
> taalparen worden opgelost. We nodigen ML-onderzoekers en elke bekwame ontwikkelaar uit om de
> beste methode te bouwen voor een specifiek moeilijk taalpaar en de prijs te winnen. Wat er
> daarna met de methode gebeurt, is de gepubliceerde keuze van de **host**, niet die van ons en geen
> standaard: een gemeenschap die wil dat een winnende methode wordt overgedragen, geeft dit aan in haar
> voorwaarden, en een gemeenschap die deze alleen wil meten en verwijderen, geeft dat aan (§1.3).
> De competitieve energie is reëel en is gericht op de missie — elke taal vertaald krijgen,
> onder voorwaarden die door de eigen gemeenschap zijn vastgesteld — niet op het beklimmen van een scorebord
> omwille van de ranglijst zelf.

### 1.1 Prijzen Belonen Doorbraken, Geen Deelname

Prijsgeld wordt alleen vrijgegeven wanneer een methode aantoonbaar een gedefinieerde capaciteitsdrempel bereikt. Er zijn geen deelnameprijzen, runner-up-awards of troostuitkeringen. Als niemand de lat haalt, wordt niemand betaald. Dit is bewust zo — het betekent dat sponsors alleen betalen voor resultaten die daadwerkelijk werken.

### 1.2 Gemeenschapsvalidatie Is Niet-Onderhandelbaar

Geautomatiseerde meetwaarden zijn benaderingen (SCORING_SPEC §1.1). Een methode kan goed scoren op chrF++ en FST-acceptatie terwijl de uitvoer wordt geproduceerd die geen spreker zou accepteren. **Elke prijsclaim vereist gemeenschapsvalidatie** — tweetalige sprekers moeten bevestigen dat de uitvoer bruikbaar is. Dit is de menselijke validatiepoort (BENCHMARK_SPEC §7).

### 1.3 Wat er met een winnende methode gebeurt wordt gedeclareerd, niet verondersteld {#1-3-declared-terms}

Eén ding staat vast, omdat dit is wat een soevereine wedstrijd *is*: de inzending wordt overgedragen aan het eigen air-gapped knooppunt van de host, dat deze uitvoert op een verzegelde set op de machine van de host. Wat er *daarna* mee gebeurt, is de door de host gedeclareerde keuze, gemaakt per wedstrijd en daarin gepubliceerd — en het is **één keuze uit drie**:

| De voorwaarde | Wat het voor u betekent |
|---|---|
| `pass_to_holders` — *overdragen aan beheerders* | De methode gaat over naar de soevereine benchmarkbeheerders. Zij scoren deze en behouden deze, ongeacht wie er wint. |
| `retain_ip` — *IE behouden* | U behoudt het eigendom van uw methode. De host scoort deze en bewaart hoogstens een verzegelde kopie voor auditdoeleinden. |
| `release_open` — *openbaar vrijgeven* | U behoudt het eigendom, maar moet de methode onder een open licentie publiceren. Die vrijgave is de voorwaarde voor de prijs. |

Al het overige dat voortvloeit uit een voorwaarde — of het artefact wordt bewaard, of er rechten overgaan, waarvoor de host het mag gebruiken, wanneer een vrijgave vereist is — wordt **afgeleid** van de optie die de host heeft gekozen (§2.1, voorwaarde 7), en is geen afzonderlijk selectievakje dat een host moet aanvinken. Een host kiest de voorwaarde; de details volgen daaruit.

Twee gevolgen die het waard zijn om expliciet te benoemen:

- **Een wedstrijd zonder gedeclareerde prijsvoorwaarden heeft geen prijs.** Dat is de standaard. Het is geen mindere wedstrijd, en er verandert niets aan de rechten op de inzending.
- **Niets is impliciet.** De gedeclareerde voorwaarde wordt gehasht, in duidelijke taal aan de deelnemer getoond en geaccepteerd via die hash; de acceptatie reist mee in de inzending en valt onder de bijbehorende content-hash, en het knooppunt van de host weigert een inzending die iets anders heeft geaccepteerd. De voorwaarde wordt vervolgens bevroren zodra de wedstrijd de eerste inzending ontvangt, zodat niemand wordt gehouden aan voorwaarden die men niet heeft kunnen lezen.

Wanneer een host kiest voor `pass_to_holders`, behoudt de ontwikkelaar nog steeds de rechten op naamsvermelding en publicatie, en het doel van de regeling is dat prijzengeld technologie financiert die de taalgemeenschap daadwerkelijk kan gebruiken. Dat is een goede reden voor een gemeenschapshost om die voorwaarde te kiezen. Het is een keuze, geen regel.

### 1.4 Anti-Gaming

Prijsdrempels worden gedefinieerd aan de hand van **goudstandaard-evaluatie** (geheime testset, uitgevoerd door de bestuursorganisatie in een sandbox). Ontwikkelaars zien de testdata nooit. Dit is architecturaal afgedwongen — niet een beleid dat op eergevoel berust. Zie BENCHMARK_SPEC §8.2.

### 1.5 Corpuslicenties: Niet-Commerciële Corpora Blijven Buiten de Prijsbaan

Sommige corpora die tijdens de methodeontwikkeling worden gebruikt, hebben niet-commerciële licenties — het EdTeKLA Cree Language Textbook-corpus heeft bijvoorbeeld **EdTeKLA's aangepaste CC BY-NC-SA** (soevereiniteitsgericht, niet-commercieel; het oorspronkelijke leerboek is CC BY-NC-ND 4.0). Deze corpora zijn **alleen bedoeld voor het onderzoeks-/ontwikkelingstraject**:

1. **Goudstandaard-prijscorpora mogen geen NC-gelicentieerde corpusinhoud bevatten.** Goudstandaard-testsegmenten zijn door de gemeenschap in opdracht gegeven originelen (zie Corpus Partnership Strategy) — door mensen geschreven voor de prijs, met rechten die vanaf het begin zijn vrijgemaakt voor evaluatie en commerciële inzet.
2. **Een methode die een prijs claimt, mag geen NC-gelicentieerde corpusinhoud bevatten** (bijv. als coachingdata, ingebedde voorbeelden of opzoektabellen). De overgedragen methode moet door de bestuursorganisatie op elke gewenste voorwaarde inzetbaar zijn — inclusief commercieel, als de gemeenschap dat besluit (BENCHMARK_SPEC §8.3); NC-gelicentieerde inhoud daarin zou die vrijheid ondermijnen.
3. **Ontwikkelaars mogen NC-gelicentieerde corpora vrijelijk gebruiken voor ontwikkeling en zelfevaluatie** — dat is waarvoor de ontwikkelingsbaan bedoeld is. De beperking geldt voor wat wordt ingediend en wat wordt ingezet, niet voor hoe een ontwikkelaar leert.

### 1.6 Afhankelijkheidsklassen Bepalen Prijsgeschiktheid

Alle prijsevaluatie vindt plaats in een sandbox (§1.4), en prijswinnende methoden worden overgedragen aan de bestuursorganisatie (§1.3). Beide feiten leggen dezelfde beperking op: **alles waarvan een methode afhankelijk is, moet iets zijn waarvoor de ontwikkelaar het recht heeft het in de sandbox te plaatsen en aan de gemeenschap over te dragen.** Elke inzending declareert een afhankelijkheidsklasse — gedefinieerd in de [Method Interface-specificatie](/docs/network/specifications/methods#method-validity-and-dependency-classes) — en de geschiktheid volgt de klasse:

| Afhankelijkheidsklasse | Prijsgeschikt? | Voorwaarden |
|------------------------|---------------|-------------|
| **S** — zelfstandig | ✅ Ja | Geen, buiten de drempelvoorwaarden in §2 |
| **O** — open extern (bijv. AGPL FST gespiegeld bij inzending) | ✅ Ja | Artefacten vastgezet en opgenomen in de inzending; licenties staan gemeenschapsoverdracht toe; copyleft-voorwaarden behouden (de gemeenschap ontvangt dezelfde rechten die de licentie aan iedereen verleent) |
| **A1** — vervangbare LLM-inferentie | ⚠️ Voorwaardelijk | Model gedeclareerd, vastgezet en vervangbaar (moet draaien op een door de gemeenschap gehost open-weight model); evaluatie via de sandbox LLM-gateway gerouteerd (🔲 gepland — A1-methoden kunnen geen goudstandaard-scores produceren totdat de gateway operationeel is); overdracht omvat het volledige recept (prompts, coaching, code), niet het model |
| **A2** — niet-vervangbare externe data-/service-API | ❌ Nog niet | Niet geschikt totdat de rechthebbende toestemming verleent voor sandbox-opname en overdracht. Toegestaan op het open leaderboard met een zichtbare vlag "externe afhankelijkheid" |
| **X** — gebundelde inhoud zonder rechten | ❌ Nooit | Ontoelaatbaar in elke baan |

De klasse van een methode is de meest beperkende klasse onder de gedeclareerde afhankelijkheden. Niet-gedeclareerde afhankelijkheden van welke klasse dan ook zijn diskwalificerend (§5).

---

## 2. Voorgestelde Prijspools (nog geen opengesteld)

### 2.1 De Stichtersprijs — EN→Plains Cree (nêhiyawêwin)

| Veld | Waarde |
|-------|-------|
| **Prijzenpot** | **$ 10.000 CAD** (voorgesteld) |
| **Taalpaar** | Engels → Plains Cree (EN→CRK) |
| **Beoogde sponsor** | Oprichter van het Champollion-project — een beoogde toezegging, **er worden nog nergens middelen aangehouden.** Eenmaal toegezegd, blijven de middelen bij de sponsor of een aangewezen gemeenschapstrust — nooit bij Champollion. |
| **Status** | **VOORGESTELD — niet geopend.** Inzendingen worden nog niet geaccepteerd. |
| **Opent** | Pas wanneer het goudstandaardcorpus en de beoordelingsfase door sprekers bestaan (geen van beide bestaat nog), de evaluatiesandbox is beproefd met echte modellen (tot nu toe is er alleen een speelgoedmethode op uitgevoerd) en de middelen van de sponsor aantoonbaar worden vastgehouden conform §4.2. |
| **Vervalt** | Geen vervaldatum eenmaal geopend. |

#### Drempelvoorwaarden

Een methode claimt de Stichtersprijs door **ALLE** volgende voorwaarden gelijktijdig te vervullen:

| # | Voorwaarde | Metriek | Drempelwaarde | Motivering |
|---|-----------|--------|-----------|-----------|
| 1 | ~~Samengestelde score~~ — **vervallen** | — | — | Deze voorwaarde (samengesteld ≥ 0,80) is samen met de samengestelde score vervallen op 2026-10-04 ([Scoringspecificatie §4](/docs/network/specifications/scoring#4-composite-score)). De scorevoorwaarde is uitsluitend chrF++ (voorwaarde 3); het nummer blijft behouden zodat de overige voorwaarden hun nummering behouden. |
| 2 | **FST-acceptatie** (een diagnostische controle, niet de score) | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99%+)** | Vrijwel alle uitvoerwoorden moeten morfologisch geldige vormen zijn die worden herkend door de GiellaLT FST. De tolerantie van 1% biedt ruimte voor randgevallen (eigennamen, neologismen, leenwoorden) die de FST mogelijk terecht niet dekt. Dit is de bepalende kwaliteitscontrole voor polysynthetische MT — als de FST meer dan 1% van de woorden afwijst, produceert de methode vormen die niet bestaan in de taal. Het hele doel van deze prijs is het aanschaffen van een systeem dat de taal niet verminkt. |
| 3 | **chrF++** (de score) | `chrf_plus_plus` (SCORING_SPEC §2.1), met sacreBLEU-handtekening en 95%-BI | **≥ 55,0** | Corpus-chrF++ op de verzegelde set moet 55 bereiken op de schaal van 0–100 — de standaard hoofdmetriek ([Scoringspecificatie](/docs/network/specifications/scoring#how-runs-are-scored)). Het vergelijkt elke uitvoer met de bijbehorende referentie, waardoor een systeem hieraan niet kan voldoen met geldige woorden die de invoer niet vertalen. |
| 4 | **Gemeenschapsvalidatie** | Menselijke beoordeling (BENCHMARK_SPEC §7) | **≥ 70% "acceptabel" of "uitstekend"** | Een gestratificeerde steekproef van uitvoeren (≥30 items verdeeld over moeilijkheidsniveaus 2–5) wordt beoordeeld door ≥2 tweetalige CRK-sprekers. Minstens 70% van de beoordeelde items moet de beoordeling "acceptabel" of "uitstekend" krijgen. |
| 5 | **Goudstandaardevaluatie** | Sandbox-uitvoering (BENCHMARK_SPEC §8.2) | **Vereist** | Alle geautomatiseerde metrieken moeten worden berekend op basis van het `gold_standard` corpussegment, uitgevoerd door de beheerorganisatie in een gesandboxte omgeving. Scores op de ontwikkelingsset tellen niet mee. |
| 6 | **Reproduceerbaarheid** | Overeenkomst in vingerafdruk (BENCHMARK_SPEC §3.8) | **±2%** | De beheerorganisatie moet de methode opnieuw kunnen uitvoeren en scores kunnen behalen binnen ±2% van de ingediende runkaart. |
| 7 | **Aan de gedeclareerde prijsvoorwaarden van de wedstrijd is voldaan** | De verificaties die die voorwaarde vereist (zie hieronder) | **Vereist** | Prijzen bestaan alleen bij soevereine wedstrijden, waarbij uw inzending wordt uitgevoerd door het air-gapped knooppunt van de host op een verzegelde set. Wat er *daarna* mee gebeurt, is een van de drie gedeclareerde opties, gepubliceerd bij de wedstrijd voordat de inzendingen openen — niet één universele voorwaarde die elke wedstrijd oplegt. |

#### Voorwaarde 7 in detail: de voorwaarde is één keuze uit drie

Elke soevereine wedstrijd werkt op het moment van uitvoering op dezelfde manier: u overhandigt uw
methode (gewichten of code) aan het air-gapped knooppunt van de host, en het knooppunt scoort deze
op de verzegelde set. Dat is precies wat "de host heeft het gemeten" inhoudt, en dat kan
niet worden aangepast.

Wat er *daarna* gebeurt, is de keuze van de host, gedeclareerd per wedstrijd, en het
is een van drie opties. De host publiceert deze voordat de inzendingen openen; deze wordt
**bevroren** op het moment dat de wedstrijd de eerste inzending ontvangt, zodat de voorwaarde die u leest ook
de voorwaarde is waaraan u wordt gehouden.

| De voorwaarde | Wat het voor u betekent |
|---|---|
| `pass_to_holders` — *overdragen aan beheerders* | De methode gaat over naar de soevereine benchmarkbeheerders. Zij scoren deze en behouden deze, ongeacht wie er wint. |
| `retain_ip` — *IE behouden* | U behoudt het eigendom van uw methode. De host scoort deze en bewaart hoogstens een verzegelde kopie voor auditdoeleinden. |
| `release_open` — *openbaar vrijgeven* | U behoudt het eigendom, maar moet de methode onder een open licentie publiceren. Die vrijgave is de voorwaarde voor de prijs. |

**Wat elke optie in detail betekent.** Deze vier dimensies — plus de licentie die
hoort bij een vereiste vrijgave — worden *afgeleid* van de optie: een host
schrijft nooit handmatig `rights` of `host_use`, en geen enkele wedstrijd kan deze
naar believen combineren:

| Veld | `pass_to_holders` | `retain_ip` | `release_open` |
|---|---|---|---|
| `retention` — blijft het artefact na het scoren bewaard? | `retain` | `retain_sealed_audit` | `retain` |
| `rights` — gaat het eigendom over? | `assignment_to_host` | `participant_retains_all` | `participant_retains_all` |
| `host_use` — waarvoor mag de host het gebruiken? | `any` | `evaluation_only` | `any` (onder de open licentie die u heeft gepubliceerd) |
| `release` — moet **u** het publiceren, en wanneer? | `not_required` | `not_required` | `required_before_prize` |
| `release_license` — onder welke licentie u publiceert | — | — | `any_osi`, of een benoemde SPDX-identificator |

Bij twee van de opties kan een host één veld inperken, en dat is alles:

- onder `retain_ip` kan de host `retention` instellen op `delete_after_scoring` — uw methode wordt vernietigd zodra deze is gescoord;
- onder `release_open` kan de host de vrijgave verplaatsen naar `required_before_scores` (u publiceert voordat uw eigen scores worden vrijgegeven) of `required_after_prize` (u publiceert na uitbetaling), en kan de host de licentie specificeren in plaats van elke door OSI goedgekeurde licentie te accepteren.

Een `community_terms_url` — een `https://`-link naar de eigen schriftelijke voorwaarden van de host —
kan bij elk van de drie worden toegevoegd. Bij de wedstrijd zelf wordt de gekozen optie
vastgelegd als de `disposition` ervan, en dat is de enige waarde waaruit al het bovenstaande
wordt afgeleid.

Al het overige wordt geweigerd bij het aanmaken van de wedstrijd: een optie biedt geen
veld dat er niet bij hoort, en een handmatig ingevuld veld dat afgeleid had moeten
worden, wordt expliciet op naam geweigerd in plaats van stilzwijgend geaccepteerd.

**Wat er wordt gecontroleerd voordat een prijs wordt uitbetaald.** De vereiste verificaties vloeien
voort uit de voorwaarde; geen enkele host configureert deze afzonderlijk:

- **Overdracht** — altijd. De host beschikt over exact hetzelfde artefact dat is gescoord (de
  door het knooppunt vastgelegde digest van de methode). Deze controle is gemeten.
- **Vrijgave** — onder `release_open`, wanneer de vrijgave vereist is vóór de scores
  of vóór de prijs. De host legt de vrijgave-URL en de SHA-256 van het gepubliceerde
  artefact vast; het record wordt gecontroleerd en de URL wordt nooit opgehaald, zodat een
  bevroren resultaat nooit afhankelijk is van de uptime van derden. Een vrijgave die
  *na* de prijs vereist is, is een verplichting die na uitbetaling vervalt, en maakt dus geen
  deel uit van de uitbetalingscontroles.
- **Overdracht van rechten** — onder `pass_to_holders`, waarbij eigendom overgaat. Een
  overdracht (assignment) is een akte die buiten dit platform wordt ondertekend; de host legt deze
  en de datum ervan vast, en het platform verifieert dat er een record bestaat.
  **Het toetst nooit het recht.**

**Een wedstrijd zonder gedeclareerde prijsvoorwaarden heeft geen prijs.** Er is geen standaardvoorwaarde
en er wordt namens niemand iets aangenomen. Deelname aan een wedstrijd die er
wel een declareert, betekent dat u deze op het moment van indiening expliciet accepteert, via de hash —
de acceptatie wordt ingepakt in uw bundel en maakt deel uit van wat het knooppunt van de host
controleert.

> **Waarom 99+% FST?** Het kernprobleem bij machinevertaling voor polysynthetische talen is hallucinatie — LLM's genereren reeksen die *lijken* op de doeltaal, maar morfologisch ongeldig zijn. Een methode die 95% geldige uitvoer genereert, bevat nog steeds 5% verzonnen woorden — onaanvaardbare ruis voor elk productiegebruik. De drempelwaarde van 99%+ vereist nagenoeg nul hallucinaties, terwijl er ruimte blijft voor het zeldzame randgeval (een eigennaam die de FST niet kent, een legitiem neologisme). Als een methode geen 99%+ FST-acceptatie kan behalen, heeft deze het probleem niet opgelost.
>
> **Waarom chrF++ en FST samen, en waarom geen van beide op zichzelf volstaat.** FST-acceptatie geeft alleen aan dat elk woord bestaat; een systeem dat voor elke invoer één geldige zin herhaalt, slaagt hier moeiteloos voor. chrF++ vergelijkt elke uitvoer met de bijbehorende referentie en ondervangt dit dus wel. Geen van beide geautomatiseerde cijfers garandeert kwaliteit: de gemeenschapsvalidatiefase (voorwaarde #4) bevestigt pas of sprekers de uitvoer bruikbaar vinden.

#### Wat Deze Drempel in de Praktijk Betekent

Wat de voorwaarden samen vaststellen:

- **Vrijwel elk** uitvoerwoord is een echt Cree-woord (FST valideert 99%+ — nagenoeg nul gefabriceerde vormen)
- De uitvoer ligt dicht bij de referenties op de verzegelde set (chrF++ ≥ 55)
- Tweetalige sprekers hebben, volgens het eigen protocol van de gemeenschap, minstens 70% van een gestratificeerde steekproef als acceptabel of beter beoordeeld — de enige voorwaarde die iets zegt over kwaliteit
- Resterende fouten zijn taalkundig reële fouten (verkeerde verbuiging, onjuiste obviatie, fouten in bezieldheid/animacy) — geen verzonnen woorden

Dit is een systeem dat **de taal niet verminkt.** Het is misschien niet perfect, maar elk woord dat het produceert is een echt woord. Dat is de minimumdrempel voor respectvolle machinale vertaling van een polysynthetische taal.

---

## 3. Prijsclaimproces

### 3.1 Toelating, vervolgens indiening

1. **Kwalificeer u in het openbaar.** De ontwikkelaar scoort de vrijgegeven dev-set van de wedstrijd met het eigen systeem en bewaart het ontvangstbewijs (`mt-eval contest qualify`). Het ontvangstbewijs is per definitie zelfgerapporteerd — het is een claim, en de host controleert deze in stap 4.

2. **Draag de inzending over.** Men neemt deel aan een wedstrijd door het knooppunt van de host iets te overhandigen dat het kan uitvoeren, via een van twee trajecten:
   - een **model** — safetensors-gewichten, een declaratieve tokenizer en een configuratie, geheel zonder code (`mt-eval contest submit-model`); of
   - een **methode** — een Dockerfile en een entrypoint, 'vendored' zodat het bouwt en draait zonder netwerktoegang (`mt-eval contest submit-method`).

   Het uploaden van vertalingen van een vrijgegeven testset en het linken naar een score die de ontwikkelaar zelf heeft gepubliceerd, zijn **op 2026-09-06 afgeschaft als deelnametrajecten voor wedstrijden** en de commando's zijn verwijderd. Zelfgerapporteerde scores horen nog steeds thuis op het openbare scorebord, wat een openbaar overzicht is geïndexeerd op corpus en taalpaarrichting — geen wedstrijd en geen prijzentraject.

3. **Declareer op de inzending zelf:** de track (`constrained` — uitsluitend getraind op de data die de host heeft toegestaan — of `unconstrained`), het aantal parameters, de licentie van de gewichten en of deze openbaar zijn, de trainingsdata waarop de 'constrained'-claim betrekking heeft, of dit de primaire inzending van het team is of een contrastieve, en — wanneer de wedstrijd dit vereist — een systeembeschrijving. De ontwikkelaar geeft tevens `--agree` door voor de voorwaarden voor het indienen van methoden, en, wanneer de wedstrijd prijsvoorwaarden declareert, `--accept-terms <hash>` daarvoor.

### 3.2 Evaluatie

1. Het knooppunt van de host voert de **statische controles** uit op de bundel, weigert alles wat het netwerk nodig zou hebben en weigert een inzending die andere prijsvoorwaarden heeft geaccepteerd dan die welke deze wedstrijd declareert.
2. Het knooppunt **voert de kwalificatie zelf opnieuw uit**, op de eigen kopie van de openbare dev-set, met behulp van dezelfde traject-executor en dezelfde scorer. Het ontvangstbewijs van de ontwikkelaar was een claim; dit is de feitelijke meting. Een tekortkoming wordt hier afgewezen — voordat een beheerder wordt gevraagd iets goed te keuren en voordat de verzegelde set wordt geopend — met vermelding van wat werd geclaimd, wat werd gemeten en wat de drempelwaarde was.
3. **Beheerders autoriseren** de verzegelde run (M-van-N, volgens het autorisatiemodel van de wedstrijd). De toewijzing is voor eenmalig gebruik, tijdgebonden en gekoppeld aan de exacte vingerafdruk van (bundle-hash, corpus, corpusversie, knooppunt).
4. De inzending wordt uitgevoerd op het verzegelde `gold_standard`-corpus binnen de netwerkgeïsoleerde sandbox op de eigen machine van de host, en geautomatiseerde metrieken worden berekend (chrF++ met betrouwbaarheidsinterval en handtekening, de overige standaardmetrieken en diagnostiek zoals FST-acceptatie). Een gedeclareerde verzegelde holdout en eventuele testsuites van derden worden binnen **dezelfde** geautoriseerde run uitgevoerd.
5. **Alleen geaggregeerde scores verlaten de omgeving** — afgedwongen op databaseniveau, niet per conventie. Als de wedstrijd `hidden_until_close` beloofde, wordt de kaart achtergehouden totdat de sluiting deze publiceert.
6. Als aan de geautomatiseerde drempelwaarden is voldaan (voorwaarden 2–3), gaat de host over tot de gemeenschapsbeoordeling. Als dat niet het geval is, ontvangt de ontwikkelaar diens scores en wordt er geen gemeenschapsbeoordeling gestart.

### 3.3 Gemeenschapsbeoordeling

1. Een gestratificeerde steekproef van uitvoer (≥30 items, over moeilijkheidslagen 2–5) wordt aan tweetalige sprekers voorgelegd
2. Ten minste 2 onafhankelijke beoordelaars beoordelen elk item
3. Beoordelingsschaal: **afwijzen** / **kern** / **acceptabel** / **uitstekend**
4. Als ≥70% van de items "acceptabel" of "uitstekend" ontvangt van beide beoordelaars, slaagt de gemeenschapsvalidatie

### 3.4 Uitbetaling

De volgorde staat vast: **gedeclareerde fasestappen geverifieerd → wedstrijd gesloten → prijs uitbetaald.** Welke stappen dat zijn, hangt af van de voorwaarden die *deze* wedstrijd heeft gedeclareerd (§2.1, voorwaarde 7) — maar welke het ook zijn, ze worden vóór de sluiting geverifieerd, en er wordt niets uitbetaald op basis van een ranglijst die nog aan verandering onderhevig is.

Een organisator kan een `close --force` uitvoeren voorbij een niet-voltooide fase. De sluiting wordt dan doorgevoerd en de bevroren ranglijst legt de prijsgeschiktheid van die inzending exact vast zoals berekend — niet in aanmerking komend, met vermelding van de mislukte stap. Een geforceerde sluiting is een gesloten wedstrijd, nooit een behaalde fase.

1. Aan alle 7 voorwaarden is voldaan
2. **Elke fasestap die de door de wedstrijd gedeclareerde prijsvoorwaarden vereisen, is geverifieerd** — altijd de overdracht van het gescoorde artefact, plus een geregistreerde vrijgave en/of een geregistreerde overdracht van rechten wanneer die voorwaarden daarom vragen
3. De wedstrijd wordt **gesloten** en de ranglijst wordt bevroren
4. De beheerorganisatie bevestigt het resultaat aan de hand van de bevroren ranglijst
5. De prijs wordt binnen 30 dagen na bevestiging uitbetaald
6. Alles wat de gedeclareerde voorwaarden bepalen over eigendom wordt van kracht zoals die voorwaarden specificeren — voor een wedstrijd waarvan `rights` `participant_retains_all` is, wordt er niets overgedragen
7. Het resultaat wordt op het scorebord gepubliceerd met het verificatieniveau "Community Validated"

### 3.5 Meerdere Inzendingen

- Dezelfde ontwikkelaar/hetzelfde team mag meerdere keren indienen
- Elke inzending wordt onafhankelijk geëvalueerd
- Als een methode wordt verbeterd en opnieuw ingediend, telt alleen de meest recente run card
- De prijs wordt toegekend aan de **eerste** methode die alle drempels haalt — hij wordt niet gesplitst

### 3.6 Teaminzendingen

- Teams en Oudste-jeugdparen zijn geschikt
- Prijsverdeling binnen een team is de verantwoordelijkheid van het team
- Alle teamleden moeten de deelnemingsvoorwaarden ondertekenen
- Attributie op het leaderboard vermeldt alle teamleden

---

## 4. Toekomstige Prijspools {#4-future-prize-pools}

De Stichtersprijs is het zaad. Aanvullende prijspools worden gefinancierd door sponsors. Elke nieuwe prijspool wordt gedocumenteerd als een nieuwe subsectie van §2 met zijn eigen:

- Prijsbedrag en valuta
- Taalpaar
- Sponsorattributie
- Drempelvoorwaarden (die kunnen afwijken van de Stichtersprijs)
- Vervaldatum (indien van toepassing)
- Eventuele bijzondere voorwaarden

### 4.1 Sponsor Prijssjabloon

Sponsors financieren prijspools in elk gewenst bedrag. Voorgestelde niveaus:

| Niveau | Bedrag | Voorgestelde drempelwaarde |
|------|--------|---------------------|
| **Seed** | $ 5.000–$ 15.000 | Een chrF++-drempel op de verzegelde set, gepubliceerd voordat de wedstrijd opent + gemeenschapsvalidatie |
| **Breakthrough** | $ 25.000–$ 50.000 | Een hogere chrF++-drempel + gemeenschapsvalidatie |
| **Grand Prize** | $ 100.000+ | De Breakthrough-voorwaarden + dekking van meerdere registers + implementatie-integratie |

De drempel is altijd chrF++ (met de bijbehorende handtekening, zodat deze reproduceerbaar is); diagnostische controles zoals FST-acceptatie kunnen als fasen worden toegevoegd. Een samengestelde score of een kwaliteitsniveau kan geen prijsdrempel zijn.

Sponsors kunnen ook het volgende financieren:
- **Verbeteringspremies** — een vaste vergoeding voor elke verbetering van 5 punten in chrF++ ten opzichte van het huidige beste resultaat
- **Registerprijzen** — afzonderlijke toekenningen voor specifieke registers (formeel, ceremonieel, educatief)
- **Kostenprijzen** — laagste kosten per item onder methoden die de chrF++-drempel halen (kosten worden naast de score gerapporteerd, nooit ermee gecombineerd)

### 4.2 Waar Prijsfondsen Worden Beheerd

Prijsfondsen zijn **door sponsors beheerd**: ze bevinden zich bij de sponsororganisatie, of bij een gemeenschapsfonds dat de sponsor aanwijst — **nooit bij Champollion**, dat de meting coördineert en geen geld aanraakt. Een geloofwaardige prijs publiceert, vóór opening: **wie de fondsen beheert**, onder welke regeling (organisatierekening, fonds of door de sponsor gekozen externe escrow), en de toekenningsdrempel — zodat het halen van de lat verifieerbaar is aan de hand van gepubliceerde scores plus het sprekervalidatieoordeel van de gemeenschap, en een betalingsverzuim publiekelijk zichtbaar zou zijn. Er worden vandaag nergens prijsfondsen beheerd. Als een prijs onopgeëist zou verlopen, blijven de fondsen waar ze altijd waren — bij de sponsor — om naar eigen inzicht te worden omgeleid of ingetrokken. De zelfbedieningsmechanismen, inclusief het risico op sponsorverzuim en de mitigaties daarvan, zijn gedocumenteerd in [Een soevereine wedstrijd uitvoeren](/docs/network/sovereignty/run-a-sovereign-contest) en de [Voorwaardensjablonen](/docs/network/sovereignty/terms-templates).

---

## 5. Diskwalificatie

Een inzending wordt gediskwalificeerd als:

1. **Trainen op evaluatiedata.** De methode is blootgesteld aan corpusitems uit `gold_standard` of `held_out`. (Architectonisch voorkomen door uitvoering in een sandbox — maar als er bewijs van contaminatie wordt gevonden, wordt het resultaat ongeldig verklaard.)
2. **Niet-reproduceerbaar.** De beheerorganisatie kan de scores niet binnen ±2% reproduceren.
3. **Niet-gedeclareerde of niet-toegestane afhankelijkheden.** De methode vereist tijdens runtime toegang tot externe diensten die verder gaat dan wat het afhankelijkheidsmanifest declareert, of de effectieve afhankelijkheidsklasse is A2 of X (§1.6). Gedeclareerde Klasse A1 LLM-inferentie gerouteerd via de evaluatiegateway is toegestaan; elke andere netwerkafhankelijkheid tijdens runtime — en elke niet-gedeclareerde afhankelijkheid van welke klasse dan ook — leidt tot diskwalificatie.
4. **Deelnamevoorwaarden niet ondertekend.** Alle teamleden moeten akkoord gaan met de voorwaarden voor het indienen van methoden en — wanneer de wedstrijd prijsvoorwaarden declareert (§1.3) — met die voorwaarden, via hash.
5. **Manipulatie gedetecteerd.** De uitvoer is geoptimaliseerd voor de metriek in plaats van voor vertaalkwaliteit (opgemerkt door gemeenschapsbeoordeling en/of anti-manipulatiecontroles volgens BENCHMARK_SPEC §9.3).

---

## 6. Relatie tot Andere Specificaties

| Dit document | Verwijst naar | Voor |
|--------------|-----------|-----|
| §2 drempelvoorwaarden | SCORING_SPEC "How runs are scored" en §2.1–2.2 (metrieken) | Metriekdefinities en schaal |
| §2 gemeenschapsvalidatie | BENCHMARK_SPEC §7 | Protocol voor menselijke beoordeling |
| §3 sandbox-uitvoering | BENCHMARK_SPEC §8.2 | Soevereiniteitsmechanisme |
| §1.3 gedeclareerde prijsvoorwaarden | BENCHMARK_SPEC §8.3 | Wat de host daarna met een inzending mag doen |
| §1.6 afhankelijkheidsklassen | Methode-interfacespecificatie; BENCHMARK_SPEC §8.6 | Klassedefinities, toelatingsvoorwaarden, netwerkbeleid van de sandbox |
| §4 kostenprijzen | SCORING_SPEC §6.2 | Formules voor kostenmetrieken |

---

## 7. Code–Specificatiesynchronisatie

### 7.1 Canonieke Bron

Dit document (`cli/website/docs/network/specifications/prize-spec.md`) is de canonieke bron voor:
- Prijspooldefinities (§2)
- Drempelvoorwaarden (§2.x)
- Claimproces (§3)
- Diskwalificatieregels (§5)

### 7.2 Implementatievereisten

Wanneer een prijzenpot wordt geactiveerd:
1. De gebruikersinterface van het scorebord moet actieve prijzen en hun drempelvoorwaarden weergeven
2. Runkaarten die voldoen aan de geautomatiseerde drempelwaarden (voorwaarden 2–3) moeten worden gemarkeerd voor gemeenschapsbeoordeling
3. Er wordt geen kwaliteitsniveau gebruikt: het veld `quality_tier` is null op elke nieuwe runkaart (scoringsstandaard/1)
4. De laag voor prijs**voorwaarden** wordt al meegeleverd (`contest_prize_terms` — declaratie, hash, acceptatie en de uitbetalingsfase), en de scoring zelf is ongewijzigd. Wat een nieuwe prijzenpot toevoegt, is het drempelbeleid in §2 en de weergave op het scorebord in de punten 1–2 hierboven

---

*Een prijsstructuur moet compatibel zijn met de prijsvoorwaarden die dezelfde wedstrijd declareert (§1.3). Die voorwaarden zijn de keuze van de host op elk vlak — van "scoren, verwijderen, alle rechten blijven bij de inzender" tot "u draagt het over, wij scoren het en behouden het ongeacht de uitslag" — en ze worden gepubliceerd, gehasht en geaccepteerd voordat iemand deelneemt. Een gemeenschapshost die wil dat een winnende methode eigendom van de gemeenschap wordt, kan exact dat declareren, en de prijs financiert dan de creatie van technologie die toebehoort aan de taalgemeenschap. Niets hier neemt dit namens welke host dan ook aan.*
