---
title: "Pagpapatakbo sa mga rail sa pamamagitan ng MCP"
slug: /agents/mcp
description: "Ikonekta ang isang MCP client sa rails profile ng Champollion at tahakin ang isang proyekto sa wika gamit ang anim na tool: pag-setup para sa bawat client, bawat argument at return, ang loop, ang mga step mode, mga pagtanggi, at ang mga paksa sa pagpapaliwanag."
---

# Pagpapatakbo sa mga riles sa pamamagitan ng MCP

Ang default na profile ng MCP server ay ang mga riles: anim na tool na gumagabay sa isang
proyekto ng wika mula sa isang walang lamang folder patungo sa isang nasukat na modelo sa sariling
kompyuter ng tao. Pinapatakbo ng bawat tool ang `champollion` CLI bilang isang hiwalay at may hangganang
proseso — ang parehong mga command na tina-type ng isang tao. Nagbibigay din ang server sa inyong client
ng maiikling tagubilin sa pagpapatakbo (`instructions-rails.md`) sa oras ng koneksyon.

## Kumonekta

Nakikipag-ugnayan ang server gamit ang MCP sa pamamagitan ng stdio at nangangailangan ng Node.js 20.11 o mas bago. Ang
konpigurasyong tinatanggap ng bawat client na naka-configure gamit ang file:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| Client | Kung saan ito ilalagay |
|---|---|
| Claude desktop | Settings → Developer → Edit Config. Idagdag ang entry, i-save, i-restart ang app |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | `mcp.json` sa folder na `.cursor` ng proyekto, o sa `.cursor` sa home folder |

Tinatanggap ng iba pang mga client na maaaring magsimula ng lokal na stdio server ang parehong command; inilalarawan
ng pahinang ito ang tatlo lamang sa itaas.

**Mga path ng tool.** Kusa mismong hinahanap ng server ang CLI na kinakailangan nito. Hinahanap nito
ang `nmt-forge` sa `PATH`, pagkatapos ay sa `UV_TOOL_BIN_DIR` (default na `~/.local/bin`,
kung saan inilalagay ito ng `uv tool install`) — ang isang client na inilunsad mula sa isang desktop app ay madalas
na may mas maikling `PATH` kaysa sa isang terminal. Mga override, bilang mga environment variable sa
`env` ng entry ng server:

| Variable | Epekto |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails` (default) o `full` |
| `CHAMPOLLION_CLI_BIN` | ang entry point ng `champollion` CLI na tatakbo sa halip na ang kasamang naka-bundle |
| `NMT_FORGE_BIN` | ang executable ng `nmt-forge` (iginagalang din ng journey ng CLI ang parehong variable) |
| `UV_TOOL_BIN_DIR` | kung saan hahanapin ang `nmt-forge` at `uv` pagkatapos ng `PATH` |

## Mga Profile

| Profile | Piliin gamit ang | Kung ano ito |
|---|---|---|
| rails | ang default | Anim na tool at maiikling tagubilin; isang proyekto ng wika, mula simula hanggang dulo |
| full | `--profile full` sa `args`, o `CHAMPOLLION_MCP_PROFILE=full` | Bawat tool: mga language card, mga corpus, mga benchmark, ang pila, mga paligsahan, forge training, pag-publish |

Pinapahinto ng anumang iba pang halaga ang server: `unknown MCP profile "<value>" (rails or
full)`. Ang kumpletong hanay ay nakalista sa
[pahina ng MCP server](/docs/network/getting-started/mcp-server). Para sa isang
proyekto ng wika, manatili sa profile na rails: ito ang profile kung saan ang bawat hakbang
ay binabasa mula sa mga file ng proyekto.

## Ang loop

1. Wala pang proyekto → `start_project`. Walang ginagawa ang unang tawag nito: sabihin ang
   `ask_first` nito sa tao, pagkatapos ay gawin ang tawag na ibinibigay nito para sa kanilang sagot.
2. `project_status` → basahin ang `step.mode`, `step.say`, `step.why`.
3. Gawin ang sinasabi ng mode, gamit ang `step.call` — ang eksaktong tawag na nagsasagawa ng
   hakbang.
4. Bumalik sa 2. Pagkatapos ng anumang pagbabagong ginawa ninyo o ng tao nang manu-mano, tawagan muli ang
   `project_status`: palaging binabasa ang susunod na hakbang mula sa mga file.
5. `step: null` → tapos na ang mga riles. Sabihin sa tao kung ano ang sinasabi ng `finished`.

| `step.mode` | Gawin ito | `step.call` |
|---|---|---|
| `auto` | Patakbuhin ito | `run_next_step` na may `project_dir`, `step_id` |
| `confirm` | Sabihin sa tao kung ano ang ginagawa nito (mga pag-install, pagsasanay); magtanong ng oo o hindi; patakbuhin lamang kapag oo. Sa "hindi muna ngayon", itala ito: walang tatakbo | `run_next_step` na may `confirmed: true` na idinagdag pagkatapos ng oo; `declined: true` sa "hindi muna ngayon" |
| `ask_user` | Itanong ang `step.question` sa mga simpleng salita; ipasa ang kanilang mga sagot ayon sa mga key sa `step.answers`. Sa "hindi muna ngayon": kapag ang `not-now` ay isa sa sariling mga value ng `enum` ng isang slot, isa itong sagot — ipasa ito; kung hindi ay itala ito: walang tatakbo | `run_next_step` na may `answers` — bawat slot ay nakasulat na `<…>`, na papalitan ng mga salita ng tao; `declined: true` sa isang "hindi muna ngayon" na hindi isa sa mga sagot |
| `wait` | Mayroong tumatakbo | `project_status` na may `wait_seconds: 120`; ulitin habang nananatiling `wait` ang mode |
| `use_tool` | Gawin ninyo ito ngayon gamit ang `step.tool`; huwag itong ibalik | hal. `add_data` na may `path: "<each file the person named, where it is>"` |
| `human_only` | Isang tao ang gagawa nito: sabihin sa kanila ang `step.say` | wala |

Ang `step.command` ang pinapatakbo ng mga riles — hindi kailanman pangalan ng tool. Ang `<…>` sa isang tawag ay
isang slot para sa sagot o file ng tao; ang isang slot na ibinalik nang walang pagbabago ay tatanggihan.

## Ang anim na tool

### `start_project`

| Argument | Uri | Kahulugan |
|---|---|---|
| `folder` | string, kinakailangan | Bagong folder para sa proyekto, relative sa `parent_dir` |
| `from` | string, kinakailangan | Ang wikang ipinapasok ng mga tao: isang code o isang pangalan |
| `to` | string, kinakailangan | Ang wikang lumalabas: isang code o isang pangalan |
| `target_name`, `source_name` | string | Ang pangalan ng wika ayon sa pagbigkas ng mga taong nagsasalita nito; kinakailangan para sa isang private-use code (`qaa`–`qtz`) |
| `purpose` | string | Kung para saan ang mga pagsasalin, sa sariling mga salita ng tao |
| `parent_dir` | string | Kung saan gagawin ang folder (default: ang working directory ng server) |
| `confirmed` | boolean | `true` lamang pagkatapos sumang-ayon ang tao sa direksyon |

Kung walang `confirmed: true` pinapatakbo nito ang `champollion new --dry` at ibinabalik ang
`made: false`, `ask_first` (isang pangungusap na sasabihin: *"Tumatanggap ang tagasaling ito ng X at
nagbibigay ng Y — ipinapasok ninyo ang X, at lumalabas ang Y. Ganoon po ba ang nais ninyong ayos?"*), `if_yes` at `if_the_other_way` (bawat isa ay kumpletong tawag) at
`languages` — kung ano ang naging resolusyon ng bawat pangalan, na may `matchedAs` kapag ang salita
ng tao ay isa pang pangalang itinala ng isang card, at `alsoNamed` kapag ang parehong salita ay nagpapangalan
sa iba pang mga wika. Sabihin muli ang dalawa. Kapag may `confirmed: true` ginagawa nito ang proyekto
at ibinabalik ang `project`, `languages` at `next` (ang unang hakbang).

Isang pangalang hindi dala ng anumang card at walang katulad: idinaragdag ng pagtanggi ang
`if_it_has_no_code`, ang parehong tawag na may `to: "qaa"` at ang kanilang pangalan bilang
`target_name`. Gamitin lamang ito para sa pangalang ibinigay ng tao.

### `project_status`

Mga Argument: `project_dir` (kinakailangan); `wait_seconds` (0–120). Kapag may
`wait_seconds`, muli itong nagbabasa bawat 5 segundo habang ang hakbang ay `wait`, at
nagbabalik kapag nagbago ang hakbang o naubos ang oras.

Ibinabalik ang `project`, `stage` (`"2/6 Gather your data"`), `step` (`id`, `mode`,
`say`, `why`, `call`, at kung mayroon, `question`, `answers`, `command`,
`tool`, `for_the_person`), at ang mga ito kapag naaangkop:

| Field | Kung ano ito | Kung ano ang inyong gagawin |
|---|---|---|
| `true_now` | Sariling tala ng Forge, bilang mga pangungusap: mga sinanay na modelo at ang kanilang pinakamahusay na dev chrF++, ang pasya ng leak audit bawat test set, mga score ng test-set, kung tumatakbo ba ang pagsasanay, kung may isinisilbing modelo at kung saan | Sabihin lamang kung ano ang nagawa mula sa mga linyang ito, huwag hihigit pa |
| `waiting_for_agreement` | Mga file kung saan hindi pa sumasang-ayon ang mga tagapagsalita (`speakers_agreed: not-yet`): bawat isa ay may `file`, `question`, `say` at sarili nitong `call` | Itanong ang bawat tanong nang isang beses bawat sesyon, nang mahinahon; gawin lamang ang tawag nito kapag sinabi ng tao na sumang-ayon ang lahat |
| `files_not_added` | Mga file na tinanggihan ng `add_data` sa sesyong ito na wala pa rin sa proyekto, bawat isa ay kasama ang pagtanggi nito | Ipasok ang bawat isa (sinasabi ng pagtanggi nito kung paano), o sabihin sa tao kung alin ang naiwan at kung bakit |
| `model_in_use` | Kapag naisilbi na ang isang modelo, katabi ng mga hakbang ng mga round ng pagpapahusay: `say` (ang pahina nito para subukan at kung paano ito ginagamit) at `for_the_person` (ang `champollion connect` command na naglalagay nito sa kanilang app o website) | Sabihin sa tao nang isang beses; pinapatakbo nila ang connect kapag gusto nila ito |
| `blockers`, `warnings` | Mula sa Forge, verbatim | Ipasa ang mga ito nang salita-sa-salita |
| `finished` | Kapag wala nang natitirang hakbang: kung ano ang magagawa ng mga tao ngayon (subukan ang modelo sa pahina nito; isang app) | Sabihin sa tao |
| `error` | Kung bakit walang hakbang na maipangalan | Ipaabot ito |

Ang isang folder ng proyekto na hindi umiiral, o walang `champollion.project.json`,
ay tinatanggihan kalakip ang mga proyektong nahanap sa malapit.

### `run_next_step`

| Argument | Uri | Kahulugan |
|---|---|---|
| `project_dir` | string, kinakailangan | Ang folder ng proyekto |
| `step_id` | string, kinakailangan | Ang `step.id` (o id ng isang entry sa `waiting_for_agreement`) na kababalik pa lamang |
| `answers` | object ng mga string | `ask_user`: ang mga sagot ng tao ayon sa mga key sa `step.answers` |
| `confirmed` | boolean | `confirm`: `true` lamang pagkatapos magsabi ng oo ang tao. Gayundin: isang hakbang na dalawang beses nabigo, kapag sinabi lamang ng tao na subukan itong muli nang ganoon pa rin |
| `declined` | boolean | `true` kapag sinabi ng tao na hindi muna ngayon sa isang hakbang na `confirm`, o sa isang tanong na walang sariling sagot na `not-now`: walang tatakbo, at hindi na ito muling itatanong sa sesyong ito. Kung saan ang `not-now` ay isa sa mga sagot, ipasa ito sa `answers` |

Binabasa nitong muli ang susunod na hakbang bago ito magpatakbo ng anuman. **Mga Lock:**

- Ang ibang id ay tinatanggihan: `the project changed since that step was named
  — call project_status again`, with `current`.
- Ang `human_only` ay tinatanggihan (`a person does this step: …`); ang hakbang na `human_only`
  na ginagawa ng isang agent gamit ang isang tool ay tinatanggihan kalakip ang tool na dapat gamitin.
- Ang `wait` ay tinatanggihan; ang `confirm` nang walang `confirmed: true` ay tinatanggihan (`ask the
  person first, then call again with confirmed: true`).
- `ask_user`: kinakailangan ang bawat sagot (`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>` na placeholder ay
  tinatanggihan; ang isang sagot sa labas ng `enum` ay tinatanggihan.
- Ang sariling mga programa lamang ng mga riles ang tumatakbo: `champollion`, `nmt-forge`, at `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` o ang
  nag-iisang `&` ay tinatanggihan; pinagdurugtong ng `&&` ang mga bahagi, pinapatakbo nang sunod-sunod, humihinto sa unang
  pagkabigo.
- Bawat bahagi ay may limitasyong 10 minuto (ang pag-install ng `uv` ay 15).
- Ang `declined: true` sa isang hakbang na hindi `confirm` o `ask_user` ay
  tinatanggihan: `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- Ang `declined: true` sa isang hakbang na ang `answers` ay may kasamang `not-now` (sa kasalukuyan, ang
  `try_it` ng alok para sa mas malakas na modelo) ay tinatanggihan, at dala ng pagtanggi ang
  `answers` ng hakbang: `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

Ibinabalik ang `ran` — bawat bahagi: `command`, `exit_code`, `timed_out` kapag nangyari ito, at
ang huling 40 linya ng `output` — at `next`, ang susunod na hakbang sa
hugis ng `project_status`.

#### "Hindi muna ngayon"

May dalawang paraan upang itala ito, at ang hakbang ang nagpapasya kung alin:

| Ang hakbang | Ang "Hindi muna ngayon" ay | Kung ano ang itinatala nito | Kung kailan ito babalik |
|---|---|---|---|
| Isang hakbang na `ask_user` kung saan ang `answers` ay may kasamang `not-now` (ang alok para sa mas malakas na modelo: `try_it`, `yes` o `not-now`) | Isang sagot: `answers: {"try_it": "not-now"}` | Ang ledger ng Forge (`model-change`, `answer: "not-now"`); walang ibang nagbabago | Pagkatapos ng dalawa pang round na hinusgahan ng dev set bilang **no-change** o **worse** — sa iba't ibang sesyon |
| Isang hakbang na `confirm` (pagsasanay, pag-install, paggamit ng modelo), o isang tanong na hindi pa masasagot ng tao | `declined: true` | Sa memory lamang ng server na ito | Kapag nag-restart ang server (sa susunod na sesyon) |

Walang pinapatakbo ang `declined: true` at ibinabalik nito ang `declined` (ang step id), `ran: []`,
`say` (*"Nothing ran. It is not asked again this session; if they bring it up
and say yes, take it then."*) at `next`. Ang pagtanggi ay pinapanatili habang
buhay ang server — isang sesyon; nakalimutan na ito ng isang na-restart na server. Habang
umiiral ito, bumabalik ang hakbang na iyon mula sa `project_status` at `run_next_step` na may
`declined_this_session` (kailan, bilang isang ISO time) at ang `say` nito na nagsisimula sa *"They
said not now (HH:MM UTC) to this: …"* at nagtatapos sa *"Do not ask again this
session — nothing that needs their yes runs. If they bring it up themselves
and say yes, take it with confirmed: true (or their answers)."* Ang isang susunod na
`confirmed: true`, o mga sagot, ay nagsasagawa ng hakbang at nag-aalis sa pagtanggi.
**Paalala.** Huwag magtanong muli sa sesyong ito, at huwag gumawa ng ibang daan para lampasan ang hakbang; kung
ang tao mismo ang magbanggit nito at magsabi ng oo, isagawa ito noon.

#### Kapag nabigo ang isang hakbang

**Lock.** Ang isang hakbang na dalawang beses sunod-sunod na nabigo (non-zero exit o timeout, binibilang
sa buong panahon ng server) ay tatanggihan sa ikatlong pagkakataon maliban kung `confirmed: true`,
kasama ang `last_output` nito. **Paalala.** Ang flag na iyon ay para sa inyo upang itakda: sabihin sa tao
kung ano ang sinabi nito, at maaaring ayusin nila ito (ayos lang ang isang naitamang command na pinatakbo sa terminal — pagkatapos ay tawagan ang `project_status`), o maaari nilang sabihing subukang muli nang ganoon pa rin.

### `add_data`

| Argument | Uri | Kahulugan |
|---|---|---|
| `project_dir` | string, kinakailangan | Ang folder ng proyekto |
| `path` | string, kinakailangan | Ang file kung saan ito naroroon: absolute, o relative sa folder ng proyekto o kung saan nagsimula ang server |
| `into` | `parallel` (default) · `test` · `lexicon` | Mga pares na mapag-aaralan; ang mga nasuring pangungusap sa pagsubok; isang listahan ng mga salita |
| `source_col`, `target_col` | string | Isang column bilang titik (`A`), numero, o ang header nito; para sa ELAN, ang numero ng tier na nakalista sa pagtanggi (o eksaktong tier id na tina-type ng tao); para sa LIFT, isang language code |
| `sheet` | string | Aling sheet o talahanayan, kapag marami |
| `header` | boolean | `true`: header ang unang row; `false`: data ito |
| `usfm_source` | string | Kasulatan sa USFM lamang: ang teksto ng kabilang wika (isang file o folder na `.usfm`) |
| `replace` | boolean | Basahing muli ang isang file na naidagdag na (ibang header o mga column); pinananatili ang mga sagot ng mga may hawak nito |

Pinapatakbo nito ang `champollion data add`. Tawagan muna ito na ang path lamang ang kasama: ang isang header
na nagpapangalan sa mga wika ng pares ang nagpapasya sa mga column; kung hindi ay magtatanong ito, at itatanong
ninyo sa tao — huwag kailanman magpasya mula sa nilalaman. Nagbabasa ito ng mga spreadsheet
(`.xlsx`, `.ods`, `.csv`), `.tsv` at `.txt`, mga talahanayan sa Word `.docx`, mga diksyunaryo ng Toolbox
at LIFT, mga ELAN `.eaf` file at USFM.

Ibinabalik ang `result` (ang ulat ng CLI: mga bilang, mga column, mga ELAN tier ayon sa numero, at
ang mga numero ng row na tinutukoy ng pagsusuri nito sa mga row — mga kopya, pag-uulit, kakaibang haba,
nagpalit o nausog na mga row, walang inalis — hindi kailanman mga pangungusap), `read_from` kapag
nahanap ang file mula sa panimulang folder ng server, at `also` kapag ang
file ay naglalaman pa ng iba (mga halimbawang pangungusap ng diksyunaryo bilang mga pares, o mga gloss nito bilang
isang listahan ng salita) — bawat entry ay isang kumpletong tawag sa `add_data`. Gawin ito maliban kung
ipinagbabawal ng mga kondisyon ng tao para sa file na iyon. Ipasa ang pagsusuri ng mga row nang ganoon pa rin: tinitingnan
ng tao ang mga row na iyon sa sarili nilang file
([mga panuntunan sa data](/docs/agents/data-rules#what-tools-print-and-never-print)).
Huwag kailanman hilingin sa tao na ilipat ang isang file; ang `inbox/` ay isa lamang lugar kung saan maaari silang maglagay
ng file.

### `try_translation`

Mga Argument: `project_dir`; `text` — hanggang 10 linya, hindi hihigit sa 2,000 character,
isang pangungusap bawat linya, mga salitang ibinigay sa inyo ng tao.

Hinahanap nito ang modelong isinisilbi ng proyektong ito (ang pinakabagong malusog na `serve` job sa
`nmt-forge jobs --json`), sa kompyuter lamang na ito, at binabasa ang `/health` nito.

- **Lock.** Kung ang `output_local_only` ay hindi `false` (true, o unknown), wala itong
  ibinabalik na salin: `shown_to_person_only: true`, `open` (ang sariling
  pahina ng modelo) at `say`. Papuntahin ang tao roon; huwag hilingin sa kanila na i-paste ang mga salin
  nito pabalik sa inyo.
- Ang isang server na humihingi ng token ay tinatanggihan: hindi kailanman ibinibigay ang mga token sa isang
  agent.
- Kung hindi ay ibinabalik nito ang `model`, `pair`, `translations` (`source`,
  `translation` bawat linya), `errors` kung mayroon, at `say`: ipasa ang mga ito nang ganoon
  pa rin; walang sinusuring anuman ang server sa ibinabalik nito.

### `explain`

Argument: `topic`. Mga simpleng tekstong ipapasa:

| `topic` | Sumasaklaw |
|---|---|
| `rails` | Ang folder ng proyekto at ang pagkakasunod-sunod ng mga hakbang |
| `privacy` | Kung ano ang ibig sabihin ng sidecar; kung bakit hindi ninyo kailanman binubuksan ang mga file |
| `quality` | Kung ano ang ipinapangako ng isang score at kung ano ang hindi |
| `modes` | Paano isasagawa ang bawat uri ng hakbang |
| `improve` | Ang mga round pagkatapos magamit ang isang modelo: humigit-kumulang isa sa bawat sampung review row *"comes back from an earlier sheet on purpose (the sheet says so …)"*; isang mas mahusay na modelo ang iniaalok para gamitin at sumasang-ayon ang mga tao (*"a verdict alone changes nothing"*); ang pasyang too-few; ang alok para sa mas malakas na modelo pagkatapos ng *"two rounds in a row that the dev set could judge show no gain (counted from the last model put to use)"* |
| `off_rails` | Pagbaba sa riles: magpatakbo ng pang-ekspertong command, pagkatapos ay tawagan ang `project_status` |

## Mga paalala para sa buong sesyon

- **Paalala.** Lahat ng inyong binabasa ay napupunta sa inyong model provider. Nag-uulat ang `add_data`,
  `project_status` at `run_next_step` ng mga bilang, mga column at mga estado, hindi kailanman
  mga pangungusap; panatilihin itong ganoon. Huwag ninyong buksan ang mga file nang kusa.
- **Paalala.** Ang mga sagot sa `ask_user`, `confirmed: true` at ang
  oo sa `waiting_for_agreement` ay sa tao. Sinusuri ng mga tool na ang isang sagot
  ay naroroon at may maayos na anyo; kayo lamang ang makasisiguro na ito ay galing sa kanila.
- **Paalala.** Ipaabot ang `blockers`, `warnings` at bawat caveat nang salita-sa-salita, at
  bawat numero kasama ang unit nito at ang set kung saan ito sinukat
  ([coaching](/docs/agents/coaching)).

## Lumalim pa

- [Ang kontrata sa pagpapatakbo](/docs/agents/contract) — mga lock at paalala.
- [Ang modelo ng mga riles](/docs/agents/rails-model) — ang paglalakbay, ang mga mode at ang
  mga step id na binabasa ng mga tool na ito.
- [Pagpapatakbo sa mga riles mula sa shell](/docs/agents/shell) — ang parehong mga hakbang bilang
  mga command.
- [Ang MCP server](/docs/network/getting-started/mcp-server) — ang parehong profile
  at ang buong katalogo ng mga tool.
