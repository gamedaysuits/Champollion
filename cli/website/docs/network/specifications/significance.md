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

> **Status**: ✅ Shipped. Paired significance testing (approximate randomization by default; the paired bootstrap on request) and bootstrap confidence intervals are implemented in `mt_eval_harness/significance.py` and `mt_eval_harness/confidence.py`, exported from the package, exposed on the CLI, and covered by the significance / confidence / scoring test suites.
> **Codebase**: `arena` — wired into `tester.py` (per-run confidence intervals) and `compare.py` (between-run significance).
> **Purpose**: Let researchers determine whether the difference between two evaluation runs is statistically significant or just noise.

This page documents the **shipped behavior** — it is descriptive, not a to-do list.

---

## Why This Matters

When comparing two runs (illustrative: System A chrF++ 42.96 vs System B chrF++ 41.80 on 92 entries), a raw point difference says nothing on its own about whether it is real or noise. With only ~92 test entries, random variation can easily produce 1–2 point swings. Experts ask for significance tests — so the harness computes them.

**Under the scoring standard (`standard/1`), the paired test on chrF++ is what decides whether one run is better than another.** chrF++ is the pre-declared primary metric ([Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored)). BLEU, spBLEU, TER and COMET (when both runs carry per-segment COMET scores from the same model) are tested and shown as secondary standard metrics, and exact match and plugin rates as diagnostics; none of them decides. This follows Kocmi et al. (2021, "To Ship or Not to Ship"), who found across thousands of human judgments that a metric difference together with its significance is what predicts human preference.

---

## Algorithm: Paired Approximate Randomization (default)

`mt-eval compare --significance` uses the **paired approximate randomization
(AR)** test of Riezler & Maxwell (2005). This is also SacreBLEU's default for
comparing systems.

### How It Works

Given two systems A and B evaluated on the same N test entries:

1. Compute the observed corpus-level difference: `Δ = metric(A) - metric(B)`.
2. Repeat `n_trials` times (default 1000):
   a. For each entry, swap A's and B's outputs with probability ½.
   b. Recompute the corpus metric on the two shuffled piles.
   c. Record whether `|Δ_shuffled| ≥ |Δ|`.
3. The p-value is the two-sided achieved significance level:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. The +1 counts the
   observed assignment as one valid draw, so p is never exactly 0.
4. If p < α (default 0.05), the difference is reported as significant.

The confidence interval on Δ is a bootstrap percentile interval (AR yields a
p-value, not an interval). It is computed on a separate random stream so it
does not disturb the AR draws.

### Key Properties

- **A real hypothesis test:** the shuffles are drawn under the null hypothesis
  that it makes no difference which system produced a given entry.
- **Paired:** both systems are compared entry by entry, which preserves
  entry-level correlation.
- **Non-parametric:** it makes no assumption about how scores are distributed.

### The paired bootstrap (available, not the default)

`paired_bootstrap()` implements Koehn's (2004) paired bootstrap: it resamples
entries with replacement and counts how often the sign of Δ flips. It is
offered for comparability with older papers, but it is a sign-robustness
heuristic, not a textbook significance level. Its distribution is centred on
the observed Δ, not on the null, so it can overstate significance compared
with AR. Select it on the command line with
`mt-eval compare <reports…> --significance --method paired_bootstrap`, or with
`method="paired_bootstrap"` in `run_significance_tests`.

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

The significance implementation (approximate randomization by default, paired bootstrap on request). Its public surface:

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

`compare.py` does side-by-side comparison of multiple TestReports and runs significance testing between them. `run_significance_tests()` drives the tests across two reports and `format_significance_table()` renders them. Every result carries its `role`: `primary` (chrF++ — the one test that decides), `secondary` (the other standard metrics) or `diagnostic`. It tests, in this order:

| Metric | Role | Computed per resample from |
|---|---|---|
| `corpus_chrf` | primary | sacreBLEU statistics per segment |
| `corpus_bleu` | secondary | sacreBLEU statistics per segment |
| `corpus_spbleu` | secondary | sacreBLEU statistics per segment, on the FLORES-200 SentencePiece tokenizer (spBLEU is BLEU with that tokenizer, the figure FLORES/NLLB tables report). When the tokenizer is unavailable (no `sentencepiece`, or offline with the model not yet downloaded) it is listed as not tested, never dropped silently |
| `corpus_ter` | secondary | sacreBLEU statistics per segment. TER is an edit rate, so **lower is better**: a negative Δ favours A |
| `comet_score` | secondary | the per-segment COMET scores both reports already carry (their mean is COMET's system score; the model is never re-run). Listed as not tested, with the reason, when only one run was scored with COMET or the two used different COMET models |
| `exact_match_rate` | diagnostic | each entry's exact-match flag |
| Plugin rates in both reports, e.g. `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate` | diagnostic | the plugin's own per-entry results, aggregated the way the headline was |

**The retired composite is not tested.** The weighted composite and the `segment_composite` row that used to be tested here are retired by the scoring standard ([Scoring Specification §4](/docs/network/specifications/scoring#4-composite-score)). A comparison JSON written before the standard still shows its `segment_composite` (or `composite_score`) rows, labelled as a legacy composite that decides nothing. When a compared report is a legacy one, `compare` says its composite is retired and does not compare it.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

When more than 2 reports are compared, pairwise significance tests run for all pairs: `significance` is then a list of `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}` objects, one per pair, each `tests` list shaped like the two-report case. `letters` are the two runs' letters in the run table, and Δ is the first minus the second.

Beside `significance`, the comparison JSON carries `significance_settings`: the `method`, `n_resamples`, `alpha`, `seed`, which run each letter is (`runs`), what `ci_lower`/`ci_upper` are, `multiple_testing_correction: "none"`, how many metrics were tested per pair and over how many pairs, the plain-words note about uncorrected p-values (below), and any notes the tests raised (entries excluded from a pairing, metrics not tested).

### 5. CLI integration

`mt-eval compare` exposes a `--significance` flag, with `--method` to choose the paired test (`approximate_randomization`, the default, or `paired_bootstrap`) and `--n-bootstrap` to set the iteration count:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` takes the `*_report.json` files `mt-eval run` writes (or the run logs, whose sibling report it uses). It prints the run table with one row per metric and one column per run, then the significance table, and writes the comparison JSON to a neutral place unless `-o` names another file: `comparison-<hash>.json` beside the reports when they share a folder, else in `comparisons/` in their nearest common folder (reports in each run's own folder, such as `run_benchmark`'s `mcp-run-<id>/` folders, never get a comparison written into one of them). The `<hash>` is the first ten hex characters of a sha256 over the compared runs' ids in the order given, so another comparison in the same folder never overwrites this one; comparing the same runs again rewrites their own file. Naming a file with `-o` replaces whatever is there, and the output says so. It prints the path it wrote. A comparison of runs on a local-only, sealed or consent-required corpus quotes their sentences, so it carries that corpus's mark in a `<file>.champollion.json` sidecar wherever it is written.

The run table's **Avg latency (s/entry)** shows `—` for a run that recorded no time, with a note under the table saying why: every entry came from the cache, the outputs were made outside the harness, or the method reported none. A value under 0.01 s is shown to four decimals (a small model on a CPU decodes in a few milliseconds a sentence), never rounded to 0.00.

### 6. Output format

`format_significance_table()` renders the console view; the same data is added to the comparison JSON.

The reports are lettered in the order given: the first is run **A**, the second **B**, then **C**, **D** and so on, the same letters as the run table above. Every pairwise table names its two runs by those letters and their run ids, for example `--- A (baseline) vs C (nllb-ft) ---`, and its columns and Δ use the same letters (`Δ (A−C)`). Δ is always **first − second**. The explanation of the table and every note under it are printed **once**, however many pairs there are. Each row also prints the 95% **CI on Δ**: the bootstrap percentile interval in the JSON's `ci_lower`/`ci_upper`, which says how large the difference plausibly is, not only its sign. Each metric is marked with its direction from the metric registry (↑ higher is better, ↓ lower is better), and a **Better** column names the run with the better score, direction-aware, with `(n.s.)` when the difference is not significant. So a lower-is-better rate such as TER, code switching or hallucination that went up prints a positive Δ with **B** as the better run, and a trained model passed second that beats its baseline by 63.5 chrF++ prints Δ −63.52 with **B** better. A metric whose direction the registry does not declare is shown with `?`. Scores, Δ and the interval are printed to two decimals, and to more (up to six) on a row where that would hide a real difference: a spBLEU of 0.0684 against 0.0673 prints Δ +0.0011 [+0.0001, +0.0021], never +0.00 [+0.00, +0.00] beside **Yes**, and the table says those rows carry more decimals. The JSON keeps four decimals, and four significant figures for a non-zero value smaller than that, so a real difference is never stored as 0. Identical outputs give Δ exactly 0 and p = 1, so they are never significant. If p falls below α while the bootstrap interval on Δ is exactly [0, 0] (too few segments differ to estimate the difference), **Sig?** shows `?†` and **Better** `—†`, with a note: no run is called better on it. For a lower-is-better plugin rate, the JSON `winner` is direction-aware too (the lower rate wins), as it always was for `corpus_ter`; a plugin rate with no better direction (neutral, such as `morph_coverage`, or undeclared) has `winner: null`. Each result also carries its `direction`.

**Console output** (illustrative numbers):
```
  Significance Tests (paired approximate randomization, n=1000, α=0.05):
  Each table names its two runs by their letters in the run table above.
  Δ = first run − second run.  ↑ higher is better, ↓ lower is better.
  Better = the run with the better score, by the metric's direction; (n.s.) = not significant.
  95% CI on Δ = bootstrap percentile interval: how large the difference plausibly is.

  --- A (baseline) vs B (coached) ---

  Metric                                          A        B  Δ (A−B)      95% CI on Δ  p-value  Sig?  Better
  ---------------------------------------- -------- -------- -------- ---------------- -------- -----  --------
  ↑ corpus_chrf                               42.96    41.80    +1.16   [-0.85, +3.12]    0.142    No  A (n.s.)
  ↑ corpus_bleu                                6.80     3.81    +2.99   [+0.61, +5.40]    0.018 Yes *  A
  ↑ corpus_spbleu                              9.10     6.42    +2.68   [+0.35, +5.02]    0.027 Yes *  A
  ↓ corpus_ter                                61.20    64.90    -3.70   [-7.05, -0.41]    0.030 Yes *  A
  ↑ exact_match_rate                           0.20     0.19    +0.01   [-0.03, +0.05]    0.381    No  A (n.s.)
  ↓ code_switching.avg_code_switching_rate     0.60     0.08    +0.52   [+0.45, +0.59]    0.001 Yes *  B

  p-values are per metric and uncorrected — no multiple-testing correction is
  applied (deliberately: the MT convention is to report each metric's own
  p-value). 6 metrics were tested, so one "significant" result at p<0.05 can
  turn up by chance alone. And a small Δ can be significant yet not
  meaningful: check the CI on Δ (how large the difference plausibly is) and
  how reliable the metric is for this language before acting on it.
```

In this example the verdict is **no significant difference**: chrF++, the primary metric, does not separate A and B (p = 0.142), so neither run is called better — even though BLEU, spBLEU and TER favour A and code-switching favours B. Those rows are shown, and a reader may want to look into them, but they do not decide. The table lists chrF++ first, then the other standard metrics, then the diagnostics.

With more than two runs, one `--- X (run) vs Y (run) ---` table follows another under the single header, and the note counts every test made (`6 metrics were tested per pair (36 tests over 6 pairs)`).

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
      "ci_upper": 3.12,
      "method": "approximate_randomization",
      "direction": "higher",
      "role": "primary"
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

4. **Plugin metrics**: A plugin rate that appears in BOTH reports is tested only from per-segment values the report actually holds. That means the plugin's own aggregation over its per-entry results (the FST metric), or the mean of the per-entry value an `avg_<name>` aggregate averages (the behavioural metrics). A plugin rate with no per-segment values is listed as not tested, never shown as 0.00 vs 0.00. Counts such as `total_words_checked` are not tested.

5. **Reproducibility**: The RNG seed must be logged in the output so results are exactly reproducible. Default to 12345 (matching SacreBLEU convention).

---

## What NOT to Build

- **No COMET re-inference in the test**: COMET is paired-tested from the per-segment scores both reports already carry; the model is never re-run per resample. Two runs scored with different COMET models are not tested against each other.
- **No Bayesian analysis**: Stick to frequentist bootstrap. It's what the MT community expects and understands.
- **No multi-test correction**: When testing multiple metrics, don't apply Bonferroni or similar corrections. The convention in MT evaluation is to report raw p-values per metric and let the reader interpret. `mt-eval compare` **says so** in its output and in `comparison.json` (`significance_settings.multiple_testing_correction: "none"` with a plain-words note): with several metrics tested, one result at p < 0.05 can turn up by chance alone, and a small Δ can be significant without mattering, so read the CI on Δ and the metric's reliability for the language before acting on a single "significant".

---

## Ranking clusters {#ranking-clusters}

> **Status**: ✅ Shipped, for contests. A contest ranking is a set of **clusters**, not a strict order — the significance test decides which neighbouring entries are actually distinguishable. This section describes what ships, including where the evidence is weaker than a paired test.

### Adjacent chaining, competition numbering

Entries are partitioned by **track** first — a `constrained` system is never ranked against an `unconstrained` one, and each track carries its own ordering, tie groups and rank ranges, so "rank 1" always means rank 1 *within a track*.

Within a track, entries are ordered by the contest's primary metric (chrF++ unless the contest recorded a different one), then by the remaining surface metrics and finally by earliest submission. Every **adjacent** pair in that order is tested. A pair the test cannot separate shares a rank, and shared ranks **chain**: if A ties B and B ties C, all three land in one tie group even when A and C were never compared directly.

Ranks use competition numbering — a three-way tie at the top is `1, 1, 1` and the next entry is `4`; a two-way tie for second is `1, 2, 2, 4`.

**The honest limit of chaining**: non-significance is not transitive. A long chain can join two entries that a direct test *would* separate. That is why a cluster is reported as a **range**, not a point.

### Rank ranges

Every entry carries `rank_min` and `rank_max` — the best and worst position consistent with the evidence, in the style WMT uses for its rank ranges. An entry alone in its cluster has `rank_min == rank_max`. An entry inside a cluster of four spanning positions 2–5 carries `rank_min: 2, rank_max: 5`, and **no entry inside that cluster is "ahead of" another**. A single-number rank taken out of a cluster is a misreading of the result.

### The evidence ladder

Not every pair can be tested the same way, so each pair records the rung the verdict actually came from. The label is part of the result, never dropped:

| Rung | Evidence | When it is available | Strength |
|---|---|---|---|
| 1 | **Per-segment paired test** — approximate randomization by default, paired bootstrap on request (the algorithm described above) | Only when BOTH entries carry a complete, aligned per-segment score set | The real test |
| 2 | **95% bootstrap-CI overlap** on the published interval bounds | When the primary metric has confidence-interval bounds on both entries (chrF++ does; BLEU and COMET have no interval columns) | A conservative proxy — overlapping intervals do **not** prove equivalence, and non-overlap is a stricter bar than a paired test |
| 3 | **Point equality** at the metric's display rounding | Always | The weakest rung: it says only that the two printed numbers are identical |

### Sealed contests: rung 1 runs on the node

Rung 1 needs per-segment scores from both systems. In a sealed contest the organizer's evaluation node holds the references and **never exports per-segment output**. That is the whole point of the sealed lane, and it is not a setting that can be relaxed. So the paired test goes to the data instead.

`mt-eval node verdicts` runs the contest's own paired test on the node, over the sealed references and every pair of entries it scored, and writes **verdicts only**: for each pair, the method, p-value, score difference, its confidence interval and the segment count. No segment, reference or translation is in the file. The node signs it with its score-sign key. The organizer then closes with `mt-eval contest close --node-verdicts <file> --verify-key <node public key>`. The ranking uses the verdicts only if the signature verifies and they were computed for this contest, its sealed set, its metric, its frozen tie policy and its promised harness version. Otherwise the close refuses.

When no verdicts are supplied, a sealed contest's ties rest on confidence-interval overlap where the metric has intervals, and on point equality where it does not. Its clusters are then wider than a paired test's would be. The ranking itself states which case applies: `ranking_method.evidence_used` names the rungs actually used, and `ranking_method.node_verdicts` names the node whose verdicts were used, if any.

### What the ranking does not rank

- **Contrastive entries** are reported in their own section and never win.
- **Runtime, hardware and cost** ride the run card and are reported, never ranked. There is no efficiency track.
- **Human judgment** is not in these rankings at all. A human-evaluation *selection* — which systems a fixed budget would cover, taking whole tie groups so a cluster is never cut in half — can be recorded against a closed contest, but no ratings exist; see the [MT Evaluation Rules](/docs/network/leaderboard/rules#verification-tiers).

---

## Module Map

Where the shipped feature lives:

| File | Role |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` declared as a hard dependency |
| `mt_eval_harness/tester.py` | Direct sacrebleu import (no `HAS_SACREBLEU` guard); computes per-run CIs |
| `mt_eval_harness/significance.py` | Paired tests (`paired_approximate_randomization`, the default, and `paired_bootstrap`), `SignificanceResult`, built-in metric fns (chrF++, BLEU, spBLEU, TER, COMET from cached per-segment scores, exact match; the retired segment-level composite is kept only to read old comparison files), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap confidence intervals: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exports `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Significance tests wired into report comparison |
| `mt_eval_harness/cli.py` | `--significance` / `--method` / `--n-bootstrap` (compare) and `--no-ci` / `--n-bootstrap-ci` (test) flags |
| `mt_eval_harness/dashboard.py` | Surfaces significance in the comparison table (optional enhancement) |

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


The chrF++ interval is part of the published headline (`chrF++ 47.5 [45.9, 49.0]`). CIs are **also** computed for `comet_score`, bootstrapped from its cached per-entry scores (no redundant neural inference). No composite CI is computed for new runs; a legacy card's stored composite CI is re-derived only when that card is verified.

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

### COMET (a standard metric when computed, beside chrF++)

COMET is a **neural metric shown beside the chrF++ headline** whenever it was computed, with its model id. It is never blended with chrF++, and it is not the headline because it needs a large model and is uncalibrated for most low-resource languages (see [Scoring Specification §2.3](/docs/network/specifications/scoring#2-metric-inventory)). Bootstrap CIs are computed over its cached per-entry scores:
- Model: `Unbabel/wmt22-comet-da` (WMT 2022 reference-based model); AfriCOMET auto-selected for supported African languages
- Computed when `unbabel-comet` is installed
- Per-entry scores stored in TestReport entries; the corpus value carries a low-resource calibration caveat
- Re-derived by the verifier — a reported COMET value must reproduce
- Optional dependency: `python3 -m pip install 'mt-eval-harness[comet]'` (or `mt-eval setup --comet`)

### Supabase columns

The `run_cards` table carries the corresponding nullable columns (see [scoring.md §9.1](/docs/network/specifications/scoring)):
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — the headline and its 95% interval
- `comet_score` (`real`) — shown beside the headline, never blended
- `corpus_bleu` (`real`)

The full set of confidence intervals is stored within the run-card `scores` JSON under `confidence_intervals` (per the run-card schema in scoring.md §9); only the chrF++ bounds are also denormalized as columns.

