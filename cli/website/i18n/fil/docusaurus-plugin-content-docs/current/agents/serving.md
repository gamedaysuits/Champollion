---
title: "Pag-serve at pag-deploy"
slug: /agents/serving
description: "Paganahin ang isang nasukat na modelo: ang deployment/1 file na isinusulat ng nmt-forge export, ang mt-eval translate at serve, ang nmt-forge serve at ang try page nito, ang kontrata ng service-api/1 /translate, ang champollion connect, at ang champollion sync na pinatatakbo ng isang agent — kasama ang kung ano ang maaari at hindi maaaring gawin ng local-only na output."
---

# Pag-serve at pag-deploy

**Ang pag-deploy ay ang pipeline ng pagsukat sa input na source-only.** Isinasaad ng isang
deployment/1 file ang method, ang modelo nito, ang mga gate nito, at ang pares. Ang
parehong file ay sinusuri sa isang test set, pinatatakbo sa isang file, at isinise-serve, kaya kung ano ang
sinukat ay siyang inilalabas. Ang pahinang ito ang bahagi ng agent para sa
[Paganahin ito](/docs/put-it-to-work).

Sa kabuuan: ang isang modelong natuto mula sa mga pangungusap na minarkahang local-only ay maaaring umulit
sa mga ito, kaya **local-only din ang output nito**. Pinapanatili ng bawat tool sa ibaba ang output na iyon
sa computer na ito maliban kung sumang-ayon ang mga may-hawak ng data sa iba, at
itinatala ng `--holders-agreed-by` kung sino ang sumang-ayon. **Tandaan.** Ipasa lamang ang flag na iyon kalakip
ang pangalang ibinigay sa inyo ng tao, pagkatapos nilang sabihin na sumang-ayon ang mga may-hawak.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. Kinakailangan: `id`,
`pair` (`source`, `target`, opsyonal na `target_script`), `method` (`method`,
opsyonal na `model`). Opsyonal: `gates` (isang gate-chain/1 file) at `serve`
(`host`, default na `127.0.0.1`; `port`). Ang mga path ay relative sa root ng proyekto,
kung saan pinatatakbo ng rails ang mga command. Wala itong binabanggit na score.

**Kung sino ang sumusulat nito.** Ang `nmt-forge export`, kapag ang export ay nasa loob ng isang proyekto
ng rails (may `champollion.project.json` sa itaas nito), ay nagsusulat ng
`deploy/<name>.json` — ang `<name>` ay `--name` sa kebab case, kung hindi ay
`nmt-forge-<run>`:

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

Wala itong isinusulat (at sinasabing `no deployment file: …`) kapag ang export ay nasa labas
ng isang proyekto ng rails, kapag ang modelo ay pinili sa ilalim ng isang decode hook (`nmt-forge serve`
lamang ang nagpapatakbo ng mga hook ng forge), kapag walang pinangalanang pares ang config, kapag hindi
magva-validate ang dokumento, o kapag nagde-deploy na ang `deploy/<name>.json`
ng isa pang modelo (hindi kailanman pinapalitan).

**Kung sino ang nagbabasa nito.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**Mga Lock.** Gamit ang `--deployment`, tinatanggihan ng `run` at `translate` ang `--method`,
`-m`/`--model`, `--gates` at `--target-script` (*"--deployment … says the
method, its model, its gates and the target script; drop … (or change the
file)"*); tinatanggihan din ng `serve` ang `--pair`. Ang input sa ibang pares ay tinatanggihan
(`deployment <id> translates from <src>; this input is in <x>`). Ang isang
deployment na ang gate chain ay nagfo-fallback ay maaaring isalin at i-serve, ngunit hindi
masusukat: tinatanggihan ng `mt-eval run` ang isang chain na nagfo-fallback
([mga method at gate](/docs/agents/methods#gate-chains)).

## Ang laman ng isang export

Isinusulat ng `nmt-forge export <run-manifest.json> --prereg <id> --out <dir>`:

| Path | Kung ano ito |
|---|---|
| `<dir>/model/` | Ang folder na ide-deploy: mga weight at tokenizer, `forge-model.json` (kung saan ito sinanay, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, uri `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (port 8378 maliban kung `--port`), `card.commercial_ready: false`, `evidence` na may chrF++ ng test-set, ang interval nito at n |
| `<dir>/evaluation/` | Ang ebidensya ng test-set. Huwag kailanman kopyahin ito kasama ng modelo |
| `<dir>/input-words.json` | Ang mga salita sa panig ng input ng mga pangungusap sa pagsasanay, isa sa bawat isa, nakaayos nang sunod-sunod (`words`, `english`, `sentences`, `from`, at `notes` na nagpapangalan sa isang training file na hindi mabasa tulad ng pagbasa ng run dito). Katabi ng `model/`, hindi kailanman sa loob nito: ang mga ito ay mga salita mula sa data ng mga tao. Isinusulat kapag kasama sa export ang modelo at ang mga training file nito ay nasa computer na ito; kung hindi, sinasabi sa buod ng export ang `input_words.written: false` kalakip ang `why`. Binabasa ito ng `nmt-forge serve` upang pangalanan ang mga salitang hindi kailanman nakita ng modelo ([sa ibaba](#words-the-model-never-saw)) |
| `<dir>/README.md` | Kung ano ang export |

## `mt-eval translate`

Ang pipeline sa isang file, walang ini-score. Tumatanggap ang `--out` ng `.jsonl` (isang hilera bawat
segment: `id`, `source`, `output`, `error`, at kung may mga gate `gates`,
`shipped_from`, `fallback`) o `.tsv` (source, tab, output). Kung walang `--out`
isinusulat nito ang `<run id>.translations.jsonl` sa folder ng output (`-o`). Dala
ng output ang mga termino ng input — at ng modelo — sa isang sidecar ng set/1.

**Lock.** Kapag ang output ng method ay local-only (o ang fallback ng gate chain nito ay ganoon din),
tinatanggihan ang patutunguhan sa labas ng proyekto bago pa man may maisalin:
*"refusing to write …: what this method writes is local-only
(…), and that is outside … — a place the data's holders did not choose. Only
they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or
write it inside the project"*. Kalakip ang pahintulot, itinatala ng sidecar ang
`holders_agreed: {by, date}`; nananatiling local-only ang file para sa bawat tool.

Ipiniprint ng `--json` ang `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` at `output_gates`. Exit 1 kapag nabigo ang bawat hilera. Tinatanggihan
ang `--publish`: walang score.

## `mt-eval serve`

| | |
|---|---|
| Default na address | `127.0.0.1:8379` (`--host`, `--port`, o ang block na `serve` ng deployment) |
| Kung ano ang isinise-serve nito | Method lamang na tumatakbo sa prosesong ito: `lexicon`, `local-model`, o isang plugin na ang method.json ay nagdedeklara ng `dependency_class` `S` o `O`. Tinatanggihan ang isang LLM o hosted engine |
| Token | `MT_EVAL_SERVE_TOKEN`, mula sa environment lamang. Kinakailangan upang makinig sa anumang address bukod sa `127.0.0.1`, `::1` o `localhost`; kapag nakatakda, kinakailangan sa bawat `POST` (maging sa loopback). Hindi ito kailanman kailangan ng `GET /health` |
| Mga limitasyon | 1,000,000-byte na body, 500 key, 20,000 character bawat string — ang labis sa alinman ay `413` |
| Mga Gate | `--gates <chain>` (o ang `gates` ng deployment). Ang bawat plugin ng gate ay dapat humusga nang walang reference, kundi ay hindi ito magsisimula. Pinapayagan ang fallback dito, at dapat tumakbo sa prosesong ito |

**Lock — labas ng loopback.** Kung walang token: *"refusing to listen on … without a
token — anyone who can reach the port could use the method"*. Kung may local-only
na output at walang pahintulot: *"refusing to serve on …: what this method writes is
local-only (…), and an address other machines can reach sends it off this
one. Only the data's holders can agree to that — ask them; if they do:
--holders-agreed-by "<who agreed>" (reported on /health), or keep --host
127.0.0.1"*. Local-only ang output kapag sinasabi ito ng sidecar ng isang diksiyonaryo (o
hindi mabasa), o itinatala ng `forge-model.json` ng folder ng modelo ang mga local-only
na termino sa pagsasanay o walang itinatala; iniuulat ito bilang hindi alam (`null`) para sa
isang plugin o folder ng modelo na walang `forge-model.json`.

Sumasagot ang `/health` sa `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (sa prosesong ito — walang ipinapadala saanman), `scored`
(wala), `output_gates` at `gates` (id ng chain, fingerprint, mga gate, fallback),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (ang repository) at `version`.

Kung may mga gate, bumabalik ang tinanggihang segment ayon sa sinasabi ng gate nito: `drop` — ang key
sa ilalim ng `errors`; `keep-source` — ang source; `flag` — ang output, ang key
na pinangalanan sa `meta.gates.flagged`; `fallback` — ang salin ng fallback kung
tatanggapin ito ng mga gate. Kung walang mga gate, wala itong sinusuri sa anumang ibinabalik nito.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| Default na address | `127.0.0.1`, port `NMT_FORGE_SERVE_PORT` o 8378 |
| Token | `--token` o `NMT_FORGE_SERVE_TOKEN`; kinakailangan sa labas ng loopback. Kinukuha lamang ito ng `--detach` mula sa environment |
| Mga Route | `GET /` — isang try page para sa tao (walang token; humihingi ito kapag may nakatakda); `GET /health`; `POST /translate` (service-api/1); `POST /v1/chat/completions` (OpenAI-compatible); `GET /v1/models` |
| `--detach` | Nagbabalik kapag sumagot na ang `/health`; ititigil kung hindi ito sumagot sa loob ng 120 s. Tinatanggihan kapag sumasagot na ang port |
| `--no-hook` | Mag-serve nang wala ang decode hook ng run (sinasabi sa `/health` at sa `meta`) |
| `--allow-locale` | Tanggapin din ang mga locale code na ito (maaaring ulitin) |
| `--device` | `auto` (default) o `cpu`. Gamit ang `auto`, ang isang server na sinimulan habang tumatakbo ang isang training job ng parehong proyekto ay gagamit ng CPU sa halip na makihati sa GPU, at sinasabi ito ng `/health` (`device_note`) |
| Mga limitasyon | 1,000,000-byte na body, 500 key, 20,000 character bawat string, 5,000 piraso ng gawain ng modelo bawat request — ang labis sa alinman ay `413`. Hinihilingan ang modelo ng 32 piraso sa bawat pagkakataon, kaya ang isang pangungusap mula sa ibang request ay maghihintay para sa isang chunk, hindi kailanman para sa isang buong request. Ang isang request na tumatakbo pa rin pagkatapos ng 600 s ay ganap na tinatanggihan — `503`, *"send fewer pieces at a time"* — hindi kailanman sinasagot nang bahagi lamang |
| Decoding | Beam search gamit ang `num_beams` ng export kapag nagtala ang export ng `beams_applied` (gaya ng pagsukat sa modelo); greedy para sa mas lumang export. Ang ipinapadalang teksto ay ginagawang NFC (normalized), tulad ng sa training data |

**Lock.** Sa labas ng loopback, ang isang modelo na may output na local-only — sinanay sa
mga pangungusap na local-only, o walang tala kung saan ito natuto — ay tinatanggihan
nang walang `--holders-agreed-by`. Iniuulat ng `/health` ang `pair`, `accepts`,
`decode_hook`, `run`, ang mga dev at test report, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` at `output_gates`. Bawat sagot ng `/translate` mula sa isang
modelong local-only ay may dalang `meta.output_local_only: true`, at bawat
tugon ng `/v1/chat/completions` ay may dalang `meta.output_local_only` (true o false).
Kapag pinutol ng mga limitasyon sa haba ang anuman sa isang request, binibilang ng `meta.cut` nito ang
mga pangungusap na pinutol sa pagpasok (`inputs`) at ang mga salin na huminto sa
cap (`outputs`) ([pagsasanay](/docs/agents/training#the-guarded-loop)).

**Tandaan.** Ang try page ay para sa tao. Ipinapadala sila roon ng `try_translation` (MCP)
para sa isang modelong local-only; huwag kailanman tawagin ang `/translate` nang kusa upang basahin ang
output nito ([kontrata](/docs/agents/contract) §1).

### Mga salitang hindi kailanman nakita ng modelo

Ang isang pangungusap na naglalaman ng salitang hindi kailanman nakita ng modelo sa pagsasanay ay malamang
na mali ang salin, gaano man ito kahusay basahin. Sa inimbentong wikang pansubok, ang isang
isinantabing pangungusap na may content word na hindi pa nakikita ng modelo ay naisalin nang
tama nang 0 beses sa 358 (ByT5-small sa 1,600, 6,400 at 25,600 na pares sa pagsasanay),
at lumabas na tiyak na mali — matatas, totoong anyo ang bawat salita, ngunit mali ang
kahulugan — 32%, 55%, at 83% ng mga pagkakataon: habang mas magaling ang modelo, mas
kapani-paniwala ang hula. Kaya pinapangalanan ng server ang mga salitang iyon.

- Sinasabi ng **`/health`** kung kaya nito: ang `unseen_words_check` ay `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- Idinaragdag ng **`/translate`**, kapag lamang naglalaman ang request ng gayong mga salita,
  ang `meta.unseen_words` (key → ang mga salita sa teksto ng key na iyon na hindi kailanman nakita
  ng modelo, tig-isa bawat salita, nang sunod-sunod) at `meta.unseen_note`. Idinaragdag din ng **`/v1/chat/completions`**
  ang parehong bagay, na naka-key ayon sa hiniling: `SEG_<id>` bawat segment sa block
  mode, `page` para sa isang page, ang sariling mga key ng JSON object, o `text`.
- **Walang tala, sinasabi sa bawat tugon.** Binabasa ng server ang `input-words.json`
  mula sa folder sa itaas ng folder ng modelo na isinise-serve nito. Kung wala roon — isang
  export made before 2026-10-13, one made without its training files on this
  computer, o isang folder ng modelo na kinopya palayo sa export nito — sinasabi ng `meta.unseen_check`
  ng bawat tugon na hindi nito masuri, at kung bakit. I-serve ang modelo mula sa
  export, or export it again.
- Minamarkahan ng **try page** ang linya: *"Never seen in training: … — this line is
  very likely wrong, however fluent it reads."*

Ang isang salita ay magkakasunod na titik sa anumang script (pinapanatili ang mga apostrophe sa loob nito),
naka-lowercase, sa NFC. Kapag English ang panig ng input, ang payak na hulapi sa English
ay itinuturing na nakita sa alinmang ayos (nakita ang `walk` → binibilang ang `walked`; nakita
ang `walked` → binibilang ang `walk`).

## service-api/1 — ang kontrata ng `/translate`

`$schema` `https://champollion.dev/schemas/service-api/1.json`, pinanghahawakan sa
`shared/test-fixtures/framework/service-api-vectors.json` (pinapatakbo laban sa
`mt-eval serve` at `nmt-forge serve`).

- **Request** `POST /translate`: `keys` (key → source string; kinakailangan),
  opsyonal na `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` para sa teksto ng dokumento), `instructions` (key → note; ipinapadala lamang sa isang
  server na idineklarang sumusunod sa mga ito, `accepts_instructions`). Binabalewala ang field na hindi ginagamit
  ng isang server, hindi kailanman tinatanggihan.
- **Tugon:** `200` `{translations, meta}` — kinakailangan ang `meta`; idinaragdag ng `207`
  ang `errors` (key → `{message}`). Ang mga error ay `{error: {message}}`: `400` para sa isang
  request na hindi nito matanggap, `401` para sa nawawala o maling token, `404` para sa hindi kilalang
  route, `413` kapag napakalaki, `500` kapag nabigo ang method — hindi kailanman bahagyang sagot.
  (Sumasagot din ang `nmt-forge serve` ng `503` para sa isang request na lumampas sa limitasyon nitong 600 s.)
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false o null), `cost_usd`; maaaring magdagdag ng mga field ang mga server.
- Kinakailangan ng **`GET /health`** ang `status` (`ok`), `pair`, `output_gates` at
  `output_local_only`; opsyonal ang `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`.
- **Ang tuntunin:** ang isang server na ang `/health` ay nagsasabing `output_local_only: true` ay naglalagay ng
  `output_local_only: true` sa `meta` ng bawat tugon, at isinusulat lamang ng client ang
  gayong output kung saan sumang-ayon ang mga may-hawak ng data.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

Hinahanap nito ang `method.json` (ang pinangalanang file, o `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` sa
folder), inii-install ito sa `.champollion/methods/` ng app, at itinuturo ang
bawat pares nito (`<inputLocale>:<target>`) dito bilang `methodPlugin`, habang pinapanatili
ang natitira sa pares. Kailangan ng folder ng app ang `champollion.config.json`, at dapat
magsalin ang method mula sa `inputLocale` ng app.

**Lock.** Ang isang modelo na may output na local-only — nalaman mula sa
`forge-model.json` nito (ibinibilang kung nawawala ito), o mula sa `/health` ng serbisyo nito —
ay tinatanggihan nang walang `--holders-agreed-by`: kung ano ang isinusulat nito sa mga locale
file ng app ay inilalathala kasama ng app. Kalakip nito, itinatala ng bawat pares ang
`holdersAgreed: {by, date, method, what}`. Nagbabala ito, nang hindi bumabagsak, kapag
walang sumasagot sa endpoint (sinisimulan ito ng `nmt-forge serve <dir> --detach`)
o kapag hindi sumusunod ang `/health` sa service-api/1. Ipiniprint ng `--json` ang `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`.

## `champollion sync`, pinatatakbo ng isang agent

Isinasalin ng `sync` ang mga locale file ng isang app o site gamit ang mga method na
pinangalanan ng `champollion.config.json` nito. Wala itong itinatanong nang interactive.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

Ang **output ng `--json`** ay isang JSON object bawat linya. Sa stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` kalakip ang
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` at marami pa; ang dry run ay nagdaragdag ng `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) at `maxCost`. Sa stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` at
`error`.

| Exit | Kahulugan |
|---|---|
| 0 | Malinis |
| 1 | Walang tumugmang key sa pangalan ng `--redo` o `--force-keys`; mga pagkabigo nang walang naproseso; isang error |
| 2 | Pinatigil ito ng `--max-cost` bago ang anumang tawag (o hindi alam ang pagtatantya); o bahagya: may nabigo, pinigil ang mga key, nawawala ang mga anyong maramihan (plural), o may nakitang mga error ang pag-verify |

Walang ipinapadala at isinusulat ang isang dry run, hindi nagve-verify, at nag-e-exit nang 0 maliban kung
walang tumugma sa isang pinangalanang key o nagkaroon ng error. Tumatakbo ang pag-verify pagkatapos ng totoong pag-sync
maliban kung `--no-verify`.

**Lock — mga sagot na local-only.** Para sa isang method na `api`, ang isang batch na ang
`meta.output_local_only` ay `true` ay hindi isinusulat maliban kung pinangalanan ng
`holdersAgreed` ng pares ang method na iyon; sinasabi ito ng `sync` nang minsan, at pinapangalanan ang
tawag na `champollion connect … --holders-agreed-by`. Nananatiling hindi naisalin ang mga key
na iyon (o mapupunta sa fallback ng pares).

**Lock — ang method na `local`.** Ang method na `local` (isang endpoint na
OpenAI-compatible) ay nagtatanong sa `/health` ng server nang minsan. Kapag sinabi nitong
`output_local_only: true` — gaya ng ginagawa ng `nmt-forge serve` para sa isang modelong sinanay sa
mga pangungusap na local-only — walang anumang isinusulat mula sa server na iyon maliban kung pinangalanan ng
`holdersAgreed` ng pares ang `local`: *"the model at … says what it writes is
local-only … nothing from it was written"*, na sinusundan ng tawag na
`champollion connect <the model> --holders-agreed-by "<who agreed>"`. Ang isang
server na ang `/health` ay hindi sumasagot o hindi nagsasabi ng `true` (halimbawa, isang server ng Ollama o
LM Studio) ay ginagamit tulad ng dati.

**Tandaan.** Ikonekta ang isang modelo ng forge gamit ang `champollion connect` (ang route na `api`):
binabasa nito ang sariling tala ng modelo kung saan ito natuto, at itinatala
ang pahintulot ng mga may-hawak sa pares sa ilalim ng method na inilalagay nito.

**Mga salitang hindi kailanman nakita ng modelo.** Kapag pinangalanan ng isang server ng forge ang mga key sa
`meta.unseen_words`, nagbabala ang mga method na `local` at `api` kalakip ang mga key —
hindi kailanman ang teksto o ang mga salita: *"<API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys>"* (pagkatapos ay *"and <n> more"*).
Isinusulat pa rin ang mga salin; ang babala ang paraan upang malaman ng mga tao kung alin
ang susuriin ([coaching](/docs/agents/coaching)).

**Tandaan.** Ipasa ang bawat linyang `warn`. Ang mga string na isinalin ng makina ay mga draft
hangga't hindi sinusuri ng isang tagapagsalita; huwag kailanman sabihing tama ang mga ito.

## `champollion serve`

Ibang server naman: isinise-serve nito ang sariling na-configure na translation stack ng **proyekto ng app**
(method, coaching, translation memory, quality gate) sa iba pang
proyekto. Naka-default sa `127.0.0.1`, port 1822. Nangangailangan ito ng bearer token
maging sa loopback (`--token` o `CHAMPOLLION_SERVE_TOKEN`, hindi bababa sa 12
character) maliban kung `--no-auth`, na tinatanggap lamang sa isang loopback bind.
Nagsusulat ang `--emit-manifest` ng isang manifest ng method/1 na may uri na `service` para sa mga consumer.
Ang `/health` nito ay `{ok, service, version}`, hindi ang dokumento ng kalusugan ng service-api/1,
kaya nag-uulat ang `champollion connect` ng mga problema sa kalusugan para rito.

## Magbasa pa

- [Paganahin ito](/docs/put-it-to-work) — ang bersyon ng mga tao.
- [Mga method at gate](/docs/agents/methods) — method/1 at gate-chain/1.
- [Mga tuntunin sa data at transmission](/docs/agents/data-rules) — local-only at
  `holders_agreed`.
- [Ang modelo ng rails](/docs/agents/rails-model) — ang nag-iisang pipeline.
- [Sanggunian ng `mt-eval`](/docs/reference/mt-eval) at
  [sanggunian ng `nmt-forge`](/docs/network/getting-started/forge-command-reference).
- Pagsasalin ng app at site: [CI/CD](/docs/guides/ci-cd),
  [troubleshooting](/docs/guides/troubleshooting).
