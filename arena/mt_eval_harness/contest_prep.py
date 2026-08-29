"""contest_prep — `mt-eval contest prepare`: split, seal, and register a contest.

One command takes an organizer's master corpus and produces the three-tier
secrecy ladder of an organizer-run contest (docs/ORGANIZER_NODE_RUNBOOK.md):

  T0  PUBLIC DEV / QUALIFIER — source + references released. This corpus IS
      the public qualifier (migration 042): a submission must clear its
      threshold before the secret set is ever scored. Its corpus id follows
      the qualifier shape eval-<src>-<tgt>-<slug>-qualifier-vYYYY.
  T1  BLIND TEST — the SOURCE side is released for participants to translate;
      the REFERENCES exist only on the organizer's machine, SEALED AT REST by
      default (champollion seal-corpus; single-keypair Wave-1 custody, labeled
      honestly). Registered content-free in sealed_sets (migration 037).
  T2  FULLY SECRET (optional) — source AND references sealed; no hypotheses
      lane exists for it, because participants never see the source. It is
      consumed by the Phase-B method-execution lane (sandbox-evaluation-spec).

Hard rules encoded here:
  * DETERMINISTIC split — an explicit --seed is REQUIRED and recorded in the
    organizer-local manifest, so the split is reproducible and auditable.
  * --qualifier-threshold is REQUIRED (thresholds are data, never a code
    default — CLAUDE.md SSOT rule).
  * Plaintext refs (--plaintext-refs) REFUSE authorization_model
    'per-submission': per-submission custody ceremonies over refs that are
    lying around unencrypted would be security theater (fail-closed, plan D2).
  * Registration never creates a quarantined `datasets` row for the blind
    set: migration 022's run_cards guard would then BLOCK score publishing.
    The WMT-style posture ("the secret set never ranks as a dataset, its
    scores publish") is carried by the sealed_sets registration alone —
    quarantined-by-default in ITS table (037), contest-gated by 041, with
    per-entry content withheld by publish.py + migration 033 regardless.
  * NO corpus content ever reaches Supabase — registration rows are
    content-free (ids, digests, thresholds, ISO codes).

The crypto is NOT reimplemented here: sealing shells out (shell-free argv)
to `champollion seal-corpus`, so lib/seal.mjs stays the single cipher
implementation.
"""

from __future__ import annotations

import json
import os
import random
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from mt_eval_harness.external_scoring import sha256_file
from mt_eval_harness.qualifier_gate import build_qualifier_id

AUTHORIZATION_MODELS = ("per-submission", "blanket", "open")


class ContestPrepError(ValueError):
    """A prepare request that must not proceed — always with the reason."""


# ---------------------------------------------------------------------------
# Deterministic split — pure function.
# ---------------------------------------------------------------------------

def split_corpus(
    entries: list[dict],
    *,
    dev_size: int,
    blind_size: int,
    secret_size: int = 0,
    seed: int,
) -> tuple[list[dict], list[dict], list[dict]]:
    """Deterministically split a master corpus into disjoint dev/blind/secret.

    Same entries + same seed => byte-identical split, forever (the seed is
    recorded in the organizer-local manifest). Sizes must be positive for the
    two required tiers and must fit the corpus exactly or leave a remainder —
    never overlap.
    """
    if dev_size <= 0 or blind_size <= 0:
        raise ContestPrepError(
            f"dev-size and blind-size must be positive (got {dev_size}, "
            f"{blind_size}) — a contest needs both a public qualifier and a "
            f"blind test set.")
    if secret_size < 0:
        raise ContestPrepError(f"secret-size cannot be negative (got {secret_size}).")
    need = dev_size + blind_size + secret_size
    if need > len(entries):
        raise ContestPrepError(
            f"Split needs {need} entries (dev {dev_size} + blind {blind_size} "
            f"+ secret {secret_size}) but the master corpus has only "
            f"{len(entries)}.")

    shuffled = list(entries)
    random.Random(seed).shuffle(shuffled)
    dev = shuffled[:dev_size]
    blind = shuffled[dev_size:dev_size + blind_size]
    secret = shuffled[dev_size + blind_size:need]
    return dev, blind, secret


# ---------------------------------------------------------------------------
# The champollion CLI bridge (crypto single-sourced in cli/lib/seal.mjs).
# ---------------------------------------------------------------------------

def find_champollion_cli() -> list[str]:
    """Resolve the champollion CLI invocation as an argv list (shell-free).

    Order: $CHAMPOLLION_CLI (a path to cli.js or an executable), then the
    monorepo checkout's cli/bin/cli.js (walk up from this file), then a
    `champollion` on PATH. Fails loud when none is found — sealing cannot
    silently degrade to no encryption.
    """
    override = os.environ.get("CHAMPOLLION_CLI", "").strip()
    if override:
        p = Path(override)
        if p.suffix == ".js":
            return ["node", str(p)]
        return [str(p)]
    here = Path(__file__).resolve()
    for ancestor in here.parents:
        candidate = ancestor / "cli" / "bin" / "cli.js"
        if candidate.is_file():
            return ["node", str(candidate)]
    on_path = shutil.which("champollion")
    if on_path:
        return [on_path]
    raise ContestPrepError(
        "champollion CLI not found (needed for `seal-corpus`). Set "
        "CHAMPOLLION_CLI to cli/bin/cli.js or install the champollion "
        "package. Sealing never silently downgrades to plaintext.")


def seal_file_via_cli(
    *,
    plaintext_path: Path,
    card_id: str,
    custodian_group_id: str,
    threshold_pubkey: str,
    artifact_out: Path,
    card_block_out: Path,
    qualifier_id: Optional[str] = None,
    qualifier_threshold: Optional[float] = None,
) -> dict:
    """Seal a file via `champollion seal-corpus seal`; return the card block."""
    argv = find_champollion_cli() + [
        "seal-corpus", "seal",
        "--seal-input", str(plaintext_path),
        "--id", card_id,
        "--custodian-group", custodian_group_id,
        "--threshold-pubkey", threshold_pubkey,
        "--seal-out", str(artifact_out),
        "--card-block-out", str(card_block_out),
    ]
    if qualifier_id:
        argv += ["--qualifier-id", qualifier_id]
    if qualifier_threshold is not None:
        argv += ["--qualifier-threshold", str(qualifier_threshold)]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise ContestPrepError(
            f"seal-corpus failed for {card_id}:\n{proc.stderr or proc.stdout}")
    return json.loads(card_block_out.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Artifact preparation (fully offline — registration is a separate step).
# ---------------------------------------------------------------------------

def _corpus_file(corpus_id: str, pair: tuple[str, str], entries: list[dict],
                 *, license_id: str, description: str,
                 fields: tuple[str, ...] = ("source", "reference"),
                 segment: Optional[str] = None) -> dict:
    """A self-describing harness-JSON corpus file (corpus_loader shape)."""
    out_entries = []
    for i, e in enumerate(entries):
        row = {"id": i}
        for f in fields:
            row[f] = e.get(f, "")
        if segment:
            row["segment"] = segment
        out_entries.append(row)
    return {
        "dataset": {
            "corpus_id": corpus_id,
            "version": "1.0",
            "language_pair": {"source": pair[0], "target": pair[1]},
            "description": description,
            "provenance": {"license": license_id},
        },
        "entries": out_entries,
    }


def prepare_contest(
    *,
    master_corpus_path: str | Path,
    slug: str,
    name: str,
    source_lang: str,
    target_lang: str,
    dev_size: int,
    blind_size: int,
    secret_size: int = 0,
    seed: int,
    qualifier_threshold: float,
    authorization_model: str = "per-submission",
    intake_daily_limit: int = 5,
    custodian_group_id: Optional[str] = None,
    threshold_pubkey: Optional[str] = None,
    plaintext_refs: bool = False,
    license_id: str = "CC-BY-4.0",
    year: Optional[int] = None,
    shared_task_id: Optional[str] = None,
    out_dir: str | Path,
) -> dict:
    """Split + write + seal all contest artifacts. Returns the manifest dict.

    Everything lands under ``out_dir``:
      public/  — what the organizer RELEASES (dev corpus incl. refs; blind
                 source side). Publishing these is the organizer's act.
      local/   — what NEVER leaves the organizer's machine (sealed refs
                 artifact + key block, the manifest, any plaintext refs if
                 --plaintext-refs). The plaintext refs file is DELETED after
                 sealing in the default path.
    """
    if authorization_model not in AUTHORIZATION_MODELS:
        raise ContestPrepError(
            f"authorization_model must be one of {AUTHORIZATION_MODELS} "
            f"(got {authorization_model!r}).")
    if qualifier_threshold is None or float(qualifier_threshold) <= 0:
        raise ContestPrepError(
            "--qualifier-threshold is required and must be > 0 — the "
            "threshold is contest data, never a code default.")
    if plaintext_refs and authorization_model == "per-submission":
        raise ContestPrepError(
            "--plaintext-refs cannot be combined with authorization_model="
            "'per-submission': a per-submission custody ceremony over refs "
            "stored unencrypted is security theater. Seal the refs (default) "
            "or choose 'blanket'/'open' and accept the honest weaker posture.")
    if not plaintext_refs:
        if not custodian_group_id:
            raise ContestPrepError(
                "--custodian-group is required to seal refs (an OPAQUE id — "
                "never a real nation/org name before consent).")
        if not threshold_pubkey:
            raise ContestPrepError(
                "--threshold-pubkey is required to seal refs (generate one "
                "with `champollion seal-corpus keygen`).")

    year = year or datetime.now(timezone.utc).year
    qualifier_id = build_qualifier_id(
        source=source_lang, target=target_lang, slug=slug, year=year)
    blind_id = f"eval-{source_lang}-{target_lang}-{slug}-blindtest-v1"
    secret_id = f"eval-{source_lang}-{target_lang}-{slug}-secret-v1"
    pair = (source_lang, target_lang)

    # Load the master corpus (harness JSON / JSONL / TSV via corpus_loader).
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness.corpus_loader import load_corpus
    cfg = RunConfig(corpus_path=str(master_corpus_path),
                    source_lang=source_lang, target_lang=target_lang)
    entries, _meta = load_corpus(cfg)
    # Normalize to source/reference keys for the split output.
    norm = [{"source": e.get(cfg.source_field, ""),
             "reference": e.get(cfg.target_field, "")} for e in entries]

    dev, blind, secret = split_corpus(
        norm, dev_size=dev_size, blind_size=blind_size,
        secret_size=secret_size, seed=seed)
    if secret_size and not secret:
        raise ContestPrepError("secret split unexpectedly empty")  # unreachable

    out = Path(out_dir)
    public_dir = out / "public"
    local_dir = out / "local"
    public_dir.mkdir(parents=True, exist_ok=True)
    local_dir.mkdir(parents=True, exist_ok=True)

    # --- T0: the public dev corpus (source + refs) = THE QUALIFIER ---------
    dev_path = public_dir / f"{qualifier_id}.json"
    dev_path.write_text(json.dumps(_corpus_file(
        qualifier_id, pair, dev,
        license_id=license_id, segment="dev",
        description=(f"{name} — public dev set / qualifier v{year}. Source and "
                     f"references are public; clearing threshold "
                     f"{qualifier_threshold} (composite, 0-100) on this set "
                     f"gates scoring on the blind set."),
    ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # --- T1: blind source release + organizer-local refs -------------------
    blind_source_path = public_dir / f"{blind_id}.source.json"
    blind_source_path.write_text(json.dumps(_corpus_file(
        f"{blind_id}-source", pair, blind,
        license_id=license_id, fields=("source",),
        description=(f"{name} — blind test SOURCE side. Translate these and "
                     f"submit hypotheses via `mt-eval contest "
                     f"submit-hypotheses`. References are withheld by the "
                     f"organizer."),
    ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    refs_plain_path = local_dir / f"{blind_id}.refs.json"
    refs_plain_path.write_text(json.dumps(_corpus_file(
        blind_id, pair, blind,
        license_id=license_id, segment="held_out",
        description=(f"{name} — blind test REFERENCES. ORGANIZER-LOCAL ONLY; "
                     f"never uploaded, never tracked, sealed at rest."),
    ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    refs_plain_sha = sha256_file(refs_plain_path)

    sealed_block = None
    refs_artifact_path = None
    if not plaintext_refs:
        refs_artifact_path = local_dir / f"{blind_id}.refs.sealed.json"
        sealed_block = seal_file_via_cli(
            plaintext_path=refs_plain_path,
            card_id=blind_id,
            custodian_group_id=custodian_group_id,
            threshold_pubkey=threshold_pubkey,
            artifact_out=refs_artifact_path,
            card_block_out=local_dir / f"{blind_id}.sealed-block.json",
            qualifier_id=qualifier_id,
            qualifier_threshold=float(qualifier_threshold),
        )
        refs_plain_path.unlink()  # sealed at rest — plaintext gone

    # --- T2 (optional): fully secret corpus, sealed source+refs ------------
    secret_block = None
    secret_artifact_path = None
    if secret:
        secret_plain_path = local_dir / f"{secret_id}.corpus.json"
        secret_plain_path.write_text(json.dumps(_corpus_file(
            secret_id, pair, secret,
            license_id=license_id, segment="gold_standard",
            description=(f"{name} — FULLY SECRET set (source AND references). "
                         f"Method-execution lane only (Phase B); no hypotheses "
                         f"intake exists for it because participants never "
                         f"see the source."),
        ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if plaintext_refs:
            raise ContestPrepError(
                "A T2 fully-secret split requires sealing (its whole point is "
                "that even the source is secret) — drop --plaintext-refs or "
                "--secret-size.")
        secret_artifact_path = local_dir / f"{secret_id}.corpus.sealed.json"
        secret_block = seal_file_via_cli(
            plaintext_path=secret_plain_path,
            card_id=secret_id,
            custodian_group_id=custodian_group_id,
            threshold_pubkey=threshold_pubkey,
            artifact_out=secret_artifact_path,
            card_block_out=local_dir / f"{secret_id}.sealed-block.json",
            qualifier_id=qualifier_id,
            qualifier_threshold=float(qualifier_threshold),
        )
        secret_plain_path.unlink()

    manifest = {
        "prepared_at": datetime.now(timezone.utc).isoformat(),
        "_note": ("ORGANIZER-LOCAL manifest — reveals the split recipe; keep "
                  "off git and out of participant hands."),
        "contest": {
            "slug": slug,
            "name": name,
            "language_pair": f"{source_lang}>{target_lang}",
            "authorization_model": authorization_model,
            "intake_daily_limit": intake_daily_limit,
            # The multi-pair edition umbrella (047) this per-pair contest
            # belongs to, or None for a standalone contest.
            "shared_task_id": shared_task_id,
        },
        "seed": seed,
        "sizes": {"dev": len(dev), "blind": len(blind), "secret": len(secret)},
        "license": license_id,
        "qualifier": {
            "qualifier_id": qualifier_id,
            "corpus_card_id": qualifier_id,
            "threshold": float(qualifier_threshold),
            "metric": "composite",
            "year": year,
            "corpus_file": str(dev_path),
            "corpus_sha256": sha256_file(dev_path),
        },
        "blind": {
            "sealed_set_id": blind_id,
            "source_release_file": str(blind_source_path),
            "source_release_sha256": sha256_file(blind_source_path),
            "refs_plaintext_sha256": refs_plain_sha,
            "refs_sealed_artifact": (str(refs_artifact_path)
                                     if refs_artifact_path else None),
            "refs_plaintext_file": (str(refs_plain_path)
                                    if plaintext_refs else None),
            "sealed_block": sealed_block,
        },
        "secret": ({
            "sealed_set_id": secret_id,
            "corpus_sealed_artifact": str(secret_artifact_path),
            "sealed_block": secret_block,
            "lane": "secret-set method lanes (Phase B: declarative model + sandbox)",
        } if secret else None),
        "custodian_group_id": custodian_group_id,
    }
    manifest_path = local_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    manifest["manifest_path"] = str(manifest_path)
    return manifest


# ---------------------------------------------------------------------------
# Registration — the Supabase (dev branch) writes. Separate from preparation
# so artifacts can be produced fully offline and inspected first.
# ---------------------------------------------------------------------------

def register_prepared(manifest: dict, *, visibility: str = "public",
                      use_context: str = "non-commercial",
                      description: str = "", open_intake: bool = True) -> dict:
    """Register a prepared contest: qualifier row, sealed set(s), contest row,
    policy columns. Content-free rows only. Service key + (for the contest)
    the organizer's OAuth session."""
    from mt_eval_harness.sovereign_service import service_request

    q = manifest["qualifier"]
    blind = manifest["blind"]
    contest = manifest["contest"]
    src, tgt = contest["language_pair"].split(">")

    sealed_rows = []
    if blind.get("sealed_block"):
        sealed_rows.append((blind["sealed_set_id"], blind["sealed_block"]))
    if manifest.get("secret"):
        sealed_rows.append((manifest["secret"]["sealed_set_id"],
                            manifest["secret"]["sealed_block"]))

    # 1. sealed_sets registrations (037) — content-free; quarantined defaults
    #    true in that table. NEVER a datasets row (022 would then block the
    #    score publishes themselves — see module docstring).
    for set_id, block in sealed_rows:
        service_request("POST", "sealed_sets", data={
            "sealed_set_id": set_id,
            "ciphertext_digest": block["ciphertextDigest"],
            "cipher": block["cipher"],
            "key_scheme": block.get("keyScheme"),
            "custodian_group_id": manifest["custodian_group_id"],
            "current_qualifier_id": q["qualifier_id"],
            "source_lang": src,
            "target_lang": tgt,
            "language_pair": contest["language_pair"],
            "status": "active",
            "sealed_at": manifest["prepared_at"],
        }, prefer="return=representation,resolution=ignore-duplicates")

    # 2. The qualifier row (042) — the data half of the dev-set gate.
    service_request("POST", "qualifiers", data={
        "qualifier_id": q["qualifier_id"],
        "corpus_card_id": q["corpus_card_id"],
        "sealed_set_id": blind["sealed_set_id"] if sealed_rows else None,
        "threshold": q["threshold"],
        "metric": q["metric"],
        "year": q["year"],
        "status": "active",
    }, prefer="return=representation,resolution=ignore-duplicates")

    # 3. The contest itself (008/041; lane auto-resolves 'sealed' now that the
    #    registration exists). Uses the organizer's OAuth session.
    from mt_eval_harness.contest import create_contest
    record = create_contest(
        name=contest["name"],
        corpus_id=(blind["sealed_set_id"] if sealed_rows
                   else q["corpus_card_id"]),
        language_pair=contest["language_pair"],
        visibility=visibility,
        description=description,
        use_context=use_context,
    )

    # 4. Policy columns (043) + edition membership (047) — service-role PATCH
    #    (one-way triggers don't apply to contests; RLS just restricts who may
    #    write). The shared_task_id FK fails loud if the edition row is missing.
    policy_patch = {
        "authorization_model": contest["authorization_model"],
        "intake_daily_limit": contest["intake_daily_limit"],
        "intake_open": bool(open_intake),
    }
    if contest.get("shared_task_id"):
        policy_patch["shared_task_id"] = contest["shared_task_id"]
    service_request("PATCH", "contests", params={
        "id": f"eq.{record['id']}",
    }, data=policy_patch)

    print(f"\n  ✅ Registered: contest {record['id']} "
          f"(authorization_model={contest['authorization_model']}, "
          f"intake {'OPEN' if open_intake else 'closed'})")
    if contest.get("shared_task_id"):
        print(f"     Edition: attached to shared task {contest['shared_task_id']}")
    print(f"     Qualifier {q['qualifier_id']} @ threshold {q['threshold']}")
    for set_id, block in sealed_rows:
        print(f"     Sealed set {set_id} digest {block['ciphertextDigest'][:16]}…")
    return record


def register_prepared_self_serve(manifest: dict, *, visibility: str = "public",
                                 use_context: str = "non-commercial",
                                 description: str = "",
                                 open_intake: bool = True) -> dict:
    """Register a prepared contest through the migration-046 self-serve door:
    the organizer's OWN OAuth session, no service key (gap G3 of
    docs/SHARED_TASK_HOSTING_MODES.md — the AmericasNLP onboarding path).

    Same content-free rows and order as register_prepared. Every registry row
    is identity-bound: created_by = the JWT email, which is what the 046 RLS
    policies admit and what the qualifiers ownership check compares — a
    qualifier may only gate a sealed set the SAME identity registered. The
    contest row binds the owner email too (create_contest always stamps the
    JWT email since migration 052), so the 043 policy PATCH goes through the
    008 owner-update policy with the same session. Registration is idempotent for the registry rows
    (resolution=ignore-duplicates) and tolerant of an already-created contest,
    so a partially-registered contest can be re-run to completion.
    """
    from mt_eval_harness.contest import _api_request
    from mt_eval_harness.auth import get_session, get_submitter_email
    # Same prod refusal as the service lane: the sovereign tables (and the
    # 046 door) exist only on the dev/staging branch.
    from mt_eval_harness.sovereign_service import assert_not_prod
    assert_not_prod()

    session = get_session()
    email = get_submitter_email(session)

    q = manifest["qualifier"]
    blind = manifest["blind"]
    contest = manifest["contest"]
    src, tgt = contest["language_pair"].split(">")

    sealed_rows = []
    if blind.get("sealed_block"):
        sealed_rows.append((blind["sealed_set_id"], blind["sealed_block"]))
    if manifest.get("secret"):
        sealed_rows.append((manifest["secret"]["sealed_set_id"],
                            manifest["secret"]["sealed_block"]))

    # 1. sealed_sets registrations (037/046) — content-free; born quarantined
    #    (the trigger pins it beneath us anyway); NEVER a datasets row (022
    #    would then block the score publishes — see module docstring).
    for set_id, block in sealed_rows:
        _api_request("POST", "sealed_sets", data={
            "sealed_set_id": set_id,
            "ciphertext_digest": block["ciphertextDigest"],
            "cipher": block["cipher"],
            "key_scheme": block.get("keyScheme"),
            "custodian_group_id": manifest["custodian_group_id"],
            "current_qualifier_id": q["qualifier_id"],
            "source_lang": src,
            "target_lang": tgt,
            "language_pair": contest["language_pair"],
            "quarantined": True,
            "status": "active",
            "sealed_at": manifest["prepared_at"],
            "created_by": email,
        }, session=session,
           prefer="return=representation,resolution=ignore-duplicates")

    # 2. The qualifier row (042/046) — born active; the ownership check binds
    #    it to the sealed set registered above under the same identity.
    _api_request("POST", "qualifiers", data={
        "qualifier_id": q["qualifier_id"],
        "corpus_card_id": q["corpus_card_id"],
        "sealed_set_id": blind["sealed_set_id"] if sealed_rows else None,
        "threshold": q["threshold"],
        "metric": q["metric"],
        "year": q["year"],
        "status": "active",
        "created_by": email,
    }, session=session,
       prefer="return=representation,resolution=ignore-duplicates")

    # 3. The contest itself (008/041/052) — the same OAuth session;
    #    create_contest always stamps the JWT email, so step 4's PATCH passes
    #    the 008 owner-update policy. An already-existing contest (a re-run)
    #    is not an error IF it is ours — step 4 proves ownership either way.
    from mt_eval_harness.contest import create_contest, _slugify
    try:
        record = create_contest(
            name=contest["name"],
            corpus_id=(blind["sealed_set_id"] if sealed_rows
                       else q["corpus_card_id"]),
            language_pair=contest["language_pair"],
            visibility=visibility,
            description=description,
            use_context=use_context,
        )
    except RuntimeError as exc:
        if "409" not in str(exc):
            raise
        record = {"id": _slugify(contest["name"])}
        print(f"  Contest {record['id']} already exists — continuing to the "
              f"policy update (ownership is proven by the PATCH).")

    # 4. Policy columns (043) — through the 008 owner-update policy with the
    #    organizer's own session. Zero rows back means the row is not ours
    #    (or created_by holds a display identity): fail loud, never silently
    #    leave a contest with default policy.
    patched = _api_request("PATCH", "contests", params={
        "id": f"eq.{record['id']}",
    }, data={
        "authorization_model": contest["authorization_model"],
        "intake_daily_limit": contest["intake_daily_limit"],
        "intake_open": bool(open_intake),
    }, session=session)
    if not patched:
        raise RuntimeError(
            f"Could not set the policy columns on contest {record['id']}: "
            f"the owner-update policy matched no row for {email}. The "
            f"contest was created under a different identity — if it "
            f"predates the self-serve lane, ask the curator to align "
            f"contests.created_by with your sign-in email."
        )

    print(f"\n  ✅ Self-serve registered: contest {record['id']} as {email} "
          f"(authorization_model={contest['authorization_model']}, "
          f"intake {'OPEN' if open_intake else 'closed'})")
    print(f"     Qualifier {q['qualifier_id']} @ threshold {q['threshold']}")
    for set_id, block in sealed_rows:
        print(f"     Sealed set {set_id} digest {block['ciphertextDigest'][:16]}…")
    print("     No service key was used — rows are identity-bound to your "
          "sign-in (migration 046). Rotation/retirement remain "
          "curator-mediated for now.")
    return record
