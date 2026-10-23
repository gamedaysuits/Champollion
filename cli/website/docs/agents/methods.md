---
title: Methods and gates
slug: /agents/methods
description: "method/1 and gate-chain/1 as every Champollion tool reads them, an FST validity gate as the worked example, and the method recipes beyond the default trained model — coached LLM, few-shot, dictionary-augmented, rule-based hybrid, chained, partial translation, fine-tuned — each with what it sends where."
---

# Methods and gates

A **method** is anything that translates: a trained model, a prompted LLM, a
dictionary lookup, a rule engine, a service, people. A **gate** is a check
between a method's output and what ships. The rails' default method is a
model trained with nmt-forge ([training](/docs/agents/training)); this page is
the format both are written in, and the other recipes.

Every recipe below obeys the [transmission rules](/docs/agents/data-rules):
**a method that calls a model provider sends text to that provider**, and a
local-only, sealed or consent-required file refuses it.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. Required: `id`
(lowercase words joined by hyphens), `name`, `kind` — plus the one setting
that kind needs, checked by the readers with the same messages in both
runtimes.

| `kind` | Required setting | Runs in | Sends text to |
|---|---|---|---|
| `llm` | `model` (an exact id, never an alias); optional `provider` | CLI; harness via `-m` and `--provider` | The provider |
| `llm-coached` | `model`; the coaching goes in `coaching` (`file`, `prompt` or `dir`) | CLI; harness via `-m` and `--coaching-file` | The provider: the sentences and the coaching |
| `mt-api` | `engine` (from `shared/method-registry.json`) | CLI; harness | The engine's service |
| `local-model` | `model` (a Hugging Face id or a local folder) | Harness, in process | Nowhere |
| `nmt-checkpoint` | `model_dir` | Through its service (`nmt-forge serve`) | This computer's server |
| `lexicon` | `dictionary` | Harness, in process | Nowhere |
| `python` | `entry_point` (`module:Class`) | Harness (`mt-eval run --method <folder>`) | Wherever the plugin sends it (`dependency_class`) |
| `service` | `service.endpoint` | CLI (`api` method) | That endpoint |
| `human` | — | People; score their output with `mt-eval test` | — |

Optional: `version`, `description`, `author`, `pairs` (`{source?, target}`),
`decode` (`temperature` 0–2, `batch_size`, `max_tokens`), `card` (what the
leaderboard shows), `dependency_class` (`S` self-contained, `O` open external,
`A1`/`A2` API-dependent, `X` closed), `evidence` (measured runs: `dataset`,
`metric`, `score`, `ci`, `n` — numbers only), `runtimes` (`cli`, `engine`).

**Where a method.json comes from:** `methods/<id>/method.json` in a project;
`nmt-forge export` (kind `nmt-checkpoint`); `mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`). Older shapes (the CLI plugin manifest with
`type`, the harness plugin manifest with `entry_point`) are still read, as
method/0, with a warning. A document that carries `$schema` is read as
method/1 and must validate.

**Which runtime takes which kind.** The CLI refuses `python`, `lexicon`,
`local-model` and `human` (*"runs in the eval engine (mt-eval run --method),
not in the champollion CLI — or serve it and use it through its endpoint"*).
The harness's `--method <folder>` loads only `python`; for any other kind it
says the flags that run it instead.

**Decoding.** The default temperature is **0** (`shared/model-defaults.json`):
one value for what an app translates at and what the harness evaluates at, so
what is measured is what ships — `mt-eval run --temperature` defaults to it.
A pair, a config or a run may set its own.
Model ids are exact slugs, never aliases.

## Gate chains

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, one file in
`gates/`. Required: `id`, `gates` (one or more). Optional: `description`,
`fallback`.

Each gate: `id`, `kind` (`metric-threshold`, the only kind), `metric` (a
metric plugin's name), `field` (a key in that plugin's per-segment result — a
number, or true/false read as 1/0), `min` and/or `max`, `on_refuse`.

**The rules** (`arena/mt_eval_harness/gates.py`):

- Gates run in order; the **first** gate that refuses a segment decides what
  ships:

  | `on_refuse` | Ships | Counted as |
  |---|---|---|
  | `drop` | nothing | refused |
  | `keep-source` | the source text | refused |
  | `flag` | the output, marked | flagged, not refused |
  | `fallback` | the fallback's translation, if the same gates accept it; refused again, nothing | refused |

- **Lock.** A segment the plugin cannot score is refused (`no_value`, or
  `plugin_error:<type>`) — never shipped as if it passed.
- **Lock.** A gate whose plugin is not loaded, or cannot score here, stops the
  run before anything is translated: *"a gate that cannot judge is never
  treated as passing"*.
- **Lock.** The fallback must run in this process (`lexicon`, `local-model`,
  or a plugin declaring `dependency_class` `S` or `O`), so a refused segment
  leaves nowhere.
- **Lock.** `mt-eval run` and `mt-eval test` refuse a chain with a `fallback`
  gate: *"a fallback is for serving and translating, never for a measurement:
  the score would be partly this method's and partly the fallback's, under one
  name"*. Measure the fallback as a method of its own.
- **Where gates apply:** `mt-eval run --gates`, `mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`,
  `mt-eval serve --gates`, and a deployment's `gates`.
- In a measurement, the headline scores what ships; the ungated chrF++ and the
  refusal rate sit beside it, and the chain's fingerprint (sha256 of its
  canonical JSON) travels with the report ([measurement](/docs/agents/measurement#gated-measurement)).
  With `keep-source`, the headline scores the source text where it shipped.
- **Lock.** Every gate needs `min` and/or `max`, gate ids are unique, and a
  `fallback` gate needs the chain's `fallback` — `champollion validate` and
  the harness give the same verdict. Retrying a refused segment with the
  gate's reason is not built.

## Worked example: an FST validity gate

A finite-state analyzer (FST) says whether a word is a well-formed word of the
language. The harness's metric plugin `giellalt_fst_validity` reports, per
segment, `fst_total_words`, `fst_valid_words`, `fst_invalid_words` and
`fst_validity_rate` (0–1). Words are split on whitespace with edge punctuation
stripped; a capitalised word is retried in lower case.

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

- The analyzer is **not bundled**: the harness ships only pins (a file name
  and sha256 per language), and `setup --lang` fetches the analyzer from its
  upstream into `~/.mt-eval/fsts/<code>/`, under the upstream's terms. It is
  run as a separate tool, never linked into the `champollion` CLI.
- A missing analyzer never becomes a zero: as a metric it is marked not
  computed; as a gate it stops the run.
- An empty output scores 0 and is refused below `min`.
- To serve with it, use `on_refuse: "fallback"` and a `fallback` such as
  `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` — for
  `translate` and `serve` only.
- **Note.** FST acceptance says a word exists, not that the sentence means
  the right thing. It is a diagnostic: it never enters the chrF++ headline.

## The recipes

### Coached LLM (`llm-coached`)

A general model prompted with the people's guidance: grammar notes, style,
terms.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **In the harness**, the coaching file's text *is* the whole system prompt,
  so it must say what to translate and to output only the translation.
  `--glossary` is a scoring input (terminology adherence), never sent.
- **Lock.** A harness run has one coaching: `--coaching-file`, `--coaching`
  (inline text) or the older `--custom-prompt` — give one. Two together are
  refused: *"--coaching-file and --coaching each give the run its coaching —
  give one (put inline text in the file, or drop the file)"*.
- **In the CLI**, `llm-coached` sends its own prompt with the coaching as a
  "Coaching guidance" block, plus `.champollion/coaching/<locale>.json`
  (`grammar_rules`, `style_notes`, `dictionary`).
- **Note.** These are two different prompts: a coached score measured in the
  harness is not the exact prompt the CLI ships. Say so when you relay one as
  evidence for the other.
- **Sends:** every source sentence and the full coaching to the provider. A
  coaching file with a local-only sidecar runs only on a loopback endpoint
  (`champollion data mark coaching.md --local-only` marks one).

### Few-shot

Examples of good translations inside the coaching. It is a coached LLM: same
commands, same transport — the examples travel in the system prompt to the
provider.

- **Note.** Never take examples from the test set, and never from a
  local-only file for a remote provider. Nothing checks few-shot examples
  against test references automatically.

### Dictionary-augmented LLM

- **CLI:** the `dictionary` in `.champollion/coaching/<locale>.json` is sent
  to every LLM method as "REQUIRED TERMINOLOGY" for the terms found in each
  batch (case-insensitive substring match). DeepL receives it as a glossary.
  Violations are warned about after translating; there is no retry.
- **Harness:** a dictionary reaches the model only as text in the coaching
  file.
- **Dictionary alone:** `mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` — longest phrase first, unknown words kept, in
  process. `nmt-forge floor` is this, on the dev set
  ([measurement](/docs/agents/measurement#the-dictionary-floor)).
- **Sends:** the dictionary's matching entries, with the sentences, to the
  provider. A local-only dictionary must not go to a remote one.

### Rule-based hybrid

No rule engine is built in. What exists: `lexicon` (deterministic, in
process); `mt-eval run --method apertium` (a rule-based engine — it sends text
to `apertium.org` unless `APERTIUM_API_URL` points at your own server); and
`python` plugins for your own rules, optionally with an LLM. A plugin class
needs `async def translate(self, entries, config)`; run it with `mt-eval run
--method <folder>`. Validate its output with a gate chain.

- **Sends:** whatever the plugin calls. A plugin is an external method: on a
  consent-required or sealed corpus (local-only included) the harness refuses
  it unless `--attest-local-transport` — which you pass only after verifying
  everything it calls is on this machine.

### Chained methods

Two chains are built in:

1. **A gate chain's fallback:** method → gates → in-process fallback → the
   same gates. For `translate` and `serve` only.
2. **The CLI's pair fallback** (`"fallback": {"method": …}` on an app's pair):
   primary method → the CLI's quality gate → a retry with the gate's feedback
   (LLM methods, or an `api` endpoint that declares `acceptsInstructions`) →
   the fallback once, through the same gate.

Anything longer (generate, edit, validate across models) is a `python`
plugin or a `service`.

- **Sends:** each link sends what its kind sends. A chain is as private as its
  least private link.

### Partial translation (people and machine)

The model drafts; a speaker checks and fixes. On the rails this is the improve
round: `champollion improve sheet` drafts, the speaker marks `Y`/`N`/`?`,
`champollion improve marks` turns fixes and confirmed drafts into training
pairs and practice rows into dev sentences ([coaching](/docs/agents/coaching)).
To score people's own translations as a method (`kind` `human`), run
`mt-eval test` on their outputs. A gate with `on_refuse: "flag"` marks output
for review.

- **Note.** A sentence used to coach or train a method must never be one it is
  scored on.
- **Sends:** nothing beyond the drafting model's own rules; the sheets stay in
  the project folder.

### Fine-tuned model

- **On the rails:** `nmt-forge` (`nmt-checkpoint`; presets `cpu-tiny`,
  `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), exported,
  served and connected —
  [training](/docs/agents/training), [serving](/docs/agents/serving).
- **An open model you already have:** `mt-eval run --method local-model -m
  <Hugging Face id or folder>` — in process; nothing leaves the machine.
- **An LLM you serve yourself** (Ollama, vLLM, anything OpenAI-compatible):
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`. It counts as local only when the endpoint is a loopback
  address.
- **Sends:** nothing off the machine, when the endpoint is truly local.

## Go deeper

- [The method spec](/docs/network/specifications/methods) and the
  [plugin manifest](/docs/reference/plugin-spec) (the older shape).
- [Serving and deployment](/docs/agents/serving) — deployment/1 and
  service-api/1.
- [Measurement rules](/docs/agents/measurement) — gated scores.
- [Data and transmission rules](/docs/agents/data-rules) — what may be sent.
- [Translation methods for apps and sites](/docs/guides/translation-methods).
