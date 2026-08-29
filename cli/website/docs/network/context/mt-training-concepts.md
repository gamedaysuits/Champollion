---
sidebar_position: 0
title: "MT Training in Plain Language"
description: A zero-background glossary of the vocabulary you need to train a translation model — each term defined with a worked example, written for people who direct a coding agent.
related:
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on walkthrough these words are for"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The suite that turns every rule here into a guardrail"
  - label: "MT Field Briefing"
    to: /docs/network/context/mt-field-briefing
    kind: doc
    note: "Broader context on where machine translation stands"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind error bars — why one number is never enough"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Which score to believe for your language"
---

# MT Training in Plain Language

Training a machine-translation (MT) model has its own vocabulary, and most of
it is never explained to newcomers — it's assumed. This page assumes nothing.
Every term below is defined in plain words and pinned to a concrete example,
so that when you read the [training walkthrough](/docs/network/tutorials/train-your-own-model)
or watch your coding agent run a command, you know what the words mean and,
more importantly, **which of them hide the mistakes that quietly ruin
results.**

:::info[Who this is for]
You do not need to write Python. The expected way to do this work now is to
**direct a coding agent** — Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity, or similar — that runs the tools for you. Your job is to
understand the concepts well enough to give good instructions and to read the
results honestly. That is exactly what this page is for. When we mention a
tool, we mean [**nmt-forge**](/docs/network/getting-started/training-honestly),
the training suite these ideas are built into; the words, though, are the
whole field's, not ours.
:::

A running example ties the page together. Suppose you want to build a model
that translates **English → a low-resource language** — call it your *target
language* — for which almost no translated text exists. Everything below is a
piece of that project.

---

## 1. The two piles: training data and evaluation data

**Parallel data** is text paired with its translation — the same meaning in
two languages, lined up sentence by sentence.

> `The children are playing.` → `awâsisak mêtawêwak.`

A model learns by studying thousands of such pairs. But you must keep the pairs
in **two piles that never touch**:

- **Training data** — the pairs the model is *allowed to study*. It reads
  these over and over and adjusts itself to reproduce them.
- **Evaluation data** (or **eval data**) — pairs the model is *never allowed
  to see during training*. You hide the translations, ask the model to
  translate the source side cold, and compare its answer to the hidden truth.
  This is the only honest measure of whether it learned to *translate* rather
  than to *memorize*.

:::tip[The one-sentence version of everything on this page]
A test only means something if the model has never seen the answers. Almost
every mistake below is a different way the answers leak from the eval pile into
the training pile without anyone noticing.
:::

### Real vs. synthetic parallel data

- **Real (or *gold*) parallel data** is human-made: a bilingual textbook,
  government records translated by people, community-archived stories. It is
  trustworthy but, for most languages, painfully scarce — often just a few
  hundred sentence pairs.
- **Synthetic parallel data** is *manufactured* by a program rather than
  written by a person. When you have only 400 real pairs, you cannot train a
  usable model — so you generate hundreds of thousands of extra pairs from
  rules (more on how in [§7](#7-manufacturing-data-when-you-dont-have-enough)).

The relationship matters enormously:

> **Worked example.** A project has 435 real English→Cree pairs and
> manufactures ~1,000,000 synthetic ones. The model trains on the big
> synthetic pile *plus* the few hundred real pairs. Synthetic data buys
> coverage; real data anchors the model to how the language is actually used.
> The whole craft is (a) making the synthetic pile cover as much of the
> language as possible, and (b) measuring only on real text the model never
> touched.

:::danger[Never test on synthetic data]
An evaluation set must be **real data only**. If you test on manufactured
sentences, you are measuring whether the model matches your *generator* — not
whether it can translate. A good training suite refuses to register synthetic
rows as a test set at all.
:::

---

## 2. Splitting: train, dev, and test

You start with one pile of real pairs and **split** it into three roles.

| Split | Also called | What it's for | Does the model see it in training? |
|---|---|---|---|
| **train** | training set | The pairs the model studies | Yes |
| **dev** | validation set, held-in | Deciding *when to stop* and *which version is best* | No (only *scored*, never studied) |
| **test** | held-out, evaluation set | The final honest grade | **Never** |

Two ideas hide in that table:

- **Held-out** just means "set aside and kept away from training." A test set
  is held out on purpose.
- The **dev set** is the clever middle child. The model never *studies* it, but
  you *peek* at how well the model does on it during training to make
  decisions — like a practice exam that tells you whether to keep studying,
  without being the real exam. Using the dev set this way is legitimate;
  using the *test* set this way is cheating (see [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).

### Sealed sets and re-splits

- A **sealed set** is a test set that may be scored **exactly once**. The
  moment you look at your score on it, it is "spent" — because once you know
  the number, every later decision you make is subtly shaped by it. Sealed
  sets are how competitions and communities keep a final grade truly final.
- A **re-split** is when you rebuild the train/dev/test division from scratch —
  usually because you discovered the old split was contaminated. You cannot
  fix a leaky split by deleting a few rows; you regroup everything and carve
  again ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results) explains why).

---

## 3. What "training" actually does: loss, and its two faces

Training is a loop. The model makes a prediction, sees how wrong it was, and
nudges its internal numbers to be a little less wrong next time — millions of
times over.

**Loss** is the single number that measures "how wrong." Lower is better. But
there are *two* losses, and confusing them is a classic trap:

- **Training loss** — how wrong the model is on the pairs it is actively
  studying. This almost always keeps dropping, because the model can, in the
  limit, simply *memorize* the training pairs.
- **Dev loss** (validation loss) — how wrong the model is on the held-back dev
  set it is *not* studying. This is the honest signal. When dev loss stops
  improving while training loss keeps dropping, the model has stopped
  *learning the language* and started *memorizing the training set*.

> **Worked example.** After a while you see training loss at 0.8 and falling,
> but dev loss stuck at 1.9 and creeping *up*. That gap is the tell: the model
> is getting better at reciting its training pairs and no better — even worse —
> at translating anything new.

### Loss is a proxy. Decoding is the real thing.

Here is a subtlety that trips up nearly everyone. Loss measures whether the
model assigns high probability to the correct next word *when the correct
answer is already in front of it*. That is **not** the same as the model
actually producing a good translation on its own.

- **Decoding** (also *generation* or *inference*) is the model **actually
  translating**: given only the source sentence, it emits a target sentence
  word by word, with nothing to lean on.
- **Loss** is a cheap *proxy* computed during training. It correlates with
  quality, but imperfectly.

> **Worked example.** Two checkpoints have almost identical dev loss, but when
> you *decode* the dev sentences and score the actual translations, one is
> clearly more fluent. Loss couldn't see that difference; decoding could. This
> is why serious checkpoint selection decodes the dev set and scores the real
> output, rather than trusting loss alone.

:::note["Does dev loss track quality?" is an open question, not folklore]
You will hear confident claims that "eval loss lies." Treat that as
**undetermined**, not proven — much of that folklore came from contaminated
experiments. The honest position: dev loss is a useful, cheap signal; a dev
**generation metric** (decode, then score) is a more direct one. Prefer the
direct one for final decisions, and don't repeat "loss lies" as a fact.
:::

---

## 4. Contamination and leakage: the mistake that eats results

**Contamination** (or **leakage**) means eval answers have secretly ended up in
the training pile. The model then "aces the test" by memory, your score looks
great, and the result is worthless. This is the single most common way
low-resource MT results turn out to be fake — and the most important thing this
whole page is warning you about.

The classic, sneaky form is a **shared-target minimal pair**:

> **Worked example — "Feed him" / "Feed her".** A language textbook maps many
> different English drills onto **one** target word. *"Feed him"* and *"Feed
> her"* both translate to the same form, `asam`. A naïve random split drops
> *"Feed him"* → `asam` into **training** and *"Feed her"* → `asam` into the
> **test set**. The target answer, `asam`, is now in both piles. The model
> memorized `asam` from training and "gets it right" on the test — but it
> learned nothing. In one real project, 17 of 54 "test" rows leaked this way,
> and those rows scored **83** on the quality metric versus **44** for clean
> rows. Every finding built on that number had to be thrown out.

Leakage has several faces, and a proper **leak audit** checks for all of them:

- **Exact overlap** — the same source *or* the same target appears on both
  sides (the example above).
- **Near-duplicate overlap** — not identical, but a *reworded* version of a
  test sentence sits in training. Same-domain documents share paraphrases;
  exact matching misses these, so audits also measure word-overlap similarity.
- **Whole-file overlap** — someone accidentally trained on a copy of the test
  file itself. (This really happens: a "training" harvest turned out to *be*
  the gold textbook, 489 of 489 lines matching.)

### Group-disjoint splitting — the fix

You cannot fix leakage by deleting the offending rows one by one; the pattern
just reappears. The fix is **group-disjoint splitting**: before splitting, tie
together every pair that shares a source *or* a target into a **group**, then
send each *whole group* to exactly one side. Now `asam` and everything sharing
it live entirely in train *or* entirely in test — never both. After the carve,
you **verify zero overlap** and refuse to proceed if any remains.

:::tip[This is what "the split-guard" does for you]
When your agent runs the splitter, it does group-disjoint splitting by default
and verifies zero overlap automatically. You don't have to remember the "Feed
him / Feed her" trap — the tool makes committing it hard, and if you route
around it, it refuses with a message naming the fix.
:::

---

## 5. Overfitting, early stopping, and the plateau

**Overfitting** is what happens when a model keeps studying past the point of
learning and starts *memorizing*. Its training loss looks wonderful; its real
translation quality gets worse. The [§3](#3-what-training-actually-does-loss-and-its-two-faces)
loss gap is how you spot it.

**Early stopping** is the defense: watch the dev signal, and when it stops
improving for a set number of checks (its **patience**), stop training and keep
the best earlier version — the best **checkpoint** (a saved snapshot of the
model partway through training). Early stopping prevents wasted compute and
overfitting at once.

But early stopping has a famous failure mode when you train mostly on synthetic
data — the **synthetic→real transfer plateau**:

> **Worked example — the half-epoch death.** A model trains on a mix that is
> 97.5% synthetic and is judged on a *real* dev set of 42 sentences. Early on,
> the model rapidly gets good at the synthetic mass, so dev loss on the real
> sentences drops fast, bottoms out around step 8,000 — then drifts *upward*.
> Naïve early stopping sees "dev loss rose for 6 checks in a row" and declares
> victory at epoch 0.52, a twentieth of the planned training. But the model was
> not done; it had merely finished the *easy* synthetic learning and had not
> yet begun the slow **transfer** to real-language quality. It was stopped at
> the plateau, before the payoff.

The lesson: with a synthetic-heavy mix, an *early* dip-and-rise in dev loss is
**expected**, not convergence. The stopping rule has to be smart enough to hold
training through the plateau — a floor derived from the size of your mix, not a
magic number you're supposed to know.

:::note[Honest setups surface real bugs]
That plateau bug was invisible for months — because earlier runs had
(illegitimately) used the *test* set as their dev set, which hid it. The first
*clean* run is what exposed it. This is the recurring theme: doing it honestly
doesn't just keep you truthful, it makes real problems visible.
:::

---

## 6. Measuring quality: metrics, batteries, registers

When the model *decodes* a test sentence, how do you score its answer against
the reference translation?

### Partial-credit metrics: chrF++ and BLEU

A translation is rarely exactly the reference word-for-word, yet it can be
perfectly good. So MT uses **partial-credit** metrics that reward *overlap*
rather than demanding an exact match:

- **chrF++** scores overlap of **character sequences** (plus some word
  sequences) between the model's output and the reference. Because it works at
  the character level, it gives partial credit for getting a word *almost*
  right — the correct stem with a wrong ending still earns something. That
  makes it well suited to morphologically rich languages, where one root takes
  many forms. Higher is better; it's usually reported on a 0–100 scale.
- **BLEU** is the older standard. It scores overlap of **whole-word** chunks
  (n-grams). It's still widely reported, but it's harsh on languages where
  words have many inflected forms, because a near-miss on an ending counts as a
  full miss.

> **Worked example.** Reference: `awâsisak mêtawêwak`. Model output:
> `awâsisak mêtawêw` (right root, wrong final syllable). BLEU sees the second
> word as simply wrong. chrF++ sees that most of the characters match and
> awards partial credit. Same output, very different score — which is why the
> metric you choose changes the story.

:::tip[Which metric to believe is a measured question]
Not every metric tracks human judgment equally for every language. For some
families BLEU barely correlates with what humans think; for others a fancy
neural metric is the unreliable one. Before you optimize toward *any* metric,
check the [Metric Reliability](/docs/network/specifications/metric-reliability)
evidence for your language family — and if the honest answer is "unmeasured,"
say so rather than trusting a number.
:::

### Neural metrics: COMET, MetricX

Beyond character/word overlap, **neural metrics** (COMET, COMET-QE, MetricX)
use a trained model to *judge* translations more like a human would. They can
be far more reliable — but only for languages they were trained to judge, which
excludes most low-resource ones. They also run direction-dependently:
**MetricX** is **lower-is-better**, the opposite of chrF++ — a detail worth
knowing before you compare numbers.

### Error bars: never trust one number

A single score with no uncertainty is a trap. On small test sets, differences
are often just noise.

> **Worked example.** "The model improved from 16.7 to 18.1 on the oral-story
> set" sounds like progress — until you notice the set has 37 sentences. With
> that little data, a ±3-point swing is pure chance. The honest report is
> `17.4 [15.1, 19.8] 95% CI`: the number, plus the **confidence interval (CI)**
> — the range the true value plausibly falls in. If two models' intervals
> overlap heavily, you cannot claim one is better.

Good tooling refuses to print a score without its CI, and uses a
[significance test](/docs/network/specifications/significance) before declaring
an A-beats-B win.

### Batteries and registers

Real language isn't one flat thing. A **register** (or **domain**) is a *kind*
of language: casual conversation, a textbook drill, a news article, an oral
story, formal government prose. A model can be great at one and poor at another.

A **battery** is an evaluation set deliberately split into several registers,
scored **separately**, so a single average can't hide a weakness.

> **Worked example.** A model scores 46 overall — respectable. But the battery
> breakdown shows 58 on textbook drills and 22 on oral stories. The average
> was masking a near-total failure on natural speech. Only the per-register
> battery revealed it.

---

## 7. Manufacturing data when you don't have enough

When real pairs are scarce, you manufacture synthetic ones. Two techniques
dominate, and both live or die on one word: **verification**.

### FSTs and morphological analyzers

A **morphological analyzer** is a tool that knows a language's word-grammar:
how roots combine with prefixes and suffixes to make valid words. Many are
built as **FSTs** — *finite-state transducers*, a precise, rule-based
technology (not a neural network) that can run in two directions:

- **analyze**: given a word, break it into root + grammatical tags
  (`nipâw` → "sleep, 3rd-person singular").
- **generate**: given a root + tags, spell the correct word form
  (`sleep + 3sg` → `nipâw`).

For a polysynthetic language — where a single word can carry what English needs
a whole sentence for — an FST is gold: it can spell *any* valid form of *any*
known root, which is exactly the raw material for manufacturing training data.

### Round-trip verification — the rule that makes synthetic data trustworthy

Manufacturing data is dangerous: a generator can silently emit nonsense. The
discipline that prevents it is the **round-trip law**: every manufactured word
must survive *generate → analyze → same analysis you started from*. If you ask
the FST to spell a form and then feed that spelling back and don't get your
tags returned, the word is discarded. Nothing that fails the round trip is ever
allowed into the training data.

> **Worked example — the one-character leak.** A dictionary spelled a sound
> with the letter `ý`; the analyzer expected plain `y`. Because nobody
> reconciled the two spellings at the boundary, *1,375 verbs* were silently
> judged "unknown" and dropped from generation — for weeks, invisibly. The fix
> is a **canonicalizer**: one function that normalizes spelling to a single
> convention *everywhere* two components meet, plus a **funnel audit** that
> counts how many items survive each pipeline stage so a silent 1,375-item drop
> can never hide again.

### Coverage, not just volume

A million manufactured sentences sound comprehensive. They aren't, if they're a
million variations of the same few shapes.

> **Worked example.** A 1,000,000-pair synthetic corpus turned out to contain
> **no imperatives** ("Vote!"), **no wh-questions** ("who/where/when"), **no
> possession** ("my dog"), and **no inverse forms** ("she sees *me*" — core
> grammar in many languages). The analyzer could generate all of them; the
> templates just never asked. Volume hid a structural hole.

The defense is a **coverage checklist** transcribed from a published grammar:
the required grammatical phenomena, each cited, so the build fails if a required
one has zero examples. And a **per-kind cap** stops any one template shape from
dominating — in one corpus, two shapes were 54% of the data, so half the
model's "experience" was two sentence patterns.

### Backtranslation

**Backtranslation** is the other big synthetic technique, and it's clever. If
you have plain, *untranslated* text in your target language (a **monolingual**
corpus — much easier to find than parallel text), you can:

1. take a *reverse* model (target → English),
2. machine-translate your monolingual target text *into* English,
3. pair each machine-English sentence with the **real** target sentence you
   started from, and
4. train your forward (English → target) model on those pairs.

The target side is genuine language; only the English side is synthetic —
usually a good trade.

> **Worked example.** You have 50,000 real sentences in your target language
> but only 400 parallel pairs. Backtranslate the 50,000 into rough English, and
> you've turned monolingual text into 50,000 training pairs whose *target* side
> is authentic.

:::danger[Leak-audit your monolingual text too]
Backtranslation feels safe because "it's just monolingual text" — but that text
can *be* your eval data in disguise. In one project the leak audit caught a
monolingual harvest that exactly matched the gold test set. Audit **every**
input against **every** eval set, synthetic and monolingual included — not just
your obvious parallel corpus.
:::

### Tagging synthetic data

One last practice: **tag** synthetic sources with a marker (like `<synth>` or
`<bt>`) and leave real (gold) data untagged. This lets the model tell "practice
material" from "the real thing," so the authentic data anchors its output
style; at translation time you don't add the tag, and the model leans on what it
learned from gold. (See the [Back-Translation cookbook](/docs/network/tutorials/back-translation)
for this technique in depth.)

---

## 8. How the pieces connect

Read top to bottom, this is one workflow:

1. Gather **real parallel data** ([§1](#1-the-two-piles-training-data-and-evaluation-data)) — usually too little.
2. **Split** it group-disjoint into train / dev / test ([§2](#2-splitting-train-dev-and-test), [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).
3. **Manufacture** synthetic data to fill the gap — round-trip-verified, coverage-checked, leak-audited ([§7](#7-manufacturing-data-when-you-dont-have-enough)).
4. **Train** on the mix, watching **dev loss / dev generation** to avoid **overfitting** and to survive the **plateau** ([§3](#3-what-training-actually-does-loss-and-its-two-faces), [§5](#5-overfitting-early-stopping-and-the-plateau)).
5. **Decode** the held-out **test battery** and score it with **partial-credit metrics + confidence intervals**, per **register** ([§6](#6-measuring-quality-metrics-batteries-registers)).
6. Do all of it without ever letting eval answers touch training ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)) — the rule the other five serve.

Every rule here corresponds to a real, measured mistake that a real project
made and documented. You don't have to memorize them: the training suite
mechanizes each one so the honest path is the default and the dishonest paths
refuse with an explanation. That is the subject of the next page.

## Directing your agent with this vocabulary

Because you'll be working through a coding agent, the practical payoff of this
page is that you can now give — and check — instructions like these:

- *"Split the corpus group-disjoint and verify zero overlap before training."*
- *"Carve a dev set from the training side; never select checkpoints on the test set."*
- *"Leak-audit every input against every eval set, including the synthetic and monolingual data."*
- *"Report chrF++ with 95% confidence intervals, broken down by register."*
- *"Check metric reliability for this language family before we optimize toward any score."*

If your agent has the Champollion MCP server available, it can call
`get_training_guardrails` to pull these rules — and the mistake each one
kills — directly into its context before it writes a single command.

**Next:** put it to work in
[**So You Want to Train Your Own Model**](/docs/network/tutorials/train-your-own-model),
the step-by-step walkthrough — or read
[**Train a Model Honestly**](/docs/network/getting-started/training-honestly)
for how the suite turns every concept here into an automatic guardrail.

If terms like *tokenizer* are still fuzzy, the from-zero primer is [Tokenizers](/docs/learn/tokenizers) — read it once and everything above gets easier.
