"""shared_task — the multi-pair shared-task edition umbrella (migration 047).

AmericasNLP-style shared tasks are multi-pair (one edition = Spanish → ~11
Indigenous languages) while contests are per-pair, so an edition used to be N
disconnected contests. A `shared_tasks` row is the thin umbrella over them:
name, organizer, cycle year, and the edition's POLICY DEFAULTS
(default_authorization_model / default_intake_daily_limit), which
`mt-eval contest prepare --shared-task <id>` copies onto each member contest
it registers (explicit flags always win). Grouping + defaults only — no
per-pair machinery (qualifiers 042, intake 043, authorization 038–040) reads
this table.

Organizer-side registry operations, so everything here speaks service-role
REST (sovereign_service): dev/staging branch only, prod refused without
MT_EVAL_ALLOW_PROD, and the un-bypassable 047 triggers stay in force beneath
these helpers.

The edition REPORT (``report_edition`` / ``set_report_url``) lives here too.
Every real shared task ends in a Findings paper — WMT's, AmericasNLP's, IWSLT's
— and until now this pipeline published run cards and nothing that described a
whole edition. ``report_edition`` writes that description as Markdown, built
**only from frozen snapshots**: the ``contests.metadata.final_ranking`` a
`contest close` froze, plus the participants' own system descriptions verbatim.
It never re-ranks, never recomputes a score, and refuses an edition with an
open contest rather than reporting a moving number. Anything a snapshot did
not record is printed as "not recorded", never filled in.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from mt_eval_harness import __version__ as HARNESS_VERSION
from mt_eval_harness.contest_prep import AUTHORIZATION_MODELS

# One row per edition-YEAR (americasnlp-2026), mirroring qualifier vYYYY
# rotation: next year's cycle is a new row, never an edit (047 identity guard).
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class SharedTaskError(ValueError):
    """A shared-task operation that must not proceed — always with the reason."""


def create_shared_task(
    *,
    shared_task_id: str,
    name: str,
    organizer: str,
    year: int,
    default_authorization_model: str = "per-submission",
    default_intake_daily_limit: int = 5,
    description: str = "",
) -> dict:
    """Register a shared-task edition row (047). Returns the created row.

    Content-free by construction: an edition is a name, an organizer label,
    a year, and two policy defaults. Duplicate slugs come back as the DB's
    own unique-violation error, verbatim and loud.
    """
    if not _SLUG_RE.match(shared_task_id or ""):
        raise SharedTaskError(
            f"shared-task id {shared_task_id!r} must be a lowercase slug "
            f"([a-z0-9-], e.g. 'americasnlp-2026') — one row per edition-year.")
    if not (name or "").strip():
        raise SharedTaskError("--name is required (the edition's public name).")
    if not (organizer or "").strip():
        raise SharedTaskError(
            "--organizer is required — the organizing body's own public "
            "label (never a key-custodian naming; custodians stay behind "
            "the opaque custodian_group_id).")
    if not (2000 <= int(year) <= 9999):
        raise SharedTaskError(f"--year must be a 4-digit cycle year (got {year!r}).")
    if default_authorization_model not in AUTHORIZATION_MODELS:
        raise SharedTaskError(
            f"default authorization model must be one of "
            f"{AUTHORIZATION_MODELS} (got {default_authorization_model!r}).")
    if int(default_intake_daily_limit) <= 0:
        raise SharedTaskError(
            f"default intake daily limit must be > 0 "
            f"(got {default_intake_daily_limit!r}).")

    from mt_eval_harness.sovereign_service import service_request
    rows = service_request("POST", "shared_tasks", data={
        "shared_task_id": shared_task_id,
        "name": name.strip(),
        "organizer": organizer.strip(),
        "year": int(year),
        "description": description or "",
        "default_authorization_model": default_authorization_model,
        "default_intake_daily_limit": int(default_intake_daily_limit),
        "status": "active",
    })
    return rows[0] if isinstance(rows, list) and rows else (rows or {})


def fetch_shared_task(shared_task_id: str) -> dict:
    """Resolve an edition row by slug; fail loud when it does not exist."""
    from mt_eval_harness.sovereign_service import service_request
    rows = service_request("GET", "shared_tasks", params={
        "shared_task_id": f"eq.{shared_task_id}",
        "select": "*",
    })
    if not rows:
        raise SharedTaskError(
            f"shared task {shared_task_id!r} is not registered. Create the "
            f"edition first: mt-eval shared-task create --id {shared_task_id} "
            f"--name … --organizer … --year …")
    return rows[0]


def list_shared_tasks(*, year: Optional[int] = None,
                      include_archived: bool = False) -> list[dict]:
    """All edition rows, newest cycle first."""
    from mt_eval_harness.sovereign_service import service_request
    params: dict = {"select": "*", "order": "year.desc,shared_task_id.asc"}
    if year is not None:
        params["year"] = f"eq.{int(year)}"
    if not include_archived:
        params["status"] = "eq.active"
    return service_request("GET", "shared_tasks", params=params) or []


# ===========================================================================
# The edition report (practice 9) — a Findings-style Markdown document built
# from FROZEN snapshots only.
# ===========================================================================

#: Printed wherever a snapshot simply does not carry a key. Older frozen
#: rankings predate `by_track`, `rank_min`/`rank_max`, `tie_policy`,
#: `prize_eligibility`, `deferred_results` and friends; a report that invented
#: a plausible value for one of those would be fiction about a closed contest.
NOT_RECORDED = "not recorded by this ranking version"

#: R1 + the 2026-09-07 trinary ruling, stated once and quoted wherever prizes
#: appear. The report never paraphrases a contest's terms: it reproduces the
#: term the contest declared, verbatim, plus the plain-language reading
#: generated from it.
PRIZE_RULE = (
    "Prizes exist only on sovereign (sealed-lane) contests. Each prized "
    "contest declares ONE term — pass_to_holders, retain_ip or release_open — "
    "frozen before the first entry; this report reproduces the declared term "
    "verbatim. There is no single prize condition that applies to every "
    "contest, and a contest that declared no term has no prize."
)


def _report_ts() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _fetch_member_contests(shared_task_id: str) -> list[dict]:
    """Every contest attached to the edition, in language-pair order."""
    from mt_eval_harness.sovereign_service import service_request
    rows = service_request("GET", "contests", params={
        "shared_task_id": f"eq.{shared_task_id}",
        "select": "*",
        "order": "language_pair.asc,id.asc",
    }) or []
    return [r for r in rows if isinstance(r, dict)]


#: The declaration columns a system description lives beside (migration 074).
_SUBMISSION_SELECT = (
    "contest_id,run_card_id,submitted_by,submitted_at,team,notes,"
    "description,is_primary,track,submitter_label,method_release_url"
)


def _fetch_submissions(contest_id: str) -> tuple[list[dict], Optional[str]]:
    """Participant declarations for one contest.

    Returns ``(rows, unavailable_reason)``. A stack without migration 074 has
    no ``description`` column; PostgREST says so and that message is carried
    into the report verbatim instead of the report pretending nobody wrote a
    description.
    """
    from mt_eval_harness.sovereign_service import service_request
    try:
        rows = service_request("GET", "contest_submissions", params={
            "contest_id": f"eq.{contest_id}",
            "select": _SUBMISSION_SELECT,
            "order": "submitted_at.asc",
        }) or []
        return [r for r in rows if isinstance(r, dict)], None
    except RuntimeError as exc:
        return [], str(exc)


def _get(obj: Any, key: str, default: Any = NOT_RECORDED) -> Any:
    if isinstance(obj, dict) and key in obj:
        return obj[key]
    return default


def _fmt(value: Any) -> str:
    """Render a snapshot value for a Markdown cell without inventing one."""
    if value is None:
        return "—"
    if value is NOT_RECORDED or value == NOT_RECORDED:
        return f"*{NOT_RECORDED}*"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, float):
        return f"{value:.4g}"
    if isinstance(value, (list, tuple)):
        return ", ".join(str(v) for v in value) if value else "—"
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    text = str(value)
    return text.replace("|", "\\|") if text else "—"


def _rank_range(entry: dict) -> str:
    lo, hi = entry.get("rank_min"), entry.get("rank_max")
    if isinstance(lo, int) and isinstance(hi, int):
        return f"{lo}" if lo == hi else f"{lo}–{hi}"
    return f"*{NOT_RECORDED}*"


def _entry_value(entry: dict) -> Any:
    primary = entry.get("primary")
    if isinstance(primary, dict):
        return primary.get("value")
    return NOT_RECORDED


def _tie_paragraph(ranking: dict) -> str:
    """The "how ties were decided" paragraph, generated from ``tie_policy``.

    ``tie_policy`` is the newer key; ``ranking_method`` is what the
    2026-09-06 ranking version wrote. Whichever is present is described from
    its own recorded values — no sentence here asserts a test that the
    snapshot does not name.
    """
    policy = ranking.get("tie_policy")
    if not isinstance(policy, dict):
        policy = ranking.get("ranking_method")
    if not isinstance(policy, dict):
        return (f"The tie policy is {NOT_RECORDED}, so this report cannot "
                f"state how equal-looking entries were separated. Treat "
                f"adjacent ranks as unseparated unless the snapshot says "
                f"otherwise.")
    test = policy.get("tie_test")
    test_label = {"ar": "approximate randomization (Riezler & Maxwell 2005)",
                  "bootstrap": "paired bootstrap (Koehn 2004)"}.get(
                      test, f"{test!r}" if test else NOT_RECORDED)
    alpha = policy.get("alpha", NOT_RECORDED)
    n = policy.get("n_resamples", NOT_RECORDED)
    seed = policy.get("seed", NOT_RECORDED)
    evidence = policy.get("evidence_used")
    parts = [
        f"Entries were ordered by the primary metric and every ADJACENT pair "
        f"was tested; a pair the test could not separate shares a rank, and "
        f"ties chain through adjacent pairs (competition numbering 1, 1, 3). "
        f"The declared test was {test_label} at α = {_fmt(alpha)} with "
        f"{_fmt(n)} resamples and seed {_fmt(seed)}.",
        "Evidence came from a three-rung ladder, and each pair records the "
        "rung actually used: (1) a per-segment paired test, available only "
        "when both cards carry a complete aligned per-segment set — a sealed "
        "contest's node never exports per-segment outputs, so sealed "
        "contests never reach this rung; (2) 95% bootstrap-CI overlap on the "
        "run-card CI columns, a conservative proxy rather than a paired "
        "test; (3) point equality at the metric's display rounding.",
    ]
    if isinstance(evidence, list) and evidence:
        parts.append("Rungs actually used in this contest: "
                     + ", ".join(str(x) for x in evidence) + ".")
    elif evidence is not None:
        parts.append(f"Rungs actually used: {_fmt(evidence)}.")
    else:
        parts.append(f"Which rungs were used is {NOT_RECORDED}.")
    note = policy.get("note")
    if isinstance(note, str) and note.strip():
        parts.append(f"Snapshot note, verbatim: {note.strip()}")
    return "\n\n".join(parts)


def _execution_summary(entries: list[dict]) -> list[str]:
    """Counts-only execution facts. Reported, never ranked (contract C7)."""
    blocks = [e.get("execution") for e in entries
              if isinstance(e.get("execution"), dict)]
    lines: list[str] = []
    if not blocks:
        lines.append(f"No ranked entry carries an `execution` block "
                     f"({NOT_RECORDED}, or produced by a lane that measures "
                     f"nothing). No runtime is reported for this contest.")
        return lines
    runtimes = [b.get("runtime_seconds") for b in blocks
                if isinstance(b.get("runtime_seconds"), (int, float))]
    runtimes.sort()
    runtime_kinds = sorted({str(b.get("runtime")) for b in blocks
                            if b.get("runtime")})
    nodes = sorted({str(b.get("node_id")) for b in blocks if b.get("node_id")})
    lines.append(f"- Entries carrying execution facts: {len(blocks)} of {len(entries)}")
    if runtimes:
        median = runtimes[len(runtimes) // 2]
        lines.append(f"- Wall-clock runtime (seconds): min {runtimes[0]:.4g} · "
                     f"median {median:.4g} · max {runtimes[-1]:.4g}")
    else:
        lines.append(f"- Wall-clock runtime: {NOT_RECORDED} on every entry")
    lines.append(f"- Execution runtimes declared: "
                 f"{', '.join(runtime_kinds) if runtime_kinds else NOT_RECORDED}")
    lines.append(f"- Executing node(s): "
                 f"{', '.join(nodes) if nodes else NOT_RECORDED}")
    lines.append("- These figures are REPORTED, never ranked: they were "
                 "measured on the organizer's node under its own caps, which "
                 "is not a fair comparison across methods. There is no "
                 "efficiency track.")
    return lines


def _prize_terms_section(ranking: dict) -> list[str]:
    """The contest's DECLARED prize terms, reproduced — never paraphrased.

    Three honest cases: terms recorded in the frozen snapshot (printed as the
    declared OPTION, then the derived-detail table, the generated
    plain-language reading and the hash participants accepted); a snapshot
    that predates the disposition (printed as "not recorded", with whatever it
    did record shown verbatim); and a contest that declared no terms (no
    prize, said plainly).
    """
    from mt_eval_harness import contest_prize_terms

    pt = ranking.get("prize_terms")
    if pt is None:
        return [f"The contest's prize terms are {NOT_RECORDED}. No prize "
                f"condition can be read out of this report."]
    if not isinstance(pt, dict):
        return [f"`prize_terms` has an unexpected shape "
                f"({type(pt).__name__}); reported verbatim: {_fmt(pt)}"]
    if not pt.get("declared"):
        return ["**No prize terms were declared on this contest, so it has no "
                "prize.** Nothing below is an eligibility claim."]

    terms = pt.get("terms")
    if not isinstance(terms, dict) or not terms:
        # A pre-dial snapshot: it declared *something*, but not the dimensions.
        return [f"This snapshot records that prize terms were declared but "
                f"the terms themselves are {NOT_RECORDED} in the current "
                f"form. Recorded verbatim:", "", "```json",
                json.dumps(pt, indent=2, ensure_ascii=False, sort_keys=True),
                "```"]

    disposition = terms.get("disposition")
    out: list[str] = []
    if disposition:
        headline = contest_prize_terms.DISPOSITION_HEADLINES.get(
            disposition, NOT_RECORDED)
        out += [f"**The term this contest declared: `{disposition}`** — "
                f"{headline}.", "",
                "What that means in detail, as frozen in the snapshot:"]
    else:
        out.append("The terms this contest declared, as frozen in the "
                   "snapshot (this snapshot predates the declared option):")
    out += ["", "| Dimension | Declared value |", "|---|---|"]
    for name in contest_prize_terms.DIMENSIONS:
        if name in terms and name != "disposition":
            label = contest_prize_terms.DIMENSION_LABELS.get(name, name)
            out.append(f"| `{name}` — {label} | `{_fmt(terms[name])}` |")
    out.append("")
    digest = pt.get("terms_sha256")
    out.append(f"Terms hash (what each entrant accepted): "
               f"`{_fmt(digest)}`")
    out.append("")
    described = pt.get("describe")
    if not described:
        try:
            described = contest_prize_terms.describe(terms)
        except contest_prize_terms.PrizeTermsError as exc:
            described = (f"The recorded terms cannot be read back in the "
                         f"current vocabulary ({exc}); the table above is "
                         f"what the snapshot froze.")
    out.append(f"In plain language: {described}")
    gate = pt.get("gate")
    if isinstance(gate, list):
        out.append("")
        out.append(f"Verifications these terms require before a payout: "
                   f"{', '.join(f'`{g}`' for g in gate) if gate else 'none'}.")
    return out


def _prize_gate_table(ranking: dict, eligibility) -> list[str]:
    """Per-entry: did each required verification pass? (─ = not required.)"""
    from mt_eval_harness import contest_prize_terms

    if not isinstance(eligibility, dict):
        return [f"`prize_eligibility` has an unexpected shape "
                f"({type(eligibility).__name__}); reported verbatim: "
                f"{_fmt(eligibility)}"]
    if not eligibility:
        return ["No entry carries a prize-eligibility verdict in this snapshot."]

    steps = contest_prize_terms.GATE_STEPS
    out = ["Per entry, as recorded in the frozen snapshot "
           "(`─` = this contest's terms do not require that step):", "",
           "| Run card | Eligible | "
           + " | ".join(f"`{s}`" for s in steps) + " | Reason |",
           "|---|---|" + "---|" * len(steps) + "---|"]
    for run_card_id in sorted(eligibility):
        verdict = eligibility[run_card_id]
        if not isinstance(verdict, dict):
            out.append(f"| `{_fmt(run_card_id)}` | {_fmt(verdict)} | "
                       + "| " * len(steps) + " |")
            continue
        gate = verdict.get("gate")
        cells = []
        for step in steps:
            value = gate.get(step) if isinstance(gate, dict) else None
            if not isinstance(gate, dict):
                cells.append(NOT_RECORDED)
            elif value is None:
                cells.append("─")
            else:
                cells.append("yes" if value else "**no**")
        out.append(f"| `{_fmt(run_card_id)}` | "
                   f"{'yes' if verdict.get('eligible') else '**no**'} | "
                   + " | ".join(cells) + f" | {_fmt(verdict.get('reason'))} |")
    return out


def _entries_table(entries: list[dict], metric_label: str) -> list[str]:
    if not entries:
        return ["*No entries in this section.*"]
    out = [f"| Rank | Rank range | Tie group | System | Team | {metric_label} | Tie evidence |",
           "|---|---|---|---|---|---|---|"]
    for e in entries:
        ev = e.get("tie_evidence")
        ev_text = "—"
        if isinstance(ev, dict):
            ev_text = f"{_fmt(ev.get('method'))} — {_fmt(ev.get('reason'))}"
        elif ev is not None:
            ev_text = _fmt(ev)
        out.append(
            f"| {_fmt(e.get('rank'))} | {_rank_range(e)} | "
            f"{_fmt(e.get('tie_group'))} | "
            f"{_fmt(e.get('submitter_label') or e.get('model_slug'))} | "
            f"{_fmt(e.get('team'))} | {_fmt(_entry_value(e))} | {ev_text} |")
    return out


def _track_partitions(ranking: dict) -> list[str]:
    by_track = ranking.get("by_track")
    if by_track is None:
        return [f"Track partitioning is {NOT_RECORDED} for this contest — "
                f"every entry is reported in one undivided ranking."]
    if isinstance(by_track, dict):
        if not by_track:
            return ["No track partitions were declared; one undivided ranking."]
        rows = ["| Track | Entries |", "|---|---|"]
        for track in sorted(by_track):
            block = by_track[track]
            entries = block.get("entries") if isinstance(block, dict) else block
            n = len(entries) if isinstance(entries, list) else 0
            rows.append(f"| {_fmt(track)} | {n} |")
        return rows
    if isinstance(by_track, list):
        rows = ["| Track | Entries |", "|---|---|"]
        for block in by_track:
            if not isinstance(block, dict):
                continue
            entries = block.get("entries")
            n = len(entries) if isinstance(entries, list) else 0
            rows.append(f"| {_fmt(block.get('track'))} | {n} |")
        return rows
    return [f"`by_track` has an unexpected shape ({type(by_track).__name__}); "
            f"reported verbatim: {_fmt(by_track)}"]


def _descriptions_section(rows: list[dict],
                          unavailable: Optional[str]) -> list[str]:
    """The participants' own words, verbatim — never summarised or edited."""
    out: list[str] = []
    if unavailable:
        out.append("System descriptions could not be read. The database "
                   "returned, verbatim:")
        out.append("")
        out.append("```")
        out.append(unavailable)
        out.append("```")
        return out
    described = [r for r in rows
                 if isinstance(r.get("description"), str) and r["description"].strip()]
    if not described:
        out.append(f"No participant recorded a system description "
                   f"({len(rows)} submission row(s) read).")
        return out
    out.append(f"{len(described)} of {len(rows)} submission(s) carry a "
               f"description. Each is reproduced VERBATIM — the organizer "
               f"does not edit, summarise or translate a participant's own "
               f"account of their system.")
    for r in described:
        label = (r.get("submitter_label") or r.get("team")
                 or r.get("run_card_id") or "(unlabelled entry)")
        kind = ("primary" if r.get("is_primary") is True
                else "contrastive" if r.get("is_primary") is False
                else NOT_RECORDED)
        out.append("")
        out.append(f"#### {label}")
        out.append("")
        out.append(f"*Entry: {kind} · track {_fmt(r.get('track'))} · run card "
                   f"`{_fmt(r.get('run_card_id'))}`"
                   + (f" · method release: {r['method_release_url']}"
                      if r.get("method_release_url") else "") + "*")
        out.append("")
        out.append("> " + "\n> ".join(r["description"].strip().splitlines()))
    return out


def _contest_section(contest: dict) -> list[str]:
    ranking = contest.get("metadata", {}).get("final_ranking")
    entries = ranking.get("entries") if isinstance(ranking.get("entries"), list) else []
    metric_label = str(_get(ranking, "metric_label", None)
                       or _get(ranking, "metric", NOT_RECORDED))
    rows, unavailable = _fetch_submissions(contest["id"])

    out: list[str] = []
    out.append(f"## {contest.get('language_pair') or '?'} — "
               f"{contest.get('name') or contest['id']}")
    out.append("")
    out.append(f"| Field | Value |")
    out.append("|---|---|")
    out.append(f"| Contest | `{contest['id']}` |")
    out.append(f"| Corpus card | `{_fmt(contest.get('corpus_id'))}` |")
    out.append(f"| Language pair | {_fmt(contest.get('language_pair'))} |")
    out.append(f"| Lane | {_fmt(contest.get('lane'))} |")
    out.append(f"| Status | {_fmt(contest.get('status'))} |")
    out.append(f"| Ranking frozen at | {_fmt(_get(ranking, 'frozen_at'))} |")
    out.append(f"| Primary metric | {_fmt(metric_label)} "
               f"(`{_fmt(_get(ranking, 'metric'))}`) |")
    out.append(f"| Metric chosen by | {_fmt(_get(ranking, 'metric_source'))} |")
    out.append(f"| Trust policy | {_fmt(_get(ranking, 'trust_policy'))} |")
    out.append(f"| Identity policy | {_fmt(_get(ranking, 'identity_policy'))} |")
    out.append(f"| Harness that froze it | {_fmt(_get(ranking, 'harness_version'))} |")
    out.append("")

    out.append("### Track partitions")
    out.append("")
    out.extend(_track_partitions(ranking))
    out.append("")

    out.append("### Primary ranking")
    out.append("")
    out.extend(_entries_table(entries, metric_label))
    out.append("")
    unscored = _get(ranking, "unscored", None)
    if isinstance(unscored, list) and unscored:
        out.append(f"{len(unscored)} entr"
                   f"{'y was' if len(unscored) == 1 else 'ies were'} listed but "
                   f"NOT ranked: no value for the primary metric.")
        out.append("")

    out.append("### How ties were decided")
    out.append("")
    out.append(_tie_paragraph(ranking))
    out.append("")

    out.append("### Contrastive entries")
    out.append("")
    contrastive = ranking.get("contrastive")
    if contrastive is None:
        out.append(f"A contrastive section is {NOT_RECORDED} for this "
                   f"contest — every entry above is reported as ranked.")
    elif isinstance(contrastive, dict) and isinstance(contrastive.get("entries"), list):
        out.append("Contrastive entries are reported, never ranked as winners.")
        out.append("")
        out.extend(_entries_table(contrastive["entries"], metric_label))
    elif isinstance(contrastive, list):
        out.append("Contrastive entries are reported, never ranked as winners.")
        out.append("")
        out.extend(_entries_table(contrastive, metric_label))
    else:
        out.append(f"`contrastive` has an unexpected shape "
                   f"({type(contrastive).__name__}); reported verbatim: "
                   f"{_fmt(contrastive)}")
    out.append("")

    out.append("### Exclusions")
    out.append("")
    excluded = ranking.get("exclusions")
    if excluded is None:
        excluded = ranking.get("excluded")
    if not isinstance(excluded, list):
        out.append(f"Exclusions are {NOT_RECORDED}.")
    elif not excluded:
        out.append("Nothing was excluded from this ranking.")
    else:
        out.append("| Run card | Reason |")
        out.append("|---|---|")
        for x in excluded:
            if not isinstance(x, dict):
                out.append(f"| — | {_fmt(x)} |")
                continue
            out.append(f"| `{_fmt(x.get('run_card_id'))}` | "
                       f"{_fmt(x.get('reason'))} |")
    out.append("")

    out.append("### Prize terms and eligibility")
    out.append("")
    out.append(PRIZE_RULE)
    out.append("")
    out.extend(_prize_terms_section(ranking))
    out.append("")
    eligibility = ranking.get("prize_eligibility")
    if eligibility is None:
        out.append(f"Per-entry prize eligibility is {NOT_RECORDED} for this "
                   f"contest. No prize claim can be read out of this report.")
    else:
        out.extend(_prize_gate_table(ranking, eligibility))
    out.append("")

    out.append("### Deferred results")
    out.append("")
    deferred = ranking.get("deferred_results")
    if deferred is None:
        out.append(f"Deferred results are {NOT_RECORDED} for this contest.")
    elif isinstance(deferred, list):
        out.append(f"{len(deferred)} result(s) were withheld until close and "
                   f"published by it.")
    elif isinstance(deferred, dict):
        count = deferred.get("count", len(deferred.get("items") or []))
        out.append(f"{_fmt(count)} result(s) were withheld until close and "
                   f"published by it.")
    else:
        out.append(f"{_fmt(deferred)} (as recorded).")
    out.append("")

    out.append("### Execution facts")
    out.append("")
    out.extend(_execution_summary(entries))
    out.append("")

    out.append("### System descriptions")
    out.append("")
    out.extend(_descriptions_section(rows, unavailable))
    out.append("")
    return out


def _summary_table(contests: list[dict]) -> list[str]:
    out = ["| Pair | Contest | Corpus card | Ranked entries | Ranking frozen |",
           "|---|---|---|---|---|"]
    for c in contests:
        ranking = c.get("metadata", {}).get("final_ranking") or {}
        entries = ranking.get("entries")
        n = len(entries) if isinstance(entries, list) else NOT_RECORDED
        out.append(f"| {_fmt(c.get('language_pair'))} | `{c['id']}` | "
                   f"`{_fmt(c.get('corpus_id'))}` | {_fmt(n)} | "
                   f"{_fmt(_get(ranking, 'frozen_at'))} |")
    return out


def report_edition(shared_task_id: str, *, out_dir: str) -> Path:
    """Write the edition's Findings-style report and return the file path.

    Frozen snapshots ONLY. Every member contest must be closed with a frozen
    ``metadata.final_ranking``; an open contest is refused by name, because a
    report built over a moving ranking would be wrong the moment it was read.
    Nothing here recomputes a score — the report transcribes what the close
    froze, plus the participants' own descriptions verbatim.
    """
    edition = fetch_shared_task(shared_task_id)
    contests = _fetch_member_contests(shared_task_id)
    if not contests:
        raise SharedTaskError(
            f"shared task {shared_task_id!r} has no contests attached — "
            f"attach each per-pair contest with `mt-eval contest prepare … "
            f"--shared-task {shared_task_id}` before reporting an edition.")

    open_contests = [c for c in contests if c.get("status") != "closed"]
    if open_contests:
        listed = ", ".join(f"{c['id']} ({c.get('status')})"
                           for c in open_contests)
        raise SharedTaskError(
            f"refusing to report edition {shared_task_id!r}: "
            f"{len(open_contests)} of {len(contests)} contest(s) are not "
            f"closed — {listed}. An edition report is built from FROZEN "
            f"rankings only; close each contest first "
            f"(`mt-eval contest close <id>`).")

    unfrozen = [c["id"] for c in contests
                if not isinstance((c.get("metadata") or {}).get("final_ranking"), dict)]
    if unfrozen:
        raise SharedTaskError(
            f"refusing to report edition {shared_task_id!r}: contest(s) "
            f"{', '.join(unfrozen)} are closed but carry no "
            f"metadata.final_ranking snapshot. That is a defect, not an "
            f"empty edition — a close writes the snapshot in the same "
            f"update that sets status=closed (migration 074).")

    for c in contests:
        if not isinstance(c.get("metadata"), dict):
            c["metadata"] = {}

    generated_at = _report_ts()
    lines: list[str] = []
    lines.append(f"# {edition.get('name') or shared_task_id} — findings")
    lines.append("")
    lines.append(f"**{_fmt(edition.get('organizer'))}** · "
                 f"{_fmt(edition.get('year'))} cycle · edition "
                 f"`{shared_task_id}` · {len(contests)} language pair"
                 f"{'' if len(contests) == 1 else 's'}")
    lines.append("")
    if (edition.get("description") or "").strip():
        lines.append(edition["description"].strip())
        lines.append("")
    lines.append(f"Generated {generated_at} by mt-eval-harness "
                 f"{HARNESS_VERSION}.")
    lines.append("")

    lines.append("## How to read this report")
    lines.append("")
    lines.append(
        "Every number below was transcribed from a FROZEN ranking snapshot — "
        "the one each contest's close wrote and the database made immutable. "
        "This report recomputes nothing and re-ranks nothing. Where a "
        "snapshot does not carry a field, the report says "
        f"\"{NOT_RECORDED}\" rather than filling it in.")
    lines.append("")
    lines.append(
        "No human judgment appears anywhere in this report. Automatic metrics "
        "are proxies; a human-evaluation SELECTION (which systems a budget "
        "would cover) can be recorded, but no ratings exist — community "
        "validation is a separate lane.")
    lines.append("")
    lines.append("Participants' system descriptions are reproduced verbatim.")
    lines.append("")

    lines.append("## Edition summary")
    lines.append("")
    lines.extend(_summary_table(contests))
    lines.append("")
    lines.append(f"Edition policy defaults: authorization model "
                 f"{_fmt(edition.get('default_authorization_model'))}, "
                 f"intake daily limit "
                 f"{_fmt(edition.get('default_intake_daily_limit'))}. "
                 f"Defaults only — every gate is per contest.")
    lines.append("")

    for contest in contests:
        lines.extend(_contest_section(contest))

    lines.append("---")
    lines.append("")
    lines.append(f"Report generated {generated_at} from frozen snapshots by "
                 f"`mt-eval shared-task report {shared_task_id}` "
                 f"(mt-eval-harness {HARNESS_VERSION}).")
    lines.append("")

    directory = Path(out_dir)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{shared_task_id}-findings.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


_HTTPS_RE = re.compile(r"^https://[^\s]+$")


def set_report_url(shared_task_id: str, url: str) -> dict:
    """Record where the edition report is published (migration 074).

    ``shared_tasks.report_url`` + ``report_generated_at`` are the two columns
    the public page reads to offer a report link. HTTPS only, and the row must
    already exist. A stack without 074 has neither column; PostgREST's own
    message is surfaced verbatim rather than swallowed, because "the report
    link silently did nothing" is exactly the failure this rule forbids.
    """
    fetch_shared_task(shared_task_id)
    url = (url or "").strip()
    if not _HTTPS_RE.match(url):
        raise SharedTaskError(
            f"--set-url must be an https:// URL (got {url!r}) — the report "
            f"link is served to the public site.")

    generated_at = _report_ts()
    from mt_eval_harness.sovereign_service import service_request
    try:
        rows = service_request("PATCH", "shared_tasks", params={
            "shared_task_id": f"eq.{shared_task_id}",
        }, data={"report_url": url, "report_generated_at": generated_at})
    except RuntimeError as exc:
        raise SharedTaskError(
            f"could not record the report URL on {shared_task_id!r}. The "
            f"database said, verbatim:\n    {exc}\n  (shared_tasks."
            f"report_url / report_generated_at arrive with migration 074 — "
            f"apply it to this stack first.)") from exc
    if not rows:
        raise SharedTaskError(
            f"the report URL PATCH on {shared_task_id!r} matched no row.")
    return rows[0] if isinstance(rows, list) else rows
