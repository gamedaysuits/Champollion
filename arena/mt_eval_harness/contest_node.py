"""contest_node — the ORGANIZER'S scoring node (`mt-eval node …`).

Self-hosted daemon an organizer (a shared task like AmericasNLP, a sovereign
org) runs on THEIR OWN machine. It is the only place the secret references
ever exist in plaintext — and only transiently, decrypted to scratch for the
seconds a scoring takes. Champollion infrastructure never sees them.

The loop per intake item (contest_intake table, migration 043 one-way
lifecycle — the DB trigger backstops every transition this daemon makes):

  received
    ├─ download bundle (private bucket, 044), verify the recorded digests
    ├─ RE-SCORE the dev hypotheses against the node's own public dev refs —
    │  the participant's local verdict was a preview; THIS score gates
    ├─ qualifier gate (qualifier_gate.py ↔ sealed-qualifier.mjs, threshold
    │  from the qualifiers row, migration 042)
    └─ → qualifier_checked (or → rejected, with the exact reason)
  authorization (per contests.authorization_model, plan D3 — ONE code path):
    open            → straight to scoring (public-refs contests only)
    blanket         → authorization_request created AND auto-authorized under
                      recorded policy; grant minted + claimed; every step in
                      the hash-chained audit log (040). → scoring
    per-submission  → authorization_request stays PENDING; → pending_authorization.
                      A custodian runs `mt-eval node approve <request>`; the
                      next poll mints + claims the grant. (deny → rejected.)
  scoring
    ├─ decrypt the sealed refs to scratch (champollion seal-corpus open) or
    │  read the plaintext refs path (blanket/open contests only)
    ├─ external_scoring.score_hypotheses → RunLog + TestReport
    ├─ assemble_run_card → publish AGGREGATES-ONLY (entries suppressed —
    │  founder decision 2026-07-07: per-entry rows on a small secret set are
    │  a slow reference oracle) with trust='verified' (the reference holder
    │  scored it) + the participant-claimed method label
    ├─ link into contest_submissions; wipe the decrypted refs
    └─ → scored → published

Every failure path lands in `rejected` WITH a reason (the 043 trigger refuses
a reasonless rejection), or is logged and retried next poll — no silent drops.

Config (~/.mt-eval/node.json):
{
  "node_id": "org-node-1",              // self-reported (honest: no attestation yet)
  "poll_seconds": 30,
  "scratch_dir": "~/.mt-eval/node-scratch",
  "output_dir": "~/.mt-eval/node-runs", // RunLogs/TestReports — contain secret
                                        // ref text; keep organizer-local
  "grant_ttl_seconds": 3600,
  "contests": {
    "<contest-id>": {
      // T1 hypotheses lane:
      "dev_corpus": "/path/to/eval-...-qualifier-vYYYY.json",
      "refs_artifact": "/path/to/...refs.sealed.json",   // sealed (default)
      "refs_privkey": "/path/to/threshold-....key.json",
      // OR (blanket/open only): "refs_plaintext": "/path/to/refs.json"
      "corpus_version": "v1",
      // T2 method lane (Phase B, sandbox_runner.py — optional):
      "secret_set_id": "eval-...-secret-v1",
      "secret_artifact": "/path/to/...secret....sealed.json",
      // custody: how the T2 set is unsealed at run time.
      //   "single-key" (default): a secret_privkey file opens it (Wave-1
      //                 stand-in; a run WITHOUT a custodian quorum is allowed
      //                 and announced).
      //   "threshold-quorum": M-of-N custodian shares MUST be presented
      //                 (`run-method --share ...`); the privkey fallback is
      //                 REFUSED. secret_privkey must NOT be set.
      "custody": "single-key",
      "secret_privkey": "/path/to/threshold-....key.json",  // single-key only
      "sandbox": {"runtime": "docker", "gpus": false},  // Lane B (code methods)
      // Lane A (declarative models) architecture policy — permissive default;
      // a careful host may set "known" or a ["Arch1","Arch2"] allowlist:
      "declarative": {"architecture_policy": "permissive"}
    }
  },
  // Phase B airgap transport (airgap_transport.py — optional):
  "signing_key": "/path/to/score-sign-....key.json",   // AIRGAPPED node only
  "airgap": {"state_dir": "~/.mt-eval/airgap"},
  "relay": {"verify_key": "/path/to/score-sign-....pub.json",
            "airgap_node_id": "org-airgap-1"}          // CONNECTED relay only
}
"""

from __future__ import annotations

import json
import subprocess
import tarfile
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from mt_eval_harness.contest_prep import find_champollion_cli
from mt_eval_harness.external_scoring import (
    HypothesesFormatError,
    build_claimed_method_card,
    score_hypotheses,
    sha256_file,
)
from mt_eval_harness.qualifier_gate import is_eligible_for_sealed_run
from mt_eval_harness.queue_runner import compute_request_fingerprint
from mt_eval_harness.sovereign_service import (
    append_audit_event,
    rpc,
    service_key,
    service_request,
)

BUCKET = "contest-intake"
DEFAULT_CONFIG_PATH = Path.home() / ".mt-eval" / "node.json"


class NodeConfigError(RuntimeError):
    """Bad/missing node configuration — fail loud at startup, never mid-item."""


# ---------------------------------------------------------------------------
# Config.
# ---------------------------------------------------------------------------

def load_node_config(path: str | Path | None = None) -> dict:
    p = Path(path) if path else DEFAULT_CONFIG_PATH
    if not p.exists():
        raise NodeConfigError(
            f"Node config not found: {p}. Create it per the template in "
            f"contest_node.py / champollion.dev/docs/network/sovereignty/run-a-sovereign-contest.")
    cfg = json.loads(p.read_text(encoding="utf-8"))
    if not cfg.get("node_id"):
        raise NodeConfigError("node.json needs a node_id (self-reported node "
                              "identity bound into request fingerprints).")
    contests = cfg.get("contests")
    if not isinstance(contests, dict) or not contests:
        raise NodeConfigError("node.json needs a non-empty 'contests' map.")
    for cid, c in contests.items():
        # A contest entry serves the T1 hypotheses lane (dev_corpus + refs),
        # the T2 method lane (secret_*), or both. An entry serving neither is
        # a misconfiguration, loudly.
        serves_t1 = bool(c.get("dev_corpus") or c.get("refs_artifact")
                         or c.get("refs_plaintext"))
        serves_t2 = bool(c.get("secret_set_id") or c.get("secret_artifact")
                         or c.get("secret_privkey"))
        if not serves_t1 and not serves_t2:
            raise NodeConfigError(
                f"contests[{cid}] serves neither lane — give it dev_corpus + "
                f"refs_* (T1 hypotheses) and/or secret_set_id + "
                f"secret_artifact + secret_privkey (T2 method lane).")
        if serves_t1:
            if not c.get("dev_corpus"):
                raise NodeConfigError(f"contests[{cid}] needs dev_corpus (the "
                                      f"public qualifier corpus file).")
            sealed = bool(c.get("refs_artifact"))
            plain = bool(c.get("refs_plaintext"))
            if sealed == plain:  # neither, or confusingly both
                raise NodeConfigError(
                    f"contests[{cid}] needs EXACTLY ONE of refs_artifact "
                    f"(+refs_privkey) or refs_plaintext.")
            if sealed and not c.get("refs_privkey"):
                raise NodeConfigError(
                    f"contests[{cid}] has refs_artifact but no refs_privkey — "
                    f"the node cannot decrypt at scoring time.")
        if serves_t2:
            if not c.get("secret_set_id"):
                raise NodeConfigError(
                    f"contests[{cid}] has T2 secret_* entries but no "
                    f"secret_set_id (the sealed_sets id the requests target).")
            # secret_artifact/secret_privkey are EXECUTION-side needs: the
            # scoring machine must have them (run-method checks before any
            # grant is claimed); a connected RELAY serving the same contest
            # legitimately has neither — it only moves files and rows.
            custody = c.get("custody", "single-key")
            if custody not in ("single-key", "threshold-quorum"):
                raise NodeConfigError(
                    f"contests[{cid}] custody must be 'single-key' or "
                    f"'threshold-quorum' (got {custody!r}).")
            if custody == "threshold-quorum" and c.get("secret_privkey"):
                # The whole point of threshold custody: no standing key file
                # that could open the set without a quorum. A configured
                # secret_privkey would be exactly that bypass — refuse it.
                # (A relay that only moves files legitimately has neither
                # privkey nor artifact; run_imported enforces the artifact
                # requirement execution-side.)
                raise NodeConfigError(
                    f"contests[{cid}] declares custody 'threshold-quorum' but "
                    f"also configures secret_privkey — that key file is a "
                    f"single-party bypass of the quorum. Remove it; the set "
                    f"opens ONLY by presenting M-of-N custodian shares to "
                    f"`run-method --share`.")
    cfg.setdefault("poll_seconds", 30)
    cfg.setdefault("grant_ttl_seconds", 3600)
    cfg.setdefault("scratch_dir", str(Path.home() / ".mt-eval" / "node-scratch"))
    cfg.setdefault("output_dir", str(Path.home() / ".mt-eval" / "node-runs"))
    return cfg


# ---------------------------------------------------------------------------
# Storage + bundle handling (service side).
# ---------------------------------------------------------------------------

def _storage_download(object_path: str) -> bytes:
    from mt_eval_harness.auth import SUPABASE_URL
    key = service_key()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{object_path}"
    req = urllib.request.Request(url, headers={
        "apikey": key, "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Bundle download failed ({e.code}): {detail}") from e


def extract_bundle(bundle_bytes: bytes, dest: Path) -> dict:
    """Safely extract a submission bundle; return its manifest.

    Guards against path traversal (absolute names / ..) — participant-supplied
    archives are untrusted input.
    """
    dest.mkdir(parents=True, exist_ok=True)
    import io
    with tarfile.open(fileobj=io.BytesIO(bundle_bytes), mode="r:gz") as tar:
        for member in tar.getmembers():
            name = Path(member.name)
            if name.is_absolute() or ".." in name.parts or not member.isfile():
                raise HypothesesFormatError(
                    f"Bundle member {member.name!r} is not a plain relative "
                    f"file — refusing to extract.")
        tar.extractall(dest, filter="data")
    manifest_path = dest / "manifest.json"
    if not manifest_path.exists():
        raise HypothesesFormatError("Bundle has no manifest.json.")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _find_hyp_file(dest: Path, stem: str) -> Path:
    matches = sorted(dest.glob(f"{stem}.*"))
    if not matches:
        raise HypothesesFormatError(f"Bundle has no {stem}.* file.")
    return matches[0]


# ---------------------------------------------------------------------------
# Row helpers.
# ---------------------------------------------------------------------------

def _advance(intake_id: str, patch: dict) -> None:
    service_request("PATCH", "contest_intake",
                    params={"intake_id": f"eq.{intake_id}"}, data=patch)


def _reject(intake_id: str, reason: str) -> None:
    print(f"    ✗ {intake_id}: {reason}")
    _advance(intake_id, {"status": "rejected", "reject_reason": reason})


def _fetch_rows(path: str, params: dict) -> list[dict]:
    rows = service_request("GET", path, params=params)
    return rows if isinstance(rows, list) else []


# ---------------------------------------------------------------------------
# Authorization (plan D3 — one path for all three models).
# ---------------------------------------------------------------------------

def _fingerprint_for(item: dict, contest_cfg: dict, sealed_set_id: str,
                     node_id: str) -> str:
    # In the hypotheses lane the "method" IS the submitted bundle's test file:
    # method_sha := test_hyp_sha256. The Phase-B method lane binds a real
    # method tarball sha here instead.
    return compute_request_fingerprint({
        "method_sha": item["test_hyp_sha256"],
        "corpus_id": sealed_set_id,
        "corpus_version": contest_cfg.get("corpus_version", "v1"),
    }, node_measurement=node_id)


def create_authorization_request(item: dict, contest_cfg: dict,
                                 sealed_set_id: str, node_id: str) -> str:
    request_id = f"authreq-{uuid.uuid4().hex}"
    fingerprint = _fingerprint_for(item, contest_cfg, sealed_set_id, node_id)
    service_request("POST", "authorization_requests", data={
        "request_id": request_id,
        "sealed_set_id": sealed_set_id,
        "state": "pending",
        "fingerprint": fingerprint,
        "method_sha": item["test_hyp_sha256"],
        "corpus_id": sealed_set_id,
        "corpus_version": contest_cfg.get("corpus_version", "v1"),
        "node_measurement": node_id,
        "requested_by": item["submitted_by"],
    })
    append_audit_event(
        "request_created", sealed_set_id=sealed_set_id, request_id=request_id,
        actor=item["submitted_by"], fingerprint=fingerprint,
        detail={"intake_id": item["intake_id"], "lane": "hypotheses"})
    return request_id


def authorize_request(request_id: str, *, actor: str, policy: str,
                      sealed_set_id: Optional[str] = None) -> None:
    """Transition a pending request to authorized (custodian act, or recorded
    blanket policy) + the audit events."""
    service_request("PATCH", "authorization_requests",
                    params={"request_id": f"eq.{request_id}"},
                    data={"state": "authorized",
                          "decided_at": datetime.now(timezone.utc).isoformat()})
    append_audit_event("request_authorized", request_id=request_id,
                       sealed_set_id=sealed_set_id, actor=actor,
                       detail={"policy": policy})


def deny_request(request_id: str, *, actor: str, reason: str,
                 sealed_set_id: Optional[str] = None) -> None:
    service_request("PATCH", "authorization_requests",
                    params={"request_id": f"eq.{request_id}"},
                    data={"state": "denied",
                          "decided_at": datetime.now(timezone.utc).isoformat()})
    append_audit_event("request_denied", request_id=request_id,
                       sealed_set_id=sealed_set_id, actor=actor,
                       detail={"reason": reason})


def mint_and_claim_grant(request_id: str, fingerprint: str,
                         sealed_set_id: str, *, node_id: str,
                         ttl_seconds: int,
                         used_detail: Optional[dict] = None) -> str:
    """Mint the single-use grant for an AUTHORIZED request and consume it for
    THIS scoring. The 039 bind trigger enforces request-authorized +
    fingerprint match; claim_auth_grant() consumes atomically.

    ``used_detail`` extends the grant_used audit detail (content-free ids/
    digests only) — the airgap relay records transport evidence there."""
    grant_id = f"grant-{uuid.uuid4().hex}"
    expires = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    service_request("POST", "auth_grants", data={
        "grant_id": grant_id,
        "request_id": request_id,
        "sealed_set_id": sealed_set_id,
        "fingerprint": fingerprint,
        "expires_at": expires.isoformat(),
    })
    append_audit_event("grant_minted", request_id=request_id,
                       grant_id=grant_id, sealed_set_id=sealed_set_id,
                       fingerprint=fingerprint,
                       detail={"expires_at": expires.isoformat()})
    claimed = rpc("claim_auth_grant", {
        "p_grant_id": grant_id, "p_fingerprint": fingerprint,
        "p_node": node_id})
    if not claimed:
        raise RuntimeError(
            f"claim_auth_grant returned no row for {grant_id} — the grant "
            f"was expired, already used, or fingerprint-mismatched. Not "
            f"scoring.")
    append_audit_event("grant_used", request_id=request_id, grant_id=grant_id,
                       sealed_set_id=sealed_set_id, fingerprint=fingerprint,
                       detail={"node": node_id, **(used_detail or {})})
    return grant_id


# ---------------------------------------------------------------------------
# Refs resolution — decrypt-to-scratch (sealed) or plaintext path.
# ---------------------------------------------------------------------------

def resolve_refs_corpus(contest_cfg: dict, scratch: Path) -> tuple[Path, bool]:
    """Return (refs_corpus_path, is_scratch_copy). Sealed refs are decrypted
    via `champollion seal-corpus open` into scratch (wiped by the caller)."""
    if contest_cfg.get("refs_plaintext"):
        p = Path(contest_cfg["refs_plaintext"]).expanduser()
        if not p.exists():
            raise NodeConfigError(f"refs_plaintext not found: {p}")
        return p, False

    artifact = Path(contest_cfg["refs_artifact"]).expanduser()
    privkey = Path(contest_cfg["refs_privkey"]).expanduser()
    return _open_sealed_to_scratch(artifact, privkey, scratch), True


def _open_sealed_to_scratch(artifact: Path, privkey: Path,
                            scratch: Path) -> Path:
    """Decrypt one sealed artifact into scratch via `seal-corpus open`
    (crypto single-sourced in cli/lib/seal.mjs — never reimplemented here)."""
    out = scratch / f"refs-{uuid.uuid4().hex}.json"
    argv = find_champollion_cli() + [
        "seal-corpus", "open",
        "--artifact", str(artifact),
        "--privkey", str(privkey),
        "--out", str(out),
    ]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0 or not out.exists():
        raise RuntimeError(
            f"Could not decrypt sealed artifact {artifact}:\n"
            f"{proc.stderr or proc.stdout}")
    return out


def resolve_secret_corpus(contest_cfg: dict, scratch: Path) -> Path:
    """Decrypt the T2 FULLY-SECRET corpus (source AND refs) to scratch.

    Phase-B method lane only. Unlike the T1 refs there is NO plaintext
    escape hatch: a T2 set's whole point is that even the source is sealed
    (contest_prep enforces the same at split time)."""
    artifact = Path(contest_cfg["secret_artifact"]).expanduser()
    privkey = Path(contest_cfg["secret_privkey"]).expanduser()
    if not artifact.exists():
        raise NodeConfigError(f"secret_artifact not found: {artifact}")
    if not privkey.exists():
        raise NodeConfigError(f"secret_privkey not found: {privkey}")
    return _open_sealed_to_scratch(artifact, privkey, scratch)


def wipe_scratch_file(path: Path) -> None:
    """Best-effort overwrite-then-delete of transient plaintext."""
    try:
        if path.exists():
            size = path.stat().st_size
            with open(path, "r+b") as fh:
                fh.write(b"\0" * size)
            path.unlink()
    except OSError as exc:
        print(f"    ⚠ could not wipe {path}: {exc}")


# Backwards-compatible internal alias (pre-Phase-B name).
_wipe = wipe_scratch_file


# ---------------------------------------------------------------------------
# Publish (service-role; aggregates-only; trust='verified').
# ---------------------------------------------------------------------------

def publish_scored_run(report_path: str | Path, *, submitter: str,
                       node_id: str, affirmation: str | None = None) -> str:
    """Publish a node-scored run: aggregates-only, trust='verified'.

    The default affirmation is the Phase-A hypotheses-lane text; the Phase-B
    method lane (sandbox_runner.run_method_request) passes its
    execution-verified wording. Same path either way — §9 scores-only egress
    has exactly one implementation."""
    from mt_eval_harness.publish import (
        assemble_run_card,
        build_run_card_row,
        validate_row,
        verify_corpus_integrity,
    )
    run_card, card_id, fingerprint_hash = assemble_run_card(report_path)
    for w in verify_corpus_integrity(run_card):
        print(f"    ⚠ {w}")
    row = build_run_card_row(
        run_card, card_id, fingerprint_hash,
        submitter=submitter,
        trust="verified",
        affirmation=affirmation or (
            f"Hypotheses submission scored by the organizer node '{node_id}' "
            f"against organizer-held references (mt-eval contest node). "
            f"Scores verified by the reference holder; method identity is "
            f"participant-claimed. Published aggregates-only."
        ),
    )
    problems = validate_row(row)
    if problems:
        raise RuntimeError(f"Run card incomplete (would be rejected): {problems}")
    service_request(
        "POST", "run_cards", data=row,
        prefer="return=representation,resolution=ignore-duplicates")
    # Aggregates-only BY CONSTRUCTION: run_card_entries is never written in
    # this path (no per-entry metric rows, no text — the anti-oracle posture).
    return card_id


# ---------------------------------------------------------------------------
# The per-item state machine.
# ---------------------------------------------------------------------------

def process_intake_item(item: dict, *, contest: dict, qualifier: dict,
                        contest_cfg: dict, cfg: dict) -> None:
    intake_id = item["intake_id"]
    status = item["status"]
    node_id = cfg["node_id"]
    scratch = Path(cfg["scratch_dir"]).expanduser() / intake_id
    output_dir = Path(cfg["output_dir"]).expanduser() / intake_id
    sealed_set_id = contest["corpus_id"]
    model = contest.get("authorization_model", "per-submission")

    if status == "received":
        # 1. Download + digest-verify + extract.
        try:
            bundle = _storage_download(item["storage_path"])
            manifest = extract_bundle(bundle, scratch)
        except (RuntimeError, HypothesesFormatError, json.JSONDecodeError) as e:
            _reject(intake_id, f"bundle unreadable: {e}")
            return
        try:
            dev_file = _find_hyp_file(scratch, "dev-hypotheses")
            test_file = _find_hyp_file(scratch, "test-hypotheses")
        except HypothesesFormatError as e:
            _reject(intake_id, str(e))
            return
        if sha256_file(dev_file) != item["dev_hyp_sha256"] or \
           sha256_file(test_file) != item["test_hyp_sha256"]:
            _reject(intake_id,
                    "bundle digests do not match the recorded submission "
                    "digests — the uploaded bytes are not what was declared.")
            return
        # Method claim must be valid vocabulary BEFORE any scoring effort.
        try:
            build_claimed_method_card(
                system_label=manifest.get("system_label", ""),
                method_class=manifest.get("method_class", ""),
                paradigm=manifest.get("paradigm"),
            )
        except ValueError as e:
            _reject(intake_id, f"invalid method claim in manifest: {e}")
            return

        # 2. The node's OWN dev re-score — this is what gates.
        src, _, tgt = contest.get("language_pair", ">").partition(">")
        try:
            dev_result = score_hypotheses(
                corpus_path=Path(contest_cfg["dev_corpus"]).expanduser(),
                hypotheses_path=dev_file,
                dataset_id=qualifier["corpus_card_id"],
                source_lang=src or "source",
                target_lang=tgt or "target",
                system_label=manifest.get("system_label", "unnamed"),
                method_class=manifest.get("method_class", "api"),
                paradigm=manifest.get("paradigm"),
                output_dir=output_dir / "dev",
                compute_ci=False,
                submission={"contest_id": contest["id"],
                            "intake_id": intake_id,
                            "submitted_by": item["submitted_by"]},
            )
        except (HypothesesFormatError, RuntimeError, ValueError) as e:
            _reject(intake_id, f"dev hypotheses could not be scored: {e}")
            return
        verdict = is_eligible_for_sealed_run(
            qualifier_id=qualifier["qualifier_id"],
            score=dev_result["qualifier_score"],
            threshold=qualifier["threshold"],
            qualifier_year=qualifier.get("year"),
            current_year=datetime.now(timezone.utc).year,
        )
        if not verdict["eligible"]:
            _advance(intake_id, {"qualifier_id": qualifier["qualifier_id"],
                                 "qualifier_score": dev_result["qualifier_score"]})
            _reject(intake_id, verdict["reason"])
            return
        _advance(intake_id, {
            "status": "qualifier_checked",
            "qualifier_id": qualifier["qualifier_id"],
            "qualifier_score": dev_result["qualifier_score"],
        })
        print(f"    ✓ {intake_id}: qualifier cleared at "
              f"{dev_result['qualifier_score']} ≥ {qualifier['threshold']}")
        item = {**item, "status": "qualifier_checked"}
        status = "qualifier_checked"
        # fall through to authorization

    if status == "qualifier_checked":
        if model == "open":
            _advance(intake_id, {"status": "scoring"})
            item = {**item, "status": "scoring"}
            status = "scoring"
        else:
            request_id = create_authorization_request(
                item, contest_cfg, sealed_set_id, node_id)
            if model == "blanket":
                # Auto-authorize under RECORDED policy — the full request/
                # grant/audit trail exists for every scoring anyway.
                authorize_request(request_id, actor=f"node:{node_id}",
                                  policy="blanket",
                                  sealed_set_id=sealed_set_id)
                fingerprint = _fingerprint_for(item, contest_cfg,
                                               sealed_set_id, node_id)
                mint_and_claim_grant(request_id, fingerprint, sealed_set_id,
                                     node_id=node_id,
                                     ttl_seconds=cfg["grant_ttl_seconds"])
                _advance(intake_id, {"status": "scoring",
                                     "authorization_request_id": request_id})
                item = {**item, "status": "scoring",
                        "authorization_request_id": request_id}
                status = "scoring"
            else:  # per-submission
                _advance(intake_id, {"status": "pending_authorization",
                                     "authorization_request_id": request_id})
                print(f"    ⏸ {intake_id}: waiting for custodian approval "
                      f"({request_id}) — `mt-eval node approve {request_id}`")
                return

    if status == "pending_authorization":
        request_id = item.get("authorization_request_id")
        reqs = _fetch_rows("authorization_requests",
                           {"request_id": f"eq.{request_id}",
                            "select": "request_id,state,fingerprint"})
        state = reqs[0]["state"] if reqs else "missing"
        if state == "pending":
            return  # still waiting — check again next poll
        if state in ("denied", "expired", "missing"):
            _reject(intake_id,
                    f"authorization request {request_id} is {state} — the "
                    f"custodian did not approve this scoring.")
            return
        # authorized → mint + claim, then score.
        fingerprint = _fingerprint_for(item, contest_cfg, sealed_set_id,
                                       node_id)
        mint_and_claim_grant(request_id, fingerprint, sealed_set_id,
                             node_id=node_id,
                             ttl_seconds=cfg["grant_ttl_seconds"])
        _advance(intake_id, {"status": "scoring"})
        item = {**item, "status": "scoring"}
        status = "scoring"

    if status == "scoring":
        # Bundle may need re-fetching (e.g. daemon restarted mid-flight).
        if not scratch.exists() or not list(scratch.glob("test-hypotheses.*")):
            try:
                bundle = _storage_download(item["storage_path"])
                extract_bundle(bundle, scratch)
            except (RuntimeError, HypothesesFormatError) as e:
                _reject(intake_id, f"bundle unreadable at scoring time: {e}")
                return
        manifest = json.loads((scratch / "manifest.json").read_text(encoding="utf-8"))
        test_file = _find_hyp_file(scratch, "test-hypotheses")

        refs_path, is_scratch = None, False
        try:
            refs_path, is_scratch = resolve_refs_corpus(
                contest_cfg, Path(cfg["scratch_dir"]).expanduser())
            src, _, tgt = contest.get("language_pair", ">").partition(">")
            result = score_hypotheses(
                corpus_path=refs_path,
                hypotheses_path=test_file,
                dataset_id=sealed_set_id,
                source_lang=src or "source",
                target_lang=tgt or "target",
                system_label=manifest.get("system_label", "unnamed"),
                method_class=manifest.get("method_class", "api"),
                paradigm=manifest.get("paradigm"),
                description=manifest.get("description", ""),
                output_dir=output_dir / "test",
                default_segment="held_out",
                compute_ci=True,
                submission={"contest_id": contest["id"],
                            "intake_id": intake_id,
                            "submitted_by": item["submitted_by"]},
            )
        except (HypothesesFormatError, RuntimeError, ValueError,
                NodeConfigError) as e:
            _reject(intake_id, f"scoring against the secret set failed: {e}")
            return
        finally:
            if is_scratch and refs_path is not None:
                _wipe(refs_path)

        _advance(intake_id, {"status": "scored"})
        try:
            card_id = publish_scored_run(
                result["report_path"], submitter=item["submitted_by"],
                node_id=node_id)
            service_request(
                "POST", "contest_submissions", data={
                    "contest_id": contest["id"],
                    "run_card_id": card_id,
                    "submitted_by": item["submitted_by"],
                    "team": item.get("team"),
                    "notes": f"organizer-node scored ({intake_id})",
                }, prefer="return=representation,resolution=ignore-duplicates")
        except RuntimeError as e:
            _reject(intake_id, f"scored but could not publish: {e}")
            return
        _advance(intake_id, {"status": "published", "run_card_id": card_id})
        print(f"    ✅ {intake_id}: published {card_id} "
              f"(composite {result['qualifier_score']}, aggregates-only, "
              f"trust=verified)")


# ---------------------------------------------------------------------------
# The poll loop + operator commands.
# ---------------------------------------------------------------------------

_ACTIONABLE = ("received", "qualifier_checked", "pending_authorization",
               "scoring", "scored")


def poll_once(cfg: dict) -> int:
    """One pass over every served contest. Returns items processed."""
    processed = 0
    for contest_id, contest_cfg in cfg["contests"].items():
        contests = _fetch_rows("contests", {
            "id": f"eq.{contest_id}",
            "select": "id,name,status,corpus_id,language_pair,"
                      "authorization_model,intake_open"})
        if not contests:
            print(f"  ⚠ contest {contest_id} not found on the DB — skipping")
            continue
        contest = contests[0]
        qualifiers = _fetch_rows("qualifiers", {
            "sealed_set_id": f"eq.{contest['corpus_id']}",
            "status": "eq.active",
            "select": "qualifier_id,corpus_card_id,threshold,metric,year"})
        if not qualifiers:
            print(f"  ⚠ contest {contest_id} has no active qualifier — "
                  f"holding ALL submissions (fail-safe)")
            continue
        qualifier = qualifiers[0]
        # Sanity: refuse plaintext refs on a per-submission contest (mirror of
        # contest_prep's refusal, in case configs were hand-edited).
        if (contest.get("authorization_model") == "per-submission"
                and contest_cfg.get("refs_plaintext")):
            print(f"  ⚠ contest {contest_id} is per-submission but the node "
                  f"config points at PLAINTEXT refs — refusing to serve it "
                  f"(seal the refs; see the runbook).")
            continue

        statuses = ",".join(_ACTIONABLE)
        items = _fetch_rows("contest_intake", {
            "contest_id": f"eq.{contest_id}",
            "status": f"in.({statuses})",
            "order": "created_at.asc"})
        for item in items:
            processed += 1
            try:
                process_intake_item(item, contest=contest,
                                    qualifier=qualifier,
                                    contest_cfg=contest_cfg, cfg=cfg)
            except Exception as e:  # noqa: BLE001 — daemon must not die mid-queue
                print(f"    ⚠ {item['intake_id']}: {e} (will retry next poll)")
    return processed


def serve(config_path: str | Path | None = None, *, once: bool = False) -> None:
    cfg = load_node_config(config_path)
    service_key()  # fail loud at startup, not on the first item
    print(f"  Organizer node '{cfg['node_id']}' serving "
          f"{len(cfg['contests'])} contest(s); poll every "
          f"{cfg['poll_seconds']}s. Ctrl-C to stop.")
    while True:
        n = poll_once(cfg)
        if once:
            print(f"  --once: processed {n} item(s); exiting.")
            return
        time.sleep(cfg["poll_seconds"])


def list_queue(config_path: str | Path | None = None,
               contest_id: str | None = None) -> list[dict]:
    cfg = load_node_config(config_path)
    ids = [contest_id] if contest_id else list(cfg["contests"])
    all_rows: list[dict] = []
    for cid in ids:
        rows = _fetch_rows("contest_intake", {
            "contest_id": f"eq.{cid}", "order": "created_at.asc",
            "select": "intake_id,contest_id,submitted_by,status,"
                      "qualifier_score,authorization_request_id,"
                      "run_card_id,reject_reason,created_at"})
        all_rows.extend(rows)

    # Phase-B: participant-created T2 method requests against the served
    # secret sets (there is no intake row in that lane — the request IS the
    # queue item; `mt-eval node run-method <id>` executes it).
    method_rows: list[dict] = []
    for cid in ids:
        secret_set = (cfg["contests"].get(cid) or {}).get("secret_set_id")
        if not secret_set:
            continue
        method_rows.extend(_fetch_rows("authorization_requests", {
            "sealed_set_id": f"eq.{secret_set}",
            "state": "in.(pending,authorized)",
            "order": "created_at.asc",
            "select": "request_id,sealed_set_id,state,method_sha,"
                      "requested_by,created_at"}))

    if not all_rows and not method_rows:
        print("  Queue empty.")
        return []
    for r in all_rows:
        extra = ""
        if r.get("authorization_request_id") and \
                r["status"] == "pending_authorization":
            extra = f"  ← approve/deny {r['authorization_request_id']}"
        print(f"  {r['intake_id']}  [{r['status']}]  {r['submitted_by']}"
              f"  q={r.get('qualifier_score')}{extra}")
    for r in method_rows:
        step = ("← approve/deny, then run-method" if r["state"] == "pending"
                else "← run-method")
        print(f"  {r['request_id']}  [method:{r['state']}]  "
              f"{r.get('requested_by')}  sha={r['method_sha'][:12]}…  {step}")
    return all_rows + method_rows


def approve(request_id: str, *, actor: str,
            config_path: str | Path | None = None) -> None:
    cfg = load_node_config(config_path)
    reqs = _fetch_rows("authorization_requests",
                       {"request_id": f"eq.{request_id}",
                        "select": "request_id,state,sealed_set_id"})
    if not reqs:
        raise RuntimeError(f"No authorization request {request_id}.")
    if reqs[0]["state"] != "pending":
        raise RuntimeError(f"Request {request_id} is {reqs[0]['state']} — "
                           f"only a pending request can be approved.")
    append_audit_event("vote_cast", request_id=request_id,
                       sealed_set_id=reqs[0].get("sealed_set_id"),
                       actor=actor, detail={"vote": "approve",
                                            "node": cfg["node_id"]})
    authorize_request(request_id, actor=actor, policy="per-submission",
                      sealed_set_id=reqs[0].get("sealed_set_id"))
    print(f"  ✅ {request_id} authorized by {actor}. The node will mint the "
          f"grant and score on its next poll.")


def deny(request_id: str, *, actor: str, reason: str,
         config_path: str | Path | None = None) -> None:
    load_node_config(config_path)  # validates the operator context
    reqs = _fetch_rows("authorization_requests",
                       {"request_id": f"eq.{request_id}",
                        "select": "request_id,state,sealed_set_id"})
    if not reqs:
        raise RuntimeError(f"No authorization request {request_id}.")
    if reqs[0]["state"] != "pending":
        raise RuntimeError(f"Request {request_id} is {reqs[0]['state']} — "
                           f"only a pending request can be denied.")
    append_audit_event("vote_cast", request_id=request_id,
                       sealed_set_id=reqs[0].get("sealed_set_id"),
                       actor=actor, detail={"vote": "deny", "reason": reason})
    deny_request(request_id, actor=actor, reason=reason,
                 sealed_set_id=reqs[0].get("sealed_set_id"))
    print(f"  ✗ {request_id} denied by {actor}: {reason}")
