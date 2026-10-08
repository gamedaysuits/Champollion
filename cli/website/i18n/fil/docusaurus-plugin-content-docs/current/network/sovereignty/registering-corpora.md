---
sidebar_position: 8
title: "Pagrerehistro ng Corpora at Exposure Lanes"
slug: /network/sovereignty/registering-corpora
description: "Magrehistro ng evaluation corpus nang hindi ito isinusuko. Ang apat na exposure tier — local-only, private, public, at sealed — ang mga license lane na kaakibat ng mga ito, at kung paano pinapanatili ng fetch-from-source na hindi mapunta sa aming mga kamay ang nilalaman ng corpus."
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

> **Pangkalahatang Buod.** Maaari kayong magrehistro ng isang evaluation corpus sa Network upang
> ma-benchmark ang mga pamamaraan laban dito **nang hindi ipinagkakaloob sa amin ang data**. Bawat
> corpus ay inirerehistro bilang isang sha-pinned na *metadata card*, hindi nilalaman — ang aktwal
> na mga pangungusap ay kinukuha mula sa pinagmulan ng mga ito sa oras ng pagsusuri. Kapag nagrehistro
> kayo, gagawa kayo ng dalawang magkahiwalay na pagpili: isang **exposure tier** — kung gaano karami ang lumalabas sa
> inyong machine (`local-only`, `private`, `public`, o `sealed`, kung saan ang corpus ay
> naka-encrypt sa inyong device sa ilalim ng isang M-of-N custodian key) — at isang **license
> lane**, na namamahala kung saan maaaring gamitin ang corpus (pampubliko, pampananaliksik lamang na
> di-komersyal, o pribado). Ito ang mekanismong nagpapahintulot sa isang komunidad na gawing
> *nasusukat* ang wika nito nang hindi ito nagagawang *na-e-extract*.

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

## 2. Dalawang magkahiwalay na pagpipilian

Nagtatanong sa inyo ang pagpaparehistro ng dalawang independiyenteng tanong, at mahalagang panatilihing
magkahiwalay ang mga ito dahil magkaibang mga bagay ang pinoprotektahan ng mga ito:

1. **Kung ano ang lumalabas sa inyong machine** — ang *exposure tier*.
2. **Kung saan maaaring gamitin ang inyong corpus** — ang *license lane*.

Maaaring sealed at non-commercial ang isang corpus, o pampubliko at commercially clear, o
anumang iba pang kombinasyon. Hindi ipinahihiwatig ng isa ang isa pa.

### 2a. Mga exposure tier — kung ano ang lumalabas sa inyong machine

Apat na tier, na tinukoy sa `cli/lib/corpus-registration.mjs`. **Hindi kailanman ina-upload ang plaintext na nilalaman
ng corpus sa alinman sa mga ito** — hindi ito isang setting ng patakaran, totoo ito sa
bawat tier. Palaging naka-default ang pagpaparehistro sa pinakapribado.

| Tier | Rehistrado? | Kung ano ang natatanggap namin | Sinusubaybayang card |
|---|:---:|---|:---:|
| **Pribado / lokal lamang** | ❌ | Wala. Mananatili ang card at teksto sa inyong machine. **Ang default.** | ❌ |
| **Pribadong irehistro** | ✅ | Metadata lamang — isang WMT-style na lihim na held-out set. Kayo ang may hawak ng kustodiya; maaaring i-publish ang mga resulta nang hindi inilalantad ang data. | ✅ |
| **Pampublikong irehistro** | ✅ | Metadata + isang fetch-from-source pointer. Kinukuha ang inyong teksto mula sa upstream kapag hiniling, hindi kailanman hino-host dito. Nangangailangan ng lisensyang pinahihintulutan ang muling pamamahagi. | ✅ |
| **Sealed** | ✅ | Isang card na walang nilalaman. Mananatili sa inyo ang ciphertext. | ✅ |

#### Panatilihing malayo ang isang test set mula sa bawat panlabas na serbisyo ng AI

Ang hindi pag-upload sa inyong teksto ay isang garantiya. Ang hindi *pagpapadala* nito sa isang model API
habang nagsusuri kayo ay isa pa, at pinakamahalaga ito para sa isang test set na
naglalaman ng sensitibong pananalita. Markahan ang file bilang local-only sa pamamagitan ng paglalagay ng isang maliit na file
sa tabi nito, na ipinangalan sa file na may idinagdag na `.champollion.json`:

```bash
# data/nurse_checked_test.tsv  →  data/nurse_checked_test.tsv.champollion.json
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Gumagana ito para sa anumang format ng corpus (TSV, JSONL, plain-text pairs, JSON). Mula noon,
itinuturing ng `mt-eval run` ang corpus bilang sealed:
- sa isang remote provider (OpenRouter, OpenAI, Anthropic, Gemini), ang pagpapatakbo ay
  **tinatanggihan bago maipadala ang anumang teksto**, at bago hilingin ang anumang API key;
- kapag ang `--provider local` ay nakaturo sa isang modelo sa machine na ito (isang loopback
  address tulad ng `http://localhost:11434/v1`), magpapatuloy ang pagpapatakbo;
- sa `--method local-model -m <model>` (isang modelong NLLB, OPUS-MT, o MADLAD
  na nilo-load ng harness sa sarili nitong proseso; kinakailangan ang `-m`), magpapatuloy ang pagpapatakbo:
  walang pangungusap na lumalabas sa
  machine, at ang pag-download ng weights ay naglilipat ng mga model file, hindi kailanman ang inyong teksto;
- sa isang MT engine o isang plugin ng pamamaraan (`--method <plugin dir>`), tatanggihan ang
  pagpapatakbo maliban kung patutunayan ninyo na ganap na lokal ang transport nito
  (`--attest-local-transport`, na nakatala sa log ng pagpapatakbo): hindi nakikita ng
  harness kung saan nagpapadala ng teksto ang isang plugin o serbisyo;
- ang sariling evaluation metrics ng wika mula sa language card nito ay **hindi
  nilo-load**. Nanggagaling ang mga ito mula sa magkakahiwalay na package na maaaring maghanap ng mga salita sa isang
  panlabas na serbisyo, tulad ng isang online na diksiyonaryo. Iniiskoran ang pagpapatakbo nang wala
  ang mga ito, at sinasabi sa run card na ipinagkait ang mga ito at kung bakit;
- itinatago ng `mt-eval publish` ang mga pangungusap at, bilang default, pinapalitan ang isang
  coaching o custom prompt ng sha256 nito, upang ang mga halimbawa ng prompt na kinuha mula sa
  sarili ninyong mga pangungusap ay manatili rin sa machine na ito. May ilang metadata tungkol sa corpus
  na nagiging pampubliko kasama ng iskor: ang id nito, bersyon, pares ng wika, laki, sha256
  ng file, lisensya at attribution nito, antas ng kontaminasyon nito, na
  ito ay minarkahang local-only, at ang mga pangalan ng segment nito. Para sa isang id na hindi isang
  rehistradong dataset, ang pag-publish ay lumilikha rin ng isang pampublikong hilera sa `datasets` na may
  parehong id, pares, laki, at sha256, kasama ang domain at mga pangalan ng segment nito at
  saklaw ng kahirapan. Inililista ng preview ng `--dry-run` ang mga ito para sa inyong pagpapatakbo, katabi
  ng kung ano ang nananatili rito: bawat pangungusap, ang file, at ang path nito. Makakakita naman ang iba ng
  iskor sa isang test set na hindi nila mabubuksan. Ito ay self-benchmarked, walang ibang
  makakapagpatakbo nito muli, at sa pamamagitan lamang ng sha256 makukumpirma ng isang taong may hawak ng parehong file
  na iyon nga ang file na iyon;
- hindi isinasama sa ipiniprint ng mga tool ang mga pangungusap, dahil ipinapasa ng isang AI agent na nagbabasa
  ng terminal ang nababasa nito sa provider ng modelo nito. Ipinapakita ng `mt-eval compare`
  ang mga entry id at iskor sa halip na ang mga pangungusap, at ang isang mensahe ng error
  na sumisipi sa isa ay ipiniprint nang tinanggal ito. Ipiniprint ang mga ito ng `--show-text` para
  sa isang taong nasa terminal. Ang mga file na isinulat sa inyong folder ng mga resulta ay nagpapanatili ng
  teksto, at bawat isa ay nagdadala ng marka ng corpus: bawat log ng pagpapatakbo, ulat,
  file ng paghahambing, at dashboard na isinusulat ng harness mula sa corpus ay nakakakuha ng
  sarili nitong `.champollion.json` na may parehong mga tuntunin kasama ang `derived_from`. Ituturing
  din ito ng susunod na tool, o ng isang susunod na pagpapatakbo sa file na iyon, bilang protektado.
  Pinapangalanan ng terminal ang bawat file na naglalaman ng teksto;
- pinaghihiwalay ng translation cache ang mga entry ng corpus na ito: sa ilalim ng
  `<cache-dir>/protected/<namespace>/` (bilang default ay
  `eval/cache/harness/protected/…`), sa isang namespace na naka-key ayon sa mga setting ng pagpapatakbo,
  ang sha256 ng corpus, at ang mga tuntunin nito, upang ang isang entry ay ibalik lamang
  sa isang pagpapatakbo sa parehong corpus na ito — hindi kailanman sa isang pagpapatakbo sa isa pa o sa isang
  walang markang corpus. Bawat cache file doon ay nagdadala ng parehong markang
  `.champollion.json`. (Ang mga entry na na-cache bago umiral ang proteksyong ito ay nasa karaniwang
  cache nang walang marka; i-delete ang `eval/cache/harness/` nang isang beses upang linisin ang mga ito.)

Maaari lamang gawing mas mahigpit ng marka ang isang corpus. Walang lisensya at walang
flag na `--allow-data-collection` ang maaaring magpaluwag dito. Kung hindi mabasa ang marker file,
hihinto ang pagpapatakbo sa halip na balewalain ito.

**Ang Sealed ang pinakamalakas na garantiyang iniaalok ng sistema.** Naka-encrypt ang inyong corpus
**sa inyong device**, sa key ng grupo ng custodian, at ang ciphertext ay
mananatili sa inyong machine o sa inyong evaluation node. Tanging ang
card na walang nilalaman ang natatanggap ng Champollion. Sa offline node, hinahati ang key upang mangailangan ng
**M ng N** na custodian nang magkakasama upang pahintulutan ang isang pagpapatakbo; nabuo na ang seremonyang iyon ngunit
hindi pa nagagamit kasama ng mga totoong custodian. Ang mga sealed set ay nakatala sa katalogo ngunit naka-quarantine, at ipinapares sa
isang pampublikong *qualifier* corpus na dapat maipasa muna ng isang pamamaraan bago pa man
maipanukala ang isang sealed na pagpapatakbo. Tingnan ang [Magpatakbo ng isang Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) at ang [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Mga license lane — kung saan maaaring gamitin ang corpus

Bukod dito, pinamamahalaan ng lisensya kung saan maaaring lumabas ang mga resulta.

#### Pampubliko

Isang corpus na may bukas na lisensya (hal. CC0, CC-BY) na maaaring lumitaw ang mga reference sa public
surfaces at maaaring mag-rank ang mga run sa public leaderboard. Ang content ay nananatiling
fetch-from-source — pinamamahalaan ng "public" ang *exposure ng mga reference at ranking*, hindi ang
hosting. Karamihan sa catalogue (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) ay nasa lane na ito.

#### Pampananaliksik lamang na di-komersyal

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

#### Pribado

Isang corpus na nakarehistro para sa **sarili ninyong scored runs**, kung saan ang mga reference ay hindi kailanman
inilalathala. Hawak ninyo ang source; kayo ang nagpapatakbo ng evaluation; kayo ang magpapasya kung ano, kung
mayroon man, ang kailanman ipapakita. Maaaring gawing public o non-commercial ang private corpus
sa kalaunan — ang exposure ay *lumuluwag* lamang sa pamamagitan ng hayagan at owner-driven na desisyon, hindi
nang tahimik.

| License lane | Naba-benchmark | Mga sangguniang pampublikong ipinapakita | Maaaring mag-rank sa pampublikong board | Sa komersyal / premyo / API na landas |
|------|:---:|:---:|:---:|:---:|
| **Pampubliko** | ✅ | ✅ | ✅ | ✅ (kung pinahihintulutan ng lisensya) |
| **Pampananaliksik lamang na di-komersyal** | ✅ | nakadepende sa lisensya | research lane lamang | ❌ |
| **Pribado** | ✅ (inyong mga pagpapatakbo) | ❌ | ❌ | ❌ |

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

### Ang id ng card

Isinusulat ng `champollion register-corpus` ang card para sa inyo at binibigyan ito ng id na
may anyong `eval-<source>-<target>-<name>[-<role>]-v1`:

- ang **name** ay nagmumula sa `--name`: ang "Ward phrases" ay nagiging `ward-phrases`. Ginagamit
  lamang ang publisher kapag ang pangalan ay walang mga a–z o 0–9 na character,
  halimbawa ang isang pangalang nakasulat lamang sa syllabics.
- sinasabi ng **role** kung para saan ang set: `--role test`, `--role dev`, o
  `--role train`. Lumalabas lamang ito sa id kapag ipinasa ninyo ito. Hindi kailanman
  nanghuhula ng role ang tool, kaya matatawag lamang na test set ang isang held-out test set kung
  sasabihin ninyo.

```bash
champollion register-corpus --yes --name "Ward phrases" --pair "eng>xyz" \
  --license proprietary --tier private --role test --size 120 --domain medical
```

Inirerehistro nito ang `eval-eng-xyz-ward-phrases-test-v1`. Upang kayo mismo ang pumili ng
id, ipasa ang `--id eval-…`; ginagamit ito nang eksakto kung paano ibinigay.

### Aling licence id para sa isang pribadong test set

Itinatala ng `--license` ang mga tuntuning aktwal na ipinagkakaloob ng mga taong nagmamay-ari ng data. Hindi
ito isang placeholder, at hindi pumipili ang tool para sa inyo. Tanungin muna sila
(ang mga pamilya, ang mga clinician, ang data steward ng komunidad), pagkatapos ay piliin
ang id na nagsasaad ng kanilang sinabi:

| Kung ano ang ipinagkakaloob ng mga may-ari | `--license` |
|---|---|
| Inilathala na nila ang teksto sa ilalim ng isang karaniwang lisensya | ang SPDX id nito, halimbawa `CC-BY-NC-4.0` |
| Gamitin lamang ito upang i-score ang mga sistema: huwag kailanman magsanay dito, huwag kailanman muling ipamahagi, walang bayad na pag-score | `community-eval-grant-nc` (`LicenseRef-Champollion-Eval-Grant-NC`) |
| Pareho rin, ngunit pinapayagan ang pag-score para sa mga nagbabayad na user | `community-eval-grant` (`LicenseRef-Champollion-Eval-Grant`) |
| Walang ipinagkakaloob lampas sa sarili nilang paggamit: nakareserba ang lahat ng karapatan | `proprietary` (`LicenseRef-Proprietary`) |
| Sarili nilang mga tuntunin na wala sa alinman sa mga ito | `LicenseRef-<a name for their terms>`, i-type nang ayon sa pagkakasulat, kasama ang mga tuntuning nakasulat kung saan itinatabi ng steward ang mga ito |

Bawat id na `LicenseRef-…` sa talahanayan (kasama ang dalawang evaluation grant at
`proprietary`) ay isang pasadyang ipinagkaloob (bespoke grant): hindi ito kailanman binabasa ng Champollion sa
ngalan ng mga may-ari. Tinatanggihan ang remote evaluation laban dito hanggang sa maitala ng
steward ang kanilang pahintulot, kaya ang mga modelo lamang sa inyong sariling machine ang sinusuri
laban dito. Kung hindi kayo sigurado, ang pinaka-konserbatibong pagpipilian na nagpapahintulot pa rin sa
inyong sumukat ay ang `community-eval-grant-nc`; isulat ito bilang pansamantala at
ipa-kumpirma ito sa steward o ipatukoy ang tama.

Hindi binabago ng lisensya kung saan napupunta ang mga pangungusap. Ang isang local-only set (ang
marker na `.champollion.json`, o `--tier local-only`) ay nananatili sa inyong machine
anuman ang sinasabi ng lisensya nito: tinatanggihan ng marker ang bawat remote model, at hindi
kailanman maaaring magpaluwag dito ang isang lisensya. Pinamamahalaan ng lisensya kung ano ang maaaring gawin ng iba sa
set kung maibahagi man ito, at kung aling mga evaluation lane ang maaari nitong salihan. Kapag nairehistro na ang isang file
gamit ang `--data`, itinatala ang id nito sa
file na `.champollion.json` sa tabi nito at hindi na kailanman magbabago. Ang pagpaparehistro muli sa file
na iyon ay hihinto at hihilingin sa inyong ipasa ang id gamit ang `--id`.

Para sa isang test set kung saan maaaring sanayin ang isang modelo (`--role test`, o isang
local-only o pribadong set na walang role), ipiniprint ng command ang mga
hakbang sa nmt-forge na dapat mauna bago ang unang iskor ng set: irehistro ito,
suriin ang inyong training corpus laban dito, at isulat ang inyong mga hula.
Kasunod ng mga ito ang baseline na `mt-eval run`. Ang isang benchmark ay isang pagbasa para sa pag-iskor,
at tinatanggihan ng nmt-forge ang mga hulang isinulat pagkatapos nito.

Nahahanap ng `mt-eval run --corpus <that file>` ang card sa pamamagitan ng parehong
file na `.champollion.json`. Ang dataset id ng pagpapatakbo ay ang id ng card, kaya bawat pagpapatakbo
sa set ay nagdadala ng parehong pangalan, at ang pangalan ng file ay nananatili sa pagpapatakbo bilang corpus path nito.
Iniulat ang contamination grade ng card ayon sa sinasabi ng card.
Nalalapat lamang ang dalawa habang ang file ay ang inirehistro ninyo: kung nabago ito
mula noon, sasabihin ito ng pagpapatakbo at hindi gagamitin ang alinman sa dalawa.

Ang isang `local-only`, `private`, o `sealed` na card ay nagsasaad na hindi lathala ang teksto nito
(`Contamination: NONE`), kaya una munang inihahambing ng pagpaparehistro ang file na ipinapasa ninyo
gamit ang `--data` (o `--seal-input`) sa mga pampublikong corpus. Ang isang repository
checkout ay naghahambing nito sa mga corpora card na hawak nito. Ang isang pag-install ng npm, na
walang kasamang mga corpora card, ay naghahambing nito sa katalogo ng pampublikong corpus: dina-download ng
CLI ang mga id at checksum ng mga pampublikong corpus at inihahambing ang mga ito sa inyong
machine, kaya hindi kailanman lumalabas sa machine ang checksum ng inyong file. Kapag ang file ay eksaktong katugma ng bawat byte
ng isang pampublikong corpus (parehong sha256), hihinto ang pagpaparehistro at papangalanan ang corpus na iyon.
Irehistro ito bilang pampubliko, gumamit ng mga pangungusap na tunay na pribado, o panatilihin ang
tier at isaad ang exposure gamit ang `--contamination` (itatala naman ng card
na pampubliko ang teksto). Tatanggihan ang isang sealed set ng pampublikong teksto:
wala itong susuriin.

Kapag walang magawang paghahambing (offline kayo, o hindi maabot ang katalogo),
minamarkahan ang card bilang `Contamination: UNCHECKED`, hindi `NONE`, maliban kung
kayo mismo ang magsaad ng grade gamit ang `--contamination`. Magrehistro muli online upang
maihambing ito. Itinuturing ng `mt-eval` ang isang `UNCHECKED` na corpus tulad ng anumang corpus na
hindi namarkahan bilang `LOW`: napupunta ang mga iskor nito sa relative-comparison-only na lane. Inihahambing
ng pagsusuri ang buong mga file, kaya ang isang pampublikong set na na-edit o na-reformat ay
hindi makikilala; inihahambing ng `mt-eval contest prepare` ang mga hilera.
