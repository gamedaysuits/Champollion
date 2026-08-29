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

## 1. I-set Up ang Inyong Mga Locale File

Gumawa po ng source locale file. Sinusuportahan ng Champollion ang JSON, TOML, YAML at iba pa — tingnan po ang [CLI reference](/docs/reference/cli) para sa buong listahan:

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
```

Kumuha ng libreng Gemini key sa [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Kumuha ng OpenRouter key sa [openrouter.ai](https://openrouter.ai).

## 3. Patakbuhin ang Sync

```bash
npx champollion sync
```

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

Ang hindi nabagong key (`hero.subtitle`) ay inihahatid mula sa **Translation Memory** cache ng champollion — walang API call, walang gastos. Awtomatikong binubuo ang cache sa bawat sync at iniimbak sa `.champollion/tm.json`.

## Opsyonal: Gumawa ng Config File

Para sa higit pang kontrol, bumuo ng config file:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

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
  "model": "google/gemini-2.5-flash"
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
