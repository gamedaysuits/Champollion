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
"""

from __future__ import annotations

import re
from typing import Optional

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
