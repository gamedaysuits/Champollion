---
sidebar_position: 10
title: "Mga Template ng Tuntunin"
slug: /network/sovereignty/terms-templates
description: "Mga naaangkop na ideya sa tuntunin na may pagkiling sa trustless para sa komunidad na nagpapatakbo ng soberanong paligsahan — pagmamay-ari, scores-only licensing, hash-pinned integrity, fail-closed defaults, at tapat na pagtalakay sa mga panganib ng Trojan horse."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The runbook these terms attach to"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Mga Template ng Termino

> **Executive Summary.** Mga panimulang termino na maaaring iangkop ng isang komunidad o organisasyon
> kapag nagpapatakbo ng [sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest).
> Ang bias ng disenyo sa kabuuan ay **nakahilig sa trustless**: hangga't maaari, ang isang
> termino ay sinusuportahan ng isang mekanismo (isang hash, isang gate, isang append-only log)
> sa halip na isang pangako. Ang bawat termino ay isang maikling talata kasama ang isang paliwanag sa payak na Ingles.

:::warning[Hindi ito legal na payo]
Ang mga ito ay mga *ideya* sa pagbalangkas mula sa isang non-commercial na
proyektong pananaliksik, hindi legal na payo, at hindi kami mga abogado.
Nagkakaiba-iba ang mga batas ayon sa hurisdiksyon, at ang mga framework para
sa Indigenous data governance ay nagpapataw ng mga obligasyong
hindi kayang tugunan ng anumang template. Ipasuri muna ito sa sarili ninyong
legal counsel — at sa sarili ninyong proseso ng community governance — bago
kayo umasa rito.
:::

---

## Mga pangunahing termino

### 1. Ang corpus ay pag-aari at nananatiling pag-aari ng may-ari

*Termino.* Ang evaluation corpus, lahat ng entry dito, at lahat ng derivative metadata
ay nananatiling tanging pag-aari ng nagrerehistrong komunidad/organisasyon. Walang paggamit ng
makinarya ng Network para sa registration, contest, o evaluation ang naglilipat ng anumang
karapatan, titulo, o interes sa corpus sa platform, sa mga method developer,
o sa anumang sponsor. Walang hawak na kopya ang platform at wala itong inaangking lisensiya maliban sa
digest ng naka-encrypt na blob.

*Sa payak na Ingles:* ang pagpapatakbo ng contest laban sa inyong corpus ay hindi nagbibigay sa sinuman ng bahagi
nito. Hash ang hawak ng Champollion, hindi claim.

### 2. Ang evaluation ay nagbibigay ng lisensiyang scores-only — wala nang iba

*Termino.* Ang isang awtorisadong evaluation run ay nagbibigay sa platform at sa method
developer ng lisensiyang tumanggap at mag-publish ng **numerical scores at aggregate
statistics lamang**. Hindi ito nagbibigay ng **anumang** karapatang panatilihin ang corpus content pagkatapos ng
run, **anumang** karapatang magsanay, mag-fine-tune, o mag-coach ng anumang model gamit ito, at **anumang**
karapatang bumuo ng derivative corpora, mga memorized example, o lookup table
mula rito. Anumang pagpapanatili ng content lampas sa run ay nagwawakas sa lisensiya at nagpapawalang-bisa
sa mga resulta ng run.

*Sa payak na Ingles:* ang lumalabas sa sealed run ay isang numero. Ang mga pangungusap ay hindi
lumalabas — hindi sa leaderboard, hindi sa training set, hindi sa cache ng sinuman.

### 3. Hash-pinned na integridad: ang digest ang ipina-publish, ang content ay hindi kailanman

*Termino.* Ang corpus ay eksklusibong tinutukoy sa pamamagitan ng naka-publish na SHA-256 digest ng
naka-encrypt na blob nito at isang version label. Tanging mga blob na tumutugma sa digest ang itinuturing na
corpus; anumang run laban sa mga byte na hindi tumutugma ay walang bisa. Ang pag-publish ng
digest ay hindi pag-publish ng content, at wala sa mga terminong ito ang nag-oobliga sa
may-ari na kailanman ibunyag ang content sa sinuman.

*Sa payak na Ingles:* maaaring suriin ng lahat *kung aling* corpus ang ginamit; walang makakakuha ng
karapatang *basahin* ito. Kung ang mga byte ay hindi tumutugma sa hash, hindi kinikilala ang run.

### 4. Mga fail-closed default

*Termino.* Ang bawat kalabuan ay nilulutas tungo sa walang access at walang publication. Ang request
na hindi positibong awtorisado ng custodian threshold ay tinatanggihan; ang grant
na nag-expire na o nagamit na ay patay na; ang resultang hindi ma-verify ang provenance ay
hindi ipinapa-publish; ang corpus na nag-lapse ang registration ay hindi na maaaring patakbuhin.
Ang katahimikan ay hindi kailanman katumbas ng consent.

*Sa payak na Ingles:* kapag may duda, ang sagot ay hindi. Walang default na bukas.

### 5. Binabantayan ng custodian authorization ang bawat run

*Termino.* Walang evaluation ang maaaring isagawa laban sa sealed corpus nang walang recorded,
threshold-approved na authorization at single-use, time-boxed na grant na nakatali sa
partikular na method, corpus version, at evaluation environment. Lahat ng
authorization event, kabilang ang mga denial at blocked attempt, ay itinatala sa
isang append-only, publicly replayable audit log.

*Sa payak na Ingles:* inaaprubahan ng inyong mga custodian ang bawat isang run, isang run sa bawat pagkakataon,
at ang buong history ay pampubliko at tamper-evident. (Ang cryptographic
threshold-signing tooling ay ginagawa pa — tingnan ang
[status box sa runbook](/docs/network/sovereignty/run-a-sovereign-contest) —
kaya sa ngayon, ang terminong ito ay ipinapatupad bilang recorded process, hindi pa bilang math.)

### 6. Ang prize funds ay hawak ng sponsor at pampubliko ang award rule

*Termino.* Ang prize funds ay hawak ng pinangalanang sponsor organization o ng itinalagang
community trust — hindi kailanman ng platform. Ang award threshold ay ipinapa-publish
bago magbukas ang contest, nabe-verify mula sa naka-publish na scores kasama ang
sariling speaker-validation verdict ng komunidad, at ang award decision ay nasa
holder lamang ng funds.

*Sa payak na Ingles:* ang pera ay nasa kung sino ang naglaan nito, pampubliko ang bar, at
maaaring suriin ng sinuman kung naabot ang bar. Hindi maaaring magbayad,
magpigil, o mag-redirect ng prize ang Champollion dahil hindi kailanman hawak ng Champollion ang pera.

---

## Mga panganib na Trojan-horse {#trojan-horse-risks}

Tinutukoy ng isang matapat na dokumento ng mga termino ang mga paraan kung paano maaaring atakihin ang kaayusan.
Ilagay ang mga ito sa inyo — ang sponsor o komunidad na nakabasa ng mga ito ay mas mahirap mapagsamantalahan.

### Mga malisyosong method submission na sumusubok mag-exfiltrate ng test data

Ang isang "method" ay isinumiteng code. Maaaring subukan ng isang mapaminsalang method na ipuslit palabas ang mga test sentence
— ine-encode ang mga ito sa outputs nito, isinusulat ang mga ito sa logs, o tumatawag sa sariling server.
**Mga mitigation:** scores-only emission (ang per-entry output text mula sa sealed runs
ay hindi kailanman ipinapa-publish — ipinapatupad sa data layer sa kasalukuyan); isang **no-egress
sandbox** para sa sealed execution (🔲 ginagawa pa — hanggang maipadala ito, ituring ang
mitigation na ito bilang partial at timbangin ang approvals ng inyong mga custodian nang naaayon); at
**query/run budgets per method per round** — ang isang method ay nakakakuha ng maliit at fixed na
bilang ng sealed runs, kaya hindi mare-reconstruct ang corpus sa pamamagitan ng paulit-ulit na
probing kahit sa scores channel.

### Poisoned o contaminated na isinumiteng corpora

Maaari ring tumakbo sa kabilang direksyon ang attack: may mag-aalok sa isang komunidad ng
"ready-made" test corpus na banayad na mali, nakakasakit, o pampubliko na
(kaya na-memorize na ito ng mga method at walang saysay ang scores).
**Mga mitigation:** provenance requirements sa bawat entry (sino ang may-akda nito,
kailan, mula sa anong source); [speaker validation](/docs/network/specifications/speaker-validation)
ng mismong corpus bago i-seal; at contamination screening laban sa
public data bago tanggapin ang corpus bilang qualifier o gold standard.

### Mga license trojan sa dependencies

Ang winning method na tahimik na nagba-bundle ng content o code na ang lisensiya ay nagbabawal
sa nilalayong paggamit ng komunidad (commercial deployment, redistribution) ay lumalason
sa transfer — nanalo kayo ng tool na hindi ninyo maaaring legal na gamitin.
**Mga mitigation:** dependency-class declarations at mechanical license gate sa
submissions (tingnan ang [Prize Specification](/docs/network/specifications/prizes)
dependency-class table); ang undeclared dependencies ay batayan ng disqualification.

### Credential phishing

Sinumang nagpapatakbo ng contest ay nagiging target para sa mga attack na "i-paste ang inyong token dito para
i-verify ang inyong registration." **Mga mitigation:** huwag kailanman mag-paste ng tokens,
keys, o credentials sa third-party pages o ibahagi ang mga ito sa chat; lahat ng
authentication sa proyektong ito ay nangyayari sa pamamagitan ng OAuth flow ng CLI, at
**wala nang browser personal-access-token flows** — anumang page na humihingi
nito ay hostile. Dapat mangyari ang mga desisyon ng custodian sa mga channel na
pinagkakatiwalaan na ng inyong komunidad.

### Sponsor-side prize default

Ang tahimik na failure mode: naaabot ng mga method ang bar at hindi nagbabayad ang sponsor.
**Mga mitigation:** i-publish ang identity ng funds holder at ang holding
arrangement (org account, trust, escrow agent) *bago* magbukas ang contest;
gawing nabe-verify ang award conditions mula sa naka-publish na scores upang ang default ay
makitang pampubliko bilang default, hindi maikakaila bilang judgment call; at mas piliin ang
holder na may mawawala sa reputasyon. Hindi maaaring i-underwrite ng Champollion
ang risk na ito — ayon sa disenyo, hindi nito kailanman hawak ang funds — kaya ang credibility ng prize
ay eksaktong credibility ng pinangalanang holder nito.

---

## Paggamit ng mga ito

Kopyahin ang angkop, tanggalin ang hindi, idagdag ang hinihingi ng inyong governance, at
i-publish ang resulta kasabay ng inyong contest upang ang participants ay sumang-ayon sa *inyong*
mga termino, hindi sa isang vibe. Ang per-community terms — kabilang ang method ownership
transfer para sa sponsored prizes — ang pamantayan dito, hindi ang eksepsiyon: tingnan ang
[Ownership & Terms](/docs/network/sovereignty/ownership-transfer).

