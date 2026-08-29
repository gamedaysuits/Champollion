"""fake_supabase — the shared in-memory PostgREST stand-in for node tests.

Extracted from tests/test_contest_node.py's FakeSupabase (Phase A) so the
Phase-B method-lane and airgap-transport tests reuse one fake instead of
drifting copies. Everything ABOVE the REST line stays real in those tests:
bundle packing/extraction, static checks, the (injected) container contract,
scoring, run-card assembly, grant sequencing.

Deliberately tiny: eq./in.() filters, POST/PATCH, an atomic
claim_auth_grant, an authorization_audit_head digest, and the offline mirror
of migration 043's one-way intake lifecycle. Unknown operators raise — the
fake is never silently permissive.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

# Legal one-way transitions — the offline mirror of migration 043.
LEGAL_INTAKE_TRANSITIONS = {
    "received": {"qualifier_checked", "rejected"},
    "qualifier_checked": {"pending_authorization", "scoring", "rejected"},
    "pending_authorization": {"scoring", "rejected"},
    "scoring": {"scored", "rejected"},
    "scored": {"published", "rejected"},
}

# The offline mirror of migration 038's request state machine.
LEGAL_REQUEST_TRANSITIONS = {
    "pending": {"authorized", "denied", "expired"},
    "authorized": {"expired"},
}


class FakeSupabase:
    """Just enough PostgREST to host the node's tables."""

    def __init__(self):
        self.tables: dict[str, list[dict]] = {
            "contests": [], "qualifiers": [], "contest_intake": [],
            "authorization_requests": [], "auth_grants": [],
            "authorization_audit_log": [], "run_cards": [],
            "contest_submissions": [], "sealed_sets": [],
        }
        self.status_history: dict[str, list[str]] = {}

    # -- param parsing ------------------------------------------------------
    @staticmethod
    def _matches(row: dict, params: dict) -> bool:
        for key, cond in (params or {}).items():
            if key in ("select", "order"):
                continue
            value = row.get(key)
            if cond.startswith("eq."):
                if str(value) != cond[3:]:
                    return False
            elif cond.startswith("in.(") and cond.endswith(")"):
                if str(value) not in cond[4:-1].split(","):
                    return False
            else:  # unknown operator — loud, not silently permissive
                raise AssertionError(f"fake does not implement {cond!r}")
        return True

    # -- the service_request replacement ------------------------------------
    def __call__(self, method, path, *, data=None, params=None, prefer=None,
                 timeout=None):
        if path.startswith("rpc/claim_auth_grant"):
            return self._claim(data)
        if path.startswith("rpc/authorization_audit_head"):
            # A stable digest over the current audit rows — enough for the
            # chain-continuity plumbing the airgap transport carries around.
            blob = json.dumps(self.tables["authorization_audit_log"],
                              sort_keys=True, default=str)
            return hashlib.sha256(blob.encode()).hexdigest()
        assert path in self.tables, f"unexpected table {path}"
        rows = self.tables[path]
        if method == "GET":
            return [dict(r) for r in rows if self._matches(r, params)]
        if method == "POST":
            new = [dict(d) for d in (data if isinstance(data, list) else [data])]
            for r in new:
                rows.append(r)
                if path == "contest_intake":
                    self.status_history.setdefault(
                        r["intake_id"], []).append(r.get("status", "received"))
                if path == "authorization_requests":
                    r.setdefault("state", "pending")
                    r.setdefault("emit", "scores-only")
            return new
        if method == "PATCH":
            hit = []
            for r in rows:
                if self._matches(r, params):
                    if path == "contest_intake" and "status" in data \
                            and data["status"] != r.get("status"):
                        old, new_s = r.get("status"), data["status"]
                        assert new_s in LEGAL_INTAKE_TRANSITIONS.get(old, set()), (
                            f"ILLEGAL transition {old} -> {new_s} — the real "
                            f"DB trigger (043) would have refused this")
                        if new_s == "rejected":
                            assert (data.get("reject_reason")
                                    or r.get("reject_reason")), \
                                "rejected without a reason"
                        self.status_history[r["intake_id"]].append(new_s)
                    if path == "authorization_requests" and "state" in data \
                            and data["state"] != r.get("state"):
                        old, new_s = r.get("state"), data["state"]
                        assert new_s in LEGAL_REQUEST_TRANSITIONS.get(old, set()), (
                            f"ILLEGAL request transition {old} -> {new_s} — "
                            f"the real DB trigger (038) would have refused")
                    r.update(data)
                    hit.append(dict(r))
            return hit
        raise AssertionError(f"unexpected {method} {path}")

    def _claim(self, args):
        for g in self.tables["auth_grants"]:
            if (g["grant_id"] == args["p_grant_id"]
                    and not g.get("used")
                    and g["fingerprint"] == args["p_fingerprint"]):
                exp = datetime.fromisoformat(g["expires_at"])
                if exp <= datetime.now(timezone.utc):
                    return []
                g["used"] = True
                g["used_by"] = args["p_node"]
                return [{"grant_id": g["grant_id"],
                         "sealed_set_id": g["sealed_set_id"],
                         "request_id": g["request_id"]}]
        return []

    # -- helpers -------------------------------------------------------------
    def audit_types(self) -> list[str]:
        return [e["event_type"] for e in self.tables["authorization_audit_log"]]

    def intake(self, intake_id: str) -> dict:
        return next(r for r in self.tables["contest_intake"]
                    if r["intake_id"] == intake_id)

    def request(self, request_id: str) -> dict:
        return next(r for r in self.tables["authorization_requests"]
                    if r["request_id"] == request_id)


def patch_service_layer(monkeypatch, fake: FakeSupabase, *modules):
    """Route sovereign_service (+ any modules that imported its names) through
    the fake — the Phase-A wiring pattern, shared."""
    import mt_eval_harness.sovereign_service as svc

    def fake_rpc(name, args, **kw):
        return fake("POST", f"rpc/{name}", data=args)

    monkeypatch.setattr(svc, "service_request", fake)
    monkeypatch.setattr(svc, "rpc", fake_rpc)
    monkeypatch.setattr(svc, "service_key", lambda: "test-service-key")
    for mod in modules:
        if hasattr(mod, "service_request"):
            monkeypatch.setattr(mod, "service_request", fake)
        if hasattr(mod, "rpc"):
            monkeypatch.setattr(mod, "rpc", fake_rpc)
        if hasattr(mod, "append_audit_event"):
            monkeypatch.setattr(
                mod, "append_audit_event",
                lambda event_type, **kw: fake(
                    "POST", "authorization_audit_log",
                    data={"event_type": event_type, **kw}))
        if hasattr(mod, "service_key"):
            monkeypatch.setattr(mod, "service_key",
                                lambda: "test-service-key")
