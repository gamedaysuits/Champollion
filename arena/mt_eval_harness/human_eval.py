"""human_eval — choosing WHICH systems a human-evaluation budget covers.

Shared tasks cannot pay for human judgment on every entry. WMT's answer is an
automatic pre-ranking that allocates a fixed budget (~18 systems per pair, top
constrained first) to the human campaign; IWSLT human-evaluates each team's
primary entry. This module is that allocation step, and *only* that step.

What it does
------------
``select_for_human_eval(ranking, budget=N)`` reads a ranking dict — normally
the FROZEN ``contests.metadata.final_ranking`` snapshot a close wrote — and
returns the top-N **primary** entries of each ranked section, with one rule
that makes the number honest: **a tie group is never cut in half.** If the
budget line falls inside a group of entries the significance test could not
separate, the whole group is kept and the selection legitimately EXCEEDS the
budget. Both numbers are reported (``budget`` and ``selected_count``) — a
selection that quietly grew would be a lie about what was purchased.

What it does NOT do
-------------------
It records **no judgment**. There is no score, no rating scale, no judgments
table, and none of those exist anywhere in the harness: human judgment belongs
to the Speaker Validation lane, which is a published protocol and not yet a
built lane. Every selection carries ``note`` saying exactly that, so a
selection can never be mistaken for a result.

Reading frozen snapshots defensively
------------------------------------
A frozen ranking was written by whatever harness version closed the contest,
so newer keys (``by_track``, ``by_phase``, ``rank_min``/``rank_max``,
``is_primary``) may simply not be there. Nothing here invents them: a missing
key is reported verbatim as ``"not recorded by this ranking version"`` in the
``basis`` fields, and the selection falls back to the flat ranked list saying
so. Never a silent default.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from mt_eval_harness import __version__ as HARNESS_VERSION

#: The one sentence every selection carries. A selection is a shopping list
#: for a human campaign that has not happened; it is not evidence about
#: quality, and the Speaker Validation lane is where judgment would come from.
NO_JUDGMENT_NOTE = (
    "no human judgment recorded — selection only; judgments require the "
    "Speaker Validation lane"
)

#: What a consumer sees where a key the newer ranking versions carry is simply
#: absent from an older frozen snapshot.
NOT_RECORDED = "not recorded by this ranking version"

#: The phase whose entries a human-evaluation campaign covers. Practice and
#: post-evaluation entries are outside the campaign by construction.
EVALUATION_PHASE = "evaluation"

#: Selection payload version — bumped when the shape changes, so a stored
#: ``metadata.human_eval_selection`` can always be read back correctly.
SELECTION_VERSION = 1


class HumanEvalError(ValueError):
    """A human-eval selection that must not proceed — always with the reason."""


# ---------------------------------------------------------------------------
# Section resolution — per track when the ranking recorded tracks, else one
# section that says it is not partitioned.
# ---------------------------------------------------------------------------

def _sections_from_ranking(ranking: dict) -> tuple[list[dict], str]:
    """Split the ranked entries into the sections a budget applies to.

    Returns ``(sections, basis)`` where each section is
    ``{"track": str, "entries": [...]}``. The budget is per section: a
    constrained track and an unconstrained track are separate competitions
    (WMT compares the constrained systems only against each other), so a
    shared budget across them would silently starve one of the two.
    """
    by_track = ranking.get("by_track")
    if isinstance(by_track, dict) and by_track:
        sections = []
        for track in sorted(by_track):
            block = by_track[track]
            entries = block.get("entries") if isinstance(block, dict) else block
            if not isinstance(entries, list):
                continue
            sections.append({"track": str(track), "entries": entries})
        if sections:
            return sections, "ranking.by_track"
    if isinstance(by_track, list) and by_track:
        sections = []
        for block in by_track:
            if not isinstance(block, dict):
                continue
            entries = block.get("entries")
            if not isinstance(entries, list):
                continue
            sections.append({"track": str(block.get("track") or "all"),
                             "entries": entries})
        if sections:
            return sections, "ranking.by_track"

    entries = ranking.get("entries")
    if not isinstance(entries, list):
        raise HumanEvalError(
            "this ranking carries no `entries` list — it is not a ranking "
            "dict (or it was truncated). Rebuild it with `mt-eval contest "
            "rank --json`, or export the frozen snapshot with "
            "`mt-eval contest export`.")
    return ([{"track": "all", "entries": entries}],
            f"ranking.entries — a per-track partition is {NOT_RECORDED}")


def _phase_filter(entries: list[dict]) -> tuple[list[dict], list[dict], str]:
    """Keep the evaluation-phase entries; report what the basis was.

    A phase is only applied when at least one entry actually records one.
    Entries that record no phase are kept (an older snapshot predates phases
    entirely) and the basis says so, rather than a filter silently emptying
    the selection.
    """
    recorded = [e for e in entries
                if isinstance(e, dict) and e.get("phase") is not None]
    if not recorded:
        return list(entries), [], f"entry.phase is {NOT_RECORDED} — every ranked entry treated as evaluation-phase"
    kept, dropped = [], []
    for e in entries:
        phase = e.get("phase") if isinstance(e, dict) else None
        if phase is None or phase == EVALUATION_PHASE:
            kept.append(e)
        else:
            dropped.append({"run_card_id": (e or {}).get("run_card_id"),
                            "phase": phase,
                            "reason": f"phase={phase!r} is outside the "
                                      f"{EVALUATION_PHASE!r} campaign"})
    return kept, dropped, "entry.phase"


def _primary_filter(entries: list[dict]) -> tuple[list[dict], list[dict], str]:
    """Keep the primary entries; contrastive entries are never selected.

    ``is_primary is False`` is the only exclusion — an entry that records
    nothing is a candidate, and the basis names that ambiguity out loud.
    """
    recorded = [e for e in entries
                if isinstance(e, dict) and e.get("is_primary") is not None]
    if not recorded:
        return list(entries), [], f"entry.is_primary is {NOT_RECORDED} — every ranked entry treated as a primary candidate"
    kept, dropped = [], []
    for e in entries:
        if isinstance(e, dict) and e.get("is_primary") is False:
            dropped.append({"run_card_id": e.get("run_card_id"),
                            "reason": "contrastive entry (is_primary=false) — "
                                      "contrastives are never selected"})
        else:
            kept.append(e)
    return kept, dropped, "entry.is_primary"


def _tie_group(entry: dict) -> Any:
    return entry.get("tie_group") if isinstance(entry, dict) else None


def _cut(entries: list[dict], budget: int,
         keep_tie_groups: bool) -> tuple[list[dict], bool, str]:
    """Take the top ``budget`` entries, never splitting a tie group.

    Returns ``(selected, extended, basis)``. ``extended`` is True when the
    tie-group rule pushed the selection past the budget.
    """
    if budget >= len(entries):
        return list(entries), False, "budget covers every candidate"
    selected = list(entries[:budget])
    if not keep_tie_groups:
        return selected, False, "hard cut at the budget (--no-keep-tie-groups)"
    groups = {_tie_group(e) for e in entries if _tie_group(e) is not None}
    if not groups:
        return selected, False, (f"hard cut at the budget — entry.tie_group is "
                                 f"{NOT_RECORDED}, so no group could be kept whole")
    boundary = _tie_group(entries[budget - 1])
    if boundary is None:
        return selected, False, (
            "hard cut at the budget — the entry on the budget line records no "
            "tie group, so there was no group to keep whole")
    if _tie_group(entries[budget]) != boundary:
        return selected, False, "the budget line fell between tie groups"
    i = budget
    while i < len(entries) and _tie_group(entries[i]) == boundary:
        selected.append(entries[i])
        i += 1
    return selected, True, (
        f"tie group {boundary!r} straddled the budget line and was kept whole "
        f"— the selection exceeds the budget by "
        f"{len(selected) - budget} entr{'y' if len(selected) - budget == 1 else 'ies'}")


_ENTRY_FIELDS: tuple[str, ...] = (
    "rank", "rank_min", "rank_max", "tie_group", "run_card_id", "model_slug",
    "team", "submitter_label", "track", "phase", "is_primary",
)


def _selected_payload(entry: dict, metric_id: Optional[str]) -> dict:
    """The per-entry record a selection carries: identity + where it ranked.

    Deliberately thin — a selection is a list of systems to send to a human
    campaign, not a second copy of the ranking. Keys the snapshot did not
    record come back as the NOT_RECORDED sentence, never as a fabricated
    default.
    """
    out: dict = {}
    for field in _ENTRY_FIELDS:
        out[field] = entry.get(field) if field in entry else NOT_RECORDED
    primary = entry.get("primary")
    if isinstance(primary, dict):
        out["primary_metric"] = primary.get("metric", metric_id)
        out["primary_value"] = primary.get("value")
    else:
        out["primary_metric"] = metric_id if metric_id is not None else NOT_RECORDED
        out["primary_value"] = NOT_RECORDED
    return out


def select_for_human_eval(ranking: dict, *, budget: int,
                          keep_tie_groups: bool = True) -> dict:
    """Allocate a human-evaluation budget over a ranking's primary entries.

    ``ranking`` is a ranking dict — ideally the frozen
    ``contests.metadata.final_ranking``. The budget applies PER SECTION (per
    declared track), because a constrained track and an unconstrained track
    are separate competitions.

    Records no judgment of any kind (see ``NO_JUDGMENT_NOTE``).
    """
    if not isinstance(ranking, dict):
        raise HumanEvalError(
            f"ranking must be a ranking dict (got {type(ranking).__name__}) — "
            f"pass the output of `mt-eval contest rank --json` or the frozen "
            f"metadata.final_ranking snapshot.")
    budget = int(budget)
    if budget < 1:
        raise HumanEvalError(
            f"--budget must be ≥ 1 (got {budget}) — a human-evaluation budget "
            f"of zero selects nothing; simply do not run the selection.")

    contest = ranking.get("contest") if isinstance(ranking.get("contest"), dict) else {}
    metric_id = ranking.get("metric")
    sections_in, section_basis = _sections_from_ranking(ranking)

    sections_out: list[dict] = []
    total_selected = 0
    total_candidates = 0
    for section in sections_in:
        entries = [e for e in section["entries"] if isinstance(e, dict)]
        after_phase, dropped_phase, phase_basis = _phase_filter(entries)
        candidates, dropped_primary, primary_basis = _primary_filter(after_phase)
        selected, extended, cut_basis = _cut(candidates, budget, keep_tie_groups)
        total_selected += len(selected)
        total_candidates += len(candidates)
        sections_out.append({
            "track": section["track"],
            "budget": budget,
            "candidates": len(candidates),
            "selected_count": len(selected),
            "exceeds_budget_by": max(0, len(selected) - budget),
            "tie_group_kept_whole": extended,
            "cut_basis": cut_basis,
            "phase_basis": phase_basis,
            "primary_basis": primary_basis,
            "excluded": dropped_phase + dropped_primary,
            "entries": [_selected_payload(e, metric_id) for e in selected],
        })

    return {
        "selection_version": SELECTION_VERSION,
        "contest_id": contest.get("id"),
        "contest_name": contest.get("name"),
        "language_pair": contest.get("language_pair"),
        "corpus_id": contest.get("corpus_id"),
        "budget": budget,
        "keep_tie_groups": bool(keep_tie_groups),
        "metric": metric_id,
        "metric_label": ranking.get("metric_label"),
        "section_basis": section_basis,
        "ranking_frozen": bool(ranking.get("frozen")),
        "ranking_frozen_at": ranking.get("frozen_at", NOT_RECORDED),
        "ranking_generated_at": ranking.get("generated_at", NOT_RECORDED),
        "ranking_harness_version": ranking.get("harness_version", NOT_RECORDED),
        "candidates": total_candidates,
        "selected_count": total_selected,
        "sections": sections_out,
        "note": NO_JUDGMENT_NOTE,
        "selected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "harness_version": HARNESS_VERSION,
    }


# ---------------------------------------------------------------------------
# Persistence — metadata.human_eval_selection, after close only.
# ---------------------------------------------------------------------------

def write_selection(contest_id: str, selection: dict) -> dict:
    """PATCH ``contests.metadata.human_eval_selection`` on a CLOSED contest.

    The 074 lifecycle guard is the real gate: ``human_eval_selection`` is the
    one metadata key still writable after close (the selection is chosen FROM
    the frozen ranking, so it necessarily lands after it). This function
    checks the same rule client-side so the refusal names the reason, and any
    error the database raises anyway is surfaced VERBATIM — a trigger message
    is the most accurate description of what happened.

    A JSONB PATCH REPLACES the column, so the merge happens here: the current
    metadata is read with the owner's session and rewritten with exactly one
    key changed.
    """
    if not isinstance(selection, dict) or not selection:
        raise HumanEvalError(
            "selection must be the dict returned by select_for_human_eval().")
    if selection.get("note") != NO_JUDGMENT_NOTE:
        raise HumanEvalError(
            "refusing to write a selection that does not carry the "
            f"no-judgment note ({NO_JUDGMENT_NOTE!r}) — a stored selection "
            "must never read as a result.")

    from mt_eval_harness.auth import get_session, get_submitter_email
    from mt_eval_harness.contest import _api_request, _owned_contest

    session = get_session()
    email = get_submitter_email(session)
    contest = _owned_contest(contest_id, session, email)
    status = contest.get("status")
    if status != "closed":
        raise HumanEvalError(
            f"Contest '{contest_id}' is {status!r} — a human-evaluation "
            f"selection is made FROM the frozen ranking, so it is written "
            f"only after `mt-eval contest close {contest_id}`. (Migration "
            f"074 enforces the same rule beneath every client.)")

    metadata = dict(contest.get("metadata") or {})
    metadata["human_eval_selection"] = selection
    patched = _api_request(
        "PATCH", "contests", params={"id": f"eq.{contest_id}"},
        data={"metadata": metadata}, session=session)
    if not patched:
        raise HumanEvalError(
            f"Could not write the human-eval selection on contest "
            f"'{contest_id}': the owner-update policy matched no row for "
            f"{email}.")
    return patched[0] if isinstance(patched, list) else patched


def format_selection(selection: dict) -> str:
    """Human-readable rendering of a selection (never raises on shape)."""
    lines: list[str] = []
    lines.append(f"\n  Human-evaluation selection — contest "
                 f"{selection.get('contest_id')} "
                 f"({selection.get('contest_name') or ''})")
    lines.append(f"  {selection.get('language_pair') or '?'} · set "
                 f"{selection.get('corpus_id') or '?'} · ranked on "
                 f"{selection.get('metric_label') or selection.get('metric')}")
    frozen = ("FROZEN ranking" if selection.get("ranking_frozen")
              else "PROVISIONAL ranking (not a closed contest)")
    lines.append(f"  Source: {frozen} · sections from {selection.get('section_basis')}")
    lines.append(f"  Budget {selection.get('budget')} per section · "
                 f"{selection.get('selected_count')} selected of "
                 f"{selection.get('candidates')} candidate(s)")
    for section in selection.get("sections") or []:
        lines.append("")
        lines.append(f"  Track {section.get('track')} — "
                     f"{section.get('selected_count')} of "
                     f"{section.get('candidates')} candidate(s)"
                     f"{' (tie group kept whole)' if section.get('tie_group_kept_whole') else ''}")
        lines.append(f"    cut: {section.get('cut_basis')}")
        lines.append(f"    phase: {section.get('phase_basis')}")
        lines.append(f"    primary: {section.get('primary_basis')}")
        lines.append(f"    {'Rank':>6}  {'Tie':>4}  {'Score':>9}  System")
        for e in section.get("entries") or []:
            value = e.get("primary_value")
            score = f"{value:.4g}" if isinstance(value, (int, float)) else "—"
            rng = ""
            lo, hi = e.get("rank_min"), e.get("rank_max")
            if isinstance(lo, int) and isinstance(hi, int) and lo != hi:
                rng = f" [{lo}–{hi}]"
            slug = e.get("model_slug")
            if not slug or slug == NOT_RECORDED:
                slug = e.get("run_card_id") or "(unidentified entry)"
            lines.append(f"    {str(e.get('rank')):>6}{rng}  "
                         f"{str(e.get('tie_group')):>4}  {score:>9}  {slug}")
        for x in section.get("excluded") or []:
            lines.append(f"    excluded {x.get('run_card_id')}: {x.get('reason')}")
    lines.append("")
    lines.append(f"  ⚠ {selection.get('note')}")
    return "\n".join(lines) + "\n"


__all__ = [
    "EVALUATION_PHASE",
    "HumanEvalError",
    "NOT_RECORDED",
    "NO_JUDGMENT_NOTE",
    "SELECTION_VERSION",
    "format_selection",
    "select_for_human_eval",
    "write_selection",
]
