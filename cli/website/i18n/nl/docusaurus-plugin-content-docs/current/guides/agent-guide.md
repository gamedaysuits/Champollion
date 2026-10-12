---
sidebar_position: 9
title: "Agenthandleiding: champollion gebruiken"
description: "Hoe AI-agents champollion kunnen installeren, configureren en uitvoeren om localisatiebestanden te vertalen."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Agentgids: champollion gebruiken

champollion is een CLI-tool die de localisatiebestanden van uw applicatie vertaalt met één opdracht. Deze gids is bedoeld voor AI-agents (of ontwikkelaars die met AI-agents werken) die snel van nul naar vertaalde localisatiebestanden willen gaan.

:::tip[Al bekend?]
Als u alleen de opdrachten nodig hebt, ga dan naar de [CLI-referentie](/docs/reference/cli). Als u een vertaalmethode wilt bouwen en benchmarken, zie dan de [Network Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Omgeving instellen

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**Vereisten:**
- Node.js 20.11+ (native ESM)
- Een API-sleutel voor uw vertaalprovider

**API-sleutelinstellingen** — champollion heeft minimaal één sleutel nodig, afhankelijk van welke methoden u gebruikt:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion leest `.env.local` en `.env` automatisch (prioriteit: `process.env` → `.env.local` → `.env`). Vraag een OpenRouter-sleutel aan via [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Eerste synchronisatie

Champollion detecteert automatisch uw localisatiebestanden, hun indeling (JSON, TOML of YAML) en uw doeltalen:

```bash
npx champollion sync
```

**Wat er gebeurt:**
1. Laadt `champollion.config.json` (of detecteert instellingen automatisch)
2. Scant uw bronlocalisatiebestand en maakt geneste sleutels plat
3. Vergelijkt met `.champollion.lock` (SHA-256-hashes van eerder vertaalde waarden)
4. Controleert `.champollion/tm.json` op gecachede vertalingen (vertaalgeheugen)
5. Vertaalt alleen **gewijzigde, ontbrekende of verouderde sleutels** via de geconfigureerde methode
6. Voert de kwaliteitscontrole (5 controles) uit op elke vertaling
7. Schrijft geslaagde vertalingen naar het doellocalisatiebestand
8. Werkt het vergrendelingsbestand en de TM-cache bij

Bij een typische heruitvoering na het wijzigen van één sleutel levert stap 4 142 sleutels uit de cache en vertaalt stap 5 slechts 1 sleutel. Dit is waarom opeenvolgende synchronisaties snel en goedkoop zijn.

---

## Configuratie

Maak `champollion.config.json` aan in de hoofdmap van uw project:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

Paarssleutels gebruiken een **dubbele punt** (`en:fr`), geen koppelteken — koppeltekens zijn gereserveerd voor regionale taalcodes zoals `es-MX`.

Belangrijke velden:

| Veld | Doel | Standaardwaarde |
|------|------|-----------------|
| `inputLocale` | Brontaal | `en` |
| `languages` | Doeltalen (array of object) | `[]` |
| `pairs` | Overschrijvingen per paar (`"src:tgt"`-sleutels) met methodeconfiguratie | optioneel |
| `localesDir` | Waar localebestanden zich bevinden | `./locales` |
| `model` | LLM-model voor `llm`/`llm-coached`-methoden | `google/gemini-3.8-flash` |
| `batchSize` | Sleutels per API-aanroep | 80 (LLM); Google Translate limiteert tot 128 segmenten/verzoek |
| `jsonConcurrency` | Parallelle localevertalingen voor JSON-sleutels | 50 |
| `contentConcurrency` | Parallelle API-aanroepen voor contentvertaling | 48 (Docusaurus-documenten), 12 (`contentDir`) |

Volledige referentie: [Configuratie](/docs/getting-started/configuration)

---

## Vertaalmethoden

| Methode | Wanneer te gebruiken | Kosten | Benodigde API-sleutel |
|---------|---------------------|--------|----------------------|
| **`llm`** | Algemeen gebruik, geschikt voor goed ondersteunde talen | Per token (modelafhankelijk) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | Wanneer u grammaticaregels/woordenboek voor de doeltaal hebt | Per token + coachingcontext | `OPENROUTER_API_KEY` |
| **`google-translate`** | Talen met veel bronmateriaal waarbij GT goed werkt | $20/miljoen tekens | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Aangepaste pipeline achter een HTTP-eindpunt | Serverzijdig bepaald | Geen (eindpunt verwerkt authenticatie) |
| **`plugin`** | Vooraf verpakte methode die lokaal is geïnstalleerd | Varieert | Varieert |

Details: [Vertaalmethoden](/docs/guides/translation-methods)

---

## Coachinggegevens

Voor `llm-coached`-paren sturen coachinggegevens het LLM met expliciete taalkundige kennis. Maak een coachingbestand aan:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

Verwijs ernaar in uw paarconfiguratie:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

De kwaliteitscontrole verifieert of woordenboektermen daadwerkelijk in de uitvoer voorkomen — overtredingen worden geregistreerd als `[TERM]`-waarschuwingen.

Details: [Coachinggegevens](/docs/concepts/coaching-data)

---

## Kwaliteitscontrole

Elke vertaling doorloopt vijf geautomatiseerde controles voordat deze naar schijf wordt geschreven:

| Controle | Wat het detecteert | Voorbeeld |
|----------|--------------------|-----------|
| **Leeg/blanco** | Model retourneerde niets | `""` |
| **Bron-echo** | Model retourneerde de Engelse invoer ongewijzigd | `"Welcome"` voor Japans |
| **Hallucinatielus** | Herhaalde trigrammen | `"Qo' Qo' Qo' Qo'"` |
| **Lengte-inflatie** | Uitvoer is meer dan 4× de bronlengte (precies 4× slaagt) | bron van 10 tekens → uitvoer van 50 tekens |
| **Schriftconformiteit** | Verkeerd schrift voor de locale | Latijnse tekst voor Arabische locale |

Fouten worden geregistreerd met het voorvoegsel `[GATE]`. Geen stille terugvalmechanismen — als een vertaling mislukt, wordt dit gerapporteerd en niet stilzwijgend geaccepteerd.

Details: [Kwaliteitscontrole](/docs/concepts/quality-gate)

---

## Vertaalgeheugen

Champollion slaat vertalingen op in `.champollion/tm.json`, geïndexeerd op brontekst + taalinstelling + methode. Bij opeenvolgende synchronisaties worden ongewijzigde sleutels uit de cache geleverd — geen API-aanroep, geen kosten.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

Om de cache voor één uitvoering te omzeilen: `npx champollion sync --no-tm`

Details: [Vertaalgeheugen](/docs/concepts/translation-memory)

---

## Gegenereerde bestanden

Champollion maakt verschillende bestanden aan in uw project. Zorg dat u weet wat ze zijn, zodat u niet per ongeluk de verkeerde verwijdert of vastlegt:

| Bestand | Doel | Git? |
|---------|------|------|
| `.champollion.lock` | SHA-256-hashes van vertaalde bronwaarden (wijzigingsdetectie), plus per locale: wat sync heeft geschreven, sleutels die na een redo in behandeling bleven, sleutels die zijn tegengehouden na een weigering | **Ja** — commit dit |
| `.champollion-replaced-edits.jsonl` | Handmatig bewerkte vertalingen die door een sync zijn vervangen, met hun bewoording (wordt alleen geschreven wanneer dat gebeurt) | **Ja** — commit dit |
| `.champollion-content.lock` | Hetzelfde, maar voor Markdown/MDX-contentbestanden | **Ja** — commit dit |
| `.champollion/` | Interne statusdirectory (`tm.json`-cache, XLIFF-exports, back-ups) | **Nee** — neem dit op in .gitignore; `tm.json` is een lokale cache (zie [Configuratie](/docs/getting-started/configuration)) |
| Coachingbestanden die u zelf schrijft (bijv. `coaching/fr.json`) | Uw taalkundige kennis | **Ja** — commit deze |
| `champollion.config.json` | Projectconfiguratie | **Ja** — commit dit |

---

## Veelvoorkomende patronen

**Vertaal alle geconfigureerde paren:**
```bash
npx champollion sync
```
Champollion vertaalt alle locales parallel. Met TM-caching worden alleen gewijzigde sleutels naar de API gestuurd (ongewijzigde paren worden vanuit de cache geleverd, dus een volledige sync is voordelig).

**Vertaal alleen specifieke paren:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` beperkt de run tot het genoemde paar of de genoemde paren; gereedheidscontroles en uitgaven zijn alleen van toepassing op die paren. Het opgeven van een paar dat niet in uw geconfigureerde parengraaf staat, faalt luidruchtig met de lijst van geconfigureerde paren — nooit een stille no-op.

**Hoe een paar te schrijven.** Een projectpaar wordt geschreven zoals `champollion.config.json` dit indeelt, `en:fr`. `sync`, `verify` en `serve` lezen ook `en>fr` en `en-fr`, en `en-pt-BR` wordt vergeleken met de paren die u hebt geconfigureerd. De netwerkcommando's (`network register-corpus`, `leaderboard`, `recommend`, `submit`) schrijven een paar als `eng>crk`, de vorm die het scorebord opslaat, en lezen `eng-crk` en `eng:crk` op dezelfde manier. Daar moet een paar met enkel koppeltekens bestaan uit twee codes van twee of drie letters (`eng-crk`). Een code met een eigen koppelteken vereist `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` zou ook `eng-pt` en `BR` kunnen betekenen en wordt daarom geweigerd, nooit geraden. Plaats in een shell aanhalingstekens rond de `>`-vorm: `--pair "eng>crk"`. Zonder aanhalingstekens stuurt de shell de uitvoer naar een bestand met de naam `crk`.

**Content-modus (een map met Markdown/MDX: een Hugo-`content/` of een willekeurige map; Docusaurus-documenten worden zonder gevonden):**
```bash
npx champollion sync --content-dir ./content
```
Vertaalt documenten, blogposts en contentbestanden naast locale-JSON. Elke vertaling wordt naast de bron geschreven als `<name>.<locale>.md`; bewerkingen die een revisor hierin aanbrengt, blijven behouden wanneer de bron elders verandert ([Contentvertaling](/docs/guides/content-translation#reviewing-and-editing-translations)). Contentvertaling verloopt parallel; finetune met `--content-concurrency`.

**Droge uitvoering (voorbeeld zonder schrijven):**
```bash
npx champollion sync --dry-run
```

**Specifieke sleutels geforceerd opnieuw vertalen:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Verwerk alle contentbestanden opnieuw (gecachete tekst wordt hergebruikt, dus ongewijzigde tekst is gratis):**
```bash
npx champollion sync --force-content
```

**Vertaal specifieke contentbestanden opnieuw (gefactureerd), of beperk een run tot enkele bestanden:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**Machinaal leesbare run:** `--json` schrijft één JSON-object per regel (NDJSON), elk met een `level`: op stdout `info`- en `ok`-berichten, `event`-records (`"event": "cost"` — de schatting, vóór de `--max-cost`-drempel — en één `"event": "file"` per contentbestand en locale), en als laatste de afsluitende `{"level": "summary", "command": "sync", …}`; op stderr `warn`- en `error`-regels, eveneens in JSON. Selecteer de samenvatting op basis van het niveau, nooit alleen op regelpositie: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. Exitcode `2` betekent gedeeltelijk (een deel van het werk is gedaan, er is iets mislukt).

In de schatting (`cost`-event en `costEstimate` in de samenvatting) is `totalEstimatedCost` `null` zodra een onderdeel geen bekende prijs heeft — nooit een gedeeltelijke som, nooit `0` voor onbekend; `knownEstimatedCost` bevat het geprijsde deel, `unknownCost.reason` noemt de paren zonder prijs, en `unknownCost.notes` geeft aan wat geen prijs heeft en waarom — `{ subject, pairs, note }`, zoals een modelnaam die niet op de lijst van OpenRouter staat (waarschijnlijk een typefout, met de dichtstbijzijnde vermelde namen), een vermeld model zonder prijs per token, of een prijslijst die niet kon worden gelezen. Voor een model op deze machine (een `local`- of `api`-eindpunt op `localhost`/`127.0.0.1`/`::1`) is de prijs `0` met `"local": true`. De `sentToModel` van de samenvatting telt de sleutels die tijdens deze run naar de methode zijn verzonden (`tmHits`: geleverd vanuit de cache). De samenvatting van een dry-run bevat `preflight: { ready, failures }` — `ready: false` betekent dat de daadwerkelijke run zou stoppen en zou afsluiten met `1` (een ontbrekende sleutel, of een door de run benodigde modelserver die niet antwoordt), hoewel de dry-run zelf afsluit met `0` ([exitcodes](/docs/reference/cli#sync-exit-codes)). Met `--max-cost` bevat deze ook `maxCost: { cap, estimatedCost, wouldStop }` — `wouldStop: true` (met `exitCode: 2` en de `reason`) betekent dat de daadwerkelijke run vóór enige API-aanroep bij het maximum zou stoppen. `realRun: { exitCode, wouldStop, reasons }` is de exitcode waarmee de daadwerkelijke run zou eindigen, voor zover een preview kan bepalen: de preflight en het maximum, plus wat de run partieel zou achterlaten — tegengehouden sleutels, meervoudsvormen op schijf zonder een vorm die de taal gebruikt en waar niet opnieuw om gevraagd zou worden (geteld in de `totalPluralGaps` van de dry-run). Een dry-run verifieert niets (`verify: { "ran": false }`). Voer de dry-run uit met de `--method`/`--model` van de daadwerkelijke run: zonder deze controleert hij de methode die in de configuratie wordt genoemd.

**Controleer de vertaalstatus:**
```bash
npx champollion status
```
Toont de methode, het model, de dekking en plugin-informatie van elk paar (alleen een `qualityTier` wanneer de configuratie er een instelt — een label, geen meting).

**Controleren op onvertaalde terugvalwaarden:**
```bash
npx champollion audit
```
Geeft alle `[EN]`-terugvalwaarden weer die vertaling vereisen.

---

## Problemen oplossen

| Probleem | Oplossing |
|----------|-----------|
| `OPENROUTER_API_KEY not set` | Exporteer de sleutel of voeg deze toe aan `.env` in de hoofdmap van uw project |
| `No locale files found` | Stel `localesDir` in de configuratie in, of zorg dat uw localebestanden overeenkomen met de standaard naamgeving (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Uw doellocale heeft Latijnse tekst gekregen in plaats van het verwachte schrift — probeer een ander model of voeg coachinggegevens toe |
| `[GATE] Source echo` | Het model retourneerde Engels ongewijzigd — coachinggegevens of een ander model lossen dit meestal op |
| Alle vertalingen gecachet | Voer uit met `--no-tm` om de cache te omzeilen, of `--force-keys` voor specifieke sleutels |
| Conflicten in het lockbestand | `.champollion.lock` bevat hashes — een mergeconflict kan veilig worden opgelost door een van beide versies te behouden en vervolgens sync opnieuw uit te voeren. Het behouden van de record per locale van de andere kant kan ertoe leiden dat enkele waarden als handmatig bewerkt worden gezien (een bulk-redo behoudt ze dan en noemt ze; `--redo keys:` vervangt er één) — nooit het omgekeerde |
| Sleutels "tegengehouden" | De kwaliteitscontrole heeft het antwoord van dat model eerder geweigerd; een normale sync verzendt het niet opnieuw (hetzelfde antwoord zou worden gefactureerd). `champollion sync --redo keys:<key>` vraagt het opnieuw aan; of voeg een `fallback` toe, vermeld deze in `noTranslate`, of schrijf het met de hand |

---

## Volgende stappen

- [Snelstart](/docs/getting-started/quick-start) — volledige introductiewalkthrough
- [CLI-referentie](/docs/reference/cli) — elke opdracht en vlag
- [Hoe het werkt](/docs/how-it-works) — de synchronisatiepipeline toegelicht
- [De Eval Harness Bridge](/docs/guides/bridge) — hoe champollion verbinding maakt met het Network
- **Wilt u uw eigen vertaalmethode bouwen?** Zie de [Network Agent Guide](/docs/network/getting-started/agent-guide) — bouw een methode, bewijs dat deze werkt op het publieke leaderboard, en maak kans op een prijs als/wanneer er een beschikbaar is (prijzen zijn een gepland mechanisme — zie [Eerlijke beperkingen](/docs/network/honest-limitations)).
