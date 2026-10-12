---
slug: /build-mt-for-your-language
title: Build MT for Your Language
description: "From 'how do we get started?' to a tested translation workflow: find what exists, protect your test set, measure the options, build something better, prove it, and deploy it — with the exact commands and MCP tool calls for each step."
---

# Build machine translation for your language

This page takes you from *"we want translation for our language — how do we
get started?"* to a translation workflow you have **measured on your own
sentences** and put to work. It is written for people and for AI agents: every
step gives the command to run and, where one exists, the
[MCP tool](/docs/network/getting-started/mcp-server) an agent calls instead.

Two running examples:

- **A school** wants English → Plains Cree for its newsletter and a small app.
  Teachers have checked a few hundred sentences and want them kept private.
- **A hospital** wants English → a language the index barely covers, for a
  bedside phrasebook. Its test sentences contain clinical wording and must
  never be sent to an outside AI service.

You will end with: a private test set, scores for several methods on it, a
better method (a coached model or one you trained), and that method deployed
through the CLI — with every number traceable to what produced it.

:::info[What this does not do]
Nothing here makes a translation correct. Scores tell you which option is
*less wrong on your sentences*; a fluent speaker still decides what is fit to
use. Read [Honest Limitations](/docs/network/honest-limitations) before you
rely on any number.
:::

:::warning[Agents: before you open any of the user's files]
If a test set might be private (teacher-checked, nurse-checked, anything a
community has not published), do not read it — no `cat`, `head` or preview,
not even to see its format. What you read goes to your model provider. Ask
the user, and mark it local-only first ([step 2](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. Install

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

For an agent, add the MCP server to its configuration:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. Find out what exists

What is already known about the language — dictionaries, grammars, corpora,
analyzers (FSTs), models, published results, services — and where each fact
comes from.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agent:** `search_languages { "query": "Atya" }` finds the code even from a
misspelling (closest names by edit distance). Each result shows where the
language is spoken only when its card cites a source for it, and shows that
source, so the user can pick between languages with similar names. A location
without a source is never shown: the line says so and links the language's
Glottolog record instead, where the candidates can be compared at the source.
From an npm install, a language outside the bundled core set is filled in from
champollion.dev's published card tables, which do not carry per-field sources
yet (they arrive with the tables' next upload), so its line has the Glottolog
link rather than a location. When nothing shown tells the candidates apart,
the speakers decide (below). Then `language_overview { "code": "<code>" }` gives one
page: what exists, which benchmarks and results there are, and numbered next
steps. Any tool that takes one language also accepts it as `language`.

Read the card the way it is written: **absence means unknown, not zero.** A
card that lists no dictionary means the index has not recorded one — not that
none exists. Where sources disagree (speaker counts often do), the card shows
all of them.

If your language has no card at all, you can still do everything below; the
tools just know less about it (`nmt-forge init <code> --no-card --name <name>`
starts a training project anyway).

### When the variety is not confirmed yet

A name can fit several languages. "Ayta", for example, matches six Ayta
languages of the Philippines, each with its own code. **Ask the speakers
first.** The community knows which variety it speaks, and a code chosen for
them is a claim about them.

If you must start before they can answer, use a private-use code: ISO 639
keeps `qaa` to `qtz` for exactly this. Give it a display name, so prompts and
reports name the language:

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

which writes, in `champollion.config.json`:

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` says the code is a private-use one with no language card (it does not
ask you to check the spelling).

`init`, `sync`, `verify` and `network register-corpus` all accept a
private-use code. What it costs you, until the real code replaces it:

- **No card facts.** No register presets, plural rules or script from a
  language card. Sync uses generic settings, so check the first results with a
  speaker.
- **No FST.** No morphological analyzer is attached to a private-use code, so
  nothing is checked word by word.
- **No prior results.** Published benchmarks and the queue are keyed by real
  codes, so `recommend` and `corpora` have nothing to show for it.

When the community confirms the variety, switch to its code:

1. In `champollion.config.json`, replace `qaa` with the code (and drop the
   `name` if the card's name fits).
2. Rename the locale files (`messages/qaa.json` → `messages/ayt.json`). The
   translations stay valid: the next `champollion sync` keeps them and
   translates only what is new.
3. Register the test set again under the real pair:
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`.
   The command prints the `--id` to pass, because a registered file keeps its
   id unless you choose a new one. (`--pair` takes `eng-ayt` or `"eng>ayt"`
   here and in `nmt-forge init`; quote the `>` form, because a shell reads a
   bare `>` as "write to a file".)

## 2. Gather your data — and protect your test set

**Separate the test set first.** Put aside the sentences you will judge
everything by (the teacher-checked ones, the nurse-checked ones) before you
train or tune anything, and never train on them.

A test set is a TSV file: one sentence pair per line, source, a TAB, then the
reference translation. Lines starting with `# ` are comments.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

Then decide how far it may travel:

| You want… | Do this |
|---|---|
| Nothing leaves this machine — no outside AI service may ever see these sentences | Put a marker file next to it (below). Only a model on your own machine can be tested against it. |
| Others can see that the test set exists, but never its contents | `champollion network register-corpus --tier private --role test …` registers metadata only |
| A contest on it, run on a machine you control, possibly air-gapped | `--tier sealed` plus the [sovereign node](/docs/network/sovereignty/sovereign-eval-node) |
| It is public and openly licensed | `--tier public` points at where it lives; we still never host it |

The marker for "never leaves this machine":

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

With it in place, `mt-eval run` refuses every remote provider for that file
and runs only against a model on loopback. Details:
[Registering Corpora](/docs/network/sovereignty/registering-corpora).

**Which licence id.** Registering asks for `--license`: the terms the data's
owners actually grant, never a placeholder. Ask them, then pick the id that
says it: an SPDX id if they already publish the text under one;
`community-eval-grant-nc` for "only to score systems, never train, never
share, no paid scoring"; `community-eval-grant` for the same with paid
scoring allowed; `proprietary` for all rights reserved; or
`LicenseRef-<name>` for terms of their own. The last four are `LicenseRef-…`
ids, bespoke grants: remote evaluation against them is refused until the
steward records permission. Until the steward
confirms, record your choice as provisional. Local-only stays local whatever
the licence: the marker, not the licence, decides where the sentences go.
[Which licence id for a private test set](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set).

**Agents: do not read a local-only test file.** No `cat`, `head` or opening
it to take a look. What you read goes to your model provider, which is the
place the marker says these sentences must not go. You do not need to: the
tools keep its sentences out of what they print (`mt-eval compare` shows entry
ids and scores instead), and `--show-text` is there only for a person at the
terminal.

**Agent:** `language_overview { "code": "<code>" }` lists the protection choices for the language;
`run_benchmark` honours the marker and returns a refusal (with the reason)
rather than sending protected sentences out.

### If you may train a model later: register, screen, predict — before any score

Do these three things now, in this order, before step 3 measures anything on
the test set. Forge counts every look at a test set, and a benchmark (step 3)
is a scoring read: a preregistration written after one is refused. The order
matters; doing it later is not the same.

1. **Register the test set with NMT Forge.** Its read log starts here, so
   every later read is counted (a score read before registration is listed,
   but not counted).
2. **Screen your training corpus against it** (`leak-audit`). This reads the
   test set for an audit, never a score, so it does not count against your
   predictions. Read its verdict: if most test rows have a near-twin in your
   corpus, a model trained on all of it scores recall of training phrases,
   not translation. You will then usually train two models: one on all the
   data, and a twin-free one (`--drop-test-twins` writes its corpus and its
   config, `config-notwins.json`).
3. **Write down what you expect, one preregistration per model you plan to
   train**, named after the model. These predictions are what the test
   scores are judged against later: export judges each model against the
   one you name with `--prereg <id>` (with two on one test set it refuses
   to guess). You can instead pin a prediction to its model's config with
   `--config-hash <hash>`, the full hash that
   `nmt-forge preflight run --config config-notwins.json` prints. Any later
   edit of that config (a time budget, say) changes the hash and drops the
   pin, so naming the prereg on export is the simpler route.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

If the verdict was SEVERE, add the twin-free model and its own predictions
(in `school-crk/`):

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

The twin-free corpus gets its own file. `corpus.clean.jsonl` stays the
all-data corpus: leak-audit refuses to write over a file that a config, a
run or a split reads, or that another audit wrote (`--overwrite` replaces
one on purpose). Its `--json` answer lists the first few row numbers of
each list; the `.audit.json` file beside the cleaned corpus keeps them all.

`--allow-after-reads` exists only for predictions that were truly written
down before the reads (on paper, say). It is recorded, and every report,
export and DEPLOY.md then says the predictions came after the scores.

**Agent:** `forge_init { "code": "<code>", "dir": "<dir>" }`, then
`forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`,
`forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }`
(paths are read from `project_dir`, as the commands above are run from
inside the project; an absolute path works anywhere),
then `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }`
with the user, one per model, each named after its model (`forge_export`
then takes that id as `prereg`; `config_hash` on `forge_prereg` pins one to
its config instead). `forge_status` names this step as soon as a
test set is registered. Step 4 trains in the same project.
`language_overview` lists these steps in this order too.

## 3. Measure the options

Run each candidate against **your** test set (registered, screened and
preregistered with forge first, if you may train later —
[step 2](#2-gather-your-data--and-protect-your-test-set)). The harness scores every one the
same way, the way the field reports MT evaluation: the headline is corpus
chrF++ with its 95% confidence interval, with BLEU, spBLEU and TER beside it
(never blended into one number). Exact match and behavioural checks
(wrong-script output, hallucination signals) are reported as diagnostics,
with cost and speed alongside. Where the harness has a morphological analyzer
pinned for the language, it adds FST acceptance and morphological accuracy as
diagnostics;
`mt-eval setup --status` lists those languages, and `mt-eval setup --comet`
adds COMET where it applies.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` says whether a difference is real or within noise (paired
approximate randomization). A difference inside the confidence intervals is
not a ranking. It writes `comparison-<hash>.json`, named for the runs it
compares, beside the reports when they share a folder, or into a
`comparisons/` folder above them when they do not, never into one run's own
folder. Another comparison never overwrites it.

**Evaluation packs.** Some languages declare extra tools their metrics need
(for Plains Cree, a morphological analyzer). The first `mt-eval run` names
what is missing. A missing analyzer never stops the run: FST acceptance is
marked not computed, `mt-eval setup --lang crk` installs it (once per
machine), and `mt-eval test <run log>` then adds the score without
translating again.

**Agent:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`;
`get_run_status { "job_id": "<id>" }` returns the scores. It publishes nothing
unless you pass `publish: true`. A code as `target_language` is named from its
language card ("Plains Cree") before it reaches the prompt, and the plan shows
the prompt the model will get. A coaching file replaces that prompt, and the
plan says so. When the card lists two scripts and you pass no `script`, the
plan reads which script the references use (letters counted on your machine,
no sentence shown) and asks for that one. Its reports land beside the test
file, in `data/results/mcp-run-<id>/`, with the harness's translation cache in
`data/results/cache/`. `get_run_status` prints the `mt-eval compare` command
for them, and for runs on a registered corpus id it lists the reports by
path. A `local-model` plan says first how much confirming downloads, and
where.

**Which metric to trust** depends on the language:
`get_metric_reliability { "language": "<code>" }` (MCP) reports whether any automatic metric has ever
been validated against human judgments for it. For most low-resource
languages none has, so chrF++ is the convention — read it as a comparison
between methods on the same test set, not as a grade.

## 4. Build something better

Two routes. Measure both the same way as step 3.

**Coach a general model.** Give it a glossary and guidance, then re-run step 3
with the coaching:

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` takes Markdown, plain text or JSON; the file's full text is
the model's instructions, sent as written.

To score terminology (does each listed term come out as its required
translation?), give every run you compare the same term list with
`--glossary terms.json` (`{"blood pressure": "…"}`, or a list of accepted
forms per term). The glossary is only used for scoring; it is never sent to
the model, so a plain run and a coached run are scored on the same terms.
Without `--glossary`, a JSON coaching file's `dictionary`
(the [coached prompting](/docs/network/tutorials/coached-llm-prompting)
shape: `grammar_rules`, `dictionary`, `style_notes`) is used instead. In
that case the run is scored against its own coaching, and the output says
so. A Markdown coaching file coaches the same way but supplies no glossary.

See [coached prompting](/docs/network/tutorials/coached-llm-prompting) and
[dictionary-augmented prompting](/docs/network/tutorials/dictionary-augmented-llm).

**Train your own model** with NMT Forge, which refuses the mistakes that make
small-data results look better than they are (leaked test sentences, bad
splits, picking the checkpoint on the test set, reading noise as progress):

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` makes the checks `run` makes before training — the dev set,
the leak audit of every training file, the decode length — so a run it
passes does not refuse at the start. `config.json` reads the split from
`data/split/`; a split written elsewhere says which lines to change.

Training pairs go in a TSV like the test set (or JSONL with `source` and
`target`); `leak-audit` (step 2) dropped any that would leak the test set
into training and explained each. Two models? After the split, run the
twin-free leak-audit from step 2 again (with the dev set registered, its rows
leave the twin-free file too), then `nmt-forge run config-notwins.json` and
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
the next command at any point. The default model
trains on a CPU in minutes; on 1–2 thousand sentence pairs, expect chrF++
somewhere around 5–30 — it learns your data's phrases and patterns, not the
language in general. `export` scores the test set once and writes an mt-eval
report, so the trained model compares with everything from step 3. Full walk-
through: [Train Your First Model](/docs/network/getting-started/train-your-first-model).

**Agent:** `forge_status { "project_dir": "<dir>" }` first and after every
step; after step 2's `forge_init`, `forge_register_eval`, `forge_leak_audit`
and `forge_prereg`: `forge_split { corpus, test, seed, out }`,
`forge_preflight { "target": "run" }`, then — after `nmt-forge run` in a
terminal — `forge_export { run_manifest, out, prereg }`. Call
`get_training_guardrails` once before `forge_split`: it lists each rule
forge enforces and the mistake the rule prevents. `forge_split`'s
`register` takes a prefix or `true` (`project`), and `out` defaults to
`data/split`. Every forge tool after
`forge_init` takes the `project_dir` it returns. `get_training_guardrails`
(optional `topic`) explains each rule. Every argument of every tool:
[MCP Server](/docs/network/getting-started/mcp-server#arguments).

## 5. Prove it — privately, or in the open

Your scores are yours. Nothing is published unless you choose to.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

A private or local-only test set never uploads its sentences; `--dry-run`
says so line by line. To let others compete on your test set without ever
seeing it, run a contest on a machine you control: entrants hand over their
method, it runs on your node, and only scores leave. New contests hide all
scores until the contest closes, so nobody can tune against your test set.
See [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest).
To enter a model you trained in someone else's contest, `DEPLOY.md` §6 in
its export names the files that make the entry and the exact
`mt-eval contest submit-model` command.

**Agent:** `list_contests { "language": "<code>" }`, `get_contest { id }`;
`get_results { "target_language": "<code>" }` and `get_run_card { id }` for
the public board.

## 6. Combine the best

**Choose among your own measurements first.** Everything you scored on your
test set is an mt-eval report: the baselines and coached runs from steps 3
and 4 and each trained model's export (`evaluation/runlog_report.json` in its
export folder). A terminal run with `-o results` writes to
`results/*_report.json`; a run started with the MCP `run_benchmark` writes
beside the test file, in `data/results/mcp-run-<id>/`. Compare them all at
once — the first glob for terminal runs, the second for agent runs (use the
one that matches your runs; zsh stops on a glob that matches nothing):

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

A difference inside the confidence intervals is not a ranking, and a
trained model whose test rows have near-twins in its training data scored on
recall: quote its twin-free number beside it (DEPLOY.md and
`nmt-forge report` say which), together with any **score caveat** mt-eval
put on that number. A *near-constant output* caveat (one of a few sentences
given to many different test sentences) means the outputs do not follow the
inputs, whatever the score; forge prints it beside the score in `export`,
`DEPLOY.md`, `status`, `report`, `compare` and `lint`. With several exported models,
`nmt-forge status` lists each with its score, twin-free score and caveat,
and asks you to choose which one to deploy. Record the choice with
`nmt-forge choose <export>/model` (or `nmt-forge serve <export>/model
--choose`). Serving a model to try it is recorded as served, not as your
choice, so `status` keeps asking until you choose.

**Agent:** `forge_status { "project_dir": "<dir>" }` — in the
`choose-export` state, show the user `result.advice.exports`, each export's
score with its `score_caveats`, and ask which model to deploy; the user's answer is recorded with `nmt-forge choose` in a
terminal. A provisional serve does not answer the question. `forge_compare { eval_set, hyps_a, hyps_b }` A/Bs two
forge models with each one's near-twin caveat and mt-eval score caveats beside the winner;
each model's hypotheses file is the `hypotheses` path `forge_export` returns
(`<export>/evaluation/battery-hyps.jsonl`).

Then look beyond your own runs. Different methods win for different pairs
and different kinds of text. The [Network](/docs/network/) lists the
methods and services that exist and the evidence for each — what has been
published, not what you measured:

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

A method published on the leaderboard with its configuration can be installed
exactly as it was scored: `champollion network leaderboard --install <method>
--apply` adds it to your project for that pair. The CLI configures a method
**per language pair**, so the newsletter's
Cree can use your trained model while French uses a hosted one. Chaining
methods (e.g. a model followed by a checker) is covered in
[chained models](/docs/network/tutorials/chained-models).

## 7. Use it

Deploy the method you measured — not a different one.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

While it runs, `nmt-forge status` says `serving` (it checks that the server
still answers); after the server stops, it names the `serve` command again,
on the same port.

Or, for a coached hosted model, set it on the pair in
`champollion.config.json`. Either way:

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**What your own model cannot do yet.** A small model trained on a few
thousand sentences learns their phrases. It often damages placeholders
(`{name}`), plural forms and markup, or turns a short label like "Home" into
a sentence. The quality gate refuses those outputs; nothing damaged is
written. Give the pair a **fallback**, and those strings go to a second
method in the same sync:

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

If no text may leave your machines, make the fallback a model you run there
too: `"fallback": { "method": "local", "model": "<your local model>" }` sends
to an OpenAI-compatible server on this machine (Ollama, llama.cpp, vLLM), at
$0 API cost. A hosted model is usually the stronger second opinion; use it
when the text may be sent to its provider.

Your model translates everything it can. The fallback gets only what the gate
refused from it, and the Markdown blocks it dropped or damaged, and its
output passes the same gate. `sync` prints a `[FALLBACK]` line per pair with
the counts, and `champollion verify` lists anything neither method could
translate. See [Fallback method](/docs/getting-started/configuration#fallback).

For a one-off instead, translate just those strings another way:

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…or by hand, or through a reviewer with `champollion xliff export`. And put
the app's own strings in your test set: a model that scores well on teacher
sentences can still be wrong on "Where does it hurt?".

**Writing systems.** If the language is written in more than one script
(Plains Cree: Standard Roman Orthography and syllabics), the CLI asks you to
choose before it translates. Set `"script"` for that language in the config;
the message lists the options.

The translation memory means an unchanged sentence is never paid for twice,
and switching models does not retranslate everything. Wire it into CI with
the [CI/CD guide](/docs/guides/ci-cd). `export/model/DEPLOY.md` (from step 4) has
the exact configuration for a trained model, including the `api` method and
how to expose it on a network safely.

**Agent:** `translate { texts, source_language, target_language }` runs
strings through the same pipeline. Add `method: "local"` and `base_url`, or
`method: "api"` and `endpoint`, for a model you serve yourself, and `script`
for a language written in more than one script.

## Decisions along the way

| Decision | Choose… | When |
|---|---|---|
| Where the test set lives | local-only | It is sensitive, or you have not asked the people who wrote it |
| | private / sealed | You want others to know it exists, or to compete on it, without seeing it |
| Coach or train | Coach a hosted model | You have a glossary and little parallel text, and outside services are acceptable |
| | Train with forge | You have a few thousand pairs or more, or the data must stay on your machines |
| Publish | Scores only | Default for anything you did not write yourself |
| | Nothing | Always allowed — measurement is useful privately |

## What it costs

- The tools are free for noncommercial use: a school, a public hospital or
  clinic, a charity or a research project is covered (the CLI, nmt-forge and the
  MCP server are PolyForm Noncommercial 1.0.0; the evaluation harness is open
  source, AGPL-3.0-or-later). [Who may use this](/docs/getting-started/who-may-use-this).
- A hosted model costs whatever its provider charges; `--max-cost` stops a run
  before it spends more than you allow, and the report shows the cost per
  sentence. A local model costs nothing but your machine's time.
- Training the default forge model needs a CPU and minutes; bigger presets
  need a GPU.
