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


#: What an organizer outside the project can actually do without the key.
#: The old text asked for "the service_role key of the DEV branch project" —
#: internal wording no outside organizer can act on (synthetic organizer
#: persona, `mt-eval node list`, 2026-10-03). Round 4 (synthetic researcher):
#: it was also the ONLY answer an air-gapped node got from `node list` /
#: `node approve`, which had no offline form — they now do (`--offline`), so
#: the message points there first and stays short. It is raised once, by the
#: first call that needs the key (service_key), and only from commands that
#: read or write the contest database; no offline command reaches it.
NO_SERVICE_KEY_MESSAGE = (
    "MT_EVAL_SUPABASE_SERVICE_KEY is not set, and this command reads or "
    "updates the contest database with that database's service-role key.\n"
    "  • Air-gapped / no database: add --offline — `mt-eval node list "
    "--offline`, `mt-eval node approve <request> --offline --actor <you>` "
    "(or `deny`), `mt-eval node run-method <request> --offline`; requests "
    "arrive with `node import-bundle` (or `node stage-request`).\n"
    "  • Your own contest database: set MT_EVAL_SUPABASE_URL to it and "
    "MT_EVAL_SUPABASE_SERVICE_KEY to its service-role key (keep it on this "
    "machine).\n"
    "  • Registering a contest needs no service key: `mt-eval contest "
    "prepare … --self-serve` (or `contest register`) signs in as you.\n"
    "  See champollion.dev/docs/network/sovereignty/sovereign-eval-node"
)


def service_key() -> str:
    key = os.environ.get("MT_EVAL_SUPABASE_SERVICE_KEY", "").strip()
    if not key:
        raise ServiceConfigError(NO_SERVICE_KEY_MESSAGE)
    return key


def assert_not_prod() -> None:
    """Refuse to run organizer machinery against prod without explicit opt-in."""
    if _PROD_HOST in SUPABASE_URL and not os.environ.get("MT_EVAL_ALLOW_PROD"):
        raise ServiceConfigError(
            f"MT_EVAL_SUPABASE_URL points at Champollion's live database "
            f"({_PROD_HOST}), and organizer commands that write with a "
            f"service-role key refuse it unless MT_EVAL_ALLOW_PROD=1 is set, "
            f"so a test node never writes to the live board by accident. "
            f"Point MT_EVAL_SUPABASE_URL at your own contest database, or set "
            f"MT_EVAL_ALLOW_PROD=1 if you operate the live one and mean it."
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
        # PostgREST filters are written by hand ("id=eq.x", "select=a,b",
        # "order=created_at.asc"), so the values are NOT blanket-encoded — the
        # operators and commas are meaningful. But three characters do not
        # merely mis-filter, they TRUNCATE the request client-side: '#' starts
        # a fragment, '?' a second query, and a raw space ends the URL. A
        # value carrying one of those silently addresses a DIFFERENT row (seen
        # 2026-09-07: a "<id>#holdout" key read back the "<id>" row). Encode
        # exactly those.
        def _safe(v):
            return (str(v).replace("%", "%25").replace("#", "%23")
                    .replace("?", "%3F").replace(" ", "%20"))
        query = "&".join(f"{k}={_safe(v)}" for k, v in params.items())
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
