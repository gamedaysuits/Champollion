"""Tests for pipeline.py -- shared cross-cutting concerns.

Key behaviors validated:
    - enrich_results merges corpus metadata into raw results
    - enrich_results handles missing corpus entries gracefully
    - enrich_results estimates cost (returns 0 when pricing is None)
    - build_run_log assembles correct schema with all fields
    - write_run_log creates file on disk with valid JSON
    - report_progress prints at 10% intervals and at completion
    - apply_hooks skips errored results
    - apply_hooks runs hooks in order
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from mt_eval_harness.config import RunConfig
from mt_eval_harness.pipeline import (
    apply_hooks,
    enrich_results,
    build_run_log,
    write_run_log,
    report_progress,
)


# ---------------------------------------------------------------------------
# Result enrichment
# ---------------------------------------------------------------------------

class TestEnrichResults:
    """Verify result enrichment merges corpus data correctly."""

    def _make_results(self, count=3):
        """Generate raw result dicts."""
        return [
            {
                "id": i,
                "predicted": f"translation_{i}",
                "usage": {"prompt_tokens": 100, "completion_tokens": 10},
                "latency_s": 0.5,
                "tool_calls": [],
                "tool_call_count": 0,
                "error": None,
                "metadata": {},
            }
            for i in range(count)
        ]

    def _make_corpus(self, count=3):
        """Generate corpus entries with source/target/segment."""
        return [
            {
                "id": i,
                "source": f"source_{i}",
                "reference": f"expected_{i}",
                "segment": f"seg_{i % 2}",
                "difficulty": i + 1,
            }
            for i in range(count)
        ]

    def test_merges_source_and_expected(self):
        """Enriched results should include source and expected from corpus."""
        results = self._make_results(2)
        corpus = self._make_corpus(2)
        enriched, _, _ = enrich_results(results, corpus, RunConfig())
        assert enriched[0]["source"] == "source_0"
        assert enriched[0]["expected"] == "expected_0"
        assert enriched[1]["source"] == "source_1"

    def test_preserves_predicted(self):
        """Enriched results should keep the predicted translation."""
        results = self._make_results(1)
        corpus = self._make_corpus(1)
        enriched, _, _ = enrich_results(results, corpus, RunConfig())
        assert enriched[0]["predicted"] == "translation_0"

    def test_includes_segment_and_difficulty(self):
        """Corpus segment and difficulty should carry through."""
        results = self._make_results(1)
        corpus = self._make_corpus(1)
        enriched, _, _ = enrich_results(results, corpus, RunConfig())
        assert enriched[0]["segment"] == "seg_0"
        assert enriched[0]["difficulty"] == 1

    def test_handles_missing_corpus_entry(self):
        """If a result ID is not in corpus, fields default to empty."""
        results = [{"id": 999, "predicted": "orphan", "usage": {}, "latency_s": 0.1}]
        corpus = self._make_corpus(1)  # Only has id=0
        enriched, _, _ = enrich_results(results, corpus, RunConfig())
        assert enriched[0]["source"] == ""
        assert enriched[0]["expected"] == ""

    def test_cost_with_none_pricing(self):
        """An un-priceable model yields UNKNOWN cost (None), never a fake $0.

        A model in neither the live table nor the embedded fallback cannot be
        costed; the honest result is None (cost unknown), not 0.0 — otherwise an
        un-priceable run is indistinguishable from a genuinely free one and
        would unfairly win cost-adjusted ranking.
        """
        config = RunConfig(model="unknown/nonexistent-model-12345")
        results = self._make_results(1)
        corpus = self._make_corpus(1)
        enriched, total_cost, _ = enrich_results(results, corpus, config, pricing=None)
        assert total_cost is None
        # The per-entry cost must also be None (unknown), not 0.0.
        assert enriched[0]["cost_usd"] is None

    def test_custom_field_names(self):
        """Custom source/target fields should be used for enrichment."""
        config = RunConfig(source_field="english", target_field="cree_sro")
        corpus = [{"id": 0, "english": "Hello", "cree_sro": "tanisi", "segment": "basic"}]
        results = [{"id": 0, "predicted": "tanisi", "usage": {}, "latency_s": 0.5}]
        enriched, _, _ = enrich_results(results, corpus, config)
        assert enriched[0]["source"] == "Hello"
        assert enriched[0]["expected"] == "tanisi"


# ---------------------------------------------------------------------------
# RunLog assembly
# ---------------------------------------------------------------------------

class TestBuildRunLog:
    """Verify RunLog dict has all required fields."""

    def test_required_fields_present(self):
        """RunLog must contain all fields the dashboard and tester expect."""
        config = RunConfig()
        enriched = [{"id": 0, "predicted": "test"}]
        log = build_run_log(
            config, enriched, "run_123", "2026-01-01T00:00:00Z",
            elapsed_s=1.5, cache_hits=0, total_cost=0.01,
        )
        assert log["run_id"] == "run_123"
        assert log["total_entries"] == 1
        assert log["cache_hits"] == 0
        assert log["total_cost_usd"] == 0.01
        assert log["elapsed_s"] == 1.5
        assert "harness_version" in log
        assert "config" in log
        assert "results" in log
        assert "timestamp_start" in log
        assert "timestamp_end" in log

    def test_config_snapshot(self):
        """RunLog should embed a config snapshot for reproducibility."""
        config = RunConfig(model="google/gemini-3.1-pro", batch_size=5)
        log = build_run_log(config, [], "run_x", "2026-01-01", 0, 0, 0)
        assert log["config"]["model"] == "google/gemini-3.1-pro"
        assert log["config"]["batch_size"] == 5

    def test_zero_entries_ok(self):
        """An empty results list should produce a valid log."""
        log = build_run_log(RunConfig(), [], "empty", "2026-01-01", 0, 0, 0)
        assert log["total_entries"] == 0
        assert log["results"] == []


# ---------------------------------------------------------------------------
# Write run log to disk
# ---------------------------------------------------------------------------

class TestWriteRunLog:
    """Verify RunLog file writing."""

    def test_creates_file(self, tmp_path):
        """write_run_log should create a JSON file in the output directory."""
        log = {"run_id": "test_write", "results": []}
        path = write_run_log(log, str(tmp_path / "output"))
        assert path.exists()
        assert path.name == "test_write.json"

    def test_creates_directory(self, tmp_path):
        """Should create output directory if it doesn't exist."""
        nested = tmp_path / "deep" / "nested" / "output"
        log = {"run_id": "nested_test", "results": []}
        path = write_run_log(log, str(nested))
        assert path.exists()
        assert nested.is_dir()

    def test_valid_json(self, tmp_path):
        """Written file should be valid JSON with correct content."""
        log = {
            "run_id": "json_test",
            "results": [{"id": 0, "predicted": "Bonjour"}],
        }
        path = write_run_log(log, str(tmp_path / "output"))
        loaded = json.loads(path.read_text(encoding="utf-8"))
        assert loaded["run_id"] == "json_test"
        assert loaded["results"][0]["predicted"] == "Bonjour"

    def test_preserves_unicode(self, tmp_path):
        """ensure_ascii=False should preserve non-ASCII characters."""
        log = {
            "run_id": "unicode_test",
            "results": [{"id": 0, "predicted": "tanisi"}],
        }
        path = write_run_log(log, str(tmp_path / "output"))
        content = path.read_text(encoding="utf-8")
        # The SRO character should be preserved, not escaped
        assert "tanisi" in content


# ---------------------------------------------------------------------------
# Progress reporting
# ---------------------------------------------------------------------------

class TestReportProgress:
    """Verify progress prints at correct intervals."""

    def test_prints_at_completion(self, capsys):
        """Should print when done == total."""
        report_progress(10, 10)
        captured = capsys.readouterr()
        assert "10/10" in captured.out
        assert "100%" in captured.out

    def test_no_print_on_zero_total(self, capsys):
        """Should not crash or print with total=0."""
        report_progress(0, 0)
        captured = capsys.readouterr()
        assert captured.out == ""

    def test_prints_at_10_percent(self, capsys):
        """Should print at 10% interval."""
        report_progress(10, 100)
        captured = capsys.readouterr()
        assert "10/100" in captured.out


# ---------------------------------------------------------------------------
# Hook application
# ---------------------------------------------------------------------------

class MockHook:
    """Minimal hook that uppercases the prediction."""

    def __init__(self, suffix=""):
        self.suffix = suffix
        self.call_count = 0

    async def process(self, entry, result, config, api_fn=None):
        self.call_count += 1
        result["predicted"] = result.get("predicted", "") + self.suffix
        return result


class TestApplyHooks:
    """Verify hook application behavior."""

    def test_skips_errored_results(self):
        """Hooks should NOT run on results with errors."""
        hook = MockHook(suffix="_HOOKED")
        result = {"predicted": "test", "error": "API timeout"}
        entry = {"id": 0}

        loop = asyncio.new_event_loop()
        out = loop.run_until_complete(apply_hooks(entry, result, [hook], RunConfig()))
        loop.close()

        assert out["predicted"] == "test"  # Unchanged
        assert hook.call_count == 0

    def test_applies_hook_on_success(self):
        """Hooks should run on results without errors."""
        hook = MockHook(suffix="_HOOKED")
        result = {"predicted": "test", "error": None}
        entry = {"id": 0}

        loop = asyncio.new_event_loop()
        out = loop.run_until_complete(apply_hooks(entry, result, [hook], RunConfig()))
        loop.close()

        assert out["predicted"] == "test_HOOKED"
        assert hook.call_count == 1

    def test_hooks_run_in_order(self):
        """Multiple hooks should run in registration order."""
        hook_a = MockHook(suffix="_A")
        hook_b = MockHook(suffix="_B")
        result = {"predicted": "base"}
        entry = {"id": 0}

        loop = asyncio.new_event_loop()
        out = loop.run_until_complete(
            apply_hooks(entry, result, [hook_a, hook_b], RunConfig())
        )
        loop.close()

        # hook_a runs first: "base" -> "base_A"
        # hook_b runs second: "base_A" -> "base_A_B"
        assert out["predicted"] == "base_A_B"

    def test_no_hooks_passthrough(self):
        """Empty hooks list should pass result through unchanged."""
        result = {"predicted": "test"}
        entry = {"id": 0}

        loop = asyncio.new_event_loop()
        out = loop.run_until_complete(apply_hooks(entry, result, [], RunConfig()))
        loop.close()

        assert out["predicted"] == "test"


class TestCachedCostSplit:
    """Cached entries report $0 actual spend with the original price
    alongside (by design)."""

    def test_cached_entries_split_out_of_actual_spend(self):
        from mt_eval_harness.pipeline import enrich_results
        from mt_eval_harness.config import RunConfig

        corpus = [{"id": "a", "source": "x", "reference": "y"},
                  {"id": "b", "source": "x2", "reference": "y2"}]
        usage = {"prompt_tokens": 10, "completion_tokens": 10, "cost": 0.5}
        results = [
            {"id": "a", "predicted": "p", "usage": dict(usage), "cached": True},
            {"id": "b", "predicted": "p2", "usage": dict(usage)},
        ]
        enriched, total, cached = enrich_results(results, corpus, RunConfig())
        assert cached > 0 and total > 0
        assert abs(cached - total) < 1e-9  # same usage → same price, split
        assert enriched[0]["cached"] is True
        assert enriched[1]["cached"] is False
