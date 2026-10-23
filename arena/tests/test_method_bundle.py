"""method_bundle — the Lane B participant side, fully offline.

Covers spec §2 (bundle format + deterministic method_sha), §3.5 (manifest
consistency — the SSOT both sides run), the entry declarations (contract C2:
track / parameter count / weights licence / weights visibility / training data,
primary vs contrastive, system description, release URL), the admission gates
(explicit --agree, a PASSING qualifier receipt, node-id binding), the
pre-flight static refusal, and both transports (bucket upload + --bundle-out
sneakernet + --offline).

Synthetic identities only; every network surface is a fake, and the qualifier
module is stubbed so this file never depends on another lane's landing order.
"""

from __future__ import annotations

import hashlib
import io
import json
import sys
import tarfile
import types
from pathlib import Path

import pytest

import mt_eval_harness
import mt_eval_harness.contest_prize_terms as cpt
import mt_eval_harness.method_bundle as mb
from mt_eval_harness.contest_prize_terms import PrizeTermsError
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

# The C1 receipt shape submit_method embeds as manifest["qualifier"].
PASSING_RECEIPT = {
    "receiptVersion": "1",
    "contestId": CONTEST_ID,
    "qualifierId": QUALIFIER_ID,
    "devCorpusSha256": "a" * 64,
    "hypothesesSha256": "b" * 64,
    "metric": "composite",
    "score": 61.5,
    "threshold": 50.0,
    "passed": True,
    "harnessVersion": "0.1.0",
    "scoredAt": "2026-09-06T12:00:00+00:00",
    "selfReported": True,
    "note": "self-scored on the public dev set",
}

# The declarations every entry must make (contract C2).
DECLARATIONS = dict(
    track="constrained",
    parameter_count=615_000_000,
    weights_license="Apache-2.0",
    weights_public=True,
    training_data="FLORES-200 dev + our own 12k parallel corpus",
)


class StubQualifierError(RuntimeError):
    """Stands in for contest_qualify.QualifierError (lane L0's module)."""


def install_qualifier_stub(monkeypatch, *, receipt=None, load_error=None):
    """Put a contest_qualify stub in front of both import paths.

    ``from mt_eval_harness import contest_qualify`` resolves via the package
    attribute when the real module is already imported, so both the attribute
    and sys.modules are replaced.
    """
    module = types.ModuleType("mt_eval_harness.contest_qualify")
    module.QualifierError = StubQualifierError

    def load_receipt(contest_id, receipt_dir=None, *, system=None,
                     name_hint=None):
        module.load_calls.append((contest_id, receipt_dir))
        module.system_calls.append((system, name_hint))
        if load_error is not None:
            raise load_error
        return dict(receipt if receipt is not None else PASSING_RECEIPT)

    def require_pass(r, *, contest_id, qualifier_id, threshold):
        module.pass_calls.append((contest_id, qualifier_id, threshold))
        if r.get("passed") is not True:
            raise StubQualifierError(
                f"qualifier receipt for {contest_id} did not pass "
                f"({r.get('score')} < {r.get('threshold')})")
        if r.get("qualifierId") != qualifier_id:
            raise StubQualifierError(
                f"receipt is for qualifier {r.get('qualifierId')!r}, not "
                f"{qualifier_id!r}")
        if float(r.get("threshold", 0)) != float(threshold):
            raise StubQualifierError(
                f"receipt threshold {r.get('threshold')} != {threshold}")
        return r

    module.load_receipt = load_receipt
    module.require_pass = require_pass
    module.load_calls = []
    module.system_calls = []
    module.pass_calls = []
    monkeypatch.setitem(sys.modules, "mt_eval_harness.contest_qualify", module)
    monkeypatch.setattr(mt_eval_harness, "contest_qualify", module,
                        raising=False)
    return module


@pytest.fixture
def qualifier_stub(monkeypatch):
    return install_qualifier_stub(monkeypatch)


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


def _constraints(**overrides):
    block = dict(track="constrained", parameterCount=615_000_000,
                 weightsLicense="Apache-2.0", weightsPublic=True,
                 trainingData="FLORES-200 dev")
    block.update(overrides)
    return block


def _submission(**overrides):
    block = dict(isPrimary=True, description="A pipeline system.",
                 methodReleaseUrl=None)
    block.update(overrides)
    return block


def _qualifier_block():
    from mt_eval_harness.contest_declarations import (
        qualifier_block_from_receipt,
    )
    return qualifier_block_from_receipt(PASSING_RECEIPT)


def _manifest(**overrides):
    kwargs = dict(
        method_name="acme-nmt-v3", method_version="3.0.0",
        entrypoint="method/translate.py", method_class="pipeline",
        paradigm="neural-nmt", developer_name="Test Dev",
        developer_email=PARTICIPANT, agreement_signed=True,
        corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
        constraints=_constraints(), submission=_submission(),
        qualifier=_qualifier_block(),
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
# The three declaration blocks the manifest now carries (contract C2).
# ---------------------------------------------------------------------------

class TestManifestDeclarations:
    def test_manifest_carries_all_three_blocks(self):
        m = _manifest()
        assert m["constraints"] == _constraints()
        assert m["submission"] == _submission()
        assert m["qualifier"]["qualifierId"] == QUALIFIER_ID
        assert m["qualifier"]["passed"] is True

    def test_qualifier_block_carries_no_private_receipt_fields(self):
        assert "note" not in _manifest()["qualifier"]

    def test_blocks_are_copies_not_aliases(self):
        block = _constraints()
        m = build_manifest(
            method_name="acme", method_version="1", method_class="pipeline",
            entrypoint="method/translate.py", developer_name="Test Dev",
            developer_email=PARTICIPANT, agreement_signed=True,
            corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
            constraints=block, submission=_submission(),
            qualifier=_qualifier_block())
        m["constraints"]["track"] = "unconstrained"
        assert block["track"] == "constrained"

    @pytest.mark.parametrize("bad,needle", [
        ({"track": "anything"}, "constraints.track"),
        ({"parameterCount": -1}, "parameterCount"),
        ({"weightsLicense": ""}, "weightsLicense"),
        ({"weightsPublic": "yes"}, "weightsPublic"),
        ({"trainingData": ""}, "trainingData"),
    ])
    def test_bad_constraints_refuse_the_manifest(self, bad, needle):
        with pytest.raises(MethodBundleError, match=needle):
            _manifest(constraints=_constraints(**bad))

    def test_bad_submission_refuses_the_manifest(self):
        with pytest.raises(MethodBundleError, match="methodReleaseUrl"):
            _manifest(submission=_submission(
                methodReleaseUrl="http://example.test/x"))

    def test_missing_declarations_are_not_optional(self):
        with pytest.raises(TypeError, match="constraints"):
            build_manifest(
                method_name="acme", method_version="1",
                entrypoint="method/translate.py", method_class="pipeline",
                developer_name="Test Dev", developer_email=PARTICIPANT,
                agreement_signed=True, corpus_id=SECRET_SET,
                source_lang="qaa", target_lang="qab")

    def test_packing_refuses_a_manifest_with_stripped_declarations(
            self, method_dir, dockerfile, tmp_path):
        m = _manifest()
        del m["constraints"]
        with pytest.raises(MethodBundleError, match="constraints is missing"):
            build_method_bundle(method_dir=method_dir, dockerfile=dockerfile,
                                manifest=m, out_path=tmp_path / "x.tar.gz")


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

    def test_declarations_are_inside_the_hashed_manifest(self, method_dir,
                                                         dockerfile, tmp_path):
        """A declaration a participant could change after packing would not be
        a declaration. It rides inside manifest.json, so method_sha covers it."""
        a = build_method_bundle(
            method_dir=method_dir, dockerfile=dockerfile,
            manifest=_manifest(), out_path=tmp_path / "a.tar.gz")
        b = build_method_bundle(
            method_dir=method_dir, dockerfile=dockerfile,
            manifest=_manifest(constraints=_constraints(
                track="unconstrained", trainingData="")),
            out_path=tmp_path / "b.tar.gz")
        assert a["method_sha"] != b["method_sha"]
        with tarfile.open(b["path"], "r:gz") as tar:
            packed = json.loads(
                tar.extractfile("manifest.json").read().decode("utf-8"))
        assert packed["constraints"]["track"] == "unconstrained"
        assert packed["submission"]["isPrimary"] is True

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
    """Fake session, contest lookup, sealed-set rows, contest metadata,
    storage, and the request POST — everything else real."""
    state = {
        "storage": {},
        "requests": [],
        "contest_metadata": {},
        "sealed_sets": [
            {"sealed_set_id": BLIND_SET, "status": "active",
             "current_qualifier_id": QUALIFIER_ID},
            {"sealed_set_id": SECRET_SET, "status": "active",
             "current_qualifier_id": QUALIFIER_ID},
        ],
    }
    # R2 (2026-09-06): a contest is registered against its SECRET set — that
    # is what the node executes entries on. The blind split is still
    # registered here (an organizer diagnostic prepared before R2), so the
    # world also proves the contest's own set wins over a sibling.
    contest = {"id": CONTEST_ID, "name": "Synthetic Open", "status": "open",
               "corpus_id": SECRET_SET, "language_pair": "qaa>qab",
               "authorization_model": "per-submission", "intake_open": True}
    qualifier = {"qualifier_id": QUALIFIER_ID,
                 "corpus_card_id": "eval-qaa-qab-synth-dev-v1",
                 "threshold": 50.0, "metric": "composite", "year": 2026}

    def fake_api(method, path, data=None, params=None, session=None):
        if method == "GET" and path == "sealed_sets":
            return [r for r in state["sealed_sets"]]
        if method == "GET" and path == "contests":
            return [{"metadata": state["contest_metadata"]}]
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
        **DECLARATIONS,
    )
    kwargs.update(overrides)
    return mb.submit_method(**kwargs)


class TestSubmitMethod:
    def test_full_flow_creates_bound_request(self, qualifier_stub, wired,
                                             method_dir, dockerfile, tmp_path):
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

    def test_declarations_ride_the_manifest(self, qualifier_stub, wired,
                                            method_dir, dockerfile, tmp_path):
        out = _submit(method_dir, dockerfile, tmp_path,
                      is_primary=False,
                      submission_description="Contrastive: greedy decoding.",
                      method_release_url="https://example.test/acme")
        m = out["manifest"]
        assert m["constraints"] == {
            "track": "constrained", "parameterCount": 615_000_000,
            "weightsLicense": "Apache-2.0", "weightsPublic": True,
            "trainingData": DECLARATIONS["training_data"]}
        assert m["submission"] == {
            "isPrimary": False,
            "description": "Contrastive: greedy decoding.",
            "methodReleaseUrl": "https://example.test/acme"}
        assert m["qualifier"]["qualifierId"] == QUALIFIER_ID

    def test_submission_row_fields_come_out_of_the_manifest(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        from mt_eval_harness.contest_declarations import (
            submission_fields_from_manifest,
        )
        out = _submit(method_dir, dockerfile, tmp_path)
        row = submission_fields_from_manifest(out["manifest"])
        assert row["track"] == "constrained"
        assert row["submitter_label"] == "Test Dev"
        assert "@" not in row["submitter_label"]

    def test_gate_uses_the_contest_qualifier_and_threshold(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        _submit(method_dir, dockerfile, tmp_path)
        assert qualifier_stub.pass_calls == [
            (CONTEST_ID, QUALIFIER_ID, 50.0)]
        assert qualifier_stub.load_calls == [(CONTEST_ID, None)]

    def test_receipt_dir_is_passed_through(self, qualifier_stub, wired,
                                           method_dir, dockerfile, tmp_path):
        _submit(method_dir, dockerfile, tmp_path,
                receipt_dir=tmp_path / "receipts")
        assert qualifier_stub.load_calls == [
            (CONTEST_ID, tmp_path / "receipts")]

    def test_the_receipt_is_this_systems(self, qualifier_stub, wired,
                                         method_dir, dockerfile, tmp_path):
        """Receipts are kept per system (Round 5): the submission names its
        receipt with --system, and its --name is the default."""
        _submit(method_dir, dockerfile, tmp_path)
        _submit(method_dir, dockerfile, tmp_path, system="acme-nmt-v2")
        assert [c[0] for c in qualifier_stub.system_calls] == [None,
                                                               "acme-nmt-v2"]
        assert all(c[1] for c in qualifier_stub.system_calls)   # --name hint

    def test_refused_when_no_receipt_exists(self, monkeypatch, wired,
                                            method_dir, dockerfile, tmp_path):
        install_qualifier_stub(
            monkeypatch,
            load_error=StubQualifierError("no qualifier receipt found"))
        with pytest.raises(StubQualifierError, match="no qualifier receipt"):
            _submit(method_dir, dockerfile, tmp_path)
        assert not wired["requests"] and not wired["storage"]

    def test_refused_when_the_receipt_did_not_pass(self, monkeypatch, wired,
                                                   method_dir, dockerfile,
                                                   tmp_path):
        failing = dict(PASSING_RECEIPT, passed=False, score=12.0)
        install_qualifier_stub(monkeypatch, receipt=failing)
        with pytest.raises(StubQualifierError, match="did not pass"):
            _submit(method_dir, dockerfile, tmp_path)
        assert not wired["requests"] and not wired["storage"]

    def test_refused_when_the_receipt_is_for_another_qualifier(
            self, monkeypatch, wired, method_dir, dockerfile, tmp_path):
        stale = dict(PASSING_RECEIPT, qualifierId="some-other-qualifier")
        install_qualifier_stub(monkeypatch, receipt=stale)
        with pytest.raises(StubQualifierError, match="some-other-qualifier"):
            _submit(method_dir, dockerfile, tmp_path)
        assert not wired["requests"] and not wired["storage"]

    def test_refused_when_the_receipt_threshold_disagrees(
            self, monkeypatch, wired, method_dir, dockerfile, tmp_path):
        loose = dict(PASSING_RECEIPT, threshold=1.0)
        install_qualifier_stub(monkeypatch, receipt=loose)
        with pytest.raises(StubQualifierError, match="threshold"):
            _submit(method_dir, dockerfile, tmp_path)
        assert not wired["requests"]

    def test_description_required_when_the_contest_says_so(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        wired["contest_metadata"] = {"require_description": True}
        with pytest.raises(MethodBundleError, match="require_description"):
            _submit(method_dir, dockerfile, tmp_path)
        assert not wired["requests"] and not wired["storage"]
        _submit(method_dir, dockerfile, tmp_path,
                submission_description="We fine-tuned NLLB-200 on 12k pairs.")
        assert len(wired["requests"]) == 1

    # -- prize terms are a per-contest dial (R1-amended, 2026-09-07) --------

    def test_no_terms_means_nothing_is_accepted(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        out = _submit(method_dir, dockerfile, tmp_path)
        assert "acceptedPrizeTermsSha256" not in out["manifest"]["submission"]

    def test_declared_terms_must_be_accepted_explicitly(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        terms = {"disposition": "pass_to_holders"}
        wired["contest_metadata"] = {"prize_terms": terms}
        with pytest.raises(MethodBundleError) as ei:
            _submit(method_dir, dockerfile, tmp_path)
        message = str(ei.value)
        # The refusal PRINTS the terms, so nobody has to guess what they are.
        assert "--accept-terms" in message
        assert cpt.terms_sha256(terms) in message
        assert cpt.DISPOSITION_HEADLINES["pass_to_holders"] in message
        assert "ownership of the method is assigned to the host" in message
        assert not wired["requests"] and not wired["storage"]

    def test_the_accepted_hash_rides_the_manifest(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        terms = {"disposition": "release_open"}
        digest = cpt.terms_sha256(terms)
        wired["contest_metadata"] = {"prize_terms": terms}
        out = _submit(method_dir, dockerfile, tmp_path, accept_terms=digest)
        assert out["manifest"]["submission"][
            "acceptedPrizeTermsSha256"] == digest
        # It is inside the tarball, so method_sha covers it.
        assert len(wired["requests"]) == 1

    def test_a_wrong_hash_is_refused_and_re_prints_the_terms(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        terms = {"disposition": "release_open"}
        wired["contest_metadata"] = {"prize_terms": terms}
        with pytest.raises(MethodBundleError) as ei:
            _submit(method_dir, dockerfile, tmp_path, accept_terms="ab" * 32)
        assert cpt.terms_sha256(terms) in str(ei.value)
        assert cpt.DISPOSITION_HEADLINES["release_open"] in str(ei.value)
        assert not wired["requests"]

    def test_accepting_terms_a_contest_never_declared_is_refused(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        with pytest.raises(MethodBundleError, match="declares NO prize terms"):
            _submit(method_dir, dockerfile, tmp_path, accept_terms="ab" * 32)

    def test_unreadable_contest_terms_stop_the_submission(
            self, qualifier_stub, wired, method_dir, dockerfile, tmp_path):
        wired["contest_metadata"] = {
            "prize_terms": {"release_required_before_scores": True}}
        with pytest.raises(PrizeTermsError, match="RETIRED"):
            _submit(method_dir, dockerfile, tmp_path)

    def test_offline_takes_the_hash_on_trust_and_says_so(
            self, qualifier_stub, method_dir, dockerfile, tmp_path):
        digest = cpt.terms_sha256({"disposition": "retain_ip"})
        out = _submit(method_dir, dockerfile, tmp_path,
                      offline=True, bundle_out=str(tmp_path / "exchange"),
                      secret_set_id=SECRET_SET,
                      developer_email=PARTICIPANT,
                      language_pair="qaa>qab",
                      offline_qualifier_id=QUALIFIER_ID,
                      offline_threshold=50.0,
                      accept_terms=digest)
        assert out["manifest"]["submission"][
            "acceptedPrizeTermsSha256"] == digest
        # Nothing verified it here: the import-side check labels it unchecked.
        from mt_eval_harness import contest_declarations as cd
        findings = cd.accepted_terms_findings(out["manifest"])
        assert findings and findings[0]["severity"] == "WARN"

    def test_refused_without_agree(self, qualifier_stub, wired, method_dir,
                                   dockerfile, tmp_path):
        with pytest.raises(MethodBundleError, match="--agree"):
            _submit(method_dir, dockerfile, tmp_path, agree=False)

    def test_refused_without_node_id(self, qualifier_stub, wired, method_dir,
                                     dockerfile, tmp_path):
        with pytest.raises(MethodBundleError, match="--node-id"):
            _submit(method_dir, dockerfile, tmp_path, node_id="")

    def test_refused_on_a_bad_declaration(self, qualifier_stub, wired,
                                          method_dir, dockerfile, tmp_path):
        from mt_eval_harness.contest_declarations import DeclarationError
        with pytest.raises(DeclarationError, match="trainingData"):
            _submit(method_dir, dockerfile, tmp_path, training_data="")
        assert not wired["requests"] and not wired["storage"]

    def test_network_call_in_method_blocks_upload(self, qualifier_stub, wired,
                                                  method_dir, dockerfile,
                                                  tmp_path):
        (method_dir / "helper.py").write_text(
            "import requests\n", encoding="utf-8")
        with pytest.raises(MethodBundleError, match="BLOCK"):
            _submit(method_dir, dockerfile, tmp_path)
        assert not wired["requests"] and not wired["storage"]

    def test_bundle_out_writes_sneakernet_exchange(self, qualifier_stub, wired,
                                                   method_dir, dockerfile,
                                                   tmp_path):
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
        install_qualifier_stub(monkeypatch)

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
            scratch_dir=tmp_path / "scratch",
            offline_qualifier_id=QUALIFIER_ID, offline_threshold=50.0,
            **DECLARATIONS)
        assert (Path(out["bundle_dir"]) / "request.json").is_file()
        assert out["manifest"]["qualifier"]["qualifierId"] == QUALIFIER_ID

    def test_offline_refuses_a_receipt_for_another_qualifier(
            self, monkeypatch, method_dir, dockerfile, tmp_path):
        install_qualifier_stub(monkeypatch)
        with pytest.raises(StubQualifierError, match="not 'other-qualifier'"):
            mb.submit_method(
                contest_id=CONTEST_ID, method_dir=method_dir,
                dockerfile=dockerfile, method_name="acme-nmt-v3",
                method_version="3.0.0", entrypoint="method/translate.py",
                method_class="pipeline", developer_name="Test Dev",
                developer_email=PARTICIPANT, agree=True, node_id=NODE_ID,
                secret_set_id=SECRET_SET, language_pair="qaa>qab",
                bundle_out=tmp_path / "exchange", offline=True,
                scratch_dir=tmp_path / "scratch",
                offline_qualifier_id="other-qualifier", offline_threshold=50.0,
                **DECLARATIONS)
        assert not (tmp_path / "exchange").exists()

    def test_offline_requires_bundle_out_and_secret_set(self, qualifier_stub,
                                                        method_dir, dockerfile,
                                                        tmp_path):
        with pytest.raises(MethodBundleError, match="--bundle-out"):
            _submit(method_dir, dockerfile, tmp_path, offline=True)
        with pytest.raises(MethodBundleError, match="--secret-set"):
            _submit(method_dir, dockerfile, tmp_path, offline=True,
                    bundle_out=tmp_path / "x")

    def test_offline_requires_the_published_qualifier_terms(
            self, qualifier_stub, method_dir, dockerfile, tmp_path):
        with pytest.raises(MethodBundleError, match="--offline-qualifier-id"):
            _submit(method_dir, dockerfile, tmp_path, offline=True,
                    bundle_out=tmp_path / "x", secret_set_id=SECRET_SET)


# ---------------------------------------------------------------------------
# Secret-set resolution.
# ---------------------------------------------------------------------------

class TestResolveSecretSet:
    """Which sealed set an entry is executed against.

    R2 (2026-09-06): a contest is registered against its SECRET set
    (``contest_prep.contest_corpus_id``), so the contest's own ``corpus_id``
    is the answer whenever it is active under the qualifier. The sibling
    lookup survives only for a contest prepared BEFORE R2, whose corpus_id is
    the retired blind split.
    """
    R2_CONTEST = {"id": CONTEST_ID, "corpus_id": SECRET_SET}
    LEGACY_CONTEST = {"id": CONTEST_ID, "corpus_id": BLIND_SET}
    QUAL = {"qualifier_id": QUALIFIER_ID}

    def _wire(self, monkeypatch, rows):
        monkeypatch.setattr(
            mb, "_api_request",
            lambda method, path, data=None, params=None, session=None: rows)

    def test_the_contests_own_set_wins(self, monkeypatch):
        """A holdout is registered under the SAME qualifier, so "the sibling"
        is not a safe answer: pick the set the contest actually names."""
        self._wire(monkeypatch, [
            {"sealed_set_id": SECRET_SET, "status": "active"},
            {"sealed_set_id": "eval-qaa-qab-synth-holdout-v1",
             "status": "active"},
        ])
        assert resolve_secret_set(self.R2_CONTEST, self.QUAL)[
            "sealed_set_id"] == SECRET_SET

    def test_a_pre_r2_contest_still_resolves_the_set_it_names(self,
                                                              monkeypatch):
        """A contest prepared before R2 names its BLIND split as corpus_id.
        The set the contest names is still what comes back — the resolver does
        not guess that the organizer meant a different one — so such a contest
        needs --secret-set. It is stated here rather than left to surprise
        someone; no contest has been prepared that way since 2026-09-06."""
        self._wire(monkeypatch, [
            {"sealed_set_id": BLIND_SET, "status": "active"},
            {"sealed_set_id": SECRET_SET, "status": "active"},
        ])
        assert resolve_secret_set(self.LEGACY_CONTEST, self.QUAL)[
            "sealed_set_id"] == BLIND_SET
        assert resolve_secret_set(
            self.LEGACY_CONTEST, self.QUAL,
            SECRET_SET)["sealed_set_id"] == SECRET_SET

    def test_the_only_active_sibling_resolves(self, monkeypatch):
        """The contest's own set is not registered under this qualifier (a
        retired or rotated set): one active sibling is unambiguous."""
        self._wire(monkeypatch, [
            {"sealed_set_id": SECRET_SET, "status": "active"}])
        assert resolve_secret_set(self.LEGACY_CONTEST, self.QUAL)[
            "sealed_set_id"] == SECRET_SET

    def test_no_secret_set_fails_loud(self, monkeypatch):
        self._wire(monkeypatch, [])
        with pytest.raises(MethodBundleError, match="no active sealed set"):
            resolve_secret_set(self.LEGACY_CONTEST, self.QUAL)

    def test_ambiguity_requires_flag(self, monkeypatch):
        self._wire(monkeypatch, [
            {"sealed_set_id": SECRET_SET, "status": "active"},
            {"sealed_set_id": "eval-qaa-qab-other-secret-v1",
             "status": "active"},
        ])
        with pytest.raises(MethodBundleError, match="--secret-set"):
            resolve_secret_set(self.LEGACY_CONTEST, self.QUAL)
        assert resolve_secret_set(
            self.LEGACY_CONTEST, self.QUAL,
            SECRET_SET)["sealed_set_id"] == SECRET_SET

    def test_an_unknown_secret_set_names_the_active_ones(self, monkeypatch):
        self._wire(monkeypatch, [
            {"sealed_set_id": SECRET_SET, "status": "active"}])
        with pytest.raises(MethodBundleError) as exc:
            resolve_secret_set(self.R2_CONTEST, self.QUAL, "eval-nope-v1")
        assert SECRET_SET in str(exc.value)


# ---------------------------------------------------------------------------
# The retired T1 gate.
# ---------------------------------------------------------------------------

def test_t1_standing_check_is_gone():
    """R2 retired the hypotheses entry lane, so the gate that read its records
    is gone too — not left behind returning None, which would read as a gate
    that always passes."""
    assert not hasattr(mb, "check_t1_standing")
    assert hasattr(mb, "require_qualifier_receipt")


def test_the_qualifier_stub_matches_the_real_modules_contract():
    """The stub above stands in for lane L0's contest_qualify. If the real
    module's signatures move, these tests would keep passing against a fiction
    — so assert the contract (C1) directly."""
    import inspect

    from mt_eval_harness import contest_qualify

    assert issubclass(contest_qualify.QualifierError, Exception)
    load = inspect.signature(contest_qualify.load_receipt)
    assert list(load.parameters) == ["contest_id", "receipt_dir", "system",
                                     "name_hint"]
    assert load.parameters["receipt_dir"].default is None
    for name in ("system", "name_hint"):
        assert load.parameters[name].kind is inspect.Parameter.KEYWORD_ONLY
        assert load.parameters[name].default is None
    require = inspect.signature(contest_qualify.require_pass)
    assert list(require.parameters) == [
        "receipt", "contest_id", "qualifier_id", "threshold"]
    for name in ("contest_id", "qualifier_id", "threshold"):
        assert require.parameters[name].kind is inspect.Parameter.KEYWORD_ONLY


def test_real_receipts_carry_every_field_the_manifest_block_needs():
    """qualifier_block_from_receipt copies nine fields verbatim; a receipt
    missing one would fail at submit time, not here. Assert the producer and
    the consumer name the same fields."""
    import inspect

    from mt_eval_harness import contest_qualify
    from mt_eval_harness.contest_declarations import QUALIFIER_MANIFEST_FIELDS

    source = inspect.getsource(contest_qualify)
    for field in QUALIFIER_MANIFEST_FIELDS:
        assert f'"{field}"' in source, (
            f"contest_qualify writes no {field!r} into its receipt, but the "
            f"manifest qualifier block requires it")


# ---------------------------------------------------------------------------
# `mt-eval contest method-status` — the counts-only diagnostics readout
# (practice 12). A sealed node returns no outputs, so the STAGE and the
# counts are the only feedback a participant ever gets; "nothing recorded"
# and "this database cannot record any" are different answers and both are
# said out loud rather than printed as a blank.
# ---------------------------------------------------------------------------

class TestMethodStatusDiagnostics:
    REQUEST = {
        "request_id": "authreq-abc123", "sealed_set_id": SECRET_SET,
        "state": "authorized", "method_sha": "d" * 64,
        "corpus_version": "v1", "node_measurement": NODE_ID,
        "requested_by": PARTICIPANT,
        "created_at": "2026-09-06T10:00:00Z", "decided_at": None,
    }

    def _install(self, monkeypatch, *, diagnostics, column_exists=True):
        seen = {}

        def api(method, path, params=None, **kw):
            seen.setdefault("selects", []).append(params.get("select", ""))
            if path == "authorization_audit_log":
                return []
            assert path == "authorization_requests"
            select = params.get("select", "")
            if "execution_diagnostics" in select and not column_exists:
                raise RuntimeError(
                    'Supabase service API error (400): {"code":"42703",'
                    '"message":"column authorization_requests.'
                    'execution_diagnostics does not exist"}')
            row = dict(self.REQUEST)
            if "execution_diagnostics" in select:
                row["execution_diagnostics"] = diagnostics
            return [row]

        monkeypatch.setattr(mb, "_api_request", api)
        return seen

    def test_failed_run_prints_stage_and_counts(self, monkeypatch, capsys):
        seen = self._install(monkeypatch, diagnostics={
            "outcome": "failed", "stage": "exit", "exit_code": 1,
            "runtime_seconds": 12.5, "n_sources": 6, "n_output_lines": None,
            "stderr_bytes": 384})
        out = mb.method_status("authreq-abc123")
        printed = capsys.readouterr().out
        assert "execution_diagnostics" in seen["selects"][0]
        assert "outcome  : failed" in printed
        assert "stage    : exit" in printed
        assert "exit code: 1" in printed
        assert "stderr B : 384" in printed
        assert "counts only" in printed
        # A field the node could not measure is simply not printed — no "None".
        assert "out lines: None" not in printed
        assert out["diagnostics"]["stage"] == "exit"
        assert out["diagnostics_available"] is True

    def test_scored_run_prints_counts(self, monkeypatch, capsys):
        self._install(monkeypatch, diagnostics={
            "outcome": "scored", "n_scored": 6, "n_empty": 0,
            "runtime_seconds": 41.2})
        mb.method_status("authreq-abc123")
        printed = capsys.readouterr().out
        assert "outcome  : scored" in printed
        assert "scored   : 6" in printed
        assert "empty out: 0" in printed
        assert "stage" not in printed.split("execution :")[1].split("\n")[1]

    def test_null_diagnostics_says_so(self, monkeypatch, capsys):
        self._install(monkeypatch, diagnostics=None)
        out = mb.method_status("authreq-abc123")
        assert "no diagnostics recorded" in capsys.readouterr().out
        assert out["diagnostics"] is None
        assert out["diagnostics_available"] is True

    def test_pre_074_database_says_the_column_is_missing(self, monkeypatch,
                                                        capsys):
        """A 400 must never render as a blank block.

        "no diagnostics recorded" and "this database cannot record any" send
        the participant to completely different places.
        """
        seen = self._install(monkeypatch, diagnostics=None,
                             column_exists=False)
        out = mb.method_status("authreq-abc123")
        printed = capsys.readouterr().out
        assert "predates migration 074" in printed
        assert "no diagnostics recorded" not in printed
        assert out["diagnostics_available"] is False
        # It retried WITHOUT the column rather than failing the whole readout.
        assert "execution_diagnostics" in seen["selects"][0]
        assert "execution_diagnostics" not in seen["selects"][1]
        # The rest of the status is intact.
        assert "authreq-abc123" in printed and SECRET_SET in printed

    def test_unrelated_api_error_still_fails_loud(self, monkeypatch):
        def api(method, path, params=None, **kw):
            raise RuntimeError("Supabase service API error (503): upstream down")

        monkeypatch.setattr(mb, "_api_request", api)
        with pytest.raises(RuntimeError, match="503"):
            mb.method_status("authreq-abc123")
