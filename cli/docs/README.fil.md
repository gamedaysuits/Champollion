# Champollion

[![npm version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


Isalin ang inyong mga locale file gamit ang isang command:

```bash
npx champollion sync
```

Awtomatikong nade-detect ng Champollion ang inyong mga locale file, ang format ng mga ito, at ang mga target na wika. Isinasalin nito ang mga nawawalang key, nilalampasan ang mga tapos na, at isinusulat ang mga resulta. Ganoon lang kasimple.

> **Bahagi ng Champollion** — open-source na imprastraktura para sa mapagkakatiwalaang machine translation sa bawat wika. Ang CLI na ito ay ang deployment end ng isang mas malaking proyekto na bumubuo ng mga test set at ng mapa na nagpapakita kung sino ang makakapagsalin ng ano, gaano kahusay ang bawat paraan sa bawat uri ng teksto, at kung saan pa may mga kakulangan. Tumatakbo ito sa dalawang uri ng benchmark: mga pampublikong benchmark sa open data (malawak, mura, tinatanggap ang bawat paraan) at mga sovereign benchmark — mga lihim na test set na nililikha, pagmamay-ari, at kinokontrol ng mga komunidad, at hindi namin kailanman nakikita. Ang imprastraktura ay open-source at pinamamahalaan ng iisa; ang mga test set at ang mga paraan para sa wika ng isang komunidad ay pagmamay-ari ng komunidad na iyon. Binuo kasama ng mga komunidad, hindi kailanman kinuha (scraped) mula sa kanila — hawak nila ang mga key. Tinatanggap ang bawat paraan, tao man o makina. Tuklasin ang network sa [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## Bakit Hindi na Lang Kayo Mismo ang Gumawa ng Script?

Maaari kayong sumulat ng mabilisang script na maglu-loop sa inyong mga English key at tatawag sa Google Translate. Ginagawa ito ng karamihan sa mga developer — aabutin ito ng humigit-kumulang 30 linya. Narito kung bakit ito pumapalpak:

- **Walang change detection.** Kapag nag-update kayo ng isang English string, mananatiling luma ang salin magpakailanman. Sinusubaybayan ng Champollion ang bawat source value gamit ang mga SHA-256 hash at muling isinasalin lamang kung ano ang nagbago.
- **Walang batching.** Ang isang API call bawat key ay nangangahulugang 200 key = 200 round trip. Matalinong nagba-batch ang Champollion (maaaring i-configure, default ay 80 key/batch para sa LLM, 128 para sa Google).
- **Walang quality gate.** Ang machine translation ay nagha-hallucinate, inuulit ang source, o naglalabas ng maling script. Bini-validate ng Champollion ang bawat salin bago ito isulat — ang wrong-script, length inflation, at source echoes ay nahuhuli at nire-reject.
- **Walang format awareness.** Naka-hardcode sa JSON? Hinahawakan ng Champollion ang JSON, TOML, YAML, at Hugo Markdown (frontmatter + body) na may auto-detection.
- **Walang kaligtasan.** Nagbabantay ang Champollion laban sa prototype pollution, path traversal sa pamamagitan ng mga ginawang locale code, at pagkasira ng code block sa panahon ng pagsasalin ng Markdown.

Ang Champollion ay ang production version ng script na iyon.

> [!NOTE]
> **Kung ano ang isinasalin ng Champollion.** Tina-target ng Champollion ang **mga locale file at structured content** — mga JSON key-value pair, TOML/YAML configuration, mga Hugo Markdown page, mga XLIFF interchange document. Naka-optimize ito para sa pormal na nakasulat na teksto: mga UI string, dokumentasyon, mga opisyal na komunikasyon, mga materyal na pang-edukasyon. Hindi ito isang chatbot, real-time speech translator, o general-purpose conversational AI. Para sa bawat pares ng wika, ang paraan ng pagsasalin ay maaaring i-configure — mula sa mga komersyal na API (Google Translate, DeepL) hanggang sa mga plugin na binuo ng komunidad na na-benchmark sa pamamagitan ng [MT Eval Arena](https://champollion.dev/arena).

## Mabilisang Pagsisimula

```bash
npm install --save-dev champollion
```

### Kumuha ng API Key

Kailangan ng Champollion ng translation backend. Pumili ng isa:

| Provider | Key | Pinakamahusay para sa |
|----------|-----|----------|
| **OpenRouter** (inirerekomenda) | `OPENROUTER_API_KEY` | Mga proyektong maraming content, Markdown, 200+ na modelo |
| **OpenAI** | `OPENAI_API_KEY` | Direktang access sa GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | Direktang access sa Claude |
| **Gemini** | `GEMINI_API_KEY` | May available na libreng tier |
| **DeepL** | `DEEPL_API_KEY` | Mga wikang Europeo, suporta sa glossary |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130+ na wika, mataas na volume |

**Pinakamabilis na pagsisimula** (libre): Mag-sign up sa [aistudio.google.com](https://aistudio.google.com/apikey) para sa libreng Gemini key:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200+ na modelo): Mag-sign up sa [openrouter.ai](https://openrouter.ai), pagkatapos ay:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

Alternatibo sa **Google Translate** (mga key-value pair lamang — walang Markdown awareness):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Tandaan**: Kung `GOOGLE_TRANSLATE_API_KEY` lamang ang naka-set, awtomatikong lilipat ang champollion sa Google Translate. Walang kailangang baguhin sa config. Direktang ginagamit ang REST API — walang SDK, walang service account, walang `pip install`. Ang key lamang.

Ganoon lang kasimple. Para sa higit pang kontrol, gumawa ng config file:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Ang bawat wika ay may kasamang **mga register preset** — mga pre-built na tagubilin sa tono/pormalidad na naka-tune sa linguistic system nito (vouvoiement para sa French, Siezen para sa German, です/ます para sa Japanese, 해요체 para sa Korean). Hinahayaan kayo ng init wizard na mag-browse at pumili ng mga preset, o ipasa ang `--yes` upang tanggapin ang mga default.

### Hindi English na Source

Kung ang inyong source na wika ay hindi English:

```bash
champollion sync --source fr                      # CLI flag
```

O i-set ito nang permanente sa inyong config:

```json
{ "inputLocale": "fr" }
```

## Ano ang Ginagawa Nito

Kayo ang bahala sa i18n framework (next-intl, i18next, Hugo). Ang Champollion ang bahala sa mga translation file.

- **Multi-format** — JSON, TOML, YAML, Hugo Markdown (front matter + body), at XLIFF 1.2
- **Incremental** — Isinasalin lamang kung ano ang nagbago (pagsubaybay sa SHA-256 hash)
- **Naka-cache** — Iniimbak ng Translation Memory ang mga nakaraang resulta; walang gastos ang muling pagpapatakbo ng sync para sa mga hindi nagbagong key
- **Quality-gated** — Bini-validate ang bawat salin: hinuhuli ang mga hallucination, wrong-script output, source echoes, at length inflation
- **Content-aware** — Pinoprotektahan ng mga paraang LLM ang mga code block, shortcode, link, at interpolation variable sa panahon ng pagsasalin ng Markdown
- **Mga pipeline tool** — `lint`, `audit`, `integrity`, `seo` para sa mga CI gate
- **XLIFF interop** — I-export ang mga salin para sa propesyonal na pagsusuri sa mga CAT tool (memoQ, SDL Trados, Phrase), i-import ang mga ito pabalik
- **Minimal dependencies** — dalawang runtime dependency (better-sqlite3 para sa naka-bundle na database ng wika, mga pangalan ng locale ng CLDR); walang mga provider SDK. Nangangailangan ng Node 20+

## Higit pa sa Google Translate

Ang mabilisang pagsisimula ay magpapatakbo sa inyo gamit ang isang LLM o Google Translate. Ngunit sumusuporta ang Google Translate sa ~130 na wika. Mayroong higit sa 7,000.

**Ang pangunahing ideya ng Champollion: ang paraan ng pagsasalin ay maaaring i-configure bawat pares ng wika.** Gumamit ng Google Translate para sa French, isang LLM na may morphological coaching para sa Plains Cree, at isang community-hosted API para sa Quechua — lahat sa iisang proyekto, lahat gamit ang iisang CLI.

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

Kung malalaman ninyo kung paano isalin ang isang pares ng wika — sa pamamagitan ng prompt engineering, mga diksyunaryo ng komunidad, mga FST pipeline, o mga fine-tuned na modelo — hinahayaan kayo ng champollion na i-package ang paraang iyon bilang isang plugin at i-deploy ito kasama ng lahat ng iba pa.

> Ipinanganak mula sa pagsasalin ng isang production website sa Plains Cree, kung saan walang umiiral na off-the-shelf na API. Ang per-pair na arkitektura ay hindi teoretikal — umiiral ito dahil ang isang proyekto ay nangailangan ng Google Translate para sa French at isang coached FST pipeline para sa isang katutubong wika (Indigenous language), na tumatakbo nang magkatabi sa iisang sync command.

Hinahayaan kayo ng kasamang [MT Eval Harness](https://github.com/gamedaysuits/Champollion) na i-benchmark at ihambing ang mga diskarte sa pagsasalin, pagkatapos ay i-export ang mga gumaganang paraan bilang mga champollion plugin. Sinumang nagsasalita ng parehong wika ay maaaring bumuo, sumubok, at magbahagi ng paraan ng pagsasalin — walang kinakailangang proprietary platform.

### Piliin ang Inyong Paraan

Sumusuporta ang Champollion sa 10 paraan ng pagsasalin. Ang bawat pares ng wika ay maaaring gumamit ng magkakaibang paraan.

**Mga LLM provider** — pinakamahusay para sa kalidad, Markdown-aware, coaching-compatible:

| Paraan | Key | Ano ang Ginagawa Nito |
|--------|-----|-------------|
| `llm` (default) | `OPENROUTER_API_KEY` | LLM sa pamamagitan ng OpenRouter — 200+ na modelo, auto-routing |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + mga panuntunan sa gramatika, mga diksyunaryo, mga tala sa istilo |
| `openai` | `OPENAI_API_KEY` | Direktang OpenAI API (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Direktang Anthropic API (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Direktang Google Gemini API (Flash, Pro) — may available na libreng tier |

**Tradisyunal na MT** — pinakamahusay para sa bilis, gastos, at high-volume na mga key-value pair:

| Paraan | Key | Ano ang Ginagawa Nito |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130+ na wika) |
| `deepl` | `DEEPL_API_KEY` | DeepL API na may suporta sa glossary (30+ na wika) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100+ na wika) |
| `libretranslate` | *(self-hosted)* | Self-hosted na LibreTranslate (AGPL, libre) |

**Imprastraktura** — para sa mga custom o community-hosted na endpoint:

| Paraan | Key | Ano ang Ginagawa Nito |
|--------|-----|-------------|
| `api` | *(bawat provider)* | Thin HTTP client para sa anumang REST endpoint |

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

> **Tandaan**: Ang mga tradisyunal na paraan ng MT (Google Translate, DeepL, Microsoft Translator, LibreTranslate) ay mahusay na humahawak sa mga key-value pair ngunit hindi ligtas na maisasalin ang Markdown content. Para sa mga proyektong maraming content, inirerekomenda ang mga paraang LLM — tahasan nilang pinoprotektahan ang mga code block, shortcode, at interpolation variable.

## Mga Plugin

Ang mga plugin ay mga pre-packaged na recipe ng pagsasalin para sa mga partikular na pares ng wika. Ang mga ito ay mga JSON manifest — hindi code — na nagsasabi sa champollion kung aling paraan ang gagamitin, kung anong mga setting, at kung anong kalidad ang na-benchmark.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

Tingnan ang [website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md) para sa format ng manifest.

## Mga Command

| Command | Layunin |
|---------|---------|
| `init` | Interactive setup wizard (o `--yes` para sa mabilisang mga default) |
| `sync` | Isalin at i-sync ang lahat ng locale file |
| `watch` | Auto-sync sa mga pagbabago sa file |
| `audit` | I-flag ang mga hindi kumpletong locale (CI gate) |
| `card` | I-pretty-print ang isang language card (`card <code>`, `--json` para sa raw) |
| `register-corpus` | Magrehistro ng evaluation corpus: pumili ng lisensya + exposure tier (local-only/private/public/sealed) |
| `submit` | Magmungkahi ng index entry (review-gated) — nagpi-print ng pre-filled na GitHub issue |
| `lint` | Maghanap ng mga hardcoded string sa source code |
| `status` | Ipakita ang configuration ng pares, mga paraan, mga register, at mga quality tier |
| `provenance` | I-audit ang paglilisensya ng translation resource |
| `wrap` | I-auto-wrap ang mga hardcoded string sa mga `t()` call (may undo) |
| `seo` | Bumuo ng hreflang, sitemap.xml, o JSON-LD schema |
| `integrity` | Suriin para sa placeholder corruption, encoding, at pagkakumpleto ng ICU plural |
| `plugin` | I-install, alisin, o ilista ang mga method plugin |
| `fonts` | Mag-download ng mga web font para sa mga PUA script converter |
| `tm` | Pamahalaan ang Translation Memory cache (stats, clear, per-locale) |
| `xliff` | I-export/i-import ang XLIFF 1.2 para sa pagsusuri ng propesyonal na tagasalin |
| `models` | Ilista ang mga available na modelo para sa isang provider (`--method gemini`) |
| `verify` | Muling basahin ang mga isinulat na locale file at kumpirmahin na ang mga salin ay naroroon at tama (CI gate) |
| `leaderboard` | Ipakita ang MT leaderboard (`--pair`, `--sort`, `--install N`) |
| `doctor` | System health check: mga card, config, mga paraan, at mga converter |

Patakbuhin ang `champollion <command> --help` para sa detalyadong tulong sa anumang command.

Buong reference: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### Pre-commit gate

Ang `champollion lint` ay binuo upang maging isang commit gate: nag-e-exit ito ng `1` kapag nakahanap ito ng mga hardcoded na user-facing string at `0` kapag malinis (ang `--warn-only` ay nag-uulat nang hindi nagba-block). I-wire ito sa isang tracked hooks directory sa inyong proyekto:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

O i-trigger ito mula sa [lint-staged](https://github.com/lint-staged/lint-staged) upang tumakbo lamang ito kapag naka-stage ang mga source file:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Ilayo ang `champollion sync` sa pre-commit — gumagawa ito ng mga network API call, kaya mabagal ito sa pinakamahusay na sitwasyon at hinaharangan ang mga commit offline sa pinakamasama. Patakbuhin na lang ito sa CI o sa isang pre-push hook, na may `champollion audit` / `champollion verify` bilang gate.

## Configuration

Gumawa ng `champollion.config.json` o patakbuhin ang `champollion init`:

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

| Opsyon | Default | Paglalarawan |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Source language code |
| `localesDir` | `"./locales"` | Path patungo sa mga locale file |
| `contentDir` | `null` | Hugo content directory (nagpapagana sa pagsasalin ng Markdown) |
| `format` | `"auto"` | Format ng file: `json`, `toml`, `yaml`, o `auto` |
| `model` | `"google/gemini-3.5-flash"` | Default na modelo (OpenRouter slug). Nire-resolve ng mga direktang provider ang kanilang sariling default sa runtime. Patakbuhin ang `champollion models --method gemini` upang matuklasan ang mga available na modelo. |
| `defaultMethod` | `"llm"` | Default na paraan ng pagsasalin (na-o-override ng `--method` flag) |
| `batchSize` | `80` | Mga key bawat translation batch |
| `pairs` | `{}` | Mga override sa paraan, modelo, at kalidad bawat pares |

**Mga override bawat wika**: Ang bawat wika ay may [Language Card](../website/docs/reference/language-card-spec.md) — isa sa 50 na-curate na card na naglalaman ng mga register preset, formality system, mga panuntunan sa typography, at mga method support flag. Gumagamit ang mga card ng [two-tier architecture](../website/docs/concepts/architecture.md) (runtime + reference) para sa performance sa malaking sukat (at scale). Mag-scaffold ng bagong card gamit ang `node scripts/generate-language-card.mjs <code>`. Gumamit ng mga preset key bilang shorthand, o sumulat ng custom na register text:

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

**Zero-config mode**: Walang config file? Awtomatikong nade-detect ng Champollion ang mga locale file, format, at mga target na wika mula sa inyong proyekto.

Ang mga value ng wika ay maaaring isang preset key (hal., `"casual-tu"`), custom na register text, o isang object (buong kontrol). Ang mga pair-level override sa `pairs` ay may prayoridad kaysa sa mga setting sa antas ng wika. Patakbuhin ang `npx champollion init` upang mag-browse ng mga available na preset para sa bawat wika.

Tingnan ang [CLI Reference](../website/docs/reference/cli.md) para sa mga detalye ng setup na partikular sa framework.

## CLI Output

Kapag pinatakbo ninyo ang `sync`, ipinapakita ng champollion kung ano mismo ang nangyayari:

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

Nag-a-update ang progress bar in-place habang nakukumpleto ang bawat batch (~80 key bawat update). Ipinapakita ng framework detection ang `Hugo` kapag naka-set ang `contentDir`. Ipinagkakaiba ng format detection ang `(auto)` mula sa `(config)` upang linawin kung paano na-resolve ang format.

**Mga output mode**: Pinipigilan ng `--quiet` ang informational output (mga error at babala lamang). Naglalabas ang `--json` ng machine-readable na NDJSON para sa mga CI/CD pipeline.

## Hardening

- **Exponential backoff** — 3 pag-retry na may jitter sa mga 429/5xx na error
- **30s request timeout** — Pinipigilan ng AbortController ang pag-hang
- **Response validation** — tumatanggap lamang ng mga key na ipinadala para sa pagsasalin
- **Quality gate** — hinuhuli ang mga hallucination loop, wrong-script output, length inflation, at source echoes
- **Retry cascade** — sa pagkabigo ng JSON parse, nagre-retry ng batch → kalahating batch → mga indibidwal na key (budget-capped sa pamamagitan ng `maxRetries`)
- **Translation Memory** — kina-cache ng `.champollion/tm.json` ang mga salin na naka-key ayon sa source text + locale + paraan; ang mga hindi nagbagong key ay sineserve mula sa cache sa mga susunod na sync, na nag-aalis ng mga paulit-ulit na API call
- **Prompt caching** — ang paghihiwalay ng system/user message ay nagbibigay-daan sa provider-level caching, na nagpapababa sa token cost sa mga batch
- **Terminology enforcement** — ang mga coached na salin ay bini-verify laban sa mga termino sa diksyunaryo pagkatapos tumugon ng LLM
- **Prototype pollution guard** — hinaharangan ang `__proto__`, `constructor`, `prototype`
- **Path containment** — bini-validate ang mga file write upang manatili sa loob ng mga na-configure na direktoryo
- **Block protection** — pinoprotektahan ang mga code block, shortcode, HTML sa panahon ng pagsasalin ng content
- **Fail-loud architecture** — ang mga pagkabigo sa pagsasalin ay palaging nag-i-throw ng mga naaaksyunang error message, hindi kailanman tahimik na nagsusulat ng basura (garbage)
- **Post-sync verification** — muling binabasa ng `verify` command ang mga isinulat na file at kinukumpirma na ang mga salin ay naroroon, tamang script, at buo ang placeholder
- **Partial success** — ang isang nabigong batch ay hindi humaharang sa iba

## Pagsubok

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

**Minimal dependencies** — tingnan sa itaas.

## Lisensya

Apache-2.0. Ang Champollion CLI ay open source — libreng i-install, gamitin, baguhin, at ipamahagi muli sa ilalim ng mga tuntunin ng [Apache License, Version 2.0](../LICENSE). Ang na-publish na `champollion` npm package ay Apache-2.0; ang `cli/LICENSE` ay ang awtoritatibong lisensya para sa ipinamamahaging package. Ang kasamang MT Eval Harness at mga spec ay open source din, lisensyado ng AGPL-3.0-or-later — na may §7 eval-standard-plugin exception — sa pampublikong [harness repository](https://github.com/gamedaysuits/Champollion).
