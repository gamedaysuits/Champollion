"""The speaker's blind verdict: the newer model against the model in use, on
the family's own new sentences, marked on the same visit with neither named.

While the practice (dev) set is under 50 sentences, no rule on it decides a
round reliably (stress test 6; ``compare.MIN_DECIDING``): the round reads
"too few to tell", the model in use stays, and the next review sheet mixes
the newer model's drafts in blind. ``champollion improve marks`` hands this
module the counts; when the speaker marked the newer model right clearly more
often (a two-proportion test, two-sided 5%), forge offers to put it to use —
the people still say yes first.

Counts only, never a sentence.
"""

from __future__ import annotations

import math

from ..errors import ForgeError
from ..workspace import Workspace

IMPROVE_SPEAKER = "improve-speaker"


def two_proportion(a_right: int, a_n: int, b_right: int, b_n: int) -> tuple[float, str]:
    """(z, clear) for a's share right against b's: clear is "a", "b" or "neither"."""
    p = (a_right + b_right) / (a_n + b_n)
    se = math.sqrt(p * (1 - p) * (1 / a_n + 1 / b_n))
    z = (a_right / a_n - b_right / b_n) / se if se else 0.0
    return z, ("a" if z > 1.96 else "b" if z < -1.96 else "neither")


def record_speaker_verdict(ws: Workspace, *, newer: str, in_use: str, newer_right: int, newer_judged: int,
                           in_use_right: int, in_use_judged: int) -> dict:
    counts = (newer_right, newer_judged, in_use_right, in_use_judged)
    if any(not isinstance(c, int) or c < 0 for c in counts):
        raise ForgeError("speaker-verdict: counts are whole numbers, 0 or more")
    if newer_right > newer_judged or in_use_right > in_use_judged:
        raise ForgeError("speaker-verdict: more drafts marked right than were judged")
    if not newer_judged or not in_use_judged:
        raise ForgeError("speaker-verdict: each model needs at least one judged draft")
    z, clear = two_proportion(newer_right, newer_judged, in_use_right, in_use_judged)
    event = {"newer": newer, "in_use": in_use,
             "newer_right": newer_right, "newer_judged": newer_judged,
             "in_use_right": in_use_right, "in_use_judged": in_use_judged,
             "z": round(z, 2), "clear": {"a": "newer", "b": "in-use"}.get(clear, "neither")}
    ws.ledger.append(IMPROVE_SPEAKER, **event)
    return event


def speaker_verdict_for(ws: Workspace, run_name: str) -> dict | None:
    """The newest speaker verdict on ``run_name`` as the newer model, or None."""
    hits = [e for e in ws.ledger.find(IMPROVE_SPEAKER) if e.get("newer") == run_name]
    return hits[-1] if hits else None


def speaker_text(e: dict) -> str:
    pct = lambda r, n: f"{round(100 * r / n)}%"  # noqa: E731
    return (f"Marking blind on the same visit, the speaker marked the newer model right on {e['newer_right']} of "
            f"{e['newer_judged']} new sentences ({pct(e['newer_right'], e['newer_judged'])}) and the model in use "
            f"on {e['in_use_right']} of {e['in_use_judged']} ({pct(e['in_use_right'], e['in_use_judged'])})")
