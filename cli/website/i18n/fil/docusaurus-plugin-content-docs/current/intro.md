---
sidebar_position: 1
slug: /intro
title: "Panimula"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

Isang ganap na nako-customize na internationalization framework. Isang command ang nagsasalin ng inyong mga locale file. Isang config ang kumokontrol sa bawat method, model, at pares ng wika. At kung hindi sapat ang mga built-in na method — bumuo ng sarili ninyo, subukang gumagana ito, at i-deploy ito.

```bash
npx champollion sync
```

Awtomatikong nade-detect ng champollion ang inyong mga locale file, format, at target na wika. Isinasalin nito ang kulang, nilalaktawan ang tapos na, vina-validate ang bawat resulta, at nagsusulat ng malinis na output. Iyan ang panimulang linya.

:::info[Bahagi ng mas malaking bagay]

Ang CLI na ito po ay ang deployment end ng **Champollion** — isang imprastraktura na sumusukat sa machine translation para sa mga wikang hindi sinusukat ng iba, at naglalathala ng mga natuklasan nito. Ang bahagi ng pagsusukat ay bumubuo ng mga evaluation test set at isang pampublikong mapa kung sino ang makakapagsalin ng ano, gaano kahusay, at sa anong mga uri ng teksto; ang CLI po ay kung saan ang isang subok na pamamaraan ay nagiging isang bagay na maaari ninyong aktwal na patakbuhin.

Isang panuntunan po ang humuhubog sa lahat: ang data ng wika ay itinuturing na parang biodata, kaya ang mga taong nagbibigay ng corpus ang may hawak ng mga susi rito at sa anumang sinusukat laban dito. Ang buong larawan — kung ano ang umiiral, kung ano ang mga panuntunan, kung saan kayo nababagay — ay nasa [Ano ang Champollion](/docs/what-is-champollion), at ang bahagi ng pagsusukat ay matatagpuan sa ilalim ng [ang Network](/docs/network/).

:::

---

## Bakit Hindi Na Lang Kayo Gumawa ng Sarili Ninyong Script?

Maaari kayong magsulat ng mabilisang loop na tumatawag sa Google Translate sa bawat key. Ginagawa ito ng karamihan sa mga developer — humigit-kumulang 30 linya lang ito. Narito kung saan ito pumapalya:

- **Walang change detection.** Kapag nag-update kayo ng English string — nananatiling luma ang salin magpakailanman. Sinusubaybayan ng champollion ang bawat source value gamit ang mga SHA-256 hash at muling isinasalin lamang ang nagbago.
- **Walang batching.** Isang API call kada key ay nangangahulugang 200 key = 200 round trip. Matalinong nagba-batch ang champollion (nako-configure, default na 80 key/batch para sa LLM, 128 para sa Google).
- **Walang caching.** Muling isinasalin ng bawat sync ang lahat. Kina-cache ng Translation Memory ng champollion ang mga salin ayon sa source text + locale + method — kapag muling nagpatakbo ng sync matapos ang pagbabago sa isang key, ang key lang na iyon ang isasalin, hindi ang buong file.
- **Walang quality gate.** Nagha-hallucinate ang machine translation, inuulit lang ang source, o naglalabas sa maling script. Vina-validate ng champollion ang bawat salin bago ito isulat — nahuhuli at nire-reject ang maling script, labis na paghaba, at mga echo ng source.
- **Walang kamalayan sa format.** Naka-hardcode sa JSON? Hinahandle ng champollion ang JSON, TOML, YAML, at Hugo Markdown (frontmatter + body) gamit ang auto-detection.
- **Walang kontrol sa method.** Parehong method ang nakukuha ng bawat pares. Hinahayaan kayo ng champollion na gumamit ng Google Translate para sa French, isang LLM para sa Japanese, at custom na community-hosted pipeline para sa Cree — sa iisang config file.

Ang champollion ang production version ng script na iyon.

---

## Ano ang Naiiba Dito

### Plugin ang bawat method

Ang translation method ay **nako-configure kada pares ng wika**. Pagsamahin ang Google Translate, mga LLM, coached prompts, at custom APIs sa iisang project:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Makakakuha ang French ng Google Translate (mabilis, mura). Makakakuha ang Japanese ng premium LLM (may nuance). Makakakuha ang Plains Cree ng coached plugin na may grammar rules, dictionaries, at morphological validation. Parehong `sync` command. Parehong quality gate. Parehong CLI.

### Tingnan kung ano ang gumagana

Sa tingin ninyo ba kayang magsalin ng inyong method mula English patungong Spanish? Turkish patungong Azerbaijani? English patungong Cree?

**Buuin ito at subukan ito.** Ang kasamang [eval harness](/docs/network/specifications/harness) ay nagbe-benchmark ng anumang translation method gamit ang reproducible at fingerprinted na scoring. Itinatala ng [leaderboard](/leaderboard) ang bawat naka-publish na run, kaya makikita ng lahat kung ano ang gumagana.

Magkapareho ang plugin interface na ginagamit ng eval harness at ng production CLI. Ang method na mahusay ang score sa harness ay magagamit sa production — kung nagbibigay ng pahintulot ang komunidad na pinaglilingkuran ng wikang iyon. Para sa Indigenous at low-resource languages, mahalaga ang pahintulot na iyon. Tingnan ang [Data Sovereignty](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

# Use it locally
npx champollion sync
```

Parehong plugin. I-plug at subukan.

### Ang kumpletong toolkit

Ang champollion ay hindi lang `sync`. Isa itong kumpletong i18n pipeline:

| Command | Ginagawa Nito |
|---------|-------------|
| `sync` | Isalin ang mga kulang at luma nang key (may post-sync verification) |
| `watch` | Awtomatikong mag-sync kapag nagbago ang inyong source file |
| `lint` | I-scan ang source code para sa mga hardcoded string |
| `wrap` | Awtomatikong i-wrap ang mga hardcoded string sa mga `t()` call |
| `audit` | Ilista ang lahat ng `[EN]` fallback marker mula sa mga naunang run |
| `verify` | I-verify na naroon at tama ang mga salin (CI gate) |
| `integrity` | I-detect ang placeholder corruption, mga encoding issue, at completeness ng ICU plural |
| `seo` | Mag-generate ng mga hreflang tag, sitemap, at JSON-LD schema |
| `status` | Ipakita ang pair config, mga plugin, at benchmark score |
| `provenance` | I-audit ang licensing ng translation resource |
| `plugin` | Mag-install, mag-remove, at maglista ng mga method plugin |
| `fonts` | Mag-download ng mga web font para sa PUA script converters |
| `tm` | Pamahalaan ang Translation Memory cache (stats, clear, per-locale) |
| `xliff` | Mag-export/mag-import ng XLIFF 1.2 para sa review ng propesyonal na tagasalin |

Apat sa mga ito — `lint`, `sync`, `verify`, `audit` — ang bumubuo ng CI pipeline na humuhuli ng mga hardcoded string, nagsasalin ng mga ito, nagve-verify ng correctness, at nagpa-fail sa build kung hindi kumpleto ang anumang locale.

---

## Ang Network

Ang [Method Leaderboard](/leaderboard) po ay ang scoreboard — live, pampubliko, at bukas para sa mga isusumite. Ang bawat isinumite ay naka-fingerprint sa isang Git commit, naka-version sa isang partikular na dataset, at binibigyan ng marka ng parehong harness. Kahit sino po ay maaaring magsumite.

**Ano ang maaari ninyong buuin?** Tumatanggap ng JSON ang harness. Tumatanggap ng JSON ang mga plugin. Maaaring subukan ang anumang method na gumagawa ng JSON:

| Paraan | Halimbawa |
|----------|---------|
| **Coached LLM** | Mag-inject ng grammar rules at dictionaries sa prompt ng isang frontier model |
| **Fine-tuned model** | Mag-train ng open model sa parallel text — basta hindi sa eval data |
| **FST-gated pipeline** | Nagge-generate ang LLM → nagva-validate ng morphology ang finite-state transducer → retry |
| **Chained models** | Nagda-draft ang Model A → nagpo-post-edit ang Model B → nagso-score ang Model C |
| **Dictionary + LLM** | Ipilit ang mga kilalang term mula sa dictionary, hayaang ang LLM ang humandle sa natitira |
| **Evolutionary** | Mag-generate ng mga candidate, i-score ang mga ito, i-mutate ang pinakamahusay, ulitin |
| **Partial translation** | Magsalin ng sample nang mano-mano, patunayan na tumutugma ang inyong LLM, awtomatikong isalin ang natitira |

Mag-fine-tune ng mga model. Mag-deploy ng evolutionary algorithms. Subukan ang mga sagot ng estudyante sa mga language exam. Bumuo ng lookup tables. Pagdugtungin ang tatlong model. Hangga’t gumagawa ng JSON ang inyong method, ise-score ito ng harness at patatakbuhin ito ng framework.

:::danger[Ang iisang panuntunan]
**Huwag mag-train sa evaluation data.** Idi-disqualify ang mga method na na-expose sa benchmark dataset. Mag-fine-tune sa anumang gusto ninyo. Basta hindi sa test set.
:::

Isa itong bukas na paanyaya. Kung nagtatrabaho kayo sa isang low-resource language — bilang researcher, miyembro ng komunidad, estudyante, o isang taong nagmamalasakit — bumuo ng method, patakbuhin ang harness, at palakasin ang network para sa lahat. Hindi pa nalulutas ang problemang ito. Narito ang imprastraktura, at bukas ito.

**[→ Tingnan ang leaderboard](/leaderboard)**

---

## Mga Susunod na Hakbang

**Pagsisimula:**
- [Pag-install](/docs/getting-started/installation) — I-set up sa loob ng 2 minuto
- [Mabilisang Pagsisimula](/docs/getting-started/quick-start) — Patakbuhin ang una ninyong sync
- [Mga Sinusuportahang Wika](/docs/reference/supported-languages) — Ano ang available agad

**Pag-customize ng inyong setup:**
- [Mga Translation Method](/docs/guides/translation-methods) — Piliin ang tamang method kada pares
- [Translation Memory](/docs/concepts/translation-memory) — Paano nakakatipid sa inyo ang caching
- [Configuration](/docs/getting-started/configuration) — Kumpletong config reference
- [Hugo Multilingual Site](/docs/tutorials/hugo-multilingual-site) — Pagsasalin ng Markdown content

**Pagpapalalim:**
- [Pagtatrabaho kasama ang mga Propesyonal na Tagasalin](/docs/guides/professional-translators) — XLIFF export/import workflow
- [Soberanya ng Data](/docs/network/sovereignty/data-sovereignty) — Mga prinsipyo ng Indigenous data sovereignty: pagmamay-ari at kontrol ng komunidad sa data ng wika, CARE, at Māori Data Sovereignty
- [Suportahan ang isang Low-Resource na Wika](/docs/network/community/low-resource-languages) — Ang hamon na nagpasimula ng lahat
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — Bumuo ng isang decomposition pipeline
- [Pagsusuri ng MT](/docs/network/leaderboard/rules) — Kung paano gumagana ang harness at leaderboard
- [Method Leaderboard](/leaderboard) — Mga live na marka at isinumite
