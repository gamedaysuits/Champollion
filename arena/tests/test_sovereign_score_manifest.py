"""score_manifest — build/sign/verify + the scores-only guard."""

from __future__ import annotations

import json

import pytest

pytest.importorskip(
    "cryptography",
    reason="sovereign threshold lane needs the cryptography library "
           "(pip install 'mt-eval[node]')")

from mt_eval_harness.sovereign.score_manifest import (
    ScoreManifestError,
    build_score_manifest,
    sign_manifest_file,
    verify_manifest_file,
    write_score_manifest,
)
from mt_eval_harness.sovereign.threshold_seal import generate_signing_keypair


def _manifest(**over):
    kw = dict(node_id="test-node", sealed_set_id="eval-synth-v1",
              corpus_version="v1", corpus_ciphertext_digest="ab" * 32,
              method_sha256="cd" * 32,
              scores={"composite": 0.41, "chrf": 41.2},
              audit_head="ee" * 32, request_id="authreq-local-1",
              grant_id="grant-1", run_card_id="card-1")
    kw.update(over)
    return build_score_manifest(**kw)


@pytest.fixture
def keypair(tmp_path):
    pair = generate_signing_keypair()
    key = tmp_path / "score-sign.key.json"
    pub = tmp_path / "score-sign.pub.json"
    key.write_text(json.dumps(pair))
    pub.write_text(json.dumps({"keyId": pair["keyId"],
                               "publicKeyDerB64": pair["publicKeyDerB64"]}))
    return {"key": key, "pub": pub, "keyId": pair["keyId"]}


class TestBuild:
    def test_shape_and_no_tee_claim(self):
        m = _manifest()
        assert m["champollionScoreManifest"] == "1"
        assert m["auditHead"] == "ee" * 32
        assert "not what hardware" in m["_note"]          # no TEE claim
        assert "TEE" not in json.dumps(m).replace("no TEE claim", "")

    def test_scores_only_guard_refuses_content_keys(self):
        with pytest.raises(ScoreManifestError, match="scores-only"):
            _manifest(scores={"composite": 0.4,
                              "source": "a leaked sentence"})
        with pytest.raises(ScoreManifestError, match="scores-only"):
            _manifest(scores={"per_entry": [{"reference": "leak"}]})

    def test_scores_only_guard_refuses_long_strings(self):
        with pytest.raises(ScoreManifestError, match="aggregates only"):
            _manifest(scores={"notes": "x" * 400})

    def test_empty_scores_refused(self):
        with pytest.raises(ScoreManifestError, match="non-empty"):
            _manifest(scores={})


class TestSignVerify:
    def test_roundtrip(self, tmp_path, keypair):
        p = write_score_manifest(_manifest(), tmp_path / "m.json")
        sig = sign_manifest_file(p, keypair["key"])
        report = verify_manifest_file(p, sig, keypair["pub"])
        assert report["ok"] is True
        assert report["keyId"] == keypair["keyId"]

    def test_tampered_payload_refused(self, tmp_path, keypair):
        p = write_score_manifest(_manifest(), tmp_path / "m.json")
        sig = sign_manifest_file(p, keypair["key"])
        doctored = json.loads(p.read_text())
        doctored["scores"]["composite"] = 0.99            # grade inflation
        p.write_text(json.dumps(doctored, indent=2, sort_keys=True) + "\n")
        report = verify_manifest_file(p, sig, keypair["pub"])
        assert report["ok"] is False
        assert any("sha256 mismatch" in r for r in report["reasons"])

    def test_wrong_pubkey_refused(self, tmp_path, keypair):
        p = write_score_manifest(_manifest(), tmp_path / "m.json")
        sig = sign_manifest_file(p, keypair["key"])
        other = generate_signing_keypair()
        other_pub = tmp_path / "other.pub.json"
        other_pub.write_text(json.dumps(
            {"publicKeyDerB64": other["publicKeyDerB64"]}))
        report = verify_manifest_file(p, sig, other_pub)
        assert report["ok"] is False
        assert any("INVALID" in r for r in report["reasons"])

    def test_unknown_scheme_refused(self, tmp_path, keypair):
        p = write_score_manifest(_manifest(), tmp_path / "m.json")
        sig = sign_manifest_file(p, keypair["key"])
        block = json.loads(sig.read_text())
        block["scheme"] = "md5-and-hope"
        sig.write_text(json.dumps(block))
        report = verify_manifest_file(p, sig, keypair["pub"])
        assert report["ok"] is False
        assert any("scheme" in r for r in report["reasons"])

    def test_missing_files_refused(self, tmp_path, keypair):
        report = verify_manifest_file(tmp_path / "no.json",
                                      tmp_path / "no.sig.json",
                                      keypair["pub"])
        assert report["ok"] is False
