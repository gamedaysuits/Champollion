"""Consumer-level red-team tests for the quorum gate (2026-08-17).

test_sovereign_sealed_run.py already covers the happy path, no-shares, and
sub-quorum. This file closes the CONSUMER-side gaps the 2026-08-17 review
found — the places where the crypto is sound but the gate around it counted
the wrong thing:

  * SET-IDENTITY BINDING — a valid quorum for key K must not open a DIFFERENT
    artifact that was relabelled to reuse K. Before the fix the ledger logged
    the run under the artifact's (forgeable) cardId while the real corpus
    decrypted; now the gate binds ledger provenance to what the custodians
    actually hold.
  * ONE CUSTODIAN, ONE VOTE — two distinct shares naming the same custodian
    must not satisfy an M-of-N quorum. shamir rejects duplicate x-coordinates
    (same file twice) and the ceremony issues unique names, but nothing
    stopped one holder's two shares from counting as two votes.
  * M−1 DIRECT restore — calling the reconstruction API under quorum is
    refused before combine() runs (not merely garbage-out).
  * FORGED-m — a share whose `m` is edited downward is caught by the
    public-key commitment, never a silent wrong key.
  * REPLAY SEMANTICS — a single-use grant cannot be re-claimed, and every
    block path is recorded in the tamper-evident chain (blocked AND logged).

All material is synthetic.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

pytest.importorskip(
    "cryptography",
    reason="sovereign threshold lane needs the cryptography library "
           "(pip install 'mt-eval[node]')")

from mt_eval_harness.sovereign.ceremony import (
    CeremonyError,
    init_ceremony,
    restore_key,
)
from mt_eval_harness.sovereign.local_ledger import LedgerError, LocalLedger
from mt_eval_harness.sovereign.sealed_run import (
    SealedRunError,
    quorum_unseal_for_run,
)
from mt_eval_harness.sovereign.threshold_seal import seal_corpus_to_artifact

SET_ID = "eval-synth-redteam-v1"
GROUP = "synth-council"
NODE = "test-redteam-node"
METHOD_SHA = "cd" * 32
SENTINEL = "kwarizmi-sentinel"


@pytest.fixture
def world(tmp_path):
    record = init_ceremony(tmp_path / "cer", sealed_set_id=SET_ID,
                           custodian_group_id=GROUP, m=3, n=5)
    shares = sorted((tmp_path / "cer" / "shares").glob("share-*.json"))
    corpus = tmp_path / "corpus.json"
    corpus.write_text(json.dumps([
        {"id": 0, "source": f"The {SENTINEL} holds.",
         "target": f"SYN {SENTINEL}.", "segment": "held_out"},
    ]), encoding="utf-8")
    out = seal_corpus_to_artifact(
        corpus, {"publicKeyDerB64": record["publicKeyDerB64"]},
        card_id=SET_ID, custodian_group_id=GROUP,
        out_dir=tmp_path / "sealed", key_scheme=record["keyScheme"])
    corpus.unlink()
    return {
        "record": record, "shares": shares,
        "artifact_path": out["artifact_path"],
        "ledger": LocalLedger(tmp_path / "ledger.jsonl"),
        "scratch": tmp_path / "workspace" / "scratch",
        "tmp": tmp_path,
    }


def _run(world, share_paths, *, artifact_path=None, corpus_version="v1"):
    return quorum_unseal_for_run(
        artifact_path=artifact_path or world["artifact_path"],
        share_paths=share_paths, ledger=world["ledger"], node_id=NODE,
        method_sha=METHOD_SHA, corpus_version=corpus_version,
        requested_by="researcher@example.test", scratch_dir=world["scratch"])


def _events(world):
    return [e["event_type"] for e in world["ledger"].entries()]


def _edit_share(src: Path, dst: Path, **overrides) -> Path:
    """Edit share header fields AND recompute the v2 fingerprint, so the file
    is self-consistent and passes load — the point is to exercise the
    DOWNSTREAM gate (distinct-custodian, commitment), not the load-time
    fingerprint guard (which is tested directly in test_sovereign_ceremony)."""
    import base64
    from mt_eval_harness.sovereign.ceremony import _share_fingerprint
    doc = json.loads(src.read_text())
    doc.update(overrides)
    share_bytes = base64.b64decode(doc["shareB64"])
    doc["fingerprint"] = _share_fingerprint(
        share_bytes, key_id=doc["keyId"], m=doc["m"], n=doc["n"],
        index=doc["index"], custodian=doc["custodian"])
    dst.write_text(json.dumps(doc), encoding="utf-8")
    return dst


# ---------------------------------------------------------------------------
# Set-identity binding (relabelled-artifact attack).
# ---------------------------------------------------------------------------


class TestSetIdentityBinding:
    def test_relabelled_artifact_is_blocked_and_logged(self, world):
        """An artifact whose cardId was edited to a different set — sealed to
        the SAME ceremony key — must not open under this quorum, and the
        attempt must be recorded, not silently logged under the false id."""
        art = json.loads(Path(world["artifact_path"]).read_text())
        art["cardId"] = "eval-EVIL-relabel-v1"
        evil = world["tmp"] / "evil.sealed.json"
        evil.write_text(json.dumps(art), encoding="utf-8")
        with pytest.raises(SealedRunError, match="Set-identity mismatch"):
            _run(world, world["shares"][:3], artifact_path=evil)
        events = _events(world)
        assert "single_party_attempt_blocked" in events
        assert "grant_minted" not in events
        assert world["ledger"].verify_chain()["ok"]
        # The real corpus never reached scratch.
        assert not list(world["scratch"].glob("*")) \
            if world["scratch"].exists() else True

    def test_relabelled_group_is_blocked(self, world):
        art = json.loads(Path(world["artifact_path"]).read_text())
        art["custodianGroupId"] = "impostor-council"
        evil = world["tmp"] / "evil-group.sealed.json"
        evil.write_text(json.dumps(art), encoding="utf-8")
        with pytest.raises(SealedRunError, match="Set-identity mismatch"):
            _run(world, world["shares"][:3], artifact_path=evil)

    def test_tampered_aad_is_blocked(self, world):
        """cardId/group left alone but the embedded AAD edited: refused before
        any reconstruction (independent of the GCM tag that would also fail)."""
        art = json.loads(Path(world["artifact_path"]).read_text())
        art["aad"] = art["aad"] + "|tampered"
        evil = world["tmp"] / "evil-aad.sealed.json"
        evil.write_text(json.dumps(art), encoding="utf-8")
        with pytest.raises(SealedRunError, match="AAD does not match"):
            _run(world, world["shares"][:3], artifact_path=evil)

    def test_matching_labels_still_open(self, world):
        """Regression guard: the new checks must not block a legitimate run."""
        result = _run(world, world["shares"][:3])
        assert result["sealed_set_id"] == SET_ID
        assert Path(result["corpus_path"]).is_file()


# ---------------------------------------------------------------------------
# One custodian, one vote.
# ---------------------------------------------------------------------------


class TestDistinctCustodians:
    def test_two_shares_one_custodian_blocked(self, world):
        """Two DIFFERENT shares (distinct index/bytes) whose custodian field
        names the same holder must not make quorum. Before the fix these
        counted as two of the three votes."""
        s0 = _edit_share(world["shares"][0], world["tmp"] / "c0.json",
                         custodian="elder-a")
        s1 = _edit_share(world["shares"][1], world["tmp"] / "c1.json",
                         custodian="elder-a")  # same human, second share
        s2 = world["shares"][2]
        with pytest.raises(SealedRunError, match="distinct custodians"):
            _run(world, [s0, s1, s2])
        assert "single_party_attempt_blocked" in _events(world)
        assert "grant_minted" not in _events(world)

    def test_three_distinct_custodians_open(self, world):
        result = _run(world, world["shares"][:3])
        assert result["presented"] == 3
        # Exactly three distinct custodians voted.
        votes = [e for e in world["ledger"].entries()
                 if e["event_type"] == "vote_cast"]
        assert len({v["actor"] for v in votes}) == 3


# ---------------------------------------------------------------------------
# Reconstruction API — M−1 and forged-m under the commitment.
# ---------------------------------------------------------------------------


class TestReconstructionGuards:
    def test_restore_key_refuses_m_minus_one(self, world):
        """The public restore API refuses a sub-quorum BEFORE combine() runs —
        no garbage buffer is ever produced."""
        with pytest.raises(CeremonyError, match="Quorum not met"):
            restore_key(world["shares"][:2],
                        expected_key_id=world["record"]["keyId"])

    def test_forged_lower_m_caught_by_commitment(self, world):
        """Edit two shares' `m` down to 2 (the fingerprint covers only the
        share bytes, not `m`). The count check now passes, combine() returns
        garbage, and the public-key commitment check refuses it."""
        s0 = _edit_share(world["shares"][0], world["tmp"] / "m0.json", m=2)
        s1 = _edit_share(world["shares"][1], world["tmp"] / "m1.json", m=2)
        with pytest.raises(CeremonyError) as exc:
            restore_key([s0, s1])
        # Either the consistency check (m disagrees with the untouched keyId's
        # record) or the commitment check fires — never a silent wrong key.
        assert "commitment" in str(exc.value).lower() \
            or "different" in str(exc.value).lower() \
            or "quorum" in str(exc.value).lower()

    def test_forged_uniform_m_still_fails_commitment(self, world):
        """All presented shares forged to m=2 uniformly (so consistency
        passes): combine() of 2-of-3 shares yields a scalar that derives the
        WRONG public key — refused by the commitment, never returned."""
        s0 = _edit_share(world["shares"][0], world["tmp"] / "u0.json", m=2)
        s1 = _edit_share(world["shares"][1], world["tmp"] / "u1.json", m=2)
        with pytest.raises(CeremonyError, match="commitment|FAILED"):
            restore_key([s0, s1])


# ---------------------------------------------------------------------------
# Replay + single-use grant.
# ---------------------------------------------------------------------------


class TestReplayAndGrant:
    def test_grant_is_single_use(self, world):
        result = _run(world, world["shares"][:3])
        with pytest.raises(LedgerError, match="already used"):
            world["ledger"].claim_grant(
                result["grant_id"], fingerprint=result["fingerprint"],
                node=NODE)

    def test_every_block_path_is_logged(self, world):
        """Each refusal writes a single_party_attempt_blocked + request_denied
        pair, and the chain still verifies — blocked AND logged, never one
        without the other."""
        # sub-quorum
        with pytest.raises(SealedRunError):
            _run(world, world["shares"][:2])
        entries = world["ledger"].entries()
        blocked = [e for e in entries
                   if e["event_type"] == "single_party_attempt_blocked"]
        denied = [e for e in entries if e["event_type"] == "request_denied"]
        assert len(blocked) == 1 and len(denied) == 1
        assert world["ledger"].verify_chain()["ok"]
        # Nothing in the ledger carries plaintext.
        assert SENTINEL.encode() not in world["ledger"].path.read_bytes()
