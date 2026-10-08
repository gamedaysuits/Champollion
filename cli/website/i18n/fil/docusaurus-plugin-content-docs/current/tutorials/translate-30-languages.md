---
sidebar_position: 2
title: "Magsalin sa 30 Wika"
description: "Cookbook: palawakin ang isang proyekto mula 3 wika patungong 30 gamit ang per-pair method mixing, batching, at CI integration."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Cookbook: Magsalin ng 30 Wika

Palawakin ang isang proyekto mula sa iilang locale hanggang sa pandaigdigang saklaw. Ipinapaliwanag ng cookbook na ito ang pagpili ng method, pag-optimize ng gastos, at CI integration para sa isang tunay na multi-language deployment.

**Scenario:** Mayroon kayong SaaS app na may `en`, `fr`, `es`. Kailangan ninyong magdagdag ng 27 pang wika sa tatlong tier ng quality requirements.

---

## Hakbang 1: Ikategorya ang Inyong mga Wika

Hindi kailangan ng lahat ng 30 wika ang parehong approach. Igrupo ang mga ito ayon sa available method quality:

| Tier | Mga Wika | Method | Bakit |
|------|-----------|--------|-----|
| **Tier 1 — Premium** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | Mga market na may mataas na halaga, maselang grammar |
| **Tier 2 — Standard** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | Mataas ang volume, mahusay ang suporta ng Google |
| **Tier 3 — Coached** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + plugins | Low-resource, nangangailangan ng mahigpit na pagpapatupad ng terminology |

## Hakbang 2: Mag-configure Bawat Pair

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.8-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

**Tandaan:** Ang mga wikang hindi nakalista sa `pairs` ay magmamana ng `defaultMethod: "google-translate"`. Hindi ninyo kailangang ilista ang lahat ng 30.

:::info
Kasalukuyang dine-develop ang suporta para sa `crk` — tingnan ang [Sumuporta sa isang Low-Resource Language](/docs/network/community/low-resource-languages) para sa status at mga gabay sa pag-contribute.
:::

## Hakbang 3: I-set Up ang mga API Key

Kakailanganin ninyo ang parehong API keys para sa configuration na ito:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## Hakbang 4: Mag-Dry Run Muna

Palaging mag-preview bago magsalin ng 30 wika:

```bash
npx champollion sync --dry
```

Suriin ang output. Ipapakita nito:
- Aling mga pair ang gumagamit ng aling method
- Ilang key ang bago/binago bawat locale
- Tinatayang API calls bawat tier

## Hakbang 5: Patakbuhin ang Sync

```bash
npx champollion sync
```

Pinoproseso ng Champollion ang bawat pair nang hiwalay. Mabilis ang mga Tier 2 pair na gumagamit ng Google Translate. Mas mabagal ang mga Tier 1 LLM pair ngunit mas mataas ang kalidad. Ginagamit ng mga Tier 3 coached pair ang coaching data ng plugin.

### Incremental Updates

Pagkatapos ng initial sync, isinasalin lamang ng mga susunod na run ang mga **binago o bagong** key:

```bash
# Only keys that changed since last sync
npx champollion sync
```

Sinusubaybayan ng lock file (`.champollion.lock`) kung ano na ang naisalin, kaya hindi na ninyo kailanman kailangang isaling muli ang stable na content.

## Hakbang 6: I-audit ang Kalidad

Tingnan ang status ng lahat ng language pair:

```bash
npx champollion status
```

Inililista nito ang pamamaraan, modelo, at register ng bawat pares, ang coaching nito, at ang mga benchmark score ng plugin kapag inilalathala ang mga ito (at isang label na `qualityTier`, kung may itinakda ang inyong config).

### Nasunod ba ng output ang inyong mga register?

Sa Hakbang 2, nagdeklara kayo ng [register](/glossary#term-register) bawat wika — `"Polite/formal"` para sa Japanese, `"Formal (Sie)"` para sa German. (Bago pa ba sa inyo ang term? Ipinapaliwanag ito ng glossary sa simpleng wika.) Napupunta ang mga instruction na iyon sa translation prompt, ngunit ang prompt ay kahilingan, hindi garantiya.

Nasusukat ng [Network harness](/docs/network/specifications/harness) — ang parehong tool na nagpapatakbo sa public leaderboard — ang pagsunod sa register at style sa isang sample ng inyong mga translation. Sinusuri ng writing-style metrics nito ang bawat output laban sa inaasahang register (formal/informal markers, T–V pronouns, contractions, sentence-length drift) at nag-uulat ng `style_consistency_rate` sa kabuuan ng run. Maaari rin ninyo itong ituro sa isang custom brand-voice profile gamit ang `--style-profile`.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

Dalawang tapat na paunawa: ang mga metric na ito ay **impormasyonal** (mga diagnostic na hindi kailanman pumapasok sa headline ng chrF++ o sa ranking ng leaderboard), at ang pagtukoy sa pormalidad ay nakabatay sa marker — isang drift detector, hindi paghatol ng tao. Mga detalye at kahulugan ng metric: [Mga metric ng istilo ng pagsulat at register](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## Hakbang 7: CI Integration

Idagdag sa inyong GitHub Actions workflow upang manatiling up to date ang mga translation sa bawat push:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24

      # Pinned to the 0.5 line: a new release never changes what this job
      # runs. The CI guide has the complete workflow (the translation cache,
      # partial runs, a dry-run check and verify --strict).
      - name: Sync translations
        run: npx --yes champollion@0.5 sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## Cost Estimation

Para sa isang proyekto na may 500 source key sa 30 wika:

| Tier | Mga Wika | Method | Tinatayang Gastos |
|------|-----------|--------|-----------------|
| Tier 1 (5 wika) | ja, ko, zh, de, pt | GPT-4o | ~$2.50/full sync |
| Tier 2 (18 wika) | it, nl, pl, etc. | Google Translate | ~$0.90/full sync |
| Tier 3 (4 wika) | crk, oj, mi, haw | GPT-4o-mini coached | ~$0.40/full sync |
| **Kabuuan** | **30 wika** | **Mixed** | **~$3.80/full sync** |

Ang mga incremental sync (5–20 binagong key) ay nagkakahalaga lamang ng maliit na bahagi ng full sync.

## Tingnan Din

- [Mga Pamamaraan ng Pagsasalin](/docs/guides/translation-methods) — Paano gumagana ang bawat pamamaraan ng pagsasalin at kung kailan ito dapat gamitin
- [Pagtutukoy ng Plugin](/docs/reference/plugin-spec) — Lumikha ng coaching data para sa alinman sa inyong mga wika sa Tier 3
- [Gabay sa CI/CD](/docs/guides/ci-cd) — Mga advanced na pattern ng CI kabilang ang mga PR preview build
- [Quality Gate](/docs/concepts/quality-gate) — Paano sinusuri ng Champollion ang bawat salin para sa sirang output bago ito isulat
- [Mga Sinusuportahang Wika](/docs/reference/supported-languages) — Buong listahan ng mga code ng wika at compatibility ng pamamaraan
- [Mga metric ng istilo ng pagsulat at register](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — Sukatin ang pagsunod sa register/istilo gamit ang eval harness (mga impormasyonal na metric)
- [Glosaryo: register](/glossary#term-register) — Ang kahulugan ng "register", sa payak na pananalita
- [Suportahan ang isang Low-Resource na Wika](/docs/network/community/low-resource-languages) — Magdagdag ng coaching data para sa mga wikang walang malawak na MT coverage
