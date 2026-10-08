---
title: MCP Server — the agent-facing door
sidebar_label: MCP Server
description: "Connect an AI agent to Champollion over the Model Context Protocol: 34 tools for looking up languages, browsing the benchmark queue and corpus registry, running evaluations, training and exporting models, and translating — plus exactly which ones need more than an npx install."
---

# MCP Server — the agent-facing door

`champollion-mcp-server` exposes Champollion to AI agents over the [Model
Context Protocol](https://modelcontextprotocol.io). If you are an agent, or you
are wiring one up, this is the door: **34 tools, 3 resources and 4 prompts**
over stdio.

Everything here is also reachable as plain HTTP — see [Machine-readable
endpoints](#machine-readable-endpoints) — but the MCP server is the only surface
that lets an agent *act* (translate, run a benchmark, train a model) rather than
just read.

## Install

```bash
npx -y champollion-mcp-server
```

Then register it with your client. For Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

For clients configured by file (Claude Desktop, Cursor, Antigravity), add:

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

## Read this before you rely on it

**Fourteen of the 34 tools work from a bare `npx` install, and `translate` works
once it has an engine. The other nineteen need Python packages the npm package
does not and cannot ship.** They do not fail silently — each returns an
actionable error naming what is missing — but you should know the shape before
you plan around it.

| Tools | Work after `npx`? | What else they need |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Yes** — read-only, served from public endpoints | nothing |
| `translate` | **Yes**, with an engine | an API key for the engine you pick — or none, with method `local` and a model server on your own machine |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | No | the eval harness — `pipx install mt-eval-harness` |
| the fifteen `forge_*` tools | No | NMT Forge 0.2.0 or later — `python3 -m pip install nmt-forge` (add `'nmt-forge[hf]'` to train and serve). It brings the eval harness with it and finds language cards on its own; no clone needed |

No clone of the repository is needed for any of it.

## What the tools do

**Browse and cost the work.** `list_queue` and `get_queue_item` walk the open
benchmark queue — the ranked list of measurements that would most improve the
map. `estimate_cost` prices a set of runs before you spend anything.

**Look things up.** `search_languages` searches the language cards by name,
code, family or region, and tolerates misspellings. Each result also says where
the language is spoken (countries, a map point, macroarea) and its other
names — only the facts its card cites a source for, each with that source, so
languages with similar names can be told apart. A location without a source is
never shown; the line says so and links the language's Glottolog record
instead. Cards filled in from champollion.dev's published card tables (in an
npm install, every language outside the bundled core set) do not carry
per-field sources yet — they arrive with the tables' next upload — so those
lines carry the Glottolog link rather than a location. `language_overview` is the
one-page starting point for building for a language: what exists, what can
run, and the next steps. `get_language` returns the full cited card.
`list_corpora` lists the registered evaluation
corpora for a language pair or benchmark family — metadata only (size,
license, contamination grade, and whether the harness can fetch it, needs an
access token, or holds it in quarantine); corpus content is never returned,
and a pair whose corpora are all quarantined says so instead of looking
unsupported. `get_results` and `get_run_card` read scored runs off
the public leaderboard. `get_metric_reliability` answers the question most
agents get wrong — *which metric should I trust for this target language* —
from correlations with human judgments per language family. `list_contests`
and `get_contest` show contests and their declared terms; entering one is a
human-authorized CLI step, never a tool.

**Act.** `translate` runs text through the tested pipeline, with Translation
Memory (repeats cost nothing) and a deterministic quality gate. Every answer
names the engine that actually ran, with its model and endpoint where it has
them.
`run_benchmark` starts an evaluation and returns a **job id immediately**,
because real runs outlast any client timeout; you poll `get_run_status` with
that id. A job survives a restart of the server: the run keeps going, and
polling the same id afterwards still returns its status and results. Nothing
is published unless you pass `publish: true`; the plan then says what would go
public — every row with its sentence text, or scores only; the prompt, or only
its hash; and where — and a real publish needs `publish_ack` in the exact
words the plan gives, so the user has seen them first. A run made without it
can be published later, behind the same gate. `preview_publish` is read-only:
it shows the harness's own publish preview, the exact words and the exact
`publish_report` call that would publish it, and it cannot publish. It
carries the MCP annotation `readOnlyHint: true`, so an agent host that asks
before every write can allow it on its own. `publish_report` does the write
(annotated `destructiveHint` and `openWorldHint`), and `scores_only`
withholds the sentence text. Every plan also opens with the
target language's `EVAL PACK:` status — `missing` (with the command that
installs it), `ready`, or `none needed` — and names the corpus licence and its
`do_not_train` term, because the run passes `--yes`. A missing FST (the
analyzer or its pyhfst runtime) never stops the run: it proceeds, and the run
card marks FST acceptance not computed. Any other missing piece stops the run
before it translates. `skip_fst` and `skip_eval_standard` score without those
pieces, and the run card marks what was left out. The plan also says whether
COMET will be computed (the harness computes it whenever `unbabel-comet` is
installed; `comet: true` makes the run require it), and `metricx` and `fuse`
ask for the harness's opt-in MetricX-24 and FUSE-style comparator. For each
one the plan says, from the harness, whether it is installed, what to install
and what it downloads. A confirmed run that asks for a metric the harness
cannot compute is refused rather than run without it. The plan's `Results:`
and `Cache:` lines say where the run log, report and translation cache land.
A test file inside a folder that `mt-eval contest prepare` marks releasable
(a contest's `public/`) runs into the contest's `runs/` folder instead, so
nothing a run writes is released with it. A model on your own
machine (a local server, or `method: "local-model"`, which the harness runs
in-process and needs no attestation) is reported as `$0 API cost (runs on
this machine)`.

**Train without fooling yourself.** `get_training_guardrails` returns the rules
extracted from real measured failures. The fifteen `forge_*` tools run
[NMT Forge](/docs/network/getting-started/training-honestly) one guarded step
at a time — `forge_status` first and after every step (it names the next
command and the tool that runs it), `forge_preflight` to see which gates a
command will hit before it refuses, `forge_prereg_template` and `forge_prereg`
to write predictions down before any test score exists (and before any
benchmark on the test set: a scoring read blocks a later preregistration),
`forge_export` to score the test set once and package the trained model,
`forge_compare` to A/B two models with each one's near-twin caveat beside
the winner, and
`forge_prereg_verdict` to record the user's own verdict on a prediction forge
cannot judge (a free-text range) — shown as a human verdict, never as a
computed one. `forge_status` lists every trained run with its dev score and
says when a dev set is saturated (a perfect dev score with nothing for
checkpoint selection to choose between). When the eval harness puts a caveat
on a test score (for example a near-constant output: a handful of outputs
given for every source sentence), `forge_export`, `forge_status`,
`forge_compare` and `forge_lint` carry it in the harness's own words, and a
major one comes first in the next step: the score is never quoted without
it. A refusal comes back
with what went wrong, why it matters and the fix. Two steps outlive any tool
call and run in a terminal instead: training (`nmt-forge run`) and serving the
exported model (`nmt-forge serve`, which puts it behind a local endpoint that
`translate` and the CLI can use).

### Arguments

`name` is required and `name?` is optional. Every tool that takes one
language also accepts it as `language`: "`code` or `language`" means either
name works, and you pass one. The original names keep working.

| Tool | Arguments |
|---|---|
| `search_languages` | `query` or `language`, `limit?` |
| `language_overview` | `code` or `language`, `source?` |
| `get_language` | `code` or `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (at least one of these three), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` or `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | none |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` or `priority?` (one of them) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (a gettext msgctxt: one for every text, or one per text), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | one mode: `budget?` or `top?` (queue), `item_id?`, or `corpus?` with `model?` (with `method_dir`, the model the plugin loads), `method?` or `method_dir?` (a method plugin directory; `local-model` needs `model` — it has no default), `allow_model_pair_mismatch?` (`local-model`: run an OPUS-MT pair model that names another pair, as a related-language baseline), `attest_local_transport?` (an MT engine or a plugin; never needed for `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (LLM runs: the ISO 15924 script the output must be written in, such as `Cans` or `Latn`; the plan says when the target's card lists more than one), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` and `skip_eval_standard?` (item and corpus runs: score without the FST or the eval-standard metrics, marked not computed), `comet?` (require COMET: the run is refused while it is not installed), `metricx?` with `metricx_model?`, and `fuse?` (item and corpus runs: the harness's opt-in MetricX-24 and FUSE-style comparator, refused while not installed); then `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (with a real publish: the exact words the plan prints), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (a finished run's `*_report.json`), `scores_only?`, `redact_coaching?`, `anonymous?` (read-only: no `confirm`, it cannot publish) |
| `publish_report` | `report` (a finished run's `*_report.json`), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (the exact words the preview prints) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (the command to check), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` or `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` or `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (default `data/split`, the path `forge_init`'s config.json reads), `dev?`, `register?` (a name prefix, or `true` for `project`), `allow_rotate?`, `near_dupe?` (a Jaccard threshold such as 0.6, when forge recommends the near-duplicate carve), `max_group?` (with `near_dupe`: the largest near-duplicate group), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (with its own `clean_to`, e.g. `corpus.notwins.jsonl` — never the all-data file), `companion_config?` (with `drop_test_twins`: where the twin-free model's config goes; default `config-notwins.json`), `overwrite?` (replace a `clean_to` file that a config, a run, a split or another audit uses — refused without it), `full_indices?` (every row-number list in full; by default long lists come back as `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (pin it to one run), `allow_after_reads?` (only for predictions written before the set's scored reads), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (its number, or its own id), `verdict` (`held` or `missed`), `by` (who judged), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (each model's run manifest: its training data is checked for near-twins), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

For example, `get_metric_reliability { "language": "crk" }` and
`get_metric_reliability { "target": "crk" }` ask the same question.

### Translating with a model you deployed

`nmt-forge serve` prints two addresses for the model it serves. Point
`translate` at either one:

| Argument | Use it with | Example |
|---|---|---|
| `base_url` | `method: "local"` — an OpenAI-compatible server (also `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — the champollion API contract | `http://127.0.0.1:8378/translate` |
| `model` | LLM engines only; refused for machine-translation APIs, which have none | `llama3.1` |
| `project_dir` | any method — use that project's Translation Memory | `~/my-app` |

A server on your own machine needs no key. A remote `api` endpoint reads its
key from `CHAMPOLLION_API_KEY` in the server's environment. The tool refuses
an argument it does not know, by name, instead of ignoring it, so a misspelled
argument cannot quietly send your text to a different model.

### Where the server keeps its state

Everything lives in `~/.champollion-mcp/` (set `CHAMPOLLION_MCP_HOME` to move
it):

- **`translate`'s Translation Memory** is its own file,
  `.champollion/tm.json` in that folder. It is separate from any project's
  `.champollion/tm.json`. Pass `project_dir` to use a project's file instead,
  the one `champollion sync` uses there.
- **`run_benchmark` jobs** are recorded in `jobs.json`, which keeps the
  newest 50. Each job has a folder in `jobs/` with its output and, for a
  queue item or a registered corpus, the harness's results. A run on a test
  file you hold writes its results and cache beside that file, in
  `results/` — except a file in a folder that `mt-eval contest prepare`
  marks releasable, whose run writes to the contest's `runs/` folder.
  Queue runs write their reports to `eval/logs/harness/queue/` under the
  server's working folder, as the harness always does.

:::note[Spending is bounded by design]
`run_benchmark` **refuses an unbounded queue run.** You must pass exactly one
bound — `budget`, `top`, or a specific `item_id`. There is no "just run the
queue" call, because an agent that misunderstands the queue could otherwise
spend without limit.
:::

## Protocol version

Transport is **stdio only** — one server process per agent.

MCP's [2026-07-28 revision](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
made the protocol stateless by default, retiring the `initialize` handshake and
the `Mcp-Session-Id` header. This server is unaffected in design: it uses none
of the deprecated capabilities (Roots, Sampling, Logging), never used the legacy
HTTP+SSE transport, and already follows the new guidance for cross-call state —
`run_benchmark` mints an explicit job handle that the model passes back, rather
than leaning on a transport session.

It has **not** been upgraded to the new revision, because no published
TypeScript SDK speaks it yet. See the [server
README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) for
the full position.

## Machine-readable endpoints

No MCP client needed for these:

| Endpoint | What it is |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | The [agent front door](/for-agents), as raw markdown |
| [`/llms.txt`](https://champollion.dev/llms.txt) | The curated index of this site |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Every indexed page, inlined |
| [`/queue.json`](https://champollion.dev/queue.json) | The full benchmark queue |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Top queue items |
| [`/registry.json`](https://champollion.dev/registry.json) | The corpus registry |
| [`/mesh.json`](https://champollion.dev/mesh.json) | The measured language graph |

## Next

- [Agent Guide — building & benchmarking](/docs/network/getting-started/agent-guide)
- [Agent Guide — translating with the CLI](/docs/guides/agent-guide)
- [Submit a Method](/docs/network/getting-started/submit-a-method)
