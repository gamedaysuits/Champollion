# ⚠️ DEPRECATED — Do Not Use

> **Reference corrected 2026-07-31.** This file previously pointed at
> `github.com/gamedaysuits/gds-mt-eval-harness` and `pip install mt-eval-harness`.
> That repo is a **dead snapshot** (`CLAUDE.md`: *"never sync them"*) and the
> PyPI distribution was renamed to **`mt-eval`** on 2026-07-12. The harness
> lives in this monorepo at `arena/`.


**This directory (`test/benchmark/ui-bench/`) is deprecated as of 2026-05-23.**

## What was here

A benchmark using 2,665 Signal Desktop UI strings across 6 languages,
designed to test whether register-steered LLM translation outperforms
naive prompting on real-world UI localization strings.

## Why it's deprecated

1. **The concept is being generalized.** The main evaluation harness
   (`arena/`, PyPI `mt-eval`)
   supports benchmarking by register, context, model, and cost natively.
   A UI-string-specific runner is unnecessary when the harness can run
   any corpus through any condition matrix.

2. **Dataset limitations.** Signal's translations are community-contributed
   and partially machine-assisted in some locales, making them unreliable
   as "professional human reference" baselines.

3. **Scope overlap.** The harness's method plugin system, run card schema,
   and Supabase-backed leaderboard provide everything this runner did —
   plus significance testing, multi-dataset support, and reproducibility
   features this runner lacked.

## What to use instead

The eval harness supports FLORES+, EDTeKLA, and custom datasets natively.
Register conditions, temperature sweeps, and multi-model comparison are
first-class features of the harness, not bolted-on benchmarks.

```bash
mt-eval run --corpus path/to/ui-strings.json \
  --model gemini-3.1-pro \
  --condition register \
  --submit
```

## Files preserved

The files here are preserved for historical reference but should not be
modified, extended, or used for new evaluation work.
