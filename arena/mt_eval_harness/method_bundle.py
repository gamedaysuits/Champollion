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
  2. The qualifier receipt (founder ruling R2, 2026-09-06): the submitter must
     hold a PASSING self-scored receipt for this contest's public dev set
     (`mt-eval contest qualify` → contest_qualify.py). It is a CLAIM, and the
     claim is checkable: the ORGANIZER NODE re-executes the bundle on the same
     dev set before any grant is claimed and denies on a miss. The retired
     "T1 standing" gate (a published hypotheses-lane record) is gone with the
     hypotheses entry lane itself.
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
from mt_eval_harness.contest_declarations import (
    DEFAULT_REQUIREMENTS,
    build_constraints_block,
    build_submission_block,
    constraints_findings,
    qualifier_block_from_receipt,
)
from mt_eval_harness.contest_intake import (
    BUCKET,
    _storage_upload,
    fetch_contest_bundle,
)
from mt_eval_harness.execution_facts import DIAGNOSTICS_COLUMN
from mt_eval_harness.contest_policy import SUBMISSION_TERMS_URL
from mt_eval_harness.qualifier_gate import threshold_phrase
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
    constraints: dict,
    submission: dict,
    qualifier: dict,
    gpu: bool = False,
    gpu_memory_gb: int = 0,
    ram_gb: int = DEFAULT_REQUIREMENTS["ramGB"],
    disk_gb: int = DEFAULT_REQUIREMENTS["diskGB"],
    max_runtime_minutes: int = DEFAULT_REQUIREMENTS["maxRuntimeMinutes"],
) -> dict:
    """Assemble a spec-§2.1 manifest. Refuses anything §3.5 would block.

    ``agreement_signed`` must be explicitly True (the CLI's --agree flag) —
    there is no silent default for signing a terms framework.

    ``constraints`` / ``submission`` / ``qualifier`` are REQUIRED and have no
    defaults (contest_declarations, contract C2): the track, the parameter
    count, the weights licence and the primary/contrastive choice are claims
    only the participant can make, and the qualifier block is their passing
    receipt. A manifest without them is refused here, and again by the
    organizer node's static checks.
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
        "constraints": dict(constraints),
        "submission": dict(submission),
        "qualifier": dict(qualifier),
    }
    problems = (manifest_consistency_findings(manifest)
                + constraints_findings(manifest))
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
              f"framework ({SUBMISSION_TERMS_URL}) must be "
              "explicitly agreed to (--agree).")
    if dev.get("agreementVersion") != CURRENT_AGREEMENT_VERSION:
        block(f"developer.agreementVersion must be "
              f"{CURRENT_AGREEMENT_VERSION!r} (got "
              f"{dev.get('agreementVersion')!r}) — re-read and re-agree to "
              f"the current framework.")
    if not str(dev.get("email") or "").strip():
        block("developer.email is required (it is the submitter identity "
              "045 binds requested_by to and the organizer's records key "
              "on).")

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


def resolve_entrypoint(method_dir: str | Path, entrypoint: str) -> str:
    """The bundle path (``method/…``) of the entrypoint a participant named.

    Everything in ``--method-dir`` is packed under ``method/`` in the bundle,
    and the node mounts that folder read-only at ``/method`` and runs
    ``/method/<rest>`` (sandbox_runner.entrypoint_command). So the file
    ``<method-dir>/translate.py`` is the bundle's ``method/translate.py``.

    Two spellings are accepted, and both are checked against the disk:

    * a path relative to ``--method-dir`` (``translate.py``,
      ``method/translate.py`` when the file really is at
      ``<method-dir>/method/translate.py``);
    * the bundle path the runbook shows (``method/translate.py`` for
      ``<method-dir>/translate.py``).

    When both readings name a real file they are different files, and the
    participant is asked which one. When neither does, the error names every
    path that was looked at (synthetic researcher persona, Round 2,
    2026-10-03: ``my-method/method/translate.py`` existed and the error said
    it "must exist under my-method").
    """
    md = Path(method_dir)
    if not md.is_dir():
        raise MethodBundleError(f"--method-dir is not a directory: {md}")
    raw = str(entrypoint or "").strip()
    if not raw:
        raise MethodBundleError(
            "--entrypoint is required: the script the node runs as "
            "`cat source.txt | <entrypoint>`, given as a path inside "
            "--method-dir (e.g. translate.py).")
    ep = Path(raw)
    if ep.is_absolute() or ".." in ep.parts:
        raise MethodBundleError(
            f"--entrypoint {raw!r} must be a plain relative path inside "
            f"--method-dir {md} (e.g. translate.py), not an absolute path or "
            f"one that climbs out of it.")
    readings: list[tuple[str, Path]] = []
    as_dir_relative = md / ep
    readings.append((f"method/{ep.as_posix()}", as_dir_relative))
    if ep.parts[0] == "method" and len(ep.parts) > 1:
        rest = Path(*ep.parts[1:])
        readings.append((f"method/{rest.as_posix()}", md / rest))
    hits = [(bundle, disk) for bundle, disk in readings if disk.is_file()]
    if len(hits) == 2:
        def unambiguous(disk: Path) -> str:
            # A path inside --method-dir that itself starts with method/ can
            # only be named unambiguously by its full bundle path.
            rel = disk.relative_to(md).as_posix()
            return f"method/{rel}" if rel.startswith("method/") else rel
        raise MethodBundleError(
            f"--entrypoint {raw!r} is ambiguous: it can mean {hits[0][1]} or "
            f"{hits[1][1]}, and both exist. Pass "
            f"--entrypoint {unambiguous(hits[1][1])} for {hits[1][1]}, or "
            f"--entrypoint {unambiguous(hits[0][1])} for {hits[0][1]}.")
    if hits:
        return hits[0][0]
    looked = " and ".join(str(disk) for _, disk in readings)
    raise MethodBundleError(
        f"--entrypoint {raw!r} not found: looked for {looked}. The entrypoint "
        f"is a file inside --method-dir ({md}); everything in that folder is "
        f"packed under method/ and runs from /method on the node, so "
        f"{md}/translate.py is method/translate.py.")


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
    problems = (manifest_consistency_findings(manifest)
                + constraints_findings(manifest))
    if problems:
        raise MethodBundleError(
            "Refusing to pack a manifest the static checks would block:\n    "
            + "\n    ".join(p["detail"] for p in problems))
    arcnames = {a for a, _ in pairs}
    if entrypoint not in arcnames:
        rest = entrypoint[len("method/"):] if entrypoint.startswith(
            "method/") else entrypoint
        raise MethodBundleError(
            f"method.entrypoint {entrypoint!r} is not among the packed files: "
            f"the bundle path method/<x> is the file {method_dir}/<x>, and "
            f"{Path(method_dir) / rest} does not exist. Pass --entrypoint as "
            f"the script's path inside --method-dir "
            f"(method_bundle.resolve_entrypoint).")

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
# Contest resolution + the qualifier-receipt gate.
# ---------------------------------------------------------------------------

def resolve_secret_set(contest: dict, qualifier: dict,
                       secret_set_id: str | None = None) -> dict:
    """Find the sealed set this contest's entries are executed against.

    Under founder ruling R2 (2026-09-06) a contest IS registered against its
    fully-secret set — ``contest_prep.contest_corpus_id`` returns the secret
    split — so the contest's own ``corpus_id`` is the answer whenever it is an
    active set under this qualifier. It has to be the contest's own set rather
    than "the sibling", because a declared HOLDOUT is registered under the very
    same qualifier — "the other one" is not a safe answer.

    The sibling lookup below only fires when the contest's own set is not
    active under this qualifier (a rotated or retired registration). A contest
    prepared BEFORE R2 names its retired blind split as ``corpus_id``; the set
    it names is still what comes back, so such a contest needs
    ``--secret-set``. Ambiguity or absence fails loud.
    """
    rows = _api_request(
        "GET", "sealed_sets",
        params={"current_qualifier_id": f"eq.{qualifier['qualifier_id']}",
                "status": "eq.active",
                "select": "sealed_set_id,ciphertext_digest,custodian_group_id,"
                          "language_pair,status"})
    rows = list(rows or [])
    by_id = {r["sealed_set_id"]: r for r in rows}
    if secret_set_id:
        match = by_id.get(secret_set_id)
        if match is None:
            raise MethodBundleError(
                f"--secret-set {secret_set_id!r} is not an active sealed set "
                f"paired with this contest's qualifier "
                f"({qualifier['qualifier_id']}). Active sets under it: "
                + (", ".join(sorted(by_id)) or "none"))
        return match
    contest_set = contest.get("corpus_id")
    if contest_set in by_id:
        return by_id[contest_set]
    siblings = [r for r in rows if r["sealed_set_id"] != contest_set]
    if not siblings:
        raise MethodBundleError(
            f"Contest {contest['id']!r} has no active sealed set registered "
            f"under its qualifier {qualifier['qualifier_id']!r}. A contest is "
            f"entered by handing a method to the organizer's node, and there "
            f"is nothing for it to run against — the organizer needs a "
            f"--secret-size split at `contest prepare` time.")
    if len(siblings) > 1:
        raise MethodBundleError(
            "Multiple secret sets share this qualifier: "
            + ", ".join(r["sealed_set_id"] for r in siblings)
            + " — pass --secret-set to pick one.")
    return siblings[0]


def require_qualifier_receipt(
    contest_id: str,
    *,
    qualifier_id: str,
    threshold: float,
    receipt_dir: str | Path | None = None,
    system: str | None = None,
    name_hint: str | None = None,
) -> dict:
    """The C1 admission gate: a PASSING self-scored qualifier receipt.

    Replaces the retired "T1 standing" check (a published hypotheses-lane
    record), which died with the hypotheses entry lane under ruling R2. Loads
    the receipt of THIS system — ``~/.mt-eval/qualifier/<contest>/`` (or
    ``receipt_dir``) holds one per system: ``system`` (--system) names it,
    else the one for ``name_hint`` (the submission's --name), else the
    contest's only one (contest_qualify.load_receipt) — and refuses unless it
    passes, was scored against THIS contest's qualifier, and used at least
    this threshold. Raises ``contest_qualify.QualifierError`` with the
    reason; the caller does not catch it — a failed admission gate is loud.

    The receipt is self-reported by construction. The organizer node
    re-executes the bundle on the same public dev set before any grant is
    claimed and denies on a miss (claimed X, measured Y, threshold T), so the
    receipt is a claim the host can and does check.

    Imported lazily so this module keeps importing while contest_qualify is
    being written, and so tests can substitute a stub.
    """
    from mt_eval_harness import contest_qualify

    receipt = contest_qualify.load_receipt(contest_id, receipt_dir,
                                           system=system, name_hint=name_hint)
    return contest_qualify.require_pass(
        receipt, contest_id=contest_id, qualifier_id=qualifier_id,
        threshold=threshold)


def contest_requires_description(contest_id: str,
                                 session: dict | None = None) -> bool:
    """Whether this contest sets ``metadata.require_description`` (practice 9).

    Read on its own because ``contest_intake.fetch_contest_bundle`` does not
    select the metadata column. Anon-readable like the rest of the contest row;
    any error propagates — a description requirement that cannot be read is not
    a requirement that can be quietly skipped.
    """
    rows = _api_request(
        "GET", "contests",
        params={"id": f"eq.{contest_id}", "select": "metadata"},
        session=session)
    if not rows:
        return False
    metadata = rows[0].get("metadata")
    return bool(isinstance(metadata, dict)
                and metadata.get("require_description"))


def contest_prize_terms_sha(contest_id: str,
                            session: dict | None = None) -> tuple[str | None, dict | None]:
    """This contest's declared prize terms and their hash — ``(sha, terms)``.

    ``(None, None)`` means the contest declares no prize terms, so it has no
    prize and there is nothing for an entry to accept. Read on its own for the
    same reason ``contest_requires_description`` is (the contest bundle fetch
    does not select ``metadata``); any error propagates, because terms that
    cannot be read are not terms that can be quietly skipped.
    """
    from mt_eval_harness import contest_prize_terms

    rows = _api_request(
        "GET", "contests",
        params={"id": f"eq.{contest_id}", "select": "metadata"},
        session=session)
    if not rows:
        return None, None
    metadata = rows[0].get("metadata")
    terms = metadata.get("prize_terms") if isinstance(metadata, dict) else None
    if not terms:
        return None, None
    parsed = contest_prize_terms.normalize_prize_terms(terms)
    return contest_prize_terms.terms_sha256(parsed), parsed


def resolve_accepted_terms(contest_id: str, accept_terms: str | None,
                           session: dict | None = None) -> str | None:
    """The prize-terms hash to record on the manifest — or a loud refusal.

    Prints the terms in plain language before refusing, so a participant who
    forgot ``--accept-terms`` reads what they would be accepting instead of a
    bare error. Refuses in both directions: no acceptance for a contest that
    declares terms, and an acceptance whose hash is not the one the contest
    declares (the terms changed, or the wrong contest was pasted).
    """
    from mt_eval_harness import contest_prize_terms

    sha, terms = contest_prize_terms_sha(contest_id, session)
    if sha is None:
        if accept_terms:
            raise MethodBundleError(
                f"--accept-terms {accept_terms} was passed but contest "
                f"{contest_id!r} declares NO prize terms — it has no prize, so "
                f"there is nothing to accept. Drop the flag, or check the "
                f"contest id.")
        return None
    if not accept_terms:
        raise MethodBundleError(
            "\n  " + contest_prize_terms.describe(terms)
            + f"\n\n  Terms hash: {sha}\n"
            f"  This contest declares prize terms, so an entry must accept "
            f"them explicitly: re-run with --accept-terms {sha}. The "
            f"acceptance is packed into the bundle and covered by method_sha, "
            f"so it cannot be added or changed afterwards, and the organizer's "
            f"node refuses a bundle that accepted anything else.")
    if accept_terms.strip().lower() != sha:
        raise MethodBundleError(
            f"--accept-terms {accept_terms!r} does not match the prize terms "
            f"contest {contest_id!r} declares ({sha}). Either the terms you "
            f"read are not the terms now in force, or this is a different "
            f"contest. Re-read them:\n  "
            + contest_prize_terms.describe(terms))
    return sha


def _submitter_email(session: dict) -> str:
    """The JWT email — the identity 044 (storage folder) and 045
    (requested_by) bind to. Fails loud when absent."""
    email = (session.get("user") or {}).get("email", "").strip()
    if not email:
        raise MethodBundleError(
            "Your session has no email claim — the storage and request "
            "policies bind to the JWT email. Sign in again: run `mt-eval logout`, then the next "
            "command that needs an account opens the browser sign-in (GitHub or Google).")
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
    track: str,
    parameter_count: int,
    weights_license: str | None,
    weights_public: bool | None,
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
    language_pair: str | None = None,
    bundle_out: str | Path | None = None,
    offline: bool = False,
    scratch_dir: str | Path | None = None,
    gpu: bool = False,
    gpu_memory_gb: int = 0,
    ram_gb: int = DEFAULT_REQUIREMENTS["ramGB"],
    disk_gb: int = DEFAULT_REQUIREMENTS["diskGB"],
    max_runtime_minutes: int = DEFAULT_REQUIREMENTS["maxRuntimeMinutes"],
) -> dict:
    """Package + pre-flight + propose a Lane B method execution.

    Returns {request_id, method_sha, fingerprint, storage_path|bundle_dir}.
    ``offline=True`` builds the sneakernet exchange dir only (no Supabase at
    all) — the organizer imports it with `mt-eval node import-bundle`, which
    creates the request row service-side.

    ``track`` / ``parameter_count`` / ``weights_license`` / ``weights_public``
    are required declarations (contract C2); a method with no trained weights
    declares ``parameter_count=0`` and passes None for the weights pair.
    ``entrypoint`` is the script's path inside ``method_dir`` (or its bundle
    path ``method/…``) — see resolve_entrypoint. Online, the qualifier id and
    threshold come from the contest row; offline they must be supplied as
    ``offline_qualifier_id`` + ``offline_threshold`` and must match the
    receipt, because there is nothing to look them up against.

    ``accept_terms`` is the SHA-256 of the contest's declared prize terms. It
    is REQUIRED when the contest declares any (online the terms are read and
    the hash checked; offline it is taken on trust and re-checked at import),
    and refused when the contest declares none.

    ``ram_gb`` / ``disk_gb`` / ``max_runtime_minutes`` / ``gpu`` /
    ``gpu_memory_gb`` are the manifest's DECLARED requirements. The organizer
    node refuses a bundle that asks for more than its configured caps
    (``sandbox.max_ram_gb`` and friends) — so a method that never needed 8 GB
    was, until these were exposed, refused by every node with a smaller cap
    for a number nobody chose. The defaults are DEFAULT_REQUIREMENTS — what
    the shipped `node init` template allows — so a default-packaged bundle
    runs on a default-configured node.
    """
    if not agree:
        raise MethodBundleError(
            "Submitting a method means agreeing to the method-submission "
            f"terms framework ({SUBMISSION_TERMS_URL}, "
            f"version {CURRENT_AGREEMENT_VERSION}). Pass --agree after "
            "reading it — there is no implicit signature.")
    if not node_id or not node_id.strip():
        raise MethodBundleError(
            "--node-id is required: the request fingerprint binds your "
            "method to the ORGANIZER'S node (advertised with the contest "
            "materials). A wrong id fails closed at run time.")

    # Everything that depends only on what the participant typed is checked
    # BEFORE any sign-in, contest lookup or receipt read: the entrypoint (as a
    # file inside --method-dir) and the declarations. A refusal for either
    # used to arrive only after the network steps, one at a time.
    bundle_entrypoint = resolve_entrypoint(method_dir, entrypoint)
    if not Path(dockerfile).is_file():
        raise MethodBundleError(
            f"--dockerfile not found: {dockerfile}. The sandbox builds your "
            f"container with --network=none; a Dockerfile with all "
            f"dependencies vendored is required (spec §3.3).")
    # DeclarationError (a ValueError) carries the reason; callers and the
    # CLI handle it as they always have.
    constraints_block = build_constraints_block(
        track=track, parameter_count=parameter_count,
        weights_license=weights_license, weights_public=weights_public,
        training_data=training_data)

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
        if not offline_qualifier_id or offline_threshold is None:
            raise MethodBundleError(
                "--offline needs --offline-qualifier-id and "
                "--offline-threshold (both published with the contest "
                "materials): with no connection there is nothing to check the "
                "qualifier receipt against, and an unchecked receipt is not a "
                "gate.")
        from mt_eval_harness.pair_notation import split_pair
        src_, tgt_ = split_pair(language_pair)
        if not (src_.strip() and tgt_.strip()):
            # Online the pair comes from the contest row. Offline there is
            # none, and the manifest (covered by method_sha) used to record
            # "source>target" placeholders instead of a real pair.
            raise MethodBundleError(
                "--offline needs --pair (e.g. 'eng>crk' or eng-crk, from the contest "
                "materials): the language pair is written into the bundle's "
                "manifest, and with no connection it cannot be looked up.")
        qualifier_id = offline_qualifier_id
        threshold = offline_threshold
        # Offline there is no contest row to read the terms from, so the hash
        # is taken on trust from --accept-terms and labelled as unchecked at
        # import time (contest_declarations.accepted_terms_findings).
        accepted_terms_sha = (accept_terms.strip().lower()
                              if accept_terms else None)
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
        qualifier_id = qualifier["qualifier_id"]
        threshold = qualifier["threshold"]
        if (contest_requires_description(contest_id, session)
                and not submission_description.strip()):
            raise MethodBundleError(
                f"Contest {contest_id!r} requires a system description with "
                f"every entry (metadata.require_description) — pass "
                f"--description-file with how the system was built. The "
                f"organizer publishes descriptions with the edition report.")
        accepted_terms_sha = resolve_accepted_terms(
            contest_id, accept_terms, session)

    receipt = require_qualifier_receipt(
        contest_id, qualifier_id=qualifier_id, threshold=threshold,
        receipt_dir=receipt_dir, system=system, name_hint=method_name)
    print(f"  ✓ Qualifier receipt: {receipt.get('score')} ≥ "
          f"{threshold_phrase(receipt.get('threshold'))} on {qualifier_id} "
          f"(self-scored; the node re-executes on the same dev set)")

    if offline and not developer_email:
        # Offline: identity comes from the manifest; the organizer verifies
        # T1 standing against it at import time.
        raise MethodBundleError(
            "--offline needs --developer-email (the identity the organizer's "
            "contest records key on — they check it at import).")

    pair = (contest or {}).get("language_pair") or language_pair or ">"
    from mt_eval_harness.pair_notation import split_pair
    src, tgt = split_pair(pair)
    manifest = build_manifest(
        method_name=method_name,
        method_version=method_version,
        entrypoint=bundle_entrypoint,
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
        constraints=constraints_block,
        submission=build_submission_block(
            is_primary=is_primary, description=submission_description,
            method_release_url=method_release_url,
            accepted_prize_terms_sha256=accepted_terms_sha),
        qualifier=qualifier_block_from_receipt(receipt),
        gpu=gpu, gpu_memory_gb=gpu_memory_gb, ram_gb=ram_gb,
        disk_gb=disk_gb, max_runtime_minutes=max_runtime_minutes,
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

    # Say what the bundle will ask the node for, BEFORE it is frozen into the
    # bundle's hash: a node refuses more than its caps, and the only fix after
    # packaging is a new bundle (and a new request).
    req = manifest["requirements"]
    at_default = (req["ramGB"], req["diskGB"], req["maxRuntimeMinutes"]) == (
        DEFAULT_REQUIREMENTS["ramGB"], DEFAULT_REQUIREMENTS["diskGB"],
        DEFAULT_REQUIREMENTS["maxRuntimeMinutes"])
    print(f"  Declared requirements: {req['ramGB']} GB RAM, {req['diskGB']} GB "
          f"scratch disk, {req['maxRuntimeMinutes']} min"
          + (", GPU" if req.get("gpu") else ", no GPU")
          + (" — the defaults, i.e. what the shipped `node init` template "
             "allows" if at_default and not req.get("gpu") else "")
          + ". The organizer's node refuses more than its sandbox caps; "
            "change with --ram-gb / --disk-gb / --max-runtime-minutes.")

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
        # The sneakernet exchange shape airgap_transport.import_bundle reads —
        # written by the ONE exchange-request writer the relay and `node
        # stage-request` also use. Lazy import: airgap_transport imports
        # sandbox_runner, which imports this module (§3.5).
        from mt_eval_harness.airgap_transport import write_exchange_request
        dest = write_exchange_request(
            bundle_out, request_id=request_id, contest_id=contest_id,
            request_row=request_row,
            bundle_bytes=Path(built["path"]).read_bytes(),
            audit_head=None,
            note=("Sneakernet method proposal. The organizer verifies "
                  "method_sha, the qualifier receipt (by re-executing the "
                  "bundle on the public dev set), and the static checks at "
                  "import; scores-only leaves the airgap."),
            extra={"origin": "submit-method"})
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
    """Print + return the request row and its audit events (both anon-readable).

    Also prints the EXECUTION block: the counts-only diagnostics the node
    recorded (practice 12). A sealed node never returns outputs, so an
    outcome, the stage it stopped at, an exit code and a few counts are the
    only feedback that exists — and "no diagnostics recorded" is itself
    information, so it is said rather than left blank.
    """
    _BASE_SELECT = ("request_id,sealed_set_id,state,method_sha,"
                    "corpus_version,node_measurement,requested_by,"
                    "created_at,decided_at")
    diagnostics_available = True
    try:
        rows = _api_request(
            "GET", "authorization_requests",
            params={"request_id": f"eq.{request_id}",
                    "select": _BASE_SELECT + f",{DIAGNOSTICS_COLUMN}"})
    except RuntimeError as exc:
        # A database that predates migration 074 has no such column;
        # PostgREST answers 400. Fall back to the base row and SAY the
        # channel is unavailable — never silently print an empty block.
        if DIAGNOSTICS_COLUMN not in str(exc):
            raise
        diagnostics_available = False
        rows = _api_request(
            "GET", "authorization_requests",
            params={"request_id": f"eq.{request_id}", "select": _BASE_SELECT})
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
    diagnostics = req.get(DIAGNOSTICS_COLUMN)
    print("    execution :")
    if not diagnostics_available:
        print(f"      (this database has no "
              f"authorization_requests.{DIAGNOSTICS_COLUMN} column — it "
              f"predates migration 074, so no diagnostics can be recorded "
              f"yet)")
    elif not diagnostics:
        print("      no diagnostics recorded")
    else:
        outcome = diagnostics.get("outcome")
        print(f"      outcome  : {outcome}")
        if diagnostics.get("stage") is not None:
            print(f"      stage    : {diagnostics['stage']} "
                  f"(where the run stopped)")
        for label, key in (("exit code", "exit_code"),
                           ("runtime s", "runtime_seconds"),
                           ("sources ", "n_sources"),
                           ("out lines", "n_output_lines"),
                           ("stderr B ", "stderr_bytes"),
                           ("scored   ", "n_scored"),
                           ("empty out", "n_empty")):
            if diagnostics.get(key) is not None:
                print(f"      {label}: {diagnostics[key]}")
        print("      (counts only — a sealed node never returns output text)")
    if req["state"] == "pending":
        print("    Waiting for custodian authorization (per-submission "
              "control — they may refuse without a reason).")
    return {"request": req, "events": events, "diagnostics": diagnostics,
            "diagnostics_available": diagnostics_available}
