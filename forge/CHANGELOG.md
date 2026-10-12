# Changelog — nmt-forge

## 0.2.3 — 2026-10-07 · defaults from one file

DEPLOY.md's hosted-fallback example reads the CLI's default from the shared
model-defaults file (`mt_eval_harness.model_defaults`). Requires
mt-eval-harness 0.3.1.

## 0.2.2 — 2026-10-06 · the CLI's new default

DEPLOY.md's hosted-fallback example names `google/gemini-3.8-flash`, the
champollion CLI's default since 0.5.1 (`FALLBACK_EXAMPLE_MODEL`).

## 0.2.1 — 2026-10-05 · exact model slugs

Requires mt-eval-harness 0.3.0 (its `exact_model_refusal`).

### Changed — exact model slugs only (2026-10-05)

DEPLOY.md's hosted-fallback example names the champollion CLI's default model
as an exact slug (`google/gemini-3.5-flash`, `FALLBACK_EXAMPLE_MODEL`), checked
by the harness's `exact_model_refusal`; it used to read the retired alias
`gemini-flash` through the harness's alias registry, which is gone (founder
ruling 2026-10-05: no aliasing for any model).

## 0.2.0 (published 2026-10-04) · scoring standard/1 on every forge surface

Founder, 2026-10-04: "we want scoring to be industry standard". forge
renders the harness's standard (`mt_eval_harness.scoring`) and computes none
of it.

### Changed
- **The headline is corpus chrF++ with its 95% bootstrap CI**, written
  `chrF++ 47.5 [45.9, 49.0]` (`scoring.format_primary`) — taken from the
  export's mt-eval TestReport (`overall.corpus_chrf`, its CI and sacreBLEU
  signature), never the first metric a battery lists and never a weighted
  mean across groups. The export summary and `forge-model.json`
  (`test_report.headline`, `test_report.scoring_standard`) record it with
  its signature; DEPLOY.md opens "What was measured" with it in bold;
  `status`, `report`, `evaluate`, the battery report and every twin-free
  "number to quote" citation quote it. BLEU/spBLEU/TER/COMET sit beside it,
  never blended; exact match and referee lanes are labelled diagnostics.
  No forge surface prints a composite or a quality tier.
- **`nmt-forge lint` on a run manifest** (Round 14 open item): it reported
  "0 findings" for a model whose score carries a MAJOR mt-eval caveat. It
  now lints the battery manifest of every scored export of that run (the
  caveat relayed as R9, beside the headline chrF++ and its CI) and refuses
  a run with no scored export with the exact `nmt-forge export` command.
  R9 findings name the headline they qualify (`evidence.headline`).

## 0.2.0 — 2026-10-03 · from `pip install` to a served model

Driven by synthetic users who had ONLY `pip install nmt-forge
mt-eval-harness`, `npm install champollion` and the public docs, and were
asked to build "a Cree model for our school" (~1,600 pairs + a private
test set) and "an Atya model for the hospital" (~900 pairs + a sensitive
test set). Everything below is something they hit.

### Added
- **A CPU path.** `nmt-forge init --model cpu-tiny` (the new default): a
  ~6M-parameter Marian transformer trained from scratch (`hf-scratch`
  backend) with a BPE tokenizer fit on the TRAIN rows only — minutes on a
  laptop CPU, no download, weak by design and documented as such. Also
  `--model cpu-finetune --base <opus-mt id>` and `--model nllb-600m` (GPU).
  Presets are expanded into explicit numbers in config.json, never hidden.
- **`nmt-forge export`**: scores the test battery once (prereg-gated,
  ledgered, CIs), writes an **mt-eval RunLog + TestReport** through the
  harness's own `build_run_log`/`analyze_run_log` (so `mt-eval compare` /
  `mt-eval export` read it), and packages a self-contained model (no
  optimizer state, LoRA merged, tokenizer included), `forge-model.json`, a
  champollion `method.json` (type `api`) and `DEPLOY.md`. All-or-nothing: a
  failed export leaves no half-written directory.
- **`nmt-forge serve`**: the champollion api-method contract
  (`POST /translate`) and an OpenAI-compatible `POST /v1/chat/completions`
  (translates the JSON object of strings `champollion sync --method local`
  sends) over an exported model. Binds 127.0.0.1; a non-loopback bind
  requires a bearer token; size-capped; serves under the decode hook the
  model was selected with (or refuses, unless `--no-hook`).
- **`serve` protects structure** (`nmt_forge.textpipe`): placeholders
  (`{x}`, `{{x}}`, `%s`, `%(x)s`, `%1$s`), ICU plural/select skeletons (each
  branch's text translated on its own), HTML/JSX tags and entities, inline
  code, URLs and Markdown structure (headings, lists, quotes, tables cell by
  cell, emphasis, link targets, code blocks) are copied verbatim; the model
  sees only the text between them, one sentence at a time. A trained model
  had dropped `{menu}`, `{name}` and ICU plurals, so the CLI's gate refused
  those keys.
- **`serve` answers the CLI's Markdown content requests.** On
  `/v1/chat/completions` the block-batch prompt (`⟦SEG_N⟧` segments) comes
  back segment for segment and the whole-page prompt as the translated body;
  `/translate` takes `text_format: "markdown"` (what the CLI's `api` method
  now sends for content bodies). A newsletter body used to fail through both
  routes and fall back to `[EN]`-prefixed English. Size limits: 20,000
  characters per string, 5,000 pieces of text per request; a model failure
  is a 500, never a partial answer.
- **`export` closes the prereg loop**: it verdicts the preregistration the
  test read was admitted under and prints the verdicts; `prereg check <id>`
  reads an export directory, its battery manifest or its mt-eval TestReport
  (or, with no `--results`, the newest evaluated export of the set), reads
  each prediction against its own `subset`, refuses results for another eval
  set, and says why a row is `manual` instead of a silent `observed None`.
- **The near-twin caveat travels with the number**: when most test rows have
  a train-side near-twin, the export summary, DEPLOY.md's first section
  ("What was measured"), `forge-model.json` and the battery report say
  plainly that the score measures recall of training phrases, not
  translation, next to the strict (no-near-twin) score; the mt-eval
  TestReport carries `nmt_forge_near_twin_*` / `nmt_forge_strict_*` /
  `nmt_forge_score_caveat` fields in `overall`. The battery lint names this
  cause (`R4-recall-not-translation`) instead of telling you to install a
  referee; batteries with several groups get an `ALL (strict)` row.
- DEPLOY.md says what `serve` protects and what happens to strings the model
  cannot do (the CLI's gate refuses them; fill just those keys with
  `champollion sync --method <m> --redo keys:<k1,k2>`, by hand, or via
  `champollion xliff export`).
- `nmt-forge evaluate --harness-out DIR` — the same mt-eval bridge without
  packaging.
- **`--json` on every subcommand**, with one contract: exactly one JSON
  document on stdout, everything else on stderr, refusals as
  `{"error": {type, guard, message, why, fix, …}}` + exit 2. Shapes in
  `docs/JSON_OUTPUT.md`.
- `nmt-forge prereg template [--out FILE]` — the ONE predictions-file format
  and a valid template to edit.
- `split --test 0` — a train/dev-only carve for a community that keeps its
  own test set in a separate, registered file; the fresh sides are screened
  against registered test/sealed sets on the spot.
- `preflight` profiles for `evaluate`, `export`, `serve`; `preflight run
  --config` checks the config parses, its own dev set, its data files, the
  workspace it points at, and that the backend's extra is installed.
- `eval.near_dupe_corpus` in the config's eval block (and in the starter
  config): battery rows with a template sibling in training get a
  "(strict)" score next to the full one.
- `status` knows about exports (`exported` → `nmt-forge serve <dir>`).
- **A run lock.** `nmt-forge run` holds `<workspace>/run.lock` (pid, host,
  start time, run name and directory) for its whole life and removes it on
  any exit. While it is held, `status` reports `training` — wait — with
  `nmt-forge status` as the only command (it used to say `ready-to-train`
  and hand back `nmt-forge run config.json` mid-run); a second `run`
  refuses with what/why/fix; `preflight run` fails `no-run-in-progress`. A
  lock whose process is gone (or whose pid now belongs to a process that
  started later) is stale: status says so and the next run clears it.
- **The near-twin share BEFORE training.** `split`, `leak-audit` and
  `preflight run` (a warning gate, `test-near-twins`) now say what share of
  the test rows have a near-twin in the training data and what that will do
  to the test score — the same measure and reading `export` reports after
  scoring, said while the test set is unspent — with what to do about it.
  `--json` carries it as `near_twin`. `split --near-dupe 0.6` holds out
  whole templates (near-duplicates stay on one side).
- **`leak-audit --clean-to <out> --drop-test-twins` — the lever for a FIXED
  test set.** A school's 200 teacher-written test rows all had a template
  twin in training; forge said on every output that its chrF++ 67.08
  measured recall of training phrases, and nothing could fix it (`split
  --near-dupe` only helps when forge carves the test set; leak-audit keeps
  template siblings as practice). The option also drops the training rows
  that are near-twins of any registered test/sealed row — identical, or
  token-set Jaccard ≥ 0.6 on the source or target side, the near-twin
  forecast's own measure and ONE shared constant (`NEAR_TWIN_JACCARD`), so
  the cleaned file forecasts zero twins — and says how many rows it dropped
  and what the strict subset became (`strict subset: 0 → 200 of 200 test
  rows`); `--json` carries it as `test_twins`. The cleaned file carries the
  source's steward mark like every `--clean-to` file. When the twins are
  every row left it refuses (`TrainingWouldBeEmpty`) and writes nothing.
  The near-twin warning in `split`, `leak-audit`, `preflight run`,
  `export` (its `near_twin` now has `advice`), DEPLOY.md, the battery
  report and the battery lint (`R4-recall-not-translation`, which used to
  say this "cannot be cleaned away after the fact") names it as the fix for
  a fixed test set, next to getting independently written test sentences.
- `nmt-forge --version` (with `--json`: forge, harness and Python versions).
- **A private test set's sentences stay out of forge's output.** For a
  corpus that is local-only (a steward's `<file>.champollion.json`
  sidecar, e.g. from `champollion register-corpus --tier local-only`),
  sealed or consent-required — the harness decides
  (`transmission_policy.withheld_text_reason`), forge only asks it —
  `leak-audit` no longer quotes the rows that matched it (a row that matched
  a private test answer IS most of that answer), nor any row of a corpus
  that is itself marked: it prints the line numbers and overlaps, says once
  why, and prints the text only with **`--show-text`** (a person at the
  terminal; an AI agent reading the output would send it to its model
  provider). `--json` never carries sentences; it now says which corpora
  are withheld (`text_withheld`). Before, the fragment of a nurse-checked
  test answer was printed as `e.g. line 42 "<the row>" → project-test row 3`.
  `split`, `preflight`, the near-twin forecasts, `evaluate`, `export`,
  `score`, `compare` and `registry` print counts, ids, scores and paths only
  — checked end to end against a local-only test set. `registry add|list`
  say which sets are withheld; the `init` brief (NEXT_STEPS.md) tells the
  agent to mark a private test set first, never to read it, and never to
  pass `--show-text`.
- **Errors that quote a private row are scrubbed.** forge's own refusals are
  content-free, but a metric plugin, tokenizer or model can raise an error
  quoting the row it choked on; for a withheld corpus that sentence becomes
  `[sentence withheld]` (the harness's `scrub_corpus_text`), with one line
  saying why. `score`, `compare`, `run`, `evaluate` and `export` take
  `--show-text` to see the error as raised. An unexpected error whose
  traceback had to be scrubbed exits 1 (`--json`: an `{"error": …}`
  document with `text_withheld`).
- **Files carved from a marked corpus carry its mark.** `split` sides,
  `leak-audit --clean-to` survivors and `sample --out` files get a
  `.champollion.json` sidecar with the source's local-only `transmission`,
  sealed `segment` and `licence` (never its card pointer or sha256, which
  describe the source) plus `derived_from`. A JSONL has no envelope: without
  this, the pieces of a local-only corpus read as unmarked — printable, and
  sendable to a remote model by `mt-eval run`.
- **One file, one name.** When a registered file's sidecar names a corpora
  card whose recorded sha256 matches the file, its card `id` (read verbatim,
  never derived) is the **dataset id** in `registry add|list`, the score,
  compare and battery reports, the run manifest's dev set, `export`'s
  summary, `forge-model.json`, DEPLOY.md and the mt-eval RunLog/TestReport
  (`config.dataset_id`) — forge's own set name stays beside it (`set` /
  `eval_set` / `nmt_forge_set`; the ledger, preregistrations and
  `--eval-set` keep using it). The precedence is the harness's own: the
  mt-eval registry id `add-harness` materialized → a JSON envelope's
  `dataset.id` → the card's id → the sidecar's `id` → forge's name. The same
  teacher-checked TSV used to be the card's id in harness runs but
  `project-test` in forge's report and export. `prereg check --results
  runlog_report.json` matches by forge's set name or the dataset id.
- **The mt-eval files carry the corpus's terms.** The RunLog's
  `provenance.dataset_meta` is what an `mt-eval run` on the file records
  (envelope + sidecar + card: `transmission`, `segment`, licence, `id`,
  `corpus_card`, `contamination`), and `config.transmission_policy` is the
  harness's policy for it, enforced for forge's in-process decode — so
  `mt-eval compare` on a forge export withholds a local-only test set's
  sentences too.

- **A saturated dev set is said, loudly** (Round 6 hospital persona: the
  full model's dev score was chrF++ 100.00 [100, 100] with no comment). When
  a built-in lane's 95% CI lower bound is at or above 99% of its maximum,
  `run` prints a `[dev-saturation]` warning, records `dev_saturation` in the
  run manifest, and status, the run report, `export` and DEPLOY.md say what
  it means (checkpoint selection could not tell checkpoints apart — how many
  candidates tied — and dev rows usually have twins in training) and what
  to do (a `--near-dupe` re-split, an independent dev set).
- **Dev near-twins in `split` and `preflight run`**: dev rows with a
  near-twin on the train side, measured exactly like the test forecast
  (Jaccard ≥ 0.6). The split's "0 shared keys" covers exact keys only; a
  later leak-audit had found 7 training rows near-duplicating the dev set.
- **`nmt-forge prereg verdict <id> --prediction <n|id> --held|--missed
  [--by NAME] [--note …] [--revise]`**: a person's verdict on a prediction
  forge cannot verdict (free-text, or no baseline_score), ledgered with who,
  when and the note. `prereg check`, the run report, status and DEPLOY.md
  show it as a human verdict, never as a computed one. Free-text range
  predictions used to stay "manual" forever.
- **`nmt-forge report` on a run includes its export's test result**: score
  and CI, the twin-free strict subset, the near-twin caveat, the twin-free
  model to quote and the prereg verdicts.
- **An inflated export names the twin-free model of the same test set**: its
  DEPLOY.md and the export output cite the other export (name, run, score
  and CI) as the number to quote, whichever of the two was exported first —
  a twin-free export rewrites the earlier inflated export's DEPLOY.md block
  (ledgered as `deploy-note`).
- **`split` refuses a carve that is not the one asked for** (Round 7
  hospital persona: `--near-dupe 0.6` on a templated phrasebook made a
  714-row dev set when 100 were asked for, left 159 training rows, and
  registered it). A carved side may hold up to 1.5× its request (whole
  share-groups cannot be trimmed, so some overshoot is inherent) and
  training must keep at least half of what the request leaves it; beyond
  that `split` refuses before writing or registering anything, with the
  numbers, why (near-duplicate links chain: on a templated corpus most rows
  form ONE group) and the routes that work. `--json` refusals carry
  `details`.
- **`split --max-group N`** (with `--near-dupe`): near-duplicate links are
  cut strongest-first only while a group stays ≤ N rows; exact-duplicate
  groups are never capped; uncut links are counted and the near-twin check
  reports what crosses sides.
- **The near-twin advice names `--near-dupe 0.6` only where it can work.**
  forge measures whether the corpus's templates chain into one share-group
  (≥ 50% of the rows); then split, leak-audit, preflight, the dev-saturation
  warning, export and DEPLOY.md recommend independent sentences, a capped
  carve or (for a fixed test set) `leak-audit --drop-test-twins` instead.
  The near-dupe join is now exact prefix-filtered Jaccard (same groups, a
  20,000-row templated corpus in under 2 s instead of a minute).
- **Reads by `mt-eval` count** (Round 7): registering a test/sealed set
  starts a read log beside the file (`<file>.reads.jsonl`); `mt-eval run` /
  `compare` append one content-free line per scoring read. A prereg written
  after such a read is refused as a postdiction (`--allow-after-reads`,
  ledgered with the count), a sealed set read by mt-eval is spent, and
  status, `ledger show --set`, export, forge-model.json and DEPLOY.md count
  the reads ("not a first look").
- **Two models, one test set** (Round 7 school persona): once the workspace
  holds a second run, the run's NEXT/RUN EXIT lines and status name a folder
  per run (`export-<run>/`) and say the export order does not matter (the
  all-data model's DEPLOY.md cites the twin-free score either way); status
  lists every unexported run's command. Status and `nmt-forge report` say
  which preregistration applies to which run — judged, would bind (and
  why), or ambiguous (export needs `--prereg`).
- **The LYSS rung is never ticked when it cannot run**: the asset ladder
  (NEXT_STEPS.md, `discover`) marks rung 5 unavailable when the card's
  referee package is not installed, or for a local-only/sealed test set,
  with the reason.
- **Reads before registration are said** (Round 8 hospital persona: a
  baseline scored before `registry add` went uncounted, a coached run after
  it blocked the second prereg, and nothing said why). Registering a
  test/sealed set says to register BEFORE any benchmark run, and looks for
  mt-eval RunLogs of the exact file (`provenance.corpus_sha256`) where the
  harness writes them by default (`eval/logs/harness/`, the MCP server's
  `results/` beside the corpus; up to two folders above the test file, the
  project and the working directory). Runs found are listed as *reads
  before registration (not counted)* — in the registration output and its
  `--json` entry, the ledger, status, `prereg new` and DEPLOY.md's "Not a
  first look" — and never counted. NEXT_STEPS.md says register-first.
- **A private-use code is said plainly** (Round 8: `discover qaa` suggested
  the Glottolog code `qahv1234` as a "near code"). For qaa–qtz, `discover`
  says there is no card — no facts, no FST, no prior results — and names
  `init <code> --no-card --name …` and how to move to the real code later;
  NEXT_STEPS.md of such a project says the same.
- **The twin-free model's config is written for you** (Round 9: the school
  and the hospital both wrote it by hand). `leak-audit --clean-to <file>
  --drop-test-twins` writes `config-notwins.json` beside the project's
  config.json (`--companion-config` names another file; an existing file
  is never overwritten): the same config with run_name `<run>-notwins` and
  `data.gold` / `eval.near_dupe_corpus` set to the twin-free file. It prints
  the command that trains it — or, when the dev set is not registered yet,
  says to carve it first and audit again.
- **`compare` says a win on recall is one** (Round 9: `winner=all-data`
  while every test row had a near-twin in all-data's training set). Each
  system's near-twin reading — from `--run-a/--run-b` (its run manifest's
  training files, the forecast preflight uses) or the export that wrote the
  hypotheses (its own `near_twin`) — rides in `near_twin` and `caveats`;
  a significant win by a mostly-twinned system is said not to be evidence
  it translates better. Unknown training data is said to be unchecked.
- **A preregistration written after scoring reads is disclosed wherever
  its verdict is** (Round 9: only `ledger show` said "overrides: 2"). The
  export summary, forge-model.json, DEPLOY.md's prereg block ("Not blind
  predictions"), the battery and run reports, `prereg check`, `prereg new`
  and `status` (prereg line + a standing warning) say "written AFTER N
  scoring read(s), under the --allow-after-reads override".
- **status carries the audit's verdict** (Round 9: `warnings: []` right
  after a SEVERE audit). Every leak-audit ledgers an `audit-verdict` event
  (counts and paths only); status warns, in every state, of a SEVERE
  verdict with the two-model decision until a twin-free corpus exists, then
  of a twin-free corpus whose model is not trained yet.
- `scripts/advice_flags.py`: every `nmt-forge <command> --flag` forge's own
  text names, read with the AST — the MCP server's tests check each one is
  an argument of that command's tool.

### Changed
- **The preregistration is the next step as soon as a test set is
  registered** (Round 9 school persona: the guide put the baselines first,
  and forge then refused the predictions as postdictions). status names
  `missing-preregistration` before the dev split, and says why: a benchmark
  is a scoring read; leak-audit's reads are audit reads and never block one.
  NEXT_STEPS.md's own-test-set route is register → leak-audit → prereg →
  (benchmarks) → split. The rule that a read blocks a later prereg is
  unchanged.
- **Rung 4 of the asset ladder is ticked only when the analyzer is usable
  here** (Round 9: ticked with the crk FST not installed). `discover` and
  NEXT_STEPS.md ask the harness (`fst_state`): a listed analyzer that is
  not installed is "EXISTS … but is NOT usable here", with `mt-eval setup
  --lang <code>`; the analyzer line says "installed here: yes/NO".
- **One FST install command.** The export's not-computed list said `mt-eval
  setup --fst` (and that `mt-eval test` installs the FST, which it no longer
  does); it now says `mt-eval setup --lang <code> && mt-eval test …`, the
  command every other surface names.
- **DEPLOY.md keeps a local-only project's fallback on the machine**
  (Round 9 hospital persona). When the test set's terms are local-only or
  sealed, §2a shows a `local` fallback and a second `nmt-forge serve` first,
  says why, and names the hosted `llm-coached` one only as the data owners'
  choice; otherwise the hosted example comes first with the `local` option
  beside it.
- **The Trainer's "missing keys" notice is replaced by forge's check**
  (Round 9: still flagged after training). It is held while the best
  checkpoint reloads; forge verifies every missing key is tied to the one
  saved copy or recomputed (sinusoidal positions) and prints one line in
  its place — anything it cannot explain releases the original notice
  beside a loud warning. Verified on a real cpu-tiny run: after loading,
  the tied embeddings and `lm_head` share and equal the saved
  `model.shared.weight`; the position tables equal fresh ones.
- `init` names the run `<code>-nmt-<preset>` (e.g. `crk-nmt-cpu-tiny`), not
  `<code>-baseline` — the guide's baseline is the existing model measured
  BEFORE training, and the trained model sat beside it as "…-baseline" in
  exports, DEPLOY.md and `mt-eval compare` (Round 8 hospital persona).
  Projects initialized earlier keep the name their config.json has.
- **The export is two folders: what you deploy, and the evidence.**
  `<out>/model/` is the deployable directory and holds no corpus text —
  weights, tokenizer, `forge-model.json` (format `nmt-forge-model/2`: it now
  lives IN the model directory, `model_dir: "."`, every path relative to
  itself), `DEPLOY.md`, and `champollion-plugin/method.json` (its own folder:
  `champollion plugin install` copies whatever directory it is given into
  the app project, weights and all). `<out>/evaluation/` holds the battery
  report and the mt-eval RunLog + TestReport — the teacher-checked test
  sentences — with a README, a root README and DEPLOY.md all saying never
  to copy it with the model; when the test set is marked (local-only,
  sealed segment, a licence — or the harness withholds it) every file in
  it carries the mark as a `.champollion.json` sidecar (`privacy.carry_mark`,
  as `split` does, now joined with the harness's `corpus_loader.derived_mark`
  — the one shape `mt-eval` writes next to its own run logs and reports;
  a sidecar already there is joined, never loosened; `evaluate` marks what
  it writes too). The RunLog used to sit inside the
  folder DEPLOY.md called "a self-contained, offline model", so copying the
  model to a server shipped the community's test set (synthetic school
  persona, Round 3). `serve`, `prereg check` and `status` accept the model
  directory, the export directory, and exports in the old layout. The model
  is copied BEFORE the test set is read, so a packaging failure no longer
  costs a sealed set's one read. method.json's benchmarks keep numbers only
  (the harness copies plugin lists — e.g. most-missed glossary terms —
  verbatim).
- **The export's mt-eval report is the harness's full battery.** It is
  scored with the plugins `mt-eval run` loads for the target language
  (`plugin_discovery.discover_metric_plugins`, discovered before the test
  read): the FST when it is installed, the card's referee unless the test
  set's terms withhold it, code-switching, hallucination, terminology
  (new `--glossary FILE.json` on `export` / `evaluate`, or
  `eval.glossary`), writing style. What it could not compute is listed —
  metric, why, and the one command that computes it (`mt-eval test …`) —
  in the export output, `--json` (`harness_metrics`), the TestReport
  (`overall.nmt_forge_metrics_not_computed`), `forge-model.json`,
  DEPLOY.md and the evaluation README. The report used to carry chrF++,
  BLEU, TER and exact match only, so a school re-ran `mt-eval` by hand for
  FST, hallucination and terminology scores.
- **DEPLOY.md shows the per-pair `fallback`** next to the primary `api`
  config: the strings the CLI's gate refuses go once to a second method
  (champollion `configuration.md#fallback`), with what it needs and what it
  sends.
- **`discover` reads the card fields the CLI's `card` reads**:
  `lexicalResources.dictionaries`, `documentation.medLevel` (Glottolog's
  most extensive description — "long grammar" for crk) and EVERY
  `typologicalProfile` feature, through the harness adapter (a feature whose
  sources disagree shows every claim). It used to say crk's card was silent
  on dictionaries, grammars and typology.
- **Language cards resolve through the harness** (`mt_eval_harness.
  language_cards`): `--cards-dir` → `$MT_EVAL_CARDS_DIR` /
  `$CHAMPOLLION_CARDS_DIR` → a checkout or `node_modules/champollion` above
  the working directory → the public card index (cached; reused offline).
  `discover`/`init` no longer need a monorepo; an unreachable index says
  exactly how to export a card with `champollion card <code> --json`.
- **leak-audit** separates leaks from template siblings: a target that
  overlaps an eval answer ≥ 0.6 is DROPPED only when it contains the answer,
  is a fragment of it, or is ≥ 0.9 identical (diacritics folded, so spelling
  variants count); a pure word SUBSTITUTION ("I see the dog" / "I see the
  cat") is a kept, reported `near_dupe_template` lane, and the eval rows with
  such siblings are listed. A row hitting several sets counts in each.
  Output is **deterministic** (sets by name, rows in file order — per-set
  counts used to depend on PYTHONHASHSEED) and **human-readable** by default:
  what would be dropped, what is kept and why, with examples (corpus rows
  only; eval text never; nothing quoted for sealed sets, nor for a
  local-only / sealed / consent-required corpus or a row that matched
  one — see Added). `--clean-to`
  writes `<out>.audit.json` next to the survivors.
- **Predictions files**: one format (a JSON array of prediction objects),
  validated with what/why/fix — Markdown, a wrapper object, unknown metric
  names, non-numeric baselines and the template's unedited REPLACE text are
  refused; no more raw JSON tracebacks.
- `status` prints runnable commands: `prereg template … && prereg new <id>
  --eval-set …` (the old `--eval <name> --predictions <predictions.md>` only
  worked through argparse abbreviation and crashed on Markdown); the split
  advice uses the real flags; `ready-to-train` runs preflight first;
  `ready-to-score` suggests `export`.
- Default (human) output of `split`, `registry add|list|add-harness`,
  `init`, `leak-audit`, `sample` and `prereg check` is now text; the JSON
  they used to print by default is what `--json` prints (same shapes, new
  fields added). Callers parsing the old default output must pass `--json`.
- Argument abbreviations are refused (`allow_abbrev=False`).
- The eval cadence is derived for small runs (`min(2000, ⌈planned/10⌉)`):
  a 1,600-pair run used to be evaluated zero times and refused; a
  `model.eval_steps`/`patience` the user sets is no longer overridden.
- A run that simply reached its last step is no longer reported as "early
  stopping fired" (only the patience counter counts).
- Checkpoints rotated out by `save_total_limit` are path-less, so selection
  can never decode a different model under their name; checkpoints carry
  their tokenizer; only model weights are saved (`save_only_model`).
- `[hf]` extra now includes `accelerate` (required by the transformers
  Trainer), `tokenizers` and `sentencepiece`; `transformers>=4.46`.
  transformers 5 uses `warmup_steps` (ratio) instead of the deprecated
  `warmup_ratio`. Decode uses CUDA when present.
- Batteries without an `id` field (what `split` writes) evaluate (positional
  join); a battery without the grouping field is one group, `all`.
- A card-declared referee whose dependencies are missing surfaces as an
  actionable forge error (`mt-eval setup --lang <code>`), not a traceback.
- `init` wires a card's referee lanes (e.g. `champollion_lyss` for crk)
  into `selection.plugins` only when that OPTIONAL package is installed;
  otherwise NEXT_STEPS.md and the init summary name it and how to add it —
  the starter config passes its own preflight on a plain install. `discover`
  labels the referee optional and says whether it is installed.
- `discover` says plainly what each eval-dataset id means for the user:
  never-train / quarantined (not usable as a test set) / scoring-only via
  `registry add-harness`, or NOT RUNNABLE when the mt-eval registry does not
  list it (naming a schema fixture as such when its corpus card is
  reachable).
- The wall-clock gate no longer projects from warm-up steps: its clock
  starts after `model.budget_warmup_steps` (10), the first projection is
  labelled an EARLY estimate, and a steady-state RE-ESTIMATE follows; the
  budget refusal rests on the re-estimate (a > 3× overrun still refuses at
  once). Fast steps print as `it/s` and short runs in minutes (a ~4-minute
  run used to print "0.0s/it … ≈0.7h").

### Fixed
- `serve` on a busy port said "file error: [Errno 48] Address already in
  use"; it now says the port is in use and gives the `--port` command and
  the endpoint to match. The port is bound before the model loads, so the
  answer comes at once.
- `_harness` monorepo fallback no longer puts `arena/` on `sys.path` (which
  made `arena/datasets/` shadow Hugging Face `datasets` and crashed every HF
  training run); it loads `mt_eval_harness` by location. The HF backend
  names a shadowing `datasets` directory instead of crashing.
- The `score` preflight's `sealed-unspent` gate looked for a ledger event
  that is never written, so it always passed.
- `_harness` text no longer says the harness is unpublished.
- `discover` from the public card index reported `scripts: unknown` (and no
  direction) for cards the CLI shows as Latn: the harness's remote card is
  the detail blob alone; forge now merges the card-index identity row the
  way the CLI does (fill, never overwrite), then the one adapter — whose
  cited primary `script` is now reported (`[primary]`).
- `status` right after `init` said "discover, then init" again; it now
  reports `initialized` and names the split (and the own-test-set path).
  NEXT_STEPS.md's card summary no longer lists `init` as a next action.
- `status` showed only the newest run (and took the alphabetically last run
  directory as the newest); every run is listed with its checkpoint, dev
  score and where it was exported.
- After a second run, `status`, the run's NEXT line and its RUN EXIT line
  all said `--out export/` — the folder holding the first model. They now
  name a fresh `export-<run>/` once `export/` is taken, and `export`'s
  refusal of a non-empty `--out` names the run it holds and that folder.
- With two preregistrations on one test set, status (and `forge_status`)
  said export needs `--prereg` but its `next_command` — and the run's
  NEXT / RUN EXIT line — left the flag out (Round 8 school and hospital
  personas). The command now carries it: the one candidate not already
  judged against another run, or `--prereg <a|b>` when the choice is the
  user's, with the reason beside it.
- An all-data export's `near_twin.advice` (export summary, MCP result,
  forge-model.json) still said "drop the near-twins … and retrain" after the
  twin-free model was exported (Round 8 school persona). With a twin-free
  export of the same test set in the workspace it now cites that model's
  score instead (`twin_free_cited`), whichever was exported first — a later
  twin-free export rewrites the earlier forge-model.json as well as its
  DEPLOY.md, `--no-model` exports included.
- **The dev-split advice resolves** (Round 11 school persona: after a
  capped re-split the dev set was still 91% twinned and split kept saying
  "follow the advice before training", with the same advice and no
  stopping point). One verdict, `ci_scoring.dev_twin_verdict`, read by
  split, `preflight run`'s `dev-near-twins` gate, `status` and the run's
  saturation note: on a corpus whose templates chain, `no-split-fixes`
  (`final`) says once that no split gives a twin-free dev set that is a
  sample of the data, what a twinned dev set means (checkpoint selection
  measures recall, not translation) and the options forge has — accept it
  and judge translation by a twin-free test score, register independently
  written dev sentences, or a capped carve that only lowers the share.
  Split now measures the carve check after a `--max-group` carve too (its
  test advice had gone back to "`--near-dupe 0.6` does exactly that"), and
  split and preflight record the reading as a `dev-twin-verdict` ledger
  event that `status` repeats until a run has trained on those files.
- Split on the two-model route (a twin-free companion already written for
  the registered test set) says the all-data split's twins are expected —
  the words preflight's `test-near-twins` gate uses — instead of "fix it
  before training" again.
- `status` (and the re-run `leak-audit --drop-test-twins`) kept saying
  "write the twin-free model's preregistration" after it was written
  (Round 11 school and hospital personas): the clause read no
  preregistration. It now says a pinned one is the twin-free model's, that
  two or more binding the test set need nothing more (name them on export
  with `--prereg`), or that one is still to write.
- `preflight run` printed a 12-character config hash; `prereg new
  --config-hash` compares the full 16, so a pin made from it bound no run.
  Preflight prints the full hash, and `prereg new` refuses a shorter hex
  prefix with where to get the full one.
- `init`'s note said "carve and register a split first" while its next
  step and the guide said register the test set, screen, predict (Round 11
  hospital persona). One order, `scaffold.STEP_ORDER` (register →
  leak-audit → prereg, one per planned model → baseline → split → train),
  feeds init's note and `order`, NEXT_STEPS.md, `status`'s `initialized`
  advice (own test set first; `advice.order`) and the MCP hints; a test
  checks the guide and the README against it. The README, NEXT_STEPS.md and
  the site's export examples name the preregistration (`--prereg`).
- **The harness's score caveats travel with every forge score** (Round 13
  hospital and school personas: mt-eval flagged the twin-free model's test
  output as near-constant — 150 of 150 sources got one of 9 outputs; 196 of
  200 one of 5 — in the TestReport forge wrote, while the export summary,
  both DEPLOY.md files, `status`, `report`, `compare` and `lint` left it
  out and the all-data DEPLOY.md called that score "the number to quote for
  new sentences"). `nmt_forge.harness_caveats` relays every `score_caveats`
  entry verbatim — computing none — into the export summary and
  `forge-model.json` (`score_caveats`), DEPLOY.md (under the score, in a
  block forge refreshes whenever it rewrites the file; §5's test line
  points at a major one), `status` (`advice.exports[].score_caveats`, the
  twin-free sibling's too), `report`, `compare` and `lint`
  (`R9-harness-score-caveat`, `high` for a major caveat; the battery
  report's Diagnosis too). A score with a major caveat is "the number to
  quote — but read this caveat first", and is no longer said to measure
  translation of unseen sentences. Exports and battery manifests written
  earlier are read from their TestReport; a TestReport without the key gets
  no sentence.
- The twin-free leak audit called every row it dropped for the dev set
  "your registered dev set's own rows" (Round 13: 90 for an 80-row dev set
  — 80 copies, 10 near-duplicates of their answers). The count is split by
  kind (`copy_rows`, `copied_eval_rows`, `near_dupe_rows`; verdict numbers
  `dev_set_near_duplicates_among_them`, `dev_set_leaking_rows`,
  `dev_set_rows_registered`) and the summary names each.
- The export names the hypotheses file `compare` takes (`hypotheses`,
  `compare_hint`; `status` lists each export's) — the persona guessed it.
- `discover`'s FST line names the Python it checked (`fst.checked_in`): the
  check is the harness's own `config.fst_state`, and another tool running
  another Python can see a different install.
- The training guardrails are named once, before the split: a `guardrails`
  step in `scaffold.STEP_ORDER` (init's note and `order`, NEXT_STEPS.md,
  `status` in `initialized`) and `status`'s `no-dev-set` command — the MCP
  tool `get_training_guardrails`, or the public "Train a Model Honestly"
  page (Round 13 school persona: the rules were read after splitting).

## 0.1.0 — 2026-07/08

First packaged release (never published to PyPI): the guards (split,
dev-fence, leak-audit, ledger, preregistration, CIs), synthesis engine,
training runner with schedule sanity, `evaluate`, `status`/`preflight`,
the battery lint and monitor.
