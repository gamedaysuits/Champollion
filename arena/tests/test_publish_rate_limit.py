"""Anonymous-intake rate limiting — retry, defer, and the ONE re-publish
command (regression suite for the 2026-07-19 $100/581-item wave).

That wave completed 349 runs but published only 76: the submit-run edge
function rate-limits per IP (default 5/hour; 429 with JSON body
``{ok:false, error, retry_after_seconds: 3600|86400}`` and NO Retry-After
header — functions/submit-run/index.ts), and the queue runner treated every
429 as a terminal per-item failure, printing 273 scattered 3-line
re-publish hints. The fixes pinned here:

  · _post_anonymous retries 5xx / network / short-window 429s with
    exponential backoff + FULL JITTER, serializes POSTs process-wide, and
    raises AnonymousRateLimitError (typed, carries retry_after_seconds) on
    a hard hourly/daily-cap 429 instead of hammering a closed window;
  · queue_runner._auto_publish arms a shared defer gate on that error —
    later completions skip the network entirely until a probe interval
    elapses — and the batch summary prints ONE block with ONE command;
  · `mt-eval publish --republish-dir DIR` re-publishes a whole batch,
    skipping already-published runs and stopping honestly at the cap;
  · the stale success copy (retired /mesh?hl= URL, "regenerates nightly /
    every few minutes" — no automated regen exists) is gone.

These tests mock all HTTP; nothing here touches the network.
"""

import inspect
import json
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from mt_eval_harness import cli, publish, queue_runner
from test_anonymous_publish import _FakeHTTPResponse, _http_error


@pytest.fixture(autouse=True)
def _isolated_gate_and_env(monkeypatch):
    """Publish-gate state is module-level; open it around every test. Also
    keep the intake URL override out of the environment."""
    queue_runner._reset_publish_gate()
    monkeypatch.delenv("MT_EVAL_ANON_SUBMIT_URL", raising=False)
    monkeypatch.delenv("MT_EVAL_ALLOW_PROD", raising=False)
    yield
    queue_runner._reset_publish_gate()


# ---------------------------------------------------------------------------
# publish._backoff_delay — exponential base + full jitter
# ---------------------------------------------------------------------------

class TestBackoffJitter:

    def test_delay_stays_inside_the_jitter_band(self):
        # Base ladder is UPSERT_BACKOFF_S = (1, 2, 4); each step spreads over
        # [base, 2*base) so N clients retrying in lockstep de-collide.
        for attempt, base in ((1, 1), (2, 2), (3, 4), (4, 4)):
            for _ in range(200):
                d = publish._backoff_delay(attempt)
                assert base <= d < 2 * base, (attempt, d)

    def test_delays_are_not_constant(self):
        # Jitter must actually jitter — 50 draws all equal would mean the
        # lockstep ladder is back.
        draws = {publish._backoff_delay(1) for _ in range(50)}
        assert len(draws) > 1


# ---------------------------------------------------------------------------
# publish._parse_rate_limit — the intake's ACTUAL 429 contract
# ---------------------------------------------------------------------------

class TestParseRateLimit:

    def test_edge_function_body_shape(self):
        # The real response: JSON body with error + retry_after_seconds,
        # NO Retry-After header (functions/submit-run/index.ts).
        exc = _http_error(429, {"ok": False,
                                "error": "hourly cap — sign in for unlimited",
                                "retry_after_seconds": 3600})
        body = exc.read().decode()
        msg, ra = publish._parse_rate_limit(exc, body)
        assert msg == "hourly cap — sign in for unlimited"
        assert ra == 3600.0

    def test_global_daily_window(self):
        exc = _http_error(429, {"ok": False, "error": "daily community cap",
                                "retry_after_seconds": 86400})
        _msg, ra = publish._parse_rate_limit(exc, exc.read().decode())
        assert ra == 86400.0

    def test_body_without_window_is_none(self):
        exc = _http_error(429, {"ok": False, "error": "slow down"})
        msg, ra = publish._parse_rate_limit(exc, exc.read().decode())
        assert msg == "slow down"
        assert ra is None

    def test_non_json_body_falls_back_to_retry_after_header(self):
        # A fronting proxy/CDN may 429 with a plain body + header instead.
        exc = urllib.error.HTTPError(
            "https://example.test/functions/v1/submit-run", 429, "err",
            {"Retry-After": "3600"}, None,
        )
        msg, ra = publish._parse_rate_limit(exc, "Too Many Requests")
        assert msg == "Too Many Requests"
        assert ra == 3600.0

    def test_body_window_wins_over_header(self):
        exc = urllib.error.HTTPError(
            "https://example.test/functions/v1/submit-run", 429, "err",
            {"Retry-After": "1"}, None,
        )
        body = json.dumps({"error": "cap", "retry_after_seconds": 3600})
        _msg, ra = publish._parse_rate_limit(exc, body)
        assert ra == 3600.0

    def test_garbage_is_transient(self):
        exc = urllib.error.HTTPError("u", 429, "err", {}, None)
        msg, ra = publish._parse_rate_limit(exc, "<html>busy</html>")
        assert ra is None
        assert msg == "<html>busy</html>"


# ---------------------------------------------------------------------------
# publish._post_anonymous — retry / defer behavior on 429
# ---------------------------------------------------------------------------

class TestPostAnonymousRateLimit:

    def test_hard_429_raises_immediately_without_retry_or_sleep(
        self, monkeypatch
    ):
        # retry_after_seconds=3600 is the intake's hourly cap: sleeping it
        # inline would stall a batch for an hour PER ITEM. One POST, no
        # sleep, typed error.
        sleeps: list[float] = []
        monkeypatch.setattr(publish.time, "sleep", sleeps.append)
        calls: list[int] = []

        def limited(req, timeout=0):
            calls.append(1)
            raise _http_error(429, {"ok": False, "error": "hourly cap",
                                    "retry_after_seconds": 3600})
        monkeypatch.setattr(urllib.request, "urlopen", limited)

        with pytest.raises(publish.AnonymousRateLimitError) as exc:
            publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        assert exc.value.retry_after_seconds == 3600
        assert len(calls) == 1
        assert sleeps == []

    def test_short_window_429_is_retried_and_honors_the_window(
        self, monkeypatch
    ):
        sleeps: list[float] = []
        monkeypatch.setattr(publish.time, "sleep", sleeps.append)
        calls: list[int] = []

        def flaky(req, timeout=0):
            calls.append(1)
            if len(calls) == 1:
                raise _http_error(429, {"ok": False, "error": "brief burst",
                                        "retry_after_seconds": 5})
            return _FakeHTTPResponse({"ok": True, "id": "c"})
        monkeypatch.setattr(urllib.request, "urlopen", flaky)

        result = publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        assert result["ok"] is True
        assert len(calls) == 2
        # The wait honors the server's stated 5s window (≥, thanks to jitter).
        assert len(sleeps) == 1 and sleeps[0] >= 5

    def test_windowless_429_exhausts_retries_then_defers_typed(
        self, monkeypatch
    ):
        # No retry_after in body, no header → treated as transient, retried
        # with backoff; if EVERY attempt lands on 429 the window is closed:
        # raise the typed error (so the queue defers), never SystemExit.
        monkeypatch.setattr(publish.time, "sleep", lambda s: None)
        calls: list[int] = []

        def limited(req, timeout=0):
            calls.append(1)
            raise _http_error(429, "Too Many Requests")
        monkeypatch.setattr(urllib.request, "urlopen", limited)

        with pytest.raises(publish.AnonymousRateLimitError) as exc:
            publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        assert len(calls) == publish.ANON_POST_MAX_ATTEMPTS
        assert exc.value.retry_after_seconds is None

    def test_429_then_5xx_exhaustion_is_not_mislabelled_rate_limit(
        self, monkeypatch, capsys
    ):
        # A 429 followed by 5xx-only failures must exit as a generic
        # exhaustion (SystemExit + recovery hint), not a rate-limit defer —
        # the LAST failure is what we know about the endpoint.
        monkeypatch.setattr(publish.time, "sleep", lambda s: None)
        codes = iter([429, 503, 503])

        def failing(req, timeout=0):
            raise _http_error(next(codes), "busy")
        monkeypatch.setattr(urllib.request, "urlopen", failing)

        with pytest.raises(SystemExit):
            publish._post_anonymous({"id": "c"}, [], "/tmp/r_report.json")
        out = capsys.readouterr().out
        assert "failed after" in out
        assert "/tmp/r_report.json" in out

    def test_posts_are_serialized_process_wide(self, monkeypatch):
        # The queue's worker pool completes items in bursts; the intake POST
        # must go through one at a time. Holding the lock must block a
        # concurrent _post_anonymous until released.
        monkeypatch.setattr(
            urllib.request, "urlopen",
            lambda *a, **k: _FakeHTTPResponse({"ok": True, "id": "c"}),
        )
        done = threading.Event()
        result: dict = {}

        def worker():
            result["r"] = publish._post_anonymous(
                {"id": "c"}, [], "/tmp/r_report.json")
            done.set()

        with publish._ANON_PUBLISH_LOCK:
            t = threading.Thread(target=worker, daemon=True)
            t.start()
            assert not done.wait(0.3), "POST ran while another held the lock"
        assert done.wait(2.0), "POST never ran after the lock was released"
        t.join(2.0)
        assert result["r"]["ok"] is True


# ---------------------------------------------------------------------------
# queue_runner._auto_publish — the shared defer gate
# ---------------------------------------------------------------------------

class TestPublishDeferGate:

    def test_hard_rate_limit_arms_gate_and_skips_network_while_gated(
        self, monkeypatch, capsys
    ):
        calls: list[int] = []

        def limited(*a, **k):
            calls.append(1)
            raise publish.AnonymousRateLimitError("hourly cap", 3600)
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase", limited)

        o1 = queue_runner._auto_publish("/tmp/a_report.json", "eng>aaa",
                                        anonymous=True)
        assert o1.ok is False and o1.rate_limited is True
        assert o1.retry_after == 3600
        assert len(calls) == 1

        # The gate holds for the PROBE interval, NOT the server's full hour —
        # the per-IP window is rolling, so slots free before retry_after.
        until = queue_runner._PUBLISH_GATE["until"]
        now = time.time()
        assert 0 < until - now <= queue_runner.PUBLISH_DEFER_PROBE_S + 1

        o2 = queue_runner._auto_publish("/tmp/b_report.json", "eng>bbb",
                                        anonymous=True)
        assert o2.rate_limited is True
        assert len(calls) == 1, "gated call must not touch the network"

        out = capsys.readouterr().out
        # Announced ONCE (on arming); gated items are silent inline — no
        # scattered per-item re-publish hints for rate-limited results.
        assert out.count("rate limit is reached") == 1
        assert "Re-publish later with" not in out

    def test_short_server_window_shortens_the_hold(self, monkeypatch):
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase",
            lambda *a, **k: (_ for _ in ()).throw(
                publish.AnonymousRateLimitError("blip", 42)),
        )
        queue_runner._auto_publish("/tmp/a_report.json", anonymous=True)
        until = queue_runner._PUBLISH_GATE["until"]
        assert 0 < until - time.time() <= 43

    def test_gate_expiry_probes_the_window_again(self, monkeypatch):
        calls: list[int] = []
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase",
            lambda *a, **k: calls.append(1) or {"id": "x"},
        )
        with queue_runner._PUBLISH_GATE_LOCK:
            queue_runner._PUBLISH_GATE["until"] = time.time() - 1
        outcome = queue_runner._auto_publish("/tmp/a_report.json",
                                             anonymous=True)
        assert outcome.ok is True
        assert len(calls) == 1

    def test_reset_opens_the_gate(self):
        with queue_runner._PUBLISH_GATE_LOCK:
            queue_runner._PUBLISH_GATE["until"] = time.time() + 999
        queue_runner._reset_publish_gate()
        assert queue_runner._PUBLISH_GATE["until"] == 0.0

    def test_generic_failure_is_not_rate_limited_and_keeps_its_hint(
        self, monkeypatch, capsys
    ):
        def boom(*a, **k):
            raise SystemExit(1)
        monkeypatch.setattr(
            "mt_eval_harness.publish.publish_to_supabase", boom)
        outcome = queue_runner._auto_publish("/tmp/a_report.json", "eng>aaa",
                                             anonymous=True)
        assert outcome.ok is False and outcome.rate_limited is False
        # Genuine failures are rare and item-specific — the per-item hint
        # stays for them.
        assert "Re-publish later with" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# queue_runner._render_unpublished_block — ONE block, ONE command
# ---------------------------------------------------------------------------

class TestUnpublishedSummaryBlock:

    def test_single_command_covers_the_whole_batch(self):
        lines = queue_runner._render_unpublished_block(
            268, 5, anonymous=True)
        text = "\n".join(lines)
        assert text.count("mt-eval publish") == 1, \
            "exactly ONE re-publish command — never a hint per item"
        assert ("mt-eval publish --republish-dir "
                "eval/logs/harness/queue --anonymous --prod") in text
        assert "273 result(s)" in text
        assert "268 deferred" in text
        assert "5 failed" in text
        # The honest cap note + the unlimited path.
        assert "per hour" in text
        assert "sign in" in text

    def test_attributed_command_drops_the_anonymous_flag(self):
        text = "\n".join(queue_runner._render_unpublished_block(
            0, 3, anonymous=False))
        assert ("mt-eval publish --republish-dir "
                "eval/logs/harness/queue --prod") in text
        assert "--anonymous" not in text
        assert "3 failed" in text


# ---------------------------------------------------------------------------
# publish.find_republishable_reports / republish_directory
# ---------------------------------------------------------------------------

def _touch_report(root: Path, rel: str, mtime: float) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("{}", encoding="utf-8")
    import os
    os.utime(p, (mtime, mtime))
    return p


class TestFindRepublishableReports:

    def test_recursive_oldest_first_reports_only(self, tmp_path):
        now = time.time()
        newer = _touch_report(tmp_path, "002_b/run_2_report.json", now)
        older = _touch_report(tmp_path, "001_a/run_1_report.json", now - 100)
        _touch_report(tmp_path, "001_a/run_1.json", now)   # run log, not report
        (tmp_path / "notes.txt").write_text("x", encoding="utf-8")

        found = publish.find_republishable_reports(tmp_path)
        assert found == [older, newer]

    def test_missing_dir_is_empty(self, tmp_path):
        assert publish.find_republishable_reports(tmp_path / "nope") == []

    def test_single_report_file_accepted(self, tmp_path):
        p = _touch_report(tmp_path, "run_1_report.json", time.time())
        assert publish.find_republishable_reports(p) == [p]
        assert publish.find_republishable_reports(tmp_path / "notes.txt") == []


class TestRepublishDirectory:

    @pytest.fixture(autouse=True)
    def _non_prod(self, monkeypatch):
        monkeypatch.setattr(publish, "_is_prod_target", lambda: False)

    def _three_reports(self, tmp_path):
        now = time.time()
        return [
            _touch_report(tmp_path, f"{i:03d}_x/run_{i}_report.json",
                          now - 100 + i)
            for i in (1, 2, 3)
        ]

    def test_counts_published_and_already(self, tmp_path, monkeypatch):
        self._three_reports(tmp_path)
        results = iter([
            {"id": "a"},
            {"id": "b", "already_published": True},
            {"id": "c"},
        ])
        seen: list = []

        def fake_publish(rp, **kwargs):
            seen.append((Path(rp), kwargs["anonymous"], kwargs["yes_prod"]))
            return next(results)
        monkeypatch.setattr(publish, "publish_to_supabase", fake_publish)

        summary = publish.republish_directory(
            tmp_path, anonymous=True, yes_prod=True)
        assert summary["total"] == 3
        assert summary["published"] == 2
        assert summary["already"] == 1
        assert summary["failed"] == [] and summary["deferred"] == []
        # Flags carried through to every report, oldest first.
        assert [s[1] for s in seen] == [True, True, True]
        assert [s[2] for s in seen] == [True, True, True]
        assert [s[0].name for s in seen] == [
            "run_1_report.json", "run_2_report.json", "run_3_report.json"]

    def test_stops_honestly_at_the_rate_limit(self, tmp_path, monkeypatch,
                                              capsys):
        reports = self._three_reports(tmp_path)
        calls: list[int] = []

        def fake_publish(rp, **kwargs):
            calls.append(1)
            if len(calls) == 2:
                raise publish.AnonymousRateLimitError("hourly cap", 3600)
            return {"id": "x"}
        monkeypatch.setattr(publish, "publish_to_supabase", fake_publish)

        summary = publish.republish_directory(tmp_path, anonymous=True)
        assert len(calls) == 2, "must stop POSTing once the window is closed"
        assert summary["published"] == 1
        # The report that hit the cap AND everything after it remain queued.
        assert summary["deferred"] == [str(reports[1]), str(reports[2])]
        out = capsys.readouterr().out
        assert "rate limit is reached" in out
        assert "2 report(s)" in out
        assert "nothing is lost" in out

    def test_per_report_failure_continues(self, tmp_path, monkeypatch):
        self._three_reports(tmp_path)
        calls: list[int] = []

        def fake_publish(rp, **kwargs):
            calls.append(1)
            if len(calls) == 1:
                raise SystemExit(1)   # e.g. integrity-gate rejection
            return {"id": "x"}
        monkeypatch.setattr(publish, "publish_to_supabase", fake_publish)

        summary = publish.republish_directory(tmp_path)
        assert len(calls) == 3
        assert summary["published"] == 2
        assert len(summary["failed"]) == 1
        assert summary["failed"][0][1] == "exit 1"

    def test_prod_guard_refuses_once_before_any_post(self, tmp_path,
                                                     monkeypatch, capsys):
        self._three_reports(tmp_path)
        monkeypatch.setattr(publish, "_is_prod_target", lambda: True)

        def boom(*a, **k):
            raise AssertionError("publish reached despite prod refusal")
        monkeypatch.setattr(publish, "publish_to_supabase", boom)

        with pytest.raises(SystemExit) as exc:
            publish.republish_directory(tmp_path, anonymous=True)
        assert exc.value.code == 2
        assert "PRODUCTION" in capsys.readouterr().out

    def test_empty_dir_is_a_noop(self, tmp_path, capsys):
        summary = publish.republish_directory(tmp_path)
        assert summary["total"] == 0
        assert "nothing to publish" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# CLI surface — --republish-dir wiring and the honest rate-limit exit
# ---------------------------------------------------------------------------

class TestRepublishCli:

    def test_flags_parse(self):
        args = cli.build_parser().parse_args(
            ["publish", "--republish-dir", "eval/logs/harness/queue",
             "--anonymous", "--prod"])
        assert args.republish_dir == "eval/logs/harness/queue"
        assert args.report_path is None
        assert args.anonymous is True and args.yes_prod is True

    def _run_main(self, monkeypatch, argv):
        monkeypatch.setattr(sys, "argv", ["mt-eval"] + argv)
        with pytest.raises(SystemExit) as exc:
            cli.main()
        return exc.value.code

    def test_neither_report_nor_dir_exits_2(self, monkeypatch, capsys):
        assert self._run_main(monkeypatch, ["publish"]) == 2
        assert "--republish-dir" in capsys.readouterr().err

    def test_both_report_and_dir_exits_2(self, monkeypatch, capsys):
        code = self._run_main(
            monkeypatch, ["publish", "r_report.json", "--republish-dir", "d"])
        assert code == 2
        assert "not both" in capsys.readouterr().err

    def test_republish_dir_dispatches_and_exit_code_tracks_leftovers(
        self, monkeypatch
    ):
        seen = {}

        def fake_republish(root, **kwargs):
            seen["root"] = root
            seen.update(kwargs)
            return {"total": 2, "published": 2, "already": 0,
                    "failed": [], "deferred": []}
        monkeypatch.setattr("mt_eval_harness.publish.republish_directory",
                            fake_republish)
        code = self._run_main(
            monkeypatch,
            ["publish", "--republish-dir", "somedir", "--anonymous",
             "--prod"])
        assert code == 0
        assert seen["root"] == "somedir"
        assert seen["anonymous"] is True and seen["yes_prod"] is True

        monkeypatch.setattr(
            "mt_eval_harness.publish.republish_directory",
            lambda root, **k: {"total": 2, "published": 1, "already": 0,
                               "failed": [], "deferred": ["x"]},
        )
        code = self._run_main(
            monkeypatch, ["publish", "--republish-dir", "somedir"])
        assert code == 1, "deferred work → non-zero so cron can re-run"

    def test_single_report_rate_limit_exits_honestly(self, monkeypatch,
                                                     capsys):
        def limited(*a, **k):
            raise publish.AnonymousRateLimitError(
                "hourly cap — sign in for unlimited", 3600)
        monkeypatch.setattr("mt_eval_harness.publish.publish_to_supabase",
                            limited)
        code = self._run_main(
            monkeypatch,
            ["publish", "r_report.json", "--anonymous", "--prod"])
        assert code == 1
        out = capsys.readouterr().out
        assert "rate-limited" in out
        assert "r_report.json" in out
        assert "mt-eval publish r_report.json --anonymous --prod" in out
        assert "sign in" in out


# ---------------------------------------------------------------------------
# Success copy — the retired /mesh URL and invented regen cadences stay gone
# ---------------------------------------------------------------------------

class TestStaleSuccessCopyRemoved:
    """champollion.dev/mesh 301s to / (cli/website/vercel.json) and no ?hl=
    param exists; no automated mesh regen exists either — the copy must not
    promise 'nightly' or 'every few minutes'."""

    @pytest.fixture(params=[queue_runner, publish])
    def module_source(self, request):
        return Path(inspect.getfile(request.param)).read_text(
            encoding="utf-8")

    def test_no_retired_mesh_url(self, module_source):
        assert "champollion.dev/mesh" not in module_source

    def test_no_invented_regen_cadence(self, module_source):
        assert "regenerates nightly" not in module_source
        assert "regenerates every few minutes" not in module_source
        assert "mesh refreshes shortly" not in module_source
