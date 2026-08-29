# nmt-forge — NMT model-training suite: design spec

**Status:** **partially stale — 2026-07-12 snapshot, corrected 2026-08-01.**
Founder-reviewed 2026-07-12 (name approved, public docs approved, crk pack
relocated out — see §10).

> **Read this before treating any section as the spec.** The body of this
> document describes forge as of 2026-07-12. On 2026-08-01 it was checked
> against the code and four shipped subsystems were found described nowhere in
> it: `guards/battery_lint.py`, `advisor.py`, `monitor.py` and
> `training/evaluate.py` — zero mentions each. They are now written up in
> **§4b**, from the source rather than from a secondary description, along
> with four config-level gates §6 omits (`validator`/`validity_floor`,
> `check_time_budget`, curriculum continuity, `_check_keys`).
>
> **§4b is the only part of this file verified against the code on
> 2026-08-01.** Everything else remains a 2026-07-12 snapshot and may have
> drifted the same way. `forge/docs/FAILURE_TAXONOMY.md` (2026-07-14) is
> closer to current for the guard behaviours. Check before quoting any section
> as authority, and before promoting any of it to the public site.
>
> Three statements here were outright false and are corrected inline rather
> than silently swapped: F3 visibility (§10), the Wolvengrey "permission
> pending" line (§7), and the CLAUDE.md follow-on note (§12). Note that
> **`forge/` is already public**, so those were published errors, not internal
> ones. Full account: `docs/FORGE_SPEC_RECONCILIATION_2026-08-01.md`.

**Name:** `nmt-forge` (dir `forge/`, import root `nmt_forge`) — ✅ founder-approved (F1)
**Requirements document:** the 11-entry mistake ledger in
`champollion-crk-translate/docs/DEVELOPMENT_REPORT_2026-07-12.md`. Every design
decision below traces to a ledger entry or a founder directive.

---

## 0. Mission

Make it **structurally hard** to commit the training/eval errors catalogued in
the crk-translate mistake ledger. Not linting, not warnings: the suite's normal
paths make the error impossible (you cannot emit an unverified target; you
cannot select a checkpoint on a test set), and where a user goes around the
normal path, gates **refuse with an actionable message** that names the fix.

The suite is a **separate package from the eval harness**. The harness
(`arena/mt_eval_harness`) stays evaluation-only and is consumed as a dependency
for **all** scoring — forge implements **zero metrics** (ledger mistake 10).

> Deviation from the ledger, recorded: ledger plan §4 proposed
> `nmt-guardrails` with "home: the arena harness". The founder's task
> instruction supersedes this — separate top-level package, harness stays
> evaluation-only. Rationale it preserves: the guards still ship with
> Champollion's public tooling; the harness keeps a single responsibility.

### What forge is NOT
- Not an evaluator: no metric implementations, ever (harness does scoring).
- Not a corpus host: no corpus content tracked in git, no fetching of
  restricted sources; manifests are content-free (hashes + counts, no text).
- Not a card writer: language cards are read-only discovery input.
- Not a leaderboard: run results stay in run manifests / the Arena lane.

---

## 1. The mistake ledger → mechanism map

| # | Ledger mistake | forge mechanism | Refusal point |
|---|---|---|---|
| 1 | Target leakage via shared targets across split ("Feed him"/"Feed her" → `asam`) | **split-guard**: union-find groups over canonical SOURCE and TARGET keys; whole groups land on one side; zero-overlap verification after carve | `SplitLeakageError` at build time; `verify_disjoint()` usable standalone on any existing split |
| 2 | Test set drives checkpoint selection | **dev-fence**: trainer refuses to start without a registered `dev` set; dev rows content-checked (canonical keys) against every registered `test`/`sealed` set; the training runner has no code path that scores checkpoints on anything but the fenced dev | `DevFenceError` before training starts |
| 3 | No valid baseline (champion selected via #2, trained on rows overlapping test) | **run manifests + eval-ledger + preregister**: every run records config hash, data shas, split manifest, seed; comparisons render only against preregistered predictions; contaminated provenance is visible, not silent | `PreregistrationMissing` — comparison tables refuse to render |
| 4 | `ý`/`y` mismatch silently deleted 1,375 verbs | **canonical boundary + funnel-audit**: pack canonicalizer applied at every adapter boundary by construction; funnel decomposes dictionary→emitted yield and its `canon_recoverable()` detector counts items that would pass if canonicalized — nonzero raises | `FunnelRegression` with per-stage drop table |
| 5 | Four spelling systems trained at once; model mixes them | **convention-lint**: `assert_single_convention()` on training targets (canonicalize ONCE at build); `mixed_convention_rate()` as a standing output metric | `ConventionError` listing offending rows + the canonicalize-at-build fix |
| 6 | 1M pairs in ~23 shapes (no imperatives, wh-questions, possession, inverse) | **coverage-map**: packs ship a grammar checklist (each item cited); templates declare which phenomena they exercise; report shows zero-coverage items and kind-distribution stats | `CoverageError` when a `required` checklist item has zero pairs |
| 7 | Two template kinds = 54% of corpus | **sample-strata**: per-kind capped reservoir (default cap 15%) is the default synthetic sampler in the mix builder | mix refuses an uncapped synthetic lane above the cap unless explicitly overridden in config |
| 8 | Numbers with no error bars | **ci-scoring**: bootstrap CIs by default via the harness (`mt_eval_harness.confidence`); forge report objects cannot render a score without its CI | report API takes CIs as required fields; small-n warning inherited from harness (`MIN_RELIABLE_ENTRIES=30`) |
| 9 | Adaptive use of eval data invisible | **eval-ledger**: append-only, hash-chained log of every read of a registered eval file (purpose-tagged, config-bound); `sealed` sets are one-shot — a second scoring spend is refused (loud override exists and is itself ledgered) | automatic — reads go through the registry; `SealedSetSpent` on respend |
| 10 | Bespoke evaluator re-implementing scoring | forge **delegates all metric math** to the harness: `confidence.bootstrap_ci`, `compute_all_cis`, `significance.paired_approximate_randomization`, `tester.analyze_run_log` | there is nothing to refuse — the capability is absent by design |
| 11 | Decode cap sat near max reference length | **generation-headroom check**: refuse decoding when `max_new_tokens < headroom × max_ref_tokens` (backend tokenizer when available; whitespace×subword-factor proxy otherwise, loudly labeled a proxy) | `GenerationHeadroomError` with the measured numbers |

Two further ledger items are absorbed as defaults rather than guards:
tagged synthetic data + gold upweighting with documented exposure math (§6),
and "test set is REAL DATA ONLY" — forge's synthesis engine stamps provenance
on every synthetic row, and the registry refuses to register a file as
`test`/`sealed` if any row carries synthetic provenance (founder ruling
2026-07-12: we do not test on synthetic data).

---

## 2. Package identity (⚑ founder decisions F1–F3)

| | default | alternatives |
|---|---|---|
| **F1 Name** | dir `forge/`, distribution `nmt-forge`, import `nmt_forge`, CLI `nmt-forge` | `champollion-forge` (PyPI namespace coherence with `champollion-lyss`) |
| **F2 License** | `AGPL-3.0` — same as the harness. forge import-links `mt_eval_harness` (AGPL w/ §7 plugin exception), so AGPL is the coherent choice; forge is never bundled into the proprietary CLI (separate runtime, separate language) | permissive license + subprocess-only harness use (worse integration; rejected by default) |
| **F3 Visibility** | **DECIDED — public.** `forge/` ships in the public squash (86 files, AGPL-3.0-or-later), approved by the founder 2026-07-20 and enforced at `scripts/champollion_sync_gate.sh:325`; `forge` is in `PUBLIC_ROOTS` (the repo's sovereignty usage-check gate script, line 53). Contains no corpus content and passes the quarantine gate. *This row read "monorepo-only until founder decides" until 2026-08-01 — twelve days after it was decided.* | keep private |

- Python `>=3.11` (matches harness). Build: setuptools, flat package layout
  (matches `arena/`). Tests: flat `forge/tests/`, pytest, `tmp_path` fixtures.
- Dependency: `mt-eval>=0.1.0` (PyPI dist; the import stays `mt_eval_harness`). In monorepo dev the harness is not
  pip-installed — `forge/tests/conftest.py` (and `nmt_forge._harness`) fall
  back to inserting `../arena` on `sys.path`. Known packaging gotcha inherited
  from the harness (TA-01): its wheel may ship without registry data — forge's
  scoring path (`confidence`/`significance`/`tester`) **never loads the
  registry**, so the bug cannot bite scoring; dataset-id resolution (§6
  `do_not_train` check) degrades gracefully when the registry is absent.
- forge itself ships **no data files** in the wheel (nothing to forget).

---

## 3. Architecture: the workspace spine

Nearly every guard needs the same fact: *which files are eval sets*. That fact
lives in one place and every guard consults it.

```
Workspace (a directory, e.g. <project>/.forge/)
├── eval-registry.json      # name → {path, sha256, role: dev|test|sealed, created, key_params}
├── ledger.jsonl            # append-only, hash-chained event log
├── preregistrations/*.json # predictions-before-results
└── runs/<run-id>/          # manifests only (config hash, data shas, reports)
```

- **EvalRegistry** (`nmt_forge.registry`): register a file with a role.
  Registration computes and pins `sha256`; every later access re-hashes and
  refuses on mismatch (silent eval-set drift becomes a hard error).
  Registering a file as `test`/`sealed` refuses rows with synthetic
  provenance. All access goes through `registry.open_eval(name, purpose=...)`,
  which writes a ledger event.
- **Ledger** (`nmt_forge.ledger`): append-only JSONL; each entry carries
  `prev` = hash of the previous entry (tamper-evident chain). Events:
  `register`, `read` (purpose-tagged: `score`, `dev-selection`, `audit`,
  `inspect`), `prereg`, `score`, `sealed-spend`, `override`. `nmt-forge ledger
  show <set>` summarizes how "spent" a set is.
- **Canonical keys** (`nmt_forge.canonical`): one function,
  `canonical_key(text, canonicalizer=None)` = optional pack canonicalizer →
  NFC → casefold → strip punctuation → collapse whitespace. Used by
  split-guard, leak-audit, dev-fence. Aggressive on purpose: over-grouping can
  never cause leakage, under-grouping can. Matches the harness's
  `corpora_builder.contamination.normalize_text` family; the pack canonicalizer
  slot is where orthography normalization (e.g. crk `ý→y`, macron→circumflex)
  composes in — the ledger-#4 fix applied at every boundary.
- **Content-free artifacts**: registry, manifests, and audit reports contain
  hashes, counts, indices, parameters — never sentence text (matching the
  harness contamination checker's discipline). A `--show-text` flag exists for
  local debugging only.

Guards are usable three ways: as a library, via the `nmt-forge` CLI, and
implicitly inside the training runner (which is where "defaults" live).

---

## 4. Guardrails (slice 1) — specs

All errors subclass `GuardrailViolation(ForgeError)` and carry three fields
rendered in every message: **what** happened, **why it matters** (one line),
**fix** (the exact command/API call). Example:

```
SplitLeakageError: 17 test rows share a canonical target or source with train.
  why: the model has literally seen these test answers; scores on this split
       measure memory, not translation (measured on crk: 83 vs 44 chrF++).
  fix: rebuild the split with nmt_forge.guards.split_guard.group_split(...),
       which allocates whole share-groups to one side. Do not filter rows
       post-hoc — regroup and re-carve.
```

### 4.1 split-guard (`guards/split_guard.py`) — ledger #1
- `group_split(pairs, *, test_size, dev_size=0, seed, source_field="source",
  target_field="target", canonicalizer=None) -> GroupSplit(train, dev, test,
  manifest)`.
- Union-find: pairs sharing a canonical source key OR canonical target key are
  one group; groups shuffled with `random.Random(seed)`; allocation order
  test → dev → train (test-first keeps the test set stable as sizes change —
  proven pattern from the reference implementation); whole groups only.
- Post-carve verification always runs (`verify_disjoint`): zero shared
  canonical source/target keys between any two sides, else `SplitLeakageError`.
- `verify_disjoint(train=..., evals={...})` is public — auditable on any
  existing split, not just forge-made ones.
- Manifest: sizes, group count, largest group, seed, key params, input sha,
  per-side shas. `registry.register_split(split)` registers dev + test.

### 4.2 dev-fence (`guards/dev_fence.py`) — ledger #2
- `require_dev(workspace, name) -> rows` — the ONLY way the training runner
  accepts a dev set: must be registered `role=dev`, sha must match, read is
  ledgered with purpose `dev-selection`. Missing → `DevFenceError` ("the test
  set must never drive early stopping; carve a dev set with group_split").
- Content check (defense beyond path identity): canonical source+target keys
  of the dev rows must not intersect any registered `test`/`sealed` set. This
  catches the file-copy trick (`cp test.jsonl dev.jsonl`).
- For users wiring their own trainer: `DevFence(workspace).check_rows(rows)`
  runs the same content check; documented HF recipe wraps it before
  `Seq2SeqTrainer(eval_dataset=...)`.

### 4.3 leak-audit (`guards/leak_audit.py`) — ledger #1, #9
- `leak_audit(corpus, workspace_or_sets, *, jaccard=0.6, min_tokens=3,
  canonicalizer=None) -> AuditReport`; `assert_clean(...)` raises
  `LeakageError` on exact hits against `test`/`sealed`.
- Exact lane: canonical-key hits on BOTH sides — source keys and target keys
  (the harness's `corpora_builder.contamination` fingerprints pairs and
  sources; forge adds the **target-side** lane, which is exactly how ledger #1
  leaked, plus the near-dupe screen it lacks).
- Near-dupe lane: token-set Jaccard ≥ 0.6 against eval lines with ≥3 tokens
  (thresholds measured necessary in the crk work — same-domain documents share
  reworded lines). Inverted token index for candidate generation, exact
  Jaccard on candidates.
- Whole-file lane: corpus file sha equal to a registered eval sha → refuse
  outright (training on the test file itself).
- Report is a content-free manifest (counts, row indices, key hashes, params);
  `clean()` mode yields surviving rows and writes the audit manifest next to
  the output. This is the standing screen for BT monolingual text (the
  Okimāsis 489/489 catch) and any harvested corpus.

### 4.4 funnel-audit (`guards/funnel_audit.py`) — ledger #4
- `Funnel(name, stages=[...])`; `funnel.tick(stage)`, `funnel.drop(stage,
  reason)`; report = per-stage counts + drop reasons ranked.
- `funnel.assert_max_drop(from_stage, to_stage, max_fraction)` — refuse
  silent attrition beyond a declared budget.
- `canon_recoverable(dropped_items, accept_fn, canonicalizer)` — the ý-bug
  detector: counts dropped items that `accept_fn` accepts once canonicalized;
  `assert_none_recoverable()` raises `FunnelRegression` ("canonicalize at the
  adapter boundary — see pack.canonicalize").
- The synthesis engine maintains a funnel automatically
  (loaded → canonicalized → parsed → analyzer-known → emitted).

### 4.5 convention-lint (`guards/convention_lint.py`) — ledger #5
- `ConventionSpec(name, chars | pattern)` — packs declare their orthography
  conventions (crk: circumflex vs macron long vowels; `ý` variant).
- `lint(texts, specs) -> ConventionReport` (per-convention counts, mixed rows,
  dominant); `assert_single_convention(texts, specs)` for training targets —
  the "canonicalize ONCE at data-build time" contract; default tolerance 0.
- `mixed_convention_rate(texts, specs)` — the standing output-regression
  metric (a model trained canonically should score ~0).

### 4.6 coverage-map (`guards/coverage_map.py`) — ledger #6
- `ChecklistItem(id, name, citation, required=False)` — packs ship a grammar
  checklist transcribed from published grammars (work-level citations, no
  invented page numbers — the derivation-rules discipline).
- `coverage(kind_counts, kind_phenomena, checklist) -> CoverageReport`:
  per-item pair counts, zero-coverage list, kind-distribution stats (top-kind
  share, count of kinds, Shannon entropy).
- `assert_no_missing_required()` → `CoverageError` naming the absent
  phenomena and the checklist citations ("the FST could generate ALL of these;
  the templates never asked").

### 4.7 sample-strata (`guards/sample_strata.py`) — ledger #7
- `stratified_sample(rows, n, *, cap_fraction=0.15, key="kind", seed)` —
  per-kind capped reservoir with uniform overflow refill (ported from the
  reference trainer). Deterministic under seed. Emits a strata manifest
  (per-kind seen/kept).
- The mix builder uses it by default; an uncapped synthetic lane whose top
  kind exceeds the cap refuses with the measured shares unless the config
  sets `kind_cap: null` explicitly (the override is recorded in the manifest).

### 4.8 ci-scoring (`guards/ci_scoring.py`) — ledger #8, #10
- **Full harness referee parity** (added 2026-07-12, founder ask "why
  wouldn't this use COMET-type neural metrics?"): the **neural lanes** —
  ``comet`` / ``comet-qe`` / ``metricx`` — are first-class metrics on
  score/compare/selection, delegated to
  ``mt_eval_harness.metrics_comet``/``metrics_metricx``. Inference runs
  ONCE per entry set; per-entry scores cache on the entry dicts (the
  harness's own keys) and the bootstrap/AR machinery re-averages cached
  scores (the harness ``confidence.py`` pattern — resampling never re-runs
  a model). Missing extras (``mt-eval[comet]``/``[metricx]``) report an
  install fix in ``ScoreReport.notes`` — never a number — and checkpoint
  SELECTION refuses an unavailable lane rather than silently switching
  metrics. Direction is first-class: MetricX's lower-is-better rides the
  score through rendering (``(lower = better)``), selection (min wins), and
  A/B winner mapping (flipped). ``target_lang`` threads from
  ``config.language`` so the right model resolves and the harness's
  low-resource warning surfaces. Companion pieces: **metric trust** in
  ``cards.discover`` (WMT meta-eval reliability per family, from
  ``shared/catalogue/metric-reliability.json`` — UNMEASURED is an explicit
  answer; the Inuktitut BLEU-r=0.16-vs-COMET-r=0.86 case renders live);
  **harness plugin discovery** as one call
  (``plugins.discover_plugins_for_language`` →
  ``mt_eval_harness.plugin_discovery`` — card evalMetrics + FST validity +
  behavioral linters; config ``selection.auto_plugins``, CLI
  ``--card-plugins``); and **harness-registry datasets as eval sets**
  (``harness_data.register_harness_dataset`` / ``registry add-harness`` —
  materialized fetch-from-source, contamination flags stamped, quarantined
  sets refused, do_not_train preserved by the leak-audit).
- **LYSS lanes** (added 2026-07-12, founder ask): every scoring surface takes
  ``plugins=`` — harness-protocol MetricPlugins (``name`` /
  ``compute(entry)→dict`` / ``aggregate(results)→dict``), i.e. the LYSS
  eval-standard referees (`champollion_lyss.crk.metrics` today, more
  languages later). Mechanics in `nmt_forge/plugins.py` (`PluginLane`):
  every numeric aggregate becomes a CI'd lane named ``<plugin>:<key>``;
  per-entry compute runs ONCE, cached by entry identity, so bootstrap/AR
  resampling re-aggregates cheap counts and never re-runs an FST;
  ``available: false`` survives the bridge (reported, never fabricated);
  checkpoint selection accepts plugin lanes
  (``generation:crk_linter:equivalent_match_rate``) so a model can be
  selected by the language's own referee. Config: ``selection.plugins:
  ["module.path:ClassName"]``; CLI: ``--plugin`` on score/compare.
- Thin bridge; **all math is the harness's**:
  - entries = harness entry dicts (`source/expected/predicted`);
  - point + CI: `mt_eval_harness.confidence.bootstrap_ci` /
    `compute_all_cis` (Efron/Koehn percentile bootstrap, sacrebleu-matched
    defaults n=1000, seed=12345, α=0.05);
  - A/B: `mt_eval_harness.significance.paired_approximate_randomization`
    (the harness default test).
- `score(hyps, refs, sources=None, *, workspace=None, eval_name=None,
  purpose="score") -> ScoreReport` — when `eval_name` names a registered set:
  sha verified, read ledgered, and if `role in {test, sealed}` the
  **preregistration gate** applies (4.10). `ScoreReport` fields make the CI
  mandatory; the formatter has no CI-less rendering path.
- `compare(a, b, ...)` — the comparison-table renderer; refuses without a
  matching preregistration when a registered test set is involved.

### 4.9 eval-ledger (`nmt_forge.ledger`) — ledger #9
- Spine component (§3). Guard-facing surface: `ledger.spend_report(name)` —
  distinct read events, purposes, config hashes; the honest answer to "how
  used-up is this set". `sealed` role: first `score` event marks it spent;
  further scoring raises `SealedSetSpent`; `--override-respend "<reason>"`
  exists, is loud, and writes an `override` event (visible forever).

### 4.10 preregister (`guards/preregister.py`) — ledger #3, #9
- File format (JSON, one per prereg, in `preregistrations/`):

```json
{
  "prereg_version": 1,
  "id": "e15-v5-textbook",
  "created_utc": "2026-07-12T20:14:00Z",
  "author": "founder",
  "eval_set": {"name": "textbook-test-150", "sha256": "…"},
  "config_hash": "…",
  "predictions": [
    {"metric": "chrf++", "subset": "overall",
     "direction": "increase", "margin": 2.0, "baseline": "e15-v4",
     "rationale": "recovered vocabulary should lift lexical overlap"}
  ],
  "consequences": "if flat, distribution reshaping is a dead lever; stop"
}
```

- `nmt-forge prereg new` writes the file + a `prereg` ledger event.
  `prereg check <results>` renders predictions vs results side by side with
  auto-verdicts for structured predictions.
- Enforcement ordering: scoring a registered `test`/`sealed` set requires a
  prereg whose `eval_set.sha256` matches the registry AND whose ledger
  `prereg` event precedes the first `score`-purpose read of that set for this
  config. A set already consulted before predictions were written → refusal
  explains the adaptive-use problem and points at `role=dev` for iteration.

---

## 4b. Shipped after the 2026-07-12 snapshot — reconciled 2026-08-01

These four subsystems exist in `forge/nmt_forge/` and were described nowhere in
this document. Written up here from the **source**, not from a secondary
description, so the spec stops omitting a quarter of what forge does.

### 4b.1 battery-lint (`guards/battery_lint.py`) — the diagnosis layer

Turns a battery table into a diagnosis and a next lever. A novice's agent sees
numbers and CI brackets; this rule engine reads the battery manifest (guard
`ci-scoring/battery`), optionally the coverage-map and run manifests, and emits
**findings**: which registers are weak, the likeliest cause given co-occurring
signals, and the exact lever to pull.

The lever vocabulary — the closed set a recommendation may draw from, taken
from the crk reference work:

| Lever | Means |
|---|---|
| `VOCABULARY` | the model lacks the words — grow dictionary/attestation |
| `STRUCTURE` | the model lacks the sentence shapes — templates/compositor |
| `ORTHOGRAPHY` | convention mixing — canonicalize the training data, not the model |
| `REAL-DATA` | synthetic→real transfer plateau — backtranslation, monolingual, parallel |

**Every rule carries an id, the evidence it fired on, and a cited rationale.**
The module states the reason directly: recommendations are explainable or they
are noise. Surface: `lint_battery()`, `render_diagnosis()`, `Finding`,
`LintConfig`. CLI: `nmt-forge lint`.

### 4b.2 advisor (`advisor.py`) — the stateful next-action driver

`NEXT_STEPS.md` gives an agent the generic recipe. This reads the **actual
workspace** — registry roles, preregistrations, runs, ledger — and answers the
two questions a driving agent needs answered mechanically:

- `nmt-forge status` — where am I? A state table plus **the** next command.
- `nmt-forge preflight <cmd>` — will this command refuse? Every gate, ✓/✗,
  each ✗ with its fix.

Its design rules are load-bearing and worth keeping in the spec: **deterministic**
(same workspace state → same advice, no cleverness); every suggestion is an
exact command string, with `<angle brackets>` only where the value is genuinely
the user's; `--json` for agents, rendered tables for terminals.

Surface: `snapshot()`, `next_action()`, `preflight()`, `render_status()`,
`render_preflight()`, `Advice`, `Gate`.

### 4b.3 monitor (`monitor.py`) — the human's read-only window

A local GUI that opens **for the human** even when an agent is driving forge
entirely through CLI/MCP. Founder-specified 2026-07-14, and deliberately
read-only: training is agent-driven, and a human watching gets the loss curves,
the schedule floor and the event feed — plus exactly **one** control, a loud
two-step "stop training". Anything else, they ask the agent.

Two modes:

- **Live** — `RunMonitor` is created by `nmt-forge run` on non-dummy backends.
  It serves the panel from a background thread, receives loss points via
  `emit()` from a trainer callback, and exposes `stop_requested()` which the
  callback polls; a human stop ends training at the next step boundary and the
  run **aborts loudly** — recorded, nonzero exit. Not a silent stop.
- **Attach** — `nmt-forge monitor <run-dir>` against a running *or finished*
  run. Note the honest limitation in the CLI's own flags: the stop button can
  only actually kill the process when `--pid` is supplied, and the panel is
  only live when `--log` points at the trainer's stdout. Without them it is a
  viewer, not a control.

Gated by `monitor_enabled()`.

### 4b.4 evaluate (`training/evaluate.py`) — closing the loop

Dogfooding e15-v7 surfaced a real seam: `nmt-forge run` stops at train +
checkpoint-selection, but what a novice actually wants is a **scored, diagnosed
battery** — which previously needed a hand-symlinked checkpoint and a hand-run
decoder. That manual handoff is exactly where a weak agent gets lost.

`nmt-forge evaluate <run-manifest> --config <config>` performs the handoff:
read the run manifest for the SELECTED checkpoint and backend; load the
registered battery's **source** texts (inputs, not answers — so no ledger spend
and no preregistration gate at this step); decode with the run's backend
through the same pluggable protocol training uses; then score.

### 4b.5 Config-level gates not described in §6

Present in `training/config.py`, absent from the training-loop section:

| Key / call | Where |
|---|---|
| `validator`, `validity_floor` (default `0.98`) — target-validity gate | `training/config.py:28,76-77` |
| `check_time_budget` — wall-clock gate | `training/schedule.py:230` |
| curriculum-continuity factor | `training/schedule.py` |
| `_check_keys` — unknown-key refusal | `training/config.py:36` |

---

## 5. Synthesis framework (slice 2)

### 5.1 Language-pack plugin interface (`synthesis/packs.py`)

```python
class LanguagePack(Protocol):
    code: str                      # ISO 639-3
    name: str
    version: str
    def analyzer(self) -> Analyzer            # may raise ResourceMissing
    def canonicalize(self, text) -> str       # orthography canon (ledger #4/#5)
    def conventions(self) -> list[ConventionSpec]
    def dictionary(self) -> Iterable[LexEntry]  # adapter; may raise ResourceMissing
    def templates(self) -> list[Template]
    def checklist(self) -> list[ChecklistItem]
    def closed_class(self) -> Mapping[str, str]  # literal → citation
```

- Discovery: built-in packs under `nmt_forge/packs/` + Python entry points
  (`nmt_forge.packs`) for external packs (the harness's manifest-driven plugin
  style, adapted; loud failure on declared-but-unloadable).
- `ResourceMissing` errors carry fetch instructions (where the FST/dictionary
  comes from, its license, and the env var/config key to point at it). Forge
  never fetches restricted resources itself.

### 5.2 Analyzer protocol + round-trip law (`synthesis/analyzer.py`)

```python
class Analyzer(Protocol):
    def analyses(self, surface: str) -> list[str]
    def generate(self, analysis: str) -> str | None
# provided mixin:
def generate_verified(analyzer, analysis) -> str | None
    # generate(); then analysis ∈ analyses(surface), else None — nothing that
    # fails the round trip is ever emitted (the e15 law, verbatim)
```

### 5.3 Templates carry citations, or they don't exist (`synthesis/templates.py`)

```python
@template(kind="imperative", citation="Okimāsis 2018 (Imp paradigms)",
          phenomena=("imperative",), filters=(...,))
def imperative(ctx): ...
```

- The decorator **raises at import time** on an empty/missing citation or
  unknown checklist phenomena. A template kind is the unit of: coverage-map
  accounting, strata capping, and provenance stamping.

### 5.4 Plausibility filters are first-class (`synthesis/filters.py`)
- `Filter(name, rationale, fn)` — named, documented, counted. The three
  proven crk filters ship as generic combinators: `gloss_token_whitelist`
  (place-noun locatives), `head_word_whitelist` (object-verb pairs),
  `gloss_token_overlap` (partner-verb relatedness for multi-clause kinds).
- Engine records per-filter drop counts in the funnel — "anti-gobbledygook"
  is measured, not vibes.

### 5.5 The engine's emit law (`synthesis/engine.py`)
Targets are built from **units**, not raw strings:

```python
Unit(analysis)          # engine generates + round-trip verifies, or the row dies
Lit("namôya")           # must be analyzer-accepted OR in pack.closed_class (cited)
Punct("!")
```

`engine.emit(source, target_units, kind, lemma=None, **meta)` is the only way
a row reaches the output. It:
1. round-trip verifies every `Unit` (ledger's "every generated target must be
   round-trip verified"), rejects rows on failure (funnel-counted);
2. validates every `Lit` against the analyzer or the cited closed-class list;
3. requires `kind` to be a declared template kind (citation guaranteed);
4. applies the template's + pack's filters (drops funnel-counted);
5. stamps provenance: `origin`, `kind`, `lemma`, pack name+version, engine
   config hash, and a provenance string
   (`champollion-derived [<analyzer> × <dictionary>; local training only]` —
   the derived-provenance rule from CLAUDE.md);
6. canonicalizes via the pack (targets canonical ONCE, at build);
7. updates the funnel + kind counts; stats manifest written beside the corpus.

Determinism: `stable_hash()` (crc32) utilities provided and used everywhere —
builtin `hash()` is per-process salted and produced irreproducible corpora in
the reference implementation; documented prominently.

`emit_verified_text(source, target_text, ...)` exists for the
attested-derivation lane (whole-surface verification: every non-punct token
must be analyzer-accepted or closed-class) — the derived_gen pattern where the
generated surface must reproduce an attested one.

### 5.6 Paradigm probe (`synthesis/probe.py`)
- `probe(analyzer, exemplars, tag_candidates) -> valid_combos` — generate +
  round-trip each candidate tag string against exemplar lemmas; only combos
  the probe proves generatable are ever used. *The FST's tag grammar, not our
  intuition, is the arbiter* (e15 rule, kept verbatim). Probe artifact is
  cached with a manifest (analyzer id, counts, date).

### 5.7 Plains Cree reference pack — RELOCATED (founder ruling 2026-07-12)
forge ships **no language packs**: it is a general-purpose tool, and
language-specific code lives in the language's own home, plugging in via a
``"module:get_pack"`` spec or the ``nmt_forge.packs`` entry-point group. The
Plains Cree pack now lives in **crk-translate** as ``nmt_forge_crk/``
(entry point ``crk``; tests in ``tests/test_nmt_forge_pack.py`` with an
honest module-level skip when nmt-forge isn't on the path). Everything below
describes that pack as built — extracted/generalized from `e15_fst_factory`
+ `crk_translate`:
- **analyzer**: pyhfst over `crk-strict-{analyzer,generator}.hfstol`, located
  via `CRK_FST_DIR` env or config — the GiellaLT/ALTLab FST is AGPL and used
  with ALTLab's permission: **invoked as a separate user-fetched tool, never
  bundled** (mirrors the card's `resources.fsts[].install` metadata and the
  `evalStandard.ipNotice` language).
- **orthography**: `canon_chars` port (NFC, macron→circumflex, `ý→y`,
  whitespace) + `mixed_convention` detector + conventions specs; cites
  Wolvengrey 2001 / LeClaire & Cardinal 1998 as the two long-vowel
  conventions, canonical = circumflex (matches FST + the crk-translate home).
- **templates**: a citation-complete subset proving the interface (~8 kinds):
  tensed indicative, negation (`namôya`), yes/no question (`cî`), imperative
  Imm/Del (Okimāsis 2018), wh-question with ê-conjunct (Wolfart 1973),
  locative adjunct (place-noun filter), possessed object (object-verb
  whitelist), inverse VTA (direction marking — core grammar the old corpus
  missed). The full 977k-pair factory **stays in crk-translate** and migrates
  onto forge as forge stabilizes (⚑ F8).
- **checklist**: ~20 cited items from Wolfart 1973 / Okimāsis 2018 (the
  ledger-#6 inventory: tenses, negation, questions, imperatives, possession,
  inverse, relatives, quotative, locatives, conditionals, narrative
  connectives…).
- **dictionary adapter**: reads the itwêwina harvest (`lemmas.json`) from a
  user-supplied path. Wolvengrey-derived content is **never** bundled,
  fetched, or committed. This is permanent, not provisional: the founder ruled
  on **2026-07-19** that redistribution consent **will not be sought and is
  not needed** — the dictionary is INDEXED as a cited resource, pointer-only.
  (This line previously read "permission pending", which implied a consent
  process that was deliberately closed.) Hard boundary.
- **English rendering**: minimal deterministic renderer (third-singular,
  tense frames) ported from e15 `en_morph` — no spaCy dependency.
- Tests run on a `FakeAnalyzer` + invented lexicon (hermetic); a live-FST
  integration test is skipped unless `CRK_FST_DIR` is set.

---

## 6. Training loop (slice 3) — best practices as defaults

Config: one JSON file, hashed (sha256 of canonicalized JSON) into every
artifact. `nmt-forge run config.json` is the single reproducible command.

```jsonc
{
  "run_name": "e16-demo",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>", "origin": "fst-factory"}],
    "dev": "textbook-dev-42",          // registry name, role=dev — the fence
    "monolingual": []                   // BT inputs
  },
  "mix": {
    "gold_upweight": 20,               // exposure math auto-documented
    "kind_cap": 0.15,                  // sample-strata default
    "synthetic_sample": 600000,
    "seed": 42
  },
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M", "...": "..."},
  "selection": {"metric": "generation:chrf++", "patience": 6},  // or "loss"
  "curriculum": [{"stage": "pretrain", "...": "..."}, {"stage": "finetune-real", "...": "..."}],
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5}
}
```

**schedule-sanity (added 2026-07-12, from a LIVE failure in the first
clean-protocol crk run — cross-session design input):** early stopping is
governed by a DERIVED schedule, never a user-supplied magic number. The
failure: 97.5%-synthetic mix + honest 42-row REAL dev → dev loss bottoms at
step ~8k of 115k (the model is fitting the synthetic mass) and drifts up →
patience-6 killed the run at epoch 0.52; invisible in all prior runs because
their dev was (illegitimately) the test set. Mechanization
(`training/schedule.py`): named REGIMES (`synthetic-heavy` / `balanced`,
default `auto` — detected at ≥50% synthetic rows); in synthetic-heavy the
floor = max(1 full pass over the mix, 30% of planned steps), capped at 60%,
computed per curriculum stage from the mix + model params; the plan records
`dev_informative_early=False` and recommends generation-metric selection;
the HF backend's `FlooredEarlyStopping` (generalized from crk-translate's
interim `--min-steps` fix) suppresses stops below the floor; every
intervention is EXPLAINED in plain language with the dev-loss trajectory
(`explain_stop`), printed and manifested. Config surface: one word —
`"regime": "auto"`. The failure is the suite's worked example (README):
produced BY a clean protocol, which is the selling point.

Defaults that encode the ledger:
- **Tagged synthetic** (Caswell, Kreutzer & Cherry 2019, "Tagged
  Back-Translation", adapted to synthetic-source lanes): every synthetic lane
  carries a source-side tag (`<synth>`, `<bt>`); gold is untagged; inference
  is untagged — gold anchors output style. The mix builder refuses a tag that
  appears verbatim in gold source text (collision).
- **Gold upweighting with documented exposure math**: the manifest records
  unique gold sentences, detected augmentation multiplier (duplicate canonical
  sources), upweight, and **effective exposure per unique sentence** — the
  20×-on-augmented ≈ 54-per-unique trap from the reference is made explicit so
  A/Bs stay fair.
- **Stratified sampling** by template kind (4.7), on by default.
- **Leak-audit before training**: every lane (gold, synthetic, BT mono) is
  audited against ALL registered eval sets; exact hits on `test`/`sealed` are
  fatal. Whole-file sha match is fatal. Additionally, a lane that declares a
  harness dataset id is checked against the harness registry's
  `do_not_train`/`quarantine` flags (all 5,602 registry datasets are
  `do_not_train: true`) — forge refuses to mix a benchmark into training.
- **Dev-fence**: dev comes only from the registry (4.2). Checkpoint selection
  metric options: `loss` (backend eval-loss on dev) or `generation:<metric>`
  — decode dev with each saved checkpoint and score via the harness
  (chrF++ default). The "eval-loss lies" question from the ledger is demoted
  to a measurable choice, not folklore.
- **Curriculum**: ordered stages (synthetic-pretrain → real-finetune), each
  with its own mix; every stage writes its own manifest; later stages
  init from the prior stage's selected checkpoint.
- **Backtranslation lane**: `nmt-forge backtranslate` — mono lines are
  leak-audited first (they may BE eval text — the Okimāsis catch), then
  translated by a reverse model, emitted as `(tagged synthetic source →
  canonicalized real target)` rows with provenance.
- **Reproducibility**: run manifest = config hash, all data file shas, split
  manifest refs, seeds, package versions, git commit (when in a repo),
  backend + base-model ids. Seeds are set explicitly everywhere
  (`random.Random(seed)`; no unseeded randomness in forge code).
- **Generation headroom** (ledger #11): decode refuses when
  `max_new_tokens < headroom_factor × max_ref_tokens` (tokenizer-measured
  when the backend provides one; whitespace×subword-factor proxy otherwise,
  loudly labeled).

Backends: `TrainerBackend` protocol; `DummyBackend` (test double — records
calls, fabricates checkpoints) and `HFSeq2SeqBackend` (optional extra
`nmt-forge[hf]`; wraps `transformers.Seq2SeqTrainer` + LoRA via peft when
configured). Torch is **not** a core dependency; forge's tests are hermetic.

---

## 7. SSOT language cards — audit + integration

Cards (`cli/shared/language-cards/*.json`, 7,927) are used for **metadata +
resource discovery only**, read-only, located via `CHAMPOLLION_CARDS_DIR` or
monorepo walk-up (the harness's `metric_manifest_path` pattern). Cards must
never gain run results (R3/R4 boundary) — forge writes nothing to cards, and
synthesis yields/coverage/acceptance numbers stay in forge manifests.

Audit of what synthesis orchestration needs (verified against `crk.json`,
`fra`, `deu`, `iku`, `nav`, `grn`):

| Need | Verdict | Where |
|---|---|---|
| FST existence + fetch | **PRESENT** | `resources.fsts[]` with `.type="morphological-analyzer"`, `.install{repo, releaseTag, assetPattern, format}` (crk: `giellalt/lang-crk`, `fst-v2021.7.8`). Heterogeneous — gate on `type`, not array non-emptiness (fra's entry is a spaCy tokenizer) |
| FST invocation | PARTIAL | runtime dep signals only (`evalPack.requiresFst`, `pythonDeps.pyhfst`); invocation stays pack-level code — correct, cards shouldn't hold code |
| Dictionaries | **PRESENT** | `resources.dictionaries[]` — schematized `{name, url, license?, machineReadable?, redistributable?, source}` on **944 cards** (derive-dictionaries.mjs promotes `encyclopedic.resources.dictionaries` + Lexibank `resources.lexical` entries; crk itwêwina carries `redistributable: false`) |
| Script/orthography | **PRESENT** | `orthographies[]` — `{script, scheme?, longVowelMarking?, canonicalForMt?, source}` on **6,712 cards** (derive-orthographies.mjs; crk: `Latn/SRO/circumflex/canonicalForMt: true` vs `Cans/canonicalForMt: false`, curated register `cli/shared/curated-orthography-conventions.json`) — the ledger-#5 surface is now structured, plus the original `scripts[]`, `scriptConverter`, `orthographicStatus` |
| Typology (polysynthesis) | **PRESENT** | `typologicalProfile.morphologicalSynthesis` — `analytic\|synthetic\|polysynthetic` on **253 cards** (126/92/35; derive-morphological-synthesis.mjs from on-card WALS 22A/26A + cited polysynthesis prose; conflicts → absent; `derived:` provenance enforced by lint R6) |
| Grammar citations | **PRESENT** | `resources.grammars[]` — `{author?, year?, title, url, type}` on **4,829 cards / 9,520 citations** (enrich-grammars-from-glottolog.mjs from Glottolog 5.3 MED records, hhtype-filtered to grammar/grammar_sketch, ≤3 per language, stable glottolog.org reference URLs) |

**Card-schema additions (⚑ F5) — IMPLEMENTED 2026-07-12** (founder-approved
background task; generator work, NOT done by forge, never hand-edited; all
resource-existence/capability, R3-safe). Schema:
`cli/shared/schemas/language-card.schema.json`; field reference:
`cli/shared/LANGUAGE-CARD-FIELDS.md`. Generators (idempotent, `--dry-run`/
`--lang`): `derive-dictionaries.mjs`, `enrich-grammars-from-glottolog.mjs`
(+ `download-glottolog-grammar-sources.mjs`, pinned glottolog-cldf v5.3),
`derive-orthographies.mjs`, `derive-morphological-synthesis.mjs`. The legacy
flat-array `resources` shape was migrated to the keyed object form
(cleanup-resources.mjs) to unblock the two `resources.*` fields.

**BUILT (2026-07-12, founder generality review):** `nmt_forge/cards.py` is
the discovery layer — `discover(iso3)` reads one card (env
`CHAMPOLLION_CARDS_DIR` / monorepo walk-up) into a `ResourceReport`:
scripts + direction (RTL surfaces), morphological analyzers (vs other FSTs
— gate on `type`, per the audit), dictionaries, OPUS/corpora signals,
`evalDatasets` ids cross-checked live against the mt-eval registry
(`do_not_train`/`quarantine`/`contamination`; honest note when the registry
is unreachable), the LYSS referee as ready-to-paste plugin specs (the
cards→LYSS→forge loop closes from SSOT data), typology hints with field
paths, and an explicit `unknowns` list — **absence is UNKNOWN, never
zero**. Every report ends in the **asset ladder** (1 parallel → 2 +mono →
3 +dictionary/grammar → 4 +analyzer → 5 +referee): one tool for a
179-corpus/no-analyzer card (fra), a nearly-bare card (nav), an RTL
analyzer card (arb), and crk — no special cases; the card decides.
`nmt-forge init <code>` (`nmt_forge/scaffold.py`) turns a report into the
amateur/agent front door: workspace + starter config (language block,
referee plugin lanes pre-wired when the card declares them) +
`NEXT_STEPS.md` (the agent brief: command order, ladder, non-negotiables).
The starter config deliberately points at not-yet-registered eval names so
the first `run` meets the dev-fence's teaching refusal. Script diversity
fix shipped alongside: leak-audit's near-dupe screen falls back to
character n-grams for spaceless scripts (zh/ja/th-class), where a
token-only screen silently went inert.

With the F5 fields landed, `discover()` reads the schematized paths first:
`resources.dictionaries[]` (surfacing `redistributable: false` as a loud
POINTER-ONLY marker), `resources.grammars[]` (rendered as citations; rung 3
counts them), `orthographies[]` (`canonical_orthography()` picks the
`canonicalForMt` entry — the form canon_chars normalization targets;
`longVowelMarking` names the convention), and
`typologicalProfile.morphologicalSynthesis` as the lead typology hint —
falling back to the free-form `encyclopedic` spots on stale card trees, and
treating a legacy flat-array `resources` as silent (unknown, never a crash).
Packs may still override locally.


---

## 8. Docs + agent guidance (slice 4)

Two-doc-set rule compliance:
- **Package docs** (ships with forge, monorepo): `forge/README.md` — usage,
  the mistake→mechanism table, the refusal-message philosophy.
- **Internal wiki**: `docs/NMT_FORGE_PLAN_2026-07-12.md` (frontmatter
  `status: current`, `relates: [[DATA_BOUNDARIES]] [[AGENTS]]`), linked from
  `docs/INDEX.md` → *Engineering Plans & Specs*; row added to
  `docs/AGENTS.md` Key Internal Documents. Points at `forge/DESIGN.md`.
- **Public docs** (⚑ F6): a draft page + proposed `llms.txt` entries prepared
  under `forge/docs/public-draft/` — **not** wired into `cli/website/`
  (public docs only on founder approval; keeps the llms-full sync gate green).
- **MCP** (⚑ F7): new read-only tool `get_training_guardrails` in
  `mcp-server/` (thin Zod registration in `src/index.js`, logic in
  `src/tools/training.js`, `node:test` coverage — house pattern), so agents
  discover the guardrails instead of re-inventing the errors. Content: the 10
  guards, when each applies, and the non-negotiables (group-disjoint splits,
  never select checkpoints on test, CIs always, prereg before test scoring,
  `do_not_train` datasets never in training mixes). `instructions.md` gains a
  "Training a model?" pointer.

## 9. Repo integration + testing discipline

- **Quarantine gate**: forge tracks **no corpus-shaped files**. All test data
  is built in Python code at test runtime into `tmp_path` (the gate scans
  tracked files only; nothing to trip). Fixture text uses invented tokens;
  no EdTeKLA/Wolvengrey/itwêwina content anywhere; no files named to trip the
  NAMED check (`held_out`, `gold_standard`, …).
- **Tests**: `forge/tests/` (pytest). Guards: exhaustive unit tests incl. the
  refusal messages. Synthesis: `FakeAnalyzer` round-trip laws, citation
  enforcement, filter accounting. Training: `DummyBackend` end-to-end run
  (mix → fence → train → selection → manifest). ci-scoring: real harness via
  `../arena` path (sacrebleu present) + injected-metric hermetic tests.
- **Verification before "done"**: `cd forge && python3 -m pytest` ·
  `cd arena && python3 -m pytest tests/` · `cd cli && npm test` ·
  `cd mcp-server && npm test` · `scripts/quarantine_gate.sh`.
- `CLAUDE.md` monorepo map gains a `forge/` row. (Done — and F3 is decided:
  public, see §10.)

## 10. Founder decision list (consolidated)

| ⚑ | Decision | Status (founder review 2026-07-12) |
|---|---|---|
| F1 | Name | ✅ **approved**: `nmt-forge` / `forge/` / `nmt_forge` |
| F2 | License | AGPL-3.0 (harness-coherent); LICENSE copied from arena — change before publish if desired |
| F3 | Public-squash inclusion | merged to main; ships with whatever the next public squash includes |
| F4 | Ledger §4 "home: harness" deviation | separate package per task instruction — recorded in §0 |
| F5 | Card schema additions (4 fields) | ✅ **implemented 2026-07-12** — schema + 4 generators shipped; coverage: dictionaries 944 · grammars 4,829 (9,520 citations) · orthographies 6,712 · morphologicalSynthesis 253; see §7 |
| F6 | Public docs | ✅ **approved & wired**: `cli/website/docs/network/getting-started/training-honestly.md` + llms.txt entry (surface-first per founder style mandate); `forge/docs/public-draft/` removed |
| F7 | MCP tool `get_training_guardrails` | implemented in monorepo mcp-server; ships whenever next published |
| F8 | crk pack | ✅ **superseded**: relocated to crk-translate (`nmt_forge_crk`, commit efeafdc there) — forge ships no packs; the 977k factory migrates onto the pack interface in crk-translate |
| F9 | Config format | JSON (SSOT convention); YAML can be added |
| F10 | PyPI publication | not published; monorepo push authorized 2026-07-12 |

Post-review addition: **LYSS lanes** (§4.8) — founder ask "do the LYSS format
linters plug in easily and help in the right ways?" answered by building the
bridge + tests (`tests/test_lyss_bridge.py`, incl. the real
`champollion-lyss` linter end-to-end).

## 11a. THE acceptance test (founder directive 2026-07-12 — dogfooding)

forge's first vertical slice and acceptance test is FIXED: reproduce the
crk-translate definitive run (e15-v5) end-to-end through the suite from one
config. Kit + evidence live with the data:
`../champollion-crk-translate/forge_acceptance/` (config.json,
predictions.json = the README pre-registration encoded, acceptance.py
driver, ACCEPTANCE.md runbook, generated ACCEPTANCE_REPORT.md).

Criteria → status at first run (2026-07-12, vs attempt-1 artifacts, no
retraining — the driver never trains):
1. **one config expresses the run** — PASS (data+rights incl. the
   local-only itwêwina lane, mix 54×gold / kind-cap / 600k sample / seed
   42, NLLB-600M LoRA r64, regime auto, decode 256, eval block w/ battery +
   plugins + canonicalizer + prereg + bootstrap seed);
2. **guards fire** — PASS: split-guard verified the real 243/42/150 carve
   (0 shared keys); dev-fence REFUSED the battery as an early-stop hook;
   schedule-sanity DERIVED the floor 38,321/114,963 (manual --min-steps was
   40k; false bottom ~8k); eval-ledger logged the battery reads. Plus a
   REVIEW finding surfaced BY the guards: 37 near-dupe (≥0.6 Jaccard)
   train↔battery rewordings, exact overlap zero — a screen the reference
   protocol never ran. RESOLVED (2026-07-12): the frozen battery stays
   unchanged (minimal pairs in training are pedagogically deliberate; the
   variants are worth measuring), and the bound is made visible instead of
   silent — `score_battery(near_dupe_corpus=…)` flags rows with a
   train-side near-twin (`leak_audit.near_twin_flags`) and reports a
   per-group "(strict)" clean-subset row alongside the full table, so the
   full-vs-strict gap IS the optimism bound; and the NEXT re-split carves
   near-dupe-disjoint via `group_split(near_dupe_jaccard=0.6)` (union-find
   over Jaccard edges, with a manifest `group_size_report` because chained
   textbook drills can collapse into one giant group);
3. **battery-table parity** — PASS on the scoring lane: per-register chrF++
   max |Δ| 0.048, dual-gate strict/extended exact to 3 decimals, mixed
   exact, coverage Δ≤0.016 (live-growing gloss cache; per-cache-state
   determinism). Training parity = the founder-triggered reproduce step
   (`nmt-forge run forge_acceptance/config.json`, then re-run the driver);
4. **plain-language report** — PASS (`nmt_forge/reporting.py`: run reports
   written by every `nmt-forge run`; battery narratives by `score
   --config` / the driver).

Built for this slice: `score_battery` (per-register grouped scoring —
id-aligned hypothesis joins, boundary canonicalization with RAW text kept
for convention/coverage lanes, plugin inference once across groups, one
prereg gate + one ledgered read, weighted ALL row that never replaces
per-group claims), the config `eval` block (+ `nmt-forge score --config`),
lane `rights` metadata, `reporting.py` (+ `nmt-forge report`), and
`nmt_forge_crk/battery_plugins.py` in crk-translate (battery.py's columns
as MetricPlugins wrapping the existing implementations — the migration
path). After acceptance, crk-translate development migrates onto the forge;
its ad hoc scripts become the legacy reference implementation.

## 11. Implementation plan (vertical slices, each tested)

1. **Guardrails** — workspace spine (registry, ledger, canonical) + all ten
   guards + CLI; full test coverage including refusal messages.
2. **Synthesis** — analyzer protocol, templates/filters/engine/probe, pack
   framework, crk reference pack (hermetic tests + optional live-FST test).
3. **Training** — config/mix/backends/selection/backtranslation/run;
   DummyBackend end-to-end; HF backend behind optional extra.
4. **Docs + agent guidance** — README, internal wiki page + INDEX/AGENTS
   links, public-docs draft, MCP tool; full verification suite run.
