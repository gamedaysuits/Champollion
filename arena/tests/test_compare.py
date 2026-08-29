"""
Tests for mt_eval_harness.compare — multi-run comparison engine.

Covers:
    - Loading and comparing multiple TestReports
    - Overall comparison table construction
    - Per-entry regression/improvement detection
    - Edge cases (missing entries, single report, RunLog handling)
    - Plugin metric forwarding in comparison rows
"""

import json
from pathlib import Path

import pytest

from mt_eval_harness.compare import compare_reports, run_compare


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def report_a(tmp_path):
    """First run — lower accuracy baseline."""
    report = {
        "run_id": "run_baseline",
        "config": {
            "model": "gemini-2.5-flash",
            "prompt_version": "naive",
            "tools_enabled": False,
            "batch_size": 1,
        },
        "overall": {
            "evaluated": 5,
            "exact_match_rate": 0.40,
            "corpus_chrf": 55.0,
            "total_cost_usd": 0.05,
            "avg_latency_s": 1.2,
        },
        "entries": [
            {"id": 0, "source": "Hello", "expected": "Bonjour", "predicted": "Bonjour", "exact_match": True},
            {"id": 1, "source": "Thanks", "expected": "Merci", "predicted": "Merci", "exact_match": True},
            {"id": 2, "source": "Dog", "expected": "Chien", "predicted": "Chat", "exact_match": False},
            {"id": 3, "source": "Cat", "expected": "Chat", "predicted": "Chien", "exact_match": False},
            {"id": 4, "source": "Sky", "expected": "Ciel", "predicted": "Ciel", "exact_match": True},
        ],
    }
    path = tmp_path / "report_a.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    return path, report


@pytest.fixture
def report_b(tmp_path):
    """Second run — improved accuracy, with one regression."""
    report = {
        "run_id": "run_coached",
        "config": {
            "model": "gemini-3.1-pro",
            "prompt_version": "coached",
            "tools_enabled": True,
            "batch_size": 1,
        },
        "overall": {
            "evaluated": 5,
            "exact_match_rate": 0.60,
            "corpus_chrf": 72.0,
            "total_cost_usd": 0.12,
            "avg_latency_s": 2.1,
        },
        "entries": [
            # id=0: was correct, still correct (stable)
            {"id": 0, "source": "Hello", "expected": "Bonjour", "predicted": "Bonjour", "exact_match": True},
            # id=1: was correct, now WRONG (regression!)
            {"id": 1, "source": "Thanks", "expected": "Merci", "predicted": "Gracias", "exact_match": False},
            # id=2: was wrong, now CORRECT (improvement!)
            {"id": 2, "source": "Dog", "expected": "Chien", "predicted": "Chien", "exact_match": True},
            # id=3: was wrong, now CORRECT (improvement!)
            {"id": 3, "source": "Cat", "expected": "Chat", "predicted": "Chat", "exact_match": True},
            # id=4: was correct, still correct (stable)
            {"id": 4, "source": "Sky", "expected": "Ciel", "predicted": "Ciel", "exact_match": True},
        ],
    }
    path = tmp_path / "report_b.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    return path, report


# ---------------------------------------------------------------------------
# compare_reports() — core comparison logic
# ---------------------------------------------------------------------------

class TestCompareReports:
    """Tests for the comparison engine itself (from loaded dicts)."""

    def test_basic_comparison(self, report_a, report_b):
        """Two valid reports produce a valid comparison structure."""
        result = compare_reports([report_a[0], report_b[0]])

        assert result["run_count"] == 2
        assert len(result["overall_comparison"]) == 2
        assert "regressions" in result
        assert "improvements" in result

    def test_overall_rows_match_reports(self, report_a, report_b):
        """Each report becomes a row in the overall comparison table."""
        result = compare_reports([report_a[0], report_b[0]])
        rows = result["overall_comparison"]

        assert rows[0]["run_id"] == "run_baseline"
        assert rows[0]["model"] == "gemini-2.5-flash"
        assert rows[0]["exact_match"] == 0.40

        assert rows[1]["run_id"] == "run_coached"
        assert rows[1]["model"] == "gemini-3.1-pro"
        assert rows[1]["exact_match"] == 0.60

    def test_regression_detected(self, report_a, report_b):
        """Entry id=1 was correct in A, wrong in B → regression."""
        result = compare_reports([report_a[0], report_b[0]])

        assert result["regression_count"] == 1
        reg = result["regressions"][0]
        assert reg["id"] == 1
        assert reg["source"] == "Thanks"
        assert reg["first_predicted"] == "Merci"
        assert reg["last_predicted"] == "Gracias"

    def test_improvements_detected(self, report_a, report_b):
        """Entries id=2,3 were wrong in A, correct in B → improvements."""
        result = compare_reports([report_a[0], report_b[0]])

        assert result["improvement_count"] == 2
        imp_ids = {i["id"] for i in result["improvements"]}
        assert imp_ids == {2, 3}

    def test_stable_entries_not_flagged(self, report_a, report_b):
        """Entries that didn't change status (0, 4) aren't flagged."""
        result = compare_reports([report_a[0], report_b[0]])

        all_flagged_ids = {
            e["id"] for e in result["regressions"] + result["improvements"]
        }
        # id=0 and id=4 should NOT appear
        assert 0 not in all_flagged_ids
        assert 4 not in all_flagged_ids

    def test_insufficient_reports(self):
        """Fewer than 2 reports returns an error dict."""
        result = compare_reports([])
        assert "error" in result

    def test_single_report_insufficient(self, report_a):
        """A single report isn't enough for comparison."""
        result = compare_reports([report_a[0]])
        assert "error" in result

    def test_missing_file_skipped(self, tmp_path, report_a):
        """Non-existent file paths are skipped with a warning."""
        fake = tmp_path / "nonexistent.json"
        result = compare_reports([report_a[0], fake])
        assert "error" in result  # Only 1 valid report → insufficient

    def test_plugin_metrics_forwarded(self, tmp_path, report_a, report_b):
        """Plugin aggregate metrics appear in comparison rows."""
        # Modify report_a to include plugin metrics
        _, data = report_a
        data["overall"]["plugin_metrics"] = {
            "morphology": {"avg_validity_rate": 0.75}
        }
        path = tmp_path / "report_a_with_plugins.json"
        path.write_text(json.dumps(data), encoding="utf-8")

        result = compare_reports([path, report_b[0]])
        row_a = result["overall_comparison"][0]
        assert row_a["morphology.avg_validity_rate"] == 0.75

    def test_tools_flag_captured(self, report_a, report_b):
        """tools_enabled flag is captured in comparison rows."""
        result = compare_reports([report_a[0], report_b[0]])
        rows = result["overall_comparison"]
        assert rows[0]["tools"] is False
        assert rows[1]["tools"] is True


# ---------------------------------------------------------------------------
# run_compare() — CLI entry point
# ---------------------------------------------------------------------------

class TestRunCompare:
    """Tests for the CLI-facing compare function."""

    def test_writes_output_file(self, report_a, report_b, tmp_path):
        """run_compare writes a JSON comparison file."""
        out = tmp_path / "comparison.json"
        run_compare([str(report_a[0]), str(report_b[0])], str(out))

        assert out.exists()
        result = json.loads(out.read_text())
        assert result["run_count"] == 2

    def test_default_output_path(self, report_a, report_b, tmp_path, monkeypatch):
        """With no output path, writes to default location."""
        # Change to tmp_path so the default path is created there
        monkeypatch.chdir(tmp_path)
        run_compare([str(report_a[0]), str(report_b[0])])

        default_path = Path("eval/logs/harness/comparison.json")
        assert default_path.exists()

    def test_auto_finds_reports_from_runlogs(self, tmp_path):
        """If given a RunLog, it looks for a _report.json sibling."""
        # Create a RunLog and its corresponding report
        runlog = {"results": [{"id": 0, "predicted": "x"}]}
        runlog_path = tmp_path / "run1.json"
        runlog_path.write_text(json.dumps(runlog))

        report = {
            "run_id": "run1",
            "config": {"model": "test"},
            "overall": {"evaluated": 1, "exact_match_rate": 1.0},
            "entries": [{"id": 0, "exact_match": True}],
        }
        report_path = tmp_path / "run1_report.json"
        report_path.write_text(json.dumps(report))

        # Create a second pair
        runlog2_path = tmp_path / "run2.json"
        runlog2_path.write_text(json.dumps(runlog))
        report2 = {
            "run_id": "run2",
            "config": {"model": "test2"},
            "overall": {"evaluated": 1, "exact_match_rate": 0.0},
            "entries": [{"id": 0, "exact_match": False}],
        }
        report2_path = tmp_path / "run2_report.json"
        report2_path.write_text(json.dumps(report2))

        out = tmp_path / "cmp.json"
        run_compare([str(runlog_path), str(runlog2_path)], str(out))

        assert out.exists()
        result = json.loads(out.read_text())
        assert result["run_count"] == 2


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestCompareEdgeCases:
    """Edge cases and data resilience."""

    def test_disjoint_entry_ids(self, tmp_path):
        """Reports with no overlapping entry IDs produce zero diffs."""
        r1 = {
            "run_id": "r1",
            "config": {"model": "m"},
            "overall": {"evaluated": 1},
            "entries": [{"id": 0, "exact_match": True}],
        }
        r2 = {
            "run_id": "r2",
            "config": {"model": "m"},
            "overall": {"evaluated": 1},
            "entries": [{"id": 99, "exact_match": False}],
        }
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))

        result = compare_reports([p1, p2])
        assert result["regression_count"] == 0
        assert result["improvement_count"] == 0

    def test_empty_entries_arrays(self, tmp_path):
        """Reports with empty entries don't crash."""
        r1 = {
            "run_id": "r1",
            "config": {"model": "m"},
            "overall": {"evaluated": 0},
            "entries": [],
        }
        r2 = {
            "run_id": "r2",
            "config": {"model": "m"},
            "overall": {"evaluated": 0},
            "entries": [],
        }
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))

        result = compare_reports([p1, p2])
        assert result["run_count"] == 2
        assert result["regression_count"] == 0

    def test_three_reports(self, report_a, report_b, tmp_path):
        """Comparison works with 3+ reports (diffs use first vs last)."""
        # Create a third report
        r3 = {
            "run_id": "run_final",
            "config": {"model": "gemini-4"},
            "overall": {"evaluated": 5, "exact_match_rate": 0.80},
            "entries": [
                {"id": i, "exact_match": True} for i in range(5)
            ],
        }
        p3 = tmp_path / "report_c.json"
        p3.write_text(json.dumps(r3))

        result = compare_reports([report_a[0], report_b[0], p3])
        assert result["run_count"] == 3
        assert len(result["overall_comparison"]) == 3

    def test_string_entry_ids_with_diffs(self, tmp_path, capsys):
        """String entry ids (all registry-built corpora) must not crash the
        regression/improvement printout, and the -o report must be written.

        Regression test for the prelaunch-audit bug: '#{id:3d}' raised
        ValueError on string ids whenever regressions/improvements existed,
        and the crash happened before the output file write.
        """
        r1 = {
            "run_id": "r1",
            "config": {"model": "m1"},
            "overall": {"evaluated": 3, "exact_match_rate": 0.67,
                        "corpus_chrf": 50.0, "total_cost_usd": 0.01},
            "entries": [
                {"id": "eng-fra-0001", "source": "Hello", "expected": "Bonjour",
                 "predicted": "Bonjour", "exact_match": True},
                {"id": "eng-fra-0002", "source": "Thanks", "expected": "Merci",
                 "predicted": "Gracias", "exact_match": False},
                {"id": "eng-fra-0003", "source": "Sky", "expected": "Ciel",
                 "predicted": "Ciel", "exact_match": True},
            ],
        }
        r2 = {
            "run_id": "r2",
            "config": {"model": "m2"},
            "overall": {"evaluated": 3, "exact_match_rate": 0.67,
                        "corpus_chrf": 55.0, "total_cost_usd": 0.02},
            "entries": [
                # regression (was correct, now wrong)
                {"id": "eng-fra-0001", "source": "Hello", "expected": "Bonjour",
                 "predicted": "Salut", "exact_match": False},
                # improvement (was wrong, now correct)
                {"id": "eng-fra-0002", "source": "Thanks", "expected": "Merci",
                 "predicted": "Merci", "exact_match": True},
                {"id": "eng-fra-0003", "source": "Sky", "expected": "Ciel",
                 "predicted": "Ciel", "exact_match": True},
            ],
        }
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))
        out = tmp_path / "cmp.json"

        # Must not raise (was: ValueError on the string id format code)
        run_compare([str(p1), str(p2)], str(out))

        captured = capsys.readouterr()
        assert "eng-fra-0001" in captured.out  # regression printed
        assert "eng-fra-0002" in captured.out  # improvement printed

        # The -o report is written even when diffs exist
        assert out.exists()
        result = json.loads(out.read_text())
        assert result["regression_count"] == 1
        assert result["improvement_count"] == 1
        assert result["regressions"][0]["id"] == "eng-fra-0001"
        assert result["improvements"][0]["id"] == "eng-fra-0002"

    def test_mixed_entry_id_types_sortable(self, tmp_path):
        """A mix of int and string ids across the common set must not raise
        TypeError from sorted() — ids are compared by string form."""
        r1 = {"run_id": "r1", "config": {"model": "m"},
              "overall": {"evaluated": 2},
              "entries": [
                  {"id": 0, "exact_match": True},
                  {"id": "abc", "exact_match": True},
              ]}
        r2 = {"run_id": "r2", "config": {"model": "m"},
              "overall": {"evaluated": 2},
              "entries": [
                  {"id": 0, "exact_match": False},
                  {"id": "abc", "exact_match": False},
              ]}
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))

        result = compare_reports([p1, p2])
        assert result["regression_count"] == 2

    def test_missing_config_fields(self, tmp_path):
        """Reports with sparse config fields don't crash."""
        r1 = {"run_id": "r1", "config": {}, "overall": {}, "entries": []}
        r2 = {"run_id": "r2", "config": {}, "overall": {}, "entries": []}
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))

        result = compare_reports([p1, p2])
        assert result["run_count"] == 2
        row = result["overall_comparison"][0]
        assert row["model"] == "?"
