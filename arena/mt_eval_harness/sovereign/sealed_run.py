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


def quorum_unseal_for_run(*, artifact_path: str | Path | None = None,
                          artifact_paths: list[str | Path] | None = None,
                          share_paths: list[str | Path],
                          ledger: LocalLedger, node_id: str,
                          method_sha: str, corpus_version: str,
                          requested_by: str, scratch_dir: str | Path,
                          ttl_seconds: int = 3600,
                          used_detail: dict | None = None) -> dict:
    """The whole authorize→grant→claim→decrypt flow for one run.

    ONE ceremony, EVERY sealed split the run covers (contract D1). Pass
    ``artifact_paths`` to open the contest's secret set and its sealed
    HOLDOUT split under a single quorum: the custodians convene once, the
    ledger records one request/one grant, and both artifacts' digests are
    written into the chain. ``artifact_path`` (singular) is the one-set form
    and is exactly ``artifact_paths=[artifact_path]``.

    The FIRST artifact is the run's primary set: its ``cardId`` is what the
    request fingerprint binds and what every ledger event is filed under. All
    artifacts must be sealed to the SAME threshold key and custodian group —
    a quorum authorizes the sets its custodians actually hold, and two
    different custodian groups are two different ceremonies.

    ``used_detail`` rides the ``grant_used`` event (content-free ids —
    ``sandbox_runner.grant_sets_detail``), so the air-gapped chain says which
    splits the one grant covered, exactly as the connected lane's
    ``mint_and_claim_grant`` does.

    Returns {corpus_path, request_id, grant_id, fingerprint, sealed_set_id,
    ledger_head, key_id, m, n, presented} for the primary set, plus
    ``sets`` — one ``{role, sealed_set_id, ciphertext_digest, corpus_path}``
    per artifact, ``role`` being ``main`` for the first and ``holdout`` for
    the second — and ``corpus_paths``. Raises SealedRunError on every refusal
    — after logging it (blocked AND logged, never silently either). Every
    decrypted corpus file is 0600 inside ``scratch_dir``; the CALLER must
    wipe them (and the whole workspace) at teardown.
    """
    if (artifact_path is None) == (artifact_paths is None):
        raise SealedRunError(
            "quorum_unseal_for_run takes exactly one of artifact_path (one "
            "sealed set) or artifact_paths (the run's sealed splits, primary "
            "first).")
    paths = ([artifact_path] if artifact_paths is None
             else [p for p in artifact_paths])
    if not paths:
        raise SealedRunError(
            "artifact_paths is empty — a ceremony opens at least one sealed "
            "set.")
    if len(paths) > 2:
        raise SealedRunError(
            f"{len(paths)} artifacts were passed to one ceremony. A contest "
            f"run covers its secret set and at most ONE holdout split "
            f"(metadata.sealed_holdout_set_id) — refusing to open more sets "
            f"than the contest declares under a single quorum.")
    artifacts = [load_sealed_artifact(p) for p in paths]
    artifact = artifacts[0]
    sealed_set_id = artifact.get("cardId") or ""
    if not sealed_set_id:
        raise SealedRunError(
            f"{paths[0]}: artifact has no cardId — cannot bind a "
            f"request fingerprint to an unnamed sealed set.")
    for extra_path, extra in zip(paths[1:], artifacts[1:]):
        extra_id = extra.get("cardId") or ""
        if not extra_id:
            raise SealedRunError(
                f"{extra_path}: artifact has no cardId — a second split "
                f"opened under this quorum has to name the set its scores "
                f"will be labeled with.")
        if extra_id == sealed_set_id:
            raise SealedRunError(
                f"{extra_path} and {paths[0]} are both labelled "
                f"{sealed_set_id!r} — the holdout is a SECOND, disjoint "
                f"split, not the same set opened twice.")
    artifact_digests = [
        {"sealed_set_id": a.get("cardId"),
         "ciphertext_digest": a.get("ciphertextDigest"),
         "role": "main" if i == 0 else "holdout"}
        for i, a in enumerate(artifacts)]
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
                          "corpus_version": corpus_version,
                          # Contract D1: one grant, every split it covers —
                          # named, with the ciphertext digest of each sealed
                          # artifact, so the chain says WHICH bytes this
                          # ceremony was asked to open.
                          "artifacts": artifact_digests})

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

    # -- and the SAME agreement for every further split this one ceremony is
    # being asked to open (contract D1). One quorum opens one custodian
    # group's sets: a second artifact sealed to another key or another group
    # is another ceremony, and a relabelled one would decrypt under a false
    # label exactly as the primary would. Checked HERE, after the shares are
    # in hand, so a mismatch is BLOCKED and LOGGED like every other refusal.
    for extra_path, extra in zip(paths[1:], artifacts[1:]):
        if extra.get("thresholdKeyId") != artifact.get("thresholdKeyId"):
            raise _blocked(
                f"A second split ({extra.get('cardId')!r}) is sealed to key "
                f"{extra.get('thresholdKeyId')!r} but {sealed_set_id!r} is "
                f"sealed to {artifact.get('thresholdKeyId')!r} — one quorum "
                f"opens one custodian group's sets; these are two "
                f"ceremonies.", len(docs), m)
        if extra.get("custodianGroupId") != art_group:
            raise _blocked(
                f"A second split ({extra.get('cardId')!r}) belongs to "
                f"custodian group {extra.get('custodianGroupId')!r} but "
                f"{sealed_set_id!r} belongs to {art_group!r} — a quorum "
                f"authorizes exactly the group its custodians hold.",
                len(docs), m)
        extra_aad = build_aad(extra.get("cardId") or "",
                              extra.get("custodianGroupId") or "")
        if extra.get("aad") not in (None, extra_aad):
            raise _blocked(
                f"A second split ({extra.get('cardId')!r}) has an AAD that "
                f"does not match its own card/group labels (expected "
                f"{extra_aad!r}) — the artifact metadata was altered after "
                f"sealing.", len(docs), m)

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
                              "m": m, "keyId": head["keyId"],
                              "artifacts": artifact_digests})
        # -- time-boxed, single-use, fingerprint-bound grant ----------------
        try:
            grant = ledger.mint_grant(request_id, ttl_seconds=ttl_seconds,
                                      actor=f"node:{node_id}")
            claimed = ledger.claim_grant(grant["grant_id"],
                                         fingerprint=fingerprint,
                                         node=node_id,
                                         used_detail=used_detail)
        except LedgerError as exc:
            raise SealedRunError(str(exc)) from exc

        # -- decrypt, only now, only into the run scratch -------------------
        scratch = Path(scratch_dir).expanduser()
        scratch.mkdir(parents=True, exist_ok=True)
        try:
            plaintexts = [open_sealed(a, key.bytes()) for a in artifacts]
        except ThresholdSealError as exc:
            raise SealedRunError(str(exc)) from exc
    finally:
        key.close()  # the joined key dies here, whatever happened above

    sets: list[dict] = []
    for meta, plaintext in zip(artifact_digests, plaintexts):
        out = scratch / f"sealed-{uuid.uuid4().hex}.json"
        out.touch(mode=0o600)
        out.write_bytes(plaintext)
        sets.append({**meta, "corpus_path": str(out)})
    corpus_path = sets[0]["corpus_path"]
    opened = ", ".join(f"{s['sealed_set_id']} ({s['role']})" for s in sets)
    print(f"    🔓 quorum {len(docs)}-of-{n} (m={m}) authorized "
          f"{request_id}; grant {claimed['grant_id'][:18]}… claimed "
          f"(single-use); {len(sets)} sealed split(s) decrypted into the run "
          f"scratch: {opened}.")
    return {
        "corpus_path": corpus_path,
        "corpus_paths": [s["corpus_path"] for s in sets],
        # One entry per split this ONE ceremony opened (contract D1).
        "sets": sets,
        "request_id": request_id,
        "grant_id": claimed["grant_id"],
        "fingerprint": fingerprint,
        "sealed_set_id": sealed_set_id,
        "ledger_head": ledger.head(),
        "key_id": head["keyId"],
        "m": m, "n": n, "presented": len(docs),
    }
