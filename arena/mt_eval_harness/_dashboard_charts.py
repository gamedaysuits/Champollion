"""
Chart.js chart-builder functions, injected into the dashboard JS.
Separated from _dashboard_js.py to keep files manageable.
"""

CHART_JS = r"""
// ── Shared Global State ─────────────────────────────────
// These are hoisted to global scope so both chart builders and the
// core IIFE can share R (reports), activeIdx, and helpers.
const R = window.__REPORTS || [];
let activeIdx = 0;
const $ = id => document.getElementById(id);
function runLabel(r, i) {
    const c = r.config || {};
    return (c.run_name || c.model || r.run_id || 'Run '+(i+1)).substring(0, 35);
}

// ── Chart.js Builders ───────────────────────────────────
const COLORS = ['#6366f1','#34d399','#f59e0b','#f87171','#a78bfa','#22d3ee','#fb923c','#e879f9'];
let barChart = null, histChart = null, radarChart = null;

function destroyCharts() {
    [barChart, histChart, radarChart].forEach(c => { if (c) c.destroy(); });
    barChart = histChart = radarChart = null;
}

// Grouped bar chart: Exact Match % and chrF++ per run
function buildBarChart() {
    const sec = $('barchart-section');
    if (R.length < 2) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    const canvas = $('bar-canvas');
    if (barChart) barChart.destroy();
    const labels = R.map((r, i) => runLabel(r, i).substring(0, 22));
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    barChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Exact Match %',
                    data: R.map(r => ((r.overall || {}).exact_match_rate || 0) * 100),
                    backgroundColor: COLORS[0] + 'cc',
                    borderRadius: 4,
                    barPercentage: 0.7,
                },
                {
                    label: 'chrF++',
                    data: R.map(r => (r.overall || {}).corpus_chrf || 0),
                    backgroundColor: COLORS[1] + 'cc',
                    borderRadius: 4,
                    barPercentage: 0.7,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: textColor, font: { size: 11 } } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
                y: { beginAtZero: true, max: 100, ticks: { color: textColor }, grid: { color: gridColor } }
            }
        }
    });
}

// chrF++ distribution histogram for active run
function buildHistogram() {
    const entries = R[activeIdx].entries || [];
    const sec = $('histogram-section');
    if (!entries.length) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    const canvas = $('hist-canvas');
    if (histChart) histChart.destroy();
    const bins = new Array(10).fill(0);
    entries.forEach(e => { const b = Math.min(9, Math.floor((e.chrf_score || 0) / 10)); bins[b]++; });
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    histChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['0-10','10-20','20-30','30-40','40-50','50-60','60-70','70-80','80-90','90-100'],
            datasets: [{
                label: 'Entries',
                data: bins,
                backgroundColor: COLORS[activeIdx % COLORS.length] + 'aa',
                borderRadius: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { title: ctx => 'chrF++ ' + ctx[0].label, label: ctx => ctx.raw + ' entries' } }
            },
            scales: {
                x: { title: { display: true, text: 'chrF++ Score Range', color: textColor }, ticks: { color: textColor }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
            }
        }
    });
}

// Radar chart: multi-metric comparison across runs
function buildRadar() {
    const sec = $('radar-section');
    if (R.length < 2) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    const canvas = $('radar-canvas');
    if (radarChart) radarChart.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    const metrics = ['exact_match_rate', 'corpus_chrf', 'corpus_bleu'];
    const labels = ['Exact Match %', 'chrF++', 'BLEU'];
    const datasets = R.map((r, i) => ({
        label: runLabel(r, i).substring(0, 20),
        data: metrics.map(k => {
            let v = (r.overall || {})[k] || 0;
            if (k === 'exact_match_rate') v *= 100;
            return v;
        }),
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: COLORS[i % COLORS.length] + '22',
        pointBackgroundColor: COLORS[i % COLORS.length],
        pointRadius: 3,
    }));
    radarChart = new Chart(canvas, {
        type: 'radar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: textColor, font: { size: 10 } } } },
            scales: { r: { beginAtZero: true, max: 100, ticks: { color: textColor, backdropColor: 'transparent' }, grid: { color: gridColor }, pointLabels: { color: textColor } } }
        }
    });
}
"""
