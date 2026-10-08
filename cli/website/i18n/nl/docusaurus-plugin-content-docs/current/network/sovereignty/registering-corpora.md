---
sidebar_position: 8
title: "Corpora en blootstellingskanalen registreren"
slug: /network/sovereignty/registering-corpora
description: "Registreer een evaluatiecorpus zonder het af te staan. De vier blootstellingsniveaus — local-only, private, public en sealed — de licentietrajecten die hieraan parallel lopen, en hoe fetch-from-source corpusinhoud uit onze handen houdt."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Corpora & Blootstellingsrijstroken Registreren

> **Managementsamenvatting.** U kunt een evaluatiecorpus registreren bij het netwerk zodat
> methoden eraan getoetst kunnen worden **zonder de gegevens aan ons te overhandigen**. Elk
> corpus wordt geregistreerd als een met sha vastgelegde *metadatakaart*, niet als inhoud — de daadwerkelijke
> zinnen worden tijdens de evaluatie opgehaald van hun bron. Wanneer u registreert,
> maakt u twee onafhankelijke keuzes: een **blootstellingsniveau** — hoeveel er van uw
> machine afkomt (`local-only`, `private`, `public` of `sealed`, waarbij het corpus
> op uw apparaat wordt versleuteld onder een M-van-N-beheerderssleutel) — en een **licentiebaan**,
> die bepaalt waarvoor het corpus mag worden gebruikt (openbaar, uitsluitend niet-commercieel
> onderzoek, of privé). Dit is het mechanisme waarmee een gemeenschap haar taal *meetbaar* kan maken
> zonder deze *extraheerbaar* te maken.

Evaluatie van machinevertaling vereist doorgaans het tegenovergestelde van gegevenssouvereiniteit:
"upload uw testset zodat wij deze kunnen scoren." Dat is voor inheemstalige en andere
gemeenschapsgebonden corpora, waarbij de gegevens eigendom zijn van de mensen waarvan ze afkomstig zijn, geen optie.
Het Netwerk is zo gebouwd dat u die afweging nooit hoeft te maken.

---

## 1. Registratie is metadata, geen inhoud {#1-registration-is-metadata-not-content}

Een geregistreerd corpus is een **kaart**: een kleine JSON-record die beschrijft *waar* het
corpus zich bevindt en *wat het is*, met een inhoudshasj zodat de exacte bytes kunnen worden
geverifieerd — maar **geen zinnen**. Een kaart bevat:

| Veld | Wat het is |
|-------|-----------|
| `url` | Waar het corpus wordt opgehaald (het upstream-archief dat u beheert) |
| `sha256` | Inhoudshasj van het vastgezette archief — bewijst dat niemand de gegevens heeft verwisseld |
| `license` | SPDX-identificator (of `LicenseRef-…` voor een op maat gemaakte licentie) |
| `language_pair` | Bron → doel, bijv. `eng-crk` |
| `do_not_train` | Altijd ingesteld — evaluatiegegevens mogen nooit worden gebruikt voor training |
| `attribution` | De vermelding van de maker/taalkundige die overal verschijnt waar het corpus wordt getoond |

Op het moment van evaluatie **haalt de harness op uit de bron**, verifieert de `sha256`,
en scoort tegen de vers opgehaalde referenties. Het Netwerk slaat de corpusinhoud nooit op, host
of herverdeelt deze. Als u het upstream-archief offline haalt,
kan het corpus eenvoudigweg niet meer worden uitgevoerd — de controle blijft bij u. Dit is
dezelfde ophalen-uit-bron-discipline die op de gehele catalogus wordt toegepast (zie
[Evaluatiedatasets](/docs/network/leaderboard/datasets)).

:::info[Waarom een hash in plaats van een kopie]
Een content-hash maakt het mogelijk een zelfgerapporteerde score te **hercontroleren** aan de hand van het echte,
ongewijzigde corpus, zonder dat wij dat corpus ooit in ons bezit hebben. Een run waarvan de cijfers niet
reproduceerbaar zijn ten opzichte van de hash-vastgelegde bron, wordt afgewezen. Verifieerbaarheid en
niet-bezit staan hier niet op gespannen voet — de hash is juist wat beide mogelijk maakt.
:::

---

## 2. Twee afzonderlijke keuzes

Bij registratie worden u twee onafhankelijke vragen gesteld, en het is de moeite waard om deze
gescheiden te houden omdat ze verschillende zaken beschermen:

1. **Wat uw machine verlaat** — het *blootstellingsniveau*.
2. **Waarvoor uw corpus mag worden gebruikt** — de *licentiebaan*.

Een corpus kan verzegeld en niet-commercieel zijn, of openbaar en commercieel vrijgegeven, of
elke andere combinatie. Het een impliceert het ander niet.

### 2a. Blootstellingsniveaus — wat uw machine verlaat

Vier niveaus, gedefinieerd in `cli/lib/corpus-registration.mjs`. **Corpusinhoud in platte tekst
wordt in geen van deze niveaus ooit geüpload** — dat is geen beleidsinstelling, het geldt
voor elk niveau. Registratie valt standaard altijd terug op het meest besloten niveau.

| Niveau | Geregistreerd? | Wat we ontvangen | Kaart bijgehouden |
|---|:---:|---|:---:|
| **Privé / alleen lokaal** | ❌ | Niets. Kaart en tekst blijven op uw machine. **De standaard.** | ❌ |
| **Privé registreren** | ✅ | Alleen metadata — een geheime held-out-set in WMT-stijl. U behoudt het beheer; resultaten kunnen worden gepubliceerd zonder de gegevens bloot te stellen. | ✅ |
| **Openbaar registreren** | ✅ | Metadata + een pointer om vanaf de bron op te halen. Uw tekst wordt op aanvraag upstream opgehaald en hier nooit gehost. Vereist een licentie die herdistributie toestaat. | ✅ |
| **Verzegeld** | ✅ | Een kaart zonder inhoud. De cijfertekst blijft bij u. | ✅ |

#### Een testset weghouden van elke externe AI-dienst

Uw tekst niet uploaden is één garantie. Deze niet *verzenden* naar een model-API
terwijl u evalueert is een andere, en dat is vooral van belang voor een testset die
gevoelige bewoordingen bevat. Markeer het bestand als alleen-lokaal door er een klein bestand
naast te plaatsen, genoemd naar het bestand met toevoeging van `.champollion.json`:

```bash
# data/nurse_checked_test.tsv  →  data/nurse_checked_test.tsv.champollion.json
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Dit werkt voor elk corpusformaat (TSV, JSONL, platte-tekstparen, JSON). Vanaf
dat moment behandelt `mt-eval run` het corpus als verzegeld:
- bij een externe provider (OpenRouter, OpenAI, Anthropic, Gemini) wordt de run
  **geweigerd voordat er tekst wordt verzonden**, en voordat er om een API-sleutel wordt gevraagd;
- met `--provider local` gericht op een model op deze machine (een loopback-adres
  zoals `http://localhost:11434/v1`) gaat de run door;
- met `--method local-model -m <model>` (een NLLB-, OPUS-MT- of MADLAD-model
  dat de harness in zijn eigen proces laadt; `-m` is vereist), gaat de run door:
  geen enkele zin verlaat de
  machine, en het downloaden van de gewichten verplaatst modelbestanden, nooit uw tekst;
- bij een MT-engine of een method-plugin (`--method <plugin dir>`) wordt de run
  geweigerd tenzij u verklaart dat het transport ervan volledig lokaal is
  (`--attest-local-transport`, vastgelegd in het run-logboek): de harness kan
  niet zien waar een plugin of een dienst tekst naartoe stuurt;
- de eigen evaluatiemetrieken van de taal uit diens taalkaart worden **niet
  geladen**. Ze zijn afkomstig uit afzonderlijke pakketten die woorden kunnen opzoeken bij een
  externe dienst, zoals een online woordenboek. De run wordt zonder deze gescoord,
  en de run-kaart vermeldt dat ze zijn achtergehouden en waarom;
- `mt-eval publish` houdt de zinnen achter en vervangt standaard een
  coaching- of aangepaste prompt door de bijbehorende sha256, zodat prompt-voorbeelden ontleend aan
  uw eigen zinnen ook op deze machine blijven. Sommige metadata over het corpus
  wordt wel openbaar gemaakt met de score: de id, versie, het taalpaar, de omvang, de
  sha256 van het bestand, de licentie en naamsvermelding, de contaminatiegraad, dat
  het is gemarkeerd als alleen-lokaal, en de segmentnamen. Voor een id die geen
  geregistreerde dataset is, maakt publicatie ook een openbare `datasets`-rij aan met
  dezelfde id, hetzelfde paar, dezelfde omvang en sha256, plus het domein, de segmentnamen en
  het moeilijkheidsbereik. Het `--dry-run`-voorbeeld toont deze voor uw run, naast
  wat hier blijft: elke zin, het bestand en het pad ernaartoe. Anderen zien dan een
  score op een testset die ze niet kunnen openen. Deze is zelf-gebenchmarkt, niemand anders
  kan deze opnieuw uitvoeren, en de sha256 stelt alleen iemand die hetzelfde bestand bezit in staat
  om te bevestigen dat het om dat bestand gaat;
- wat de tools afdrukken laat de zinnen weg, omdat een AI-agent die
  de terminal leest wat hij leest doorgeeft aan zijn modelprovider. `mt-eval compare`
  toont invoer-id's en scores in plaats van de zinnen, en een foutmelding
  die er een citeert wordt afgedrukt met weglating daarvan. `--show-text` drukt ze af, voor
  een persoon achter de terminal. Bestanden die naar uw resultatenmap worden geschreven behouden de
  tekst, en elk bestand draagt de markering van het corpus: elk run-logboek, rapport,
  vergelijkingsbestand en dashboard dat de harness op basis van het corpus schrijft, krijgt een
  eigen `.champollion.json` met dezelfde voorwaarden plus `derived_from`. De volgende
  tool, of een latere run op dat bestand, behandelt het vervolgens ook als beschermd. De
  terminal vermeldt elk bestand dat de tekst bevat;
- de vertaalcache houdt de items van dit corpus gescheiden: onder
  `<cache-dir>/protected/<namespace>/` (standaard
  `eval/cache/harness/protected/…`), in een naamruimte met als sleutel de instellingen
  van de run, de sha256 van het corpus en de voorwaarden ervan, zodat een item alleen ooit
  wordt teruggegeven aan een run op ditzelfde corpus — nooit aan een run op een ander of een
  ongemarkeerd corpus. Elk cachebestand daar draagt dezelfde `.champollion.json`-markering.
  (Items die zijn gecachet voordat deze bescherming bestond, staan ongemarkeerd in de gewone
  cache; verwijder `eval/cache/harness/` eenmalig om ze te wissen.)

De markering kan een corpus alleen strenger maken. Geen enkele licentie en geen enkele
`--allow-data-collection`-vlag kan deze versoepelen. Als het markeringsbestand
onleesbaar is, stopt de run in plaats van dit te negeren.

**Verzegeld is de sterkste garantie die het systeem biedt.** Uw corpus wordt
**op uw apparaat** versleuteld met de sleutel van de beheerdersgroep, en de cijfertekst
blijft op uw machine of uw evaluatieknooppunt. Champollion ontvangt alleen de
kaart zonder inhoud. Op het offline knooppunt is de sleutel opgesplitst, zodat er
**M van N** beheerders gezamenlijk nodig zijn om een run te autoriseren; die ceremonie is gebouwd, maar
is nog niet gebruikt met echte beheerders. Verzegelde sets worden gecatalogiseerd maar in quarantaine geplaatst, en worden gekoppeld aan
een openbaar *kwalificatiecorpus* waaraan een methode moet voldoen voordat een verzegelde run
überhaupt kan worden voorgesteld. Zie [Een soevereine wedstrijd uitvoeren](/docs/network/sovereignty/run-a-sovereign-contest) en het [Sovereign-evaluatieknooppunt](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Licentiebanen — waar het corpus voor gebruikt mag worden

Afzonderlijk hiervan bepaalt de licentie waar resultaten mogen verschijnen.

#### Openbaar

Een openlijk gelicentieerd corpus (bijv. CC0, CC-BY) waarvan de referenties op publieke
oppervlakken kunnen verschijnen en waarvan de runs kunnen worden gerangschikt op het publieke leaderboard. De inhoud wordt nog steeds
opgehaald uit de bron — "publiek" regelt de *blootstelling van referenties en rangschikkingen*, niet
de hosting. Het grootste deel van de catalogus (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) bevindt zich in deze rijstrook.

#### Uitsluitend niet-commercieel onderzoek

Een corpus onder een niet-commerciële licentie (bijv. CC BY-NC-SA, of een op maat gemaakte
gemeenschaps-/NGO-licentie zoals de `LicenseRef-TWB-Gamayun` van de Gamayun-kits). Het kan
**worden gebenchmarkt voor onderzoek** — methoden worden erop uitgevoerd, scores worden berekend —
maar het is **uitgesloten van elk commercieel, prijs- en API-pad.** Geschiktheid is
**gebruiksgebaseerd**, niet corpusgebaseerd:

- de **commerciële rijstrook is strikt** — alles wat niet duidelijk commercieel gelicentieerd is, wordt
  uitgesloten;
- de **onderzoeksrijstrook is soepel** — niet-commerciële corpora zijn welkom;
- **quarantaine wint altijd** — een corpus dat is gemarkeerd als een ongeoorloofde deelverzameling (of
  anderszins verboden) kan nooit in *enige* rijstrook worden gerangschikt, ongeacht de licentie.

Zo kan een gemeenschap haar corpus onderzoeksvoortgang laten stimuleren terwijl het
buiten ieders product blijft.

#### Privé

Een corpus geregistreerd voor **uw eigen gescoorde runs**, waarbij de referenties nooit
worden gepubliceerd. U beheert de bron; u voert de evaluatie uit; u beslist wat, indien
überhaupt iets, ooit wordt getoond. Een privécorpus kan later publiek of niet-commercieel
worden gemaakt — blootstelling wordt uitsluitend *verruimd* door een expliciete, door de eigenaar gestuurde beslissing, nooit
stilzwijgend.

| Licentiebaan | Benchmarkbaar | Referenties openbaar getoond | Mag op openbare ranglijst | In commercieel / prijs- / API-pad |
|------|:---:|:---:|:---:|:---:|
| **Openbaar** | ✅ | ✅ | ✅ | ✅ (indien licentie dit toestaat) |
| **Uitsluitend niet-commercieel onderzoek** | ✅ | afhankelijk van licentie | alleen onderzoeksbaan | ❌ |
| **Privé** | ✅ (uw runs) | ❌ | ❌ | ❌ |

:::note[De commerciële lane is een vangrail, geen bedrijfsmodel]
Champollion zelf is niet-commercieel — er is geen betaalde API of product achter
dit alles. De commerciële/prijzen-lane bestaat als een *vooruitkijkende* vangrail: zij legt,
op mechanische wijze, vast welke corpora ooit rechtmatig in een prijs- of
commerciële context zouden kunnen verschijnen, zodat geen enkel toekomstig gebruik — door wie dan ook — buiten een
licentie of de voorwaarden van een beheerder kan treden.
:::

---

## 3. Souvereiniteitsgaranties

Registratie is ontworpen rond het [gegevensbeheerstandpunt](/docs/network/sovereignty/data-sovereignty).
Concreet:

- **Bezit blijft bij de bron.** Wij bewaren een hasj en een URL, niet de gegevens.
- **Controle is van de eigenaar.** De rijstrook is de keuze van de eigenaar, en blootstelling wordt
  uitsluitend verruimd door een expliciete beslissing. Het offline halen van het upstream-archief trekt de uitvoerbaarheid in.
- **Niet-commercieel betekent niet-commercieel.** NC-corpora worden mechanisch uitgesloten
  van commerciële, prijs- en API-rijstroken — niet bij belofte, maar door een poort.
- **Ongeoorloofde deelverzamelingen kunnen nooit worden gerangschikt.** Quarantaine overschrijft de licentie, zodat een corpus
  dat van rangschikking is uitgesloten, overal uitgesloten blijft.
- **Naamsvermelding is verplicht.** De vermelding van de maker/taalkundige reist met de kaart mee
  naar elk oppervlak waarop het corpus verschijnt.

Voor de manier waarop per-taalvoorwaarden worden vastgesteld — inclusief overdracht van methode-eigendom voor
gesponsorde prijzen — zie [Eigendom & Voorwaarden](/docs/network/sovereignty/ownership-transfer).

---

## 4. Hoe te registreren

Het corpuskaartschema en de bouw-/verificatietooling zijn gedocumenteerd in het
[Corpus Design Framework](/docs/network/specifications/corpus-design) en het
[Corpus Creation-kookboek](/docs/network/tutorials/corpus-creation). Kort samengevat:

1. Host het corpusarchief ergens dat u beheert (het blijft daar — het wordt nooit
   gekopieerd naar het Netwerk).
2. Schrijf een kaart: `url`, `sha256`, `license`, `language_pair`, `attribution`,
   `do_not_train`.
3. Kies de blootstellingsrijstrook (publiek / niet-commercieel / privé).
4. Registreer de kaart. Methoden kunnen nu worden gebenchmarkt tegen het corpus
   ophalen-uit-bron, onder de regels van de rijstrook.

U uploadt nooit de zinnen. U kunt op elk moment stoppen.

### De kaart-id

`champollion register-corpus` schrijft de kaart voor u en geeft deze een id in
de vorm `eval-<source>-<target>-<name>[-<role>]-v1`:

- **name** is afkomstig van `--name`: "Ward phrases" wordt `ward-phrases`. De
  uitgever wordt alleen gebruikt wanneer de naam geen tekens a–z of 0–9 bevat,
  bijvoorbeeld een naam die uitsluitend in syllabics is geschreven.
- **role** geeft aan waar de set voor bedoeld is: `--role test`, `--role dev` of
  `--role train`. Het verschijnt alleen in de id wanneer u dit meegeeft. De tool raadt
  nooit een rol, dus een held-out-testset wordt alleen een testset genoemd als u
  dat aangeeft.

```bash
champollion register-corpus --yes --name "Ward phrases" --pair "eng>xyz" \
  --license proprietary --tier private --role test --size 120 --domain medical
```

Dit registreert `eval-eng-xyz-ward-phrases-test-v1`. Om de id zelf
te kiezen, geeft u `--id eval-…` mee; deze wordt exact zoals opgegeven gebruikt.

### Welke licentie-id voor een privétestset

`--license` legt de voorwaarden vast die de eigenaren van de gegevens daadwerkelijk verlenen. Het
is geen tijdelijke aanduiding en de tool kiest er geen voor u. Vraag het hun
eerst (de families, de clinici, de data steward van de gemeenschap) en kies
vervolgens de id die weergeeft wat zij hebben aangegeven:

| Wat de eigenaren verlenen | `--license` |
|---|---|
| Ze publiceren de tekst al onder een standaardlicentie | de bijbehorende SPDX-id, bijvoorbeeld `CC-BY-NC-4.0` |
| Alleen gebruiken om systemen te scoren: nooit op trainen, nooit herdistribueren, geen betaalde scoring | `community-eval-grant-nc` (`LicenseRef-Champollion-Eval-Grant-NC`) |
| Hetzelfde, maar scoring voor betalende gebruikers is toegestaan | `community-eval-grant` (`LicenseRef-Champollion-Eval-Grant`) |
| Geen verlening buiten hun eigen gebruik: alle rechten voorbehouden | `proprietary` (`LicenseRef-Proprietary`) |
| Eigen voorwaarden die door geen van deze worden gedekt | `LicenseRef-<a name for their terms>`, letterlijk ingevoerd, waarbij de voorwaarden zijn vastgelegd op de plek waar de steward ze bewaart |

Elke `LicenseRef-…`-id in de tabel (inclusief de twee evaluatieverleningen en
`proprietary`) is een maatwerkverlening: Champollion leest deze nooit namens
de eigenaren. Externe evaluatie hiertegen wordt geweigerd totdat de steward
hun toestemming registreert, zodat alleen modellen op uw eigen machine hiertegen
worden getest. Als u twijfelt, is de meest conservatieve keuze waarmee u nog steeds
kunt meten `community-eval-grant-nc`; leg deze voorlopig vast en
laat de steward deze bevestigen of de juiste aanwijzen.

De licentie verandert niets aan waar de zinnen naartoe gaan. Een set die alleen lokaal is (de
`.champollion.json`-markering, of `--tier local-only`) blijft op uw machine,
wat de licentie ook zegt: de markering weigert elk extern model, en een
licentie kan dit nooit versoepelen. De licentie bepaalt wat anderen met
de set mogen doen als deze ooit wordt gedeeld, en tot welke evaluatiebanen deze toegang heeft. Zodra een bestand
is geregistreerd met `--data`, wordt de id ervan vastgelegd in het
`.champollion.json`-bestand ernaast en verandert deze nooit meer. Als u dat bestand
opnieuw probeert te registreren, stopt het proces en wordt u gevraagd om de id mee te geven met `--id`.

Voor een testset waarop een model mogelijk getraind wordt (`--role test`, of een
alleen-lokale of privéset zonder rol) print de opdracht vervolgens de
nmt-forge-stappen die moeten plaatsvinden vóór de eerste score van de set: registreer deze,
controleer uw trainingscorpus hierop en leg uw voorspellingen vast.
De baseline-`mt-eval run` komt daarna. Een benchmark is een scorende uitlezing,
en nmt-forge weigert voorspellingen die daarna zijn vastgelegd.

`mt-eval run --corpus <that file>` vindt de kaart via hetzelfde
`.champollion.json`-bestand. De dataset-id van de run is de id van de kaart, dus elke run
op de set draagt dezelfde naam, en de bestandsnaam blijft aan de run gekoppeld als het
corpuspad. De contaminatiegraad van de kaart wordt gerapporteerd zoals de kaart deze
vermeldt. Beide zijn alleen van toepassing zolang het bestand het bestand is dat u hebt geregistreerd: als het
sindsdien is gewijzigd, geeft de run dit aan en gebruikt het geen van beide.

Een `local-only`-, `private`- of `sealed`-kaart geeft aan dat de bijbehorende tekst niet gepubliceerd is
(`Contamination: NONE`), dus bij registratie wordt het bestand dat u meegeeft
met `--data` (of `--seal-input`) eerst vergeleken met de openbare corpora. Een checkout
van de repository vergelijkt het met de corporakaarten die het bevat. Een npm-installatie,
die geen corporakaarten meelevert, vergelijkt het met de openbare corpuscatalogus: de CLI
downloadt de id's en checksums van de openbare corpora en vergelijkt ze op uw
machine, zodat de checksum van uw bestand deze nooit verlaat. Wanneer het bestand byte voor
byte een openbaar corpus is (dezelfde sha256), stopt de registratie en noemt deze dat corpus.
Registreer het als openbaar, gebruik zinnen die daadwerkelijk privé zijn, of behoud het
niveau en geef de blootstelling aan met `--contamination` (de kaart registreert dan
dat de tekst openbaar is). Een verzegelde set met openbare tekst wordt geweigerd: deze zou
niets testen.

Wanneer er geen vergelijking kan worden gemaakt (u bent offline, of de catalogus kan niet worden
bereikt), krijgt de kaart de beoordeling `Contamination: UNCHECKED`, niet `NONE`, tenzij
u zelf een beoordeling opgeeft met `--contamination`. Registreer opnieuw online om
deze te vergelijken. `mt-eval` behandelt een `UNCHECKED`-corpus net zoals elk corpus dat
niet is beoordeeld als `LOW`: de scores ervan komen in de baan voor uitsluitend relatieve vergelijkingen. De
controle vergelijkt volledige bestanden, dus een openbare set die is bewerkt of opnieuw is geformatteerd, wordt
niet herkend; `mt-eval contest prepare` vergelijkt rijen.
