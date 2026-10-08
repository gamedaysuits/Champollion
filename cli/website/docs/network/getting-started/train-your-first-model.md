---
sidebar_position: 3
title: Train Your First Model (with your agent)
description: A step-by-step walkthrough for training a low-resource MT model by directing a coding agent — install, protect your test set, train on a laptop CPU, score once, and serve the model to the champollion CLI. What you say, what forge does, what a refusal looks like.
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
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

This page is the whole loop, from `pip install` to a model the champollion CLI
can call. Each step is written as **what you tell your agent**, **what forge
does**, **what a refusal looks like** (so neither of you panics when one fires —
a refusal is the tool working), and, at the end, **how to read the report**. It
is the forge part of steps 2 and 4 of [Build MT for Your
Language](/docs/build-mt-for-your-language), which covers what comes before
(finding what exists), in between (measuring the existing options) and after
(publishing, combining methods).

**The order matters.** Register your test set, screen your training data
against it, and write down your predictions (Steps 1–3) **before anything is
scored on the test set** — including the baselines step 3 of the guide
measures with `mt-eval run`. A benchmark is a scoring read: forge counts it,
and refuses a prediction written after one. Then split and train (Step 4).

:::tip The one rule for your agent
Tell it: *"Always run `nmt-forge status --json` first, and after every step.
Do whatever its `next_command` says."* That single habit turns forge into a
guided rail. Every forge command takes `--json`: exactly one JSON document on
stdout, and a refusal comes back as `{"error": {…, "why", "fix"}}` with exit
code 2. If your agent connects over MCP, the same loop is the `forge_status`
tool (`{ "project_dir": "<dir>" }`) — see the [Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Step 0 — Install, and point your agent at your language

**You say:** *"Install nmt-forge with its training extra. I want to train an
English→[your language] model. Start by discovering what forge knows about it.
The ISO 639-3 code is `crk`"* (use your language's code).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

The `[hf]` extra adds the training libraries (torch, transformers, accelerate,
tokenizers, sentencepiece, peft). CPU-only wheels are enough for the default
model. Plain `python3 -m pip install nmt-forge` gives you the guards, splits, audits and
scoring without training.

**forge does:** `nmt-forge discover crk` reads the language's card — scripts,
dictionaries, morphological analyzers, existing corpora and eval sets (with any
`do_not_train` / quarantine flags), and per-language referee metrics. You do not
need a copy of the Champollion repository: cards are found in a directory you
name (`--cards-dir`), a local checkout or `node_modules/champollion`, or the
public card index (cached, so it works offline afterwards). forge then places
your language on the **asset ladder**: (1) parallel text → guarded training;
(2) + monolingual → tagged backtranslation; (3) + dictionary/grammar → cited
synthetic data; (4) + analyzer → round-trip-verified synthesis; (5) + a referee
metric → the language's own metric in scoring and checkpoint selection.

**A blank field means UNKNOWN, never zero.** A sparse card is not "this language
has nothing" — it may just not record the resource yet. You can always bring
your own parallel corpus.

Then: *"Scaffold the project."*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

This writes a workspace (`.forge/`), a starter `config.json`, and a
`NEXT_STEPS.md` brief with the exact command order. **Run every later command
from inside the project directory** — the config's paths are relative to it.

The starter config uses the **`cpu-tiny`** model preset unless you pick another:

| `--model` | What it is | Needs | Expect |
|---|---|---|---|
| `cpu-tiny` (default) | a small transformer (~6M parameters) trained from scratch on your pairs; its vocabulary is learned from your training rows only | a CPU, no download | weak: on 1–2 thousand pairs, chrF++ roughly 5–30 (the top end only for highly templated data). It learns your data's phrases and patterns, not the language in general |
| `cpu-finetune --base <hf-id>` | fine-tunes a small pretrained Marian/opus-mt model that you name (pick one for a *related* language pair) | a CPU, ~300 MB download | usually better than `cpu-tiny` when a related pair exists — measure it on your dev set, don't assume |
| `nllb-600m` | NLLB-200 distilled 600M with LoRA | a GPU, ~2.5 GB download | the strongest start; forge's wall-clock check refuses it on a CPU within minutes |

The preset is written out as explicit numbers in `config.json` → `model`, so
nothing is hidden and changing a number makes a new, separately hashed run.

**No card for your language?** `nmt-forge init <code> --no-card --name "<name>"`
still scaffolds a project; everything a card would have said is recorded as
unknown, and nothing is invented.

---

## Step 1 — Set your test set aside, and register it {#step-1--set-your-test-set-aside-then-split}

**You say:** *"Here is my parallel corpus and, separately, the teacher-checked
test set. Keep the test set out of training, and register it before anything
is scored on it."*

Files can be `.tsv` (source, a TAB, then the translation, one pair per line;
lines starting with `# ` are comments) or `.jsonl` (`{"source": …, "target": …}`
per line). If the test set is private, mark it local-only **before** anything
reads it — your agent included:
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
forge then never prints its sentences.

**forge does — if you have your own test set** (the usual case for a school or
a clinic):

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

Registering starts the file's **read log** (`<file>.reads.jsonl`): from now on
every scoring of this file — by forge, or by `mt-eval run` / `mt-eval compare`
— is counted. That is why registration comes first: a benchmark run made
before it is listed at registration, but not counted.

**If you don't have a separate test set**, carve one from the corpus instead —
`nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split
--register project` registers `project-test` and `project-dev` in one step
(Step 4 explains the split) — and go on to Step 3.

`nmt-forge status` now names the next step: the predictions (Step 3), before
any benchmark — screen your corpus first (Step 2).

---

## Step 2 — Screen for leakage

**You say:** *"Before we train, check the corpus against the test set and tell
me what you would drop and why."*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forge does:** it screens every row against every registered dev/test/sealed
set. The same corpus and the same registered sets
always give the same result. It explains what it would **drop**:

- **Identical prompt** — the row's source sentence equals a test row's source
  (after ignoring case, punctuation and spacing). Dropped **even when the row's
  translation is different**: the model would still have practised on the exact
  test prompt.
- **Identical answer** — the row's target equals a test reference.
- **Near-duplicate answer** — the row's target shares at least 60% of its words
  with a test answer (accents folded, so spelling variants count) **and** either
  contains the whole answer, is a fragment of it, or is at least 90% identical.
  The model would be shown most of the answer.

…and what it **keeps on purpose**, reported but never removed:

- **Template siblings** — the row shares a sentence frame with a test answer
  but swaps a word each way (*"I see the dog"* / *"I see the cat"*). The model
  still has to produce the word it never saw in that frame. Templated textbook
  and school corpora are full of these. forge lists the test rows that have a
  sibling in training; because the starter config sets
  `eval.near_dupe_corpus`, the final report shows a **"(strict)"** score on the
  rows without one next to the full score.
- **Similar prompt, different answer** — the source is a near-duplicate (not an
  identical copy) of a test source, but the translation is different: a
  legitimate minimal contrast, not a leak.

Here is the report for a 12-row toy corpus screened against a 3-row test set
(trimmed; the toy sentences are English with a French-like target):

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

Line 3 has a *different* translation from the test row, and is still dropped:
its prompt is the test prompt.

Examples quote **your corpus** rows by line number; the test file's own text is
never printed, and a row that matched a **sealed** set is shown by line number
only. (When a corpus row is identical to a test row, or contains it, quoting
the corpus row shows that test sentence too — pass `--no-examples` if the
output will be shared.)

`--clean-to pairs.clean.jsonl` writes the surviving rows, plus a content-free
audit record next to them (`pairs.clean.audit.json`). Screen the corpus
**before** you split (Step 4 splits the cleaned file). Don't re-screen the whole
corpus after carving a dev set from it — the dev rows would match themselves
and be dropped. Screen any *additional* data (a web harvest, monolingual text)
the same way before adding it to training.

**Screening does not use up your test set.** leak-audit reads the test set to
compare rows, and forge records that as an *audit* read, never a scoring one:
it does not stand in the way of the predictions you write in Step 3.

**Read the verdict first** (the `VERDICT:` line; with `--json`, the `verdict`
key). If it says that most test rows have a near-twin in your corpus, a model
trained on all of it will score recall of training phrases rather than
translation. With a fixed test set (teacher- or nurse-checked) you will then
usually train **two models**: one on all the data — usually the more useful one
to deploy — and a twin-free one whose score says how the approach handles new
sentences. The twin-free corpus comes from `--drop-test-twins`:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

It removes the training rows that are near-twins of test rows, reports the
strict subset before and after, refuses if that would leave nothing to train
on — and writes the twin-free model's config beside yours,
**`config-notwins.json`**: the same config with its own `run_name`, and
`data.gold` / `eval.near_dupe_corpus` set to the twin-free file
(`--companion-config <file>` names another file; an existing file is never
overwritten). It prints the command that trains it. Until the dev set is
registered (Step 4) it says to carve it first and run this audit again, so the
dev rows leave the twin-free file too. `nmt-forge status` keeps the verdict —
and then the untrained twin-free model — in its warnings until you act on it.

**What a refusal looks like:** you don't have to remember to run it — `nmt-forge
run` audits every training file against your test and sealed sets and refuses a
leak: *"[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0
identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12
template sibling(s) … which are KEPT"*. Fix: `nmt-forge leak-audit <file>
--clean-to <file.clean.jsonl>` and train on the cleaned file.

---

## Step 3 — Predict before you peek

**You say:** *"Write down what we expect each model to score on the test set —
before we measure anything on it."*

**forge does:** one preregistration per model you plan to train, named after
the model:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

A predictions file is a JSON array of predictions. Each names a metric and a
one-sentence rationale, plus either a direction against a baseline
(`"direction": "increase", "baseline_score": 0, "margin": 5`) — checked
automatically later — or a free-text expectation (`"expect": "between 10 and
30"`) that a person checks. You (or your agent, out loud) commit these
**before** any test score exists — **and before any benchmark of an existing
model on the test set**: the baselines in step 3 of [Build MT for Your
Language](/docs/build-mt-for-your-language#3-measure-the-options) come
*after* this step. When you export, `--prereg <id>` says which prediction
judges which model. Or pin a prediction to its model's config now:
`--config-hash <hash>` on `prereg new`, with the full hash
`nmt-forge preflight run --config config-notwins.json` prints. Any later edit
of that config (a time budget, say) changes the hash and drops the pin, so
naming the prereg on export is the simpler route.

**What a refusal looks like:** four you may meet here.

- The unedited template is refused: its `REPLACE` placeholders predict
  nothing. Write your own expectation and rationale.
- A Markdown or prose file is refused with the format and the template command.
  There is one format: the JSON array.
- A preregistration written after the test set was already scored is refused:
  *"[preregister] eval set 'project-test' was already read for scoring … before
  this preregistration"*. A benchmark counts. `--allow-after-reads` exists only
  for predictions that were truly written down before those reads (on paper,
  say); it is recorded, and every report, export, `DEPLOY.md` and
  `nmt-forge status` then say the predictions came after N scoring reads.
- Scoring a test set with no preregistration is refused: *"[preregister] no
  preregistration for eval set 'project-test' … why: results looked at without
  written-down expectations become post-hoc stories"*. This is what separates a
  result from results-first storytelling.

:::info Why this feels like extra work
It is the work. Every guard here is a mistake that has fooled real researchers.
The tool makes the honest path the easy path and the dishonest path the one that
stops you.
:::

Now measure the existing options on the test set — step 3 of [Build MT for
Your Language](/docs/build-mt-for-your-language#3-measure-the-options) — and
come back to train.

---

## Step 4 — Split, check the gates, then train {#step-4--check-the-gates-then-train}

**You say:** *"Split the cleaned corpus into train and dev. Will the training
run pass all its checks? If so, train."*

**forge does — the split:**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

`--test 0` carves only train and dev, because your test set already exists as
its own registered file (with a carved test set, Step 1 already split).
`--register project` records `project-dev` in the workspace — the name the
starter config already points at.

The split is **group-disjoint**: any two sentence pairs that share a source *or*
a target land on the **same** side. This is the single most common way
low-resource scores get inflated — a textbook maps many English drills to one
target word, a naive random split drops one copy in train and its twin in test,
and the model "translates" answers it memorised. The output says what happened:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

With a test set already registered, `split` also screens the new train and dev
files against it on the spot and warns if any row would be refused later.

**Templated corpora (phrasebooks, drills).** `--near-dupe 0.6` also keeps
*near*-duplicates — sentences built on the same frame — on one side, so a dev
or test row never has a template twin in training. On a heavily templated
corpus the frames can chain into one giant group (*"Does your arm hurt?"* ~
*"Does your leg hurt?"* ~ *"Your leg looks swollen"* …), and a group can only
go to one side whole. When that would give a side far more rows than you asked
for — more than **1.5×** the request — or leave training with less than half of
what the request leaves it, `split` refuses and writes nothing: *"[split-guard]
split refused — nothing was written: the carve does not match the request (dev:
asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the
773 rows the request leaves it)"*, followed by why (the chaining, with the
largest group's size) and the routes that work: a higher threshold, a cap on
group size (`--near-dupe 0.6 --max-group 51` — near-duplicate links beyond the
cap stay uncut, and the split counts them), a fixed test set's twins dropped
with `leak-audit --drop-test-twins`, or dev/test sentences written
independently of the training material. forge checks the chaining itself: on
such a corpus its near-twin advice (here, in preflight, and in the export's
DEPLOY.md) does not recommend `--near-dupe 0.6`.

**What a refusal looks like:** if you hand forge a split you made yourself,
`nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` refuses when sides
overlap — *"[split-guard] 3 shared canonical source keys and 1 shared target
keys between 'train' and 'test'"* — with the fix: re-carve with `split`; don't
delete the offending rows by hand.

**Two models?** Now that the dev set is registered, run the twin-free audit
from Step 2 again (the dev rows leave the twin-free file too); its
`config-notwins.json` trains the second model below.

**forge does — the gates:** `nmt-forge preflight run --config config.json` lists every gate
the run will hit, ✓ or ✗, each ✗ with its fix — including whether the training
extra is installed:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

When it's all green: `nmt-forge run config.json` (and, for the twin-free model,
`nmt-forge preflight run --config config-notwins.json && nmt-forge run
config-notwins.json`).

With the default `cpu-tiny` preset this runs on an ordinary laptop CPU — no GPU,
no download. Training is still the one step that is **not** an instant tool
call, so your agent should run it in the background with output going to a log
file, and watch only for the lines that matter (`refused`, `Error`,
`wall-clock`, `RUN EXIT`) rather than polling. A live panel with the loss curves
and a stop button opens for **you** (at `http://127.0.0.1:8377` when that
port is free) — it is yours, not the agent's. Early in the
run, forge measures its speed and refuses — in minutes, not days — a run that
cannot finish within the config's `model.time_budget_hours`.

The `[schedule-sanity]` lines show the early-stopping **floor** forge derived
from your data mix, so a synthetic-heavy run doesn't die at half an epoch when
the real-dev loss wobbles (a real failure mode — see
[Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training)).

When it finishes, forge has **selected a checkpoint on the fenced dev set** (never
on the test set), written a `run-manifest.json`, and printed the dev scores —
always with their 95% confidence intervals — followed by the next command.

---

## Step 5 — Score it once, and package it

**You say:** *"Score the model on the test set and package it so we can use
it."*

**forge does:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

One command:

- decodes your test set with the checkpoint the run selected and scores it —
  refused without the preregistration, recorded in the workspace's ledger, 95%
  confidence intervals on every number, and a plain-language **Diagnosis &
  Recommendations** section;
- writes the result as an **mt-eval report** in `export/evaluation/`, so
  `mt-eval compare` puts this model next to anything you measured with the
  harness (for example the hosted models in step 3 of
  [Build MT for Your Language](/docs/build-mt-for-your-language#3-measure-the-options));
- packages a **self-contained model** in `export/model/` (weights and tokenizer,
  no training state), `forge-model.json` (what it is and how it was measured), a
  champollion plugin manifest, and `DEPLOY.md` with the exact commands.
  `export/model/` holds no test sentence; it is the only folder you deploy.

**The score** is the harness's headline: corpus chrF++ with its 95%
confidence interval, written the same way everywhere forge shows it — for
example `chrF++ 31.2 [28.4, 34.0]` — with its sacreBLEU signature in the full
records (`forge-model.json`, the export summary, `DEPLOY.md`). BLEU, spBLEU and
TER are shown beside it, never blended into it; exact match and the other
battery lanes are diagnostics. No forge surface prints a composite or a
quality label: what the output is worth is for speakers of the language to
judge.

**What qualifies the score travels with it.** The mt-eval report records
everything that limits what the score means — for example a *near-constant
output* (the model gave one of a handful of sentences to many different
inputs, so its outputs do not follow its inputs), outputs much longer or
shorter than the references, or copies of the source. `export` passes every
one of these on in the harness's own words: in its summary
(`score_caveats`), in `forge-model.json`, and in `DEPLOY.md` right under the
score. `status`, `report`, `compare` and `lint` say the same. A score that
carries a caveat is never offered as "the number to quote" without it.

If anything fails, no half-written export is left behind. Two cautions:
`export/evaluation/` contains your test sentences — never copy it with the
model; keep it with the test set. (When the test set is marked private, every
file there carries the same mark.) And a
**sealed** test set is one-shot: exporting spends it, and a second export
refuses unless you pass `--no-eval` (package the model without re-scoring).

`nmt-forge evaluate <run-manifest>` is the score-only half of `export`, if you
want the numbers without packaging (`--harness-out DIR` writes the mt-eval
report).

**Two models on one test set** (say, one trained on all the data and one with
`--drop-test-twins`): once the workspace holds a second run, the run's `NEXT`
line and `nmt-forge status` name a folder per run (`--out export-<run>/`).
The order does not matter: whichever model is exported second, the all-data
model's `DEPLOY.md` ends up citing the twin-free model's score. With two
preregistrations on one test set, `nmt-forge status` and `nmt-forge report`
say which one applies to which run (or that `--prereg <id>` must decide —
export the twin-free model with `--prereg notwins`). `nmt-forge compare`
A/Bs the two on the test set and says, per model, how many test rows have a
near-twin in its training data: a win on recall is reported as one. It takes
each model's hypotheses — `<export>/evaluation/battery-hyps.jsonl`, named
`hypotheses` in the export summary — and passes on the score caveats mt-eval
wrote for that export. The twin-free score is the one to quote for new
sentences only together with any caveat on it: if the twin-free model's
output is near-constant, its score is not evidence that it translates new
sentences, and `DEPLOY.md` says so beside the number.

**Reads by the harness count.** When forge registers a test set it starts a
small read log beside the file (`<file>.reads.jsonl`), and `mt-eval run` /
`mt-eval compare` append one content-free line (run id, purpose, the file's
sha256, a timestamp) each time they score that file. forge reads it: a
preregistration written after such a read is refused as a postdiction (unless
`--allow-after-reads`, which every report then discloses) — the reason Step 3
comes before the baselines — a sealed set read by `mt-eval` is spent, `status` and
`ledger show --set` count the reads, and `DEPLOY.md` says when the exported
score was not a first look.

### How to read the battery-lint report

The report is a table of scores **by register** (textbook, government, oral
story, …) — or a single group, `all`, when your test rows don't name a
register — each with its confidence interval, followed by the diagnosis. The
diagnosis names your **weakest registers** and, for each, the likeliest cause and
the **lever** to pull next:

| If the diagnosis says… | It means… | The lever |
|---|---|---|
| `R1-vocabulary-gap` | the register scores low **and** outputs are unfinished; the model lacks the words | **VOCABULARY** — grow the lexicon, then re-check the funnel |
| `R2-structure-gap` | the words are known but sentence *shapes* aren't | **STRUCTURE** — add the missing constructions (templates/compositor) |
| `R3-mixed-convention` | outputs mix spellings | **ORTHOGRAPHY** — normalize the corpus to one convention, retrain |
| `R4-optimism-bound` | the "full" score is inflated by near-twin test rows | **MEASUREMENT** — cite the strict score for generalization |
| `R5-low-power` | the confidence interval is wide | **MEASUREMENT** — don't act on deltas smaller than the CI; grow the test set |
| `R7-transfer-plateau` | great on synthetic, stalled on real text | **REAL-DATA** — backtranslate monolingual data or get real parallel sentences |
| `R9-harness-score-caveat` | the mt-eval report qualifies the score (for example a near-constant output); `high` when mt-eval calls it major | **MEASUREMENT** — quote the score only with the caveat, and read a few outputs before calling it translation quality |

Each finding carries the evidence it fired on. For the `--json` findings your
agent can act on programmatically: `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## Step 6 — Serve it to the champollion CLI

**You say:** *"Serve the exported model and translate our app's strings with
it."*

**forge does:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` answers two ways: the champollion **api method** contract
(`POST /translate`) and an **OpenAI-compatible** `/v1/chat/completions`, which
is what `champollion sync --method local` talks to. `export/model/DEPLOY.md` has the
`champollion.config.json` snippet for the `api` method (the one it recommends)
and for the plugin manifest. The server listens on `127.0.0.1` only; to expose
it on a network you must give it a token (`--token`, or
`NMT_FORGE_SERVE_TOKEN`), because anyone who can reach the port can use your
model. The CLI needs no key for the loopback server; a server started with a
token needs the same value in `CHAMPOLLION_API_KEY`.

With two exported models, the choice of which to deploy is yours:
`nmt-forge choose export-<run>/model` records it, and `nmt-forge status`
then names that model. Serving one to try it is recorded as served, not as a
choice. To enter the model in a sovereign contest instead, `DEPLOY.md` §6
lists the files that make a declarative (Lane A) entry and the exact
`mt-eval contest submit-model` command.

Know what you are deploying: an NMT model translates text; it does **not**
follow instructions, so the tone guidance, coaching files and glossaries the
CLI sends to LLM methods are ignored. And machine translation of a low-resource
language needs a fluent speaker's review before anything reaches readers.

---

## What you just did

You trained a model whose score you can actually believe: no leaked answers, a
checkpoint chosen without peeking at the test set, error bars on every number,
predictions written before results, a diagnosis that names the next lever
instead of leaving you to guess — and a packaged model that the CLI can call
and that compares directly with every other method you measured. That is the
whole point — **the honest result is the default, and it took no MT expertise
(or GPU) to get there.**

When the numbers disappoint (they will, the first time — the default model is
weak by design), go to
[Diagnosing a Training Run](/docs/network/getting-started/diagnosing-training) —
it is symptom-first, written for exactly that moment.
