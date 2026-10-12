"""
Test that scoring.py stays in sync with SCORING_SPEC.md.

This test suite validates the SSOT chain:
    SCORING_SPEC.md (human-readable spec)
        → scoring.py (code mirror)
        → this test (validates alignment)

If these tests fail, it means scoring.py has drifted from the spec.
Update scoring.py to match SCORING_SPEC.md, then re-run.
"""

import math

import pytest

from mt_eval_harness.scoring import (
    DEFAULT_PROFILE,
    INACTIVE_METRICS,
    NEURAL_METRICS,
    NORMALIZATIONS,
    PROFILE_REGISTRY,
    QUALITY_TIERS,
    WEIGHTS_NO_REFERENCE,
    WEIGHTS_WITH_FST,
    WEIGHTS_WITHOUT_FST,
    classify_quality_tier,
    compute_composite_score,
    cost_adjusted_score,
    morph_counts,
    normalize_metric,
    resolve_weights,
)


# ---------------------------------------------------------------------------
# §4.3 Weight table invariants
# ---------------------------------------------------------------------------

class TestWeightTables:
    """Validate weight tables match SCORING_SPEC §4.3."""

    def test_profile_a_weights_sum_to_one(self):
        """Profile A (with FST) weights must sum to exactly 1.0."""
        total = sum(WEIGHTS_WITH_FST.values())
        assert round(total, 10) == 1.0, (
            f"Profile A weights sum to {total}, expected 1.0. "
            f"Update scoring.py to match SCORING_SPEC §4.3."
        )

    def test_profile_b_weights_sum_to_one(self):
        """Profile B (without FST) weights must sum to exactly 1.0."""
        total = sum(WEIGHTS_WITHOUT_FST.values())
        assert round(total, 10) == 1.0, (
            f"Profile B weights sum to {total}, expected 1.0. "
            f"Update scoring.py to match SCORING_SPEC §4.3."
        )

    def test_profile_a_has_9_metrics(self):
        """SCORING_SPEC §4.3 Profile A defines exactly 9 metrics."""
        assert len(WEIGHTS_WITH_FST) == 9, (
            f"Profile A has {len(WEIGHTS_WITH_FST)} metrics, expected 9. "
            f"Check SCORING_SPEC §4.3."
        )

    def test_profile_b_has_8_metrics(self):
        """SCORING_SPEC §4.3 Profile B defines exactly 8 metrics."""
        assert len(WEIGHTS_WITHOUT_FST) == 8, (
            f"Profile B has {len(WEIGHTS_WITHOUT_FST)} metrics, expected 8. "
            f"Check SCORING_SPEC §4.3."
        )

    def test_profile_a_contains_fst_metrics(self):
        """Profile A must include FST-specific structural metrics."""
        assert "fst_acceptance_rate" in WEIGHTS_WITH_FST
        assert "morphological_accuracy" in WEIGHTS_WITH_FST

    def test_profile_b_excludes_fst_metrics(self):
        """Profile B must NOT include FST-specific metrics."""
        assert "fst_acceptance_rate" not in WEIGHTS_WITHOUT_FST
        assert "morphological_accuracy" not in WEIGHTS_WITHOUT_FST

    def test_all_weights_are_positive(self):
        """All weights must be positive (no zero-weight metrics in the table)."""
        for name, w in WEIGHTS_WITH_FST.items():
            assert w > 0, f"Profile A metric '{name}' has non-positive weight {w}"
        for name, w in WEIGHTS_WITHOUT_FST.items():
            assert w > 0, f"Profile B metric '{name}' has non-positive weight {w}"

    def test_profile_a_structural_metrics_carry_40_percent(self):
        """SCORING_SPEC §4.3: FST + morphological accuracy = 40% in Profile A."""
        structural = (
            WEIGHTS_WITH_FST.get("fst_acceptance_rate", 0)
            + WEIGHTS_WITH_FST.get("morphological_accuracy", 0)
        )
        assert round(structural, 10) == 0.40, (
            f"Structural metrics carry {structural}, expected 0.40. "
            f"Check SCORING_SPEC §4.3 Profile A."
        )

    def test_profile_a_specific_weights(self):
        """Validate each Profile A weight matches SCORING_SPEC §4.3."""
        expected = {
            "fst_acceptance_rate": 0.25,
            "morphological_accuracy": 0.15,
            "chrf_plus_plus": 0.15,
            "semantic_score": 0.15,
            "equivalent_match_rate": 0.10,
            "code_switching_rate": 0.05,
            "terminology_adherence": 0.05,
            "hallucination_rate": 0.05,
            "exact_match_rate": 0.05,
        }
        assert WEIGHTS_WITH_FST == expected, (
            f"Profile A weights differ from SCORING_SPEC §4.3.\n"
            f"  Expected: {expected}\n"
            f"  Got:      {dict(WEIGHTS_WITH_FST)}"
        )

    def test_profile_b_specific_weights(self):
        """Validate each Profile B weight matches SCORING_SPEC §4.3."""
        expected = {
            "semantic_score": 0.25,
            "chrf_plus_plus": 0.25,
            "equivalent_match_rate": 0.15,
            "exact_match_rate": 0.10,
            "code_switching_rate": 0.10,
            "terminology_adherence": 0.05,
            "hallucination_rate": 0.05,
            "orthographic_accuracy": 0.05,
        }
        assert WEIGHTS_WITHOUT_FST == expected, (
            f"Profile B weights differ from SCORING_SPEC §4.3.\n"
            f"  Expected: {expected}\n"
            f"  Got:      {dict(WEIGHTS_WITHOUT_FST)}"
        )


# ---------------------------------------------------------------------------
# §4.2 Normalization
# ---------------------------------------------------------------------------

class TestNormalization:
    """Validate normalization rules match SCORING_SPEC §4.2."""

    def test_chrf_divided_by_100(self):
        """chrF++ native 0–100 scale → 0.0–1.0."""
        assert normalize_metric("chrf_plus_plus", 100.0) == 1.0
        assert normalize_metric("chrf_plus_plus", 0.0) == 0.0
        assert normalize_metric("chrf_plus_plus", 72.5) == 0.725

    def test_code_switching_inverted(self):
        """Code-switching rate: 0% = perfect (1.0), 100% = worst (0.0)."""
        assert normalize_metric("code_switching_rate", 0.0) == 1.0
        assert normalize_metric("code_switching_rate", 1.0) == 0.0
        assert normalize_metric("code_switching_rate", 0.1) == 0.9

    def test_hallucination_inverted(self):
        """Hallucination rate: 0% = perfect (1.0), 100% = worst (0.0)."""
        assert normalize_metric("hallucination_rate", 0.0) == 1.0
        assert normalize_metric("hallucination_rate", 1.0) == 0.0

    def test_passthrough_metrics(self):
        """Metrics already on 0.0–1.0 scale pass through unchanged."""
        passthrough = [
            "exact_match_rate", "equivalent_match_rate",
            "fst_acceptance_rate", "morphological_accuracy",
            "semantic_score", "terminology_adherence",
            "orthographic_accuracy",
        ]
        for metric in passthrough:
            assert normalize_metric(metric, 0.75) == 0.75, (
                f"{metric} should pass through unchanged"
            )


class TestNormalizeFinitenessGuard:
    """L15: NaN/Inf must be rejected and out-of-range inputs clamped, so a
    non-finite or out-of-range plugin metric can never read as 'fluent'."""

    def test_nan_raises(self):
        with pytest.raises(ValueError):
            normalize_metric("semantic_score", math.nan)

    def test_positive_inf_raises(self):
        # The headline bug: an inf metric must NOT pass through (and then
        # clamp to 1.0 = perfect). It is refused loudly instead.
        with pytest.raises(ValueError):
            normalize_metric("semantic_score", math.inf)

    def test_negative_inf_raises(self):
        with pytest.raises(ValueError):
            normalize_metric("chrf_plus_plus", -math.inf)

    def test_out_of_range_high_is_clamped(self):
        # A chrF of 130 (130/100 = 1.3) must clamp to 1.0, not exceed it.
        assert normalize_metric("chrf_plus_plus", 130.0) == 1.0
        # A passthrough rate above 1.0 clamps to 1.0.
        assert normalize_metric("semantic_score", 1.5) == 1.0

    def test_out_of_range_low_is_clamped(self):
        # A negative passthrough rate clamps up to 0.0.
        assert normalize_metric("semantic_score", -0.5) == 0.0
        # An inverted metric with raw > 1.0 would go negative → clamp to 0.0.
        assert normalize_metric("hallucination_rate", 1.4) == 0.0

    def test_in_range_values_unaffected_by_clamp(self):
        # The clamp must be a no-op for legitimate in-range values.
        assert normalize_metric("chrf_plus_plus", 72.5) == 0.725
        assert normalize_metric("semantic_score", 0.5) == 0.5

    def test_composite_rejects_inf_metric(self):
        # End-to-end: an inf flowing into the composite path must raise, not
        # silently produce a perfect/fluent score.
        with pytest.raises(ValueError):
            compute_composite_score(
                {"chrf_plus_plus": math.inf}, has_fst=False
            )

    def test_composite_clamps_out_of_range_metric(self):
        # A single out-of-range chrF (130) clamps to 1.0, so a single-metric
        # composite is exactly 1.0 — never above.
        result = compute_composite_score(
            {"chrf_plus_plus": 130.0}, has_fst=False
        )
        assert result == 1.0


# ---------------------------------------------------------------------------
# §5.1 Quality tier thresholds
# ---------------------------------------------------------------------------

class TestQualityTiers:
    """Validate tier thresholds match SCORING_SPEC §5.1."""

    def test_tier_count(self):
        """SCORING_SPEC §5.1 defines exactly 5 tiers."""
        assert len(QUALITY_TIERS) == 5

    def test_tier_thresholds(self):
        """Validate exact threshold values from SCORING_SPEC §5.1."""
        expected = [
            (0.85, "fluent"),
            (0.70, "deployable"),
            (0.50, "functional"),
            (0.30, "emerging"),
            (0.00, "baseline"),
        ]
        assert QUALITY_TIERS == expected

    def test_classification_boundary_fluent(self):
        assert classify_quality_tier(0.85) == "fluent"
        assert classify_quality_tier(0.95) == "fluent"
        assert classify_quality_tier(1.0) == "fluent"

    def test_classification_boundary_deployable(self):
        assert classify_quality_tier(0.70) == "deployable"
        assert classify_quality_tier(0.84) == "deployable"

    def test_classification_boundary_functional(self):
        assert classify_quality_tier(0.50) == "functional"
        assert classify_quality_tier(0.69) == "functional"

    def test_classification_boundary_emerging(self):
        assert classify_quality_tier(0.30) == "emerging"
        assert classify_quality_tier(0.49) == "emerging"

    def test_classification_boundary_baseline(self):
        assert classify_quality_tier(0.0) == "baseline"
        assert classify_quality_tier(0.29) == "baseline"

    def test_classification_none(self):
        assert classify_quality_tier(None) == "unscored"


# ---------------------------------------------------------------------------
# §4.1 Composite score computation
# ---------------------------------------------------------------------------

class TestCompositeScore:
    """Validate composite score computation matches SCORING_SPEC §4.1."""

    def test_no_metrics_returns_none(self):
        """Empty input → None (no composite possible)."""
        assert compute_composite_score({}, has_fst=True) is None

    def test_all_none_returns_none(self):
        """All metrics None → None."""
        scores = {k: None for k in WEIGHTS_WITH_FST}
        assert compute_composite_score(scores, has_fst=True) is None

    def test_single_metric_equals_that_metric(self):
        """With one metric, composite = that metric's normalized value."""
        # chrF++ 80.0 → normalized 0.8. Only metric → composite = 0.8
        result = compute_composite_score(
            {"chrf_plus_plus": 80.0}, has_fst=True
        )
        assert result == 0.8

    def test_renormalization_with_partial_metrics(self):
        """Re-normalization: effective weights must sum to 1.0 over available."""
        # Profile A: FST=0.25, chrF=0.15, EM=0.05 → sum=0.45
        # Effective: FST=0.5556, chrF=0.3333, EM=0.1111
        scores = {
            "fst_acceptance_rate": 1.0,  # already normalized
            "chrf_plus_plus": 80.0,      # → 0.8 after normalization
            "exact_match_rate": 0.6,     # already normalized
        }
        result = compute_composite_score(scores, has_fst=True)
        # Expected: 0.5556*1.0 + 0.3333*0.8 + 0.1111*0.6 = 0.8889
        assert result == 0.8889

    def test_profile_b_selection(self):
        """has_fst=False selects Profile B weights."""
        scores = {
            "chrf_plus_plus": 80.0,      # → 0.8
            "exact_match_rate": 0.6,
        }
        result = compute_composite_score(scores, has_fst=False)
        # Profile B: chrF=0.25, EM=0.10 → sum=0.35
        # Effective: chrF=0.7143, EM=0.2857
        # Expected: 0.7143*0.8 + 0.2857*0.6 = 0.7429
        expected = round(
            (0.25 / 0.35) * 0.8 + (0.10 / 0.35) * 0.6,
            4
        )
        assert result == expected

    def test_perfect_scores_all_metrics(self):
        """All metrics at perfect → composite = 1.0."""
        scores = {
            "fst_acceptance_rate": 1.0,
            "morphological_accuracy": 1.0,
            "chrf_plus_plus": 100.0,       # normalized to 1.0
            "semantic_score": 1.0,
            "equivalent_match_rate": 1.0,
            "code_switching_rate": 0.0,     # inverted to 1.0
            "terminology_adherence": 1.0,
            "hallucination_rate": 0.0,      # inverted to 1.0
            "exact_match_rate": 1.0,
        }
        result = compute_composite_score(scores, has_fst=True)
        assert result == 1.0


# ---------------------------------------------------------------------------
# §6.3 Cost-adjusted score
# ---------------------------------------------------------------------------

class TestCostAdjustedScore:
    """Validate cost-adjusted formula matches SCORING_SPEC §6.3."""

    def test_zero_cost_returns_composite(self):
        """At zero cost, no penalty — returns composite as-is."""
        assert cost_adjusted_score(0.75, 0.0) == 0.75

    def test_none_composite_returns_none(self):
        assert cost_adjusted_score(None, 0.01) is None

    def test_none_cost_returns_none(self):
        assert cost_adjusted_score(0.75, None) is None

    def test_formula_at_known_value(self):
        """Verify: cost_adjusted = composite / log2(1 + cost × 1000)."""
        composite = 0.75
        cost = 0.01
        expected = composite / math.log2(1.0 + cost * 1000.0)
        assert cost_adjusted_score(composite, cost) == round(expected, 4)

    def test_low_cost_minimal_penalty(self):
        """At $0.001/entry, log2(1+1)=1.0, so cost_adjusted ≈ composite."""
        result = cost_adjusted_score(0.80, 0.001)
        assert result == 0.80


# ---------------------------------------------------------------------------
# §4.3 Named profile registry + card-driven resolution (P1)
# ---------------------------------------------------------------------------

class TestProfileRegistry:
    """Validate the named-profile registry that replaces the has_fst boolean."""

    def test_seed_profiles_present(self):
        # All deterministic profiles. comet-validated was REMOVED — neural is never
        # in a composite (by design).
        assert {"fst-coverage", "surface-only", "no-reference"} <= set(PROFILE_REGISTRY)

    def test_comet_validated_profile_is_gone(self):
        assert "comet-validated" not in PROFILE_REGISTRY

    def test_no_neural_metric_in_any_composite(self):
        # Core invariant of the deterministic-composite design: NO neural metric
        # (comet_score / qe_score) may carry weight in ANY profile.
        for profile_name, weights in PROFILE_REGISTRY.items():
            leaked = NEURAL_METRICS & set(weights)
            assert not leaked, (
                f"Profile {profile_name!r} contains neural metric(s) {leaked} — "
                f"neural metrics must be reported separately, never composited."
            )

    def test_default_profile_is_surface_only(self):
        assert DEFAULT_PROFILE == "surface-only"

    def test_legacy_tables_are_the_seed_profiles(self):
        # The legacy A/B dicts ARE the fst-coverage/surface-only profiles.
        assert PROFILE_REGISTRY["fst-coverage"] is WEIGHTS_WITH_FST
        assert PROFILE_REGISTRY["surface-only"] is WEIGHTS_WITHOUT_FST

    def test_resolve_weights_bool_back_compat(self):
        assert resolve_weights(True) is WEIGHTS_WITH_FST
        assert resolve_weights(False) is WEIGHTS_WITHOUT_FST

    def test_resolve_weights_named(self):
        assert resolve_weights("no-reference") is WEIGHTS_NO_REFERENCE

    def test_resolve_weights_unknown_raises(self):
        # No silent fallback: an unknown profile must raise, not quietly
        # default to surface-only (which would mis-score the run).
        with pytest.raises(ValueError):
            resolve_weights("nonexistent")

    def test_removed_comet_validated_raises(self):
        # The removed profile must not silently resolve to anything.
        with pytest.raises(ValueError):
            resolve_weights("comet-validated")


class TestInactiveMetrics:
    """Declared-but-not-yet-computed metrics must never enter the composite."""

    def test_inactive_set_contents(self):
        assert "orthographic_accuracy" in INACTIVE_METRICS
        # morphological_accuracy was inactive through P5; activated 2026-06-16
        # (migration 029 applied, verifier re-derives it).
        assert "morphological_accuracy" not in INACTIVE_METRICS

    def test_neural_metrics_are_separate_not_inactive(self):
        # comet_score / qe_score are NEURAL (reported separately), not "inactive
        # composite" metrics — they live in NEURAL_METRICS, not INACTIVE_METRICS.
        assert "comet_score" in NEURAL_METRICS
        assert "qe_score" in NEURAL_METRICS
        assert NEURAL_METRICS.isdisjoint(INACTIVE_METRICS)

    def test_inactive_metric_excluded_even_if_supplied(self):
        # Supplying orthographic_accuracy (still inactive) must NOT change the
        # composite — it is a declared (roadmap) weight that is not yet active.
        # surface-only is the profile that carries its 0.05 weight.
        base = {"chrf_plus_plus": 80.0, "exact_match_rate": 0.6}
        with_ortho = dict(base, orthographic_accuracy=1.0)
        assert (
            compute_composite_score(base, profile="surface-only")
            == compute_composite_score(with_ortho, profile="surface-only")
        )

    def test_neural_metric_supplied_never_moves_composite(self):
        # Passing a neural score into ANY deterministic profile must not change the
        # composite — neural metrics are in no weight table.
        base = {"chrf_plus_plus": 80.0, "fst_acceptance_rate": 1.0}
        for profile in ("fst-coverage", "surface-only", "no-reference"):
            with_comet = dict(base, comet_score=0.9)
            with_qe = dict(base, qe_score=0.9)
            assert (
                compute_composite_score(base, profile=profile)
                == compute_composite_score(with_comet, profile=profile)
                == compute_composite_score(with_qe, profile=profile)
            )


class TestMorphCounts:
    """morph_counts() — the single SSOT for 'does morphological_accuracy score?'
    Used by publish (run-card flag) and the verifier (enforce gate) so they agree.
    morphological_accuracy is ACTIVE (2026-06-16): coverage is what gates it now.
    """

    def test_active_morph_counts_above_floor(self):
        # Now active: a value with ample coverage counts (enters the composite).
        assert "morphological_accuracy" not in INACTIVE_METRICS
        assert morph_counts(0.9, 0.9, floor=0.25) is True

    def test_none_value_never_counts(self):
        assert morph_counts(None, 0.9, floor=0.25) is False

    def test_none_coverage_never_counts(self):
        assert morph_counts(0.9, None, floor=0.25) is False

    def test_coverage_floor_gates(self):
        # Coverage is the gate now that morph is active.
        assert morph_counts(0.8, 0.50, floor=0.25) is True   # above floor
        assert morph_counts(0.8, 0.10, floor=0.25) is False  # below floor
        assert morph_counts(0.8, 0.25, floor=0.25) is True   # exactly at floor

    def test_morph_enters_composite_above_floor(self):
        # Active: supplying morphological_accuracy now DOES move the fst-coverage
        # composite (it carries a real 0.15 weight). publish.py only supplies it
        # when coverage ≥ floor (morph_counts), so the gating lives there.
        base = {"chrf_plus_plus": 80.0, "fst_acceptance_rate": 1.0}
        with_morph = dict(base, morphological_accuracy=0.2)
        assert (
            compute_composite_score(base, profile="fst-coverage")
            != compute_composite_score(with_morph, profile="fst-coverage")
        )

    def test_inactive_metric_still_excluded(self):
        # Contrast: orthographic_accuracy is still inactive, so it never moves the
        # composite even when supplied (proves activation is per-metric, not global).
        base = {"chrf_plus_plus": 80.0, "exact_match_rate": 0.6}
        assert (
            compute_composite_score(base, profile="surface-only")
            == compute_composite_score(
                dict(base, orthographic_accuracy=0.1), profile="surface-only")
        )


class TestProfilePreservesLegacyBehavior:
    """The named-profile path must reproduce the old has_fst path exactly."""

    def test_fst_coverage_equals_has_fst_true(self):
        scores = {"fst_acceptance_rate": 1.0, "chrf_plus_plus": 80.0, "exact_match_rate": 0.6}
        assert (
            compute_composite_score(scores, profile="fst-coverage")
            == compute_composite_score(scores, has_fst=True)
        )

    def test_surface_only_equals_has_fst_false(self):
        scores = {"chrf_plus_plus": 80.0, "exact_match_rate": 0.6}
        assert (
            compute_composite_score(scores, profile="surface-only")
            == compute_composite_score(scores, has_fst=False)
        )

    def test_has_fst_wins_over_profile(self):
        # Legacy kwarg takes precedence over the profile arg (back-compat).
        scores = {"fst_acceptance_rate": 1.0, "chrf_plus_plus": 80.0}
        assert (
            compute_composite_score(scores, profile="surface-only", has_fst=True)
            == compute_composite_score(scores, has_fst=True)
        )


class TestScoringProfileResolution:
    """language_cards.resolve_scoring_profile default behavior (P1)."""

    def test_default_fst_ran_true(self):
        from mt_eval_harness.language_cards import resolve_scoring_profile
        assert resolve_scoring_profile("crk", fst_ran=True) == "fst-coverage"

    def test_default_fst_ran_false(self):
        from mt_eval_harness.language_cards import resolve_scoring_profile
        assert resolve_scoring_profile("fra", fst_ran=False) == "surface-only"

    def test_empty_code_defaults(self):
        from mt_eval_harness.language_cards import resolve_scoring_profile
        assert resolve_scoring_profile("", fst_ran=False) == "surface-only"
        assert resolve_scoring_profile("", fst_ran=True) == "fst-coverage"

    def test_resolved_profile_always_in_registry(self):
        from mt_eval_harness.language_cards import resolve_scoring_profile
        for code, fst in [("crk", True), ("fra", False), ("", False), ("zzz", True)]:
            assert resolve_scoring_profile(code, fst_ran=fst) in PROFILE_REGISTRY

    def test_valid_declared_basis_used(self, monkeypatch):
        import mt_eval_harness.language_cards as lc
        monkeypatch.setattr(
            lc, "get_card", lambda code: {"scoringProfile": {"basis": "no-reference"}}
        )
        assert lc.resolve_scoring_profile("xx", fst_ran=True) == "no-reference"

    def test_invalid_declared_basis_raises(self, monkeypatch):
        # No silent fallback: a card that declares a bogus profile must fail
        # loud, not get quietly scored under the default profile.
        import mt_eval_harness.language_cards as lc
        monkeypatch.setattr(
            lc, "get_card", lambda code: {"scoringProfile": {"basis": "bogus"}}
        )
        with pytest.raises(ValueError):
            lc.resolve_scoring_profile("xx", fst_ran=False)

    def test_absent_basis_uses_default_cascade(self, monkeypatch):
        # An ABSENT scoringProfile is the legitimate default path (not a
        # fallback-on-error), so it resolves without raising.
        import mt_eval_harness.language_cards as lc
        monkeypatch.setattr(lc, "get_card", lambda code: {"name": "X"})
        assert lc.resolve_scoring_profile("xx", fst_ran=True) == "fst-coverage"
        assert lc.resolve_scoring_profile("xx", fst_ran=False) == "surface-only"

    def test_xlmr_high_is_NOT_auto_selected_to_comet(self, monkeypatch):
        # DECISION (task #9): an XLM-R-high language is NOT auto-routed to
        # comet-validated — that would make COMET *required* for ~100+ langs.
        # Without an explicit basis it follows the normal cascade (surface-only).
        import mt_eval_harness.language_cards as lc
        monkeypatch.setattr(
            lc, "get_card",
            lambda code: {"metricModelSupport": {"xlmr": {"tier": "high"}}},
        )
        assert lc.is_xlmr_high_resource("deu") is True            # it IS xlmr-high
        assert lc.resolve_scoring_profile("deu", fst_ran=False) == "surface-only"

    def test_declaring_removed_comet_validated_basis_raises(self, monkeypatch):
        # comet-validated was REMOVED (neural never composites). A card that still
        # declares it must fail loud, not silently fall through to a default.
        import mt_eval_harness.language_cards as lc
        monkeypatch.setattr(
            lc, "get_card",
            lambda code: {"scoringProfile": {"basis": "comet-validated"}},
        )
        with pytest.raises(ValueError):
            lc.resolve_scoring_profile("deu", fst_ran=True)


# ---------------------------------------------------------------------------
# P4 — reference-free QE lane (no-reference profile + qe_score)
# ---------------------------------------------------------------------------

class TestNoReferenceDeterministic:
    """no-reference is a DETERMINISTIC profile: FST + behavioral signals only.
    The neural reference-free QE score (qe_score) is reported SEPARATELY, never in
    this composite (by design)."""

    def test_no_reference_profile_present_and_sums_to_one(self):
        assert "no-reference" in PROFILE_REGISTRY
        assert round(sum(WEIGHTS_NO_REFERENCE.values()), 10) == 1.0

    def test_no_reference_has_no_neural_metric(self):
        assert "qe_score" not in WEIGHTS_NO_REFERENCE
        assert NEURAL_METRICS.isdisjoint(set(WEIGHTS_NO_REFERENCE))

    def test_no_reference_is_deterministic_signals(self):
        # FST acceptance + behavioral — reference-free AND verifier-reproducible.
        assert "fst_acceptance_rate" in WEIGHTS_NO_REFERENCE
        assert "code_switching_rate" in WEIGHTS_NO_REFERENCE

    def test_no_reference_does_not_require_qe(self):
        # No neural requirement: a no-reference run scores from deterministic
        # signals alone (it no longer fails loud for a missing QE model).
        base = {"fst_acceptance_rate": 1.0, "code_switching_rate": 0.0}
        result = compute_composite_score(base, profile="no-reference")
        assert result is not None and 0.0 <= result <= 1.0

    def test_qe_score_supplied_does_not_move_no_reference(self):
        # qe_score is neural → ignored by the deterministic composite.
        base = {"fst_acceptance_rate": 1.0, "code_switching_rate": 0.0}
        assert (
            compute_composite_score(base, profile="no-reference")
            == compute_composite_score(dict(base, qe_score=0.9), profile="no-reference")
        )

    def test_has_references_false_routes_to_no_reference(self, monkeypatch):
        import mt_eval_harness.language_cards as lc
        monkeypatch.setattr(lc, "get_card", lambda code: None)
        assert lc.resolve_scoring_profile("xx", fst_ran=True, has_references=False) == "no-reference"
        # default has_references=True preserves the legacy cascade
        assert lc.resolve_scoring_profile("xx", fst_ran=True, has_references=True) == "fst-coverage"

    def test_get_qe_model_for_reads_card(self):
        # The QE model resolver still works — it feeds the SEPARATE neural lane now.
        from mt_eval_harness.language_cards import get_qe_model_for
        assert get_qe_model_for("yor") == "masakhane/africomet-qe-stl"
        assert get_qe_model_for("crk") is None
