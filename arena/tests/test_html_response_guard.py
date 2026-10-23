"""
Tests for graceful handling of non-JSON (HTML) endpoint responses.

Prelaunch-audit bug: the champollion.dev holding page answers HTTP 200 with
text/html, and every fetch that expected JSON (queue.json, registry.json,
the language-card REST API) crashed with a raw JSONDecodeError traceback.
These tests use local fixture responses (no network) to verify each fetch
site now fails with a clear, typed, one-line error instead.

Covers:
    - net_json.parse_json_response (the shared strict parser)
    - queue_runner.load_queue + run_from_args ('mt-eval queue')
    - config._load_remote_registry (remote registry fetch)
    - language_cards_remote._get_json (Supabase card index/detail)
"""

import json
import urllib.request

import pytest

from mt_eval_harness.net_json import NotJSONResponseError, parse_json_response


# ---------------------------------------------------------------------------
# Fixture responses — what a gated/down champollion.dev actually serves
# ---------------------------------------------------------------------------

HOLDING_PAGE = b"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>champollion.dev</title></head>
<body>
  <main><h1>champollion.dev</h1><p>Access is currently gated.</p></main>
</body>
</html>
"""

QUEUE_JSON = json.dumps({
    "metadata": {"priority_model": "ecv-v3"},
    "items": [],
}).encode("utf-8")


class _FakeResponse:
    """Minimal stand-in for the urlopen response context manager."""

    def __init__(self, body: bytes, content_type: str):
        self._body = body
        self.headers = {"Content-Type": content_type}

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _fake_urlopen(body: bytes, content_type: str):
    def opener(*args, **kwargs):
        return _FakeResponse(body, content_type)
    return opener


# ---------------------------------------------------------------------------
# The shared strict parser
# ---------------------------------------------------------------------------

class TestParseJsonResponse:

    def test_valid_json_passes(self):
        assert parse_json_response(b'{"a": 1}') == {"a": 1}

    def test_html_content_type_raises(self):
        with pytest.raises(NotJSONResponseError) as ei:
            parse_json_response(QUEUE_JSON, content_type="text/html")
        assert ei.value.got == "an HTML page"

    def test_html_body_without_content_type_raises(self):
        with pytest.raises(NotJSONResponseError) as ei:
            parse_json_response(HOLDING_PAGE)
        assert ei.value.got == "an HTML page"

    def test_garbage_body_raises_non_json(self):
        with pytest.raises(NotJSONResponseError) as ei:
            parse_json_response(b"502 Bad Gateway")
        assert ei.value.got == "a non-JSON response"

    def test_is_a_value_error(self):
        """Existing `except (..., ValueError)` degradation paths must
        keep catching it."""
        assert issubclass(NotJSONResponseError, ValueError)


# ---------------------------------------------------------------------------
# Queue fetch — 'mt-eval queue'
# ---------------------------------------------------------------------------

class TestQueueFetch:

    def test_load_queue_html_url_raises_clear_error(self, monkeypatch):
        from mt_eval_harness.queue_runner import QueueUnavailableError, load_queue
        monkeypatch.setattr(
            urllib.request, "urlopen",
            _fake_urlopen(HOLDING_PAGE, "text/html; charset=utf-8"),
        )
        with pytest.raises(QueueUnavailableError) as ei:
            load_queue("https://champollion.dev/queue.json")
        msg = str(ei.value)
        assert "champollion.dev is not serving the queue" in msg
        assert "an HTML page" in msg
        assert "gated or down" in msg
        assert "\n" not in msg  # one line

    def test_load_queue_valid_json_url_still_works(self, monkeypatch):
        from mt_eval_harness.queue_runner import load_queue
        monkeypatch.setattr(
            urllib.request, "urlopen",
            _fake_urlopen(QUEUE_JSON, "application/json"),
        )
        queue = load_queue("https://champollion.dev/queue.json")
        assert queue["items"] == []

    def test_load_queue_local_html_file_raises_clear_error(self, tmp_path):
        from mt_eval_harness.queue_runner import QueueUnavailableError, load_queue
        bad = tmp_path / "queue.json"
        bad.write_bytes(HOLDING_PAGE)
        with pytest.raises(QueueUnavailableError):
            load_queue(str(bad))

    def test_run_from_args_exits_1_with_one_line_error(
        self, monkeypatch, capsys,
    ):
        """'mt-eval queue' against a gated host: exit code 1, one clear
        stderr line, no traceback."""
        import argparse
        from mt_eval_harness.queue_runner import add_queue_arguments, run_from_args

        monkeypatch.setattr(
            urllib.request, "urlopen",
            _fake_urlopen(HOLDING_PAGE, "text/html; charset=utf-8"),
        )
        parser = argparse.ArgumentParser()
        add_queue_arguments(parser)
        args = parser.parse_args(
            ["--top", "1", "--queue", "https://champollion.dev/queue.json"]
        )
        rc = run_from_args(args)
        assert rc == 1
        err = capsys.readouterr().err
        assert "champollion.dev is not serving the queue" in err
        assert "gated or down" in err


# ---------------------------------------------------------------------------
# Remote registry fetch
# ---------------------------------------------------------------------------

class TestRegistryFetch:

    def test_html_registry_degrades_with_clear_warning(
        self, monkeypatch, tmp_path, caplog,
    ):
        """An HTML holding page at registry.json → None (no fabricated
        registry), with a warning that says why — not a JSONDecodeError."""
        import logging

        import mt_eval_harness.config as config_mod

        monkeypatch.delenv("MT_EVAL_NO_REMOTE_REGISTRY", raising=False)
        # No cache on disk: point the cache at an absent tmp file.
        monkeypatch.setattr(
            config_mod, "_REGISTRY_CACHE", tmp_path / "no-cache" / "registry.json"
        )
        monkeypatch.setattr(
            urllib.request, "urlopen",
            _fake_urlopen(HOLDING_PAGE, "text/html; charset=utf-8"),
        )
        with caplog.at_level(logging.WARNING, logger="mt_eval_harness.config"):
            result = config_mod._load_remote_registry()
        assert result is None
        warning_text = " ".join(r.getMessage() for r in caplog.records)
        assert "an HTML page" in warning_text
        assert "gated or down" in warning_text

    def test_html_registry_falls_back_to_stale_cache(
        self, monkeypatch, tmp_path,
    ):
        """With a stale cache present, an HTML response reuses the cache."""
        import os
        import time

        import mt_eval_harness.config as config_mod

        monkeypatch.delenv("MT_EVAL_NO_REMOTE_REGISTRY", raising=False)
        cache = tmp_path / "registry.json"
        cache.write_text(json.dumps({"datasets": [{"id": "cached"}]}))
        # Age the cache past the TTL so the network path is exercised.
        old = time.time() - config_mod._REGISTRY_CACHE_TTL - 60
        os.utime(cache, (old, old))
        monkeypatch.setattr(config_mod, "_REGISTRY_CACHE", cache)
        monkeypatch.setattr(
            urllib.request, "urlopen",
            _fake_urlopen(HOLDING_PAGE, "text/html; charset=utf-8"),
        )
        result = config_mod._load_remote_registry()
        assert result == {"datasets": [{"id": "cached"}]}


# ---------------------------------------------------------------------------
# Language-card REST fetches
# ---------------------------------------------------------------------------

class TestLanguageCardsFetch:

    def test_get_json_html_raises_unavailable_without_retrying(
        self, monkeypatch,
    ):
        """HTML won't heal on retry: fail immediately with the clear,
        typed LanguageCardsUnavailable (never a raw JSONDecodeError)."""
        import mt_eval_harness.language_cards_remote as lcr

        monkeypatch.setattr(
            urllib.request, "urlopen",
            _fake_urlopen(HOLDING_PAGE, "text/html; charset=utf-8"),
        )
        sleeps: list[float] = []
        monkeypatch.setattr(lcr.time, "sleep", lambda s: sleeps.append(s))
        with pytest.raises(lcr.LanguageCardsUnavailable) as ei:
            lcr._get_json("https://example.supabase.co/rest/v1/x", timeout=5)
        msg = str(ei.value)
        assert "an HTML page" in msg
        assert "gated or down" in msg
        assert sleeps == []  # no futile retries

    def test_fetch_index_rows_surfaces_clear_reason(self, monkeypatch):
        import mt_eval_harness.language_cards_remote as lcr

        monkeypatch.setattr(
            urllib.request, "urlopen",
            _fake_urlopen(HOLDING_PAGE, "text/html; charset=utf-8"),
        )
        monkeypatch.setattr(lcr.time, "sleep", lambda s: None)
        with pytest.raises(lcr.LanguageCardsUnavailable) as ei:
            lcr.fetch_index_rows(timeout=5)
        assert "an HTML page" in str(ei.value)

    def test_fetch_detail_card_surfaces_clear_reason(self, monkeypatch):
        import mt_eval_harness.language_cards_remote as lcr

        monkeypatch.setattr(
            urllib.request, "urlopen",
            _fake_urlopen(HOLDING_PAGE, "text/html; charset=utf-8"),
        )
        monkeypatch.setattr(lcr.time, "sleep", lambda s: None)
        with pytest.raises(lcr.LanguageCardsUnavailable) as ei:
            lcr.fetch_detail_card("fra", timeout=5)
        msg = str(ei.value)
        assert "an HTML page" in msg
        # Not double-wrapped into the generic "Could not fetch" message
        assert "LanguageCardsUnavailable" not in msg
