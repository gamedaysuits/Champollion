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

| Veld | Doel | Standaard |
|-------|---------|---------|
| `inputLocale` | Brontaal | `en` |
| `languages` | Doeltalen (array of object) | `[]` |
| `pairs` | Paarsgewijze overschrijvingen (`"src:tgt"`-sleutels) met methodeconfiguratie | optioneel |
| `localesDir` | Locatie van localisatiebestanden | `./locales` |
| `model` | LLM-model voor `llm`/`llm-coached`-methoden | `google/gemini-3.5-flash` |
| `batchSize` | Sleutels per API-aanroep | 80 (LLM); Google Translate heeft een limiet van 128 segmenten per verzoek |
| `jsonConcurrency` | Parallelle localisatievertaling voor JSON-sleutels | 50 |
| `contentConcurrency` | Parallelle API-aanroepen voor inhoudsvertaling | 48 (Docusaurus-documentatie), 12 (Hugo `contentDir`) |

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
| **Leeg/blanco** | Model heeft niets geretourneerd | `""` |
| **Bronherhaling** | Model heeft de Engelse invoer ongewijzigd geretourneerd | `"Welcome"` voor Japans |
| **Hallucinatielus** | Herhaalde trigrammen | `"Qo' Qo' Qo' Qo'"` |
| **Lengte-inflatie** | Uitvoer is 4× of meer langer dan de bron | 10-teken bron → 50-teken uitvoer |
| **Schriftconformiteit** | Verkeerd schrift voor de taalinstelling | Latijns schrift voor Arabische taalinstelling |

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
|------|---------|------|
| `.champollion.lock` | SHA-256-hashes van vertaalde bronwaarden (wijzigingsdetectie) | **Ja** — commit dit |
| `.champollion-content.lock` | Hetzelfde, maar voor Markdown/MDX-inhoudsbestanden | **Ja** — commit dit |
| `.champollion/` | Interne statusmap (`tm.json`-cache, XLIFF-exports, back-ups) | **Nee** — voeg toe aan gitignore; `tm.json` is een lokale cache (zie [Configuratie](/docs/getting-started/configuration)) |
| Coachingbestanden die u zelf schrijft (bijv. `coaching/fr.json`) | Uw taalkundige kennis | **Ja** — commit deze |
| `champollion.config.json` | Projectconfiguratie | **Ja** — commit dit |

---

## Veelvoorkomende patronen

**Vertaal alle geconfigureerde paren:**
```bash
npx champollion sync
```
Champollion vertaalt alle locales parallel. Met TM caching worden alleen gewijzigde keys naar de API gestuurd (ongewijzigde paren worden vanuit de cache geleverd, waardoor een volledige synchronisatie goedkoop is).

**Vertaal alleen specifieke paren:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` beperkt de uitvoering tot het genoemde paar (of de genoemde paren); readiness checks en kosten zijn alleen van toepassing op die paren. Het opgeven van een paar dat niet in uw geconfigureerde pair graph staat, geeft een duidelijke foutmelding met de lijst van geconfigureerde paren — nooit een stille no-op.

**Inhoudsmodus (Markdown/MDX voor Docusaurus, Hugo, enz.):**
```bash
npx champollion sync --content-dir ./content
```
Vertaalt documentatie, blogberichten en inhoudsbestanden naast de JSON-localisaties. Inhoudsvertaling verloopt parallel; stel dit af met `--content-concurrency`.

**Droge uitvoering (voorbeeld zonder schrijven):**
```bash
npx champollion sync --dry-run
```

**Specifieke sleutels geforceerd opnieuw vertalen:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Alle inhoudsbestanden geforceerd opnieuw vertalen:**
```bash
npx champollion sync --force-content
```

**Vertaalstatus controleren:**
```bash
npx champollion status
```
Toont dekking, kwaliteitsniveaus en plug-ininformatie voor elk paar.

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
| `No locale files found` | Stel `localesDir` in de configuratie in, of zorg dat uw localisatiebestanden overeenkomen met de standaardnaamgeving (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Uw doeltaalinstelling heeft Latijns schrift ontvangen in plaats van het verwachte schrift — probeer een ander model of voeg coachinggegevens toe |
| `[GATE] Source echo` | Het model heeft het Engels ongewijzigd geretourneerd — coachinggegevens of een ander model lossen dit doorgaans op |
| Alle vertalingen gecached | Voer uit met `--no-tm` om de cache te omzeilen, of `--force-keys` voor specifieke sleutels |
| Conflicten in vergrendelingsbestand | `.champollion.lock` gebruikt SHA-256-hashes — samenvoegconflicten kunnen veilig worden opgelost door een van beide versies te behouden en vervolgens de synchronisatie opnieuw uit te voeren |

---

## Volgende stappen

- [Snelstart](/docs/getting-started/quick-start) — volledige introductiewalkthrough
- [CLI-referentie](/docs/reference/cli) — elke opdracht en vlag
- [Hoe het werkt](/docs/how-it-works) — de synchronisatiepipeline toegelicht
- [De Eval Harness Bridge](/docs/guides/bridge) — hoe champollion verbinding maakt met het Network
- **Wilt u uw eigen vertaalmethode bouwen?** Zie de [Network Agent Guide](/docs/network/getting-started/agent-guide) — bouw een methode, bewijs dat deze werkt op het publieke leaderboard, en maak kans op een prijs als/wanneer er een beschikbaar is (prijzen zijn een gepland mechanisme — zie [Eerlijke beperkingen](/docs/network/honest-limitations)).
