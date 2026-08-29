---
sidebar_position: 8
title: "Corpora en blootstellingskanalen registreren"
slug: /network/sovereignty/registering-corpora
description: "Registreer een evaluatiecorpus zonder het af te staan. De vier zichtbaarheidsniveaus — local-only, private, public en sealed —, de bijbehorende licentietrajecten, en hoe fetch-from-source de corpusinhoud uit onze handen houdt."
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

> **Samenvatting.** U kunt een evaluatiecorpus registreren bij het Network zodat methoden ertegen kunnen worden gebenchmarkt **zonder de gegevens aan ons te overhandigen**. Elk corpus wordt geregistreerd als een sha-gepinde *metadatakaart*, niet als inhoud — de daadwerkelijke zinnen worden op het moment van evaluatie uit hun bron opgehaald. Wanneer u registreert, maakt u twee onafhankelijke keuzes: een **blootstellingsniveau** — hoeveel uw machine verlaat (`local-only`, `private`, `public`, of `sealed`, waarbij het corpus op uw apparaat wordt versleuteld onder een M-van-N beheerderssleutel) — en een **licentiebaan**, die bepaalt waarvoor het corpus mag worden gebruikt (openbaar, uitsluitend niet-commercieel onderzoek, of privé). Dit is het mechanisme dat een gemeenschap in staat stelt haar taal *meetbaar* te maken zonder deze *extraheerbaar* te maken.

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

Bij de registratie worden u twee onafhankelijke vragen gesteld, en het is de moeite waard om deze gescheiden te houden omdat ze verschillende zaken beschermen:

1. **Wat uw machine verlaat** — het *blootstellingsniveau*.
2. **Waarvoor uw corpus mag worden gebruikt** — de *licentiebaan*.

Een corpus kan verzegeld en niet-commercieel zijn, of openbaar en commercieel vrijgegeven, of elke andere combinatie. Het een impliceert niet het ander.

### 2a. Blootstellingsniveaus — wat uw machine verlaat

Vier niveaus, gedefinieerd in `cli/lib/corpus-registration.mjs`. **Platte tekst van de corpusinhoud wordt in geen van deze niveaus ooit geüpload** — dat is geen beleidsinstelling, het geldt voor elk niveau. Registratie valt altijd standaard terug op het meest private niveau.

| Niveau | Geregistreerd? | Wat wij ontvangen | Kaart getraceerd |
|---|:---:|---|:---:|
| **Privé / alleen lokaal** | ❌ | Niets. Kaart en tekst blijven op uw machine. **De standaard.** | ❌ |
| **Privé registreren** | ✅ | Alleen metadata — een geheime achtergehouden set in WMT-stijl. U behoudt het beheer; resultaten kunnen worden gepubliceerd zonder de gegevens bloot te stellen. | ✅ |
| **Openbaar registreren** | ✅ | Metadata + een fetch-from-source pointer. Uw tekst wordt op verzoek stroomopwaarts opgehaald en hier nooit gehost. Vereist een licentie die herdistributie toestaat. | ✅ |
| **Verzegeld** | ✅ | Cijfertekst + een inhoudsvrije kaart. Verder niets. | ✅ |

**Verzegeld is de sterkste garantie die het systeem biedt.** Uw corpus wordt **op uw apparaat** versleuteld, onder de drempelsleutel van de beheerdersgroep, voordat er ook maar één byte vertrekt. Champollion ontvangt cijfertekst en kan deze niet ontsleutelen — en geen enkele individuele beheerder kan dat: er zijn er **M van N** samen nodig om een run te autoriseren. Verzegelde sets worden gecatalogiseerd maar in quarantaine geplaatst, en worden gekoppeld aan een openbaar *kwalificatiecorpus* waaraan een methode moet voldoen voordat een verzegelde run überhaupt kan worden voorgesteld. Zie [Een Sovereign Contest uitvoeren](/docs/network/sovereignty/run-a-sovereign-contest) en de [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Licentiebanen — waarvoor het corpus mag worden gebruikt

Afzonderlijk daarvan bepaalt de licentie waar resultaten mogen verschijnen.

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

| Licentiebaan | Benchmarkbaar | Referenties openbaar getoond | Mag op openbaar scorebord staan | In commercieel / prijs / API-traject |
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
