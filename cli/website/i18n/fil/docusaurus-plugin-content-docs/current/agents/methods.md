---
title: "Mga pamamaraan at gate"
slug: /agents/methods
description: "Ang method/1 at gate-chain/1 ayon sa pagbasa ng bawat tool ng Champollion sa mga ito, isang FST validity gate bilang praktikal na halimbawa, at ang mga recipe ng pamamaraan bukod pa sa default na sinanay na modelo — coached na LLM, few-shot, dictionary-augmented, hybrid na nakabatay sa panuntunan, chained, bahagyang pagsasalin, fine-tuned — bawat isa kasama ang kung ano ang ipinapadala nito at kung saan."
---

# Mga pamamaraan at gate

Ang isang **pamamaraan** ay anumang bagay na nagsasalin: isang sinanay na modelo, isang na-prompt na LLM, isang
paghahanap sa diksiyonaryo, isang rule engine, isang serbisyo, mga tao. Ang isang **gate** ay isang pagsusuri
sa pagitan ng output ng isang pamamaraan at ng inilalabas. Ang default na pamamaraan ng rails ay isang
modelong sinanay gamit ang nmt-forge ([pagsasanay](/docs/agents/training)); ang pahinang ito ay
ang format kung saan nakasulat ang dalawa, at ang iba pang mga recipe.

Sumusunod ang bawat recipe sa ibaba sa [mga panuntunan sa pagpapadala](/docs/agents/data-rules):
**ang isang pamamaraang tumatawag sa isang model provider ay nagpapadala ng teksto sa provider na iyon**, at
tatanggihan ito ng isang file na lokal-lamang, selyado o nangangailangan ng pahintulot.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. Kinakailangan: `id`
(mga salitang nasa maliit na titik na pinagdugtong ng mga gitling), `name`, `kind` — kasama ang isang setting
na kailangan ng uring iyon, na sinusuri ng mga reader gamit ang parehong mga mensahe sa dalawang
runtime.

| `kind` | Kinakailangang setting | Gumagana sa | Nagpapadala ng teksto sa |
|---|---|---|---|
| `llm` | `model` (isang eksaktong id, kailanman ay hindi alyas); opsyonal na `provider` | CLI; harness sa pamamagitan ng `-m` at `--provider` | Ang provider |
| `llm-coached` | `model`; napupunta ang coaching sa `coaching` (`file`, `prompt` o `dir`) | CLI; harness sa pamamagitan ng `-m` at `--coaching-file` | Ang provider: ang mga pangungusap at ang coaching |
| `mt-api` | `engine` (mula sa `shared/method-registry.json`) | CLI; harness | Ang serbisyo ng engine |
| `local-model` | `model` (isang Hugging Face id o isang lokal na folder) | Harness, in process | Wala saanman |
| `nmt-checkpoint` | `model_dir` | Sa pamamagitan ng serbisyo nito (`nmt-forge serve`) | Server ng kompyuter na ito |
| `lexicon` | `dictionary` | Harness, in process | Wala saanman |
| `python` | `entry_point` (`module:Class`) | Harness (`mt-eval run --method <folder>`) | Kahit saan ipadala ng plugin (`dependency_class`) |
| `service` | `service.endpoint` | CLI (`api` na pamamaraan) | Endpoint na iyon |
| `human` | — | Mga tao; i-score ang kanilang output gamit ang `mt-eval test` | — |

Opsyonal: `version`, `description`, `author`, `pairs` (`{source?, target}`),
`decode` (`temperature` 0–2, `batch_size`, `max_tokens`), `card` (ang ipinapakita ng
leaderboard), `dependency_class` (`S` self-contained, `O` open external,
`A1`/`A2` API-dependent, `X` closed), `evidence` (mga nasukat na run: `dataset`,
`metric`, `score`, `ci`, `n` — mga numero lamang), `runtimes` (`cli`, `engine`).

**Kung saan nagmumula ang isang method.json:** `methods/<id>/method.json` sa isang proyekto;
`nmt-forge export` (uring `nmt-checkpoint`); `mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`). Ang mga mas lumang anyo (ang CLI plugin manifest na may
`type`, ang harness plugin manifest na may `entry_point`) ay binabasa pa rin, bilang
method/0, na may babala. Ang isang dokumentong may dalang `$schema` ay binabasa bilang
method/1 at dapat mag-validate.

**Kung aling runtime ang tumatanggap ng aling uri.** Tinatanggihan ng CLI ang `python`, `lexicon`,
`local-model` at `human` (*"tumatakbo sa eval engine (mt-eval run --method),
hindi sa champollion CLI — o i-serve ito at gamitin sa pamamagitan ng endpoint nito"*).
Ang `--method <folder>` ng harness ay naglo-load lamang ng `python`; para sa anumang ibang uri,
sinasabi nito ang mga flag na nagpapatakbo rito sa halip.

**Pag-decode.** Ang default na temperatura ay **0** (`shared/model-defaults.json`):
isang value para sa kung saan nagsasalin ang isang app at kung saan sumusuri ang harness, upang
ang nasusukat ay siyang inilalabas — nagde-default dito ang `mt-eval run --temperature`.
Maaaring magtakda ng sarili nito ang isang pares, isang config, o isang run.
Ang mga model id ay eksaktong mga slug, kailanman ay hindi mga alyas.

## Mga gate chain

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, isang file sa
`gates/`. Kinakailangan: `id`, `gates` (isa o higit pa). Opsyonal: `description`,
`fallback`.

Bawat gate: `id`, `kind` (`metric-threshold`, ang tanging uri), `metric` (ang
pangalan ng isang metric plugin), `field` (isang key sa bawat-segment na resulta ng plugin na iyon — isang
numero, o true/false na binabasa bilang 1/0), `min` at/o `max`, `on_refuse`.

**Ang mga panuntunan** (`arena/mt_eval_harness/gates.py`):

- Tumatakbo ang mga gate nang sunod-sunod; ang **unang** gate na tumanggi sa isang segment ang nagpapasya kung ano
  ang ilalabas:

  | `on_refuse` | Inilalabas | Binibilang bilang |
  |---|---|---|
  | `drop` | wala | tinanggihan |
  | `keep-source` | ang pinagmulang teksto | tinanggihan |
  | `flag` | ang output, minarkahan | minarkahan, hindi tinanggihan |
  | `fallback` | ang salin ng fallback, kung tatanggapin ito ng parehong mga gate; kung tinanggihan muli, wala | tinanggihan |

- **Lock.** Ang isang segment na hindi ma-score ng plugin ay tinatanggihan (`no_value`, o
  `plugin_error:<type>`) — kailanman ay hindi inilalabas na parang pumasa.
- **Lock.** Ang isang gate na ang plugin ay hindi naka-load, o hindi makapag-score dito, ay nagpapahinto sa
  run bago pa may maisalin: *"ang gate na hindi makapaghusga ay kailanman hindi itinuturing na pumasa"*.
- **Lock.** Dapat tumakbo ang fallback sa prosesong ito (`lexicon`, `local-model`,
  o isang plugin na nagdedeklara ng `dependency_class` `S` o `O`), kaya ang isang tinanggihang segment
  ay walang patutunguhang iba.
- **Lock.** Tinatanggihan ng `mt-eval run` at `mt-eval test` ang isang chain na may `fallback`
  na gate: *"ang fallback ay para sa pag-serve at pagsasalin, kailanman ay hindi para sa isang pagsukat:
  ang score ay magiging bahagi ng pamamaraang ito at bahagi ng fallback, sa ilalim ng iisang
  pangalan"*. Sukatin ang fallback bilang sarili nitong pamamaraan.
- **Kung saan nalalapat ang mga gate:** `mt-eval run --gates`, `mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`,
  `mt-eval serve --gates`, at `gates` ng isang deployment.
- Sa isang pagsukat, ini-score ng headline kung ano ang inilalabas; ang ungated na chrF++ at ang
  refusal rate ay nakatabi rito, at ang fingerprint ng chain (sha256 ng canonical nitong
  JSON) ay sumasama sa ulat ([pagsukat](/docs/agents/measurement#gated-measurement)).
  Sa `keep-source`, ini-score ng headline ang pinagmulang teksto kung saan ito inilabas.
- **Lock.** Kailangan ng bawat gate ng `min` at/o `max`, natatangi ang mga gate id, at ang isang
  `fallback` na gate ay nangangailangan ng `fallback` ng chain — nagbibigay ang `champollion validate` at
  ang harness ng parehong hatol. Ang muling pagsubok sa isang tinanggihang segment gamit ang
  dahilan ng gate ay hindi binuo.

## Halimbawang may solusyon: isang FST validity gate

Sinasabi ng isang finite-state analyzer (FST) kung ang isang salita ay isang maayos ang pagkakabuo na salita ng
wika. Ang metric plugin ng harness na `giellalt_fst_validity` ay nag-uulat, bawat
segment, ng `fst_total_words`, `fst_valid_words`, `fst_invalid_words` at
`fst_validity_rate` (0–1). Hinahati ang mga salita sa whitespace habang tinatanggal
ang mga bantas sa dulo; ang isang salitang nagsisimula sa malaking titik ay muling sinusubukan sa maliit na titik.

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- Ang analyzer ay **hindi kasama sa bundle**: naglalabas lamang ang harness ng mga pin (isang pangalan ng file
  at sha256 bawat wika), at kinukuha ng `setup --lang` ang analyzer mula sa
  upstream nito patungo sa `~/.mt-eval/fsts/<code>/`, sa ilalim ng mga tuntunin ng upstream. Pinapatakbo
  ito bilang isang hiwalay na tool, kailanman ay hindi naka-link sa `champollion` CLI.
- Ang nawawalang analyzer ay kailanman hindi nagiging zero: bilang metric, minamarkahan itong hindi
  nakalkula; bilang gate, pinapahinto nito ang run.
- Ang walang lamang output ay may score na 0 at tinatanggihan sa ibaba ng `min`.
- Upang mag-serve gamit ito, gamitin ang `on_refuse: "fallback"` at isang `fallback` tulad ng
  `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` — para sa
  `translate` at `serve` lamang.
- **Tandaan.** Sinasabi ng pagtanggap ng FST na umiiral ang isang salita, hindi na ang pangungusap ay may tamang
  kahulugan. Isa itong diagnostic: kailanman ay hindi ito pumapasok sa headline ng chrF++.

## Ang mga recipe

### Coached LLM (`llm-coached`)

Isang pangkalahatang modelong na-prompt gamit ang gabay ng mga tao: mga tala sa balarila, estilo,
mga termino.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **Sa harness**, ang teksto ng coaching file *mismo* ang buong system prompt,
  kaya dapat nitong sabihin kung ano ang isasalin at ang salin lamang ang i-output.
  Ang `--glossary` ay isang scoring input (pagsunod sa terminolohiya), na kailanman ay hindi ipinapadala.
- **Lock.** Ang isang run ng harness ay may iisang coaching: `--coaching-file`, `--coaching`
  (inline na teksto) o ang mas lumang `--custom-prompt` — magbigay ng isa. Tinatanggihan kapag
  pinagsama ang dalawa: *"--coaching-file and --coaching each give the run its coaching —
  give one (put inline text in the file, or drop the file)"*.
- **Sa CLI**, nagpapadala ang `llm-coached` ng sarili nitong prompt kasama ang coaching bilang isang
  block ng "Coaching guidance", kasama ang `.champollion/coaching/<locale>.json`
  (`grammar_rules`, `style_notes`, `dictionary`).
- **Tandaan.** Dalawang magkaibang prompt ang mga ito: ang isang coached score na nasukat sa
  harness ay hindi ang eksaktong prompt na inilalabas ng CLI. Banggitin ito kapag naghahatid kayo ng isa bilang
  ebidensya para sa isa pa.
- **Nagpapadala ng:** bawat pinagmulang pangungusap at ang buong coaching sa provider. Ang isang
  coaching file na may sidecar na lokal-lamang ay tumatakbo lamang sa isang loopback endpoint
  (minamarkahan ito ng `champollion data mark coaching.md --local-only`).

### Few-shot

Mga halimbawa ng magagandang salin sa loob ng coaching. Isa itong coached LLM: parehong
mga command, parehong transport — naglalakbay ang mga halimbawa sa system prompt patungo sa
provider.

- **Tandaan.** Kailanman ay huwag kumuha ng mga halimbawa mula sa test set, at kailanman ay huwag mula sa isang
  file na lokal-lamang para sa isang remote provider. Walang awtomatikong sumusuri sa mga halimbawa ng few-shot
  laban sa mga reference ng pagsubok.

### LLM na dinagdagan ng diksiyonaryo

- **CLI:** ang `dictionary` sa `.champollion/coaching/<locale>.json` ay ipinapadala
  sa bawat pamamaraan ng LLM bilang "REQUIRED TERMINOLOGY" para sa mga terminong natagpuan sa bawat
  batch (case-insensitive na pagtutugma ng substring). Natatanggap ito ng DeepL bilang isang glossary.
  Nagbibigay ng babala sa mga paglabag pagkatapos magsalin; walang muling pagsubok.
- **Harness:** umaabot lamang ang isang diksiyonaryo sa modelo bilang teksto sa coaching
  file.
- **Diksiyonaryo lamang:** `mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` — pinakamahabang parirala muna, pinapanatili ang mga hindi kilalang salita, in
  process. Ang `nmt-forge floor` ay ito, sa dev set
  ([pagsukat](/docs/agents/measurement#the-dictionary-floor)).
- **Nagpapadala ng:** mga tumutugmang entry ng diksiyonaryo, kasama ang mga pangungusap, sa
  provider. Ang isang diksiyonaryong lokal-lamang ay hindi dapat mapunta sa isang remote provider.

### Rule-based hybrid

Walang built-in na rule engine. Ang mayroon: `lexicon` (deterministiko, in
process); `mt-eval run --method apertium` (isang rule-based engine — nagpapadala ito ng teksto
sa `apertium.org` maliban kung itinuturo ng `APERTIUM_API_URL` ang sarili ninyong server); at
mga plugin ng `python` para sa sarili ninyong mga patakaran, opsyonal na may kasamang LLM. Ang isang klase ng plugin
ay nangangailangan ng `async def translate(self, entries, config)`; patakbuhin ito gamit ang `mt-eval run
--method <folder>`. I-validate ang output nito gamit ang isang gate chain.

- **Nagpapadala ng:** anumang tinatawag ng plugin. Ang isang plugin ay isang panlabas na pamamaraan: sa isang
  corpus na nangangailangan ng pahintulot o selyado (kasama ang lokal-lamang), tinatanggihan ito
  ng harness maliban kung may `--attest-local-transport` — na ipinapasa lamang ninyo pagkatapos i-verify
  na ang lahat ng tinatawag nito ay nasa makinang ito.

### Chained methods

Dalawang chain ang built-in:

1. **Ang fallback ng isang gate chain:** pamamaraan → mga gate → in-process fallback → ang
   parehong mga gate. Para sa `translate` at `serve` lamang.
2. **Ang pair fallback ng CLI** (`"fallback": {"method": …}` sa isang pares ng app):
   pangunahing pamamaraan → ang quality gate ng CLI → isang muling pagsubok gamit ang feedback ng gate
   (mga pamamaraan ng LLM, o isang endpoint ng `api` na nagdedeklara ng `acceptsInstructions`) →
   ang fallback nang isang beses, sa pamamagitan ng parehong gate.

Anumang mas mahaba (bumuo, mag-edit, mag-validate sa iba't ibang modelo) ay isang plugin ng `python`
o isang `service`.

- **Nagpapadala ng:** ipinapadala ng bawat link kung ano ang ipinapadala ng uri nito. Ang isang chain ay kasing-pribado lamang ng link nitong may pinakakaunting pagkapribado.

### Bahagyang pagsasalin (mga tao at makina)

Ang modelo ang nagda-draft; sinusuri at inaayos ito ng isang tagapagsalita. Sa rails, ito ang improve
round: nagda-draft ang `champollion improve sheet`, minamarkahan ng tagapagsalita ang `Y`/`N`/`?`,
ginagawang mga training pair ng `champollion improve marks` ang mga pag-aayos at kumpirmadong draft at ginagawang mga dev sentence ang mga practice row ([coaching](/docs/agents/coaching)).
Upang i-score ang sariling mga salin ng mga tao bilang isang pamamaraan (`kind` `human`), patakbuhin
ang `mt-eval test` sa kanilang mga output. Minamarkahan ng isang gate na may `on_refuse: "flag"` ang output
para sa pagsusuri.

- **Tandaan.** Ang isang pangungusap na ginamit upang mag-coach o magsanay ng isang pamamaraan ay kailanman hindi dapat maging isa sa mga sinusuri para rito.
- **Nagpapadala ng:** wala nang higit pa sa sariling mga panuntunan ng nagda-draft na modelo; nananatili ang mga sheet sa
  folder ng proyekto.

### Fine-tuned na modelo

- **Sa rails:** `nmt-forge` (`nmt-checkpoint`; mga preset na `cpu-tiny`,
  `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), na-export,
  na-serve at nakakonekta —
  [pagsasanay](/docs/agents/training), [pag-serve](/docs/agents/serving).
- **Isang bukas na modelong mayroon na kayo:** `mt-eval run --method local-model -m
  <Hugging Face id or folder>` — in process; walang lumalabas sa makina.
- **Isang LLM na kayo mismo ang nagse-serve** (Ollama, vLLM, anumang tugma sa OpenAI):
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`. Mabibilang lamang ito bilang lokal kapag ang endpoint ay isang loopback
  address.
- **Nagpapadala ng:** walang lumalabas sa makina, kapag tunay na lokal ang endpoint.

## Alamin nang mas malalim

- [Ang espesipikasyon ng pamamaraan](/docs/network/specifications/methods) at ang
  [plugin manifest](/docs/reference/plugin-spec) (ang mas lumang anyo).
- [Pag-serve at deployment](/docs/agents/serving) — deployment/1 at
  service-api/1.
- [Mga panuntunan sa pagsukat](/docs/agents/measurement) — mga gated na score.
- [Mga panuntunan sa data at pagpapadala](/docs/agents/data-rules) — kung ano ang maaaring ipadala.
- [Mga pamamaraan ng pagsasalin para sa mga app at site](/docs/guides/translation-methods).
