---
sidebar_position: 3
title: "Sanayin ang Inyong Unang Model (gamit ang inyong agent)"
description: "Isang sunod-sunod na gabay para sa pagsasanay ng low-resource MT model sa pamamagitan ng pagdirekta sa isang coding agent — kung ano ang sasabihin ninyo, kung ano ang ginagawa ng forge, ano ang hitsura ng isang pagtanggi, at kung paano basahin ang diagnosis."
related:
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Sanayin ang Inyong Unang Model (kasama ang inyong agent)

Hindi ninyo kailangang malaman kung paano magsanay ng neural machine-translation model. Kailangan
ninyong kayang **sabihin sa coding agent kung ano ang gusto ninyo** — Claude, o isang
Sonnet/Flash-class model, o anumang agent na kayang magpatakbo ng shell commands. Ang **nmt-forge**
ay binuo upang mapatakbo ito ng agent nang *mekanikal*: sa bawat hakbang, eksaktong sinasabi ng tool
sa agent kung ano ang susunod na gagawin, at tumatanggi — nang malinaw, kasama ang ayos — kapag ang isang
hakbang ay makasisira sa inyong mga resulta.

Ang pahinang ito ang buong loop. Ang bawat hakbang ay isinulat bilang **kung ano ang sasabihin ninyo sa inyong
agent**, **kung ano ang ginagawa ng forge**, **kung ano ang hitsura ng pagtanggi** (upang hindi kayo
mag-panic kapag may nangyari — ang pagtanggi ay palatandaang gumagana ang tool), at, sa dulo, **kung paano
basahin ang ulat**.

:::tip Ang isang tuntunin para sa inyong agent
Sabihin dito: *"Always run `nmt-forge status --json` first, and after every step.
Do whatever its `next_command` says."* Ang iisang kaugaliang iyon ang nagpapalit sa forge bilang isang
guided rail. Kung kumokonekta ang inyong agent sa pamamagitan ng MCP, ang parehong loop ay ang
`forge_status` tool — tingnan ang [Gabay para sa Agent](/docs/network/getting-started/agent-guide).
:::

---

## Hakbang 0 — Ituro ang inyong agent sa inyong wika

**Sasabihin ninyo:** *"I want to train an English→[your language] model. Start by
discovering what forge knows about it. The ISO 639-3 code is `crk`"* (gamitin ang code ng
inyong wika).

**Ginagawa ng forge:** Binabasa ng `nmt-forge discover crk` ang card ng wika — scripts,
dictionaries, morphological analyzers, kasalukuyang corpora at eval sets (kasama ang anumang
`do_not_train` / quarantine flags), at per-language referee metrics. Inilalagay nito
ang inyong wika sa **asset ladder**: (1) parallel text → guarded training;
(2) + monolingual → tagged backtranslation; (3) + dictionary/grammar → cited
synthetic data; (4) + analyzer → round-trip-verified synthesis; (5) + isang referee
metric → sariling metric ng wika sa scoring at checkpoint selection.

**Ang blangkong field ay nangangahulugang UNKNOWN, hindi kailanman zero.** Ang sparse card ay hindi nangangahulugang "walang anuman ang wikang ito" — maaaring hindi pa lamang nito naitatala ang resource. Maaari ninyong dalhin palagi ang sarili ninyong parallel corpus.

Pagkatapos: *"Scaffold the project."* → sumusulat ang `nmt-forge init crk` ng workspace, isang
starter config, at isang `NEXT_STEPS` brief.

---

## Hakbang 1 — Gumawa ng split na hindi makapandaraya

**Sasabihin ninyo:** *"Here's my parallel corpus `corpus.jsonl`. Split it into
train/dev/test and register the dev and test sets."*

**Ginagawa ng forge:** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7
--out data/splits --register mypair`. Gumagawa ito ng **group-disjoint** split: anumang
dalawang sentence pairs na may parehong source *o* target ay mapupunta sa **iisang** panig.
Ito ang pinakakaraniwang paraan kung paano napapalobo ang low-resource scores — maraming English drills sa isang textbook ang tumutugma sa iisang target word, isang naive random split ang naglalagay ng isang kopya
sa train at ang kambal nito sa test, at "isasalin" ng model ang mga sagot na na-memorize nito.

**Kung ano ang hitsura ng pagtanggi:** kung bibigyan ninyo ang forge ng split na kayo mismo ang gumawa at
hindi ito disjoint, magka-crash ang `verify-split` habang pinapangalanan ang shared keys — *"these rows
share a canonical target across train and test."* Ayos: hayaan ang forge na gumawa ng split.

---

## Hakbang 2 — Suriin para sa leakage

**Sasabihin ninyo:** *"Before we train, check the training corpus for leakage against
the eval sets."*

**Ginagawa ng forge:** `nmt-forge leak-audit corpus.jsonl`. Sinusuri nito ang inyong corpus
laban sa bawat nakarehistrong dev/test/sealed set:

- **Target-side exact o near-duplicate** (ang reference answer ay nasa inyong
  training data) → **fatal**. Ito ay answer leakage.
- **Source-side near-duplicate na may *ibang* sagot** → **informational,
  pinananatili**. Ang parehong prompt, ngunit ibang translation, ay lehitimong minimal-contrast
  pair, hindi leak — iniuulat ito ng forge ngunit hindi kailanman binubura. (Ang pagkakaibang ito
  ay totoong bug na nahuli namin sa dogfooding: nag-flag ang naunang bersyon ng 44 rows
  bilang fatal kahit 17 lamang ang tunay na leaks.)

**Kung ano ang hitsura ng pagtanggi:** *"row 118: target-side near-duplicate of test set
`mypair-test` (Jaccard 0.83) — answer leakage."* Ayos: patatakbuhin ng inyong agent ang
`nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` at magsasanay sa
mga natira.

---

## Hakbang 3 — Mag-predict bago sumilip

**Sasabihin ninyo:** *"Write down what we expect the model to do, then we'll train."*

**Ginagawa ng forge:** `nmt-forge prereg new p1 --eval-set mypair-test --predictions
predictions.md`. Kayo (o ang inyong agent, nang malinaw) ay nagko-commit ng falsifiable predictions —
aling metric, aling direction, gaano kalaki — **bago** magkaroon ng anumang test score.

**Kung ano ang hitsura ng pagtanggi:** kung susubukan ng inyong agent na i-score ang test set nang walang
preregistration, tatanggi ang `score`: *"scoring a test set is refused without a
preregistration that predates the first scoring read."* Ito ang naghihiwalay sa isang
result mula sa results-first storytelling. Ayos: mag-preregister muna.

:::info Bakit ito parang dagdag na trabaho
Ito ang trabaho. Bawat guard dito ay isang pagkakamaling nakapanlinlang sa tunay na mga researcher.
Ginagawa ng tool na ang tapat na landas ang madaling landas at ang hindi tapat na landas ang siyang
pumipigil sa inyo.
:::

---

## Hakbang 4 — Suriin ang gates, pagkatapos ay magsanay

**Sasabihin ninyo:** *"Will the training run pass all its checks? If so, train."*

**Ginagawa ng forge:** Inililista ng `nmt-forge preflight run` ang bawat gate na dadaanan ng run —
dev-fence present, leak-audit clean, schedule floor derived, decode headroom
checked — bawat isa ay may ✓ o ✗ kasama ang ayos. Kapag lahat ay berde na:
`nmt-forge run config.json`.

Ang training ang isang hakbang na **hindi** instant tool call — gumagamit ito ng GPU at
tumatagal ng ilang minuto hanggang ilang oras. Pinatatakbo ito ng inyong agent sa terminal at binabantayan ang
mga linyang `[schedule-sanity]`. Kinukuha ng forge ang early-stopping **floor** mula sa inyong
data mix, kaya ang synthetic-heavy run ay hindi mamamatay sa kalahating epoch kapag umalog ang real-dev
loss (isang totoong failure mode — tingnan ang
[Pag-diagnose ng Training Run](/docs/network/getting-started/diagnosing-training)).

Kapag natapos ito, **nakapili na ang forge ng checkpoint sa fenced dev set** (hindi kailanman
sa test set) at nagsulat ng `run-manifest.json`.

---

## Hakbang 5 — Isara ang loop: mag-evaluate at mag-diagnose

**Sasabihin ninyo:** *"Score the model on the test battery and tell me what to improve."*

**Ginagawa ng forge:** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config
config.json`. **Isinasara nito ang loop** sa isang command: dini-decode nito ang test
battery gamit ang checkpoint na pinili ng run, ini-score ito (prereg-gated, may 95%
confidence intervals sa bawat numero), at nagdaragdag ng plain-language **Diagnosis &
Recommendations** section. (Bago umiral ang command na ito, kailangan ninyong i-symlink ang
checkpoint at magpatakbo ng decoder nang mano-mano — eksaktong bahagi kung saan naligaw ang isang baguhan.)

### Paano basahin ang battery-lint report

Ang ulat ay isang table ng scores **ayon sa register** (textbook, government, oral
story, …), bawat isa ay may confidence interval, kasunod ang diagnosis. Pinapangalanan ng
diagnosis ang inyong **pinakamahihinang registers** at, para sa bawat isa, ang pinaka-malamang na sanhi at
ang **lever** na susunod na hihilahin:

| Kung sinasabi ng diagnosis… | Ibig sabihin nito… | Ang lever |
|---|---|---|
| `R1-vocabulary-gap` | mababa ang score ng register **at** hindi tapos ang outputs; kulang ang model sa mga salita | **VOCABULARY** — palawakin ang lexicon, pagkatapos ay muling suriin ang funnel |
| `R2-structure-gap` | kilala ang mga salita ngunit hindi ang *hugis* ng mga pangungusap | **STRUCTURE** — idagdag ang nawawalang constructions (templates/compositor) |
| `R3-mixed-convention` | naghahalo-halo ang spellings sa outputs | **ORTHOGRAPHY** — i-normalize ang corpus sa isang convention, muling magsanay |
| `R4-optimism-bound` | napapalaki ang "full" score ng near-twin eval rows | **MEASUREMENT** — banggitin ang strict score para sa generalization |
| `R5-low-power` | malapad ang confidence interval | **MEASUREMENT** — huwag kumilos batay sa deltas na mas maliit kaysa CI; palakihin ang eval set |
| `R7-transfer-plateau` | mahusay sa synthetic, natigil sa real text | **REAL-DATA** — mag-backtranslate ng monolingual data o kumuha ng totoong parallel sentences |

May dalang ebidensya ang bawat finding kung saan ito nag-fire. Para sa mga finding na `--json`, maaaring
kumilos ang inyong agent nang programmatically: `nmt-forge lint <battery-manifest.json>`.

---

## Ang katatapos lamang ninyong gawin

Nagsanay kayo ng model na ang score ay tunay ninyong mapagkakatiwalaan: walang leaked answers, isang
checkpoint na pinili nang hindi sumisilip sa test set, error bars sa bawat numero,
predictions na isinulat bago ang results, at diagnosis na pinapangalanan ang susunod na lever
sa halip na pabayaan kayong manghula. Iyon ang buong punto — **ang tapat na result
ang default, at hindi kinailangan ng MT expertise upang makarating doon.**

Kapag nakadismaya ang mga numero (mangyayari iyon sa unang pagkakataon), pumunta sa
[Pag-diagnose ng Training Run](/docs/network/getting-started/diagnosing-training) —
symptom-first ito, isinulat para mismo sa sandaling iyon.
