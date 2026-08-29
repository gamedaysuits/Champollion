---
sidebar_position: 8
title: "Pagrerehistro ng Corpora at Exposure Lanes"
slug: /network/sovereignty/registering-corpora
description: "Irehistro ang isang evaluation corpus nang hindi ito isinusuko. Ang apat na exposure tiers — local-only, private, public, at sealed — ang mga license lane na kasabay ng mga ito, at kung paano pinapanatili ng fetch-from-source na wala sa aming mga kamay ang nilalaman ng corpus."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Pagrerehistro ng Corpora at Exposure Lanes

> **Buod ng Ehekutibo.** Maaari po kayong magrehistro ng evaluation corpus sa Network upang masuri ang mga pamamaraan laban dito **nang hindi ibinibigay sa amin ang data**. Ang bawat corpus ay inirerehistro bilang isang sha-pinned na *metadata card*, hindi bilang nilalaman — ang mga aktwal na pangungusap ay kinukuha mula sa kanilang pinagmulan sa oras ng pagsusuri. Kapag nagrehistro po kayo, gagawa kayo ng dalawang magkahiwalay na pagpili: isang **exposure tier** — kung gaano karami ang lalabas sa inyong makina (`local-only`, `private`, `public`, o `sealed`, kung saan ang corpus ay naka-encrypt sa inyong device sa ilalim ng isang M-of-N custodian key) — at isang **license lane**, na namamahala kung saan maaaring gamitin ang corpus (pampubliko, para sa di-komersyal na pananaliksik lamang, o pribado). Ito po ang mekanismo na nagpapahintulot sa isang komunidad na gawing *nasusukat* ang kanilang wika nang hindi ito nagiging *nakukuha*.

Karaniwang hinihingi ng machine-translation evaluation ang kabaligtaran ng data sovereignty:
"i-upload ang inyong test set upang makapag-score kami laban dito." Hindi ito katanggap-tanggap para sa
mga corpus ng wikang Katutubo at iba pang corpus na hawak ng komunidad, kung saan ang data ay pag-aari ng
mga taong pinagmulan nito. Itinayo ang Network upang hindi ninyo kailangang gawin ang
kompromisong iyon.

---

## 1. Metadata ang registration, hindi content {#1-registration-is-metadata-not-content}

Ang nakarehistrong corpus ay isang **card**: isang maliit na JSON record na naglalarawan kung *saan* matatagpuan ang
corpus at *ano ito*, may content hash upang ma-verify ang eksaktong bytes —
ngunit **walang mga pangungusap**. Ang card ay naglalaman ng:

| Field | Ano ito |
|-------|-----------|
| `url` | Kung saan kinukuha ang corpus (ang upstream archive na kontrolado ninyo) |
| `sha256` | Content hash ng pinned archive — nagpapatunay na walang nagpalit ng data |
| `license` | SPDX identifier (o `LicenseRef-…` para sa pasadyang lisensya) |
| `language_pair` | Source → target, hal. `eng-crk` |
| `do_not_train` | Palaging naka-set — hindi kailanman dapat gamitin sa training ang evaluation data |
| `attribution` | Ang credit sa builder/linguist na ipinapakita saanman lumitaw ang corpus |

Sa oras ng evaluation, ang harness ay **kumukuha mula sa source**, vini-verify ang `sha256`,
at nag-i-score laban sa bagong kuhang mga reference. Hindi kailanman iniimbak, hino-host,
o muling ipinamamahagi ng Network ang corpus content. Kung alisin ninyo offline ang upstream archive,
hihinto lamang na maging runnable ang corpus — nananatili sa inyo ang kontrol. Ito ang
parehong disiplina ng fetch-from-source na inilalapat sa buong catalogue (tingnan ang
[Evaluation Datasets](/docs/network/leaderboard/datasets)).

:::info[Bakit hash sa halip na kopya]
Ang content hash ay nagpapahintulot na **muling masuri** ang isang self-reported na score laban sa tunay,
hindi nabagong corpus nang hindi kailanman namin hinahawakan ang corpus na iyon. Ang isang run na ang mga numero ay hindi
ma-reproduce laban sa source na naka-pin sa hash ay tinatanggihan. Ang verifiability at
non-possession ay hindi magkasalungat dito — ang hash ang nagpapahintulot na maging posible ang dalawa.
:::

---

## 2. Dalawang magkahiwalay na pagpili

Ang pagpaparehistro po ay nagtatanong sa inyo ng dalawang magkahiwalay na katanungan, at mahalaga pong panatilihin itong magkahiwalay dahil magkaibang bagay ang pinoprotektahan ng mga ito:

1. **Kung ano ang lalabas sa inyong makina** — ang *exposure tier*.
2. **Kung saan maaaring gamitin ang inyong corpus** — ang *license lane*.

Ang isang corpus ay maaaring selyado (sealed) at di-komersyal, o pampubliko at malinaw na komersyal, o anumang iba pang kumbinasyon. Ang isa ay hindi nagpapahiwatig ng isa pa.

### 2a. Mga exposure tier — kung ano ang lalabas sa inyong makina

Apat na tier, na tinukoy sa `cli/lib/corpus-registration.mjs`. **Ang nilalaman ng plaintext corpus ay hindi kailanman ina-upload sa alinman sa mga ito** — hindi po ito isang setting ng patakaran, totoo po ito sa bawat tier. Ang pagpaparehistro ay palaging naka-default sa pinakapribado.

| Tier | Nakarehistro? | Ano ang natatanggap namin | Naka-track ang card |
|---|:---:|---|:---:|
| **Pribado / lokal lamang (Private / local-only)** | ❌ | Wala po. Ang card at teksto ay mananatili sa inyong makina. **Ang default.** | ❌ |
| **Magrehistro nang pribado (Register privately)** | ✅ | Metadata lamang — isang WMT-style na lihim na held-out set. Kayo po ang nagpapanatili ng kustodiya; ang mga resulta ay maaaring ilathala nang hindi inilalantad ang data. | ✅ |
| **Magrehistro nang pampubliko (Register publicly)** | ✅ | Metadata + isang fetch-from-source pointer. Ang inyong teksto ay kinukuha mula sa upstream kapag kinakailangan (on demand), hindi kailanman naka-host dito. Nangangailangan ng lisensyang malinaw para sa muling pamamahagi (redistribution-cleared). | ✅ |
| **Selyado (Sealed)** | ✅ | Ciphertext + isang content-free na card. Wala nang iba pa. | ✅ |

**Ang selyado (Sealed) ang pinakamatibay na garantiya na inaalok ng system.** Ang inyong corpus ay naka-encrypt **sa inyong device**, sa ilalim ng threshold key ng grupo ng custodian, bago pa man lumabas ang kahit isang byte. Tumatanggap ang Champollion ng ciphertext at hindi po ito kayang i-decrypt — at hindi rin ito kaya ng sinumang nag-iisang custodian: kinakailangan ang **M of N** sa kanila nang magkakasama upang pahintulutan ang isang pagpapatakbo (run). Ang mga selyadong set ay nakakatalogo ngunit naka-quarantine, at ipinapares sa isang pampublikong *qualifier* corpus na dapat maipasa ng isang pamamaraan bago pa man maimungkahi ang isang selyadong pagpapatakbo. Tingnan ang [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) at ang [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Mga license lane — kung saan maaaring gamitin ang corpus

Bukod pa rito, ang lisensya ang namamahala kung saan maaaring lumabas ang mga resulta.

#### Pampubliko (Public)

Isang corpus na may bukas na lisensya (hal. CC0, CC-BY) na maaaring lumitaw ang mga reference sa public
surfaces at maaaring mag-rank ang mga run sa public leaderboard. Ang content ay nananatiling
fetch-from-source — pinamamahalaan ng "public" ang *exposure ng mga reference at ranking*, hindi ang
hosting. Karamihan sa catalogue (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) ay nasa lane na ito.

#### Para sa di-komersyal na pananaliksik lamang (Non-commercial research-only)

Isang corpus sa ilalim ng non-commercial na lisensya (hal. CC BY-NC-SA, o pasadyang
community/NGO license gaya ng `LicenseRef-TWB-Gamayun` ng mga Gamayun kit). Maaari itong
**i-benchmark para sa research** — pinatatakbo rito ang mga method, kinakalkula ang mga score —
ngunit ito ay **inihihiwalay mula sa bawat commercial, prize, at API path.** Ang eligibility ay
**nakabatay sa paggamit**, hindi nakabatay sa corpus:

- **mahigpit ang commercial lane** — anumang hindi malinaw na commercial-licensed ay
  hindi kasama;
- **maluwag ang research lane** — tinatanggap ang non-commercial corpora;
- **palaging nangingibabaw ang quarantine** — ang corpus na na-flag bilang improper subset (o
  kung hindi man ay barred) ay hindi kailanman maaaring mag-rank sa *anumang* lane, anuman ang lisensya.

Ito ang paraan upang hayaan ng isang komunidad na magtulak ng pag-unlad sa research ang corpus nito habang pinananatili
ito sa labas ng produkto ng sinuman.

#### Pribado (Private)

Isang corpus na nakarehistro para sa **sarili ninyong scored runs**, kung saan ang mga reference ay hindi kailanman
inilalathala. Hawak ninyo ang source; kayo ang nagpapatakbo ng evaluation; kayo ang magpapasya kung ano, kung
mayroon man, ang kailanman ipapakita. Maaaring gawing public o non-commercial ang private corpus
sa kalaunan — ang exposure ay *lumuluwag* lamang sa pamamagitan ng hayagan at owner-driven na desisyon, hindi
nang tahimik.

| License lane | Maaaring i-benchmark (Benchmarkable) | Mga reference na ipinapakita sa publiko | Maaaring mag-rank sa pampublikong board | Nasa komersyal / premyo / API path |
|------|:---:|:---:|:---:|:---:|
| **Pampubliko (Public)** | ✅ | ✅ | ✅ | ✅ (kung pinahihintulutan ng lisensya) |
| **Para sa di-komersyal na pananaliksik lamang (Non-commercial research-only)** | ✅ | nakadepende sa lisensya | research lane lamang | ❌ |
| **Pribado (Private)** | ✅ (ang inyong mga pagpapatakbo) | ❌ | ❌ | ❌ |

:::note[Ang commercial lane ay guardrail, hindi negosyo]
Ang Champollion mismo ay non-commercial — walang paid API o product sa likod ng
alinman dito. Umiiral ang commercial/prize lane bilang isang *forward* guardrail: ito ay
mekanikal na nagtatala kung aling corpora ang maaaring kailanman legal na lumitaw sa isang prize o
commercial context, upang walang paggamit sa hinaharap — ng sinuman — ang makalampas sa
lisensya o mga tuntunin ng steward.
:::

---

## 3. Mga garantiya ng sovereignty

Idinisenyo ang registration ayon sa [posisyon sa data stewardship](/docs/network/sovereignty/data-sovereignty).
Sa konkretong paraan:

- **Nananatili sa source ang possession.** Hash at URL ang hawak namin, hindi ang data.
- **Sa owner ang control.** Ang lane ay pinipili ng owner, at lumuluwag lamang ang exposure
  sa pamamagitan ng hayagang desisyon. Ang pag-alis ng upstream archive ay nagre-revoke ng runnability.
- **Ang non-commercial ay non-commercial.** Mekanikal na hindi isinasama ang NC corpora
  sa commercial, prize, at API lanes — hindi sa pamamagitan ng pangako, kundi sa pamamagitan ng gate.
- **Hindi kailanman maaaring mag-rank ang improper subsets.** Nangunguna ang quarantine sa license, kaya ang corpus
  na barred mula sa ranking ay nananatiling barred saanman.
- **Mandatory ang attribution.** Ang credit sa builder/linguist ay kasama ng card
  sa bawat surface kung saan lumilitaw ang corpus.

Para sa kung paano itinatakda ang per-language terms — kabilang ang method-ownership transfer para sa
sponsored prizes — tingnan ang [Ownership & Terms](/docs/network/sovereignty/ownership-transfer).

---

## 4. Paano magrehistro

Ang corpus card schema at ang build/verify tooling ay nakadokumento sa
[Corpus Design Framework](/docs/network/specifications/corpus-design) at sa
[Corpus Creation cookbook](/docs/network/tutorials/corpus-creation). Sa madaling sabi:

1. I-host ang corpus archive sa lugar na kontrolado ninyo (mananatili ito roon — hindi ito kailanman
   kinokopya sa Network).
2. Sumulat ng card: `url`, `sha256`, `license`, `language_pair`, `attribution`,
   `do_not_train`.
3. Piliin ang exposure lane (public / non-commercial / private).
4. Irehistro ang card. Maaari na ngayong i-benchmark ang mga method laban sa corpus
   fetch-from-source, sa ilalim ng mga patakaran ng lane.

Hindi ninyo kailanman ina-upload ang mga pangungusap. Maaari kayong huminto anumang oras.
