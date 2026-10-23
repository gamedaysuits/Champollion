---
title: The rails model
slug: /agents/rails-model
description: "How a project on Champollion's rails is built: the project tree, the six schema-validated formats every tool reads, the one pipeline from admitted input to measured output, the journey as data, and the shape of every refusal."
---

# The rails model

A project on the rails is a folder of plain files. Every tool — the
`champollion` CLI, `nmt-forge`, `mt-eval` and the MCP server — reads the same
files natively, against the same schemas, with the same verdicts. The next
step is always read from the files, never remembered. (Two things live
outside the project: the MCP server counts a step's failures for its own
lifetime, and nmt-forge keeps one machine-wide training queue in
`~/.nmt-forge`.) Change a file by hand, then ask for the next step, and the answer
reflects the change.

This page is the map. The operating rules are in
[the contract](/docs/agents/contract); the tool calls are in
[MCP](/docs/agents/mcp) and [the shell](/docs/agents/shell).

## The tools

| Tool | Install | What it does on the rails |
|---|---|---|
| `champollion` | npm (Node 20.11+) | Starts projects, brings data in, records its terms, names the next step, runs the improve rounds, connects a model to an app |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | Trains, screens, splits, records predictions, scores models on the test set and exports them, serves them; keeps the ledger |
| `mt-eval` | comes with `nmt-forge` (the `mt-eval-harness` package) | Runs a method over a test set, a file or a request; applies gates; scores |
| `champollion-mcp-server` | npx | Drives the `champollion` CLI as bounded child processes; the rails profile is six tools |

Each tool runs as its own process. The MCP server runs the same commands a
person types (its `run_next_step` refuses any program other than
`champollion`, `nmt-forge`, and `uv tool install … nmt-forge`).

## The project tree

`champollion new <folder> --from <language> --to <language>` writes:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

It refuses a folder that already holds a project (exit 1) or any
non-hidden file (exit 1), and a `kind` other than `language`: `task` and
`service` projects are not on the rails yet. `--dry` resolves the languages
and writes nothing.

The steps add the rest as they run:

| Path | Written by | Holds |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — the terms of the file beside it |
| `data/combined-from/` | `champollion data combine` | the originals combine joined (moved, never deleted) |
| `data/not-for-training/` | `champollion data combine` | files whose holders said no model may learn from them |
| `.forge/` | `nmt-forge init` | the workshop: `eval-registry.json`, `ledger.jsonl`, preregistrations, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | the training config (a model preset expanded into explicit numbers) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | the screened training pairs |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | the dev set; each round's training file |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | sentences the speaker wrote for the dev set — role `dev`, local-only, never trained on |
| `improve/time.json` | `champollion improve time` | the speaker's time, in their words |
| `improve/round-<k>/` | the improve steps | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (which rows the other model drafted — a newer one not in use, or the one a promotion replaced: row numbers, run names, the relation and each model's training-pair count — and, from round 2, `repeat_rows`: the rows shown again, each `row`, `from_round`, `from_row` and the earlier `mark`), `marks.json` (the counts, the share right with its interval, `blind`, and `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | an exported model and its method.json |
| `deploy/<name>.json` | `nmt-forge export` (inside a rails project) | deployment/1 — what is deployed |
| `gates/*.json` | people | gate-chain/1 — checks between output and what ships |
| `methods/<id>/method.json` | people | method/1 (also written by `nmt-forge export` into a model folder, `mt-eval export` and `champollion serve --emit-manifest`) |

## The formats

Six framework schemas live in `shared/schemas/framework/`. Each document
names its schema in `$schema`. Unknown keys are refused; a key of your own
goes under `x-`.

| Format | `$schema` | Where | What it is |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | Decisions only: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | A data file's terms: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, registration fields, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | One method: `id`, `name`, `kind` and that kind's one setting, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | Ordered `metric-threshold` gates and an optional `fallback` |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | One method, its gates, one pair; optional `serve` host and port |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | the `/translate` contract | Request, response, error and `/health` documents |

`project.defaults` — what data added to the project gets when nobody says
otherwise. `champollion new` writes `{"transmission": "local-only",
"training": "ask", "share_scores": "ask"}`. The values: `transmission`
`local-only` or `ask`; `training` `allowed`, `not-allowed` or `ask`;
`share_scores` `never` or `ask`. `ask` makes the tools stop and ask — the rails
never invent an answer.

Two more records are not framework schemas but are part of the model:

- **The forge ledger**, `.forge/ledger.jsonl`: append-only and hash-chained
  (each entry embeds the hash of the one before; `nmt-forge ledger verify`
  fails on any edit). It records registrations, every read of a registered
  set, preregistrations, scores, sealed-set spends, overrides, leak-audit
  verdicts, the dictionary floor, exports, choices, serves, round verdicts
  (`improve-compare`: `better`, `worse`, `no-change`, or `too-few` under 50
  dev sentences), how each round trains (`round-plan`), the other model's
  drafts for a review sheet (`draft-newer`: run names, `relation`, each
  model's training-pair count and a count of drafts), the speaker's blind
  verdict on a newer model (`improve-speaker`: run names, four counts, `z`,
  `clear`), model changes (`model-change`, including a `not-now`) and what
  `nmt-forge tidy` removed (`tidy`: runs and bytes). Counts, hashes and
  paths — never a sentence. It is tamper-evident
  bookkeeping, not cryptographic security.
- **The run card**: what `mt-eval run` records for a scored run, and what a
  published result carries. See the [run card spec](/docs/network/specifications/run-card).

**Lock.** `champollion validate [folder]` checks the project file, every
sidecar, every `method.json` (at the root, in `methods/*/` and
`.champollion/methods/*/`), `gates/*.json` and `deploy/*.json` against these
schemas. The harness reads the same files with the same verdicts. Exit 0 = no
errors, 1 = a document is invalid, 2 = usage error. It opens only these JSON
files, never a data file.

`champollion upgrade [folder]` rewrites sidecars written before set/1 (no
`$schema`) as set/1, keeping every value (a key set/1 does not know moves
under `x-<key>`). It leaves an invalid sidecar alone, and lists an older
`method.json` without changing it: every tool still reads it, as method/0,
with a warning.

## The one pipeline

Every way a method meets text is one pipeline in the evaluation engine:

1. **Admit.** The input's terms are read (the set/1 sidecar, a JSON
   envelope, the registry entry) and its transmission policy is resolved and
   enforced before anything is translated. A channel the policy does not
   allow is refused here (see [data rules](/docs/agents/data-rules)).
2. **Method.** One method translates (method/1 kinds: `llm`, `llm-coached`,
   `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`,
   `human`).
3. **Gates.** If a gate chain is named, each segment is judged; the first gate
   that refuses decides what ships (`drop`, `keep-source`, `flag`,
   `fallback`). See [methods and gates](/docs/agents/methods).
4. **Outputs.** The run log is written; files carved from a marked input carry
   its terms in a sidecar beside them.
5. **Metrics.** Only when references exist: the headline scores what shipped,
   the ungated score sits beside it. See [measurement](/docs/agents/measurement).

The modes are the same pipeline on different input:

| Mode | Command | Input | Metrics |
|---|---|---|---|
| Measure | `mt-eval run` (`mt-eval test` re-scores a run log) | a test or dev set | yes |
| Translate a file | `mt-eval translate --out <file>` | source-only | no |
| Serve | `mt-eval serve` | one request at a time | no |

**A deployment is the measurement pipeline on source-only input.** One
deployment/1 file is tested (`mt-eval run --deployment`), run over a file
(`mt-eval translate --deployment`) and served (`mt-eval serve --deployment`),
so what was measured is what ships. With `--deployment`, the flags the file
decides (`--method`, `-m`/`--model`, `--gates`, `--target-script`) are refused.
A deployment names no score: a measured number is a run result, kept with the
run. See [serving](/docs/agents/serving).

## The journey, as data

The order of the work is a file: `shared/journeys/language.json`. The
evaluator, `cli/lib/framework/journey.js`, is the one reader;
`champollion next`, the MCP rails profile and `NEXT.md` all ask it the same
question. **The first step not done is the next step.** It reads only
sidecars, the project file and forge's registry and ledger — never a data
file's text — and runs nothing except `nmt-forge --version` (bounded at
30 s) for the install step and `nmt-forge status --json` (bounded at 60 s)
once the work reaches training.

**Stages.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

**A step** has an `id`, a `stage`, a `mode`, plain words to tell the person
(`say`) and why it matters (`why`), and usually a `command`. Optional fields:

| Field | Meaning |
|---|---|
| `done_when` | The check that says the step is done. Required (except on a delegating step) |
| `when` | A check that must hold for the step to apply at all (the dictionary floor applies only when `data/lexicon/` holds a file) |
| `question`, `answers` | An `ask_user` step's question and its answer slots: `{"enum": [...]}` or `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | What an agent does itself for a person's step (bring the named files in with `add_data`) |
| `outdated` | A variant used when the check finds the tool too old |
| `delegate` | `"nmt-forge"`: hand over to forge's own advisor |

`{placeholders}` in `say`, `question` and `command` are filled from the project
file and the files found.

**Checks** are a closed set; the evaluator throws on an unknown one:
`project_valid`, `data_files`, `every_data_file_has_terms`,
`protected_test_set`, `tool_on_path` (with `min_version`), `path_exists`,
`forge_test_registered`, `single_file`, `forge_role_registered`,
`forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`,
`improve_prepared`, `forge_trained_on_current`.

**Modes:**

| Mode | Who acts | What the rails allow |
|---|---|---|
| `auto` | the agent | run the command |
| `confirm` | the agent, after a yes | installs, training, anything that spends or publishes; run only after the person says yes |
| `ask_user` | the person answers | ask `question`; pass their answers by the keys in `answers`; never answer for them |
| `wait` | nobody | something is running; ask again later |
| `human_only` | a person | gather sentences, mark drafts, choose |
| `use_tool` | the agent, with its own tool | MCP only: a `human_only` step with an `agent` field is shown as `use_tool` with `step.tool` |

**Delegation.** At the `forge` step the journey asks `nmt-forge status
--json` and takes forge's state as the step. Forge's states map to modes:
`training` → `wait`; `ready-to-train` and `needs-training-extra` → `confirm`;
`missing-preregistration` → `ask_user`; `choose-export` → `human_only`;
`improve-compare` → `auto`; `improve-promote` → `confirm`;
`improve-stronger-model` → `ask_user`. Any other state is `auto` when forge
names a command, `human_only` when it does not. A state of `serving` ends the
build stage and the improve stage begins.

Two kinds of step come from outside the step list:

- **Judging the prediction.** After an export scored on the test set, a
  prediction the people wrote in their own words waits for their verdict: an
  `ask_user` step with `answers` `verdict` (`held` or `missed`) and `by` (who
  judged it), which runs `nmt-forge prereg verdict`.
- **Waiting for agreement.** Every file whose sidecar says `speakers_agreed:
  not-yet` becomes its own `ask_user` question in `waiting`, answered by its
  own step id whenever the person has the answer. It never holds up the rest
  of the rails.

**The step id** is `<journey step id>:<8 hex characters>` — a hash of the step
and its filled command. If the project changes, the id changes, and a
`run_next_step` with the old id is refused (`the project changed since that
step was named`).

**What `champollion next --json` returns:** `project`, `kind`, `stage` (`n`,
`of`, `id`, `title`), `done` (step ids), `step` (`id`, `mode`, `say`, `why`,
and where present `command`, `question`, `answers`, `agent`, `agent_tool`,
`file`, `source`), `now` (forge's facts — what is true right now), `waiting`,
`forge` (`state`, `blockers`, `warnings`), `finished` (when no step is left)
and `error`. Exit 1 when there is an error and no step.

## Refusal shapes

Every refusal says what happened, and most say why and the fix.

| Tool | Human output | Machine output | Exit |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, then `  why: …` and `  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` on stdout | 2 refused |
| `champollion` | `[ERR] message` on stderr | `--json` where the command supports it | 1 refused, 2 usage |
| MCP rails tools | — | `{"refused": "<reason>", …}` with `isError: true`, plus the retry where there is one (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

`type` in forge's error is the exception class (`UsageError` for bad
arguments — forge refuses abbreviated flags rather than guess). Forge's guard
names include `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` and `disk-room` (a
training run the disk cannot hold). When an error
would quote a sentence of a withheld corpus, the sentence reads
`[sentence withheld]` and the object adds `text_withheld`.

Relay a refusal in plain words and follow its fix, or ask for the next step
again. A step that failed twice is not run again until the person decides
([MCP](/docs/agents/mcp#when-a-step-fails)).

## Go deeper

- [The operating contract](/docs/agents/contract) — the rules, locks and notes.
- [Driving the rails over MCP](/docs/agents/mcp) and [from the shell](/docs/agents/shell).
- [Data and transmission rules](/docs/agents/data-rules) — set/1 in full.
- [Methods and gates](/docs/agents/methods) and [serving](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1.
- [The run card spec](/docs/network/specifications/run-card) and the
  [harness spec](/docs/network/specifications/harness).
- [`mt-eval` command reference](/docs/reference/mt-eval) and the
  [`nmt-forge` command reference](/docs/network/getting-started/forge-command-reference).
