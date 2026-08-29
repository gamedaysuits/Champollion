"""sealed_run — the M2 acceptance property, end to end on synthetic data.

The plan's key acceptance test (the sovereign multisig plan, Part 5 Phase 2/3),
against the LOCAL ledger: a single party attempting to open a sealed set
is BLOCKED and the attempt is LOGGED tamper-evidently; a real quorum
authorizes, mints + claims a single-use grant, decrypts INSIDE the run
scratch only, and teardown leaves no plaintext behind (verified by
grepping the workspace for the synthetic sentinel).
"""

from __future__ import annotations

import json

import pytest

pytest.importorskip(
    "cryptography",
    reason="sovereign threshold lane needs the cryptography library "
           "(pip install 'mt-eval[node]')")

from mt_eval_harness.sandbox_runner import wipe_tree
from mt_eval_harness.sovereign.ceremony import init_ceremony
from mt_eval_harness.sovereign.local_ledger import LocalLedger
from mt_eval_harness.sovereign.sealed_run import (
    SealedRunError,
    quorum_unseal_for_run,
)
from mt_eval_harness.sovereign.threshold_seal import seal_corpus_to_artifact

SET_ID = "eval-synth-sealedrun-v1"
GROUP = "synth-council"
NODE = "test-sovereign-node"
METHOD_SHA = "ab" * 32
SENTINEL = "zolvatu-sentinel"   # invented token; must never survive teardown


@pytest.fixture
def sealed_world(tmp_path):
    record = init_ceremony(tmp_path / "cer", sealed_set_id=SET_ID,
                           custodian_group_id=GROUP, m=3, n=5)
    shares = sorted((tmp_path / "cer" / "shares").glob("share-*.json"))
    corpus = tmp_path / "synthetic-corpus.json"
    corpus.write_text(json.dumps([
        {"id": 0, "source": f"The {SENTINEL} rests.",
         "target": f"SYN {SENTINEL} ripoza.", "segment": "held_out"},
        {"id": 1, "source": "Second synthetic line.",
         "target": "SYN dua linio.", "segment": "held_out"},
    ]), encoding="utf-8")
    out = seal_corpus_to_artifact(
        corpus, {"publicKeyDerB64": record["publicKeyDerB64"]},
        card_id=SET_ID, custodian_group_id=GROUP,
        out_dir=tmp_path / "sealed", key_scheme=record["keyScheme"])
    corpus.unlink()  # the community keeps its copy elsewhere; node has ciphertext only
    return {
        "record": record, "shares": shares,
        "artifact_path": out["artifact_path"],
        "ledger": LocalLedger(tmp_path / "ledger.jsonl"),
        "scratch": tmp_path / "workspace" / "scratch",
        "tmp": tmp_path,
    }


def _events(ledger):
    return [e["event_type"] for e in ledger.entries()]


class TestSinglePartyAttempt:
    def test_no_shares_blocked_and_logged(self, sealed_world):
        w = sealed_world
        with pytest.raises(SealedRunError, match="cannot open a sealed set"):
            quorum_unseal_for_run(
                artifact_path=w["artifact_path"], share_paths=[],
                ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
                corpus_version="v1", requested_by="platform-alone",
                scratch_dir=w["scratch"])
        events = _events(w["ledger"])
        assert "single_party_attempt_blocked" in events
        assert "request_denied" in events
        assert "grant_minted" not in events
        assert w["ledger"].verify_chain()["ok"]
        # Nothing decrypted anywhere.
        assert not list(w["scratch"].glob("*")) if w["scratch"].exists() else True

    def test_sub_quorum_blocked_and_logged(self, sealed_world):
        w = sealed_world
        with pytest.raises(SealedRunError, match="Quorum not met"):
            quorum_unseal_for_run(
                artifact_path=w["artifact_path"],
                share_paths=w["shares"][:2],
                ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
                corpus_version="v1", requested_by="two-custodians",
                scratch_dir=w["scratch"])
        events = _events(w["ledger"])
        # The two custodians' votes ARE recorded, then the block.
        assert events.count("vote_cast") == 2
        assert "single_party_attempt_blocked" in events
        blocked = [e for e in w["ledger"].entries()
                   if e["event_type"] == "single_party_attempt_blocked"][0]
        assert blocked["detail"]["presented"] == 2
        assert blocked["detail"]["required"] == 3

    def test_wrong_ceremony_shares_blocked(self, sealed_world, tmp_path):
        w = sealed_world
        init_ceremony(tmp_path / "other", sealed_set_id="eval-other-v1",
                      custodian_group_id="other-council", m=3, n=5)
        other_shares = sorted((tmp_path / "other" / "shares").glob("*.json"))
        with pytest.raises(SealedRunError, match="wrong ceremony"):
            quorum_unseal_for_run(
                artifact_path=w["artifact_path"],
                share_paths=other_shares[:3],
                ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
                corpus_version="v1", requested_by="wrong-council",
                scratch_dir=w["scratch"])
        assert "single_party_attempt_blocked" in _events(w["ledger"])


class TestQuorumRun:
    def test_full_flow_grant_decrypt_teardown(self, sealed_world):
        w = sealed_world
        quorum = [w["shares"][0], w["shares"][2], w["shares"][4]]
        result = quorum_unseal_for_run(
            artifact_path=w["artifact_path"], share_paths=quorum,
            ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
            corpus_version="v1", requested_by="researcher@example.test",
            scratch_dir=w["scratch"])

        # Decrypted INSIDE the workspace, correct content, 0600.
        from pathlib import Path
        corpus_path = Path(result["corpus_path"])
        assert corpus_path.is_file()
        assert corpus_path.parent == w["scratch"]
        assert (corpus_path.stat().st_mode & 0o777) == 0o600
        entries = json.loads(corpus_path.read_text())
        assert SENTINEL in entries[0]["source"]

        # The canonical event sequence, chained.
        events = _events(w["ledger"])
        assert events == ["request_created", "vote_cast", "vote_cast",
                          "vote_cast", "request_authorized", "grant_minted",
                          "grant_used"]
        assert w["ledger"].verify_chain()["ok"]
        assert result["ledger_head"] == w["ledger"].head()
        assert result["m"] == 3 and result["presented"] == 3

        # Single-use: the SAME grant cannot be claimed again.
        from mt_eval_harness.sovereign.local_ledger import LedgerError
        with pytest.raises(LedgerError, match="already used"):
            w["ledger"].claim_grant(result["grant_id"],
                                    fingerprint=result["fingerprint"],
                                    node=NODE)

        # §8 teardown: wipe the workspace, then grep for the sentinel.
        workspace = w["tmp"] / "workspace"
        wipe_tree(workspace)
        assert not workspace.exists()
        leftovers = []
        for p in w["tmp"].rglob("*"):
            if p.is_file() and SENTINEL.encode() in p.read_bytes():
                leftovers.append(p)
        # The ONLY place the sentinel may appear is nowhere: the artifact is
        # ciphertext, the ledger is content-free, shares are key material.
        assert leftovers == [], f"plaintext survived teardown: {leftovers}"

    def test_second_run_needs_a_fresh_request_and_grant(self, sealed_world):
        w = sealed_world
        quorum = w["shares"][:3]
        first = quorum_unseal_for_run(
            artifact_path=w["artifact_path"], share_paths=quorum,
            ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
            corpus_version="v1", requested_by="r@example.test",
            scratch_dir=w["scratch"])
        second = quorum_unseal_for_run(
            artifact_path=w["artifact_path"], share_paths=quorum,
            ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
            corpus_version="v1", requested_by="r@example.test",
            scratch_dir=w["scratch"])
        assert first["grant_id"] != second["grant_id"]
        assert first["request_id"] != second["request_id"]
        # Same target → same fingerprint (deterministic binding)…
        assert first["fingerprint"] == second["fingerprint"]
        # …but each evaluation batch consumed its own single-use grant.
        state = w["ledger"].replay_state()
        assert all(g["used"] for g in state["grants"].values())
        assert len(state["grants"]) == 2

    def test_ledger_records_are_content_free(self, sealed_world):
        w = sealed_world
        quorum_unseal_for_run(
            artifact_path=w["artifact_path"], share_paths=w["shares"][:3],
            ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
            corpus_version="v1", requested_by="r@example.test",
            scratch_dir=w["scratch"])
        assert SENTINEL.encode() not in w["ledger"].path.read_bytes()
