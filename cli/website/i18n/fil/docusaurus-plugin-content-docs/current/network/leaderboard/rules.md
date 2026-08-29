---
sidebar_position: 1
title: "Mga Tuntunin sa Pagsusumite"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How the composite score is computed"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# MT Evaluation

> **Executive Summary.** Tinutukoy ng pahinang ito ang pamantayan sa pagsusumite sa leaderboard, mga scoring metric (chrF++, FST acceptance, exact match, equivalent match, semantic score), mga patakaran laban sa pagmamanipula, mga verification tier, at workflow ng pagsusumite. Ang mga method na na-expose sa evaluation data ay madidiskuwalipika.

Kasama sa champollion ang isang machine translation evaluation framework na idinisenyo para sa **reproducible benchmarking** ng mga translation method — lalo na para sa mga low-resource at Katutubong wika kung saan walang karaniwang MT benchmark at mahirap beripikahin ang mga claim sa kalidad.

---

## Ang Leaderboard

Ang pinakasentro po ay ang **[Method Leaderboard](https://champollion.dev/leaderboard)** — isang pampublikong scoreboard, live at **bukas para sa mga submission**, kung saan ang mga mananaliksik at miyembro ng komunidad ay nagpapasa at naghahambing ng mga translation method na may fingerprinted at reproducible na evaluation.

Kasama sa bawat submission ang:

- **Fingerprinted pipeline** — nakatali sa isang partikular na Git commit at config hash, kaya ang mga resulta ay matutunton pabalik sa eksaktong code na gumawa sa mga ito
- **Versioned dataset** — naka-content-hash at naka-version; ang mga score ay maaari lamang ihambing sa loob ng parehong dataset version
- **Standardised metrics** — ang lahat ng pag-score ay kinakalkula ng iisang shared evaluation harness, na nag-aalis ng mga pagkakaiba sa implementation
- **Trust tiers** — self-benchmarked, Champollion Verified, o Community Validated
- **Cost tracking** — API cost bawat submission, kaya ang mga cost–quality tradeoff ay malinaw

Sinusukat ng leaderboard ang limang metric. Tatlo ang gumagana para sa anumang wika; dalawa ang available para sa Plains Cree at gagawing pangkalahatan habang lumalawak tayo:

| Metric | Uri | Ano ang Sinusukat Nito |
|--------|------|------------------|
| **chrF++** | Character n-gram F-score | Pangunahing quality metric — mahusay ang correlation sa human judgement, lalo na para sa mga wikang may mayamang morphology |
| **Exact Match** | Proporsyon ng mga perfect match | Mahigpit na accuracy — gaano kadalas eksaktong katulad ng gold standard ang translation? |
| **FST Acceptance** | Morphological gate pass rate | Para sa mga method na may finite-state transducer verification — anong proporsyon ng mga output ang morphologically valid? |
| **Equivalent Match** | Acceptable variant rate | Fraction na tumutugma sa reference o sa isang acceptable variant (word order, orthographic convention). Kasalukuyang CRK; ginagawang pangkalahatan. |
| **Semantic Score** | Semantic fidelity | Pagpapanatili ng kahulugan — nakukuha ba ng translation ang nilalayong kahulugan anuman ang surface form? Kasalukuyang CRK; ginagawang pangkalahatan. |

:::info[Kumpletong Suite ng Sukatan]
Tinutukoy ng [Espesipikasyon ng Pagmamarka](/docs/network/specifications/scoring) ang kumpletong imbentaryo ng mga sukatan (anim na kategorya: surface, structural, semantic, behavioral, compliance, at reported comparators), formula ng composite score, mga talahanayan ng weight, at mga threshold ng quality tier.
:::

**[→ Tingnan ang leaderboard](https://champollion.dev/leaderboard)**

---

## Mga Available na Dataset

### EDTeKLA Development Set v1

Ang unang evaluation dataset, na binuo para sa English→Plains Cree (SRO) translation. Ginawa ng [EdTeKLA research group](https://spaces.facsci.ualberta.ca/edtekla/) sa University of Alberta.

| Property | Value |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Language pair** | EN → CRK (Plains Cree, SRO orthography) |
| **Entry count** | 436-entry dev split (`textbook_dev.json`); ang buong breakdown ay nakasaad nang minsan sa [Evaluation Datasets page](/docs/network/leaderboard/datasets#edtekla-development-set-v1) |
| **License** | [EdTeKLA's modified CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, sovereignty-scoped) — non-commercial; inihiwalay mula sa leaderboard, prize, at commercial/API lanes |
| **Provenance** | `gold_standard` (na-verify ng mga speaker), `textbook` (mga inilathalang educational material) |

### FLORES+ Devtest — Para Lamang sa Development Use

> [!WARNING]
> **Available ang FLORES+ para sa development at debugging ngunit HINDI ito ginagamit para sa official leaderboard evaluation.** Ang FLORES+ (orihinal na Meta FLORES-200) ay isang malawak na pampublikong benchmark dataset na halos tiyak na na-train na ng frontier LLMs. Ang mga score laban sa FLORES+ ay hindi maaasahang nagpapakita ng real-world translation quality para sa mga LLM-based method. Hindi gaanong apektado ang mga non-LLM method (FST, rule-based, fine-tuned NMT) ngunit hindi pa rin pinu-publish sa leaderboard ang mga FLORES+ score.

Nananatiling available ang FLORES+ fixtures sa `test/benchmark/fixtures/` para sa pipeline smoke testing, cross-language validation, at development use. Gumagamit ang official evaluation ng mga custom corpora na binuo mula sa human-authored text na hindi publicly available sa parallel form.

Tingnan ang [Evaluation Datasets](/docs/network/leaderboard/datasets) para sa buong dataset schema, difficulty tiers, at kung paano gumawa ng sarili ninyo.

:::danger[HUWAG MAG-TRAIN sa datos ng pagsusuri]

**Ang mga dataset na ito ay para lamang sa evaluation.** Ang mga method na na-train, na-fine-tune, na-few-shot-prompt, o sa anumang paraan ay na-expose sa evaluation data ay magbubunga ng artipisyal na pinataas na mga score at **madidiskuwalipika mula sa leaderboard.**

Hindi ito mungkahi — ito ang nag-iisang pinakamahalagang tuntunin ng integridad ng evaluation. Gumamit ng hiwalay na corpora para sa training. Dapat manatiling hindi nakikita ng inyong model ang mga evaluation set habang nasa development.

Kung gumagamit kayo ng coaching data o few-shot examples, dapat manggaling ang mga iyon sa **ganap na hiwalay na mga source**. Kung may alinlangan, huwag itong isama.
:::

:::warning[Non-determinism ng LLM]

Non-deterministic ang mga LLM output. Kinakatawan ng mga score ang point-in-time measurements sa ilalim ng partikular na model versions at API configurations. Maaaring i-update ng mga model provider ang weights, decoding strategies, o safety filters anumang oras, na maaaring magdulot ng score drift sa pagitan ng mga run. Itinatala ng leaderboard ang eksaktong model slug at timestamp para sa bawat submission.
:::

---

## Ano ang Bumubuo sa Isang Mahusay na Method

Hindi pantay-pantay ang lahat ng method. Narito ang naghihiwalay sa masusing gawa mula sa mga pinalobong score.

### Mga katangian ng isang matibay na method

- **Malinis na paghihiwalay ng train at eval data** — hindi kailanman nakita ng inyong method ang evaluation set habang nasa development, tuning, prompt engineering, o pagpili ng few-shot example
- **Reproducible** — maaaring i-clone ng ibang tao ang inyong repo, patakbuhin ang harness, at makuha ang parehong mga score (sa loob ng hangganan ng LLM non-determinism)
- **Documented** — inilalarawan ng inyong [method card](/docs/network/specifications/methods) kung ano ang ginagawa ng inyong method, anong tools ang ginagamit nito, at ano ang mga limitasyon nito
- **Tapat tungkol sa scope** — kung gumagana lamang ang inyong method para sa isang language pair, sabihin ito; kung bumababa ang performance nito sa ilang morphological pattern, i-document iyon
- **May kamalayan sa komunidad** — para sa mga Katutubong wika, iginagalang ng inyong method ang data sovereignty. Kumonsulta kayo sa mga language community o gumamit lamang ng openly licensed data

### Mga red flag (ano ang nagdudulot ng disqualification)

| Red Flag | Bakit Ito Problema |
|----------|--------------------|
| Training sa eval data | Ganap na binabalewala ang layunin ng evaluation. Nililinlang ng pinalobong score ang lahat. |
| Cherry-picking ng mga resulta | Pagpapatakbo nang 10 beses at pagsusumite ng pinakamahusay na run nang hindi idinedeklara ang iba |
| Hindi idineklarang post-processing | Manu-manong pag-aayos ng mga output bago ang scoring |
| Kontaminadong coaching data | Paggamit ng mga halimbawa mula sa eval set bilang few-shot prompts o dictionary entries |
| Pag-claim ng commercial readiness nang walang provenance | Kung gumagamit ang inyong method ng CC BY-NC-SA data, hindi ito commercially ready |

### Mga verification tier

Inilalarawan ng mga verification tier kung **sino ang nag-validate sa resulta** — hiwalay sa mga quality tier (Baseline → Fluent) na tinukoy sa [Scoring Specification, §5](/docs/network/specifications/scoring#5-quality-tiers), na naglalarawan kung ano ang ibig sabihin ng automated composite score.

| Tier | Meaning | How to Get It |
|------|---------|--------------|
| **Self-benchmarked** | Kayo po mismo ang nagpatakbo ng harness at nagsumite ng mga resulta | I-publish ang inyong run card gamit ang `mt-eval publish` |
| **Champollion Verified** | Malayang muling ini-score ng server ang inyong mga isinumiteng output laban sa sha-pinned reference corpus at na-reproduce ang inyong score | Automatic — bawat submission ay muling ini-score (tingnan sa ibaba) |
| **Community Validated** | Ang mga bilingual speaker ng target language, na kwalipikado sa ilalim ng sariling protocol ng komunidad, ay sumuri sa isang stratified sample ng output (≥30 entries, ≥2 reviewers) at ≥70% ang nakapasa sa pamantayan ng komunidad. Iginagawad lamang sa pamamagitan ng sariling testing ng komunidad; ang demotion sa pamamagitan ng spot-audit ay symmetric | Isumite ang method code sa governance org — patatakbuhin nila ito laban sa gold-standard set at isasailalim ang output sa pagsusuri ng komunidad |

### Paano nag-i-scale ang verification: reputation-weighted auditing

**Hindi po namin inaangkin ang provenance.** Ang isang leaderboard row ay ginagawa ng isang contributor na nagpapatakbo ng *open-source* harness sa kanilang *sariling* machine. Ang "Ang run na ito ay talagang dumaan sa harness" ay hindi isang bagay na mabe-verify ng server para sa self-hosted compute — ang signing key ng harness ay nasa kamay ng contributor, kaya ang isang signature ay nag-a-authenticate ng isang *machine, hindi ng katapatan*. Sa halip na magpanggap, **ang validity rito ay pinaghihirapan at self-correcting**: ang isang row ay mapagkakatiwalaan dahil ang score nito ay **reproducible** at dahil ang contributor sa likod nito ay **itinaya ang isang reputasyon na masisira kapag nahuling nandaya.** Ang verification ay pinapatakbo sa apat na layer, kaya ito ay masusi kung saan kinakailangan at mura kung saan maaari — hindi kailanman kailangang muling patakbuhin ng proyekto ang gawa ng lahat.

- **L0 — re-score everything (libre, 100%).** Muling kinukuha ng server ang inyong score mula sa *inyong sariling isinumiteng mga output* laban sa **sha-pinned reference corpus** (hindi sa inyong naka-store na kopya nito), gamit ang parehong metric na ginagamit ng harness. Kung hindi ma-reproduce ang score mula sa mga output, o kung may binagong naka-store na reference, ang run ay madi-**disqualify** — ito pa lamang ay sapat na para alisin ang isang nai-type o na-edit na score. Ang isang run na na-reproduce ay ipo-promote sa **Champollion Verified**, ang tanging tier na nira-rank ng board. Tumatakbo po ito sa bawat submission at inaabot lamang ng ilang millisecond.
- **L1 — a contributor reputation ladder.** Ang bawat contributor (na kinikilala sa pamamagitan ng kanilang sign-in) ay nakakakuha ng reputasyon *lamang* sa pamamagitan ng pagpasa sa mas malalalim na pagsusuri sa ibaba — hindi kailanman sa dami lamang, kaya walang mapapala sa paggawa ng mga bagong identity. Ang reputasyon ay **pampubliko**, at ito ang nagpapasya kung gaano kadalas isasagawa ang mahal na pagsusuri.
- **L2 — re-run a *sample* (ang mahal na pagsusuri).** Para sa isang *pampublikong* development set, hindi mahuhuli ng L0 ang isang contributor na kumopya lamang sa reference bilang kanilang "translation." Upang mahuli iyon, kailangang talagang muling patakbuhin ang model — totoong compute — kaya ginagawa po namin ito sa isang **sample**, hindi sa lahat. Ang isang run ay isasailalim sa sample para sa isang L2 re-run na may probability na tumataas batay sa **stakes** (ang isang run na nagbubukas ng unang tulay sa isang buong language family ay *palaging* muling pinapatakbo), tumataas batay sa **anomaly** (ang isang masyadong-maganda-para-maging-totoong pag-angat mula sa nakaraang pinakamahusay ay *palaging* muling pinapatakbo), at bumababa batay sa **reputation** (ang isang contributor na nakapasa sa maraming audit ay bihirang i-spot-check; ang isang baguhan o anonymous na nagsumite ay sinusuri sa bawat run hanggang sa makuha nila ang tiwala). Ang pagpasa sa isang L2 audit ay nagpapataas ng reputasyon.
- **L3 — corroboration (libreng verification).** Kapag ang dalawang *independent* na contributor ay nagpatakbo ng parehong model sa parehong corpus at ang kanilang mga muling ini-score na output ay **nagkatugma**, ang pagkakatugmang iyon *ay* isang verification — at pinapataas nito ang reputasyon nilang dalawa. Ang isang tunay na **hindi pagkakatugma** ay mag-fa-flag sa parehong run para sa isang L2 audit. Ang replication ay ginagantimpalaan sa halip na ituring na redundant.

**Ang isang nahuling pandaraya ay catastrophic — tulad ng isang retraction.** Ang isang napatunayang pandaraya ay mag-ze-zero sa reputasyon ng contributor, **muling i-o-audit ang kanilang buong verified history** (bawat isa sa kanilang mga verified run ay ibabalik sa verification), at itatala nang **pampubliko** sa audit log. Iyan po ang dahilan kung bakit ligtas ang light sampling: ang pandaraya sa isang pampublikong dev set ay maaaring makalusot sa isang run, ngunit ang inaasahang kapalit — ang pagkawala ng lahat ng pinaghirapang tiwala at ang muling pagsusuri sa inyong buong record — ay ginagawa itong isang masamang sugal. Ang mga panuntunang ito ay pantay na sumasaklaw sa sariling mga run ng mga maintainer.

**Bakit sulit pa rin ang mag-contribute.** Kayo po palagi ang nagbabayad sa mahal na bahagi (ang pagpapatakbo ng inyong method); ang proyekto ay nagbabayad lamang para sa libreng L0 re-score sa lahat at sa isang L2 re-run sa isang *lumiliit na sample* — mataas para sa mga baguhan at sa mga high-stakes run, mababa para sa mga subok nang contributor. Ang halaga ng verification ay *ina-amortize ng reputasyon at pinaghahati-hatian sa pamamagitan ng corroboration*, hindi binabayaran nang buo sa bawat pagkakataon.

---

## Paano Magsumite

1. **Build your method** — tingnan po ang [Building a Method](/docs/network/specifications/methods) para sa method interface
2. **Run the harness** — tingnan po ang [Eval Harness](/docs/network/specifications/harness) para sa setup at paggamit
3. **Generate a run card** — ang harness ay gumagawa ng isang JSON run card na naglalaman ng inyong mga score, fingerprint, at metadata
4. **Publish** — ina-upload ng `mt-eval publish eval/logs/harness/<your-run-card>.json` ang run card sa leaderboard
5. **Appear on the leaderboard** — ang inyong run ay isa-stage bilang *self-benchmarked (unverified)*, pagkatapos ay awtomatikong muling i-i-score ng server ang inyong mga output laban sa sha-pinned corpus (L0); kapag na-reproduce ito, ang run ay ipo-promote sa *Champollion Verified* — ang tanging tier na nira-rank ng [Method Leaderboard](https://champollion.dev/leaderboard). Ang mas malalim na reputation-weighted auditing ay sumusunod sa mga trust tier sa itaas

---

## Integrity Policy: Retractions, Re-runs, Delisting, Disputes

Isinulat po ito nang maaga upang ang pagpapatupad ay maging isang pamamaraan (procedure), hindi drama. Ang mga panuntunang ito ay pantay na sumasaklaw sa lahat — kabilang ang sariling mga run ng mga maintainer.

**Walang mga retraction.** Ang isang na-publish na run ay isang permanenteng record. Wala pong mekanismo — para sa sinuman — upang burahin ang isang score dahil ito ay nakakahiya. Ang bawat run row ay may dalang server-stamped na `submitted_at` timestamp at isang immutable na audit trail; ang mga moderation action mismo ay naka-log.

**Ang mga re-run ay nag-a-append, hindi kailanman nagre-replace.** Kung pagbubutihin ninyo ang inyong method, mag-publish po ng bagong run. Mananatili ang lumang run. Ang selective disclosure — ang pribadong pag-test sa maraming variant at pag-publish lamang sa nanalo — ang dahilan kung bakit madaling dayain ang ibang mga leaderboard; ang isang append-only na record ang istruktural na solusyon dito. Pinipigilan ng fingerprint de-duplication ang byte-identical na resubmission spam; hindi nito kailanman binabago ang kasaysayan.

**Ang delisting ay rule-execution, kung saan pinapangalanan ang panuntunan.** Ang isang run ay idi-delist (mamarkahan ng `disqualified`, nang nakikita — hindi tahimik na aalisin) lamang para sa mga nakalistang dahilan: isang naka-quarantine o improper-subset na dataset (ipinapatupad ng database trigger sa ilalim ng bawat client), corpus-checksum mismatch, gawa-gawa o out-of-range na mga score, mga content-guard violation, o ang pagbawi ng isang steward sa rehistrasyon ng pinagbabatayang data. Pinapangalanan ng delisting ang panuntunan at ang ebidensya. Ang mga bagong dahilan ay idinaragdag dito sa pamamagitan ng may-petsang pag-edit bago pa man ito i-apply, at hindi kailanman retroactively na iniimbento para sa isang kaso.

**Ang mga trust tier ay mga label, hindi mga edit.** Ang mga `self-benchmarked` row ay mga claim; ang mga `Champollion Verified` row ay malayang muling ini-score mula sa mga output ng nagsumite laban sa sha-pinned corpus; ang `Community Validated` ay iginagawad lamang sa pamamagitan ng sariling testing ng komunidad. Binabago ng verification ang tier ng isang row — hindi nito kailanman binabago ang mga score ng row.

**Ang reputasyon ay pampubliko at self-correcting.** Ang reputasyon ng contributor, at ang audit log na nagtatala ng bawat re-score, sampled re-run, corroboration, at fabrication burn, ay pampubliko. Ang reputasyon ay hindi isang score multiplier at hindi kailanman ginagalaw ang mga numero ng isang run — itinatakda lamang nito kung gaano kadalas muling i-o-audit ang mga run ng isang contributor (tingnan ang *reputation-weighted auditing* sa itaas). Ang isang napatunayang pandaraya ay itinatala nang kasing-pampubliko ng isang retraction at muling i-o-audit ang buong verified history ng contributor; ang parehong mga panuntunan ay sumasaklaw sa sariling mga run ng mga maintainer.

**Mga Dispute.** Mag-open po ng isang issue kasama ang run id at ang partikular na claim (maling score, maling dataset, maling pag-apply ng panuntunan). Muling patatakbuhin ng mga maintainer ang mga deterministic check sa publiko; ang kalalabasan at ang ebidensya nito ay ilalagay sa issue. Kung ang dispute ay tungkol sa data o validation ng isang komunidad, ang sariling awtoridad ng komunidad ang magpapasya at ipapatupad ng board ang kanilang desisyon. Para sa mga prize contest, ang parehong mga panuntunan ay sumasaklaw kasama ang pre-published na qualifier at mga audit step ng contest — ang mga nanalo ay ino-audit **bago** ang payout, at ang isang disqualification ay bumabanggit sa panuntunan nang eksakto tulad ng anumang iba pang delisting.

## Mga Direksiyon sa Hinaharap

- **Comprehensive model comparison runs** — sistematikong evaluation ng frontier models (GPT-4o, Claude, Gemini, atbp.) sa mga wika ng champollion gamit ang custom evaluation corpora (hindi mga pampublikong benchmark)
- **Mas maraming language pair** — Quechua, Inuktitut, at iba pang low-resource languages habang nagiging available ang mga community-verified dataset
- **Dataset import** — tooling upang i-convert ang external evaluation datasets (WMT, Tatoeba, atbp.) sa champollion evaluation format
- **Automated re-runs** — pag-detect ng mga pagbabago sa model version at muling pagpapatakbo ng benchmarks upang i-track ang score drift

---

## Tingnan Din

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — live scores at submissions
- **[Eval Harness](/docs/network/specifications/harness)** — kung paano magpatakbo ng evaluations
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — dataset format at available datasets
- **[Building a Method](/docs/network/specifications/methods)** — ang method interface specification
- **[Run Card Specification](/docs/network/specifications/run-card)** — ang run card JSON schema
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — evaluation protocol, corpus format, sovereignty
- **[Scoring Specification](/docs/network/specifications/scoring)** — SSOT para sa metrics, composite weights, at quality tiers
