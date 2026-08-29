---
sidebar_position: 3
title: Train Your First Model (with your agent)
description: A step-by-step walkthrough for training a low-resource MT model by directing a coding agent — what you say, what forge does, what a refusal looks like, and how to read the diagnosis.
related:
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Train Your First Model (with your agent)

You do not need to know how to train a neural machine-translation model. You
need to be able to **tell a coding agent what you want** — Claude, or a
Sonnet/Flash-class model, or any agent that can run shell commands. **nmt-forge**
is built so the agent can drive it *mechanically*: at every step the tool tells
the agent exactly what to do next, and refuses — loudly, with a fix — when a
step would corrupt your results.

This page is the whole loop. Each step is written as **what you tell your
agent**, **what forge does**, **what a refusal looks like** (so neither of you
panics when one fires — a refusal is the tool working), and, at the end, **how
to read the report**.

:::tip The one rule for your agent
Tell it: *"Always run `nmt-forge status --json` first, and after every step.
Do whatever its `next_command` says."* That single habit turns forge into a
guided rail. If your agent connects over MCP, the same loop is the
`forge_status` tool — see the [Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Step 0 — Point your agent at your language

**You say:** *"I want to train an English→[your language] model. Start by
discovering what forge knows about it. The ISO 639-3 code is `crk`"* (use your
language's code).

**forge does:** `nmt-forge discover crk` reads the language's card — scripts,
dictionaries, morphological analyzers, existing corpora and eval sets (with any
`do_not_train` / quarantine flags), and per-language referee metrics. It places
your language on the **asset ladder**: (1) parallel text → guarded training;
(2) + monolingual → tagged backtranslation; (3) + dictionary/grammar → cited
synthetic data; (4) + analyzer → round-trip-verified synthesis; (5) + a referee
metric → the language's own metric in scoring and checkpoint selection.

**A blank field means UNKNOWN, never zero.** A sparse card is not "this language
has nothing" — it may just not record the resource yet. You can always bring
your own parallel corpus.

Then: *"Scaffold the project."* → `nmt-forge init crk` writes a workspace, a
starter config, and a `NEXT_STEPS` brief.

---

## Step 1 — Carve a split that can't cheat

**You say:** *"Here's my parallel corpus `corpus.jsonl`. Split it into
train/dev/test and register the dev and test sets."*

**forge does:** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7
--out data/splits --register mypair`. It makes a **group-disjoint** split: any
two sentence pairs that share a source *or* a target land on the **same** side.
This is the single most common way low-resource scores get inflated — a textbook
maps many English drills to one target word, a naive random split drops one copy
in train and its twin in test, and the model "translates" answers it memorised.

**What a refusal looks like:** if you hand forge a split you made yourself and it
isn't disjoint, `verify-split` crashes with the shared keys named — *"these rows
share a canonical target across train and test."* Fix: let forge do the split.

---

## Step 2 — Screen for leakage

**You say:** *"Before we train, check the training corpus for leakage against
the eval sets."*

**forge does:** `nmt-forge leak-audit corpus.jsonl`. It screens your corpus
against every registered dev/test/sealed set:

- **Target-side exact or near-duplicate** (the reference answer is in your
  training data) → **fatal**. This is answer leakage.
- **Source-side near-duplicate with a *different* answer** → **informational,
  kept**. Same prompt, different translation is a legitimate minimal-contrast
  pair, not a leak — forge reports it but never deletes it. (This distinction
  was a real bug we caught by dogfooding: an earlier version flagged 44 rows
  fatal when only 17 were genuine leaks.)

**What a refusal looks like:** *"row 118: target-side near-duplicate of test set
`mypair-test` (Jaccard 0.83) — answer leakage."* Fix: your agent runs
`nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` and trains on
the survivors.

---

## Step 3 — Predict before you peek

**You say:** *"Write down what we expect the model to do, then we'll train."*

**forge does:** `nmt-forge prereg new p1 --eval-set mypair-test --predictions
predictions.md`. You (or your agent, out loud) commit falsifiable predictions —
which metric, which direction, how big — **before** any test score exists.

**What a refusal looks like:** if your agent tries to score the test set with no
preregistration, `score` refuses: *"scoring a test set is refused without a
preregistration that predates the first scoring read."* This is what separates a
result from results-first storytelling. Fix: preregister first.

:::info Why this feels like extra work
It is the work. Every guard here is a mistake that has fooled real researchers.
The tool makes the honest path the easy path and the dishonest path the one that
stops you.
:::

---

## Step 4 — Check the gates, then train

**You say:** *"Will the training run pass all its checks? If so, train."*

**forge does:** `nmt-forge preflight run` lists every gate the run will hit —
dev-fence present, leak-audit clean, schedule floor derived, decode headroom
checked — each ✓ or ✗ with a fix. When it's all green:
`nmt-forge run config.json`.

Training is the one step that is **not** an instant tool call — it uses a GPU and
takes minutes to hours. Your agent runs it in a terminal and watches the
`[schedule-sanity]` lines. forge derives the early-stopping **floor** from your
data mix, so a synthetic-heavy run doesn't die at half an epoch when the real-dev
loss wobbles (a real failure mode — see
[Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training)).

When it finishes, forge has **selected a checkpoint on the fenced dev set** (never
on the test set) and written a `run-manifest.json`.

---

## Step 5 — Close the loop: evaluate and diagnose

**You say:** *"Score the model on the test battery and tell me what to improve."*

**forge does:** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config
config.json`. This **closes the loop** in one command: it decodes the test
battery with the checkpoint the run selected, scores it (prereg-gated, with 95%
confidence intervals on every number), and appends a plain-language **Diagnosis &
Recommendations** section. (Before this command existed, you had to symlink the
checkpoint and run a decoder by hand — exactly where a novice got lost.)

### How to read the battery-lint report

The report is a table of scores **by register** (textbook, government, oral
story, …), each with its confidence interval, followed by the diagnosis. The
diagnosis names your **weakest registers** and, for each, the likeliest cause and
the **lever** to pull next:

| If the diagnosis says… | It means… | The lever |
|---|---|---|
| `R1-vocabulary-gap` | the register scores low **and** outputs are unfinished; the model lacks the words | **VOCABULARY** — grow the lexicon, then re-check the funnel |
| `R2-structure-gap` | the words are known but sentence *shapes* aren't | **STRUCTURE** — add the missing constructions (templates/compositor) |
| `R3-mixed-convention` | outputs mix spellings | **ORTHOGRAPHY** — normalize the corpus to one convention, retrain |
| `R4-optimism-bound` | the "full" score is inflated by near-twin eval rows | **MEASUREMENT** — cite the strict score for generalization |
| `R5-low-power` | the confidence interval is wide | **MEASUREMENT** — don't act on deltas smaller than the CI; grow the eval set |
| `R7-transfer-plateau` | great on synthetic, stalled on real text | **REAL-DATA** — backtranslate monolingual data or get real parallel sentences |

Each finding carries the evidence it fired on. For the `--json` findings your
agent can act on programmatically: `nmt-forge lint <battery-manifest.json>`.

---

## What you just did

You trained a model whose score you can actually believe: no leaked answers, a
checkpoint chosen without peeking at the test set, error bars on every number,
predictions written before results, and a diagnosis that names the next lever
instead of leaving you to guess. That is the whole point — **the honest result
is the default, and it took no MT expertise to get there.**

When the numbers disappoint (they will, the first time), go to
[Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training) —
it is symptom-first, written for exactly that moment.
