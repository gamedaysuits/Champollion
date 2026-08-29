"""contest_node — the organizer scoring node's full lifecycle, offline.

A tiny in-memory fake of the Supabase REST surface (tables as lists, an
`in.(…)`/`eq.` param parser, an atomic claim_auth_grant) is monkeypatched under
sovereign_service.service_request; everything ABOVE that line is real: bundle
extraction, digest checks, the node's own dev re-score (external_scoring +
sacrebleu), the qualifier gate, authorization/grant/audit sequencing, secret
scoring, assemble_run_card, and build_run_card_row. Synthetic qaa>qab fixtures.

Covered per authorization model:
  open            received → … → published in one poll
  blanket         same, PLUS the full request/grant/audit trail exists
  per-submission  parks at pending_authorization; approve → published;
                  deny → rejected with the reason
Plus the refusals: below-threshold, digest mismatch, invalid method claim —
each rejected WITH a reason; and every row's status history is a legal chain
(the offline mirror of migration 043's one-way trigger).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from mt_eval_harness import contest_node
from mt_eval_harness.contest_intake import build_bundle

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"
BLIND_REFS = FIXTURES / "corpus_blind_refs.json"

CONTEST_ID = "synth-open-2026"
SEALED_SET_ID = "eval-qaa-qab-synth-blindtest-v1"
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"
THRESHOLD = 50.0
PARTICIPANT = "participant@example.test"

# Legal one-way transitions — the offline mirror of migration 043.
_LEGAL = {
    "received": {"qualifier_checked", "rejected"},
    "qualifier_checked": {"pending_authorization", "scoring", "rejected"},
    "pending_authorization": {"scoring", "rejected"},
    "scoring": {"scored", "rejected"},
    "scored": {"published", "rejected"},
}


class FakeSupabase:
    """Just enough PostgREST to host the node's tables."""

    def __init__(self):
        self.tables: dict[str, list[dict]] = {
            "contests": [], "qualifiers": [], "contest_intake": [],
            "authorization_requests": [], "auth_grants": [],
            "authorization_audit_log": [], "run_cards": [],
            "contest_submissions": [],
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
            return new
        if method == "PATCH":
            hit = []
            for r in rows:
                if self._matches(r, params):
                    if path == "contest_intake" and "status" in data \
                            and data["status"] != r.get("status"):
                        old, new_s = r.get("status"), data["status"]
                        assert new_s in _LEGAL.get(old, set()), (
                            f"ILLEGAL transition {old} -> {new_s} — the real "
                            f"DB trigger (043) would have refused this")
                        if new_s == "rejected":
                            assert (data.get("reject_reason")
                                    or r.get("reject_reason")), \
                                "rejected without a reason"
                        self.status_history[r["intake_id"]].append(new_s)
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


def _dev_refs() -> list[str]:
    data = json.loads(DEV_CORPUS.read_text(encoding="utf-8"))
    return [e["reference"] for e in data["entries"]]


def _blind_refs() -> list[str]:
    data = json.loads(BLIND_REFS.read_text(encoding="utf-8"))
    return [e["reference"] for e in data["entries"]]


@pytest.fixture
def world(monkeypatch, tmp_path):
    """A fake DB + node config + storage, wired under the real node code."""
    fake = FakeSupabase()
    fake.tables["contests"].append({
        "id": CONTEST_ID, "name": "Synthetic Open 2026", "status": "open",
        "corpus_id": SEALED_SET_ID, "language_pair": "qaa>qab",
        "authorization_model": "open", "intake_open": True,
    })
    fake.tables["qualifiers"].append({
        "qualifier_id": QUALIFIER_ID, "corpus_card_id": "eval-qaa-qab-synth-dev-v1",
        "sealed_set_id": SEALED_SET_ID, "threshold": THRESHOLD,
        "metric": "composite", "year": 2026, "status": "active",
    })

    storage: dict[str, bytes] = {}

    # Route BOTH import sites of service_request/rpc through the fake.
    import mt_eval_harness.sovereign_service as svc
    monkeypatch.setattr(svc, "service_request", fake)
    monkeypatch.setattr(svc, "rpc",
                        lambda name, args, **kw: fake(
                            "POST", f"rpc/{name}", data=args))
    monkeypatch.setattr(contest_node, "service_request", fake)
    monkeypatch.setattr(contest_node, "rpc",
                        lambda name, args, **kw: fake(
                            "POST", f"rpc/{name}", data=args))
    monkeypatch.setattr(contest_node, "append_audit_event",
                        lambda event_type, **kw: fake(
                            "POST", "authorization_audit_log",
                            data={"event_type": event_type, **kw}))
    monkeypatch.setattr(contest_node, "_storage_download",
                        lambda path: storage[path])
    # publish_scored_run imports service_request lazily from publish scope —
    # it uses the module-level one we patched above.

    cfg = {
        "node_id": "test-node-1",
        "poll_seconds": 1,
        "grant_ttl_seconds": 3600,
        "scratch_dir": str(tmp_path / "scratch"),
        "output_dir": str(tmp_path / "runs"),
        "contests": {
            CONTEST_ID: {
                "dev_corpus": str(DEV_CORPUS),
                "refs_plaintext": str(BLIND_REFS),
                "corpus_version": "v1",
            }
        },
    }
    return {"fake": fake, "cfg": cfg, "storage": storage,
            "tmp_path": tmp_path}


def submit(world, *, dev_lines, test_lines, intake_suffix="a",
           method_class="pipeline", system="acme-nmt-v2",
           tamper_digest=False):
    """Simulate a participant submission landing in bucket + intake table."""
    tmp = world["tmp_path"] / f"sub-{intake_suffix}"
    tmp.mkdir(parents=True, exist_ok=True)
    dev = tmp / "dev.txt"
    test = tmp / "test.txt"
    dev.write_text("\n".join(dev_lines) + "\n", encoding="utf-8")
    test.write_text("\n".join(test_lines) + "\n", encoding="utf-8")

    from mt_eval_harness.external_scoring import sha256_file
    intake_id = f"intake-{intake_suffix}"
    manifest = {"intake_id": intake_id, "contest_id": CONTEST_ID,
                "system_label": system, "method_class": method_class,
                "paradigm": "neural-nmt", "description": "test system"}
    bundle = build_bundle(dev_hyp_path=dev, test_hyp_path=test,
                          manifest=manifest)
    object_path = f"{CONTEST_ID}/{PARTICIPANT}/{intake_id}.tar.gz"
    world["storage"][object_path] = bundle

    world["fake"]("POST", "contest_intake", data={
        "intake_id": intake_id, "contest_id": CONTEST_ID,
        "submitted_by": PARTICIPANT, "team": None, "notes": "",
        "dev_hyp_sha256": ("0" * 64 if tamper_digest else sha256_file(dev)),
        "test_hyp_sha256": sha256_file(test),
        "storage_path": object_path, "status": "received",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return intake_id


def _set_model(world, model):
    world["fake"].tables["contests"][0]["authorization_model"] = model


# ---------------------------------------------------------------------------
# open — the straight-through lane.
# ---------------------------------------------------------------------------

class TestOpenModel:
    def test_received_to_published_one_poll(self, world):
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs())
        contest_node.poll_once(world["cfg"])

        row = world["fake"].intake(iid)
        assert row["status"] == "published", row.get("reject_reason")
        assert row["qualifier_score"] >= THRESHOLD
        assert row["qualifier_id"] == QUALIFIER_ID
        assert row["run_card_id"]

        # The published run card: trust=verified, participant-claimed method,
        # the hypotheses-submission condition, AGGREGATES-ONLY (no entries).
        cards = world["fake"].tables["run_cards"]
        assert len(cards) == 1
        card_row = cards[0]
        assert card_row["trust"] == "verified"
        assert card_row["submitter"] == PARTICIPANT
        assert card_row["model_slug"] == "acme-nmt-v2"
        assert card_row["condition"] == "hypotheses-submission"
        assert card_row["dataset_id"] == SEALED_SET_ID
        assert "participant-claimed" in card_row["affirmation"]
        assert "run_card_entries" not in world["fake"].tables  # never touched
        # linked into the contest
        subs = world["fake"].tables["contest_submissions"]
        assert subs and subs[0]["run_card_id"] == card_row["id"]
        assert subs[0]["submitted_by"] == PARTICIPANT

    def test_below_threshold_rejected_with_reason(self, world):
        iid = submit(world, dev_lines=["zzz"] * 6, test_lines=_blind_refs(),
                     intake_suffix="low")
        contest_node.poll_once(world["cfg"])
        row = world["fake"].intake(iid)
        assert row["status"] == "rejected"
        assert str(THRESHOLD).rstrip("0").rstrip(".") in row["reject_reason"] \
            or "threshold" in row["reject_reason"]
        assert row["qualifier_score"] is not None  # evidence recorded
        assert not world["fake"].tables["run_cards"]

    def test_digest_mismatch_rejected(self, world):
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
                     intake_suffix="tamper", tamper_digest=True)
        contest_node.poll_once(world["cfg"])
        row = world["fake"].intake(iid)
        assert row["status"] == "rejected"
        assert "digest" in row["reject_reason"]

    def test_invalid_method_claim_rejected(self, world):
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
                     intake_suffix="claim", method_class="magic-beans")
        contest_node.poll_once(world["cfg"])
        row = world["fake"].intake(iid)
        assert row["status"] == "rejected"
        assert "method claim" in row["reject_reason"]


# ---------------------------------------------------------------------------
# blanket — auto-authorized, but the FULL trail exists.
# ---------------------------------------------------------------------------

class TestBlanketModel:
    def test_full_authorization_trail(self, world):
        _set_model(world, "blanket")
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
                     intake_suffix="blanket")
        contest_node.poll_once(world["cfg"])

        row = world["fake"].intake(iid)
        assert row["status"] == "published", row.get("reject_reason")
        assert row["authorization_request_id"]

        reqs = world["fake"].tables["authorization_requests"]
        assert len(reqs) == 1 and reqs[0]["state"] == "authorized"
        assert reqs[0]["method_sha"] == row["test_hyp_sha256"]
        assert reqs[0]["corpus_id"] == SEALED_SET_ID
        # emit is pinned 'scores-only' by the DB default + CHECK (038); the
        # node never sends a different value.
        assert reqs[0].get("emit", "scores-only") == "scores-only"

        grants = world["fake"].tables["auth_grants"]
        assert len(grants) == 1 and grants[0]["used"] is True
        assert grants[0]["fingerprint"] == reqs[0]["fingerprint"]

        # Every scoring — even auto-approved — leaves the audit sequence.
        types = world["fake"].audit_types()
        assert types == ["request_created", "request_authorized",
                         "grant_minted", "grant_used"]


# ---------------------------------------------------------------------------
# per-submission — the custodian in the loop. These need SEALED refs (the node
# refuses to serve a per-submission contest over plaintext refs — asserted
# below), so they seal the fixture via the champollion CLI and skip cleanly
# where node/the cli tree is absent.
# ---------------------------------------------------------------------------

def _seal_fixture_refs(world) -> None:
    """Seal BLIND_REFS into tmp and point the node config at the artifact."""
    import shutil
    import subprocess
    from mt_eval_harness.contest_prep import ContestPrepError, find_champollion_cli
    if shutil.which("node") is None:
        pytest.skip("node needed to seal fixture refs")
    try:
        cli = find_champollion_cli()
    except ContestPrepError:
        pytest.skip("champollion CLI not found")
    keys = world["tmp_path"] / "keys"
    proc = subprocess.run(cli + ["seal-corpus", "keygen", "--out", str(keys)],
                          capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    pub = next(keys.glob("*.pub.json"))
    priv = next(keys.glob("*.key.json"))
    artifact = world["tmp_path"] / "refs.sealed.json"
    proc = subprocess.run(cli + [
        "seal-corpus", "seal",
        "--seal-input", str(BLIND_REFS),
        "--id", SEALED_SET_ID,
        "--custodian-group", "org-test",
        "--threshold-pubkey", str(pub),
        "--seal-out", str(artifact),
    ], capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    ccfg = world["cfg"]["contests"][CONTEST_ID]
    ccfg.pop("refs_plaintext", None)
    ccfg["refs_artifact"] = str(artifact)
    ccfg["refs_privkey"] = str(priv)


class TestPerSubmissionModel:
    def test_parks_then_approve_publishes(self, world, monkeypatch):
        _set_model(world, "per-submission")
        _seal_fixture_refs(world)
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
                     intake_suffix="persub")
        contest_node.poll_once(world["cfg"])

        row = world["fake"].intake(iid)
        assert row["status"] == "pending_authorization"
        request_id = row["authorization_request_id"]
        reqs = world["fake"].tables["authorization_requests"]
        assert reqs[0]["state"] == "pending"
        assert not world["fake"].tables["auth_grants"], \
            "no grant may exist before authorization"

        # Second poll without approval: still parked.
        contest_node.poll_once(world["cfg"])
        assert world["fake"].intake(iid)["status"] == "pending_authorization"

        # Custodian approves (module-level helpers, same fake underneath).
        monkeypatch.setattr(contest_node, "load_node_config",
                            lambda p=None: world["cfg"])
        contest_node.approve(request_id, actor="custodian@example.test")
        assert reqs[0]["state"] == "authorized"

        contest_node.poll_once(world["cfg"])
        row = world["fake"].intake(iid)
        assert row["status"] == "published", row.get("reject_reason")
        types = world["fake"].audit_types()
        assert types == ["request_created", "vote_cast",
                         "request_authorized", "grant_minted", "grant_used"]

    def test_deny_rejects_with_reason(self, world, monkeypatch):
        _set_model(world, "per-submission")
        _seal_fixture_refs(world)
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
                     intake_suffix="denied")
        contest_node.poll_once(world["cfg"])
        request_id = world["fake"].intake(iid)["authorization_request_id"]

        monkeypatch.setattr(contest_node, "load_node_config",
                            lambda p=None: world["cfg"])
        contest_node.deny(request_id, actor="custodian@example.test",
                          reason="not this month")
        contest_node.poll_once(world["cfg"])

        row = world["fake"].intake(iid)
        assert row["status"] == "rejected"
        assert "denied" in row["reject_reason"]
        assert not world["fake"].tables["run_cards"]

    def test_plaintext_refs_refused_for_per_submission(self, world, capsys):
        _set_model(world, "per-submission")
        # world config uses refs_plaintext — the node must refuse to serve.
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
                     intake_suffix="theater")
        contest_node.poll_once(world["cfg"])
        out = capsys.readouterr().out
        assert "PLAINTEXT" in out
        assert world["fake"].intake(iid)["status"] == "received", \
            "nothing may be processed while the config is unsafe"


# ---------------------------------------------------------------------------
# Lifecycle legality — every history the fake recorded is a legal chain.
# ---------------------------------------------------------------------------

def test_all_recorded_histories_are_legal_chains(world):
    submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
           intake_suffix="legal1")
    submit(world, dev_lines=["zzz"] * 6, test_lines=_blind_refs(),
           intake_suffix="legal2")
    contest_node.poll_once(world["cfg"])
    for iid, history in world["fake"].status_history.items():
        for old, new in zip(history, history[1:]):
            assert new in _LEGAL.get(old, set()), \
                f"{iid}: illegal {old} -> {new}"


class TestCustodyConfigValidation:
    """F1: load_node_config validates the T2 `custody` declaration."""

    def _write_cfg(self, tmp_path, contest):
        cfg = {"node_id": "org-node-1", "contests": {"c1": contest}}
        p = tmp_path / "node.json"
        p.write_text(json.dumps(cfg), encoding="utf-8")
        return p

    def test_default_custody_is_single_key(self, tmp_path):
        p = self._write_cfg(tmp_path, {
            "secret_set_id": "eval-s-v1",
            "secret_artifact": "/x/a.sealed.json",
            "secret_privkey": "/x/k.key.json"})
        cfg = contest_node.load_node_config(p)
        # Loads clean; custody unset means the single-key stand-in lane.
        assert cfg["contests"]["c1"].get("custody", "single-key") == \
            "single-key"

    def test_threshold_quorum_loads_without_privkey(self, tmp_path):
        p = self._write_cfg(tmp_path, {
            "secret_set_id": "eval-s-v1",
            "secret_artifact": "/x/a.sealed.json",
            "custody": "threshold-quorum"})
        cfg = contest_node.load_node_config(p)
        assert cfg["contests"]["c1"]["custody"] == "threshold-quorum"

    def test_threshold_quorum_with_privkey_is_refused(self, tmp_path):
        p = self._write_cfg(tmp_path, {
            "secret_set_id": "eval-s-v1",
            "secret_artifact": "/x/a.sealed.json",
            "custody": "threshold-quorum",
            "secret_privkey": "/x/k.key.json"})  # the bypass
        with pytest.raises(contest_node.NodeConfigError,
                           match="single-party bypass"):
            contest_node.load_node_config(p)

    def test_unknown_custody_value_refused(self, tmp_path):
        p = self._write_cfg(tmp_path, {
            "secret_set_id": "eval-s-v1",
            "secret_artifact": "/x/a.sealed.json",
            "custody": "trust-me-bro"})
        with pytest.raises(contest_node.NodeConfigError,
                           match="custody must be"):
            contest_node.load_node_config(p)
