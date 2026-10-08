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
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Ang French ay gumagamit ng DeepL (mas gusto ng inyong koponan ang kahusayan nito sa European languages). Ang Japanese ay gumagamit ng isang frontier LLM. Ang German ay gumagamit ng Google Translate (mabilis, mura, sapat na ang galing). Ang Korean ay gumagamit ng isang LLM na may pormal na rehistro. Ang Spanish ay ipinapadala sa isang propesyonal na serbisyong pantao / MTPE sa pamamagitan ng pamamaraang `api` — ang pagsasalin ng tao ay isang first-class na pamamaraan dito, hindi lamang idinugtong. Ang Plains Cree ay gumagamit ng coached LLM method, kalakip ang mga tala sa balarila at diksyunaryong inyong ibibigay.

**Parehong command. Parehong CI pipeline. Iba't ibang method bawat pair — tao man o makina. Isang config file.**

:::note[May soberanya ang mga pamamaraan para sa wika ng komunidad]
Ang pares ng Plains Cree sa itaas ay hindi lamang basta isa pang pares. Ang mga pamamaraan para sa mga Katutubo at iba pang wika ng komunidad ay **pag-aari at pinamamahalaan ng komunidad**: hawak ng komunidad ang kontrol sa datos na sumusuporta sa mga ito, nagtatakda ng mga tuntunin sa paggamit, at anumang non-commercial (NC) na corpus o pamamaraan ay nakahiwalay sa mga komersyal na gamit bilang default. Kung komersyal ang inyong paggamit, suriin ang lisensya ng pamamaraan bago ninyo ito ilabas. Tingnan ang [Soberanya ng Datos](/docs/network/sovereignty/data-sovereignty).
:::

## Workflow ng Leaderboard → Deploy

:::tip[Kasama ang `champollion network leaderboard` sa CLI]
Tumatakbo ang workflow sa ibaba sa pamamagitan ng utos na `champollion network leaderboard` — i-browse ang leaderboard ng [Network](/arena) mula sa inyong terminal at mag-install ng plugin ng pamamaraan nang direkta mula rito. Tingnan ang [sanggunian ng CLI](/docs/reference/cli#leaderboard) para sa bawat opsyon.
:::

Ang [Network](/arena) ang lugar kung saan bina-benchmark ang mga pamamaraan ng pagsasalin gamit ang reproducible at fingerprinted na pagmamarka. Niraranggo ang mga pagpapatakbo sa paraang karaniwan sa larangan ng MT: sa pamamagitan ng corpus-level chrF++ kasama ang 95% confidence interval nito. Ipinapakita sa tabi nito ang BLEU, TER, at COMET, at ang mga diagnostic tulad ng exact match at FST acceptance ay hiwalay na iniuulat, kailanman ay hindi inihahalo sa pangunahing marka. Ang pagiging tunay na mas mahusay ng isang pamamaraan kaysa sa iba ay batay sa isang paired significance test, hindi sa agwat sa pagitan ng dalawang numero. Sinusubaybayan ng leaderboard ang bawat pagsusumite.

Ang workflow:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*Para sa paglalarawan lamang — ang mga hilera ng leaderboard sa itaas ay isang halimbawang layout. Sa halimbawang ito, nagpapatong ang mga interval ng unang dalawang hilera, kaya hindi ipinapahiwatig ng board na mas mahusay ang isa kaysa sa isa pa. Kasalukuyang bukas ang board para sa mga pagsusumite at wala pa itong mga nai-publish na run.*

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
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

Tatlong command. Walang manual na pagsasalin. Nahuhuli ng pipeline ang mga hardcoded string, isinasalin ang mga ito gamit ang mga method na pinili ninyo, at pinapa-fail ang build kung may kulang o corrupted.

### 5. Propesyonal na review (opsyonal)

Para sa high-stakes na content, mag-export sa XLIFF para sa human review:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

I-machine-translate ang karamihan. I-human-review ang mga kritikal na path. Magbayad lamang para sa oras ng tao kung saan ito mahalaga.

## Cost Model

Ang champollion ay **walang subscription at walang pagpepresyo bawat user**. Ang CLI ay source-available sa ilalim ng PolyForm Noncommercial 1.0.0 — libre para sa hindi pangkomersyong paggamit: pananaliksik, edukasyon, mga kawanggawa, mga pampublikong ospital at klinika, gobyerno, personal na mga proyekto. Ang paggamit nito para sa komersyal na layunin, tulad ng produkto ng isang negosyong kumikita, ay hindi saklaw ng lisensyang iyon. Suriin kung [sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this) bago ninyo ito gamitin. Bukod doon, magbabayad lamang kayo para sa mga tawag sa API ng pagsasalin:

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1,000 key × 5 locale | ~$0.50 | ~$0.30 (free tier) | ~$2.00 |
| 10,000 key × 15 locale | ~$15 | ~$8 | ~$60 |
| 50,000 key × 30 locale | ~$75 | ~$40 | ~$300 |

Ibig sabihin ng Translation Memory, magbabayad lamang kayo para sa **mga nabagong key** sa mga kasunod na sync. Kung mag-a-update kayo ng 10 string mula sa 10,000, magbabayad kayo para sa 10 pagsasalin, hindi 10,000.

## vs. Mga TMS Platform

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Pagpepresyo** | Libre para sa hindi pangkomersyong paggamit ([sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this)) + mga gastusin sa API | $50–$500/buwan + bawat user |
| **Vendor lock-in** | Wala — magpalit ng mga provider sa config | Mataas — nasa kanilang cloud ang datos |
| **Pagpili ng pamamaraan** | Anumang provider, anumang modelo, bawat pares | Kung ano lamang ang kanilang iniaalok |
| **CI/CD** | First-class (`lint → sync → audit`) | Plugin/webhook |
| **Mga custom na pamamaraan** | Plugin system, mga plugin ng komunidad | Hindi suportado |
| **Quality gate** | Built-in (maling-script, echo, haba) | Nag-iiba-iba |
| **Self-hosted** | Oo (LibreTranslate, custom na API) | Hindi |

Tingnan ang [buong paghahambing](/docs/guides/comparison) para sa mga detalye.

## Karagdagang Babasahin

- **[Quick Start](/docs/getting-started/quick-start)** — patakbuhin ang inyong unang sync sa loob ng 60 segundo
- **[Translation Methods](/docs/guides/translation-methods)** — ang kumpletong method menu na may decision tree
- **[CI/CD Integration](/docs/guides/ci-cd)** — i-automate sa inyong pipeline
- **[Working with Professional Translators](/docs/guides/professional-translators)** — XLIFF export/import
- **[ang Network](/arena)** — benchmark at leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — bawat config option
