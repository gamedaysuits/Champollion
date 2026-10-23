---
title: "Mga panuntunan sa datos at transmisyon"
slug: /agents/data-rules
description: "Ang mga panuntunang inilalapat ng bawat tool ng Champollion sa datos ng mga tao: ang set/1 sidecar bawat field, ang local-only at ang pansamantalang default nito, ang hindi pinapayagang pagsasanay, ang mga tagapagsalita at tagapangalagang sumang-ayon, kung ano ang ipiniprint at hindi kailanman ipiniprint ng bawat tool, ang apat na mode ng transmisyon, ang mga antas ng pagpaparehistro, at ang mga output ng modelo bilang mga derivative."
---

# Mga panuntunan sa data at transmisyon

Ang mga taong nagtataglay ng data ng wika ang nagpapasiya kung paano ito gagamitin. Isinusulat ng mga rail ang
kanilang mga pasiya sa tabi ng bawat file, at sinusunod ng bawat tool ang nakasulat — kung saan ang
pagmamay-ari at kontrol ng komunidad sa data ng wika ang panuntunan sa disenyo, hindi isang
setting lamang. Ang pahinang ito ang mismong hanay ng mga panuntunan: kung ano ang ginagawa ng bawat field, kung ano ang
tinatanggihan ng mga tool, at ang mga bahaging kayo lamang ang makapangangalaga.

## Ang sidecar (set/1)

Sa tabi ng anumang data file, `<file>.champollion.json`, `$schema`
`https://champollion.dev/schemas/set/1.json`. Ang mga hindi kilalang key ay tinatanggihan; ang mga tala
ay inilalagay sa ilalim ng `x-`. Ang sidecar na naisulat bago ang set/1 (walang `$schema`) ay binabasa bilang set/0
at nananatiling balido (muling isinusulat ito ng `champollion upgrade`).

| Field | Mga Halaga | Epekto |
|---|---|---|
| `transmission` | `local-only` (ang nag-iisang halaga) | Tanging modelo lamang sa kompyuter na ito ang maaaring makakita sa teksto; tinatanggihan ng bawat tool na ipadala ito saanman (kasama ang `mt-eval project offer`) |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | Kung para saan ang file. Hindi kailanman sinasanay sa `test` at `sealed` |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | Kung ano ang nilalaman nito |
| `pair` | `{source, target}` | Ang direksyon ng mga column nito, sa mga code ng card |
| `fields` | `{source, target}` | Aling column o JSON field ang naglalaman ng aling panig |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed`: walang modelong maaaring sanayin dito |
| `terms.owner` | teksto | Kung sino ang nagtataglay nito, sa sariling mga salita ng may-hawak |
| `terms.speakers` | teksto | Kung kaninong mga salita ang taglay nito, sa sariling mga salita ng may-hawak |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | Kung sumang-ayon ang mga taong may-ari ng mga salitang ito |
| `terms.consent_record` | path | Ang tala ng pahintulot, kaugnay ng folder ng file |
| `holders_agreed` | `{by, date}` | Sino sa mga may-hawak ang sumang-ayon na ang isang local-only na output ay maaaring manatili kung nasaan ito (walang pinapaluwag) |
| `derived_from` | path | Ang protektadong file kung saan ginawa ito; dinala rito ang mga marka nito |
| `id`, `name`, `license`, `tier`, `segment`, `sha256`, `rows`, `card`, `registeredAt` | | Isinulat ng `champollion network register-corpus`; ang binagong file (ibang sha256) ay hindi na makakakuha ng id ng card |
| `written_by` | teksto | Ang command na sumulat nito |

**Lock.** Ginagawa lamang ng sidecar na mas mahigpit ang isang file: hindi nito kailanman pinapaluwag ang sinasabi ng isang corpus
envelope o entry sa registry.

## Local-only, at ang pansamantalang default

Minamarkahan ng `champollion data add` ang file na isinusulat nito bilang local-only kapag ang
`defaults.transmission` ng proyekto ay `local-only` (ang isinusulat ng `champollion new`), at
palagi para sa `--into test`. Ang markang iyon ang proteksyon ng tool hanggang sa
sumagot ang mga may-hawak, na may flag na `"x-transmission-default": true`.

- Ang unang sagot ng mga may-hawak ang magpapasiya. Ang `champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` ang magpapasakamay nito sa kanila (inaalis
  ang flag).
- **Paalala.** Hindi matutukoy ng tool kung sino ang nagpatakbo ng command. Alisin lamang
  ang pansamantalang marka batay sa mismong sagot ng mga may-hawak.
- **Lock.** Ang markang local-only na ginawa ng mga may-hawak ay hindi maaaring alisin ng
  anumang command: *"ang file na ito ay minarkahang local-only, at ang isang sidecar ay lalo lamang
  naghihigpit. Kung maaari itong umalis sa kompyuter na ito ay pasiya ng mga may-hawak nito — kung
  sumasang-ayon sila, i-edit ang sidecar nang manu-mano."*
- **Lock.** Ang `data mark` sa isang file na hindi pa local-only ay nangangailangan ng `--local-only` o
  `--may-leave`: *"kung ang teksto ba ng file na ito ay maaaring ipadala sa isang panlabas na serbisyo ng AI
  ay pasiya ng mga may-hawak nito, kaya hindi ito kailanman ipinapalagay"*.

Ang kahulugan ng local-only sa bawat tool:

| Saan | Ang mangyayari |
|---|---|
| Anumang pagsusuri (`mt-eval run`, pag-score sa forge) | Naresolba ang patakaran sa `sealed` (tier `local-only`): tanging isang loopback endpoint, ang sariling in-process adapter ng harness (`local-model`), o isang panlabas na paraan na pinapatakbo gamit ang `--attest-local-transport` ang maaaring makakita sa teksto |
| Output sa terminal at `--json` | Pinipigil ang mga pangungusap nito; sa halip ay ipinapakita ang mga numero ng linya, id, bilang, at score, na may isang linyang nagsasaad kung bakit |
| Mga file na hinango mula rito | Pinapanatili ng mga split, nalinis na kopya, hypothesis, at log ng pagpapatakbo ang teksto (nasa mga folder ang mga ito ng tao) at dinadala ang marka sa sarili nilang sidecar |
| Isang modelong sinanay dito | Ang output nito ay local-only din (`forge-model.json` `trained_on.terms`; itinuturing na local-only ang hindi naitala): ibinabalik lamang ng `try_translation` ang pahina ng modelo, ang `champollion connect`, `mt-eval serve` sa labas ng loopback at ang `mt-eval translate` sa labas ng proyekto ay nangangailangan ng `--holders-agreed-by`, at pinipigil ng `sync` ang mga sagot nito, sa pamamagitan man ng pamamaraang `api` o `local` ([pagseserbisyo](/docs/agents/serving)) |
| Isang coaching file o diksyunaryo | Dinadala ng coaching file na may sidecar ang patakaran nito sa prompt; pinipigil ang mga output ng isang lexicon run kapag ang diksyunaryo nito ay local-only |

**Paalala.** Ipinapahayag ng `--attest-local-transport` na lokal ang endpoint ng isang paraan. Ipasa
lamang ito kapag napatunayan ninyong nasa makinang ito ang endpoint: ang isang loopback
address ay maaaring maging proxy na nagpapasa saanman.

## Pagsasanay

- **Lock.** Tinatanggihan ng nmt-forge na magsanay sa isang file na ang sidecar ay nagsasaad ng
  `terms.training: not-allowed`; ang isang hindi mababasang sidecar ay itinuturing na isang
  paghihigpit, at hindi kailanman kawalan nito.
- **Lock.** Hindi kailanman pinagsasama ng `champollion data combine` ang isang file na hindi pinapayagan: inililipat
  nito ang file, kasama ang sidecar nito, sa `data/not-for-training/`. Tinatanggihan nito ang isang file na hindi
  pa sinasagot ng mga may-hawak — walang `terms.training`, o walang
  `terms.speakers_agreed` (*"wala pang nagsasabi kung sumang-ayon ang lahat ng taong narito ang mga salita — susunod na magtatanong ang champollion sa mga tao; pagsamahin pagkatapos"* ) —
  at dinadala ng pinagsamang file ang pinakamahigpit sa mga tuntunin ng mga file (local-only kung
  may isa man, not-allowed kung may isa man, pinangalanan ang bawat may-ari).
- **Lock.** Itinuturing lamang ng hakbang sa mga tuntunin (terms step) ng journey na nasagot na ang isang file sa `data/parallel/`,
  `data/lexicon/`, `data/grammar/` o `data/monolingual/` kapag ang sidecar nito ay may parehong `terms.training` at `terms.speakers_agreed` (at ang
  sagot sa pagsasanay ay mula sa mga may-hawak, hindi ang pag-iingat ng tool sa ibaba); hanggang sa mangyari iyon
  ay muli itong magtatanong, at hindi magpapatuloy ang mga rail.
- **Paalala.** Binabasa ng nmt-forge ang `terms.training`, hindi ang `speakers_agreed`. Kung may isang
  pair file ay walang pagsasama (combine), kaya tanging ang hakbang sa mga tuntunin ang naghihintay sa sagot
  na iyon: huwag kailanman magsanay ng file na walang sagot mula sa mga nagsasalita.
- **Lock.** Ang isang file na `test` o `sealed` ay hindi kailanman sinasanay: ang `--training
  allowed` ay tinatanggihan para dito, at ang pagbibigay dito ng ibang tungkulin ay tinatanggihan din.
- **Lock.** Ang `not-allowed` ay hindi maaaring maging `allowed` sa pamamagitan ng command (*"Kung sumasang-ayon ang mga may-hawak nito sa pagsasanay, i-edit ang sidecar nang manu-mano"* ) — na may isang pagbubukod sa ibaba.
- Ang Banal na Kasulatan (USFM) ay pumapasok na may markang `terms.training: not-allowed` bilang
  pag-iingat ng tool (`"x-training-default": true`); ang sagot ng mga may-hawak ang papalit
  dito.

## Kaninong mga salita, at sino ang sumang-ayon

Itinatala ng `--speakers` kung kaninong mga salita ang taglay ng file; `--speakers-agreed` kung
sumang-ayon sila.

| `speakers_agreed` | Epekto |
|---|---|
| `yes` | Pagsasanay ayon sa sinabi ng mga may-hawak |
| `not-yet` | Sapilitang itinatakda ang pagsasanay sa `not-allowed` hanggang sa sumang-ayon silang lahat; lumalabas ang file sa `waiting_for_agreement` |
| `some-said-no` | Walang modelo ang maaaring matuto mula sa file, kailanman: *"kunin ang kanilang mga salita at ilagay sa ibang file, at markahan ang nalalabi"* |
| (walang sagot) | Patuloy na nagtatanong ang hakbang sa mga tuntunin, at tinatanggihan ng `data combine` ang file (sa itaas) |

**Ang nag-iisang pagpapaluwag na ginagawa ng isang command:** `not-yet` → `yes` kasama ng
`--training allowed`. Ang file na itinabi ng `combine` ay babalik pagkatapos sa
`data/parallel/` para sa susunod na combine.

**Paalala.** Itanong ang tanong ukol sa `waiting_for_agreement` nang minsan bawat session, nang may paggalang at pag-iingat, at
sagutin lamang ito batay sa pagkumpirma ng tao na sumang-ayon ang lahat.

Ipinapangalan ng **`--holders-agreed-by "<who>"`** ang isang tao sa hanay ng mga may-hawak ng data na
sumang-ayon na ang isang local-only na output ay maaaring mapunta sa isang partikular na lugar: sa mga locale
file ng isang app (`champollion connect`, na naitala bilang `holdersAgreed` ng pares), sa
isang address na naaabot ng ibang mga makina (`mt-eval serve`, `nmt-forge serve`, na iniulat
sa `/health`), o sa isang file sa labas ng proyekto (`mt-eval translate`,
na naitala bilang `holders_agreed` ng sidecar). Wala na itong ibang pinapaluwag: ang
output ay nananatiling local-only para sa bawat tool. **Paalala.** Ipasa lamang ang pangalang
ibinigay sa inyo ng tao.

## Ang ipinapakita at hindi kailanman ipinapakita ng mga tool

| Tool | Ipinapakita | Hindi kailanman ipinapakita |
|---|---|---|
| `champollion data add` | Mga bilang, column (titik, fill rate, karaniwang haba, bahagdan ng mga titik na Latin), isang cell ng header kapag pinapangalanan lamang nito ang isa sa mga wika ng pares, mga ELAN tier ayon sa numero, at ang mga numero ng row na tinutukoy ng row check nito | Isang pangungusap; anumang iba pang cell ng header (ang haba nito sa halip); ang id ng isang ELAN tier |
| `champollion data mark`, `combine`, `next`, `validate` | Mga field, bilang, estado | Ang teksto ng isang data file — hindi kailanman binubuksan ng mga ito ang file |
| `champollion improve …` | Mga bilang at porsyento | Ang mga pangungusap ng mga sheet |
| `champollion sync` (ang mga pamamaraang `local` at `api`) | Ang mga key kung saan ang teksto ay naglalaman ng mga salitang hindi kailanman nakita ng isang modelo ng forge sa pagsasanay, mula sa `meta.unseen_words` ng server | Ang teksto, o ang mismong mga salita |
| `nmt-forge`, `mt-eval` | Para sa isang corpus na local-only, sealed, o nangangailangan ng pahintulot: mga id, numero ng linya, bilang, score; `[sentence withheld]` sa loob ng mga mensahe ng error | Ang mga pangungusap nito, sa output para sa tao o sa `--json` |
| Mga tool ng MCP rails | Ang ipinapakita ng CLI, na pinaikli | Mga pangungusap; ang output ng isang modelong local-only |

**Paalala.** Ipinapakita ng `--show-text` (nmt-forge; `mt-eval compare`) ang mga pinigilang
pangungusap. Ito ay para sa isang tao sa sarili niyang terminal, hindi kailanman para sa isang agent —
ang inyong binabasa ay naipapadala sa inyong provider ng modelo.

**Paalala.** Walang tool na makapipigil sa inyo sa pagbubukas ng file. Huwag kailanman buksan, i-print,
ibuod, o i-paste ang mga data file, pansubok na pangungusap, listahan ng salita, o
sheet ng mga tao — maging ang `input-words.json` ng isang export: inililista nito ang mga salita ng kanilang
mga pangungusap sa pagsasanay, at nananatili sa tabi ng folder ng modelo, hindi kailanman sa loob nito
([pagseserbisyo](/docs/agents/serving#what-an-export-holds)).

**Ang pagsusuri sa row.** Habang ipinapasok nito ang isang file (mga pares, pansubok na set, o listahan ng salita),
sinusuri ng `data add` ang mga row nito laban sa mismong dalawang column ng file — walang
diksyunaryo, walang inalis. Binibilang nito, at tinutukoy ayon sa numero ng row:

- mga kopya: ang salin ay muling ang pinagmulang pangungusap (ayos lang ang pangalan o salitang hiniram; kung hindi, nawawala ang salin);
- mga pag-uulit ng naunang pares;
- mga saling higit na mas mahaba o mas maikli kaysa sa karaniwang ratio ng file (naputol, o dalawang pangungusap sa isang cell);
- mga row na mukhang nagkapalit: ang pinagmulan ay nababasa tulad ng mga salin ng file, at bise bersa;
- magkakasunod na row na mukhang nausog nang isang row: mas angkop ang kanilang mga salin sa susunod o naunang row — ang mga numero, tandang pananong, at haba ay nakatugma sa katabing row, at gayundin ang mga salita: kung gaano kahusay nakakahanap ng katugma ang mga pinagmulang salita ng row sa mga salita ng salin, batay sa dalas ng pagsasama ng dalawa sa nalalabing bahagi ng parehong file (mas mabigat ang timbang ng mas madalang na mga salita; hindi kasama ang mismong row).
  Natutukoy nito ang pagkausog sa isang file ng mga pangungusap na may template, na magkakahawig ang haba; wala itong naidaragdag kapag napakakaunti ng sinasabi ng mga salita ng file.

Nagpapakita ito ng hanggang 12 numero ng row bawat uri (hanggang 6 na sunod-sunod para sa mga row na nausog nang isa) — para sa isang spreadsheet, ang row sa sariling file ng tao, kasama ang header — at itinatala ang mga bilang sa `x-import.quality` ng sidecar. Ang mga pagsusuri sa haba, pagpapalit, at pagkausog ay nangangailangan ng hindi bababa sa 20 pares; ang listahan ng salita (`--into lexicon`) ay sumasailalim lamang sa pagsusuri ng mga kopya at pag-uulit. **Paalala.** Ipasa ang mga numero ng row: titingnan ng mga tao ang mga row na iyon sa kanilang sariling file at magpapasiya sila. Huwag kailanman buksan ang file upang kayo mismo ang tumingin.

**Mga ELAN file.** Kapag hindi matukoy ng `data add` kung aling tier ang alin (isang panig na
hindi tinukoy ng anumang flag, na walang eksaktong isang tier na nakatala sa wika nito), tinatanggihan
ito at inililista ang mga tier ayon sa numero, sa pagkakasunod-sunod sa file: `tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>` para sa isang tier
na tumutukoy sa isa pa. Ipasa ang mga numero bilang `--source-col` at `--target-col`
(`champollion data add <file> --source-col <number> --target-col <number>`);
itinatala ng sidecar ang mga numero (`x-import.elan_tiers`). Ang isang numero o id na
walang tinutukoy na tier ay tinatanggihan (`no such tier — … Name a tier by its number`), at
gayundin ang isang tier na ang nakatalang wika ay hindi para sa panig na iyon. Ang dalawang tier ay ipinapares
lamang kapag ang isa ay tumutukoy sa isa pa o nagbabahagi sila ng mga time slot — hindi kailanman sa
pamamagitan ng panghuhula. **Paalala.** Ang id ng isang tier ay anumang itinatype ng gumawa ng file at
kadalasang pangalan ng isang tao, kaya hindi ito kailanman ipinapakita ng `data add`. Maaaring i-type mismo ng tao
ang eksaktong id; ipinapasa ninyo ang numero.
Ang mga LIFT file ay itinutugma ayon sa kanilang mga code ng wika, ang mga Toolbox file ayon sa kanilang mga MDF
marker (ang `\ge` at `\xe` ay Ingles ayon sa pamantayan).

## Mga mode ng transmisyon

Nireresolba ng bawat pagsusuri ang corpus nito sa isang mode bago may ipadala anuman
(`arena/mt_eval_harness/transmission_policy.py`), at itinatala ito sa log ng
pagpapatakbo:

| Mode | Kailan | Mga remote na modelo |
|---|---|---|
| `cleared` | Isang lisensyang pinahintulutan para sa muling pamamahagi | Pinapayagan |
| `no-train` | Isang karaniwang lisensya ng Creative Commons na non-commercial o no-derivatives; o isang hindi rehistradong corpus na hindi nagpapahayag ng lisensya | Sa mga channel lamang na hindi nagsasanay sa mga input: OpenRouter na naka-pin sa `data_collection: deny`, mga first-party vendor API, o lokal. Isang garantiya na walang pagsasanay, hindi garantiya na walang pagpapanatili |
| `consent-required` | Isang binago, pasadya, o hindi isinaad na lisensya (`LicenseRef-*`) | Tinatanggihan hanggang sa maitala sa entry ng dataset ang isang kaloob na `transmission_consent` (`granted_by`, `date`, `scope`, `evidence`); gumagana pa rin ang lokal |
| `sealed` | Isang held-out o gold-standard na segment, isang na-quarantine na set, o isang markang local-only ng tagapangasiwa | Tinatanggihan, nang walang override |

- **Lock.** Ang teksto ng isang corpus na `consent-required` o `sealed` ay pinipigil din sa
  terminal.
- Ang isang panlabas na pamamaraan (isang plugin) sa isang corpus na `no-train` ay binibigyan ng babala, hindi
  tinatanggihan: hindi nakikita ng harness ang channel ng plugin. Sa mga corpus na `consent-required`
  at `sealed`, tinatanggihan ito maliban kung `--attest-local-transport`.
- **Lock.** Itinuturing lamang na lokal ang lokal na provider kapag ang endpoint nito ay isang
  loopback address (`localhost`, `127.0.0.1`, `::1`, isang unix socket) — hindi
  kailanman dahil lamang sa pangalan nito.
- **Paalala.** Huwag kailanman magtala ng kaloob na `transmission_consent`, at huwag kailanman magpaliwanag ng
  lisensya sa ngalan ng may-hawak ng karapatan. Ang isang kaloob ay itinatala ng tagapangasiwa ng dataset
  kapag ibinigay na ito ng may-hawak ng karapatan.
- **Paalala.** Inaalis lamang ng `--allow-data-collection` ang no-train pin para sa isang
  hindi rehistradong corpus na hindi nagpapahayag ng lisensya; iginigiit nito na hawak ng tumatawag
  ang mga karapatan. Ipasa lamang ito kapag sinabi ng tao na hawak nila ang mga ito.

## Mga tier ng pagpaparehistro

Opsyonal ang pagpaparehistro ng isang corpus: hindi ito kailanman kailangan ng mga rail. Sumusulat ito ng
card ng metadata upang ang corpus ay mapangalanan, maikumpara at, kung pipiliin ng mga may-hawak nito,
mailista. Ang `champollion network register-corpus` ay interactive sa isang terminal
at maaaring i-script gamit ang mga flag (`--tier`, `--data`, `--license`, `--name`, …).
**Paalala.** Ang tier, tulad ng bawat tuntunin, ay pasiya ng mga may-hawak.

| Tier | Ang card | Ang teksto | Ang tinatanggihan nito |
|---|---|---|---|
| `local-only` (default) | Isinusulat sa tabi ng `--data` file (o `--out`, o rito), hindi kailanman sa nakabahaging folder ng card | Hindi kailanman umaalis sa kompyuter na ito; nakakatanggap ang sidecar ng `transmission: local-only` | — |
| `private` | Metadata na may `quarantine: true`; mula sa isang npm install nananatili itong lokal, at ang paglilista nito ay isang hiwalay na kahilingan (`champollion network submit --type dataset`) | Hindi kailanman ina-upload; walang marka ng transmisyon — ang lisensya nito ang nagpapasiya sa mode | — |
| `public` | Metadata kasama ang isang fetch-from-source pointer (`--repo-url`, `--builder`) | Hindi kailanman hino-host: kinukuha mula sa pinagmulan nito | Isang lisensyang non-commercial, no-derivatives, pinaghihigpitan, o hindi nakumpirma (*"Magparehistro nang pribado o bilang local-only sa halip."*); `--data` |
| `sealed` | Metadata na may `quarantine: true` at isang selyadong block (`--seal-input`, `--threshold-pubkey`, `--custodian-group`, `--qualifier-id`) | Tanging ciphertext lamang ang umiiral, na isinusulat sa `<id>.sealed.json` o `--seal-out` | Isang file na byte copy ng isang pampublikong corpus; `--data` |

Sa bawat tier, walang ina-upload sa pagpaparehistro (`--json` ay nagsasaad ng
`uploadedContent: false`). Ang nag-iisang tawag sa network, mula sa isang npm install, ay naghahambing
ng sha256 ng file sa sha256 ng pampublikong katalogo sa kompyuter na ito (hindi kailanman umaalis
ang hash); gamit ang `CHAMPOLLION_OFFLINE=1`, isinasaad ng card na hindi ginawa ang
paghahambing. Gamit ang `--data`, itinatala ng sidecar ang `id`, `name`, `license`, `tier`,
`sha256`, `rows`, `card` at `registeredAt`. **Lock.** Ang isang rehistradong id ay
hindi kailanman muling hinahango: ang muling pagpaparehistro ng file sa ilalim ng ibang id ay tinatanggihan, at
ang binagong file (ibang sha256) ay hindi na makakakuha ng id o grado ng card.

## Ang mga output ay mga derivative

Ang output ng isang modelo sa mga pinaghihigpitang pangungusap ay isang derivative ng mga ito, at ang isang
pagsusuri ay lumilikha ng mga ganoong output nang maramihan. Tinatrato ng mga tool ang mga output sa paraang
tinatrato ng mga ito ang kanilang mga input:

- Para sa bawat corpus na hindi `cleared`, itinatala at ipinapakita ng pagpapatakbo ang isang paunawa:
  ang mga prediksyon nito ay mga machine derivative ng mga pinaghihigpitang pangungusap, na hindi dapat
  ipamahagi.
- Kung saan pinipigil ang teksto (local-only, sealed, kailangan ng pahintulot), bawat
  file na ginawa mula rito — mga log ng pagpapatakbo, ulat, paghahambing, cache entry,
  output ng `mt-eval translate`, mga split side ng forge, nalinis na mga corpus, at
  mga hypothesis — ay nakakakuha ng set/1 sidecar na nagdadala ng marka (`derived_from`,
  `written_by`). Ang isang `no-train` corpus ay nakakakuha ng paunawa ngunit walang sidecar.
- Ang isang modelong sinanay sa local-only na teksto ay nagsusulat ng local-only na output (sa itaas).
- Hindi kailanman ina-upload ng `mt-eval publish` ang mga pangungusap ng isang local-only na corpus, kahit pa may
  `--publish-entries`, at inilalathala ang isang coached prompt bilang hash lamang nito bilang
  default para sa ganoong corpus. Para sa ibang mga corpus, inilalathala ang prompt maliban kung
  `--redact-coaching`.

**Paalala.** Ang paglalathala ay pasiya ng mga tao, na ginawa sa sarili nilang mga salita, kung saan ipinapakita muna
sa kanila ang preview (`--dry-run`). Huwag kailanman maglathala, mag-paste, o magpadala ng mga output
ng isang pagpapatakbo sa kanilang ngalan.

## Magbasa pa

- [Ang kontrata sa pagpapatakbo](/docs/agents/contract) §1 at §3.
- [Ang inyong mga salita, ang inyong mga panuntunan](/docs/your-words-your-rules) — ang bersyon para sa mga tao.
- [Pagpaparehistro ng mga corpus](/docs/network/sovereignty/registering-corpora) — ang
  mga tier, kasama ang bawat flag.
- [Pagseserbisyo at pag-deploy](/docs/agents/serving) — ang local-only na output sa
  gawa.
- [Soberanya ng data, sa payak na pananalita](/docs/learn/data-sovereignty).
