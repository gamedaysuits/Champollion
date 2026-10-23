---
title: "MCP Server — ang lagusang nakaharap sa agent"
sidebar_label: "MCP Server"
description: "Ikonekta ang isang AI agent sa Champollion sa pamamagitan ng Model Context Protocol. Dalawang profile: tinatahak ng rails profile (ang default) ang isang proyekto ng wika gamit ang anim na tool; nagbibigay naman ang --profile full ng 34 na tool para sa paghahanap ng mga wika, pag-browse sa benchmark queue at corpus registry, pagpapatakbo ng mga pagsusuri, pagsasanay at pag-export ng mga modelo, at pagsasalin — pati na rin kung alin talaga ang nangangailangan ng higit pa sa isang npx install."
---

# MCP Server — ang pinto para sa agent

Inilalantad ng `champollion-mcp-server` ang Champollion sa mga AI agent sa pamamagitan ng [Model
Context Protocol](https://modelcontextprotocol.io), sa stdio. Mayroon itong dalawang
profile:

| Profile | Simulan ito gamit ang | Ang inihahatid nito | Ginawa para sa |
|---|---|---|---|
| **rails** (ang default) | `npx -y champollion-mcp-server` | anim na tool: `start_project`, `project_status`, `run_next_step`, `add_data`, `try_translation`, `explain` | paggabay sa isang proyekto ng wika mula sa isang walang lamang folder patungo sa isang nasukat na modelo sa sariling computer ng tao, nang paisa-isang hakbang |
| **full** | `npx -y champollion-mcp-server --profile full` (o `CHAMPOLLION_MCP_PROFILE=full`) | 34 na tool, 3 resource, at 4 na prompt | pagtuklas, benchmarking, pagsasanay nang paisa-isang hakbang, pagsasalin, at ang network |

Kung tumutulong kayo sa isang taong bumuo ng tagasalin para sa kanilang wika, gamitin ang
rails profile; ang paraan ng pagpapatakbo nito ay nasa [Pagpapatakbo ng mga rail sa
MCP](/docs/agents/mcp), at ang mga panuntunang sinusunod ninyo ay nasa [ang operating
contract](/docs/agents/contract).

Maaabot din ang lahat dito bilang payak na HTTP — tingnan ang [Mga machine-readable na
endpoint](#machine-readable-endpoints) — ngunit ang MCP server ang tanging surface
na nagpapahintulot sa isang agent na *kumilos* (magsalin, magpatakbo ng benchmark, magsanay ng modelo) sa halip
na magbasa lamang.

## I-install

```bash
npx -y champollion-mcp-server
```

Pagkatapos ay irehistro ito sa inyong client. Para sa Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Para sa mga client na kino-configure gamit ang file (Claude Desktop, Cursor, Antigravity), idagdag ang:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

Para sa full profile, idagdag ang `"--profile", "full"` pagkatapos ng pangalan ng package sa
`args`, o tapusin ang command na `claude mcp add` gamit ang `--profile full`.

## Ang rails profile (ang default)

Ginagabayan ng anim na tool ang isang proyekto ng wika mula sa isang walang lamang folder patungo sa isang nasukat
na modelo sa sariling computer ng tao. Sinasabi ng bawat hakbang kung aling tool mismo ang tatawagin,
at ang bawat tanong na ang tao lamang ang makasasagot (kung sino ang may hawak ng file, kung maaaring
matuto ang isang modelo mula rito, kung maaaring umalis ang teksto nito sa computer, kung ano ang kanilang
inaasahan, kung sapat ba ang resulta) ay ibinabalik sa kanila. Nag-uulat ang mga tool ng mga
bilang at column, kailanman ay hindi mga pangungusap. Pinatatakbo ng bawat tool ang command
line na `champollion` bilang isang hiwalay at may-hangganang proseso — ang parehong mga command na tina-type
ng isang tao. Binuo ang profile na ito para sa maliliit na agent, na may maiikling tagubilin.

| Tool | Mga Argument | Ginagawa nito |
|---|---|---|
| `start_project` | `folder`, `from`, `to`, `target_name?`, `source_name?`, `purpose?`, `parent_dir?`, `confirmed?` | Gumagawa ng proyekto (`champollion new`). Walang ginagawa ang unang tawag at nagbabalik ng `ask_first`: sabihin ang direksyon pabalik sa tao, pagkatapos ay gawin ang tawag na ibinibigay nito para sa kanilang sagot |
| `project_status` | `project_dir`, `wait_seconds?` (hanggang 120) | Ang susunod na hakbang, binasa mula sa mga file (`champollion next --json`): ang mode nito, kung ano ang sasabihin, bakit, at ang eksaktong tawag na nagsasagawa nito |
| `run_next_step` | `project_dir`, `step_id`, `answers?`, `confirmed?` | Pinatatakbo ang hakbang na pinangalanan lang ng `project_status`. Ang isang hakbang na `confirm` ay nangangailangan ng `confirmed: true` matapos sumang-ayon ang tao; ang isang hakbang na `ask_user` ay nangangailangan ng sariling mga sagot ng tao; tinatanggihan ang mga hakbang na `human_only` at `wait` kalakip ang dapat gawin bilang kapalit |
| `add_data` | `project_dir`, `path`, `into?` (`parallel`, `test` o `lexicon`), `source_col?`, `target_col?`, `sheet?`, `header?`, `usfm_source?`, `replace?` | Dinadala ang isang file kung nasaan ito — isang spreadsheet, isang Word table, isang Toolbox o LIFT na diksyunaryo, isang ELAN file, o USFM kasulatan (`champollion data add`) — at nag-uulat ng mga bilang at column, kailanman ay hindi mga pangungusap |
| `try_translation` | `project_dir`, `text` (hanggang 10 linya) | Isinasalin ang ilan sa mga pangungusap ng tao gamit ang modelong inihahatid ng proyekto. Para sa isang modelong natuto mula sa mga lokal-lamang na pangungusap, ibinabalik nito ang address ng sariling pahina ng modelo, kailanman ay hindi ang teksto |
| `explain` | `topic`: `rails`, `privacy`, `quality`, `modes`, `improve` o `off_rails` | Mga paliwanag sa payak na pananalita na maipapasa |

## Ang full profile

Inilalarawan ng lahat sa ibaba ang **full profile** — bawat tool, para sa pagtuklas,
benchmarking, at ang network:

```bash
npx -y champollion-mcp-server --profile full
```

## Basahin ito bago kayo umasa rito

**Sa full profile, labing-apat sa 34 na tool ang gumagana mula sa isang payak na pag-install ng `npx`, at gumagana ang `translate`
kapag mayroon na itong engine. Ang iba pang labinsiyam ay nangangailangan ng mga Python package na hindi
at hindi kayang ipadala ng npm package.** Hindi tahimik na nabibigo ang mga ito — bawat isa ay nagbabalik ng
isang naaaksyunang error na nagsasaad kung ano ang nawawala — ngunit dapat ninyong malaman ang ayos nito bago
kayo magplano kaugnay nito.

| Mga Tool | Gumagana pagkatapos ng `npx`? | Ano pa ang kailangan ng mga ito |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Oo** — read-only, inihahatid mula sa mga pampublikong endpoint | wala |
| `translate` | **Oo**, kapag may engine | isang API key para sa engine na inyong pipiliin — o wala, gamit ang paraang `local` at isang model server sa sarili ninyong makina |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Hindi | ang eval harness — `pipx install mt-eval-harness` |
| ang labinlimang tool na `forge_*` | Hindi | NMT Forge 0.2.0 o mas bago — `python3 -m pip install nmt-forge` (idagdag ang `'nmt-forge[hf]'` upang magsanay at mag-serve). Dinadala nito ang eval harness at kusa nitong nahahanap ang mga language card; hindi kailangan ng clone |

Hindi kailangan ng pag-clone ng repository para sa alinman dito.

## Ang ginagawa ng mga tool

**Mag-browse at kalkulahin ang gastos ng gawain.** Tinitingnan ng `list_queue` at `get_queue_item` ang bukas na
benchmark queue — ang niranggong listahan ng mga pagsukat na higit na magpapahusay sa
mapa. Kinakalkula ng `estimate_cost` ang presyo ng isang hanay ng mga run bago kayo gumastos ng anuman.

**Maghanap ng impormasyon.** Hinahanap ng `search_languages` ang mga language card ayon sa pangalan,
code, pamilya, o rehiyon, at pinahihintulutan ang mga maling baybay. Sinasabi rin ng bawat resulta kung saan
sinasalita ang wika (mga bansa, punto sa mapa, macroarea) at ang iba pang mga
pangalan nito — tanging ang mga katotohanan lamang na may binanggit na pinagmulan sa card nito, bawat isa ay may pinagmulang iyon, upang
mapagbukod ang mga wikang may magkakatulad na pangalan. Ang isang lokasyong walang pinagmulan ay
kailanman hindi ipinapakita; sinasabi ito ng linya at inili-link sa halip ang talaan sa Glottolog ng wika.
Ang mga card na pinunan mula sa mga nai-publish na card table ng champollion.dev (sa isang
pag-install ng npm, bawat wika sa labas ng kasamang core set) ay wala pang mga
pinagmulan sa bawat field — darating ang mga ito sa susunod na pag-upload ng mga table — kaya ang mga linyang
iyon ay may link sa Glottolog sa halip na isang lokasyon. Ang `language_overview` ang
isang-pahinang panimulang punto para sa pagbuo para sa isang wika: kung ano ang mayroon, kung ano ang maaaring
tumakbo, at ang mga susunod na hakbang. Ibinabalik ng `get_language` ang buong card na may mga pagsipi.
Inililista ng `list_corpora` ang mga nakarehistrong evaluation
corpora para sa isang pares ng wika o benchmark family — metadata lamang (laki,
lisensya, antas ng kontaminasyon, at kung kayang kunin ito ng harness, nangangailangan ng
access token, o hawak ito sa quarantine); kailanman ay hindi ibinabalik ang nilalaman ng corpus,
at ang isang pares na ang mga corpus ay pawang naka-quarantine ay nagsasabi nito sa halip na magmukhang
hindi suportado. Binabasa ng `get_results` at `get_run_card` ang mga namarkahang run mula
sa pampublikong leaderboard. Sinasagot ng `get_metric_reliability` ang tanong na madalas
ipagkamali ng mga agent — *aling sukatan ang dapat kong pagkatiwalaan para sa target na wikang ito* —
mula sa mga ugnayan sa mga paghuhusga ng tao sa bawat pamilya ng wika. Ipinapakita ng `list_contests`
at `get_contest` ang mga contest at ang mga ipinahayag na tuntunin ng mga ito; ang pagsali sa isa ay isang
hakbang sa CLI na may pahintulot ng tao, kailanman ay hindi isang tool.

**Kumilos.** Pinatatakbo ng `translate` ang teksto sa nasubukang pipeline, na may Translation
Memory (walang bayad ang mga pag-uulit) at isang deterministic na quality gate. Pinapangalanan ng bawat sagot
ang engine na aktuwal na tumakbo, kasama ang modelo at endpoint nito kung mayroon.
Sinisimulan ng `run_benchmark` ang isang pagsusuri at **nagbabalik kaagad ng job id**,
dahil ang mga totoong run ay mas matagal kaysa sa anumang timeout ng client; mag-poll kayo sa `get_run_status` gamit
ang id na iyon. Nananatili ang isang job kahit mag-restart ang server: nagpapatuloy ang pagtakbo, at
ang pag-poll sa parehong id pagkatapos nito ay nagbabalik pa rin ng status at mga resulta nito. Walang
inilalathala maliban kung ipapasa ninyo ang `publish: true`; sinasabi ng plano kung ano ang
isasapubliko — bawat hilera kasama ang teksto ng pangungusap nito, o mga marka lamang; ang prompt, o ang
hash lamang nito; at kung saan — at ang isang totoong paglalathala ay nangangailangan ng `publish_ack` sa eksaktong
mga salitang ibinibigay ng plano, upang makita muna ito ng user. Ang isang run na ginawa nang wala ito
ay maaaring ilathala sa ibang pagkakataon, sa likod ng parehong gate. Read-only ang `preview_publish`:
ipinapakita nito ang sariling publish preview ng harness, ang mga eksaktong salita at ang eksaktong
tawag sa `publish_report` na maglalathala nito, at hindi ito maaaring maglathala. Taglay
nito ang MCP annotation na `readOnlyHint: true`, kaya ang isang agent host na nagtatanong
bago ang bawat pagsulat ay maaaring magpahintulot nito nang kusa. Isinasagawa ng `publish_report` ang pagsulat
(naka-annotate bilang `destructiveHint` at `openWorldHint`), at ipinagkakait ng `scores_only`
ang teksto ng pangungusap. Nagsisimula rin ang bawat plano sa status ng
`EVAL PACK:` ng target na wika — `missing` (kasama ang command na
nag-i-install nito), `ready`, o `none needed` — at pinapangalanan ang lisensya ng corpus at ang
tuntunin nitong `do_not_train`, dahil ipinapasa ng run ang `--yes`. Ang nawawalang FST (ang
analyzer o ang pyhfst runtime nito) ay hindi kailanman nagpapahinto sa run: nagpapatuloy ito, at minamarkahan ng run
card ang pagtanggap ng FST bilang hindi nakalkula. Ang anumang iba pang nawawalang bahagi ay nagpapahinto sa run
bago ito magsalin. Nagmamarka ang `skip_fst` at `skip_eval_standard` nang wala ang mga bahaging
iyon, at minamarkahan ng run card kung ano ang iniwan. Sinasabi rin ng plano kung
kalkulahin ang COMET (kinakalkula ito ng harness tuwing naka-install ang `unbabel-comet`;
hinihiling ng `comet: true` na kailanganin ito ng run), at humihiling ang `metricx` at `fuse`
ng opt-in na MetricX-24 at FUSE-style comparator ng harness. Para sa bawat
isa, sinasabi ng plano, mula sa harness, kung naka-install ito, kung ano ang dapat i-install
at kung ano ang dina-download nito. Ang isang kumpirmadong run na humihiling ng sukatang hindi
makalkula ng harness ay tinatanggihan sa halip na patakbuhin nang wala ito. Sinasabi ng mga linyang `Results:`
at `Cache:` ng plano kung saan mapupunta ang run log, ulat, at translation cache.
Ang isang pansubok na file sa loob ng isang folder na minarkahan ng `mt-eval contest prepare` na maaaring ilabas
(ang `public/` ng isang contest) ay tumatakbo sa `runs/` folder ng contest sa halip, upang
walang anumang isinulat ng isang run ang mailabas kasama nito. Ang isang modelo sa sarili ninyong
makina (isang lokal na server, o `method: "local-model"`, na pinatatakbo ng harness
nang in-process at hindi nangangailangan ng pagpapatunay) ay iniuulat bilang `$0 API cost (runs on
this machine)`.

**Magsanay nang hindi niloloko ang sarili.** Ibinabalik ng `get_training_guardrails` ang mga panuntunang
nakuha mula sa mga totoong nasukat na kabiguan. Pinatatakbo ng labinlimang tool na `forge_*` ang
[NMT Forge](/docs/agents/training) nang paisa-isang binabantayang
hakbang — una ang `forge_status` at pagkatapos ng bawat hakbang (pinapangalanan nito ang susunod na
command at ang tool na nagpapatakbo nito), `forge_preflight` upang makita kung aling mga gate ang
tatamaan ng isang command bago ito tumanggi, `forge_prereg_template` at `forge_prereg`
upang isulat ang mga hula bago pa magkaroon ng anumang marka sa pagsubok (at bago ang anumang
benchmark sa test set: hinaharangan ng isang scoring read ang isang preregistration sa bandang huli),
`forge_export` upang markahan ang test set nang isang beses at i-package ang sinanay na modelo,
`forge_compare` upang i-A/B test ang dalawang modelo kasama ang babala ng near-twin ng bawat isa sa tabi
ng nagwagi, at
`forge_prereg_verdict` upang itala ang sariling hatol ng user sa isang hulang hindi
mahusgahan ng forge (isang saklaw ng malayang teksto) — ipinapakita bilang hatol ng tao, kailanman ay hindi bilang isang
nakalkula. Inililista ng `forge_status` ang bawat sinanay na run kasama ang dev score nito at
sinasabi kung kailan saturated ang isang dev set (isang perpektong dev score na walang mapagpipilian para sa
pagpili ng checkpoint). Kapag naglagay ang eval harness ng babala
sa isang test score (halimbawa, isang halos hindi nagbabagong output: iilang output
ang ibinibigay para sa bawat source sentence), dinadala ito ng `forge_export`, `forge_status`,
`forge_compare`, at `forge_lint` sa sariling mga salita ng harness, at ang isang
pangunahing babala ang nauuna sa susunod na hakbang: kailanman ay hindi binabanggit ang marka nang wala
ito. Ang isang pagtanggi ay nagbabalik
kalakip ang kung ano ang naging mali, kung bakit ito mahalaga, at ang solusyon. Dalawang hakbang ang tumatagal nang lampas sa anumang tawag ng tool
at tumatakbo sa terminal sa halip: pagsasanay (`nmt-forge run`) at pag-serve sa
na-export na modelo (`nmt-forge serve`, na naglalagay nito sa likod ng isang lokal na endpoint na
magagamit ng `translate` at ng CLI).

### Mga Argument

Kinakailangan ang `name` at opsyonal ang `name?`. Bawat tool na tumatanggap ng isang
wika ay tumatanggap din nito bilang `language`: ang kahulugan ng "`code` o `language`" ay gumagana ang alinmang
pangalan, at isa ang ipapasa ninyo. Patuloy na gagana ang mga orihinal na pangalan.

| Tool | Mga Argument |
|---|---|
| `search_languages` | `query` o `language`, `limit?` |
| `language_overview` | `code` o `language`, `source?` |
| `get_language` | `code` o `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (kahit isa man lang sa tatlong ito), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` o `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | wala |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` o `priority?` (isa sa mga ito) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (isang gettext msgctxt: isa para sa bawat teksto, o isa bawat teksto), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | isang mode: `budget?` o `top?` (queue), `item_id?`, o `corpus?` kasama ang `model?` (kasama ang `method_dir`, ang modelong nilo-load ng plugin), `method?` o `method_dir?` (isang method plugin directory; ang `local-model` ay nangangailangan ng `model` — wala itong default), `allow_model_pair_mismatch?` (`local-model`: magpatakbo ng OPUS-MT pair model na nagpapangalan ng isa pang pares, bilang kaugnay na wika na baseline), `attest_local_transport?` (isang MT engine o isang plugin; kailanman ay hindi kailangan para sa `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (mga pagtakbo ng LLM: ang ISO 15924 script kung saan dapat isulat ang output, tulad ng `Cans` o `Latn`; sinasabi ng plano kung higit sa isa ang nakalista sa card ng target), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` at `skip_eval_standard?` (mga pagtakbo ng item at corpus: magmarka nang wala ang FST o ang mga eval-standard na sukatan, minarkahang hindi nakalkula), `comet?` (kailanganin ang COMET: tinatanggihan ang run habang hindi ito naka-install), `metricx?` kasama ang `metricx_model?`, at `fuse?` (mga pagtakbo ng item at corpus: ang opt-in na MetricX-24 at FUSE-style comparator ng harness, tinatanggihan habang hindi naka-install); pagkatapos ay `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (kasama ang totoong paglalathala: ang mga eksaktong salitang ipiniprint ng plano), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (ang `*_report.json` ng isang tapos na run), `scores_only?`, `redact_coaching?`, `anonymous?` (read-only: walang `confirm`, hindi ito maaaring maglathala) |
| `publish_report` | `report` (ang `*_report.json` ng isang tapos na run), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (ang mga eksaktong salitang ipiniprint ng preview) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (ang command na susuriin), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` o `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` o `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (default `data/split`, ang path na binabasa ng config.json ng `forge_init`), `dev?`, `register?` (isang unlapi sa pangalan, o `true` para sa `project`), `allow_rotate?`, `near_dupe?` (isang threshold ng Jaccard tulad ng 0.6, kapag inirerekomenda ng forge ang near-duplicate carve), `max_group?` (kasama ang `near_dupe`: ang pinakamalaking grupo ng near-duplicate), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (kasama ang sarili nitong `clean_to`, hal. `corpus.notwins.jsonl` — kailanman ay hindi ang file ng lahat ng data), `companion_config?` (kasama ang `drop_test_twins`: kung saan mapupunta ang config ng twin-free na modelo; default `config-notwins.json`), `overwrite?` (palitan ang isang `clean_to` file na ginagamit ng isang config, isang run, isang split o isa pang audit — tinatanggihan kung wala ito), `full_indices?` (bawat listahan ng numero ng hilera nang buo; ayon sa default ang mahahabang listahan ay nagbabalik bilang `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (i-pin ito sa isang run), `allow_after_reads?` (para lamang sa mga hulang isinulat bago ang mga scored read ng set), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (ang numero nito, o ang sariling id nito), `verdict` (`held` o `missed`), `by` (kung sino ang humatol), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (ang run manifest ng bawat modelo: sinusuri ang data ng pagsasanay nito para sa mga near-twin), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Halimbawa, ang `get_metric_reliability { "language": "crk" }` at
`get_metric_reliability { "target": "crk" }` ay nagtatanong ng parehong tanong.

### Pagsasalin gamit ang modelong inyong ipinakalat

Nagpi-print ang `nmt-forge serve` ng dalawang address para sa modelong inihahatid nito. Ituro
ang `translate` sa alinman sa dalawa:

| Argument | Gamitin ito sa | Halimbawa |
|---|---|---|
| `base_url` | `method: "local"` — isang OpenAI-compatible na server (gayundin ang `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — ang champollion API contract | `http://127.0.0.1:8378/translate` |
| `model` | Mga LLM engine lamang; tinatanggihan para sa mga machine-translation API, na walang ganito | `llama3.1` |
| `project_dir` | anumang pamamaraan — gamitin ang Translation Memory ng proyektong iyon | `~/my-app` |

Hindi nangangailangan ng key ang isang server sa sarili ninyong makina. Binabasa ng isang remote na endpoint ng `api` ang
key nito mula sa `CHAMPOLLION_API_KEY` sa environment ng server. Tinatanggihan ng tool
ang isang argument na hindi nito alam, ayon sa pangalan, sa halip na balewalain ito, upang ang isang maling baybay na
argument ay hindi tahimik na makapagpadala ng inyong teksto sa ibang modelo.

### Kung saan itinatago ng server ang state nito

Nasa `~/.champollion-mcp/` ang lahat (itakda ang `CHAMPOLLION_MCP_HOME` upang ilipat
ito):

- Ang **Translation Memory ng `translate`** ay sarili nitong file,
  `.champollion/tm.json` sa folder na iyon. Hiwalay ito sa `.champollion/tm.json` ng
  anumang proyekto. Ipasa ang `project_dir` upang gamitin sa halip ang file ng isang proyekto,
  ang ginagamit ng `champollion sync` doon.
- Ang **mga job ng `run_benchmark`** ay nakatala sa `jobs.json`, na nagpapanatili ng
  pinakabagong 50. Ang bawat job ay may folder sa `jobs/` kasama ang output nito at, para sa isang
  queue item o isang nakarehistrong corpus, ang mga resulta ng harness. Ang isang run sa pansubok na
  file na inyong hawak ay nagsusulat ng mga resulta at cache nito sa tabi ng file na iyon, sa
  `results/` — maliban sa isang file sa isang folder na minarkahan ng `mt-eval contest prepare`
  na maaaring ilabas, na ang run ay nagsusulat sa `runs/` folder ng contest. Bawat
  ganitong run ay nagkakaroon ng sarili nitong `mcp-run-<id>/` folder doon, at ipiniprint ng `get_run_status`
  ang command na `mt-eval compare` para sa lahat ng mga ito
  (`results/mcp-run-*/*_report.json`).
  Isinusulat ng mga queue run ang kanilang mga ulat sa `eval/logs/harness/queue/` sa ilalim ng
  working folder ng server, tulad ng lagi nang ginagawa ng harness.

:::note[May hangganan ang paggastos ayon sa disenyo]
Tinatanggihan ng `run_benchmark` ang **isang queue run na walang hangganan.** Dapat kayong magpasa ng eksaktong isang
hangganan — `budget`, `top`, o isang partikular na `item_id`. Walang tawag na "patakbuhin lang ang
queue", dahil kung hindi ay maaaring gumastos nang walang limitasyon ang isang agent na hindi nakakaunawa sa queue.
:::

## Bersyon ng protocol

Ang transport ay **stdio lamang** — isang proseso ng server bawat agent.

Ginawa ng [rebisyong 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) ng MCP
na stateless ang protocol ayon sa default, anupat inalis ang handshake na `initialize` at
ang header na `Mcp-Session-Id`. Hindi apektado ang server na ito sa disenyo: wala itong ginagamit
sa mga deprecated na kakayahan (Roots, Sampling, Logging), kailanman ay hindi gumamit ng lumang
HTTP+SSE transport, at sumusunod na sa bagong gabay para sa cross-call state —
gumagawa ang `run_benchmark` ng isang malinaw na job handle na ibinabalik ng modelo, sa halip
na umasa sa isang transport session.

**Hindi** pa ito naia-upgrade sa bagong rebisyon, dahil wala pang nai-publish
na TypeScript SDK na sumusuporta rito. Tingnan ang [README ng
server](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) para
sa buong posisyon.

## Mga machine-readable na endpoint

Hindi kailangan ng MCP client para sa mga ito:

| Endpoint | Ano ito |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | Ang [pangunahing pinto para sa agent](/for-agents), bilang raw markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Ang piniling index ng site na ito |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Bawat na-index na pahina, naka-inline |
| [`/queue.json`](https://champollion.dev/queue.json) | Ang buong benchmark queue |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Mga nangungunang queue item |
| [`/registry.json`](https://champollion.dev/registry.json) | Ang registry ng corpus |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Ang nasukat na language graph |

## Susunod

- [Pagpapatakbo ng mga rail sa MCP](/docs/agents/mcp) — ang rails profile, nang paisa-isang hakbang
- [Ang operating contract](/docs/agents/contract) — ang mga panuntunang sinusunod ng isang agent
- [Gabay sa Agent — pagbuo at pag-benchmark](/docs/agents/measurement)
- [Gabay sa Agent — pagsasalin gamit ang CLI](/docs/agents/serving)
- [Magsumite ng Paraan](/docs/network/getting-started/submit-a-method)
