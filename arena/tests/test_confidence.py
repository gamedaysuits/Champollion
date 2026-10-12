"""Tests for bootstrap confidence interval computation.

Validates the confidence.py module against known statistical properties:
  - Determinism with fixed seed
  - CI width behavior (tight for extreme cases, wider for mixed)
  - Edge cases (empty input, single entry, all errors)
  - Statistical soundness (CI contains true score, width decreases with N)
"""

import pytest
from mt_eval_harness.confidence import (
    ConfidenceInterval,
    bootstrap_ci,
    compute_all_cis,
    format_score_with_ci,
    DEFAULT_N_BOOTSTRAP,
    DEFAULT_SEED,
)
from mt_eval_harness.significance import (
    corpus_chrf,
    corpus_bleu,
    exact_match_rate,
)


# ---------------------------------------------------------------------------
# Fixtures: mock entry dicts matching TestReport format
# ---------------------------------------------------------------------------

def _make_entry(id: int, expected: str, predicted: str,
                exact_match: bool = False, error: str = None) -> dict:
    """Create a minimal entry dict matching TestReport format."""
    return {
        "id": id,
        "source": f"source_{id}",
        "expected": expected,
        "predicted": predicted,
        "exact_match": exact_match,
        "chrf_score": 0.0,
        "bleu_score": 0.0,
        "error": error,
        "plugin_metrics": {},
    }


def _make_perfect_entries(n: int = 50) -> list[dict]:
    """Create entries where all predictions exactly match expected."""
    return [
        _make_entry(i, f"word_{i}", f"word_{i}", exact_match=True)
        for i in range(n)
    ]


def _make_failing_entries(n: int = 50) -> list[dict]:
    """Create entries where all predictions are wrong."""
    return [
        _make_entry(i, f"word_{i}", f"wrong_{i}", exact_match=False)
        for i in range(n)
    ]


def _make_mixed_entries(n: int = 50, match_rate: float = 0.5) -> list[dict]:
    """Create entries with a specified match rate."""
    entries = []
    n_match = int(n * match_rate)
    for i in range(n):
        if i < n_match:
            entries.append(_make_entry(i, f"word_{i}", f"word_{i}", exact_match=True))
        else:
            entries.append(_make_entry(i, f"word_{i}", f"wrong_{i}", exact_match=False))
    return entries


# ---------------------------------------------------------------------------
# Test: determinism with fixed seed
# ---------------------------------------------------------------------------

class TestDeterminism:
    """Same inputs + same seed = identical CI bounds, every time."""

    def test_same_seed_same_result(self):
        entries = _make_mixed_entries(50)
        ci1 = bootstrap_ci(entries, exact_match_rate, seed=42, metric_name="em")
        ci2 = bootstrap_ci(entries, exact_match_rate, seed=42, metric_name="em")

        assert ci1.score == ci2.score
        assert ci1.ci_lower == ci2.ci_lower
        assert ci1.ci_upper == ci2.ci_upper
        assert ci1.ci_width == ci2.ci_width

    def test_different_seed_same_score_different_ci(self):
        entries = _make_mixed_entries(50)
        ci1 = bootstrap_ci(entries, exact_match_rate, seed=42, metric_name="em")
        ci2 = bootstrap_ci(entries, exact_match_rate, seed=99, metric_name="em")

        # Same observed score regardless of seed
        assert ci1.score == ci2.score
        # CI bounds may differ slightly due to different resampling
        # but should be in the same neighborhood
        assert abs(ci1.ci_lower - ci2.ci_lower) < 0.15
        assert abs(ci1.ci_upper - ci2.ci_upper) < 0.15


# ---------------------------------------------------------------------------
# Test: perfect scores → tight CI around 100 / 1.0
# ---------------------------------------------------------------------------

class TestPerfectScores:
    """When all entries are perfect matches, the CI should be very tight."""

    def test_exact_match_perfect(self):
        entries = _make_perfect_entries(50)
        ci = bootstrap_ci(entries, exact_match_rate, n_bootstrap=500, metric_name="em")

        assert ci.score == 1.0
        # With all entries being exact matches, every bootstrap sample
        # also has all exact matches → CI = [1.0, 1.0]
        assert ci.ci_lower == 1.0
        assert ci.ci_upper == 1.0
        assert ci.ci_width == 0.0

    def test_chrf_perfect(self):
        entries = _make_perfect_entries(50)
        ci = bootstrap_ci(entries, corpus_chrf, n_bootstrap=500, metric_name="chrf")

        assert ci.score == 100.0
        assert ci.ci_lower == 100.0
        assert ci.ci_upper == 100.0


# ---------------------------------------------------------------------------
# Test: all failures → tight CI around 0.0
# ---------------------------------------------------------------------------

class TestAllFailures:
    """When all entries fail, CI should be tight around 0."""

    def test_exact_match_zero(self):
        entries = _make_failing_entries(50)
        ci = bootstrap_ci(entries, exact_match_rate, n_bootstrap=500, metric_name="em")

        assert ci.score == 0.0
        assert ci.ci_lower == 0.0
        assert ci.ci_upper == 0.0


# ---------------------------------------------------------------------------
# Test: mixed results → wider CI
# ---------------------------------------------------------------------------

class TestMixedResults:
    """Mixed match/miss → CI should be wider than extreme cases."""

    def test_half_match_has_nonzero_width(self):
        entries = _make_mixed_entries(50, match_rate=0.5)
        ci = bootstrap_ci(entries, exact_match_rate, n_bootstrap=1000, metric_name="em")

        assert ci.score == 0.5
        assert ci.ci_width > 0
        # The CI should contain the true score
        assert ci.ci_lower <= ci.score <= ci.ci_upper

    def test_ci_contains_observed_score(self):
        """The CI should always contain the observed score (sanity check)."""
        entries = _make_mixed_entries(100, match_rate=0.3)
        ci = bootstrap_ci(entries, exact_match_rate, metric_name="em")

        assert ci.ci_lower <= ci.score <= ci.ci_upper


# ---------------------------------------------------------------------------
# Test: CI width decreases with more entries
# ---------------------------------------------------------------------------

class TestSampleSize:
    """More entries → narrower CI (statistical property)."""

    def test_larger_sample_tighter_ci(self):
        small = _make_mixed_entries(20, match_rate=0.5)
        large = _make_mixed_entries(200, match_rate=0.5)

        ci_small = bootstrap_ci(small, exact_match_rate, seed=42, metric_name="em")
        ci_large = bootstrap_ci(large, exact_match_rate, seed=42, metric_name="em")

        # Larger sample should have narrower CI
        assert ci_large.ci_width < ci_small.ci_width


# ---------------------------------------------------------------------------
# Test: empty inputs
# ---------------------------------------------------------------------------

class TestEmptyInputs:
    """Empty or degenerate inputs should be handled gracefully."""

    def test_empty_entries(self):
        ci = bootstrap_ci([], exact_match_rate, metric_name="em")
        assert ci.score == 0.0
        assert ci.ci_lower == 0.0
        assert ci.ci_upper == 0.0
        assert ci.n_entries == 0

    def test_all_errors(self):
        entries = [
            _make_entry(i, f"w_{i}", f"w_{i}", error="API error")
            for i in range(10)
        ]
        # exact_match_rate excludes error entries → 0 non-error → 0.0
        ci = bootstrap_ci(entries, exact_match_rate, metric_name="em")
        assert ci.score == 0.0


# ---------------------------------------------------------------------------
# Test: ConfidenceInterval dataclass
# ---------------------------------------------------------------------------

class TestConfidenceIntervalDataclass:
    """Test the dataclass fields."""

    def test_fields(self):
        ci = ConfidenceInterval(
            metric_name="test",
            score=0.5,
            ci_lower=0.3,
            ci_upper=0.7,
            ci_width=0.4,
            n_bootstrap=1000,
            confidence_level=0.95,
            n_entries=100,
            seed=12345,
        )
        assert ci.metric_name == "test"
        assert ci.confidence_level == 0.95
        assert ci.seed == 12345

    def test_metadata_populated(self):
        entries = _make_mixed_entries(50)
        ci = bootstrap_ci(entries, exact_match_rate, n_bootstrap=500, seed=99, metric_name="em")

        assert ci.n_bootstrap == 500
        assert ci.n_entries == 50
        assert ci.seed == 99
        assert ci.confidence_level == 0.95


# ---------------------------------------------------------------------------
# Test: compute_all_cis
# ---------------------------------------------------------------------------

class TestComputeAllCIs:
    """Test the convenience function that computes CIs for all standard metrics."""

    def test_returns_three_metrics(self):
        entries = _make_perfect_entries(20)
        cis = compute_all_cis(entries, n_bootstrap=100)

        assert "corpus_chrf" in cis
        assert "corpus_bleu" in cis
        assert "exact_match_rate" in cis

    def test_empty_returns_empty(self):
        cis = compute_all_cis([], n_bootstrap=100)
        assert cis == {}

    def test_all_errors_returns_empty(self):
        entries = [
            _make_entry(i, f"w_{i}", f"w_{i}", error="fail")
            for i in range(10)
        ]
        cis = compute_all_cis(entries, n_bootstrap=100)
        assert cis == {}

    def test_each_ci_has_required_fields(self):
        entries = _make_mixed_entries(30)
        cis = compute_all_cis(entries, n_bootstrap=100)

        for name, ci_dict in cis.items():
            assert "score" in ci_dict
            assert "ci_lower" in ci_dict
            assert "ci_upper" in ci_dict
            assert "ci_width" in ci_dict
            assert "n_bootstrap" in ci_dict
            assert "confidence_level" in ci_dict
            assert "seed" in ci_dict


# ---------------------------------------------------------------------------
# Test: format_score_with_ci
# ---------------------------------------------------------------------------

class TestFormatScoreWithCI:
    """Test the display formatter."""

    def test_format_absolute(self):
        result = format_score_with_ci(42.96, {"ci_lower": 40.1, "ci_upper": 45.8})
        assert "42.96" in result
        assert "40.1" in result
        assert "45.8" in result

    def test_format_percentage(self):
        result = format_score_with_ci(0.198, {"ci_lower": 0.12, "ci_upper": 0.276}, is_percentage=True)
        assert "19.8%" in result
        assert "12.0" in result
        assert "27.6" in result
