"""sovereign_service — service-role Supabase REST helpers for the organizer side.

The participant-facing modules (contest.py, publish.py) speak to Supabase as a
USER (anon key + OAuth JWT) and must never carry elevated credentials. The
ORGANIZER side — contest_prep.py registering qualifiers/sealed sets, and
contest_node.py advancing intake lifecycles, minting/claiming grants, and
appending audit events — is the "controlled context" the sovereign migrations
(037–044) anticipate: it authenticates with the service_role key, which
bypasses RLS but NOT the un-bypassable BEFORE triggers that carry every real
guarantee (one-way state machines, grant binding, append-only audit chain).

Credentials: MT_EVAL_SUPABASE_SERVICE_KEY (the verifier.py convention), against
MT_EVAL_SUPABASE_URL (auth.py). The service key is organizer-local — never
shipped, never committed, never sent to participants.

PROD SAFETY: same doctrine as publish.py — the sovereign tables exist only on
the dev/staging branch (migrations 037–044 are dev-only), and this module
refuses to touch the production project without the same explicit opt-in
(MT_EVAL_ALLOW_PROD) that gates leaderboard writes.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Optional

from mt_eval_harness.auth import SUPABASE_URL

# The production project host — mirror of publish.py's guard. The organizer
# node is dev-branch machinery; pointing it at prod is almost certainly a
# misconfiguration and needs the same explicit opt-in.
_PROD_HOST = "sjdomynysdljkbemupqa.supabase.co"


class ServiceConfigError(RuntimeError):
    """Missing/forbidden service configuration — fail loud, never guess."""


def service_key() -> str:
    key = os.environ.get("MT_EVAL_SUPABASE_SERVICE_KEY", "").strip()
    if not key:
        raise ServiceConfigError(
            "MT_EVAL_SUPABASE_SERVICE_KEY is not set. The organizer node / "
            "contest registration needs the service_role key of the DEV "
            "branch project (never prod, never shipped to participants)."
        )
    return key


def assert_not_prod() -> None:
    """Refuse to run organizer machinery against prod without explicit opt-in."""
    if _PROD_HOST in SUPABASE_URL and not os.environ.get("MT_EVAL_ALLOW_PROD"):
        raise ServiceConfigError(
            f"MT_EVAL_SUPABASE_URL points at the PRODUCTION project "
            f"({_PROD_HOST}) — the sovereign contest tables are dev-branch "
            f"only (migrations 037–044). Point MT_EVAL_SUPABASE_URL at the "
            f"dev branch, or set MT_EVAL_ALLOW_PROD=1 if this is genuinely "
            f"intended (founder go-ahead required)."
        )


def service_request(
    method: str,
    path: str,
    *,
    data: Optional[dict | list] = None,
    params: Optional[dict] = None,
    prefer: str = "return=representation",
    timeout: int = 30,
) -> Any:
    """A service-role request against the Supabase REST API (PostgREST).

    Returns parsed JSON (or None for empty bodies). Raises RuntimeError with
    the server's own message on HTTP errors — trigger RAISE EXCEPTIONs come
    back verbatim, which is exactly the loud failure we want surfaced.
    """
    assert_not_prod()
    key = service_key()

    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        query = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{query}"

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Supabase service API error ({e.code}): {detail}") from e
    except (urllib.error.URLError, OSError) as e:
        raise RuntimeError(f"Network error contacting Supabase: {e}") from e


def rpc(function: str, args: dict, *, timeout: int = 30) -> Any:
    """Call a PostgREST RPC (e.g. claim_auth_grant) with the service key."""
    return service_request("POST", f"rpc/{function}", data=args, timeout=timeout)


def append_audit_event(
    event_type: str,
    *,
    sealed_set_id: Optional[str] = None,
    request_id: Optional[str] = None,
    grant_id: Optional[str] = None,
    actor: Optional[str] = None,
    fingerprint: Optional[str] = None,
    detail: Optional[dict] = None,
) -> Any:
    """Append one event to the hash-chained authorization audit log (040).

    The chain trigger computes prev_hash/row_hash server-side (client values
    are overwritten), and the append-only trigger makes the row immutable —
    so this helper can stay a plain INSERT. `detail` must be content-free
    (ids, scores, verdicts — never corpus or hypothesis text).
    """
    row = {
        "event_type": event_type,
        "sealed_set_id": sealed_set_id,
        "request_id": request_id,
        "grant_id": grant_id,
        "actor": actor,
        "fingerprint": fingerprint,
        "detail": detail or {},
    }
    return service_request("POST", "authorization_audit_log", data=row)
