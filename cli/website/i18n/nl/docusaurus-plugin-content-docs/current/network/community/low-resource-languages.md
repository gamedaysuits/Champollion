---
sidebar_position: 5
title: "Een low-resource taal ondersteunen"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# Ondersteuning voor een bronschaarse taal

> **Managementsamenvatting.** Een uitgebreide gids voor het bouwen van automatische vertaling voor bronschaarse en polysynthetische talen. Behandelt waarom deze talen moeilijk zijn (morfologische complexiteit, schaarse gegevens, hallucinatie), bestaande computationele bronnen (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), meer dan 10 benaderingsstrategieën, het champollion-coachingsysteem en de evaluatielus. Begin hier als u een methode wilt bijdragen voor een onderbediende taal.

:::info[Status: In actieve ontwikkeling]
Ondersteuning voor Plains Cree (nêhiyawêwin) is momenteel in ontwikkeling. De tools, het evaluatieharnas en het scorebord die hier worden beschreven, zijn echt en vandaag al bruikbaar, maar de Cree-vertaalpijplijn is nog niet uitgebracht. Zodra dit het geval is, zal dit dienen als blauwdruk voor andere polysynthetische en bronschaarse talen met een FST-infrastructuur.
:::

## Het onopgeloste probleem

De Cloud Translation-service van Google vermeldt 194 talen ([de gepubliceerde lijst van Google](https://docs.cloud.google.com/translate/docs/languages)). Meta's OMT-1600 (maart 2026) claimt dekking voor 1.600 talen — het grootste MT-systeem dat ooit is gepubliceerd. Maar voor de ~1.200 talen in de lange staart — onze berekening: de 1.600 die het dekt minus de 400+ waarvan de auteurs melden dat de modellen ze "voldoende goed begrijpen" — ligt de kwaliteit onder de bruikbare drempelwaarden, worden de trainingsgegevens gedomineerd door bijbelteksten, zijn de modelgewichten niet beschikbaar om te downloaden en is er geen onafhankelijke evaluatie of raamwerk voor gemeenschapsbestuur. Voor de resterende ~5.400 talen produceert geen enkel vooraf getraind model enige uitvoer.

Het landschap is aanzienlijk verschoven — Big Tech investeert nu in LRL-dekking (bronschaarse talen). Maar dekking is geen kwaliteit, en kwaliteit zonder onafhankelijke verificatie is geen vertrouwen. Bronschaarse talen hebben meer nodig dan een model dat beweert ze te dekken — ze hebben onafhankelijke evaluatie met morfologische validatie, door de gemeenschap beheerde corpora en soevereiniteit-respecterend bestuur nodig.

**champollion is gebouwd om daar verandering in te brengen.**

Het [Method Leaderboard](https://champollion.dev/leaderboard) is een open uitdaging: bouw de beste vertaalmethode voor een onderbediende taal, bewijs dit met een reproduceerbare evaluatie en claim de topscore. Iedereen ter wereld kan bijdragen — taalkundigen, ML-onderzoekers, taalwerkers uit de gemeenschap, studenten, hobbyisten. Het probleem is onopgelost. De infrastructuur is aanwezig. Het scorebord wacht op u.

---

## Waarom dit moeilijk is: Polysynthetische morfologie

De meeste commerciële MT-systemen zijn ontworpen voor talen zoals het Engels, Frans en Chinees — talen waarin woorden relatief kort zijn en zinnen worden opgebouwd uit afzonderlijke tokens. Maar veel inheemse talen, waaronder Plains Cree, zijn **polysynthetisch**: een enkel woord kan coderen wat het Engels als een hele zin uitdrukt.

### Het Cree-voorbeeld

Neem het Plains Cree-woord:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"toen ik naar school ging"*

Dat is **één woord**. Het codeert de tijd (verleden), richting (gaan naar), de stam (leren), de wijs (passief/wederkerend) en de persoon (eerste persoon enkelvoud). Een LLM die voornamelijk op het Engels is getraind, heeft geen intuïtie voor dit soort morfologische dichtheid.

De uitdagingen stapelen zich op:

| Uitdaging | Wat het betekent |
|-----------|--------------|
| **Morfologische complexiteit** | Een enkele werkwoordstam kan duizenden geldige verbogen vormen genereren door middel van prefixatie, suffixatie en circumfixatie |
| **Onderscheid levend/levenloos** | Zelfstandige naamwoorden zijn grammaticaal levend of levenloos — dit beïnvloedt de werkvervoeging, aanwijzende voornaamwoorden en meervoudsvorming. De classificatie volgt niet altijd de biologische levendigheid (*askiy* "aarde" is levend; *maskisin* "schoen" is ook levend) |
| **Obviatie** | Verwijzingen in de derde persoon worden gerangschikt op nabijheid/saillantie. Het onderscheid tussen "proximaat" en "obviatief" heeft geen equivalent in het Nederlands of Engels |
| **Schaarse trainingsgegevens** | LLM's hebben heel weinig Plains Cree-tekst gezien. Wat ze hebben gezien, kan dialecten (Y-dialect, TH-dialect) of spellingen (SRO vs. syllabisch schrift) door elkaar halen |
| **Zwakke commerciële basislijn** | OMT-1600 bevat CRK op het R1-niveau (Zeer weinig middelen) met training in het bijbeldomein en standaard BPE-tokenisatie. Google Translate ondersteunt geen Cree. Onafhankelijke evaluatie met morfologische metrieken is wat deze basislijnen betekenisvol maakt. |

De vertaling van polysynthetische talen blijft een **open onderzoeksprobleem** — OMT-1600 bevat polysynthetische talen, maar gebruikt standaard BPE-tokenisatie (256K vocabulaire) zonder morfologisch bewustzijn, wat betekent dat het samengestelde woorden versnippert in betekenisloze bytefragmenten.

---

## Stand van de techniek: Hoe men dit heeft benaderd

### De ALTLab FST

De belangrijkste computationele bron voor Plains Cree is de **finite-state transducer (FST)**, ontwikkeld door het [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) aan de University of Alberta, in samenwerking met [Giellatekno](https://giellatekno.uit.no/) aan UiT The Arctic University of Norway.

De ALTLab FST is een **morfologische analysator en generator**: gegeven een verbogen Cree-woord, kan het dit ontleden in de stam en grammaticale tags, en gegeven een stam plus tags, kan het de correcte verbogen vorm genereren. Dit is deterministisch — geen neuraal netwerk, geen hallucinatie, geen waarschijnlijkheid. Als de FST een woord accepteert, is dat woord morfologisch geldig.

Dit is de reden waarom het champollion-scorebord de **FST-acceptatiegraad** (FST Acceptance Rate) als metriek bijhoudt. Een vertaalmethode die woorden produceert die de FST afwijst, produceert morfologisch ongeldig Cree — ongeacht wat de chrF++-score zegt.

**Belangrijkste ALTLab-bronnen:**
- [itwêwina](https://itwewina.altlab.app/) — een intelligent Plains Cree–Engels woordenboek aangedreven door de FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict) — open-source morfologisch bewust woordenboekplatform
- [crk-db](https://github.com/UAlbertaALTLab/crk-db) — lexicale database voor Plains Cree
- [21st Century Tools for Indigenous Languages](https://21c.tools/) — de bredere projectcontext

### Wereldwijde FST & Morfologische registers

Plains Cree is niet de enige taal met een hoogwaardige FST-infrastructuur. Als u vertaalpijplijnen wilt ontwikkelen voor andere bronschaarse of morfologisch complexe talen, kunt u gebruikmaken van deze gevestigde wereldwijde hubs:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT The Arctic University of Norway):** De grootste repository van open-source FST morfologische analysatoren en generatoren, die meer dan 100 talen dekt. Aandachtsgebieden zijn onder meer de Samische talen (`sme`, `smj`, `sma`, enz.), Oeraalse talen (Komi, Erzja, Oedmoerts, enz.) en andere minderheids-/inheemse talen. Ze hosten openbare verwerkte tekstcorpora (`corpus-xxx`) in hun [GitHub-organisatie](https://github.com/giellalt/).
* **[The Apertium Project](https://www.apertium.org/):** Een open-source regelgebaseerd automatisch vertaalplatform. Apertium onderhoudt sterk geoptimaliseerde FST morfologische analysatoren (met behulp van `lttoolbox` en `hfst`) en tweetalige woordenboeken voor tientallen talen, waaronder een grote reeks Turkse talen (Kazachs, Tataars, Kirgizisch, enz.) en Europese minderheidstalen. Alle bronnen zijn openbaar op [Apertium's GitHub](https://github.com/apertium).
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** Een samenwerkingsproject dat gestandaardiseerde morfologische paradigma's biedt voor meer dan 150 talen. De dataset wordt gehost op Hugging Face via [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies). Als een gecompileerde FST-binary niet beschikbaar is voor een taal, kunnen UniMorph-tabellen worden gebruikt als een statische database-opzoekpoort.
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/):** Biedt tools voor Canadese inheemse talen, waaronder de **Uqailaut** Inuktitut FST morfologische analysator en het enorme **Nunavut Hansard Parallel Corpus** (1,3 miljoen uitgelijnde Engels-Inuktitut zinsparen).

### Het EdTeKLA-corpus

De [EdTeKLA-onderzoeksgroep](https://spaces.facsci.ualberta.ca/edtekla/) (ook aan UAlberta) heeft een Plains Cree-taalcorpus samengesteld uit educatief materiaal, audiotranscripties en gemeenschapsbronnen. De champollion-evaluatiedataset [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) is afgeleid van dit werk, gepubliceerd onder [EdTeKLA's aangepaste CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (soevereiniteitsgerichte, niet-commerciële voorwaarden).

### Andere benaderingen die mensen hebben geprobeerd of zouden kunnen proberen

Het scorebord is methode-agnostisch. Hier zijn strategieën die zijn onderzocht of voorgesteld voor bronschaarse MT, die allemaal kunnen worden ingediend:

| Benadering | Hoe het werkt | Voordelen | Nadelen |
|----------|-------------|------|------|
| **[Gecoachte LLM-prompting](/docs/network/tutorials/coached-llm-prompting)** | Injecteer grammaticaregels, woordenboeken en voorbeeldparen in de systeemprompt | Snel te itereren, geen training nodig | Kwaliteitsplafond beperkt door de basiskennis van de LLM |
| **[Few-shot prompting](/docs/network/tutorials/few-shot-prompting)** | Voeg geverifieerde vertalingen toe als in-context voorbeelden | Goed voor een consistente stijl | Klein contextvenster; voorbeelden mogen NIET uit de evaluatiegegevens komen |
| **[FST-gecontroleerde pijplijn](/docs/network/tutorials/fst-gated-pipeline)** | LLM genereert → FST valideert → wijst af en probeert ongeldige morfologie opnieuw | Garandeert morfologische geldigheid | Vereist FST-infrastructuur; herhalingslussen voegen latentie en kosten toe |
| **[Woordenboek opzoeken + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | Forceer bekende termen uit een tweetalig woordenboek, laat de LLM de rest afhandelen | Vermindert hallucinatie voor bekende termen | Woordenboekdekking is altijd onvolledig |
| **[Fijn afgestemd model](/docs/network/tutorials/fine-tuned-model)** | Stem een open model (Llama, Mistral) fijn af op parallelle tekst — maar niet op de evaluatiegegevens | Potentieel de hoogste kwaliteit | Vereist parallel corpus (schaars); duur; risico op overfitting |
| **[Gekoppelde modellen](/docs/network/tutorials/chained-models)** | Model A genereert ruwe vertaling → Model B bewerkt na → Model C scoort | Kan sterke punten van specialisten combineren | Complex; traag; duur |
| **[Regelgebaseerd + LLM hybride](/docs/network/tutorials/rule-based-hybrid)** | Gebruik taalkundige regels voor bekende patronen, LLM voor al het andere | Nauwkeurig waar regels van toepassing zijn | Vereist diepgaande taalkundige expertise |
| **[Terugvertaling-augmentatie](/docs/network/tutorials/back-translation)** | Genereer synthetische parallelle gegevens door Cree→Engels te vertalen en vervolgens op het omgekeerde te trainen | Breidt trainingsgegevens goedkoop uit | Versterkt bestaande modelfouten |
| **[Evolutionaire benadering](/docs/network/tutorials/evolutionary-approach)** | Genereer kandidaat-vertalingen, scoor ze, muteer de best presterende, herhaal | Kan nieuwe oplossingen ontdekken; parallelliseerbaar | Computationeel duur; heeft een goede fitnessfunctie nodig |
| **[Gedeeltelijke vertaling](/docs/network/tutorials/partial-translation)** | Vertaal handmatig een representatieve steekproef, bewijs dat uw methode overeenkomt met uw stijl, en vertaal vervolgens automatisch de resterende bulk | Combineert menselijke kwaliteit met machineschaal | Vereist initiële menselijke inspanning |
| **Handmatige JSON / examens nakijken** | Maak handmatig een JSON-datasetbestand om antwoorden van studenten op een taalexamen te testen, of beoordeel een batch menselijke vertalingen tegen een gouden standaard | Geen ML vereist; werkt voor onderwijs en QA | Schaalt niet naar doorlopende vertaalbehoeften |

### Het is gewoon JSON

Het harnas neemt JSON in en scoort JSON uit. Het [datasetformaat](/docs/network/leaderboard/datasets) is eenvoudig:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

U kunt dit met de hand construeren. U kunt het exporteren vanuit een spreadsheet. U kunt het genereren uit een corpus. Een taaldocent zou het kunnen gebruiken om vertalingen van studenten te scoren. Een vertaalbureau zou het kunnen gebruiken om freelancers te benchmarken. Een onderzoekslaboratorium zou het kunnen gebruiken om modelarchitecturen te vergelijken. Het maakt het harnas niet uit waar de JSON vandaan komt — het scoort het gewoon.

En omdat het productie-implementatieraamwerk dezelfde plug-in-interface gebruikt, kan een methode die goed scoort in het harnas met één configuratiewijziging op uw website worden geïmplementeerd. **Bewijs het en gebruik het.**

De mogelijkheden zijn werkelijk eindeloos. **Als u een idee heeft, bouw het, voer het harnas uit en dien uw scores in.**

---

## Hoe champollion erin past

champollion biedt de infrastructuurlaag — u brengt de methode in.

### Het coachingsysteem

Met de `llm-coached`-methode van champollion kunt u taalkundige kennis rechtstreeks in de LLM-prompt injecteren:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

De coachingsgegevens worden geïnjecteerd in elke LLM-prompt voor het `en:crk`-paar, waardoor het model een gestructureerde taalkundige context krijgt die het anders niet zou hebben. Zie [Coachingsgegevens](https://champollion.dev/docs/concepts/coaching-data) voor de volledige specificatie.

### Registers

Het register maakt deel uit van de systeemprompt die de toon, formaliteit en orthografische conventies stuurt. champollion wordt geleverd met één Plains Cree-register:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

U kunt dit in uw configuratie overschrijven om te experimenteren met verschillende prompting-strategieën:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

Verschillende registers produceren verschillende vertaalstijlen — en verschillende scores op het scorebord. Elke inzending registreert het exacte register en de gebruikte systeemprompt (als een SHA-256-hash in de [run card](/docs/network/specifications/run-card)), zodat experimenten reproduceerbaar zijn.

### Schriftconversie

Plains Cree wordt in twee schriften geschreven: **Standard Roman Orthography (SRO)** en **Canadian Aboriginal Syllabics** (Canadees inheems syllabisch schrift). De pijplijn van champollion:

1. LLM vertaalt naar SRO (op het Latijn gebaseerd, wat LLM's beter verwerken)
2. Kwaliteitspoort valideert de SRO-uitvoer
3. Deterministische converter transformeert SRO → Syllabisch schrift
4. Geconverteerde tekst wordt naar de schijf geschreven

De converter verwerkt alle SRO-diakritische tekens (ê, î, ô, â voor lange klinkers) en wijst deze toe aan de juiste syllabische tekens. Zie [Schriftconverters](https://champollion.dev/docs/concepts/script-converters) voor technische details.

### De evaluatielus

Het [evaluatieharnas](/docs/network/specifications/harness) voert uw methode uit tegen de evaluatiedataset en produceert een gescoorde [run card](/docs/network/specifications/run-card):

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

De vlag `--name` is een label dat u kiest. Het verschijnt op het scorebord zodat mensen kunnen zien welke promptstrategie u heeft gebruikt. Het harnas registreert de volledige systeemprompt in de run card, zodat uw exacte benadering reproduceerbaar is.

:::tip[Experimenteer vrijuit, dien uw beste in]
Het harnas is ontworpen voor snelle iteratie. Voer tientallen experimenten uit met verschillende modellen, coachingsgegevens, registers en voorwaarden. Dien pas in op het scorebord als u iets heeft waar u trots op bent.
:::

---

## Datasoevereiniteitsprincipes {#data-sovereignty-principles}

champollion is ontworpen om inheemse datasoevereiniteit te ondersteunen. Eigendom, controle, toegang en bezit van taaldata door de gemeenschap sturen hoe wij taaltechnologie voor inheemse gemeenschappen benaderen:

| Principe | Hoe champollion dit ondersteunt |
|-----------|------------------------|
| **Eigendom** | Taalgemeenschappen zijn eigenaar van hun taalkundige gegevens. champollion belt nooit naar huis en verzendt geen gegevens naar onze servers |
| **Controle** | De [API-methode](https://champollion.dev/docs/guides/serving-a-method) stelt gemeenschappen in staat hun eigen vertaalpijplijn te hosten — wij bieden de interface, zij beheren de implementatie |
| **Toegang** | Gemeenschappen bepalen wie hun methode mag gebruiken. De API kan worden afgeschermd met authenticatie |
| **Bezit** | Alle vertaalgegevens blijven in het bestandssysteem van uw project. Het [herkomstsysteem](https://champollion.dev/docs/concepts/security) houdt bij waar elke vertaling vandaan komt |

De plug-in-architectuur betekent dat een gemeenschap een methode kan bouwen die heilige of beperkte kennis intern integreert, alleen de vertaal-API blootstelt en de volledige controle over hun taalkundige bronnen behoudt.

---

## De visie: Wat hierna komt

Plains Cree is het eerste doelwit. Zodra de pijplijn is gevalideerd en de gemeenschap tevreden is met de kwaliteit, wordt dezelfde architectuur uitgebreid naar andere polysynthetische talen met een FST-infrastructuur:

- **Andere Algonkische talen**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **Inuittalen**: Inuktitut, Inuinnaqtun (die ook syllabische schriften gebruiken)
- **Andere taalfamilies**: elke taal met een FST-analysator kan de FST-gecontroleerde pijplijn gebruiken

Het scorebord is gericht op taalparen. Naarmate nieuwe evaluatiedatasets worden bijgedragen door taalgemeenschappen, worden er automatisch nieuwe scorebord-tracks geopend.

**Dit is een open uitnodiging.** Als u met een bronschaarse taal werkt — als onderzoeker, lid van de gemeenschap, student of gewoon iemand die erom geeft — geeft champollion u de tools om iets echts te bouwen, het eerlijk te meten en het met de wereld te delen. Het [Method Leaderboard](https://champollion.dev/leaderboard) wacht op uw inzending.

---

## Zie ook

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — dien uw scores in en zie hoe methoden zich verhouden
- **[MT-evaluatie](/docs/network/leaderboard/rules)** — wat een goede methode maakt, wat wordt gediskwalificeerd
- **[Evaluatieharnas](/docs/network/specifications/harness)** — hoe u experimenten uitvoert
- **[Evaluatiedatasets](/docs/network/leaderboard/datasets)** — EDTeKLA Dev v1 en FLORES+
- **[Coachingsgegevens](https://champollion.dev/docs/concepts/coaching-data)** — hoe u taalkundige kennis structureert voor de LLM
- **[Schriftconverters](https://champollion.dev/docs/concepts/script-converters)** — de SRO→Syllabisch-pijplijn
- **[Een methode aanbieden via API](https://champollion.dev/docs/guides/serving-a-method)** — het hosten van door de gemeenschap gecontroleerde vertalingen
- **[ALTLab](https://altlab.ualberta.ca/)** — het Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)** — de onderzoeksgroep Educational Technology, Knowledge & Language
- **[itwêwina-woordenboek](https://itwewina.altlab.app/)** — door FST aangedreven Plains Cree–Engels woordenboek
