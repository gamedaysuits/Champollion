---
title: "MCP Server — ang pintuan para sa agent"
sidebar_label: "MCP Server"
description: "Ikonekta ang isang AI agent sa Champollion sa pamamagitan ng Model Context Protocol: 34 na tool para sa paghahanap ng mga wika, pag-browse sa benchmark queue at corpus registry, pagpapatakbo ng mga evaluation, pagsasanay at pag-export ng mga modelo, at pagsasalin — pati na rin kung alin mismo ang nangangailangan ng higit pa sa isang npx install."
---

# MCP Server — ang pintuan para sa mga agent

Inilalantad ng `champollion-mcp-server` ang Champollion sa mga AI agent sa pamamagitan ng [Model
Context Protocol](https://modelcontextprotocol.io). Kung kayo ay isang agent, o kayo
ay nagkokonekta nito, ito ang lagusan: **34 na tool, 3 resource, at 4 na prompt**
sa stdio.

Ang lahat ng narito ay maaari ring ma-access bilang plain HTTP — tingnan ang [Mga machine-readable endpoint](#machine-readable-endpoints) — ngunit ang MCP server ang tanging surface na nagpapahintulot sa isang agent na *kumilos* (magsalin, magpatakbo ng benchmark, mag-train ng model) sa halip na magbasa lamang.

## I-install

```bash
npx -y champollion-mcp-server
```

Pagkatapos ay i-register ito sa inyong client. Para sa Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Para sa mga client na naka-configure sa pamamagitan ng file (Claude Desktop, Cursor, Antigravity), idagdag ang:

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

## Basahin ito bago kayo umasa rito

**Labing-apat sa 34 na tool ay gumagana mula sa payak na pag-install ng `npx`, at gumagana ang `translate`
kapag mayroon na itong engine. Ang iba pang labinsiyam ay nangangailangan ng mga Python package na hindi
at hindi kayang isama ng npm package.** Hindi pumapalya nang tahimik ang mga ito — bawat isa ay nagbabalik ng
aksyunableng error na nagpapangalan sa kung ano ang nawawala — ngunit dapat ninyong malaman ang kabuuang anyo bago
kayo magplano kaugnay nito.

| Mga Tool | Gumagana ba pagkatapos ng `npx`? | Ano pa ang kailangan ng mga ito |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Oo** — read-only, inihahatid mula sa mga pampublikong endpoint | wala |
| `translate` | **Oo**, kapag may engine | isang API key para sa engine na inyong pipiliin — o wala, gamit ang method na `local` at isang model server sa inyong sariling makina |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | Hindi | ang eval harness — `pipx install mt-eval-harness` |
| ang labinlimang tool na `forge_*` | Hindi | NMT Forge 0.2.0 o mas bago — `python3 -m pip install nmt-forge` (idagdag ang `'nmt-forge[hf]'` upang magsanay at mag-serve). Kasama na nito ang eval harness at kusang naghahanap ng mga language card; hindi kailangan ng clone |

Hindi kailangan ang clone ng repository para sa alinman dito.

## Ano ang ginagawa ng mga tool

**I-browse at alamin ang gastos ng trabaho.** Ang `list_queue` at `get_queue_item` ay naglalakad sa open benchmark queue — ang naka-rank na listahan ng mga sukat na higit na magpapabuti sa mapa. Ang `estimate_cost` ay nagpepresyo ng isang set ng mga run bago kayo gumastos ng anuman.

**Maghanap ng mga impormasyon.** Naghahanap ang `search_languages` sa mga language card ayon sa pangalan,
code, pamilya, o rehiyon, at nagpapasensya sa mga maling baybay. Sinasabi rin ng bawat resulta kung saan
sinasalita ang wika (mga bansa, isang punto sa mapa, macroarea) at ang iba pang mga
pangalan nito — mga katotohanan lamang kung saan may binabanggit na pinagmulan ang card nito, bawat isa ay kasama ang pinagmulang iyon, upang
mapagbukod ang mga wikang may magkakatulad na pangalan. Ang isang lokasyong walang pinagmulan ay
hindi kailanman ipinapakita; sinasabi ito sa linya at sa halip ay ini-link ang talaan ng Glottolog ng wika. Ang mga card na pinunan mula sa mga nai-publish na card table ng champollion.dev (sa isang
pag-install ng npm, bawat wika sa labas ng kasamang core set) ay wala pang mga
pinagmulan bawat field — darating ang mga ito sa susunod na pag-upload ng mga table — kaya ang mga
linyang iyon ay naglalaman ng link sa Glottolog sa halip na lokasyon. Ang `language_overview` ay ang
isang-pahinang panimulang punto para sa pagbuo para sa isang wika: kung ano ang umiiral, kung ano ang maaaring
patakbuhin, at ang mga susunod na hakbang. Ibinabalik ng `get_language` ang buong binanggit na card.
Inililista ng `list_corpora` ang mga nakarehistrong evaluation
corpora para sa isang pares ng wika o benchmark family — metadata lamang (laki,
lisensya, antas ng kontaminasyon, at kung maaari itong kunin ng harness, nangangailangan ng
access token, o hawak ito sa quarantine); hindi kailanman ibinabalik ang nilalaman ng corpus,
at ang isang pares na ang lahat ng corpora ay naka-quarantine ay hayagang nagsasabi nito sa halip na magmukhang
hindi suportado. Binabasa ng `get_results` at `get_run_card` ang mga may-iskor na run mula
sa pampublikong leaderboard. Sinasagot ng `get_metric_reliability` ang tanong na madalas
ipagkamali ng karamihan sa mga agent — *aling metric ang dapat kong pagkatiwalaan para sa target language na ito* —
mula sa mga ugnayan sa mga paghuhusga ng tao bawat pamilya ng wika. Ipinapakita ng `list_contests`
at `get_contest` ang mga paligsahan at ang kanilang mga idineklarang tuntunin; ang pagsali sa isa ay isang
hakbang sa CLI na may pahintulot ng tao, hindi kailanman isang tool.

**Kumilos.** Pinatatakbo ng `translate` ang teksto sa nasubukang pipeline, gamit ang Translation
Memory (walang bayad ang mga pag-uulit) at isang deterministikong quality gate. Pinapangalanan ng bawat sagot
ang engine na aktwal na tumakbo, kasama ang model at endpoint nito kung mayroon.
Sinisimulan ng `run_benchmark` ang isang pagsusuri at nagbabalik ng isang **job id kaagad**,
dahil ang mga totoong run ay mas matagal kaysa sa anumang client timeout; i-poll ninyo ang `get_run_status` gamit
ang id na iyon. Nananatili ang isang job kahit i-restart ang server: nagpapatuloy ang run, at
ang pag-poll sa parehong id pagkatapos ay nagbabalik pa rin ng status at mga resulta nito. Walang
inilalathala maliban kung ipapasa ninyo ang `publish: true`; sinasabi ng plano kung ano ang
isasapubliko — bawat hilera kasama ang teksto ng pangungusap nito, o mga iskor lamang; ang prompt, o ang
hash lamang nito; at kung saan — at ang isang totoong paglathala ay nangangailangan ng `publish_ack` sa eksaktong
mga salitang ibinibigay ng plano, upang makita muna ito ng gumagamit. Ang isang run na ginawa nang wala ito
ay maaaring ilathala sa ibang pagkakataon, sa ilalim ng parehong gate. Read-only ang `preview_publish`:
ipinapakita nito ang sariling publish preview ng harness, ang mga eksaktong salita at ang eksaktong
tawag sa `publish_report` na maglalathala nito, at hindi ito maaaring maglathala. Taglay
nito ang MCP annotation na `readOnlyHint: true`, kaya ang isang agent host na nagtatanong
bago ang bawat pagsusulat ay maaaring magpahintulot dito nang kusa. Isinasagawa ng `publish_report` ang pagsusulat
(naka-annotate bilang `destructiveHint` at `openWorldHint`), at itinatago ng `scores_only`
ang teksto ng pangungusap. Nagsisimula rin ang bawat plano sa
`EVAL PACK:` status ng target language — `missing` (kasama ang command na
nag-i-install nito), `ready`, o `none needed` — at pinapangalanan ang lisensya ng corpus at ang
`do_not_train` term nito, dahil ipinapasa ng run ang `--yes`. Ang nawawalang FST (ang
analyzer o ang pyhfst runtime nito) ay hindi kailanman nagpapatigil sa run: nagpapatuloy ito, at minamarkahan ng run
card ang pagtanggap ng FST bilang hindi kinalkula. Anumang iba pang nawawalang bahagi ay nagpapatigil sa run
bago ito magsalin. Nag-iiskor ang `skip_fst` at `skip_eval_standard` nang wala ang mga
bahaging iyon, at minamarkahan ng run card kung ano ang iniwan. Sinasabi rin ng plano kung
kakalkulahin ang COMET (kinakalkula ito ng harness tuwing naka-install ang `unbabel-comet`;
hinihiling ng `comet: true` na kailanganin ito ng run), at humihiling ang `metricx` at `fuse`
ng opt-in na MetricX-24 at FUSE-style comparator ng harness. Para sa bawat
isa, sinasabi ng plano, mula sa harness, kung ito ay naka-install, kung ano ang dapat i-install
at kung ano ang dina-download nito. Ang isang kumpirmadong run na humihiling ng metric na hindi kayang
kalkulahin ng harness ay tinatanggihan sa halip na patakbuhin nang wala ito. Sinasabi ng mga linyang `Results:`
at `Cache:` ng plano kung saan mapupunta ang log, ulat, at translation cache ng run.
Ang isang pansubok na file sa loob ng isang folder na minarkahan ng `mt-eval contest prepare` bilang mailalabas
(ang `public/` ng isang contest) ay tumatakbo sa `runs/` folder ng contest sa halip, kaya
walang anumang isinulat ng isang run ang inilalabas kasama nito. Ang isang model sa inyong sariling
makina (isang lokal na server, o `method: "local-model"`, na pinapatakbo ng harness
nang in-process at hindi nangangailangan ng pagpapatunay) ay iniuulat bilang `$0 API cost (runs on
this machine)`.

**Magsanay nang hindi niloloko ang sarili.** Ibinabalik ng `get_training_guardrails` ang mga panuntunang
nakuha mula sa totoong mga nasukat na kabiguan. Pinapatakbo ng labinlimang tool na `forge_*` ang
[NMT Forge](/docs/network/getting-started/training-honestly) nang paisa-isang binabantayang hakbang
sa bawat pagkakataon — una ang `forge_status` at pagkatapos ng bawat hakbang (pinapangalanan nito ang susunod
na command at ang tool na nagpapatakbo nito), `forge_preflight` upang makita kung aling mga gate ang
tatamaan ng isang command bago ito tumanggi, `forge_prereg_template` at `forge_prereg`
upang itala ang mga hula bago pa man magkaroon ng anumang test score (at bago ang anumang
benchmark sa test set: hinaharang ng pagbasa ng pag-iskor ang susunod na preregistration),
`forge_export` upang i-iskor ang test set nang isang beses at i-package ang sinanay na model,
`forge_compare` upang i-A/B ang dalawang model kasama ang caveat ng bawat isa na may near-twin sa tabi
ng nagwagi, at
`forge_prereg_verdict` upang itala ang sariling hatol ng gumagamit sa isang hulang hindi
mahusgahan ng forge (isang free-text range) — ipinapakita bilang hatol ng tao, hindi kailanman bilang
kinalkula. Inililista ng `forge_status` ang bawat sinanay na run kasama ang dev score nito at
sinasabi kung kailan saturated ang isang dev set (isang perpektong dev score na walang mapagpipilian
ang checkpoint selection). Kapag naglagay ang eval harness ng caveat
sa isang test score (halimbawa, isang halos pare-parehong output: iilang output lamang
ang ibinigay para sa bawat pinagmulang pangungusap), dinadala ito ng `forge_export`, `forge_status`,
`forge_compare` at `forge_lint` sa sariling mga salita ng harness, at ang isang
pangunahin ay nauuna sa susunod na hakbang: hindi kailanman binabanggit ang iskor nang wala
ito. Ang isang pagtanggi ay nagbabalik
ng kung ano ang nagkamali, kung bakit ito mahalaga, at ang lunas. Dalawang hakbang ang lumalagpas sa tagal ng anumang tawag sa tool
at sa halip ay tumatakbo sa terminal: pagsasanay (`nmt-forge run`) at pag-serve sa
na-export na model (`nmt-forge serve`, na naglalagay dito sa likod ng isang lokal na endpoint na
magagamit ng `translate` at ng CLI).

### Mga Argument

Kinakailangan ang `name` at opsyonal ang `name?`. Ang bawat tool na tumatanggap ng isang
wika ay tumatanggap din nito bilang `language`: ang ibig sabihin ng "`code` o `language`" ay gumagana
ang alinmang pangalan, at isa lamang ang inyong ipapasa. Patuloy na gumagana ang mga orihinal na pangalan.

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
| `run_benchmark` | isang mode: `budget?` o `top?` (queue), `item_id?`, o `corpus?` na may `model?` (kasama ang `method_dir`, ang model na nilo-load ng plugin), `method?` o `method_dir?` (isang direktoryo ng method plugin; kailangan ng `local-model` ang `model` — wala itong default), `allow_model_pair_mismatch?` (`local-model`: magpatakbo ng OPUS-MT pair model na nagpapangalan sa ibang pares, bilang baseline para sa kaugnay na wika), `attest_local_transport?` (isang MT engine o isang plugin; hindi kailanman kailangan para sa `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (mga LLM run: ang ISO 15924 script kung saan dapat isulat ang output, tulad ng `Cans` o `Latn`; sinasabi ng plano kung higit sa isa ang nakalista sa card ng target), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` at `skip_eval_standard?` (mga item at corpus run: mag-iskor nang wala ang FST o ang eval-standard metrics, na minarkahang hindi kinalkula), `comet?` (hilingin ang COMET: tatanggihan ang run habang hindi pa ito naka-install), `metricx?` na may `metricx_model?`, at `fuse?` (mga item at corpus run: ang opt-in na MetricX-24 at FUSE-style comparator ng harness, na tatanggihan habang hindi pa naka-install); pagkatapos ay `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (sa isang totoong paglathala: ang mga eksaktong salitang ipiniprint ng plano), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (ang `*_report.json` ng isang natapos na run), `scores_only?`, `redact_coaching?`, `anonymous?` (read-only: walang `confirm`, hindi ito maaaring maglathala) |
| `publish_report` | `report` (ang `*_report.json` ng isang natapos na run), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (ang mga eksaktong salitang ipiniprint ng preview) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (ang command na susuriin), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` o `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` o `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (default `data/split`, ang path na binabasa ng config.json ng `forge_init`), `dev?`, `register?` (isang prefix ng pangalan, o `true` para sa `project`), `allow_rotate?`, `near_dupe?` (isang Jaccard threshold tulad ng 0.6, kapag inirerekomenda ng forge ang pagbawas ng near-duplicate), `max_group?` (kasama ang `near_dupe`: ang pinakamalaking grupo ng near-duplicate), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (kasama ang sarili nitong `clean_to`, hal. `corpus.notwins.jsonl` — hindi kailanman ang all-data file), `companion_config?` (kasama ang `drop_test_twins`: kung saan mapupunta ang config ng model na walang twin; default `config-notwins.json`), `overwrite?` (palitan ang isang `clean_to` file na ginagamit ng isang config, run, split, o isa pang audit — tatanggihan kung wala ito), `full_indices?` (bawat listahan ng row-number nang buo; ayon sa default, ang mahahabang listahan ay nagbabalik bilang `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (i-pin ito sa isang run), `allow_after_reads?` (para lamang sa mga hulang naisulat bago ang mga may-iskor na pagbasa ng set), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (ang numero nito, o ang sarili nitong id), `verdict` (`held` o `missed`), `by` (kung sino ang humatol), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (ang run manifest ng bawat model: sinusuri ang training data nito para sa mga near-twin), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Halimbawa, nagtatanong ang `get_metric_reliability { "language": "crk" }` at
`get_metric_reliability { "target": "crk" }` ng parehong tanong.

### Pagsasalin gamit ang model na inyong na-deploy

Nagpi-print ang `nmt-forge serve` ng dalawang address para sa model na sini-serve nito. Ituro
ang `translate` sa alinman sa dalawa:

| Argument | Gamitin ito sa | Halimbawa |
|---|---|---|
| `base_url` | `method: "local"` — isang OpenAI-compatible na server (`"openai"` din) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — ang champollion API contract | `http://127.0.0.1:8378/translate` |
| `model` | Mga LLM engine lamang; tinatanggihan para sa mga machine-translation API, na walang ganoon | `llama3.1` |
| `project_dir` | anumang method — gamitin ang Translation Memory ng proyektong iyon | `~/my-app` |

Ang isang server sa inyong sariling makina ay hindi nangangailangan ng key. Binabasa ng isang malayuang endpoint ng `api` ang
key nito mula sa `CHAMPOLLION_API_KEY` sa environment ng server. Tinatanggihan ng tool
ang isang argument na hindi nito alam, ayon sa pangalan, sa halip na balewalain ito, upang ang maling naibaybay na
argument ay hindi tahimik na magpadala ng inyong teksto sa ibang model.

### Kung saan itinatago ng server ang state nito

Nakalagay ang lahat sa `~/.champollion-mcp/` (itakda ang `CHAMPOLLION_MCP_HOME` upang ilipat
ito):

- Ang **Translation Memory ng `translate`** ay sarili nitong file,
  ang `.champollion/tm.json` sa folder na iyon. Nakahiwalay ito sa `.champollion/tm.json`
  ng anumang proyekto. Ipasa ang `project_dir` upang gamitin sa halip ang file ng isang proyekto,
  ang ginagamit doon ng `champollion sync`.
- Ang mga **job ng `run_benchmark`** ay naitatala sa `jobs.json`, na nagpapanatili ng
  pinakabagong 50. Ang bawat job ay may folder sa `jobs/` kasama ang output nito at, para sa isang
  item sa queue o isang nakarehistrong corpus, ang mga resulta ng harness. Ang isang run sa isang pansubok na
  file na inyong hawak ay nagsusulat ng mga resulta at cache nito sa tabi ng file na iyon, sa
  `results/` — maliban sa isang file sa isang folder na minarkahan ng `mt-eval contest prepare`
  bilang mailalabas, na ang run ay nagsusulat sa `runs/` folder ng contest.
  Isinusulat ng mga queue run ang kanilang mga ulat sa `eval/logs/harness/queue/` sa ilalim ng
  working folder ng server, tulad ng lagi nang ginagawa ng harness.

:::note[Ang paggastos ay may limitasyon ayon sa disenyo]
Ang `run_benchmark` ay **tumatanggi sa isang walang limitasyong queue run.** Dapat kayong magpasa ng eksaktong isang limitasyon — `budget`, `top`, o isang partikular na `item_id`. Walang "patakbuhin lang ang queue" na tawag, dahil ang isang agent na hindi nakakaunawa sa queue ay maaaring gumastos nang walang limitasyon.
:::

## Bersyon ng protocol

Ang transport ay **stdio lamang** — isang server process bawat agent.

Ginawa ng [2026-07-28 revision](https://blog.modelcontextprotocol.io/posts/2026-07-28/) ng MCP na stateless ang protocol bilang default, na nag-retire sa `initialize` handshake at sa `Mcp-Session-Id` header. Ang server na ito ay hindi apektado sa disenyo: hindi ito gumagamit ng anuman sa mga deprecated na kakayahan (Roots, Sampling, Logging), hindi kailanman gumamit ng legacy na HTTP+SSE transport, at sumusunod na sa bagong gabay para sa cross-call state — ang `run_benchmark` ay gumagawa ng isang tahasang job handle na ibinabalik ng model, sa halip na umasa sa isang transport session.

**Hindi** pa ito na-upgrade sa bagong revision, dahil wala pang na-publish na TypeScript SDK na gumagamit nito. Tingnan ang [server README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) para sa buong posisyon.

## Mga machine-readable endpoint

Walang MCP client na kailangan para sa mga ito:

| Endpoint | Ano ito |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | Ang [agent front door](/for-agents), bilang raw markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Ang curated index ng site na ito |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Bawat naka-index na pahina, inlined |
| [`/queue.json`](https://champollion.dev/queue.json) | Ang buong benchmark queue |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Mga nangungunang item sa queue |
| [`/registry.json`](https://champollion.dev/registry.json) | Ang corpus registry |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Ang nasukat na language graph |

## Susunod

- [Gabay sa Agent — pagbuo at pag-benchmark](/docs/network/getting-started/agent-guide)
- [Gabay sa Agent — pagsasalin gamit ang CLI](/docs/guides/agent-guide)
- [Magsumite ng Paraan](/docs/network/getting-started/submit-a-method)
