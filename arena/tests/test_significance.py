"""Tests for statistical significance testing (paired bootstrap + AR)."""

from dataclasses import asdict

import pytest
from mt_eval_harness.significance import (
    SignificanceResult,
    paired_bootstrap,
    paired_approximate_randomization,
    exact_match_rate,
    corpus_chrf,
    corpus_bleu,
    run_significance_tests,
    format_significance_table,
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


def _make_small_edge_pair(n: int = 50, k: int = 5) -> tuple[list[dict], list[dict]]:
    """A small consistent edge: A is correct on the first ``k`` entries where B
    is wrong; both are correct on the remaining n-k. delta = k/n.

    This is the Riezler & Maxwell (2005) pitfall scenario: the edge is real but
    small relative to noise, so the paired bootstrap sign-flip heuristic
    OVERSTATES significance while approximate randomization does not.
    """
    a = []
    b = []
    for i in range(n):
        if i < k:
            a.append(_make_entry(i, f"w_{i}", f"w_{i}", exact_match=True))
            b.append(_make_entry(i, f"w_{i}", f"WRONG_{i}", exact_match=False))
        else:
            a.append(_make_entry(i, f"w_{i}", f"w_{i}", exact_match=True))
            b.append(_make_entry(i, f"w_{i}", f"w_{i}", exact_match=True))
    return a, b


def _make_report(entries: list[dict]) -> dict:
    """Wrap entries in a minimal TestReport structure."""
    return {
        "run_id": "test-run",
        "overall": {
            "total_entries": len(entries),
            "evaluated": len([e for e in entries if not e.get("error")]),
        },
        "entries": entries,
    }


# ---------------------------------------------------------------------------
# Test: deterministic with seed
# ---------------------------------------------------------------------------

class TestDeterminism:
    """Same inputs + same seed = same p-value, every time."""

    def test_same_seed_same_result(self):
        a = _make_perfect_entries(30)
        b = _make_failing_entries(30)

        r1 = paired_bootstrap(a, b, exact_match_rate, seed=42, metric_name="em")
        r2 = paired_bootstrap(a, b, exact_match_rate, seed=42, metric_name="em")

        assert r1.p_value == r2.p_value
        assert r1.delta == r2.delta
        assert r1.ci_lower == r2.ci_lower
        assert r1.ci_upper == r2.ci_upper

    def test_different_seed_may_differ(self):
        a = _make_perfect_entries(30)
        b = _make_failing_entries(30)

        r1 = paired_bootstrap(a, b, exact_match_rate, seed=42, metric_name="em")
        r2 = paired_bootstrap(a, b, exact_match_rate, seed=99, metric_name="em")

        # With 100% vs 0% match, both seeds should agree on significance
        assert r1.significant == r2.significant


# ---------------------------------------------------------------------------
# Test: identical scores → p_value = 1.0
# ---------------------------------------------------------------------------

class TestIdenticalSystems:
    """Two identical result sets → p_value = 1.0."""

    def test_identical_entries(self):
        entries = _make_perfect_entries(50)
        result = paired_bootstrap(
            entries, entries, exact_match_rate,
            n_bootstrap=500, metric_name="em"
        )
        assert result.p_value == 1.0
        assert result.significant is False
        assert result.winner is None
        assert result.delta == 0.0


# ---------------------------------------------------------------------------
# Test: clearly significant difference
# ---------------------------------------------------------------------------

class TestClearlySignificant:
    """One system is clearly better → p_value ≈ 0.0."""

    def test_perfect_vs_failing(self):
        a = _make_perfect_entries(50)
        b = _make_failing_entries(50)

        result = paired_bootstrap(
            a, b, exact_match_rate,
            n_bootstrap=1000, metric_name="em"
        )
        assert result.p_value < 0.01
        assert result.significant is True
        assert result.winner == "A"
        assert result.delta > 0.9  # Should be ~1.0

    def test_failing_vs_perfect(self):
        a = _make_failing_entries(50)
        b = _make_perfect_entries(50)

        result = paired_bootstrap(
            a, b, exact_match_rate,
            n_bootstrap=1000, metric_name="em"
        )
        assert result.p_value < 0.01
        assert result.significant is True
        assert result.winner == "B"
        assert result.delta < -0.9


# ---------------------------------------------------------------------------
# Test: mismatched entries
# ---------------------------------------------------------------------------

class TestMismatchedEntries:
    """Mismatched IDs should raise ValueError."""

    def test_different_lengths(self):
        a = _make_perfect_entries(10)
        b = _make_perfect_entries(20)

        with pytest.raises(ValueError, match="Entry count mismatch"):
            paired_bootstrap(a, b, exact_match_rate, metric_name="em")

    def test_different_ids(self):
        a = [_make_entry(i, f"w_{i}", f"w_{i}", True) for i in range(10)]
        b = [_make_entry(i + 100, f"w_{i}", f"w_{i}", True) for i in range(10)]

        with pytest.raises(ValueError, match="Entry IDs do not match"):
            paired_bootstrap(a, b, exact_match_rate, metric_name="em")


# ---------------------------------------------------------------------------
# Test: empty inputs
# ---------------------------------------------------------------------------

class TestEmptyInputs:
    """Empty inputs should handle gracefully."""

    def test_empty_entries(self):
        result = paired_bootstrap([], [], exact_match_rate, metric_name="em")
        assert result.p_value == 1.0
        assert result.significant is False


# ---------------------------------------------------------------------------
# Test: metric functions
# ---------------------------------------------------------------------------

class TestMetricFunctions:
    """Test the built-in metric functions."""

    def test_exact_match_rate_all_match(self):
        entries = _make_perfect_entries(10)
        assert exact_match_rate(entries) == 1.0

    def test_exact_match_rate_none_match(self):
        entries = _make_failing_entries(10)
        assert exact_match_rate(entries) == 0.0

    def test_exact_match_rate_with_errors(self):
        entries = [
            _make_entry(0, "a", "a", True),
            _make_entry(1, "b", "b", True),
            _make_entry(2, "c", "wrong", False, error="API error"),
        ]
        # Error entries are excluded: 2 matches / 2 non-error = 1.0
        assert exact_match_rate(entries) == 1.0

    def test_corpus_chrf_identical(self):
        entries = _make_perfect_entries(5)
        score = corpus_chrf(entries)
        assert score == 100.0  # Perfect match → chrF++ = 100

    def test_corpus_bleu_identical(self):
        # BLEU requires multi-word sentences due to 4-gram matching
        entries = [
            _make_entry(i, f"the quick brown fox jumps {i}",
                        f"the quick brown fox jumps {i}", exact_match=True)
            for i in range(10)
        ]
        score = corpus_bleu(entries)
        assert score > 90.0  # Near-perfect match on multi-word sentences


# ---------------------------------------------------------------------------
# Test: run_significance_tests
# ---------------------------------------------------------------------------

class TestRunSignificanceTests:
    """Test the convenience function that runs all standard tests."""

    def test_returns_three_standard_metrics(self):
        a = _make_report(_make_perfect_entries(20))
        b = _make_report(_make_failing_entries(20))

        results = run_significance_tests(a, b, n_bootstrap=100)
        metric_names = [r.metric_name for r in results]

        assert "corpus_chrf" in metric_names
        assert "exact_match_rate" in metric_names
        assert "corpus_bleu" in metric_names

    def test_handles_partial_overlap(self):
        # A has entries 0-9, B has entries 5-14
        a_entries = [_make_entry(i, f"w_{i}", f"w_{i}", True) for i in range(10)]
        b_entries = [_make_entry(i, f"w_{i}", f"wrong_{i}", False) for i in range(5, 15)]
        a = _make_report(a_entries)
        b = _make_report(b_entries)

        results = run_significance_tests(a, b, n_bootstrap=100)
        assert len(results) >= 3  # Should still run on intersection


# ---------------------------------------------------------------------------
# Test: format_significance_table
# ---------------------------------------------------------------------------

class TestFormatTable:
    """Test the human-readable table formatter."""

    def test_format_produces_string(self):
        a = _make_perfect_entries(20)
        b = _make_failing_entries(20)
        result = paired_bootstrap(a, b, exact_match_rate, metric_name="em")
        table = format_significance_table([result])
        assert isinstance(table, str)
        assert "em" in table
        assert "p-value" in table


# ---------------------------------------------------------------------------
# Test: SignificanceResult dataclass
# ---------------------------------------------------------------------------

class TestSignificanceResult:
    """Test the dataclass."""

    def test_fields(self):
        r = SignificanceResult(
            metric_name="test",
            system_a_score=1.0,
            system_b_score=0.5,
            delta=0.5,
            p_value=0.01,
            n_bootstrap=1000,
            confidence_level=0.95,
            significant=True,
            winner="A",
            ci_lower=0.2,
            ci_upper=0.8,
        )
        assert r.metric_name == "test"
        assert r.significant is True
        assert r.winner == "A"

    def test_method_defaults_to_paired_bootstrap(self):
        # method has a default so old serialized dicts (pre-`method`) still
        # reconstruct via SignificanceResult(**d).
        r = SignificanceResult(
            metric_name="test",
            system_a_score=1.0, system_b_score=0.5, delta=0.5,
            p_value=0.01, n_bootstrap=1000, confidence_level=0.95,
            significant=True, winner="A", ci_lower=0.2, ci_upper=0.8,
        )
        assert r.method == "paired_bootstrap"


# ---------------------------------------------------------------------------
# Test: +1 Monte-Carlo correction — p-values are never exactly 0
# ---------------------------------------------------------------------------

class TestPlusOneCorrection:
    """Both methods report p = (count + 1) / (N + 1), so p is never 0."""

    def test_bootstrap_p_never_zero(self):
        a = _make_perfect_entries(50)
        b = _make_failing_entries(50)
        r = paired_bootstrap(a, b, exact_match_rate, n_bootstrap=1000, seed=1)
        # No bootstrap resample flips the sign → count 0 → p = 1/1001.
        assert r.p_value > 0.0
        assert r.p_value == pytest.approx(1 / 1001, abs=1e-4)

    def test_ar_p_never_zero(self):
        a = _make_perfect_entries(50)
        b = _make_failing_entries(50)
        r = paired_approximate_randomization(a, b, exact_match_rate, n_trials=1000, seed=1)
        assert r.p_value > 0.0
        assert r.p_value == pytest.approx(1 / 1001, abs=1e-4)

    def test_bootstrap_identical_p_is_one(self):
        # actual_delta == 0 → every resample "flips" → (N+1)/(N+1) = 1.0
        entries = _make_perfect_entries(40)
        r = paired_bootstrap(entries, entries, exact_match_rate, n_bootstrap=500)
        assert r.p_value == 1.0

    def test_ar_identical_p_is_one(self):
        entries = _make_perfect_entries(40)
        r = paired_approximate_randomization(entries, entries, exact_match_rate, n_trials=500)
        assert r.p_value == 1.0
        assert r.significant is False
        assert r.winner is None


# ---------------------------------------------------------------------------
# Test: the `method` field is set honestly per test
# ---------------------------------------------------------------------------

class TestMethodLabel:
    """Each function stamps the result with the test it actually ran."""

    def test_bootstrap_labels_itself(self):
        a = _make_perfect_entries(20)
        b = _make_failing_entries(20)
        r = paired_bootstrap(a, b, exact_match_rate, n_bootstrap=200)
        assert r.method == "paired_bootstrap"

    def test_ar_labels_itself(self):
        a = _make_perfect_entries(20)
        b = _make_failing_entries(20)
        r = paired_approximate_randomization(a, b, exact_match_rate, n_trials=200)
        assert r.method == "approximate_randomization"


# ---------------------------------------------------------------------------
# Test: paired approximate randomization (Riezler & Maxwell 2005)
# ---------------------------------------------------------------------------

class TestApproximateRandomization:
    """AR is the default, properly two-sided, null-centered test."""

    def test_perfect_vs_failing_significant(self):
        a = _make_perfect_entries(50)
        b = _make_failing_entries(50)
        r = paired_approximate_randomization(a, b, exact_match_rate, n_trials=1000)
        assert r.significant is True
        assert r.winner == "A"
        assert r.delta > 0.9

    def test_failing_vs_perfect_winner_b(self):
        a = _make_failing_entries(50)
        b = _make_perfect_entries(50)
        r = paired_approximate_randomization(a, b, exact_match_rate, n_trials=1000)
        assert r.significant is True
        assert r.winner == "B"
        assert r.delta < -0.9

    def test_deterministic_same_seed(self):
        a = _make_perfect_entries(30)
        b = _make_failing_entries(30)
        r1 = paired_approximate_randomization(a, b, exact_match_rate, n_trials=500, seed=7)
        r2 = paired_approximate_randomization(a, b, exact_match_rate, n_trials=500, seed=7)
        assert r1.p_value == r2.p_value
        assert r1.ci_lower == r2.ci_lower
        assert r1.ci_upper == r2.ci_upper

    def test_length_mismatch_raises(self):
        a = _make_perfect_entries(10)
        b = _make_perfect_entries(20)
        with pytest.raises(ValueError, match="Entry count mismatch"):
            paired_approximate_randomization(a, b, exact_match_rate)

    def test_id_mismatch_raises(self):
        a = [_make_entry(i, f"w_{i}", f"w_{i}", True) for i in range(10)]
        b = [_make_entry(i + 100, f"w_{i}", f"w_{i}", True) for i in range(10)]
        with pytest.raises(ValueError, match="Entry IDs do not match"):
            paired_approximate_randomization(a, b, exact_match_rate)

    def test_empty_inputs(self):
        r = paired_approximate_randomization([], [], exact_match_rate)
        assert r.p_value == 1.0
        assert r.significant is False
        assert r.method == "approximate_randomization"


# ---------------------------------------------------------------------------
# Test: the bootstrap heuristic OVERSTATES significance vs AR
# ---------------------------------------------------------------------------

class TestBootstrapOverstatesSignificance:
    """The core pitfall (Riezler & Maxwell 2005): on a small consistent edge,
    the Koehn sign-flip bootstrap declares significance where the proper
    approximate randomization test does not. This is exactly why AR is the
    default and the bootstrap p-value is labeled a conservative/biased estimate.
    """

    def test_small_edge_bootstrap_significant_ar_not(self):
        a, b = _make_small_edge_pair(n=50, k=5)
        bs = paired_bootstrap(a, b, exact_match_rate, n_bootstrap=1000, seed=12345)
        ar = paired_approximate_randomization(a, b, exact_match_rate, n_trials=1000, seed=12345)

        # Same observed effect...
        assert bs.delta == pytest.approx(0.1, abs=1e-9)
        assert ar.delta == pytest.approx(0.1, abs=1e-9)
        # ...but the bootstrap heuristic over-calls it.
        assert bs.significant is True
        assert ar.significant is False
        assert ar.p_value > bs.p_value


# ---------------------------------------------------------------------------
# Test: run_significance_tests method selection
# ---------------------------------------------------------------------------

class TestRunSignificanceTestsMethod:
    """The convenience runner defaults to AR and honors an explicit method."""

    def test_default_method_is_approximate_randomization(self):
        a = _make_report(_make_perfect_entries(20))
        b = _make_report(_make_failing_entries(20))
        results = run_significance_tests(a, b, n_bootstrap=100)
        assert results
        assert all(r.method == "approximate_randomization" for r in results)

    def test_explicit_bootstrap_method(self):
        a = _make_report(_make_perfect_entries(20))
        b = _make_report(_make_failing_entries(20))
        results = run_significance_tests(a, b, n_bootstrap=100, method="paired_bootstrap")
        assert results
        assert all(r.method == "paired_bootstrap" for r in results)

    def test_unknown_method_raises(self):
        a = _make_report(_make_perfect_entries(20))
        b = _make_report(_make_failing_entries(20))
        with pytest.raises(ValueError, match="Unknown significance method"):
            run_significance_tests(a, b, n_bootstrap=100, method="nope")


# ---------------------------------------------------------------------------
# Test: table formatting reflects the method honestly
# ---------------------------------------------------------------------------

class TestFormatTableMethod:
    """The human-readable table names the test and flags the bootstrap caveat."""

    def test_ar_table_names_method(self):
        a = _make_perfect_entries(20)
        b = _make_failing_entries(20)
        r = paired_approximate_randomization(a, b, exact_match_rate, n_trials=200, metric_name="em")
        table = format_significance_table([r])
        assert "approximate randomization" in table
        assert "sign-flip" not in table

    def test_bootstrap_table_flags_caveat(self):
        a = _make_perfect_entries(20)
        b = _make_failing_entries(20)
        r = paired_bootstrap(a, b, exact_match_rate, n_bootstrap=200, metric_name="em")
        table = format_significance_table([r])
        assert "sign-flip" in table
        assert "conservative/biased" in table


# ---------------------------------------------------------------------------
# Test: dataclass serialization round-trips (compare.py relies on this)
# ---------------------------------------------------------------------------

class TestResultRoundTrip:
    """compare.py serializes via asdict() and rebuilds via SignificanceResult(**d)."""

    def test_asdict_roundtrip_preserves_method(self):
        a = _make_perfect_entries(20)
        b = _make_failing_entries(20)
        r = paired_approximate_randomization(a, b, exact_match_rate, n_trials=200)
        d = asdict(r)
        r2 = SignificanceResult(**d)
        assert r2.method == "approximate_randomization"
        assert r2 == r

    def test_legacy_dict_without_method_reconstructs(self):
        # A pre-`method` serialized result must still rebuild (back-compat).
        legacy = {
            "metric_name": "corpus_chrf",
            "system_a_score": 50.0, "system_b_score": 48.0, "delta": 2.0,
            "p_value": 0.03, "n_bootstrap": 1000, "confidence_level": 0.95,
            "significant": True, "winner": "A", "ci_lower": 0.5, "ci_upper": 3.5,
        }
        r = SignificanceResult(**legacy)
        assert r.method == "paired_bootstrap"


# ---------------------------------------------------------------------------
# Test: the bootstrap CI actually behaves like a CI (test-suite audit
# 2026-08-19, S2 — _percentile_ci mutants survived because no test constrained
# the interval's relationship to the observed delta or its width)
# ---------------------------------------------------------------------------

def _make_noisy_pair(n: int = 60, seed: int = 7) -> tuple[list[dict], list[dict]]:
    """Two systems with per-entry noise: A is right ~70% of the time, B ~40%,
    independently per entry — so resampled deltas genuinely vary."""
    import random
    rng = random.Random(seed)
    a, b = [], []
    for i in range(n):
        a_ok = rng.random() < 0.7
        b_ok = rng.random() < 0.4
        a.append(_make_entry(i, f"w_{i}", f"w_{i}" if a_ok else f"A_{i}", a_ok))
        b.append(_make_entry(i, f"w_{i}", f"w_{i}" if b_ok else f"B_{i}", b_ok))
    return a, b


class TestBootstrapCiBehaviour:
    """The percentile CI must bracket the observed delta and have real width."""

    def test_ci_brackets_the_observed_delta(self):
        a, b = _make_noisy_pair()
        for result in (
            paired_bootstrap(a, b, exact_match_rate, n_bootstrap=1000, seed=3),
            paired_approximate_randomization(
                a, b, exact_match_rate, n_trials=500, seed=3),
        ):
            assert result.ci_lower <= result.delta <= result.ci_upper, (
                f"{result.method}: CI [{result.ci_lower}, {result.ci_upper}] "
                f"must bracket the observed delta {result.delta}"
            )

    def test_ci_has_positive_width_on_noisy_data(self):
        a, b = _make_noisy_pair()
        r = paired_bootstrap(a, b, exact_match_rate, n_bootstrap=1000, seed=3)
        assert r.ci_upper - r.ci_lower > 0.0, (
            "a resampled CI over noisy per-entry data must not be zero-width"
        )

    def test_degenerate_bootstrap_count_raises(self):
        # Fewer than 10 resamples cannot back a percentile interval — the
        # guard fails loud instead of publishing a zero-width "CI".
        a, b = _make_noisy_pair(n=20)
        with pytest.raises(ValueError, match="fewer than 10"):
            paired_bootstrap(a, b, exact_match_rate, n_bootstrap=2)
        with pytest.raises(ValueError, match="fewer than 10"):
            paired_approximate_randomization(
                a, b, exact_match_rate, n_trials=100, n_bootstrap_ci=5)

    def test_minimum_viable_bootstrap_count_still_works(self):
        a, b = _make_noisy_pair(n=20)
        r = paired_bootstrap(a, b, exact_match_rate, n_bootstrap=10)
        assert r.ci_lower <= r.delta <= r.ci_upper
