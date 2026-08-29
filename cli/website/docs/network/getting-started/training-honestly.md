---
sidebar_position: 2
title: Train a Model Honestly (nmt-forge)
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# Train a Model Honestly (nmt-forge)

**The 30-second version:** most low-resource MT "improvements" die on
re-examination — the test set leaked into training, the test set picked the
checkpoint, or the gain was noise with no error bars. **nmt-forge** is a
training suite that makes those mistakes structurally hard: its normal paths
do the right thing, and the wrong paths refuse with a message that says
*what* happened, *why* it corrupts results, and the exact *fix*. It trains;
the [eval harness](/docs/network/specifications/harness) scores. Every guard
in it mechanizes a mistake we actually made, measured, and documented while
building Plains Cree translation.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

That's the suite's whole personality in one refusal.

## The five-minute story

Here is the failure the suite was born from. A Cree textbook maps many
English drills to one target: *"Feed him"* and *"Feed her"* both translate
to `asam`. A standard random split put one copy in training and its twin in
the test set — so the model had literally seen 17 of 54 "test" answers, and
those rows scored 83 chrF++ against 44 for clean ones. Everything downstream
(the "champion" model, the findings built on it) had to be thrown out.

nmt-forge's splitter makes that impossible **by construction**: pairs sharing
a source *or* a target are grouped, whole groups land on one side, and a
zero-overlap verification runs after every carve:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Every other guard has the same shape — a real mistake, mechanized away:

| guard | the mistake it kills |
|---|---|
| **split-guard** | test answers hiding in training via shared sources/targets |
| **dev-fence** | the test set picking your checkpoint (training refuses to start without a registered dev set) |
| **leak-audit** | training on eval text — exact, reworded (Jaccard), or the whole file |
| **funnel-audit** | silent pipeline attrition (one orthography character once deleted 1,375 dictionary verbs, invisibly, for weeks) |
| **convention-lint** | training on mixed spelling conventions (the model then mixes them mid-sentence) |
| **coverage-map** | a million synthetic pairs with no imperatives, no questions, no possession — volume hiding structural gaps |
| **sample-strata** | two template kinds hogging half the training signal |
| **ci-scoring** | scores without error bars (every number renders with its 95% bootstrap CI — there is no bare-score output) |
| **schedule-sanity** | early stopping killing a synthetic-heavy run at half an epoch: with 97% synthetic data and an honest *real* dev set, dev loss bottoms early and drifts up — that's the model fitting the synthetic mass, not convergence. The stopping floor is derived from your mix automatically, and every intervention explains itself with the dev-loss trajectory. This one was found *by* a clean protocol — honest setups surface real bugs |
| **eval-ledger** | invisible adaptive use of eval data (every read is logged; sealed sets are one-shot) |
| **preregister** | postdictions dressed as predictions (no preregistration → no comparison table) |

## Any language, any assets — start from the card

nmt-forge is one tool for all ~8,700 languages in Champollion's index, and
it starts by asking the index what a language actually has:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

The `?` marks are the tool being honest: absence on a card means **unknown**,
never "this language has nothing." Every language climbs the same
**asset ladder** — (1) parallel text alone already gets the full guarded
training loop; (2) monolingual text adds backtranslation; (3) a dictionary
plus a published grammar makes a cited template pack worth building; (4) a
morphological analyzer unlocks verified synthesis; (5) a LYSS referee puts
the language's own metric into scoring and checkpoint selection. A rich card
(Plains Cree) wires rungs 4–5 automatically — eval sets arrive flagged
`NEVER TRAIN ON THIS`, and the referee's plugin lanes come ready to paste.

`nmt-forge init <code>` then scaffolds a project from the card: a workspace,
a starter config, and a `NEXT_STEPS.md` brief written for you *and your
agent* — ending at [Submit a
Method](/docs/network/getting-started/submit-a-method) once you have
something worth testing.

## Synthetic data you can defend

For languages with morphological analyzers (FSTs), forge manufactures
training data through **language packs** — and enforces an *emit law* no pack
can opt out of: every generated word must round-trip through the analyzer
(generate → analyze → same analysis), every template cites the published
grammar it transcribes, every plausibility filter is named and counted, and
every row is stamped `synthetic: true`. That stamp is load-bearing: the
registry **refuses synthetic rows in test sets**. Tests are real data only.

forge itself ships no language packs — it's a general-purpose tool. Packs
live with their languages and plug in by module path or entry point (the
Plains Cree pack lives in the crk-translate project):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Analyzers and dictionaries stay separate, user-fetched tools under their own
licenses — never bundled, never redistributed.

## Your language's own referee, in the loop

LYSS evaluation standards (per-language linters that know, say, that two
Cree spellings differ only by a documented long-vowel convention) plug into
every scoring surface — and into checkpoint selection, so the model that
wins is the one *the language's referee* prefers, not just chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

Every plugin number gets a confidence interval; a referee whose
prerequisites are missing reports *unavailable* rather than a fabricated
score.

The same is true of the **full harness metric stack** — nmt-forge speaks
everything the [eval harness](/docs/network/specifications/harness) speaks,
including the neural metrics (COMET, COMET-QE, MetricX), with inference run
once and confidence intervals bootstrapped from cached per-entry scores.
Before you select checkpoints on any automatic metric, `discover` shows the
[measured
reliability](/docs/network/specifications/metric-reliability) of each
metric for your language family — for Inuktitut, BLEU barely tracks human
judgment (r=0.16) while COMET does (r=0.86); for most low-resource families
the honest answer is *unmeasured*. The tool tells you which number to
believe before you optimize toward it.

## Where to go deeper

- **New to the vocabulary?** [MT Training in Plain
  Language](/docs/network/context/mt-training-concepts) defines every term —
  training vs. eval data, loss vs. decoding, leakage, chrF++, backtranslation,
  the plateau — with a worked example, written for zero background.
- **Ready to build?** [So You Want to Train Your Own
  Model](/docs/network/tutorials/train-your-own-model) is the step-by-step,
  agent-forward walkthrough: pick a language → gather data → synthesize → split
  → train → evaluate → iterate → submit, with each guardrail shown catching its
  mistake.
- **Train, then submit:** an honestly-trained model becomes a Network entry
  via [Submit a Method](/docs/network/getting-started/submit-a-method).
- **The error bars:** [Statistical Significance
  Testing](/docs/network/specifications/significance) is the math forge
  applies by default.
- **Which metric to trust:** check [Metric
  Reliability](/docs/network/specifications/metric-reliability) before
  selecting checkpoints on any automatic metric.
- **The full design** — every guard's measured backstory, the pack
  interface, the training-loop defaults — lives with the code in the
  repository (`forge/DESIGN.md`).
