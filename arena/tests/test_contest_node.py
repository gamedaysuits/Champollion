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

import io
import tarfile

from mt_eval_harness import contest_node
from mt_eval_harness.external_scoring import sha256_file


def build_bundle(*, dev_hyp_path: Path, test_hyp_path: Path,
                 manifest: dict) -> bytes:
    """The hypotheses bundle a participant used to upload, as a tar.gz.

    Lived in contest_intake until `contest submit-hypotheses` was retired as
    an entry path (R2, 2026-09-06). The organizer node still DRAINS rows that
    are already in flight, so the fixture builder moved here — into the tests
    that exercise that drain — rather than staying shipped code with no
    caller."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for arcname, path in (("dev-hypotheses" + dev_hyp_path.suffix,
                               dev_hyp_path),
                              ("test-hypotheses" + test_hyp_path.suffix,
                               test_hyp_path)):
            tar.add(str(path), arcname=arcname)
        m = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
        info = tarfile.TarInfo("manifest.json")
        info.size = len(m)
        tar.addfile(info, io.BytesIO(m))
    return buf.getvalue()

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
        # The BYLINE is the submission's own public name, never the JWT email
        # the row binds for RLS — run_cards.submitter is world-readable.
        assert card_row["submitter"] == "acme-nmt-v2"
        assert "@" not in card_row["submitter"]
        assert card_row["model_slug"] == "acme-nmt-v2"
        assert card_row["condition"] == "hypotheses-submission"
        assert card_row["dataset_id"] == SEALED_SET_ID
        assert "participant-claimed" in card_row["affirmation"]
        assert "run_card_entries" not in world["fake"].tables  # never touched
        # linked into the contest
        subs = world["fake"].tables["contest_submissions"]
        assert subs and subs[0]["run_card_id"] == card_row["id"]
        # submitted_by stays the identity RLS binds to; the public label is a
        # separate column (074) and carries the byline.
        assert subs[0]["submitted_by"] == PARTICIPANT
        assert subs[0]["submitter_label"] == "acme-nmt-v2"

    def test_hypotheses_lane_publishes_no_execution_facts(self, world):
        """Contract C4 is a NO-OP for a lane that executes nothing.

        The organizer scored a file the participant uploaded — no container
        ran, no wall clock was measured, no node caps applied. So the card
        carries no `execution` block at all. A present-but-null one would
        read as "it ran in zero seconds on an unknown machine", which is a
        claim nobody made; and every card minted before this contract must
        stay byte-identical.
        """
        submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs())
        contest_node.poll_once(world["cfg"])
        run_card = world["fake"].tables["run_cards"][0]["run_card"]
        assert "execution" not in run_card
        assert "by_test_suite" not in run_card

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
                            lambda p=None, **kw: world["cfg"])
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
                            lambda p=None, **kw: world["cfg"])
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


# ---------------------------------------------------------------------------
# The stranded-'scored' bug (found 2026-09-06): 'scored' was in _ACTIONABLE
# but had no branch, so a row that reached it without publishing was re-read
# by every poll and never moved again — the participant's work parked forever.
# ---------------------------------------------------------------------------

class TestScoredRecovery:
    def _score_but_do_not_publish(self, world, iid):
        """Run one poll with publishing broken, leaving the row at 'scored'.

        Its own MonkeyPatch so undoing it does not unwind the world fixture's
        service-layer patches."""
        boom = RuntimeError("network fell over between scored and published")
        mp = pytest.MonkeyPatch()
        mp.setattr(contest_node, "publish_scored_run",
                   lambda *a, **kw: (_ for _ in ()).throw(boom))
        # _reject would move it to 'rejected'; the crash we are modelling is
        # the process dying, so stop that write too.
        mp.setattr(contest_node, "_reject", lambda intake_id, reason: None)
        try:
            contest_node.poll_once(world["cfg"])
        finally:
            mp.undo()
        assert world["fake"].intake(iid)["status"] == "scored"

    def test_next_poll_publishes_instead_of_stranding(self, world):
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
                     intake_suffix="recover")
        self._score_but_do_not_publish(world, iid)
        assert not world["fake"].tables["run_cards"]

        # Publishing works again: the next poll picks the row up from 'scored'
        # and republishes from the report already on disk — no re-scoring, so
        # no second opening of the secret set.
        contest_node.poll_once(world["cfg"])

        row = world["fake"].intake(iid)
        assert row["status"] == "published", row.get("reject_reason")
        cards = world["fake"].tables["run_cards"]
        assert len(cards) == 1
        assert cards[0]["submitter"] == "acme-nmt-v2"
        assert row["run_card_id"] == cards[0]["id"]

    def test_scored_without_the_report_is_rejected_with_the_reason(
            self, world):
        iid = submit(world, dev_lines=_dev_refs(), test_lines=_blind_refs(),
                     intake_suffix="lostreport")
        self._score_but_do_not_publish(world, iid)
        # The node lost its output dir (cleared scratch / different machine).
        import shutil
        shutil.rmtree(Path(world["cfg"]["output_dir"]).expanduser() / iid)

        contest_node.poll_once(world["cfg"])
        row = world["fake"].intake(iid)
        assert row["status"] == "rejected"
        assert "no longer holds the TestReport" in row["reject_reason"]
        assert not world["fake"].tables["run_cards"]


class TestDisplayIdentity:
    """run_cards.submitter is world-readable; an email must never reach it."""

    def test_email_shaped_byline_is_refused(self):
        with pytest.raises(contest_node.NodeConfigError, match="email"):
            contest_node.assert_display_identity("octo@example.test")

    def test_manifest_byline_prefers_developer_then_method_then_label(self):
        assert contest_node.display_identity_from_manifest(
            {"developer": {"name": "Acme Labs"},
             "method": {"name": "acme-nmt"}}) == "Acme Labs"
        assert contest_node.display_identity_from_manifest(
            {"method": {"name": "acme-nmt"}}) == "acme-nmt"
        assert contest_node.display_identity_from_manifest(
            {"system_label": "legacy-system"}) == "legacy-system"

    def test_no_byline_at_all_is_loud(self):
        with pytest.raises(contest_node.NodeConfigError, match="no public byline"):
            contest_node.display_identity_from_manifest({})


class TestMethodLaneConfig:
    """R2 removed the T1 coupling: a contest entry that serves ONLY the method
    lane carries dev_corpus (for the node's qualifier re-execution) and no
    refs_* at all. The old validation rejected exactly that config."""

    def test_method_lane_entry_with_dev_corpus_and_no_refs_loads(self, tmp_path):
        p = tmp_path / "node.json"
        p.write_text(json.dumps({
            "node_id": "org-node-1",
            "contests": {"c1": {
                "dev_corpus": str(DEV_CORPUS),
                "secret_set_id": "eval-s-v1",
                "secret_artifact": "/x/a.sealed.json",
                "secret_privkey": "/x/k.key.json"}}}), encoding="utf-8")
        cfg = contest_node.load_node_config(p)
        assert cfg["contests"]["c1"]["dev_corpus"] == str(DEV_CORPUS)

    def test_entry_serving_neither_lane_is_refused(self, tmp_path):
        p = tmp_path / "node.json"
        p.write_text(json.dumps({
            "node_id": "org-node-1",
            "contests": {"c1": {"dev_corpus": str(DEV_CORPUS)}}}),
            encoding="utf-8")
        with pytest.raises(contest_node.NodeConfigError,
                           match="serves neither lane"):
            contest_node.load_node_config(p)


# ---------------------------------------------------------------------------
# Publication policy — contract C5 (practices 2 and 6).
#
# The promise "no result is visible while the contest runs" is kept at exactly
# one place: publish_or_defer. These tests hold that line — that an immediate
# contest is byte-for-byte the old path, that a hidden contest writes NOTHING
# to run_cards, that the withheld card is published verbatim by
# publish_deferred, that a second publish is a no-op, and that a database
# without migration 074 is a LOUD refusal rather than a publication.
# ---------------------------------------------------------------------------

from tests.fake_supabase import FakeSupabase as SharedFake  # noqa: E402
from tests.fake_supabase import patch_service_layer  # noqa: E402


DEFER_CONTEST = "synth-hidden-2026"
DEFER_SET = "eval-qaa-qab-synth-secret-v1"


def _card_row(card_id="run-abc", submitter="Acme Labs"):
    """A minimal stand-in for an assembled run_cards row.

    publish_or_defer never inspects the card's contents — assembly and
    validation happen in build_scored_run_row, which these tests do not
    re-cover — so a small honest dict is the right fixture here."""
    return {
        "id": card_id,
        "submitter": submitter,
        "trust": "verified",
        "model_slug": "acme/nmt",
        "condition": "method-execution",
        "dataset_id": DEFER_SET,
        "language_pair": "qaa>qab",
        "chrf_plus_plus": 61.25,
        "run_card": {"scores": {"chrf_plus_plus": 61.25}},
    }


def _fields():
    return {"track": "constrained", "is_primary": True,
            "description": "A synthetic entry.",
            "method_release_url": "https://example.test/m",
            "constraints": {"track": "constrained"},
            "submitter_label": "Acme Labs"}


@pytest.fixture
def defer_world(monkeypatch):
    """A fake DB carrying a contest, its request, and the 074 deferred table."""
    import mt_eval_harness.sovereign_service as svc
    fake = SharedFake()
    fake.tables["contests"].append({
        "id": DEFER_CONTEST, "name": "Hidden 2026", "status": "open",
        "corpus_id": DEFER_SET, "language_pair": "qaa>qab",
        "authorization_model": "per-submission",
        "metadata": {"primary_metric": "chrf_plus_plus",
                     "results_visibility": "hidden_until_close"},
    })
    fake.tables["authorization_requests"].append({
        "request_id": "authreq-1", "sealed_set_id": DEFER_SET,
        "state": "authorized", "fingerprint": "fp", "method_sha": "sha",
        "corpus_id": DEFER_SET, "corpus_version": "v1",
        "node_measurement": "node-1", "requested_by": PARTICIPANT,
    })
    patch_service_layer(monkeypatch, fake, svc, contest_node)
    return fake


def _contest(fake, **over):
    row = dict(fake.tables["contests"][0])
    row.update(over)
    return row


class TestPublishOrDefer:
    def test_immediate_publishes_card_and_submission(self, defer_world):
        c = _contest(defer_world, metadata={"results_visibility": "immediate"})
        out = contest_node.publish_or_defer(
            _card_row(), contest=c, request_id="authreq-1",
            requested_by=PARTICIPANT, notes="organizer-node executed",
            submission_fields=_fields())
        assert out == {"outcome": "published", "run_card_id": "run-abc",
                       "results_visibility": "immediate", "role": "main"}
        assert [r["id"] for r in defer_world.tables["run_cards"]] == ["run-abc"]
        sub = defer_world.tables["contest_submissions"][0]
        assert sub["contest_id"] == DEFER_CONTEST
        assert sub["run_card_id"] == "run-abc"
        assert sub["submitted_by"] == PARTICIPANT
        assert sub["authorization_request_id"] == "authreq-1"
        assert sub["track"] == "constrained" and sub["is_primary"] is True
        assert sub["submitter_label"] == "Acme Labs"
        assert not defer_world.tables["contest_deferred_results"]

    def test_hidden_until_close_writes_nothing_to_the_board(self, defer_world):
        out = contest_node.publish_or_defer(
            _card_row(), contest=_contest(defer_world),
            request_id="authreq-1", requested_by=PARTICIPANT,
            notes="organizer-node executed", submission_fields=_fields())
        assert out["outcome"] == "deferred"
        assert out["run_card_id"] is None
        assert defer_world.tables["run_cards"] == []
        assert defer_world.tables["contest_submissions"] == []
        held = defer_world.tables["contest_deferred_results"]
        assert len(held) == 1
        assert held[0]["request_id"] == "authreq-1"
        assert held[0]["contest_id"] == DEFER_CONTEST
        assert held[0]["sealed_set_id"] == DEFER_SET
        assert held[0]["role"] == "main"
        # The held row IS the row that would have been published…
        stored = held[0]["run_card_row"]
        assert contest_node._strip_sidecar(stored) == _card_row()
        # …plus the declarations that have no column of their own.
        side = stored[contest_node.DEFERRED_SIDECAR_KEY]
        assert side["fields"] == _fields()
        assert side["submitted_by"] == PARTICIPANT

    def test_force_defer_overrides_an_immediate_contest(self, defer_world):
        c = _contest(defer_world, metadata={"results_visibility": "immediate"})
        out = contest_node.publish_or_defer(
            _card_row("run-holdout"), contest=c, request_id="authreq-1",
            requested_by=PARTICIPANT, notes="organizer-node executed",
            role="holdout", force_defer=True, submission_fields=_fields())
        assert out["outcome"] == "deferred" and out["role"] == "holdout"
        assert defer_world.tables["run_cards"] == []
        assert defer_world.tables["contest_deferred_results"][0]["role"] \
            == "holdout"

    def test_sealed_set_resolved_from_the_request_when_omitted(self,
                                                               defer_world):
        contest_node.publish_or_defer(
            _card_row(), contest=_contest(defer_world),
            request_id="authreq-1", requested_by=PARTICIPANT, notes="n")
        assert defer_world.tables["contest_deferred_results"][0][
            "sealed_set_id"] == DEFER_SET

    def test_unknown_request_cannot_be_deferred(self, defer_world):
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="Cannot resolve the sealed set"):
            contest_node.publish_or_defer(
                _card_row(), contest=_contest(defer_world),
                request_id="authreq-nope", requested_by=PARTICIPANT,
                notes="n")

    def test_policy_is_refetched_when_the_caller_row_lacks_metadata(
            self, defer_world):
        """A partial contest row must never read as 'publish'."""
        partial = {"id": DEFER_CONTEST, "status": "open"}
        out = contest_node.publish_or_defer(
            _card_row(), contest=partial, request_id="authreq-1",
            requested_by=PARTICIPANT, notes="n")
        assert out["outcome"] == "deferred"
        assert defer_world.tables["run_cards"] == []

    def test_contest_missing_from_the_database_is_a_refusal(self, defer_world):
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="not on this database"):
            contest_node.publish_or_defer(
                _card_row(), contest={"id": "no-such-contest"},
                request_id="authreq-1", requested_by=PARTICIPANT, notes="n")
        assert defer_world.tables["run_cards"] == []

    def test_unknown_results_visibility_refuses_rather_than_guesses(
            self, defer_world):
        c = _contest(defer_world, metadata={"results_visibility": "later"})
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="not in the migration-074 vocabulary"):
            contest_node.publish_or_defer(
                _card_row(), contest=c, request_id="authreq-1",
                requested_by=PARTICIPANT, notes="n")
        assert defer_world.tables["run_cards"] == []

    def test_no_contest_publishes(self, defer_world):
        out = contest_node.publish_or_defer(
            _card_row(), contest=None, request_id="authreq-1",
            requested_by=PARTICIPANT, notes="n")
        assert out["outcome"] == "published"
        assert len(defer_world.tables["run_cards"]) == 1
        assert defer_world.tables["contest_submissions"] == []

    def test_force_defer_without_a_contest_is_refused(self, defer_world):
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="belongs to no contest"):
            contest_node.publish_or_defer(
                _card_row(), contest=None, request_id="authreq-1",
                requested_by=PARTICIPANT, notes="n", force_defer=True)

    def test_bad_role_is_refused(self, defer_world):
        with pytest.raises(ValueError, match="role must be one of"):
            contest_node.publish_or_defer(
                _card_row(), contest=_contest(defer_world),
                request_id="authreq-1", requested_by=PARTICIPANT, notes="n",
                role="secret")

    def test_row_without_an_id_is_refused(self, defer_world):
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="row with an id"):
            contest_node.publish_or_defer(
                {"submitter": "x"}, contest=_contest(defer_world),
                request_id="authreq-1", requested_by=PARTICIPANT, notes="n")

    def test_a_database_without_074_fails_loud_naming_the_migration(
            self, defer_world, monkeypatch):
        real = defer_world.__call__

        def no_table(method, path, **kw):
            if path == "contest_deferred_results":
                raise RuntimeError(
                    'Supabase service API error (404): {"code":"PGRST205",'
                    '"message":"Could not find the table"}')
            return real(method, path, **kw)

        monkeypatch.setattr(contest_node, "service_request", no_table)
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="migration 074"):
            contest_node.publish_or_defer(
                _card_row(), contest=_contest(defer_world),
                request_id="authreq-1", requested_by=PARTICIPANT, notes="n")
        assert defer_world.tables["run_cards"] == [], \
            "a missing 074 must never fall back to publishing"

    def test_re_defer_of_the_same_card_is_idempotent(self, defer_world):
        args = dict(contest=_contest(defer_world), request_id="authreq-1",
                    requested_by=PARTICIPANT, notes="n")
        contest_node.publish_or_defer(_card_row(), **args)
        out = contest_node.publish_or_defer(_card_row(), **args)
        assert out["outcome"] == "deferred"
        assert len(defer_world.tables["contest_deferred_results"]) == 1

    def test_a_second_different_card_never_overwrites_a_withheld_score(
            self, defer_world):
        args = dict(contest=_contest(defer_world), request_id="authreq-1",
                    requested_by=PARTICIPANT, notes="n")
        contest_node.publish_or_defer(_card_row("run-first"), **args)
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="already has a withheld result"):
            contest_node.publish_or_defer(_card_row("run-second"), **args)
        assert len(defer_world.tables["contest_deferred_results"]) == 1


class TestPublishDeferred:
    def _defer_one(self, fake, card_id="run-abc", role="main",
                   request_id="authreq-1"):
        contest_node.publish_or_defer(
            _card_row(card_id), contest=_contest(fake),
            request_id=request_id, requested_by=PARTICIPANT,
            notes=f"organizer-node executed ({request_id})",
            role=role, submission_fields=_fields())

    def test_publishes_the_held_row_verbatim(self, defer_world):
        self._defer_one(defer_world)
        ids = contest_node.publish_deferred(DEFER_CONTEST)
        assert ids == ["run-abc"]
        card = defer_world.tables["run_cards"][0]
        assert card == _card_row(), \
            "the published row is the row that was held, unchanged"
        assert contest_node.DEFERRED_SIDECAR_KEY not in card
        sub = defer_world.tables["contest_submissions"][0]
        assert sub["run_card_id"] == "run-abc"
        assert sub["track"] == "constrained"
        assert sub["authorization_request_id"] == "authreq-1"
        held = defer_world.tables["contest_deferred_results"][0]
        assert held["published_run_card_id"] == "run-abc"
        assert held["published_at"]

    def test_second_call_publishes_nothing(self, defer_world):
        self._defer_one(defer_world)
        assert contest_node.publish_deferred(DEFER_CONTEST) == ["run-abc"]
        assert contest_node.publish_deferred(DEFER_CONTEST) == []
        assert len(defer_world.tables["run_cards"]) == 1
        assert len(defer_world.tables["contest_submissions"]) == 1

    def test_holdout_rows_are_published_and_labelled(self, defer_world):
        defer_world.tables["authorization_requests"].append({
            **defer_world.tables["authorization_requests"][0],
            "request_id": "authreq-2"})
        self._defer_one(defer_world, "run-main", "main", "authreq-1")
        self._defer_one(defer_world, "run-hold", "holdout", "authreq-2")
        ids = contest_node.publish_deferred(DEFER_CONTEST)
        assert sorted(ids) == ["run-hold", "run-main"]
        notes = {s["run_card_id"]: s["notes"]
                 for s in defer_world.tables["contest_submissions"]}
        assert "[sealed holdout split]" in notes["run-hold"]
        assert "[sealed" not in notes["run-main"]

    def test_counts_only_the_unpublished(self, defer_world):
        self._defer_one(defer_world)
        assert contest_node.fetch_deferred_count(DEFER_CONTEST) == 1
        contest_node.publish_deferred(DEFER_CONTEST)
        assert contest_node.fetch_deferred_count(DEFER_CONTEST) == 0

    def test_count_on_a_database_without_074_is_loud_not_zero(
            self, defer_world, monkeypatch):
        def no_table(method, path, **kw):
            raise RuntimeError('Supabase service API error (404): '
                               '{"code":"PGRST205"}')
        monkeypatch.setattr(contest_node, "service_request", no_table)
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="migration 074"):
            contest_node.fetch_deferred_count(DEFER_CONTEST)

    def test_a_held_row_without_a_card_id_is_never_skipped_silently(
            self, defer_world):
        defer_world.tables["contest_deferred_results"].append({
            "request_id": "authreq-broken", "contest_id": DEFER_CONTEST,
            "sealed_set_id": DEFER_SET, "role": "main",
            "run_card_row": {"submitter": "x"},
            "deferred_at": "2026-09-06T00:00:00Z",
            "published_run_card_id": None, "published_at": None})
        with pytest.raises(contest_node.PublicationPolicyError,
                           match="no id"):
            contest_node.publish_deferred(DEFER_CONTEST)


# ---------------------------------------------------------------------------
# load_node_config: the second sealed split and the third-party diagnostic
# suites (M3-prep). A node that ADVERTISES a set must HOLD it — discovering a
# missing or wrong-bytes corpus after a custody ceremony is too late.
# ---------------------------------------------------------------------------

class TestHoldoutAndSuiteConfig:
    def _corpus(self, tmp_path, name):
        p = tmp_path / f"{name}.json"
        p.write_text(json.dumps({
            "dataset": {"corpus_id": name, "version": "1.0",
                        "language_pair": {"source": "qaa", "target": "qab"},
                        "provenance": {"license": "CC0-1.0"}},
            "entries": [{"id": 0, "source": "mira sol volu",
                         "reference": "sol miravo"}],
        }), encoding="utf-8")
        return p

    def _write(self, tmp_path, extra):
        contest = {"secret_set_id": "eval-s-v1",
                   "secret_artifact": "/x/a.sealed.json"}
        contest.update(extra)
        p = tmp_path / "node.json"
        p.write_text(json.dumps({"node_id": "org-node-1",
                                 "contests": {"c1": contest}}),
                     encoding="utf-8")
        return p

    # --- holdout ----------------------------------------------------------
    def test_holdout_loads_when_the_file_is_there_and_pinned(self, tmp_path):
        corpus = self._corpus(tmp_path, "holdout")
        p = self._write(tmp_path, {
            "holdout_set_id": "eval-h-v1",
            "holdout_corpus": str(corpus),
            "holdout_corpus_sha256": sha256_file(corpus)})
        cfg = contest_node.load_node_config(p)
        assert cfg["contests"]["c1"]["holdout_corpus"] == str(corpus)

    def test_missing_holdout_file_refused_at_startup(self, tmp_path):
        p = self._write(tmp_path, {"holdout_set_id": "eval-h-v1",
                                   "holdout_corpus": str(tmp_path / "no.json")})
        with pytest.raises(contest_node.NodeConfigError,
                           match="does not exist on this node"):
            contest_node.load_node_config(p)

    def test_holdout_sha_mismatch_refused(self, tmp_path):
        corpus = self._corpus(tmp_path, "holdout")
        p = self._write(tmp_path, {"holdout_set_id": "eval-h-v1",
                                   "holdout_corpus": str(corpus),
                                   "holdout_corpus_sha256": "b" * 64})
        with pytest.raises(contest_node.NodeConfigError,
                           match="different bytes"):
            contest_node.load_node_config(p)

    def test_holdout_without_an_id_refused(self, tmp_path):
        corpus = self._corpus(tmp_path, "holdout")
        p = self._write(tmp_path, {"holdout_corpus": str(corpus)})
        with pytest.raises(contest_node.NodeConfigError,
                           match="no holdout_set_id"):
            contest_node.load_node_config(p)

    def test_holdout_id_without_a_corpus_refused(self, tmp_path):
        p = self._write(tmp_path, {"holdout_set_id": "eval-h-v1"})
        with pytest.raises(contest_node.NodeConfigError,
                           match="no holdout_corpus"):
            contest_node.load_node_config(p)

    def test_holdout_pointing_at_the_secret_set_refused(self, tmp_path):
        corpus = self._corpus(tmp_path, "holdout")
        p = self._write(tmp_path, {"holdout_set_id": "eval-s-v1",
                                   "holdout_corpus": str(corpus)})
        with pytest.raises(contest_node.NodeConfigError,
                           match="SECOND, disjoint split"):
            contest_node.load_node_config(p)

    def test_a_relay_with_no_method_lane_may_not_declare_a_holdout(self,
                                                                   tmp_path):
        corpus = self._corpus(tmp_path, "holdout")
        p = tmp_path / "node.json"
        p.write_text(json.dumps({"node_id": "relay-1", "contests": {"c1": {
            "dev_corpus": "/x/dev.json", "refs_plaintext": "/x/refs.json",
            "holdout_set_id": "eval-h-v1",
            "holdout_corpus": str(corpus)}}}), encoding="utf-8")
        with pytest.raises(contest_node.NodeConfigError,
                           match="serves no method lane"):
            contest_node.load_node_config(p)

    # --- test suites ------------------------------------------------------
    def _suite_cfg(self, tmp_path, **over):
        corpus = self._corpus(tmp_path, "suite")
        suite = {"suite_id": "eval-thirdparty-diag-v1",
                 "corpus_path": str(corpus),
                 "corpus_sha256": sha256_file(corpus)}
        suite.update(over)
        return self._write(tmp_path, {"test_suites": [suite]}), corpus

    def test_suites_load_and_are_normalized(self, tmp_path, monkeypatch):
        monkeypatch.setenv("MT_EVAL_SUPABASE_SERVICE_KEY", "test-key")
        monkeypatch.setattr(contest_node, "_fetch_rows",
                            lambda path, params: [{"metadata": {
                                "test_suites": [{
                                    "suite_id": "eval-thirdparty-diag-v1",
                                    "sha256": sha256_file(
                                        tmp_path / "suite.json")}]}}])
        p, corpus = self._suite_cfg(tmp_path)
        cfg = contest_node.load_node_config(p, database=True)
        assert cfg["contests"]["c1"]["test_suites"] == [{
            "suite_id": "eval-thirdparty-diag-v1",
            "corpus_path": str(corpus),
            "corpus_sha256": sha256_file(corpus)}]

    def test_unpinned_suite_refused(self, tmp_path):
        corpus = self._corpus(tmp_path, "suite")
        p = self._write(tmp_path, {"test_suites": [
            {"suite_id": "s1", "corpus_path": str(corpus)}]})
        with pytest.raises(contest_node.NodeConfigError,
                           match="missing \\['corpus_sha256'\\]"):
            contest_node.load_node_config(p)

    def test_suite_sha_mismatch_refused(self, tmp_path):
        p, _ = self._suite_cfg(tmp_path, corpus_sha256="c" * 64)
        with pytest.raises(contest_node.NodeConfigError,
                           match="different bytes"):
            contest_node.load_node_config(p)

    def test_duplicate_suite_refused(self, tmp_path):
        corpus = self._corpus(tmp_path, "suite")
        suite = {"suite_id": "s1", "corpus_path": str(corpus),
                 "corpus_sha256": sha256_file(corpus)}
        p = self._write(tmp_path, {"test_suites": [suite, dict(suite)]})
        with pytest.raises(contest_node.NodeConfigError, match="twice"):
            contest_node.load_node_config(p)

    def test_suites_must_match_the_contests_frozen_declaration(self, tmp_path,
                                                               monkeypatch):
        monkeypatch.setenv("MT_EVAL_SUPABASE_SERVICE_KEY", "test-key")
        monkeypatch.setattr(contest_node, "_fetch_rows",
                            lambda path, params: [{"metadata": {
                                "test_suites": [{"suite_id": "some-other-v1",
                                                 "sha256": "d" * 64}]}}])
        p, _ = self._suite_cfg(tmp_path)
        with pytest.raises(contest_node.NodeConfigError,
                           match="do not match the contest"):
            contest_node.load_node_config(p, database=True)

    def test_contest_pin_mismatch_refused(self, tmp_path, monkeypatch):
        monkeypatch.setenv("MT_EVAL_SUPABASE_SERVICE_KEY", "test-key")
        monkeypatch.setattr(contest_node, "_fetch_rows",
                            lambda path, params: [{"metadata": {
                                "test_suites": [{
                                    "suite_id": "eval-thirdparty-diag-v1",
                                    "sha256": "e" * 64}]}}])
        p, _ = self._suite_cfg(tmp_path)
        with pytest.raises(contest_node.NodeConfigError,
                           match="pinned at sha256"):
            contest_node.load_node_config(p, database=True)

    def test_invisible_contest_is_a_refusal_not_a_shrug(self, tmp_path,
                                                        monkeypatch):
        monkeypatch.setenv("MT_EVAL_SUPABASE_SERVICE_KEY", "test-key")
        monkeypatch.setattr(contest_node, "_fetch_rows",
                            lambda path, params: [])
        p, _ = self._suite_cfg(tmp_path)
        with pytest.raises(contest_node.NodeConfigError,
                           match="not visible on this endpoint"):
            contest_node.load_node_config(p, database=True)

    def test_unreachable_database_says_out_loud_that_it_could_not_check(
            self, tmp_path, monkeypatch, capsys):
        """A database command whose database cannot be reached still loads
        the suites (the files and pins are checked locally), but the node
        must SAY that the ids were not compared — never pass silently."""
        def no_network(path, params):
            raise RuntimeError("Network error contacting Supabase")

        monkeypatch.setenv("MT_EVAL_SUPABASE_SERVICE_KEY", "test-key")
        monkeypatch.setattr(contest_node, "_fetch_rows", no_network)
        p, _ = self._suite_cfg(tmp_path)
        cfg = contest_node.load_node_config(p, database=True)
        assert cfg["contests"]["c1"]["test_suites"]
        assert "were NOT verified" in capsys.readouterr().out

    def test_offline_load_never_asks_the_database(self, tmp_path,
                                                  monkeypatch, capsys):
        """Round 8: every `--offline` node command loaded node.json, which
        compared the suites with the contest database and — with no service
        key — printed the six-line "set the key … or add --offline" text,
        even with --offline given. An offline load never asks."""
        monkeypatch.delenv("MT_EVAL_SUPABASE_SERVICE_KEY", raising=False)

        def asked(path, params):
            raise AssertionError("an offline config load asked the database")

        monkeypatch.setattr(contest_node, "_fetch_rows", asked)
        p, _ = self._suite_cfg(tmp_path)
        cfg = contest_node.load_node_config(p)
        assert cfg["contests"]["c1"]["test_suites"]
        out = capsys.readouterr()
        assert "SERVICE_KEY" not in out.out + out.err
        assert "--offline" not in out.out + out.err

    def test_database_command_without_a_key_fails_once_with_its_message(
            self, tmp_path, monkeypatch, capsys):
        from mt_eval_harness.sovereign_service import ServiceConfigError
        monkeypatch.delenv("MT_EVAL_SUPABASE_SERVICE_KEY", raising=False)
        p, _ = self._suite_cfg(tmp_path)
        with pytest.raises(ServiceConfigError, match="SERVICE_KEY is not set"):
            contest_node.load_node_config(p, database=True)
        # raised, not printed as a warning first and raised again later
        assert "SERVICE_KEY" not in capsys.readouterr().out


class TestPrizeTermsHashOnTheNode:
    """The air-gapped node cannot read `contests.metadata`, so the contest's
    frozen prize-terms digest is carried to it in node.json. Without it the
    entry's acceptance can only ever be WARNed about (measured 2026-09-07:
    P2's whole hash gate was inert on the sneakernet lane)."""

    def _write_cfg(self, tmp_path, contest):
        cfg = {"node_id": "airgap-1", "contests": {"c1": contest}}
        p = tmp_path / "node.json"
        p.write_text(json.dumps(cfg), encoding="utf-8")
        return p

    def _base(self, **extra):
        return {"secret_set_id": "eval-s-v1",
                "secret_artifact": "/x/a.sealed.json",
                "custody": "threshold-quorum", **extra}

    def test_absent_is_fine(self, tmp_path):
        cfg = contest_node.load_node_config(
            self._write_cfg(tmp_path, self._base()))
        assert "prize_terms_sha256" not in cfg["contests"]["c1"]

    def test_valid_digest_survives_the_load(self, tmp_path):
        digest = "a" * 64
        cfg = contest_node.load_node_config(
            self._write_cfg(tmp_path, self._base(prize_terms_sha256=digest)))
        assert cfg["contests"]["c1"]["prize_terms_sha256"] == digest

    def test_whitespace_is_trimmed(self, tmp_path):
        digest = "b" * 64
        cfg = contest_node.load_node_config(
            self._write_cfg(tmp_path,
                            self._base(prize_terms_sha256=f"  {digest}\n")))
        assert cfg["contests"]["c1"]["prize_terms_sha256"] == digest

    @pytest.mark.parametrize("bad", [
        "not-a-digest",
        "A" * 64,          # uppercase is not the terms_sha256 spelling
        "c" * 63,          # truncated by a bad paste
        "c" * 65,
        1234,
    ])
    def test_a_malformed_digest_is_refused_at_startup(self, tmp_path, bad):
        p = self._write_cfg(tmp_path, self._base(prize_terms_sha256=bad))
        with pytest.raises(contest_node.NodeConfigError,
                           match="prize_terms_sha256"):
            contest_node.load_node_config(p)
