---
title: Driving the rails over MCP
slug: /agents/mcp
description: "Connect an MCP client to Champollion's rails profile and walk a language project with six tools: setup per client, every argument and return, the loop, the step modes, refusals and the explain topics."
---

# Driving the rails over MCP

The MCP server's default profile is the rails: six tools that walk one
language project from an empty folder to a measured model on the person's
own computer. Each tool runs the `champollion` CLI as a separate, bounded
process — the same commands a person types. The server also hands your client
short operating instructions (`instructions-rails.md`) at connection time.

## Connect

The server speaks MCP over stdio and needs Node.js 20.11 or newer. The
configuration every file-configured client takes:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| Client | Where it goes |
|---|---|
| Claude desktop | Settings → Developer → Edit Config. Add the entry, save, restart the app |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | `mcp.json` in the project's `.cursor` folder, or in `.cursor` in the home folder |

Other clients that can start a local stdio server take the same command; this
page describes only the three above.

**Tool paths.** The server finds the CLI it depends on by itself. It finds
`nmt-forge` on `PATH`, then in `UV_TOOL_BIN_DIR` (default `~/.local/bin`,
where `uv tool install` puts it) — a client launched from a desktop app often
has a shorter `PATH` than a terminal. Overrides, as environment variables in
the server entry's `env`:

| Variable | Effect |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails` (default) or `full` |
| `CHAMPOLLION_CLI_BIN` | the `champollion` CLI entry point to run instead of the bundled one |
| `NMT_FORGE_BIN` | the `nmt-forge` executable (the CLI's journey honours the same variable) |
| `UV_TOOL_BIN_DIR` | where to look for `nmt-forge` and `uv` after `PATH` |

## Profiles

| Profile | Select with | What it is |
|---|---|---|
| rails | the default | Six tools and short instructions; one language project, end to end |
| full | `--profile full` in `args`, or `CHAMPOLLION_MCP_PROFILE=full` | Every tool: language cards, corpora, benchmarks, the queue, contests, forge training, publishing |

Any other value stops the server: `unknown MCP profile "<value>" (rails or
full)`. The full set is catalogued on
[the MCP server page](/docs/network/getting-started/mcp-server). For a
language project, stay on the rails profile: it is the one whose every step
is read from the project's files.

## The loop

1. No project yet → `start_project`. Its first call makes nothing: say its
   `ask_first` to the person, then make the call it gives for their answer.
2. `project_status` → read `step.mode`, `step.say`, `step.why`.
3. Do what the mode says, using `step.call` — the exact call that takes the
   step.
4. Back to 2. After any change you or the person made by hand, call
   `project_status` again: the next step is always read from the files.
5. `step: null` → the rails are done. Tell the person what `finished` says.

| `step.mode` | Do this | `step.call` |
|---|---|---|
| `auto` | Run it | `run_next_step` with `project_dir`, `step_id` |
| `confirm` | Tell the person what it does (installs, training); ask yes or no; only on yes, run it. On "not now", record it: nothing runs | `run_next_step` with `confirmed: true` added after the yes; `declined: true` on "not now" |
| `ask_user` | Ask `step.question` in plain words; pass their answers by the keys in `step.answers`. On "not now": when `not-now` is one of a slot's own `enum` values, it is an answer — pass it; otherwise record it: nothing runs | `run_next_step` with `answers` — each slot written `<…>`, to be replaced by the person's words; `declined: true` on a "not now" that is not one of the answers |
| `wait` | Something is running | `project_status` with `wait_seconds: 120`; repeat while the mode stays `wait` |
| `use_tool` | You do it now with `step.tool`; do not hand it back | e.g. `add_data` with `path: "<each file the person named, where it is>"` |
| `human_only` | A person does it: tell them `step.say` | none |

`step.command` is what the rails run — never a tool name. A `<…>` in a call is
a slot for the person's answer or file; a slot sent back as it is gets
refused.

## The six tools

### `start_project`

| Argument | Type | Meaning |
|---|---|---|
| `folder` | string, required | New folder for the project, relative to `parent_dir` |
| `from` | string, required | The language people put in: a code or a name |
| `to` | string, required | The language that comes out: a code or a name |
| `target_name`, `source_name` | string | The language's name as its people say it; required for a private-use code (`qaa`–`qtz`) |
| `purpose` | string | What the translations are for, in the person's words |
| `parent_dir` | string | Where to create the folder (default: the server's working directory) |
| `confirmed` | boolean | `true` only after the person agreed to the direction |

Without `confirmed: true` it runs `champollion new --dry` and returns
`made: false`, `ask_first` (a sentence to say: *"This translator takes X and
gives back Y — you put X in, and Y comes out. Is that the way round you
want?"*), `if_yes` and `if_the_other_way` (each a complete call) and
`languages` — what each name resolved to, with `matchedAs` when the person's
word is another name a card records, and `alsoNamed` when the same word names
other languages. Say both back. With `confirmed: true` it makes the project
and returns `project`, `languages` and `next` (the first step).

A name no card carries and no close one: the refusal adds
`if_it_has_no_code`, the same call with `to: "qaa"` and their name as
`target_name`. Use it only for the name the person gave.

### `project_status`

Arguments: `project_dir` (required); `wait_seconds` (0–120). With
`wait_seconds`, it re-reads every 5 seconds while the step is `wait`, and
returns when the step changes or the time runs out.

Returns `project`, `stage` (`"2/6 Gather your data"`), `step` (`id`, `mode`,
`say`, `why`, `call`, and where present `question`, `answers`, `command`,
`tool`, `for_the_person`), and these when they apply:

| Field | What it is | What you do |
|---|---|---|
| `true_now` | Forge's own record, as sentences: models trained and their best dev chrF++, the leak audit's verdict per test set, test-set scores, whether training is running, whether a model is served and where | Say what has been done only from these lines, never more |
| `waiting_for_agreement` | Files whose speakers have not agreed yet (`speakers_agreed: not-yet`): each with `file`, `question`, `say` and its own `call` | Ask each question once a session, gently; make its call only when the person says everyone agreed |
| `files_not_added` | Files `add_data` refused this session that are still not in the project, each with its refusal | Bring each in (its refusal says how), or tell the person which is left out and why |
| `model_in_use` | Once a model is served, beside the improve rounds' steps: `say` (its try page and how it is used) and `for_the_person` (the `champollion connect` command that puts it into their app or website) | Tell the person once; they run connect when they want it |
| `blockers`, `warnings` | Forge's, verbatim | Pass them on word for word |
| `finished` | When no step is left: what the people can do now (try the model on its page; an app) | Tell the person |
| `error` | Why no step could be named | Relay it |

A project folder that does not exist, or has no `champollion.project.json`,
is refused with the projects found nearby.

### `run_next_step`

| Argument | Type | Meaning |
|---|---|---|
| `project_dir` | string, required | The project folder |
| `step_id` | string, required | The `step.id` (or a `waiting_for_agreement` entry's id) just returned |
| `answers` | object of strings | `ask_user`: the person's answers by the keys in `step.answers` |
| `confirmed` | boolean | `confirm`: `true` only after the person said yes. Also: a step that failed twice, only when the person says to try it again as it is |
| `declined` | boolean | `true` when the person said not now to a `confirm` step, or to a question with no `not-now` answer of its own: nothing runs, and it is not asked again this session. Where `not-now` is one of the answers, pass it in `answers` |

It reads the next step again before it runs anything. **Locks:**

- A different id is refused: `the project changed since that step was named
  — call project_status again`, with `current`.
- `human_only` is refused (`a person does this step: …`); a `human_only` step
  an agent does with a tool is refused with the tool to use.
- `wait` is refused; `confirm` without `confirmed: true` is refused (`ask the
  person first, then call again with confirmed: true`).
- `ask_user`: every answer is required (`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>` placeholder is
  refused; an answer outside an `enum` is refused.
- Only the rails' own programs run: `champollion`, `nmt-forge`, and `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` or a
  lone `&` is refused; `&&` joins parts, run in order, stopping at the first
  failure.
- Each part is bounded at 10 minutes (the `uv` install at 15).
- `declined: true` on a step that is neither `confirm` nor `ask_user` is
  refused: `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- `declined: true` on a step whose `answers` include `not-now` (today, the
  stronger-model offer's `try_it`) is refused, and the refusal carries the
  step's `answers`: `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

Returns `ran` — per part: `command`, `exit_code`, `timed_out` when it did, and
the last 40 lines of `output` — and `next`, the next step in
`project_status`'s shape.

#### "Not now"

There are two ways to record it, and the step decides which:

| The step | "Not now" is | What it records | When it comes back |
|---|---|---|---|
| An `ask_user` step whose `answers` include `not-now` (the stronger-model offer: `try_it`, `yes` or `not-now`) | An answer: `answers: {"try_it": "not-now"}` | Forge's ledger (`model-change`, `answer: "not-now"`); nothing else changes | After two more rounds the dev set judged **no-change** or **worse** — across sessions |
| A `confirm` step (training, an install, putting a model to use), or a question the person can't answer yet | `declined: true` | This server's memory only | When the server restarts (the next session) |

`declined: true` runs nothing and returns `declined` (the step id), `ran: []`,
`say` (*"Nothing ran. It is not asked again this session; if they bring it up
and say yes, take it then."*) and `next`. The decline is kept for the
server's life — one session; a restarted server has forgotten it. While it
stands, that step comes back from `project_status` and `run_next_step` with
`declined_this_session` (when, as an ISO time) and its `say` beginning *"They
said not now (HH:MM UTC) to this: …"* and ending *"Do not ask again this
session — nothing that needs their yes runs. If they bring it up themselves
and say yes, take it with confirmed: true (or their answers)."* A later
`confirmed: true`, or answers, takes the step and clears the decline.
**Note.** Don't ask again this session, and don't route around the step; if
the person brings it up and says yes, take it then.

#### When a step fails

**Lock.** A step that failed twice in a row (non-zero exit or timeout, counted
for the server's lifetime) is refused a third time unless `confirmed: true`,
with its `last_output`. **Note.** That flag is yours to set: tell the person
what it said, and either they fix it (a corrected command run in a terminal is
fine — then call `project_status`), or they say to try again as it is.

### `add_data`

| Argument | Type | Meaning |
|---|---|---|
| `project_dir` | string, required | The project folder |
| `path` | string, required | The file where it is: absolute, or relative to the project folder or to where the server started |
| `into` | `parallel` (default) · `test` · `lexicon` | Pairs to learn from; the checked test sentences; a word list |
| `source_col`, `target_col` | string | A column as a letter (`A`), a number, or its header; for ELAN, the tier number the refusal lists (or an exact tier id the person typed); for LIFT, a language code |
| `sheet` | string | Which sheet or table, when there are several |
| `header` | boolean | `true`: the first row is a header; `false`: it is data |
| `usfm_source` | string | USFM scripture only: the other language's text (a `.usfm` file or folder) |
| `replace` | boolean | Read a file already added again (another header or columns); its holders' answers are kept |

It runs `champollion data add`. Call it with just the path first: a header
naming the pair's languages decides the columns; otherwise it asks, and you
ask the person — never decide from the content. It reads spreadsheets
(`.xlsx`, `.ods`, `.csv`), `.tsv` and `.txt`, tables in Word `.docx`, Toolbox
and LIFT dictionaries, ELAN `.eaf` files and USFM.

Returns `result` (the CLI's report: counts, columns, ELAN tiers by number, and
the row numbers its check of the rows names — copies, repeats, odd lengths,
swapped or shifted rows, nothing removed — never sentences), `read_from` when
the file was found from the server's starting folder, and `also` when the
file holds more (a dictionary's example sentences as pairs, or its glosses as
a word list) — each entry a complete `add_data` call. Make it unless the
person's terms for that file rule it out. Pass the row check on as it is: the
person looks at those rows in their own file
([data rules](/docs/agents/data-rules#what-tools-print-and-never-print)).
Never ask the person to move a file; `inbox/` is only a place they may drop
one.

### `try_translation`

Arguments: `project_dir`; `text` — up to 10 lines, at most 2,000 characters,
one sentence per line, words the person gave you.

It finds the model this project serves (the newest healthy `serve` job in
`nmt-forge jobs --json`), on this computer only, and reads its `/health`.

- **Lock.** If `output_local_only` is not `false` (true, or unknown), it
  returns no translation: `shown_to_person_only: true`, `open` (the model's
  own page) and `say`. Send the person there; do not ask them to paste its
  translations back to you.
- A server that asks for a token is refused: tokens are never handed to an
  agent.
- Otherwise it returns `model`, `pair`, `translations` (`source`,
  `translation` per line), `errors` if any, and `say`: pass them on as they
  are; the server checks nothing it returns.

### `explain`

Argument: `topic`. Plain-words texts to pass on:

| `topic` | Covers |
|---|---|
| `rails` | The project folder and the order of the steps |
| `privacy` | What the sidecar means; why you never open the files |
| `quality` | What a score promises and does not |
| `modes` | How to take each kind of step |
| `improve` | The rounds after a model is in use: about one review row in ten *"comes back from an earlier sheet on purpose (the sheet says so …)"*; a better model is offered for use and the people say yes (*"a verdict alone changes nothing"*); the too-few verdict; the stronger-model offer after *"two rounds in a row that the dev set could judge show no gain (counted from the last model put to use)"* |
| `off_rails` | Stepping off: run an expert command, then call `project_status` |

## Notes for the whole session

- **Note.** Everything you read goes to your model provider. `add_data`,
  `project_status` and `run_next_step` report counts, columns and states, never
  sentences; keep it that way. Do not open the files yourself.
- **Note.** The `ask_user` answers, `confirmed: true` and the
  `waiting_for_agreement` yes are the person's. The tools check that an answer
  is present and well-formed; only you can make sure it is theirs.
- **Note.** Relay `blockers`, `warnings` and every caveat word for word, and
  every number with its unit and the set it was measured on
  ([coaching](/docs/agents/coaching)).

## Go deeper

- [The operating contract](/docs/agents/contract) — locks and notes.
- [The rails model](/docs/agents/rails-model) — the journey, the modes and the
  step ids these tools read.
- [Driving the rails from the shell](/docs/agents/shell) — the same steps as
  commands.
- [The MCP server](/docs/network/getting-started/mcp-server) — both profiles
  and the full tool catalogue.
