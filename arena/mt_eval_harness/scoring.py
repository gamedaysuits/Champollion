"""
Scoring — Code mirror of the scoring specification (the SSOT for all scoring
logic; public copy: cli/website/docs/network/specifications/scoring.md).

THE SCORING STANDARD ("standard/1", founder 2026-10-04: "we want scoring to
be industry standard"). Runs are scored the way WMT, FLORES-200 and
AmericasNLP score them:

    - ONE headline and ranking metric: corpus-level chrF++ (sacreBLEU chrF,
      word_order=2), 0–100, with its sacreBLEU signature and a 95% paired
      bootstrap confidence interval (Koehn 2004).
    - The other standard metrics are shown BESIDE it, never blended into it:
      BLEU, spBLEU, TER, and COMET when it was computed (each with its
      signature or model id).
    - "Better" is decided by paired significance tests (paired bootstrap /
      approximate randomization) on chrF++, never by comparing two numbers.
    - Diagnostics (exact match, FST acceptance, morphological accuracy,
      code-switching, hallucination, terminology, writing style) and every
      score caveat are reported SEPARATELY, labelled as diagnostics, and never
      enter a headline number.
    - No quality labels on automatic scores: only human evaluation certifies
      quality.

RETIRED (kept only so historical cards stay verifiable — "legacy-composite"):
    - the weighted composite (§4 weight tables, normalization, profiles), and
    - the quality-tier labels (§5).
A run card with no ``scores.scoring_standard`` was scored under the legacy
composite; the verifier re-derives its stored composite with the functions
below. A ``standard/1`` card publishes ``composite = None`` and
``quality_tier = None`` and is verified by re-deriving chrF++.

Design contract:
    - The spec is the SSOT. This module mirrors it in code.
    - No other module defines weights, tiers, composite logic, or the
      standard's metric roles. publish.py, tester.py, compare.py, the
      verifier, the contest code and nmt-forge import from here.
"""

from __future__ import annotations

import math


# ---------------------------------------------------------------------------
# The scoring standard ("standard/1") — what every NEW run is scored by
# ---------------------------------------------------------------------------

#: Stamped on a new run card's ``scores.scoring_standard``. A card without it
#: was scored under the retired composite (LEGACY_SCORING).
SCORING_STANDARD = "standard/1"

#: What a card with no ``scores.scoring_standard`` was scored under.
LEGACY_SCORING = "legacy-composite"

#: The headline and ranking metric: corpus chrF++ (run card
#: ``scores.chrf_plus_plus``; DB column ``chrf_plus_plus``; CI columns
#: ``chrf_ci_lower`` / ``chrf_ci_upper``; TestReport ``overall.corpus_chrf``).
PRIMARY_METRIC = "chrf_plus_plus"
PRIMARY_METRIC_LABEL = "chrF++"
#: Key of the primary metric's CI in ``confidence_intervals`` and its
#: sacreBLEU signature in ``sacrebleu_signatures``.
PRIMARY_CI_KEY = "corpus_chrf"

#: Secondary STANDARD metrics, shown beside chrF++ and never blended:
#: run-card key -> display label. ``corpus_bleu`` rides at the run card's top
#: level (and the DB column of that name); the rest are in ``scores``.
SECONDARY_METRICS: dict[str, str] = {
    "corpus_bleu": "BLEU",
    "spbleu": "spBLEU",
    "ter": "TER",
    "comet_score": "COMET",
}

#: Diagnostics: reported separately, labelled as diagnostics, never in a
#: headline and never ranked: run-card ``scores`` key -> display label.
DIAGNOSTIC_METRICS: dict[str, str] = {
    "exact_match_rate": "exact match",
    "equivalent_match_rate": "equivalent match",
    "fst_acceptance_rate": "FST acceptance",
    "morphological_accuracy": "morphological accuracy",
    "semantic_score": "semantic validator",
    "code_switching_rate": "code-switching",
    "hallucination_rate": "hallucination",
    "terminology_adherence": "terminology adherence",
    "style_consistency_rate": "writing style",
}

#: How any surface that still shows an OLD card's stored composite names it.
LEGACY_COMPOSITE_LABEL = "legacy composite (retired)"

#: Said wherever a retired composite or tier would have been shown.
RETIRED_NOTE = (
    "The weighted composite and the quality-tier labels are retired "
    "(scoring standard/1): runs are ranked by corpus chrF++ with its 95% "
    "bootstrap CI and sacreBLEU signature, the other standard metrics "
    "(BLEU, spBLEU, TER, COMET) are shown beside it, and diagnostics are "
    "reported separately. Only human evaluation certifies quality."
)


def scoring_standard_of(scores: dict | None) -> str:
    """The standard a run card's ``scores`` were produced under:
    ``"standard/1"`` (or a later standard) when the card says so, else
    :data:`LEGACY_SCORING` — every card published before the standard
    carried a composite and no ``scoring_standard`` key."""
    std = (scores or {}).get("scoring_standard")
    return std if isinstance(std, str) and std else LEGACY_SCORING


def is_legacy_scored(scores: dict | None) -> bool:
    """True for a card scored under the retired composite."""
    return scoring_standard_of(scores) == LEGACY_SCORING


def standard_score_fields() -> dict:
    """The keys every NEW run card's ``scores`` carries under the standard.

    ``composite`` / ``quality_tier`` / ``cost_adjusted`` are present and
    ``None`` (the DB columns stay nullable; migration 023 range-checks the
    composite only when non-null) so no consumer can read a stale default."""
    return {
        "scoring_standard": SCORING_STANDARD,
        "primary_metric": PRIMARY_METRIC,
        "composite": None,
        "quality_tier": None,
        "cost_adjusted": None,
    }


def _fmt_num(value: float | None, digits: int) -> str:
    return "—" if value is None else f"{value:.{digits}f}"


def format_primary(score: float | None,
                   ci_lower: float | None = None,
                   ci_upper: float | None = None,
                   *, digits: int = 1) -> str:
    """The headline as every surface writes it: ``"chrF++ 47.5 [45.9, 49.0]"``
    (the bracket is the 95% bootstrap CI; omitted when no CI was computed).
    ``"chrF++ —"`` when the run produced no chrF++."""
    if score is None:
        return f"{PRIMARY_METRIC_LABEL} —"
    text = f"{PRIMARY_METRIC_LABEL} {score:.{digits}f}"
    if ci_lower is not None and ci_upper is not None:
        text += f" [{ci_lower:.{digits}f}, {ci_upper:.{digits}f}]"
    return text


def primary_signature(signatures: dict | None) -> str | None:
    """The chrF++ sacreBLEU signature out of a ``sacrebleu_signatures``
    block (the tester keys it ``"chrf"``: the chrF++ metric, word_order=2;
    ``"chrf_plain"`` is plain chrF), or None."""
    if not isinstance(signatures, dict):
        return None
    for key in ("chrf", PRIMARY_CI_KEY, "chrf++", "chrf_plus_plus"):
        sig = signatures.get(key)
        if sig:
            return str(sig)
    return None


def format_secondary(values: dict, *, digits: int = 1) -> str:
    """``"BLEU 21.3 · spBLEU 24.0 · TER 61.2 · COMET 0.712"`` from a mapping
    of :data:`SECONDARY_METRICS` keys to values; metrics with no value are
    left out (an empty string when none was computed). COMET is on its
    native 0–1 scale, so it gets three decimals."""
    parts = []
    for key, label in SECONDARY_METRICS.items():
        val = values.get(key)
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            d = 3 if key == "comet_score" else digits
            parts.append(f"{label} {val:.{d}f}")
    return " · ".join(parts)


def headline_from_card(card: dict) -> dict:
    """The standard headline of a run card (or a run_cards row's
    ``run_card`` JSON), in one dict every surface can render:

    ``{"metric": "chrf_plus_plus", "score", "ci_lower", "ci_upper",
    "signature", "text", "secondary": {key: value}, "secondary_text",
    "scoring_standard", "legacy_composite"}``

    ``legacy_composite`` is the stored composite of a LEGACY card (to be
    shown, if at all, as :data:`LEGACY_COMPOSITE_LABEL`), and None for a
    standard card."""
    scores = card.get("scores") or {}
    cis = scores.get("confidence_intervals") or {}
    ci = cis.get(PRIMARY_CI_KEY) or {}
    score = scores.get(PRIMARY_METRIC)
    lo, hi = ci.get("ci_lower"), ci.get("ci_upper")
    secondary = {
        "corpus_bleu": card.get("corpus_bleu", scores.get("corpus_bleu")),
        "spbleu": scores.get("spbleu"),
        "ter": scores.get("ter"),
        "comet_score": scores.get("comet_score"),
    }
    std = scoring_standard_of(scores)
    return {
        "metric": PRIMARY_METRIC,
        "score": score,
        "ci_lower": lo,
        "ci_upper": hi,
        "signature": primary_signature(scores.get("sacrebleu_signatures")),
        "text": format_primary(score, lo, hi),
        "secondary": secondary,
        "secondary_text": format_secondary(secondary),
        "scoring_standard": std,
        "legacy_composite": (scores.get("composite")
                             if std == LEGACY_SCORING else None),
    }


# ===========================================================================
# RETIRED — the legacy composite and quality tiers ("legacy-composite").
# Everything below this line exists ONLY to re-derive and label the stored
# composite of a card published before the scoring standard. No new run is
# scored, ranked, labelled or compared with it.
# ===========================================================================


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
# §5.1 Quality Tier Thresholds — RETIRED (legacy cards only)
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
    """LEGACY: the retired weighted composite (spec §4, "legacy-composite").

    Used ONLY to re-derive the stored composite of a card published before
    the scoring standard (verifier.legacy_composite_check) and by the legacy
    contest lane for contests that already rank on it. No new run is scored
    with it: an untrained model repeating one valid Northern Sami sentence
    for every eng→sme input scored 0.6244 here ("functional") with chrF++
    5.5, because FST acceptance credits a valid sentence wherever it appears.

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
                f"neural dependency, e.g. `mt-eval setup --comet`, or the "
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
    """LEGACY: map a retired composite to its retired quality tier (§5.1).

    No new output carries a tier (scoring standard/1: no quality labels on
    automatic scores). Kept so a legacy card's stored tier can be checked.

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


def quality_tier_label(tier: str | None) -> str:
    """LEGACY (tiers retired; no new output prints one). How a printed line
    named a composite's quality tier:
    ``"quality tier: baseline"``. The tier words are the scoring spec's
    (§5.1, unchanged), but a bare "baseline" beside a coached run's composite
    read like the run's CONDITION — the run card spec says "condition:
    baseline" too (synthetic researcher, Round 11). Every terminal line that
    prints a tier goes through this, so the word never stands alone."""
    return f"quality tier: {tier or 'unscored'}"


# ---------------------------------------------------------------------------
# §6.3 Cost-adjusted score
# ---------------------------------------------------------------------------

def cost_adjusted_score(
    composite: float | None,
    cost_per_entry_usd: float | None,
) -> float | None:
    """LEGACY: cost-adjusted score per spec §6.3 — the retired composite
    divided by a cost factor. A new card carries ``cost_adjusted = None``
    (scoring.standard_score_fields); cost is reported beside the headline.

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
