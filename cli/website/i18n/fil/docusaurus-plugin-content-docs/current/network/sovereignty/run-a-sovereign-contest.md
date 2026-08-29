---
sidebar_position: 9
title: "Magpatakbo ng Soberanyong Paligsahan"
slug: /network/sovereignty/run-a-sovereign-contest
description: "Ang self-serve, end-to-end na proseso para sa isang komunidad o organisasyon na magpatakbo ng MT contest gamit ang sarili nitong sealed, held-out corpus — nang hindi kailanman hinahawakan ng Champollion ang data o ang premyong salapi."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Magpatakbo ng Soberanong Paligsahan

> **Executive Summary.** Ang isang komunidad o organisasyon ay maaaring magpatakbo ng isang evaluation
> contest — kabilang ang isang sponsored prize — laban sa isang nakahiwalay na test corpus na
> **hindi kailanman umaalis sa sarili nitong infrastructure**. Kayo ang bumubuo ng corpus, nag-e-encrypt nito,
> nagho-host nito, at humahawak ng mga susi; ang Network ay nagrerehistro lamang ng isang content-free
> metadata card at isang ciphertext digest. Ang mga method ay nagku-qualify muna sa mga pampublikong corpus;
> bawat run laban sa inyong selyadong set ay nangangailangan ng authorization ng inyong mga custodian;
> **scores** lamang ang lumalabas kailanman. Ang prize funds ay **hawak ng sponsor**
> — ng inyong organisasyon o ng isang trust na itatalaga ninyo — at **hindi kailanman
> hinahawakan ng Champollion ang pera o ang data.** Ang pahinang ito ang end-to-end, self-serve
> runbook.

:::warning[Ano ang live ngayon kumpara sa nasa development]
Maging malinaw muna ang pananaw ninyo bago magsimula — ito ay isang umuunlad at hindi-komersiyal na research
project, at mas nais naming suriin ninyo kami kaysa basta pagkatiwalaan kami:

- ✅ **Live:** corpus registration (mga metadata card, hash-pinning, exposure
  lanes), ang sealed-set registry (digest + custodian group + qualifier, walang
  content), ang contest machinery na may sealed lane, ang authorization
  request/grant/audit data layer (pending → M-of-N decision → single-use
  time-boxed grant, append-only hash-chained audit log), at scores-only
  emission na ipinapatupad sa database layer.
- ✅ **Live: ang organizer scoring node + hypotheses lane.** Isang
  command ang naghahati sa inyong corpus sa isang public dev set (ang qualifier), isang blind
  test set (inilabas ang source, ang mga reference ay naka-seal at rest sa INYONG machine), at
  opsyonal na isang fully-secret set (`mt-eval contest prepare`). Ang pagrehistro ng
  (mga) sealed set, qualifier, at contest ay **self-serve mula sa inyong sariling
  sign-in** — `contest prepare --self-serve`, o `mt-eval contest register
  --manifest` para sa isang contest na inihanda ninyo nang maaga — kung saan ang bawat row
  ay identity-bound sa database layer; walang curator sa loop at walang
  privileged key (tingnan ang Step 4 para sa mga honest limit). Ang mga kalahok ay
  nagsusumite ng kanilang mga translation gamit ang `mt-eval contest submit-hypotheses` (ang CLI
  ay nagse-self-score ng dev set nang lokal at tinatanggihan ang mga upload na mas mababa sa inyong threshold);
  ang INYONG self-hosted node (`mt-eval node serve`) ay muling nag-i-score ng dev evidence
  mismo, nagge-gate sa qualifier, nag-a-authorize ayon sa model ng inyong contest
  (`per-submission` — isang custodian ang nag-aapruba sa bawat scoring — o `blanket` /
  `open`), nag-i-score ng blind set laban sa mga reference na hindi kailanman umaalis sa inyong
  machine, at nagpa-publish ng mga **aggregates-only** na run card. Ang HINDI
  pinapatunayan ng lane na ito: na ang pinangalanang method ang gumawa ng mga hypothesis (ang method identity ay
  inaangkin ng kalahok at nilalagyan ng label bilang ganoon sa bawat run card), at hindi nito
  mapipigilan ang isang determinadong adversary na kumuha ng reference signal sa maraming magkakaibang
  submission — ang mga rate limit, byte-identical dedup, at ang audit chain ay nagpapabagal
  dito; ang method-execution lane sa ibaba ang tunay na sagot.
- ✅ **Live: dalawang secret-set method lane.** Ang mga kalahok na may naka-publish na
  hypotheses-lane record ay maaaring magmungkahi ng kanilang method laban sa inyong secret set. Ang
  node ay pipili ng lane mula sa submission:
  - **Lane A — declarative model (mas pinipili).** Ang isang standard neural model ay
    DATA: ang `mt-eval contest submit-model` ay nagpapadala ng safetensors weights + isang
    declarative tokenizer + isang config — **walang code, walang Dockerfile.** Bine-verify ng inyong node
    na ito ay code-free (safetensors hindi pickle; walang
    `trust_remote_code`/`auto_map`; mga data-only file) at pinapatakbo ang mga weight sa
    SARILI nitong trusted engine (`transformers`, `trust_remote_code=False`, offline).
    Ang architecture ay permissive by default (anumang native na nilo-load ng inyong engine); ang isang
    maingat na host ay maaaring mag-pin ng isang allowlist. Walang untrusted na nag-e-execute, kaya walang
    kailangang i-sandbox. Naka-publish na `declarative-model`, ang method identity ay
    **code-free by construction**.
  - **Lane B — runnable bundle (sandbox fallback).** Para sa mga method na CODE talaga:
    ang `mt-eval contest submit-method` ay nagpapadala ng isang Dockerfile + entrypoint. Pagkatapos
    aprubahan ng inyong custodian, ie-execute ito ng INYONG node sa loob ng isang network-isolated
    container (`--network=none` — hindi umiiral ang network stack sa loob;
    read-only root, dropped capabilities, sanitized environment), na may
    mga automated static check muna at ang mga reference ay hindi kailanman pumapasok sa container.
    Naka-publish na `method-execution` na may **execution-verified** na identity.
  Alinman sa dalawang lane: ang bundle hash ay naka-freeze sa authorization request (kung ano ang
  tumatakbo ay mapapatunayang iyon ang iminungkahi), at ang mga score ay napa-publish sa pamamagitan ng parehong
  aggregates-only path. Para sa maximum isolation, ang scoring machine ay maaaring maging isang tunay na
  airgap: ang mga authorized request at Ed25519-signed scores-only bundle ay tumatawid sa pamamagitan ng
  removable media (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  ang secret text ay hindi kailanman nakakarating kahit sa connected machine. Ang HINDI pa
  kasama sa mga lane na ito: hardware attestation ng node (ang identity ay self-reported),
  pormal na dispute machinery, at — para sa Lane B partikular — mas malalim na container
  hardening bukod sa inalis na network stack (mga seccomp profile, microVM; ito ay isang dahilan
  para mas piliin ang Lane A). Tingnan ang
  [Honest Limitations](/docs/network/honest-limitations).
- 🔲 **In development: threshold signing.** Ang M-of-N custodian approval ay
  *naka-record* sa mga authorization at audit table ngayon; ang cryptographic
  threshold-key tooling na gumagawa sa isang grant na unmintable nang walang M shares ay hindi
  pa nabubuo — ang kasalukuyang sealing key ay isang labeled single-keypair stand-in
  (`champollion seal-corpus keygen`), at ang airgap score-bundle signature
  ay isang single node key (`seal-corpus sign-keygen`), hindi isang steward ceremony.
- ❌ **Not a thing, by design:** Ang pag-host ng Champollion sa inyong corpus, paghawak sa inyong mga
  key, o paghawak ng mga prize fund. Ang mga participant hypothesis (ang kanilang sariling mga translation)
  ay dumadaan sa aming storage; ang inyong corpus content ay hindi kailanman dumadaan dito.

Kung ang isang step sa ibaba ay nakadepende sa anumang nasa listahang 🔲, sinasabi iyon ng step.
:::

---

## Ang anyo ng kasunduan

| Sino | Humahawak | Hindi kailanman humahawak |
|-----|-------|-------------|
| **Kayo (community/org)** | Ang corpus, ang encryption keys (sa pamamagitan ng inyong custodians), ang prize funds, ang award decision | — |
| **Champollion / ang Network** | Isang metadata card, isang ciphertext digest, ang authorization + audit record, ang published scores | Nilalaman ng inyong corpus, inyong mga susi, inyong pera |
| **Method developers** | Kanilang method | Inyong test data — scores ang nakikita nila, hindi kailanman sentences |

Ang lahat sa ibaba ay ang mekanikal na pagpapalawak ng table na iyon.

---

## Mga prerequisite para sa organizer

Bago ang Step 1, alamin kung ano talaga ang kinakailangan upang patakbuhin ang panig ng node:

- **docker or podman** — kinakailangan para sa method-execution lane. Awtomatikong tinutukoy ng node ang docker, pagkatapos ang podman; kung wala ni isa, tahasan itong tumatanggi.
  Walang **fallback** — ang container isolation na may `--network=none` ang
  pangunahing garantiya, kaya walang tatakbo nang walang container runtime.
- **Node.js 20.11+ at ang `champollion` npm CLI** — hindi muling ini-implement ng harness ang sealing cipher. Ang `champollion seal-corpus` (mga verb: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) ang nag-iisang cipher
  implementation (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), at nagse-shell out dito ang organizer
  node.
- **Isang node config sa `~/.mt-eval/node.json`.** Tumangging magsimula ang bawat `mt-eval node` command
  kapag wala nito — patakbuhin ang alinman sa mga ito nang isang beses at tutukuyin ng error message
  ang config path at kung nasaan ang template (kasama ito sa harness
  source, sa `mt_eval_harness/contest_node.py`). Dala ng config ang inyong
  self-reported na `node_id` (nakabind sa bawat request fingerprint) at isang
  `contests` map na nakaturo sa inyong dev references at sealed artifacts.
- **Isang sign-in.** Walang hiwalay na hakbang para sa paggawa ng account: ang unang command
  na nangangailangan ng identity (hal. `mt-eval contest prepare --self-serve` o
  `mt-eval publish`) ay nagbubukas ng browser OAuth sign-in sa pamamagitan ng **GitHub o Google**
  (Supabase Auth). Ang email ng account na iyon ang identity kung saan nakabind ang bawat registry row — gumamit ng kontrolado ng inyong organisasyon.
- **Ang intake throttle.** Ang mga submission ng participant ay nire-rate-limit bawat
  submitter sa **5 kada 24 oras bilang default** (anti-probing; itakda bawat contest
  gamit ang `--intake-daily-limit` sa prepare time, o bilang default ng shared-task edition).
  Iplano ang timeline ng inyong contest batay dito.

**Isang tapat na caveat tungkol sa self-serve registration.** Sa **default
network-hosted endpoint**, kasalukuyang humihinto ang self-serve registration (`contest prepare
--self-serve` / `contest register`) sa production-endpoint
guard: tumatanggi ang CLI gamit ang malinaw na mensahe sa halip na sumulat sa
production project, habang nakabinbin ang policy decision tungkol sa pagbubukas ng pintong iyon. Hindi apektado ang mga federated
host (ang inyong sariling Supabase project). Kung matamaan ninyo ang guard sa
default host, iyon ang kasalukuyang kalagayan, hindi
misconfiguration sa inyong panig — [magbukas ng issue](https://github.com/gamedaysuits)
at gagabayan namin ang registration.

---

## Step 1 — Buuin ang inyong held-out test corpus

Idisenyo ang corpus na susukatin ninyo, at panatilihin itong nakahiwalay mula sa unang araw:
wala rito ang dapat na nailathala, nai-post, o naibahagi sa isang model
provider kailanman.

- Sundin ang [Corpus Design Framework](/docs/network/specifications/corpus-design)
  para sa entry structure, difficulty tiers, at register coverage, at ang
  [Corpus Creation cookbook](/docs/network/tutorials/corpus-creation) para sa
  tooling.
- Ipasuri ang entries sa fluent speakers bago i-seal — inilalarawan ng
  [Speaker Validation Protocol](/docs/network/specifications/speaker-validation)
  ang isang review structure na maaari ninyong muling gamitin para sa corpus QA, hindi lamang method
  review.
- Pagpasyahan na ngayon ang **version** label ng corpus (hal. `v1`). Ang authorization grants ay
  nakatali sa isang partikular na version, kaya ang versioning ay bahagi ng security model, hindi
  bookkeeping.

## Step 2 — I-encrypt ito at i-host sa INYONG infrastructure

I-encrypt ang corpus at rest (anumang modernong AEAD scheme — hal. `age`/x25519 o
AES-256-GCM) at i-host ang **ciphertext** sa isang lugar na kontrolado ninyo. Hindi kailanman
natatanggap ng Champollion ang plaintext *o* ang ciphertext.

Mag-publish ng eksaktong isang artifact: ang **SHA-256 digest ng ciphertext blob**.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

Publiko ang digest; ang data ay hindi. Sinuman ay maaaring mag-verify sa kalaunan na ang blob
na ginamit sa evaluation ay byte-identical sa blob na ni-seal ninyo — integrity without
possession. Ito ang parehong hash-instead-of-copy discipline gaya ng
[ordinary corpus registration](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content).

## Step 3 — Irehistro ang metadata card

Irehistro ang corpus sa pamamagitan ng standard, fail-private
[registration lane](/docs/network/sovereignty/registering-corpora): isang card na may
`language_pair`, `license`, `attribution`, at `do_not_train` — **walang
sentences**. Piliin ang **private** exposure lane; ang sealed-set registration
sa susunod na step ang gagawing contest-eligible ito.

## Step 4 — Irehistro ito bilang sealed set

Ang sealed set ay isang content-free registry entry na naglalagay ng tatlong bagay sa
public record:

| Field | Kung ano ang ipinapangako nito na susundin ninyo |
|-------|------------------------|
| `ciphertext_digest` | Ang eksaktong bytes na ituturing na "ang corpus" |
| `custodian_group_id` | Isang opaque id para sa grupong kumokontrol sa access (hindi kailanman public org/nation name bago ang consent) |
| `current_qualifier_id` | Ang public round na dapat maipasa ng isang method bago pa man maaaring magmungkahi ng sealed run |

Ang registration ay **self-serve, mula sa sarili ninyong sign-in** — walang curator sa loop
at walang privileged key:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

Nananatili ang manifest sa inyong machine — ang registration ay nagpapadala lamang ng content-free
ids, digests, at thresholds. Bawat registry row ay **identity-bound**: itinatala ng
database ang signed-in account na nagrehistro nito at ni-freeze ang binding na iyon
laban sa mga susunod na edit, at ang isang qualifier ay maaari lamang mag-gate ng sealed set na inirehistro ng
**parehong** identity. Ipinapanganak na quarantined ang sealed sets (hindi sila kailanman
maaaring sumuporta sa ordinary contest o mag-rank sa public leaderboard), ipinapanganak ang qualifiers
sa safe state, at rate-limited ang registration — lahat ay ipinapatupad ng
database triggers sa ilalim ng bawat client, kabilang ang amin. Ang registry mismo ay
publicly readable, kaya maaari ninyong i-verify na sinasabi ng inyong entry ang eksaktong ni-seal ninyo —
at wala nang iba.

**Tapat na mga limitasyon.** Ang self-serve door ay registration-only (insert-only sa
database layer). **Ang qualifier rotation at sealed-set retirement ay nananatiling
curator-mediated** — magbukas ng issue o makipag-ugnayan sa project sa pamamagitan ng
[GitHub](https://github.com/gamedaysuits). At ang pagpapatakbo ng organizer scoring
node sa mga susunod na step (lifecycle advances, authorization grants, audit
operations) ay hiwalay na service-credentialed lane sa sarili ninyong node —
humihinto ang self-serve sa public record.

## Step 5 — Pumili ng custodians at ng M-of-N rule

Piliin ang mga tao o institusyong dapat magkasamang mag-apruba sa bawat evaluation
laban sa inyong corpus, at ang threshold (hal. **3 of 5**). Dapat maging
accountable ang custodians sa inyong komunidad, hindi sa Champollion — tingnan ang
[Data Stewardship](/docs/network/sovereignty/data-sovereignty) at
[Ownership & Terms](/docs/network/sovereignty/ownership-transfer) para sa kung paano
itinatakda ang per-community terms.

**Honesty box:** ang threshold-*cryptography* tooling (key shares kung saan ang isang
grant ay literal na hindi maaaring ma-mint nang walang M signatures) ay **nasa development**.
Ngayon, ang M-of-N rule ay ipinapatupad bilang recorded process: bawat access request
ay pumapasok sa isang **pending** queue, itinatala ang custodian decisions, ang grant ay minimi-mint
lamang para sa isang authorized request, bawat grant ay **single-use, time-boxed, at
nakatali sa isang partikular na (method, corpus version, evaluation node) fingerprint**,
at bawat event — kabilang ang blocked attempts — ay napupunta sa isang **append-only,
hash-chained, publicly readable audit log**. Tinatanggihan ng database ang illegal state
transitions sa ilalim ng bawat client at key. Ang hindi pa nito kayang tanggihan ay ang
compromise ng platform operator mismo — iyon ang isinasara ng threshold signing,
at hanggang ma-ship ito, dapat ninyong ituring ang "Champollion holds zero key shares"
bilang design goal na pinagtatrabahuhan, hindi isang property na maaari ninyong ma-verify ngayon.

## Step 6 — Itakda ang premyo

Magpasya, at i-publish kasama ng contest:

- **Amount and currency.**
- **Sponsor** — kung sino ang maglalagay ng pera.
- **Kung saan nakaupo ang funds** — account ng inyong organisasyon, o isang community trust
  na itatalaga ninyo. **Hindi kailanman humahawak, nag-e-escrow, o nagra-route ng prize funds ang Champollion.**
  Ang pag-publish ng identity ng holder sa simula pa lang ang nagpapaniwala sa prize;
  tingnan ang [sponsor-default risk note](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  sa terms templates.
- **Threshold conditions** — ang score bar na dapat maipasa ng isang method, nakasulat
  ayon sa [Prize Specification](/docs/network/specifications/prizes): metric
  thresholds, speaker-validation requirements, reproducibility. Gawing verifiable ang award
  conditions mula sa published scores, upang walang kailangang basta maniwala sa inyong
  salita (o sa amin) kung naabot ang bar.

## Step 7 — Gumawa ng contest

Ang contests sa sealed sets ay gumagamit ng explicit **sealed lane**. Ang eligibility ay
fail-closed: tatanggihan ang contest maliban kung umiiral at active ang inyong sealed-set registration
— at ang paggawa ng contest ay hindi nagbibigay ng access sa corpus sa **sinuman**.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(Ang `--corpus` value ay ang inyong registered `sealed_set_id`. Ang sealed lane ay
pinipili **awtomatiko** mula sa sealed-set registration — walang karagdagang flag; ang isang
sealed set ay hindi kailanman maaaring sumuporta sa ordinary contest, at ang isang ordinary quarantined
dataset ay hindi kailanman maaaring sumuporta sa anumang contest. Parehong rule ay ipinapatupad sa database,
sa ilalim ng bawat client. Kung nagrehistro kayo sa Step 4 gamit ang `contest register` o
`prepare --self-serve`, ang contest row ay **umiiral na** — laktawan ang step na ito;
ang `contest create` nang mano-mano ay para lamang sa pag-assemble ng contest mula sa isang
already-registered sealed set.)*

## Step 8 — Mag-qualify muna ang methods sa publiko

Binubuo at ini-score ng developers ang kanilang methods sa **public** corpora para sa inyong
language pair — ang normal na
[submit-a-method](/docs/network/getting-started/submit-a-method) path. Pinapangalanan ng
`current_qualifier_id` ng inyong sealed set ang public round na dapat maipasa ng isang method
bago pa man maaaring humiling ng sealed run. Pinananatili nitong malayo sa inyong
corpus ang probing pressure: walang makakapag-aim sa sealed set hanggang maipakita nila ang tunay na
performance sa open.

:::note[Mga participant: saang endpoint nakatira ang inyong contest?]
Ang **network-hosted** contest ay hindi nangangailangan ng setup — dala ng default endpoint na kasama sa harness
ang contest machinery (hypotheses intake, qualifier
gate, method proposals), at gumagana agad ang `mt-eval contest submit-hypotheses` /
`submit-method`.

Ang **federated** contest — pinapatakbo ng organizer ang machinery sa sarili nilang
Supabase project, kaya ang submissions ay hindi kailanman dumaraan sa amin — ay naglalathala ng endpoint nito
kasama ng contest materials. I-export ito bago magsumite:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Kung ang harness ay nakaturo sa endpoint na walang contest
machinery (halimbawa, isang federated host na kulang ng migration), hihinto ang command na may
*"hindi pa available ang contest lane sa Supabase endpoint na ito"* at sasabihin sa inyo
kung aling endpoint ang kausap nito. (Mga federated organizer: ilathala ang dalawang
value na ito sa tabi ng inyong corpus release, `--node-id`, at `--corpus-version`.)
:::

## Step 9 — Sealed runs: request, authorize, execute, scores out

Para sa bawat qualifying method:

1. Isang **request** ang isinasampa laban sa inyong sealed set — pumapasok ito sa `pending` at
   may dalang immutable fingerprint ng (method tarball hash, corpus id, corpus
   version, `scores-only`, evaluation-node measurement).
2. Nagpapasya ang inyong **custodians** (M-of-N). Ang approval ay nagmi-mint ng **grant**: single-use,
   expiring, valid lamang para sa eksaktong fingerprint na iyon.
3. Tumatakbo ang evaluation sa network-isolated sandbox sa **inyong** node
   (`mt-eval node run-method`): automated static checks, isang container na walang
   network stack, references na nasa labas nito — o, para sa maximum isolation, sa
   isang true-airgap machine na may signed scores-only bundles na tumatawid sa pamamagitan ng
   removable media (tingnan ang status box sa itaas para sa kung ano ang sakop at hindi sakop).
4. **Scores lamang ang umaalis.** Ang `scores-only` emission rule ay naka-pin sa
   database layer; ang per-entry text mula sa inyong corpus ay hindi kailanman ipinapa-publish.
5. Bawat step — request, votes, grant, use, at anumang blocked attempt — ay
   idinadagdag sa public, hash-chained audit log na maaari ninyong (at ng sinuman) i-replay.

## Pagsusumite ng isang method (para sa mga kalahok) — dalawang lane

Karamihan sa mga NMT entry ay hindi exotic: isang standard fine-tuned transformer at ang mga weight nito. Para sa mga ito, mayroong isang **mas pinipiling code-free lane** — at isang sandbox fallback para sa mga method na talagang code.

### Lane A — declarative model (mas pinipili para sa standard NMT)

Kung ang inyong method ay isang standard neural model, isusumite ninyo ito bilang **data** — ang mga weight, tokenizer, at config — at papatatakbuhin ito ng organizer sa kanilang sariling trusted inference engine. **Walang Dockerfile, walang code, walang sandbox.** Dahil walang nag-e-execute sa inyong isinumite, ang safety check ng organizer ay isang decidable format validation sa halip na subukang patunayan na ligtas ang arbitrary code — isang mas matibay na garantiya para sa inyo at para sa corpus.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

Ang mga panuntunan na dapat sundin ng inyong bundle (bina-validate nang lokal bago i-upload, at muli ng node ng organizer):

- **Ang mga weight ay `safetensors`, hindi kailanman pickle.** Ang isang PyTorch `.bin`/`.pt`/`.ckpt`
  ay isang pickle — arbitrary code kapag nai-load — at ito ay tinatanggihan. I-export sa
  `model.safetensors` (katutubong ginagawa ito ng `safetensors` / `transformers`).
- **Isang architecture na native na nilo-load ng engine ng organizer.** Ang `architectures` ng
  `config.json` ay maaaring maging anumang architecture na ipinapatupad ng `transformers` ng host
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, at marami pang iba) — ang mga host ay
  **permissive by default**, dahil sa `trust_remote_code=False` ang kaligtasan
  ay nagmumula sa code-free format, hindi sa pangalan ng architecture (ang isang hindi sinusuportahang
  architecture ay mabibigo lamang na mag-load, at walang papatatakbuhin). Ang isang maingat na host ay maaaring
  mag-publish ng isang allowlist. Walang `auto_map`, walang `trust_remote_code` — ang mga ito ay nagpupuslit
  ng custom code pabalik at palaging tinatanggihan.
- **Isang declarative tokenizer** (`tokenizer.json` o isang `sentencepiece` `.model` +
  vocab), at **mga data file lamang** — walang `.py`/scripts/binaries sa bundle.

Pinapatakbo ito ng organizer gamit ang `trust_remote_code=False`, offline, at mga score lamang ang umaalis — naka-publish bilang `declarative-model`, ang method identity ay **code-free by construction**. (Multi-GB weights: gamitin ang `--bundle-out` para sa sneakernet lane, katulad sa ibaba.)

### Lane B — runnable bundle (ang sandbox, para sa mga code method)

Kung ang inyong method ay talagang code — isang pipeline, isang LLM-coached hybrid, isang custom decoder — hindi ito mapapatakbo nang declarative, kaya dadaan ito sa network-isolated sandbox sa halip. Ito ang honestly-weaker lane (naglalaman ito ng untrusted code sa halip na tanggihang patakbuhin ito), kaya gamitin po ang Lane A sa tuwing ang inyong method ay isang standard model.

**Ang runnable-bundle contract ay stdin/stdout.** Nagdedeklara ang inyong bundle ng
entrypoint (hal. `method/translate.py`). Sa loob ng container, eksaktong pinapatakbo ng organizer
node ang:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Dumarating ang source sentences nang tig-isang linya sa stdin; magsusulat kayo ng isang translation bawat
linya sa stdout. Lahat ng ipinasa ninyo bilang `--method-dir` ay naka-pack sa ilalim ng
`method/` sa bundle at naka-mount nang **read-only sa `/method`** sa run time —
kasama ang weights, nang hindi kailangang kopyahin papasok sa image. Walang
network stack ang container (`--network=none`), may read-only root, at may writable na `/tmp`.

**Isang minimal na Hugging Face transformers wrapper:**

```python title="method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**Dapat mag-build ang Dockerfile nang walang network.** Binu-build ng organizer ang inyong image
gamit ang `--network=none` — ang air-gap build test *mismo* ang build — kaya ang bawat
dependency ay dapat **naka-vendor sa bundle** (ang isang `pip install` na umaabot sa
PyPI ay mabibigo sa build, at i-flag ng pre-flight static scan ang network calls
bago pa man may maipadala). Mag-ship ng wheels sa loob ng inyong method dir at mag-install
mula sa mga ito:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

Isumite ito gamit ang:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(Kailangan muna ninyo ng published hypotheses-lane record para sa contest — ang T1 gate ng Step 9 — at kinikilala ng `--agree` ang method-submission terms.)

**Multi-GB weights: gamitin ang sneakernet lane.** Ina-upload ng hosted intake path
ang inyong tarball bilang **iisang POST** sa storage ng contest host, kaya
nililimitahan ito ng storage upload limit ng host na iyon — sapat para sa code at maliliit na model,
ngunit hindi para sa multi-GB checkpoints. Pinapayagan mismo ng bundle contract ang mas malalaking
artifact (mga tarball hanggang 100 GB, mga built image hanggang 150 GB). Para sa malalaking weights,
laktawan ang hosted upload:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

Ang exchange directory ay dinadala sa organizer sa pamamagitan ng removable media (o anumang
channel na pareho ninyong pinagkakatiwalaan); ini-ingest nila ito gamit ang `mt-eval node import-bundle`. Ang
SHA-256 ng bundle ay naka-freeze sa authorization request sa alinmang paraan, kaya ang
tumatakbo ay mapapatunayang ang mismong iminungkahi ninyo.

**Mga organizer: i-pre-load ang base images sa mga airgap machine.** Dahil tumatakbo ang image
build gamit ang `--network=none`, ang `FROM` base image ng Dockerfile ay dapat
nasa local image store na ng machine. Sa isang connected machine,
`docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`;
dalhin ang `base.tar` kasama ng bundle; sa airgap machine,
`docker load -i base.tar` bago patakbuhin ang `mt-eval node run-method`. Pagkasunduan ang
base image(s) kasama ng mga participant sa inyong published contest materials.

## Step 10 — I-publish ang scores, mag-award ayon sa inyong published threshold

Ang scores-only results ay ipinapa-publish sa [leaderboard](/docs/network/leaderboard/rules)
tulad ng anumang ibang run, na minarkahan bilang sealed-set evaluations. Kung naipasa ng isang method ang
threshold conditions na inilathala ninyo sa Step 6 — kabilang ang
[speaker validation](/docs/network/specifications/speaker-validation), na
gate ng inyong komunidad, hindi automated — **kayo** (o ang inyong trust) ang magbibigay ng
premyo, ayon sa sarili ninyong published terms. Nagtatapos ang papel ng Champollion sa measurement.

---

## Ang pinananatili ninyo, magpakailanman

- **Ang corpus.** Hindi ito kailanman umalis sa inyong infrastructure. I-offline ang ciphertext
  at hihinto lang ang sealed set na maging runnable.
- **Ang mga susi.** Namamatay ang access kapag huminto ang inyong custodians sa pagbibigay nito.
- **Ang pera.** Hindi ito kailanman napunta sa ibang lugar.
- **Ang record.** Ang head digest ng audit log ay maaaring i-publish, kaya ang history ng
  kung sino ang nagpatakbo ng ano laban sa inyong corpus ay hindi maaaring tahimik na isulat muli — ng sinuman,
  kabilang kami.

Para sa terms language na maaari ninyong iangkop — ownership, scores-only licensing, at isang
explicit tour ng mga paraan kung paano maaaring atakihin ang isang contest —
tingnan ang [Terms Templates](/docs/network/sovereignty/terms-templates).
