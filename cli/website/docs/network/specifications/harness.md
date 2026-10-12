---
sidebar_position: 2
title: Eval Harness v2.0
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Executive Summary.** This page covers installation, configuration, and usage of the MT evaluation harness — the tool that benchmarks translation methods against standardized corpora and produces scored run cards. For canonical definitions of metrics, schemas, and evaluation protocol, see the [Benchmark Specification](/docs/network/specifications/benchmark).

The harness runs translation experiments and produces run cards. It handles prompt construction, API calls, scoring, and result serialization — you supply the dataset and the model.

## Installation

**Requirements:** Python 3.10+

```bash
python3 -m pip install mt-eval-harness
```

This installs the `mt-eval` command.

## Usage

```bash
mt-eval run --corpus path/to/dataset.json
```

This runs every entry in the corpus through the configured model (or method plugin), scores the outputs, and writes a run card JSON file to the output directory.

## CLI Flags

### `mt-eval run`

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Path to corpus file (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Parallel text files (FLORES+, WMT format) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Exact model slug: the full OpenRouter id, or a direct provider's own exact name. No aliases and no floating ids (`~vendor/…`, `…-latest`): a short name such as `gemini-pro` is refused, and the refusal names the slug to write. Comma-separated for multi-model runs. With `--method local-model` it is the model to run — a Hugging Face id or a model directory — and it is required: that engine has no default model. With a method plugin it is handed to the plugin as `config.method_model`. Any other MT engine translates with its own model and the run says `-m` is unused |
| `-d, --dataset` | — | `all` | Dataset filter: `all`, segment name, or ID range |
| `--ids` | — | — | Comma-separated entry IDs to evaluate |
| `--source-lang` | — | `English` | Source language name |
| `--target-lang` | — | — | Target language name, as the prompt says it. A code given here (`sme`) is named from its language card ("Northern Sami"), and the run header says so; a code no card names (a private-use `qaa`) stays a code, with a warning that the prompt will carry it |
| `-p, --prompt` | — | `naive` | Prompt version (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Path to coaching prompt text file. It **replaces** the built-in prompt: the model gets the file as written (plus the `--target-script` line), not the built-in "Translate the given … text to …; output only the translation" instruction. The dry run and the run header say so in one verdict: ✓ when the file names the target language (and by which name or code), ⚠ when it names neither the language nor its code, or not checked when no name or code is known |
| `--glossary` | — | — | Evaluation glossary (JSON) for terminology adherence; scoring only, never sent to the model |
| `--coaching` | — | — | Inline coaching text (quoted string) |
| `--method` | — | — | Path to method plugin directory (contains `method.json` + Python module), or a registered MT engine (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | With `--method local-model`: run an OPUS-MT pair model whose id names another pair than the corpus's (`opus-mt-en-fi` on an `eng>sme` corpus, as a related-language baseline). Refused without it; the run card records it |
| `--method-card` | — | — | Path to method card JSON for leaderboard metadata |
| `--fst-retries` | — | `0` | Number of FST retry attempts (default LLM method only) |
| `--skip-fst` | — | `false` | Score without FST acceptance, even when the language has an FST, and say nothing more about it. The run card marks it not computed. Without this flag, a missing FST (the analyzer or its pyhfst runtime) does not stop the run either: it proceeds, the run card marks FST acceptance and morphology not computed, and the notice names `mt-eval setup --lang <code>`. After that install, `mt-eval test <run log>` adds the FST score to the finished run without translating again. Nothing downloads by itself |
| `--skip-eval-standard` | — | `false` | Score without the language card's eval-standard metrics (an external package). The run card marks them not computed. Without this flag, an installed package's metrics are computed; a package that is not installed is an optional add-on — the run goes ahead without its metrics (marked not computed) and names the `python3 -m pip install` the card declares. Nothing is installed by a run |
| `--tools` | — | `false` | Enable tool-calling mode |
| `--tools-list` | — | — | Comma-separated tool names |
| `--max-tool-rounds` | — | `8` | Maximum tool-calling rounds per entry |
| `--hooks` | — | — | Post-translation hook names |
| `--style-profile` | — | — | Path to a style profile JSON. Enables writing-style consistency metrics (diagnostics — never part of the headline score; see [§ Writing-style and register metrics](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entries per API call |
| `-c, --concurrency` | — | `8` | Parallel API calls |
| `--max-tokens` | — | `32768` | Max tokens per API call |
| `--temperature` | — | `0.0` | Sampling temperature (0.0 = deterministic) |
| `--no-cache` | — | `false` | Disable response caching |
| `--cache-dir` | — | `eval/cache/harness` | Cache directory path (see [The translation cache](#the-translation-cache)) |
| `--metricx` | — | `false` | Also compute MetricX-24 (Google, Apache-2.0), a lower-is-better neural error score (0–25), reported beside the chrF++ headline and never blended with it. Needs the `metricx` extra and Google's model code (see [Opt-in neural metrics](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | With `--metricx`: another MetricX checkpoint (an xl/xxl one, or a `google/metricx-25-*` one) |
| `--fuse` | — | `false` | Also compute the FUSE-style comparator, an untrained reimplementation of the AmericasNLP 2025 FUSE approach, reported as a diagnostic comparator, never in the headline. Needs the `fuse` extra (see [Opt-in neural metrics](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Output directory for run cards and logs |
| `-n, --name` | — | — | Human-readable run name |
| `--dry-run` | — | `false` | Validate configuration and corpus without making API calls. It names the coaching file and glossary the run would use (or `none`), shows the prompt (the built-in one in full; a coaching file by its first line and sha256, and that it replaces the built-in one), says where the translation cache is, and runs the same eval-pack check the real run makes, reporting it on lines that start `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …`, or `none needed for <language>`) without failing. A second line says whether the real run would stop: a missing FST never stops it, while any other missing piece does. Under `--json` the summary carries `coaching_file`, `prompt` (its kind, sha256 and length; the built-in prompt's text), `glossary_file` and `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | BCP-47 language code |
| `--target-script` | — | — | The ISO 15924 script the translations must be written in (`Latn`, `Cans`, …), one the target's language card lists. The harness's prompt asks for it (appended to a coaching file's text too), so it is part of the prompt's sha256. For a language written in more than one script, such as Plains Cree, use the script your references are written in. Without it the harness counts the references' letters by script (an aggregate: no sentence is shown, so this holds for a local-only corpus too) and asks for the script that holds 90% or more of them, saying so in the run header ("references are 100% Latn → prompting for Latn") and recording it on the run log (`config.target_script_source`); references that are mixed get no script and a warning with the shares, and a reference in the other script then scores near zero. Refused for an MT engine or a method plugin, which get no prompt |

`--champollion-config` and `--prompt champollion` were retired in 0.2.0 and are refused with the reason. So is `--champollion-cards-dir`; set `MT_EVAL_CARDS_DIR` to point the harness at another cards directory. They rebuilt the CLI's prompt in Python, and that copy had drifted from the CLI. Use a method plugin (`--method`) to evaluate a CLI method, and `mt-eval export-config` to carry a result back into a CLI project.

### Opt-in neural metrics

COMET is computed whenever `unbabel-comet` is installed (`mt-eval setup --comet`: about 300 MB to install, and about 2.3 GB of model on first use). Two more metrics are off unless a run asks for them, because each loads a large model. Like COMET they run on this machine (no API cost, no text sent anywhere), they are reported beside the chrF++ headline and never blended with it, and the run card says "not run" with the flag to pass when they were not asked for.

| Metric | Flag | What it needs | What it costs |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`, lower is better, 0–25) | `--metricx` (checkpoint: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) and Google's model code, which is not on PyPI: `python3 -m pip install git+https://github.com/google-research/metricx` | The default `google/metricx-24-hybrid-large-v2p6` checkpoint and the mT5-XL tokenizer download several GB from Hugging Face on first use; scoring is slow on a CPU. Without a reference it scores in its reference-free (QE) mode |
| FUSE-style comparator (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | LaBSE downloads about 1.8 GB on first use. Without LaBSE the score is not computed, and the report says so. It is untrained (an unweighted mean of its parts), and the result is flagged `fuse_untrained` |

Over MCP, `run_benchmark` takes `metricx` (with `metricx_model`) and `fuse`, and `comet: true` requires COMET; its plan says whether each is installed, and a confirmed run that asks for one the harness cannot compute is refused.

What each metric measures and how far to trust it for a language is in [Scoring](/docs/network/specifications/scoring) and [Metric reliability](/docs/network/specifications/metric-reliability).

### The translation cache

Every run keeps the model's output for each source sentence in a cache (`--cache-dir`, by default `eval/cache/harness` under the directory the run starts in), so a re-run of the same setup reuses it for free. The cache key covers the model, the prompt as sent (its sha256), the settings that change outputs and the harness version, so a change to any of them is never served an old output. The cache holds copies of the corpus's sentences:

- the run header and the dry run print where it is and how many entries it holds;
- the folder carries a `.gitignore`, so git ignores it;
- it is never written into a folder `mt-eval contest prepare` marked releasable (its `public/`): `mt-eval run` refuses such a `--cache-dir` or `--output-dir` and names the contest's `runs/` folder instead ([Run a sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest));
- a local-only, sealed or consent-required corpus gets its own `protected/<namespace>/` folder, keyed by the run's settings, the corpus's sha256 and its terms, and every file there carries the corpus's mark in a `<file>.champollion.json` sidecar ([Registering corpora](/docs/network/sovereignty/registering-corpora));
- delete the folder to remove the copies, or pass `--no-cache` to keep none.

The MCP server's `run_benchmark` names the cache in its plan and its result. For a file you hold it puts the cache beside the run's results (`<corpus folder>/results/cache/`), and for a registered corpus id in its own folder (`~/.champollion-mcp/cache/harness/`). A cache already in `eval/cache/harness` under the server's working directory from earlier runs keeps being used, so its outputs are not paid for twice. Its entries do not depend on where the folder is, so it can be moved.

### Every subcommand

All eighteen top-level subcommands, generated against `mt_eval_harness/cli.py`
on 2026-08-01. Until then this section listed seven of them, and six —
including `node`, the sovereign organizer scoring node — were documented
**neither here nor in the harness guide**.

**Run and score**

| Subcommand | What it does |
|---|---|
| `mt-eval run` | Execute a translation run (flags above) |
| `mt-eval test <log>` | Analyze a completed run log. `-o <path>` writes the report somewhere other than `<log>_report.json`, and the run log records that path so `card` and `compare` find it. `--glossary <file>` scores terminology against that glossary; the report records its name and sha256, and the card, `compare` and the publish preview say which glossary terminology adherence (a diagnostic) was scored against |
| `mt-eval compare <reports…>` | Compare two or more runs (`*_report.json`, or run logs). One row per metric (chrF++, BLEU, spBLEU, TER, …), one column per run lettered A, B, C…, lower-is-better metrics marked; `--significance` adds paired tests for every pair, each table named by the runs' letters, with the 95% CI on Δ, and says the p-values are per metric and uncorrected; `--method paired_bootstrap` swaps the default approximate randomization for the Koehn bootstrap ([Significance](/docs/network/specifications/significance)). Writes `comparison-<hash>.json` (the hash of the compared runs' ids, so another comparison never overwrites it) beside the reports when they share a folder, else in `comparisons/` in their nearest common folder (never into one run's own folder), unless `-o` names a file. The chrF++ test alone decides which run is better; the other rows are shown, not used to decide. A legacy report's composite is said to be retired and is not compared |
| `mt-eval dashboard <logs…>` | Generate an interactive HTML dashboard |
| `mt-eval card <run log>` | Pretty-print a human-readable run card. The scores come from the run's report: beside the log, where `mt-eval test -o` recorded it, or `--report <path>`. A run with no report found shows NOT SCORED and where it looked, never zeros. A report file can be passed too; it is read with the run log it records |

**Find your way to a method**

| Subcommand | What it does |
|---|---|
| `mt-eval recommend <src> <tgt>` | Method guidance for a language pair — availability plus **cited evidence**, not a bare ranking. The pair can also be given as `--source <src> --target <tgt>`, the form `corpora` takes |
| `mt-eval corpora --source X --target Y` | List eval corpora available for a pair. Either flag works alone: `--target Y` lists every corpus into Y, `--source X` every corpus out of X |
| `mt-eval corpora --with-fst` | Only the corpora whose target language has an FST the harness pins, so FST acceptance can be scored. Each target is listed with whether its FST is installed on this machine and how to install it (`mt-eval setup --lang <code>`, or a manual install for some formats). Combine it with `--source`/`--target`, or use it alone for every pair. Nothing is downloaded |
| `mt-eval list models\|prompts\|datasets` | List available resources |

**Contribute**

| Subcommand | What it does |
|---|---|
| `mt-eval publish <report>` | Submit a TestReport to the leaderboard |
| `mt-eval queue` | Run the top of the community compute queue with your own key — see [Contributing Compute](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Package a TestReport as a champollion method plugin |
| `mt-eval generate-plugin` | Alias for `export` |
| `mt-eval export-config` | Generate a `champollion.config.json` snippet from a TestReport |

**Contests, and running one yourself**

| Subcommand | What it does |
|---|---|
| `mt-eval contest` | Run or enter a **sovereign contest** — the organizer's `prepare`, `register`, `create`, `rank`, `close`, `export`; the entrant's `qualify` (self-score the public dev set for the admission receipt; the qualifier is chrF++ on 0–100), `validate` (rehearse the node's checks offline), `submit-model` / `submit-method` (hand over a model or a method), `status`, `list`. A contest is entered by giving the organizer's node something it can RUN; uploading translations and linking a self-reported card were retired as entry paths on 2026-09-06 |
| `mt-eval shared-task` | Multi-pair shared-task edition umbrella: one row groups the N per-pair contests of an AmericasNLP-style edition and carries its policy defaults. **Grouping and defaults only — every gate stays per-contest** |
| `mt-eval node` | **The organizer scoring node.** Poll intake, gate on the public qualifier, authorize per contest policy, score against **organizer-held secret references**, publish scores-only. This is the command behind [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) and the [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node) — the corpus never leaves the organizer's machine |

`mt-eval node` has eighteen subcommands of its own, including the airgap lane
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) and the
M-of-N custody ceremony (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Run `mt-eval node --help`; the sovereignty
mechanics are described on the two pages linked above.

**Setup**

| Subcommand | What it does |
|---|---|
| `mt-eval setup` | Install optional dependencies (COMET neural metric, FST runtime) |
| `mt-eval logout` | Remove stored authentication credentials |

### Examples

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Run Card Schema

Every experiment produces a **run card** — a self-contained JSON document. The top-level structure:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

See the [Run Card Specification](/docs/network/specifications/run-card) for the full schema with every field documented.

:::info[Authoritative Schema]
The [Benchmark Specification](/docs/network/specifications/benchmark) is the single source of truth for the run card schema. For metric definitions and how runs are scored, see the [Scoring Specification](/docs/network/specifications/scoring). This page documents how to use the harness; the specs define what the outputs mean.
:::

### Key Blocks

**`dataset`** — Identifies which dataset was used, including its content hash so results are tied to a specific version:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Aggregate metrics for the run:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Token usage and cost tracking:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Writing-style and register metrics (informational) {#writing-style-and-register-metrics-informational}

The harness can evaluate whether translations match a target **register** and **writing style**, via the `WritingStyleConsistency` metric plugin (`mt_eval_harness/plugins/writing_style.py`). A translation can be linguistically correct but in the wrong register — informal phrasing in a legal document, formal boilerplate in marketing copy — and string metrics won't notice. These metrics do.

**What is measured (per entry):**

| Metric | Scale | Meaning |
|--------|-------|---------|
| `style_register_match` | boolean | Does the output match the expected register? The target comes from the corpus entry's `register` field (see [Benchmark Spec §2.6](/docs/network/specifications/benchmark)) or from a style profile |
| `style_sentence_length_ratio` | float | Predicted vs reference average sentence length (1.0 = match; divergence = style drift) |
| `style_formality_score` | 0.0–1.0 | Presence of formal/informal markers (T–V pronouns, contractions, …) using per-language marker resources |

**Aggregate:** `style_consistency_rate` — the fraction of entries with no detected register mismatch.

Enable a custom target with `--style-profile path/to/profile.json` (e.g. a brand-voice profile); without one, the plugin falls back to each corpus entry's `register` metadata where present.

:::caution[Honest scoping]
These metrics are **diagnostics** — they are never part of the headline score, and the formality detection is marker-based (a heuristic), not a learned judgment. Treat them as a drift detector for register adherence, not a verdict on style quality.
:::

---

## Fingerprint vs Run Card Hash {#fingerprint-vs-run-card-hash}

The harness produces two distinct hashes. They serve different purposes:

### Fingerprint

The **fingerprint** answers: *"Could this run be reproduced?"*

It hashes the combination of inputs that define the experiment configuration — not the outputs:

- Dataset SHA-256
- Model slug
- Condition label
- System prompt SHA-256
- Temperature
- Batch size
- Tools enabled
- Harness version

Eight components in all: batch size and tool-calling change the output
materially, so they are part of the experiment's identity — two runs at
different batch sizes do **not** share a fingerprint. See
[Benchmark Spec §3.8](/docs/network/specifications/benchmark#38-fingerprint).

Two runs with identical fingerprints used the same setup. Their results should be comparable (modulo API non-determinism).

### Run Card Hash

The **run card hash** answers: *"Has this specific result file been tampered with?"*

It's the SHA-256 of the entire run card JSON (excluding the `run_card_hash` field itself). If any field changes — a score, a timestamp, a single output — the hash breaks.

:::info[When to use which]
Use the **fingerprint** to group comparable runs (same experiment, different executions). Use the **run card hash** to verify integrity of a specific result file.
:::

---

## Publishing to the Leaderboard

After completing a run, use `mt-eval publish` on the run's `<run-id>_report.json`. A write to the live leaderboard needs an explicit `--prod` (or `MT_EVAL_ALLOW_PROD=1`); `mt-eval run --publish --prod` does both steps at once:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
```

If no `--method-card` was provided during the run, `mt-eval publish` launches an interactive wizard (`method_card_wizard.py`) that walks you through describing your method (name, class, tools used, etc.). The wizard output is embedded in the run card before submission.

### Manual inspection

Run cards are saved as JSON files in the output directory (`eval/logs/harness/` by default) — inspect them there before publishing. `mt-eval publish` is the submission path; there is no PR-based run-card intake.

:::note[The submission API and web upload are not live yet]
A `POST https://champollion.dev/api/leaderboard/submit` endpoint and a Leaderboard upload UI are planned but **not yet implemented**. Until they ship, the only working submission path is `mt-eval publish`.
:::

:::warning[Leaderboard validation]
The leaderboard validates submitted run cards against the dataset registry. Submissions referencing unknown datasets, or with a broken `run_card_hash`, are rejected.
:::

:::danger[DO NOT TRAIN on evaluation data]
If your method has seen the evaluation dataset during development — as training data, few-shot examples, dictionary entries, or prompt engineering material — your submission will be **disqualified**. See [MT Evaluation](/docs/network/leaderboard/rules) for what makes a good vs. bad method.
:::

---

## See Also

- [MT Evaluation](/docs/network/leaderboard/rules) — overview, leaderboard value proposition, and good/bad method guidance
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — dataset format, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — the full JSON schema
- [Building a Method](/docs/network/specifications/methods) — the method interface for creating evaluable methods
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluation protocol, corpus format, run card schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT for metrics and how runs are scored

