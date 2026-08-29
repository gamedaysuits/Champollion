---
sidebar_position: 7
title: 'Statistical Significance Testing'
slug: '/network/specifications/significance'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The scores these tests protect"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "Where significance gates what ranks"
---

# Statistical Significance Testing

> **Status**: ✅ Shipped. Paired bootstrap significance testing and bootstrap confidence intervals are implemented in `mt_eval_harness/significance.py` and `mt_eval_harness/confidence.py`, exported from the package, exposed on the CLI, and covered by the significance / confidence / scoring test suites.
> **Codebase**: `arena` — wired into `tester.py` (per-run confidence intervals) and `compare.py` (between-run significance).
> **Purpose**: Let researchers determine whether the difference between two evaluation runs is statistically significant or just noise.

This page documents the **shipped behavior** — it is descriptive, not a to-do list.

---

## Why This Matters

When comparing two runs (illustrative: System A chrF++ 42.96 vs System B chrF++ 41.80 on 92 entries), a raw point difference says nothing on its own about whether it is real or noise. With only ~92 test entries, random variation can easily produce 1–2 point swings. Experts ask for significance tests — so the harness computes them.

---

## Algorithm: Paired Bootstrap Resampling

This is the standard method used by SacreBLEU, MT-Lens, and WMT shared tasks. It's well-understood by MT researchers and produces results they trust.

### How It Works

Given two systems A and B evaluated on the same N test entries:

1. Compute the actual metric difference: `Δ = metric(A) - metric(B)`
2. Repeat `n_bootstrap` times (default 1000):
   a. Sample N entries **with replacement** from the shared test set
   b. Compute the metric for both A and B on this bootstrap sample
   c. Compute the bootstrap difference: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. The p-value = fraction of bootstrap samples where `Δ_boot` has the opposite sign from `Δ`
4. If p-value < α (default 0.05), the difference is statistically significant

### Key Properties

- **Paired**: Both systems are evaluated on the same bootstrap sample, preserving entry-level correlation
- **Non-parametric**: No assumption about the distribution of scores
- **Standard**: This is exactly what `sacrebleu --paired-bs` does under the hood

---

## sacrebleu Is a Hard Dependency

sacrebleu is a hard dependency. An MT eval harness that cannot compute chrF++ or BLEU is not an MT eval harness, so:

1. `sacrebleu>=2.3` is declared under `[project.dependencies]` in `pyproject.toml` (not `[project.optional-dependencies]`).
2. It is imported directly in `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — with no `try/except` guard.
3. It is imported directly in `significance.py`.

There are no `HAS_SACREBLEU` conditional paths anywhere: running without sacrebleu is not a supported configuration.

---

## Implementation

### 1. sacrebleu as a hard dependency

`pyproject.toml` declares `sacrebleu>=2.3` under `[project.dependencies]`, and `tester.py` imports it directly:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

There are no `if HAS_SACREBLEU:` guards in `tester.py` — the conditional import paths were removed.

---

### 2. Module: `mt_eval_harness/significance.py`

The core paired-bootstrap implementation. Its public surface:

```python
"""
Statistical significance testing via paired bootstrap resampling.

Standard method used by WMT shared tasks, SacreBLEU, and MT-Lens.
Compares two runs on the same corpus to determine if the performance
difference is statistically significant.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from sacrebleu.metrics import CHRF, BLEU


@dataclass
class SignificanceResult:
    """Result of a paired bootstrap significance test."""
    metric_name: str           # e.g., "corpus_chrf", "exact_match_rate"
    system_a_score: float      # Score for system A
    system_b_score: float      # Score for system B
    delta: float               # A - B
    p_value: float             # Two-sided p-value
    n_bootstrap: int           # Number of bootstrap iterations
    confidence_level: float    # 1 - alpha
    significant: bool          # p_value < alpha
    winner: str | None         # "A", "B", or None if not significant
    ci_lower: float            # Lower bound of 95% CI on the delta
    ci_upper: float            # Upper bound of 95% CI on the delta


def paired_bootstrap(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int = 12345,
    metric_name: str = "metric",
) -> SignificanceResult:
    """Run paired bootstrap resampling significance test.

    Args:
        entries_a: Per-entry results from system A (from TestReport["entries"])
        entries_b: Per-entry results from system B (must be same length, same IDs)
        metric_fn: Function(list[dict]) -> float that computes the corpus-level
                   metric from a list of entry dicts. Must handle the entry format
                   from TestReport.
        n_bootstrap: Number of bootstrap iterations (1000 is standard)
        alpha: Significance level (0.05 = 95% confidence)
        seed: RNG seed for reproducibility (12345 matches SacreBLEU default)
        metric_name: Human-readable name for the metric being tested

    Returns:
        SignificanceResult with all fields populated.

    Raises:
        ValueError: If entries_a and entries_b have different lengths or IDs.
    """
    ...
```

### 3. Built-in metric functions

```python
def exact_match_rate(entries: list[dict]) -> float:
    """Compute exact match rate from a list of entry dicts."""
    non_error = [e for e in entries if not e.get("error")]
    if not non_error:
        return 0.0
    exact = sum(1 for e in non_error if e.get("exact_match"))
    return exact / len(non_error)


def corpus_chrf(entries: list[dict]) -> float:
    """Compute corpus-level chrF++ from a list of entry dicts."""
    chrf = CHRF(word_order=2)
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return chrf.corpus_score(hyps, [refs]).score


def corpus_bleu(entries: list[dict]) -> float:
    """Compute corpus-level BLEU from a list of entry dicts."""
    bleu = BLEU()
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return bleu.corpus_score(hyps, [refs]).score
```

### 4. Integration into `compare.py`

`compare.py` does side-by-side comparison of multiple TestReports and runs significance testing between them. `significance.py` also ships `fst_acceptance_rate()` and `composite_score()` (so FST and composite differences can be significance-tested), `run_significance_tests()` (drives all metrics across two reports), and `format_significance_table()` (console rendering).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

When more than 2 reports are compared, pairwise significance tests run for all pairs, keyed by `"(run_a_id, run_b_id)"`.

### 5. CLI integration

`mt-eval compare` exposes a `--significance` flag, with `--n-bootstrap` to set the iteration count:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. Output format

`format_significance_table()` renders the console view; the same data is added to the comparison JSON.

**Console output:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**JSON output** (added to comparison report):
```json
{
  "significance": [
    {
      "metric_name": "corpus_chrf",
      "system_a_score": 42.96,
      "system_b_score": 41.80,
      "delta": 1.16,
      "p_value": 0.142,
      "n_bootstrap": 1000,
      "confidence_level": 0.95,
      "significant": false,
      "winner": null,
      "ci_lower": -0.85,
      "ci_upper": 3.12
    }
  ]
}
```

### 7. Dashboard integration (optional enhancement)

When significance data is present in the comparison JSON, the dashboard can surface it — a comparison-table row with significance indicators (`*` for p < 0.05, `**` for p < 0.01). This is a presentation layer on top of the shipped computation, not part of the core feature.

---

## Edge Cases and Validation

1. **Mismatched entries**: The two TestReports must have the same entry IDs. If they don't (e.g., one ran on a subset), only test significance on the intersection. Warn about excluded entries.

2. **Too few entries**: If N < 10, warn that significance tests are unreliable with so few entries. Still run them, but print the warning.

3. **Identical scores**: If both systems produce identical per-entry results, p_value should be 1.0 (no difference at all).

4. **Plugin metrics**: The significance module should also test any plugin metrics that appear in BOTH reports. Use a generic approach: if both reports have `plugin_metrics.crk_fst_validity.avg_fst_validity`, test it.

5. **Reproducibility**: The RNG seed must be logged in the output so results are exactly reproducible. Default to 12345 (matching SacreBLEU convention).

---

## What NOT to Build

- **No separate COMET significance**: COMET is computed and reported in a **separate neural lane** — it is **never folded into any composite** (the composite is deterministic; see [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) and §2). Bootstrap CIs *can* be computed over its cached per-entry scores, but the harness does not run a built-in paired significance test for COMET. For pairwise COMET significance between two systems, use `comet-compare` from Unbabel.
- **No Bayesian analysis**: Stick to frequentist bootstrap. It's what the MT community expects and understands.
- **No multi-test correction**: When testing multiple metrics, don't apply Bonferroni or similar corrections. The convention in MT evaluation is to report raw p-values per metric and let the reader interpret.

---

## Module Map

Where the shipped feature lives:

| File | Role |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` declared as a hard dependency |
| `mt_eval_harness/tester.py` | Direct sacrebleu import (no `HAS_SACREBLEU` guard); computes per-run CIs |
| `mt_eval_harness/significance.py` | Paired-bootstrap core: `paired_bootstrap`, `SignificanceResult`, built-in metric fns, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap confidence intervals: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exports `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Significance tests wired into report comparison |
| `mt_eval_harness/cli.py` | `--significance` / `--n-bootstrap` (compare) and `--no-ci` / `--n-bootstrap-ci` (test) flags |
| `mt_eval_harness/dashboard.py` | Surfaces significance in the comparison table (optional enhancement) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Unit tests (part of the passing suite) |

---

## Test Coverage

The significance / confidence / scoring suites are green. They cover:

1. **Deterministic with seed**: same inputs + same seed → same p-value, every time
2. **Known-answer test**: two identical result sets → p_value = 1.0
3. **Known-significant test**: two result sets where one is clearly better (e.g., all exact matches vs all misses) → p_value ≈ 0.0
4. **Mismatched IDs**: raises `ValueError`, or warns and computes on the intersection
5. **Empty inputs**: handled gracefully (p_value = 1.0 or raise)

---

## Confidence Intervals (Companion Feature)

> **Status**: ✅ IMPLEMENTED in `confidence.py`

Confidence intervals (CIs) answer a different question from significance testing:

- **Significance testing** (`significance.py`): "Is the difference between system A and system B real?"
- **Confidence intervals** (`confidence.py`): "How uncertain is this system's score on its own?"

### Implementation: `confidence.py`

Uses the same percentile bootstrap resampling method as significance testing:

| Parameter | Value | Justification |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU default, WMT 2024 convention |
| `seed` | 12345 | SacreBLEU default seed for reproducibility |
| `alpha` | 0.05 | Standard 95% confidence level |
| Method | Percentile bootstrap | Koehn (2004), Efron (1979) |

### What Gets CIs

The deterministic corpus-level metrics computed by the harness:
- `corpus_chrf` (chrF++ score)
- `corpus_bleu` (BLEU score)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (when FST data is present)
- `composite` (when chrF++ and exact match are available)

CIs are **also** computed for the neural `comet_score`, bootstrapped from its cached per-entry scores (no redundant neural inference). Having a CI does not make COMET a composite metric: it is reported in a **separate neural lane** and is never folded into the composite (see [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

### CLI Flags

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Small Sample Warning

When N < 30 entries, the module emits a warning that CIs may have poor coverage. The bootstrap cannot create information absent from the sample — with very few entries, the intervals will be wide, correctly reflecting high uncertainty.

### COMET (separately reported, never composited)

COMET is a **neural metric reported in its own lane** — it is **never folded into any composite** (the composite is kept deterministic; see [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) and §2). Bootstrap CIs *are* computed over its cached per-entry scores, but it is not a "first-class" composite metric:
- Model: `Unbabel/wmt22-comet-da` (WMT 2022 reference-based model); AfriCOMET auto-selected for supported African languages
- Computed when `unbabel-comet` is installed
- Per-entry scores stored in TestReport entries; the corpus value carries a low-resource calibration caveat
- Re-derived by the verifier — a reported COMET value must reproduce
- Optional dependency: `pip install mt-eval-harness[comet]`

### Supabase columns

The `run_cards` table carries the corresponding nullable columns (see [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — the separately-reported neural score, never composited
- `corpus_bleu` (`real`)

Confidence-interval bounds are stored within the run-card `scores` JSON under `confidence_intervals` (per the run-card schema in scoring.md §9), not as denormalized top-level columns.

