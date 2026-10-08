---
sidebar_position: 2
title: "Sanayin ang Model nang Matapat (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
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

**Ang 30-segundong bersyon:** karamihan sa mga "pagpapabuti" sa low-resource MT ay nawawalang-bisa sa muling pagsusuri — tumagas ang test set sa training, ang test set ang pumili ng checkpoint, o ang nakitang pagtaas ay ingay lang na walang mga error bar. Ang **nmt-forge** ay isang training suite na ginagawang structurally mahirap ang mga pagkakamaling iyon: ginagawa ng mga karaniwang path nito ang tama, at ang mga maling path naman ay tumatanggi kasama ang isang mensaheng nagsasaad kung *ano* ang nangyari, *bakit* nito sinisira ang mga resulta, at ang eksaktong *solusyon*. Nagsasanay ito; ang [eval harness](/docs/network/specifications/harness) naman ang nagmamarka. Bawat guard dito ay nag-o-automate ng pag-iwas sa isang pagkakamaling aktuwal naming nagawa, nasukat, at naidokumento habang binubuo ang pagsasalin para sa Plains Cree. Nai-i-install ito gamit ang `python3 -m pip install 'nmt-forge[hf]'`, at nagsasanay ang default na modelo nito sa CPU ng laptop.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
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
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(Kung ang inyong test set ay isa nang hiwalay at nakarehistrong file — isang set na sinuri ng guro na pinananatili ninyong pribado — hinahati lamang ng `--test 0` ang train at dev.)

Bawat iba pang guard ay may parehong anyo — isang totoong pagkakamali, na inalis sa pamamagitan ng mekanismo. Sama-sama, ang mga ito ang **training guardrails**: basahin ang mga ito bago kayo mag-split (itinuturo rito ng `nmt-forge init` at `nmt-forge status` sa hakbang na iyon; nakukuha ng mga agent ang parehong mga panuntunan, kasama ang nasukat na pagkakamali sa likod ng bawat isa, mula sa MCP tool na `get_training_guardrails`).

| guard | ang pagkakamaling pinipigilan nito |
|---|---|
| **split-guard** | mga sagot sa test na nagtatago sa training sa pamamagitan ng magkakatulad na source/target |
| **dev-fence** | ang test set ang pumipili ng inyong checkpoint (tatangging magsimula ang training nang walang nakarehistrong dev set) |
| **leak-audit** | pagsasanay sa eval text — isang magkatulad na prompt (kahit na may ibang salin), isang magkatulad o halos dobleng sagot, o ang buong file. Sinasabi rin nito kung ano ang *sinasadya nitong panatilihin* at kung bakit: ang mga template sibling na nagpapalit ng isang salita (*"I see the dog"* / *"I see the cat"*) ay pagsasanay, hindi ang sagot, at iniuulat ang mga ito sa halip na alisin — maliban kung bawat test row ay mayroon nito, kung kailan inaalis ng `--clean-to … --drop-test-twins` ang mga training twin ng isang nakapirming test set. Deterministiko: parehong corpus, parehong resulta |
| **funnel-audit** | tahimik na pagkawala ng data sa pipeline (isang karakter sa ortograpiya ang minsan nang nagbura ng 1,375 pandiwa sa diksyunaryo, nang hindi nakikita, sa loob ng ilang linggo) |
| **convention-lint** | pagsasanay sa magkahalong kumbensyon sa pagbaybay (na pagkatapos ay pinaghahalo ng modelo sa gitna ng pangungusap) |
| **coverage-map** | isang milyong sintetikong pares na walang mga pautos, walang mga tanong, walang pag-aari — dami na nagtatago ng mga puwang sa istruktura |
| **sample-strata** | dalawang uri ng template na sumasakop sa kalahati ng training signal |
| **ci-scoring** | mga score na walang mga error bar (ipinapakita ang bawat numero kasama ang 95% bootstrap CI nito — walang output na bare score lamang) |
| **schedule-sanity** | maagang paghinto (early stopping) na pumapatay sa isang synthetic-heavy run sa kalahating epoch pa lamang: kapag may 97% synthetic data at isang tapat na *totoong* dev set, maagang bumababa ang dev loss at unti-unting tumataas — iyon ay dahil umaakma ang modelo sa bulto ng synthetic data, hindi dahil sa convergence. Awtomatikong kinukuha ang stopping floor mula sa inyong mix, at bawat interbensyon ay nagpapaliwanag sa sarili nito gamit ang trajectory ng dev loss. Natuklasan ito *sa pamamagitan* ng isang malinis na protocol — inililitaw ng mga tapat na setup ang mga totoong bug |
| **eval-ledger** | hindi nakikitang adaptive na paggamit ng eval data (naka-log ang bawat pagbasa; isahang gamit lang ang mga sealed set) |
| **preregister** | mga postdiction na nagkukunwaring prediction (walang preregistration → walang test score, walang comparison table; isang format ng predictions, isang JSON array — nagsusulat ang `nmt-forge prereg template` ng isa upang i-edit) |
| **score caveats** | pagtukoy sa isang score na nilalagyan ng caveat ng eval harness — isang *halos pare-parehong output* (isa sa iilang pangungusap na ibinibigay sa maraming magkakaibang input: hindi sumusunod ang mga output sa mga input), mga output na mas mahaba o mas maikli kaysa sa mga reference, mga kopya ng source. Walang kinakalkula ang forge sa mga ito; ipinapasa nito ang bawat caveat na isinulat ng harness, sa mismong mga salita ng harness, katabi ng score — sa buod ng export, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` at `lint` — at hindi kailanman nag-aalok ng qualified na score bilang "ang numerong dapat banggitin" nang wala ang caveat nito |

## Anumang wika, anumang assets — magsimula sa card

Ang nmt-forge ay isang tool para sa lahat ng humigit-kumulang 8,700 wika sa index ng Champollion, at nagsisimula ito sa pamamagitan ng pagtatanong sa index kung ano talaga ang mayroon ang isang wika:

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

Pagkatapos ay gumagawa ang `nmt-forge init <code>` ng scaffold para sa isang proyekto mula sa card: isang workspace, isang starter config, at isang `NEXT_STEPS.md` brief na isinulat para sa inyo *at sa inyong agent* kasama ang eksaktong pagkakasunod-sunod ng command. Gumagana ito mula sa isang payak na `pip install` — binabasa ang mga card mula sa isang directory na inyong tinukoy, isang lokal na checkout, o ang pampublikong card index (naka-cache para sa offline na paggamit) — at ang isang wikang wala pang card ay nakakakuha rin ng proyekto (`--no-card --name "<name>"`), kung saan ang bawat impormasyon sa card ay itinatala bilang hindi alam sa halip na imbentuhin.

## Mula sa laptop patungo sa isang nai-serve na modelo

Hindi kailangan ng GPU sa tapat na loop. Nagsusulat ang `init` ng isa sa tatlong preset ng modelo sa config, bilang tahasang mga numero:

| preset | kailangan | ano ang aasahan |
|---|---|---|
| `cpu-tiny` (default) — isang maliit na transformer na sinanay mula sa simula, bokabularyo na natutunan mula lamang sa inyong mga training row | isang CPU ng laptop, walang download | mahina ayon sa disenyo: sa 1–2 libong pares, ang chrF++ ay humigit-kumulang 5–30 — mga parirala at pattern ng inyong data, hindi pangkalahatang pagsasalin |
| `cpu-finetune --base <hf-id>` — isang maliit na pretrained na Marian/opus-mt na modelo na inyong tutukuyin, para sa isang kaugnay na pares | isang CPU, ~300 MB na download | karaniwang mas mahusay kaysa sa `cpu-tiny` kapag may umiiral na kaugnay na pares — sukatin ito |
| `nllb-600m` — NLLB-200 distilled 600M na may LoRA | isang GPU | ang pinakamalakas na panimula |

Nariyan ang `cpu-tiny` upang gawing totoo ang *buong* loop sa unang araw pa lang — ang fence, ang mga audit, ang preregistered na test, isang modelong matatawag ng CLI — upang ang isang mas mahusay na modelo sa kalaunan ay maipasok sa parehong proyekto at masukat sa parehong paraan. Pagkatapos ng training, tatapusin ng dalawang command ang gawain:

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

Minamarkahan ng `export` ang test set nang isang beses (kinakailangan ang preregistration, 95% confidence intervals; tinutukoy ng `--prereg <id>` ang preregistration na isinulat para sa modelong ito gamit ang `nmt-forge prereg new <id>` — kapag may dalawang modelo sa isang test set, bawat isa ay hinuhusgahan sa sarili nito, tatanggi ang export na manghula), isinusulat ang resulta bilang isang mt-eval report na binabasa ng `mt-eval compare`, at ibinabalot ang isang self-contained na modelo kasama ang isang champollion plugin manifest at isang `DEPLOY.md`. Ginagamit ng `serve` ang champollion api-method contract at isang OpenAI-compatible endpoint, kaya maaaring magsalin ang `champollion sync --method local` gamit ito; nakikinig lamang ito sa localhost maliban kung bibigyan ninyo ito ng token. Tumatanggap ang bawat command ng `--json` para sa mga agent (isang JSON document sa stdout; mga pagtanggi bilang `{"error": {…, "why", "fix"}}`, exit 2). Ang buong sunod-sunod na gabay ay nasa [Train Your First Model](/docs/network/getting-started/train-your-first-model); kapag mayroon na kayong bagay na sulit subukan, ginagawa itong Network entry ng [Submit a Method](/docs/network/getting-started/submit-a-method).

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

- **Bago sa bokabularyo?** Binibigyang-kahulugan ng [MT Training in Plain Language](/docs/network/context/mt-training-concepts) ang bawat termino — training vs. eval data, loss vs. decoding, leakage, chrF++, backtranslation, ang plateau — na may kasamang detalyadong halimbawa, na isinulat para sa mga walang paunang kaalaman.
- **Handa nang bumuo?** Ang [So You Want to Train Your Own Model](/docs/network/tutorials/train-your-own-model) ay ang sunod-sunod na gabay na nakatuon sa agent: pumili ng wika → mangalap ng data → mag-synthesize → mag-split → magsanay → mag-evaluate → mag-iterate → mag-serve at magsumite, kung saan ipinapakita ang bawat guardrail na sumasalo sa pagkakamali nito. Inilalagay ng [Build MT for Your Language](/docs/build-mt-for-your-language) ang training sa konteksto ng buong proseso — pagtuklas sa kung ano ang umiiral, pagsukat sa mga opsyon, pag-deploy.
- **Magsanay, pagkatapos ay magsumite:** ang isang modelong sinanay nang tapat ay nagiging isang Network entry sa pamamagitan ng [Submit a Method](/docs/network/getting-started/submit-a-method).
- **Ang mga error bar:** Ang [Statistical Significance Testing](/docs/network/specifications/significance) ang matematika na inilalapat ng forge bilang default.
- **Aling sukatan ang mapagkakatiwalaan:** tingnan ang [Metric Reliability](/docs/network/specifications/metric-reliability) bago pumili ng mga checkpoint batay sa anumang awtomatikong sukatan.
- **Bawat command at flag:** ang [forge Command Reference](/docs/network/getting-started/forge-command-reference), na nabuo mula mismo sa tool.
- **Ang taxonomy ng mga failure** — bawat pagkakamali, isang kongkretong halimbawa, at ang guard na sumasalo rito — ay kasamang ipinapadala sa source ng nmt-forge. Nakukuha ng mga agent ang parehong hanay ng panuntunan mula sa tool na `get_training_guardrails` ng MCP server (opsyonal ang `topic`), at bawat pagtanggi ay naglalaman ng sarili nitong what/why/fix.
