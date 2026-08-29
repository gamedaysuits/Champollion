"""qualifier_gate — Python mirror of the public-qualifier eligibility rule.

The logic SSOT is ``cli/lib/sealed-qualifier.mjs``: a method must clear a
DISJOINT, fully PUBLIC twin of a sealed test set — the *qualifier* — before a
run against the sealed set may even be proposed. The organizer scoring node
(contest_node.py) is Python, so this module is a hand-synced mirror, kept in
step by ``tests/test_qualifier_gate.py``'s node-subprocess parity case (the
proven contamination.py <-> cli/lib/contamination-lane.js pattern).

Mirrored surface (semantics + return keys are identical; human-readable
``reason`` strings are equivalent, not char-identical):

  DEFAULT_QUALIFIER_THRESHOLD          — caller-supplied floor placeholder ONLY;
                                         every real qualifier row (migration 042)
                                         carries its own calibrated threshold.
  qualifier_version_tag / parse_qualifier_year / build_qualifier_id
  qualifier_contamination_badge        — vYYYY staleness -> contamination risk
  is_eligible_for_sealed_run           — THE gate. Fail-safe: no qualifier, no
                                         recorded score, or score below the
                                         threshold => NOT eligible.

Deliberately NOT mirrored: ``gateQualifier`` (the license gate for registering
a qualifier corpus) — registration happens CLI-side where the license SSOT
lives; the node only ever *applies* an already-registered qualifier.

Pure functions, no I/O — years are injected so the logic is deterministic and
testable.
"""

from __future__ import annotations

import re
from typing import Any, Optional

# Floor placeholder on the composite 0-100 scale — mirrors
# DEFAULT_QUALIFIER_THRESHOLD in cli/lib/sealed-qualifier.mjs. Real qualifiers
# always carry a calibrated threshold (migration 042 makes it NOT NULL with no
# default); this exists so the gate stays fail-safe if a caller passes nothing.
DEFAULT_QUALIFIER_THRESHOLD = 30


def _fmt(value: Any) -> str:
    """Render a number the way JS template literals do (30.0 -> '30')."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


# ---------------------------------------------------------------------------
# Versioning — vYYYY yearly rotation.
# ---------------------------------------------------------------------------

def qualifier_version_tag(year: Any) -> str:
    """2026 -> 'v2026'. Mirrors qualifierVersionTag."""
    try:
        y = int(year)
    except (TypeError, ValueError):
        raise ValueError(f"Qualifier year must be a 4-digit year (got {year}).")
    if not (2000 <= y <= 9999):
        raise ValueError(f"Qualifier year must be a 4-digit year (got {year}).")
    return f"v{y}"


def parse_qualifier_year(value: Any) -> Optional[int]:
    """'v2026' (or an id ending in '-v2026') -> 2026, else None."""
    m = re.search(r"v(\d{4})(?:$|[^0-9])", str(value or ""))
    return int(m.group(1)) if m else None


def build_qualifier_id(*, source: str, target: str, slug: str | None = None,
                       year: int) -> str:
    """eval-<src>-<tgt>-<slug>-qualifier-vYYYY. Mirrors buildQualifierId."""
    tag = slug if slug else "sealed"
    return f"eval-{source}-{target}-{tag}-qualifier-{qualifier_version_tag(year)}"


# ---------------------------------------------------------------------------
# Staleness -> contamination-risk badge.
# ---------------------------------------------------------------------------

def qualifier_contamination_badge(*, qualifier_year: Any,
                                  current_year: Any) -> dict:
    """Badge for a qualifier's vintage vs the active year.

    Current-year => fresh (no badge). 1 year behind => MEDIUM, 2+ => HIGH —
    the public twin has been out long enough that training-set contamination
    and overfitting become real. Mirrors qualifierContaminationBadge exactly
    (keys: stale, ageYears, risk, badge, reason).
    """
    try:
        qy = int(qualifier_year)
        cy = int(current_year)
    except (TypeError, ValueError):
        raise ValueError("qualifier_contamination_badge needs integer years.")

    age = cy - qy
    if age <= 0:
        return {
            "stale": False,
            "ageYears": max(0, age),
            "risk": "NONE",
            "badge": None,
            "reason": f"Qualifier v{qy} is current — fresh.",
        }
    risk = "HIGH" if age >= 2 else "MEDIUM"
    yr = "yr" if age == 1 else "yrs"
    year_word = "year" if age == 1 else "years"
    return {
        "stale": True,
        "ageYears": age,
        "risk": risk,
        "badge": f"⚠ STALE QUALIFIER (v{qy}, {age} {yr} old)",
        "reason": (
            f"Qualifier v{qy} is {age} {year_word} behind the active v{cy}; "
            f"public exposure raises contamination/overfitting risk ({risk}). "
            f"Rotate to v{cy}."
        ),
    }


# ---------------------------------------------------------------------------
# Eligibility — THE gate every sealed-run proposal passes BEFORE custodians are
# ever bothered. Fail-safe: anything unconfirmed => NOT eligible.
# ---------------------------------------------------------------------------

def is_eligible_for_sealed_run(*, qualifier_id: str | None = None,
                               score: Any = None,
                               threshold: Any = DEFAULT_QUALIFIER_THRESHOLD,
                               qualifier_year: Any = None,
                               current_year: Any = None) -> dict:
    """Is a method eligible to PROPOSE a run against the sealed set?

    Requires a paired qualifier, a recorded score on it, and that score meeting
    the threshold. A stale qualifier still gates (you must clear the *current*
    qualifier); staleness is reported for the caller to surface. Mirrors
    isEligibleForSealedRun (keys: eligible, reason, threshold, score, stale,
    badge).
    """
    thr = float(threshold)
    badge = None
    if qualifier_year is not None and current_year is not None:
        badge = qualifier_contamination_badge(
            qualifier_year=qualifier_year, current_year=current_year)
    stale = bool(badge and badge["stale"])

    if not qualifier_id:
        return {
            "eligible": False,
            "reason": ("No public qualifier is paired with this sealed set — "
                       "a sealed run cannot be proposed without one."),
            "threshold": thr, "score": None, "stale": stale, "badge": badge,
        }

    try:
        s = float(score)
    except (TypeError, ValueError):
        s = None
    if s is None:
        return {
            "eligible": False,
            "reason": (f"Method has not cleared the public qualifier "
                       f"({qualifier_id}) yet — run it on the qualifier first."),
            "threshold": thr, "score": None, "stale": stale, "badge": badge,
        }

    if s < thr:
        return {
            "eligible": False,
            "reason": (f"Method scored {_fmt(s)} on the public qualifier "
                       f"({qualifier_id}); the sealed-run threshold is "
                       f"{_fmt(thr)}. Not eligible to propose a sealed run."),
            "threshold": thr, "score": s, "stale": stale, "badge": badge,
        }

    return {
        "eligible": True,
        "reason": (f"Method cleared the public qualifier ({qualifier_id}) at "
                   f"{_fmt(s)} ≥ {_fmt(thr)} — eligible to PROPOSE a sealed "
                   f"run (still requires M-of-N custodian approval)."),
        "threshold": thr, "score": s, "stale": stale, "badge": badge,
    }
