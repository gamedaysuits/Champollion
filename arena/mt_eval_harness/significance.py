"""
Statistical significance testing for system comparison on a shared test set.

Two paired tests are provided, and they answer subtly different questions:

1. ``paired_approximate_randomization()`` — the paired approximate randomization
   (AR) test of Riezler & Maxwell (2005). This is the **default** for deciding
   whether two systems differ (``run_significance_tests`` uses it), matching
   SacreBLEU's default ("ar"). It builds a null distribution by exchanging the
   two systems' per-segment outputs at random — the null hypothesis being that,
   segment by segment, it does not matter which system produced which output —
   and reports a properly two-sided achieved significance level (ASL). Because
   the shuffling is done under H0, this is a genuine hypothesis test.

2. ``paired_bootstrap()`` — the Koehn (2004) paired bootstrap resampling
   heuristic. It resamples segments with replacement and counts how often the
   sign of the system difference flips. This is a **conservative / biased
   estimate, NOT the textbook ASL** of Efron & Tibshirani (1993, Ch. 16): the
   bootstrap-of-pairs distribution is centered on the *observed* delta, not on
   the null (delta = 0), so the sign-flip frequency is a sign-robustness /
   percentile quantity rather than a true null-hypothesis p-value. Riezler &
   Maxwell (2005) show that bootstrap resampling can *overstate* significance
   relative to AR. We keep it for continuity with WMT/Koehn practice and label
   it honestly; we do not use it as the default accept/reject rule.

Both tests use the Monte-Carlo p-value correction ``p = (count + 1) / (N + 1)``
(Davison & Hinkley 1997; North, Curtis & Sham 2002; Phipson & Smyth 2010,
"Permutation P-values Should Never Be Zero"): a resampling p-value can never be
exactly 0, because the observed configuration is itself one of the draws the
null could have produced.

REFERENCES:
  - Koehn, P. (2004). "Statistical Significance Tests for Machine Translation
    Evaluation." EMNLP 2004.
  - Riezler, S. & Maxwell, J. (2005). "On Some Pitfalls in Automatic Evaluation
    and Significance Testing for MT." ACL Workshop on Intrinsic and Extrinsic
    Evaluation Measures for MT and/or Summarization.
  - Efron, B. & Tibshirani, R. (1993). "An Introduction to the Bootstrap,"
    Ch. 16 (hypothesis testing; achieved significance level).
  - Phipson, B. & Smyth, G. K. (2010). "Permutation P-values Should Never Be
    Zero." Statistical Applications in Genetics and Molecular Biology 9(1).
  - Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." WMT 2018.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from sacrebleu.metrics import CHRF, BLEU


# Resampling p-values use the Monte-Carlo +1 correction (Davison & Hinkley 1997;
# Phipson & Smyth 2010): p = (count + 1) / (N + 1). Floating-point comparisons of
# resampled deltas against the observed delta use this tolerance so that a
# resample that ties the observed magnitude is counted (the conservative choice).
_EPS = 1e-12


@dataclass
class SignificanceResult:
    """Result of a paired significance test.

    The exact meaning of ``p_value`` depends on ``method``:
      - "approximate_randomization": a genuine two-sided achieved significance
        level (ASL) — the null-hypothesis probability of a difference at least
        as extreme as the observed one (Riezler & Maxwell 2005).
      - "paired_bootstrap": the Koehn (2004) sign-flip frequency — a
        CONSERVATIVE / BIASED estimate, not a true ASL (the bootstrap
        distribution is not centered under H0). Read it as a sign-robustness
        bound, not a hypothesis-test p-value.
    Both apply the +1 Monte-Carlo correction, so ``p_value`` is never exactly 0.
    """
    metric_name: str           # e.g., "corpus_chrf", "exact_match_rate"
    system_a_score: float      # Score for system A
    system_b_score: float      # Score for system B
    delta: float               # A - B
    p_value: float             # see class docstring + `method` for exact meaning
    n_bootstrap: int           # resampling iterations (bootstrap resamples / AR trials)
    confidence_level: float    # 1 - alpha
    significant: bool          # p_value < alpha
    winner: str | None         # "A", "B", or None if not significant
    ci_lower: float            # Lower bound of 95% bootstrap-percentile CI on the delta
    ci_upper: float            # Upper bound of 95% bootstrap-percentile CI on the delta
    method: str = "paired_bootstrap"  # "approximate_randomization" | "paired_bootstrap"


def _validate_pair(entries_a: list[dict], entries_b: list[dict]) -> None:
    """Validate that two entry lists are aligned for a paired test."""
    if len(entries_a) != len(entries_b):
        raise ValueError(
            f"Entry count mismatch: A has {len(entries_a)}, B has {len(entries_b)}"
        )
    ids_a = [e.get("id") for e in entries_a]
    ids_b = [e.get("id") for e in entries_b]
    if ids_a != ids_b:
        raise ValueError(
            "Entry IDs do not match between systems A and B. "
            "Both must be evaluated on the same entries in the same order."
        )


def _empty_result(metric_name: str, n: int, alpha: float, method: str) -> SignificanceResult:
    """The degenerate result for an empty entry set (no test possible)."""
    return SignificanceResult(
        metric_name=metric_name,
        system_a_score=0.0,
        system_b_score=0.0,
        delta=0.0,
        p_value=1.0,
        n_bootstrap=n,
        confidence_level=1.0 - alpha,
        significant=False,
        winner=None,
        ci_lower=0.0,
        ci_upper=0.0,
        method=method,
    )


def _bootstrap_deltas(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    n_bootstrap: int,
    rng: random.Random,
) -> list[float]:
    """Paired bootstrap distribution of the delta metric_fn(A) - metric_fn(B).

    Both systems are resampled on the SAME drawn indices each iteration so the
    pairing is preserved.
    """
    n = len(entries_a)
    deltas = []
    for _ in range(n_bootstrap):
        indices = [rng.randint(0, n - 1) for _ in range(n)]
        sample_a = [entries_a[i] for i in indices]
        sample_b = [entries_b[i] for i in indices]
        deltas.append(metric_fn(sample_a) - metric_fn(sample_b))
    return deltas


def _percentile_ci(sorted_deltas: list[float], n: int, alpha: float) -> tuple[float, float]:
    """Percentile CI bounds from a sorted resampled-delta distribution.

    Raises:
        ValueError: when fewer than 10 resamples back the interval. With n that
            small the percentile indices collapse toward the extremes and the
            "CI" degenerates (often to a single repeated value — zero width),
            which would then be published as if it were a real interval.
    """
    if n < 10:
        raise ValueError(
            f"Refusing to compute a percentile CI from {n} bootstrap resamples: "
            "with fewer than 10 the interval is degenerate (indices collapse, "
            "width can be zero) and would be reported as if it were real. "
            "Use n_bootstrap >= 10 (1000 is the standard)."
        )
    lo_idx = int(n * (alpha / 2))
    hi_idx = int(n * (1 - alpha / 2)) - 1
    return sorted_deltas[lo_idx], sorted_deltas[hi_idx]


def paired_bootstrap(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int = 12345,
    metric_name: str = "metric",
) -> SignificanceResult:
    """Koehn (2004) paired bootstrap resampling heuristic.

    Resamples segments with replacement and counts how often the sign of the
    system difference flips relative to the observed delta. The reported
    ``p_value`` is ``(sign_flips + 1) / (n_bootstrap + 1)``.

    HONEST LABEL — what this is and is NOT:
      This is the common WMT/Koehn sign-flip heuristic, **not** the textbook
      achieved significance level (ASL) of Efron & Tibshirani (1993, Ch. 16).
      The bootstrap-of-pairs distribution is centered on the *observed* delta,
      not on the null (delta = 0), so the sign-flip frequency measures how
      robust the *direction* of the difference is to resampling — a percentile /
      sign-robustness quantity — rather than the probability of the data under
      H0. It is a conservative/biased estimate that Riezler & Maxwell (2005)
      show can overstate significance versus approximate randomization. For the
      actual accept/reject decision on system comparisons, prefer
      ``paired_approximate_randomization`` (the default in
      ``run_significance_tests``). The +1 correction follows Davison & Hinkley
      (1997) / Phipson & Smyth (2010): a resampling p-value is never exactly 0.

    Ties (a resample whose delta is exactly 0, against a nonzero observed delta)
    count as sign-flips — the conservative choice. When the observed delta is
    itself 0 there is no direction to confirm, so every resample counts and the
    p-value takes its maximum, (n_bootstrap + 1) / (n_bootstrap + 1) = 1.0.

    Args:
        entries_a: Per-entry results from system A (from TestReport["entries"])
        entries_b: Per-entry results from system B (must be same length, same IDs)
        metric_fn: Function(list[dict]) -> float that computes the corpus-level
                   metric from a list of entry dicts.
        n_bootstrap: Number of bootstrap iterations (1000 is standard)
        alpha: Significance level (0.05 = 95% confidence)
        seed: RNG seed for reproducibility (12345 matches SacreBLEU default)
        metric_name: Human-readable name for the metric being tested

    Returns:
        SignificanceResult with ``method="paired_bootstrap"``.

    Raises:
        ValueError: If entries_a and entries_b have different lengths or IDs.
    """
    _validate_pair(entries_a, entries_b)
    if not entries_a:
        return _empty_result(metric_name, len(entries_a), alpha, "paired_bootstrap")

    n = len(entries_a)
    score_a = metric_fn(entries_a)
    score_b = metric_fn(entries_b)
    actual_delta = score_a - score_b

    rng = random.Random(seed)
    bootstrap_deltas = _bootstrap_deltas(entries_a, entries_b, metric_fn, n_bootstrap, rng)

    # Sign-flip count: resamples that disagree with the observed direction.
    # Ties (delta == 0) count as flips. When actual_delta == 0 there is no
    # direction to confirm, so all resamples count → p = 1.0 (see docstring).
    if actual_delta == 0:
        sign_flips = n_bootstrap
    elif actual_delta > 0:
        sign_flips = sum(1 for d in bootstrap_deltas if d <= 0)
    else:
        sign_flips = sum(1 for d in bootstrap_deltas if d >= 0)

    # Monte-Carlo p-value with the +1 correction (never exactly 0).
    p_value = (sign_flips + 1) / (n_bootstrap + 1)

    bootstrap_deltas.sort()
    ci_lower, ci_upper = _percentile_ci(bootstrap_deltas, n_bootstrap, alpha)

    significant = p_value < alpha
    winner = ("A" if actual_delta > 0 else "B") if significant else None

    return SignificanceResult(
        metric_name=metric_name,
        system_a_score=round(score_a, 4),
        system_b_score=round(score_b, 4),
        delta=round(actual_delta, 4),
        p_value=round(p_value, 4),
        n_bootstrap=n_bootstrap,
        confidence_level=round(1.0 - alpha, 2),
        significant=significant,
        winner=winner,
        ci_lower=round(ci_lower, 4),
        ci_upper=round(ci_upper, 4),
        method="paired_bootstrap",
    )


def paired_approximate_randomization(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    n_trials: int = 1000,
    alpha: float = 0.05,
    seed: int = 12345,
    metric_name: str = "metric",
    n_bootstrap_ci: int = 1000,
) -> SignificanceResult:
    """Paired approximate randomization (AR) test — Riezler & Maxwell (2005).

    This is the test SacreBLEU uses by default ("ar") for system comparison,
    and the default in ``run_significance_tests``. Unlike the bootstrap
    heuristic, it builds the null distribution *under H0*: for each trial, each
    segment's two system outputs are randomly assigned (with probability 0.5,
    swapped) to two piles, the corpus metric is recomputed on each pile, and we
    count how often the resulting absolute delta is at least as large as the
    observed absolute delta. The null hypothesis is per-segment exchangeability
    — that it makes no difference which system produced a given segment.

    The reported ``p_value`` is the two-sided achieved significance level (ASL):

        p = (#{ |shuffled_delta| >= |observed_delta| } + 1) / (n_trials + 1)

    The +1 correction (Davison & Hinkley 1997; Phipson & Smyth 2010) reflects
    that the observed, un-shuffled assignment is itself one valid draw under H0,
    so the p-value can never be exactly 0. When the observed delta is 0, every
    shuffle is "at least as extreme" and p = 1.0.

    The confidence interval on the delta is the bootstrap percentile CI (the AR
    procedure yields a p-value, not an interval), computed on an independent RNG
    stream so it does not perturb the AR draws.

    Args:
        entries_a: Per-entry results from system A (from TestReport["entries"])
        entries_b: Per-entry results from system B (same length, same IDs)
        metric_fn: Function(list[dict]) -> float, corpus-level metric.
        n_trials: Number of randomization trials (1000 standard; more → finer
                  p-value resolution).
        alpha: Significance level (0.05 = 95% confidence)
        seed: RNG seed for reproducibility.
        metric_name: Human-readable name for the metric being tested.
        n_bootstrap_ci: Bootstrap iterations for the delta CI.

    Returns:
        SignificanceResult with ``method="approximate_randomization"``.

    Raises:
        ValueError: If entries_a and entries_b have different lengths or IDs.
    """
    _validate_pair(entries_a, entries_b)
    if not entries_a:
        return _empty_result(metric_name, len(entries_a), alpha, "approximate_randomization")

    n = len(entries_a)
    score_a = metric_fn(entries_a)
    score_b = metric_fn(entries_b)
    actual_delta = score_a - score_b
    abs_delta = abs(actual_delta)

    rng = random.Random(seed)
    at_least_as_extreme = 0
    for _ in range(n_trials):
        pile_x = []
        pile_y = []
        for i in range(n):
            if rng.random() < 0.5:
                pile_x.append(entries_a[i])
                pile_y.append(entries_b[i])
            else:
                pile_x.append(entries_b[i])
                pile_y.append(entries_a[i])
        shuffled_delta = metric_fn(pile_x) - metric_fn(pile_y)
        if abs(shuffled_delta) >= abs_delta - _EPS:
            at_least_as_extreme += 1

    # Two-sided ASL with the +1 correction.
    p_value = (at_least_as_extreme + 1) / (n_trials + 1)

    # Bootstrap percentile CI on the delta, on a separate RNG stream so the CI
    # draws are independent of the AR shuffles.
    ci_rng = random.Random(seed + 1)
    boot = _bootstrap_deltas(entries_a, entries_b, metric_fn, n_bootstrap_ci, ci_rng)
    boot.sort()
    ci_lower, ci_upper = _percentile_ci(boot, n_bootstrap_ci, alpha)

    significant = p_value < alpha
    winner = ("A" if actual_delta > 0 else "B") if significant else None

    return SignificanceResult(
        metric_name=metric_name,
        system_a_score=round(score_a, 4),
        system_b_score=round(score_b, 4),
        delta=round(actual_delta, 4),
        p_value=round(p_value, 4),
        n_bootstrap=n_trials,
        confidence_level=round(1.0 - alpha, 2),
        significant=significant,
        winner=winner,
        ci_lower=round(ci_lower, 4),
        ci_upper=round(ci_upper, 4),
        method="approximate_randomization",
    )


# ---------------------------------------------------------------------------
# Built-in metric functions
# ---------------------------------------------------------------------------

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


def fst_acceptance_rate(entries: list[dict]) -> float:
    """Compute FST acceptance rate from a list of entry dicts.

    Each entry may have FST validity data under plugin_metrics, stored
    under 'giellalt_fst_validity'. All FST languages use the same
    GiellaLTFSTMetric key — there is no language-specific fallback.
    The value is a float 0.0–1.0 representing the proportion of FST-valid
    words in that entry's output. We average these across entries that have
    FST data and are not errors.

    Returns 0.0 if no entries have FST data. This function is designed
    for bootstrap resampling — it can be called on any subset of entries.
    """
    fst_values = []
    for entry in entries:
        if entry.get("error"):
            continue
        plugin_metrics = entry.get("plugin_metrics", {})
        if not isinstance(plugin_metrics, dict):
            continue
        fst_data = plugin_metrics.get("giellalt_fst_validity", {})
        if not isinstance(fst_data, dict):
            continue
        fst_val = fst_data.get("fst_validity")
        if isinstance(fst_val, (int, float)):
            fst_values.append(float(fst_val))
    if not fst_values:
        return 0.0
    return sum(fst_values) / len(fst_values)


def composite_score(
    entries: list[dict],
    *,
    profile: str | None = None,
    base_scores: dict | None = None,
) -> float:
    """Composite over a (possibly resampled) entry set — for bootstrap CIs.

    Recomputes the per-entry-derivable DETERMINISTIC metrics (chrF++, exact-match,
    FST acceptance) on THIS resample and scores them with the card-resolved
    ``profile`` (a name in scoring.PROFILE_REGISTRY). When ``base_scores`` is given
    — the corpus-level values of the remaining deterministic metrics (semantic,
    equivalent, behavioral, morph) — they are included and held fixed across
    resamples, so the bootstrap CI matches the headline composite's metric set and
    weights (only the resample-able components vary; the standard treatment of a
    composite with non-resampleable terms).

    Back-compat: with no ``profile`` it resolves ``fst-coverage`` when this sample
    has FST data else ``surface-only`` — reproducing the retired ``has_fst`` boolean.
    A neural metric is NEVER scored here — the composite is deterministic
    (scoring.NEURAL_METRICS); any neural key in ``base_scores`` is ignored by
    compute_composite_score (not in any weight table).

    Returns 0.0 if no composite can be computed (e.g., no valid entries).
    """
    # Import here to avoid circular imports at module level.
    # scoring.py does not import significance.py.
    from mt_eval_harness.scoring import compute_composite_score

    non_error = [e for e in entries if not e.get("error")]
    if not non_error:
        return 0.0

    # Determine whether FST data is present in this sample.
    has_fst = any(
        isinstance(
            e.get("plugin_metrics", {}).get("giellalt_fst_validity", {}),
            dict,
        )
        and isinstance(
            e.get("plugin_metrics", {}).get("giellalt_fst_validity", {}).get("fst_validity"),
            (int, float),
        )
        for e in non_error
    )

    # Start from the corpus-level base (non-resampleable deterministic metrics),
    # then OVERRIDE the resample-able metrics with values recomputed on THIS sample.
    # chrF++ stays in native sacrebleu scale (0–100); scoring.py normalizes it.
    scores = dict(base_scores or {})
    scores["chrf_plus_plus"] = corpus_chrf(non_error)
    scores["exact_match_rate"] = exact_match_rate(non_error)
    if has_fst:
        scores["fst_acceptance_rate"] = fst_acceptance_rate(non_error)

    # Use the card-resolved profile when given; else reproduce the legacy
    # fst-coverage/surface-only selection (no neural profile — those were removed).
    eff_profile = profile if profile is not None else (
        "fst-coverage" if has_fst else "surface-only"
    )
    result = compute_composite_score(scores, profile=eff_profile)
    # compute_composite_score returns None if no metrics are available
    return result if result is not None else 0.0


# ---------------------------------------------------------------------------
# Convenience: run all standard significance tests
# ---------------------------------------------------------------------------

def _paired_test(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    *,
    method: str,
    n_bootstrap: int,
    alpha: float,
    seed: int,
    metric_name: str,
) -> SignificanceResult:
    """Dispatch a single paired test by method name."""
    if method == "approximate_randomization":
        return paired_approximate_randomization(
            entries_a, entries_b, metric_fn=metric_fn,
            n_trials=n_bootstrap, alpha=alpha, seed=seed, metric_name=metric_name,
        )
    if method == "paired_bootstrap":
        return paired_bootstrap(
            entries_a, entries_b, metric_fn=metric_fn,
            n_bootstrap=n_bootstrap, alpha=alpha, seed=seed, metric_name=metric_name,
        )
    raise ValueError(
        f"Unknown significance method {method!r}; "
        "expected 'approximate_randomization' or 'paired_bootstrap'."
    )


def run_significance_tests(
    report_a: dict,
    report_b: dict,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int = 12345,
    method: str = "approximate_randomization",
) -> list[SignificanceResult]:
    """Run paired significance tests on all standard metrics.

    Compares two TestReport dicts on exact_match_rate, corpus_chrf, and
    corpus_bleu. Also tests any plugin metrics that appear in BOTH reports.

    Args:
        report_a: First TestReport dict
        report_b: Second TestReport dict
        n_bootstrap: Number of resampling iterations (bootstrap resamples or AR
            trials, depending on ``method``)
        alpha: Significance level
        seed: RNG seed for reproducibility
        method: "approximate_randomization" (default; the proper two-sided ASL,
            matching SacreBLEU's default) or "paired_bootstrap" (the Koehn 2004
            sign-flip heuristic — a conservative/biased estimate; see
            ``paired_bootstrap``).

    Returns:
        List of SignificanceResult, one per metric tested.
    """
    entries_a = report_a.get("entries", [])
    entries_b = report_b.get("entries", [])

    # Align entries by ID — only test on the intersection
    ids_a = {e["id"]: e for e in entries_a}
    ids_b = {e["id"]: e for e in entries_b}
    common_ids = sorted(set(ids_a.keys()) & set(ids_b.keys()))

    if len(common_ids) < len(entries_a) or len(common_ids) < len(entries_b):
        excluded_a = len(entries_a) - len(common_ids)
        excluded_b = len(entries_b) - len(common_ids)
        if excluded_a or excluded_b:
            print(f"  NOTE: Testing on {len(common_ids)} common entries "
                  f"(excluded {excluded_a} from A, {excluded_b} from B)")

    if len(common_ids) < 10:
        print(f"  ⚠️  WARNING: Only {len(common_ids)} common entries — "
              f"significance tests may be unreliable with so few entries.")

    aligned_a = [ids_a[eid] for eid in common_ids]
    aligned_b = [ids_b[eid] for eid in common_ids]

    results = []

    # Standard metrics
    for metric_fn, name in [
        (corpus_chrf, "corpus_chrf"),
        (exact_match_rate, "exact_match_rate"),
        (corpus_bleu, "corpus_bleu"),
    ]:
        result = _paired_test(
            aligned_a, aligned_b, metric_fn,
            method=method, n_bootstrap=n_bootstrap, alpha=alpha,
            seed=seed, metric_name=name,
        )
        results.append(result)

    # Plugin metrics — test any numeric plugin metrics present in both reports
    plugins_a = report_a.get("overall", {}).get("plugin_metrics", {})
    plugins_b = report_b.get("overall", {}).get("plugin_metrics", {})
    common_plugins = set(plugins_a.keys()) & set(plugins_b.keys())

    for plugin_name in sorted(common_plugins):
        pa = plugins_a[plugin_name]
        pb = plugins_b[plugin_name]
        if not isinstance(pa, dict) or not isinstance(pb, dict):
            continue
        # Find numeric keys common to both
        common_keys = set(pa.keys()) & set(pb.keys())
        for key in sorted(common_keys):
            if not isinstance(pa[key], (int, float)) or not isinstance(pb[key], (int, float)):
                continue

            # Build a metric function that extracts this plugin metric per-entry
            def _make_plugin_fn(pname, pkey):
                def fn(entries):
                    vals = []
                    for e in entries:
                        pm = e.get("plugin_metrics", {})
                        if isinstance(pm, dict) and pname in pm:
                            pd = pm[pname]
                            if isinstance(pd, dict) and pkey in pd:
                                v = pd[pkey]
                                if isinstance(v, (int, float)):
                                    vals.append(v)
                    return sum(vals) / len(vals) if vals else 0.0
                return fn

            metric_fn = _make_plugin_fn(plugin_name, key)
            result = _paired_test(
                aligned_a, aligned_b, metric_fn,
                method=method, n_bootstrap=n_bootstrap, alpha=alpha,
                seed=seed, metric_name=f"{plugin_name}.{key}",
            )
            results.append(result)

    return results


_METHOD_LABELS = {
    "approximate_randomization": "paired approximate randomization",
    "paired_bootstrap": "paired bootstrap (Koehn 2004 sign-flip)",
}


def format_significance_table(results: list[SignificanceResult]) -> str:
    """Format significance results as a human-readable table."""
    method = results[0].method if results else "approximate_randomization"
    method_label = _METHOD_LABELS.get(method, method)
    alpha_str = f"{round(1 - results[0].confidence_level, 4):g}" if results else "?"
    lines = [
        "",
        f"  Significance Tests ({method_label}, "
        f"n={results[0].n_bootstrap if results else '?'}, "
        f"α={alpha_str}):",
        "",
        f"  {'Metric':<25s} {'A':>8s} {'B':>8s} {'Δ':>8s} {'p-value':>8s} {'Sig?':>5s}",
        f"  {'-'*25} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*5}",
    ]
    for r in results:
        sig_marker = "Yes *" if r.significant else "No"
        delta_str = f"{'+' if r.delta >= 0 else ''}{r.delta:.2f}"
        lines.append(
            f"  {r.metric_name:<25s} "
            f"{r.system_a_score:>8.2f} "
            f"{r.system_b_score:>8.2f} "
            f"{delta_str:>8s} "
            f"{r.p_value:>8.3f} "
            f"{sig_marker:>5s}"
        )
    if method == "paired_bootstrap":
        lines.append("")
        lines.append(
            "  Note: paired-bootstrap p-values are the Koehn-2004 sign-flip "
            "heuristic (a conservative/biased"
        )
        lines.append(
            "  estimate, not a true ASL). For accept/reject use approximate "
            "randomization (the default)."
        )
    lines.append("")
    return "\n".join(lines)
