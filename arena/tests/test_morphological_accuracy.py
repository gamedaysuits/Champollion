"""P5 — morphological_accuracy (FST-derived, lemma-matched, coverage-disclosed).

The metric is the SECOND structural pillar: given a valid word with the right
root, is the *inflection* right? It compares the FST analysis (feature tags) of a
predicted word to that of a reference word sharing its LEMMA — so it is
deterministic (the FST is ground truth, not hallucinated) and matching-by-lemma
sidesteps word alignment. These tests use a MOCK FST analyzer (no real FST), so
they pin the logic: lemma-match coverage, inflection comparison, and the honest
"out of coverage" cases (different word choice / unanalyzable).
"""

from __future__ import annotations

from pathlib import Path

from mt_eval_harness.plugins.giellalt_fst import (
    GiellaLTFSTMetric,
    parse_giellalt_analysis,
)


def _metric(analyses: dict):
    """A GiellaLTFSTMetric whose FST analysis is a fixed dict (no real FST)."""
    m = GiellaLTFSTMetric(lang_code="test", fst_dir=Path("/nonexistent"))

    def _clean(w):
        return w.strip(".,;:!?\"'()[]{}—–-")

    m._word_analyses = lambda w: analyses.get(_clean(w), [])
    m._analyze_word = lambda w: bool(analyses.get(_clean(w), []))
    return m


def _morph(metric, predicted, expected):
    agg = metric.aggregate([metric.compute({"predicted": predicted, "expected": expected})])
    return agg["morphological_accuracy"], agg["morph_coverage"]


# Mock FST: word -> list of (lemma, tagset) analyses.
ANALYSES = {
    "wrote":  [("write", frozenset({"V", "Past"}))],
    "writes": [("write", frozenset({"V", "Pres"}))],   # same lemma, WRONG tense
    "dog":    [("dog", frozenset({"N", "Sg"}))],
    "cat":    [("cat", frozenset({"N", "Sg"}))],
    "zzz":    [],                                       # not analyzable (OOV/invalid)
}


class TestParse:
    def test_lemma_and_tags(self):
        assert parse_giellalt_analysis("write+V+Past") == ("write", frozenset({"V", "Past"}))

    def test_lemma_only_no_tags(self):
        assert parse_giellalt_analysis("dog") == ("dog", frozenset())

    def test_empty(self):
        assert parse_giellalt_analysis("") == ("", frozenset())


class TestMorphAccuracy:
    def test_identical_is_correct(self):
        acc, cov = _morph(_metric(ANALYSES), "wrote", "wrote")
        assert acc == 1.0 and cov == 1.0

    def test_same_lemma_wrong_inflection_is_incorrect(self):
        # "writes" (present) vs reference "wrote" (past): same root, wrong tense.
        acc, cov = _morph(_metric(ANALYSES), "writes", "wrote")
        assert acc == 0.0 and cov == 1.0

    def test_different_word_choice_is_out_of_coverage(self):
        # "dog" is analyzable but its lemma isn't in the reference → NOT covered
        # (a different word choice is not a morphology error).
        acc, cov = _morph(_metric(ANALYSES), "dog", "wrote")
        assert acc is None and cov == 0.0

    def test_unanalyzable_word_is_out_of_coverage(self):
        # "zzz" not analyzable → not counted (fst validity, not morphology).
        acc, cov = _morph(_metric(ANALYSES), "zzz", "wrote")
        assert acc is None and cov == 0.0

    def test_mixed_partial_accuracy_and_coverage(self):
        # pred "writes dog" vs ref "wrote dog": write covered+wrong, dog covered+right.
        acc, cov = _morph(_metric(ANALYSES), "writes dog", "wrote dog")
        assert acc == 0.5 and cov == 1.0

    def test_coverage_fraction_excludes_uncovered(self):
        # pred "wrote cat" vs ref "wrote": "wrote" covered+correct, "cat" analyzable
        # but uncovered → coverage 1/2, accuracy 1.0 over the covered word.
        acc, cov = _morph(_metric(ANALYSES), "wrote cat", "wrote")
        assert acc == 1.0 and cov == 0.5

    def test_no_reference_yields_no_morph(self):
        acc, cov = _morph(_metric(ANALYSES), "wrote", "")
        assert acc is None and cov == 0.0


class TestFstUnavailableFailsHonest:
    """When NO entry could be FST-analyzed (FST/pyhfst missing), the aggregate
    must report UNAVAILABLE (None + error), never a fabricated 0.0 — otherwise
    publish reads avg_fst_validity=0.0, flips has_fst=True, and the leaderboard
    shows a damning, invented '0% morphologically valid' score.
    """

    def test_empty_entry_results_is_unavailable_not_zero(self):
        agg = _metric(ANALYSES).aggregate([])
        assert agg["avg_fst_validity"] is None
        assert agg["corpus_validity_rate"] is None
        assert "error" in agg  # publish skips a metric carrying an error

    def test_all_errored_entries_is_unavailable_and_surfaces_cause(self):
        # Every per-entry compute() errored (e.g. pyhfst not installed).
        errored = [
            {"error": "pyhfst not installed"},
            {"error": "pyhfst not installed"},
        ]
        agg = _metric(ANALYSES).aggregate(errored)
        assert agg["avg_fst_validity"] is None
        assert "error" in agg
        assert "pyhfst not installed" in agg["error"]

    def test_genuine_zero_validity_is_still_reported(self):
        # FST IS available and analyzes the word, but it is invalid (OOV) — a
        # REAL 0.0 must still be reported (not confused with unavailable).
        agg = _metric(ANALYSES).aggregate([
            _metric(ANALYSES).compute({"predicted": "zzz", "expected": "zzz"})
        ])
        assert agg["avg_fst_validity"] == 0.0
        assert agg.get("error") is None
