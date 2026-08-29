"""
Dashboard JavaScript — core rendering logic with delta indicators,
export, drag-drop, keyboard nav, and theme toggle.

Chart.js builders live in _dashboard_charts.py and are concatenated
at HTML assembly time.
"""

JS = r"""
// ── Core Dashboard Logic ────────────────────────────────
// R, activeIdx, $, runLabel, COLORS, and chart builders are global
// (defined in the chart script block which loads first).
if (!R || !R.length) throw new Error('No reports');

(function() {
    let viewMode = 'explorer';
    let focusedEntry = -1;

    // ── Helpers ──────────────────────────────────────
    const pct = v => v == null ? '—' : (v * 100).toFixed(1) + '%';
    const f1 = v => v == null ? '—' : Number(v).toFixed(1);
    const f4 = v => v == null ? '—' : '$' + Number(v).toFixed(4);
    const esc = s => s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';

    // Delta vs baseline (first run)
    function delta(current, baseline, higherIsBetter) {
        if (current == null || baseline == null || R.length < 2) return '';
        const d = current - baseline;
        if (Math.abs(d) < 0.0001) return '<span class="metric-delta delta-neutral">—</span>';
        const isUp = d > 0;
        const good = higherIsBetter ? isUp : !isUp;
        const cls = good ? 'delta-up' : 'delta-down';
        const arrow = isUp ? '▲' : '▼';
        const fmt = Math.abs(d) < 1 ? Math.abs(d).toFixed(3) : Math.abs(d).toFixed(1);
        return `<span class="metric-delta ${cls}">${arrow} ${fmt}</span>`;
    }

    function toast(msg) {
        const el = $('toast');
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 2500);
    }

    // ── 1. Theme Toggle ─────────────────────────────
    function initTheme() {
        const saved = localStorage.getItem('mt-eval-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        $('theme-btn').addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('mt-eval-theme', next);
            $('theme-btn').textContent = next === 'light' ? '🌙' : '☀️';
            destroyCharts();
            render();
        });
        const theme = document.documentElement.getAttribute('data-theme');
        $('theme-btn').textContent = theme === 'light' ? '🌙' : '☀️';
    }

    // ── 2. Run Tabs ─────────────────────────────────
    function buildTabs() {
        const bar = $('run-tabs');
        bar.innerHTML = '';
        R.forEach((r, i) => {
            const btn = document.createElement('button');
            btn.className = 'run-tab' + (i === activeIdx ? ' active' : '');
            btn.textContent = runLabel(r, i);
            btn.onclick = () => { activeIdx = i; destroyCharts(); render(); };
            bar.appendChild(btn);
        });
    }

    // ── 3. Metric Cards with Deltas ─────────────────
    function buildCards() {
        const o = R[activeIdx].overall || {};
        const b = R[0].overall || {}; // baseline
        const isBase = activeIdx === 0;
        const cards = [
            ['Entries', o.evaluated || 0, 'default', ''],
            ['Exact Match', pct(o.exact_match_rate), o.exact_match_rate >= 0.5 ? 'green' : 'red',
             isBase ? '' : delta((o.exact_match_rate||0)*100, (b.exact_match_rate||0)*100, true)],
            ['Miss Rate', pct(o.miss_rate), 'red',
             isBase ? '' : delta((o.miss_rate||0)*100, (b.miss_rate||0)*100, false)],
        ];
        if (o.corpus_chrf != null) cards.push(['chrF++', f1(o.corpus_chrf), 'purple',
            isBase ? '' : delta(o.corpus_chrf, b.corpus_chrf, true)]);
        if (o.corpus_bleu != null) cards.push(['BLEU', f1(o.corpus_bleu), 'blue',
            isBase ? '' : delta(o.corpus_bleu, b.corpus_bleu, true)]);
        if (o.total_cost_usd != null) cards.push(['Total Cost', f4(o.total_cost_usd), 'default',
            isBase ? '' : delta(o.total_cost_usd, b.total_cost_usd, false)]);
        if (o.avg_latency_s != null) cards.push(['Avg Latency', f1(o.avg_latency_s)+'s', 'default',
            isBase ? '' : delta(o.avg_latency_s, b.avg_latency_s, false)]);
        if (o.total_cost_usd && o.exact_match_count) {
            const cpe = o.total_cost_usd / o.exact_match_count;
            const bpe = b.total_cost_usd && b.exact_match_count ? b.total_cost_usd / b.exact_match_count : null;
            cards.push(['Cost/Match', '$'+cpe.toFixed(4), 'amber',
                isBase ? '' : delta(cpe, bpe, false)]);
        }
        // Plugin metrics
        const pm = o.plugin_metrics || {};
        const pCols = ['amber','blue','purple','green'];
        let pi = 0;
        Object.values(pm).forEach(data => {
            if (typeof data !== 'object' || data.error) return;
            Object.entries(data).forEach(([k, v]) => {
                if (typeof v !== 'number') return;
                const isR = k.includes('rate') || k.includes('validity');
                cards.push([k.replace(/_/g,' '), isR ? pct(v) : f1(v), pCols[pi++ % 4], '']);
            });
        });

        $('metric-cards').innerHTML = cards.map(([l,v,c,d]) =>
            `<div class="metric-card"><div class="metric-label">${l}</div>` +
            `<div class="metric-value c-${c}">${v}</div>${d}</div>`
        ).join('');
    }

    // ── 4. Run Comparison Table ──────────────────────
    function buildCompare() {
        const sec = $('compare-section');
        if (R.length < 2) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        const rates = R.map(r => r.overall?.exact_match_rate || 0);
        const chrfs = R.map(r => r.overall?.corpus_chrf || 0);
        const costs = R.map(r => r.overall?.total_cost_usd || 999);
        const bestR = Math.max(...rates), bestC = Math.max(...chrfs), bestCost = Math.min(...costs);
        let h = '<table class="cmp-table"><thead><tr>';
        h += '<th>Run</th><th>Model</th><th>Prompt</th><th class="num">N</th>';
        h += '<th class="num">Exact</th><th class="num">chrF++</th><th class="num">BLEU</th>';
        h += '<th class="num">Cost</th><th class="num">Latency</th><th class="num">$/Match</th>';
        h += '</tr></thead><tbody>';
        R.forEach((r, i) => {
            const o = r.overall || {}, c = r.config || {};
            const rc = o.exact_match_rate === bestR ? ' best' : '';
            const cc = o.corpus_chrf === bestC ? ' best' : '';
            const costc = o.total_cost_usd === bestCost ? ' best' : '';
            const bg = i === activeIdx ? ' style="background:var(--dash-accent-glow)"' : '';
            const cpm = o.exact_match_count ? '$'+(o.total_cost_usd/o.exact_match_count).toFixed(4) : '—';
            h += `<tr${bg}><td>${esc(runLabel(r,i))}</td><td>${esc(c.model||'?')}</td>`;
            h += `<td>${esc(c.prompt||'?')}</td><td class="num">${o.evaluated||0}</td>`;
            h += `<td class="num${rc}">${pct(o.exact_match_rate)}</td>`;
            h += `<td class="num${cc}">${f1(o.corpus_chrf)}</td>`;
            h += `<td class="num">${f1(o.corpus_bleu)}</td>`;
            h += `<td class="num${costc}">${f4(o.total_cost_usd)}</td>`;
            h += `<td class="num">${f1(o.avg_latency_s)}s</td>`;
            h += `<td class="num">${cpm}</td></tr>`;
        });
        h += '</tbody></table>';
        $('compare-table').innerHTML = h;
    }

    // ── 5. Segment Bars ─────────────────────────────
    function buildSegments() {
        const segs = R[activeIdx].by_segment || {};
        const keys = Object.keys(segs).sort();
        if (!keys.length) { $('segment-section').style.display = 'none'; return; }
        $('segment-section').style.display = '';
        let h = '';
        keys.forEach((name, i) => {
            const s = segs[name], rate = s.exact_match_count / (s.count || 1);
            const color = COLORS[i % COLORS.length];
            h += `<div class="bar-row"><div class="bar-label">${esc(name)} <span style="color:var(--dash-text-3)">(${s.count})</span></div>`;
            h += `<div class="bar-track"><div class="bar-fill" style="width:${(rate*100).toFixed(0)}%;background:${color}"></div></div>`;
            h += `<div class="bar-val">${pct(rate)}</div></div>`;
        });
        $('segment-bars').innerHTML = h;
    }

    // ── 6. Segment × Run Matrix ─────────────────────
    function buildSegmentCompare() {
        const sec = $('seg-compare-section');
        if (R.length < 2) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        const allSegs = new Set();
        R.forEach(r => Object.keys(r.by_segment || {}).forEach(s => allSegs.add(s)));
        const segNames = [...allSegs].sort();
        let h = '<table class="cmp-table"><thead><tr><th>Segment</th>';
        R.forEach((r, i) => { h += `<th class="num">${esc(runLabel(r,i).substring(0,20))}</th>`; });
        h += '</tr></thead><tbody>';
        segNames.forEach(name => {
            h += `<tr><td>${esc(name)}</td>`;
            const vals = R.map(r => { const s = (r.by_segment||{})[name]; return s ? s.exact_match_count/(s.count||1) : null; });
            const best = Math.max(...vals.filter(v => v !== null));
            vals.forEach(v => { h += `<td class="num${v===best?' best':''}">${v!=null?pct(v):'—'}</td>`; });
            h += '</tr>';
        });
        h += '</tbody></table>';
        $('seg-compare-table').innerHTML = h;
    }

    // ── 7. Side-by-Side View ────────────────────────
    function buildSideBySide() {
        const sec = $('sbs-section');
        if (viewMode !== 'sidebyside') { sec.style.display = 'none'; return; }
        sec.style.display = '';
        const idMap = new Map();
        R.forEach((r, ri) => {
            (r.entries || []).forEach(e => {
                if (!idMap.has(e.id)) idMap.set(e.id, { id: e.id, source: e.source, expected: e.expected, segment: e.segment, runs: {} });
                idMap.get(e.id).runs[ri] = e;
            });
        });
        let allEntries = [...idMap.values()].sort((a,b) => a.id - b.id);
        const q = ($('sbs-search').value || '').toLowerCase();
        const sf = $('sbs-filter-seg').value;
        const mf = $('sbs-filter-match').value;
        if (q) allEntries = allEntries.filter(e => e.source?.toLowerCase().includes(q) || e.expected?.toLowerCase().includes(q));
        if (sf) allEntries = allEntries.filter(e => e.segment === sf);
        if (mf === 'disagree') allEntries = allEntries.filter(e => { const m = Object.values(e.runs).map(r => r.exact_match); return m.some(v=>v) && m.some(v=>!v); });
        else if (mf === 'all_miss') allEntries = allEntries.filter(e => Object.values(e.runs).every(r => !r.exact_match));
        else if (mf === 'all_exact') allEntries = allEntries.filter(e => Object.values(e.runs).every(r => r.exact_match));
        $('sbs-count').textContent = `${allEntries.length} entries`;
        const segSel = $('sbs-filter-seg');
        const allSegs = [...new Set([...idMap.values()].map(e => e.segment))].filter(Boolean).sort();
        const curSeg = segSel.value;
        segSel.innerHTML = '<option value="">All segments</option>' + allSegs.map(s => `<option value="${s}"${s===curSeg?' selected':''}>${s}</option>`).join('');
        const show = allEntries.slice(0, 300);
        let h = '<table class="cmp-table sbs-table"><thead><tr><th style="width:30px">ID</th><th>Source</th><th>Expected</th>';
        R.forEach((r, i) => { h += `<th style="min-width:150px"><span style="color:${COLORS[i%COLORS.length]}">${esc(runLabel(r,i).substring(0,20))}</span></th>`; });
        h += '</tr></thead><tbody>';
        show.forEach(e => {
            h += `<tr><td class="num">${e.id}</td><td class="sbs-src">${esc(e.source)}</td><td class="sbs-exp">${esc(e.expected)}</td>`;
            R.forEach((r, ri) => {
                const entry = e.runs[ri];
                if (!entry) { h += '<td class="sbs-cell">—</td>'; return; }
                const cls = entry.exact_match ? 'sbs-exact' : 'sbs-miss';
                h += `<td class="sbs-cell ${cls}"><div class="sbs-pred">${esc(entry.predicted)}</div>`;
                h += `<div class="sbs-meta">${f1(entry.chrf_score)} chrF · ${f4(entry.cost_usd)}</div></td>`;
            });
            h += '</tr>';
        });
        h += '</tbody></table>';
        if (allEntries.length > 300) h += `<div style="text-align:center;padding:12px;color:var(--dash-text-3);font-size:0.8rem">Showing 300 of ${allEntries.length}</div>`;
        $('sbs-table-wrap').innerHTML = h;
    }

    // ── 8. Entry Explorer ───────────────────────────
    function buildExplorer() {
        const sec = $('explorer-section');
        if (viewMode !== 'explorer') { sec.style.display = 'none'; return; }
        sec.style.display = '';
        const entries = R[activeIdx].entries || [];
        const segSel = $('filter-seg');
        const segNames = [...new Set(entries.map(e => e.segment))].filter(Boolean).sort();
        const cv = segSel.value;
        segSel.innerHTML = '<option value="">All segments</option>' + segNames.map(s => `<option value="${s}"${s===cv?' selected':''}>${s}</option>`).join('');
        renderEntries();
    }

    function getFilteredEntries() {
        const entries = R[activeIdx].entries || [];
        const q = ($('search-box').value || '').toLowerCase();
        const seg = $('filter-seg').value;
        const mf = $('filter-match').value;
        return entries.filter(e => {
            if (q && !e.source?.toLowerCase().includes(q) && !e.predicted?.toLowerCase().includes(q) && !e.expected?.toLowerCase().includes(q)) return false;
            if (seg && e.segment !== seg) return false;
            if (mf === 'exact' && !e.exact_match) return false;
            if (mf === 'miss' && (e.exact_match || e.error)) return false;
            if (mf === 'error' && !e.error) return false;
            return true;
        });
    }

    function renderEntries() {
        const entries = R[activeIdx].entries || [];
        const filtered = getFilteredEntries();
        $('entry-count').textContent = `${filtered.length} / ${entries.length}`;
        focusedEntry = -1;
        const show = filtered.slice(0, 200);
        let h = '';
        show.forEach((e, idx) => {
            const badge = e.error ? '<span class="badge b-error">ERR</span>' : e.exact_match ? '<span class="badge b-exact">EXACT</span>' : '<span class="badge b-miss">MISS</span>';
            const pc = e.exact_match ? 'd-match' : 'd-diff';
            let multiH = '';
            if (R.length > 1) {
                multiH = '<div class="run-compare-grid">';
                R.forEach((rr, ri) => {
                    if (ri === activeIdx) return;
                    const other = (rr.entries||[]).find(oe => oe.id === e.id);
                    if (!other) return;
                    const oc = other.exact_match ? 'd-match' : 'd-diff';
                    const ob = other.exact_match ? '<span class="badge b-exact" style="font-size:0.58rem">EXACT</span>' : '<span class="badge b-miss" style="font-size:0.58rem">MISS</span>';
                    multiH += `<div class="run-compare-card"><div class="run-compare-label">${esc(runLabel(rr,ri))} ${ob}</div>`;
                    multiH += `<div class="d-grid"><span class="d-label">Predicted</span><span class="d-val ${oc}">${esc(other.predicted)}</span>`;
                    multiH += `<span class="d-label">chrF++</span><span class="d-val">${f1(other.chrf_score)}</span></div></div>`;
                });
                multiH += '</div>';
            }
            h += `<div class="entry" data-idx="${idx}" onclick="this.classList.toggle('open')"><div class="entry-top">`;
            h += `<span class="e-id">#${e.id}</span><span class="e-src">${esc(e.source)}</span>`;
            h += `<span class="e-chrf">${f1(e.chrf_score)}</span>${badge}</div>`;
            h += `<div class="entry-detail"><div class="d-grid">`;
            h += `<span class="d-label">Expected</span><span class="d-val">${esc(e.expected)}</span>`;
            h += `<span class="d-label">Predicted</span><span class="d-val ${pc}">${esc(e.predicted)}</span>`;
            h += `<span class="d-label">chrF++</span><span class="d-val">${f1(e.chrf_score)}</span>`;
            h += `<span class="d-label">Latency</span><span class="d-val">${f1(e.latency_s)}s</span>`;
            h += `<span class="d-label">Cost</span><span class="d-val">${f4(e.cost_usd)}</span>`;
            if (e.error) h += `<span class="d-label">Error</span><span class="d-val d-diff">${esc(e.error)}</span>`;
            h += `</div>${multiH}</div></div>`;
        });
        if (filtered.length > 200) {
            h += `<button id="show-all-btn" style="display:block;width:100%;padding:12px;background:var(--dash-surface-2);border:1px solid var(--dash-border);border-radius:var(--dash-radius-sm);color:var(--dash-text-2);cursor:pointer;font-family:var(--dash-font);font-size:0.82rem;margin-top:8px">Show all ${filtered.length} entries</button>`;
        }
        $('entry-list').innerHTML = h;
        const showAllBtn = $('show-all-btn');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                let allH = '';
                filtered.forEach((e, idx) => {
                    const badge = e.error ? '<span class="badge b-error">ERR</span>' : e.exact_match ? '<span class="badge b-exact">EXACT</span>' : '<span class="badge b-miss">MISS</span>';
                    allH += `<div class="entry" data-idx="${idx}" onclick="this.classList.toggle('open')"><div class="entry-top">`;
                    allH += `<span class="e-id">#${e.id}</span><span class="e-src">${esc(e.source)}</span>`;
                    allH += `<span class="e-chrf">${f1(e.chrf_score)}</span>${badge}</div></div>`;
                });
                $('entry-list').innerHTML = allH;
            });
        }
    }

    // ── 9. Export Functions ──────────────────────────
    function exportJSON() {
        const data = JSON.stringify(R[activeIdx], null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (runLabel(R[activeIdx], activeIdx) + '.json').replace(/\s+/g, '_');
        a.click(); URL.revokeObjectURL(url);
        toast('JSON downloaded');
    }

    function exportCSV() {
        const entries = getFilteredEntries();
        const cols = ['id','source','expected','predicted','exact_match','chrf_score','cost_usd','latency_s','segment'];
        let csv = cols.join(',') + '\n';
        entries.forEach(e => {
            csv += cols.map(c => {
                let v = e[c] ?? '';
                v = String(v).replace(/"/g, '""');
                return `"${v}"`;
            }).join(',') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (runLabel(R[activeIdx], activeIdx) + '.csv').replace(/\s+/g, '_');
        a.click(); URL.revokeObjectURL(url);
        toast('CSV downloaded');
    }

    function copyClipboard() {
        const entries = getFilteredEntries();
        const cols = ['id','source','expected','predicted','exact_match','chrf_score'];
        let tsv = cols.join('\t') + '\n';
        entries.forEach(e => { tsv += cols.map(c => e[c] ?? '').join('\t') + '\n'; });
        navigator.clipboard.writeText(tsv).then(() => toast('Copied to clipboard'));
    }

    // ── 10. Drag-and-Drop ───────────────────────────
    function initDragDrop() {
        const overlay = $('drop-overlay');
        let dragCount = 0;
        document.addEventListener('dragenter', e => { e.preventDefault(); dragCount++; overlay.classList.add('active'); });
        document.addEventListener('dragleave', e => { e.preventDefault(); dragCount--; if (dragCount <= 0) { dragCount = 0; overlay.classList.remove('active'); } });
        document.addEventListener('dragover', e => e.preventDefault());
        document.addEventListener('drop', e => {
            e.preventDefault(); dragCount = 0; overlay.classList.remove('active');
            [...e.dataTransfer.files].forEach(file => {
                if (!file.name.endsWith('.json')) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        // Inject run name from filename if missing
                        if (!data.config?.run_name) {
                            if (!data.config) data.config = {};
                            data.config.run_name = file.name.replace(/_report\.json$/, '').replace('.json', '');
                        }
                        R.push(data);
                        destroyCharts();
                        render();
                        toast(`Added: ${file.name}`);
                    } catch (err) { toast('Invalid JSON: ' + file.name); }
                };
                reader.readAsText(file);
            });
        });
    }

    // ── 11. Keyboard Navigation ─────────────────────
    function initKeyboard() {
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            const entries = $('entry-list')?.querySelectorAll('.entry');
            if (!entries || !entries.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedEntry = Math.min(focusedEntry + 1, entries.length - 1);
                entries.forEach((el, i) => el.classList.toggle('focused', i === focusedEntry));
                entries[focusedEntry]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedEntry = Math.max(focusedEntry - 1, 0);
                entries.forEach((el, i) => el.classList.toggle('focused', i === focusedEntry));
                entries[focusedEntry]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && focusedEntry >= 0) {
                entries[focusedEntry]?.classList.toggle('open');
            } else if (e.key === 'Escape') {
                entries.forEach(el => { el.classList.remove('open'); el.classList.remove('focused'); });
                focusedEntry = -1;
            }
        });
    }

    // ── View Toggle ─────────────────────────────────
    function bindViewToggle() {
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                viewMode = btn.dataset.view;
                document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewMode));
                render();
            });
        });
    }

    // ── Render All ───────────────────────────────────
    function render() {
        buildTabs();
        buildCards();
        buildCompare();
        buildBarChart();
        buildRadar();
        buildSegments();
        buildSegmentCompare();
        buildHistogram();
        buildSideBySide();
        buildExplorer();
    }

    // ── Bind & Init ─────────────────────────────────
    $('search-box').addEventListener('input', renderEntries);
    $('filter-seg').addEventListener('change', renderEntries);
    $('filter-match').addEventListener('change', renderEntries);
    $('sbs-search')?.addEventListener('input', buildSideBySide);
    $('sbs-filter-seg')?.addEventListener('change', buildSideBySide);
    $('sbs-filter-match')?.addEventListener('change', buildSideBySide);
    $('export-json')?.addEventListener('click', exportJSON);
    $('export-csv')?.addEventListener('click', exportCSV);
    $('export-copy')?.addEventListener('click', copyClipboard);
    bindViewToggle();
    initTheme();
    initDragDrop();
    initKeyboard();
    render();
})();
"""
