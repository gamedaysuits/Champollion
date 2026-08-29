"""Anonymous publishing lane (founder directive 2026-07-13).

OAuth is OPTIONAL, not required, to contribute through the public queue:

  · queue_runner Step 1 is a three-way door — sign in (attributed) /
    continue anonymously / --no-publish;
  · non-interactive runs (curl | bash) default to anonymous with a loud
    echo, and returning donors with cached credentials stay attributed;
  · the anonymous publish path POSTs the submit-run edge function
    (env-overridable URL) instead of the authed REST upsert;
  · until the founder deploys that function, the path fails HONESTLY —
    the report path and re-publish command are always named, work is
    never silently lost.

These tests mock all HTTP; nothing here touches the network.
"""

import io
import json
import urllib.error
import urllib.request

import pytest

from mt_eval_harness import auth, publish, queue_runner
from test_publish import _write_pair  # noqa: F401  (shared fixture builder)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _http_error(code: int, body: dict | str = "") -> urllib.error.HTTPError:
    payload = body if isinstance(body, str) else json.dumps(body)
    return urllib.error.HTTPError(
        "https://example.test/functions/v1/submit-run",
        code, "err", {}, io.BytesIO(payload.encode()),
    )


class _FakeHTTPResponse:
    def __init__(self, payload: dict):
        self._data = json.dumps(payload).encode()

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class _FakeStdin:
    def __init__(self, tty: bool):
        self._tty = tty

    def isatty(self):
        return self._tty


@pytest.fixture(autouse=True)
def _no_ambient_credentials(monkeypatch, tmp_path):
    """Isolate every test from the developer's real ~/.mt-eval/auth.json
    and any ambient env credentials/overrides."""
    monkeypatch.setattr(auth, "TOKEN_PATH", tmp_path / "auth.json")
    monkeypatch.delenv("MT_EVAL_REFRESH_TOKEN", raising=False)
    monkeypatch.delenv("MT_EVAL_ANON_SUBMIT_URL", raising=False)
    monkeypatch.delenv("MT_EVAL_ALLOW_PROD", raising=False)


@pytest.fixture(autouse=True)
def _never_interactive_login(monkeypatch):
    """get_cached_session must NEVER reach the browser OAuth flow."""
    def boom(*a, **k):
        raise AssertionError("interactive login flow reached — must not happen")
    monkeypatch.setattr(auth, "_interactive_login", boom)
    monkeypatch.setattr(auth, "_oauth_login", boom)


# ---------------------------------------------------------------------------
# auth.get_cached_session — non-interactive credential reuse only
# ---------------------------------------------------------------------------

class TestGetCachedSession:

    def test_no_tokens_returns_none(self):
        assert auth.get_cached_session() is None

    def test_valid_cached_access_token_reused_without_network(self, monkeypatch):
        import time as _time
        session = {
            "access_token": "tok",
            "expires_at": _time.time() + 3600,
            "user": {"email": "d@example.com"},
        }
        auth._save_tokens(session)

        def boom(*a, **k):
            raise AssertionError("refresh attempted for a still-valid token")
        monkeypatch.setattr(auth, "_refresh_session", boom)
        got = auth.get_cached_session()
        assert got is not None and got["access_token"] == "tok"

    def test_expired_token_refresh_failure_returns_none(self, monkeypatch):
        auth._save_tokens({
            "access_token": "tok", "expires_at": 0, "refresh_token": "r",
        })
        monkeypatch.setattr(
            auth, "_refresh_session",
            lambda rt: (_ for _ in ()).throw(RuntimeError("expired")),
        )
        assert auth.get_cached_session() is None

    def test_expired_token_refresh_success(self, monkeypatch):
        auth._save_tokens({
            "access_token": "old", "expires_at": 0, "refresh_token": "r",
        })
        fresh = {"access_token": "new", "refresh_token": "r2",
                 "user": {"email": "d@example.com"}}
        monkeypatch.setattr(auth, "_refresh_session", lambda rt: dict(fresh))
        got = auth.get_cached_session()
        assert got["access_token"] == "new"

    def test_env_refresh_token_wins(self, monkeypatch):
        monkeypatch.setenv("MT_EVAL_REFRESH_TOKEN", "env-r")
        seen = []

        def fake_refresh(rt):
            seen.append(rt)
            return {"access_token": "envtok", "user": {}}
        monkeypatch.setattr(auth, "_refresh_session", fake_refresh)
        got = auth.get_cached_session()
        assert got["access_token"] == "envtok"
        assert seen == ["env-r"]

    def test_env_refresh_token_failure_returns_none(self, monkeypatch):
        monkeypatch.setenv("MT_EVAL_REFRESH_TOKEN", "stale")
        monkeypatch.setattr(
            auth, "_refresh_session",
            lambda rt: (_ for _ in ()).throw(RuntimeError("bad token")),
        )
        assert auth.get_cached_session() is None


# ---------------------------------------------------------------------------
# queue_runner._publishing_door — the three-way door
# ---------------------------------------------------------------------------

class _Args:
    def __init__(self, anonymous=False):
        self.anonymous = anonymous


class TestPublishingDoor:

    def test_anonymous_flag_skips_auth_entirely(self, monkeypatch, capsys):
        def boom(*a, **k):
            raise AssertionError("auth touched despite --anonymous")
        monkeypatch.setattr("mt_eval_harness.auth.get_cached_session", boom)
        monkeypatch.setattr("mt_eval_harness.auth.get_session", boom)

        door = queue_runner._publishing_door(_Args(anonymous=True))
        assert door == (None, True)
        out = capsys.readouterr().out
        assert "ANONYMOUSLY" in out
        assert "'anonymous'" in out

    def test_cached_session_stays_attributed(self, monkeypatch, capsys):
        monkeypatch.setattr(
            "mt_eval_harness.auth.get_cached_session",
            lambda: {"access_token": "t",
                     "user": {"user_metadata": {"preferred_username": "donor1"},
                              "email": "d@example.com"}},
        )
        door = queue_runner._publishing_door(_Args())
        assert door == ("donor1", False)
        assert "Signed in as donor1" in capsys.readouterr().out

    def test_non_interactive_defaults_to_anonymous_loudly(
        self, monkeypatch, capsys
    ):
        monkeypatch.setattr("mt_eval_harness.auth.get_cached_session",
                            lambda: None)
        monkeypatch.setattr("sys.stdin", _FakeStdin(tty=False))
        door = queue_runner._publishing_door(_Args())
        assert door == (None, True)
        out = capsys.readouterr().out
        # The loud echo: what will publish and as whom.
        assert "ANONYMOUSLY" in out
        assert "public" in out and "leaderboard" in out
        assert "not attributed to you" in out
        # And how to become attributed instead.
        assert "MT_EVAL_REFRESH_TOKEN" in out

    def test_menu_choice_2_is_anonymous(self, monkeypatch, capsys):
        monkeypatch.setattr("mt_eval_harness.auth.get_cached_session",
                            lambda: None)
        monkeypatch.setattr("sys.stdin", _FakeStdin(tty=True))
        monkeypatch.setattr("builtins.input", lambda *a: "2")
        door = queue_runner._publishing_door(_Args())
        assert door == (None, True)
        assert "ANONYMOUSLY" in capsys.readouterr().out

    def test_menu_choice_1_signs_in(self, monkeypatch):
        monkeypatch.setattr("mt_eval_harness.auth.get_cached_session",
                            lambda: None)
        monkeypatch.setattr("sys.stdin", _FakeStdin(tty=True))
        monkeypatch.setattr("builtins.input", lambda *a: "1")
        monkeypatch.setattr(
            "mt_eval_harness.auth.get_session",
            lambda: {"access_token": "t",
                     "user": {"user_metadata": {"preferred_username": "donor2"},
                              "email": "d@example.com"}},
        )
        assert queue_runner._publishing_door(_Args()) == ("donor2", False)

    def test_failed_signin_offers_anonymous_fallback(self, monkeypatch, capsys):
        monkeypatch.setattr("mt_eval_harness.auth.get_cached_session",
                            lambda: None)
        monkeypatch.setattr("sys.stdin", _FakeStdin(tty=True))
        answers = iter(["1", ""])  # choose sign-in, then accept the fallback
        monkeypatch.setattr("builtins.input", lambda *a: next(answers))

        def failing_session():
            raise SystemExit(1)
        monkeypatch.setattr("mt_eval_harness.auth.get_session", failing_session)

        door = queue_runner._publishing_door(_Args())
        assert door == (None, True)
        out = capsys.readouterr().out
        assert "Sign-in didn't complete" in out
        assert "ANONYMOUSLY" in out

    def test_failed_signin_declined_fallback_aborts(self, monkeypatch):
        monkeypatch.setattr("mt_eval_harness.auth.get_cached_session",
                            lambda: None)
        monkeypatch.setattr("sys.stdin", _FakeStdin(tty=True))
        answers = iter(["1", "n"])
        monkeypatch.setattr("builtins.input", lambda *a: next(answers))

        def failing_session():
            raise SystemExit(1)
        monkeypatch.setattr("mt_eval_harness.auth.get_session", failing_session)
        assert queue_runner._publishing_door(_Args()) is None

    def test_ctrl_c_at_menu_aborts(self, monkeypatch):
        monkeypatch.setattr("mt_eval_harness.auth.get_cached_session",
                            lambda: None)
        monkeypatch.setattr("sys.stdin", _FakeStdin(tty=True))

        def interrupted(*a):
            raise KeyboardInterrupt
        monkeypatch.setattr("builtins.input", interrupted)
        assert queue_runner._publishing_door(_Args()) is None


# ---------------------------------------------------------------------------
# publish._post_anonymous — the edge-function POST, mocked HTTP
# ---------------------------------------------------------------------------

class TestPostAnonymous:

    def test_success_posts_payload_to_function_url(self, monkeypatch):
        captured = {}

        def fake_urlopen(req, timeout=0):
            captured["url"] = req.full_url
            captured["payload"] = json.loads(req.data)
            return _FakeHTTPResponse({"ok": True, "id": "card-1",
                                      "entries_published": 2})
        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

        result = publish._post_anonymous(
            {"id": "card-1", "submitter": "anonymous"},
            [{"entry_id": "e1"}, {"entry_id": "e2"}],
            "/tmp/r_report.json",
        )
        assert result["ok"] is True
        assert captured["url"] == publish._anon_submit_url()
        assert captured["payload"]["run_card_row"]["id"] == "card-1"
        assert len(captured["payload"]["entries"]) == 2

    def test_url_env_override(self, monkeypatch):
        monkeypatch.setenv("MT_EVAL_ANON_SUBMIT_URL",
                           "https://staging.example/functions/v1/submit-run")
        assert publish._anon_submit_url() == (
            "https://staging.example/functions/v1/submit-run")

    def test_404_fails_honestly_function_not_deployed(self, monkeypatch, capsys):
        monkeypatch.setattr(
            urllib.request, "urlopen",
            lambda *a, **k: (_ for _ in ()).throw(_http_error(404, "not found")),
        )
        with pytest.raises(SystemExit) as exc:
            publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        assert exc.value.code != 0
        out = capsys.readouterr().out
        assert "not yet enabled" in out
        # Work is never silently lost: path + re-publish command are named.
        assert "/tmp/r_report.json" in out
        assert "mt-eval publish" in out

    def test_hard_429_raises_typed_rate_limit_error(self, monkeypatch):
        # The intake's real hourly-cap response (retry_after_seconds=3600,
        # functions/submit-run/index.ts) must NOT be a SystemExit — it raises
        # AnonymousRateLimitError so the queue lane can defer and the CLI can
        # render the recovery honestly (test_publish_rate_limit.py covers
        # both surfaces + the retry/backoff behavior).
        body = {"ok": False,
                "error": "anonymous limit reached — sign in for unlimited",
                "retry_after_seconds": 3600}
        monkeypatch.setattr(
            urllib.request, "urlopen",
            lambda *a, **k: (_ for _ in ()).throw(_http_error(429, body)),
        )
        with pytest.raises(publish.AnonymousRateLimitError) as exc:
            publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        assert exc.value.retry_after_seconds == 3600
        assert "sign in" in str(exc.value)

    def test_4xx_shows_rejection_body(self, monkeypatch, capsys):
        monkeypatch.setattr(
            urllib.request, "urlopen",
            lambda *a, **k: (_ for _ in ()).throw(
                _http_error(400, {"ok": False, "error": "QUARANTINED DATASET"})),
        )
        with pytest.raises(SystemExit):
            publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        out = capsys.readouterr().out
        assert "QUARANTINED DATASET" in out
        assert "/tmp/r_report.json" in out

    def test_5xx_retries_then_succeeds(self, monkeypatch):
        monkeypatch.setattr(publish.time, "sleep", lambda s: None)
        calls = []

        def flaky(req, timeout=0):
            calls.append(1)
            if len(calls) < 3:
                raise _http_error(503, "unavailable")
            return _FakeHTTPResponse({"ok": True, "id": "c"})
        monkeypatch.setattr(urllib.request, "urlopen", flaky)
        result = publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        assert result["ok"] is True
        assert len(calls) == 3

    def test_network_down_exhausts_retries_honestly(self, monkeypatch, capsys):
        monkeypatch.setattr(publish.time, "sleep", lambda s: None)
        monkeypatch.setattr(
            urllib.request, "urlopen",
            lambda *a, **k: (_ for _ in ()).throw(
                urllib.error.URLError("connection refused")),
        )
        with pytest.raises(SystemExit):
            publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        out = capsys.readouterr().out
        assert "failed after" in out
        assert "/tmp/r_report.json" in out


# ---------------------------------------------------------------------------
# publish_to_supabase(anonymous=True) — never authenticates; honest gating
# ---------------------------------------------------------------------------

class TestPublishAnonymousLane:

    def test_never_authenticates_and_forces_anonymous_submitter(
        self, tmp_path, monkeypatch, capsys
    ):
        report_path = _write_pair(tmp_path, "anonRun")
        monkeypatch.setattr(publish, "_is_prod_target", lambda: False)

        def boom_session(*a, **k):
            raise AssertionError("get_session() called on the anonymous lane")
        monkeypatch.setattr(publish, "get_session", boom_session)
        monkeypatch.setattr(publish, "_fetch_existing_card", lambda cid: None)

        captured = {}

        def fake_post(row, entry_rows, rp):
            captured["row"] = row
            captured["entry_rows"] = entry_rows
            return {"ok": True, "id": row["id"], "entries_published": 0}
        monkeypatch.setattr(publish, "_post_anonymous", fake_post)

        result = publish.publish_to_supabase(
            report_path, auto_confirm=True, anonymous=True,
        )
        assert result["ok"] is True
        assert captured["row"]["submitter"] == "anonymous"
        assert captured["row"]["trust"] == "unverified"
        # test_dataset is unregistered → the content gate withholds entries
        # client-side (scores-only), exactly like the authed path.
        assert captured["entry_rows"] == []
        out = capsys.readouterr().out
        assert "ANONYMOUSLY" in out
        assert "Published to leaderboard" in out
        assert "'anonymous'" in out

    def test_already_published_result_is_idempotent_success(
        self, tmp_path, monkeypatch, capsys
    ):
        report_path = _write_pair(tmp_path, "anonDup")
        monkeypatch.setattr(publish, "_is_prod_target", lambda: False)
        monkeypatch.setattr(publish, "_fetch_existing_card", lambda cid: None)
        monkeypatch.setattr(
            publish, "_post_anonymous",
            lambda row, entries, rp: {"ok": True, "already_published": True,
                                      "id": row["id"]},
        )
        result = publish.publish_to_supabase(
            report_path, auto_confirm=True, anonymous=True,
        )
        assert result["already_published"] is True
        assert "already on the leaderboard" in capsys.readouterr().out

    def test_prod_guard_still_applies_to_anonymous(
        self, tmp_path, monkeypatch, capsys
    ):
        # C1 semantics are unchanged: a direct `mt-eval publish --anonymous`
        # against prod still needs --prod / MT_EVAL_ALLOW_PROD. (The queue
        # lane passes yes_prod explicitly after its own confirmations.)
        report_path = _write_pair(tmp_path, "anonProd")
        monkeypatch.setattr(publish, "_is_prod_target", lambda: True)

        def boom(*a, **k):
            raise AssertionError("network reached despite prod refusal")
        monkeypatch.setattr(urllib.request, "urlopen", boom)
        monkeypatch.setattr(publish, "_post_anonymous", boom)

        with pytest.raises(SystemExit) as exc:
            publish.publish_to_supabase(
                report_path, auto_confirm=True, anonymous=True,
            )
        assert exc.value.code != 0
        assert "Refusing to write to PRODUCTION" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# queue lane wiring — _auto_publish carries the door's decision
# ---------------------------------------------------------------------------

class TestAutoPublishWiring:

    @pytest.fixture(autouse=True)
    def _open_publish_gate(self):
        """Publish-gate state is module-level — isolate every test."""
        queue_runner._reset_publish_gate()
        yield
        queue_runner._reset_publish_gate()

    def test_passes_anonymous_and_prod_optin(self, monkeypatch):
        captured = {}

        def fake_publish(report_path, **kwargs):
            captured.update(kwargs)
            return {"id": "x"}
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase", fake_publish)

        assert queue_runner._auto_publish("/tmp/x_report.json", "eng>zul",
                                          anonymous=True).ok is True
        assert captured["anonymous"] is True
        assert captured["auto_confirm"] is True
        # The queue lane IS the explicit prod opt-in (its banner + spend
        # confirmation announce the publish) — without this the C1 guard
        # refused every donate-lane auto-publish on prod.
        assert captured["yes_prod"] is True

    def test_attributed_lane_passes_anonymous_false(self, monkeypatch):
        captured = {}

        def fake_publish(report_path, **kwargs):
            captured.update(kwargs)
            return {"id": "x"}
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase", fake_publish)
        assert queue_runner._auto_publish("/tmp/x_report.json").ok is True
        assert captured["anonymous"] is False
        assert captured["yes_prod"] is True

    def test_failure_hint_names_the_anonymous_republish(
        self, monkeypatch, capsys
    ):
        def boom(*a, **k):
            raise SystemExit(1)
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase", boom)
        outcome = queue_runner._auto_publish("/tmp/x_report.json", "eng>zul",
                                             anonymous=True)
        assert outcome.ok is False
        out = capsys.readouterr().out
        assert "mt-eval publish /tmp/x_report.json --anonymous" in out


# ---------------------------------------------------------------------------
# CLI surface — the flags parse
# ---------------------------------------------------------------------------

class TestCliFlags:

    def test_publish_anonymous_flag(self):
        from mt_eval_harness.cli import build_parser
        args = build_parser().parse_args(
            ["publish", "r_report.json", "--anonymous"])
        assert args.anonymous is True

    def test_publish_default_is_attributed(self):
        from mt_eval_harness.cli import build_parser
        args = build_parser().parse_args(["publish", "r_report.json"])
        assert args.anonymous is False

    def test_queue_anonymous_flag(self):
        from mt_eval_harness.cli import build_parser
        args = build_parser().parse_args(
            ["queue", "--top", "1", "--anonymous"])
        assert args.anonymous is True
