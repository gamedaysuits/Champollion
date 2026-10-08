---
sidebar_position: 2
title: Train a Model Honestly (nmt-forge)
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
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
building Plains Cree translation. It installs with `python3 -m pip install
'nmt-forge[hf]'`, and its default model trains on a laptop CPU.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
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
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(If your test set is already a separate, registered file — a teacher-checked
set you keep private — `--test 0` carves only train and dev.)

Every other guard has the same shape — a real mistake, mechanized away.
Together they are the **training guardrails**: read them before you split
(`nmt-forge init` and `nmt-forge status` point here at that step; agents get
the same rules, with the measured mistake behind each, from the MCP tool
`get_training_guardrails`).

| guard | the mistake it kills |
|---|---|
| **split-guard** | test answers hiding in training via shared sources/targets |
| **dev-fence** | the test set picking your checkpoint (training refuses to start without a registered dev set) |
| **leak-audit** | training on eval text — an identical prompt (even with a different translation), an identical or near-duplicate answer, or the whole file. It also says what it *keeps* on purpose and why: template siblings that swap a word (*"I see the dog"* / *"I see the cat"*) are practice, not the answer, and are reported, not removed — unless every test row has one, when `--clean-to … --drop-test-twins` removes the training twins of a fixed test set. Deterministic: same corpus, same result |
| **funnel-audit** | silent pipeline attrition (one orthography character once deleted 1,375 dictionary verbs, invisibly, for weeks) |
| **convention-lint** | training on mixed spelling conventions (the model then mixes them mid-sentence) |
| **coverage-map** | a million synthetic pairs with no imperatives, no questions, no possession — volume hiding structural gaps |
| **sample-strata** | two template kinds hogging half the training signal |
| **ci-scoring** | scores without error bars (every number renders with its 95% bootstrap CI — there is no bare-score output) |
| **schedule-sanity** | early stopping killing a synthetic-heavy run at half an epoch: with 97% synthetic data and an honest *real* dev set, dev loss bottoms early and drifts up — that's the model fitting the synthetic mass, not convergence. The stopping floor is derived from your mix automatically, and every intervention explains itself with the dev-loss trajectory. This one was found *by* a clean protocol — honest setups surface real bugs |
| **eval-ledger** | invisible adaptive use of eval data (every read is logged; sealed sets are one-shot) |
| **preregister** | postdictions dressed as predictions (no preregistration → no test score, no comparison table; one predictions format, a JSON array — `nmt-forge prereg template` writes one to edit) |
| **score caveats** | quoting a score the eval harness qualifies — a *near-constant output* (one of a few sentences given to many different inputs: the outputs do not follow the inputs), outputs far longer or shorter than the references, copies of the source. forge computes none of these; it passes on every caveat the harness wrote, in the harness's words, beside the score — in the export summary, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` and `lint` — and never offers a qualified score as "the number to quote" without its caveat |

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
agent* with the exact command order. It works from a plain `pip install` —
cards are read from a directory you name, a local checkout, or the public card
index (cached for offline use) — and a language with no card yet gets a
project too (`--no-card --name "<name>"`), with every card fact recorded as
unknown rather than invented.

## From a laptop to a served model

The honest loop does not need a GPU. `init` writes one of three model presets
into the config, as explicit numbers:

| preset | needs | what to expect |
|---|---|---|
| `cpu-tiny` (default) — a small transformer trained from scratch, vocabulary learned from your training rows only | a laptop CPU, no download | weak by design: on 1–2 thousand pairs, chrF++ roughly 5–30 — your data's phrases and patterns, not general translation |
| `cpu-finetune --base <hf-id>` — a small pretrained Marian/opus-mt model you name, for a related pair | a CPU, ~300 MB download | usually better than `cpu-tiny` when a related pair exists — measure it |
| `nllb-600m` — NLLB-200 distilled 600M with LoRA | a GPU | the strongest start |

`cpu-tiny` is there to make the *whole* loop real on day one — the fence, the
audits, the preregistered test, a model the CLI can call — so that a better
model later drops into the same project and is measured the same way. After
training, two commands finish the job:

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export` scores the test set once (preregistration required, 95% confidence
intervals; `--prereg <id>` names the preregistration written for this model
with `nmt-forge prereg new <id>` — with two models on one test set, each
judged by its own, export refuses to guess), writes the result as an mt-eval
report that `mt-eval compare` reads, and packages a self-contained model with
a champollion plugin manifest and a `DEPLOY.md`. `serve` speaks the champollion api-method contract and an
OpenAI-compatible endpoint, so `champollion sync --method local` can translate
with it; it listens on localhost only unless you give it a token. Every command
takes `--json` for agents (one JSON document on stdout; refusals as
`{"error": {…, "why", "fix"}}`, exit 2). The full walk-through is
[Train Your First Model](/docs/network/getting-started/train-your-first-model);
once you have something worth testing,
[Submit a Method](/docs/network/getting-started/submit-a-method) turns it into
a Network entry.

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
  → train → evaluate → iterate → serve and submit, with each guardrail shown
  catching its mistake. [Build MT for Your
  Language](/docs/build-mt-for-your-language) puts training in the context of
  the whole journey — finding what exists, measuring the options, deploying.
- **Train, then submit:** an honestly-trained model becomes a Network entry
  via [Submit a Method](/docs/network/getting-started/submit-a-method).
- **The error bars:** [Statistical Significance
  Testing](/docs/network/specifications/significance) is the math forge
  applies by default.
- **Which metric to trust:** check [Metric
  Reliability](/docs/network/specifications/metric-reliability) before
  selecting checkpoints on any automatic metric.
- **Every command and flag:** the [forge Command
  Reference](/docs/network/getting-started/forge-command-reference),
  generated from the tool itself.
- **The failure taxonomy** — each mistake, a concrete example, and the guard
  that catches it — ships with the nmt-forge source. Agents get the same rule
  set from the MCP server's `get_training_guardrails` tool (optional `topic`), and every refusal
  carries its own what/why/fix.
