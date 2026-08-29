"""Tests for extended bootstrap CI coverage: FST acceptance rate and composite score.

Validates:
  - fst_acceptance_rate() metric function with various entry configurations
  - composite_score() metric function with and without FST data
  - compute_all_cis() includes fst/composite when data is present
  - compute_all_cis() omits fst when data is absent
"""

import pytest
from mt_eval_harness.confidence import (
    bootstrap_ci,
    compute_all_cis,
)
from mt_eval_harness.significance import (
    fst_acceptance_rate,
    composite_score,
)


# ---------------------------------------------------------------------------
# Fixtures: mock entry dicts with FST plugin data
# ---------------------------------------------------------------------------

def _make_entry(
    entry_id: int,
    expected: str,
    predicted: str,
    exact_match: bool = False,
    error: str = None,
    fst_validity: float = None,
) -> dict:
    """Create a mock entry dict matching TestReport format.

    Optionally includes FST plugin data under plugin_metrics.giellalt_fst_validity.
    """
    entry = {
        "id": entry_id,
        "source": f"source_{entry_id}",
        "expected": expected,
        "predicted": predicted,
        "exact_match": exact_match,
        "chrf_score": 0.0,
        "bleu_score": 0.0,
        "error": error,
        "plugin_metrics": {},
    }
    if fst_validity is not None:
        entry["plugin_metrics"]["giellalt_fst_validity"] = {
            "fst_validity": fst_validity,
        }
    return entry


def _make_entries_with_fst(n: int = 50, fst_val: float = 1.0) -> list[dict]:
    """Create entries where all predictions match and have FST data."""
    return [
        _make_entry(i, f"word_{i}", f"word_{i}", exact_match=True, fst_validity=fst_val)
        for i in range(n)
    ]


def _make_entries_without_fst(n: int = 50) -> list[dict]:
    """Create entries with no FST plugin data."""
    return [
        _make_entry(i, f"word_{i}", f"word_{i}", exact_match=True)
        for i in range(n)
    ]


def _make_mixed_fst_entries(
    n: int = 50,
    fst_fraction: float = 0.5,
    fst_val: float = 0.8,
) -> list[dict]:
    """Create entries where some have FST data and some don't."""
    entries = []
    n_fst = int(n * fst_fraction)
    for i in range(n):
        if i < n_fst:
            entries.append(
                _make_entry(i, f"word_{i}", f"word_{i}",
                            exact_match=True, fst_validity=fst_val)
            )
        else:
            entries.append(
                _make_entry(i, f"word_{i}", f"word_{i}", exact_match=True)
            )
    return entries


# ---------------------------------------------------------------------------
# Test: fst_acceptance_rate metric function
# ---------------------------------------------------------------------------

class TestFstAcceptanceRate:
    """Tests for the fst_acceptance_rate metric function."""

    def test_all_entries_have_fst_data(self):
        """When all entries have FST data at 1.0, rate should be 1.0."""
        entries = _make_entries_with_fst(20, fst_val=1.0)
        rate = fst_acceptance_rate(entries)
        assert rate == 1.0

    def test_mixed_fst_values(self):
        """Averages across entries that have FST data."""
        entries = [
            _make_entry(0, "a", "a", fst_validity=1.0),
            _make_entry(1, "b", "b", fst_validity=0.5),
            _make_entry(2, "c", "c", fst_validity=0.0),
        ]
        rate = fst_acceptance_rate(entries)
        assert rate == pytest.approx(0.5, abs=1e-6)

    def test_no_fst_data_returns_zero(self):
        """When no entries have FST data, returns 0.0."""
        entries = _make_entries_without_fst(20)
        rate = fst_acceptance_rate(entries)
        assert rate == 0.0

    def test_skips_error_entries(self):
        """Error entries are excluded from FST calculation."""
        entries = [
            _make_entry(0, "a", "a", fst_validity=1.0),
            _make_entry(1, "b", "b", fst_validity=0.0, error="API error"),
            _make_entry(2, "c", "c", fst_validity=1.0),
        ]
        # Entry 1 has error, should be skipped → average of 1.0 and 1.0
        rate = fst_acceptance_rate(entries)
        assert rate == 1.0

    def test_empty_entries(self):
        """Empty list returns 0.0."""
        assert fst_acceptance_rate([]) == 0.0

    def test_only_some_entries_have_fst(self):
        """Only entries with FST data contribute to the average."""
        entries = [
            _make_entry(0, "a", "a", fst_validity=0.8),
            _make_entry(1, "b", "b"),  # no FST data
            _make_entry(2, "c", "c", fst_validity=0.6),
        ]
        # Average of 0.8 and 0.6 (entry 1 has no FST data → skipped)
        rate = fst_acceptance_rate(entries)
        assert rate == pytest.approx(0.7, abs=1e-6)


# ---------------------------------------------------------------------------
# Test: composite_score metric function
# ---------------------------------------------------------------------------

class TestCompositeScore:
    """Tests for the composite_score metric function."""

    def test_perfect_scores_without_fst(self):
        """Perfect entries without FST should yield a high composite."""
        entries = _make_entries_without_fst(20)
        score = composite_score(entries)
        # chrF++ = 100 and exact_match = 1.0, both perfect
        # Without FST: Profile B weights apply
        # composite = weighted avg of normalized metrics
        assert score > 0.9  # should be very high
        assert score <= 1.0

    def test_perfect_scores_with_fst(self):
        """Perfect entries with perfect FST should yield a high composite."""
        entries = _make_entries_with_fst(20, fst_val=1.0)
        score = composite_score(entries)
        # chrF++ = 100, exact_match = 1.0, FST = 1.0
        # Profile A weights apply
        assert score > 0.9
        assert score <= 1.0

    def test_low_fst_lowers_composite(self):
        """Low FST values should pull composite down from perfect."""
        perfect_entries = _make_entries_with_fst(20, fst_val=1.0)
        low_fst_entries = _make_entries_with_fst(20, fst_val=0.3)

        score_perfect = composite_score(perfect_entries)
        score_low_fst = composite_score(low_fst_entries)

        # Lower FST should result in lower composite
        assert score_low_fst < score_perfect

    def test_empty_entries_returns_zero(self):
        """Empty list returns 0.0."""
        assert composite_score([]) == 0.0

    def test_all_errors_returns_zero(self):
        """All-error entries returns 0.0."""
        entries = [
            _make_entry(i, f"w_{i}", f"w_{i}", error="API error")
            for i in range(10)
        ]
        assert composite_score(entries) == 0.0

    def test_composite_deterministic(self):
        """Same entries should produce the same composite score."""
        entries = _make_entries_with_fst(30, fst_val=0.7)
        score1 = composite_score(entries)
        score2 = composite_score(entries)
        assert score1 == score2


# ---------------------------------------------------------------------------
# Test: bootstrap_ci with fst_acceptance_rate
# ---------------------------------------------------------------------------

class TestBootstrapCIWithFST:
    """Test bootstrap_ci() works correctly with fst_acceptance_rate."""

    def test_fst_bootstrap_ci_perfect(self):
        """Perfect FST should have tight CI around 1.0."""
        entries = _make_entries_with_fst(50, fst_val=1.0)
        ci = bootstrap_ci(
            entries, fst_acceptance_rate,
            n_bootstrap=200, metric_name="fst_acceptance_rate"
        )
        assert ci.score == 1.0
        assert ci.ci_lower == 1.0
        assert ci.ci_upper == 1.0
        assert ci.ci_width == 0.0

    def test_fst_bootstrap_ci_mixed(self):
        """Mixed FST values should produce a nonzero CI width."""
        entries = [
            _make_entry(i, f"w_{i}", f"w_{i}", fst_validity=0.5 + 0.5 * (i % 2))
            for i in range(50)
        ]
        ci = bootstrap_ci(
            entries, fst_acceptance_rate,
            n_bootstrap=500, metric_name="fst_acceptance_rate"
        )
        assert ci.ci_width > 0
        assert ci.ci_lower <= ci.score <= ci.ci_upper


# ---------------------------------------------------------------------------
# Test: compute_all_cis includes/omits fst and composite
# ---------------------------------------------------------------------------

class TestComputeAllCIsExtended:
    """Test that compute_all_cis() conditionally includes new metrics."""

    def test_includes_fst_when_data_present(self):
        """When entries have FST data, fst_acceptance_rate CI is computed."""
        entries = _make_entries_with_fst(30, fst_val=0.9)
        cis = compute_all_cis(entries, n_bootstrap=100)

        assert "fst_acceptance_rate" in cis
        ci = cis["fst_acceptance_rate"]
        assert "ci_lower" in ci
        assert "ci_upper" in ci
        assert "score" in ci

    def test_omits_fst_when_no_data(self):
        """When no entries have FST data, fst_acceptance_rate CI is skipped."""
        entries = _make_entries_without_fst(30)
        cis = compute_all_cis(entries, n_bootstrap=100)

        assert "fst_acceptance_rate" not in cis

    def test_includes_composite_when_text_data_present(self):
        """Composite CI is computed when entries have expected/predicted text."""
        entries = _make_entries_without_fst(30)
        cis = compute_all_cis(entries, n_bootstrap=100)

        assert "composite_score" in cis
        ci = cis["composite_score"]
        assert "ci_lower" in ci
        assert "ci_upper" in ci

    def test_includes_composite_with_fst(self):
        """Composite CI is computed when entries have both text and FST data."""
        entries = _make_entries_with_fst(30, fst_val=0.8)
        cis = compute_all_cis(entries, n_bootstrap=100)

        assert "composite_score" in cis
        assert "fst_acceptance_rate" in cis

    def test_still_has_core_metrics(self):
        """Core metrics (chrF++, BLEU, EM) are still present."""
        entries = _make_entries_with_fst(30, fst_val=0.9)
        cis = compute_all_cis(entries, n_bootstrap=100)

        assert "corpus_chrf" in cis
        assert "corpus_bleu" in cis
        assert "exact_match_rate" in cis

    def test_empty_entries_returns_empty(self):
        """Empty entries should return empty dict for all metrics."""
        cis = compute_all_cis([], n_bootstrap=100)
        assert cis == {}

    def test_all_errors_returns_empty(self):
        """All-error entries should return empty dict."""
        entries = [
            _make_entry(i, f"w_{i}", f"w_{i}", error="fail")
            for i in range(10)
        ]
        cis = compute_all_cis(entries, n_bootstrap=100)
        assert cis == {}

    def test_each_new_ci_has_required_fields(self):
        """New CI entries have all the standard ConfidenceInterval fields."""
        entries = _make_entries_with_fst(30, fst_val=0.7)
        cis = compute_all_cis(entries, n_bootstrap=100)

        required_fields = [
            "score", "ci_lower", "ci_upper", "ci_width",
            "n_bootstrap", "confidence_level", "seed",
        ]
        for name in ["fst_acceptance_rate", "composite_score"]:
            assert name in cis, f"Expected {name} in CIs"
            for field in required_fields:
                assert field in cis[name], f"Missing {field} in {name} CI"
