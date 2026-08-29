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

:::info[Ano ang kasama ngayon vs. ano ang nakatala bilang in progress]
Ang organizer node software (paghahanda sa paligsahan, pagtanggap ng hypothesis, threshold-gated na pagmamarka, ang network-isolated na method executor kasama ang import scan) **ships today** in `mt-eval` — see the nito) ay kasama ngayon — tingnan ang [sovereign contest guide](/docs/network/sovereignty/run-a-sovereign-contest).
Ang **threshold key ceremony at sealed-at-rest na workflow ng §4 ay kasama rin ngayon**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, mga quorum share na ipinapakita sa oras ng pagpapatakbo
(`node run-method --offline --share …`), isang hash-chained na lokal na
authorization ledger (`node ledger verify|head`), mga nilagdaang score manifest
(`node sign-manifest` / `node verify-manifest`), at ang §2–§3 air-gap
tooling (`node bundle`, `node manifest`, `node egress-check`). Ang
single-keypair stand-in ay nananatili lamang para sa mga paligsahan kung saan ang organizer
ang ganap na may hawak ng mga reference — bawat surface ay naglalagay ng label kung aling lane ang
ginagamit. Sa madaling salita, ang **hindi** kasama sa v1: ang hardware remote
attestation (TEE) ay hindi inaangkin (§5), at ang platform-side threshold
*signing* (mga pag-apruba sa telepono ng custodian laban sa hosted infrastructure) ay
trabaho para sa hinaharap — sa isang sovereign node, ang pangangalaga ay isinasagawa sa pamamagitan ng pisikal na pagpapakita ng M ng N na mga share sa makina (§4). At upang maging tumpak tungkol sa
cryptography: ito ay Shamir M-of-N secret sharing kung saan ang key
**ay binubuo muli sa naka-lock na memorya ng node sa panahon ng isang awtorisadong pagpapatakbo**
(pagkatapos ay i-ze-zero) — ito ay *hindi* multi-party computation, at ang key ay
panandaliang umiiral nang buo sa inyong offline na makina. Panghuli, hanggang sa magbukas ang
community consent gate, ang lane ay tumatakbo laban sa **synthetic data
lamang**; ang mga totoong corpora ay naghihintay sa pahintulot na iyon.
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

1. Mag-install ng kasalukuyang Linux LTS (Ubuntu/Debian) mula sa isang USB installer **nang
   nakatanggal ang network cable**; paganahin ang full-disk encryption sa pag-install.
2. Sa isang hiwalay at online na makina, buuin ang offline bundle —
   `mt-eval node bundle --out <dir>` wheels `mt-eval[node]` at ang mga
   dependency nito, kumokopya ng anumang `--include` na artifact, at nagsusulat ng isang sha256
   manifest sa bawat file. Ang lahat ng kailangan ng node ay tumatawid sa IN
   drive nang isang beses.
3. Ilipat ang bundle sa IN drive; i-verify ang sha256 ng bawat artifact
   laban sa manifest **sa node** bago i-install
   (`mt-eval node bundle --verify <dir>`).
4. Lumikha ng signing keypair ng node (`mt-eval node keygen`) at itala
   ang pampublikong kalahati nito — ilalathala ninyo ito upang ma-verify ng sinuman ang inyong mga score
   manifest (§5).
5. Mula noon, ang makina ay hindi na kailanman makakakita ng network — at ang isang sealed run ay
   maaaring gawin upang patunayan ito muna: ang `mt-eval node egress-check` (ipinapatupad din nang
   awtomatiko gamit ang `assert_airgap` sa node config) ay tumatanggi kapag ang isang
   ruta, isang probe, o DNS ay nagpapakita ng anumang paraan palabas. Ang mga OS update ay isang sinasadya,
   naka-bundle, at na-verify sa hash na kaganapan — hindi isang background service.

## 3. Disiplina sa paglipat (bawat paligsahan, parehong direksyon)

Ang air gap ay isang *pamamaraan*, hindi isang produkto. Ang pamamaraan:

- Ang **IN drive** ay nagdadala ng: mga isinumiteng method package, mga hypothesis file, at
  ang kanilang manifest. Bago tumakbo ang anuman, bini-verify ng node ang hash ng bawat package
  laban sa manifest at tumatakbo ang import scan (tinatanggihan nito ang mga paraan
  na nag-i-import ng mga network library — kasama ito ngayon).
- Ang **OUT drive** ay nagdadala ng: ang nilagdaang score manifest — mga pinagsama-samang marka, ang
  mga method/config hash na kinabibilangan ng mga ito, ang audit-log head — at *wala
  nang iba*. Ang mga per-segment na output ay nananatili sa node sa ilalim ng kontrol ng organizer;
  ang paglalathala sa mga ito ay isang hiwalay at sinadyang desisyon ng komunidad.
- Isang direksyon bawat drive, kailanman. Ang isang drive na humawak sa node ay hindi kailanman
  awtomatikong nagma-mount sa isang online na makina — i-mount ito nang `noexec,nodev` at kopyahin
  ang manifest nang manu-mano.
- Ang `mt-eval node manifest write <drive> --direction in|out` ay nagha-hash sa bawat
  file sa drive bago ang isang pagtawid; ang `mt-eval node manifest verify`
  sa tumatanggap na panig ay tumatanggi sa anumang idinagdag, binago, o nawawala.
- I-log ang bawat pagtawid (petsa, drive, manifest hash) sa papel ng node o
  sa on-node log. Ang pagiging nakakabagot ang punto: ang log ang nagbibigay-daan sa inyo na sagutin ang "mayroon
  pa bang ibang lumabas?" nang may ebidensya.

## 4. Pangangalaga sa key (M-of-N, hawak ng komunidad)

Ang naka-seal na test set ay naka-encrypt at rest; ang pag-decrypt ay nangangailangan ng isang quorum ng
mga key share na hawak ng mga custodian na **pinili ng komunidad** — isang konseho ng mga Nakatatanda (Elders'
council), isang awtoridad sa wika, isang katawan ng edukasyon. Ang platform ay walang hawak na
mga share; hindi kayang i-decrypt ng Champollion ang isang naka-seal na set, at hindi rin ito kaya ng sinumang nag-iisang
custodian lamang.

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

1. I-announce ang paligsahan; ilathala ang pampublikong key ng node + dev-set threshold.
2. Tumanggap ng mga isinumite online (karaniwang makina), buuin ang IN manifest
   (`mt-eval node manifest write <drive> --direction in`).
3. Dalhin ang IN drive sa node; i-verify ang mga hash (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods.
4. Pinapahintulutan ng mga custodian ang pagpapatakbo sa pamamagitan ng pagpapakita ng isang quorum ng mga share (§4 —
   `node run-method <id> --offline --share … --share …`); ang naka-seal na set ay
   nagde-decrypt patungo sa executor lamang. Walang quorum, walang pagpapatakbo — at ang pagtatangka
   ay nasa ledger.
5. I-execute; kinakalkula ang mga marka; ang mga per-segment na output ay pinapanatili sa panig ng node.
6. Teardown: ang gumaganang plaintext ay binubura; ang audit log ay idinadagdag; ang manifest ay nilalagdaan.
7. Dalhin pabalik ang OUT drive; ilathala ang mga marka + manifest; sinuman ay maaaring mag-verify
   (`node verify-manifest`).
8. I-log ang pagtawid; ang mga drive ay nananatiling nakalaan; ang node ay nananatiling nakapatay (dark).

