"""Contamination-lane policy — the single source of truth.

Every evaluation dataset carries a ``contamination`` grade on its corpora card
and registry entry (``LOW`` / ``MEDIUM`` / ``HIGH``; ``NONE`` is treated as
absent). The grade answers one question: *can a score on this corpus be read as
an absolute measure of translation quality, or only as a relative comparison
between methods run on the same corpus?*

A HIGH-contamination corpus (e.g. FLORES+, which is in essentially every
frontier model's training data) must NEVER be ranked as absolute quality. Its
scores are valid only for RELATIVE comparison — "method A beat method B on this
exact corpus", not "method A is this good in the world". MEDIUM is treated the
same way (possibly memorized → relative-only). ONLY a positively-LOW corpus is
rankable on absolute quality, and the gate FAILS SAFE: an absent, ``NONE``, or
unrecognized grade is relative-only, never absolute — a missing grade can never
let a benchmark score masquerade as real translation quality.

This module is the one place that decides what "relative-only" means, so the
runner, the run card, ``publish``, the leaderboard, and any report agree. It is
deliberately tiny and dependency-light: the registry lookup is imported lazily
so importing this module never drags in the (heavier) config/network stack.

The grade is data-driven — it comes from the dataset card/registry entry, never
from a hardcoded per-dataset list. Adding a corpus to the relative-only lane is
done by setting ``contamination: HIGH`` on its card, nothing more.
"""

from __future__ import annotations

# Grades that force a corpus into the relative-comparison-only lane. BOTH HIGH
# (the corpus is almost certainly in models' training data) and MEDIUM (it
# plausibly is) are relative-only — a memorized or partially-memorized score is
# never an absolute measure of quality. Only a positively-LOW grade earns the
# absolute lane (see ABSOLUTE_RANKABLE_GRADES). Listed explicitly so the policy
# is auditable at a glance.
RELATIVE_ONLY_GRADES = frozenset({"HIGH", "MEDIUM"})

# The ONLY grade that earns the absolute-quality lane. This is the inverse SSOT
# that makes the lane gate FAIL SAFE: a corpus is absolute-rankable only when it
# is positively graded LOW. Anything else — HIGH, MEDIUM, an absent/NONE grade,
# or an unknown/misspelled grade — is relative-only, so a missing or malformed
# grade can never silently let a corpus be read as absolute translation quality.
ABSOLUTE_RANKABLE_GRADES = frozenset({"LOW"})

# Canonical lane labels (used by the run card, the --json summary, and any UI
# that wants a stable machine value rather than re-deriving from the grade).
LANE_ABSOLUTE = "absolute-quality"
LANE_RELATIVE_ONLY = "relative-comparison-only"


def normalize_grade(grade: object) -> str | None:
    """Upper-case a contamination grade; map empty/``NONE`` to ``None``.

    Accepts the raw value as it appears on a card/registry entry (a string like
    ``"high"``, ``"HIGH"``, ``"None"``) and returns a canonical upper-case grade
    or ``None`` when no meaningful grade is set.
    """
    if grade is None:
        return None
    g = str(grade).strip().upper()
    if not g or g == "NONE":
        return None
    return g


def is_relative_only(grade: object) -> bool:
    """True when a grade keeps a corpus OUT of the absolute-quality lane.

    FAIL SAFE: a corpus is absolute-rankable only when its grade is positively
    LOW. HIGH and MEDIUM (``RELATIVE_ONLY_GRADES``), an absent/``NONE`` grade,
    and any unknown or unrecognized grade ALL return True — a missing or
    misspelled grade can never let a corpus be read as absolute quality. The
    gate keys off ``ABSOLUTE_RANKABLE_GRADES`` (the LOW allow-list) rather than
    the relative-only set precisely so an unrecognized grade defaults to
    relative-only instead of slipping through to absolute.
    """
    return normalize_grade(grade) not in ABSOLUTE_RANKABLE_GRADES


def lane_for_grade(grade: object) -> str:
    """Return the canonical lane label for a contamination grade.

    Fail-safe by construction: delegates to :func:`is_relative_only`, so an
    unknown/None/unrecognized grade lands in the relative-comparison-only lane.
    """
    return LANE_RELATIVE_ONLY if is_relative_only(grade) else LANE_ABSOLUTE


def grade_for_dataset(dataset_id: str | None) -> str | None:
    """Look up a dataset's contamination grade from the registry, normalized.

    Returns the canonical grade (``"HIGH"`` …) or ``None`` when the dataset is
    not registered, the registry is unavailable (e.g. a standalone pip install
    with no bundled registry), or no grade is set. Never raises. A ``None``
    return is NOT "rankable" — the lane gate (:func:`is_relative_only`) fails
    safe and treats an unknown grade as relative-comparison-only.
    """
    if not dataset_id:
        return None
    try:
        from mt_eval_harness.config import load_registry

        registry = load_registry()
    except Exception:
        return None
    for entry in registry.get("datasets", []):
        if entry.get("id") == dataset_id or dataset_id in (entry.get("aliases") or []):
            return normalize_grade(entry.get("contamination"))
    return None


def relative_only_notice(grade: object, dataset_id: str | None = None) -> str:
    """One-line human notice for a relative-only corpus (banner / dry-run / log).

    Returns an empty string when the grade is not relative-only, so callers can
    ``if notice: print(notice)`` without re-checking the grade.
    """
    if not is_relative_only(grade):
        return ""
    g = normalize_grade(grade)
    where = f" '{dataset_id}'" if dataset_id else ""
    # g is None for an absent/unrecognized grade — which is now relative-only by
    # the fail-safe gate. Name it honestly rather than printing "None".
    label = g if g else "ungraded/unknown"
    return (
        f"⚠ {label} contamination — corpus{where} is in the "
        f"relative-comparison-only lane. Scores are valid for comparing methods "
        f"on THIS corpus, not as absolute quality (treated as possibly in "
        f"models' training data)."
    )
