"""airgap_transport — the true-airgap file round trip (B3), offline.

Two "machines" in one process: the CONNECTED relay (fake Supabase + fake
bucket) and the AIRGAPPED scoring node (its own node config, its own state
dir, an injected container runtime). Work crosses a tmp exchange directory
exactly like a USB stick would:

  relay pass 1 → import-bundle → run-method --offline → export-scores →
  relay pass 2 → published run card.

The crypto is REAL: sealing via the champollion CLI (seal-corpus keygen/
seal — those tests skip cleanly where node/the cli tree is absent, the
Phase-A pattern) and score-bundle signing in PYTHON (sovereign.score_manifest,
`cryptography`) with the CLI as the fallback — the airgapped node's offline
bundle carries no Node.js, so export-scores must never depend on it.
TestSignerBridge pins the two implementations to one block format. Tamper cases assert the fail-closed edges: a
modified score bundle is refused by signature; a mismatched method tarball
is staged 'rejected' at import. And the exchange medium itself is scanned:
no secret reference text may ever appear in it (scores-only, strengthened).
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

import pytest

import mt_eval_harness.airgap_transport as at
from mt_eval_harness.sandbox_runner import holdout_defer_key as sr_holdout_key
from mt_eval_harness.airgap_transport import (
    AirgapTransportError,
    export_scores,
    import_bundle,
    relay,
    run_imported,
    stage_request,
    write_exchange_request,
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
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"
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
    # The PUBLIC gate rows (042/046): the relay checks a request's bundle
    # carries a receipt for THIS set's active qualifier before it exports
    # anything to the airgapped machine.
    fake.tables["qualifiers"].append({
        "qualifier_id": QUALIFIER_ID,
        "corpus_card_id": "eval-qaa-qab-synth-dev-v1",
        "sealed_set_id": BLIND_SET, "threshold": 50.0,
        "metric": "composite", "year": 2026, "status": "active",
    })
    fake.tables["sealed_sets"].append({
        "sealed_set_id": SECRET_SET, "current_qualifier_id": QUALIFIER_ID,
        "status": "active",
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
            CONTEST_ID: {"secret_set_id": SECRET_SET, "corpus_version": "v1",
                         # Exchange version 2: the relay ships the PUBLIC
                         # qualifier corpus so the air-gapped node can
                         # re-execute the gate itself.
                         "dev_corpus": str(DEV_CORPUS)},
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
        lambda p=None, **kw: configs[p or "connected"])

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


QUALIFIER_ROW = {
    "qualifier_id": QUALIFIER_ID,
    "corpus_card_id": "eval-qaa-qab-synth-dev-v1",
    "threshold": 50.0, "metric": "composite", "year": 2026,
    "status": "active",
}


def _hand_export(exchange, request_id, request_row, bundle_bytes, *,
                 exchange_version=None, qualifier=True):
    """Write one requests/<id>/ directory the way the relay would.

    ``qualifier=False`` reproduces an export that carries no qualifier facts
    (what a version-1 relay wrote); ``exchange_version`` forces a version
    string, for the old-bundle refusal test.
    """
    exchange_version = exchange_version or at.EXCHANGE_VERSION
    # The relay exports ONLY authorized rows (its select filters
    # state=eq.authorized and carries the column); a row with no state is
    # not an export shape, and the node refuses it (offline_authorization).
    request_row = {"state": "authorized", **request_row}
    dest = exchange / "requests" / request_id
    dest.mkdir(parents=True)
    (dest / "method.tar.gz").write_bytes(bundle_bytes)
    meta = {"exchange_version": exchange_version, "contest_id": CONTEST_ID,
            "request": request_row, "audit_head_at_export": "aa" * 32}
    if qualifier:
        blob = DEV_CORPUS.read_bytes()
        (dest / at.QUALIFIER_CORPUS_FILE).write_bytes(blob)
        meta["qualifier"] = dict(QUALIFIER_ROW)
        meta["qualifier_corpus"] = {
            "file": at.QUALIFIER_CORPUS_FILE,
            "sha256": hashlib.sha256(blob).hexdigest(),
        }
    (dest / "request.json").write_text(json.dumps(meta), encoding="utf-8")
    return dest


# ---------------------------------------------------------------------------
# Import-side edges that need no crypto.
# ---------------------------------------------------------------------------

class TestImportBundle:
    def _export_by_hand(self, exchange, request_id, request_row, bundle_bytes,
                        *, exchange_version=at.EXCHANGE_VERSION,
                        qualifier=True):
        _hand_export(exchange, request_id, request_row, bundle_bytes,
                     exchange_version=exchange_version, qualifier=qualifier)

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
        # The relay writes the SAME submission row the connected node writes:
        # the participant's declarations, from the manifest the signed score
        # bundle carried across the gap (the method bundle never leaves the
        # airgapped machine, so this is the relay's only copy).
        subs = world["fake"].tables["contest_submissions"]
        assert subs and subs[0]["run_card_id"] == card["id"]
        assert subs[0]["authorization_request_id"] == rid
        assert subs[0]["track"] in ("constrained", "unconstrained")
        assert subs[0]["is_primary"] is not None
        assert subs[0]["constraints"]
        assert subs[0]["submitter_label"] and "@" not in subs[0]["submitter_label"]
        # …and the board byline is that label, never the JWT email.
        assert card["submitter"] == subs[0]["submitter_label"]

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

    def test_scoring_leg_runs_with_every_socket_blocked(self, world, bundle,
                                                        tmp_path, monkeypatch):
        """The dark node scores a sealed run on a machine with NO network.

        Founder direction 2026-09-07: the scorer must complete air-gapped —
        no Supabase, no champollion.dev, no DNS — and anything it needs comes
        off the drive. The measured failure this encodes was the language-card
        index (publish.assemble_run_card resolved the pair over HTTP and the
        run died), but the guarantee is the general one, so the test does not
        stub a URL: it removes the socket layer entirely for the whole scoring
        leg. Any reach for the network — a card index, the dataset registry, a
        token refresh, a metric model download — fails the test HERE rather
        than on a node nobody can debug.

        Publishing is deliberately outside this leg: the node writes a signed
        score bundle, the host carries it out and uploads the card by hand.
        """
        import socket as _socket

        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

        # Connected half first — the relay legitimately has a network.
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"
        relay(exchange, config_path="connected")

        opened: list[str] = []

        def _blocked(*args, **kwargs):
            opened.append("socket")
            raise OSError("this node is dark: no socket may be opened")

        for name in ("socket", "create_connection", "getaddrinfo",
                     "gethostbyname"):
            monkeypatch.setattr(_socket, name, _blocked)

        # The node's card index is the one that CAME IN ON THE DRIVE — not a
        # monorepo checkout, which a real node does not have. This is the
        # shape the deploy kit builds (`--include <cards>` +
        # MT_EVAL_CARDS_DIR), and the shape the measured failure had.
        from mt_eval_harness import language_cards as _lc
        carried = tmp_path / "drive-cards"
        carried.mkdir()
        (carried / "eng.json").write_text(
            json.dumps({"code": "eng", "name": "English"}), encoding="utf-8")
        monkeypatch.setenv("MT_EVAL_CARDS_DIR", str(carried))
        _lc.reset_state()
        try:
            assert import_bundle(exchange, config_path="airgap") == [rid]
            state = run_imported(rid, config_path="airgap",
                                 runner=FakeRuntime())
            assert state["status"] == "scored", state.get("reason")
            assert export_scores(exchange, config_path="airgap") == [rid]
            # Not a vacuous pass: the index was reset immediately above, so
            # it is loaded ONLY if the scoring leg actually read it — and it
            # read the drive's copy, not a checkout.
            assert _lc._loaded is True, \
                "the scoring leg never consulted the card index at all"
            assert _lc._cards_dir == carried, \
                "the node read cards from somewhere other than the drive"
        finally:
            _lc.reset_state()
        assert (exchange / "scores" / rid / "score-bundle.json").is_file()
        assert opened == [], "the dark node tried to open a socket"

        # The air-gap posture is unchanged by running dark: the score bundle
        # carries aggregates, not per-segment output or a participant email.
        bundle_json = json.loads(
            (exchange / "scores" / rid / "score-bundle.json")
            .read_text(encoding="utf-8"))
        row = bundle_json["row"]
        assert row.get("entry_count") is None or "entries" not in row
        assert "@" not in str(row.get("submitter") or "")

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
        # healthy_runs=1: the node re-executes the method on the PUBLIC dev
        # set before it opens anything sealed, so the run that fails here is
        # the SEALED one — which is what this test is about.
        state = run_imported(rid, config_path="airgap",
                             runner=FakeRuntime("exit1", healthy_runs=1))
        assert state["status"] == "failed"
        export_scores(exchange, config_path="airgap")

        out = relay(exchange, config_path="connected")
        assert out["published"] == []
        assert not world["fake"].tables["run_cards"]
        marker = json.loads((exchange / "scores" / rid / ".relayed.json")
                            .read_text(encoding="utf-8"))
        assert marker["outcome"] == "rejected"
        assert "exited 1" in marker["reason"]

    def test_hidden_until_close_withholds_the_relayed_card(self, world,
                                                           bundle, tmp_path):
        """Contract C5 across the gap: one publication policy, two transports.

        The relay is the publisher for an air-gapped run, so the contest's
        promise has to be honoured HERE too — otherwise "hidden until close"
        would hold on the connected node and silently break the moment an
        organizer moved to the sneakernet."""
        from mt_eval_harness import contest_node as cn
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}
        world["fake"].tables["contests"][0]["metadata"] = {
            "results_visibility": "hidden_until_close"}

        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"
        relay(exchange, config_path="connected")
        assert import_bundle(exchange, config_path="airgap") == [rid]
        assert run_imported(rid, config_path="airgap",
                            runner=FakeRuntime())["status"] == "scored"
        export_scores(exchange, config_path="airgap")

        out = relay(exchange, config_path="connected")
        assert out["published"] == [rid], "the relay handled the bundle"
        assert world["fake"].tables["run_cards"] == [], \
            "nothing reaches the board while the contest is open"
        assert world["fake"].tables["contest_submissions"] == []
        held = world["fake"].tables["contest_deferred_results"]
        assert len(held) == 1 and held[0]["request_id"] == rid
        assert held[0]["sealed_set_id"] == SECRET_SET
        card = cn._strip_sidecar(held[0]["run_card_row"])
        assert "AIRGAPPED" in card["affirmation"]
        # The grant was still claimed with the airgap transport evidence.
        used = [e for e in world["fake"].tables["authorization_audit_log"]
                if e["event_type"] == "grant_used"]
        assert used and used[0]["detail"]["transport"] == "airgap-relay"
        marker = json.loads((exchange / "scores" / rid / ".relayed.json")
                            .read_text(encoding="utf-8"))
        assert marker["outcome"] == "deferred"
        assert marker["results_visibility"] == "hidden_until_close"
        # A third pass moves nothing (the marker is the transport's own
        # done-flag either way).
        assert relay(exchange, config_path="connected") == {
            "exported": [], "published": []}
        # …and the close publishes exactly what the gap carried.
        assert cn.publish_deferred(CONTEST_ID) == [card["id"]]
        assert world["fake"].tables["run_cards"] == [card]
        assert world["fake"].tables["contest_submissions"][0][
            "authorization_request_id"] == rid

    def test_relayed_card_for_an_unknown_contest_is_refused(self, world,
                                                            bundle, tmp_path):
        """The relay cannot read a policy it cannot find, so it publishes
        nothing rather than assuming 'immediate'."""
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
        world["fake"].tables["contests"].clear()

        out = relay(exchange, config_path="connected")
        assert out["published"] == []
        assert world["fake"].tables["run_cards"] == []
        assert world["fake"].tables["contest_deferred_results"] == []
        assert not (exchange / "scores" / rid / ".relayed.json").exists()


# ---------------------------------------------------------------------------
# TWO drives, which is what a real sneakernet is.
#
# Every round-trip test above uses ONE tmp directory for both legs, so the
# `requests/<id>/` the outbound leg wrote is still sitting there when the
# return leg runs and `export_requests` skips on `dest.exists()`. A real
# operator carries an IN drive over and an OUT drive back, and the OUT drive
# has no requests/ at all — which is how the 2026-09-07 sovereign rehearsal
# caught the relay re-exporting the very request whose signed scores it was
# about to import. These tests hold the two media apart so that path is
# actually exercised.
# ---------------------------------------------------------------------------

class TestTwoDriveRelay:
    def _wire(self, world, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

    def test_return_drive_never_carries_the_method_back(self, world, bundle,
                                                        tmp_path):
        """The wart the rehearsal measured: scores in, nothing back out.

        The return leg publishes the scores and then has nothing to export —
        because the scores-in half wrote `.relayed.json` first. Before the
        fix this leg wrote `requests/<rid>/method.tar.gz` onto the OUT drive:
        a participant's method bundle back on removable media for nothing.
        """
        self._wire(world, tmp_path)
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        in_drive = tmp_path / "drive-in"
        out_drive = tmp_path / "drive-out"

        # Outbound leg: the request goes over on the IN drive.
        assert relay(in_drive, config_path="connected") == {
            "exported": [rid], "published": []}

        # The air-gapped machine reads the IN drive and writes the OUT drive.
        assert import_bundle(in_drive, config_path="airgap") == [rid]
        assert run_imported(rid, config_path="airgap",
                            runner=FakeRuntime())["status"] == "scored"
        assert export_scores(out_drive, config_path="airgap") == [rid]
        assert not (out_drive / "requests").exists(), \
            "the airgapped node writes scores only"

        # Return leg: publish, and export NOTHING.
        assert relay(out_drive, config_path="connected") == {
            "exported": [], "published": [rid]}
        assert len(world["fake"].tables["run_cards"]) == 1
        assert not (out_drive / "requests").exists(), \
            ("the relay put the request back on the OUT drive — the method "
             "tarball crossed the gap for nothing (SOVEREIGN_SMOKE "
             "2026-09-07)")
        assert not list(out_drive.rglob("*.tar.gz"))

        # And a third pass still moves nothing.
        assert relay(out_drive, config_path="connected") == {
            "exported": [], "published": []}
        assert not (out_drive / "requests").exists()

    def test_a_refused_bundle_leaves_the_request_exportable(self, world,
                                                            bundle, tmp_path):
        """The other half of the contract, deliberately NOT symmetric.

        A score bundle that fails verification retires nothing: no marker, no
        grant, no card. The request is still authorized work, so the relay
        DOES put it back on the medium and the round trip can be redone. That
        is why the fix is the ordering and not "skip whenever a scores/<id>/
        directory exists" — the latter would strand a request forever behind
        one corrupt bundle.
        """
        self._wire(world, tmp_path)
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        in_drive = tmp_path / "drive-in"
        out_drive = tmp_path / "drive-out"
        relay(in_drive, config_path="connected")
        import_bundle(in_drive, config_path="airgap")
        run_imported(rid, config_path="airgap", runner=FakeRuntime())
        export_scores(out_drive, config_path="airgap")

        payload = out_drive / "scores" / rid / "score-bundle.json"
        doctored = json.loads(payload.read_text(encoding="utf-8"))
        doctored["qualifier_score"] = 99.99
        payload.write_text(json.dumps(doctored, indent=2, sort_keys=True)
                           + "\n", encoding="utf-8")

        out = relay(out_drive, config_path="connected")
        assert out["published"] == []
        assert not world["fake"].tables["run_cards"]
        assert not (out_drive / "scores" / rid / ".relayed.json").exists()
        assert out["exported"] == [rid], \
            "work whose scores were refused must still be re-exportable"
        assert (out_drive / "requests" / rid / "method.tar.gz").is_file()


class TestCompletedState:
    """Migration 075: done-ness moves off the drive and onto the row.

    The `.relayed.json` done-marker lives on the exchange MEDIUM. A drive can
    be lost, reformatted, or simply be the second one — and the request row
    still read `authorized` forever, so a relay pass against a fresh medium
    re-exported work whose scores published days ago. `export_requests`
    already selects state='authorized', so recording 'completed' on the row is
    the whole fix.
    """

    def _wire(self, world, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

    def _round_trip(self, world, bundle, tmp_path, tag="a"):
        if not world["connected"]["relay"]:
            self._wire(world, tmp_path)
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        in_drive = tmp_path / f"in-{tag}"
        out_drive = tmp_path / f"out-{tag}"
        relay(in_drive, config_path="connected")
        import_bundle(in_drive, config_path="airgap")
        run_imported(rid, config_path="airgap", runner=FakeRuntime())
        export_scores(out_drive, config_path="airgap")
        relay(out_drive, config_path="connected")
        return rid

    def _state(self, world, rid):
        rows = [r for r in world["fake"].tables["authorization_requests"]
                if r["request_id"] == rid]
        assert rows, f"no request row for {rid}"
        return rows[0]["state"]

    def test_a_recorded_result_completes_the_request(self, world, bundle,
                                                     tmp_path):
        rid = self._round_trip(world, bundle, tmp_path)
        assert len(world["fake"].tables["run_cards"]) == 1
        assert self._state(world, rid) == "completed"

    def test_a_fresh_medium_does_not_re_export_completed_work(
            self, world, bundle, tmp_path):
        """The residual the ordering fix could not close."""
        rid = self._round_trip(world, bundle, tmp_path)
        fresh = tmp_path / "brand-new-drive"
        out = relay(fresh, config_path="connected")
        assert out["exported"] == [], (
            "a request whose scores are already recorded must not be carried "
            "again just because this drive has never seen it")
        assert not (fresh / "requests").exists()
        assert not list(fresh.rglob("*.tar.gz"))

    def test_a_refused_run_leaves_the_request_authorized(self, world, bundle,
                                                         tmp_path):
        """'completed' means RECORDED, never merely 'ran'.

        A run the node refused or failed records nothing, so that work can
        legitimately be carried again — the request must stay authorized.
        """
        self._wire(world, tmp_path)
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        in_drive, out_drive = tmp_path / "in-r", tmp_path / "out-r"
        relay(in_drive, config_path="connected")
        import_bundle(in_drive, config_path="airgap")
        state = run_imported(rid, config_path="airgap",
                             runner=FakeRuntime("exit1", healthy_runs=1))
        assert state["status"] == "failed"
        export_scores(out_drive, config_path="airgap")
        relay(out_drive, config_path="connected")
        assert not world["fake"].tables["run_cards"]
        assert self._state(world, rid) == "authorized"

    def test_a_database_without_075_still_publishes(self, world, bundle,
                                                    tmp_path, monkeypatch,
                                                    capsys):
        """Pre-075 the state CHECK refuses 'completed'. Say so, publish anyway.

        Refusing to finish publishing a verified score over an optional row
        update would trade a real result for a nice-to-have.
        """
        self._wire(world, tmp_path)
        import mt_eval_harness.sovereign_service as svc
        real = svc.service_request

        def refuse_completed(method, table, **kw):
            if (method == "PATCH" and table == "authorization_requests"
                    and (kw.get("data") or {}).get("state") == "completed"):
                raise RuntimeError(
                    'violates check constraint '
                    '"authorization_requests_state_check"')
            return real(method, table, **kw)
        monkeypatch.setattr(svc, "service_request", refuse_completed)

        rid = self._round_trip(world, bundle, tmp_path, tag="pre075")
        assert len(world["fake"].tables["run_cards"]) == 1, \
            "the verified score must still publish"
        assert self._state(world, rid) == "authorized"
        out = capsys.readouterr().out
        assert "migration" in out and "075" in out


class TestRelayHalvesAreIndependent:
    """One bad score bundle must not become a stop-work order.

    Putting scores-in first would otherwise let a bundle that RAISES (a grant
    that cannot be claimed, a publication policy that cannot be applied, a
    database error mid-publish — the paths import_scores does not turn into a
    printed refusal) hold the outbound half hostage: nothing is recorded for
    a raise, so it repeats on every later pass and the requests waiting for
    the air-gapped node would never reach the medium at all.
    """

    def test_a_raising_score_bundle_still_lets_requests_out(
            self, world, bundle, tmp_path, monkeypatch, capsys):
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        world["connected"]["relay"] = {"verify_key": "unused-on-export",
                                       "airgap_node_id": AIRGAP_NODE}
        boom = RuntimeError("grant could not be claimed")

        def explode(exchange, cfg):
            raise boom
        monkeypatch.setattr(at, "import_scores", explode)

        medium = tmp_path / "usb-poisoned"
        with pytest.raises(RuntimeError) as e:
            relay(medium, config_path="connected")
        # The failure is still loud and unmasked …
        assert e.value is boom
        # … and the outbound half ran anyway.
        assert (medium / "requests" / rid / "method.tar.gz").is_file()
        out = capsys.readouterr().out
        assert "scores-in FAILED" in out
        assert "retried on the next pass" in out


def _signed_score_bundle(exchange, request_id, *, method_sha, key, card_id,
                         score=61.5):
    """Write one signed `scores/<id>/` the way `export_scores` would.

    Hand-built on purpose: these are tests about what the relay does with a
    MEDIUM CARRYING SEVERAL bundles, and building two of them out of two
    whole air-gapped runs would test the runs, not the medium.
    """
    dest = exchange / "scores" / request_id
    dest.mkdir(parents=True, exist_ok=True)
    bundle = {
        "exchange_version": at.EXCHANGE_VERSION,
        "request_id": request_id,
        "contest_id": None,
        "sealed_set_id": SECRET_SET,
        "fingerprint": compute_request_fingerprint(
            {"method_sha": method_sha, "corpus_id": SECRET_SET,
             "corpus_version": "v1"}, node_measurement=AIRGAP_NODE),
        "method_sha": method_sha,
        "corpus_version": "v1",
        "node_id": AIRGAP_NODE,
        "status": "scored",
        "reason": None,
        "card_id": card_id,
        "qualifier_score": score,
        "row": {
            "id": card_id,
            "submitter": PARTICIPANT,
            "affirmation": "aggregates-only, scored air-gapped",
            "trust": "verified",
            "model_slug": "synthetic-method",
            "dataset_id": SECRET_SET,
            "language_pair": "qaa>qab",
            "harness_version": "test",
            "run_card": {"scores": {"composite": score}},
            "fingerprint_hash": "cc" * 32,
            "condition": "",
        },
        "audit_head_at_export": "aa" * 32,
        "exported_at": "2026-09-07T00:00:00+00:00",
    }
    payload = dest / "score-bundle.json"
    payload.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n", encoding="utf-8")
    at.sign_file(payload, key)
    return dest


class TestOneBundleCannotStopTheOthers:
    """A medium carries several PARTICIPANTS. One failure is one of them.

    `import_scores` turns its own refusals into a printed reason and a skip,
    but the calls it makes can raise — a grant that cannot be claimed, a
    publication policy that cannot be applied, a database error mid-publish.
    Those used to escape the loop, so a medium carrying several score
    bundles published only the ones sorted before the first failure, and the
    ones behind it stayed stuck behind it on every later pass too (nothing
    is recorded for a raise, so it repeats). Found by the audit during the
    2026-09-07 air-gap relay work and left out of scope there; this is the
    containment.

    These drive `import_scores` directly rather than `relay`: the outbound
    half's independence is `TestRelayHalvesAreIndependent`'s subject, and
    what is under test here is the scores-in half's own loop.
    """

    def _two_bundles(self, world, tmp_path):
        """Two signed bundles on ONE medium; the first sorts first."""
        pub, key = _any_sign_keys(tmp_path)
        world["connected"]["relay"] = {"verify_key": str(pub),
                                       "airgap_node_id": AIRGAP_NODE}
        first = world["propose"]("aa" * 32, request_id="authreq-1-first")
        second = world["propose"]("bb" * 32, request_id="authreq-2-second")
        medium = tmp_path / "usb-two-participants"
        _signed_score_bundle(medium, first, method_sha="aa" * 32, key=key,
                             card_id="card-first")
        _signed_score_bundle(medium, second, method_sha="bb" * 32, key=key,
                             card_id="card-second")
        assert sorted(p.name for p in (medium / "scores").iterdir()) \
            == [first, second], "the failing bundle must be the FIRST one"
        return medium, first, second

    def test_a_grant_that_cannot_be_claimed_stops_only_its_own_bundle(
            self, world, tmp_path, monkeypatch, capsys):
        """The raise the finding names: claim_auth_grant returns no row."""
        import mt_eval_harness.contest_node as cn
        medium, first, second = self._two_bundles(world, tmp_path)
        fake = world["fake"]
        real_rpc = cn.rpc

        def claim_refuses_the_first(name, args, **kw):
            if name == "claim_auth_grant":
                grant = next(g for g in fake.tables["auth_grants"]
                             if g["grant_id"] == args["p_grant_id"])
                if grant["request_id"] == first:
                    return []  # expired, already used, or mismatched
            return real_rpc(name, args, **kw)
        monkeypatch.setattr(cn, "rpc", claim_refuses_the_first)

        published = at.import_scores(medium, world["connected"])

        # The bundle BEHIND the failure was imported anyway.
        assert published == [second]
        assert [r["id"] for r in fake.tables["run_cards"]] == ["card-second"]
        assert (medium / "scores" / second / ".relayed.json").is_file()
        # Nothing was recorded for the one that raised, so a later pass
        # retries it instead of stranding the participant's score.
        assert not (medium / "scores" / first / ".relayed.json").exists()
        # And it consumed no grant: minting is not claiming.
        used = [e for e in fake.tables["authorization_audit_log"]
                if e["event_type"] == "grant_used"]
        assert [e["request_id"] for e in used] == [second]
        assert not [g for g in fake.tables["auth_grants"]
                    if g["request_id"] == first and g.get("used")]
        out = capsys.readouterr().out
        assert "RuntimeError" in out, "name the exception type"
        assert "retried on the next pass" in out
        assert first in out and "could not be imported" in out, \
            "the pass summary must name what it left behind"

    def test_a_publish_that_raises_is_retried_on_the_next_pass(
            self, world, tmp_path, monkeypatch, capsys):
        """The other raise: the publication policy cannot be applied.

        Also the reason a contained failure must write NO marker — the very
        next pass publishes the score the failing one left on the medium.
        """
        import mt_eval_harness.contest_node as cn
        from mt_eval_harness.contest_node import PublicationPolicyError
        medium, first, second = self._two_bundles(world, tmp_path)
        fake = world["fake"]
        real_publish = cn.publish_or_defer
        failing = {"on": True}

        def publish_refuses_the_first(row, **kw):
            if failing["on"] and row["id"] == "card-first":
                raise PublicationPolicyError("policy could not be applied")
            return real_publish(row, **kw)
        monkeypatch.setattr(cn, "publish_or_defer",
                            publish_refuses_the_first)

        assert at.import_scores(medium, world["connected"]) == [second]
        assert [r["id"] for r in fake.tables["run_cards"]] == ["card-second"]
        assert not (medium / "scores" / first / ".relayed.json").exists()
        out = capsys.readouterr().out
        assert "PublicationPolicyError" in out, "name the exception type"

        # Whatever the failure was, it is over: the next pass publishes the
        # score, and does not re-publish the one already marked.
        failing["on"] = False
        assert at.import_scores(medium, world["connected"]) == [first]
        assert [r["id"] for r in fake.tables["run_cards"]] \
            == ["card-second", "card-first"]
        assert (medium / "scores" / first / ".relayed.json").is_file()


class TestRelayNodeConfig:
    """A half-configured relay fails WHOLE, before the medium is touched.

    Ordering the halves made the config precondition visible: whichever half
    runs first is the one that raises, so the fix is to stop letting a pass
    depend on that at all. `relay` checks the `relay` block up front and
    writes nothing; the message names the missing field, what it is for and
    where to get it.
    """

    def test_missing_relay_block_writes_nothing(self, world, bundle,
                                                tmp_path):
        world["propose"](bundle["method_sha"],
                         upload=bundle["tarball"].read_bytes())
        world["connected"]["relay"] = {}
        medium = tmp_path / "usb-unconfigured"
        with pytest.raises(AirgapTransportError) as e:
            relay(medium, config_path="connected")
        msg = str(e.value)
        assert "relay.airgap_node_id" in msg and "relay.verify_key" in msg
        assert "node keygen" in msg, "say where the key comes from"
        assert "Nothing was written" in msg
        # The check runs before the medium is even created, so the claim in
        # that message is literally true — not "created the directory, then
        # stopped".
        assert not medium.exists()

    def test_message_names_only_what_is_missing(self, world, tmp_path):
        world["connected"]["relay"] = {"airgap_node_id": AIRGAP_NODE}
        with pytest.raises(AirgapTransportError) as e:
            relay(tmp_path / "usb-halfconfigured", config_path="connected")
        msg = str(e.value)
        assert "relay.verify_key" in msg
        assert "relay.airgap_node_id" not in msg, \
            "do not send the operator hunting for a field they already set"

    def test_export_refuses_without_the_node_it_serves(self, world, bundle,
                                                       tmp_path):
        """The fail-OPEN remnant of the D6 fix.

        `export_requests` filters on relay.airgap_node_id so it carries only
        the work bound to the machine it serves. An unset value used to make
        that filter a silent no-op — every authorized request on the box,
        including work bound to other nodes, onto the medium.
        """
        world["propose"](bundle["method_sha"],
                         upload=bundle["tarball"].read_bytes())
        with pytest.raises(AirgapTransportError,
                           match="relay.airgap_node_id"):
            at.export_requests(tmp_path / "usb-nofilter",
                               {**world["connected"], "relay": {}})


class TestRelayHalfOrder:
    def test_scores_in_before_requests_out(self, world, tmp_path,
                                           monkeypatch):
        """Pin the order itself, without needing the crypto.

        `relay` is two calls in one function and the marker that makes the
        whole thing idempotent is written by the first of them. A future edit
        that swaps them back would pass every same-directory round trip in
        this file, so the order gets its own test.
        """
        world["connected"]["relay"] = {"verify_key": "unused-here",
                                       "airgap_node_id": AIRGAP_NODE}
        calls = []
        monkeypatch.setattr(at, "import_scores",
                            lambda ex, cfg: (calls.append("scores-in"), [])[1])
        monkeypatch.setattr(at, "export_requests",
                            lambda ex, cfg: (calls.append("requests-out"),
                                             [])[1])
        relay(tmp_path / "medium", config_path="connected")
        assert calls == ["scores-in", "requests-out"]


# ---------------------------------------------------------------------------
# Execution facts + counts-only diagnostics across the air gap.
#
# The gap is the hard case for practice 12: the machine that knows what
# happened has no network at all, so anything the participant learns has to
# fit on the removable medium AND survive the aggregates-only rule. Counts
# and a stage do; a stderr tail does not.
# ---------------------------------------------------------------------------

class TestExecutionFactsAcrossTheGap:
    def _keys(self, world, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

    def test_score_bundle_carries_execution_and_diagnostics(
            self, world, bundle, tmp_path):
        from mt_eval_harness.execution_facts import no_text_guard

        self._keys(world, tmp_path)
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"
        relay(exchange, config_path="connected")
        import_bundle(exchange, config_path="airgap")
        state = run_imported(rid, config_path="airgap", runner=FakeRuntime())
        assert state["status"] == "scored", state.get("reason")

        # 1. Node state: both blocks recorded locally.
        assert state["execution"]["node_id"] == AIRGAP_NODE
        assert state["execution"]["runtime_seconds"] is not None
        assert state["diagnostics"]["outcome"] == "scored"
        assert state["diagnostics"]["n_scored"] == 6
        no_text_guard(state["diagnostics"])

        # 2. The medium: both cross, and neither carries corpus text or a
        #    node-local path.
        export_scores(exchange, config_path="airgap")
        payload = (exchange / "scores" / rid / "score-bundle.json")
        sent = json.loads(payload.read_text(encoding="utf-8"))
        assert sent["execution"] == state["execution"]
        assert sent["diagnostics"] == state["diagnostics"]
        raw = payload.read_text(encoding="utf-8")
        assert SECRET_TOKEN not in raw
        assert "translations_path" not in raw
        assert str(tmp_path) not in raw
        # The card the relay will publish carries the facts (contract C4).
        assert sent["row"]["run_card"]["execution"] == state["execution"]

        # 3. The relay: publishes the row AND records the diagnostics.
        out = relay(exchange, config_path="connected")
        assert out["published"] == [rid]
        recorded = world["fake"].request(rid)["execution_diagnostics"]
        assert recorded == state["diagnostics"]
        card = world["fake"].tables["run_cards"][0]
        assert card["run_card"]["execution"]["node_id"] == AIRGAP_NODE

    def test_failed_run_relays_its_stage(self, world, bundle, tmp_path):
        """A refusal is the case where the stage matters most.

        No card, no grant — but the participant still learns the run exited
        non-zero rather than, say, timing out or emitting nothing.
        """
        from mt_eval_harness.execution_facts import no_text_guard

        self._keys(world, tmp_path)
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"
        relay(exchange, config_path="connected")
        import_bundle(exchange, config_path="airgap")
        state = run_imported(rid, config_path="airgap",
                             runner=FakeRuntime("exit1", healthy_runs=1))
        assert state["status"] == "failed"
        assert state["diagnostics"]["stage"] == "exit"
        assert state["diagnostics"]["exit_code"] == 1
        assert state["execution"] is None, \
            "a run that produced no score has no execution facts to publish"

        export_scores(exchange, config_path="airgap")
        sent = json.loads((exchange / "scores" / rid / "score-bundle.json")
                          .read_text(encoding="utf-8"))
        assert sent["status"] == "rejected"
        no_text_guard(sent["diagnostics"])
        # The stderr tail rides in `reason` (operator-facing, never a card);
        # the diagnostics channel carries only its SIZE.
        assert sent["diagnostics"]["stderr_bytes"] > 0
        assert "spectacularly" not in json.dumps(sent["diagnostics"])

        out = relay(exchange, config_path="connected")
        assert out["published"] == []
        assert not world["fake"].tables["run_cards"]
        assert world["fake"].request(rid)["execution_diagnostics"] == \
            state["diagnostics"]

    def test_pre_074_database_still_publishes(self, world, bundle, tmp_path,
                                              monkeypatch, capsys):
        """A missing diagnostics column must never cost a real score."""
        import mt_eval_harness.sovereign_service as svc

        self._keys(world, tmp_path)
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb-stick"
        relay(exchange, config_path="connected")
        import_bundle(exchange, config_path="airgap")
        run_imported(rid, config_path="airgap", runner=FakeRuntime())
        export_scores(exchange, config_path="airgap")

        fake = world["fake"]

        def refuse_diagnostics(method, path, *, data=None, params=None, **kw):
            if (method == "PATCH" and path == "authorization_requests"
                    and "execution_diagnostics" in (data or {})):
                raise RuntimeError(
                    'Supabase service API error (400): {"code":"42703",'
                    '"message":"column \\"execution_diagnostics\\" of '
                    'relation \\"authorization_requests\\" does not exist"}')
            return fake(method, path, data=data, params=params, **kw)

        monkeypatch.setattr(svc, "service_request", refuse_diagnostics)
        out = relay(exchange, config_path="connected")
        assert out["published"] == [rid]
        assert "diagnostics not recorded" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# THRESHOLD LANE (sovereign ceremony custody) — the same round trip, but the
# corpus is sealed to a ceremony key and unsealed only by an M-of-N quorum
# presented at run time; the local hash-chained ledger records everything and
# the run emits a signed score manifest. Pure-Python crypto (no champollion
# CLI needed to seal), so these tests skip only on a missing `cryptography`.
# ---------------------------------------------------------------------------

@pytest.fixture
def ceremony_world(world, tmp_path):
    pytest.importorskip(
        "cryptography",
        reason="threshold lane needs cryptography "
               "(pip install 'mt-eval-harness[node]')")
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


class TestThresholdLane:
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

        # v2 (V2 0b/7): the signed manifest names what computed the scores
        # and binds the method's public index record by sha256. The record
        # re-derives from its canonical bytes and carries no contest binding
        # and no email.
        import hashlib
        from mt_eval_harness import __version__ as hv
        assert manifest["harnessVersion"] == hv
        assert manifest["engineVersions"]["sacrebleu"]
        record_bytes = (manifest_path.parent / "index-record.json").read_bytes()
        assert hashlib.sha256(record_bytes).hexdigest() == manifest["indexEntrySha256"]
        record = json.loads(record_bytes)
        assert record["methodSha256"] == bundle["method_sha"]
        assert "@" not in record_bytes.decode("utf-8")
        assert "corpusId" not in record_bytes.decode("utf-8")
        assert "qualifier" not in record

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
        # stand-in lane (same §9 path). export-scores signs in PYTHON here
        # and the relay verifies in Python — no Node.js anywhere, which is
        # the airgapped node's reality (its offline bundle carries none).
        # This leg ALWAYS runs; it used to return silently without the CLI.
        w["connected"]["relay"] = {"verify_key": str(w["sign_pub"]),
                                   "airgap_node_id": AIRGAP_NODE}
        assert export_scores(exchange, config_path="airgap") == [rid]
        assert (exchange / "scores" / rid
                / "score-bundle.json.sig.json").is_file()
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
        _hand_export(exchange, rid, row, evil)

        import_bundle(exchange, config_path="airgap")
        state = json.loads((Path(world["airgap"]["airgap"]["state_dir"])
                            / rid / "state.json").read_text(encoding="utf-8"))
        assert state["status"] == "rejected"
        assert "Lane A" in state["reason"]
        with pytest.raises(AirgapTransportError, match="rejected"):
            run_imported(rid, config_path="airgap", translator=lambda *a: [])


# ---------------------------------------------------------------------------
# B3 signer bridge: ONE block format, TWO implementations. The airgapped
# node's offline bundle carries no Node.js, so sign_file/verify_file run in
# Python whenever `cryptography` imports and fall back to the champollion CLI
# only where it does not — and always print which one ran.
# ---------------------------------------------------------------------------

def _node_cli_or_reason():
    """The champollion CLI argv, or (None, why) when it is unavailable."""
    from mt_eval_harness.contest_prep import (
        ContestPrepError,
        find_champollion_cli,
    )
    if shutil.which("node") is None:
        return None, "no `node` on PATH"
    try:
        return find_champollion_cli(), ""
    except ContestPrepError as e:
        return None, str(e)


def _python_sign_keys(tmp_path):
    pytest.importorskip(
        "cryptography",
        reason="python signer needs cryptography "
               "(pip install 'mt-eval-harness[node]')")
    from mt_eval_harness.sovereign.threshold_seal import (
        generate_signing_keypair,
    )
    pair = generate_signing_keypair()
    key = tmp_path / "py-sign.key.json"
    pub = tmp_path / "py-sign.pub.json"
    key.write_text(json.dumps(pair), encoding="utf-8")
    pub.write_text(json.dumps({"keyId": pair["keyId"],
                               "publicKeyDerB64": pair["publicKeyDerB64"]}),
                   encoding="utf-8")
    return pub, key


def _any_sign_keys(tmp_path):
    """Signing keys from whichever implementation this machine has —
    Python (`cryptography`) first, else the champollion CLI; skip if
    neither. Both write the same file shape."""
    try:
        import cryptography  # noqa: F401
    except ImportError:
        return _sign_keygen(tmp_path)  # skips when node/the CLI is absent
    return _python_sign_keys(tmp_path)


class TestSignerBridge:
    def test_python_signed_bundle_verifies_in_python_and_node(self, tmp_path,
                                                             capsys):
        pub, key = _python_sign_keys(tmp_path)
        payload = tmp_path / "score-bundle.json"
        payload.write_text(json.dumps(
            {"synthetic": True, "qualifier_score": 97.5, "status": "scored"},
            indent=2, sort_keys=True) + "\n", encoding="utf-8")

        sig = at.sign_file(payload, key)
        assert sig == payload.with_name("score-bundle.json.sig.json")
        assert "signer: python" in capsys.readouterr().err
        block = json.loads(sig.read_text(encoding="utf-8"))
        assert block["scheme"] == "ed25519-single-node-wave1"
        assert {"keyId", "payloadSha256", "signatureB64", "signedAt"} \
            <= set(block)
        assert block["payloadSha256"] == hashlib.sha256(
            payload.read_bytes()).hexdigest()

        # Python verifies; a doctored payload is refused.
        assert at.verify_file(payload, sig, pub) is True
        assert "verifier: python" in capsys.readouterr().err
        doctored = tmp_path / "doctored.json"
        doctored.write_text(payload.read_text(encoding="utf-8")
                            .replace("97.5", "99.9"), encoding="utf-8")
        assert at.verify_file(doctored, sig, pub) is False

        # Cross-implementation: the Node CLI verifies the very same block
        # (and refuses the doctored payload). Skip THIS half, loudly, where
        # node or the cli tree is absent — the Python half above still ran.
        cli, why = _node_cli_or_reason()
        if cli is None:
            print(f"node half of the signer parity test skipped: {why}")
            return
        ok = subprocess.run(
            cli + ["seal-corpus", "verify", "--payload", str(payload),
                   "--sig", str(sig), "--pubkey", str(pub)],
            capture_output=True, text=True, timeout=120)
        assert ok.returncode == 0, ok.stderr or ok.stdout
        bad = subprocess.run(
            cli + ["seal-corpus", "verify", "--payload", str(doctored),
                   "--sig", str(sig), "--pubkey", str(pub)],
            capture_output=True, text=True, timeout=120)
        assert bad.returncode != 0

    def test_node_fallback_when_cryptography_absent(self, tmp_path,
                                                    monkeypatch, capsys):
        cli, why = _node_cli_or_reason()
        if cli is None:
            pytest.skip(f"node fallback needs the champollion CLI: {why}")
        pub, key = _sign_keygen(tmp_path)
        monkeypatch.setattr(at, "_python_signer_available", lambda: False)
        payload = tmp_path / "score-bundle.json"
        payload.write_text('{"synthetic": true}\n', encoding="utf-8")
        sig = at.sign_file(payload, key)
        err = capsys.readouterr().err
        assert "signer: node" in err and "not importable" in err
        assert at.verify_file(payload, sig, pub) is True
        assert "verifier: node" in capsys.readouterr().err

    def test_node_signed_bundle_verifies_in_python(self, tmp_path, capsys):
        pytest.importorskip("cryptography",
                            reason="python verifier needs cryptography")
        cli, why = _node_cli_or_reason()
        if cli is None:
            pytest.skip(f"cross-check needs the champollion CLI: {why}")
        pub, key = _sign_keygen(tmp_path)
        payload = tmp_path / "p.json"
        payload.write_text('{"synthetic": true}\n', encoding="utf-8")
        sig = payload.with_name("p.json.sig.json")
        proc = subprocess.run(
            cli + ["seal-corpus", "sign", "--payload", str(payload),
                   "--privkey", str(key), "--sig-out", str(sig)],
            capture_output=True, text=True, timeout=120)
        assert proc.returncode == 0, proc.stderr or proc.stdout
        assert at.verify_file(payload, sig, pub) is True
        assert "verifier: python" in capsys.readouterr().err


# ---------------------------------------------------------------------------
# `node stage-request` — the DB-less organizer-side request stager. One
# writer (write_exchange_request) behind the relay, submit-method --offline
# and this verb; one reader (import_bundle) in front of all three.
# ---------------------------------------------------------------------------

class TestStageRequest:
    def _stage(self, bundle, tmp_path, *, config="airgap", **kw):
        exchange = tmp_path / "usb-staged"
        out = stage_request(
            bundle["tarball"], contest_id=CONTEST_ID,
            requested_by=PARTICIPANT, exchange_dir=exchange,
            config_path=config, **kw)
        return out, exchange

    def test_stage_import_quorum_run_scores_and_relay_refuses(
            self, ceremony_world, bundle, tmp_path, capsys):
        from mt_eval_harness.sovereign.score_manifest import (
            verify_manifest_file,
        )
        w = ceremony_world
        out, exchange = self._stage(bundle, tmp_path)
        rid = out["request_id"]
        assert rid.startswith("authreq-")
        assert out["method_sha"] == bundle["method_sha"]
        assert out["lane"] == "runnable-bundle" and out["warns"] == 0
        meta = json.loads((exchange / "requests" / rid / "request.json")
                          .read_text(encoding="utf-8"))
        assert meta["request"]["state"] == "authorized"
        assert meta["request"]["node_measurement"] == AIRGAP_NODE
        assert meta["request"]["requested_by"] == PARTICIPANT
        assert meta["audit_head_at_export"] is None
        assert meta["origin"] == "stage-request"
        assert "OFFLINE" in meta["_note"]
        assert "no such authorization request" in meta["_note"]

        # The airgapped node imports it exactly like a relay export …
        assert import_bundle(exchange, config_path="airgap") == [rid]
        # … and a real quorum runs it to a signed, anchored manifest.
        quorum = [str(w["shares"][i]) for i in (0, 2, 4)]
        state = run_imported(rid, config_path="airgap",
                             runner=FakeRuntime(), share_paths=quorum)
        assert state["status"] == "scored", state.get("reason")
        assert state["authorization"]["quorum"] == "3-of-5"
        manifest = json.loads(Path(state["score_manifest"]).read_text())
        assert manifest["methodSha256"] == bundle["method_sha"]
        assert manifest["sealedSetId"] == SECRET_SET
        assert verify_manifest_file(state["score_manifest"],
                                    state["score_manifest_sig"],
                                    w["sign_pub"])["ok"]

        # The documented limit, asserted: no authorization_requests row
        # exists anywhere, so relay pass 2 REFUSES the (validly signed)
        # score bundle — nothing published, no grant consumed.
        assert export_scores(exchange, config_path="airgap") == [rid]
        assert relay(exchange, config_path="connected") == \
            {"exported": [], "published": []}
        assert "no such authorization request" in capsys.readouterr().out
        assert not w["fake"].tables["run_cards"]
        assert not w["fake"].tables["auth_grants"]
        assert not (exchange / "scores" / rid / ".relayed.json").exists()
        for p in exchange.rglob("*"):
            if p.is_file():
                assert SECRET_TOKEN.encode() not in p.read_bytes(), p

    def test_fingerprint_bound_to_node_id_refused_elsewhere(self, world,
                                                            bundle, tmp_path):
        # Staged under the RELAY node's config → bound to RELAY_NODE.
        out, exchange = self._stage(bundle, tmp_path, config="connected")
        rid = out["request_id"]
        assert out["node_id"] == RELAY_NODE
        item = {"method_sha": bundle["method_sha"], "corpus_id": SECRET_SET,
                "corpus_version": "v1"}
        assert out["fingerprint"] == compute_request_fingerprint(
            item, node_measurement=RELAY_NODE)
        assert out["fingerprint"] != compute_request_fingerprint(
            item, node_measurement=AIRGAP_NODE)
        # The airgapped node imports it but refuses to run it: fail-closed
        # node binding, before any key material is touched.
        assert import_bundle(exchange, config_path="airgap") == [rid]
        with pytest.raises(AirgapTransportError, match="bound to node"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime())

    def test_socket_import_refused_at_staging(self, world, tmp_path):
        from mt_eval_harness.method_bundle import build_method_bundle
        from test_method_bundle import (
            CLEAN_DOCKERFILE,
            CLEAN_METHOD,
            _manifest,
        )
        src = tmp_path / "leaky"
        src.mkdir()
        (src / "translate.py").write_text(CLEAN_METHOD, encoding="utf-8")
        (src / "helper.py").write_text("import socket\n", encoding="utf-8")
        dockerfile = tmp_path / "Dockerfile"
        dockerfile.write_text(CLEAN_DOCKERFILE, encoding="utf-8")
        built = build_method_bundle(
            method_dir=src, dockerfile=dockerfile, manifest=_manifest(),
            out_path=tmp_path / "leaky.tar.gz")
        exchange = tmp_path / "usb-staged"
        with pytest.raises(AirgapTransportError, match="BLOCK"):
            stage_request(built["path"], contest_id=CONTEST_ID,
                          requested_by=PARTICIPANT, exchange_dir=exchange,
                          config_path="airgap")
        assert not (exchange / "requests").exists(), "nothing is written"

    def test_tarball_edited_after_staging_rejected_at_import(self, world,
                                                             bundle, tmp_path):
        out, exchange = self._stage(bundle, tmp_path)
        rid = out["request_id"]
        tar = exchange / "requests" / rid / "method.tar.gz"
        tar.write_bytes(tar.read_bytes() + b"\0")
        # import_bundle lists only what it STAGED AS IMPORTED; a sha
        # mismatch is written as 'rejected' and not listed.
        assert import_bundle(exchange, config_path="airgap") == []
        state = json.loads((Path(world["airgap"]["airgap"]["state_dir"])
                            / rid / "state.json").read_text(encoding="utf-8"))
        assert state["status"] == "rejected"
        assert "refusing tampered" in state["reason"]
        with pytest.raises(AirgapTransportError, match="rejected"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime())

    def test_shape_parity_with_submit_method_offline(self, world, tmp_path,
                                                     monkeypatch):
        import mt_eval_harness.method_bundle as mb
        from test_method_bundle import (
            CLEAN_DOCKERFILE,
            CLEAN_METHOD,
            DECLARATIONS,
            install_qualifier_stub,
        )
        from test_method_bundle import QUALIFIER_ID as MB_QUALIFIER_ID

        # submit-method is gated on a PASSING qualifier receipt (contract C1);
        # offline it is checked against the organizer-published terms.
        install_qualifier_stub(monkeypatch)

        def explode(*a, **kw):
            raise AssertionError("offline mode must not touch the network")
        monkeypatch.setattr(mb, "_api_request", explode)
        monkeypatch.setattr(mb, "get_session", explode)
        monkeypatch.setattr(mb, "_storage_upload", explode)
        src = tmp_path / "method-src"
        src.mkdir()
        (src / "translate.py").write_text(CLEAN_METHOD, encoding="utf-8")
        dockerfile = tmp_path / "Dockerfile"
        dockerfile.write_text(CLEAN_DOCKERFILE, encoding="utf-8")
        participant = mb.submit_method(
            contest_id=CONTEST_ID, method_dir=src, dockerfile=dockerfile,
            method_name="acme-nmt-v3", method_version="3.0.0",
            entrypoint="method/translate.py", method_class="pipeline",
            developer_name="Test Dev", developer_email=PARTICIPANT,
            agree=True, node_id=AIRGAP_NODE, secret_set_id=SECRET_SET,
            language_pair="qaa>qab", bundle_out=tmp_path / "usb-participant",
            offline=True, scratch_dir=tmp_path / "scratch",
            offline_qualifier_id=MB_QUALIFIER_ID, offline_threshold=50.0,
            **DECLARATIONS)
        p_dir = Path(participant["bundle_dir"])
        staged = stage_request(
            p_dir / "method.tar.gz", contest_id=CONTEST_ID,
            requested_by=PARTICIPANT, exchange_dir=tmp_path / "usb-organizer",
            config_path="airgap")
        s_dir = Path(staged["path"])
        p_meta = json.loads((p_dir / "request.json").read_text("utf-8"))
        s_meta = json.loads((s_dir / "request.json").read_text("utf-8"))
        # Same keys in the same order, same row shape, same bytes.
        assert list(p_meta) == list(s_meta)
        assert list(p_meta["request"]) == list(s_meta["request"])
        assert s_meta["request"]["method_sha"] == \
            p_meta["request"]["method_sha"] == staged["method_sha"]
        assert s_meta["request"]["fingerprint"] == \
            p_meta["request"]["fingerprint"]
        assert (p_meta["request"]["state"], s_meta["request"]["state"]) == \
            ("pending", "authorized")
        assert (p_meta["origin"], s_meta["origin"]) == \
            ("submit-method", "stage-request")
        assert (p_dir / "method.tar.gz").read_bytes() == \
            (s_dir / "method.tar.gz").read_bytes()
        # Both import through the one reader.
        assert import_bundle(tmp_path / "usb-participant",
                             config_path="airgap") == \
            [participant["request_id"]]
        assert import_bundle(tmp_path / "usb-organizer",
                             config_path="airgap") == [staged["request_id"]]

    def test_export_requests_shape_unchanged(self, world, bundle, tmp_path):
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        world["connected"]["relay"] = {"verify_key": "unused-on-export",
                                       "airgap_node_id": AIRGAP_NODE}
        exchange = tmp_path / "usb-relay"
        assert relay(exchange, config_path="connected")["exported"] == [rid]
        path = exchange / "requests" / rid / "request.json"
        meta = json.loads(path.read_text(encoding="utf-8"))
        assert list(meta) == ["exchange_version", "created_at", "contest_id",
                              "request", "audit_head_at_export", "_note",
                              # Exchange version 2 (2026-09-07): the PUBLIC
                              # qualifier facts the air-gapped node needs to
                              # re-execute the gate itself.
                              "qualifier", "qualifier_corpus"]
        assert meta["exchange_version"] == "2"
        assert meta["qualifier"]["qualifier_id"] == QUALIFIER_ID
        assert meta["qualifier_corpus"]["file"] == at.QUALIFIER_CORPUS_FILE
        exported_corpus = (exchange / "requests" / rid
                           / at.QUALIFIER_CORPUS_FILE)
        assert exported_corpus.read_bytes() == DEV_CORPUS.read_bytes()
        assert meta["qualifier_corpus"]["sha256"] == hashlib.sha256(
            DEV_CORPUS.read_bytes()).hexdigest()
        assert meta["contest_id"] == CONTEST_ID
        assert meta["audit_head_at_export"], "the chain digest travels"
        assert meta["_note"] == (
            "Authorized method-execution request, exported for the "
            "airgapped scoring node. Verify method_sha on import; "
            "scores-only comes back.")
        assert "origin" not in meta
        # Byte-identical serialization to the pre-refactor writer.
        assert path.read_text(encoding="utf-8") == \
            json.dumps(meta, ensure_ascii=False, indent=2) + "\n"
        # A second pass never rewrites an exported request.
        assert relay(exchange, config_path="connected")["exported"] == []

    def test_relay_pass2_refuses_any_staged_bundle(self, world, bundle,
                                                   tmp_path, capsys):
        """The limit holds without a real unseal: a staged request that
        came back as a signed node refusal is still refused by pass 2 —
        there is no authorization_requests row to match it to."""
        pub, key = _any_sign_keys(tmp_path)
        world["airgap"]["signing_key"] = str(key)
        world["connected"]["relay"] = {"verify_key": str(pub),
                                       "airgap_node_id": AIRGAP_NODE}
        out, exchange = self._stage(bundle, tmp_path)
        rid = out["request_id"]
        assert import_bundle(exchange, config_path="airgap") == [rid]
        state_dir = Path(world["airgap"]["airgap"]["state_dir"])
        state = json.loads((state_dir / rid / "state.json").read_text())
        state.update({"status": "failed",
                      "reason": "method exited 1 (synthetic)"})
        (state_dir / rid / "state.json").write_text(json.dumps(state))
        assert export_scores(exchange, config_path="airgap") == [rid]
        assert relay(exchange, config_path="connected") == \
            {"exported": [], "published": []}
        assert "no such authorization request" in capsys.readouterr().out
        assert not (exchange / "scores" / rid / ".relayed.json").exists()

    def test_refusals_write_nothing(self, world, bundle, tmp_path):
        exchange = tmp_path / "usb"
        common = dict(requested_by=PARTICIPANT, exchange_dir=exchange,
                      config_path="airgap")
        with pytest.raises(AirgapTransportError, match="serves no contest"):
            stage_request(bundle["tarball"], contest_id="nope", **common)
        with pytest.raises(AirgapTransportError, match="does not serve"):
            stage_request(bundle["tarball"], contest_id=CONTEST_ID,
                          secret_set_id="eval-other-set-v1", **common)
        with pytest.raises(AirgapTransportError, match="requested-by"):
            stage_request(bundle["tarball"], contest_id=CONTEST_ID,
                          **{**common, "requested_by": "  "})
        with pytest.raises(AirgapTransportError,
                           match="not a safe directory name"):
            stage_request(bundle["tarball"], contest_id=CONTEST_ID,
                          request_id="../escape", **common)
        with pytest.raises(AirgapTransportError, match="bundle not found"):
            stage_request(tmp_path / "missing.tar.gz", contest_id=CONTEST_ID,
                          **common)
        junk = tmp_path / "junk.tar.gz"
        junk.write_bytes(b"not a tarball at all")
        with pytest.raises(AirgapTransportError, match="unreadable"):
            stage_request(junk, contest_id=CONTEST_ID, **common)
        assert not exchange.exists()
        # An existing requests/<id> is never overwritten.
        stage_request(bundle["tarball"], contest_id=CONTEST_ID,
                      request_id="authreq-fixed", **common)
        with pytest.raises(AirgapTransportError, match="already exists"):
            stage_request(bundle["tarball"], contest_id=CONTEST_ID,
                          request_id="authreq-fixed", **common)

    def test_writer_refuses_unsafe_id_and_overwrite(self, tmp_path):
        with pytest.raises(AirgapTransportError, match="safe directory name"):
            write_exchange_request(
                tmp_path, request_id="a/b", contest_id="c", request_row={},
                bundle_bytes=b"x", note="n")
        dest = write_exchange_request(
            tmp_path, request_id="authreq-1", contest_id="c",
            request_row={"request_id": "authreq-1"}, bundle_bytes=b"x",
            note="n", extra={"origin": "test"})
        assert (dest / "method.tar.gz").read_bytes() == b"x"
        meta = json.loads((dest / "request.json").read_text("utf-8"))
        assert list(meta) == ["exchange_version", "created_at", "contest_id",
                              "request", "audit_head_at_export", "_note",
                              "origin"]
        with pytest.raises(AirgapTransportError, match="already exists"):
            write_exchange_request(
                tmp_path, request_id="authreq-1", contest_id="c",
                request_row={}, bundle_bytes=b"y", note="n")
        assert (dest / "method.tar.gz").read_bytes() == b"x"


# ---------------------------------------------------------------------------
# Exchange version 2 + the public gate, measured air-gapped (M3-wire,
# 2026-09-07). The OUT bundle carries the qualifiers row and the PUBLIC dev
# corpus, so the sneakernet node re-EXECUTES the gate instead of trusting the
# receipt's number — the honest gap the connected lane never had.
# ---------------------------------------------------------------------------

def _row_for(bundle, rid):
    return {"request_id": rid, "sealed_set_id": SECRET_SET,
            "method_sha": bundle["method_sha"], "corpus_id": SECRET_SET,
            "corpus_version": "v1", "node_measurement": AIRGAP_NODE,
            "fingerprint": compute_request_fingerprint(
                {"method_sha": bundle["method_sha"], "corpus_id": SECRET_SET,
                 "corpus_version": "v1"}, node_measurement=AIRGAP_NODE),
            "requested_by": PARTICIPANT}


class TestExchangeVersion:
    def test_out_bundle_carries_the_qualifier_row_and_the_public_dev_corpus(
            self, world, bundle, tmp_path):
        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        world["connected"]["relay"] = {"verify_key": "unused",
                                       "airgap_node_id": AIRGAP_NODE}
        exchange = tmp_path / "usb"
        assert relay(exchange, config_path="connected")["exported"] == [rid]
        meta = json.loads((exchange / "requests" / rid / "request.json")
                          .read_text(encoding="utf-8"))
        assert meta["exchange_version"] == "2"
        assert meta["qualifier"]["qualifier_id"] == QUALIFIER_ID
        assert meta["qualifier"]["threshold"] == 50.0
        corpus = exchange / "requests" / rid / at.QUALIFIER_CORPUS_FILE
        assert corpus.read_bytes() == DEV_CORPUS.read_bytes()
        # The dev set is PUBLIC (published with its references when the
        # contest opened) — no sealed corpus ever travels outbound.
        assert SECRET_TOKEN.encode() not in corpus.read_bytes()

    def test_a_relay_without_the_public_dev_corpus_exports_nothing(
            self, world, bundle, tmp_path):
        world["connected"]["contests"][CONTEST_ID].pop("dev_corpus")
        world["connected"]["relay"] = {"verify_key": "unused",
                                       "airgap_node_id": AIRGAP_NODE}
        world["propose"](bundle["method_sha"],
                         upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb"
        assert relay(exchange, config_path="connected")["exported"] == []
        assert not (exchange / "requests").exists()

    def test_an_old_version_export_is_refused_by_name_never_half_read(
            self, world, bundle, tmp_path, capsys):
        exchange = tmp_path / "usb"
        rid = "authreq-oldversion"
        _hand_export(exchange, rid, _row_for(bundle, rid),
                     bundle["tarball"].read_bytes(), exchange_version="1",
                     qualifier=False)
        assert import_bundle(exchange, config_path="airgap") == []
        out = capsys.readouterr().out
        assert "exchange_version '1'" in out and "'2'" in out
        assert "REFUSED" in out
        # Nothing was staged: a refused bundle is not half-imported.
        assert not (Path(world["airgap"]["airgap"]["state_dir"]) / rid
                    / "state.json").exists()

    def test_a_qualifier_corpus_whose_bytes_moved_is_not_staged(
            self, world, bundle, tmp_path, capsys):
        exchange = tmp_path / "usb"
        rid = "authreq-movedbytes"
        dest = _hand_export(exchange, rid, _row_for(bundle, rid),
                            bundle["tarball"].read_bytes())
        meta = json.loads((dest / "request.json").read_text(encoding="utf-8"))
        meta["qualifier_corpus"]["sha256"] = "b" * 64
        (dest / "request.json").write_text(json.dumps(meta), encoding="utf-8")
        assert import_bundle(exchange, config_path="airgap") == []
        assert "the corpus the organizer published" in capsys.readouterr().out


class TestAirgappedQualifierReExecution:
    def test_the_gate_is_measured_on_the_airgapped_node(
            self, world, bundle, tmp_path, capsys):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        exchange = tmp_path / "usb"
        rid = "authreq-gated"
        _hand_export(exchange, rid, _row_for(bundle, rid),
                     bundle["tarball"].read_bytes())
        import_bundle(exchange, config_path="airgap")
        state = run_imported(rid, config_path="airgap", runner=FakeRuntime())
        assert state["status"] == "scored", state.get("reason")
        gate = state["qualifier_gate"]
        assert gate["verified"] is True and gate["eligible"] is True
        assert gate["qualifier_id"] == QUALIFIER_ID
        assert gate["measured"] is not None and gate["measured"] >= 50.0
        assert gate["source"] == "exchange"
        assert "re-executed on this air-gapped node" in capsys.readouterr().out

    def test_a_method_that_misses_the_threshold_is_denied_air_gapped(
            self, world, bundle, tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        exchange = tmp_path / "usb"
        rid = "authreq-belowbar"
        dest = _hand_export(exchange, rid, _row_for(bundle, rid),
                            bundle["tarball"].read_bytes())
        meta = json.loads((dest / "request.json").read_text(encoding="utf-8"))
        meta["qualifier"]["threshold"] = 99.9
        (dest / "request.json").write_text(json.dumps(meta), encoding="utf-8")
        import_bundle(exchange, config_path="airgap")
        state = run_imported(rid, config_path="airgap", runner=FakeRuntime())
        # Same message shape as the connected node's refusal.
        assert state["status"] == "rejected"
        assert "qualifier not met on node re-execution" in state["reason"]
        assert "threshold 99.9" in state["reason"]
        assert state["qualifier_gate"]["eligible"] is False
        # Nothing sealed was opened: no card, no score.
        assert "card_id" not in state

    def test_an_export_with_no_qualifier_facts_refuses_to_run(
            self, world, bundle, tmp_path):
        exchange = tmp_path / "usb"
        rid = "authreq-ungated"
        _hand_export(exchange, rid, _row_for(bundle, rid),
                     bundle["tarball"].read_bytes(), qualifier=False)
        assert import_bundle(exchange, config_path="airgap") == [rid]
        with pytest.raises(AirgapTransportError,
                           match="carries no qualifier facts"):
            run_imported(rid, config_path="airgap", runner=FakeRuntime())

    def test_a_staged_offline_request_says_the_gate_was_not_measured(
            self, world, bundle, tmp_path, capsys):
        """The DB-less lane has no qualifiers row anywhere. It is labelled,
        recorded and never silently treated as gated — and its scores can
        never be relay-published."""
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv))
        exchange = tmp_path / "usb"
        staged = stage_request(
            bundle["tarball"], contest_id=CONTEST_ID,
            requested_by=PARTICIPANT, exchange_dir=exchange,
            config_path="airgap")
        import_bundle(exchange, config_path="airgap")
        state = run_imported(staged["request_id"], config_path="airgap",
                             runner=FakeRuntime())
        assert state["status"] == "scored", state.get("reason")
        assert state["qualifier_gate"]["verified"] is False
        assert "stage-request" in state["qualifier_gate"]["reason"]
        assert "NOT re-executed" in capsys.readouterr().out

    def test_a_node_declared_qualifier_gates_the_db_less_lane(
            self, world, bundle, tmp_path):
        """An organizer running the DB-less lane can still gate: declare the
        qualifier block and the public dev corpus on the SCORING machine."""
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv),
            dev_corpus=str(DEV_CORPUS),
            qualifier={**QUALIFIER_ROW, "threshold": 99.9})
        exchange = tmp_path / "usb"
        staged = stage_request(
            bundle["tarball"], contest_id=CONTEST_ID,
            requested_by=PARTICIPANT, exchange_dir=exchange,
            config_path="airgap")
        import_bundle(exchange, config_path="airgap")
        state = run_imported(staged["request_id"], config_path="airgap",
                             runner=FakeRuntime())
        assert state["status"] == "rejected"
        assert "qualifier not met on node re-execution" in state["reason"]
        assert state["qualifier_gate"]["source"] == "node.json"


class TestNodeFitAcrossTheGap:
    """Round 3 researcher persona (2026-10-03), the offline lane: a
    default-packaged bundle (8 GB) on a node-init-default node (4 GB) was
    staged 'rejected' as "qualifier not met", re-import said "Nothing new to
    import", and the entrant resubmitted twice; a missing docker printed a
    raw `[Errno 2]`. Now: a refusal that says what it is, and the request
    stays 'imported' so it runs as soon as the node allows it."""

    def _import(self, world, bundle, tmp_path, rid):
        exchange = tmp_path / "usb"
        _hand_export(exchange, rid, _row_for(bundle, rid),
                     bundle["tarball"].read_bytes())
        assert import_bundle(exchange, config_path="airgap") == [rid]
        return exchange

    def _state(self, world, rid):
        return json.loads((Path(world["airgap"]["airgap"]["state_dir"]) / rid
                           / "state.json").read_text(encoding="utf-8"))

    def test_a_resource_mismatch_leaves_the_request_runnable(
            self, world, bundle, tmp_path):
        rid = "authreq-toobig"
        self._import(world, bundle, tmp_path, rid)
        ccfg = world["airgap"]["contests"][CONTEST_ID]
        ccfg["sandbox"] = {"runtime": "docker", "max_ram_gb": 2,
                           "max_tmp_gb": 2, "cpus": 1}
        rt = FakeRuntime()
        with pytest.raises(AirgapTransportError) as ei:
            run_imported(rid, config_path="airgap", runner=rt)
        msg = str(ei.value)
        assert "this node allows 2 GB (sandbox.max_ram_gb)" in msg
        assert "this node allows 2 GB (sandbox.max_tmp_gb)" in msg
        assert "--ram-gb 2 --disk-gb 2" in msg
        assert f"{rid} stays imported" in msg
        assert f"mt-eval node run-method {rid} --offline" in msg
        assert "import-bundle" in msg          # the entrant's other route
        assert "qualifier not met" not in msg
        assert not [c for c in rt.calls if c[1] in ("build", "run")]
        assert self._state(world, rid)["status"] == "imported"

        # The organizer raises the caps: the SAME request now runs — no
        # resubmission, no new authreq.
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg.update(secret_artifact=str(artifact), secret_privkey=str(priv),
                    sandbox={"runtime": "docker", "cpus": 1})
        state = run_imported(rid, config_path="airgap", runner=FakeRuntime())
        assert state["status"] == "scored", state.get("reason")

    def test_no_container_runtime_is_a_clear_refusal(
            self, world, bundle, tmp_path, monkeypatch):
        import mt_eval_harness.sandbox_runner as sr
        rid = "authreq-nodocker"
        self._import(world, bundle, tmp_path, rid)
        world["airgap"]["contests"][CONTEST_ID]["sandbox"] = {"runtime": None}
        monkeypatch.setattr(sr.shutil, "which", lambda name: None)
        with pytest.raises(AirgapTransportError) as ei:
            run_imported(rid, config_path="airgap", runner=subprocess.run)
        msg = str(ei.value)
        assert "neither docker nor podman is on PATH" in msg
        assert "Errno" not in msg
        assert "still imported" in msg
        assert self._state(world, rid)["status"] == "imported"

    def test_reimport_says_what_is_already_staged(self, world, bundle,
                                                  tmp_path, capsys):
        rid = "authreq-twice"
        exchange = self._import(world, bundle, tmp_path, rid)
        capsys.readouterr()
        assert import_bundle(exchange, config_path="airgap") == []
        out = capsys.readouterr().out
        assert f"{rid}: already staged here (status 'imported')" in out


class TestHoldoutAcrossTheGap:
    def test_the_holdout_travels_and_the_relay_always_withholds_it(
            self, world, bundle, tmp_path):
        from test_sandbox_runner import HOLDOUT_SET, SUITE_ID, _extra_corpus
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        pub_sign, key_sign = _sign_keygen(tmp_path)
        holdout = _extra_corpus(tmp_path, "airgap-holdout", [
            {"id": 0, "source": "venu pira kelo", "reference": "pira venuvo"},
            {"id": 1, "source": "tolu keno mira", "reference": "keno toluvo"},
        ])
        suite = _extra_corpus(tmp_path, "airgap-suite", [
            {"id": 0, "source": "mira sol volu", "reference": "sol miravo"},
        ])
        world["airgap"]["contests"][CONTEST_ID].update(
            secret_artifact=str(artifact), secret_privkey=str(priv),
            holdout_set_id=HOLDOUT_SET, holdout_corpus=str(holdout),
            test_suites=[{"suite_id": SUITE_ID, "corpus_path": str(suite),
                          "corpus_sha256": hashlib.sha256(
                              suite.read_bytes()).hexdigest()}])
        world["airgap"]["signing_key"] = str(key_sign)
        world["connected"]["relay"] = {"verify_key": str(pub_sign),
                                       "airgap_node_id": AIRGAP_NODE}

        rid = world["propose"](bundle["method_sha"],
                               upload=bundle["tarball"].read_bytes())
        exchange = tmp_path / "usb"
        relay(exchange, config_path="connected")
        import_bundle(exchange, config_path="airgap")
        state = run_imported(rid, config_path="airgap", runner=FakeRuntime())
        assert state["status"] == "scored", state.get("reason")
        assert state["holdout"]["sealed_set_id"] == HOLDOUT_SET
        assert state["by_test_suite"][SUITE_ID]["n"] == 1

        export_scores(exchange, config_path="airgap")
        sent = json.loads((exchange / "scores" / rid / "score-bundle.json")
                          .read_text(encoding="utf-8"))
        assert sent["holdout"]["row"]["dataset_id"] == HOLDOUT_SET
        assert "HOLDOUT SPLIT" in sent["holdout"]["row"]["affirmation"]
        # Scores-only, strengthened: still no secret text on the medium.
        for p in exchange.rglob("*"):
            if p.is_file():
                assert SECRET_TOKEN.encode() not in p.read_bytes(), p

        out = relay(exchange, config_path="connected")
        assert out["published"] == [rid]
        # The MAIN card publishes; the holdout is parked, whatever
        # results_visibility says.
        cards = world["fake"].tables["run_cards"]
        assert [c["dataset_id"] for c in cards] == [SECRET_SET]
        assert cards[0]["run_card"]["by_test_suite"][SUITE_ID]["n"] == 1
        held = world["fake"].tables["contest_deferred_results"]
        assert len(held) == 1
        assert held[0]["role"] == "holdout"
        assert held[0]["request_id"] == sr_holdout_key(rid)
        # URL-safe by contract: the key travels as a PostgREST filter value.
        assert "#" not in held[0]["request_id"]
        assert held[0]["sealed_set_id"] == HOLDOUT_SET
        sidecar = held[0]["run_card_row"]["_contest_submission"]
        assert sidecar["fields"]["authorization_request_id"] == rid
        assert sidecar["fields"]["is_primary"] is False
        # ONE grant for both splits (contract D1), and the audit says so.
        used = [e for e in world["fake"].tables["authorization_audit_log"]
                if e["event_type"] == "grant_used"]
        assert len(used) == 1
        assert used[0]["detail"]["sets"] == ["main", "holdout"]
        assert used[0]["detail"]["test_suites"] == [SUITE_ID]
