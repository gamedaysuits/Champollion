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
           "(pip install 'mt-eval-harness[node]')")

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


# ---------------------------------------------------------------------------
# Contract D1 (2026-09-07): ONE ceremony opens every sealed split one
# authorized run covers — the contest's secret set AND its sealed holdout.
# Custodians convene once; the ledger records one request, one grant, and the
# ciphertext digest of BOTH artifacts.
# ---------------------------------------------------------------------------

HOLDOUT_SET_ID = "eval-synth-sealedrun-holdout-v1"
HOLDOUT_SENTINEL = "kirmavu-sentinel"


@pytest.fixture
def sealed_holdout(sealed_world, tmp_path):
    """A SECOND artifact sealed to the same key and custodian group."""
    corpus = tmp_path / "synthetic-holdout.json"
    corpus.write_text(json.dumps([
        {"id": 0, "source": f"A {HOLDOUT_SENTINEL} waits.",
         "target": f"SYN {HOLDOUT_SENTINEL} atendas.", "segment": "held_out"},
    ]), encoding="utf-8")
    out = seal_corpus_to_artifact(
        corpus, {"publicKeyDerB64": sealed_world["record"]["publicKeyDerB64"]},
        card_id=HOLDOUT_SET_ID, custodian_group_id=GROUP,
        out_dir=tmp_path / "sealed-holdout",
        key_scheme=sealed_world["record"]["keyScheme"])
    corpus.unlink()
    return out["artifact_path"]


class TestOneCeremonyTwoSplits:
    def test_one_quorum_opens_both_splits(self, sealed_world, sealed_holdout):
        w = sealed_world
        from pathlib import Path
        result = quorum_unseal_for_run(
            artifact_paths=[w["artifact_path"], sealed_holdout],
            share_paths=w["shares"][:3],
            ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
            corpus_version="v1", requested_by="r@example.test",
            scratch_dir=w["scratch"])

        # ONE request, ONE grant — the custodians were asked once.
        assert _events(w["ledger"]) == [
            "request_created", "vote_cast", "vote_cast", "vote_cast",
            "request_authorized", "grant_minted", "grant_used"]
        assert len(w["ledger"].replay_state()["grants"]) == 1

        # Both splits decrypted, each 0600 inside the run scratch.
        assert [s["role"] for s in result["sets"]] == ["main", "holdout"]
        assert [s["sealed_set_id"] for s in result["sets"]] == [
            SET_ID, HOLDOUT_SET_ID]
        assert result["corpus_path"] == result["sets"][0]["corpus_path"]
        assert result["corpus_paths"] == [s["corpus_path"]
                                          for s in result["sets"]]
        for spec in result["sets"]:
            p = Path(spec["corpus_path"])
            assert p.is_file() and (p.stat().st_mode & 0o777) == 0o600
            assert p.parent == w["scratch"]
        assert SENTINEL in Path(result["sets"][0]["corpus_path"]).read_text()
        assert HOLDOUT_SENTINEL in Path(
            result["sets"][1]["corpus_path"]).read_text()

    def test_ledger_records_both_artifact_digests(self, sealed_world,
                                                  sealed_holdout):
        w = sealed_world
        quorum_unseal_for_run(
            artifact_paths=[w["artifact_path"], sealed_holdout],
            share_paths=w["shares"][:3],
            ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
            corpus_version="v1", requested_by="r@example.test",
            scratch_dir=w["scratch"])
        entries = {e["event_type"]: e for e in w["ledger"].entries()}
        for event in ("request_created", "request_authorized"):
            arts = entries[event]["detail"]["artifacts"]
            assert [a["sealed_set_id"] for a in arts] == [SET_ID,
                                                          HOLDOUT_SET_ID]
            assert [a["role"] for a in arts] == ["main", "holdout"]
            assert all(a["ciphertext_digest"] for a in arts)
        # The chain stays content-free and verifiable.
        assert w["ledger"].verify_chain()["ok"]
        blob = w["ledger"].path.read_bytes()
        assert SENTINEL.encode() not in blob
        assert HOLDOUT_SENTINEL.encode() not in blob

    def test_a_split_from_another_ceremony_is_blocked_and_logged(
            self, sealed_world, tmp_path):
        w = sealed_world
        other = init_ceremony(tmp_path / "other-cer",
                              sealed_set_id="eval-other-holdout-v1",
                              custodian_group_id="other-council", m=2, n=3)
        corpus = tmp_path / "other-holdout.json"
        corpus.write_text(json.dumps(
            [{"id": 0, "source": "x", "target": "y", "segment": "held_out"}]),
            encoding="utf-8")
        foreign = seal_corpus_to_artifact(
            corpus, {"publicKeyDerB64": other["publicKeyDerB64"]},
            card_id="eval-other-holdout-v1", custodian_group_id="other-council",
            out_dir=tmp_path / "other-sealed",
            key_scheme=other["keyScheme"])["artifact_path"]
        with pytest.raises(SealedRunError, match="two ceremonies"):
            quorum_unseal_for_run(
                artifact_paths=[w["artifact_path"], foreign],
                share_paths=w["shares"][:3],
                ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
                corpus_version="v1", requested_by="r@example.test",
                scratch_dir=w["scratch"])
        # Blocked AND logged — the same property the single-party attempt has.
        assert "single_party_attempt_blocked" in _events(w["ledger"])
        assert "grant_minted" not in _events(w["ledger"])
        assert w["ledger"].verify_chain()["ok"]

    def test_the_same_set_twice_is_not_a_holdout(self, sealed_world):
        w = sealed_world
        with pytest.raises(SealedRunError, match="disjoint split"):
            quorum_unseal_for_run(
                artifact_paths=[w["artifact_path"], w["artifact_path"]],
                share_paths=w["shares"][:3],
                ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
                corpus_version="v1", requested_by="r@example.test",
                scratch_dir=w["scratch"])

    def test_both_forms_are_mutually_exclusive(self, sealed_world):
        w = sealed_world
        with pytest.raises(SealedRunError, match="exactly one"):
            quorum_unseal_for_run(
                artifact_path=w["artifact_path"],
                artifact_paths=[w["artifact_path"]],
                share_paths=w["shares"][:3],
                ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
                corpus_version="v1", requested_by="r@example.test",
                scratch_dir=w["scratch"])

    def test_more_splits_than_a_contest_declares_is_refused(
            self, sealed_world, sealed_holdout):
        w = sealed_world
        with pytest.raises(SealedRunError, match="at most ONE holdout"):
            quorum_unseal_for_run(
                artifact_paths=[w["artifact_path"], sealed_holdout,
                                sealed_holdout],
                share_paths=w["shares"][:3],
                ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
                corpus_version="v1", requested_by="r@example.test",
                scratch_dir=w["scratch"])


class TestGrantUsedNamesTheSplitsItCovered:
    """Contract D1 on the AIR-GAPPED chain (measured gap, 2026-09-07).

    The connected lane records which splits a grant covered through
    ``contest_node.mint_and_claim_grant(used_detail=…)``. The offline
    threshold lane had no way to pass it, so the ledger that is supposed to
    PROVE "one ceremony, one grant, both splits" said nothing about the
    splits at all.
    """

    def test_used_detail_rides_grant_used(self, sealed_world):
        w = sealed_world
        quorum_unseal_for_run(
            artifact_path=w["artifact_path"], share_paths=w["shares"][:3],
            ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
            corpus_version="v1", requested_by="three-custodians",
            scratch_dir=w["scratch"],
            used_detail={"sets": ["main", "holdout"],
                         "test_suites": ["eval-suite-v1"]})
        used = [e for e in w["ledger"].entries()
                if e["event_type"] == "grant_used"]
        assert len(used) == 1
        # The node id is still there; the splits are added, not substituted.
        assert used[0]["detail"]["node"] == NODE
        assert used[0]["detail"]["sets"] == ["main", "holdout"]
        assert used[0]["detail"]["test_suites"] == ["eval-suite-v1"]
        assert w["ledger"].verify_chain()["ok"]
        wipe_tree(w["scratch"])

    def test_without_it_the_event_is_unchanged(self, sealed_world):
        w = sealed_world
        quorum_unseal_for_run(
            artifact_path=w["artifact_path"], share_paths=w["shares"][:3],
            ledger=w["ledger"], node_id=NODE, method_sha=METHOD_SHA,
            corpus_version="v1", requested_by="three-custodians",
            scratch_dir=w["scratch"])
        used = [e for e in w["ledger"].entries()
                if e["event_type"] == "grant_used"][0]
        assert used["detail"] == {"node": NODE}
        wipe_tree(w["scratch"])
