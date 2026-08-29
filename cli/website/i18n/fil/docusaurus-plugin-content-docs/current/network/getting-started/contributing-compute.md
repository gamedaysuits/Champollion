---
sidebar_position: 4
title: "Pag-aambag ng Compute"
description: "Patakbuhin ang queue: magpatakbo ng mga open benchmark sweep mula sa public queue gamit ang sarili ninyong API key at i-publish ang mga resulta."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# Pag-aambag ng Compute

> **Ang ideya:** ang leaderboard ay may mga walang-lamang parisukat — mga kombinasyon ng (pares ng wika, pamamaraan, kondisyon) na wala pang sumusukat. Nagpapanatili po kami ng pampublikong pila (queue) para sa mga ito. Patatakbuhin po ninyo ang mga aytem gamit ang inyong sariling API key, ilalathala ang mga ulat, at mapupunan ang mapa. Ang pag-ambag ng compute ay isang tunay at maaaring sipiing (citable) kontribusyon sa pagsusuri ng MT para sa mga wikang may limitadong mapagkukunan (low-resource).

Naglalaman po ang pila ng dalawang uri ng trabaho. Sinusubok ng mga **LLM item** ang isang chat model sa isang pares ng wika, sa isang `naive` o `coached` na kondisyon ng pag-prompt. Sinusubok naman ng mga **Engine item** (kondisyong `engine`) ang isang klasikong serbisyo ng MT — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde — sa mga pares na nasa loob ng sariling inilathalang saklaw ng serbisyong iyon; ang mga ito po ang sinusukat na gulugod (backbone) ng mapa ng saklaw, at hanggang 2026-08 ay halos blangko ang mga ito. Parehong tumatakbo ang dalawang uri sa iisang harness at inilalathala sa iisang board.

## Ang queue

Ang live na pila ay isinisilbi mula sa database (binabasa ito ng harness bilang default); isang siksik na snapshot ang inilalathala sa [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json), kasama ang buong file sa [queue.json](https://champollion.dev/queue.json) (sampu-sampung MB — ang preview po ang tamang unang kunin). Maaari po ninyong panoorin kung ano ang binubuo ng inyong mga pagpapatakbo sa [live na mapa sa champollion.dev](https://champollion.dev) — ang mapa ng saklaw kung sino ang makakapagsalin ng ano. Mayroon din pong zero-install na terminal viewer:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

Ang viewer ay *nagpapakita* lamang ng mga bukas na item at ng eksaktong mga command na `mt-eval run` ng mga ito — hindi ito kailanman nagpapatakbo ng anuman o gumagastos ng inyong mga token. Bawat item ay may:

- `run_command` — handa na pong i-copy-paste (kinukuha ang corpus, pinapatakbo ang harness)
- `est_cost_usd` at `est_basis` — alinman sa **naobserbahang** gastos ng aming sariling baseline run ng parehong (corpus, model), o isang **extrapolation** mula sa sweep-average na gastos ng modelong iyon bawat entry × ang bilang ng entry sa corpus. Ang batayan ay nakasaad bawat aytem; ang inyong aktwal na gastos ay nakadepende po sa pagpepresyo ng provider sa oras ng pagpapatakbo.
- `priority` — ang inilathalang ranggo (survey mode: unang liwanag sa mga
  pares, wika, at pamilya bawat dolyar). Inilalathala rin po ng preview ang mga
  **budget tier** — kung ano ang mabibili ng $1 / $10 / $100 / $1000 mula sa itaas ng
  ranggo (mga aytem, pares, modelong naabot) — upang matantiya po ninyo ang isang kontribusyon
  bago gumastos ng anuman. Ang pinagbabatayang modelo ng halaga ay ang **inaasahang
  halaga ng chain (expected chain value)**: kung gaano kalaki ang inaasahang maitutulong ng isang pagpapatakbong ito upang patibayin ang buong language mesh, bawat tinantyang dolyar. Ang bawat aytem ay nagtataglay ng buong breakdown ng pormula nito (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`) kaya ang anumang ranggo ay maaaring muling makuha (re-derive) nang mano-mano — ang pormula at ang mga default nito ay inilalathala sa [Queue Construction Specification](/docs/network/specifications/queue-construction), at ang dahilan sa likod nito ay nasa [Why the Queue Is Built This Way](/docs/network/perspectives/why-the-queue).

**Walang claim-locking — pumili ng anumang bukas na item.** Hindi nakasasama ayon sa disenyo kung dalawang tao ang magpapatakbo ng parehong item: bawat run card ay may fingerprint (SHA-256 sa dataset hash + model + condition + system prompt, [Benchmark Spec §3.8](/docs/network/specifications/benchmark)), kaya ang magkakaparehong run ay nade-deduplicate kapag inilathala, at ang mga independent replication ng parehong configuration ay kapaki-pakinabang na ebidensya, hindi sayang.

Ang mga naka-queue na corpora ay dev-split, nasa pamilyang CC-BY (Tatoeba-derived), at naka-flag bilang `do_not_train` — mga evaluation set ang mga ito, hindi training data. Hindi isinasama sa open queue ang mga corpus na may non-commercial license at mga naka-quarantine na corpus.

## Setup (isang beses)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### Aling provider key?

Tumatanggap ang harness ng apat na provider key, na pinipili gamit ang `--provider` sa `mt-eval run` at `mt-eval queue` — o awtomatikong nade-detect mula sa alinmang key ang nakatakda sa inyong environment o `.env`:

| `--provider` | Key | Umaabot sa |
|---|---|---|
| `openrouter` (default) | `OPENROUTER_API_KEY` | bawat model sa lineup ng queue |
| `anthropic` | `ANTHROPIC_API_KEY` | mga model ng Anthropic Claude |
| `openai` | `OPENAI_API_KEY` | mga model ng OpenAI GPT |
| `gemini` | `GOOGLE_API_KEY` | mga model ng Google Gemini |

Ang isang [OpenRouter](https://openrouter.ai/keys) key ay umaabot sa bawat model sa lineup, at ang cost tracking at pricing snapshots ng harness ay nagmumula sa parehong OpenRouter metadata, kaya tumutugma ang iniulat na run cost sa siningil sa inyong key — kaya ito ang default. Kung ang inyong credits ay direkta sa Anthropic, OpenAI, o Google, itakda ang key ng vendor na iyon at tatawagin ng harness ang API ng vendor nang walang proxy. Umaabot lamang ang direct key sa sariling mga model ng vendor na iyon (maganda para sa single-vendor batch), at ang cost figures nito ay nagmumula sa inilathalang vendor pricing sa halip na billed metadata — ituring ang mga ito bilang malapit na tantiya. Kung parehong nakatakda ang OpenRouter key at direct key, OpenRouter ang pipiliin ng auto-detection; sasabihin ito sa inyo ng queue worker at kung paano mag-override gamit ang `--provider`. Itinatala ng bawat run card kung saang lane ito tumakbo sa field nitong `api_provider`.

(Tumatanggap din ang `mt-eval run` ng `--provider local` para sa self-hosted OpenAI-compatible endpoints — Ollama, vLLM, LM Studio — sa pamamagitan ng `--base-url`. Isa itong tahasang opt-in, hindi kailanman auto-detected.)

### Walang API key: magpatakbo ng self-hosted na modelo

Hindi po ninyo kailangan ng cloud key kahit kailan. Pinapatakbo ng pamamaraang `local-model` ang isang bukas na neural-MT model sa inyong sariling hardware — ang mga modelong hindi isinisilbi ng mga cloud engine, na siya mismong kinaroroonan ng saklaw para sa mga wikang may limitadong mapagkukunan (low-resource): **NLLB-200**, **OPUS-MT** (Helsinki-NLP), at **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**Dalawang "karaniwang paraan" upang mag-load ng modelo, awtomatikong pinipili — walang kailangang i-configure:**

- **transformers** (default): Ang `--model` ay isang Hugging Face hub id (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) o isang lokal na `from_pretrained()` na direktoryo. Nangangailangan ng `pip install 'mt-eval[local-models]'`.
- **CTranslate2** (mabilis na CPU/GPU inference): Ang `--model` ay isang direktoryo ng modelo na na-convert sa CTranslate2 (isang ginawa ng `ct2-transformers-converter`, na naglalaman ng `model.bin`). Nangangailangan ng `pip install 'mt-eval[ctranslate2]'`. Ang tokenizer ay binabasa mula sa na-convert na direktoryo, o pinapangalanan gamit ang `LOCAL_TOKENIZER_ID`.

Ang backend ay nade-detect mula sa path ng modelo (ang isang direktoryo ng CTranslate2 ay mayroong `model.bin`); pilitin po ito gamit ang `LOCAL_MODEL_BACKEND=transformers|ctranslate2` kung kakailanganin ninyo.

**Nagmumula po ang mga language code sa language card, hindi hinuhulaan.** Para sa isang multilinggwal na modelo tulad ng NLLB, direktang binabasa ng harness ang FLORES-200 code mula sa card ng target na wika (ang parehong pinagmumulan ng katotohanan na ginagamit ng bawat pamamaraan). Ang isang wika na talagang hindi isinisilbi ng modelo — ang NLLB-200, halimbawa, ay walang Plains Cree (`crk`) — ay **tapat na nabibigo** ("out of scope for this model") sa halip na maglabas ng pekeng code at isang kapani-paniwala-ngunit-maling salin. Ang mga modelo ng OPUS-MT ay partikular sa pares, kaya ang pares *mismo* ang modelo.

Ang pagpapatakbo ng lokal na modelo ay nagmamarka at naglalathala nang eksaktong katulad ng anumang iba pang pagpapatakbo — parehong mga sukatan (metrics), parehong run card, parehong leaderboard. (Ito po ay isang pamamaraan ng harness; naaabot ito sa kalaunan ng CLI translation tool sa pamamagitan ng isang subprocess bridge, kaya hindi kailanman nangangailangan ang Node ng isang Python ML stack.)

### Ang mabilis na landas para sa agent

Kung nagtatrabaho kayo gamit ang Claude Code o ibang coding agent, ang buong ambag ay isang prompt:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Tier 0 — Isang command

Ang pinakamabilis na paraan upang mag-ambag ay hayaan ang harness na kunin para sa inyo ang nasa itaas ng
queue:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

Hindi ito kailanman nagre-re-sort — ang pagkakasunod-sunod ng queue *ang mismong* [priority
model](/docs/network/specifications/queue-construction) — at ipinapakita nito ang buong
plano na may tinatayang gastos at nagtatanong muna bago magpatakbo ng anuman. Nilalaktawan ang mga coached
item maliban kung magdadala kayo ng sarili ninyong coaching file
(`--include-coached --coaching-file my-coaching.txt`).

**Ang queue worker ang maglalathala para sa inyo — walang account na kailangan.** Hindi tulad ng isang
`mt-eval run` (na hindi kailanman auto-publish), nire-resolve ng `mt-eval queue` ang isang
publishing identity *bago* gumastos ng anumang token at **auto-publish ang bawat
matagumpay na run** sa leaderboard habang natatapos ito — walang hiwalay na publish
step. Mag-sign in (GitHub/Google) lamang kung nais ninyong makita ang inyong pangalan sa board;
kung hindi, magpatuloy nang anonymous at mapo-post ang mga resulta bilang submitter na `anonymous`
(pinipilit ito ng `--anonymous`, at ang mga non-interactive na run ng `curl | bash` na walang
cached sign-in ay dito nagde-default, at malinaw itong sinasabi). Ipasa ang `--no-publish` upang
panatilihing lokal ang mga resulta sa halip (maaari ninyo itong ilathala mamaya gamit ang `mt-eval
publish`). Pagkatapos ay panoorin ang nabuo ng inyong mga run sa
[live map sa champollion.dev](https://champollion.dev).

## Tier 1 — Magpatakbo ng benchmark

Self-contained ang `run_command` ng bawat queue item. Isang karaniwang halimbawa:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

Ipinapasa ninyo ang **registry id**, hindi isang file — kinukuha ng harness ang reference mula sa
upstream source nito sa oras ng run at nagsa-score laban sa bagong kuhang data
(ang corpus content ay hindi kailanman hina-host o tina-track dito).

Ipi-print ng run ang kabuuang gastos nito at magsusulat ng run log kasama ang scored report sa `eval/logs/`. Pagkatapos ay ilathala:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**Walang account na kailangan.** Nag-aalok ang publishing ng OAuth sign-in (GitHub/Google) upang ang inyong pangalan ang maging attribution sa leaderboard — ngunit opsyonal ito: naglalathala ang `mt-eval publish <report> --anonymous` nang walang account, at eksaktong tulad ng anumang iba pang self-benchmarked result ang pagpapakita ng row na may submitter na `anonymous`. Rate-limited ang anonymous intake (ilang card bawat oras bawat koneksyon; ang sign-in ang unlimited path) at dumaraan sa parehong database integrity gates gaya ng bawat ibang submission — quarantine, score ranges, corpus-sha binding, at corpus-content guard ay pare-parehong nalalapat. Anonymous man o attributed, napupunta ang community submissions sa **self-benchmarked** trust tier — malinaw na naka-label bilang "isinumite ng taong nagpatakbo nito." Hindi iyon demotion; iyon ang trust model na gumagana. Taglay ng run card ang lahat ng kailangan upang muling mapatakbo ng sinuman ang eksakto ninyong configuration: dataset hash, model, condition, buong system prompt, at cost. Ang mas matataas na tier (verification, community validation) ay ibinibigay sa pamamagitan ng review — tingnan ang [Leaderboard Rules](/docs/network/leaderboard/rules).

:::note[Moderation]
Mine-moderate ang mga anonymous row tulad ng lahat ng iba pa: immutable ang submissions sa public API, at anumang curator removal o correction ay dumaraan sa service-role lane, kung saan pinapanatili ng audit trail ng database ang dating row — kaya naitatala at reversible ang purge, hindi kailanman tahimik.
:::

## Tier 2 — Gumawa ng mga coached prompt

May first-class support ang harness para sa **coaching**: palitan ang naive system prompt ng isa na may tunay na kaalamang lingguwistiko. Ipasa ang `--coaching-file` (o `--coaching "inline text"` para sa maiikling prompt) at gagamitin ng harness ang inyong text bilang system prompt, itatala ang **buong text kasama ang SHA-256 nito** sa provenance block ng run log, at lalagyan ng label ang condition ng run na **`coached`** (maliban kung tahasan ninyong itakda ang `--prompt`) — kaya ang prompt craft ay isang reproducible at attributable na eksperimento, hindi kailanman mapagkakamalan ang dalawang magkaibang coaching file, at ang mga coached run ay hindi kailanman napagkakamalang naive baselines sa leaderboard.

Isang worked example para sa Faroese, gamit ang typology facts at glossary entries mula sa [pampublikong language card](https://champollion.dev/languages) ng wika:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(Sumulat ng sarili ninyong coaching content — ipinapakita ng mga fact sa itaas ang *anyo*: ilang high-impact na tuntunin sa grammar, maliit na glossary ng mga terminong madalas magkamali ang model, isang tagubilin sa register. Ang mga language card sa [champollion.dev/languages](https://champollion.dev/languages) ay nagbabanggit ng typology sources na maaari ninyong pagkunan.)

Ihambing sa naive baseline gamit ang `mt-eval compare <naive_log> <coached_log>`, mag-iterate, at ilathala ang pinakamainam ninyong run. Awtomatikong naipapublish ang run na may condition na `coached`; kung nais ninyong magpakita ang leaderboard ng pinangalanang method sa halip na generic na label, mag-attach ng method card kapag nag-publish kayo (nag-aalok ang publish flow ng wizard). Ang pagtalo sa naive baseline sa low-resource pair gamit lamang ang prompt engineering ay isang tunay at publishable finding — tingnan ang buong [Coached LLM Prompting cookbook](/docs/network/tutorials/coached-llm-prompting) para sa gabay sa disenyo.

## Tier 3 — Bumuo ng method

Ang pinakaambisyosong ambag: i-implement ang protocol na `TranslationMethod` (`translate(entries, config)`) at i-benchmark ang isang aktuwal na system, hindi isang prompt. Pinapatakbo ito ng harness sa pamamagitan ng `--method <plugin-dir>` at ini-embed ang inyong method card sa run card. Mga pattern na may worked cookbooks:

- **[FST-gated pipelines](/docs/network/tutorials/fst-gated-pipeline)** — bawat candidate word ay sinusuri ng isang morphological analyzer; muling nagge-generate ang LLM hanggang pumasa ang gate. Semi-deterministic, morphology-guaranteed na output.
- **[Dictionary-augmented generation](/docs/network/tutorials/dictionary-augmented-llm)** — maghanap ng source terms sa bilingual lexicon sa oras ng pagsasalin at i-constrain ang output.
- [Chained models](/docs/network/tutorials/chained-models), [few-shot retrieval](/docs/network/tutorials/few-shot-prompting), [back-translation](/docs/network/tutorials/back-translation), [rule-based hybrids](/docs/network/tutorials/rule-based-hybrid)…

Nagde-declare ang mga method ng **dependency class** (S/O/A1/A2/X — tingnan ang [methods spec](/docs/network/specifications/methods#method-validity-and-dependency-classes)) na naglalarawan kung ano ang kailangan ng mga ito upang tumakbo at ma-transfer: Class S ang isang self-contained pipeline; A2 ang tumatawag sa isang licensed dictionary API sa runtime. Mag-declare nang tapat — tinutukoy ng class kung saan maaaring makipagkumpitensya ang inyong method, at ina-audit ang mga manifest.

## Bakit mahalaga ito lampas sa leaderboard

Bawat nailathalang run ay independent evidence tungkol sa kalidad ng MT para sa isang pares ng wika na hindi sinusukat ng commercial providers. Nagsisilbi rin ang queue bilang pampublikong tala ng *demand*: aling mga pares ang itinuturing ng komunidad na mahalagang sukatin, magkano ang halaga ng coverage sa kasalukuyang API prices, at hanggang saan umaabot ang contributed compute. Kapag humihiling kami sa funding agencies na pondohan ang systematic sweeps, ang queue na ito at ang fill-rate nito ang ebidensya ng demand.
