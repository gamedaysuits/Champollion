# nmt-forge Failure Taxonomy

*The mistakes that make a low-resource MT model look better than it is — and
which forge guard catches each one. This is the map an agent (or a human)
uses to know **why** a refusal fired, or **what** to check when the guards
are silent but the numbers still feel wrong.*

Each entry is: **failure** → **symptom an agent actually sees** → **the forge
guard / lint that catches it** (or **GAP** — nothing does yet) → **one-sentence
fix**. Entries are grouped by where in the pipeline they bite. The ranked GAP
list is at the end.

> **Positioning.** The training tools novices reach for — Microsoft Custom
> Translator, LibreTranslate/Locomotive/Argos, the OPUS ecosystem
> (OpusFilter/OpusTrainer), HuggingFace AutoTrain, Mozilla's pipelines — will
> happily train a model on a leaking split, report a single BLEU with no
> interval, and never look at whether the tokenizer can even represent the
> target script. **Nobody audits leakage by default, checks significance by
> default, or checks tokenizer/orthography coverage by default.** Forge's bet
> is that in the agentic era the scarce resource is not compute but *a novice's
> judgement* — so every one of those judgement calls is encoded as a guard that
> refuses with a what/why/fix, or a lint that reads the result and names the
> lever. The taxonomy below is that encoding, made legible.

---

## 1. Data leakage (the answer is in the training set)

### 1.1 Target-side leakage — the reference translation is in the training mix
- **Symptom:** eval scores are implausibly high for the data volume; the model
  "translates" held-out sentences it has effectively memorised.
- **Guard:** `guards/leak_audit.py` — screens every gold and synthetic lane
  against registered dev/test/sealed sets; **target-side exact/near-dupe is
  fatal** (answer leakage). Runs inside `nmt-forge run` automatically; also
  `nmt-forge leak-audit <corpus>`.
- **Fix:** `nmt-forge leak-audit <corpus> --clean-to <out.jsonl>` and train on
  the survivors.

### 1.2 Source-side near-duplication — same prompt, *different* answer
- **Symptom:** a naive leak-checker screams (24 of 44 flags on the crk gold
  set), and a novice deletes legitimate minimal-contrast pairs, shrinking a
  low-resource corpus for no reason.
- **Guard:** `leak_audit.py` `pair_mode="target-anchored"` (default) — source-only
  near-dupe is an **informational lane** (`near_dupe_source_only`), reported but
  never fatal and never removed by `clean()`. *This distinction was itself a
  dogfood-found bug (see 8.1).*
- **Fix:** none needed — read the informational lane, keep the rows.

### 1.3 Group leakage across the split — paraphrase siblings straddle train/test
- **Symptom:** dev/test look disjoint by exact match but share answer-bearing
  paraphrases; generalization is overstated.
- **Guard:** `guards/split_guard.py` — `group_split` carves train/dev/test so
  any pair sharing a canonical source **or** target lands on one side;
  `verify_disjoint` crashes on any shared canonical key.
- **Fix:** `nmt-forge split <corpus> --test N --dev M --seed S --out <dir>` —
  never split by hand.

### 1.4 Drill-sibling optimism — near-twins inside the eval inflate the score
- **Symptom:** the "full" battery score is several points above a strict
  near-dupe-aware score; the gap is generalization optimism, not skill.
- **Lint:** `battery_lint.py` **R4-optimism-bound** — fires when
  `full − strict > 3.0` (chrF++), tells you to cite the strict number.
- **Fix:** carve near-dupe-aware at the next re-split; cite strict for any
  generalization claim.

## 2. Dev/test contamination (selecting on the answer)

### 2.1 Selecting checkpoints on the test set
- **Symptom:** great test score, no fenced dev; the "best" checkpoint was
  chosen by peeking at the thing being reported (catalogued mistake #2).
- **Guard:** `guards/dev_fence.py` (`DevFence.require_dev`) — training is
  **refused** unless a `role=dev` set is registered; dev is read only through
  the fence, keyed by config hash.
- **Fix:** register a dev set (`registry add … --role dev`); the advisor's
  `no-dev-set` state hands you the exact command.

### 2.2 Spending a one-shot sealed set twice
- **Symptom:** a sealed test set is scored, tuned against, and scored again —
  it is no longer held-out.
- **Guard:** ledger `sealed-spend:<name>` events + the `score` preflight
  `sealed-unspent` gate. "There is no fix — that is the point."
- **Fix:** don't; carve a fresh sealed set from unused data.

### 2.3 Reporting a test number with no pre-registered prediction
- **Symptom:** results-first storytelling — the hypothesis is written *after*
  seeing the score, so any pattern looks confirmed.
- **Guard:** `guards/preregister.py` + the `score` preflight `preregistration`
  gate — scoring a test/sealed set is refused without a prereg bound to it.
- **Fix:** `nmt-forge prereg new --eval <name> --predictions <file>` **before**
  decoding.

### 2.4 Postdiction laundering on a reused test set
- **Symptom:** an agent writes "predictions" for experiment N+1 after reading
  experiment N's scores on the same test set, and registers them as a prereg.
- **Guard:** `preregister.new` refuses when the eval set has prior scored
  reads; the legitimate case (delta-predictions against a published baseline)
  goes through `--allow-after-reads`, which is **ledgered, never silent** —
  the record shows the predictions postdate the baseline reads.
- **Fix:** state predictions as deltas against the named baseline and take the
  ledgered override; sealed sets have no override — they are one-shot.

## 3. Tokenizer / orthography mismatch

### 3.1 Tokenizer can't represent the target script
- **Symptom:** the model emits `<unk>` or mangled characters on a syllabic or
  extended-Latin script; chrF++ is oddly low even where words are "known".
- **Guard:** **GAP** — no tokenizer-coverage guard yet (see GAP-1). The neural
  metric lane emits a low-resource warning via `--target-lang`, but nothing
  audits subword coverage of the reference set before compute is spent.
- **Fix (manual):** check the base model's tokenizer against target-script
  samples; prefer a base whose vocabulary covers the script (e.g. NLLB for many
  LRLs) or extend the tokenizer.

### 3.2 Mixed orthographic conventions taught as interchangeable
- **Symptom:** outputs freely mix conventions (e.g. macron vs circumflex, SRO
  vs syllabics); a novice reads it as "creative spelling".
- **Guard:** `guards/convention_lint.py`; **R3-mixed-convention** in
  `battery_lint.py` fires when `mixed_convention > 1%`.
- **Fix:** convention-lint the corpus, normalise at the boundaries, retrain on
  **one** canonical convention.

### 3.3 Rendered-source breakage in synthesized data
- **Symptom:** English source strings come out malformed — `"bes"`, doubled
  prepositions, dislocated `"of … as"`, `{placeholder}` residue — teaching the
  model to condition on garbage.
- **Guard:** `synthesis/filters.py` `source_wellformedness` filter — a
  language-configurable well-formedness checker (default English) that counts
  and drops these classes as a first-class synthesis filter.
- **Fix:** enable the filter (on by default in the crk pack); fix the template
  that produced the class it names.

### 3.4 Target-side placeholder residue — the generator lies about its own output
- **Symptom:** synthetic Cree (or any target) contains literal scaffolding
  tokens with real inflections attached (`kika-CHECKnâwâw` — a stem-lookup
  failure emitting its `CHECK` placeholder into the paradigm); the corpus
  still claims "FST-verified / 0 residual breakage" because the build-time
  check covered the *other* side or ran before the breaking transform.
- **Guard:** the **target-validity gate** (`mix.validator`, 2026-07-14): forge
  re-verifies every lane at mix ingest with a pluggable validator (e.g.
  every-word-strict-FST-analyzable); a synthetic lane under
  `mix.validity_floor` is **refused** — verified-by-construction data failing
  re-verification means the generator or a later transform broke. Found 69+16
  such rows in the crk v6/v7 corpora on the gate's first calibration.
- **Fix:** drop the failing rows (the refusal lists ids) or regenerate through
  the pack's emit law; never lower the floor to make it pass.

## 4. Synthetic-data pathologies

### 4.1 Transfer plateau — mastering the synthetic mix, stalling on real text
- **Symptom (the flagship novice trap):** "great on my templates / textbook,
  terrible on real sentences." Dev loss bottoms out early while train loss keeps
  falling; more synthetic volume does nothing.
- **Guard/lint:** the schedule floor (`training/schedule.py`, surfaced as
  `[schedule-sanity]` events) stops early-stopping from mistaking this for
  convergence; **R7-transfer-plateau** in `battery_lint.py` names it from the
  run manifest and points at REAL-DATA levers.
- **Fix:** add real text — backtranslate monolingual target data
  (`training/backtranslation.py`), or acquire real parallel sentences. Synthetic
  volume is not the lever.

### 4.2 Half-epoch death — early-stopping kills a synthetic-dominated run
- **Symptom:** training stops after a few hundred steps because real-dev loss
  ticked up once; the model never saw most of its data.
- **Guard:** `training/schedule.py` derives an early-stop **floor** from the
  gold/synthetic mix ratio (never a magic number); `FlooredEarlyStopping` in the
  HF backend suppresses stops below the floor and logs why; `explain_stop`
  records it.
- **Fix:** none — the floor is automatic; read the `[schedule-sanity]` line.

### 4.3 Synthetic collapse / mode-narrowing — templates too few, too regular
- **Symptom:** high scores on covered constructions, blanks elsewhere; the model
  only ever learned a handful of sentence shapes.
- **Lint:** **R2-structure-gap** (coverage OK but incomplete high) → STRUCTURE
  lever; `guards/coverage_map.py` shows which grammatical phenomena are missing.
- **Fix:** run `coverage-map` against your grammar checklist, add the missing
  constructions (compositor/templates).

### 4.4 Backtranslation feeding on its own errors
- **Symptom:** BT data quality silently degrades; the model amplifies its own
  systematic mistakes.
- **Guard:** partial — BT lanes are tag-fenced (`<synth>` source token, Caswell
  et al. 2019) and counted in the mix manifest. **GAP-4:** no BT-quality gate
  (round-trip or referee filter) yet.
- **Fix (manual):** score BT output on a small referee before mixing; cap the BT
  fraction.

## 5. Vocabulary / coverage gaps

### 5.1 The model lacks the register's words
- **Symptom:** a whole register (e.g. government, legal) scores low and the
  outputs are unfinished; coverage of that register's lemmas is low.
- **Lint:** **R1-vocabulary-gap** (coverage `< 0.15` **and** incomplete
  `> 0.60`) → VOCABULARY lever.
- **Fix:** grow the lexicon (dictionary/attestation harvest), then
  `funnel-audit` to confirm the new entries actually reach the corpus.

### 5.2 Dictionary entries that never reach the corpus
- **Symptom:** the lexicon looks big but the model still can't say the words —
  attestations exist but no training row uses them.
- **Guard:** `guards/funnel_audit.py` — measures the dictionary→corpus funnel.
- **Fix:** synthesize or source sentences that exercise the stranded entries.

## 6. Metric misuse & measurement

### 6.1 Reading a delta smaller than the confidence interval
- **Symptom:** "model B beats A by 0.4 chrF++" on 80 sentences — inside the
  noise band; the ranking is a coin flip.
- **Guard/lint:** `guards/ci_scoring.py` reports **CIs by default (there is no
  bare-score rendering)**; **R5-low-power** fires when the primary-metric CI
  width `> 8.0` and says "don't act on deltas smaller than the CI."
- **Fix:** grow the eval set for that register; don't act on sub-CI deltas.

### 6.2 A single opaque number with no lanes
- **Symptom:** one BLEU stands in for "quality"; register-level and
  behavioural failures are invisible.
- **Guard:** the battery is scored **by group** (register) with multiple lanes
  (chrF++, exact-match, plus LYSS/FST behavioural lanes); **R8-weakest-registers**
  ranks them.
- **Fix:** score the config's battery, read the per-register table and the
  Diagnosis section.

### 6.3 Metric math done in forge (drift from the SSOT)
- **Symptom:** forge and the leaderboard disagree because a metric was
  re-implemented.
- **Guard:** architectural — **forge implements zero metric math**; all scoring
  is delegated to the mt-eval harness (`_harness.py`, `harness_data.py`). The
  harness is the metric SSOT.
- **Fix:** never add metric math to forge; add a harness plugin.

### 6.4 A referee lane silently missing
- **Symptom:** a metric axis (COMET, an FST validity linter) is simply absent;
  the report looks complete but is blind on that axis.
- **Lint:** **R6-referee-unavailable** — surfaces every unavailable lane from
  the battery `notes`, "honest but blind — install/configure the referee."
- **Fix:** install/configure the named referee; re-score.

## 7. Generation / decoding artifacts

### 7.1 Truncation — decode cap shorter than real references
- **Symptom:** long-register outputs are cut off; scores penalise the model for
  a decode setting, not a modelling failure.
- **Guard:** `training/selection.py` `check_generation_headroom` — checks the
  decode cap against fenced dev reference lengths **before** any training compute
  is spent (mistake #11).
- **Fix:** raise `decode.max_new_tokens` / `headroom_factor`; the guard prints
  the needed headroom.

### 7.2 Best-loss ≠ best-generation checkpoint
- **Symptom:** the lowest-dev-loss checkpoint generates worse than a higher-loss
  one (loss↔quality is an OPEN question, not a fact).
- **Guard:** `training/selection.py` `select_checkpoint` can select by a dev
  **generation** metric (with CIs), decoding the top-k checkpoints — not by loss
  alone.
- **Fix:** set `selection.metric: "generation:chrf++"` (or a plugin lane).

## 8. Process / tooling failures (the meta-layer)

### 8.1 A guard itself is miscalibrated
- **Symptom:** the tool refuses (or passes) confidently but wrongly — e.g. the
  pre-F1 leak-audit flagged 44 crk rows fatal when only 17 were real target-side
  leaks.
- **Guard:** regression fixtures pinned to ground truth (the crk false-positive
  and true-positive cases are now tests). The lesson: **verify tool refusals
  against ground truth — dogfood, don't trust.**
- **Fix:** when a refusal surprises you, reproduce it against a known case
  before believing it; add the case as a fixture.

### 8.2 The loop doesn't close — decode→battery is a manual handoff
- **Symptom:** `nmt-forge run` stops at train+select; a novice must hand-symlink
  the checkpoint and hand-run a decoder to get a battery score (the exact gap
  found by dogfooding e15-v7).
- **Guard/tool:** `nmt-forge evaluate <run-manifest> --config <config>` —
  decodes the registered battery with the selected checkpoint (backend-pluggable,
  like training), scores it, and appends the Diagnosis. Closes the loop with no
  manual steps.
- **Fix:** use `evaluate`; the advisor's `ready-to-score` state suggests it.

### 8.3 The agent gets lost — no stateful "what now?"
- **Symptom:** a Flash-class agent trial-and-errors through refusals one at a
  time, or asks the user what to do.
- **Guard/tool:** `nmt-forge status` (state table + THE next command) and
  `nmt-forge preflight <cmd>` (every gate it will hit, ✓/✗ + fixes) — the whole
  decision ladder, `--json` for agents.
- **Fix:** call `status` first, always; follow `next_command`.

### 8.4 Config typo silently becomes a default
- **Symptom:** `gold_upwieght` is ignored; the run uses the default and nobody
  notices.
- **Guard:** `training/config.py` `_check_keys` — unknown config keys are
  **refused**, not defaulted.
- **Fix:** read the error; it lists the allowed keys.

### 8.5 Quarantined / do-not-train data enters a mix or ranks
- **Symptom:** an improper easy subset ranks, or non-redistributable data leaks
  into training.
- **Guard:** `harness_data.py` honours the registry's `quarantined` /
  `do_not_train` flags — quarantined sets are refused, `do_not_train` can never
  enter a training mix.
- **Fix:** none — the refusal is the feature; use a permitted dataset.

### 8.6 Unbudgeted wall-clock — the mix is sized in steps, never in hours
- **Symptom:** a run planned as "overnight" is discovered hours in to need
  days: the new corpus's rows are much longer than the reference corpus's, so
  each step costs a multiple of what the step count implied (crk v8: v6
  template rows ≈ 5× the compositor rows → 12,774 "overnight" steps became a
  ~90-hour projection, caught by a human watching the monitor at step 832).
- **Guard:** the **wall-clock reality check** (`WallClockGate`,
  `training/schedule.py::check_time_budget`): after a short calibration
  window (default 25 steps) the observed sec/it is projected over the planned
  steps; a projection over `model.time_budget_hours` (default 24) **refuses
  the run minutes in**, with the levers named (shrink `mix.synthetic_sample`,
  raise the budget deliberately, cap `max_src`/`max_tgt`). The projection is
  printed and fed to the monitor even when it passes.
- **Fix:** right-size the mix and relaunch; never let "steps" stand in for
  "time" when the row-length distribution changed.

### 8.7 Broken curriculum init — stage N+1 doesn't actually continue stage N
- **Symptom:** the fine-tune stage makes everything catastrophically worse
  (crk v8: dev loss 3.37 → 6.26, chrF++ 24.5 → 3.0 after 70 gentle steps) —
  impossible as "forgetting"; the stage never started from the weights it
  claimed to. With LoRA the classic cause: `init_from` points at an ADAPTER
  dir, a fresh adapter is stacked on top, and the saved checkpoints record
  `base=<hub model>`, silently dropping the previous stage at decode time.
- **Guard:** two layers (2026-07-14): (1) the HF backend now **resumes the
  same adapter** (`PeftModel.from_pretrained(…, is_trainable=True)`) when
  `init_from` is an adapter dir and LoRA is configured — correct lineage by
  construction; (2) the **curriculum-continuity gate**: a stage whose FIRST
  dev loss exceeds the continued checkpoint's selected dev loss by more than
  `continuity_factor` (default 1.5×) refuses minutes in instead of finishing
  garbage.
- **Fix:** check `init_from` and adapter lineage; don't change the LoRA
  config between stages of one curriculum.

---

## Ranked GAP list (taxonomy entries with no automated guard yet)

1. **GAP-1 — Tokenizer/script coverage audit (3.1).** *Highest priority.* No
   pre-flight check that the base tokenizer can represent the target script /
   reference charset before compute is spent. Should be a headroom-style guard
   run at `run` time (decode-headroom already proves the pattern is welcome).
   Nobody in the competitive set does this at all — a clean differentiator.
2. **GAP-4 — Backtranslation quality gate (4.4).** BT lanes are tagged and
   counted but not quality-filtered; a round-trip or referee-scored BT filter
   would catch self-amplifying error loops. Belongs in
   `training/backtranslation.py` as an optional referee pass.
3. **GAP-2 — Per-register truncation check on the battery (7.1 at eval time).**
   Headroom is checked against *dev* before training; the battery decode in
   `evaluate` should re-check per-register reference lengths and warn if any
   register is being truncated at score time.
4. **GAP-3 — Gold/synthetic ratio sanity as a first-class lint.** The ratio is
   recorded in the mix manifest and used to derive the floor, but there is no
   lint that flags a pathological ratio (e.g. 99% synthetic with a real dev) as a
   transfer-plateau *risk* before training, only R7 after.
5. **GAP-5 — Seed/variance misread.** Single-seed runs are reported without a
   variance band across seeds; nothing warns that a 1-seed delta may not survive
   re-seeding. Documented as "watch for this" in the diagnostics guide until a
   multi-seed harness lane exists.

Each GAP is also written as a "watch for this" entry in the public
symptom-first diagnostics guide, so a novice's agent is warned even where the
tool can't yet refuse.
