"""local_ledger — hash-chained authorization ledger for the air gap.

The Supabase-free mirror of the Wave-1 authorization backbone, for a node
with NO network at all: one append-only JSONL file whose rows are
hash-chained exactly on the migration-040 design, plus the migration-039
grant semantics (time-boxed, single-use, fingerprint-bound, no grant
without an authorized request) enforced by event replay.

CHAIN RECIPE (mirrors 040's trigger; recompute-and-compare to audit):

    row_hash = sha256( prev_hash | event_type | sealed_set_id | request_id |
                       grant_id | actor | fingerprint | detail_canonical |
                       created_at ) as lowercase hex
    prev_hash of the first row = 64 zeros (genesis)

with every absent field rendered as the empty string, fields joined by '|',
``created_at`` as UTC ``YYYY-MM-DDTHH:MM:SS.ffffff`` (the same rendering
040's to_char produces), and ``detail_canonical`` = compact JSON with
sorted keys (``json.dumps(detail, sort_keys=True, separators=(',',':'),
ensure_ascii=False)``). That last rule is the one DOCUMENTED divergence
from Postgres (jsonb::text renders spaces after ':' and ','): the two
ledgers share the chain DESIGN, not byte-identical detail rendering — an
inspector replaying either chain uses that ledger's stated canonicalization.

Appends are serialized with an exclusive ``flock`` on the ledger file (the
local analogue of 040's advisory lock), and single-use grant claims hold the
same lock across read-replay-append so two concurrent claims cannot both
succeed. Tamper-evidence, honestly stated: a node operator with the disk
could rewrite the WHOLE chain from some point; what they cannot do is
rewrite history that anyone else has anchored — publish/copy the ``head()``
digest outward (it is embedded in every signed score manifest) and any
silent edit is detectable, exactly the 040 posture.

The event vocabulary is CLOSED and identical to migration 040 — the two
ledgers must stay mutually replayable.
"""

from __future__ import annotations

import fcntl
import hashlib
import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

__all__ = ["LedgerError", "GENESIS_HASH", "EVENT_TYPES", "LocalLedger"]

GENESIS_HASH = "0" * 64

# Closed vocabulary — identical to migration 040's CHECK constraint.
EVENT_TYPES = frozenset({
    "request_created",
    "vote_cast",
    "request_authorized",
    "request_denied",
    "request_expired",
    "grant_minted",
    "grant_used",
    "grant_expired",
    "single_party_attempt_blocked",
})


class LedgerError(RuntimeError):
    """A ledger operation that must not proceed — always with the reason."""


def _canonical_detail(detail: dict | None) -> str:
    if detail is None:
        return ""
    return json.dumps(detail, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False)


def _created_at_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")


def _row_payload(prev_hash: str, entry: dict) -> str:
    return "|".join([
        prev_hash,
        entry.get("event_type") or "",
        entry.get("sealed_set_id") or "",
        entry.get("request_id") or "",
        entry.get("grant_id") or "",
        entry.get("actor") or "",
        entry.get("fingerprint") or "",
        _canonical_detail(entry.get("detail")),
        entry.get("created_at") or "",
    ])


class LocalLedger:
    """One hash-chained JSONL ledger file (created on first append)."""

    def __init__(self, path: str | Path):
        self.path = Path(path).expanduser()

    # -- locking ------------------------------------------------------------

    @contextmanager
    def _locked(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # a+ creates the file if absent; flock serializes appends AND claims.
        with open(self.path, "a+", encoding="utf-8") as fh:
            fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
            try:
                yield fh
            finally:
                fcntl.flock(fh.fileno(), fcntl.LOCK_UN)

    # -- reading ------------------------------------------------------------

    def entries(self) -> list[dict]:
        if not self.path.exists():
            return []
        out: list[dict] = []
        with open(self.path, encoding="utf-8") as fh:
            for line_no, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise LedgerError(
                        f"{self.path}:{line_no} is not valid JSON ({exc}) — "
                        f"the ledger is damaged; verify_chain() and restore "
                        f"from the anchored head.") from exc
        return out

    def head(self) -> str:
        entries = self.entries()
        return entries[-1]["row_hash"] if entries else GENESIS_HASH

    def verify_chain(self) -> dict:
        """Replay the chain; report {ok, entries, first_bad, reason}."""
        prev = GENESIS_HASH
        entries = self.entries()
        for i, entry in enumerate(entries):
            if entry.get("prev_hash") != prev:
                return {"ok": False, "entries": len(entries), "first_bad": i,
                        "reason": f"entry {i} prev_hash does not point at "
                                  f"the preceding row (chain break)"}
            expect = hashlib.sha256(
                _row_payload(prev, entry).encode("utf-8")).hexdigest()
            if entry.get("row_hash") != expect:
                return {"ok": False, "entries": len(entries), "first_bad": i,
                        "reason": f"entry {i} row_hash does not recompute "
                                  f"from its fields (tampered or corrupted)"}
            prev = entry["row_hash"]
        return {"ok": True, "entries": len(entries), "first_bad": None,
                "reason": None}

    # -- appending ----------------------------------------------------------

    def append(self, event_type: str, *, sealed_set_id: str | None = None,
               request_id: str | None = None, grant_id: str | None = None,
               actor: str | None = None, fingerprint: str | None = None,
               detail: dict | None = None) -> dict:
        if event_type not in EVENT_TYPES:
            raise LedgerError(
                f"Unknown event_type {event_type!r} — the vocabulary is "
                f"closed (migration 040 parity): {sorted(EVENT_TYPES)}")
        with self._locked() as fh:
            entry = self._append_locked(
                fh, event_type, sealed_set_id=sealed_set_id,
                request_id=request_id, grant_id=grant_id, actor=actor,
                fingerprint=fingerprint, detail=detail)
        return entry

    def _append_locked(self, fh, event_type: str, **fields) -> dict:
        entries = self.entries()
        prev = entries[-1]["row_hash"] if entries else GENESIS_HASH
        entry = {
            "id": (entries[-1]["id"] + 1) if entries else 1,
            "event_type": event_type,
            "sealed_set_id": fields.get("sealed_set_id"),
            "request_id": fields.get("request_id"),
            "grant_id": fields.get("grant_id"),
            "actor": fields.get("actor"),
            "fingerprint": fields.get("fingerprint"),
            "detail": fields.get("detail"),
            "created_at": _created_at_now(),
            "prev_hash": prev,
        }
        entry["row_hash"] = hashlib.sha256(
            _row_payload(prev, entry).encode("utf-8")).hexdigest()
        fh.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")
        fh.flush()
        return entry

    # -- request/grant state (migration 038/039 semantics by replay) --------

    def replay_state(self) -> dict:
        """Derive request + grant state from the event log (event-sourced —
        the ledger is the ONLY store; no mutable state file to diverge)."""
        requests: dict[str, dict] = {}
        grants: dict[str, dict] = {}
        for e in self.entries():
            et, rid, gid = e["event_type"], e.get("request_id"), e.get("grant_id")
            if et == "request_created" and rid:
                requests[rid] = {"state": "pending",
                                 "sealed_set_id": e.get("sealed_set_id"),
                                 "fingerprint": e.get("fingerprint"),
                                 "votes": []}
            elif et == "vote_cast" and rid and rid in requests:
                requests[rid]["votes"].append(
                    {"actor": e.get("actor"), "detail": e.get("detail")})
            elif et == "request_authorized" and rid and rid in requests:
                requests[rid]["state"] = "authorized"
            elif et == "request_denied" and rid and rid in requests:
                requests[rid]["state"] = "denied"
            elif et == "request_expired" and rid and rid in requests:
                requests[rid]["state"] = "expired"
            elif et == "grant_minted" and gid:
                grants[gid] = {"request_id": rid,
                               "sealed_set_id": e.get("sealed_set_id"),
                               "fingerprint": e.get("fingerprint"),
                               "expires_at": (e.get("detail") or {}).get("expires_at"),
                               "used": False, "used_by": None}
            elif et in ("grant_used", "grant_expired") and gid and gid in grants:
                grants[gid]["used"] = (et == "grant_used") or grants[gid]["used"]
                if et == "grant_used":
                    grants[gid]["used_by"] = (e.get("detail") or {}).get("node")
        return {"requests": requests, "grants": grants}

    # The 039 semantics, locally: no grant without an authorized request;
    # fingerprint-bound; future expiry; single-use claim under the lock.

    def mint_grant(self, request_id: str, *, ttl_seconds: int,
                   actor: str) -> dict:
        with self._locked() as fh:
            state = self.replay_state()
            req = state["requests"].get(request_id)
            if req is None:
                raise LedgerError(
                    f"LOCAL GRANT GUARD: no request {request_id!r} in the "
                    f"ledger — a grant cannot be minted for a non-existent "
                    f"request.")
            if req["state"] != "authorized":
                raise LedgerError(
                    f"LOCAL GRANT GUARD: request {request_id} is "
                    f"'{req['state']}' (not authorized) — no grant may be "
                    f"minted until a quorum authorizes it.")
            if ttl_seconds <= 0:
                raise LedgerError("LOCAL GRANT GUARD: grant TTL must be a "
                                  "positive number of seconds.")
            grant_id = f"grant-{uuid.uuid4().hex}"
            expires_at = (datetime.now(timezone.utc)
                          + timedelta(seconds=ttl_seconds)).isoformat()
            self._append_locked(
                fh, "grant_minted", request_id=request_id,
                grant_id=grant_id, sealed_set_id=req["sealed_set_id"],
                fingerprint=req["fingerprint"], actor=actor,
                detail={"expires_at": expires_at,
                        "ttl_seconds": ttl_seconds})
        return {"grant_id": grant_id, "request_id": request_id,
                "sealed_set_id": req["sealed_set_id"],
                "fingerprint": req["fingerprint"], "expires_at": expires_at}

    def claim_grant(self, grant_id: str, *, fingerprint: str,
                    node: str) -> dict:
        """Atomic single-use consume (claim_auth_grant parity): refuses a
        second use, an expired grant, or a fingerprint mismatch — and holds
        the file lock across read+append so concurrent claims serialize."""
        with self._locked() as fh:
            state = self.replay_state()
            grant = state["grants"].get(grant_id)
            if grant is None:
                raise LedgerError(f"LOCAL GRANT GUARD: no grant {grant_id!r}.")
            if grant["used"]:
                raise LedgerError(
                    f"LOCAL GRANT GUARD: grant {grant_id} is already used — "
                    f"grants are single-use; propose a fresh run.")
            expires = grant.get("expires_at")
            try:
                expired = (datetime.fromisoformat(expires)
                           <= datetime.now(timezone.utc))
            except (TypeError, ValueError):
                expired = True  # unparseable expiry = invalid grant
            if expired:
                self._append_locked(
                    fh, "grant_expired", grant_id=grant_id,
                    request_id=grant["request_id"],
                    sealed_set_id=grant["sealed_set_id"],
                    fingerprint=grant["fingerprint"],
                    detail={"expires_at": expires})
                raise LedgerError(
                    f"LOCAL GRANT GUARD: grant {grant_id} expired at "
                    f"{expires} — time-boxed grants are not renewable; "
                    f"propose a fresh run.")
            if grant["fingerprint"] != fingerprint:
                raise LedgerError(
                    f"LOCAL GRANT GUARD: grant {grant_id} is bound to a "
                    f"different request fingerprint — a grant authorizes "
                    f"exactly one (method, corpus version, node).")
            self._append_locked(
                fh, "grant_used", grant_id=grant_id,
                request_id=grant["request_id"],
                sealed_set_id=grant["sealed_set_id"],
                fingerprint=grant["fingerprint"],
                detail={"node": node})
        return {"grant_id": grant_id, "request_id": grant["request_id"],
                "sealed_set_id": grant["sealed_set_id"]}
