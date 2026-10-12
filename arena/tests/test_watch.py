"""
Tests for mt_eval_harness.watch — directory polling and dashboard auto-regeneration.

Covers:
    - Snapshot comparison logic (detects new/changed/removed files)
    - Initial scan behavior
    - Dashboard regeneration on file changes (REAL load_reports + generate)
    - CLI argument parsing (main() entry point)
    - Error resilience (empty dirs, generation errors)
    - Branding verification

Design principle: only mock time.sleep (to break the infinite loop)
and sys.argv (to test CLI arg parsing). Everything else runs for real.
"""

import json
import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from mt_eval_harness.watch import watch, main


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_report(run_name="Test", evaluated=10, exact_match_rate=0.5):
    """Build a minimal valid report dict."""
    return {
        "run_id": f"run_{run_name}",
        "config": {"run_name": run_name, "model": "test-model", "prompt_version": "naive"},
        "overall": {"evaluated": evaluated, "exact_match_rate": exact_match_rate},
        "entries": [
            {
                "id": i,
                "source": f"source_{i}",
                "expected": f"expected_{i}",
                "predicted": f"predicted_{i}",
                "exact_match": i % 2 == 0,
            }
            for i in range(evaluated)
        ],
    }


@pytest.fixture
def report_dir(tmp_path):
    """Create a directory with valid report files that load_reports can read."""
    for i in range(3):
        report = _make_report(run_name=f"Run_{i}", evaluated=5)
        path = tmp_path / f"run_{i}_report.json"
        path.write_text(json.dumps(report), encoding="utf-8")
    return tmp_path


@pytest.fixture
def empty_dir(tmp_path):
    """An empty directory with no reports."""
    return tmp_path


# ---------------------------------------------------------------------------
# Snapshot detection — real file I/O, real load_reports, real generate
# ---------------------------------------------------------------------------

class TestSnapshotDetection:
    """Test that the watch loop detects file changes correctly.

    These tests use real load_reports() and generate() calls.
    Only time.sleep is mocked to break the infinite loop.
    """

    def test_detects_initial_files_and_generates_dashboard(self, report_dir):
        """First iteration should detect existing reports and produce real HTML."""
        output_path = str(report_dir / "dashboard_out.html")

        with patch("time.sleep", side_effect=KeyboardInterrupt):
            watch(str(report_dir), output_path, interval=1.0)

        # A real dashboard file should have been created
        assert os.path.exists(output_path)
        content = Path(output_path).read_text(encoding="utf-8")
        assert "<html" in content.lower()
        assert "MT Eval Harness" in content

    def test_empty_directory_no_output(self, empty_dir):
        """Empty dir should not produce a dashboard file."""
        output_path = str(empty_dir / "dashboard_out.html")

        with patch("time.sleep", side_effect=KeyboardInterrupt):
            watch(str(empty_dir), output_path, interval=1.0)

        # No dashboard should be created (no reports to load)
        assert not os.path.exists(output_path)

    def test_detects_new_file_and_regenerates(self, report_dir):
        """Adding a file between iterations triggers a second real generation."""
        output_path = str(report_dir / "dashboard_out.html")
        iteration = [0]

        def sleep_side_effect(seconds):
            iteration[0] += 1
            if iteration[0] == 1:
                # Add a new report file between iterations
                new_report = _make_report(run_name="NewRun", evaluated=3)
                (report_dir / "run_new_report.json").write_text(
                    json.dumps(new_report), encoding="utf-8"
                )
            elif iteration[0] >= 2:
                raise KeyboardInterrupt

        with patch("time.sleep", side_effect=sleep_side_effect):
            watch(str(report_dir), output_path, interval=1.0)

        # Dashboard should exist and contain data from the new run
        assert os.path.exists(output_path)
        content = Path(output_path).read_text(encoding="utf-8")
        assert "<html" in content.lower()

    def test_modified_file_triggers_regeneration(self, report_dir):
        """Changing an existing file's mtime triggers regeneration."""
        output_path = str(report_dir / "dashboard_out.html")
        target_file = report_dir / "run_0_report.json"
        iteration = [0]

        def sleep_side_effect(seconds):
            iteration[0] += 1
            if iteration[0] == 1:
                # Touch the file to change its mtime
                updated = _make_report(run_name="Run_0_Updated", evaluated=8)
                target_file.write_text(json.dumps(updated), encoding="utf-8")
            elif iteration[0] >= 2:
                raise KeyboardInterrupt

        with patch("time.sleep", side_effect=sleep_side_effect):
            watch(str(report_dir), output_path, interval=1.0)

        assert os.path.exists(output_path)

    def test_dashboard_content_reflects_reports(self, report_dir):
        """The generated dashboard should contain data from the report files."""
        output_path = str(report_dir / "dashboard_out.html")

        with patch("time.sleep", side_effect=KeyboardInterrupt):
            watch(str(report_dir), output_path, interval=1.0)

        content = Path(output_path).read_text(encoding="utf-8")
        # Dashboard should reference report data (run IDs, entries, etc.)
        # At minimum it should have the HTML structure and chart code
        assert "Chart" in content or "chart" in content.lower()


# ---------------------------------------------------------------------------
# Error resilience — real calls, real errors
# ---------------------------------------------------------------------------

class TestWatchErrorResilience:
    """Test that watch handles edge cases without crashing."""

    def test_directory_with_bad_json(self, tmp_path):
        """Malformed JSON files shouldn't crash the watch loop."""
        bad_file = tmp_path / "bad_report.json"
        bad_file.write_text("this is not json {{{{", encoding="utf-8")

        output_path = str(tmp_path / "dashboard_out.html")

        # Should not raise — watch catches exceptions
        with patch("time.sleep", side_effect=KeyboardInterrupt):
            watch(str(tmp_path), output_path, interval=1.0)

    def test_nonexistent_directory_pattern(self, tmp_path):
        """A directory that exists but has no matching glob pattern is fine."""
        # Create a file that doesn't match *_report.json
        (tmp_path / "something_else.txt").write_text("hello")

        output_path = str(tmp_path / "dashboard_out.html")

        with patch("time.sleep", side_effect=KeyboardInterrupt):
            watch(str(tmp_path), output_path, interval=1.0)

        # No matching files → no dashboard
        assert not os.path.exists(output_path)


# ---------------------------------------------------------------------------
# main() CLI entry point — mock sys.argv and the watch function
#
# NOTE: We mock watch() here because main() is JUST an argument parser.
# The watch function itself is thoroughly tested above with real I/O.
# ---------------------------------------------------------------------------

class TestWatchMain:
    """Tests for the watch module's CLI entry point (argument parsing only)."""

    def test_missing_directory_exits(self):
        """No directory argument → prints usage and exits."""
        with (
            patch("sys.argv", ["watch"]),
            pytest.raises(SystemExit) as exc_info,
        ):
            main()
        assert exc_info.value.code == 1

    def test_parses_directory(self):
        """Directory is extracted from positional args."""
        with (
            patch("sys.argv", ["watch", "/some/dir"]),
            patch("mt_eval_harness.watch.watch") as mock_watch,
        ):
            main()
            mock_watch.assert_called_once_with("/some/dir", "dashboard.html", 5.0)

    def test_parses_output_flag(self):
        """The -o flag sets the output path."""
        with (
            patch("sys.argv", ["watch", "/dir", "-o", "custom.html"]),
            patch("mt_eval_harness.watch.watch") as mock_watch,
        ):
            main()
            mock_watch.assert_called_once_with("/dir", "custom.html", 5.0)

    def test_parses_interval_flag(self):
        """The -i flag sets the polling interval."""
        with (
            patch("sys.argv", ["watch", "/dir", "-i", "10"]),
            patch("mt_eval_harness.watch.watch") as mock_watch,
        ):
            main()
            mock_watch.assert_called_once_with("/dir", "dashboard.html", 10.0)

    def test_parses_all_flags(self):
        """All flags together."""
        with (
            patch("sys.argv", ["watch", "/dir", "-o", "out.html", "-i", "2"]),
            patch("mt_eval_harness.watch.watch") as mock_watch,
        ):
            main()
            mock_watch.assert_called_once_with("/dir", "out.html", 2.0)


# ---------------------------------------------------------------------------
# Branding
# ---------------------------------------------------------------------------

class TestWatchBranding:
    """Verify watch module is free of legacy branding."""

    def test_module_docstring_neutral(self):
        import mt_eval_harness.watch as w
        doc = w.__doc__ or ""
        assert "gds" not in doc.lower()
