"""CrkLinter (lint_translation) — deterministic variant-class detection.

The rule-based classes run fully offline; LEMMA_SYNONYM (the only FST-dependent
class) is exercised with a mocked generator.
"""

from __future__ import annotations

from champollion_lyss.crk import linter as L
from champollion_lyss.crk.linter import lint_translation
from champollion_lyss.crk.fst_adapter import AnalysisResult


def test_exact_match_ignores_case_and_punctuation():
    r = lint_translation("Atim.", "atim")
    assert r.exact_match is True
    assert r.verdict == "EXACT"


def test_long_vowel_macron_is_equivalent():
    r = lint_translation("âstam", "āstam")  # circumflex vs macron
    assert r.exact_match is False
    assert "LONG_VOWEL_MACRON" in r.variant_names
    assert r.equivalent_match is True
    assert r.verdict == "EQUIVALENT"


def test_genuine_miss_without_fst():
    r = lint_translation("nipâw", "atim")
    assert r.equivalent_match is False
    assert r.verdict == "MISS"


class _FakeGen:
    """Analyses where lemma == surface form, e.g. 'takosin+V+AI+Ind+3Sg'."""

    def analyze(self, word):
        return AnalysisResult(
            word=word, success=True, analyses=[f"{word}+V+AI+Ind+3Sg"]
        )


def test_lemma_synonym_is_equivalent_with_mocked_fst(monkeypatch):
    monkeypatch.setattr(L, "_get_generator", lambda: _FakeGen())
    # takosin / takohtêw are a known 'arrive' synonym pair in LEMMA_SYNONYMS.
    r = lint_translation("takosin", "takohtêw")
    assert "LEMMA_SYNONYM" in r.variant_names
    # The registry pair must yield the EQUIVALENT verdict, not just detection
    # (regression: the verifier used to downgrade every synonym to MISS).
    assert r.equivalent_match is True
    assert r.verdict == "EQUIVALENT"


def test_lemma_synonym_multiword_is_equivalent(monkeypatch):
    monkeypatch.setattr(L, "_get_generator", lambda: _FakeGen())
    r = lint_translation("wîpac takosin", "wîpac takohtêw")
    assert "LEMMA_SYNONYM" in r.variant_names
    assert r.equivalent_match is True


def test_particle_synonym_without_fst_analysis_is_equivalent(monkeypatch):
    class NoAnalysisGen:
        """FST has no entry for informal contractions like 'môya'."""

        def analyze(self, word):
            return AnalysisResult(word=word, success=False, analyses=[])

    monkeypatch.setattr(L, "_get_generator", lambda: NoAnalysisGen())
    # namôya / môya are registered as surface-form synonyms; the linter must
    # fall back to surface comparison when the FST yields no analysis.
    r = lint_translation("namôya nipâw", "môya nipâw")
    assert "LEMMA_SYNONYM" in r.variant_names
    assert r.equivalent_match is True


def test_unregistered_lemma_difference_still_misses(monkeypatch):
    monkeypatch.setattr(L, "_get_generator", lambda: _FakeGen())
    # nipâw / atim differ but are NOT a registered synonym pair.
    r = lint_translation("wîpac nipâw", "wîpac atim")
    assert "LEMMA_SYNONYM" not in r.variant_names
    assert r.equivalent_match is False
    assert r.verdict == "MISS"
