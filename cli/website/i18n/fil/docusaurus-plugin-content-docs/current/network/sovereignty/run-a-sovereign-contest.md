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

- ✅ **Live:** pagpaparehistro ng corpus (mga metadata card, hash-pinning, mga exposure lane), ang sealed-set registry (digest + custodian group + qualifier, walang nilalaman), ang makinarya ng paligsahan kasama ang sealed lane, ang data layer ng kahilingan/pagkakaloob/pag-audit ng awtorisasyon (nakabinbin → desisyong M-ng-N → minsanang pagkakaloob na may takdang panahon, append-only hash-chained audit log), at ang scores-only emission na ipinapatupad sa antas ng database.
- ✅ **Live: ang organizer scoring node.** Isang command lang ang maghahati sa inyong corpus patungo sa isang pampublikong dev set (ang qualifier kung saan nagsasagawa ng self-score ang mga kalahok) at isang sealed secret set kung saan pinapagana ng inyong node ang mga entry, at ise-seal ang lihim na kalahati habang nakatigil sa INYONG machine (`mt-eval contest prepare`). Ang pagpaparehistro ng (mga) sealed set, qualifier, at paligsahan ay **self-serve mula sa sarili ninyong sign-in** — `contest prepare --self-serve`, o `mt-eval contest register --manifest` para sa isang paligsahang inihanda ninyo kanina — kung saan ang bawat row ay nakatali sa pagkakakilanlan sa antas ng database; walang curator na kailangan at walang privileged key (tingnan ang Hakbang 4 para sa mga tapat na limitasyon).
- ✅ **Live: ang mga entry ay mga PAMAMARAAN, hindi mga pagsasalin.** Sinasalihan ang isang paligsahan sa pamamagitan ng pagbibigay sa inyong node ng isang bagay na maaari nitong PATAKBUHIN. Nagsasagawa ng self-score ang isang kalahok sa pampublikong dev set (`mt-eval contest qualify`) upang makakuha ng resibo, pagkatapos ay nagpapasa ng isang modelo o isang pamamaraan; muling pinapatakbo ng inyong node ang score ng resibong iyon sa sarili nitong kopya ng dev set bago hilingin sa sinumang custodian na mag-apruba ng anuman, at tatanggihan kapag hindi tumugma. Pipiliin ng node ang lane mula sa pagsusumite:
  - **Lane A — deklaratibong modelo (mas mainam).** Ang isang karaniwang neural model ay DATA: nagpapadala ang `mt-eval contest submit-model` ng mga safetensors weight + isang deklaratibong tokenizer + isang config — **walang code, walang Dockerfile.** Patutunayan ng inyong node na wala itong code (safetensors hindi pickle; walang `trust_remote_code`/`auto_map`; mga file na data lamang) at papaganahin ang mga weight sa SARILI nitong pinagkakatiwalaang engine (`transformers`, `trust_remote_code=False`, offline). Permissive ang arkitektura ayon sa default (anumang native na nailo-load ng inyong engine); ang isang maingat na host ay maaaring magtakda ng allowlist. Walang hindi pinagkakatiwalaang bagay na tatakbo, kaya walang kailangang i-sandbox. Na-publish bilang `declarative-model`, ang pagkakakilanlan ng pamamaraan ay **likas na walang code**.
  - **Lane B — runnable bundle (sandbox fallback).** Para sa mga pamamaraang CODE talaga: nagpapadala ang `mt-eval contest submit-method` ng Dockerfile + entrypoint. Pagkatapos mag-apruba ng inyong custodian, patatakbuhin ito ng INYONG node sa loob ng isang network-isolated na container (`--network=none` — hindi umiiral ang network stack sa loob; read-only root, tinanggal ang mga capability, nilinis ang environment), na may mga awtomatikong static check muna at hindi kailanman pumapasok ang mga reference sa container. Na-publish bilang `method-execution` na may pagkakakilanlang **napatunayan sa pagpapatupad**.
  Alinmang lane: ang hash ng bundle ay naka-freeze sa kahilingan ng awtorisasyon (ang tumatakbo ay mapapatunayang siyang iminungkahi), at ang mga score ay nai-publish sa pamamagitan ng parehong aggregates-only na path. Para sa pinakamataas na paghihiwalay, ang scoring machine ay maaaring maging isang tunay na airgap: ang mga awtorisadong kahilingan at mga Ed25519-signed scores-only bundle ay inililipat gamit ang removable media (`mt-eval node relay` / `import-bundle` / `export-scores`) — ang lihim na teksto ay hindi kailanman aabot kahit sa konektadong machine. Ang HINDI pa kasama sa mga lane na ito: hardware attestation ng node (ang pagkakakilanlan ay self-reported), pormal na makinarya para sa mga pagtatalo, at — partikular para sa Lane B — mas malalim na pagpapatibay ng container bukod sa tinanggal na network stack (mga seccomp profile, mga microVM; isa itong dahilan upang piliin ang Lane A). Tingnan ang
  [Mga Tapat na Limitasyon](/docs/network/honest-limitations).
- ✅ **Live na ang promise layer (2026-09-07).** Ang mga deklarasyon ng entry (primary/contrastive, mga track), mga yugto ng pagsusumite, mga pinigil na resulta (`hidden_until_close`), at ang freeze na nagpapanatili sa inyong mga idineklarang pangako na hindi na mababago kapag mayroon nang mga entry ay ipinapatupad sa database sa network-hosted endpoint. Ang isang federated host ay nakakakuha ng parehong mga panuntunan sa pamamagitan ng paglalapat ng migrasyon na kasama ng harness; laban sa isang mas lumang endpoint, ang harness ay bumabalik sa base set at hayagang sinasabi ito (`declarations_available: false`) sa halip na magpanggap. Kung saan sinasabi ng isang hakbang sa ibaba na *hini-freeze / pinipigil ng database*, totoo ito.
- 🔲 **Kasalukuyang ginagawa: threshold signing.** Para sa isang set na selyado gamit ang `champollion seal-corpus`, ang pag-apruba ng M-ng-N custodian ay *nakatala* sa mga talahanayan ng awtorisasyon at pag-audit, at ang sealing key ay isang may-label na single-keypair stand-in (`champollion seal-corpus keygen`). Ang isang set na selyado sa offline node (`mt-eval node seal`) ay gumagamit ng built-in na **key ceremony** ng node (`mt-eval node ceremony`): ang key ng set ay hinahati sa M-ng-N at muling binubuo lamang sa memory habang isinasagawa ang isang quorum-authorized na pagpapatakbo. Ang seremonyang iyon ay hindi pa nagamit sa isang tunay na custodian, at ang mga share nito ay payak na mga file sa v1. Alinmang path ay walang threshold *signing*: ang lagda ng airgap score-bundle ay isang solong node key (`seal-corpus sign-keygen`).
- ❌ **Sadyang hindi bahagi ng disenyo:** Ang pag-host ng Champollion sa inyong corpus, paghawak sa inyong mga key, o paghawak ng mga pondo para sa premyo. Ang bundle ng isang kalahok (ang sarili nilang modelo o code) ay dumaraan lamang sa aming storage patungo sa inyong node; ang nilalaman ng inyong corpus ay hindi kailanman dumaraan doon.
- ❌ **Tinanggal sa halip na iwanan bilang bitag.** Ang `contest submit-hypotheses` (iniretiro noong 2026-09-06) ay nag-upload ng mga pagsasalin ng isang source-public blind set; ang `contest submit` (iniretiro noong 2026-09-06) ay nag-link ng score na kayo mismo ang nag-publish. Wala sa mga ito ang daan sa pagsali sa paligsahan ngayon. Ang isang source-public blind round ay nananatili lamang bilang isang opsyonal na diagnostic ng organizer, at ang mga self-reported score ay nananatili pa rin sa bukas na leaderboard — na isang pampublikong board na naka-index ayon sa corpus at direksyon ng pares, hindi isang paligsahan.

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

- **Ang harness kasama ang node extra nito:**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 o mas bago; gamitin ang
  `python3 -m pip`, na gumagana sa anumang environment kung saan tumatakbo ang harness —
  ang payak na `pip` ay wala sa `PATH` sa bawat virtual environment). Idinaragdag ng `[node]` extra
  ang `cryptography` library na ginagamit ng `mt-eval node keygen`, ng seremonya ng custodian
  at ng pagpirma sa score-manifest. Kulang nito ang isang payak na
  `python3 -m pip install mt-eval-harness`, at hihinto ang mga command na iyon at tutukuyin
  ang pag-install na ito.
- **docker o podman** — kinakailangan para sa lane ng pagpapatakbo ng pamamaraan. Awtomatikong dinedetect ng node
  ang docker, pagkatapos ay podman (ang `sandbox.runtime` sa `node.json` ay `null`
  bilang default; magtukoy ng isa roon upang igiit ito). Kung wala sa `PATH` ang alinman sa dalawa,
  tatanggi ang `mt-eval node run-method` gamit ang isang linyang nagpapangalan sa dalawa, bago ito magpatakbo
  ng anuman, at maiiwan ang kahilingan sa dating kalagayan upang mapatakbo ninyo ito kapag
  may naka-install nang runtime. Walang **fallback**. Ang container isolation na may
  `--network=none` ang pinakamahalagang garantiya, kaya walang tatakbo kung walang
  container runtime.
- **Node.js 20.11+ at ang `champollion` npm CLI** — hindi muling ipinapatupad ng harness
  ang sealing cipher. Ang `champollion seal-corpus` (mga pandiwa: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) ang nag-iisang pagpapatupad
  ng cipher (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), at ang organizer
  node ay tumatawag dito.
- **Isang node config sa `~/.mt-eval/node.json`.** Ang bawat command ng `mt-eval node`
  ay tatanggings magsimula kung wala nito. Nagsusulat ang `mt-eval node init` ng panimulang config
  doon (ipinapakita naman ito ng `--print`). Hawak nito ang inyong self-reported na `node_id`
  (nakatali sa bawat fingerprint ng kahilingan) at isang `contests` map na nakaturo sa inyong
  dev set, inyong sealed set (`secret_set_id` + `secret_artifact`), inyong sealed
  holdout kung naghanda kayo nito (`holdout_set_id` + `holdout_corpus`; tanggalin
  ang parehong key kung hindi kayo naghanda) at ang pampublikong qualifier gate (`qualifier` +
  `dev_corpus`, ang threshold sa 0–100 qualifier scale). Kapag napatakbo na ninyo ang
  `contest prepare` (Hakbang 1), isusulat ng `mt-eval node init --from-contest ./mytask`
  ang panimulang config kung saan napunan na ang mga value ng paligsahan mula sa
  `./mytask/local/manifest.json`, at itatala kung ano pa ang natitira para sa inyo. Ang mapping
  na inilalapat nito (punan nang manu-mano kung nais ninyo):

  | `local/manifest.json` | `node.json` (sa ilalim ng `contests.<contest-id>`) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (parehong tinatanggal kapag walang holdout) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (parehong mga pangalan) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`: ang kopyang binasa ng `contest prepare` (`--test-suite <id>=<path>`, o isang nahanap nito), kapag ito ay nasa machine na ito kasama ang mga na-pin na byte; kung hindi ay itatakda ninyo ang `corpus_path` |
  | `secret.sealed_block.keyScheme` | `custody`: `single-key` para sa isang set na selyado sa isang keypair (pagkatapos ay itakda ang `secret_privkey`), `threshold-quorum` para sa isang seremonya |
  | `registration.prize_terms` (itinala ng `contest prepare` at `contest register`) | `prize_terms_sha256`: ang SHA-256 ng mga tuntunin, ang hash na ipinapasa ng mga kalahok sa `--accept-terms` (hindi isinasama kapag walang idineklarang premyo ang paligsahan) |

  Ang contest id ay ang `--slug` na ibinigay ninyo sa `contest prepare` (`mytask` sa
  halimbawa sa ibaba). Itinatala ito ng Prepare sa manifest, inililikha ng pagpaparehistro
  ang paligsahan sa ilalim nito, at ito ang id na ipinapasa ng mga kalahok sa `contest qualify`
  at `submit-method`, kaya ipahayag ito kasabay ng paglabas ng dev; pinapawalang-bisa
  ito ng `--contest-id`. (Ang isang manifest na isinulat bago naitala ang id ay nagpapanatili ng id
  na nakuha mula sa pangalan nito sa pagpaparehistro, `"My Task 2026"` → `my-task-2026`,
  dahil iyon ang ginagamit na ng paligsahan, mga resibo, at mga node config nito.) Walang
  manifest na nakakaalam sa `node_id`, `cards_dir`, `signing_key` o sa inyong private key
  file, kaya mananatili ang mga iyon bilang `<...>` upang inyong punan.
  Susuriin ito pagkatapos ng `mt-eval node ledger verify` at sasabihin kung ano ang sinuri nito:
  ilo-load nito ang config (custody, ang buong qualifier gate, ang holdout pair, ang
  lokal na card index), tatanggihan ang unang value na isa pa ring `<...>`
  placeholder o isang idineklarang file na wala sa machine na ito, ipi-print ang mga set at file
  ng bawat paligsahan, at saka lamang muling papaganahin ang hash chain ng ledger ng awtorisasyon
  (zero entry sa isang bagong node).
- **Isang lokal na language-card index na dala ng node.** Tinutukoy ng scoring ang language
  pair ng pagpapatakbo, at hindi kailanman naghahanap ang node ng wika sa network.
  Ituro ang `cards_dir` sa `node.json` sa isang directory na naglalaman ng card para sa bawat
  wikang iniiskor ng inyong node (o itakda ang `MT_EVAL_CARDS_DIR`); ang isang node na walang lokal
  na index ay tatanggi sa pagsisimula sa halip na kumuha nito online. Alinman sa mga naka-install
  na package ay hindi naglalaman ng bawat-wikang directory ng mga card, kaya sumulat ng isa sa isang konektadong
  machine gamit ang `champollion` CLI, isang `<code>.json` file bawat wika ng
  inyong pares:

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  Pagkatapos ay itakda ang `"cards_dir"` sa absolute path ng directory na iyon. Para sa isang
  air-gapped na node, dalhin ito sa offline bundle
  (`mt-eval node bundle --out <dir> --include node-cards`); mapupunta ito sa
  `<dir>/artifacts/node-cards`, at itinuturo ito roon ng `cards_dir` sa node.
- **Isang sign-in.** Walang hiwalay na hakbang sa paggawa ng account: ang unang command
  na nangangailangan ng pagkakakilanlan (hal. `mt-eval contest prepare --self-serve` o
  `mt-eval publish`) ay magbubukas ng browser OAuth sign-in sa pamamagitan ng **GitHub o Google**
  (Supabase Auth). Ang email ng account na iyon ang pagkakakilanlang nakatali sa bawat row ng registry —
  gumamit ng isa na kontrolado ng inyong organisasyon.
- **Ang intake throttle.** Ang mga pagsusumite ng kalahok ay naka-rate limit bawat
  nagsumite sa **5 bawat 24 oras bilang default** (anti-probing; itinatakda bawat paligsahan
  gamit ang `--intake-daily-limit` sa oras ng paghahanda, o bilang default ng edisyon ng shared-task).
  Isaayos ang timeline ng inyong paligsahan alinsunod dito.

**Isang tapat na paalala sa self-serve registration.** Sa **default na
network-hosted endpoint**, ang self-serve registration (`contest prepare
--self-serve` / `contest register`) sa kasalukuyan ay humihinto sa isang guard ng
production-endpoint: tatanggi ang CLI nang may malinaw na mensahe sa halip na sumulat sa
production project, habang hinihintay ang desisyon sa patakaran ukol sa pagbubukas ng pintong iyon. Ang mga
federated host (ang sarili ninyong Supabase project) ay hindi apektado. Kung tatamaan ninyo ang guard
sa default host, iyon ang kasalukuyang kalagayan ng system, hindi maling configuration
sa inyong panig — [magbukas ng issue](https://github.com/gamedaysuits/Champollion/issues)
at gagabayan namin kayo sa pagpaparehistro.

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

### Paano hinahati ang corpus

Isang command ang kukuha sa inyong master corpus at bubuo sa bawat tier, sa deterministikong
paraan mula sa isang seed na inyong pipiliin at itatala:

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

Ang `--qualifier-threshold` ay ang score na dapat maabot ng isang pamamaraan sa pampublikong dev set
bago ito patakbuhin ng inyong node sa sealed set at sa sealed holdout. Ito ay
nasa **0–100 qualifier scale**: ang qualifier score ay **corpus chrF++**
(sacreBLEU chrF, `word_order=2`) ng mga dev output laban sa inilabas na mga dev
reference — ang pangunahing sukatan ng pamantayan sa pag-iskor, at ang parehong numerong
itinatampok ng isang `mt-eval run` card para sa parehong mga output. Walang ibang inihahalo
dito; ang exact match ay ipinapakita sa tabi nito bilang diagnostic at hindi kailanman ginagamit bilang harang. Kinakalkula
ng inyong node ang parehong numero kapag muli nitong pinapatakbo ang isang pamamaraan, kaya ang resibo ng isang
kalahok at ang pagsukat ng inyong node ay maihahambing.

Itakda ang threshold mula sa mga chrF++ score na inyong nasukat sa dev set na ito (patakbuhin ang
`contest qualify` sa mga dev output ng isang baseline), hindi mula sa mga score sa iba pang
evaluation set: malaki ang pagkakaiba ng mga antas ng chrF++ sa pagitan ng mga wika at corpus.
Ang isang qualifier na nairehistro bago ang
[pamantayan sa pag-iskor](/docs/network/specifications/scoring#how-runs-are-scored)
kung saan ang iniretirong composite ang sukatan nito ay gumagana pa rin: ang threshold nito ay binabasa
sa sukatang chrF++, at sinasabi ito ng qualify sa bawat pagkakataon, kaya kumpirmahin ang numero o
magpalit patungo sa isang bagong qualifier.

Kinakailangan ang `--license`. Tinutukoy nito ang lisensya kung saan iniaalok
ang inilabas na dev set, at hindi kailanman pumipili ang mt-eval para sa inyo. Taglay ito ng inilabas na file bilang
`dataset.license`, na siyang binabasa ng `mt-eval run`, `contest qualify` at
`publish`, kaya ang mga pagpapatakbo ng kalahok ay pinamamahalaan ng inyong lisensya. Gamitin ang sariling pahintulot ng may-ari ng karapatan
bilang isang SPDX id. Gamit ang `CC-BY-4.0`, maaaring mag-evaluate ang mga kalahok gamit ang anumang serbisyo ng modelo.
Gamit ang isang di-komersyal na lisensya tulad ng `CC-BY-NC-4.0`, tumatakbo lamang ang mga remote model
sa mga channel na walang pagsasanay (no-training channels). Gamit ang sarili ninyong mga tuntunin (`LicenseRef-<name>`), ang remote
na pagsusuri ay tatanggihan hanggang sa maitala ang pahintulot ng may-ari ng karapatan, kaya
gagamit ang mga kalahok ng mga lokal na modelo.

Isinasaad din ng mga inilabas na file ang iba pang mga tuntunin ng master, na binasa mula sa
sariling card ng master (ang corpus card na isinulat ng `champollion network register-corpus`,
sa pamamagitan ng `<file>.champollion.json` sidecar nito) at sarili nitong envelope:
`dataset.do_not_train` at, kapag ang master ay minarkahang local-only,
`dataset.transmission: "local-only"` (maaari lamang patakbuhin ng mga kalahok ang dev set
gamit ang isang modelo sa sarili nilang machine), kung saan tinutukoy ng `dataset.terms_from`
kung saan nagmula ang bawat isa. Kapag ang card ng master ay hindi nagsasaad ng tuntunin sa pagsasanay, ipasa
ang `--do-not-train true` o `false`; maaaring higpitan ng flag ang tuntunin ng master,
ngunit hindi kailanman luluwagan (tatanggihan ang `--do-not-train false` sa isang `doNotTrain: true` na master).
Ipiniprint ng prepare ang mga tuntuning ito, at nagbababala kapag sinasabi ng card ng master na
ipinagbabawal ang muling pamamahagi: ang pagpapalabas ng `public/` ay muling pamamahagi, kaya
huwag itong ilabas hangga't hindi sumasang-ayon ang may-ari ng karapatan.

| Split | Sino ang nakakakita | Para saan ito |
|-------|---------------------|---------------|
| **Pampublikong dev set** (`--dev-size`) | lahat — inilabas ang source *at* mga reference | ang **qualifier**: nagsasagawa ng self-score ang mga kalahok dito bago sila makapagsumite (Hakbang 8) |
| **Sealed set** (`--secret-size`) | wala maliban sa inyong node — nananatiling naka-encrypt ang source *at* mga reference | kung saan aktwal na iniiskor ang isang entry |
| **Sealed holdout** (`--sealed-holdout-size`, opsyonal) | wala maliban sa inyong node | isang **pangalawang** sealed split, na iniiskor sa parehong pagpapatakbo, kung saan pinipigil ang mga score nito hanggang sa isara ninyo ang paligsahan |
| *Blind set* (`--blind-size`, default 0) | inilabas ang source, pinigil ang mga reference | isang opsyonal na diagnostic round para sa inyo. **Hindi** ito daan para sa pagpasok: sinasalihan ang isang paligsahan sa pamamagitan ng pagbibigay ng pamamaraan, hindi kailanman sa pamamagitan ng pag-upload ng mga pagsasalin |

Ang mga split ay disjoint at reproducible: parehong corpus, parehong seed, parehong split,
magpakailanman. Nananatili ang recipe sa isang manifest na lokal sa organizer na hindi kailanman aalis
sa inyong machine.

**Nananatili sa iisang panig ang mga inulit na pangungusap.** Ang split ay group-disjoint
(`group-disjoint/1`, nakatala sa `split` block ng manifest): ang mga row na may magkaparehong
source o reference, nang eksakto o pagkatapos i-normalize ang case, bantas, at
espasyo, ay bumubuo ng isang grupo, at ang buong grupo ay napupunta sa iisang split. Kaya walang sealed
row na umuulit sa isang row ng inilabas na dev set. Ang mga grupo ay binabalasa gamit ang inyong
seed at inilalagay bilang dev, blind, secret, holdout sa ganoong pagkakasunod-sunod; ang isang master na walang
inulit na pangungusap ay nakakakuha ng eksaktong split na ibinibigay ng pagbalasa nang bawat-row. Kung hindi mapupuno
ng buong mga grupo ang mga laking hiniling ninyo, tatanggi ang prepare, kasama ang bilang
ng mga inulit na row at ang solusyon: alisin ang mga pag-uulit (panatilihin ang isang row ng bawat grupo),
o humiling ng kabuuang mas mababa sa laki ng master upang maiwan ang ilang grupo.

**Maaaring ilabas ang `public/`; ang mga log ng pagpapatakbo ay napupunta sa `runs/`.** Nagsusulat ang prepare ng isang marker
file, `.champollion-releasable.json`, sa loob ng `public/`. Ang mga run log, ulat, at
cache ng pagsasalin ay hindi kailanman isinusulat doon: tatanggihan ng `mt-eval run` ang isang
`--output-dir` o `--cache-dir` sa loob nito at tutukuyin ang `runs/` sa tabi nito
(`<out>/runs/`) sa halip, at inilalagay ng `run_benchmark` ng MCP server ang pagpapatakbo sa
inilabas na dev set (ang baseline na pinapatakbo ninyo upang itakda ang threshold) sa `runs/`
nang kusa at hayagang sinasabi ito. Ang isang paligsahang inihanda bago umiral ang marker ay
nakikilala sa pamamagitan ng layout nito (`public/` katabi ng `local/manifest.json`).

**Bakit may holdout.** Ang isang solong sealed set ay maaari pa ring i-tune laban dito sa mahabang
panahon ng paligsahan — ang bawat pagsusumite ay isang pagsisiyasat, at ang sapat na mga pagsisiyasat ay nagdudulot ng kaunting tagas. Ang pangalawang
split na iniiskor sa parehong awtorisadong pagpapatakbo ngunit walang sinumang nakakakita sa mga numero
nito hanggang sa pagsasara ay nagbibigay sa inyo ng malinaw na pagbasa sa huli: kung magbago ang ranggo ng isang sistema
sa pagitan ng dalawa, may matututuhan kayo tungkol sa kung gaano kalaki ang dahil sa pag-tune at gaano kalaki ang
dahil sa tunay na pagsasalin. Ang parehong set ay sakop ng **iisang** awtorisasyon, kaya hindi ito nangangailangan
ng dagdag na seremonya mula sa inyong mga custodian.

**Mga test suite ng ikatlong partido.** Tinutukoy ng `--test-suite` ang isang pampublikong diagnostic corpus —
pag-aari ng iba, sha-pinned at maaaring i-download ng publiko — kung saan pinapatakbo rin ang bawat
entry. Ang mga numerong iyon ay **iniuulat at hindi kailanman iniraranggo**: naroon ang mga ito upang
makita ng mambabasa kung ang mataas na score sa sealed-set ay nananatili ring mataas sa isang set na hindi
idinisenyo ng inyong paligsahan. Tatanggihan ng Champollion ang isang suite na naka-quarantine,
hindi naka-pin, hindi para sa inyong language pair, o isa sa sarili ninyong mga split.

**Ang isang sealed row na pampubliko na ay hindi selyado.** Inihahambing ng `contest prepare`
ang inyong sealed set at sealed holdout sa lahat ng bagay na pampubliko: ang dev
set na inilalabas nito (pinapanatili ito ng group-disjoint split sa itaas sa zero), ang
inilabas na blind source kung mayroon man, at ang bawat idineklarang test suite. Tumutugma ito
nang eksakto at pagkatapos i-normalize ang case, bantas, at espasyo (ang parehong
paghahambing na pinaggugrupo ng split), pagkatapos ay ipiniprint ang bawat overlap kasama ang bilang (halimbawa
"30 sa 30 row ay lumalabas din sa test suite …") at itinatala ang mga bilang
sa `local/manifest.json`. Para sa suite ng ikatlong partido, nagbibigay ito ng babala sa halip na
tumanggi: ang suite ay pampublikong teksto ng ibang tao, at kayo ang magpapasya kung aalisin
ang mga row na iyon mula sa master o tatanggalin ang suite, at maghahanda muli. Upang suriin ang isang suite, kailangan ng prepare ang mga
pangungusap nito. Gumagamit ito ng kopyang nasa inyong machine na, at hindi kailanman nagda-download
habang naghahanda. Tukuyin ang inyong kopya gamit ang `--test-suite <id>=<path>`; dapat tumugma
ang sha256 nito sa pin ng registry. Kung walang kopyang makita, sasabihin ng babala
na ang suite ay **hindi nasuri**, hindi na ito ay malinis. Itinatala ng manifest
ang path ng bawat kopyang binasa ng prepare, upang maituro ito ng `node init --from-contest`
sa inyong node.

Ang inyong idineklarang holdout at mga suite ay magiging mga pangako: sa sandaling dumating ang unang entry,
ifi-freeze ng paligsahan ang mga ito, kaya hindi kayo makakapagdagdag o makakapagbawas ng test suite sa gitna ng paligsahan.

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

Nananatili ang manifest sa inyong machine — ang pagpaparehistro ay nagpapadala lamang ng mga id,
digest, at threshold na walang nilalaman. Mababasa ninyo nang eksakto kung ano ang ipinapadala nito bago
may maipadala: ipiniprint ng `contest prepare --no-register` ang plano sa pagpaparehistro,
ang bawat row na isusulat ng `contest register`, ayon sa pagkakasunod-sunod — ang id ng bawat sealed set at
ang SHA-256 ng ciphertext nito (kasama ang dami ng mga row na nananatiling selyado sa inyong machine),
ang custodian group, ang qualifier id at threshold, ang row ng paligsahan kasama ang mga
naitalang pangako nito, ang mga column ng patakaran, at anumang holdout, mga test suite, at mga tuntunin sa premyo
na pinagsama sa metadata ng paligsahan. Ang plano ay binuo ng parehong code
na nagpapadala ng mga row, kaya hindi nito mailalarawan ang isang bagay na iba sa ipinadala.
Ang bawat row sa registry ay **nakatali sa pagkakakilanlan**: itinatala ng
database ang naka-sign in na account na nagrehistro nito at ifi-freeze ang
ugnayang iyon laban sa mga susunod na pag-edit, at maaari lamang i-gate ng isang qualifier ang isang sealed set na
inirehistro ng **parehong** pagkakakilanlan. Ang mga sealed set ay nililikhang naka-quarantine (hindi kailanman
magagamit sa isang karaniwang paligsahan o mairaranggo sa pampublikong leaderboard), ang mga qualifier ay
nililikha sa isang ligtas na estado, at ang pagpaparehistro ay may rate limit — lahat ay ipinapatupad ng
mga database trigger sa ilalim ng bawat client, kabilang ang sa amin. Ang registry mismo ay
hayagang mababasa ng publiko, kaya mapapatunayan ninyong sinasabi ng inyong entry ang eksaktong selyado ninyo —
at wala nang iba pa.

**Mga tapat na limitasyon.** Ang pintong self-serve ay para sa pagpaparehistro lamang (insert-only sa
antas ng database). **Ang pagpapalit ng qualifier at pagreretiro ng sealed-set ay nananatiling
pinapamagitan ng curator** — magbukas ng issue o makipag-ugnayan sa proyekto sa pamamagitan ng
[GitHub](https://github.com/gamedaysuits/Champollion/issues). At ang pagpapatakbo ng organizer scoring
node sa mga susunod na hakbang (pagsulong sa lifecycle, pagkakaloob ng awtorisasyon, mga operasyon
sa pag-audit) ay isang hiwalay na lane na may service-credential sa inyong sariling node —
humihinto ang self-serve sa pampublikong talaan.

## Step 5 — Pumili ng custodians at ng M-of-N rule

Piliin ang mga tao o institusyong dapat magkasamang mag-apruba sa bawat evaluation
laban sa inyong corpus, at ang threshold (hal. **3 of 5**). Dapat maging
accountable ang custodians sa inyong komunidad, hindi sa Champollion — tingnan ang
[Data Stewardship](/docs/network/sovereignty/data-sovereignty) at
[Ownership & Terms](/docs/network/sovereignty/ownership-transfer) para sa kung paano
itinatakda ang per-community terms.

**Kahon ng katapatan:** ang threshold *signing* (isang pagkakaloob na talagang hindi maaaring magawa
nang walang M na lagda) ay **kasalukuyang ginagawa**. Ang seremonya ng key ng offline node
(`mt-eval node ceremony`, Shamir M-of-N) ay binuo na ngunit hindi pa nagagamit
sa isang tunay na custodian. Kung hindi man, ang panuntunang M-ng-N ay ipinapatupad bilang isang nakatalang
proseso: ang bawat kahilingan sa pag-access
ay pumapasok sa isang **pending** na pila, itinatala ang mga desisyon ng custodian, ang pagkakaloob ay ginagawa
lamang para sa isang awtorisadong kahilingan, ang bawat pagkakaloob ay **minsanan lang gagamitin, may takdang oras, at
nakatali sa isang tiyak na fingerprint ng (paraan, bersyon ng corpus, evaluation node)**,
at ang bawat kaganapan — kabilang ang mga hinarang na pagtatangka — ay napupunta sa isang **append-only,
hash-chained, pampublikong nababasang audit log**. Tinatanggihan ng database ang mga ilegal na pagbabago sa estado
sa ilalim ng bawat client at key. Ang hindi pa nito kayang tanggihan ay ang pagkompromiso sa mismong platform operator —
iyon ang sinasara ng threshold signing, at hanggang sa mailabas ito, dapat ninyong ituring ang "Champollion holds zero key shares"
bilang layunin sa disenyo na kasalukuyang binubuo, hindi isang katangiang mapapatunayan ninyo ngayon.

## Hakbang 6 — Itakda ang premyo, at ideklara ang mga tuntunin nito

Opsyonal ang premyo. **Ang isang paligsahang walang idineklarang mga tuntunin sa premyo ay sadyang walang
premyo** — iyon ang default, at hindi ito nangangahulugang mas mababang uri ng paligsahan.

Kung mag-aalok kayo ng isa, magpasya at i-publish kasabay ng paligsahan:

- **Halaga at pera.**
- **Sponsor** — sino ang nagbibigay ng pondo.
- **Kung saan nakalagak ang pondo** — account ng inyong organisasyon, o isang community trust
  na inyong itatalaga. **Hindi kailanman humahawak, nag-e-escrow, o nagpapadaloy ng mga pondo para sa premyo ang Champollion.**
  Ang paglalathala sa pagkakakilanlan ng may-hawak sa simula pa lamang ang nagbibigay ng kredibilidad sa premyo;
  tingnan ang [tala sa panganib ng sponsor-default](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  sa mga template ng tuntunin.
- **Mga kondisyon sa threshold** — ang antas ng score na dapat malampasan ng isang pamamaraan, na isinulat
  alinsunod sa [Pagtukoy sa Premyo](/docs/network/specifications/prizes): isang chrF++
  threshold, anumang diagnostic gate na nais ninyo (tulad ng minimum na FST acceptance —
  isang gate na dapat maipasa ng entry, hindi kailanman ang score), mga kinakailangan sa pagpapatunay ng tagapagsalita (speaker-validation),
  reproducibility. Gawing mapapatunayan mula sa mga inilathalang score ang mga kondisyon sa paggawad,
  upang walang sinumang kailangang umasa sa inyong salita (o sa amin) kung nalampasan ba ang antas.
- **Ang mga tuntunin sa premyo** — kung ano ang mangyayari sa mismong entry.

### Kayo ang pipili ng tuntunin sa premyo

Nakatakda na ang pagpapatupad: sa isang sovereign contest, ibinibigay ng kalahok sa inyo ang isang modelo o isang
pamamaraan at pinapatakbo ito ng inyong node. Ang mangyayari dito *pagkatapos* noon ay inyong pagpapasya,
at ito ay isa sa tatlo:

| Ang tuntunin | Ano ang sinasabi ninyo sa mga kalahok |
|---|---|
| `pass_to_holders` — *ipasa sa mga may-hawak* | Ang pamamaraan ay mapupunta sa inyo, ang mga may-hawak ng sovereign benchmark. Iniiskor ninyo ito at itinatago, sino man ang manalo. |
| `retain_ip` — *panatilihin ang IP* | Ang kalahok ang nagpapanatili ng pagmamay-ari. Iniiskor ninyo ang entry at nagtatago lamang ng selyadong kopya para sa pag-audit kung kinakailangan. |
| `release_open` — *ilabas bilang open* | Ang kalahok ang nagpapanatili ng pagmamay-ari ngunit dapat ilathala ang pamamaraan sa ilalim ng isang bukas na lisensya. Ang paglalabas na iyon ang kondisyon sa premyo. |

Ang detalye ay sumusunod mula sa tuntunin, kaya walang matrix na kailangang punan: kung ano ang
itatago ninyo (`retention`), kung may mga karapatang ililipat (`rights`), kung saan ninyo ito magagamit
(`host_use`) at kung dapat maglathala ang kalahok (`release`) ay pawang
**hinango** mula sa opsyong inyong pinili. Dalawa sa mga opsyon ang nagpapahintulot sa inyong paliitin ang isang
field:

- sa ilalim ng `retain_ip`, sinisira ng `--prize-retention delete_after_scoring` ang artifact kapag naiskoran na ito (ang default ay nagpapanatili ng selyadong kopya para sa pag-audit);
- sa ilalim ng `release_open`, inililipat ng `--prize-release-timing` ang paglalabas sa `required_before_scores` o `required_after_prize` (ang default ay `required_before_prize`), at tinutukoy ng `--prize-release-license` ang lisensya sa halip na tanggapin ang alinmang lisensyang inaprubahan ng OSI (`any_osi`).

Ang buong hinangong talahanayan, at kung paano pinapatunayan ang bawat opsyon bago ang pagbabayad, ay nasa
[Pagtukoy sa Premyo §2.1, kondisyon 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three).

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

Alinman ang inyong piliin, ang tuntunin ay ipiniprint pabalik sa inyo sa payak na wika na may
**SHA-256** bago may maisulat. Ang hash na iyon ang token ng pagtanggap:
nagpapasa ang isang kalahok ng `--accept-terms <hash>`, ang pagtanggap ay isinasama sa kanilang
bundle at sakop ng hash ng nilalaman nito, at tatanggihan ng inyong node ang isang bundle na
tumanggap ng anupamang iba. Nafi-freeze ang tuntunin sa sandaling magkaroon ng unang entry ang inyong
paligsahan, kaya walang sinumang mapipilitan sa mga tuntuning hindi nila nabasa.

Sadyang *hindi* bahagi ng tuntunin ang pera: ang halaga, ang pera, at ang
sponsor ay impormasyon ng paligsahan, at ang isang tuntunin tungkol sa kung sino ang nagmamay-ari ng isang pamamaraan ay
ibang uri ng pahayag mula sa isang tuntunin tungkol sa kung magkano ang binabayaran.

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
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

Dalawa sa mga flag na iyon ay nakapirmi o naka-freeze ng database anuman ang inyong gawin
pagkatapos, at tatlo pa ang mga **pangako**:

- Ang `--use-context` ay bahagi ng pagkakakilanlan ng paligsahan: nakapirmi ito sa sandaling
  mairehistro ang paligsahan at hindi na mababago (sa halip ay gumawa ng bagong paligsahan).
  Ang default ay `non-commercial`.
- Ang `--primary-metric` (default `chrf_plus_plus`), ang sukatang ginagamit sa pagraranggo,
  ay nafi-freeze kapag mayroon nang unang entry ang paligsahan. Ang isang bagong paligsahan na magtutukoy sa
  iniretirong `composite` ay tatanggihan kasama ang dahilan; ang mga paligsahang narehistro bago ang
  [pamantayan sa pag-iskor](/docs/network/specifications/scoring#how-runs-are-scored)
  ay patuloy na gagana.
- Ang `--visibility` (default `public`), `--description` at kung bukas
  ang intake ay hindi naka-freeze.

Ang tatlong pangako ay nafi-freeze sa sandaling magkaroon ng unang entry ang inyong paligsahan:

- `--prize-disposition` / `--prize-terms` — ang tuntunin mula sa Hakbang 6. Tanggalin ang pareho at
  ang paligsahan ay walang premyo.
- `--results-visibility hidden_until_close` — ang bawat score na sinusukat ng inyong node
  ay **pinipigil** hanggang sa isara ninyo ang paligsahan, upang walang sinumang makapag-tune laban sa
  sealed set mula sa sarili nilang mga resulta. Ito ang default; isinasaad ito ng halimbawa
  upang makita ang pangako sa sarili ninyong mga tala. Ipasa ang
  `--results-visibility immediate` kung nais ninyo ng live board sa halip, kung saan ang bawat
  card ay nai-publish habang natatapos ito ng inyong node.
- `--anonymize-until-close` — lilitaw ang mga kalahok sa ilalim ng matatag na mga pseudonym sa inyong
  pagraranggo habang bukas ang paligsahan. (Ito ang inyong view sa pagraranggo; hindi nito
  ina-anonymise ang isang card kapag nai-publish na ito sa bukas na board.)

Ang parehong tatlong flag ay magagamit sa `contest prepare` at `contest register`,
kung saan itatakda ito ng karamihan sa mga organizer, dahil ang mga pintong iyon ang lumilikha ng
paligsahan para sa inyo. Gamit ang `contest prepare --no-register`, ang mga flag sa pagpaparehistro
na inyong ipinasa (`--results-visibility`, `--anonymize-until-close`,
`--primary-metric`, ang mga flag sa premyo, `--visibility`, `--use-context`,
`--closed-intake`) ay itinatala sa `local/manifest.json`, at
inilalapat ng `contest register --manifest` ang mga ito maliban kung magpasa kayo ng sarili nitong mga flag,
kung saan sasabihin nito kapag may pumalit sa isang naitalang value. Ipiniprint ng Prepare ang bawat isa sa
mga tuntuning ito kasama ang value nito, ibinigay man ninyo ito o ito ang default, at
kung kailan ito hihintong mabago, bago magrehistro ng anuman. Tinutukoy ng
`--help` nito ang bawat default.

*(Ang `--corpus` value ay ang inyong registered `sealed_set_id`. Ang sealed lane ay
pinipili **awtomatiko** mula sa sealed-set registration — walang karagdagang flag; ang isang
sealed set ay hindi kailanman maaaring sumuporta sa ordinary contest, at ang isang ordinary quarantined
dataset ay hindi kailanman maaaring sumuporta sa anumang contest. Parehong rule ay ipinapatupad sa database,
sa ilalim ng bawat client. Kung nagrehistro kayo sa Step 4 gamit ang `contest register` o
`prepare --self-serve`, ang contest row ay **umiiral na** — laktawan ang step na ito;
ang `contest create` nang mano-mano ay para lamang sa pag-assemble ng contest mula sa isang
already-registered sealed set.)*

## Step 8 — Mag-qualify muna ang methods sa publiko

Binubuo at iniiskoran ng mga developer ang kanilang mga pamamaraan sa **pampublikong dev set** na inyong inilabas
sa Hakbang 1. Tinutukoy ng `current_qualifier_id` ng inyong sealed set ang round na iyon, at dapat
malampasan ng isang pamamaraan ang threshold nito bago pa man mahiling ang isang sealed run. Pinapanatili
nito ang inyong corpus na ligtas sa pagsisiyasat: walang sinumang makakatutok sa sealed set
hangga't hindi sila nagpapakita ng tunay na kakayahan sa bukas na set.

Ang isang kalahok ay nagpapatakbo nito nang mag-isa, offline, sa isang command:

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

Ang qualifier id at ang threshold ang dalawang bagay na kailangan ng scoring mula
sa inyo, kaya ilathala ang pareho kasabay ng paglabas ng dev. Para sa isang paligsahang ginawa gamit ang `contest
prepare`, ang qualifier id ay ang mismong id ng dev corpus (ang
`dataset.corpus_id` nito), at isinusulat ng prepare ang threshold sa paglalarawan ng dev corpus.
Kung wala ang dalawang `--offline-…` flag, binabasa ng qualify ang mga ito mula sa
database ng paligsahan sa halip. Gagana lamang iyon kapag nakarehistro na ang paligsahan sa
endpoint kung saan nakaturo ang kalahok. Kapag wala ito roon, o hindi maabot ang database,
hihinto ang qualify at ipi-print ang offline na command sa itaas, na napunan
gamit ang sariling mga argumento ng kalahok.

Tinatanggap ng `--dev` ang mga pagsasalin ng kalahok sa dev set nang isa bawat linya sa
pagkakasunod-sunod ng corpus, bilang JSON na may key ng entry id, o bilang run log na nalikha ng `mt-eval run
--corpus <the dev corpus>` wrote (or its `_report.json`). Ang isang run log ay binabasa ayon sa
entry id at sinusuri kung ito ay isang pagpapatakbo sa parehong dev corpus na iyon; ang may mga nagka-error na
entry ay tatanggihan, dahil ang bawat entry ay iniiskor. Sasabihin pagkatapos ng buod na ang mga
output ay ginawa ng harness sa pagpapatakbong iyon at muling iniskoran mula sa file nito
(kasama ang gastos ng pagpapatakbong iyon), hindi kailanman na ang mga ito ay ginawa sa labas ng harness; tanging
ang isang payak na hypotheses file ang inilalarawan sa ganoong paraan.

**Ang pagpasa ay hindi pa isang pagsusumite.** Pagkatapos ng hatol, sinasabi ng qualify kung ano
ang masasabi na nito tungkol sa pagsusumite. Para sa isang pagpapatakbo ng method plugin na ang folder
ay nasa machine, pinapatakbo nito ang parehong static scan na pinapatakbo ng `submit-method` at ng inyong node
(mga network library, mga shell network tool, mga ipinagbabawal na filesystem path) at
ipinapakita ang anumang tatanggihan, tulad ng isang plugin na nag-i-import ng `urllib`
upang tumawag sa isang server ng modelo. Para sa isang pagpapatakbo ng sariling LLM path ng harness (isang modelong
inaabot sa pamamagitan ng provider), sinasabi nitong walang pamamaraang maisusumite sa kasalukuyang anyo:
pinapatakbo ng node ang isang entry nang walang network, kaya kailangang nasa loob nito ang modelo
(tingnan ang *Isama ang bawat modelong tinatawag ng inyong pamamaraan* sa ibaba). Kung hindi man, tinutukoy ng linya ng pagpasa
ang mga pagsusuring haharapin pa sa oras ng pagsusumite. Wala sa mga ito ang nagbabago sa
hatol o sa resibo.

Ipiniprint nito ang qualifier score (ang humaharang) at ang threshold nang magkatabi,
parehong nasa 0–100 chrF++ qualifier scale, pagkatapos ay kung ano ang score: corpus
chrF++ kasama ang sacreBLEU signature nito, ang iba pang karaniwang sukatan sa tabi nito
(hindi kailanman inihahalo), exact match bilang diagnostic na hindi kailanman humaharang, at anumang
paalala sa score. Walang inilalathala ang Qualify. Ang isang sistemang ang mga dev
output ay halos puro kopya lamang ng source text nito ay tatanggihan anuman ang maging score nito:
kapag kalahati o higit pa sa mga ito ay ang source (hindi pinapansin ang case, accent, at bantas,
at hindi isinasama ang mga linyang ang reference ay ang mismong source, tulad ng mga
pangalan), hindi nagsasalin ang kalahok. Tatanggihan din ito ng parehong panuntunan kapag
muli itong pinatakbo ng inyong node. Nagsusulat iyon ng isang **resibo ng qualifier** sa kanilang
machine, kung saan tatangging bumuo ng pagsusumite ang `submit-model` at `submit-method`
kung wala ito. Ang mga resibo ay iniingatan bawat paligsahan at bawat sistema (`--system`),
kaya ang isang kalahok na nag-qualify ng dalawang sistema ay nagpapanatili ng pareho; ang muling pag-qualify sa parehong
sistema ay nagpapanatili sa naunang resibo sa tabi nito. Ginagamit ng `submit-method` at
`submit-model` ang resibo para sa `--system` (default: ang para sa `--name`,
kung hindi ay ang nag-iisang resibo ng paligsahan) at tatanggi, kalakip ang listahan, kapag ito ay
hindi tiyak. Ang resibo ay
self-reported ayon sa pagkakalikha nito — kaya hindi ito ang humaharang. Bago may ma-claim na anumang pagkakaloob,
**muling pinapatakbo ng inyong node ang isinumiteng pamamaraan sa parehong dev set** at
inihahambing ang sarili nitong sukat sa ipinahayag; ang isang resibong nagpapalabis sa pamamaraan
ay itatanggi roon, na may claimed-vs-measured sa pagtanggi.

**Tinutukoy ng isang resibo ang pagpapatakbo kung saan ito nanggaling.** Kapag ang `--dev` ay isang run log (o ang
`_report.json` nito), itinatala ng resibo ang pagpapatakbo at ang modelong pinatakbo nito: para sa
`mt-eval run --method local-model -m <model>`, ang Hugging Face id at
rebisyon, o ang directory ng modelo na may SHA-256 sa mga file nito. Ang isang
`local-model` run log na walang tinutukoy na modelo ay tatanggihan — ang mga naunang 0.2.0 build
ay hindi nagpasa ng `-m` sa engine na iyon, na nagpatakbo naman ng fallback na modelong English→Spanish
sa halip. Susuriin pagkatapos ng `submit-model` na ang mga weight na isinasama nito ay
kabilang sa mga file na tinutukoy ng resibo, at tatanggi, na tutukuyin ang parehong hash, kapag
hindi tugma. Ang isang resibong iniskoran mula sa isang payak na hypotheses file ay walang tinutukoy na modelo; ang
muling pagpapatakbo ng node ang magsisilbing pagsusuri para dito.

**Minamarkahan ang agwat sa pagitan ng resibo at ng node.** Parehong kinakalkula
ang dalawang numero sa parehong paraan — parehong scorer, parehong dev set, at para sa isang modelo
ay parehong panuntunan sa decode-length — kaya ang parehong mga weight ay magkakaroon lamang ng bahagyang
pagkakaiba na mas mababa sa isang puntos. Kapag ang numero ng node at ang resibo ay nagkaiba nang higit sa **2.0
puntos** sa 0–100 qualifier scale, sasabihin ito ng node pagkatapos ng
muling pagpapatakbo; itatala rin ng isang air-gapped node ang agwat kasama ang pagsusuri nito sa
lokal nitong ledger at ipiprint itong muli para sa custodian sa `node approve
--offline`. Isa itong watawat (flag), hindi pagtanggi:
ang sariling numero ng node ang siyang humaharang. (Ang 2.0 na hangganan ay isang sadyang
konserbatibong pagpili na mabilis magbabala; isa itong value ng patakaran na maaaring
naisipang suriin muli ng isang organizer.)

### Maaaring mag-ensayo ang mga kalahok sa lahat ng bagay bago sila magsumite

Walang sinumang dapat makaalam na mali ang ayos ng kanilang bundle mula sa isang pagtanggi makalipas ang
ilang araw. Pinapatakbo ng `mt-eval contest validate`, sa machine ng kalahok at nang walang
network, ang eksaktong unang pinapatakbo ng inyong node:

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

Ipiniprint nito ang talahanayan ng mga natuklasan at nag-e-exit nang non-zero kung may anumang tatanggihan
(`--json` para sa tooling). Ituro ang mga kalahok dito sa inyong panawagan sa paglahok:
isang command lang ang kailangan nila at ililigtas kayo nito sa mga pagtanggi.

Walang isinusulat ang `validate`. Muli nitong iniiskoran ang dev output nang hindi nagsusulat ng
resibo, pagkatapos ay sinusuri ang isang resibo:

- **Isang naka-pack na bundle** (ang `.tar.gz` na isinulat ng isang submit command) ay nagdadala ng
  resibong ipinang-package dito, at ang kopyang iyon ang binabasa ng inyong node. Kaya
  sinusuri ng validate ang ensayo laban sa kopyang iyon. Hinahanap din nito ang resibo
  sa machine ng kalahok kung saan nanggaling ang kopya at tinutukoy ang sistema nito, anuman
  ang itawag sa pamamaraan ng bundle. Nagbabala ito kapag may tinukoy na ibang
  resibo ang `--system`, at kapag muling nag-qualify ang kalahok sa sistemang iyon mula noong
  pag-package (dala pa rin ng bundle ang mas lumang resibo). Kung walang mga
  flag ng `--offline-…`, ang qualifier id at threshold ay magmumula rin sa kopyang
  iyon, na nangangahulugang ang mga ito ang mga value na ibinigay ng kalahok sa `contest qualify`.
  Sinasabi ito ng natuklasan.
- **Isang source directory** na ipinang-pack para sa pagsusuri gamit ang `--manifest`: gagamitin
  ng validate ang resibong ie-embed ng `submit-method` at `submit-model`, na nahanap
  sa paraan ng paghahanap ng mga ito: `--system`, kung hindi ay ang resibong may pangalang tulad ng
  pamamaraan ng bundle, kung hindi ay ang nag-iisang resibo ng paligsahan.

Nagbabala ito kapag sumasaklaw ang resibong iyon sa ibang dev output, ibang dev file o
ibang qualifier. Nagbabala rin ito kapag walang resibo. Ang mga resibo ay nagmumula sa
`contest qualify` lamang.

Isa itong ensayo, at malinaw nitong sinasabi ito. Bubuo pa rin ang inyong node ng image nang walang
network, patatakbuhin ang container, at muling patatakbuhin ang qualifier mismo. Ang isang malinis na validate
ay nangangahulugan lamang na walang *kasalukuyang nalalamang* mali — hindi na tiyak na magkakaroon ng score ang pagpapatakbo.

:::note[Mga Kalahok: sa aling endpoint nakalagak ang inyong paligsahan?]
Ang isang **network-hosted** na paligsahan ay hindi nangangailangan ng setup ng endpoint — ang default na endpoint na
kasama ng harness ang nagdadala ng makinarya ng paligsahan (ang qualifier gate, mga panukala sa pamamaraan, awtorisasyon), at
direktang nakikipag-ugnayan dito ang `mt-eval contest submit-model` /
`submit-method`. Kailangan ninyo ng harness na **0.2.0 o mas bago**
(`mt-eval --version`); ang mga naunang release ay walang `qualify`, `validate`, `rank` at
`close`. Nagbubukas lamang ang mga network-hosted na paligsahan kapag ang organizer ay nakarehistro
sa pamamagitan ng pintong inilarawan sa paalala sa itaas, kaya karamihan sa mga paligsahan ngayon ay
**federated**.

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

## Hakbang 9 — Mga sealed run: kahilingan, awtorisasyon, pagpapatupad, paglabas ng score

Para sa bawat entry:

1. Isang **kahilingan** ang isinusumite laban sa inyong sealed set — pumapasok ito sa `pending` at
   nagdadala ng hindi nababagong fingerprint ng (bundle hash, corpus id, bersyon ng corpus,
   `scores-only`, sukat ng evaluation-node).
2. Nagpapatakbo ang inyong node ng **sarili nitong mga static check** sa bundle. Para sa isang code entry
   (Lane B) sinusuri nito pagkatapos kung mapapatakbo ba ito: may container runtime
   na naroroon, at ang RAM, scratch disk at runtime na idineklara ng bundle ay pasok
   sa inyong mga limitasyon sa `sandbox`. Ang hindi pagtugma doon ay hindi hatol sa pamamaraan.
   Tinutukoy ng pagtanggi ang bawat hindi pagtutugma ("8 GB RAM requested, this node allows 4 GB
   (sandbox.max_ram_gb)"), walang pinapatakbo o tinatanggihan, at ang kahilingan ay mananatili
   sa dating kalagayan. Maaari ninyong itaas ang limitasyon sa `node.json` at muling patakbuhin
   ang `mt-eval node run-method <id>` nang hindi na muling nagpapasumite. O maaaring mag-repackage
   ang kalahok gamit ang mga flag na ipiniprint ng pagtanggi (halimbawa `--ram-gb 4`);
   ang mga kinakailangan ay nasa loob ng hash ng bundle, kaya isa itong bagong kahilingan.
   Pagkatapos ay **muling pinapatakbo ng node ang qualifier claim ng kalahok** sa sarili nitong
   kopya ng pampublikong dev set. Isang pahayag lamang ang kanilang resibo; ito ang
   aktwal na pagsukat. Ang hindi pagtugma ay
   tinatanggihan dito — bago pa hilingin sa sinumang custodian na mag-apruba ng anuman, at bago
   buksan ang sealed set — at sinasabi ng pagtanggi kung ano ang ipinahayag, ano ang
   nasukat, at ano ang naging pamantayan. Ang isang bundle na tumanggap ng mga tuntunin sa premyo
   maliban sa mga idineklara ng inyong paligsahan ay tatanggihan sa parehong punto.
3. Magpapasya ang inyong **mga custodian** (M-ng-N). Ang pag-apruba ay lilikha ng isang **pagkakaloob**:
   minsanang gamit, nag-e-expire, valid lamang para sa eksaktong fingerprint na iyon.
4. Tumatakbo ang pagsusuri sa network-isolated sandbox sa **inyong** node
   (`mt-eval node run-method`): isang container na walang network stack, kung saan ang mga reference
   ay hawak sa labas nito — o, para sa pinakamataas na paghihiwalay, sa isang tunay na airgap machine kung saan
   ang mga nilagdaang scores-only bundle ay inililipat gamit ang removable media (tingnan ang kahon ng katayuan
   sa itaas para sa kung ano ang sakop at hindi sakop). Ang isang dark node ay walang ina-upload:
   dadalhin ninyo palabas ang nilagdaang score bundle nito at ipa-publish ang run card mula sa isang konektadong
   machine (`mt-eval node relay`). Ang inyong sealed holdout at anumang idineklarang
   mga test suite ng ikatlong partido ay tumatakbo sa loob ng **parehong** awtorisadong pagpapatakbo, kaya hindi ito nagdudulot
   ng dagdag na seremonya para sa inyong mga custodian.
5. **Mga score lamang ang lumalabas.** Ang panuntunan sa paglalabas ng `scores-only` ay nakapako sa
   antas ng database; ang bawat-entry na teksto mula sa inyong corpus ay hindi kailanman inilalathala.
6. Kung nangako ang inyong paligsahan ng `hidden_until_close`, hindi pa nai-publish
   ang score: ito ay **pinipigil** bilang isang ipinagpalibang resulta na kayo lamang ang makakakita, at
   inilalathala ng `contest close` ang bawat pinigil na card bago nito i-freeze ang
   pagraranggo. Ang isang pinigil na resulta ay hindi kailanman nawawalang resulta.
7. Bawat hakbang — kahilingan, mga boto, pagkakaloob, paggamit, at anumang hinarang na pagtatangka — ay
   idinaragdag sa pampubliko, hash-chained na audit log na maaari ninyong (at ng sinuman) patakbuhin muli.

## Pagpapasumite ng pamamaraan (para sa mga kalahok) — dalawang lane

Karamihan sa mga NMT entry ay hindi kakaiba: isang karaniwang fine-tuned transformer at ang
mga weight nito. Para sa mga iyon, mayroong **mas mainam, code-free na lane** — at isang sandbox
fallback para sa mga pamamaraang tunay na code.

### Lane A — deklaratibong modelo (mas mainam para sa karaniwang NMT)

Kung ang inyong pamamaraan ay isang karaniwang neural model, isusumite ninyo ito bilang **data** — ang
mga weight, tokenizer, at config — at patatakbuhin ito ng organizer sa sarili nilang pinagkakatiwalaang
inference engine. **Walang Dockerfile, walang code, walang sandbox.** Dahil walang tumatakbo sa inyong
isinusumite, ang safety check ng organizer ay isang decidable na pagpapatunay ng format sa halip
na subukang patunayan na ligtas ang di-tiyak na code — isang mas matibay na
garantiya para sa inyo at para sa corpus.

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**Isang modelong sinanay gamit ang NMT Forge.** Isinusulat ng `nmt-forge export` ang
deployable na folder na `export/model/`. Bukod sa mga weight, config at tokenizer
naglalaman ito ng `forge-model.json` (mga score ng modelong iyon sa inyong pribadong test set,
at mga lokal na path), `DEPLOY.md` at `champollion-plugin/`, na wala sa mga ito ang
bahagi ng isang entry. Ipinapakete lamang ng `submit-model` ang mga file na binabasa ng transformers
(mga weight, `config.json`, `generation_config.json`, ang mga file ng tokenizer) at
ipiniprint ang lahat ng iniwan nito, kaya nananatiling hiwalay ang tatlong iyon.
Itinatala sa Seksyon 6 ng `DEPLOY.md` na iyon ang mga file na bumubuo sa entry, ang
arkitektura mula sa `config.json`, at ang bilang ng parameter na binasa mula sa
header ng weights file, kalakip ang eksaktong command. Upang ipadala ang eksaktong mga file na
inyong nasuri, kopyahin ang mga ito sa sarili nilang folder at ipasa ito bilang
`--model-dir`:

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**Aling bilang ng parameter.** Sinusuri ng Lane A ang `--parameter-count` laban sa
weights file. Pinagsasama-sama nito ang mga laki ng tensor sa header ng `safetensors` at
tinatanggihan ang pahayag na lumihis nang higit sa 1%. Iyon ang iniimbak ng file, at maaari
itong maiba sa bilang na nakuha sa torch. Ang isang nakatali (tied) o ibinahaging weight ay iniimbak nang isang beses. Ang isang
talahanayan na muling binubuo ng modelo kapag naglo-load ito, tulad ng sinusoidal positions, ay maaaring
hindi mai-save. Ipiniprint ng pagtanggi ang bilang ng file; ideklara ang numerong iyon.

Ang mga panuntunang dapat tugunan ng inyong bundle (napatunayan nang lokal bago i-upload, at muli
ng node ng organizer):

- **Ang mga weight ay `safetensors`, hindi kailanman pickle.** Ang PyTorch `.bin`/`.pt`/`.ckpt`
  ay isang pickle — arbitrary code kapag na-load — at tatanggihan. Mag-export sa
  `model.safetensors` (katutubong ginagawa ito ng `safetensors` / `transformers`).
- **Isang arkitekturang native na nailo-load ng engine ng organizer.** Ang `architectures` ng `config.json`
  ay maaaring maging anumang arkitekturang ipinapatupad ng `transformers` ng host
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, at marami pang iba) — ang mga host ay
  **permissive ayon sa default**, dahil sa `trust_remote_code=False` ang kaligtasan
  ay nagmumula sa format na walang code, hindi sa pangalan ng arkitektura (ang isang hindi sinusuportahang
  arkitektura ay hindi lamang maglo-load, at walang tatakbo). Ang isang maingat na host ay maaaring
  maglathala ng allowlist. Bawal ang `auto_map`, bawal ang `trust_remote_code` — palihim na nagpapasok ang mga iyon
  ng custom code at palaging tatanggihan.
- **Isang deklaratibong tokenizer** (`tokenizer.json` o isang `sentencepiece` `.model` +
  vocab), at **mga data file lamang** — walang `.py`/script/binary sa bundle.

**Ano ang ipinapakete ng `submit-model`.** Ang mga data file sa root ng `--model-dir`
(`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`): ang
mga weight, config, tokenizer at generation config. Ang lahat ng iba pa — isang
`README.md` o `DEPLOY.md`, isang subfolder, isang pickle checkpoint sa tabi ng
safetensors — ay hindi isinasama, at itinatala ng command kung ano ang iniwan nito. Kaya ang
`model/` folder na isinusulat ng `nmt-forge export` ay naipapasa nang ganoon mismo: ang `DEPLOY.md`
at `champollion-plugin/` nito ay naiiwan. Nagpapakete ang `contest validate` sa parehong paraan
at iniuulat ang mga naiwang file bilang isang INFO finding. Ang pagsusuri ng inyong node ay
hindi nagbabago: ang isang bundle na may dalang non-data file ay tatanggihan pa rin doon.

**Gaano kahaba maaaring maging ang mga output.** Palaging nagde-decode ang inyong node gamit ang hayagang haba:
ang `max_new_tokens` o `max_length` na idineklara ng modelo (ang
`generation_config.json` nito), o hanggang sa `max(64, 4 × source tokens)` na bagong token
bawat pangungusap, na nakatakda sa mga posisyon ng decoder. Ang `mt-eval run --method
local-model` ay nagde-decode gamit ang parehong panuntunan, kaya nagkakatugma ang resibo ng kalahok at ang
muling pagpapatakbo ng inyong node. Ipiniprint ng `submit-model` ang haba na ilalapat
at isinusulat ito sa manifest (`model.decodeLength`); itinatala ng node ang
haba na inilapat nito sa execution facts ng pagpapatakbo (`execution.generation`).
Kung walang hayagang haba, hihinto ang transformers library sa humigit-kumulang 20
token, at ang bawat entry ay maiiskoran sa naputol na output.

Pinapatakbo ito ng organizer gamit ang `trust_remote_code=False`, offline, at tanging mga score
ang lumalabas — nai-publish bilang `declarative-model`, ang pagkakakilanlan ng pamamaraan ay **likas na walang code**.
(Para sa multi-GB na weights: gamitin ang `--bundle-out` para sa sneakernet lane,
katulad sa ibaba.)

### Lane B — runnable bundle (ang sandbox, para sa mga code method)

Kung ang inyong pamamaraan ay tunay na code — isang pipeline, isang LLM-coached hybrid, isang custom
na decoder — hindi ito mapapatakbo nang deklaratibo, kaya dumaraan ito sa network-isolated
na sandbox sa halip. Ito ang mas mahinang lane (naglalaman ito ng hindi pinagkakatiwalaang code
sa halip na tanggihang patakbuhin ito), kaya gamitin ang Lane A tuwing ang inyong pamamaraan ay isang
karaniwang modelo.

**Isama ang bawat modelong tinatawag ng inyong pamamaraan.** Pinapatakbo ng node ang inyong entry nang walang
koneksyon sa network, kaya ang isang pamamaraang tumatawag sa isang hosted model API (isang LLM-coached
hybrid na nagtatanong sa isang cloud LLM, isang serbisyo ng MT) ay walang makukuhang sagot at walang
maiiskor. Ang isang LLM-coached hybrid ay magiging kwalipikado lamang kung nasa loob ng bundle ang LLM nito:
mga bukas na weight sa ilalim ng `/method`, na pinapatakbo sa loob ng proseso o ng isang lokal na server na
sinisimulan ng inyong entrypoint. Ganoon din para sa anumang diksyunaryo, FST o iba pang data na
binabasa ng inyong pamamaraan sa oras ng pagpapatakbo. (Tinatawag ng [pagtutukoy sa mga pamamaraan](/docs/network/specifications/methods#method-validity-and-dependency-classes)
ang isang pamamaraang nangangailangan ng hosted LLM bilang dependency class A1; ang gateway na
magpapahintulot sa pagtakbo nito sa sandbox ay hindi pa nagagawa.)

**Ang kontrata ng runnable-bundle ay stdin/stdout.** Sa loob ng container, eksaktong
pinapatakbo ng node ng organizer ang:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Dumarating ang mga source sentence nang isa bawat linya sa stdin; magsusulat kayo ng isang pagsasalin bawat
linya sa stdout. Walang network stack ang container (`--network=none`), may
read-only root, at isang writable na `/tmp`.

**Saan napupunta ang inyong mga file.** Ang lahat ng nasa folder na ipinasa ninyo bilang `--method-dir`
ay ipinapakete sa ilalim ng `method/` sa bundle at naka-mount bilang **read-only sa `/method`**
sa oras ng pagpapatakbo, kasama ang mga weight, kaya walang kailangang kopyahin sa image. Isaayos ito
nang ganito:

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

Ang `--entrypoint` ay ang path ng script sa loob ng `--method-dir`. Ang bundle path nito,
`method/translate.py`, ay tinatanggap din. Kung ang isang pangalan ay maaaring tumukoy sa dalawang magkaibang
file, tatanggi ang command at tutukuyin ang dalawa; kung nawawala ang file, tutukuyin nito
ang bawat path na hinanap nito.

**Isang minimal na Hugging Face transformers wrapper:**

```python title="my-method/translate.py"
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
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**Ano ang dapat taglayin ng bawat pagsusumite.** Kinakailangan ang mga ito, at hihinto
ang command bago ang anumang hakbang sa network kung may nawawala:

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`,
  `--method-class`, `--developer`, `--node-id`, at `--agree`;
- isang **pumapasang `mt-eval contest qualify` resibo** para sa paligsahang ito at para sa
  sistemang ito (Hakbang 8; tinutukoy ito ng `--system` kapag nag-qualify kayo ng higit sa isa);
- dalawang deklarasyon, na nakatala bilang inyong mga claim: `--track constrained` o
  `--track unconstrained` (walang default), at `--parameter-count`;
- para sa isang pamamaraang may trained weights (`--parameter-count` na higit sa 0): gayundin
  ang `--weights-license <SPDX id or LicenseRef-…>` at isa sa `--weights-public`
  o `--weights-private`;
- para sa isang pamamaraang **walang trained weights** (rule-based, isang diksyunaryo, isang FST):
  `--parameter-count 0` at walang mga flag ng weights. Itinatala ng pagsusumite ang
  lisensya ng weights at pagiging bukas bilang not applicable, sa halip na isang lisensyang
  kailangan pa ninyong likhain;
- para sa isang pamamaraang **nagpo-prompt ng isang LLM** (wala itong sinasanay, nagsusulat lamang ito ng
  mga prompt): ang bilang ay ang mga parameter ng bawat modelong pinapatakbo ng bundle, kasama
  ang LLM, kahit hindi ninyo ito sinanay. Kunin ito mula sa model card ng LLM o sa weights header nito,
  at ipasa ang lisensya ng LLM bilang
  `--weights-license` na may `--weights-public` kapag ang mga weight nito ay bukas na
  mai-download. Ang `--parameter-count 0` ay maling maglalarawan sa sistema: ang ibig sabihin ng 0 ay
  walang pinapatakbong modelo ang pamamaraan. Ang isang pamamaraang tumatawag sa isang hosted LLM ay hindi makakasali
  sa isang sealed contest: walang network ang node, at ang gateway na
  magdadala ng mga ganoong tawag ay hindi pa nagagawa (tingnan ang *Isama ang bawat modelong tinatawag ng inyong pamamaraan*
  sa itaas). Sinasabi na ito ng `contest qualify` kapag ang mga output na
  iniiskor nito ay dumaan sa isang provider;
- kasama ang `--track constrained`: `--training-data-file`, isang plain-text na listahan ng
  data kung saan kayo nagsanay (ang isang pamamaraang hindi sinanay sa anuman ay nagsasaad nito sa file);
- kung ang paligsahan ay nagdedeklara ng mga tuntunin sa premyo: `--accept-terms <hash>` (patakbuhin nang isang beses
  nang wala ito at ipiprint ang mga tuntunin kalakip ang hash na ibabalik); kung
  nangangailangan ito ng mga paglalarawan: `--description-file`.

**Ang mga resource na idinedeklara ng inyong pamamaraan.** Isinasaad ng bundle ang RAM, scratch
disk at wall-clock time na kailangan nito, at tatanggihan ng node ng organizer ang isang humihiling
nang higit sa mga limitasyon nito sa `sandbox`. Ang mga default ay ang mga limitasyon sa
node template na isinusulat ng `mt-eval node init`: `--ram-gb 4`, `--disk-gb 4`,
`--max-runtime-minutes 30`, walang GPU. Ang isang bundle na naka-package gamit ang mga default
ay tatakbo samakatuwid sa isang node na naka-configure gamit ang mga default ng template. Kung
nangangailangan ng higit pa ang inyong pamamaraan, sabihin ito gamit ang mga flag na iyon (at `--gpu`), at tiyaking
pinapayagan ito ng node ng organizer. Ang mga organizer na nagbabago ng mga limitasyon ay dapat maglathala
ng mga ito kasabay ng paligsahan. Kung tatanggi ang node, tutukuyin ng pagtanggi ang bawat value
at kung ano ang pinapayagan ng node.

Isumite ito gamit ang:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

Muling pinapatakbo ng node ng organizer ang inyong pamamaraan sa sarili nitong kopya ng pampublikong dev
set bago hilingin sa sinumang custodian na aprubahan ang pagpapatakbo. Kinikilala ng `--agree`
ang mga tuntunin sa pagsusumite ng pamamaraan.

**Multi-GB na weights, o walang koneksyon: gamitin ang sneakernet lane.** Ang hosted
intake path ay nag-a-upload ng inyong tarball bilang isang **solong POST** sa storage
ng host ng paligsahan, kaya nakatali ito sa limitasyon sa pag-upload ng storage ng host na iyon — maayos para sa code
at maliliit na modelo, ngunit hindi para sa mga multi-GB na checkpoint. Ang mismong kontrata ng bundle
ay nagpapahintulot ng mas malalaking artifact (mga tarball hanggang 100 GB, mga binuong image hanggang
150 GB). Ipinapakete ng `--offline` ang bundle at nagsusulat ng isang exchange directory
nang walang network. Kung walang koneksyon ay walang row ng paligsahan na mababasa,
kaya kailangan din nito ang mga value na inilathala ng organizer: `--bundle-out`,
`--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` at
`--offline-threshold` (ang threshold sa 0–100 qualifier scale). Isang rule-based na pamamaraan
na walang weights, na naka-package nang offline:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

Ang exchange directory ay dinadala sa organizer sa pamamagitan ng removable media (o anumang
channel na pareho ninyong pinagkakatiwalaan); ini-ingest nila ito gamit ang `mt-eval node import-bundle`. Ang
SHA-256 ng bundle ay naka-freeze sa authorization request sa alinmang paraan, kaya ang
tumatakbo ay mapapatunayang ang mismong iminungkahi ninyo.

**Mga Organizer: ang isang offline proposal ay naghihintay ng custodian, tulad ng online
na panukala — at sinusuri muna ito ng node, ayon sa pagkakasunod-sunod sa Hakbang 9.** Dumarating ito bilang
isang *pending* na kahilingan, at itinatala ng air-gapped node ang sarili nitong mga pagsusuri at
ang desisyon ng custodian, nang walang database at walang service key:

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

Ang unang `node run-method --offline` sa isang nakabinbing panukala ay walang binubuksan na anumang
selyado. Muli nitong pinapatakbo ang qualifier ng kalahok sa pampublikong dev set (ang
`qualifier` + `dev_corpus` na idinedeklara ng inyong `node.json`; pinupunan ng `node init
--from-contest` ang pareho), at, para sa isang code entry, sinusuri na mayroong container
runtime at ang idineklarang RAM, scratch disk at runtime ng bundle ay pasok sa inyong mga limitasyon sa `sandbox`. Ang pagpasa ay isinusulat sa
hash-chained na lokal na ledger ng node. Ang hindi pagpasa sa qualifier ay tatanggihan doon, itatala bilang
pagtanggi ng node, at maibabalik bilang nilagdaang pagtanggi: walang tatanunging custodian.
Ang isang node na hindi makapagpatakbo ng entry (walang runtime, masyadong mababa ang limitasyon) ay tatanggi bilang
problema ng node at walang itatala, at mananatili ang kahilingan sa dating kalagayan nito.

Tatanggi ang `node approve --offline` hanggang sa mapunta sa ledger ang pumapasang pagsusuri
para sa eksaktong fingerprint at bundle ng kahilingang ito, at tutukuyin ng error nito ang
command na dapat munang patakbuhin. Pagkatapos ay magsusulat ito ng boto at ng awtorisasyon sa
parehong ledger (ang ginagamit ng seremonya ng custodian-share) at isang talaan ng desisyon
na nilagdaan gamit ang `signing_key` ng node, na tumutukoy sa pagsusuri kung saan ito ibinigay. Sinusuri
ng pangalawang `node run-method --offline` ang tatlong ito bago magpatakbo ng anupamang selyado
(nagbe-verify ang ledger, ipinapakita nitong awtorisado ang kahilingang ito sa ilalim ng
fingerprint na na-import, at nagbe-verify ang nilagdaang talaan at tinutukoy ang
kahilingang ito), kaya ang isang nakabinbing panukala ay hindi kailanman tatakbo sa pasya lamang ng operator.
Muli nitong patatakbuhin ang runtime check at ang qualifier bago buksan ang sealed set.
Ang isang pagtanggi ay itinatala sa parehong paraan at ibinabalik sa kalahok bilang isang nilagdaang
pagtanggi; maaaring tumanggi ang isang custodian anumang oras, nasuri man o hindi.
Ang mga kahilingang dumarating na awtorisado na — isang relay export (inawtorisahan sa
database ng paligsahan) o `node stage-request` (ang staging organizer ang siyang awtorisasyon) —
ay hindi nangangailangan ng pangalawang desisyon.

**Mga organizer: i-pre-load ang base images sa mga airgap machine.** Dahil tumatakbo ang image
build gamit ang `--network=none`, ang `FROM` base image ng Dockerfile ay dapat
nasa local image store na ng machine. Sa isang connected machine,
`docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`;
dalhin ang `base.tar` kasama ng bundle; sa airgap machine,
`docker load -i base.tar` bago patakbuhin ang `mt-eval node run-method`. Pagkasunduan ang
base image(s) kasama ng mga participant sa inyong published contest materials.

## Hakbang 10 — Pagraranggo, pagsasara, pag-export

Ang mga resulta na scores-only ay nai-publish sa [leaderboard](/docs/network/leaderboard/rules)
tulad ng anumang pagpapatakbo, na minarkahan bilang mga sealed-set evaluation. Ang sariling pagraranggo
ng paligsahan ay sa inyo upang buuin, i-freeze at ilathala:

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

Ang ginagawa ng `rank`, upang masabi ninyo ito sa inyong mga patakaran: iniraranggo ang mga entry ayon sa
**nakatalang pangunahing sukatan** ng paligsahan (`--primary-metric` sa pagkakagawa; chrF++
bilang default), pagkatapos ay chrF++ → BLEU → COMET → pinakamaagang pagsusumite. Ito ay
**verified-only bilang default** — ang mga run card na inilathala ng node — at binibilang
ang anumang self-reported card na itinago nito. Bawat magkatabing pares ay may dalang may-label na hatol sa pagkakatabla:
isang per-segment paired significance test kung saan mayroong mga per-segment row,
kung hindi ay **95 % confidence-interval overlap**, kung hindi ay point equality.
**Ang isang sealed contest ay hindi kailanman naglalathala ng mga per-segment row** (aggregates lamang, ayon
sa disenyo), kaya ang paired test nito ay tumatakbo sa inyong node sa halip. Bago magsara, patakbuhin ang
`mt-eval node verdicts --contest <id> --out verdicts.json` sa node;
nagsusulat lamang ito ng mga nilagdaang hatol (bawat pares: p-value, pagkakaiba sa score, interval,
bilang ng segment — walang teksto). Pagkatapos ay magsara gamit ang `--node-verdicts verdicts.json
--verify-key <the node's .pub.json>`. Kung walang mga hatol, ang pagkakatabla ay magmumula sa CI
overlap. Alinmang paraan, tinutukoy ng output ang ebidensyang ginamit nito, at ang mga nagtablang sistema
ay magkakaroon ng magkaparehong ranggo (`1, 1, 3`).

Ang `close` ay one-way. Nagraranggo ito ayon sa nakatalang sukatan, tatanggi habang
iniiskoran pa ang mga pagsusumite (maliban kung ipipilit ninyo), ipapakita sa inyo ang
talahanayan, magtatanong, at saka ifi-freeze ang pagraranggo sa talaan ng paligsahan. Ibinabalik ng `export`
ang naka-freeze na resultang iyon nang eksakto, bilang JSON o CSV, para sa inyong page ng Findings o
mga resulta. Ang mga card na naiskoran sa anumang ibang set (isang ganap na lihim na T2 set, isang ligaw na
dev-set card) ay hiwalay na itinatala at hindi kailanman inihahalo sa pangunahing pagraranggo.

### Pagpapasya kung kailan lilitaw ang mga resulta

Dalawang pangakong inyong ginagawa sa pagkakagawa, at hindi maaaring tahimik na baguhin pagkatapos —
hini-freeze ng database ang pareho sa sandaling magkaroon ng entry ang inyong paligsahan:

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**Ang `--results-visibility hidden_until_close` ang siyang aktwal na nagtatago ng
score.** Sa ilalim nito, ang bawat card na iniiskor ng inyong node ay pinipigil sa halip na
ilathala: tumakbo pa rin ang pamamaraan, nagamit pa rin ang awtorisasyon, at ang
card ay nabuo, napatunayan at naimbak nang buo — hindi lamang ito nakalagay sa
board. Inilalathala ng `contest close` ang bawat pinigil na card **muna**, pagkatapos ay bubuuin at
ifi-freeze ang pagraranggo, kaya walang nawawala at iniraranggo ng naka-freeze na resulta ang lahat
ng inyong hawak. Nangyayari rin iyon sa isang sapilitang pagsasara: ang pagpilit ay tungkol sa gawaing
kasalukuyang tumatakbo, hindi kailanman tungkol sa pagpigil ng score na dapat ibigay ng inyong paligsahan. Ang naka-freeze
na snapshot ay nagtatala nang eksakto kung aling mga resulta ang inilathala ng pagsasara.

Ang pagiging pinigil (withheld) ay isang **nakatalang estado, hindi nawawalang pagpapatakbo**: hindi maaaring
i-edit ang pinigil na card, at ang pointer na nagsasabi kung saan ito inilathala ay isinusulat nang isang beses at
hindi na kailanman muling itinuturo — parehong ipinapatupad sa database, sa ilalim ng bawat client. Habang
bukas ang paligsahan, sinasabi sa inyo ng `rank` kung gaano karaming resulta ang kasalukuyang pinipigil, kaya
ang isang pansamantalang pagraranggo ay hindi kailanman magiging mukhang kumpleto kung hindi pa naman.

**Mas kaunti ang ginagawa ng `--anonymize-until-close`, at mahalagang maging tiyak tungkol sa
kung ano ito.** Pinapalitan nito ang mga pangalan ng kalahok ng mga deterministikong pseudonym sa *inyong*
mga artifact ng pagraranggo — ang talahanayan ng `rank`, ang JSON nito, ang CSV — habang bukas ang paligsahan,
at inilalantad ang mga ito ng `close`. **Hindi** nito ina-anonymise ang pampublikong
leaderboard: ang isang card na nai-publish ay nagpapakita ng byline na idineklara ng entry.
Kung nais ninyong hindi makita ng mga kalahok ang mga resulta ng isa't isa bago ang
pagtatapos, iyon ang `--results-visibility hidden_until_close`; ang flag na ito ay hindi
pamalit para doon.

Kung malampasan ng isang pamamaraan ang mga kondisyon sa threshold na inyong inilathala sa Hakbang 6 —
kabilang ang [pagpapatunay ng tagapagsalita (speaker validation)](/docs/network/specifications/speaker-validation),
na siyang harang ng inyong komunidad, hindi isang awtomatikong proseso — **kayo** (o ang inyong trust)
ang magkakaloob ng premyo, alinsunod sa sarili ninyong inilathalang mga tuntunin. Nagtatapos ang papel ng Champollion
sa pagsukat.

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
