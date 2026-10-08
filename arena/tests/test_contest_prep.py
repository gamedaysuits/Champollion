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
        dev, blind, secret, holdout = a
        assert (len(dev), len(blind), len(secret), len(holdout)) == (5, 8, 3, 0)
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
        # Named explicitly: prepare never chooses a licence (2026-10-03).
        license_id="CC-BY-4.0",
        out_dir=tmp_path / "contest",
    )
    kwargs.update(overrides)
    return kwargs


class TestPrepareRefusals:
    @pytest.mark.parametrize("license_id", [None, "", "   "])
    def test_no_licence_is_refused_before_anything_is_written(self, tmp_path,
                                                              license_id):
        # Regression (synthetic organizer, 2026-10-03): the released dev set
        # was stamped CC-BY-4.0 when no --license was given.
        out = tmp_path / "contest"
        with pytest.raises(prep.ContestPrepError, match="--license is required") as ei:
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, license_id=license_id, plaintext_refs=True,
                authorization_model="blanket"))
        assert "CC-BY-NC-4.0" in str(ei.value) and "LicenseRef-" in str(ei.value)
        assert not out.exists()

    def test_the_named_licence_is_what_the_released_files_carry(self, tmp_path):
        manifest = prep.prepare_contest(**_prepare_kwargs(
            tmp_path, license_id="CC-BY-NC-4.0", plaintext_refs=True,
            authorization_model="blanket"))
        assert manifest["license"] == "CC-BY-NC-4.0"
        dev = json.loads(Path(manifest["qualifier"]["corpus_file"]).read_text())
        # dataset.license: the field the loader, publish and qualify read
        # (Round 2: provenance.license was read by none of them).
        assert dev["dataset"]["license"] == "CC-BY-NC-4.0"

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
        assert m["sizes"] == {"dev": 3, "blind": 3, "secret": 0,
                              "holdout": 0}
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


# ---------------------------------------------------------------------------
# The sealed HOLDOUT split + the optional blind tier (founder ruling R2,
# 2026-09-06). Practice 7: a second private split, executed inside the same
# authorized run, always withheld until close.
# ---------------------------------------------------------------------------

class TestHoldoutSplit:
    ENTRIES = [{"source": f"s{i}", "reference": f"r{i}"} for i in range(20)]

    def test_holdout_is_disjoint_and_deterministic(self):
        a = prep.split_corpus(self.ENTRIES, dev_size=4, blind_size=3,
                              secret_size=5, holdout_size=2, seed=11)
        b = prep.split_corpus(self.ENTRIES, dev_size=4, blind_size=3,
                              secret_size=5, holdout_size=2, seed=11)
        assert a == b
        dev, blind, secret, holdout = a
        assert (len(dev), len(blind), len(secret), len(holdout)) == (4, 3, 5, 2)
        seen = [e["source"] for part in a for e in part]
        assert len(seen) == len(set(seen)), "all four splits are disjoint"

    def test_adding_a_holdout_leaves_the_earlier_tiers_byte_identical(self):
        """The slices are taken in a FIXED order, so an organizer who adds a
        holdout to an existing recipe does not silently reshuffle the dev,
        blind or secret sets under the same seed."""
        without = prep.split_corpus(self.ENTRIES, dev_size=4, blind_size=3,
                                    secret_size=5, seed=11)
        with_ho = prep.split_corpus(self.ENTRIES, dev_size=4, blind_size=3,
                                    secret_size=5, holdout_size=2, seed=11)
        assert without[:3] == with_ho[:3]

    def test_blind_may_be_zero(self):
        """R2 retired the blind tier as a contest tier; a contest with only a
        qualifier + secret + holdout is normal now."""
        dev, blind, secret, holdout = prep.split_corpus(
            self.ENTRIES, dev_size=4, secret_size=5, holdout_size=2, seed=3)
        assert blind == []
        assert (len(dev), len(secret), len(holdout)) == (4, 5, 2)

    def test_negative_holdout_refused(self):
        with pytest.raises(prep.ContestPrepError, match="holdout-size"):
            prep.split_corpus(self.ENTRIES, dev_size=4, secret_size=2,
                              holdout_size=-1, seed=1)

    def test_holdout_needs_a_secret_set(self, tmp_path):
        with pytest.raises(prep.ContestPrepError, match="needs --secret-size"):
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, dev_size=2, blind_size=2, secret_size=0,
                holdout_size=2, plaintext_refs=True,
                authorization_model="blanket"))

    def test_holdout_refuses_plaintext_refs(self, tmp_path):
        with pytest.raises(prep.ContestPrepError, match="requires sealing"):
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, dev_size=2, blind_size=0, secret_size=2,
                holdout_size=2, plaintext_refs=True,
                authorization_model="blanket"))

    def test_a_contest_with_no_sealed_set_at_all_is_refused(self, tmp_path):
        with pytest.raises(prep.ContestPrepError,
                           match="needs a sealed set"):
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, blind_size=0, secret_size=0,
                plaintext_refs=True, authorization_model="blanket"))


@pytest.mark.skipif(not _cli_available(),
                    reason="node + cli/bin/cli.js needed for the seal step")
class TestPrepareHoldoutSealed:
    def _keygen(self, tmp_path) -> str:
        keys = tmp_path / "keys"
        argv = prep.find_champollion_cli() + [
            "seal-corpus", "keygen", "--out", str(keys)]
        proc = subprocess.run(argv, capture_output=True, text=True, timeout=60)
        assert proc.returncode == 0, proc.stderr
        return str(next(keys.glob("*.pub.json")))

    def test_holdout_sealed_and_no_plaintext_survives(self, tmp_path):
        pub = self._keygen(tmp_path)
        manifest = prep.prepare_contest(**_prepare_kwargs(
            tmp_path, dev_size=2, blind_size=0, secret_size=2,
            holdout_size=2, custodian_group_id="org-synth-test",
            threshold_pubkey=pub))
        holdout = manifest["holdout"]
        assert holdout["sealed_set_id"] == "eval-qaa-qab-synth-holdout-v1"
        assert manifest["blind"] is None, "--blind-size 0 prepares no blind tier"
        local = tmp_path / "contest" / "local"
        assert not (local / "eval-qaa-qab-synth-holdout-v1.corpus.json").exists()
        raw = Path(holdout["corpus_sealed_artifact"]).read_text(encoding="utf-8")
        for ref in SENTINEL_REFS:
            assert ref not in raw, "a holdout reference leaked into ciphertext"
        # The holdout is a SECOND set, never the secret set.
        assert (holdout["sealed_set_id"]
                != manifest["secret"]["sealed_set_id"])
        # And the contest is registered against the SECRET set (R2).
        assert prep.contest_corpus_id(manifest) == "eval-qaa-qab-synth-secret-v1"
        ids = [sid for sid, _ in prep.sealed_registrations(manifest)]
        assert ids == ["eval-qaa-qab-synth-secret-v1",
                       "eval-qaa-qab-synth-holdout-v1"]


# ---------------------------------------------------------------------------
# Third-party diagnostic test suites (practice 14) — every refusal is a
# refusal WITH the reason; nothing is skipped silently.
# ---------------------------------------------------------------------------

def _registry(tmp_path, entries) -> Path:
    p = tmp_path / "registry.json"
    p.write_text(json.dumps({"registry_version": "test",
                             "datasets": entries}), encoding="utf-8")
    return p


def _suite_entry(**over) -> dict:
    entry = {
        "id": "eval-thirdparty-diag-v1",
        "language_pair": {"source": "qaa", "target": "qab"},
        "sha256": "a" * 64,
        "url": "https://example.test/diag-v1",
        "source": "Third Party Diagnostics",
        "license": "CC-BY-4.0",
    }
    entry.update(over)
    return entry


class TestResolveTestSuites:
    def test_happy_path_shape_matches_migration_074(self, tmp_path):
        from mt_eval_harness.contest_policy import TEST_SUITE_KEYS
        reg = _registry(tmp_path, [_suite_entry()])
        suites = prep.resolve_test_suites(
            ["eval-thirdparty-diag-v1"], language_pair="qaa>qab",
            registry_path=reg)
        assert len(suites) == 1
        assert set(suites[0]) == set(TEST_SUITE_KEYS)
        assert suites[0]["publisher"] == "Third Party Diagnostics"
        assert suites[0]["sha256"] == "a" * 64
        assert suites[0]["url"] == "https://example.test/diag-v1"

    def test_url_falls_back_to_the_upstream_export_url(self, tmp_path):
        reg = _registry(tmp_path, [_suite_entry(
            url=None, source_export={"url": "https://example.test/upstream"})])
        suites = prep.resolve_test_suites(
            ["eval-thirdparty-diag-v1"], language_pair="qaa>qab",
            registry_path=reg)
        assert suites[0]["url"] == "https://example.test/upstream"

    def test_none_declared_is_an_empty_list(self, tmp_path):
        assert prep.resolve_test_suites([], language_pair="qaa>qab") == []

    @pytest.mark.parametrize("over,needle", [
        ({"sha256": None}, "no pinned sha256"),
        ({"sha256": "nothex"}, "no pinned sha256"),
        ({"url": None}, "no url"),
        ({"source": None, "attribution": None}, "no publisher"),
        ({"quarantine": True}, "QUARANTINED"),
        ({"language_pair": {"source": "eng", "target": "fra"}},
         "another pair's suite"),
    ])
    def test_unusable_suites_are_refused_with_the_reason(self, tmp_path, over,
                                                         needle):
        reg = _registry(tmp_path, [_suite_entry(**over)])
        with pytest.raises(prep.ContestPrepError, match=needle):
            prep.resolve_test_suites(["eval-thirdparty-diag-v1"],
                                     language_pair="qaa>qab",
                                     registry_path=reg)

    def test_unknown_id_refused(self, tmp_path):
        reg = _registry(tmp_path, [_suite_entry()])
        with pytest.raises(prep.ContestPrepError, match="not in the corpus registry"):
            prep.resolve_test_suites(["eval-nope-v1"],
                                     language_pair="qaa>qab",
                                     registry_path=reg)

    def test_duplicate_refused(self, tmp_path):
        reg = _registry(tmp_path, [_suite_entry()])
        with pytest.raises(prep.ContestPrepError, match="declared twice"):
            prep.resolve_test_suites(
                ["eval-thirdparty-diag-v1", "eval-thirdparty-diag-v1"],
                language_pair="qaa>qab", registry_path=reg)

    def test_the_contests_own_corpus_can_never_be_a_suite(self, tmp_path):
        """A 'third-party diagnostic suite' that IS the sealed set would be
        the contest scoring itself twice and calling one independent."""
        reg = _registry(tmp_path, [_suite_entry(
            id="eval-qaa-qab-synth-secret-v1")])
        with pytest.raises(prep.ContestPrepError, match="own corpora"):
            prep.resolve_test_suites(
                ["eval-qaa-qab-synth-secret-v1"], language_pair="qaa>qab",
                exclude_ids=("eval-qaa-qab-synth-secret-v1",),
                registry_path=reg)

    def test_prepare_validates_suites_before_writing_anything(self, tmp_path):
        reg = _registry(tmp_path, [_suite_entry()])
        out = tmp_path / "contest"
        with pytest.raises(prep.ContestPrepError, match="not in the corpus registry"):
            prep.prepare_contest(**_prepare_kwargs(
                tmp_path, plaintext_refs=True, authorization_model="blanket",
                test_suites=["eval-nope-v1"], registry_path=reg))
        assert not out.exists(), "a bad suite id must cost the organizer nothing"

    def test_prepare_records_resolved_suites_in_the_manifest(self, tmp_path):
        reg = _registry(tmp_path, [_suite_entry()])
        manifest = prep.prepare_contest(**_prepare_kwargs(
            tmp_path, plaintext_refs=True, authorization_model="blanket",
            test_suites=["eval-thirdparty-diag-v1"], registry_path=reg))
        assert [s["suite_id"] for s in manifest["test_suites"]] == [
            "eval-thirdparty-diag-v1"]


# ---------------------------------------------------------------------------
# Registration of the new declarations: the holdout sealed row and the
# contests.metadata promises (074).
# ---------------------------------------------------------------------------

class TestRegisterDeclarations:
    def _manifest(self):
        m = TestRegisterPrepared._manifest(self)
        m["blind"] = None
        m["secret"] = {
            "sealed_set_id": "eval-qaa-qab-synth-secret-v1",
            "sealed_block": {"cipher": "x25519-hkdf-sha256+aes-256-gcm",
                             "ciphertextDigest": "e" * 64,
                             "keyScheme": "single-keypair-wave1"},
        }
        m["holdout"] = {
            "sealed_set_id": "eval-qaa-qab-synth-holdout-v1",
            "sealed_block": {"cipher": "x25519-hkdf-sha256+aes-256-gcm",
                             "ciphertextDigest": "f" * 64,
                             "keyScheme": "single-keypair-wave1"},
        }
        m["test_suites"] = [{
            "suite_id": "eval-thirdparty-diag-v1",
            "corpus_card_id": "eval-thirdparty-diag-v1",
            "publisher": "Third Party Diagnostics",
            "url": "https://example.test/diag-v1",
            "sha256": "a" * 64,
        }]
        return m

    def _calls(self, monkeypatch, existing_metadata=None):
        calls = []

        def fake_service_request(method, path, **kw):
            calls.append((method, path, kw.get("data"), kw.get("params")))
            if method == "GET" and path == "contests":
                return [{"metadata": existing_metadata
                         if existing_metadata is not None
                         else {"primary_metric": "chrf_plus_plus"}}]
            return []

        import mt_eval_harness.sovereign_service as svc
        import mt_eval_harness.contest as contest_mod
        monkeypatch.setattr(svc, "service_request", fake_service_request)
        monkeypatch.setattr(contest_mod, "create_contest",
                            lambda **kw: calls.append(("CREATE_CONTEST", kw))
                            or {"id": "synthetic-open-2026"})
        return calls

    def test_holdout_registered_as_its_own_sealed_set(self, monkeypatch):
        calls = self._calls(monkeypatch)
        prep.register_prepared(self._manifest(), open_intake=True)
        sealed = [c[2]["sealed_set_id"] for c in calls
                  if c[0] == "POST" and c[1] == "sealed_sets"]
        assert sealed == ["eval-qaa-qab-synth-secret-v1",
                          "eval-qaa-qab-synth-holdout-v1"]

    def test_contest_corpus_is_the_secret_set(self, monkeypatch):
        calls = self._calls(monkeypatch)
        prep.register_prepared(self._manifest(), open_intake=True)
        create = next(c[1] for c in calls if c[0] == "CREATE_CONTEST")
        assert create["corpus_id"] == "eval-qaa-qab-synth-secret-v1"

    def test_promises_are_merged_into_metadata_never_replacing_it(
            self, monkeypatch):
        calls = self._calls(
            monkeypatch, existing_metadata={"primary_metric": "bleu"})
        prep.register_prepared(self._manifest(), open_intake=True)
        meta_patch = next(c[2] for c in calls
                          if c[0] == "PATCH" and "metadata" in (c[2] or {}))
        meta = meta_patch["metadata"]
        # A JSONB PATCH REPLACES the column, so the merge has to be
        # client-side — primary_metric must survive.
        assert meta["primary_metric"] == "bleu"
        assert meta["sealed_holdout_set_id"] == "eval-qaa-qab-synth-holdout-v1"
        assert [s["suite_id"] for s in meta["test_suites"]] == [
            "eval-thirdparty-diag-v1"]

    def test_nothing_declared_means_no_metadata_read_or_write(self, monkeypatch):
        calls = self._calls(monkeypatch)
        prep.register_prepared(TestRegisterPrepared._manifest(self),
                               open_intake=True)
        assert not [c for c in calls if c[0] == "GET"]
        assert not [c for c in calls
                    if c[0] == "PATCH" and "metadata" in (c[2] or {})]

    def test_unreadable_contest_fails_loud_rather_than_dropping_a_promise(
            self, monkeypatch):
        calls = []

        def fake_service_request(method, path, **kw):
            calls.append((method, path))
            return []          # the contest row is not visible to us

        import mt_eval_harness.sovereign_service as svc
        import mt_eval_harness.contest as contest_mod
        monkeypatch.setattr(svc, "service_request", fake_service_request)
        monkeypatch.setattr(contest_mod, "create_contest",
                            lambda **kw: {"id": "synthetic-open-2026"})
        with pytest.raises(RuntimeError, match="read contest"):
            prep.register_prepared(self._manifest(), open_intake=True)

    def test_self_serve_writes_the_same_promises(self, monkeypatch):
        calls = []

        def fake_api_request(method, path, data=None, params=None,
                             session=None, prefer=None):
            calls.append((method, path, data, params, session, prefer))
            if method == "GET" and path == "contests":
                return [{"metadata": {"primary_metric": "chrf_plus_plus"}}]
            if method == "PATCH":
                return [{"id": "synthetic-open-2026"}]
            return []

        import mt_eval_harness.auth as auth_mod
        import mt_eval_harness.contest as contest_mod
        import mt_eval_harness.sovereign_service as svc
        monkeypatch.setattr(auth_mod, "get_session",
                            lambda: {"access_token": "tok",
                                     "user": {"email": "org@example.org"}})
        monkeypatch.setattr(contest_mod, "_api_request", fake_api_request)
        monkeypatch.setattr(contest_mod, "create_contest",
                            lambda **kw: {"id": "synthetic-open-2026"})
        monkeypatch.setattr(svc, "service_request", lambda *a, **kw: (_ for _ in ()).throw(
            AssertionError("self-serve must never use the service key")))
        monkeypatch.setattr(svc, "assert_not_prod", lambda: None)

        prep.register_prepared_self_serve(self._manifest(), open_intake=True)

        meta_patch = next(c[2] for c in calls
                          if c[0] == "PATCH" and "metadata" in (c[2] or {}))
        assert (meta_patch["metadata"]["sealed_holdout_set_id"]
                == "eval-qaa-qab-synth-holdout-v1")
        # …through the organizer's OWN session, never anonymously.
        session_used = next(c[4] for c in calls
                            if c[0] == "PATCH" and "metadata" in (c[2] or {}))
        assert session_used is not None


# ---------------------------------------------------------------------------
# The two publication PROMISES pass straight through to create_contest
# (M3-wire, 2026-09-07). Migration 074 freezes both the moment a contest has
# an entry, so declaring them at registration is the only way a PREPARED
# contest gets them at all.
# ---------------------------------------------------------------------------

class TestPublicationPromisePassThrough:
    _manifest = TestRegisterPrepared._manifest

    def _capture(self, monkeypatch):
        seen = {}

        def fake_service_request(method, path, **kw):
            return []

        def fake_create_contest(**kwargs):
            seen.update(kwargs)
            return {"id": "synthetic-open-2026"}

        import mt_eval_harness.contest as contest_mod
        import mt_eval_harness.sovereign_service as svc
        monkeypatch.setattr(svc, "service_request", fake_service_request)
        monkeypatch.setattr(contest_mod, "create_contest", fake_create_contest)
        return seen

    def test_defaults_match_create_contest(self, monkeypatch):
        seen = self._capture(monkeypatch)
        prep.register_prepared(self._manifest())
        assert seen["results_visibility"] == "hidden_until_close"
        assert seen["anonymize_until_close"] is False

    def test_service_lane_passes_both_through(self, monkeypatch):
        seen = self._capture(monkeypatch)
        prep.register_prepared(self._manifest(),
                               results_visibility="hidden_until_close",
                               anonymize_until_close=True)
        assert seen["results_visibility"] == "hidden_until_close"
        assert seen["anonymize_until_close"] is True

    def test_self_serve_lane_passes_both_through(self, monkeypatch):
        calls = []
        TestRegisterPreparedSelfServe()._patch(monkeypatch, calls)
        prep.register_prepared_self_serve(
            self._manifest(), results_visibility="hidden_until_close",
            anonymize_until_close=True)
        kwargs = next(c[1] for c in calls if c[0] == "CREATE_CONTEST")
        assert kwargs["results_visibility"] == "hidden_until_close"
        assert kwargs["anonymize_until_close"] is True

    def test_the_defaults_are_the_same_object_create_contest_declares(self):
        """A pass-through that quietly changed a default would be a promise
        the organizer never made."""
        import inspect
        from mt_eval_harness.contest import create_contest
        target = inspect.signature(create_contest).parameters
        for fn in (prep.register_prepared, prep.register_prepared_self_serve):
            params = inspect.signature(fn).parameters
            for key in ("results_visibility", "anonymize_until_close"):
                assert params[key].default == target[key].default, (fn, key)


def test_cli_prepare_without_license_fails_loud_and_writes_nothing(tmp_path, capsys):
    """`mt-eval contest prepare` with no --license exits 1 with what/why/fix."""
    import sys
    from unittest.mock import patch

    from mt_eval_harness.cli import main

    out = tmp_path / "o"
    argv = ["mt-eval", "contest", "prepare", "--corpus", str(MASTER),
            "--slug", "s", "--name", "N", "--pair", "qaa>qab",
            "--dev-size", "3", "--seed", "7", "--qualifier-threshold", "35",
            "--plaintext-refs", "--authorization-model", "blanket",
            "--no-register", "--out", str(out)]
    with patch.object(sys, "argv", argv), pytest.raises(SystemExit) as ei:
        main()
    assert ei.value.code == 1
    err = capsys.readouterr().err
    assert "--license is required" in err and "--license CC-BY-4.0" in err
    assert not out.exists()
