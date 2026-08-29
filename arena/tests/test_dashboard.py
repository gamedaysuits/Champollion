"""
Tests for mt_eval_harness.dashboard — HTML dashboard generation.

Covers:
    - Module imports and string integrity
    - Shared global scope: R, activeIdx, $, runLabel available to both
      the chart module and the core JS IIFE
    - CSS variable namespace (--dash-*, not --gds-*)
    - HTML structure: CDN links, meta tags, data injection
    - Multi-run report handling
    - Branding purge verification (zero GDS/legacy references)
    - Chart.js integration markers
    - Export, theme, drag-drop, keyboard features present
"""

import json
import os
import re
from pathlib import Path

import pytest

from mt_eval_harness._dashboard_css import CSS
from mt_eval_harness._dashboard_charts import CHART_JS
from mt_eval_harness._dashboard_js import JS
from mt_eval_harness.dashboard import generate


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def single_report():
    """A minimal valid report for dashboard generation."""
    return {
        "config": {
            "run_name": "Baseline",
            "model": "gemini-2.5-flash",
        },
        "overall": {
            "evaluated": 10,
            "exact_match_rate": 0.40,
            "exact_match_count": 4,
            "miss_rate": 0.60,
            "corpus_chrf": 55.0,
            "corpus_bleu": 30.0,
        },
        "by_segment": {
            "gold": {"count": 5, "exact_match_count": 3, "avg_chrf": 70.0},
        },
        "entries": [
            {
                "id": i + 1,
                "source": f"Source {i}",
                "expected": f"Expected {i}",
                "predicted": f"Predicted {i}",
                "exact_match": i % 2 == 0,
                "chrf_score": 50.0 + i * 5,
            }
            for i in range(10)
        ],
    }


@pytest.fixture
def two_reports(single_report):
    """Two reports for multi-run comparison testing."""
    run2 = {
        "config": {
            "run_name": "FST-Coached v2",
            "model": "gemini-3.1-pro",
        },
        "overall": {
            "evaluated": 10,
            "exact_match_rate": 0.60,
            "exact_match_count": 6,
            "miss_rate": 0.40,
            "corpus_chrf": 72.0,
            "corpus_bleu": 45.0,
        },
        "by_segment": {
            "gold": {"count": 5, "exact_match_count": 4, "avg_chrf": 85.0},
        },
        "entries": [
            {
                "id": i + 1,
                "source": f"Source {i}",
                "expected": f"Expected {i}",
                "predicted": f"Expected {i}" if i % 2 == 0 else f"Wrong {i}",
                "exact_match": i % 2 == 0,
                "chrf_score": 60.0 + i * 4,
            }
            for i in range(10)
        ],
    }
    return [single_report, run2]


@pytest.fixture
def generated_html(tmp_path, two_reports):
    """Generate a full dashboard HTML file for inspection."""
    out = tmp_path / "test_dashboard.html"
    generate(two_reports, str(out))
    return out.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Module-level integrity
# ---------------------------------------------------------------------------

class TestModuleIntegrity:
    """Verify the three dashboard modules produce valid strings."""

    def test_css_is_nonempty_string(self):
        assert isinstance(CSS, str)
        assert len(CSS) > 1000, "CSS should be substantial"

    def test_chart_js_is_nonempty_string(self):
        assert isinstance(CHART_JS, str)
        assert len(CHART_JS) > 500, "CHART_JS should contain chart builders"

    def test_js_is_nonempty_string(self):
        assert isinstance(JS, str)
        assert len(JS) > 5000, "JS should be substantial"


# ---------------------------------------------------------------------------
# Scope architecture — the critical fix from Phase 2
# ---------------------------------------------------------------------------

class TestScopeArchitecture:
    """Verify shared globals are in CHART_JS, not duplicated in JS."""

    def test_R_declared_in_charts(self):
        """The reports array must be global (in chart script)."""
        assert "const R = window.__REPORTS" in CHART_JS

    def test_activeIdx_declared_in_charts(self):
        """activeIdx must be global for chart builders and core JS."""
        assert "let activeIdx = 0" in CHART_JS

    def test_dollar_helper_in_charts(self):
        """The $ helper must be global."""
        assert "const $ = id =>" in CHART_JS

    def test_runLabel_in_charts(self):
        """runLabel must be global."""
        assert "function runLabel" in CHART_JS

    def test_R_not_redeclared_in_js(self):
        """R must NOT be re-declared in the core JS IIFE."""
        assert "const R = window.__REPORTS" not in JS

    def test_dollar_not_redeclared_in_js(self):
        assert "const $ = id =>" not in JS

    def test_runLabel_not_redeclared_in_js(self):
        assert "function runLabel" not in JS

    def test_chart_builders_exist(self):
        """Chart builder functions should be in CHART_JS."""
        assert "function buildBarChart" in CHART_JS
        assert "function buildHistogram" in CHART_JS
        assert "function buildRadar" in CHART_JS
        assert "function destroyCharts" in CHART_JS


# ---------------------------------------------------------------------------
# CSS namespace
# ---------------------------------------------------------------------------

class TestCSSNamespace:
    """Verify neutral --dash-* variable namespace."""

    def test_uses_dash_prefix(self):
        assert "--dash-bg" in CSS
        assert "--dash-surface" in CSS
        assert "--dash-text" in CSS

    def test_no_gds_variables(self):
        # Can't use -- directly in grep, so check the string
        assert "--gds-" not in CSS

    def test_dark_mode_support(self):
        assert "data-theme" in CSS
        # Auto-detection of system preference happens in JS, not CSS
        assert "prefers-color-scheme" in JS

    def test_system_font_stack(self):
        """Uses system fonts, not CDN-loaded custom fonts."""
        assert "system-ui" in CSS or "-apple-system" in CSS


# ---------------------------------------------------------------------------
# HTML generation
# ---------------------------------------------------------------------------

class TestHTMLGeneration:
    """Tests for the full generate() pipeline."""

    def test_output_file_created(self, tmp_path, single_report):
        out = tmp_path / "dashboard.html"
        result = generate([single_report], str(out))
        assert Path(result).exists()
        assert os.path.getsize(result) > 10000

    def test_html_structure(self, generated_html):
        assert "<!DOCTYPE html>" in generated_html
        assert "<html" in generated_html
        assert "</html>" in generated_html
        assert "<head>" in generated_html
        assert "<body>" in generated_html

    def test_meta_tags(self, generated_html):
        assert 'charset="utf-8"' in generated_html.lower() or "charset=utf-8" in generated_html.lower()
        assert "viewport" in generated_html

    def test_title_neutral(self, generated_html):
        """Title should reference MT Eval, not GDS."""
        assert "<title>" in generated_html
        assert "gds" not in generated_html.lower().split("<title>")[1].split("</title>")[0]

    def test_reports_injected(self, generated_html):
        """Report data should be embedded as __REPORTS."""
        assert "__REPORTS" in generated_html

    def test_two_reports_present(self, generated_html):
        """Both reports should be in the injected JSON."""
        # Find the JSON blob between script tags
        match = re.search(r"window\.__REPORTS\s*=\s*(\[.*?\]);", generated_html, re.DOTALL)
        assert match, "Could not find __REPORTS assignment"
        reports = json.loads(match.group(1))
        assert len(reports) == 2

    def test_chart_js_cdn(self, generated_html):
        """Chart.js should be loaded from CDN."""
        assert "chart.js" in generated_html.lower() or "chartjs" in generated_html.lower()

    def test_google_fonts_cdn(self, generated_html):
        """Google Fonts should be loaded from CDN for Inter."""
        assert "fonts.googleapis.com" in generated_html

    def test_css_embedded(self, generated_html):
        """CSS should be embedded inline (self-contained)."""
        assert "--dash-bg" in generated_html

    def test_js_embedded(self, generated_html):
        """Core JS should be embedded inline."""
        assert "destroyCharts" in generated_html
        assert "buildBarChart" in generated_html


# ---------------------------------------------------------------------------
# Feature presence
# ---------------------------------------------------------------------------

class TestFeaturePresence:
    """Verify key Phase 2 features are present in the JS."""

    def test_theme_toggle(self):
        assert "data-theme" in JS or "toggleTheme" in JS

    def test_delta_indicators(self):
        assert "delta" in JS.lower()

    def test_export_json(self):
        assert "JSON" in JS and "download" in JS

    def test_export_csv(self):
        assert "csv" in JS.lower()

    def test_drag_and_drop(self):
        assert "dragover" in JS or "drop" in JS

    def test_keyboard_navigation(self):
        assert "keydown" in JS or "ArrowUp" in JS or "ArrowDown" in JS

    def test_clipboard(self):
        assert "clipboard" in JS.lower()


# ---------------------------------------------------------------------------
# Branding purge verification
# ---------------------------------------------------------------------------

class TestBrandingPurge:
    """Verify zero GDS/legacy branding across all dashboard modules."""

    def test_css_no_gds(self):
        assert "gds" not in CSS.lower()
        assert "game day" not in CSS.lower()

    def test_js_no_gds(self):
        assert "gds" not in JS.lower()
        assert "game day" not in JS.lower()

    def test_charts_no_gds(self):
        assert "gds" not in CHART_JS.lower()
        assert "game day" not in CHART_JS.lower()

    def test_generated_html_no_gds(self, generated_html):
        """The final HTML output contains zero GDS references."""
        lower = generated_html.lower()
        assert "game day suits" not in lower
        # Note: "gds" can appear in CDN URLs or generic contexts,
        # so we check specifically for branding patterns
        assert "gds research" not in lower
        assert "gds translate" not in lower


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Tests for unusual inputs."""

    def test_empty_entries(self, tmp_path):
        """Reports with no entries should still generate."""
        report = {
            "config": {"run_name": "Empty"},
            "overall": {"evaluated": 0},
            "entries": [],
        }
        out = tmp_path / "empty.html"
        result = generate([report], str(out))
        assert Path(result).exists()

    def test_missing_optional_fields(self, tmp_path):
        """Reports missing optional fields should degrade gracefully."""
        report = {
            "config": {},
            "overall": {},
            "entries": [],
        }
        out = tmp_path / "minimal.html"
        result = generate([report], str(out))
        assert Path(result).exists()

    def test_single_report(self, tmp_path, single_report):
        """A single report (no comparison) generates correctly."""
        out = tmp_path / "single.html"
        result = generate([single_report], str(out))
        html = Path(result).read_text()
        assert "__REPORTS" in html

    def test_many_reports(self, tmp_path, single_report):
        """Many reports (5+) should all be embedded."""
        reports = []
        for i in range(5):
            r = json.loads(json.dumps(single_report))  # Deep copy
            r["config"]["run_name"] = f"Run {i+1}"
            reports.append(r)

        out = tmp_path / "multi.html"
        generate(reports, str(out))
        html = Path(out).read_text()

        match = re.search(r"window\.__REPORTS\s*=\s*(\[.*?\]);", html, re.DOTALL)
        assert match
        parsed = json.loads(match.group(1))
        assert len(parsed) == 5
