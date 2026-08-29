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

Een prijs vormt de stimulerende helft van de 'eval-first'-overeenkomst. Een gemeenschap of onderzoeksgroep stelt een kleine, afgesloten evaluatieset samen — enkele honderden paren, stuk voor stuk gecontroleerd ([Corpus Partnership](/docs/network/specifications/corpus-partnership) is die workflow). Een sponsor looft een prijs uit voor een doelscore op die set. Vanaf dat moment vormt de taal een permanente uitdaging: elke methodebouwer ter wereld kan zich erop richten, het leaderboard meet elke poging openbaar, en de lat wordt bepaald door de eigen antwoordsleutel van de gemeenschap in plaats van door degene die het hardst roept. Dit document specificeert hoe een dergelijke prijs werkt — drempelvoorwaarden, het claimproces, afhankelijkheidsklassen en regels — zodat de lat ondubbelzinnig en methode-agnostisch is wanneer er een wordt opengesteld.

Prijzen worden **gefinancierd en beheerd door de sponsor**: het geld bevindt zich bij de sponsorende organisatie, of bij een door de sponsor aangewezen gemeenschapsfonds — **Champollion beheert, routeert of fungeert nooit als escrow voor prijzengelden.** Elke gemeenschap of organisatie kan er een organiseren via het selfservice-traject in [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest), waarbij zij haar eigen corpus en haar eigen geld beheert.

> **Status: VOORGESTELD — er is geen prijs opengesteld en er kan hier nog niets worden geclaimd.**
> Wat als voorwaarde geldt voor de *openstelling* van een prijs, is de meetkant: een door de gemeenschap goedgekeurd 'gold-standard' corpus, de 'air-gapped' evaluatiesandbox (gespecificeerd, nog niet gebouwd) en de beoordelingsfase door sprekers. Geen enkele score op deze site heeft een prijsdrempel behaald. Zie [Honest Limitations](/docs/network/honest-limitations). Referentie voor metrieken: de [Scoring Spec](/docs/network/specifications/scoring); protocol: de [Benchmark Spec](/docs/network/specifications/benchmark).

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

> Om een prijs te sponsoren, een computerschenking te organiseren of een partnerschap te bespreken, kunt u het project bereiken via [GitHub](https://github.com/gamedaysuits). Gemeenschapssleutelbeheerders zijn in bevestiging; geen enkele natie of organisatie wordt als partner vermeld voordat zij daarmee heeft ingestemd.

---

## 1. Filosofie

> **De deal in één zin: kraak een taal, win, geef het terug.** Champollion is bewust een ML-benchmarkingoperatie — concurrentie is de manier waarop moeilijke taalparen worden opgelost. Wij nodigen ML-onderzoekers en elke bekwame bouwer uit om de beste methode te ontwikkelen voor een specifiek moeilijk taalpaar, de prijs te winnen, **en** de resulterende methode over te dragen aan de soevereiniteitsorganisatie die eigenaar is van die taal (§1.3). De competitieve energie is reëel en is gericht op de missie — elke taal vertaald krijgen, onder de voorwaarden die haar mensen stellen — niet op het beklimmen van een ranglijst omwille van de ranglijst zelf.

### 1.1 Prijzen Belonen Doorbraken, Geen Deelname

Prijsgeld wordt alleen vrijgegeven wanneer een methode aantoonbaar een gedefinieerde capaciteitsdrempel bereikt. Er zijn geen deelnameprijzen, runner-up-awards of troostuitkeringen. Als niemand de lat haalt, wordt niemand betaald. Dit is bewust zo — het betekent dat sponsors alleen betalen voor resultaten die daadwerkelijk werken.

### 1.2 Gemeenschapsvalidatie Is Niet-Onderhandelbaar

Geautomatiseerde meetwaarden zijn benaderingen (SCORING_SPEC §1.1). Een methode kan goed scoren op chrF++ en FST-acceptatie terwijl de uitvoer wordt geproduceerd die geen spreker zou accepteren. **Elke prijsclaim vereist gemeenschapsvalidatie** — tweetalige sprekers moeten bevestigen dat de uitvoer bruikbaar is. Dit is de menselijke validatiepoort (BENCHMARK_SPEC §7).

### 1.3 Eigendomsoverdracht Is Onderdeel van de Deal

Methoden die een prijs claimen, zijn onderworpen aan de eigendomsoverdrachtclausule (BENCHMARK_SPEC §8.3). De ontwikkelaar behoudt attributie- en publicatierechten. De bestuursorganisatie verkrijgt het recht om de methode te gebruiken, te wijzigen, te distribueren en te monetariseren voor hun taal. Dit is geen straf — dit is het punt. Prijsgeld financiert de creatie van technologie die toebehoort aan de taalgemeenschap.

### 1.4 Anti-Gaming

Prijsdrempels worden gedefinieerd aan de hand van **goudstandaard-evaluatie** (geheime testset, uitgevoerd door de bestuursorganisatie in een sandbox). Ontwikkelaars zien de testdata nooit. Dit is architecturaal afgedwongen — niet een beleid dat op eergevoel berust. Zie BENCHMARK_SPEC §8.2.

### 1.5 Corpuslicenties: Niet-Commerciële Corpora Blijven Buiten de Prijsbaan

Sommige corpora die tijdens de methodeontwikkeling worden gebruikt, hebben niet-commerciële licenties — het EdTeKLA Cree Language Textbook-corpus heeft bijvoorbeeld **EdTeKLA's aangepaste CC BY-NC-SA** (gericht op soevereiniteit, niet-commercieel; het basistekstboek is CC BY-NC-ND 4.0). Deze corpora zijn **uitsluitend bedoeld voor het onderzoeks-/ontwikkelingstraject**:

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
|------|--------|
| **Prijspool** | **$10.000 CAD** (voorgesteld) |
| **Taalpaar** | Engels → Plains Cree (EN→CRK) |
| **Beoogde sponsor** | Oprichter van het Champollion-project — een beoogde toezegging, **er worden nergens fondsen beheerd.** Wanneer toegezegd, zouden de fondsen bij de sponsor of een aangewezen gemeenschapsfonds berusten — nooit bij Champollion. |
| **Status** | **VOORGESTELD — niet opengesteld.** Accepteert geen inzendingen. |
| **Opent** | Alleen wanneer het goudstandaard-corpus, de evaluatiesandbox en de sprekerbeoordelingspoort allemaal bestaan (geen van alle bestaan ze nog), en de fondsen van de sponsor aantoonbaar worden beheerd conform §4.2. |
| **Vervalt** | Geen vervaldatum zodra opengesteld. |

#### Drempelvoorwaarden

Een methode claimt de Stichtersprijs door **ALLE** volgende voorwaarden gelijktijdig te vervullen:

| # | Voorwaarde | Meetwaarde | Drempel | Motivering |
|---|------------|------------|---------|------------|
| 1 | **Samengestelde score** | `composite` (SCORING_SPEC §4) | **≥ 0,80** | Tussen Inzetbaar (0,70) en Vloeiend (0,85). Vereist hoge kwaliteit over alle meetwaardedimensies — niet alleen morfologische geldigheid. |
| 2 | **FST-acceptatie** | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99%+)** | Vrijwel alle uitvoerwoorden moeten morfologisch geldige vormen zijn die door de GiellaLT FST worden herkend. De tolerantie van 1% is bedoeld voor randgevallen (eigennamen, neologismen, leenwoorden) die de FST mogelijk legitiem niet dekt. Dit is de bepalende kwaliteitspoort voor polysynthetische MT — als de FST meer dan 1% van de woorden afwijst, produceert de methode vormen die niet in de taal bestaan. Het hele punt van deze prijs is het kopen van een systeem dat de taal niet verminkt. |
| 3 | **chrF++** | `chrf_plus_plus` (SCORING_SPEC §2.1) | **≥ 55,0** | Overlapping van karakter-n-grammen moet 55 overschrijden op de schaal van 0–100. Zorgt voor gelijkenis op oppervlakteniveau met referentievertaling, niet alleen morfologische geldigheid. |
| 4 | **Gemeenschapsvalidatie** | Menselijke beoordeling (BENCHMARK_SPEC §7) | **≥ 70% "acceptabel" of "uitstekend"** | Een gestratificeerde steekproef van uitvoer (≥30 items over moeilijkheidslagen 2–5) wordt beoordeeld door ≥2 tweetalige CRK-sprekers. Ten minste 70% van de beoordeelde items moet een beoordeling "acceptabel" of "uitstekend" ontvangen. |
| 5 | **Goudstandaard-evaluatie** | Sandbox-uitvoering (BENCHMARK_SPEC §8.2) | **Vereist** | Alle geautomatiseerde meetwaarden moeten worden berekend aan de hand van het `gold_standard`-corpussegment, uitgevoerd door de bestuursorganisatie in een sandbox-omgeving. Scores op de ontwikkelingsset tellen niet mee. |
| 6 | **Reproduceerbaarheid** | Vingerafdrukovereenkomst (BENCHMARK_SPEC §3.8) | **±2%** | De bestuursorganisatie moet de methode opnieuw kunnen uitvoeren en scores bereiken binnen ±2% van de ingediende run card. |

> **Waarom 99%+ FST?** Het centrale probleem bij machinale vertaling voor polysynthetische talen is hallucinatie — LLM's produceren tekenreeksen die *eruitzien* als de doeltaal maar morfologisch ongeldig zijn. Een methode die 95% geldige uitvoer produceert, heeft nog steeds 5% gefabriceerde woorden — onaanvaardbare ruis voor elk productiegebruik. De drempel van 99%+ vereist vrijwel nul hallucinatie, terwijl ruimte wordt gelaten voor het zeldzame randgeval (een eigennaam die de FST niet kent, een legitiem neologisme). Als een methode geen 99%+ FST-acceptatie kan bereiken, heeft zij het probleem niet opgelost.
>
> **Waarom 0,80 samengesteld?** Dit ligt tussen Inzetbaar (0,70) en Vloeiend (0,85). Een methode met 0,80 en 99%+ FST-acceptatie produceert uitvoer waarbij vrijwel elk woord een echt Cree-woord is *en* de algehele vertaalkwaliteit hoog is over oppervlakte-, structurele en semantische dimensies. De gemeenschapsvalidatiepoort (voorwaarde #4) zorgt ervoor dat dit geen louter metrische optimalisatie is — sprekers moeten bevestigen dat de uitvoer daadwerkelijk bruikbaar is.

#### Wat Deze Drempel in de Praktijk Betekent

Bij samengesteld ≥ 0,80 met FST ≥ 0,99 en chrF++ ≥ 55 zou een tweetalige spreker doorgaans zien:

- **Vrijwel elk** uitvoerwoord is een echt Cree-woord (FST valideert 99%+ — vrijwel nul gehallucineerde vormen)
- Grote grammaticale categorieën (persoon, getal, tijd) zijn in de meeste items correct
- Woordvolgorde is over het algemeen natuurlijk
- Betekenis wordt betrouwbaar bewaard
- Resterende fouten zijn echte taalfouten (verkeerde vervoeging, onjuiste obviatie, animaciteitsfouten) — geen gefabriceerde woorden
- Een vloeiende spreker kan de uitvoer gebruiken als een hoogwaardig concept en het aanzienlijk sneller corrigeren dan vanaf nul vertalen

Dit is een systeem dat **de taal niet verminkt.** Het is misschien niet perfect, maar elk woord dat het produceert is een echt woord. Dat is de minimumdrempel voor respectvolle machinale vertaling van een polysynthetische taal.

---

## 3. Prijsclaimproces

### 3.1 Inzending

1. Ontwikkelaar dient zijn volledige, uitvoerbare methode in bij de bestuursorganisatie:
   - Alle broncode
   - Alle afhankelijkheden (coachingdata, woordenboeken, FST-configuraties, prompts)
   - Installatie- en uitvoeringsinstructies
   - Een README die de aanpak van de methode beschrijft
   - Een run card op de ontwikkelingsset met geschatte scores (voor voorafgaande screening)

2. Ontwikkelaar ondertekent de deelnemingsvoorwaarden, inclusief:
   - Eigendomsoverdrachtclausule (BENCHMARK_SPEC §8.3)
   - Verklaring van geen training op evaluatiedata
   - Reproduceerbaarheidstoezegging

### 3.2 Evaluatie

1. Bestuursorganisatie installeert en voert de methode uit in een sandbox-harnas tegen het `gold_standard`-corpus
2. Geautomatiseerde meetwaarden worden berekend (samengesteld, FST, chrF++, enz.)
3. Als aan de geautomatiseerde drempels wordt voldaan (voorwaarden 1–3), gaat de bestuursorganisatie over tot gemeenschapsbeoordeling
4. Als aan de geautomatiseerde drempels NIET wordt voldaan, ontvangt de ontwikkelaar scores en feedback. Er wordt geen gemeenschapsbeoordeling gestart.

### 3.3 Gemeenschapsbeoordeling

1. Een gestratificeerde steekproef van uitvoer (≥30 items, over moeilijkheidslagen 2–5) wordt aan tweetalige sprekers voorgelegd
2. Ten minste 2 onafhankelijke beoordelaars beoordelen elk item
3. Beoordelingsschaal: **afwijzen** / **kern** / **acceptabel** / **uitstekend**
4. Als ≥70% van de items "acceptabel" of "uitstekend" ontvangt van beide beoordelaars, slaagt de gemeenschapsvalidatie

### 3.4 Uitbetaling

1. Aan alle 6 voorwaarden is voldaan
2. Bestuursorganisatie bevestigt het resultaat
3. Prijs wordt uitbetaald binnen 30 dagen na bevestiging
4. Methode-eigendom wordt overgedragen conform BENCHMARK_SPEC §8.3
5. Resultaat wordt gepubliceerd op het leaderboard met verificatieniveau "Door gemeenschap gevalideerd"

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

| Niveau | Bedrag | Voorgestelde Drempel |
|--------|--------|----------------------|
| **Zaad** | $5.000–$15.000 | Inzetbaar (samengesteld ≥ 0,70) + gemeenschapsvalidatie |
| **Doorbraak** | $25.000–$50.000 | Vloeiend (samengesteld ≥ 0,85) + gemeenschapsvalidatie |
| **Grote Prijs** | $100.000+ | Vloeiend + dekking van meerdere registers + integratie van inzet |

Sponsors kunnen ook financieren:
- **Verbeteringsbounties** — vaste betaling voor elke verbetering van 5 punten in chrF++ ten opzichte van het huidige beste resultaat
- **Registerprijzen** — afzonderlijke awards voor specifieke registers (formeel, ceremonieel, educatief)
- **Snelheidsprijzen** — beste kostengewogen score (SCORING_SPEC §6.3)

### 4.2 Waar Prijsfondsen Worden Beheerd

Prijsfondsen zijn **door sponsors beheerd**: ze bevinden zich bij de sponsororganisatie, of bij een gemeenschapsfonds dat de sponsor aanwijst — **nooit bij Champollion**, dat de meting coördineert en geen geld aanraakt. Een geloofwaardige prijs publiceert, vóór opening: **wie de fondsen beheert**, onder welke regeling (organisatierekening, fonds of door de sponsor gekozen externe escrow), en de toekenningsdrempel — zodat het halen van de lat verifieerbaar is aan de hand van gepubliceerde scores plus het sprekervalidatieoordeel van de gemeenschap, en een betalingsverzuim publiekelijk zichtbaar zou zijn. Er worden vandaag nergens prijsfondsen beheerd. Als een prijs onopgeëist zou verlopen, blijven de fondsen waar ze altijd waren — bij de sponsor — om naar eigen inzicht te worden omgeleid of ingetrokken. De zelfbedieningsmechanismen, inclusief het risico op sponsorverzuim en de mitigaties daarvan, zijn gedocumenteerd in [Een soevereine wedstrijd uitvoeren](/docs/network/sovereignty/run-a-sovereign-contest) en de [Voorwaardensjablonen](/docs/network/sovereignty/terms-templates).

---

## 5. Diskwalificatie

Een inzending wordt gediskwalificeerd als:

1. **Training op evaluatiedata.** De methode is blootgesteld aan `gold_standard`- of `held_out`-corpusitems. (Architecturaal voorkomen door sandbox-uitvoering — maar als bewijs van contaminatie wordt gevonden, wordt het resultaat ongeldig verklaard.)
2. **Niet-reproduceerbaar.** De bestuursorganisatie kan scores niet reproduceren binnen ±2%.
3. **Niet-gedeclareerde of niet-geschikte afhankelijkheden.** De methode vereist runtime-toegang tot externe diensten buiten wat het afhankelijkheidsmanifest declareert, of de effectieve afhankelijkheidsklasse is A2 of X (§1.6). Gedeclareerde Klasse A1 LLM-inferentie via de evaluatiegateway is toegestaan; elke andere runtime-netwerkafhankelijkheid — en elke niet-gedeclareerde afhankelijkheid van welke klasse dan ook — is diskwalificerend.
4. **Deelnemingsvoorwaarden niet ondertekend.** Alle teamleden moeten instemmen met eigendomsoverdracht.
5. **Gaming gedetecteerd.** Uitvoer is geoptimaliseerd voor de meetwaarde in plaats van vertaalkwaliteit (gedetecteerd door gemeenschapsbeoordeling en/of anti-gamingcontroles conform BENCHMARK_SPEC §9.3).

---

## 6. Relatie tot Andere Specificaties

| Dit Document | Verwijst naar | Voor |
|--------------|--------------|------|
| §2 drempelvoorwaarden | SCORING_SPEC §4 (samengesteld), §2.1–2.2 (meetwaarden), §5 (niveaus) | Meetwaardedefinities en schaal |
| §2 gemeenschapsvalidatie | BENCHMARK_SPEC §7 | Protocol voor menselijke beoordeling |
| §3 sandbox-uitvoering | BENCHMARK_SPEC §8.2 | Soevereiniteitsme­chanisme |
| §3 eigendomsoverdracht | BENCHMARK_SPEC §8.3 | IP-overdrachtsvoorwaarden |
| §1.6 afhankelijkheidsklassen | Method Interface-specificatie; BENCHMARK_SPEC §8.6 | Klassedefinities, toelaatbaarheidsvoorwaarden, sandbox-netwerkbeleid |
| §4 kostengewogen prijzen | SCORING_SPEC §6.3 | Kostengewogen formule |

---

## 7. Code–Specificatiesynchronisatie

### 7.1 Canonieke Bron

Dit document (`cli/website/docs/network/specifications/prize-spec.md`) is de canonieke bron voor:
- Prijspooldefinities (§2)
- Drempelvoorwaarden (§2.x)
- Claimproces (§3)
- Diskwalificatieregels (§5)

### 7.2 Implementatievereisten

Wanneer een prijspool wordt geactiveerd:
1. De leaderboard-UI moet actieve prijzen en hun drempelvoorwaarden weergeven
2. Run cards die voldoen aan geautomatiseerde drempels (voorwaarden 1–3) moeten worden gemarkeerd voor gemeenschapsbeoordeling
3. Het `quality_tier`-veld in het run card-schema legt het niveau al vast ("deployable", "fluent")
4. Er zijn geen nieuwe codewijzigingen in het harnas nodig — de prijsspecificatie is een beleidslaag bovenop de bestaande scoring

---

*Prijsstructuren moeten compatibel zijn met eigendomsoverdrachtvoorwaarden. De winnaar kan de prijs claimen, maar de methode wordt eigendom van de bestuursorganisatie als deze het Inzetbaar-niveau bereikt. Dit is bewust zo — de prijs financiert de creatie van technologie die toebehoort aan de taalgemeenschap.*
