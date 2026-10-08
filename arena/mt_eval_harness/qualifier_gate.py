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

# Floor placeholder on the chrF++ 0-100 scale — mirrors
# DEFAULT_QUALIFIER_THRESHOLD in cli/lib/sealed-qualifier.mjs. Real qualifiers
# always carry a calibrated threshold (migration 042 makes it NOT NULL with no
# default); this exists so the gate stays fail-safe if a caller passes nothing.
DEFAULT_QUALIFIER_THRESHOLD = 30

# What a qualifier score IS, said wherever a threshold is set or printed.
#
# Scoring standard/1 (founder, 2026-10-04: "scoring should be industry
# standard"): the qualifier score is CORPUS chrF++ (sacreBLEU chrF,
# word_order=2) of the method's dev outputs against the public dev
# references, on its native 0-100 scale — the standard's headline metric, and
# the same number an `mt-eval run` card headlines for the same outputs. It
# needs no language tooling, so the entrant (`contest qualify`) and the
# organizer's node compute it identically.
#
# It replaces the "qualifier composite" (100 x a renormalized blend of chrF++
# and exact match), which differed from the `mt-eval run` card composite for
# the same outputs (Round 3: 4.39 vs 0.2482) and rewarded degenerate output:
# an untrained model repeating ONE valid Northern Sami sentence for every
# input scored composite 0.6244 at chrF++ 5.5. The open founder question of
# 2026-10-03 (which composite should gate) is answered by retiring both.
QUALIFIER_METRIC = "chrf_plus_plus"
QUALIFIER_METRICS = ("chrF++",)
QUALIFIER_SCALE = (
    "chrF++ 0-100 qualifier: corpus chrF++ (sacreBLEU chrF, word_order=2) of "
    "the dev outputs against the public dev references — the scoring "
    "standard's headline metric, the same number an `mt-eval run` card "
    "headlines for the same outputs. The weighted composite is retired and "
    "never gates")

# A qualifiers row registered before the standard names metric 'composite' —
# migration 042's column DEFAULT, and what `contest prepare` wrote. Qualifier
# terms are immutable (042's guard), so such a row cannot be corrected in
# place. It is gated on chrF++ like every row, with this note printed and
# recorded: its threshold number is read on the chrF++ 0-100 scale.
LEGACY_QUALIFIER_METRIC = "composite"


def legacy_metric_note(threshold) -> str:
    """What is said whenever a qualifier row naming the retired composite is
    gated: the threshold it states is applied to chrF++."""
    return (f"this qualifier was registered with metric "
            f"'{LEGACY_QUALIFIER_METRIC}' (the qualifiers.metric default "
            f"before scoring standard/1); the composite is retired, so its "
            f"threshold {_fmt(threshold)} is read on the chrF++ 0-100 "
            f"qualifier scale — corpus chrF++ is what gates. Organizer: "
            f"confirm the number is meant as chrF++, or rotate to a new "
            f"qualifier row registered with metric "
            f"'{QUALIFIER_METRIC}'.")


def resolve_qualifier_metric(recorded: Any, threshold: Any = None) -> dict:
    """The metric a qualifiers row gates on, from its recorded ``metric``.

    Returns ``{"metric": "chrf_plus_plus", "recorded": <as recorded>,
    "note": str | None}``. A row naming chrF++ (or naming nothing) gates on
    it with no note; a row naming the retired composite gates on chrF++ with
    :func:`legacy_metric_note`; any other metric is REFUSED (ValueError) —
    the qualifier never gates on a number it does not compute (fail-safe)."""
    value = str(recorded or "").strip()
    if value in ("", QUALIFIER_METRIC):
        return {"metric": QUALIFIER_METRIC, "recorded": value or None,
                "note": None}
    if value == LEGACY_QUALIFIER_METRIC:
        return {"metric": QUALIFIER_METRIC, "recorded": value,
                "note": legacy_metric_note(threshold)}
    raise ValueError(
        f"the qualifier names metric {value!r}, but a qualifier gates on "
        f"corpus chrF++ only (scoring standard/1: {QUALIFIER_SCALE}). Ask the "
        f"organizer to register the qualifier with metric "
        f"'{QUALIFIER_METRIC}' (fail-safe: nothing is gated on a metric this "
        f"lane does not compute).")


# The receipt-vs-node gap. The node re-executes an entrant's method on the
# public dev set and gates on its OWN number; the receipt's number is the
# entrant's claim. The two are computed the same way (same scorer, same
# corpus, and for a model the same decode rule — decode_length), so a large
# gap means the receipt was not earned by what was submitted: in Round 10 a
# receipt of 8.54 came from a substituted model and the node measured 3.37,
# and the node passed it with no word about the difference. A gap above this
# bound is FLAGGED — printed, recorded in the node's state and ledger, and
# shown to the custodian before approval. It never refuses: the node's own
# measurement is what gates.
#
# FOUNDER ITEM: the bound is a policy value. 2.0 points on the chrF++ 0-100
# qualifier scale is deliberately conservative (it flags readily): the same
# weights decoded by the same rule on the same public dev set agree to well
# under a point, so 2.0 sits above run-to-run noise while catching any
# different model or decoding. Mirror: none (the CLI applies no node gate).
QUALIFIER_RECEIPT_GAP_POINTS = 2.0


def receipt_gap(claimed, measured,
                bound: float = QUALIFIER_RECEIPT_GAP_POINTS) -> dict | None:
    """The receipt-vs-node gap when it exceeds ``bound``, else None.

    Returns ``{claimed, measured, gap, bound, direction, message}``; None
    when either number is missing or the two agree within the bound."""
    try:
        c, m = float(claimed), float(measured)
    except (TypeError, ValueError):
        return None
    gap = round(abs(c - m), 2)
    if gap <= bound:
        return None
    direction = "below" if m < c else "above"
    return {
        "claimed": claimed, "measured": measured, "gap": gap, "bound": bound,
        "direction": direction,
        "message": (f"the node measured {measured}, {gap} points {direction} "
                    f"the receipt's {claimed} (flag bound {bound} on the "
                    f"chrF++ 0-100 qualifier scale) — the receipt may not have been "
                    f"earned by the method submitted (another model, other "
                    f"weights, or another decoding). Look before approving; "
                    f"the node's own number is what gates."),
    }


def threshold_phrase(threshold) -> str:
    """``35`` -> ``'35 on the chrF++ 0-100 qualifier scale (corpus chrF++ of
    the dev outputs)'`` — one wording for every place a threshold is shown."""
    # The number as the organizer gave it (35, 35.0).
    return (f"{threshold} on the chrF++ 0-100 qualifier scale (corpus chrF++ "
            f"of the dev outputs)")


def score_phrase(qualifier_score: Any, ci_lower: Any = None,
                 ci_upper: Any = None) -> str:
    """A contest-lane score, named — the one wording for every summary line
    that prints one: ``chrF++ 14.97 [12.10, 17.92] (the chrF++ 0-100
    qualifier)``; the bracket is the 95% bootstrap CI, left out when none
    was computed. ``chrF++ not computed`` when there is no score. Display
    only. (It replaces ``scales_phrase``, which printed the retired
    composite on its two scales.)"""
    if qualifier_score is None:
        return "chrF++ not computed"
    text = f"chrF++ {_fmt(qualifier_score)}"
    if ci_lower is not None and ci_upper is not None:
        text += f" [{_fmt(ci_lower)}, {_fmt(ci_upper)}]"
    return text + " (the chrF++ 0-100 qualifier)"


def qualifier_score_phrase(qualifier_score: Any) -> str:
    """``14.97 on the chrF++ 0-100 qualifier scale`` — a bare qualifier
    number, named. ``not recorded`` when there is none."""
    if qualifier_score is None:
        return "not recorded"
    return f"{_fmt(qualifier_score)} on the chrF++ 0-100 qualifier scale"


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
            "reason": (f"Method scored chrF++ {_fmt(s)} on the public "
                       f"qualifier ({qualifier_id}); the sealed-run threshold "
                       f"is {_fmt(thr)} on the chrF++ 0-100 qualifier scale. "
                       f"Not eligible to propose a sealed run."),
            "threshold": thr, "score": s, "stale": stale, "badge": badge,
        }

    return {
        "eligible": True,
        "reason": (f"Method cleared the public qualifier ({qualifier_id}) at "
                   f"chrF++ {_fmt(s)} ≥ {_fmt(thr)} (chrF++ 0-100 qualifier "
                   f"scale) — eligible to PROPOSE a sealed run (still "
                   f"requires M-of-N custodian approval)."),
        "threshold": thr, "score": s, "stale": stale, "badge": badge,
    }
