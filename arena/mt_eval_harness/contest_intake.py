"""contest_intake — the PARTICIPANT side of a sovereign contest: contest
resolution, the shared upload channel, and submission status.

RETIRED 2026-09-06 (founder ruling R2): `mt-eval contest submit-hypotheses`.
Uploading translations of a blind set is no longer a contest entry path —
"contest" means SOVEREIGN HOSTING, and an entry is a METHOD the organizer's
own node executes on the sealed set: Lane A (declarative weights,
`contest submit-model`) or Lane B (code, `contest submit-method`, run
`--network=none`). The dev-set self-score that used to gate the upload is now
`contest_qualify.qualify` — a standalone receipt both method lanes require.

What survives here, and why:

  fetch_contest_bundle   the contest row + its ACTIVE qualifier — anon-readable
                         by design (the gate is public). Used by the qualifier
                         (contest_qualify) and by both method lanes
                         (method_bundle / model_bundle).
  _storage_upload/BUCKET the participant-credentialed, own-folder-RLS upload
                         (migration 044) — the SAME channel the surviving
                         method/model bundles use.
  contest_status         the lifecycle poll, now over the SURVIVING lane:
                         authorization_requests (the request IS the queue item)
                         joined to contest_submissions. It no longer reads the
                         retired contest_intake table.

The rows + bucket are the whole API surface — a future GUI reads the same
REST endpoints; nothing here is CLI-private.
"""

from __future__ import annotations

import os
import urllib.error
import urllib.request

from mt_eval_harness.auth import SUPABASE_URL, SUPABASE_ANON_KEY, get_session
from mt_eval_harness.contest import _api_request

BUCKET = "contest-intake"


class IntakeError(RuntimeError):
    """A submission that cannot proceed — always with the participant-facing reason."""


class ContestUnavailable(IntakeError):
    """The contest's public rows are not on this endpoint: no such contest
    here, no contest lane here, or no ACTIVE qualifier for it.

    Distinct from a contest that IS there and says no (closed, intake not
    open), because a command with an offline route (`contest qualify`'s
    --offline-qualifier-id / --offline-threshold) can name it for these and
    must not for those. Still an IntakeError, so every existing caller keeps
    handling it as before."""


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
    return ContestUnavailable(
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
        raise ContestUnavailable(
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
        raise ContestUnavailable(
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


# ---------------------------------------------------------------------------
# Status polling — over the SURVIVING entry lane (authorization_requests).
# ---------------------------------------------------------------------------

# The 038 request state machine, in participant words. A method entry has no
# separate "uploaded" state: the request IS the queue item, created at
# submit-model/submit-method time with the bundle already in the bucket.
_STATE_HINTS = {
    "pending": ("waiting for custodian approval — the organizer node runs "
                "your method only once the request is authorized"),
    "authorized": ("approved; the node will re-execute your method on the "
                   "public dev set (the qualifier check), then on the sealed "
                   "set, on its next pass"),
    "denied": "denied (see the reason on the request's audit trail)",
    "expired": "expired without being executed — propose again",
    "completed": ("done: the node ran your method and its result is recorded "
                  "(published, or withheld until the contest closes)"),
}


def _sealed_sets_for_contest(contest_id: str, session: dict | None) -> list[str]:
    """Every sealed set a contest's entries can target.

    The join the schema actually gives us: ``contests.corpus_id`` names the
    contest's registered set; its qualifier row (042) is keyed on that set;
    and every sealed set prepared with it — blind AND fully-secret (T2) —
    carries that same ``current_qualifier_id``. So the qualifier is the hinge
    between the contest row and the whole family of sets its requests are
    filed against.
    """
    contests = _api_request(
        "GET", "contests",
        params={"id": f"eq.{contest_id}", "select": "id,corpus_id"},
        session=session)
    if not contests:
        return []
    corpus_id = contests[0].get("corpus_id")
    if not corpus_id:
        return []
    qualifiers = _api_request(
        "GET", "qualifiers",
        params={"sealed_set_id": f"eq.{corpus_id}",
                "select": "qualifier_id"},
        session=session)
    set_ids = {corpus_id}
    for q in qualifiers or []:
        sets = _api_request(
            "GET", "sealed_sets",
            params={"current_qualifier_id": f"eq.{q['qualifier_id']}",
                    "select": "sealed_set_id"},
            session=session)
        set_ids.update(s["sealed_set_id"] for s in (sets or [])
                       if s.get("sealed_set_id"))
    return sorted(set_ids)


def _fetch_submissions(*, contest_id: str | None, request_ids: list[str],
                       session: dict | None) -> list[dict]:
    """contest_submissions rows for these entries.

    Migration 074 gives the table ``authorization_request_id`` — the exact
    join. An endpoint that predates 074 has no such column, so the query is
    retried on the contest id and the narrower evidence is SAID OUT LOUD
    rather than silently returning "not published yet"."""
    base = "contest_id,run_card_id,submitted_by,notes,created_at"
    params = {"order": "created_at.desc",
              "select": base + ",authorization_request_id"}
    if contest_id:
        params["contest_id"] = f"eq.{contest_id}"
    elif request_ids:
        params["authorization_request_id"] = f"in.({','.join(request_ids)})"
    try:
        rows = _api_request("GET", "contest_submissions", params=params,
                            session=session)
    except RuntimeError as e:
        if not _contest_lane_unprovisioned(e):
            raise
        if not contest_id:
            print("    (run-card links unavailable: this endpoint has no "
                  "contest_submissions.authorization_request_id — migration "
                  "074 is not applied here)")
            return []
        rows = _api_request(
            "GET", "contest_submissions",
            params={"order": "created_at.desc", "select": base,
                    "contest_id": f"eq.{contest_id}"}, session=session)
    return rows if isinstance(rows, list) else []


def contest_status(id_or_contest: str) -> list[dict]:
    """Print + return entry lifecycles for a request id or a whole contest.

    Reads ``authorization_requests`` (the method lane's queue item) and the
    ``contest_submissions`` rows the node writes when a scored card lands.
    The retired hypotheses lane's ``contest_intake`` table is not read.
    """
    session = None
    try:
        session = get_session()
    except Exception:
        pass  # anon works for public contests

    if id_or_contest.startswith("intake-"):
        raise IntakeError(
            f"'{id_or_contest}' is a hypotheses-intake id. That lane was "
            f"RETIRED as a contest entry path on 2026-09-06: a contest is "
            f"entered by handing a METHOD to the organizer's node "
            f"(`mt-eval contest submit-model` / `submit-method`), which "
            f"executes it on the sealed set. Track a method entry by its "
            f"authreq-… id, or pass the contest id.")

    params = {"order": "created_at.desc",
              "select": "request_id,sealed_set_id,state,method_sha,"
                        "requested_by,corpus_version,node_measurement,"
                        "created_at,decided_at"}
    if id_or_contest.startswith("authreq-"):
        params["request_id"] = f"eq.{id_or_contest}"
    else:
        set_ids = _sealed_sets_for_contest(id_or_contest, session)
        if not set_ids:
            print(f"\n  No contest '{id_or_contest}' on this endpoint, or it "
                  f"has no registered sealed set.\n    " + _endpoint_hint())
            return []
        params["sealed_set_id"] = f"in.({','.join(set_ids)})"
    rows = _api_request("GET", "authorization_requests", params=params,
                        session=session)
    rows = rows if isinstance(rows, list) else []
    if not rows:
        print(f"\n  No method entries found for '{id_or_contest}'.")
        return []

    # The published side: contest_submissions rows carry the run card once the
    # node has scored and published. Keyed by request where 074 records it;
    # matched on the notes trail otherwise (pre-074 rows).
    submissions = _fetch_submissions(
        contest_id=(None if id_or_contest.startswith("authreq-")
                    else id_or_contest),
        request_ids=[r["request_id"] for r in rows],
        session=session)
    by_request: dict[str, dict] = {}
    for s in submissions:
        rid = s.get("authorization_request_id")
        if rid:
            by_request.setdefault(rid, s)
            continue
        notes = str(s.get("notes") or "")
        for r in rows:
            if r["request_id"] in notes:
                by_request.setdefault(r["request_id"], s)

    for r in rows:
        print(f"\n  {r['request_id']}  [{r['state']}]")
        print(f"    {_STATE_HINTS.get(r['state'], '')}")
        print(f"    sealed set: {r.get('sealed_set_id')} "
              f"({r.get('corpus_version')}), node "
              f"{r.get('node_measurement')}")
        if r.get("method_sha"):
            print(f"    method sha256: {r['method_sha']}")
        published = by_request.get(r["request_id"])
        if published and published.get("run_card_id"):
            print(f"    published run card: {published['run_card_id']}")
        elif r["state"] == "authorized":
            print("    no run card yet — the node has not finished this entry")
    return rows
