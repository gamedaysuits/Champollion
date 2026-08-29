---
sidebar_position: 2
title: "Sanayin ang Model nang Matapat (nmt-forge)"
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# Sanayin ang Isang Modelo nang Tapat (nmt-forge)

**Ang 30-segundong bersyon:** karamihan sa mga "pagpapahusay" sa low-resource MT ay bumabagsak sa
muling pagsusuri — tumagas ang test set sa training, ang test set ang pumili ng
checkpoint, o ingay lamang ang pagtaas na walang error bars. Ang **nmt-forge** ay isang
training suite na ginagawang mahirap sa estruktura ang mga pagkakamaling iyon: ginagawa ng mga normal na path nito
ang tama, at tumatanggi ang mga maling path na may mensaheng nagsasabi kung
*ano* ang nangyari, *bakit* nito sinisira ang mga resulta, at ang eksaktong *ayos*. Nagsasanay ito;
ang [eval harness](/docs/network/specifications/harness) ang nag-i-score. Bawat guard
dito ay nagme-mekanisa ng pagkakamaling aktuwal naming nagawa, nasukat, at naidokumento habang
bumubuo ng pagsasalin para sa Plains Cree.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

Iyan ang buong personalidad ng suite sa isang pagtanggi.

## Ang limang-minutong kuwento

Narito ang kabiguang pinagmulan ng suite. Iniuugnay ng isang Cree textbook ang maraming
English drills sa iisang target: ang *"Feed him"* at *"Feed her"* ay parehong isinasalin
bilang `asam`. Isang karaniwang random split ang naglagay ng isang kopya sa training at ng kakambal nito sa
test set — kaya literal na nakita na ng modelo ang 17 sa 54 "test" answers, at
ang mga row na iyon ay nakakuha ng 83 chrF++ kumpara sa 44 para sa malilinis. Lahat ng kasunod
(ang "champion" model, ang mga findings na itinayo rito) ay kinailangang itapon.

Ginagawa itong imposible ng splitter ng nmt-forge **by construction**: ang mga pair na may magkaparehong
source *o* target ay pinapangkat, napupunta ang buong mga grupo sa isang panig, at tumatakbo ang
zero-overlap verification pagkatapos ng bawat carve:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Ganito rin ang anyo ng bawat ibang guard — isang tunay na pagkakamali, inalis sa pamamagitan ng mekanisasyon:

| guard | ang pagkakamaling pinapatay nito |
|---|---|
| **split-guard** | mga test answer na nagtatago sa training sa pamamagitan ng magkaparehong sources/targets |
| **dev-fence** | ang test set ang pumipili ng inyong checkpoint (tumatangging magsimula ang training nang walang nakarehistrong dev set) |
| **leak-audit** | pag-train sa eval text — eksakto, binagong pananalita (Jaccard), o ang buong file |
| **funnel-audit** | tahimik na attrition sa pipeline (minsan, isang orthography character ang nagtanggal ng 1,375 dictionary verbs, hindi nakikita, sa loob ng ilang linggo) |
| **convention-lint** | pag-train sa magkakahalong spelling conventions (pagkatapos, hinahalo ng modelo ang mga ito sa gitna ng pangungusap) |
| **coverage-map** | isang milyong synthetic pairs na walang imperatives, walang questions, walang possession — volume na nagtatago ng structural gaps |
| **sample-strata** | dalawang uri ng template na umaangkin sa kalahati ng training signal |
| **ci-scoring** | mga score na walang error bars (bawat numero ay nire-render kasama ang 95% bootstrap CI nito — walang bare-score output) |
| **schedule-sanity** | early stopping na pumapatay sa synthetic-heavy run sa kalahating epoch: kapag 97% synthetic data at tapat na *real* dev set, maagang bumababa sa pinakamababa ang dev loss at dahan-dahang tumataas — iyon ay ang modelong umaangkop sa synthetic mass, hindi convergence. Awtomatikong hinango mula sa inyong mix ang stopping floor, at ipinapaliwanag ng bawat intervention ang sarili nito gamit ang dev-loss trajectory. Natagpuan ang isang ito *sa pamamagitan ng* malinis na protocol — inililitaw ng tapat na setups ang tunay na bugs |
| **eval-ledger** | hindi nakikitang adaptive na paggamit ng eval data (naka-log ang bawat read; one-shot ang sealed sets) |
| **preregister** | postdictions na nakadamit bilang predictions (walang preregistration → walang comparison table) |

## Anumang wika, anumang assets — magsimula sa card

Ang nmt-forge po ay iisang tool para sa lahat ng ~8,700 na wika sa index ng Champollion, at
nagsisimula po ito sa pamamagitan ng pagtatanong sa index kung ano ang aktwal na taglay ng isang wika:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

Ang mga markang `?` ay ang pagiging tapat ng tool: ang kawalan sa isang card ay nangangahulugang **unknown**,
hindi kailanman "walang kahit ano ang wikang ito." Umaakyat ang bawat wika sa parehong
**asset ladder** — (1) ang parallel text lamang ay nagbibigay na ng buong guarded
training loop; (2) nagdaragdag ng backtranslation ang monolingual text; (3) ang dictionary
kasama ang published grammar ay ginagawang makabuluhan ang pagbuo ng cited template pack; (4) ang
morphological analyzer ay nagbubukas ng verified synthesis; (5) ang LYSS referee ay naglalagay
ng sariling metric ng wika sa scoring at checkpoint selection. Ang mayamang card
(Plains Cree) ay awtomatikong nagwi-wire ng rungs 4–5 — dumarating ang eval sets na naka-flag
`NEVER TRAIN ON THIS`, at handa nang i-paste ang plugin lanes ng referee.

Pagkatapos, ang `nmt-forge init <code>` ay nag-i-scaffold ng project mula sa card: isang workspace,
isang starter config, at isang `NEXT_STEPS.md` brief na isinulat para sa inyo *at sa inyong
agent* — nagtatapos sa [Magsumite ng
Method](/docs/network/getting-started/submit-a-method) kapag mayroon na kayong
bagay na karapat-dapat i-test.

## Synthetic data na maaari ninyong ipagtanggol

Para sa mga wikang may morphological analyzers (FSTs), gumagawa ang forge ng
training data sa pamamagitan ng **language packs** — at ipinapatupad ang isang *emit law* na walang pack
ang makakaiwas: bawat generated word ay dapat mag-round-trip sa analyzer
(generate → analyze → same analysis), bawat template ay nagbabanggit ng published
grammar na tina-transcribe nito, bawat plausibility filter ay pinangalanan at binibilang, at
bawat row ay tinatatakan ng `synthetic: true`. Mahalaga ang tatak na iyon: ang
registry ay **tumatanggi sa synthetic rows sa test sets**. Tunay na data lamang ang tests.

Ang forge mismo ay walang kasamang language packs — ito ay general-purpose tool. Ang packs
ay nananatili kasama ng kanilang mga wika at nagpa-plug in sa pamamagitan ng module path o entry point (ang
Plains Cree pack ay nasa crk-translate project):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Ang analyzers at dictionaries ay nananatiling hiwalay, mga user-fetched tool sa ilalim ng sarili nilang
licenses — hindi kailanman bundled, hindi kailanman redistributed.

## Ang sariling referee ng inyong wika, nasa loop

Ang LYSS evaluation standards (per-language linters na nakaaalam, halimbawa, na dalawang
Cree spellings ay nagkakaiba lamang dahil sa documented long-vowel convention) ay nagpa-plug in sa
bawat scoring surface — at sa checkpoint selection, kaya ang modelong
nanalo ay ang mas gusto ng *referee ng wika*, hindi lamang chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

Bawat numero ng plugin ay may confidence interval; ang referee na kulang ang
prerequisites ay nag-uulat ng *unavailable* sa halip na imbentong
score.

Totoo rin ito sa **full harness metric stack** — nagsasalita ang nmt-forge ng
lahat ng sinasalita ng [eval harness](/docs/network/specifications/harness),
kasama ang neural metrics (COMET, COMET-QE, MetricX), na pinatatakbo ang inference
nang isang beses at bina-bootstrap ang confidence intervals mula sa naka-cache na per-entry scores.
Bago kayo pumili ng checkpoints sa anumang automatic metric, ipinapakita ng `discover` ang
[nasukat na
reliability](/docs/network/specifications/metric-reliability) ng bawat
metric para sa inyong language family — para sa Inuktitut, halos hindi sinusundan ng BLEU ang human
judgment (r=0.16) samantalang ginagawa ito ng COMET (r=0.86); para sa karamihan ng low-resource families
ang tapat na sagot ay *unmeasured*. Sinasabi sa inyo ng tool kung aling numero ang
paniniwalaan bago kayo mag-optimize patungo rito.

## Saan pa mas lalalim

- **Bago pa lamang sa bokabularyo?** Ang [MT Training sa Payak na
  Wika](/docs/network/context/mt-training-concepts) ay nagde-define ng bawat termino —
  training vs. eval data, loss vs. decoding, leakage, chrF++, backtranslation,
  ang plateau — gamit ang worked example, na isinulat para sa walang background.
- **Handa nang bumuo?** Ang [Kaya Gusto Ninyong Sanayin ang Sarili Ninyong
  Model](/docs/network/tutorials/train-your-own-model) ay ang step-by-step,
  agent-forward walkthrough: pumili ng wika → magtipon ng data → mag-synthesize → mag-split
  → mag-train → mag-evaluate → mag-iterate → magsumite, na ipinapakita ang bawat guardrail habang hinuhuli nito ang
  pagkakamali nito.
- **Mag-train, pagkatapos ay magsumite:** ang tapat na na-train na modelo ay nagiging Network entry
  sa pamamagitan ng [Magsumite ng Method](/docs/network/getting-started/submit-a-method).
- **Ang error bars:** Ang [Statistical Significance
  Testing](/docs/network/specifications/significance) ay ang math na inilalapat ng forge
  bilang default.
- **Aling metric ang pagkakatiwalaan:** tingnan ang [Metric
  Reliability](/docs/network/specifications/metric-reliability) bago
  pumili ng checkpoints sa anumang automatic metric.
- **Ang buong design** — ang nasukat na backstory ng bawat guard, ang pack
  interface, ang training-loop defaults — ay kasama ng code sa
  repository (`forge/DESIGN.md`).
