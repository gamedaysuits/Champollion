# Changelog

## 0.3.2 (2026-10-07)

Requires champollion 0.5.3. The `translate` tool's default model is the
CLI's (one file, `shared/model-defaults.json`); the server no longer writes
a model id of its own.

## 0.3.1 (2026-10-06)

Requires champollion 0.5.1: the default model is `google/gemini-3.8-flash`
(the server's fallback, used only when the CLI does not say, too).

## 0.3.0 (2026-10-05)

Requires champollion 0.5.0.

- **Exact model slugs only.** The `model` arguments of `translate` and
  `run_benchmark` take an exact slug (`google/gemini-3.5-flash`); a retired
  alias (`gemini-flash`) or a floating id (`…-latest`, `~vendor/…`) is
  refused with the slug to write, as the CLI and the harness refuse it.
- Through champollion 0.5.0, `translate` never writes an `[EN] ` marker: a
  part the quality gate refuses twice keeps its source text, and the result
  says so.

## 0.2.0 (2026-10-03)

Built around one flow: someone tells their agent "let's build a Cree model
for our school" (or "an Atya phrasebook for the clinic") and the agent can
take them from discovery to a measured, deployable model. Synthetic-user
testing against the 0.1.x npm install found the gaps this release closes.

- **Round 13 (synthetic-user findings, 2026-10-04).**
  - New `preview_publish`: the READ-ONLY half of `publish_report` — the
    harness's own `mt-eval publish <report> --dry-run`, WHAT GETS PUBLISHED,
    the exact `publish_ack` and the exact `publish_report` call that would
    publish it. It has no `confirm` or `publish_ack` (refused by name) and
    carries the MCP annotation `readOnlyHint: true`, so an agent host that
    gates writes can allow it alone (a host had blocked publish_report's
    preview as a production deploy). `publish_report` is annotated
    `destructiveHint` / `openWorldHint`; without `confirm` it still returns
    the preview. 34 tools.
  - `run_benchmark`: `metricx` (+ `metricx_model`) and `fuse` pass the
    harness's opt-in `--metricx` / `--metricx-model` / `--fuse`; `comet`
    requires COMET (the harness computes it whenever unbabel-comet is
    installed — there is no run flag). The plan says, from the harness's
    Python, whether each is installed, what to install and what it
    downloads; a confirmed run that asks for a metric the harness cannot
    compute is REFUSED, never run without it. Item and corpus runs only.
  - `run_benchmark`: a corpus inside a folder `mt-eval contest prepare`
    marks releasable (`.champollion-releasable.json` in it or above it, or a
    `public/` beside `local/manifest.json`) runs into `<contest>/runs/` —
    results and cache — never into the released folder; the plan's
    `Results:` line says where and why. No output folder inside a releasable
    folder is ever passed to the harness.
  - The coached plan gives ONE verdict on the coaching file, the harness's
    sentence: ✓ it names the language (as "…"), ⚠ it names neither, or not
    checked — the 'Not sent: …' line is gone.
  - A method plugin's cost says why, in the harness's words
    (`method_loader.plugin_cost_basis`, mirrored and compared), in the plan
    and the start message.
  - `language_overview`: speaker counts keep their scope notes (ELCat's
    "10-99" for Plains Cree is British Columbia only) and say when two
    records of one source have nothing on the card telling them apart. Its
    FST line and the run plan read the analyzer and the pyhfst runtime from
    the harness's `config.fst_state` (forge's reading), and name the Python
    they asked.
  - The forge tools relay mt-eval's `score_caveats` as forge gives them
    (never reworded or recomputed): `forge_export`'s summary (and each
    twin-free sibling's), `forge_status`'s exports
    (`summary.export_caveats`), `forge_compare` (`summary.score_caveats`)
    and `forge_lint`'s `R9-harness-score-caveat`; a MAJOR one leads the next
    step — a score is never "the number to quote" without it. No caveat
    list → nothing said. `forge_export` also returns `hypotheses` (the file
    `forge_compare` takes) and its compare command; `forge_status` in
    `no-dev-set` says to call `get_training_guardrails` once, then
    `forge_split`.
- **Round 12 (synthetic-user findings, 2026-10-04).**
  - `run_benchmark`: a method plugin whose method.json declares dependency
    class S or O with no `gateway` / `external-api` dependency is "$0 API
    cost (runs on this machine)" in the plan, by the harness's rule (it was
    "unknown (the plugin prices its own calls)"); it still needs the user's
    attestation for a local-only corpus. A coached run's plan on a
    local-only corpus says why the coaching file's first line is withheld.
  - `get_run_status`: the Results block lists every score caveat the report
    records (the harness's new near-constant-output caveat among them).
  - `publish_report`: for a local-only corpus, WHAT GETS PUBLISHED relays
    which of its facts go public with the score, which stay on this
    machine, and how others read a score on a set they cannot open.
  - `forge_export` returns a summary like the other forge tools;
    `forge_status` names the real next step (export, or the re-audit when
    the twin-free corpus predates the dev split) and a `serving` state;
    `forge_register_eval` refuses a missing file with the path it looked
    for and the fix.
  - The `register-corpus` command the tools suggest for a test set carries
    `--role test`; `search_languages` docs say a location is shown only with
    its source, otherwise a link to its Glottolog record.
- **Round 11 (synthetic-user findings, 2026-10-04).**
  - `run_benchmark` names a language given as a code ("sme" → "Northern
    Sami", through the card) instead of prompting with the code; the plan
    shows the prompt the model gets (a coaching file by its first line and
    hash, and that it REPLACES the built-in prompt); for a card with several
    scripts it reports the references' script share (counts only) and the
    script it prompts for; it names the translation cache folder; and it
    prints the exact `compare` command for runs on a registered corpus id.
  - `search_languages` matches the start of a name word ("North Sami" finds
    Northern Sami), ranked below exact matches; a candidate whose location
    cannot be cited links its Glottolog record instead.
  - `language_overview` takes its runnable open models from the CLI's
    `recommend` (one rule, `-ct2` and ONNX repos excluded).
  - `translate`: each row is marked `cache: pair|fallback` and every count
    is derived from the rows; a discarded cached answer names what it
    collided with; an unpriced or unknown model reports "cost unknown —
    <why>".
- **Round 10 (synthetic-user findings, 2026-10-04).** Next steps, register
  hints and the run plan put the forge steps (register, leak-audit,
  predictions) before any baseline; `local-model` requires a model;
  `allow_model_pair_mismatch`; `publish_report` repeats the harness's method
  lines; `get_results` says publishing is explicit; locations are shown only
  with a source.
- **Round 9 (synthetic-user findings, 2026-10-04).**
  - New `forge_compare`: compares two systems on a registered eval set and
    prints the near-twin caveat when either was trained on near-copies of
    the test rows ("never the winner alone"). instructions.md now lists
    which forge commands have a tool and which run in a terminal.
  - `forge_prereg` takes `config_hash`; a test checks that every flag
    forge's advice names is an argument of the tool that runs that command.
  - `forge_leak_audit` takes `companion_config` and relays the twin-free
    model's config and train command; `forge_status`,
    `forge_register_eval` and `forge_leak_audit` name the preregistration
    as the next step, before any benchmark, once a test set is registered.
  - `get_training_guardrails` points to the public diagnosing-training
    page, never a monorepo path.
  - `run_benchmark` passes the resolved `--target-lang-code` (a
    private-use `qaa` included), takes `script` for two-script targets
    (`--target-script`), and shell-quotes every printed argument.
  - `language_overview` on a private-use code (qaa–qtz) explains what the
    code is and what still applies, instead of a dead end.
  - `translate` reports `estimated_api_cost_label` ("$0 API cost (runs on
    this machine)" for a local model) instead of "0 USD".
  - `get_metric_reliability` no longer prints internal review wording.
- **Round 8 (synthetic-user findings, 2026-10-04).**
  - `get_run_status`: the output trim keeps warning and notice lines (⚠,
    ✗, ❌, `[WARN`, `Warning:`, `Note:`) and their indented continuation
    lines from the trimmed middle, in place, up to 2,000 characters. Every
    other line is still counted in a marker. A run's "COMET not computed"
    notice used to sit exactly where the trim cut.
  - `publish_report` passes `--anonymous` to the harness's dry run as well,
    and relays the preview's trust tier (self-benchmarked, `unverified`)
    and score lane.
  - `run_benchmark` plans: a missing FST alone reads "the run PROCEEDS
    without it" (harness 2026-10-04+), with the setup command and the
    `mt-eval test <run log>` re-score. The overview's FST line uses the
    harness's own sentence and never says the FST "downloads on the first
    evaluation".
  - `search_languages` matches the Roman-letter form of a card's
    non-Latin endonym, produced by the CLI's script converter and labelled
    as derived (`nêhiyawêwin` finds crk).
  - `run_benchmark` no longer asks for `target_language` when one was
    passed for a code with no card (private-use `qaa`).
  - `translate` says when a cached answer was discarded by the
    shared-output check, and does not count it as served.
- **Round 7 (synthetic-user findings, 2026-10-04).**
  - `translate` with `project_dir` resolves language NAMES to the project's
    own locale codes ("English"/"French" → en/fr, through the CLI's
    `resolveLanguageInput`) before matching the pair and before any cache
    read or write; an ambiguous name refuses with the choices. Names used to
    miss the pair, run the engine default model and write cache entries
    under a locale literally named "French".
  - `publish_report`: publish a finished run's `*_report.json`, scores-only
    if the user wants (`scores_only`, `redact_coaching`, `anonymous`), behind
    the same gate as `run_benchmark` — every call shows the harness's own
    `mt-eval publish --dry-run` preview and the exact `publish_ack`; only
    `confirm` with those words publishes (`--prod` for production).
  - `run_benchmark` plans open with the target language's `EVAL PACK:`
    status (missing — with the setup command — / ready / none needed) and
    name the corpus licence and `do_not_train` term the run accepts by
    passing `--yes` ("unknown" when nobody states them), asked of the
    harness's registry and its own eval-pack gate. New `skip_fst` /
    `skip_eval_standard` (`--skip-fst` / `--skip-eval-standard`) score
    without them, marked not computed; a run the harness stops for a missing
    pack says so and names both.
  - `forge_split` takes `near_dupe` (`--near-dupe`) and `max_group`
    (`--max-group`, with `near_dupe`) and relays forge's near-twin advice
    instead of promising `--near-dupe 0.6`.
  - `get_run_status` keeps a long log's first and last lines and trims the
    middle with `… [N lines trimmed] …` (it began mid-sentence); the
    harness's `EVAL PACK` lines lead the answer.
  - The register-corpus command the guidance prints now runs as printed
    (`--yes`, `--domain`; it writes the local-only sidecar itself).
  - Significance wording: a small Δ can be significant yet not meaningful
    (check the CI on Δ and metric reliability; p-values are per metric,
    uncorrected) — no more "probably noise" beside a significant result.
  - Counts agree with their nouns: "1 is marked do_not_train", "1 report".
- **Round 6 (synthetic hospital, school and researcher personas, 2026-10-04).**
  - `run_benchmark { publish: true }` shows WHAT GETS PUBLISHED before
    anything runs — every row with its sentence text, or scores only; the
    prompt published (a coaching file in full), redacted, or none; the
    target — read from the harness's own publish gates. A real publish needs
    `publish_ack` in the exact words the plan prints; without them (or when
    the harness cannot be asked) it is REFUSED and nothing runs.
  - One attestation rule everywhere: the harness's own `method:
    "local-model"` runs in-process and needs no attestation (an
    `attest_local_transport` for it is refused as meaningless); MT engines
    and `method_dir` plugins still need the user's. The server instructions,
    the refusal message and the tool descriptions used to give two answers.
  - `model` with `method_dir` is passed to the plugin (`-m`, its own naming),
    as the methods spec and the CLI say; `provider` with a method stays
    refused. A local model directory is accepted as `model` for
    `local-model` too.
  - `source_language` for corpus mode (`--source-lang`); when the steward's
    sidecar or the corpus card it names states the pair, its source code is
    passed (`--source-code`) and the harness names the language — the plan
    says which. The run card's source language used to be blank.
  - One cost rule: a loopback or in-process run is "$0 API cost (runs on
    this machine)" in the plan as in the start message and the run card (the
    plan said "unknown, never $0").
  - `forge_prereg_verdict`: record the USER's verdict on a free-text
    prediction (ledgered with who, when and a note; shown as a human verdict).
  - `forge_status` after `forge_init` reports `initialized` and points at
    `forge_split` (it said "discover, then init" again); `summary.runs` lists
    every run with its checkpoint, dev score and exports, and
    `summary.warnings` carries a saturated dev set. `forge_report` on an
    exported run includes the test result.
  - `translate` with `project_dir` runs the project pair's `fallback` exactly
    as `champollion sync` does (the CLI's own `translateWithFallback`) and
    marks each text the fallback produced, with its method.
  - `search_languages` matches a multi-word query part by part
    ("Plains Cree nêhiyawêwin" → crk), ranked by how much of the query each
    language's recorded names cover.
  - `language_overview` separates "an FST exists (the card)" from "the
    installed harness has a pin for it and can use it here".

- **`translate` with `project_dir` shares `champollion sync`'s cache —
  exactly.** The tool keyed entries itself: the resolved code (`fra`) for the
  project's `fr`, a hash of the register text for the card preset sync keys
  by name (`formal-vous`), and an endpoint suffix sync never adds. A persona
  got 0 of 2 hits on strings sync had just cached. With `project_dir` the
  pair now comes from the CLI's own config and pair code — what
  `champollion sync --method <method> [--model <model>]` runs there — so
  model, register, script, cache key and locale code are sync's, in both
  directions. The answer names the project pair and the key. Without
  `project_dir` the server's own cache keeps its keys. A register given as a
  card preset name is now sent as that preset's instructions (the name itself
  used to reach the model).
- **`translate` never picks an orthography.** A target with two real writing
  systems (Plains Cree: SRO or Syllabics) is refused until one is chosen, as
  `champollion sync` refuses: pass the new `script` argument (`"Latn"`,
  `"Cans"`), or let the `project_dir` pair's `script` decide. A chosen display
  script is produced from the cached working-script translation, exactly as
  sync writes it.
- **`translate` reports `isError: true` when no text was translated** (an
  unreachable engine, say: it answered "0 of 2" as a success). A partial
  result stays a normal answer that lists each failure.
- **`search_languages` tells same-named languages apart.** Every result says
  where the language is spoken (countries, Glottolog's point, macroarea) and
  its other names, each with its source ("Atya" → six Ayta languages, all in
  the Philippines: only their points differ). Ties are called out. In an npm
  install, name-only results are filled in from their published cards (first
  10, within 6 s, cached).
- **One argument name for one language.** Every tool that takes one language
  (`search_languages`, `get_language`, `language_overview`,
  `get_metric_reliability`, `forge_discover`, `forge_init`) also accepts
  `language`; `get_metric_reliability {"language": "crk"}` no longer fails
  with -32602. The original names still work; a missing or conflicting
  language is a tool error naming both arguments. README, instructions.md and
  the champollion.dev MCP page list every tool's arguments, and tests hold
  them equal to the schemas.
- **`forge_status` knows the `training` state.** While a run holds the
  workspace run lock, nmt-forge reports `training`; the tool's description
  lists it and its hint says wait — never start another run — instead of the
  generic `nmt-forge run config.json` example.
- **`language_overview` shows every source on a disputed fact.** The summary
  line kept three unattributed endangerment values (Plains Cree has five,
  from three sources) and joined disputed families without their sources; it
  now lists each value with its source and says the sources differ.

- **New `language_overview`** — the stage-1 answer. One honest page per
  language: what the index knows, which benchmarks exist, published results,
  which methods can run here and with what evidence (the CLI's own
  `champollion recommend` logic), tooling (FSTs, dictionaries, keyboards),
  licence/consent constraints read from the corpora, contests, and numbered
  next steps that each name the exact tool or command (protect your data →
  baseline → build → prove → deploy). Every section that cannot be reached
  says "unavailable: why" instead of sinking the answer.
- **New `get_language`** — the full cited card for one language, resolved
  exactly as the `champollion` CLI resolves it (bundled card → per-user cache
  → champollion.dev's published card tables, via the package's own async
  prefetch). Every value carries its source; disagreements list every claim;
  absent fields are named, with what absence means for the tier the card came
  from. From an npm install, most low-resource languages used to answer
  "family: unknown, speakers: unknown".
- **Fuzzy `search_languages`.** No exact or whole-word hit → the closest
  names by restricted Damerau-Levenshtein distance (a swapped letter pair
  costs ½; budget 1 edit for 4–5 letters, 2 beyond; names only, never codes).
  "Atya" now surfaces the six Ayta languages first. Matching is accent- and
  punctuation-insensitive, and a whole-word hit ("Cree" in "Plains Cree")
  outranks a prefix ("Creek").
- **`run_benchmark` no longer publishes by default.** 0.1.x auto-published
  every budget/top queue run to the PRODUCTION leaderboard unless the agent
  passed `publish:false`. Now nothing is published unless `publish: true`;
  every plan, start and completion message names the target (production, or
  the non-production project in `MT_EVAL_SUPABASE_URL`), and a production
  publish passes the harness's separate `--prod` opt-in.
- **`run_benchmark` corpus mode + local models.** Run ANY corpus — a registry
  id or a test file the user holds — on any model: `provider: "local"` (an
  OpenAI-compatible server on this machine; Ollama by default, `base_url` /
  `LOCAL_API_BASE` otherwise), `method: "local-model"` (NLLB / OPUS-MT /
  MADLAD weights), a hosted provider, or an MT API. Optional `max_cost`,
  `attest_no_training`, `accept_nc_terms`, `anonymous`, field names.
- **Refusals stay refusals.** A data steward's `<file>.champollion.json`
  `{"transmission":"local-only"}` mark refuses every remote model up front
  (no job, no spawn). The harness's transmission-policy, NC-terms, prod-
  publish and cost-cap stops come back from `get_run_status` as REFUSED with
  what IS allowed — never as a generic FAILED, and never with advice to try
  another provider.
- **Cost "unknown" is never $0.** `get_results` shows each row's cost and
  "unknown" for unpriced/local runs (sorted last by cost); `get_run_card`
  says so when `total_cost_usd` is null.
- **New read-only contest tools `list_contests` / `get_contest`.** Phases
  (with the active window), the organizer's declared terms (the frozen
  PROMISE keys, mirrored from `contest_policy.py` and parity-tested) with a
  computed SHA-256 digest, results visibility, and the public ranking when one
  is visible (the frozen final ranking with CIs and tie groups after close;
  interim published scores when results are immediate). Bounded anon reads;
  an entrant's sign-in email (`submitted_by`, `created_by`, `closed_by`) is
  never read or shown; what an anonymous reader cannot see is said plainly.
  Entering a contest remains a human-authorized CLI flow.
- **forge tools work from a pip install.** forge resolves as
  `NMT_FORGE_BIN` → `CHAMPOLLION_FORGE_DIR` (a clone; set-but-wrong is an
  error) → the monorepo sibling → `nmt-forge` on `PATH` → `python -m
  nmt_forge.cli` from the active Python. The misleading "forge is not on
  PyPI" message is gone; a missing forge now says `pip install nmt-forge`
  (and `pip install 'nmt-forge[hf]'` to train), and common cold-start
  tracebacks (missing harness, missing torch, no card directory) map to fixes.
- **forge tools speak nmt-forge 0.2.0's `--json` contract.** Every forge
  tool passes `--json` and returns `{result, summary?, next?}` (forge 0.2.0
  prints human text by default for `init`, `split`, `leak-audit` and
  `registry add`, which the old text fallback relayed without structure). A
  refusal — `{"error": {type, guard, message, why, fix, …}}`, exit 2 — comes
  back as a tool error with what / why / fix plus the envelope; a pre-0.2.0
  forge, a crash or a missing dependency comes back as the fix, never a
  traceback. Each call is bounded (2 min; 10 min for evaluate/export): past
  the bound forge gets SIGINT, so its own cleanup runs, then SIGKILL, and the
  tool names the terminal command.
  - **New `forge_export`**: score the test battery once (prereg-gated, CIs)
    and package the model, an mt-eval RunLog + TestReport, a champollion
    `method.json` and DEPLOY.md. **New `forge_prereg_template`**: the one
    valid predictions format, written to edit.
  - `forge_preflight` takes the `evaluate` / `export` / `serve` targets and a
    `config`; a failing gate (forge exits 2) is an answer — `summary.passed`,
    `summary.failing` — not a tool error.
  - `forge_init` takes `model` (`cpu-tiny` default, `cpu-finetune` + `base`,
    `nllb-600m`), `no_card` + `name` and `cards_dir`, and drops `workspace`
    (forge's `init` never read it: the workspace is `<dir>/.forge`); `forge_split` takes
    `test: 0`; `forge_evaluate` takes `harness_out`; corpora and eval files
    may be `.tsv`.
  - `forge_status` knows the `exported` state and maps its next command onto
    tools (`summary.tools`); training and `nmt-forge serve` are terminal
    steps, never tools.
  - Every forge tool but `forge_init` (which creates the project at `dir`)
    takes `project_dir`: forge runs from there, as in its
    own `cd <project> && nmt-forge …` advice, so config.json's relative paths
    and the `.forge` workspace resolve as `forge_init` wrote them.
  - `forge_discover` no longer says it needs a card directory — forge 0.2.0
    resolves cards from a pip install.
- **`get_metric_reliability` works from an npm install** — it now reads the
  index the `champollion` package ships (`shared/catalogue/`), not only the
  monorepo copy.
- **`translate` with the local engine works.** Keylessness is derived from
  the method registry's loopback `default_base_url`, so method `local` no
  longer demands an endpoint variable as if it were a key, and engines other
  than the OpenRouter lane no longer receive the OpenRouter default model slug.
- **`translate` can target the model you just deployed.** A synthetic user
  served their model with `nmt-forge serve`, passed `endpoint` to `translate`
  (which had no such argument) — zod stripped it silently and the call ran on
  a different local model. Now `base_url` points method `local` (or `openai`)
  at an OpenAI-compatible server (serve's `/v1` URL), and `endpoint` drives
  the new method `api` (the champollion API contract, serve's `/translate`;
  key `CHAMPOLLION_API_KEY`, none needed on loopback). The engine is checked
  to have taken the target before anything is sent. The schema is strict: an
  unknown argument is refused by name (so is `run_benchmark`'s), and a
  `model` sent to a machine-translation API, a `base_url` for an engine that
  cannot use one, or an `endpoint` without method `api` is refused too. Every
  answer has an `Engine:` line naming the engine that ran and, where it has
  them, its model (or "engine default"), endpoint and key source — and names
  the Translation Memory file it used. The local lanes' TM entries are keyed on the endpoint, so your model
  is never served Ollama's cached output.
- **`translate` TM location is explicit; `project_dir` uses a project's.**
  The tool's own TM is `~/.champollion-mcp/.champollion/tm.json`, separate
  from every project's (`CHAMPOLLION_MCP_HOME` moves it). `project_dir` reads
  and writes `<project>/.champollion/tm.json` instead (the file `champollion
  sync` uses) and runs the engine there, with that project's coaching and
  `.env`, as the CLI does.
- **`translate` failures say why, and engine output never reaches stdout.**
  The engines report failures on the console and return nothing; the tool
  used to answer "translation failed". Their output is now captured per call
  (the reason becomes the failure, the last lines are shown) and echoed to
  stderr. Progress lines that DeepL / Google / Microsoft / LibreTranslate and
  the api engine print to stdout no longer corrupt the JSON-RPC stream.
- **`run_benchmark` jobs survive a server restart.** Hosts restart MCP
  servers; a job then "never existed" although the harness had written its
  results. Every job is now recorded in `~/.champollion-mcp/jobs.json` (the
  newest 50; running jobs are kept) with its command, working directory,
  where results land, status, start time and pid — never its environment.
  mt-eval runs under a small detached supervisor that writes the run's
  output and exit status to `jobs/<id>/`, so the run outlives the server and
  its outcome is recorded with nobody watching. `get_run_status` on any
  server answers from that evidence: RUNNING (supervisor alive, checked
  against its command line so a recycled pid does not count), COMPLETED /
  FAILED from the exit record, or INTERRUPTED with the log tail — with the
  harness's report path and headline numbers read from the results folder.
  Item and corpus runs get their own `--output-dir` inside the job folder;
  queue runs report under the harness's `eval/logs/harness/queue/`. Job ids
  are now random (`run-3f9c2a7b1e04`), unique across restarts. Corpus-mode
  plans name the endpoint a local run will call.
- **New prompt `start_language_project`**; `explore_language` now points at
  `get_language` / `language_overview`. `get_project_info` reports the
  language count from the loaded index instead of a hand-typed "7,900+".
- **Docs match the server.** README tool tables, `instructions.md` (now led
  by the north-star flow and which tool serves each stage) and the tool
  descriptions are checked against the live tool list by
  `test/server-surface.test.js` (in-memory MCP client).
- **Contract suite** (`npm run test:contract`, opt-in): packs this server and
  the local CLI, installs both into a temp prefix, spawns the INSTALLED server
  over stdio with the MCP SDK client, and calls every tool with realistic
  arguments under a scrubbed environment (no API keys, temp HOME) — each must
  return a non-error result or an error naming an actionable prerequisite; no
  stack traces, no "[object Object]", nothing over 60 s.
- Requires `champollion` ^0.4.0.

## 0.1.2 (2026-09-06)

Closes the gap found by the 2026-09-06 benchmark-hosting beta: an agent could
list the *queue* but had no way to ask "what benchmarks exist for eng→yor?".

- **New tool `list_corpora`** (read-only, 24th tool). Lists the registered
  evaluation corpora for a language pair and/or benchmark family from the
  corpus registry — metadata cards only (size, license, contamination grade,
  domain, provider) plus what the harness can actually do with each entry
  (`fetch` on demand from its pinned upstream / `gated` behind an access
  token with the exact accept-terms instructions / `quarantined`). Corpus
  content is never hosted or returned. Quarantined entries are hidden by
  default but always counted, so a catalogued-but-held pair (eng→crk) says
  so instead of looking unsupported. Source ladder: the in-repo
  `arena/datasets/registry.json` when running inside a checkout →
  `champollion.dev/registry.json` (HTML-holding-page guarded) → the prod
  `datasets` mirror over PostgREST (last, and labelled as lagging).
  `CHAMPOLLION_CORPORA_SOURCE=registry|remote|db` forces a rung. Requires
  at least one filter — the registry is thousands of rows and an unfiltered
  dump is never a useful answer. Its normalizer is the JS twin of the
  harness's `corpora_browse.normalize_entry`.
- **Live open-item count was under-reported 3×.** `queue_pairs` returns
  one row per open pair (3,620 on prod) and PostgREST serves at most 1,000
  per response; the live count summed only that first page (69,695 against
  a true 211,082). The fetch now pages with `limit`/`offset` until a short
  page. (A `Range` header is not honoured on this RPC by the deployed
  PostgREST.) Ledger entry D15 in `arena/DATABASE_SCHEMA.md`.

## 0.1.1 (2026-08-27)

Fixes the queue-tool timeouts found by live testing of the 0.1.0 npm release:
with the queue at 211k+ open items, `list_queue`, `estimate_cost`,
`get_project_info`, and `run_benchmark` all exceeded MCP clients' default 60s
request timeout, because the DB fetch path drained the entire `queue_top`
ranking (~423 sequential pages ≈ 3 minutes) before answering anything.

- **Bounded, purpose-fit queue fetching.** Metadata comes from
  queue-preview.json plus a live open-item count from the unpaged
  `queue_pairs` RPC; ranked items are paged from `queue_top` only as deep as
  the caller's selection needs (fetch-until-satisfied, bounded by
  `CHAMPOLLION_QUEUE_MAX_PAGES`, default 20 pages / 10,000 rows); single
  items are read by primary key over PostgREST with a verified-coverage
  probe. When a bound truncates a search, the tool says how deep it looked —
  no silent caps.
- **`get_queue_item` / `run_benchmark(item_id)`** now do a direct by-id (or
  mode+priority) lookup instead of scanning a full drain, and refuse items
  already covered by a VERIFIED run instead of re-spending on them.
- **Queue-mode `dry_run` is backgrounded** like a real run (the installed
  harness loads the full queue before printing its plan): it returns a job id
  immediately; the plan arrives via `get_run_status`.
- **Failure ladder hardened.** A slow-but-alive DB degrades to a
  truncated-but-honest prefix; a dead DB falls back to the static queue.json
  blob; when both are down the error names both causes.
- Harness (mt-eval, monorepo): `--top N` runs now page the DB queue only as
  deep as selection needs, and `CHAMPOLLION_QUEUE_SOURCE=blob` is accepted as
  a sentinel (previously read as a literal file path).

## 0.1.0 (2026-08-27)

Initial npm release.
