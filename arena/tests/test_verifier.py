"""Server-side re-score verifier — the un-fakeable floor.

These tests pin the property that matters: a contributor cannot inflate a
leaderboard score, because the server re-derives chrF++ from the run's own
stored outputs (predicted vs expected) and refuses to promote a claim it can't
reproduce.
"""

from __future__ import annotations

import pytest

pytest.importorskip("sacrebleu")  # harness dep; skip cleanly if not installed

from mt_eval_harness.verifier import (
    build_reference_index,
    build_verdict,
    comet_reproduces,
    morph_reproduces,
    qe_reproduces,
    recompute_corpus_chrf,
    recompute_corpus_comet,
    recompute_corpus_morph,
    recompute_corpus_qe,
    verify_against_corpus,
)


def _entries(pairs):
    """pairs: list of (predicted, expected)."""
    return [{"predicted": p, "expected": e} for p, e in pairs]


FAITHFUL = _entries([
    ("the cat sat on the mat", "the cat sat on the mat"),
    ("a dog ran in the park", "a dog ran in the park"),
    ("she sells sea shells", "she sells sea shells"),
])

GARBAGE = _entries([
    ("zzzz qqqq", "the cat sat on the mat"),
    ("wxyz vbnm", "a dog ran in the park"),
    ("0000 1111", "she sells sea shells"),
])


class TestRecompute:
    def test_identical_outputs_score_near_100(self):
        chrf, n = recompute_corpus_chrf(FAITHFUL)
        assert n == 3
        assert chrf is not None and chrf > 99.0

    def test_garbage_outputs_score_low(self):
        chrf, n = recompute_corpus_chrf(GARBAGE)
        assert n == 3
        assert chrf is not None and chrf < 50.0

    def test_no_references_is_unscoreable(self):
        chrf, n = recompute_corpus_chrf([{"predicted": "x", "expected": ""}])
        assert chrf is None and n == 0

    def test_missing_prediction_counts_as_empty(self):
        # An errored entry (no prediction) must NOT be silently dropped — it
        # scores as an empty hypothesis (bad), matching the original run.
        chrf, n = recompute_corpus_chrf([{"expected": "the cat sat on the mat"}])
        assert n == 1
        assert chrf is not None and chrf < 50.0


class TestVerdict:
    def test_faithful_claim_is_verified(self):
        v = build_verdict("card-1", reported_chrf=100.0, entries=FAITHFUL)
        assert v.ok is True
        assert v.recomputed_chrf > 99.0

    def test_inflated_claim_is_caught(self):
        # Contributor claims chrF++ 95 but their own outputs are garbage.
        v = build_verdict("card-2", reported_chrf=95.0, entries=GARBAGE)
        assert v.ok is False
        assert "MISMATCH" in v.reason

    def test_small_difference_within_tolerance_passes(self):
        chrf, _ = recompute_corpus_chrf(FAITHFUL)
        v = build_verdict("card-3", reported_chrf=chrf - 0.4, entries=FAITHFUL)
        assert v.ok is True

    def test_difference_beyond_tolerance_fails(self):
        chrf, _ = recompute_corpus_chrf(FAITHFUL)
        v = build_verdict("card-4", reported_chrf=chrf - 5.0, entries=FAITHFUL)
        assert v.ok is False
        assert "MISMATCH" in v.reason

    def test_vacuous_run_is_not_verified(self):
        v = build_verdict("card-5", reported_chrf=100.0, entries=[])
        assert v.ok is False
        assert "MISMATCH" not in v.reason  # unscoreable, not a fabrication

    def test_missing_reported_score_is_not_verified(self):
        v = build_verdict("card-6", reported_chrf=None, entries=FAITHFUL)
        assert v.ok is False


# Corpus-anchored verification (red-team R1 fix A): score predicted vs the
# CANONICAL sha-pinned reference and reject tampered stored `expected`.

CANONICAL = [
    {"source": "the cat sat on the mat", "reference": "le chat etait assis sur le tapis"},
    {"source": "a dog ran in the park", "reference": "un chien a couru dans le parc"},
    {"source": "she sells sea shells", "reference": "elle vend des coquillages"},
]


def _anchored(pairs):
    """pairs: (source, predicted, stored_expected)."""
    return [{"source": s, "predicted": p, "expected": e} for s, p, e in pairs]


class TestCorpusAnchored:
    def test_reference_index_maps_source_to_reference(self):
        idx = build_reference_index(CANONICAL)
        assert idx["the cat sat on the mat"] == "le chat etait assis sur le tapis"
        assert len(idx) == 3

    def test_ambiguous_source_is_dropped(self):
        idx = build_reference_index(CANONICAL + [
            {"source": "the cat sat on the mat", "reference": "DIFFERENT"},
        ])
        assert "the cat sat on the mat" not in idx  # conflicting refs -> not anchorable

    def test_faithful_run_verifies_against_canonical(self):
        idx = build_reference_index(CANONICAL)
        # predicted == canonical reference; stored expected == canonical too.
        entries = _anchored([(c["source"], c["reference"], c["reference"]) for c in CANONICAL])
        v = verify_against_corpus("c1", reported_chrf=100.0, entries=entries, reference_index=idx)
        assert v.ok is True
        assert v.recomputed_chrf > 99.0
        assert v.details["n_tampered"] == 0

    def test_tampered_stored_expected_is_rejected(self):
        idx = build_reference_index(CANONICAL)
        # Attacker stored a fake gold ("expected") that matches their prediction,
        # but it differs from the registered corpus reference.
        entries = _anchored([
            ("the cat sat on the mat", "MY FAKE PERFECT", "MY FAKE PERFECT"),
            ("a dog ran in the park", c2 := "un chien a couru dans le parc", c2),
            ("she sells sea shells", c3 := "elle vend des coquillages", c3),
        ])
        v = verify_against_corpus("c2", reported_chrf=100.0, entries=entries, reference_index=idx)
        assert v.ok is False
        assert "TAMPERED" in v.reason
        assert v.details["n_tampered"] == 1

    def test_garbage_predicted_mismatches_canonical(self):
        idx = build_reference_index(CANONICAL)
        # Honest references stored, but predictions are garbage and the claim is high.
        entries = _anchored([(c["source"], "zzzz qqqq", c["reference"]) for c in CANONICAL])
        v = verify_against_corpus("c3", reported_chrf=95.0, entries=entries, reference_index=idx)
        assert v.ok is False
        assert "MISMATCH" in v.reason

    def test_unmatched_sources_cannot_anchor(self):
        idx = build_reference_index(CANONICAL)
        entries = _anchored([("a sentence not in the corpus", "whatever", "whatever")])
        v = verify_against_corpus("c4", reported_chrf=100.0, entries=entries, reference_index=idx)
        assert v.ok is False
        assert "anchor" in v.reason.lower()
        assert v.details["n_unmatched"] == 1

    def test_residual_hole_copying_public_reference_scores_high(self):
        # Documented honestly: on a PUBLIC corpus, copying the real reference as
        # the "translation" still scores ~100. This needs the sandboxed gold-tier
        # re-run; verify_against_corpus is NOT claimed to catch it.
        idx = build_reference_index(CANONICAL)
        entries = _anchored([(c["source"], c["reference"], c["reference"]) for c in CANONICAL])
        v = verify_against_corpus("c5", reported_chrf=100.0, entries=entries, reference_index=idx)
        assert v.ok is True  # known residual — see module docstring + gold tier


# COMET re-derivation (P2): a reported comet_score must reproduce server-side,
# scored against the CANONICAL references, or the run cannot be verified.

class TestComet:
    def test_recompute_uses_canonical_ref_and_injected_scorer(self):
        idx = build_reference_index(CANONICAL)
        # stored expected is honest, predictions arbitrary — the scorer must be
        # handed the CANONICAL reference, never the submitter's stored expected.
        entries = _anchored([(c["source"], "whatever", c["reference"]) for c in CANONICAL])
        captured = {}

        def scorer(data):
            captured["data"] = data
            return 0.83

        score, n = recompute_corpus_comet(entries, idx, comet_scorer=scorer)
        assert score == 0.83 and n == 3
        assert captured["data"][0]["expected"] == CANONICAL[0]["reference"]
        assert captured["data"][0]["predicted"] == "whatever"

    def test_no_scorer_means_unreproducible(self):
        # No COMET in the verifier env → cannot re-derive (returns None), which
        # comet_reproduces() turns into a FAIL — never a silent pass.
        idx = build_reference_index(CANONICAL)
        entries = _anchored([(c["source"], "x", c["reference"]) for c in CANONICAL])
        score, _n = recompute_corpus_comet(entries, idx, comet_scorer=None)
        assert score is None

    def test_unmatched_sources_yield_no_comet(self):
        idx = build_reference_index(CANONICAL)
        entries = _anchored([("a sentence not in the corpus", "x", "y")])
        score, n = recompute_corpus_comet(entries, idx, comet_scorer=lambda d: 0.9)
        assert score is None and n == 0

    def test_comet_reproduces_within_tolerance(self):
        ok, _ = comet_reproduces(0.80, 0.805)
        assert ok is True

    def test_comet_mismatch_is_caught(self):
        ok, reason = comet_reproduces(0.95, 0.40)
        assert ok is False and "MISMATCH" in reason

    def test_comet_unreproducible_is_fail_but_not_fabrication(self):
        # scorer unavailable → fail, but NOT a 'MISMATCH' fabrication verdict
        # (we just couldn't reproduce it server-side).
        ok, reason = comet_reproduces(0.80, None)
        assert ok is False and "MISMATCH" not in reason

    def test_comet_reported_none_is_fail(self):
        ok, _ = comet_reproduces(None, 0.5)
        assert ok is False


# Reference-free QE re-derivation (P4): a reported qe_score must reproduce from
# source + MT alone (no reference), or the run cannot be verified.

class TestQe:
    def test_recompute_uses_source_and_predicted(self):
        captured = {}

        def scorer(data):
            captured["data"] = data
            return 0.77

        entries = [
            {"source": "hello world", "predicted": "bonjour monde"},
            {"source": "good night", "predicted": "bonne nuit"},
        ]
        score, n = recompute_corpus_qe(entries, qe_scorer=scorer)
        assert score == 0.77 and n == 2
        assert captured["data"][0] == {"source": "hello world", "predicted": "bonjour monde"}

    def test_no_scorer_means_unreproducible(self):
        score, _n = recompute_corpus_qe([{"source": "x", "predicted": "y"}], qe_scorer=None)
        assert score is None

    def test_empty_source_skipped(self):
        score, n = recompute_corpus_qe([{"source": "", "predicted": "y"}], qe_scorer=lambda d: 0.5)
        assert score is None and n == 0

    def test_qe_reproduces_within_tolerance(self):
        ok, _ = qe_reproduces(0.80, 0.805)
        assert ok is True

    def test_qe_mismatch_is_caught(self):
        ok, reason = qe_reproduces(0.95, 0.40)
        assert ok is False and "MISMATCH" in reason

    def test_qe_unreproducible_is_fail_but_not_fabrication(self):
        ok, reason = qe_reproduces(0.80, None)
        assert ok is False and "MISMATCH" not in reason


# FST morphological_accuracy re-derivation (P5): when morph is active in the
# composite, a reported morphological_accuracy must reproduce against the SAME
# card-pinned FST + canonical references, with coverage ≥ floor. The scorer is
# injected (no real FST) so these tests pin the trust logic, not pyhfst.

class TestMorph:
    def test_recompute_uses_canonical_ref_and_injected_scorer(self):
        idx = build_reference_index(CANONICAL)
        captured = {}

        def scorer(data):
            captured["data"] = data
            return 0.66, 0.80  # (accuracy, coverage)

        # source maps to its CANONICAL reference, not the submitter's stored expected
        entries = [{"source": "the cat sat on the mat", "predicted": "le chat",
                    "expected": "TAMPERED"}]
        acc, cov, n = recompute_corpus_morph(entries, idx, morph_scorer=scorer)
        assert acc == 0.66 and cov == 0.80 and n == 1
        # the scorer saw the CANONICAL reference, not the tampered stored expected
        assert captured["data"][0]["expected"] == "le chat etait assis sur le tapis"

    def test_no_scorer_means_unreproducible(self):
        idx = build_reference_index(CANONICAL)
        entries = [{"source": "the cat sat on the mat", "predicted": "x"}]
        acc, cov, _n = recompute_corpus_morph(entries, idx, morph_scorer=None)
        assert acc is None and cov is None

    def test_unmatched_sources_yield_no_morph(self):
        idx = build_reference_index(CANONICAL)
        entries = [{"source": "not in the corpus", "predicted": "x"}]
        acc, cov, n = recompute_corpus_morph(
            entries, idx, morph_scorer=lambda d: (0.9, 0.9))
        assert acc is None and cov is None and n == 0

    def test_morph_reproduces_within_tolerance(self):
        ok, _ = morph_reproduces(0.80, 0.805, 0.50, floor=0.25)
        assert ok is True

    def test_morph_mismatch_is_caught(self):
        ok, reason = morph_reproduces(0.95, 0.40, 0.50, floor=0.25)
        assert ok is False and "MISMATCH" in reason

    def test_morph_unreproducible_is_fail_but_not_fabrication(self):
        # FST absent in the verifier env → recomputed None → FAIL, but not a
        # fabrication accusation (we simply could not reproduce it).
        ok, reason = morph_reproduces(0.80, None, None, floor=0.25)
        assert ok is False and "MISMATCH" not in reason

    def test_sub_floor_coverage_is_rejected(self):
        # The re-derived coverage is below the floor → morph should NOT have been
        # in the composite → refuse to verify (not a MISMATCH accusation).
        ok, reason = morph_reproduces(0.80, 0.80, 0.10, floor=0.25)
        assert ok is False and "MISMATCH" not in reason and "floor" in reason

    def test_reported_none_is_fail(self):
        ok, _ = morph_reproduces(None, 0.5, 0.5, floor=0.25)
        assert ok is False


class TestSubsetRescoring:
    """2026-07-19 partial-anchoring fix: when entries are unmatched, the
    headline chrF++ covers a different entry set than the re-score and the
    two must NOT be compared (the dry-run flagged 20 honest runs MISMATCH
    exactly this way — reported scores dragged down by errored/unmatched
    entries the subset re-score excluded). The comparison goes
    subset-vs-subset instead, with an anchoring-fraction guard."""

    def _canonical_big(self, n=10):
        return [{"source": f"source sentence number {i} here",
                 "reference": f"reference sentence number {i} translated"}
                for i in range(n)]

    def test_errored_and_unmatched_entries_no_longer_flag_honest_runs(self):
        canonical = self._canonical_big(10)
        idx = build_reference_index(canonical)
        # 8 matched entries (2 of them errored -> empty predicted, still
        # matched + scored as empty), plus 2 entries whose sources are NOT
        # in the corpus (unmatched). The run's REPORTED headline includes
        # the unmatched garbage, dragging it far below the subset re-score.
        entries = _anchored(
            [(c["source"], c["reference"], c["reference"]) for c in canonical[:6]]
            + [(canonical[6]["source"], "", canonical[6]["reference"]),
               (canonical[7]["source"], "", canonical[7]["reference"])]
            + [("not in the corpus at all one", "junk", "junk ref"),
               ("not in the corpus at all two", "junk", "junk ref")]
        )
        v = verify_against_corpus(
            "sub1", reported_chrf=57.79, entries=entries, reference_index=idx)
        assert v.ok is True, v.reason
        assert v.details["comparison_basis"] == "matched-subset"
        assert v.details["n_unmatched"] == 2
        assert "unmatched" in v.reason

    def test_full_match_still_checks_the_headline_claim(self):
        canonical = self._canonical_big(4)
        idx = build_reference_index(canonical)
        entries = _anchored(
            [(c["source"], c["reference"], c["reference"]) for c in canonical])
        inflated = verify_against_corpus(
            "sub2", reported_chrf=42.0, entries=entries, reference_index=idx)
        assert inflated.ok is False
        assert "MISMATCH" in inflated.reason
        assert inflated.details["comparison_basis"] == "reported-headline"
        faithful = verify_against_corpus(
            "sub3", reported_chrf=100.0, entries=entries, reference_index=idx)
        assert faithful.ok is True

    def test_excessive_unmatched_fraction_cannot_verify(self):
        canonical = self._canonical_big(4)
        idx = build_reference_index(canonical)
        # 2 matched, 3 unmatched -> 60% unmatched > 20% cap.
        entries = _anchored(
            [(c["source"], c["reference"], c["reference"]) for c in canonical[:2]]
            + [(f"unknown source {i}", "junk", "junk ref") for i in range(3)]
        )
        v = verify_against_corpus(
            "sub4", reported_chrf=90.0, entries=entries, reference_index=idx)
        assert v.ok is False
        assert "insufficient anchoring" in v.reason
        assert v.details["unmatched_fraction"] > 0.5

    def test_tamper_gate_passing_subsets_reproduce_exactly(self):
        """INVARIANT the subset comparison rests on: a stored reference that
        passes the tamper gate (whitespace-normalized equality) scores
        IDENTICALLY to the canonical one under chrF++ (space:no char
        n-grams + whitespace-tokenized word n-grams), so an honest run's
        subset delta is exactly 0 — even at tolerance 0."""
        canonical = self._canonical_big(10)
        idx = build_reference_index(canonical)
        spaced = [dict(c, reference=c["reference"].replace(" ", "  ", 3))
                  for c in canonical]
        entries = _anchored(
            [(c["source"], c["reference"], s["reference"])
             for c, s in zip(canonical[:9], spaced[:9])]
            + [("unknown source x", "junk", "junk ref")]
        )
        v = verify_against_corpus(
            "sub5", reported_chrf=90.0, entries=entries, reference_index=idx,
            chrf_tolerance=0.0)
        assert v.ok is True, v.reason
        assert v.details["comparison_basis"] == "matched-subset"

    def test_subset_mismatch_branch_is_defensive(self):
        """The subset-MISMATCH branch is unreachable through honest inputs
        (see the invariant above) and exists to fail closed under future
        scorer/normalization drift. Exercised here by forcing an impossible
        tolerance so a provably-zero delta still exceeds it."""
        canonical = self._canonical_big(6)
        idx = build_reference_index(canonical)
        entries = _anchored(
            [(c["source"], c["reference"], c["reference"]) for c in canonical[:5]]
            + [("unknown source z", "junk", "junk ref")]
        )
        v = verify_against_corpus(
            "sub5b", reported_chrf=90.0, entries=entries, reference_index=idx,
            chrf_tolerance=-0.1)
        assert v.ok is False
        assert "anchored subset" in v.reason

    def test_unmatched_with_no_stored_refs_has_no_baseline(self):
        canonical = self._canonical_big(6)
        idx = build_reference_index(canonical)
        # Matched entries carry EMPTY stored refs (scores-only publish) plus
        # one unmatched entry: no subset baseline exists — never promoted.
        entries = _anchored(
            [(c["source"], c["reference"], "") for c in canonical[:5]]
            + [("unknown source y", "junk", "")]
        )
        v = verify_against_corpus(
            "sub6", reported_chrf=90.0, entries=entries, reference_index=idx)
        assert v.ok is False
        assert "no subset baseline" in v.reason
