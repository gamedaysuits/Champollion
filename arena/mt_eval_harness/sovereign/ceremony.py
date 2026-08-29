"""ceremony — `mt-eval node ceremony init|share|verify|restore`.

The key ceremony for a sovereign eval node, exactly as the public node spec
(cli/website/docs/network/sovereignty/sovereign-eval-node.md §4) describes:
in ONE offline sitting, the set key is generated on the node, split M-of-N,
distributed to community-chosen custodians, verified by test reconstruction,
and the assembled key material is destroyed. From then on the key exists
ONLY as custodian shares; it is re-assembled solely in executor memory
(SecretBuffer) during a quorum-authorized run, and zeroed after.

What is and is not persisted — the whole point, so it is spelled out:

  persisted:  ceremony.json  (PUBLIC record: ids, M/N, the group PUBLIC key,
                             share fingerprints — no secret material)
              shares/*.json  (the custodian capability files, mode 0600 —
                             they exist on the node ONLY during the sitting;
                             `ceremony share --wipe-originals` destroys them
                             once distribution + verification are done)
  NEVER persisted: the private scalar (the set key). init derives the public
              key, splits the scalar, and zeroes it in the same call.

A share file is a CAPABILITY. Fewer than M reveal nothing about the key
(information-theoretic — see shamir_gf256); M or more ARE the key. Shares
are plaintext in v1 (paper/token custody is the model; passphrase-wrapping
is future work and saying otherwise would be theatre). Losing more than
N−M shares makes the quorum impossible: re-run the ceremony (new key) and
re-seal from the community's own source copy — the community always retains
its original, because possession was never ours to hold.

Honesty note on verification: `verify`/`restore` prove reconstruction
against the ceremony's public-key commitment (derive-and-compare). A share
file's `m` field is operational metadata — a tampered `m` cannot trick a
sub-quorum reconstruction into passing, because the commitment check fails.

Share format v2 (2026-08-17): the share `fingerprint` now commits to the
FULL header — keyId, m, n, index, custodian, and the share bytes — not the
bytes alone. Two honest consequences: (1) accidental corruption of ANY header
field (a mangled `n`, a swapped `custodian`) is caught at load, not silently
carried; (2) because the ceremony PUBLIC record stores each share's
fingerprint, that record is now a commitment to each share's IDENTITY, so
`verify_ceremony` cross-checks every presented share against it and a
relabelled-but-re-fingerprinted share is detected. What v2 does NOT claim:
the fingerprint is still an UNKEYED hash colocated with the share, so an
attacker who edits a field AND recomputes the fingerprint produces a
self-consistent file — that is caught against the public record (above) or,
for reconstruction, by the public-key commitment, never by the fingerprint
alone. v2 raises the bar and closes the accidental/relabel cases; the
commitment remains the cryptographic backstop.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from mt_eval_harness.sovereign.secret_buffer import SecretBuffer
from mt_eval_harness.sovereign.shamir_gf256 import ShamirError, combine, split
from mt_eval_harness.sovereign.threshold_seal import (
    ThresholdSealError,
    derive_x25519_public_spki_der,
    key_id_for_spki_der,
)

__all__ = [
    "CeremonyError", "CEREMONY_VERSION", "key_scheme_label",
    "init_ceremony", "load_ceremony", "load_share_file", "share_printable",
    "emit_share", "wipe_share_originals", "verify_ceremony", "restore_key",
]

CEREMONY_VERSION = "2"


class CeremonyError(RuntimeError):
    """A ceremony step that must not proceed — always with the reason."""


def key_scheme_label(m: int, n: int) -> str:
    """The honest custody-scheme string stamped on cards + records.
    'shamir-gf256-M-of-N' — deliberately NOT 'TSS': reconstruction assembles
    the key in executor memory (see sovereign/__init__.py)."""
    return f"shamir-gf256-{m}-of-{n}"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _share_fingerprint(share_bytes: bytes, *, key_id: str, m: int, n: int,
                       index: int, custodian: str) -> str:
    """Public, non-reversing identifier committing to a share's FULL identity
    (v2): the share bytes AND its header (keyId, m, n, index, custodian).
    Safe to print/log — it is a preimage-resistant hash of high-entropy share
    bytes plus low-entropy labels; it reveals nothing of the share content and
    identifies WHICH share (of WHICH ceremony, held by WHOM) was presented.

    The version tag is domain-separated into the hash so a v1 fingerprint can
    never be mistaken for a v2 one."""
    canonical = "|".join([
        f"champollion-share-fp:v{CEREMONY_VERSION}",
        str(key_id or ""), str(m), str(n), str(index), str(custodian or ""),
        base64.b64encode(share_bytes).decode(),
    ])
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# init — generate, split, record, zero. The only function that ever sees the
# whole scalar outside a run context.
# ---------------------------------------------------------------------------

def init_ceremony(out_dir: str | Path, *, sealed_set_id: str,
                  custodian_group_id: str, m: int, n: int,
                  custodians: list[str] | None = None) -> dict:
    """Run the generation half of the ceremony; returns the public record.

    Refuses to overwrite an existing ceremony directory — a re-key is a
    deliberate NEW ceremony into a fresh directory, never a silent clobber.
    """
    out = Path(out_dir).expanduser()
    ceremony_path = out / "ceremony.json"
    if ceremony_path.exists():
        raise CeremonyError(
            f"{ceremony_path} already exists — a re-key is a NEW ceremony "
            f"into a fresh directory (then re-seal the corpus to the new "
            f"key). Refusing to overwrite an existing ceremony record.")
    if not sealed_set_id or not custodian_group_id:
        raise CeremonyError("ceremony init needs --set (the sealed-set/card "
                            "id) and --group (the custodian group id).")
    if custodians is None or not custodians:
        custodians = [f"custodian-{i}" for i in range(1, n + 1)]
    if len(custodians) != n:
        raise CeremonyError(
            f"{len(custodians)} custodian name(s) for n={n} shares — name "
            f"every custodian (or none, for placeholder names).")
    if len(set(custodians)) != len(custodians):
        raise CeremonyError("custodian names must be unique — one share, "
                            "one holder.")
    try:
        # The ONLY window in which the whole scalar exists: generate → derive
        # public → split → zero, all inside this function.
        with SecretBuffer(bytearray(os.urandom(32))) as scalar:
            public_der = derive_x25519_public_spki_der(scalar.bytes())
            shares = split(scalar.bytes(), n, m)
    except (ShamirError, ThresholdSealError) as exc:
        raise CeremonyError(str(exc)) from exc

    key_id = key_id_for_spki_der(public_der)
    created_at = _utcnow_iso()
    scheme = key_scheme_label(m, n)
    shares_dir = out / "shares"
    shares_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    for idx, (custodian, share_bytes) in enumerate(zip(custodians, shares), 1):
        fingerprint = _share_fingerprint(
            share_bytes, key_id=key_id, m=m, n=n, index=idx,
            custodian=custodian)
        share_doc = {
            "champollionShare": CEREMONY_VERSION,
            "sealedSetId": sealed_set_id,
            "custodianGroupId": custodian_group_id,
            "keyId": key_id,
            "keyScheme": scheme,
            "m": m,
            "n": n,
            "index": idx,
            "custodian": custodian,
            "shareB64": base64.b64encode(share_bytes).decode(),
            "fingerprint": fingerprint,
            "createdAt": created_at,
            "_note": (
                f"CUSTODIAN KEY SHARE {idx}/{n} for sealed set "
                f"'{sealed_set_id}'. This file is a capability: any {m} "
                f"shares reconstruct the set key; fewer than {m} reveal "
                f"nothing. Keep it offline (paper or token), never in git, "
                f"never on a networked machine."),
        }
        share_path = shares_dir / f"share-{idx}-{custodian}.json"
        share_path.write_text(json.dumps(share_doc, ensure_ascii=False,
                                         indent=2) + "\n", encoding="utf-8")
        share_path.chmod(0o600)
        entries.append({"index": idx, "custodian": custodian,
                        "fingerprint": fingerprint,
                        "file": share_path.name})

    record = {
        "champollionCeremony": CEREMONY_VERSION,
        "sealedSetId": sealed_set_id,
        "custodianGroupId": custodian_group_id,
        "keyId": key_id,
        "keyScheme": scheme,
        "m": m,
        "n": n,
        "publicKeyDerB64": base64.b64encode(public_der).decode(),
        "custodians": entries,
        "createdAt": created_at,
        "_note": (
            "PUBLIC ceremony record — contains the group PUBLIC key and "
            "share fingerprints only; publishable. The private key was "
            "split M-of-N and zeroed in the same call that wrote this file; "
            "it exists nowhere except as the custodian shares."),
    }
    ceremony_path.write_text(json.dumps(record, ensure_ascii=False, indent=2)
                             + "\n", encoding="utf-8")

    print(f"  Ceremony for '{sealed_set_id}' ({scheme}):")
    print(f"    key id       {key_id}")
    print(f"    public key   recorded in {ceremony_path}")
    print(f"    shares       {n} written under {shares_dir}/ (mode 600)")
    print(f"  The set key was zeroed — it now exists ONLY as the {n} shares.")
    print(f"  Next: `mt-eval node ceremony share` to distribute each share, "
          f"`ceremony verify` from the DISTRIBUTED copies, then "
          f"`ceremony share --wipe-originals`.")
    return record


# ---------------------------------------------------------------------------
# Loading + validation helpers.
# ---------------------------------------------------------------------------

def load_ceremony(ceremony_dir_or_file: str | Path) -> dict:
    p = Path(ceremony_dir_or_file).expanduser()
    if p.is_dir():
        p = p / "ceremony.json"
    if not p.is_file():
        raise CeremonyError(f"No ceremony record at {p} — run "
                            f"`mt-eval node ceremony init` first.")
    record = json.loads(p.read_text(encoding="utf-8"))
    if record.get("champollionCeremony") != CEREMONY_VERSION:
        raise CeremonyError(f"{p} is not a v{CEREMONY_VERSION} ceremony "
                            f"record.")
    return record


def load_share_file(path: str | Path) -> dict:
    p = Path(path).expanduser()
    if not p.is_file():
        raise CeremonyError(f"Share file not found: {p}")
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise CeremonyError(f"{p} is not valid JSON: {exc}") from exc
    if doc.get("champollionShare") != CEREMONY_VERSION:
        raise CeremonyError(f"{p} is not a v{CEREMONY_VERSION} custodian "
                            f"share file.")
    try:
        share_bytes = base64.b64decode(doc["shareB64"], validate=True)
    except Exception as exc:
        raise CeremonyError(f"{p}: shareB64 is not valid base64.") from exc
    if len(share_bytes) != 33:  # 32 secret bytes + x-coordinate
        raise CeremonyError(
            f"{p}: share is {len(share_bytes)} bytes, expected 33 "
            f"(32-byte scalar share + x-coordinate).")
    try:
        expect_fp = _share_fingerprint(
            share_bytes, key_id=doc.get("keyId"), m=doc.get("m"),
            n=doc.get("n"), index=doc.get("index"),
            custodian=doc.get("custodian"))
    except Exception as exc:  # a missing/garbled header field
        raise CeremonyError(
            f"{p}: share header is incomplete or malformed ({exc}) — a v"
            f"{CEREMONY_VERSION} share must carry keyId/m/n/index/custodian."
        ) from exc
    if expect_fp != doc.get("fingerprint"):
        raise CeremonyError(
            f"{p}: share fingerprint mismatch — the file's bytes OR its "
            f"header (keyId/m/n/index/custodian) were altered or corrupted "
            f"in storage. Refusing to use it.")
    doc["_shareBytes"] = share_bytes
    doc["_path"] = str(p)
    return doc


def _consistent_share_set(share_docs: list[dict]) -> dict:
    """All presented shares must belong to the same ceremony (same keyId,
    scheme, m, n, set). Returns the common header."""
    if not share_docs:
        raise CeremonyError("No shares presented.")
    head = share_docs[0]
    for doc in share_docs[1:]:
        for field in ("keyId", "keyScheme", "m", "n", "sealedSetId",
                      "custodianGroupId"):
            if doc.get(field) != head.get(field):
                raise CeremonyError(
                    f"Shares from DIFFERENT ceremonies presented "
                    f"({field}: {head.get(field)!r} vs {doc.get(field)!r}) — "
                    f"a quorum is M shares of ONE ceremony.")
    seen = set()
    for doc in share_docs:
        if doc["index"] in seen:
            raise CeremonyError(
                f"Share index {doc['index']} presented twice — each "
                f"custodian share counts once.")
        seen.add(doc["index"])
    return {k: head.get(k) for k in ("keyId", "keyScheme", "m", "n",
                                     "sealedSetId", "custodianGroupId")}


# ---------------------------------------------------------------------------
# share — emit/copy the custodian files + printable backup text.
# ---------------------------------------------------------------------------

def share_printable(share_doc: dict) -> str:
    """A paper-backup rendering of one share (sealed-envelope text)."""
    b64 = share_doc["shareB64"]
    lines = [b64[i:i + 44] for i in range(0, len(b64), 44)]
    return "\n".join([
        "CHAMPOLLION CUSTODIAN KEY SHARE — KEEP SEALED, KEEP OFFLINE",
        f"  sealed set    : {share_doc['sealedSetId']}",
        f"  custodian     : {share_doc['custodian']}"
        f"  (share {share_doc['index']} of {share_doc['n']})",
        f"  quorum        : any {share_doc['m']} of {share_doc['n']} shares",
        f"  key id        : {share_doc['keyId']}",
        f"  fingerprint   : {share_doc['fingerprint']}",
        f"  created       : {share_doc['createdAt']}",
        "  share (base64, restore with `mt-eval node ceremony restore`):",
        *[f"    {ln}" for ln in lines],
        "  Any M shares reconstruct the set key; fewer reveal nothing.",
        "  If this envelope is opened outside a ceremony, tell the group —",
        "  a suspected compromise means re-keying and re-sealing.",
    ])


def emit_share(ceremony_dir: str | Path, *, custodian: str | None = None,
               dest: str | Path | None = None, qr: bool = False,
               allow_all_shares: bool = False) -> list[dict]:
    """List/emit shares from the ceremony directory. With ``custodian`` +
    ``dest``, copy that custodian's share file (+ printable .txt) to the
    destination (a token/drive). With ``qr``, also render a QR if the
    optional `qrcode` package is present (honest message if not).

    SAFETY: emitting/rendering a share EXPOSES key-share material. Doing so
    for ALL custodians at once (no ``custodian`` filter) puts the whole
    N-share set on one medium / one screen — defeating M-of-N in a single
    step. That is refused unless ``allow_all_shares`` is set explicitly
    (CLI: ``--all-shares-i-understand``). Plain listing (no ``dest``, no
    ``qr``) is always allowed — it prints fingerprints, not shares."""
    out = Path(ceremony_dir).expanduser()
    record = load_ceremony(out)
    shares_dir = out / "shares"
    if (dest is not None or qr) and custodian is None and not allow_all_shares:
        raise CeremonyError(
            "refusing to emit/render EVERY share to one place — that puts the "
            "whole key on a single medium and defeats M-of-N. Pass "
            "--custodian NAME to emit one share to its own token, or "
            "--all-shares-i-understand if you truly intend to.")
    emitted: list[dict] = []
    wanted = [c for c in record["custodians"]
              if custodian is None or c["custodian"] == custodian]
    if custodian is not None and not wanted:
        names = ", ".join(c["custodian"] for c in record["custodians"])
        raise CeremonyError(f"No custodian {custodian!r} in this ceremony "
                            f"(have: {names}).")
    for entry in wanted:
        src = shares_dir / entry["file"]
        if not src.is_file():
            print(f"    ⚠ {entry['custodian']}: original share file already "
                  f"wiped/distributed ({src.name} absent) — restore/verify "
                  f"now need the custodian's own copy.")
            continue
        doc = load_share_file(src)
        emitted.append(doc)
        if dest is not None:
            d = Path(dest).expanduser()
            d.mkdir(parents=True, exist_ok=True)
            target = d / src.name
            target.write_text(json.dumps(
                {k: v for k, v in doc.items() if not k.startswith("_")},
                ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            target.chmod(0o600)
            (d / (src.stem + ".txt")).write_text(
                share_printable(doc) + "\n", encoding="utf-8")
            print(f"  → {entry['custodian']}: share + printable copied to "
                  f"{d}")
            print(f"    ⚠ this copy IS key-share material; `ceremony share "
                  f"--wipe-originals` clears the ceremony dir but NOT this "
                  f"{d} copy — the holder owns its lifecycle.")
        else:
            print(f"  {entry['custodian']}  share {doc['index']}/{doc['n']}  "
                  f"fingerprint {doc['fingerprint']}  ({src.name})")
        if qr:
            _print_qr(doc)
    if dest is None and emitted:
        print(f"  Use `--custodian NAME --dest /path/to/token` to copy one "
              f"share out, `--qr` for a scannable copy.")
    return emitted


def _print_qr(share_doc: dict) -> None:
    try:
        import qrcode  # optional; never a hard dependency
    except ImportError:
        print("    (QR emission needs the optional 'qrcode' package: "
              "pip install qrcode — the JSON + printable text carry the "
              "same share.)")
        return
    print(f"    ⚠ the QR below ENCODES custodian {share_doc['custodian']}'s "
          f"secret share ({share_doc['index']}/{share_doc['n']}). It is key "
          f"material — capture it to paper/token, then clear the screen and "
          f"scrollback. Anyone who scans it holds this share.")
    payload = json.dumps({k: v for k, v in share_doc.items()
                          if not k.startswith("_")}, sort_keys=True)
    q = qrcode.QRCode(border=1)
    q.add_data(payload)
    q.print_ascii(invert=True)


def wipe_share_originals(ceremony_dir: str | Path) -> int:
    """Overwrite-then-delete the ceremony directory's share files once
    distribution + verification are done (`ceremony share --wipe-originals`).
    The ceremony.json PUBLIC record stays."""
    from mt_eval_harness.sandbox_runner import wipe_tree
    out = Path(ceremony_dir).expanduser()
    shares_dir = out / "shares"
    if not shares_dir.is_dir():
        print("  No share originals present (already wiped).")
        return 0
    n = sum(1 for p in shares_dir.iterdir() if p.is_file())
    wipe_tree(shares_dir)
    print(f"  Wiped {n} share original(s) from {shares_dir} — the key now "
          f"exists ONLY with the custodians.")
    return n


# ---------------------------------------------------------------------------
# verify / restore — reconstruction against the public-key commitment.
# ---------------------------------------------------------------------------

def restore_key(share_paths: list[str | Path], *,
                expected_key_id: str | None = None,
                expected_public_der_b64: str | None = None) -> SecretBuffer:
    """Reconstruct the set key from ≥M share files INTO MEMORY ONLY.

    Returns an OPEN SecretBuffer — the caller must ``close()`` it (or use a
    ``with`` block) the moment the key has served its purpose. Refuses, with
    the reason, on: inconsistent share sets, fewer than M shares, or a
    reconstruction that fails the public-key commitment check.
    """
    docs = [load_share_file(p) for p in share_paths]
    head = _consistent_share_set(docs)
    m = int(head["m"])
    if len(docs) < m:
        raise CeremonyError(
            f"Quorum not met: {len(docs)} share(s) presented, {m} required "
            f"({head['keyScheme']}). No reconstruction is possible — this "
            f"is the property working, not an error to route around.")
    if expected_key_id and head["keyId"] != expected_key_id:
        raise CeremonyError(
            f"These shares belong to key {head['keyId']}, but the target "
            f"expects key {expected_key_id} — wrong ceremony for this "
            f"artifact.")
    try:
        secret = combine([d["_shareBytes"] for d in docs])
    except ShamirError as exc:
        raise CeremonyError(str(exc)) from exc
    buf = SecretBuffer(bytearray(secret))
    # secret was copied into the buffer; drop the local reference content.
    # (bytes objects cannot be zeroed from Python — documented limit in
    # secret_buffer.py; the buffer is the managed copy.)
    del secret
    derived_der = derive_x25519_public_spki_der(buf.bytes())
    derived_key_id = key_id_for_spki_der(derived_der)
    ok = derived_key_id == head["keyId"]
    if ok and expected_public_der_b64:
        ok = base64.b64encode(derived_der).decode() == expected_public_der_b64
    if not ok:
        buf.close()
        raise CeremonyError(
            f"Reconstruction FAILED the commitment check: the {len(docs)} "
            f"presented share(s) derive key {derived_key_id}, expected "
            f"{head['keyId']}. Either a share is corrupted/forged or the "
            f"quorum mixed ceremonies. The joined value was zeroed; nothing "
            f"was persisted.")
    return buf


def verify_ceremony(ceremony_dir_or_file: str | Path,
                    share_paths: list[str | Path]) -> dict:
    """Test reconstruction WITHOUT persisting the joined key.

    Reconstructs from the presented shares, compares against the ceremony
    record's public key, zeroes the buffer, reports. Run this during the
    sitting from the DISTRIBUTED copies (tokens/paper), not the originals —
    it is the proof the distribution actually works."""
    record = load_ceremony(ceremony_dir_or_file)
    # v2 cross-check: every presented share's fingerprint must match the one
    # the PUBLIC ceremony record committed to for that share index. This
    # catches a relabelled-but-re-fingerprinted share (a self-consistent file
    # whose header no longer matches what was issued) — the fingerprint alone
    # cannot, because it is unkeyed and travels with the share.
    recorded_fp = {int(e["index"]): e["fingerprint"]
                   for e in record.get("custodians", [])}
    try:
        for path in share_paths:
            doc = load_share_file(path)
            idx = int(doc["index"])
            if idx not in recorded_fp:
                raise CeremonyError(
                    f"share index {idx} is not in this ceremony's record — "
                    f"not a share issued by this ceremony.")
            if doc["fingerprint"] != recorded_fp[idx]:
                raise CeremonyError(
                    f"share {idx} ({doc.get('custodian')}) does not match "
                    f"the fingerprint the ceremony record committed to — the "
                    f"share header was altered after issuance.")
        buf = restore_key(
            share_paths,
            expected_key_id=record["keyId"],
            expected_public_der_b64=record["publicKeyDerB64"])
    except CeremonyError as exc:
        print(f"  ✗ verify FAILED: {exc}")
        return {"ok": False, "reason": str(exc), "keyId": record["keyId"]}
    buf.close()
    print(f"  ✅ verified: {len(share_paths)} share(s) reconstruct key "
          f"{record['keyId']} ({record['keyScheme']}). The joined key was "
          f"held in locked memory only and has been zeroed — nothing was "
          f"persisted.")
    return {"ok": True, "keyId": record["keyId"],
            "presented": len(share_paths), "m": record["m"],
            "n": record["n"]}
