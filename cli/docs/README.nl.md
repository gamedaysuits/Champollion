# Champollion

[![npm-versie](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![Licentie: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


**Op rails, met vangrails.** Ontwikkeling en implementatie van automatische vertaling
op rails, gebouwd met het oog op gemeenschappen met inheemse talen en talen met
beperkte middelen. Deze CLI is de project- en implementatielaag.

**Bouw een model voor een taal**, op uw eigen computer:

```bash
npx champollion new our-language --from English --to "Plains Cree"
cd our-language && npx champollion next
```

Een taal zonder standaardcode krijgt een code voor privégebruik en een eigen naam:
`npx champollion new our-language --from English --to qaa --target-name "Our language"`
(elke code van `qaa` tot `qtz`).

`champollion new` start een project met een plek voor alles;
`champollion next` geeft de volgende stap aan — van de bestanden die een gemeenschap bijhoudt
(spreadsheets, Word-tabellen, Toolbox- of LIFT-woordenboeken, ELAN-transcripties)
naar een gemeten model en in uw app. Elke stap geeft aan wie beslist: de mensen
die de taal dragen, beslissen waar de zinnen naartoe mogen en wat er wordt uitgebracht. Een AI-
agent kan dezelfde stappen doorlopen via de
[MCP-server](https://www.npmjs.com/package/champollion-mcp-server). De rails
beloven een proces, geen kwaliteit: u zult weten hoe goed een model is, niet dat het
goed is — een eerste klein gemeenschapsmodel is meestal een gemeten taalgids.
Begin op [champollion.dev/start](https://champollion.dev/start).

**Vertaal de locale-bestanden van uw app** met één commando:

```bash
npx champollion sync
```

Champollion detecteert automatisch uw locale-bestanden, hun formaat en de doeltalen. Het vertaalt ontbrekende sleutels, slaat over wat al is gedaan en schrijft de resultaten weg — vanuit een gehoste engine, of vanuit een model dat u zelf heeft gebouwd en host (`champollion connect`).

**Licentie:** broncode beschikbaar onder de [PolyForm Noncommercial License 1.0.0](../LICENSE) — gratis te gebruiken, te wijzigen en te delen voor niet-commerciële doeleinden (persoonlijke projecten, onderzoek, onderwijs en gebruik door liefdadigheidsinstellingen, scholen en overheidsinstanties). Gebruik voor commerciële doeleinden valt niet onder deze licentie. Het evaluatie-framework is open source (AGPL-3.0-or-later). [Wie dit mag gebruiken](https://champollion.dev/docs/getting-started/who-may-use-this) · [Details](#license).

## Waarom niet gewoon zelf een script schrijven?

U zou een snel script kunnen schrijven dat door uw Engelse sleutels loopt en Google Translate aanroept. De meeste ontwikkelaars doen dit — het kost ongeveer 30 regels. Dit is waarom het stukloopt:

- **Geen wijzigingsdetectie.** Wanneer u een Engelse string bijwerkt, blijft de vertaling voor altijd verouderd. Champollion volgt elke bronwaarde met SHA-256-hashes en vertaalt alleen wat er is veranderd.
- **Geen batchverwerking.** Eén API-aanroep per sleutel betekent 200 sleutels = 200 roundtrips. Champollion bundelt op intelligente wijze (configureerbaar, standaard 80 sleutels/batch voor LLM, 128 voor Google).
- **Geen kwaliteitscontrole.** Automatische vertaling hallucineert, echoot de bron terug of levert uitvoer in het verkeerde schrift. Champollion controleert elke vertaling voordat deze wordt weggeschreven — lege uitvoer, bronecho's, herhalingslussen, lengte-inflatie, verwijderde inhoud en verkeerd schrift worden opgevangen en geweigerd. De controle vangt defecte uitvoer op, geen onjuiste betekenis.
- **Geen formaatbewustzijn.** Hardcoded naar JSON? Champollion verwerkt JSON, TOML, YAML en Hugo Markdown (frontmatter + body) met automatische detectie.
- **Geen veiligheid.** Champollion beschermt tegen prototype pollution, path traversal via gemanipuleerde locale-codes en corruptie van codeblokken tijdens Markdown-vertaling.

Champollion is de productie-versie van dat script.

> [!NOTE]
> **Wat Champollion vertaalt.** Champollion richt zich op **locale-bestanden en gestructureerde inhoud** — JSON-sleutel-waardeparen, TOML/YAML-configuratie, Hugo Markdown-pagina's, XLIFF-uitwisselingsdocumenten. Het is geoptimaliseerd voor formele geschreven tekst: UI-strings, documentatie, officiële communicatie, educatief materiaal. Het is geen chatbot, real-time spraakvertaler of algemene conversationele AI. Voor elk talenpaar is de vertaalmethode configureerbaar — van commerciële API's (Google Translate, DeepL) tot door de gemeenschap ontwikkelde plug-ins, openbare benchmarks en modellen die u traint en host op de rails.

## Snel aan de slag

```bash
npm install --save-dev champollion
```

### Vraag een API-sleutel aan

Champollion heeft een vertaal-backend nodig. Kies er een:

| Provider | Sleutel | Het beste voor |
|----------|-----|----------|
| **OpenRouter** (aanbevolen) | `OPENROUTER_API_KEY` | Inhoudszware projecten, Markdown, 200+ modellen |
| **OpenAI** | `OPENAI_API_KEY` | Directe toegang tot GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | Directe toegang tot Claude |
| **Gemini** | `GEMINI_API_KEY` | Gratis niveau beschikbaar |
| **DeepL** | `DEEPL_API_KEY` | Europese talen, ondersteuning voor woordenlijsten |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130+ talen, hoog volume |

**Snelste start** (gratis): Meld u aan op [aistudio.google.com](https://aistudio.google.com/apikey) voor een gratis Gemini-sleutel:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200+ modellen): Meld u aan op [openrouter.ai](https://openrouter.ai), en vervolgens:

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

Elke taal wordt geleverd met **register-presets** — vooraf gebouwde instructies voor toon/formaliteit die zijn afgestemd op het taalkundige systeem (vouvoiement voor het Frans, Siezen voor het Duits, です/ます voor het Japans, 해요체 voor het Koreaans). Met de init-wizard kunt u bladeren en presets kiezen, of `--yes` doorgeven om de standaardwaarden te accepteren.

### Niet-Engelse bron

Als uw brontaal geen Engels is:

```bash
champollion sync --source fr                      # CLI flag
```

Of stel het permanent in uw configuratie in:

```json
{ "inputLocale": "fr" }
```

## Wat het doet

U beheert het i18n-framework (next-intl, i18next, Hugo). Champollion beheert de vertaalbestanden.

- **Multi-formaat** — JSON, TOML, YAML, Hugo Markdown (frontmatter + body) en XLIFF 1.2
- **Incrementeel** — Vertaalt alleen wat er is veranderd (SHA-256-hash-tracking)
- **Gecachet** — Translation Memory slaat eerdere resultaten op; het opnieuw uitvoeren van een synchronisatie kost niets voor ongewijzigde sleutels
- **Kwaliteitscontrole** — Controleert elke vertaling op defecte uitvoer: herhalingslussen, uitvoer in verkeerd schrift, bronecho's, lengte-inflatie en verwijderde inhoud (het controleert niet de betekenis)
- **Inhoudsbewust** — LLM-methoden beschermen codeblokken, shortcodes, links en interpolatievariabelen tijdens Markdown-vertaling
- **Pipeline-tools** — `lint`, `audit`, `integrity`, `seo` voor CI-gates
- **XLIFF-interoperabiliteit** — Exporteer vertalingen voor professionele beoordeling in CAT-tools (memoQ, SDL Trados, Phrase), en importeer ze weer terug
- **Minimale afhankelijkheden** — twee runtime-afhankelijkheden: `@translated/lara` (de Lara-provider-SDK) en `cree-sro-syllabics` (ALTLab/NRC's Plains Cree SRO ⇄ syllabics-converter). Vereist Node 20+

## Verder dan Google Translate

Met de snelle start kunt u aan de slag met een LLM of Google Translate. Maar Google Translate ondersteunt ~130 talen. Er zijn er meer dan 7.000.

**Het kernidee van Champollion: de vertaalmethode is configureerbaar per talenpaar.** Gebruik Google Translate voor het Frans, een LLM gecoacht met uw eigen grammaticanotities en woordenboek voor het Plains Cree, en een API die u host voor een taal die door geen enkele dienst wordt gedekt — allemaal in hetzelfde project, allemaal met dezelfde CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Als u kunt uitvinden hoe u een talenpaar moet vertalen — via prompt engineering, gemeenschapswoordenboeken, FST-pipelines of gefinetunede modellen — stelt champollion u in staat om die methode als een plug-in te verpakken en deze naast al het andere te implementeren.

> Ontstaan uit het vertalen van een productiewebsite naar het Plains Cree, waarvoor geen kant-en-klare API bestaat. De architectuur per talenpaar is niet theoretisch — deze bestaat omdat één project Google Translate nodig had voor het Frans en een gecoachte FST-pipeline voor een inheemse taal, die zij aan zij draaien in hetzelfde synchronisatiecommando.

Met het bijbehorende [MT Eval Harness](https://github.com/gamedaysuits/Champollion) kunt u vertaalbenaderingen benchmarken en vergelijken, en vervolgens werkende methoden exporteren als champollion-plug-ins. Iedereen die beide talen spreekt, kan een vertaalmethode ontwikkelen, testen en delen — er is geen propriëtair platform vereist.

### Kies uw methode

Champollion ondersteunt 10 vertaalmethoden. Elk talenpaar kan een andere methode gebruiken.

**LLM-providers** — het beste voor kwaliteit, Markdown-bewust, compatibel met coaching:

| Methode | Sleutel | Wat het doet |
|--------|-----|-------------|
| `llm` (standaard) | `OPENROUTER_API_KEY` | LLM via OpenRouter — 200+ modellen, automatische routering |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + grammaticaregels, woordenboeken, stijlnotities |
| `openai` | `OPENAI_API_KEY` | Directe OpenAI API (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Directe Anthropic API (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Directe Google Gemini API (Flash, Pro) — gratis niveau beschikbaar |
| `local` | *(geen)* | Uw eigen model achter een OpenAI-compatibel eindpunt (Ollama, vLLM, LM Studio, een model getraind met `nmt-forge`). Stel `LOCAL_API_BASE` in als het niet op de standaardwaarde van Ollama staat. Tekst verlaat nooit uw infrastructuur |

**Traditionele MT** — het beste voor snelheid, kosten en grote volumes sleutel-waardeparen:

| Methode | Sleutel | Wat het doet |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130+ talen) |
| `deepl` | `DEEPL_API_KEY` | DeepL API met ondersteuning voor woordenlijsten (30+ talen) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100+ talen) |
| `libretranslate` | *(zelf-gehost)* | Zelf-gehoste LibreTranslate (AGPL, gratis) |

**Infrastructuur** — voor aangepaste of door de gemeenschap gehoste eindpunten:

| Methode | Sleutel | Wat het doet |
|--------|-----|-------------|
| `api` | *(per provider)* | Dunne HTTP-client voor elk REST-eindpunt |

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
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **Opmerking**: Traditionele MT-methoden (Google Translate, DeepL, Microsoft Translator, LibreTranslate) verwerken sleutel-waardeparen goed, maar kunnen Markdown-inhoud niet veilig vertalen. Voor inhoudszware projecten worden LLM-methoden aanbevolen — deze beschermen expliciet codeblokken, shortcodes en interpolatievariabelen.

## Plug-ins

Plug-ins zijn vooraf verpakte vertaalrecepten voor specifieke talenparen. Het zijn JSON-manifesten — geen code — die champollion vertellen welke methode moet worden gebruikt, met welke instellingen en welke kwaliteit is gebenchmarkt.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

Zie [de referentiedocumentatie](https://champollion.dev/docs/reference/plugin-spec) voor het manifestformaat.

## Commando's

| Commando | Doel |
|---------|---------|
| `init` | Interactieve installatiewizard (of `--yes` voor snelle standaardwaarden) |
| `sync` | Vertaal en synchroniseer alle locale-bestanden |
| `serve` | Serveer de vertaalstack van dit project via HTTP (api-method-contract) |
| `watch` | Automatisch synchroniseren bij bestandswijzigingen |
| `audit` | Markeer onvolledige locales (CI-gate) |
| `lint` | Vind hardcoded strings in de broncode |
| `status` | Toon configuratie van paren, methoden, registers en plug-in-benchmarks |
| `provenance` | Controleer licenties van vertaalbronnen |
| `wrap` | Wikkel hardcoded strings automatisch in `t()`-aanroepen (met ongedaan maken) |
| `seo` | Genereer hreflang, sitemap.xml of JSON-LD-schema |
| `integrity` | Controleer op corruptie van placeholders, codering en volledigheid van ICU-meervouden |
| `plugin` | Installeer, verwijder of lijst methode-plug-ins op |
| `fonts` | Download weblettertypen voor PUA-schriftconverters |
| `tm` | Beheer de Translation Memory-cache (statistieken, wissen, seeden, opschonen) |
| `xliff` | Exporteer/importeer XLIFF 1.2 voor professionele vertalersbeoordeling |
| `models` | Lijst beschikbare modellen op voor een provider (`--method gemini`) |
| `verify` | Lees weggeschreven locale-bestanden opnieuw en bevestig dat vertalingen aanwezig en correct zijn (CI-gate) |
| `doctor` | Systeemgezondheidscontrole: kaarten, configuratie, methoden en converters |

De commando's die werken met de gedeelde index en het scorebord, in plaats van uw
project, zijn gegroepeerd onder `champollion network` (elk werkt ook zonder het
voorvoegsel):

| Commando | Doel |
|---------|---------|
| `network card` | Pretty-print een taalkaart (`network card <code>`, `--json` voor onbewerkt) |
| `network recommend` | Methodebegeleiding voor een paar — beschikbaarheid + geciteerd bewijs (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | Toon het MT-scorebord (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | Registreer een evaluatiecorpus: kies een licentie + blootstellingsniveau (alleen-lokaal/privé/openbaar/verzegeld) |
| `network seal-corpus` | Crypto-werkwoorden voor verzegeld niveau: `keygen` / `seal` / `open` (organizer-node-brug) |
| `network submit` | Stel een indexvermelding voor (beoordelingsgecontroleerd) — drukt een vooraf ingevuld GitHub-issue af |

Voer `champollion <command> --help` uit voor gedetailleerde hulp bij elk commando.

Volledige referentie: [de referentiedocumentatie](https://champollion.dev/docs/reference/cli)

### Pre-commit-gate

`champollion lint` is gebouwd om een commit-gate te zijn: het sluit af met `1` wanneer het hardcoded gebruikersgerichte strings vindt en met `0` wanneer het schoon is (`--warn-only` rapporteert zonder te blokkeren). Koppel het aan een getrackte hooks-map in uw project:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.6 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
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

Houd `champollion sync` uit pre-commit — het maakt netwerk-API-aanroepen, dus het is op zijn best traag en blokkeert in het ergste geval commits offline. Voer het in plaats daarvan uit in CI of een pre-push-hook, met `champollion audit` / `champollion verify` als de gate.

## Configuratie

Maak `champollion.config.json` aan of voer `champollion init` uit:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Optie | Standaard | Beschrijving |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Brontaalcode |
| `localesDir` | `"./locales"` | Pad naar locale-bestanden: één bestand per taal (`fr.json`) of één map per taal (`fr/common.json`, i18next) |
| `localesPattern` | `null` | Elke andere lay-out, bijv. `"src/i18n/{ns}/{lang}.json"` (vervangt `localesDir`) |
| `contentDir` | `null` | Map met Markdown/MDX om te vertalen (een Hugo `content/` of een willekeurige map); elke vertaling wordt naast de bron weggeschreven als `<name>.<locale>.md` |
| `format` | `"auto"` | Bestandsformaat: `json`, `toml`, `yaml` of `auto` |
| `model` | `"google/gemini-3.8-flash"` | Standaardmodel (OpenRouter-slug). Directe providers bepalen hun eigen standaardwaarde tijdens runtime. Voer `champollion models --method gemini` uit om beschikbare modellen te ontdekken. |
| `defaultMethod` | `"llm"` | Standaard vertaalmethode (overschreven door `--method`-vlag) |
| `batchSize` | `80` | Sleutels per vertaalbatch |
| `pairs` | `{}` | Methode-, model- en kwaliteitsoverschrijvingen per paar |

**Overschrijvingen per taal**: Elke taal heeft een [Taalkaart](https://champollion.dev/docs/reference/language-card-spec) — een van de 50 gecureerde kaarten met register-presets, formaliteitssystemen, typografieregels en vlaggen voor methodeondersteuning. Kaarten gebruiken een [tweelaagse architectuur](https://champollion.dev/docs/agents/rails-model) (runtime + referentie) voor prestaties op schaal. Genereer een nieuwe kaart met `node scripts/generate-language-card.mjs <code>`. Gebruik preset-sleutels als afkorting, of schrijf aangepaste registertekst:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**Zero-config-modus**: Geen configuratiebestand? Champollion detecteert automatisch locale-bestanden, het formaat en de doeltalen vanuit uw project.

Taalwaarden kunnen een preset-sleutel zijn (bijv. `"casual-tu"`), aangepaste registertekst of een object (volledige controle). Overschrijvingen op paarniveau in `pairs` krijgen voorrang op instellingen op taalniveau. Voer `npx champollion init` uit om door beschikbare presets voor elke taal te bladeren.

Zie de [CLI-referentie](https://champollion.dev/docs/reference/cli) voor framework-specifieke installatiedetails.

## CLI-uitvoer

Wanneer u `sync` uitvoert, laat champollion precies zien wat er gebeurt:

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

De laatste regel van de schatting vermeldt het tarief waartegen elk cijfer is geprijsd, waar het vandaan kwam en wanneer (`--json` bevat de details). "Translating …" wordt alleen gezegd wanneer er iets wordt verzonden: een dry run, of een run waarbij niets te verzenden is, geeft in plaats daarvan aan dat de locales worden gecontroleerd. De voortgangsbalk wordt ter plekke bijgewerkt naarmate elke batch is voltooid (~80 sleutels per update). Wanneer `contentDir` is ingesteld, benoemt sync de map en waar de vertalingen naartoe gaan; het zegt alleen `Detected framework: Hugo` wanneer het een echte Hugo-site vindt (`hugo.toml`, een `config.toml` met Hugo-instellingen, `archetypes/`, …). Formaatdetectie onderscheidt `(auto)` van `(config)` om te verduidelijken hoe het formaat is opgelost.

**Uitvoermodi**: `--quiet` onderdrukt informatieve uitvoer (alleen fouten en waarschuwingen). `--json` zendt machineleesbare NDJSON uit voor CI/CD-pipelines.

## Verharding

- **Exponentiële backoff** — 3 nieuwe pogingen met jitter bij 429/5xx-fouten
- **30s verzoek-timeout** — AbortController voorkomt vastlopen
- **Responsvalidatie** — accepteert alleen sleutels die voor vertaling zijn verzonden
- **Kwaliteitscontrole** — vangt hallucinatie-lussen, uitvoer in verkeerd schrift, lengte-inflatie en bronecho's op
- **Retry-cascade** — bij een JSON-parseerfout wordt de batch opnieuw geprobeerd → halve batch → individuele sleutels (budget-begrensd via `maxRetries`)
- **Translation Memory** — `.champollion/tm.json` cachet vertalingen op basis van brontekst + locale + methode; ongewijzigde sleutels worden bij volgende synchronisaties vanuit de cache geserveerd, waardoor overbodige API-aanroepen worden geëlimineerd
- **Prompt-caching** — de splitsing van systeem-/gebruikersberichten maakt caching op providerniveau mogelijk, wat de tokenkosten over batches heen verlaagt
- **Terminologiehandhaving** — gecoachte vertalingen worden geverifieerd aan de hand van woordenboektermen nadat de LLM reageert
- **Prototype pollution-beveiliging** — blokkeert `__proto__`, `constructor`, `prototype`
- **Pad-insluiting** — het wegschrijven van bestanden wordt gevalideerd om binnen de geconfigureerde mappen te blijven
- **Blokbescherming** — codeblokken, shortcodes en HTML worden afgeschermd tijdens de vertaling van inhoud
- **Fail-loud-architectuur** — vertaalfouten werpen altijd een uitzondering op met bruikbare foutmeldingen, en schrijven nooit stilletjes rommel weg
- **Post-sync-verificatie** — het `verify`-commando leest weggeschreven bestanden opnieuw en bevestigt dat vertalingen aanwezig zijn, in het juiste schrift staan en dat placeholders intact zijn
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

PolyForm Noncommercial 1.0.0. De Champollion CLI is broncode-beschikbaar — gratis te installeren, te gebruiken en te wijzigen voor niet-commerciële doeleinden (onderzoek, onderwijs, gemeenschapswerk) onder de [PolyForm Noncommercial License 1.0.0](../LICENSE); gebruik voor commerciële doeleinden valt niet onder deze licentie. In gewone woorden, met voorbeelden — een school, een openbaar ziekenhuis of kliniek, een liefdadigheidsinstelling, een persoonlijk of onderzoeksproject is gedekt; het product van een winstgevend bedrijf, zoals de etalage van een winkel, is dat niet: [Wie dit mag gebruiken](https://champollion.dev/docs/getting-started/who-may-use-this) (een samenvatting, geen juridisch advies; de licentietekst is leidend). Het gepubliceerde `champollion` npm-pakket is PolyForm-Noncommercial-1.0.0; `cli/LICENSE` is de gezaghebbende licentie voor het gedistribueerde pakket. Het bijbehorende MT Eval Harness en de specificaties zijn open source, gelicentieerd onder AGPL-3.0-or-later — met een §7 eval-standard-plugin-uitzondering — in de openbare [harness-repository](https://github.com/gamedaysuits/Champollion).
