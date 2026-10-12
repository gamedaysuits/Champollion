---
sidebar_position: 2
title: "Mabilisang Pagsisimula"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Quick Start

Isalin ang inyong unang locale file sa loob ng 60 segundo.

Libre ang CLI para sa di-komersyal na paggamit sa ilalim ng
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); hindi sakop ang komersyal na paggamit
ng lisensyang iyon. Sakop ang isang paaralan, isang pampublikong ospital o klinika, isang kawanggawa, o isang personal na proyekto; hindi sakop
ang storefront ng isang tindahan. Buong ipinapaliwanag ito sa [Sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this).

## 1. I-set Up ang Inyong Mga Locale File

Gumawa ng source locale file. Sinusuportahan ng Champollion ang JSON, TOML, YAML, at higit pa — tingnan ang [sanggunian ng CLI](/docs/reference/cli) para sa kumpletong listahan:

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Itakda ang Inyong API Key

Pumili ng provider at itakda ang key:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Kumuha ng libreng Gemini key sa [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Kumuha ng OpenRouter key sa [openrouter.ai](https://openrouter.ai). Para sa opsyon C, pangalanan ang inyong modelo kapag itinakda ninyo ang proyekto: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (o patakbuhin ang `sync --method local --model llama3.1`).

## 3. Patakbuhin ang Sync

```bash
npx champollion sync
```

:::note[Tinatype ninyo, o pinapatakbo ng script?]
Ang mga command sa pahinang ito ay ang mga tina-type ninyo: pinapatakbo ng `npx champollion` ang kopyang na-install ng inyong proyekto, o kaya'y ang kinukuha ng npx — ang pinakabagong release sa unang pagkakataon, at pagkatapos ay ang naka-cache na kopyang iyon. Ang isang command na pinapatakbo ng script para sa inyo — CI, isang script ng `package.json`, isang git hook — ay dapat tumukoy sa bersyon nito, `npx --yes champollion@0.5 sync`, upang ang isang bagong release ay hindi kailanman magbago sa pinapatakbo ng build (at pinipigilan ng `--yes` ang npx na huminto upang magtanong). Naka-pin ito sa ganoong paraan sa [gabay sa CI](/docs/guides/ci-cd) at sa [mga pahina ng framework](/docs/integrations/frameworks).
:::

:::tip[Gumagamit ng Gemini?]
Kung pinili ninyo ang Opsyon B (Gemini), idagdag ang `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Gagawin ng Champollion ang mga sumusunod:
1. Awtomatikong matutukoy ang `locales/en.json` bilang source
2. Hahanapin (o hihingin) ang mga target language
3. Isasalin ang lahat ng key
4. Isusulat ang `locales/fr.json`, `locales/ja.json`, atbp.
5. Gagawa ng `.champollion.lock` upang subaybayan kung ano ang naisalin na

## 4. Suriin ang Mga Resulta

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## Ano ang Susunod na Mangyayari?

Kapag binago ninyo ang isang source string, natutukoy ng champollion ang pagbabago sa pamamagitan ng SHA-256 hash tracking at muling isinasalin lamang ang key na iyon sa susunod na sync:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

Ang hindi nagbagong key (`hero.subtitle`) ay **nilalaktawan**: ang salin nito ay nasa `locales/fr.json` na, kaya hindi ito ipinapadala saanman at hindi man lang hinahanap — walang call, walang gastos, at hindi ibinibilang sa bilang ng "served from the cache" ng run.

Ang **Translation Memory** (`.champollion/tm.json`, awtomatikong binuo sa bawat pag-sync) ay para sa tekstong *nakapila*: isang string na ibinalik ninyo sa dati, ang parehong pangungusap sa ibang file, isang muling pagsasagawa sa buong locale (`sync --redo all`). Ihinahatid ang mga iyon mula sa cache nang libre, at isinasaad ng linya ng run kung ilan (`… 0 key(s) sent to the model, 12 served from the cache (free)`). Pinapanatili ang cache bawat pamamaraan, register, at coaching — para sa pares at sa fallback nito bawat isa. Pagkatapos lumipat ng pamamaraan (halimbawa `local` → `llm`), o magbago ng teksto ng coaching file (sa pares, sa wika nito, o sa fallback nito), walang muling gagamitin at isinasaad ng run kung bakit; ang pagpapalit lamang ng modelo ay muling gumagamit ng mga naunang salin. Walang muling isinasalin ang isang pagbabago nang mag-isa: tinutukoy ng `sync` ang muling pagsasagawa at ang presyo nito.

## Opsyonal: Gumawa ng Config File

Para sa higit pang kontrol, bumuo ng config file:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

Pinipili ng `--method` at `--model` ang pamamaraan ng pagsasalin at modelo (inililista ng `npx champollion init --help` ang mga pamamaraan); ipinapakita ng init kung alin ang ginagamit ng config.

Gagabayan kayo ng guided wizard sa mga **register preset** ng bawat wika — mga pre-built na tagubilin sa tono/pormalidad na nakaangkop sa sistemang lingguwistiko nito. Ang French ay may T-V presets (vouvoiement vs tutoiement), ang Korean ay may mga speech level (해요체 vs 합쇼체 vs 해체), at ang Japanese ay may mga opsyon sa keigo (です/ます vs 丁寧語).

O gumawa ng config nang manu-mano gamit ang mga preset key:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-3.8-flash"
}
```

Patakbuhin ang `npx champollion init` upang tingnan ang mga available na preset para sa bawat wika.

## Opsyonal: Watch Mode

Awtomatikong magsalin kapag nagbago ang inyong source file:

```bash
npx champollion watch
```

## Mga Susunod na Hakbang

- **[Configuration](/docs/getting-started/configuration)** — Kumpletong config reference
- **[Translation Methods](/docs/guides/translation-methods)** — Piliin ang tamang method para sa bawat pair
- **[Translation Memory](/docs/concepts/translation-memory)** — Paano kayo natitipid ng caching sa mga muling pagpapatakbo
- **[Working with Professional Translators](/docs/guides/professional-translators)** — Mag-export ng XLIFF para sa human review
- **[Framework Integration](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — I-automate ang mga translation sa inyong pipeline
- **[Troubleshooting](/docs/guides/troubleshooting)** — Mga karaniwang isyu at solusyon
