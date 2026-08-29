---
sidebar_position: 4
title: Diagnosing a Training Run
description: Symptom-first troubleshooting for low-resource MT training — start from what you're seeing, find the likely cause, and the forge lever that fixes it.
related:
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
fixes it. Most of these are automated — `nmt-forge evaluate` appends a
**Diagnosis & Recommendations** section that names the finding and the lever;
this guide is the plain-language version, plus the few things forge can only
*warn* about (marked ⚠ **watch for this**).

Tell your agent: *"Run `nmt-forge lint <battery-manifest.json> --json` and act on
the highest-severity finding."* Then match what it reports against the sections
below.

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

1. **Leakage.** `nmt-forge leak-audit <corpus>` — did a test answer end up in
   training? Target-side hits are fatal for a reason.
2. **Checkpoint selection.** Was the checkpoint chosen on a **fenced dev set**,
   not the test set? forge refuses to train without a dev set exactly to prevent
   this, but a hand-rolled pipeline won't.
3. **Optimism from near-twins.** `R4-optimism-bound`: if the "full" battery score
   is several points above the "strict" (near-dupe-excluded) score, the gap is
   drill-sibling optimism. **Cite the strict number** for any generalization
   claim.

---

## "Training stopped almost immediately"

The run ended after a few hundred steps; the model barely saw its data.

**What's happening:** early stopping mistook the expected synthetic-heavy dev
wobble for convergence.

**forge behavior:** this is *prevented* by default — `nmt-forge run` derives a
stopping **floor** from your mix and suppresses early stops below it, logging the
reason in the `[schedule-sanity]` lines. If you see a stop you didn't expect,
read those lines; the run manifest records exactly what happened and why.

---

## "A metric I wanted is just… missing from the report"

The report is honest but blank on an axis (COMET, an FST validity check).

**forge finding:** `R6-referee-unavailable` — the lane is named as unavailable
with the reason. **Lever: REFEREE.**

**Fix:** install/configure the named referee and re-score. The scores you have
are still honest — they're just blind on that one axis until the referee is
present.

---

## "The model emits `<unk>` or garbled characters"

Especially on a syllabic or extended-Latin script.

⚠ **watch for this — not yet automated.** The base model's **tokenizer may not
represent your target script**. forge doesn't yet audit tokenizer coverage before
training (it's the top item on our gap list). Check your base model's tokenizer
against samples of your target script; prefer a base whose vocabulary covers the
script (many low-resource languages are covered by NLLB-family bases) or extend
the tokenizer before training.

---

## When forge refused and you don't understand why

A refusal always states **what** happened, **why** it corrupts results, and the
**fix**. If it's still unclear:

- `nmt-forge status` — where you are and the single next command.
- `nmt-forge preflight <command>` — every gate that command will hit, ✓/✗, with
  the fix for each ✗, so you resolve them all at once instead of one at a time.

A refusal is not an error in your setup — it's the tool catching a mistake before
it reaches your results. That is the whole design.
