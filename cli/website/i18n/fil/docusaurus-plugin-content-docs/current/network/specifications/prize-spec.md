---
sidebar_position: 8
title: "Espesipikasyon ng Gantimpala"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Espesipikasyon ng Gantimpala

Ang premyo ay ang bahaging pampasigla (incentive) ng kasunduang eval-first. Ang isang komunidad o
grupong pampananaliksik ay nagko-curate ng isang maliit at selyadong evaluation set — ilang daang pares,
bawat isa ay nasuri ([Corpus Partnership](/docs/network/specifications/corpus-partnership)
ang workflow na iyon). Ang isang sponsor ay naglalathala ng premyo laban sa isang target na marka sa
set na iyon. Mula sa sandaling iyon, ang wika ay nagiging isang palagiang hamon: sinumang
tagabuo ng pamamaraan sa buong mundo ay maaaring sumubok dito, sinusukat ng leaderboard ang bawat
pagtatangka sa publiko, at ang pamantayan ay itinatakda ng sariling answer key ng komunidad sa halip
na kung sino ang pinakamalakas sumigaw. Tinutukoy ng dokumentong ito kung paano gumagana ang gayong premyo —
mga kondisyon ng threshold, proseso ng pag-claim, mga klase ng dependency, at mga panuntunan —
upang ang pamantayan ay malinaw at method-agnostic kapag may nagbukas.

Ang mga premyo ay **pinopondohan ng sponsor at hawak ng sponsor**: ang pera ay nananatili sa
nag-iisponsor na organisasyon, o sa isang community trust na itinatalaga ng sponsor —
**hindi kailanman humahawak, nag-e-escrow, o nagpapadaloy ng mga pondo ng premyo ang Champollion.** Anumang komunidad
o organisasyon ay maaaring magpatakbo nito sa self-serve path sa
[Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest),
na hawak ang sarili nitong corpus at sarili nitong pera.

> **Katayuan: IPINAPANUKALA — walang premyong bukas, at wala pang maaaring i-claim dito.**
> Ang pumipigil sa *pagbubukas* ng isang premyo ay ang panig ng pagsukat: isang
> gold-standard na corpus na may pahintulot ng komunidad at ang speaker-review gate.
> Wala pa sa alinman dito ang umiiral. Kasama namang inilalabas ang air-gapped na evaluation sandbox — tingnan ang
> [Benchmark Spec §8.6](/docs/network/specifications/benchmark#86-dependency-classes-and-the-sandbox-network-policy).
> Wala pang marka sa site na ito ang nakapasa sa pamantayan ng premyo. Tingnan ang
> [Honest Limitations](/docs/network/honest-limitations). Sanggunian sa mga sukatan:
> ang [Scoring Spec](/docs/network/specifications/scoring); protocol:
> ang [Benchmark Spec](/docs/network/specifications/benchmark).

> **Live na ang promise layer.** Ang freeze na ginagawang hindi na mae-edit ang isang idineklarang tuntunin ng premyo
> kapag mayroon nang mga lahok, at ang mga pinigil na (`hidden_until_close`) resulta,
> ay ipinapatupad sa database sa network-hosted endpoint simula noong
> 2026-09-07. Ang isang federated host ay nakakakuha ng parehong mga panuntunan sa pamamagitan ng paglalapat ng migrasyon
> na kasama ng harness; laban sa isang mas lumang endpoint, ang harness ay bumabalik
> sa base set at hayagang sinasabi ito sa halip na magpanggap. Ang aggregates-only
> na egress rule sa §3.2 ay palaging ipinapatupad saanman.

---

## Nais ba ninyong tumulong na maipasok ang isang wika sa network?

Hindi ninyo kailangang maghintay ng gantimpala. Ang mga bagay na may pinakamataas na leverage na maaari ninyong gawin ngayon:

- **Mag-sponsor ng MT achievement prize.** Pondohan ang isang target na pamantayan — halimbawa, isang
  maaasahang English → Plains Cree method. Iko-coordinate ng Champollion ang
  pagsukat; mananatili ang pondo sa **inyo** (sa inyong organisasyon, o sa isang community
  trust na itatalaga ninyo) at igagawad ito ayon sa mga tuntunin ng komunidad (tingnan ang
  [Data Sovereignty](/docs/network/sovereignty/data-sovereignty)
  at ang [Economic Model](/docs/network/sovereignty/economic-model)). Ang
  end-to-end self-serve path ay dokumentado sa
  [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest);
  ang pagdadala ng bagong language pair ay nagsisimula sa isang
  [corpus partnership](/docs/network/specifications/corpus-partnership).
- **Mag-coordinate ng compute donation.** Pagsama-samahin ang API credits / tokens upang ang pampublikong
  queue ay makapag-map ng mas maraming pair at maipakita kung saan maaasahan — at hindi pa maaasahan — ang
  pagsasalin.
- **Suportahan ang mga open-source initiative na pinagbabatayan namin — *nang direkta*.** Ang Champollion
  ay plumbing na nagdurugtong sa bukás na gawain ng ibang tao; ang pagsuporta sa *kanila*
  ay pagsuporta sa mapang ito (mas nanaisin naming ituro kayo upstream kaysa kumuha ng kredito para sa
  kanilang trabaho):
  - [Tatoeba](https://tatoeba.org) — mga parallel sentence na kontribusyon ng komunidad
  - [Endangered Languages Catalog (ELCat)](https://www.endangeredlanguages.com) — datos tungkol sa endangerment
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — mga katalogo ng wika at typology
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — ang mga morphological transducer (FSTs)
  - [Masakhane](https://www.masakhane.io) — komunidad ng MT para sa mga wikang Aprikano
  - [OPUS](https://opus.nlpl.eu) — mga open parallel corpora

> Upang mag-sponsor ng premyo, mag-organisa ng donasyon ng compute, o talakayin ang pakikipagsosyo,
> makipag-ugnayan sa proyekto sa pamamagitan ng [GitHub](https://github.com/gamedaysuits). Wala pang mga community
> key custodian na naitalaga, at walang bansa o organisasyon na pinapangalanan
> bilang kasosyo bago ito magbigay ng pahintulot.

---

## 1. Pilosopiya

> **Ang kasunduan sa isang linya: i-crack ang isang wika, manalo, ayon sa idineklarang mga tuntunin ng host.**
> Sadyang isang operasyon sa ML-benchmarking ang Champollion — kompetisyon ang paraan kung paano nalulutas ang mahihirap na
> pares. Inaanyayahan namin ang mga mananaliksik sa ML at sinumang may-kakayahang tagabuo na bumuo ng
> pinakamahusay na pamamaraan para sa isang partikular na mahirap na pares ng wika at manalo ng premyo. Ang mangyayari sa
> pamamaraan pagkatapos ay ang inilathalang pagpipilian ng **host**, hindi sa amin at hindi isang
> default: ang isang komunidad na nais maipasa sa kanila ang nananalong pamamaraan ay nagsasabi nito sa mga
> tuntunin nito, at ang isa na nais lamang magsukat at magbura ay iyon ang sinasabi (§1.3).
> Tunay ang enerhiya ng kompetisyon, at nakatutok ito sa misyon — ang maisalin ang bawat
> wika, sa ilalim ng mga tuntuning itinakda ng mga tao nito — hindi sa pag-akyat sa leaderboard
> para lamang sa kapakanan nito.

### 1.1 Ginagantimpalaan ng mga Gantimpala ang mga Breakthrough, Hindi ang Paglahok

Ipinapalabas lamang ang prize money kapag ang isang method ay malinaw na nakamit ang isang tinukoy na capability threshold. Walang mga participation prize, runner-up award, o consolation payout. Kung walang makalampas sa pamantayan, walang mababayaran. Sinasadya ito — ibig sabihin, nagbabayad lamang ang mga sponsor para sa mga resultang talagang gumagana.

### 1.2 Hindi Maaaring Ikonsiderang Opsyonal ang Community Validation

Ang automated metrics ay mga proxy (SCORING_SPEC §1.1). Maaaring mataas ang score ng isang method sa chrF++ at FST acceptance habang lumilikha ng output na hindi tatanggapin ng kahit sinong tagapagsalita. **Bawat prize claim ay nangangailangan ng community validation** — kailangang kumpirmahin ng mga bilingual speaker na magagamit ang output. Ito ang human validation gate (BENCHMARK_SPEC §7).

### 1.3 Ang Mangyayari sa Nananalong Pamamaraan ay Idinideklara, Hindi Ipinapalagay {#1-3-declared-terms}

Isang bagay ang nakapirmi, dahil ito ang diwa ng isang sovereign contest: ang lahok ay ibinibigay sa sariling air-gapped node ng host, na nagpapatakbo nito laban sa isang selyadong set sa makina ng host. Ang mangyayari dito *pagkatapos* ay ang idineklarang pagpipilian ng host, na ginagawa bawat contest at inilalathala kasama nito — at ito ay **isa sa tatlong pagpipilian**:

| Ang tuntunin | Ang kahulugan nito para sa inyo |
|---|---|
| `pass_to_holders` — *pass to holders* | Ang pamamaraan ay ipapasa sa sovereign benchmark holders. Mamarkahan nila ito at itatago, sino man ang manalo. |
| `retain_ip` — *retain IP* | Mananatili sa inyo ang pagmamay-ari ng inyong pamamaraan. Mamarkahan ito ng host at magtatago lamang ng hindi hihigit sa isang selyadong kopya para sa pag-audit. |
| `release_open` — *release open* | Mananatili sa inyo ang pagmamay-ari ngunit dapat ninyong ilathala ang pamamaraan sa ilalim ng isang bukas na lisensya. Ang pagpapalabas na iyon ang kondisyon ng premyo. |

Ang lahat ng iba pang sumusunod mula sa isang tuntunin — kung ang artifact ay itatago, kung may anumang karapatang maililipat, kung saan ito maaaring gamitin ng host, kailan dapat ilabas ang release — ay **hinango** mula sa opsyong pinili ng host (§2.1, kondisyon 7), hindi isang hiwalay na kahon na mamarkahan ng host. Pipili ang host ng tuntunin; susunod ang detalye.

Dalawang kahihinatnan na nararapat sabihin nang malinaw:

- **Ang isang contest na walang idineklarang mga tuntunin ng premyo ay walang premyo.** Iyan ang default. Hindi ito mas mababang uri ng contest, at walang anuman tungkol sa lahok ang maililipat.
- **Walang ipinapahiwatig o ipinapalagay.** Ang idineklarang tuntunin ay hinahash, ipinapakita sa kalahok sa payak na wika, at tinatanggap sa pamamagitan ng hash na iyon; ang pagtanggap ay nakapaloob sa lahok at saklaw ng content hash nito, at tatanggihan ng node ng host ang isang lahok na tumanggap ng anupamang iba. Pagkatapos ay magpe-freeze ang tuntunin sa sandaling magkaroon ng unang lahok ang contest, upang walang sinumang mapilitang sumunod sa mga tuntuning hindi nila nabasa.

Kung saan pipiliin ng host ang `pass_to_holders`, nananatili pa rin sa developer ang mga karapatan sa attribution at paglalathala, at ang punto ng kasunduan ay ang pondong premyo ay gagamitin para tustusan ang teknolohiyang talagang magagamit ng komunidad ng wika. Magandang dahilan iyon para piliin ng isang community host ang tuntuning iyon. Ito ay isang pagpipilian, hindi isang panuntunan.

### 1.4 Anti-Gaming

Ang mga prize threshold ay tinutukoy laban sa **gold-standard evaluation** (secret test set, pinapatakbo ng governance org sa sandbox). Hindi kailanman nakikita ng mga developer ang test data. Ipinapatupad ito sa arkitektura — hindi isang patakarang umaasa sa dangal. Tingnan ang BENCHMARK_SPEC §8.2.

### 1.5 Corpus Licensing: Mananatili sa Labas ng Prize Lane ang Non-Commercial Corpora

Ang ilang corpus na ginagamit sa panahon ng pagbuo ng pamamaraan ay may mga di-komersyal na lisensya — halimbawa, ang EdTeKLA Cree Language Textbook corpus ay may **binagong CC BY-NC-SA ng EdTeKLA** (sovereignty-scoped, di-komersyal; ang pinagmulang textbook ay CC BY-NC-ND 4.0). Ang mga corpus na ito ay **pang-research/development-lane lamang**:

1. **Hindi dapat mag-embed ng NC-licensed corpus content ang prize gold-standard corpora.** Ang mga gold-standard test segment ay community-commissioned originals (tingnan ang Corpus Partnership Strategy) — human-authored para sa gantimpala, na may mga karapatang malinaw na inayos para sa evaluation at commercial deployment mula sa simula.
2. **Hindi dapat mag-embed ng NC-licensed corpus content ang isang method na nagki-claim ng gantimpala** (hal., bilang coaching data, embedded examples, o lookup tables). Dapat ma-deploy ng governance org ang nailipat na method sa anumang tuntuning pipiliin nito — kabilang ang commercially, kung iyon ang pasya ng komunidad (BENCHMARK_SPEC §8.3); malalason ng NC-licensed content sa loob nito ang kalayaang iyon.
3. **Malaya ang mga developer na gumamit ng NC-licensed corpora upang mag-develop at mag-self-evaluate** — iyon ang gamit ng development lane. Nalalapat ang restriction sa isinusumite at dine-deploy, hindi sa kung paano natututo ang developer.

### 1.6 Ang mga Dependency Class ang Nagga-gate ng Prize Eligibility

Nangyayari ang lahat ng prize evaluation sa isang sandbox (§1.4), at ang mga prize-winning method ay inililipat sa governance org (§1.3). Parehong nagpapataw ang dalawang katotohanang ito ng parehong constraint: **lahat ng pinagdedependensiyahan ng method ay dapat isang bagay na may karapatan ang developer na ilagay sa sandbox at ilipat sa komunidad.** Bawat submission ay nagdedeklara ng dependency class — tinukoy sa [Method Interface spec](/docs/network/specifications/methods#method-validity-and-dependency-classes) — at sumusunod ang eligibility sa class:

| Dependency class | Prize-eligible? | Mga kundisyon |
|------------------|----------------|------------|
| **S** — self-contained | ✅ Oo | Wala bukod sa mga threshold condition sa §2 |
| **O** — open external (hal., AGPL FST na naka-mirror sa submission) | ✅ Oo | Naka-pin ang artifacts at naka-vendor sa submission; pinahihintulutan ng licenses ang community transfer; pinananatili ang copyleft terms (natatanggap ng komunidad ang parehong mga karapatang ibinibigay ng license sa lahat) |
| **A1** — substitutable LLM inference | ⚠️ Kondisyonal | Idineklara, naka-pin, at substitutable ang model (dapat tumakbo laban sa community-hosted open-weight model); dumadaan ang evaluation sa sandbox LLM gateway (🔲 nakaplano — hindi makagagawa ang A1 methods ng gold-standard scores hanggang operational ang gateway); inililipat ang buong recipe (prompts, coaching, code), hindi ang model |
| **A2** — non-substitutable external data/service API | ❌ Hindi pa | Hindi eligible hanggang magbigay ang rights holder ng mga pahintulot para sa sandbox-inclusion at transfer. Pinapayagan sa open leaderboard na may nakikitang "external dependency" flag |
| **X** — bundled content na walang karapatan | ❌ Hindi kailanman | Hindi tinatanggap sa anumang lane |

Ang class ng isang method ay ang pinakamahigpit na class sa lahat ng idineklarang dependency nito. Ang mga hindi idineklarang dependency ng anumang class ay dahilan para ma-disqualify (§5).

---

## 2. Mga Iminumungkahing Prize Pool (wala pang bukas)

### 2.1 Ang Gantimpala ng Tagapagtatag — EN→Plains Cree (nêhiyawêwin)

| Field | Halaga |
|-------|-------|
| **Prize pool** | **$10,000 CAD** (iminumungkahi) |
| **Pares ng wika** | English → Plains Cree (EN→CRK) |
| **Nilalayong sponsor** | Tagapagtatag ng proyektong Champollion — isang nilalayong pangako, **wala pang pondo na hawak saanman.** Kapag naipangako na, ang pondo ay mananatili sa sponsor o sa isang itinalagang community trust — hindi kailanman sa Champollion. |
| **Katayuan** | **IPINAPANUKALA — hindi bukas.** Hindi tumatanggap ng mga pagsusumite. |
| **Magbubukas** | Tanging kapag umiiral na ang gold-standard na corpus at ang speaker-review gate (wala pa sa dalawa sa ngayon), napatunayan na ang evaluation sandbox gamit ang mga totoong modelo (sa ngayon ay nagpatakbo pa lamang ito ng isang toy method), at ang pondo ng sponsor ay mapatunayang hawak na alinsunod sa §4.2. |
| **Mag-e-expire** | Walang pag-expire kapag nabuksan na. |

#### Mga Threshold Condition

Makukuha ng isang method ang Gantimpala ng Tagapagtatag sa pamamagitan ng sabay-sabay na pagtugon sa **LAHAT** ng sumusunod na kundisyon:

| # | Kondisyon | Sukatan | Threshold | Rason |
|---|-----------|--------|-----------|-----------|
| 1 | ~~Composite score~~ — **itinigil na** | — | — | Ang kondisyong ito (composite ≥ 0.80) ay itinigil kasama ng composite noong 2026-10-04 ([Scoring Specification §4](/docs/network/specifications/scoring#4-composite-score)). Ang kondisyon sa marka ay chrF++ na lamang (kondisyon 3); pinanatili ang numero upang mapanatili ng iba pang mga kondisyon ang kanilang mga numero. |
| 2 | **Pagtanggap ng FST** (isang diagnostic gate, hindi ang marka) | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0.99 (99%+)** | Halos lahat ng output na salita ay dapat na mga morphologically valid na anyo na kinikilala ng GiellaLT FST. Ang 1% na palugit ay sumasaklaw sa mga edge case (mga pangngalang pantangi, neolohismo, hiram na salita) na maaaring lehitimong hindi saklaw ng FST. Ito ang pangunahing quality gate para sa polysynthetic MT — kung tatanggihan ng FST ang higit sa 1% ng mga salita, ang pamamaraan ay gumagawa ng mga anyong hindi umiiral sa wika. Ang buong layunin ng premyong ito ay bumili ng sistemang hindi sumisira sa mga salita. |
| 3 | **chrF++** (ang marka) | `chrf_plus_plus` (SCORING_SPEC §2.1), kasama ang sacreBLEU signature nito at 95% CI | **≥ 55.0** | Ang corpus chrF++ sa selyadong set ay dapat umabot sa 55 sa sukat na 0–100 — ang karaniwang headline metric ([Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored)). Inihahambing nito ang bawat output sa reference nito, kaya hindi ito matutugunan ng isang sistema gamit ang mga wastong salita na hindi naman nagsasalin sa input. |
| 4 | **Pagpapatunay ng komunidad** | Pagsusuri ng tao (BENCHMARK_SPEC §7) | **≥ 70% "katanggap-tanggap" o "mahusay"** | Ang isang stratified sample ng mga output (≥30 lahok sa buong difficulty tiers 2–5) ay susuriin ng ≥2 bilingguwal na tagapagsalita ng CRK. Hindi bababa sa 70% ng mga nasuring lahok ang dapat makatanggap ng rating na "katanggap-tanggap" o "mahusay". |
| 5 | **Gold-standard na ebalwasyon** | Pagpapatakbo sa sandbox (BENCHMARK_SPEC §8.2) | **Kinakailangan** | Ang lahat ng awtomatikong sukatan ay dapat kalkulahin laban sa segment ng corpus na `gold_standard`, na pinapatakbo ng governance org sa isang sandboxed na kapaligiran. Hindi binibilang ang mga marka sa development-set. |
| 6 | **Reproducibility** | Tugma sa fingerprint (BENCHMARK_SPEC §3.8) | **±2%** | Dapat maipatupad muli ng governance org ang pamamaraan at makamit ang mga markang nasa loob ng ±2% ng isinumiteng run card. |
| 7 | **Natugunan ang mga idineklarang tuntunin ng premyo sa contest** | Ang mga pagpapatunay na kinakailangan ng tuntuning iyon (tingnan sa ibaba) | **Kinakailangan** | Umiiral lamang ang mga premyo sa mga sovereign contest, kung saan ang inyong lahok ay pinapatakbo ng air-gapped node ng host sa isang selyadong set. Ang mangyayari dito *pagkatapos* ay isa sa tatlong idineklarang opsyon, na inilathala kasama ng contest bago magbukas ang mga pagsusumite — hindi isang solong kondisyon na ipinapataw ng bawat contest. |

#### Kondisyon 7 nang detalyado: ang tuntunin ay isa sa tatlong pagpipilian

Pare-pareho ang takbo ng bawat sovereign contest sa oras ng pagpapatupad: ibibigay ninyo ang inyong
pamamaraan (mga weight o code) sa air-gapped node ng host, at mamarkahan ito ng node
sa selyadong set. Iyon mismo ang ibig sabihin ng "sinukat ito ng host", at hindi ito
nababago.

Ang mangyayari *pagkatapos* noon ay ang pagpipilian ng host, na idinideklara bawat contest, at ito
ay isa sa tatlong opsyon. Inilalathala ito ng host bago magbukas ang mga pagsusumite; ito ay
**naka-freeze** sa sandaling magkaroon ng unang lahok ang contest, upang ang tuntuning inyong nabasa
ang tuntuning ipatutupad sa inyo.

| Ang tuntunin | Ang kahulugan nito para sa inyo |
|---|---|
| `pass_to_holders` — *pass to holders* | Ang pamamaraan ay ipapasa sa sovereign benchmark holders. Mamarkahan nila ito at itatago, sino man ang manalo. |
| `retain_ip` — *retain IP* | Mananatili sa inyo ang pagmamay-ari ng inyong pamamaraan. Mamarkahan ito ng host at magtatago lamang ng hindi hihigit sa isang selyadong kopya para sa pag-audit. |
| `release_open` — *release open* | Mananatili sa inyo ang pagmamay-ari ngunit dapat ninyong ilathala ang pamamaraan sa ilalim ng isang bukas na lisensya. Ang pagpapalabas na iyon ang kondisyon ng premyo. |

**Ang kahulugan ng bawat opsyon nang detalyado.** Ang apat na dimensyong ito — kasama ang lisensya
na kasabay ng kinakailangang pagpapalabas — ay *hinango* mula sa opsyon: ang isang host
ay hindi kailanman sumusulat ng `rights` o `host_use` nang manu-mano, at walang contest na maaaring maghalo at magtugma
ng mga ito:

| Field | `pass_to_holders` | `retain_ip` | `release_open` |
|---|---|---|---|
| `retention` — mananatili ba ang artifact pagkatapos ng pagmamarka? | `retain` | `retain_sealed_audit` | `retain` |
| `rights` — maililipat ba ang pagmamay-ari? | `assignment_to_host` | `participant_retains_all` | `participant_retains_all` |
| `host_use` — saan ito maaaring gamitin ng host? | `any` | `evaluation_only` | `any` (sa ilalim ng bukas na lisensyang inyong inilathala) |
| `release` — dapat ba **ninyo** itong ilathala, at kailan? | `not_required` | `not_required` | `required_before_prize` |
| `release_license` — sa ilalim ng aling lisensya ninyo ilalathala | — | — | `any_osi`, o isang pinangalanang SPDX identifier |

Pinapahintulutan ng dalawa sa mga opsyon ang host na paliitin ang saklaw ng isang field, at iyon lamang ang kabuuan nito:

- sa ilalim ng `retain_ip`, maaaring itakda ng host ang `retention` sa `delete_after_scoring` — ang inyong pamamaraan ay wawasakin kapag namarkahan na;
- sa ilalim ng `release_open`, maaaring ilipat ng host ang pagpapalabas sa `required_before_scores` (maglalathala kayo bago ilabas ang inyong sariling mga marka) o `required_after_prize` (maglalathala kayo pagkatapos ng bayad sa premyo), at maaaring pangalanan ang lisensya sa halip na tanggapin ang alinmang inaprubahan ng OSI.

Ang isang `community_terms_url` — isang `https://` link sa sariling nakasulat na mga tuntunin ng host —
ay maaaring sumama sa alinman sa tatlo. Sa mismong contest, ang napiling opsyon ay
itinala bilang `disposition` nito, at iyon ang nag-iisang halaga kung saan binabasa
ang lahat ng nasa itaas.

Ang anupamang iba ay tatanggihan kapag ginawa ang contest: hindi nag-aalok ang isang opsyon
ng field na hindi nito iniaalok, at ang isang field na isinulat nang manu-mano kung saan dapat itong
hinango ay tatanggihan ayon sa pangalan sa halip na tahimik na paniwalaan.

**Ang sinusuri bago bayaran ang premyo.** Ang mga kinakailangang beripikasyon ay sumusunod
mula sa tuntunin; walang host na nagko-configure sa mga ito nang hiwalay:

- **Handover** — palagi. Hawak ng host ang eksaktong artifact na namarkahan nito (ang
  naitalang method digest ng node). Sinusukat ang isang ito.
- **Release** — sa ilalim ng `release_open`, kapag dapat nang ilabas ang release bago ang mga marka
  o bago ang premyo. Itinatala ng host ang release URL at ang SHA-256 ng
  inilathalang artifact; sinusuri ang rekord, at ang URL ay hindi kailanman kinukuha (fetched), kaya ang isang
  naka-freeze na resulta ay hindi kailanman umaasa sa uptime ng iba. Ang isang release na kinakailangan
  *pagkatapos* ng premyo ay isang obligasyong dapat gampanan pagkatapos ng bayad, kaya hindi ito
  isa sa mga pagsusuri sa payout.
- **Assignment** — sa ilalim ng `pass_to_holders`, kung saan inililipat ang pagmamay-ari. Ang isang
  assignment ay isang kasulatang nilagdaan sa labas ng platform na ito; itinatala ito ng host
  at ang petsa nito, at bineberipika ng platform na umiiral ang isang rekord.
  **Hindi nito kailanman bineberipika ang batas.**

**Ang isang contest na walang idineklarang mga tuntunin ng premyo ay walang premyo.** Walang default na
tuntunin at walang ipinapalagay sa ngalan ng sinuman. Ang pagsali sa isang contest na
nagdedeklara nito ay nangangahulugang pagtanggap dito nang tahasan, sa pamamagitan ng hash nito, sa oras ng pagsusumite —
ang pagtanggap ay nakapaloob sa inyong bundle at bahagi ng sinusuri ng node ng host.

> **Bakit 99+% FST?** Ang pangunahing problema sa machine translation para sa mga polysynthetic na wika ay ang hallucination — lumilikha ang mga LLM ng mga string na *kamukha* ng target na wika ngunit morphologically invalid. Ang isang pamamaraan na lumilikha ng 95% na wastong output ay mayroon pa ring 5% na gawa-gawang salita — hindi katanggap-tanggap na ingay para sa anumang paggamit sa produksyon. Hinihingi ng 99%+ threshold ang halos zero na hallucination habang nagbibigay-daan para sa pambihirang edge case (isang pangngalang pantangi na hindi alam ng FST, isang lehitimong neolohismo). Kung ang isang pamamaraan ay hindi makakamit ang 99%+ pagtanggap ng FST, hindi nito nalutas ang problema.
>
> **Bakit magkasama ang chrF++ at FST, at bakit hindi sapat ang alinman sa dalawa.** Sinasabi lamang ng pagtanggap ng FST na umiiral ang bawat salita; ang isang sistemang nag-uulit ng isang wastong pangungusap para sa bawat input ay ganap na papasa rito. Inihahambing ng chrF++ ang bawat output sa reference nito, kaya nahuhuli nito iyon. Wala sa dalawang awtomatikong numerong ito ang nagpapatunay ng kalidad: ang community validation gate (kondisyon #4) ang nagpapatunay na nakikita ng mga tagapagsalita na magagamit ang output.

#### Ano ang Ibig Sabihin ng Threshold na Ito sa Praktika

Ang magkakasamang itinatatag ng mga kondisyon:

- **Halos bawat** output na salita ay isang totoong salitang Cree (pinapatunayan ng FST ang 99%+ — halos zero na mga gawa-gawang anyo)
- Malapit ang mga output sa mga reference sa selyadong set (chrF++ ≥ 55)
- Ang mga bilingguwal na tagapagsalita, sa ilalim ng sariling protocol ng komunidad, ay nagmarka sa hindi bababa sa 70% ng isang stratified sample bilang katanggap-tanggap o mas mataas pa — ang tanging kondisyong nagpapatunay sa kalidad
- Ang mga natitirang error ay mga error sa totoong wika (maling inflection, maling obviation, mga mismatch sa animacy) — hindi mga gawa-gawang salita

Ito ay isang system na **hindi bumabaluktot sa wika.** Maaaring hindi ito perpekto, ngunit bawat salitang nililikha nito ay tunay na salita. Iyon ang minimum bar para sa magalang na machine translation ng isang polysynthetic language.

---

## 3. Proseso ng Prize Claim

### 3.1 Pagpasok, pagkatapos ay pagsusumite

1. **Mag-qualify sa publiko.** Mamarkahan ng developer ang inilabas na dev set ng contest gamit ang kanilang sariling sistema at itatago ang resibo (`mt-eval contest qualify`). Ang resibo ay self-reported ayon sa disenyo — isa itong claim, at sinusuri ito ng host sa hakbang 4.

2. **Ibigay ang lahok.** Ang pagsali sa contest ay ginagawa sa pamamagitan ng pagbibigay sa node ng host ng isang bagay na maaari nitong patakbuhin, sa isa sa dalawang lane:
   - isang **modelo** — mga safetensors weight, isang declarative tokenizer at isang config, na walang code anuman (`mt-eval contest submit-model`); o
   - isang **pamamaraan** — isang Dockerfile at isang entrypoint, na naka-vendor upang mag-build at tumakbo nang walang network (`mt-eval contest submit-method`).

   Ang pag-upload ng mga salin ng isang inilabas na test set, at ang pag-link ng markang mismong inilathala ng developer, ay **itinigil na bilang mga paraan ng pagsali sa contest noong 2026-09-06** at tinanggal ang mga command. Ang mga self-reported na marka ay kabilang pa rin sa bukas na leaderboard, na isang pampublikong board na naka-index ayon sa corpus at direksyon ng pares — hindi isang contest, at hindi isang lane ng premyo.

3. **Ideklara, sa mismong lahok:** ang track (`constrained` — sinanay lamang sa data na pinayagan ng host — o `unconstrained`), ang bilang ng parameter, ang lisensya ng mga weight at kung ang mga ito ay pampubliko, ang training data kung saan nauugnay ang constrained claim, kung ito ba ang pangunahing lahok ng koponan o isang contrastive na lahok, at — kapag hinihingi ng contest — isang paglalarawan ng sistema. Ipinapasa rin ng developer ang `--agree` para sa mga tuntunin sa pagsusumite ng pamamaraan, at, kapag nagdedeklara ang contest ng mga tuntunin ng premyo, ang `--accept-terms <hash>` para sa mga iyon.

### 3.2 Evaluation

1. Patatakbuhin ng node ng host ang mga **static check** nito sa bundle, tatanggihan ang anupamang mangangailangan ng network, at tatanggihan ang isang lahok na tumanggap ng mga tuntunin ng premyo maliban sa idinideklara ng contest na ito.
2. Ang node **mismo ang muling magpapatupad ng qualifier**, sa sarili nitong kopya ng pampublikong dev set, gamit ang parehong lane executor at parehong scorer. Ang resibo ng developer ay isang claim; ito ang aktwal na pagsukat. Ang hindi pag-abot sa pamantayan ay itinatanggi rito — bago pa man hilingin sa sinumang custodian na mag-apruba ng anuman, at bago buksan ang selyadong set — kasama ang kung ano ang na-claim, kung ano ang nasukat, at kung ano ang naging pamantayan.
3. **Pahihintulutan ng mga custodian** ang selyadong run (M-of-N, ayon sa authorization model ng contest). Ang pahintulot ay single-use, may takdang oras, at nakatali sa eksaktong fingerprint na (bundle hash, corpus, bersyon ng corpus, node).
4. Tatakbo ang lahok laban sa `gold_standard` na selyadong corpus sa loob ng network-isolated na sandbox sa sariling makina ng host, at kinalkula ang mga awtomatikong sukatan (chrF++ kasama ang CI at signature nito, ang iba pang karaniwang sukatan, at mga diagnostic tulad ng pagtanggap ng FST). Ang isang idineklarang selyadong holdout at anumang third-party test suite ay tatakbo sa loob ng **parehong** awtorisadong run.
5. **Tanging mga aggregate score lamang ang lumalabas** — ipinapatupad sa database layer, hindi sa pamamagitan ng kumbensyon. Kung nangako ang contest ng `hidden_until_close`, pipigilin ang card hanggang sa mailathala ito sa pagsasara.
6. Kung natugunan ang mga awtomatikong threshold (mga kondisyon 2–3), magpapatuloy ang host sa pagsusuri ng komunidad. Kung hindi, matatanggap ng developer ang kanilang mga marka at walang pagsusuri ng komunidad na sisimulan.

### 3.3 Community Review

1. Isang stratified sample ng outputs (≥30 entries, sumasaklaw sa difficulty tiers 2–5) ang ihaharap sa mga bilingual speaker
2. Minimum na 2 independent reviewer ang magra-rate sa bawat entry
3. Rating scale: **reject** / **gist** / **acceptable** / **excellent**
4. Kung ≥70% ng entries ay makatanggap ng "acceptable" o "excellent" mula sa parehong reviewer, pumapasa ang community validation

### 3.4 Payout

Nakapirmi ang pagkakasunod-sunod: **na-verify ang mga idineklarang gate step → sarado ang contest → binayaran ang premyo.** Kung aling mga hakbang ang mga iyon ay nakadepende sa mga tuntuning idineklara ng contest na *ito* (§2.1, kondisyon 7) — ngunit anuman ang mga ito, bineberipika ang mga ito bago ang pagsasara, at walang binabayaran mula sa isang ranking na gumagalaw pa.

Maaaring mag-`close --force` ang isang tagapag-organisa lagpas sa isang hindi natugunang gate. Matutuloy ang pagsasara at itatala ng frozen ranking ang pagiging karapat-dapat sa premyo ng lahok na iyon nang eksakto tulad ng nakalkula — hindi karapat-dapat, na pinangalanan ang nabigong hakbang. Ang isang forced close ay isang saradong contest, hindi kailanman isang naipasang gate.

1. Natugunan ang lahat ng 7 kondisyon
2. **Naberipika ang bawat gate step na kinakailangan ng mga idineklarang tuntunin ng premyo ng contest** — palaging kasama ang handover ng namarkahang artifact, kasama ang isang naitalang release at/o isang naitalang assignment kapag hinihiling ng mga tuntuning iyon
3. Ang contest ay **sarado** at naka-freeze ang ranking nito
4. Kinukumpirma ng governance org ang resulta laban sa frozen ranking
5. Binabayaran ang premyo sa loob ng 30 araw pagkatapos ng kumpirmasyon
6. Anumang sinasabi ng mga idineklarang tuntunin tungkol sa pagmamay-ari ay magkakabisa tulad ng tinutukoy ng mga tuntuning iyon — para sa isang contest na ang `rights` ay `participant_retains_all`, walang anupamang maililipat
7. Inilalathala ang resulta sa leaderboard na may verification tier na "Community Validated"

### 3.5 Multiple Submissions

- Maaaring magsumite nang maraming beses ang parehong developer/team
- Bawat submission ay hiwalay na ie-evaluate
- Kung napabuti at muling isinumite ang isang method, ang pinakabagong run card lamang ang bibilangin
- Iginagawad ang gantimpala sa **unang** method na makakalampas sa lahat ng threshold — hindi ito paghahatian

### 3.6 Team Submissions

- Eligible ang mga team at mga pares na Elder-kabataan
- Responsibilidad ng team ang prize distribution sa loob ng team
- Dapat pirmahan ng lahat ng team member ang terms of participation
- Inililista ng attribution sa leaderboard ang lahat ng team member

---

## 4. Mga Prize Pool sa Hinaharap {#4-future-prize-pools}

Ang Gantimpala ng Tagapagtatag ang seed. Ang karagdagang prize pools ay pinopondohan ng mga sponsor. Idodokumento ang bawat bagong prize pool bilang bagong subsection ng §2 na may sarili nitong:

- Prize amount at currency
- Language pair
- Sponsor attribution
- Threshold conditions (na maaaring magkaiba sa Gantimpala ng Tagapagtatag)
- Expiry date (kung mayroon)
- Anumang special conditions

### 4.1 Sponsor Prize Template

Pinopondohan ng sponsors ang prize pools sa anumang halaga. Mga suggested tier:

| Tier | Halaga | Iminungkahing Threshold |
|------|--------|---------------------|
| **Seed** | $5,000–$15,000 | Isang chrF++ bar sa selyadong set, na inilathala bago magbukas ang contest + pagpapatunay ng komunidad |
| **Breakthrough** | $25,000–$50,000 | Isang mas mataas na chrF++ bar + pagpapatunay ng komunidad |
| **Grand Prize** | $100,000+ | Ang mga kondisyon ng Breakthrough + saklaw ng maramihang register + integrasyon sa pag-deploy |

Ang pamantayan ay palaging chrF++ (kasama ang signature nito, upang ito ay reproducible); ang mga diagnostic gate tulad ng pagtanggap ng FST ay maaaring idagdag, bilang mga gate. Ang isang composite o isang quality tier ay hindi maaaring maging prize threshold.

Maaari ding pondohan ng mga sponsor ang:
- **Mga improvement bounty** — nakapirming bayad para sa bawat 5-puntos na pagpapabuti sa chrF++ higit sa kasalukuyang pinakamahusay
- **Mga register prize** — hiwalay na mga parangal para sa mga partikular na register (pormal, seremonyal, pang-edukasyon)
- **Mga cost prize** — pinakamababang gastos bawat lahok sa mga pamamaraang pumapasa sa chrF++ bar (iniulat ang gastos sa tabi ng marka, hindi kailanman isinasama rito)

### 4.2 Saan Hinahawakan ang Prize Funds

Ang prize funds ay **hawak ng sponsor**: nasa sponsoring organization ang mga ito, o nasa isang community trust na itatalaga ng sponsor — **hindi kailanman sa Champollion**, na nagko-coordinate ng pagsukat at hindi humahawak ng pera. Ang isang credible prize ay naglalathala, bago ito magbukas: **sino ang humahawak ng pondo**, sa ilalim ng anong arrangement (organizational account, trust, o third-party escrow na pinili ng sponsor), at ang award threshold — upang ang pagkalampas sa pamantayan ay ma-verify mula sa published scores kasama ang speaker-validation verdict ng komunidad, at ang payment default ay makikitang pampubliko bilang ganoon. Walang prize funds na hawak saanman ngayon. Kung mag-expire ang isang prize nang hindi na-claim, mananatili ang pondo kung nasaan ito noon pa man — sa sponsor — upang i-redirect o bawiin ayon sa discretion ng sponsor. Ang self-serve mechanics, kabilang ang sponsor-default risk at mga mitigation nito, ay dokumentado sa [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) at sa [Terms Templates](/docs/network/sovereignty/terms-templates).

---

## 5. Disqualification

Madi-disqualify ang isang submission kung:

1. **Pagsasanay sa evaluation data.** Ang pamamaraan ay nalantad sa mga entry ng corpus na `gold_standard` o `held_out`. (Arkitektural na pinipigilan ng sandboxed execution — ngunit kung may makitang ebidensya ng kontaminasyon, mawawalan ng bisa ang resulta.)
2. **Hindi reproducible.** Hindi magawang muling kopyahin ng governance org ang mga marka sa loob ng ±2%.
3. **Hindi idineklara o hindi karapat-dapat na mga dependency.** Ang pamamaraan ay nangangailangan ng runtime access sa mga panlabas na serbisyo lampas sa idinideklara ng dependency manifest nito, o ang epektibong dependency class nito ay A2 o X (§1.6). Ang idineklarang Class A1 LLM inference na niruruta sa pamamagitan ng evaluation gateway ay pinahihintulutan; ang anumang iba pang runtime network dependency — at anumang hindi idineklarang dependency ng anumang klase — ay magdudulot ng diskwalipikasyon.
4. **Hindi nilagdaan ang mga tuntunin ng paglahok.** Ang lahat ng miyembro ng koponan ay dapat sumang-ayon sa mga tuntunin sa pagsusumite ng pamamaraan, at — kapag nagdedeklara ang contest ng mga tuntunin ng premyo (§1.3) — sa mga iyon, sa pamamagitan ng hash.
5. **Natuklasang panlalamang (gaming).** Ang output ay na-optimize para sa sukatan sa halip na sa kalidad ng pagsasalin (nahuhuli sa pamamagitan ng pagsusuri ng komunidad at/o mga anti-gaming check alinsunod sa BENCHMARK_SPEC §9.3).

---

## 6. Relasyon sa Ibang Specs

| Dokumentong Ito | Mga Sanggunian | Para sa |
|--------------|-----------|-----|
| §2 mga kondisyon ng threshold | SCORING_SPEC "How runs are scored" at §2.1–2.2 (mga sukatan) | Mga depinisyon at sukat ng sukatan |
| §2 pagpapatunay ng komunidad | BENCHMARK_SPEC §7 | Protocol sa pagsusuri ng tao |
| §3 pagpapatakbo sa sandbox | BENCHMARK_SPEC §8.2 | Mekanismo ng soberanya |
| §1.3 idineklarang mga tuntunin ng premyo | BENCHMARK_SPEC §8.3 | Kung ano ang maaaring gawin ng host sa isang lahok pagkatapos |
| §1.6 mga klase ng dependency | Method Interface spec; BENCHMARK_SPEC §8.6 | Mga depinisyon ng klase, mga tuntunin ng pagtanggap, patakaran sa network ng sandbox |
| §4 mga cost prize | SCORING_SPEC §6.2 | Mga formula ng sukatan ng gastos |

---

## 7. Code–Spec Synchronization

### 7.1 Canonical Source

Ang dokumentong ito (`cli/website/docs/network/specifications/prize-spec.md`) ang canonical source para sa:
- Prize pool definitions (§2)
- Threshold conditions (§2.x)
- Claim process (§3)
- Disqualification rules (§5)

### 7.2 Mga Kinakailangan sa Pagpapatupad

Kapag na-activate ang isang prize pool:
1. Dapat ipakita ng leaderboard UI ang mga aktibong premyo at ang kanilang mga kondisyon ng threshold
2. Ang mga run card na nakakatugon sa mga awtomatikong threshold (mga kondisyon 2–3) ay dapat i-flag para sa pagsusuri ng komunidad
3. Walang quality tier na ginagamit: ang field na `quality_tier` ay null sa bawat bagong run card (scoring standard/1)
4. Kasama nang inilalabas ang prize **terms** layer (`contest_prize_terms` — deklarasyon, hash, pagtanggap, at ang payout gate), at ang mismong pagmamarka ay hindi nagbabago. Ang idinaragdag ng isang bagong prize pool ay ang patakaran sa threshold sa §2 at ang pagpapakita sa leaderboard sa mga aytem 1–2 sa itaas

---

*Ang isang istruktura ng premyo ay dapat na katugma ng mga tuntunin ng premyo na idinideklara ng parehong contest (§1.3). Ang mga tuntuning iyon ay pagpipilian ng host sa bawat dimensyon — mula sa "markahan ito, burahin ito, mananatili ang lahat ng karapatan sa kalahok" hanggang sa "ibibigay ninyo ito, mamarkahan namin ito at itatago ano man ang mangyari" — at ang mga ito ay inilalathala, hinahash at tinatanggap bago pa man may sumali. Ang isang community host na nagnanais na ang nananalong pamamaraan ay maging pag-aari ng komunidad ay maaaring magdeklara ng eksaktong iyon, at ang premyo ay magpopondo sa paglikha ng teknolohiyang pag-aari ng komunidad ng wika. Walang anuman dito ang nagpapalagay nito sa ngalan ng sinumang host.*
