---
title: Serving and deployment
slug: /agents/serving
description: "Put a measured model to work: the deployment/1 file nmt-forge export writes, mt-eval translate and serve, nmt-forge serve and its try page, the service-api/1 /translate contract, champollion connect, and champollion sync driven by an agent — with what local-only output may and may not do."
---

# Serving and deployment

**A deployment is the measurement pipeline on source-only input.** One
deployment/1 file names the method, its model, its gates and the pair. The
same file is tested on a test set, run over a file and served, so what was
measured is what ships. This page is the agent's half of
[Put it to work](/docs/put-it-to-work).

Throughout: a model that learned from sentences marked local-only can repeat
them, so **its output is local-only too**. Every tool below keeps that output
on this computer unless the data's holders agreed otherwise, and
`--holders-agreed-by` records who agreed. **Note.** Pass that flag only with
the name the person gave you, after they said the holders agreed.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. Required: `id`,
`pair` (`source`, `target`, optional `target_script`), `method` (`method`,
optional `model`). Optional: `gates` (a gate-chain/1 file) and `serve`
(`host`, default `127.0.0.1`; `port`). Paths are relative to the project root,
where the rails run commands. It names no score.

**Who writes it.** `nmt-forge export`, when the export sits inside a rails
project (a `champollion.project.json` above it), writes
`deploy/<name>.json` — `<name>` is `--name` in kebab case, else
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

It writes none (and says `no deployment file: …`) when the export is outside
a rails project, when the model was selected under a decode hook (only
`nmt-forge serve` runs forge's hooks), when the config names no pair, when the
document would not validate, or when `deploy/<name>.json` already deploys
another model (never replaced).

**Who reads it.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**Locks.** With `--deployment`, `run` and `translate` refuse `--method`,
`-m`/`--model`, `--gates` and `--target-script` (*"--deployment … says the
method, its model, its gates and the target script; drop … (or change the
file)"*); `serve` also refuses `--pair`. An input in another pair is refused
(`deployment <id> translates from <src>; this input is in <x>`). A
deployment whose gate chain falls back can be translated and served, but not
measured: `mt-eval run` refuses a chain that falls back
([methods and gates](/docs/agents/methods#gate-chains)).

## What an export holds

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` writes:

| Path | What it is |
|---|---|
| `<dir>/model/` | The folder to deploy: weights and tokenizer, `forge-model.json` (what it was trained on, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, kind `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (port 8378 unless `--port`), `card.commercial_ready: false`, `evidence` with the test-set chrF++, its interval and n |
| `<dir>/evaluation/` | The test-set evidence. Never copy it with the model |
| `<dir>/input-words.json` | The words of the training sentences' input side, one of each, sorted (`words`, `english`, `sentences`, `from`, and `notes` naming a training file that could not be read as the run read it). Beside `model/`, never in it: they are words from the people's data. Written when the export includes the model and its training files are on this computer; otherwise the export's summary says `input_words.written: false` with `why`. `nmt-forge serve` reads it to name the words the model never saw ([below](#words-the-model-never-saw)) |
| `<dir>/README.md` | What the export is |

## `mt-eval translate`

The pipeline over a file, nothing scored. `--out` takes `.jsonl` (one row per
segment: `id`, `source`, `output`, `error`, and with gates `gates`,
`shipped_from`, `fallback`) or `.tsv` (source, tab, output). Without `--out`
it writes `<run id>.translations.jsonl` in the output folder (`-o`). The
output carries the input's terms — and the model's — in a set/1 sidecar.

**Lock.** When the method's output is local-only (or its gate chain's
fallback's is), a destination outside the project is refused before anything
is translated: *"refusing to write …: what this method writes is local-only
(…), and that is outside … — a place the data's holders did not choose. Only
they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or
write it inside the project"*. With the agreement, the sidecar records
`holders_agreed: {by, date}`; the file stays local-only for every tool.

`--json` prints `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` and `output_gates`. Exit 1 when every row failed. `--publish`
is refused: there is no score.

## `mt-eval serve`

| | |
|---|---|
| Default address | `127.0.0.1:8379` (`--host`, `--port`, or the deployment's `serve` block) |
| What it serves | Only a method that runs in this process: `lexicon`, `local-model`, or a plugin whose method.json declares `dependency_class` `S` or `O`. An LLM or a hosted engine is refused |
| Token | `MT_EVAL_SERVE_TOKEN`, from the environment only. Required to listen on any address other than `127.0.0.1`, `::1` or `localhost`; when set, required on every `POST` (loopback too). `GET /health` never needs it |
| Limits | 1,000,000-byte body, 500 keys, 20,000 characters a string — over any is `413` |
| Gates | `--gates <chain>` (or the deployment's `gates`). Every gate's plugin must judge without references, or it does not start. A fallback is allowed here, and must run in this process |

**Lock — off loopback.** Without a token: *"refusing to listen on … without a
token — anyone who can reach the port could use the method"*. With local-only
output and no agreement: *"refusing to serve on …: what this method writes is
local-only (…), and an address other machines can reach sends it off this
one. Only the data's holders can agree to that — ask them; if they do:
--holders-agreed-by "<who agreed>" (reported on /health), or keep --host
127.0.0.1"*. Output is local-only when a dictionary's sidecar says so (or
cannot be read), or a model folder's `forge-model.json` records local-only
training terms or records none; it is reported as not known (`null`) for a
plugin or a model folder without `forge-model.json`.

`/health` answers `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (in this process — nothing is sent anywhere), `scored`
(nothing), `output_gates` and `gates` (chain id, fingerprint, gates, fallback),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (the repository) and `version`.

With gates, a refused segment comes back as its gate says: `drop` — the key
under `errors`; `keep-source` — the source; `flag` — the output, the key
named in `meta.gates.flagged`; `fallback` — the fallback's translation if the
gates accept it. Without gates it checks nothing it returns.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| Default address | `127.0.0.1`, port `NMT_FORGE_SERVE_PORT` or 8378 |
| Token | `--token` or `NMT_FORGE_SERVE_TOKEN`; required off loopback. `--detach` takes it from the environment only |
| Routes | `GET /` — a try page for the person (no token; it asks for one when one is set); `GET /health`; `POST /translate` (service-api/1); `POST /v1/chat/completions` (OpenAI-compatible); `GET /v1/models` |
| `--detach` | Returns once `/health` answers; stopped if it does not within 120 s. Refused when the port already answers |
| `--no-hook` | Serve without the run's decode hook (said on `/health` and in `meta`) |
| `--allow-locale` | Also accept these locale codes (repeatable) |
| `--device` | `auto` (default) or `cpu`. With `auto`, a server started while a training job of the same project runs takes the CPU rather than share the GPU, and `/health` says so (`device_note`) |
| Limits | 1,000,000-byte body, 500 keys, 20,000 characters a string, 5,000 pieces of model work a request — over any is `413`. The model is asked 32 pieces at a time, so a sentence from another request waits for one chunk, never for a whole request. A request still running after 600 s is refused whole — `503`, *"send fewer pieces at a time"* — never answered in part |
| Decoding | Beam search with the export's `num_beams` when the export records `beams_applied` (as the model was measured); greedy for an older export. Text sent is normalized to NFC, as training data is |

**Lock.** Off loopback, a model whose output is local-only — trained on
local-only sentences, or with no record of what it learned from — is refused
without `--holders-agreed-by`. `/health` reports `pair`, `accepts`,
`decode_hook`, `run`, the dev and test reports, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` and `output_gates`. Every `/translate` answer from a
local-only model carries `meta.output_local_only: true`, and every
`/v1/chat/completions` reply carries `meta.output_local_only` (true or false).
When the length limits cut anything in a request, its `meta.cut` counts the
sentences cut going in (`inputs`) and the translations that stopped at the
cap (`outputs`) ([training](/docs/agents/training#the-guarded-loop)).

**Note.** The try page is for the person. `try_translation` (MCP) sends them
there for a local-only model; never call `/translate` yourself to read its
output ([contract](/docs/agents/contract) §1).

### Words the model never saw

A sentence holding a word the model never saw in training is very likely
mistranslated, however fluent it reads. On the invented test language, a
held-out sentence with a content word the model had not seen was translated
right 0 times in 358 (ByT5-small at 1,600, 6,400 and 25,600 training pairs),
and came out confidently wrong — fluent, every word a real form, the meaning
wrong — 32%, 55% and 83% of the time: the better the model, the more
convincing the guess. So the server names those words.

- **`/health`** says whether it can: `unseen_words_check` is `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- **`/translate`** adds, only when a request holds such words,
  `meta.unseen_words` (key → the words of that key's text the model never
  saw, once each, in order) and `meta.unseen_note`. **`/v1/chat/completions`**
  adds the same, keyed by what was asked: `SEG_<id>` per segment in block
  mode, `page` for a page, the JSON object's own keys, or `text`.
- **No record, said on every reply.** The server reads `input-words.json`
  from the folder above the model folder it serves. With none there — an
  export made before 2026-10-13, one made without its training files on this
  computer, or a model folder copied away from its export — every reply's
  `meta.unseen_check` says it cannot check, and why. Serve the model from its
  export, or export it again.
- **The try page** marks the line: *"Never seen in training: … — this line is
  very likely wrong, however fluent it reads."*

A word is a run of letters in any script (apostrophes inside it kept),
lowercased, in NFC. When the input side is English, a plain English ending
counts as seen either way round (`walk` seen → `walked` counts; `walked`
seen → `walk` counts).

## service-api/1 — the `/translate` contract

`$schema` `https://champollion.dev/schemas/service-api/1.json`, held to
`shared/test-fixtures/framework/service-api-vectors.json` (run against
`mt-eval serve` and `nmt-forge serve`).

- **Request** `POST /translate`: `keys` (key → source string; required),
  optional `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` for document text), `instructions` (key → note; sent only to a
  server declared to follow them, `accepts_instructions`). A field a server
  does not use is ignored, never refused.
- **Response:** `200` `{translations, meta}` — `meta` is required; `207` adds
  `errors` (key → `{message}`). Errors are `{error: {message}}`: `400` a
  request it cannot take, `401` a missing or wrong token, `404` an unknown
  route, `413` too large, `500` the method failed — never a partial answer.
  (`nmt-forge serve` also answers `503` for a request past its 600 s limit.)
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false or null), `cost_usd`; servers may add fields.
- **`GET /health`** requires `status` (`ok`), `pair`, `output_gates` and
  `output_local_only`; optional `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`.
- **The rule:** a server whose `/health` says `output_local_only: true` puts
  `output_local_only: true` in every response's `meta`, and a client writes
  such output only where the data's holders agreed.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

It finds the `method.json` (the file named, or `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` in
the folder), installs it into the app's `.champollion/methods/`, and points
each of its pairs (`<inputLocale>:<target>`) at it as `methodPlugin`, keeping
the rest of the pair. The app folder needs `champollion.config.json`, and the
method must translate from the app's `inputLocale`.

**Lock.** A model whose output is local-only — known from its
`forge-model.json` (a missing one counts), or from its service's `/health` —
is refused without `--holders-agreed-by`: what it writes into the app's
locale files is published with the app. With it, each pair records
`holdersAgreed: {by, date, method, what}`. It warns, without failing, when
nothing answers at the endpoint (`nmt-forge serve <dir> --detach` starts it)
or when `/health` does not follow service-api/1. `--json` prints `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`.

## `champollion sync`, driven by an agent

`sync` translates an app's or site's locale files with the methods its
`champollion.config.json` names. It asks nothing interactively.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**`--json` output** is one JSON object per line. On stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` with
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` and more; a dry run adds `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) and `maxCost`. On stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` and
`error`.

| Exit | Meaning |
|---|---|
| 0 | Clean |
| 1 | A `--redo` or `--force-keys` name matched no key; failures with nothing processed; an error |
| 2 | `--max-cost` stopped it before any call (or the estimate was unknown); or partial: something failed, keys were held back, plural forms are missing, or verify found errors |

A dry run sends and writes nothing, does not verify, and exits 0 unless a
named key matched nothing or there was an error. Verify runs after a real sync
unless `--no-verify`.

**Lock — local-only answers.** For an `api` method, a batch whose
`meta.output_local_only` is `true` is not written unless the pair's
`holdersAgreed` names that method; `sync` says so once, and names the
`champollion connect … --holders-agreed-by` call. Those keys stay
untranslated (or go to the pair's fallback).

**Lock — the `local` method.** The `local` method (an OpenAI-compatible
endpoint) asks the server's `/health` once. When it says
`output_local_only: true` — as `nmt-forge serve` does for a model trained on
local-only sentences — nothing from that server is written unless the pair's
`holdersAgreed` names `local`: *"the model at … says what it writes is
local-only … nothing from it was written"*, followed by the
`champollion connect <the model> --holders-agreed-by "<who agreed>"` call. A
server whose `/health` does not answer or does not say `true` (an Ollama or
LM Studio server, say) is used as before.

**Note.** Connect a forge model with `champollion connect` (the `api`
route): it reads the model's own record of what it learned from, and records
the holders' agreement on the pair under the method it installs.

**Words the model never saw.** When a forge server names keys in
`meta.unseen_words`, the `local` and `api` methods warn with the keys —
never the text or the words: *"<API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys>"* (then *"and <n> more"*).
The translations are still written; the warning is how the people know which
to check ([coaching](/docs/agents/coaching)).

**Note.** Pass on every `warn` line. Machine-translated strings are drafts
until a speaker reviews them; never call them correct.

## `champollion serve`

A different server: it serves an **app project's** own configured
translation stack (method, coaching, translation memory, quality gate) to
other projects. Defaults `127.0.0.1`, port 1822. It requires a bearer token
even on loopback (`--token` or `CHAMPOLLION_SERVE_TOKEN`, at least 12
characters) unless `--no-auth`, which is accepted only on a loopback bind.
`--emit-manifest` writes a method/1 manifest of kind `service` for consumers.
Its `/health` is `{ok, service, version}`, not the service-api/1 health
document, so `champollion connect` reports health problems for it.

## Go deeper

- [Put it to work](/docs/put-it-to-work) — the people's version.
- [Methods and gates](/docs/agents/methods) — method/1 and gate-chain/1.
- [Data and transmission rules](/docs/agents/data-rules) — local-only and
  `holders_agreed`.
- [The rails model](/docs/agents/rails-model) — the one pipeline.
- [`mt-eval` reference](/docs/reference/mt-eval) and
  [`nmt-forge` reference](/docs/network/getting-started/forge-command-reference).
- App and site translation: [CI/CD](/docs/guides/ci-cd),
  [troubleshooting](/docs/guides/troubleshooting).
