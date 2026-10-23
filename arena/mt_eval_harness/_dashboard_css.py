"""
Dashboard CSS — neutral dark/light theme for MT Eval Harness.

Design tokens use --dash-* namespace (no brand coupling).
Dark mode is default; light mode via [data-theme="light"] on <html>.
System prefers-color-scheme auto-detects on first load.
"""

CSS = """
/* ── Design Tokens ─────────────────────────────────────── */
:root {
    /* Dark mode (default) */
    --dash-bg: #0f1117;
    --dash-surface: #161822;
    --dash-surface-2: #1c1f2e;
    --dash-surface-3: #242738;
    --dash-border: rgba(255, 255, 255, 0.07);
    --dash-border-hover: rgba(255, 255, 255, 0.14);

    /* Text hierarchy */
    --dash-text-1: #eef0f6;
    --dash-text-2: #9ca3bf;
    --dash-text-3: #5c6380;

    /* Accent — cool indigo, works in both modes */
    --dash-accent: #6366f1;
    --dash-accent-glow: rgba(99, 102, 241, 0.15);
    --dash-accent-text: #818cf8;

    /* Semantic */
    --dash-success: #34d399;
    --dash-success-bg: rgba(52, 211, 153, 0.10);
    --dash-danger: #f87171;
    --dash-danger-bg: rgba(248, 113, 113, 0.10);
    --dash-warning: #fbbf24;
    --dash-warning-bg: rgba(251, 191, 36, 0.10);
    --dash-info: #60a5fa;
    --dash-info-bg: rgba(96, 165, 250, 0.10);
    --dash-purple: #a78bfa;
    --dash-purple-bg: rgba(167, 139, 250, 0.10);

    /* Layout */
    --dash-radius: 10px;
    --dash-radius-sm: 6px;
    --dash-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    --dash-mono: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;

    /* Chart palette — accessible, distinguishable */
    --chart-1: #6366f1;
    --chart-2: #34d399;
    --chart-3: #f59e0b;
    --chart-4: #f87171;
    --chart-5: #a78bfa;
    --chart-6: #22d3ee;
    --chart-7: #fb923c;
    --chart-8: #e879f9;
}

/* ── Light Mode ──────────────────────────────────────── */
[data-theme="light"] {
    --dash-bg: #f8f9fc;
    --dash-surface: #ffffff;
    --dash-surface-2: #f1f3f8;
    --dash-surface-3: #e8ebf2;
    --dash-border: rgba(0, 0, 0, 0.08);
    --dash-border-hover: rgba(0, 0, 0, 0.15);
    --dash-text-1: #1a1d2e;
    --dash-text-2: #5c6380;
    --dash-text-3: #9ca3bf;
    --dash-accent: #4f46e5;
    --dash-accent-glow: rgba(79, 70, 229, 0.08);
    --dash-accent-text: #4f46e5;
    --dash-success: #059669;
    --dash-success-bg: rgba(5, 150, 105, 0.08);
    --dash-danger: #dc2626;
    --dash-danger-bg: rgba(220, 38, 38, 0.08);
    --dash-warning: #d97706;
    --dash-warning-bg: rgba(217, 119, 6, 0.08);
    --dash-info: #2563eb;
    --dash-info-bg: rgba(37, 99, 235, 0.08);
    --dash-purple: #7c3aed;
    --dash-purple-bg: rgba(124, 58, 237, 0.08);
}

/* ── Reset & Base ────────────────────────────────────── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: var(--dash-font);
    background: var(--dash-bg);
    color: var(--dash-text-1);
    line-height: 1.6;
    min-height: 100vh;
    transition: background 0.3s, color 0.3s;
}

/* ── Header ──────────────────────────────────────────── */
.header {
    background: var(--dash-surface);
    border-bottom: 1px solid var(--dash-border);
    padding: 16px 32px;
    display: flex;
    align-items: center;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(16px);
}

.header-text { flex: 1; }

.header-title {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--dash-text-1);
}

.header-title .version {
    font-size: 0.7rem;
    font-weight: 400;
    opacity: 0.4;
    margin-left: 6px;
}

.header-sub {
    font-size: 0.75rem;
    color: var(--dash-text-3);
    margin-top: 1px;
}

/* Theme toggle button */
.theme-toggle {
    background: var(--dash-surface-2);
    border: 1px solid var(--dash-border);
    border-radius: var(--dash-radius-sm);
    padding: 6px 10px;
    cursor: pointer;
    color: var(--dash-text-2);
    font-size: 1rem;
    line-height: 1;
    transition: all 0.2s;
    flex-shrink: 0;
}

.theme-toggle:hover {
    border-color: var(--dash-border-hover);
    color: var(--dash-text-1);
}

/* ── Layout ──────────────────────────────────────────── */
.main { max-width: 1440px; margin: 0 auto; padding: 24px 32px; }

.section {
    margin-bottom: 20px;
    background: var(--dash-surface);
    border: 1px solid var(--dash-border);
    border-radius: var(--dash-radius);
    overflow: hidden;
    transition: background 0.3s, border-color 0.3s;
}

.section-head {
    padding: 14px 20px 12px;
    border-bottom: 1px solid var(--dash-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.section-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--dash-text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.section-body { padding: 20px; }

/* ── Run Tabs ────────────────────────────────────────── */
.run-tabs {
    display: flex;
    gap: 4px;
    padding: 12px 20px;
    background: var(--dash-bg);
    border-bottom: 1px solid var(--dash-border);
    overflow-x: auto;
}

.run-tab {
    padding: 7px 14px;
    border-radius: var(--dash-radius-sm);
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--dash-text-3);
    cursor: pointer;
    border: 1px solid transparent;
    background: transparent;
    white-space: nowrap;
    transition: all 0.2s;
    font-family: var(--dash-font);
}

.run-tab:hover {
    color: var(--dash-text-2);
    background: var(--dash-surface-2);
}

.run-tab.active {
    color: var(--dash-accent-text);
    background: var(--dash-accent-glow);
    border-color: rgba(99, 102, 241, 0.25);
}

/* ── Metric Cards ────────────────────────────────────── */
.metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
    gap: 12px;
}

.metric-card {
    background: var(--dash-surface-2);
    border: 1px solid var(--dash-border);
    border-radius: var(--dash-radius);
    padding: 16px;
    text-align: center;
    transition: border-color 0.2s;
}

.metric-card:hover { border-color: var(--dash-border-hover); }

.metric-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--dash-text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
}

.metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    font-family: var(--dash-mono);
    letter-spacing: -0.02em;
}

/* Delta indicator below metric value */
.metric-delta {
    font-size: 0.7rem;
    font-family: var(--dash-mono);
    margin-top: 2px;
}

.delta-up { color: var(--dash-success); }
.delta-down { color: var(--dash-danger); }
.delta-neutral { color: var(--dash-text-3); }

/* Color utilities */
.c-green { color: var(--dash-success); }
.c-red { color: var(--dash-danger); }
.c-blue { color: var(--dash-info); }
.c-purple { color: var(--dash-purple); }
.c-amber { color: var(--dash-warning); }
.c-accent { color: var(--dash-accent-text); }
.c-default { color: var(--dash-text-1); }

/* ── Comparison Table ────────────────────────────────── */
.cmp-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }

.cmp-table th {
    text-align: left;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--dash-text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 12px;
    border-bottom: 1px solid var(--dash-border);
}

.cmp-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--dash-border);
    color: var(--dash-text-1);
}

.cmp-table tr:hover td { background: var(--dash-surface-2); }
.cmp-table .num { text-align: right; font-family: var(--dash-mono); font-size: 0.8rem; }
.cmp-table .best { color: var(--dash-success); font-weight: 600; }

/* ── Chart Section ───────────────────────────────────── */
.chart-container {
    position: relative;
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
}

.chart-container canvas { width: 100% !important; }

/* ── Bars (segment breakdown) ────────────────────────── */
.bar-group { display: flex; flex-direction: column; gap: 10px; }

.bar-row {
    display: grid;
    grid-template-columns: 140px 1fr 60px;
    align-items: center;
    gap: 12px;
}

.bar-label {
    font-size: 0.78rem;
    color: var(--dash-text-2);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bar-track {
    height: 22px;
    background: var(--dash-surface-3);
    border-radius: 4px;
    overflow: hidden;
}

.bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    min-width: 2px;
}

.bar-val {
    font-size: 0.78rem;
    font-family: var(--dash-mono);
    color: var(--dash-text-1);
    text-align: right;
}

/* ── Explorer ────────────────────────────────────────── */
.explorer-bar {
    display: flex;
    gap: 10px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--dash-border);
    flex-wrap: wrap;
    align-items: center;
}

.search-box {
    flex: 1;
    min-width: 200px;
    padding: 8px 12px;
    background: var(--dash-surface-2);
    border: 1px solid var(--dash-border);
    border-radius: var(--dash-radius-sm);
    color: var(--dash-text-1);
    font-size: 0.82rem;
    font-family: var(--dash-font);
    outline: none;
    transition: border-color 0.2s;
}

.search-box:focus { border-color: var(--dash-accent); }

.filter-sel {
    padding: 8px 12px;
    background: var(--dash-surface-2);
    border: 1px solid var(--dash-border);
    border-radius: var(--dash-radius-sm);
    color: var(--dash-text-1);
    font-size: 0.82rem;
    font-family: var(--dash-font);
}

.count-label { font-size: 0.75rem; color: var(--dash-text-3); }

.entry-scroll {
    max-height: 700px;
    overflow-y: auto;
    padding: 12px 20px;
}

.entry {
    background: var(--dash-surface-2);
    border: 1px solid var(--dash-border);
    border-radius: var(--dash-radius);
    margin-bottom: 8px;
    cursor: pointer;
    transition: border-color 0.2s;
}

.entry:hover { border-color: var(--dash-border-hover); }
.entry.open { border-color: var(--dash-accent); }
.entry.focused {
    outline: 2px solid var(--dash-accent);
    outline-offset: -2px;
}

.entry-top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
}

.e-id {
    font-family: var(--dash-mono);
    font-size: 0.7rem;
    color: var(--dash-text-3);
    width: 36px;
    flex-shrink: 0;
}

.e-src {
    flex: 1;
    font-size: 0.82rem;
    color: var(--dash-text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.e-chrf {
    font-family: var(--dash-mono);
    font-size: 0.75rem;
    color: var(--dash-text-2);
    flex-shrink: 0;
}

.badge {
    font-size: 0.62rem;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
}

.b-exact { background: var(--dash-success-bg); color: var(--dash-success); }
.b-miss { background: var(--dash-danger-bg); color: var(--dash-danger); }
.b-error { background: var(--dash-warning-bg); color: var(--dash-warning); }

.entry-detail {
    display: none;
    padding: 0 14px 14px;
    border-top: 1px solid var(--dash-border);
}

.entry.open .entry-detail { display: block; padding-top: 12px; }

.d-grid {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 6px 10px;
    font-size: 0.78rem;
}

.d-label { color: var(--dash-text-3); font-weight: 600; }
.d-val { font-family: var(--dash-mono); font-size: 0.76rem; color: var(--dash-text-1); word-break: break-all; }
.d-match { color: var(--dash-success); }
.d-diff { color: var(--dash-danger); }

/* Multi-run comparison within entry detail */
.run-compare-grid { display: grid; gap: 8px; margin-top: 8px; }

.run-compare-card {
    background: var(--dash-surface-3);
    border: 1px solid var(--dash-border);
    border-radius: var(--dash-radius-sm);
    padding: 10px 12px;
}

.run-compare-label {
    font-size: 0.68rem;
    color: var(--dash-accent-text);
    font-weight: 600;
    margin-bottom: 6px;
}

/* ── View Toggle ─────────────────────────────────────── */
.view-toggle {
    display: flex;
    gap: 4px;
    padding: 0 20px 12px;
}

.view-toggle-btn {
    padding: 7px 16px;
    border-radius: var(--dash-radius-sm);
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--dash-text-3);
    cursor: pointer;
    border: 1px solid var(--dash-border);
    background: transparent;
    font-family: var(--dash-font);
    transition: all 0.2s;
}

.view-toggle-btn:hover { color: var(--dash-text-2); background: var(--dash-surface-2); }

.view-toggle-btn.active {
    color: var(--dash-accent-text);
    background: var(--dash-accent-glow);
    border-color: rgba(99, 102, 241, 0.25);
}

/* ── Side-by-Side Table ──────────────────────────────── */
.sbs-table { font-size: 0.78rem; }
.sbs-table th { position: sticky; top: 0; background: var(--dash-surface); z-index: 2; }
.sbs-src { max-width: 200px; font-size: 0.78rem; color: var(--dash-text-2); }
.sbs-exp { max-width: 180px; font-family: var(--dash-mono); font-size: 0.74rem; color: var(--dash-text-2); }

.sbs-cell { vertical-align: top; padding: 8px 10px !important; }
.sbs-exact { background: var(--dash-success-bg); }
.sbs-miss { background: var(--dash-danger-bg); }

.sbs-pred {
    font-family: var(--dash-mono);
    font-size: 0.74rem;
    word-break: break-all;
    margin-bottom: 3px;
}

.sbs-exact .sbs-pred { color: var(--dash-success); }
.sbs-miss .sbs-pred { color: var(--dash-danger); }

.sbs-meta { font-size: 0.65rem; color: var(--dash-text-3); }

.sbs-wrap { max-height: 700px; overflow: auto; }

/* ── Export Toolbar ───────────────────────────────────── */
.export-bar {
    display: flex;
    gap: 8px;
    padding: 14px 20px;
    justify-content: flex-end;
    flex-wrap: wrap;
}

.export-btn {
    padding: 7px 14px;
    border-radius: var(--dash-radius-sm);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--dash-text-2);
    cursor: pointer;
    border: 1px solid var(--dash-border);
    background: var(--dash-surface-2);
    font-family: var(--dash-font);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 5px;
}

.export-btn:hover {
    border-color: var(--dash-border-hover);
    color: var(--dash-text-1);
    background: var(--dash-surface-3);
}

/* ── Drag-Drop Overlay ───────────────────────────────── */
.drop-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 999;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
}

.drop-overlay.active { display: flex; }

.drop-box {
    border: 2px dashed var(--dash-accent);
    border-radius: 16px;
    padding: 60px 80px;
    text-align: center;
    color: var(--dash-accent-text);
    font-size: 1.1rem;
    font-weight: 600;
}

.drop-box-sub {
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--dash-text-3);
    margin-top: 8px;
}

/* ── Toast Notification ──────────────────────────────── */
.toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--dash-surface-2);
    border: 1px solid var(--dash-border);
    border-radius: var(--dash-radius);
    padding: 12px 20px;
    font-size: 0.82rem;
    color: var(--dash-text-1);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
    pointer-events: none;
}

.toast.show {
    transform: translateY(0);
    opacity: 1;
}

/* ── Footer ──────────────────────────────────────────── */
.footer {
    text-align: center;
    padding: 20px;
    font-size: 0.72rem;
    color: var(--dash-text-3);
    border-top: 1px solid var(--dash-border);
    margin-top: 16px;
}

.footer a { color: var(--dash-accent-text); text-decoration: none; }
.footer a:hover { text-decoration: underline; }

.footer-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding-top: 6px;
    font-size: 0.7rem;
    flex-wrap: wrap;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 768px) {
    .main { padding: 16px; }
    .header { padding: 14px 16px; }
    .metric-grid { grid-template-columns: repeat(2, 1fr); }
    .bar-row { grid-template-columns: 100px 1fr 50px; }
    .explorer-bar { flex-direction: column; }
    .search-box { min-width: 100%; }
}
"""
