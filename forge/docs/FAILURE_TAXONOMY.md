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
  against registered dev/test/sealed sets; **fatal** (dropped by `--clean-to`,
  refused by `run` for test/sealed): an identical source or target, or a
  target that overlaps an eval answer ≥ 0.6 (Jaccard, diacritics folded)
  AND contains it, is a fragment of it, or is ≥ 0.9 identical — the model
  would be shown (most of) the answer. Runs inside `nmt-forge run`
  automatically; also `nmt-forge leak-audit <corpus>`, which explains each
  kind with examples. Deterministic: eval sets by name, rows in file order,
  never hash order (2026-10: per-set counts used to change between runs).
- **Fix:** `nmt-forge leak-audit <corpus> --clean-to <out.jsonl>` and train on
  the survivors (the audit manifest lands next to them).

### 1.1b Template siblings — same frame, different answer (NOT a leak)
- **Symptom:** a templated corpus ("I see the dog" / "I see the cat", school
  drills, textbook exercises) shares a frame with almost every test row; a
  Jaccard-only screen drops most of the corpus (a synthetic user lost 1,258
  of 1,600 pairs this way, 2026-10).
- **Guard:** the target-side overlap is a SUBSTITUTION (each side has a word
  the other lacks) → lane `near_dupe_template`: reported, never fatal, never
  removed. The eval rows that have such a sibling are listed
  (`eval_rows_with_template_sibling`) so the optimism is MEASURED instead.
- **Fix:** keep the rows; set `eval.near_dupe_corpus` to the train file so the
  battery report prints a "(strict)" score on the rows without a sibling next
  to the full one (the gap is the template optimism — see 1.4). When MOST
  test rows have one, keeping them is no longer harmless — see 1.4b.

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

### 1.3b Chained templates — the near-dupe carve is not the split asked for
- **Symptom:** `split --near-dupe 0.6` on a templated phrasebook (Round 7
  hospital persona, 2026-10) produced a 714-row dev set when 100 were asked
  for and left 159 training rows: near-duplicate links are transitive, the
  frames chained into one giant share-group, and a group goes to one side
  whole. The carve was registered anyway, and every near-twin advice kept
  recommending `--near-dupe 0.6` on a corpus where it could not work.
- **Guard:** `split_guard.size_deviations` — a carved side holding more than
  `SIDE_TOLERANCE` = 1.5× its request, or training keeping less than
  `TRAIN_KEEP_SHARE` = 50% of what the request leaves it, raises
  `SplitSizeRefused` before anything is written or registered (numbers, the
  chaining, the routes). `split_guard.near_dupe_chaining` (largest group ≥
  `CHAIN_SHARE` = 50% of the rows) tailors every near-twin advice
  (`ci_scoring.near_twin_advice` & co.) so none names the near-dupe carve
  where it cannot work.
- **Fix:** independent dev/test sentences; `--near-dupe 0.6 --max-group N`
  (links cut strongest-first while a group stays ≤ N; uncut links counted,
  the near-twin check reports what crosses sides); a higher threshold; for a
  fixed test set, `leak-audit --drop-test-twins` (1.4b).

### 1.4 Drill-sibling optimism — near-twins inside the eval inflate the score
- **Symptom:** the "full" battery score is several points above a strict
  near-dupe-aware score; the gap is generalization optimism, not skill.
- **Lint:** `battery_lint.py` **R4-optimism-bound** — fires when
  `full − strict > 3.0` (chrF++), tells you to cite the strict number.
- **Fix:** carve near-dupe-aware at the next re-split; cite strict for any
  generalization claim. A fixed test set cannot be re-split — see 1.4b.

### 1.4b Recall dressed as translation — most test rows have a training twin
- **Symptom:** the test score looks respectable (school user, Round 4,
  2026-10: chrF++ 67.08) but all 200 rows of the teacher-written test set
  have a near-identical template twin in training, so the strict subset is
  EMPTY and the score measures recall of training phrases. Before the
  lever existed, forge said so on every output and offered no fix: `split
  --near-dupe` only helps when forge carves the test set, and leak-audit
  keeps template siblings as practice (1.1b).
- **Guard:** the near-twin forecast — `split`, `leak-audit` and `preflight
  run` (warning gate `test-near-twins`) count the test rows with a
  train-side near-twin BEFORE training (`ci_scoring.near_twin_forecast`:
  identical, or token-set Jaccard ≥ `NEAR_TWIN_JACCARD` = 0.6 on the source
  or target side); after scoring, `export`/DEPLOY.md/the TestReport say the
  score is recall when ≥ 50% are twinned, and `battery_lint.py`
  **R4-recall-not-translation** names it at high severity. Every one of
  these names the fix below.
- **Fix:** test set carved by forge → `split … --near-dupe 0.6` (whole
  templates on one side) — unless the templates chain (1.3b), which the
  advice then says. Test set FIXED (registered, written separately) →
  `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl> --drop-test-twins`:
  drops the training rows that are near-twins of any registered test/sealed
  row at the forecast's own threshold (one shared constant, so the cleaned
  file forecasts zero twins), reports how many rows go and the strict
  subset before → after (`0 → 200 of 200 test rows`), marks the cleaned
  file like the source, and REFUSES (`TrainingWouldBeEmpty`, nothing
  written) when no row would be left to train on. Or get test sentences
  written independently of the training material. After an export the test
  set has been read once: preregister the retrained model with `prereg new
  … --allow-after-reads` (ledgered).

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
- **Guard:** ledger `sealed-spend` events (`Ledger.sealed_spent`) + the
  `score`/`evaluate`/`export` preflight `sealed-unspent` gate. "There is no fix
  — that is the point." (Until 2026-10 the preflight looked for an event name
  the ledger never writes, so the gate always showed ✓; the refusal at score
  time still held.)
- **Fix:** don't; carve a fresh sealed set from unused data.

### 2.3 Reporting a test number with no pre-registered prediction
- **Symptom:** results-first storytelling — the hypothesis is written *after*
  seeing the score, so any pattern looks confirmed.
- **Guard:** `guards/preregister.py` + the `score` preflight `preregistration`
  gate — scoring a test/sealed set is refused without a prereg bound to it.
- **Fix:** `nmt-forge prereg template --out predictions.json`, edit it, then
  `nmt-forge prereg new <id> --eval-set <name> --predictions predictions.json`
  **before** decoding. The predictions file has ONE format (a JSON array of
  prediction objects — `prereg template` prints it); Markdown, wrapper
  objects and the template's unedited REPLACE placeholders are refused with
  the format, never a traceback.

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

### 6.5 A score the harness qualifies, quoted bare
- **Symptom:** the twin-free model's chrF++ (hospital persona, Round 13,
  2026-10: 48.41) is cited as "the number to quote for new sentences" and
  as measuring "translation of unseen sentences", while the TestReport
  forge itself wrote says the output is near-constant — 150 of 150
  different test sources got one of only 9 outputs (school persona: 196 of
  200 got one of 5). A common phrase shares many characters with many
  references, so chrF++ stays respectable; the outputs do not follow the
  inputs. No forge surface said so.
- **Guard:** `nmt_forge.harness_caveats` — forge computes no caveat (6.3);
  it relays the harness's `score_caveats` (near-constant output, length
  inflation/deflation, source copies), entry for entry and in the
  harness's words, wherever it shows or recommends a score: the export
  summary and `forge-model.json` (`score_caveats`), DEPLOY.md (under the
  score; §5's test line points at a major one; a refreshable block, so a
  DEPLOY.md written earlier gains them when forge next rewrites it),
  `status` (`advice.exports[].score_caveats`, the twin-free sibling's
  too), `report`, `compare` (a flagged system is never said to measure
  unseen-sentence translation; a flagged winner's win carries the caveat)
  and **R9-harness-score-caveat** in `lint` / the battery Diagnosis (`high`
  for a major caveat). A score with a major caveat is "the number to
  quote — but read this caveat first", never bare. A TestReport with no
  `score_caveats` key gets no sentence at all. Since the scoring standard
  (`standard/1`, 2026-10-04) the score each caveat qualifies is named with
  it: the headline, corpus chrF++ with its 95% CI (`chrF++ 47.5 [45.9,
  49.0]`). Round 14: `lint` given a RUN manifest said "0 findings" for the
  flagged model — it now lints every scored export of that run (R9 relayed
  with the headline) and refuses a run with none, naming the export command.
- **Fix:** read a few outputs before calling the score translation
  quality; quote the score only with its caveat. A near-constant twin-free
  model usually means too little varied training data once the templates
  are gone — more real, varied pairs are the lever.

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
- **Guard/tool:** `nmt-forge evaluate <run-manifest> [--config <config>]` —
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
  `training/schedule.py::check_time_budget` / `WallClockProjector`): after
  an untimed warm-up (`model.budget_warmup_steps`, default 10 — kernel
  compilation and allocator warm-up live there) and a calibration window
  (default 25 steps) the observed sec/it is projected over the planned steps
  as a labelled EARLY estimate, then re-measured over a steady-state window
  (default 75 steps); a re-estimate over `model.time_budget_hours` — the
  user's number; `nmt-forge init` writes none (forge never invents a budget,
  Round 5), and without one forge's labelled 24h safety ceiling applies —
  **refuses the run minutes in** — an early estimate already > 3× the
  budget refuses at once — with the levers named (shrink
  `mix.synthetic_sample`, raise the budget deliberately, cap
  `max_src`/`max_tgt`). Both projections are printed and fed to the monitor
  even when they pass. (Timing the warm-up made a ~4-minute CPU run print
  ≈0.7h — a school persona, 2026-10.)
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

### 8.8 Green preflight, then a refusal the preflight could have predicted
- **Symptom:** `nmt-forge preflight run` shows every gate ✓, then `nmt-forge
  run` refuses with `python3 -m pip install 'nmt-forge[hf]'` (synthetic users, 2026-10).
  Same family: the Trainer refusing because `accelerate` (a hard
  requirement of the transformers Trainer) was never in the `[hf]` extra.
- **Guard:** ONE check (`training.backends.hf_missing`) used by both the
  backend's refusal and the `backend-installed` preflight gate; `preflight run
  --config` also checks the config parses, its OWN dev set is registered as
  dev, its data files exist, and the config's workspace is the one you are
  inspecting. The `[hf]` extra now carries accelerate + sentencepiece.
- **Fix:** run `preflight run --config config.json`; install what it names.

### 8.9 A small corpus is never evaluated
- **Symptom:** a 1,600-pair run (≈300 steps) refuses after training with "no
  eval checkpoints": the eval cadence was a fixed 2,000 steps, and a user's
  `model.eval_steps` was silently overridden by that default.
- **Guard:** `plan_schedule` derives `eval_steps = min(2000, ⌈planned/10⌉)`
  (≈10 dev evaluations per run); a value the user sets in `model` is never
  overridden. Checkpoints the trainer rotated out are marked path-less so
  selection can never decode a different model under their name.
- **Fix:** none needed; leave `eval_steps` unset unless you mean it.

### 8.10 The first model needs a GPU nobody has
- **Symptom:** the only documented model is NLLB-600M; a school with ~1,600
  pairs and a laptop has no path at all, so the loop is never learned.
- **Guard/tool:** model presets in `nmt-forge init --model`: `cpu-tiny`
  (default — a small Marian trained from scratch with a tokenizer fit on the
  TRAIN rows only; minutes on a CPU; weak by design, stated in the config's
  brief), `cpu-finetune --base <opus-mt id>`, `nllb-600m` (GPU). Then
  `nmt-forge export` (prereg-gated test score + mt-eval TestReport +
  self-contained model) and `nmt-forge serve` (champollion api contract +
  OpenAI-compatible) close the loop to deployment.
- **Fix:** start with `cpu-tiny`; upgrade the preset when hardware allows —
  the fence, the audits and the test set stay the same, so the numbers stay
  comparable.

### 8.11 The tool's own output leaks a private test set to the agent's model provider
- **Symptom:** a hospital's nurse-checked test set is marked local-only so
  no outside AI service sees it, yet the agent driving forge reads
  `leak-audit`'s examples — `e.g. line 42 "<a fragment of a test answer>" →
  project-test row 3` — or an error message quoting a row, and sends that
  text to its model provider with the rest of its context. Or `split` carves
  a local-only corpus into `train/dev/test.jsonl` files with no mark, which
  then read as anyone's data.
- **Guard:** `nmt_forge.privacy`, deciding nothing itself: the harness's
  `withheld_text_reason` says which corpora are withheld (local-only,
  sealed, consent-required). `leak-audit` shows those rows (and every row of
  a marked training corpus) by line number with one line saying why;
  `--json` never carries sentences and names the withheld corpora
  (`text_withheld`); errors are passed through the harness's
  `scrub_corpus_text`; `split`, `leak-audit --clean-to` and `sample` write
  the source's terms next to every file they carve; forge's mt-eval RunLog
  records the corpus's transmission policy so `mt-eval compare` withholds
  it too. Tested end to end against a local-only TSV
  (`tests/test_private_text.py`).
- **Fix:** none needed. A person at the terminal who must see the text
  passes `--show-text`; an agent never should.

### 8.12 One test file, two names
- **Symptom:** the teacher-checked file is `eval-eng-crk-our-school-dev-v1`
  on its corpora card and in every `mt-eval` run, but `project-test` in
  forge's report and export — so a forge result and a harness result on the
  same set do not visibly belong together.
- **Guard:** `registry.dataset_identity` reads the id the harness would use,
  verbatim and in the harness's own precedence (an `add-harness` registry
  id, a JSON envelope's `dataset.id`, a registered card's `id` only while
  the file's sha256 matches the sidecar's, the sidecar's `id`). It is the
  `dataset_id` in `registry add|list`, every score/battery report, the run
  manifest's dev set, `export`, `forge-model.json`, DEPLOY.md and the mt-eval
  RunLog/TestReport; forge's own name stays beside it for the ledger,
  preregistrations and `--eval-set`.
- **Fix:** none needed; a card for a changed file is not applied, and
  `registry list` says why (`dataset_id_note`) — re-register the file.

### 8.13 A count that names the wrong thing
- **Symptom:** the twin-free leak audit said "90 of the leaking rows are
  your registered dev set's own rows" for an 80-row dev set (hospital
  persona, Round 13): 80 were copies of the dev rows, 10 were
  near-duplicates of their answers (rows containing a dev answer, or part
  of one) — and one of the two numbers looked wrong.
- **Guard:** `leak_audit.dev_leak_breakdown` — per set, the dropped rows
  split by kind (`copy_rows` + `near_dupe_rows` = `dropped_rows`;
  `copied_eval_rows` tells the dev rows themselves from extra copies), and
  the summary names each: "90 of the leaking rows match your registered
  dev set (80 rows): 80 are copies of its own rows and 10 are
  near-duplicates of its answers".
- **Fix:** none needed; the numbers are in `verdict.numbers`
  (`dev_set_rows_among_them`, `dev_set_near_duplicates_among_them`,
  `dev_set_leaking_rows`, `dev_set_rows_registered`).

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
