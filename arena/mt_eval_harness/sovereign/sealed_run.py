"""sealed_run — quorum-gated unseal INSIDE the executor run context only.

The M2 flow of the sovereign multisig plan, executed against the LOCAL hash-chained
ledger (no Supabase in the air gap): request → custodian shares presented
(each recorded as a vote) → quorum reconstruction = authorization → a
time-boxed, single-use, fingerprint-bound grant is minted AND claimed →
only then does the set key get reconstructed (SecretBuffer, memory only)
and the corpus decrypt into the run's scratch workspace. Teardown of that
workspace is the caller's contract (sandbox_runner.wipe_tree /
contest_node.wipe_scratch_file — verified by the post-run wipe-grep test).

THE ACCEPTANCE PROPERTY (plan Part 5 Phase 2, the single-party simulation):
an attempt without a quorum of shares is (a) BLOCKED — no grant exists, no
byte decrypts — and (b) LOGGED as ``single_party_attempt_blocked`` in the
tamper-evident chain. Both branches live in this module so the property is
one code path, not a convention.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from mt_eval_harness.queue_runner import (
    QueueItemError,
    compute_request_fingerprint,
)
from mt_eval_harness.sovereign.ceremony import (
    CeremonyError,
    _consistent_share_set,
    load_share_file,
    restore_key,
)
from mt_eval_harness.sovereign.local_ledger import LedgerError, LocalLedger
from mt_eval_harness.sovereign.threshold_seal import (
    ThresholdSealError,
    build_aad,
    open_sealed,
)

__all__ = ["SealedRunError", "load_sealed_artifact", "quorum_unseal_for_run"]


class SealedRunError(RuntimeError):
    """A sealed run that must not proceed — always with the reason."""


def load_sealed_artifact(path: str | Path) -> dict:
    p = Path(path).expanduser()
    if not p.is_file():
        raise SealedRunError(f"Sealed artifact not found: {p}")
    artifact = json.loads(p.read_text(encoding="utf-8"))
    if not artifact.get("champollionSealed") or not artifact.get("envelope"):
        raise SealedRunError(f"{p} is not a champollion sealed artifact.")
    return artifact


def quorum_unseal_for_run(*, artifact_path: str | Path,
                          share_paths: list[str | Path],
                          ledger: LocalLedger, node_id: str,
                          method_sha: str, corpus_version: str,
                          requested_by: str, scratch_dir: str | Path,
                          ttl_seconds: int = 3600) -> dict:
    """The whole authorize→grant→claim→decrypt flow for one run.

    Returns {corpus_path, request_id, grant_id, fingerprint, sealed_set_id,
    ledger_head, key_id, m, n, presented}. Raises SealedRunError on every
    refusal — after logging it (blocked AND logged, never silently either).
    The decrypted corpus file is 0600 inside ``scratch_dir``; the CALLER
    must wipe it (and the whole workspace) at teardown.
    """
    artifact = load_sealed_artifact(artifact_path)
    sealed_set_id = artifact.get("cardId") or ""
    if not sealed_set_id:
        raise SealedRunError(
            f"{artifact_path}: artifact has no cardId — cannot bind a "
            f"request fingerprint to an unnamed sealed set.")
    try:
        fingerprint = compute_request_fingerprint(
            {"method_sha": method_sha, "corpus_id": sealed_set_id,
             "corpus_version": corpus_version},
            node_measurement=node_id)
    except QueueItemError as exc:
        raise SealedRunError(f"cannot fingerprint this run: {exc}") from exc

    request_id = f"authreq-local-{uuid.uuid4().hex}"
    ledger.append("request_created", sealed_set_id=sealed_set_id,
                  request_id=request_id, actor=requested_by,
                  fingerprint=fingerprint,
                  detail={"lane": "local-sealed-run", "node": node_id,
                          "method_sha": method_sha,
                          "corpus_version": corpus_version})

    def _blocked(reason: str, presented: int, required) -> SealedRunError:
        ledger.append("single_party_attempt_blocked",
                      sealed_set_id=sealed_set_id, request_id=request_id,
                      actor=f"node:{node_id}", fingerprint=fingerprint,
                      detail={"reason": reason, "presented": presented,
                              "required": required})
        ledger.append("request_denied", sealed_set_id=sealed_set_id,
                      request_id=request_id, actor=f"node:{node_id}",
                      detail={"reason": reason})
        print(f"    ✗ BLOCKED (and logged): {reason}")
        return SealedRunError(
            f"{reason} The attempt was recorded in the tamper-evident "
            f"ledger ({ledger.path}).")

    # -- shares presented = votes cast --------------------------------------
    if not share_paths:
        raise _blocked(
            "No custodian shares presented — the node alone cannot open a "
            "sealed set (M-of-N custody; the platform/operator holds no "
            "quorum).", 0, "M")
    try:
        docs = [load_share_file(p) for p in share_paths]
        head = _consistent_share_set(docs)
    except CeremonyError as exc:
        raise _blocked(f"Share validation failed: {exc}",
                       len(share_paths), "M") from exc
    m, n = int(head["m"]), int(head["n"])
    if head["keyId"] != artifact.get("thresholdKeyId"):
        raise _blocked(
            f"Presented shares belong to key {head['keyId']} but this "
            f"artifact is sealed to key {artifact.get('thresholdKeyId')} — "
            f"wrong ceremony for this sealed set.", len(docs), m)

    # -- set-identity agreement: the shares and the artifact must name the
    # SAME sealed set + custodian group ----------------------------------
    # The keyId check above proves the shares reconstruct the key this
    # artifact was sealed to, but a key can outlive a relabelling: an
    # artifact whose cardId/custodianGroupId were edited still opens (the
    # AAD is baked into the ciphertext, not into cardId), and the run would
    # be LOGGED under the false label while the true corpus decrypts. Bind
    # the ledger's provenance to what the custodians actually hold — refuse
    # any mismatch, and refuse an artifact whose own AAD does not match its
    # own labels (a hand-edited cardId that never touched the AAD).
    share_group = head.get("custodianGroupId")
    art_group = artifact.get("custodianGroupId")
    if head.get("sealedSetId") != sealed_set_id or share_group != art_group:
        raise _blocked(
            f"Set-identity mismatch: shares are for set "
            f"{head.get('sealedSetId')!r}/group {share_group!r}, but this "
            f"artifact is labelled {sealed_set_id!r}/group {art_group!r} — "
            f"a quorum authorizes exactly the set its custodians hold, not a "
            f"relabelled artifact reusing the same key.", len(docs), m)
    expected_aad = build_aad(sealed_set_id, art_group or "")
    if artifact.get("aad") not in (None, expected_aad):
        raise _blocked(
            f"Artifact AAD does not match its own card/group labels "
            f"(expected {expected_aad!r}) — the artifact metadata was "
            f"altered after sealing.", len(docs), m)

    # -- one custodian, one vote: presented shares must come from DISTINCT
    # custodians ----------------------------------------------------------
    # shamir_gf256.combine already rejects duplicate x-coordinates, and the
    # ceremony issues unique custodian names (one share, one holder). But a
    # quorum is M *people*, not M *files*: two DIFFERENT shares whose
    # custodian field names the same holder (a hand-edited label, or a
    # single person hoarding two shares) would otherwise satisfy the count.
    # Enforce the human invariant here, at the gate.
    custodians = [doc.get("custodian") for doc in docs]
    if len(set(custodians)) != len(custodians):
        dupes = sorted({c for c in custodians if custodians.count(c) > 1})
        raise _blocked(
            f"Quorum is M distinct custodians, not M shares: custodian(s) "
            f"{dupes} presented more than one share — one holder cannot "
            f"stand in for the group.", len(docs), m)

    for doc in docs:
        ledger.append("vote_cast", sealed_set_id=sealed_set_id,
                      request_id=request_id, actor=doc["custodian"],
                      detail={"vote": "approve",
                              "shareIndex": doc["index"],
                              "shareFingerprint": doc["fingerprint"]})
    if len(docs) < m:
        raise _blocked(
            f"Quorum not met: {len(docs)} share(s) presented, {m} required "
            f"({head['keyScheme']}).", len(docs), m)

    # -- quorum reconstruction (the authorization act) ----------------------
    try:
        key = restore_key(share_paths,
                          expected_key_id=artifact.get("thresholdKeyId"))
    except CeremonyError as exc:
        raise _blocked(f"Quorum reconstruction failed the commitment "
                       f"check: {exc}", len(docs), m) from exc

    try:
        ledger.append("request_authorized", sealed_set_id=sealed_set_id,
                      request_id=request_id, actor="custodian-quorum",
                      fingerprint=fingerprint,
                      detail={"policy": "per-submission",
                              "quorum": f"{len(docs)}-of-{n}",
                              "m": m, "keyId": head["keyId"]})
        # -- time-boxed, single-use, fingerprint-bound grant ----------------
        try:
            grant = ledger.mint_grant(request_id, ttl_seconds=ttl_seconds,
                                      actor=f"node:{node_id}")
            claimed = ledger.claim_grant(grant["grant_id"],
                                         fingerprint=fingerprint,
                                         node=node_id)
        except LedgerError as exc:
            raise SealedRunError(str(exc)) from exc

        # -- decrypt, only now, only into the run scratch -------------------
        scratch = Path(scratch_dir).expanduser()
        scratch.mkdir(parents=True, exist_ok=True)
        try:
            plaintext = open_sealed(artifact, key.bytes())
        except ThresholdSealError as exc:
            raise SealedRunError(str(exc)) from exc
    finally:
        key.close()  # the joined key dies here, whatever happened above

    corpus_path = scratch / f"sealed-{uuid.uuid4().hex}.json"
    corpus_path.touch(mode=0o600)
    corpus_path.write_bytes(plaintext)
    print(f"    🔓 quorum {len(docs)}-of-{n} (m={m}) authorized "
          f"{request_id}; grant {claimed['grant_id'][:18]}… claimed "
          f"(single-use); corpus decrypted into the run scratch.")
    return {
        "corpus_path": str(corpus_path),
        "request_id": request_id,
        "grant_id": claimed["grant_id"],
        "fingerprint": fingerprint,
        "sealed_set_id": sealed_set_id,
        "ledger_head": ledger.head(),
        "key_id": head["keyId"],
        "m": m, "n": n, "presented": len(docs),
    }
