# Champollion

[![npm version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![Lisensya: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


**Nasa riles, may mga gabay.** Pagbuo at pag-deploy ng machine translation na nasa riles, binuo nang isinasaalang-alang ang mga komunidad ng wikang may limitadong yaman at mga Katutubong wika. Ang CLI na ito ay ang layer para sa proyekto at pag-deploy.

**Bumuo ng modelo para sa isang wika**, sa inyo pong sariling computer:

```bash
npx champollion new our-language --from English --to "Plains Cree"
cd our-language && npx champollion next
```

Ang isang wika na walang pamantayang code ay gumagamit ng private-use code at ng sarili nitong pangalan:
`npx champollion new our-language --from English --to qaa --target-name "Our language"`
(anumang code mula `qaa` hanggang `qtz`).

Sinisimulan ng `champollion new` ang isang proyekto na may lugar para sa lahat; sinasabi ng `champollion next` ang iisang susunod na hakbang — mula sa mga file na itinatago ng isang komunidad (mga spreadsheet, Word table, Toolbox o LIFT na diksyunaryo, ELAN na transkripsyon) patungo sa isang nasusukat na modelo at papasok sa inyo pong app. Sinasabi ng bawat hakbang kung sino ang magpapasya: ang mga taong nagtataglay ng wika ang magpapasya kung saan maaaring mapunta ang mga pangungusap nito at kung ano ang ipapadala (ships). Maaaring tahakin ng isang AI agent ang parehong mga hakbang sa pamamagitan ng [MCP server](https://www.npmjs.com/package/champollion-mcp-server). Ang mga riles ay nangangako ng proseso, hindi ng kalidad: malalaman ninyo po kung gaano kahusay ang isang modelo, hindi na ito ay mahusay — ang isang unang maliit na modelo ng komunidad ay karaniwang isang nasusukat na phrasebook. Magsimula po sa [champollion.dev/start](https://champollion.dev/start).

**Isalin ang mga locale file ng inyo pong app** gamit ang isang command:

```bash
npx champollion sync
```

Awtomatikong nade-detect ng Champollion ang inyo pong mga locale file, ang format ng mga ito, at ang mga target na wika. Isinasalin nito ang mga nawawalang key, nilalaktawan ang mga nagawa na, at isinusulat ang mga resulta — mula sa isang naka-host na engine, o mula sa isang modelo na inyo pong binuo at sineserve mismo (`champollion connect`).

**Lisensya:** source-available sa ilalim ng [PolyForm Noncommercial License 1.0.0](../LICENSE) — libreng gamitin, baguhin at ibahagi para sa mga layuning hindi komersyal (mga personal na proyekto, pananaliksik, pagtuturo, at paggamit ng mga kawanggawa, paaralan at mga pampublikong katawan). Ang paggamit nito para sa isang komersyal na layunin ay hindi saklaw ng lisensyang ito. Ang evaluation harness ay open source (AGPL-3.0-or-later). [Sino ang maaaring gumamit nito](https://champollion.dev/docs/getting-started/who-may-use-this) · [Mga Detalye](#license).

## Bakit Hindi Na Lang Ninyo Ito I-script Mismo?

Maaari po kayong magsulat ng isang mabilis na script na naglu-loop sa inyo pong mga English na key at tumatawag sa Google Translate. Ginagawa ito ng karamihan sa mga developer — tumatagal ito ng humigit-kumulang 30 linya. Narito po kung bakit ito nasisira:

- **Walang change detection.** Kapag nag-update po kayo ng isang English na string, mananatiling luma ang salin magpakailanman. Sinusubaybayan ng Champollion ang bawat source value gamit ang mga SHA-256 hash at muling isinasalin lamang kung ano ang nagbago.
- **Walang batching.** Ang isang API call bawat key ay nangangahulugang 200 key = 200 round trip. Matalinong nagba-batch ang Champollion (configurable, default na 80 key/batch para sa LLM, 128 para sa Google).
- **Walang quality gate.** Ang machine translation ay nagha-hallucinate, inuulit ang source, o naglalabas sa maling script. Sinusuri ng Champollion ang bawat salin bago ito isulat — ang walang laman na output, pag-uulit ng source, mga repetition loop, paghaba ng teksto (length inflation), tinanggal na nilalaman at maling script ay nahuhuli at tinatanggihan. Nahuhuli ng gate ang sirang output, hindi ang maling kahulugan.
- **Walang format awareness.** Naka-hardcode sa JSON? Pinangangasiwaan ng Champollion ang JSON, TOML, YAML, at Hugo Markdown (frontmatter + body) na may auto-detection.
- **Walang kaligtasan.** Nagbabantay ang Champollion laban sa prototype pollution, path traversal sa pamamagitan ng mga ginawang locale code, at pagkasira ng code block sa panahon ng pagsasalin ng Markdown.

Ang Champollion ay ang production version ng script na iyon.

> [!NOTE]
> **Kung ano ang isinasalin ng Champollion.** Tina-target ng Champollion ang **mga locale file at structured content** — mga JSON key-value pair, TOML/YAML configuration, mga pahina ng Hugo Markdown, mga XLIFF interchange document. Na-optimize ito para sa pormal na nakasulat na teksto: mga UI string, dokumentasyon, mga opisyal na komunikasyon, mga materyal na pang-edukasyon. Hindi po ito isang chatbot, real-time na tagasalin ng pananalita, o general-purpose na conversational AI. Para sa bawat pares ng wika, ang paraan ng pagsasalin ay configurable — mula sa mga komersyal na API (Google Translate, DeepL) hanggang sa mga plugin na binuo ng komunidad, mga pampublikong benchmark, at mga modelo na inyo pong sinasanay at sineserve sa mga riles.

## Mabilis na Pagsisimula

```bash
npm install --save-dev champollion
```

### Kumuha ng API Key

Kailangan ng Champollion ng isang translation backend. Pumili po ng isa:

| Provider | Key | Pinakamahusay para sa |
|----------|-----|----------|
| **OpenRouter** (inirerekomenda) | `OPENROUTER_API_KEY` | Mga proyektong mabigat sa nilalaman, Markdown, 200+ na modelo |
| **OpenAI** | `OPENAI_API_KEY` | Direktang access sa GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | Direktang access sa Claude |
| **Gemini** | `GEMINI_API_KEY` | May available na libreng tier |
| **DeepL** | `DEEPL_API_KEY` | Mga wikang Europeo, suporta sa glossary |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130+ na wika, mataas na volume |

**Pinakamabilis na pagsisimula** (libre): Mag-sign up po sa [aistudio.google.com](https://aistudio.google.com/apikey) para sa isang libreng Gemini key:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200+ na modelo): Mag-sign up po sa [openrouter.ai](https://openrouter.ai), pagkatapos:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

Alternatibo sa **Google Translate** (mga key-value pair lamang — walang Markdown awareness):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Tandaan**: Kung `GOOGLE_TRANSLATE_API_KEY` lamang ang nakatakda, awtomatikong lumilipat ang champollion sa Google Translate. Walang kinakailangang pagbabago sa config. Direktang ginagamit ang REST API — walang SDK, walang service account, walang `pip install`. Ang key lamang.

Iyon na po. Para sa higit pang kontrol, gumawa ng isang config file:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Ang bawat wika ay may kasamang **mga register preset** — mga pre-built na tagubilin sa tono/pormalidad na naka-tune sa linguistic system nito (vouvoiement para sa French, Siezen para sa German, です/ます para sa Japanese, 해요체 para sa Korean). Hinahayaan po kayo ng init wizard na mag-browse at pumili ng mga preset, o ipasa ang `--yes` upang tanggapin ang mga default.

### Hindi English na Source

Kung ang inyo pong source na wika ay hindi English:

```bash
champollion sync --source fr                      # CLI flag
```

O itakda po ito nang permanente sa inyong config:

```json
{ "inputLocale": "fr" }
```

## Kung Ano Ang Ginagawa Nito

Kayo po ang bahala sa i18n framework (next-intl, i18next, Hugo). Ang Champollion ang bahala sa mga translation file.

- **Multi-format** — JSON, TOML, YAML, Hugo Markdown (front matter + body), at XLIFF 1.2
- **Incremental** — Isinasalin lamang kung ano ang nagbago (pagsubaybay sa SHA-256 hash)
- **Cached** — Iniimbak ng Translation Memory ang mga nakaraang resulta; ang muling pagpapatakbo ng sync ay walang gastos para sa mga hindi nabagong key
- **Quality-gated** — Sinusuri ang bawat salin para sa sirang output: mga repetition loop, maling-script na output, pag-uulit ng source, paghaba ng teksto (length inflation) at tinanggal na nilalaman (hindi nito sinusuri ang kahulugan)
- **Content-aware** — Pinoprotektahan ng mga pamamaraan ng LLM ang mga code block, shortcode, link, at interpolation variable sa panahon ng pagsasalin ng Markdown
- **Mga tool sa pipeline** — `lint`, `audit`, `integrity`, `seo` para sa mga CI gate
- **XLIFF interop** — I-export ang mga salin para sa propesyonal na pagsusuri sa mga CAT tool (memoQ, SDL Trados, Phrase), i-import ang mga ito pabalik
- **Minimal na mga dependency** — dalawang runtime dependency: `@translated/lara` (ang Lara provider SDK) at `cree-sro-syllabics` (Plains Cree SRO ⇄ syllabics converter ng ALTLab/NRC). Nangangailangan ng Node 20+

## Higit pa sa Google Translate

Ang mabilis na pagsisimula ay nagpapatakbo sa inyo gamit ang isang LLM o Google Translate. Ngunit sumusuporta ang Google Translate sa ~130 na wika. Mayroong higit sa 7,000.

**Ang pangunahing ideya ng Champollion: ang paraan ng pagsasalin ay configurable bawat pares ng wika.** Gamitin po ang Google Translate para sa French, isang LLM na tinuruan gamit ang inyo pong sariling mga tala sa gramatika at diksyunaryo para sa Plains Cree, at isang API na inyo pong hino-host para sa isang wika na walang serbisyong sumasaklaw — lahat sa iisang proyekto, lahat gamit ang parehong CLI.

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

Kung malalaman ninyo po kung paano isalin ang isang pares ng wika — sa pamamagitan ng prompt engineering, mga diksyunaryo ng komunidad, mga FST pipeline, o mga fine-tuned na modelo — hinahayaan po kayo ng champollion na i-package ang pamamaraang iyon bilang isang plugin at i-deploy ito kasama ng lahat ng iba pa.

> Ipinanganak mula sa pagsasalin ng isang production website sa Plains Cree, kung saan walang umiiral na off-the-shelf na API. Ang per-pair na arkitektura ay hindi teoretikal — umiiral ito dahil ang isang proyekto ay nangailangan ng Google Translate para sa French at isang tinuruang FST pipeline para sa isang Katutubong wika, na tumatakbo nang magkatabi sa parehong sync command.

Hinahayaan po kayo ng kasamang [MT Eval Harness](https://github.com/gamedaysuits/Champollion) na i-benchmark at ihambing ang mga diskarte sa pagsasalin, pagkatapos ay i-export ang mga gumaganang pamamaraan bilang mga champollion plugin. Sinumang nagsasalita ng parehong wika ay maaaring bumuo, sumubok, at magbahagi ng isang paraan ng pagsasalin — walang kinakailangang proprietary na platform.

### Piliin ang Inyo Pong Pamamaraan

Sumusuporta ang Champollion ng 10 pamamaraan ng pagsasalin. Ang bawat pares ng wika ay maaaring gumamit ng magkakaibang pamamaraan.

**Mga LLM provider** — pinakamahusay para sa kalidad, Markdown-aware, coaching-compatible:

| Pamamaraan | Key | Kung Ano Ang Ginagawa Nito |
|--------|-----|-------------|
| `llm` (default) | `OPENROUTER_API_KEY` | LLM sa pamamagitan ng OpenRouter — 200+ na modelo, auto-routing |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + mga panuntunan sa gramatika, mga diksyunaryo, mga tala sa estilo |
| `openai` | `OPENAI_API_KEY` | Direktang OpenAI API (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Direktang Anthropic API (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Direktang Google Gemini API (Flash, Pro) — may available na libreng tier |
| `local` | *(wala)* | Ang inyo pong sariling modelo sa likod ng isang OpenAI-compatible na endpoint (Ollama, vLLM, LM Studio, isang modelong sinanay gamit ang `nmt-forge`). Itakda ang `LOCAL_API_BASE` kung hindi ito nasa default ng Ollama. Ang teksto ay hindi kailanman umaalis sa inyo pong imprastraktura |

**Tradisyunal na MT** — pinakamahusay para sa bilis, gastos, at mataas na volume ng mga key-value pair:

| Pamamaraan | Key | Kung Ano Ang Ginagawa Nito |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130+ na wika) |
| `deepl` | `DEEPL_API_KEY` | DeepL API na may suporta sa glossary (30+ na wika) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100+ na wika) |
| `libretranslate` | *(self-hosted)* | Self-hosted na LibreTranslate (AGPL, libre) |

**Imprastraktura** — para sa mga custom o community-hosted na endpoint:

| Pamamaraan | Key | Kung Ano Ang Ginagawa Nito |
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
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **Tandaan**: Mahusay na pinangangasiwaan ng mga tradisyunal na pamamaraan ng MT (Google Translate, DeepL, Microsoft Translator, LibreTranslate) ang mga key-value pair ngunit hindi ligtas na maisasalin ang nilalaman ng Markdown. Para sa mga proyektong mabigat sa nilalaman, inirerekomenda ang mga pamamaraan ng LLM — tahasan nilang pinoprotektahan ang mga code block, shortcode, at interpolation variable.

## Mga Plugin

Ang mga plugin ay mga pre-packaged na recipe ng pagsasalin para sa mga partikular na pares ng wika. Ang mga ito ay mga JSON manifest — hindi code — na nagsasabi sa champollion kung aling pamamaraan ang gagamitin, kung anong mga setting, at kung anong kalidad ang na-benchmark.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

Tingnan po ang [mga reference doc](https://champollion.dev/docs/reference/plugin-spec) para sa format ng manifest.

## Mga Command

| Command | Layunin |
|---------|---------|
| `init` | Interactive na setup wizard (o `--yes` para sa mabilis na mga default) |
| `sync` | Isalin at i-sync ang lahat ng locale file |
| `serve` | I-serve ang translation stack ng proyektong ito sa pamamagitan ng HTTP (api-method contract) |
| `watch` | Auto-sync sa mga pagbabago sa file |
| `audit` | I-flag ang mga hindi kumpletong locale (CI gate) |
| `lint` | Maghanap ng mga hardcoded na string sa source code |
| `status` | Ipakita ang configuration ng pares, mga pamamaraan, mga register, at mga plugin benchmark |
| `provenance` | I-audit ang paglilisensya ng translation resource |
| `wrap` | Awtomatikong i-wrap ang mga hardcoded na string sa mga `t()` call (may undo) |
| `seo` | Bumuo ng hreflang, sitemap.xml, o JSON-LD schema |
| `integrity` | Suriin para sa pagkasira ng placeholder, encoding, at pagkakumpleto ng ICU plural |
| `plugin` | I-install, alisin, o ilista ang mga method plugin |
| `fonts` | Mag-download ng mga web font para sa mga PUA script converter |
| `tm` | Pamahalaan ang cache ng Translation Memory (mga istatistika, i-clear, i-seed, i-prune) |
| `xliff` | I-export/i-import ang XLIFF 1.2 para sa propesyonal na pagsusuri ng tagasalin |
| `models` | Ilista ang mga available na modelo para sa isang provider (`--method gemini`) |
| `verify` | Muling basahin ang mga nakasulat na locale file at kumpirmahin na ang mga salin ay naroroon at tama (CI gate) |
| `doctor` | System health check: mga card, config, mga pamamaraan, at mga converter |

Ang mga command na gumagana sa ibinahaging index at leaderboard, sa halip na sa inyo pong proyekto, ay nakapangkat sa ilalim ng `champollion network` (gumagana rin ang bawat isa nang walang prefix):

| Command | Layunin |
|---------|---------|
| `network card` | I-pretty-print ang isang language card (`network card <code>`, `--json` para sa raw) |
| `network recommend` | Gabay sa pamamaraan para sa isang pares — availability + binanggit na ebidensya (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | Ipakita ang MT leaderboard (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | Magrehistro ng isang evaluation corpus: pumili ng lisensya + exposure tier (local-only/private/public/sealed) |
| `network seal-corpus` | Mga sealed-tier crypto verb: `keygen` / `seal` / `open` (organizer-node bridge) |
| `network submit` | Magmungkahi ng isang index entry (review-gated) — nagpi-print ng isang pre-filled na GitHub issue |

Patakbuhin po ang `champollion <command> --help` para sa detalyadong tulong sa anumang command.

Buong reference: [ang mga reference doc](https://champollion.dev/docs/reference/cli)

### Pre-commit gate

Ang `champollion lint` ay binuo upang maging isang commit gate: nag-e-exit ito ng `1` kapag nakahanap ito ng mga hardcoded na user-facing string at `0` kapag malinis (nag-uulat ang `--warn-only` nang hindi hinaharangan). I-wire po ito sa isang tracked hooks directory sa inyong proyekto:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.6 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

O i-trigger po ito mula sa [lint-staged](https://github.com/lint-staged/lint-staged) upang tumakbo lamang ito kapag naka-stage ang mga source file:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Ilayo po ang `champollion sync` sa pre-commit — gumagawa ito ng mga network API call, kaya mabagal ito sa pinakamahusay na sitwasyon at hinaharangan ang mga commit offline sa pinakamasama. Patakbuhin po ito sa CI o sa isang pre-push hook sa halip, na may `champollion audit` / `champollion verify` bilang gate.

## Configuration

Gumawa po ng `champollion.config.json` o patakbuhin ang `champollion init`:

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

| Opsyon | Default | Paglalarawan |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Source na wika (code) |
| `localesDir` | `"./locales"` | Path sa mga locale file: isang file bawat wika (`fr.json`) o isang folder bawat wika (`fr/common.json`, i18next) |
| `localesPattern` | `null` | Anumang iba pang layout, hal. `"src/i18n/{ns}/{lang}.json"` (pinapalitan ang `localesDir`) |
| `contentDir` | `null` | Folder ng Markdown/MDX na isasalin (isang Hugo `content/` o anumang folder); ang bawat salin ay isinusulat sa tabi ng source nito bilang `<name>.<locale>.md` |
| `format` | `"auto"` | Format ng file: `json`, `toml`, `yaml`, o `auto` |
| `model` | `"google/gemini-3.8-flash"` | Default na modelo (OpenRouter slug). Nire-resolve ng mga direktang provider ang kanilang sariling default sa runtime. Patakbuhin ang `champollion models --method gemini` upang matuklasan ang mga available na modelo. |
| `defaultMethod` | `"llm"` | Default na pamamaraan ng pagsasalin (na-override ng `--method` flag) |
| `batchSize` | `80` | Mga key bawat translation batch |
| `pairs` | `{}` | Mga override sa pamamaraan, modelo, at kalidad bawat pares |

**Mga override bawat wika**: Ang bawat wika ay may [Language Card](https://champollion.dev/docs/reference/language-card-spec) — isa sa 50 na-curate na card na naglalaman ng mga register preset, mga sistema ng pormalidad, mga panuntunan sa typography, at mga method support flag. Gumagamit ang mga card ng [two-tier architecture](https://champollion.dev/docs/agents/rails-model) (runtime + reference) para sa performance sa malawakang paggamit (at scale). Mag-scaffold ng bagong card gamit ang `node scripts/generate-language-card.mjs <code>`. Gumamit ng mga preset key bilang shorthand, o magsulat ng custom na register text:

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

**Zero-config mode**: Walang config file? Awtomatikong nade-detect ng Champollion ang mga locale file, format, at mga target na wika mula sa inyo pong proyekto.

Ang mga value ng wika ay maaaring isang preset key (hal., `"casual-tu"`), custom na register text, o isang object (buong kontrol). Ang mga override sa antas ng pares sa `pairs` ay may prayoridad kaysa sa mga setting sa antas ng wika. Patakbuhin po ang `npx champollion init` upang mag-browse ng mga available na preset para sa bawat wika.

Tingnan po ang [CLI Reference](https://champollion.dev/docs/reference/cli) para sa mga detalye ng setup na partikular sa framework.

## CLI Output

Kapag pinatakbo ninyo po ang `sync`, ipinapakita ng champollion kung ano mismo ang nangyayari:

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

Pinapangalanan ng huling linya ng pagtatantya ang rate kung saan napresyuhan ang bawat pigura, kung saan ito nagmula at kailan (dala ng `--json` ang detalye). Ang "Translating …" ay sinasabi lamang kapag may ipapadala: ang isang dry run, o isang pagpapatakbo na walang ipapadala, ay nagsasabing sinusuri nito ang mga locale sa halip. Ang progress bar ay nag-a-update in-place habang nakukumpleto ang bawat batch (~80 key bawat update). Kapag nakatakda ang `contentDir`, pinapangalanan ng sync ang folder at kung saan napupunta ang mga salin nito; sinasabi nitong `Detected framework: Hugo` lamang kapag nakahanap ito ng totoong Hugo site (`hugo.toml`, isang `config.toml` na may mga setting ng Hugo, `archetypes/`, …). Ipinagkakaiba ng format detection ang `(auto)` mula sa `(config)` upang linawin kung paano na-resolve ang format.

**Mga output mode**: Pinipigilan ng `--quiet` ang informational na output (mga error at babala lamang). Naglalabas ang `--json` ng machine-readable na NDJSON para sa mga CI/CD pipeline.

## Pagpapatibay (Hardening)

- **Exponential backoff** — 3 pag-retry na may jitter sa mga 429/5xx na error
- **30s request timeout** — Pinipigilan ng AbortController ang pag-hang
- **Response validation** — tumatanggap lamang ng mga key na ipinadala para sa pagsasalin
- **Quality gate** — nahuhuli ang mga hallucination loop, maling-script na output, paghaba ng teksto (length inflation), at pag-uulit ng source
- **Retry cascade** — sa pagkabigo ng JSON parse, muling sinusubukan ang batch → kalahating-batch → mga indibidwal na key (budget-capped sa pamamagitan ng `maxRetries`)
- **Translation Memory** — Kina-cache ng `.champollion/tm.json` ang mga salin na naka-key ayon sa source text + locale + pamamaraan; ang mga hindi nabagong key ay sineserve mula sa cache sa mga susunod na sync, na nag-aalis ng mga paulit-ulit na API call
- **Prompt caching** — ang paghihiwalay ng system/user message ay nagbibigay-daan sa provider-level caching, na nagpapababa ng gastos sa token sa mga batch
- **Terminology enforcement** — ang mga tinuruang salin ay bini-verify laban sa mga termino sa diksyunaryo pagkatapos tumugon ng LLM
- **Prototype pollution guard** — hinaharangan ang `__proto__`, `constructor`, `prototype`
- **Path containment** — ang mga file write ay bini-verify upang manatili sa loob ng mga na-configure na direktoryo
- **Block protection** — pinoprotektahan ang mga code block, shortcode, HTML sa panahon ng pagsasalin ng nilalaman
- **Fail-loud architecture** — ang mga pagkabigo sa pagsasalin ay palaging nag-t-throw ng mga naaaksyunang mensahe ng error, hindi kailanman tahimik na nagsusulat ng basura
- **Post-sync verification** — muling binabasa ng `verify` command ang mga nakasulat na file at kinukumpirma na ang mga salin ay naroroon, tamang script, at buo ang placeholder
- **Partial success** — ang isang nabigong batch ay hindi humaharang sa iba pa

## Pagsubok (Testing)

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

**Minimal na mga dependency** — tingnan po sa itaas.

## Lisensya

PolyForm Noncommercial 1.0.0. Ang Champollion CLI ay source-available — libreng i-install, gamitin, at baguhin para sa mga layuning hindi komersyal (pananaliksik, edukasyon, gawaing pangkomunidad) sa ilalim ng [PolyForm Noncommercial License 1.0.0](../LICENSE); ang paggamit nito para sa isang komersyal na layunin ay hindi saklaw ng lisensyang ito. Sa simpleng salita, na may mga halimbawa — ang isang paaralan, isang pampublikong ospital o klinika, isang kawanggawa, isang personal o pananaliksik na proyekto ay saklaw; ang produkto ng isang negosyong kumikita, tulad ng storefront ng isang tindahan, ay hindi: [Sino ang maaaring gumamit nito](https://champollion.dev/docs/getting-started/who-may-use-this) (isang buod, hindi legal na payo; ang teksto ng lisensya ang masusunod). Ang na-publish na `champollion` npm package ay PolyForm-Noncommercial-1.0.0; ang `cli/LICENSE` ay ang awtoritatibong lisensya para sa ipinamamahaging package. Ang kasamang MT Eval Harness at mga spec ay open source, lisensyado ng AGPL-3.0-or-later — na may §7 eval-standard-plugin exception — sa pampublikong [harness repository](https://github.com/gamedaysuits/Champollion).
