"""airgap_transport — true-airgap file transport for the T2 method lane (B3).

"The software on a VM under airgap": the SCORING machine has no network at
all. Work crosses the gap as files on removable media; only scores come back.
Two machines, both the organizer's, three verbs:

  CONNECTED side (has Supabase + the bucket):
    `mt-eval node relay <exchange-dir>` — ONE sync pass over the medium, and
    the two halves run in this order (scores IN before requests OUT; the
    reason is spelled out on relay(), and it is load-bearing, not taste):
      scores IN     import every signed score bundle from scores/<request-id>/:
                    Ed25519-verify (seal-corpus verify — the crypto lives in
                    cli/lib/seal.mjs), re-check the fingerprint against the
                    frozen request, claim the single-use grant (EXISTING
                    mint_and_claim_grant; transport evidence in the grant_used
                    audit detail), and publish the PREBUILT aggregates-only
                    run-card row through validate_row — the §9 scores-only
                    path. This half writes the scores/<id>/.relayed.json
                    done-marker that retires the request from export.
      requests OUT  export every AUTHORIZED method request the served contests
                    carry: check the bundle carries a receipt for this set's
                    ACTIVE qualifier + the frozen method_sha, then write
                    requests/<request-id>/{request.json, method.tar.gz,
                    qualifier-corpus.json} — the qualifiers row and the PUBLIC
                    dev corpus so the airgapped node can re-execute the gate
                    itself (exchange version 2) — plus the current
                    authorization_audit_head() so the airgapped node can echo
                    the chain digest its work is anchored to.
    On the OUTBOUND leg only the second half has anything to do; on the RETURN
    leg the first half publishes and the second correctly finds nothing left
    to carry.

  AIRGAPPED side (no network; node.json carries the sealed T2 artifacts):
    `mt-eval node import-bundle <exchange-dir>`
        refuse any export whose exchange_version is not this node's (by name,
        never half-read), then validate + digest-verify + safe-extract each
        exported request into the local state dir, stage the public qualifier
        corpus (pin-checked), and run validation immediately — the §3 static
        checks for a runnable bundle (Lane B), or the code-free declarative
        validation for a declarative-model bundle (Lane A). A BLOCKED bundle
        never reaches execution and its refusal (with the findings) travels
        back as a signed 'rejected' score bundle.
    `mt-eval node run-method <request-id> --offline`
        re-EXECUTE the public qualifier on the exported dev corpus and gate on
        what THIS machine measures (exchange version 2 — the receipt is a
        claim, this is the measurement), then offline execution + single-
        scorer scoring, dispatched on the bundle's submissionKind: the trusted
        declarative engine (Lane A) or the --network=none sandbox (Lane B) —
        the SAME code the connected mode runs. ONE authorized run covers every
        split the contest declared: the secret set, the sealed holdout (opened
        under the SAME custodian quorum), and the third-party diagnostic
        suites. The results are held locally as fully-validated run-card ROWS.
    `mt-eval node export-scores <exchange-dir>`
        write scores/<request-id>/{score-bundle.json, score-bundle.json.sig.json},
        signed with the node's Ed25519 key (single-node wave-1 signature,
        honestly labeled — NOT steward custody).

  ORGANIZER side, NO database (a rehearsal / a DB-less deployment):
    `mt-eval node stage-request <bundle.tar.gz> --contest … --out <exchange-dir>`
        write the SAME requests/<request-id>/{request.json, method.tar.gz}
        shape the relay's requests-OUT half writes, from a local bundle
        file: pre-validated exactly as import would, fingerprint bound to the
        node id in node.json. No authorization_requests row exists
        anywhere, so the scores that come back are manifest-verifiable but
        can NEVER be relay-published (the relay's scores-IN half refuses:
        "no such authorization request"). One writer
        (write_exchange_request) serves the relay, the participant's
        `submit-method --offline`, and this verb.

Scores-only, strengthened: the score bundle carries the AGGREGATES-ONLY row
(the exact bytes that will publish), never the RunLog/TestReport — so secret
corpus text does not even reach the CONNECTED organizer machine, let alone
Supabase. RunLogs stay on the airgapped node's disk.

Trust model (say it out loud): the Ed25519 signature authenticates WHICH
machine produced the scores (relay config pins the airgap node's verify key
and node id); the fingerprint + frozen request row bind them to WHICH method
and corpus version; the audit-head echo anchors WHEN. None of that is
hardware attestation — the organizer trusts their own airgapped machine
(Wave-2 attestation and M-of-N custody remain deferred, per the plan).
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from mt_eval_harness import contest_declarations
from mt_eval_harness.contest_prep import find_champollion_cli
from mt_eval_harness.execution_facts import (
    DiagnosticsColumnMissing,
    failure_diagnostics,
    record_execution_diagnostics,
)
from mt_eval_harness.sandbox_runner import (
    SandboxError,
    _sealed_headline,
    run_static_checks,
)
from mt_eval_harness.scoring import SCORING_STANDARD

#: The exchange FORMAT version, stamped on every request.json and every
#: score-bundle.json and checked on import. Bumped to "2" (2026-09-07) when
#: the OUT bundle started carrying the PUBLIC qualifier facts — the qualifiers
#: row and the dev corpus — so the air-gapped node can re-EXECUTE the public
#: gate itself instead of trusting the receipt's number (the honest gap the
#: connected lane never had). A node refuses a bundle of any other version BY
#: NAME rather than half-reading it: a v1 export carries no qualifier facts,
#: and reading it as a v2 would silently mean "no gate".
EXCHANGE_VERSION = "2"

#: Where the exported dev corpus lands inside requests/<request-id>/.
QUALIFIER_CORPUS_FILE = "qualifier-corpus.json"

# A request id becomes a directory name on the exchange medium and under the
# node's state dir — keep it to the characters both accept everywhere.
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

RELAY_EXPORT_NOTE = ("Authorized method-execution request, exported for "
                     "the airgapped scoring node. Verify method_sha on "
                     "import; scores-only comes back.")

STAGED_REQUEST_NOTE = (
    "Staged OFFLINE by `mt-eval node stage-request` on the organizer side: "
    "NO Supabase authorization_requests row exists for this request "
    "anywhere. The scores that come back are manifest-verifiable "
    "(`mt-eval node verify-manifest`) but CANNOT be relay-published — "
    "`node relay` refuses them as 'no such authorization request'. "
    "Verify method_sha on import; scores-only comes back.")


class AirgapTransportError(RuntimeError):
    """A transport step that must not proceed — always with the reason."""


# ---------------------------------------------------------------------------
# The relay's node.json precondition, in ONE place.
#
# Both halves of a relay pass depend on the `relay` block, for different
# reasons, and neither can do its job honestly without it:
#
#   airgap_node_id  names the ONE air-gapped machine this relay serves.
#       requests-OUT filters on it (a request bound to a different node is
#       not this relay's to carry — D6, 2026-09-07) and scores-IN rebuilds
#       the fingerprint from it. Unset, the filter silently matches
#       everything and the relay puts other nodes' method bundles on the
#       medium.
#   verify_key      is that machine's score-sign public key. Without it
#       scores-IN cannot tell a genuine score bundle from a forged one.
#
# `relay()` checks BOTH before it touches the medium, so a misconfigured node
# fails immediately and completely rather than half-completing a pass — and
# the message names the missing field, what it is for, and where to get it.
# Each half also asks for what IT needs, because both are callable directly.
# ---------------------------------------------------------------------------

_RELAY_FIELD_HELP = {
    "relay.airgap_node_id": (
        "the node_id of the air-gapped scoring machine this relay serves "
        "(the `node_id` in THAT machine's node.json). Without it the relay "
        "cannot tell which authorized requests are its to carry, and would "
        "put method bundles bound to other nodes onto the medium."),
    "relay.verify_key": (
        "path to that machine's score-sign public key (`mt-eval node keygen` "
        "writes score-sign-<id>.pub.json on the air-gapped machine — carry "
        "the .pub.json out, never the .key.json). Without it the relay "
        "cannot tell a genuine score bundle from a forged one, so it refuses "
        "every bundle."),
}


def require_relay_config(cfg: dict, *, need: tuple[str, ...] = (
        "airgap_node_id", "verify_key")) -> dict:
    """Return the `relay` block, or raise naming exactly what is missing."""
    relay_cfg = cfg.get("relay") or {}
    missing = [f"relay.{k}" for k in need
               if not str(relay_cfg.get(k) or "").strip()]
    if missing:
        lines = "\n".join(f"  {name} — {_RELAY_FIELD_HELP[name]}"
                           for name in missing)
        raise AirgapTransportError(
            "node.json is not configured to relay for an air-gapped node.\n"
            "Missing from its \"relay\" block:\n" + lines + "\n"
            "Add it and run the command again. Nothing was written to the "
            "exchange medium.")
    return relay_cfg


# ---------------------------------------------------------------------------
# Signing bridge. ONE signature format (the seal.mjs detached block —
# {scheme, keyId, payloadSha256, signatureB64, signedAt}), TWO independent
# implementations: sovereign.score_manifest (Python, `cryptography`) and
# cli/lib/seal.mjs (Node). The airgapped node's offline bundle carries no
# Node.js, so the Python signer is preferred whenever `cryptography`
# imports; the Node CLI is the fallback on machines without it. Which one
# ran is always printed (one line, stderr) — never a silent choice.
# ---------------------------------------------------------------------------

def _python_signer_available() -> bool:
    try:
        import cryptography  # noqa: F401
    except ImportError:
        return False
    return True


def _announce_signer(action: str, implementation: str, why: str = "") -> None:
    print(f"  {action}: {implementation}" + (f" ({why})" if why else ""),
          file=sys.stderr)


def sign_file(payload_path: Path, privkey_path: Path) -> Path:
    """Detached-sign ``payload_path`` → ``<payload>.sig.json``.

    Python (`score_manifest.sign_manifest_file`) when `cryptography` imports;
    otherwise the champollion CLI (`seal-corpus sign`). Same block either way.
    """
    payload_path = Path(payload_path)
    sig_path = payload_path.with_name(payload_path.name + ".sig.json")
    if _python_signer_available():
        from mt_eval_harness.sovereign.score_manifest import (
            ScoreManifestError,
            sign_manifest_file,
        )
        _announce_signer("signer", "python (sovereign.score_manifest, "
                                   "cryptography)")
        try:
            return sign_manifest_file(payload_path, str(privkey_path),
                                      sig_out=sig_path)
        except ScoreManifestError as e:
            raise AirgapTransportError(
                f"score-bundle signing failed (python signer): {e}") from e
    _announce_signer("signer", "node champollion CLI (seal-corpus sign)",
                     "python 'cryptography' not importable")
    argv = find_champollion_cli() + [
        "seal-corpus", "sign",
        "--payload", str(payload_path),
        "--privkey", str(privkey_path),
        "--sig-out", str(sig_path),
    ]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=60)
    if proc.returncode != 0 or not sig_path.exists():
        raise AirgapTransportError(
            f"score-bundle signing failed:\n{proc.stderr or proc.stdout}")
    return sig_path


def verify_file(payload_path: Path, sig_path: Path, pubkey_path: Path) -> bool:
    """True iff ``sig_path`` verifies ``payload_path`` under ``pubkey_path``.

    Python (`score_manifest.verify_manifest_file`) first; the champollion
    CLI (`seal-corpus verify`) when `cryptography` is absent. A failure is a
    refusal for the caller either way.
    """
    if _python_signer_available():
        from mt_eval_harness.sovereign.score_manifest import (
            verify_manifest_file,
        )
        _announce_signer("verifier", "python (sovereign.score_manifest, "
                                     "cryptography)")
        return bool(verify_manifest_file(payload_path, sig_path,
                                         str(pubkey_path))["ok"])
    _announce_signer("verifier", "node champollion CLI (seal-corpus verify)",
                     "python 'cryptography' not importable")
    argv = find_champollion_cli() + [
        "seal-corpus", "verify",
        "--payload", str(payload_path),
        "--sig", str(sig_path),
        "--pubkey", str(pubkey_path),
    ]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=60)
    return proc.returncode == 0


# ---------------------------------------------------------------------------
# The ONE exchange-request writer. The relay (requests-OUT half), the
# participant's `submit-method --offline --bundle-out`, and
# `node stage-request` all write requests/<request-id>/{request.json,
# method.tar.gz} through here, so the airgapped node's import_bundle reads
# one shape.
# ---------------------------------------------------------------------------

def write_exchange_request(exchange_dir: str | Path, *, request_id: str,
                           contest_id: str | None, request_row: dict,
                           bundle_bytes: bytes, audit_head: str | None = None,
                           note: str, extra: dict | None = None,
                           extra_files: dict | None = None) -> Path:
    """Write ``requests/<request_id>/`` on the exchange medium; return it.

    Refuses to overwrite an existing request directory (an exchange medium
    is append-only evidence — a second write with the same id would be a
    silent replacement of an artifact someone may already have imported).

    ``extra_files`` is ``{filename: bytes}`` written alongside
    ``method.tar.gz``. It carries the PUBLIC dev corpus (exchange version 2)
    — the qualifier set whose references the organizer already published, so
    nothing secret rides the medium outbound any more than it does inbound.
    """
    if not _REQUEST_ID_RE.match(str(request_id or "")):
        raise AirgapTransportError(
            f"request_id {request_id!r} is not a safe directory name "
            f"(letters, digits, '.', '_', '-'; ≤128 chars).")
    dest = Path(exchange_dir) / "requests" / request_id
    if dest.exists():
        raise AirgapTransportError(
            f"{dest} already exists — refusing to overwrite an exchange "
            f"request (choose a different --request-id or a fresh "
            f"exchange directory).")
    meta = {
        "exchange_version": EXCHANGE_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "contest_id": contest_id,
        "request": request_row,
        "audit_head_at_export": audit_head,
        "_note": note,
    }
    for key, value in (extra or {}).items():
        meta[key] = value
    dest.mkdir(parents=True, exist_ok=False)
    (dest / "method.tar.gz").write_bytes(bundle_bytes)
    for name, blob in (extra_files or {}).items():
        if "/" in name or name in ("..", "."):
            raise AirgapTransportError(
                f"exchange file name {name!r} must be a plain file name.")
        (dest / name).write_bytes(blob)
    (dest / "request.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    return dest


# ---------------------------------------------------------------------------
# Shared state helpers (airgap side keeps everything under state_dir).
# ---------------------------------------------------------------------------

def _airgap_state_dir(cfg: dict) -> Path:
    return Path((cfg.get("airgap") or {}).get(
        "state_dir", Path.home() / ".mt-eval" / "airgap")).expanduser()


def _read_state(state_dir: Path, request_id: str) -> dict:
    p = state_dir / request_id / "state.json"
    if not p.exists():
        raise AirgapTransportError(
            f"No imported request {request_id!r} under {state_dir} — run "
            f"`mt-eval node import-bundle` first.")
    return json.loads(p.read_text(encoding="utf-8"))


def _write_state(state_dir: Path, request_id: str, state: dict) -> None:
    d = state_dir / request_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")


# ---------------------------------------------------------------------------
# CONNECTED side, requests-OUT half — export authorized requests to the
# exchange dir. relay() runs this AFTER import_scores, so a request whose
# signed scores came back on this very medium is already marked done here.
# ---------------------------------------------------------------------------

def manifest_from_bundle_bytes(bundle: bytes) -> dict | None:
    """Read manifest.json out of a bundle tarball WITHOUT extracting it.

    The relay never needs the participant's code on disk — only their
    declarations. Returns None when the archive carries no readable manifest
    (the caller decides what that means)."""
    try:
        with tarfile.open(fileobj=io.BytesIO(bundle), mode="r:gz") as tar:
            member = next((m for m in tar.getmembers()
                           if m.name in ("manifest.json", "./manifest.json")),
                          None)
            if member is None:
                return None
            fh = tar.extractfile(member)
            if fh is None:
                return None
            return json.loads(fh.read().decode("utf-8"))
    except (tarfile.TarError, json.JSONDecodeError, UnicodeDecodeError, OSError):
        return None


def export_requests(exchange_dir: str | Path, cfg: dict) -> list[str]:
    from mt_eval_harness.contest_node import _fetch_rows, _storage_download
    from mt_eval_harness.sandbox_runner import (
        _audit_request_created_once,
        resolve_contest_qualifier,
    )
    from mt_eval_harness.sovereign_service import rpc

    exchange = Path(exchange_dir)
    exported: list[str] = []
    # A relay exports work for ONE air-gapped node. A request whose
    # fingerprint is bound to a different node id is not this relay's to
    # carry: the air-gapped machine refuses it on arrival (fail-closed node
    # binding), so exporting it only puts somebody's method bundle on a
    # removable medium for nothing. This matters on a node that both EXECUTES
    # its own sealed contests and relays for the air-gapped one — the
    # rehearsal's organizer does exactly that.
    # Required, not optional: an unset airgap_node_id used to make the filter
    # below a silent no-op, which is the fail-OPEN version of the very defect
    # the filter exists to close.
    relay_node = str(require_relay_config(
        cfg, need=("airgap_node_id",))["airgap_node_id"]).strip()
    for contest_id, ccfg in cfg["contests"].items():
        secret_set = ccfg.get("secret_set_id")
        if not secret_set:
            continue
        # Exchange version 2: the air-gapped node re-EXECUTES the public
        # qualifier before it opens anything sealed, exactly as the connected
        # node does — so the facts it needs travel WITH the request. The dev
        # corpus is the PUBLIC qualifier set (the organizer published it,
        # references and all, when the contest opened), so shipping it out is
        # not an egress of anything secret; the sealed sets never leave the
        # scoring machine and scores are still the only thing that comes back.
        dev_corpus = (ccfg.get("dev_corpus") or "").strip()
        if not dev_corpus:
            print(f"  ✗ {contest_id}: this relay holds no dev_corpus, so the "
                  f"exchange cannot carry the public qualifier corpus and "
                  f"the air-gapped node could not re-execute the gate. "
                  f"Nothing exported for this contest (fail-safe) — add "
                  f"contests[{contest_id}].dev_corpus (the PUBLIC qualifier "
                  f"set) to node.json.")
            continue
        dev_corpus_path = Path(dev_corpus).expanduser()
        if not dev_corpus_path.is_file():
            print(f"  ✗ {contest_id}: contests[{contest_id}].dev_corpus "
                  f"{dev_corpus!r} is not on this machine — nothing exported "
                  f"for this contest (fail-safe).")
            continue
        dev_corpus_bytes = dev_corpus_path.read_bytes()
        dev_corpus_sha = hashlib.sha256(dev_corpus_bytes).hexdigest()
        rows = _fetch_rows("authorization_requests", {
            "sealed_set_id": f"eq.{secret_set}",
            "state": "eq.authorized",
            "order": "created_at.asc",
            "select": "request_id,sealed_set_id,state,fingerprint,method_sha,"
                      "corpus_id,corpus_version,node_measurement,requested_by"})
        for req in rows:
            request_id = req["request_id"]
            dest = exchange / "requests" / request_id
            done_marker = exchange / "scores" / request_id / ".relayed.json"
            if dest.exists() or done_marker.exists():
                continue
            bound = str(req.get("node_measurement") or "")
            if relay_node and bound != relay_node:
                print(f"  · {request_id}: bound to node {bound or '?'!r}, "
                      f"not this relay's air-gapped node {relay_node!r} — "
                      f"NOT exported. (It is served somewhere else; the "
                      f"air-gapped node would refuse the fingerprint, and a "
                      f"method bundle would have crossed the gap for "
                      f"nothing.)")
                continue
            object_path = (f"{contest_id}/{req['requested_by']}/"
                           f"{request_id}.tar.gz")
            try:
                bundle = _storage_download(object_path)
            except RuntimeError as e:
                print(f"  ✗ {request_id}: bundle download failed: {e}")
                continue
            actual = hashlib.sha256(bundle).hexdigest()
            if actual != req["method_sha"]:
                print(f"  ✗ {request_id}: bucket bytes hash {actual[:16]}… "
                      f"but the request froze {req['method_sha'][:16]}… — "
                      f"NOT exporting a mismatched artifact.")
                continue
            # The public gate, relay half (2026-09-06: replaces the retired
            # "published T1 record" check). The relay reads the CLAIM only —
            # the bundle's qualifier receipt must exist and name this set's
            # active qualifier.
            #
            # This is the CHEAP half: refuse to put work on the medium at
            # all when the bundle carries no receipt for this set's active
            # qualifier. The real gate is the air-gapped node re-EXECUTING
            # the method on the public dev corpus and measuring the score
            # itself (sandbox_runner.verify_qualifier_by_execution), which
            # exchange version 2 makes possible by shipping the qualifier row
            # and the dev corpus below. The receipt's NUMBER is not trusted
            # anywhere: it is a claim, checked against a measurement.
            qualifier = resolve_contest_qualifier(secret_set)
            claim = (manifest_from_bundle_bytes(bundle) or {}).get("qualifier")
            claimed_id = (claim or {}).get("qualifierId")
            if not qualifier:
                print(f"  ✗ {request_id}: sealed set {secret_set} has no "
                      f"registered qualifier — refusing to export anything "
                      f"against an ungated set (fail-safe).")
                continue
            if not claim:
                print(f"  ✗ {request_id}: the bundle carries no qualifier "
                      f"receipt (manifest.qualifier) — not exporting; the "
                      f"airgap machine only ever sees work that cleared the "
                      f"public gate.")
                continue
            if claimed_id != qualifier["qualifier_id"]:
                print(f"  ✗ {request_id}: bundle's receipt cleared "
                      f"{claimed_id!r}, but this set's active qualifier is "
                      f"{qualifier['qualifier_id']!r} — not exporting.")
                continue
            _audit_request_created_once(req, contest_id, cfg["node_id"])
            audit_head = rpc("authorization_audit_head", {})
            write_exchange_request(
                exchange, request_id=request_id, contest_id=contest_id,
                request_row=req, bundle_bytes=bundle, audit_head=audit_head,
                note=RELAY_EXPORT_NOTE,
                extra={
                    # The qualifiers row (042) verbatim: which gate, what
                    # threshold, on which metric, in which year.
                    "qualifier": qualifier,
                    "qualifier_corpus": {
                        "file": QUALIFIER_CORPUS_FILE,
                        "sha256": dev_corpus_sha,
                        "_note": ("The PUBLIC qualifier dev set, references "
                                  "included — the organizer published it when "
                                  "the contest opened. It travels so the "
                                  "air-gapped node can re-execute the public "
                                  "gate itself; no sealed corpus ever does."),
                    },
                },
                extra_files={QUALIFIER_CORPUS_FILE: dev_corpus_bytes})
            exported.append(request_id)
            print(f"  → exported {request_id} ({len(bundle)} bytes) for the "
                  f"airgap node")
    return exported


# ---------------------------------------------------------------------------
# Lane dispatch (mirror of sandbox_runner.run_method_request): a declarative-
# model bundle is validated code-free (Lane A); a runnable bundle gets the §3
# static checks (Lane B). ONE helper, so import_bundle and stage_request
# cannot drift apart — what stage-request accepts is exactly what import
# accepts.
# ---------------------------------------------------------------------------

def _lane_checks(manifest: dict | None, bundle_dir: Path,
                 tarball: Path | None, *, expected_corpus_id: str | None,
                 ccfg: dict, cfg: dict,
                 contest_id: str | None = None) -> tuple[str, dict, str]:
    """Return (lane, checks, block_label) for an extracted bundle.

    ``contests[<id>].prize_terms_sha256`` is the contest's frozen prize-terms
    digest, carried across the air gap in node.json because the scoring
    machine cannot read ``contests.metadata``. When it is declared the
    acceptance in the bundle's manifest is CHECKED (a mismatch, or none at
    all, is a BLOCK); when it is not, the acceptance stays a labelled WARN —
    the same two states ``accepted_terms_findings`` documents, never a silent
    pass.
    """
    lane = (manifest or {}).get("submissionKind", "runnable-bundle")
    terms_sha = (ccfg or {}).get("prize_terms_sha256")
    if lane == "declarative-model":
        from mt_eval_harness.model_runner import validate_declarative_bundle
        arch_policy = (
            (ccfg.get("declarative") or {}).get("architecture_policy")
            or (cfg.get("declarative") or {}).get("architecture_policy"))
        checks = validate_declarative_bundle(
            bundle_dir, tarball_path=tarball,
            expected_corpus_id=expected_corpus_id,
            architecture_policy=arch_policy,
            contest_terms_sha=terms_sha, contest_id=contest_id)
        block_label = "declarative validation BLOCKS this bundle (Lane A)"
    else:
        checks = run_static_checks(
            bundle_dir, tarball_path=tarball,
            expected_corpus_id=expected_corpus_id,
            contest_terms_sha=terms_sha, contest_id=contest_id)
        block_label = "static checks BLOCK this bundle (spec §3)"
    return lane, checks, block_label


# ---------------------------------------------------------------------------
# ORGANIZER side, no database — stage a local bundle as an exchange request.
# ---------------------------------------------------------------------------

def stage_request(bundle_path: str | Path, *, contest_id: str,
                  requested_by: str, exchange_dir: str | Path,
                  corpus_version: str = "v1",
                  secret_set_id: str | None = None,
                  request_id: str | None = None,
                  config_path: str | Path | None = None) -> dict:
    """Stage a method bundle file as an AUTHORIZED exchange request — the
    shape the relay's requests-OUT half writes — with no Supabase anywhere.

    For a rehearsal or a DB-less deployment: the organizer holds the bundle
    as a file, `node.json` names the node and the contest's sealed set, and
    the airgapped node imports the result with `mt-eval node import-bundle`
    exactly as it would a relay export. Pre-validation is the SAME extract →
    lane dispatch → static-check path import runs (a BLOCK refuses staging
    outright — nothing is written). The fingerprint is bound to
    ``cfg["node_id"]`` through the one recipe (queue_runner.
    compute_request_fingerprint), so a node whose id differs refuses the
    request at run time (fail-closed node binding).

    Honest limit, written into the request: no authorization_requests row
    exists, so the returned scores are manifest-verifiable but can never be
    relay-published (the relay's scores-IN half: "no such authorization
    request").
    """
    import shutil
    import tempfile

    from mt_eval_harness.contest_node import extract_bundle, load_node_config
    from mt_eval_harness.external_scoring import HypothesesFormatError
    from mt_eval_harness.queue_runner import compute_request_fingerprint

    cfg = load_node_config(config_path)
    node_id = cfg["node_id"]
    ccfg = cfg["contests"].get(contest_id)
    if ccfg is None:
        raise AirgapTransportError(
            f"node.json serves no contest {contest_id!r} (configured: "
            f"{', '.join(sorted(cfg['contests'])) or 'none'}) — a staged "
            f"request must target a contest this node's config knows.")
    configured_set = ccfg.get("secret_set_id")
    if secret_set_id and configured_set and secret_set_id != configured_set:
        raise AirgapTransportError(
            f"--secret-set {secret_set_id!r} but node.json contests"
            f"[{contest_id}].secret_set_id is {configured_set!r} — refusing "
            f"to stage a request against a set this node does not serve.")
    sealed_set_id = secret_set_id or configured_set
    if not sealed_set_id:
        raise AirgapTransportError(
            f"contests[{contest_id}] has no secret_set_id and none was given "
            f"(--secret-set) — the request must name the sealed set it "
            f"targets.")
    if not requested_by or not str(requested_by).strip():
        raise AirgapTransportError(
            "--requested-by is required: the request row records who the "
            "method belongs to (the relay export carries the JWT email; a "
            "staged request has to say it explicitly).")
    requested_by = str(requested_by).strip()
    corpus_version = str(corpus_version or "").strip()
    if not corpus_version:
        raise AirgapTransportError("--corpus-version must not be empty.")

    src = Path(bundle_path).expanduser()
    if not src.is_file():
        raise AirgapTransportError(f"bundle not found: {src}")
    bundle_bytes = src.read_bytes()
    method_sha = hashlib.sha256(bundle_bytes).hexdigest()

    request_id = request_id or f"authreq-{uuid.uuid4().hex}"
    if not _REQUEST_ID_RE.match(request_id):
        raise AirgapTransportError(
            f"--request-id {request_id!r} is not a safe directory name "
            f"(letters, digits, '.', '_', '-'; ≤128 chars).")
    exchange = Path(exchange_dir)
    if (exchange / "requests" / request_id).exists():
        raise AirgapTransportError(
            f"{exchange / 'requests' / request_id} already exists — refusing "
            f"to overwrite an exchange request.")

    # Pre-validate EXACTLY as import would: safe-extract into scratch, lane
    # dispatch, static checks. A BLOCK refuses staging (nothing written).
    scratch_root = Path(cfg.get("scratch_dir", tempfile.gettempdir()))
    scratch_root.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="stage-request-", dir=scratch_root))
    try:
        try:
            manifest = extract_bundle(bundle_bytes, scratch / "bundle")
        except (HypothesesFormatError, json.JSONDecodeError,
                tarfile.TarError, OSError, EOFError) as e:
            raise AirgapTransportError(
                f"bundle unreadable — refusing to stage: {e}") from e
        lane, checks, block_label = _lane_checks(
            manifest, scratch / "bundle", src,
            expected_corpus_id=sealed_set_id, ccfg=ccfg, cfg=cfg,
            contest_id=contest_id)
        for w in checks["warns"]:
            print(f"    ⚠ {w['detail']}")
        if checks["blocked"]:
            reasons = "; ".join(b["detail"] for b in checks["blocks"][:8])
            raise AirgapTransportError(
                f"{block_label}: {reasons} — the airgapped node would stage "
                f"it 'rejected' at import, so nothing is written.")
    finally:
        shutil.rmtree(scratch, ignore_errors=True)

    fingerprint = compute_request_fingerprint(
        {"method_sha": method_sha, "corpus_id": sealed_set_id,
         "corpus_version": corpus_version},
        node_measurement=node_id)
    # The relay's exact row shape (its authorization_requests select list),
    # already 'authorized': the organizer staging it IS the authorization —
    # there is no custodian decision recorded anywhere else.
    request_row = {
        "request_id": request_id,
        "sealed_set_id": sealed_set_id,
        "state": "authorized",
        "fingerprint": fingerprint,
        "method_sha": method_sha,
        "corpus_id": sealed_set_id,
        "corpus_version": corpus_version,
        "node_measurement": node_id,
        "requested_by": requested_by,
    }
    dest = write_exchange_request(
        exchange, request_id=request_id, contest_id=contest_id,
        request_row=request_row, bundle_bytes=bundle_bytes,
        audit_head=None, note=STAGED_REQUEST_NOTE,
        extra={"origin": "stage-request"})
    print(f"  ✓ staged {request_id} [{lane}] → {dest}")
    print(f"     method_sha  {method_sha}")
    print(f"     fingerprint {fingerprint}")
    print(f"     bound to    node '{node_id}', {sealed_set_id} "
          f"{corpus_version}")
    print("     OFFLINE staging: no authorization_requests row exists; the "
          "scores come back manifest-verifiable, never relay-publishable.")
    return {
        "request_id": request_id,
        "method_sha": method_sha,
        "fingerprint": fingerprint,
        "sealed_set_id": sealed_set_id,
        "corpus_version": corpus_version,
        "node_id": node_id,
        "lane": lane,
        "warns": len(checks["warns"]),
        "path": str(dest),
    }


# ---------------------------------------------------------------------------
# AIRGAPPED side — import, run (via sandbox_runner), export.
# ---------------------------------------------------------------------------

def import_bundle(exchange_dir: str | Path, *,
                  config_path: str | Path | None = None) -> list[str]:
    """Validate + stage every exported request; §3 static checks run NOW."""
    from mt_eval_harness.contest_node import extract_bundle, load_node_config
    from mt_eval_harness.external_scoring import HypothesesFormatError

    cfg = load_node_config(config_path)
    state_dir = _airgap_state_dir(cfg)
    exchange = Path(exchange_dir)
    requests_dir = exchange / "requests"
    if not requests_dir.is_dir():
        raise AirgapTransportError(
            f"{exchange} has no requests/ directory — is this the exchange "
            f"medium the connected relay wrote?")

    imported: list[str] = []
    for entry in sorted(requests_dir.iterdir()):
        if not entry.is_dir():
            continue
        request_id = entry.name
        if (state_dir / request_id / "state.json").exists():
            # Already staged: say what it is, rather than leaving the operator
            # with a bare "Nothing new to import" for a request they can see
            # on the medium.
            prior = _read_state(state_dir, request_id)
            print(f"  • {request_id}: already staged here "
                  f"(status {prior.get('status')!r}"
                  + (f": {prior['reason']}" if prior.get("reason") else "")
                  + ") — not re-imported.")
            continue
        try:
            meta = json.loads((entry / "request.json").read_text(
                encoding="utf-8"))
            request = meta["request"]
            bundle_bytes = (entry / "method.tar.gz").read_bytes()
        except (OSError, json.JSONDecodeError, KeyError) as e:
            print(f"  ✗ {request_id}: unreadable export ({e}) — skipping")
            continue
        # Format check FIRST, by name, before anything in the export is read
        # as if it meant what this version means. A version-1 export carries
        # no qualifier facts, so reading it as a version-2 one would silently
        # turn "the node re-executes the public gate" into "no gate ran".
        found_version = str(meta.get("exchange_version") or "(none)")
        if found_version != EXCHANGE_VERSION:
            print(f"  ✗ {request_id}: exchange_version {found_version!r}, but "
                  f"this node speaks {EXCHANGE_VERSION!r} — REFUSED, not "
                  f"partially read. Re-export the request from a relay "
                  f"running this harness version (version 2 carries the "
                  f"qualifier row and the public dev corpus the node needs to "
                  f"re-execute the public gate).")
            continue
        state = {
            "request_id": request_id,
            "contest_id": meta.get("contest_id"),
            "request": request,
            "exchange_version": found_version,
            "origin": meta.get("origin"),
            "audit_head_at_export": meta.get("audit_head_at_export"),
            "imported_at": datetime.now(timezone.utc).isoformat(),
            # The PUBLIC gate this node re-executes before it opens anything
            # sealed (exchange version 2). ``qualifier`` is the qualifiers
            # row; ``qualifier_corpus`` is the staged local copy of the public
            # dev set, verified against the exporter's pin below.
            "qualifier": meta.get("qualifier"),
            "qualifier_corpus": None,
            # The participant's declarations (track, primary/contrastive,
            # description, release url, constraints, byline). They travel back
            # in the score bundle because the CONNECTED relay — not this
            # machine — writes the contest_submissions row, and it has no
            # other copy of them (the bundle stays on the airgapped side).
            "manifest": None,
        }
        actual = hashlib.sha256(bundle_bytes).hexdigest()
        if actual != request.get("method_sha"):
            state.update({"status": "rejected",
                          "reason": f"bundle bytes hash {actual} but the "
                                    f"request froze {request.get('method_sha')} "
                                    f"— refusing tampered/mismatched artifact."})
            _write_state(state_dir, request_id, state)
            print(f"  ✗ {request_id}: method_sha mismatch — staged as rejected")
            continue
        bundle_dir = state_dir / request_id / "bundle"
        (state_dir / request_id).mkdir(parents=True, exist_ok=True)
        (state_dir / request_id / "bundle.tar.gz").write_bytes(bundle_bytes)

        # Stage the public qualifier corpus, pin-checked. A corpus whose
        # bytes are not the bytes the relay pinned is not staged at all: a
        # gate measured on a different dev set is not this contest's gate.
        qc = meta.get("qualifier_corpus")
        if isinstance(qc, dict) and qc.get("file"):
            src = entry / str(qc["file"])
            if not src.is_file():
                print(f"  ✗ {request_id}: request.json names qualifier corpus "
                      f"{qc['file']!r} but the export does not contain it — "
                      f"skipping (re-export from the relay).")
                continue
            blob = src.read_bytes()
            actual = hashlib.sha256(blob).hexdigest()
            pinned = str(qc.get("sha256") or "").strip().lower()
            if pinned and actual != pinned:
                print(f"  ✗ {request_id}: the exported qualifier corpus "
                      f"hashes to {actual} but the export pins {pinned} — "
                      f"skipping; the public gate must be measured on the "
                      f"corpus the organizer published.")
                continue
            staged = state_dir / request_id / QUALIFIER_CORPUS_FILE
            staged.write_bytes(blob)
            state["qualifier_corpus"] = {"path": str(staged),
                                         "sha256": actual}
        try:
            manifest = extract_bundle(bundle_bytes, bundle_dir)
        except (HypothesesFormatError, json.JSONDecodeError) as e:
            state.update({"status": "rejected",
                          "reason": f"bundle unreadable: {e}"})
            _write_state(state_dir, request_id, state)
            print(f"  ✗ {request_id}: {e} — staged as rejected")
            continue
        state["manifest"] = manifest
        # Lane dispatch (shared with stage_request via _lane_checks). Either
        # way a BLOCK is staged as rejected and travels back as a signed
        # 'rejected' bundle.
        ccfg = cfg["contests"].get(meta.get("contest_id")) or {}
        tarball = state_dir / request_id / "bundle.tar.gz"
        lane, checks, block_label = _lane_checks(
            manifest, bundle_dir, tarball,
            expected_corpus_id=request.get("sealed_set_id"),
            ccfg=ccfg, cfg=cfg, contest_id=meta.get("contest_id"))
        if checks["blocked"]:
            reasons = "; ".join(b["detail"] for b in checks["blocks"][:8])
            state.update({"status": "rejected", "lane": lane,
                          "reason": f"{block_label}: {reasons}"})
            print(f"  ✗ {request_id}: validation blocked — staged as rejected")
        else:
            state.update({"status": "imported", "lane": lane,
                          "static_warns": len(checks["warns"])})
            if needs_custodian_decision(request):
                # An entrant's proposal: it waits for a custodian, exactly as
                # a pending request does on the connected lane. The ledger
                # records its arrival now.
                ledger = _local_ledger(state_dir)
                _ensure_request_in_ledger(ledger, request_id, state,
                                          cfg["node_id"])
                print(f"  ✓ {request_id}: imported [{lane}] "
                      f"({len(checks['warns'])} warning(s)) — an entrant's "
                      f"proposal, PENDING custodian approval. First the node "
                      f"checks it: `mt-eval node run-method {request_id} "
                      f"--offline` re-executes the entrant's qualifier on the "
                      f"public dev set (and checks a container runtime for a "
                      f"code entry) — nothing sealed is opened. Then a "
                      f"custodian records the decision on this node: "
                      f"`mt-eval node approve {request_id} --offline --actor "
                      f"<custodian>` (or `mt-eval node deny {request_id} "
                      f"--offline --actor <custodian> --reason …`); then "
                      f"`mt-eval node run-method {request_id} --offline` "
                      f"runs it.")
            else:
                print(f"  ✓ {request_id}: imported [{lane}] "
                      f"({len(checks['warns'])} warning(s)) — run it with "
                      f"`mt-eval node run-method {request_id} --offline`")
        _write_state(state_dir, request_id, state)
        imported.append(request_id)
    if not imported:
        print("  Nothing new to import.")
    return imported


# ---------------------------------------------------------------------------
# AIRGAPPED side — the custodian's decision on an entrant's offline proposal.
#
# An entrant's `contest submit-method --offline` writes a request in state
# 'pending' — exactly what the connected lane files in authorization_requests,
# where a custodian must `node approve` it before `node run-method` will
# execute it. On an air-gapped node there is no database, and until
# 2026-10-03 there was no way to record that decision at all: `node list` and
# `node approve` both needed the service key, the import hint went straight to
# `run-method`, and run-method executed a pending proposal without anyone's
# approval (synthetic researcher, Round 4). The decision is now recorded
# HERE, with the machinery the node already has:
#
#   * the node's hash-chained local ledger (sovereign.local_ledger — the
#     migration-040 design the threshold lane already writes): request_created
#     when the proposal is imported, then vote_cast + request_authorized (or
#     request_denied) when the custodian decides;
#   * a decision record (state_dir/<request>/approval.json or denial.json)
#     naming the request, its fingerprint and method sha, the actor and the
#     ledger row, signed with the node's score-signing key (node.json
#     signing_key) — the same Ed25519 key that signs the scores.
#
# The ORDER is the guide's (Step 9): `node run-method --offline` on a pending
# proposal first runs the node's own checks — the entrant's qualifier
# re-executed on the public dev set, and for a code entry a container runtime
# and the sandbox caps — and records a pass in the ledger as the node's
# vote_cast (NODE_CHECK); `node approve --offline` refuses until that record
# exists for the request's exact fingerprint and bytes (until 2026-10-03 it
# signed straight after import with neither check run — synthetic researcher,
# Round 5).
#
# `node run-method --offline` then requires, for a pending proposal, the
# ledger to verify, replay the request as authorized, AND the signed approval
# to verify and match — the offline equivalent of the connected lane's state
# check — and re-runs every check before anything sealed opens. A
# request that arrived already authorized (a relay export, which the database
# authorized; a `node stage-request`, where the staging organizer is the
# authorization) needs no second decision, exactly as before.
# ---------------------------------------------------------------------------

#: The decision records written next to a request's state.json.
APPROVAL_FILE = "approval.json"
DENIAL_FILE = "denial.json"


def _local_ledger(state_dir: Path):
    from mt_eval_harness.sovereign.local_ledger import LocalLedger
    return LocalLedger(state_dir / "authorization-ledger.jsonl")


def needs_custodian_decision(request: dict) -> bool:
    """True when a staged request still needs a custodian's approval on this
    node: it arrived 'pending' (an entrant's offline proposal)."""
    return str((request or {}).get("state") or "") == "pending"


def _node_signing_key(cfg: dict) -> Path:
    """node.json's signing_key as a usable private key file, or a refusal."""
    raw = str(cfg.get("signing_key") or "").strip()
    if not raw or raw.startswith("<"):
        raise AirgapTransportError(
            "node.json has no signing_key, and a custodian decision on this "
            "node is signed with it (the same key that signs exported "
            "scores). Generate one on THIS machine with `mt-eval node "
            "keygen --out <dir>` and set signing_key to the .key.json it "
            "writes.")
    path = Path(raw).expanduser()
    if not path.is_file():
        raise AirgapTransportError(
            f"node.json signing_key {raw!r} is not a file on this machine.")
    return path


def _node_public_key_der(key_path: Path) -> bytes:
    """The public half of the node's signing key (the .key.json `mt-eval
    node keygen` writes carries only the private half; Ed25519 derives the
    public one)."""
    import base64
    try:
        data = json.loads(key_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AirgapTransportError(
            f"signing_key {key_path} is not readable key JSON ({exc}).") from exc
    if isinstance(data, dict) and data.get("publicKeyDerB64"):
        return base64.b64decode(data["publicKeyDerB64"])
    if not _python_signer_available():
        raise AirgapTransportError(
            "verifying a custodian decision needs the node's crypto extra: "
            "python3 -m pip install 'mt-eval-harness[node]' (the offline node bundle "
            "carries it).")
    from cryptography.hazmat.primitives import serialization
    from mt_eval_harness.sovereign.threshold_seal import load_key_material
    priv = serialization.load_der_private_key(
        load_key_material(str(key_path), want="private"), password=None)
    return priv.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo)


def _verify_decision_signature(record_path: Path, key_path: Path) -> str | None:
    """None when ``record_path`` carries a valid node signature, else why not."""
    from mt_eval_harness.sovereign.threshold_seal import (
        ThresholdSealError,
        verify_payload,
    )
    sig_path = record_path.with_name(record_path.name + ".sig.json")
    if not record_path.is_file():
        return f"{record_path.name} is missing"
    if not sig_path.is_file():
        return f"{sig_path.name} is missing (the decision is unsigned)"
    try:
        block = json.loads(sig_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return f"{sig_path.name} is unreadable ({exc})"
    payload = record_path.read_bytes()
    if block.get("payloadSha256") != hashlib.sha256(payload).hexdigest():
        return f"{record_path.name} changed after it was signed"
    if not _python_signer_available():
        return ("the node's crypto extra is not installed "
                "(python3 -m pip install 'mt-eval-harness[node]')")
    try:
        ok = verify_payload(payload, block.get("signatureB64", ""),
                            _node_public_key_der(key_path))
    except (ThresholdSealError, ValueError) as exc:
        return f"signature check failed ({exc})"
    return None if ok else "the signature is not this node's signing key's"


def _ensure_request_in_ledger(ledger, request_id: str, state: dict,
                              node_id: str) -> None:
    """Append request_created for a proposal the ledger has not seen."""
    if request_id in ledger.replay_state()["requests"]:
        return
    request = state.get("request") or {}
    ledger.append(
        "request_created", sealed_set_id=request.get("sealed_set_id"),
        request_id=request_id, actor=request.get("requested_by"),
        fingerprint=request.get("fingerprint"),
        detail={"lane": "offline-proposal", "node": node_id,
                "origin": state.get("origin"),
                "contest_id": state.get("contest_id"),
                "method_sha": request.get("method_sha"),
                "corpus_version": request.get("corpus_version")})


def decide_offline(request_id: str, *, decision: str, actor: str,
                   reason: str | None = None,
                   config_path: str | Path | None = None) -> dict:
    """Record a custodian's approve/deny of an imported pending proposal on
    THIS (air-gapped) node — no database, no service key.

    Writes vote_cast + request_authorized (or request_denied) to the node's
    local ledger and a decision record signed with the node's signing key;
    see the section comment above for what `run-method --offline` checks.
    A denial stages the request 'rejected' with the reason, so `node
    export-scores` carries a signed refusal back to the entrant.
    """
    from mt_eval_harness.contest_node import load_node_config

    if decision not in ("approve", "deny"):
        raise AirgapTransportError(f"decision must be approve or deny "
                                   f"(got {decision!r}).")
    actor = str(actor or "").strip()
    if not actor:
        raise AirgapTransportError("--actor is required: the decision is "
                                   "recorded under who made it.")
    if decision == "deny" and not str(reason or "").strip():
        raise AirgapTransportError("--reason is required to deny (it travels "
                                   "back to the entrant).")
    cfg = load_node_config(config_path)
    node_id = cfg["node_id"]
    state_dir = _airgap_state_dir(cfg)
    state = _read_state(state_dir, request_id)
    request = state.get("request") or {}
    if state.get("status") != "imported":
        raise AirgapTransportError(
            f"{request_id} is {state.get('status')!r} on this node — only an "
            f"imported request awaits a decision"
            + (f" (reason: {state['reason']})" if state.get("reason") else "")
            + ".")
    if not needs_custodian_decision(request):
        raise AirgapTransportError(
            f"{request_id} arrived {request.get('state')!r} (origin "
            f"{state.get('origin') or 'relay export'}): it was authorized "
            f"before it reached this node, so there is no pending decision "
            f"here — run it with `mt-eval node run-method {request_id} "
            f"--offline`.")
    key_path = _node_signing_key(cfg)   # refuse BEFORE touching the ledger
    ledger = _local_ledger(state_dir)
    chain = ledger.verify_chain()
    if not chain["ok"]:
        raise AirgapTransportError(
            f"the local ledger {ledger.path} does not verify "
            f"({chain['reason']}) — no decision is appended to a broken "
            f"chain. Restore it from its anchored head first.")
    _ensure_request_in_ledger(ledger, request_id, state, node_id)
    replayed = ledger.replay_state()["requests"][request_id]
    if replayed["state"] != "pending":
        raise AirgapTransportError(
            f"{request_id} is already {replayed['state']!r} in this node's "
            f"ledger — only a pending request can be decided.")
    if replayed.get("fingerprint") != request.get("fingerprint"):
        raise AirgapTransportError(
            f"the ledger recorded {request_id} with a different fingerprint "
            f"than the staged request — refusing to decide on a request that "
            f"changed after it was imported.")
    # The guide's order (Step 9): the node re-executes the entrant's qualifier
    # on the public dev set — and checks it can run a code entry at all —
    # BEFORE a custodian is asked to approve. An approval with neither check
    # recorded used to be signed straight after import (synthetic
    # researcher, Round 5). A denial needs no prior check: a custodian may
    # refuse at any time.
    verification = None
    if decision == "approve":
        verification = node_verification(ledger, request_id, request, node_id)
        first = (f"`mt-eval node run-method {request_id} --offline` first — "
                 f"it re-executes the entrant's qualifier on the public dev "
                 f"set (and, for a code entry, checks this node has a "
                 f"container runtime and the sandbox caps fit) and records "
                 f"the result in this node's ledger. Nothing sealed is "
                 f"opened by it. Then approve.")
        if verification is None:
            raise AirgapTransportError(
                f"{request_id} cannot be approved yet: this node has not "
                f"recorded a passing re-execution of the entrant's qualifier "
                f"for this request. Run {first}")
        if (state.get("lane", "runnable-bundle") != "declarative-model"
                and not (verification.get("detail") or {}).get(
                    "container_runtime")):
            raise AirgapTransportError(
                f"{request_id} is a code entry, and this node's recorded "
                f"check names no container runtime it could run it with. "
                f"Run {first}")
    vote = {"vote": decision, "node": node_id, "lane": "offline"}
    if decision == "deny":
        vote["reason"] = str(reason).strip()
    ledger.append("vote_cast", sealed_set_id=request.get("sealed_set_id"),
                  request_id=request_id, actor=actor,
                  fingerprint=request.get("fingerprint"), detail=vote)
    if decision == "approve":
        entry = ledger.append(
            "request_authorized", sealed_set_id=request.get("sealed_set_id"),
            request_id=request_id, actor=actor,
            fingerprint=request.get("fingerprint"),
            detail={"policy": "per-submission", "lane": "offline",
                    "node": node_id})
    else:
        entry = ledger.append(
            "request_denied", sealed_set_id=request.get("sealed_set_id"),
            request_id=request_id, actor=actor,
            fingerprint=request.get("fingerprint"),
            detail={"reason": str(reason).strip(), "lane": "offline",
                    "node": node_id})
    record = {
        "request_id": request_id,
        "decision": "authorized" if decision == "approve" else "denied",
        "actor": actor,
        "node_id": node_id,
        "contest_id": state.get("contest_id"),
        "sealed_set_id": request.get("sealed_set_id"),
        "fingerprint": request.get("fingerprint"),
        "method_sha": request.get("method_sha"),
        "requested_by": request.get("requested_by"),
        "reason": (str(reason).strip() if decision == "deny" else None),
        "decided_at": datetime.now(timezone.utc).isoformat(),
        "ledger_row_hash": entry["row_hash"],
        # The node's own check this approval was given on (None for a
        # denial, which needs none).
        "node_verification_row_hash": (verification or {}).get("row_hash"),
        "_note": ("A custodian's decision recorded on an air-gapped scoring "
                  "node: the ledger row named here is in the node's local "
                  "hash-chained ledger; this file is signed with the node's "
                  "score-signing key."),
    }
    record_path = state_dir / request_id / (
        APPROVAL_FILE if decision == "approve" else DENIAL_FILE)
    record_path.write_text(
        json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True)
        + "\n", encoding="utf-8")
    sign_file(record_path, key_path)
    state["authorization"] = {
        "state": record["decision"], "actor": actor,
        "decided_at": record["decided_at"],
        "ledger_row_hash": entry["row_hash"], "record": record_path.name,
        "lane": "offline"}
    if decision == "deny":
        state.update({"status": "rejected",
                      "reason": f"denied by custodian {actor}: "
                                f"{str(reason).strip()}"})
    _write_state(state_dir, request_id, state)
    if decision == "approve":
        _gap = (state.get("qualifier_gate") or {}).get("receipt_gap")
        if _gap:
            # Said again at the moment of approval: the custodian approved
            # with the receipt-vs-node gap in front of them.
            print(f"  ⚠ Approved with a flagged qualifier gap: "
                  f"{_gap['message']}")
        print(f"  ✅ {request_id} authorized by {actor} on node '{node_id}' "
              f"(ledger row {entry['row_hash'][:16]}…, signed "
              f"{record_path.name}). Run it with `mt-eval node run-method "
              f"{request_id} --offline`.")
    else:
        print(f"  ✗ {request_id} denied by {actor}: {str(reason).strip()} — "
              f"`mt-eval node export-scores <exchange-dir>` carries the "
              f"signed refusal back to the entrant.")
    return {"request_id": request_id, "decision": record["decision"],
            "ledger_row_hash": entry["row_hash"],
            "record": str(record_path)}


def offline_authorization(request_id: str, state: dict, state_dir: Path,
                          cfg: dict) -> dict:
    """The authorization a staged request runs under on this node, or a
    refusal (AirgapTransportError) — checked BEFORE anything else runs.

    Arrived authorized (relay export / stage-request) → that is its
    authorization. Arrived pending (an entrant's offline proposal) → it needs
    a custodian approval recorded HERE: the ledger verifies, replays the
    request as authorized with the staged fingerprint, and the signed
    approval verifies under the node's key and names this request.
    """
    request = state.get("request") or {}
    if str(request.get("state") or "") == "authorized":
        return {"basis": "arrived-authorized",
                "origin": state.get("origin") or "relay-export"}
    if not needs_custodian_decision(request):
        raise AirgapTransportError(
            f"{request_id} arrived in state {request.get('state')!r} — only "
            f"an authorized request, or a pending one a custodian approved "
            f"on this node, can run.")
    approve_cmd = (f"`mt-eval node approve {request_id} --offline --actor "
                   f"<custodian>` (or `node deny … --offline --reason …`)")
    ledger = _local_ledger(state_dir)
    chain = ledger.verify_chain()
    if not chain["ok"]:
        raise AirgapTransportError(
            f"{request_id}: the local ledger does not verify "
            f"({chain['reason']}) — an approval in a broken chain is not an "
            f"approval. Refusing to run.")
    replayed = ledger.replay_state()["requests"].get(request_id)
    if replayed is None or replayed["state"] == "pending":
        raise AirgapTransportError(
            f"{request_id} is an entrant's proposal awaiting custodian "
            f"approval on this node — nothing runs until a custodian records "
            f"it: {approve_cmd}, then re-run `mt-eval node run-method "
            f"{request_id} --offline`. (`mt-eval node list --offline` shows "
            f"what is waiting.)")
    if replayed["state"] != "authorized":
        raise AirgapTransportError(
            f"{request_id} is {replayed['state']!r} in this node's ledger — "
            f"it will not run.")
    if replayed.get("fingerprint") != request.get("fingerprint"):
        raise AirgapTransportError(
            f"{request_id}: the ledger authorized a different fingerprint "
            f"than the staged request — refusing to run.")
    record_path = state_dir / request_id / APPROVAL_FILE
    problem = _verify_decision_signature(record_path, _node_signing_key(cfg))
    if problem:
        raise AirgapTransportError(
            f"{request_id}: the custodian approval does not verify — "
            f"{problem}. Refusing to run; record the decision again with "
            f"{approve_cmd}.")
    record = json.loads(record_path.read_text(encoding="utf-8"))
    for key in ("request_id", "fingerprint", "method_sha"):
        expected = request_id if key == "request_id" else request.get(key)
        if record.get(key) != expected:
            raise AirgapTransportError(
                f"{request_id}: the signed approval names {key} "
                f"{record.get(key)!r}, not this request's {expected!r} — "
                f"refusing to run.")
    if record.get("decision") != "authorized":
        raise AirgapTransportError(
            f"{request_id}: the signed decision is {record.get('decision')!r}.")
    rows = {e.get("row_hash"): e for e in ledger.entries()}
    row = rows.get(record.get("ledger_row_hash"))
    if not row or row.get("event_type") != "request_authorized" \
            or row.get("request_id") != request_id:
        raise AirgapTransportError(
            f"{request_id}: the signed approval points at ledger row "
            f"{str(record.get('ledger_row_hash'))[:16]}…, which is not this "
            f"request's authorization in the local ledger — refusing to run.")
    return {"basis": "custodian-approved-offline",
            "actor": record.get("actor"),
            "decided_at": record.get("decided_at"),
            "ledger_row_hash": record.get("ledger_row_hash")}


#: The node's own pre-approval record in its local ledger: a ``vote_cast``
#: by ``node:<node_id>`` whose detail says the public gate was re-executed
#: here and cleared (and, for a code entry, that a container runtime and the
#: sandbox caps fit). The ledger's event vocabulary is closed and identical
#: to migration 040's, so the record is a vote, cast by the node, before any
#: custodian's — never a new event type.
NODE_CHECK = "pre-approval"


def _custodian_decided_here(request_id: str, state_dir: Path) -> bool:
    """True once this node's ledger replays the request past 'pending'."""
    ledger = _local_ledger(state_dir)
    if not ledger.path.exists():
        return False
    replayed = ledger.replay_state()["requests"].get(request_id)
    return bool(replayed) and replayed["state"] != "pending"


def node_verification(ledger, request_id: str, request: dict,
                      node_id: str) -> dict | None:
    """This node's latest passing pre-approval check for ``request`` (the
    ledger row), or None. Bound to the request's fingerprint and method sha:
    a check recorded for other bytes does not count."""
    found = None
    for e in ledger.entries():
        detail = e.get("detail") or {}
        if (e.get("event_type") == "vote_cast"
                and e.get("request_id") == request_id
                and e.get("actor") == f"node:{node_id}"
                and detail.get("check") == NODE_CHECK
                and detail.get("vote") == "eligible"
                and e.get("fingerprint") == request.get("fingerprint")
                and detail.get("method_sha") == request.get("method_sha")):
            found = e
    return found


def _verify_before_approval(request_id: str, state: dict, state_dir: Path,
                            cfg: dict, *, runner, translator) -> dict:
    """`node run-method --offline` on a pending proposal: the node's checks
    before a custodian is asked, recorded in the local ledger.

    Runs _checks_before_custody (phase "pre-approval"): the entrant's
    qualifier re-executed on the public dev set and, for a code entry, the
    container runtime + sandbox caps. A pass is appended to the ledger as the
    node's ``vote_cast`` (NODE_CHECK) — what `node approve --offline`
    requires. A qualifier miss stages the request rejected and records the
    node's ``request_denied``; `node export-scores` carries it back. Node
    problems raise and leave the request as it was.
    """
    node_id = cfg["node_id"]
    request = state["request"]
    ledger = _local_ledger(state_dir)
    chain = ledger.verify_chain()
    if not chain["ok"]:
        raise AirgapTransportError(
            f"the local ledger {ledger.path} does not verify "
            f"({chain['reason']}) — nothing is recorded in a broken chain. "
            f"Restore it from its anchored head first.")
    _ensure_request_in_ledger(ledger, request_id, state, node_id)
    approve_cmd = (f"`mt-eval node approve {request_id} --offline --actor "
                   f"<custodian>` (or `mt-eval node deny {request_id} "
                   f"--offline --actor <custodian> --reason …`)")
    done = node_verification(ledger, request_id, request, node_id)
    if done is not None:
        print(f"  ⏸ {request_id}: this node already re-executed the public "
              f"gate for these exact bytes (ledger row "
              f"{done['row_hash'][:16]}…); it waits for a custodian: "
              f"{approve_cmd}. Nothing sealed has been opened.")
        return state
    pre = _checks_before_custody(request_id, state, state_dir, cfg,
                                 runner=runner, translator=translator,
                                 phase=NODE_CHECK)
    if pre["outcome"] == "rejected":
        ledger.append(
            "request_denied", sealed_set_id=request.get("sealed_set_id"),
            request_id=request_id, actor=f"node:{node_id}",
            fingerprint=request.get("fingerprint"),
            detail={"reason": state.get("reason"), "lane": "offline",
                    "check": NODE_CHECK, "node": node_id})
        print("    The custodians are not asked: the method did not clear "
              "the public gate. `mt-eval node export-scores <exchange-dir>` "
              "carries the refusal back to the entrant.")
        return state
    gate = state.get("qualifier_gate") or {}
    detail = {
        "vote": "eligible", "check": NODE_CHECK, "lane": "offline",
        "node": node_id, "method_sha": request.get("method_sha"),
        "submission_lane": pre["lane"],
        "qualifier": {k: gate.get(k) for k in (
            "qualifier_id", "claimed", "measured", "threshold", "source",
            "receipt_gap") if k != "receipt_gap" or gate.get(k)},
        # The container runtime that will run a code entry; None for a
        # declarative (Lane A) entry, which runs in the node's own engine.
        "container_runtime": pre.get("runtime"),
    }
    entry = ledger.append(
        "vote_cast", sealed_set_id=request.get("sealed_set_id"),
        request_id=request_id, actor=f"node:{node_id}",
        fingerprint=request.get("fingerprint"), detail=detail)
    state["node_verification"] = {
        "ledger_row_hash": entry["row_hash"],
        "recorded_at": entry.get("created_at"), **detail}
    _write_state(state_dir, request_id, state)
    runtime_note = (f"; container runtime {pre['runtime']} and the sandbox "
                    f"caps fit" if pre.get("runtime") else "")
    print(f"  ⏸ {request_id}: the node's checks passed (public gate "
          f"re-executed{runtime_note}; ledger row {entry['row_hash'][:16]}…). "
          f"Nothing sealed has been opened. Next, a custodian decides: "
          f"{approve_cmd}; then re-run `mt-eval node run-method {request_id} "
          f"--offline`.")
    if gate.get("receipt_gap"):
        print(f"  ⚠ For the custodian: {gate['receipt_gap']['message']}")
    return state


def list_offline(config_path: str | Path | None = None,
                 contest_id: str | None = None) -> list[dict]:
    """`node list --offline`: what this air-gapped node holds, read from its
    own state dir and ledger — no database, no service key."""
    from mt_eval_harness.contest_node import load_node_config

    cfg = load_node_config(config_path)
    state_dir = _airgap_state_dir(cfg)
    rows: list[dict] = []
    replayed = {}
    ledger = _local_ledger(state_dir)
    if ledger.path.exists():
        replayed = ledger.replay_state()["requests"]
    for entry in sorted(state_dir.iterdir()) if state_dir.is_dir() else []:
        if not (entry / "state.json").is_file():
            continue
        state = json.loads((entry / "state.json").read_text(encoding="utf-8"))
        if contest_id and state.get("contest_id") != contest_id:
            continue
        request = state.get("request") or {}
        rid = state.get("request_id") or entry.name
        status = state.get("status")
        decided = (replayed.get(rid) or {}).get("state")
        checked = (ledger.path.exists() and node_verification(
            ledger, rid, request, cfg["node_id"]) is not None)
        if status == "imported" and needs_custodian_decision(request) \
                and decided != "authorized" and not checked:
            step = (f"← node checks first: mt-eval node run-method {rid} "
                    f"--offline (re-executes the qualifier; opens nothing "
                    f"sealed)")
            auth = "awaiting the node's checks, then custodian approval"
        elif status == "imported" and needs_custodian_decision(request) \
                and decided != "authorized":
            step = (f"← approve/deny: mt-eval node approve {rid} --offline "
                    f"--actor <custodian>")
            auth = "node checks passed; awaiting custodian approval"
        elif status == "imported":
            step = f"← run: mt-eval node run-method {rid} --offline"
            auth = ("custodian-approved here" if decided == "authorized"
                    else "arrived authorized")
        elif status in ("scored", "failed", "rejected") \
                and not state.get("exported_at"):
            step = "← mt-eval node export-scores <exchange-dir>"
            auth = (state.get("authorization") or {}).get("state") or "-"
        else:
            step = ""
            auth = (state.get("authorization") or {}).get("state") or "-"
        row = {"request_id": rid, "contest_id": state.get("contest_id"),
               "status": status, "authorization": auth,
               "requested_by": request.get("requested_by"),
               "method_sha": request.get("method_sha"),
               "lane": state.get("lane"), "next": step}
        rows.append(row)
        print(f"  {rid}  [{status}]  {auth}  "
              f"contest={state.get('contest_id')}  "
              f"sha={str(request.get('method_sha') or '')[:12]}…  {step}")
    if not rows:
        print(f"  Nothing staged under {state_dir} — import an exchange "
              f"directory with `mt-eval node import-bundle <dir>`.")
    return rows


def _checks_before_custody(request_id: str, state: dict, state_dir: Path,
                           cfg: dict, *, runner, translator,
                           phase: str = "run") -> dict:
    """Everything an imported request must pass before any custody step:
    the contest entry, the node binding, the re-scan of the staged bytes,
    whether THIS node can run a code entry at all (a container runtime and
    the sandbox caps), and THE PUBLIC GATE re-executed on this machine.

    ``phase="pre-approval"`` is the run on an entrant's pending proposal
    before a custodian is asked (the guide's Step 9 order); there a missing
    gate is a refusal. ``phase="run"`` is the sealed run itself, after the
    authorization check — it re-runs every check (nothing recorded earlier
    is trusted in place of a measurement).

    Returns ``{outcome, contest_id, ccfg, lane, runtime}`` with outcome
    ``passed`` (gate measured and cleared), ``unmeasured`` (a DB-less lane
    at run time with no gate facts — recorded loudly on the state) or
    ``rejected`` (the gate refused it; the state is staged rejected). Node
    problems RAISE AirgapTransportError and leave the request as it was.
    """
    from mt_eval_harness.queue_runner import compute_request_fingerprint

    node_id = cfg["node_id"]
    request = state["request"]
    sealed_set_id = request["sealed_set_id"]

    contest_id = state.get("contest_id") or next(
        (cid for cid, c in cfg["contests"].items()
         if c.get("secret_set_id") == sealed_set_id), None)
    ccfg = (cfg["contests"].get(contest_id) or {}) if contest_id else {}
    if ccfg.get("secret_set_id") != sealed_set_id:
        raise AirgapTransportError(
            f"This node's config serves no contest with secret_set_id "
            f"{sealed_set_id!r} — the airgapped node needs the same "
            f"secret_artifact/secret_privkey entries as the runbook's "
            f"Phase B config template.")

    # Node binding: the fingerprint must recompute under THIS node's id.
    expected = compute_request_fingerprint(
        {"method_sha": request["method_sha"], "corpus_id": request["corpus_id"],
         "corpus_version": request["corpus_version"]},
        node_measurement=node_id)
    if expected != request["fingerprint"]:
        state.update({"status": "failed",
                      "reason": f"request fingerprint is bound to node "
                                f"{request['node_measurement']!r} but this "
                                f"airgapped node is {node_id!r} — refusing "
                                f"(fail-closed node binding)."})
        _write_state(state_dir, request_id, state)
        raise AirgapTransportError(state["reason"])

    # Import-scan-before-running: the import-time checks ran at import; re-
    # verify the STAGED bytes and re-run them now (per lane), so a bundle
    # tampered with on the node's own disk between import and run is caught
    # (defense in depth).
    lane = state.get("lane", "runnable-bundle")
    staged_tarball = state_dir / request_id / "bundle.tar.gz"
    if staged_tarball.is_file():
        staged_sha = hashlib.sha256(staged_tarball.read_bytes()).hexdigest()
        if staged_sha != request.get("method_sha"):
            state.update({"status": "failed",
                          "reason": f"staged bundle bytes hash {staged_sha} "
                                    f"but the request froze "
                                    f"{request.get('method_sha')} — the "
                                    f"staged artifact changed after import."})
            _write_state(state_dir, request_id, state)
            raise AirgapTransportError(state["reason"])
    _recheck_kwargs = dict(
        tarball_path=staged_tarball if staged_tarball.is_file() else None,
        expected_corpus_id=sealed_set_id,
        # The frozen prize-terms digest the organizer carried across the gap
        # (node.json). Declared → the acceptance in the manifest is checked
        # here too, so a bundle swapped on the node's own disk between import
        # and run cannot arrive under terms its author never accepted.
        contest_terms_sha=ccfg.get("prize_terms_sha256"),
        contest_id=contest_id)
    if lane == "declarative-model":
        from mt_eval_harness.model_runner import validate_declarative_bundle
        _recheck_kwargs["architecture_policy"] = (
            (ccfg.get("declarative") or {}).get("architecture_policy")
            or (cfg.get("declarative") or {}).get("architecture_policy"))
        recheck = validate_declarative_bundle(
            state_dir / request_id / "bundle", **_recheck_kwargs)
        recheck_label = "declarative validation BLOCKS at run time (re-scan)"
    else:
        recheck = run_static_checks(
            state_dir / request_id / "bundle", **_recheck_kwargs)
        recheck_label = "static checks BLOCK at run time (spec §3, re-scan)"
    if recheck["blocked"]:
        reasons = "; ".join(b["detail"] for b in recheck["blocks"][:8])
        state.update({"status": "failed",
                      "reason": f"{recheck_label}: {reasons}"})
        _write_state(state_dir, request_id, state)
        raise AirgapTransportError(state["reason"])

    # THE PUBLIC GATE, measured by THIS machine (exchange version 2). The
    # participant's receipt is a claim they made on their own hardware; the
    # node re-executes the same artifact on the same PUBLIC dev corpus through
    # the same lane executor and gates on what it measures. It runs before the
    # custody ceremony and before a single sealed byte is decrypted, so a
    # method that cannot clear the public bar never causes custodians to be
    # convened. This closes the honest gap the sneakernet lane carried while
    # the exchange format had no qualifier facts to work from.
    from mt_eval_harness.sandbox_runner import (
        NodeSetupError,
        ResourceRequestRefused,
        preflight_node_fit,
        resource_refusal_next_steps,
        verify_qualifier_by_execution,
    )

    # Before the gate: can THIS node run this bundle at all (Lane B)? A node
    # with no container runtime, or a bundle that asks for more than the
    # node's sandbox allows, used to surface as "qualifier not met" (or a raw
    # `[Errno 2] … 'docker'`) and left the request permanently 'rejected', so
    # the entrant repackaged and resubmitted twice for an organizer config
    # value (synthetic researcher persona, Round 3, 2026-10-03). Both are now
    # refusals that say what they are and leave the request 'imported'.
    fit = None
    if lane != "declarative-model":
        try:
            fit = preflight_node_fit(state.get("manifest"),
                                     ccfg.get("sandbox") or cfg.get("sandbox"),
                                     runner=runner)
        except ResourceRequestRefused as exc:
            raise AirgapTransportError(
                f"{request_id}: {exc} " + resource_refusal_next_steps(
                    exc, request_id=request_id, offline=True)) from exc
        except NodeSetupError as exc:
            raise AirgapTransportError(
                f"{request_id}: {exc} The request is unchanged (still "
                f"imported); re-run `mt-eval node run-method {request_id} "
                f"--offline` once the node is fixed.") from exc
    qualifier = state.get("qualifier")
    qualifier_corpus = (state.get("qualifier_corpus") or {}).get("path")
    qualifier_source = "exchange"
    if not (qualifier and qualifier_corpus):
        # Fallback for the DB-less lanes (`node stage-request`, a
        # participant's `submit-method --offline`): there is no relay and no
        # database, so the organizer declares the gate on the SCORING machine
        # instead — contests[<id>].qualifier (the qualifier block) plus
        # contests[<id>].dev_corpus (the public dev set). Both or neither: a
        # threshold with no corpus, or a corpus with no threshold, is not a
        # gate, and half a gate is never treated as one.
        declared_q = ccfg.get("qualifier")
        declared_corpus = (ccfg.get("dev_corpus") or "").strip()
        if isinstance(declared_q, dict) and declared_q and declared_corpus:
            if not Path(declared_corpus).expanduser().is_file():
                raise AirgapTransportError(
                    f"contests[{contest_id}].dev_corpus "
                    f"{declared_corpus!r} is not on this node, so the public "
                    f"gate cannot be measured — refusing to open a sealed set "
                    f"for a method that has not cleared it.")
            qualifier = declared_q
            qualifier_corpus = str(Path(declared_corpus).expanduser())
            qualifier_source = "node.json"
    if qualifier and qualifier_corpus and Path(qualifier_corpus).is_file():
        gate = verify_qualifier_by_execution(
            state_dir / request_id / "bundle", lane,
            {**ccfg, "dev_corpus": qualifier_corpus}, qualifier,
            manifest=state.get("manifest"),
            work_dir=state_dir / request_id / "qualifier-run",
            output_dir=state_dir / request_id / "runs" / "qualifier",
            node_id=node_id,
            language_pair=ccfg.get("language_pair", ">"),
            sandbox_cfg=ccfg.get("sandbox") or cfg.get("sandbox"),
            runner=runner, translator=translator,
            architecture_policy=(
                (ccfg.get("declarative") or {}).get("architecture_policy")
                or (cfg.get("declarative") or {}).get("architecture_policy")))
        if not gate["eligible"]:
            reason = (f"qualifier not met on node re-execution (claimed "
                      f"{gate['claimed']}, measured {gate['measured']}, "
                      f"threshold {gate['threshold']}, all on the chrF++ "
                      f"0-100 qualifier scale — corpus chrF++ of the dev "
                      f"outputs): {gate['reason']}")
            state.update({"status": "rejected", "reason": reason,
                          "qualifier_gate": {"verified": True,
                                             "eligible": False,
                                             "source": qualifier_source,
                                             "claimed": gate["claimed"],
                                             "measured": gate["measured"],
                                             "threshold": gate["threshold"],
                                             "qualifier_id": gate["qualifier_id"],
                                             # e.g. the source-copy refusal
                                             "refusal": gate.get("refusal")}})
            _write_state(state_dir, request_id, state)
            print(f"  ✗ {request_id}: {reason}")
            return {"outcome": "rejected", "contest_id": contest_id,
                    "ccfg": ccfg, "lane": lane}
        state["qualifier_gate"] = {
            "verified": True, "eligible": True, "source": qualifier_source,
            "claimed": gate["claimed"], "measured": gate["measured"],
            "threshold": gate["threshold"],
            "qualifier_id": gate["qualifier_id"],
            "metric": gate.get("metric")}
        if gate.get("metric_note"):
            # The qualifier named the retired composite: gated on chrF++,
            # and the custodian sees how its threshold was read.
            state["qualifier_gate"]["metric_note"] = gate["metric_note"]
        if gate.get("receipt_gap"):
            # A flag for the custodian, recorded with the node's check —
            # never a refusal (qualifier_gate.QUALIFIER_RECEIPT_GAP_POINTS).
            state["qualifier_gate"]["receipt_gap"] = gate["receipt_gap"]
        print(f"    ✓ {request_id}: qualifier {gate['qualifier_id']} "
              f"re-executed on this air-gapped node at chrF++ "
              f"{gate['measured']} ≥ {gate['threshold']} on the chrF++ "
              f"0-100 qualifier scale (participant claimed "
              f"{gate['claimed']}; gate facts from {qualifier_source})")
        if gate.get("metric_note"):
            print(f"      Note: {gate['metric_note']}")
        if gate.get("receipt_gap"):
            print(f"    ⚠ {request_id}: {gate['receipt_gap']['message']}")
    elif state.get("origin") and phase == "pre-approval":
        # An entrant's proposal is about to be put to a custodian: the guide
        # promises the public gate was measured first. With no qualifier
        # facts there is nothing to measure, so there is nothing a custodian
        # can be asked to approve (the run-time branch below keeps its
        # recorded, loud "not measured" for the lanes that need no approval).
        raise AirgapTransportError(
            f"{request_id}: contests[{contest_id}] declares no public "
            f"qualifier gate (`qualifier` + `dev_corpus` in node.json) and "
            f"the proposal carried none, so this node cannot re-execute the "
            f"entrant's qualifier — and a custodian is never asked to approve "
            f"a method whose qualifier was not measured. Declare both "
            f"(`mt-eval node init --from-contest <prepare-out>` fills them "
            f"from the contest's manifest), then re-run `mt-eval node "
            f"run-method {request_id} --offline`. The request is unchanged "
            f"(still imported).")
    elif state.get("origin"):
        # The DB-less lanes (`node stage-request`, `submit-method --offline`):
        # no relay wrote this export and this node declares no qualifier
        # either, so there is nothing to re-execute the gate against. Say it
        # out loud and RECORD it — never a silent pass. Scores from these
        # lanes are manifest-verifiable but can never be relay-published
        # (the relay refuses them: "no such authorization request"), so the gap
        # cannot reach a published board.
        state["qualifier_gate"] = {
            "verified": False,
            "reason": (f"origin={state['origin']}: neither the exchange nor "
                       f"this node's config carried qualifier facts, so the "
                       f"public gate was NOT measured on this machine"),
        }
        print(f"    ⚠ {request_id}: the public qualifier gate was NOT "
              f"re-executed — this request came from the DB-less "
              f"'{state['origin']}' lane and no qualifier facts travelled "
              f"with it, and contests[{contest_id}] declares none "
              f"(`qualifier` + `dev_corpus`). The scores are "
              f"manifest-verifiable but never relay-publishable.")
    else:
        raise AirgapTransportError(
            f"{request_id} carries no qualifier facts (the qualifiers row and "
            f"the public dev corpus), so this node cannot re-execute the "
            f"public gate — and it will not open a sealed set for a method "
            f"that has not cleared it. Re-export the request from a relay "
            f"running exchange version {EXCHANGE_VERSION} "
            f"(`mt-eval node relay`), which ships both.")

    return {"outcome": ("passed" if (state.get("qualifier_gate") or {}).get(
                            "verified") else "unmeasured"),
            "contest_id": contest_id, "ccfg": ccfg, "lane": lane,
            "runtime": (fit or {}).get("runtime")}



def run_imported(request_id: str, *,
                 config_path: str | Path | None = None,
                 runner=subprocess.run, translator=None,
                 share_paths: list[str | Path] | None = None,
                 assert_airgap: bool | None = None) -> dict:
    """Offline §6/§7 execution + scoring of an imported request; the result
    is staged locally as a fully-validated aggregates-only run-card row.

    Two EXECUTION lanes (chosen from the imported bundle's
    ``submissionKind``): the declarative engine (Lane A, ``translator``
    injects it for tests) or the --network=none sandbox (Lane B, ``runner``
    injects the container runtime).

    Two CUSTODY lanes for the sealed corpus, one code path each way:
      * ``share_paths`` given → THRESHOLD lane: custodians present M-of-N
        ceremony shares; the local hash-chained ledger records the request/
        votes/grant; the set key is reconstructed in executor memory only
        (sovereign.sealed_run.quorum_unseal_for_run).
      * no shares → the honestly-labeled single-keypair STAND-IN
        (``secret_privkey`` in node.json), unchanged.

    ``assert_airgap`` (or node.json ``airgap.assert_airgap: true``) makes the
    executor refuse to run unless the egress self-check proves no route out
    — set it on the real node; leave it off on connected dev machines.

    THE PUBLIC GATE runs first, on this machine: the submitted artifact is
    re-executed on the exported PUBLIC dev corpus through the same lane
    executor and scored by the same scorer, and a miss is a refusal with
    claimed-vs-measured named — the same message the connected node produces.
    The facts come from the exchange (version 2) or, for the DB-less lanes,
    from ``contests[<id>].qualifier`` + ``dev_corpus`` in node.json. A relay
    export that carries neither is REFUSED; a DB-less one records, loudly,
    that the gate was not measured.

    EVERY DECLARED SPLIT rides this one authorization (contract C6/D1): the
    contest's sealed holdout (``holdout_set_id``/``holdout_corpus``) and its
    ``test_suites``. Under threshold custody one ceremony opens both sealed
    artifacts. The suite aggregates ride the main card; the holdout is its own
    row, and the relay ALWAYS withholds it until the contest closes.
    """
    from mt_eval_harness.contest_node import (
        load_node_config,
        resolve_secret_corpus,
        wipe_scratch_file,
    )
    from mt_eval_harness.publish import (
        assemble_run_card,
        build_run_card_row,
        validate_row,
    )

    cfg = load_node_config(config_path)
    node_id = cfg["node_id"]
    state_dir = _airgap_state_dir(cfg)
    state = _read_state(state_dir, request_id)
    if state.get("status") != "imported":
        raise AirgapTransportError(
            f"{request_id} is {state.get('status')!r} — only an 'imported' "
            f"request can run"
            + (f" (reason: {state.get('reason')})"
               if state.get("reason") else "."))
    request = state["request"]
    sealed_set_id = request["sealed_set_id"]

    # An entrant's proposal no custodian has decided yet: this run is the
    # node's own checks BEFORE a custodian is asked (the guide's Step 9
    # order, as the connected lane's run-method does for a pending request)
    # — the entrant's qualifier re-executed on the public dev set, and, for
    # a code entry, a container runtime and the sandbox caps. Public data
    # only; nothing sealed is opened, and nothing runs past this point until
    # a custodian's approval is recorded (offline_authorization below).
    # `node approve --offline` refuses until this has passed.
    if (needs_custodian_decision(request)
            and not _custodian_decided_here(request_id, state_dir)):
        return _verify_before_approval(request_id, state, state_dir, cfg,
                                       runner=runner, translator=translator)

    # THE CUSTODIAN GATE, before anything sealed runs: a pending proposal
    # runs only once a custodian's approval is recorded on this node (signed,
    # ledger-anchored — offline_authorization), the offline equivalent of the
    # connected lane's `state == 'authorized'` check. Nothing is consumed and
    # the request stays 'imported' when it refuses.
    state["authorization_checked"] = offline_authorization(
        request_id, state, state_dir, cfg)

    # Egress self-check (fail-closed refusal, nothing consumed).
    if assert_airgap is None:
        assert_airgap = bool((cfg.get("airgap") or {}).get("assert_airgap"))
    if assert_airgap:
        from mt_eval_harness.sovereign.airgap_ops import (
            EgressError,
            assert_airgapped,
        )
        try:
            assert_airgapped()
        except EgressError as e:
            raise AirgapTransportError(str(e)) from e

    pre = _checks_before_custody(request_id, state, state_dir, cfg,
                                 runner=runner, translator=translator,
                                 phase="run")
    if pre["outcome"] == "rejected":
        return state
    contest_id, ccfg, lane = pre["contest_id"], pre["ccfg"], pre["lane"]

    # Custody policy: a contest may DECLARE that its sealed set is opened only
    # by a custodian quorum. In that case the single-keypair stand-in lane is
    # NOT a permitted fallback — no shares means no run, fail loud, never a
    # silent key-file open.
    custody = ccfg.get("custody", "single-key")
    if custody == "threshold-quorum" and not share_paths:
        raise AirgapTransportError(
            f"contest {contest_id!r} declares custody 'threshold-quorum': "
            f"this sealed set opens ONLY by presenting a custodian quorum. "
            f"Re-run with `run-method --share <share1.json> --share ...` "
            f"(M-of-N). Refusing the single-key fallback.")

    # Threshold lane: quorum-gated unseal against the local ledger. A
    # refusal here (no quorum / wrong shares) is logged tamper-evidently and
    # leaves the item 'imported' — runnable once a real quorum convenes.
    from mt_eval_harness.sandbox_runner import (
        build_extra_sets,
        grant_sets_detail,
        is_sealed_artifact_file,
        resolve_holdout_corpus,
    )
    unseal = None
    ledger = None
    corpus_path = None
    holdout_path = None
    holdout_is_scratch = False
    ceremony_holdout = None
    scratch = state_dir / request_id / "scratch"
    if share_paths:
        from mt_eval_harness.sovereign.local_ledger import LocalLedger
        from mt_eval_harness.sovereign.sealed_run import (
            SealedRunError,
            quorum_unseal_for_run,
        )
        artifact_path = ccfg.get("secret_artifact")
        if not artifact_path:
            raise AirgapTransportError(
                f"contests[{contest_id}] has no secret_artifact — the "
                f"threshold lane needs the sealed artifact to open.")
        # Contract D1: ONE ceremony opens every sealed split this run covers.
        # The holdout is only added when it is itself a sealed artifact — a
        # node that holds the holdout in the clear (a rehearsal) has nothing
        # for a quorum to open.
        artifact_paths = [Path(artifact_path).expanduser()]
        declared_holdout = ccfg.get("holdout_corpus")
        if declared_holdout and is_sealed_artifact_file(declared_holdout):
            artifact_paths.append(Path(declared_holdout).expanduser())
        ledger = LocalLedger(state_dir / "authorization-ledger.jsonl")
        try:
            unseal = quorum_unseal_for_run(
                artifact_paths=artifact_paths,
                share_paths=share_paths,
                ledger=ledger, node_id=node_id,
                method_sha=request["method_sha"],
                corpus_version=request["corpus_version"],
                requested_by=request.get("requested_by") or "unknown",
                scratch_dir=scratch,
                ttl_seconds=cfg.get("grant_ttl_seconds", 3600),
                # Contract D1 on the AIR-GAPPED chain: which splits this one
                # grant covers, named before it is minted and written onto
                # grant_used — the same detail the connected lane records
                # through contest_node.mint_and_claim_grant.
                used_detail=grant_sets_detail(ccfg))
        except SealedRunError as e:
            state["last_refusal"] = str(e)
            _write_state(state_dir, request_id, state)
            raise AirgapTransportError(str(e)) from e
        corpus_path = Path(unseal["corpus_path"])
        ceremony_holdout = next(
            (s["corpus_path"] for s in unseal.get("sets") or []
             if s.get("role") == "holdout"), None)

    try:
        if corpus_path is None:
            # The single-keypair stand-in lane (Wave-1): opened with a key
            # file, NO custodian quorum exercised. Say so out loud — this must
            # never look like a quorum-gated run in the operator's log.
            print(f"    ⚠ {request_id}: opening sealed set with the "
                  f"single-key stand-in (custody '{custody}'); NO custodian "
                  f"quorum was exercised. Declare custody 'threshold-quorum' "
                  f"in node.json to require M-of-N shares.")
            corpus_path = resolve_secret_corpus(ccfg, scratch)
        # Contract C6: the other sets this ONE authorized run covers — the
        # contest's sealed holdout split (practice 7) and its third-party
        # diagnostic suites (practice 14), exactly as the connected node runs
        # them. Same helpers, so the sneakernet lane cannot drift.
        holdout_path, holdout_is_scratch = resolve_holdout_corpus(
            ccfg, scratch, already_open=ceremony_holdout)
        if ccfg.get("test_suites"):
            # The connected node compares the suite ids with the suites the
            # contest froze (contest_node._assert_suites_match_contest); an
            # air-gapped node has no database to ask. Said, not skipped
            # quietly — once, here, where the suites run.
            print(f"    Note: {len(ccfg['test_suites'])} test suite(s) run "
                  f"from node.json's sha256-pinned copies; this offline "
                  f"node cannot compare their ids with the contest's frozen "
                  f"list (the connected node does).")
        extra_sets = build_extra_sets(ccfg, holdout_corpus=holdout_path)
        exec_kwargs = dict(
            bundle_dir=state_dir / request_id / "bundle",
            corpus_path=corpus_path,
            work_dir=scratch / "run",
            sealed_set_id=sealed_set_id,
            language_pair=ccfg.get("language_pair", ">"),
            node_id=node_id,
            submission={"contest_id": contest_id, "request_id": request_id,
                        "submitted_by": request.get("requested_by"),
                        "method_sha": request["method_sha"],
                        "transport": "airgap"},
            output_dir=state_dir / request_id / "runs",
            expected_corpus_id=sealed_set_id,
            extra_sets=extra_sets or None)
        if lane == "declarative-model":
            from mt_eval_harness.model_runner import (
                execute_and_score_declarative,
            )
            exec_kwargs["architecture_policy"] = (
                (ccfg.get("declarative") or {}).get("architecture_policy")
                or (cfg.get("declarative") or {}).get("architecture_policy"))
            if translator is not None:
                exec_kwargs["translator"] = translator
            result = execute_and_score_declarative(**exec_kwargs)
        else:
            from mt_eval_harness.sandbox_runner import execute_and_score
            result = execute_and_score(
                sandbox_cfg=ccfg.get("sandbox") or cfg.get("sandbox"),
                runner=runner, **exec_kwargs)
    except SandboxError as e:
        # Counts-only diagnostics travel back with the failure so the
        # participant learns the STAGE, not just "it failed" — the score
        # bundle carries them across the air gap (export_scores) and the
        # relay writes them to the request row (import_scores).
        state.update({
            "status": "failed",
            "reason": str(e),
            "execution": None,
            "diagnostics": (getattr(e, "diagnostics", None)
                            or failure_diagnostics("run")),
        })
        _write_state(state_dir, request_id, state)
        print(f"  ✗ {request_id}: {e}")
        return state
    finally:
        if corpus_path is not None:
            wipe_scratch_file(Path(corpus_path))
        if holdout_path is not None and holdout_is_scratch:
            wipe_scratch_file(Path(holdout_path))
        # §8: the whole run workspace goes, not just the decrypted corpora.
        # execute_and_score tears down its own work_dir, but the scratch ROOT
        # (and anything a failed run left beside it) is this function's to
        # clear — it is where the sealed corpus was opened and where the
        # method's raw output of that corpus was written.
        from mt_eval_harness.sandbox_runner import wipe_tree
        wipe_tree(scratch)

    # Build the EXACT row that will publish — aggregates-only by
    # construction; the connected relay re-validates and POSTs it verbatim.
    run_card, card_id, fingerprint_hash = assemble_run_card(
        result["report_path"])
    if lane == "declarative-model":
        affirmation = (
            f"Declarative model bundle (sha256 {request['method_sha']}) run on "
            f"the AIRGAPPED organizer node '{node_id}' in its trusted "
            f"inference engine (transformers, trust_remote_code=False; NO "
            f"participant code executed) against sealed corpus {sealed_set_id} "
            f"({request['corpus_version']}); scored by the reference holder; "
            f"transported as a signed scores-only bundle. Method identity is "
            f"code-free by construction; node identity is self-reported "
            f"(Wave-1). Published aggregates-only.")
    else:
        affirmation = (
            f"Method bundle (sha256 {request['method_sha']}) executed on the "
            f"AIRGAPPED organizer node '{node_id}' inside a network-isolated "
            f"container (--network=none) against sealed corpus "
            f"{sealed_set_id} ({request['corpus_version']}); scored by the "
            f"reference holder; transported as a signed scores-only bundle. "
            f"Method identity is execution-verified; node identity is "
            f"self-reported (Wave-1). Published aggregates-only.")
    # The BYLINE is the manifest's declared developer/method name, never
    # requested_by — that is the JWT email the request binds for RLS, and
    # run_cards.submitter is world-readable (same fix as the connected lane).
    try:
        byline = contest_declarations.submitter_label_from_manifest(
            state.get("manifest") or {})
    except contest_declarations.DeclarationError as e:
        state.update({"status": "failed",
                      "reason": f"no public byline for this run ({e}) — the "
                                f"staged manifest is missing or nameless; "
                                f"re-import the request."})
        _write_state(state_dir, request_id, state)
        raise AirgapTransportError(state["reason"]) from e
    row = build_run_card_row(
        run_card, card_id, fingerprint_hash,
        submitter=byline,
        trust="verified", affirmation=affirmation)
    problems = validate_row(row)
    if problems:
        state.update({"status": "failed",
                      "reason": f"run card row incomplete: {problems}"})
        _write_state(state_dir, request_id, state)
        raise AirgapTransportError(state["reason"])

    state.update({
        "status": "scored",
        "card_id": card_id,
        "row": row,
        "qualifier_score": result["qualifier_score"],
        "execution": result.get("execution"),
        "diagnostics": result.get("diagnostics"),
        "by_test_suite": result.get("by_test_suite") or {},
        "scored_at": datetime.now(timezone.utc).isoformat(),
    })

    # Practice 7 — the second sealed split, scored in the SAME authorized run.
    # It becomes its own aggregates-only row, travels in the same signed score
    # bundle, and the relay ALWAYS withholds it until the contest closes
    # (contract C5, force_defer). Built here, validated here: a holdout row
    # that the relay would reject must fail on this machine, not after it has
    # crossed the gap.
    holdout_result = result.get("holdout")
    if holdout_result:
        holdout_set_id = ccfg.get("holdout_set_id")
        h_card, h_card_id, h_fp = assemble_run_card(
            holdout_result["report_path"])
        h_row = build_run_card_row(
            h_card, h_card_id, h_fp, submitter=byline, trust="verified",
            affirmation=(
                f"{affirmation} HOLDOUT SPLIT: this card scores sealed set "
                f"{holdout_set_id}, the contest's second sealed split, "
                f"executed in the same authorized run as {sealed_set_id} "
                f"(one grant, both splits) and withheld until the contest "
                f"closes."))
        h_problems = validate_row(h_row)
        if h_problems:
            state.update({"status": "failed",
                          "reason": f"holdout run card row incomplete: "
                                    f"{h_problems}"})
            _write_state(state_dir, request_id, state)
            raise AirgapTransportError(state["reason"])
        state["holdout"] = {
            "sealed_set_id": holdout_set_id,
            "card_id": h_card_id,
            "row": h_row,
            "qualifier_score": holdout_result.get("qualifier_score"),
            "execution": holdout_result.get("execution"),
            "diagnostics": holdout_result.get("diagnostics"),
        }
        _h_scored = _sealed_headline(holdout_result)
        print(f"    ⏳ {request_id}: holdout {holdout_set_id} scored "
              f"({_h_scored}; run card {h_card_id}) — it travels in the "
              f"score bundle and the relay withholds it until the contest "
              f"closes.")
    if unseal is not None:
        state["authorization"] = {
            "lane": "threshold-quorum",
            "request_id": unseal["request_id"],
            "grant_id": unseal["grant_id"],
            "quorum": f"{unseal['presented']}-of-{unseal['n']}",
            "m": unseal["m"], "key_id": unseal["key_id"],
        }

    # Signed score manifest (node spec §5): scores + method hash + corpus
    # checksum + the LOCAL ledger head, signed with the node's key so anyone
    # holding the published pubkey can verify this exact record.
    try:
        from mt_eval_harness.sovereign.local_ledger import LocalLedger
        from mt_eval_harness.sovereign.score_manifest import (
            ScoreManifestError,
            build_score_manifest,
            sign_manifest_file,
            write_score_manifest,
        )
        ciphertext_digest = None
        artifact_file = ccfg.get("secret_artifact")
        if artifact_file and Path(artifact_file).expanduser().is_file():
            try:
                ciphertext_digest = json.loads(
                    Path(artifact_file).expanduser().read_text(
                        encoding="utf-8")).get("ciphertextDigest")
            except (json.JSONDecodeError, OSError):
                ciphertext_digest = None
        head = (unseal["ledger_head"] if unseal is not None
                else LocalLedger(
                    state_dir / "authorization-ledger.jsonl").head())
        # The method's public index record (V2 0b/7): a projection of the
        # bundle manifest that drops the contest binding and the email. Its
        # canonical bytes sit beside the score manifest; the manifest signs
        # its sha256, so the index entry is bound to exactly what was scored.
        from mt_eval_harness import __version__ as harness_version
        from mt_eval_harness.method_index import (
            MethodIndexError, canonical_bytes, engine_versions, index_record,
            index_record_sha256,
        )
        index_sha = None
        bundle_manifest_path = state_dir / request_id / "bundle" / "manifest.json"
        try:
            bundle_manifest = json.loads(
                bundle_manifest_path.read_text(encoding="utf-8"))
            record = index_record(
                bundle_manifest, method_sha=request["method_sha"],
                image_digest=(result.get("execution") or {}).get("image_digest"))
            index_sha = index_record_sha256(record)
            (state_dir / request_id / "index-record.json").write_bytes(
                canonical_bytes(record))
        except (OSError, json.JSONDecodeError, MethodIndexError) as e:
            print(f"    ⚠ no index record for {request_id}: {e}")
        report_overall = {}
        if result.get("report_path"):
            try:
                report_overall = json.loads(Path(result["report_path"]).read_text(
                    encoding="utf-8")).get("overall") or {}
            except (OSError, json.JSONDecodeError):
                report_overall = {}
        manifest = build_score_manifest(
            node_id=node_id, sealed_set_id=sealed_set_id,
            corpus_version=request["corpus_version"],
            corpus_ciphertext_digest=ciphertext_digest,
            method_sha256=request["method_sha"],
            # The scoring standard's numbers, each under its own name:
            # corpus chrF++ (0-100) with its 95% bootstrap CI — the headline
            # — and the standard metrics computed beside it. No composite
            # (retired, standard/1); the chrF++ signature rides in
            # metric_signatures.
            scores={"scoring_standard": result.get("scoring_standard")
                    or SCORING_STANDARD,
                    **{k: v for k, v in (
                        ("chrf_plus_plus", result.get("chrf_plus_plus")),
                        ("chrf_ci_lower", result.get("chrf_ci_lower")),
                        ("chrf_ci_upper", result.get("chrf_ci_upper")),
                        ("corpus_bleu", result.get("corpus_bleu")),
                        ("spbleu", result.get("spbleu")),
                        ("ter", result.get("ter")),
                        ("comet_score", result.get("comet_score")))
                       if v is not None}},
            audit_head=head,
            request_id=(unseal or {}).get("request_id") or request_id,
            grant_id=(unseal or {}).get("grant_id"),
            run_card_id=card_id,
            static_checks=result.get("static_checks"),
            harness_version=harness_version,
            engine_versions=engine_versions(),
            metric_signatures=report_overall.get("sacrebleu_signatures") or {},
            index_entry_sha256=index_sha)
        manifest_path = write_score_manifest(
            manifest, state_dir / request_id / "score-manifest.json")
        state["score_manifest"] = str(manifest_path)
        state["ledger_head"] = head
        if cfg.get("signing_key"):
            sig = sign_manifest_file(manifest_path, cfg["signing_key"])
            state["score_manifest_sig"] = str(sig)
        else:
            print("    ⚠ no signing_key in node.json — score manifest "
                  "written UNSIGNED (verify-manifest will refuse it; add a "
                  "signing key before publishing).")
    except ScoreManifestError as e:
        # A manifest refusal must never lose the scored state — record it.
        state["score_manifest_error"] = str(e)
        print(f"    ⚠ score manifest refused: {e}")

    _write_state(state_dir, request_id, state)
    _scored = _sealed_headline(result)
    print(f"  ✅ {request_id}: scored offline ({_scored}) — export with "
          f"`mt-eval node export-scores <exchange-dir>`")
    return state


def export_scores(exchange_dir: str | Path, *,
                  config_path: str | Path | None = None) -> list[str]:
    """Sign + write every scored/failed/rejected result not yet exported."""
    from mt_eval_harness.contest_node import load_node_config

    cfg = load_node_config(config_path)
    signing_key = cfg.get("signing_key")
    if not signing_key:
        raise AirgapTransportError(
            "node.json has no signing_key — generate one with `mt-eval node "
            "keygen --out <dir>` on THIS (airgapped) machine and give "
            "the .pub.json to the relay side. Unsigned score bundles are "
            "refused by the relay, so there is nothing useful to export "
            "without it.")
    state_dir = _airgap_state_dir(cfg)
    exchange = Path(exchange_dir)
    exported: list[str] = []
    for entry in sorted(state_dir.iterdir()) if state_dir.is_dir() else []:
        if not (entry / "state.json").exists():
            continue
        state = json.loads((entry / "state.json").read_text(encoding="utf-8"))
        status = state.get("status")
        if status not in ("scored", "failed", "rejected"):
            continue
        if state.get("exported_at"):
            continue
        request_id = state["request_id"]
        dest = exchange / "scores" / request_id
        dest.mkdir(parents=True, exist_ok=True)
        bundle = {
            "exchange_version": EXCHANGE_VERSION,
            "request_id": request_id,
            "contest_id": state.get("contest_id"),
            "sealed_set_id": state["request"]["sealed_set_id"],
            "fingerprint": state["request"]["fingerprint"],
            "method_sha": state["request"]["method_sha"],
            "corpus_version": state["request"]["corpus_version"],
            "node_id": cfg["node_id"],
            "status": "scored" if status == "scored" else "rejected",
            "reason": state.get("reason"),
            "card_id": state.get("card_id"),
            "qualifier_score": state.get("qualifier_score"),
            "row": state.get("row"),
            # The participant's own declarations, verbatim. The relay writes
            # the contest_submissions row and has no other copy of them (the
            # method bundle never leaves this machine).
            "manifest": state.get("manifest"),
            "execution": state.get("execution"),
            # The contest's SECOND sealed split, scored in the same authorized
            # run (contract C6/D1): its own aggregates-only row, published by
            # the relay through publish_or_defer with role='holdout' and
            # force_defer=True — always withheld until the contest closes.
            "holdout": state.get("holdout"),
            # Third-party diagnostic suites, aggregates only. They already
            # ride the main row (contract C4); repeated here so the relay's
            # log can say what the run covered without parsing the card.
            "by_test_suite": state.get("by_test_suite"),
            # The public gate, measured on the air-gapped machine (exchange
            # version 2) or explicitly NOT measured — never silently absent.
            "qualifier_gate": state.get("qualifier_gate"),
            # Who authorized the run, when the authorization was recorded on
            # this node (an entrant's offline proposal): the custodian, the
            # time and the local-ledger row — never silently absent.
            "authorization": state.get("authorization"),
            # Counts-only (execution_facts.no_text_guard) — safe to cross the
            # air gap: an outcome, a stage, an exit code and counts.
            "diagnostics": state.get("diagnostics"),
            "audit_head_at_export": state.get("audit_head_at_export"),
            "local_ledger_head": state.get("ledger_head"),
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "_note": ("Signed scores-only bundle from an airgapped scoring "
                      "node. The row is aggregates-only; RunLogs/TestReports "
                      "never leave the airgapped machine."),
        }
        payload_path = dest / "score-bundle.json"
        payload_path.write_text(
            json.dumps(bundle, ensure_ascii=False, indent=2, sort_keys=True)
            + "\n", encoding="utf-8")
        sign_file(payload_path, Path(signing_key).expanduser())
        state["exported_at"] = bundle["exported_at"]
        _write_state(state_dir, request_id, state)
        exported.append(request_id)
        print(f"  → exported signed score bundle for {request_id} "
              f"[{bundle['status']}]")
    if not exported:
        print("  Nothing to export.")
    return exported


# ---------------------------------------------------------------------------
# CONNECTED side, scores-IN half — verify + publish returned score bundles.
# relay() runs this FIRST: the .relayed.json marker it writes is what stops
# export_requests from putting the method tarball back on the medium.
# ---------------------------------------------------------------------------

def _relay_diagnostics(bundle: dict) -> None:
    """Write the airgap node's counts-only diagnostics to the request row.

    Called on BOTH relay outcomes: a rejected/failed bundle is exactly the
    case where the participant most needs the stage, and a published one
    still owes them the counts. Never fatal — a database that predates
    migration 074 has nowhere to put them, and a relay that refused to
    publish scores over a missing diagnostics column would be trading a real
    result for an optional one.
    """
    diagnostics = bundle.get("diagnostics")
    if not diagnostics:
        return
    try:
        record_execution_diagnostics(bundle["request_id"], diagnostics)
    except DiagnosticsColumnMissing as e:
        print(f"    ⚠ diagnostics not recorded: {e}")


def _mark_request_completed(request_id: str) -> None:
    """Record on the REQUEST ROW that this result has been recorded (075).

    Why it matters, and why it is not fatal. `export_requests` selects
    state='authorized', so this is what stops a relay from carrying a request
    whose scores already published back onto a FRESH exchange medium — the
    done-marker lives on the drive, and a drive can be lost, reformatted or
    simply be the second one. The row cannot forget.

    Non-fatal on purpose, the same posture as the counts-only diagnostics: a
    database that predates migration 075 has no 'completed' in its state CHECK
    and will refuse the write. Losing the row-level marker costs the fresh-
    medium protection; refusing to finish publishing a verified score over it
    would trade a real result for an optional one. Say so and carry on.
    """
    from mt_eval_harness.sovereign_service import service_request
    try:
        service_request("PATCH", "authorization_requests",
                        params={"request_id": f"eq.{request_id}"},
                        data={"state": "completed"})
    except Exception as e:  # noqa: BLE001 — reported, never fatal
        print(f"    ⚠ {request_id}: could not mark the request completed "
              f"({type(e).__name__}: {e}). The result IS recorded and this "
              f"medium's .relayed.json still retires it here, but a relay run "
              f"against a FRESH medium may export it again. Apply migration "
              f"075 (authorization_requests: authorized -> completed).")


def _import_one_score_bundle(entry: Path, cfg: dict, *, verify_key: str,
                             airgap_node_id: str) -> str | None:
    """Verify and publish ONE returned score bundle. The whole per-bundle pass.

    Returns the request id when the bundle was ACCEPTED (published, or
    withheld until the contest closes), or None when it was refused. Every
    refusal prints its reason; only a refusal the AIR-GAPPED NODE itself
    reported writes a `.relayed.json` marker, because that bundle is settled
    — nothing better will ever come back for it. Every other refusal leaves
    the medium untouched, so the round trip can be redone.

    This is one function so that `import_scores` can CONTAIN it. The paths
    below that raise rather than refuse — a grant that cannot be claimed, a
    publication policy that cannot be applied, a database error mid-publish —
    used to escape the loop and abort the whole pass, so a medium carrying
    several participants' scores published only the ones sorted before the
    first failure (SOVEREIGN_SMOKE 2026-09-07, closed relay finding). A
    raise out of here is now one participant's problem, not everybody's.

    Fail-closed order is load-bearing and unchanged: every check that can
    refuse the bundle runs BEFORE the single-use grant is claimed, so a
    refused bundle never consumes one, and nothing publishes half-way — a
    bundle whose declarations or row cannot be read whole is refused whole.

    One partial state a raise can still leave is a grant claimed and the
    card not published (a database error between the two). Writing no marker
    is the right answer there too: the next pass replays the bundle, mints a
    fresh grant and publishes. The card is not duplicated — both posts carry
    `resolution=ignore-duplicates` — so the cost of the retry is a second
    grant_used event in the audit trail, against a score that would
    otherwise be stranded on the medium forever. A marker would make that
    loss permanent.
    """
    from mt_eval_harness.contest_node import (
        _fetch_rows,
        mint_and_claim_grant,
        publish_or_defer,
    )
    from mt_eval_harness.publish import validate_row
    from mt_eval_harness.queue_runner import compute_request_fingerprint
    from mt_eval_harness.sandbox_runner import (
        grant_sets_detail,
        holdout_defer_key,
    )

    request_id = entry.name
    marker = entry / ".relayed.json"
    payload_path = entry / "score-bundle.json"
    sig_path = entry / "score-bundle.json.sig.json"
    if marker.exists() or not payload_path.exists():
        return None
    if not sig_path.exists():
        print(f"  ✗ {request_id}: unsigned score bundle — refused.")
        return None
    if not verify_file(payload_path, sig_path,
                       Path(verify_key).expanduser()):
        print(f"  ✗ {request_id}: SIGNATURE INVALID — score bundle "
              f"refused (not the airgap node's bytes).")
        return None
    bundle = json.loads(payload_path.read_text(encoding="utf-8"))
    bundle_sha = hashlib.sha256(payload_path.read_bytes()).hexdigest()

    reqs = _fetch_rows("authorization_requests", {
        "request_id": f"eq.{bundle['request_id']}",
        "select": "request_id,sealed_set_id,state,fingerprint,method_sha,"
                  "corpus_id,corpus_version,requested_by"})
    if not reqs:
        print(f"  ✗ {request_id}: no such authorization request — refused.")
        return None
    request = reqs[0]
    expected = compute_request_fingerprint(
        {"method_sha": request["method_sha"],
         "corpus_id": request["corpus_id"],
         "corpus_version": request["corpus_version"]},
        node_measurement=airgap_node_id)
    if not (bundle["fingerprint"] == request["fingerprint"] == expected):
        print(f"  ✗ {request_id}: fingerprint mismatch between the score "
              f"bundle, the frozen request, and the trusted airgap node "
              f"identity — refused.")
        return None
    if request["state"] != "authorized":
        print(f"  ✗ {request_id}: request is {request['state']!r} — only "
              f"an authorized request's scores may publish.")
        return None

    if bundle["status"] != "scored":
        # The airgapped node refused or failed the run: no grant, no
        # card. Record the outcome locally; the audit vocabulary (040,
        # deliberately closed) has no fitting event, so surfacing is the
        # organizer's (documented honest limit; §9.4 disputes deferred).
        # The counts-only diagnostics DO have a home (074) — write them
        # so `contest method-status` can tell the participant the stage.
        _relay_diagnostics(bundle)
        marker.write_text(json.dumps({
            "outcome": "rejected", "reason": bundle.get("reason"),
            "relayed_at": datetime.now(timezone.utc).isoformat(),
        }, indent=2) + "\n", encoding="utf-8")
        print(f"  ✗ {request_id}: airgap node reported "
              f"'{bundle.get('reason')}' — no score published.")
        return None

    row = bundle.get("row")
    if not row:
        print(f"  ✗ {request_id}: scored bundle has no run-card row — "
              f"refused.")
        return None
    problems = validate_row(row)
    if problems:
        print(f"  ✗ {request_id}: relayed row fails validation "
              f"({problems}) — refused.")
        return None
    # The submission row's declarations (track, primary/contrastive,
    # description, release url, constraints, public byline) live in the
    # manifest the score bundle carries — the relay has no other copy (the
    # method bundle stays on the airgapped machine). Checked BEFORE the
    # grant is claimed and the card published: a bundle that cannot
    # produce a complete submission row is refused whole, never published
    # half-way into a state where ranking would partition it wrongly.
    submission_fields = None
    entry_contest = None
    if bundle.get("contest_id"):
        # The contest row (WITH its metadata) — the relay is the publisher
        # here, so the publication policy the organizer promised
        # (results_visibility, contract C5) is read before anything is
        # written. A contest that is not on this database is a refusal:
        # publishing a card whose policy cannot be read is exactly the
        # thing hidden-until-close exists to prevent.
        contests = _fetch_rows("contests", {
            "id": f"eq.{bundle['contest_id']}",
            "select": "id,name,status,metadata"})
        if not contests:
            print(f"  ✗ {request_id}: contest "
                  f"{bundle['contest_id']!r} is not on this database, so "
                  f"its publication policy cannot be read — refused.")
            return None
        entry_contest = contests[0]
        manifest = bundle.get("manifest")
        if not manifest:
            print(f"  ✗ {request_id}: scored bundle carries no method "
                  f"manifest, so its contest_submissions declarations "
                  f"(track / primary / constraints / byline) are unknown "
                  f"— refused. Re-export from an airgap node that stages "
                  f"the manifest (import_bundle records it).")
            return None
        try:
            submission_fields = (
                contest_declarations.submission_fields_from_manifest(
                    manifest))
        except contest_declarations.DeclarationError as e:
            print(f"  ✗ {request_id}: the bundle's declarations are "
                  f"invalid ({e}) — refused.")
            return None

    mint_and_claim_grant(
        request["request_id"], request["fingerprint"],
        request["sealed_set_id"],
        node_id=airgap_node_id,
        ttl_seconds=cfg.get("grant_ttl_seconds", 3600),
        used_detail={
            "transport": "airgap-relay",
            "relayed_by": f"node:{cfg['node_id']}",
            "score_bundle_sha256": bundle_sha,
            "audit_head_at_export": bundle.get("audit_head_at_export"),
            # Contract D1 — which splits this one grant covered. Read from
            # what the air-gap node actually returned, not from the
            # relay's config: the relay does not hold the sealed sets.
            **grant_sets_detail({
                "holdout_set_id": (bundle.get("holdout") or {}).get(
                    "sealed_set_id"),
                "test_suites": [
                    {"suite_id": sid}
                    for sid in sorted(bundle.get("by_test_suite") or {})],
            }),
        })
    # Contract C5: the SAME publication policy as the connected node —
    # under results_visibility='hidden_until_close' the relayed row is
    # parked in contest_deferred_results and published by `contest close`,
    # never inserted into run_cards here. One implementation, two
    # transports.
    outcome = publish_or_defer(
        row,
        contest=entry_contest,
        request_id=request["request_id"],
        requested_by=request.get("requested_by"),
        notes=f"airgap-node executed ({request_id})",
        sealed_set_id=request.get("sealed_set_id"),
        submission_fields=submission_fields,
    )
    # Practice 7 — the holdout split the same authorized run scored. It is
    # ALWAYS withheld until the contest closes (force_defer), whatever
    # results_visibility says: a holdout number visible while the contest
    # runs is just a second leaderboard. One code path, both transports.
    holdout_outcome = None
    holdout = bundle.get("holdout")
    if holdout and holdout.get("row"):
        h_problems = validate_row(holdout["row"])
        if h_problems:
            print(f"  ⚠ {request_id}: the holdout row in this bundle "
                  f"fails validation ({h_problems}) — the main result "
                  f"stands; the holdout is NOT recorded. Re-export it "
                  f"from the air-gap node.")
        elif entry_contest is None:
            print(f"  ⚠ {request_id}: the bundle carries a holdout result "
                  f"but names no contest, and a result can only be "
                  f"withheld to a contest close — the holdout is NOT "
                  f"recorded.")
        else:
            holdout_outcome = publish_or_defer(
                holdout["row"],
                contest=entry_contest,
                # contest_deferred_results is keyed by request_id and the
                # main result may already hold that key; the REAL request
                # id rides in submission_fields, which is what the
                # contest_submissions foreign key sees.
                request_id=holdout_defer_key(request["request_id"]),
                requested_by=request.get("requested_by"),
                notes=f"airgap-node executed ({request_id})",
                role="holdout",
                force_defer=True,
                sealed_set_id=(holdout.get("sealed_set_id")
                               or request.get("sealed_set_id")),
                submission_fields={
                    **(submission_fields or {}),
                    # A second RESULT of one entry, not a second entry —
                    # 074's idx_cs_one_primary allows one primary per team
                    # per contest and that slot belongs to the entry.
                    "is_primary": False,
                    "authorization_request_id": request["request_id"],
                },
            )
            print(f"  ⏳ {request_id}: holdout "
                  f"{holdout.get('sealed_set_id')} relayed and WITHHELD "
                  f"(run card {holdout['row'].get('id')}) — it publishes "
                  f"when the contest closes.")
    _relay_diagnostics(bundle)
    # The result is recorded (published, or withheld to the close). Retire
    # the request on the ROW, not just on this drive — migration 075.
    _mark_request_completed(request["request_id"])
    marker.write_text(json.dumps({
        "outcome": outcome["outcome"],
        "run_card_id": outcome["run_card_id"],
        "results_visibility": outcome["results_visibility"],
        "holdout": holdout_outcome,
        "score_bundle_sha256": bundle_sha,
        "relayed_at": datetime.now(timezone.utc).isoformat(),
    }, indent=2) + "\n", encoding="utf-8")
    # The standard headline from the relayed row's own columns.
    _scored = _sealed_headline({
        "chrf_plus_plus": row.get("chrf_plus_plus"),
        "chrf_ci_lower": row.get("chrf_ci_lower"),
        "chrf_ci_upper": row.get("chrf_ci_upper")})
    if outcome["outcome"] == "published":
        print(f"  ✅ {request_id}: published {row['id']} from signed "
              f"airgap score bundle ({_scored}; aggregates-only, "
              f"trust=verified)")
    else:
        print(f"  ⏳ {request_id}: relayed and WITHHELD (run card "
              f"{row['id']}; {_scored}) — contest {bundle['contest_id']} "
              f"publishes at close.")
    return request_id


def import_scores(exchange_dir: str | Path, cfg: dict) -> list[str]:
    """Import every score bundle on the medium; return the ids accepted.

    One bundle cannot stop the others. `_import_one_score_bundle` refuses
    what it can refuse, and anything that RAISES out of it is caught here,
    named with its exception type, and left unmarked so the next pass tries
    it again — the remaining bundles on the medium are imported regardless.
    Before that containment, a medium carrying several participants' scores
    published only the ones sorted before the first failure.
    """
    relay_cfg = require_relay_config(cfg)
    verify_key = relay_cfg["verify_key"]
    airgap_node_id = relay_cfg["airgap_node_id"]

    exchange = Path(exchange_dir)
    scores_dir = exchange / "scores"
    published: list[str] = []
    if not scores_dir.is_dir():
        return published
    contained: list[str] = []
    for entry in sorted(scores_dir.iterdir()):
        if not entry.is_dir():
            continue
        try:
            accepted = _import_one_score_bundle(
                entry, cfg, verify_key=verify_key,
                airgap_node_id=airgap_node_id)
        except Exception as e:  # noqa: BLE001 — contained on purpose
            # Deliberately every exception: the medium is the boundary
            # between participants, and one participant's bundle failing is
            # not a reason to leave the next one's scores unpublished. No
            # marker was written for it (the writes are the last thing
            # _import_one_score_bundle does), so it is retried next pass.
            contained.append(entry.name)
            print(f"  ✗ {entry.name}: FAILED to import "
                  f"({type(e).__name__}: {e}) — nothing was recorded for "
                  f"this bundle, so it is retried on the next pass. The "
                  f"other bundles on this medium are imported anyway.")
            continue
        if accepted is not None:
            published.append(accepted)
    if contained:
        print(f"  ⚠ {len(contained)} score bundle(s) could not be imported "
              f"and were left on the medium for the next pass: "
              f"{', '.join(contained)}. Their requests are still authorized "
              f"work — the round trip can be redone.")
    return published

def relay(exchange_dir: str | Path, *,
          config_path: str | Path | None = None) -> dict:
    """One connected-side sync pass over the medium: scores IN, requests OUT.

    That order is load-bearing, not taste. The `.relayed.json` done-marker
    that retires a request from export is written by the scores-in half, and
    `authorization_requests` has no terminal state — a scored request stays
    `authorized` forever (wave 2: "the deferred PK is the done-marker"). Run
    requests-out first and the return leg re-exports the very request whose
    signed scores are sitting in the bundle it is importing: the
    participant's method tarball goes back onto the removable medium for
    nothing. Measured in the 2026-09-07 sovereign rehearsal.

    Ordering fixes it where a terminal state would not: at the moment the
    export half runs on the return leg, the scores have not been imported
    yet, so the state column would still read `authorized` and the re-export
    would happen anyway. The state machine is worth having for its own
    reasons; it is not this bug's fix.

    Scores-in first also anchors better: a request exported on this pass
    carries an `audit_head_at_export` that already includes the `grant_used`
    events this same pass appended.

    The halves are INDEPENDENT: a scores-in failure does not cancel the
    outbound half (see the comment on the try below), because ordering them
    must not turn one participant's bad bundle into a stop-work order for
    everybody else's. Inside the scores-in half the same rule holds one
    level down — each bundle is contained on its own, so a bundle that
    raises no longer strands the bundles sorted behind it either.

    Known limit, and the concrete case for the deferred terminal state: the
    done-marker lives on the MEDIUM, not in the database. A pass run against
    a FRESH medium re-exports a request whose scores were already published,
    because the request row still reads `authorized` and the new medium
    carries no marker. Bounded — the air-gapped node's own state dir refuses
    to re-run a request it has already scored, so nothing double-publishes —
    but it is the same waste one drive over, and only a state on the request
    row closes it.

    Both `relay.verify_key` and `relay.airgap_node_id` are checked up front,
    before the medium is touched, so a half-configured node fails whole
    instead of half-completing a pass in either order — with a message that
    names the missing field, says what it is for and where to get it, and
    states that nothing was written. That is the documented precondition of
    `node relay` (the runbook states it above the command); see
    require_relay_config.
    """
    from mt_eval_harness.contest_node import load_node_config
    from mt_eval_harness.sovereign_service import service_key

    cfg = load_node_config(config_path)
    # Both fail-loud checks run BEFORE the medium is touched — and the purely
    # local one first, because a missing relay field is the operator's to fix
    # with an editor and needs no network to diagnose.
    require_relay_config(cfg)
    service_key()
    exchange = Path(exchange_dir)
    exchange.mkdir(parents=True, exist_ok=True)
    # A bad bundle is import_scores' own business now: it refuses what it
    # can refuse, and CONTAINS what raises (per bundle, no marker, retried
    # next pass). What can still come out of this call is a whole-pass
    # failure — an unreadable medium, a scores directory that cannot be
    # listed — and putting scores-in first would otherwise let one of those
    # hold the OUTBOUND half hostage: work waiting for the air-gapped node
    # would never reach the medium, on this pass or any later one, because a
    # raise records nothing and so repeats forever. The two halves are
    # independent, so a failure in one must not cancel the other. The error
    # is still raised — after the outbound half has run and the summary has
    # been printed, and never masked by a failure in it.
    published: list[str] = []
    scores_error: Exception | None = None
    try:
        published = import_scores(exchange, cfg)
    except Exception as e:  # noqa: BLE001 — re-raised below, never swallowed
        scores_error = e
        print(f"  ✗ scores-in FAILED ({type(e).__name__}: {e}) — nothing "
              f"was recorded for the bundle that failed, so it is "
              f"retried on the next pass. Carrying on with the outbound "
              f"half: requests waiting for the air-gapped node are not held "
              f"hostage by a score bundle that could not be published.")
    exported = export_requests(exchange, cfg)
    print(f"  Relay pass done: {len(published)} score bundle(s) accepted "
          f"(published, or withheld until close — the per-request line above "
          f"says which), {len(exported)} request(s) out.")
    if scores_error is not None:
        raise scores_error
    return {"exported": exported, "published": published}
