"""Power analysis — including a check against the paper's own published numbers.

The calibration test is the important one. Everything else here checks that the
code does what it says; only that test checks that what it says is right.
"""

from __future__ import annotations

import pytest

from mt_eval_harness.power import (
    PUBLISHED_PRIOR,
    EffectParameters,
    estimate_effect_parameters,
    minimum_detectable_effect,
    simulate_power,
)


def prior_params() -> EffectParameters:
    return EffectParameters(
        p0=PUBLISHED_PRIOR["p0"],
        b0=PUBLISHED_PRIOR["b0"],
        source="prior",
        basis=PUBLISHED_PRIOR["citation"],
    )


class TestCalibration:
    """Against Card et al. 2020 §4, the only external check available."""

    def test_reproduces_the_papers_headline(self):
        # Their result: a typical MT test set of ~2,000 segments has roughly 75%
        # power to detect 1 BLEU. If our simulation is right, running it with
        # their fitted parameters should land near that.
        #
        # A wide band on purpose: our P0/b0 are the midpoint of four fits whose
        # own range is P0 0.09-0.19, and the paper reports "approximately 75%".
        # A test that demanded 0.75 exactly would be asserting more precision
        # than the source has.
        power = simulate_power(
            2000, 1.0, prior_params(), n_simulations=300, n_trials=300, seed=7
        )
        assert 0.55 <= power <= 0.95, (
            f"power at n=2000, 1 BLEU came out {power:.2f}; Card et al. report "
            "approximately 75%, so a result far outside this band means the "
            "generative process or the test is wrong"
        )

    def test_power_rises_with_corpus_size(self):
        p = prior_params()
        small = simulate_power(200, 1.0, p, n_simulations=200, n_trials=200, seed=7)
        large = simulate_power(4000, 1.0, p, n_simulations=200, n_trials=200, seed=7)
        assert small < large

    def test_power_rises_with_effect_size(self):
        p = prior_params()
        subtle = simulate_power(1000, 0.5, p, n_simulations=200, n_trials=200, seed=7)
        obvious = simulate_power(1000, 5.0, p, n_simulations=200, n_trials=200, seed=7)
        assert subtle < obvious


class TestMinimumDetectableEffect:
    def test_a_bigger_corpus_resolves_a_smaller_difference(self):
        p = prior_params()
        small = minimum_detectable_effect(
            200, p, metric="BLEU", n_simulations=120, n_trials=120, seed=3
        )
        large = minimum_detectable_effect(
            3000, p, metric="BLEU", n_simulations=120, n_trials=120, seed=3
        )
        assert small.minimum_detectable_effect is not None
        assert large.minimum_detectable_effect is not None
        assert large.minimum_detectable_effect < small.minimum_detectable_effect

    def test_a_tiny_corpus_returns_no_number_and_says_why(self):
        # The median corpus card is 137 entries and 376 are under 100. Where the
        # honest answer is "this cannot settle anything", it must not be
        # rendered as a number.
        result = minimum_detectable_effect(
            3,
            prior_params(),
            metric="chrF++",
            search_max=5.0,
            n_simulations=60,
            n_trials=60,
            seed=3,
        )
        if result.minimum_detectable_effect is None:
            assert result.note and "power" in result.note
        else:
            # If it does resolve something, it must be a large difference —
            # never a small one that would flatter a 3-segment corpus.
            assert result.minimum_detectable_effect > 1.0

    def test_fewer_than_two_segments_is_not_a_comparison(self):
        r = minimum_detectable_effect(1, prior_params(), metric="chrF++")
        assert r.minimum_detectable_effect is None
        assert "2 segments" in r.note

    def test_the_result_is_reproducible(self):
        p = prior_params()
        a = minimum_detectable_effect(
            500, p, metric="BLEU", n_simulations=100, n_trials=100, seed=99
        )
        b = minimum_detectable_effect(
            500, p, metric="BLEU", n_simulations=100, n_trials=100, seed=99
        )
        assert a.minimum_detectable_effect == b.minimum_detectable_effect


class TestProvenance:
    """An MDE that does not say where its parameters came from is not evidence."""

    def test_every_result_carries_its_parameter_source(self):
        r = minimum_detectable_effect(
            500, prior_params(), metric="BLEU", n_simulations=60, n_trials=60
        )
        assert r.parameters.source == "prior"
        assert "Card et al" in r.parameters.basis
        assert r.derivation_version

    def test_the_prior_names_the_metric_and_pair_it_came_from(self):
        # BLEU on English-German. Borrowing it for chrF++ on a low-resource pair
        # is a labelled approximation, and the label is what makes it one.
        assert PUBLISHED_PRIOR["metric"] == "BLEU"
        assert PUBLISHED_PRIOR["language_pair"] == "eng-deu"
        assert "arXiv:2010.06595" in PUBLISHED_PRIOR["citation"]

    def test_measured_parameters_record_what_they_were_fitted_on(self):
        entries_a = [{"id": str(i), "score": float(i % 5)} for i in range(40)]
        entries_b = [{"id": str(i), "score": float((i + 2) % 5)} for i in range(40)]
        metric = lambda es: sum(e["score"] for e in es) / len(es)  # noqa: E731

        p = estimate_effect_parameters(
            entries_a, entries_b, metric, basis="test-corpus chrF++"
        )
        assert p.source == "measured"
        assert p.basis == "test-corpus chrF++"
        assert p.n_segments == 40
        assert 0.0 <= p.p0 < 1.0
        assert p.b0 > 0


class TestFitting:
    def test_identical_systems_have_no_effect_distribution(self):
        entries = [{"id": str(i), "score": 1.0} for i in range(10)]
        metric = lambda es: sum(e["score"] for e in es) / len(es)  # noqa: E731
        with pytest.raises(ValueError, match="identical"):
            estimate_effect_parameters(entries, list(entries), metric, basis="x")

    def test_mismatched_pairs_are_refused(self):
        metric = lambda es: float(len(es))  # noqa: E731
        with pytest.raises(ValueError, match="same number"):
            estimate_effect_parameters(
                [{"id": "1"}], [{"id": "1"}, {"id": "2"}], metric, basis="x"
            )

    def test_p0_counts_segments_the_metric_cannot_tell_apart(self):
        # Half the segments identical between systems, half different.
        entries_a = [{"id": str(i), "score": 1.0} for i in range(20)]
        entries_b = [
            {"id": str(i), "score": 1.0 if i % 2 == 0 else 2.0} for i in range(20)
        ]
        metric = lambda es: sum(e["score"] for e in es) / len(es)  # noqa: E731
        p = estimate_effect_parameters(entries_a, entries_b, metric, basis="x")
        assert p.p0 == pytest.approx(0.5, abs=0.01)
