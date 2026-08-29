"""
Bootstrap confidence intervals for individual MT evaluation runs.

────────────────────────────────────────────────────────────────────
METHODOLOGY JUSTIFICATION
────────────────────────────────────────────────────────────────────

This module computes confidence intervals (CIs) on corpus-level metrics
for a SINGLE evaluation run, answering the question: "If we had drawn
a different test set from the same distribution, how much would this
score vary?"

METHOD CHOICE: Non-parametric paired bootstrap resampling
─────────────────────────────────────────────────────────
We use the same bootstrap resampling method that SacreBLEU, WMT shared
tasks, and the broader MT research community have standardized on:

  1. Given N test entries with computed per-entry results,
  2. Resample N entries WITH REPLACEMENT, B times,
  3. Recompute the corpus-level metric on each bootstrap sample,
  4. Take the 2.5th and 97.5th percentiles as the 95% CI bounds.

This is the percentile bootstrap method (Efron, 1979). It is:
  - Non-parametric: no assumption about score distributions
  - Well-understood by the MT community since Koehn (2004)
  - The method behind SacreBLEU's --paired-bs flag
  - The method used in WMT findings papers (2022-2024)

PARAMETER CHOICES:
─────────────────
  n_bootstrap = 1000 (default)
    - Matches SacreBLEU default (sacrebleu --paired-bs-n default = 1000)
    - Matches Koehn (2004) recommendation
    - WMT 2024 findings use 1000 iterations
    - Fewer than 1000 → unstable CI boundaries (Monte Carlo error)
    - 10,000 is more precise but ~10x slower; 1000 is the convention

  seed = 12345 (default)
    - Matches SacreBLEU's hardcoded default seed (SACREBLEU_SEED env var)
    - Ensures reproducibility: same entries + same seed = same CI
    - NOT arbitrary — chosen to match the tool our community uses

  alpha = 0.05 (default)
    - Standard 95% confidence level
    - Consistent with WMT significance testing conventions

SMALL SAMPLE CONSIDERATIONS:
────────────────────────────
With N < 100 entries (the EDTeKLA master corpus has N=404), bootstrap CIs are
still valid but will be WIDE, correctly reflecting the high uncertainty.
Per Koehn (2004), bootstrap resampling provides meaningful uncertainty
estimates even at N ≈ 300. Below N=30, we emit a warning because:
  - The bootstrap cannot create information that isn't in the sample
  - Percentile CIs may have poor coverage with very few observations
  - The intervals are still useful as rough uncertainty bounds

We do NOT use:
  - Normal approximation CIs (assumes normality — inappropriate for
    bounded metrics like exact match rate on small samples)
  - BCa bootstrap (bias-corrected accelerated — more accurate for
    skewed distributions but harder to explain and implement, and
    the MT community doesn't use it)
  - Bayesian credible intervals (valid but unfamiliar to MT reviewers
    and not comparable to published WMT results)

REFERENCES:
  - Koehn, P. (2004). "Statistical Significance Tests for Machine
    Translation Evaluation." EMNLP 2004.
  - Efron, B. (1979). "Bootstrap Methods: Another Look at the
    Jackknife." Annals of Statistics.
  - Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores."
    WMT 2018. (SacreBLEU paper)
  - WMT 2024 Findings: bootstrap resampling with n=1000 for
    system-level metric confidence.
────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import random
from dataclasses import dataclass, asdict

from mt_eval_harness.significance import (
    corpus_chrf,
    corpus_bleu,
    exact_match_rate,
    fst_acceptance_rate,
    composite_score,
)
from mt_eval_harness.metrics_comet import HAS_COMET
from mt_eval_harness.metrics_metricx import HAS_METRICX


def _comet_from_cached_scores(entries: list[dict]) -> float:
    """Compute corpus COMET from pre-cached per-entry scores.

    This avoids re-running neural inference on every bootstrap iteration.
    tester.py injects 'comet_score' into each entry dict after COMET
    scoring; this function simply takes the mean of those cached scores.

    Falls back to 0.0 if no entries have cached COMET scores.
    """
    scores = [
        e["comet_score"]
        for e in entries
        if not e.get("error") and isinstance(e.get("comet_score"), (int, float))
    ]
    return sum(scores) / len(scores) if scores else 0.0


def _metricx_from_cached_scores(entries: list[dict]) -> float:
    """Compute corpus MetricX from pre-cached per-entry scores.

    Same cached-score trick as COMET (tester.py injects 'metricx_score'), so the
    bootstrap never re-runs the mT5 model. NOTE: MetricX is LOWER-IS-BETTER — the
    mean is an error magnitude, and the resulting CI bounds must be read with that
    direction (a lower bound is the OPTIMISTIC end). The bootstrap math itself is
    direction-agnostic; only interpretation differs.

    Falls back to 0.0 if no entries have cached MetricX scores.
    """
    scores = [
        e["metricx_score"]
        for e in entries
        if not e.get("error") and isinstance(e.get("metricx_score"), (int, float))
    ]
    return sum(scores) / len(scores) if scores else 0.0


@dataclass
class ConfidenceInterval:
    """Bootstrap confidence interval for a single metric on a single run.

    All fields are populated by bootstrap_ci(). The 'score' field is the
    actual observed corpus-level metric; ci_lower and ci_upper are the
    percentile bootstrap bounds.
    """
    metric_name: str        # e.g., "corpus_chrf", "exact_match_rate"
    score: float            # Observed corpus-level score
    ci_lower: float         # Lower CI bound (alpha/2 percentile)
    ci_upper: float         # Upper CI bound (1 - alpha/2 percentile)
    ci_width: float         # ci_upper - ci_lower (convenience field)
    n_bootstrap: int        # Number of bootstrap iterations used
    confidence_level: float # 1 - alpha (e.g., 0.95)
    n_entries: int          # Number of entries in the sample
    seed: int               # RNG seed used (for reproducibility)


# ── Default parameters ───────────────────────────────────────────────────────
# These match SacreBLEU and WMT conventions. See module docstring for
# justification of each value.

DEFAULT_N_BOOTSTRAP = 1000
DEFAULT_ALPHA = 0.05
DEFAULT_SEED = 12345

# Below this entry count, CIs are still computed but a warning is printed.
# The bootstrap cannot create information absent from the sample; with very
# few entries the intervals will be wide and may have poor coverage.
MIN_RELIABLE_ENTRIES = 30


def bootstrap_ci(
    entries: list[dict],
    metric_fn: callable,
    n_bootstrap: int = DEFAULT_N_BOOTSTRAP,
    alpha: float = DEFAULT_ALPHA,
    seed: int = DEFAULT_SEED,
    metric_name: str = "metric",
) -> ConfidenceInterval:
    """Compute a bootstrap confidence interval for a corpus-level metric.

    Resamples the entry list B times with replacement, recomputes the
    metric on each sample, and returns the percentile CI bounds.

    Args:
        entries: Per-entry result dicts (from TestReport["entries"]).
        metric_fn: Function(list[dict]) -> float. Must compute a corpus-level
                   metric from a list of entry dicts. Use the same functions
                   from significance.py (corpus_chrf, corpus_bleu, exact_match_rate).
        n_bootstrap: Number of bootstrap iterations. Default: 1000 (SacreBLEU convention).
        alpha: Significance level. Default: 0.05 → 95% CI.
        seed: RNG seed for reproducibility. Default: 12345 (SacreBLEU convention).
        metric_name: Human-readable label for the metric.

    Returns:
        ConfidenceInterval with all fields populated.
    """
    n = len(entries)

    # Handle empty input gracefully
    if n == 0:
        return ConfidenceInterval(
            metric_name=metric_name,
            score=0.0,
            ci_lower=0.0,
            ci_upper=0.0,
            ci_width=0.0,
            n_bootstrap=n_bootstrap,
            confidence_level=round(1.0 - alpha, 2),
            n_entries=0,
            seed=seed,
        )

    # Small sample warning — CIs still computed but may be unreliable
    if n < MIN_RELIABLE_ENTRIES:
        print(
            f"  ⚠️  WARNING: Only {n} entries — bootstrap CIs may have "
            f"poor coverage below {MIN_RELIABLE_ENTRIES} entries."
        )

    # Compute the actual observed score
    observed_score = metric_fn(entries)

    # Bootstrap resampling
    rng = random.Random(seed)
    bootstrap_scores = []

    for _ in range(n_bootstrap):
        # Sample N entries with replacement
        sample = [entries[rng.randint(0, n - 1)] for _ in range(n)]
        bootstrap_scores.append(metric_fn(sample))

    # Percentile CI bounds
    # Sort and take the alpha/2 and 1-alpha/2 percentile positions
    bootstrap_scores.sort()
    lower_idx = int(n_bootstrap * (alpha / 2))
    upper_idx = int(n_bootstrap * (1 - alpha / 2)) - 1

    # Clamp indices to valid range
    lower_idx = max(0, min(lower_idx, n_bootstrap - 1))
    upper_idx = max(0, min(upper_idx, n_bootstrap - 1))

    ci_lower = bootstrap_scores[lower_idx]
    ci_upper = bootstrap_scores[upper_idx]

    return ConfidenceInterval(
        metric_name=metric_name,
        score=round(observed_score, 4),
        ci_lower=round(ci_lower, 4),
        ci_upper=round(ci_upper, 4),
        ci_width=round(ci_upper - ci_lower, 4),
        n_bootstrap=n_bootstrap,
        confidence_level=round(1.0 - alpha, 2),
        n_entries=n,
        seed=seed,
    )


def _entries_have_fst_data(entries: list[dict]) -> bool:
    """Check if any entry has FST plugin data in plugin_metrics.

    Returns True if at least one non-error entry has a numeric
    fst_validity value under plugin_metrics.giellalt_fst_validity.
    There is no language-specific fallback — all FST languages use
    the same GiellaLTFSTMetric key.
    """
    for entry in entries:
        if entry.get("error"):
            continue
        pm = entry.get("plugin_metrics", {})
        if not isinstance(pm, dict):
            continue
        fst_data = pm.get("giellalt_fst_validity", {})
        if not isinstance(fst_data, dict):
            continue
        fst_val = fst_data.get("fst_validity")
        if isinstance(fst_val, (int, float)):
            return True
    return False


def compute_all_cis(
    entries: list[dict],
    n_bootstrap: int = DEFAULT_N_BOOTSTRAP,
    alpha: float = DEFAULT_ALPHA,
    seed: int = DEFAULT_SEED,
) -> dict[str, dict]:
    """Compute bootstrap CIs for all standard metrics.

    Returns a dict keyed by metric name, each value is a serialized
    ConfidenceInterval (suitable for JSON embedding in a TestReport).

    Conditionally includes:
        - fst_acceptance_rate: only when FST plugin data exists in entries
        - composite_score: only when at least chrF++ and exact_match are
          available (always true for non-error entries with expected/predicted)

    Args:
        entries: Per-entry result dicts (from TestReport["entries"]).
                 Entries with errors are filtered out for chrF++/BLEU.
        n_bootstrap: Bootstrap iterations.
        alpha: Significance level.
        seed: RNG seed.

    Returns:
        {"corpus_chrf": {...}, "corpus_bleu": {...}, "exact_match_rate": {...},
         "fst_acceptance_rate": {...},  # if FST data present
         "composite_score": {...},      # if chrF++ and EM available
        }
    """
    # Filter to non-error entries for metric computation
    # (Matches the filtering logic in tester.py)
    valid_entries = [e for e in entries if not e.get("error")]

    if not valid_entries:
        return {}

    # A bootstrap needs at least two observations to vary: with n == 1 every
    # resample is identical, so the "95% CI" collapses to a zero-width
    # [score, score] band that reads as spurious precision. Don't report a
    # bootstrap interval that the data can't support — the smoke-test path
    # (`mt-eval run … --ids <one-id>`) is the common way to hit n == 1.
    if len(valid_entries) < 2:
        return {}

    # --- Core metrics (always computed) ---
    results = {}
    for metric_fn, name in [
        (corpus_chrf, "corpus_chrf"),
        (corpus_bleu, "corpus_bleu"),
        (exact_match_rate, "exact_match_rate"),
    ]:
        ci = bootstrap_ci(
            valid_entries,
            metric_fn=metric_fn,
            n_bootstrap=n_bootstrap,
            alpha=alpha,
            seed=seed,
            metric_name=name,
        )
        results[name] = asdict(ci)

    # --- FST acceptance rate (only when FST data exists) ---
    if _entries_have_fst_data(valid_entries):
        ci = bootstrap_ci(
            valid_entries,
            metric_fn=fst_acceptance_rate,
            n_bootstrap=n_bootstrap,
            alpha=alpha,
            seed=seed,
            metric_name="fst_acceptance_rate",
        )
        results["fst_acceptance_rate"] = asdict(ci)

    # --- COMET (neural metric, when installed) ---
    # Uses pre-computed per-entry COMET scores from tester.py rather than
    # re-running model inference on each bootstrap iteration. The
    # _comet_from_cached_scores function reads entry["comet_score"] values.
    if HAS_COMET:
        has_comet_scores = any(
            isinstance(e.get("comet_score"), (int, float))
            for e in valid_entries
            if not e.get("error")
        )
        if has_comet_scores:
            ci = bootstrap_ci(
                valid_entries,
                metric_fn=_comet_from_cached_scores,
                n_bootstrap=n_bootstrap,
                alpha=alpha,
                seed=seed,
                metric_name="comet",
            )
            results["comet"] = asdict(ci)

    # --- MetricX-24 (neural, LOWER-IS-BETTER; when installed + requested) ---
    # Bootstraps from the per-entry MetricX scores tester.py cached on each entry
    # (no second neural pass). Direction lives with the metric, not the CI: the
    # bounds are read as error magnitudes (lower = better).
    if HAS_METRICX:
        has_metricx_scores = any(
            isinstance(e.get("metricx_score"), (int, float))
            for e in valid_entries
            if not e.get("error")
        )
        if has_metricx_scores:
            ci = bootstrap_ci(
                valid_entries,
                metric_fn=_metricx_from_cached_scores,
                n_bootstrap=n_bootstrap,
                alpha=alpha,
                seed=seed,
                metric_name="metricx",
            )
            results["metricx"] = asdict(ci)

    # --- Composite score (when chrF++ and exact_match are available) ---
    # chrF++ and exact_match are always computable from valid entries that
    # have expected/predicted text. We verify by checking that at least
    # one entry has non-empty expected text.
    has_text_data = any(
        e.get("expected", "").strip() for e in valid_entries
    )
    if has_text_data:
        ci = bootstrap_ci(
            valid_entries,
            metric_fn=composite_score,
            n_bootstrap=n_bootstrap,
            alpha=alpha,
            seed=seed,
            metric_name="composite_score",
        )
        results["composite_score"] = asdict(ci)

    return results


def compute_per_tier_cis(
    entries: list[dict],
    n_bootstrap: int = DEFAULT_N_BOOTSTRAP,
    alpha: float = DEFAULT_ALPHA,
    seed: int = DEFAULT_SEED,
) -> dict[int, dict]:
    """Compute bootstrap CIs grouped by difficulty tier.

    Groups entries by their 'difficulty' field (0-5) and computes
    CIs for corpus_chrf and exact_match_rate within each tier.

    This enables answering questions like:
        "Is our system significantly worse at Tier 4-5 than at Tier 1?"
        "How wide are the error bars per difficulty level?"

    Args:
        entries: Entry dicts with 'difficulty', 'expected', 'predicted'.
        n_bootstrap: Number of bootstrap iterations.
        alpha: Significance level (default 0.05 → 95% CI).
        seed: Random seed for reproducibility.

    Returns:
        Dict mapping difficulty level (int) to a dict of metric CIs.
        Example: {1: {"corpus_chrf": {...}, "exact_match_rate": {...}}}
    """
    # Group entries by difficulty tier
    tiers: dict[int, list[dict]] = {}
    for e in entries:
        if e.get("error"):
            continue
        tier = e.get("difficulty", 0)
        tiers.setdefault(tier, []).append(e)

    # Skip if only one tier (no meaningful per-tier breakdown)
    if len(tiers) <= 1:
        return {}

    results = {}
    for tier, tier_entries in sorted(tiers.items()):
        # Need at least 5 entries per tier for meaningful CIs
        if len(tier_entries) < 5:
            continue

        tier_cis = {}

        # chrF++ CI per tier
        ci = bootstrap_ci(
            tier_entries,
            metric_fn=corpus_chrf,
            n_bootstrap=n_bootstrap,
            alpha=alpha,
            seed=seed + tier,  # Vary seed per tier for independence
            metric_name=f"corpus_chrf_tier{tier}",
        )
        tier_cis["corpus_chrf"] = asdict(ci)

        # Exact match CI per tier
        ci = bootstrap_ci(
            tier_entries,
            metric_fn=exact_match_rate,
            n_bootstrap=n_bootstrap,
            alpha=alpha,
            seed=seed + tier,
            metric_name=f"exact_match_rate_tier{tier}",
        )
        tier_cis["exact_match_rate"] = asdict(ci)

        results[tier] = tier_cis

    return results


def format_score_with_ci(score: float, ci: dict, is_percentage: bool = False) -> str:
    """Format a score with its CI for console display.

    Examples:
        format_score_with_ci(42.96, {"ci_lower": 40.1, "ci_upper": 45.8})
        → "42.96  [40.1 – 45.8]"

        format_score_with_ci(0.198, {"ci_lower": 0.12, "ci_upper": 0.276}, is_percentage=True)
        → "19.8%  [12.0 – 27.6%]"
    """
    lower = ci.get("ci_lower", 0)
    upper = ci.get("ci_upper", 0)

    if is_percentage:
        return (
            f"{score * 100:.1f}%  "
            f"[{lower * 100:.1f} – {upper * 100:.1f}%]"
        )
    return f"{score:.2f}  [{lower:.1f} – {upper:.1f}]"
