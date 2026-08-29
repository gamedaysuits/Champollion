"""method_bundle — the T2 participant side, fully offline.

Covers spec §2 (bundle format + deterministic method_sha), §3.5 (manifest
consistency — the SSOT both sides run), the plan-B1 gates (explicit --agree,
T1 published standing, node-id binding), the pre-flight static refusal, and
both transports (bucket upload + --bundle-out sneakernet + --offline).
Synthetic identities only; every network surface is a fake.
"""

from __future__ import annotations

import hashlib
import io
import json
import tarfile
from pathlib import Path

import pytest

import mt_eval_harness.method_bundle as mb
from mt_eval_harness.contest_intake import IntakeError
from mt_eval_harness.method_bundle import (
    CURRENT_AGREEMENT_VERSION,
    MethodBundleError,
    build_manifest,
    build_method_bundle,
    manifest_consistency_findings,
    resolve_secret_set,
)
from mt_eval_harness.queue_runner import compute_request_fingerprint

CONTEST_ID = "synth-open-2026"
BLIND_SET = "eval-qaa-qab-synth-blindtest-v1"
SECRET_SET = "eval-qaa-qab-synth-secret-v1"
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"
PARTICIPANT = "participant@example.test"
NODE_ID = "org-node-1"

CLEAN_METHOD = """#!/usr/bin/env python3
import sys

for line in sys.stdin:
    words = line.split()
    if len(words) >= 2:
        print(f"{words[1]} {words[0]}vo")
    else:
        print(line.strip())
"""

CLEAN_DOCKERFILE = "FROM python:3.11-slim\nCOPY method /method\n"


@pytest.fixture
def method_dir(tmp_path):
    d = tmp_path / "method-src"
    d.mkdir()
    (d / "translate.py").write_text(CLEAN_METHOD, encoding="utf-8")
    (d / "config.json").write_text('{"beam": 1}\n', encoding="utf-8")
    return d


@pytest.fixture
def dockerfile(tmp_path):
    p = tmp_path / "Dockerfile"
    p.write_text(CLEAN_DOCKERFILE, encoding="utf-8")
    return p


def _manifest(**overrides):
    kwargs = dict(
        method_name="acme-nmt-v3", method_version="3.0.0",
        entrypoint="method/translate.py", method_class="pipeline",
        paradigm="neural-nmt", developer_name="Test Dev",
        developer_email=PARTICIPANT, agreement_signed=True,
        corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
    )
    kwargs.update(overrides)
    return build_manifest(**kwargs)


# ---------------------------------------------------------------------------
# §3.5 manifest consistency — the SSOT check.
# ---------------------------------------------------------------------------

class TestManifestConsistency:
    def test_valid_manifest_passes(self):
        assert manifest_consistency_findings(_manifest()) == []

    def test_agreement_must_be_explicit(self):
        with pytest.raises(MethodBundleError, match="agreementSigned"):
            _manifest(agreement_signed=False)

    @pytest.mark.parametrize("mutate,needle", [
        (lambda m: m.update(networkRequired=True), "networkRequired"),
        (lambda m: m.update(thirdPartyAPIs=["openai"]), "thirdPartyAPIs"),
        (lambda m: m.update(selfHostable=False), "selfHostable"),
        (lambda m: m["developer"].update(agreementVersion="0.0.1"),
         "agreementVersion"),
        (lambda m: m["method"].update(entrypoint="/abs/path.py"),
         "relative"),
        (lambda m: m["method"].update(entrypoint="outside/translate.py"),
         "method/"),
        (lambda m: m["method"].update(**{"class": "magic-beans"}),
         "vocabulary"),
        (lambda m: m["target"].update(corpusId=""), "corpusId"),
        (lambda m: m["requirements"].update(maxRuntimeMinutes=0),
         "maxRuntimeMinutes"),
    ])
    def test_tampered_manifest_blocks(self, mutate, needle):
        m = _manifest()
        mutate(m)
        findings = manifest_consistency_findings(m)
        assert findings, f"tamper {needle} produced no finding"
        assert any(needle in f["detail"] for f in findings)
        assert all(f["severity"] == "BLOCK" for f in findings)

    def test_corpus_id_cross_check(self):
        findings = manifest_consistency_findings(
            _manifest(), expected_corpus_id="some-other-set")
        assert any("does not match" in f["detail"] for f in findings)

    def test_entrypoint_must_exist_when_bundle_dir_given(self, tmp_path):
        bundle = tmp_path / "bundle"
        (bundle / "method").mkdir(parents=True)
        findings = manifest_consistency_findings(_manifest(),
                                                 bundle_dir=bundle)
        assert any("does not exist" in f["detail"] for f in findings)

    def test_current_agreement_version_is_accepted(self):
        m = _manifest()
        assert m["developer"]["agreementVersion"] == CURRENT_AGREEMENT_VERSION


# ---------------------------------------------------------------------------
# §2 packing — deterministic method_sha.
# ---------------------------------------------------------------------------

class TestBundlePacking:
    def test_deterministic_sha_and_layout(self, method_dir, dockerfile,
                                          tmp_path):
        m = _manifest()
        a = build_method_bundle(method_dir=method_dir, dockerfile=dockerfile,
                                manifest=m, out_path=tmp_path / "a.tar.gz")
        b = build_method_bundle(method_dir=method_dir, dockerfile=dockerfile,
                                manifest=m, out_path=tmp_path / "b.tar.gz")
        assert a["method_sha"] == b["method_sha"], \
            "same inputs must produce the same method_sha"
        data = Path(a["path"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == a["method_sha"]
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
            names = sorted(tar.getnames())
        assert names == ["Dockerfile", "manifest.json", "method/config.json",
                         "method/translate.py"]

    def test_content_change_changes_sha(self, method_dir, dockerfile,
                                        tmp_path):
        m = _manifest()
        a = build_method_bundle(method_dir=method_dir, dockerfile=dockerfile,
                                manifest=m, out_path=tmp_path / "a.tar.gz")
        (method_dir / "translate.py").write_text(
            CLEAN_METHOD + "# tweak\n", encoding="utf-8")
        b = build_method_bundle(method_dir=method_dir, dockerfile=dockerfile,
                                manifest=m, out_path=tmp_path / "b.tar.gz")
        assert a["method_sha"] != b["method_sha"]

    def test_missing_entrypoint_refused(self, method_dir, dockerfile,
                                        tmp_path):
        m = _manifest()
        m["method"]["entrypoint"] = "method/missing.py"
        with pytest.raises(MethodBundleError, match="missing.py"):
            build_method_bundle(method_dir=method_dir, dockerfile=dockerfile,
                                manifest=m, out_path=tmp_path / "x.tar.gz")

    def test_symlink_refused(self, method_dir, dockerfile, tmp_path):
        (method_dir / "link.py").symlink_to(method_dir / "translate.py")
        with pytest.raises(MethodBundleError, match="[Ss]ymlink"):
            build_method_bundle(method_dir=method_dir, dockerfile=dockerfile,
                                manifest=_manifest(),
                                out_path=tmp_path / "x.tar.gz")

    def test_missing_dockerfile_refused(self, method_dir, tmp_path):
        with pytest.raises(MethodBundleError, match="[Dd]ockerfile"):
            build_method_bundle(method_dir=method_dir,
                                dockerfile=tmp_path / "nope",
                                manifest=_manifest(),
                                out_path=tmp_path / "x.tar.gz")


# ---------------------------------------------------------------------------
# The submit flow — fakes for every network surface.
# ---------------------------------------------------------------------------

@pytest.fixture
def wired(monkeypatch, tmp_path):
    """Fake session, contest lookup, sealed-set rows, T1 standing, storage,
    and the request POST — everything else real."""
    state = {
        "storage": {},
        "requests": [],
        "t1_rows": [{"intake_id": "intake-t1", "submitted_by": PARTICIPANT,
                     "run_card_id": "card-t1", "status": "published"}],
        "sealed_sets": [
            {"sealed_set_id": BLIND_SET, "status": "active",
             "current_qualifier_id": QUALIFIER_ID},
            {"sealed_set_id": SECRET_SET, "status": "active",
             "current_qualifier_id": QUALIFIER_ID},
        ],
    }
    contest = {"id": CONTEST_ID, "name": "Synthetic Open", "status": "open",
               "corpus_id": BLIND_SET, "language_pair": "qaa>qab",
               "authorization_model": "per-submission", "intake_open": True}
    qualifier = {"qualifier_id": QUALIFIER_ID,
                 "corpus_card_id": "eval-qaa-qab-synth-dev-v1",
                 "threshold": 50.0, "metric": "composite", "year": 2026}

    def fake_api(method, path, data=None, params=None, session=None):
        if method == "GET" and path == "sealed_sets":
            return [r for r in state["sealed_sets"]]
        if method == "GET" and path == "contest_intake":
            return list(state["t1_rows"])
        if method == "POST" and path == "authorization_requests":
            state["requests"].append(dict(data))
            return [dict(data)]
        raise AssertionError(f"unexpected API call {method} {path}")

    monkeypatch.setattr(mb, "_api_request", fake_api)
    monkeypatch.setattr(mb, "fetch_contest_bundle",
                        lambda cid: {"contest": contest,
                                     "qualifier": qualifier})
    monkeypatch.setattr(mb, "get_session",
                        lambda: {"user": {"email": PARTICIPANT},
                                 "access_token": "tok"})
    monkeypatch.setattr(
        mb, "_storage_upload",
        lambda session, object_path, data: state["storage"].__setitem__(
            object_path, data))
    return state


def _submit(method_dir, dockerfile, tmp_path, **overrides):
    kwargs = dict(
        contest_id=CONTEST_ID, method_dir=method_dir, dockerfile=dockerfile,
        method_name="acme-nmt-v3", method_version="3.0.0",
        entrypoint="method/translate.py", method_class="pipeline",
        paradigm="neural-nmt", developer_name="Test Dev",
        agree=True, node_id=NODE_ID,
        scratch_dir=tmp_path / "scratch",
    )
    kwargs.update(overrides)
    return mb.submit_method(**kwargs)


class TestSubmitMethod:
    def test_full_flow_creates_bound_request(self, wired, method_dir,
                                             dockerfile, tmp_path):
        out = _submit(method_dir, dockerfile, tmp_path)
        assert len(wired["requests"]) == 1
        row = wired["requests"][0]
        assert row["state"] == "pending"
        assert row["requested_by"] == PARTICIPANT
        assert row["sealed_set_id"] == SECRET_SET
        assert row["corpus_id"] == SECRET_SET
        assert row["node_measurement"] == NODE_ID
        # The fingerprint is truly method-bound and recomputable.
        assert row["fingerprint"] == compute_request_fingerprint(
            {"method_sha": row["method_sha"], "corpus_id": SECRET_SET,
             "corpus_version": "v1"}, node_measurement=NODE_ID)
        # The uploaded bytes ARE the method the fingerprint froze.
        path = f"{CONTEST_ID}/{PARTICIPANT}/{row['request_id']}.tar.gz"
        assert path in wired["storage"]
        assert hashlib.sha256(
            wired["storage"][path]).hexdigest() == row["method_sha"]
        assert out["request_id"] == row["request_id"]

    def test_refused_without_t1_standing(self, wired, method_dir, dockerfile,
                                         tmp_path):
        wired["t1_rows"].clear()
        with pytest.raises(IntakeError, match="T1"):
            _submit(method_dir, dockerfile, tmp_path)
        assert not wired["requests"] and not wired["storage"]

    def test_refused_without_agree(self, wired, method_dir, dockerfile,
                                   tmp_path):
        with pytest.raises(MethodBundleError, match="--agree"):
            _submit(method_dir, dockerfile, tmp_path, agree=False)

    def test_refused_without_node_id(self, wired, method_dir, dockerfile,
                                     tmp_path):
        with pytest.raises(MethodBundleError, match="--node-id"):
            _submit(method_dir, dockerfile, tmp_path, node_id="")

    def test_network_call_in_method_blocks_upload(self, wired, method_dir,
                                                  dockerfile, tmp_path):
        (method_dir / "helper.py").write_text(
            "import requests\n", encoding="utf-8")
        with pytest.raises(MethodBundleError, match="BLOCK"):
            _submit(method_dir, dockerfile, tmp_path)
        assert not wired["requests"] and not wired["storage"]

    def test_bundle_out_writes_sneakernet_exchange(self, wired, method_dir,
                                                   dockerfile, tmp_path):
        out = _submit(method_dir, dockerfile, tmp_path,
                      bundle_out=tmp_path / "exchange")
        dest = Path(out["bundle_dir"])
        assert (dest / "method.tar.gz").is_file()
        meta = json.loads((dest / "request.json").read_text(encoding="utf-8"))
        assert meta["request"]["method_sha"] == out["method_sha"]
        assert meta["contest_id"] == CONTEST_ID
        assert hashlib.sha256(
            (dest / "method.tar.gz").read_bytes()).hexdigest() \
            == out["method_sha"]

    def test_offline_needs_no_network_and_touches_none(self, monkeypatch,
                                                       method_dir, dockerfile,
                                                       tmp_path):
        def explode(*a, **kw):
            raise AssertionError("offline mode must not touch the network")
        monkeypatch.setattr(mb, "_api_request", explode)
        monkeypatch.setattr(mb, "get_session", explode)
        monkeypatch.setattr(mb, "_storage_upload", explode)
        out = mb.submit_method(
            contest_id=CONTEST_ID, method_dir=method_dir,
            dockerfile=dockerfile, method_name="acme-nmt-v3",
            method_version="3.0.0", entrypoint="method/translate.py",
            method_class="pipeline", developer_name="Test Dev",
            developer_email=PARTICIPANT, agree=True, node_id=NODE_ID,
            secret_set_id=SECRET_SET, language_pair="qaa>qab",
            bundle_out=tmp_path / "exchange", offline=True,
            scratch_dir=tmp_path / "scratch")
        assert (Path(out["bundle_dir"]) / "request.json").is_file()

    def test_offline_requires_bundle_out_and_secret_set(self, method_dir,
                                                        dockerfile, tmp_path):
        with pytest.raises(MethodBundleError, match="--bundle-out"):
            _submit(method_dir, dockerfile, tmp_path, offline=True)
        with pytest.raises(MethodBundleError, match="--secret-set"):
            _submit(method_dir, dockerfile, tmp_path, offline=True,
                    bundle_out=tmp_path / "x")


# ---------------------------------------------------------------------------
# Secret-set resolution.
# ---------------------------------------------------------------------------

class TestResolveSecretSet:
    CONTEST = {"id": CONTEST_ID, "corpus_id": BLIND_SET}
    QUAL = {"qualifier_id": QUALIFIER_ID}

    def _wire(self, monkeypatch, rows):
        monkeypatch.setattr(
            mb, "_api_request",
            lambda method, path, data=None, params=None, session=None: rows)

    def test_single_sibling_resolves(self, monkeypatch):
        self._wire(monkeypatch, [
            {"sealed_set_id": BLIND_SET, "status": "active"},
            {"sealed_set_id": SECRET_SET, "status": "active"},
        ])
        assert resolve_secret_set(self.CONTEST, self.QUAL)[
            "sealed_set_id"] == SECRET_SET

    def test_no_secret_set_fails_loud(self, monkeypatch):
        self._wire(monkeypatch, [
            {"sealed_set_id": BLIND_SET, "status": "active"}])
        with pytest.raises(MethodBundleError, match="no T2"):
            resolve_secret_set(self.CONTEST, self.QUAL)

    def test_ambiguity_requires_flag(self, monkeypatch):
        self._wire(monkeypatch, [
            {"sealed_set_id": SECRET_SET, "status": "active"},
            {"sealed_set_id": "eval-qaa-qab-other-secret-v1",
             "status": "active"},
        ])
        with pytest.raises(MethodBundleError, match="--secret-set"):
            resolve_secret_set(self.CONTEST, self.QUAL)
        assert resolve_secret_set(
            self.CONTEST, self.QUAL, SECRET_SET)["sealed_set_id"] == SECRET_SET
