"""contest_intake — the PARTICIPANT side of an organizer-scored contest.

`mt-eval contest submit-hypotheses` is the friction-free front door:

  1. You translated the released blind SOURCE side with your own system.
  2. This command self-scores your DEV hypotheses against the PUBLIC dev set
     locally (references are public — instant, offline, zero cost) and shows
     the qualifier verdict (qualifier_gate, the same rule the node applies).
  3. Below the threshold ⇒ it REFUSES to upload, with the exact reason the
     node would give. At/above ⇒ it bundles {dev, test, manifest} into a
     tar.gz, uploads to the private contest-intake bucket, and inserts the
     digests-only contest_intake row (migration 043).
  4. `mt-eval contest status` polls the lifecycle: the organizer node
     re-scores your dev file itself (the local verdict is a PREVIEW — the
     node's own score is what gates), authorizes per the contest's
     authorization_model, scores your test hypotheses on the secret refs, and
     publishes a scores-only run card.

The rows + bucket are the whole API surface — a future GUI reads the same
REST endpoints; nothing here is CLI-private.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import tarfile
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from mt_eval_harness.auth import SUPABASE_URL, SUPABASE_ANON_KEY, get_session
from mt_eval_harness.contest import _api_request
from mt_eval_harness.external_scoring import score_hypotheses, sha256_file
from mt_eval_harness.qualifier_gate import is_eligible_for_sealed_run

BUCKET = "contest-intake"


class IntakeError(RuntimeError):
    """A submission that cannot proceed — always with the participant-facing reason."""


# ---------------------------------------------------------------------------
# Contest + qualifier resolution (anon-readable rows).
# ---------------------------------------------------------------------------

def _endpoint_hint() -> str:
    """Names the Supabase endpoint in use and how to reach the right contest
    host. Shared by the lane-missing and not-found paths.

    Direction-aware: with MT_EVAL_SUPABASE_URL set, the likely fix is a wrong
    or unprovisioned federated host (or an override that should be unset — the
    default network host carries the contest lane since 2026-07-11); without
    it, the contest is probably federated and needs the organizer-published
    endpoint."""
    override = os.environ.get("MT_EVAL_SUPABASE_URL")
    if override:
        return (
            f"You're pointed at {override} (via MT_EVAL_SUPABASE_URL).\n"
            f"      Check the endpoint the organizer published with the "
            f"contest materials — or, for a network-hosted contest, unset "
            f"MT_EVAL_SUPABASE_URL to use the default network host.")
    return (
        f"You're pointed at the default network host ({SUPABASE_URL}).\n"
        f"      If this contest is federated (organizer-hosted), export the "
        f"endpoint published with the contest materials:\n"
        f"          export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co\n"
        f"          export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>")


def _contest_lane_unprovisioned(err: Exception) -> bool:
    """True when a Supabase error means the contest lane (migrations 037-045)
    isn't provisioned on the current endpoint — the contest-lane columns or
    tables simply don't exist there. PostgREST surfaces 42703 (undefined
    column, e.g. 'column contests.authorization_model does not exist') or
    42P01 (undefined table) in that case; a genuine server/network error does
    not, so it is left to propagate untouched."""
    msg = str(err).lower()
    return "42703" in msg or "42p01" in msg or "does not exist" in msg


def _contest_lane_error() -> "IntakeError":
    """The friendly 'wrong endpoint' message, replacing the raw PostgREST
    'column contests.authorization_model does not exist' a participant would
    otherwise see when they run against a host without the contest lane."""
    return IntakeError(
        "The contest lane isn't available on this Supabase endpoint yet — it "
        "has no contest tables/columns (migrations 037-045 are not "
        "provisioned here).\n    " + _endpoint_hint())


def fetch_contest_bundle(contest_id: str) -> dict:
    """Fetch the contest row, its sealed-set registration, and the ACTIVE
    qualifier row. All three are anon-readable by design (the gate is public).
    Fail-safe: a missing qualifier means no submission can proceed.

    If the endpoint has no contest lane at all (e.g. a federated organizer
    host missing migrations 037-045, or a stale MT_EVAL_SUPABASE_URL override),
    the raw PostgREST 'column ... does not exist' error is translated into a
    friendly which-endpoint-am-I-on message with the fix."""
    try:
        contests = _api_request(
            "GET", "contests",
            params={"id": f"eq.{contest_id}",
                    "select": "id,name,status,corpus_id,language_pair,"
                              "authorization_model,intake_daily_limit,intake_open"})
    except RuntimeError as e:
        if _contest_lane_unprovisioned(e):
            raise _contest_lane_error() from e
        raise
    if not contests:
        raise IntakeError(
            f"Contest '{contest_id}' not found on this endpoint.\n"
            f"    If you expected it to exist, you may be pointed at the wrong "
            f"Supabase host.\n    " + _endpoint_hint())
    contest = contests[0]
    if contest.get("status") != "open":
        raise IntakeError(f"Contest '{contest_id}' is "
                          f"{contest.get('status', 'unknown')} — not accepting "
                          f"submissions.")
    if not contest.get("intake_open"):
        raise IntakeError(
            f"Contest '{contest_id}' has not opened hypotheses intake yet "
            f"(the organizer flips intake_open when ready).")

    try:
        qualifiers = _api_request(
            "GET", "qualifiers",
            params={"sealed_set_id": f"eq.{contest['corpus_id']}",
                    "status": "eq.active",
                    "select": "qualifier_id,corpus_card_id,threshold,metric,year"})
    except RuntimeError as e:
        if _contest_lane_unprovisioned(e):
            raise _contest_lane_error() from e
        raise
    if not qualifiers:
        raise IntakeError(
            f"Contest '{contest_id}' has no ACTIVE qualifier registered for "
            f"its secret set ({contest['corpus_id']}) — without a public "
            f"qualifier no submission can be gated, so none are accepted "
            f"(fail-safe). Ask the organizer.")
    return {"contest": contest, "qualifier": qualifiers[0]}


# ---------------------------------------------------------------------------
# Storage upload (participant credentials — own-folder RLS, migration 044).
# ---------------------------------------------------------------------------

def _storage_upload(session: dict, object_path: str, data: bytes) -> None:
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{object_path}"
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {session['access_token']}",
            "Content-Type": "application/gzip",
            "x-upsert": "false",  # bundles are immutable (044)
        })
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode() if e.fp else ""
        raise IntakeError(f"Bundle upload failed ({e.code}): {detail}") from e
    except (urllib.error.URLError, OSError) as e:
        raise IntakeError(f"Network error uploading bundle: {e}") from e


def build_bundle(*, dev_hyp_path: Path, test_hyp_path: Path,
                 manifest: dict) -> bytes:
    """Deterministic-enough tar.gz of {dev, test, manifest} (in-memory)."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for arcname, path in (("dev-hypotheses" + dev_hyp_path.suffix, dev_hyp_path),
                              ("test-hypotheses" + test_hyp_path.suffix, test_hyp_path)):
            tar.add(str(path), arcname=arcname)
        m = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
        info = tarfile.TarInfo("manifest.json")
        info.size = len(m)
        tar.addfile(info, io.BytesIO(m))
    return buf.getvalue()


# ---------------------------------------------------------------------------
# The submission flow.
# ---------------------------------------------------------------------------

def submit_hypotheses(
    *,
    contest_id: str,
    test_hyp_path: str | Path,
    dev_hyp_path: str | Path,
    dev_corpus_path: str | Path,
    system_label: str,
    method_class: str,
    paradigm: str | None = None,
    description: str = "",
    team: str | None = None,
    notes: str = "",
    scratch_dir: str | Path | None = None,
) -> dict:
    """Self-score the dev hypotheses, gate locally, bundle + upload + enqueue.

    ``dev_corpus_path`` is the RELEASED public dev corpus (source + refs) the
    organizer published — its corpus_id must equal the qualifier's card id
    (checked, so you cannot accidentally score against the wrong file).

    Returns {intake_id, qualifier_preview, storage_path}.
    """
    test_hyp_path = Path(test_hyp_path)
    dev_hyp_path = Path(dev_hyp_path)
    dev_corpus_path = Path(dev_corpus_path)
    for p, what in ((test_hyp_path, "test hypotheses"),
                    (dev_hyp_path, "dev hypotheses"),
                    (dev_corpus_path, "public dev corpus")):
        if not p.exists():
            raise IntakeError(f"{what} file not found: {p}")

    bundle_info = fetch_contest_bundle(contest_id)
    contest, qualifier = bundle_info["contest"], bundle_info["qualifier"]

    # The released dev file must BE the qualifier corpus.
    dev_meta = json.loads(dev_corpus_path.read_text(encoding="utf-8"))
    dev_corpus_id = (dev_meta.get("dataset") or {}).get("corpus_id", "")
    if dev_corpus_id != qualifier["corpus_card_id"]:
        raise IntakeError(
            f"The dev corpus file identifies as '{dev_corpus_id}' but the "
            f"contest's active qualifier is '{qualifier['corpus_card_id']}' — "
            f"download the current qualifier release and retry.")

    # Local self-score (PUBLIC refs — offline, free). This is a PREVIEW: the
    # node re-scores your dev file itself and ITS score is what gates.
    scratch = Path(scratch_dir) if scratch_dir else (
        Path.home() / ".mt-eval" / "intake-scratch")
    scratch.mkdir(parents=True, exist_ok=True)
    src, _, tgt = contest.get("language_pair", ">").partition(">")
    result = score_hypotheses(
        corpus_path=dev_corpus_path,
        hypotheses_path=dev_hyp_path,
        dataset_id=qualifier["corpus_card_id"],
        source_lang=src or "source",
        target_lang=tgt or "target",
        system_label=system_label,
        method_class=method_class,
        paradigm=paradigm,
        description=description,
        output_dir=scratch,
        compute_ci=False,
    )

    verdict = is_eligible_for_sealed_run(
        qualifier_id=qualifier["qualifier_id"],
        score=result["qualifier_score"],
        threshold=qualifier["threshold"],
        qualifier_year=qualifier.get("year"),
        current_year=datetime.now(timezone.utc).year,
    )
    print(f"\n  Local qualifier preview ({qualifier['qualifier_id']}):")
    print(f"    composite {result['qualifier_score']} vs threshold "
          f"{qualifier['threshold']}")
    if verdict.get("badge") and verdict["badge"].get("badge"):
        print(f"    {verdict['badge']['badge']}")
    print(f"    {verdict['reason']}")
    if not verdict["eligible"]:
        raise IntakeError(
            f"Not uploading: {verdict['reason']} (This is the same rule the "
            f"organizer node applies — improve the dev score first.)")
    print("    NOTE: this is a local preview. The organizer node re-scores "
          "your dev file itself; its own score is what gates.")

    # Bundle + upload + enqueue (digests-only row; bytes in the bucket).
    session = get_session()
    from mt_eval_harness.auth import get_submitter_email
    submitter = get_submitter_email(session)

    intake_id = f"intake-{uuid.uuid4().hex}"
    dev_sha = sha256_file(dev_hyp_path)
    test_sha = sha256_file(test_hyp_path)
    manifest = {
        "intake_id": intake_id,
        "contest_id": contest_id,
        "qualifier_id": qualifier["qualifier_id"],
        "system_label": system_label,
        "method_class": method_class,
        "paradigm": paradigm,
        "description": description,
        "team": team,
        "dev_hyp_sha256": dev_sha,
        "test_hyp_sha256": test_sha,
        "local_qualifier_preview": result["qualifier_score"],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "_note": ("Hypotheses are the participant's own translations. Method "
                  "identity is participant-claimed (see the run card's "
                  "provenance note)."),
    }
    bundle = build_bundle(dev_hyp_path=dev_hyp_path,
                          test_hyp_path=test_hyp_path, manifest=manifest)
    bundle_sha = hashlib.sha256(bundle).hexdigest()
    object_path = f"{contest_id}/{submitter}/{intake_id}.tar.gz"
    _storage_upload(session, object_path, bundle)

    row = {
        "intake_id": intake_id,
        "contest_id": contest_id,
        "submitted_by": submitter,
        "team": team,
        "notes": notes,
        "dev_hyp_sha256": dev_sha,
        "test_hyp_sha256": test_sha,
        "storage_path": object_path,
    }
    created = _api_request("POST", "contest_intake", data=row, session=session)
    record = created[0] if isinstance(created, list) else created
    print(f"\n  ✅ Submitted: {intake_id}")
    print(f"     bundle sha256 {bundle_sha}")
    print(f"     Track it: mt-eval contest status {intake_id}")
    if contest.get("authorization_model") == "per-submission":
        print("     This contest authorizes each scoring individually — your "
              "submission will wait in pending_authorization until a "
              "custodian approves it.")
    return {"intake_id": intake_id,
            "qualifier_preview": result["qualifier_score"],
            "storage_path": object_path,
            "record": record}


# ---------------------------------------------------------------------------
# Status polling.
# ---------------------------------------------------------------------------

_STATUS_HINTS = {
    "received": "uploaded; waiting for the organizer node to pick it up",
    "qualifier_checked": "node re-scored your dev file and it cleared the gate",
    "pending_authorization": "waiting for custodian approval (per-submission contest)",
    "scoring": "being scored against the secret references",
    "scored": "scored; run card being published",
    "published": "done — scores-only run card is on the board",
    "rejected": "rejected (see reason)",
}


def contest_status(id_or_contest: str) -> list[dict]:
    """Print + return intake lifecycles for an intake id or a whole contest."""
    session = None
    try:
        session = get_session()
    except Exception:
        pass  # anon works for public contests

    key = ("intake_id" if id_or_contest.startswith("intake-") else "contest_id")
    rows = _api_request(
        "GET", "contest_intake",
        params={key: f"eq.{id_or_contest}", "order": "created_at.desc",
                "select": "intake_id,contest_id,submitted_by,status,"
                          "qualifier_id,qualifier_score,"
                          "authorization_request_id,run_card_id,"
                          "reject_reason,created_at,updated_at"},
        session=session)
    rows = rows if isinstance(rows, list) else []
    if not rows:
        print(f"\n  No submissions found for '{id_or_contest}'.")
        return []
    for r in rows:
        print(f"\n  {r['intake_id']}  [{r['status']}]")
        print(f"    {_STATUS_HINTS.get(r['status'], '')}")
        if r.get("qualifier_score") is not None:
            print(f"    node qualifier score: {r['qualifier_score']} "
                  f"({r.get('qualifier_id', '?')})")
        if r.get("authorization_request_id"):
            print(f"    authorization request: {r['authorization_request_id']}")
        if r.get("run_card_id"):
            print(f"    run card: {r['run_card_id']}")
        if r.get("reject_reason"):
            print(f"    reason: {r['reject_reason']}")
    return rows
