# champollion-mcp-server

MCP (Model Context Protocol) server for Champollion. Lets an AI agent take a person from "we want machine translation for our language" to a measured, deployable model — find the language and what exists for it, keep the community's data private, baseline existing models (including ones on your own machine), train with guardrails, prove the result, and translate — plus browse and run the public benchmark queue.

> **Champollion** is infrastructure for trustworthy machine-translation evaluation across every language — source-available and free for noncommercial use (the evaluation harness and shared registries are open source) — the test sets and the map that show who can translate what, how good each method is, and where the gaps are. Public benchmarks on open data rank every method (human and machine); sovereign benchmarks are secret community-owned test sets we never see. The infrastructure is source-available and singly stewarded; the test sets and the methods for a community's language belong to that community — designed to work with communities, never hosting their corpora. This server is the agent-facing door into that network ([champollion.dev/docs/network](https://champollion.dev/docs/network/)). This server itself is PolyForm Noncommercial 1.0.0 (see [LICENSE](LICENSE)): free for noncommercial use; using it for a commercial purpose is not covered by this license. Who is covered, in plain words with examples: [Who may use this](https://champollion.dev/docs/getting-started/who-may-use-this).

## What it does

When connected to an agent (Claude Code, Cursor, …), the server exposes tools, resources, and prompts built around one flow: **"let's build a model for our language — how do we start?"** — discover what exists → protect your own data → baseline → build → prove → deploy. (Contributing compute to the public benchmark is the second flow.)

### Tools

Arguments: `name` is required, `name?` is optional. Every tool that takes ONE language also accepts it as `language` — `code` / `language` means either name works (pass one). The original names keep working.

#### Discover — what exists for a language

| Tool | Arguments | Type | Description |
|---|---|---|---|
| `search_languages` | `query` / `language`, `limit?` | Read-only | Find a language by name, endonym, code, family or region — misspellings included (no exact hit → the closest names by edit distance, e.g. "Atya" → the Ayta languages). Each result says where the language is spoken (countries, Glottolog's point, macroarea) and its other names — only the facts its card cites, each with its source, so same-named languages can be told apart; a location without a source is never shown, and the line links the language's Glottolog record instead. From an npm install, name-only results are filled in from their published cards first; those rows carry no per-field sources until champollion.dev's card tables are next uploaded, so their lines carry the Glottolog link rather than a location |
| `language_overview` | `code` / `language`, `source?` | Read-only | **Start here.** One page per language: what the index knows, benchmarks, published results, runnable methods + evidence, tooling (FSTs, dictionaries), licence/consent constraints, and numbered next steps naming the exact tool/command |
| `get_language` | `code` / `language`, `format?` | Read-only | The full cited language card — every value with its source, disagreements shown, absences stated. Resolved exactly like the `champollion` CLI (bundled card → per-user cache → champollion.dev's published card tables) |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (at least one), `include_quarantined?`, `limit?` | Read-only | Registered eval corpora (benchmarks) for a pair or family — size, licence, contamination, fetch/gated/quarantined. Metadata only; corpus content is never returned |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` | Read-only | Scored runs from the public leaderboard (cost "unknown" when a run could not be priced — never $0) |
| `get_run_card` | `id` | Read-only | One run card (scores + method/config metadata) by id |
| `get_metric_reliability` | `target` / `language` | Read-only | Which metric to TRUST for a target language — correlations with WMT human judgments ([methodology](https://champollion.dev/docs/network/specifications/metric-reliability)) |

#### Baseline — measure before you build

| Tool | Arguments | Type | Description |
|---|---|---|---|
| `run_benchmark` | one mode: `budget?` or `top?` (queue), `item_id?`, or `corpus?` with `model?` (with `method_dir`: the model the plugin loads), `method?` or `method_dir?` (a method plugin directory; `local-model` needs `model` — it has no default), `allow_model_pair_mismatch?` (`local-model`: an OPUS-MT pair model naming another pair, as a related-language baseline), `attest_local_transport?` (an MT engine or plugin; never for `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (LLM runs: the ISO 15924 script the output must be in, e.g. `Cans` or `Latn` — ask the user when the target's card lists several), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?`, `skip_eval_standard?` (item and corpus runs: score without the FST / the eval-standard metrics, marked not computed), `comet?` (require COMET: refused at confirm while unbabel-comet is not installed — the harness computes it whenever it is), `metricx?` + `metricx_model?` and `fuse?` (item and corpus runs: the harness's opt-in MetricX-24 and FUSE-style comparator — the plan says whether each is installed and what it downloads; refused at confirm while not installed); then `dry_run?`, `confirm?`, `publish?`, `publish_ack?`, `anonymous?` | Action | Run the mt-eval harness: queue items (`budget`/`top`/`item_id`) **or any corpus** — a registry id or a test file you hold — on any model, including one on this machine (`provider: "local"`, `method: "local-model"`, run in-process with no attestation). Plans without `confirm: true` — the plan names the corpus licence and `do_not_train` terms the run accepts (it passes `--yes`) and the target language's `EVAL PACK:` status (a missing FST or runtime never stops the run: FST acceptance is marked not computed; any other missing piece stops it before translating), whether COMET will be computed, and where results and the cache land (a corpus in a folder `mt-eval contest prepare` marks releasable runs into the contest's `runs/`, never into the released folder); **publishes nothing unless `publish: true`** — the plan then lists what goes public (sentence text or scores only, the prompt, the target) and a real publish needs `publish_ack` in the exact words it gives. Returns a job id immediately |
| `get_run_status` | `job_id?` | Read-only | Poll a benchmark job until it completes; refusals (local-only data, licence, NC terms, a missing eval pack) come back as refusals with what is allowed. A long log keeps its first and last lines, with `… [N lines trimmed] …` between. Jobs survive a server restart — see [Local state](#local-state) |
| `preview_publish` | `report`, `scores_only?`, `redact_coaching?`, `anonymous?` | Read-only | What publishing a finished run's `*_report.json` would put on the board — the harness's own `mt-eval publish <report> --dry-run` preview: sentence text or scores only, the prompt or its sha256, the target (normally PRODUCTION) — the exact `publish_ack` words and the exact `publish_report` call that would publish it. It has no `confirm` and cannot publish (MCP annotation `readOnlyHint: true`), so a host that gates writes can allow it on its own |
| `publish_report` | `report`, `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` | Action (writes) | Publish a finished run's `*_report.json` (the MCP twin of `mt-eval publish`) — annotated `destructiveHint` / `openWorldHint`, so a host asks first. Every call first runs the same dry run as `preview_publish`; only `confirm: true` with that exact `publish_ack` publishes. Without `confirm` it returns the preview and writes nothing (kept for older callers; use `preview_publish` to preview) |

#### Build and prove — nmt-forge

The forge tools drive [nmt-forge](https://github.com/gamedaysuits/Champollion/tree/main/forge), a guarded NMT training suite. Install it with `python3 -m pip install nmt-forge` (0.2.0 or later; training and serving backend: `python3 -m pip install 'nmt-forge[hf]'`); the server finds it on `PATH` or in the active Python, or in a clone via `CHAMPOLLION_FORGE_DIR`. No clone is needed otherwise: forge finds language cards on its own (a card directory, a checkout, else the public card index). Without forge, every forge tool returns that install instruction instead of a traceback.

Every forge tool runs `nmt-forge … --json` and returns `{result, summary?, next?}`; a guard's refusal comes back as a tool error with forge's what / why / fix. Every forge tool except `forge_init` takes an optional `project_dir` — the directory forge runs from, as in forge's own `cd <project> && nmt-forge …`; `forge_init` creates it (at `dir`) and returns it as `project`. Training (`nmt-forge run`) and serving (`nmt-forge serve`) outlive any tool call, so they are terminal steps; `forge_status` hands back their exact commands.

| Tool | Arguments | Type | Description |
|---|---|---|---|
| `get_training_guardrails` | `topic?` | Read-only | The training rules extracted from real measured failures (group-disjoint splits, dev-fence, leak audits, preregistration, …) — call before building a pipeline |
| `forge_status` | `workspace?`, `project_dir?` | Read-only | Where am I in a forge project (initialized → … → ready-to-train → training (wait: a run is in progress) → ready-to-score → exported → serving (the chosen model answers; the app's sync is next)) and what do I run next, with the tool for each step; every run listed with its dev score, a saturated dev set flagged — call first and after every step |
| `forge_preflight` | `target`, `config?`, `workspace?`, `project_dir?` | Read-only | Will this command refuse? Every gate `run`, `evaluate`, `export`, `serve`, `score`, `split`, `prereg` or `leak-audit` will hit, with the fix (optional `config`); for `run` the same checks `run` makes (dev set, leak audit, decode length), and `next` names the command once every gate passes |
| `forge_discover` | `code` / `language`, `cards_dir?`, `workspace?`, `project_dir?` | Read-only | What a language has, as forge sees it — works from a pip install (card directory → checkout → the public card index) |
| `forge_init` | `code` / `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` | Action | Scaffold a forge project from a language card; model preset `cpu-tiny` (default — a laptop CPU, minutes), `cpu-finetune` or `nllb-600m`; `no_card` + `name` for a language the index lacks |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (default `data/split`), `dev?`, `register?` (a prefix, or `true` for `project`), `allow_rotate?`, `near_dupe?` (a Jaccard threshold, e.g. 0.6: near-duplicates stay on one side), `max_group?` (with `near_dupe`: cap near-duplicate groups at N rows), `workspace?`, `project_dir?` | Action | Carve a parallel corpus (`.jsonl` or `.tsv`) into GROUP-DISJOINT train/dev/test; `test: 0` keeps your own test file separate; relays forge's near-twin advice (when it recommends `--near-dupe 0.6`, or names another route) |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?`, `companion_config?`, `overwrite?`, `full_indices?`, `workspace?`, `project_dir?` | Read-only | Screen a corpus against every registered eval set before training — leaks dropped, template siblings kept and reported (`clean_to` writes the survivors); `drop_test_twins` writes the twin-free corpus to its own `clean_to` (e.g. `corpus.notwins.jsonl`) and the twin-free model's config (`config-notwins.json`, or `companion_config`; never overwritten), and names the command that trains it. A `clean_to` that a config, a run, a split or another audit uses is refused unless `overwrite`; long row-number lists come back as `{count, first}` unless `full_indices` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` | Action | Register an eval file (`.jsonl` or `.tsv`) with a role: dev, test, or sealed. `path` is absolute or relative to `project_dir` (a file beside the project folder is `../data/test.tsv`); one found only from the server's directory is refused with the path to pass |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` | Action | The one valid predictions-file format, and a template to edit (written to `out`) |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?`, `allow_after_reads?`, `workspace?`, `project_dir?` | Action | Preregister predictions for a test/sealed set BEFORE scoring it — and before any benchmark on it (a scoring read blocks a later prereg); `config_hash` pins it to one run |
| `forge_prereg_verdict` | `id`, `prediction`, `verdict`, `by`, `note?`, `revise?`, `workspace?`, `project_dir?` | Action | Record the USER's verdict (held / missed) on a prediction forge cannot judge — a free-text range — ledgered with who, when and a note; shown as a human verdict everywhere, never as computed |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` | Action | Score the test battery once (prereg-gated, CIs) and package the model, an mt-eval report, a champollion `method.json` and DEPLOY.md — then `nmt-forge serve` it in a terminal. `summary` carries the scores with CIs, the near-twin reading, the prereg's verdict counts, the twin-free model to quote (or, planned but not exported yet, its next step), mt-eval's `score_caveats` on the score and on each twin-free model's, verbatim (a MAJOR one — e.g. a near-constant output — leads the next step: never quote the score without it), and `hypotheses`, the file `forge_compare` takes |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` | Action | Score only: decode + score the selected checkpoint through the harness, with a diagnosis |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` | Read-only | Diagnose a battery manifest: weak registers, likely cause, the lever to pull; mt-eval's caveats on the scores come through as `R9-harness-score-caveat` (`summary.harness_score_caveats`), relayed first |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` | Read-only | Re-render the plain-language training report — for an exported run, with its test score, caveats and prereg verdicts |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?`, `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` | Action | A/B two systems on a registered eval set (paired approximate randomization, prereg-gated, ledgered); the result carries each system's near-twin caveat, so a win on recall of training phrases is said to be one, and mt-eval's own score caveats on each system's outputs (`summary.score_caveats`) — no score is quotable without them |
| `list_contests` | `status?`, `language?`, `limit?` | Read-only | Contests and shared-task editions visible to an anonymous reader |
| `get_contest` | `id` | Read-only | One contest: phases, the organizer's declared terms (+ a digest), results visibility, and the public ranking when one is visible. Entering stays a human-authorized CLI flow |

#### Deploy and contribute

| Tool | Arguments | Type | Description |
|---|---|---|---|
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?`, `script?`, `use_tm?`, `validate?` | Action | Translate through champollion's tested pipeline — engine choice, including a model you deployed (`method: "local"` + `base_url`, or `method: "api"` + `endpoint`, e.g. `nmt-forge serve`), register conditioning, Translation Memory (repeats are free; `project_dir` uses a project's), deterministic quality gate. Every answer names the engine that ran, with its model and endpoint. With `project_dir` the repeat check is the project's: a sentence its sync caught a model repeating, or one its files hold for another text, is refused and goes to the pair's fallback. `context` is a gettext msgctxt (one for all texts, or one per text): the cache is keyed with it as sync keys that catalog entry, and the model is told it. An unknown argument is refused, not ignored |
| `get_project_info` | none | Read-only | Project overview + live queue statistics |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` | Read-only | Open public-benchmark items, ranked; filter by language/model/budget |
| `get_queue_item` | `id?` or `priority?` (one of them) | Read-only | One queue item in full |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` | Read-only | What a budget or filter would cost to run |

### Resources (read-only data)

| Resource | URI | Description |
|---|---|---|
| Contributing guide | `champollion://contributing-guide` | CONTRIBUTING.md — how to help with the project |
| Queue schema | `champollion://queue-schema` | Field definitions for every queue.json item |
| Network data map | `champollion://network-data` | Which machine artifact answers which question (queue, mesh, registry, coverage) |

### Prompts (conversation starters)

| Prompt | Arguments | Description |
|---|---|---|
| `start_language_project` | `language`, `purpose?` | "We want MT for our language (for our school / clinic) — how do we start?" |
| `contribute_compute` | `budget?`, `language?` | "I want to help — what would $X buy?" |
| `compete_for_prize` | `language?` | "I want to build a competitive method — any prizes?" |
| `explore_language` | `language` | "Tell me about [language] in Champollion" |

## Quick start

**From the published package** (no clone needed):

```bash
npx champollion-mcp-server    # start on stdio (for agent connection)

```

**From source:**

```bash
cd mcp-server
npm install
npm test          # run unit tests
npm start         # start on stdio (for agent connection)
```

## Connect to your agent

### Claude Code / Antigravity

Add to your MCP configuration — published package:

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

Or from a local checkout:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "node",
      "args": ["/path/to/Champollion/mcp-server/bin/server.js"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (same two options):

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

## What a conversation looks like

> **You:** "We want to build an Atya phrasebook model for our clinic. How do we start?"
>
> **Agent** uses `search_languages { query: "Atya" }` → *no exact match — six Ayta languages, equally close: Ambala Ayta (abc, 14.82°N 120.28°E), Abellen Ayta (abp, 15.41°N 120.20°E), Sorsogon Ayta (ays, 13.04°N 124.17°E) …, each located with its source* → asks which community
>
> **Agent** uses `language_overview { code: "abp" }` → what the index knows (speakers, endangerment — every claim cited), no registered benchmark, no MT service lists it, and the next steps
>
> **Agent:** "First, your sentences stay on your machine — we'll mark the file local-only. Then let's measure what exists before building anything."
>
> **Agent** uses `run_benchmark` `{ corpus: "~/clinic/test.jsonl", provider: "local", model: "llama3.1", dry_run: true }` → shows the plan → you agree → `confirm: true` → **job id**; polls `get_run_status`
>
> **Agent** uses `get_training_guardrails`, then `forge_status { project_dir }` / `forge_split { corpus, test, seed, out }` / `forge_prereg { id, eval_set, predictions }` … to train your own model without fooling yourselves, `forge_export { run_manifest, out }` to prove and package it, and `nmt-forge serve` (in a terminal) to put it behind a local endpoint for `translate { texts, source_language, target_language, method: "local", base_url }`

Contributing compute is the other path: `get_project_info` → `list_queue { language?, budget? }` / `estimate_cost { budget }` → `run_benchmark { budget: 5, confirm: true }` (add `publish: true` only if you want your results on the public leaderboard) → `get_run_status { job_id }` → `get_results { target_language }`.

## Testing

```bash
npm test                 # unit + surface tests (mocked network; parity with arena where present)
npm run test:contract    # opt-in: packs this server + the local CLI, installs both into a
                         # temp prefix, spawns the INSTALLED server over stdio and calls
                         # every tool (needs network for the anon reads)
```

To test the server interactively:

```bash
npx @modelcontextprotocol/inspector node bin/server.js
```

## Architecture

```
mcp-server/
├── bin/server.js              Entry point (stdio transport)
├── instructions.md            Agent guide (sent in the MCP initialize result)
├── src/
│   ├── index.js               Tool/resource/prompt registration
│   └── tools/
│       ├── args.js             The shared `language` argument (alias of code/target/query)
│       ├── languages.js        Language index + search (exact, then fuzzy; where each is spoken)
│       ├── language-card.js    get_language — cards via the champollion package
│       ├── overview.js         language_overview — composes the other tools
│       ├── corpora.js          Corpus registry (list_corpora)
│       ├── results.js          Public leaderboard reads
│       ├── contests.js         Read-only contest views
│       ├── reliability.js      Metric-reliability lookups
│       ├── queue.js            Queue fetch, filter, cost estimation
│       ├── harness.js          mt-eval wrapper (run_benchmark, get_run_status)
│       ├── run-plan.js         A plan's licence / do_not_train / EVAL PACK lines, asked of the harness
│       ├── publish-report.js   preview_publish (read-only) + publish_report — the harness's own publish preview + exact acknowledgement
│       ├── output-trim.js      Long job output: head + tail, the middle trimmed with a marker
│       ├── jobs.js             Durable job history (jobs.json) + the job runner
│       ├── job-supervisor.js   Detached runner: logs + exit record per job
│       ├── state.js            The state directory (~/.champollion-mcp)
│       ├── forge.js            nmt-forge wrapper (forge_*)
│       ├── training.js         Training guardrails
│       └── translate.js        Champollion translate pipeline wrapper
└── test/
    ├── *.test.js              Unit tests (node --test)
    └── contract.e2e.js        Installed-package contract suite (npm run test:contract)
```

## Protocol version — and the 2026-07-28 stateless spec

**Transport: stdio only.** One server process per agent, launched by the client.

MCP's [2026-07-28 revision](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
made the protocol **stateless by default** — the largest change since
authorization. It retires the `initialize`/`initialized` handshake and the
`Mcp-Session-Id` header, requires `Mcp-Method`/`Mcp-Name` HTTP headers so
gateways can route without parsing bodies, replaces held-open bidirectional
streams with Multi Round-Trip Requests, and deprecates Roots, Sampling, Logging
and the legacy HTTP+SSE transport (twelve-month support window).

**Where this server stands (checked 2026-08-01):**

| | Status |
|---|---|
| Deprecated capabilities (Roots / Sampling / Logging) | **None used.** |
| Legacy HTTP+SSE transport | **Not used** — stdio only. |
| `Mcp-Session-Id`, header routing, MRTR | **Not applicable** to stdio. |
| Application state across calls | **Already uses the prescribed pattern** — see below. |
| SDK support for `2026-07-28` | **Not yet available.** |

The new spec's guidance for cross-call state is to "mint an explicit handle from
a tool and have the model pass it back as an argument" rather than lean on
transport sessions. `run_benchmark` already works exactly that way: it returns a
job id, and the agent passes that id to `get_run_status`. No transport-level
session is ever involved.

**One assumption to know about.** The job history is a file on the machine
running the server (`~/.champollion-mcp/jobs.json`, see [Local
state](#local-state)), and the runs it describes are processes on that machine.
Server processes on the same machine share it — a restarted server, or a second
one, finds every job — but servers on different machines do not. Anyone adding
an HTTP transport served from more than one machine must move the history (and
the runs) to shared storage first.

**Why we have not upgraded.** The published TypeScript SDK does not speak the
new revision yet: `@modelcontextprotocol/sdk@1.30.0` is the only dist-tag on
npm and its `LATEST_PROTOCOL_VERSION` is `2025-11-25`. The dependency floor here
was raised to `^1.30.0` (from a stale `^1.12.1`, eighteen releases behind) so
installs resolve current. Re-check when a `2026-07-28`-capable SDK publishes;
the migration should be small given the table above.

## Local state

The server keeps state in one directory, `~/.champollion-mcp/`
(`CHAMPOLLION_MCP_HOME` moves it):

| Path | What it is |
|---|---|
| `.champollion/tm.json` | The `translate` tool's own Translation Memory. It is **not** any project's `.champollion/tm.json`: pass `project_dir` to read and write a project's TM instead (the file `champollion sync` uses there — the engine then also uses that project's coaching, `.env` and its own pair for the languages, so the cache key is exactly sync's) |
| `jobs.json` | The `run_benchmark` job history — the newest 50 jobs (running jobs are never dropped): id, command, working directory, where results land, status, start time, pid while running. No environment or keys |
| `jobs/<job-id>/` | One job's `stdout.log`, `stderr.log`, `exit.json` and — for an item run or a registered corpus — `results/`, the harness's `--output-dir` (run log + `*_report.json`). A run on a file the user holds writes its results (`results/mcp-<job-id>/`) and cache (`results/cache/`) beside that file instead — or, for a file inside a folder `mt-eval contest prepare` marks releasable, to the contest's `runs/` (never into the released folder). Queue runs write their reports where the harness always does: `eval/logs/harness/queue/` under the server's working directory. When a job leaves the history its logs are deleted; its results never are |

**Jobs outlive the server.** mt-eval runs under a small detached supervisor
(`src/tools/job-supervisor.js`) that writes the run's output and exit status to
the job folder itself. If the host restarts the server mid-run, the run keeps
going, and `get_run_status` on the new server reports it from that evidence:
RUNNING (the supervisor is alive — checked against its command line, so a
recycled pid is not mistaken for it), COMPLETED / FAILED from the exit record
with the results read from the output folder, or INTERRUPTED with the log tail
when the process vanished without one (a reboot, a kill). To stop a run by hand,
`kill` the supervisor's pid (shown while RUNNING); the stop is recorded.

## Data sources

The champollion.dev homepage map is an idealization of this data — agents
should read the sources, not the picture (the `champollion://network-data`
resource carries the full endpoint table).

- **Queue**: Fetched from `champollion.dev/queue.json` (tens of MB — it grows with coverage; cached 5 min in memory). Small slice: `champollion.dev/queue-preview.json`. For the live open-item count, call `get_project_info`
- **Mesh**: `champollion.dev/mesh.json` — the measured/registered pair network behind the homepage map
- **Corpus registry**: `champollion.dev/registry.json` — every registered eval corpus with license lane, attribution, checksum. The `list_corpora` tool reads the in-repo copy when run inside a checkout, else this file, else the prod `datasets` mirror (labelled as lagging); `CHAMPOLLION_CORPORA_SOURCE=registry|remote|db` forces one
- **Provider coverage**: `shared/catalogue/method-coverage.json` — each provider's published language list, cited + as-of + `tier` (the data behind the map's covered/uncovered split). The map's green has two tiers by exact ISO-639-3 code: bright = a deployed service lists it (Google/Microsoft/DeepL/LibreTranslate); dim = only an open research model lists it (NLLB/OPUS/M2M-100/MADLAD-400 — a model-card code, not a usable service)
- **Languages**: the monorepo's `cli/shared/language-cards/` in a checkout; from an npm install, the `champollion` package's bundled cards (core languages in full, every catalogued language by name), with `get_language` materializing any other card through the CLI's own resolver — per-user cache (`~/.champollion/cards`), then champollion.dev's published card tables (read-only). `search_languages` fills in its name-only results the same way (the first 10 per search, within 6 s; a slower card keeps downloading into the cache and the line says so), so each can say where it is spoken once its published row carries per-field sources; until the tables' next upload, a filled-in line withholds the uncited location and links the language's Glottolog record. `CHAMPOLLION_OFFLINE=1` disables the fetch
- **Contests**: the public `contests`, `contest_phases`, `contest_submissions` (never the email column) and `shared_tasks` tables, anon read; withheld results (`contest_deferred_results`) are not anon-readable and the tools say so
- **Results**: Read from the public Supabase leaderboard (`run_cards`) — the same anon read path the champollion.dev leaderboard uses. Scored aggregates and run-card metadata only; per-entry test sentences are never read. Override the project with `CHAMPOLLION_SUPABASE_URL` / `CHAMPOLLION_SUPABASE_ANON_KEY`.
- **Harness**: Shells out to the `mt-eval` CLI (`pipx install mt-eval-harness`). Publishing goes to `MT_EVAL_SUPABASE_URL` (default: the production project) and only when `publish: true`

## License

PolyForm Noncommercial 1.0.0 ([LICENSE](LICENSE)): free to use, change and share for noncommercial purposes; using it for a commercial purpose is not covered by this license. A school, a public hospital or clinic, a charity, or a personal or research project is covered; a for-profit business's product is not. In full, with the harness (AGPL-3.0-or-later) and the other packages: [Who may use this](https://champollion.dev/docs/getting-started/who-may-use-this) — a summary, not legal advice; the license text governs.
