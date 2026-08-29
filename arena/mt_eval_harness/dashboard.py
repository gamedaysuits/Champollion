"""
Dashboard Generator — produces a self-contained HTML evaluation dashboard.

Architecture:
  - CSS lives in _dashboard_css.py (neutral design tokens, dark/light mode)
  - Chart builders live in _dashboard_charts.py (Chart.js wrappers)
  - Core JS lives in _dashboard_js.py (rendering, export, drag-drop, keyboard)
  - All report data is embedded as JSON so the file works offline
  - Chart.js and Google Fonts loaded via CDN links
  - The generator supports both individual report files and directory scanning

Directory mode (dynamic):
  Pass a directory path and the generator will find all *_report.json files,
  include them all, and produce a multi-run comparison dashboard.
"""

import json
import os
import sys
import glob

from datetime import datetime

from ._dashboard_css import CSS
from ._dashboard_charts import CHART_JS
from ._dashboard_js import JS


# ── Report Loading ───────────────────────────────────────────────────────────
def load_reports(paths: list[str]) -> list[dict]:
    """
    Load report JSON files from a list of paths.
    Each path can be:
      - A specific *_report.json file
      - A directory (scanned for all *_report.json files)
    """
    reports = []
    seen = set()

    for p in paths:
        if os.path.isdir(p):
            # Directory mode: find all report files
            pattern = os.path.join(p, "*_report.json")
            for f in sorted(glob.glob(pattern)):
                if f not in seen:
                    seen.add(f)
                    reports.append(_load_one(f))
        elif os.path.isfile(p):
            if p not in seen:
                seen.add(p)
                reports.append(_load_one(p))
        else:
            print(f"  Warning: skipping '{p}' — not found", file=sys.stderr)

    return reports


def _load_one(path: str) -> dict:
    """Load a single report JSON file.

    Raises ``json.JSONDecodeError`` (or ``OSError``) on a malformed/missing
    file. The one-shot ``dashboard <file>`` command catches this in cli.py and
    fails cleanly (one line + exit 1, via ``load_runlog``); the watch loop
    catches it as a normal ``Exception`` and skips the bad file, so a transient
    half-written report never kills the watcher.
    """
    with open(path) as f:
        data = json.load(f)

    # Inject the run name from config if available, or derive from filename
    config = data.get("config", {})
    if not config.get("run_name"):
        base = os.path.basename(path).replace("_report.json", "")
        config["run_name"] = base
        data["config"] = config

    return data


# ── HTML Assembly ────────────────────────────────────────────────────────────
def generate(reports: list[dict], output_path: str = "dashboard.html") -> str:
    """
    Generate the dashboard HTML and write to output_path.

    Returns the output path for caller convenience.
    """
    from mt_eval_harness import __version__
    version = __version__

    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    run_count = len(reports)
    run_label = f"{run_count} run{'s' if run_count != 1 else ''}"

    # Build the report JSON payload
    data_json = json.dumps(reports, ensure_ascii=False, separators=(",", ":"))

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="MT Eval Harness — evaluation dashboard for machine translation experiments">
<title>MT Eval Dashboard — {run_label}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>{CSS}</style>
</head>
<body>

<!-- ── Header ──────────────────────────────────────── -->
<div class="header">
    <div class="header-text">
        <div class="header-title">MT Eval Harness<span class="version">v{version}</span></div>
        <div class="header-sub">{run_label} · {ts}</div>
    </div>
    <button id="theme-btn" class="theme-toggle" title="Toggle dark/light mode">☀️</button>
</div>

<div class="main">

<!-- ── Run Tabs ────────────────────────────────────── -->
<div class="section" style="margin-bottom:0;border-bottom:none;border-bottom-left-radius:0;border-bottom-right-radius:0">
    <div id="run-tabs" class="run-tabs"></div>
</div>

<!-- ── Metric Cards ───────────────────────────────── -->
<div class="section" style="border-top-left-radius:0;border-top-right-radius:0;border-top:none">
    <div class="section-body">
        <div id="metric-cards" class="metric-grid"></div>
    </div>
</div>

<!-- ── Run Comparison Table ───────────────────────── -->
<div class="section" id="compare-section">
    <div class="section-head"><span class="section-title">Run Comparison</span></div>
    <div class="section-body" style="overflow-x:auto"><div id="compare-table"></div></div>
</div>

<!-- ── Performance Bar Chart (Chart.js) ──────────── -->
<div class="section" id="barchart-section">
    <div class="section-head"><span class="section-title">Performance Overview</span></div>
    <div class="section-body">
        <div class="chart-container"><canvas id="bar-canvas"></canvas></div>
    </div>
</div>

<!-- ── Radar Chart (Chart.js) ────────────────────── -->
<div class="section" id="radar-section">
    <div class="section-head"><span class="section-title">Multi-Metric Radar</span></div>
    <div class="section-body">
        <div class="chart-container"><canvas id="radar-canvas"></canvas></div>
    </div>
</div>

<!-- ── Segment Breakdown ─────────────────────────── -->
<div class="section" id="segment-section">
    <div class="section-head"><span class="section-title">Segment Breakdown</span></div>
    <div class="section-body"><div id="segment-bars" class="bar-group"></div></div>
</div>

<!-- ── Segment × Run Matrix ──────────────────────── -->
<div class="section" id="seg-compare-section">
    <div class="section-head"><span class="section-title">Segment × Run Matrix</span></div>
    <div class="section-body" style="overflow-x:auto"><div id="seg-compare-table"></div></div>
</div>

<!-- ── chrF++ Distribution Histogram (Chart.js) ──── -->
<div class="section" id="histogram-section">
    <div class="section-head"><span class="section-title">chrF++ Distribution</span></div>
    <div class="section-body">
        <div class="chart-container"><canvas id="hist-canvas"></canvas></div>
    </div>
</div>

<!-- ── View Toggle ───────────────────────────────── -->
<div class="section" style="margin-bottom:0;border-bottom:none;border-bottom-left-radius:0;border-bottom-right-radius:0">
    <div class="section-head">
        <span class="section-title">Translation Results</span>
    </div>
    <div class="view-toggle">
        <button class="view-toggle-btn active" data-view="explorer">Entry Explorer</button>
        <button class="view-toggle-btn" data-view="sidebyside">Side-by-Side Comparison</button>
    </div>
</div>

<!-- ── Entry Explorer ─────────────────────────────── -->
<div class="section" id="explorer-section" style="border-top:none;border-top-left-radius:0;border-top-right-radius:0">
    <div class="explorer-bar">
        <input type="text" id="search-box" class="search-box" placeholder="Search source, target, or predicted text…">
        <select id="filter-seg" class="filter-sel"><option value="">All segments</option></select>
        <select id="filter-match" class="filter-sel">
            <option value="">All results</option>
            <option value="exact">Exact match</option>
            <option value="miss">Misses</option>
            <option value="error">Errors</option>
        </select>
        <span id="entry-count" class="count-label"></span>
    </div>
    <div id="entry-list" class="entry-scroll"></div>
</div>

<!-- ── Side-by-Side Comparison ────────────────────── -->
<div class="section" id="sbs-section" style="border-top:none;border-top-left-radius:0;border-top-right-radius:0;display:none">
    <div class="explorer-bar">
        <input type="text" id="sbs-search" class="search-box" placeholder="Search entries…">
        <select id="sbs-filter-seg" class="filter-sel"><option value="">All segments</option></select>
        <select id="sbs-filter-match" class="filter-sel">
            <option value="">All entries</option>
            <option value="disagree">Runs disagree</option>
            <option value="all_miss">All miss</option>
            <option value="all_exact">All exact</option>
        </select>
        <span id="sbs-count" class="count-label"></span>
    </div>
    <div id="sbs-table-wrap" class="sbs-wrap"></div>
</div>

<!-- ── Export Toolbar ─────────────────────────────── -->
<div class="section">
    <div class="export-bar">
        <button id="export-json" class="export-btn">⬇ JSON</button>
        <button id="export-csv" class="export-btn">⬇ CSV</button>
        <button id="export-copy" class="export-btn">📋 Copy</button>
    </div>
</div>

</div><!-- /main -->

<!-- ── Drag-Drop Overlay ─────────────────────────── -->
<div id="drop-overlay" class="drop-overlay">
    <div class="drop-box">
        Drop report JSON files here
        <div class="drop-box-sub">Files will be added as new runs for comparison</div>
    </div>
</div>

<!-- ── Toast ──────────────────────────────────────── -->
<div id="toast" class="toast"></div>

<div class="footer">
    <div>MT Eval Harness v{version} · AGPL-3.0-or-later</div>
    <div class="footer-links">
        <span><a href="https://github.com/gamedaysuits/Champollion" target="_blank">GitHub</a></span>
        <span>·</span>
        <span>Generated {ts}</span>
    </div>
</div>

<script>window.__REPORTS = {data_json};</script>
<script>{CHART_JS}</script>
<script>{JS}</script>

</body>
</html>"""

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w") as f:
        f.write(html)

    return output_path


# ── CLI Entry Point (standalone usage) ───────────────────────────────────────
def main():
    """Usage: python -m mt_eval_harness.dashboard <report_or_dir> [...] [-o out.html]"""
    args = sys.argv[1:]
    output = "dashboard.html"
    paths = []

    i = 0
    while i < len(args):
        if args[i] in ("-o", "--output") and i + 1 < len(args):
            output = args[i + 1]
            i += 2
        else:
            paths.append(args[i])
            i += 1

    if not paths:
        print("Usage: dashboard <report.json or dir> [...] [-o output.html]")
        sys.exit(1)

    reports = load_reports(paths)
    if not reports:
        print("No reports found.")
        sys.exit(1)

    out = generate(reports, output)
    print(f"  Dashboard written to: {out}")
    print(f"  Open in browser: file://{os.path.abspath(out)}")


if __name__ == "__main__":
    main()
