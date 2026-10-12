---
sidebar_position: 0
title: "So You Want to Train Your Own Model"
description: An agent-forward, end-to-end walkthrough of training a low-resource translation model with nmt-forge — from python3 -m pip install to a model served to the champollion CLI. You direct a coding agent; the guardrails catch the amateur mistakes automatically.
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# So You Want to Train Your Own Model

This is a complete walkthrough of training a machine-translation model for a
low-resource language — from "I speak this language and there's barely any data"
to a model you can honestly report, serve to your own app through the
champollion CLI, and submit to the [Network](/docs/network/). Training is one
step of a longer journey (find what exists, measure the options, build
something better, prove it, deploy it); [Build MT for Your
Language](/docs/build-mt-for-your-language) is the overview of all of it.
It is written for newcomers, and it assumes the modern way of doing this work:
**you direct a coding agent** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity, or similar), and the agent runs the tools.

So each step below has the same shape:

- 🗣️ **Tell your agent** — what to ask for, in plain language.
- 🛠️ **What the tool does** — what [nmt-forge](/docs/network/getting-started/training-honestly)
  runs on your behalf, and the **guardrail** that catches the classic mistake
  before it can cost you.
- 👀 **How to read the result** — what "good" looks like and what to worry about.

:::info[First, the vocabulary]
If terms like *dev set*, *decoding*, *chrF++*, *leakage*, or *round-trip
verification* aren't second nature yet, read
[**MT Training in Plain Language**](/docs/network/context/mt-training-concepts)
first — it defines every word used here with a worked example. This page will
lean on all of them.
:::

:::note[Honesty is the feature, not the friction]
The tool is opinionated on purpose. Its guardrails mechanize real, measured
mistakes that a real project made — so the honest path is the default, and the
dishonest shortcuts **refuse with a message that names the fix**. Where you see
a refusal in this guide, that's the tool doing its job. You want it to.
:::

---

## What you need before you start

- **A coding agent** with a terminal and filesystem access. That's the driver.
- **Some real translated sentences** for your language pair — even a few
  hundred human-made pairs is a viable start. Bilingual textbooks, community
  archives, translated public records, educational material. Quality over
  quantity.
- **Optional but powerful:** monolingual text in your target language, a
  bilingual dictionary, a published reference grammar, and a morphological
  analyzer (FST). You do **not** need all of these to begin — the tool tells
  you exactly which are present and which unlock which capabilities.
- **Compute:** a laptop. The guardrails, splitting, synthesis, auditing and
  scoring all run on a CPU, and so does training the default model (a small
  transformer trained from scratch). A GPU only matters if you choose the
  largest preset (`nllb-600m`) — see [Step 5](#step-5--train).

> 🗣️ **Tell your agent:** *"Install nmt-forge with its training extra
> (`python3 -m pip install 'nmt-forge[hf]'`) and confirm the `nmt-forge` command runs.
> We're going to train an English → \<your language\> translation model,
> honestly."*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

The `[hf]` extra is the training stack (torch, transformers, accelerate,
tokenizers, sentencepiece, peft); CPU-only wheels are fine. Nothing else is
needed — no clone of the Champollion repository. Every command takes `--json`
(one JSON document on stdout; a refusal comes back as `{"error": {…, "why",
"fix"}}` with exit code 2), and `nmt-forge status` names the next command at
any point.

Your agent can call the Champollion MCP server's `get_training_guardrails` tool (no arguments; optional `topic`)
to load the full rulebook — the ten guardrails and the mistake each one kills —
into its own context before it writes any commands. If you're driving an agent,
ask it to do that first.

---

## Step 1 — Pick a language and see what actually exists

Every project starts by asking the index what the language *has*, honestly.

> 🗣️ **Tell your agent:** *"Run `nmt-forge discover` for my target language's
> ISO 639-3 code and summarize what data exists and what's missing."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **What the tool does.** It reads the language's Champollion **card** — the
single source of truth for what's known about that language — and reports the
scripts, morphological analyzers, dictionaries, corpora, and eval datasets it
records, then places the language on the **asset ladder**. (Cards come from a
directory you name with `--cards-dir`, a local checkout or
`node_modules/champollion`, or the public card index — cached, so it works
offline after the first fetch. Offline with no cache, export the card with
`champollion network card <code> --json` into a directory and pass `--cards-dir`.)

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **How to read the result.** The `✓` marks are what you can do now; the `?`
marks are rungs waiting on an asset. Crucially, **absence on a card means
*unknown*, never "this language has nothing."** A sparse card is an invitation
to add what you know, not a dead end — and even a bare card gets you the full
guarded training loop on rung 1. A rich card (like Plains Cree) wires the upper
rungs automatically: its eval sets arrive flagged **NEVER TRAIN ON THIS**, and
its language-specific referee comes ready to plug in. Rung 5 is ticked only when
that referee's package is installed here; otherwise it reads ✗ *UNAVAILABLE*
with the install command — and the referee is never loaded for a local-only or
sealed test set, because it can look words up on an outside service.

Then scaffold a project:

> 🗣️ **Tell your agent:** *"Scaffold a project with `nmt-forge init` for this
> language pair and read me the `NEXT_STEPS.md` it generates."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ This creates a workspace (a `.forge/` directory that every guardrail
consults), a **starter config**, and a `NEXT_STEPS.md` brief written for *you
and your agent* — the command order, the asset ladder for your language, and
the non-negotiables. It's the map for everything below. The config's paths are
relative, so run forge from inside the project directory.

`init` also picks the **model** you will train (`--model`, written out as
explicit numbers in `config.json`): `cpu-tiny` by default, `cpu-finetune --base
<hf-id>`, or `nllb-600m`. [Step 5](#step-5--train) explains the choice. If your
language has no card yet, `nmt-forge init <code> --no-card --name "<name>"`
still scaffolds the project — every card fact is recorded as unknown, nothing
is invented.

---

## Step 2 — Point at an analyzer and dictionary (if you have them)

This step is about **rungs 3–4** of the ladder. If your language has no
analyzer, skip to [Step 4](#step-4--split-your-real-data-safely) — you'll train
on real (and backtranslated) data alone, which is a completely legitimate path.

If an analyzer and dictionary *do* exist, they unlock the ability to
*manufacture* verified training data — the single biggest lever for a language
with little parallel text.

> 🗣️ **Tell your agent:** *"The card lists a morphological analyzer and a
> dictionary for this language. Fetch them per the install instructions on the
> card, point the language pack at them via the documented environment
> variables, and confirm the analyzer round-trips a few known words."*

🛠️ **What the tool does — and a boundary it will not cross.** Analyzers (FSTs)
and dictionaries are **separate, user-fetched tools under their own licenses**.
The suite **never bundles or redistributes them** — it points you at where they
come from and what their license is, and you fetch them. This isn't
bureaucracy: many language resources carry real permission and sovereignty
constraints, and the tool respects them by construction.

The connective tissue is a **language pack**: a small plugin that adapts *your*
analyzer, dictionary, orthography rules, and grammar-cited sentence templates to
the engine. The suite ships **no** packs itself — packs live with their
languages (the Plains Cree pack, for instance, lives in its own project and
plugs in by module path).

👀 **How to read the result.** You want the analyzer to **round-trip**: spell a
form, feed the spelling back, get the same grammatical tags. If it doesn't, the
pack's **canonicalizer** — the one function that normalizes spelling wherever
two components meet — probably needs a rule. Getting this right matters: a
single unreconciled character (`ý` vs `y`) once silently deleted 1,375 verbs
from a generation pipeline for weeks. The tool's **funnel audit** counts
survivors at each stage precisely so a silent drop like that can't hide.

---

## Step 3 — Synthesize training data from grammar rules

With an analyzer + dictionary + a pack of grammar-cited templates, you can
manufacture hundreds of thousands of verified pairs.

> 🗣️ **Tell your agent:** *"Generate synthetic training data with
> `nmt-forge synth` using our language pack, then show me the coverage report."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **What the tool does — the emit law.** Every row that reaches the output
must satisfy rules no pack can opt out of:

- **Round-trip verified** — every generated word passes *generate → analyze →
  same analysis*, or the row is discarded. No unverified form is ever emitted.
- **Grammar-cited** — every template kind cites the published grammar it
  transcribes. Uncited templates don't exist; the code refuses to load them.
- **Coverage-checked** — templates are accounted against a checklist of
  required grammatical phenomena (imperatives, questions, possession, inverse
  forms…). If a *required* phenomenon has zero examples, the build fails. This
  is the guard against the "a million sentences, all the same few shapes"
  trap — volume that hides structural holes.
- **Provenance-stamped** — every synthetic row is marked `synthetic: true`.
  That stamp is load-bearing: the registry will **refuse** to register
  synthetic rows as a test set. Tests are real data only.

👀 **How to read the result.** Look at the coverage report for **zero-coverage
required items** (a grammar phenomenon your templates never produced) and at the
**kind distribution** — if two template shapes dominate, the sampler's per-kind
cap (default 15%) will rebalance them so no single pattern becomes half the
model's experience.

:::tip[No analyzer? Use backtranslation instead]
If you can't synthesize from rules but you have **monolingual** target-language
text, ask your agent to use the **backtranslation** lane: it machine-translates
your monolingual text *into* English with a reverse model you supply and pairs
each result with the **real** target sentence. The target side stays authentic.
It is a Python library call (`nmt_forge.training.backtranslation.backtranslate`),
not a CLI subcommand: your agent writes a short script around it and adds the
tagged output file to the config's `data.synthetic` lanes. The call
**leak-audits the monolingual text first** — because that text can secretly *be*
your eval data. See the
[Back-Translation cookbook](/docs/network/tutorials/back-translation).
:::

---

## Step 4 — Split your real data safely

Now take your **real** pairs and set aside the sentences you will judge
everything by. This is where the most results-destroying mistake in
low-resource MT hides, and where the guardrail earns its keep.

Your files can be `.tsv` (source, a TAB, then the translation, one pair per
line; lines starting with `# ` are comments) or `.jsonl` (`{"source": …,
"target": …}` per line).

**If you already have a test set** — teacher-checked, nurse-checked, private —
keep it a separate file, register it, screen the corpus against it, and carve
only train and dev:

> 🗣️ **Tell your agent:** *"Register our test set, leak-audit the corpus
> against it, then split the cleaned corpus into train and dev with
> `nmt-forge split`, group-disjoint, with a fixed seed."*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**If you don't**, carve the test set from the corpus in the same step:

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **What the tool does — the split-guard.** It does **group-disjoint
splitting**: every pair sharing a source *or* a target is tied into one group,
and each whole group lands entirely on one side. Then it **verifies zero
overlap** and refuses to continue if any exists:

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

This kills the **"Feed him" / "Feed her" leak**: a textbook maps both English
drills to one target word (`asam`); a naïve random split puts one copy in train
and its twin in test, so the model "passes" by memory. In one real project 17
of 54 test rows leaked this way and scored 83 vs 44 for clean rows — and every
finding built on that number was void. `--register project` records the dev
set (and the test set, when carved) as `project-dev` / `project-test` — the
names the starter config already points at — so every later command knows they
are *eval sets you must never train on*. When a test set is already
registered, `split` also screens the fresh train and dev files against it on
the spot.

🛠️ **And the leak-audit.** `leak-audit` screens rows against every registered
eval set and says, with examples from your own corpus, what it would **drop** —
a row whose source is identical to a test prompt (even if its translation
differs), a row whose target is identical to a test answer, and a row whose
target is a near-duplicate of a test answer (it contains the answer, is a
fragment of it, or is at least 90% identical with accents folded) — and what it
**keeps on purpose**: *template siblings* that share a sentence frame but swap
a word (*"I see the dog"* / *"I see the cat"*), and near-duplicate prompts with
a different answer. The test rows that have a template sibling in training are
listed, and — because the starter config sets `eval.near_dupe_corpus` to your
training file — the final report scores the test rows *without* a sibling
separately, as a "(strict)" score, so the optimism the siblings add is
visible. When most test rows have a sibling and the test set is fixed,
`--clean-to <file> --drop-test-twins` also removes those training twins (it
reports the strict subset before and after, and refuses to empty training).
Give it a file of its own (`corpus.notwins.jsonl`): it is the twin-free
model's corpus, beside the all-data one, and leak-audit refuses to write
over a file a config, a run or a split already reads.
The result is deterministic, and the test
file's own text is never printed.

👀 **How to read the result.** You want to see the **verified: 0 shared** line.
If instead you get a `SplitLeakageError`, don't hand-delete rows — that just
reshuffles the problem. Re-run the group-disjoint split; that's the fix, and the
error message says so.

:::danger[Never train on a benchmark]
If you pull an evaluation dataset from the shared registry (`nmt-forge registry
add-harness`), the tool stamps it and treats it as off-limits for training —
**every** registry benchmark is flagged *do-not-train*. Fine-tune on whatever
you legitimately can; just never on the test set. This is
[the one rule](/docs/network/leaderboard/rules) of the whole Network.
:::

---

## Step 5 — Train

One config file describes the whole run; one command executes it,
reproducibly. `nmt-forge init` already wrote it.

> 🗣️ **Tell your agent:** *"Read `config.json`, add our synthetic lane if we
> made one, run `nmt-forge preflight run --config config.json`, fix anything it
> flags, then run `nmt-forge run config.json` and watch the schedule
> diagnostics."*

An excerpt of the starter config, with the default `cpu-tiny` model and a
synthetic lane added:

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**Which model?** Pick it when you run `init` (`--model`); every number lands in
`config.json`:

| preset | what it is | needs | honest expectation |
|---|---|---|---|
| `cpu-tiny` (default) | a small transformer (~6M parameters) trained from scratch; its vocabulary is learned from your **training** rows only | a laptop CPU, no download | weak: on 1–2 thousand pairs, chrF++ roughly 5–30 (the top end only for highly templated data) — your data's phrases and patterns, not general translation |
| `cpu-finetune --base <hf-id>` | fine-tunes a small pretrained Marian/opus-mt model that you name — choose one for a *related* language pair | a CPU, ~300 MB download | usually better than `cpu-tiny` when a related pair exists — measure it on dev, don't assume |
| `nllb-600m` | NLLB-200 distilled 600M with LoRA | a GPU, ~2.5 GB download | the strongest start; on a CPU the wall-clock check refuses it within minutes |

The point of `cpu-tiny` is not its score. It makes the **whole** loop real —
the fence, the audits, the preregistered test, a model the CLI can call — so a
better model later drops into the same project and is measured the same way.

`preflight` lists every gate the run will hit, ✓ or ✗, with the fix for each ✗
— including whether the training extra is installed
(`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`).

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **What the tool does — four guardrails at once.**

- **Leak-audit before training.** *Every* lane — gold, synthetic, and any
  backtranslated text — is screened against *every* registered test and sealed
  set. Answer leakage (identical prompts or answers, near-duplicate answers) and
  whole-file matches are fatal; template siblings are kept and reported
  (`--drop-test-twins` removes them for a fixed test set).
  Nothing trains until the mix is clean.
- **Dev-fence.** Training **refuses to start without a registered dev set**, and
  it will only ever select checkpoints on that dev set — never the test set.
  (It even content-checks the dev rows against the test sets, to catch the
  `cp test.jsonl dev.jsonl` trick.) Checkpoint selection can use dev **loss** or
  a dev **generation metric** — decode the dev set and score the real output,
  the more honest signal (the starter config uses chrF++ on decoded dev output).
- **Schedule-sanity.** If your mix is synthetic-heavy, the tool *derives* a
  stopping floor from the size of your mix and holds training through the
  **plateau** — the phase where the model has finished the easy synthetic
  learning and hasn't yet transferred to real quality. This prevents the
  "half-epoch death," where naïve early stopping quits at a twentieth of the
  plan. How often the dev set is evaluated is derived from the run's size too,
  so a small run is still evaluated. Every intervention prints the dev-loss
  trajectory and the reason, in plain language.
- **Exposure math + tagged synthetic.** Gold data is upweighted (repeated) so
  the little real data isn't drowned; the manifest writes down the **effective
  exposure per unique sentence** so an A/B stays fair. Synthetic sources carry a
  tag; gold stays untagged so it anchors output style.

Training is the one step that takes a while. Your agent should run it in the
background with output to a log file and watch for the lines that matter
(`refused`, `Error`, `wall-clock`, `RUN EXIT`) instead of polling. A live panel
with the loss curves and a stop button opens for **you** (at
`http://127.0.0.1:8377` when that port is free). In the first minutes, forge measures the training
speed and prints a wall-clock projection, first an early estimate, then a
steady-state one. `init` sets no time budget, because a budget is your number,
not one the tool invents. Read the projection, decide how long you accept,
and add `"time_budget_hours": <hours>` to `config.json` under `model`. From
then on forge refuses a run that cannot finish within it, so a mis-sized run
fails fast. Until you set one, only forge's safety ceiling applies: it stops
a run that would take days, and every projection prints it as "no budget set;
… ceiling", not as a budget anyone chose.

👀 **How to read the result.** The run prints a **dev report with confidence
intervals** — there is no bare-score output — and then the next command (the
numbers below are illustrative):

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

If you see a `schedule-sanity` message explaining that it *held* training past a
premature stop, that's the plateau guard working — good. The run also writes a
**manifest**: config hash, data file hashes, seeds, and the derived schedule, so
the whole run is reproducible.

---

## Step 6 — Evaluate honestly

You have a model. Before you score it on the test set, you write down what you
expect — *first*.

> 🗣️ **Tell your agent:** *"Write a preregistration for the test-set scoring —
> our predicted metric, direction and margin, with a one-line reason — then
> export the run, which scores the test set once."*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg` names the preregistration that judges this model. With one on the
test set, export finds it by itself; with a second model and its own
preregistration on the same test set, export refuses to guess, so name each.

(Preregistration can happen any time before the first test score — `nmt-forge
status` asks for it before training.)

🛠️ **What the tool does — the anti-storytelling guards.**

- **Preregistration.** Scoring a registered **test** set requires a
  preregistration written *before* the first look. A predictions file is a JSON
  array: each prediction names a metric and a rationale, plus either a direction
  against a baseline (checked automatically by `nmt-forge prereg check`) or a
  free-text expectation a person checks. The unedited template, Markdown, and
  prose are refused with the format and the fix. Without a preregistration,
  scoring simply **refuses**:

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  This is the guard against dressing up postdictions ("of course it improved on
  oral stories") as predictions. Writing down the guesses that *fail* is what
  makes the ones that succeed trustworthy.
- **Confidence intervals, always.** Every score renders with its 95% bootstrap
  CI; there is no CI-less output. A `+0.5` bump whose intervals overlap is not a
  win.
- **The eval-ledger.** Every read of every eval set is logged (append-only,
  tamper-evident). Ask `nmt-forge ledger show --set project-test` how "spent" a
  set is. **Sealed** sets are one-shot — scored once, then closed (a second
  `export` refuses; `--no-eval` packages without re-scoring).

`export` decodes the test set with the dev-selected checkpoint, scores it, and
appends a plain-language **Diagnosis & Recommendations** section. It also
writes the result as an **mt-eval report** (`export/evaluation/`), so `mt-eval
compare` sets your model beside any other method measured with the harness on
the same test set, and packages the model itself (Step 8) in `export/model/`,
which holds no test sentence. `export/evaluation/` contains your test
sentences: never copy it with the model, and keep it with the test set. `nmt-forge evaluate <run-manifest>` is the score-only half,
when you don't want a package.

👀 **How to read the result.** Read the number **with its interval and per
register**, look at the "(strict)" score if your training data shares sentence
templates with the test set, and check **which metric to believe** before you
celebrate. To score another system's output file on the same registered set,
with more metrics:

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` shows the **measured reliability** of each metric for your
language family (from the WMT meta-evaluations). For some families a metric like
BLEU barely tracks human judgment while COMET does; for many low-resource
families the honest answer is *unmeasured* — in which case native-speaker
judgment, not any automatic number, is the real signal. See
[Metric Reliability](/docs/network/specifications/metric-reliability).

:::tip[Your language's own referee]
If your language has a LYSS eval standard (a linter that knows, say, that two
spellings differ only by a documented long-vowel convention), plug it in with
`--plugin` and it scores alongside chrF++ — and can even *select* checkpoints,
so the model that wins is the one the language's own referee prefers. Every
plugin number gets a confidence interval too.
:::

---

## Step 7 — Iterate

Now you improve — and every improvement is measured the same honest way.

> 🗣️ **Tell your agent:** *"Change one thing — add a template kind / more
> backtranslated data / a different model preset — retrain, and A/B it against
> the previous run on the dev set, with significance."*

Each run already prints its dev score with a confidence interval. For a paired
test, decode the dev set with each run — `nmt-forge evaluate <run-manifest>
--config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` is a
copy of your config whose `eval.battery` is `project-dev` — then:

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **What the tool does.** `compare` runs a **paired significance test**, not
just a subtraction, so "B beats A" is a claim the statistics support — not
noise. Iterate on the **dev** set (that's what it's for); keep the **test** set
for infrequent, preregistered checks; keep any **sealed** set for the very end.

👀 **How to read the result.** A real improvement clears its confidence interval
*and* the significance test. If it doesn't, you learned something anyway — that
lever is weaker than you hoped, which is worth knowing. The plateau/coverage/
leak guards mean the numbers you're comparing are trustworthy, so you can
actually believe your own iteration loop.

Common next levers, roughly in order of payoff for a data-starved language:

1. **More real pairs** — on a few thousand sentences, every additional real
   pair counts for more than any setting.
2. **More coverage** in synthesis — add the missing grammar phenomena the
   coverage report flagged.
3. **Backtranslation** — turn monolingual target text into more training pairs.
4. **A stronger starting point** — `cpu-finetune` with a base model for a
   related pair, or `nllb-600m` on a GPU — measured against `cpu-tiny` on the
   same dev set.
5. **Curriculum** — pretrain on synthetic, then finetune on the real pairs.

---

## Step 8 — Put it to work, and take it to the Network

An honestly-trained model is something you can use today, and exactly what the
[Champollion Network](/docs/network/) is built to receive.

**Use it yourself.** `export` already packaged the model: a self-contained model
directory, `forge-model.json` (what it is and how it was measured), a
champollion plugin manifest (`method.json`), and `DEPLOY.md` with the exact
commands.

> 🗣️ **Tell your agent:** *"Serve the exported model and use it to translate
> our app's strings with the champollion CLI."*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` speaks the champollion **api method** contract (`POST /translate`) and
an **OpenAI-compatible** `/v1/chat/completions` — the second is what
`--method local` uses; `DEPLOY.md` has the `champollion.config.json` snippet for
the first. It listens on `127.0.0.1` only; exposing it on a network requires a
token (`--token` or `NMT_FORGE_SERVE_TOKEN`). An NMT model translates text and
ignores instructions, so tone prompts, coaching files and glossaries the CLI
sends to LLM methods have no effect on it — and its output needs a fluent
speaker's review before it reaches readers.

**Take it to the Network.**

> 🗣️ **Tell your agent:** *"Package this model as a method and submit it to the
> leaderboard for our language pair."*

- **[Submit a Method](/docs/network/getting-started/submit-a-method)** turns
  your model into a Network entry, scored on public reference corpora and
  attributed to you.
- Because your evaluation was clean — group-disjoint, dev-fenced, leak-audited,
  CI'd, preregistered — your submission survives the scrutiny that sinks most
  low-resource MT claims. The anti-gaming architecture (secret community-owned
  test sets, reproducibility checks, native-speaker validation) isn't an
  obstacle to a model built this way; it's a stamp of credibility.
- If a **prize** is open for your language, a standing, better-than-baseline
  method built honestly is exactly what a sponsored pool rewards. And when a
  method works for an Indigenous language, **ownership can transfer to the
  community** — you build it here and they deploy it, on their terms. See the
  [Prize Specification](/docs/network/specifications/prizes) and
  [Ownership Transfer](/docs/network/sovereignty/ownership-transfer).

---

## The whole arc, in one breath

1. **Discover** what the language has (`discover`, `init`) — absence is unknown, not zero.
2. **Point at** an analyzer + dictionary if they exist (rungs 3–4), respecting their licenses.
3. **Synthesize** verified, cited, coverage-checked training data (`synth`) — or **backtranslate** monolingual text.
4. **Split** real data group-disjoint, screen it against your test set, and register the eval sets (`registry add`, `leak-audit`, `split`).
5. **Train** one config — on a CPU by default — dev-fenced, leak-audited, plateau-aware (`preflight`, `run`).
6. **Evaluate** with predictions written first, CIs always, the right metric (`prereg`, `export`).
7. **Iterate** with significance-tested A/Bs (`compare`).
8. **Use** the model through the CLI (`serve`) and **submit** it to the Network — where honest work is the point.

You never had to memorize the ten ways low-resource MT results go wrong. The
tool made the honest path the default and refused the shortcuts with an
explanation. That's the whole idea: **the guardrails catch the amateur mistakes
so you can focus on the language.**

## Keep going

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — every term here, defined with an example.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — the ten guardrails on one page, each with its measured backstory.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) and [**Back-Translation**](/docs/network/tutorials/back-translation) — deeper cookbooks on specific techniques.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — building the real data everything else rests on.
