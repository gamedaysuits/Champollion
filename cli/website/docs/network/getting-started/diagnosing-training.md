---
sidebar_position: 4
title: Diagnosing a Training Run
description: Symptom-first troubleshooting for low-resource MT training — start from what you're seeing, find the likely cause, and the forge lever that fixes it.
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Diagnosing a Training Run

Your model trained. The numbers aren't what you hoped. This page starts from
**what you're seeing** and walks you to the likely cause and the forge tool that
fixes it. Most of these are automated — `nmt-forge export` (and its score-only
half, `nmt-forge evaluate`) appends a **Diagnosis & Recommendations** section
that names the finding and the lever; this guide is the plain-language version,
plus the few things forge can only *warn* about (marked ⚠ **watch for this**).

Tell your agent: *"Run `nmt-forge lint <battery-manifest.json> --json` and act on
the highest-severity finding."* After an export, the battery manifest is
`export/evaluation/battery-hyps-battery.json`. Then match what it reports against the
sections below.

---

## "The default model's score is low"

You trained with the default `cpu-tiny` preset and the test score is somewhere
between 5 and 30 chrF++.

**What's happening:** that is what this preset does. It is a small transformer
trained from scratch on your pairs alone, so on 1–2 thousand pairs it learns
your data's phrases and sentence patterns, not the language in general — the
top of that range only appears when the data is highly templated. Its job is to
make the whole loop real (fenced dev, audited data, preregistered test, a model
the CLI can call), not to be the model you ship.

**Fix:** change one thing and measure it on the dev set, in rough order of
payoff:

1. **More real pairs.** At this size, data beats every setting.
2. **A pretrained start.** `nmt-forge init <code> --model cpu-finetune --base
   <hf-id>` fine-tunes a small pretrained Marian/opus-mt model on a CPU — pick
   one for a *related* language pair, and compare it with `cpu-tiny` on dev
   rather than assuming it wins. `--model nllb-600m` is the strongest start
   and needs a GPU.
3. **More data from what you have** — backtranslation of monolingual text, or
   verified synthesis if your language has an analyzer (see
   [So You Want to Train Your Own Model](/docs/network/tutorials/train-your-own-model)).

⚠ **watch for this:** a high score from `cpu-tiny` deserves suspicion before
celebration — see ["The score looks too good"](#the-score-looks-too-good).

---

## "Great on my textbook examples, terrible on real sentences"

**The single most common low-resource trap.** Your synthetic/templated data
scores beautifully; real text falls apart.

**What's happening:** a **transfer plateau**. During training, the loss on your
real dev set bottomed out early and then drifted up while the training loss kept
falling — the model was mastering the synthetic *mass*, not learning to
translate. More synthetic data will **not** help.

**forge finding:** `R7-transfer-plateau` (from the run manifest's schedule
story). **Lever: REAL-DATA.**

**Fix:** add real text. Backtranslate monolingual target-language data
(`nmt_forge.training.backtranslation`), or acquire real parallel sentences.
Volume of synthetic data is not the lever — variety of *real* data is.

⚠ **watch for this:** if your mix is ~99% synthetic against a small real dev set,
you are at risk of this *before* you see it in the scores. There is no pre-flight
lint for a pathological ratio yet — check your mix manifest's gold/synthetic
counts.

---

## "One register is much worse than the others"

Look at the per-register table. A single register (say, government or legal) is
far below the rest.

**Two different causes — the diagnosis tells them apart by looking at *coverage*
and whether outputs are *unfinished*:**

- **The model lacks the words** (`R1-vocabulary-gap`: low coverage **and** high
  incomplete rate). **Lever: VOCABULARY.** Grow the lexicon (dictionary /
  attestation harvest), then run `nmt-forge` funnel accounting to confirm the new
  entries actually reach the corpus — a one-character orthography mismatch has
  silently deleted thousands of words before.
- **The model has the words but not the sentence shapes** (`R2-structure-gap`:
  coverage OK, still unfinished). **Lever: STRUCTURE.** Run the coverage map
  against your grammar checklist and add the missing constructions
  (imperatives, wh-questions, possession, inverse — whatever your templates never
  asked for).

---

## "The outputs mix spellings within a sentence"

The model writes the same sound two ways, sometimes in one sentence.

**What's happening:** your training targets taught it that conventions are
interchangeable — the corpus contained the same content in multiple
orthographies.

**forge finding:** `R3-mixed-convention`. **Lever: ORTHOGRAPHY.**

**Fix:** `convention-lint` the corpus, normalize to **one** canonical convention
at the data boundary, and retrain. Keep a mixed-convention rate in your battery
so you can see it drop.

---

## "Model B beats model A — but only by a little"

You compared two models and one is ahead by a fraction of a point.

**What's happening:** the difference may be smaller than the noise. On 80
sentences a 0.4 chrF++ gap is a coin flip.

**forge finding:** `R5-low-power` (the confidence interval is wider than the
delta). **Lever: MEASUREMENT.**

**Fix:** don't act on deltas smaller than the CI. Grow the eval set for that
register, or use `nmt-forge compare` which reports a *paired* significance test
rather than two overlapping intervals. forge never renders a bare score — the
interval is always there precisely so you can see this.

⚠ **watch for this:** a result from a **single seed** carries no
variance-across-seeds band. A gain that doesn't survive re-seeding isn't real.
If a decision matters, re-run with 2–3 seeds.

---

## "The score looks too good"

Suspiciously high, especially early or on little data. Trust the suspicion.

**Check, in order:**

1. **Leakage.** `nmt-forge leak-audit <corpus>` — did a test sentence end up in
   training? It drops rows whose prompt is identical to a test prompt (even with
   a different translation), rows whose answer is identical to a test answer,
   and rows that contain, are a fragment of, or are ≥90% identical to a test
   answer. `nmt-forge run` refuses training rows that leak into a registered
   test or sealed set, so this matters most for data or a pipeline outside
   forge — or a test set you never registered.
2. **Checkpoint selection.** Was the checkpoint chosen on a **fenced dev set**,
   not the test set? forge refuses to train without a dev set exactly to prevent
   this, but a hand-rolled pipeline won't.
3. **Optimism from near-twins.** `R4-optimism-bound`: if the "full" battery score
   is several points above the "strict" score, the gap is drill-sibling
   optimism. `leak-audit` *keeps* template siblings on purpose (*"I see the
   dog"* in training, *"I see the cat"* in the test set) and lists the test rows
   that have one; with `eval.near_dupe_corpus` set to your training file (the
   starter config does this) the report scores the test rows *without* a
   sibling separately, marked "(strict)". **Cite the strict number** for any
   generalization claim. If *every* test row has a sibling (`R4-recall-not-translation`:
   the strict subset is empty, so the score measures recall of training
   phrases), and the test set is fixed, write a twin-free corpus to its own
   file with `nmt-forge leak-audit <train> --clean-to <train>.notwins.jsonl
   --drop-test-twins` and train a second, twin-free model on it (leak-audit
   will not write over the file the first model trains on) — or get test
   sentences written independently of the training templates.
4. **The outputs do not follow the inputs.** `R9-harness-score-caveat`: the
   mt-eval report says the score is qualified — most often a **near-constant
   output**: many different test sentences got the same few outputs (one
   hospital model answered 150 different sentences with 9 outputs; it still
   scored chrF++ 48, because a common phrase shares many characters with
   many references). The twin-free model is the usual suspect: with its
   training templates removed, a small model can fall back on its most
   frequent sentences. forge passes the caveat on in the harness's words —
   in the export summary, `DEPLOY.md`, `status`, `report`, `compare` and
   `lint` — and never calls such a score "the number to quote" without it.
   Read a few of the outputs (`<export>/evaluation/battery-hyps.jsonl`, on
   the machine that holds the test set) before you report the score as
   translation quality; more real, varied training pairs are the lever.

---

## "Training stopped almost immediately"

The run ended after a few hundred steps; the model barely saw its data.

**What's happening:** early stopping mistook the expected synthetic-heavy dev
wobble for convergence.

**forge behavior:** this is *prevented* by default — `nmt-forge run` derives a
stopping **floor** from your mix and suppresses early stops below it, logging the
reason in the `[schedule-sanity]` lines. How often the dev set is evaluated is
derived from the run's size as well, so a small run is not left unevaluated. If
you see a stop you didn't expect, read those lines; the run manifest records
exactly what happened and why. (A run that simply reached its last planned step
is reported as finished, not as an early stop.)

---

## "The run refused before it really started"

**What's happening:** a gate fired — which is cheaper than a run that fails
hours in. The common ones:

- **The training extra is missing** — `nmt-forge preflight run --config
  config.json` shows `✗ backend-installed` with the fix,
  `python3 -m pip install 'nmt-forge[hf]'`.
- **No dev set, or the wrong one** — the dev-fence refuses a run whose
  `data.dev` is not a registered set with role `dev`. Carve one with
  `nmt-forge split … --register project`.
- **Leakage** — a training file shares prompts or answers with a registered
  test or sealed set. Clean it with `nmt-forge leak-audit <file> --clean-to
  <file.clean.jsonl>` and point the config at the cleaned file.
- **Wall-clock** — in the first minutes, forge measures the training speed and
  refuses a run projected to exceed `model.time_budget_hours`. On a CPU this
  usually means the preset needs a GPU (`nllb-600m`), or the mix is far larger
  than you meant. The message names the levers: a smaller mix, shorter
  sequences, or a larger budget if you truly accept the wait.

**Fix:** run `nmt-forge preflight run --config config.json` before every run;
it lists every gate, ✓/✗, with the fix for each ✗.

---

## "A metric I wanted is just… missing from the report"

The report is honest but blank on an axis (COMET, an FST validity check).

**forge finding:** `R6-referee-unavailable` — the lane is named as unavailable
with the reason. **Lever: REFEREE.**

**Fix:** install/configure the named referee and re-score. When the language
card declares the referee, forge's message names the install command
(`mt-eval setup --lang <code>`). The scores you have are still honest — they're
just blind on that one axis until the referee is present.

---

## "The model emits `<unk>` or garbled characters"

Especially on a syllabic or extended-Latin script.

**It depends on the preset.**

- **`cpu-tiny`** learns its own vocabulary from your training rows, so every
  character that appears in training is covered. `<unk>` here means the input
  contains a character that never appeared in training — a rare letter or
  diacritic, or a different Unicode form of one (text is normalized to NFC, so
  composed and decomposed accents count as the same). Check that your training
  and test data use the same orthography.
- **`cpu-finetune` and `nllb-600m`** use the pretrained base model's tokenizer.

⚠ **watch for this — not yet automated (pretrained bases).** The base model's
**tokenizer may not represent your target script**. forge doesn't yet audit
tokenizer coverage before training. Check your base model's tokenizer against
samples of your target script; prefer a base whose vocabulary covers the script
(many low-resource languages are covered by NLLB-family bases) or extend the
tokenizer before training.

---

## When forge refused and you don't understand why

A refusal always states **what** happened, **why** it corrupts results, and the
**fix**. If it's still unclear:

- `nmt-forge status` — where you are and the single next command.
- `nmt-forge preflight <command>` — every gate that command will hit, ✓/✗, with
  the fix for each ✗, so you resolve them all at once instead of one at a time
  (for `run`, `evaluate` and `export`, add `--config config.json`).
- Add `--json` to any command when an agent is reading the result: a refusal
  then arrives as one JSON object — `{"error": {"type", "guard", "message",
  "why", "fix", …}}` — with exit code 2.

A refusal is not an error in your setup — it's the tool catching a mistake before
it reaches your results. That is the whole design.
