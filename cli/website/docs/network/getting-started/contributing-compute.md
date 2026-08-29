---
sidebar_position: 4
title: 'Contributing Compute'
description: 'Run the queue: run open benchmark sweeps from the public queue with your own API key and publish the results.'
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# Contributing Compute

> **The idea:** the leaderboard has empty squares — (language pair, method, condition) combinations nobody has measured. We maintain a public queue of them. You run items with your own API key, publish the reports, and the map fills in. Contributing compute is a real, citable contribution to low-resource MT evaluation.

The queue carries two kinds of work. **LLM items** test a chat model on a
language pair, in a `naive` or `coached` prompting condition. **Engine
items** (condition `engine`) test a classic MT service — DeepL, Google
Translate, Microsoft Translator, LibreTranslate, Tilde — on pairs inside
that service's own published coverage; these are the measured backbone of
the coverage map, and until 2026-08 they were almost entirely blank. Both
kinds run through the same harness and publish to the same board.

## The queue

The live queue is served from the database (the harness reads it by default); a compact snapshot is published at [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json), with the full file at [queue.json](https://champollion.dev/queue.json) (tens of MB — the preview is the right first fetch). You can watch what your runs build on [the live map at champollion.dev](https://champollion.dev) — the coverage map of who can translate what. There's also a zero-install terminal viewer:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

The viewer only *displays* open items and their exact `mt-eval run` commands — it never executes anything or spends your tokens. Each item carries:

- `run_command` — copy-paste ready (fetches the corpus, runs the harness)
- `est_cost_usd` and `est_basis` — either the **observed** cost of our own baseline run of the same (corpus, model), or an **extrapolation** from that model's sweep-average cost per entry × the corpus entry count. The basis is stated per item; your actual cost depends on provider pricing at run time.
- `priority` — the published ranking (survey mode: first light across
  pairs, languages, and families per dollar). The preview also publishes
  **budget tiers** — what $1 / $10 / $100 / $1000 buys off the top of the
  ranking (items, pairs, models reached) — so you can size a contribution
  before spending anything. The underlying value model is **expected
  chain value**: how much this one run is predicted to strengthen the whole language mesh, per estimated dollar. Every item carries its full formula breakdown (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`) so any rank can be re-derived by hand — the formula and its defaults are published in the [Queue Construction Specification](/docs/network/specifications/queue-construction), and the reasoning behind it in [Why the Queue Is Built This Way](/docs/network/perspectives/why-the-queue).

**No claim-locking — pick any open item.** Two people running the same item is harmless by design: every run card is fingerprinted (SHA-256 over dataset hash + model + condition + system prompt, [Benchmark Spec §3.8](/docs/network/specifications/benchmark)), so identical runs deduplicate on publish, and independent replications of the same configuration are useful evidence, not waste.

Queued corpora are dev-split, CC-BY-family (Tatoeba-derived), and flagged `do_not_train` — they are evaluation sets, not training data. Non-commercially-licensed and quarantined corpora are excluded from the open queue.

## Setup (once)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### Which provider key?

The harness accepts four provider keys, selected with `--provider` on `mt-eval run` and `mt-eval queue` — or auto-detected from whichever key is set in your environment or `.env`:

| `--provider` | Key | Reaches |
|---|---|---|
| `openrouter` (default) | `OPENROUTER_API_KEY` | every model in the queue lineup |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic Claude models |
| `openai` | `OPENAI_API_KEY` | OpenAI GPT models |
| `gemini` | `GOOGLE_API_KEY` | Google Gemini models |

One [OpenRouter](https://openrouter.ai/keys) key reaches every model in the lineup, and the harness's cost tracking and pricing snapshots come from the same OpenRouter metadata, so reported run cost matches what your key was billed — that's why it's the default. If your credits live with Anthropic, OpenAI, or Google directly, set that vendor's key and the harness calls the vendor's API with no proxy. A direct key only reaches that vendor's own models (good for a single-vendor batch), and its cost figures come from published vendor pricing rather than billed metadata — treat them as close estimates. If both an OpenRouter key and a direct key are set, auto-detection picks OpenRouter; the queue worker tells you so and how to override with `--provider`. Every run card records which lane it ran through in its `api_provider` field.

(`mt-eval run` also takes `--provider local` for self-hosted OpenAI-compatible endpoints — Ollama, vLLM, LM Studio — via `--base-url`. It's an explicit opt-in, never auto-detected.)

### No API key: run a self-hosted model

You don't need a cloud key at all. The `local-model` method runs an open neural-MT model on your own hardware — the models the cloud engines don't serve, which is exactly where low-resource coverage lives: **NLLB-200**, **OPUS-MT** (Helsinki-NLP), and **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**Two "usual ways" to load a model, auto-selected — nothing to configure:**

- **transformers** (default): `--model` is a Hugging Face hub id (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) or a local `from_pretrained()` directory. Needs `pip install 'mt-eval[local-models]'`.
- **CTranslate2** (fast CPU/GPU inference): `--model` is a CTranslate2-converted model directory (one produced by `ct2-transformers-converter`, containing a `model.bin`). Needs `pip install 'mt-eval[ctranslate2]'`. The tokenizer is read from the converted directory, or named with `LOCAL_TOKENIZER_ID`.

The backend is detected from the model path (a CTranslate2 directory has a `model.bin`); force it with `LOCAL_MODEL_BACKEND=transformers|ctranslate2` if you ever need to.

**Language codes come from the language card, not a guess.** For a multilingual model like NLLB, the harness reads the FLORES-200 code straight off the target language's card (the same source of truth every method uses). A language the model genuinely doesn't serve — NLLB-200, for instance, has no Plains Cree (`crk`) — **fails honestly** ("out of scope for this model") rather than emitting a bogus code and a plausible-but-wrong translation. OPUS-MT models are pair-specific, so the pair *is* the model.

A local-model run scores and publishes exactly like any other run — same metrics, same run card, same leaderboard. (It's a harness method; the CLI translation tool reaches it later via a subprocess bridge, so Node never needs a Python ML stack.)

### The agent fast path

If you work with Claude Code or another coding agent, the whole contribution is one prompt:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Tier 0 — One command

The fastest way to contribute is to let the harness take the top of the
queue for you:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

It never re-sorts — the queue order *is* the [priority
model](/docs/network/specifications/queue-construction) — and it shows the full
plan with estimated spend and asks before executing anything. Coached
items are skipped unless you bring your own coaching file
(`--include-coached --coaching-file my-coaching.txt`).

**The queue worker publishes for you — no account needed.** Unlike a single
`mt-eval run` (which never auto-publishes), `mt-eval queue` resolves a
publishing identity *before* spending any tokens and **auto-publishes each
successful run** to the leaderboard as it completes — no separate publish
step. Sign in (GitHub/Google) only if you want your name on the board;
otherwise continue anonymously and results post as submitter `anonymous`
(`--anonymous` forces it, and non-interactive `curl | bash` runs with no
cached sign-in default to it, saying so out loud). Pass `--no-publish` to
keep results local instead (you can publish them later with `mt-eval
publish`). Then watch what your runs built on
[the live map at champollion.dev](https://champollion.dev).

## Tier 1 — Run a benchmark

Every queue item's `run_command` is self-contained. A typical one:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

You pass the **registry id**, not a file — the harness fetches the reference from
its upstream source at run time and scores against the freshly fetched data
(corpus content is never hosted or tracked here).

The run prints its total cost and writes a run log plus a scored report to `eval/logs/`. Then publish:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**No account needed.** Publishing offers an OAuth sign-in (GitHub/Google) so your name becomes the leaderboard attribution — but it's optional: `mt-eval publish <report> --anonymous` publishes without an account, and the row displays exactly like any other self-benchmarked result with submitter `anonymous`. The anonymous intake is rate-limited (a few cards per hour per connection; sign-in is the unlimited path) and runs through the same database integrity gates as every other submission — quarantine, score ranges, corpus-sha binding, and the corpus-content guard all apply identically. Anonymous or attributed, community submissions land at the **self-benchmarked** trust tier — plainly labeled as "submitted by the person who ran it." That's not a demotion; it's the trust model working. The run card carries everything needed for anyone to re-run your exact configuration: dataset hash, model, condition, the full system prompt, and cost. Elevated tiers (verification, community validation) are granted by review — see [Leaderboard Rules](/docs/network/leaderboard/rules).

:::note[Moderation]
Anonymous rows are moderated like everything else: submissions are immutable to the public API, and any curator removal or correction goes through the service-role lane, where the database's audit trail preserves the prior row — so a purge is recorded and reversible, never silent.
:::

## Tier 2 — Craft coached prompts

The harness has first-class support for **coaching**: replace the naive system prompt with one that carries real linguistic knowledge. Pass `--coaching-file` (or `--coaching "inline text"` for short prompts) and the harness uses your text as the system prompt, records the **full text plus its SHA-256** in the run log's provenance block, and labels the run's condition **`coached`** (unless you set `--prompt` explicitly) — so prompt craft is a reproducible, attributable experiment, two different coaching files can never be confused with each other, and coached runs are never mistaken for naive baselines on the leaderboard.

A worked example for Faroese, using typology facts and glossary entries from the language's [public language card](https://champollion.dev/languages):

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(Write your own coaching content — the facts above illustrate the *shape*: a few high-impact grammar rules, a small glossary of terms the model gets wrong, a register instruction. Language cards at [champollion.dev/languages](https://champollion.dev/languages) cite typology sources you can draw from.)

Compare against the naive baseline with `mt-eval compare <naive_log> <coached_log>`, iterate, and publish your best run. The run publishes with condition `coached` automatically; if you want the leaderboard to show a named method instead of the generic label, attach a method card when you publish (the publish flow offers a wizard). Beating the naive baseline on a low-resource pair with nothing but prompt engineering is a genuine, publishable finding — see the full [Coached LLM Prompting cookbook](/docs/network/tutorials/coached-llm-prompting) for design guidance.

## Tier 3 — Build a method

The most ambitious contribution: implement the `TranslationMethod` protocol (`translate(entries, config)`) and benchmark an actual system, not a prompt. The harness runs it via `--method <plugin-dir>` and embeds your method card in the run card. Patterns with worked cookbooks:

- **[FST-gated pipelines](/docs/network/tutorials/fst-gated-pipeline)** — every candidate word is checked by a morphological analyzer; the LLM regenerates until the gate passes. Semi-deterministic, morphology-guaranteed output.
- **[Dictionary-augmented generation](/docs/network/tutorials/dictionary-augmented-llm)** — look up source terms in a bilingual lexicon at translation time and constrain the output.
- [Chained models](/docs/network/tutorials/chained-models), [few-shot retrieval](/docs/network/tutorials/few-shot-prompting), [back-translation](/docs/network/tutorials/back-translation), [rule-based hybrids](/docs/network/tutorials/rule-based-hybrid)…

Methods declare a **dependency class** (S/O/A1/A2/X — see [the methods spec](/docs/network/specifications/methods#method-validity-and-dependency-classes)) describing what they need to run and transfer: a self-contained pipeline is Class S; one that calls a licensed dictionary API at runtime is A2. Declare honestly — the class determines where your method can compete, and manifests are audited.

## Why this matters beyond the leaderboard

Every published run is independent evidence about MT quality for a language pair that commercial providers don't measure. The queue doubles as a public record of *demand*: which pairs the community considers worth measuring, what coverage costs at current API prices, and how far contributed compute stretches. When we ask funding agencies to underwrite systematic sweeps, this queue and its fill-rate are the demand evidence.
