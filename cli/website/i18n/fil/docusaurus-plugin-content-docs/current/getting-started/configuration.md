---
sidebar_position: 3
title: "Konfigurasyon"
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

# Konfigurasyon

Gumagana ang Champollion nang zero-config — awtomatiko nitong natutukoy ang mga locale file, format, at target na wika mula sa inyong project. Para sa mas maraming kontrol, gumawa ng `champollion.config.json` sa root ng inyong project, o patakbuhin ang:

```bash
npx champollion init
```

## Buong Config Reference

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

:::note[Hindi pa naipapatupad ang typegen]
Kinikilala at pinapanatili ng config loader ang config block na `typegen`, ngunit hindi pa naipapatupad ang TypeScript type generation. Placeholder ito para sa nakaplanong feature. Walang epekto ang pagtatakda ng mga value na ito.
:::


### Mga Field

| Field | Uri | Default | Paglalarawan |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Bersyon ng config schema. Palaging `3`. |
| `inputLocale` | `string` | `"en"` | Code ng pinagmulang wika (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Path patungo sa mga locale file. Ini-scan ng Champollion ang direktoryong ito. |
| `contentDir` | `string` | `null` | Direktoryo ng nilalaman ng Hugo. Pinapagana ang pagsasalin ng katawan ng Markdown. |
| `translatableFields` | `string[]` | `null` | I-override ang mga default na naisasaling frontmatter field para sa pagsasalin ng nilalaman. Gumagamit ang `null` ng mga built-in na default (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Format ng file: `json`, `toml`, `yaml`, o `auto` (nade-detect mula sa extension). |
| `model` | `string` | `"google/gemini-3.5-flash"` | Default na modelo para sa mga pamamaraan ng LLM. Tumatanggap ng buong OpenRouter slugs (`provider/model`) o maiikling alias mula sa `shared/model-aliases.json` (hal., `gemini-flash`). Gumagamit ng mga payak na pangalan ang mga direktang provider (hal., `gpt-4o`). |
| `temperature` | `number` | `0.3` | Temperatura ng LLM (0.0–2.0). Mas mababa = mas deterministic. |
| `defaultMethod` | `string` | `"llm"` | Default na pamamaraan ng pagsasalin: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. Ino-override ng `--method` CLI flag. |
| `batchSize` | `number` | `80` | Mga key bawat batch ng pagsasalin. Mas mataas = mas kaunting tawag sa API, ngunit mas malalaking prompt. |
| `coachingFile` | `string` | `null` | Path patungo sa isang free-text na coaching prompt file (relative sa root ng proyekto). Binabasa ang mga nilalaman sa startup at inilalagay sa system prompt bilang isang `Coaching guidance:` block. |
| `promptContext` | `string` | `null` | String ng konteksto ng application na inilalagay sa system prompt (hal., "E-commerce product descriptions"). Tumutulong sa modelo na iangkop ang mga pagsasalin sa inyong domain. |
| `jsonConcurrency` | `number` | `200` | Max na parallel na pagsasalin ng locale para sa pag-sync ng JSON key. Ino-override ng `--json-concurrency` CLI flag. |
| `contentConcurrency` | `number` | `48` | Max na parallel na tawag sa API para sa pagsasalin ng nilalaman (Markdown/MDX). Ino-override ng `--content-concurrency` CLI flag. |
| `fallbackPrefix` | `string` | `"[EN] "` | Marker prefix na ginagamit ng `audit` at `verify` upang ma-detect ang mga legacy na hindi naisaling value mula sa mga nakaraang pagpapatakbo. Hindi isinusulat ng Champollion ang prefix na ito — binabasa lamang nito ito para sa pag-detect. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Pangalan ng environment variable para sa API key. I-override para sa mga custom na pangalan ng env var. |
| `minContentRetention` | `number` | `0.35` | Bahagi ng mga titik/numero ng pinagmulan na dapat panatilihin ng isang output bago sumangguni ang [pagsusuri sa pagtanggal ng nilalaman](/docs/concepts/quality-gate) sa ikalawang signal nito. Maaari ring i-set bawat pares at bawat wika. |
| `noTranslate` | `string[]` | `[]` | Mga dot-path key at glob pattern na ang value ay kinokopya sa bawat locale nang verbatim. Tingnan ang [Mga No-Translate Key](#no-translate). Tinatanggap din bilang `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Ituring ang mga source value na walang iba kundi isang `scheme://` URL bilang no-translate. I-set ang `false` upang ipadala ang mga URL-valued key sa translation backend. |
| `baseUrl` | `string` | `""` | Base URL para sa pagbuo ng SEO artifact (hreflang, mga sitemap, JSON-LD). |
| `pairs` | `object` | `{}` | Mga override sa pamamaraan, modelo, at kalidad bawat pares. Tingnan ang [Kumpigurasyon ng Pares](#pair-configuration). |
| `languages` | `object` | `{}` | Mga override bawat wika. Tingnan ang [Kumpigurasyon ng Wika](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Source directory para sa lint scanning. `null` = auto-detect mula sa framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Mga glob pattern na ibubukod mula sa lint. |
| `lint.minLength` | `number` | `2` | Minimum na haba ng string upang i-flag bilang hardcoded. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Template ng URL pattern para sa pagbuo ng hreflang tag. |
| `seo.pages` | `string[]` | `null` | Tahasang listahan ng pahina para sa SEO. `null` = auto-detect mula sa mga locale key. |
| `typegen.output` | `string` | `null` | Output path para sa mga binuong TypeScript type. `null` = naka-disable. |
| `typegen.autoGenerate` | `boolean` | `false` | Awtomatikong buuin muli ang mga type pagkatapos ng bawat pag-sync. |

## Mga No-Translate Key {#no-translate}

Ang ilang mga value ay may iisang tamang rendering sa bawat wika: isang URL, isang repository path, isang pangalan ng package, isang product identifier. Ang tamang pagsasalin ng `https://example.org/paper` ay `https://example.org/paper`.

Tinutanggihan ng [quality gate](/docs/concepts/quality-gate) ng Champollion ang source-echo — isang pagsasalin na kapareho ng pinagmulan nito — dahil karaniwan itong nangangahulugan na tumatanggi ang modelo na gawin ang trabaho. Para sa mga key na ito, ginagawa nitong ang tamang sagot ang siyang tinatanggihan, at walang output na maaaring gawin ang modelo na makakapasa. Natututunan ng mga mas mahihinang modelo na talunin ang gate sa pamamagitan ng pagbabago sa value nang sapat lamang (isang gawa-gawang `#fragment`, isang ligaw na trailing slash, isang hindi nakikitang zero-width space), na nagreresulta sa mga sirang link. Ibinabalik ng mga mas malalakas na modelo ang value nang walang pagbabago at bumabagsak sa gate, kaya ang `sync` ay nag-e-exit nang non-zero sa bawat pagpapatakbo.

Sa halip, ideklara ang mga key na iyon:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Ang isang tumutugmang key ay **kinokopya mula sa source locale nang verbatim** — hindi kailanman ipinapadala sa isang translation backend, hindi kailanman isinasailalim sa quality gate, hindi kailanman binibilang bilang isang pagkabigo, at hindi kailanman sinisingil. Ibinubukod ito mula sa pre-run cost estimate sa parehong dahilan.

### Syntax ng pattern

Ang mga pattern ay mga dot-path sa ibabaw ng flattened key space, na may dalawang wildcard:

| Pattern | Tumutugma sa | Hindi tumutugma sa |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (eksaktong path) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (isang `url` leaf sa anumang lalim) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

Ang `*` ay tumutugma sa loob ng iisang segment; ang `**` ay tumutugma sa zero o higit pang buong segment.
Ang isang pattern na walang wildcard ay isang eksaktong key path.

### Ang mga URL ay pinangangasiwaan bilang default

Dahil ang isang URL-valued key ay walang tamang kalalabasan sa ilalim ng gate,
ang `noTranslateUrls` ay `true` out of the box: anumang source value na walang iba kundi
isang absolute na `scheme://` URL ay itinuturing bilang no-translate nang walang kumpigurasyon.

Ang pag-detect ay sadyang ginawang makitid — ang buong trimmed value ay dapat na ang URL.
Ang mga teksto na naglalaman lamang ng isang link (`"Read the paper at https://…"`) ay
isinasalin pa rin nang normal.

I-off ito gamit ang `"noTranslateUrls": false` kung ang inyong mga URL ay talagang
locale-specific (halimbawa, mga documentation host bawat wika) — pagkatapos ay ideklara
ang mga hindi locale-specific gamit ang `noTranslate`.

### Pag-aayos at pagpapatupad

Para sa isang no-translate key, mayroon lamang iisang tamang target value, kaya anumang
pagkakaiba ay isang depekto. Ipinapatupad iyan ng Champollion sa parehong direksyon:

- **Inaayos ito ng `sync`.** Ang isang no-translate key na ang target ay nawawala,
  may `[EN] `-prefix, o binago ay isinusulat muli mula sa pinagmulan. Wala itong gastos na API
  call, at ito ay idempotent: kapag tumugma na ang mga value, tuluyan nang lalaktawan ng mga susunod na pag-sync ang key.
- **Bumabagsak dito ang `verify` at `integrity`.** Ang isang nagbagong no-translate key ay
  iniuulat bilang `NO-TRANSLATE DRIFT` kasama ang inaasahan at aktwal na mga value —
  ang mga hindi nakikitang character ay naka-escape bilang `\uXXXX`, dahil ang ganoong uri ng katiwalian ay
  imposibleng makita sa isang diff. Ang `champollion integrity` ay nag-e-exit ng `1`, kaya ang isang
  build na nakakonekta rito ay nahuhuli ang isang sirang URL bago ito mai-ship.

Kung ang `integrity` ay bumagsak sa ganitong paraan sa isang proyekto na inyo pa lamang na-configure, ito ay
nag-uulat ng pinsala na naroon na sa inyong mga locale file. Patakbuhin ang `champollion sync`
nang isang beses upang ayusin ito.

## Conversion ng Script {#script-conversion}

Ang ilang mga wika na isinasalin ng Champollion ay maaaring *isulat* sa higit sa isang paraan. Palaging gumagana ang modelo sa **working script** ng wika (Latin romanization — SRO para sa Plains Cree, Okrand romanization para sa Klingon), at ang isang deterministic na converter ay maaari pagkatapos na isulat muli ang output sa isang display script. Kung dapat ba itong gawin ay isang desisyon na ginagawa ng config — **hindi kailanman isang default**:

| Locale | Working script | Maaaring i-convert sa | Uri |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabics) | Tunay na Unicode — **kinakailangan ang pagpili** |
| `sr` / `srp` (Serbian) | `Latn` | `Cyrl` (Cyrillic) | Tunay na Unicode — **kinakailangan ang pagpili** |
| `tlh` (Klingon) | `Latn` (romanization) | `Piqd` (pIqaD) | PUA — opt-in |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — opt-in |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — opt-in sa pamamagitan ng `"script": "x-kryptonian"` |

**Kinakailangan ang pagpili para sa mga Real-Unicode na pares (crk, sr).** Ang Cree Syllabics at Cyrillic ay mga ordinaryong Unicode — nagre-render ang mga ito kahit saan — at parehong ginagamit sa totoong buhay ang mga ortograpiyang ito. Hindi pipiliin ng Champollion ang sistema ng pagsulat ng isang komunidad para sa isang proyekto: nagtatanong ang `init` kapag pinili ninyo ang wika, at tumatanggi ang `sync` na tumakbo hanggang sa sabihin ng config kung alin:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Ang mga PUA script (tlh, x-elvish-s, x-kryptonian) ay naka-default sa romanization.** Ang pIqaD, Tengwar at Kryptonian ay *wala sa Unicode* — naglalabas ang mga converter ng mga Private Use Area codepoint na hindi nagre-render bilang anuman maliban na lamang kung mag-ship kayo ng font na naka-map sa mga codepoint na iyon. Ang romanization ang tanging output na nagre-render kahit saan, kaya ito ang default. Upang ilabas ang display script sa halip:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…at patakbuhin ang `champollion fonts install` upang ang inyong site ay magkaroon ng font na makakaguhit nito. Kung ang inyong mga font ay naka-key sa Latin transliteration (maraming conlang font ang ganito), panatilihin ang default.

Tumatanggap ang `script` ng isang ISO 15924 code, anumang casing (ang `"cans"`, `"Cans"` at `"CANS"` ay pareho lamang). Maaari rin itong i-set bawat pares, na nananaig kaysa sa antas ng wika. Ang isang hindi wastong value, o isang script na hindi kayang gawin ng locale, ay bumabagsak sa startup — bago ang anumang tawag sa API.

### Mga hindi naka-map na titik at `scriptFallback` {#script-fallback}

Isinasalin ng mga converter kung ano ang tinutukoy ng kanilang ortograpiya at wala nang iba. Ang Klingon romanization ay walang `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` o `z` — kaya ang output ng modelo na naglalaman ng isang pangngalang pantangi tulad ng "GitHub" ay hindi ganap na mako-convert. Ang Champollion ay **hindi kailanman nagsusulat ng kalahating na-convert na value**: kung ang anumang titik ay hindi ma-map, ang buong value ay mananatili sa working script, at pinapangalanan ng babala ang mga titik kasama ang linya ng config na magmamapa sa mga ito.

Ang mga pagmamapang iyon ay sa inyo upang ideklara:

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

Pinapalitan ng bawat panuntunan ang isang working-script sequence ng isa na *kayang* i-map ng converter, bago tumakbo ang conversion. Ang mga panuntunan ay bini-validate sa startup — ang isang pamalit na siya mismong hindi ma-map ay tinatanggihan.

Ang Champollion ay **walang kasamang sariling mga fallback rule**: ang pag-imbento ng mga ortograpikong adaptasyon, lalo na para sa sistema ng pagsulat ng isang totoong wika, ay hindi desisyon na dapat gawin ng isang index. Ang mga komunidad at fandom ay may mga kumbensyon — sadyang gamitin ang mga ito, bawat proyekto.

### Pag-aayos ng hindi gustong conversion {#repair-script}

Bago ang 0.3.0, ang conversion ay walang kondisyon — ang mga proyekto na nagta-target sa mga PUA locale ay nakakuha ng hindi ma-render na output gusto man nila ito o hindi. Dalawang tool ang nagsasara sa loop:

- Ini-scan ng **`champollion repair-script`** ang mga locale na ang config ay nagsasabing *naka-off* ang conversion para sa mga PUA codepoint at ibinabalik ang romanization gamit ang sariling reverse table ng converter (`--dry` upang i-preview). Eksaktong nare-reverse ang pIqaD; nawawala ang capitalization sa mga reversal ng Tengwar at Kryptonian at sinasabi ito.
- Bumabagsak ang **`champollion integrity`** (exit 1) sa PUA na natagpuan kung saan naka-off ang conversion — kaya nahuhuli ng isang build gate ang hindi ma-render na teksto bago ito mai-ship, at pinapangalanan ng ulat ang pag-aayos.

Hindi kailanman nangangailangan ng pag-aayos ang Translation Memory: nag-iimbak ito ng mga pre-conversion value, kaya ang pag-on o pag-off sa `script:` sa ibang pagkakataon ay hindi nangangailangan ng trabaho sa cache.

Nalalapat ang conversion ng script sa mga UI string (mga key-value file at Docusaurus JSON). Hindi kailanman kino-convert ang mga katawan ng Markdown — ang isang greedy character converter ay walang ligtas na daan sa mga code span, URL at front matter.

## Pair Configuration {#pair-configuration}

Maaaring i-configure nang magkahiwalay ang bawat source→target pair:

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

### Mga Pair Field

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `method` | `string` | Translation method: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | Pangalan ng isang naka-install na plugin (mula sa `.champollion/methods/`) |
| `model` | `string` | I-override ang default na model para sa pair na ito |
| `temperature` | `number` | I-override ang default na temperature para sa pair na ito |
| `batchSize` | `number` | I-override ang default na batch size para sa pair na ito |
| `register` | `string` | Override para sa register/tone (preset key o freeform text) |
| `endpoint` | `string` | Remote API endpoint URL. Kinakailangan kapag ang `method` ay `api`. |
| `coachingFile` | `string` | Path papunta sa isang coaching prompt file para sa pair na ito |
| `promptContext` | `string` | Application context para sa pair na ito |
| `qualityTier` | `string` | Display tier: `standard`, `high`, `research`, `verified` |

## Language Configuration {#language-configuration}

Tumatanggap ang mga wika ng tatlong format:

### Array ng mga code (pinakasimple)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Nakukuha ng bawat wika ang default register nito mula sa built-in register table. Ang mga wikang walang default ay nakakakuha ng `"Professional register."`.

### Object na may mga register string

Maaaring ang value ay isang **preset key** mula sa card ng wika, o custom na register text:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Sinusuri ng Champollion kung tumutugma ang string sa isang preset key sa language card. Kung oo, ginagamit ang buong register prompt mula sa card. Kung hindi, ginagamit ang string nang as-is. Tingnan ang [Mga Sinusuportahang Wika](/docs/reference/supported-languages#language-cards) para sa mga available na preset.

### Object na may buong config

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

Maaari ninyong paghaluin ang shorthand at buong objects sa parehong block.


### Mga Language Field

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `register` | `string` | Mga tagubilin sa istilo/tono. Maaaring isang **preset key** (hal., `casual-tu`, `formal-hapsyo`) o custom na teksto. Tingnan ang [Mga Language Card](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Pangalan ng wika na nababasa ng tao (para sa pagpapakita ng status) |
| `model` | `string` | I-override ang default na modelo |
| `temperature` | `number` | I-override ang default na temperatura |
| `batchSize` | `number` | I-override ang default na laki ng batch |
| `coachingFile` | `string` | Path patungo sa isang coaching prompt file para sa wikang ito |
| `promptContext` | `string` | Konteksto ng application para sa wikang ito |
| `maxRetries` | `number` | Maximum na badyet sa pag-retry para sa mga nabigong batch (default: 3) |
| `script` | `string` | ISO 15924 code ng ortograpiya na isinusulat ng Champollion (hal. `"Cans"`, `"Piqd"`). Tingnan ang [Conversion ng Script](#script-conversion). |
| `scriptFallback` | `object` | Mga panuntunan sa transliterasyon para sa mga titik na hindi ma-map ng script converter. Tingnan ang [Conversion ng Script](#script-conversion). |

:::info[Inheritance chain]
Nare-resolve ang mga setting sa ganitong pagkakasunod-sunod (unang tumugma ang mananaig):

**pair-level** → **language-level** → **global config** → **defaults**

Halimbawa, kung nagtatakda ang `pairs["en:fr"]` ng `model`, ino-override nito kapwa ang language-level at global na mga value ng `model`.
:::

## Source na Hindi English

Kung hindi English ang inyong source language:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Lock File

Gumagawa ang Champollion ng `.champollion.lock` upang subaybayan ang mga SHA-256 hash ng naisaling source values. **I-commit ang file na ito** upang magkaroon ang lahat ng developer ng parehong translation baseline.

Kapag nagbago ang isang source value, hindi na tumutugma ang hash, at muling isasalin ng champollion ang key na iyon sa susunod na sync.

## `.champollionignore`

Gumawa ng `.champollionignore` sa root ng inyong project upang ibukod ang mga file mula sa pag-scan ng `lint`. Gumagamit ito ng mga glob pattern, tulad ng `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Direktoryong `.champollion/`

Gumagawa ang Champollion ng directory na `.champollion/` sa root ng inyong project para sa internal state. Sa pangkalahatan, dapat ninyo itong **idagdag sa `.gitignore`** — lokal na optimization ito, hindi project source:

```gitignore
.champollion/
```

| File | Layunin | I-commit? |
|------|---------|--------|
| `tm.json` | Translation Memory cache — nag-iimbak ng mga nakaraang salin na naka-key ayon sa source text + locale + method | Hindi (lokal na cache) |
| `xliff/*.xliff` | Mga XLIFF export file para sa pagsusuri ng propesyonal na tagasalin | Hindi (transient) |
| `methods/` | Mga naka-install na method plugin manifest | Oo (shared config) |
| `backups/` | Mga pre-wrap backup (ginawa ng `wrap --undo`) | Hindi (safety net) |

Tingnan ang [Translation Memory](/docs/concepts/translation-memory) para sa mga detalye tungkol sa `tm.json` at kung paano ito nakakatipid ng gastos sa API.

---

## Programmatic API

Para sa mga build script at custom integration, direktang mag-import mula sa package:

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

### Mga Available na Export

| Export | Ginagawa Nito |
|--------|-------------|
| `TranslationMethod` | Base class para sa lahat ng method |
| `LLMMethod` | Base class para sa mga LLM method (OpenRouter) |
| `DirectLLMMethod` | Base class para sa mga direct LLM provider (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Mga direct LLM provider class |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Mga traditional MT class |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Coached LLM (OpenRouter + coaching data) |
| `APIMethod` | Remote API client |
| `runSync`, `runContentSync` | Buong sync pipeline |
| `resolveConfig`, `resolvePairs` | Config resolution |
| `validateTranslations` | Quality gate |
| `loadCoachingData`, `findDictionaryMatches` | Mga coaching utility |

### Custom Provider Extension

I-extend ang `DirectLLMMethod` upang magdagdag ng bagong LLM provider sa ~40 linya:

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

Makukuha ninyo ang translate, coaching, retry loops, model validation, quality tiers, at setup help nang walang karagdagang pagpapatupad. Ang HTTP request shape lang ang partikular sa provider. Para sa mga non-LLM adapter na gumagamit ng raw `fetch()`, gamitin ang shared helper na `fetchWithRetry()` mula sa `lib/methods/fetch-with-retry.js` sa halip na magsulat ng sarili ninyong retry loop.

---

## Tingnan Din

- [CLI Reference](/docs/reference/cli) — lahat ng command at flag
- [Translation Methods](/docs/guides/translation-methods) — pagpili at paghahalo ng mga method
- [Translation Memory](/docs/concepts/translation-memory) — caching at pagtitipid sa gastos
- [Paggawa kasama ang mga Propesyonal na Tagasalin](/docs/guides/professional-translators) — XLIFF workflow
- [Plugin Specification](/docs/reference/plugin-spec) — format ng method plugin manifest
- [Architecture](/docs/concepts/architecture) — kung paano magkakaugnay ang mga bahagi
- [Mga Sinusuportahang Wika](/docs/reference/supported-languages) — built-in language support
- [Paano Gumagana ang Sync](/docs/concepts/how-sync-works) — ang translation pipeline
