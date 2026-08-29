"""airgap_transport — the true-airgap file round trip (B3), offline.

Two "machines" in one process: the CONNECTED relay (fake Supabase + fake
bucket) and the AIRGAPPED scoring node (its own node config, its own state
dir, an injected container runtime). Work crosses a tmp exchange directory
exactly like a USB stick would:

  relay pass 1 → import-bundle → run-method --offline → export-scores →
  relay pass 2 → published run card.

The crypto is REAL (seal-corpus keygen/seal + sign-keygen/sign/verify via
the champollion CLI) — those tests skip cleanly where node/the cli tree is
absent, the Phase-A pattern. Tamper cases assert the fail-closed edges: a
modified score bundle is refused by signature; a mismatched method tarball
is staged 'rejected' at import. And the exchange medium itself is scanned:
no secret reference text may ever appear in it (scores-only, strengthened).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

import mt_eval_harness.airgap_transport as at
from mt_eval_harness.airgap_transport import (
    AirgapTransportError,
    export_scores,
    import_bundle,
    relay,
    run_imported,
)
from mt_eval_harness.queue_runner import compute_request_fingerprint

from fake_supabase import FakeSupabase, patch_service_layer
from test_sandbox_runner import FakeRuntime, _seal_fixture

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"
SECRET_CORPUS = FIXTURES / "corpus_blind_refs.json"

CONTEST_ID = "synth-open-2026"
BLIND_SET = "eval-qaa-qab-synth-blindtest-v1"
SECRET_SET = "eval-qaa-qab-synth-secret-v1"
PARTICIPANT = "participant@example.test"
AIRGAP_NODE = "org-airgap-1"
RELAY_NODE = "org-relay-1"

# A reference token from the synthetic secret corpus — must NEVER appear on
# the exchange medium (scores-only egress, strengthened: not even the
# connected machine sees text).
SECRET_TOKEN = "noluvo"


def _sign_keygen(tmp_path):
    from mt_eval_harness.contest_prep import (
        ContestPrepError,
        find_champollion_cli,
    )
    if shutil.which("node") is None:
        pytest.skip("node needed for score-bundle signing")
    try:
        cli = find_champollion_cli()
    except ContestPrepError:
        pytest.skip("champollion CLI not found")
    keys = tmp_path / "sign-keys"
    proc = subprocess.run(
        cli + ["seal-corpus", "sign-keygen", "--out", str(keys)],
        capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    return (next(keys.glob("score-sign-*.pub.json")),
            next(keys.glob("score-sign-*.key.json")))


@pytest.fixture
def world(monkeypatch, tmp_path):
    import mt_eval_harness.contest_node as cn
    import mt_eval_harness.sovereign_service as svc

    fake = FakeSupabase()
    fake.tables["contests"].append({
        "id": CONTEST_ID, "name": "Synthetic Open 2026", "status": "open",
        "corpus_id": BLIND_SET, "language_pair": "qaa>qab",
        "authorization_model": "per-submission", "intake_open": True,
    })
    fake.tables["contest_intake"].append({
        "intake_id": "intake-t1", "contest_id": CONTEST_ID,
        "submitted_by": PARTICIPANT, "status": "published",
        "run_card_id": "card-t1",
    })
    storage: dict[str, bytes] = {}
    patch_service_layer(monkeypatch, fake, svc, cn)
    monkeypatch.setattr(cn, "_storage_download", lambda path: storage[path])

    connected_cfg = {
        "node_id": RELAY_NODE,
        "grant_ttl_seconds": 3600,
        "scratch_dir": str(tmp_path / "relay-scratch"),
        "output_dir": str(tmp_path / "relay-runs"),
        "contests": {
            CONTEST_ID: {"secret_set_id": SECRET_SET, "corpus_version": "v1"},
        },
        "relay": {},  # verify_key/airgap_node_id filled by the gated tests
    }
    airgap_cfg = {
        "node_id": AIRGAP_NODE,
        "grant_ttl_seconds": 3600,
        "scratch_dir": str(tmp_path / "airgap-scratch"),
        "output_dir": str(tmp_path / "airgap-runs"),
        "airgap": {"state_dir": str(tmp_path / "airgap-state")},
        "contests": {
            CONTEST_ID: {
                "secret_set_id": SECRET_SET,
                "secret_artifact": str(tmp_path / "unsealed-yet"),
                "secret_privkey": str(tmp_path / "unsealed-yet.key"),
                "corpus_version": "v1",
                "language_pair": "qaa>qab",
                "sandbox": {"runtime": "docker"},
            },
        },
    }
    configs = {"connected": connected_cfg, "airgap": airgap_cfg}
    monkeypatch.setattr(
        cn, "load_node_config",
        lambda p=None: configs[p or "connected"])

    def propose_authorized(method_sha: str, *, request_id=None,
                           upload: bytes | None = None) -> str:
        request_id = request_id or f"authreq-{method_sha[:12]}"
        fingerprint = compute_request_fingerprint(
            {"method_sha": method_sha, "corpus_id": SECRET_SET,
             "corpus_version": "v1"}, node_measurement=AIRGAP_NODE)
        fake("POST", "authorization_requests", data={
            "request_id": request_id, "sealed_set_id": SECRET_SET,
            "state": "authorized", "fingerprint": fingerprint,
            "method_sha": method_sha, "corpus_id": SECRET_SET,
            "corpus_version": "v1", "node_measurement": AIRGAP_NODE,
            "requested_by": PARTICIPANT,
        })
        if upload is not None:
            storage[f"{CONTEST_ID}/{PARTICIPANT}/{request_id}.tar.gz"] = upload
        return request_id

    return {"fake": fake, "storage": storage, "tmp_path": tmp_path,
            "connected": connected_cfg, "airgap": airgap_cfg,
            "propose": propose_authorized}


@pytest.fixture
def bundle(tmp_path):
    from mt_eval_harness.method_bundle import build_method_bundle
    from test_method_bundle import CLEAN_DOCKERFILE, CLEAN_METHOD, _manifest
    src = tmp_path / "method-src"
    src.mkdir()
    (src / "translate.py").write_text(CLEAN_METHOD, encoding="utf-8")
    dockerfile = tmp_path / "Dockerfile"
    dockerfile.write_text(CLEAN_DOCKERFILE, encoding="utf-8")
    built = build_method_bundle(
        method_dir=src, dockerfile=dockerfile, manifest=_manifest(),
        out_path=tmp_path / "m.tar.gz")
    return {"tarball": Path(built["path"]),
            "method_sha": built["method_sha"]}


# ---------------------------------------------------------------------------
# Import-side edges that need no crypto.
# ---------------------------------------------------------------------------

class TestImportBundle:
    def _export_by_hand(self, exchange, request_id, request_row, bundle_bytes):
        dest = exchange / "requests" / request_id
        dest.mkdir(parents=True)
        (dest / "method.tar.gz").write_bytes(bundle_bytes)
        (dest / "request.json").write_text(json.dumps({
            "exchange_version": "1", "contest_id": CONTEST_ID,
            "request": request_row, "audit_head_at_export": "aa" * 32,
        }), encoding="utf-8")

    def test_sha_mismatch_staged_rejected(self, world, bundle, tmp_path):
        exchange = tmp_path / "exchange"
        rid = "authreq-tampered"
        row = {"request_id": rid, "sealed_set_id": SECRET_SET,
               "method_sha": bundle["method_sha"], "corpus_id": SECRET_SET,
               "corpus_version": "v1", "node_measurement": AIRGAP_NODE,
               "fingerprint": "f" * 64, "requested_by": PARTICIPANT}
        self._export_by_hand(exchange, rid, row, b"not the method at all")
        import_bundle(exchange, config_path="airgap")
        state = json.loads((Path(world["airgap"]["airgap"]["state_dir"])
                            / rid / "state.json").read_text(encoding="utf-8"))
        assert state["status"] == "rejected"
        assert "refusing tampered" in state["reason"]
        with pytest.raises(AirgapTransportError, match="rejected"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime())

    def test_clean_bundle_stages_imported(self, world, bundle, tmp_path):
        exchange = tmp_path / "exchange"
        rid = "authreq-clean"
        row = {"request_id": rid, "sealed_set_id": SECRET_SET,
               "method_sha": bundle["method_sha"], "corpus_id": SECRET_SET,
               "corpus_version": "v1", "node_measurement": AIRGAP_NODE,
               "fingerprint": "f" * 64, "requested_by": PARTICIPANT}
        self._export_by_hand(exchange, rid, row,
                             bundle["tarball"].read_bytes())
        imported = import_bundle(exchange, config_path="airgap")
        assert imported == [rid]
        state = json.loads((Path(world["airgap"]["airgap"]["state_dir"])
                            / rid / "state.json").read_text(encoding="utf-8"))
        assert state["status"] == "imported"
        # Idempotent: a second pass imports nothing new.
        assert import_bundle(exchange, config_path="airgap") == []

    def test_wrong_node_binding_fails_closed(self, world, bundle, tmp_path):
        exchange = tmp_path / "exchange"
        rid = "authreq-wrongnode"
        row = {"request_id": rid, "sealed_set_id": SECRET_SET,
               "method_sha": bundle["method_sha"], "corpus_id": SECRET_SET,
               "corpus_version": "v1",
               "node_measurement": "some-other-node",
               "fingerprint": compute_request_fingerprint(
                   {"method_sha": bundle["method_sha"],
                    "corpus_id": SECRET_SET, "corpus_version": "v1"},
                   node_measurement="some-other-node"),
               "requested_by": PARTICIPANT}
        self._export_by_hand(exchange, rid, row,
                             bundle["tarball"].read_bytes())
        import_bundle(exchange, config_path="airgap")
        with pytest.raises(AirgapTransportError, match="bound to node"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime())


# ---------------------------------------------------------------------------
# The full round trip (real crypto — skips without the champollion CLI).
# ---------------------------------------------------------------------------

class TestAirgapRoundTrip:
    def test_usb_stick_round_trip(self, world, bundle, tmp_path):
        # Real sealing + signing keys.
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"

        # 1. Connected: relay pass 1 exports the authorized request.
        out = relay(exchange, config_path="connected")
        assert out["exported"] == [rid] and out["published"] == []
        assert (exchange / "requests" / rid / "method.tar.gz").is_file()
        assert "request_created" in world["fake"].audit_types()

        # 2. Airgap: import → run offline → export signed scores.
        assert import_bundle(exchange, config_path="airgap") == [rid]
        state = run_imported(rid, config_path="airgap",
                             runner=FakeRuntime())
        assert state["status"] == "scored", state.get("reason")
        assert state["qualifier_score"] > 90
        assert export_scores(exchange, config_path="airgap") == [rid]
        assert (exchange / "scores" / rid / "score-bundle.json").is_file()
        assert (exchange / "scores" / rid
                / "score-bundle.json.sig.json").is_file()

        # Scores-only, strengthened: no secret text on the medium — and no
        # RunLog/TestReport files either.
        for p in exchange.rglob("*"):
            if p.is_file():
                assert SECRET_TOKEN.encode() not in p.read_bytes(), \
                    f"secret reference text leaked onto the exchange medium: {p}"
                assert "report" not in p.name and "run_log" not in p.name

        # 3. Connected: relay pass 2 verifies + publishes.
        out = relay(exchange, config_path="connected")
        assert out["published"] == [rid]
        cards = world["fake"].tables["run_cards"]
        assert len(cards) == 1
        card = cards[0]
        assert card["trust"] == "verified"
        assert card["condition"] == "method-execution"
        assert card["dataset_id"] == SECRET_SET
        assert "AIRGAPPED" in card["affirmation"]
        subs = world["fake"].tables["contest_submissions"]
        assert subs and subs[0]["run_card_id"] == card["id"]

        grants = world["fake"].tables["auth_grants"]
        assert len(grants) == 1 and grants[0]["used"] is True
        assert grants[0]["used_by"] == AIRGAP_NODE
        used = [e for e in world["fake"].tables["authorization_audit_log"]
                if e["event_type"] == "grant_used"]
        assert used and used[0]["detail"]["transport"] == "airgap-relay"
        assert used[0]["detail"]["score_bundle_sha256"]

        marker = json.loads((exchange / "scores" / rid / ".relayed.json")
                            .read_text(encoding="utf-8"))
        assert marker["outcome"] == "published"

        # Idempotent: a third relay pass moves nothing.
        out = relay(exchange, config_path="connected")
        assert out == {"exported": [], "published": []}

    def test_stand_in_lane_announces_no_quorum(self, world, bundle, tmp_path,
                                               capsys):
        """F1: the single-key stand-in lane is legitimate (Wave-1) but must
        never be silent — it announces that NO custodian quorum was
        exercised."""
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        # custody defaults to 'single-key' (no key set).
        world["connected"]["relay"] = {"verify_key": "unused-on-export",
                                       "airgap_node_id": AIRGAP_NODE}
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-standin"
        relay(exchange, config_path="connected")
        assert import_bundle(exchange, config_path="airgap") == [rid]
        state = run_imported(rid, config_path="airgap", runner=FakeRuntime())
        assert state["status"] == "scored", state.get("reason")
        out = capsys.readouterr().out
        assert "NO custodian" in out and "single-key stand-in" in out

    def test_tampered_score_bundle_refused(self, world, bundle, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"
        relay(exchange, config_path="connected")
        import_bundle(exchange, config_path="airgap")
        run_imported(rid, config_path="airgap", runner=FakeRuntime())
        export_scores(exchange, config_path="airgap")

        # Adversary on the sneakernet path inflates the score.
        payload = exchange / "scores" / rid / "score-bundle.json"
        doctored = json.loads(payload.read_text(encoding="utf-8"))
        doctored["qualifier_score"] = 99.99
        payload.write_text(json.dumps(doctored, indent=2, sort_keys=True)
                           + "\n", encoding="utf-8")

        out = relay(exchange, config_path="connected")
        assert out["published"] == []
        assert not world["fake"].tables["run_cards"]
        assert not world["fake"].tables["auth_grants"], \
            "no grant may be consumed for a refused bundle"

    def test_rejected_run_travels_back_as_signed_refusal(self, world, bundle,
                                                         tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"
        relay(exchange, config_path="connected")
        import_bundle(exchange, config_path="airgap")
        state = run_imported(rid, config_path="airgap",
                             runner=FakeRuntime("exit1"))
        assert state["status"] == "failed"
        export_scores(exchange, config_path="airgap")

        out = relay(exchange, config_path="connected")
        assert out["published"] == []
        assert not world["fake"].tables["run_cards"]
        marker = json.loads((exchange / "scores" / rid / ".relayed.json")
                            .read_text(encoding="utf-8"))
        assert marker["outcome"] == "rejected"
        assert "exited 1" in marker["reason"]


# ---------------------------------------------------------------------------
# THRESHOLD LANE (sovereign ceremony custody) — the same round trip, but the
# corpus is sealed to a ceremony key and unsealed only by an M-of-N quorum
# presented at run time; the local hash-chained ledger records everything and
# the run emits a signed score manifest. Pure-Python crypto (no champollion
# CLI needed to seal), so these tests skip only on a missing `cryptography`.
# ---------------------------------------------------------------------------

class TestThresholdLane:
    @pytest.fixture
    def ceremony_world(self, world, tmp_path):
        pytest.importorskip(
            "cryptography",
            reason="threshold lane needs cryptography "
                   "(pip install 'mt-eval[node]')")
        from mt_eval_harness.sovereign.ceremony import init_ceremony
        from mt_eval_harness.sovereign.threshold_seal import (
            generate_signing_keypair,
            seal_corpus_to_artifact,
        )
        record = init_ceremony(
            tmp_path / "ceremony", sealed_set_id=SECRET_SET,
            custodian_group_id="synth-council", m=3, n=5)
        shares = sorted((tmp_path / "ceremony" / "shares").glob("*.json"))
        sealed = seal_corpus_to_artifact(
            SECRET_CORPUS, {"publicKeyDerB64": record["publicKeyDerB64"]},
            card_id=SECRET_SET, custodian_group_id="synth-council",
            out_dir=tmp_path / "sealed", key_scheme=record["keyScheme"])
        pair = generate_signing_keypair()
        key_file = tmp_path / "score-sign.key.json"
        pub_file = tmp_path / "score-sign.pub.json"
        key_file.write_text(json.dumps(pair), encoding="utf-8")
        pub_file.write_text(json.dumps(
            {"keyId": pair["keyId"],
             "publicKeyDerB64": pair["publicKeyDerB64"]}), encoding="utf-8")
        # Threshold lane: the artifact is present, but there is NO private
        # key file anywhere on the node — that is the whole point.
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=sealed["artifact_path"],
            secret_privkey=str(tmp_path / "DOES-NOT-EXIST.key.json"))
        world["airgap"]["signing_key"] = str(key_file)
        world["connected"]["relay"] = {"verify_key": str(pub_file),
                                       "airgap_node_id": AIRGAP_NODE}
        return {**world, "record": record, "shares": shares,
                "sealed": sealed, "sign_pub": pub_file}

    def _ledger(self, w):
        from mt_eval_harness.sovereign.local_ledger import LocalLedger
        state_dir = Path(w["airgap"]["airgap"]["state_dir"])
        return LocalLedger(state_dir / "authorization-ledger.jsonl")

    def _stage(self, w, bundle, tmp_path):
        rid = w["propose"](bundle["method_sha"],
                           upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-threshold"
        relay(exchange, config_path="connected")
        assert import_bundle(exchange, config_path="airgap") == [rid]
        return rid, exchange

    def test_sub_quorum_refused_logged_and_item_still_runnable(
            self, ceremony_world, bundle, tmp_path):
        w = ceremony_world
        rid, _ = self._stage(w, bundle, tmp_path)
        with pytest.raises(AirgapTransportError, match="Quorum not met"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime(),
                         share_paths=[str(p) for p in w["shares"][:2]])
        ledger = self._ledger(w)
        events = [e["event_type"] for e in ledger.entries()]
        assert "single_party_attempt_blocked" in events
        assert ledger.verify_chain()["ok"]
        # The staged item is STILL 'imported' — runnable once a quorum shows.
        state_dir = Path(w["airgap"]["airgap"]["state_dir"])
        state = json.loads((state_dir / rid / "state.json").read_text())
        assert state["status"] == "imported"
        assert "Quorum not met" in state["last_refusal"]

    def test_quorum_run_scores_manifest_and_wipe(self, ceremony_world,
                                                 bundle, tmp_path):
        from mt_eval_harness.sovereign.score_manifest import (
            verify_manifest_file,
        )
        w = ceremony_world
        rid, exchange = self._stage(w, bundle, tmp_path)
        quorum = [str(w["shares"][0]), str(w["shares"][2]),
                  str(w["shares"][4])]
        state = run_imported(rid, config_path="airgap",
                             runner=FakeRuntime(), share_paths=quorum)
        assert state["status"] == "scored", state.get("reason")
        assert state["authorization"]["lane"] == "threshold-quorum"
        assert state["authorization"]["quorum"] == "3-of-5"

        # The local ledger holds the canonical chain and verifies.
        ledger = self._ledger(w)
        events = [e["event_type"] for e in ledger.entries()]
        assert events == ["request_created", "vote_cast", "vote_cast",
                          "vote_cast", "request_authorized", "grant_minted",
                          "grant_used"]
        assert ledger.verify_chain()["ok"]
        assert state["ledger_head"] == ledger.head()

        # Signed score manifest: anchored to the ledger head, verifiable
        # with the published pubkey, refusing after tampering.
        manifest_path = Path(state["score_manifest"])
        sig_path = Path(state["score_manifest_sig"])
        manifest = json.loads(manifest_path.read_text())
        assert manifest["auditHead"] == ledger.head()
        assert manifest["methodSha256"] == bundle["method_sha"]
        assert manifest["corpusCiphertextDigest"] == \
            w["sealed"]["artifact"]["ciphertextDigest"]
        assert verify_manifest_file(manifest_path, sig_path,
                                    w["sign_pub"])["ok"]

        # No plaintext in the run workspace (wiped), none on the exchange,
        # none in the ledger or manifest.
        state_dir = Path(w["airgap"]["airgap"]["state_dir"])
        scratch = state_dir / rid / "scratch"
        for root in (scratch, exchange):
            if not root.exists():
                continue
            for p in root.rglob("*"):
                if p.is_file():
                    assert SECRET_TOKEN.encode() not in p.read_bytes(), \
                        f"secret text survived in {p}"
        assert SECRET_TOKEN.encode() not in ledger.path.read_bytes()
        assert SECRET_TOKEN.encode() not in manifest_path.read_bytes()

        # And the scored bundle relays + publishes exactly like the
        # stand-in lane (same §9 path).
        w["connected"]["relay"] = {"verify_key": str(w["sign_pub"]),
                                   "airgap_node_id": AIRGAP_NODE}
        # export uses the champollion CLI signer — skip the relay half
        # where node/the cli tree is absent (same gate as the other tests).
        import shutil as _sh
        if _sh.which("node") is not None:
            try:
                from mt_eval_harness.contest_prep import find_champollion_cli
                find_champollion_cli()
            except Exception:
                return
            assert export_scores(exchange, config_path="airgap") == [rid]
            out = relay(exchange, config_path="connected")
            assert out["published"] == [rid]
            bundle_doc = json.loads(
                (exchange / "scores" / rid / "score-bundle.json")
                .read_text())
            assert bundle_doc["local_ledger_head"] == ledger.head()

    def test_threshold_quorum_custody_refuses_stand_in(self, ceremony_world,
                                                       bundle, tmp_path):
        """F1: a contest that DECLARES custody 'threshold-quorum' must not be
        openable by the single-key fallback. run-method with no --share is
        refused loud, and nothing is consumed."""
        w = ceremony_world
        w["airgap"]["contests"][CONTEST_ID]["custody"] = "threshold-quorum"
        # threshold custody forbids a standing privkey; drop the placeholder.
        w["airgap"]["contests"][CONTEST_ID].pop("secret_privkey", None)
        rid, _ = self._stage(w, bundle, tmp_path)
        with pytest.raises(AirgapTransportError,
                           match="custody 'threshold-quorum'"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime(),
                         share_paths=None)
        # No ledger events, item still imported (nothing consumed).
        assert not self._ledger(w).entries()
        state_dir = Path(w["airgap"]["airgap"]["state_dir"])
        state = json.loads((state_dir / rid / "state.json").read_text())
        assert state["status"] == "imported"
        # …and the same contest DOES run once a real quorum is presented.
        quorum = [str(w["shares"][0]), str(w["shares"][2]),
                  str(w["shares"][4])]
        ran = run_imported(rid, config_path="airgap", runner=FakeRuntime(),
                           share_paths=quorum)
        assert ran["status"] == "scored", ran.get("reason")
        assert ran["authorization"]["lane"] == "threshold-quorum"

    def test_egress_assert_blocks_on_connected_machine(self, ceremony_world,
                                                       bundle, tmp_path,
                                                       monkeypatch):
        """assert_airgap=True + a (faked) connected machine → refusal
        BEFORE anything is consumed."""
        import mt_eval_harness.sovereign.airgap_ops as ops
        w = ceremony_world
        rid, _ = self._stage(w, bundle, tmp_path)
        monkeypatch.setattr(
            ops, "egress_check",
            lambda **kw: {"airgapped": False, "default_route": True,
                          "probes": [{"target": "1.1.1.1:443",
                                      "connected": True}],
                          "dns_resolved": True, "platform": "test",
                          "checked_at": "now", "honest_note": ""})
        with pytest.raises(AirgapTransportError, match="NOT provably"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime(),
                         share_paths=[str(p) for p in w["shares"][:3]],
                         assert_airgap=True)
        # Nothing ran: no ledger events, item still imported.
        assert not self._ledger(w).entries()

    def test_run_time_bundle_tamper_caught_by_rescan(self, ceremony_world,
                                                     bundle, tmp_path):
        """A bundle doctored on the node's own disk AFTER import is refused
        by the run-time re-scan (import scan before running)."""
        w = ceremony_world
        rid, _ = self._stage(w, bundle, tmp_path)
        state_dir = Path(w["airgap"]["airgap"]["state_dir"])
        (state_dir / rid / "bundle" / "method" / "sneaky.py").write_text(
            "import socket\n", encoding="utf-8")
        with pytest.raises(AirgapTransportError, match="re-scan"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime(),
                         share_paths=[str(p) for p in w["shares"][:3]])


# ---------------------------------------------------------------------------
# Lane A (declarative model) over the true airgap — the SAME transport, the
# submissionKind dispatch mirrored into import + run. Engine is injected.
# ---------------------------------------------------------------------------

@pytest.fixture
def declarative_bundle(tmp_path):
    from mt_eval_harness.model_bundle import build_model_bundle
    from test_model_runner import make_declarative_dir
    src = tmp_path / "model-src"
    manifest = make_declarative_dir(src)
    built = build_model_bundle(model_dir=src, manifest=manifest,
                               out_path=tmp_path / "model.tar.gz")
    return {"tarball": Path(built["path"]), "method_sha": built["method_sha"]}


class TestAirgapDeclarativeLaneA:
    def test_declarative_round_trip(self, world, declarative_bundle, tmp_path):
        from test_model_runner import PERFECT
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

        rid = world["propose"](
            declarative_bundle["method_sha"],
            upload=declarative_bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"

        # 1. Relay exports; 2. airgap imports → validated CODE-FREE (Lane A).
        assert relay(exchange, config_path="connected")["exported"] == [rid]
        assert import_bundle(exchange, config_path="airgap") == [rid]
        state = json.loads((Path(world["airgap"]["airgap"]["state_dir"])
                            / rid / "state.json").read_text(encoding="utf-8"))
        assert state["status"] == "imported"
        assert state["lane"] == "declarative-model"

        # 3. Run offline in the trusted engine (injected), export, publish.
        state = run_imported(rid, config_path="airgap", translator=PERFECT)
        assert state["status"] == "scored", state.get("reason")
        assert state["qualifier_score"] > 90
        assert export_scores(exchange, config_path="airgap") == [rid]

        # Scores-only, strengthened: no secret text on the medium.
        for p in exchange.rglob("*"):
            if p.is_file():
                assert SECRET_TOKEN.encode() not in p.read_bytes(), \
                    f"secret text leaked onto the exchange medium: {p}"

        out = relay(exchange, config_path="connected")
        assert out["published"] == [rid]
        card = world["fake"].tables["run_cards"][0]
        assert card["condition"] == "declarative-model"
        assert card["trust"] == "verified"
        assert "code-free by construction" in card["affirmation"]
        grants = world["fake"].tables["auth_grants"]
        assert len(grants) == 1 and grants[0]["used"] is True

    def test_declarative_pickle_rejected_at_import(self, world, tmp_path):
        # A declarative bundle whose weights are a pickle is staged 'rejected'
        # at import — the code-free validation runs on the airgapped machine,
        # and the refusal travels back (never executes).
        import hashlib
        import pickle
        from mt_eval_harness.model_bundle import build_model_bundle
        from test_model_runner import make_declarative_dir
        src = tmp_path / "evil-src"
        manifest = make_declarative_dir(src)
        (src / "model.safetensors").write_bytes(
            pickle.dumps({"w": list(range(64))}))
        built = build_model_bundle(model_dir=src, manifest=manifest,
                                   out_path=tmp_path / "evil.tar.gz")
        evil = Path(built["path"]).read_bytes()
        rid = "authreq-evil-declarative"
        row = {"request_id": rid, "sealed_set_id": SECRET_SET,
               "method_sha": hashlib.sha256(evil).hexdigest(),
               "corpus_id": SECRET_SET, "corpus_version": "v1",
               "node_measurement": AIRGAP_NODE, "fingerprint": "f" * 64,
               "requested_by": PARTICIPANT}
        exchange = tmp_path / "exchange"
        dest = exchange / "requests" / rid
        dest.mkdir(parents=True)
        (dest / "method.tar.gz").write_bytes(evil)
        (dest / "request.json").write_text(json.dumps({
            "exchange_version": "1", "contest_id": CONTEST_ID,
            "request": row, "audit_head_at_export": "aa" * 32,
        }), encoding="utf-8")

        import_bundle(exchange, config_path="airgap")
        state = json.loads((Path(world["airgap"]["airgap"]["state_dir"])
                            / rid / "state.json").read_text(encoding="utf-8"))
        assert state["status"] == "rejected"
        assert "Lane A" in state["reason"]
        with pytest.raises(AirgapTransportError, match="rejected"):
            run_imported(rid, config_path="airgap", translator=lambda *a: [])
