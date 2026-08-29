# ⚠️ DEPRECATED — Do Not Use

> **Reference corrected 2026-07-31.** This file previously pointed at
> `github.com/gamedaysuits/gds-mt-eval-harness` and `pip install mt-eval-harness`.
> That repo is a **dead snapshot** (`CLAUDE.md`: *"never sync them"*) and the
> PyPI distribution was renamed to **`mt-eval`** on 2026-07-12. The harness
> lives in this monorepo at `arena/`.


**This directory (`test/benchmark/`) is deprecated as of 2026-05-23.**

## What was here

A Node.js benchmark runner (`run-benchmark.js`) that translated FLORES+ sentences
through OpenRouter and compared "naive" vs "register-steered" prompts. A UI-bench
track (`ui-bench/`) did the same for Signal Desktop strings.

## Why it's deprecated

1. **Wrong tool for the job.** Translation evaluation belongs in the
   MT-Eval Harness (`arena/`, PyPI `mt-eval`) —
   a purpose-built Python framework with proper metrics (chrF++, BLEU, exact match),
   significance testing, caching, multi-model parallel execution, dashboards,
   and plugin-based prompt/strategy extensibility.

2. **Methodological flaw.** FLORES+ is a news/Wikipedia corpus. Testing register
   presets (casual-tu, polite-haeyo) on formal prose doesn't measure what registers
   actually do. The harness was measuring compliance with *inappropriate* register
   instructions, not translation quality improvement.

3. **Duplicated logic.** This harness reimplemented prompt building, API calls,
   retry logic, cost tracking, and batch management — all of which the Python
   harness does better and in a framework-consistent way.

4. **Agent confusion.** AI coding agents repeatedly modified this file thinking
   it was part of the production pipeline, introducing bugs and wasted effort.

## What to use instead

```bash
# Install the eval harness
pipx install mt-eval-harness

# Run any corpus through any model
mt-eval run --corpus path/to/corpus.json --model gemini-3.1-pro

# Multi-model parallel benchmark
mt-eval run --corpus path/to/corpus.json \
  -m gemini-3.1-pro,claude-opus-4.7,gpt-5.5

# Score and compare
mt-eval test eval/logs/run_*.json
mt-eval dashboard eval/logs/*.json
```

The harness supports FLORES+ and other standard formats natively via
parallel text files, TSV, JSONL, and its own wrapped JSON format.

## Files preserved

The files here are preserved for historical reference but should not be
modified, extended, or used for new evaluation work.
