---
sidebar_position: 7
title: "Para sa Enterprise"
description: "Paano mai-standardize ng mga organisasyon ang translation gamit ang mga pamamaraang napatunayan sa leaderboard, custom plugins, at one-command deployment."
---

# champollion para sa Enterprise

Regular na nagsasalin ng content ang inyong team. Mayroon kayong stack ng mga locale file, CI pipeline, at prosesong malamang ay may kasamang taong manual na nagpapatakbo ng Google Translate, kumokopya ng mga resulta sa JSON, at umaasang magiging maayos ang lahat. O nagbabayad kayo para sa isang TMS platform kung saan nakakandado kayo sa translation engine ng iisang vendor.

Binibigyan kayo ng champollion ng mas payapang opsyon: piliin ang tamang method para sa bawat wika — makina man o tao — at patakbuhin ang lahat sa pamamagitan ng iisang command.

## Bakit ginagamit ng mga team ang champollion

1. **Piliin ang tamang method para sa bawat wika** — makina man o tao, hindi kung ano lang ang default ng inyong vendor
2. **Mag-deploy gamit ang iisang command** — isinasalin ng `npx champollion sync` ang bawat locale, bawat format, sa bawat pagkakataon
3. **Magpalit ng mga method nang hindi binabago ang code** — pagbabago sa config, hindi migration
4. **Pagmamay-ari ninyo ang inyong pipeline** — walang vendor lock-in, walang buwanang dashboard, walang account

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

Ang French ay gumagamit ng DeepL (mas gusto ng inyong team ang European fluency nito). Ang Japanese ay gumagamit ng frontier LLM. Ang German ay gumagamit ng Google Translate (mabilis, mura, sapat ang kalidad). Ang Korean ay gumagamit ng LLM na may formal register. Ang Spanish ay dinadaan sa propesyonal na human / MTPE service sa pamamagitan ng `api` method — ang human translation ay first-class method dito, hindi idinagdag lamang. Ang Plains Cree ay gumagamit ng community-built, community-owned coached plugin.

**Parehong command. Parehong CI pipeline. Iba't ibang method bawat pair — tao man o makina. Isang config file.**

:::note[Ang mga pamamaraan para sa community-language ay soberano]
Ang Plains Cree plugin sa itaas ay hindi lamang "isa pang pamamaraan." Ang mga pamamaraan para sa Indigenous at iba pang mga wika ng komunidad ay **pagmamay-ari at pinamamahalaan ng komunidad**: hawak ng komunidad ang mga susi sa data sa likod ng mga ito, nagtatakda ng mga tuntunin ng paggamit, at anumang non-commercial (NC) corpus o pamamaraan ay ibinubukod sa mga komersyal na path bilang default. Kung komersyal ang inyong paggamit, suriin ang lisensya ng pamamaraan bago ninyo ito i-ship. Tingnan ang [Data Sovereignty](/docs/network/sovereignty/data-sovereignty).
:::

## Workflow ng Leaderboard → Deploy

:::tip[Kasama ang `champollion leaderboard` sa CLI]
Ang workflow sa ibaba ay tumatakbo sa `champollion leaderboard` command — i-browse ang [Network](/arena) leaderboard mula sa inyong terminal at mag-install ng method plugin nang direkta mula rito. Tingnan po ang [CLI reference](/docs/reference/cli#leaderboard) para sa bawat opsyon.
:::

Ang [Network](/arena) ang lugar kung saan bina-benchmark ang mga translation method gamit ang reproducible at fingerprinted scoring. Nakakakuha ang bawat method ng composite score sa maraming metric (chrF++, exact match, FST acceptance, semantic scoring). Sinusubaybayan ng leaderboard ang bawat submission.

Ang workflow:

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*Para sa ilustrasyon lamang — halimbawa ng layout ang mga row ng leaderboard sa itaas. Kasalukuyang bukas ang board para sa mga submission at wala pang published run.*

**Hindi ninyo kailangang buuin ang method. Hindi ninyo kailangang i-train ang model. Pipiliin ninyo ang method na akma sa inyong domain, budget, at license — tao man o makina — at ide-deploy ito.** Kung may mas angkop na method na lumitaw sa susunod na buwan, mapapalitan ninyo ito gamit ang iisang command.

## Ano ang Available Ngayon

Kasalukuyang dine-develop ang leaderboard-to-CLI bridge. Narito ang gumagana sa ngayon:

### Built-in methods (walang kinakailangang plugin)

| Method | Pinakamainam Para Sa | Gastos |
|--------|----------|------|
| `llm` (default) | Nakatuon sa kalidad, anumang wika | Per-token sa pamamagitan ng OpenRouter |
| `gemini` | Kalidad + free tier | Libre (limitado), pagkatapos ay per-token |
| `google-translate` | Bilis + volume | $20/M character |
| `deepl` | Mga wikang European | $25/M character |
| `llm-coached` | Mga wikang may coaching data | Per-token sa pamamagitan ng OpenRouter |
| `api` | Custom/community-hosted methods | Self-hosted |

### Plugin methods (i-install nang hiwalay)

Maaaring balutin ng custom plugins ang anumang translation logic — fine-tuned model, FST-gated pipeline, community API, o anumang iba pa na gumagawa ng JSON. Tingnan ang [Bumuo ng Plugin](/docs/tutorials/build-a-plugin).

## Enterprise Workflow

### 1. Suriin ang kasalukuyan ninyong kalidad

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. Patakbuhin ang eval harness sa mga kandidato

Hinahayaan kayo ng [eval harness](/docs/network/specifications/harness) na i-benchmark ang maraming method laban sa parehong dataset. Magpatakbo ng sweep, ihambing ang mga score, pumili ng mga winner:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. I-configure ang mga winner bawat pair

I-update ang inyong config upang gamitin ang pinakamahusay na method bawat language pair. May iba't ibang pinakamahusay na method ang iba't ibang wika — iyon ang punto.

### 4. I-integrate sa CI/CD

```bash
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

Tatlong command. Walang manual na pagsasalin. Nahuhuli ng pipeline ang mga hardcoded string, isinasalin ang mga ito gamit ang mga method na pinili ninyo, at pinapa-fail ang build kung may kulang o corrupted.

### 5. Propesyonal na review (opsyonal)

Para sa high-stakes na content, mag-export sa XLIFF para sa human review:

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

I-machine-translate ang karamihan. I-human-review ang mga kritikal na path. Magbayad lamang para sa oras ng tao kung saan ito mahalaga.

## Cost Model

Ang champollion ay **walang subscription at walang per-seat pricing**. Ang CLI ay source-available sa ilalim ng PolyForm Noncommercial 1.0.0 — libre para sa noncommercial na paggamit (pananaliksik, edukasyon, gawaing pangkomunidad); ang komersyal na paggamit ay nangangailangan ng pahintulot, kaya [makipag-ugnayan po sa amin](/get-involved) muna. Bukod doon, magbabayad lamang po kayo para sa mga translation API call:

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1,000 key × 5 locale | ~$0.50 | ~$0.30 (free tier) | ~$2.00 |
| 10,000 key × 15 locale | ~$15 | ~$8 | ~$60 |
| 50,000 key × 30 locale | ~$75 | ~$40 | ~$300 |

Ibig sabihin ng Translation Memory, magbabayad lamang kayo para sa **mga nabagong key** sa mga kasunod na sync. Kung mag-a-update kayo ng 10 string mula sa 10,000, magbabayad kayo para sa 10 pagsasalin, hindi 10,000.

## vs. Mga TMS Platform

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Pagpepresyo** | Libre para sa noncommercial na paggamit (komersyal nang may pahintulot) + mga gastos sa API | $50–$500/buwan + per-seat |
| **Vendor lock-in** | Wala — magpalit ng provider sa config | Mataas — nasa kanilang cloud ang data |
| **Pagpili ng method** | Kahit anong provider, kahit anong model, bawat pair | Kung ano ang inaalok nila |
| **CI/CD** | First-class (`lint → sync → audit`) | Plugin/webhook |
| **Mga custom method** | Plugin system, mga community plugin | Hindi suportado |
| **Quality gate** | Built-in (wrong-script, echo, length) | Iba-iba |
| **Self-hosted** | Oo (LibreTranslate, custom API) | Hindi |

Tingnan ang [buong paghahambing](/docs/guides/comparison) para sa mga detalye.

## Karagdagang Babasahin

- **[Quick Start](/docs/getting-started/quick-start)** — patakbuhin ang inyong unang sync sa loob ng 60 segundo
- **[Translation Methods](/docs/guides/translation-methods)** — ang kumpletong method menu na may decision tree
- **[CI/CD Integration](/docs/guides/ci-cd)** — i-automate sa inyong pipeline
- **[Working with Professional Translators](/docs/guides/professional-translators)** — XLIFF export/import
- **[ang Network](/arena)** — benchmark at leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — bawat config option
