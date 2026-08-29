"""model_bundle — the DECLARATIVE-MODEL lane (Lane A), the participant side.

`mt-eval contest submit-model` packages a neural-MT model as DATA — safetensors
weights + a declarative tokenizer + a config naming a whitelisted architecture —
and proposes it against a contest's sealed set. Unlike the sandbox lane
(method_bundle.py + sandbox_runner.py), there is NO Dockerfile and NO entrypoint
code: the organizer runs the weights in its OWN trusted inference engine, so no
participant code ever executes (model_runner.py). That makes the organizer's
malice check a DECIDABLE format validation instead of the undecidable "is this
code safe?" the sandbox lane can only heuristically approximate.

Bundle layout (files at the ROOT, the shape `from_pretrained(dir)` expects):

    model-submission.tar.gz
    ├── manifest.json            # submissionKind = "declarative-model"
    ├── config.json              # architectures: [<whitelisted>], no auto_map
    ├── model.safetensors        # pure tensors — NEVER pickle (.bin/.pt)
    ├── tokenizer.json           # or sentencepiece .model + vocab/merges
    ├── tokenizer_config.json    # no auto_map / trust_remote_code
    └── generation_config.json   # whitelisted decoding params only (optional)

Everything else this lane shares with the sandbox lane unchanged: the
deterministic tarball → method_sha → 038 request fingerprint (bound to the
organizer node + corpus version), the T1-standing gate, the authorization /
grant / audit chain, and the aggregates-only scores-only publish.
"""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import tarfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from mt_eval_harness.config import (
    DEFAULT_PARADIGM,
    VALID_METHOD_CLASSES,
    VALID_PARADIGMS,
)
from mt_eval_harness.method_bundle import (
    CURRENT_AGREEMENT_VERSION,
    MethodBundleError,
    TARBALL_LIMIT_BYTES,
)

SUBMISSION_KIND = "declarative-model"
CURRENT_MODEL_SUBMISSION_VERSION = "1.0.0"

# The declarative lane runs a neural seq2seq engine; only neural-nmt models fit
# "weights + tokenizer + config, run by a trusted engine". Other paradigms
# (pipelines, coached-LLM, rule-based decoders) are code and belong in the
# sandbox lane or the hypotheses lane.
DECLARATIVE_PARADIGMS = frozenset({"neural-nmt"})


class ModelBundleError(RuntimeError):
    """A declarative-model submission that cannot proceed — with the reason."""


# ---------------------------------------------------------------------------
# Manifest (the model block is the declarative extension).
# ---------------------------------------------------------------------------

def build_declarative_manifest(
    *,
    method_name: str,
    method_version: str,
    method_class: str,
    paradigm: str = "neural-nmt",
    description: str = "",
    developer_name: str,
    developer_email: str,
    affiliation: str = "",
    agreement_signed: bool,
    corpus_id: str,
    source_lang: str,
    target_lang: str,
    weights_file: str = "model.safetensors",
    config_file: str = "config.json",
    architecture: str,
    src_lang_token: str | None = None,
    tgt_lang_token: str | None = None,
    generation: dict | None = None,
) -> dict:
    """Assemble a declarative-model manifest. Refuses anything the consistency
    check would block. ``agreement_signed`` must be explicitly True."""
    manifest = {
        "submissionVersion": CURRENT_MODEL_SUBMISSION_VERSION,
        "submissionKind": SUBMISSION_KIND,
        "method": {
            "name": method_name,
            "version": method_version,
            "description": description,
            "class": method_class,
            "paradigm": paradigm or DEFAULT_PARADIGM,
        },
        "developer": {
            "name": developer_name,
            "email": developer_email,
            "affiliation": affiliation,
            "agreementSigned": bool(agreement_signed),
            "agreementVersion": CURRENT_AGREEMENT_VERSION,
        },
        "target": {
            "corpusId": corpus_id,
            "languagePair": {"source": source_lang, "target": target_lang},
        },
        "model": {
            "weightsFile": weights_file,
            "configFile": config_file,
            "architecture": architecture,
            "srcLang": src_lang_token,
            "tgtLang": tgt_lang_token,
            "generation": dict(generation or {}),
        },
        "selfHostable": True,
        "networkRequired": False,
        "thirdPartyAPIs": [],
    }
    problems = manifest_declarative_findings(manifest)
    if problems:
        raise ModelBundleError(
            "Declarative manifest would be blocked by the organizer's "
            "validation:\n    " + "\n    ".join(p["detail"] for p in problems))
    return manifest


def manifest_declarative_findings(
    manifest: dict, *,
    bundle_dir: Path | None = None,
    expected_corpus_id: str | None = None,
) -> list[dict]:
    """SSOT consistency check for a declarative-model manifest — run by the
    participant CLI pre-upload AND by the organizer node
    (model_runner.validate_declarative_bundle). Returns BLOCK finding dicts;
    empty = pass. The file-level, safetensors, and architecture-whitelist
    checks live in model_runner (they need the actual files); this covers the
    manifest's own shape."""
    f: list[dict] = []

    def block(detail: str) -> None:
        f.append({"check": "manifest", "severity": "BLOCK",
                  "category": "declarative", "detail": detail})

    if not isinstance(manifest, dict):
        block("manifest.json is not a JSON object.")
        return f
    if manifest.get("submissionKind") != SUBMISSION_KIND:
        block(f"submissionKind must be {SUBMISSION_KIND!r} for the declarative "
              f"lane (got {manifest.get('submissionKind')!r}).")
    if manifest.get("submissionVersion") != CURRENT_MODEL_SUBMISSION_VERSION:
        block(f"submissionVersion must be {CURRENT_MODEL_SUBMISSION_VERSION!r} "
              f"(got {manifest.get('submissionVersion')!r}).")

    method = manifest.get("method") or {}
    for key in ("name", "version"):
        if not str(method.get(key) or "").strip():
            block(f"method.{key} is required.")
    if method.get("class") not in VALID_METHOD_CLASSES:
        block(f"method.class {method.get('class')!r} is not in the canonical "
              f"vocabulary {sorted(VALID_METHOD_CLASSES)}.")
    paradigm = method.get("paradigm")
    if paradigm not in VALID_PARADIGMS:
        block(f"method.paradigm {paradigm!r} is not in the canonical "
              f"vocabulary {sorted(VALID_PARADIGMS)}.")
    elif paradigm not in DECLARATIVE_PARADIGMS:
        block(f"method.paradigm {paradigm!r} is not runnable declaratively — "
              f"the declarative lane runs a neural seq2seq engine "
              f"({sorted(DECLARATIVE_PARADIGMS)}). A code method (pipeline, "
              f"coached-llm, rule-based decoder) uses the sandbox lane.")

    dev = manifest.get("developer") or {}
    if dev.get("agreementSigned") is not True:
        block("developer.agreementSigned must be true (--agree).")
    if dev.get("agreementVersion") != CURRENT_AGREEMENT_VERSION:
        block(f"developer.agreementVersion must be "
              f"{CURRENT_AGREEMENT_VERSION!r} (got "
              f"{dev.get('agreementVersion')!r}).")
    if not str(dev.get("email") or "").strip():
        block("developer.email is required (the T1-standing identity).")

    if manifest.get("networkRequired") is not False:
        block("networkRequired must be false — the trusted engine runs offline.")
    if manifest.get("thirdPartyAPIs") != []:
        block("thirdPartyAPIs must be an empty list.")
    if manifest.get("selfHostable") is not True:
        block("selfHostable must be true.")

    target = manifest.get("target") or {}
    if not str(target.get("corpusId") or "").strip():
        block("target.corpusId is required (the sealed set proposed against).")
    elif expected_corpus_id and target["corpusId"] != expected_corpus_id:
        block(f"target.corpusId {target['corpusId']!r} does not match the "
              f"contest's secret set {expected_corpus_id!r}.")

    model = manifest.get("model") or {}
    weights = str(model.get("weightsFile") or "").strip()
    if not weights:
        block("model.weightsFile is required (the .safetensors weights).")
    elif not weights.endswith(".safetensors"):
        block(f"model.weightsFile {weights!r} must be .safetensors — PyTorch "
              f"pickle checkpoints (.bin/.pt/.pth/.ckpt) are refused.")
    elif ".." in Path(weights).parts or Path(weights).is_absolute():
        block(f"model.weightsFile {weights!r} must be a plain relative name.")
    if not str(model.get("architecture") or "").strip():
        block("model.architecture is required (the whitelisted architecture "
              "the trusted engine loads).")
    gen = model.get("generation")
    if gen is not None and not isinstance(gen, dict):
        block("model.generation must be an object of decoding parameters.")

    return f


# ---------------------------------------------------------------------------
# Deterministic packing — same discipline as method_bundle (stable method_sha).
# ---------------------------------------------------------------------------

def _write_deterministic_tar(members: list[tuple[str, bytes | Path]],
                             out_path: Path) -> bytes:
    """Byte-stable gzip tar: sorted members, zeroed mtimes/ownership, fixed
    modes, zeroed gzip timestamp. Same inputs => identical bytes => same sha."""
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode="w") as tar:
            for arcname, src in sorted(members, key=lambda m: m[0]):
                info = tarfile.TarInfo(arcname)
                info.mtime = 0
                info.uid = info.gid = 0
                info.uname = info.gname = ""
                if isinstance(src, bytes):
                    info.size = len(src)
                    info.mode = 0o644
                    tar.addfile(info, io.BytesIO(src))
                else:
                    info.size = src.stat().st_size
                    info.mode = 0o644
                    with open(src, "rb") as fh:
                        tar.addfile(info, fh)
    data = buf.getvalue()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(data)
    return data


def build_model_bundle(*, model_dir: str | Path, manifest: dict,
                       out_path: str | Path) -> dict:
    """Pack a declarative model dir (weights + tokenizer + config, at the ROOT)
    + manifest.json into a deterministic tarball. Returns {path, method_sha,
    size_bytes, files}."""
    model_dir = Path(model_dir)
    out_path = Path(out_path)
    if not model_dir.is_dir():
        raise ModelBundleError(f"--model-dir is not a directory: {model_dir}")

    problems = manifest_declarative_findings(manifest)
    if problems:
        raise ModelBundleError(
            "Refusing to pack a manifest the validation would block:\n    "
            + "\n    ".join(p["detail"] for p in problems))

    pairs: list[tuple[str, Path]] = []
    for p in sorted(model_dir.rglob("*")):
        if p.is_symlink():
            raise ModelBundleError(
                f"Symlink in model dir: {p} — bundles are plain files only.")
        if p.is_file():
            pairs.append((p.relative_to(model_dir).as_posix(), p))
    if not pairs:
        raise ModelBundleError(f"model dir is empty: {model_dir}")

    weights = str((manifest.get("model") or {}).get("weightsFile") or "")
    arcnames = {a for a, _ in pairs}
    if weights not in arcnames:
        raise ModelBundleError(
            f"model.weightsFile {weights!r} is not among the packed files.")

    total_in = sum(p.stat().st_size for _, p in pairs)
    if total_in > TARBALL_LIMIT_BYTES:
        raise ModelBundleError(
            f"Model inputs total {total_in} bytes — over the "
            f"{TARBALL_LIMIT_BYTES}-byte limit.")

    manifest_bytes = json.dumps(
        manifest, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8")
    members: list[tuple[str, bytes | Path]] = [
        ("manifest.json", manifest_bytes)] + pairs  # type: ignore[list-item]
    data = _write_deterministic_tar(members, out_path)
    if len(data) > TARBALL_LIMIT_BYTES:
        raise ModelBundleError(
            f"Model tarball is {len(data)} bytes — over the "
            f"{TARBALL_LIMIT_BYTES}-byte limit.")
    return {
        "path": str(out_path),
        "method_sha": hashlib.sha256(data).hexdigest(),
        "size_bytes": len(data),
        "files": len(pairs) + 1,
    }


# ---------------------------------------------------------------------------
# The submission flow (mirrors method_bundle.submit_method; declarative bundle).
# ---------------------------------------------------------------------------

def submit_model(
    *,
    contest_id: str,
    model_dir: str | Path,
    method_name: str,
    method_version: str,
    method_class: str,
    architecture: str,
    paradigm: str = "neural-nmt",
    description: str = "",
    developer_name: str,
    developer_email: str | None = None,
    affiliation: str = "",
    agree: bool = False,
    node_id: str,
    corpus_version: str = "v1",
    secret_set_id: str | None = None,
    weights_file: str = "model.safetensors",
    config_file: str = "config.json",
    src_lang_token: str | None = None,
    tgt_lang_token: str | None = None,
    generation: dict | None = None,
    language_pair: str | None = None,
    bundle_out: str | Path | None = None,
    offline: bool = False,
    scratch_dir: str | Path | None = None,
) -> dict:
    """Package + pre-flight + propose a declarative-model execution. Mirrors
    method_bundle.submit_method: same T1-standing gate, same fingerprint, same
    authorization request — only the bundle contents and lane differ."""
    from mt_eval_harness.contest import _api_request
    from mt_eval_harness.contest_intake import (
        IntakeError,
        _storage_upload,
        fetch_contest_bundle,
    )
    from mt_eval_harness.method_bundle import (
        _submitter_email,
        check_t1_standing,
        resolve_secret_set,
    )
    from mt_eval_harness.auth import get_session
    from mt_eval_harness.queue_runner import compute_request_fingerprint

    if not agree:
        raise ModelBundleError(
            "Submitting a model means agreeing to the method-submission terms "
            f"(version {CURRENT_AGREEMENT_VERSION}). Pass --agree.")
    if not node_id or not node_id.strip():
        raise ModelBundleError(
            "--node-id is required (binds the request to the organizer's node).")

    session = None
    submitter = None
    contest = None
    if offline:
        if not bundle_out:
            raise ModelBundleError("--offline needs --bundle-out <dir>.")
        if not secret_set_id:
            raise ModelBundleError("--offline needs --secret-set.")
        if not developer_email:
            raise ModelBundleError("--offline needs --developer-email.")
    else:
        session = get_session()
        submitter = _submitter_email(session)
        if developer_email and developer_email.strip() != submitter:
            raise ModelBundleError(
                f"--developer-email {developer_email!r} does not match your "
                f"authenticated identity {submitter!r}.")
        developer_email = submitter
        info = fetch_contest_bundle(contest_id)
        contest, qualifier = info["contest"], info["qualifier"]
        secret = resolve_secret_set(contest, qualifier, secret_set_id)
        secret_set_id = secret["sealed_set_id"]
        if not check_t1_standing(contest_id, session):
            raise IntakeError(
                f"No PUBLISHED hypotheses-lane record for {submitter!r} in "
                f"contest {contest_id!r} — the model lane is gated on T1 "
                f"standing (submit-hypotheses and clear the qualifier first).")

    pair = (contest or {}).get("language_pair") or language_pair or ">"
    src, _, tgt = pair.partition(">")
    manifest = build_declarative_manifest(
        method_name=method_name, method_version=method_version,
        method_class=method_class, paradigm=paradigm, description=description,
        developer_name=developer_name, developer_email=developer_email,
        affiliation=affiliation, agreement_signed=True,
        corpus_id=secret_set_id, source_lang=src or "source",
        target_lang=tgt or "target", weights_file=weights_file,
        config_file=config_file, architecture=architecture,
        src_lang_token=src_lang_token, tgt_lang_token=tgt_lang_token,
        generation=generation)

    # Pre-flight: run the organizer's OWN validation locally (instant refusal).
    from mt_eval_harness.model_runner import validate_declarative_bundle
    scratch = Path(scratch_dir) if scratch_dir else (
        Path.home() / ".mt-eval" / "model-scratch")
    request_id = f"authreq-{uuid.uuid4().hex}"
    stage = scratch / request_id
    stage.mkdir(parents=True, exist_ok=True)
    built = build_model_bundle(
        model_dir=model_dir, manifest=manifest,
        out_path=stage / "bundle.tar.gz")
    # Extract to a peer dir and validate exactly as the node will.
    check_dir = stage / "bundle"
    import tarfile as _tf
    with _tf.open(built["path"], "r:gz") as t:
        t.extractall(check_dir, filter="data")
    checks = validate_declarative_bundle(check_dir, expected_corpus_id=secret_set_id)
    for w in checks["warns"]:
        print(f"  ⚠ {w['detail']}")
    if checks["blocked"]:
        raise ModelBundleError(
            "The organizer's declarative validation would BLOCK this bundle — "
            "refusing to submit:\n    "
            + "\n    ".join(b["detail"] for b in checks["blocks"]))

    method_sha = built["method_sha"]
    fingerprint = compute_request_fingerprint(
        {"method_sha": method_sha, "corpus_id": secret_set_id,
         "corpus_version": corpus_version},
        node_measurement=node_id.strip())
    request_row = {
        "request_id": request_id, "sealed_set_id": secret_set_id,
        "state": "pending", "fingerprint": fingerprint,
        "method_sha": method_sha, "corpus_id": secret_set_id,
        "corpus_version": corpus_version, "node_measurement": node_id.strip(),
        "requested_by": developer_email,
    }
    out: dict = {"request_id": request_id, "method_sha": method_sha,
                 "fingerprint": fingerprint, "manifest": manifest,
                 "lane": SUBMISSION_KIND}

    if bundle_out:
        dest = Path(bundle_out) / "requests" / request_id
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "method.tar.gz").write_bytes(Path(built["path"]).read_bytes())
        (dest / "request.json").write_text(json.dumps({
            "exchange_version": "1",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "contest_id": contest_id, "request": request_row,
            "_note": "Declarative-model proposal (Lane A). The organizer "
                     "validates it is code-free and runs the weights in its "
                     "own trusted engine; scores-only leave.",
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        out["bundle_dir"] = str(dest)
        print(f"  ✓ Sneakernet declarative bundle written: {dest}")

    if not offline:
        object_path = f"{contest_id}/{submitter}/{request_id}.tar.gz"
        _storage_upload(session, object_path,
                        Path(built["path"]).read_bytes())
        created = _api_request("POST", "authorization_requests",
                               data=request_row, session=session)
        out["storage_path"] = object_path
        out["record"] = created[0] if isinstance(created, list) else created
        print(f"\n  ✅ Declarative model proposed: {request_id}")
        print(f"     method_sha  {method_sha}")
        print(f"     architecture {architecture} (code-free; no sandbox needed)")
        print(f"     Track it: mt-eval contest method-status {request_id}")
    else:
        print(f"\n  ✅ Offline declarative proposal packaged: {request_id}")
    return out
