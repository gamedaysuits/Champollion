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
organizer node + corpus version), the qualifier-receipt admission gate, the
authorization / grant / audit chain, and the aggregates-only scores-only
publish.

Lane A carries one declaration the host can CHECK: ``constraints.parameterCount``
is re-derived from the safetensors header (model_runner.parameter_count_from_header)
and a claim off by more than one percent is BLOCKED — here, before upload, and
again on the node. Every other declaration (track, weights licence, weights
public, training data) is an unverifiable participant claim, recorded as one.
"""

from __future__ import annotations

import gzip
import hashlib
import shlex
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
from mt_eval_harness.contest_declarations import (
    build_constraints_block,
    build_submission_block,
    constraints_findings,
    qualifier_block_from_receipt,
)
from mt_eval_harness.qualifier_gate import threshold_phrase
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
    constraints: dict,
    submission: dict,
    qualifier: dict,
    weights_file: str = "model.safetensors",
    config_file: str = "config.json",
    architecture: str,
    src_lang_token: str | None = None,
    tgt_lang_token: str | None = None,
    generation: dict | None = None,
) -> dict:
    """Assemble a declarative-model manifest. Refuses anything the consistency
    check would block. ``agreement_signed`` must be explicitly True.

    ``constraints`` / ``submission`` / ``qualifier`` are REQUIRED with no
    defaults (contract C2) — see contest_declarations."""
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
        "constraints": dict(constraints),
        "submission": dict(submission),
        "qualifier": dict(qualifier),
    }
    problems = (manifest_declarative_findings(manifest)
                + constraints_findings(manifest))
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
        block("developer.email is required (the identity 045 binds "
              "requested_by to).")

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
# Was the qualifier receipt earned by the weights being submitted?
# ---------------------------------------------------------------------------

def receipt_model_check(receipt: dict, model_dir: str | Path,
                        weights_file: str) -> tuple[str | None, str | None]:
    """``(refusal, note)`` for submitting ``model_dir`` under ``receipt``.

    A receipt minted from a `--method local-model -m <dir>` run log names
    that directory's files by sha256 (contest_qualify.receipt_run_block). If
    the weights being packed are not among them, the receipt was earned by
    another model: refused, with both hashes named. That is exactly the
    Round 10 case — the receipt came from a run of a substituted model, and
    only the node's re-execution exposed it. Anything that cannot be told
    here (a plain hypotheses file, a hub model, a plugin or LLM run) is a
    note: the node's re-execution of these weights is the check."""
    run = (receipt or {}).get("run")
    if not run:
        return None, ("the qualifier receipt names no model (it was scored "
                      "from a hypotheses file, or written before receipts "
                      "recorded the run) — the node re-executes THESE "
                      "weights on the dev set, and a gap between its score "
                      "and the receipt's is shown to the custodian.")
    engine = run.get("engineModel") or {}
    shas = {f.get("sha256") for f in engine.get("files") or []
            if isinstance(f, dict)}
    if shas:
        weights = Path(model_dir) / weights_file
        if not weights.is_file():
            return None, None   # the bundle validation names the missing file
        from mt_eval_harness.external_scoring import sha256_file
        have = sha256_file(weights)
        if have not in shas:
            return (f"the qualifier receipt was earned by the model "
                    f"directory {engine.get('id')!r} (sha256 "
                    f"{str(engine.get('sha256'))[:12]}… over its files), "
                    f"and the weights you are submitting — {weights_file}, "
                    f"sha256 {have[:12]}… — are not among its files. A "
                    f"receipt admits the model that earned it. Qualify these "
                    f"weights: `mt-eval run --corpus <the dev corpus> "
                    f"--method local-model -m {shlex.quote(str(model_dir))}`, "
                    f"then `mt-eval "
                    f"contest qualify ... --dev <that run log>`."), None
        return None, None
    if engine:
        return None, (f"the qualifier receipt was earned by the hub model "
                      f"{engine.get('id')} — whether these weights are that "
                      f"model cannot be checked here; the node's "
                      f"re-execution of them is the check.")
    return None, (f"the qualifier receipt was earned by {run.get('system')}"
                  + (f" (model {run['model']})" if run.get("model") else "")
                  + ", not by a model directory — the node re-executes THESE "
                    "weights, and a gap between its score and the receipt's "
                    "is shown to the custodian.")


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


#: Suffixes the node allows that also name arbitrary documents (a
#: forge-model.json, notes.txt): packed only under a name below.
NAMED_ONLY_SUFFIXES = frozenset({".json", ".txt"})

#: The .json / .txt files ``from_pretrained(dir)`` reads for a seq2seq text
#: model (config, generation config, tokenizer files, a sharded-weights index).
TRANSFORMERS_NAMED_FILES = frozenset({
    "config.json", "generation_config.json",
    "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json",
    "added_tokens.json", "vocab.json", "merges.txt", "vocab.txt",
    "model.safetensors.index.json",
})


def declarative_model_files(model_dir: str | Path
                            ) -> tuple[list[tuple[str, Path]], list[str]]:
    """``(packed, left_out)`` for a model directory: the files the
    declarative lane runs, and everything else, by name.

    Packed: the regular files at the directory's ROOT (the shape
    ``from_pretrained(dir)`` reads) whose suffix or name is on the node's
    data whitelist (model_runner.ALLOWED_FILE_SUFFIXES /
    ALLOWED_NOSUFFIX_NAMES) — weights, config, tokenizer, generation config.
    Left out: subdirectories, other files (a README or DEPLOY.md, a plugin
    folder, pickle checkpoints beside the safetensors), and a
    ``manifest.json`` (the bundle's manifest is the one submit-model writes).

    A deployable folder legitimately carries documentation; packing the
    whole folder made submit-model refuse its own package because the node
    allows data files only — an nmt-forge export's model/ folder, with its
    DEPLOY.md and champollion-plugin/, could not be submitted as written
    (synthetic researcher, Round 10). The node's whitelist is unchanged: a
    bundle that carries a non-data file is still refused there."""
    from mt_eval_harness.model_runner import (
        ALLOWED_FILE_SUFFIXES,
        ALLOWED_NOSUFFIX_NAMES,
    )
    model_dir = Path(model_dir)
    # .json and .txt are packed only under the names transformers reads: an
    # nmt-forge export keeps forge-model.json at the same root — the model's
    # scores on the entrant's PRIVATE test set and local paths — and the
    # suffix whitelist alone packed and sent it to the contest host (found
    # reviewing the Round 10 fix). Weights and sentencepiece files keep
    # their suffix rule.
    packed: list[tuple[str, Path]] = []
    left_out: list[str] = []
    for p in sorted(model_dir.iterdir(), key=lambda q: q.name):
        if p.is_symlink():
            raise ModelBundleError(
                f"Symlink in model dir: {p} — bundles are plain files only.")
        if p.is_dir():
            n = sum(1 for q in p.rglob("*") if q.is_file())
            left_out.append(f"{p.name}/ ({n} file{'s' if n != 1 else ''})")
            continue
        if not p.is_file():
            continue
        suffix = p.suffix.lower()
        if suffix in NAMED_ONLY_SUFFIXES:
            data = p.name in TRANSFORMERS_NAMED_FILES
        else:
            data = (suffix in ALLOWED_FILE_SUFFIXES
                    or p.name in ALLOWED_NOSUFFIX_NAMES)
        if data and p.name != "manifest.json":
            packed.append((p.name, p))
        else:
            left_out.append(p.name)
    return packed, left_out


def build_model_bundle(*, model_dir: str | Path, manifest: dict,
                       out_path: str | Path,
                       select_declarative: bool = False) -> dict:
    """Pack a declarative model dir (weights + tokenizer + config, at the ROOT)
    + manifest.json into a deterministic tarball. Returns {path, method_sha,
    size_bytes, files, left_out}.

    ``select_declarative`` (submit-model, contest validate) packs only what
    :func:`declarative_model_files` selects and reports the rest in
    ``left_out``; without it every file under the directory is packed as
    given (the node's validation then judges each one)."""
    model_dir = Path(model_dir)
    out_path = Path(out_path)
    if not model_dir.is_dir():
        raise ModelBundleError(f"--model-dir is not a directory: {model_dir}")

    problems = (manifest_declarative_findings(manifest)
                + constraints_findings(manifest))
    if problems:
        raise ModelBundleError(
            "Refusing to pack a manifest the validation would block:\n    "
            + "\n    ".join(p["detail"] for p in problems))

    left_out: list[str] = []
    if select_declarative:
        pairs, left_out = declarative_model_files(model_dir)
    else:
        pairs = []
        for p in sorted(model_dir.rglob("*")):
            if p.is_symlink():
                raise ModelBundleError(
                    f"Symlink in model dir: {p} — bundles are plain files only.")
            if p.is_file():
                pairs.append((p.relative_to(model_dir).as_posix(), p))
    if not pairs:
        raise ModelBundleError(
            f"model dir has no model files: {model_dir}"
            + (f" (left out: {', '.join(left_out)})" if left_out else ""))

    weights = str((manifest.get("model") or {}).get("weightsFile") or "")
    arcnames = {a for a, _ in pairs}
    if weights not in arcnames:
        raise ModelBundleError(
            f"model.weightsFile {weights!r} is not among the packed files"
            + (f" (packed: {', '.join(sorted(arcnames))}; left out: "
               f"{', '.join(left_out)})" if select_declarative else "")
            + ". Lane A needs the weights as .safetensors at the directory's "
              "root — name another file with --weights-file, or convert a "
              "PyTorch checkpoint to safetensors.")

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
        "packed": sorted(a for a, _ in pairs),
        "left_out": left_out,
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
    track: str,
    parameter_count: int,
    weights_license: str,
    weights_public: bool,
    training_data: str = "",
    is_primary: bool = True,
    submission_description: str = "",
    method_release_url: str | None = None,
    accept_terms: str | None = None,
    receipt_dir: str | Path | None = None,
    system: str | None = None,
    offline_threshold: float | None = None,
    offline_qualifier_id: str | None = None,
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
    method_bundle.submit_method: same qualifier-receipt gate, same fingerprint,
    same authorization request — only the bundle contents and lane differ, plus
    the parameter-count cross-check this lane can actually do."""
    from mt_eval_harness.contest import _api_request
    from mt_eval_harness.contest_intake import (
        _storage_upload,
        fetch_contest_bundle,
    )
    from mt_eval_harness.method_bundle import (
        _submitter_email,
        contest_requires_description,
        require_qualifier_receipt,
        resolve_accepted_terms,
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
        if not offline_qualifier_id or offline_threshold is None:
            raise ModelBundleError(
                "--offline needs --offline-qualifier-id and "
                "--offline-threshold (published with the contest materials) — "
                "with no connection there is nothing to check the qualifier "
                "receipt against.")
        qualifier_id = offline_qualifier_id
        threshold = offline_threshold
        # Offline there is no contest row to read the terms from: the hash is
        # taken on trust and re-checked when the organizer imports the bundle.
        accepted_terms_sha = (accept_terms.strip().lower()
                              if accept_terms else None)
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
        qualifier_id = qualifier["qualifier_id"]
        threshold = qualifier["threshold"]
        if (contest_requires_description(contest_id, session)
                and not submission_description.strip()):
            raise ModelBundleError(
                f"Contest {contest_id!r} requires a system description with "
                f"every entry (metadata.require_description) — pass "
                f"--description-file with how the model was built.")
        accepted_terms_sha = resolve_accepted_terms(
            contest_id, accept_terms, session)

    receipt = require_qualifier_receipt(
        contest_id, qualifier_id=qualifier_id, threshold=threshold,
        receipt_dir=receipt_dir, system=system, name_hint=method_name)
    print(f"  ✓ Qualifier receipt: {receipt.get('score')} ≥ "
          f"{threshold_phrase(receipt.get('threshold'))} on {qualifier_id} "
          f"(self-scored; the node re-executes on the same dev set)")
    # Was the receipt earned by THESE weights? Refused when the receipt's
    # run names a model directory whose files do not include the weights
    # being packed; said, not refused, when it cannot be told here.
    refusal, note = receipt_model_check(receipt, model_dir, weights_file)
    if refusal:
        raise ModelBundleError(refusal)
    if note:
        print(f"  ⚠ {note}")

    pair = (contest or {}).get("language_pair") or language_pair or ">"
    from mt_eval_harness.pair_notation import split_pair
    src, tgt = split_pair(pair)
    manifest = build_declarative_manifest(
        method_name=method_name, method_version=method_version,
        method_class=method_class, paradigm=paradigm, description=description,
        developer_name=developer_name, developer_email=developer_email,
        affiliation=affiliation, agreement_signed=True,
        corpus_id=secret_set_id, source_lang=src or "source",
        target_lang=tgt or "target", weights_file=weights_file,
        config_file=config_file, architecture=architecture,
        src_lang_token=src_lang_token, tgt_lang_token=tgt_lang_token,
        generation=generation,
        constraints=build_constraints_block(
            track=track, parameter_count=parameter_count,
            weights_license=weights_license, weights_public=weights_public,
            training_data=training_data),
        submission=build_submission_block(
            is_primary=is_primary, description=submission_description,
            method_release_url=method_release_url,
            accepted_prize_terms_sha256=accepted_terms_sha),
        qualifier=qualifier_block_from_receipt(receipt))

    # How long the node lets this model's outputs be (decode_length — the same
    # rule `mt-eval run --method local-model` decodes with): written into the
    # manifest so the entrant sees it before submitting, and recorded again
    # by the node from the bundle itself (it never takes this on trust). An
    # entry used to learn nothing about it, and the node decoded with
    # transformers' default of 20 tokens (Round 10).
    from mt_eval_harness import decode_length as _dl
    _declared = _dl.declared_length(
        ("the manifest's model.generation", generation or {}),
        ("generation_config.json", _dl.read_generation_config(model_dir)))
    manifest["model"]["decodeLength"] = _dl.describe(
        _declared, positions=_dl.max_positions(model_dir))
    print(f"  ✓ Decode length on the node: "
          f"{_dl.summary(manifest['model']['decodeLength'])}")

    # Pre-flight: run the organizer's OWN validation locally (instant refusal).
    from mt_eval_harness.model_runner import validate_declarative_bundle
    scratch = Path(scratch_dir) if scratch_dir else (
        Path.home() / ".mt-eval" / "model-scratch")
    request_id = f"authreq-{uuid.uuid4().hex}"
    stage = scratch / request_id
    stage.mkdir(parents=True, exist_ok=True)
    built = build_model_bundle(
        model_dir=model_dir, manifest=manifest,
        out_path=stage / "bundle.tar.gz", select_declarative=True)
    print(f"  ✓ Packed {len(built['packed'])} model file(s): "
          f"{', '.join(built['packed'])}")
    if built["left_out"]:
        print(f"    Left out (not part of the model the node runs): "
              f"{', '.join(built['left_out'])}")
    # Extract to a peer dir and validate exactly as the node will.
    check_dir = stage / "bundle"
    import tarfile as _tf
    with _tf.open(built["path"], "r:gz") as t:
        t.extractall(check_dir, filter="data")
    checks = validate_declarative_bundle(check_dir, expected_corpus_id=secret_set_id)
    for w in checks["warns"]:
        print(f"  ⚠ {w['detail']}")
    # validate_declarative_bundle already runs contest_declarations
    # .constraints_findings over this bundle (Lane A's C2 check, added with
    # the declarations lane). Calling it again here listed every declaration
    # block twice in the refusal.
    blocks = list(checks["blocks"])
    if blocks:
        raise ModelBundleError(
            "The organizer's declarative validation would BLOCK this bundle — "
            "refusing to submit:\n    "
            + "\n    ".join(b["detail"] for b in blocks))

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
        # The exchange FORMAT version is one constant, read from the module
        # that defines and checks it — a hardcoded "1" here would be refused
        # by an up-to-date node's import (which fails loud by name rather than
        # half-reading a bundle of the wrong version). Lazy import:
        # airgap_transport imports sandbox_runner, which imports this module.
        from mt_eval_harness.airgap_transport import EXCHANGE_VERSION
        (dest / "request.json").write_text(json.dumps({
            "exchange_version": EXCHANGE_VERSION,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "contest_id": contest_id, "request": request_row,
            # No relay wrote this, so it carries no qualifier row and no dev
            # corpus; the node says out loud that it could not measure the
            # public gate (and these scores are never relay-publishable).
            "origin": "submit-model",
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
