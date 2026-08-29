---
sidebar_position: 0
title: "So You Want to Train Your Own Model"
description: An agent-forward, end-to-end walkthrough of training a low-resource translation model with nmt-forge — you direct a coding agent, the guardrails catch the amateur mistakes automatically.
related:
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
to a model you can honestly report and submit to the [Network](/docs/network/).
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
- **Compute:** the guardrails, splitting, synthesis, auditing, and scoring run
  on a laptop. Only the actual model-training step wants a GPU (and a small
  model with LoRA fits on modest hardware).

> 🗣️ **Tell your agent:** *"Install nmt-forge from the Champollion monorepo's
> `forge/` package and confirm the `nmt-forge` command runs. We're going to
> train an English → \<your language\> translation model, honestly."*

Your agent can call the Champollion MCP server's `get_training_guardrails` tool
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
records, then places the language on the **asset ladder**:

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
its language-specific referee comes ready to plug in.

Then scaffold a project:

> 🗣️ **Tell your agent:** *"Scaffold a project with `nmt-forge init` for this
> language pair and read me the `NEXT_STEPS.md` it generates."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ This creates a workspace (a `.forge/` directory that every guardrail
consults), a **starter config**, and a `NEXT_STEPS.md` brief written for *you
and your agent* — the command order, the asset ladder for your language, and
the non-negotiables. It's the map for everything below.

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
text, ask your agent to run the **backtranslation** lane: `nmt-forge
backtranslate` machine-translates your monolingual text *into* English and pairs
each result with the **real** target sentence. The target side stays authentic.
The tool **leak-audits the monolingual text first** — because that text can
secretly *be* your eval data. See the
[Back-Translation cookbook](/docs/network/tutorials/back-translation).
:::

---

## Step 4 — Split your real data safely

Now take your **real** pairs and divide them into train / dev / test. This is
where the most results-destroying mistake in low-resource MT hides, and where
the guardrail earns its keep.

> 🗣️ **Tell your agent:** *"Split the real corpus into a test and dev set with
> `nmt-forge split`, group-disjoint, and register them. Use a fixed seed so
> it's reproducible."*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **What the tool does — the split-guard.** It does **group-disjoint
splitting**: every pair sharing a source *or* a target is tied into one group,
and each whole group lands entirely on one side. Then it **verifies zero
overlap** and refuses to continue if any exists.

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

This kills the **"Feed him" / "Feed her" leak**: a textbook maps both English
drills to one target word (`asam`); a naïve random split puts one copy in train
and its twin in test, so the model "passes" by memory. In one real project 17
of 54 test rows leaked this way and scored 83 vs 44 for clean rows — and every
finding built on that number was void. `--register textbook` records the dev and
test sets (as `textbook-dev` and `textbook-test`) in the workspace so every
later command knows they are *eval sets you must never train on*.

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
reproducibly.

> 🗣️ **Tell your agent:** *"Fill in the training config — point `dev` at our
> registered dev set, list the gold and synthetic data lanes, pick a small base
> model with LoRA — then run `nmt-forge run` and watch the schedule diagnostics."*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **What the tool does — four guardrails at once.**

- **Leak-audit before training.** *Every* lane — gold, synthetic, and any
  backtranslated text — is screened against *every* registered eval set. Exact
  hits, near-duplicate (reworded) hits, and whole-file matches on a test set are
  fatal. Nothing trains until the mix is clean.
- **Dev-fence.** Training **refuses to start without a registered dev set**, and
  it will only ever select checkpoints on that dev set — never the test set.
  (It even content-checks the dev rows against the test sets, to catch the
  `cp test.jsonl dev.jsonl` trick.) Checkpoint selection can use dev **loss** or
  a dev **generation metric** — decode the dev set and score the real output,
  the more honest signal.
- **Schedule-sanity.** If your mix is synthetic-heavy, the tool *derives* a
  stopping floor from the size of your mix and holds training through the
  **plateau** — the phase where the model has finished the easy synthetic
  learning and hasn't yet transferred to real quality. This prevents the
  "half-epoch death," where naïve early stopping quits at a twentieth of the
  plan. Every intervention prints the dev-loss trajectory and the reason, in
  plain language.
- **Exposure math + tagged synthetic.** Gold data is upweighted (repeated) so
  the little real data isn't drowned; the manifest writes down the **effective
  exposure per unique sentence** so an A/B stays fair. Synthetic sources carry a
  tag; gold stays untagged so it anchors output style.

👀 **How to read the result.** The run prints a **dev report with confidence
intervals** — there is no bare-score output:

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
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
> our predicted metric, direction, and margin — then decode the test set and
> score it."*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **What the tool does — the anti-storytelling guards.**

- **Preregistration.** Scoring a registered **test** set requires a
  preregistration written *before* the first look. Without it, the comparison
  table simply **refuses to render**:

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  This is the guard against dressing up postdictions ("of course it improved on
  oral stories") as predictions. Writing down the guesses that *fail* is what
  makes the ones that succeed trustworthy.
- **Confidence intervals, always.** Every score renders with its 95% bootstrap
  CI; there is no CI-less output. A `+0.5` bump whose intervals overlap is not a
  win.
- **The eval-ledger.** Every read of every eval set is logged (append-only,
  tamper-evident). Ask `nmt-forge ledger show --set textbook-test` how "spent" a
  set is. **Sealed** sets are one-shot — scored once, then closed.

👀 **How to read the result.** Read the number **with its interval and per
register**, and check **which metric to believe** before you celebrate:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
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
> backtranslated data / a different base model — retrain, and A/B it against the
> previous run on the dev set, with significance."*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
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

1. **More coverage** in synthesis — add the missing grammar phenomena the
   coverage report flagged.
2. **Backtranslation** — turn monolingual target text into more training pairs.
3. **A bigger or better-suited base model**, or LoRA rank/hyperparameter tuning.
4. **Curriculum** — pretrain on synthetic, then finetune on the real pairs.

---

## Step 8 — Take it to the Network

An honestly-trained model is exactly what the [Champollion Network](/docs/network/)
is built to receive.

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
4. **Split** real data group-disjoint and register the eval sets (`split`).
5. **Train** one config, dev-fenced, leak-audited, plateau-aware (`run`).
6. **Evaluate** with predictions written first, CIs always, the right metric (`prereg`, `score`).
7. **Iterate** with significance-tested A/Bs (`compare`).
8. **Submit** to the Network — where honest work is the point.

You never had to memorize the ten ways low-resource MT results go wrong. The
tool made the honest path the default and refused the shortcuts with an
explanation. That's the whole idea: **the guardrails catch the amateur mistakes
so you can focus on the language.**

## Keep going

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — every term here, defined with an example.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — the ten guardrails on one page, each with its measured backstory.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) and [**Back-Translation**](/docs/network/tutorials/back-translation) — deeper cookbooks on specific techniques.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — building the real data everything else rests on.
