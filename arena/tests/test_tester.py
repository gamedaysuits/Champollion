"""Tests for tester.py — EntryMetrics schema and analyze_run.

Key behaviors validated:
    - EntryMetrics uses 'source' field (not 'english')
    - analyze_run reads from 'source' key in RunLog entries
    - analyze_run computes exact match correctly
    - analyze_run produces per-segment breakdown
"""

import json

import pytest

from mt_eval_harness.tester import EntryMetrics, analyze_run


class TestEntryMetricsSchema:
    """Verify the dataclass schema uses language-agnostic field names."""

    def test_has_source_field(self):
        """EntryMetrics must use 'source', not 'english'."""
        em = EntryMetrics()
        assert hasattr(em, "source")
        assert not hasattr(em, "english")

    def test_source_field_assignment(self):
        em = EntryMetrics(source="Hello.")
        assert em.source == "Hello."


class TestAnalyzeRun:
    """Verify analyze_run produces correct metrics from RunLog."""

    def _write_run_log(self, tmp_path, run_log):
        """Helper: write a RunLog dict to a temp JSON file."""
        log_path = tmp_path / "test_run.json"
        log_path.write_text(
            json.dumps(run_log, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return str(log_path)

    def test_reads_source_key(self, sample_run_log, tmp_path):
        """analyze_run should read 'source' from results, not 'english'."""
        log_path = self._write_run_log(tmp_path, sample_run_log)
        report = analyze_run(log_path)
        entries = report["entries"]
        assert entries[0]["source"] == "Hello."
        assert entries[1]["source"] == "Thank you."

    def test_exact_match_detection(self, sample_run_log, tmp_path):
        """Entry 0 is an exact match; entry 1 is not."""
        log_path = self._write_run_log(tmp_path, sample_run_log)
        report = analyze_run(log_path)
        entries = report["entries"]
        assert entries[0]["exact_match"] is True
        assert entries[1]["exact_match"] is False

    def test_overall_metrics(self, sample_run_log, tmp_path):
        """Overall should report 1 exact match out of 2."""
        log_path = self._write_run_log(tmp_path, sample_run_log)
        report = analyze_run(log_path)
        overall = report["overall"]
        assert overall["evaluated"] == 2
        assert overall["exact_match_count"] == 1
        assert overall["exact_match_rate"] == 0.5

    def test_segment_breakdown(self, sample_run_log, tmp_path):
        """Both entries are 'basic' — should have a basic segment."""
        log_path = self._write_run_log(tmp_path, sample_run_log)
        report = analyze_run(log_path)
        assert "basic" in report["by_segment"]
        basic = report["by_segment"]["basic"]
        assert basic["count"] == 2

    def test_no_english_key_in_output(self, sample_run_log, tmp_path):
        """No entry in the report should contain an 'english' key."""
        log_path = self._write_run_log(tmp_path, sample_run_log)
        report = analyze_run(log_path)
        for entry in report["entries"]:
            assert "english" not in entry, f"Entry {entry['id']} still has 'english' key"

    def test_sacrebleu_signatures_emitted(self, sample_run_log, tmp_path):
        """overall carries per-metric sacreBLEU signatures for reproducibility.

        The surface metrics that always run (chrF++, BLEU, TER) must each emit a
        full sacreBLEU signature string (incl. the sacreBLEU version) so a
        published score can be re-derived. spBLEU / plain chrF are best-effort
        (their FLORES-200 tokenizer may be unavailable offline), so they are not
        required here.
        """
        log_path = self._write_run_log(tmp_path, sample_run_log)
        report = analyze_run(log_path)
        sigs = report["overall"].get("sacrebleu_signatures")
        assert isinstance(sigs, dict) and sigs, "sacrebleu_signatures missing"
        for metric in ("chrf", "bleu", "ter"):
            assert metric in sigs, f"signature for {metric} missing"
            assert isinstance(sigs[metric], str) and "version:" in sigs[metric]
