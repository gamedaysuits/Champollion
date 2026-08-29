"""ceremony — init/share/verify/restore, and the paths that must refuse.

The load-bearing assertions: the set key NEVER persists (proved by scanning
every ceremony file for the reconstructed scalar's bytes), a quorum
reconstructs, a sub-quorum refuses, corrupted/forged/mixed shares refuse
via the commitment check, and share loss beyond N−M means a NEW ceremony
whose old shares cannot open the new sealing (the re-seal flow).
"""

from __future__ import annotations

import base64
import json

import pytest

pytest.importorskip(
    "cryptography",
    reason="sovereign threshold lane needs the cryptography library "
           "(pip install 'mt-eval[node]')")

from mt_eval_harness.sovereign import threshold_seal as ts
from mt_eval_harness.sovereign.ceremony import (
    CeremonyError,
    emit_share,
    init_ceremony,
    load_ceremony,
    load_share_file,
    restore_key,
    share_printable,
    verify_ceremony,
    wipe_share_originals,
)

CUSTODIANS = ["elder-a", "elder-b", "teacher-c", "archivist-d", "youth-e"]


@pytest.fixture
def ceremony(tmp_path):
    d = tmp_path / "cer"
    record = init_ceremony(d, sealed_set_id="eval-synth-cer-v1",
                           custodian_group_id="synth-council", m=3, n=5,
                           custodians=CUSTODIANS)
    shares = sorted((d / "shares").glob("share-*.json"))
    return {"dir": d, "record": record, "shares": shares}


class TestInit:
    def test_record_and_share_files(self, ceremony):
        record = ceremony["record"]
        assert record["m"] == 3 and record["n"] == 5
        assert record["keyScheme"] == "shamir-gf256-3-of-5"
        assert len(ceremony["shares"]) == 5
        doc = load_share_file(ceremony["shares"][0])
        assert doc["m"] == 3 and doc["n"] == 5
        assert doc["keyId"] == record["keyId"]
        # 0600 on share files.
        assert (ceremony["shares"][0].stat().st_mode & 0o777) == 0o600

    def test_private_key_never_persisted(self, ceremony):
        """Reconstruct the scalar from a quorum, then prove NO ceremony file
        contains it — raw, base64, or hex."""
        with restore_key(ceremony["shares"][:3]) as buf:
            raw = buf.bytes()
            encodings = {raw, base64.b64encode(raw),
                         raw.hex().encode()}
            for p in ceremony["dir"].rglob("*"):
                if not p.is_file():
                    continue
                blob = p.read_bytes()
                for needle in encodings:
                    assert needle not in blob, \
                        f"set key material found in {p}"
        # And no file anywhere carries a privateKeyDerB64 field.
        for p in ceremony["dir"].rglob("*.json"):
            assert b"privateKeyDerB64" not in p.read_bytes()

    def test_refuses_overwrite_and_bad_params(self, ceremony, tmp_path):
        with pytest.raises(CeremonyError, match="already exists"):
            init_ceremony(ceremony["dir"], sealed_set_id="x",
                          custodian_group_id="y", m=3, n=5)
        with pytest.raises(CeremonyError, match="custodian name"):
            init_ceremony(tmp_path / "c2", sealed_set_id="x",
                          custodian_group_id="y", m=3, n=5,
                          custodians=["a", "b"])
        with pytest.raises(CeremonyError, match="unique"):
            init_ceremony(tmp_path / "c3", sealed_set_id="x",
                          custodian_group_id="y", m=2, n=2,
                          custodians=["same", "same"])
        with pytest.raises(CeremonyError):
            init_ceremony(tmp_path / "c4", sealed_set_id="x",
                          custodian_group_id="y", m=6, n=5)


class TestVerifyRestore:
    def test_three_of_five_verifies(self, ceremony):
        result = verify_ceremony(ceremony["dir"], ceremony["shares"][:3])
        assert result["ok"] is True

    def test_any_quorum_subset_works(self, ceremony):
        s = ceremony["shares"]
        for subset in ([s[0], s[2], s[4]], [s[1], s[3], s[4]], s[:4], s):
            assert verify_ceremony(ceremony["dir"], subset)["ok"]

    def test_two_of_five_refuses(self, ceremony):
        result = verify_ceremony(ceremony["dir"], ceremony["shares"][:2])
        assert result["ok"] is False
        assert "Quorum not met" in result["reason"]
        with pytest.raises(CeremonyError, match="Quorum not met"):
            restore_key(ceremony["shares"][:2])

    def test_corrupted_share_refused_by_fingerprint(self, ceremony, tmp_path):
        doc = json.loads(ceremony["shares"][0].read_text())
        share = bytearray(base64.b64decode(doc["shareB64"]))
        share[0] ^= 0xFF
        doc["shareB64"] = base64.b64encode(bytes(share)).decode()
        bad = tmp_path / "bad-share.json"
        bad.write_text(json.dumps(doc))
        with pytest.raises(CeremonyError, match="fingerprint mismatch"):
            load_share_file(bad)

    def test_forged_lower_m_cannot_beat_the_commitment(self, ceremony,
                                                       tmp_path):
        """An attacker rewrites m=2 AND re-fingerprints (v2 recipe, over the
        full header) in two share files — the files are self-consistent and
        consistency-across-shares passes, but the 2-share 'reconstruction'
        derives the wrong public key and the commitment check refuses. The
        commitment, not the fingerprint, is the reconstruction backstop."""
        from mt_eval_harness.sovereign.ceremony import _share_fingerprint
        forged_paths = []
        for src in ceremony["shares"][:2]:
            doc = json.loads(src.read_text())
            doc["m"] = 2
            share_bytes = base64.b64decode(doc["shareB64"])
            doc["fingerprint"] = _share_fingerprint(
                share_bytes, key_id=doc["keyId"], m=doc["m"], n=doc["n"],
                index=doc["index"], custodian=doc["custodian"])
            p = tmp_path / f"forged-{src.name}"
            p.write_text(json.dumps(doc))
            forged_paths.append(p)
        with pytest.raises(CeremonyError, match="commitment check"):
            restore_key(forged_paths)

    def test_mixed_ceremonies_refused(self, ceremony, tmp_path):
        other = init_ceremony(tmp_path / "other-cer",
                              sealed_set_id="eval-other-v1",
                              custodian_group_id="other-council", m=3, n=5)
        del other
        other_shares = sorted((tmp_path / "other-cer" / "shares").glob("*.json"))
        with pytest.raises(CeremonyError, match="DIFFERENT ceremonies"):
            restore_key(ceremony["shares"][:2] + [other_shares[0]])

    def test_duplicate_share_refused(self, ceremony):
        with pytest.raises(CeremonyError, match="twice"):
            restore_key([ceremony["shares"][0], ceremony["shares"][0],
                         ceremony["shares"][1]])

    def test_restore_key_opens_a_sealing(self, ceremony, tmp_path):
        record = ceremony["record"]
        sealed = ts.seal_bytes(b'{"synthetic": 1}',
                               {"publicKeyDerB64": record["publicKeyDerB64"]},
                               ts.build_aad(record["sealedSetId"],
                                            record["custodianGroupId"]))
        with restore_key(ceremony["shares"][2:],  # a different quorum
                         expected_key_id=record["keyId"]) as key:
            assert ts.open_sealed(sealed, key.bytes()) == b'{"synthetic": 1}'
        assert key.closed


class TestShareEmission:
    def test_emit_to_token_and_printable(self, ceremony, tmp_path):
        token = tmp_path / "token-1"
        emitted = emit_share(ceremony["dir"], custodian="elder-a",
                             dest=token)
        assert len(emitted) == 1
        copied = token / emitted[0]["_path"].split("/")[-1]
        assert copied.is_file()
        printable = (token / (copied.stem + ".txt")).read_text()
        assert "KEEP SEALED, KEEP OFFLINE" in printable
        assert emitted[0]["shareB64"][:20] in printable.replace("\n    ", "")
        # The copied share round-trips through the loader.
        load_share_file(copied)

    def test_unknown_custodian_refused(self, ceremony):
        with pytest.raises(CeremonyError, match="No custodian"):
            emit_share(ceremony["dir"], custodian="nobody")

    def test_emit_all_to_one_dest_refused(self, ceremony, tmp_path):
        """F10: emitting EVERY share to one medium defeats M-of-N — refused
        unless explicitly acknowledged."""
        with pytest.raises(CeremonyError, match="whole key on a single"):
            emit_share(ceremony["dir"], dest=tmp_path / "one-token")
        with pytest.raises(CeremonyError, match="whole key on a single"):
            emit_share(ceremony["dir"], qr=True)

    def test_emit_all_allowed_with_acknowledgement(self, ceremony, tmp_path):
        emitted = emit_share(ceremony["dir"], dest=tmp_path / "all-token",
                             allow_all_shares=True)
        assert len(emitted) == 5

    def test_listing_all_shares_is_always_allowed(self, ceremony):
        # No dest, no qr → listing (fingerprints only), never refused.
        emitted = emit_share(ceremony["dir"])
        assert len(emitted) == 5

    def test_printable_contains_quorum_line(self, ceremony):
        doc = load_share_file(ceremony["shares"][0])
        assert "any 3 of 5" in share_printable(doc)

    def test_wipe_originals(self, ceremony):
        n = wipe_share_originals(ceremony["dir"])
        assert n == 5
        assert not (ceremony["dir"] / "shares").exists()
        # The public record survives the wipe.
        assert load_ceremony(ceremony["dir"])["keyId"]


class TestShareFormatV2:
    """v2: the fingerprint commits to the full header, and the ceremony record
    is a commitment to each share's identity."""

    def test_record_and_shares_are_v2(self, ceremony):
        for src in ceremony["shares"]:
            doc = json.loads(src.read_text())
            assert doc["champollionShare"] == "2"

    @pytest.mark.parametrize("field,value", [
        ("custodian", "impostor"),
        ("m", 2),
        ("n", 9),
        ("index", 4),
        ("keyId", "deadbeefdeadbeef"),
    ])
    def test_header_tamper_without_refingerprint_refused_at_load(
            self, ceremony, tmp_path, field, value):
        """Editing ANY header field but leaving the (now-stale) fingerprint is
        caught at load — v1 only caught edits to the share bytes."""
        doc = json.loads(ceremony["shares"][0].read_text())
        doc[field] = value
        bad = tmp_path / f"tampered-{field}.json"
        bad.write_text(json.dumps(doc))
        with pytest.raises(CeremonyError, match="fingerprint mismatch"):
            load_share_file(bad)

    def test_relabelled_share_caught_against_the_record(self, ceremony,
                                                        tmp_path):
        """A self-consistent relabel (edit custodian AND recompute the v2
        fingerprint) passes load, but verify_ceremony cross-checks the
        presented shares against the PUBLIC record's committed fingerprints
        and refuses it."""
        from mt_eval_harness.sovereign.ceremony import _share_fingerprint
        doc = json.loads(ceremony["shares"][0].read_text())
        doc["custodian"] = "impostor"
        share_bytes = base64.b64decode(doc["shareB64"])
        doc["fingerprint"] = _share_fingerprint(
            share_bytes, key_id=doc["keyId"], m=doc["m"], n=doc["n"],
            index=doc["index"], custodian=doc["custodian"])
        relabelled = tmp_path / "relabelled.json"
        relabelled.write_text(json.dumps(doc))
        # It loads (self-consistent)…
        load_share_file(relabelled)
        # …but does not verify against the record.
        result = verify_ceremony(
            ceremony["dir"],
            [relabelled, ceremony["shares"][1], ceremony["shares"][2]])
        assert result["ok"] is False
        assert "committed to" in result["reason"]


class TestRestoreAckGuard:
    """F12: `ceremony restore` assembles the REAL key and is unlogged — it
    must not run without an explicit acknowledgement."""

    def _argv(self, ceremony, *, ack: bool):
        argv = ["mt-eval", "node", "ceremony", "restore"]
        if ack:
            argv.append("--i-understand-this-assembles-the-key")
        for s in ceremony["shares"][:3]:
            argv += ["--share", str(s)]
        return argv

    def test_restore_without_ack_refused(self, ceremony, monkeypatch, capsys):
        import mt_eval_harness.cli as cli
        monkeypatch.setattr("sys.argv", self._argv(ceremony, ack=False))
        with pytest.raises(SystemExit) as ei:
            cli.main()
        assert ei.value.code == 1
        assert "assembles the REAL set key" in capsys.readouterr().out

    def test_restore_with_ack_runs_the_drill(self, ceremony, monkeypatch,
                                             capsys):
        import mt_eval_harness.cli as cli
        monkeypatch.setattr("sys.argv", self._argv(ceremony, ack=True))
        cli.main()  # no SystemExit
        out = capsys.readouterr().out
        assert "assembling the set key in memory" in out
        assert "quorum restore drill" in out


class TestReSealFlow:
    def test_share_loss_beyond_quorum_means_new_ceremony(self, tmp_path):
        """Lose 3 of 5 shares (only 2 remain, m=3): the old key is
        unrecoverable BY DESIGN. The flow: new ceremony, re-seal from the
        community's source copy; old shares cannot open the new artifact."""
        first = init_ceremony(tmp_path / "cer1",
                              sealed_set_id="eval-reseal-v1",
                              custodian_group_id="council", m=3, n=5)
        first_shares = sorted((tmp_path / "cer1" / "shares").glob("*.json"))
        corpus = b'[{"source": "syn src", "target": "syn tgt"}]'
        aad = ts.build_aad("eval-reseal-v1", "council")
        sealed_v1 = ts.seal_bytes(
            corpus, {"publicKeyDerB64": first["publicKeyDerB64"]}, aad)

        surviving = first_shares[:2]          # 3 lost — below quorum
        with pytest.raises(CeremonyError, match="Quorum not met"):
            restore_key(surviving)

        # Re-key: NEW ceremony (fresh dir), re-seal the community's copy.
        second = init_ceremony(tmp_path / "cer2",
                               sealed_set_id="eval-reseal-v1",
                               custodian_group_id="council", m=3, n=5)
        second_shares = sorted((tmp_path / "cer2" / "shares").glob("*.json"))
        sealed_v2 = ts.seal_bytes(
            corpus, {"publicKeyDerB64": second["publicKeyDerB64"]}, aad)
        assert second["keyId"] != first["keyId"]

        # Old shares refuse the new artifact (keyId commitment mismatch)…
        with pytest.raises(CeremonyError, match="wrong ceremony|belong"):
            restore_key(first_shares[:3],
                        expected_key_id=second["keyId"])
        # …and the new quorum opens it.
        with restore_key(second_shares[:3],
                         expected_key_id=second["keyId"]) as key:
            assert ts.open_sealed(sealed_v2, key.bytes()) == corpus
        # The old artifact stays openable by the old (full) quorum only —
        # which no longer exists; sealed_v1 is retired with the old key.
        with restore_key(second_shares[:3]) as wrong_key:
            with pytest.raises(ts.ThresholdSealError):
                ts.open_sealed(sealed_v1, wrong_key.bytes())
