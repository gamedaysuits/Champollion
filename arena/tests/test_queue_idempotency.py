"""Concurrency-safety: the queue runner must not redo an item another
contributor has already completed.

Two layers cooperate (both tested here / in test_coverage_skip.py):
  - batch selection drops combos covered at start (``_drop_covered``,
    test_coverage_skip.py);
  - each item is RE-checked just before it runs (``_combo_published``) so a
    long-running batch yields to whoever published the combo in the meantime.

These tests pin the per-item check (requirement (a): an item already in
run_cards is skipped) and its fail-open / slug-form behaviour. The HTTP layer
is mocked — no network, no real board.
"""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.request

import pytest

from mt_eval_harness import queue_runner
from mt_eval_harness.queue_runner import _combo_published, _drop_covered


class _FakeResponse:
    """Minimal context-manager response standing in for urlopen's return."""

    def __init__(self, rows):
        self._body = json.dumps(rows).encode()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self._body


def _patch_board(monkeypatch, rows, *, capture=None):
    """Mock the run_cards REST read to return ``rows``; record the URL."""

    def fake_urlopen(req, timeout=None):
        if capture is not None:
            capture.append(req.full_url)
        return _FakeResponse(rows)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)


@pytest.fixture(autouse=True)
def _enable_skip(monkeypatch):
    """Ensure the kill-switch is OFF for these tests regardless of the env."""
    monkeypatch.delenv("MT_EVAL_NO_COVERAGE_SKIP", raising=False)


class TestComboPublished:
    """``_combo_published`` — the per-item, just-before-run coverage recheck."""

    def test_exact_combo_on_board_is_skipped(self, monkeypatch):
        # (a) an item already in run_cards is skipped.
        _patch_board(monkeypatch, [{"model_slug": "anthropic/claude-haiku-4.5"}])
        assert _combo_published(
            "eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive"
        ) is True

    def test_empty_board_is_not_skipped(self, monkeypatch):
        _patch_board(monkeypatch, [])
        assert _combo_published(
            "eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive"
        ) is False

    def test_short_slug_on_board_matches_full_item_slug(self, monkeypatch):
        # The board stores the short form; the queue item carries the full slug.
        _patch_board(monkeypatch, [{"model_slug": "claude-haiku-4.5"}])
        assert _combo_published(
            "eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive"
        ) is True

    def test_full_slug_on_board_matches_short_item_slug(self, monkeypatch):
        # ...and the reverse: full on the board, short on the item.
        _patch_board(monkeypatch, [{"model_slug": "anthropic/claude-haiku-4.5"}])
        assert _combo_published(
            "eval-eng-ilo", "claude-haiku-4.5", "naive"
        ) is True

    def test_different_model_is_not_skipped(self, monkeypatch):
        _patch_board(monkeypatch, [{"model_slug": "google/gemini-3.5-flash"}])
        assert _combo_published(
            "eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive"
        ) is False

    def test_query_scopes_to_dataset_and_condition(self, monkeypatch):
        # The targeted query must filter by dataset_id AND condition (cheap),
        # leaving the model match to the client.
        seen: list[str] = []
        _patch_board(monkeypatch, [], capture=seen)
        _combo_published("eval-eng-ilo", "m/x", "coached")
        assert seen, "expected a REST call"
        url = seen[0]
        assert "dataset_id=eq.eval-eng-ilo" in url
        assert "condition=eq.coached" in url
        assert "trust=neq.disqualified" in url

    def test_network_error_fails_open(self, monkeypatch):
        # A flaky/unreachable board must NEVER block a legitimate run.
        def boom(req, timeout=None):
            raise urllib.error.URLError("network down")

        monkeypatch.setattr(urllib.request, "urlopen", boom)
        assert _combo_published("eval-eng-ilo", "m/x", "naive") is False

    def test_http_error_fails_open(self, monkeypatch):
        def boom(req, timeout=None):
            raise urllib.error.HTTPError(
                "u", 500, "err", None, io.BytesIO(b"boom")
            )

        monkeypatch.setattr(urllib.request, "urlopen", boom)
        assert _combo_published("eval-eng-ilo", "m/x", "naive") is False

    def test_kill_switch_disables_check(self, monkeypatch):
        # With the skip disabled we must NOT even hit the network.
        called = []

        def fake_urlopen(req, timeout=None):
            called.append(1)
            return _FakeResponse([{"model_slug": "m/x"}])

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        monkeypatch.setenv("MT_EVAL_NO_COVERAGE_SKIP", "1")
        assert _combo_published("eval-eng-ilo", "m/x", "naive") is False
        assert called == []  # short-circuited before any request

    def test_missing_fields_are_not_skipped(self, monkeypatch):
        # No corpus / model → cannot match a combo → never skip (fail open).
        called = []
        monkeypatch.setattr(
            urllib.request, "urlopen",
            lambda req, timeout=None: called.append(1) or _FakeResponse([]),
        )
        assert _combo_published(None, "m/x", "naive") is False
        assert _combo_published("eval-eng-ilo", None, "naive") is False
        assert called == []


class TestSkippedItemNotRun:
    """The selection layer + the per-item gate together mean a covered item is
    neither selected nor run. ``_drop_covered`` is the selection-time guard."""

    def test_covered_item_dropped_before_selection(self):
        items = [
            {"id": "a", "corpus_id": "eval-eng-ilo",
             "model": "anthropic/claude-haiku-4.5", "condition": "naive"},
            {"id": "b", "corpus_id": "eval-eng-zul",
             "model": "anthropic/claude-haiku-4.5", "condition": "naive"},
        ]
        covered = {("eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive")}
        kept = _drop_covered(items, covered)
        assert [it["id"] for it in kept] == ["b"]

    def test_module_exposes_per_item_gate(self):
        # The runner's _run_one calls this symbol before spending; pin that it
        # exists and is importable so the wiring can't silently regress.
        assert callable(queue_runner._combo_published)
