---
sidebar_position: 9
title: "Sovereign Eval Node — Mga Operasyon ng Hardware at Air-Gap"
description: "Reference hardware, disiplina sa air-gap, at mga operasyon sa key-custody para sa pagpapatakbo ng isang evaluation node na kontrolado ng komunidad: hindi kailanman aalis sa inyong makina ang sikretong test set; ang mga pamamaraan ang lumalapit sa datos."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# Sovereign Eval Node — Mga Operasyon sa Hardware at Air-Gap

Ang sovereign eval node ay isang makina na **kinokontrol ninyo** na naglalaman ng isang sikretong test set at sinusuri ang mga paraan ng pagsasalin laban dito. Ang mga paraan ay naglalakbay patungo sa data; ang data ay hindi kailanman naglalakbay. Mga marka — at mga marka lamang — ang lumalabas.

Ang pahinang ito ay ang praktikal na spec: kung anong hardware ang bibilhin (o gagamitin muli), kung paano ito i-set up, at ang disiplina sa pagpapatakbo na gumagawa sa "ang test set ay hindi kailanman umalis sa makina" bilang isang katotohanan na maaari ninyong ipagtanggol sa halip na isang pangako na kailangan ninyong pagkatiwalaan.

:::info[Ano ang available na ngayon vs. ano ang minamarkang in progress]
Ang software ng organizer node ay **available na ngayon** sa `mt-eval` — tingnan ang
[gabay sa sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest):
paghahanda at pag-seal ng contest, ang public-qualifier gate na **muling
pinatatakbo mismo ng node sa bawat entry bago hilingin sa sinumang custodian na
mag-apruba ng anupaman**, scoring na threshold-gated, at ang network-isolated na
method executor kasama ang import scan nito. Ang tinatanggap ng isang node ay
isang **modelo o isang pamamaraan (method)** — isang artifact na kaya nitong
patakbuhin. Ang pag-upload ng mga salin ng isang source-public blind set ay inalis
na bilang isang contest entry path noong 2026-09-06 at binura na ang verb;
nananatili na lamang ang isang source-public round bilang opsyonal na diagnostic
ng organizer, at ang mga self-reported na score ay nabibilang sa open leaderboard,
na isang pampublikong board na naka-index ayon sa corpus at direksyon ng pair sa
halip na isang contest.
**Available na rin ngayon ang threshold key ceremony at sealed-at-rest workflow ng §4**:
`mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, mga quorum share na ipinapakita sa oras ng pagpapatakbo
(`node run-method --offline --share …`), isang hash-chained na lokal na
authorization ledger (`node ledger verify|head`), mga nilagdaang score manifest
(`node sign-manifest` / `node verify-manifest`), at ang air-gap
tooling ng §2–§3 (`node bundle`, `node manifest`, `node egress-check`). Ang mga score
bundle ay nilalagdaan **sa mismong node, sa Python** — hindi kailangan ng
offline bundle ng Node.js runtime — at ang parehong detached-signature na format
ay nagve-verify gamit ang alinmang implementasyon. **Available na rin ang request
staging** sa panig ng organizer: isinusulat ng `mt-eval node stage-request` ang
eksaktong exchange request na gagawin ng isang online relay, mula sa isang bundle file
at nang walang database (para sa isang rehearsal, o isang deployment na hindi
kailanman kumokonekta), na paunang napatunayan (pre-validated) tulad ng
pag-validate ng import at nakatali sa id ng node; ang mga score na ibinabalik ay
manifest-verifiable ngunit hindi relay-published, dahil walang umiiral na authorization
record na pagbabatayan ng pag-publish sa mga ito. Ang kapalit na single-keypair ay
nananatili lamang para sa mga contest kung saan hawak nang direkta ng organizer
ang mga reference — nilalagyan ng label sa bawat interface kung aling lane ang
ginagamit. Sa madaling salita, ang **hindi** kasama sa v1: hindi inaangkin ang
hardware remote attestation (TEE) (§5), at ang platform-side na threshold
*signing* (mga pag-apruba gamit ang telepono ng custodian laban sa hosted
infrastructure) ay gagawin pa sa hinaharap — sa isang sovereign node, ang custody
ay isinasagawa sa pamamagitan ng pisikal na pagpapakita ng M sa N na share sa
mismong makina (§4). At upang maging tumpak tungkol sa cryptography: ito ay Shamir
M-of-N secret sharing kung saan ang key ay **muling binubuo sa naka-lock na memory
ng node habang may awtorisadong pagpapatakbo** (pagkatapos ay iki-clear) — ito ay
*hindi* multi-party computation, at ang key ay sandaling umiiral nang buo sa inyong
offline na makina. Sa huli, hanggang hindi nagbubukas ang community consent gate,
tatakbo lamang ang lane sa **synthetic data lamang**; maghihintay ang mga tunay
na corpora sa pahintulot na iyon.
:::

## 1. Reference na hardware

Ang executor ay nagpapatakbo ng mga self-contained na paraan: lokal na NMT decode, FST/morphology
validation, at metric computation. Walang mga cloud call na nangyayari sa loob ng air
gap (ang mga LLM-API na paraan ay eksaktong uri na tinatanggihan ng isang air-gapped na node — tingnan
ang mga klase ng paraan ng [benchmark spec](/docs/network/specifications/benchmark)).

| Tier | Spec | Kasya | Tinatayang gastos (2026) |
|---|---|---|---|
| **Minimum** (gumagana) | 4-core x86_64 o Apple/ARM, 16 GB RAM, 500 GB SSD | Metric + FST evaluation, CPU decode ng maliliit na NMT model (mabagal ngunit tama) | US$0 (isang ekstrang laptop) – $400 gamit na |
| **Inirerekomenda** | 8-core, 32 GB RAM, 1 TB NVMe, NVIDIA GPU ≥ 12 GB VRAM (hal. RTX 4070-class) | Kumportableng NMT decode para sa buong test batteries; parallel na method evaluation | ~US$900–1,600 (small-form workstation) |
| **Institusyonal** | 16-core, 64–128 GB RAM, 2 TB NVMe, 24 GB+ VRAM | Mga paligsahan na may maraming paraan, malalaking battery, naka-archive na ciphertext store | ~US$2,500–4,000 |

Mga mahigpit na kinakailangan sa bawat tier:

- **Walang mga radyo, o mga radyo na mapapatunayan ninyong nakapatay.** Pinakamahusay: isang desktop na walang
  Wi-Fi/Bluetooth card. Katanggap-tanggap: isang laptop na ang wireless card ay
  pisikal na tinanggal o hindi pinagana sa firmware. Ang "Airplane mode" ay hindi isang
  air gap.
- **Isang wired NIC na maaari ninyong iwang nakatanggal.** Ang kawalan ng kable ay ang pinaka-auditable na network control na mayroon.
- **Dalawang nakalaang USB drive** (may label na IN at OUT — tingnan ang §3) at, sa isip,
  isang makina na ang ibang mga port ay hindi ninyo pinagana sa firmware.
- **Full-disk encryption** (LUKS sa Linux) upang ang isang ninakaw na node ay maging walang silbi (brick), at
  isang UPS kung ang inyong kuryente ay hindi maaasahan — ang isang evaluation na naantala sa kalagitnaan ng battery
  ay maaaring mabawi, ngunit bakit pa aalamin.

## 2. Setup ng software (minsan, ~isang oras)

1. Mag-install ng kasalukuyang Linux LTS (Ubuntu/Debian) mula sa isang USB installer nang
   **nakabunot ang network cable**; i-enable ang full-disk encryption habang nag-i-install.
2. Sa isang hiwalay at online na makina kung saan naka-install ang harness
   (`python3 -m pip install mt-eval-harness`, 0.2.0 o mas bago), buuin ang offline bundle.
   Apat na bagay ang ginagawa ng `mt-eval node bundle --out <dir>`:
   - ibinabalot bilang wheel ang naka-install na harness at mga dependency nito (o isang partikular
     na wheel, gamit ang `--wheel <file>`);
   - kinukuha ang mga cryptography library batay sa hash-pinned list na kasamang
     ipinadala sa loob ng harness;
   - kinokopya ang anumang `--include` artifact;
   - nagsusulat ng sha256 manifest para sa bawat file.

   Isama ang mga **language card** para sa bawat wikang pupuntusan ng node
   (`--include <cards-dir>`): pinapangalanan ng node ang language pair ng isang run mula sa isang
   lokal na card index at hindi kailanman kumukuha nito online. Walang kasamang per-language
   cards directory ang alinman sa mga naka-install na package, kaya isulat ito rito gamit ang
   `champollion` CLI, isang `<code>.json` bawat wika (`champollion network card eng --json >
   node-cards/eng.json`, pagkatapos ay gawin din ito para sa iba pa ninyong wika), at ipasa
   ang `--include node-cards`. Sa node, ito ay matatagpuan sa
   `<dir>/artifacts/node-cards`; ituro ang `cards_dir` doon. Lahat ng kailangan ng node ay tumatawid
   sa IN drive nang minsan. Buuin sa parehong bersyon ng Python na pinatatakbo ng node
   (3.11 o 3.12); tatanggihan ng pinned list ang alinmang iba pa.
3. Ilipat ang bundle sa IN drive; i-verify ang sha256 ng bawat artifact
   laban sa manifest **sa node** bago mag-install
   (`mt-eval node bundle --verify <dir>`). Pagkatapos ay mag-install mula sa mga kasamang
   wheel lamang:
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`.
   Ang `[node]` extra ay ang `cryptography` library na kailangan ng `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness` na pag-install
   na wala nito.
4. Gumawa ng signing keypair ng node (`mt-eval node keygen`) at itala
   ang public half nito — ipa-publish ninyo ito upang ma-verify ng sinuman ang inyong
   mga score manifest (§5).
   Kailangan din ng node ang **Docker** (o Podman), na nagpapatakbo ng bawat isinumiteng
   method sa isang container na walang network; kung wala ang alinman sa `PATH`,
   tatanggi ang `mt-eval node run-method` sa isang linya na binabanggit ang dalawa, at ang
   request ay mananatiling puwedeng patakbuhin. Kailangan din nito ng node config sa
   `~/.mt-eval/node.json`. Tinutukoy ng file na iyon ang pangalan ng node, ang cards directory
   nito (`cards_dir`, o `MT_EVAL_CARDS_DIR`), at ang mga contest na pinaglilingkuran nito.
   Nagsusulat ang `mt-eval node init` ng isang starter config na naglalaman ng bawat key na binabasa
   ng isang scoring node, kabilang ang public qualifier gate (`qualifier` + `dev_corpus`,
   kung saan muling pinatatakbo ng node ang bawat method laban dito bago nito buksan ang isang sealed set)
   at ang mga slot ng sealed holdout (`holdout_set_id` + `holdout_corpus`;
   burahin ang mga ito para sa isang contest na walang holdout).
   Pinupunan ng `mt-eval node init --from-contest <out>` ang mga value ng contest mula sa
   manifest na isinulat ng `contest prepare` (ang mapping ay nasa
   [gabay sa sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)).
   Ang `sandbox` block nito ay ang resource policy ng node (4 GB RAM, 4 GB scratch,
   30 minuto bawat run, walang GPU), at idinedeklara ng `contest submit-method` ang eksaktong
   mga value na iyon bilang default, kaya i-publish ang inyong mga limitasyon kasama ng contest kung
   babaguhin ninyo ang mga ito.
   Ang isang node config na nagdedeklara lamang ng kalahati ng gate na iyon ay tatanggihan sa startup.
   Sinusuri ng `mt-eval node ledger verify` ang napunang file: tatanggihan nito ang
   unang natitirang `<...>` value o idineklarang file na wala sa node,
   ipi-print ang sinuri nito, pagkatapos ay muling ipe-play ang hash chain ng lokal na ledger. Ang
   nakakonektang makina na nagre-relay ng mga request sa node ay nangangailangan din ng
   **service-role key** ng database (`MT_EVAL_SUPABASE_SERVICE_KEY`). Hindi
   kailanman kailangan ang key na iyon sa mismong air-gapped node.
5. Mula noon, ang makina ay hindi na kailanman makakakita ng network — at maaaring magsagawa
   muna ng isang sealed run upang patunayan ito: tatanggi ang `mt-eval node egress-check` (awtomatiko
   ring ipinapatupad gamit ang `assert_airgap` sa node config) kapag ang isang
   route, isang probe, o DNS ay nagpapakita ng anumang labasan. Ang mga update sa OS ay isang sinadya,
   naka-bundle, at hash-verified na kaganapan — hindi isang background service.

## 3. Disiplina sa paglipat (bawat paligsahan, parehong direksyon)

Ang air gap ay isang *pamamaraan*, hindi isang produkto. Ang pamamaraan:

- Nagdadala ang **IN drive** ng: mga isinumiteng method o model bundle at ang
  kanilang manifest. Bago patakbuhin ang anupaman, bine-verify ng node ang
  hash ng bawat package laban sa manifest at tumatakbo ang import scan (tinatanggihan
  nito ang mga method na nag-i-import ng mga network library — available na ito ngayon).
- Nagdadala ang **OUT drive** ng: ang nilagdaang score manifest — mga pinagsama-samang
  score, ang mga hash ng method/config kung saan nabibilang ang mga ito, ang audit-log head — at
  *wala nang iba*. Ang mga per-segment na output ay nananatili sa node sa ilalim
  ng kontrol ng organizer; ang pag-publish sa mga ito ay isang hiwalay at sinasadyang desisyon ng komunidad.
- Isang direksyon lamang bawat drive, kailanman. Ang isang drive na humawak na sa node ay hindi kailanman
  dapat mag-auto-mount sa isang online na makina — i-mount ito nang `noexec,nodev` at kopyahin
  ang manifest nang manu-mano.
- Hina-hash ng `mt-eval node manifest write <drive> --direction in|out` ang bawat
  file sa drive bago tumawid; tatanggihan ng `mt-eval node manifest verify`
  sa tumatanggap na panig ang anumang idinagdag, binago, o nawawala.
- I-log ang bawat pagtawid (petsa, drive, manifest hash) sa papel o sa
  on-node log ng node. Ang pagiging boring ang mismong punto: ang log ang nagbibigay-daan
  sa inyo na sagutin ang "mayroon pa bang ibang lumabas kailanman?" nang may ebidensya.

## 4. Pangangalaga sa key (M-of-N, hawak ng komunidad)

Ang sealed test set ay naka-encrypt at rest; ang pag-decrypt ay nangangailangan ng quorum ng
mga key share na hawak ng mga custodian na **pinili ng komunidad** — isang konseho ng mga Elder,
isang awtoridad sa wika, isang sangay ng edukasyon. Sa disenyong ito, walang ibinibigay na share
sa platform, kaya hindi maaaring i-decrypt ng Champollion ang isang sealed set, at hindi rin
ito magagawa ng sinumang solong custodian lamang. Ang seremonya sa ibaba ay hindi pa
naisasagawa kasama ang mga totoong custodian.

Ang seremonya (isang offline na pag-upo; ino-automate ito ng kasamang tooling):
ang `mt-eval node ceremony init` ay bumubuo ng set key sa node, hinahati ito
sa N na mga share (anumang M ay nakakabuo muli; ang mas kaunti ay walang ibinubunyag — ang pagbabahagi ay
information-theoretic), at zini-zero ang key sa parehong pagkakataon; ang `ceremony
share` ay naglalabas ng share ng bawat custodian bilang isang file para sa isang token kasama ang isang
napi-print na paper backup; pinapatunayan ng `ceremony verify` na ang mga ipinamahaging kopya
ay nabubuong muli — nang walang pinapanatiling anuman; ang `ceremony share
--wipe-originals` then destroys the node's own copies. `mt-eval node
seal` ay nag-e-encrypt sa corpus patungo sa pampublikong key ng seremonya: ang node ay nag-iimbak ng
ciphertext at isang content-free na metadata card, wala nang iba. Mula noon,
ang pagpapatakbo ng isang evaluation ay nangangahulugan na ang mga custodian ay pisikal na nagpapakita ng M ng N na mga share
(`node run-method --offline --share …`): ang key ay binubuong muli **sa
naka-lock na memorya ng executor lamang**, ginagamit para sa isang grant-bound na pagpapatakbo na iyon, at
zini-zero — hindi na ito kailanman hahawak muli sa disk. Ang bawat kahilingan, boto, grant, at paggamit
ay idinadagdag sa isang hash-chained na lokal na ledger (`node ledger verify`), at ang isang
pagtatangka nang walang quorum ay tinatanggihan *at* itinatala.

Isang tapat na pangungusap tungkol sa mekanismo: ito ay Shamir secret sharing
na may muling pagbuo sa memorya ng offline na makina na hawak ng komunidad —
hindi multi-party computation. Sa panahon ng isang awtorisadong pagpapatakbo, ang key ay panandaliang
umiiral, nang buo, sa hardware na pisikal na kinokontrol ng komunidad; ang mga
katangian na ipinagtatanggol nito ay *walang nakatayong key sa disk*, *walang pagpapatakbo nang walang presensya ng quorum*, at
*bawat paggamit ay naka-chain sa nasusuring ledger*. Ang platform-side threshold signing,
kung saan ang key ay hindi kailanman nabubuo saanman, ay nananatiling trabaho para sa hinaharap at
may label na ganoon saanman ito nabanggit.

Ang pag-ikot (rotation) at pagpapalit ng custodian ay muling nagpapatakbo ng seremonya; ang pagkawala ng higit sa
N−M na mga share ay nangangahulugan na ang set ay muling isi-seal mula sa source copy ng komunidad —
palaging pinapanatili ng komunidad ang sarili nitong plaintext na orihinal, dahil ang
[pagmamay-ari](/docs/network/sovereignty/data-sovereignty) ay hindi kailanman naging atin para hawakan.

## 5. Ano ang ibig sabihin ng "attested" dito — at kung ano ang hindi

Ang bawat evaluation ay gumagawa ng isang **nilagdaang score manifest**: ang lagda ng node
sa mga marka, ang mga method-package hash, ang corpus checksum, at ang
head ng append-only na audit log. Sinumang may hawak ng inilathalang
pampublikong key ng node ay maaaring mag-verify nito — `mt-eval node verify-manifest <manifest>
--pubkey <published .pub.json>` — na *ang node na ito* ay gumawa ng *mga markang ito*
para sa *mga eksaktong input na ito*, at ang hash-chained na log ay ginagawang madaling matukoy ang mga tahimik na pag-edit sa kasaysayan.

Iyan ay **software attestation** — pinapatunayan nito ang integridad ng rekord, at
ito ang inaalok ng v1. **Hindi** nito pinapatunayan kung anong silicon ang nagpatakbo sa run:
ang hardware remote attestation (mga TEE) ay trabaho para sa hinaharap at sadyang hindi
inaangkin. Ang tapat na pahayag sa seguridad para sa v1: ang disiplina ng organizer
(§3) kasama ang mga nilagdaang manifest kasama ang pisikal na pangangalaga ng komunidad sa
makina ay ang trust anchor — na eksaktong kung saan nais ng isang sovereignty-first
na disenyo na ilagay ang tiwala.

## 6. Ang operating loop

1. I-anunsyo ang contest; i-publish ang public key ng node + ang dev-set threshold.
2. Tanggapin ang mga submission online (karaniwang makina), buuin ang IN manifest
   (`mt-eval node manifest write <drive> --direction in`).
3. Dalhin ang IN drive sa node; i-verify ang mga hash (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   ang proposal ay darating bilang *pending*. Susuriin muna ito ng node (muling
   pinatatakbo ng `node run-method <id> --offline` ang qualifier ng kalahok sa
   pampublikong dev set at sinusuri ang isang container runtime para sa isang code entry, walang
   binubuksang naka-seal, at nagtatala ng pass sa lokal na ledger). Pagkatapos ay itatala ng isang custodian
   ang desisyon sa node (`node approve <id> --offline --actor <custodian>`, tatanggihan
   hanggang sa maipasa ang pagsusuring iyon, o `node deny … --offline --reason …`: isang boto
   + awtorisasyon sa lokal na ledger at isang talaang nilagdaan gamit ang node key;
   ipinapakita ng `node list --offline` kung ano ang naghihintay). Ang sealed run (muli, `node run-method
   --offline`) ay tatanggi sa isang pending na proposal hanggang sa maitala ang pag-apruba
   na iyon at ma-verify.
4. Aawtorisahan ng mga custodian ang run sa pamamagitan ng pagpapakita ng quorum ng mga share (§4 —
   `node run-method <id> --offline --share … --share …`); magde-decrypt ang sealed set
   papunta lamang sa executor. Walang quorum, walang run — at ang pagtatangka
   ay naitatala sa ledger.
5. Isagawa; kukuwentahin ang mga score; pananatilihin ang mga per-segment na output sa panig ng node.
6. Teardown: buburahin ang gumaganang plaintext; idaragdag sa audit log; lalagdaan ang manifest.
7. Dalhin pabalik ang OUT drive; i-publish ang mga score + manifest; mave-verify ng sinuman
   (`node verify-manifest`).
8. I-log ang pagtawid; mananatiling nakalaan ang mga drive; mananatiling dark ang node.
