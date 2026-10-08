"""P4 — FUSE-style comparator (reported, NOT in composite; UNTRAINED reimplementation).

Tests the dependency-free feature components directly, the honest None-without-LaBSE
behavior, and the invariant that fuse never enters a composite profile.
"""

from __future__ import annotations

import pytest

from mt_eval_harness.metrics_fuse import (
    HAS_LABSE,
    HAS_PHONETIC,
    compute_fuse,
    fuzzy_similarity,
    lexical_similarity,
    phonetic_similarity,
)
from mt_eval_harness.scoring import PROFILE_REGISTRY


class TestDepFreeComponents:
    def test_lexical_identical_is_one(self):
        assert lexical_similarity("the cat sat", "the cat sat") == 1.0

    def test_lexical_disjoint_is_zero(self):
        assert lexical_similarity("abc def", "xyz uvw") == 0.0

    def test_lexical_partial_between(self):
        assert 0.0 < lexical_similarity("the cat sat", "the dog sat") < 1.0

    def test_lexical_empty_both_is_one(self):
        assert lexical_similarity("", "") == 1.0

    def test_lexical_empty_one_is_zero(self):
        assert lexical_similarity("hello", "") == 0.0

    def test_fuzzy_identical_is_one(self):
        assert fuzzy_similarity("hello world", "hello world") == 1.0

    def test_fuzzy_disjoint_low(self):
        assert fuzzy_similarity("hello", "xyzzy") < 0.5


class TestPhonetic:
    def test_phonetic_none_without_jellyfish_else_in_range(self):
        r = phonetic_similarity("smith smyth", "smith smith")
        if not HAS_PHONETIC:
            assert r is None  # disclosed absence, not a faked 0/1
        else:
            assert 0.0 <= r <= 1.0


class TestCompute:
    def test_none_without_labse_or_runs_when_present(self):
        entries = [
            {"expected": "the cat sat on the mat", "predicted": "the cat sat on the mat"},
        ]
        result = compute_fuse(entries)
        if not HAS_LABSE:
            # Semantic backbone absent → None (disclosed), never a faked FUSE score.
            assert result is None
        else:
            assert result is not None
            assert result.untrained is True
            assert 0.0 <= result.corpus_score <= 1.0
            assert "semantic(LaBSE)" in result.components_used


class TestNotInComposite:
    def test_fuse_never_in_any_profile(self):
        for name, weights in PROFILE_REGISTRY.items():
            for forbidden in ("fuse_score", "fuse", "corpus_fuse"):
                assert forbidden not in weights, f"{forbidden} leaked into profile {name}"
