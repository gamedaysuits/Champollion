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

THE SCORING STANDARD ("standard/1", scoring.py): ``run_significance_tests``
tests corpus chrF++ FIRST — the pre-declared primary metric, the one test that
decides which run is better — then the other standard metrics (BLEU, spBLEU,
TER, and COMET when both reports carry per-segment COMET scores from the same
model) as SECONDARY, then the diagnostics (exact match, plugin rates). Every
result carries its ``role`` ("primary" | "secondary" | "diagnostic"). The
weighted composite is retired: the paired battery no longer tests
``segment_composite``; :func:`composite_score` is kept only for legacy cards
(publish re-derives a pre-standard card's composite CI with it) and a
comparison JSON written before the standard still renders its
``segment_composite`` rows, labelled legacy.

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
from typing import Callable

import numpy as np
from sacrebleu.metrics import CHRF, BLEU, TER

from mt_eval_harness.metric_direction import arrow, better_side, direction_of


# Resampling p-values use the Monte-Carlo +1 correction (Davison & Hinkley 1997;
# Phipson & Smyth 2010): p = (count + 1) / (N + 1). Floating-point comparisons of
# resampled deltas against the observed delta use this tolerance so that a
# resample that ties the observed magnitude is counted (the conservative choice).
_EPS = 1e-12

# LEGACY (retired by scoring standard/1): the paired tests' old composite row.
# It was recomputed per resample from chrF++, exact match and (when the
# entries carry it) FST acceptance, re-weighted over those alone — NOT the
# published composite_score. New comparisons never test it; the name stays so
# a comparison JSON or a TestReport written before the standard still reads.
SEGMENT_COMPOSITE = "segment_composite"
SEGMENT_COMPOSITE_NOTE = (
    "segment_composite (segment-level) = chrF++ + exact match (+ FST "
    "acceptance when present), re-weighted over those alone — NOT the "
    "published composite_score. It is a LEGACY row, from a comparison "
    "written before scoring standard/1 retired the weighted composite: it "
    "decides nothing — chrF++ decides.")

# Names a comparison JSON written before 2026-10-03 used, read as today's.
LEGACY_METRIC_NAMES = {"composite_score": SEGMENT_COMPOSITE}

# ---------------------------------------------------------------------------
# Metric roles under the scoring standard (scoring.py: PRIMARY_METRIC,
# SECONDARY_METRICS, DIAGNOSTIC_METRICS), by the names the paired tests use.
# ---------------------------------------------------------------------------

#: The paired-test name of the primary metric (corpus chrF++,
#: scoring.PRIMARY_METRIC "chrf_plus_plus"): its test alone decides which of
#: two runs is better.
PRIMARY_TEST_METRIC = "corpus_chrf"
#: The other standard metrics, tested and shown beside chrF++, never deciding.
SECONDARY_TEST_METRICS = ("corpus_bleu", "corpus_spbleu", "corpus_ter",
                          "comet_score")
ROLE_PRIMARY = "primary"
ROLE_SECONDARY = "secondary"
ROLE_DIAGNOSTIC = "diagnostic"
ROLE_LEGACY = "legacy"
#: The order (and heading) of the role groups in a significance table.
ROLE_HEADINGS = (
    (ROLE_PRIMARY, "Primary — decides which run is better:"),
    (ROLE_SECONDARY, "Secondary standard metrics (shown, not used to decide):"),
    (ROLE_DIAGNOSTIC, "Diagnostics (not used to decide):"),
    (ROLE_LEGACY, "Legacy composite (retired, not used to decide):"),
)


def metric_role(name: str) -> str:
    """A paired-test metric name's role under the scoring standard:
    "primary" (corpus_chrf), "secondary" (BLEU, spBLEU, TER, COMET),
    "legacy" (the retired segment_composite / composite_score) or
    "diagnostic" (exact match and every plugin rate)."""
    name = LEGACY_METRIC_NAMES.get(name, name)
    if name == PRIMARY_TEST_METRIC:
        return ROLE_PRIMARY
    if name in SECONDARY_TEST_METRICS:
        return ROLE_SECONDARY
    if name == SEGMENT_COMPOSITE:
        return ROLE_LEGACY
    return ROLE_DIAGNOSTIC


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
    # Which way is better for this metric ("higher" | "lower" | "neutral"),
    # from the metric registry via metric_direction; None = not declared.
    # Filled by run_significance_tests; the paired tests themselves keep
    # their convention (winner "A" iff delta > 0 unless metric_fn declares
    # lower_is_better), which forge's ci_scoring relies on.
    direction: str | None = None
    # The metric's role under the scoring standard: "primary" (chrF++ — the
    # one test that decides), "secondary" (BLEU, spBLEU, TER, COMET),
    # "diagnostic", or "legacy" (the retired composite). Filled by
    # run_significance_tests; None (a result read from an older comparison
    # JSON, or made by a paired test directly) resolves by name (metric_role).
    role: str | None = None


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


def _winner(metric_fn, delta: float, significant: bool) -> str | None:
    """Which system the significant delta favours. Higher is better unless the
    metric declares ``lower_is_better`` (TER, an edit rate)."""
    if not significant:
        return None
    if getattr(metric_fn, "lower_is_better", False):
        return "A" if delta < 0 else "B"
    return "A" if delta > 0 else "B"


def _keep(value: float, places: int = 4) -> float:
    """``round(value, places)`` — except that a non-zero value never rounds
    to 0: it keeps 4 significant figures instead. A delta of 0.00004 was
    stored as 0.0 beside ``significant: True`` (Round 13: the table printed
    Δ +0.00 [+0.00, +0.00] "Yes *" for a real, tiny spBLEU difference)."""
    r = round(value, places)
    if r == 0 and value != 0:
        return float(f"{value:.4g}")
    return r


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
    stats = _paired_stats(entries_a, entries_b, metric_fn)
    deltas = []
    for _ in range(n_bootstrap):
        indices = [rng.randint(0, n - 1) for _ in range(n)]
        if stats is not None:
            # Same draws as the string path; the resample's corpus statistics
            # are the per-segment rows weighted by how often each was drawn.
            weights = np.bincount(indices, minlength=n)
            deltas.append(stats.score(weights @ stats.a, weights @ stats.included)
                          - stats.score(weights @ stats.b, weights @ stats.included))
            continue
        sample_a = [entries_a[i] for i in indices]
        sample_b = [entries_b[i] for i in indices]
        deltas.append(metric_fn(sample_a) - metric_fn(sample_b))
    return deltas


class _PairedStats:
    """Per-segment sufficient statistics for a paired sacreBLEU comparison.

    ``a`` / ``b`` are (n_segments x n_stats) integer arrays; a segment the
    corpus function excludes (no reference) is an all-zero row, and
    ``included`` marks the rest. Summing rows and scoring the sum is exactly
    what sacreBLEU's corpus_score does, so every figure equals the string path.
    """

    def __init__(self, a, b, included, scorer):
        self.a, self.b, self.included, self._scorer = a, b, included, scorer

    def score(self, summed, n_included) -> float:
        if int(n_included) == 0:
            return 0.0
        # The scorer casts what it needs: sacreBLEU wants integer counts, the
        # composite also sums a float column (per-segment FST rates).
        return self._scorer(summed)


def _paired_stats(entries_a, entries_b, metric_fn) -> "_PairedStats | None":
    """Sufficient statistics for both systems, or None if metric_fn has none."""
    stats_fn = getattr(metric_fn, "segment_stats", None)
    if stats_fn is None:
        return None
    a, included, scorer = stats_fn(entries_a)
    b, included_b, _ = stats_fn(entries_b)
    if not np.array_equal(included, included_b):
        return None  # unpaired references: fall back to the string path
    return _PairedStats(a, b, included, scorer)


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
    winner = _winner(metric_fn, actual_delta, significant)

    return SignificanceResult(
        metric_name=metric_name,
        system_a_score=_keep(score_a),
        system_b_score=_keep(score_b),
        delta=_keep(actual_delta),
        p_value=round(p_value, 4),
        n_bootstrap=n_bootstrap,
        confidence_level=round(1.0 - alpha, 2),
        significant=significant,
        winner=winner,
        ci_lower=_keep(ci_lower),
        ci_upper=_keep(ci_upper),
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
    stats = _paired_stats(entries_a, entries_b, metric_fn)
    if stats is not None:
        # Each segment lands in exactly one pile per system, so pile Y's
        # statistics are the grand total minus pile X's.
        total = stats.a.sum(axis=0) + stats.b.sum(axis=0)
        n_included = stats.included.sum()
    at_least_as_extreme = 0
    for _ in range(n_trials):
        if stats is not None:
            # The SAME draws as the string path (one rng.random() per segment,
            # in order), so p-values are identical — only faster.
            swap = np.fromiter((rng.random() < 0.5 for _ in range(n)), dtype=bool, count=n)
            pile_x = stats.a[swap].sum(axis=0) + stats.b[~swap].sum(axis=0)
            shuffled_delta = (stats.score(pile_x, n_included)
                              - stats.score(total - pile_x, n_included))
        else:
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
    winner = _winner(metric_fn, actual_delta, significant)

    return SignificanceResult(
        metric_name=metric_name,
        system_a_score=_keep(score_a),
        system_b_score=_keep(score_b),
        delta=_keep(actual_delta),
        p_value=round(p_value, 4),
        n_bootstrap=n_trials,
        confidence_level=round(1.0 - alpha, 2),
        significant=significant,
        winner=winner,
        ci_lower=_keep(ci_lower),
        ci_upper=_keep(ci_upper),
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


def corpus_chrf_plain(entries: list[dict]) -> float:
    """Compute corpus-level plain chrF (word_order=0) from a list of entry dicts.

    The chrF figure FLORES/WMT/AmericasNLP tables report; same empty-hypothesis
    handling as corpus_chrf so the two differ only in word n-grams.
    """
    chrf = CHRF(word_order=0)
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


def _spbleu_metric():
    """spBLEU's metric object — the ONE definition the report's
    ``corpus_spbleu`` is computed with (rankable_metrics.sacrebleu_metric),
    so the tested figure is the reported one. Raises when the FLORES-200
    SentencePiece tokenizer is unavailable (sentencepiece missing, or the
    model not downloadable offline)."""
    from mt_eval_harness.rankable_metrics import sacrebleu_metric
    return sacrebleu_metric("spbleu")


def corpus_spbleu(entries: list[dict]) -> float:
    """Compute corpus-level spBLEU (BLEU on the FLORES-200 SentencePiece
    tokenizer) from a list of entry dicts — same reference/empty-prediction
    handling as corpus_bleu, so the two differ only in tokenization. Like
    BLEU it is a corpus statistic, resampled from per-segment n-gram counts."""
    metric = _spbleu_metric()
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return metric.corpus_score(hyps, [refs]).score


def _sacrebleu_segment_stats(make_metric: Callable[[], object]):
    """A ``segment_stats`` companion for a sacreBLEU corpus function.

    Mirrors the string functions above exactly: a segment with no reference is
    excluded (an all-zero row), and an empty prediction is scored as "EMPTY".
    Returns ``(stats, included, scorer)``.
    """
    def segment_stats(entries: list[dict]):
        metric = make_metric()
        idx = [i for i, e in enumerate(entries) if e.get("expected", "").strip()]
        included = np.zeros(len(entries), dtype=bool)
        included[idx] = True
        if not idx:
            return np.zeros((len(entries), 1), dtype=np.int64), included, None
        hyps = [entries[i]["predicted"] if entries[i].get("predicted", "").strip() else "EMPTY"
                for i in idx]
        refs = [entries[i]["expected"] for i in idx]
        rows = metric._extract_corpus_statistics(hyps, [refs])
        stats = np.zeros((len(entries), len(rows[0])), dtype=np.int64)
        stats[idx] = np.asarray(rows, dtype=np.int64)
        return stats, included, lambda summed: metric._compute_score_from_stats(
            [int(round(x)) for x in summed]).score
    return segment_stats


def corpus_ter(entries: list[dict]) -> float:
    """Compute corpus-level TER from a list of entry dicts (LOWER is better).

    Same reference/empty-prediction handling as corpus_chrf. TER is an edit
    rate, so the paired tests read a NEGATIVE delta as A winning
    (``lower_is_better``) — see _winner.
    """
    ter = TER()
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return ter.corpus_score(hyps, [refs]).score


corpus_ter.lower_is_better = True


#: The per-entry key tester.py writes each segment's COMET score under (the
#: corpus COMET is their mean — COMET's system score).
COMET_ENTRY_KEY = "comet_score"


def _entry_comet(entry: dict) -> float | None:
    val = entry.get(COMET_ENTRY_KEY)
    if entry.get("error") or isinstance(val, bool) \
            or not isinstance(val, (int, float)):
        return None
    return float(val)


def corpus_comet(entries: list[dict]) -> float:
    """Corpus COMET from the per-segment COMET scores the report already
    carries (``entry["comet_score"]``): their mean, which is COMET's system
    score. Never re-runs the model, so a paired test resamples it like any
    other per-segment statistic. 0.0 when no entry carries a score."""
    vals = [v for v in (_entry_comet(e) for e in entries) if v is not None]
    return sum(vals) / len(vals) if vals else 0.0


def _comet_segment_stats(entries: list[dict]):
    """``segment_stats`` for corpus_comet: per segment (score, has-score);
    the corpus value of any resample is the summed score over the summed
    count — exactly corpus_comet on the resampled entries."""
    vals = [_entry_comet(e) for e in entries]
    stats = np.array([[0.0 if v is None else v, 0.0 if v is None else 1.0]
                      for v in vals], dtype=float).reshape(len(entries), 2)

    def scorer(summed) -> float:
        return float(summed[0] / summed[1]) if summed[1] > 0 else 0.0
    return stats, np.ones(len(entries), dtype=bool), scorer


corpus_comet.segment_stats = _comet_segment_stats


corpus_chrf.segment_stats = _sacrebleu_segment_stats(lambda: CHRF(word_order=2))
corpus_chrf_plain.segment_stats = _sacrebleu_segment_stats(lambda: CHRF(word_order=0))
corpus_bleu.segment_stats = _sacrebleu_segment_stats(lambda: BLEU())
corpus_spbleu.segment_stats = _sacrebleu_segment_stats(_spbleu_metric)
# TER's statistics are (edits, reference length); with the harness's single
# reference both are whole numbers, so the integer rows are exact.
corpus_ter.segment_stats = _sacrebleu_segment_stats(lambda: TER())


#: The per-entry key GiellaLTFSTMetric.compute() writes (plugins/giellalt_fst.py).
#: This module read "fst_validity" — a key no plugin has ever written — so every
#: FST significance test and bootstrap CI saw no FST data at all: 0.00 vs 0.00,
#: p=1.000, on runs measured at 4.4% vs 29.7% (synthetic researcher, sme,
#: 2026-10-03).
FST_ENTRY_RATE_KEY = "fst_validity_rate"


def entry_fst_rate(entry: dict) -> float | None:
    """One entry's FST validity rate (0.0–1.0), or None when it has none."""
    plugin_metrics = entry.get("plugin_metrics", {})
    if not isinstance(plugin_metrics, dict):
        return None
    fst_data = plugin_metrics.get("giellalt_fst_validity", {})
    if not isinstance(fst_data, dict) or fst_data.get("error"):
        return None
    val = fst_data.get(FST_ENTRY_RATE_KEY)
    if isinstance(val, bool) or not isinstance(val, (int, float)):
        return None
    return float(val)


def fst_acceptance_rate(entries: list[dict]) -> float:
    """Compute FST acceptance rate from a list of entry dicts.

    Each entry may have FST validity data under plugin_metrics, stored
    under 'giellalt_fst_validity' (FST_ENTRY_RATE_KEY). All FST languages use
    the same GiellaLTFSTMetric key — there is no language-specific fallback.
    The value is a float 0.0–1.0 representing the proportion of FST-valid
    words in that entry's output. We average these across entries that have
    FST data and are not errors.

    Returns 0.0 if no entries have FST data. This function is designed
    for bootstrap resampling — it can be called on any subset of entries.
    """
    fst_values = [
        v for v in (entry_fst_rate(e) for e in entries if not e.get("error"))
        if v is not None
    ]
    if not fst_values:
        return 0.0
    return sum(fst_values) / len(fst_values)


def composite_score(
    entries: list[dict],
    *,
    profile: str | None = None,
    base_scores: dict | None = None,
) -> float:
    """LEGACY — the retired weighted composite over a (possibly resampled)
    entry set, for bootstrap CIs of cards scored BEFORE scoring standard/1.

    No new run is scored, ranked or compared on it: the paired battery
    (:func:`run_significance_tests`) and ``confidence.compute_all_cis`` no
    longer compute it. Kept because a pre-standard card's composite CI is
    re-derived with it (publish) and old files name it.

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
    has_fst = any(entry_fst_rate(e) is not None for e in non_error)

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


def _composite_segment_stats(entries: list[dict]):
    """``segment_stats`` for composite_score called on entries alone.

    The paired tests run the composite 4,000 times per comparison; on the
    string path that is about a minute for 300 segments. These rows carry
    everything composite_score reads, per segment: chrF++ statistics (zeroed
    for an errored entry, which composite_score drops), whether chrF counted
    it, whether it is error-free, its exact match, and its FST rate. Summing
    rows and scoring the sum reproduces composite_score(entries) — same
    metrics, same profile choice (fst-coverage iff the sample has FST data).
    """
    from mt_eval_harness.scoring import compute_composite_score

    n = len(entries)
    chrf_stats, chrf_included, chrf_scorer = corpus_chrf.segment_stats(entries)
    ok = np.array([not e.get("error") for e in entries], dtype=bool)
    fst = [entry_fst_rate(e) if ok[i] else None for i, e in enumerate(entries)]
    k = chrf_stats.shape[1]
    stats = np.column_stack([
        chrf_stats * ok[:, None],                                   # 0..k-1
        (chrf_included & ok).astype(float),                         # k
        ok.astype(float),                                           # k+1
        [1.0 if ok[i] and e.get("exact_match") else 0.0
         for i, e in enumerate(entries)],                           # k+2
        [0.0 if v is None else 1.0 for v in fst],                   # k+3
        [0.0 if v is None else v for v in fst],                     # k+4
    ]).astype(float)

    def scorer(summed) -> float:
        n_ok = summed[k + 1]
        if n_ok <= 0:
            return 0.0
        chrf = (chrf_scorer(summed[:k])
                if summed[k] > 0 and chrf_scorer is not None else 0.0)
        scores = {"chrf_plus_plus": chrf, "exact_match_rate": summed[k + 2] / n_ok}
        has_fst = summed[k + 3] > 0
        if has_fst:
            scores["fst_acceptance_rate"] = summed[k + 4] / summed[k + 3]
        result = compute_composite_score(
            scores, profile="fst-coverage" if has_fst else "surface-only")
        return result if result is not None else 0.0

    return stats, np.ones(n, dtype=bool), scorer


composite_score.segment_stats = _composite_segment_stats


# ---------------------------------------------------------------------------
# Convenience: run all standard significance tests
# ---------------------------------------------------------------------------

#: The method names ``run_significance_tests`` (and ``mt-eval compare
#: --method``) accept; the first is the default.
SIGNIFICANCE_METHODS = ("approximate_randomization", "paired_bootstrap")


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
    notes: list[str] | None = None,
    labels: tuple[str, str] = ("A", "B"),
) -> list[SignificanceResult]:
    """Run paired significance tests, scoring standard/1 order.

    Compares two TestReport dicts on, in this order:

    * ``corpus_chrf`` — corpus chrF++, the PRE-DECLARED PRIMARY metric
      (role "primary"): its test alone decides which run is better;
    * the other standard metrics (role "secondary"): ``corpus_bleu``,
      ``corpus_spbleu`` (BLEU on the FLORES-200 SentencePiece tokenizer —
      listed as not tested when that tokenizer is unavailable),
      ``corpus_ter`` (lower is better) and ``comet_score`` (the mean of the
      per-segment COMET scores both reports carry, when both were scored with
      the same COMET model — else listed as not tested, with why);
    * diagnostics (role "diagnostic"): ``exact_match_rate`` and the plugin
      rates below.

    The retired weighted composite (``segment_composite``) is no longer
    tested. Each result carries its ``direction`` from the metric registry
    (metric_direction) and its ``role``.

    Plugin metrics present in BOTH reports are tested too, but only from
    per-segment values that actually exist: through the plugin's own corpus
    function where it ships one (_plugin_corpus_fn), else as the mean of the
    per-entry value the aggregate averages (the same key, or ``<k>`` for an
    ``avg_<k>`` aggregate). A plugin key with neither is listed as not
    tested — never reported as 0.00 vs 0.00, p=1.000. Count keys
    (integers) are not metrics and are not tested.

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
        notes: When given, the run's notes (entries excluded from the
            pairing, too few entries, metrics not tested) are appended here
            instead of printed — `mt-eval compare` prints them once for all
            its pairs instead of once per pair.
        labels: What the notes call the two runs (compare passes their
            run-table letters, so a note about runs C and D says C and D).

    Returns:
        List of SignificanceResult, one per metric tested.
    """
    if method not in SIGNIFICANCE_METHODS:
        raise ValueError(
            f"Unknown significance method {method!r}; expected one of "
            f"{', '.join(SIGNIFICANCE_METHODS)}.")

    def _note(text: str) -> None:
        if notes is None:
            print(f"  {text}")
        else:
            notes.append(text)

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
            _note(f"NOTE: Testing on {len(common_ids)} common entries "
                  f"(excluded {excluded_a} from {labels[0]}, {excluded_b} "
                  f"from {labels[1]})")

    if len(common_ids) < 10:
        _note(f"⚠️  WARNING: Only {len(common_ids)} common entries — "
              f"significance tests may be unreliable with so few entries.")

    aligned_a = [ids_a[eid] for eid in common_ids]
    aligned_b = [ids_b[eid] for eid in common_ids]

    results = []
    not_tested: list[str] = []

    # spBLEU is BLEU on the FLORES-200 SentencePiece tokenizer: a corpus
    # statistic resampled from per-segment n-gram counts exactly as BLEU is.
    # The report always carried it (tester.py) but it was never tested
    # (synthetic researcher, Round 7). Its tokenizer can be unavailable
    # (sentencepiece missing, or the model not downloadable offline) — then
    # it is listed as not tested, with why, never dropped silently.
    # chrF++ FIRST: the pre-declared primary metric (scoring standard/1).
    standard = [
        (corpus_chrf, PRIMARY_TEST_METRIC),
        (corpus_bleu, "corpus_bleu"),
    ]
    try:
        _spbleu_metric()
        standard.append((corpus_spbleu, "corpus_spbleu"))
    except Exception as exc:  # noqa: BLE001 — reported in the not-tested note
        not_tested.append(f"corpus_spbleu (FLORES-200 tokenizer unavailable: "
                          f"{type(exc).__name__}: {exc})")
    standard.append((corpus_ter, "corpus_ter"))
    comet_why = _comet_untestable(report_a, report_b, aligned_a, aligned_b,
                                  labels)
    if comet_why is None:
        standard.append((corpus_comet, COMET_ENTRY_KEY))
    elif comet_why:
        not_tested.append(f"{COMET_ENTRY_KEY} ({comet_why})")
    # Diagnostics: never decide (the composite that used to be tested here,
    # segment_composite, is retired with the weighted composite).
    standard.append((exact_match_rate, "exact_match_rate"))

    for metric_fn, name in standard:
        result = _paired_test(
            aligned_a, aligned_b, metric_fn,
            method=method, n_bootstrap=n_bootstrap, alpha=alpha,
            seed=seed, metric_name=name,
        )
        result.direction = direction_of(name)
        result.role = metric_role(name)
        results.append(result)

    # Plugin metrics — test the numeric plugin RATES present in both reports
    plugins_a = report_a.get("overall", {}).get("plugin_metrics", {})
    plugins_b = report_b.get("overall", {}).get("plugin_metrics", {})
    common_plugins = set(plugins_a.keys()) & set(plugins_b.keys())

    for plugin_name in sorted(common_plugins):
        pa = plugins_a[plugin_name]
        pb = plugins_b[plugin_name]
        if not isinstance(pa, dict) or not isinstance(pb, dict):
            continue
        corpus_fn = _plugin_corpus_fn(plugin_name)
        recomputable = (set(corpus_fn(_plugin_results(aligned_a, plugin_name)))
                        if corpus_fn is not None else set())
        common_keys = set(pa.keys()) & set(pb.keys())
        for key in sorted(common_keys):
            if not (_is_rate(pa[key]) and _is_rate(pb[key])):
                continue
            entry_key = _entry_key_for(aligned_a + aligned_b, plugin_name, key)
            if key in recomputable:
                metric_fn = _plugin_corpus_metric(plugin_name, key, corpus_fn)
            elif entry_key is not None:
                metric_fn = _plugin_entry_mean(plugin_name, entry_key)
            else:
                not_tested.append(f"{plugin_name}.{key}")
                continue
            name = f"{plugin_name}.{key}"
            direction = direction_of(name)
            # A lower-is-better rate (code switching, hallucination) wins by
            # going DOWN — the same flag TER carries (see _winner).
            metric_fn.lower_is_better = direction == "lower"
            result = _paired_test(
                aligned_a, aligned_b, metric_fn,
                method=method, n_bootstrap=n_bootstrap, alpha=alpha,
                seed=seed, metric_name=name,
            )
            result.direction = direction
            result.role = ROLE_DIAGNOSTIC
            if direction not in ("higher", "lower"):
                # A neutral rate (morph_coverage) or one whose direction the
                # registry does not declare has no better side to name.
                result.winner = None
            results.append(result)

    if not_tested:
        _note("NOTE: not significance-tested (no per-segment values in the "
              "report to resample, or no scorer here): " + ", ".join(not_tested))

    return results


def _comet_untestable(report_a: dict, report_b: dict, aligned_a: list[dict],
                      aligned_b: list[dict], labels: tuple[str, str]
                      ) -> str | None:
    """Why COMET cannot be paired-tested for these two reports: None when it
    can (both carry per-segment COMET scores from the same model), "" when
    neither run was scored with COMET (nothing to say), else the reason."""
    oa = report_a.get("overall") or {}
    ob = report_b.get("overall") or {}
    has_a = any(_entry_comet(e) is not None for e in aligned_a)
    has_b = any(_entry_comet(e) is not None for e in aligned_b)
    if not has_a and not has_b:
        if oa.get("comet_score") is not None or ob.get("comet_score") is not None:
            return "the reports carry no per-segment COMET scores to resample"
        return ""
    if not (has_a and has_b):
        scored = labels[0] if has_a else labels[1]
        return f"only {scored} was scored with COMET"
    ma, mb = oa.get("comet_model"), ob.get("comet_model")
    if ma and mb and ma != mb:
        return (f"scored with different COMET models: {labels[0]} {ma}, "
                f"{labels[1]} {mb}")
    return None


# ---------------------------------------------------------------------------
# Plugin metrics: resample only what the entries actually carry
# ---------------------------------------------------------------------------

def _is_rate(value) -> bool:
    """A float aggregate. Counts (ints) and flags (bools) are not compared."""
    return isinstance(value, float)


def _plugin_results(entries: list[dict], plugin_name: str) -> list[dict]:
    """The per-entry results one plugin's compute() wrote on these entries."""
    out = []
    for e in entries:
        pm = e.get("plugin_metrics", {})
        if isinstance(pm, dict) and isinstance(pm.get(plugin_name), dict):
            out.append(pm[plugin_name])
    return out


def _plugin_corpus_fn(plugin_name: str):
    """The plugin's OWN corpus aggregation as a pure function of its per-entry
    results, when it ships one — so the resampled value is computed exactly
    as the headline was. Its per-entry keys differ from its aggregate keys,
    which is why the generic per-entry mean below found nothing for it."""
    from mt_eval_harness.plugins import giellalt_fst
    if plugin_name == giellalt_fst.GiellaLTFSTMetric.name:
        return giellalt_fst.corpus_rates
    return None


def _plugin_corpus_metric(plugin_name: str, key: str, corpus_fn):
    def fn(entries: list[dict]) -> float:
        value = corpus_fn(_plugin_results(entries, plugin_name)).get(key)
        # A resample can cover no word at all (morphological_accuracy is then
        # None). Scoring it 0.0 widens the null distribution / the CI —
        # the conservative direction — rather than dropping the draw.
        return float(value) if isinstance(value, (int, float)) else 0.0
    return fn


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _entry_key_for(entries: list[dict], plugin_name: str, key: str) -> str | None:
    """The per-entry key an aggregate is the mean of, if the entries carry it:
    the same name, or ``<k>`` for an ``avg_<k>`` aggregate (the built-in
    behavioural plugins: avg_code_switching_rate is the mean of each entry's
    code_switching_rate). None when no entry carries either."""
    results = _plugin_results(entries, plugin_name)
    candidates = [key] + ([key[len("avg_"):]] if key.startswith("avg_") else [])
    for cand in candidates:
        if any(_is_number(r.get(cand)) for r in results):
            return cand
    return None


def _plugin_entry_mean(plugin_name: str, key: str):
    """Mean of one per-entry value over the entries that carry it."""
    def fn(entries: list[dict]) -> float:
        vals = [r[key] for r in _plugin_results(entries, plugin_name)
                if _is_number(r.get(key))]
        return sum(vals) / len(vals) if vals else 0.0
    return fn


_METHOD_LABELS = {
    "approximate_randomization": "paired approximate randomization",
    "paired_bootstrap": "paired bootstrap (Koehn 2004 sign-flip)",
}

#: How a verdict names a test and what its resampling count counts.
_METHOD_SHORT = {
    "approximate_randomization": ("paired approximate randomization", "trials"),
    "paired_bootstrap": ("paired bootstrap", "resamples"),
}

#: The legacy segment composite's row label, where an old comparison JSON
#: still carries it — segment-level, never the published composite, and
#: retired with the weighted composite by scoring standard/1.
SEGMENT_COMPOSITE_LABEL = f"{SEGMENT_COMPOSITE} (segment-level; legacy, retired)"


def _display_name(result: SignificanceResult) -> str:
    return LEGACY_METRIC_NAMES.get(result.metric_name, result.metric_name)


def _row_label(name: str) -> str:
    return SEGMENT_COMPOSITE_LABEL if name == SEGMENT_COMPOSITE else name


def result_role(result: SignificanceResult) -> str:
    """A result's role under the scoring standard — the one it was tested
    with, or (a result read from an older comparison JSON) by its name."""
    return result.role or metric_role(result.metric_name)


def _fmt_alpha(confidence_level: float) -> str:
    return f"{round(1 - confidence_level, 4):g}"


def _ci_label(results: list[SignificanceResult]) -> str:
    level = results[0].confidence_level if results else 0.95
    return f"{round(level * 100, 2):g}% CI on Δ"


def _primary_label() -> str:
    from mt_eval_harness.scoring import PRIMARY_METRIC_LABEL
    return PRIMARY_METRIC_LABEL


def multiple_testing_note(n_metrics: int, alpha: float, n_pairs: int = 1, *,
                          primary: str | None = None) -> str:
    """What uncorrected per-metric p-values mean, in plain words.

    No correction is applied, deliberately: the significance spec follows the
    MT convention of reporting each metric's own p-value and letting the
    reader interpret ("What NOT to Build: no multi-test correction"). The
    output used to say nothing about it, so a reader of nine metrics could
    take one p<0.05 as a finding (synthetic researcher, Round 7).

    ``primary``: the label of the pre-declared primary metric when it is
    among those tested (scoring standard/1: chrF++). Its test alone decides,
    so the other metrics' tests do not dilute it — said first, so the
    caveat about chance findings is read as being about the OTHER rows."""
    a = f"{alpha:g}"
    what = f"{n_metrics} metric was" if n_metrics == 1 else f"{n_metrics} metrics were"
    tests = (f"{what} tested" if n_pairs <= 1 else
             f"{what} tested per pair ({n_metrics * n_pairs} tests over "
             f"{n_pairs} pairs)")
    lead = ""
    chance = "one \"significant\" result"
    if primary:
        lead = (f"{primary} is the pre-declared primary metric: its test alone "
                f"decides which run is better, so testing the other metrics "
                f"beside it does not dilute it"
                + ("." if n_pairs <= 1 else
                   f" (over {n_pairs} pairs that is {n_pairs} {primary} "
                   f"decisions, each at α={a}, with no correction across "
                   f"pairs).")
                + " The other metrics are secondary or diagnostic and are "
                  "reported for information. ")
        chance = "one \"significant\" secondary or diagnostic result"
    return (f"{lead}p-values are per metric and uncorrected — no "
            f"multiple-testing correction is applied (deliberately: the MT "
            f"convention is to report each metric's own p-value). {tests}, "
            f"so {chance} at p<{a} can turn up by chance alone. And a small "
            f"Δ can be significant yet not meaningful: check the CI on Δ "
            f"(how large the difference plausibly is) and how reliable the "
            f"metric is for this language before acting on it.")


#: Phrases a wrapped note must never split across lines (people and tests
#: look for them whole).
_UNBROKEN = ("NOT the published composite_score",)


def _wrap(text: str, indent: str = "  ") -> list[str]:
    """A note wrapped to the terminal, keeping _UNBROKEN phrases on one line."""
    import textwrap
    glue = "\x00"
    for phrase in _UNBROKEN:
        text = text.replace(phrase, phrase.replace(" ", glue))
    return [line.replace(glue, " ") for line in textwrap.wrap(
        text, width=78, initial_indent=indent, subsequent_indent=indent,
        break_on_hyphens=False)]


def significance_header(results: list[SignificanceResult],
                        labels: tuple | None = None, *,
                        delta_line: str | None = None) -> list[str]:
    """The lines that explain a significance table — printed ONCE above one
    table or above all of compare's pairwise tables (they used to repeat
    under every pair: six times for four runs, Round 7). ``delta_line``
    replaces the sign-convention line (compare states it for all pairs).
    When the primary metric (chrF++) is among the results, the header says
    it alone decides."""
    method = results[0].method if results else "approximate_randomization"
    method_label = _METHOD_LABELS.get(method, method)
    n = results[0].n_bootstrap if results else "?"
    alpha = _fmt_alpha(results[0].confidence_level) if results else "?"
    if delta_line is None:
        la, lb = (labels[0][0], labels[1][0]) if labels else ("A", "B")
        delta_line = (f"  Δ = {la} − {lb} (first run minus second).  ↑ higher "
                      f"is better, ↓ lower is better.")
    lines = [
        "",
        f"  Significance Tests ({method_label}, n={n}, α={alpha}):",
        delta_line,
        "  Better = the run with the better score, by the metric's direction; "
        "(n.s.) = not significant.",
        f"  {_ci_label(results)} = bootstrap percentile interval: how large "
        "the difference plausibly is.",
    ]
    if any(result_role(r) == ROLE_PRIMARY for r in results):
        label = _primary_label()
        lines += _wrap(
            f"Decision: {label} (corpus) is the pre-declared primary metric "
            f"(scoring standard/1) — only its test decides which run is "
            f"better (the verdict under each table). The other standard "
            f"metrics are shown beside it and diagnostics apart; neither "
            f"decides.")
    return lines


def significance_notes(result_sets: list[list[SignificanceResult]],
                       after_segment_note: list[str] | None = None
                       ) -> list[str]:
    """The notes under significance tables, each said ONCE however many
    pairwise tables there are: undeclared directions, what a LEGACY
    segment-composite row is (an old comparison JSON), the bootstrap caveat,
    and that p-values are uncorrected (chrF++ deciding, when it was tested).
    ``after_segment_note``: paragraphs said right after the legacy
    segment-composite note (kept for callers; compare no longer passes
    any — the composite is retired)."""
    flat = [r for rs in result_sets for r in rs]
    if not flat:
        return []
    out: list[str] = []

    def para(text: str) -> None:
        out.append("")
        out.extend(_wrap(text))

    if any((r.direction or direction_of(_display_name(r))) is None for r in flat):
        out.append("")
        out.append("  ? = no direction declared for this metric in the metric "
                   "registry; read Δ by its definition.")
    if any(_display_name(r) == SEGMENT_COMPOSITE for r in flat):
        para(SEGMENT_COMPOSITE_NOTE)
        for text in after_segment_note or []:
            para(text)
    if any(r.method == "paired_bootstrap" for r in flat):
        out.append("")
        out.append(
            "  Note: paired-bootstrap p-values are the Koehn-2004 sign-flip "
            "heuristic (a conservative/biased"
        )
        out.append(
            "  estimate, not a true ASL). For accept/reject use approximate "
            "randomization (the default)."
        )
    n_metrics = max(len(rs) for rs in result_sets)
    has_primary = any(result_role(r) == ROLE_PRIMARY for r in flat)
    para(multiple_testing_note(n_metrics, 1 - flat[0].confidence_level,
                               n_pairs=len([rs for rs in result_sets if rs]),
                               primary=_primary_label() if has_primary else None))
    return out


#: The most decimals a significance row is printed with.
MAX_DISPLAY_PLACES = 6


def display_places(r: SignificanceResult) -> int:
    """Decimals for one significance row: 2, or more until every non-zero
    Δ / interval bound shows a non-zero digit and two different scores show
    different numbers (at most :data:`MAX_DISPLAY_PLACES`). A tiny real
    difference used to print as Δ +0.00 [+0.00, +0.00] beside "Yes *"
    (synthetic hospital and school personas, Round 13)."""
    places = 2
    values = [v for v in (r.delta, r.ci_lower, r.ci_upper) if v]
    while places < MAX_DISPLAY_PLACES:
        hidden = any(round(abs(v), places) == 0 for v in values)
        same = (r.system_a_score != r.system_b_score
                and f"{r.system_a_score:.{places}f}"
                == f"{r.system_b_score:.{places}f}")
        if not (hidden or same):
            break
        places += 1
    return places


def _zero_interval(r: SignificanceResult) -> bool:
    """The bootstrap interval on Δ is exactly [0, 0]."""
    return r.ci_lower == 0 and r.ci_upper == 0


def _fmt_gain(value: float) -> str:
    """A chrF++ difference for a verdict: one decimal, or enough significant
    figures that a real but tiny difference never reads as 0.0."""
    text = f"{value:.1f}"
    if float(text) == 0 and value != 0:
        text = f"{value:.2g}"
    return text


def primary_decision(result: SignificanceResult,
                     labels: tuple | None = None, *,
                     caveated: set | frozenset | None = None) -> dict:
    """The decision of ONE pair of runs on the primary metric (chrF++), from
    its paired test — what `mt-eval compare` prints under each table and
    writes to comparison.json:

    ``{metric, label, tested_as, pair, a_score, b_score, delta, ci_lower,
    ci_upper, p_value, alpha, method, n_resamples, significant, better,
    verdict}`` — ``better`` is the better run's letter, or None when the
    test found no significant difference (or p is below α but the
    bootstrap interval on Δ is exactly [0, 0]: too few segments differ to
    call either run better). ``verdict`` says it in one sentence, e.g.
    "B is better than A on chrF++ (+3.2, p=0.002, paired approximate
    randomization, 1000 trials)".

    ``caveated``: letters of runs whose scores carry a score caveat — the
    verdict marks them ⚠ and says the caveat qualifies it."""
    from mt_eval_harness.scoring import PRIMARY_METRIC, PRIMARY_METRIC_LABEL
    la, lb = ((labels[0][0], labels[1][0]) if labels else ("A", "B"))
    cav = set(caveated or ())

    def _m(letter: str) -> str:
        return f"{letter}⚠" if letter in cav else letter
    direction = result.direction or direction_of(_display_name(result)) or "higher"
    side = better_side(direction, result.system_a_score, result.system_b_score)
    zero = _zero_interval(result)
    decided = bool(result.significant) and side in ("A", "B") and not zero
    better = (la if side == "A" else lb) if decided else None
    method_name, unit = _METHOD_SHORT.get(result.method,
                                          (result.method, "resamples"))
    test = f"{method_name}, {result.n_bootstrap} {unit}"
    p = f"p={result.p_value:.3f}"
    if decided:
        worse = lb if better == la else la
        verdict = (f"{_m(better)} is better than {_m(worse)} on "
                   f"{PRIMARY_METRIC_LABEL} (+{_fmt_gain(abs(result.delta))}, "
                   f"{p}, {test})")
        if better in cav:
            verdict += f" — read with {better}'s score caveat"
    elif result.significant and zero:
        verdict = (f"no run is called better on {PRIMARY_METRIC_LABEL}: p is "
                   f"below α but the bootstrap interval on Δ is exactly "
                   f"[0, 0] ({p}, {test})")
    else:
        verdict = (f"no significant difference on {PRIMARY_METRIC_LABEL} "
                   f"between {la} and {lb} (Δ {la}−{lb} "
                   f"{'+' if result.delta >= 0 else '−'}"
                   f"{_fmt_gain(abs(result.delta))}, {p}, {test})")
    return {
        "metric": PRIMARY_METRIC,
        "label": PRIMARY_METRIC_LABEL,
        "tested_as": result.metric_name,
        "pair": [la, lb],
        "a_score": result.system_a_score,
        "b_score": result.system_b_score,
        "delta": result.delta,
        "ci_lower": result.ci_lower,
        "ci_upper": result.ci_upper,
        "p_value": result.p_value,
        "alpha": round(1 - result.confidence_level, 4),
        "method": result.method,
        "n_resamples": result.n_bootstrap,
        "significant": bool(result.significant),
        "better": better,
        "verdict": verdict,
    }


def primary_result(results: list[SignificanceResult]) -> SignificanceResult | None:
    """The primary metric's (chrF++'s) result among a pair's results."""
    return next((r for r in results if result_role(r) == ROLE_PRIMARY), None)


def format_significance_table(results: list[SignificanceResult],
                              labels: tuple | None = None, *,
                              header: bool = True,
                              notes: bool = True,
                              caveated: set | frozenset | None = None,
                              verdict: bool = True) -> str:
    """Format significance results as a human-readable table.

    The sign convention is stated once in the header (Δ = A − B), every row
    carries its direction mark (↑ higher is better, ↓ lower is better, from
    the metric registry), and a ``Better`` column names the run with the
    better score, direction-aware — a +63.5 chrF++ gain of B over A prints as
    Δ −63.52 by the A − B convention, and nobody should have to work out that
    it is B's win (synthetic school persona, 2026-10-03). Results read from a
    comparison JSON written before ``direction`` existed are resolved by name.

    Rows are grouped by their role under the scoring standard (standard/1):
    the PRIMARY metric (corpus chrF++) first — the one that decides — then
    the secondary standard metrics, then "Diagnostics (not used to decide)",
    then any LEGACY composite row an old comparison JSON carries. With
    ``verdict`` (default), a chrF++ result is followed by the decision line
    (:func:`primary_decision`).

    ``labels`` names the two runs ``((letter, name), (letter, name))`` — the
    letters of compare's run table, so a pairwise table of runs C and A says
    C and A, never a fresh A/B that clashes with the run table (Round 7).
    The column of the confidence interval on Δ (in the JSON as ci_lower /
    ci_upper since the start) is printed beside Δ. ``header`` / ``notes``
    let compare print the explanation and the notes once for all pairs.

    ``caveated``: the letters of runs whose scores carry a score caveat
    (score_caveats — e.g. nmt-forge's near-twin "recall, not translation"
    reading). Their column and every ``Better`` naming them carry a ⚠, and
    the table says the caveat qualifies that verdict: the all-data model was
    called "Better" with no memory caveat beside it (synthetic school
    persona, Round 8). The caller prints the caveat text below.
    """
    la, lb = ((labels[0][0], labels[1][0]) if labels else ("A", "B"))
    cav = set(caveated or ())

    def _m(letter: str) -> str:
        return f"{letter}⚠" if letter in cav else letter
    order = {role: i for i, (role, _h) in enumerate(ROLE_HEADINGS)}
    ordered = sorted(enumerate(results),
                     key=lambda ir: (order.get(result_role(ir[1]), len(order)),
                                     ir[0]))
    rows = []
    for _i, r in ordered:
        name = _display_name(r)
        direction = r.direction or direction_of(name)
        side = better_side(direction, r.system_a_score, r.system_b_score)
        if side is None:
            better = "?" if direction is None else "—"
        elif side == "tie":
            better = "tie"
        else:
            letter = _m(la if side == "A" else lb)
            better = letter if r.significant else f"{letter} (n.s.)"
        places = display_places(r)
        ci = f"[{r.ci_lower:+.{places}f}, {r.ci_upper:+.{places}f}]"
        if _zero_interval(r) and r.significant and better not in ("tie", "—", "?"):
            better = "—†"
        rows.append((f"{arrow(direction)} {_row_label(name)}", r, better, ci))
    width = max([len("Metric")] + [len(label) for label, *_ in rows])
    ci_head = _ci_label(results)
    ci_w = max([len(ci_head)] + [len(ci) for *_, ci in rows])
    delta_head = f"Δ ({la}−{lb})"
    lines = significance_header(results, labels) if header else []
    lines += [
        "",
        f"  {'Metric':<{width}s} {_m(la):>8s} {_m(lb):>8s} {delta_head:>8s} "
        f"{ci_head:>{ci_w}s} {'p-value':>8s} {'Sig?':>5s}  Better",
        f"  {'-'*width} {'-'*8} {'-'*8} {'-'*max(8, len(delta_head))} "
        f"{'-'*ci_w} {'-'*8} {'-'*5}  {'-'*8}",
    ]
    headings = dict(ROLE_HEADINGS)
    roles_present = {result_role(r) for _l, r, _b, _c in rows}
    current = None
    for label, r, better, ci in rows:
        role = result_role(r)
        if role != current and len(roles_present) > 1:
            lines.append(f"  {headings.get(role, role)}")
        current = role
        places = display_places(r)
        sig_marker = (("?†" if _zero_interval(r) else "Yes *")
                      if r.significant else "No")
        delta_str = f"{'+' if r.delta >= 0 else ''}{r.delta:.{places}f}"
        lines.append(
            f"  {label:<{width}s} "
            f"{r.system_a_score:>8.{places}f} "
            f"{r.system_b_score:>8.{places}f} "
            f"{delta_str:>{max(8, len(delta_head))}s} "
            f"{ci:>{ci_w}s} "
            f"{r.p_value:>8.3f} "
            f"{sig_marker:>5s}  "
            f"{better}"
        )
    if any(display_places(r) > 2 for _l, r, _b, _c in rows):
        lines.extend(_wrap("Rows whose difference is under 0.01 are shown "
                           "with more decimals, so a real but tiny Δ never "
                           "reads as +0.00."))
    if any(_zero_interval(r) and r.significant for _l, r, _b, _c in rows):
        lines.extend(_wrap("?† = p is below α but the bootstrap interval on Δ "
                           "is exactly [0, 0]: too few segments differ to "
                           "estimate the difference, so no run is called "
                           "better on it."))
    marked = [x for x in (la, lb) if x in cav]
    if marked:
        lines.append(f"  ⚠ = {' and '.join(marked)}'s scores carry a score "
                     f"caveat (printed below the tables): read every "
                     f"\"Better\" naming {'it' if len(marked) == 1 else 'them'} "
                     f"with it.")
    primary = primary_result(results)
    if verdict and primary is not None:
        decision = primary_decision(primary, labels, caveated=cav)
        lines.append("")
        lines.extend(_wrap(f"Verdict: {decision['verdict']}."))
    if notes:
        lines += significance_notes([results])
    lines.append("")
    return "\n".join(lines)
