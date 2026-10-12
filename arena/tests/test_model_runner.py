"""test_model_runner — the DECLARATIVE-MODEL lane (Lane A), fully offline.

The security core (validate_declarative_bundle) needs NO torch/transformers —
it parses safetensors headers directly and refuses code/pickle by format — so
it is tested for real here. The trusted engine is injected (a toy translator),
the DB is the shared FakeSupabase, and the sealing crypto is real (skips when
the champollion CLI is absent, the established pattern).

Synthetic qaa>qab fixtures only; the toy translate rule makes the injected
engine a PERFECT method, so a green run must publish a high composite.
"""

from __future__ import annotations

import json
import os
import struct
from pathlib import Path

import pytest

import mt_eval_harness.model_runner as mr
from mt_eval_harness.model_bundle import (
    ModelBundleError,
    build_declarative_manifest,
    build_model_bundle,
    manifest_declarative_findings,
)
from mt_eval_harness.contest_declarations import (
    constraints_findings,
    qualifier_block_from_receipt,
    submission_fields_from_manifest,
)
from mt_eval_harness.model_runner import (
    execute_and_score_declarative,
    parameter_count_from_header,
    validate_declarative_bundle,
    validate_safetensors_file,
)
from mt_eval_harness.external_scoring import sha256_file
from mt_eval_harness.queue_runner import compute_request_fingerprint

from fake_supabase import FakeSupabase, patch_service_layer
from test_sandbox_runner import (
    BLIND_SET, CONTEST_ID, DEV_CORPUS, NODE_ID, PARTICIPANT, SECRET_CORPUS,
    SECRET_SET, _seal_fixture, toy_translate,
)


# ---------------------------------------------------------------------------
# Synthetic-artifact helpers (no torch needed).
# ---------------------------------------------------------------------------

# The entry declarations every contest submission carries (contract C2). The
# fixture weights below hold ONE 1x2 F32 tensor, so the honest parameter count
# is 2 — the one declaration the node re-derives from the header.
FIXTURE_PARAMETERS = 2

QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"

PASSING_RECEIPT = {
    "receiptVersion": "1", "contestId": CONTEST_ID,
    "qualifierId": "eval-qaa-qab-synth-qualifier-v2026",
    "devCorpusSha256": "a" * 64, "hypothesesSha256": "b" * 64,
    "metric": "chrf_plus_plus", "score": 61.5, "threshold": 50.0, "passed": True,
    "harnessVersion": "0.1.0", "scoredAt": "2026-09-06T12:00:00+00:00",
    "selfReported": True, "note": "self-scored on the public dev set",
}


def declarations(**overrides) -> dict:
    """The three manifest declaration blocks build_declarative_manifest needs."""
    constraints = dict(track="unconstrained", parameterCount=FIXTURE_PARAMETERS,
                       weightsLicense="Apache-2.0", weightsPublic=True,
                       trainingData="")
    submission = dict(isPrimary=True, description="A declarative NMT model.",
                      methodReleaseUrl=None)
    constraints.update(overrides.pop("constraints", {}))
    submission.update(overrides.pop("submission", {}))
    assert not overrides, overrides
    return {"constraints": constraints, "submission": submission,
            "qualifier": qualifier_block_from_receipt(PASSING_RECEIPT)}

def write_safetensors(path: Path, *, tensors: int = 1) -> None:
    """A minimal VALID safetensors file: 8-byte LE header length + JSON header
    + a matching zero payload. This is what a real .safetensors looks like at
    the header level — enough for validate_safetensors_file to accept it."""
    header = {f"w{i}": {"dtype": "F32", "shape": [1, 2],
                        "data_offsets": [i * 8, i * 8 + 8]}
              for i in range(tensors)}
    hb = json.dumps(header).encode("utf-8")
    with open(path, "wb") as fh:
        fh.write(struct.pack("<Q", len(hb)))
        fh.write(hb)
        fh.write(b"\0" * (8 * tensors))


def make_declarative_dir(root: Path, *, architecture: str = "MarianMTModel",
                         extra: dict | None = None,
                         declared: dict | None = None) -> dict:
    """A clean declarative model dir + manifest (the run-time layout)."""
    root.mkdir(parents=True, exist_ok=True)
    write_safetensors(root / "model.safetensors")
    (root / "config.json").write_text(
        json.dumps({"architectures": [architecture], "model_type": "marian"}),
        encoding="utf-8")
    (root / "tokenizer.json").write_text(json.dumps({"version": "1.0"}),
                                         encoding="utf-8")
    (root / "tokenizer_config.json").write_text(json.dumps({"model_max_length": 512}),
                                                encoding="utf-8")
    for name, content in (extra or {}).items():
        (root / name).write_text(content, encoding="utf-8")
    manifest = build_declarative_manifest(
        method_name="acme-nmt-declarative", method_version="1.0.0",
        method_class="pipeline", paradigm="neural-nmt",
        developer_name="Test Dev", developer_email=PARTICIPANT,
        agreement_signed=True, corpus_id=SECRET_SET,
        source_lang="qaa", target_lang="qab", architecture=architecture,
        **(declared or declarations()))
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2),
                                        encoding="utf-8")
    return manifest


@pytest.fixture
def declarative_bundle(tmp_path):
    """A packed declarative bundle dir + tarball (what the node extracts)."""
    src = tmp_path / "model-src"
    manifest = make_declarative_dir(src)
    built = build_model_bundle(model_dir=src, manifest=manifest,
                               out_path=tmp_path / "work" / "bundle.tar.gz")
    bundle_dir = tmp_path / "work" / "bundle"
    make_declarative_dir(bundle_dir)  # same contents, extracted layout
    return {"dir": bundle_dir, "tarball": Path(built["path"]),
            "manifest": manifest, "method_sha": built["method_sha"]}


PERFECT = lambda bundle_dir, sources, manifest: [toy_translate(s) for s in sources]  # noqa: E731


# ---------------------------------------------------------------------------
# safetensors header validation (the "is this pickle-in-disguise?" gate).
# ---------------------------------------------------------------------------

class TestSafetensors:
    def test_valid_safetensors_accepted(self, tmp_path):
        p = tmp_path / "m.safetensors"
        write_safetensors(p, tensors=3)
        info = validate_safetensors_file(p)
        assert info["tensors"] == 3

    def test_pickle_renamed_safetensors_rejected(self, tmp_path):
        import pickle
        p = tmp_path / "evil.safetensors"
        p.write_bytes(pickle.dumps({"payload": list(range(100))}))
        with pytest.raises(ValueError):
            validate_safetensors_file(p)

    @pytest.mark.parametrize("blob", [
        b"",                                  # empty
        b"\x00\x00\x00",                      # too short
        struct.pack("<Q", 10) + b"not json!",  # header not JSON
        struct.pack("<Q", 2) + b"{}",         # empty header object
    ])
    def test_malformed_rejected(self, tmp_path, blob):
        p = tmp_path / "bad.safetensors"
        p.write_bytes(blob)
        with pytest.raises(ValueError):
            validate_safetensors_file(p)


# ---------------------------------------------------------------------------
# The declarative bundle validation — the malice check.
# ---------------------------------------------------------------------------

class TestDeclarativeValidation:
    def test_clean_bundle_passes(self, declarative_bundle):
        report = validate_declarative_bundle(declarative_bundle["dir"],
                                             expected_corpus_id=SECRET_SET)
        assert not report["blocked"], report["blocks"]

    def test_pickle_weights_extension_rejected(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d)
        # A PyTorch-style pickle checkpoint smuggled in.
        import pickle
        (d / "pytorch_model.bin").write_bytes(pickle.dumps({"w": 1}))
        report = validate_declarative_bundle(d)
        assert report["blocked"]
        assert any(".bin" in b["file"] or "magic" in b["detail"]
                   for b in report["blocks"])

    def test_pickle_renamed_safetensors_rejected(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d)
        import pickle
        (d / "model.safetensors").write_bytes(pickle.dumps({"w": list(range(50))}))
        report = validate_declarative_bundle(d)
        assert report["blocked"]
        assert any("safetensors" in b["detail"] for b in report["blocks"])

    def test_code_file_rejected(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d, extra={"sneaky.py": "import socket\n"})
        report = validate_declarative_bundle(d)
        assert report["blocked"]
        assert any(b["file"] == "sneaky.py" for b in report["blocks"])

    def test_auto_map_rejected(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d)
        (d / "config.json").write_text(json.dumps({
            "architectures": ["MarianMTModel"],
            "auto_map": {"AutoModel": "modeling_evil.EvilModel"}}),
            encoding="utf-8")
        report = validate_declarative_bundle(d)
        assert report["blocked"]
        assert any("auto_map" in b["detail"] for b in report["blocks"])

    def test_trust_remote_code_rejected(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d)
        (d / "tokenizer_config.json").write_text(json.dumps({
            "trust_remote_code": True}), encoding="utf-8")
        report = validate_declarative_bundle(d)
        assert report["blocked"]
        assert any("trust_remote_code" in b["detail"] for b in report["blocks"])

    def test_unknown_architecture_permissive_by_default(self, tmp_path):
        # Founder call 2026-07-19: permissive by default. An unrecognized
        # architecture is ACCEPTED (with a WARN) — security comes from
        # safetensors + trust_remote_code=False, not the architecture name.
        d = tmp_path / "b"
        make_declarative_dir(
            d, architecture="SomeNewMTModelForConditionalGeneration")
        report = validate_declarative_bundle(d)
        assert not report["blocked"], report["blocks"]
        assert any(w["category"] == "architecture" for w in report["warns"])

    def test_unknown_architecture_blocked_under_allowlist(self, tmp_path):
        # A CAREFUL host pins an allowlist; an off-list architecture is a HOST
        # POLICY denial (not a security limit).
        d = tmp_path / "b"
        make_declarative_dir(
            d, architecture="SomeNewMTModelForConditionalGeneration")
        report = validate_declarative_bundle(
            d, architecture_policy=["MarianMTModel"])
        assert report["blocked"]
        assert any("policy" in b["detail"].lower() for b in report["blocks"])

    def test_known_policy_accepts_curated_rejects_others(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d, architecture="MarianMTModel")
        assert not validate_declarative_bundle(
            d, architecture_policy="known")["blocked"]
        d2 = tmp_path / "b2"
        make_declarative_dir(d2, architecture="TotallyCustomForConditionalGen")
        assert validate_declarative_bundle(
            d2, architecture_policy="known")["blocked"]

    def test_code_free_gates_hold_regardless_of_policy(self, tmp_path):
        # Even fully permissive, the NON-NEGOTIABLE gates still block pickle/code.
        d = tmp_path / "b"
        make_declarative_dir(d, extra={"evil.py": "import os\n"})
        report = validate_declarative_bundle(d, architecture_policy="permissive")
        assert report["blocked"]
        assert any(b["file"] == "evil.py" for b in report["blocks"])

    @pytest.mark.parametrize("magic,label", [
        (b"\x80\x04 evil pickle", "pickle"),
        (b"PK\x03\x04zip", "zip"),
        (b"\x7fELFbin", "ELF"),
    ])
    def test_magic_bytes_rejected(self, tmp_path, magic, label):
        d = tmp_path / "b"
        make_declarative_dir(d)
        # A data-suffixed file whose CONTENT is executable/pickle.
        (d / "extra.txt").write_bytes(magic)
        report = validate_declarative_bundle(d)
        assert report["blocked"]
        assert any("magic" in b["detail"] for b in report["blocks"]), label

    def test_missing_weights_rejected(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d)
        (d / "model.safetensors").unlink()
        report = validate_declarative_bundle(d)
        assert report["blocked"]

    def test_generation_config_extra_key_warns(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d, extra={
            "generation_config.json": json.dumps({"num_beams": 4,
                                                  "custom_hook": "evil"})})
        report = validate_declarative_bundle(d)
        assert any(w["category"] == "generation" for w in report["warns"])


class TestManifestConsistency:
    def test_valid_passes(self, declarative_bundle):
        assert manifest_declarative_findings(declarative_bundle["manifest"]) == []

    def test_code_paradigm_rejected(self):
        # 'llm' is a VALID paradigm but not one the declarative engine runs —
        # it must be refused with the "not runnable declaratively" reason.
        with pytest.raises(ModelBundleError, match="declaratively"):
            build_declarative_manifest(
                method_name="x", method_version="1", method_class="pipeline",
                paradigm="llm", developer_name="d",
                developer_email=PARTICIPANT, agreement_signed=True,
                corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
                architecture="MarianMTModel", **declarations())

    def test_non_safetensors_weights_rejected(self):
        with pytest.raises(ModelBundleError, match="safetensors"):
            build_declarative_manifest(
                method_name="x", method_version="1", method_class="pipeline",
                paradigm="neural-nmt", developer_name="d",
                developer_email=PARTICIPANT, agreement_signed=True,
                corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
                architecture="MarianMTModel", weights_file="model.bin",
                **declarations())


# ---------------------------------------------------------------------------
# The trusted engine + execute-and-score (injected translator).
# ---------------------------------------------------------------------------

class TestExecuteAndScore:
    def test_perfect_engine_scores_high(self, declarative_bundle, tmp_path):
        work = tmp_path / "run"
        result = execute_and_score_declarative(
            bundle_dir=declarative_bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=work, sealed_set_id=SECRET_SET, language_pair="qaa>qab",
            node_id=NODE_ID, output_dir=tmp_path / "out",
            submission={"method_sha": declarative_bundle["method_sha"]},
            translator=PERFECT)
        assert result["qualifier_score"] > 90
        card = result["method_card"]
        assert card["submission_lane"] == "declarative-model"
        assert "CODE-FREE BY CONSTRUCTION" in card["provenance_note"]
        assert card["architecture"] == "MarianMTModel"
        assert not work.exists()          # scratch wiped

    def test_blocked_bundle_never_runs_engine(self, tmp_path):
        d = tmp_path / "b"
        make_declarative_dir(d, extra={"evil.py": "import os\n"})
        calls = []

        def spy(bundle_dir, sources, manifest):
            calls.append(1)
            return sources
        with pytest.raises(mr.SandboxError, match="BLOCK"):
            execute_and_score_declarative(
                bundle_dir=d, corpus_path=SECRET_CORPUS, work_dir=tmp_path / "r",
                sealed_set_id=SECRET_SET, language_pair="qaa>qab",
                node_id=NODE_ID, output_dir=tmp_path / "o", translator=spy)
        assert calls == [], "a blocked bundle must never reach the engine"

    def test_declarative_execution_facts_honest_none(self, declarative_bundle,
                                                     tmp_path):
        """Lane A reports what it measured, and NOTHING it did not.

        There is no container here: no build step, no image, no cgroup cap.
        Copying Lane B's ram/gpu numbers across would be an invention, and a
        0 would read as a measurement. So those fields are None, and the GPU
        one carries a note saying the device was never looked at.
        """
        from mt_eval_harness.execution_facts import no_text_guard
        from mt_eval_harness.publish import assemble_run_card

        result = execute_and_score_declarative(
            bundle_dir=declarative_bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
            language_pair="qaa>qab", node_id=NODE_ID,
            output_dir=tmp_path / "out", translator=PERFECT)

        execution = result["execution"]
        assert execution["runtime"] == "declarative-engine"
        assert execution["node_id"] == NODE_ID
        assert execution["source_count"] == 6
        assert execution["runtime_seconds"] is not None
        assert execution["cpus"] == os.cpu_count()
        # Honest Nones — measured nothing, claims nothing.
        assert execution["ram_gb"] is None
        assert execution["gpu"] is None
        assert execution["gpu_note"] == mr.GPU_NOT_MEASURED_NOTE
        # …and no Lane-B container facts smuggled in.
        for absent in ("build_seconds", "run_seconds", "image_digest",
                       "pids_limit", "tmp_gb", "translations_path"):
            assert absent not in execution, absent

        # The engine label names what ACTUALLY ran: an injected translator is
        # not transformers, and saying so would be an unchecked claim.
        assert execution["engine"] == "injected-translator"
        assert mr._engine_label(mr.hf_translate) == mr.DECLARATIVE_ENGINE

        # It reaches the card through the same C4 door as Lane B.
        run_card, _, _ = assemble_run_card(result["report_path"])
        assert run_card["execution"] == execution
        no_text_guard(result["diagnostics"])
        assert result["diagnostics"]["outcome"] == "scored"
        assert result["diagnostics"]["n_scored"] == 6

    def test_count_mismatch_fails(self, declarative_bundle, tmp_path):
        with pytest.raises(mr.SandboxError, match="count mismatch"):
            execute_and_score_declarative(
                bundle_dir=declarative_bundle["dir"], corpus_path=SECRET_CORPUS,
                work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
                language_pair="qaa>qab", node_id=NODE_ID,
                output_dir=tmp_path / "out",
                translator=lambda b, s, m: ["only one line"])

    def test_real_engine_fails_loud_without_transformers(self, declarative_bundle,
                                                         tmp_path):
        # transformers is not installed in this env → the REAL engine must fail
        # LOUD (never silently skip / never run anything untrusted).
        pytest.importorskip  # noqa: B018 - documents intent
        try:
            import transformers  # noqa: F401
            pytest.skip("transformers IS installed — cannot test the absent path")
        except ImportError:
            pass
        with pytest.raises(mr.SandboxError, match="transformers"):
            mr.hf_translate(declarative_bundle["dir"], ["a b"],
                            declarative_bundle["manifest"])


# ---------------------------------------------------------------------------
# Node dispatch — run_method_request picks Lane A from the manifest.
# ---------------------------------------------------------------------------

@pytest.fixture
def model_world(monkeypatch, tmp_path, declarative_bundle):
    import mt_eval_harness.contest_node as cn
    import mt_eval_harness.sandbox_runner as sr
    import mt_eval_harness.sovereign_service as svc

    fake = FakeSupabase()
    fake.tables["contests"].append({
        "id": CONTEST_ID, "name": "Synthetic Open 2026", "status": "open",
        "corpus_id": BLIND_SET, "language_pair": "qaa>qab",
        "authorization_model": "blanket", "intake_open": True,
    })
    # The PUBLIC gate rows (042): before the sealed run, the node re-executes
    # the submitted model on this qualifier's dev corpus in its own engine.
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

    cfg = {
        "node_id": NODE_ID, "poll_seconds": 1, "grant_ttl_seconds": 3600,
        "scratch_dir": str(tmp_path / "scratch"),
        "output_dir": str(tmp_path / "runs"),
        "contests": {CONTEST_ID: {
            "dev_corpus": str(DEV_CORPUS), "corpus_version": "v1",
            "secret_set_id": SECRET_SET,
            "secret_artifact": str(tmp_path / "not-sealed-yet"),
            "secret_privkey": str(tmp_path / "not-sealed-yet.key"),
        }},
    }
    monkeypatch.setattr(cn, "load_node_config", lambda p=None, **kw: cfg)

    def propose(method_sha, *, upload):
        request_id = f"authreq-{method_sha[:12]}"
        fingerprint = compute_request_fingerprint(
            {"method_sha": method_sha, "corpus_id": SECRET_SET,
             "corpus_version": "v1"}, node_measurement=NODE_ID)
        fake("POST", "authorization_requests", data={
            "request_id": request_id, "sealed_set_id": SECRET_SET,
            "state": "pending", "fingerprint": fingerprint,
            "method_sha": method_sha, "corpus_id": SECRET_SET,
            "corpus_version": "v1", "node_measurement": NODE_ID,
            "requested_by": PARTICIPANT})
        storage[f"{CONTEST_ID}/{PARTICIPANT}/{request_id}.tar.gz"] = upload
        return request_id

    return {"fake": fake, "cfg": cfg, "storage": storage, "sr": sr,
            "tmp_path": tmp_path, "bundle": declarative_bundle,
            "propose": propose}


class TestNodeDispatch:
    def test_declarative_request_publishes_aggregates_only(self, model_world,
                                                          tmp_path):
        artifact, priv = _seal_fixture(tmp_path, SECRET_CORPUS, SECRET_SET)
        ccfg = model_world["cfg"]["contests"][CONTEST_ID]
        ccfg["secret_artifact"] = str(artifact)
        ccfg["secret_privkey"] = str(priv)

        rid = model_world["propose"](model_world["bundle"]["method_sha"],
                                     upload=model_world["bundle"]["tarball"].read_bytes())
        out = model_world["sr"].run_method_request(rid, translator=PERFECT)
        assert out["status"] == "published", out.get("reason")

        fake = model_world["fake"]
        card = fake.tables["run_cards"][0]
        assert card["trust"] == "verified"
        assert card["condition"] == "declarative-model"
        # The published affirmation is lane-accurate: code-free, NOT a container.
        assert "code-free by construction" in card["affirmation"]
        assert "network-isolated container" not in card["affirmation"]
        # Aggregates-only: no per-entry rows, no secret text in the row.
        assert "run_card_entries" not in fake.tables
        secret = json.loads(SECRET_CORPUS.read_text(encoding="utf-8"))["entries"]
        blob = json.dumps(card, ensure_ascii=False)
        for e in secret:
            assert e["reference"] not in blob and e["source"] not in blob
        # Decrypted corpus scratch is wiped.
        scratch = Path(model_world["cfg"]["scratch_dir"])
        leftover = [str(p) for p in scratch.rglob("*.json")
                    if any(e["reference"] in p.read_text(encoding="utf-8",
                                                         errors="replace")
                           for e in secret)]
        assert leftover == []

    def test_declarative_pickle_denied_before_run(self, model_world, tmp_path):
        # Re-pack the bundle with pickle weights; the node must DENY at
        # validation and never decrypt the corpus or run an engine.
        import io
        import tarfile
        import pickle
        src = model_world["bundle"]["tarball"].read_bytes()
        buf = io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(src), mode="r:gz") as tin, \
                tarfile.open(fileobj=buf, mode="w:gz") as tout:
            for m in tin.getmembers():
                if m.name == "model.safetensors":
                    evil = pickle.dumps({"w": list(range(64))})
                    m.size = len(evil)
                    tout.addfile(m, io.BytesIO(evil))
                else:
                    tout.addfile(m, tin.extractfile(m))
        evil_bytes = buf.getvalue()
        import hashlib
        rid = model_world["propose"](hashlib.sha256(evil_bytes).hexdigest(),
                                     upload=evil_bytes)
        calls = []
        out = model_world["sr"].run_method_request(
            rid, translator=lambda *a: calls.append(1) or [])
        assert out["status"] == "denied"
        assert "Lane A" in out["reason"]
        assert calls == []

    def test_node_allowlist_policy_denies_offlist_arch(self, model_world):
        # A CAREFUL host configures an allowlist that excludes the bundle's
        # MarianMTModel → denied at validation (before decrypt/grant/engine).
        model_world["cfg"]["contests"][CONTEST_ID]["declarative"] = {
            "architecture_policy": ["M2M100ForConditionalGeneration"]}
        rid = model_world["propose"](
            model_world["bundle"]["method_sha"],
            upload=model_world["bundle"]["tarball"].read_bytes())
        calls = []
        out = model_world["sr"].run_method_request(
            rid, translator=lambda *a: calls.append(1) or [])
        assert out["status"] == "denied"
        assert "policy" in out["reason"].lower()
        assert calls == [], "off-policy architecture must never reach the engine"


class TestArchPolicyResolver:
    def test_permissive_default(self):
        assert mr.resolve_architecture_policy(None) == ("permissive", None)
        assert mr.resolve_architecture_policy("permissive") == ("permissive", None)

    def test_known(self):
        mode, allowed = mr.resolve_architecture_policy("known")
        assert mode == "allowlist" and "MarianMTModel" in allowed

    def test_list_allowlist(self):
        mode, allowed = mr.resolve_architecture_policy(["A", "B"])
        assert mode == "allowlist" and allowed == frozenset({"A", "B"})

    def test_dict_forms(self):
        assert mr.resolve_architecture_policy({"mode": "permissive"}) == (
            "permissive", None)
        mode, allowed = mr.resolve_architecture_policy(
            {"mode": "allowlist", "architectures": ["X"]})
        assert mode == "allowlist" and allowed == frozenset({"X"})
        # allowlist with no list falls back to the known set (never empty).
        mode, allowed = mr.resolve_architecture_policy({"mode": "allowlist"})
        assert mode == "allowlist" and "MarianMTModel" in allowed


# ---------------------------------------------------------------------------
# Entry declarations (contract C2) + the ONE cross-checkable claim.
# ---------------------------------------------------------------------------

class TestParameterCountFromHeader:
    def test_counts_the_product_of_every_shape(self, tmp_path):
        p = tmp_path / "m.safetensors"
        write_safetensors(p, tensors=3)          # three 1x2 F32 tensors
        assert parameter_count_from_header(p) == 6

    def test_matches_the_fixture_declaration(self, tmp_path):
        p = tmp_path / "m.safetensors"
        write_safetensors(p)
        assert parameter_count_from_header(p) == FIXTURE_PARAMETERS

    def test_a_pickle_in_disguise_fails_loud(self, tmp_path):
        import pickle
        p = tmp_path / "evil.safetensors"
        p.write_bytes(pickle.dumps({"payload": list(range(100))}))
        with pytest.raises(ValueError):
            parameter_count_from_header(p)


class TestDeclarativeDeclarations:
    def test_manifest_carries_all_three_blocks(self, declarative_bundle):
        m = declarative_bundle["manifest"]
        assert m["constraints"]["track"] == "unconstrained"
        assert m["constraints"]["parameterCount"] == FIXTURE_PARAMETERS
        assert m["submission"]["isPrimary"] is True
        assert m["qualifier"]["passed"] is True
        assert "note" not in m["qualifier"]

    def test_declarations_survive_the_round_trip_into_the_tarball(
            self, declarative_bundle):
        import tarfile
        with tarfile.open(declarative_bundle["tarball"], "r:gz") as tar:
            packed = json.loads(
                tar.extractfile("manifest.json").read().decode("utf-8"))
        assert packed["constraints"] == \
            declarative_bundle["manifest"]["constraints"]
        assert packed["submission"] == \
            declarative_bundle["manifest"]["submission"]

    def test_honest_parameter_count_passes_the_cross_check(
            self, declarative_bundle):
        assert constraints_findings(
            declarative_bundle["manifest"],
            bundle_dir=declarative_bundle["dir"]) == []

    def test_inflated_parameter_count_blocks_and_names_both_numbers(
            self, tmp_path):
        src = tmp_path / "inflated"
        manifest = make_declarative_dir(
            src, declared=declarations(
                constraints={"parameterCount": 615_000_000}))
        found = constraints_findings(manifest, bundle_dir=src)
        assert len(found) == 1 and found[0]["severity"] == "BLOCK"
        assert "615,000,000" in found[0]["detail"]
        assert f"{FIXTURE_PARAMETERS:,} parameters" in found[0]["detail"]

    def test_bad_declaration_refuses_the_manifest(self, tmp_path):
        with pytest.raises(ModelBundleError, match="constraints.track"):
            make_declarative_dir(
                tmp_path / "bad",
                declared=declarations(constraints={"track": "semi"}))

    def test_declarations_are_required_kwargs(self, tmp_path):
        with pytest.raises(TypeError, match="constraints"):
            build_declarative_manifest(
                method_name="x", method_version="1", method_class="pipeline",
                paradigm="neural-nmt", developer_name="d",
                developer_email=PARTICIPANT, agreement_signed=True,
                corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
                architecture="MarianMTModel")

    def test_submission_row_projection(self, declarative_bundle):
        row = submission_fields_from_manifest(declarative_bundle["manifest"])
        assert set(row) == {"track", "is_primary", "description",
                            "method_release_url", "constraints",
                            "submitter_label"}
        assert row["submitter_label"] == "Test Dev"
        assert "@" not in row["submitter_label"]


# ---------------------------------------------------------------------------
# Contract C6 in Lane A — the same two roles, the same opposite failure
# semantics, one translate pass per set through the trusted engine.
# ---------------------------------------------------------------------------

HOLDOUT_SET = "eval-qaa-qab-synth-holdout-v1"
SUITE_ID = "eval-thirdparty-diag-v1"


def _extra_corpus_a(tmp_path, name, entries):
    p = tmp_path / f"{name}.json"
    p.write_text(json.dumps({
        "dataset": {"corpus_id": name, "version": "1.0",
                    "language_pair": {"source": "qaa", "target": "qab"},
                    "description": "SYNTHETIC extra set (invented qaa>qab).",
                    "provenance": {"license": "CC0-1.0"}},
        "entries": entries,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return p


@pytest.fixture
def suite_corpus_a(tmp_path):
    return _extra_corpus_a(tmp_path, "suite", [
        {"id": 0, "source": "mira sol volu", "reference": "sol miravo"},
        {"id": 1, "source": "kani luna telo", "reference": "luna kanivo"},
    ])


@pytest.fixture
def holdout_corpus_a(tmp_path):
    return _extra_corpus_a(tmp_path, "holdout", [
        {"id": 0, "source": "venu pira kelo", "reference": "pira venuvo"},
        {"id": 1, "source": "tolu keno mira", "reference": "keno toluvo"},
    ])


class TestDeclarativeExtraSets:
    def _run(self, bundle, tmp_path, extra_sets, translator=PERFECT):
        return execute_and_score_declarative(
            bundle_dir=bundle["dir"], corpus_path=SECRET_CORPUS,
            work_dir=tmp_path / "run", sealed_set_id=SECRET_SET,
            language_pair="qaa>qab", node_id=NODE_ID,
            submission={"method_sha": bundle["method_sha"]},
            output_dir=tmp_path / "out", translator=translator,
            extra_sets=extra_sets)

    def test_one_translate_pass_per_set(self, declarative_bundle, tmp_path,
                                        suite_corpus_a, holdout_corpus_a):
        passes = []

        def counting(bundle_dir, sources, manifest):
            passes.append(len(sources))
            return [toy_translate(s) for s in sources]

        result = self._run(declarative_bundle, tmp_path, [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(suite_corpus_a)},
            {"role": "holdout", "set_id": HOLDOUT_SET,
             "corpus_path": str(holdout_corpus_a)},
        ], translator=counting)
        assert passes == [6, 2, 2], "main, then one pass per extra set"
        assert result["by_test_suite"][SUITE_ID]["n"] == 2
        assert result["holdout"]["role"] == "holdout"

    def test_shape_mirrors_the_sandbox_lane(self, declarative_bundle, tmp_path,
                                            suite_corpus_a):
        result = self._run(declarative_bundle, tmp_path, [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(suite_corpus_a),
             "corpus_sha256": sha256_file(suite_corpus_a)},
        ])
        entry = result["by_test_suite"][SUITE_ID]
        assert set(entry) == {"corpus_card_id", "sha256", "n",
                              "chrf_plus_plus", "corpus_bleu",
                              "runtime_seconds"}
        assert result["holdout"] is None
        run_log = json.loads(Path(result["run_log_path"]).read_text(
            encoding="utf-8"))
        assert SUITE_ID in run_log["provenance"]["by_test_suite"]

    def test_a_failing_suite_never_fails_the_main_run(self, declarative_bundle,
                                                      tmp_path):
        result = self._run(declarative_bundle, tmp_path, [
            {"role": "suite", "set_id": SUITE_ID, "suite_id": SUITE_ID,
             "corpus_path": str(tmp_path / "absent.json")},
        ])
        assert result["qualifier_score"] > 90
        assert result["by_test_suite"][SUITE_ID]["stage"] == "run"

    def test_a_failing_holdout_fails_the_request(self, declarative_bundle,
                                                 tmp_path):
        with pytest.raises(mr.SandboxError, match="does not hold this corpus"):
            self._run(declarative_bundle, tmp_path, [
                {"role": "holdout", "set_id": HOLDOUT_SET,
                 "corpus_path": str(tmp_path / "absent.json")},
            ])

    def test_holdout_report_is_labeled_with_the_holdout_set(
            self, declarative_bundle, tmp_path, holdout_corpus_a):
        result = self._run(declarative_bundle, tmp_path, [
            {"role": "holdout", "set_id": HOLDOUT_SET,
             "corpus_path": str(holdout_corpus_a)},
        ])
        report = json.loads(Path(result["holdout"]["report_path"]).read_text(
            encoding="utf-8"))
        assert report["config"]["dataset_id"] == HOLDOUT_SET
        assert result["holdout"]["execution"]["runtime"] == "declarative-engine"

    def test_unknown_role_refused(self, declarative_bundle, tmp_path,
                                  suite_corpus_a):
        with pytest.raises(mr.SandboxError, match="role must be"):
            self._run(declarative_bundle, tmp_path, [
                {"role": "bonus", "set_id": "x",
                 "corpus_path": str(suite_corpus_a)},
            ])


# ---------------------------------------------------------------------------
# Contract C2 at the Lane-A door (M3-wire, 2026-09-07). The Lane-B door has
# always run contest_declarations.constraints_findings; the Lane-A door did
# not, so a declarative bundle could reach the node with declarations nobody
# checked. The lane a participant chose never decides which declarations the
# node validates.
# ---------------------------------------------------------------------------

class TestLaneADeclarationsAreChecked:
    def _blocks(self, report):
        return " ".join(b["detail"] for b in report["blocks"])

    def test_a_clean_bundle_still_passes(self, declarative_bundle):
        report = validate_declarative_bundle(declarative_bundle["dir"])
        assert report["blocked"] is False, self._blocks(report)

    def test_missing_constraints_block_is_a_BLOCK(self, tmp_path):
        d = tmp_path / "no-constraints"
        manifest = make_declarative_dir(d)
        manifest.pop("constraints")
        (d / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        report = validate_declarative_bundle(d)
        assert report["blocked"] is True
        assert "manifest.constraints is missing" in self._blocks(report)

    def test_missing_submission_block_is_a_BLOCK(self, tmp_path):
        d = tmp_path / "no-submission"
        manifest = make_declarative_dir(d)
        manifest.pop("submission")
        (d / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        report = validate_declarative_bundle(d)
        assert report["blocked"] is True
        assert "manifest.submission is missing" in self._blocks(report)

    def test_an_undeclared_track_is_a_BLOCK(self, tmp_path):
        """The participant CLI refuses this at build time; the node must
        refuse it too — a manifest edited after packing is exactly the case
        the node-side check exists for."""
        d = tmp_path / "bad-track"
        manifest = make_declarative_dir(d)
        manifest["constraints"]["track"] = "sponsored"
        (d / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        report = validate_declarative_bundle(d)
        assert report["blocked"] is True
        assert "track" in self._blocks(report)

    def test_the_parameter_count_is_cross_checked_against_the_weights(
            self, tmp_path):
        """The one declaration the node can MEASURE: the safetensors header.
        It only reaches this check because constraints_findings is called with
        this bundle_dir."""
        d = tmp_path / "overclaimed"
        manifest = make_declarative_dir(d)
        manifest["constraints"]["parameterCount"] = FIXTURE_PARAMETERS * 1000
        (d / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        report = validate_declarative_bundle(d)
        assert report["blocked"] is True
        assert "parameterCount" in self._blocks(report)
