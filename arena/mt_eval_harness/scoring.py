"""
Scoring — Code mirror of SCORING_SPEC.md (the SSOT for all scoring logic).

This module is the single code authority for:
    - Composite weight tables (SCORING_SPEC §4.3)
    - Input normalization rules (SCORING_SPEC §4.2)
    - Quality tier thresholds (SCORING_SPEC §5.1)
    - Cost-adjusted score formula (SCORING_SPEC §6.3)

Design contract:
    - SCORING_SPEC.md is the SSOT. This module mirrors it in code.
    - When SCORING_SPEC.md changes, update this file to match.
    - test_scoring_ssot.py validates alignment between this file and the spec.
    - No other module should define weights, tiers, or composite logic.
      publish.py, tester.py, and any future consumers import from here.

Why a separate module (not inline in publish.py):
    - Single code location for scoring constants → no duplication drift.
    - Testable in isolation (weight sums, tier boundary checks).
    - SCORING_SPEC §10.2 explicitly defines this file as the code mirror.
"""

from __future__ import annotations

import math


# ---------------------------------------------------------------------------
# §4.3 Profile A — Languages WITH FST Coverage
# ---------------------------------------------------------------------------
# Structural metrics carry 40% (FST 0.25 + morphological 0.15), reflecting
# the primacy of morphological correctness for polysynthetic/agglutinative
# languages.
#
# Source: SCORING_SPEC.md §4.3 "Profile A: Languages WITH FST Coverage"

WEIGHTS_WITH_FST: dict[str, float] = {
    "fst_acceptance_rate":      0.25,
    "morphological_accuracy":   0.15,
    "chrf_plus_plus":           0.15,
    "semantic_score":           0.15,
    "equivalent_match_rate":    0.10,
    "code_switching_rate":      0.05,
    "terminology_adherence":    0.05,
    "hallucination_rate":       0.05,
    "exact_match_rate":         0.05,
}

# ---------------------------------------------------------------------------
# §4.3 Profile B — Languages WITHOUT FST Coverage
# ---------------------------------------------------------------------------
# Without structural validation, semantic and surface metrics carry equal
# weight. orthographic_accuracy fills part of the gap left by absent FST.
#
# Source: SCORING_SPEC.md §4.3 "Profile B: Languages WITHOUT FST Coverage"

WEIGHTS_WITHOUT_FST: dict[str, float] = {
    "semantic_score":           0.25,
    "chrf_plus_plus":           0.25,
    "equivalent_match_rate":    0.15,
    "exact_match_rate":         0.10,
    "code_switching_rate":      0.10,
    "terminology_adherence":    0.05,
    "hallucination_rate":       0.05,
    "orthographic_accuracy":    0.05,
}


# ---------------------------------------------------------------------------
# §4.3 Named profile registry (card-driven composite)
# ---------------------------------------------------------------------------
# The composite is no longer chosen by a single has_fst boolean. Each language
# card resolves to a NAMED profile (see language_cards.resolve_scoring_profile);
# the profile names a weight table here. SCORING_SPEC.md §4.3 is the SSOT for
# these tables; test_scoring_ssot.py validates alignment.
#
# Profiles seeded (ALL deterministic — every metric is reproducible by the
# verifier from the corpus alone; NO neural metric appears in any composite):
#   fst-coverage    — languages WITH a finite-state analyzer (legacy Profile A)
#   surface-only    — default: no FST (legacy Profile B)
#   no-reference    — runs with NO gold reference (e.g. floor languages with only
#                     contaminated FLORES): reference-based metrics can't be
#                     computed, so scoring uses the reference-FREE DETERMINISTIC
#                     signals — FST acceptance + behavioral checks. The neural
#                     reference-free QE score is reported SEPARATELY (NEURAL_METRICS).
#
# Neural metrics (COMET/AfriCOMET, AfriCOMET-QE) are EXCLUDED from every composite —
# computed, stored, and displayed on their own ("deterministic composite, neural
# separate"; design decision). A neural composite may come later.

# Reference-FREE DETERMINISTIC profile: every metric here is computable WITHOUT a
# gold reference AND reproducible by the verifier. fst_acceptance (morphological
# validity) needs no reference; behavioral checks flag failure modes. The neural
# reference-free QE score (AfriCOMET-QE) is reported SEPARATELY (see
# NEURAL_METRICS), never folded into this composite.
WEIGHTS_NO_REFERENCE: dict[str, float] = {
    "fst_acceptance_rate":      0.40,
    "code_switching_rate":      0.25,
    "hallucination_rate":       0.20,
    "terminology_adherence":    0.15,
}

PROFILE_REGISTRY: dict[str, dict[str, float]] = {
    "fst-coverage":     WEIGHTS_WITH_FST,
    "surface-only":     WEIGHTS_WITHOUT_FST,
    "no-reference":     WEIGHTS_NO_REFERENCE,
}

DEFAULT_PROFILE = "surface-only"


# ---------------------------------------------------------------------------
# Inactive (reserved / planned) metrics
# ---------------------------------------------------------------------------
# A metric name may carry a DECLARED (roadmap) weight in a profile table above,
# yet not be computed yet. Listing it here keeps the *effective* composite
# honest — it is excluded from scoring — while the declared intent stays visible
# in the tables and in SCORING_SPEC §4.3. Excluding an always-None metric does
# not change any score (it never entered the renormalized average); the point is
# that "planned, not yet scoring" is now explicit rather than silent.
#
# A metric leaves this set only when (a) it is actually computed per-entry AND
# (b) the verifier can re-score it (the trust gate).
#
#   orthographic_accuracy  — needs per-language orthographic rule sets (not built)
#
# (morphological_accuracy was here through P5; it is now ACTIVE under the
#  fst-coverage profile — it is computed (plugins.giellalt_fst, lemma-matched),
#  re-derived by the verifier (verifier.recompute_corpus_morph re-runs the
#  card-pinned FST), and its DB columns landed in migration 029, applied to dev
#  AND prod 2026-06-16. It only enters the composite when morph_coverage ≥
#  MORPH_COVERAGE_FLOOR (see scoring.morph_counts + publish composite_inputs);
#  below the floor it stays advisory. NOTE the verifier env now needs pyhfst + the
#  card FST to re-derive it — same fail-closed contract as COMET needing
#  unbabel-comet. comet_score / qe_score are NOT inactive-composite metrics — they
#  are NEURAL, excluded from every composite and reported separately; see
#  NEURAL_METRICS below.)
INACTIVE_METRICS: frozenset[str] = frozenset({
    "orthographic_accuracy",
})


# ---------------------------------------------------------------------------
# Neural metrics — computed and reported SEPARATELY, never in the composite
# ---------------------------------------------------------------------------
# The composite is DETERMINISTIC: every metric in it is reproducible by the
# verifier from the corpus alone. Neural metrics (COMET/AfriCOMET adequacy and
# AfriCOMET-QE reference-free QE) are model-dependent, so they are kept out of
# every composite weight table and surfaced on their own (project decision
# 2026-06-17: "deterministic composite; neural separate, maybe composited later").
# compute_composite_score ignores any neural key passed in scores (it is not in any
# weight table); naming them here lets publish.py / the verifier / tests route them
# to the separate neural lane, and lets a conformance test assert no neural metric
# ever leaks into a profile weight table.
#
# metricx_score is MetricX-24 (Google, Apache-2.0) — the WMT24 Metrics shared-task
# winner and the metric WMT24++/TranslateGemma report against. It is LOWER-IS-BETTER
# (an error score, 0–25), unlike the others; that direction lives on the metric's
# result/scores payload, not here. Membership in this set only enforces the same
# invariant: it is reported separately, never composited.
NEURAL_METRICS: frozenset[str] = frozenset({
    "comet_score",
    "qe_score",
    "metricx_score",
})


# ---------------------------------------------------------------------------
# Required metrics per profile
# ---------------------------------------------------------------------------
# A profile MAY require certain metrics (compute_composite_score fails loud if a
# required metric is missing rather than silently scoring around it). Currently
# EMPTY — a deliberate, test-pinned decision (test_scoring_ssot.py
# TestNoReferenceDeterministic.test_no_reference_does_not_require_qe): the
# no-reference profile scores from deterministic signals alone and NO LONGER
# fails loud for a missing QE model. Consequence to keep in view: without
# qe_score the no-reference composite carries NO adequacy signal — FST validity
# + behavioral checks are necessary-not-sufficient, so fluent in-language
# garbage can score a perfect deterministic composite there. qe_score, when a
# card declares a QE model, is the separate neural adequacy lane for such runs
# (never weighted here). See METRIC_PROPERNESS_REVIEW_2026-07-18 finding F2.
REQUIRED_METRICS: dict[str, frozenset[str]] = {}


# ---------------------------------------------------------------------------
# §4.2 Input Normalization
# ---------------------------------------------------------------------------
# Before entering the composite formula, all metrics must be on a 0.0–1.0
# scale where 1.0 = perfect. Most metrics are already normalized; these are
# the exceptions that need transformation.
#
# Source: SCORING_SPEC.md §4.2 "Input Normalization"

def normalize_metric(metric_name: str, raw_value: float) -> float:
    """Normalize a metric value to 0.0–1.0 scale for composite calculation.

    Applies the normalization rules from SCORING_SPEC §4.2:
        - chrf_plus_plus: divide by 100 (sacrebleu native scale is 0–100)
        - code_switching_rate: invert (0% code-switching = 1.0)
        - hallucination_rate: invert (0% hallucination = 1.0)
        - All others: already 0.0–1.0, pass through unchanged.

    Args:
        metric_name: The metric identifier (must match weight table keys).
        raw_value: The raw metric value.

    Returns:
        Normalized value on 0.0–1.0 scale where 1.0 = perfect.

    Raises:
        ValueError: if ``raw_value`` is NaN or infinite. A non-finite metric
            (e.g. an inf from a buggy plugin) must NEVER flow into the composite
            — left unguarded it reads as "perfect/fluent" after clamping, which
            silently fabricates a top score. We refuse loudly instead.
    """
    if not math.isfinite(raw_value):
        raise ValueError(
            f"normalize_metric({metric_name!r}): non-finite metric value "
            f"{raw_value!r}. A NaN/Inf plugin output cannot be scored — refusing "
            f"to let it enter the composite (it would read as a perfect score)."
        )

    if metric_name == "chrf_plus_plus":
        normalized = raw_value / 100.0
    elif metric_name in ("code_switching_rate", "hallucination_rate"):
        # Inverted: 0% bad behavior = 1.0 (perfect)
        normalized = 1.0 - raw_value
    else:
        # exact_match_rate, equivalent_match_rate, fst_acceptance_rate,
        # morphological_accuracy, semantic_score, terminology_adherence,
        # orthographic_accuracy — all already 0.0–1.0
        normalized = raw_value

    # Clamp into the valid [0.0, 1.0] range. An out-of-range plugin input
    # (e.g. a chrF of 130, or a negative rate) must not push the composite
    # above 1.0 or below 0.0.
    return max(0.0, min(1.0, normalized))


# Metrics that need normalization, for documentation and testing purposes.
# Maps metric_name → description of normalization applied.
NORMALIZATIONS: dict[str, str] = {
    "chrf_plus_plus":       "Divide by 100 (sacrebleu native scale)",
    "code_switching_rate":  "Invert: 1.0 - value (lower is better)",
    "hallucination_rate":   "Invert: 1.0 - value (lower is better)",
}


# ---------------------------------------------------------------------------
# §5.1 Quality Tier Thresholds
# ---------------------------------------------------------------------------
# Evaluated top-down, first match wins.
# These are heuristic labels on automated scores — not validated quality
# judgments. Only human review can confirm actual usability.
#
# Source: SCORING_SPEC.md §5.1 "Tier Thresholds (Machine-Readable)"

QUALITY_TIERS: list[tuple[float, str]] = [
    (0.85, "fluent"),
    (0.70, "deployable"),
    (0.50, "functional"),
    (0.30, "emerging"),
    (0.00, "baseline"),
]


# ---------------------------------------------------------------------------
# Composite score — SCORING_SPEC §4.1
# ---------------------------------------------------------------------------

def resolve_weights(profile: str | bool) -> dict[str, float]:
    """Resolve a profile name (or legacy has_fst bool) to its weight table.

    Args:
        profile: A named profile from PROFILE_REGISTRY (e.g. "fst-coverage"),
            or a legacy bool (True → fst-coverage, False → surface-only).

    Returns:
        The weight table dict for the profile.

    Raises:
        ValueError: on an unknown profile name. We do NOT fall back to a default
            weighting — that would silently mis-score the run. resolve_scoring_profile()
            only ever returns registry-valid names, so this fires only on a bad
            direct call / programmer error, which should be loud.
    """
    if isinstance(profile, bool):
        return WEIGHTS_WITH_FST if profile else WEIGHTS_WITHOUT_FST
    try:
        return PROFILE_REGISTRY[profile]
    except KeyError:
        raise ValueError(
            f"Unknown scoring profile {profile!r}. Known profiles: "
            f"{sorted(PROFILE_REGISTRY)}. Refusing to fall back to a default "
            f"weighting (that would silently mis-score the run)."
        ) from None


def compute_composite_score(
    scores: dict[str, float | None],
    profile: str | bool = DEFAULT_PROFILE,
    *,
    has_fst: bool | None = None,
) -> float | None:
    """Compute the weighted composite score per SCORING_SPEC §4.

    ⚠ EXPERIMENTAL — NOT VALIDATED. The composite is a weighted aggregate of
    metrics that mean different things for different languages, with weights that
    are engineering judgment, not empirically fitted to human quality judgments.
    It is a convenience sort key, NOT a validated quality measurement, and is
    labeled as such on the leaderboard and in SCORING_SPEC §4. The per-metric
    profile (each metric with its value + validation tier) is the real signal;
    the composite must never be read as ground truth. (By design.)

    The composite is a weighted average of all *available, active* metrics,
    re-normalized so their weights sum to 1.0. Metrics are normalized to a
    0.0–1.0 scale before weighting. Metrics in INACTIVE_METRICS (declared but not
    yet active — currently only orthographic_accuracy) are excluded even if a
    value is supplied, so the effective composite matches what actually scored.

    Args:
        scores: Dict mapping metric names to values. Keys should match the
            weight table names. Values can be None (metric unavailable) or
            numeric. chrF++ should be in its NATIVE scale (0–100) —
            normalization is applied here.
        profile: Named scoring profile (PROFILE_REGISTRY key) resolved from the
            language card via language_cards.resolve_scoring_profile(). Defaults
            to the surface-only profile.
        has_fst: Legacy selector kept for back-compat. When not None it WINS
            over `profile` (True → fst-coverage weights, False → surface-only).

    Returns:
        Composite score 0.0–1.0, or None if no metrics are available.
    """
    # Resolve the effective profile name + its weight table. Legacy has_fst wins.
    selector = has_fst if has_fst is not None else profile
    weights = resolve_weights(selector)
    if isinstance(selector, bool):
        profile_name = "fst-coverage" if selector else "surface-only"
    else:
        profile_name = selector

    # Fail loud if a metric the profile REQUIRES produced no value — never
    # silently score around it. (REQUIRED_METRICS is currently empty — see the
    # test-pinned decision documented at its definition above.)
    for req in REQUIRED_METRICS.get(profile_name, frozenset()):
        val = scores.get(req)
        if req in INACTIVE_METRICS or val is None or not isinstance(val, (int, float)):
            raise ValueError(
                f"Scoring profile {profile_name!r} REQUIRES metric {req!r}, but it "
                f"is missing/None for this run — it was not computed (a missing "
                f"neural dependency, e.g. `pip install unbabel-comet`, or the "
                f"language card declares no metricModelSupport.qe model). Refusing "
                f"to silently score without a required metric."
            )

    # Collect (metric_name, normalized_value, weight) for available metrics.
    # A metric is "available" if its value is numeric (not None) AND it is not
    # an inactive/planned metric (see INACTIVE_METRICS).
    available: list[tuple[str, float, float]] = []
    for metric_name, weight in weights.items():
        if metric_name in INACTIVE_METRICS:
            continue
        raw_value = scores.get(metric_name)
        if raw_value is not None and isinstance(raw_value, (int, float)):
            normalized = normalize_metric(metric_name, raw_value)
            available.append((metric_name, normalized, weight))

    if not available:
        return None

    # Re-normalize weights to sum to 1.0 over available metrics
    total_weight = sum(w for _, _, w in available)
    if total_weight == 0:
        return None

    composite = sum(
        (w / total_weight) * v for _, v, w in available
    )
    return round(composite, 4)


def morph_counts(
    morph_accuracy: float | None,
    morph_coverage: float | None,
    *,
    floor: float,
) -> bool:
    """Whether FST morphological_accuracy actually enters the composite.

    True ONLY when the metric is ACTIVE (not in INACTIVE_METRICS), has a value,
    and its coverage is at/above ``floor``. This is the single SSOT for the
    "does morph count?" question, used by BOTH publish.py (the run-card
    ``morph_in_composite`` flag) and verifier.py (the enforce-only-when-scored
    gate) so the two can never drift.

    morphological_accuracy is ACTIVE: it carries weight 0.15 under the
    fst-coverage profile, its DB columns landed in migration 029 (applied to
    dev AND prod 2026-06-16), and the verifier re-derives it from the
    card-pinned FST. So this returns True whenever the metric has a value and
    morph_coverage >= floor; below the floor it stays advisory (returns False),
    and it falls back to advisory automatically should morphological_accuracy
    ever be moved back into INACTIVE_METRICS — the leading guard is what makes
    that switch safe, not a description of the current state.
    """
    return (
        "morphological_accuracy" not in INACTIVE_METRICS
        and morph_accuracy is not None
        and morph_coverage is not None
        and morph_coverage >= floor
    )


def classify_quality_tier(composite: float | None) -> str:
    """Map a composite score to a quality tier per SCORING_SPEC §5.1.

    Evaluated top-down: first threshold the composite meets or exceeds
    determines the tier. Returns "unscored" if composite is None.

    These are heuristic labels on automated scores — not validated
    quality judgments. Only human review can confirm actual usability.
    No method can claim Deployable or above without community review.
    """
    if composite is None:
        return "unscored"

    for threshold, tier_name in QUALITY_TIERS:
        if composite >= threshold:
            return tier_name

    # Should not reach here if QUALITY_TIERS includes 0.00,
    # but defensive fallback.
    return "baseline"


# ---------------------------------------------------------------------------
# §6.3 Cost-adjusted score
# ---------------------------------------------------------------------------

def cost_adjusted_score(
    composite: float | None,
    cost_per_entry_usd: float | None,
) -> float | None:
    """Compute cost-adjusted score per SCORING_SPEC §6.3.

    Formula:
        cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)

    This rewards methods that achieve good scores efficiently.
    Uses cost_per_entry (not per-token) because the cost-adjusted score
    is always computed within a single benchmark (same corpus).

    At very low cost ($0.001/entry), log2(1 + 1) = 1.0, so
    cost_adjusted ≈ composite. The penalty only kicks in meaningfully
    above ~$0.001/entry.

    Returns None if composite or cost is unavailable, or if cost is zero
    (the formula is undefined when cost produces log2(1) = 0).
    """
    if composite is None or cost_per_entry_usd is None:
        return None
    if cost_per_entry_usd <= 0:
        # At zero cost, no penalty — return composite directly.
        # This avoids log2(1) = 0 division issues.
        return round(composite, 4)

    # Floor the denominator at 1.0 so cost is only ever a PENALTY, never a
    # reward. Below ~$0.001/entry log2(1+cost*1000) < 1, which would otherwise
    # multiply the score (e.g. $1e-5/entry → ~37× composite) and let a cheap
    # model post an absurd headline above its own deterministic score.
    denominator = max(1.0, math.log2(1.0 + cost_per_entry_usd * 1000.0))

    return round(composite / denominator, 4)
