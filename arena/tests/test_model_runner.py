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
from mt_eval_harness.model_runner import (
    execute_and_score_declarative,
    validate_declarative_bundle,
    validate_safetensors_file,
)
from mt_eval_harness.queue_runner import compute_request_fingerprint

from fake_supabase import FakeSupabase, patch_service_layer
from test_sandbox_runner import (
    BLIND_SET, CONTEST_ID, DEV_CORPUS, NODE_ID, PARTICIPANT, SECRET_CORPUS,
    SECRET_SET, _seal_fixture, toy_translate,
)


# ---------------------------------------------------------------------------
# Synthetic-artifact helpers (no torch needed).
# ---------------------------------------------------------------------------

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
                         extra: dict | None = None) -> dict:
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
        source_lang="qaa", target_lang="qab", architecture=architecture)
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
                architecture="MarianMTModel")

    def test_non_safetensors_weights_rejected(self):
        with pytest.raises(ModelBundleError, match="safetensors"):
            build_declarative_manifest(
                method_name="x", method_version="1", method_class="pipeline",
                paradigm="neural-nmt", developer_name="d",
                developer_email=PARTICIPANT, agreement_signed=True,
                corpus_id=SECRET_SET, source_lang="qaa", target_lang="qab",
                architecture="MarianMTModel", weights_file="model.bin")


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
    fake.tables["contest_intake"].append({
        "intake_id": "intake-t1", "contest_id": CONTEST_ID,
        "submitted_by": PARTICIPANT, "status": "published",
        "run_card_id": "card-t1",
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
    monkeypatch.setattr(cn, "load_node_config", lambda p=None: cfg)

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
