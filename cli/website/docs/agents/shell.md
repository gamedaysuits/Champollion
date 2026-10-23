---
title: Driving the rails from the shell
slug: /agents/shell
description: "Every rails step as an ordinary command: install, start a project, bring data in, record its terms, train and test a model with nmt-forge, run the improve rounds, translate and serve with mt-eval — plus offline mode, the environment variables the tools read, and exit codes."
---

# Driving the rails from the shell

Every step on the rails is an ordinary command. An agent without MCP — or a
person at a terminal — walks the same rails with three programs:
`champollion`, `nmt-forge` and `mt-eval`. The order never has to be
remembered: `champollion next` names the next step, with its mode and the
exact command, read from the project's files.

The rules are the same as over MCP. A `confirm` step runs only after the
person says yes; an `ask_user` step's answers are theirs
([the contract](/docs/agents/contract)).

## Install

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**Note.** Both download packages: `confirm` mode — ask first. If `uv
--version` fails, the person installs uv from https://docs.astral.sh/uv/;
an agent does not download installers. Training also needs forge's training
extra (PyTorch and Hugging Face transformers, several hundred MB). Forge names
it when it is missing (state `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

The rails need `nmt-forge` 0.3.0 or newer; an older one is named with its
upgrade command (`uv tool install --upgrade --python 3.12 nmt-forge`).

## The loop

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

`How:` in the human output is the mode: `run it` (`auto`), `ask first, then
run it` (`confirm`), `ask the person who holds the data — never answer for
them` (`ask_user`), `wait, then ask again` (`wait`), `a person does this`
(`human_only`). Run the command it names, then ask again. Stepping off the
rails is fine — run any expert command, then `champollion next`: the next step
is read from the files.

## Start

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

Languages are codes or names, resolved through the language cards. A variety
with no code takes a private-use code (`qaa`–`qtz`) and the name its people
give (`--target-name`, `--source-name`). **Note.** Say the direction back
before the project is made: `--dry` resolves both languages and writes
nothing. Pass each language exactly as the person named it.

## Gather and record terms

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` reads `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, Word `.docx`
tables, Toolbox and LIFT dictionaries, ELAN `.eaf` and USFM
(`--usfm-source`). It writes `<stem>.tsv` and its sidecar, leaves the original
untouched, and prints counts, columns and the row numbers its check of the
rows names (copies, repeats, odd lengths, swapped or shifted rows — nothing
is removed) — never sentences. When it cannot tell which column (or ELAN
tier, by number, or LIFT language) is which, it refuses and asks; ask the
person. `--replace` reads the same original again with other columns, keeping
the holders' answers; `--name <stem>` adds another file under another name.
See [data rules](/docs/agents/data-rules#what-tools-print-and-never-print).

Then the terms, one file at a time, from the person's answers:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

`--local-only` or `--may-leave` is required on a file not yet local-only.
The journey's terms step asks about each file in `data/parallel/`,
`data/lexicon/`, `data/grammar/` and `data/monolingual/` until both its
training answer and `--speakers-agreed` are recorded. Every value is the
holders' — see [data rules](/docs/agents/data-rules) for what each does and
what the command refuses.

## Protect the test set

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## Build and test a model

The journey names these in order (their `{placeholders}` filled from the
project):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` picks the strongest model this computer can train in
  hours, by its memory ([training](/docs/agents/training#models)). With a
  language card, `--no-card --name` is left out.
- `data combine` runs only when `data/parallel/` holds more than one file. It
  keeps the strictest terms of the files it joins and refuses a file whose
  holders have not answered yet — whether a model may learn from it, and
  whether everyone whose words are in it agreed.
- `prereg new` is an `ask_user` step: `--expect` and `--rationale` are the
  people's words, exactly as they said them, written before any score exists.
  The question suggests no number, and neither do you.
- The dev size the journey fills in (`dev_n`) is one in ten of the screened
  pairs, at least 50 and at most 500; with fewer than 200 pairs it is a
  quarter of them instead, so training keeps most — and that is under 50.
  So: 40 dev sentences from 160 pairs, 50 from 200 to 500 pairs, 160 from
  1,600, 500 from 5,000 or more. Under 50, no round can be judged on the dev
  set ([measurement](/docs/agents/measurement#comparing-two-models)).
  `--near-dupe 0.6` keeps near-copies on one side; `--max-group` is half the
  dev size, rounded down, plus one.
- `floor` applies only when `data/lexicon/` holds a word list.

From here, forge's own advisor names each step. `champollion next` relays it;
`nmt-forge status` says it directly:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

Training is `confirm` (it spends compute, minutes to hours); while a detached
run trains, the step is `wait`. `nmt-forge run` refuses a run the disk cannot
hold before it starts (`[disk-room]`), with the free space, its estimate and
what `nmt-forge tidy` would free; `nmt-forge tidy --yes` frees it, and
`--skip-disk-check` on `run` starts anyway, recorded in the run. Those two are
the person's call, not yours ([training](/docs/agents/training#disk-space)).
The export scores the model once on the test set, against the prediction.
Choosing among several exports is the person's
(`nmt-forge choose <model folder>`). After a test-set score, the people judge
their prediction:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed` when it did not hold; `--prediction` is the prediction's number,
1 for a single `--expect`; `--by` names who judged it, as they said.) See
[training](/docs/agents/training) for every forge command and refusal.

## The improve rounds

Once a model is served, rounds begin:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: while the dev (practice) set is under 200 sentences, some
  rows have no draft — one in two while it is under 50, one in four from 50
  — and the speaker writes them. `improve marks` writes them to `data/dev/`
  and `improve prepare` adds them to the dev set (`nmt-forge grow-dev`),
  never to training. It also runs `nmt-forge draft-newer`. When there is
  another model — the newest trained one when it is not in use (not put to
  use after its round: too few to tell, no measurable change, or worse), or,
  after a promotion, the model the one in use replaced — that model drafts a
  random half of the drafted rows, unmarked, and the key stays beside the
  sheet (`sheet-key.json`). `improve marks` then counts each model apart —
  the blind comparison, which after a promotion is the check the report
  needs before it calls a rise real progress
  ([measurement](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, from round 2: one row for every 10 new sentences
  (rounded down) is a draft the speaker marked `Y` or `N` on an earlier
  sheet, back unmarked at a random place. The sheet's first line says a few
  rows come back on purpose, never which; `sheet-key.json` lists them
  (`repeat_rows`). The command prints how many came back, *"(which ones is
  not marked)"*, and that they take *"about 10 seconds a row, never trained
  on again"*.
- `improve marks` judges a row shown again only against the speaker's
  earlier mark — never in the round's share, the training pairs or the
  blind comparison — writes `repeats` into `marks.json`, and prints *"Rows
  shown again: the speaker marked A of J the way they did before (P%) — W
  once wrong now right, R once right now wrong. Not counted in this round's
  share, and not trained on again."*
- `improve marks`, when the other model is the newer one and the speaker
  judged at least one draft of each, records the counts with forge (counts
  only, never a sentence):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  When the speaker marked the newer model right clearly more often, it
  prints *"forge recorded it: it offers to put the newer model to use (the
  people say yes first)"*; when forge is not installed or refuses, it says
  that the marks were not recorded, and why.
- `improve prepare` ends with `nmt-forge round-plan`: the round continues
  from the model in use (4 passes over all the sentences so far) or trains
  from the start, and says why ([training](/docs/agents/training#the-improve-rounds)).

Forge then judges the new model against the one in use
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`), and offers to put it to use (`confirm`) only if it is measurably
better — or, where the verdict was too few to tell (under 50 dev sentences)
or no measurable change, once the speaker's blind marks clearly preferred
it. A verdict alone puts nothing to use: only the people's yes (that step's
`nmt-forge export` and `nmt-forge choose`) does. The new pairs from `improve marks` get their own terms first — the
journey asks. How to relay the report: [coaching](/docs/agents/coaching).

## Translate and serve with mt-eval

`nmt-forge export` inside a project writes `deploy/<name>.json` (deployment/1).
The same file measures, translates and serves:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **Note.** `mt-eval run` on a test file needs no preregistration — it only
  logs the read. Score the test set through `nmt-forge export` (or after the
  prediction is written), never before.
- `--gates gates/<chain>.json` adds a gate chain to `run`, `translate` or
  `serve` (without `--deployment`); `run` and `test` refuse a chain that falls
  back. See [methods and gates](/docs/agents/methods) and
  [serving](/docs/agents/serving).

## Off the rails: what exists for a language

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## Check and upgrade the files

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## Offline

`CHAMPOLLION_OFFLINE=1` stops the `champollion` CLI from touching the network:
language cards come only from the bundled set and the local cache (a
long-tail card is not fetched), the daily card-cache refresh is skipped, and
`register-corpus` does not compare a file's hash with the public catalogue
(it records the comparison as not made). It does not change what a method
sends: a method that calls a provider still needs the network, and the
transmission rules still apply.

`MT_EVAL_NO_REMOTE_REGISTRY=1` stops `mt-eval` fetching its dataset registry
from the web (for an air-gapped machine).

What needs the network on the rails regardless: installing the tools, the
training extra, and a pretrained model's first download (`byt5-small` or
`byt5-small-lowmem`, about 1.2 GB; `cpu-tiny` downloads nothing).

## Environment variables

Read by the code, for an operator. Provider API keys are needed only by
methods that call a provider, never on the rails' default path.

| Variable | Read by | Effect |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | MCP server | `rails` (default) or `full` |
| `CHAMPOLLION_CLI_BIN` | MCP server | The `champollion` entry point to run |
| `NMT_FORGE_BIN` | `champollion`, MCP server | The `nmt-forge` executable |
| `UV_TOOL_BIN_DIR` | `champollion`, MCP server | Where to look for `nmt-forge` and `uv` after `PATH` (default `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: no network for cards or catalogue lookups |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | The per-user card cache (default `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | How often the card cache is checked for updates (default 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | Pins the preset `auto` picks (must be a preset name) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | Default port (8378 without it) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | The bearer token; required off loopback |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: no live training panel |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | The bearer token (never a command-line value) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | The bearer token for the CLI's own server |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: no registry fetch |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | Where registered datasets' paths are resolved first |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | The default hosted-model provider's key |

## Output for programs

| Tool | Machine output | Exit codes |
|---|---|---|
| `champollion` | `--json` on the rails commands (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 ok · 1 refused · 2 usage |
| `nmt-forge` | `--json` on every subcommand: one JSON document on stdout, everything else on stderr | 0 ok · 2 refused (`{"error": …}`) |
| `mt-eval` | `--json` and `--non-interactive` on every subcommand | 0 ok · non-zero refused |

Refusal shapes: [the rails model](/docs/agents/rails-model#refusal-shapes).

## Go deeper

- [The `champollion` command reference](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) and
  [`mt-eval`](/docs/reference/mt-eval).
- [The rails model](/docs/agents/rails-model) — the journey and `next --json`.
- [Driving the rails over MCP](/docs/agents/mcp) — the same steps as six tools.
- [Training with nmt-forge](/docs/agents/training) and
  [data rules](/docs/agents/data-rules).
