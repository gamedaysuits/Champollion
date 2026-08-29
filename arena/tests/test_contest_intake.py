"""contest_intake — the participant submission door's identity binding.

The regression these tests pin down: migration 043 binds
contest_intake.submitted_by to the JWT email on INSERT, and 044 binds the
second storage path segment ((storage.foldername(name))[2]) to the same
claim — so submit_hypotheses must write the EMAIL to both, never the
display identity (GitHub preferred_username / Google full_name). A display
name 403s both the bucket upload and the row insert for any user whose
username differs from their email. Everything above the network line is
real; contest/qualifier fetch, scoring, the gate verdict, storage, and the
REST insert are monkeypatched.
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import contest_intake
from mt_eval_harness.auth import get_submitter_email
from mt_eval_harness.contest_intake import (
    IntakeError,
    fetch_contest_bundle,
    submit_hypotheses,
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


def _wire(tmp_path, monkeypatch, session):
    """Stub the network line; return (submit kwargs, captured writes)."""
    dev_hyp = tmp_path / "dev.txt"
    test_hyp = tmp_path / "test.txt"
    dev_corpus = tmp_path / "dev_corpus.json"
    dev_hyp.write_text("hyp\n", encoding="utf-8")
    test_hyp.write_text("hyp\n", encoding="utf-8")
    dev_corpus.write_text(
        json.dumps({"dataset": {"corpus_id": QUALIFIER_CORPUS}}),
        encoding="utf-8")

    captured = {}

    monkeypatch.setattr(contest_intake, "fetch_contest_bundle", lambda cid: {
        "contest": {"id": cid, "language_pair": "qaa>qab",
                    "authorization_model": "open"},
        "qualifier": {"qualifier_id": "q-2026",
                      "corpus_card_id": QUALIFIER_CORPUS,
                      "threshold": 50.0, "metric": "chrf", "year": 2026},
    })
    monkeypatch.setattr(contest_intake, "score_hypotheses",
                        lambda **kw: {"qualifier_score": 61.0})
    monkeypatch.setattr(contest_intake, "is_eligible_for_sealed_run",
                        lambda **kw: {"eligible": True, "reason": "clears",
                                      "badge": None})
    monkeypatch.setattr(contest_intake, "get_session", lambda: session)
    monkeypatch.setattr(
        contest_intake, "_storage_upload",
        lambda sess, path, data: captured.setdefault("object_path", path))

    def fake_api(method, table, params=None, data=None, session=None):
        captured["row"] = data
        return [dict(data, status="received")]

    monkeypatch.setattr(contest_intake, "_api_request", fake_api)

    kwargs = dict(
        contest_id=CONTEST_ID,
        test_hyp_path=test_hyp,
        dev_hyp_path=dev_hyp,
        dev_corpus_path=dev_corpus,
        system_label="synth-system",
        method_class="api",
        scratch_dir=tmp_path / "scratch",
    )
    return kwargs, captured


def test_submitted_by_and_storage_path_bind_to_jwt_email(tmp_path, monkeypatch):
    kwargs, captured = _wire(tmp_path, monkeypatch, GITHUB_SESSION)
    result = submit_hypotheses(**kwargs)

    assert captured["row"]["submitted_by"] == "octo@example.test"
    # (storage.foldername(name))[2] — the segment migration 044 compares.
    assert captured["object_path"].split("/")[1] == "octo@example.test"
    assert "octocat" not in captured["object_path"]
    assert result["storage_path"] == captured["object_path"]


def test_missing_email_claim_fails_loud_before_any_write(tmp_path, monkeypatch):
    session = {"access_token": "tok",
               "user": {"user_metadata": {"preferred_username": "octocat"}}}
    kwargs, captured = _wire(tmp_path, monkeypatch, session)
    with pytest.raises(RuntimeError, match="email"):
        submit_hypotheses(**kwargs)
    assert "object_path" not in captured
    assert "row" not in captured


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
