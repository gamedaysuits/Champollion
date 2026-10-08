"""ConventionNormalizer — pure, deterministic SRO transforms (no FST/API)."""

from __future__ import annotations

from champollion_lyss.crk.convention_normalizer import ConventionNormalizer


def test_normalize_ortho_lowercases_dehyphenates_strips_punct():
    assert ConventionNormalizer.normalize_ortho("Ê-Wâpiskâk.") == "ê wâpiskâk"


def test_normalize_ortho_collapses_whitespace():
    assert ConventionNormalizer.normalize_ortho("  atim   wâpamêw  ") == "atim wâpamêw"


def test_compare_runs_and_returns_result():
    norm = ConventionNormalizer()
    res = norm.compare("niwâpamâw atim", "niwâpamâw atim")
    # Identical strings have no residual error and report a match tier.
    assert isinstance(res.best_match_tier, str)
    assert res.residual_error_count == 0
