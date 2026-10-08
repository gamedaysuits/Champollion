# Changelog

All notable changes to the MT Eval Harness (arena) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] — 2026-10-07 — one file for every default model

- The default model comes from `mt_eval_harness/data/model-defaults.json`
  (the shared `shared/model-defaults.json`, parity-tested), read by
  `mt_eval_harness.model_defaults.default_model(role)` — never written in code.
- The retired-alias table ships as package data too
  (`data/retired-model-aliases.json`); the hand-kept mirror in config.py is gone.

## [0.3.0] — 2026-10-05 — exact model slugs

### Changed — exact model slugs only, no aliasing (2026-10-05)

Founder ruling, 2026-10-05: "slugs should be specific, NOT ALIASES — for all
models, all slugs, no aliasing." `-m/--model` takes an exact slug only.

- **The default model is an exact slug**: `google/gemini-3.1-pro-preview`
  (it was the alias `gemini-pro`, which resolved to the same model).
- **Retired aliases are refused**, naming the slug each stood for:
  `gemini-flash`, `gemini-pro`, `claude-sonnet`, `gpt`
  (`shared/retired-model-aliases.json`, which replaces
  `shared/model-aliases.json`; `MODEL_REGISTRY` is gone, and
  `RETIRED_MODEL_ALIASES` is read only by the refusal).
- **Floating ids are refused** on every provider: OpenRouter's `~vendor/…`
  router ids and any `…-latest` / `:latest` name — a run must say which model
  translated.
- **No vendor guessing**: `fuzzy_resolve_model` is removed. On OpenRouter a
  bare name (`gpt-5.5`) is refused; write `openai/gpt-5.5`. A multi-model
  `-m a,b` run checks every model before any run starts.
- A method plugin's `-m` reaches it exactly as given (a retired alias was
  expanded before). `mt-eval list models` shows the default and the retired
  names with the slugs to write.

## [0.2.0] — 2026-10-04 — scoring you can defend

0.2.0 is a SCORING release: the same run scored by 0.1.x and 0.2.0 can
differ, and the version is what keeps the two from being compared as one. The
harness version is now part of the cache key (a fixed harness is never served
outputs cached by a broken one) and of the fingerprint recipe. Cards from
0.1.x keep their ids; a 0.1.x run log republished under 0.2.0 still produces
its original id (fingerprint v1).

### Changed — the scoring standard (2026-10-04)

Runs are scored the way WMT, FLORES-200 and AmericasNLP score them
(`scoring.SCORING_STANDARD` = `"standard/1"`):

- **The headline and ranking metric is corpus chrF++** (sacreBLEU chrF,
  word_order=2) with its sacreBLEU signature and its 95% bootstrap CI. A new
  run card's `scores` carry `scoring_standard: "standard/1"` and
  `primary_metric: "chrf_plus_plus"`; the DB columns are unchanged
  (`chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`).
- **BLEU, spBLEU, TER and COMET** (when computed) are shown beside it, never
  blended into it.
- **Diagnostics** — exact match, FST acceptance, morphological accuracy,
  code-switching, hallucination, terminology, writing style — and every
  score caveat are reported separately, labelled as diagnostics.
- **Retired: the weighted composite and the quality tiers.** A new card
  publishes `composite`, `quality_tier` and `cost_adjusted` as null; no
  output prints a composite or a tier. Why: an untrained model repeating one
  valid Northern Sami sentence for every eng→sme input scored a composite of
  0.6244 ("functional") with chrF++ 5.5, and a word-dropping toy glossary
  0.6612. On chrF++ both rank below a real translation.
- **Legacy cards stay verifiable**: the verifier re-derives a card with no
  `scoring_standard` with the legacy composite ("legacy-composite", from its
  own stored component scores), and a standard/1 card by re-deriving chrF++
  (it must carry no composite or tier). An old card's composite, where still
  shown, is labelled "legacy composite (retired)".
- `mt-eval test` / `publish --dry-run` / the run card print the headline as
  `chrF++ 47.5 [45.9, 49.0]` with its signature, then the standard metrics,
  then the diagnostics. `export-config`'s `_benchmark_summary` carries the
  headline, its CI and signature, and null composite / tier.

### Changed — scoring (every item changes a number)

- **Direct Anthropic runs** (`--provider anthropic`): `temperature` is always
  sent. At 0 it used to be omitted, so the API default of 1.0 applied and a
  "deterministic" run sampled. Registry slugs (`anthropic/claude-haiku-4.5`)
  are now sent as the API's hyphenated ids (`claude-haiku-4-5`); the dotted
  id was a 404, so such runs failed on every request before. Both verified
  against the live API on 2026-09-27.
- **Multi-line sources** are translated whole. They were cut to their first
  line: the numbered batch prompt is one line per item, and `clean_response`
  kept one line. They now go through single mode, which keeps as many lines
  as the source has and never more (extra lines would inflate chrF's recall).
  About 250 registry datasets are document-level.
- **COMET, reference-free QE and MetricX** score an empty prediction as an
  empty hypothesis, the population chrF++/BLEU already scored. Dropping it
  raised the corpus score of systems that failed to translate. Per-entry
  scores are now aligned to their entries; every score after an empty
  prediction used to land on the wrong entry, and the bootstrap CIs used them.
- **Fingerprint v2** (run logs from 0.2.0 on) adds `api_provider`, a sha256
  of the endpoint host (never the raw URL), `max_tokens`, `method_version` and
  `method_sha256`. Under v1 the same model run via OpenRouter and via a direct
  API shared one card id, and since rows are immutable the second was refused
  as "already published". The duplicate message now says what "same
  experiment" was matched on. This is client-side: `card_id` is computed by
  the client, and the database does not re-derive it.
- **Cache key**: adds the sha256 of the prompt actually sent and the harness
  version.

### Fixed — FST metrics were off for every language since 2026-08-12

- The FST install pins lived on the language cards; the atlas cutover
  projected cards without them, so `get_fst_install_info()` returned None
  everywhere and plugin discovery skipped the FST metric without a word —
  no `fst_acceptance_rate` or morphological accuracy for Plains Cree or any
  other language. The 12 pins (recovered from the pre-cutover cards) now
  ship in the wheel as `mt_eval_harness/data/fst-pins.json`; a host can
  substitute its own with `MT_EVAL_FST_PINS`. A card's own install block is
  no longer read: one source.
- An installed FST that is not the pinned build (this Mac carried the 2021
  crk build) is named on every run; the run card already records which
  build scored it.
- A pinned build the GiellaLT nightly pool has pruned fails with the builds
  the pool now holds and how to re-pin, instead of a bare 404; a package
  missing any pinned file is refused before anything is written.
- **crk re-pinned e1f96fea → bec054ef (2026-09-29)**: the pool had pruned
  e1f96fea, so no fresh install could fetch it. Regression run first: six of
  the seven files are byte-identical, the seventh differs by two unused
  tags, and 8,039 surfaces from lang-crk's own test yamls analyse
  identically (0 regressions).
- `mt-eval setup --status` walked all ~8,700 cards, one HTTP fetch each,
  from a pip install (many minutes); it now reads the dozen pins.
- Auto-installs (FST runtime, COMET, eval standards) died with "No module
  named pip" in a `uv venv`; they bootstrap pip with `ensurepip`, else use
  `uv pip install --python <this interpreter>`.

### Fixed — a TSV test set meant something else to the harness

- `--corpus file.tsv` scored `# ` comment lines (and an unrecognised header
  row) as test sentences against an empty reference — a silent miss in every
  metric — and csv quoting let a sentence opening with `"` swallow the rows
  after it. TSV is now split on TAB with no quote processing (the MT
  convention), `# ` lines are comments, a BOM is stripped, and a file where
  some rows lack a reference is refused with their line numbers.

### Fixed — found by synthetic users (2026-10-03)

- **Significance and CIs read FST validity as 0.** `compare --significance`
  and the per-run bootstrap CIs read a per-entry FST key no plugin writes, so
  every FST test was 0.00 vs 0.00, p=1.000, and no run had an FST CI. Plugin
  rates are now resampled from the values the report actually holds (the FST
  metric through its own aggregation); a rate with none is listed as not
  tested. The composite and TER (lower is better) are now tested too, as the
  significance spec says.
- **A speller acceptor is not an analyzer.** The Divvun FSTs installed for
  sme, amh and eus answer yes/no with no lemma or tags, so morphological
  accuracy was word overlap. Their pins now declare `kind: "acceptor"`, a
  transducer that never returns a tag is detected too, and
  `morphological_accuracy` / `morph_coverage` are null with the reason in
  `metric_availability`. FST acceptance is still reported.
- **Method plugins name their code and model.** A `--method <dir>` run
  records the plugin's declared version, a sha256 over `method.json` and its
  `.py` files, and the model it called (`metadata.model` on its results, or a
  declared `model`); they fill the fingerprint's `method_version` /
  `method_sha256` and `method_config.model`.
- **`contest prepare` no longer licenses data on its own.** `--license` is
  required; it used to default to CC-BY-4.0.
- **A local-only corpus is refused before the API key is asked for**, so the
  more fundamental answer comes first.
- **A local-only corpus reaches no outside service through its language's
  metrics.** The card's eval-standard metrics (e.g. the Cree standard, which
  looks words up online) are not loaded for a sealed/local-only run, the run
  card says why, and the eval-pack gate no longer demands their packages.
- **Prompts on publish.** The preview says the system/coaching prompt is
  published with the card, also in scores-only mode. `--redact-coaching` now
  always redacts (it did nothing when the prompt held no corpus pair), and a
  local-only corpus redacts a coached prompt by default.
- **Run outputs stay out of git.** The output and cache directories mt-eval
  makes, and its defaults, get a `.gitignore` containing `*`.
- **Organizer wording.** Messages no longer ask for "the DEV branch project"
  or name repo paths a pip install lacks; `mt-eval node init` writes a
  complete starter `node.json` (with the public qualifier gate), and a node
  config with half a gate is refused at startup.

### Fixed — found by synthetic users, Round 4 (2026-10-03)

- **A plugin or engine run records what carried the text.** A `--method
  <dir>` run recorded `api_provider: "openrouter"` (the unused default) —
  inside fingerprint v2 too — and "naive" in its run id. It now records
  `method-plugin`, or `local` under `--attest-local-transport`; an MT engine
  records its id; the run id carries the plugin's method class. Publish and
  `scripts/lint_run_reports.py` derive the same value for older run logs.
  **This changes the v2 card id of plugin and engine runs** (the recorded
  value was false). No migration keys on the value (002 default, 051/063
  length cap only).
- **The transmission gate saw plugins as the default LLM.** The plugin is
  loaded after the gate, so a `--method <dir>` or engine run was judged as an
  OpenRouter call: `--attest-local-transport` could never apply, and an
  engine's no-train channel was stamped as OpenRouter's. Engines and plugins
  are now the external-method lane; the attestation is recorded in every
  mode.
- **One contest id.** It is the `--slug` given to `contest prepare`
  (validated; recorded in the manifest as `contest.id`); register, `node init
  --from-contest` and every help text use it. It used to come from `--name`
  while the help said "Contest slug". Manifests without `contest.id` keep
  their name-derived id. `contest create --slug` sets it too.
- **Offline custodian approval.** An entrant's `--offline` proposal arrives
  pending; `node approve|deny <id> --offline` records the decision in the
  node's local ledger plus a record signed with the node key, `node list
  --offline` reads local state, and `node run-method --offline` refuses a
  pending proposal until that approval verifies (it used to run it).
- **Source-copy caveat.** When at least half of a run's outputs equal their
  source (the echo comparison), a `source_copy` score caveat sits beside the
  composite and on the published card. Weights unchanged.
- **The cache marks a protected corpus.** Entries for a local-only, sealed or
  consent-required corpus live in `protected/<namespace>` (keyed by config,
  corpus sha256 and terms), each with a `.champollion.json` mark.
- **Target language: code beats name**, and the generic plugins (and a
  requested glossary) load when the language does not resolve. An unreadable
  `--style-profile`, or `--fuse` / `--metricx` without their dependencies, now
  refuse before anything is spent.
- **Smaller fixes.** Inline `--coaching` publishes as `inline coaching`, not
  a temp path; install hints name `mt-eval-harness[...]`; `prepare
  --no-register` records its registration flags for `contest register`; one
  cost wording everywhere (`$0 API cost` only for a verified loopback model),
  integer token counts; a shorter service-key message that points at the
  offline commands; `contest register`'s sign-in error no longer suggests
  `--no-publish`; engine/plugin runs show only the settings that applied.

### Fixed — found by synthetic users, Round 5 (2026-10-03)

- **A method plugin is handed its model, and the run records it.** The runner
  replaced `-m` with the plugin's method id before the plugin ran, so a
  plugin never saw the model it was given, and the run card and fingerprint
  dropped it: one plugin on two models published one fingerprint. `-m` now
  reaches the plugin as `config.method_model` (in the plugin's own naming,
  never refused as an unknown OpenRouter model or fuzzy-renamed), and the
  run card carries a `method_plugin` block (version, code hash, model given,
  models called, `dependency_class`, the declared `dependencies`). **Plugin
  runs' v2 fingerprint gains `method_model` and `method_dependencies_sha256`,
  which changes their card id** — before 0.2.0 is released, and for plugin
  runs only. `scripts/lint_run_reports.py` re-derives the same recipe.
- **The report names both composites.** Its bootstrap CI of the segment
  composite (chrF++ + exact match re-weighted) was stored as
  `composite_score`, beside a published composite of another value. It is now
  `confidence_intervals.segment_composite`, and `overall.published_composite`
  carries the composite publish records, from the same code
  (`publish.derive_composite`). Readers take the old key as the segment
  composite; `export-config` no longer derives a quality tier from it. No
  weight or significance-test change.
- **Offline approval follows the Step 9 order.** `node run-method --offline`
  on a pending proposal now runs only the node's checks (qualifier
  re-executed on the public dev set; container runtime and sandbox caps for
  a code entry), records a pass in the local ledger and stops, and `node
  approve --offline` refuses until that record exists, naming the command to
  run first. A qualifier miss there is the node's recorded denial; no
  custodian is asked. The sealed run re-runs every check, as before.
- **An echo does not qualify.** A dev run whose outputs are mostly copies of
  their source (the one source-copy rule, same 50 % bound, entries whose
  reference is the source left out) is refused by `contest qualify` (recorded
  on the receipt as `refusal`) and by the node's re-execution, whatever its
  score.
- **Qualifier receipts are kept per system**, at
  `~/.mt-eval/qualifier/<contest-id>/<system-slug>-<hash>.json`, and name
  their system. Re-qualifying a system keeps the previous receipt under
  `history/`; `submit-method` / `submit-model --system` choose the receipt
  (default: the one for `--name`, else the contest's only one).
- **`node init --from-contest` fills `prize_terms_sha256`.** `contest
  prepare` and `contest register` now record the registration choices,
  prize terms included, in the manifest whichever door registers.
- **Cost of outputs made outside the harness is unknown, not $0.** The
  hypotheses lane (`contest qualify`, a node's scoring) recorded 0.0 and
  printed `$0.0000`; it records null and says why.
- **The local report says what the model was told**: `instructions` names the
  coaching file and its sha256, the system prompt's sha256 and length, and
  where the full text is (the run log). Publish never copies it; the
  local-only prompt redaction is unchanged. The run card shows it, and now
  also shows the corpus and prompt hashes it read from the wrong place.
- **A forge model publishes under its own name.** nmt-forge's
  `export`/`evaluate` RunLogs carry `mt_method: "nmt-forge"` for every model,
  and the slug ladder preferred it, so different forge models shared one
  `model_slug`. When `mt_method` names no registered harness engine, the
  embedded method card's `method_id` is the slug (forge's
  `nmt-forge-<run-name>`); registered engines are unchanged. **This changes
  forge runs' `model_slug` and so their card id** (the slug is a
  fingerprint component). An id over the column's 300-character cap
  (migrations 051/063) is refused before the database. `lint_run_reports`
  derives the same slug.
- **The harness's own `local-model` adapter is local transport.** It loads
  the model in this process, so a local-only, sealed or consent-required
  corpus no longer needs `--attest-local-transport` for it (recorded channel
  `in-process`). Marked on the adapter class (`in_process_transport`); MT
  engines that call a service and every method plugin still need the
  attestation.

### Changed — a missing FST is an advisory (Round 8, 2026-10-04)

- A missing FST analyzer or pyhfst runtime no longer stops `mt-eval run`
  (the eval-pack gate) or `mt-eval test` (plugin discovery). The run
  proceeds, FST acceptance and morphology are marked not computed with the
  reason, and the notice names `mt-eval setup --lang <code>`. After that
  install, `mt-eval test <run log>` adds the FST score without translating
  again. A Cree school whose agent host refused both the install and
  `--skip-fst` got no baseline at all, while nmt-forge scored the same test
  set. `--skip-fst` stays: it leaves the FST out without the notice. Nothing
  installs or downloads by itself, and nothing ever prompts. Any other
  missing eval-pack piece still stops the run. Scoring weights are
  unchanged.
- One reading of the FST lane (`config.fst_state`) now drives
  `setup --status`, the eval-pack lines, the run's advisory and (through
  the harness) the MCP overview. `setup --status` used to say pinned FSTs
  "auto-download on first eval".

### Fixed — found by synthetic users, Round 8 (2026-10-04)

- The run card shows COMET and MetricX rows when they were not computed,
  with the reason from the report's new `overall.metric_availability` (the
  same block publish records, e.g. "not computed — unbabel-comet is not
  installed — mt-eval setup --comet"). The report also records
  `comet_unavailable`.
- The report JSON carries `overall.cost_label`: the words every other
  surface uses (e.g. "$0 API cost (runs on this machine)"). The stored
  number stays null when the run is unpriced.
- `mt-eval publish --dry-run` says the row is listed as self-benchmarked
  (trust `unverified`), which score lane it lands in (absolute-quality or
  relative-comparison-only, by contamination grade), and, with
  `--anonymous`, that it is submitted anonymously.
- Offline node commands no longer print the six-line "set
  MT_EVAL_SUPABASE_SERVICE_KEY … or add --offline" text. Loading node.json
  compared test suites with the contest database on every load; only
  database commands (serve, list, approve, deny, connected run-method) do
  that now. Without a key they fail once, with the message.
- `--non-interactive` and `--json` are accepted after every subcommand
  (`mt-eval setup --non-interactive --lang sme`). `setup` with no install
  flag and no terminal shows the status and installs nothing.
- Install hints say `python3 -m pip install …` (`uv pip install …` in a
  uv-made venv with no pip), because a bare `pip` may not be on PATH.
- `contest qualify` shows one gating number, the qualifier score, and,
  labelled "for orientation, not what gates", the card composite once. The
  summary line that repeated the score and said "what publish records" is
  gone: qualify publishes nothing.
- `mt-eval corpora --with-fst`: only corpora whose target has a pinned FST,
  each with whether that FST is installed here.
- `mt-eval compare --significance` marks a run whose scores carry a score
  caveat with ⚠ (its column and every "Better" naming it), and prints the
  caveat text under the tables.

### Fixed — COMET installs and runs

A fresh `pip install mt-eval-harness[comet]` could not import COMET on any
Python, and COMET could not score on an Apple Silicon Mac. All three causes were
measured on 2026-09-28 against unbabel-comet 2.2.7, the latest release:

- It pins torchmetrics < 0.11, which imports `pkg_resources`, and setuptools
  >= 81 dropped that module. The `comet` extra now pins `setuptools<81`.
- It imports `functools._HashedSeq`, which Python 3.14 removed. The extra
  installs nothing on 3.14, and `mt-eval setup` says why and points to a 3.12
  or 3.13 environment.
- Its `predict()` passes a fork multiprocessing context with zero workers
  whenever Apple's MPS backend exists, which torch refuses. The harness now
  passes one worker on MPS machines.
- `install_comet()` checks that COMET actually imports in a fresh interpreter;
  a clean pip exit is no longer taken as success.

Verified with the real Unbabel/wmt22-comet-da model on Python 3.12. An empty
hypothesis is scored (0.72, against 0.97 and 0.98 for exact translations; a
known COMET weakness worth showing beside a copy-the-source floor), scores
stay aligned, and 200 AmericasNLP Quechua dev segments score 0.651 with the
low-resource warning.

### Removed — `--champollion-config` and `--prompt champollion`

They rebuilt the CLI's system prompt in Python and called the result
"production-identical". The copy had drifted from the CLI: it asked the model
to "keep the keys… return ONLY valid JSON" and then sent plain text, and its
register, quoting and source-language lines differed from the CLI's. No test
compared the two, so the lane did not measure what the CLI ships. Both are now
refused by `RunConfig.validate()` with the reason, and the old flag still
parses so an old command line gets that message rather than "unrecognized
arguments". `load_champollion_config`, `build_champollion_system_prompt`,
`ChampollionRunConfig` and `ChampollionPromptProvider` stay importable for one
minor release and raise `RetiredLaneError` naming the replacements: the
method-plugin lane (`--method`), and `mt-eval export-config` for carrying a
result back into a CLI project.

### Removed — the compliance-plugin auto-load and `--champollion-cards-dir`

Analysis used to add `DoublePassCompliancePlugin` when the target's language
card had a `rules` field. The atlas cutover dropped `rules` from every card
(`shared/card-field-disposition.json`: DROP), and no language card `extends` the
`genera/` parent files that still carry it, so the load could not fire on any
of the 17,360 cards. It read cards through a private reader
(`load_language_card`, `deep_merge_cards`, `_find_cards_dir` in
`champollion_config.py`) that parsed every card file on each call; all three
are gone, and card lookups go through `mt_eval_harness.language_cards`.
`--champollion-cards-dir` only fed that load, so it is refused by
`RunConfig.validate()` like the retired lane (it still parses, hidden); set
`MT_EVAL_CARDS_DIR` to point the harness at another cards directory. The
plugin itself is unchanged and still runs when passed in `metric_plugins`.
Nothing else constructs it, and a card without `rules` leaves its quote and
casing terms at a constant 1.0, so the metric registry and the scoring spec now
list `compliance_index` and `repair_effectiveness` as planned, not implemented.

### Added — contests

- Any metric the registry marks rankable is a contest's `primary_metric`
  (chrF++, plain chrF, BLEU, spBLEU, TER, COMET, exact match, the composite).
  Aliases are exact: `chrf` is plain chrF, never chrF++. Migration 076.
- Frozen computation promises: `metric_signature`, `harness_version` and
  `declared_power` (test size + minimum detectable effect, `power.py`). A
  card scored another way is excluded from the ranking with both values named.
- Sealed contests get paired significance from the node:
  `mt-eval node verdicts` runs the contest's paired test over every pair of
  entries on the sealed references and exports signed verdicts only;
  `contest rank|close --node-verdicts --verify-key` verifies and binds them.
  Paired AR / bootstrap now sum sacreBLEU sufficient statistics: identical
  results, 1,000 segments x 1,000 trials in 0.7 s instead of 317 s.
- An entry the node ran and FAILED is listed as `failed`, not "in flight"
  forever, so it no longer blocks `contest close`. A 075 `completed` request
  is listed as such.
- Signed score manifest v2: `harnessVersion`, `engineVersions`,
  `metricSignatures`, and `indexEntrySha256`, the sha256 of the method's
  public index record (`method_index.py`), which drops the contest binding and
  the developer email.
- **New contests hide results until close by default**
  (`--results-visibility hidden_until_close` on `contest create`, `prepare`
  and `register`). Under `immediate` an entrant could read a sealed-set score
  mid-contest and tune against it. Pass `--results-visibility immediate` for a
  live board. A contest that recorded no value is still read as `immediate`:
  it promised no withholding, and nothing re-reads it as having done so.

## 2026-09-07 — a contest is sovereign hosting (part of 0.2.0)

### Fixed — flags meant different things on different Pythons

`allow_abbrev=False` on the main `mt-eval` parser. argparse resolved every
`--token` against the main parser's ~60 global options before dispatching to a
subcommand, so a subcommand flag that was merely a PREFIX of a global one died
as "ambiguous option" on Python 3.12 — the version Ubuntu 24.04 and Debian
ship, and the sovereign node's own OS — while working on a newer interpreter.
`mt-eval list datasets --source`, `mt-eval corpora --source/--target`,
`mt-eval contest rank --metric` and `mt-eval node ceremony init --m` were all
broken that way. Abbreviation still works inside a subcommand.

### Changed — a method with no trainable parameters declares 0

`constraints.parameterCount` accepts an integer `>= 0`; `0` means "none", a
missing count still blocks, and Lane A still refuses a declared `0` because a
weights submission has parameters by construction. Rule-based entries no
longer have to claim `1` to pass the door.

### Removed — the live Supabase smoke

`arena/scripts/live_smoke.py` and `arena/tests/test_live_smoke.py` (founder
call, 2026-09-07). Its write phase had been pending against the live project
and its contest leg was already retired under R2.

### Changed — BREAKING: what a contest entry IS (founder ruling R2, 2026-09-06)

A **contest** now means sovereign hosting, and nothing else. An entry is a
MODEL (`mt-eval contest submit-model`) or a METHOD
(`mt-eval contest submit-method`) handed to the organizer's own air-gapped
node, which executes it against a sealed set on its own machine and publishes
the score it measured itself. Admission is the public qualifier: the entrant
self-scores the released dev set with `mt-eval contest qualify`, and the node
RE-EXECUTES that claim on its own copy before any custodian is asked to
approve anything.

The **open leaderboard** is unchanged and is a different object: the public
board of self-reported cards, indexed by valid corpus × pair direction
(`mt-eval publish`). It is not a contest and carries no prize.

**Retired and DELETED, not deprecated:**

- `mt-eval contest submit` — linking a self-reported run card as an entry.
- `mt-eval contest submit-hypotheses` — uploading translations of a
  source-public blind set. The blind split survives only as an optional
  organizer diagnostic (`contest prepare --blind-size`, default 0), and the
  `contest_intake` lifecycle now only drains rows already in flight, saying so.
- "T1 standing" (holding a published hypotheses-lane record) as the gate on
  the method lanes — replaced by the qualifier receipt plus the node's own
  re-execution of it (`sandbox_runner.verify_qualifier_by_execution`).

### Added — `rehearse.sh close`, and the rehearsal run end to end

- `arena/deploy/sovereign-node/rehearse.sh` gains a **`close`** stage: rank a
  contest while it is open (nothing ranked, results withheld, pseudonyms, the
  holdout section present and empty, the declared prize term printed), refuse
  `rank --reveal-identities` to a non-owner, `contest close` (publishes the
  withheld main **and** holdout results, reveals identities, freezes the
  ranking), refuse a second close, rank again, `contest export`, and
  `shared-task report` — or a printed reason for skipping it. `report` now
  writes `report.json` beside `report.md` with a PASS/FAIL/SKIPPED row per
  step and exits non-zero if anything failed.

### Fixed — found by running the sovereign rehearsal on real guests

Each of these passed the whole unit suite; each lives in the seam between the
code and the machine.

- `mt-eval node ceremony init` gains `--quorum` / `--shares`. `--m` and `--n`
  survive as aliases but are rejected as **ambiguous abbreviations on
  Python ≤ 3.12** — which is what Ubuntu 24.04, the sovereign node's own OS,
  ships — because argparse resolves them against the main parser's
  `--model`/`--max-tokens`/`--name`/`--no-cache` before dispatching to the
  subcommand.
- `mt-eval contest submit-method` gains `--ram-gb`, `--disk-gb`,
  `--max-runtime-minutes`, `--gpu` and `--gpu-memory-gb`. Every bundle used to
  declare 8 GB of RAM with no way to say otherwise, so a node with a smaller
  `sandbox.max_ram_gb` refused honest entries for a number nobody chose.
  Defaults are the historical values.
- The offline threshold ledger's `grant_used` now carries the same
  content-free detail the connected lane records: **which splits the one grant
  covered** (`sets`, `test_suites`). Contract D1's "one ceremony, one grant,
  both splits" had no evidence on the air-gapped chain.
- An air-gapped node can now ENFORCE the prize-terms acceptance:
  `contests[<id>].prize_terms_sha256` in `node.json` (64-hex, shape-checked at
  startup) is compared against the bundle's `acceptedPrizeTermsSha256` at
  import and again at run time. Without it the check could only ever WARN,
  because `contests.metadata` is unreachable across the gap.
- A relay exports only requests bound to the air-gapped node it relays for.
  A node that both executes its own contests and relays used to put every
  authorized request on the medium, including ones the air-gapped machine
  would refuse by fingerprint.
- Teardown actually tears down. `wipe_tree` and `wipe_scratch_file` overwrote
  before unlinking, and container-written files are owned by root — so the
  zeros pass failed EACCES and the unlink never ran, leaving the whole run
  scratch (where the sealed corpus is decrypted) on disk. They now fall back
  to unlink and SAY the overwrite was skipped; a directory that will not go is
  reported instead of swallowed; and `run_imported` wipes the scratch root.
- The holdout's deferred-result key is `~holdout`, not `#holdout`: the key
  travels as a PostgREST filter value and `#` opens a URL fragment, so every
  read keyed on it addressed the MAIN result and the holdout could never be
  relayed. `sovereign_service.service_request` now percent-encodes the three
  characters that TRUNCATE a URL client-side (`#`, `?`, space).

### Fixed — Lane B could not write its own output

- `--cap-drop ALL` removes `CAP_DAC_OVERRIDE`, so container root could only
  write where the host directory's mode allowed. On any node whose scratch
  tree carried the ordinary 0755 of a normal user account, EVERY Lane B run
  died at `cannot create /output/translations.txt: Permission denied` — an
  isolation flag defeating the one write the execution contract requires, and
  invisible on a node that happens to run as root. The per-run `/output`
  directory is now created world-writable
  (`sandbox_runner.make_output_mount`); nothing else about the sandbox
  changes. Found by `arena/scripts/contest_beta.py` on the Lima organizer
  guest, 2026-09-07.
- `method_bundle.resolve_secret_set` excluded the contest's own `corpus_id`
  when looking for the set to run against — correct before R2, when a contest
  named its BLIND split; wrong after it, when the contest names the SECRET
  set. Every `submit-method` / `submit-model` against a post-R2 contest was
  refused with "is not an active sealed set paired with this contest's
  qualifier". The contest's own set now wins (a declared holdout shares the
  same qualifier, so "the other one" was never a safe answer).

### Added — the competition half, and the prize term

- Verbs: `contest qualify`, `contest validate`, `contest open-intake`,
  `contest close-intake`, `contest rank`, `contest close`, `contest export`,
  `contest select-for-human-eval`, `shared-task report`,
  `node stage-request`, `node run-method` (Lane A + Lane B dispatch).
- **The prize term is one choice of three** (founder ruling R1-trinary,
  2026-09-07: "'pass to holders' / 'retain IP' / 'release open'").
  `--prize-disposition {pass_to_holders,retain_ip,release_open}` and
  `--prize-terms <json-file>` on `contest create` / `prepare` / `register`
  declare `metadata.prize_terms.disposition`; `retention`, `rights`,
  `host_use` and `release` are DERIVED from it, and `rights` / `host_use` are
  refused as explicit keys in both Python and migration 074's guard. Two
  options offer one narrowing each — `--prize-retention` (retain_ip) and
  `--prize-release-timing` / `--prize-release-license` (release_open) — plus
  `--prize-terms-url` on any of the three. The term is printed in plain
  language with its `terms_sha256` before the write, entrants accept that hash
  with `--accept-terms`, and the node refuses a bundle that accepted anything
  else. **A contest with no declared term has no prize** — the default. Prize
  terms on a non-sealed contest are refused (R1: prizes exist only on
  sovereign contests).
  The interim named presets `open` / `audit` / `community` / `strict` and
  `--prize-preset` (2026-09-07, same day) are RETIRED: `from_preset()` raises
  and names the disposition, and a `preset` key inside `prize_terms` is
  refused by the parser and by 074's guard.
- Publication promises on all three creating doors: `--results-visibility
  {immediate,hidden_until_close}` and `--anonymize-until-close`.
- `arena/scripts/contest_beta.py` rewritten as the local-stack end-to-end
  proof of the whole R2 shape, including the refusals; `--target prod` and
  `--target dev` refuse with the reason.


### Fixed
- `mt-eval list datasets` labelled every public corpus "(blank) = private"
  (it read `local_path`/`url`, which no registry entry sets), dumped 5,600
  unpaged lines and broke alignment on ids longer than 25 chars. It is now
  paged (`--limit`, `--all`), filterable (`--source`, `--target`,
  `--family`, `--include-quarantined`, `--json`) and derives an honest
  availability column (`fetch` / `gated` / `local ✓✗` / `Q` / `nobuild`).
- `mt-eval corpora` for a pair whose entries are all quarantined (eng→crk)
  reported "none found"; it now says "none runnable", names each hidden
  entry with its quarantine reason, and JSON carries `hidden_quarantined`.
- `build_registry.py --diff` was a text `difflib` over ~200k lines (20+
  minutes of CPU, no output); now a per-id structural diff.
- NC detection in the registry builder, the queue generator and the prod
  dataset sync share `license_use.is_non_commercial` (no bare substring).
- Offline node bundle: install name `mt-eval-harness[node]` (was the dead
  `mt-eval[node]`); `constraints-node.txt` carries cp311 + cp312 hashes;
  `export-scores` signs in Python (no Node.js on the node); `sandbox.cpus`
  above the host count is refused by name instead of a daemon error.

### Added
- `--primary-metric` on `create`/`prepare`/`register`; `contest_rank.py`
  is the ranking SSOT (verified-only by default, significance-aware tie
  groups with a labelled evidence ladder). Migrations 072 (lifecycle guard)
  and 074 (entries, phases, deferred results, promises) — dev/local only.
- `mt-eval node stage-request` — stage a method bundle as an authorized
  exchange request with no database (rehearsal / DB-less deployments).
- `arena/deploy/sovereign-node/` (Lima deploy kit + `rehearse.sh`),
  `arena/scripts/sovereign_rehearsal.py`, `arena/examples/lane-b-toy-method/`,
  `arena/scripts/live_smoke.py` (live Supabase smoke over the anon key).
- Migration 073 (draft, not applied): covering index so `queue_pairs()`
  stops timing out for anonymous callers at 211k queue rows; revokes
  PUBLIC EXECUTE on `queue_top`/`queue_pairs`.

## [0.1.1] — 2026-08-29 — terminology release

### Changed
- All references to the First Nations Information Governance Centre's
  registered data-sovereignty trademark removed from documentation, help
  strings, and package metadata — the mark belongs to the FNIGC and is not
  this project's to invoke. The
  posture is now described as "sovereignty-aspirant": aligned with Indigenous
  data-sovereignty principles (community ownership and control of language
  data), with no claim of certification under any community's framework.
- The former sovereignty-frameworks registry value renamed to
  `community-ownership-control` (dataset registries and the registry-build
  gate updated together).

No functional changes to evaluation, scoring, licensing, or transmission
policy.

## [0.1.0] — 2026-06-16 — first public release

The inaugural public release of the harness (PyPI dist `mt-eval`, `pip install mt-eval-harness`).
Public versioning **starts here at 0.1.0**. The harness was matured through an
internal `3.x` series before this point; those entries are retained below under
*Pre-public internal history* for the record — nothing is scrubbed, the public
release sequence simply begins now. The feature set shipping in 0.1.0 is the
sum of everything documented in this file.

Highlights landed since the last internal cut:

### Added

- **Multi-provider LLM backend** — New `providers/` package with `LLMProvider` ABC and four implementations: OpenRouter (default), OpenAI, Anthropic, Gemini. Each provider handles message format translation, API key loading, pricing, and retry logic internally. Strategies are completely provider-agnostic. CLI flag: `--provider {openrouter,openai,anthropic,gemini}`.
- **Provider in config hash** — `RunConfig.config_hash()` now includes the provider, ensuring cache correctness when switching between OpenRouter and direct providers for the same model.
- **45 provider tests** — Registry, ABC compliance, message format conversion (OpenAI cache_control flattening, Anthropic system extraction, Gemini role mapping), API key loading, prefix stripping, pricing, and RunConfig integration.

### Changed

- **`publish.py` — generic plugin extraction** — Replaced hardcoded `crk_linter`/`crk_semantic` key lookups with flag-based discovery (`is_equivalence_linter`, `semantic_verdict_counts`). LYSS verdict extraction now probes any plugin's metrics dict. Any language with custom linters now gets full leaderboard coverage without code changes.
- **`publish.py` — entry-count enforcement** — `verify_corpus_integrity()` now enforces 95% entry-count coverage against sha-pinned dataset registry entries. Below-threshold runs are rejected with a clear error message.
- **`publish.py` — dynamic api_provider** — `api_provider` field in run cards is now pulled from the run config instead of hardcoded `"openrouter"`.
- **`config_exporter.py` — provider emission** — Export snippets include `provider` when non-default, keeping OpenRouter exports backward-compatible.
- **`runner.py` — provider-based key loading** — Uses `get_provider(config.provider)` for API key loading and pricing instead of direct `api.py` imports.
- **Strategies (single, batch, tool_call)** — Accept optional `provider` kwarg; use `provider.call()` when available, fall back to `call_openrouter()` for backward compatibility.

### Fixed

- **`config_exporter.py`** — `defaultMethod` now mapped from harness `prompt_version` via `_PROMPT_VERSION_TO_METHOD` instead of raw passthrough. Non-portable prompt versions (`custom`, `champollion`) emit a `_method_note` caveat. Validation against `_CLI_METHODS` prevents emitting configs that crash the CLI.

---

## Pre-public internal history

> These `3.x` versions were internal development milestones reached before the
> public `0.1.0` launch. They are kept verbatim as an honest engineering record;
> the public package's version line begins at 0.1.0 above.

## [3.0.0] — 2026-06-12

Stable release. Promotes 3.0.0-rc.1 with the post-rc hardening landed since 2026-06-07:

### Added

- **Fetch-from-source datasets** — EdTeKLA adapter rebuilds NC-licensed eval data byte-identically from the upstream repo at a pinned ref; corpus fetch-on-miss with license prompts and sha256 verification. EdTeKLA-derived data is no longer distributed in the repo.
- **Contribute queue** — `generate_sweep_queue.py` emits a 798-item public run queue with a curl-able static viewer; `run_baseline_sweep.py` gains parallel workers, manifest-based dedup, and a budget guard.
- **12 website locale-pair dev corpora** (Tatoeba, CC-BY-2.0) for the dogfood benchmark loop (`eng-{fra,deu,nld,tgl,spa,cmn,jpn,kor,por,tha,vie,arb}-dev-v1`).
- **Migrations 015–020** — corpus license columns, datasets RLS (held-out hidden), run_cards audit trail, language_experts, insert parity + trust hardening, advisor fixes.
- **Method validity spec** — dependency classes S/O/A1/A2/X across methods/benchmark/prize docs; dependency manifest in the method.json schema.
- **Coached-condition labeling** and multi-run parallelism in the harness; auth env overrides; contamination checker with quarantine flow.

### Changed

- `publish.py` hardened: retry/backoff, row validation, license passthrough, dataset metadata upsert, legacy dataset-id resolver, env-overridable Supabase target; idempotent `publish_all_reports.py` (staging-guarded).
- Test suite grown 534 → 592.

## [3.0.0-rc.1] — 2026-06-07

### Added

- **COMET bootstrap confidence intervals** — CIs for COMET scores are now computed using cached per-entry scores. This avoids running neural inference 1,000× per bootstrap iteration by caching the initial per-entry COMET scores and bootstrapping from those cached values. Implementation: `_comet_from_cached_scores()` in `confidence.py`.
- **AfriCOMET auto-selection** — For 35 African languages (yor, hau, ibo, amh, swa, kin, lug, wol, etc.), the harness automatically selects `masakhane/africomet-mtl` instead of the default `Unbabel/wmt22-comet-da`. This provides better correlation with human quality judgments for African language pairs. Implementation: `resolve_comet_model()` and `COMET_MODEL_REGISTRY` in `metrics_comet.py`.
- **Per-difficulty-tier CIs** — Bootstrap confidence intervals are now computed per difficulty tier (Tier 1–5), stored as `confidence_intervals_by_tier` in the report JSON. Implementation: `compute_per_tier_cis()` in `confidence.py`.
- **Difficulty tier display** — Console summary now includes a per-tier breakdown table showing Count, Exact Match %, chrF++, BLEU, and chrF++ CI per difficulty level, with human-readable labels (Easy → Expert).
- **COMET column in compare** — `compare.py` now includes COMET scores in the side-by-side comparison table. Column only appears when at least one report has COMET data.
- **`--comet-model` CLI override** — Explicit COMET model selection via config dict, overriding auto-selection.
- **`resolve_comet_model()` public API** — Exported from package. Priority: CLI override → language registry → default model.
- **`COMET_MODEL_REGISTRY` public API** — Extensible dict mapping language codes to COMET model names.
- **`mt-eval setup` wizard** — Interactive command that installs optional dependencies (COMET, FST) with explanations. Users never need to know pip commands. Also provides contextual install prompts during eval runs when an optional metric is missing. Flags: `--all`, `--comet`, `--fst`, `--status`.
- **Canonical MethodConfig schema** — All config surfaces (method.json, run cards, export-config, leaderboard publish/install) now use the same 8-field canonical shape: `model`, `temperature`, `batchSize`, `register`, `coachingFile`, `coachingPrompt`, `promptContext`, `qualityTier`. All fields are always present; unused values are `null`.
- **`mt-eval export-config`** — New command that generates a `champollion.config.json` snippet from a TestReport, bridging harness evaluation results back to production config.
- **`ChampollionRunConfig`** — Renamed from `ChampollionPromptConfig` (back-compat alias kept). Now includes all 8 canonical MethodConfig fields (Python snake_case): `model`, `temperature`, `batch_size`, `register`, `coaching_file`, `coaching_prompt`, `prompt_context`, `quality_tier`.
- **Shared model aliases** — Both Python harness and JS CLI now load model aliases from `shared/model-aliases.json`. Default model changed from `gemini-3.1-pro` to `gemini-pro` (alias).
- **Full `--champollion-config` import** — The `--champollion-config` flag now imports model, temperature, batchSize, and coaching data from the production config (not just register/prompt). Explicit CLI flags override imported values.
- **Coaching prompt parity** — `build_champollion_system_prompt()` now includes a coaching guidance block between register and rules, byte-identical to the JS `buildSystemMessage()` in `cli/lib/methods/llm.js`.
- **Run card `method_config` block** — `publish.py` now writes the full canonical MethodConfig to each published run card, enabling zero-reconstruction leaderboard install.

### Changed

- `compute_comet()` now accepts optional `model_name` parameter for explicit model selection.
- `tester.py` COMET section now resolves model via `resolve_comet_model()` before scoring.
- `tester.py` COMET missing-dep message replaced with interactive install prompt — users can install COMET right from the eval flow, no pip commands needed.
- `__init__.py` exports `resolve_comet_model` and `COMET_MODEL_REGISTRY`.

## [3.0.0-rc.0] — 2026-06-05

### Added

- Multi-model parallel runs via comma-separated `-m` flag.
- Four corpus formats: JSON, JSONL, TSV, parallel text.
- Champollion config interop (`--champollion-config`).
- Plugin architecture: MetricPlugin, PromptProvider, ToolProvider, PostTranslationHook.
- Bootstrap 95% confidence intervals for chrF++, exact_match_rate, composite.
- Paired bootstrap significance testing.
- HTML dashboard generator.
- Run comparison with regression/improvement tracking.
- Plugin export for champollion method deployment.
- COMET neural metric (optional, `pip install mt-eval-harness[comet]`).
- FST acceptance metric (optional, `pip install mt-eval-harness[fst]`).
- Leaderboard publish with OAuth PKCE authentication.
