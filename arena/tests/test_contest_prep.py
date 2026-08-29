"""contest_prep — deterministic splits, sealed-at-rest artifacts, honest refusals.

Offline except for the seal step, which shells out to the monorepo champollion
CLI (`seal-corpus`) — that path skips cleanly when node/the cli tree is absent
(standalone pip install), same convention as the method-bridge parity test.
Registration is tested against monkeypatched REST helpers; no network.

Synthetic fixture corpus only (tests/fixtures/contest_synthetic).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from mt_eval_harness import contest_prep as prep

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
MASTER = FIXTURES / "corpus_dev.json"  # 6 entries — plenty for tiny splits

SENTINEL_REFS = ("sol miravo", "luna kanivo", "pira venuvo",
                 "keno toluvo", "rena silovo", "meno haruvo")


def _cli_available() -> bool:
    if shutil.which("node") is None:
        return False
    try:
        prep.find_champollion_cli()
        return True
    except prep.ContestPrepError:
        return False


# ---------------------------------------------------------------------------
# split_corpus — pure determinism.
# ---------------------------------------------------------------------------

class TestSplit:
    ENTRIES = [{"source": f"s{i}", "reference": f"r{i}"} for i in range(20)]

    def test_deterministic_and_disjoint(self):
        a = prep.split_corpus(self.ENTRIES, dev_size=5, blind_size=8,
                              secret_size=3, seed=42)
        b = prep.split_corpus(self.ENTRIES, dev_size=5, blind_size=8,
                              secret_size=3, seed=42)
        assert a == b, "same seed => identical split"
        dev, blind, secret = a
        assert (len(dev), len(blind), len(secret)) == (5, 8, 3)
        seen = [e["source"] for part in a for e in part]
        assert len(seen) == len(set(seen)), "splits are disjoint"

    def test_different_seed_different_split(self):
        a = prep.split_corpus(self.ENTRIES, dev_size=5, blind_size=8, seed=1)
        b = prep.split_corpus(self.ENTRIES, dev_size=5, blind_size=8, seed=2)
        assert a != b

    def test_oversized_split_refused(self):
        with pytest.raises(prep.ContestPrepError, match="only"):
            prep.split_corpus(self.ENTRIES, dev_size=15, blind_size=10, seed=1)

    def test_zero_tier_refused(self):
        with pytest.raises(prep.ContestPrepError, match="positive"):
            prep.split_corpus(self.ENTRIES, dev_size=0, blind_size=5, seed=1)


# ---------------------------------------------------------------------------
# prepare_contest — refusals that must never proceed.
# ---------------------------------------------------------------------------

def _prepare_kwargs(tmp_path, **overrides):
    kwargs = dict(
        master_corpus_path=MASTER,
        slug="synth",
        name="Synthetic Open 2026",
        source_lang="qaa",
        target_lang="qab",
        dev_size=3,
        blind_size=3,
        seed=7,
        qualifier_threshold=42.5,
        out_dir=tmp_path / "contest",
    )
    kwargs.update(overrides)
    return kwargs


class TestPrepareRefusals:
    def test_plaintext_refs_with_per_submission_refused(self, tmp_path):
        with pytest.raises(prep.ContestPrepError, match="security theater"):
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, plaintext_refs=True,
                authorization_model="per-submission"))

    def test_missing_threshold_refused(self, tmp_path):
        with pytest.raises(prep.ContestPrepError, match="threshold"):
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, qualifier_threshold=0))

    def test_sealing_without_key_material_refused(self, tmp_path):
        with pytest.raises(prep.ContestPrepError, match="custodian-group"):
            prep.prepare_contest(**_prepare_kwargs(tmp_path))

    def test_bad_authorization_model_refused(self, tmp_path):
        with pytest.raises(prep.ContestPrepError, match="authorization_model"):
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, authorization_model="vibes"))


# ---------------------------------------------------------------------------
# prepare_contest — the plaintext-refs (blanket) path is fully offline.
# ---------------------------------------------------------------------------

class TestPreparePlaintextBlanket:
    def test_artifacts_and_manifest(self, tmp_path):
        manifest = prep.prepare_contest(**_prepare_kwargs(
            tmp_path, plaintext_refs=True, authorization_model="blanket"))

        out = tmp_path / "contest"
        q = manifest["qualifier"]
        assert q["qualifier_id"] == "eval-qaa-qab-synth-qualifier-v" + str(q["year"])
        assert q["threshold"] == 42.5

        # T0: public dev corpus has source AND refs, segment dev.
        dev = json.loads(Path(q["corpus_file"]).read_text(encoding="utf-8"))
        assert len(dev["entries"]) == 3
        assert all(e["reference"] and e["segment"] == "dev"
                   for e in dev["entries"])

        # T1 source release: NO reference field anywhere.
        src_file = Path(manifest["blind"]["source_release_file"])
        raw = src_file.read_text(encoding="utf-8")
        blind_src = json.loads(raw)
        assert all("reference" not in e for e in blind_src["entries"])
        for ref in SENTINEL_REFS:
            assert ref not in raw, "a reference leaked into the source release"

        # Refs live under local/ as plaintext (the honest weaker posture).
        refs_file = Path(manifest["blind"]["refs_plaintext_file"])
        assert refs_file.exists()
        refs = json.loads(refs_file.read_text(encoding="utf-8"))
        assert all(e["segment"] == "held_out" for e in refs["entries"])

        # The blind sets are disjoint from dev (split guarantee, end to end).
        dev_sources = {e["source"] for e in dev["entries"]}
        blind_sources = {e["source"] for e in blind_src["entries"]}
        assert not dev_sources & blind_sources

        # Manifest recorded the recipe.
        m = json.loads(Path(manifest["manifest_path"]).read_text(encoding="utf-8"))
        assert m["seed"] == 7
        assert m["sizes"] == {"dev": 3, "blind": 3, "secret": 0}
        assert m["contest"]["authorization_model"] == "blanket"
        assert "ORGANIZER-LOCAL" in m["_note"]

    def test_secret_split_requires_sealing(self, tmp_path):
        with pytest.raises(prep.ContestPrepError, match="Split needs|secret"):
            # 3+3+3 > 6 fixture entries → the size check fires first and loud;
            # a big enough corpus would then hit the sealing requirement.
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, plaintext_refs=True, authorization_model="blanket",
                secret_size=3))

    def test_shared_task_recorded_in_manifest(self, tmp_path):
        """--shared-task (046 umbrella) rides the manifest; default is None."""
        manifest = prep.prepare_contest(**_prepare_kwargs(
            tmp_path, plaintext_refs=True, authorization_model="blanket",
            shared_task_id="americasnlp-2026"))
        m = json.loads(Path(manifest["manifest_path"]).read_text(encoding="utf-8"))
        assert m["contest"]["shared_task_id"] == "americasnlp-2026"

        manifest2 = prep.prepare_contest(**_prepare_kwargs(
            tmp_path, plaintext_refs=True, authorization_model="blanket",
            out_dir=tmp_path / "standalone"))
        assert manifest2["contest"]["shared_task_id"] is None


# ---------------------------------------------------------------------------
# prepare_contest — sealed default path (needs node + the monorepo CLI).
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not _cli_available(),
                    reason="node + cli/bin/cli.js needed for the seal step")
class TestPrepareSealed:
    def _keygen(self, tmp_path) -> str:
        keys = tmp_path / "keys"
        argv = prep.find_champollion_cli() + [
            "seal-corpus", "keygen", "--out", str(keys)]
        proc = subprocess.run(argv, capture_output=True, text=True, timeout=60)
        assert proc.returncode == 0, proc.stderr
        return str(next(keys.glob("*.pub.json")))

    def test_sealed_refs_no_plaintext_left(self, tmp_path):
        pub = self._keygen(tmp_path)
        manifest = prep.prepare_contest(**_prepare_kwargs(
            tmp_path,
            custodian_group_id="org-synth-test",
            threshold_pubkey=pub,
        ))
        blind = manifest["blind"]
        # Plaintext refs file was deleted after sealing.
        assert blind["refs_plaintext_file"] is None
        local = tmp_path / "contest" / "local"
        assert not (local / f"{blind['sealed_set_id']}.refs.json").exists()

        # The sealed artifact exists, is ciphertext-only, and its digest
        # matches the card block (what sealed_sets will register).
        artifact_path = Path(blind["refs_sealed_artifact"])
        raw = artifact_path.read_text(encoding="utf-8")
        for ref in SENTINEL_REFS:
            assert ref not in raw, "plaintext reference leaked into ciphertext artifact"
        artifact = json.loads(raw)
        block = blind["sealed_block"]
        assert artifact["ciphertextDigest"] == block["ciphertextDigest"]
        assert block["qualifierId"] == manifest["qualifier"]["qualifier_id"]
        assert block["qualifierThreshold"] == 42.5
        assert block["keyScheme"] == "single-keypair-wave1"
        # The plaintext sha was recorded BEFORE sealing (integrity forever).
        assert len(blind["refs_plaintext_sha256"]) == 64


# ---------------------------------------------------------------------------
# register_prepared — content-free rows, right order, no datasets row.
# ---------------------------------------------------------------------------

class TestRegisterPrepared:
    def _manifest(self):
        return {
            "prepared_at": "2026-07-07T00:00:00+00:00",
            "contest": {
                "slug": "synth", "name": "Synthetic Open 2026",
                "language_pair": "qaa>qab",
                "authorization_model": "blanket",
                "intake_daily_limit": 5,
            },
            "custodian_group_id": "org-synth-test",
            "qualifier": {
                "qualifier_id": "eval-qaa-qab-synth-qualifier-v2026",
                "corpus_card_id": "eval-qaa-qab-synth-qualifier-v2026",
                "threshold": 42.5, "metric": "composite", "year": 2026,
            },
            "blind": {
                "sealed_set_id": "eval-qaa-qab-synth-blindtest-v1",
                "sealed_block": {
                    "cipher": "x25519-hkdf-sha256+aes-256-gcm",
                    "ciphertextDigest": "d" * 64,
                    "keyScheme": "single-keypair-wave1",
                },
            },
            "secret": None,
        }

    def test_registration_rows(self, monkeypatch):
        calls = []

        def fake_service_request(method, path, **kw):
            calls.append((method, path, kw.get("data"), kw.get("params")))
            return []

        def fake_create_contest(**kwargs):
            calls.append(("CREATE_CONTEST", kwargs))
            return {"id": "synthetic-open-2026"}

        import mt_eval_harness.sovereign_service as svc
        import mt_eval_harness.contest as contest_mod
        monkeypatch.setattr(svc, "service_request", fake_service_request)
        monkeypatch.setattr(contest_mod, "create_contest", fake_create_contest)

        prep.register_prepared(self._manifest(), open_intake=True)

        paths = [c[1] for c in calls if c[0] in ("POST", "PATCH")]
        # sealed_sets BEFORE qualifiers (FK) BEFORE the contest policy PATCH.
        assert paths.index("sealed_sets") < paths.index("qualifiers")
        assert "datasets" not in paths, (
            "registration must NOT create a datasets row — a quarantined "
            "datasets row would make migration 022 block the score publishes")

        sealed_row = next(c[2] for c in calls if c[1] == "sealed_sets")
        assert sealed_row["ciphertext_digest"] == "d" * 64
        assert sealed_row["custodian_group_id"] == "org-synth-test"
        assert "source" not in sealed_row and "reference" not in sealed_row

        qrow = next(c[2] for c in calls if c[1] == "qualifiers")
        assert qrow["threshold"] == 42.5 and qrow["status"] == "active"

        create = next(c[1] for c in calls if c[0] == "CREATE_CONTEST")
        assert create["corpus_id"] == "eval-qaa-qab-synth-blindtest-v1"

        patch = next(c for c in calls if c[0] == "PATCH")
        assert patch[2]["authorization_model"] == "blanket"
        assert patch[2]["intake_open"] is True
        # No edition in the manifest → the PATCH never mentions the FK (a
        # pre-047 manifest registers exactly as before).
        assert "shared_task_id" not in patch[2]

    def test_shared_task_membership_patched(self, monkeypatch):
        """A manifest carrying an edition stamps contests.shared_task_id."""
        calls = []

        def fake_service_request(method, path, **kw):
            calls.append((method, path, kw.get("data"), kw.get("params")))
            return []

        import mt_eval_harness.sovereign_service as svc
        import mt_eval_harness.contest as contest_mod
        monkeypatch.setattr(svc, "service_request", fake_service_request)
        monkeypatch.setattr(contest_mod, "create_contest",
                            lambda **kw: {"id": "synthetic-open-2026"})

        manifest = self._manifest()
        manifest["contest"]["shared_task_id"] = "americasnlp-2026"
        prep.register_prepared(manifest, open_intake=True)

        patch = next(c for c in calls if c[0] == "PATCH")
        assert patch[2]["shared_task_id"] == "americasnlp-2026"


# ---------------------------------------------------------------------------
# register_prepared_self_serve — the migration-046 door: organizer's OWN
# session, identity-bound rows, no service key ever touched.
# ---------------------------------------------------------------------------

class TestRegisterPreparedSelfServe:
    _manifest = TestRegisterPrepared._manifest

    def _patch(self, monkeypatch, calls, patch_result=None,
               create_contest_error=None):
        """Wire the self-serve lane's collaborators to a synthetic session.
        service_request is patched to a tripwire: the self-serve lane must
        NEVER touch the service-role path."""
        import mt_eval_harness.auth as auth_mod
        import mt_eval_harness.contest as contest_mod
        import mt_eval_harness.sovereign_service as svc

        def fake_api_request(method, path, data=None, params=None,
                             session=None, prefer=None):
            calls.append((method, path, data, params, session, prefer))
            if method == "PATCH":
                return (patch_result if patch_result is not None
                        else [{"id": "synthetic-open-2026"}])
            return []

        def fake_create_contest(**kwargs):
            calls.append(("CREATE_CONTEST", kwargs))
            if create_contest_error is not None:
                raise create_contest_error
            return {"id": "synthetic-open-2026"}

        def service_tripwire(*a, **kw):
            raise AssertionError(
                "self-serve registration must never use service_request")

        monkeypatch.setattr(auth_mod, "get_session",
                            lambda: {"access_token": "tok",
                                     "user": {"email": "org@example.org"}})
        monkeypatch.setattr(contest_mod, "_api_request", fake_api_request)
        monkeypatch.setattr(contest_mod, "create_contest", fake_create_contest)
        monkeypatch.setattr(svc, "service_request", service_tripwire)
        monkeypatch.setattr(svc, "assert_not_prod", lambda: None)

    def test_identity_bound_rows_and_order(self, monkeypatch):
        calls = []
        self._patch(monkeypatch, calls)

        prep.register_prepared_self_serve(self._manifest(), open_intake=True)

        paths = [c[1] for c in calls if c[0] in ("POST", "PATCH")]
        # sealed_sets BEFORE qualifiers (FK + ownership check) BEFORE PATCH.
        assert paths.index("sealed_sets") < paths.index("qualifiers")
        assert "datasets" not in paths

        sealed = next(c for c in calls if c[1] == "sealed_sets")
        # created_by = the JWT email (what the 046 policies admit); born
        # quarantined + active; authenticated session; idempotent re-run.
        assert sealed[2]["created_by"] == "org@example.org"
        assert sealed[2]["quarantined"] is True
        assert sealed[2]["status"] == "active"
        assert sealed[4] is not None, "must send the user session"
        assert "ignore-duplicates" in sealed[5]

        qual = next(c for c in calls if c[1] == "qualifiers")
        assert qual[2]["created_by"] == "org@example.org"
        assert qual[2]["status"] == "active"
        assert qual[2]["sealed_set_id"] == "eval-qaa-qab-synth-blindtest-v1"

        create = next(c[1] for c in calls if c[0] == "CREATE_CONTEST")
        # create_contest always stamps the JWT email (migration 052) — the
        # old bind_owner_email opt-in flag is gone from the call surface.
        assert "bind_owner_email" not in create

        patch = next(c for c in calls if c[0] == "PATCH")
        assert patch[2]["authorization_model"] == "blanket"
        assert patch[2]["intake_open"] is True
        assert patch[4] is not None, "policy PATCH must use the user session"

    def test_existing_contest_tolerated_on_rerun(self, monkeypatch):
        calls = []
        self._patch(monkeypatch, calls, create_contest_error=RuntimeError(
            "Supabase API error (409): duplicate key value"))

        record = prep.register_prepared_self_serve(self._manifest())
        # Falls back to the slug and still applies the policy PATCH.
        assert record["id"] == "synthetic-open-2026"
        assert any(c[0] == "PATCH" for c in calls)

    def test_policy_patch_matching_no_row_fails_loud(self, monkeypatch):
        calls = []
        self._patch(monkeypatch, calls, patch_result=[])

        with pytest.raises(RuntimeError, match="owner-update policy"):
            prep.register_prepared_self_serve(self._manifest())
