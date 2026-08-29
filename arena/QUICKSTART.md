# MT Eval Harness — Quick Start

> Run your first translation evaluation in under 5 minutes.

---

## Prerequisites

- **Python 3.11+**
- **API key**: `export OPENROUTER_API_KEY=sk-or-...`

## 1. Install

```bash
cd arena
pip install -e .
```

## 2. Setup (per language)

**Most languages need nothing beyond the base install** — including the
Global Voices example below. The harness ships a dataset registry and
fetches each corpus from its upstream source on demand. If a dataset
requires extra dependencies, the harness reads the language card and
tells you exactly what to run.

### Languages with an eval pack (e.g. Plains Cree)

A few languages ship an **eval pack** — extra tools needed for accurate,
morphology-aware evaluation. The harness won't let you run a CRK dataset
without it:

```bash
# One command installs: pyhfst, spaCy, en_core_web_md model,
# requests, and downloads the ALTLab FST morphological analyzer.
mt-eval setup --lang crk
```

## 3. Run an evaluation

```bash
# Confirm your install works — no API key needed. The corpus is fetched
# from its upstream source (Global Voices / OPUS) and cached locally.
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 \
  -m claude-sonnet -n my-first-run --dry-run --yes
#   → "Would process 945 entries"

# Then run it for real (needs your API key):
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 \
  -m claude-sonnet -n my-first-run --yes

# The harness will:
# 1. Validate your config
# 2. Fetch + cache the corpus from source (license-gated; --yes accepts)
# 3. Run translations (batched, cached, parallelized)
# 4. Score with metrics (chrF++, BLEU, …)
# 5. Print a human-readable run card
# 6. On a terminal, ask if you want to publish to the leaderboard.
#    (Non-interactive/CI: it prints the publish command instead — or pass
#    --publish to publish in the same step. See §5.)
```

> **Publishing is a separate step by default — for `mt-eval run`.** A run
> scores and writes a report; it does **not** auto-publish. On a terminal it
> *offers* to publish; otherwise publish with `mt-eval publish <report>` (§5),
> or add `--publish` to `run` to do both in one command.
> **The one exception is the queue worker:** `mt-eval queue` (§6) resolves a
> publishing identity up front — sign in (attributed) or continue anonymously,
> no account needed — and **auto-publishes each successful run** unless you
> pass `--no-publish`.

### Common model shortcuts

| Shortcut | Model |
|----------|-------|
| `claude-sonnet` | anthropic/claude-sonnet-4 |
| `gemini-pro` | google/gemini-2.5-pro-preview |
| `gemini-flash` | google/gemini-2.5-flash-preview |
| `gpt` | openai/gpt-4.1 |

Or pass any full [OpenRouter model ID](https://openrouter.ai/models):

```bash
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m anthropic/claude-fable-5 --yes
```

### Multi-model comparison

```bash
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 \
  -m claude-sonnet,gemini-pro,gpt -n model-comparison --yes
```

All models run in parallel.

## 4. Analyze an existing run

```bash
# Re-score a previous run (auto-prints the run card)
mt-eval test eval/logs/harness/run_*.json

# View the run card for a completed run
mt-eval card eval/logs/harness/run_*.json

# Compare multiple runs
mt-eval compare eval/logs/harness/*_report.json

# Generate an interactive HTML dashboard
mt-eval dashboard eval/logs/harness/*_report.json
```

## 5. Publish to the leaderboard

Publishing is its own step. After a `run` or `test` **on a terminal**, the
harness offers it:

```
  → Publish this run to the arena? [y/N]:
```

In a non-interactive shell (CI, piped) it prints the command instead of
prompting. Either way, you can publish a report explicitly:

```bash
mt-eval publish eval/logs/harness/run_*_report.json      # confirms first
mt-eval publish --yes eval/logs/harness/run_*_report.json # scripted, no prompt
```

**One-step run + publish.** Add `--publish` to a real run to score *and*
publish without a prompt — the same content-safety gating applies (NC /
held-out / unregistered corpora publish aggregate scores only):

```bash
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 \
  -m claude-sonnet -n my-first-run --yes --publish
```

**No account needed to publish.** Sign in (GitHub/Google) only if you want
your name on the board; `--anonymous` publishes as submitter `anonymous`
through the rate-limited public intake (same integrity gates, same
leaderboard display).

## 6. Contribute compute (one command)

Don't want to pick corpora yourself? The public queue ranks every open
(corpus, model, condition) by expected chain value — how much the run
strengthens the whole language mesh per estimated dollar:

```bash
mt-eval queue --top 5             # run the 5 highest-value open items
mt-eval queue --budget 2.50       # or bound by estimated spend
mt-eval queue --top 3 --dry-run   # show the plan, run nothing
```

The plan and estimated cost are confirmed before anything executes.
**Unlike a single `mt-eval run`, the queue worker auto-publishes each
successful run** — before spending tokens it resolves how results publish:
sign in (GitHub/Google) to have them attributed to you, or continue
anonymously (no account; submitter shows as `anonymous`; `--anonymous`
forces it, and non-interactive runs with no cached sign-in default to it).
Pass `--no-publish` to keep results local (you can always publish them
later with `mt-eval publish`).
Details:
https://champollion.dev/docs/network/getting-started/contributing-compute

---

## What the run card looks like

```
┌──────────────────────────────────────────────────────────────────────┐
│                      MT EVAL HARNESS — RUN CARD                      │
├──────────────────────────────────────────────────────────────────────┤
│ Model                  anthropic/claude-fable-5                      │
│ Target language        crk                                           │
│ Entries                436            Errors        0                │
├──────────────────────────────────────────────────────────────────────┤
│ SCORES                                                               │
│ chrF++                 49.4  [47.5 – 51.3]                          │
│ BLEU                   5.0   [3.3 – 6.8]                            │
│ Exact match            16/436 (3.7%)                                │
├──────────────────────────────────────────────────────────────────────┤
│ LYSS EQUIVALENCE LINTER                                              │
│ Equivalent match       104/436 (23.9%)                               │
│   ├ Exact              16/436 (3.7%)                                 │
│   └ Near-miss          87/436 (20.2%)                                │
├──────────────────────────────────────────────────────────────────────┤
│ FST MORPHOLOGICAL VALIDITY                                           │
│ Word validity          1144/1381 (82.8%)                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### "EVAL PACK REQUIRED: Plains Cree"

You tried to run against a CRK dataset without installing the CRK eval pack.

```bash
mt-eval setup --lang crk
```

### "Dataset not found"

The harness will suggest the closest match. Common aliases:

| You typed | Resolves to |
|-----------|-------------|
| `edtekla-full` | `edtekla-textbook` |
| `edtekla` | `edtekla-textbook` |
| `edtekla-dev` | `edtekla-dev-v1` |
| `crk-dev` | `edtekla-dev-v1` |

### "Unknown model"

Pass the full OpenRouter model ID:

```bash
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m anthropic/claude-fable-5 --yes
```

---

## For AI Agents

If you are an AI agent running this harness:

1. **Run (works cold)**: `mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m <model> -n <name> --yes`
   — the corpus is fetched from source and cached; no eval pack needed.
   Add `--dry-run` to validate config and print `Would process N entries`
   without spending tokens.
2. **Eval-pack languages (e.g. CRK)**: Run `mt-eval setup --lang crk` first.
3. **Results**: The run card prints automatically after scoring
4. **Downloads**: Auto-consent in non-interactive mode (no TTY prompt)
5. **Publish (separate step for `run`)**: A single `mt-eval run` does NOT
   auto-publish. Either:
   - one step: add `--publish` to the run — `mt-eval run --corpus … -m <model> --yes --publish`, or
   - two steps: take the `report_path` from the run's `--json` summary and
     `mt-eval publish --yes <report>`.
   Both apply the same content-safety gating. A signed-in session attributes
   the run to you; `--anonymous` needs no account (submitter `anonymous`).
   **Exception**: `mt-eval queue` DOES auto-publish each successful run
   (it resolves the publishing identity before spending tokens); pass
   `--no-publish` to opt out.

The harness is designed to fail fast with clear error messages.
If a dependency is missing, it tells you exactly what to install.
