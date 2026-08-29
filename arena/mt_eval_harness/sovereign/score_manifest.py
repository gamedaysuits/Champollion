"""score_manifest — signed score manifests (node spec §5, "what attested means").

Every sealed evaluation produces a SCORE MANIFEST: the node's Ed25519
signature over (scores + method-package hashes + corpus checksum + the
audit-ledger head). Anyone holding the node's published public key runs
`mt-eval node verify-manifest` and learns that THIS node produced THESE
scores for THESE exact inputs, anchored at THAT point of the tamper-evident
chain.

That is SOFTWARE attestation — integrity of the record. It does NOT prove
what silicon executed the run; hardware remote attestation (TEE) is not
claimed anywhere, deliberately (node spec §5).

Signature format: the seal.mjs detached block
({scheme: 'ed25519-single-node-wave1', keyId, payloadSha256, signatureB64,
signedAt}) over the manifest file's EXACT bytes — so a manifest signed here
verifies with `champollion seal-corpus verify`, and one signed there
verifies here. One format, two independent verifiers.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from mt_eval_harness.sovereign.threshold_seal import (
    SIGN_SCHEME,
    ThresholdSealError,
    load_key_material,
    sign_payload,
    verify_payload,
)

__all__ = [
    "MANIFEST_VERSION", "ScoreManifestError", "build_score_manifest",
    "write_score_manifest", "sign_manifest_file", "verify_manifest_file",
]

MANIFEST_VERSION = "1"

# Scores-only guard: a manifest carries AGGREGATES. Keys that smell like
# per-entry text, and any long string value, are refused loudly — the L3
# posture applied to this surface too.
_FORBIDDEN_KEYS = {"source", "reference", "references", "hypothesis",
                   "hypotheses", "target", "text", "sentence", "entries"}
_MAX_STRING = 300


class ScoreManifestError(RuntimeError):
    """A manifest that must not be built/signed/accepted — with the reason."""


def _assert_scores_only(value, path="scores"):
    if isinstance(value, dict):
        for k, v in value.items():
            if str(k).lower() in _FORBIDDEN_KEYS:
                raise ScoreManifestError(
                    f"score manifest refused: {path}.{k} looks like corpus/"
                    f"per-entry content — a manifest is scores-only (the L3 "
                    f"posture; publish text through nothing).")
            _assert_scores_only(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _assert_scores_only(v, f"{path}[{i}]")
    elif isinstance(value, str) and len(value) > _MAX_STRING:
        raise ScoreManifestError(
            f"score manifest refused: {path} holds a {len(value)}-char "
            f"string — aggregates only; no sentence-length text rides a "
            f"manifest.")


def build_score_manifest(*, node_id: str, sealed_set_id: str,
                         corpus_version: str,
                         corpus_ciphertext_digest: str | None,
                         method_sha256: str, scores: dict,
                         audit_head: str,
                         request_id: str | None = None,
                         grant_id: str | None = None,
                         run_card_id: str | None = None,
                         static_checks: dict | None = None) -> dict:
    """Assemble the manifest dict (content-free by construction + guard)."""
    if not scores or not isinstance(scores, dict):
        raise ScoreManifestError("a score manifest needs a non-empty scores "
                                 "dict (aggregates).")
    _assert_scores_only(scores)
    return {
        "champollionScoreManifest": MANIFEST_VERSION,
        "nodeId": node_id,
        "sealedSetId": sealed_set_id,
        "corpusVersion": corpus_version,
        "corpusCiphertextDigest": corpus_ciphertext_digest,
        "methodSha256": method_sha256,
        "scores": scores,
        "auditHead": audit_head,
        "requestId": request_id,
        "grantId": grant_id,
        "runCardId": run_card_id,
        "staticChecks": static_checks,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "_note": (
            "Signed scores-only manifest from a sovereign eval node. "
            "auditHead anchors the node's hash-chained authorization "
            "ledger at signing time. Software attestation only — the "
            "signature proves integrity of this record, not what hardware "
            "executed the run (no TEE claim)."),
    }


def write_score_manifest(manifest: dict, path: str | Path) -> Path:
    p = Path(path).expanduser()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(manifest, ensure_ascii=False, indent=2,
                            sort_keys=True) + "\n", encoding="utf-8")
    return p


def sign_manifest_file(payload_path: str | Path, key_source,
                       sig_out: str | Path | None = None) -> Path:
    """Detached-sign the file's exact bytes; write `<payload>.sig.json`."""
    p = Path(payload_path).expanduser()
    if not p.is_file():
        raise ScoreManifestError(f"nothing to sign: {p} does not exist")
    try:
        priv = load_key_material(key_source, want="private")
        block = sign_payload(p.read_bytes(), priv)
    except ThresholdSealError as exc:
        raise ScoreManifestError(str(exc)) from exc
    block["signedAt"] = datetime.now(timezone.utc).isoformat()
    sig_path = (Path(sig_out).expanduser() if sig_out
                else p.with_name(p.name + ".sig.json"))
    sig_path.write_text(json.dumps(block, ensure_ascii=False, indent=2)
                        + "\n", encoding="utf-8")
    print(f"  Signed {p.name}: scheme {block['scheme']}, key "
          f"{block['keyId']}, payload sha256 "
          f"{block['payloadSha256'][:16]}… → {sig_path.name}")
    return sig_path


def verify_manifest_file(payload_path: str | Path, sig_path: str | Path,
                         pubkey_source) -> dict:
    """Verify a manifest against its detached signature + a published pubkey.

    Returns {ok, reasons, keyId, scheme, payloadSha256} and PRINTS the
    verdict — a failure is a refusal for the caller, never a warning."""
    p = Path(payload_path).expanduser()
    s = Path(sig_path).expanduser()
    reasons: list[str] = []
    if not p.is_file():
        reasons.append(f"payload not found: {p}")
    if not s.is_file():
        reasons.append(f"signature not found: {s}")
    if reasons:
        print("  ✗ verify-manifest: " + "; ".join(reasons))
        return {"ok": False, "reasons": reasons}
    try:
        block = json.loads(s.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        reasons.append(f"signature file is not valid JSON: {exc}")
        print("  ✗ verify-manifest: " + reasons[-1])
        return {"ok": False, "reasons": reasons}
    payload = p.read_bytes()
    scheme = block.get("scheme")
    if scheme != SIGN_SCHEME:
        reasons.append(
            f"unknown signature scheme {scheme!r} (this build verifies "
            f"{SIGN_SCHEME!r})")
    actual_sha = hashlib.sha256(payload).hexdigest()
    if block.get("payloadSha256") and block["payloadSha256"] != actual_sha:
        reasons.append(
            f"payload sha256 mismatch: file is {actual_sha[:16]}… but the "
            f"signature block recorded {str(block['payloadSha256'])[:16]}… "
            f"— the manifest bytes changed after signing")
    sig_ok = False
    if not reasons:
        try:
            pub = load_key_material(pubkey_source, want="public")
            sig_ok = verify_payload(payload, block.get("signatureB64", ""),
                                    pub)
        except ThresholdSealError as exc:
            reasons.append(str(exc))
        if not sig_ok and not reasons:
            reasons.append("Ed25519 signature INVALID for these bytes under "
                           "this public key")
    ok = sig_ok and not reasons
    if ok:
        print(f"  ✅ verified: {p.name} was signed by key "
              f"{block.get('keyId')} ({scheme}); payload sha256 "
              f"{actual_sha[:16]}… intact.")
    else:
        print("  ✗ verify-manifest REFUSED: " + "; ".join(reasons))
    return {"ok": ok, "reasons": reasons, "keyId": block.get("keyId"),
            "scheme": scheme, "payloadSha256": actual_sha}
