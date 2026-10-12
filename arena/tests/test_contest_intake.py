"""contest_intake — contest resolution, the identity binding, and status.

The hypotheses-upload door (`submit_hypotheses`) was RETIRED as a contest
entry path on 2026-09-06 (founder ruling R2: a contest is entered by handing
a METHOD to the organizer's node). What these tests pin is what survived:

  * ``get_submitter_email`` — the JWT-email binding migrations 043/044 compare
    against. The regression it guards: a display identity (GitHub
    preferred_username / Google full_name) 403s both the bucket upload and the
    row insert for any user whose username differs from their email. The
    surviving method/model lanes upload through the same channel, so the rule
    still has teeth.
  * ``fetch_contest_bundle`` — the anon-readable contest + qualifier fetch, and
    its wrong-endpoint friction.
  * ``contest_status`` — now over ``authorization_requests`` (the method
    lane's queue item) joined to ``contest_submissions``; it must not read the
    retired ``contest_intake`` table at all.

Everything above the network line is real; the REST calls are monkeypatched.
"""

from __future__ import annotations

import pytest

from mt_eval_harness import contest_intake
from mt_eval_harness.auth import get_submitter_email
from mt_eval_harness.contest_intake import (
    IntakeError,
    contest_status,
    fetch_contest_bundle,
)

CONTEST_ID = "synth-open-2026"
QUALIFIER_CORPUS = "eval-qaa-qab-synth-dev-v1"

# A GitHub-auth session whose display identity differs from the email —
# exactly the shape that hit the RLS mismatch.
GITHUB_SESSION = {
    "access_token": "tok",
    "user": {
        "email": "octo@example.test",
        "user_metadata": {"preferred_username": "octocat"},
    },
}


def test_get_submitter_email_ignores_display_identity():
    assert get_submitter_email(GITHUB_SESSION) == "octo@example.test"


@pytest.mark.parametrize("session", [
    {},
    {"user": {}},
    {"user": {"email": None}},
    {"user": {"email": "   "}},
])
def test_get_submitter_email_fails_loud_when_absent(session):
    with pytest.raises(RuntimeError, match="email"):
        get_submitter_email(session)


def test_retired_upload_door_is_gone():
    """R2: `contest submit-hypotheses` is not an entry path any more, and the
    bundle builder that served it is gone with it."""
    assert not hasattr(contest_intake, "submit_hypotheses")
    assert not hasattr(contest_intake, "build_bundle")
    # The upload CHANNEL survives — the method/model lanes use it.
    assert hasattr(contest_intake, "_storage_upload")


# ---------------------------------------------------------------------------
# Wrong-endpoint friction (E2E audit 2026-07-11): a participant who left
# MT_EVAL_SUPABASE_URL at the default prod host — where the contest lane
# (migrations 037-045) is not applied — used to see the raw PostgREST
# `column contests.authorization_model does not exist`. fetch_contest_bundle
# now translates that into an actionable "set MT_EVAL_SUPABASE_URL" message.
# ---------------------------------------------------------------------------

# The exact PostgREST body prod returns for a select on a missing column.
_COLUMN_MISSING = RuntimeError(
    'Supabase API error (400): {"code":"42703","details":null,"hint":null,'
    '"message":"column contests.authorization_model does not exist"}')


def test_lane_missing_column_error_becomes_friendly(monkeypatch):
    def raise_missing_column(method, table, params=None, **kw):
        raise _COLUMN_MISSING

    monkeypatch.setattr(contest_intake, "_api_request", raise_missing_column)
    with pytest.raises(IntakeError) as exc:
        fetch_contest_bundle("some-contest")
    msg = str(exc.value)
    assert "MT_EVAL_SUPABASE_URL" in msg
    assert "contest lane" in msg.lower()
    # The raw PostgREST error must not leak through to the participant.
    assert "42703" not in msg
    assert "does not exist" not in msg


def test_lane_missing_table_error_becomes_friendly(monkeypatch):
    # The contests table exists but the qualifiers table (migration 042) does
    # not — PostgREST 42P01 (undefined table). Same friendly redirect.
    def api(method, table, params=None, **kw):
        if table == "contests":
            return [{"id": "c", "status": "open", "corpus_id": "corp",
                     "language_pair": "qaa>qab", "authorization_model": "open",
                     "intake_open": True}]
        raise RuntimeError(
            'Supabase API error (404): {"code":"42P01","message":'
            '"relation \\"public.qualifiers\\" does not exist"}')

    monkeypatch.setattr(contest_intake, "_api_request", api)
    with pytest.raises(IntakeError) as exc:
        fetch_contest_bundle("some-contest")
    assert "MT_EVAL_SUPABASE_URL" in str(exc.value)


def test_contest_not_found_hints_endpoint(monkeypatch):
    monkeypatch.setattr(contest_intake, "_api_request",
                        lambda method, table, params=None, **kw: [])
    with pytest.raises(IntakeError) as exc:
        fetch_contest_bundle("missing-contest")
    msg = str(exc.value)
    assert "missing-contest" in msg
    assert "MT_EVAL_SUPABASE_URL" in msg


def test_genuine_server_error_is_not_masked(monkeypatch):
    # A real 500 is NOT a "wrong endpoint" — it must propagate untouched so we
    # don't send participants chasing an env var when the server is just down.
    def boom(method, table, params=None, **kw):
        raise RuntimeError("Supabase API error (500): upstream is down")

    monkeypatch.setattr(contest_intake, "_api_request", boom)
    with pytest.raises(RuntimeError) as exc:
        fetch_contest_bundle("some-contest")
    assert "MT_EVAL_SUPABASE_URL" not in str(exc.value)
    assert "upstream is down" in str(exc.value)


def test_endpoint_hint_override_offers_both_directions(monkeypatch):
    # With an override set, the hint names it and offers both fixes: check the
    # organizer-published endpoint, or unset to reach the default network host
    # (which carries the lane since the 2026-07-11 prod go-live).
    monkeypatch.setenv("MT_EVAL_SUPABASE_URL", "https://staging.example.co")
    hint = contest_intake._endpoint_hint()
    assert "https://staging.example.co" in hint
    assert "unset MT_EVAL_SUPABASE_URL" in hint


def test_endpoint_hint_default_host_points_at_federated_export(monkeypatch):
    # On the default host the lane exists, so this error means a federated
    # contest — the hint shows the export lines for the organizer's endpoint.
    monkeypatch.delenv("MT_EVAL_SUPABASE_URL", raising=False)
    hint = contest_intake._endpoint_hint()
    assert "default network host" in hint
    assert "export MT_EVAL_SUPABASE_URL=" in hint
    assert "export MT_EVAL_SUPABASE_ANON_KEY=" in hint


# ---------------------------------------------------------------------------
# contest_status over the SURVIVING lane (2026-09-06). The retired
# contest_intake table must never be read: a fake that raises on it proves it.
# ---------------------------------------------------------------------------

SECRET_SET = "eval-qaa-qab-synth-secret-v1"
BLIND_SET = "eval-qaa-qab-synth-blindtest-v1"
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"
REQUEST_ID = "authreq-abc123"


def _wire_status(monkeypatch, *, submissions=None, submissions_error=None):
    """Route _api_request at a tiny fixture of the four surviving tables."""
    seen = {"tables": []}

    def api(method, table, params=None, data=None, session=None):
        seen["tables"].append(table)
        assert table != "contest_intake", (
            "contest_status must not read the retired hypotheses table")
        if table == "contests":
            return [{"id": CONTEST_ID, "corpus_id": BLIND_SET}]
        if table == "qualifiers":
            return [{"qualifier_id": QUALIFIER_ID}]
        if table == "sealed_sets":
            return [{"sealed_set_id": BLIND_SET},
                    {"sealed_set_id": SECRET_SET}]
        if table == "authorization_requests":
            seen["request_params"] = params
            return [{"request_id": REQUEST_ID, "sealed_set_id": SECRET_SET,
                     "state": "authorized", "method_sha": "a" * 64,
                     "requested_by": "octo@example.test",
                     "corpus_version": "v1", "node_measurement": "org-node-1",
                     "created_at": "2026-09-06T00:00:00Z"}]
        if table == "contest_submissions":
            if submissions_error is not None:
                raise submissions_error
            return submissions or []
        raise AssertionError(f"unexpected table {table}")

    monkeypatch.setattr(contest_intake, "_api_request", api)
    monkeypatch.setattr(contest_intake, "get_session", lambda: {})
    return seen


def test_status_by_contest_slug_covers_every_sealed_set(monkeypatch, capsys):
    seen = _wire_status(monkeypatch)
    rows = contest_status(CONTEST_ID)
    assert [r["request_id"] for r in rows] == [REQUEST_ID]
    # Both the blind and the fully-secret set are in the filter — an entry is
    # filed against the SECRET set, which the contest row does not name.
    where = seen["request_params"]["sealed_set_id"]
    assert where.startswith("in.(") and SECRET_SET in where and BLIND_SET in where
    out = capsys.readouterr().out
    assert REQUEST_ID in out and "authorized" in out


def test_status_by_request_id_queries_that_request(monkeypatch):
    seen = _wire_status(monkeypatch)
    contest_status(REQUEST_ID)
    assert seen["request_params"]["request_id"] == f"eq.{REQUEST_ID}"
    assert "sealed_set_id" not in seen["request_params"]


def test_status_shows_the_published_card(monkeypatch, capsys):
    _wire_status(monkeypatch, submissions=[{
        "contest_id": CONTEST_ID, "run_card_id": "card-9",
        "authorization_request_id": REQUEST_ID, "notes": "",
        "submitted_by": "octo@example.test"}])
    contest_status(CONTEST_ID)
    assert "card-9" in capsys.readouterr().out


def test_status_pre_074_endpoint_says_so_instead_of_guessing(monkeypatch,
                                                             capsys):
    """D4: an endpoint without 074's authorization_request_id must SAY the
    link is unavailable, never imply 'not published'."""
    missing = RuntimeError(
        'Supabase API error (400): {"code":"42703","message":"column '
        'contest_submissions.authorization_request_id does not exist"}')
    _wire_status(monkeypatch, submissions_error=missing)
    contest_status(REQUEST_ID)
    out = capsys.readouterr().out
    assert "074" in out


def test_intake_id_is_refused_with_the_retirement_reason(monkeypatch):
    _wire_status(monkeypatch)
    with pytest.raises(IntakeError, match="RETIRED"):
        contest_status("intake-abc")
