"""local_ledger — chain integrity + the migration-039 grant guards, locally.

Every guard that 039 enforces with triggers must hold here by replay: no
grant without an authorized request, fingerprint binding, future expiry,
single-use claims, and the 040 chain (append-only recompute, tamper
detection, publishable head).
"""

from __future__ import annotations

import json
import time

import pytest

from mt_eval_harness.sovereign.local_ledger import (
    EVENT_TYPES,
    GENESIS_HASH,
    LedgerError,
    LocalLedger,
)


@pytest.fixture
def ledger(tmp_path):
    return LocalLedger(tmp_path / "ledger" / "authorization-ledger.jsonl")


def _seed_request(ledger, request_id="authreq-local-1",
                  fingerprint="f" * 64, authorized=True):
    ledger.append("request_created", sealed_set_id="eval-synth-v1",
                  request_id=request_id, actor="requester@example.test",
                  fingerprint=fingerprint,
                  detail={"lane": "local-sealed-run"})
    if authorized:
        ledger.append("request_authorized", sealed_set_id="eval-synth-v1",
                      request_id=request_id, actor="custodian-quorum",
                      fingerprint=fingerprint,
                      detail={"quorum": "3-of-5"})
    return request_id, fingerprint


class TestChain:
    def test_empty_head_is_genesis(self, ledger):
        assert ledger.head() == GENESIS_HASH
        assert ledger.verify_chain() == {"ok": True, "entries": 0,
                                         "first_bad": None, "reason": None}

    def test_chain_links_and_verifies(self, ledger):
        _seed_request(ledger)
        ledger.append("vote_cast", request_id="authreq-local-1",
                      actor="elder-a", detail={"vote": "approve"})
        entries = ledger.entries()
        assert entries[0]["prev_hash"] == GENESIS_HASH
        assert entries[1]["prev_hash"] == entries[0]["row_hash"]
        assert ledger.head() == entries[-1]["row_hash"]
        assert ledger.verify_chain()["ok"] is True

    def test_tampered_field_breaks_the_chain(self, ledger):
        _seed_request(ledger)
        lines = ledger.path.read_text().splitlines()
        doctored = json.loads(lines[0])
        doctored["actor"] = "someone-else"       # silent history edit
        lines[0] = json.dumps(doctored, sort_keys=True)
        ledger.path.write_text("\n".join(lines) + "\n")
        report = ledger.verify_chain()
        assert report["ok"] is False and report["first_bad"] == 0
        assert "recompute" in report["reason"]

    def test_deleted_row_breaks_the_chain(self, ledger):
        _seed_request(ledger)
        ledger.append("vote_cast", request_id="authreq-local-1",
                      actor="elder-a", detail={"vote": "approve"})
        lines = ledger.path.read_text().splitlines()
        ledger.path.write_text("\n".join([lines[0], lines[2]]) + "\n")
        assert ledger.verify_chain()["ok"] is False

    def test_vocabulary_is_closed(self, ledger):
        with pytest.raises(LedgerError, match="closed"):
            ledger.append("request_approved_maybe")
        assert "single_party_attempt_blocked" in EVENT_TYPES


class TestGrantGuards:
    def test_no_grant_without_authorized_request(self, ledger):
        rid, _ = _seed_request(ledger, authorized=False)
        with pytest.raises(LedgerError, match="not authorized"):
            ledger.mint_grant(rid, ttl_seconds=60, actor="node:n1")
        with pytest.raises(LedgerError, match="non-existent"):
            ledger.mint_grant("authreq-ghost", ttl_seconds=60,
                              actor="node:n1")

    def test_denied_request_cannot_mint(self, ledger):
        rid, _ = _seed_request(ledger, authorized=False)
        ledger.append("request_denied", request_id=rid,
                      actor="custodian-quorum", detail={"reason": "no"})
        with pytest.raises(LedgerError, match="denied"):
            ledger.mint_grant(rid, ttl_seconds=60, actor="node:n1")

    def test_mint_claim_single_use(self, ledger):
        rid, fp = _seed_request(ledger)
        grant = ledger.mint_grant(rid, ttl_seconds=60, actor="node:n1")
        claimed = ledger.claim_grant(grant["grant_id"], fingerprint=fp,
                                     node="n1")
        assert claimed["request_id"] == rid
        with pytest.raises(LedgerError, match="already used"):
            ledger.claim_grant(grant["grant_id"], fingerprint=fp, node="n1")
        state = ledger.replay_state()
        assert state["grants"][grant["grant_id"]]["used"] is True
        assert state["grants"][grant["grant_id"]]["used_by"] == "n1"

    def test_fingerprint_binding(self, ledger):
        rid, fp = _seed_request(ledger)
        grant = ledger.mint_grant(rid, ttl_seconds=60, actor="node:n1")
        with pytest.raises(LedgerError, match="different request fingerprint"):
            ledger.claim_grant(grant["grant_id"], fingerprint="e" * 64,
                               node="n1")
        # The failed claim did NOT consume it.
        ledger.claim_grant(grant["grant_id"], fingerprint=fp, node="n1")

    def test_time_box(self, ledger):
        rid, fp = _seed_request(ledger)
        grant = ledger.mint_grant(rid, ttl_seconds=1, actor="node:n1")
        time.sleep(1.1)
        with pytest.raises(LedgerError, match="expired"):
            ledger.claim_grant(grant["grant_id"], fingerprint=fp, node="n1")
        # The expiry itself is a logged event.
        assert ledger.entries()[-1]["event_type"] == "grant_expired"
        with pytest.raises(LedgerError, match="TTL"):
            ledger.mint_grant(rid, ttl_seconds=0, actor="node:n1")

    def test_grant_events_carry_the_binding(self, ledger):
        rid, fp = _seed_request(ledger)
        grant = ledger.mint_grant(rid, ttl_seconds=60, actor="node:n1")
        minted = [e for e in ledger.entries()
                  if e["event_type"] == "grant_minted"][0]
        assert minted["fingerprint"] == fp
        assert minted["grant_id"] == grant["grant_id"]
        assert minted["detail"]["expires_at"] == grant["expires_at"]
