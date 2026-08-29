---
sidebar_position: 4
title: "Methode-interface"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# Gedeelde Methode-interface

> **Samenvatting.** Deze pagina specificeert het `TranslationMethod`-protocol dat alle Network-methoden moeten implementeren, de zes methodeklassen (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), de orthogonale **paradigma**-as (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …) die *hoe een methode vertaalt* vergelijkbaar maakt tussen systemen, het methode-pluginformaat, en de **afhankelijkheidsklassen** (S/O/A1/A2/X) die bepalen of een methode in de evaluatiesandbox kan draaien en in aanmerking komt voor prijzen. Dit zijn drie onafhankelijke assen. Elke aanpak die dit protocol implementeert kan worden gebenchmarkt; wat een methode vereist bepaalt waar zij kan concurreren.

De eval-harness en champollion delen een gemeenschappelijk concept van **vertaalmethode**. Een methode is elke procedure die brontekst als invoer neemt en vertaalde tekst produceert — of het nu een directe LLM-aanroep is, een meerfasige pipeline, een externe API, of een menselijke vertaler.

## Architectuur

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

Geladen via `--method path/to/dir`. De harness detecteert niets automatisch.

## Twee systemen, één interface

| | Eval Harness | champollion |
|---|---|---|
| **Taal** | Python | Node.js |
| **Toegangspunt** | `translate.py` | `translate.js` |
| **Interface** | `TranslationMethod`-protocol | `methodPlugin`-configuratie |
| **Doel** | Batchevaluatie met scoring | Live lokalisatie in dev/CI |
| **Uitvoer** | Run card met statistieken | Vertaalde localebestanden |

Een methode die beide systemen ondersteunt, biedt twee toegangspunten — één voor elke taalruntime. De **method card** is de brug: deze beschrijft de methode in een formaat dat beide systemen begrijpen.

## Method Card {#method-card}

Een method card beschrijft *wat* een vertaalmethode is, zonder eigendomsgevoelige details zoals de volledige systeemprompt prijs te geven. De card beantwoordt de volgende vragen:

- Tot welke klasse behoort deze methode? (ruwe LLM, coached LLM, pipeline, API, enz.)
- Welk **paradigma** gebruikt zij? (regelgebaseerd, statistisch, neural-nmt, llm, hybride)
- Welke hulpmiddelen gebruikt zij? (FST-analysator, woordenboek, enz.)
- Is de implementatie open source?
- Welke taalparen worden ondersteund?

Zie de [Method Card Spec](/docs/network/specifications/methods#method-card) voor het volledige JSON-schema.

### Voorbeeld

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

Het veld `dependency_class` geeft een overzicht van wat de methode nodig heeft om te draaien en te worden overgedragen — zie [Methodegeldigheid en afhankelijkheidsklassen](#method-validity-and-dependency-classes) hieronder. Het veld `paradigm` plaatst de methode op de **paradigma-as** (hier `hybrid`: een LLM bewaakt door een regelgebaseerde FST) — zie [Paradigma's](#paradigms) hieronder.

### Methodeklassen

| Klasse | Beschrijving |
|-------|-------------|
| `raw-llm` | Directe LLM-aanroep met minimale instructie |
| `coached-llm` | LLM met gestructureerde prompt, voorbeelden en beperkingen |
| `pipeline` | Meerfasige pipeline met deterministische componenten |
| `custom-plugin` | Extern proces dat het `TranslationMethod`-protocol implementeert |
| `api` | Externe vertaal-API (Google Translate, DeepL, enz.) |
| `human` | Menselijke vertaling (voor het vaststellen van basislijnen) |

### Paradigma's {#paradigms}

Het **paradigma** is een derde, onafhankelijke as: *hoe een methode op algoritmisch niveau vertaalt*. Het staat loodrecht op zowel de methodeklasse als de afhankelijkheidsklasse. Methodeklasse alleen is LLM-centrisch — een regelgebaseerd [Apertium](https://www.apertium.org/)-systeem en Google Translate vallen beide onder `pipeline`/`api`, waardoor "regelgebaseerd versus neuraal" onzichtbaar blijft zonder deze as. De paradigma-as maakt die vergelijking eersteklas en filterbaar op het leaderboard.

| Paradigma | Beschrijving | Voorbeelden |
|----------|-------------|----------|
| `rule-based` | Eindige-toestandstransducers, handgeschreven grammatica's, morfologische overdracht | Apertium, GiellaLT FST-generatie |
| `statistical` | Zinsdeel-gebaseerde / statistische MT (SMT) geleerd uit parallelle corpora | klassiek Moses |
| `neural-nmt` | Een toegewijd neuraal encoder-decoder MT-model | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | Een algemeen groot taalmodel dat via een prompt wordt aangestuurd om te vertalen | een ruwe of coached GPT / Claude / Gemini-aanroep |
| `hybrid` | Combineert twee of meer paradigma's in één methode | een LLM bewaakt door een regelgebaseerde FST (crk-translate); NMT + regelgebaseerde nabewerking |
| `human` | Menselijke vertaling (basislijn op paradigmaniveau) | basislijn gemeenschapsvertaler |
| `unknown` | Niet gespecificeerd — de card heeft geen paradigma opgegeven | standaard achterwaartse compatibiliteit voor cards van vóór de paradigma-as |

De assen zijn onafhankelijk. Enkele uitgewerkte voorbeelden:

| Methode | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (zelf gehost, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-bewaakt, LLM-coached) | `pipeline` | `hybrid` | A2 |
| Ruwe GPT-aanroep | `raw-llm` | `llm` | A1 |

Het paradigma is **optioneel** op een method card; een ontbrekend paradigma wordt geregistreerd als `unknown` (het blokkeert publicatie nooit — de as is additief). De bovenstaande enum is de canonieke, ondersteunde woordenschat, afgedwongen door de harness (`config.VALID_PARADIGMS`). Omdat handhaving aan de applicatiezijde plaatsvindt in plaats van als databasebeperking, kunnen nieuwe paradigma's later worden toegevoegd zonder migratie; alleen het hernoemen of verwijderen van een waarde waarop methoden al steunen is kostbaar.

## Methodegeldigheid en afhankelijkheidsklassen {#method-validity-and-dependency-classes}

Een methode is slechts zo uitvoerbaar, en slechts zo overdraagbaar, als haar minst beschikbare afhankelijkheid. Twee Network-mechanismen zijn afhankelijk van exacte kennis van wat een methode vereist:

1. **Sandbox-evaluatie** ([Benchmark Specification §8.2](/docs/network/specifications/benchmark)) — officiële goudstandaard-scores worden gegenereerd in een sandbox waarvan het netwerkbeleid **standaard-weigeren** is. Een methode die stilzwijgend een externe dienst vereist, kan geen officiële score produceren.
2. **Prijsoverdracht** ([Prize Specification](/docs/network/specifications/prizes)) — prijswinnende methoden worden overgedragen aan de bestuursorganisatie van de taalgemeenschap. Een methode die inhoud bevat waarop de indiener geen rechten had, kan niet rechtmatig worden overgedragen. De indiener moet de rechten op alles in het pakket bezitten (of verleend hebben gekregen).

Om beide controles mechanisch te maken in plaats van ad hoc, declareert elke methode een **afhankelijkheidsklasse**, afgeleid van een **afhankelijkheidsmanifest** in `method.json`.

> **Opmerking over naamgeving — drie onafhankelijke assen.** *Methodeklasse* (§hierboven: `raw-llm`, `pipeline`, …) beschrijft de *vorm* van een methode — het interfacecontract dat zij biedt. *Paradigma* ([§Paradigma's](#paradigms): `rule-based`, `neural-nmt`, `llm`, …) beschrijft *hoe zij algoritmisch vertaalt*. *Afhankelijkheidsklasse* (dit gedeelte) beschrijft *wat zij nodig heeft om te draaien en te worden overgedragen*. De drie zijn orthogonaal: een `pipeline`-methode kan `rule-based` of `hybrid` zijn, en kan elke afhankelijkheidsklasse hebben. (Klasse en paradigma zijn bewust gescheiden, omdat klasse alleen LLM-centrisch is — het kan een regelgebaseerd systeem niet onderscheiden van een neuraal systeem wanneer beide zich presenteren als `pipeline` of `api`.)

### De vijf afhankelijkheidsklassen

| Klasse | Naam | Definitie | Uitvoerbaar in sandbox? | In aanmerking voor prijs? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Zelfvoorzienend | Alle code, data, modellen en gewichten worden meegeleverd in de methodemap, onder licenties die herdistributie en overdracht aan de gemeenschap toestaan. | ✅ Ja, direct | ✅ Ja |
| **O** | Open extern | Afhankelijk van extern gehoste artefacten onder open licenties die herdistributie toestaan (inclusief copyleft-licenties zoals AGPL) — bijv. een FST die bij installatie wordt gedownload. | ✅ Ja — artefacten zijn vastgezet en **gespiegeld in de inzending** | ✅ Ja, met licentiecompatibiliteitsvoorwaarden: copyleft-bepalingen blijven behouden bij overdracht, en de gemeenschap ontvangt dezelfde rechten die de licentie aan iedereen verleent |
| **A1** | API-afhankelijk, vervangbaar | Vereist runtime LLM-inferentie, waarbij het model **vervangbare configuratie** is — elk voldoende capabel model kan worden ingeplugd. De waarde van de methode ligt in haar prompts, coachingdata en code, niet in het model van één specifieke aanbieder. | ⚠️ Alleen via de **LLM-gateway** die de sandboxspecificatie definieert (🔲 gepland — zie hieronder) | ⚠️ Voorwaardelijk — zie hieronder |
| **A2** | API-afhankelijk, niet-vervangbaar | Vereist runtime-aanroepen naar een externe data- of dienst-API die niet gespiegeld of vervangen kan worden — doorgaans omdat de aangeboden inhoud eigendomsrechtelijk beschermd of ongelicentieerd is (bijv. een woordenboek-API waarvan het onderliggende woordenboek geen openbare licentie heeft). | ❌ Nee — de afhankelijkheid kan niet in de sandbox bestaan zonder toestemming van de rechthebbende | ❌ Niet totdat de rechthebbende sandbox-opname **en** overdrachtsrechten verleent. Toegestaan op het open (ontwikkelingssegment) leaderboard met een zichtbare **"externe afhankelijkheid"**-markering |
| **X** | Gesloten | Bevat inhoud waarop de indiener geen recht heeft om te herdistribueren — ongelicentieerde datasets, gescrapte eigendomsinhoud, licentie-incompatibele componenten. | ❌ | ❌ Niet toegelaten in elke categorie. Het bundelen van inhoud zonder rechten is een licentieovertreding, ongeacht waar de methode draait |

**Effectieve klasse.** De afhankelijkheidsklasse van een methode is de *meest beperkende* klasse onder al haar gedeclareerde afhankelijkheden, in de volgorde S < O < A1 < A2 < X. Één ongelicentieerd woordenboek maakt een verder zelfvoorzienende pipeline tot klasse A2 (indien benaderd tijdens runtime) of klasse X (indien gebundeld zonder rechten).

### Het A1/A2-onderscheid: vervangbaarheid

De meeste methoden roepen LLM's aan. Het Network doet niet alsof dat anders is — maar het maakt onderscheid tussen twee zeer verschillende soorten API-afhankelijkheid:

- **A1 (vervangbaar):** De API biedt commodity LLM-inferentie. De modelidentificator is configuratie: de methode moet end-to-end werken met elk compatibel inferentie-eindpunt, inclusief een door de gemeenschap gehost open-gewichtenmodel. De uitvoerkwaliteit kan verschillen per model — dat is het risico van de ontwikkelaar, en officiële scores zijn gekoppeld aan het vastgezette model dat bij de evaluatie is gebruikt. Een methode die afhankelijk is van **aanbiederzijdige toestand** (een fine-tune die alleen bij de aanbieder wordt gehost, bestandsopslag van de aanbieder, aanbiederspecifieke assistenten) is *niet* vervangbaar: die toestand kan niet worden uitgewisseld, waardoor de afhankelijkheid A2 is, tenzij de onderliggende gewichten of data in de inzending zijn opgenomen.
- **A2 (niet-vervangbaar):** De API levert iets unieks — doorgaans eigendomsrechtelijk beschermde of ongelicentieerde data. Geen alternatief eindpunt kan dit leveren, en de inhoud kan niet in de sandbox worden gespiegeld zonder toestemming van de rechthebbende. De methode werkt op het open leaderboard (gemarkeerd), maar kan geen officiële sandboxscores produceren of in aanmerking komen voor prijzen totdat de benodigde toestemmingen zijn verkregen.

**Wat een A1-prijsoverdracht daadwerkelijk omvat.** De gemeenschap ontvangt het model niet — niemand kan de gewichten van Anthropic, Google of OpenAI overdragen. De overdracht omvat het volledige recept *rondom* het model: alle prompts, coachingdata, pipelinecode, retry-logica, configuratie en gedocumenteerde modelvereisten. Omdat het model per constructie vervangbaar is, kan de gemeenschap de overgedragen methode richten op elke aanbieder naar keuze — of op een open-gewichtenmodel op eigen hardware — zonder betrokkenheid van de ontwikkelaar. Het recept is eigendom; de motor wordt gehuurd en is vervangbaar.

### Afhankelijkheidsmanifest (`method.json`)

Elke methode declareert haar afhankelijkheden in het `method.json`-manifest. Elke vermelding registreert wat het artefact is, waar het vandaan komt, welke licentie erop van toepassing is, en hoe de methode er toegang toe heeft:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| Veld | Vereist | Beschrijving |
|-------|----------|-------------|
| `id` | ✅ | Stabiele identificator voor de afhankelijkheid |
| `kind` | ✅ | `data`, `model`, `software`, of `service` |
| `license` | ✅ | SPDX-identificator, `proprietary`, of `none`. `none` betekent dat er geen openbare licentie bestaat — behandeld als alle rechten voorbehouden |
| `access` | ✅ | `bundled` (wordt meegeleverd in de methodemap), `mirrored` (opgehaald bij installatie, vastgezet, opgenomen in de inzending), `gateway` (runtime LLM-inferentie via de evaluatiegateway), `external-api` (elke andere runtime-netwerkaanroep) |
| `source` | ✅ | Canonieke URL of `provider:slug`-identificator |
| `pin` | voor `mirrored` | Versie, commit of inhoudsHash die het exacte artefact vastlegt |
| `substitutable` | voor `gateway`/`external-api` | Of elk compatibel eindpunt deze afhankelijkheid kan leveren |
| `redistributable` | ✅ | Of de licentie herdistributie van het artefact toestaat |
| `transferable` | ✅ | Of het artefact (of de rechten daarop) aan een gemeenschap kan worden overgedragen onder de prijsoverdrachtvoorwaarden |
| `notes` | ❌ | Vrije-vorm toelichting |

**Klassederivatie.** Elke afhankelijkheid draagt een klasse bij; de `dependency_class` van de methode is de meest beperkende:

| Afhankelijkheidsprofiel | Draagt bij |
|--------------------|-------------|
| `bundled` + licentie staat herdistributie en overdracht toe | S |
| `mirrored` + open licentie die herdistributie toestaat (copyleft inbegrepen) | O |
| `gateway` + `substitutable: true` (LLM-inferentie) | A1 |
| `external-api`, of `gateway` met `substitutable: false` | A2 |
| `bundled` + `license: none` of herdistributie-incompatibele licentie | X |

De gedeclareerde `dependency_class` moet overeenkomen met de klasse die de harness afleidt uit het manifest. Een afwijking is een validatiefout.

Een methode **zonder** externe afhankelijkheden declareert `"dependency_class": "S"` en `"dependencies": []`. De lege array is een bevestigende verklaring, geauditeerd zoals elke andere.

### Hoe geldigheid wordt geverifieerd

Drie lagen, van goedkoopst naar meest gezaghebbend:

1. **Manifestaudit.** De harness leidt de effectieve klasse af uit het manifest en verwerpt afwijkingen. Reviewers controleren elke gedeclareerde afhankelijkheid aan de hand van de opgegeven licentie en bron — een afhankelijkheid die als `redistributable: true` is gedeclareerd maar waarvan de upstream-licentie anders luidt, slaagt niet voor de review.
2. **Statische analyse.** De ingediende code wordt gescand op netwerkaanroepen, dynamische downloads en bestandssysteemtoegang die niet in het manifest zijn opgenomen. Een *niet-gedeclareerde* afhankelijkheid die tijdens de review wordt gevonden, is grond voor afwijzing, ongeacht welke klasse zij zou hebben gehad — het manifest moet volledig zijn, niet alleen nauwkeurig.
3. **Sandbox-netwerkbeleid.** De sandboxspecificatie vereist **standaard-weigeren egress**: methodecontainers krijgen geen netwerktoegang tenzij een pad expliciet op de allowlist staat. Het enige egresspad dat de specificatie definieert is de **LLM-gateway** — een inferentieproxy beheerd door de evaluatie-infrastructuur, beperkt tot een expliciete allowlist van vastgezette modellen, waarbij elk verzoek en elke respons wordt gelogd voor audit na de run. Alles wat niet op de allowlist staat, mislukt op de netwerklaag, niet op de beleidslaag. Zie [Benchmark Specification §8.6](/docs/network/specifications/benchmark) voor het netwerkbeleid en het gateway-ontwerp.

> **Twee verschillende sandboxen — één gepland, één actief.** Lees dit aandachtig, want het woord "sandbox" verwijst naar twee afzonderlijke zaken:
>
> - 🔲 **Gepland: de platformsandbox en zijn LLM-gateway.** De door de evaluatie-infrastructuur beheerde omgeving die in dit gedeelte wordt beschreven — de omgeving waarvan de LLM-gateway Class A1-methoden in staat zou stellen officiële goudstandaardscores te produceren — is gespecificeerd maar nog niet gebouwd. Totdat dit het geval is, komen Class A1-methoden *in principe* in aanmerking voor prijzen, maar kunnen zij nog geen officiële goudstandaardscores produceren.
> - ✅ **Actief: de uitvoeringsstrook voor methoden op het organisatorknooppunt.** Een wedstrijdorganisator's eigen scoringsknooppunt voert voorgestelde methodebundels al uit in een netwerkgeïsoleerde container (`mt-eval node run-method`): gebouwd en uitgevoerd met `--network=none`, alleen-lezen root, afhankelijkheden gevendord — waardoor het beperkt is tot methoden die geen runtime-netwerk vereisen (Class S/O per constructie). Het kan worden uitgevoerd op een machine met echte luchtgaping, waarbij ondertekende bundels met uitsluitend scores via verwijderbare media worden overgedragen. Zie [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) voor het volledige traject.
>
> Dit gedeelte beschrijft wat de platformspecificatie vereist, niet wat er momenteel op het platform wordt uitgevoerd.

### Leaderboard-weergave

- Het leaderboard toont de afhankelijkheidsklasse van elke methode naast haar methodeklasse-badge.
- Klasse A2-methoden op het open leaderboard dragen een zichtbare **"externe afhankelijkheid"**-markering: hun scores zijn afhankelijk van een externe dienst die kan veranderen of verdwijnen, en zij komen momenteel niet in aanmerking voor prijzen.
- Klasse X-methoden worden niet vermeld.

## Eval Harness: TranslationMethod-protocol {#eval-harness-translationmethod-protocol}

De evaluatieharness maakt gebruik van Python's structurele typering (`Protocol`) voor plugins. Elke klasse met de juiste leden werkt — overerving is niet vereist. Het protocol heeft **drie** verplichte leden, niet alleen `translate`:

1. **`name`** (`str`) — voor mensen leesbare methodenaam, gebruikt in run-ID's en logboeken.
2. **`method_card()`** (`-> dict | None`) — metagegevens van de methode voor herkomstregistratie, ingebed in het runlogboek en de gepubliceerde runkaart. Geef `None` terug als de methode geen kaart heeft.
3. **`async translate(entries, config)`** (`-> list[dict]`) — de vertaling zelf: een batch invoervermeldingen, één resultaatwoordenboek per vermelding als uitvoer.

Wanneer de harness een plugin laadt via `--method path/to/dir`, valideert hij dat `translate` aanroepbaar is, leest vervolgens `method.name` en roept `method.method_card()` onvoorwaardelijk aan — een plugin waarbij een van beide ontbreekt, zal crashen bij het laden in plaats van netjes te falen.

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

De pluginmap vereist een `method.json`-manifest met ten minste `name` en `entry_point` (`"module_name:ClassName"` — de module wordt geladen vanuit de pluginmap en de klasse wordt geïnstantieerd). Als een geretourneerde methodenkaart een `class` of `paradigm` declareert, moet deze het bovenstaande canonieke vocabulaire gebruiken — een kaart die buiten de taxonomie valt, mislukt de validatie bij het laden in plaats van stilzwijgend van de filters van het leaderboard te verdwijnen.

Voor een volledig uitgewerkt voorbeeld — het bouwen, uitvoeren en indienen van een plugin van begin tot eind — zie [Submit a Method](/docs/network/getting-started/submit-a-method) en het [FST-Gated Pipeline-kookboek](/docs/network/tutorials/fst-gated-pipeline).

## champollion: methodPlugin-configuratie

In champollion worden methoden per taalpaar geregistreerd in `champollion.config.json`:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

Zie de [Plugin Spec](https://champollion.dev/docs/reference/plugin-spec) voor de champollion-zijdige interface.

## Leaderboard-integratie

Wanneer een method card aan een run is gekoppeld (via `--method-card`), wordt deze ingebed in de run card en weergegeven op het leaderboard:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

Als er geen `--method-card` is opgegeven, start `mt-eval publish` een interactieve wizard die u begeleidt bij het beschrijven van uw methode.

Het leaderboard toont:
- **Klassebadge** — visuele indicator (bijv. "pipeline", "coached-llm")
- **Paradigma** — het algoritmische paradigma (bijv. "rule-based", "neural-nmt", "llm", "hybrid"), een filterbare kolom (zie [Paradigma's](#paradigms))
- **Afhankelijkheidsklasse** — S/O/A1/A2 (zie [Methodegeldigheid en afhankelijkheidsklassen](#method-validity-and-dependency-classes)); A2-methoden dragen een "externe afhankelijkheid"-markering
- **Methodenaam** — afkomstig van de method card
- **Gebruikte hulpmiddelen** — vermeld op de method card
- **Open source-indicator**

Wanneer er geen method card is gekoppeld, toont het leaderboard de harness-native configuratie (model, promptversie, temperatuur, ingeschakelde hulpmiddelen).

:::danger[TRAIN NIET op evaluatiedata]
Methoden waarvan het ontwikkelingsproces blootstelling aan de evaluatiedataset omvatte — als trainingsdata, few-shot-voorbeelden, woordenboekitems of materiaal voor promptafstemming — worden **gediskwalificeerd** van het leaderboard. Zie [MT Evaluation](/docs/network/leaderboard/rules) voor wat een goede methode onderscheidt van een slechte.
:::

---

## Zie ook

- [MT Evaluation](/docs/network/leaderboard/rules) — overzicht, leaderboard-waarde en richtlijnen voor goede en slechte methoden
- [Eval Harness](/docs/network/specifications/harness) — hoe evaluaties uit te voeren
- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — beschikbare datasets (EDTeKLA, FLORES+)
- [Run Card Specification](/docs/network/specifications/run-card) — het run card JSON-schema
- [Plugin Spec](https://champollion.dev/docs/reference/plugin-spec) — champollion-zijdige plugin-interface
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmarkscores
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluatieprotocol, corpusformaat, run card-schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT voor statistieken, samengestelde gewichten en kwaliteitsniveaus
