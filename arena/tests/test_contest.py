"""
Tests for mt_eval_harness.contest — contest CRUD operations.

These tests mock the Supabase API layer and verify that the contest
module correctly:
  - Validates inputs (visibility modes, team requirements)
  - Generates slugs from names
  - Constructs correct API requests
  - Parses responses
  - Resolves run_card_ids from report files
"""

import json

import tempfile
from pathlib import Path
from unittest import mock

import pytest

from mt_eval_harness.contest import (
    _slugify,
    create_contest,
    list_contests,
    list_submissions,
    resolve_run_card_id,
    submit_to_contest,
)


# ---------------------------------------------------------------------------
# Slug generation
# ---------------------------------------------------------------------------

class TestSlugify:
    """Slug generation from contest names."""

    def test_basic_name(self):
        assert _slugify("EN CRK Open") == "en-crk-open"

    def test_arrow_symbol(self):
        assert _slugify("EN→CRK Open 2026") == "en-crk-open-2026"

    def test_ascii_arrow(self):
        assert _slugify("EN->CRK Open") == "en-crk-open"

    def test_special_chars(self):
        assert _slugify("Test!@#$%Contest") == "test-contest"

    def test_leading_trailing_hyphens(self):
        assert _slugify("--test--") == "test"

    def test_multiple_spaces(self):
        assert _slugify("a   b   c") == "a-b-c"


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

class TestCreateContestValidation:
    """Validation logic in create_contest (before API call)."""

    def test_invalid_visibility_raises(self):
        with pytest.raises(ValueError, match="Invalid visibility"):
            create_contest(
                name="Test",
                corpus_id="test-corpus",
                language_pair="en>crk",
                visibility="secret",  # not a valid mode
            )

    def test_team_visibility_without_teams_raises(self):
        with pytest.raises(ValueError, match="Team-scoped contests"):
            create_contest(
                name="Test",
                corpus_id="test-corpus",
                language_pair="en>crk",
                visibility="team",
                teams=None,  # team mode requires teams
            )

    def test_team_visibility_with_empty_teams_raises(self):
        with pytest.raises(ValueError, match="Team-scoped contests"):
            create_contest(
                name="Test",
                corpus_id="test-corpus",
                language_pair="en>crk",
                visibility="team",
                teams=[],
            )

    def test_invalid_use_context_raises(self):
        with pytest.raises(ValueError, match="Invalid use_context"):
            create_contest(
                name="Test",
                corpus_id="test-corpus",
                language_pair="en>crk",
                use_context="for-profit",  # not a valid context
            )

    def test_commercial_contest_over_nc_corpus_raises(self, monkeypatch):
        """A commercial contest may not be created over a NonCommercial corpus."""
        import mt_eval_harness.contest as contest_mod
        monkeypatch.setattr(
            "mt_eval_harness.license_use.resolve_corpus_license",
            lambda corpus_id, registry_path=None: ("CC-BY-NC-4.0", corpus_id),
        )
        monkeypatch.setattr(
            "mt_eval_harness.license_use.corpus_is_quarantined",
            lambda corpus_id, registry_path=None: False,
        )
        with pytest.raises(ValueError, match="not eligible"):
            create_contest(
                name="Commercial NC",
                corpus_id="some-nc-corpus",
                language_pair="en>crk",
                use_context="commercial",
            )


# ---------------------------------------------------------------------------
# Resolve run_card_id
# ---------------------------------------------------------------------------

class TestResolveRunCardId:
    """resolve_run_card_id extracts IDs from files or passes through strings."""

    def test_direct_id_passthrough(self):
        """Non-path strings are treated as direct IDs."""
        assert resolve_run_card_id("abc-123-def") == "abc-123-def"

    def test_json_file_with_run_id(self, tmp_path):
        """Extract run_id from top-level of a report JSON."""
        report = {"run_id": "run-from-file-001", "scores": {}}
        path = tmp_path / "report.json"
        path.write_text(json.dumps(report))
        assert resolve_run_card_id(str(path)) == "run-from-file-001"

    def test_json_file_with_nested_run_id(self, tmp_path):
        """Extract run_id from run_card.run_id."""
        report = {"run_card": {"run_id": "nested-id-002"}}
        path = tmp_path / "report.json"
        path.write_text(json.dumps(report))
        assert resolve_run_card_id(str(path)) == "nested-id-002"

    def test_json_file_with_metadata_run_id(self, tmp_path):
        """Extract run_id from metadata.run_id."""
        report = {"metadata": {"run_id": "meta-id-003"}}
        path = tmp_path / "report.json"
        path.write_text(json.dumps(report))
        assert resolve_run_card_id(str(path)) == "meta-id-003"

    def test_json_file_missing_run_id_raises(self, tmp_path):
        """Report without run_id raises KeyError."""
        report = {"scores": {"chrf": 0.5}}
        path = tmp_path / "report.json"
        path.write_text(json.dumps(report))
        with pytest.raises(KeyError, match="Could not find run_id"):
            resolve_run_card_id(str(path))

    def test_nonexistent_file_raises(self):
        with pytest.raises(FileNotFoundError):
            resolve_run_card_id("/nonexistent/path/report.json")


# ---------------------------------------------------------------------------
# API interaction (mocked)
# ---------------------------------------------------------------------------

def _mock_api_response(data, status=200):
    """Create a mock urllib response context manager."""
    response = mock.MagicMock()
    response.read.return_value = json.dumps(data).encode()
    response.__enter__ = mock.MagicMock(return_value=response)
    response.__exit__ = mock.MagicMock(return_value=False)
    return response


@pytest.fixture
def mock_supabase_env():
    """Mock Supabase constants imported from auth.py."""
    with mock.patch(
        "mt_eval_harness.contest.SUPABASE_URL",
        "https://test.supabase.co",
    ), mock.patch(
        "mt_eval_harness.contest.SUPABASE_ANON_KEY",
        "test-anon-key",
    ):
        yield


@pytest.fixture
def mock_auth():
    """Mock auth.get_session to return a valid session dict."""
    mock_session = {
        "access_token": "test-token",
        "user": {"email": "test@example.com"},
    }
    with mock.patch(
        "mt_eval_harness.contest.get_session",
        return_value=mock_session,
    ), mock.patch(
        "mt_eval_harness.auth.get_submitter_email",
        return_value="test@example.com",
    ):
        yield


class TestCreateContestAPI:
    """create_contest API interaction."""

    def test_successful_create(self, mock_supabase_env, mock_auth):
        """Successful contest creation returns the created record."""
        response_data = [{
            "id": "en-crk-open-2026",
            "name": "EN→CRK Open 2026",
            "status": "open",
        }]

        with mock.patch("urllib.request.urlopen", return_value=_mock_api_response(response_data)):
            result = create_contest(
                name="EN→CRK Open 2026",
                corpus_id="edtekla-v1",
                language_pair="en>crk",
            )
            assert result["id"] == "en-crk-open-2026"
            assert result["status"] == "open"


class TestSubmitToContestAPI:
    """submit_to_contest API interaction."""

    def test_successful_submit(self, mock_supabase_env, mock_auth):
        """Successful submission checks contest status then inserts."""
        # First call: GET to verify contest is open
        contest_response = _mock_api_response([{
            "id": "en-crk-open-2026",
            "status": "open",
        }])
        # Second call: POST the submission
        submit_response = _mock_api_response([{
            "id": 1,
            "contest_id": "en-crk-open-2026",
            "run_card_id": "run-001",
        }])

        with mock.patch(
            "urllib.request.urlopen",
            side_effect=[contest_response, submit_response],
        ):
            result = submit_to_contest(
                contest_id="en-crk-open-2026",
                run_card_id="run-001",
            )
            assert result["contest_id"] == "en-crk-open-2026"

    def test_submit_to_closed_contest_raises(self, mock_supabase_env, mock_auth):
        """Submitting to a closed contest raises RuntimeError."""
        contest_response = _mock_api_response([{
            "id": "old-contest",
            "status": "closed",
        }])

        with mock.patch(
            "urllib.request.urlopen",
            return_value=contest_response,
        ):
            with pytest.raises(RuntimeError, match="closed"):
                submit_to_contest(
                    contest_id="old-contest",
                    run_card_id="run-001",
                )

    def test_submit_to_nonexistent_contest_raises(self, mock_supabase_env, mock_auth):
        """Submitting to a nonexistent contest raises RuntimeError."""
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_mock_api_response([]),
        ):
            with pytest.raises(RuntimeError, match="not found"):
                submit_to_contest(
                    contest_id="no-such-contest",
                    run_card_id="run-001",
                )


class TestListContestsAPI:
    """list_contests API interaction."""

    def test_list_returns_contests(self, mock_supabase_env, mock_auth):
        """Listing returns parsed contest records."""
        response_data = [
            {"id": "contest-1", "name": "C1", "language_pair": "en>crk",
             "visibility": "public", "status": "open"},
            {"id": "contest-2", "name": "C2", "language_pair": "en>crk",
             "visibility": "private", "status": "open"},
        ]

        with mock.patch("urllib.request.urlopen", return_value=_mock_api_response(response_data)):
            result = list_contests(status="open")
            assert len(result) == 2
            assert result[0]["id"] == "contest-1"

    def test_empty_list(self, mock_supabase_env, mock_auth):
        """Empty result returns empty list."""
        with mock.patch("urllib.request.urlopen", return_value=_mock_api_response([])):
            result = list_contests(status="open")
            assert result == []


class TestListSubmissionsAPI:
    """list_submissions API interaction."""

    def test_list_submissions(self, mock_supabase_env, mock_auth):
        """Listing submissions returns parsed records."""
        response_data = [
            {"id": 1, "run_card_id": "run-001", "submitted_by": "alice@test.com",
             "submitted_at": "2026-06-07T12:00:00Z", "team": "alpha", "notes": ""},
        ]

        with mock.patch("urllib.request.urlopen", return_value=_mock_api_response(response_data)):
            result = list_submissions("en-crk-open-2026")
            assert len(result) == 1
            assert result[0]["run_card_id"] == "run-001"


# ---------------------------------------------------------------------------
# CLI dispatch — refusals must be clean one-liners, never tracebacks
# ---------------------------------------------------------------------------

class TestContestCliRefusals:
    """'mt-eval contest ...' renders expected refusals (eligibility,
    quarantine, validation) as a one-line error with exit code 1 — the
    prelaunch audit found these surfacing as raw Python tracebacks."""

    def _run_cli(self, monkeypatch, argv):
        import sys as _sys
        from mt_eval_harness.cli import main
        monkeypatch.setattr(_sys, "argv", ["mt-eval"] + argv)
        with pytest.raises(SystemExit) as ei:
            main()
        return ei.value.code

    def test_ineligible_corpus_is_clean_one_liner(self, monkeypatch, capsys):
        """A commercial contest over an NC corpus: refusal, not traceback."""
        monkeypatch.setattr(
            "mt_eval_harness.license_use.resolve_corpus_license",
            lambda corpus_id, registry_path=None: ("CC-BY-NC-4.0", corpus_id),
        )
        monkeypatch.setattr(
            "mt_eval_harness.license_use.corpus_is_quarantined",
            lambda corpus_id, registry_path=None: False,
        )
        code = self._run_cli(monkeypatch, [
            "contest", "create",
            "--name", "Commercial NC",
            "--corpus", "some-nc-corpus",
            "--language-pair", "en>crk",
            "--use-context", "commercial",
        ])
        assert code == 1
        err = capsys.readouterr().err
        assert "not eligible" in err
        assert "Traceback" not in err

    def test_quarantined_corpus_is_clean_one_liner(self, monkeypatch, capsys):
        """A quarantined corpus is refused cleanly in either lane."""
        monkeypatch.setattr(
            "mt_eval_harness.license_use.resolve_corpus_license",
            lambda corpus_id, registry_path=None: ("CC-BY-4.0", corpus_id),
        )
        monkeypatch.setattr(
            "mt_eval_harness.license_use.corpus_is_quarantined",
            lambda corpus_id, registry_path=None: True,
        )
        code = self._run_cli(monkeypatch, [
            "contest", "create",
            "--name", "Quarantine Test",
            "--corpus", "held-out-corpus",
            "--language-pair", "en>crk",
        ])
        assert code == 1
        err = capsys.readouterr().err
        assert "not eligible" in err
        assert "Traceback" not in err

    def test_team_mode_without_teams_is_clean_one_liner(
        self, monkeypatch, capsys,
    ):
        code = self._run_cli(monkeypatch, [
            "contest", "create",
            "--name", "Teamless",
            "--corpus", "edtekla-v1",
            "--language-pair", "en>crk",
            "--visibility", "team",
        ])
        assert code == 1
        err = capsys.readouterr().err
        assert "Team-scoped contests" in err
        assert "Traceback" not in err
