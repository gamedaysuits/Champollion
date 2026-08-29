"""shared_task module — validation refusals, content-free rows, loud fetches.

The edition umbrella (migration 047) is organizer-side registry machinery, so
everything here is tested against a monkeypatched service_request — no network,
mirroring test_contest_prep.py's registration tests.
"""

from __future__ import annotations

import pytest

import mt_eval_harness.sovereign_service as svc
from mt_eval_harness import shared_task as st


def _capture(monkeypatch, responses=None):
    """Monkeypatch service_request; record calls; pop canned responses."""
    calls = []
    canned = list(responses or [])

    def fake_service_request(method, path, **kw):
        calls.append((method, path, kw.get("data"), kw.get("params")))
        return canned.pop(0) if canned else []

    monkeypatch.setattr(svc, "service_request", fake_service_request)
    return calls


VALID = dict(
    shared_task_id="americasnlp-2026",
    name="AmericasNLP 2026 Shared Task",
    organizer="AmericasNLP organizing committee",
    year=2026,
)


# ---------------------------------------------------------------------------
# create_shared_task — refusals fire BEFORE any network call.
# ---------------------------------------------------------------------------

class TestCreateRefusals:
    @pytest.mark.parametrize("bad_id", ["", "AmericasNLP", "has_underscore",
                                        "-leading-dash", "with space"])
    def test_bad_slug_refused(self, monkeypatch, bad_id):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="slug"):
            st.create_shared_task(**{**VALID, "shared_task_id": bad_id})
        assert not calls, "validation must fire before any network call"

    def test_empty_name_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="name"):
            st.create_shared_task(**{**VALID, "name": "  "})
        assert not calls

    def test_empty_organizer_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="organizer"):
            st.create_shared_task(**{**VALID, "organizer": ""})
        assert not calls

    def test_bad_year_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="year"):
            st.create_shared_task(**{**VALID, "year": 26})
        assert not calls

    def test_bad_default_model_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="authorization"):
            st.create_shared_task(**VALID,
                                  default_authorization_model="vibes")
        assert not calls

    def test_bad_default_limit_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="limit"):
            st.create_shared_task(**VALID, default_intake_daily_limit=0)
        assert not calls


# ---------------------------------------------------------------------------
# create_shared_task — the row it writes is content-free and fail-closed.
# ---------------------------------------------------------------------------

class TestCreateRow:
    def test_posts_expected_row(self, monkeypatch):
        calls = _capture(monkeypatch, responses=[[{
            "shared_task_id": "americasnlp-2026", "organizer": "x",
            "year": 2026}]])
        row = st.create_shared_task(**VALID)
        assert row["shared_task_id"] == "americasnlp-2026"

        method, path, data, _params = calls[0]
        assert (method, path) == ("POST", "shared_tasks")
        assert data["shared_task_id"] == "americasnlp-2026"
        assert data["year"] == 2026
        # Fail-closed default posture unless the organizer chose otherwise.
        assert data["default_authorization_model"] == "per-submission"
        assert data["default_intake_daily_limit"] == 5
        assert data["status"] == "active"
        # Content-free: names + year + defaults only.
        for forbidden in ("source", "reference", "corpus", "content"):
            assert forbidden not in data

    def test_explicit_defaults_pass_through(self, monkeypatch):
        calls = _capture(monkeypatch)
        st.create_shared_task(**VALID, default_authorization_model="blanket",
                              default_intake_daily_limit=10,
                              description="Yearly multi-pair cycle.")
        data = calls[0][2]
        assert data["default_authorization_model"] == "blanket"
        assert data["default_intake_daily_limit"] == 10
        assert data["description"] == "Yearly multi-pair cycle."


# ---------------------------------------------------------------------------
# fetch / list.
# ---------------------------------------------------------------------------

class TestFetchAndList:
    def test_fetch_returns_the_row(self, monkeypatch):
        _capture(monkeypatch, responses=[[{"shared_task_id": "americasnlp-2026",
                                           "default_intake_daily_limit": 3}]])
        row = st.fetch_shared_task("americasnlp-2026")
        assert row["default_intake_daily_limit"] == 3

    def test_fetch_missing_fails_loud_with_the_create_hint(self, monkeypatch):
        _capture(monkeypatch, responses=[[]])
        with pytest.raises(st.SharedTaskError,
                           match="not registered.*shared-task create"):
            st.fetch_shared_task("americasnlp-2099")

    def test_list_filters(self, monkeypatch):
        calls = _capture(monkeypatch, responses=[[{"shared_task_id": "a"}]])
        rows = st.list_shared_tasks(year=2026)
        assert rows == [{"shared_task_id": "a"}]
        _method, path, _data, params = calls[0]
        assert path == "shared_tasks"
        assert params["year"] == "eq.2026"
        assert params["status"] == "eq.active"

    def test_list_can_include_archived(self, monkeypatch):
        calls = _capture(monkeypatch)
        st.list_shared_tasks(include_archived=True)
        params = calls[0][3]
        assert "status" not in params
