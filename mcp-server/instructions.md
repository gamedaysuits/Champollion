Guidelines for using the Champollion MCP server well.

**Before you open any of the user's files:** if a test set might be private
(teacher-checked, nurse-checked, anything a community has not published), do
not read it — no cat, head or preview. You are an outside AI service: what you
read goes to your model provider. Ask, then mark it local-only: save `{"transmission": "local-only"}` as `<file>.champollion.json` beside it
(the guide's step 2 also registers it with `champollion network register-corpus`). The
tools then keep its sentences out of what they print and refuse remote models
for it.

## The flow this server is built for

Someone says: "Let's build a Cree model for our school" or "an Atya phrasebook for the hospital — how do we start?" Walk them through six stages. Each stage has tools. The human-readable version of this flow, with the exact commands, is https://champollion.dev/docs/build-mt-for-your-language — share it with the user.

| Stage | What it answers | Tools |
|---|---|---|
| 1. Discover | What exists for this language? | `search_languages` → `language_overview` (start here) → `get_language`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability` |
| 2. Protect | How do we keep our own data ours — and our test set honest? | the guidance in `language_overview` (local-only marks, private registration); if a model may be trained: `forge_init` → `forge_register_eval` (the test set) → `forge_leak_audit` (the training corpus) → `forge_prereg_template` → `forge_prereg`, all BEFORE any `run_benchmark` on the test file |
| 3. Baseline | How good is what already exists, on OUR test set? | `run_benchmark` (corpus mode, a local model is fine) → `get_run_status`; `preview_publish` (read-only) then `publish_report` only if the user wants a finished result on a board |
| 4. Build | How do we train our own model without fooling ourselves? | `get_training_guardrails`, `forge_status`, `forge_discover`, `forge_split`, `forge_preflight`; training itself (`nmt-forge run`) in a terminal |
| 5. Prove | Is it actually better, and by how much? | `forge_export` (scores the test set once and packages the model), `forge_compare`, `forge_prereg_verdict`, `forge_evaluate`, `forge_lint`, `forge_report`, `get_metric_reliability`, `list_contests`, `get_contest` |
| 6. Deploy | How do people use it? | `nmt-forge serve` on the `forge_export` output (in a terminal), then `translate` (or the champollion CLI) pointed at that local endpoint |

Contributing compute to the public benchmark is a separate, simpler flow: `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `run_benchmark`.

Translating an app or a site's locale files (Next.js, i18next, Django/gettext, Flutter ARB, Markdown) is the champollion CLI's job, in a terminal in the project: `champollion init` (it detects the layout and writes the config), then `champollion sync`, then `champollion verify` — guide: https://champollion.dev/docs/getting-started/quick-start, per framework: https://champollion.dev/docs/integrations/frameworks. The `translate` tool with `project_dir` shares that project's config and Translation Memory, so a string sync already paid for is free here.

### Tool arguments

`name` is required, `name?` optional, `a | b` either name (pass one). Every tool that takes ONE language accepts it as `language`; the original names (`code`, `target`, `query`) still work.

```
search_languages        { query | language, limit? }
language_overview       { code | language, source? }
get_language            { code | language, format? }
list_corpora            { source_language?, target_language?, family?, include_quarantined?, limit? }  at least one of the first three
get_results             { source_language?, target_language?, model?, sort?, limit? }
get_run_card            { id }
get_metric_reliability  { target | language }
run_benchmark           { budget? | top? | item_id? | corpus?, model?, method?, method_dir?, allow_model_pair_mismatch?, attest_local_transport?, provider?, base_url?, target_language?, script?, source_language?, source_field?, target_field?, max_cost?, coaching_file?, glossary?, attest_no_training?, accept_nc_terms?, skip_fst?, skip_eval_standard?, comet?, metricx?, metricx_model?, fuse?, dry_run?, confirm?, publish?, publish_ack?, anonymous? }
get_run_status          { job_id? }
preview_publish         { report, scores_only?, redact_coaching?, anonymous? }   read-only: it cannot publish
publish_report          { report, scores_only?, redact_coaching?, anonymous?, confirm?, publish_ack? }
get_training_guardrails { topic? }
forge_status            { workspace?, project_dir? }
forge_preflight         { target, config?, workspace?, project_dir? }
forge_discover          { code | language, cards_dir?, workspace?, project_dir? }
forge_init              { code | language, dir?, pair?, model?, base?, no_card?, name?, cards_dir? }
forge_split             { corpus, test, seed, out?, dev?, register?, allow_rotate?, near_dupe?, max_group?, workspace?, project_dir? }   out defaults to data/split; register is a name prefix ("project") or true
forge_leak_audit        { corpus, strict?, clean_to?, drop_test_twins?, companion_config?, overwrite?, full_indices?, workspace?, project_dir? }
forge_register_eval     { name, path, role, source_field?, target_field?, allow_rotate?, workspace?, project_dir? }
forge_prereg_template   { out?, force?, project_dir? }
forge_prereg            { id, eval_set, predictions, author?, config_hash?, allow_after_reads?, workspace?, project_dir? }
forge_prereg_verdict    { id, prediction, verdict, by, note?, revise?, workspace?, project_dir? }
forge_export            { run_manifest, out, config?, no_eval?, no_model?, glossary?, endpoint?, port?, name?, force?, prereg?, workspace?, project_dir? }
forge_evaluate          { run_manifest, config?, out_hyps?, harness_out?, glossary?, prereg?, workspace?, project_dir? }
forge_lint              { manifest, run_manifest?, workspace?, project_dir? }
forge_report            { manifest, workspace?, project_dir? }
forge_compare           { eval_set, hyps_a, hyps_b, label_a?, label_b?, run_a?, run_b?, metric?, target_lang?, config_hash?, prereg?, override_respend?, workspace?, project_dir? }
list_contests           { status?, language?, limit? }
get_contest             { id }
translate               { texts, source_language, target_language, method?, model?, base_url?, endpoint?, register?, project_dir?, context?, script?, use_tm?, validate? }
get_project_info        { }
list_queue              { language?, source_language?, model?, budget?, condition?, limit? }
get_queue_item          { id? | priority? }
estimate_cost           { budget?, language?, source_language?, model?, condition? }
```

### 1. Discover

1. `search_languages { "query": "<what the user said>" }`. It tolerates misspellings: when nothing matches exactly it returns the closest names, marked as approximate ("Atya" → the Ayta languages). Each result's second line shows where the language is spoken (countries, a map point, macroarea) and its other names — but only the facts its card cites a source for, each with that source. A location the card holds without a source is never shown: the line says so and links the language's Glottolog record (by its glottocode) instead, the place to compare candidates at the source. In an npm install, a language outside the bundled core set is filled in from champollion.dev's published card tables, whose rows do not carry per-field sources yet (they arrive with the tables' next upload), so its location is withheld and the Glottolog link is what its line has. A name-only result that could not be filled in (offline, or still downloading) says so and has no second line; `get_language` fetches it. When several are equally close, show the user those lines and let them pick; when nothing shown tells them apart, say so — the community knows which variety it speaks. Never guess between candidates.
2. `language_overview { "code": "<code>" }`. This is the one-page answer: what the index knows, which benchmarks exist, published results, which methods can run and with what evidence, tooling (FSTs, dictionaries, keyboards), licence and consent constraints, and numbered next steps that each name a tool or command. Each speaker count keeps its year and scope note (ELCat's "10-99" for Plains Cree counts British Columbia only); two counts from one source with nothing on the card telling them apart are said to be just that — relay every count with its note, never pick or add them. Its FST line is the harness's own reading of this machine (analyzer and pyhfst runtime), named with the harness version and the Python it asked — the one `run_benchmark` runs. forge asks the Python `nmt-forge` runs; if the two tools disagree, compare the interpreters, and re-ask after any install.
3. `get_language { "code": "<code>" }` gives the full cited card when the user wants detail. Every value carries its source. Where sources disagree, every claim is listed and none is chosen. Pass that on as it is: do not average speaker counts or pick a single family. An absent field means unknown, not none, and the answer says which.

### 2. Protect their data (say this before anything runs)

- Nothing the user holds is uploaded unless they choose. The harness reads a local file in place.
- A data steward can mark a file local-only with a sidecar `<file>.champollion.json` = `{"transmission": "local-only"}`. After that, every remote model is refused for it, by this server up front and by the harness underneath. Only a model on the user's own machine can read it.
- `champollion network register-corpus --yes --tier local-only --data <file> --name "<name>" --pair <src>-<tgt> --license "<licence id>" --domain <domain> --role test` writes that sidecar for the user and keeps a card and the text entirely local (`--list` shows the licence ids; without `--yes` a terminal opens the interactive wizard instead). `--role test` records what the set is for (the card says "Role: not stated" without it, and the id then names no role). `--tier private` registers metadata only. Text is never uploaded at any tier.
- The decision about who may see what belongs to the community, not to you.
- If the user may train a model on their own data, write the predictions down NOW, before stage 3 — any `run_benchmark` on the registered test file is a scoring read, and forge refuses a preregistration written after one. The order: `forge_init`, `forge_register_eval` (role `test`; its read log starts here), `forge_leak_audit` on the training corpus (an audit read, never a scoring one; its verdict says whether they will train one model or two: all data, and twin-free), then `forge_prereg_template` → `forge_prereg` with the user, one per planned model. `allow_after_reads` is only for predictions that were truly written before the reads; forge then says so beside every verdict.

### 3. Baseline: measure before building

Hold out a real test set. It must be real sentences, never synthetic ones. If a model may be trained later, the preregistration from stage 2 comes first: a benchmark is a scoring read. Then run models on it with `run_benchmark` in corpus mode:

- A model on this machine, with no key and no spend: `{ "corpus": "/path/to/test.jsonl", "provider": "local", "model": "llama3.1", "target_language": "Plains Cree" }`. This uses Ollama by default. Set `base_url` or `LOCAL_API_BASE` for another local server.
- An open MT model on this machine: `{ "corpus": "...", "method": "local-model", "model": "<Hugging Face id or local model directory>" }`. This needs `python3 -m pip install 'mt-eval-harness[local-models]'`. The harness runs the model in this process, so nothing leaves the machine and it needs NO attestation, also on a local-only file (an `attest_local_transport` for it is refused as meaningless).
- A method plugin the user holds (a directory with `method.json` naming an `entry_point`): `{ "corpus": "...", "method_dir": "/path/to/plugin", "model": "<the model the plugin loads, in its own naming>" }` (`model` is optional; it reaches the plugin as `-m`). The plugin makes its own calls where the harness cannot see, so on a local-only file add `attest_local_transport: true`, but only once the user confirms its transport is local. A model trained with nmt-forge is scored with `forge_export`; its `champollion-plugin/` folder is for the champollion CLI, not a method plugin.
- A hosted model: `{ "corpus": "...", "provider": "openrouter", "model": "<slug>" }`. This sends the text to that API and spends tokens. Only do it if the data's owner agrees and the licence allows it. The harness refuses when it doesn't.
- A registered benchmark: use its id from `list_corpora` as `corpus`.

Pass `source_language` (e.g. "English") for a file that does not state its own pair; when the steward's sidecar or the corpus card it names does, the plan says the harness takes the source language from there. Always `dry_run: true` first. Show the user the plan. Then run with `confirm: true`.

The plan opens with an `EVAL PACK:` line: `missing` (with the setup command, usually `mt-eval setup --lang <code>`), `ready`, or `none needed`. A missing FST (analyzer or pyhfst runtime) never stops the run: it proceeds, and FST acceptance is marked not computed. After the install, `mt-eval test <run log>` adds the FST score without translating again. Any other missing piece stops the run before it translates. Installing is the user's call, done in a terminal. To score without it, pass `skip_fst: true` (no FST acceptance) or `skip_eval_standard: true` (no eval-standard metrics); the run card marks them not computed. The plan also names the corpus licence and its `do_not_train` term, because the run passes `--yes`, which accepts the licence when the harness fetches a corpus from its upstream. A value nobody states is shown as unknown.

The plan names the neural metrics too. COMET is computed on every run whose harness has `unbabel-comet` (`mt-eval setup --comet`: about 300 MB, plus about 2.3 GB of model on first use); the `COMET:` line says whether it will be. `comet: true` makes the run require it. MetricX-24 (`metricx: true`, checkpoint `metricx_model`) and the FUSE-style comparator (`fuse: true`) are opt-in, as in the harness: each needs an extra in the harness's Python and downloads a large model on first use, and the plan says which is installed, what to install and what it downloads. A confirmed run that asks for a metric the harness cannot compute is REFUSED, never run without it: installing is the user's call, in a terminal; or drop the argument and the run card marks it not computed. These run on this machine and are reported beside the chrF++ headline, never blended into it.

The plan also shows what the model will be told. The harness's built-in prompt is shown in full. A coaching file is shown by its length and sha256, plus its first line — except on a corpus marked local-only, where the first line is withheld and the plan says why: a coaching file can be built from the corpus's own sentences, so none of its text is shown for a protected corpus. A coaching file REPLACES the built-in prompt, so the model gets no "translate into <language>, output only the translation" line unless the file says it. The plan gives one verdict on it, in the harness's words: `✓ Coaching:` it names the language (and by which name or code, when that differs), `⚠ Coaching:` it names neither the language nor its code (tell the user to name it), or not checked when no name or code is known for the target. A code as `target_language` ("sme") is named from its language card before it reaches the prompt. When the card lists more than one script and no `script` is given, the plan counts the references' letters by script on this machine (counts only, no sentence) and the run asks for the dominant one. The `Results:` and `Cache:` lines say where the run log, report and translation cache land: they hold copies of the sentences, and a protected corpus's entries carry its mark. A file in a folder `mt-eval contest prepare` marks releasable (a contest's `public/`: it or a folder above it holds `.champollion-releasable.json`, or it is a `public/` folder beside `local/manifest.json`) runs into the contest's `runs/` instead, and the plan says why — never put run outputs where they would be released. `get_run_status` prints the `mt-eval compare` command for finished runs, including runs on a registered corpus id.

### 4. Build

Call `get_training_guardrails` before anyone splits a corpus, generates synthetic data, or reports a number. Then drive nmt-forge one guarded step at a time:

1. `forge_status` first and after every step. It names THE next command, and `summary.tools` names the tool that runs each part of it.
2. `forge_discover`, then `forge_init`. The default model preset, `cpu-tiny`, trains on a laptop CPU in minutes and is weak by design; `cpu-finetune` (an opus-mt model for a related pair) and `nllb-600m` (GPU) are the stronger options. For a language the card index doesn't have yet, pass `no_card` and `name`. `forge_init` returns `project`: pass it as `project_dir` to every later forge tool, because forge resolves config.json's paths and the `.forge` workspace from there — and every relative path argument too (`forge_register_eval`'s `path`, `forge_leak_audit`'s `corpus`): a file beside the project folder is `../data/test.tsv`; an absolute path works anywhere.
3. `forge_split` carves group-disjoint train/dev/test from a `.jsonl` or `.tsv` corpus. Use `test: 0` when the community keeps its own test set as a separate file — registered, screened and preregistered in stage 2 — and split the `clean_to` file the audit wrote. When forge reports test rows with a near-twin in training, follow its advice: `near_dupe: 0.6` when it recommends the near-duplicate carve (`--near-dupe 0.6`), or the route it names when the corpus's templates chain into one group (`max_group`, independent sentences, `forge_leak_audit` with `drop_test_twins`, which also writes the twin-free model's config, `config-notwins.json`). Then `forge_preflight` (target `run`).
4. Training itself (`nmt-forge run config.json`) runs in a terminal, not as a tool. Then call `forge_status` again.

forge's fix strings name CLI commands. These have a tool, and each flag forge names on them is that tool's argument (`--clean-to` → `clean_to`): `status`, `preflight`, `discover`, `init`, `split`, `leak-audit`, `registry add` (`forge_register_eval`), `prereg template`, `prereg new` (`forge_prereg`), `prereg verdict`, `export`, `evaluate`, `compare`, `lint`, `report` — `forge_<command>`. The rest run in a terminal: `run` (training) and `serve` (a long-running server), and the expert commands `prereg check`, `ledger`, `score`, `sample`, `synth`, `verify-split`, `registry list` / `add-harness` and `monitor`; `forge_status`'s `summary.tools` labels such a step `terminal:`.

forge is a Python package: `python3 -m pip install nmt-forge` (0.2.0 or later), plus `python3 -m pip install 'nmt-forge[hf]'` to train and serve. It finds language cards on its own, so no clone of the repository is needed. When it is missing, the forge tools say exactly that. A refusal comes back as a tool error with what, why and fix: relay it and apply the fix, never route around it. forge sets no minimum data size. Its CIs make a too-small set show up as wide intervals instead of a flattering number.

Two non-negotiables to relay word for word:
- Datasets marked `do_not_train` or quarantined NEVER enter training mixes.
- Test sets are REAL DATA ONLY.

### 5. Prove

1. The predictions written in stage 2 (`forge_prereg_template`, then `forge_prereg`, with the user) are what the test score is judged against; scoring is refused without them. One written after the set's scored reads (`allow_after_reads`) is shown as such everywhere its verdict is: the report, DEPLOY.md, the export and `forge_status`.
2. `forge_export` after training. It scores the test set once (with confidence intervals), writes an mt-eval report, and packages the model with DEPLOY.md. `forge_evaluate` is the score-only half. A sealed set is one-shot: whichever tool scores it spends it. A second model exports to its own folder (`forge_status` names it, e.g. `export-<run>/`). When one model's score is inflated by near-twins and a twin-free model of the same test set is exported too, DEPLOY.md and the export cite the twin-free score as the number to quote. When that twin-free model is planned (its config and preregistration written) but not exported yet, the export names it and its next step (`summary.twin_free_planned`): follow that — never write a new after-reads preregistration for it. `summary.score_caveats` (and each twin-free model's, in `summary.twin_free_siblings`) are mt-eval's own caveats on the score, in its words — e.g. a near-constant output: one of a handful of outputs for every source. A MAJOR one goes WITH the score every time it is quoted, "the number to quote" included; relay it word for word. `summary.hypotheses` is the file `forge_compare` takes.
3. A free-text prediction is the user's to judge: show them the prediction and the observed score, ask held or missed, then `forge_prereg_verdict` records their answer (with `by` = who judged). Never judge it yourself; it is shown as a human verdict everywhere.
4. `forge_compare` A/Bs two models on the test set. Its `result.caveats` say, per model, how many test rows have a near-twin in its training data; a winner whose rows are mostly twinned won on recall, not translation — relay the caveats with the winner, never the winner alone (pass `run_a` / `run_b` when the hypotheses did not come from an export; an export's own file is `forge_export`'s `result.hypotheses`). When mt-eval qualifies a system's outputs (`summary.score_caveats`), no score of it is quotable without that caveat.
5. `forge_lint` and `forge_report` read the diagnosis (`forge_report` on a run manifest includes the export's test result). `forge_lint`'s `R9-harness-score-caveat` is mt-eval's caveat on the scores: relay it with them. A dev score at the ceiling (`forge_status` warnings: SATURATED) means checkpoint selection had nothing to choose between — say so; it does not mean the model is perfect.
6. `get_metric_reliability { "language": "<code>" }` tells you which metric to believe for the target language. If it says UNMEASURED, say so. Native-speaker judgment is the real signal there.
7. With several exported models, `forge_status` stays `choose-export` until the USER chooses which to deploy; their answer is recorded with `nmt-forge choose <model dir>` in a terminal. Show each export's `score_caveats` (mt-eval's, in its words) beside its score while they choose. Serving a model to try it (`nmt-forge serve`) is recorded as served, never as the choice — never pick for them. Once the chosen model is served and answers, `forge_status` says `serving`: forge has nothing left to run, and the app's sync is next; a server that stopped gets its `serve` command back, on the same port.

`list_contests` and `get_contest` show sovereign contests: their phases, the terms the organizer promised (with a digest so a change can be detected), and results when they are visible. Entering a contest is a human-authorized CLI flow (`mt-eval contest qualify`, then `submit-model` / `submit-method`). It is never a tool. For a model trained with forge, its export's `model/DEPLOY.md` §6 names the files that make a `submit-model` entry (never `forge-model.json`, which holds the user's test scores), the architecture and the parameter count to declare.

Competing for a prize uses the same loop. Low-resource MT is an open, winnable problem, and a speaker of the language working with a diligent agent can be a serious entry. Useful references:
- the prize spec, for current status: https://champollion.dev/docs/network/specifications/prizes
- the significance spec: whether a difference is real is the significance test's answer (`mt-eval compare --significance`), not a rule of thumb. A small Δ (say +0.5 chrF++) can be statistically significant yet not meaningful: check the confidence interval on Δ and the metric's reliability for the language (`get_metric_reliability`). p-values are per metric and uncorrected for testing several metrics. Never claim a win the CIs don't support: https://champollion.dev/docs/network/specifications/significance
- the method interface: https://champollion.dev/docs/network/specifications/methods
- running a sovereign contest: https://champollion.dev/docs/network/sovereignty/run-a-sovereign-contest

Final evaluation uses secret, community-owned test sets that nobody trains on. The organizer's node re-executes methods. Native-speaker judgment outranks every automatic metric.

### 6. Deploy

`nmt-forge serve <export dir>/model` puts the exported model on this machine (127.0.0.1) with two interfaces: the champollion api method (`POST /translate`) and an OpenAI-compatible `/v1`. It is a long-running server, so it runs in a terminal, never as a tool. `<export dir>/model/DEPLOY.md` has the exact champollion CLI config. Deploy only `model/`: `evaluation/` holds the test sentences and is never copied with the model.

`translate` runs texts through champollion's tested pipeline: engine choice, register conditioning, a persistent Translation Memory (repeats are free), and a deterministic quality gate (a bad translation comes back FAILED with the reason). To use the model the user built, point `translate` at what `serve` prints: `method: "local"` with `base_url` set to its `/v1` URL, or `method: "api"` with `endpoint` set to its `/translate` URL. No key is needed for a server on this machine started without a token. Check the `Engine:` line of the answer. It names the engine that actually ran, with its model and endpoint. An argument the tool does not know is refused, never ignored. The tool keeps its own Translation Memory (`~/.champollion-mcp/.champollion/tm.json`), separate from any project's. Pass `project_dir` to use a project's `.champollion/tm.json` instead: the tool then uses that project's own pair (model, register, script) as `champollion sync --method <method>` resolves it there, so what sync cached is free here and the reverse. `source_language` / `target_language` take a code ("fr") or a name ("French"); with `project_dir` either is matched to the project's own locale code before the cache is touched, and a name that fits two languages (or two project locales) is refused with the choices. A target with more than one real writing system (Plains Cree: SRO or Syllabics) is refused until one is chosen, as sync refuses: pass `script` (`"Latn"`, `"Cans"`), or let the project pair's `script` decide; never choose one for the user. When no text could be translated (an unreachable engine), the answer is a tool error. Each row is marked `cache: pair` or `cache: fallback` (whose cache answered it), and a cached row names the model or setup that wrote that answer when it differs from the engine the `Engine:` line names. A discarded cached answer names the source it collided with, and a model with no known price reports `cost unknown — <why>`, never $0. For a gettext (Django) entry with a msgctxt, pass `context` (one for all texts, or one per text, null for none): the cache is keyed with it as `champollion sync` keys that entry, so with `project_dir` "Cancel" with context "button" is the entry sync filled. Without it, a text the project has only with a context is translated without reading or writing the project's cache, and the answer's `Context:` line names the context to pass.

## run_benchmark: the rules

- **Never run without the user's go-ahead.** Without `confirm: true` (or with `dry_run`) the tool only returns a plan. Remote providers spend real money.
- **Nothing is published unless `publish: true`.** Results stay local by default. When `publish: true` is passed, the plan names the target (normally the PRODUCTION public leaderboard) and lists WHAT GETS PUBLISHED: every row with its source, reference and output text — or scores only — and whether the prompt (a coaching file's full text) is published or redacted. Show the user those lines. A real publish needs `publish_ack` in the exact words the plan prints; write it only after the user agrees to exactly that.
- **A finished report is previewed with `preview_publish` and published with `publish_report`, behind the same gate.** `preview_publish` is READ-ONLY (annotated `readOnlyHint`; it has no `confirm` or `publish_ack` and cannot publish): it returns the harness's own `mt-eval publish <report> --dry-run` preview, WHAT GETS PUBLISHED, the exact `publish_ack` and the exact `publish_report` call that would publish it. Use it for every preview — a host that gates writes can allow it on its own. `publish_report` WRITES (annotated destructive, open-world); without `confirm` it returns the same preview and writes nothing. `scores_only: true` withholds the sentence text; `redact_coaching: true` publishes only the prompt's sha256. For a corpus marked local-only, WHAT GETS PUBLISHED also says which of its facts go public with the score (its id, size, sha256, licence, …), which stay on this machine (every sentence, the file), and how others read a score on a set they cannot open; relay that before asking. Only `confirm: true` with that exact `publish_ack` publishes.
- **It is asynchronous: poll, don't re-run.** A confirmed run returns a `job id` immediately (a real run takes minutes, longer than a 60-second MCP timeout). Poll `get_run_status` every ~15–30s until it reports COMPLETED or FAILED. Calling `run_benchmark` again starts a second run. Jobs are kept on disk, so a job survives a restart of this server. After a restart, poll the same id: it still answers RUNNING, COMPLETED with the results the harness wrote, or INTERRUPTED with its log tail. `get_run_status` with no id lists the job history (newest 50).
- **Refusals are answers.** If the response or the job status says REFUSED, relay it. Examples: a steward's local-only mark, a licence that forbids sending a corpus to a remote model, non-commercial terms the user has not accepted, a cost cap. Never "fix" a refusal by trying another remote provider. The refusal says what IS allowed, usually a model on this machine.
- **Attestations belong to the user.** `attest_no_training` (the model was not trained on this corpus), `accept_nc_terms` (non-commercial use only) and `attest_local_transport` (an MT engine's or a plugin's transport is fully local) are the user's statements. Ask; never assume.
- **A method is not local by its name.** An MT engine (`method: "apertium"`, `"deepl"`, …) is a service: it sends the text to its endpoint (Apertium's default is the public apertium.org). An MT engine and a method plugin directory (`method_dir`) carry the text themselves, where the harness cannot see, so on a local-only corpus each is refused unless the user attests a fully local transport with `attest_local_transport: true`. The harness's own `method: "local-model"` runs the model in this process — nothing leaves the machine — so it needs no attestation. An engine whose configured endpoint is another machine cannot be attested.
- **One cost rule, the harness's.** A model the harness can verify runs on this machine — `provider: "local"` at a loopback endpoint, or `method: "local-model"` in this process — is "$0 API cost (runs on this machine)" in the plan, the start message and the run card alike. So is a method plugin whose method.json declares dependency class S or O with no `gateway` or `external-api` dependency (an S plugin's `dependencies: []`): the plan says the cost rests on that declaration. Any other unpriced run (an MT engine, an A1/A2 plugin or one that declares no class, a model with no published price) is "unknown", never $0 — for a plugin with the harness's reason, from the dependency class it declares (an A1 plugin calls an LLM itself and pays for those calls, so the harness has no token count to price; if its model server is on this machine it may well cost $0, which the harness cannot see). Say what the tool says.

## Contributing compute (the public queue)

1. `get_project_info` gives the overview and live queue stats.
2. Ask about budget and languages. Use `search_languages` to resolve names to codes.
3. `list_queue` shows ranked open items. `get_queue_item` shows one in full. `estimate_cost` shows what a budget buys.
4. With the user's confirmation, call `run_benchmark` with `budget`, `top`, or `item_id`, plus `confirm: true`. Add `publish: true` only if they want the results on the public board.
5. Poll `get_run_status`. If published, `get_results` shows the entry. A run made without `publish: true` can still be published later: `preview_publish` on its report, then `publish_report`.

Queue facts:
- Items are ranked by expected value per dollar. Trust the ranking.
- Budget mode skips an item that does not fit and continues down the queue. Items with unknown cost are skipped in budget mode.
- The preview is what runs: execution is deterministic top-of-queue order (`--no-spread`). Previews scan a bounded top slice and say so when that bound limits the answer.
- An item already covered by a VERIFIED run is refused, so tokens are not spent twice.

## Reading results

- `get_results` shows scored runs ranked by chrF++ with its CI (BLEU, TER, COMET beside it; diagnostics apart; an old card's composite is labelled legacy), with cost and trust level. Rows marked relative-only (high/medium contamination, FLORES, or unknown grade) compare methods on THAT corpus only. Never rank them against absolute-quality rows. An empty board is normal: the first decent method sets the mark.
- `get_run_card` gives one run's full scores and method metadata. Never raw test sentences.
- `list_corpora` shows registered benchmarks for a pair or family: size, licence, contamination, and availability (`fetch` / `gated` / `QUARANTINED`). Quarantined entries are counted even when hidden. "0 listed (3 quarantined hidden)" means the pair is catalogued but held, not unsupported.

## Important rules

- Never spend, run, or publish without the user's explicit go-ahead.
- Cards are an INDEX, not a verdict. Relay every cited claim with its source, and never invent a missing value.
- Measured scores live on the leaderboard (`get_results`), never on a language card.
- Use `translate` for translation. Don't improvise a prompt, and never present a gate-FAILED text as a translation.
- Translation is not evidence. Quality claims come from benchmarks and the leaderboard.

## Data sources

The champollion.dev homepage map is an idealization. Read the data instead (the `champollion://network-data` resource lists every endpoint):
- **Language cards**: the monorepo corpus in a checkout; otherwise the cards bundled in the `champollion` package, the per-user cache (`~/.champollion/cards`), and champollion.dev's published card tables. Read through the CLI's own resolver.
- **Corpus registry**: https://champollion.dev/registry.json (an in-repo copy in a checkout; the prod `datasets` mirror, labelled as lagging, as a last resort).
- **Queue**: served live from the public database (queue-preview.json + the `queue_top` / `queue_pairs` RPCs), falling back to https://champollion.dev/queue.json.
- **Leaderboard and contests**: the public Supabase tables, read with the publishable anon key under row-level security. Aggregates only. An entrant's sign-in email is never read.
- **Provider coverage**: `shared/catalogue/method-coverage.json`. "Covered" is a published-list claim, never a quality claim.
