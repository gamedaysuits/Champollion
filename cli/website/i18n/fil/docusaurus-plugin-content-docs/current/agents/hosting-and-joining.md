---
title: "Pag-host ng isang sealed test, at pagsali sa isang proyekto"
slug: /agents/hosting-and-joining
description: "Dalawang paraan upang makilahok bukod sa pagbuo: mag-host ng sealed test gamit ang mt-eval contest at mt-eval node (gumagana ito, hindi pa ito nasa rails, at ang mga piniling tagapangalaga ng tagapag-organisa ang may hawak ng mga key share), at sumali sa isang rehistradong proyekto gamit ang mt-eval project — bawat command, kung ano ang ipinapadala nito at kung saan, at kung ano ang hinding-hindi nito ipinapakita."
---

# Pag-host ng isang selyadong pagsubok, at pagsali sa isang proyekto

Dalawang linya sa tabi ng mga riles ng build. Parehong payak na mga command ng `mt-eval` ang mga ito; wala
sa dalawa ang hakbang na pinapangalanan ng `champollion next`.

## Pag-host ng isang selyadong pagsubok

**Tapat na katayuan.**

- Gumagana ito: ang paghahanda ng isang selyadong set, isang seremonya ng susi, pagpapatakbo ng mga lahok sa
  isang air-gapped na node, mga hatol at pagraranggo ay pawang mga command na may mga pagsubok.
- **Wala pa ito sa mga riles.** Tinatanggihan ang `champollion new --kind task`;
  ang tanging paglalakbay ay ang para sa wika. Asahan ang mas mahabang manu-manong proseso, at
  sundin ang [runbook ng paligsahan](/docs/network/sovereignty/run-a-sovereign-contest).
- **Ang mga share ng susi ay hawak ng mga custodian na pinangalanan ng tagapangasiwa.** Walang anuman sa
  code ang nagtatalaga o sumusuri sa kanila. Walang mga community key custodian na naitilaga
  para sa anumang pagsubok.
- **Walang hawak na key share at walang private key ang Champollion.** Tumatakbo ang seremonya sa
  makina ng tagapangasiwa, at ang pagpaparehistro ay nagpapadala lamang ng mga identifier, digest,
  at qualifier threshold — kailanman ay hindi susi, share, o ang mga pangungusap.

**Paalala.** Ang pag-host ang nagpapasya kung ano ang mangyayari sa mga pangungusap ng mga tao at kung sino ang maaaring
mag-unlock sa mga ito. Ang bawat hakbang sa ibaba ay pasya ng tagapangasiwa; patakbuhin lamang ang bawat isa
kapag hiniling nila ito.

### Ang mga nagagawa

Hinahati ng `mt-eval contest prepare` ang corpus ng tagapangasiwa:

| Flag | Set | Sino ang nakakakita nito |
|---|---|---|
| `--dev-size` (kailangan) | Ang qualifier: source at mga sanggunian | Publiko, inilabas mula sa `<out>/public/` |
| `--secret-size` | Ang selyadong pagsubok kung saan nakarehistro ang paligsahan | Walang sinuman: nakaselyo sa `<out>/local/` |
| `--sealed-holdout-size` (kailangan ang `--secret-size`) | Isang pangalawang selyadong hati, namarkahan ngunit pinipigilan hanggang sa pagsasara | Walang sinuman |

Kailangan ang `--seed`, `--qualifier-threshold` (higit sa 0), at `--license` — walang
ipinapalagay na lisensya. Kailangan ang `--custodian-group` at `--threshold-pubkey`
(ang susi kung saan naka-encrypt ang mga selyadong set). Binubura ang plaintext ng bawat selyadong set
pagkatapos selyuhan; hawak ng `<out>/local/manifest.json` ang recipe at
kailanman ay hindi umaalis sa makina. Nagpapatakbo ang pagsaselyo ng `champollion network seal-corpus seal`, kaya dapat
naka-install ang `champollion` CLI.

### Pangangalaga

**Threshold custody (M-of-N).** Sa air-gapped na node:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

Bumubuo ang `init` ng susi, hinahati ito gamit ang Shamir's scheme, at binubura ito sa isang
tawag; isinusulat nito ang `ceremony.json` (ang pampublikong talaan) at isang share file para sa bawat
custodian. Dapat na ang `--set` ang id ng lihim na set at ang `--group` ang
gagamitin ng `--custodian-group` prepare — hindi sinusuri ng prepare ang mga ito, at
matutuklasan lamang ang hindi pagtutugma kapag tinanggihan ang isang pagpapatakbo. Ibigay sa prepare ang talaan
ng seremonya: `--threshold-pubkey <ceremony>/ceremony.json`.

**Kandado.** Nade-decrypt lamang ang isang selyadong set sa pamamagitan ng `mt-eval node run-method <id>
--offline --share … --share …` na may hindi bababa sa M na share mula sa magkakaibang
mga custodian na ang mga id ay tumutugma sa set. Tumatakbo lamang ang threshold custody sa offline
na linyang ito.

**Isahang susi.** Gumagawa ang `champollion network seal-corpus keygen --out <dir>` ng isang
keypair; sinumang may hawak ng key file nito ay maaaring mag-decrypt nang mag-isa. Ito ang
ginagamit ng linya ng nakakonektang node.

### Ang mga hakbang ng tagapangasiwa (threshold custody)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

Itinatakda ng `node init --from-contest` ang threshold custody kapag ang set ay isinelyo sa
isang susi ng seremonya. Kwalipikado ang mga kalahok sa pampublikong dev set (`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`,
`mt-eval contest submit-model`, parehong may path ng `--offline --bundle-out`).
Nasa [gabay sa node](/docs/network/sovereignty/sovereign-eval-node) ang bawat
command ng node.

### Kung ano ang nangangailangan ng koneksyon, at kanino

| Gumagana offline | Nangangailangan ng pag-sign in | Nangangailangan ng service key ng database |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (may `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, bawat `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, online na `submit-*`, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` nang walang `--no-register` o `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, online na `node run-method`, `node relay`, at `contest close` kapag pinigil ang mga resulta |

Ang service key ay pag-aari ng sinumang nagpapatakbo ng database. Ang isang panlabas na tagapangasiwa
ay nagpapatakbo ng mga ito laban sa sarili nilang database (`MT_EVAL_SUPABASE_URL` at ang
mga susi nito), o nananatili sa offline na linya — kung saan ang mga marka ay mapatutunayan mula sa kanilang
mga nilagdaang manifest ngunit hindi nakakakuha ng pampublikong lahok sa talaan. **Paalala.** Huwag kailanman itakda
ang `MT_EVAL_ALLOW_PROD`: inaalis nito ang pagtanggi ng mga tool na sumulat sa default na
production database, at hindi iyon desisyon ng isang agent.

## Pagsali sa isang proyekto

Ang isang **nakarehistrong proyekto** ay isang proyekto sa wika na inilista ng may-ari nito upang ang iba
ay makatulong, gamit ang mga file: mga pangungusap, mga listahan ng salita, o mga pamamaraan (hindi pa iniaalok ang
oras ng pagsusuri at computing). Ang mga command ng `mt-eval
project` sa ibaba ay nakikipag-ugnayan sa database ng proyekto
(`MT_EVAL_SUPABASE_URL`). Bawat subcommand maliban sa `list` (hindi nagpapakilala) at
`review` (para sa operator) ay nagsu-sign in (isang naka-cache
na session, `MT_EVAL_REFRESH_TOKEN`, o isang interactive na pag-sign in sa GitHub o Google);
ang account ay ang email ng pag-sign in.

**Ang mga panuntunan.**

- **Sinusuri bago ilista.** Nagsisimula ang isang bagong proyekto bilang `pending_review`; inililista
  lamang ito pagkatapos suriin. Maaaring isara ng may-ari ang isang proyekto, at hindi kailanman ilista ito.
- **Pinapangalanan ang may-ari ayon sa kanilang nais** (`--owner-name`). Walang email
  ang row ng proyekto; ibinubukod ang account ng may-ari, na mababasa lamang nila.
- **Walang email sa isang listahan.** Ang `project list` ay hindi nagpapakilala at nagpapakita ng mga pangalan at
  bilang; iniimprenta ng `project offers` ang mga tumutulong ayon sa pangalang ibinigay nila (`--as`).
  Mababasa pa rin ng account ng may-ari ang email ng account ng tumutulong sa talaan
  ng alok, at itinatala ng consent note ang parehong account.
- **Hawak ng dalawa ang mga alok.** Ang pagtanggap ay sumusulat ng isang consent note na nagpapangalan kung sino
  ang nagsumite nito at kung sino ang nagpahintulot nito.
- **Walang iniimprenta mula sa isang file.** Mga pangalan, bilang, at mga estado lamang.

### May-ari

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- Binabasa ng `register` ang pares mula sa `champollion.project.json` (at ang layunin,
  maliban kung `--purpose`); opsyonal ang `--slug`, `--domain`, `--register`, `--about`.
  Hindi hihigit sa 5 pagpaparehistro bawat account sa loob ng 24 na oras.
- Ang `ask` `--kind` ay `sentences`, `word-list` o `method`; lumalabas lamang ang mga kahilingan habang
  nakalista ang proyekto.
- Dina-download ng `accept` ang file, **bineberipika ang sha256 nito** (tinatanggihan kapag may
  hindi pagtutugma), isinusulat ang `inbox/offer-<offer id>-<file name>` at
  `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`,
  `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`), pagkatapos ay minamarkahan ang
  alok bilang tinanggap. Papasok ang file tulad ng iba pa —
  `champollion data add inbox/<file>` — at tatanungin ang mga tuntunin ng may-hawak nito.
- **Paalala.** Ang `--terms` ng tumutulong ay nasa consent note. Ang mga sagot na
  itatala ninyo gamit ang `champollion data mark` ay hindi dapat magluwag sa mga ito.

### Tumutulong

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- Nag-a-upload ang `offer` ng isang hindi walang-lamang file na hindi hihigit sa 50 MB sa pribadong
  storage ng proyekto, kasama ang sha256 nito, sa isang nakalistang proyekto lamang. Hindi hihigit sa 24
  na alok bawat tumutulong sa loob ng 24 na oras.
- Minsan lamang lumilipat ang isang alok: `offered` → `accepted`, `declined` o `withdrawn`.
- **Paalala.** Binabago ng pagbawi o pagtanggi ang estado ng alok; hindi nito
  binubura ang na-upload na file mula sa storage. Sabihin ito bago mag-alok ang isang tumutulong
  ng anumang bagay na maaaring nais nilang bawiin.
- **Kandado.** Binabasa ng `offer` ang sidecar ng file bago mag-upload ng anuman.
  Tinatanggihan nito ang isang file na `local-only`, isang set na `sealed`, at isang file na ang
  `speakers_agreed` ay `not-yet` o `some-said-no`; pinipigilan ng isang hindi mababasang sidecar
  ang alok. Walang override: ang may-hawak lamang ang maaaring magbago ng marka.
  Idinaragdag ang isang tuntuning `training: not-allowed` sa mga tuntunin ng alok, upang makita ito
  ng may-ari.
- **Paalala.** Nagpapadala ang isang alok ng file mula sa computer ng tumutulong patungo sa storage
  ng database ng proyekto. Tanungin ang tumutulong, at huwag kailanman mag-alok ng file para sa kanila.

Ang `mt-eval project review` ay para sa operator ng database (ginagamit nito ang service
key). Hindi ito command ng isang agent.

## Alamin pa nang mas malalim

- [Mag-host ng isang selyadong pagsubok](/docs/host-a-sealed-test) at
  [Sumali sa isang proyekto](/docs/join-a-project) — ang mga bersyon para sa mga tao.
- [Magpatakbo ng isang soberanong paligsahan](/docs/network/sovereignty/run-a-sovereign-contest)
  at [ang soberanong eval node](/docs/network/sovereignty/sovereign-eval-node).
- [Paglilipat ng pagmamay-ari](/docs/network/sovereignty/ownership-transfer) at
  [mga template ng mga tuntunin](/docs/network/sovereignty/terms-templates).
- [Mga panuntunan sa data at pagpapadala](/docs/agents/data-rules) — mga selyadong set at
  mga lokal-lamang na file.
- [Sanggunian ng `mt-eval`](/docs/reference/mt-eval).
