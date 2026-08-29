"""method_bundle — the T2 METHOD-EXECUTION lane's participant side (Phase B).

`mt-eval contest submit-method` packages a RUNNABLE method — code, weights,
config, Dockerfile — per arena/docs/sandbox-evaluation-spec.md §2, and proposes
its execution against a contest's FULLY-SECRET set (source AND references
sealed; participants never see either). The organizer runs the bundle inside a
network-isolated sandbox on their own machine (sandbox_runner.py) and only
scores leave (spec §9).

What "submit" means in this lane (it is a PROPOSAL, not an upload-and-score):

  1. Pre-flight, locally and instantly: the SAME static checks the organizer
     node will run (spec §3 — manifest consistency here, network-call scan +
     filesystem audit + size limits in sandbox_runner). A bundle that would be
     blocked is refused before any byte leaves the machine.
  2. T1 standing (plan B1 gate): the submitter must already hold a PUBLISHED
     hypotheses-lane record for this contest (contest_intake.status =
     'published'). The check here is a courtesy preview — the ORGANIZER NODE
     re-checks its own records before any execution; its verdict gates.
  3. The bundle tarball is built DETERMINISTICALLY (sorted members, zeroed
     timestamps) so its sha256 — the ``method_sha`` — is stable and truly
     method-bound. That sha enters the 038 request fingerprint:
         method_sha \\n corpus_id \\n corpus_version \\n 'scores-only' \\n node_measurement
     For the first time in this pipeline, method_sha is the hash of the
     ACTUAL ARTIFACT that will run (the hypotheses lane could only bind the
     output file).
  4. The authorization_requests row is created BY THE PARTICIPANT with their
     own OAuth identity (migration 045 opens that door: born 'pending',
     requested_by = JWT email, emit pinned 'scores-only'; per-set daily rate
     limit + pending-dedup enforced beneath every client). Custodians decide
     via the unchanged `mt-eval node approve/deny`.
  5. Transport: the private contest-intake bucket (044 own-email-folder RLS),
     or ``--bundle-out <dir>`` writes a sneakernet exchange directory for
     true-airgap contests (`mt-eval node import-bundle`, airgap_transport.py).

node_measurement honesty: the fingerprint binds the request to the node that
will execute it, so the submitter must name the ORGANIZER-ADVERTISED node id
(--node-id; published with the contest materials). It is self-reported Wave-1
identity — no hardware attestation yet. A wrong node id fails CLOSED: the
node refuses (and explains) at run time, because its recomputed fingerprint
will not match the frozen request row.
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

from mt_eval_harness.auth import get_session
from mt_eval_harness.config import (
    DEFAULT_PARADIGM,
    VALID_METHOD_CLASSES,
    VALID_PARADIGMS,
)
from mt_eval_harness.contest import _api_request
from mt_eval_harness.contest_intake import (
    BUCKET,
    IntakeError,
    _storage_upload,
    fetch_contest_bundle,
)
from mt_eval_harness.queue_runner import compute_request_fingerprint

# Spec §2.1 submissionVersion this implementation writes and accepts.
CURRENT_SUBMISSION_VERSION = "1.0.0"

# The method-submission terms framework version (§3.5: agreementVersion must
# match). The framework text lives at arena/legal/method-submission-agreement.md;
# bump BOTH together.
CURRENT_AGREEMENT_VERSION = "1.0.0"

# Spec §3.4: tarball size limit.
TARBALL_LIMIT_BYTES = 100 * 2**30  # 100 GB


class MethodBundleError(RuntimeError):
    """A method submission that cannot proceed — always with the reason."""


# ---------------------------------------------------------------------------
# Manifest (spec §2.1 + the champollion method-identity extension).
# ---------------------------------------------------------------------------

def build_manifest(
    *,
    method_name: str,
    method_version: str,
    entrypoint: str,
    description: str = "",
    method_class: str,
    paradigm: str | None = None,
    developer_name: str,
    developer_email: str,
    affiliation: str = "",
    agreement_signed: bool,
    corpus_id: str,
    source_lang: str,
    target_lang: str,
    gpu: bool = False,
    gpu_memory_gb: int = 0,
    ram_gb: int = 8,
    disk_gb: int = 10,
    max_runtime_minutes: int = 120,
) -> dict:
    """Assemble a spec-§2.1 manifest. Refuses anything §3.5 would block.

    ``agreement_signed`` must be explicitly True (the CLI's --agree flag) —
    there is no silent default for signing a terms framework.
    """
    manifest = {
        "submissionVersion": CURRENT_SUBMISSION_VERSION,
        "method": {
            "name": method_name,
            "version": method_version,
            "entrypoint": entrypoint,
            "description": description,
            # champollion extension: the leaderboard's method-axis vocabulary
            # (method-card-spec). Validated below and again at scoring time.
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
        "requirements": {
            "gpu": bool(gpu),
            "gpuMemoryGB": int(gpu_memory_gb),
            "ramGB": int(ram_gb),
            "diskGB": int(disk_gb),
            "maxRuntimeMinutes": int(max_runtime_minutes),
        },
        "selfHostable": True,
        "networkRequired": False,
        "thirdPartyAPIs": [],
    }
    problems = manifest_consistency_findings(manifest)
    if problems:
        raise MethodBundleError(
            "Manifest would be blocked by the organizer's static checks "
            "(spec §3.5):\n    " + "\n    ".join(
                f["detail"] for f in problems))
    return manifest


def manifest_consistency_findings(
    manifest: dict,
    *,
    bundle_dir: Path | None = None,
    expected_corpus_id: str | None = None,
) -> list[dict]:
    """Spec §3.5 manifest-consistency check — the SSOT for both sides.

    The participant CLI runs it pre-upload (instant refusal); the organizer
    node runs it again inside sandbox_runner.run_static_checks (its verdict
    gates). Returns finding dicts ``{check, severity, detail}``; empty = pass.
    """
    f: list[dict] = []

    def block(detail: str) -> None:
        f.append({"check": "manifest", "severity": "BLOCK", "detail": detail})

    if not isinstance(manifest, dict):
        block("manifest.json is not a JSON object.")
        return f

    if manifest.get("submissionVersion") != CURRENT_SUBMISSION_VERSION:
        block(f"submissionVersion must be {CURRENT_SUBMISSION_VERSION!r} "
              f"(got {manifest.get('submissionVersion')!r}).")

    method = manifest.get("method") or {}
    for key in ("name", "version", "entrypoint"):
        if not str(method.get(key) or "").strip():
            block(f"method.{key} is required.")
    entrypoint = str(method.get("entrypoint") or "")
    if entrypoint:
        ep = Path(entrypoint)
        if ep.is_absolute() or ".." in ep.parts:
            block(f"method.entrypoint must be a plain relative path inside "
                  f"the bundle (got {entrypoint!r}).")
        elif not entrypoint.startswith("method/"):
            block(f"method.entrypoint must live under method/ "
                  f"(got {entrypoint!r}) — spec §2.")
        elif bundle_dir is not None and not (bundle_dir / ep).is_file():
            block(f"method.entrypoint {entrypoint!r} does not exist in the "
                  f"bundle.")
    method_class = method.get("class")
    if method_class not in VALID_METHOD_CLASSES:
        block(f"method.class {method_class!r} is not in the canonical "
              f"vocabulary {sorted(VALID_METHOD_CLASSES)}.")
    paradigm = method.get("paradigm")
    if paradigm not in VALID_PARADIGMS:
        block(f"method.paradigm {paradigm!r} is not in the canonical "
              f"vocabulary {sorted(VALID_PARADIGMS)}.")

    dev = manifest.get("developer") or {}
    if dev.get("agreementSigned") is not True:
        block("developer.agreementSigned must be true — the submission terms "
              "framework (arena/legal/method-submission-agreement.md) must be "
              "explicitly agreed to (--agree).")
    if dev.get("agreementVersion") != CURRENT_AGREEMENT_VERSION:
        block(f"developer.agreementVersion must be "
              f"{CURRENT_AGREEMENT_VERSION!r} (got "
              f"{dev.get('agreementVersion')!r}) — re-read and re-agree to "
              f"the current framework.")
    if not str(dev.get("email") or "").strip():
        block("developer.email is required (it is the submitter identity the "
              "organizer verifies T1 standing against).")

    if manifest.get("networkRequired") is not False:
        block("networkRequired must be false — the sandbox has NO network "
              "stack (spec §1); a method that needs one is inadmissible.")
    if manifest.get("thirdPartyAPIs") != []:
        block("thirdPartyAPIs must be an empty list — no external service "
              "exists inside the sandbox, and API-wrapper methods are "
              "inadmissible (spec §4.1).")
    if manifest.get("selfHostable") is not True:
        block("selfHostable must be true — the community must be able to run "
              "the method on its own infrastructure (community possession).")

    target = manifest.get("target") or {}
    if not str(target.get("corpusId") or "").strip():
        block("target.corpusId is required (the sealed set being proposed "
              "against).")
    elif expected_corpus_id and target["corpusId"] != expected_corpus_id:
        block(f"target.corpusId {target['corpusId']!r} does not match the "
              f"contest's secret set {expected_corpus_id!r}.")

    req = manifest.get("requirements") or {}
    for key in ("ramGB", "diskGB", "maxRuntimeMinutes"):
        try:
            if float(req.get(key, 0)) <= 0:
                block(f"requirements.{key} must be a positive number.")
        except (TypeError, ValueError):
            block(f"requirements.{key} must be a positive number "
                  f"(got {req.get(key)!r}).")

    return f


# ---------------------------------------------------------------------------
# Deterministic packing — method_sha is the bundle's identity.
# ---------------------------------------------------------------------------

def _iter_bundle_files(method_dir: Path, dockerfile: Path) -> list[tuple[str, Path]]:
    """(arcname, path) pairs for the §2 layout, deterministically sorted."""
    if not method_dir.is_dir():
        raise MethodBundleError(f"--method-dir is not a directory: {method_dir}")
    if not dockerfile.is_file():
        raise MethodBundleError(
            f"--dockerfile not found: {dockerfile}. The sandbox builds your "
            f"container with --network=none; a Dockerfile with all "
            f"dependencies vendored is required (spec §3.3).")
    pairs: list[tuple[str, Path]] = []
    for p in sorted(method_dir.rglob("*")):
        if p.is_symlink():
            raise MethodBundleError(
                f"Symlink in method dir: {p} — bundles must contain plain "
                f"files only (the organizer refuses non-file members).")
        if p.is_file():
            pairs.append((f"method/{p.relative_to(method_dir).as_posix()}", p))
    if not pairs:
        raise MethodBundleError(f"method dir is empty: {method_dir}")
    pairs.append(("Dockerfile", dockerfile))
    return pairs


def build_method_bundle(
    *,
    method_dir: str | Path,
    dockerfile: str | Path,
    manifest: dict,
    out_path: str | Path,
) -> dict:
    """Write the §2 tarball; return {path, method_sha, size_bytes, files}.

    Deterministic: same inputs => byte-identical tarball => same method_sha
    (sorted members, zeroed mtimes, fixed ownership, zeroed gzip timestamp).
    """
    method_dir = Path(method_dir)
    dockerfile = Path(dockerfile)
    out_path = Path(out_path)
    pairs = _iter_bundle_files(method_dir, dockerfile)

    entrypoint = str((manifest.get("method") or {}).get("entrypoint") or "")
    problems = manifest_consistency_findings(manifest)
    if problems:
        raise MethodBundleError(
            "Refusing to pack a manifest the static checks would block:\n    "
            + "\n    ".join(p["detail"] for p in problems))
    arcnames = {a for a, _ in pairs}
    if entrypoint not in arcnames:
        raise MethodBundleError(
            f"method.entrypoint {entrypoint!r} is not among the packed files "
            f"— it must exist under {method_dir}.")

    total_in = sum(p.stat().st_size for _, p in pairs)
    if total_in > TARBALL_LIMIT_BYTES:
        raise MethodBundleError(
            f"Bundle inputs total {total_in} bytes — over the "
            f"{TARBALL_LIMIT_BYTES}-byte tarball limit (spec §3.4).")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode="w") as tar:
            manifest_bytes = json.dumps(
                manifest, ensure_ascii=False, indent=2, sort_keys=True
            ).encode("utf-8")
            members: list[tuple[str, bytes | Path]] = (
                [("manifest.json", manifest_bytes)] + pairs)  # type: ignore[list-item]
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
                    info.mode = 0o755 if src.stat().st_mode & 0o100 else 0o644
                    with open(src, "rb") as fh:
                        tar.addfile(info, fh)
    data = buf.getvalue()
    if len(data) > TARBALL_LIMIT_BYTES:
        raise MethodBundleError(
            f"Bundle tarball is {len(data)} bytes — over the "
            f"{TARBALL_LIMIT_BYTES}-byte limit (spec §3.4).")
    out_path.write_bytes(data)
    return {
        "path": str(out_path),
        "method_sha": hashlib.sha256(data).hexdigest(),
        "size_bytes": len(data),
        "files": len(pairs) + 1,
    }


# ---------------------------------------------------------------------------
# Contest resolution + the T1-standing gate.
# ---------------------------------------------------------------------------

def resolve_secret_set(contest: dict, qualifier: dict,
                       secret_set_id: str | None = None) -> dict:
    """Find the contest's T2 fully-secret sealed set.

    The contest row's corpus_id is the T1 BLIND set; the T2 set is its sibling
    registration sharing the same active qualifier (contest_prep registers
    both). Ambiguity or absence fails loud; --secret-set disambiguates.
    """
    rows = _api_request(
        "GET", "sealed_sets",
        params={"current_qualifier_id": f"eq.{qualifier['qualifier_id']}",
                "status": "eq.active",
                "select": "sealed_set_id,ciphertext_digest,custodian_group_id,"
                          "language_pair,status"})
    rows = [r for r in (rows or []) if r["sealed_set_id"] != contest["corpus_id"]]
    if secret_set_id:
        match = [r for r in rows if r["sealed_set_id"] == secret_set_id]
        if not match:
            raise MethodBundleError(
                f"--secret-set {secret_set_id!r} is not an active sealed set "
                f"paired with this contest's qualifier "
                f"({qualifier['qualifier_id']}).")
        return match[0]
    if not rows:
        raise MethodBundleError(
            f"Contest {contest['id']!r} has no T2 fully-secret set registered "
            f"(only the blind set {contest['corpus_id']!r}). The method lane "
            f"needs a --secret-size split at `contest prepare` time — ask the "
            f"organizer.")
    if len(rows) > 1:
        raise MethodBundleError(
            "Multiple secret sets share this qualifier: "
            + ", ".join(r["sealed_set_id"] for r in rows)
            + " — pass --secret-set to pick one.")
    return rows[0]


def check_t1_standing(contest_id: str, session: dict) -> Optional[dict]:
    """The submitter's own PUBLISHED hypotheses record for this contest, or None.

    This is the plan-B1 gate: T2 execution effort is reserved for
    participants who already cleared the qualifier AND had a T1 run published.
    Preview only — the organizer node re-checks its own records (its verdict
    gates; see sandbox_runner.verify_t1_standing)."""
    rows = _api_request(
        "GET", "contest_intake",
        params={"contest_id": f"eq.{contest_id}",
                "status": "eq.published",
                "select": "intake_id,submitted_by,run_card_id,status"},
        session=session)
    email = _submitter_email(session)
    for r in rows or []:
        if r.get("submitted_by") == email:
            return r
    return None


def _submitter_email(session: dict) -> str:
    """The JWT email — the identity 044 (storage folder) and 045
    (requested_by) bind to. Fails loud when absent."""
    email = (session.get("user") or {}).get("email", "").strip()
    if not email:
        raise MethodBundleError(
            "Your session has no email claim — the storage and request "
            "policies bind to the JWT email. Re-authenticate (mt-eval login).")
    return email


# ---------------------------------------------------------------------------
# The submission flow.
# ---------------------------------------------------------------------------

def submit_method(
    *,
    contest_id: str,
    method_dir: str | Path,
    dockerfile: str | Path,
    method_name: str,
    method_version: str,
    entrypoint: str,
    method_class: str,
    paradigm: str | None = None,
    description: str = "",
    developer_name: str,
    developer_email: str | None = None,
    affiliation: str = "",
    agree: bool = False,
    node_id: str,
    corpus_version: str = "v1",
    secret_set_id: str | None = None,
    language_pair: str | None = None,
    bundle_out: str | Path | None = None,
    offline: bool = False,
    scratch_dir: str | Path | None = None,
) -> dict:
    """Package + pre-flight + propose a T2 method execution.

    Returns {request_id, method_sha, fingerprint, storage_path|bundle_dir}.
    ``offline=True`` builds the sneakernet exchange dir only (no Supabase at
    all) — the organizer imports it with `mt-eval node import-bundle`, which
    creates the request row service-side.
    """
    if not agree:
        raise MethodBundleError(
            "Submitting a method means agreeing to the method-submission "
            "terms framework (arena/legal/method-submission-agreement.md, "
            f"version {CURRENT_AGREEMENT_VERSION}). Pass --agree after "
            "reading it — there is no implicit signature.")
    if not node_id or not node_id.strip():
        raise MethodBundleError(
            "--node-id is required: the request fingerprint binds your "
            "method to the ORGANIZER'S node (advertised with the contest "
            "materials). A wrong id fails closed at run time.")

    session = None
    contest = qualifier = secret = None
    submitter = None
    if offline:
        if not bundle_out:
            raise MethodBundleError(
                "--offline needs --bundle-out <dir> — with no network there "
                "is nowhere else for the bundle to go.")
        if not secret_set_id:
            raise MethodBundleError(
                "--offline needs --secret-set (the sealed set id from the "
                "organizer's contest materials) — it cannot be looked up "
                "without a connection.")
    else:
        session = get_session()
        submitter = _submitter_email(session)
        if developer_email and developer_email.strip() != submitter:
            raise MethodBundleError(
                f"--developer-email {developer_email!r} does not match your "
                f"authenticated identity {submitter!r} — you propose as "
                f"yourself (045 binds requested_by to the JWT email).")
        developer_email = submitter
        info = fetch_contest_bundle(contest_id)
        contest, qualifier = info["contest"], info["qualifier"]
        secret = resolve_secret_set(contest, qualifier, secret_set_id)
        secret_set_id = secret["sealed_set_id"]
        standing = check_t1_standing(contest_id, session)
        if not standing:
            raise IntakeError(
                f"No PUBLISHED hypotheses-lane record for {submitter!r} in "
                f"contest {contest_id!r} — the method lane is gated on T1 "
                f"standing (clear the qualifier and get a hypotheses "
                f"submission published first: `mt-eval contest "
                f"submit-hypotheses`). The organizer node enforces the same "
                f"rule server-side.")
        print(f"  ✓ T1 standing: {standing['intake_id']} published "
              f"(run card {standing.get('run_card_id')})")

    if offline and not developer_email:
        # Offline: identity comes from the manifest; the organizer verifies
        # T1 standing against it at import time.
        raise MethodBundleError(
            "--offline needs --developer-email (the SAME identity your "
            "published T1 record carries — the organizer checks).")

    pair = (contest or {}).get("language_pair") or language_pair or ">"
    src, _, tgt = pair.partition(">")
    manifest = build_manifest(
        method_name=method_name,
        method_version=method_version,
        entrypoint=entrypoint,
        description=description,
        method_class=method_class,
        paradigm=paradigm,
        developer_name=developer_name,
        developer_email=developer_email,
        affiliation=affiliation,
        agreement_signed=True,
        corpus_id=secret_set_id,
        source_lang=src or "source",
        target_lang=tgt or "target",
    )

    # Pre-flight: the same §3.1/§3.2 scans the node runs (lazy import — the
    # runner imports this module for §3.5).
    from mt_eval_harness.sandbox_runner import (
        audit_filesystem_access,
        scan_network_calls,
    )
    findings = (scan_network_calls(Path(method_dir))
                + audit_filesystem_access(Path(method_dir)))
    blocks = [x for x in findings if x["severity"] == "BLOCK"]
    warns = [x for x in findings if x["severity"] == "WARN"]
    for w in warns:
        print(f"  ⚠ {w['check']}: {w['detail']}")
    if blocks:
        raise MethodBundleError(
            "Static checks would BLOCK this bundle at the organizer "
            "(spec §3) — refusing to submit:\n    "
            + "\n    ".join(b["detail"] for b in blocks))

    request_id = f"authreq-{uuid.uuid4().hex}"
    scratch = Path(scratch_dir) if scratch_dir else (
        Path.home() / ".mt-eval" / "method-scratch")
    scratch.mkdir(parents=True, exist_ok=True)
    built = build_method_bundle(
        method_dir=method_dir, dockerfile=dockerfile, manifest=manifest,
        out_path=scratch / f"{request_id}.tar.gz")
    method_sha = built["method_sha"]
    fingerprint = compute_request_fingerprint(
        {"method_sha": method_sha, "corpus_id": secret_set_id,
         "corpus_version": corpus_version},
        node_measurement=node_id.strip())

    request_row = {
        "request_id": request_id,
        "sealed_set_id": secret_set_id,
        "state": "pending",
        "fingerprint": fingerprint,
        "method_sha": method_sha,
        "corpus_id": secret_set_id,
        "corpus_version": corpus_version,
        "node_measurement": node_id.strip(),
        "requested_by": developer_email,
    }

    out: dict = {"request_id": request_id, "method_sha": method_sha,
                 "fingerprint": fingerprint, "manifest": manifest}

    if bundle_out:
        # The sneakernet exchange shape airgap_transport.import_bundle reads.
        dest = Path(bundle_out) / "requests" / request_id
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "method.tar.gz").write_bytes(
            Path(built["path"]).read_bytes())
        (dest / "request.json").write_text(json.dumps({
            "exchange_version": "1",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "contest_id": contest_id,
            "request": request_row,
            "_note": ("Sneakernet method proposal. The organizer verifies "
                      "method_sha, T1 standing, and static checks at import; "
                      "scores-only leaves the airgap."),
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        out["bundle_dir"] = str(dest)
        print(f"  ✓ Sneakernet bundle written: {dest}")

    if not offline:
        object_path = f"{contest_id}/{submitter}/{request_id}.tar.gz"
        _storage_upload(session, object_path,
                        Path(built["path"]).read_bytes())
        created = _api_request("POST", "authorization_requests",
                               data=request_row, session=session)
        out["storage_path"] = object_path
        out["record"] = created[0] if isinstance(created, list) else created
        print(f"\n  ✅ Method proposed: {request_id}")
        print(f"     method_sha  {method_sha}")
        print(f"     fingerprint {fingerprint}")
        print(f"     bound to    node '{node_id.strip()}', "
              f"{secret_set_id} {corpus_version}")
        print(f"     Track it: mt-eval contest method-status {request_id}")
        print("     A custodian must authorize execution "
              "(`mt-eval node approve` on the organizer side); the sandbox "
              "run happens on the organizer's machine and only scores leave.")
    else:
        print(f"\n  ✅ Offline proposal packaged: {request_id}")
        print("     Hand the --bundle-out directory to the organizer "
              "(mt-eval node import-bundle).")
    return out


# ---------------------------------------------------------------------------
# Status — request state + the public audit trail.
# ---------------------------------------------------------------------------

def method_status(request_id: str) -> dict:
    """Print + return the request row and its audit events (both anon-readable)."""
    rows = _api_request(
        "GET", "authorization_requests",
        params={"request_id": f"eq.{request_id}",
                "select": "request_id,sealed_set_id,state,method_sha,"
                          "corpus_version,node_measurement,requested_by,"
                          "created_at,decided_at"})
    if not rows:
        raise MethodBundleError(f"No authorization request {request_id!r}.")
    req = rows[0]
    events = _api_request(
        "GET", "authorization_audit_log",
        params={"request_id": f"eq.{request_id}",
                "select": "event_type,actor,created_at,detail",
                "order": "id.asc"}) or []
    print(f"\n  {req['request_id']}  [{req['state']}]")
    print(f"    sealed set : {req['sealed_set_id']} ({req['corpus_version']})")
    print(f"    method_sha : {req['method_sha']}")
    print(f"    bound node : {req['node_measurement']}")
    for e in events:
        print(f"    {e['created_at']}  {e['event_type']}"
              f"{'  (' + e['actor'] + ')' if e.get('actor') else ''}")
    if req["state"] == "pending":
        print("    Waiting for custodian authorization (per-submission "
              "control — they may refuse without a reason).")
    return {"request": req, "events": events}
