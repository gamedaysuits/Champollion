"""airgap_transport — true-airgap file transport for the T2 method lane (B3).

"The software on a VM under airgap": the SCORING machine has no network at
all. Work crosses the gap as files on removable media; only scores come back.
Two machines, both the organizer's, three verbs:

  CONNECTED side (has Supabase + the bucket):
    `mt-eval node relay <exchange-dir>`
        pass 1  export every AUTHORIZED method request the served contests
                carry: verify T1 standing + the frozen method_sha, then write
                requests/<request-id>/{request.json, method.tar.gz} — plus the
                current authorization_audit_head() so the airgapped node can
                echo the chain digest its work is anchored to.
        pass 2  import every signed score bundle from scores/<request-id>/:
                Ed25519-verify (seal-corpus verify — the crypto lives in
                cli/lib/seal.mjs), re-check the fingerprint against the frozen
                request, claim the single-use grant (EXISTING
                mint_and_claim_grant; transport evidence in the grant_used
                audit detail), and publish the PREBUILT aggregates-only
                run-card row through validate_row — the §9 scores-only path.

  AIRGAPPED side (no network; node.json carries the sealed T2 artifacts):
    `mt-eval node import-bundle <exchange-dir>`
        validate + digest-verify + safe-extract each exported request into
        the local state dir, and run validation immediately — the §3 static
        checks for a runnable bundle (Lane B), or the code-free declarative
        validation for a declarative-model bundle (Lane A). A BLOCKED bundle
        never reaches execution and its refusal (with the findings) travels
        back as a signed 'rejected' score bundle.
    `mt-eval node run-method <request-id> --offline`
        offline execution + single-scorer scoring, dispatched on the bundle's
        submissionKind: the trusted declarative engine (Lane A) or the
        --network=none sandbox (Lane B) — the SAME code the connected mode
        runs. The result is held locally as a fully-validated run-card ROW.
    `mt-eval node export-scores <exchange-dir>`
        write scores/<request-id>/{score-bundle.json, score-bundle.json.sig.json},
        signed with the node's Ed25519 key (single-node wave-1 signature,
        honestly labeled — NOT steward custody).

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
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from mt_eval_harness.contest_prep import find_champollion_cli
from mt_eval_harness.sandbox_runner import SandboxError, run_static_checks

EXCHANGE_VERSION = "1"


class AirgapTransportError(RuntimeError):
    """A transport step that must not proceed — always with the reason."""


# ---------------------------------------------------------------------------
# Signing bridge — shells out to `champollion seal-corpus sign|verify`
# (crypto single-sourced in cli/lib/seal.mjs, same rule as sealing).
# ---------------------------------------------------------------------------

def sign_file(payload_path: Path, privkey_path: Path) -> Path:
    sig_path = payload_path.with_name(payload_path.name + ".sig.json")
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
    argv = find_champollion_cli() + [
        "seal-corpus", "verify",
        "--payload", str(payload_path),
        "--sig", str(sig_path),
        "--pubkey", str(pubkey_path),
    ]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=60)
    return proc.returncode == 0


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
# CONNECTED side, pass 1 — export authorized requests to the exchange dir.
# ---------------------------------------------------------------------------

def export_requests(exchange_dir: str | Path, cfg: dict) -> list[str]:
    from mt_eval_harness.contest_node import _fetch_rows, _storage_download
    from mt_eval_harness.sandbox_runner import (
        _audit_request_created_once,
        verify_t1_standing,
    )
    from mt_eval_harness.sovereign_service import rpc

    exchange = Path(exchange_dir)
    exported: list[str] = []
    for contest_id, ccfg in cfg["contests"].items():
        secret_set = ccfg.get("secret_set_id")
        if not secret_set:
            continue
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
            if not verify_t1_standing(contest_id, req.get("requested_by", "")):
                print(f"  ✗ {request_id}: requested_by has no published T1 "
                      f"record for {contest_id} — not exporting (the airgap "
                      f"machine only ever sees vetted work).")
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
            _audit_request_created_once(req, contest_id, cfg["node_id"])
            audit_head = rpc("authorization_audit_head", {})
            dest.mkdir(parents=True, exist_ok=True)
            (dest / "method.tar.gz").write_bytes(bundle)
            (dest / "request.json").write_text(json.dumps({
                "exchange_version": EXCHANGE_VERSION,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "contest_id": contest_id,
                "request": req,
                "audit_head_at_export": audit_head,
                "_note": ("Authorized method-execution request, exported for "
                          "the airgapped scoring node. Verify method_sha on "
                          "import; scores-only comes back."),
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            exported.append(request_id)
            print(f"  → exported {request_id} ({len(bundle)} bytes) for the "
                  f"airgap node")
    return exported


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
            continue  # already imported
        try:
            meta = json.loads((entry / "request.json").read_text(
                encoding="utf-8"))
            request = meta["request"]
            bundle_bytes = (entry / "method.tar.gz").read_bytes()
        except (OSError, json.JSONDecodeError, KeyError) as e:
            print(f"  ✗ {request_id}: unreadable export ({e}) — skipping")
            continue
        state = {
            "request_id": request_id,
            "contest_id": meta.get("contest_id"),
            "request": request,
            "audit_head_at_export": meta.get("audit_head_at_export"),
            "imported_at": datetime.now(timezone.utc).isoformat(),
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
        try:
            manifest = extract_bundle(bundle_bytes, bundle_dir)
        except (HypothesesFormatError, json.JSONDecodeError) as e:
            state.update({"status": "rejected",
                          "reason": f"bundle unreadable: {e}"})
            _write_state(state_dir, request_id, state)
            print(f"  ✗ {request_id}: {e} — staged as rejected")
            continue
        # Lane dispatch (mirror of sandbox_runner.run_method_request): a
        # declarative-model bundle is validated code-free (Lane A); a runnable
        # bundle gets the §3 static checks (Lane B). Either way a BLOCK is
        # staged as rejected and travels back as a signed 'rejected' bundle.
        lane = (manifest or {}).get("submissionKind", "runnable-bundle")
        ccfg = cfg["contests"].get(meta.get("contest_id")) or {}
        tarball = state_dir / request_id / "bundle.tar.gz"
        if lane == "declarative-model":
            from mt_eval_harness.model_runner import validate_declarative_bundle
            arch_policy = (
                (ccfg.get("declarative") or {}).get("architecture_policy")
                or (cfg.get("declarative") or {}).get("architecture_policy"))
            checks = validate_declarative_bundle(
                bundle_dir, tarball_path=tarball,
                expected_corpus_id=request.get("sealed_set_id"),
                architecture_policy=arch_policy)
            block_label = "declarative validation BLOCKS this bundle (Lane A)"
        else:
            checks = run_static_checks(
                bundle_dir, tarball_path=tarball,
                expected_corpus_id=request.get("sealed_set_id"))
            block_label = "static checks BLOCK this bundle (spec §3)"
        if checks["blocked"]:
            reasons = "; ".join(b["detail"] for b in checks["blocks"][:8])
            state.update({"status": "rejected", "lane": lane,
                          "reason": f"{block_label}: {reasons}"})
            print(f"  ✗ {request_id}: validation blocked — staged as rejected")
        else:
            state.update({"status": "imported", "lane": lane,
                          "static_warns": len(checks["warns"])})
            print(f"  ✓ {request_id}: imported [{lane}] "
                  f"({len(checks['warns'])} warning(s)) — run it with "
                  f"`mt-eval node run-method {request_id} --offline`")
        _write_state(state_dir, request_id, state)
        imported.append(request_id)
    if not imported:
        print("  Nothing new to import.")
    return imported


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
    from mt_eval_harness.queue_runner import compute_request_fingerprint

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
        expected_corpus_id=sealed_set_id)
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
    unseal = None
    ledger = None
    corpus_path = None
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
        ledger = LocalLedger(state_dir / "authorization-ledger.jsonl")
        try:
            unseal = quorum_unseal_for_run(
                artifact_path=Path(artifact_path).expanduser(),
                share_paths=share_paths,
                ledger=ledger, node_id=node_id,
                method_sha=request["method_sha"],
                corpus_version=request["corpus_version"],
                requested_by=request.get("requested_by") or "unknown",
                scratch_dir=scratch,
                ttl_seconds=cfg.get("grant_ttl_seconds", 3600))
        except SealedRunError as e:
            state["last_refusal"] = str(e)
            _write_state(state_dir, request_id, state)
            raise AirgapTransportError(str(e)) from e
        corpus_path = Path(unseal["corpus_path"])

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
            expected_corpus_id=sealed_set_id)
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
        state.update({"status": "failed", "reason": str(e)})
        _write_state(state_dir, request_id, state)
        print(f"  ✗ {request_id}: {e}")
        return state
    finally:
        if corpus_path is not None:
            wipe_scratch_file(Path(corpus_path))

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
    row = build_run_card_row(
        run_card, card_id, fingerprint_hash,
        submitter=request.get("requested_by") or "unknown",
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
        "scored_at": datetime.now(timezone.utc).isoformat(),
    })
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
        manifest = build_score_manifest(
            node_id=node_id, sealed_set_id=sealed_set_id,
            corpus_version=request["corpus_version"],
            corpus_ciphertext_digest=ciphertext_digest,
            method_sha256=request["method_sha"],
            scores={"composite": result["qualifier_score"]},
            audit_head=head,
            request_id=(unseal or {}).get("request_id") or request_id,
            grant_id=(unseal or {}).get("grant_id"),
            run_card_id=card_id,
            static_checks=result.get("static_checks"))
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
    print(f"  ✅ {request_id}: scored offline (composite "
          f"{result['qualifier_score']}) — export with "
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
            "node.json has no signing_key — generate one with `champollion "
            "seal-corpus sign-keygen` on THIS (airgapped) machine and give "
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
            "execution": state.get("execution"),
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
# CONNECTED side, pass 2 — verify + publish returned score bundles.
# ---------------------------------------------------------------------------

def import_scores(exchange_dir: str | Path, cfg: dict) -> list[str]:
    from mt_eval_harness.contest_node import mint_and_claim_grant
    from mt_eval_harness.publish import validate_row
    from mt_eval_harness.queue_runner import compute_request_fingerprint
    from mt_eval_harness.sovereign_service import service_request

    relay_cfg = cfg.get("relay") or {}
    verify_key = relay_cfg.get("verify_key")
    airgap_node_id = relay_cfg.get("airgap_node_id")
    if not verify_key or not airgap_node_id:
        raise AirgapTransportError(
            "node.json needs relay.verify_key (the airgap node's "
            "score-sign .pub.json) and relay.airgap_node_id — the relay "
            "refuses unverifiable score bundles (fail-closed).")

    exchange = Path(exchange_dir)
    scores_dir = exchange / "scores"
    published: list[str] = []
    if not scores_dir.is_dir():
        return published
    for entry in sorted(scores_dir.iterdir()):
        if not entry.is_dir():
            continue
        request_id = entry.name
        marker = entry / ".relayed.json"
        payload_path = entry / "score-bundle.json"
        sig_path = entry / "score-bundle.json.sig.json"
        if marker.exists() or not payload_path.exists():
            continue
        if not sig_path.exists():
            print(f"  ✗ {request_id}: unsigned score bundle — refused.")
            continue
        if not verify_file(payload_path, sig_path,
                           Path(verify_key).expanduser()):
            print(f"  ✗ {request_id}: SIGNATURE INVALID — score bundle "
                  f"refused (not the airgap node's bytes).")
            continue
        bundle = json.loads(payload_path.read_text(encoding="utf-8"))
        bundle_sha = hashlib.sha256(payload_path.read_bytes()).hexdigest()

        from mt_eval_harness.contest_node import _fetch_rows
        reqs = _fetch_rows("authorization_requests", {
            "request_id": f"eq.{bundle['request_id']}",
            "select": "request_id,sealed_set_id,state,fingerprint,method_sha,"
                      "corpus_id,corpus_version,requested_by"})
        if not reqs:
            print(f"  ✗ {request_id}: no such authorization request — refused.")
            continue
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
            continue
        if request["state"] != "authorized":
            print(f"  ✗ {request_id}: request is {request['state']!r} — only "
                  f"an authorized request's scores may publish.")
            continue

        if bundle["status"] != "scored":
            # The airgapped node refused or failed the run: no grant, no
            # card. Record the outcome locally; the audit vocabulary (040,
            # deliberately closed) has no fitting event, so surfacing is the
            # organizer's (documented honest limit; §9.4 disputes deferred).
            marker.write_text(json.dumps({
                "outcome": "rejected", "reason": bundle.get("reason"),
                "relayed_at": datetime.now(timezone.utc).isoformat(),
            }, indent=2) + "\n", encoding="utf-8")
            print(f"  ✗ {request_id}: airgap node reported "
                  f"'{bundle.get('reason')}' — no score published.")
            continue

        row = bundle.get("row")
        if not row:
            print(f"  ✗ {request_id}: scored bundle has no run-card row — "
                  f"refused.")
            continue
        problems = validate_row(row)
        if problems:
            print(f"  ✗ {request_id}: relayed row fails validation "
                  f"({problems}) — refused.")
            continue

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
            })
        service_request(
            "POST", "run_cards", data=row,
            prefer="return=representation,resolution=ignore-duplicates")
        if bundle.get("contest_id"):
            service_request(
                "POST", "contest_submissions", data={
                    "contest_id": bundle["contest_id"],
                    "run_card_id": row["id"],
                    "submitted_by": request.get("requested_by"),
                    "notes": f"airgap-node executed ({request_id})",
                }, prefer="return=representation,resolution=ignore-duplicates")
        marker.write_text(json.dumps({
            "outcome": "published", "run_card_id": row["id"],
            "score_bundle_sha256": bundle_sha,
            "relayed_at": datetime.now(timezone.utc).isoformat(),
        }, indent=2) + "\n", encoding="utf-8")
        published.append(request_id)
        print(f"  ✅ {request_id}: published {row['id']} from signed airgap "
              f"score bundle (composite {bundle.get('qualifier_score')}, "
              f"aggregates-only, trust=verified)")
    return published


def relay(exchange_dir: str | Path, *,
          config_path: str | Path | None = None) -> dict:
    """One connected-side sync pass: requests out, verified scores in."""
    from mt_eval_harness.contest_node import load_node_config
    from mt_eval_harness.sovereign_service import service_key

    cfg = load_node_config(config_path)
    service_key()  # fail loud before touching the exchange medium
    exchange = Path(exchange_dir)
    exchange.mkdir(parents=True, exist_ok=True)
    exported = export_requests(exchange, cfg)
    published = import_scores(exchange, cfg)
    print(f"  Relay pass done: {len(exported)} request(s) out, "
          f"{len(published)} score bundle(s) published.")
    return {"exported": exported, "published": published}
