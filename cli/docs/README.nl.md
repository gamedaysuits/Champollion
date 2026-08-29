# Champollion

[![npm version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


Vertaal uw locale-bestanden met één commando:

```bash
npx champollion sync
```

Champollion detecteert automatisch uw locale-bestanden, hun formaat en de doeltalen. Het vertaalt ontbrekende sleutels, slaat over wat al is gedaan en schrijft de resultaten weg. Dat is alles.

> **Onderdeel van Champollion** — open-source infrastructuur voor betrouwbare automatische vertaling in elke taal. Deze CLI is de implementatiekant van een groter project dat de testsets bouwt en de kaart die toont wie wat kan vertalen, hoe goed elke methode is voor elk type tekst, en waar de hiaten nog zitten. Het draait op twee soorten benchmarks: publieke benchmarks op open data (breed, goedkoop, elke methode is welkom) en soevereine benchmarks — geheime testsets die gemeenschappen creëren, bezitten en beheren, en die wij nooit zien. De infrastructuur is open-source en wordt centraal beheerd; de testsets en de methoden voor de taal van een gemeenschap behoren toe aan die gemeenschap. Gebouwd met gemeenschappen, nooit van hen gescrapet — zij hebben de touwtjes in handen. Elke methode is welkom, mens en machine. Verken het netwerk op [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## Waarom niet gewoon zelf een script schrijven?

U zou een snel script kunnen schrijven dat door uw Engelse sleutels loopt en Google Translate aanroept. De meeste ontwikkelaars doen dat — het kost ongeveer 30 regels. Dit is waarom dat misgaat:

- **Geen wijzigingsdetectie.** Wanneer u een Engelse string bijwerkt, blijft de vertaling voor altijd verouderd. Champollion volgt elke bronwaarde met SHA-256-hashes en vertaalt alleen wat is gewijzigd opnieuw.
- **Geen batchverwerking.** Eén API-aanroep per sleutel betekent 200 sleutels = 200 roundtrips. Champollion bundelt op intelligente wijze (configureerbaar, standaard 80 sleutels/batch voor LLM, 128 voor Google).
- **Geen kwaliteitscontrole.** Automatische vertaling hallucineert, echoot de bron terug of levert uitvoer in het verkeerde schrift. Champollion valideert elke vertaling voordat deze wordt weggeschreven — verkeerd schrift, lengte-inflatie en bronecho's worden opgemerkt en geweigerd.
- **Geen formaatbewustzijn.** Hardcoded voor JSON? Champollion verwerkt JSON, TOML, YAML en Hugo Markdown (frontmatter + body) met automatische detectie.
- **Geen veiligheid.** Champollion beveiligt tegen prototype pollution, path traversal via gemanipuleerde locale-codes en corruptie van codeblokken tijdens Markdown-vertaling.

Champollion is de productie-versie van dat script.

> [!NOTE]
> **Wat Champollion vertaalt.** Champollion richt zich op **locale-bestanden en gestructureerde content** — JSON sleutel-waardeparen, TOML/YAML-configuratie, Hugo Markdown-pagina's, XLIFF-uitwisselingsdocumenten. Het is geoptimaliseerd voor formele geschreven tekst: UI-strings, documentatie, officiële communicatie, educatief materiaal. Het is geen chatbot, real-time spraakvertaler of algemene conversationele AI. Voor elk talenpaar is de vertaalmethode configureerbaar — van commerciële API's (Google Translate, DeepL) tot door de gemeenschap ontwikkelde plug-ins die zijn gebenchmarkt via de [MT Eval Arena](https://champollion.dev/arena).

## Snelstart

```bash
npm install --save-dev champollion
```

### Een API-sleutel verkrijgen

Champollion heeft een vertaal-backend nodig. Kies er een:

| Provider | Sleutel | Het beste voor |
|----------|-----|----------|
| **OpenRouter** (aanbevolen) | `OPENROUTER_API_KEY` | Content-zware projecten, Markdown, 200+ modellen |
| **OpenAI** | `OPENAI_API_KEY` | Directe toegang tot GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | Directe toegang tot Claude |
| **Gemini** | `GEMINI_API_KEY` | Gratis niveau beschikbaar |
| **DeepL** | `DEEPL_API_KEY` | Europese talen, ondersteuning voor woordenlijsten |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130+ talen, hoog volume |

**Snelste start** (gratis): Meld u aan bij [aistudio.google.com](https://aistudio.google.com/apikey) voor een gratis Gemini-sleutel:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200+ modellen): Meld u aan bij [openrouter.ai](https://openrouter.ai), en vervolgens:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

**Google Translate**-alternatief (alleen sleutel-waardeparen — geen Markdown-bewustzijn):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Opmerking**: Als alleen `GOOGLE_TRANSLATE_API_KEY` is ingesteld, schakelt champollion automatisch over naar Google Translate. Geen configuratiewijziging nodig. Gebruikt de REST API direct — geen SDK, geen serviceaccount, geen `pip install`. Alleen de sleutel.

Dat is alles. Maak voor meer controle een configuratiebestand aan:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Elke taal wordt geleverd met **register-presets** — vooraf gebouwde instructies voor toon/formaliteit, afgestemd op het taalkundige systeem (vouvoiement voor Frans, Siezen voor Duits, です/ます voor Japans, 해요체 voor Koreaans). Met de init-wizard kunt u bladeren en presets kiezen, of `--yes` doorgeven om de standaardwaarden te accepteren.

### Niet-Engelse bron

Als uw brontaal geen Engels is:

```bash
champollion sync --source fr                      # CLI flag
```

Of stel het permanent in via uw configuratie:

```json
{ "inputLocale": "fr" }
```

## Wat het doet

U beheert het i18n-framework (next-intl, i18next, Hugo). Champollion beheert de vertaalbestanden.

- **Multi-formaat** — JSON, TOML, YAML, Hugo Markdown (front matter + body) en XLIFF 1.2
- **Incrementeel** — Vertaalt alleen wat is gewijzigd (SHA-256 hash-tracking)
- **Gecachet** — Translation Memory slaat eerdere resultaten op; het opnieuw uitvoeren van een synchronisatie kost niets voor ongewijzigde sleutels
- **Kwaliteitscontrole** — Valideert elke vertaling: vangt hallucinaties, uitvoer in het verkeerde schrift, bronecho's en lengte-inflatie op
- **Content-bewust** — LLM-methoden beschermen codeblokken, shortcodes, links en interpolatievariabelen tijdens Markdown-vertaling
- **Pipeline-tools** — `lint`, `audit`, `integrity`, `seo` voor CI-gates
- **XLIFF-interoperabiliteit** — Exporteer vertalingen voor professionele beoordeling in CAT-tools (memoQ, SDL Trados, Phrase), en importeer ze weer terug
- **Minimale afhankelijkheden** — twee runtime-afhankelijkheden (better-sqlite3 voor de gebundelde taal-database, CLDR locale-namen); geen provider-SDK's. Vereist Node 20+

## Verder dan Google Translate

De snelstart helpt u op weg met een LLM of Google Translate. Maar Google Translate ondersteunt ~130 talen. Er zijn er meer dan 7.000.

**Het kernidee van Champollion: de vertaalmethode is configureerbaar per talenpaar.** Gebruik Google Translate voor Frans, een LLM met morfologische coaching voor Plains Cree, en een door de gemeenschap gehoste API voor Quechua — allemaal in hetzelfde project, allemaal met dezelfde CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Als u kunt uitvinden hoe u een talenpaar moet vertalen — via prompt engineering, gemeenschapswoordenboeken, FST-pipelines of gefinetunede modellen — stelt champollion u in staat die methode als een plug-in te verpakken en deze naast al het andere in te zetten.

> Ontstaan uit het vertalen van een productiewebsite naar Plains Cree, waarvoor geen kant-en-klare API bestaat. De architectuur per talenpaar is niet theoretisch — deze bestaat omdat één project Google Translate nodig had voor Frans en een gecoachte FST-pipeline voor een inheemse taal, die zij aan zij draaien in hetzelfde synchronisatiecommando.

Met de bijbehorende [MT Eval Harness](https://github.com/gamedaysuits/Champollion) kunt u vertaalbenaderingen benchmarken en vergelijken, en vervolgens werkende methoden exporteren als champollion-plug-ins. Iedereen die beide talen spreekt, kan een vertaalmethode ontwikkelen, testen en delen — er is geen propriëtair platform vereist.

### Kies uw methode

Champollion ondersteunt 10 vertaalmethoden. Elk talenpaar kan een andere methode gebruiken.

**LLM-providers** — het beste voor kwaliteit, Markdown-bewust, compatibel met coaching:

| Methode | Sleutel | Wat het doet |
|--------|-----|-------------|
| `llm` (standaard) | `OPENROUTER_API_KEY` | LLM via OpenRouter — 200+ modellen, auto-routing |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + grammaticaregels, woordenboeken, stijlnotities |
| `openai` | `OPENAI_API_KEY` | Directe OpenAI API (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Directe Anthropic API (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Directe Google Gemini API (Flash, Pro) — gratis niveau beschikbaar |

**Traditionele MT** — het beste voor snelheid, kosten en grote volumes sleutel-waardeparen:

| Methode | Sleutel | Wat het doet |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130+ talen) |
| `deepl` | `DEEPL_API_KEY` | DeepL API met ondersteuning voor woordenlijsten (30+ talen) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100+ talen) |
| `libretranslate` | *(zelf-gehost)* | Zelf-gehoste LibreTranslate (AGPL, gratis) |

**Infrastructuur** — voor aangepaste of door de gemeenschap gehoste endpoints:

| Methode | Sleutel | Wat het doet |
|--------|-----|-------------|
| `api` | *(per provider)* | Dunne HTTP-client voor elk REST-endpoint |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **Opmerking**: Traditionele MT-methoden (Google Translate, DeepL, Microsoft Translator, LibreTranslate) verwerken sleutel-waardeparen goed, maar kunnen Markdown-content niet veilig vertalen. Voor content-zware projecten worden LLM-methoden aanbevolen — deze beschermen expliciet codeblokken, shortcodes en interpolatievariabelen.

## Plug-ins

Plug-ins zijn vooraf verpakte vertaalrecepten voor specifieke talenparen. Het zijn JSON-manifesten — geen code — die champollion vertellen welke methode moet worden gebruikt, met welke instellingen, en welke kwaliteit is gebenchmarkt.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

Zie [website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md) voor het manifestformaat.

## Commando's

| Commando | Doel |
|---------|---------|
| `init` | Interactieve installatiewizard (of `--yes` voor snelle standaardwaarden) |
| `sync` | Vertaal & synchroniseer alle locale-bestanden |
| `watch` | Automatisch synchroniseren bij bestandswijzigingen |
| `audit` | Markeer onvolledige locales (CI-gate) |
| `card` | Pretty-print een taalkaart (`card <code>`, `--json` voor ruwe data) |
| `register-corpus` | Registreer een evaluatiecorpus: kies een licentie + blootstellingsniveau (local-only/private/public/sealed) |
| `submit` | Stel een indexvermelding voor (beoordeling vereist) — print een vooraf ingevulde GitHub-issue |
| `lint` | Vind hardcoded strings in broncode |
| `status` | Toon paarconfiguratie, methoden, registers en kwaliteitsniveaus |
| `provenance` | Controleer licenties van vertaalbronnen |
| `wrap` | Automatisch inpakken van hardcoded strings in `t()`-aanroepen (met ongedaan maken) |
| `seo` | Genereer hreflang, sitemap.xml of JSON-LD-schema |
| `integrity` | Controleer op corruptie van placeholders, codering en ICU-meervoudsvolledigheid |
| `plugin` | Installeer, verwijder of lijst methode-plug-ins op |
| `fonts` | Download webfonts voor PUA-schriftconverters |
| `tm` | Beheer Translation Memory-cache (statistieken, wissen, per locale) |
| `xliff` | Exporteer/importeer XLIFF 1.2 voor professionele vertalersbeoordeling |
| `models` | Lijst beschikbare modellen op voor een provider (`--method gemini`) |
| `verify` | Lees weggeschreven locale-bestanden opnieuw in en bevestig dat vertalingen aanwezig en correct zijn (CI-gate) |
| `leaderboard` | Toon het MT-klassement (`--pair`, `--sort`, `--install N`) |
| `doctor` | Systeemgezondheidscontrole: kaarten, configuratie, methoden en converters |

Voer `champollion <command> --help` uit voor gedetailleerde hulp bij elk commando.

Volledige referentie: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### Pre-commit gate

`champollion lint` is gebouwd als een commit-gate: het sluit af met `1` wanneer het hardcoded gebruikersgerichte strings vindt en met `0` wanneer het schoon is (`--warn-only` rapporteert zonder te blokkeren). Koppel het aan een getrackte hooks-directory in uw project:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

Of activeer het vanuit [lint-staged](https://github.com/lint-staged/lint-staged) zodat het alleen wordt uitgevoerd wanneer bronbestanden gestaged zijn:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Houd `champollion sync` buiten pre-commit — het maakt netwerk-API-aanroepen, dus het is op zijn best traag en blokkeert in het slechtste geval commits wanneer u offline bent. Voer het in plaats daarvan uit in CI of een pre-push hook, met `champollion audit` / `champollion verify` als de gate.

## Configuratie

Maak `champollion.config.json` aan of voer `champollion init` uit:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Optie | Standaard | Beschrijving |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Brontaalcode |
| `localesDir` | `"./locales"` | Pad naar locale-bestanden |
| `contentDir` | `null` | Hugo content-directory (schakelt Markdown-vertaling in) |
| `format` | `"auto"` | Bestandsformaat: `json`, `toml`, `yaml` of `auto` |
| `model` | `"google/gemini-3.5-flash"` | Standaardmodel (OpenRouter-slug). Directe providers bepalen hun eigen standaardwaarde tijdens runtime. Voer `champollion models --method gemini` uit om beschikbare modellen te ontdekken. |
| `defaultMethod` | `"llm"` | Standaard vertaalmethode (overschreven door de `--method`-vlag) |
| `batchSize` | `80` | Sleutels per vertaalbatch |
| `pairs` | `{}` | Overschrijvingen per paar voor methode, model en kwaliteit |

**Overschrijvingen per taal**: Elke taal heeft een [Language Card](../website/docs/reference/language-card-spec.md) — een van de 50 gecureerde kaarten met register-presets, formaliteitssystemen, typografieregels en vlaggen voor methode-ondersteuning. Kaarten gebruiken een [two-tier architectuur](../website/docs/concepts/architecture.md) (runtime + referentie) voor prestaties op schaal. Genereer een nieuwe kaart met `node scripts/generate-language-card.mjs <code>`. Gebruik preset-sleutels als afkorting, of schrijf aangepaste registertekst:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "cans"
    }
  }
}
```

**Zero-config modus**: Geen configuratiebestand? Champollion detecteert automatisch locale-bestanden, het formaat en de doeltalen vanuit uw project.

Taalwaarden kunnen een preset-sleutel zijn (bijv. `"casual-tu"`), aangepaste registertekst of een object (volledige controle). Overschrijvingen op paarniveau in `pairs` hebben prioriteit over instellingen op taalniveau. Voer `npx champollion init` uit om door beschikbare presets voor elke taal te bladeren.

Zie de [CLI-referentie](../website/docs/reference/cli.md) voor framework-specifieke installatiedetails.

## CLI-uitvoer

Wanneer u `sync` uitvoert, toont champollion precies wat er gebeurt:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

De voortgangsbalk wordt ter plekke bijgewerkt naarmate elke batch is voltooid (~80 sleutels per update). Framework-detectie toont `Hugo` wanneer `contentDir` is ingesteld. Formaatdetectie onderscheidt `(auto)` van `(config)` om te verduidelijken hoe het formaat is bepaald.

**Uitvoermodi**: `--quiet` onderdrukt informatieve uitvoer (alleen fouten en waarschuwingen). `--json` zendt machineleesbare NDJSON uit voor CI/CD-pipelines.

## Hardening

- **Exponential backoff** — 3 pogingen met jitter bij 429/5xx-fouten
- **30s request timeout** — AbortController voorkomt vastlopen
- **Responsvalidatie** — accepteert alleen sleutels die voor vertaling zijn verzonden
- **Kwaliteitscontrole** — vangt hallucinatie-loops, uitvoer in het verkeerde schrift, lengte-inflatie en bronecho's op
- **Retry cascade** — bij een JSON-parsefout wordt de batch opnieuw geprobeerd → halve batch → individuele sleutels (budget-gelimiteerd via `maxRetries`)
- **Translation Memory** — `.champollion/tm.json` cachet vertalingen op basis van brontekst + locale + methode; ongewijzigde sleutels worden bij volgende synchronisaties vanuit de cache geleverd, wat overbodige API-aanroepen elimineert
- **Prompt caching** — de splitsing van systeem-/gebruikersberichten maakt caching op providerniveau mogelijk, wat de tokenkosten over batches heen verlaagt
- **Terminologiehandhaving** — gecoachte vertalingen worden geverifieerd aan de hand van woordenboektermen nadat de LLM reageert
- **Prototype pollution guard** — blokkeert `__proto__`, `constructor`, `prototype`
- **Path containment** — het wegschrijven van bestanden wordt gevalideerd om binnen de geconfigureerde directory's te blijven
- **Blokbescherming** — codeblokken, shortcodes en HTML worden afgeschermd tijdens contentvertaling
- **Fail-loud architectuur** — vertaalfouten werpen altijd een exception op met bruikbare foutmeldingen, en schrijven nooit stilletjes onzin weg
- **Post-sync verificatie** — het `verify`-commando leest weggeschreven bestanden opnieuw in en bevestigt dat vertalingen aanwezig zijn, in het juiste schrift staan en dat placeholders intact zijn
- **Gedeeltelijk succes** — één mislukte batch blokkeert de rest niet

## Testen

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**Minimale afhankelijkheden** — zie hierboven.

## Licentie

Apache-2.0. De Champollion CLI is open source — gratis te installeren, gebruiken, wijzigen en herdistribueren onder de voorwaarden van de [Apache License, Version 2.0](../LICENSE). Het gepubliceerde `champollion` npm-pakket is Apache-2.0; `cli/LICENSE` is de gezaghebbende licentie voor het gedistribueerde pakket. De bijbehorende MT Eval Harness en specificaties zijn ook open source, gelicentieerd onder AGPL-3.0-or-later — met een §7 eval-standard-plugin uitzondering — in de publieke [harness repository](https://github.com/gamedaysuits/Champollion).
