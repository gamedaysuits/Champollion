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


class TestSubmitToContestRetired:
    """`submit_to_contest` is GONE (founder ruling R2, 2026-09-06).

    Linking a self-reported run card to a contest was the "contest submit"
    path. A contest now means sovereign hosting: an entry is a METHOD the
    organizer's node executes on the sealed set, and the node writes the
    contest_submissions row itself. A self-reported card belongs on the public
    leaderboard (`mt-eval publish`), which is not a contest.
    """

    def test_the_function_is_gone(self):
        import mt_eval_harness.contest as contest_mod
        assert not hasattr(contest_mod, "submit_to_contest")

    def test_the_cli_verb_is_gone(self):
        from mt_eval_harness.cli import build_parser
        with pytest.raises(SystemExit):
            build_parser().parse_args(["contest", "submit", "c1", "--run", "r.json"])


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


# ---------------------------------------------------------------------------
# The competition half: primary_metric, set_intake, close_contest
# ---------------------------------------------------------------------------

from mt_eval_harness.contest import close_contest, set_intake  # noqa: E402


class _ContestDB:
    """Routes _api_request for the lifecycle verbs; records PATCH payloads."""

    def __init__(self, contest):
        self.contest = contest
        self.calls = []
        self.patches = []
        self.patch_result = None   # None → echo the merged row
        self.deferred = []         # contest_deferred_results rows (074)
        self.requests = []         # authorization_requests rows (038)

    def __call__(self, method, path, data=None, params=None, session=None,
                 prefer=None):
        self.calls.append((method, path, data, params, session))
        if path == "contests" and method == "GET":
            cid = (params or {}).get("id", "").removeprefix("eq.")
            return [dict(self.contest)] if cid == self.contest["id"] else []
        if path == "contests" and method == "PATCH":
            self.patches.append(data)
            if self.patch_result is not None:
                return self.patch_result
            self.contest.update(data)
            return [dict(self.contest)]
        if path == "contest_submissions":
            return []
        if path == "authorization_requests":
            # The R2 entry model: the ranker reads the sovereign lane's queue
            # items for this contest's sealed sets, so an entry in flight is
            # never silently missing from a ranking.
            return list(self.requests)
        if path == "run_cards":
            return []
        if path == "contest_deferred_results":
            # Migration 074's withheld-results table. Owner SELECT only, so
            # the close leg reads it with the organizer's own session.
            return [dict(r) for r in self.deferred]
        raise AssertionError(f"unexpected {method} {path}")


def _open_contest(**kw):
    c = {"id": "beta-2026", "name": "Beta", "description": "", "corpus_id": "set-main",
         "language_pair": "qaa>qab", "visibility": "public",
         "created_by": "test@example.com", "status": "open",
         "metadata": {"primary_metric": "chrf_plus_plus"},
         "created_at": "2026-09-01T00:00:00Z", "use_context": "non-commercial",
         "lane": "standard", "authorization_model": "open",
         "intake_daily_limit": 5, "intake_open": False, "shared_task_id": None}
    c.update(kw)
    return c


@pytest.fixture
def lifecycle_db(monkeypatch, mock_auth):
    import mt_eval_harness.contest as contest_mod
    db = _ContestDB(_open_contest())
    monkeypatch.setattr(contest_mod, "_api_request", db)
    return db


class TestCreateContestPrimaryMetric:
    def test_default_primary_metric_recorded_in_metadata(self, mock_supabase_env, mock_auth):
        captured = {}

        def fake_urlopen(req, *a, **k):
            captured["body"] = json.loads(req.data.decode()) if req.data else None
            return _mock_api_response([{"id": "x", "status": "open"}])

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            create_contest(name="X", corpus_id="edtekla-v1", language_pair="en>crk")
        # The default contest hides results until close, and it SAYS so: both
        # publication promises are recorded explicitly, never left absent for
        # a reader to interpret — and so is the computation behind the metric.
        from mt_eval_harness import __version__
        from mt_eval_harness.rankable_metrics import expected_signature
        assert captured["body"]["metadata"] == {
            "primary_metric": "chrf_plus_plus",
            "metric_signature": expected_signature("chrf_plus_plus"),
            "harness_version": __version__,
            "results_visibility": "hidden_until_close",
            "anonymize_until_close": False,
        }
        assert "|nw:2|" in captured["body"]["metadata"]["metric_signature"]

    def test_explicit_alias_canonicalised(self, mock_supabase_env, mock_auth):
        captured = {}

        def fake_urlopen(req, *a, **k):
            captured["body"] = json.loads(req.data.decode()) if req.data else None
            return _mock_api_response([{"id": "x", "status": "open"}])

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            create_contest(name="X", corpus_id="edtekla-v1", language_pair="en>crk",
                           primary_metric="corpus_bleu")
        assert captured["body"]["metadata"]["primary_metric"] == "bleu"

    def test_chrf_records_plain_chrf_and_its_signature(self, mock_supabase_env, mock_auth):
        captured = {}

        def fake_urlopen(req, *a, **k):
            captured["body"] = json.loads(req.data.decode()) if req.data else None
            return _mock_api_response([{"id": "x", "status": "open"}])

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            create_contest(name="X", corpus_id="edtekla-v1", language_pair="en>crk",
                           primary_metric="chrf")
        md = captured["body"]["metadata"]
        assert md["primary_metric"] == "chrf_plain"
        assert "|nw:0|" in md["metric_signature"]

    def test_model_scored_metric_requires_the_model(self):
        with pytest.raises(ValueError, match="neural model"):
            create_contest(name="X", corpus_id="edtekla-v1", language_pair="en>crk",
                           primary_metric="comet")

    def test_model_scored_metric_records_model_and_harness(self, mock_supabase_env, mock_auth):
        captured = {}

        def fake_urlopen(req, *a, **k):
            captured["body"] = json.loads(req.data.decode()) if req.data else None
            return _mock_api_response([{"id": "x", "status": "open"}])

        from mt_eval_harness import __version__
        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            create_contest(name="X", corpus_id="edtekla-v1", language_pair="en>crk",
                           primary_metric="comet", metric_model="Unbabel/wmt22-comet-da")
        assert captured["body"]["metadata"]["metric_signature"] == \
            f"Unbabel/wmt22-comet-da|harness:{__version__}"

    def test_metric_model_refused_for_a_non_model_metric(self):
        with pytest.raises(ValueError, match="not model-scored"):
            create_contest(name="X", corpus_id="edtekla-v1", language_pair="en>crk",
                           primary_metric="bleu", metric_model="m")

    def test_declared_power_is_recorded(self, mock_supabase_env, mock_auth):
        captured = {}

        def fake_urlopen(req, *a, **k):
            captured["body"] = json.loads(req.data.decode()) if req.data else None
            return _mock_api_response([{"id": "x", "status": "open"}])

        power = {"n_segments": 400, "metric": "chrf_plus_plus", "target_power": 0.8,
                 "alpha": 0.05, "minimum_detectable_effect": None, "parameters": None,
                 "derivation_version": "v1", "note": "no effect parameters measured"}
        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            create_contest(name="X", corpus_id="edtekla-v1", language_pair="en>crk",
                           declared_power=power)
        assert captured["body"]["metadata"]["declared_power"] == power

    def test_unknown_primary_metric_refused_before_any_network(self):
        with pytest.raises(ValueError, match="Unknown primary metric"):
            create_contest(name="X", corpus_id="edtekla-v1", language_pair="en>crk",
                           primary_metric="wer")


class TestSetIntake:
    def test_opens_intake_through_owner_patch(self, lifecycle_db):
        rec = set_intake("beta-2026", True)
        assert rec["intake_open"] is True
        patch = next(c for c in lifecycle_db.calls if c[0] == "PATCH")
        assert patch[2] == {"intake_open": True}
        assert patch[3] == {"id": "eq.beta-2026"}
        assert patch[4] is not None, "must PATCH with the owner's session"

    def test_closes_intake(self, lifecycle_db):
        lifecycle_db.contest["intake_open"] = True
        rec = set_intake("beta-2026", False)
        assert rec["intake_open"] is False

    def test_noop_when_already_in_state(self, lifecycle_db, capsys):
        set_intake("beta-2026", False)
        assert not lifecycle_db.patches
        assert "already CLOSED" in capsys.readouterr().out

    def test_refuses_not_found(self, lifecycle_db):
        with pytest.raises(RuntimeError, match="not found"):
            set_intake("nope", True)

    def test_refuses_not_owner(self, lifecycle_db):
        lifecycle_db.contest["created_by"] = "someone@else.org"
        with pytest.raises(RuntimeError, match="owned by someone@else.org"):
            set_intake("beta-2026", True)
        assert not lifecycle_db.patches

    def test_refuses_closed_contest(self, lifecycle_db):
        lifecycle_db.contest["status"] = "closed"
        with pytest.raises(RuntimeError, match="no longer open"):
            set_intake("beta-2026", True)

    def test_zero_rows_updated_is_loud(self, lifecycle_db):
        lifecycle_db.patch_result = []
        with pytest.raises(RuntimeError, match="matched no row"):
            set_intake("beta-2026", True)


def _canned_ranking(pending=(), entries=None):
    return {
        "contest": {"id": "beta-2026", "name": "Beta", "status": "open",
                    "corpus_id": "set-main", "language_pair": "qaa>qab",
                    "lane": "standard", "intake_open": True},
        "metric": "chrf_plus_plus", "metric_label": "chrF++",
        "metric_source": "contest.metadata.primary_metric",
        "tiebreak_order": ["chrf_plus_plus", "bleu", "comet_score", "submitted_at", "run_card_id"],
        "trust_policy": "verified-only", "hidden_unverified": 0,
        "ranking_method": {"tie_test": "ar", "n_resamples": 1000, "alpha": 0.05,
                           "seed": 12345, "evidence_used": [], "note": "n"},
        "generated_at": "2026-09-06T12:00:00+00:00", "generated_by": "test@example.com",
        "harness_version": "0.1.1", "provisional": True, "frozen": False,
        "entries": entries if entries is not None else [
            {"rank": 1, "tie_group": 1, "run_card_id": "a", "model_slug": "sys/a",
             "trust": "verified", "primary": {"metric": "chrf_plus_plus", "value": 70.0},
             "scores": {}, "tie_evidence": None}],
        "unscored": [], "excluded": [], "other_sets": [],
        "pending_intake": list(pending), "rejected_intake": [],
    }


class TestCloseContest:
    @pytest.fixture
    def ranked(self, monkeypatch):
        import mt_eval_harness.contest_rank as cr
        seen = {}

        def fake_build(contest_id, **kw):
            seen.update(kw)
            seen["contest_id"] = contest_id
            return _canned_ranking(pending=seen.get("_pending", ()))
        monkeypatch.setattr(cr, "build_ranking", fake_build)
        return seen

    def test_close_freezes_ranking_in_one_patch(self, lifecycle_db, ranked):
        lifecycle_db.contest["intake_open"] = True
        rec = close_contest("beta-2026", auto_confirm=True)
        assert rec["status"] == "closed"
        assert len(lifecycle_db.patches) == 1
        patch = lifecycle_db.patches[0]
        assert patch["status"] == "closed"
        assert patch["intake_open"] is False
        md = patch["metadata"]
        assert md["primary_metric"] == "chrf_plus_plus", "existing keys merged, not replaced"
        assert md["closed_by"] == "test@example.com"
        assert md["closed_at"]
        snap = md["final_ranking"]
        assert snap["frozen"] is True and snap["provisional"] is False
        assert snap["entries"][0]["run_card_id"] == "a"
        assert snap["trust_policy"] == "verified-only"
        # the recorded metric only — never a --metric override
        assert ranked["metric"] is None
        assert ranked["contest"]["id"] == "beta-2026"

    def test_close_passes_tie_flags_and_trust_policy(self, lifecycle_db, ranked):
        close_contest("beta-2026", auto_confirm=True, include_unverified=True,
                      tie_test="bootstrap", n_resamples=77, alpha=0.1, seed=9,
                      use_segments=False)
        assert ranked["include_unverified"] is True
        assert ranked["tie_test"] == "bootstrap"
        assert ranked["n_resamples"] == 77 and ranked["alpha"] == 0.1 and ranked["seed"] == 9
        assert ranked["use_segments"] is False

    def test_second_close_refused(self, lifecycle_db, ranked):
        close_contest("beta-2026", auto_confirm=True)
        with pytest.raises(RuntimeError, match="already closed"):
            close_contest("beta-2026", auto_confirm=True)
        assert len(lifecycle_db.patches) == 1

    def test_pending_intake_refuses_without_force(self, lifecycle_db, ranked):
        # The row shape contest_rank.build_ranking emits: authorization
        # requests carry `state`, not `status`.
        ranked["_pending"] = [{"intake_id": "intake-1", "state": "pending"}]
        with pytest.raises(RuntimeError, match=r"in flight \(pending\)"):
            close_contest("beta-2026", auto_confirm=True)
        assert not lifecycle_db.patches
        close_contest("beta-2026", auto_confirm=True, force=True)
        assert lifecycle_db.patches[0]["metadata"]["final_ranking"]["pending_intake"][0]["intake_id"] == "intake-1"

    def test_not_owner_refused_before_ranking(self, lifecycle_db, ranked):
        lifecycle_db.contest["created_by"] = "someone@else.org"
        with pytest.raises(RuntimeError, match="owned by"):
            close_contest("beta-2026", auto_confirm=True)
        assert "contest_id" not in ranked

    def test_prompt_abort_leaves_contest_open(self, lifecycle_db, ranked, monkeypatch):
        monkeypatch.setattr("builtins.input", lambda *_: "n")
        with pytest.raises(RuntimeError, match="aborted"):
            close_contest("beta-2026")
        assert not lifecycle_db.patches

    def test_zero_rows_updated_is_loud(self, lifecycle_db, ranked):
        lifecycle_db.patch_result = []
        with pytest.raises(RuntimeError, match="matched no row"):
            close_contest("beta-2026", auto_confirm=True)


class TestLifecycleCliRefusals:
    """The new verbs render refusals as clean one-liners too."""

    _run_cli = TestContestCliRefusals._run_cli

    @staticmethod
    def _run_cli_ok(monkeypatch, argv):
        """A successful verb returns normally (exit 0); a refusal exits 1."""
        import sys as _sys
        from mt_eval_harness.cli import main
        monkeypatch.setattr(_sys, "argv", ["mt-eval"] + argv)
        try:
            main()
        except SystemExit as exc:
            return exc.code
        return 0

    def test_open_intake_not_owner_is_clean(self, monkeypatch, capsys, lifecycle_db):
        lifecycle_db.contest["created_by"] = "someone@else.org"
        code = self._run_cli(monkeypatch, ["contest", "open-intake", "beta-2026"])
        assert code == 1
        err = capsys.readouterr().err
        assert "owned by someone@else.org" in err and "Traceback" not in err

    def test_close_missing_contest_is_clean(self, monkeypatch, capsys, lifecycle_db):
        code = self._run_cli(monkeypatch, ["contest", "close", "nope", "--yes"])
        assert code == 1
        err = capsys.readouterr().err
        assert "not found" in err and "Traceback" not in err

    def test_rank_json_is_pure_json_on_stdout(self, monkeypatch, capsys, lifecycle_db):
        import mt_eval_harness.auth as auth_mod
        monkeypatch.setattr(auth_mod, "get_cached_session", lambda: None)
        lifecycle_db.contest["metadata"] = {}
        code = self._run_cli_ok(monkeypatch, ["contest", "rank", "beta-2026", "--json",
                                              "--no-segments"])
        assert code == 0
        out = capsys.readouterr().out
        data = json.loads(out)          # nothing but JSON on stdout
        assert data["contest"]["id"] == "beta-2026"
        assert data["entries"] == []
        assert data["metric_source"] == "harness-default"

    def test_rank_bad_metric_is_clean(self, monkeypatch, capsys, lifecycle_db):
        import mt_eval_harness.auth as auth_mod
        monkeypatch.setattr(auth_mod, "get_cached_session", lambda: None)
        code = self._run_cli(monkeypatch, ["contest", "rank", "beta-2026",
                                           "--metric", "wer", "--no-segments"])
        assert code == 1
        err = capsys.readouterr().err
        assert "Unknown primary metric" in err and "Traceback" not in err

    def test_export_closed_without_snapshot_is_clean(self, monkeypatch, capsys, lifecycle_db):
        import mt_eval_harness.auth as auth_mod
        monkeypatch.setattr(auth_mod, "get_cached_session", lambda: None)
        lifecycle_db.contest["status"] = "closed"
        lifecycle_db.contest["metadata"] = {}
        code = self._run_cli(monkeypatch, ["contest", "export", "beta-2026"])
        assert code == 1
        err = capsys.readouterr().err
        assert "no frozen metadata.final_ranking" in err and "Traceback" not in err

    def test_export_csv_to_file(self, monkeypatch, capsys, lifecycle_db, tmp_path):
        import mt_eval_harness.auth as auth_mod
        monkeypatch.setattr(auth_mod, "get_cached_session", lambda: None)
        lifecycle_db.contest["status"] = "closed"
        lifecycle_db.contest["metadata"] = {"final_ranking": _canned_ranking(),
                                            "closed_at": "2026-09-06T12:00:00Z"}
        out = tmp_path / "r.csv"
        code = self._run_cli_ok(monkeypatch, ["contest", "export", "beta-2026",
                                              "--format", "csv", "--out", str(out)])
        assert code == 0
        text = out.read_text()
        assert text.splitlines()[0].startswith("set,dataset_id,rank,tie_group,run_card_id")
        assert ",a,sys/a," in text
        assert "FROZEN" in capsys.readouterr().err


# ---------------------------------------------------------------------------
# Publication policy at the two ends — contract C5 (practices 2 and 6).
#
# `create` records the PROMISES; `close` keeps them: it publishes every
# withheld result BEFORE the ranking is built (so the frozen snapshot ranks
# them), even under --force, and it reveals identities because "anonymised
# until close" means exactly that.
# ---------------------------------------------------------------------------

class TestCreateContestPublicationPromises:
    def _create(self, monkeypatch, **kw):
        captured = {}

        def fake_urlopen(req, *a, **k):
            captured["body"] = json.loads(req.data.decode()) if req.data else None
            return _mock_api_response([{"id": "x", "status": "open"}])

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            create_contest(name="X", corpus_id="edtekla-v1",
                           language_pair="en>crk", **kw)
        return captured["body"]

    def test_hidden_until_close_is_recorded(self, mock_supabase_env, mock_auth,
                                            monkeypatch):
        body = self._create(monkeypatch,
                            results_visibility="hidden_until_close")
        assert body["metadata"]["results_visibility"] == "hidden_until_close"

    def test_anonymize_until_close_is_recorded(self, mock_supabase_env,
                                               mock_auth, monkeypatch):
        body = self._create(monkeypatch, anonymize_until_close=True)
        assert body["metadata"]["anonymize_until_close"] is True

    def test_metadata_extra_merges_under_the_promises(self, mock_supabase_env,
                                                      mock_auth, monkeypatch):
        body = self._create(
            monkeypatch,
            metadata_extra={"require_description": True,
                            "results_visibility": "immediate"})
        assert body["metadata"]["require_description"] is True
        # The explicit kwarg (here its default) always wins over metadata_extra.
        assert body["metadata"]["results_visibility"] == "hidden_until_close"

    def test_unknown_visibility_refused_before_any_network(self):
        with pytest.raises(ValueError, match="Invalid results_visibility"):
            create_contest(name="X", corpus_id="edtekla-v1",
                           language_pair="en>crk",
                           results_visibility="when-i-feel-like-it")

    def test_metadata_extra_must_be_a_dict(self):
        with pytest.raises(ValueError, match="metadata_extra must be a dict"):
            create_contest(name="X", corpus_id="edtekla-v1",
                           language_pair="en>crk", metadata_extra=["nope"])


@pytest.fixture
def ranked(monkeypatch):
    """Module-level twin of TestCloseContest's fixture: build_ranking is
    stubbed, and every kwarg the close passed is captured for assertions."""
    import mt_eval_harness.contest_rank as cr
    seen = {}

    def fake_build(contest_id, **kw):
        seen.update(kw)
        seen["contest_id"] = contest_id
        return _canned_ranking(pending=seen.get("_pending", ()))
    monkeypatch.setattr(cr, "build_ranking", fake_build)
    return seen


@pytest.fixture
def deferred_node(monkeypatch, lifecycle_db):
    """A stand-in organizer node holding two withheld results."""
    import mt_eval_harness.contest_node as cn
    state = {"published": [], "publish_calls": 0}
    lifecycle_db.contest["metadata"] = {
        "primary_metric": "chrf_plus_plus",
        "results_visibility": "hidden_until_close",
    }
    lifecycle_db.deferred = [
        {"request_id": "authreq-1", "contest_id": "beta-2026",
         "role": "main", "published_run_card_id": None},
        {"request_id": "authreq-2", "contest_id": "beta-2026",
         "role": "main", "published_run_card_id": None},
    ]

    def fake_publish(contest_id):
        state["publish_calls"] += 1
        ids = [f"card-{r['request_id']}" for r in lifecycle_db.deferred
               if not r["published_run_card_id"]]
        for r in lifecycle_db.deferred:
            r["published_run_card_id"] = r["published_run_card_id"] or \
                f"card-{r['request_id']}"
        state["published"].extend(ids)
        return ids

    monkeypatch.setattr(cn, "publish_deferred", fake_publish)
    return state


class TestCloseContestPublishesWithheldResults:
    def test_withheld_results_publish_before_the_ranking_is_built(
            self, lifecycle_db, ranked, deferred_node):
        order = []
        import mt_eval_harness.contest_node as cn
        import mt_eval_harness.contest_rank as cr
        real_publish = cn.publish_deferred
        real_build = cr.build_ranking
        monkeypatch_publish = lambda cid: (order.append("publish"),
                                           real_publish(cid))[1]
        monkeypatch_build = lambda cid, **kw: (order.append("rank"),
                                               real_build(cid, **kw))[1]
        cn.publish_deferred = monkeypatch_publish
        cr.build_ranking = monkeypatch_build
        try:
            close_contest("beta-2026", auto_confirm=True)
        finally:
            cn.publish_deferred = real_publish
            cr.build_ranking = real_build
        assert order == ["publish", "rank"], \
            "a close that ranked first would freeze a ranking missing the " \
            "results it is about to publish"
        assert deferred_node["published"] == ["card-authreq-1",
                                              "card-authreq-2"]

    def test_snapshot_records_what_the_close_published(
            self, lifecycle_db, ranked, deferred_node):
        close_contest("beta-2026", auto_confirm=True)
        snap = lifecycle_db.patches[0]["metadata"]["final_ranking"]
        block = snap["deferred_results"]
        assert block["published_count"] == 2
        assert block["published_at_close"] == ["card-authreq-1",
                                               "card-authreq-2"]
        assert "before the ranking was built" in block["published_note"].lower()

    def test_force_never_skips_publication(self, lifecycle_db, ranked,
                                           deferred_node):
        """Decision D3: --force is about ranking what is in flight, never
        about withholding a score the contest owes."""
        ranked["_pending"] = [{"intake_id": "intake-1", "status": "scoring"}]
        close_contest("beta-2026", auto_confirm=True, force=True)
        assert deferred_node["published"] == ["card-authreq-1",
                                              "card-authreq-2"]

    def test_reveal_identities_defaults_true_and_is_recorded(
            self, lifecycle_db, ranked, deferred_node):
        close_contest("beta-2026", auto_confirm=True)
        assert ranked["reveal_identities"] is True
        snap = lifecycle_db.patches[0]["metadata"]["final_ranking"]
        assert snap["identity_policy"]["revealed_at_close"] is True

    def test_reveal_identities_can_be_turned_off_explicitly(
            self, lifecycle_db, ranked, deferred_node):
        close_contest("beta-2026", auto_confirm=True,
                      reveal_identities=False)
        assert ranked["reveal_identities"] is False
        snap = lifecycle_db.patches[0]["metadata"]["final_ranking"]
        assert snap["identity_policy"]["revealed_at_close"] is False
        assert "NOT revealed" in snap["identity_policy"]["close_note"]

    def test_a_contest_with_nothing_withheld_closes_untouched(
            self, lifecycle_db, ranked, monkeypatch):
        import mt_eval_harness.contest_node as cn
        called = []
        monkeypatch.setattr(cn, "publish_deferred",
                            lambda cid: called.append(cid) or [])
        close_contest("beta-2026", auto_confirm=True)
        assert called == [], "no withheld rows → no publication pass"
        snap = lifecycle_db.patches[0]["metadata"]["final_ranking"]
        assert snap["deferred_results"]["published_count"] == 0

    def test_a_short_publication_stops_before_freezing(
            self, lifecycle_db, ranked, deferred_node, monkeypatch):
        import mt_eval_harness.contest_node as cn
        monkeypatch.setattr(cn, "publish_deferred",
                            lambda cid: ["card-authreq-1"])
        with pytest.raises(RuntimeError, match="Expected to publish 2"):
            close_contest("beta-2026", auto_confirm=True)
        assert not lifecycle_db.patches, \
            "the ranking must not freeze while a withheld result is unaccounted for"

    def test_missing_074_is_loud_not_a_silent_close(self, lifecycle_db,
                                                    ranked, monkeypatch):
        import mt_eval_harness.contest_node as cn

        def no_table(contest_id, *, session=None):
            raise cn.PublicationPolicyError(
                "contest beta-2026: withheld results cannot be read: this "
                "database has no public.contest_deferred_results table — "
                "migration 074 …")
        monkeypatch.setattr(cn, "fetch_deferred_count", no_table)
        with pytest.raises(RuntimeError, match="migration 074"):
            close_contest("beta-2026", auto_confirm=True)
        assert not lifecycle_db.patches


class TestCloseContestHandoverGate:
    """Founder ruling R1: prizes ride on HANDOVER of the method to the
    sovereign host. A contest that promised that gate is not closed around
    it."""

    def _gated(self, lifecycle_db, ok, reason="no handover recorded"):
        lifecycle_db.contest["metadata"] = {
            "primary_metric": "chrf_plus_plus",
            "prize_terms": {"declared": True,
                            "release_required_before_scores": True},
        }
        import mt_eval_harness.contest_rank as cr
        return cr, {"ok": ok, "reason": reason}

    def test_failing_gate_refuses_the_close(self, lifecycle_db, ranked,
                                            monkeypatch):
        cr, verdict = self._gated(lifecycle_db, False)
        monkeypatch.setattr(cr, "handover_gate_ok", lambda ranking: verdict,
                            raising=False)
        with pytest.raises(RuntimeError, match="gate those terms require"):
            close_contest("beta-2026", auto_confirm=True)
        assert not lifecycle_db.patches

    def test_force_closes_anyway_and_says_so(self, lifecycle_db, ranked,
                                             monkeypatch, capsys):
        cr, verdict = self._gated(lifecycle_db, False)
        monkeypatch.setattr(cr, "handover_gate_ok", lambda ranking: verdict,
                            raising=False)
        close_contest("beta-2026", auto_confirm=True, force=True)
        assert lifecycle_db.patches
        assert "handover gate NOT satisfied" in capsys.readouterr().out

    def test_passing_gate_closes_quietly(self, lifecycle_db, ranked,
                                         monkeypatch):
        cr, verdict = self._gated(lifecycle_db, True, "")
        monkeypatch.setattr(cr, "handover_gate_ok", lambda ranking: verdict,
                            raising=False)
        close_contest("beta-2026", auto_confirm=True)
        assert lifecycle_db.patches

    def test_gate_is_not_consulted_without_the_promise(self, lifecycle_db,
                                                      ranked, monkeypatch):
        import mt_eval_harness.contest_rank as cr
        calls = []
        monkeypatch.setattr(
            cr, "handover_gate_ok",
            lambda ranking: calls.append(1) or {"ok": True}, raising=False)
        close_contest("beta-2026", auto_confirm=True)
        assert calls == [], \
            "a contest that promised no handover gate is not gated by one"


# ---------------------------------------------------------------------------
# The rank/close/export CLI surface (lane L2): the policy flags, the identity
# gate, and the CSV the export writes.
# ---------------------------------------------------------------------------

class TestRankingCliSurface:
    _run_cli = TestContestCliRefusals._run_cli
    _run_cli_ok = staticmethod(TestLifecycleCliRefusals._run_cli_ok)

    @pytest.fixture(autouse=True)
    def _no_cached_session(self, monkeypatch):
        import mt_eval_harness.auth as auth_mod
        monkeypatch.setattr(auth_mod, "get_cached_session", lambda: None)

    def test_reveal_identities_refused_without_standing(self, monkeypatch, capsys,
                                                        lifecycle_db):
        """An anonymity promise anyone could lift is not a promise."""
        lifecycle_db.contest["metadata"] = {"anonymize_until_close": True}
        code = self._run_cli(monkeypatch, ["contest", "rank", "beta-2026",
                                           "--reveal-identities", "--no-segments"])
        assert code == 1
        err = capsys.readouterr().err
        assert "Refusing --reveal-identities" in err and "Traceback" not in err

    def test_reveal_identities_allowed_with_the_organizer_assertion(
            self, monkeypatch, capsys, lifecycle_db):
        lifecycle_db.contest["metadata"] = {"anonymize_until_close": True}
        code = self._run_cli_ok(monkeypatch,
                                ["contest", "rank", "beta-2026", "--json",
                                 "--no-segments", "--reveal-identities",
                                 "--i-am-the-organizer"])
        assert code == 0
        data = json.loads(capsys.readouterr().out)
        assert data["identity_policy"]["anonymized"] is False

    def test_rank_json_carries_the_policy_keys(self, monkeypatch, capsys,
                                               lifecycle_db):
        lifecycle_db.contest["metadata"] = {}
        code = self._run_cli_ok(monkeypatch, ["contest", "rank", "beta-2026",
                                              "--json", "--no-segments"])
        assert code == 0
        data = json.loads(capsys.readouterr().out)
        for key in ("tie_policy", "identity_policy", "prize_eligibility",
                    "contrastive", "by_phase", "by_track", "deferred_results",
                    "exclusions"):
            assert key in data, key

    def test_loosening_a_frozen_policy_is_a_clean_refusal(self, monkeypatch,
                                                          capsys, lifecycle_db):
        lifecycle_db.contest["metadata"] = {"alpha": 0.01}
        code = self._run_cli(monkeypatch, ["contest", "rank", "beta-2026",
                                           "--alpha", "0.5", "--no-segments"])
        assert code == 1
        err = capsys.readouterr().err
        assert "TIGHTEN" in err and "Traceback" not in err

    def test_close_passes_reveal_identities_by_keyword(self, monkeypatch,
                                                       lifecycle_db):
        import mt_eval_harness.contest as contest_mod
        seen = {}
        monkeypatch.setattr(contest_mod, "close_contest",
                            lambda cid, **kw: seen.update(kw, contest_id=cid))
        self._run_cli_ok(monkeypatch, ["contest", "close", "beta-2026", "--yes",
                                       "--reveal-identities"])
        assert seen["contest_id"] == "beta-2026"
        assert seen["reveal_identities"] is True
        seen.clear()
        self._run_cli_ok(monkeypatch, ["contest", "close", "beta-2026", "--yes",
                                       "--no-reveal-identities"])
        assert seen["reveal_identities"] is False

    def test_close_without_the_flag_leaves_the_default_to_close_contest(
            self, monkeypatch, lifecycle_db):
        import mt_eval_harness.contest as contest_mod
        seen = {}
        monkeypatch.setattr(contest_mod, "close_contest",
                            lambda cid, **kw: seen.update(kw))
        self._run_cli_ok(monkeypatch, ["contest", "close", "beta-2026", "--yes"])
        assert "reveal_identities" not in seen
        # The tie flags are passed through as None so the contest's frozen
        # policy governs inside build_ranking.
        assert seen["tie_test"] is None and seen["alpha"] is None
        assert seen["n_resamples"] is None and seen["seed"] is None

    def test_export_csv_has_the_declaration_columns(self, monkeypatch, capsys,
                                                    lifecycle_db, tmp_path):
        from mt_eval_harness.contest_rank import CSV_COLUMNS
        lifecycle_db.contest["status"] = "closed"
        lifecycle_db.contest["metadata"] = {"final_ranking": _canned_ranking(),
                                            "closed_at": "2026-09-06T12:00:00Z"}
        out = tmp_path / "r.csv"
        code = self._run_cli_ok(monkeypatch, ["contest", "export", "beta-2026",
                                              "--format", "csv", "--out", str(out)])
        assert code == 0
        header = out.read_text().splitlines()[0]
        assert header == ",".join(CSV_COLUMNS)
        for column in ("is_primary", "track", "phase", "rank_min", "rank_max",
                       "prize_eligible", "submitter_label_or_pseudonym"):
            assert column in header, column
        assert "submitted_by" not in header
