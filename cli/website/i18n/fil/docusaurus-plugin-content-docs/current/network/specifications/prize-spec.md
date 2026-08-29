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

Ang premyo ay ang kalahating insentibo ng kasunduang eval-first. Isang komunidad o grupo ng pananaliksik ang nangangalaga sa isang maliit at selyadong evaluation set — ilang daang pares, na ang bawat isa ay nasuri na (ang [Corpus Partnership](/docs/network/specifications/corpus-partnership) ay ang workflow na iyon). Isang sponsor ang nag-aalok ng premyo batay sa isang target na marka sa set na iyon. Mula sa sandaling iyon, ang wika ay nagiging isang patuloy na hamon: sinumang tagabuo ng pamamaraan sa mundo ay maaaring subukan ito, sinusukat ng leaderboard ang bawat pagtatangka sa publiko, at ang pamantayan ay itinatakda ng sariling answer key ng komunidad sa halip na kung sino ang may pinakamalakas na boses. Tinutukoy po ng dokumentong ito kung paano gumagana ang gayong premyo — mga kondisyon ng threshold, proseso ng pag-claim, mga klase ng dependency, at mga panuntunan — upang ang pamantayan ay malinaw at method-agnostic kapag may nagbukas na premyo.

Ang mga premyo ay **pinopondohan ng sponsor at hawak ng sponsor**: ang pera ay nananatili sa nag-isponsor na organisasyon, o sa isang community trust na itinalaga ng sponsor — **ang Champollion ay hindi kailanman humahawak, nag-e-escrow, o nagpapadaan ng mga pondo ng premyo.** Maaari pong magpatakbo ang anumang komunidad o organisasyon ng isa sa self-serve path sa [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest), kung saan hawak nila ang kanilang sariling corpus at sariling pera.

> **Katayuan: PROPOSED — walang bukas na premyo, at wala pa pong maaaring i-claim dito.**
> Ang naglilimita sa *pagbubukas* ng premyo ay ang bahagi ng pagsukat: isang gold-standard corpus na pinahintulutan ng komunidad, ang air-gapped evaluation sandbox (tinukoy na, ngunit hindi pa nabubuo), at ang speaker-review gate. Wala pa pong marka sa site na ito ang nakapasa sa pamantayan ng premyo. Tingnan po ang [Honest Limitations](/docs/network/honest-limitations). Sanggunian sa mga sukatan: ang [Scoring Spec](/docs/network/specifications/scoring); protocol: ang [Benchmark Spec](/docs/network/specifications/benchmark).

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

> Upang mag-sponsor ng gantimpala, mag-organisa ng compute donation, o talakayin ang partnership,
> makipag-ugnayan sa proyekto sa pamamagitan ng [GitHub](https://github.com/gamedaysuits). Ang mga community key
> custodian ay nasa confirmation; walang bansa o organisasyon ang pinapangalanan bilang partner
> bago ito magbigay ng pahintulot.

---

## 1. Pilosopiya

> **Ang kasunduan sa isang linya: lutasin ang isang wika, manalo, ibalik ito.** Ang Champollion ay isang
> ML-benchmarking operation nang sinasadya — competition ang paraan upang malutas ang mahihirap na pair.
> Inaanyayahan namin ang mga ML researcher at sinumang may kakayahang builder na bumuo ng pinakamahusay na method para sa isang
> partikular na mahirap na language pair, manalo ng gantimpala, **at** ibigay ang resultang method sa
> sovereignty organization na nagmamay-ari ng wikang iyon (§1.3). Totoo ang competitive
> energy, at nakatuon ito sa misyon — maisalin ang bawat wika,
> sa ilalim ng mga tuntuning itinakda ng mga tao nito — hindi sa pag-akyat sa leaderboard para sa
> sarili nitong kapakanan.

### 1.1 Ginagantimpalaan ng mga Gantimpala ang mga Breakthrough, Hindi ang Paglahok

Ipinapalabas lamang ang prize money kapag ang isang method ay malinaw na nakamit ang isang tinukoy na capability threshold. Walang mga participation prize, runner-up award, o consolation payout. Kung walang makalampas sa pamantayan, walang mababayaran. Sinasadya ito — ibig sabihin, nagbabayad lamang ang mga sponsor para sa mga resultang talagang gumagana.

### 1.2 Hindi Maaaring Ikonsiderang Opsyonal ang Community Validation

Ang automated metrics ay mga proxy (SCORING_SPEC §1.1). Maaaring mataas ang score ng isang method sa chrF++ at FST acceptance habang lumilikha ng output na hindi tatanggapin ng kahit sinong tagapagsalita. **Bawat prize claim ay nangangailangan ng community validation** — kailangang kumpirmahin ng mga bilingual speaker na magagamit ang output. Ito ang human validation gate (BENCHMARK_SPEC §7).

### 1.3 Bahagi ng Kasunduan ang Paglipat ng Pagmamay-ari

Ang mga method na nagki-claim ng gantimpala ay saklaw ng ownership transfer clause (BENCHMARK_SPEC §8.3). Pinananatili ng developer ang attribution at publication rights. Nakakakuha ang governance org ng karapatang gamitin, baguhin, ipamahagi, at pagkakitaan ang method para sa kanilang wika. Hindi ito parusa — ito ang punto. Pinopondohan ng prize money ang paglikha ng teknolohiyang pag-aari ng language community.

### 1.4 Anti-Gaming

Ang mga prize threshold ay tinutukoy laban sa **gold-standard evaluation** (secret test set, pinapatakbo ng governance org sa sandbox). Hindi kailanman nakikita ng mga developer ang test data. Ipinapatupad ito sa arkitektura — hindi isang patakarang umaasa sa dangal. Tingnan ang BENCHMARK_SPEC §8.2.

### 1.5 Corpus Licensing: Mananatili sa Labas ng Prize Lane ang Non-Commercial Corpora

Ang ilang corpora na ginamit sa panahon ng pagbuo ng pamamaraan ay may mga non-commercial na lisensya — halimbawa, ang EdTeKLA Cree Language Textbook corpus ay may dalang **binagong CC BY-NC-SA ng EdTeKLA** (sovereignty-scoped, non-commercial; ang pinagmulang aklat-aralin ay CC BY-NC-ND 4.0). Ang mga corpora na ito ay **para lamang sa research/development-lane**:

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

| Field | Value |
|-------|-------|
| **Prize pool** | **$10,000 CAD** (iminumungkahi) |
| **Language pair** | English → Plains Cree (EN→CRK) |
| **Intended sponsor** | Tagapagtatag ng proyektong Champollion — isang inaasahang commitment, **wala pang pondong hawak saanman.** Kapag na-commit, ang pondo ay mananatili sa sponsor o sa itinalagang community trust — hindi kailanman sa Champollion. |
| **Status** | **IMINUMUNGKAHI — hindi bukas.** Hindi tumatanggap ng submissions. |
| **Opens** | Kapag umiiral na lamang ang gold-standard corpus, ang evaluation sandbox, at ang speaker-review gate (wala pa sa mga ito), at ang pondo ng sponsor ay verifiably held ayon sa §4.2. |
| **Expires** | Walang expiry kapag nabuksan na. |

#### Mga Threshold Condition

Makukuha ng isang method ang Gantimpala ng Tagapagtatag sa pamamagitan ng sabay-sabay na pagtugon sa **LAHAT** ng sumusunod na kundisyon:

| # | Kundisyon | Metric | Threshold | Rationale |
|---|-----------|--------|-----------|-----------|
| 1 | **Composite score** | `composite` (SCORING_SPEC §4) | **≥ 0.80** | Nasa pagitan ng Deployable (0.70) at Fluent (0.85). Nangangailangan ng mataas na kalidad sa lahat ng metric dimension — hindi lamang morphological validity. |
| 2 | **FST acceptance** | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0.99 (99%+)** | Halos lahat ng output word ay dapat mga morphologically valid form na kinikilala ng GiellaLT FST. Sinasaklaw ng 1% tolerance ang mga edge case (proper nouns, neologisms, loanwords) na maaaring lehitimong hindi saklaw ng FST. Ito ang tumutukoy na quality gate para sa polysynthetic MT — kung nire-reject ng FST ang higit sa 1% ng mga salita, gumagawa ang method ng mga form na hindi umiiral sa wika. Ang buong punto ng gantimpalang ito ay bumili ng system na hindi bumabaluktot sa mga bagay. |
| 3 | **chrF++** | `chrf_plus_plus` (SCORING_SPEC §2.1) | **≥ 55.0** | Dapat lumampas sa 55 sa 0–100 scale ang character n-gram overlap. Tinitiyak ang surface-level similarity sa reference translations, hindi lamang morphological validity. |
| 4 | **Community validation** | Human review (BENCHMARK_SPEC §7) | **≥ 70% "acceptable" o "excellent"** | Ang isang stratified sample ng outputs (≥30 entries sa difficulty tiers 2–5) ay nire-review ng ≥2 bilingual CRK speakers. Hindi bababa sa 70% ng reviewed entries ang dapat makatanggap ng "acceptable" o "excellent" rating. |
| 5 | **Gold-standard evaluation** | Sandbox execution (BENCHMARK_SPEC §8.2) | **Required** | Lahat ng automated metrics ay dapat kwentahin laban sa `gold_standard` corpus segment, na pinapatakbo ng governance org sa isang sandboxed environment. Hindi binibilang ang development-set scores. |
| 6 | **Reproducibility** | Fingerprint match (BENCHMARK_SPEC §3.8) | **±2%** | Dapat kayang i-run muli ng governance org ang method at makamit ang scores sa loob ng ±2% ng isinumiteng run card. |

> **Bakit 99+% FST?** Ang pangunahing problema sa machine translation para sa polysynthetic languages ay hallucination — gumagawa ang LLMs ng mga string na *mukhang* target language ngunit morphologically invalid. Ang isang method na gumagawa ng 95% valid output ay mayroon pa ring 5% fabricated words — hindi katanggap-tanggap na noise para sa anumang production use. Hinihingi ng 99%+ threshold ang halos zero hallucination habang pinapayagan ang bihirang edge case (isang proper noun na hindi alam ng FST, isang lehitimong neologism). Kung hindi makakamit ng isang method ang 99%+ FST acceptance, hindi pa nito nalulutas ang problema.
>
> **Bakit 0.80 composite?** Nasa pagitan ito ng Deployable (0.70) at Fluent (0.85). Ang isang method sa 0.80 na may 99%+ FST acceptance ay lumilikha ng output kung saan halos bawat salita ay tunay na Cree word *at* mataas ang pangkalahatang kalidad ng pagsasalin sa surface, structural, at semantic dimensions. Tinitiyak ng community validation gate (condition #4) na hindi lang ito metric gaming — kailangang kumpirmahin ng mga speaker na tunay na magagamit ang output.

#### Ano ang Ibig Sabihin ng Threshold na Ito sa Praktika

Sa composite ≥ 0.80 na may FST ≥ 0.99 at chrF++ ≥ 55, karaniwang makikita ng isang bilingual speaker ang:

- **Halos bawat** output word ay tunay na Cree word (vine-validate ng FST ang 99%+ — halos zero hallucinated forms)
- Tama ang pangunahing grammatical categories (person, number, tense) sa karamihan ng entries
- Karaniwang natural ang word order
- Maaasahang napapanatili ang kahulugan
- Ang natitirang errors ay real-language errors (maling inflection, incorrect obviation, animacy mismatches) — hindi fabricated words
- Magagamit ng fluent speaker ang output bilang high-quality draft at maitama ito nang mas mabilis kaysa pagsasalin mula sa simula

Ito ay isang system na **hindi bumabaluktot sa wika.** Maaaring hindi ito perpekto, ngunit bawat salitang nililikha nito ay tunay na salita. Iyon ang minimum bar para sa magalang na machine translation ng isang polysynthetic language.

---

## 3. Proseso ng Prize Claim

### 3.1 Submission

1. Isinusumite ng developer ang kanilang kumpleto at runnable na method sa governance org:
   - Lahat ng source code
   - Lahat ng dependencies (coaching data, dictionaries, FST configs, prompts)
   - Mga instruction sa installation at execution
   - Isang README na naglalarawan sa approach ng method
   - Isang development-set run card na nagpapakita ng approximate scores (para sa pre-screening)

2. Pinipirmahan ng developer ang terms of participation, kabilang ang:
   - Ownership transfer clause (BENCHMARK_SPEC §8.3)
   - Deklarasyon na walang training sa evaluation data
   - Reproducibility commitment

### 3.2 Evaluation

1. Ini-install at pinapatakbo ng governance org ang method sa isang sandboxed harness laban sa `gold_standard` corpus
2. Kinukwenta ang automated metrics (composite, FST, chrF++, atbp.)
3. Kung natugunan ang automated thresholds (conditions 1–3), nagpapatuloy ang governance org sa community review
4. Kung HINDI natugunan ang automated thresholds, natatanggap ng developer ang scores at feedback. Walang community review na iti-trigger.

### 3.3 Community Review

1. Isang stratified sample ng outputs (≥30 entries, sumasaklaw sa difficulty tiers 2–5) ang ihaharap sa mga bilingual speaker
2. Minimum na 2 independent reviewer ang magra-rate sa bawat entry
3. Rating scale: **reject** / **gist** / **acceptable** / **excellent**
4. Kung ≥70% ng entries ay makatanggap ng "acceptable" o "excellent" mula sa parehong reviewer, pumapasa ang community validation

### 3.4 Payout

1. Natugunan ang lahat ng 6 na kundisyon
2. Kinukumpirma ng governance org ang resulta
3. Binabayaran ang gantimpala sa loob ng 30 araw mula sa confirmation
4. Nalilipat ang ownership ng method ayon sa BENCHMARK_SPEC §8.3
5. Inilalathala ang resulta sa leaderboard na may verification tier na "Community Validated"

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

| Tier | Halaga | Iminumungkahing Threshold |
|------|--------|---------------------|
| **Seed** | $5,000–$15,000 | Deployable (composite ≥ 0.70) + community validation |
| **Breakthrough** | $25,000–$50,000 | Fluent (composite ≥ 0.85) + community validation |
| **Grand Prize** | $100,000+ | Fluent + multi-register coverage + deployment integration |

Maaari ring pondohan ng sponsors ang:
- **Improvement bounties** — fixed payment para sa bawat 5-point improvement sa chrF++ lampas sa kasalukuyang pinakamahusay
- **Register prizes** — hiwalay na awards para sa partikular na registers (formal, ceremonial, educational)
- **Speed prizes** — pinakamahusay na cost-adjusted score (SCORING_SPEC §6.3)

### 4.2 Saan Hinahawakan ang Prize Funds

Ang prize funds ay **hawak ng sponsor**: nasa sponsoring organization ang mga ito, o nasa isang community trust na itatalaga ng sponsor — **hindi kailanman sa Champollion**, na nagko-coordinate ng pagsukat at hindi humahawak ng pera. Ang isang credible prize ay naglalathala, bago ito magbukas: **sino ang humahawak ng pondo**, sa ilalim ng anong arrangement (organizational account, trust, o third-party escrow na pinili ng sponsor), at ang award threshold — upang ang pagkalampas sa pamantayan ay ma-verify mula sa published scores kasama ang speaker-validation verdict ng komunidad, at ang payment default ay makikitang pampubliko bilang ganoon. Walang prize funds na hawak saanman ngayon. Kung mag-expire ang isang prize nang hindi na-claim, mananatili ang pondo kung nasaan ito noon pa man — sa sponsor — upang i-redirect o bawiin ayon sa discretion ng sponsor. Ang self-serve mechanics, kabilang ang sponsor-default risk at mga mitigation nito, ay dokumentado sa [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) at sa [Terms Templates](/docs/network/sovereignty/terms-templates).

---

## 5. Disqualification

Madi-disqualify ang isang submission kung:

1. **Training sa evaluation data.** Na-expose ang method sa `gold_standard` o `held_out` corpus entries. (Napipigilan sa arkitektura ng sandboxed execution — ngunit kung may ebidensya ng contamination, ivo-void ang resulta.)
2. **Hindi reproducible.** Hindi ma-reproduce ng governance org ang scores sa loob ng ±2%.
3. **Hindi idineklara o hindi eligible na dependencies.** Nangangailangan ang method ng runtime access sa external services lampas sa idinedeklara ng dependency manifest nito, o ang effective dependency class nito ay A2 o X (§1.6). Pinapayagan ang idineklarang Class A1 LLM inference na dumadaan sa evaluation gateway; anumang ibang runtime network dependency — at anumang hindi idineklarang dependency ng anumang class — ay dahilan para ma-disqualify.
4. **Hindi pinirmahan ang terms of participation.** Dapat sumang-ayon ang lahat ng team member sa ownership transfer.
5. **Nadetect ang gaming.** In-optimize ang output para sa metric sa halip na translation quality (nahuhuli ng community review at/o anti-gaming checks ayon sa BENCHMARK_SPEC §9.3).

---

## 6. Relasyon sa Ibang Specs

| Dokumentong Ito | Mga Reference | Para sa |
|--------------|-----------|-----|
| §2 threshold conditions | SCORING_SPEC §4 (composite), §2.1–2.2 (metrics), §5 (tiers) | Mga definition at scale ng metric |
| §2 community validation | BENCHMARK_SPEC §7 | Human review protocol |
| §3 sandbox execution | BENCHMARK_SPEC §8.2 | Sovereignty mechanism |
| §3 ownership transfer | BENCHMARK_SPEC §8.3 | IP transfer terms |
| §1.6 dependency classes | Method Interface spec; BENCHMARK_SPEC §8.6 | Class definitions, admissibility terms, sandbox network policy |
| §4 cost-adjusted prizes | SCORING_SPEC §6.3 | Cost-adjusted formula |

---

## 7. Code–Spec Synchronization

### 7.1 Canonical Source

Ang dokumentong ito (`cli/website/docs/network/specifications/prize-spec.md`) ang canonical source para sa:
- Prize pool definitions (§2)
- Threshold conditions (§2.x)
- Claim process (§3)
- Disqualification rules (§5)

### 7.2 Implementation Requirements

Kapag na-activate ang isang prize pool:
1. Dapat ipakita ng leaderboard UI ang active prizes at ang kanilang threshold conditions
2. Ang mga run card na nakakatugon sa automated thresholds (conditions 1–3) ay dapat i-flag para sa community review
3. Kinukuha na ng `quality_tier` field sa run card schema ang tier ("deployable", "fluent")
4. Walang bagong code changes sa harness ang kailangan — ang prize spec ay policy layer sa ibabaw ng existing scoring

---

*Dapat compatible ang prize structures sa ownership transfer terms. Maaaring i-claim ng winner ang gantimpala, ngunit nagiging property ng governance org ang method kung umabot ito sa Deployable tier. Sinasadya ito — pinopondohan ng gantimpala ang paglikha ng teknolohiyang pag-aari ng language community.*
