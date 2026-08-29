---
sidebar_position: 3
title: "Configuratie"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Configuratie

Champollion werkt zonder configuratie — het detecteert automatisch localebestanden, indeling en doeltalen vanuit uw project. Voor meer controle maakt u `champollion.config.json` aan in de hoofdmap van uw project, of voert u het volgende uit:

```bash
npx champollion init
```

## Volledige configuratiereferentie

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen is nog niet geïmplementeerd]
Het `typegen` configuratieblok wordt herkend en bewaard door de configuratielader, maar het genereren van TypeScript-typen is nog niet geïmplementeerd. Dit is een tijdelijke aanduiding voor een geplande functie. Het instellen van deze waarden heeft geen effect.
:::


### Velden

| Veld | Type | Standaard | Beschrijving |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Versie van het configuratieschema. Altijd `3`. |
| `inputLocale` | `string` | `"en"` | Bron-taalcode (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Pad naar locale-bestanden. Champollion scant deze map. |
| `contentDir` | `string` | `null` | Hugo-contentmap. Schakelt vertaling van Markdown-body in. |
| `translatableFields` | `string[]` | `null` | Overschrijf standaard vertaalbare frontmatter-velden voor contentvertaling. `null` gebruikt ingebouwde standaarden (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Bestandsformaat: `json`, `toml`, `yaml`, of `auto` (detecteren via extensie). |
| `model` | `string` | `"google/gemini-3.5-flash"` | Standaardmodel voor LLM-methoden. Accepteert volledige OpenRouter-slugs (`provider/model`) of korte aliassen van `shared/model-aliases.json` (bijv. `gemini-flash`). Directe providers gebruiken kale namen (bijv. `gpt-4o`). |
| `temperature` | `number` | `0.3` | LLM-temperatuur (0.0–2.0). Lager = meer deterministisch. |
| `defaultMethod` | `string` | `"llm"` | Standaard vertaalmethode: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. Wordt overschreven door de `--method` CLI-vlag. |
| `batchSize` | `number` | `80` | Sleutels per vertaalbatch. Hoger = minder API-aanroepen, maar grotere prompts. |
| `coachingFile` | `string` | `null` | Pad naar een vrije-tekst coaching-promptbestand (relatief ten opzichte van de projectroot). De inhoud wordt bij het opstarten gelezen en als een `Coaching guidance:`-blok in de systeemprompt geïnjecteerd. |
| `promptContext` | `string` | `null` | Applicatiecontext-string die in de systeemprompt wordt geïnjecteerd (bijv. "E-commerce productbeschrijvingen"). Helpt het model om vertalingen af te stemmen op uw domein. |
| `jsonConcurrency` | `number` | `200` | Maximaal aantal parallelle locale-vertalingen voor JSON-sleutelsynchronisatie. Wordt overschreven door de `--json-concurrency` CLI-vlag. |
| `contentConcurrency` | `number` | `48` | Maximaal aantal parallelle API-aanroepen voor contentvertaling (Markdown/MDX). Wordt overschreven door de `--content-concurrency` CLI-vlag. |
| `fallbackPrefix` | `string` | `"[EN] "` | Marker-voorvoegsel gebruikt door `audit` en `verify` om verouderde onvertaalde waarden van eerdere uitvoeringen te detecteren. Champollion schrijft dit voorvoegsel niet — het leest het alleen voor detectie. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Naam van de omgevingsvariabele voor de API-sleutel. Overschrijven voor aangepaste namen van omgevingsvariabelen. |
| `minContentRetention` | `number` | `0.35` | Fractie van de letters/cijfers van de bron die een uitvoer moet behouden voordat de [content-deletion check](/docs/concepts/quality-gate) zijn tweede signaal raadpleegt. Ook instelbaar per paar en per taal. |
| `noTranslate` | `string[]` | `[]` | Dot-path sleutels en glob-patronen waarvan de waarde letterlijk naar elke locale wordt gekopieerd. Zie [No-Translate Keys](#no-translate). Wordt ook geaccepteerd als `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Behandel bronwaarden die uitsluitend uit een `scheme://`-URL bestaan als niet-vertalen. Stel in op `false` om sleutels met URL-waarden naar de vertaalbackend te sturen. |
| `baseUrl` | `string` | `""` | Basis-URL voor het genereren van SEO-artefacten (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Overschrijvingen per paar voor methode, model en kwaliteit. Zie [Pair Configuration](#pair-configuration). |
| `languages` | `object` | `{}` | Overschrijvingen per taal. Zie [Language Configuration](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Bronmap voor lint-scanning. `null` = automatisch detecteren via framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Glob-patronen om uit te sluiten van linting. |
| `lint.minLength` | `number` | `2` | Minimale stringlengte om als hardcoded te markeren. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | URL-patroonsjabloon voor het genereren van hreflang-tags. |
| `seo.pages` | `string[]` | `null` | Expliciete paginalijst voor SEO. `null` = automatisch detecteren via locale-sleutels. |
| `typegen.output` | `string` | `null` | Uitvoerpad voor gegenereerde TypeScript-types. `null` = uitgeschakeld. |
| `typegen.autoGenerate` | `boolean` | `false` | Automatisch types opnieuw genereren na elke synchronisatie. |

## No-Translate Keys {#no-translate}

Sommige waarden hebben in elke taal exact één correcte weergave: een URL, een
repository-pad, een pakketnaam, een product-ID. Een correcte vertaling van
`https://example.org/paper` is `https://example.org/paper`.

De [quality gate](/docs/concepts/quality-gate) van Champollion weigert
source-echo — een vertaling die identiek is aan de bron — omdat dit normaal gesproken
betekent dat een model weigert het werk te doen. Voor deze sleutels is het correcte antwoord
daardoor het afgewezen antwoord, en is er geen enkele uitvoer die het model kan produceren die wordt goedgekeurd.
Zwakkere modellen leren de gate te omzeilen door de waarde net genoeg aan te passen (een
verzonnen `#fragment`, een verdwaalde afsluitende slash, een onzichtbare zero-width space),
wat resulteert in gebroken links. Sterkere modellen retourneren de waarde ongewijzigd en falen
bij de gate, waardoor `sync` bij elke uitvoering met een non-zero status afsluit.

Declareer in plaats daarvan deze sleutels:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Een overeenkomende sleutel wordt **letterlijk gekopieerd vanuit de bron-locale** — nooit naar een
vertaalbackend gestuurd, nooit door de quality gate gehaald, nooit als een fout geteld en nooit
in rekening gebracht. Om dezelfde reden wordt deze uitgesloten van de kostenraming voorafgaand aan de uitvoering.

### Patroonsyntaxis

Patronen zijn dot-paths over de afgevlakte sleutelruimte, met twee wildcards:

| Patroon | Komt overeen met | Komt niet overeen met |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (exact pad) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (een `url`-leaf op elke diepte) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` komt overeen binnen een enkel segment; `**` komt overeen met nul of meer hele segmenten.
Een patroon zonder wildcard is een exact sleutelpad.

### URL's worden standaard afgehandeld

Omdat een sleutel met een URL-waarde geen correcte uitkomst heeft onder de gate,
is `noTranslateUrls` standaard `true`: elke bronwaarde die uitsluitend uit
een absolute `scheme://`-URL bestaat, wordt zonder configuratie behandeld als niet-vertalen.

De detectie is opzettelijk strikt — de volledige getrimde waarde moet de URL zijn.
Tekst die slechts een link bevat (`"Read the paper at https://…"`) wordt nog steeds
normaal vertaald.

Schakel dit uit met `"noTranslateUrls": false` als uw URL's daadwerkelijk
locale-specifiek zijn (bijvoorbeeld documentatiehosts per taal) — en declareer vervolgens
de URL's die dat niet zijn met `noTranslate`.

### Reparatie en handhaving

Voor een no-translate sleutel is er exact één correcte doelwaarde, dus elk
verschil is een defect. Champollion handhaaft dit in beide richtingen:

- **`sync` repareert het.** Een no-translate sleutel waarvan het doel ontbreekt,
  een `[EN] `-voorvoegsel heeft of is gewijzigd, wordt herschreven vanuit de bron. Dit kost geen API-aanroep
  en is idempotent: zodra de waarden overeenkomen, slaan latere synchronisaties de sleutel
  volledig over.
- **`verify` en `integrity` falen hierop.** Een afgeweken no-translate sleutel wordt
  gerapporteerd als `NO-TRANSLATE DRIFT` met de verwachte en werkelijke waarden —
  onzichtbare tekens worden geëscaped als `\uXXXX`, aangezien dit type corruptie
  anders onmogelijk te zien is in een diff. `champollion integrity` sluit af met `1`, zodat een
  build die hieraan is gekoppeld een gecorrumpeerde URL opvangt voordat deze wordt uitgerold.

Als `integrity` op deze manier faalt in een project dat u zojuist heeft geconfigureerd, rapporteert het
schade die al in uw locale-bestanden aanwezig was. Voer eenmalig `champollion sync`
uit om dit te repareren.

## Scriptconversie {#script-conversion}

Sommige talen die Champollion vertaalt, kunnen op meer dan één manier worden *geschreven*. Het model werkt altijd in het **werkscript** van de taal (Latijnse romanisatie — SRO voor Plains Cree, Okrand-romanisatie voor Klingon), en een deterministische converter kan de uitvoer vervolgens herschrijven naar een weergavescript. Of dit moet gebeuren, is een beslissing die in de configuratie wordt genomen — **nooit een standaardinstelling**:

| Locale | Werkscript | Converteerbaar naar | Type |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabics) | Echte Unicode — **keuze vereist** |
| `sr` / `srp` (Servisch) | `Latn` | `Cyrl` (Cyrillisch) | Echte Unicode — **keuze vereist** |
| `tlh` (Klingon) | `Latn` (romanisatie) | `Piqd` (pIqaD) | PUA — opt-in |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — opt-in |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — opt-in via `"script": "x-kryptonian"` |

**Echte Unicode-paren (crk, sr) vereisen een keuze.** Cree Syllabics en Cyrillisch zijn gewone Unicode — ze worden overal weergegeven — en beide spellingen worden daadwerkelijk gebruikt. Champollion kiest niet namens een project het schrijfsysteem van een gemeenschap: `init` vraagt ernaar wanneer u de taal selecteert, en `sync` weigert te draaien totdat de configuratie aangeeft welke:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA-scripts (tlh, x-elvish-s, x-kryptonian) gebruiken standaard romanisatie.** pIqaD, Tengwar en Kryptonian staan *niet in Unicode* — de converters genereren Private Use Area-codepoints die als niets worden weergegeven, tenzij u een lettertype meelevert dat aan deze codepoints is gekoppeld. Romanisatie is de enige uitvoer die overal wordt weergegeven, dus dit is de standaard. Om in plaats daarvan het weergavescript te genereren:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…en voer `champollion fonts install` uit zodat uw site een lettertype heeft dat dit kan weergeven. Als uw lettertypen zijn gekoppeld aan Latijnse transliteratie (zoals veel conlang-lettertypen), behoud dan de standaardinstelling.

`script` accepteert een ISO 15924-code, ongeacht het gebruik van hoofdletters of kleine letters (`"cans"`, `"Cans"` en `"CANS"` zijn hetzelfde). Het kan ook per paar worden ingesteld, wat voorrang heeft op het taalniveau. Een ongeldige waarde, of een script dat de locale niet kan produceren, resulteert in een fout bij het opstarten — vóór enige API-aanroep.

### Niet-toegewezen letters en `scriptFallback` {#script-fallback}

Converters vertalen wat hun spelling definieert en niets anders. Klingon-romanisatie heeft geen `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` of `z` — dus modeluitvoer die een eigennaam zoals "GitHub" bevat, kan niet volledig worden geconverteerd. Champollion **schrijft nooit een half-geconverteerde waarde**: als een letter niet kan worden toegewezen, blijft de volledige waarde in het werkscript, en de waarschuwing vermeldt de letters plus de configuratieregel die ze zou toewijzen.

Deze toewijzingen dient u zelf te declareren:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

Elke regel vervangt een werkscript-reeks door een reeks die de converter *wel* kan toewijzen, voordat de conversie wordt uitgevoerd. Regels worden bij het opstarten gevalideerd — een vervanging die zelf niet kan worden toegewezen, wordt afgewezen.

Champollion levert **geen eigen fallback-regels** mee: het bedenken van orthografische aanpassingen, vooral voor het schrijfsysteem van een echte taal, is niet de taak van een index. Gemeenschappen en fandoms hebben conventies — pas deze bewust toe, per project.

### Ongewenste conversie repareren {#repair-script}

Vóór 0.3.0 was conversie onvoorwaardelijk — projecten die zich richtten op de PUA-locales kregen onweergeefbare uitvoer, of ze dat nu wilden of niet. Twee tools maken de cirkel rond:

- **`champollion repair-script`** scant locales waarvan de configuratie aangeeft dat conversie *uit* staat voor PUA-codepoints en herstelt de romanisatie met behulp van de eigen omgekeerde tabel van de converter (`--dry` om een voorbeeld te bekijken). pIqaD wordt exact omgekeerd; bij Tengwar en Kryptonian gaat bij het omkeren de hoofdlettering verloren en dit wordt ook gemeld.
- **`champollion integrity`** faalt (exit 1) op PUA die wordt gevonden waar conversie uit staat — zodat een build gate onweergeefbare tekst opvangt voordat deze wordt uitgerold, en het rapport benoemt de reparatie.

Het Translation Memory heeft nooit reparatie nodig: het slaat waarden van vóór de conversie op, dus het later in- of uitschakelen van `script:` vereist geen cache-werk.

Scriptconversie is van toepassing op UI-strings (key-value bestanden en Docusaurus JSON). Markdown-bodies worden nooit geconverteerd — een gretige tekenconverter heeft geen veilige manier om door code-spans, URL's en frontmatter te navigeren.

## Paarconfiguratie {#pair-configuration}

Elk bron→doel-paar kan onafhankelijk worden geconfigureerd:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### Paarvelden

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `method` | `string` | Vertaalmethode: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | Naam van een geïnstalleerde plugin (uit `.champollion/methods/`) |
| `model` | `string` | Overschrijf het standaardmodel voor dit paar |
| `temperature` | `number` | Overschrijf de standaardtemperatuur voor dit paar |
| `batchSize` | `number` | Overschrijf de standaard batchgrootte voor dit paar |
| `register` | `string` | Register-/toonoverschrijving (vooringestelde sleutel of vrije tekst) |
| `endpoint` | `string` | URL van het externe API-eindpunt. Vereist wanneer `method` gelijk is aan `api`. |
| `coachingFile` | `string` | Pad naar een coaching-promptbestand voor dit paar |
| `promptContext` | `string` | Toepassingscontext voor dit paar |
| `qualityTier` | `string` | Weergaveniveau: `standard`, `high`, `research`, `verified` |

## Taalconfiguratie {#language-configuration}

Talen accepteren drie indelingen:

### Array van codes (eenvoudigst)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Elke taal krijgt zijn standaardregister uit de ingebouwde registertabel. Talen zonder standaard krijgen `"Professional register."`.

### Object met registerreeksen

De waarde kan een **vooringestelde sleutel** uit de taalkaart zijn, of aangepaste registertekst:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion controleert of de reeks overeenkomt met een vooringestelde sleutel in de taalkaart. Als dat het geval is, wordt de volledige registerprompt uit de kaart gebruikt. Als dat niet het geval is, wordt de reeks ongewijzigd gebruikt. Zie [Ondersteunde talen](/docs/reference/supported-languages#language-cards) voor beschikbare voorinstellingen.

### Object met volledige configuratie

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

U kunt verkorte notaties en volledige objecten door elkaar gebruiken in hetzelfde blok.


### Taalvelden

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `register` | `string` | Stijl-/tooninstructies. Kan een **vooraf ingestelde sleutel** zijn (bijv. `casual-tu`, `formal-hapsyo`) of aangepaste tekst. Zie [Language Cards](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Menselijk leesbare taalnaam (voor statusweergave) |
| `model` | `string` | Overschrijf het standaardmodel |
| `temperature` | `number` | Overschrijf de standaardtemperatuur |
| `batchSize` | `number` | Overschrijf de standaard batchgrootte |
| `coachingFile` | `string` | Pad naar een coaching-promptbestand voor deze taal |
| `promptContext` | `string` | Applicatiecontext voor deze taal |
| `maxRetries` | `number` | Maximaal budget voor nieuwe pogingen bij mislukte batches (standaard: 3) |
| `script` | `string` | ISO 15924-code van de spelling die Champollion schrijft (bijv. `"Cans"`, `"Piqd"`). Zie [Script Conversion](#script-conversion). |
| `scriptFallback` | `object` | Transliteratieregels voor letters die de scriptconverter niet kan toewijzen. Zie [Script Conversion](#script-conversion). |

:::info[Overerveringsketen]
Instellingen worden in deze volgorde opgelost (eerste wint):

**paar-niveau** → **taal-niveau** → **globale configuratie** → **standaardwaarden**

Als `pairs["en:fr"]` bijvoorbeeld `model` instelt, overschrijft dit zowel de `model`-waarden op taal- als op globaal niveau.
:::

## Niet-Engelse brontaal

Als uw brontaal geen Engels is:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Vergrendelingsbestand

Champollion maakt `.champollion.lock` aan om SHA-256-hashes van vertaalde bronwaarden bij te houden. **Commit dit bestand** zodat alle ontwikkelaars dezelfde vertaalbasis delen.

Wanneer een bronwaarde wijzigt, komt de hash niet meer overeen en vertaalt Champollion die sleutel opnieuw bij de volgende synchronisatie.

## `.champollionignore`

Maak `.champollionignore` aan in de hoofdmap van uw project om bestanden uit te sluiten van `lint`-scanning. Gebruikt globpatronen, zoals `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/`-map

Champollion maakt een `.champollion/`-map aan in de hoofdmap van uw project voor interne status. U kunt dit over het algemeen het beste **toevoegen aan `.gitignore`** — het betreft lokale optimalisatie, geen projectbroncode:

```gitignore
.champollion/
```

| Bestand | Doel | Committen? |
|------|---------|--------|
| `tm.json` | Cache voor vertaalgeheugen — slaat eerdere vertalingen op, geïndexeerd op brontekst + locale + methode | Nee (lokale cache) |
| `xliff/*.xliff` | XLIFF-exportbestanden voor beoordeling door professionele vertalers | Nee (tijdelijk) |
| `methods/` | Manifesten van geïnstalleerde methode-plugins | Ja (gedeelde configuratie) |
| `backups/` | Back-ups vóór omloop (aangemaakt door `wrap --undo`) | Nee (veiligheidsnet) |

Zie [Vertaalgeheugen](/docs/concepts/translation-memory) voor meer informatie over `tm.json` en hoe het API-kosten bespaart.

---

## Programmatische API

Voor bouwscripts en aangepaste integraties importeert u rechtstreeks vanuit het pakket:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### Beschikbare exports

| Export | Functie |
|--------|-------------|
| `TranslationMethod` | Basisklasse voor alle methoden |
| `LLMMethod` | Basisklasse voor LLM-methoden (OpenRouter) |
| `DirectLLMMethod` | Basisklasse voor directe LLM-providers (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Klassen voor directe LLM-providers |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Traditionele MT-klassen |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Coached LLM (OpenRouter + coachinggegevens) |
| `APIMethod` | Externe API-client |
| `runSync`, `runContentSync` | Volledige synchronisatiepijplijn |
| `resolveConfig`, `resolvePairs` | Configuratieresolutie |
| `validateTranslations` | Kwaliteitspoort |
| `loadCoachingData`, `findDictionaryMatches` | Coaching-hulpprogramma's |

### Uitbreiding met aangepaste provider

Breid `DirectLLMMethod` uit om een nieuwe LLM-provider toe te voegen in ~40 regels:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

U krijgt vertaling, coaching, herhaallussen, modelvalidatie, kwaliteitsniveaus en installatiehulp gratis meegeleverd. Alleen de vorm van het HTTP-verzoek is providerspecifiek. Voor niet-LLM-adapters die gebruikmaken van onbewerkte `fetch()`, gebruikt u de gedeelde `fetchWithRetry()`-helper uit `lib/methods/fetch-with-retry.js` in plaats van uw eigen herhaallus te schrijven.

---

## Zie ook

- [CLI-referentie](/docs/reference/cli) — alle opdrachten en vlaggen
- [Vertaalmethoden](/docs/guides/translation-methods) — methoden kiezen en combineren
- [Vertaalgeheugen](/docs/concepts/translation-memory) — caching en kostenbesparing
- [Werken met professionele vertalers](/docs/guides/professional-translators) — XLIFF-workflow
- [Pluginspecificatie](/docs/reference/plugin-spec) — indeling van methode-pluginmanifesten
- [Architectuur](/docs/concepts/architecture) — hoe de onderdelen samenhangen
- [Ondersteunde talen](/docs/reference/supported-languages) — ingebouwde taalondersteuning
- [Hoe synchronisatie werkt](/docs/concepts/how-sync-works) — de vertaalpijplijn
